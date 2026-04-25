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
 *
 * Wave 16b (5.4-F1): `resolveMany` calls `storage.getBudgets()` once
 * (no associationId filter for the multi-assoc path), groups budgets by
 * association, and dispatches the per-budget version + variance lookups
 * concurrently. `resolve()` is a thin wrapper preserved for backward
 * compatibility with the existing per-source tests.
 */

import { storage } from "../../storage";
import type { AlertItem, AlertSeverity } from "../types";
import { FEATURE_DOMAINS } from "../types";

const OVERSPEND_THRESHOLD_PCT = 10;
const HIGH_THRESHOLD_PCT = 25;

export interface AssociationContext {
  id: string;
  name: string;
}

export interface ResolveContext {
  associationName: string;
  now?: Date;
}

export interface ResolveManyContext {
  now?: Date;
}

export async function resolveMany(
  associations: AssociationContext[],
  context: ResolveManyContext = {},
): Promise<AlertItem[]> {
  if (associations.length === 0) return [];
  const now = context.now ?? new Date();
  const nameById = new Map(associations.map((a) => [a.id, a.name]));

  // One getBudgets() call regardless of associationCount; storage already
  // does a full-table fetch per call so this is a strict reduction in
  // round-trips for the multi-assoc path.
  const allBudgets =
    associations.length === 1
      ? await storage.getBudgets(associations[0].id)
      : await storage.getBudgets();

  // Filter to current-period budgets that belong to a permitted assoc.
  const currentBudgets = allBudgets
    .filter((b) => nameById.has(b.associationId))
    .filter((b) => {
      const start = new Date(b.periodStart);
      const end = new Date(b.periodEnd);
      return start <= now && end >= now;
    });
  if (currentBudgets.length === 0) return [];

  const alerts: AlertItem[] = [];

  // Per-budget lookups (versions + variance) run concurrently. Each budget
  // is one association; we still issue 2 storage calls per current-period
  // budget, but the prior implementation was identical at this point —
  // the F1 win is that the outer fan-out (one budgets query) stops
  // multiplying by associationCount.
  await Promise.all(
    currentBudgets.map(async (budget) => {
      const versions = await storage.getBudgetVersions(budget.id);
      const ratified = versions
        .filter((v) => v.status === "ratified")
        .sort((a, b) => b.versionNumber - a.versionNumber);
      const activeVersion = ratified[0];
      if (!activeVersion) return;

      let varianceRows: Awaited<ReturnType<typeof storage.getBudgetVariance>>;
      try {
        varianceRows = await storage.getBudgetVariance(budget.associationId, activeVersion.id);
      } catch {
        return;
      }

      for (const row of varianceRows) {
        if (!Number.isFinite(row.plannedAmount) || row.plannedAmount <= 0) continue;
        if (!Number.isFinite(row.actualAmount)) continue;
        const overspendAmount = row.actualAmount - row.plannedAmount;
        if (overspendAmount <= 0) continue;
        const overspendPct = (overspendAmount / row.plannedAmount) * 100;
        if (overspendPct <= OVERSPEND_THRESHOLD_PCT) continue;

        const severity: AlertSeverity =
          overspendPct > HIGH_THRESHOLD_PCT ? "high" : "medium";

        alerts.push({
          alertId: `budget-variance:budget_lines:${row.budgetLineId}`,
          associationId: budget.associationId,
          associationName: nameById.get(budget.associationId) ?? "",
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
    }),
  );

  return alerts;
}

export async function resolve(
  associationId: string,
  context: ResolveContext,
): Promise<AlertItem[]> {
  return resolveMany([{ id: associationId, name: context.associationName }], { now: context.now });
}
