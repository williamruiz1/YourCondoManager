/**
 * Connecticut CGS §47-261e — budget / special-assessment ratification ("negative option").
 *
 * BUILD dispatch williamruiz1/founder-os#8015. One describe block per continuity-matrix
 * row. These target the pure statutory functions in
 * server/services/budget-ratification-service.ts — the requirement-of-record (OP #79).
 * The storage/route layer is thin glue that calls exactly these functions (the late-fee-
 * assessment-service convention: fat tested pure core, thin DB glue).
 *
 * DB calls require no Postgres — every assertion is against pure functions.
 */

import { describe, it, expect } from "vitest";
import {
  buildBudgetSummary,
  isSummaryDistributionTimely,
  buildOwnerNotices,
  validateVoteWindow,
  tallyNegativeOption,
  planRatificationClose,
  evaluateSpecialAssessmentGate,
  evaluateEmergencyAttestation,
  toOwnerPortalRatificationView,
  DAY_MS,
} from "../server/services/budget-ratification-service";

const LINES = [
  { lineItemName: "Landscaping", plannedAmount: 12000 },
  { lineItemName: "Insurance", plannedAmount: 28000 },
  { lineItemName: "Reserves Contribution", plannedAmount: 10000 },
];
const RESERVE = "Reserve fund balance is $42,000; recommended funding $50,000 per the reserve study.";

// ─────────────────────────────────────────────────────────────────────────────
// Row 1 — §47-261e(a): distribute a budget summary INCLUDING the reserve statement
// to ALL owners within 30 days of board adoption.
// ─────────────────────────────────────────────────────────────────────────────
describe("§47-261e(a) — summary (incl. reserve statement) distributed to all owners within 30 days", () => {
  it("builds a summary that INCLUDES the reserve statement and a correct total", () => {
    const summary = buildBudgetSummary(LINES, RESERVE);
    expect(summary.reserveStatement).toBe(RESERVE);
    expect(summary.total).toBe(50000);
    expect(summary.lineItems).toHaveLength(3);
  });

  it("REJECTS a summary with no reserve statement (§47-261e(a) requires it)", () => {
    expect(() => buildBudgetSummary(LINES, "   ")).toThrow(/47-261e\(a\).*reserve/i);
  });

  it("treats distribution within 30 days of adoption as timely, and >30 days as untimely", () => {
    const adopted = new Date("2026-01-01T00:00:00Z");
    const day20 = new Date(adopted.getTime() + 20 * DAY_MS);
    const day31 = new Date(adopted.getTime() + 31 * DAY_MS);
    expect(isSummaryDistributionTimely(adopted, day20)).toBe(true);
    expect(isSummaryDistributionTimely(adopted, day31)).toBe(false);
  });

  it("creates ONE notice per owner, each carrying the reserve statement", () => {
    const summary = buildBudgetSummary(LINES, RESERVE);
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
      expect(n.body).toContain(RESERVE); // §47-261e(a) reserve statement present
      expect(n.subject).toMatch(/Ratification Notice/);
    }
    expect(notices.map((n) => n.recipientPersonId)).toEqual(["p1", "p2", "p3"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Row 2 — §47-261e (negative option): vote window 10–60 days; budget takes effect
// unless a MAJORITY OF ALL OWNERS votes to REJECT (denominator = total owners).
// ─────────────────────────────────────────────────────────────────────────────
describe("§47-261e — negative-option vote window (10–60 days) + majority-of-all-owners reject", () => {
  const distributed = new Date("2026-01-01T00:00:00Z");

  it("accepts a vote window between 10 and 60 days; rejects shorter/longer", () => {
    expect(validateVoteWindow(distributed, new Date(distributed.getTime() + 30 * DAY_MS)).valid).toBe(true);
    expect(validateVoteWindow(distributed, new Date(distributed.getTime() + 10 * DAY_MS)).valid).toBe(true);
    expect(validateVoteWindow(distributed, new Date(distributed.getTime() + 60 * DAY_MS)).valid).toBe(true);
    expect(validateVoteWindow(distributed, new Date(distributed.getTime() + 9 * DAY_MS)).valid).toBe(false);
    expect(validateVoteWindow(distributed, new Date(distributed.getTime() + 61 * DAY_MS)).valid).toBe(false);
  });

  it("REJECTS when reject votes exceed a majority of ALL owners (N=10, 6 reject)", () => {
    const tally = tallyNegativeOption({ totalOwners: 10, rejectWeight: 6 });
    expect(tally.outcome).toBe("rejected");
    expect(tally.rejectThreshold).toBe(5);
  });

  it("RATIFIES when reject votes do NOT exceed a majority (N=10, 5 reject — silence counts toward effect)", () => {
    const tally = tallyNegativeOption({ totalOwners: 10, rejectWeight: 5 });
    expect(tally.outcome).toBe("ratified"); // 5 is NOT > 5
  });

  it("RATIFIES when nobody votes (negative option — non-participation = budget stands)", () => {
    const tally = tallyNegativeOption({ totalOwners: 7, rejectWeight: 0 });
    expect(tally.outcome).toBe("ratified");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Row 3 — §47-261e auto-revert: if rejected, revert to last approved budget
// (archive ONLY the rejected version; the prior ratified budget stays active).
// ─────────────────────────────────────────────────────────────────────────────
describe("§47-261e auto-revert — reject archives only the rejected version; last ratified stays active", () => {
  it("on REJECT, archives the rejected version and ratifies NOTHING (last approved remains active)", () => {
    const tally = tallyNegativeOption({ totalOwners: 4, rejectWeight: 3 }); // 3 > 2
    const plan = planRatificationClose(tally, "version-new");
    expect(plan.outcome).toBe("rejected");
    expect(plan.archiveVersionId).toBe("version-new");
    expect(plan.ratifyVersionId).toBeUndefined(); // does NOT touch/ratify any other (last-ratified untouched)
  });

  it("on RATIFY, binds the new version effective", () => {
    const tally = tallyNegativeOption({ totalOwners: 4, rejectWeight: 1 });
    const plan = planRatificationClose(tally, "version-new");
    expect(plan.outcome).toBe("ratified");
    expect(plan.ratifyVersionId).toBe("version-new");
    expect(plan.archiveVersionId).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Row 4 — §47-261e(b): special-assessment 15% threshold gate.
// <15% of annual budget → no owner vote; >=15% → negative-option vote.
// ─────────────────────────────────────────────────────────────────────────────
describe("§47-261e(b) — special-assessment 15% threshold gate", () => {
  it("auto-approves a special assessment BELOW 15% (no owner vote)", () => {
    const gate = evaluateSpecialAssessmentGate({ assessmentAmount: 7000, annualBudgetTotal: 50000 }); // 14%
    expect(gate.requiresVote).toBe(false);
  });

  it("requires the negative-option vote at/above 15%", () => {
    const at15 = evaluateSpecialAssessmentGate({ assessmentAmount: 7500, annualBudgetTotal: 50000 }); // 15%
    const above = evaluateSpecialAssessmentGate({ assessmentAmount: 10000, annualBudgetTotal: 50000 }); // 20%
    expect(at15.requiresVote).toBe(true);
    expect(above.requiresVote).toBe(true);
  });

  it("fails safe to requiring a vote when there is no annual budget to measure against", () => {
    expect(evaluateSpecialAssessmentGate({ assessmentAmount: 5000, annualBudgetTotal: 0 }).requiresVote).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Row 5 — §47-261e(c): two-thirds emergency-assessment board attestation
// bypasses the owner vote.
// ─────────────────────────────────────────────────────────────────────────────
describe("§47-261e(c) — emergency assessment requires a two-thirds board attestation", () => {
  it("APPROVES an emergency assessment with a two-thirds board attestation (4 of 5)", () => {
    const att = evaluateEmergencyAttestation({ boardSeats: 5, attestingVotes: 4 });
    expect(att.requiredVotes).toBe(4); // ceil(5 * 2/3) = 4
    expect(att.approved).toBe(true);
  });

  it("does NOT approve below two-thirds (3 of 5)", () => {
    const att = evaluateEmergencyAttestation({ boardSeats: 5, attestingVotes: 3 });
    expect(att.approved).toBe(false);
  });

  it("APPROVES exactly two-thirds (2 of 3) and rejects 1 of 3", () => {
    expect(evaluateEmergencyAttestation({ boardSeats: 3, attestingVotes: 2 }).approved).toBe(true);
    expect(evaluateEmergencyAttestation({ boardSeats: 3, attestingVotes: 1 }).approved).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Row 6 — owner-portal surface: proposed budget summary + reserve statement + vote status.
// ─────────────────────────────────────────────────────────────────────────────
describe("owner-portal — owner can view the proposed summary, reserve statement, and vote status", () => {
  it("maps a ratification to the owner-portal view (summary + reserve statement + status + own vote)", () => {
    const summary = buildBudgetSummary(LINES, RESERVE);
    const view = toOwnerPortalRatificationView({
      id: "rat-1",
      kind: "annual-budget",
      status: "vote-open",
      reserveStatement: RESERVE,
      budgetSummaryJson: summary,
      voteOpenAt: new Date("2026-01-01"),
      voteCloseAt: new Date("2026-02-01"),
      totalOwnersAtInitiation: 12,
      voteRequired: 1,
      myVote: "no",
    });
    expect(view.statute).toBe("CGS §47-261e");
    expect(view.reserveStatement).toBe(RESERVE);
    expect(view.status).toBe("vote-open");
    expect(view.voteRequired).toBe(true);
    expect(view.totalOwners).toBe(12);
    expect(view.myVote).toBe("no");
    expect((view.budgetSummary as { total: number }).total).toBe(50000);
  });

  it("surfaces myVote=null when the owner has not voted", () => {
    const view = toOwnerPortalRatificationView({
      id: "rat-2",
      kind: "special-assessment",
      status: "ratified",
      reserveStatement: RESERVE,
      budgetSummaryJson: null,
      voteOpenAt: null,
      voteCloseAt: null,
      totalOwnersAtInitiation: 8,
      voteRequired: 0,
      myVote: null,
    });
    expect(view.myVote).toBeNull();
    expect(view.voteRequired).toBe(false);
  });
});
