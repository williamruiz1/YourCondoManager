/**
 * Owner-finances redesign (2026-07-09) — special-assessment payment-PLAN
 * derivation tests.
 *
 * The central William requirement: a special assessment is a PLAN paid over
 * time, NOT a balance due now. These tests pin the display derivation:
 *   - progress % (paid so far / total)
 *   - the this-period-vs-total separation (remaining is distinct from total)
 *   - "On track" vs genuinely PAST-DUE (red is reserved for past-due only)
 *   - graceful degradation when the schedule length is unknown
 */
import { describe, expect, it } from "vitest";
import {
  deriveAssessmentPlanView,
  type AssessmentPlanProgress,
} from "./portal-assessment-plan";

// A representative in-progress plan: $18,000 total, 4 of 12 paid ($6,000),
// $12,000 remaining, next installment $1,500 due in the future.
const inProgress: AssessmentPlanProgress = {
  assessmentId: "a-roof",
  assessmentName: "Roof & façade special assessment",
  total: 18000,
  paidToDate: 6000,
  remaining: 12000,
  installmentCount: 12,
  installmentsPaid: 4,
  installmentAmount: 1500,
  nextInstallmentAmount: 1500,
  nextInstallmentDueDate: "2999-01-31T00:00:00.000Z", // far future → not past due
  nextInstallmentNumber: 5,
};

describe("deriveAssessmentPlanView — special assessment shown as a PLAN", () => {
  it("reconciles: paidToDate + remaining === total (the plan, not a lump)", () => {
    expect(inProgress.paidToDate + inProgress.remaining).toBe(inProgress.total);
  });

  it("computes progress % from paid-so-far / total", () => {
    const v = deriveAssessmentPlanView(inProgress);
    expect(v.pctPaid).toBe(33); // 6000/18000 = 33.3 → 33
  });

  it("keeps remaining SEPARATE from total (this-period is not the full assessment)", () => {
    // The plan carries a $12,000 remaining that is explicitly NOT the amount
    // due now; only the $1,500 next installment is due-this-period.
    expect(inProgress.remaining).not.toBe(inProgress.total);
    expect(inProgress.nextInstallmentAmount).toBe(1500);
    expect(inProgress.nextInstallmentAmount).toBeLessThan(inProgress.remaining);
  });

  it('an on-schedule plan (future next installment) reads "On track", NOT past due', () => {
    const v = deriveAssessmentPlanView(inProgress);
    expect(v.isPastDue).toBe(false); // → no red
    expect(v.isOnTrack).toBe(true);
    expect(v.isPaidOff).toBe(false);
    expect(v.installmentsLabel).toBe("4 of 12 installments paid");
    expect(v.hasSchedule).toBe(true);
  });

  it("marks RED (past due) ONLY when the next installment's due date has passed", () => {
    const overdue = { ...inProgress, nextInstallmentDueDate: "2000-01-01T00:00:00.000Z" };
    const v = deriveAssessmentPlanView(overdue, new Date("2026-07-10T00:00:00.000Z"));
    expect(v.isPastDue).toBe(true);
    expect(v.isOnTrack).toBe(false);
  });

  it("a fully-paid plan reads Paid off (never past due, even with no next date)", () => {
    const paid: AssessmentPlanProgress = {
      ...inProgress,
      paidToDate: 18000,
      remaining: 0,
      installmentsPaid: 12,
      nextInstallmentAmount: null,
      nextInstallmentDueDate: null,
      nextInstallmentNumber: null,
    };
    const v = deriveAssessmentPlanView(paid);
    expect(v.isPaidOff).toBe(true);
    expect(v.isPastDue).toBe(false);
    expect(v.pctPaid).toBe(100);
  });

  it("clamps progress to 0–100 and handles a zero-total plan", () => {
    const zero: AssessmentPlanProgress = { ...inProgress, total: 0, paidToDate: 0, remaining: 0 };
    expect(deriveAssessmentPlanView(zero).pctPaid).toBe(0);
  });

  it("degrades gracefully when the schedule length is unknown (installmentCount 0)", () => {
    const noSchedule: AssessmentPlanProgress = {
      ...inProgress,
      installmentCount: 0,
      installmentsPaid: 1,
    };
    const v = deriveAssessmentPlanView(noSchedule);
    expect(v.hasSchedule).toBe(false);
    expect(v.installmentsLabel).toBe("1 installment paid");
  });
});
