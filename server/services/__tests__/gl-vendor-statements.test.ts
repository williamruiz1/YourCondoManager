/**
 * Vendor-expense → statements tie-out (YCM Financial Core — Phase 4).
 *
 * Audit anchor:  docs/financial-completeness-and-quickbooks-migration-2026-06-30.md
 *                Gaps #1/#2/#6 — once vendor expenses post to the GL, the income
 *                statement gets real expense accounts, the balance sheet gets an
 *                A/P liability, and budget-vs-actual gets real actuals.
 * Build anchor:  founder-os#8171 (R4 — "statements light up").
 *
 * Pure-function suite — no DB. Proves the keystone payoff: feeding the SAME GL
 * corpus that the dues subledger already feeds, PLUS vendor-expense journals,
 * makes the existing statement generators surface real expenses + A/P while
 * still balancing to the cent. No statement code changed — the generators were
 * already built to consume expense legs; this proves they do.
 */

import { describe, it, expect } from "vitest";
import { postOwnerLedgerEntries } from "../gl/posting";
import { postVendorInvoices } from "../gl/vendor-posting";
import { buildBalanceSheet, glTotalExpenseCents, glTotalIncomeCents } from "../gl/statements";

const at = (d: string) => new Date(`${d}T00:00:00Z`);

describe("R4 — vendor expenses make the statements real (and they still balance)", () => {
  // Dues: a $500.00 assessment billed (DR 1200 AR / CR 4000 income).
  const duesJournals = postOwnerLedgerEntries([
    { id: "oln-1", entryType: "assessment", amount: 500, postedAt: at("2026-06-01"), description: "June dues" },
  ]);
  // Expenses: a $300.00 landscaping bill, still UNPAID (DR 5030 / CR 2000 A/P).
  const vendorJournals = postVendorInvoices([
    { id: "inv-1", amountCents: 30000, status: "approved", categoryName: "Landscaping", postedAt: at("2026-06-05") },
  ]);
  const corpus = [...duesJournals, ...vendorJournals];

  it("before vendor expenses, GL expense total is 0; after, it equals the bill", () => {
    expect(glTotalExpenseCents(duesJournals)).toBe(0); // dues alone = no expenses (the old, hollow state)
    expect(glTotalExpenseCents(corpus)).toBe(30000); // expenses now real
    expect(glTotalIncomeCents(corpus)).toBe(50000); // income unchanged
  });

  it("the balance sheet shows the A/P liability, folds the expense into net income, and balances to the cent", () => {
    const bs = buildBalanceSheet(corpus);
    const op = bs.funds.find((f) => f.fund === "operating")!;

    // A/P (2000) liability now appears for the unpaid bill.
    const ap = op.liabilities.find((l) => l.accountCode === "2000");
    expect(ap?.balanceCents).toBe(30000);

    // Net income = income (50000) − expense (30000) = 20000 — a REAL number,
    // not income-only. (Before this build the expense side was 0.)
    expect(op.netIncomeCents).toBe(20000);

    // Assets ($500 AR) == Liabilities ($300 A/P) + Equity ($200 net income).
    expect(op.totalAssetsCents).toBe(50000);
    expect(op.totalLiabilitiesCents).toBe(30000);
    expect(op.totalEquityCents).toBe(20000);

    // The whole sheet balances to the cent (the acceptance gate).
    expect(bs.balanced).toBe(true);
    expect(bs.differenceCents).toBe(0);
  });

  it("paying the bill moves it off A/P into cash, expense stays, sheet still balances", () => {
    const paidVendor = postVendorInvoices([
      { id: "inv-1", amountCents: 30000, status: "paid", categoryName: "Landscaping", postedAt: at("2026-06-05") },
    ]);
    const bs = buildBalanceSheet([...duesJournals, ...paidVendor]);
    const op = bs.funds.find((f) => f.fund === "operating")!;
    // A/P cleared; expense unchanged; sheet balances.
    expect(op.liabilities.find((l) => l.accountCode === "2000")?.balanceCents ?? 0).toBe(0);
    expect(glTotalExpenseCents([...duesJournals, ...paidVendor])).toBe(30000);
    expect(bs.balanced).toBe(true);
  });
});
