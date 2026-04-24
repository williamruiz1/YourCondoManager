/**
 * 4.1 Tier 2 resolver — budget variance flags (4.1 Q1 Tier 2).
 *
 * Spec wording: "Budget variance flags" — surface budget line items
 * whose actual spend exceeds the planned amount by more than 10% for
 * the current budget period.
 *
 * Canonical calculation mirrors `/api/financial/budgets/:associationId/variance/:budgetVersionId`
 * (see `storage.getBudgetVariance`): `actual = sum(vendor_invoices) +
 * sum(utility_payments)` filtered by matching `accountId` / `categoryId`
 * on each budget line, with the budget period anchoring the invoice
 * window. We only consider the most recent RATIFIED budget version
 * whose period encloses `now` — draft / proposed versions are noise.
 *
 * Resolver assigns:
 *   zone          = "financials"
 *   featureDomain = "financials.reports"
 *   ruleType      = "budget-variance"
 *   recordType    = "budget_lines"
 *   recordId      = budgetLine.id
 *
 * `alertId` therefore is `budget-variance:budget_lines:<id>`.
 *
 * Severity (task heuristics):
 *   critical — not used
 *   high     — overspend > 25% of planned amount
 *   medium   — overspend > 10% (the minimum to fire) through 25%
 */

import { storage } from "../../storage";
import type { AlertItem, AlertSeverity } from "../types";
import { FEATURE_DOMAINS } from "../types";

const OVERSPEND_THRESHOLD_PCT = 10;
const HIGH_THRESHOLD_PCT = 25;

export async function resolve(
  associationId: string,
  context: { associationName: string; now?: Date },
): Promise<AlertItem[]> {
  const now = context.now ?? new Date();

  const budgets = await storage.getBudgets(associationId);
  if (budgets.length === 0) return [];

  // Gather current-period budgets first (periodStart <= now <= periodEnd).
  const currentBudgets = budgets.filter((b) => {
    const start = new Date(b.periodStart);
    const end = new Date(b.periodEnd);
    return start <= now && end >= now;
  });
  if (currentBudgets.length === 0) return [];

  const alerts: AlertItem[] = [];

  for (const budget of currentBudgets) {
    const versions = await storage.getBudgetVersions(budget.id);
    const ratified = versions
      .filter((v) => v.status === "ratified")
      .sort((a, b) => b.versionNumber - a.versionNumber);
    const activeVersion = ratified[0];
    if (!activeVersion) continue;

    let varianceRows: Awaited<ReturnType<typeof storage.getBudgetVariance>>;
    try {
      varianceRows = await storage.getBudgetVariance(associationId, activeVersion.id);
    } catch {
      // Defensive: getBudgetVariance throws on mismatched association /
      // missing records. Skip rather than crash the resolver.
      continue;
    }

    for (const row of varianceRows) {
      // `varianceAmount = plannedAmount - actualAmount` (overspend is NEGATIVE).
      if (!Number.isFinite(row.plannedAmount) || row.plannedAmount <= 0) continue;
      if (!Number.isFinite(row.actualAmount)) continue;
      const overspendAmount = row.actualAmount - row.plannedAmount;
      if (overspendAmount <= 0) continue;
      const overspendPct = (overspendAmount / row.plannedAmount) * 100;
      if (overspendPct <= OVERSPEND_THRESHOLD_PCT) continue;

      let severity: AlertSeverity;
      if (overspendPct > HIGH_THRESHOLD_PCT) {
        severity = "high";
      } else {
        severity = "medium";
      }

      alerts.push({
        alertId: `budget-variance:budget_lines:${row.budgetLineId}`,
        associationId,
        associationName: context.associationName,
        zone: "financials",
        featureDomain: FEATURE_DOMAINS.FINANCIALS_REPORTS,
        ruleType: "budget-variance",
        recordType: "budget_lines",
        recordId: row.budgetLineId,
        severity,
        title: `Budget variance: ${row.lineItemName}`,
        description: `Overspend ${overspendPct.toFixed(1)}% ($${overspendAmount.toFixed(2)} over planned $${row.plannedAmount.toFixed(2)}).`,
        createdAt: new Date(activeVersion.ratifiedAt ?? activeVersion.createdAt ?? now),
        resolutionHref: `/app/financials/budgets/${budget.id}?versionId=${activeVersion.id}`,
        sourceRecord: {
          budgetId: budget.id,
          budgetVersionId: activeVersion.id,
          line: row,
        },
      });
    }
  }

  return alerts;
}
