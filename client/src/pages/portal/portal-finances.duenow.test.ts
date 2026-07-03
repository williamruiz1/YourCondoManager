/**
 * Owner-finances rework (2026-06-30) — pure-logic tests.
 *
 * Covers:
 *   - `ledgerTypeLabel`  — raw entryType → human owner-facing label
 *     (William finding #5: "charge" must read as "HOA Dues").
 *   - `computeDueNow`    — separate HOA dues from special-assessment
 *     INSTALLMENTS, and show only what's due now — NOT the full assessment
 *     lump (William finding #3: an $80k driveway assessment is not all due
 *     at once).
 */
import { describe, expect, it } from "vitest";
import { ledgerTypeLabel, computeDueNow } from "./portal-finances";

describe("ledgerTypeLabel — human owner-facing type labels", () => {
  it('maps "charge" → "HOA Dues" (the core William finding #5 fix)', () => {
    expect(ledgerTypeLabel("charge")).toBe("HOA Dues");
  });
  it('maps "assessment" → "Special Assessment"', () => {
    expect(ledgerTypeLabel("assessment")).toBe("Special Assessment");
  });
  it("maps the remaining known types to plain labels", () => {
    expect(ledgerTypeLabel("late-fee")).toBe("Late Fee");
    expect(ledgerTypeLabel("payment")).toBe("Payment");
    expect(ledgerTypeLabel("credit")).toBe("Credit");
    expect(ledgerTypeLabel("adjustment")).toBe("Adjustment");
  });
  it("never renders the raw kebab/lowercase token for a known type", () => {
    expect(ledgerTypeLabel("charge")).not.toBe("charge");
    expect(ledgerTypeLabel("late-fee")).not.toContain("-");
  });
  it("falls back to Title Case for an unmapped/future type", () => {
    expect(ledgerTypeLabel("special-fee")).toBe("Special Fee");
  });
});

describe("computeDueNow — dues vs assessment-installment separation", () => {
  it("dues-due = positive charge + late-fee across units; assessments EXCLUDED", () => {
    const byUnit = [
      { byCategory: { charge: 330, assessment: 80000, "late-fee": 25 } },
    ];
    const r = computeDueNow(byUnit, []);
    // 330 dues + 25 late fee. The $80,000 assessment lump is NOT in dues-due.
    expect(r.duesDue).toBe(355);
    expect(r.assessmentInstallmentDue).toBe(0);
    expect(r.totalDueNow).toBe(355);
  });

  it("assessment shows only the INSTALLMENT due now, not the full lump", () => {
    // An $80k assessment billed in installments of $2,000 — only $2,000 is due.
    const byUnit = [{ byCategory: { charge: 330, assessment: 80000 } }];
    const upcoming = [{ installmentAmount: 2000 }];
    const r = computeDueNow(byUnit, upcoming);
    expect(r.duesDue).toBe(330);
    expect(r.assessmentInstallmentDue).toBe(2000); // NOT 80000
    expect(r.totalDueNow).toBe(2330);
  });

  it("sums installments across multiple upcoming items", () => {
    const r = computeDueNow(
      [{ byCategory: { charge: 100 } }],
      [{ installmentAmount: 250 }, { installmentAmount: 250 }],
    );
    expect(r.assessmentInstallmentDue).toBe(500);
    expect(r.totalDueNow).toBe(600);
  });

  it("ignores negative/credit category balances in dues-due", () => {
    const byUnit = [{ byCategory: { charge: -50, "late-fee": 0 } }];
    const r = computeDueNow(byUnit, []);
    expect(r.duesDue).toBe(0); // a credit does not increase what's due
  });

  it("aggregates dues across multiple units", () => {
    const byUnit = [
      { byCategory: { charge: 330 } },
      { byCategory: { charge: 150, "late-fee": 20 } },
    ];
    const r = computeDueNow(byUnit, []);
    expect(r.duesDue).toBe(500);
    expect(r.totalDueNow).toBe(500);
  });

  it("empty inputs → all zero", () => {
    expect(computeDueNow([], [])).toEqual({
      duesDue: 0,
      assessmentInstallmentDue: 0,
      totalDueNow: 0,
    });
  });
});
