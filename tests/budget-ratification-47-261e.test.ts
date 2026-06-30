/**
 * Connecticut CGS §47-261e — budget / special-assessment ratification ("negative option").
 *
 * BUILD dispatch williamruiz1/founder-os#8015 (+ ycm-gm review fixes). One describe
 * block per continuity-matrix row, targeting the pure statutory functions in
 * server/services/budget-ratification-service.ts — the requirement-of-record (OP #79).
 * The storage/route layer is thin glue that calls exactly these functions.
 *
 * Review fixes applied:
 *   FIX 1 — §47-261e(a) statement of reserves requires BOTH the reserve AMOUNT and the BASIS.
 *   FIX 2 — §47-261e + §47-203 denominator is the VOTING BASE (units by default, configurable),
 *           NOT distinct owner-persons.
 *
 * DB calls require no Postgres — every assertion is against pure functions.
 */

import { describe, it, expect } from "vitest";
import {
  buildBudgetSummary,
  composeReserveStatement,
  isSummaryDistributionTimely,
  buildOwnerNotices,
  validateVoteWindow,
  tallyNegativeOption,
  planRatificationClose,
  evaluateSpecialAssessmentGate,
  evaluateEmergencyAttestation,
  resolveVotingBaseCount,
  toOwnerPortalRatificationView,
  votingBasisValues,
  DEFAULT_VOTING_BASIS,
  DAY_MS,
} from "../server/services/budget-ratification-service";

const LINES = [
  { lineItemName: "Landscaping", plannedAmount: 12000 },
  { lineItemName: "Insurance", plannedAmount: 28000 },
  { lineItemName: "Reserves Contribution", plannedAmount: 10000 },
];
const RESERVE_AMOUNT = 42000;
const RESERVE_BASIS = "Per the 2026 reserve study; funded at 10% of the annual operating budget.";

// ─────────────────────────────────────────────────────────────────────────────
// Row 1 — §47-261e(a): summary INCLUDING the statement of reserves (BOTH the
// reserve AMOUNT and the BASIS), distributed to ALL owners within 30 days.
// ─────────────────────────────────────────────────────────────────────────────
describe("§47-261e(a) — statement of reserves requires BOTH the amount and the basis; summary to all owners within 30 days", () => {
  it("builds a summary that includes BOTH reserve elements (amount + basis) and a correct total", () => {
    const summary = buildBudgetSummary(LINES, { reserveAmount: RESERVE_AMOUNT, reserveBasis: RESERVE_BASIS });
    expect(summary.reserveAmount).toBe(RESERVE_AMOUNT);
    expect(summary.reserveBasis).toBe(RESERVE_BASIS);
    expect(summary.reserveStatement).toContain("42,000"); // amount element
    expect(summary.reserveStatement).toContain("reserve study"); // basis element
    expect(summary.total).toBe(50000);
    expect(summary.lineItems).toHaveLength(3);
  });

  it("REJECTS the summary when the reserve AMOUNT element is missing (§47-261e(a))", () => {
    expect(() =>
      // @ts-expect-error — deliberately omitting reserveAmount to assert the guard
      buildBudgetSummary(LINES, { reserveBasis: RESERVE_BASIS }),
    ).toThrow(/47-261e\(a\).*AMOUNT/i);
  });

  it("REJECTS the summary when the reserve BASIS element is missing/blank (§47-261e(a))", () => {
    expect(() => buildBudgetSummary(LINES, { reserveAmount: RESERVE_AMOUNT, reserveBasis: "   " })).toThrow(/47-261e\(a\).*BASIS/i);
  });

  it("REJECTS a negative or non-finite reserve amount", () => {
    expect(() => buildBudgetSummary(LINES, { reserveAmount: -1, reserveBasis: RESERVE_BASIS })).toThrow(/AMOUNT/i);
    expect(() => buildBudgetSummary(LINES, { reserveAmount: NaN, reserveBasis: RESERVE_BASIS })).toThrow(/AMOUNT/i);
  });

  it("composeReserveStatement renders both elements", () => {
    const s = composeReserveStatement(42000, "study basis");
    expect(s).toContain("42,000");
    expect(s).toContain("study basis");
  });

  it("treats distribution within 30 days of adoption as timely, and >30 days as untimely", () => {
    const adopted = new Date("2026-01-01T00:00:00Z");
    expect(isSummaryDistributionTimely(adopted, new Date(adopted.getTime() + 20 * DAY_MS))).toBe(true);
    expect(isSummaryDistributionTimely(adopted, new Date(adopted.getTime() + 31 * DAY_MS))).toBe(false);
  });

  it("creates ONE notice per owner, each carrying both reserve elements", () => {
    const summary = buildBudgetSummary(LINES, { reserveAmount: RESERVE_AMOUNT, reserveBasis: RESERVE_BASIS });
    const owners = [
      { personId: "p1", email: "a@x.com" },
      { personId: "p2", email: "b@x.com" },
      { personId: "p3", email: "c@x.com" },
    ];
    const notices = buildOwnerNotices({
      owners,
      summary,
      budgetName: "FY2026 Operating Budget",
      fiscalYear: 2026,
      voteRequired: true,
      voteCloseAt: new Date("2026-02-01"),
      kind: "annual-budget",
    });
    expect(notices).toHaveLength(owners.length); // a notice for EACH owner
    for (const n of notices) {
      expect(n.body).toContain("42,000"); // reserve amount element
      expect(n.body).toContain("reserve study"); // reserve basis element
      expect(n.subject).toMatch(/Ratification Notice/);
    }
    expect(notices.map((n) => n.recipientPersonId)).toEqual(["p1", "p2", "p3"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Row 2 — §47-261e (negative option): vote window 10–60 days; budget takes effect
// unless a MAJORITY OF THE VOTING BASE (UNITS by default) votes to REJECT.
// ─────────────────────────────────────────────────────────────────────────────
describe("§47-261e — negative-option vote window (10–60 days) + majority-of-the-voting-base (units) reject", () => {
  const distributed = new Date("2026-01-01T00:00:00Z");

  it("accepts a vote window between 10 and 60 days; rejects shorter/longer", () => {
    expect(validateVoteWindow(distributed, new Date(distributed.getTime() + 30 * DAY_MS)).valid).toBe(true);
    expect(validateVoteWindow(distributed, new Date(distributed.getTime() + 10 * DAY_MS)).valid).toBe(true);
    expect(validateVoteWindow(distributed, new Date(distributed.getTime() + 60 * DAY_MS)).valid).toBe(true);
    expect(validateVoteWindow(distributed, new Date(distributed.getTime() + 9 * DAY_MS)).valid).toBe(false);
    expect(validateVoteWindow(distributed, new Date(distributed.getTime() + 61 * DAY_MS)).valid).toBe(false);
  });

  it("REJECTS when reject votes exceed a majority of the voting base — 10 UNITS, 6 reject", () => {
    const tally = tallyNegativeOption({ totalVotingBase: 10, rejectWeight: 6 });
    expect(tally.outcome).toBe("rejected");
    expect(tally.rejectThreshold).toBe(5);
    expect(tally.totalVotingBase).toBe(10);
  });

  it("RATIFIES when reject votes do NOT exceed a majority — 10 UNITS, 5 reject (silence counts toward effect)", () => {
    const tally = tallyNegativeOption({ totalVotingBase: 10, rejectWeight: 5 });
    expect(tally.outcome).toBe("ratified"); // 5 is NOT > 5
  });

  it("RATIFIES when nobody votes (negative option — non-participation = budget stands)", () => {
    expect(tallyNegativeOption({ totalVotingBase: 7, rejectWeight: 0 }).outcome).toBe("ratified");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Row 2b — §47-261e + §47-203: the denominator (voting base) is configurable and
// defaults to PER-UNIT (not owner-persons).
// ─────────────────────────────────────────────────────────────────────────────
describe("§47-261e + §47-203 — voting basis: per-unit DEFAULT denominator (not owner-persons)", () => {
  it("default is per-unit", () => {
    expect(DEFAULT_VOTING_BASIS).toBe("per-unit");
    expect(votingBasisValues).toContain("per-unit");
    expect(votingBasisValues).toContain("allocated-interest");
    expect(votingBasisValues).toContain("per-owner");
  });

  it("per-unit basis → denominator = UNIT count (multi-unit owners are NOT under-counted)", () => {
    // 8 units owned by 5 persons (one person owns 4 units). Per-unit must count units, not persons.
    const r = resolveVotingBaseCount({ basis: "per-unit", unitCount: 8, ownerCount: 5 });
    expect(r.basis).toBe("per-unit");
    expect(r.denominator).toBe(8); // units, NOT 5 persons
    expect(r.wired).toBe(true);
  });

  it("allocated-interest is TYPED-BUT-NOT-DATA-WIRED → falls back to per-unit count (safe) with wired=false", () => {
    const r = resolveVotingBaseCount({ basis: "allocated-interest", unitCount: 8, ownerCount: 5, allocatedInterestTotal: null });
    expect(r.basis).toBe("allocated-interest");
    expect(r.denominator).toBe(8); // safe per-unit fallback (never under-counts)
    expect(r.wired).toBe(false);
    expect(r.note).toMatch(/not data-wired/i);
  });

  it("allocated-interest uses the total allocated interest when the data IS present", () => {
    const r = resolveVotingBaseCount({ basis: "allocated-interest", unitCount: 8, ownerCount: 5, allocatedInterestTotal: 100 });
    expect(r.denominator).toBe(100);
    expect(r.wired).toBe(true);
  });

  it("per-owner is an explicit opt-in mode → denominator = owner count", () => {
    const r = resolveVotingBaseCount({ basis: "per-owner", unitCount: 8, ownerCount: 5 });
    expect(r.denominator).toBe(5);
    expect(r.wired).toBe(true);
  });

  it("end-to-end: a 8-unit / 5-person association on per-unit basis ratifies at 3 reject votes (units), where per-person would wrongly reject", () => {
    const base = resolveVotingBaseCount({ basis: "per-unit", unitCount: 8, ownerCount: 5 });
    // 3 reject votes would WRONGLY reject under the old per-person denominator (3 > 2.5);
    // under the correct per-unit denominator (8) it ratifies (3 is NOT > 4).
    expect(tallyNegativeOption({ totalVotingBase: base.denominator, rejectWeight: 3 }).outcome).toBe("ratified");
    expect(tallyNegativeOption({ totalVotingBase: base.denominator, rejectWeight: 5 }).outcome).toBe("rejected");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Row 3 — §47-261e auto-revert: if rejected, revert to last approved budget
// (archive ONLY the rejected version; the prior ratified budget stays active).
// ─────────────────────────────────────────────────────────────────────────────
describe("§47-261e auto-revert — reject archives only the rejected version; last ratified stays active", () => {
  it("on REJECT (units denominator), archives the rejected version and ratifies NOTHING", () => {
    const tally = tallyNegativeOption({ totalVotingBase: 4, rejectWeight: 3 }); // 3 > 2
    const plan = planRatificationClose(tally, "version-new");
    expect(plan.outcome).toBe("rejected");
    expect(plan.archiveVersionId).toBe("version-new");
    expect(plan.ratifyVersionId).toBeUndefined(); // last-ratified untouched
  });

  it("on RATIFY, binds the new version effective", () => {
    const tally = tallyNegativeOption({ totalVotingBase: 4, rejectWeight: 1 });
    const plan = planRatificationClose(tally, "version-new");
    expect(plan.outcome).toBe("ratified");
    expect(plan.ratifyVersionId).toBe("version-new");
    expect(plan.archiveVersionId).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Row 4 — §47-261e(b): special-assessment 15% threshold gate.
// ─────────────────────────────────────────────────────────────────────────────
describe("§47-261e(b) — special-assessment 15% threshold gate", () => {
  it("auto-approves a special assessment BELOW 15% (no owner vote)", () => {
    expect(evaluateSpecialAssessmentGate({ assessmentAmount: 7000, annualBudgetTotal: 50000 }).requiresVote).toBe(false); // 14%
  });

  it("requires the negative-option vote at/above 15%", () => {
    expect(evaluateSpecialAssessmentGate({ assessmentAmount: 7500, annualBudgetTotal: 50000 }).requiresVote).toBe(true); // 15%
    expect(evaluateSpecialAssessmentGate({ assessmentAmount: 10000, annualBudgetTotal: 50000 }).requiresVote).toBe(true); // 20%
  });

  it("fails safe to requiring a vote when there is no annual budget to measure against", () => {
    expect(evaluateSpecialAssessmentGate({ assessmentAmount: 5000, annualBudgetTotal: 0 }).requiresVote).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Row 5 — §47-261e(c): two-thirds emergency-assessment board attestation.
// ─────────────────────────────────────────────────────────────────────────────
describe("§47-261e(c) — emergency assessment requires a two-thirds board attestation", () => {
  it("APPROVES with a two-thirds board attestation (4 of 5)", () => {
    const att = evaluateEmergencyAttestation({ boardSeats: 5, attestingVotes: 4 });
    expect(att.requiredVotes).toBe(4); // ceil(5 * 2/3) = 4
    expect(att.approved).toBe(true);
  });

  it("does NOT approve below two-thirds (3 of 5)", () => {
    expect(evaluateEmergencyAttestation({ boardSeats: 5, attestingVotes: 3 }).approved).toBe(false);
  });

  it("APPROVES exactly two-thirds (2 of 3) and rejects 1 of 3", () => {
    expect(evaluateEmergencyAttestation({ boardSeats: 3, attestingVotes: 2 }).approved).toBe(true);
    expect(evaluateEmergencyAttestation({ boardSeats: 3, attestingVotes: 1 }).approved).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Row 6 — owner-portal surface: proposed budget summary + reserve statement +
// voting basis/denominator + vote status.
// ─────────────────────────────────────────────────────────────────────────────
describe("owner-portal — owner can view the proposed summary, reserve statement, voting basis, and vote status", () => {
  it("maps a ratification to the owner-portal view (summary + reserve statement + voting basis + own vote)", () => {
    const summary = buildBudgetSummary(LINES, { reserveAmount: RESERVE_AMOUNT, reserveBasis: RESERVE_BASIS });
    const view = toOwnerPortalRatificationView({
      id: "rat-1",
      kind: "annual-budget",
      status: "vote-open",
      reserveStatement: summary.reserveStatement,
      budgetSummaryJson: summary,
      voteOpenAt: new Date("2026-01-01"),
      voteCloseAt: new Date("2026-02-01"),
      votingBasis: "per-unit",
      votingBaseAtInitiation: 12,
      voteRequired: 1,
      myVote: "no",
    });
    expect(view.statute).toBe("CGS §47-261e");
    expect(view.reserveStatement).toContain("42,000");
    expect(view.status).toBe("vote-open");
    expect(view.voteRequired).toBe(true);
    expect(view.votingBasis).toBe("per-unit");
    expect(view.totalVotingBase).toBe(12); // units
    expect(view.myVote).toBe("no");
    expect((view.budgetSummary as { total: number }).total).toBe(50000);
  });

  it("surfaces myVote=null when the owner has not voted", () => {
    const view = toOwnerPortalRatificationView({
      id: "rat-2",
      kind: "special-assessment",
      status: "ratified",
      reserveStatement: "n/a",
      budgetSummaryJson: null,
      voteOpenAt: null,
      voteCloseAt: null,
      votingBasis: "per-unit",
      votingBaseAtInitiation: 8,
      voteRequired: 0,
      myVote: null,
    });
    expect(view.myVote).toBeNull();
    expect(view.voteRequired).toBe(false);
  });
});
