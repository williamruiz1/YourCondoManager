/**
 * founder-os#13119 — scheduleless / past-dated special assessments must NEVER
 * render as a red past-due lump in the owner portal.
 *
 * The regression class (observed on the Cherry Hill Court "Driveway
 * Replacement Assessment": $80k total, startDate 2021-01-01, installmentCount
 * 1, autoPostEnabled 0, no tracked installment postings): with no real
 * installment schedule, the derived "next installment" collapses to
 * installment #1 due at the assessment's startDate — which for a years-old
 * legacy assessment reads as "the WHOLE remaining balance is due, years past
 * due" (a $4,444.44 red lump due 1/1/2021 in "Pay this period").
 *
 * The general fix under test (server/portal-assessment-detail.ts):
 *   1. `getUpcomingInstallmentsForOwnerUnit` EXCLUDES non-auto-posted
 *      assessments entirely — a scheduleless assessment never fabricates a
 *      due date into the "Pay this period" feed.
 *   2. `getAssessmentPlansForOwnerUnit` presents it as an ONGOING plan paid
 *      over time — `nextInstallmentDueDate: null` (so the shared
 *      `deriveAssessmentPlanView` can never mark it past-due/red),
 *      `installmentCount: 0` (no fabricated "0 of 1 installments"), and the
 *      REAL untracked ledger balance as `remaining`, not the theoretical
 *      per-unit share.
 *
 * These tests use a SYNTHETIC scheduleless past-dated assessment (per the
 * dispatch acceptance criteria) — not CHC-specific data — plus the guard
 * cases: 2+ concurrent legacy assessments (ambiguous ledger attribution) and
 * an auto-posted assessment (must NOT be over-suppressed).
 *
 * Display-only invariants; no ledger writes are exercised.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";

// ---------------------------------------------------------------------------
// DB mock — rows are keyed by SQL table name; every `.where()` chain resolves
// to the fixture rows for the table passed to `.from()`. The functions under
// test re-filter rows in JS (referenceType / entryType), so serving the same
// ledger fixture to both ledger queries is faithful as long as fixtures only
// contain rows the SQL WHERE would have matched (see fixture comments).
// ---------------------------------------------------------------------------
const tables: Record<string, unknown[]> = {};

vi.mock("../server/db", () => ({
  db: {
    select: (_shape?: unknown) => ({
      from: (table: unknown) => {
        const name = getTableName(table as never);
        const rows = () => Promise.resolve(tables[name] ?? []);
        const chain: Record<string, unknown> = {
          where: () => rows(),
          innerJoin: () => ({ where: () => rows() }),
        };
        return chain;
      },
    }),
  },
}));

import {
  getAssessmentPlansForOwnerUnit,
  getUpcomingInstallmentsForOwnerUnit,
} from "../server/portal-assessment-detail";
import { deriveAssessmentPlanView } from "../shared/portal-assessment-plan";

const ASSOC = "assoc-1";
const PERSON = "person-1";
const MY_UNIT = "unit-1";

function makeAssessment(overrides: Record<string, unknown> = {}) {
  return {
    id: "sa-scheduleless",
    associationId: ASSOC,
    name: "Synthetic Scheduleless Assessment",
    totalAmount: 90000,
    // Past-dated — the exact shape that used to fabricate a years-past-due
    // installment #1.
    startDate: new Date("2021-01-01T00:00:00.000Z"),
    endDate: null,
    installmentCount: 1,
    interestRatePercent: null,
    termMonths: null,
    allocationMethod: "per-unit-equal",
    allocationCustomJson: null,
    excludedUnitIdsJson: [],
    autoPostEnabled: 0, // scheduleless / legacy — never wired to the orchestrator
    isActive: 1,
    ...overrides,
  };
}

function seed({
  assessments,
  ledger = [],
}: {
  assessments: unknown[];
  ledger?: unknown[];
}) {
  tables["special_assessments"] = assessments;
  // 18 units, per-unit-equal → the synthetic owner share is 90000/18 = 5000.
  tables["units"] = Array.from({ length: 18 }, (_, i) => ({
    id: i === 0 ? MY_UNIT : `unit-${i + 1}`,
    associationId: ASSOC,
    squareFootage: null,
  }));
  tables["ownerships"] = [
    { unitId: MY_UNIT, ownershipPercentage: null, endDate: null },
  ];
  // NOTE: only rows the real SQL WHEREs would match may appear here —
  // tracked-installment queries re-filter by referenceType in JS, and the
  // untracked-balance query only ever sees entryType === "assessment" rows.
  tables["owner_ledger_entries"] = ledger;
}

beforeEach(() => {
  for (const k of Object.keys(tables)) delete tables[k];
});

describe("scheduleless past-dated assessment (founder-os#13119)", () => {
  const untrackedRemaining = {
    // The CHC import pattern: ONE untracked "assessment" entry carrying the
    // REMAINING balance (not the original share) — referenceType null, so it
    // is invisible to the tracked-installment counter.
    id: "led-1",
    associationId: ASSOC,
    unitId: MY_UNIT,
    personId: PERSON,
    entryType: "assessment",
    referenceType: null,
    referenceId: null,
    amount: 2121.77,
    amountCents: 212177,
    postedAt: new Date("2026-05-08T00:00:00.000Z"),
  };

  it('never enters the "Pay this period" feed — no fabricated past-due installment', async () => {
    seed({ assessments: [makeAssessment()], ledger: [untrackedRemaining] });
    const upcoming = await getUpcomingInstallmentsForOwnerUnit({
      associationId: ASSOC,
      unitId: MY_UNIT,
      personId: PERSON,
    });
    expect(upcoming).toEqual([]);
  });

  it("renders as an ongoing paid-over-time plan: ledger-truth remaining, no due date, never past-due", async () => {
    seed({ assessments: [makeAssessment()], ledger: [untrackedRemaining] });
    const plans = await getAssessmentPlansForOwnerUnit({
      associationId: ASSOC,
      unitId: MY_UNIT,
      personId: PERSON,
    });
    expect(plans).toHaveLength(1);
    const plan = plans[0];

    // Ledger truth, not the theoretical 5000 share as a lump.
    expect(plan.remaining).toBe(2121.77);
    expect(plan.total).toBe(5000); // max(theoretical share, ledger remaining)
    expect(plan.paidToDate).toBe(2878.23); // total − remaining, reconciles
    // No fabricated schedule or due date.
    expect(plan.installmentCount).toBe(0);
    expect(plan.nextInstallmentDueDate).toBeNull();
    expect(plan.nextInstallmentAmount).toBeNull();

    // End-to-end rendering verdict via the SAME derivation the portal uses:
    // "On track", NOT red/past-due — even years after startDate.
    const view = deriveAssessmentPlanView(plan, new Date("2026-07-17T00:00:00.000Z"));
    expect(view.isPastDue).toBe(false);
    expect(view.isOnTrack).toBe(true);
    expect(view.hasSchedule).toBe(false);
  });

  it("2+ concurrent scheduleless assessments: ledger attribution is ambiguous, but the due date stays suppressed (still never red)", async () => {
    seed({
      assessments: [
        makeAssessment(),
        makeAssessment({ id: "sa-scheduleless-2", name: "Second Legacy Assessment", totalAmount: 18000 }),
      ],
      ledger: [untrackedRemaining],
    });

    const upcoming = await getUpcomingInstallmentsForOwnerUnit({
      associationId: ASSOC,
      unitId: MY_UNIT,
      personId: PERSON,
    });
    expect(upcoming).toEqual([]);

    const plans = await getAssessmentPlansForOwnerUnit({
      associationId: ASSOC,
      unitId: MY_UNIT,
      personId: PERSON,
    });
    expect(plans).toHaveLength(2);
    for (const plan of plans) {
      // Falls back to the theoretical share for amounts (can't attribute the
      // shared untracked balance), but NEVER fabricates a past-due date.
      expect(plan.nextInstallmentDueDate).toBeNull();
      expect(plan.installmentCount).toBe(0);
      const view = deriveAssessmentPlanView(plan, new Date("2026-07-17T00:00:00.000Z"));
      expect(view.isPastDue).toBe(false);
    }
  });

  it("does NOT over-suppress: an auto-posted assessment still surfaces its real next installment", async () => {
    seed({
      assessments: [
        makeAssessment({
          id: "sa-autoposted",
          name: "Orchestrated Assessment",
          autoPostEnabled: 1,
          installmentCount: 12,
          startDate: new Date("2026-07-01T00:00:00.000Z"),
        }),
      ],
      ledger: [],
    });

    const upcoming = await getUpcomingInstallmentsForOwnerUnit({
      associationId: ASSOC,
      unitId: MY_UNIT,
      personId: PERSON,
    });
    expect(upcoming).toHaveLength(1);
    expect(upcoming[0].installmentNumber).toBe(1);
    // `addUtcMonths` anchors to noon UTC — assert the calendar date.
    expect(upcoming[0].dueDate).toMatch(/^2026-07-01T/);
    expect(upcoming[0].installmentAmount).toBeCloseTo(90000 / 18 / 12, 2);

    const plans = await getAssessmentPlansForOwnerUnit({
      associationId: ASSOC,
      unitId: MY_UNIT,
      personId: PERSON,
    });
    expect(plans).toHaveLength(1);
    expect(plans[0].installmentCount).toBe(12);
    expect(plans[0].nextInstallmentDueDate).toMatch(/^2026-07-01T/);
  });
});
