/**
 * BUILD #8015 — CT CGS §47-261e budget negative-option (owner-veto) ratification.
 *
 * Per the repo test reality (no live DB — service modules import `../server/db`
 * which is mocked), the STATUTORY LOGIC lives in pure functions in
 * `server/services/budget-ratification-service.ts`, and these tests exercise
 * those pure functions directly (the exact code paths the route/storage glue
 * calls).
 *
 * Continuity matrix (each row → ≥1 passing test):
 *   §47-261e(a) summary    — 30-day owner budget-summary deadline
 *   §47-261e(a) window     — ratification meeting 10–60 days after the summary
 *   §47-261e(a) tally      — ratified UNLESS a majority of ALL owners rejects
 *   §47-261e(a) revert     — on rejection, last ratified budget continues
 *   §47-261e(a) notice     — owner summary cites §, reserve statement, veto right
 *   §47-261e(b) gate       — ≥15% special assessment → vote; <15% → no vote
 *   §47-261e(c) emergency  — two-thirds board + attestation imposes immediately
 */

import { describe, it, expect, vi } from "vitest";

// The pure functions never touch the DB, but the service module imports
// `../db` at load time (for the thin glue). Mock it so the import is
// side-effect-free.
vi.mock("../server/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

import {
  computeSummaryDueDate,
  computeRatificationWindow,
  validateMeetingDate,
  computeRejectThreshold,
  tallyNegativeOption,
  resolveAfterRejection,
  evaluateSpecialAssessmentGate,
  evaluateEmergencyAssessment,
  buildBudgetSummaryNotice,
  SUMMARY_DISTRIBUTION_DAYS,
  RATIFICATION_WINDOW_MIN_DAYS,
  RATIFICATION_WINDOW_MAX_DAYS,
} from "../server/services/budget-ratification-service";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe("§47-261e(a) — 30-day owner budget-summary deadline", () => {
  it("summary is due 30 days after adoption", () => {
    const due = computeSummaryDueDate(d("2026-01-01"));
    expect(due.toISOString().slice(0, 10)).toBe("2026-01-31");
    expect(SUMMARY_DISTRIBUTION_DAYS).toBe(30);
  });
});

describe("§47-261e(a) — ratification meeting 10–60 days after the summary", () => {
  it("window min is +10 days, max is +60 days", () => {
    const w = computeRatificationWindow(d("2026-02-01"));
    expect(w.minDate.toISOString().slice(0, 10)).toBe("2026-02-11");
    expect(w.maxDate.toISOString().slice(0, 10)).toBe("2026-04-02");
    expect([w.minDays, w.maxDays]).toEqual([RATIFICATION_WINDOW_MIN_DAYS, RATIFICATION_WINDOW_MAX_DAYS]);
  });

  it("accepts a meeting date inside the window", () => {
    const v = validateMeetingDate(d("2026-02-01"), d("2026-03-01")); // +28 days
    expect(v.valid).toBe(true);
    expect(v.daysAfterSummary).toBe(28);
  });

  it("rejects a meeting date sooner than 10 days", () => {
    const v = validateMeetingDate(d("2026-02-01"), d("2026-02-05")); // +4 days
    expect(v.valid).toBe(false);
    expect(v.reason).toMatch(/at least 10 days/);
  });

  it("rejects a meeting date later than 60 days", () => {
    const v = validateMeetingDate(d("2026-02-01"), d("2026-05-01")); // +89 days
    expect(v.valid).toBe(false);
    expect(v.reason).toMatch(/no more than 60 days/);
  });

  it("accepts the exact boundaries (10 and 60 days)", () => {
    expect(validateMeetingDate(d("2026-02-01"), d("2026-02-11")).valid).toBe(true); // +10
    expect(validateMeetingDate(d("2026-02-01"), d("2026-04-02")).valid).toBe(true); // +60
  });
});

describe("§47-261e(a) — negative-option tally (ratified unless a majority of ALL owners rejects)", () => {
  it("majority-of-all reject threshold = floor(total/2)+1", () => {
    expect(computeRejectThreshold(18)).toBe(10); // 18-unit condo (Cherry Hill Court)
    expect(computeRejectThreshold(20)).toBe(11);
    expect(computeRejectThreshold(7)).toBe(4);
  });

  it("budget RATIFIED when reject votes are below the majority threshold", () => {
    const t = tallyNegativeOption({ totalOwnerCount: 18, rejectVoteCount: 9 });
    expect(t.outcome).toBe("ratified");
    expect(t.rejected).toBe(false);
    expect(t.rejectThresholdCount).toBe(10);
  });

  it("budget RATIFIED when NOBODY votes (non-votes count toward ratification — negative option)", () => {
    const t = tallyNegativeOption({ totalOwnerCount: 18, rejectVoteCount: 0 });
    expect(t.outcome).toBe("ratified");
  });

  it("budget REJECTED when a majority of ALL owners rejects it", () => {
    const t = tallyNegativeOption({ totalOwnerCount: 18, rejectVoteCount: 10 });
    expect(t.outcome).toBe("rejected");
    expect(t.rejected).toBe(true);
  });

  it("honors a larger declaration-specified reject threshold", () => {
    // declaration requires 14 rejects; 12 is not enough
    const t = tallyNegativeOption({ totalOwnerCount: 18, rejectVoteCount: 12, declarationOverrideCount: 14 });
    expect(t.outcome).toBe("ratified");
    expect(t.rejectThresholdCount).toBe(14);
  });

  it("ignores a declaration override SMALLER than the statutory majority (statute floor wins)", () => {
    const t = tallyNegativeOption({ totalOwnerCount: 18, rejectVoteCount: 9, declarationOverrideCount: 5 });
    expect(t.rejectThresholdCount).toBe(10); // statutory majority, not 5
    expect(t.outcome).toBe("ratified");
  });
});

describe("§47-261e(a) — on rejection, the last ratified budget continues", () => {
  it("reverts to the last ratified version when one exists", () => {
    const r = resolveAfterRejection({
      rejectedBudgetVersionId: "v3",
      lastRatifiedBudgetVersionId: "v2",
    });
    expect(r.effectiveBudgetVersionId).toBe("v2");
    expect(r.revertedToBudgetVersionId).toBe("v2");
    expect(r.reason).toMatch(/§47-261e\(a\)/);
  });

  it("no prior ratified budget → none in effect until one is ratified", () => {
    const r = resolveAfterRejection({
      rejectedBudgetVersionId: "v1",
      lastRatifiedBudgetVersionId: null,
    });
    expect(r.effectiveBudgetVersionId).toBeNull();
    expect(r.revertedToBudgetVersionId).toBeNull();
  });
});

describe("§47-261e(a) — owner summary notice", () => {
  it("cites the statute, includes the reserve statement and the negative-option veto explanation", () => {
    const meetingDate = d("2026-03-01");
    const notice = buildBudgetSummaryNotice({
      associationName: "Cherry Hill Court Condominium",
      fiscalYear: 2026,
      budgetTotal: 120000,
      reserveStatement: "Reserves: $48,000, funded per the 2025 reserve study.",
      meetingDate,
      window: computeRatificationWindow(d("2026-02-01")),
    });
    expect(notice.subject).toMatch(/§47-261e/);
    expect(notice.body).toMatch(/\$120,000\.00/);
    expect(notice.body).toMatch(/Reserves: \$48,000/);
    expect(notice.body).toMatch(/MAJORITY OF ALL UNIT OWNERS/);
    expect(notice.body).toMatch(/§47-261e\(a\)/);
  });

  it("falls back to a statutory reserve statement when none is provided", () => {
    const notice = buildBudgetSummaryNotice({
      associationName: "Test HOA",
      fiscalYear: "FY26",
      budgetTotal: 50000,
      meetingDate: d("2026-03-01"),
      window: computeRatificationWindow(d("2026-02-01")),
    });
    expect(notice.body).toMatch(/Reserve statement/);
    expect(notice.body).toMatch(/CGS §47-261e\(a\)/);
  });
});

describe("§47-261e(b) — special-assessment 15% threshold gate", () => {
  it("≥15% of the annual budget REQUIRES owner ratification", () => {
    const g = evaluateSpecialAssessmentGate({ assessmentAmount: 20000, baselineAnnualBudget: 120000 });
    expect(g.requiresOwnerRatification).toBe(true); // 16.7% ≥ 15%
    expect(g.thresholdAmount).toBeCloseTo(18000, 5);
    expect(g.reason).toMatch(/§47-261e\(b\)/);
  });

  it("<15% of the annual budget does NOT require an owner vote", () => {
    const g = evaluateSpecialAssessmentGate({ assessmentAmount: 10000, baselineAnnualBudget: 120000 });
    expect(g.requiresOwnerRatification).toBe(false); // 8.3% < 15%
    expect(g.reason).toMatch(/may impose without an owner vote/);
  });

  it("exactly at the threshold (15%) requires ratification", () => {
    const g = evaluateSpecialAssessmentGate({ assessmentAmount: 18000, baselineAnnualBudget: 120000 });
    expect(g.requiresOwnerRatification).toBe(true);
  });

  it("threshold percentage is overridable (declaration-specific figure)", () => {
    const g = evaluateSpecialAssessmentGate({ assessmentAmount: 12000, baselineAnnualBudget: 120000, thresholdPct: 5 });
    expect(g.thresholdPct).toBe(5);
    expect(g.requiresOwnerRatification).toBe(true); // 10% ≥ 5%
  });
});

describe("§47-261e(c) — emergency assessment (two-thirds board + attestation)", () => {
  it("two-thirds board vote + attestation is VALID — imposed immediately", () => {
    const e = evaluateEmergencyAssessment({
      boardSeatCount: 5,
      boardVotesInFavor: 4,
      attestation: "Burst riser flooding two units — immediate threat to structural integrity.",
    });
    expect(e.valid).toBe(true);
    expect(e.requiredVotes).toBe(4); // ceil(5 * 2/3)
    expect(e.reason).toMatch(/effective immediately/);
  });

  it("FAILS without a two-thirds board vote", () => {
    const e = evaluateEmergencyAssessment({
      boardSeatCount: 5,
      boardVotesInFavor: 3,
      attestation: "emergency",
    });
    expect(e.valid).toBe(false);
    expect(e.reason).toMatch(/two-thirds board vote/);
  });

  it("FAILS without a written attestation even with the super-majority", () => {
    const e = evaluateEmergencyAssessment({ boardSeatCount: 5, boardVotesInFavor: 5, attestation: "  " });
    expect(e.valid).toBe(false);
    expect(e.reason).toMatch(/written emergency attestation/);
  });

  it("required votes = ceil(2/3 of seats) across board sizes", () => {
    expect(evaluateEmergencyAssessment({ boardSeatCount: 3, boardVotesInFavor: 2, attestation: "x" }).requiredVotes).toBe(2);
    expect(evaluateEmergencyAssessment({ boardSeatCount: 7, boardVotesInFavor: 5, attestation: "x" }).requiredVotes).toBe(5);
    expect(evaluateEmergencyAssessment({ boardSeatCount: 9, boardVotesInFavor: 6, attestation: "x" }).requiredVotes).toBe(6);
  });
});
