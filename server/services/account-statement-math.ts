/**
 * Owner account statement — pure math (readiness P0-3 / Issue #206).
 *
 * This module is DB-free on purpose: the statement computation is pure over
 * its inputs (ledger rows + a date range) so it can be unit-tested without a
 * Postgres connection. The DB-backed loader lives in `account-statement.ts`
 * and re-exports everything here.
 *
 * Source of truth: `owner_ledger_entries`. Amounts are SIGNED — charges /
 * assessments / late-fees are stored positive (owner owes more), payments /
 * credits are stored negative (owner owes less). The running balance is the
 * simple signed sum, mirroring `getOwnerLedgerSummary` in storage.ts
 * (`balance += entry.amountCents`).
 *
 * UNITS (migration 0068 / founder-os#10779): the INPUT is integer CENTS, matching the
 * `owner_ledger_entries.amount_cents` column, and all internal accumulation is exact
 * integer math. The OUTPUT contract is unchanged — dollars, as the client, the PDF
 * renderer and the statutory-records surface already expect — converted once at the
 * boundary via `cents / 100`. Previously this module summed float dollars and rounded
 * only at the end, so a long ledger could drift a cent before the final ROUND.
 *
 * The math invariant — verified by unit tests:
 *
 *     openingBalance + periodNetChange === closingBalance
 *
 * where periodNetChange is the signed sum of every ledger entry whose
 * postedAt falls within [from, to].
 */

export type StatementEntryType =
  | "charge"
  | "assessment"
  | "payment"
  | "late-fee"
  | "credit"
  | "adjustment";

/**
 * A minimal ledger-entry shape — the fields the statement math needs. Kept
 * structural (not the full Drizzle row) so the pure computation is easy to
 * test and decoupled from the schema.
 */
export interface StatementLedgerEntry {
  id: string;
  entryType: StatementEntryType | string;
  amountCents: number; // signed INTEGER CENTS (owner_ledger_entries.amount_cents)
  postedAt: Date;
  description: string | null;
}

export interface StatementLineItem {
  id: string;
  entryType: StatementEntryType | string;
  amount: number; // signed dollars (positive = charge, negative = payment/credit)
  postedAt: string; // ISO-8601
  description: string | null;
}

/** Per-category roll-up of the in-period entries. */
export interface StatementCategoryTotals {
  charges: number; // sum of charge entries (positive)
  assessments: number; // sum of assessment entries (positive)
  lateFees: number; // sum of late-fee entries (positive)
  payments: number; // sum of |payment| entries (positive — money received)
  credits: number; // sum of |credit| entries (positive — money credited)
  adjustments: number; // signed sum of adjustment entries (can be ±)
}

export interface AccountStatement {
  associationId: string;
  personId: string;
  unitId: string | null;
  periodStart: string; // ISO date (yyyy-mm-dd)
  periodEnd: string; // ISO date (yyyy-mm-dd)
  openingBalance: number;
  closingBalance: number;
  periodNetChange: number; // closingBalance − openingBalance (signed)
  categoryTotals: StatementCategoryTotals;
  lineItems: StatementLineItem[];
}

/**
 * Integer cents -> dollars, at the output boundary only. Exact: `cents` is already an
 * integer, so this is a single division with no accumulated float error to round away.
 * (Replaces the old `Math.round(n * 100) / 100` float-dollars rounding helper.)
 */
const toDollars = (cents: number): number => cents / 100;

/**
 * Inclusive-of-both-endpoints date-range check on the entry's posted date.
 * `from`/`to` are interpreted as whole-day boundaries: an entry posted at any
 * time on the `to` day is in-period.
 */
function isInPeriod(postedAt: Date, from: Date, to: Date): boolean {
  const t = postedAt.getTime();
  return t >= from.getTime() && t <= to.getTime();
}

/** yyyy-mm-dd from a Date (UTC date portion). */
function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Compute an account statement from a set of ledger entries + a date range.
 *
 * Pure function — no DB. The caller supplies ALL ledger entries for the
 * owner/unit scope (across all time); this function partitions them into
 * "before the period" (→ opening balance) and "in the period" (→ line items +
 * closing balance).
 *
 * @param entries  All ledger rows for the scope, any order.
 * @param from     Period start (inclusive, whole-day).
 * @param to       Period end (inclusive, whole-day — callers should pass the
 *                 end-of-day instant, e.g. 23:59:59.999, to include same-day
 *                 entries; `parsePeriodBounds` produces this).
 */
export function computeStatement(input: {
  associationId: string;
  personId: string;
  unitId: string | null;
  entries: StatementLedgerEntry[];
  from: Date;
  to: Date;
}): AccountStatement {
  const { associationId, personId, unitId, entries, from, to } = input;

  // Opening balance = signed sum of every entry posted strictly BEFORE the
  // period start. This is the balance the owner carried into the period.
  let openingBalanceCents = 0;
  const inPeriod: StatementLedgerEntry[] = [];

  for (const e of entries) {
    if (e.postedAt.getTime() < from.getTime()) {
      openingBalanceCents += e.amountCents;
    } else if (isInPeriod(e.postedAt, from, to)) {
      inPeriod.push(e);
    }
    // Entries posted strictly AFTER `to` are excluded entirely (they belong to
    // a later statement period).
  }

  // Sort the in-period line items chronologically (then by id for stable
  // ordering of same-instant entries).
  inPeriod.sort((a, b) => {
    const d = a.postedAt.getTime() - b.postedAt.getTime();
    return d !== 0 ? d : a.id.localeCompare(b.id);
  });

  // Category roll-up + period net change.
  // Accumulated in integer cents; converted to dollars once, at the return below.
  const categoryTotalsCents: StatementCategoryTotals = {
    charges: 0,
    assessments: 0,
    lateFees: 0,
    payments: 0,
    credits: 0,
    adjustments: 0,
  };
  let periodNetChangeCents = 0;

  for (const e of inPeriod) {
    periodNetChangeCents += e.amountCents;
    switch (e.entryType) {
      case "charge":
        categoryTotalsCents.charges += e.amountCents;
        break;
      case "assessment":
        categoryTotalsCents.assessments += e.amountCents;
        break;
      case "late-fee":
        categoryTotalsCents.lateFees += e.amountCents;
        break;
      case "payment":
        // payments stored negative; report the absolute money-received figure
        categoryTotalsCents.payments += Math.abs(e.amountCents);
        break;
      case "credit":
        categoryTotalsCents.credits += Math.abs(e.amountCents);
        break;
      case "adjustment":
        // adjustments can be either sign — keep signed
        categoryTotalsCents.adjustments += e.amountCents;
        break;
      default:
        // Unknown entry types still affect the balance (already added to
        // periodNetChange above) but aren't bucketed into a named category.
        break;
    }
  }

  // Exact in cents: openingBalance + periodNetChange === closingBalance holds as integer
  // arithmetic, so the invariant can no longer be broken by float drift.
  const closingBalanceCents = openingBalanceCents + periodNetChangeCents;

  return {
    associationId,
    personId,
    unitId,
    periodStart: toIsoDate(from),
    periodEnd: toIsoDate(to),
    openingBalance: toDollars(openingBalanceCents),
    closingBalance: toDollars(closingBalanceCents),
    periodNetChange: toDollars(periodNetChangeCents),
    categoryTotals: {
      charges: toDollars(categoryTotalsCents.charges),
      assessments: toDollars(categoryTotalsCents.assessments),
      lateFees: toDollars(categoryTotalsCents.lateFees),
      payments: toDollars(categoryTotalsCents.payments),
      credits: toDollars(categoryTotalsCents.credits),
      adjustments: toDollars(categoryTotalsCents.adjustments),
    },
    lineItems: inPeriod.map((e) => ({
      id: e.id,
      entryType: e.entryType,
      amount: toDollars(e.amountCents),
      postedAt: e.postedAt.toISOString(),
      description: e.description,
    })),
  };
}

/**
 * Parse a yyyy-mm-dd (or full ISO) string into the inclusive whole-day
 * boundary instants for a statement period.
 *
 * - `from` → start of that day (00:00:00.000 UTC)
 * - `to`   → end of that day (23:59:59.999 UTC) so same-day entries are in-period
 *
 * Returns null on an invalid/missing input so the route can 400.
 */
export function parsePeriodBounds(
  fromStr: string | undefined,
  toStr: string | undefined,
): { from: Date; to: Date } | null {
  if (!fromStr || !toStr) return null;
  const fromDay = fromStr.slice(0, 10);
  const toDay = toStr.slice(0, 10);
  const from = new Date(`${fromDay}T00:00:00.000Z`);
  const to = new Date(`${toDay}T23:59:59.999Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  if (from.getTime() > to.getTime()) return null;
  return { from, to };
}
