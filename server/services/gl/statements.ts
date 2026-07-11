/**
 * Fund-aware financial statements — DERIVED, PURE core (YCM Financial Core — Phase 2).
 *
 * Audit anchor:  audits/AUDIT-financial-reporting-orchestration.md (Phase 2 — derived statements).
 * Build anchor:  audits/YCM-financial-build-plan-2026-06-20.md Phase 2.
 * Hardening:     audits/BLINDSPOT-pass-2026-06-20.md F4 (forward-only / parallel / flag-gated).
 *
 * THIS FILE IS PURE — no DB, no I/O, no Date.now(). It turns the parallel
 * fund-aware GL (the balanced JournalEntry corpus from ./posting.ts) plus budget
 * data into two financial statements:
 *
 *   1. BUDGET-VS-ACTUAL — per expense category, operating + reserve funds,
 *      variance $ and %. Matches the Paddlers-Cove benchmark shape (or better).
 *   2. BALANCE SHEET — cash / AR / interfund / reserves / liabilities / equity,
 *      segregated by fund, at a point in time, that BALANCES to the cent
 *      (assets == liabilities + equity).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THESE STATEMENTS ARE DERIVED. They are NOT a source of truth. The owner ledger
 * stays the system of record; the GL is built alongside it (forward-only,
 * parallel, GL_ENABLED default OFF). Nothing here writes to any live table, and
 * the GL→source-of-truth flip is intentionally OUT of this phase's scope.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * MONEY IS INTEGER CENTS everywhere in here (matching the GL), so the balance-
 * sheet identity assets == liabilities + equity is EXACT and cannot float-drift.
 */

import {
  CHART_OF_ACCOUNTS,
  deriveAccountBalances,
  normalBalanceFor,
  toCents,
  type AccountBalance,
  type JournalEntry,
} from "./posting";
import type { GlAccountType, GlFund } from "@shared/schema";

// ──────────────────────────────────────────────────────────────────────────────
// Account-type resolution. The pure core derives a leg's account TYPE from the
// chart of accounts (same chart the posting core seeds). A code/fund not in the
// chart degrades to 'asset' on the debit side (fail-safe — never throws here, so
// a future un-charted posting can't crash a read-only statement).
// ──────────────────────────────────────────────────────────────────────────────

function accountTypeFor(code: string, fund: GlFund): GlAccountType {
  const def = CHART_OF_ACCOUNTS.find((a) => a.code === code && a.fund === fund);
  return def?.accountType ?? "asset";
}

// ──────────────────────────────────────────────────────────────────────────────
// BALANCE SHEET
// ──────────────────────────────────────────────────────────────────────────────

export interface BalanceSheetLine {
  accountCode: string;
  name: string;
  fund: GlFund;
  accountType: GlAccountType;
  /** Signed balance in cents, in the account's natural (normal-balance) direction. */
  balanceCents: number;
}

export interface BalanceSheetFundSection {
  fund: GlFund;
  assets: BalanceSheetLine[];
  liabilities: BalanceSheetLine[];
  equity: BalanceSheetLine[];
  totalAssetsCents: number;
  totalLiabilitiesCents: number;
  /** Equity INCLUDING current-period net income (the close). */
  totalEquityCents: number;
  /** Net income (income − expense) for the fund, folded into equity. */
  netIncomeCents: number;
}

export interface BalanceSheet {
  /** Per-fund sections (operating, reserve). */
  funds: BalanceSheetFundSection[];
  totalAssetsCents: number;
  totalLiabilitiesCents: number;
  totalEquityCents: number;
  /** totalAssets − (totalLiabilities + totalEquity). MUST be 0 to balance. */
  differenceCents: number;
  /** True iff the sheet balances to the cent (the Phase-2 acceptance gate). */
  balanced: boolean;
}

const FUNDS: readonly GlFund[] = ["operating", "reserve"] as const;

/** A nice display name for an (account code, fund) — falls back to the chart. */
function nameFor(code: string, fund: GlFund): string {
  return CHART_OF_ACCOUNTS.find((a) => a.code === code && a.fund === fund)?.name ?? code;
}

/**
 * Build a fund-segregated balance sheet from the GL journal corpus.
 *
 * THE BALANCING MODEL (why assets == liabilities + equity holds to the cent):
 *
 * Every journal entry balances (ΣDR == ΣCR — enforced by the posting core's
 * invariants). On a balance sheet, asset & liability accounts carry their
 * standing balance, while INCOME and EXPENSE accounts are temporary — at period
 * close they roll into EQUITY as "net income" (income − expense). So:
 *
 *     equity_reported  = posted equity accounts (3900/3910) + net income
 *     net income       = Σ income balances − Σ expense balances
 *
 * Because the underlying journals balance, assets (ΣDR-normal standing) exactly
 * equal liabilities + posted-equity + (income − expense) = liabilities + equity.
 * We compute equity AS that close, so the identity is exact, not approximate.
 */
export function buildBalanceSheet(journals: JournalEntry[]): BalanceSheet {
  const balances = deriveAccountBalances(journals);

  const sections: BalanceSheetFundSection[] = [];

  for (const fund of FUNDS) {
    const fundBalances = balances.filter((b) => b.fund === fund);

    const assets: BalanceSheetLine[] = [];
    const liabilities: BalanceSheetLine[] = [];
    const equity: BalanceSheetLine[] = [];

    let incomeCents = 0;
    let expenseCents = 0;
    let postedEquityCents = 0;

    for (const b of fundBalances) {
      const type = accountTypeFor(b.accountCode, b.fund);
      const line: BalanceSheetLine = {
        accountCode: b.accountCode,
        name: nameFor(b.accountCode, b.fund),
        fund: b.fund,
        accountType: type,
        balanceCents: b.balanceCents,
      };
      switch (type) {
        case "asset":
          assets.push(line);
          break;
        case "liability":
          liabilities.push(line);
          break;
        case "equity":
          equity.push(line);
          postedEquityCents += b.balanceCents;
          break;
        case "income":
          // Income is credit-normal → its derived balance is already positive
          // when net-credit. It rolls into equity as +net income.
          incomeCents += b.balanceCents;
          break;
        case "expense":
          // Expense is debit-normal → positive when net-debit. It reduces equity.
          expenseCents += b.balanceCents;
          break;
      }
    }

    const netIncomeCents = incomeCents - expenseCents;
    const totalAssetsCents = sumLines(assets);
    const totalLiabilitiesCents = sumLines(liabilities);
    // Equity at close = posted equity accounts + current-period net income.
    const totalEquityCents = postedEquityCents + netIncomeCents;

    // Surface the close as an explicit equity line so the statement reads like a
    // real balance sheet (retained-earnings / current-year-net line).
    if (netIncomeCents !== 0) {
      equity.push({
        accountCode: "3999",
        name: "Current-Period Net Income (to Fund Balance)",
        fund,
        accountType: "equity",
        balanceCents: netIncomeCents,
      });
    }

    sections.push({
      fund,
      assets,
      liabilities,
      equity,
      totalAssetsCents,
      totalLiabilitiesCents,
      totalEquityCents,
      netIncomeCents,
    });
  }

  const totalAssetsCents = sections.reduce((s, f) => s + f.totalAssetsCents, 0);
  const totalLiabilitiesCents = sections.reduce((s, f) => s + f.totalLiabilitiesCents, 0);
  const totalEquityCents = sections.reduce((s, f) => s + f.totalEquityCents, 0);
  const differenceCents = totalAssetsCents - (totalLiabilitiesCents + totalEquityCents);

  return {
    funds: sections,
    totalAssetsCents,
    totalLiabilitiesCents,
    totalEquityCents,
    differenceCents,
    balanced: differenceCents === 0,
  };
}

function sumLines(lines: BalanceSheetLine[]): number {
  return lines.reduce((s, l) => s + l.balanceCents, 0);
}

// ──────────────────────────────────────────────────────────────────────────────
// INCOME & EXPENSE STATEMENT (a.k.a. the income statement / statement of
// activities). The plain-English "what came in and what went out" statement an
// owner reads to see the association's financial performance for the period.
//
// This is the DERIVED income statement built directly off the double-entry GL
// (NOT off vendor_invoices or the owner ledger). Because it reads the same
// posted legs the balance sheet reads, its NET INCOME is EXACTLY the balance
// sheet's current-period net income (income − expense) to the cent — the two
// statements can never disagree.
//
// - INCOME lines  = every income-account balance (credit-normal → positive when
//   net-credit), e.g. HOA Dues Income (4000), Special Assessment Income (4200).
// - EXPENSE lines = every expense-account balance (debit-normal → positive when
//   net-debit), e.g. Management Fees (5100), Insurance (5200), R&M (5300)…
// - NET INCOME    = Σ income − Σ expense (positive == surplus, negative == deficit).
// Segregated by fund (operating vs reserve) so reserve activity reads separately.
// ──────────────────────────────────────────────────────────────────────────────

export interface IncomeStatementLine {
  accountCode: string;
  name: string;
  fund: GlFund;
  accountType: GlAccountType;
  /** Signed balance in cents, in the account's natural (normal-balance) direction. */
  balanceCents: number;
}

export interface IncomeStatementFundSection {
  fund: GlFund;
  income: IncomeStatementLine[];
  expenses: IncomeStatementLine[];
  totalIncomeCents: number;
  totalExpenseCents: number;
  /** income − expense for the fund. Positive == surplus, negative == deficit. */
  netIncomeCents: number;
}

export interface IncomeStatement {
  /** Per-fund sections (operating, reserve). Only funds with activity appear. */
  funds: IncomeStatementFundSection[];
  totalIncomeCents: number;
  totalExpenseCents: number;
  /** Σ income − Σ expense across funds. EXACTLY the balance sheet's net income. */
  netIncomeCents: number;
}

/**
 * Build a fund-segregated income & expense statement from the GL journal corpus.
 * Only accounts with non-zero activity appear as lines; a fund with no income
 * and no expense activity is omitted. Net income here is, by construction,
 * identical to the balance sheet's current-period net income (both derive from
 * the same posted legs), which is exactly what makes the two statements tie out.
 */
export function buildIncomeStatement(journals: JournalEntry[]): IncomeStatement {
  const balances = deriveAccountBalances(journals);
  const sections: IncomeStatementFundSection[] = [];

  for (const fund of FUNDS) {
    const income: IncomeStatementLine[] = [];
    const expenses: IncomeStatementLine[] = [];

    for (const b of balances) {
      if (b.fund !== fund) continue;
      if (b.balanceCents === 0) continue;
      const type = accountTypeFor(b.accountCode, b.fund);
      if (type !== "income" && type !== "expense") continue;
      const line: IncomeStatementLine = {
        accountCode: b.accountCode,
        name: nameFor(b.accountCode, b.fund),
        fund: b.fund,
        accountType: type,
        balanceCents: b.balanceCents,
      };
      if (type === "income") income.push(line);
      else expenses.push(line);
    }

    if (income.length === 0 && expenses.length === 0) continue;

    income.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
    expenses.sort((a, b) => a.accountCode.localeCompare(b.accountCode));

    const totalIncomeCents = income.reduce((s, l) => s + l.balanceCents, 0);
    const totalExpenseCents = expenses.reduce((s, l) => s + l.balanceCents, 0);

    sections.push({
      fund,
      income,
      expenses,
      totalIncomeCents,
      totalExpenseCents,
      netIncomeCents: totalIncomeCents - totalExpenseCents,
    });
  }

  const totalIncomeCents = sections.reduce((s, f) => s + f.totalIncomeCents, 0);
  const totalExpenseCents = sections.reduce((s, f) => s + f.totalExpenseCents, 0);

  return {
    funds: sections,
    totalIncomeCents,
    totalExpenseCents,
    netIncomeCents: totalIncomeCents - totalExpenseCents,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// BUDGET-VS-ACTUAL
// ──────────────────────────────────────────────────────────────────────────────

/**
 * One budget line as the pure core needs it. Mirrors `budget_lines`
 * (shared/schema.ts) but kept structural so the core has no DB dependency.
 * `fund` is resolved by the caller (from the budget's reserve/operating nature
 * or a future budget_line_gl_mappings row); a missing tag degrades to operating.
 */
export interface BudgetLineLike {
  /** Category / line name, e.g. "Landscaping". */
  categoryName: string;
  /** Planned dollars (float), as stored in budget_lines.plannedAmount. */
  plannedAmount: number;
  fund: GlFund;
}

/**
 * One actual-expense fact as the pure core needs it. Sourced READ-ONLY from
 * vendor_invoices (or, once expenses post to the GL, from expense legs). Kept
 * structural so the core has no DB dependency. `categoryName` is how an actual
 * ties to its budget line; `fund` segregates operating vs reserve.
 */
export interface ActualExpenseLike {
  categoryName: string;
  /** Actual dollars (float). */
  amount: number;
  fund: GlFund;
}

export interface BudgetVsActualLine {
  categoryName: string;
  fund: GlFund;
  budgetedCents: number;
  actualCents: number;
  /** actual − budgeted (cents). Positive == over budget (an overrun). */
  varianceCents: number;
  /**
   * variance as a fraction of budget, e.g. 0.341 == +34.1% over. `null` when the
   * budgeted amount is 0 (an actual against a $0 budget is "∞%" — surfaced as a
   * flag rather than a misleading number).
   */
  variancePct: number | null;
  /** True when actual exceeds budget (the Paddlers "Over by" column). */
  overBudget: boolean;
}

export interface BudgetVsActualFundSection {
  fund: GlFund;
  lines: BudgetVsActualLine[];
  totalBudgetedCents: number;
  totalActualCents: number;
  totalVarianceCents: number;
}

export interface BudgetVsActualReport {
  funds: BudgetVsActualFundSection[];
  totalBudgetedCents: number;
  totalActualCents: number;
  totalVarianceCents: number;
}

/** Round-trip-safe key for grouping a (category, fund). */
function bvaKey(categoryName: string, fund: GlFund): string {
  return `${categoryName}|||${fund}`;
}

/**
 * Build the budget-vs-actual report. Joins planned budget lines to actual
 * expenses by (categoryName, fund). A budget line with no actuals shows actual
 * 0 (under budget by the full amount); an actual with no matching budget line is
 * surfaced as its own line with budget 0 (an UNBUDGETED spend — the Paddlers
 * report's most alarming class).
 */
export function buildBudgetVsActual(
  budgetLines: BudgetLineLike[],
  actuals: ActualExpenseLike[],
): BudgetVsActualReport {
  // Aggregate budget + actual by (category, fund).
  const budgetByKey = new Map<string, { categoryName: string; fund: GlFund; cents: number }>();
  for (const bl of budgetLines) {
    const key = bvaKey(bl.categoryName, bl.fund);
    const cur = budgetByKey.get(key) ?? { categoryName: bl.categoryName, fund: bl.fund, cents: 0 };
    cur.cents += toCents(bl.plannedAmount);
    budgetByKey.set(key, cur);
  }

  const actualByKey = new Map<string, { categoryName: string; fund: GlFund; cents: number }>();
  for (const a of actuals) {
    const key = bvaKey(a.categoryName, a.fund);
    const cur = actualByKey.get(key) ?? { categoryName: a.categoryName, fund: a.fund, cents: 0 };
    cur.cents += toCents(a.amount);
    actualByKey.set(key, cur);
  }

  // Union of all (category, fund) keys, stable-ordered: budget order first, then
  // any unbudgeted actuals.
  const orderedKeys: string[] = [];
  const seen = new Set<string>();
  for (const key of budgetByKey.keys()) {
    orderedKeys.push(key);
    seen.add(key);
  }
  for (const key of actualByKey.keys()) {
    if (!seen.has(key)) orderedKeys.push(key);
  }

  const linesByFund = new Map<GlFund, BudgetVsActualLine[]>();
  for (const fund of FUNDS) linesByFund.set(fund, []);

  for (const key of orderedKeys) {
    const b = budgetByKey.get(key);
    const a = actualByKey.get(key);
    const categoryName = (b ?? a)!.categoryName;
    const fund = (b ?? a)!.fund;
    const budgetedCents = b?.cents ?? 0;
    const actualCents = a?.cents ?? 0;
    const varianceCents = actualCents - budgetedCents;
    const variancePct = budgetedCents === 0 ? null : varianceCents / budgetedCents;

    linesByFund.get(fund)!.push({
      categoryName,
      fund,
      budgetedCents,
      actualCents,
      varianceCents,
      variancePct,
      overBudget: varianceCents > 0,
    });
  }

  const sections: BudgetVsActualFundSection[] = [];
  for (const fund of FUNDS) {
    const lines = linesByFund.get(fund)!;
    if (lines.length === 0) continue;
    const totalBudgetedCents = lines.reduce((s, l) => s + l.budgetedCents, 0);
    const totalActualCents = lines.reduce((s, l) => s + l.actualCents, 0);
    sections.push({
      fund,
      lines,
      totalBudgetedCents,
      totalActualCents,
      totalVarianceCents: totalActualCents - totalBudgetedCents,
    });
  }

  const totalBudgetedCents = sections.reduce((s, f) => s + f.totalBudgetedCents, 0);
  const totalActualCents = sections.reduce((s, f) => s + f.totalActualCents, 0);

  return {
    funds: sections,
    totalBudgetedCents,
    totalActualCents,
    totalVarianceCents: totalActualCents - totalBudgetedCents,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// INCOME-SIDE TIE-OUT — proves budget-vs-actual income ties to the GL to the cent.
// ──────────────────────────────────────────────────────────────────────────────

/**
 * The total GL income (cents) — Σ of every income-account balance across funds.
 * Used by the acceptance gate to prove the statements' income figures tie to the
 * GL exactly (no derived number drifts from the ledger).
 */
export function glTotalIncomeCents(journals: JournalEntry[]): number {
  return deriveAccountBalances(journals)
    .filter((b) => accountTypeFor(b.accountCode, b.fund) === "income")
    .reduce((s, b) => s + b.balanceCents, 0);
}

/** The total GL expense (cents) — Σ of every expense-account balance. */
export function glTotalExpenseCents(journals: JournalEntry[]): number {
  return deriveAccountBalances(journals)
    .filter((b) => accountTypeFor(b.accountCode, b.fund) === "expense")
    .reduce((s, b) => s + b.balanceCents, 0);
}

/** Re-export for callers that want the raw per-account balances. */
export function accountBalances(journals: JournalEntry[]): AccountBalance[] {
  return deriveAccountBalances(journals);
}

// Keep `normalBalanceFor` import meaningfully referenced for future
// expense-account charting (statements derive type via the chart today).
void normalBalanceFor;
