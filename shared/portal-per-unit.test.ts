import { describe, expect, it } from "vitest";
import { buildPerUnitBreakdown } from "./portal-per-unit";

const BYUNIT = [
  {
    unitId: "u-1417F",
    unitLabel: "1417-F",
    total: 2185.42,
    byCategory: { charge: 990, assessment: 1525.42, payment: -330 },
    entries: [
      { entryType: "charge", amount: 330, postedAt: "2026-05-01T00:00:00.000Z" },
      { entryType: "charge", amount: 330, postedAt: "2026-06-01T00:00:00.000Z" },
      { entryType: "charge", amount: 330, postedAt: "2026-07-01T00:00:00.000Z" },
      { entryType: "assessment", amount: 1525.42, postedAt: "2026-05-08T00:00:00.000Z" },
      { entryType: "payment", amount: -330, postedAt: "2026-07-20T12:11:29.045Z" },
    ],
  },
  {
    unitId: "u-1421B",
    unitLabel: "1421-B",
    total: 3111.77,
    byCategory: { charge: 990, assessment: 2121.77 },
    entries: [
      { entryType: "charge", amount: 330, postedAt: "2026-05-01T00:00:00.000Z" },
      { entryType: "charge", amount: 330, postedAt: "2026-06-01T00:00:00.000Z" },
      { entryType: "charge", amount: 330, postedAt: "2026-07-01T00:00:00.000Z" },
      { entryType: "assessment", amount: 2121.77, postedAt: "2026-05-08T00:00:00.000Z" },
    ],
  },
  {
    unitId: "u-1421C",
    unitLabel: "1421-C",
    total: 2955.42,
    byCategory: { charge: 990, assessment: 1971.42, payment: -6 },
    entries: [
      { entryType: "charge", amount: 330, postedAt: "2026-05-01T00:00:00.000Z" },
      { entryType: "charge", amount: 330, postedAt: "2026-06-01T00:00:00.000Z" },
      { entryType: "charge", amount: 330, postedAt: "2026-07-01T00:00:00.000Z" },
      { entryType: "assessment", amount: 1971.42, postedAt: "2026-05-08T00:00:00.000Z" },
      { entryType: "payment", amount: -6, postedAt: "2026-05-25T17:20:00.000Z" },
    ],
  },
];
const JULY = new Date("2026-07-20T16:00:00.000Z");
const UPCOMING = [
  { installmentAmount: 250, unitId: "u-1417F", dueDate: "2026-07-31T00:00:00.000Z" },
];
const round = (n: number) => Math.round(n * 100) / 100;
const sum = (arr: number[]) => round(arr.reduce((a, b) => a + b, 0));

describe("buildPerUnitBreakdown — current-period dues and assessment truth", () => {
  const perUnit = buildPerUnitBreakdown(BYUNIT, UPCOMING, "u-1417F", JULY);

  it("returns one row per owned unit", () => {
    expect(perUnit.map((u) => u.unitLabel)).toEqual(["1417-F", "1421-B", "1421-C"]);
  });

  it("uses only July HOA charges and applies July's cleared payment", () => {
    const f = perUnit.find((u) => u.unitLabel === "1417-F")!;
    expect(f.dueNowDues).toBe(0);
    expect(f.dueNowAssessment).toBe(250);
    expect(f.dueNowTotal).toBe(250);

    const b = perUnit.find((u) => u.unitLabel === "1421-B")!;
    expect(b.dueNowDues).toBe(330);
    expect(b.dueNowAssessment).toBe(0);
  });

  it("keeps historical HOA and scheduleless-assessment obligations in balance only", () => {
    const c = perUnit.find((u) => u.unitLabel === "1421-C")!;
    expect(c.balanceAssessment).toBe(1971.42);
    expect(round(c.balanceDues)).toBe(984);
    expect(round(c.balanceTotal)).toBe(2955.42);
  });

  it("reconciles the owner-wide July amounts", () => {
    expect(sum(perUnit.map((u) => u.dueNowDues))).toBe(660);
    expect(sum(perUnit.map((u) => u.dueNowAssessment))).toBe(250);
    expect(sum(perUnit.map((u) => u.dueNowTotal))).toBe(910);
  });

  it("reconciles the full historical balance independently", () => {
    expect(sum(perUnit.map((u) => u.balanceTotal))).toBe(8252.61);
    expect(sum(perUnit.map((u) => u.balanceDues + u.balanceAssessment))).toBe(8252.61);
  });

  it("puts an unscoped current installment on the fallback unit", () => {
    const unscoped = [{ installmentAmount: 250, dueDate: "2026-07-31T00:00:00.000Z" }];
    const result = buildPerUnitBreakdown(BYUNIT, unscoped, "missing", JULY);
    expect(sum(result.map((u) => u.dueNowAssessment))).toBe(250);
  });

  it("does not count the scheduleless driveway balance as due this period", () => {
    const result = buildPerUnitBreakdown(BYUNIT, [], "u-1417F", JULY);
    expect(sum(result.map((u) => u.dueNowAssessment))).toBe(0);
    expect(sum(result.map((u) => u.dueNowTotal))).toBe(660);
  });

  it("ignores scheduled installments outside the current period", () => {
    const august = [
      { installmentAmount: 250, unitId: "u-1417F", dueDate: "2026-08-01T00:00:00.000Z" },
    ];
    const result = buildPerUnitBreakdown(BYUNIT, august, "u-1417F", JULY);
    expect(sum(result.map((u) => u.dueNowAssessment))).toBe(0);
  });

  it("includes a tracked assessment installment posted in the current period", () => {
    const unit = {
      ...BYUNIT[1],
      entries: [
        ...BYUNIT[1].entries,
        {
          entryType: "assessment",
          amount: 250,
          postedAt: "2026-07-15T00:00:00.000Z",
          referenceType: "special_assessment_installment",
        },
      ],
    };
    const result = buildPerUnitBreakdown([unit], [], unit.unitId, JULY);
    expect(result[0].dueNowAssessment).toBe(250);
  });

  it("spills payment credit above HOA dues into a scheduled assessment", () => {
    const unit = {
      ...BYUNIT[0],
      entries: [
        { entryType: "charge", amount: 330, postedAt: "2026-07-01T00:00:00.000Z" },
        { entryType: "payment", amount: -400, postedAt: "2026-07-20T00:00:00.000Z" },
      ],
    };
    const result = buildPerUnitBreakdown([unit], UPCOMING, unit.unitId, JULY);
    expect(result[0].dueNowDues).toBe(0);
    expect(result[0].dueNowAssessment).toBe(180);
  });
});
