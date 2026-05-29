/**
 * Stripe Connect payout reconciliation + Gap C ledger-write service.
 *
 * Canonical spec: wiki/products/ycm/stripe-connect-spec.md
 *   §4   — Reconciliation flow (payout → HOA books)
 *   §7.3 — Dispatch #3 scope (this file)
 *   §3.1 — Charge metadata schema (read back here; written by #969)
 *
 * Two webhook-driven entry points, both idempotent:
 *
 *   1. `writeLedgerEntryForCharge` — Gap C fix. On `charge.succeeded` for a
 *      direct charge, write ONE `owner_ledger_entries` "payment" row
 *      immediately (don't wait for the daily payout). Keyed on
 *      (referenceType='stripe_charge', referenceId=charge_id) so webhook
 *      retries never double-write.
 *
 *   2. `reconcilePayout` — On `payout.paid`, load every charge in the batch,
 *      ensure each has its ledger entry (step 1 usually wrote it already),
 *      and persist the per-owner breakdown (`stripe_payout_items`) + the
 *      payout header (`stripe_payouts`) so the admin reconciliation report
 *      can render owner-by-owner totals matching the bank deposit exactly.
 *
 * The report query (`getReconciliationReport`) + AR-aging reconciliation
 * filter (`partitionLedgerEntryIdsByReconciliation`) read from these tables.
 */

import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  ownerLedgerEntries,
  stripePayouts,
  stripePayoutItems,
  type StripePayout,
  type StripePayoutItem,
} from "../../shared/schema";
import { log } from "../logger";
import {
  listPayoutBalanceTransactions,
  retrievePayout,
  getPlatformKeyMode,
  type StripeBalanceTransaction,
  type StripeChargeObject,
  type StripePayoutObject,
} from "./stripe-connect";

const AUDIT_SOURCE = "stripe-recon";
const CHARGE_REFERENCE_TYPE = "stripe_charge";

/**
 * Spec §3.1 metadata, resolved off a Stripe charge. `hoa_id` == associationId
 * and `owner_id` == personId in YCM's data model. Falls back to legacy
 * camelCase keys (the pre-#969 owner-payment-link metadata used
 * `associationId`/`personId`/`unitId`) so charges created before the metadata
 * refactor still reconcile.
 */
export interface ResolvedChargeMetadata {
  associationId: string | null;
  personId: string | null;
  unitId: string | null;
  ledgerEntryId: string | null;
  chargeType: string | null;
  ownerName: string | null;
  unitLabel: string | null;
}

function pick(meta: Record<string, string>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = meta[k];
    if (typeof v === "string" && v.trim().length > 0) return v;
  }
  return null;
}

/** Resolve spec §3.1 metadata (snake_case) with legacy camelCase fallback. */
export function extractChargeMetadata(
  metadata: Record<string, string> | null | undefined,
): ResolvedChargeMetadata {
  const meta = metadata ?? {};
  return {
    associationId: pick(meta, "hoa_id", "associationId"),
    personId: pick(meta, "owner_id", "personId"),
    unitId: pick(meta, "unit_id", "unitId"),
    ledgerEntryId: pick(meta, "ledger_entry_id", "ledgerEntryId"),
    chargeType: pick(meta, "charge_type", "chargeType"),
    ownerName: pick(meta, "owner_name", "ownerName"),
    unitLabel: pick(meta, "unit_label", "unitLabel"),
  };
}

export interface WriteLedgerEntryResult {
  created: boolean;
  ledgerEntryId: string | null;
  /** Reason a write was skipped (idempotent hit or missing metadata). */
  skipped?: "already_exists" | "missing_metadata" | "non_positive_amount";
}

export interface WriteLedgerEntryInput {
  chargeId: string;
  amountCents: number;
  metadata: Record<string, string> | null | undefined;
  /** Where this write originated, for the audit log. */
  source: "charge.succeeded" | "payout.paid" | "manual";
  description?: string | null;
  postedAt?: Date;
}

/**
 * Idempotently write an `owner_ledger_entries` "payment" row for a succeeded
 * Stripe charge (Gap C fix). Payments are stored as NEGATIVE amounts (they
 * reduce the owner's outstanding balance), mirroring the existing autopay
 * ledger-write at server/routes.ts. Idempotency key:
 * (referenceType='stripe_charge', referenceId=chargeId).
 *
 * Per spec scope: "every webhook-driven ledger write logs source +
 * idempotency key + timestamp".
 */
export async function writeLedgerEntryForCharge(
  input: WriteLedgerEntryInput,
): Promise<WriteLedgerEntryResult> {
  const meta = extractChargeMetadata(input.metadata);
  const idempotencyKey = `${CHARGE_REFERENCE_TYPE}:${input.chargeId}`;

  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) {
    log(`[${input.source}] skip ledger write (non-positive amount) key=${idempotencyKey}`, AUDIT_SOURCE);
    return { created: false, ledgerEntryId: null, skipped: "non_positive_amount" };
  }

  if (!meta.associationId || !meta.unitId || !meta.personId) {
    // Cannot write a ledger entry without the FK references. Legacy / non-YCM
    // charges land here; surfaced in the audit log for follow-up.
    log(
      `[${input.source}] skip ledger write (missing metadata assoc=${meta.associationId} unit=${meta.unitId} owner=${meta.personId}) key=${idempotencyKey}`,
      AUDIT_SOURCE,
    );
    return { created: false, ledgerEntryId: null, skipped: "missing_metadata" };
  }

  // Idempotency: a prior charge.succeeded (or payout.paid) may have written it.
  const existing = await db
    .select({ id: ownerLedgerEntries.id })
    .from(ownerLedgerEntries)
    .where(
      and(
        eq(ownerLedgerEntries.referenceType, CHARGE_REFERENCE_TYPE),
        eq(ownerLedgerEntries.referenceId, input.chargeId),
      ),
    )
    .limit(1);
  if (existing[0]) {
    log(`[${input.source}] ledger entry already exists key=${idempotencyKey} id=${existing[0].id}`, AUDIT_SOURCE);
    return { created: false, ledgerEntryId: existing[0].id, skipped: "already_exists" };
  }

  const [created] = await db
    .insert(ownerLedgerEntries)
    .values({
      associationId: meta.associationId,
      unitId: meta.unitId,
      personId: meta.personId,
      entryType: "payment",
      amount: -(input.amountCents / 100),
      postedAt: input.postedAt ?? new Date(),
      description: input.description?.trim() || "Stripe payment",
      referenceType: CHARGE_REFERENCE_TYPE,
      referenceId: input.chargeId,
    })
    .returning({ id: ownerLedgerEntries.id });

  log(
    `[${input.source}] wrote ledger entry id=${created.id} key=${idempotencyKey} amount=${-(input.amountCents / 100)} at=${new Date().toISOString()}`,
    AUDIT_SOURCE,
  );
  return { created: true, ledgerEntryId: created.id, skipped: undefined };
}

export interface ReconcilePayoutInput {
  connectedAccountId: string;
  payoutId: string;
  /** Association that owns the connected account. */
  associationId: string;
  /** Optional already-fetched payout object (from the webhook event body). */
  payout?: StripePayoutObject | null;
}

export interface ReconcilePayoutResult {
  payoutReconId: string;
  payoutId: string;
  status: string;
  chargeCount: number;
  grossAmountCents: number;
  feeAmountCents: number;
  netAmountCents: number;
  /** payout.amount (what hits the bank) minus computed net — should be 0. */
  varianceCents: number;
  ledgerEntriesCreated: number;
}

function chargeFromSource(source: StripeBalanceTransaction["source"]): StripeChargeObject | null {
  if (source && typeof source === "object") return source as StripeChargeObject;
  return null;
}

export interface PayoutTransactionSummary {
  /** Sum of charge gross (cents). Refunds reduce this. */
  grossAmountCents: number;
  /** Stripe processing + YCM application fees + adjustment fees (cents). */
  feeAmountCents: number;
  /** grossAmountCents - feeAmountCents — should equal the payout's net amount. */
  netAmountCents: number;
  /** Number of charge/payment transactions in the batch. */
  chargeCount: number;
}

/**
 * Pure reconciliation math (spec §4.1). Given every balance transaction in a
 * payout, compute the gross/fee/net totals so the report can prove
 * `net == payout.amount == bank deposit` (zero variance). Extracted as a pure
 * function so the money math is unit-testable without any Stripe/DB I/O.
 *
 * Convention: each balance transaction's `amount` is its gross contribution to
 * the connected account's balance (negative for refunds), `fee` is the Stripe +
 * application fee, and `net = amount - fee`. Summing every transaction's net is
 * exactly the payout amount, so `gross(all) - fee(all) == net == payout`.
 */
export function summarizePayoutTransactions(
  txns: StripeBalanceTransaction[],
): PayoutTransactionSummary {
  let grossAmountCents = 0;
  let feeAmountCents = 0;
  let chargeCount = 0;
  for (const txn of txns) {
    // The payout transaction itself is the negative mirror of the deposit and
    // is excluded — it is the deposit, not a line within it.
    if (txn.type === "payout") continue;
    grossAmountCents += txn.amount;
    feeAmountCents += txn.fee;
    if (txn.type === "charge" || txn.type === "payment") chargeCount += 1;
  }
  return {
    grossAmountCents,
    feeAmountCents,
    netAmountCents: grossAmountCents - feeAmountCents,
    chargeCount,
  };
}

/**
 * Reconcile a paid Stripe payout into per-owner ledger entries + the
 * `stripe_payouts` / `stripe_payout_items` breakdown. Idempotent: re-running
 * for the same payout upserts the header and per-charge items rather than
 * duplicating. Per spec §4.1.
 */
export async function reconcilePayout(input: ReconcilePayoutInput): Promise<ReconcilePayoutResult> {
  const { connectedAccountId, payoutId, associationId } = input;
  const keyMode = await getPlatformKeyMode();

  // 1. Resolve the payout object (use the webhook payload if provided).
  const payout: StripePayoutObject =
    input.payout ?? (await retrievePayout(connectedAccountId, payoutId));

  // 2. Load every balance transaction in the batch (charges + fees + refunds).
  const txns = await listPayoutBalanceTransactions(connectedAccountId, payoutId);

  // Pure money math (spec §4.1) — header totals tie out to the bank deposit.
  const summary = summarizePayoutTransactions(txns);
  let ledgerEntriesCreated = 0;

  // 3. Upsert the payout header first so item rows have a parent FK.
  const arrivalDate =
    typeof payout.arrival_date === "number" ? new Date(payout.arrival_date * 1000) : null;
  const headerId = await upsertPayoutHeader({
    associationId,
    connectedAccountId,
    payoutId,
    keyMode,
    status: (payout.status as StripePayout["status"]) ?? "paid",
    amountCents: payout.amount ?? 0,
    currency: payout.currency ?? "usd",
    arrivalDate,
    rawPayloadJson: payout as unknown as Record<string, unknown>,
  });

  // 4. Walk each charge-type transaction → ensure ledger entry + payout item.
  const chargeTxns = txns.filter((t) => t.type === "charge" || t.type === "payment");
  for (const txn of chargeTxns) {
    const charge = chargeFromSource(txn.source);
    const chargeId =
      charge?.id ?? (typeof txn.source === "string" ? txn.source : txn.id);
    const meta = extractChargeMetadata(charge?.metadata);

    // Gap C / belt-and-suspenders: ensure the ledger entry exists. Usually
    // charge.succeeded already wrote it; this is idempotent.
    const ledgerResult = await writeLedgerEntryForCharge({
      chargeId,
      amountCents: txn.amount,
      metadata: charge?.metadata,
      source: "payout.paid",
      description: "Stripe payment (payout-reconciled)",
    });
    if (ledgerResult.created) ledgerEntriesCreated += 1;

    await upsertPayoutItem({
      payoutReconId: headerId,
      associationId,
      chargeId,
      paymentIntentId: charge?.payment_intent ?? null,
      ownerLedgerEntryId: ledgerResult.ledgerEntryId,
      ownerId: meta.personId,
      unitId: meta.unitId,
      ownerName: meta.ownerName ?? charge?.billing_details?.name ?? null,
      unitLabel: meta.unitLabel,
      chargeType: meta.chargeType,
      grossAmountCents: txn.amount,
      feeAmountCents: txn.fee,
      netAmountCents: txn.net,
    });
  }

  // 5. Header totals come from the pure summary over ALL transactions (charges,
  //    refunds, adjustments) so gross - fee == net == bank deposit (spec §4.1).
  const { grossAmountCents, feeAmountCents, netAmountCents } = summary;
  const varianceCents = (payout.amount ?? 0) - netAmountCents;

  // 6. Finalize header totals + mark reconciled.
  await db
    .update(stripePayouts)
    .set({
      grossAmountCents,
      feeAmountCents,
      chargeCount: chargeTxns.length,
      reconciledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(stripePayouts.id, headerId));

  log(
    `[payout.paid] reconciled payout=${payoutId} acct=${connectedAccountId} charges=${chargeTxns.length} gross=${grossAmountCents} fee=${feeAmountCents} net=${netAmountCents} payout=${payout.amount} variance=${varianceCents} ledgerCreated=${ledgerEntriesCreated} at=${new Date().toISOString()}`,
    AUDIT_SOURCE,
  );

  return {
    payoutReconId: headerId,
    payoutId,
    status: (payout.status as string) ?? "paid",
    chargeCount: chargeTxns.length,
    grossAmountCents,
    feeAmountCents,
    netAmountCents,
    varianceCents,
    ledgerEntriesCreated,
  };
}

// ── Persistence helpers (idempotent upserts) ─────────────────────────────────

async function upsertPayoutHeader(input: {
  associationId: string;
  connectedAccountId: string;
  payoutId: string;
  keyMode: string;
  status: StripePayout["status"];
  amountCents: number;
  currency: string;
  arrivalDate: Date | null;
  rawPayloadJson: Record<string, unknown>;
}): Promise<string> {
  const existing = await db
    .select({ id: stripePayouts.id })
    .from(stripePayouts)
    .where(
      and(
        eq(stripePayouts.connectedAccountId, input.connectedAccountId),
        eq(stripePayouts.payoutId, input.payoutId),
      ),
    )
    .limit(1);
  if (existing[0]) {
    await db
      .update(stripePayouts)
      .set({
        status: input.status,
        amountCents: input.amountCents,
        currency: input.currency,
        keyMode: input.keyMode,
        arrivalDate: input.arrivalDate,
        rawPayloadJson: input.rawPayloadJson,
        updatedAt: new Date(),
      })
      .where(eq(stripePayouts.id, existing[0].id));
    return existing[0].id;
  }
  const [created] = await db
    .insert(stripePayouts)
    .values({
      associationId: input.associationId,
      connectedAccountId: input.connectedAccountId,
      payoutId: input.payoutId,
      keyMode: input.keyMode,
      status: input.status,
      amountCents: input.amountCents,
      currency: input.currency,
      arrivalDate: input.arrivalDate,
      rawPayloadJson: input.rawPayloadJson,
    })
    .returning({ id: stripePayouts.id });
  return created.id;
}

async function upsertPayoutItem(input: {
  payoutReconId: string;
  associationId: string;
  chargeId: string;
  paymentIntentId: string | null;
  ownerLedgerEntryId: string | null;
  ownerId: string | null;
  unitId: string | null;
  ownerName: string | null;
  unitLabel: string | null;
  chargeType: string | null;
  grossAmountCents: number;
  feeAmountCents: number;
  netAmountCents: number;
}): Promise<void> {
  const existing = await db
    .select({ id: stripePayoutItems.id })
    .from(stripePayoutItems)
    .where(
      and(
        eq(stripePayoutItems.payoutReconId, input.payoutReconId),
        eq(stripePayoutItems.chargeId, input.chargeId),
      ),
    )
    .limit(1);
  if (existing[0]) {
    await db
      .update(stripePayoutItems)
      .set({
        paymentIntentId: input.paymentIntentId,
        ownerLedgerEntryId: input.ownerLedgerEntryId,
        ownerId: input.ownerId,
        unitId: input.unitId,
        ownerName: input.ownerName,
        unitLabel: input.unitLabel,
        chargeType: input.chargeType,
        grossAmountCents: input.grossAmountCents,
        feeAmountCents: input.feeAmountCents,
        netAmountCents: input.netAmountCents,
      })
      .where(eq(stripePayoutItems.id, existing[0].id));
    return;
  }
  await db.insert(stripePayoutItems).values({
    payoutReconId: input.payoutReconId,
    associationId: input.associationId,
    chargeId: input.chargeId,
    paymentIntentId: input.paymentIntentId,
    ownerLedgerEntryId: input.ownerLedgerEntryId,
    ownerId: input.ownerId,
    unitId: input.unitId,
    ownerName: input.ownerName,
    unitLabel: input.unitLabel,
    chargeType: input.chargeType,
    grossAmountCents: input.grossAmountCents,
    feeAmountCents: input.feeAmountCents,
    netAmountCents: input.netAmountCents,
  });
}

// ── Reconciliation report (admin) ────────────────────────────────────────────

export interface ReconciliationReportOwnerRow {
  ownerId: string | null;
  ownerName: string | null;
  unitLabel: string | null;
  chargeType: string | null;
  chargeId: string;
  grossAmountCents: number;
  feeAmountCents: number;
  netAmountCents: number;
  ledgerEntryId: string | null;
  reconciled: boolean;
}

export interface ReconciliationReportPayout {
  id: string;
  payoutId: string;
  associationId: string;
  connectedAccountId: string | null;
  keyMode: string | null;
  status: string;
  currency: string;
  /** NET payout amount that hit the bank (cents). */
  payoutAmountCents: number;
  grossAmountCents: number;
  feeAmountCents: number;
  /** Sum of per-owner net (cents). Should equal payoutAmountCents (zero variance). */
  reconciledNetCents: number;
  /** payoutAmountCents - reconciledNetCents. 0 == perfectly reconciled. */
  varianceCents: number;
  chargeCount: number;
  arrivalDate: string | null;
  reconciledAt: string | null;
  owners: ReconciliationReportOwnerRow[];
}

/**
 * Build the admin reconciliation report: payouts (newest first), each expanded
 * to its per-owner breakdown. `reconciledNetCents` summing to
 * `payoutAmountCents` (varianceCents == 0) is the spec §4.1 "matches the bank
 * deposit exactly" guarantee, surfaced for the operator to verify at a glance.
 */
export async function getReconciliationReport(
  associationId?: string | null,
): Promise<ReconciliationReportPayout[]> {
  const headers: StripePayout[] = await db
    .select()
    .from(stripePayouts)
    .where(associationId ? eq(stripePayouts.associationId, associationId) : undefined)
    .orderBy(desc(stripePayouts.arrivalDate), desc(stripePayouts.createdAt));

  if (headers.length === 0) return [];

  const payoutIds = headers.map((h) => h.id);
  const items: StripePayoutItem[] = await db
    .select()
    .from(stripePayoutItems)
    .where(inArray(stripePayoutItems.payoutReconId, payoutIds));

  const itemsByPayout = new Map<string, StripePayoutItem[]>();
  for (const item of items) {
    const list = itemsByPayout.get(item.payoutReconId) ?? [];
    list.push(item);
    itemsByPayout.set(item.payoutReconId, list);
  }

  return headers.map((h) => {
    const own = itemsByPayout.get(h.id) ?? [];
    const reconciledNetCents = own.reduce((sum, i) => sum + i.netAmountCents, 0);
    return {
      id: h.id,
      payoutId: h.payoutId,
      associationId: h.associationId,
      connectedAccountId: h.connectedAccountId,
      keyMode: h.keyMode,
      status: h.status,
      currency: h.currency,
      payoutAmountCents: h.amountCents,
      grossAmountCents: h.grossAmountCents,
      feeAmountCents: h.feeAmountCents,
      reconciledNetCents,
      varianceCents: h.amountCents - reconciledNetCents,
      chargeCount: h.chargeCount,
      arrivalDate: h.arrivalDate ? h.arrivalDate.toISOString() : null,
      reconciledAt: h.reconciledAt ? h.reconciledAt.toISOString() : null,
      owners: own
        .map((i) => ({
          ownerId: i.ownerId,
          ownerName: i.ownerName,
          unitLabel: i.unitLabel,
          chargeType: i.chargeType,
          chargeId: i.chargeId,
          grossAmountCents: i.grossAmountCents,
          feeAmountCents: i.feeAmountCents,
          netAmountCents: i.netAmountCents,
          ledgerEntryId: i.ownerLedgerEntryId,
          reconciled: Boolean(i.ownerLedgerEntryId),
        }))
        .sort((a, b) => b.grossAmountCents - a.grossAmountCents),
    };
  });
}

/**
 * AR-aging reconciled/unreconciled filter support. Given a set of ledger entry
 * IDs, returns which are reconciled (appear in a paid payout's item rows) vs
 * not. A Stripe-charge payment entry is "unreconciled" when the charge has
 * succeeded (Gap C entry written) but the daily payout hasn't landed yet.
 */
export async function partitionLedgerEntryIdsByReconciliation(
  ledgerEntryIds: string[],
): Promise<{ reconciled: Set<string>; unreconciled: Set<string> }> {
  const reconciled = new Set<string>();
  if (ledgerEntryIds.length > 0) {
    const rows = await db
      .select({ id: stripePayoutItems.ownerLedgerEntryId })
      .from(stripePayoutItems)
      .where(inArray(stripePayoutItems.ownerLedgerEntryId, ledgerEntryIds));
    for (const r of rows) if (r.id) reconciled.add(r.id);
  }
  const unreconciled = new Set(ledgerEntryIds.filter((id) => !reconciled.has(id)));
  return { reconciled, unreconciled };
}
