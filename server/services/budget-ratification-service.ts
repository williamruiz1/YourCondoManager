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

/**
 * §47-261e(a) statement of reserves — the statute requires BOTH statutory
 * elements: the reserve AMOUNT and the BASIS on which reserves are calculated
 * and funded. Both are required; either missing makes the summary non-compliant.
 */
export interface ReserveStatementInput {
  /** The reserve amount (dollars). Required. Must be a finite, non-negative number. */
  reserveAmount: number;
  /** The basis on which reserves are calculated and funded. Required, non-empty. */
  reserveBasis: string;
}

export interface BudgetSummary {
  /** §47-261e(a) — the reserve AMOUNT element. */
  reserveAmount: number;
  /** §47-261e(a) — the BASIS element (how reserves are calculated and funded). */
  reserveBasis: string;
  /** §47-261e(a) combined human-readable statement of reserves (amount + basis). */
  reserveStatement: string;
  lineItems: Array<{ lineItemName: string; plannedAmount: number }>;
  total: number;
}

/** Compose the combined statement-of-reserves display string from both elements. */
export function composeReserveStatement(reserveAmount: number, reserveBasis: string): string {
  return `Reserve amount: $${reserveAmount.toLocaleString()}. Basis: ${reserveBasis.trim()}`;
}

/**
 * §47-261e(a): Build the owner-facing budget summary that MUST include the
 * statement of reserves — and that statement MUST carry BOTH statutory elements:
 * the reserve AMOUNT and the BASIS on which reserves are calculated and funded.
 * A summary missing EITHER element is rejected as non-compliant.
 */
export function buildBudgetSummary(
  lines: BudgetSummaryLine[],
  reserve: ReserveStatementInput,
): BudgetSummary {
  const reserveAmount = reserve?.reserveAmount;
  const reserveBasis = (reserve?.reserveBasis ?? "").trim();
  if (
    reserveAmount === undefined ||
    reserveAmount === null ||
    !Number.isFinite(reserveAmount) ||
    reserveAmount < 0
  ) {
    throw new Error(
      "§47-261e(a): statement of reserves is incomplete — the reserve AMOUNT (a non-negative number) is required",
    );
  }
  if (!reserveBasis) {
    throw new Error(
      "§47-261e(a): statement of reserves is incomplete — the BASIS on which reserves are calculated and funded is required",
    );
  }
  const lineItems = lines.map((l) => ({
    lineItemName: l.lineItemName,
    plannedAmount: l.plannedAmount,
  }));
  const total = Number(
    lineItems.reduce((sum, l) => sum + l.plannedAmount, 0).toFixed(2),
  );
  return {
    reserveAmount,
    reserveBasis,
    reserveStatement: composeReserveStatement(reserveAmount, reserveBasis),
    lineItems,
    total,
  };
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
  /** The denominator: the configured voting base (UNITS by default — see VotingBasis). */
  totalVotingBase: number;
  rejectWeight: number;
  /** The reject weight (strictly) required to defeat the budget (> base/2). */
  rejectThreshold: number;
}

/**
 * §47-261e (negative option): the budget is RATIFIED unless a MAJORITY of the
 * VOTING BASE votes to reject it. Per §47-261e + §47-203, the voting base is the
 * association's UNITS (one vote per unit) by default — NOT distinct owner-persons
 * (that would under-count multi-unit owners and bias toward wrongly deeming a
 * budget ratified, the higher-harm error). The denominator is the WHOLE base
 * (not just those who voted) — silence / abstention / non-participation counts
 * toward effect. A budget is REJECTED only when rejectWeight > totalVotingBase/2.
 */
export function tallyNegativeOption(params: {
  totalVotingBase: number;
  rejectWeight: number;
}): NegativeOptionTally {
  const totalVotingBase = Math.max(0, params.totalVotingBase);
  const rejectWeight = Math.max(0, params.rejectWeight);
  // Strict majority of the voting base: > 50%.
  const rejectThreshold = totalVotingBase / 2;
  const outcome: RatificationOutcome =
    rejectWeight > rejectThreshold ? "rejected" : "ratified";
  return { outcome, totalVotingBase, rejectWeight, rejectThreshold };
}

// ─────────────────────────────────────────────────────────────────────────────
// §47-261e + §47-203 — configurable voting basis (the negative-option denominator)
// ─────────────────────────────────────────────────────────────────────────────

export const votingBasisValues = ["per-unit", "allocated-interest", "per-owner"] as const;
export type VotingBasis = (typeof votingBasisValues)[number];
export const DEFAULT_VOTING_BASIS: VotingBasis = "per-unit";

export interface VotingBaseResolution {
  basis: VotingBasis;
  /** The negative-option denominator under the resolved basis. */
  denominator: number;
  /** False when the requested basis is not yet data-wired and a fallback was used. */
  wired: boolean;
  note?: string;
}

/**
 * Resolve the §47-261e voting-base denominator for an association.
 *  - "per-unit" (DEFAULT): one vote per UNIT → denominator = unit count.
 *  - "allocated-interest": votes weighted by unit allocated-interest % →
 *     denominator = total allocated interest. TYPED-BUT-NOT-YET-DATA-WIRED:
 *     no unit-level allocated_interest field exists yet, so until that lands
 *     this falls back to the per-unit count (statutorily safe — never
 *     under-counts) and reports wired=false. TODO(allocated-interest): wire to
 *     a real unit allocated-interest column when added.
 *  - "per-owner": one vote per distinct owner-person → denominator = owner count.
 *     Retained as an explicit opt-in mode; NOT the default (it under-counts
 *     multi-unit owners for a negative-option vote).
 */
export function resolveVotingBaseCount(params: {
  basis: VotingBasis;
  unitCount: number;
  ownerCount: number;
  allocatedInterestTotal?: number | null;
}): VotingBaseResolution {
  const { basis, unitCount, ownerCount, allocatedInterestTotal } = params;
  if (basis === "per-owner") {
    return { basis, denominator: Math.max(0, ownerCount), wired: true };
  }
  if (basis === "allocated-interest") {
    if (typeof allocatedInterestTotal === "number" && allocatedInterestTotal > 0) {
      return { basis, denominator: allocatedInterestTotal, wired: true };
    }
    return {
      basis,
      denominator: Math.max(0, unitCount),
      wired: false,
      note: "allocated-interest not data-wired; using per-unit count as the safe fallback",
    };
  }
  // default per-unit
  return { basis: "per-unit", denominator: Math.max(0, unitCount), wired: true };
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
    ? `This budget will take effect on ${voteCloseAt ? voteCloseAt.toDateString() : "the ratification date"} UNLESS a majority of the units (the voting base) votes to reject it.`
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
  /** The §47-261e voting basis used (per-unit by default). */
  votingBasis: string;
  /** The negative-option denominator under that basis (units by default). */
  totalVotingBase: number;
  voteRequired: boolean;
  myVote: string | null;
}

/**
 * Owner-portal contract: the proposed budget summary, the reserve statement, the
 * ratification status, the voting basis + denominator, and the owner's own vote.
 */
export function toOwnerPortalRatificationView(input: {
  id: string;
  kind: string;
  status: string;
  reserveStatement: string;
  budgetSummaryJson: unknown;
  voteOpenAt: Date | null;
  voteCloseAt: Date | null;
  votingBasis: string;
  votingBaseAtInitiation: number;
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
    votingBasis: input.votingBasis,
    totalVotingBase: input.votingBaseAtInitiation,
    voteRequired: input.voteRequired === 1,
    myVote: input.myVote,
  };
}
