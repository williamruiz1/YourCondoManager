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
import { and, eq, gte, lte, isNotNull, isNull } from "drizzle-orm";
import { db } from "../../db";
import {
  bankTransactions,
  ownerLedgerEntries,
  persons,
  units,
  ownerships,
} from "@shared/schema";

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
