/**
 * Reconciliation report (founder-os#970).
 *
 * Aggregates per-period stats answering "for this association, between these
 * two dates: how much money came in via the bank, how much was recorded as
 * paid in the ledger, what's the gap, and per-owner where does it land?"
 *
 * This is the data the board admin opens at /admin/reconciliation Tab 2 to
 * confirm "we know about every dollar that hit the bank account this month."
 *
 * Plain-English answer per row:
 *   - "Total bank deposits"       — sum of |amountCents|/100 for all bank credits in window
 *   - "Total ledger payments"     — sum of |amount| for all payment ledger entries in window
 *   - "Matched count"             — bank txs that have at least one ledger entry pointing at them
 *   - "Unmatched bank txs"        — bank credits in window with no ledger entry linking to them
 *   - "Unmatched ledger entries"  — payment entries in window with NULL bank_transaction_id
 *   - "By-owner breakdown"        — per-person: payments recorded, payments settled, gap
 *
 * Tenant isolation: every query filters by `association_id`.
 */
import { and, asc, eq, gte, lte, isNotNull, isNull } from "drizzle-orm";
import { db } from "../../db";
import {
  bankTransactions,
  ownerLedgerEntries,
  persons,
  units,
  ownerships,
} from "@shared/schema";
import {
  findOwnerSuggestionsForUnmatchedCredits,
  CREDIT_SEARCH_WINDOW_DAYS,
} from "./auto-matcher";

export interface ReconciliationReport {
  associationId: string;
  periodStart: string; // ISO date (yyyy-mm-dd)
  periodEnd: string;
  totals: {
    bankDepositsCents: number;
    ledgerPaymentsCents: number;
    matchedCount: number;
    unmatchedBankTxCount: number;
    unmatchedLedgerEntryCount: number;
    gapCents: number; // ledger payments − bank deposits (signed)
  };
  unmatchedBankTransactions: Array<{
    id: string;
    date: string;
    name: string;
    merchantName: string | null;
    amountCents: number;
  }>;
  unmatchedLedgerEntries: Array<{
    id: string;
    personId: string;
    personName: string;
    unitId: string;
    unitNumber: string | null;
    postedAt: Date;
    amount: number;
    description: string | null;
  }>;
  byOwner: Array<{
    personId: string;
    personName: string;
    paymentsRecordedCents: number;
    paymentsSettledCents: number;
    gapCents: number;
  }>;
}

export async function buildReconciliationReport(input: {
  associationId: string;
  periodStart: Date;
  periodEnd: Date;
}): Promise<ReconciliationReport> {
  const { associationId, periodStart, periodEnd } = input;

  // ── 1. Bank transactions in window (credits only) ──────────────────────────
  const bankRows = await db
    .select()
    .from(bankTransactions)
    .where(
      and(
        eq(bankTransactions.associationId, associationId),
        gte(bankTransactions.date, periodStart.toISOString().slice(0, 10)),
        lte(bankTransactions.date, periodEnd.toISOString().slice(0, 10)),
      ),
    );
  // Plaid convention: positive=debit, negative=credit
  const bankCredits = bankRows.filter((r) => r.amountCents < 0);
  const bankDepositsCents = bankCredits.reduce(
    (sum, r) => sum + Math.abs(r.amountCents),
    0,
  );

  // ── 2. Payment ledger entries in window ────────────────────────────────────
  const ledgerRows = await db
    .select()
    .from(ownerLedgerEntries)
    .where(
      and(
        eq(ownerLedgerEntries.associationId, associationId),
        eq(ownerLedgerEntries.entryType, "payment"),
        gte(ownerLedgerEntries.postedAt, periodStart),
        lte(ownerLedgerEntries.postedAt, periodEnd),
      ),
    );
  const ledgerPaymentsCents = ledgerRows.reduce(
    (sum, r) => sum + Math.round(Math.abs(r.amount) * 100),
    0,
  );

  const matchedLedgerEntries = ledgerRows.filter(
    (r) => r.bankTransactionId !== null && r.settledAt !== null,
  );
  const matchedBankTxIds = new Set(
    matchedLedgerEntries
      .map((r) => r.bankTransactionId)
      .filter((id): id is string => id !== null),
  );

  // ── 3. Unmatched inventory ─────────────────────────────────────────────────
  const unmatchedBank = bankCredits
    .filter(
      (r) =>
        r.reconciledToPaymentTransactionId === null && !matchedBankTxIds.has(r.id),
    )
    .map((r) => ({
      id: r.id,
      date: r.date,
      name: r.name,
      merchantName: r.merchantName,
      amountCents: r.amountCents,
    }));

  const unmatchedLedger = ledgerRows.filter(
    (r) => r.bankTransactionId === null,
  );

  // Hydrate person + unit for unmatched ledger rows (single batched query).
  const personIds = Array.from(new Set(unmatchedLedger.map((r) => r.personId)));
  const unitIds = Array.from(new Set(unmatchedLedger.map((r) => r.unitId)));
  const personRows = personIds.length
    ? await db.select().from(persons).where(eq(persons.associationId, associationId))
    : [];
  const unitRows = unitIds.length
    ? await db.select().from(units).where(eq(units.associationId, associationId))
    : [];
  const personById = new Map(personRows.map((p) => [p.id, p]));
  const unitById = new Map(unitRows.map((u) => [u.id, u]));

  const unmatchedLedgerEntries = unmatchedLedger.map((r) => {
    const person = personById.get(r.personId);
    const unit = unitById.get(r.unitId);
    return {
      id: r.id,
      personId: r.personId,
      personName: person ? `${person.firstName} ${person.lastName}` : "Unknown",
      unitId: r.unitId,
      unitNumber: unit?.unitNumber ?? null,
      postedAt: r.postedAt,
      amount: r.amount,
      description: r.description,
    };
  });

  // ── 4. By-owner breakdown ──────────────────────────────────────────────────
  const byOwnerMap = new Map<
    string,
    { paymentsRecordedCents: number; paymentsSettledCents: number }
  >();
  for (const r of ledgerRows) {
    const acc = byOwnerMap.get(r.personId) ?? {
      paymentsRecordedCents: 0,
      paymentsSettledCents: 0,
    };
    const cents = Math.round(Math.abs(r.amount) * 100);
    acc.paymentsRecordedCents += cents;
    if (r.bankTransactionId !== null && r.settledAt !== null) {
      acc.paymentsSettledCents += cents;
    }
    byOwnerMap.set(r.personId, acc);
  }
  const byOwner = Array.from(byOwnerMap.entries()).map(([personId, acc]) => {
    const person = personById.get(personId);
    return {
      personId,
      personName: person ? `${person.firstName} ${person.lastName}` : "Unknown",
      paymentsRecordedCents: acc.paymentsRecordedCents,
      paymentsSettledCents: acc.paymentsSettledCents,
      gapCents: acc.paymentsRecordedCents - acc.paymentsSettledCents,
    };
  });
  byOwner.sort((a, b) => b.gapCents - a.gapCents);

  return {
    associationId,
    periodStart: periodStart.toISOString().slice(0, 10),
    periodEnd: periodEnd.toISOString().slice(0, 10),
    totals: {
      bankDepositsCents,
      ledgerPaymentsCents,
      matchedCount: matchedLedgerEntries.length,
      unmatchedBankTxCount: unmatchedBank.length,
      unmatchedLedgerEntryCount: unmatchedLedgerEntries.length,
      gapCents: ledgerPaymentsCents - bankDepositsCents,
    },
    unmatchedBankTransactions: unmatchedBank,
    unmatchedLedgerEntries,
    byOwner,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Consolidated transaction ledger (founder-os UI consolidation).
//
// THE problem this solves: the Bank Accounts page used to show TWO separate
// raw lists (a "Connected → transactions" list and a "Pending reconciliation"
// list) of the SAME bank movements, with no column identifying WHO each
// transaction was from or WHAT it was for. This builder produces ONE row per
// bank credit, joining the existing engine's output so every transaction is
// identified in a single table.
//
// It does NOT reimplement any matching logic — it READS the matched ledger
// entries (the auto-matcher already wrote `bank_transaction_id` + `settled_at`)
// and COMPOSES `findOwnerSuggestionsForUnmatchedCredits` (the existing engine
// function) to attach owner suggestions to unmatched credits. The "status"
// column is a pure projection of that joined state.
//
// Window: the last CREDIT_SEARCH_WINDOW_DAYS (30) of bank credits — the same
// window the auto-matcher operates over, so the suggestions line up 1:1 with
// the rows shown.
// ─────────────────────────────────────────────────────────────────────────────

export type ReconTxStatus =
  | "auto-matched" // engine confidently matched it to an owner ledger entry
  | "suggested" // unmatched, but the engine fingerprints it to an owner (confirm needed)
  | "needs-review" // unmatched + ambiguous (multiple owner candidates)
  | "unmatched"; // unmatched + no owner signal at all

export interface ReconTransactionRow {
  bankTransactionId: string;
  date: string; // yyyy-mm-dd
  descriptor: string; // raw bank descriptor (merchantName ?? name)
  amountCents: number; // absolute (positive) for display
  status: ReconTxStatus;
  // Identification — populated for auto-matched (from the ledger entry) OR for
  // a single suggested/needs-review candidate (from the engine suggestion).
  identifiedAs: {
    personId: string | null;
    personName: string | null;
    unitId: string | null;
    unitNumber: string | null;
  };
  // "For" — Dues / Assessment / etc., read from the matched ledger entry's
  // type/description when available. Never invented; null when unknown.
  forLabel: string | null;
  // Confidence 0..1 for auto-matched (alias/heuristic) or the top suggestion.
  confidence: number | null;
  // The matched ledger entry id (auto-matched rows only) — for un-match/audit.
  ledgerEntryId: string | null;
  // For suggested/needs-review rows: the candidate owner(s) to confirm. The
  // first is the top candidate (used by the one-click Confirm action).
  ownerCandidates: Array<{
    personId: string;
    personName: string;
    unitId: string;
    unitNumber: string | null;
    confidence: number;
  }>;
}

export interface ReconTransactionLedger {
  associationId: string;
  windowDays: number;
  rows: ReconTransactionRow[];
  counts: {
    total: number;
    autoMatched: number;
    suggested: number;
    needsReview: number;
    unmatched: number;
  };
}

/**
 * Derive a human "For" label from a matched payment ledger entry. The matched
 * entry itself is always entry_type='payment' (the bank credit IS the payment),
 * so the meaningful signal is its description (e.g. "Q3 dues", "Special
 * assessment"). We surface the description verbatim when present; otherwise
 * null. We intentionally do NOT guess Dues-vs-Assessment.
 */
function forLabelFromLedgerEntry(entry: {
  entryType: string;
  description: string | null;
}): string | null {
  if (entry.description && entry.description.trim().length > 0) {
    return entry.description.trim();
  }
  return null;
}

export async function buildReconciliationTransactionLedger(input: {
  associationId: string;
}): Promise<ReconTransactionLedger> {
  const { associationId } = input;

  const cutoffDate = new Date(Date.now() - CREDIT_SEARCH_WINDOW_DAYS * 86400 * 1000);
  const cutoffStr = cutoffDate.toISOString().slice(0, 10);

  // 1. Bank credits in window (Plaid convention: negative = credit/inflow).
  const bankRows = await db
    .select()
    .from(bankTransactions)
    .where(
      and(
        eq(bankTransactions.associationId, associationId),
        gte(bankTransactions.date, cutoffStr),
      ),
    )
    .orderBy(asc(bankTransactions.date));
  const credits = bankRows.filter((r) => r.amountCents < 0);

  // 2. Ledger entries linked to a bank transaction (the engine already wrote
  //    bank_transaction_id when it matched). Map bankTxId → matched entry.
  const linkedEntries = await db
    .select()
    .from(ownerLedgerEntries)
    .where(
      and(
        eq(ownerLedgerEntries.associationId, associationId),
        isNotNull(ownerLedgerEntries.bankTransactionId),
      ),
    );
  const matchByBankTx = new Map<string, (typeof linkedEntries)[number]>();
  for (const e of linkedEntries) {
    if (e.bankTransactionId) matchByBankTx.set(e.bankTransactionId, e);
  }

  // 3. Person + unit directory (for naming matched-row owners).
  const personRows = await db
    .select()
    .from(persons)
    .where(eq(persons.associationId, associationId));
  const unitRows = await db
    .select()
    .from(units)
    .where(eq(units.associationId, associationId));
  const personById = new Map(personRows.map((p) => [p.id, p]));
  const unitById = new Map(unitRows.map((u) => [u.id, u]));

  // 4. Owner suggestions for UNMATCHED credits — reuse the existing engine fn
  //    (no matching logic reimplemented here). Map bankTxId → suggestion.
  const suggestions = await findOwnerSuggestionsForUnmatchedCredits(associationId);
  const suggestionByBankTx = new Map(
    suggestions.map((s) => [s.bankTransactionId, s]),
  );

  // 5. Project one consolidated row per credit.
  const rows: ReconTransactionRow[] = credits.map((c) => {
    const amountCents = Math.abs(c.amountCents);
    const descriptor = c.merchantName ?? c.name;
    const matched = matchByBankTx.get(c.id);

    if (matched) {
      const person = personById.get(matched.personId);
      const unit = unitById.get(matched.unitId);
      return {
        bankTransactionId: c.id,
        date: c.date,
        descriptor,
        amountCents,
        status: "auto-matched",
        identifiedAs: {
          personId: matched.personId,
          personName: person ? `${person.firstName} ${person.lastName}` : "Unknown",
          unitId: matched.unitId,
          unitNumber: unit?.unitNumber ?? null,
        },
        forLabel: forLabelFromLedgerEntry({
          entryType: matched.entryType,
          description: matched.description,
        }),
        // Matched rows don't carry a stored confidence; the match is committed.
        // Show null (the UI renders a committed "matched" badge, not a %).
        confidence: null,
        ledgerEntryId: matched.id,
        ownerCandidates: [],
      };
    }

    const suggestion = suggestionByBankTx.get(c.id);
    if (suggestion && suggestion.ownerCandidates.length > 0) {
      const top = suggestion.ownerCandidates[0];
      const status: ReconTxStatus =
        suggestion.tier === "ambiguous" ? "needs-review" : "suggested";
      return {
        bankTransactionId: c.id,
        date: c.date,
        descriptor,
        amountCents,
        status,
        identifiedAs:
          status === "suggested"
            ? {
                personId: top.personId,
                personName: top.personName,
                unitId: top.unitId,
                unitNumber: top.unitNumber,
              }
            : { personId: null, personName: null, unitId: null, unitNumber: null },
        forLabel: null, // not yet a ledger entry → unknown
        confidence: suggestion.topConfidence,
        ledgerEntryId: null,
        ownerCandidates: suggestion.ownerCandidates.map((o) => ({
          personId: o.personId,
          personName: o.personName,
          unitId: o.unitId,
          unitNumber: o.unitNumber,
          confidence: o.confidence,
        })),
      };
    }

    // No match, no owner signal.
    return {
      bankTransactionId: c.id,
      date: c.date,
      descriptor,
      amountCents,
      status: "unmatched",
      identifiedAs: { personId: null, personName: null, unitId: null, unitNumber: null },
      forLabel: null,
      confidence: null,
      ledgerEntryId: null,
      ownerCandidates: [],
    };
  });

  // Newest first for the UI.
  rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const counts = {
    total: rows.length,
    autoMatched: rows.filter((r) => r.status === "auto-matched").length,
    suggested: rows.filter((r) => r.status === "suggested").length,
    needsReview: rows.filter((r) => r.status === "needs-review").length,
    unmatched: rows.filter((r) => r.status === "unmatched").length,
  };

  return {
    associationId,
    windowDays: CREDIT_SEARCH_WINDOW_DAYS,
    rows,
    counts,
  };
}
