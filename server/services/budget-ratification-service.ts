/**
 * Connecticut CGS §47-261e — Budget / special-assessment ratification ("negative option").
 *
 * Connecticut Common Interest Ownership Act, §47-261e. Statutory owner-veto:
 * a board-adopted budget TAKES EFFECT unless a MAJORITY OF ALL UNIT OWNERS
 * affirmatively votes to REJECT it at a ratification meeting held 10–60 days
 * after the budget summary (including the reserve statement) is distributed.
 *
 * This module holds the PURE, DB-free statutory logic so it is unit-testable in
 * isolation. The storage/service layer orchestrates persistence around these
 * functions; the §-number on each function is the binding requirement-of-record.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

/** §47-261e(a): the summary must be distributed within 30 days of board adoption. */
export const SUMMARY_DISTRIBUTION_MAX_DAYS = 30;

/** §47-261e: the ratification meeting must be "not less than ten nor more than sixty days" after the summary is distributed. */
export const VOTE_WINDOW_MIN_DAYS = 10;
export const VOTE_WINDOW_MAX_DAYS = 60;

/** §47-261e(b): special assessments at/above this fraction of the annual budget require the owner negative-option vote. */
export const SPECIAL_ASSESSMENT_VOTE_THRESHOLD = 0.15;

// ─────────────────────────────────────────────────────────────────────────────
// §47-261e(a) — summary + reserve statement + 30-day distribution deadline
// ─────────────────────────────────────────────────────────────────────────────

export interface BudgetSummaryLine {
  lineItemName: string;
  plannedAmount: number;
}

export interface BudgetSummary {
  /** §47-261e(a) reserve statement — MUST be included in the distributed summary. */
  reserveStatement: string;
  lineItems: Array<{ lineItemName: string; plannedAmount: number }>;
  total: number;
}

/**
 * §47-261e(a): Build the owner-facing budget summary that MUST include the
 * statement of reserves. A summary lacking a reserve statement is non-compliant.
 */
export function buildBudgetSummary(
  lines: BudgetSummaryLine[],
  reserveStatement: string,
): BudgetSummary {
  const trimmed = (reserveStatement ?? "").trim();
  if (!trimmed) {
    throw new Error(
      "§47-261e(a): budget summary MUST include a statement of reserves",
    );
  }
  const lineItems = lines.map((l) => ({
    lineItemName: l.lineItemName,
    plannedAmount: l.plannedAmount,
  }));
  const total = Number(
    lineItems.reduce((sum, l) => sum + l.plannedAmount, 0).toFixed(2),
  );
  return { reserveStatement: trimmed, lineItems, total };
}

/**
 * §47-261e(a): the summary must be distributed to all owners within 30 days of
 * board adoption. Returns true when the distribution date is within the window.
 */
export function isSummaryDistributionTimely(
  boardAdoptedAt: Date,
  distributedAt: Date,
): boolean {
  const elapsedDays = (distributedAt.getTime() - boardAdoptedAt.getTime()) / DAY_MS;
  return elapsedDays >= 0 && elapsedDays <= SUMMARY_DISTRIBUTION_MAX_DAYS;
}

// ─────────────────────────────────────────────────────────────────────────────
// §47-261e — vote window (10–60 days) + negative-option tally
// ─────────────────────────────────────────────────────────────────────────────

export interface VoteWindowValidation {
  valid: boolean;
  reason?: string;
  windowDays?: number;
}

/**
 * §47-261e: the ratification meeting / vote close must be not less than 10 nor
 * more than 60 days after the summary is distributed (the window anchor).
 */
export function validateVoteWindow(
  summaryDistributedAt: Date,
  voteCloseAt: Date,
): VoteWindowValidation {
  const windowDays = (voteCloseAt.getTime() - summaryDistributedAt.getTime()) / DAY_MS;
  if (windowDays < VOTE_WINDOW_MIN_DAYS) {
    return {
      valid: false,
      windowDays,
      reason: `§47-261e: vote window (${windowDays.toFixed(1)}d) is less than the ${VOTE_WINDOW_MIN_DAYS}-day minimum`,
    };
  }
  if (windowDays > VOTE_WINDOW_MAX_DAYS) {
    return {
      valid: false,
      windowDays,
      reason: `§47-261e: vote window (${windowDays.toFixed(1)}d) exceeds the ${VOTE_WINDOW_MAX_DAYS}-day maximum`,
    };
  }
  return { valid: true, windowDays };
}

export type RatificationOutcome = "ratified" | "rejected";

export interface NegativeOptionTally {
  outcome: RatificationOutcome;
  totalOwners: number;
  rejectWeight: number;
  /** The number of reject votes (strictly) required to defeat the budget. */
  rejectThreshold: number;
}

/**
 * §47-261e (negative option): the budget is RATIFIED unless a MAJORITY OF ALL
 * UNIT OWNERS votes to reject it. The denominator is ALL owners (not just those
 * who voted) — silence / abstention / non-participation counts toward effect.
 *
 * A budget is REJECTED only when rejectWeight > totalOwners / 2.
 */
export function tallyNegativeOption(params: {
  totalOwners: number;
  rejectWeight: number;
}): NegativeOptionTally {
  const totalOwners = Math.max(0, params.totalOwners);
  const rejectWeight = Math.max(0, params.rejectWeight);
  // Strict majority of ALL owners: > 50%.
  const rejectThreshold = totalOwners / 2;
  const outcome: RatificationOutcome =
    rejectWeight > rejectThreshold ? "rejected" : "ratified";
  return { outcome, totalOwners, rejectWeight, rejectThreshold };
}

// ─────────────────────────────────────────────────────────────────────────────
// §47-261e(b) — 15% special-assessment threshold gate
// ─────────────────────────────────────────────────────────────────────────────

export interface SpecialAssessmentGate {
  requiresVote: boolean;
  fractionOfAnnualBudget: number;
}

/**
 * §47-261e(b): a special assessment BELOW 15% of the annual budget is approved
 * without an owner vote; an assessment AT OR ABOVE 15% triggers the negative-
 * option ratification process.
 */
export function evaluateSpecialAssessmentGate(params: {
  assessmentAmount: number;
  annualBudgetTotal: number;
}): SpecialAssessmentGate {
  const { assessmentAmount, annualBudgetTotal } = params;
  if (annualBudgetTotal <= 0) {
    // No annual budget to measure against — fail safe to requiring the vote.
    return { requiresVote: true, fractionOfAnnualBudget: Infinity };
  }
  const fraction = assessmentAmount / annualBudgetTotal;
  return {
    requiresVote: fraction >= SPECIAL_ASSESSMENT_VOTE_THRESHOLD,
    fractionOfAnnualBudget: fraction,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// §47-261e(c) — two-thirds emergency-assessment attestation
// ─────────────────────────────────────────────────────────────────────────────

export interface EmergencyAttestation {
  approved: boolean;
  requiredVotes: number;
}

/**
 * §47-261e(c): the executive board may adopt an emergency special assessment
 * WITHOUT owner ratification upon a recorded TWO-THIRDS vote of the board
 * attesting that an emergency exists.
 */
export function evaluateEmergencyAttestation(params: {
  boardSeats: number;
  attestingVotes: number;
}): EmergencyAttestation {
  const boardSeats = Math.max(0, params.boardSeats);
  const attestingVotes = Math.max(0, params.attestingVotes);
  // Two-thirds of the board, rounded up to a whole seat.
  const requiredVotes = Math.ceil((boardSeats * 2) / 3);
  return {
    approved: boardSeats > 0 && attestingVotes >= requiredVotes,
    requiredVotes,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// §47-261e(a) — owner notice distribution (one per owner, incl. reserve statement)
// ─────────────────────────────────────────────────────────────────────────────

export interface OwnerNoticeRecipient {
  personId: string;
  email: string;
}

export interface OwnerNoticePayload {
  recipientPersonId: string;
  recipientEmail: string;
  subject: string;
  body: string;
}

/**
 * §47-261e(a): produce ONE budget-summary notice per owner-of-record, each
 * INCLUDING the statement of reserves. The storage layer simply persists what
 * this returns — so "a notice for each owner" is exactly owners.length.
 */
export function buildOwnerNotices(params: {
  owners: OwnerNoticeRecipient[];
  summary: BudgetSummary;
  budgetName: string;
  fiscalYear: number;
  voteRequired: boolean;
  voteCloseAt?: Date | null;
  kind: "annual-budget" | "special-assessment" | "emergency-assessment";
}): OwnerNoticePayload[] {
  const { owners, summary, budgetName, fiscalYear, voteRequired, voteCloseAt, kind } = params;
  const subject = `Proposed Budget Summary & Ratification Notice — ${budgetName} (FY${fiscalYear})`;
  const reserveLine = `Statement of Reserves (CGS §47-261e(a)): ${summary.reserveStatement}`;
  const windowLine = voteRequired
    ? `This budget will take effect on ${voteCloseAt ? voteCloseAt.toDateString() : "the ratification date"} UNLESS a majority of all unit owners votes to reject it.`
    : kind === "emergency-assessment"
      ? "Adopted as an emergency special assessment under §47-261e(c) (two-thirds board attestation)."
      : "Approved without an owner vote (special assessment below the §47-261e(b) 15% threshold).";
  const body = [
    `Total proposed budget: $${summary.total.toLocaleString()}`,
    reserveLine,
    windowLine,
  ].join("\n\n");
  return owners.map((o) => ({
    recipientPersonId: o.personId,
    recipientEmail: o.email,
    subject,
    body,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// §47-261e — close plan (ratify vs auto-revert to the last approved budget)
// ─────────────────────────────────────────────────────────────────────────────

export interface RatificationClosePlan {
  outcome: RatificationOutcome;
  /** When ratified: bind this version effective (clearing any prior ratified sibling). */
  ratifyVersionId?: string;
  /** When rejected: archive ONLY this version; the last ratified budget is untouched. */
  archiveVersionId?: string;
}

/**
 * §47-261e auto-revert: from the negative-option tally, decide what to bind.
 *  - ratified → bind this version effective
 *  - rejected → archive ONLY this rejected version; the prior ratified budget
 *    is left untouched and remains the active budget (revert to last approved)
 */
export function planRatificationClose(
  tally: NegativeOptionTally,
  budgetVersionId: string,
): RatificationClosePlan {
  if (tally.outcome === "ratified") {
    return { outcome: "ratified", ratifyVersionId: budgetVersionId };
  }
  return { outcome: "rejected", archiveVersionId: budgetVersionId };
}

// ─────────────────────────────────────────────────────────────────────────────
// Owner-portal view (proposed budget summary + reserve statement + vote status)
// ─────────────────────────────────────────────────────────────────────────────

export interface OwnerPortalRatificationView {
  id: string;
  kind: string;
  status: string;
  statute: "CGS §47-261e";
  reserveStatement: string;
  budgetSummary: unknown;
  voteOpenAt: Date | null;
  voteCloseAt: Date | null;
  totalOwners: number;
  voteRequired: boolean;
  myVote: string | null;
}

/**
 * Owner-portal contract: the proposed budget summary, the reserve statement, the
 * ratification status, and the owner's own recorded vote (if any).
 */
export function toOwnerPortalRatificationView(input: {
  id: string;
  kind: string;
  status: string;
  reserveStatement: string;
  budgetSummaryJson: unknown;
  voteOpenAt: Date | null;
  voteCloseAt: Date | null;
  totalOwnersAtInitiation: number;
  voteRequired: number;
  myVote: string | null;
}): OwnerPortalRatificationView {
  return {
    id: input.id,
    kind: input.kind,
    status: input.status,
    statute: "CGS §47-261e",
    reserveStatement: input.reserveStatement,
    budgetSummary: input.budgetSummaryJson,
    voteOpenAt: input.voteOpenAt,
    voteCloseAt: input.voteCloseAt,
    totalOwners: input.totalOwnersAtInitiation,
    voteRequired: input.voteRequired === 1,
    myVote: input.myVote,
  };
}
