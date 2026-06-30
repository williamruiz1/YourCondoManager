/**
 * Vendor-expense / accounts-payable money-loop invariant suite
 * (YCM Financial Core — Phase 4).
 *
 * Audit anchor:  docs/financial-completeness-and-quickbooks-migration-2026-06-30.md
 *                Gap #1 — vendor expenses → GL (THE #1-ranked blocker).
 * Build anchor:  founder-os#8171.
 *
 * Pure-function suite — no DB. THIS IS THE PHASE-4 ACCEPTANCE GATE. It proves the
 * requirements that define "done" for the vendor-expense → GL keystone:
 *   R2a. a recorded bill posts balanced (DR Expense == CR Accounts Payable)
 *   R2b. the 2000 A/P liability APPEARS (== bill) on a received/approved bill
 *   R2c. paying a bill CLEARS the 2000 A/P to EXACTLY 0¢ (expense stays, cash ↓)
 *   R2d. draft / void / zero-amount bills produce NO journals
 *   R2e. category → 5xxx expense account mapping (known + fallback)
 *   R2f. every journal + the whole corpus balances (Σdebit == Σcredit)
 *   R2g. interfund nets to zero (operating-only loop)
 *   R2h. re-deriving from the same invoice is stable (idempotent journalIds)
 *   R2i. negative / fractional cents are rejected fail-loud
 */

import { describe, it, expect } from "vitest";
import {
  postVendorInvoice,
  postVendorInvoices,
  accountsPayableCents,
  totalExpenseCents,
  expenseAccountForCategory,
  validateInvariants,
  VENDOR_GL_CODES,
  type VendorInvoiceMoneyLike,
} from "../gl/vendor-posting";
import { isJournalBalanced } from "../gl/posting";

const at = (d: string) => new Date(`${d}T00:00:00Z`);

/** A landscaping bill: $1,000.00. */
const BILL_CENTS = 100000;

function bill(overrides: Partial<VendorInvoiceMoneyLike> = {}): VendorInvoiceMoneyLike {
  return {
    id: "inv-landscaping-1",
    amountCents: BILL_CENTS,
    status: "approved",
    categoryName: "Landscaping",
    postedAt: at("2026-06-30"),
    description: "Green Thumb LLC — June grounds",
    ...overrides,
  };
}

describe("ACCEPTANCE GATE — vendor bill: expense + A/P appear → payment clears A/P to 0¢", () => {
  it("R2a/R2b: a recorded (approved) bill posts balanced DR Expense / CR A/P and A/P appears", () => {
    const journals = postVendorInvoice(bill());
    const billJ = journals.find((j) => j.journalId.startsWith("ven-bill-"))!;
    expect(billJ).toBeDefined();
    expect(isJournalBalanced(billJ)).toBe(true);
    // expense leg is a debit to a 5xxx account
    const expLeg = billJ.legs.find((l) => l.accountCode.startsWith("5"))!;
    expect(expLeg.side).toBe("debit");
    expect(expLeg.amountCents).toBe(BILL_CENTS);
    // A/P leg is a credit to 2000
    const apLeg = billJ.legs.find((l) => l.accountCode === VENDOR_GL_CODES.ACCOUNTS_PAYABLE)!;
    expect(apLeg.side).toBe("credit");
    expect(apLeg.amountCents).toBe(BILL_CENTS);
    // derived balances
    expect(accountsPayableCents(journals)).toBe(BILL_CENTS);
    expect(totalExpenseCents(journals)).toBe(BILL_CENTS);
    // only the bill journal exists for an unpaid bill
    expect(journals.filter((j) => j.journalId.startsWith("ven-pay-"))).toHaveLength(0);
  });

  it("R2b: a 'received' (not yet approved) bill also records the expense + A/P", () => {
    const journals = postVendorInvoice(bill({ status: "received" }));
    expect(accountsPayableCents(journals)).toBe(BILL_CENTS);
    expect(totalExpenseCents(journals)).toBe(BILL_CENTS);
  });

  it("R2c: PAYING the bill adds a DR A/P / CR Cash payment journal that clears A/P to EXACTLY 0¢ (expense stays)", () => {
    const journals = postVendorInvoice(bill({ status: "paid" }));
    const payJ = journals.find((j) => j.journalId.startsWith("ven-pay-"))!;
    expect(payJ).toBeDefined();
    expect(isJournalBalanced(payJ)).toBe(true);
    expect(payJ.legs.find((l) => l.accountCode === VENDOR_GL_CODES.ACCOUNTS_PAYABLE)?.side).toBe("debit");
    expect(payJ.legs.find((l) => l.accountCode === VENDOR_GL_CODES.CASH)?.side).toBe("credit");
    // A/P nets to zero once paid; expense persists; cash fell by the bill amount.
    expect(accountsPayableCents(journals)).toBe(0);
    expect(totalExpenseCents(journals)).toBe(BILL_CENTS);
    const cashCredit = journals
      .flatMap((j) => j.legs)
      .filter((l) => l.accountCode === VENDOR_GL_CODES.CASH && l.side === "credit")
      .reduce((s, l) => s + l.amountCents, 0);
    expect(cashCredit).toBe(BILL_CENTS);
  });

  it("R2d: draft / void / zero-amount bills produce NO journals (a balanced no-op)", () => {
    expect(postVendorInvoice(bill({ status: "draft" }))).toHaveLength(0);
    expect(postVendorInvoice(bill({ status: "void" }))).toHaveLength(0);
    expect(postVendorInvoice(bill({ amountCents: 0 }))).toHaveLength(0);
    // a paid bill that was later voided contributes nothing
    expect(postVendorInvoice(bill({ status: "void", amountCents: BILL_CENTS }))).toHaveLength(0);
  });

  it("R2f/R2g: every journal balances, the corpus balances, and interfund nets to zero", () => {
    const journals = postVendorInvoices([
      bill({ id: "a", status: "approved" }),
      bill({ id: "b", status: "paid", categoryName: "Insurance" }),
      bill({ id: "c", status: "received", categoryName: "Pool maintenance", amountCents: 4250 }),
      bill({ id: "d", status: "draft" }), // contributes nothing
    ]);
    for (const j of journals) expect(isJournalBalanced(j)).toBe(true);
    expect(validateInvariants(journals)).toHaveLength(0);
    const dr = journals.flatMap((j) => j.legs).filter((l) => l.side === "debit").reduce((s, l) => s + l.amountCents, 0);
    const cr = journals.flatMap((j) => j.legs).filter((l) => l.side === "credit").reduce((s, l) => s + l.amountCents, 0);
    expect(dr).toBe(cr);
  });

  it("R2h: re-deriving from the same invoice is idempotent (stable journalIds)", () => {
    const a = postVendorInvoice(bill({ status: "paid" }));
    const b = postVendorInvoice(bill({ status: "paid" }));
    expect(a.map((j) => j.journalId).sort()).toEqual(b.map((j) => j.journalId).sort());
    expect(a.map((j) => j.journalId)).toEqual(["ven-bill-inv-landscaping-1", "ven-pay-inv-landscaping-1"]);
  });

  it("R2i: negative / fractional cents are rejected fail-loud", () => {
    expect(() => postVendorInvoice(bill({ amountCents: -1 }))).toThrow();
    expect(() => postVendorInvoice(bill({ amountCents: 10.5 }))).toThrow();
  });
});

describe("R2e — category → 5xxx expense account mapping", () => {
  it("maps common HOA categories to their chart accounts (case + substring tolerant)", () => {
    expect(expenseAccountForCategory("Management Fees")).toBe("5010");
    expect(expenseAccountForCategory("property management")).toBe("5010");
    expect(expenseAccountForCategory("Insurance")).toBe("5020");
    expect(expenseAccountForCategory("Landscaping & Grounds")).toBe("5030");
    expect(expenseAccountForCategory("lawn care")).toBe("5030");
    expect(expenseAccountForCategory("Electric utility")).toBe("5040");
    expect(expenseAccountForCategory("HVAC repair")).toBe("5050");
    expect(expenseAccountForCategory("Pool maintenance")).toBe("5060");
    expect(expenseAccountForCategory("Janitorial")).toBe("5070");
    expect(expenseAccountForCategory("Trash & Recycling")).toBe("5080");
    expect(expenseAccountForCategory("Pest control")).toBe("5090");
    expect(expenseAccountForCategory("Snow plowing")).toBe("5100");
    expect(expenseAccountForCategory("Legal fees")).toBe("5110");
    expect(expenseAccountForCategory("Annual audit")).toBe("5120");
    expect(expenseAccountForCategory("Security patrol")).toBe("5130");
  });

  it("degrades unknown / empty categories to 5900 Other Operating Expenses (fail-safe, never dropped)", () => {
    expect(expenseAccountForCategory("Wombat grooming")).toBe(VENDOR_GL_CODES.EXPENSE_FALLBACK);
    expect(expenseAccountForCategory("")).toBe(VENDOR_GL_CODES.EXPENSE_FALLBACK);
    expect(expenseAccountForCategory(null)).toBe(VENDOR_GL_CODES.EXPENSE_FALLBACK);
    expect(expenseAccountForCategory(undefined)).toBe(VENDOR_GL_CODES.EXPENSE_FALLBACK);
  });

  it("an uncategorized bill still posts its expense (to 5900) — nothing is dropped", () => {
    const journals = postVendorInvoice(bill({ categoryName: null }));
    const expLeg = journals[0].legs.find((l) => l.accountCode.startsWith("5"))!;
    expect(expLeg.accountCode).toBe("5900");
    expect(totalExpenseCents(journals)).toBe(BILL_CENTS);
  });
});
