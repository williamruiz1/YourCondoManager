/**
 * GL income-split (dues vs special assessments) + expense→GL (vendor invoices)
 * suite — the two ratified 2026-06-30 accounting changes.
 *
 * Anchor: docs/financial-completeness-and-quickbooks-migration-2026-06-30.md
 *         (#319) — Gap #1 "vendor expenses → general ledger" + the dues/assessment
 *         income split.
 *
 * Pure-function suite — no DB. Proves:
 *   CHANGE 1 — dues (`charge`/`late-fee`) credit 4000 HOA Dues Income; special
 *              assessments (`assessment`) credit a SEPARATE 4200 Special
 *              Assessment Income; the AR (debit) leg is unchanged so reconcile
 *              (AR == owner-ledger Σ amount) still holds to the cent.
 *   CHANGE 2 — a vendor invoice posts a BALANCED expense journal (DR expense,
 *              CR A/P when owed / CR cash when paid); category routes to the right
 *              5xxx account; draft/void/zero post nothing; the whole income +
 *              expense corpus balances.
 */

import { describe, it, expect } from "vitest";
import {
  postOwnerLedgerEntry,
  postOwnerLedgerEntries,
  postVendorInvoice,
  postVendorInvoices,
  expenseAccountCodeForCategory,
  resolveExpenseAccountCode,
  chartAccount,
  isJournalBalanced,
  validateInvariants,
  deriveAccountBalances,
  accountsReceivableCents,
  DEFAULT_EXPENSE_ACCOUNT_CODE,
  ACCOUNTS_PAYABLE_CODE,
  type OwnerLedgerEntryLike,
  type VendorInvoiceLike,
} from "../gl/posting";

const at = (d: string) => new Date(`${d}T00:00:00Z`);

// ──────────────────────────────────────────────────────────────────────────────
// CHANGE 1 — DUES vs SPECIAL ASSESSMENTS post to SEPARATE income accounts.
// ──────────────────────────────────────────────────────────────────────────────

describe("CHANGE 1 — dues income (4000) is separate from special-assessment income (4200)", () => {
  it("the chart carries two distinct income accounts with clear names", () => {
    expect(chartAccount("4000", "operating").name).toBe("HOA Dues Income");
    expect(chartAccount("4000", "operating").accountType).toBe("income");
    expect(chartAccount("4200", "operating").name).toBe("Special Assessment Income");
    expect(chartAccount("4200", "operating").accountType).toBe("income");
  });

  it("a recurring-dues charge credits 4000 HOA Dues Income (DR AR / CR 4000)", () => {
    const j = postOwnerLedgerEntry({ id: "d1", entryType: "charge", amountCents: 30000, postedAt: at("2026-06-01") });
    expect(isJournalBalanced(j)).toBe(true);
    expect(j.legs.find((l) => l.accountCode === "1200")?.side).toBe("debit");
    const income = j.legs.find((l) => l.side === "credit");
    expect(income?.accountCode).toBe("4000");
    expect(income?.amountCents).toBe(30000);
  });

  it("a late-fee charge also credits 4000 (a dues-side fee, not a special assessment)", () => {
    const j = postOwnerLedgerEntry({ id: "lf", entryType: "late-fee", amountCents: 2500, postedAt: at("2026-06-01") });
    expect(isJournalBalanced(j)).toBe(true);
    expect(j.legs.find((l) => l.side === "credit")?.accountCode).toBe("4000");
  });

  it("a SPECIAL ASSESSMENT credits 4200 Special Assessment Income (DR AR / CR 4200)", () => {
    const j = postOwnerLedgerEntry({ id: "sa", entryType: "assessment", amountCents: 132619, postedAt: at("2026-06-01") });
    expect(isJournalBalanced(j)).toBe(true);
    expect(j.legs.find((l) => l.accountCode === "1200")?.side).toBe("debit");
    const income = j.legs.find((l) => l.side === "credit");
    expect(income?.accountCode).toBe("4200");
    expect(income?.amountCents).toBe(132619);
  });

  it("a dues credit (waiver) reverses the DUES account (DR 4000 / CR AR)", () => {
    const j = postOwnerLedgerEntry({ id: "cr", entryType: "credit", amountCents: -10000, postedAt: at("2026-06-02") });
    expect(isJournalBalanced(j)).toBe(true);
    expect(j.legs.find((l) => l.accountCode === "4000")?.side).toBe("debit");
    expect(j.legs.find((l) => l.accountCode === "1200")?.side).toBe("credit");
  });

  it("dues and assessment income are reported on DIFFERENT accounts in the derived balances", () => {
    const journals = postOwnerLedgerEntries([
      { id: "d", entryType: "charge", amountCents: 30000, postedAt: at("2026-06-01") },
      { id: "a", entryType: "assessment", amountCents: 50000, postedAt: at("2026-06-01") },
    ]);
    const balances = deriveAccountBalances(journals);
    const dues = balances.find((b) => b.accountCode === "4000" && b.fund === "operating");
    const special = balances.find((b) => b.accountCode === "4200" && b.fund === "operating");
    expect(dues?.balanceCents).toBe(30000);
    expect(special?.balanceCents).toBe(50000);
    // They are genuinely separate — nothing collapses dues + assessment into one.
    expect(dues?.accountCode).not.toBe(special?.accountCode);
  });

  it("RECONCILE PRESERVED — AR still equals owner-ledger Σ amount after the income split", () => {
    const entries: OwnerLedgerEntryLike[] = [
      { id: "d", entryType: "charge", amountCents: 30050, postedAt: at("2026-06-01") },
      { id: "a", entryType: "assessment", amountCents: 171942, postedAt: at("2026-06-01") },
      { id: "lf", entryType: "late-fee", amountCents: 2500, postedAt: at("2026-06-02") },
      { id: "p", entryType: "payment", amountCents: -20000, postedAt: at("2026-06-03") },
      { id: "cr", entryType: "credit", amountCents: -5000, postedAt: at("2026-06-04") },
    ];
    const journals = postOwnerLedgerEntries(entries);
    expect(validateInvariants(journals)).toEqual([]);
    const ownerNetCents = entries.reduce((s, e) => s + e.amountCents, 0);
    expect(accountsReceivableCents(journals)).toBe(ownerNetCents);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// CHANGE 2 — VENDOR EXPENSES POST TO THE GL.
// ──────────────────────────────────────────────────────────────────────────────

describe("CHANGE 2 — vendor invoices post a balanced expense journal", () => {
  it("the chart carries 5xxx expense accounts + 2000 Accounts Payable", () => {
    expect(chartAccount("5000", "operating").accountType).toBe("expense");
    expect(chartAccount("5000", "operating").name).toBe("General Operating Expense");
    expect(chartAccount("5100", "operating").name).toBe("Management Fees");
    expect(chartAccount("5200", "operating").name).toBe("Insurance");
    expect(chartAccount("2000", "operating").accountType).toBe("liability");
    expect(chartAccount("2000", "operating").name).toBe("Accounts Payable");
  });

  it("a RECEIVED (unpaid) invoice debits the expense and credits Accounts Payable", () => {
    const j = postVendorInvoice({
      id: "v1",
      amount: 1200,
      status: "received",
      postedAt: at("2026-06-05"),
      expenseAccountCode: "5500",
    });
    expect(isJournalBalanced(j)).toBe(true);
    const expense = j.legs.find((l) => l.side === "debit");
    const credit = j.legs.find((l) => l.side === "credit");
    expect(expense?.accountCode).toBe("5500");
    expect(expense?.amountCents).toBe(120000);
    expect(credit?.accountCode).toBe(ACCOUNTS_PAYABLE_CODE); // 2000 A/P
    expect(credit?.amountCents).toBe(120000);
  });

  it("an APPROVED (still unpaid) invoice also credits A/P", () => {
    const j = postVendorInvoice({ id: "v2", amount: 800, status: "approved", postedAt: at("2026-06-05") });
    expect(j.legs.find((l) => l.side === "credit")?.accountCode).toBe(ACCOUNTS_PAYABLE_CODE);
    // No specific code → default General Operating Expense.
    expect(j.legs.find((l) => l.side === "debit")?.accountCode).toBe(DEFAULT_EXPENSE_ACCOUNT_CODE);
  });

  it("a PAID invoice debits the expense and credits Operating Cash (1010), not A/P", () => {
    const j = postVendorInvoice({
      id: "v3",
      amount: 450.75,
      status: "paid",
      postedAt: at("2026-06-06"),
      expenseAccountCode: "5300",
    });
    expect(isJournalBalanced(j)).toBe(true);
    expect(j.legs.find((l) => l.side === "debit")?.accountCode).toBe("5300");
    const credit = j.legs.find((l) => l.side === "credit");
    expect(credit?.accountCode).toBe("1010");
    expect(credit?.amountCents).toBe(45075);
  });

  it("DRAFT and VOID invoices post NOTHING (not committed costs)", () => {
    expect(postVendorInvoice({ id: "d", amount: 999, status: "draft", postedAt: at("2026-06-06") }).legs).toHaveLength(0);
    expect(postVendorInvoice({ id: "x", amount: 999, status: "void", postedAt: at("2026-06-06") }).legs).toHaveLength(0);
    expect(postVendorInvoices([
      { id: "d", amount: 999, status: "draft", postedAt: at("2026-06-06") },
      { id: "x", amount: 999, status: "void", postedAt: at("2026-06-06") },
    ])).toHaveLength(0);
  });

  it("a zero / non-positive amount is a balanced no-op (no legs)", () => {
    expect(postVendorInvoice({ id: "z", amount: 0, status: "paid", postedAt: at("2026-06-06") }).legs).toHaveLength(0);
  });

  it("an invoice's expense leg is a real DEBIT to a 5xxx expense account (the income statement's cost side)", () => {
    const journals = postVendorInvoices([
      { id: "v", amount: 1000, status: "paid", postedAt: at("2026-06-06"), expenseAccountCode: "5200" },
    ]);
    const balances = deriveAccountBalances(journals);
    // Expense is debit-normal → +1000 expense.
    const expense = balances.find((b) => b.accountCode === "5200" && b.fund === "operating");
    expect(expense?.balanceCents).toBe(100000);
  });
});

describe("category → expense-account mapping (keyword routing, default 5000)", () => {
  it("routes known categories to their 5xxx accounts", () => {
    expect(expenseAccountCodeForCategory("Management Fees")).toBe("5100");
    expect(expenseAccountCodeForCategory("Property Insurance")).toBe("5200");
    expect(expenseAccountCodeForCategory("Roof Repair")).toBe("5300");
    expect(expenseAccountCodeForCategory("Water & Sewer")).toBe("5400");
    expect(expenseAccountCodeForCategory("Landscaping")).toBe("5500");
  });

  it("'electricity' routes to Utilities (5400), not Repairs", () => {
    expect(expenseAccountCodeForCategory("Electricity")).toBe("5400");
    expect(expenseAccountCodeForCategory("Electric Utility")).toBe("5400");
  });

  it("an unknown / empty category falls back to 5000 General Operating Expense", () => {
    expect(expenseAccountCodeForCategory("Random Vendor LLC")).toBe("5000");
    expect(expenseAccountCodeForCategory("")).toBe("5000");
    expect(expenseAccountCodeForCategory(null)).toBe("5000");
    expect(expenseAccountCodeForCategory(undefined)).toBe("5000");
  });

  it("resolveExpenseAccountCode only accepts real 5xxx expense codes, else defaults", () => {
    expect(resolveExpenseAccountCode("5300")).toBe("5300");
    expect(resolveExpenseAccountCode("1010")).toBe("5000"); // not an expense account
    expect(resolveExpenseAccountCode("9999")).toBe("5000"); // unknown
    expect(resolveExpenseAccountCode(null)).toBe("5000");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// INTEGRATION — the WHOLE corpus (income + expense) balances + invariants clean.
// ──────────────────────────────────────────────────────────────────────────────

describe("INTEGRATION — income (dues + assessments) + expense corpus balances", () => {
  it("a mixed corpus of dues, special assessments, payments, and vendor bills passes all invariants", () => {
    const ownerEntries: OwnerLedgerEntryLike[] = [
      { id: "d1", entryType: "charge", amountCents: 30000, postedAt: at("2026-06-01") },
      { id: "a1", entryType: "assessment", amountCents: 150000, postedAt: at("2026-06-01") },
      { id: "p1", entryType: "payment", amountCents: -30000, postedAt: at("2026-06-02") },
    ];
    const invoices: VendorInvoiceLike[] = [
      { id: "v1", amount: 1200, status: "received", postedAt: at("2026-06-03"), expenseAccountCode: "5500" },
      { id: "v2", amount: 450, status: "paid", postedAt: at("2026-06-04"), expenseAccountCode: "5300" },
      { id: "v3", amount: 999, status: "draft", postedAt: at("2026-06-04") }, // dropped
    ];

    const journals = [...postOwnerLedgerEntries(ownerEntries), ...postVendorInvoices(invoices)];

    // Whole corpus is balanced + invariant-clean.
    expect(validateInvariants(journals)).toEqual([]);

    const balances = deriveAccountBalances(journals);
    const bal = (code: string) =>
      balances.filter((b) => b.accountCode === code).reduce((s, b) => s + b.balanceCents, 0);

    // Income split is real on the books.
    expect(bal("4000")).toBe(30000); // dues
    expect(bal("4200")).toBe(150000); // special assessment
    // Expenses are real on the books.
    expect(bal("5500")).toBe(120000); // landscaping (received)
    expect(bal("5300")).toBe(45000); // repairs (paid)
    // A/P holds the unpaid bill; cash reflects the dues payment minus the paid bill.
    expect(bal("2000")).toBe(120000); // A/P liability
    expect(bal("1010")).toBe(30000 - 45000); // +300 dues collected − 450 bill paid = −150.00
    // The draft invoice posted nothing.
    expect(bal("5000")).toBe(0);
  });
});
