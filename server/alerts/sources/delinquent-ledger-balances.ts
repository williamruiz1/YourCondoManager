/**
 * 4.1 Tier 1 resolver — delinquent owner ledger balances (4.1 Q1).
 *
 * Per the 4.1 Q1 resolution: "any unit past
 * `delinquencyThresholds.minimumDaysOverdue`." We interpret this as:
 *   for each (unitId, personId) with a positive balance, flag the unit as
 *   delinquent if the balance has been non-zero for at least
 *   `minimumDaysOverdue` days. The minimum threshold across all active
 *   thresholds for the association is used (most conservative gate).
 *
 * Resolver assigns:
 *   zone          = "financials"
 *   featureDomain = "financials.delinquency"
 *   ruleType      = "delinquent-ledger-balance"
 *   recordType    = "owner_ledger_summary"
 *   recordId      = `${unitId}:${personId}` (composite — ledger summary
 *                   has no single row id; this keeps the alertId stable
 *                   across resolver runs for the same owner/unit pair).
 *
 * `alertId` therefore is
 *   `delinquent-ledger-balance:owner_ledger_summary:<unitId>:<personId>`.
 */

import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import { delinquencyThresholds } from "@shared/schema";
import { storage } from "../../storage";
import type { AlertItem } from "../types";
import { FEATURE_DOMAINS } from "../types";

const DEFAULT_DAYS_OVERDUE = 30;

export async function resolve(
  associationId: string,
  context: { associationName: string; now?: Date },
): Promise<AlertItem[]> {
  const now = context.now ?? new Date();
  const [summary, entries, thresholds] = await Promise.all([
    storage.getOwnerLedgerSummary(associationId),
    storage.getOwnerLedgerEntries(associationId),
    db
      .select()
      .from(delinquencyThresholds)
      .where(and(eq(delinquencyThresholds.associationId, associationId), eq(delinquencyThresholds.isActive, 1)))
      .catch(() => [] as Array<{ minimumDaysOverdue: number; isActive: number }>),
  ]);

  const minDaysOverdue = thresholds.length > 0
    ? Math.min(...thresholds.map((t) => t.minimumDaysOverdue))
    : DEFAULT_DAYS_OVERDUE;

  // Index the earliest unpaid-charge posting per (unitId, personId) so we
  // can approximate "how long has this balance been delinquent?"
  const earliestChargeByOwner = new Map<string, Date>();
  for (const entry of entries) {
    if (entry.entryType === "payment" || entry.entryType === "credit") continue;
    const key = `${entry.unitId}:${entry.personId}`;
    const postedAt = new Date(entry.postedAt);
    const current = earliestChargeByOwner.get(key);
    if (!current || postedAt < current) earliestChargeByOwner.set(key, postedAt);
  }

  return summary
    .filter((row) => row.balance > 0)
    .filter((row) => {
      const key = `${row.unitId}:${row.personId}`;
      const earliest = earliestChargeByOwner.get(key);
      if (!earliest) return false;
      const daysOverdue = Math.floor((now.getTime() - earliest.getTime()) / (24 * 60 * 60 * 1000));
      return daysOverdue >= minDaysOverdue;
    })
    .map((row): AlertItem => {
      const key = `${row.unitId}:${row.personId}`;
      const earliest = earliestChargeByOwner.get(key) ?? now;
      const daysOverdue = Math.floor((now.getTime() - earliest.getTime()) / (24 * 60 * 60 * 1000));
      const severity = daysOverdue >= 90 ? "critical" : daysOverdue >= 60 ? "high" : "medium";
      return {
        alertId: `delinquent-ledger-balance:owner_ledger_summary:${row.unitId}:${row.personId}`,
        associationId,
        associationName: context.associationName,
        zone: "financials",
        featureDomain: FEATURE_DOMAINS.FINANCIALS_DELINQUENCY,
        ruleType: "delinquent-ledger-balance",
        recordType: "owner_ledger_summary",
        recordId: `${row.unitId}:${row.personId}`,
        severity,
        title: `Delinquent balance: $${row.balance.toFixed(2)}`,
        description: `Outstanding ${daysOverdue} days (threshold ${minDaysOverdue}d).`,
        createdAt: earliest,
        resolutionHref: `/app/financials/ledger?unitId=${row.unitId}&personId=${row.personId}`,
        sourceRecord: row,
      };
    });
}
