/**
 * AR Aging report — DB-backed assembly (readiness P2 — "who owes what, and how
 * overdue").
 *
 * Loads an association's owner-ledger entries, groups them by UNIT, computes the
 * FIFO aging buckets (Current / 1-30 / 31-60 / 61-90 / 90+) via the pure
 * `computeArAging` math, and enriches each unit row with its unit number and the
 * names of its current owner(s).
 *
 * READ-ONLY: this module only SELECTs. It writes nothing — no migration, no
 * ledger mutation, no GL posting. It reads the owner ledger, which is the live
 * system of record for dues balances, so it works WITHOUT the GL feature flag
 * and WITHOUT an assessment run (it operates on whatever real charges/payments
 * already exist).
 *
 * Tenant isolation: every query filters by `associationId`.
 *
 * The UNIT is the balance-bearing entity (Phase 1 / P0-1), so aging groups by
 * `unitId`. Owner names come from `ownerships ⋈ persons` (the canonical unit↔
 * owner binding), NOT from the ledger's `personId` (which is now "tendered-by"
 * metadata, per shared/schema.ts).
 */
import { and, eq, lte, or, isNull, gte } from "drizzle-orm";
import { db } from "../db";
import { ownerLedgerEntries, ownerships, persons, units } from "@shared/schema";
import {
  computeArAging,
  toCents,
  type AgingLedgerEntry,
  type AgingBuckets,
} from "./ar-aging-math";

/** Aging buckets rendered as dollars (cents / 100) for the API surface. */
export interface AgingBucketsDollars {
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days90plus: number;
}

/** One unit's aging row in the API response (dollar amounts). */
export interface ArAgingUnitRow {
  unitId: string;
  unitNumber: string | null;
  ownerNames: string[];
  buckets: AgingBucketsDollars;
  totalOwed: number;
  oldestUnpaidDays: number;
  isDelinquent: boolean;
}

/** Association-wide aging summary (dollar amounts). */
export interface ArAgingReportSummary {
  totals: AgingBucketsDollars;
  totalAr: number;
  percentCurrent: number;
  unitsWithBalance: number;
  delinquentUnits: number;
}

export interface ArAgingReport {
  asOf: string;
  summary: ArAgingReportSummary;
  units: ArAgingUnitRow[];
}

function bucketsToDollars(b: AgingBuckets): AgingBucketsDollars {
  return {
    current: b.current / 100,
    days1to30: b.days1to30 / 100,
    days31to60: b.days31to60 / 100,
    days61to90: b.days61to90 / 100,
    days90plus: b.days90plus / 100,
  };
}

/**
 * Build the association's AR aging report from the live owner ledger.
 *
 * @param associationId  tenant scope (required)
 * @param asOf           the "as of" date for computing charge ages (default now)
 */
export async function buildArAgingReport(
  associationId: string,
  asOf: Date = new Date(),
): Promise<ArAgingReport> {
  // 1. Load every ledger entry for the association (tenant-scoped). We convert
  //    each stored `real` dollar amount to integer cents up front so all
  //    downstream math is cent-exact.
  const rows = await db
    .select({
      unitId: ownerLedgerEntries.unitId,
      entryType: ownerLedgerEntries.entryType,
      amount: ownerLedgerEntries.amount,
      postedAt: ownerLedgerEntries.postedAt,
    })
    .from(ownerLedgerEntries)
    .where(eq(ownerLedgerEntries.associationId, associationId));

  const entriesByUnit = new Map<string, AgingLedgerEntry[]>();
  for (const r of rows) {
    if (!r.unitId) continue;
    const list = entriesByUnit.get(r.unitId) ?? [];
    list.push({
      entryType: r.entryType,
      amountCents: toCents(r.amount),
      postedAt: r.postedAt instanceof Date ? r.postedAt : new Date(r.postedAt),
    });
    entriesByUnit.set(r.unitId, list);
  }

  // 2. Compute the aging (pure, integer-cents, FIFO oldest-first).
  const { rows: agingRows, summary } = computeArAging(entriesByUnit, asOf);

  // Nothing owed → short-circuit with an empty report.
  if (agingRows.length === 0) {
    return {
      asOf: asOf.toISOString(),
      summary: {
        totals: bucketsToDollars(summary.totals),
        totalAr: 0,
        percentCurrent: 0,
        unitsWithBalance: 0,
        delinquentUnits: 0,
      },
      units: [],
    };
  }

  const owingUnitIds = new Set(agingRows.map((r) => r.unitId));

  // 3. Resolve unit numbers for the owing units (tenant-scoped).
  const unitRows = await db
    .select({ id: units.id, unitNumber: units.unitNumber })
    .from(units)
    .where(eq(units.associationId, associationId));
  const unitNumberById = new Map<string, string | null>();
  for (const u of unitRows) unitNumberById.set(u.id, u.unitNumber);

  // 4. Resolve current owner name(s) per unit via ownerships ⋈ persons. Only
  //    ACTIVE ownerships (window covers asOf) count as current owners.
  const ownerRows = await db
    .select({
      unitId: ownerships.unitId,
      firstName: persons.firstName,
      lastName: persons.lastName,
    })
    .from(ownerships)
    .innerJoin(persons, eq(ownerships.personId, persons.id))
    .innerJoin(units, eq(ownerships.unitId, units.id))
    .where(
      and(
        eq(units.associationId, associationId),
        lte(ownerships.startDate, asOf),
        or(isNull(ownerships.endDate), gte(ownerships.endDate, asOf)),
      ),
    );
  const ownerNamesByUnit = new Map<string, string[]>();
  for (const o of ownerRows) {
    if (!owingUnitIds.has(o.unitId)) continue;
    const name = `${o.firstName ?? ""} ${o.lastName ?? ""}`.trim();
    if (!name) continue;
    const list = ownerNamesByUnit.get(o.unitId) ?? [];
    list.push(name);
    ownerNamesByUnit.set(o.unitId, list);
  }

  // 5. Assemble the API rows (already sorted most-overdue-first by computeArAging).
  const units_: ArAgingUnitRow[] = agingRows.map((r) => ({
    unitId: r.unitId,
    unitNumber: unitNumberById.get(r.unitId) ?? null,
    ownerNames: ownerNamesByUnit.get(r.unitId) ?? [],
    buckets: bucketsToDollars(r.buckets),
    totalOwed: r.totalOwedCents / 100,
    oldestUnpaidDays: r.oldestUnpaidDays,
    isDelinquent: r.isDelinquent,
  }));

  return {
    asOf: asOf.toISOString(),
    summary: {
      totals: bucketsToDollars(summary.totals),
      totalAr: summary.totalArCents / 100,
      percentCurrent: summary.percentCurrent,
      unitsWithBalance: summary.unitsWithBalance,
      delinquentUnits: summary.delinquentUnits,
    },
    units: units_,
  };
}
