/**
 * Compliance rules-engine types (Project Statecraft, scaffold-only).
 *
 * Project Statecraft's mission is "any HOA/COA, confidently managed, in any of
 * the 50 states" — driven by treating per-state legal requirements as DATA,
 * not code. This file defines the shape of that data. It introduces NO
 * runtime behavior beyond type declarations; the loader lives in
 * `rules-engine.ts` and the actual per-state data lives in `rules/*.json`.
 *
 * States are grouped into four rough regulatory clusters (per the Project
 * Statecraft R1 write-up) so the engine can apply cluster-level defaults
 * before layering state-specific overrides on top:
 *
 *   - B: minimal statutory baseline (disclosure-only regimes, e.g. Connecticut
 *        CIOA §47-261e(a) — see `server/ct-reserve-disclosure.ts`)
 *   - A: UCIOA-style mandatory reserve study / funding schedule on a
 *        multi-year cycle (e.g. Delaware DUCIOA §81-315's 5-year cycle)
 *   - C: post-Surfside structural-integrity regimes (mandatory milestone /
 *        structural inspections + reserve funding tied to inspection findings)
 *   - D: Florida + California-style prescriptive governance (detailed election,
 *        recordkeeping, and disclosure statutes beyond the UCIOA baseline)
 *
 * IMPORTANT — nothing in this file (or its data) is a legal opinion. Every
 * rule set below carries `verifiedWithCounsel: false` until a licensed
 * attorney in that state has reviewed it. Treat every field as a DRAFT
 * hypothesis to be confirmed, never as settled fact.
 */

/** The four rough regulatory clusters a state's HOA/COA law falls into. */
export type StateCluster = "B" | "A" | "C" | "D";

/**
 * Reserve-study / reserve-funding requirements for a state. Mirrors the shape
 * already proven out for Connecticut (`server/ct-reserve-disclosure.ts`):
 * disclosure-only regimes leave `reserveStudyRequired: false` and
 * `fundingFloorPercent: null`; UCIOA-style regimes (cluster A) set a required
 * study cycle; structural-integrity regimes (cluster C) additionally gate on
 * inspection findings via `structuralInspectionRequired`.
 */
export interface ReserveRequirements {
  /** Whether a formal reserve study is legally required (vs. board-declared). */
  reserveStudyRequired: boolean;
  /** How often the reserve study must be redone, in years, or null if not mandated. */
  reserveStudyCycleYears: number | null;
  /** Minimum reserve funding level as a percent of the fully-funded target, or null if unmandated. */
  fundingFloorPercent: number | null;
  /** Whether a structural/milestone inspection is required (cluster C, post-Surfside). */
  structuralInspectionRequired: boolean;
  /** Citation to the governing statute(s), e.g. "DUCIOA §81-315". */
  statutoryCitation: string | null;
}

/** Disclosure requirements — what must be stated in budgets, resale certs, etc. */
export interface DisclosureRequirements {
  /** Must the annual budget summary state the reserve amount + funding basis? */
  budgetMustDiscloseReserve: boolean;
  /** Must a resale/point-of-sale certificate disclose the reserve amount? */
  resaleCertMustDiscloseReserve: boolean;
  /** Any other statutorily-required disclosures, as short human-readable labels. */
  additionalDisclosures: string[];
  /** Citation to the governing statute(s). */
  statutoryCitation: string | null;
}

/** Board/member election requirements. */
export interface ElectionRequirements {
  /** Minimum advance notice required before an election, in days, or null if unmandated. */
  noticeMinDays: number | null;
  /** Whether secret/written ballot is statutorily required. */
  secretBallotRequired: boolean;
  /** Whether cumulative voting is mandated (cluster D states like Florida/California often regulate this). */
  cumulativeVotingRegulated: boolean;
  /** Citation to the governing statute(s). */
  statutoryCitation: string | null;
}

/** Assessment collection + lien requirements. */
export interface AssessmentLienRequirements {
  /** Minimum days delinquent before a lien may be recorded, or null if unmandated. */
  lienMinDelinquentDays: number | null;
  /** Whether a pre-lien notice to the owner is statutorily required. */
  preLienNoticeRequired: boolean;
  /** Statutory cap on late fees, as a percent of the assessment, or null if uncapped. */
  lateFeeCapPercent: number | null;
  /** Citation to the governing statute(s). */
  statutoryCitation: string | null;
}

/**
 * The full per-state compliance rule set. One instance per state, stored as a
 * JSON data file under `server/compliance/rules/`.
 */
export interface StateComplianceRules {
  /** Two-letter USPS state code, e.g. "CT". */
  stateCode: string;
  /** Full state name, e.g. "Connecticut". */
  stateName: string;
  /** Which of the four rough regulatory clusters this state falls into. */
  cluster: StateCluster;
  reserve: ReserveRequirements;
  disclosure: DisclosureRequirements;
  election: ElectionRequirements;
  assessmentLien: AssessmentLienRequirements;
  /**
   * MUST be false until a licensed attorney in this state has reviewed the
   * rule set above. Every field in this rule set is a draft hypothesis, not
   * a legal opinion, until this flips to true. Never treat a `false` entry
   * as safe to use for a real compliance decision.
   */
  verifiedWithCounsel: boolean;
  /** Free-text note — e.g. "PLACEHOLDER — needs counsel review before use." */
  note?: string;
}

/**
 * Keyed-config type matching the repo's existing `Record<string, T>`
 * convention for per-key configuration maps (see e.g.
 * `server/ftph-feature-tree.ts`'s `workstreamModuleMap`). Keyed by two-letter
 * state code.
 */
export type ComplianceRuleSet = Record<string, StateComplianceRules>;
