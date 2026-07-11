/**
 * Amenity money-capture service — the LIVE code path that writes the amenity
 * money columns (feeChargedCents / depositHeldCents / depositRefundedCents /
 * depositForfeitedCents) and drives the parallel GL sync.
 *
 * Dispatch:  founder-os#10181 (YCM #329) — Slices 1–4.
 * Closes:    "THE GAP" — the 4 money columns had ZERO live writes; the live
 *            reservation flow recorded booking/approval/status only. This is the
 *            service that charges the fee, holds the deposit, and refunds /
 *            forfeits it — snapshotting each into the reservation row.
 *
 * ── HARD MONEY-SAFETY GUARANTEES (money-touching code on a live customer's books)
 *
 *  A. PER-ASSOCIATION GATED, FAIL-SAFE OFF. Every entry point gates on
 *     `isGlEnabledForAssociation(associationId)` BEFORE it touches Stripe or
 *     writes a column. A non-allowlisted association (the default for EVERY
 *     association, incl. CHC) is a PURE NO-OP: no charge, no hold, no column
 *     write, no GL — the booking / resolution proceeds exactly as before. This
 *     is the default-OFF money-safety floor: enabling live capture for CHC is a
 *     separate `GL_ENABLED_ASSOCIATIONS` flip (a William-ratify gate), not code.
 *
 *  B. COLUMNS REFLECT MONEY ACTUALLY CAPTURED. A column is written ONLY after
 *     the corresponding Stripe operation succeeds. If the gateway can't charge
 *     (no payment context / a decline), the column stays 0 and the booking
 *     still succeeds — we never fabricate a GL liability for money that did not
 *     move. Fees / deposits are sourced from the amenity config, NEVER hardcoded.
 *
 *  C. FORWARD-ONLY / PARALLEL. The reservation row is the record of fact. The GL
 *     sync (`maybeSyncAssociationAmenityGl`) is best-effort + non-fatal — a GL
 *     failure can never propagate into the money path (guarantee 1 of the sync).
 *
 *  D. INJECTABLE GATEWAY. The Stripe interaction is an injected `AmenityMoneyGateway`
 *     so the orchestration (gating, column math, invariants, GL wiring) is unit-
 *     testable WITHOUT touching live Stripe. The default gateway is real Stripe
 *     TEST/LIVE (per the association's connect config) but only ever runs for an
 *     allowlisted association.
 */

import { eq } from "drizzle-orm";
import { db } from "../db";
import { amenities, amenityReservations } from "@shared/schema";
import { isGlEnabledForAssociation } from "./gl/flag";
import { maybeSyncAssociationAmenityGl } from "./gl/amenity-runtime-sync";
import { createStripeAmenityGateway } from "./amenity-stripe-gateway";

/** Result of a single Stripe money operation. `ok` gates the column write. */
export interface AmenityGatewayResult {
  ok: boolean;
  /** Stripe PaymentIntent / refund id, when the op produced one. */
  intentId?: string | null;
  /** Why the op did not run / failed (e.g. "payment-context-unavailable"). */
  reason?: string | null;
}

/**
 * The Stripe surface the amenity money loop needs. Injected so the service's
 * orchestration is testable without a live Stripe call. All amounts are INTEGER
 * CENTS (matching the schema columns) so nothing float-drifts.
 */
export interface AmenityMoneyGateway {
  /** Immediate charge of the usage fee (income). */
  chargeFee(args: { reservationId: string; amountCents: number }): Promise<AmenityGatewayResult>;
  /** Auth-and-hold the refundable deposit (manual-capture PaymentIntent). */
  holdDeposit(args: { reservationId: string; amountCents: number }): Promise<AmenityGatewayResult>;
  /**
   * Release/refund the (uncaptured or captured) held deposit back to the resident.
   * `holdIntentId` (when known — persisted at hold time) drives a strongly-consistent
   * direct lookup; absent, the gateway falls back to eventually-consistent search.
   */
  refundDeposit(args: { reservationId: string; amountCents: number; holdIntentId?: string | null }): Promise<AmenityGatewayResult>;
  /**
   * Forfeit (capture → income) some/all of the held deposit for damage/violation.
   * `holdIntentId` (when known) drives a strongly-consistent direct lookup.
   */
  forfeitDeposit(args: { reservationId: string; amountCents: number; holdIntentId?: string | null }): Promise<AmenityGatewayResult>;
}

export interface AmenityCaptureResult {
  skipped: boolean;
  reason?: string;
  feeChargedCents: number;
  depositHeldCents: number;
  /** True if any money column changed (drives whether the row/GL was updated). */
  mutated: boolean;
}

export interface AmenityResolveResult {
  skipped: boolean;
  reason?: string;
  depositRefundedCents: number;
  depositForfeitedCents: number;
  mutated: boolean;
}

/**
 * Resolve the production Stripe gateway for one reservation. Deferred (per-call)
 * so the gate can short-circuit BEFORE any Stripe config is even resolved for a
 * non-allowlisted association.
 */
async function resolveDefaultGateway(
  associationId: string,
  personId: string,
): Promise<AmenityMoneyGateway> {
  return createStripeAmenityGateway({ associationId, personId });
}

/**
 * SLICE 1 (charge booking fee → feeChargedCents) + SLICE 2 (hold refundable
 * deposit → depositHeldCents). Call this AFTER a reservation row is created.
 *
 * Gated fail-safe off (guarantee A): a non-allowlisted association returns
 * `{ skipped: true }` and touches nothing. When enabled, charges the fee + holds
 * the deposit (amounts from the amenity config, never hardcoded), writes only
 * the columns whose Stripe op succeeded, then fires the non-fatal GL sync.
 */
export async function captureAmenityBookingMoney(args: {
  reservationId: string;
  /** Injected in tests; the real Stripe gateway is resolved by default. */
  gateway?: AmenityMoneyGateway;
}): Promise<AmenityCaptureResult> {
  const [reservation] = await db
    .select()
    .from(amenityReservations)
    .where(eq(amenityReservations.id, args.reservationId));
  if (!reservation) {
    return { skipped: true, reason: "reservation-not-found", feeChargedCents: 0, depositHeldCents: 0, mutated: false };
  }

  const associationId = reservation.associationId;

  // GUARANTEE A — per-association gate, fail-safe off. Default-off = pure no-op.
  if (!isGlEnabledForAssociation(associationId)) {
    return { skipped: true, reason: "not-enabled", feeChargedCents: 0, depositHeldCents: 0, mutated: false };
  }

  // Already captured? Idempotent — don't double-charge on a retry.
  if (reservation.feeChargedCents > 0 || reservation.depositHeldCents > 0) {
    return {
      skipped: true,
      reason: "already-captured",
      feeChargedCents: reservation.feeChargedCents,
      depositHeldCents: reservation.depositHeldCents,
      mutated: false,
    };
  }

  const [amenity] = await db.select().from(amenities).where(eq(amenities.id, reservation.amenityId));
  if (!amenity) {
    return { skipped: true, reason: "amenity-not-found", feeChargedCents: 0, depositHeldCents: 0, mutated: false };
  }

  // GUARANTEE B — amounts sourced from the amenity config, NEVER hardcoded.
  const feeAmount = amenity.usageFeeCents;
  const depositAmount = amenity.depositCents;
  if (feeAmount <= 0 && depositAmount <= 0) {
    // Free amenity — nothing to capture. Not a skip-for-gating, just no money.
    return { skipped: false, reason: "no-money-configured", feeChargedCents: 0, depositHeldCents: 0, mutated: false };
  }

  const gateway = args.gateway ?? (await resolveDefaultGateway(associationId, reservation.personId));

  let feeChargedCents = 0;
  let depositHeldCents = 0;
  // A-STRIPE-003: capture the deposit-hold PaymentIntent id so refund/forfeit
  // can look it up strongly-consistently (direct by id) instead of via the
  // eventually-consistent Stripe Search API.
  let depositHoldIntentId: string | null = null;

  // SLICE 1 — charge the usage fee (immediate). Column written only on success.
  if (feeAmount > 0) {
    const feeResult = await gateway.chargeFee({ reservationId: reservation.id, amountCents: feeAmount });
    if (feeResult.ok) feeChargedCents = feeAmount;
  }

  // SLICE 2 — hold the refundable deposit (auth-and-hold). Written only on success.
  if (depositAmount > 0) {
    const holdResult = await gateway.holdDeposit({ reservationId: reservation.id, amountCents: depositAmount });
    if (holdResult.ok) {
      depositHeldCents = depositAmount;
      depositHoldIntentId = holdResult.intentId ?? null;
    }
  }

  const mutated = feeChargedCents > 0 || depositHeldCents > 0;
  if (mutated) {
    await db
      .update(amenityReservations)
      .set({
        feeChargedCents,
        depositHeldCents,
        // Persist only when we actually held a deposit; never clobber with null.
        ...(depositHoldIntentId ? { depositHoldIntentId } : {}),
        updatedAt: new Date(),
      })
      .where(eq(amenityReservations.id, reservation.id));

    // GUARANTEE C — best-effort, non-fatal GL sync (never breaks the money path).
    await maybeSyncAssociationAmenityGl(associationId, "amenity-booking-capture");
  }

  return { skipped: false, feeChargedCents, depositHeldCents, mutated };
}

/**
 * SLICE 3 (refund deposit on clean checkout → depositRefundedCents) + SLICE 4
 * (forfeit deposit on damage/violation → depositForfeitedCents). Supports a
 * partial split (refund some, forfeit some) in one call.
 *
 * Invariants (fail-loud): amounts are non-negative integer cents, and
 * `alreadyResolved + refundCents + forfeitCents <= depositHeldCents` — you can
 * never refund/forfeit more than was held (nor more than remains unresolved).
 * Gated fail-safe off (guarantee A). Columns are incremented (not overwritten)
 * so partial resolutions accumulate correctly.
 */
export async function resolveAmenityDeposit(args: {
  reservationId: string;
  refundCents?: number;
  forfeitCents?: number;
  gateway?: AmenityMoneyGateway;
}): Promise<AmenityResolveResult> {
  const refundReq = args.refundCents ?? 0;
  const forfeitReq = args.forfeitCents ?? 0;

  const [reservation] = await db
    .select()
    .from(amenityReservations)
    .where(eq(amenityReservations.id, args.reservationId));
  if (!reservation) {
    return { skipped: true, reason: "reservation-not-found", depositRefundedCents: 0, depositForfeitedCents: 0, mutated: false };
  }

  const associationId = reservation.associationId;

  // GUARANTEE A — per-association gate, fail-safe off.
  if (!isGlEnabledForAssociation(associationId)) {
    return {
      skipped: true,
      reason: "not-enabled",
      depositRefundedCents: reservation.depositRefundedCents,
      depositForfeitedCents: reservation.depositForfeitedCents,
      mutated: false,
    };
  }

  // Fail-loud invariants — a negative/fractional amount is a programming error.
  for (const [label, v] of [["refundCents", refundReq], ["forfeitCents", forfeitReq]] as const) {
    if (!Number.isInteger(v) || v < 0) {
      throw new Error(`amenity deposit resolution: ${label} must be a non-negative integer (cents), got ${v}`);
    }
  }
  if (refundReq === 0 && forfeitReq === 0) {
    return {
      skipped: true,
      reason: "no-resolution-amount",
      depositRefundedCents: reservation.depositRefundedCents,
      depositForfeitedCents: reservation.depositForfeitedCents,
      mutated: false,
    };
  }

  const held = reservation.depositHeldCents;
  const alreadyResolved = reservation.depositRefundedCents + reservation.depositForfeitedCents;
  const remaining = held - alreadyResolved;
  if (refundReq + forfeitReq > remaining) {
    throw new Error(
      `amenity deposit resolution: refund (${refundReq}) + forfeit (${forfeitReq}) exceeds the ` +
        `${remaining}¢ unresolved deposit (held=${held}, already resolved=${alreadyResolved}) for reservation ${reservation.id}`,
    );
  }

  const gateway = args.gateway ?? (await resolveDefaultGateway(associationId, reservation.personId));

  let refunded = 0;
  let forfeited = 0;

  // A-STRIPE-003: prefer the stored hold intent id (strongly consistent) for the
  // resolution lookup; the gateway falls back to search when it's absent (legacy).
  const holdIntentId = reservation.depositHoldIntentId ?? null;

  // SLICE 3 — refund. Column incremented only on a successful Stripe refund.
  if (refundReq > 0) {
    const r = await gateway.refundDeposit({ reservationId: reservation.id, amountCents: refundReq, holdIntentId });
    if (r.ok) refunded = refundReq;
  }

  // SLICE 4 — forfeit (capture → income). Incremented only on success.
  if (forfeitReq > 0) {
    const f = await gateway.forfeitDeposit({ reservationId: reservation.id, amountCents: forfeitReq, holdIntentId });
    if (f.ok) forfeited = forfeitReq;
  }

  const mutated = refunded > 0 || forfeited > 0;
  const nextRefunded = reservation.depositRefundedCents + refunded;
  const nextForfeited = reservation.depositForfeitedCents + forfeited;

  if (mutated) {
    await db
      .update(amenityReservations)
      .set({ depositRefundedCents: nextRefunded, depositForfeitedCents: nextForfeited, updatedAt: new Date() })
      .where(eq(amenityReservations.id, reservation.id));

    // GUARANTEE C — best-effort, non-fatal GL sync.
    await maybeSyncAssociationAmenityGl(associationId, "amenity-deposit-resolution");
  }

  return {
    skipped: false,
    depositRefundedCents: nextRefunded,
    depositForfeitedCents: nextForfeited,
    mutated,
  };
}
