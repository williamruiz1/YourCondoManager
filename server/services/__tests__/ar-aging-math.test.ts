/**
 * ar-aging-math.test.ts — pure AR aging bucketing logic.
 *
 * Covers the FIFO oldest-first bucketing that the readiness-P2 AR aging report
 * relies on:
 *   - a charge 45 days old with no payment → 31-60 bucket
 *   - a partial payment reduces the oldest bucket first
 *   - current vs overdue classification
 *   - integer-cents exactness (no floating-point drift)
 *   - association-wide summary (total AR, % current, delinquent count, sort order)
 *
 * DB-free — exercises the pure functions only.
 */
import { describe, it, expect } from "vitest";
import {
  computeUnitAging,
  computeArAging,
  toCents,
  ageInDays,
  type AgingLedgerEntry,
} from "../ar-aging-math";

/** Build a Date `days` days before `asOf`. */
function daysAgo(days: number, asOf: Date): Date {
  return new Date(asOf.getTime() - days * 24 * 60 * 60 * 1000);
}

const ASOF = new Date("2026-07-01T12:00:00.000Z");

describe("toCents", () => {
  it("converts dollars to integer cents with rounding", () => {
    expect(toCents(100)).toBe(10000);
    expect(toCents(100.5)).toBe(10050);
    expect(toCents(0.1)).toBe(10);
    // 0.1 + 0.2 dollars = 0.30 — integer cents avoids the 0.30000000000000004 trap.
    expect(toCents(0.1) + toCents(0.2)).toBe(30);
  });
});

describe("ageInDays", () => {
  it("floors to whole days and never goes negative", () => {
    expect(ageInDays(daysAgo(45, ASOF), ASOF)).toBe(45);
    expect(ageInDays(daysAgo(0, ASOF), ASOF)).toBe(0);
    // A future-dated charge ages 0, not negative.
    expect(ageInDays(new Date(ASOF.getTime() + 5 * 86400000), ASOF)).toBe(0);
  });
});

describe("computeUnitAging — bucketing", () => {
  it("a charge 45 days old with no payment → 31-60 bucket", () => {
    const entries: AgingLedgerEntry[] = [
      { entryType: "charge", amountCents: toCents(300), postedAt: daysAgo(45, ASOF) },
    ];
    const { buckets, totalOwedCents, isDelinquent, oldestUnpaidDays } = computeUnitAging(entries, ASOF);
    expect(buckets.days31to60).toBe(30000);
    expect(buckets.current).toBe(0);
    expect(buckets.days1to30).toBe(0);
    expect(buckets.days61to90).toBe(0);
    expect(buckets.days90plus).toBe(0);
    expect(totalOwedCents).toBe(30000);
    expect(oldestUnpaidDays).toBe(45);
    expect(isDelinquent).toBe(true);
  });

  it("classifies each bucket boundary correctly (Current / 1-30 / 31-60 / 61-90 / 90+)", () => {
    const entries: AgingLedgerEntry[] = [
      { entryType: "charge", amountCents: toCents(10), postedAt: daysAgo(0, ASOF) },   // Current
      { entryType: "charge", amountCents: toCents(20), postedAt: daysAgo(15, ASOF) },  // 1-30
      { entryType: "charge", amountCents: toCents(30), postedAt: daysAgo(45, ASOF) },  // 31-60
      { entryType: "charge", amountCents: toCents(40), postedAt: daysAgo(75, ASOF) },  // 61-90
      { entryType: "charge", amountCents: toCents(50), postedAt: daysAgo(120, ASOF) }, // 90+
    ];
    const { buckets, totalOwedCents } = computeUnitAging(entries, ASOF);
    expect(buckets.current).toBe(1000);
    expect(buckets.days1to30).toBe(2000);
    expect(buckets.days31to60).toBe(3000);
    expect(buckets.days61to90).toBe(4000);
    expect(buckets.days90plus).toBe(5000);
    expect(totalOwedCents).toBe(15000);
  });

  it("day-30 is in 1-30 and day-31 crosses into 31-60 (boundary exactness)", () => {
    const d30 = computeUnitAging(
      [{ entryType: "charge", amountCents: toCents(100), postedAt: daysAgo(30, ASOF) }],
      ASOF,
    );
    expect(d30.buckets.days1to30).toBe(10000);
    expect(d30.buckets.days31to60).toBe(0);

    const d31 = computeUnitAging(
      [{ entryType: "charge", amountCents: toCents(100), postedAt: daysAgo(31, ASOF) }],
      ASOF,
    );
    expect(d31.buckets.days1to30).toBe(0);
    expect(d31.buckets.days31to60).toBe(10000);
  });
});

describe("computeUnitAging — FIFO payment application", () => {
  it("a partial payment reduces the oldest bucket first", () => {
    // Two charges: $100 aged 90 days (61-90), $100 aged 10 days (1-30).
    // A $60 payment settles the OLDEST first → oldest bucket left with $40,
    // newest untouched at $100.
    const entries: AgingLedgerEntry[] = [
      { entryType: "charge", amountCents: toCents(100), postedAt: daysAgo(90, ASOF) },
      { entryType: "charge", amountCents: toCents(100), postedAt: daysAgo(10, ASOF) },
      { entryType: "payment", amountCents: toCents(-60), postedAt: daysAgo(1, ASOF) },
    ];
    const { buckets, totalOwedCents } = computeUnitAging(entries, ASOF);
    expect(buckets.days61to90).toBe(4000); // $40 remains on the oldest
    expect(buckets.days1to30).toBe(10000); // newest untouched
    expect(totalOwedCents).toBe(14000);
  });

  it("a payment that fully covers the oldest charge moves on to the next", () => {
    // $100 aged 90d + $100 aged 10d, $150 payment → oldest fully paid, $50 left
    // on the newest.
    const entries: AgingLedgerEntry[] = [
      { entryType: "charge", amountCents: toCents(100), postedAt: daysAgo(90, ASOF) },
      { entryType: "charge", amountCents: toCents(100), postedAt: daysAgo(10, ASOF) },
      { entryType: "payment", amountCents: toCents(-150), postedAt: daysAgo(1, ASOF) },
    ];
    const { buckets, totalOwedCents, oldestUnpaidDays } = computeUnitAging(entries, ASOF);
    expect(buckets.days61to90).toBe(0);
    expect(buckets.days1to30).toBe(5000);
    expect(totalOwedCents).toBe(5000);
    expect(oldestUnpaidDays).toBe(10); // oldest UNPAID is now the newer charge
  });

  it("payments and credits both offset owed amounts", () => {
    const entries: AgingLedgerEntry[] = [
      { entryType: "charge", amountCents: toCents(200), postedAt: daysAgo(45, ASOF) },
      { entryType: "payment", amountCents: toCents(-50), postedAt: daysAgo(1, ASOF) },
      { entryType: "credit", amountCents: toCents(-50), postedAt: daysAgo(1, ASOF) },
    ];
    const { totalOwedCents, buckets } = computeUnitAging(entries, ASOF);
    expect(totalOwedCents).toBe(10000); // $200 − $50 − $50 = $100
    expect(buckets.days31to60).toBe(10000);
  });

  it("a fully-paid unit shows zero owed and is not delinquent", () => {
    const entries: AgingLedgerEntry[] = [
      { entryType: "charge", amountCents: toCents(100), postedAt: daysAgo(45, ASOF) },
      { entryType: "payment", amountCents: toCents(-100), postedAt: daysAgo(1, ASOF) },
    ];
    const { totalOwedCents, isDelinquent } = computeUnitAging(entries, ASOF);
    expect(totalOwedCents).toBe(0);
    expect(isDelinquent).toBe(false);
  });

  it("a credit balance (overpaid) never yields negative buckets", () => {
    const entries: AgingLedgerEntry[] = [
      { entryType: "charge", amountCents: toCents(100), postedAt: daysAgo(45, ASOF) },
      { entryType: "payment", amountCents: toCents(-150), postedAt: daysAgo(1, ASOF) },
    ];
    const { totalOwedCents, buckets } = computeUnitAging(entries, ASOF);
    expect(totalOwedCents).toBe(0);
    expect(buckets.days31to60).toBe(0);
    expect(buckets.current).toBe(0);
  });
});

describe("computeUnitAging — current vs overdue", () => {
  it("a charge posted today is Current and not delinquent", () => {
    const entries: AgingLedgerEntry[] = [
      { entryType: "charge", amountCents: toCents(150), postedAt: daysAgo(0, ASOF) },
    ];
    const { buckets, isDelinquent, oldestUnpaidDays } = computeUnitAging(entries, ASOF);
    expect(buckets.current).toBe(15000);
    expect(isDelinquent).toBe(false);
    expect(oldestUnpaidDays).toBe(0);
  });

  it("a unit with both a current and an overdue charge is delinquent", () => {
    const entries: AgingLedgerEntry[] = [
      { entryType: "charge", amountCents: toCents(100), postedAt: daysAgo(0, ASOF) },
      { entryType: "charge", amountCents: toCents(100), postedAt: daysAgo(75, ASOF) },
    ];
    const { isDelinquent, buckets } = computeUnitAging(entries, ASOF);
    expect(buckets.current).toBe(10000);
    expect(buckets.days61to90).toBe(10000);
    expect(isDelinquent).toBe(true);
  });
});

describe("computeUnitAging — adjustments", () => {
  it("a positive adjustment ages like a charge; a negative adjustment offsets", () => {
    const entries: AgingLedgerEntry[] = [
      { entryType: "charge", amountCents: toCents(100), postedAt: daysAgo(45, ASOF) },
      { entryType: "adjustment", amountCents: toCents(50), postedAt: daysAgo(45, ASOF) }, // +$50 owed
      { entryType: "adjustment", amountCents: toCents(-30), postedAt: daysAgo(1, ASOF) }, // −$30 owed
    ];
    const { totalOwedCents, buckets } = computeUnitAging(entries, ASOF);
    expect(totalOwedCents).toBe(12000); // 100 + 50 − 30 = 120
    expect(buckets.days31to60).toBe(12000);
  });
});

describe("computeArAging — association summary", () => {
  it("aggregates units, computes totals / % current / delinquent count, sorts most-overdue first", () => {
    const byUnit = new Map<string, AgingLedgerEntry[]>();
    // Unit A — $100 aged 120 days (90+), delinquent, most overdue.
    byUnit.set("A", [{ entryType: "charge", amountCents: toCents(100), postedAt: daysAgo(120, ASOF) }]);
    // Unit B — $100 current, not delinquent.
    byUnit.set("B", [{ entryType: "charge", amountCents: toCents(100), postedAt: daysAgo(0, ASOF) }]);
    // Unit C — $50 aged 40 days (31-60), delinquent.
    byUnit.set("C", [{ entryType: "charge", amountCents: toCents(50), postedAt: daysAgo(40, ASOF) }]);
    // Unit D — fully paid → omitted entirely.
    byUnit.set("D", [
      { entryType: "charge", amountCents: toCents(80), postedAt: daysAgo(10, ASOF) },
      { entryType: "payment", amountCents: toCents(-80), postedAt: daysAgo(1, ASOF) },
    ]);

    const { rows, summary } = computeArAging(byUnit, ASOF);

    // D omitted; A, B, C remain.
    expect(rows.map((r) => r.unitId)).toEqual(["A", "C", "B"]); // most overdue first
    expect(summary.unitsWithBalance).toBe(3);
    expect(summary.delinquentUnits).toBe(2); // A and C
    expect(summary.totals.current).toBe(10000);
    expect(summary.totals.days31to60).toBe(5000);
    expect(summary.totals.days90plus).toBe(10000);
    expect(summary.totalArCents).toBe(25000); // $250
    // % current = 100 / 250 = 40%
    expect(summary.percentCurrent).toBe(40);
  });

  it("returns an empty report when nobody owes anything", () => {
    const byUnit = new Map<string, AgingLedgerEntry[]>();
    byUnit.set("A", [
      { entryType: "charge", amountCents: toCents(100), postedAt: daysAgo(30, ASOF) },
      { entryType: "payment", amountCents: toCents(-100), postedAt: daysAgo(1, ASOF) },
    ]);
    const { rows, summary } = computeArAging(byUnit, ASOF);
    expect(rows).toHaveLength(0);
    expect(summary.totalArCents).toBe(0);
    expect(summary.percentCurrent).toBe(0);
    expect(summary.delinquentUnits).toBe(0);
  });
});
