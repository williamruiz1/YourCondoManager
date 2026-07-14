/**
 * CT-legal fee structure — settings + fee math + platform-revenue booking.
 *
 * Design of record: founder-os wiki/research/chc-processing-fee-legality-2026-07-14.md
 * §6 (the recommended structure) + William's 2026-07-14 voice extensions
 * (cash/check manual-processing fee; ship live, no attorney gate). The full
 * fee matrix this module implements:
 *
 *   CARD  → convenience fee, ~2.9% + $0.30 (Stripe's real card cost, memo §6.3)
 *   CASH/CHECK → flat manual-processing fee (treasurer's manual handling work
 *                is a real platform cost — William's policy, 2026-07-14)
 *   ACH   → free by default (the steering incentive, memo §6.4)
 *
 * Every fee is charged AND KEPT BY THE PLATFORM — never set, collected, or
 * received by the association. The association's ledger shows dues/assessments
 * at face value; every fee books here, to `platform_processing_fees`, and
 * NEVER to `owner_ledger_entries`. Feature-flagged PER ASSOCIATION, default
 * OFF — while off, every read in this module returns "disabled" and no
 * caller may add a fee.
 *
 * STRIPE TOPOLOGY (corrected 2026-07-14 — the original design here was
 * WRONG, verified live against production): Cherry Hill Court Condominiums
 * has an ACTIVE Stripe Connect sub-merchant (payment_gateway_connections
 * .provider_account_id = acct_1TnzDnArorHrelxs, status active) — NOT a
 * single shared platform Stripe account. For a Connect-routed association,
 * the fee's REAL money movement happens via Stripe's own
 * `application_fee_amount` (server/routes/payment-portal.ts adds the fee on
 * top of the existing base application fee) — Stripe itself transfers the
 * fee to YCM's platform balance while the assessment settles to the
 * association's own connected account/bank. `platform_processing_fees`
 * remains the canonical RECORD of the fee either way; `settlementMethod` on
 * each row records which mechanism actually moved (or didn't move) the
 * money: 'connect_application_fee' (Stripe-transferred, Connect-active) or
 * 'accounting_only' (single-account/manual-key association, or a
 * manual-processing fee, which never touches Stripe — bookkeeping is the
 * only separation there is until it's collected).
 */

import { and, eq, sql } from "drizzle-orm";
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
export type PlatformFeeType = "card_processing" | "ach" | "manual_processing";
export type PlatformFeeStatus = "owed" | "collected";
export type SettlementMethod = "connect_application_fee" | "accounting_only";

export interface ResolvedFeeSettings {
  cardFeeEnabled: boolean;
  cardFeePercentBps: number;
  cardFeeFixedCents: number;
  achFeeCents: number;
  manualFeeEnabled: boolean;
  manualFeeCents: number;
}

/** Defaults applied when an association has no row yet — every fee OFF. */
export const DEFAULT_FEE_SETTINGS: ResolvedFeeSettings = {
  cardFeeEnabled: false,
  cardFeePercentBps: 290,
  cardFeeFixedCents: 30,
  achFeeCents: 0,
  manualFeeEnabled: false,
  manualFeeCents: 500,
};

/**
 * Read an association's fee settings. No row yet → DEFAULT_FEE_SETTINGS
 * (every fee OFF) — this is what makes the feature inert for every
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
    manualFeeEnabled: row.manualFeeEnabled === 1,
    manualFeeCents: row.manualFeeCents,
  };
}

/**
 * Upsert an association's fee settings (admin-only — see
 * server/routes/admin-payments.ts PATCH /api/admin/associations/:id/fee-settings).
 * This is the "one-command enable" the dark-ship depends on: flipping
 * `cardFeeEnabled` / `manualFeeEnabled` to true is the ONLY thing that turns
 * that fee on for that association, and it stays reversible (flip back to
 * false = instantly back to the byte-identical no-fee behavior).
 */
export async function setAssociationFeeSettings(
  associationId: string,
  input: Partial<{
    cardFeeEnabled: boolean;
    cardFeePercentBps: number;
    cardFeeFixedCents: number;
    achFeeCents: number;
    manualFeeEnabled: boolean;
    manualFeeCents: number;
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
    manualFeeEnabled:
      input.manualFeeEnabled !== undefined
        ? (input.manualFeeEnabled ? 1 : 0)
        : existing?.manualFeeEnabled ?? DEFAULT_FEE_SETTINGS.manualFeeEnabled
          ? 1
          : 0,
    manualFeeCents: input.manualFeeCents ?? existing?.manualFeeCents ?? DEFAULT_FEE_SETTINGS.manualFeeCents,
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
      `[${AUDIT_SOURCE}] updated fee settings association=${associationId} cardFeeEnabled=${next.cardFeeEnabled === 1} manualFeeEnabled=${next.manualFeeEnabled === 1}`,
      AUDIT_SOURCE,
    );
    return updated;
  }

  const [inserted] = await db
    .insert(associationFeeSettings)
    .values({ associationId, ...next })
    .returning();
  log(
    `[${AUDIT_SOURCE}] created fee settings association=${associationId} cardFeeEnabled=${next.cardFeeEnabled === 1} manualFeeEnabled=${next.manualFeeEnabled === 1}`,
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
 * Compute the manual cash/check processing fee in cents. Flat, not
 * percentage-based — there is no Stripe cost driver for a cash/check
 * payment; the cost is the treasurer's manual handling time, which doesn't
 * scale with the payment amount. William's policy (2026-07-14): this fee IS
 * charged, same separation principle as the card fee (owed to the platform,
 * never the association).
 */
export function computeManualProcessingFeeCents(
  manualFeeCents: number = DEFAULT_FEE_SETTINGS.manualFeeCents,
): number {
  if (!Number.isFinite(manualFeeCents) || manualFeeCents <= 0) return 0;
  return Math.round(manualFeeCents);
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
  feeType?: PlatformFeeType;
  amountCents: number;
  currency?: string;
  /**
   * THE dedup key (replaces stripePaymentIntentId as the ON CONFLICT
   * target). Card fees: pass the Stripe payment_intent id (same value
   * ledger-payment-identity.ts uses) — a duplicate webhook delivery is a
   * safe no-op. Manual fees: pass `manual:<ownerLedgerEntries.id>` — one
   * manual fee per manually-recorded cash/check ledger entry, so a retry of
   * the SAME recording call can never double-book.
   */
  idempotencyKey?: string | null;
  /** Back-compat convenience — when set and idempotencyKey is omitted, used
   *  as idempotencyKey AND mirrored into the stripePaymentIntentId column. */
  stripePaymentIntentId?: string | null;
  /** 'owed' (not yet collected — the cash/check case) or 'collected'
   *  (money already moved — the card case, default). */
  status?: PlatformFeeStatus;
  /** How the money actually moved. Default 'accounting_only'. Pass
   *  'connect_application_fee' when the fee routed via Stripe Connect's
   *  application_fee_amount (see server/routes/payment-portal.ts). */
  settlementMethod?: SettlementMethod;
}

/**
 * Book a platform processing fee. Idempotent on `idempotencyKey` via the
 * partial unique index (DB-enforced `ON CONFLICT DO NOTHING`, mirroring
 * server/services/ledger-payment-identity.ts's postPaymentLedgerEntry
 * exactly) — a duplicate webhook delivery (card) or a duplicate recording
 * call (manual) for the SAME key is a safe no-op. Never writes to
 * owner_ledger_entries; this table is structurally separate from the
 * association's ledger.
 */
export async function recordPlatformProcessingFee(
  input: RecordPlatformProcessingFeeInput,
): Promise<{ created: boolean; fee: PlatformProcessingFee | null }> {
  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) {
    return { created: false, fee: null };
  }
  const stripePiId = input.stripePaymentIntentId?.trim() || null;
  const key = input.idempotencyKey?.trim() || stripePiId || null;
  const status: PlatformFeeStatus = input.status ?? "collected";
  const settlementMethod: SettlementMethod = input.settlementMethod ?? "accounting_only";

  const baseValues = {
    associationId: input.associationId,
    paymentTransactionId: input.paymentTransactionId ?? null,
    unitId: input.unitId ?? null,
    personId: input.personId ?? null,
    feeType: input.feeType ?? "card_processing",
    amountCents: Math.round(input.amountCents),
    currency: input.currency ?? "USD",
    status,
    collectedAt: status === "collected" ? new Date() : null,
    settlementMethod,
    stripePaymentIntentId: stripePiId,
  };

  if (key) {
    const [inserted] = await db
      .insert(platformProcessingFees)
      .values({ ...baseValues, idempotencyKey: key })
      .onConflictDoNothing({
        target: [platformProcessingFees.idempotencyKey],
      })
      .returning();

    if (inserted) {
      log(
        `[${AUDIT_SOURCE}] booked platform fee id=${inserted.id} key=${key} type=${inserted.feeType} status=${inserted.status} amountCents=${inserted.amountCents}`,
        AUDIT_SOURCE,
      );
      return { created: true, fee: inserted };
    }

    const [existing] = await db
      .select()
      .from(platformProcessingFees)
      .where(eq(platformProcessingFees.idempotencyKey, key))
      .limit(1);
    log(`[${AUDIT_SOURCE}] skip platform fee — already booked key=${key}`, AUDIT_SOURCE);
    return { created: false, fee: existing ?? null };
  }

  // No idempotency key available (shouldn't happen on any live path, but
  // guard defensively rather than throw) — write unconditionally, no
  // cross-path dedup possible without a key.
  const [inserted] = await db
    .insert(platformProcessingFees)
    .values({ ...baseValues, idempotencyKey: null })
    .returning();
  return { created: true, fee: inserted };
}

/**
 * Mark an 'owed' platform fee as collected (e.g. the treasurer collects a
 * manual-processing fee with the owner's next payment, or the owner pays it
 * directly). Admin-gated — see server/routes/admin-payments.ts
 * POST /api/admin/platform-fees/:id/collect. Idempotent: collecting an
 * already-collected fee is a no-op (returns the existing row unchanged).
 */
export async function markPlatformFeeCollected(
  feeId: string,
): Promise<PlatformProcessingFee | null> {
  const [existing] = await db
    .select()
    .from(platformProcessingFees)
    .where(eq(platformProcessingFees.id, feeId))
    .limit(1);
  if (!existing) return null;
  if (existing.status === "collected") return existing;

  const [updated] = await db
    .update(platformProcessingFees)
    .set({ status: "collected", collectedAt: new Date() })
    .where(eq(platformProcessingFees.id, feeId))
    .returning();
  log(`[${AUDIT_SOURCE}] collected platform fee id=${feeId}`, AUDIT_SOURCE);
  return updated ?? existing;
}

/**
 * List a person's OWED (not yet collected) platform fees for an association
 * — the "you owe the platform $X, not yet collected" view (memo extension
 * §cash/check: "collected with their next payment or payable directly").
 * Used by both the admin surface and the owner-portal read-only view.
 */
export async function listOwedPlatformFees(params: {
  associationId: string;
  personId?: string | null;
}): Promise<PlatformProcessingFee[]> {
  const conditions = [
    eq(platformProcessingFees.associationId, params.associationId),
    eq(platformProcessingFees.status, "owed"),
  ];
  if (params.personId) conditions.push(eq(platformProcessingFees.personId, params.personId));
  return db
    .select()
    .from(platformProcessingFees)
    .where(and(...conditions));
}

/** Sum of platform processing fees booked for an association (admin reporting). */
export async function getPlatformFeeTotalsForAssociation(
  associationId: string,
): Promise<{ totalCents: number; count: number; owedCents: number }> {
  const [row] = await db
    .select({
      totalCents: sql<number>`coalesce(sum(${platformProcessingFees.amountCents}), 0)`,
      count: sql<number>`count(*)`,
      owedCents: sql<number>`coalesce(sum(${platformProcessingFees.amountCents}) filter (where ${platformProcessingFees.status} = 'owed'), 0)`,
    })
    .from(platformProcessingFees)
    .where(eq(platformProcessingFees.associationId, associationId));
  return {
    totalCents: Number(row?.totalCents ?? 0),
    count: Number(row?.count ?? 0),
    owedCents: Number(row?.owedCents ?? 0),
  };
}
