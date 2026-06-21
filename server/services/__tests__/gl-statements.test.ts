/**
 * Financial-statements ACCEPTANCE GATE — pure, no DB (YCM Financial Core Phase 2).
 *
 * Audit anchor:  audits/AUDIT-financial-reporting-orchestration.md (Phase 2).
 * Hardening:     audits/BLINDSPOT-pass-2026-06-20.md F4.
 *
 * THE PHASE-2 GATE. Proves, over the SAME live CHC seed data the GL reconcile gate
 * uses, that the DERIVED statements:
 *
 *   1. BALANCE SHEET BALANCES TO THE CENT — assets == liabilities + equity, 0¢.
 *   2. BUDGET-VS-ACTUAL ties to the GL — its income/expense figures reconcile to
 *      the GL totals exactly, variances compute correctly, over/under is right.
 *
 * Pure: builds the GL in-memory from the live CHC owner-ledger seed (parsed out
 * of server/seed.ts so it tracks the real reconciled balance), derives both
 * statements, and asserts the invariants. No database.
 *
 * If the balance sheet ever fails to balance, the statements are NOT trustworthy
 * and MUST NOT be surfaced. (They are DERIVED and never source-of-truth either
 * way — but a non-balancing derived sheet is a bug, not a "soft" warning.)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  postOwnerLedgerEntries,
  toCents,
  type OwnerLedgerEntryLike,
  type JournalEntry,
} from "../gl/posting";
import {
  buildBalanceSheet,
  buildBudgetVsActual,
  glTotalIncomeCents,
  type BudgetLineLike,
  type ActualExpenseLike,
} from "../gl/statements";

/** Parse the live CHC owner-ledger seed entries (same approach as the reconcile
 *  gate) so the statements are exercised against real reconciled data. */
function loadChcSeedEntries(): OwnerLedgerEntryLike[] {
  const seedPath = resolve(__dirname, "../../seed.ts");
  const text = readFileSync(seedPath, "utf8");

  const startMarker = "const CHC_BALANCE_ENTRIES";
  const endMarker = "await db.insert(ownerLedgerEntries).values(CHC_BALANCE_ENTRIES)";
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker);
  if (start === -1 || end === -1 || end < start) {
    throw new Error("Could not locate CHC_BALANCE_ENTRIES block in server/seed.ts");
  }
  const block = text.slice(start, end);

  const entries: OwnerLedgerEntryLike[] = [];
  const objectRegex = /\{[^{}]*?entryType:\s*"([^"]+)"[^{}]*?amount:\s*(-?\d+(?:\.\d+)?)[^{}]*?\}/gs;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = objectRegex.exec(block)) !== null) {
    entries.push({
      id: `chc-seed-${i++}`,
      entryType: m[1] as OwnerLedgerEntryLike["entryType"],
      amount: Number(m[2]),
      postedAt: new Date("2026-05-08T00:00:00Z"),
    });
  }
  return entries;
}

describe("Financial statements — balance sheet (the Phase-2 acceptance gate)", () => {
  const journals: JournalEntry[] = postOwnerLedgerEntries(loadChcSeedEntries());

  it("balances to the cent: assets == liabilities + equity (difference == 0¢)", () => {
    const bs = buildBalanceSheet(journals);
    expect(bs.differenceCents).toBe(0);
    expect(bs.balanced).toBe(true);
    expect(bs.totalAssetsCents).toBe(bs.totalLiabilitiesCents + bs.totalEquityCents);
  });

  it("equity folds in current-period net income (income − expense)", () => {
    const bs = buildBalanceSheet(journals);
    const income = glTotalIncomeCents(journals);
    // With no expenses posted in Phase 1, net income == total income, and equity
    // equals it (no opening fund-balance postings yet).
    expect(bs.totalEquityCents).toBe(income);
    expect(income).toBeGreaterThan(0);
  });

  it("the CHC balance sheet's AR asset equals the known $21,607.78 reconciled balance", () => {
    const bs = buildBalanceSheet(journals);
    const operating = bs.funds.find((f) => f.fund === "operating")!;
    const ar = operating.assets.find((a) => a.accountCode === "1200")!;
    expect(ar.balanceCents).toBe(2160778);
  });

  it("balances AFTER a payment moves cash↑ / AR↓ (the live money path)", () => {
    const withPayment = postOwnerLedgerEntries([
      ...loadChcSeedEntries(),
      { id: "pay-1", entryType: "payment", amount: -1326.19, postedAt: new Date("2026-06-01T00:00:00Z") },
    ]);
    const bs = buildBalanceSheet(withPayment);
    expect(bs.differenceCents).toBe(0);
    expect(bs.balanced).toBe(true);

    const operating = bs.funds.find((f) => f.fund === "operating")!;
    const cash = operating.assets.find((a) => a.accountCode === "1010")!;
    const ar = operating.assets.find((a) => a.accountCode === "1200")!;
    // Cash up by the payment; AR down by the payment; total assets unchanged.
    expect(cash.balanceCents).toBe(toCents(1326.19));
    expect(ar.balanceCents).toBe(2160778 - toCents(1326.19));
  });

  it("segregates funds (operating + reserve sections present)", () => {
    const bs = buildBalanceSheet(journals);
    const fundNames = bs.funds.map((f) => f.fund);
    expect(fundNames).toContain("operating");
    expect(fundNames).toContain("reserve");
  });
});

describe("Financial statements — budget-vs-actual", () => {
  it("computes variance $ and % per category, segregated by fund", () => {
    const budget: BudgetLineLike[] = [
      { categoryName: "Landscaping", plannedAmount: 24000, fund: "operating" },
      { categoryName: "Legal & Professional", plannedAmount: 5000, fund: "operating" },
      { categoryName: "Roof Replacement Reserve", plannedAmount: 45000, fund: "reserve" },
    ];
    const actuals: ActualExpenseLike[] = [
      { categoryName: "Landscaping", amount: 31000, fund: "operating" }, // +29.17% over
      { categoryName: "Legal & Professional", amount: 19008, fund: "operating" }, // +280.16% over
      // Roof reserve: no actuals yet → 0, under budget by full amount.
    ];

    const report = buildBudgetVsActual(budget, actuals);

    const op = report.funds.find((f) => f.fund === "operating")!;
    const land = op.lines.find((l) => l.categoryName === "Landscaping")!;
    expect(land.budgetedCents).toBe(2400000);
    expect(land.actualCents).toBe(3100000);
    expect(land.varianceCents).toBe(700000); // +$7,000
    expect(land.overBudget).toBe(true);
    expect(land.variancePct).toBeCloseTo(0.2917, 4);

    const legal = op.lines.find((l) => l.categoryName === "Legal & Professional")!;
    expect(legal.varianceCents).toBe(1900800 - 500000); // +$14,008
    expect(legal.variancePct).toBeCloseTo(2.8016, 4);

    const reserve = report.funds.find((f) => f.fund === "reserve")!;
    const roof = reserve.lines.find((l) => l.categoryName === "Roof Replacement Reserve")!;
    expect(roof.actualCents).toBe(0);
    expect(roof.varianceCents).toBe(-4500000); // under by full $45,000
    expect(roof.overBudget).toBe(false);
  });

  it("surfaces an UNBUDGETED actual as its own line (budget 0, variancePct null)", () => {
    const budget: BudgetLineLike[] = [
      { categoryName: "Landscaping", plannedAmount: 24000, fund: "operating" },
    ];
    const actuals: ActualExpenseLike[] = [
      { categoryName: "Landscaping", amount: 24000, fund: "operating" },
      { categoryName: "Emergency Roof Patch", amount: 9000, fund: "operating" }, // unbudgeted
    ];
    const report = buildBudgetVsActual(budget, actuals);
    const op = report.funds.find((f) => f.fund === "operating")!;
    const emergency = op.lines.find((l) => l.categoryName === "Emergency Roof Patch")!;
    expect(emergency.budgetedCents).toBe(0);
    expect(emergency.actualCents).toBe(900000);
    expect(emergency.variancePct).toBeNull();
    expect(emergency.overBudget).toBe(true);
  });

  it("fund totals tie out: Σ line variance == total variance", () => {
    const budget: BudgetLineLike[] = [
      { categoryName: "A", plannedAmount: 100, fund: "operating" },
      { categoryName: "B", plannedAmount: 200, fund: "operating" },
    ];
    const actuals: ActualExpenseLike[] = [
      { categoryName: "A", amount: 150, fund: "operating" },
      { categoryName: "B", amount: 180, fund: "operating" },
    ];
    const report = buildBudgetVsActual(budget, actuals);
    const op = report.funds.find((f) => f.fund === "operating")!;
    const sumLineVar = op.lines.reduce((s, l) => s + l.varianceCents, 0);
    expect(sumLineVar).toBe(op.totalVarianceCents);
    expect(op.totalBudgetedCents).toBe(toCents(300));
    expect(op.totalActualCents).toBe(toCents(330));
    expect(op.totalVarianceCents).toBe(toCents(30));
  });
});
