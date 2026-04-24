/**
 * Wave 7 — Unified assessment execution orchestrator (4.3 Q3).
 *
 * Spec:
 *   docs/projects/platform-overhaul/decisions/4.3-recurring-assessment-rules-engine.md
 *   — Q3 selects Hypothesis A (unified pipeline). This file is the
 *     orchestrator; rule-type-specific semantics live in pure handlers
 *     dispatched through a registry keyed by `ruleType`.
 *
 * Design contract:
 *   - Handlers are PURE. They read the world (via direct `db.select`), derive
 *     what to post, and return a `RuleExecutionOutcome` WITHOUT writing to
 *     `ownerLedgerEntries`. The orchestrator owns the ledger write. This is
 *     what makes shadow-write / dry-run safe: the same handler code runs
 *     whether the flag is on or off, and the orchestrator decides whether to
 *     materialize the outcome.
 *   - Every outcome (success, failure, skip, dry-run) produces exactly one
 *     `assessmentRunLog` row per (ruleType, ruleId, unitId, pass).
 *   - In `dryRun` mode:
 *       - The orchestrator writes `assessmentRunLog` rows with status
 *         'deferred' — this is the shadow-write parity window.
 *       - NO `ownerLedgerEntries` rows are inserted.
 *       - NO customer-visible side effects (no notifications, no emails).
 *     When the per-association feature flag
 *     `ASSESSMENT_EXECUTION_UNIFIED_<assoc>` (or the global flag) is ON, the
 *     orchestrator runs in real mode for that association and writes ledger
 *     entries (legacy path should skip that association).
 *
 * Scope note:
 *   Wave 7 shipped the orchestrator in shadow-write only. Wave 12
 *   (Phase 5.1 cleanup) retired the legacy functions
 *   (server/index.ts:runDueRecurringCharges and
 *   server/assessment-installments.ts:processSpecialAssessmentInstallments)
 *   and this orchestrator is now the sole poster.
 *   ASSESSMENT_EXECUTION_UNIFIED defaults ON;
 *   isUnifiedAssessmentExecutionEnabled remains exported only so callers
 *   can still flip a specific association OFF via env override for
 *   debugging.
 */

import { and, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";

import {
  assessmentRunLog,
  ownerLedgerEntries,
  ownerships,
  recurringChargeSchedules,
  specialAssessments,
  units,
  type RecurringChargeSchedule,
} from "@shared/schema";
import { getFeatureFlagForAssociation } from "@shared/feature-flags";

import { db } from "./db";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type AssessmentRuleType = "recurring" | "special-assessment";

export type AssessmentRunStatus =
  | "success"
  | "failed"
  | "retrying"
  | "skipped"
  | "deferred";

/**
 * Runtime context passed to a handler for a single (rule, unit, dueDate)
 * tuple. Handlers may chose to broaden this context via a typed narrowing —
 * e.g. special-assessment handler also carries `installmentNumber` — but the
 * orchestrator's registry contract is this base shape.
 */
export interface RuleExecutionContext<Rule = unknown> {
  associationId: string;
  rule: Rule;
  unit: { id: string };
  dueDate: Date;
  /** Metadata plumbed through the orchestrator onto the run log. */
  retryAttempt?: number;
  /** True when the orchestrator is running in shadow-write mode. Handlers
   * MUST NOT change behavior based on this — it is carried for observability
   * only. The orchestrator enforces the dry-run semantics. */
  dryRun?: boolean;
}

/**
 * Outcome returned by a handler. The handler does NOT perform ledger
 * inserts — it returns the payload the orchestrator should insert.
 *
 * - status = 'success': orchestrator inserts `ledgerEntryPayload` (unless in
 *   dry-run mode), then writes a run-log row. In dry-run mode the status on
 *   the run-log is coerced to 'deferred'.
 * - status = 'skipped' / 'failed': orchestrator writes only the run-log row.
 * - status = 'retrying' / 'deferred': reserved for orchestrator-side state
 *   transitions — handlers should not return these directly.
 */
export interface RuleExecutionOutcome {
  status: "success" | "failed" | "skipped";
  amount: number | null;
  /** Optional — required when status = 'success'. Shape matches
   * ownerLedgerEntries insert contract. Orchestrator will insert this and
   * set `ledgerEntryId` on the run-log row. */
  ledgerEntryPayload?: {
    associationId: string;
    unitId: string;
    personId: string;
    entryType: "charge" | "assessment" | "payment" | "late-fee" | "credit" | "adjustment";
    amount: number;
    postedAt: Date;
    description: string | null;
    referenceType: string | null;
    referenceId: string | null;
  };
  /** Optional machine-readable error code. */
  errorCode?: string | null;
  /** Optional human-readable error message. */
  errorMessage?: string | null;
}

export type RuleExecutionHandler = (
  ctx: RuleExecutionContext,
) => Promise<RuleExecutionOutcome>;

/**
 * Selection of eligible rules for a sweep. A handler-specific lister returns
 * a list of (rule, unit, dueDate) triples the orchestrator should dispatch.
 */
export type RuleExecutionLister = (opts: {
  now: Date;
  associationIdFilter?: string;
  ruleIdFilter?: string;
}) => Promise<Array<{
  associationId: string;
  ruleId: string;
  rule: unknown;
  unit: { id: string };
  dueDate: Date;
}>>;

interface RegisteredHandler {
  ruleType: AssessmentRuleType;
  handler: RuleExecutionHandler;
  lister: RuleExecutionLister;
}

// ---------------------------------------------------------------------------
// Handler registry
// ---------------------------------------------------------------------------

const handlerRegistry = new Map<AssessmentRuleType, RegisteredHandler>();

export function registerRuleHandler(
  ruleType: AssessmentRuleType,
  handler: RuleExecutionHandler,
  lister: RuleExecutionLister,
): void {
  handlerRegistry.set(ruleType, { ruleType, handler, lister });
}

export function getRegisteredRuleTypes(): AssessmentRuleType[] {
  return Array.from(handlerRegistry.keys());
}

/** Test helper. Not exported from an index — tests import it directly. */
export function __resetHandlerRegistryForTests__(): void {
  handlerRegistry.clear();
  registerDefaultHandlers();
}

// ---------------------------------------------------------------------------
// Recurring charges handler (refactored from server/index.ts:runDueRecurringCharges)
// ---------------------------------------------------------------------------

/**
 * Lists eligible recurring-charge rules. This mirrors the selection logic in
 * `server/index.ts:runDueRecurringCharges` — active schedules whose
 * `nextRunDate` is null or <= now.
 */
export const recurringChargesLister: RuleExecutionLister = async ({
  now,
  associationIdFilter,
  ruleIdFilter,
}) => {
  const filters = [
    eq(recurringChargeSchedules.status, "active"),
    or(
      isNull(recurringChargeSchedules.nextRunDate),
      lte(recurringChargeSchedules.nextRunDate, now),
    )!,
  ];
  if (associationIdFilter) {
    filters.push(eq(recurringChargeSchedules.associationId, associationIdFilter));
  }
  if (ruleIdFilter) {
    filters.push(eq(recurringChargeSchedules.id, ruleIdFilter));
  }
  const dueSchedules = await db
    .select()
    .from(recurringChargeSchedules)
    .where(and(...filters));

  // Expand (schedule -> target units). A null unitId means all units in the
  // association.
  const assocIdsNeedingAll = Array.from(
    new Set(dueSchedules.filter((s) => !s.unitId).map((s) => s.associationId)),
  );
  const unitsByAssoc = new Map<string, string[]>();
  if (assocIdsNeedingAll.length > 0) {
    const rows = await db
      .select({ id: units.id, associationId: units.associationId })
      .from(units)
      .where(inArray(units.associationId, assocIdsNeedingAll));
    for (const row of rows) {
      const arr = unitsByAssoc.get(row.associationId) ?? [];
      arr.push(row.id);
      unitsByAssoc.set(row.associationId, arr);
    }
  }

  const expanded: Array<{
    associationId: string;
    ruleId: string;
    rule: unknown;
    unit: { id: string };
    dueDate: Date;
  }> = [];
  for (const schedule of dueSchedules) {
    const unitIds = schedule.unitId
      ? [schedule.unitId]
      : unitsByAssoc.get(schedule.associationId) ?? [];
    for (const unitId of unitIds) {
      expanded.push({
        associationId: schedule.associationId,
        ruleId: schedule.id,
        rule: schedule,
        unit: { id: unitId },
        dueDate: now,
      });
    }
  }
  return expanded;
};

/**
 * Pure handler: derives the ledger payload for a single (recurring rule,
 * unit, dueDate). Does NOT write to the ledger — orchestrator owns that.
 */
export const recurringChargesHandler: RuleExecutionHandler = async (ctx) => {
  const schedule = ctx.rule as RecurringChargeSchedule;

  // Resolve active ownership for the unit. If none, skip.
  const [ownership] = await db
    .select()
    .from(ownerships)
    .where(and(eq(ownerships.unitId, ctx.unit.id), isNull(ownerships.endDate)))
    .limit(1);

  if (!ownership) {
    return {
      status: "skipped",
      amount: schedule.amount,
      errorCode: "no_active_ownership",
      errorMessage: "No active ownership found",
    };
  }

  return {
    status: "success",
    amount: schedule.amount,
    ledgerEntryPayload: {
      associationId: schedule.associationId,
      unitId: ctx.unit.id,
      personId: ownership.personId,
      entryType: schedule.entryType,
      amount: schedule.amount,
      postedAt: ctx.dueDate,
      description: schedule.chargeDescription,
      referenceType: "recurring_charge_schedule",
      referenceId: schedule.id,
    },
  };
};

// ---------------------------------------------------------------------------
// Special-assessment handler (refactored from
// server/assessment-installments.ts:processSpecialAssessmentInstallments)
// ---------------------------------------------------------------------------

export const SPECIAL_ASSESSMENT_REFERENCE_TYPE =
  "special_assessment_installment";

function addUtcMonths(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const target = new Date(Date.UTC(year, month + months, 1, 12, 0, 0, 0));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12, 0, 0, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target;
}

function getDueInstallments(
  assessment: {
    startDate: Date | string;
    endDate: Date | string | null;
    installmentCount: number;
  },
  asOf: Date,
): Array<{ installmentNumber: number; dueDate: Date }> {
  const startDate = new Date(assessment.startDate);
  if (!Number.isFinite(startDate.getTime()) || assessment.installmentCount < 1) {
    return [];
  }
  const endDate = assessment.endDate ? new Date(assessment.endDate) : null;
  if (endDate && !Number.isFinite(endDate.getTime())) {
    return [];
  }
  const out: Array<{ installmentNumber: number; dueDate: Date }> = [];
  for (let n = 1; n <= assessment.installmentCount; n++) {
    const dueDate = addUtcMonths(startDate, n - 1);
    if (endDate && dueDate > endDate) break;
    if (dueDate > asOf) break;
    out.push({ installmentNumber: n, dueDate });
  }
  return out;
}

function getInstallmentAmount(
  totalAmount: number,
  installmentCount: number,
  installmentNumber: number,
): number {
  const totalCents = Math.round(totalAmount * 100);
  const baseCents = Math.floor(totalCents / installmentCount);
  if (installmentNumber < installmentCount) {
    return Number((baseCents / 100).toFixed(2));
  }
  const allocatedBeforeFinal = baseCents * (installmentCount - 1);
  return Number(((totalCents - allocatedBeforeFinal) / 100).toFixed(2));
}

interface SpecialAssessmentRuleShape {
  id: string;
  associationId: string;
  name: string;
  totalAmount: number;
  startDate: Date | string;
  endDate: Date | string | null;
  installmentCount: number;
  excludedUnitIdsJson: string[];
  installmentNumber: number;
}

export const specialAssessmentsLister: RuleExecutionLister = async ({
  now,
  associationIdFilter,
  ruleIdFilter,
}) => {
  const filters = [
    eq(specialAssessments.isActive, 1),
    eq(specialAssessments.autoPostEnabled, 1),
  ];
  if (associationIdFilter) {
    filters.push(eq(specialAssessments.associationId, associationIdFilter));
  }
  if (ruleIdFilter) {
    filters.push(eq(specialAssessments.id, ruleIdFilter));
  }
  const assessments = await db
    .select()
    .from(specialAssessments)
    .where(and(...filters));

  const expanded: Array<{
    associationId: string;
    ruleId: string;
    rule: unknown;
    unit: { id: string };
    dueDate: Date;
  }> = [];

  const assocIds = Array.from(new Set(assessments.map((a) => a.associationId)));
  if (assocIds.length === 0) return expanded;

  const associationUnits = await db
    .select({ id: units.id, associationId: units.associationId })
    .from(units)
    .where(inArray(units.associationId, assocIds));
  const unitsByAssoc = new Map<string, Array<{ id: string }>>();
  for (const u of associationUnits) {
    const arr = unitsByAssoc.get(u.associationId) ?? [];
    arr.push({ id: u.id });
    unitsByAssoc.set(u.associationId, arr);
  }

  for (const assessment of assessments) {
    const due = getDueInstallments(assessment, now);
    if (due.length === 0) continue;
    const unitsForAssoc = unitsByAssoc.get(assessment.associationId) ?? [];
    const excluded = new Set(
      Array.isArray(assessment.excludedUnitIdsJson)
        ? assessment.excludedUnitIdsJson
        : [],
    );
    for (const installment of due) {
      for (const unit of unitsForAssoc) {
        if (excluded.has(unit.id)) continue;
        const ruleShape: SpecialAssessmentRuleShape = {
          id: assessment.id,
          associationId: assessment.associationId,
          name: assessment.name,
          totalAmount: assessment.totalAmount,
          startDate: assessment.startDate,
          endDate: assessment.endDate ?? null,
          installmentCount: assessment.installmentCount,
          excludedUnitIdsJson: Array.isArray(assessment.excludedUnitIdsJson)
            ? (assessment.excludedUnitIdsJson as string[])
            : [],
          installmentNumber: installment.installmentNumber,
        };
        expanded.push({
          associationId: assessment.associationId,
          ruleId: assessment.id,
          rule: ruleShape,
          unit: { id: unit.id },
          dueDate: installment.dueDate,
        });
      }
    }
  }
  return expanded;
};

export const specialAssessmentsHandler: RuleExecutionHandler = async (ctx) => {
  const rule = ctx.rule as SpecialAssessmentRuleShape;

  // Idempotency guard: skip if an equivalent ledger entry already exists
  // (same referenceId). This mirrors the legacy dedup in
  // processSpecialAssessmentInstallments.
  const referenceId = `${rule.id}:${rule.installmentNumber}:${ctx.unit.id}`;
  const [existing] = await db
    .select({ id: ownerLedgerEntries.id })
    .from(ownerLedgerEntries)
    .where(
      and(
        eq(ownerLedgerEntries.associationId, ctx.associationId),
        eq(ownerLedgerEntries.referenceType, SPECIAL_ASSESSMENT_REFERENCE_TYPE),
        eq(ownerLedgerEntries.referenceId, referenceId),
      ),
    )
    .limit(1);
  if (existing) {
    return {
      status: "skipped",
      amount: null,
      errorCode: "already_posted",
      errorMessage: "Ledger entry already exists for this installment",
    };
  }

  // Resolve the ownership active on the due date.
  const ownershipRows = await db
    .select()
    .from(ownerships)
    .where(
      and(
        eq(ownerships.unitId, ctx.unit.id),
        or(isNull(ownerships.endDate), gte(ownerships.endDate, ctx.dueDate)),
      ),
    );
  const sorted = [...ownershipRows]
    .filter((o) => new Date(o.startDate) <= ctx.dueDate)
    .sort((a, b) => {
      const startDelta =
        new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
      if (startDelta !== 0) return startDelta;
      return (b.ownershipPercentage ?? 0) - (a.ownershipPercentage ?? 0);
    });
  const ownership = sorted[0];

  if (!ownership) {
    return {
      status: "skipped",
      amount: null,
      errorCode: "no_active_ownership",
      errorMessage: "No active ownership found for due date",
    };
  }

  const amount = getInstallmentAmount(
    rule.totalAmount,
    rule.installmentCount,
    rule.installmentNumber,
  );

  const description =
    rule.installmentCount > 1
      ? `${rule.name} - installment ${rule.installmentNumber} of ${rule.installmentCount}`
      : rule.name;

  return {
    status: "success",
    amount,
    ledgerEntryPayload: {
      associationId: ctx.associationId,
      unitId: ctx.unit.id,
      personId: ownership.personId,
      entryType: "assessment",
      amount,
      postedAt: ctx.dueDate,
      description,
      referenceType: SPECIAL_ASSESSMENT_REFERENCE_TYPE,
      referenceId,
    },
  };
};

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export interface SweepOptions {
  /** When true, run in SHADOW-WRITE mode: no ownerLedgerEntries inserts;
   * run-log rows are written with status='deferred' regardless of handler
   * outcome. This is the parity window before flipping the flag ON. */
  dryRun?: boolean;
  /** Restrict sweep to a single association. */
  associationId?: string;
  /** Explicit 'now' for deterministic testing. */
  now?: Date;
  /** Per-rule-type filter. Empty/undefined = all registered rule types. */
  ruleTypes?: AssessmentRuleType[];
}

export interface SweepSummary {
  dryRun: boolean;
  totalDispatched: number;
  perStatus: Record<AssessmentRunStatus, number>;
  runLogRowIds: string[];
}

function emptyStatusMap(): Record<AssessmentRunStatus, number> {
  return {
    success: 0,
    failed: 0,
    retrying: 0,
    skipped: 0,
    deferred: 0,
  };
}

/**
 * Orchestrate execution of all registered rule types.
 *
 * In shadow-write mode (dryRun = true) the orchestrator writes `assessmentRunLog`
 * rows with status='deferred' and does NOT touch ownerLedgerEntries. In real
 * mode it writes the ledger entry first (on success), captures its id, then
 * writes the run-log row.
 */
export async function runSweep(opts: SweepOptions = {}): Promise<SweepSummary> {
  const now = opts.now ?? new Date();
  const dryRun = opts.dryRun === true;
  const types = opts.ruleTypes ?? getRegisteredRuleTypes();

  const summary: SweepSummary = {
    dryRun,
    totalDispatched: 0,
    perStatus: emptyStatusMap(),
    runLogRowIds: [],
  };

  for (const ruleType of types) {
    const registered = handlerRegistry.get(ruleType);
    if (!registered) continue;

    const eligible = await registered.lister({
      now,
      associationIdFilter: opts.associationId,
    });

    for (const entry of eligible) {
      summary.totalDispatched++;
      const runRow = await executeSingle(registered, entry, now, dryRun);
      summary.runLogRowIds.push(runRow.id);
      summary.perStatus[runRow.status] =
        (summary.perStatus[runRow.status] ?? 0) + 1;
    }
  }

  return summary;
}

/**
 * Run a single rule on demand. If `unitId` is omitted, the orchestrator
 * expands the rule to all eligible units (same semantics as runSweep for
 * that rule).
 */
export interface RunOnDemandOptions {
  ruleType: AssessmentRuleType;
  ruleId: string;
  associationId: string;
  dryRun?: boolean;
  now?: Date;
}

export async function runOnDemand(
  opts: RunOnDemandOptions,
): Promise<SweepSummary> {
  const registered = handlerRegistry.get(opts.ruleType);
  if (!registered) {
    throw new Error(`No handler registered for rule type: ${opts.ruleType}`);
  }
  const now = opts.now ?? new Date();
  const dryRun = opts.dryRun === true;

  const eligible = await registered.lister({
    now,
    associationIdFilter: opts.associationId,
    ruleIdFilter: opts.ruleId,
  });

  const summary: SweepSummary = {
    dryRun,
    totalDispatched: 0,
    perStatus: emptyStatusMap(),
    runLogRowIds: [],
  };

  for (const entry of eligible) {
    summary.totalDispatched++;
    const runRow = await executeSingle(registered, entry, now, dryRun);
    summary.runLogRowIds.push(runRow.id);
    summary.perStatus[runRow.status] =
      (summary.perStatus[runRow.status] ?? 0) + 1;
  }

  return summary;
}

async function executeSingle(
  registered: RegisteredHandler,
  entry: {
    associationId: string;
    ruleId: string;
    rule: unknown;
    unit: { id: string };
    dueDate: Date;
  },
  runStartedAt: Date,
  dryRun: boolean,
): Promise<{ id: string; status: AssessmentRunStatus }> {
  let outcome: RuleExecutionOutcome;
  try {
    outcome = await registered.handler({
      associationId: entry.associationId,
      rule: entry.rule,
      unit: entry.unit,
      dueDate: entry.dueDate,
      retryAttempt: 0,
      dryRun,
    });
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : String(err ?? "unknown error");
    outcome = {
      status: "failed",
      amount: null,
      errorCode: "handler_threw",
      errorMessage,
    };
  }

  let ledgerEntryId: string | null = null;
  if (outcome.status === "success" && !dryRun && outcome.ledgerEntryPayload) {
    try {
      const [inserted] = await db
        .insert(ownerLedgerEntries)
        .values(outcome.ledgerEntryPayload)
        .returning();
      ledgerEntryId = inserted.id;
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : String(err ?? "unknown error");
      outcome = {
        status: "failed",
        amount: outcome.amount,
        errorCode: "ledger_insert_failed",
        errorMessage,
      };
    }
  }

  // Resolve the run-log status. In dry-run mode everything routes to
  // 'deferred' — that is the parity-window signal.
  let runLogStatus: AssessmentRunStatus;
  if (dryRun) {
    runLogStatus = "deferred";
  } else {
    runLogStatus = outcome.status;
  }

  const [logRow] = await db
    .insert(assessmentRunLog)
    .values({
      associationId: entry.associationId,
      ruleType: registered.ruleType,
      ruleId: entry.ruleId,
      unitId: entry.unit.id,
      runStartedAt,
      runCompletedAt: new Date(),
      status: runLogStatus,
      amount: outcome.amount,
      ledgerEntryId,
      errorCode: outcome.errorCode ?? null,
      errorMessage: outcome.errorMessage ?? null,
      retryAttempt: 0,
    })
    .returning({ id: assessmentRunLog.id });

  return { id: logRow.id, status: runLogStatus };
}

// ---------------------------------------------------------------------------
// Default-handler registration
// ---------------------------------------------------------------------------

function registerDefaultHandlers(): void {
  registerRuleHandler("recurring", recurringChargesHandler, recurringChargesLister);
  registerRuleHandler(
    "special-assessment",
    specialAssessmentsHandler,
    specialAssessmentsLister,
  );
}

registerDefaultHandlers();

// ---------------------------------------------------------------------------
// Shadow-write wiring helper (consumed by server/index.ts:runAutomationSweep)
// ---------------------------------------------------------------------------

/**
 * Per-association gating. Returns true when the unified orchestrator should
 * run in REAL mode for this association (legacy functions should skip).
 * Returns false when the legacy path should run AND the orchestrator should
 * shadow-write (dryRun=true).
 */
export function isUnifiedAssessmentExecutionEnabled(
  associationId: string,
): boolean {
  return getFeatureFlagForAssociation(
    "ASSESSMENT_EXECUTION_UNIFIED",
    associationId,
  );
}

/**
 * Convenience shadow-write entry point invoked from runAutomationSweep after
 * the legacy posters have run. Runs the unified orchestrator in dry-run mode
 * against every association whose flag is still OFF — producing
 * `assessmentRunLog` rows with status='deferred' that the parity helper
 * compares against real ledger entries.
 *
 * Errors are caught and logged; this path must NEVER throw out of the
 * automation sweep.
 */
export async function runShadowWriteForSweep(
  now: Date = new Date(),
): Promise<SweepSummary | null> {
  try {
    return await runSweep({ dryRun: true, now });
  } catch (err: unknown) {
    // eslint-disable-next-line no-console
    console.error("[assessment-execution] shadow-write sweep failed:", err);
    return null;
  }
}
