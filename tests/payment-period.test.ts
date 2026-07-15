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
  computeArrears,
  toOverdueFromPriorPeriods,
  DEFAULT_QUARTERLY_GRACE_DAYS,
  type PaymentPlanInput,
  type ArrearsInput,
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

// ---------------------------------------------------------------------------
// computeArrears — "overdue from prior periods" (2026-07-14 My Finances
// redesign). Originating ratification: PR #515 wireframe — `resolveAmountDue`
// only ever answered "what's due this period"; it never checked whether
// PRIOR periods were actually paid, so an owner behind on a monthly plan
// could see "nothing overdue / on track" (false). These tests cover the four
// money-adjacent scenarios named in the build ask: missed prior month,
// quarterly plan, paid-in-full, partial payment.
// ---------------------------------------------------------------------------

const baseMonthlyArrearsPlan: ArrearsInput = {
  status: "active",
  installmentAmount: 300,
  installmentFrequency: "monthly",
  nextDueDate: null,
  startDate: "2026-01-01T12:00:00.000Z",
  totalAmount: 3600,
  amountPaid: 0,
};

const baseQuarterlyArrearsPlan: ArrearsInput = {
  status: "active",
  installmentAmount: 750,
  installmentFrequency: "quarterly",
  nextDueDate: null,
  startDate: "2026-01-01T12:00:00.000Z",
  totalAmount: 9000,
  amountPaid: 0,
};

describe("computeArrears — no-plan / inactive", () => {
  it("returns zero arrears when plan is null", () => {
    const res = computeArrears(null, new Date("2026-05-25T12:00:00.000Z"));
    expect(res.overdueAmount).toBe(0);
    expect(res.overdueInstallments).toBe(0);
    expect(toOverdueFromPriorPeriods(res)).toBeNull();
  });

  it("returns zero arrears when the plan is not active", () => {
    const res = computeArrears(
      { ...baseMonthlyArrearsPlan, status: "completed", amountPaid: 0 },
      new Date("2026-05-25T12:00:00.000Z"),
    );
    expect(res.overdueAmount).toBe(0);
  });

  it("returns zero arrears when the installment amount is zero/invalid", () => {
    const res = computeArrears(
      { ...baseMonthlyArrearsPlan, installmentAmount: 0 },
      new Date("2026-05-25T12:00:00.000Z"),
    );
    expect(res.overdueAmount).toBe(0);
  });
});

describe("computeArrears — missed prior month (monthly plan)", () => {
  it("2 full months elapsed, nothing paid → 2 installments overdue", () => {
    // Plan started Jan 2026; "now" is March 15 — Jan and Feb have fully
    // closed, March is the current (still-open) period, handled separately
    // by resolveAmountDue.
    const res = computeArrears(
      baseMonthlyArrearsPlan,
      new Date("2026-03-15T12:00:00.000Z"),
    );
    expect(res.expectedPaidByNow).toBe(600); // 2 x $300
    expect(res.overdueAmount).toBe(600);
    expect(res.overdueInstallments).toBe(2);
  });

  it("plan started this same month → 0 prior periods, no arrears", () => {
    const res = computeArrears(
      baseMonthlyArrearsPlan,
      new Date("2026-01-20T12:00:00.000Z"),
    );
    expect(res.expectedPaidByNow).toBe(0);
    expect(res.overdueAmount).toBe(0);
    expect(res.overdueInstallments).toBe(0);
  });
});

describe("computeArrears — quarterly plan", () => {
  it("1 full quarter elapsed, nothing paid → 1 installment overdue", () => {
    // Plan started Q1 2026 (Jan); "now" is in Q2 (May) — Q1 has closed, Q2
    // is current.
    const res = computeArrears(
      baseQuarterlyArrearsPlan,
      new Date("2026-05-10T12:00:00.000Z"),
    );
    expect(res.expectedPaidByNow).toBe(750);
    expect(res.overdueAmount).toBe(750);
    expect(res.overdueInstallments).toBe(1);
  });

  it("2 full quarters elapsed, nothing paid → 2 installments overdue", () => {
    // Q1 and Q2 have closed by August (Q3).
    const res = computeArrears(
      baseQuarterlyArrearsPlan,
      new Date("2026-08-01T12:00:00.000Z"),
    );
    expect(res.expectedPaidByNow).toBe(1500);
    expect(res.overdueAmount).toBe(1500);
    expect(res.overdueInstallments).toBe(2);
  });
});

describe("computeArrears — paid in full (no false positive)", () => {
  it("amountPaid matches expected cumulative → zero arrears", () => {
    const res = computeArrears(
      { ...baseMonthlyArrearsPlan, amountPaid: 600 },
      new Date("2026-03-15T12:00:00.000Z"),
    );
    expect(res.overdueAmount).toBe(0);
    expect(res.overdueInstallments).toBe(0);
    expect(toOverdueFromPriorPeriods(res)).toBeNull();
  });

  it("amountPaid exceeds expected cumulative (ahead of schedule) → zero arrears, never negative", () => {
    const res = computeArrears(
      { ...baseMonthlyArrearsPlan, amountPaid: 900 },
      new Date("2026-03-15T12:00:00.000Z"),
    );
    expect(res.overdueAmount).toBe(0);
  });
});

describe("computeArrears — partial payment", () => {
  it("owner paid part of what was expected → the shortfall is overdue", () => {
    // 2 months expected ($600); owner paid $450 → $150 short.
    const res = computeArrears(
      { ...baseMonthlyArrearsPlan, amountPaid: 450 },
      new Date("2026-03-15T12:00:00.000Z"),
    );
    expect(res.overdueAmount).toBe(150);
    // Less than a full installment is overdue, but something is — rounds to
    // 1 "payment" for the "N payments past due" chip rather than 0.
    expect(res.overdueInstallments).toBe(1);
    expect(toOverdueFromPriorPeriods(res)).toEqual({ amount: 150, installmentsOverdue: 1 });
  });
});

describe("computeArrears — capped at totalAmount", () => {
  it("never reports more overdue than the plan's total, even many periods late", () => {
    const res = computeArrears(
      { ...baseMonthlyArrearsPlan, totalAmount: 500, amountPaid: 0 },
      new Date("2027-01-15T12:00:00.000Z"), // a full year+ elapsed
    );
    expect(res.expectedPaidByNow).toBe(500); // capped, not 12 x $300
    expect(res.overdueAmount).toBe(500);
  });
});

describe("computeArrears — annual / unknown frequency (conservative no-op)", () => {
  it("does not fabricate a cadence for annual plans — reports zero arrears", () => {
    const res = computeArrears(
      {
        status: "active",
        installmentAmount: 3000,
        installmentFrequency: "annual",
        nextDueDate: null,
        startDate: "2020-01-01T12:00:00.000Z",
        totalAmount: 3000,
        amountPaid: 0,
      },
      new Date("2026-05-25T12:00:00.000Z"),
    );
    expect(res.overdueAmount).toBe(0);
  });
});

describe("toOverdueFromPriorPeriods", () => {
  it("returns null when overdueAmount is zero", () => {
    expect(toOverdueFromPriorPeriods({ overdueAmount: 0, overdueInstallments: 0, expectedPaidByNow: 0 })).toBeNull();
  });
  it("returns the wire shape when overdueAmount is positive", () => {
    expect(
      toOverdueFromPriorPeriods({ overdueAmount: 620.5, overdueInstallments: 2, expectedPaidByNow: 620.5 }),
    ).toEqual({ amount: 620.5, installmentsOverdue: 2 });
  });
});
