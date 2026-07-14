/**
 * CT-legal convenience-fee structure — settings + fee math + platform-revenue
 * booking.
 *
 * Design of record: founder-os wiki/research/chc-processing-fee-legality-2026-07-14.md
 * §6 (the recommended structure). Summary of the legal shape this code
 * implements:
 *
 *   - The card-payment fee is charged AND KEPT BY THE PLATFORM (YCM as an
 *     independent third-party processor) — never set, collected, or received
 *     by the association. The association's ledger shows the assessment at
 *     face value; the fee books here, to `platform_processing_fees`, and
 *     NEVER to `owner_ledger_entries`.
 *   - Card fee amount is tied to actual card-processing cost (~2.9% + $0.30 —
 *     Stripe's real blended card rate), not a round flat $5-10 (memo §6.3).
 *   - ACH stays free (or a small flat fee) by default — real Stripe ACH cost
 *     is ~0.8% capped at $5, so 0 is a strict subsidy either way (memo §6.4).
 *   - Feature-flagged PER ASSOCIATION, default OFF. While OFF, every read in
 *     this module returns "disabled" and no caller may add a fee — the owner
 *     checkout stays byte-identical to pre-existing ACH-only behavior.
 *
 * IMPORTANT (single-Stripe-account constraint — read before changing this
 * file): today YCM runs ONE Stripe account for Cherry Hill Court (no Stripe
 * Connect — see server/services/multi-party-connect/flag.ts +
 * stripe-connect-resolver.ts). This module's "platform revenue" split is an
 * ACCOUNTING split ONLY: the assessment and the fee land in the SAME Stripe
 * balance from ONE combined charge; `platform_processing_fees` is what keeps
 * them apart in YCM's own books. Onboarding a SECOND fee-collecting
 * association onto a DIFFERENT bank account would require Stripe Connect + a
 * real `application_fee_amount` split (the mechanism already scaffolded for
 * Flows 2/3 — see stripe-connect.ts + computeApplicationFeeCents in
 * stripe-charge-metadata.ts) so the fee actually routes to a separate Stripe
 * balance instead of just a separate ledger row.
 */

import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import {
  associationFeeSettings,
  platformProcessingFees,
  type AssociationFeeSettings,
  type PlatformProcessingFee,
} from "@shared/schema";
import { log } from "../logger";

const AUDIT_SOURCE = "convenience-fee";

export type CheckoutMethod = "ach" | "card";

export interface ResolvedFeeSettings {
  cardFeeEnabled: boolean;
  cardFeePercentBps: number;
  cardFeeFixedCents: number;
  achFeeCents: number;
}

/** Defaults applied when an association has no row yet — card fee OFF. */
export const DEFAULT_FEE_SETTINGS: ResolvedFeeSettings = {
  cardFeeEnabled: false,
  cardFeePercentBps: 290,
  cardFeeFixedCents: 30,
  achFeeCents: 0,
};

/**
 * Read an association's fee settings. No row yet → DEFAULT_FEE_SETTINGS
 * (card fee OFF) — this is what makes the feature inert for every
 * association until an explicit row turns it on.
 */
export async function getAssociationFeeSettings(
  associationId: string,
): Promise<ResolvedFeeSettings> {
  const [row] = await db
    .select()
    .from(associationFeeSettings)
    .where(eq(associationFeeSettings.associationId, associationId))
    .limit(1);
  if (!row) return { ...DEFAULT_FEE_SETTINGS };
  return {
    cardFeeEnabled: row.cardFeeEnabled === 1,
    cardFeePercentBps: row.cardFeePercentBps,
    cardFeeFixedCents: row.cardFeeFixedCents,
    achFeeCents: row.achFeeCents,
  };
}

/**
 * Upsert an association's fee settings (admin-only — see
 * server/routes/admin-payments.ts PATCH /api/admin/associations/:id/fee-settings).
 * This is the "one-command enable" the dark-ship depends on: flipping
 * `cardFeeEnabled` to true is the ONLY thing that turns the feature on for
 * that association, and it stays reversible (flip back to false = instantly
 * back to the byte-identical ACH-only behavior).
 */
export async function setAssociationFeeSettings(
  associationId: string,
  input: Partial<{
    cardFeeEnabled: boolean;
    cardFeePercentBps: number;
    cardFeeFixedCents: number;
    achFeeCents: number;
  }>,
  updatedBy?: string | null,
): Promise<AssociationFeeSettings> {
  const current = await db
    .select()
    .from(associationFeeSettings)
    .where(eq(associationFeeSettings.associationId, associationId))
    .limit(1);
  const existing = current[0];

  const next = {
    cardFeeEnabled:
      input.cardFeeEnabled !== undefined
        ? (input.cardFeeEnabled ? 1 : 0)
        : existing?.cardFeeEnabled ?? DEFAULT_FEE_SETTINGS.cardFeeEnabled
          ? 1
          : 0,
    cardFeePercentBps:
      input.cardFeePercentBps ?? existing?.cardFeePercentBps ?? DEFAULT_FEE_SETTINGS.cardFeePercentBps,
    cardFeeFixedCents:
      input.cardFeeFixedCents ?? existing?.cardFeeFixedCents ?? DEFAULT_FEE_SETTINGS.cardFeeFixedCents,
    achFeeCents: input.achFeeCents ?? existing?.achFeeCents ?? DEFAULT_FEE_SETTINGS.achFeeCents,
    updatedBy: updatedBy ?? existing?.updatedBy ?? null,
    updatedAt: new Date(),
  };

  if (existing) {
    const [updated] = await db
      .update(associationFeeSettings)
      .set(next)
      .where(eq(associationFeeSettings.id, existing.id))
      .returning();
    log(
      `[${AUDIT_SOURCE}] updated fee settings association=${associationId} cardFeeEnabled=${next.cardFeeEnabled === 1}`,
      AUDIT_SOURCE,
    );
    return updated;
  }

  const [inserted] = await db
    .insert(associationFeeSettings)
    .values({ associationId, ...next })
    .returning();
  log(
    `[${AUDIT_SOURCE}] created fee settings association=${associationId} cardFeeEnabled=${next.cardFeeEnabled === 1}`,
    AUDIT_SOURCE,
  );
  return inserted;
}

/**
 * Compute the card-processing convenience fee in cents for a given
 * assessment amount. Percentage + fixed — no artificial ceiling: per the
 * memo (§6.3) the fee is meant to track ACTUAL card-processing cost, and a
 * special assessment can legitimately run into the thousands where the real
 * Stripe cost is proportionally larger too (capping it would make the fee
 * NOT reflect actual cost, which is the opposite of the memo's guidance).
 *
 * Returns 0 for non-positive / non-finite inputs (degenerate guard).
 */
export function computeCardConvenienceFeeCents(
  assessmentCents: number,
  percentBps: number = DEFAULT_FEE_SETTINGS.cardFeePercentBps,
  fixedCents: number = DEFAULT_FEE_SETTINGS.cardFeeFixedCents,
): number {
  if (!Number.isFinite(assessmentCents) || assessmentCents <= 0) return 0;
  const bps = Number.isFinite(percentBps) && percentBps > 0 ? percentBps : 0;
  const fixed = Number.isFinite(fixedCents) && fixedCents > 0 ? fixedCents : 0;
  const percentPortion = Math.round((assessmentCents * bps) / 10000);
  return percentPortion + fixed;
}

/** Compute the ACH fee in cents (flat, per settings — 0 by default). */
export function computeAchFeeCents(achFeeCents: number = DEFAULT_FEE_SETTINGS.achFeeCents): number {
  if (!Number.isFinite(achFeeCents) || achFeeCents <= 0) return 0;
  return Math.round(achFeeCents);
}

/**
 * THE books-split invariant (memo §6): net the platform fee OUT of the
 * amount that gets credited to the association's owner ledger, so the
 * ledger shows the assessment AT FACE VALUE, never the fee-inclusive total.
 * Used by storage.ts processPaymentWebhookEvent to compute the ledger
 * credit from the raw Stripe `amount_total` (which — when a fee applies —
 * IS the fee-inclusive total) minus the fee carved out via
 * `metadata.platformFeeCents` (see server/routes.ts normalizeStripeWebhookPayload).
 *
 * Pure — no I/O, no clamping surprises: floors at 0 (a fee can never exceed
 * the total it was computed from in practice, but this guards the
 * degenerate case defensively rather than crediting a negative ledger row).
 */
export function netLedgerCreditDollars(
  totalAmountDollars: number,
  platformFeeCents: number | null | undefined,
): number {
  const feeDollars =
    typeof platformFeeCents === "number" && Number.isFinite(platformFeeCents) && platformFeeCents > 0
      ? Number((platformFeeCents / 100).toFixed(2))
      : 0;
  return Math.max(0, Number((totalAmountDollars - feeDollars).toFixed(2)));
}

/**
 * Resolve the fee (in cents) for a given association + checkout method +
 * assessment amount. Returns 0 when the method is 'ach' (unless the
 * association's achFeeCents > 0) or when card fees are disabled for the
 * association.
 */
export async function resolveCheckoutFeeCents(params: {
  associationId: string;
  assessmentCents: number;
  method: CheckoutMethod;
}): Promise<{ feeCents: number; settings: ResolvedFeeSettings }> {
  const settings = await getAssociationFeeSettings(params.associationId);
  if (params.method === "card") {
    if (!settings.cardFeeEnabled) return { feeCents: 0, settings };
    return {
      feeCents: computeCardConvenienceFeeCents(
        params.assessmentCents,
        settings.cardFeePercentBps,
        settings.cardFeeFixedCents,
      ),
      settings,
    };
  }
  return { feeCents: computeAchFeeCents(settings.achFeeCents), settings };
}

// ── Platform-revenue booking (idempotent) ───────────────────────────────────

export interface RecordPlatformProcessingFeeInput {
  associationId: string;
  paymentTransactionId?: string | null;
  unitId?: string | null;
  personId?: string | null;
  feeType?: "card_processing" | "ach";
  amountCents: number;
  currency?: string;
  /** Stripe payment_intent id — same cross-path identity as
   *  owner_ledger_entries.paymentIdentityKey. Idempotency key for this write. */
  stripePaymentIntentId?: string | null;
}

/**
 * Book a platform processing fee. Idempotent on `stripePaymentIntentId` via
 * the partial unique index (DB-enforced `ON CONFLICT DO NOTHING`, mirroring
 * server/services/ledger-payment-identity.ts's postPaymentLedgerEntry exactly)
 * — a duplicate webhook delivery for the same payment_intent is a safe no-op.
 * Never writes to owner_ledger_entries; this table is structurally separate
 * from the association's ledger.
 */
export async function recordPlatformProcessingFee(
  input: RecordPlatformProcessingFeeInput,
): Promise<{ created: boolean; fee: PlatformProcessingFee | null }> {
  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) {
    return { created: false, fee: null };
  }
  const piId = input.stripePaymentIntentId?.trim() || null;

  if (piId) {
    const [inserted] = await db
      .insert(platformProcessingFees)
      .values({
        associationId: input.associationId,
        paymentTransactionId: input.paymentTransactionId ?? null,
        unitId: input.unitId ?? null,
        personId: input.personId ?? null,
        feeType: input.feeType ?? "card_processing",
        amountCents: Math.round(input.amountCents),
        currency: input.currency ?? "USD",
        stripePaymentIntentId: piId,
      })
      .onConflictDoNothing({
        target: [platformProcessingFees.stripePaymentIntentId],
      })
      .returning();

    if (inserted) {
      log(
        `[${AUDIT_SOURCE}] booked platform fee id=${inserted.id} pi=${piId} amountCents=${inserted.amountCents}`,
        AUDIT_SOURCE,
      );
      return { created: true, fee: inserted };
    }

    const [existing] = await db
      .select()
      .from(platformProcessingFees)
      .where(eq(platformProcessingFees.stripePaymentIntentId, piId))
      .limit(1);
    log(`[${AUDIT_SOURCE}] skip platform fee — already booked pi=${piId}`, AUDIT_SOURCE);
    return { created: false, fee: existing ?? null };
  }

  // No payment_intent id available (shouldn't happen on the live Stripe
  // path, but guard defensively rather than throw) — write unconditionally,
  // no cross-path dedup possible without a key.
  const [inserted] = await db
    .insert(platformProcessingFees)
    .values({
      associationId: input.associationId,
      paymentTransactionId: input.paymentTransactionId ?? null,
      unitId: input.unitId ?? null,
      personId: input.personId ?? null,
      feeType: input.feeType ?? "card_processing",
      amountCents: Math.round(input.amountCents),
      currency: input.currency ?? "USD",
      stripePaymentIntentId: null,
    })
    .returning();
  return { created: true, fee: inserted };
}

/** Sum of platform processing fees booked for an association (admin reporting). */
export async function getPlatformFeeTotalsForAssociation(
  associationId: string,
): Promise<{ totalCents: number; count: number }> {
  const [row] = await db
    .select({
      totalCents: sql<number>`coalesce(sum(${platformProcessingFees.amountCents}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(platformProcessingFees)
    .where(eq(platformProcessingFees.associationId, associationId));
  return {
    totalCents: Number(row?.totalCents ?? 0),
    count: Number(row?.count ?? 0),
  };
}
