/**
 * Wave 7 — Assessment-execution shadow-write parity helper (4.3 Q3).
 *
 * Purpose:
 *   Compare the legacy `ownerLedgerEntries` that were actually posted in a
 *   window against the deferred `assessmentRunLog` rows that the unified
 *   orchestrator produced in shadow-write mode for the same window. Any
 *   drift (extra, missing, or mismatched-amount rows) surfaces as a
 *   `ParityReport` the admin ops endpoint exposes.
 *
 * Spec:
 *   docs/projects/platform-overhaul/decisions/4.3-recurring-assessment-rules-engine.md
 *   Q3 — Acceptance Criteria: "shadow-write parity test ... asserts
 *   identical ownerLedgerEntries + assessmentRunLog would-be rows for a
 *   representative sweep window."
 *
 * Scope:
 *   - Covers the two registered rule types: recurring charges and
 *     special-assessment installments.
 *   - Keys a legacy ledger row to an orchestrator row via
 *     (ruleType, ruleId, unitId). Amount comparison uses a 1-cent tolerance
 *     to absorb floating-point drift.
 *   - This helper is READ-ONLY. It must not write or mutate any data — it
 *     is invoked by tests AND by an admin-only ops GET endpoint.
 */

import { and, between, eq, inArray } from "drizzle-orm";

import {
  assessmentRunLog,
  ownerLedgerEntries,
  recurringChargeSchedules,
  type AssessmentRunLogRow,
} from "@shared/schema";

import { db } from "./db";
import { SPECIAL_ASSESSMENT_REFERENCE_TYPE } from "./assessment-execution";

export interface ParityReport {
  associationId: string;
  windowStart: Date;
  windowEnd: Date;
  legacyLedgerRowCount: number;
  shadowDeferredRowCount: number;
  /** Rows the legacy path posted that the orchestrator did not propose. */
  missingFromShadow: Array<{
    ruleType: "recurring" | "special-assessment";
    ruleId: string | null;
    unitId: string | null;
    amount: number;
    ledgerEntryId: string;
  }>;
  /** Rows the orchestrator proposed that the legacy path did not post. */
  missingFromLegacy: Array<{
    ruleType: "recurring" | "special-assessment";
    ruleId: string;
    unitId: string | null;
    amount: number | null;
    runLogId: string;
  }>;
  /** Paired rows whose amounts disagree outside tolerance. */
  amountMismatches: Array<{
    ruleType: "recurring" | "special-assessment";
    ruleId: string;
    unitId: string | null;
    legacyAmount: number;
    shadowAmount: number | null;
    ledgerEntryId: string;
    runLogId: string;
  }>;
  hasDrift: boolean;
}

interface NormalizedLedgerRow {
  ruleType: "recurring" | "special-assessment" | null;
  ruleId: string | null;
  unitId: string | null;
  amount: number;
  ledgerEntryId: string;
}

/**
 * Normalize a legacy ledger row into the (ruleType, ruleId, unitId) shape we
 * can compare against `assessmentRunLog`.
 *
 * Recurring charges post ledger rows with `referenceType='recurring_charge_schedule'`.
 * Special-assessment installments post ledger rows with
 * `referenceType='special_assessment_installment'` and a composite
 * `referenceId` of the form `<assessmentId>:<installmentNumber>:<unitId>`.
 */
function normalizeLedgerRow(row: {
  id: string;
  unitId: string;
  amount: number;
  referenceType: string | null;
  referenceId: string | null;
}): NormalizedLedgerRow {
  if (row.referenceType === "recurring_charge_schedule") {
    return {
      ruleType: "recurring",
      ruleId: row.referenceId ?? null,
      unitId: row.unitId,
      amount: row.amount,
      ledgerEntryId: row.id,
    };
  }
  if (row.referenceType === SPECIAL_ASSESSMENT_REFERENCE_TYPE) {
    const parts = row.referenceId?.split(":") ?? [];
    const assessmentId = parts[0] ?? null;
    return {
      ruleType: "special-assessment",
      ruleId: assessmentId,
      unitId: row.unitId,
      amount: row.amount,
      ledgerEntryId: row.id,
    };
  }
  return {
    ruleType: null,
    ruleId: row.referenceId ?? null,
    unitId: row.unitId,
    amount: row.amount,
    ledgerEntryId: row.id,
  };
}

function normKey(
  ruleType: string,
  ruleId: string | null,
  unitId: string | null,
): string {
  return `${ruleType}::${ruleId ?? ""}::${unitId ?? ""}`;
}

const AMOUNT_TOLERANCE = 0.01; // 1 cent

/**
 * Compare legacy ledger posts against shadow-write run-log rows in the given
 * window. Pure reader — no mutations.
 */
export async function compareShadowRuns(
  associationId: string,
  windowStart: Date,
  windowEnd: Date,
): Promise<ParityReport> {
  // Load legacy rows: only the reference types our two handlers produce.
  const rawLegacy = await db
    .select({
      id: ownerLedgerEntries.id,
      unitId: ownerLedgerEntries.unitId,
      amount: ownerLedgerEntries.amount,
      referenceType: ownerLedgerEntries.referenceType,
      referenceId: ownerLedgerEntries.referenceId,
    })
    .from(ownerLedgerEntries)
    .where(
      and(
        eq(ownerLedgerEntries.associationId, associationId),
        between(ownerLedgerEntries.postedAt, windowStart, windowEnd),
        inArray(ownerLedgerEntries.referenceType, [
          "recurring_charge_schedule",
          SPECIAL_ASSESSMENT_REFERENCE_TYPE,
        ]),
      ),
    );

  const legacy: NormalizedLedgerRow[] = rawLegacy
    .map(normalizeLedgerRow)
    .filter((row): row is NormalizedLedgerRow => row.ruleType !== null);

  // Load shadow rows: deferred status entries in the same window.
  const shadow = await db
    .select()
    .from(assessmentRunLog)
    .where(
      and(
        eq(assessmentRunLog.associationId, associationId),
        eq(assessmentRunLog.status, "deferred"),
        between(assessmentRunLog.runStartedAt, windowStart, windowEnd),
      ),
    );

  // Recurring-charge ledger rows have `referenceId = schedule.id`, which is
  // already the same key the orchestrator uses for recurring rules. Great —
  // no translation needed.
  //
  // Special-assessment ledger rows have `referenceId = <assessmentId>:<n>:<unitId>`,
  // which normalizeLedgerRow splits down to the assessmentId. The orchestrator
  // records ruleId = assessmentId (not the composite). They align.
  //
  // Note: because the orchestrator may emit MULTIPLE run-log rows per
  // (ruleType, ruleId, unitId) across installments, we bucket shadow rows by
  // the same key and flag any legacy row that has no corresponding shadow
  // bucket (or vice versa).

  const legacyBuckets = new Map<string, NormalizedLedgerRow[]>();
  for (const row of legacy) {
    const key = normKey(row.ruleType!, row.ruleId, row.unitId);
    const arr = legacyBuckets.get(key) ?? [];
    arr.push(row);
    legacyBuckets.set(key, arr);
  }

  const shadowBuckets = new Map<string, AssessmentRunLogRow[]>();
  for (const row of shadow) {
    const key = normKey(row.ruleType, row.ruleId, row.unitId);
    const arr = shadowBuckets.get(key) ?? [];
    arr.push(row);
    shadowBuckets.set(key, arr);
  }

  const missingFromShadow: ParityReport["missingFromShadow"] = [];
  const missingFromLegacy: ParityReport["missingFromLegacy"] = [];
  const amountMismatches: ParityReport["amountMismatches"] = [];

  for (const [key, legacyRows] of legacyBuckets) {
    const shadowRows = shadowBuckets.get(key) ?? [];
    if (shadowRows.length === 0) {
      for (const legacyRow of legacyRows) {
        missingFromShadow.push({
          ruleType: legacyRow.ruleType as "recurring" | "special-assessment",
          ruleId: legacyRow.ruleId,
          unitId: legacyRow.unitId,
          amount: legacyRow.amount,
          ledgerEntryId: legacyRow.ledgerEntryId,
        });
      }
      continue;
    }
    // Pair them by index, compare amounts within tolerance.
    const pairs = Math.min(legacyRows.length, shadowRows.length);
    for (let i = 0; i < pairs; i++) {
      const legacyRow = legacyRows[i];
      const shadowRow = shadowRows[i];
      const shadowAmount = shadowRow.amount;
      const drift =
        shadowAmount === null
          ? Number.POSITIVE_INFINITY
          : Math.abs(legacyRow.amount - shadowAmount);
      if (drift > AMOUNT_TOLERANCE) {
        amountMismatches.push({
          ruleType: legacyRow.ruleType as "recurring" | "special-assessment",
          ruleId: legacyRow.ruleId ?? "",
          unitId: legacyRow.unitId,
          legacyAmount: legacyRow.amount,
          shadowAmount,
          ledgerEntryId: legacyRow.ledgerEntryId,
          runLogId: shadowRow.id,
        });
      }
    }
    if (legacyRows.length > shadowRows.length) {
      for (let i = pairs; i < legacyRows.length; i++) {
        missingFromShadow.push({
          ruleType: legacyRows[i].ruleType as "recurring" | "special-assessment",
          ruleId: legacyRows[i].ruleId,
          unitId: legacyRows[i].unitId,
          amount: legacyRows[i].amount,
          ledgerEntryId: legacyRows[i].ledgerEntryId,
        });
      }
    } else if (shadowRows.length > legacyRows.length) {
      for (let i = pairs; i < shadowRows.length; i++) {
        missingFromLegacy.push({
          ruleType: shadowRows[i].ruleType,
          ruleId: shadowRows[i].ruleId,
          unitId: shadowRows[i].unitId,
          amount: shadowRows[i].amount,
          runLogId: shadowRows[i].id,
        });
      }
    }
  }

  // Any shadow bucket with no legacy pair is missingFromLegacy.
  for (const [key, shadowRows] of shadowBuckets) {
    if (!legacyBuckets.has(key)) {
      for (const shadowRow of shadowRows) {
        missingFromLegacy.push({
          ruleType: shadowRow.ruleType,
          ruleId: shadowRow.ruleId,
          unitId: shadowRow.unitId,
          amount: shadowRow.amount,
          runLogId: shadowRow.id,
        });
      }
    }
  }

  const hasDrift =
    missingFromShadow.length > 0 ||
    missingFromLegacy.length > 0 ||
    amountMismatches.length > 0;

  return {
    associationId,
    windowStart,
    windowEnd,
    legacyLedgerRowCount: legacy.length,
    shadowDeferredRowCount: shadow.length,
    missingFromShadow,
    missingFromLegacy,
    amountMismatches,
    hasDrift,
  };
}

// The `recurringChargeSchedules` import is intentionally kept — the helper
// may need it for richer drift reports in a follow-up. Silence unused-import
// lints without exporting.
void recurringChargeSchedules;
