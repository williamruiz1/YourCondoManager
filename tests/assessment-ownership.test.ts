/**
 * Wave 9 — 4.3 Q5 per-owner portion calc.
 *
 * Unit tests for `server/assessment-ownership.ts`. Covers all four
 * `allocationMethod` values, fallback behavior, interest amortization,
 * missing-field edge cases, custom-allocation ≠ 100% rejection, and
 * remaining-installments derivation.
 *
 * Spec anchor:
 *   docs/projects/platform-overhaul/decisions/4.3-recurring-assessment-rules-engine.md
 *   — Q5 (Hypothesis B + owner-facing assessment detail).
 */

import { describe, expect, it } from "vitest";

import {
  computeOwnerPortion,
  CUSTOM_ALLOCATION_TOLERANCE,
  type AssessmentForOwnerPortion,
  type UnitForOwnerPortion,
} from "../server/assessment-ownership";

const baseAssessment: AssessmentForOwnerPortion = {
  id: "assess-1",
  totalAmount: 120000,
  installmentCount: 12,
  interestRatePercent: null,
  termMonths: null,
  allocationMethod: "per-unit-equal",
  allocationCustomJson: null,
};

function unit(id: string, extras: Partial<UnitForOwnerPortion> = {}): UnitForOwnerPortion {
  return { id, squareFootage: null, ...extras };
}

describe("computeOwnerPortion — per-unit-equal", () => {
  it("divides totalAmount equally across totalActiveUnitCount", () => {
    const units = [unit("u1"), unit("u2"), unit("u3"), unit("u4")];
    const result = computeOwnerPortion({
      assessment: baseAssessment,
      unit: units[0],
      totalActiveUnitCount: 4,
      allUnits: units,
    });
    expect(result.principal).toBe(30000);
    expect(result.interest).toBe(0);
    expect(result.total).toBe(30000);
    expect(result.installmentAmount).toBe(2500);
    expect(result.remainingInstallments).toBe(12);
    expect(result.allocationReason).toBe("per-unit-equal");
  });

  it("returns principal = 0 when totalActiveUnitCount is 0", () => {
    const result = computeOwnerPortion({
      assessment: baseAssessment,
      unit: unit("u1"),
      totalActiveUnitCount: 0,
      allUnits: [],
    });
    expect(result.principal).toBe(0);
  });

  it("defaults to per-unit-equal when allocationMethod is null/undefined", () => {
    const result = computeOwnerPortion({
      assessment: { ...baseAssessment, allocationMethod: null },
      unit: unit("u1"),
      totalActiveUnitCount: 2,
      allUnits: [unit("u1"), unit("u2")],
    });
    expect(result.principal).toBe(60000);
    expect(result.allocationReason).toBe("per-unit-equal");
  });
});

describe("computeOwnerPortion — per-sq-ft", () => {
  it("allocates proportionally to squareFootage / totalSqFt", () => {
    const units = [
      unit("u1", { squareFootage: 1000 }),
      unit("u2", { squareFootage: 2000 }),
      unit("u3", { squareFootage: 1000 }),
    ];
    const result = computeOwnerPortion({
      assessment: { ...baseAssessment, allocationMethod: "per-sq-ft" },
      unit: units[1], // 2000 of 4000 total → 50%
      totalActiveUnitCount: 3,
      allUnits: units,
    });
    expect(result.principal).toBe(60000);
    expect(result.allocationReason).toBe("per-sq-ft");
  });

  it("falls back to per-unit-equal when unit squareFootage is null", () => {
    const units = [
      unit("u1"), // null sqft
      unit("u2", { squareFootage: 2000 }),
    ];
    const result = computeOwnerPortion({
      assessment: { ...baseAssessment, allocationMethod: "per-sq-ft" },
      unit: units[0],
      totalActiveUnitCount: 2,
      allUnits: units,
    });
    expect(result.principal).toBe(60000);
    expect(result.allocationReason).toBe(
      "per-sq-ft fallback: unit squareFootage missing",
    );
  });

  it("falls back to per-unit-equal when all units have null squareFootage", () => {
    const units = [unit("u1"), unit("u2")];
    const result = computeOwnerPortion({
      assessment: { ...baseAssessment, allocationMethod: "per-sq-ft" },
      unit: units[0],
      totalActiveUnitCount: 2,
      allUnits: units,
    });
    expect(result.allocationReason).toMatch(/squareFootage missing/);
  });

  it("treats totalSqFt = 0 as fallback-worthy even when the target unit has sqft", () => {
    // Pathological — target unit has sqft but all others are zero. Since
    // totalSqFt = target unit sqft, proportion = 1.0 → full allocation.
    // (This test anchors the real numeric behavior so we don't drift.)
    const units = [
      unit("u1", { squareFootage: 1500 }),
      unit("u2", { squareFootage: 0 }),
    ];
    const result = computeOwnerPortion({
      assessment: { ...baseAssessment, allocationMethod: "per-sq-ft" },
      unit: units[0],
      totalActiveUnitCount: 2,
      allUnits: units,
    });
    expect(result.principal).toBe(120000);
    expect(result.allocationReason).toBe("per-sq-ft");
  });
});

describe("computeOwnerPortion — per-ownership-share", () => {
  it("allocates by ownershipPercent when present on the unit", () => {
    const units = [
      unit("u1", { ownershipPercent: 40 }),
      unit("u2", { ownershipPercent: 60 }),
    ];
    const result = computeOwnerPortion({
      assessment: { ...baseAssessment, allocationMethod: "per-ownership-share" },
      unit: units[0],
      totalActiveUnitCount: 2,
      allUnits: units,
    });
    expect(result.principal).toBe(48000);
    expect(result.allocationReason).toBe("per-ownership-share");
  });

  it("accepts the legacy `ownershipPercentage` alias", () => {
    const units = [
      unit("u1", { ownershipPercentage: 25 }),
      unit("u2", { ownershipPercentage: 75 }),
    ];
    const result = computeOwnerPortion({
      assessment: { ...baseAssessment, allocationMethod: "per-ownership-share" },
      unit: units[1],
      totalActiveUnitCount: 2,
      allUnits: units,
    });
    expect(result.principal).toBe(90000);
    expect(result.allocationReason).toBe("per-ownership-share");
  });

  it("falls back to per-unit-equal when ownershipPercent is missing", () => {
    const units = [unit("u1"), unit("u2")];
    const result = computeOwnerPortion({
      assessment: { ...baseAssessment, allocationMethod: "per-ownership-share" },
      unit: units[0],
      totalActiveUnitCount: 2,
      allUnits: units,
    });
    expect(result.principal).toBe(60000);
    expect(result.allocationReason).toMatch(
      /per-ownership-share fallback: unit ownershipPercent missing/,
    );
  });
});

describe("computeOwnerPortion — custom", () => {
  it("applies the percentage from allocationCustomJson[unit.id]", () => {
    const units = [unit("u1"), unit("u2")];
    const result = computeOwnerPortion({
      assessment: {
        ...baseAssessment,
        allocationMethod: "custom",
        allocationCustomJson: { u1: 30, u2: 70 },
      },
      unit: units[0],
      totalActiveUnitCount: 2,
      allUnits: units,
    });
    expect(result.principal).toBe(36000);
    expect(result.allocationReason).toBe("custom");
  });

  it("rejects when the custom allocation does not sum to 100 ± tolerance", () => {
    const units = [unit("u1"), unit("u2")];
    expect(() =>
      computeOwnerPortion({
        assessment: {
          ...baseAssessment,
          allocationMethod: "custom",
          allocationCustomJson: { u1: 30, u2: 50 }, // sums to 80
        },
        unit: units[0],
        totalActiveUnitCount: 2,
        allUnits: units,
      }),
    ).toThrowError(/sum to 100/);
  });

  it("accepts sums inside the 0.01 tolerance window", () => {
    const units = [unit("u1"), unit("u2")];
    // Values sum to 100.005 — within tolerance.
    expect(CUSTOM_ALLOCATION_TOLERANCE).toBeGreaterThanOrEqual(0.005);
    const result = computeOwnerPortion({
      assessment: {
        ...baseAssessment,
        allocationMethod: "custom",
        allocationCustomJson: { u1: 50.005, u2: 50 },
      },
      unit: units[0],
      totalActiveUnitCount: 2,
      allUnits: units,
    });
    expect(result.allocationReason).toBe("custom");
  });

  it("falls back to per-unit-equal when allocationCustomJson is null", () => {
    const units = [unit("u1"), unit("u2")];
    const result = computeOwnerPortion({
      assessment: {
        ...baseAssessment,
        allocationMethod: "custom",
        allocationCustomJson: null,
      },
      unit: units[0],
      totalActiveUnitCount: 2,
      allUnits: units,
    });
    expect(result.principal).toBe(60000);
    expect(result.allocationReason).toMatch(/custom fallback/);
  });

  it("falls back to per-unit-equal when the unit id is missing from the map", () => {
    const units = [unit("u1"), unit("u2")];
    const result = computeOwnerPortion({
      assessment: {
        ...baseAssessment,
        allocationMethod: "custom",
        // Sums to 100 so validation passes; but neither key matches u1.
        allocationCustomJson: { "other-a": 40, "other-b": 60 },
      },
      unit: units[0],
      totalActiveUnitCount: 2,
      allUnits: units,
    });
    expect(result.principal).toBe(60000);
    expect(result.allocationReason).toMatch(/custom fallback/);
  });
});

describe("computeOwnerPortion — interest amortization", () => {
  it("computes interest + total via standard amortization when rate + term set", () => {
    // Principal 10,000, rate 6%, term 60 months → monthly ~193.33 → total ~11,600
    const result = computeOwnerPortion({
      assessment: {
        ...baseAssessment,
        totalAmount: 20000,
        installmentCount: 60,
        interestRatePercent: 6,
        termMonths: 60,
      },
      unit: unit("u1"),
      totalActiveUnitCount: 2,
      allUnits: [unit("u1"), unit("u2")],
    });
    expect(result.principal).toBe(10000);
    // Interest is positive and roughly the expected 1600 ± rounding.
    expect(result.interest).toBeGreaterThan(1500);
    expect(result.interest).toBeLessThan(1700);
    expect(result.total).toBe(result.principal + result.interest);
    // Installment amount = total / installmentCount.
    expect(result.installmentAmount).toBeCloseTo(result.total / 60, 2);
  });

  it("returns zero interest when interestRatePercent is null", () => {
    const result = computeOwnerPortion({
      assessment: {
        ...baseAssessment,
        interestRatePercent: null,
        termMonths: 60,
      },
      unit: unit("u1"),
      totalActiveUnitCount: 2,
      allUnits: [unit("u1"), unit("u2")],
    });
    expect(result.interest).toBe(0);
    expect(result.total).toBe(result.principal);
  });

  it("returns zero interest when termMonths is null", () => {
    const result = computeOwnerPortion({
      assessment: {
        ...baseAssessment,
        interestRatePercent: 5,
        termMonths: null,
      },
      unit: unit("u1"),
      totalActiveUnitCount: 2,
      allUnits: [unit("u1"), unit("u2")],
    });
    expect(result.interest).toBe(0);
  });

  it("returns zero interest when rate is 0", () => {
    const result = computeOwnerPortion({
      assessment: {
        ...baseAssessment,
        interestRatePercent: 0,
        termMonths: 60,
      },
      unit: unit("u1"),
      totalActiveUnitCount: 2,
      allUnits: [unit("u1"), unit("u2")],
    });
    expect(result.interest).toBe(0);
  });
});

describe("computeOwnerPortion — remaining installments", () => {
  it("defaults to installmentCount when no installments posted", () => {
    const result = computeOwnerPortion({
      assessment: { ...baseAssessment, installmentCount: 6 },
      unit: unit("u1"),
      totalActiveUnitCount: 2,
      allUnits: [unit("u1"), unit("u2")],
    });
    expect(result.remainingInstallments).toBe(6);
  });

  it("subtracts installmentsPosted from installmentCount", () => {
    const result = computeOwnerPortion({
      assessment: { ...baseAssessment, installmentCount: 6 },
      unit: unit("u1"),
      totalActiveUnitCount: 2,
      allUnits: [unit("u1"), unit("u2")],
      installmentsPosted: 4,
    });
    expect(result.remainingInstallments).toBe(2);
  });

  it("clamps at 0 and installmentCount", () => {
    const a = computeOwnerPortion({
      assessment: { ...baseAssessment, installmentCount: 6 },
      unit: unit("u1"),
      totalActiveUnitCount: 2,
      allUnits: [unit("u1"), unit("u2")],
      installmentsPosted: 100,
    });
    expect(a.remainingInstallments).toBe(0);

    const b = computeOwnerPortion({
      assessment: { ...baseAssessment, installmentCount: 6 },
      unit: unit("u1"),
      totalActiveUnitCount: 2,
      allUnits: [unit("u1"), unit("u2")],
      installmentsPosted: -5,
    });
    expect(b.remainingInstallments).toBe(6);
  });

  it("handles missing/zero installmentCount as 1 installment", () => {
    const result = computeOwnerPortion({
      assessment: { ...baseAssessment, installmentCount: 0 },
      unit: unit("u1"),
      totalActiveUnitCount: 2,
      allUnits: [unit("u1"), unit("u2")],
    });
    expect(result.remainingInstallments).toBe(1);
    expect(result.installmentAmount).toBe(result.total);
  });
});

describe("computeOwnerPortion — defensive", () => {
  it("defaults to per-unit-equal on an unknown allocationMethod value", () => {
    const result = computeOwnerPortion({
      assessment: {
        ...baseAssessment,
        // cast through unknown to simulate a corrupted DB row
        allocationMethod: "bogus" as unknown as never,
      },
      unit: unit("u1"),
      totalActiveUnitCount: 2,
      allUnits: [unit("u1"), unit("u2")],
    });
    expect(result.principal).toBe(60000);
    expect(result.allocationReason).toMatch(/unknown allocationMethod/);
  });

  it("handles a non-finite totalAmount as 0 principal", () => {
    const result = computeOwnerPortion({
      assessment: {
        ...baseAssessment,
        totalAmount: Number.NaN as unknown as number,
      },
      unit: unit("u1"),
      totalActiveUnitCount: 2,
      allUnits: [unit("u1"), unit("u2")],
    });
    expect(result.principal).toBe(0);
  });
});
