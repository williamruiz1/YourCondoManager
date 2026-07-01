/**
 * AR Aging — pure, DB-free bucketing math (readiness P2 — "who owes what, and
 * how overdue").
 *
 * This is the accounts-receivable AGING computation: for a unit, take its
 * charges (charge / assessment / late-fee — money owed) minus its payments and
 * credits (money received / forgiven), and distribute the REMAINING owed amount
 * into aging buckets keyed by the age of the OLDEST unsettled charge.
 *
 * The canonical accounting rule for aging is FIFO ("first in, first out"):
 * a payment settles the OLDEST outstanding charge first, so a partial payment
 * pulls dollars OUT of the oldest (highest-age) bucket first, leaving the
 * remaining owed amount concentrated in the newest charges. Aged AR buckets
 * therefore reflect the age of the money that is STILL owed after payments are
 * applied oldest-first.
 *
 * Integer-cents throughout — no floating-point money. Callers convert the
 * ledger's stored `real` dollar amounts to integer cents via `toCents()` before
 * calling `computeUnitAging` / `computeArAging`, so all arithmetic here is on
 * whole cents and never accumulates binary-fraction drift.
 *
 * This module is intentionally DB-free so it is unit-testable without Postgres.
 * The DB-backed assembly (load ledger rows, resolve unit numbers + owner names,
 * tenant-scope) lives in `ar-aging.ts`.
 */

/** The five AR aging buckets (task spec): Current / 1-30 / 31-60 / 61-90 / 90+. */
export interface AgingBuckets {
  /** Not yet overdue — charges aged 0 days (posted this cycle, no days past due). */
  current: number;
  /** 1–30 days past due. */
  days1to30: number;
  /** 31–60 days past due. */
  days31to60: number;
  /** 61–90 days past due. */
  days61to90: number;
  /** 91+ days past due. */
  days90plus: number;
}

/** A single ledger entry, reduced to the fields aging needs (amounts in CENTS). */
export interface AgingLedgerEntry {
  entryType:
    | "charge"
    | "assessment"
    | "payment"
    | "late-fee"
    | "credit"
    | "adjustment";
  /**
   * Amount in INTEGER CENTS. As stored in the ledger, charges/assessments/
   * late-fees are POSITIVE (money owed) and payments/credits are NEGATIVE
   * (money received). We normalize signs internally, so callers should pass the
   * raw stored sign converted straight to cents.
   */
  amountCents: number;
  /** When the entry was posted. Charge age = now − postedAt. */
  postedAt: Date;
}

/** Aging result for one unit. */
export interface UnitAging {
  buckets: AgingBuckets;
  /** Total still owed across all buckets, in cents (always ≥ 0). */
  totalOwedCents: number;
  /** Age in days of the OLDEST charge that still carries an unpaid balance. */
  oldestUnpaidDays: number;
  /** Whether the unit is delinquent (any amount past due — i.e. outside Current). */
  isDelinquent: boolean;
}

/** Convert a dollar amount (possibly fractional `real`) to integer cents. */
export function toCents(amountDollars: number): number {
  return Math.round(amountDollars * 100);
}

/** Sum the five buckets. */
export function sumBuckets(b: AgingBuckets): number {
  return b.current + b.days1to30 + b.days31to60 + b.days61to90 + b.days90plus;
}

/** An empty bucket set. */
export function emptyBuckets(): AgingBuckets {
  return { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, days90plus: 0 };
}

/** Whole-day age of a charge relative to `asOf` (floored, never negative). */
export function ageInDays(postedAt: Date, asOf: Date): number {
  const ms = asOf.getTime() - postedAt.getTime();
  if (ms <= 0) return 0;
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/** Pick the bucket key for a given days-past-due. */
function bucketForAge(days: number): keyof AgingBuckets {
  if (days <= 0) return "current";
  if (days <= 30) return "days1to30";
  if (days <= 60) return "days31to60";
  if (days <= 90) return "days61to90";
  return "days90plus";
}

/**
 * Compute the aging buckets for ONE unit from its ledger entries.
 *
 * Algorithm (FIFO, oldest-charge-first):
 *   1. Split entries into CHARGES (charge / assessment / late-fee — positive
 *      money owed) and OFFSETS (payment / credit — money received/forgiven,
 *      plus adjustments which net either way).
 *   2. Sort charges oldest → newest by postedAt.
 *   3. Apply the total offset pool against charges OLDEST-FIRST — a payment
 *      settles the oldest charge before the newer ones. This is what makes a
 *      partial payment reduce the oldest (highest-age) bucket first.
 *   4. Whatever remains unpaid on each charge is placed into the bucket for
 *      that charge's age. A fully-settled charge contributes nothing.
 *
 * Offsets are aggregated (their own dates don't matter for aging — only the age
 * of the charges the money settles). An adjustment can be positive (adds to
 * owed) or negative (reduces owed); a positive adjustment is treated as an
 * additional charge dated at its postedAt so it ages correctly.
 *
 * All arithmetic is on integer cents. Never returns a negative bucket; if
 * offsets exceed total charges (a credit balance), all buckets are 0.
 */
export function computeUnitAging(
  entries: AgingLedgerEntry[],
  asOf: Date = new Date(),
): UnitAging {
  const buckets = emptyBuckets();

  // Charges (money owed) — include positive adjustments as charges so they age.
  const charges: { amountCents: number; postedAt: Date }[] = [];
  // Offset pool (money received / forgiven) in POSITIVE cents.
  let offsetPoolCents = 0;

  for (const e of entries) {
    if (e.entryType === "charge" || e.entryType === "assessment" || e.entryType === "late-fee") {
      // Charges are stored positive; guard against a stray negative charge by
      // treating a negative "charge" as an offset (money owed reduced).
      if (e.amountCents >= 0) charges.push({ amountCents: e.amountCents, postedAt: e.postedAt });
      else offsetPoolCents += -e.amountCents;
    } else if (e.entryType === "payment" || e.entryType === "credit") {
      // Stored negative; add its magnitude to the offset pool.
      offsetPoolCents += Math.abs(e.amountCents);
    } else if (e.entryType === "adjustment") {
      // Adjustments net either way. Positive → an additional charge (ages at
      // its postedAt). Negative → reduces owed (offset pool).
      if (e.amountCents >= 0) charges.push({ amountCents: e.amountCents, postedAt: e.postedAt });
      else offsetPoolCents += -e.amountCents;
    }
  }

  // Oldest → newest.
  charges.sort((a, b) => a.postedAt.getTime() - b.postedAt.getTime());

  let remainingOffset = offsetPoolCents;
  let oldestUnpaidDays = 0;
  let sawUnpaid = false;

  for (const charge of charges) {
    let owed = charge.amountCents;
    if (remainingOffset > 0) {
      const applied = Math.min(remainingOffset, owed);
      owed -= applied;
      remainingOffset -= applied;
    }
    if (owed <= 0) continue; // fully settled by earlier-applied payments

    const age = ageInDays(charge.postedAt, asOf);
    buckets[bucketForAge(age)] += owed;

    if (!sawUnpaid || age > oldestUnpaidDays) oldestUnpaidDays = age;
    sawUnpaid = true;
  }

  const totalOwedCents = sumBuckets(buckets);
  // Delinquent = any owed amount is actually past due (outside the Current bucket).
  const isDelinquent = totalOwedCents > 0 && totalOwedCents > buckets.current;

  return { buckets, totalOwedCents, oldestUnpaidDays, isDelinquent };
}

/** A per-unit row in the association-wide aging report (amounts in cents). */
export interface UnitAgingRow {
  unitId: string;
  buckets: AgingBuckets;
  totalOwedCents: number;
  oldestUnpaidDays: number;
  isDelinquent: boolean;
}

/** Association-wide aging summary (amounts in cents). */
export interface ArAgingSummary {
  totals: AgingBuckets;
  totalArCents: number;
  /** % of total AR that is in the Current bucket (0–100, integer). */
  percentCurrent: number;
  /** # of units carrying any outstanding balance. */
  unitsWithBalance: number;
  /** # of units that are delinquent (any amount past due). */
  delinquentUnits: number;
}

/**
 * Compute the full association aging report from a map of unitId → its ledger
 * entries. Only units with a positive outstanding balance appear as rows.
 * Rows are returned sorted MOST-OVERDUE first (by oldest unpaid age desc, then
 * by total owed desc as a tiebreak).
 */
export function computeArAging(
  entriesByUnit: Map<string, AgingLedgerEntry[]>,
  asOf: Date = new Date(),
): { rows: UnitAgingRow[]; summary: ArAgingSummary } {
  const rows: UnitAgingRow[] = [];
  const totals = emptyBuckets();

  for (const [unitId, entries] of entriesByUnit) {
    const aging = computeUnitAging(entries, asOf);
    if (aging.totalOwedCents <= 0) continue; // no balance due — omit

    rows.push({
      unitId,
      buckets: aging.buckets,
      totalOwedCents: aging.totalOwedCents,
      oldestUnpaidDays: aging.oldestUnpaidDays,
      isDelinquent: aging.isDelinquent,
    });

    totals.current += aging.buckets.current;
    totals.days1to30 += aging.buckets.days1to30;
    totals.days31to60 += aging.buckets.days31to60;
    totals.days61to90 += aging.buckets.days61to90;
    totals.days90plus += aging.buckets.days90plus;
  }

  // Most overdue first.
  rows.sort((a, b) => {
    if (b.oldestUnpaidDays !== a.oldestUnpaidDays) return b.oldestUnpaidDays - a.oldestUnpaidDays;
    return b.totalOwedCents - a.totalOwedCents;
  });

  const totalArCents = sumBuckets(totals);
  const percentCurrent = totalArCents > 0 ? Math.round((totals.current / totalArCents) * 100) : 0;
  const delinquentUnits = rows.filter((r) => r.isDelinquent).length;

  return {
    rows,
    summary: {
      totals,
      totalArCents,
      percentCurrent,
      unitsWithBalance: rows.length,
      delinquentUnits,
    },
  };
}
