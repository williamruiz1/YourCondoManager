/**
 * Unit tests for the plan-aware "Amount due this period" resolver.
 *
 * Originating ratification: William live-session feedback 2026-05-25 —
 *   *"if it's on the quarterly plan, then it shouldn't show due until that
 *   quarter is up."*
 *
 * Invariants under test:
 *   - No plan → not due (UI falls back to "Pay full balance")
 *   - Inactive plan → not due
 *   - Monthly plan → ALWAYS due in current calendar month
 *   - Quarterly plan, mid-quarter → not due (the critical William case)
 *   - Quarterly plan, last 30 days of quarter → due
 *   - Quarterly with explicit `nextDueDate` honors that date
 *   - Annual / unknown frequency → fall back to `nextDueDate` grace window
 */

import { describe, it, expect } from "vitest";
import {
  resolveAmountDue,
  toAmountDueThisPeriod,
  DEFAULT_QUARTERLY_GRACE_DAYS,
  type PaymentPlanInput,
} from "../shared/payment-period";

const baseMonthlyPlan: PaymentPlanInput = {
  status: "active",
  installmentAmount: 250,
  installmentFrequency: "monthly",
  nextDueDate: null,
  startDate: "2026-01-01T00:00:00.000Z",
};

const baseQuarterlyPlan: PaymentPlanInput = {
  status: "active",
  installmentAmount: 750,
  installmentFrequency: "quarterly",
  nextDueDate: null,
  startDate: "2026-01-01T00:00:00.000Z",
};

describe("resolveAmountDue — no-plan / inactive", () => {
  it("returns not-due with reason 'no-plan' when plan is null", () => {
    const res = resolveAmountDue(null, new Date("2026-05-25T12:00:00.000Z"));
    expect(res.due).toBe(false);
    expect(res.amount).toBe(0);
    expect(res.reason).toBe("no-plan");
    expect(toAmountDueThisPeriod(res)).toBeNull();
  });

  it("returns not-due with reason 'plan-inactive' when status is not active", () => {
    const res = resolveAmountDue(
      { ...baseMonthlyPlan, status: "completed" },
      new Date("2026-05-25T12:00:00.000Z"),
    );
    expect(res.due).toBe(false);
    expect(res.reason).toBe("plan-inactive");
    expect(toAmountDueThisPeriod(res)).toBeNull();
  });
});

describe("resolveAmountDue — monthly plan", () => {
  it("is ALWAYS due in the current calendar month with the monthly installment", () => {
    const res = resolveAmountDue(baseMonthlyPlan, new Date("2026-05-25T12:00:00.000Z"));
    expect(res.due).toBe(true);
    expect(res.amount).toBe(250);
    expect(res.frequency).toBe("monthly");
    expect(res.periodLabel).toMatch(/May 2026/);
    expect(res.reason).toBe("due");
  });

  it("uses end-of-month as periodEnd when no explicit nextDueDate", () => {
    // Pick a mid-month local-time date so end-of-month math is unambiguous
    // regardless of the test runner's timezone.
    const res = resolveAmountDue(baseMonthlyPlan, new Date(2026, 4, 15, 12, 0, 0));
    expect(res.periodEnd).toBeTruthy();
    const endDate = new Date(res.periodEnd!);
    expect(endDate.getMonth()).toBe(4); // May (0-indexed)
    expect(endDate.getFullYear()).toBe(2026);
    expect(endDate.getDate()).toBe(31);
  });

  it("API projection returns a populated AmountDueThisPeriod object", () => {
    const res = resolveAmountDue(baseMonthlyPlan, new Date("2026-05-25T12:00:00.000Z"));
    const wire = toAmountDueThisPeriod(res);
    expect(wire).not.toBeNull();
    expect(wire?.amount).toBe(250);
    expect(wire?.frequency).toBe("monthly");
  });
});

describe("resolveAmountDue — quarterly plan (the William case)", () => {
  // William verbatim: "if it's on the quarterly plan, then it shouldn't
  // show due until that quarter is up". The grace window default is 30 days
  // before quarter-end.

  it("MID-QUARTER: returns not-due with reason 'quarter-not-closing'", () => {
    // Q2 2026 = Apr–Jun. Mid-quarter = May 1 in local time.
    const res = resolveAmountDue(baseQuarterlyPlan, new Date(2026, 4, 1, 12, 0, 0));
    expect(res.due).toBe(false);
    expect(res.amount).toBe(0);
    expect(res.reason).toBe("quarter-not-closing");
    expect(res.periodLabel).toBe("Q2 2026");
    // periodEnd is still surfaced so UI can render "due by June 30".
    const endDate = new Date(res.periodEnd!);
    expect(endDate.getMonth()).toBe(5); // June (0-indexed)
    expect(endDate.getDate()).toBe(30);
    expect(toAmountDueThisPeriod(res)).toBeNull();
  });

  it("EARLY QUARTER: returns not-due (also outside grace window)", () => {
    // Q2 2026 begins Apr 1. Apr 5 is ~86 days from Jun 30 — outside grace.
    const res = resolveAmountDue(baseQuarterlyPlan, new Date(2026, 3, 5, 12, 0, 0));
    expect(res.due).toBe(false);
    expect(res.reason).toBe("quarter-not-closing");
  });

  it("LAST 30 DAYS OF QUARTER: returns due with the quarterly installment", () => {
    // Jun 15 is ~15 days from Q2 end (Jun 30) — inside the 30-day grace.
    const res = resolveAmountDue(baseQuarterlyPlan, new Date(2026, 5, 15, 12, 0, 0));
    expect(res.due).toBe(true);
    expect(res.amount).toBe(750);
    expect(res.frequency).toBe("quarterly");
    expect(res.reason).toBe("due");
    expect(res.periodLabel).toBe("Q2 2026");
  });

  it("ON QUARTER-END DAY: returns due", () => {
    const res = resolveAmountDue(baseQuarterlyPlan, new Date(2026, 5, 30, 8, 0, 0));
    expect(res.due).toBe(true);
    expect(res.amount).toBe(750);
  });

  it("respects an explicit nextDueDate when set and within grace", () => {
    const res = resolveAmountDue(
      { ...baseQuarterlyPlan, nextDueDate: new Date(2026, 5, 30, 0, 0, 0).toISOString() },
      new Date(2026, 5, 15, 12, 0, 0),
    );
    expect(res.due).toBe(true);
    expect(res.amount).toBe(750);
  });

  it("respects an explicit nextDueDate that is BEYOND grace (defers)", () => {
    // nextDueDate far in the future → not due now.
    const res = resolveAmountDue(
      { ...baseQuarterlyPlan, nextDueDate: new Date(2026, 8, 30, 0, 0, 0).toISOString() },
      new Date(2026, 4, 1, 12, 0, 0),
    );
    expect(res.due).toBe(false);
    expect(res.reason).toBe("before-next-due-date");
  });

  it("custom grace window can shrink/expand the surface window", () => {
    // With a 7-day grace, May 25 (36 days from Jun 30) is outside grace.
    const tight = resolveAmountDue(
      baseQuarterlyPlan,
      new Date(2026, 4, 25, 12, 0, 0),
      { quarterlyGraceDays: 7 },
    );
    expect(tight.due).toBe(false);

    // With a 90-day grace, May 1 (60 days from Jun 30) IS inside grace.
    const wide = resolveAmountDue(
      baseQuarterlyPlan,
      new Date(2026, 4, 1, 12, 0, 0),
      { quarterlyGraceDays: 90 },
    );
    expect(wide.due).toBe(true);
  });
});

describe("resolveAmountDue — annual / other", () => {
  it("annual plan with future nextDueDate: not due", () => {
    const res = resolveAmountDue(
      {
        status: "active",
        installmentAmount: 3000,
        installmentFrequency: "annual",
        nextDueDate: "2026-12-31T00:00:00.000Z",
      },
      new Date("2026-05-25T12:00:00.000Z"),
    );
    expect(res.due).toBe(false);
    expect(res.reason).toBe("before-next-due-date");
  });

  it("annual plan with nextDueDate inside grace: due", () => {
    const res = resolveAmountDue(
      {
        status: "active",
        installmentAmount: 3000,
        installmentFrequency: "annual",
        nextDueDate: "2026-06-10T00:00:00.000Z",
      },
      new Date("2026-05-25T12:00:00.000Z"),
    );
    expect(res.due).toBe(true);
    expect(res.amount).toBe(3000);
  });
});

describe("DEFAULT_QUARTERLY_GRACE_DAYS", () => {
  it("is 30 days as documented", () => {
    expect(DEFAULT_QUARTERLY_GRACE_DAYS).toBe(30);
  });
});
