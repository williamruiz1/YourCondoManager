/**
 * Automated late-fee assessment — P1-5 (Issue #212)
 *
 * Plugs into the unified assessment orchestrator as the "late-fee" rule type.
 *
 * ## Design
 *
 * A "late-fee rule" is a row in `late_fee_rules`.  We only auto-post for
 * associations whose `delinquency_settings.auto_late_fee_enabled = 1`.
 *
 * ### Lister
 * For every association that has auto late fees enabled:
 *   1. Fetch active `late_fee_rules` (is_active = 1).
 *   2. Find active `delinquency_escalations` whose balance > 0 and
 *      daysPastDue > rule.graceDays.
 *   3. Emit one (rule, unit, dueDate) entry per (rule × escalation).
 *      `dueDate` is set to `now` (the sweep's reference clock).
 *
 * ### Handler
 *   1. Idempotency check: skip if a `late-fee` ledger row already exists with
 *      referenceType = "late_fee_assessment" and
 *      referenceId = "<ruleId>:<unitId>:<periodKey>".
 *      `periodKey` = "YYYY-MM" of the sweep date — one fee per rule per
 *      unit per calendar month.
 *   2. Compute the fee (flat or percent), cap at `maxFee` when set.
 *   3. Insert a `late_fee_events` row (audit trail / alert feed).
 *   4. Return `ledgerEntryPayload` with entryType = "late-fee".
 *      The orchestrator inserts the `owner_ledger_entries` row.
 *
 * ### CT CIOA constraint (§ 47-244)
 * The `late_fee_rules.maxFee` column is the enforcement mechanism: the rule
 * editor is expected to validate that `maxFee` ≤ max(25, 5% of balance) or
 * that the association's declaration explicitly overrides the cap.  This
 * service simply respects whatever `maxFee` the rule carries — no additional
 * hard-coded cap — consistent with the permissive-with-acknowledgement
 * posture described in `docs/specs/collections-polish-scope-2026-04-26.md`.
 */

import { and, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "../db";
import {
  delinquencyEscalations,
  delinquencySettings,
  lateFeeEvents,
  lateFeeRules,
  ownerLedgerEntries,
  ownerships,
  type LateFeeRule,
} from "@shared/schema";
import type {
  RuleExecutionHandler,
  RuleExecutionLister,
  RuleExecutionOutcome,
} from "../assessment-execution";

// ---------------------------------------------------------------------------
// Public constants — idempotency key helpers
// ---------------------------------------------------------------------------

export const LATE_FEE_REFERENCE_TYPE = "late_fee_assessment";

/** Derive the calendar-month period key from a date.  One fee per (rule,
 * unit, month) is the idempotency grain. */
export function lateFeeAssessmentPeriodKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Canonical reference-id embedded in owner_ledger_entries for dedup. */
export function lateFeeAssessmentReferenceId(
  ruleId: string,
  unitId: string,
  periodKey: string,
): string {
  return `${ruleId}:${unitId}:${periodKey}`;
}

// ---------------------------------------------------------------------------
// Internal shape passed from lister → handler via ctx.rule
// ---------------------------------------------------------------------------

interface LateFeeRuleContext {
  rule: LateFeeRule;
  unitId: string;
  personId: string;
  balance: number;
  periodKey: string;
}

// ---------------------------------------------------------------------------
// Lister
// ---------------------------------------------------------------------------

export const lateFeeAssessmentLister: RuleExecutionLister = async ({
  now,
  associationIdFilter,
}) => {
  // Step 1: collect associations with auto_late_fee_enabled = 1
  const settingsRows = await db
    .select({
      associationId: delinquencySettings.associationId,
    })
    .from(delinquencySettings)
    .where(
      and(
        eq(delinquencySettings.autoLateFeeEnabled, 1),
        // If associationIdFilter is set, restrict to that association.
        // We filter in JS below because Drizzle doesn't allow conditional
        // where-clauses cleanly without building an array.
      ),
    );

  const assocIds = settingsRows
    .map((r) => r.associationId)
    .filter((id): id is string => id !== null);

  if (assocIds.length === 0) return [];

  const filteredAssocIds = associationIdFilter
    ? assocIds.filter((id) => id === associationIdFilter)
    : assocIds;

  if (filteredAssocIds.length === 0) return [];

  // Step 2: fetch active late-fee rules for those associations
  const allRules = await db
    .select()
    .from(lateFeeRules)
    .where(eq(lateFeeRules.isActive, 1));

  const rulesByAssoc = new Map<string, LateFeeRule[]>();
  for (const rule of allRules) {
    if (!filteredAssocIds.includes(rule.associationId)) continue;
    const arr = rulesByAssoc.get(rule.associationId) ?? [];
    arr.push(rule);
    rulesByAssoc.set(rule.associationId, arr);
  }

  // Step 3: fetch active delinquency escalations for those associations
  const escalations = await db
    .select()
    .from(delinquencyEscalations)
    .where(
      and(
        eq(delinquencyEscalations.status, "active"),
        gt(delinquencyEscalations.balance, 0),
      ),
    );

  const periodKey = lateFeeAssessmentPeriodKey(now);

  const expanded: Array<{
    associationId: string;
    ruleId: string;
    rule: unknown;
    unit: { id: string };
    dueDate: Date;
  }> = [];

  for (const esc of escalations) {
    if (!filteredAssocIds.includes(esc.associationId)) continue;
    const rules = rulesByAssoc.get(esc.associationId) ?? [];
    for (const rule of rules) {
      // Only emit entries where the balance is past the grace period.
      if (esc.daysPastDue <= rule.graceDays) continue;

      const ctx: LateFeeRuleContext = {
        rule,
        unitId: esc.unitId,
        personId: esc.personId,
        balance: esc.balance,
        periodKey,
      };

      expanded.push({
        associationId: esc.associationId,
        ruleId: rule.id,
        rule: ctx,
        unit: { id: esc.unitId },
        dueDate: now,
      });
    }
  }

  return expanded;
};

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const lateFeeAssessmentHandler: RuleExecutionHandler = async (ctx) => {
  const { rule, unitId, personId, balance, periodKey } =
    ctx.rule as LateFeeRuleContext;

  // 1. Idempotency guard — one charge per (rule, unit, month).
  const referenceId = lateFeeAssessmentReferenceId(rule.id, unitId, periodKey);

  const [existing] = await db
    .select({ id: ownerLedgerEntries.id })
    .from(ownerLedgerEntries)
    .where(
      and(
        eq(ownerLedgerEntries.associationId, ctx.associationId),
        eq(ownerLedgerEntries.entryType, "late-fee"),
        eq(ownerLedgerEntries.referenceType, LATE_FEE_REFERENCE_TYPE),
        eq(ownerLedgerEntries.referenceId, referenceId),
      ),
    )
    .limit(1);

  if (existing) {
    return {
      status: "skipped",
      amount: null,
      errorCode: "already_posted",
      errorMessage: `Late fee already posted for period ${periodKey}`,
    } satisfies RuleExecutionOutcome;
  }

  // 2. Resolve ownership (belt-and-suspenders: lister already pulled
  //    personId from the escalation row, but we verify it's still active).
  const [ownership] = await db
    .select({ id: ownerships.id, personId: ownerships.personId })
    .from(ownerships)
    .where(
      and(
        eq(ownerships.unitId, unitId),
        or(isNull(ownerships.endDate)),
      ),
    )
    .limit(1);

  // If no active ownership, use the personId from the escalation record.
  // This matches the existing delinquency-notice pattern.
  const resolvedPersonId = ownership?.personId ?? personId;

  // 3. Compute fee amount.
  let feeAmount: number =
    rule.feeType === "flat"
      ? rule.feeAmount
      : Number(((balance * rule.feeAmount) / 100).toFixed(2));

  if (rule.maxFee !== null && rule.maxFee !== undefined) {
    feeAmount = Math.min(feeAmount, rule.maxFee);
  }
  feeAmount = Math.max(0, feeAmount);

  if (feeAmount === 0) {
    return {
      status: "skipped",
      amount: 0,
      errorCode: "zero_fee",
      errorMessage: "Computed fee is zero; skipping",
    } satisfies RuleExecutionOutcome;
  }

  // 4. Insert a lateFeeEvents row (audit trail + alert feed).
  //    The ledger entry is inserted by the orchestrator from the returned
  //    ledgerEntryPayload — we only insert the events row here.
  await db.insert(lateFeeEvents).values({
    associationId: ctx.associationId,
    ruleId: rule.id,
    referenceType: LATE_FEE_REFERENCE_TYPE,
    referenceId,
    balanceAmount: balance,
    dueDate: ctx.dueDate,
    asOfDate: ctx.dueDate,
    calculatedFee: feeAmount,
  });

  return {
    status: "success",
    amount: feeAmount,
    ledgerEntryPayload: {
      associationId: ctx.associationId,
      unitId,
      personId: resolvedPersonId,
      entryType: "late-fee",
      amount: feeAmount,
      postedAt: ctx.dueDate,
      description: `Late fee — ${rule.name} (${periodKey})`,
      referenceType: LATE_FEE_REFERENCE_TYPE,
      referenceId,
    },
  } satisfies RuleExecutionOutcome;
};
