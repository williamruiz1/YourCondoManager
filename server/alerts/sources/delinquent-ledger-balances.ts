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
 *
 * Wave 16b (5.4-F1): `resolveMany` runs one storage call per data source
 * and groups by associationId in JS — collapses N×3 storage round-trips
 * to 3 total per orchestrator pass.
 */

import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import { delinquencyThresholds } from "@shared/schema";
import { storage } from "../../storage";
import type { AlertItem, AlertSeverity } from "../types";
import { FEATURE_DOMAINS } from "../types";

const DEFAULT_DAYS_OVERDUE = 30;

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
  const associationIds = associations.map((a) => a.id);
  const nameById = new Map(associations.map((a) => [a.id, a.name]));

  // For the single-assoc path we keep the original storage call shape so
  // existing per-source mocks (which set up the summary + entries return
  // values with no IN-array semantics) still match. For the multi-assoc
  // path we issue one entries call covering everything and rebuild the
  // summary in JS.
  const isSingleAssoc = associations.length === 1;

  const [entriesAll, thresholdRows] = await Promise.all([
    isSingleAssoc
      ? storage.getOwnerLedgerEntries(associations[0].id)
      : storage.getOwnerLedgerEntries(),
    db
      .select()
      .from(delinquencyThresholds)
      .where(
        isSingleAssoc
          ? and(
              eq(delinquencyThresholds.associationId, associations[0].id),
              eq(delinquencyThresholds.isActive, 1),
            )
          : and(
              inArray(delinquencyThresholds.associationId, associationIds),
              eq(delinquencyThresholds.isActive, 1),
            ),
      )
      .catch(
        () =>
          [] as Array<{ associationId?: string; minimumDaysOverdue: number; isActive: number }>,
      ),
  ]);

  // Build per-association summary + earliest-charge maps. For single-assoc,
  // call storage.getOwnerLedgerSummary so the existing test mock for that
  // method remains the source of truth.
  const summaryByAssoc = new Map<string, Array<{ personId: string; unitId: string; balance: number }>>();
  if (isSingleAssoc) {
    const summary = await storage.getOwnerLedgerSummary(associations[0].id);
    summaryByAssoc.set(associations[0].id, summary);
  } else {
    // Group entries by association and rebuild the summary rollup in JS
    // (mirrors storage.getOwnerLedgerSummary's per-assoc logic).
    const byAssoc = new Map<string, typeof entriesAll>();
    for (const entry of entriesAll) {
      if (!nameById.has(entry.associationId)) continue;
      const list = byAssoc.get(entry.associationId) ?? [];
      list.push(entry);
      byAssoc.set(entry.associationId, list);
    }
    for (const [assocId, entries] of byAssoc.entries()) {
      const rollup = new Map<string, { personId: string; unitId: string; balance: number }>();
      for (const entry of entries) {
        const key = `${entry.personId}:${entry.unitId}`;
        const current =
          rollup.get(key) ?? { personId: entry.personId, unitId: entry.unitId, balance: 0 };
        current.balance += entry.amount;
        rollup.set(key, current);
      }
      summaryByAssoc.set(
        assocId,
        Array.from(rollup.values()).sort((a, b) => b.balance - a.balance),
      );
    }
  }

  // Per-association threshold (min active days-overdue) lookup.
  const thresholdByAssoc = new Map<string, number>();
  for (const t of thresholdRows as Array<{
    associationId?: string;
    minimumDaysOverdue: number;
    isActive: number;
  }>) {
    if (!t.associationId) continue;
    const current = thresholdByAssoc.get(t.associationId);
    if (current === undefined || t.minimumDaysOverdue < current) {
      thresholdByAssoc.set(t.associationId, t.minimumDaysOverdue);
    }
  }
  // Single-assoc legacy mock: rows may not include `associationId`. Use
  // any returned threshold rows as the threshold for that assoc.
  if (isSingleAssoc && !thresholdByAssoc.has(associations[0].id) && thresholdRows.length > 0) {
    const min = Math.min(
      ...(thresholdRows as Array<{ minimumDaysOverdue: number }>).map((t) => t.minimumDaysOverdue),
    );
    thresholdByAssoc.set(associations[0].id, min);
  }

  // Per-association earliest-charge index from entries.
  const earliestChargeByOwner = new Map<string, Date>();
  for (const entry of entriesAll) {
    if (entry.entryType === "payment" || entry.entryType === "credit") continue;
    if (!nameById.has(entry.associationId)) continue;
    const key = `${entry.associationId}:${entry.unitId}:${entry.personId}`;
    const postedAt = new Date(entry.postedAt);
    const current = earliestChargeByOwner.get(key);
    if (!current || postedAt < current) earliestChargeByOwner.set(key, postedAt);
  }

  const alerts: AlertItem[] = [];
  for (const assoc of associations) {
    const summary = summaryByAssoc.get(assoc.id) ?? [];
    const minDaysOverdue = thresholdByAssoc.get(assoc.id) ?? DEFAULT_DAYS_OVERDUE;

    for (const row of summary) {
      if (row.balance <= 0) continue;
      const key = `${assoc.id}:${row.unitId}:${row.personId}`;
      const earliest = earliestChargeByOwner.get(key);
      if (!earliest) continue;
      const daysOverdue = Math.floor((now.getTime() - earliest.getTime()) / (24 * 60 * 60 * 1000));
      if (daysOverdue < minDaysOverdue) continue;
      const severity: AlertSeverity =
        daysOverdue >= 90 ? "critical" : daysOverdue >= 60 ? "high" : "medium";
      alerts.push({
        alertId: `delinquent-ledger-balance:owner_ledger_summary:${row.unitId}:${row.personId}`,
        associationId: assoc.id,
        associationName: assoc.name,
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
      });
    }
  }

  return alerts;
}

export async function resolve(
  associationId: string,
  context: ResolveContext,
): Promise<AlertItem[]> {
  return resolveMany([{ id: associationId, name: context.associationName }], { now: context.now });
}
