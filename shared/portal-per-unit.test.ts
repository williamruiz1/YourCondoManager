/**
 * Per-unit owner-finances breakdown — pure-logic tests (2026-07-03).
 *
 * The load-bearing property is RECONCILIATION: the per-unit figures must sum
 * to exactly the owner-wide totals the owner already sees. The fixture is
 * William Ruiz's real 3-unit Cherry Hill Court data (due-now $7,414.44 /
 * balance $8,582.61) so the test doubles as a reconciliation guard.
 */
import { describe, expect, it } from "vitest";
import { buildPerUnitBreakdown } from "./portal-per-unit";

// William Ruiz — 3 Cherry Hill Court units. Primary (portal) unit = 1417-F.
const BYUNIT = [
  { unitId: "u-1417F", unitLabel: "1417-F", total: 2515.42, byCategory: { charge: 990, assessment: 1525.42 } },
  { unitId: "u-1421B", unitLabel: "1421-B", total: 3111.77, byCategory: { charge: 990, assessment: 2121.77 } },
  { unitId: "u-1421C", unitLabel: "1421-C", total: 2955.42, byCategory: { charge: 990, assessment: 1971.42, payment: -6 } },
];
// $80k driveway assessment / 18 units / 1 installment = $4,444.44 for the primary unit.
const UPCOMING = [{ installmentAmount: 4444.44 }];

const round = (n: number) => Math.round(n * 100) / 100;
const sum = (arr: number[]) => round(arr.reduce((a, b) => a + b, 0));

describe("buildPerUnitBreakdown — per-unit dues vs special assessment", () => {
  const perUnit = buildPerUnitBreakdown(BYUNIT, UPCOMING, "u-1417F");

  it("returns one row per owned unit", () => {
    expect(perUnit.map((u) => u.unitLabel)).toEqual(["1417-F", "1421-B", "1421-C"]);
  });

  it("splits each unit's DUE NOW into HOA dues vs special-assessment installment", () => {
    const f = perUnit.find((u) => u.unitLabel === "1417-F")!;
    expect(f.dueNowDues).toBe(990);
    expect(f.dueNowAssessment).toBe(4444.44); // installment lands on the primary unit
    expect(round(f.dueNowTotal)).toBe(5434.44);

    const b = perUnit.find((u) => u.unitLabel === "1421-B")!;
    expect(b.dueNowDues).toBe(990);
    expect(b.dueNowAssessment).toBe(0); // non-primary units show $0 installment due now
    expect(b.dueNowTotal).toBe(990);
  });

  it("splits each unit's BALANCE into dues/other vs special assessment", () => {
    const c = perUnit.find((u) => u.unitLabel === "1421-C")!;
    expect(c.balanceAssessment).toBe(1971.42);
    expect(round(c.balanceDues)).toBe(984); // 990 charge − 6 payment
    expect(round(c.balanceTotal)).toBe(2955.42);
  });

  it("RECONCILES: per-unit dues-due sums to the owner-wide dues-due ($2,970.00)", () => {
    expect(sum(perUnit.map((u) => u.dueNowDues))).toBe(2970);
  });

  it("RECONCILES: per-unit assessment-installment sums to the owner-wide installment ($4,444.44)", () => {
    expect(sum(perUnit.map((u) => u.dueNowAssessment))).toBe(4444.44);
  });

  it("RECONCILES: per-unit DUE NOW sums to the owner-wide due-now total ($7,414.44)", () => {
    expect(sum(perUnit.map((u) => u.dueNowTotal))).toBe(7414.44);
  });

  it("RECONCILES: per-unit BALANCE sums to the owner-wide balance ($8,582.61)", () => {
    expect(sum(perUnit.map((u) => u.balanceTotal))).toBe(8582.61);
    // dues + assessment partition also reconciles
    expect(sum(perUnit.map((u) => u.balanceDues + u.balanceAssessment))).toBe(8582.61);
  });

  it("never drops the installment total when the primary unit is absent", () => {
    const pu = buildPerUnitBreakdown(BYUNIT, UPCOMING, "u-does-not-exist");
    expect(sum(pu.map((u) => u.dueNowAssessment))).toBe(4444.44);
  });

  it("no installments → assessment-due is zero everywhere", () => {
    const pu = buildPerUnitBreakdown(BYUNIT, [], "u-1417F");
    expect(sum(pu.map((u) => u.dueNowAssessment))).toBe(0);
    expect(sum(pu.map((u) => u.dueNowTotal))).toBe(2970);
  });

  it("single-unit owner still reconciles", () => {
    const pu = buildPerUnitBreakdown([BYUNIT[0]], UPCOMING, "u-1417F");
    expect(pu).toHaveLength(1);
    expect(round(pu[0].dueNowTotal)).toBe(5434.44);
    expect(round(pu[0].balanceTotal)).toBe(2515.42);
  });
});
