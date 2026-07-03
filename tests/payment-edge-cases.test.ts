/**
 * Payment edge-case math — partial / overpayment / refund on the owner ledger
 * (readiness P2-1 / Issue #216).
 *
 * `applyPayment` and `reversePayment` are pure over their inputs (current
 * ledger rows + an incoming payment / a row to reverse), so these tests need no
 * DB — same approach as the account-statement math tests.
 *
 * The invariant under test across every case:
 *
 *     newBalance === priorBalance + Σ(returned entry amounts)
 *
 * and the money-correctness rules:
 *   - PARTIAL: payment < owed → balance stays positive (remaining due).
 *   - EXACT: payment == owed → balance 0.
 *   - OVERPAYMENT: payment > owed → credit on account (balance < 0), carries forward.
 *   - REFUND: equal-and-opposite adjustment restores the balance, forward-only.
 */
import { describe, expect, it } from "vitest";
import {
  applyPayment,
  reversePayment,
  computeBalance,
  balanceAfter,
  CHARGE_TYPES,
  CREDIT_TYPES,
  type LedgerEntryLike,
} from "../server/services/payment-edge-cases";

const POSTED = new Date("2026-04-15T12:00:00.000Z");

function entry(
  id: string,
  entryType: LedgerEntryLike["entryType"],
  amount: number,
  postedAt = "2026-04-01T12:00:00.000Z",
): LedgerEntryLike {
  return { id, entryType, amount, postedAt: new Date(postedAt) };
}

// A standard owner who owes $300 (a $250 assessment + a $50 late fee).
function owes300(): LedgerEntryLike[] {
  return [
    entry("a1", "assessment", 250),
    entry("lf1", "late-fee", 50),
  ];
}

describe("computeBalance — signed-sum semantics", () => {
  it("positive balance = owes", () => {
    expect(computeBalance(owes300())).toBe(300);
  });
  it("zero balance = square", () => {
    expect(
      computeBalance([entry("a", "charge", 100), entry("p", "payment", -100)]),
    ).toBe(0);
  });
  it("negative balance = credit on account", () => {
    expect(
      computeBalance([entry("a", "charge", 100), entry("p", "payment", -175)]),
    ).toBe(-75);
  });
  it("empty ledger = 0", () => {
    expect(computeBalance([])).toBe(0);
  });
  it("charge/credit type sets are disjoint and complete", () => {
    for (const t of CHARGE_TYPES) expect(CREDIT_TYPES.has(t)).toBe(false);
    expect(CHARGE_TYPES.size + CREDIT_TYPES.size).toBe(6);
  });
});

// ── PARTIAL PAYMENT ──────────────────────────────────────────────────────────

describe("applyPayment — PARTIAL (payment < owed)", () => {
  it("$100 against $300 owed leaves $200 remaining", () => {
    const r = applyPayment({ entries: owes300(), paymentAmount: 100, postedAt: POSTED });
    expect(r.kind).toBe("partial");
    expect(r.priorBalance).toBe(300);
    expect(r.appliedToBalance).toBe(100);
    expect(r.creditCreated).toBe(0);
    expect(r.newBalance).toBe(200);
    expect(r.remainingDue).toBe(200);
    // The row is a negative payment.
    expect(r.entry.entryType).toBe("payment");
    expect(r.entry.amount).toBe(-100);
    // Invariant.
    expect(balanceAfter(owes300(), r.entry)).toBe(r.newBalance);
    expect(r.newBalance).toBe(r.priorBalance + r.entry.amount);
  });

  it("description surfaces the remaining due", () => {
    const r = applyPayment({ entries: owes300(), paymentAmount: 100, postedAt: POSTED });
    expect(r.entry.description).toContain("200.00 remaining");
  });

  it("a sequence of partials never overshoots and finally squares", () => {
    let ledger = owes300();
    const r1 = applyPayment({ entries: ledger, paymentAmount: 120, postedAt: POSTED });
    expect(r1.kind).toBe("partial");
    ledger = [...ledger, { id: "p1", ...toRow(r1.entry) }];
    expect(computeBalance(ledger)).toBe(180);

    const r2 = applyPayment({ entries: ledger, paymentAmount: 180, postedAt: POSTED });
    expect(r2.kind).toBe("exact");
    ledger = [...ledger, { id: "p2", ...toRow(r2.entry) }];
    expect(computeBalance(ledger)).toBe(0);
  });
});

// ── EXACT PAYMENT ────────────────────────────────────────────────────────────

describe("applyPayment — EXACT (payment == owed)", () => {
  it("$300 against $300 owed → balance 0", () => {
    const r = applyPayment({ entries: owes300(), paymentAmount: 300, postedAt: POSTED });
    expect(r.kind).toBe("exact");
    expect(r.appliedToBalance).toBe(300);
    expect(r.creditCreated).toBe(0);
    expect(r.newBalance).toBe(0);
    expect(r.remainingDue).toBe(0);
    expect(r.entry.amount).toBe(-300);
    expect(balanceAfter(owes300(), r.entry)).toBe(0);
  });
});

// ── OVERPAYMENT ──────────────────────────────────────────────────────────────

describe("applyPayment — OVERPAYMENT (payment > owed)", () => {
  it("$350 against $300 owed → $50 credit on account, balance −50", () => {
    const r = applyPayment({ entries: owes300(), paymentAmount: 350, postedAt: POSTED });
    expect(r.kind).toBe("overpayment");
    expect(r.priorBalance).toBe(300);
    expect(r.appliedToBalance).toBe(300); // only $300 retired the receivable
    expect(r.creditCreated).toBe(50); // $50 becomes a carry-forward credit
    expect(r.newBalance).toBe(-50); // negative === credit on account
    expect(r.remainingDue).toBe(0);
    expect(r.entry.amount).toBe(-350);
    expect(balanceAfter(owes300(), r.entry)).toBe(-50);
  });

  it("the credit carries forward against the NEXT charge automatically", () => {
    // Owner overpays into a −50 credit, then a new $80 assessment posts.
    const r = applyPayment({ entries: owes300(), paymentAmount: 350, postedAt: POSTED });
    let ledger: LedgerEntryLike[] = [...owes300(), { id: "p", ...toRow(r.entry) }];
    expect(computeBalance(ledger)).toBe(-50);

    ledger = [...ledger, entry("a2", "assessment", 80, "2026-05-01T12:00:00.000Z")];
    // New balance = −50 + 80 = 30 (the credit was applied to the new charge).
    expect(computeBalance(ledger)).toBe(30);
  });

  it("paying when the owner ALREADY has a credit is pure overpayment", () => {
    const credited: LedgerEntryLike[] = [entry("c", "credit", -40)]; // −40 balance
    const r = applyPayment({ entries: credited, paymentAmount: 60, postedAt: POSTED });
    expect(r.kind).toBe("overpayment");
    expect(r.priorBalance).toBe(-40);
    expect(r.appliedToBalance).toBe(0); // nothing was owed
    expect(r.creditCreated).toBe(60); // entire payment is credit
    expect(r.newBalance).toBe(-100);
  });

  it("description surfaces applied vs credit split", () => {
    const r = applyPayment({ entries: owes300(), paymentAmount: 350, postedAt: POSTED });
    expect(r.entry.description).toContain("300.00 applied");
    expect(r.entry.description).toContain("50.00 credit");
  });
});

// ── REFUND / REVERSAL ────────────────────────────────────────────────────────

describe("reversePayment — REFUND (clean reversal restores balance)", () => {
  it("full refund of a $200 payment restores the owed balance, forward-only", () => {
    // Owner owed $300, paid $200 (balance now $100).
    const pay = entry("p1", "payment", -200);
    const ledger: LedgerEntryLike[] = [...owes300(), pay];
    expect(computeBalance(ledger)).toBe(100);

    const r = reversePayment({ entries: ledger, target: pay, postedAt: POSTED });
    expect(r.priorBalance).toBe(100);
    expect(r.amountReversed).toBe(200);
    expect(r.reversedEntryId).toBe("p1");
    expect(r.newBalance).toBe(300); // balance restored to the full $300 owed
    // Reversal is a POSITIVE adjustment (forward-only — original row untouched).
    expect(r.entry.entryType).toBe("adjustment");
    expect(r.entry.amount).toBe(200);
    expect(r.entry.referenceId).toBe("p1"); // links the pair
    // The pair nets to zero.
    expect(pay.amount + r.entry.amount).toBe(0);
    // Invariant.
    expect(balanceAfter(ledger, r.entry)).toBe(300);
  });

  it("refunding an OVERPAYMENT credit pulls the balance back toward zero", () => {
    // Owner overpaid into a −50 credit.
    const overpay = entry("op", "payment", -350);
    const ledger: LedgerEntryLike[] = [...owes300(), overpay];
    expect(computeBalance(ledger)).toBe(-50);

    // Refund the whole $350 payment.
    const r = reversePayment({ entries: ledger, target: overpay, postedAt: POSTED });
    expect(r.amountReversed).toBe(350);
    expect(r.newBalance).toBe(300); // back to owing the original $300
    expect(balanceAfter(ledger, r.entry)).toBe(300);
  });

  it("PARTIAL refund reverses only part of the original payment", () => {
    const pay = entry("p1", "payment", -200);
    const ledger: LedgerEntryLike[] = [...owes300(), pay]; // balance 100
    const r = reversePayment({ entries: ledger, target: pay, amount: 50, postedAt: POSTED });
    expect(r.amountReversed).toBe(50);
    expect(r.entry.amount).toBe(50);
    expect(r.newBalance).toBe(150); // 100 + 50 restored
    expect(r.entry.description).toContain("Partial refund");
  });

  it("rejects a refund larger than the original payment", () => {
    const pay = entry("p1", "payment", -200);
    const ledger: LedgerEntryLike[] = [...owes300(), pay];
    expect(() =>
      reversePayment({ entries: ledger, target: pay, amount: 250, postedAt: POSTED }),
    ).toThrow(/exceeds original/);
  });

  it("rejects reversing a charge-side entry", () => {
    const charge = entry("a1", "assessment", 250);
    expect(() =>
      reversePayment({ entries: owes300(), target: charge, postedAt: POSTED }),
    ).toThrow(/Can only reverse a credit-side entry/);
  });

  it("rejects reversing a positive adjustment (charge-side correction)", () => {
    const posAdj = entry("adj", "adjustment", 30); // a charge-side correction
    expect(() =>
      reversePayment({ entries: [posAdj], target: posAdj, postedAt: POSTED }),
    ).toThrow(/positive/);
  });

  it("the original entry is never mutated (forward-only)", () => {
    const pay = entry("p1", "payment", -200);
    const ledger: LedgerEntryLike[] = [...owes300(), pay];
    reversePayment({ entries: ledger, target: pay, postedAt: POSTED });
    expect(pay.amount).toBe(-200); // unchanged
    expect(pay.entryType).toBe("payment");
  });
});

// ── GUARDS ───────────────────────────────────────────────────────────────────

describe("applyPayment — input guards", () => {
  it("rejects a zero payment", () => {
    expect(() =>
      applyPayment({ entries: owes300(), paymentAmount: 0, postedAt: POSTED }),
    ).toThrow(/positive/);
  });
  it("rejects a negative payment", () => {
    expect(() =>
      applyPayment({ entries: owes300(), paymentAmount: -10, postedAt: POSTED }),
    ).toThrow(/positive/);
  });
  it("rejects a non-finite (NaN) payment", () => {
    // Caller passes the money received as a positive figure; we require a
    // positive, finite number and refuse anything else.
    expect(() =>
      applyPayment({ entries: owes300(), paymentAmount: Number.NaN, postedAt: POSTED }),
    ).toThrow(/positive/);
  });
});

// ── FLOATING-POINT / CENTS ───────────────────────────────────────────────────

describe("cent-precision rounding", () => {
  it("avoids float drift across partial → over sequence", () => {
    // $0.10 + $0.20 against a $0.30 charge → exact, balance 0 (no 0.3000000004).
    const ledger: LedgerEntryLike[] = [entry("c", "charge", 0.3)];
    const r1 = applyPayment({ entries: ledger, paymentAmount: 0.1, postedAt: POSTED });
    const after1: LedgerEntryLike[] = [...ledger, { id: "p1", ...toRow(r1.entry) }];
    expect(computeBalance(after1)).toBe(0.2);
    const r2 = applyPayment({ entries: after1, paymentAmount: 0.2, postedAt: POSTED });
    expect(r2.kind).toBe("exact");
    expect(r2.newBalance).toBe(0);
  });

  it("overpayment credit is rounded to cents", () => {
    const ledger: LedgerEntryLike[] = [entry("c", "charge", 99.99)];
    const r = applyPayment({ entries: ledger, paymentAmount: 100, postedAt: POSTED });
    expect(r.creditCreated).toBe(0.01);
    expect(r.newBalance).toBe(-0.01);
  });
});

// ── helper to turn a proposed entry into a ledger-row-like for chaining ──────
function toRow(p: {
  entryType: string;
  amount: number;
  postedAt: Date;
}): Omit<LedgerEntryLike, "id"> {
  return { entryType: p.entryType, amount: p.amount, postedAt: p.postedAt };
}
