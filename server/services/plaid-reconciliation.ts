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
 *   2. amount: |bankTx.amountCents| === |ledgerEntry.amountCents| (cents-exact; both
 *              sides are integer cents since migration 0068 — no dollars round-trip)
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
import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "../db";
import {
  bankTransactions,
  ownerLedgerEntries,
  type BankTransaction,
} from "@shared/schema";

const MATCH_DATE_WINDOW_DAYS = 3;

/**
 * Bank-credit ids that are ALREADY consumed by this ledger-reconciliation
 * pipeline — i.e. some owner-ledger entry already links back to them via
 * `bankTransactionId`. A-RECON-004: `applyMatch` writes the link on the LEDGER
 * side but the matcher's credit query only excluded credits reconciled to a
 * *payment_transaction* (`reconciledToPaymentTransactionId`), never the
 * ledger-linked ones. So a matched credit stayed "unmatched" in the matcher's
 * own input and could settle a SECOND same-amount entry on the next run
 * (one deposit → two settled intents). We exclude any already-linked credit so
 * a consumed credit is never re-evaluated. The existing ledger link IS the
 * consumed marker — no schema change / denormalized state to keep in sync, and
 * it cannot alter correct existing behavior (only excludes already-settled
 * credits). NOTE: `reconciledToPaymentTransactionId` is an FK to
 * `payment_transactions.id` and MUST NOT be repurposed for a ledger-entry id.
 */
async function consumedCreditIds(associationId: string): Promise<Set<string>> {
  const linked = await db
    .select({ bankTransactionId: ownerLedgerEntries.bankTransactionId })
    .from(ownerLedgerEntries)
    .where(
      and(
        eq(ownerLedgerEntries.associationId, associationId),
        isNotNull(ownerLedgerEntries.bankTransactionId),
      ),
    );
  return new Set(
    linked
      .map((row) => row.bankTransactionId)
      .filter((id): id is string => id != null),
  );
}

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

  // 2b. A-RECON-004: drop credits already consumed by a prior ledger match so a
  //     single deposit can never settle a second entry on a later run.
  const consumed = await consumedCreditIds(associationId);
  const availableCredits = unmatchedCredits.filter((c) => !consumed.has(c.id));

  const matched: ReconciliationOutcome[] = [];
  const usedEntryIds = new Set<string>();
  const matchedCreditIds = new Set<string>();

  // 3. Greedy match: for each credit, find best-fitting pending entry by
  //    smallest |dateDelta| (cap at MATCH_DATE_WINDOW_DAYS).
  for (const credit of availableCredits) {
    if (!isCredit(credit)) continue;
    const creditAbsCents = Math.abs(credit.amountCents);
    const creditDate = new Date(credit.date);

    let bestEntryIdx = -1;
    let bestDelta = MATCH_DATE_WINDOW_DAYS + 1;

    for (let i = 0; i < pendingEntries.length; i++) {
      const entry = pendingEntries[i];
      if (usedEntryIds.has(entry.id)) continue;

      const entryAbsCents = Math.abs(entry.amountCents);
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
    unmatchedCreditIds: availableCredits
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
  // DATA-B-009: wrap the match write in an atomic transaction. Today this is a
  // single ledger-side update; the transaction boundary is the correct, load-
  // bearing contract so any future write added to a match (e.g. a bank-side
  // consumed marker) commits or rolls back with the ledger link — never
  // half-applied.
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

  // A-RECON-004: reject a credit already linked to a ledger entry so a manual
  // match can't double-settle a deposit the auto-matcher (or an earlier manual
  // match) already consumed.
  const [alreadyLinked] = await db
    .select({ id: ownerLedgerEntries.id })
    .from(ownerLedgerEntries)
    .where(
      and(
        eq(ownerLedgerEntries.associationId, input.associationId),
        eq(ownerLedgerEntries.bankTransactionId, input.bankTransactionId),
      ),
    )
    .limit(1);
  if (alreadyLinked) {
    return {
      ok: false,
      reason: "Bank transaction is already reconciled to a ledger entry",
      code: "BANK_TX_ALREADY_CONSUMED",
    };
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
  const entryAbsCents = Math.abs(entry.amountCents);
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
  unmatchedCredits: Array<BankTransaction & { candidates: Array<{ id: string; amountCents: number; description: string | null; createdAt: Date }> }>;
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

  // A-RECON-004: hide credits already consumed by a ledger match so the admin
  // "Pending reconciliation" UI never offers a settled credit for re-matching.
  const consumed = await consumedCreditIds(associationId);
  const unmatchedCredits = credits.filter(
    (c) => isCredit(c) && !consumed.has(c.id),
  );

  const pending = await db
    .select({
      id: ownerLedgerEntries.id,
      amountCents: ownerLedgerEntries.amountCents,
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
      const pAbsCents = Math.abs(p.amountCents);
      return Math.abs(creditAbsCents - pAbsCents) <= 100;
    });
    return { ...credit, candidates };
  });

  return {
    unmatchedCredits: result,
    pendingEntryCount: pending.length,
  };
}

