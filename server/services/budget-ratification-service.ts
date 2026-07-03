/**
 * Statutory budget-ratification service — Connecticut CGS §47-261e — BUILD #8015
 *
 * Connecticut General Statutes §47-261e ("Adoption of budgets; special
 * assessments") governs how a common-interest community's budget actually
 * takes effect. It is a NEGATIVE-OPTION ("owner-veto") scheme: after the
 * executive board adopts a proposed budget, it must distribute a summary to all
 * owners and hold a ratification meeting — and the budget is ratified UNLESS a
 * majority of all unit owners affirmatively rejects it. YCM's pre-existing
 * "ratified" status was just an internal admin flip; this service wires the
 * statutory flow over the existing budgets/budgetVersions + elections/voting
 * engines so the version status reflects a real owner vote.
 *
 * ## Design — pure functions + thin DB glue
 *
 * Per the repo's test reality (no live DB — every test mocks `../db`), ALL
 * statutory LOGIC lives in PURE FUNCTIONS in this file. They are the actual
 * code paths the route/storage glue calls, and they are what the unit tests
 * exercise. The DB-orchestration helpers at the bottom are thin glue
 * (typecheck-validated, not unit-tested) that wrap the pure functions around
 * Drizzle inserts/updates — exactly the pattern used by the §47-258 build.
 *
 * Statutory map:
 *   §47-261e(a) — within 30 days of adoption the board distributes a budget
 *                 summary (INCLUDING a reserve statement) to all owners, and
 *                 sets a ratification meeting NOT LESS than 10 nor MORE than 60
 *                 days after mailing the summary. The budget is ratified UNLESS
 *                 a majority of all unit owners (or any larger number in the
 *                 declaration) rejects it, whether or not a quorum is present.
 *                 If rejected, the budget last ratified by owners CONTINUES.
 *   §47-261e(b) — a special assessment follows the (a) procedure when it
 *                 meets/exceeds a threshold (default 15% of the current annual
 *                 budget); below the threshold the board may impose it without
 *                 an owner ratification vote.
 *   §47-261e(c) — an EMERGENCY special assessment is effective immediately,
 *                 WITHOUT owner ratification, on a TWO-THIRDS board vote plus a
 *                 written emergency attestation.
 *
 * OUT OF SCOPE (do not build here): §47-261e(d)/(e) loan-security owner-approval
 * mechanics (smaller follow-on per the dispatch), and legal sign-off.
 *
 * NOTE ON THE 15% THRESHOLD: the special-assessment threshold is the value the
 * dispatch directs (15%) and is exposed as an overridable parameter / column so
 * a declaration-specific or amended statutory figure can be configured without
 * a code change. The §-citations are authoritative; the numeric threshold is
 * configurable.
 */

import { and, eq, isNull, desc } from "drizzle-orm";
import { db } from "../db";
import {
  budgetRatifications,
  budgetRatificationSummarySends,
  budgetVersions,
  units,
  ownerships,
  persons,
  type BudgetRatification,
} from "@shared/schema";

// ===========================================================================
// Date helpers (pure)
// ===========================================================================

export function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function daysBetween(from: Date, to: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

// ===========================================================================
// Statutory constants
// ===========================================================================

/** §47-261e(a) — owner budget summary due within 30 days of adoption. */
export const SUMMARY_DISTRIBUTION_DAYS = 30;
/** §47-261e(a) — ratification meeting no sooner than 10 days after the summary. */
export const RATIFICATION_WINDOW_MIN_DAYS = 10;
/** §47-261e(a) — ratification meeting no later than 60 days after the summary. */
export const RATIFICATION_WINDOW_MAX_DAYS = 60;
/** §47-261e(b) — default special-assessment ratification threshold (% of budget). */
export const DEFAULT_SPECIAL_ASSESSMENT_THRESHOLD_PCT = 15;
/** §47-261e(c) — board super-majority required to impose an emergency assessment. */
export const EMERGENCY_BOARD_FRACTION = 2 / 3;

// ===========================================================================
// §47-261e(a) — summary distribution + ratification window (pure)
// ===========================================================================

/** §47-261e(a): the 30-day deadline to distribute the owner budget summary. */
export function computeSummaryDueDate(adoptedAt: Date): Date {
  return addDays(adoptedAt, SUMMARY_DISTRIBUTION_DAYS);
}

export interface RatificationWindow {
  /** Earliest valid meeting date — summary + 10 days. */
  minDate: Date;
  /** Latest valid meeting date — summary + 60 days. */
  maxDate: Date;
  minDays: number;
  maxDays: number;
}

/** §47-261e(a): the 10–60-day ratification-meeting window after the summary. */
export function computeRatificationWindow(summarySentAt: Date): RatificationWindow {
  return {
    minDate: addDays(summarySentAt, RATIFICATION_WINDOW_MIN_DAYS),
    maxDate: addDays(summarySentAt, RATIFICATION_WINDOW_MAX_DAYS),
    minDays: RATIFICATION_WINDOW_MIN_DAYS,
    maxDays: RATIFICATION_WINDOW_MAX_DAYS,
  };
}

export interface MeetingDateValidation {
  valid: boolean;
  reason?: string;
  daysAfterSummary: number;
  window: RatificationWindow;
}

/** §47-261e(a): a meeting must be 10–60 days after the summary mailing. */
export function validateMeetingDate(summarySentAt: Date, meetingDate: Date): MeetingDateValidation {
  const window = computeRatificationWindow(summarySentAt);
  const daysAfterSummary = daysBetween(summarySentAt, meetingDate);
  if (daysAfterSummary < RATIFICATION_WINDOW_MIN_DAYS) {
    return {
      valid: false,
      reason: `§47-261e(a): the ratification meeting must be at least ${RATIFICATION_WINDOW_MIN_DAYS} days after the summary mailing (got ${daysAfterSummary}).`,
      daysAfterSummary,
      window,
    };
  }
  if (daysAfterSummary > RATIFICATION_WINDOW_MAX_DAYS) {
    return {
      valid: false,
      reason: `§47-261e(a): the ratification meeting must be no more than ${RATIFICATION_WINDOW_MAX_DAYS} days after the summary mailing (got ${daysAfterSummary}).`,
      daysAfterSummary,
      window,
    };
  }
  return { valid: true, daysAfterSummary, window };
}

// ===========================================================================
// §47-261e(a) — negative-option tally (pure)
// ===========================================================================

/**
 * §47-261e(a): the number of REJECT votes required to defeat the budget — a
 * majority of ALL unit owners (more than half), regardless of how many vote.
 * A declaration may specify a LARGER number; pass `declarationOverrideCount`.
 */
export function computeRejectThreshold(
  totalOwnerCount: number,
  declarationOverrideCount?: number | null,
): number {
  const majorityOfAll = Math.floor(totalOwnerCount / 2) + 1;
  if (declarationOverrideCount != null && declarationOverrideCount > majorityOfAll) {
    return declarationOverrideCount;
  }
  return majorityOfAll;
}

export interface NegativeOptionTally {
  outcome: "ratified" | "rejected";
  rejected: boolean;
  totalOwnerCount: number;
  rejectVoteCount: number;
  rejectThresholdCount: number;
  rule: string;
}

/**
 * §47-261e(a): the budget is RATIFIED unless a majority of all unit owners
 * affirmatively rejects it (whether or not a quorum is present). Non-votes
 * count toward ratification — that is the "negative option" / owner-veto.
 */
export function tallyNegativeOption(params: {
  totalOwnerCount: number;
  rejectVoteCount: number;
  declarationOverrideCount?: number | null;
  rule?: string;
}): NegativeOptionTally {
  const { totalOwnerCount, rejectVoteCount } = params;
  const rejectThresholdCount = computeRejectThreshold(totalOwnerCount, params.declarationOverrideCount);
  const rejected = rejectVoteCount >= rejectThresholdCount;
  return {
    outcome: rejected ? "rejected" : "ratified",
    rejected,
    totalOwnerCount,
    rejectVoteCount,
    rejectThresholdCount,
    rule: params.rule ?? "majority-of-all",
  };
}

/**
 * §47-261e(a): on rejection, the periodic budget LAST RATIFIED by the owners
 * continues until a subsequent budget is ratified. Returns which budget-version
 * id governs after a rejection.
 */
export function resolveAfterRejection(params: {
  rejectedBudgetVersionId: string;
  lastRatifiedBudgetVersionId: string | null;
}): { effectiveBudgetVersionId: string | null; revertedToBudgetVersionId: string | null; reason: string } {
  if (params.lastRatifiedBudgetVersionId) {
    return {
      effectiveBudgetVersionId: params.lastRatifiedBudgetVersionId,
      revertedToBudgetVersionId: params.lastRatifiedBudgetVersionId,
      reason: "§47-261e(a): proposed budget rejected — last ratified budget continues.",
    };
  }
  return {
    effectiveBudgetVersionId: null,
    revertedToBudgetVersionId: null,
    reason: "§47-261e(a): proposed budget rejected and no prior ratified budget exists — no budget is in effect until one is ratified.",
  };
}

// ===========================================================================
// §47-261e(b) — special-assessment threshold gate (pure)
// ===========================================================================

export interface SpecialAssessmentGate {
  requiresOwnerRatification: boolean;
  thresholdPct: number;
  thresholdAmount: number;
  pctOfBudget: number;
  reason: string;
}

/**
 * §47-261e(b): a special assessment must run the (a) ratification procedure
 * when it meets/exceeds the threshold (default 15% of the current annual
 * budget). Below the threshold the board may impose it without an owner vote.
 */
export function evaluateSpecialAssessmentGate(params: {
  assessmentAmount: number;
  baselineAnnualBudget: number;
  thresholdPct?: number;
}): SpecialAssessmentGate {
  const thresholdPct = params.thresholdPct ?? DEFAULT_SPECIAL_ASSESSMENT_THRESHOLD_PCT;
  const thresholdAmount = (params.baselineAnnualBudget * thresholdPct) / 100;
  const pctOfBudget =
    params.baselineAnnualBudget > 0 ? (params.assessmentAmount / params.baselineAnnualBudget) * 100 : Infinity;
  const requiresOwnerRatification = params.assessmentAmount >= thresholdAmount;
  return {
    requiresOwnerRatification,
    thresholdPct,
    thresholdAmount,
    pctOfBudget,
    reason: requiresOwnerRatification
      ? `§47-261e(b): special assessment is ${pctOfBudget.toFixed(1)}% of the annual budget (≥ ${thresholdPct}% threshold) — owner ratification required.`
      : `§47-261e(b): special assessment is ${pctOfBudget.toFixed(1)}% of the annual budget (< ${thresholdPct}% threshold) — board may impose without an owner vote.`,
  };
}

// ===========================================================================
// §47-261e(c) — emergency special assessment (pure)
// ===========================================================================

export interface EmergencyAssessmentEvaluation {
  valid: boolean;
  requiredVotes: number;
  boardSeatCount: number;
  boardVotesInFavor: number;
  hasAttestation: boolean;
  reason: string;
}

/**
 * §47-261e(c): an emergency special assessment is effective immediately,
 * without owner ratification, ONLY if the executive board determines by a
 * TWO-THIRDS vote that the assessment is necessary for an emergency AND records
 * a written attestation of the emergency.
 */
export function evaluateEmergencyAssessment(params: {
  boardSeatCount: number;
  boardVotesInFavor: number;
  attestation?: string | null;
}): EmergencyAssessmentEvaluation {
  const requiredVotes = Math.ceil(params.boardSeatCount * EMERGENCY_BOARD_FRACTION);
  const hasAttestation = !!(params.attestation && params.attestation.trim().length > 0);
  const hasSuperMajority = params.boardVotesInFavor >= requiredVotes && params.boardSeatCount > 0;
  const valid = hasSuperMajority && hasAttestation;
  let reason: string;
  if (!hasSuperMajority) {
    reason = `§47-261e(c): emergency assessment requires a two-thirds board vote (${requiredVotes} of ${params.boardSeatCount}); only ${params.boardVotesInFavor} in favor.`;
  } else if (!hasAttestation) {
    reason = "§47-261e(c): a written emergency attestation is required.";
  } else {
    reason = `§47-261e(c): two-thirds board vote (${params.boardVotesInFavor}/${params.boardSeatCount}) + emergency attestation satisfied — assessment effective immediately.`;
  }
  return {
    valid,
    requiredVotes,
    boardSeatCount: params.boardSeatCount,
    boardVotesInFavor: params.boardVotesInFavor,
    hasAttestation,
    reason,
  };
}

// ===========================================================================
// §47-261e(a) — owner budget summary notice (pure)
// ===========================================================================

export interface BudgetSummaryNoticeInput {
  associationName: string;
  fiscalYear: number | string;
  budgetTotal: number;
  reserveStatement?: string | null;
  meetingDate: Date;
  window: RatificationWindow;
  ratificationType?: "annual-budget" | "special-assessment" | "emergency-assessment";
}

export interface RenderedNotice {
  subject: string;
  body: string;
}

const currency = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

/**
 * §47-261e(a): renders the owner budget-summary notice — total, REQUIRED reserve
 * statement, the ratification meeting date, and the negative-option explanation
 * (the budget is ratified unless a majority of all owners rejects it). Cites the
 * statute so owners understand their veto right.
 */
export function buildBudgetSummaryNotice(input: BudgetSummaryNoticeInput): RenderedNotice {
  const reserve =
    input.reserveStatement && input.reserveStatement.trim().length > 0
      ? input.reserveStatement.trim()
      : "Reserve statement: see the attached budget for the amount of reserves and the basis on which they are calculated and funded (CGS §47-261e(a)).";

  const subject = `${input.associationName} — ${input.fiscalYear} budget summary & ratification meeting (CGS §47-261e)`;
  const body = [
    `Dear Unit Owner,`,
    ``,
    `The executive board has adopted the proposed ${input.fiscalYear} budget for ${input.associationName}.`,
    `Total proposed budget: ${currency(input.budgetTotal)}.`,
    ``,
    reserve,
    ``,
    `RATIFICATION MEETING (CGS §47-261e(a)): a meeting of the unit owners to consider ratification of this budget is scheduled for ${fmtDate(input.meetingDate)}. This date is within the statutory window — no sooner than ${input.window.minDays} days and no later than ${input.window.maxDays} days after this summary (${fmtDate(input.window.minDate)} – ${fmtDate(input.window.maxDate)}).`,
    ``,
    `YOUR VOTE (negative option): under CGS §47-261e(a), this budget WILL BE RATIFIED unless, at that meeting, a MAJORITY OF ALL UNIT OWNERS rejects it — whether or not a quorum is present. If you do nothing, the budget takes effect. If a majority of all owners rejects it, the budget last ratified by the owners continues until a new one is ratified.`,
    ``,
    `Sincerely,`,
    `${input.associationName} Executive Board`,
  ].join("\n");

  return { subject, body };
}

// ===========================================================================
// Thin DB glue — typecheck-validated (not unit-tested; see header)
// ===========================================================================

/**
 * Count the owner-vote base for an association — one vote per unit, the CIOA
 * allocated-interest convention for "all unit owners" in §47-261e(a). Falls
 * back to distinct active owner persons if the association has no units.
 */
export async function getOwnerVoteBase(associationId: string): Promise<number> {
  const unitRows = await db
    .select({ id: units.id })
    .from(units)
    .where(eq(units.associationId, associationId));
  if (unitRows.length > 0) return unitRows.length;
  const ownerRows = await db
    .select({ personId: ownerships.personId })
    .from(ownerships)
    .innerJoin(units, eq(ownerships.unitId, units.id))
    .where(and(eq(units.associationId, associationId), isNull(ownerships.endDate)));
  return new Set(ownerRows.map((r) => r.personId)).size;
}

/** §47-261e(a): open an annual-budget ratification (adopted → summary-pending). */
export async function openBudgetRatification(input: {
  associationId: string;
  budgetId?: string | null;
  budgetVersionId?: string | null;
  adoptedAt: Date;
  reserveStatement?: string | null;
  declarationOverrideCount?: number | null;
  createdBy?: string | null;
}): Promise<BudgetRatification> {
  const totalOwnerCount = await getOwnerVoteBase(input.associationId);
  const [row] = await db
    .insert(budgetRatifications)
    .values({
      associationId: input.associationId,
      budgetId: input.budgetId ?? null,
      budgetVersionId: input.budgetVersionId ?? null,
      ratificationType: "annual-budget",
      adoptedAt: input.adoptedAt,
      summaryDueBy: computeSummaryDueDate(input.adoptedAt),
      reserveStatement: input.reserveStatement ?? null,
      reserveStatementIncluded: input.reserveStatement ? 1 : 0,
      totalOwnerCount,
      rejectThresholdCount: computeRejectThreshold(totalOwnerCount, input.declarationOverrideCount),
      status: "summary-pending",
      createdBy: input.createdBy ?? null,
    })
    .returning();
  // Move the budget version to "proposed" — it is NOT ratified until the vote.
  if (input.budgetVersionId) {
    await db
      .update(budgetVersions)
      .set({ status: "proposed", updatedAt: new Date() })
      .where(eq(budgetVersions.id, input.budgetVersionId));
  }
  return row;
}

/**
 * §47-261e(a): record the 30-day summary distribution, set the meeting date +
 * window, and log a per-owner summary send. Validates the meeting date is in
 * the 10–60-day window.
 */
export async function distributeBudgetSummary(input: {
  ratificationId: string;
  summarySentAt: Date;
  meetingDate: Date;
  associationName: string;
  fiscalYear: number | string;
  budgetTotal: number;
}): Promise<{ ratification: BudgetRatification; sends: number }> {
  const validation = validateMeetingDate(input.summarySentAt, input.meetingDate);
  if (!validation.valid) {
    throw new Error(validation.reason);
  }
  const [existing] = await db
    .select()
    .from(budgetRatifications)
    .where(eq(budgetRatifications.id, input.ratificationId))
    .limit(1);
  if (!existing) throw new Error("Budget ratification not found");

  const window = validation.window;
  const [updated] = await db
    .update(budgetRatifications)
    .set({
      summarySentAt: input.summarySentAt,
      meetingDate: input.meetingDate,
      votingWindowMinDate: window.minDate,
      votingWindowMaxDate: window.maxDate,
      status: "summary-distributed",
      updatedAt: new Date(),
    })
    .where(eq(budgetRatifications.id, input.ratificationId))
    .returning();

  // Render the statutory notice and log a per-owner summary send.
  const notice = buildBudgetSummaryNotice({
    associationName: input.associationName,
    fiscalYear: input.fiscalYear,
    budgetTotal: input.budgetTotal,
    reserveStatement: existing.reserveStatement,
    meetingDate: input.meetingDate,
    window,
  });
  const ownerRows = await db
    .select({ email: persons.email, personId: persons.id })
    .from(ownerships)
    .innerJoin(units, eq(ownerships.unitId, units.id))
    .innerJoin(persons, eq(ownerships.personId, persons.id))
    .where(and(eq(units.associationId, existing.associationId), isNull(ownerships.endDate)));

  let sends = 0;
  for (const owner of ownerRows) {
    if (!owner.email) continue;
    try {
      await db
        .insert(budgetRatificationSummarySends)
        .values({
          ratificationId: input.ratificationId,
          recipientPersonId: owner.personId,
          recipientEmail: owner.email,
          subjectRendered: notice.subject,
          bodyRendered: notice.body,
        })
        .onConflictDoNothing();
      sends += 1;
    } catch {
      // unique (ratification,email) — already logged; skip
    }
  }
  return { ratification: updated, sends };
}

/**
 * §47-261e(a): tally the negative-option vote and resolve. On NOT-rejected the
 * budget version is ratified; on rejection it reverts to the last ratified
 * version (which continues).
 */
export async function tallyAndResolveRatification(input: {
  ratificationId: string;
  rejectVoteCount: number;
  asOf?: Date;
}): Promise<BudgetRatification> {
  const [ratification] = await db
    .select()
    .from(budgetRatifications)
    .where(eq(budgetRatifications.id, input.ratificationId))
    .limit(1);
  if (!ratification) throw new Error("Budget ratification not found");

  const tally = tallyNegativeOption({
    totalOwnerCount: ratification.totalOwnerCount,
    rejectVoteCount: input.rejectVoteCount,
    declarationOverrideCount: ratification.rejectThresholdCount,
    rule: ratification.rejectThresholdRule,
  });
  const resolvedAt = input.asOf ?? new Date();

  if (!tally.rejected) {
    // Ratified — bind the version status to the owner vote.
    if (ratification.budgetVersionId) {
      await db
        .update(budgetVersions)
        .set({ status: "ratified", ratifiedAt: resolvedAt, updatedAt: resolvedAt })
        .where(eq(budgetVersions.id, ratification.budgetVersionId));
    }
    const [updated] = await db
      .update(budgetRatifications)
      .set({
        rejectVoteCount: input.rejectVoteCount,
        rejectThresholdCount: tally.rejectThresholdCount,
        status: "ratified",
        outcome: "ratified",
        resolvedAt,
        updatedAt: resolvedAt,
      })
      .where(eq(budgetRatifications.id, input.ratificationId))
      .returning();
    return updated;
  }

  // Rejected — last ratified budget continues.
  const lastRatified = ratification.budgetId
    ? (
        await db
          .select({ id: budgetVersions.id })
          .from(budgetVersions)
          .where(and(eq(budgetVersions.budgetId, ratification.budgetId), eq(budgetVersions.status, "ratified")))
          .orderBy(desc(budgetVersions.versionNumber))
          .limit(1)
      )[0]
    : undefined;
  const resolution = resolveAfterRejection({
    rejectedBudgetVersionId: ratification.budgetVersionId ?? "",
    lastRatifiedBudgetVersionId: lastRatified?.id ?? null,
  });
  if (ratification.budgetVersionId) {
    await db
      .update(budgetVersions)
      .set({ status: "archived", updatedAt: resolvedAt })
      .where(eq(budgetVersions.id, ratification.budgetVersionId));
  }
  const [updated] = await db
    .update(budgetRatifications)
    .set({
      rejectVoteCount: input.rejectVoteCount,
      rejectThresholdCount: tally.rejectThresholdCount,
      status: "rejected",
      outcome: "rejected",
      revertedToBudgetVersionId: resolution.revertedToBudgetVersionId,
      notes: resolution.reason,
      resolvedAt,
      updatedAt: resolvedAt,
    })
    .where(eq(budgetRatifications.id, input.ratificationId))
    .returning();
  return updated;
}

/**
 * §47-261e(b): create a special assessment. Below the threshold it is imposed
 * directly (no vote); at/above it, a negative-option ratification is opened.
 */
export async function createSpecialAssessment(input: {
  associationId: string;
  assessmentAmount: number;
  baselineAnnualBudget: number;
  adoptedAt: Date;
  thresholdPct?: number;
  reserveStatement?: string | null;
  declarationOverrideCount?: number | null;
  createdBy?: string | null;
}): Promise<{ ratification: BudgetRatification; gate: SpecialAssessmentGate }> {
  const gate = evaluateSpecialAssessmentGate({
    assessmentAmount: input.assessmentAmount,
    baselineAnnualBudget: input.baselineAnnualBudget,
    thresholdPct: input.thresholdPct,
  });
  const totalOwnerCount = await getOwnerVoteBase(input.associationId);
  const [row] = await db
    .insert(budgetRatifications)
    .values({
      associationId: input.associationId,
      ratificationType: "special-assessment",
      adoptedAt: input.adoptedAt,
      summaryDueBy: computeSummaryDueDate(input.adoptedAt),
      reserveStatement: input.reserveStatement ?? null,
      reserveStatementIncluded: input.reserveStatement ? 1 : 0,
      assessmentAmount: input.assessmentAmount,
      baselineAnnualBudget: input.baselineAnnualBudget,
      specialAssessmentThresholdPct: gate.thresholdPct,
      requiresOwnerRatification: gate.requiresOwnerRatification ? 1 : 0,
      totalOwnerCount,
      rejectThresholdCount: computeRejectThreshold(totalOwnerCount, input.declarationOverrideCount),
      status: gate.requiresOwnerRatification ? "summary-pending" : "imposed-no-vote",
      outcome: gate.requiresOwnerRatification ? null : "imposed-no-vote",
      resolvedAt: gate.requiresOwnerRatification ? null : input.adoptedAt,
      notes: gate.reason,
      createdBy: input.createdBy ?? null,
    })
    .returning();
  return { ratification: row, gate };
}

/**
 * §47-261e(c): impose an emergency special assessment on a two-thirds board
 * vote + written attestation. Effective immediately, no owner ratification.
 */
export async function imposeEmergencyAssessment(input: {
  associationId: string;
  assessmentAmount: number;
  boardSeatCount: number;
  boardVotesInFavor: number;
  attestation: string;
  attestedBy?: string | null;
  adoptedAt: Date;
  createdBy?: string | null;
}): Promise<{ ratification: BudgetRatification; evaluation: EmergencyAssessmentEvaluation }> {
  const evaluation = evaluateEmergencyAssessment({
    boardSeatCount: input.boardSeatCount,
    boardVotesInFavor: input.boardVotesInFavor,
    attestation: input.attestation,
  });
  if (!evaluation.valid) {
    throw new Error(evaluation.reason);
  }
  const now = input.adoptedAt;
  const [row] = await db
    .insert(budgetRatifications)
    .values({
      associationId: input.associationId,
      ratificationType: "emergency-assessment",
      adoptedAt: now,
      summaryDueBy: computeSummaryDueDate(now),
      assessmentAmount: input.assessmentAmount,
      boardSeatCount: input.boardSeatCount,
      boardVotesInFavor: input.boardVotesInFavor,
      emergencyAttestation: input.attestation,
      emergencyAttestedBy: input.attestedBy ?? null,
      emergencyAttestedAt: now,
      requiresOwnerRatification: 0,
      status: "emergency-imposed",
      outcome: "emergency-imposed",
      resolvedAt: now,
      notes: evaluation.reason,
      createdBy: input.createdBy ?? null,
    })
    .returning();
  return { ratification: row, evaluation };
}

/** List ratifications for an association (association-scoped). */
export async function listBudgetRatifications(associationId: string): Promise<BudgetRatification[]> {
  return db
    .select()
    .from(budgetRatifications)
    .where(eq(budgetRatifications.associationId, associationId))
    .orderBy(desc(budgetRatifications.createdAt));
}

/** Get a single ratification (association-scoped guard applied by the route). */
export async function getBudgetRatification(id: string): Promise<BudgetRatification | undefined> {
  const [row] = await db.select().from(budgetRatifications).where(eq(budgetRatifications.id, id)).limit(1);
  return row;
}
