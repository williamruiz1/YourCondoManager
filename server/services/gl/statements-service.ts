/**
 * Financial statements service — DB-bound, read-only (YCM Financial Core Phase 2).
 *
 * Audit anchor:  audits/AUDIT-financial-reporting-orchestration.md (Phase 2).
 * Build anchor:  audits/YCM-financial-build-plan-2026-06-20.md Phase 2.
 * Hardening:     audits/BLINDSPOT-pass-2026-06-20.md F4 (forward-only / parallel).
 *
 * This is the READ-ONLY assembler for the DERIVED financial statements. It:
 *   1. loads the parallel GL journals for an association (read-only),
 *   2. loads budget lines + their optional GL mapping (read-only),
 *   3. loads actual expenses from vendor_invoices (read-only),
 *   4. calls the PURE statements core (./statements.ts) to produce the balance
 *      sheet + budget-vs-actual report.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THESE STATEMENTS ARE DERIVED — NOT a source of truth. This service NEVER writes
 * to any table. It is gated behind GL_ENABLED at the API/UI surface (the GL it
 * reads is itself only populated when GL_ENABLED is on); the owner ledger stays
 * the system of record. The GL→source-of-truth flip is OUT of this phase's scope.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import {
  budgets,
  budgetVersions,
  budgetLines,
  budgetLineGlMappings,
  vendorInvoices,
  ownerLedgerEntries,
  type GlFund,
} from "@shared/schema";
import { loadGlJournals } from "./gl-posting-service";
import {
  buildBalanceSheet,
  buildBudgetVsActual,
  buildIncomeStatement,
  glTotalIncomeCents,
  glTotalExpenseCents,
  accountBalances,
  type BalanceSheet,
  type BudgetVsActualReport,
  type IncomeStatement,
  type BudgetLineLike,
  type ActualExpenseLike,
} from "./statements";
import { CHART_OF_ACCOUNTS, centsToDollars, type OwnerLedgerEntryLike } from "./posting";
import { reconcileFromOwnerLedger, type ReconcileReport } from "./reconcile";

/** Derive a budget's fund from its name (a "...Reserve..." budget is reserve). */
function fundFromBudgetName(name: string): GlFund {
  return /reserve/i.test(name) ? "reserve" : "operating";
}

/**
 * Load the ratified budget lines for an association as the pure-core shape.
 * Prefers the explicit GL mapping's fund when present; otherwise derives the
 * fund from the budget name. Uses the latest RATIFIED version per budget (falls
 * back to the highest version number if none is ratified).
 */
export async function loadBudgetLines(associationId: string): Promise<BudgetLineLike[]> {
  const assocBudgets = await db
    .select()
    .from(budgets)
    .where(eq(budgets.associationId, associationId));
  if (assocBudgets.length === 0) return [];

  const out: BudgetLineLike[] = [];

  for (const budget of assocBudgets) {
    const versions = await db
      .select()
      .from(budgetVersions)
      .where(eq(budgetVersions.budgetId, budget.id));
    if (versions.length === 0) continue;

    // Prefer a ratified version; else the highest version number.
    const ratified = versions.filter((v) => v.status === "ratified");
    const chosen = (ratified.length > 0 ? ratified : versions).sort(
      (a, b) => b.versionNumber - a.versionNumber,
    )[0];

    const lines = await db
      .select()
      .from(budgetLines)
      .where(eq(budgetLines.budgetVersionId, chosen.id));
    if (lines.length === 0) continue;

    // Load any GL mappings for these lines (optional fund override).
    const mappings = await db
      .select()
      .from(budgetLineGlMappings)
      .where(
        inArray(
          budgetLineGlMappings.budgetLineId,
          lines.map((l) => l.id),
        ),
      );
    const fundByLineId = new Map<string, GlFund>();
    for (const m of mappings) fundByLineId.set(m.budgetLineId, m.fund);

    const budgetFund = fundFromBudgetName(budget.name);
    for (const line of lines) {
      out.push({
        categoryName: line.lineItemName,
        plannedAmount: line.plannedAmount,
        fund: fundByLineId.get(line.id) ?? budgetFund,
      });
    }
  }

  return out;
}

/**
 * Load actual expenses for an association from vendor_invoices (READ-ONLY).
 * Phase-2 scope: vendor invoices are the canonical expense-actual source until
 * expenses post to the GL (a later phase). Voided invoices are excluded; the
 * category is the invoice's notes-derived line is NOT used — we group by
 * vendorName as the category proxy, which matches the budget line items where a
 * mapping exists and otherwise surfaces unbudgeted spend honestly.
 *
 * `fund` defaults to operating (vendor invoices are operating-fund spend in
 * Phase 1); a reserve-fund expense path arrives with reserve project tracking.
 */
export async function loadActualExpenses(associationId: string): Promise<ActualExpenseLike[]> {
  const invoices = await db
    .select()
    .from(vendorInvoices)
    .where(eq(vendorInvoices.associationId, associationId));

  return invoices
    .filter((inv) => inv.status !== "void")
    .map((inv) => ({
      categoryName: inv.vendorName,
      amount: inv.amount,
      fund: "operating" as GlFund,
    }));
}

/**
 * The reconcile-to-the-cent TRUST INDICATOR surfaced on the statements page.
 * This is the single "can I trust these numbers?" signal an owner reads. It
 * proves — to the cent — that (a) the GL's Accounts-Receivable balance equals
 * the live owner ledger the product already reports (owner-ledger == GL AR),
 * (b) the double-entry invariants hold (every journal balances, the corpus
 * balances, interfund nets to zero), and (c) the balance sheet balances
 * (assets == liabilities + equity). When ALL THREE hold, `trustworthy` is true
 * and the page shows a green "Ties out to the cent" badge; any miss surfaces
 * the exact difference so it's never silently wrong.
 */
export interface StatementsReconciliation {
  /** Owner-ledger balance the live product reports today (Σ amount, cents). */
  ownerLedgerBalanceCents: number;
  /** Accounts Receivable balance derived from the parallel GL, in cents. */
  glAccountsReceivableCents: number;
  /** owner-ledger − GL AR. MUST be 0 to tie out. */
  arDifferenceCents: number;
  /** True iff the GL AR equals the live owner ledger to the cent. */
  ownerLedgerTiesOut: boolean;
  /** Double-entry / interfund invariant violations (empty when clean). */
  invariantViolations: string[];
  /** True iff the balance sheet balances (assets == liabilities + equity). */
  balanceSheetBalanced: boolean;
  /** assets − (liabilities + equity). MUST be 0. */
  balanceSheetDifferenceCents: number;
  /**
   * The single verdict: TRUE iff owner-ledger ties out AND invariants are clean
   * AND the balance sheet balances. This is the "trust these numbers" gate.
   */
  trustworthy: boolean;
}

export interface FinancialStatements {
  associationId: string;
  generatedAt: string;
  /** DERIVED — NOT source-of-truth. The owner ledger is the system of record. */
  derived: true;
  balanceSheet: BalanceSheet;
  /** Income & Expense statement (income by account, expense by account, net). */
  incomeStatement: IncomeStatement;
  budgetVsActual: BudgetVsActualReport;
  tieOut: {
    glTotalIncomeCents: number;
    glTotalExpenseCents: number;
    balanceSheetBalanced: boolean;
    balanceSheetDifferenceCents: number;
  };
  /** The reconcile-to-the-cent trust indicator (the "can I trust this?" signal). */
  reconciliation: StatementsReconciliation;
}

/** Load owner-ledger rows for an association as the pure-core reconcile input. */
async function loadOwnerLedgerForReconcile(
  associationId: string,
): Promise<OwnerLedgerEntryLike[]> {
  const rows = await db
    .select()
    .from(ownerLedgerEntries)
    .where(eq(ownerLedgerEntries.associationId, associationId));
  return rows.map((r) => ({
    id: r.id,
    entryType: r.entryType,
    amountCents: r.amountCents,
    postedAt: r.postedAt,
    description: r.description,
  }));
}

/**
 * Assemble the statements reconciliation trust indicator from the live owner
 * ledger + the balance sheet. Pure composition of `reconcileFromOwnerLedger`
 * (owner-ledger vs GL AR + invariants) and the balance-sheet balance flag.
 */
function buildReconciliation(
  report: ReconcileReport,
  balanceSheet: BalanceSheet,
): StatementsReconciliation {
  const ownerLedgerTiesOut = report.differenceCents === 0;
  return {
    ownerLedgerBalanceCents: report.ownerLedgerBalanceCents,
    glAccountsReceivableCents: report.glAccountsReceivableCents,
    arDifferenceCents: report.differenceCents,
    ownerLedgerTiesOut,
    invariantViolations: report.invariantViolations,
    balanceSheetBalanced: balanceSheet.balanced,
    balanceSheetDifferenceCents: balanceSheet.differenceCents,
    trustworthy:
      ownerLedgerTiesOut &&
      report.invariantViolations.length === 0 &&
      balanceSheet.balanced,
  };
}

/**
 * Build the full DERIVED financial statements for an association from the GL +
 * budget + vendor-invoice actuals. Read-only end to end.
 */
export async function buildFinancialStatements(associationId: string): Promise<FinancialStatements> {
  const journals = await loadGlJournals(associationId);
  const budgetLinesData = await loadBudgetLines(associationId);
  const actuals = await loadActualExpenses(associationId);
  const ownerLedger = await loadOwnerLedgerForReconcile(associationId);

  const balanceSheet = buildBalanceSheet(journals);
  const incomeStatement = buildIncomeStatement(journals);
  const budgetVsActual = buildBudgetVsActual(budgetLinesData, actuals);
  const reconcileReport = reconcileFromOwnerLedger(ownerLedger);

  return {
    associationId,
    generatedAt: new Date().toISOString(),
    derived: true,
    balanceSheet,
    incomeStatement,
    budgetVsActual,
    tieOut: {
      glTotalIncomeCents: glTotalIncomeCents(journals),
      glTotalExpenseCents: glTotalExpenseCents(journals),
      balanceSheetBalanced: balanceSheet.balanced,
      balanceSheetDifferenceCents: balanceSheet.differenceCents,
    },
    reconciliation: buildReconciliation(reconcileReport, balanceSheet),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// COA-screen SEAM (read-only).
//
// The Chart of Accounts screen (/app/financial/foundation) reads the MANUAL
// `financial_accounts` table — a different table than the GL's gl_accounts /
// gl_entries. Fully merging GL balances INTO that screen's UI is deferred (it
// would touch the manual-account editor semantics right before go-live). This
// is the documented seam: a derived, read-only roll-up of the GL chart with the
// dues-driven balances so the COA screen (or a "GL view" tab) can adopt it
// cleanly. DERIVED — never source-of-truth, never written.
// ─────────────────────────────────────────────────────────────────────────────

export interface GlAccountActivityRow {
  accountCode: string;
  fund: GlFund;
  name: string;
  accountType: string;
  /** Signed balance in the account's natural direction (debit-normal positive
   *  when net-debit; credit-normal positive when net-credit). */
  balanceCents: number;
  balance: number;
}

export interface GlAccountActivity {
  associationId: string;
  generatedAt: string;
  derived: true;
  accounts: GlAccountActivityRow[];
}

/**
 * Build the per-GL-account activity roll-up for an association (DERIVED, read-
 * only). Only accounts with non-zero activity are returned, ordered by code.
 * This is the seam the COA screen consumes to reflect dues without owning the
 * GL.
 */
export async function buildGlAccountActivity(associationId: string): Promise<GlAccountActivity> {
  const journals = await loadGlJournals(associationId);
  const balances = accountBalances(journals);

  const rows: GlAccountActivityRow[] = balances
    .filter((b) => b.balanceCents !== 0)
    .map((b) => {
      const def = CHART_OF_ACCOUNTS.find((a) => a.code === b.accountCode && a.fund === b.fund);
      return {
        accountCode: b.accountCode,
        fund: b.fund,
        name: def?.name ?? b.accountCode,
        accountType: def?.accountType ?? "asset",
        balanceCents: b.balanceCents,
        balance: centsToDollars(b.balanceCents),
      };
    })
    .sort((a, b) =>
      a.accountCode !== b.accountCode
        ? a.accountCode.localeCompare(b.accountCode)
        : a.fund.localeCompare(b.fund),
    );

  return {
    associationId,
    generatedAt: new Date().toISOString(),
    derived: true,
    accounts: rows,
  };
}
