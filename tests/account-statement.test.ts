/**
 * Owner account statement — statement-math unit tests (readiness P0-3 / #206).
 *
 * The core invariant under test:
 *
 *     openingBalance + periodNetChange === closingBalance
 *
 * `computeStatement` is pure over its inputs (ledger rows + date range), so
 * these tests need no DB. We also exercise `parsePeriodBounds` (the
 * query-string → whole-day-boundary parser) and the category roll-up.
 */
import { describe, expect, it } from "vitest";
import {
  computeStatement,
  parsePeriodBounds,
  type StatementLedgerEntry,
} from "../server/services/account-statement-math";

const ASSOC = "assoc-1";
const PERSON = "person-1";
const UNIT = "unit-1";

function entry(
  id: string,
  entryType: StatementLedgerEntry["entryType"],
  amount: number,
  postedAt: string,
  description: string | null = null,
): StatementLedgerEntry {
  return { id, entryType, amount, postedAt: new Date(postedAt), description };
}

// Standard period: all of March 2026.
const FROM = new Date("2026-03-01T00:00:00.000Z");
const TO = new Date("2026-03-31T23:59:59.999Z");

describe("computeStatement — core balance math", () => {
  it("opening + net change === closing (the invariant)", () => {
    const entries: StatementLedgerEntry[] = [
      // Before period — sets opening balance to 100 (a $100 charge in Feb).
      entry("pre-1", "charge", 100, "2026-02-15T12:00:00Z"),
      // In period.
      entry("in-1", "assessment", 250, "2026-03-05T12:00:00Z"),
      entry("in-2", "payment", -200, "2026-03-10T12:00:00Z"),
      entry("in-3", "late-fee", 25, "2026-03-20T12:00:00Z"),
    ];

    const s = computeStatement({
      associationId: ASSOC,
      personId: PERSON,
      unitId: UNIT,
      entries,
      from: FROM,
      to: TO,
    });

    expect(s.openingBalance).toBe(100);
    // net = 250 - 200 + 25 = 75
    expect(s.periodNetChange).toBe(75);
    expect(s.closingBalance).toBe(175);
    // The invariant, asserted explicitly:
    expect(s.openingBalance + s.periodNetChange).toBe(s.closingBalance);
  });

  it("opening balance excludes in-period and after-period entries", () => {
    const entries: StatementLedgerEntry[] = [
      entry("pre-1", "charge", 300, "2026-01-01T00:00:00Z"), // before → opening
      entry("in-1", "charge", 100, "2026-03-15T00:00:00Z"), // in → line item
      entry("post-1", "charge", 999, "2026-04-01T00:00:00Z"), // after → excluded
    ];

    const s = computeStatement({
      associationId: ASSOC,
      personId: PERSON,
      unitId: null,
      entries,
      from: FROM,
      to: TO,
    });

    expect(s.openingBalance).toBe(300);
    expect(s.lineItems).toHaveLength(1);
    expect(s.lineItems[0].id).toBe("in-1");
    expect(s.periodNetChange).toBe(100);
    expect(s.closingBalance).toBe(400);
  });

  it("zero entries → zero everything", () => {
    const s = computeStatement({
      associationId: ASSOC,
      personId: PERSON,
      unitId: UNIT,
      entries: [],
      from: FROM,
      to: TO,
    });
    expect(s.openingBalance).toBe(0);
    expect(s.periodNetChange).toBe(0);
    expect(s.closingBalance).toBe(0);
    expect(s.lineItems).toHaveLength(0);
  });

  it("payment-only period drives the balance down", () => {
    const entries: StatementLedgerEntry[] = [
      entry("pre", "charge", 500, "2026-02-01T00:00:00Z"),
      entry("pay", "payment", -500, "2026-03-15T00:00:00Z"),
    ];
    const s = computeStatement({
      associationId: ASSOC,
      personId: PERSON,
      unitId: UNIT,
      entries,
      from: FROM,
      to: TO,
    });
    expect(s.openingBalance).toBe(500);
    expect(s.periodNetChange).toBe(-500);
    expect(s.closingBalance).toBe(0);
  });

  it("credit reduces balance and a negative closing balance is allowed (owner overpaid)", () => {
    const entries: StatementLedgerEntry[] = [
      entry("pre", "charge", 100, "2026-02-01T00:00:00Z"),
      entry("over", "payment", -150, "2026-03-10T00:00:00Z"),
    ];
    const s = computeStatement({
      associationId: ASSOC,
      personId: PERSON,
      unitId: UNIT,
      entries,
      from: FROM,
      to: TO,
    });
    expect(s.openingBalance).toBe(100);
    expect(s.closingBalance).toBe(-50); // credit balance
  });
});

describe("computeStatement — boundary inclusivity", () => {
  it("includes entries posted exactly on the from-day (00:00)", () => {
    const entries = [entry("edge", "charge", 50, "2026-03-01T00:00:00.000Z")];
    const s = computeStatement({
      associationId: ASSOC,
      personId: PERSON,
      unitId: UNIT,
      entries,
      from: FROM,
      to: TO,
    });
    expect(s.lineItems).toHaveLength(1);
    expect(s.periodNetChange).toBe(50);
  });

  it("includes entries posted late on the to-day (23:59)", () => {
    const entries = [entry("edge", "charge", 50, "2026-03-31T23:30:00.000Z")];
    const s = computeStatement({
      associationId: ASSOC,
      personId: PERSON,
      unitId: UNIT,
      entries,
      from: FROM,
      to: TO,
    });
    expect(s.lineItems).toHaveLength(1);
  });

  it("an entry one ms before from is opening, not in-period", () => {
    const entries = [entry("edge", "charge", 50, "2026-02-28T23:59:59.999Z")];
    const s = computeStatement({
      associationId: ASSOC,
      personId: PERSON,
      unitId: UNIT,
      entries,
      from: FROM,
      to: TO,
    });
    expect(s.lineItems).toHaveLength(0);
    expect(s.openingBalance).toBe(50);
  });
});

describe("computeStatement — category roll-up", () => {
  it("buckets each entry type and reports payments/credits as positive money-in", () => {
    const entries: StatementLedgerEntry[] = [
      entry("c1", "charge", 100, "2026-03-02T00:00:00Z"),
      entry("c2", "charge", 50, "2026-03-03T00:00:00Z"),
      entry("a1", "assessment", 200, "2026-03-04T00:00:00Z"),
      entry("l1", "late-fee", 15, "2026-03-05T00:00:00Z"),
      entry("p1", "payment", -120, "2026-03-06T00:00:00Z"),
      entry("cr1", "credit", -30, "2026-03-07T00:00:00Z"),
      entry("adj1", "adjustment", -10, "2026-03-08T00:00:00Z"),
    ];
    const s = computeStatement({
      associationId: ASSOC,
      personId: PERSON,
      unitId: UNIT,
      entries,
      from: FROM,
      to: TO,
    });
    expect(s.categoryTotals.charges).toBe(150);
    expect(s.categoryTotals.assessments).toBe(200);
    expect(s.categoryTotals.lateFees).toBe(15);
    expect(s.categoryTotals.payments).toBe(120); // abs of -120
    expect(s.categoryTotals.credits).toBe(30); // abs of -30
    expect(s.categoryTotals.adjustments).toBe(-10); // signed

    // Net change = 100 + 50 + 200 + 15 - 120 - 30 - 10 = 205
    expect(s.periodNetChange).toBe(205);
  });
});

describe("computeStatement — ordering and rounding", () => {
  it("orders line items chronologically", () => {
    const entries: StatementLedgerEntry[] = [
      entry("c", "charge", 1, "2026-03-20T00:00:00Z"),
      entry("a", "charge", 1, "2026-03-05T00:00:00Z"),
      entry("b", "charge", 1, "2026-03-10T00:00:00Z"),
    ];
    const s = computeStatement({
      associationId: ASSOC,
      personId: PERSON,
      unitId: UNIT,
      entries,
      from: FROM,
      to: TO,
    });
    expect(s.lineItems.map((l) => l.id)).toEqual(["a", "b", "c"]);
  });

  it("breaks ties on same instant by id for stable ordering", () => {
    const entries: StatementLedgerEntry[] = [
      entry("zeta", "charge", 1, "2026-03-10T00:00:00Z"),
      entry("alpha", "charge", 1, "2026-03-10T00:00:00Z"),
    ];
    const s = computeStatement({
      associationId: ASSOC,
      personId: PERSON,
      unitId: UNIT,
      entries,
      from: FROM,
      to: TO,
    });
    expect(s.lineItems.map((l) => l.id)).toEqual(["alpha", "zeta"]);
  });

  it("rounds float accumulation to cents (no 0.30000000000000004)", () => {
    const entries: StatementLedgerEntry[] = [
      entry("a", "charge", 0.1, "2026-03-05T00:00:00Z"),
      entry("b", "charge", 0.2, "2026-03-06T00:00:00Z"),
    ];
    const s = computeStatement({
      associationId: ASSOC,
      personId: PERSON,
      unitId: UNIT,
      entries,
      from: FROM,
      to: TO,
    });
    expect(s.periodNetChange).toBe(0.3);
    expect(s.closingBalance).toBe(0.3);
  });
});

describe("computeStatement — metadata pass-through", () => {
  it("echoes scope + ISO period boundaries", () => {
    const s = computeStatement({
      associationId: ASSOC,
      personId: PERSON,
      unitId: UNIT,
      entries: [],
      from: FROM,
      to: TO,
    });
    expect(s.associationId).toBe(ASSOC);
    expect(s.personId).toBe(PERSON);
    expect(s.unitId).toBe(UNIT);
    expect(s.periodStart).toBe("2026-03-01");
    expect(s.periodEnd).toBe("2026-03-31");
  });

  it("carries the line-item description and signed amount through", () => {
    const entries = [
      entry("x", "payment", -75.5, "2026-03-12T00:00:00Z", "Zelle from W. Ruiz"),
    ];
    const s = computeStatement({
      associationId: ASSOC,
      personId: PERSON,
      unitId: UNIT,
      entries,
      from: FROM,
      to: TO,
    });
    expect(s.lineItems[0].description).toBe("Zelle from W. Ruiz");
    expect(s.lineItems[0].amount).toBe(-75.5);
    expect(s.lineItems[0].entryType).toBe("payment");
  });
});

describe("parsePeriodBounds", () => {
  it("parses yyyy-mm-dd into whole-day inclusive boundaries", () => {
    const b = parsePeriodBounds("2026-03-01", "2026-03-31");
    expect(b).not.toBeNull();
    expect(b!.from.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect(b!.to.toISOString()).toBe("2026-03-31T23:59:59.999Z");
  });

  it("accepts full ISO strings (uses date portion)", () => {
    const b = parsePeriodBounds("2026-03-01T08:30:00Z", "2026-03-31T20:00:00Z");
    expect(b).not.toBeNull();
    expect(b!.from.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect(b!.to.toISOString()).toBe("2026-03-31T23:59:59.999Z");
  });

  it("returns null when from or to is missing", () => {
    expect(parsePeriodBounds(undefined, "2026-03-31")).toBeNull();
    expect(parsePeriodBounds("2026-03-01", undefined)).toBeNull();
    expect(parsePeriodBounds(undefined, undefined)).toBeNull();
  });

  it("returns null when from is after to", () => {
    expect(parsePeriodBounds("2026-04-01", "2026-03-01")).toBeNull();
  });

  it("returns null on an invalid date string", () => {
    expect(parsePeriodBounds("not-a-date", "2026-03-31")).toBeNull();
  });

  it("allows a single-day period (from === to)", () => {
    const b = parsePeriodBounds("2026-03-15", "2026-03-15");
    expect(b).not.toBeNull();
    expect(b!.from.getTime()).toBeLessThan(b!.to.getTime());
  });
});

// ── Cross-period continuity (#8533 acceptance: closing(N) === opening(N+1)) ──
//
// The treasurer-grade guarantee: statements for consecutive periods CHAIN —
// the balance an owner ends month N with is exactly the balance month N+1
// opens with, including entries posted at the extreme boundary instants.
// Also: a statement over [epoch → now] closes at the live ledger balance
// (the reconciliation the portal's live-balance figure shows).
describe("computeStatement — cross-period continuity", () => {
  const LEDGER: StatementLedgerEntry[] = [
    entry("jan-1", "assessment", 300, "2026-01-05T12:00:00Z"),
    entry("jan-2", "payment", -300, "2026-01-20T12:00:00Z"),
    // Boundary torture: the last representable ms of January…
    entry("jan-3", "late-fee", 25, "2026-01-31T23:59:59.999Z"),
    // …and the first instant of February.
    entry("feb-1", "assessment", 300, "2026-02-01T00:00:00.000Z"),
    entry("feb-2", "payment", -150, "2026-02-14T12:00:00Z"),
    entry("mar-1", "assessment", 300, "2026-03-01T09:00:00Z"),
    entry("mar-2", "credit", -50, "2026-03-15T09:00:00Z"),
  ];

  function statementFor(from: string, to: string) {
    return computeStatement({
      associationId: ASSOC,
      personId: PERSON,
      unitId: UNIT,
      entries: LEDGER,
      from: new Date(from),
      to: new Date(to),
    });
  }

  const jan = () => statementFor("2026-01-01T00:00:00.000Z", "2026-01-31T23:59:59.999Z");
  const feb = () => statementFor("2026-02-01T00:00:00.000Z", "2026-02-28T23:59:59.999Z");
  const mar = () => statementFor("2026-03-01T00:00:00.000Z", "2026-03-31T23:59:59.999Z");

  it("closing(Jan) === opening(Feb) — including a last-ms-of-January entry", () => {
    expect(jan().closingBalance).toBe(25); // 300 - 300 + 25
    expect(feb().openingBalance).toBe(jan().closingBalance);
  });

  it("closing(Feb) === opening(Mar) — including a first-instant-of-February entry", () => {
    // Feb: opening 25, +300 (posted exactly 00:00 — in-period, NOT opening), -150
    expect(feb().openingBalance).toBe(25);
    expect(feb().periodNetChange).toBe(150);
    expect(mar().openingBalance).toBe(feb().closingBalance);
  });

  it("chains across all three periods: opening(Jan) + Σ netChange === closing(Mar)", () => {
    const total = jan().periodNetChange + feb().periodNetChange + mar().periodNetChange;
    expect(jan().openingBalance + total).toBe(mar().closingBalance);
  });

  it("an all-time statement closes at the live ledger balance (signed sum of every entry)", () => {
    const liveBalance = LEDGER.reduce((sum, e) => sum + e.amount, 0);
    const allTime = statementFor("2020-01-01T00:00:00.000Z", "2026-12-31T23:59:59.999Z");
    expect(allTime.openingBalance).toBe(0);
    expect(allTime.closingBalance).toBe(liveBalance);
  });
});
