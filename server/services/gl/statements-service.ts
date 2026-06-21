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
  type GlFund,
} from "@shared/schema";
import { loadGlJournals } from "./gl-posting-service";
import {
  buildBalanceSheet,
  buildBudgetVsActual,
  glTotalIncomeCents,
  glTotalExpenseCents,
  type BalanceSheet,
  type BudgetVsActualReport,
  type BudgetLineLike,
  type ActualExpenseLike,
} from "./statements";

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

export interface FinancialStatements {
  associationId: string;
  generatedAt: string;
  /** DERIVED — NOT source-of-truth. The owner ledger is the system of record. */
  derived: true;
  balanceSheet: BalanceSheet;
  budgetVsActual: BudgetVsActualReport;
  tieOut: {
    glTotalIncomeCents: number;
    glTotalExpenseCents: number;
    balanceSheetBalanced: boolean;
    balanceSheetDifferenceCents: number;
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

  const balanceSheet = buildBalanceSheet(journals);
  const budgetVsActual = buildBudgetVsActual(budgetLinesData, actuals);

  return {
    associationId,
    generatedAt: new Date().toISOString(),
    derived: true,
    balanceSheet,
    budgetVsActual,
    tieOut: {
      glTotalIncomeCents: glTotalIncomeCents(journals),
      glTotalExpenseCents: glTotalExpenseCents(journals),
      balanceSheetBalanced: balanceSheet.balanced,
      balanceSheetDifferenceCents: balanceSheet.differenceCents,
    },
  };
}
