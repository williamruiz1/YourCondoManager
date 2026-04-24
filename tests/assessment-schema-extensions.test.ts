/**
 * Wave 6 — 4.3 Assessment schema extensions.
 *
 * Covers:
 *   - Backward compatibility: existing (pre-Wave-6) rows still validate
 *     against insertSpecialAssessmentSchema / insertRecurringChargeScheduleSchema
 *     without the new Q5/Q7 fields.
 *   - Forward validation: new fields accept valid values.
 *   - Invariants: invalid allocationMethod rejected; negative
 *     interestRatePercent rejected; allocationMethod='custom' without
 *     allocationCustomJson rejected.
 *
 * Spec anchor:
 *   docs/projects/platform-overhaul/decisions/4.3-recurring-assessment-rules-engine.md
 *   — Q5 (loan-style detail) + Q7 (canonical rule model).
 */

import { describe, expect, it } from "vitest";

import {
  insertSpecialAssessmentSchema,
  insertRecurringChargeScheduleSchema,
} from "../shared/schema";

const baseAssessment = {
  associationId: "assoc-1",
  name: "2026 Roof Assessment",
  totalAmount: 120000,
  startDate: new Date("2026-05-01T00:00:00Z"),
};

const baseRecurring = {
  associationId: "assoc-1",
  chargeDescription: "Monthly HOA dues",
  amount: 350,
};

describe("insertSpecialAssessmentSchema — backward compatibility", () => {
  it("accepts a pre-Wave-6 shaped row without any of the new fields", () => {
    const result = insertSpecialAssessmentSchema.safeParse({
      ...baseAssessment,
      installmentCount: 12,
      autoPostEnabled: 1,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a row with an explicit empty excludedUnitIdsJson (legacy default)", () => {
    const result = insertSpecialAssessmentSchema.safeParse({
      ...baseAssessment,
      excludedUnitIdsJson: [],
    });
    expect(result.success).toBe(true);
  });
});

describe("insertSpecialAssessmentSchema — new Q5/Q7 fields", () => {
  it("accepts loan-style detail fields when provided", () => {
    const result = insertSpecialAssessmentSchema.safeParse({
      ...baseAssessment,
      interestRatePercent: 4.5,
      termMonths: 60,
      allocationMethod: "per-sq-ft",
      paymentOptionsJson: {
        lumpSumAllowed: true,
        lumpSumDiscountPercent: 2.5,
        customInstallmentPlansAllowed: false,
      },
      unitScopeMode: "exclusion-list",
    });
    expect(result.success).toBe(true);
  });

  it("accepts null for nullable loan-style fields", () => {
    const result = insertSpecialAssessmentSchema.safeParse({
      ...baseAssessment,
      interestRatePercent: null,
      termMonths: null,
      allocationCustomJson: null,
      paymentOptionsJson: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid allocationMethod value", () => {
    const result = insertSpecialAssessmentSchema.safeParse({
      ...baseAssessment,
      allocationMethod: "bogus-method",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative interestRatePercent", () => {
    const result = insertSpecialAssessmentSchema.safeParse({
      ...baseAssessment,
      interestRatePercent: -1.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects allocationMethod='custom' without allocationCustomJson", () => {
    const result = insertSpecialAssessmentSchema.safeParse({
      ...baseAssessment,
      allocationMethod: "custom",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join("."));
      expect(paths).toContain("allocationCustomJson");
    }
  });

  it("accepts allocationMethod='custom' when allocationCustomJson is provided", () => {
    const result = insertSpecialAssessmentSchema.safeParse({
      ...baseAssessment,
      allocationMethod: "custom",
      allocationCustomJson: { "unit-1": 40, "unit-2": 60 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid unitScopeMode", () => {
    const result = insertSpecialAssessmentSchema.safeParse({
      ...baseAssessment,
      unitScopeMode: "not-a-mode",
    });
    expect(result.success).toBe(false);
  });
});

describe("insertRecurringChargeScheduleSchema — backward compatibility", () => {
  it("accepts a pre-Wave-6 shaped row without any Q7 fields", () => {
    const result = insertRecurringChargeScheduleSchema.safeParse({
      ...baseRecurring,
      frequency: "monthly",
      dayOfMonth: 1,
    });
    expect(result.success).toBe(true);
  });
});

describe("insertRecurringChargeScheduleSchema — new Q7 fields", () => {
  it("accepts the new canonical rule-model fields", () => {
    const result = insertRecurringChargeScheduleSchema.safeParse({
      ...baseRecurring,
      unitScopeMode: "inclusion-list",
      includedUnitIdsJson: ["unit-1", "unit-2"],
      unitTypeFilter: null,
      graceDays: 5,
      endDate: new Date("2027-01-01T00:00:00Z"),
    });
    expect(result.success).toBe(true);
  });

  it("rejects a negative graceDays", () => {
    const result = insertRecurringChargeScheduleSchema.safeParse({
      ...baseRecurring,
      graceDays: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid unitScopeMode", () => {
    const result = insertRecurringChargeScheduleSchema.safeParse({
      ...baseRecurring,
      unitScopeMode: "nonsense",
    });
    expect(result.success).toBe(false);
  });
});
