/**
 * Pressing-Items scanner (founder-os#1256, Phase 1).
 *
 * Scans the canonical source-of-truth tables and produces / updates rows
 * in `pressing_items` so the dashboard widget + the AI chat opener can
 * render a board-attention feed without re-computing the joins each call.
 *
 * Four item classes (per the locked Phase 1 picks):
 *   - unidentified_txn   : bank_transactions with no reconciled_to_…_id
 *   - delinquency_rising : delinquency_escalations.current_stage > 1 OR
 *                          days_past_due >= 60
 *   - document_attention : vendors.insurance_expires_at within 30 days
 *   - compliance_deadline: delinquency_escalations.next_action_at within 14 days
 *                          (cheap proxy for "board action coming up";
 *                          additional sources extend incrementally)
 *
 * Idempotent by design: every detected source row maps to a deterministic
 * `dedupe_key`; an upsert keyed on (association_id, dedupe_key) replaces
 * the row in place. Source rows that no longer match auto-resolve via the
 * end-of-scan reaper (resolved_at = NOW() for any unseen dedupe_keys in
 * each class).
 */

import { and, eq, gt, gte, isNull, isNotNull, lte, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  associations,
  bankTransactions,
  delinquencyEscalations,
  pressingItems,
  vendors,
  type PressingItemActorRole,
  type PressingItemClass,
  PRESSING_ITEM_ROLE_LENS,
} from "@shared/schema";

const UNIDENTIFIED_TXN_LOOKBACK_DAYS = 60;
const VENDOR_INSURANCE_HORIZON_DAYS = 30;
const COMPLIANCE_HORIZON_DAYS = 14;
const DELINQUENCY_DAYS_PAST_DUE_THRESHOLD = 60;

export interface ScanResult {
  scanned: number;
  inserted: number;
  updated: number;
  resolved: number;
  perClass: Record<PressingItemClass, number>;
}

interface DetectedItem {
  associationId: string;
  itemClass: PressingItemClass;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string | null;
  actorRole: PressingItemActorRole;
  relatedRecordType: string | null;
  relatedRecordId: string | null;
  dedupeKey: string;
}

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

// ── Detection helpers (per class) ────────────────────────────────────────────

async function detectUnidentifiedTransactions(associationId: string): Promise<DetectedItem[]> {
  const cutoff = daysAgo(UNIDENTIFIED_TXN_LOOKBACK_DAYS);
  const rows = await db
    .select({
      id: bankTransactions.id,
      amountCents: bankTransactions.amountCents,
      date: bankTransactions.date,
      name: bankTransactions.name,
      merchantName: bankTransactions.merchantName,
    })
    .from(bankTransactions)
    .where(
      and(
        eq(bankTransactions.associationId, associationId),
        isNull(bankTransactions.reconciledToPaymentTransactionId),
        eq(bankTransactions.pending, 0),
        gte(bankTransactions.date, cutoff.toISOString().slice(0, 10)),
      ),
    );

  return rows.map((tx) => {
    const dollarAmount = (tx.amountCents / 100).toFixed(2);
    const merchant = tx.merchantName || tx.name || "(no merchant)";
    return {
      associationId,
      itemClass: "unidentified_txn" as const,
      severity: Math.abs(tx.amountCents) >= 50_000 ? "high" : "medium",
      title: `Unidentified $${dollarAmount} txn — ${merchant}`,
      description: `Bank transaction on ${tx.date} not yet matched to a payment in YCM. Treasurer should review + match or categorize.`,
      actorRole: "treasurer" as PressingItemActorRole,
      relatedRecordType: "bank_transaction",
      relatedRecordId: tx.id,
      dedupeKey: `unidentified_txn:${tx.id}`,
    };
  });
}

async function detectDelinquencyRising(associationId: string): Promise<DetectedItem[]> {
  const rows = await db
    .select({
      id: delinquencyEscalations.id,
      personId: delinquencyEscalations.personId,
      unitId: delinquencyEscalations.unitId,
      currentStage: delinquencyEscalations.currentStage,
      balance: delinquencyEscalations.balance,
      daysPastDue: delinquencyEscalations.daysPastDue,
    })
    .from(delinquencyEscalations)
    .where(
      and(
        eq(delinquencyEscalations.associationId, associationId),
        eq(delinquencyEscalations.status, "active"),
      ),
    );

  return rows
    .filter(
      (e) => e.currentStage > 1 || e.daysPastDue >= DELINQUENCY_DAYS_PAST_DUE_THRESHOLD,
    )
    .map((e) => {
      const severity: DetectedItem["severity"] =
        e.currentStage >= 3 || e.daysPastDue >= 120
          ? "critical"
          : e.currentStage >= 2 || e.daysPastDue >= 90
          ? "high"
          : "medium";
      return {
        associationId,
        itemClass: "delinquency_rising" as const,
        severity,
        title: `Owner ${e.daysPastDue}d past due ($${e.balance.toFixed(2)})`,
        description: `Delinquency stage ${e.currentStage}. Treasurer + president action recommended.`,
        actorRole: "treasurer" as PressingItemActorRole,
        relatedRecordType: "delinquency_escalation",
        relatedRecordId: e.id,
        dedupeKey: `delinquency_rising:${e.id}`,
      };
    });
}

async function detectDocumentAttention(associationId: string): Promise<DetectedItem[]> {
  const horizon = daysFromNow(VENDOR_INSURANCE_HORIZON_DAYS);
  const rows = await db
    .select({
      id: vendors.id,
      name: vendors.name,
      insuranceExpiresAt: vendors.insuranceExpiresAt,
    })
    .from(vendors)
    .where(
      and(
        eq(vendors.associationId, associationId),
        isNotNull(vendors.insuranceExpiresAt),
        lte(vendors.insuranceExpiresAt, horizon),
      ),
    );

  const now = new Date();
  return rows.map((v) => {
    const expires = v.insuranceExpiresAt!;
    const daysOut = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const severity: DetectedItem["severity"] =
      daysOut < 0 ? "critical" : daysOut <= 7 ? "high" : "medium";
    const title =
      daysOut < 0
        ? `Vendor "${v.name}" insurance EXPIRED ${Math.abs(daysOut)}d ago`
        : `Vendor "${v.name}" insurance expires in ${daysOut}d`;
    return {
      associationId,
      itemClass: "document_attention" as const,
      severity,
      title,
      description: `Request a Certificate of Insurance refresh from this vendor before it expires.`,
      actorRole: "secretary" as PressingItemActorRole,
      relatedRecordType: "vendor",
      relatedRecordId: v.id,
      dedupeKey: `document_attention:vendor_insurance:${v.id}`,
    };
  });
}

async function detectComplianceDeadlines(associationId: string): Promise<DetectedItem[]> {
  const horizon = daysFromNow(COMPLIANCE_HORIZON_DAYS);
  const rows = await db
    .select({
      id: delinquencyEscalations.id,
      nextActionAt: delinquencyEscalations.nextActionAt,
      currentStage: delinquencyEscalations.currentStage,
    })
    .from(delinquencyEscalations)
    .where(
      and(
        eq(delinquencyEscalations.associationId, associationId),
        eq(delinquencyEscalations.status, "active"),
        isNotNull(delinquencyEscalations.nextActionAt),
        lte(delinquencyEscalations.nextActionAt, horizon),
        gt(delinquencyEscalations.nextActionAt, new Date()),
      ),
    );

  return rows.map((e) => ({
    associationId,
    itemClass: "compliance_deadline" as const,
    severity: e.currentStage >= 3 ? "high" : "medium",
    title: `Delinquency stage-${e.currentStage} action due ${e.nextActionAt!.toISOString().slice(0, 10)}`,
    description: `Scheduled escalation step is approaching. Secretary / president action.`,
    actorRole: "secretary" as PressingItemActorRole,
    relatedRecordType: "delinquency_escalation",
    relatedRecordId: e.id,
    dedupeKey: `compliance_deadline:${e.id}`,
  }));
}

// ── Upsert + sweep ───────────────────────────────────────────────────────────

async function upsertItems(
  detected: DetectedItem[],
): Promise<{ inserted: number; updated: number }> {
  if (detected.length === 0) return { inserted: 0, updated: 0 };

  let inserted = 0;
  let updated = 0;

  for (const item of detected) {
    const existing = await db
      .select({ id: pressingItems.id })
      .from(pressingItems)
      .where(
        and(
          eq(pressingItems.associationId, item.associationId),
          eq(pressingItems.dedupeKey, item.dedupeKey),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(pressingItems)
        .set({
          itemClass: item.itemClass,
          severity: item.severity,
          title: item.title,
          description: item.description,
          actorRole: item.actorRole,
          relatedRecordType: item.relatedRecordType,
          relatedRecordId: item.relatedRecordId,
          resolvedAt: null, // re-open if previously resolved + still detected
          updatedAt: new Date(),
        })
        .where(eq(pressingItems.id, existing[0].id));
      updated += 1;
    } else {
      await db.insert(pressingItems).values({
        associationId: item.associationId,
        itemClass: item.itemClass,
        severity: item.severity,
        title: item.title,
        description: item.description,
        actorRole: item.actorRole,
        relatedRecordType: item.relatedRecordType,
        relatedRecordId: item.relatedRecordId,
        dedupeKey: item.dedupeKey,
      });
      inserted += 1;
    }
  }

  return { inserted, updated };
}

async function reapResolved(
  associationId: string,
  itemClass: PressingItemClass,
  stillSeenKeys: Set<string>,
): Promise<number> {
  const open = await db
    .select({ id: pressingItems.id, dedupeKey: pressingItems.dedupeKey })
    .from(pressingItems)
    .where(
      and(
        eq(pressingItems.associationId, associationId),
        eq(pressingItems.itemClass, itemClass),
        isNull(pressingItems.resolvedAt),
      ),
    );

  let resolved = 0;
  for (const row of open) {
    if (row.dedupeKey && !stillSeenKeys.has(row.dedupeKey)) {
      await db
        .update(pressingItems)
        .set({ resolvedAt: new Date(), updatedAt: new Date() })
        .where(eq(pressingItems.id, row.id));
      resolved += 1;
    }
  }
  return resolved;
}

/**
 * Scan a single association's source-of-truth tables and reconcile its
 * pressing_items rows.
 */
export async function scanAssociation(associationId: string): Promise<ScanResult> {
  const perClass: Record<PressingItemClass, number> = {
    unidentified_txn: 0,
    delinquency_rising: 0,
    document_attention: 0,
    compliance_deadline: 0,
  };

  const detectors: Array<{
    cls: PressingItemClass;
    fn: () => Promise<DetectedItem[]>;
  }> = [
    { cls: "unidentified_txn", fn: () => detectUnidentifiedTransactions(associationId) },
    { cls: "delinquency_rising", fn: () => detectDelinquencyRising(associationId) },
    { cls: "document_attention", fn: () => detectDocumentAttention(associationId) },
    { cls: "compliance_deadline", fn: () => detectComplianceDeadlines(associationId) },
  ];

  let totalDetected = 0;
  let totalInserted = 0;
  let totalUpdated = 0;
  let totalResolved = 0;

  for (const { cls, fn } of detectors) {
    const detected = await fn();
    perClass[cls] = detected.length;
    totalDetected += detected.length;

    const { inserted, updated } = await upsertItems(detected);
    totalInserted += inserted;
    totalUpdated += updated;

    const seen = new Set(detected.map((d) => d.dedupeKey));
    totalResolved += await reapResolved(associationId, cls, seen);
  }

  return {
    scanned: totalDetected,
    inserted: totalInserted,
    updated: totalUpdated,
    resolved: totalResolved,
    perClass,
  };
}

/**
 * Sweep every association. Called from server/index.ts automation tick.
 * Throws are caught at the call site so a per-association failure doesn't
 * jam the rest of the sweep.
 */
export async function runPressingItemsSweep(): Promise<{
  associationsScanned: number;
  totalInserted: number;
  totalUpdated: number;
  totalResolved: number;
}> {
  const rows = await db.select({ id: associations.id }).from(associations);
  let totalInserted = 0;
  let totalUpdated = 0;
  let totalResolved = 0;

  for (const a of rows) {
    try {
      const r = await scanAssociation(a.id);
      totalInserted += r.inserted;
      totalUpdated += r.updated;
      totalResolved += r.resolved;
    } catch (err) {
      console.error(`[pressing-items] scan failed for association ${a.id}:`, err);
    }
  }

  return {
    associationsScanned: rows.length,
    totalInserted,
    totalUpdated,
    totalResolved,
  };
}

/** Get visible (non-snoozed, non-resolved) pressing items, role-lensed. */
export async function getRoleLensedPressingItems(opts: {
  associationId: string;
  actorRole: PressingItemActorRole;
  limit?: number;
}): Promise<
  Array<{
    id: string;
    itemClass: string;
    severity: string;
    title: string;
    description: string | null;
    actorRole: string;
    relatedRecordType: string | null;
    relatedRecordId: string | null;
    snoozedUntil: Date | null;
    createdAt: Date;
  }>
> {
  const limit = opts.limit ?? 25;
  const visibleClasses = PRESSING_ITEM_ROLE_LENS[opts.actorRole];

  const rows = await db
    .select({
      id: pressingItems.id,
      itemClass: pressingItems.itemClass,
      severity: pressingItems.severity,
      title: pressingItems.title,
      description: pressingItems.description,
      actorRole: pressingItems.actorRole,
      relatedRecordType: pressingItems.relatedRecordType,
      relatedRecordId: pressingItems.relatedRecordId,
      snoozedUntil: pressingItems.snoozedUntil,
      createdAt: pressingItems.createdAt,
    })
    .from(pressingItems)
    .where(
      and(
        eq(pressingItems.associationId, opts.associationId),
        isNull(pressingItems.resolvedAt),
        sql`(${pressingItems.snoozedUntil} IS NULL OR ${pressingItems.snoozedUntil} < NOW())`,
      ),
    );

  // Severity-sorted: critical > high > medium > low; tiebreak by recency.
  const severityRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

  return rows
    .filter((r) => visibleClasses.includes(r.itemClass as PressingItemClass))
    .sort((a, b) => {
      const sev = (severityRank[a.severity] ?? 99) - (severityRank[b.severity] ?? 99);
      if (sev !== 0) return sev;
      return b.createdAt.getTime() - a.createdAt.getTime();
    })
    .slice(0, limit);
}
