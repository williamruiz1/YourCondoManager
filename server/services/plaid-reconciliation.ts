/**
 * Plaid bank-tx ↔ owner-ledger reconciliation (Issue #448).
 *
 * Bridges PR #112's two-tab gap: synced bank transactions land in
 * `bank_transactions`; pending owner Pay-Now intents land in
 * `owner_ledger_entries` with `referenceType='plaid-pay-intent'`. Until this
 * service runs, admins see them in parallel with no link.
 *
 * Auto-match criteria (all required):
 *   1. tenant: same `association_id` (hard tenant-isolation; no cross-tenant match)
 *   2. amount: |bankTx.amountCents/100| === |ledgerEntry.amount| (cents-exact)
 *   3. date  : |bankTx.date - ledgerEntry.createdAt| <= 3 days
 *   4. signs : bankTx is a CREDIT (money IN; amountCents < 0 per Plaid convention
 *              normalized in plaid-provider.ts §"positive = debit; negative = credit")
 *
 * Eligibility: only `referenceType='plaid-pay-intent'` ledger entries with
 * `settledAt IS NULL` AND `bank_transactions.reconciled_to_payment_transaction_id
 * IS NULL` are matched (so we don't collide with the existing
 * paymentTransactions reconciliation pipeline).
 *
 * Idempotency: re-running on already-settled entries is a no-op (the
 * `isNull(settledAt)` filter excludes them on subsequent passes).
 *
 * Strategy: greedy single-pass — for each unmatched credit, take the first
 * eligible pending entry (smallest `|dateDelta|`, breaking ties by `createdAt`).
 * If no exact match: the credit is left untouched and surfaced as "pending
 * reconciliation" in the admin UI for manual matching.
 */
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import {
  bankTransactions,
  ownerLedgerEntries,
  type BankTransaction,
} from "@shared/schema";

const MATCH_DATE_WINDOW_DAYS = 3;

export type ReconciliationOutcome = {
  bankTransactionId: string;
  ledgerEntryId: string;
  amountCents: number;
  dateDeltaDays: number;
};

export type ReconciliationResult = {
  matched: ReconciliationOutcome[];
  unmatchedCreditIds: string[];
  unmatchedLedgerEntryIds: string[];
};

function diffDays(a: Date, b: Date): number {
  const ms = Math.abs(a.getTime() - b.getTime());
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function isCredit(tx: Pick<BankTransaction, "amountCents">): boolean {
  // Plaid convention (normalized in plaid-provider.ts): positive = debit (out),
  // negative = credit (in). Owner payments to the HOA account arrive as credits.
  return tx.amountCents < 0;
}

/**
 * Walk unmatched bank credits + pending pay-intent ledger entries for an
 * association, auto-match where deterministic, and return the audit trail.
 */
export async function reconcileBankTransactions(
  associationId: string,
): Promise<ReconciliationResult> {
  // 1. Pull eligible bank credits (not yet linked to any payment_transaction)
  //    scoped to this association only — tenant isolation enforced at query.
  const unmatchedCredits = await db
    .select()
    .from(bankTransactions)
    .where(
      and(
        eq(bankTransactions.associationId, associationId),
        isNull(bankTransactions.reconciledToPaymentTransactionId),
      ),
    )
    .orderBy(asc(bankTransactions.date));

  // 2. Pull eligible pending ledger entries (plaid-pay-intent reference type,
  //    not yet settled, this association only).
  const pendingEntries = await db
    .select()
    .from(ownerLedgerEntries)
    .where(
      and(
        eq(ownerLedgerEntries.associationId, associationId),
        eq(ownerLedgerEntries.referenceType, "plaid-pay-intent"),
        isNull(ownerLedgerEntries.settledAt),
        isNull(ownerLedgerEntries.bankTransactionId),
      ),
    )
    .orderBy(asc(ownerLedgerEntries.createdAt));

  const matched: ReconciliationOutcome[] = [];
  const usedEntryIds = new Set<string>();
  const matchedCreditIds = new Set<string>();

  // 3. Greedy match: for each credit, find best-fitting pending entry by
  //    smallest |dateDelta| (cap at MATCH_DATE_WINDOW_DAYS).
  for (const credit of unmatchedCredits) {
    if (!isCredit(credit)) continue;
    const creditAbsCents = Math.abs(credit.amountCents);
    const creditDate = new Date(credit.date);

    let bestEntryIdx = -1;
    let bestDelta = MATCH_DATE_WINDOW_DAYS + 1;

    for (let i = 0; i < pendingEntries.length; i++) {
      const entry = pendingEntries[i];
      if (usedEntryIds.has(entry.id)) continue;

      const entryAbsCents = Math.round(Math.abs(entry.amount) * 100);
      if (entryAbsCents !== creditAbsCents) continue;

      const referenceDate = entry.createdAt ?? entry.postedAt;
      const delta = diffDays(creditDate, referenceDate);
      if (delta > MATCH_DATE_WINDOW_DAYS) continue;

      if (delta < bestDelta) {
        bestDelta = delta;
        bestEntryIdx = i;
      }
    }

    if (bestEntryIdx === -1) continue;

    const winner = pendingEntries[bestEntryIdx];
    await applyMatch({
      ledgerEntryId: winner.id,
      bankTransactionId: credit.id,
      associationId,
    });

    usedEntryIds.add(winner.id);
    matchedCreditIds.add(credit.id);
    matched.push({
      bankTransactionId: credit.id,
      ledgerEntryId: winner.id,
      amountCents: creditAbsCents,
      dateDeltaDays: bestDelta,
    });
  }

  return {
    matched,
    unmatchedCreditIds: unmatchedCredits
      .filter((c) => isCredit(c) && !matchedCreditIds.has(c.id))
      .map((c) => c.id),
    unmatchedLedgerEntryIds: pendingEntries
      .filter((e) => !usedEntryIds.has(e.id))
      .map((e) => e.id),
  };
}

/**
 * Apply a single match atomically. Used by both the auto-matcher and the
 * manual-match admin endpoint. Tenant-scoped via the associationId filter on
 * every leg.
 */
async function applyMatch(input: {
  ledgerEntryId: string;
  bankTransactionId: string;
  associationId: string;
}): Promise<void> {
  const now = new Date();
  // A-RECON-004 (founder-os#10753): write BOTH sides of the match in ONE
  // transaction — the ledger link AND the bank credit marked CONSUMED. The
  // candidate query filters `isNull(bankTransactions.reconciledToPaymentTransactionId)`,
  // so before this the credit stayed "unmatched" in the matcher's own input and
  // could settle a SECOND same-amount ledger entry on a later sync run (one real
  // deposit → two settlements). Setting `reconciledToPaymentTransactionId` excludes
  // the credit from future runs; the transaction makes both writes commit-or-rollback
  // together so a partial (ledger linked but credit still matchable) can't occur.
  await db.transaction(async (tx) => {
    await tx
      .update(ownerLedgerEntries)
      .set({
        bankTransactionId: input.bankTransactionId,
        settledAt: now,
      })
      .where(
        and(
          eq(ownerLedgerEntries.id, input.ledgerEntryId),
          eq(ownerLedgerEntries.associationId, input.associationId),
        ),
      );
    await tx
      .update(bankTransactions)
      .set({
        reconciledToPaymentTransactionId: input.ledgerEntryId,
      })
      .where(
        and(
          eq(bankTransactions.id, input.bankTransactionId),
          eq(bankTransactions.associationId, input.associationId),
        ),
      );
  });
}

/**
 * Manual reconciliation (admin chose to pair these explicitly). Validates
 * tenant isolation + signs + within-$1 amount tolerance before applying.
 *
 * Tolerance window: ±$1 (per AC §"manual 'Match to invoice' admin action
 * available (dropdown of candidate pending entries within ±$1)"). Looser than
 * the auto-matcher's exact-cents because admin is overriding.
 */
export async function manualMatchBankTransaction(input: {
  associationId: string;
  bankTransactionId: string;
  ledgerEntryId: string;
}): Promise<
  | { ok: true; outcome: ReconciliationOutcome }
  | { ok: false; reason: string; code: string }
> {
  const [credit] = await db
    .select()
    .from(bankTransactions)
    .where(
      and(
        eq(bankTransactions.id, input.bankTransactionId),
        eq(bankTransactions.associationId, input.associationId),
        isNull(bankTransactions.reconciledToPaymentTransactionId),
      ),
    )
    .limit(1);
  if (!credit) {
    return { ok: false, reason: "Bank transaction not found or already reconciled", code: "BANK_TX_UNAVAILABLE" };
  }
  if (!isCredit(credit)) {
    return { ok: false, reason: "Bank transaction is a debit, not a credit", code: "NOT_A_CREDIT" };
  }

  const [entry] = await db
    .select()
    .from(ownerLedgerEntries)
    .where(
      and(
        eq(ownerLedgerEntries.id, input.ledgerEntryId),
        eq(ownerLedgerEntries.associationId, input.associationId),
        isNull(ownerLedgerEntries.settledAt),
        isNull(ownerLedgerEntries.bankTransactionId),
      ),
    )
    .limit(1);
  if (!entry) {
    return { ok: false, reason: "Ledger entry not found or already settled", code: "LEDGER_ENTRY_UNAVAILABLE" };
  }

  const creditAbsCents = Math.abs(credit.amountCents);
  const entryAbsCents = Math.round(Math.abs(entry.amount) * 100);
  const deltaCents = Math.abs(creditAbsCents - entryAbsCents);
  if (deltaCents > 100) {
    return {
      ok: false,
      reason: `Amount delta exceeds $1 tolerance ($${(deltaCents / 100).toFixed(2)})`,
      code: "AMOUNT_OUT_OF_TOLERANCE",
    };
  }

  await applyMatch({
    ledgerEntryId: entry.id,
    bankTransactionId: credit.id,
    associationId: input.associationId,
  });

  const dateDelta = diffDays(new Date(credit.date), entry.createdAt ?? entry.postedAt);
  return {
    ok: true,
    outcome: {
      bankTransactionId: credit.id,
      ledgerEntryId: entry.id,
      amountCents: creditAbsCents,
      dateDeltaDays: dateDelta,
    },
  };
}

/**
 * Inventory: unmatched credits + their candidate pending entries within ±$1.
 * Drives the admin UI's "Pending reconciliation" callout + manual-match
 * dropdown.
 */
export async function listPendingReconciliation(
  associationId: string,
): Promise<{
  unmatchedCredits: Array<BankTransaction & { candidates: Array<{ id: string; amount: number; description: string | null; createdAt: Date }> }>;
  pendingEntryCount: number;
}> {
  const credits = await db
    .select()
    .from(bankTransactions)
    .where(
      and(
        eq(bankTransactions.associationId, associationId),
        isNull(bankTransactions.reconciledToPaymentTransactionId),
      ),
    )
    .orderBy(asc(bankTransactions.date));

  const unmatchedCredits = credits.filter(isCredit);

  const pending = await db
    .select({
      id: ownerLedgerEntries.id,
      amount: ownerLedgerEntries.amount,
      description: ownerLedgerEntries.description,
      createdAt: ownerLedgerEntries.createdAt,
    })
    .from(ownerLedgerEntries)
    .where(
      and(
        eq(ownerLedgerEntries.associationId, associationId),
        eq(ownerLedgerEntries.referenceType, "plaid-pay-intent"),
        isNull(ownerLedgerEntries.settledAt),
        isNull(ownerLedgerEntries.bankTransactionId),
      ),
    )
    .orderBy(asc(ownerLedgerEntries.createdAt));

  const result = unmatchedCredits.map((credit) => {
    const creditAbsCents = Math.abs(credit.amountCents);
    const candidates = pending.filter((p) => {
      const pAbsCents = Math.round(Math.abs(p.amount) * 100);
      return Math.abs(creditAbsCents - pAbsCents) <= 100;
    });
    return { ...credit, candidates };
  });

  return {
    unmatchedCredits: result,
    pendingEntryCount: pending.length,
  };
}

