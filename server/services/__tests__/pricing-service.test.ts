/**
 * pricing-service.test.ts — PM per-door billing + self-managed plan resolution.
 *
 * Covers the canonical pricing-model-v3 §2 PM track with the DECLINING per-door
 * rate amendment (William-ratified 2026-06-21):
 *   per-door rate DROPS by tier — $4.50 (Starter) / $4.25 (Growth) / $4.00 (Scale);
 *   tier resolved by PORTFOLIO total doors;
 *   bill = max(totalDoors × tierRate, tierMinimum); enterprise (5,000+) = manual.
 *   Each minimum = tierRate × the tier's ENTRY door count (continuous ladder):
 *   Starter min $500 (small-account floor) · Growth min $2,125 (501×$4.25) ·
 *   Scale min $8,000 (2,001×$4.00) · Enterprise from $18,000 (manual).
 *
 * Worked examples:
 *   100 doors  → Starter  → $500    (min applied; door bill $450 < $500)
 *   500 doors  → Starter  → $2,250  (= 500 × $4.50)
 *   1,500 doors → Growth  → $6,375  (= 1,500 × $4.25)
 *   3,000 doors → Scale   → $12,000 (= 3,000 × $4.00)
 *   5,001 doors → Enterprise → manual
 */

import { describe, it, expect, vi } from "vitest";

// Stub `server/db.ts` so importing the SUT does not throw on missing
// DATABASE_URL outside the app. We test the PURE functions only — the
// DB-backed overloads (resolveSelfManagedPlan / computePmPortfolioMonthlyBill)
// are exercised at the route/integration layer.
vi.mock("../../db", () => ({ db: {}, pool: {} }));

import {
  computePmPortfolioMonthlyBillFromList,
  computeSelfManagedMonthlyBillFromList,
  resolveSelfManagedPlanFromList,
  PM_PER_DOOR_RATE_CENTS,
  PM_TIER_MINIMUM_CENTS,
  SM_FLAT_FLOOR_CENTS,
  SM_PER_UNIT_RATE_CENTS,
  type PmComplexInput,
} from "../pricing-service";
import type { PlanCatalog } from "@shared/schema";

// ── Test fixtures — canonical PM per-door catalog (pricing-model-v3 §2.1) ──────

function pmPlan(overrides: Partial<PlanCatalog>): PlanCatalog {
  return {
    id: overrides.planKey ?? "x",
    planKey: "x",
    accountType: "property_manager",
    displayName: "X",
    status: "active",
    pricingModel: "per_door",
    unitMin: null,
    unitMax: null,
    currency: "USD",
    billingFrequencySupported: ["monthly"],
    monthlyAmountCents: PM_PER_DOOR_RATE_CENTS.pm_scale, // default $4.00; per-tier rates set per fixture below
    annualEffectiveMonthlyCents: null,
    annualBilledAmountCents: null,
    minimumAmountCents: null,
    recommendedInSignup: 0,
    version: 1,
    effectiveFrom: new Date(),
    effectiveTo: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as PlanCatalog;
}

const PM_PLANS: PlanCatalog[] = [
  pmPlan({
    planKey: "pm_starter",
    displayName: "PM Starter",
    pricingModel: "per_door",
    unitMin: 1,
    unitMax: 500,
    monthlyAmountCents: PM_PER_DOOR_RATE_CENTS.pm_starter, // 450 — $4.50/door
    minimumAmountCents: PM_TIER_MINIMUM_CENTS.pm_starter, // 50000 — $500
  }),
  pmPlan({
    planKey: "pm_growth",
    displayName: "PM Growth",
    pricingModel: "per_door",
    unitMin: 501,
    unitMax: 2000,
    monthlyAmountCents: PM_PER_DOOR_RATE_CENTS.pm_growth, // 425 — $4.25/door
    minimumAmountCents: PM_TIER_MINIMUM_CENTS.pm_growth, // 212500 — $2,125
  }),
  pmPlan({
    planKey: "pm_scale",
    displayName: "PM Scale",
    pricingModel: "per_door",
    unitMin: 2001,
    unitMax: 5000,
    monthlyAmountCents: PM_PER_DOOR_RATE_CENTS.pm_scale, // 400 — $4.00/door
    minimumAmountCents: PM_TIER_MINIMUM_CENTS.pm_scale, // 800000 — $8,000
  }),
  pmPlan({
    planKey: "pm_enterprise",
    displayName: "PM Enterprise",
    pricingModel: "enterprise_manual",
    unitMin: 5001,
    unitMax: null,
    monthlyAmountCents: null,
    minimumAmountCents: PM_TIER_MINIMUM_CENTS.pm_enterprise, // 1800000 — $18,000 (manual)
  }),
];

function communities(...doorCounts: number[]): PmComplexInput[] {
  return doorCounts.map((unitCount, i) => ({
    associationId: `assoc-${i + 1}`,
    unitCount,
  }));
}

// ── PM per-door billing ───────────────────────────────────────────────────────

describe("computePmPortfolioMonthlyBillFromList — per-door model", () => {
  it("declining per-door rate applies across the portfolio (single community, mid Starter)", () => {
    const r = computePmPortfolioMonthlyBillFromList(communities(300), PM_PLANS);
    expect(r.totalDoors).toBe(300);
    expect(r.resolvedTierPlanKey).toBe("pm_starter");
    expect(r.perDoorAmountCents).toBe(450); // $4.50/door (Starter)
    // 300 × $4.50 = $1,350 — above the $500 minimum, so no top-up.
    expect(r.computedSubtotalCents).toBe(135000);
    expect(r.minimumAppliedCents).toBe(0);
    expect(r.finalTotalCents).toBe(135000);
    expect(r.manualReviewRequired).toBe(false);
  });

  it("WORKED EXAMPLE: 100 doors → Starter → $500 minimum applied (door bill $450)", () => {
    const r = computePmPortfolioMonthlyBillFromList(communities(100), PM_PLANS);
    expect(r.totalDoors).toBe(100);
    expect(r.resolvedTierPlanKey).toBe("pm_starter");
    expect(r.perDoorAmountCents).toBe(450); // $4.50/door
    expect(r.computedSubtotalCents).toBe(45000); // 100 × $4.50 = $450
    expect(r.tierMinimumCents).toBe(50000); // $500
    expect(r.minimumAppliedCents).toBe(5000); // top-up $50
    expect(r.finalTotalCents).toBe(50000); // $500 floor wins
  });

  it("WORKED EXAMPLE: 500 doors → Starter → $2,250 (= 500 × $4.50)", () => {
    const r = computePmPortfolioMonthlyBillFromList(communities(500), PM_PLANS);
    expect(r.resolvedTierPlanKey).toBe("pm_starter");
    expect(r.perDoorAmountCents).toBe(450);
    expect(r.finalTotalCents).toBe(225000); // $2,250
    expect(r.minimumAppliedCents).toBe(0);
  });

  it("WORKED EXAMPLE: 1,500 doors → Growth → $6,375 (= 1,500 × $4.25)", () => {
    // Split across multiple communities to prove tier is by PORTFOLIO total.
    const r = computePmPortfolioMonthlyBillFromList(
      communities(800, 400, 300),
      PM_PLANS,
    );
    expect(r.totalDoors).toBe(1500);
    expect(r.resolvedTierPlanKey).toBe("pm_growth");
    expect(r.perDoorAmountCents).toBe(425); // $4.25/door (Growth)
    expect(r.computedSubtotalCents).toBe(637500); // $6,375
    expect(r.minimumAppliedCents).toBe(0); // above $2,125 min
    expect(r.finalTotalCents).toBe(637500);
    // Each line is its community's share at $4.25/door.
    expect(r.lines.map((l) => l.computedLineCents)).toEqual([
      340000, 170000, 127500,
    ]);
    expect(r.lines.every((l) => l.planKey === "pm_growth")).toBe(true);
  });

  it("WORKED EXAMPLE: 3,000 doors → Scale → $12,000 (= 3,000 × $4.00)", () => {
    const r = computePmPortfolioMonthlyBillFromList(communities(3000), PM_PLANS);
    expect(r.resolvedTierPlanKey).toBe("pm_scale");
    expect(r.perDoorAmountCents).toBe(400); // $4.00/door (Scale)
    expect(r.computedSubtotalCents).toBe(1200000); // $12,000
    expect(r.minimumAppliedCents).toBe(0); // above $8,000 min
    expect(r.finalTotalCents).toBe(1200000);
  });

  it("Growth minimum: just over the boundary (501 doors → $2,129.25, above $2,125 floor)", () => {
    const r = computePmPortfolioMonthlyBillFromList(communities(501), PM_PLANS);
    expect(r.resolvedTierPlanKey).toBe("pm_growth");
    expect(r.computedSubtotalCents).toBe(212925); // 501 × $4.25 = $2,129.25
    expect(r.tierMinimumCents).toBe(212500); // $2,125
    expect(r.minimumAppliedCents).toBe(0); // door bill already > min
    expect(r.finalTotalCents).toBe(212925);
  });

  it("Scale minimum: low-end Scale portfolio (2,001 doors → $8,004, above $8,000 floor)", () => {
    const r = computePmPortfolioMonthlyBillFromList(communities(2001), PM_PLANS);
    expect(r.resolvedTierPlanKey).toBe("pm_scale");
    expect(r.computedSubtotalCents).toBe(800400); // 2,001 × $4.00 = $8,004
    expect(r.tierMinimumCents).toBe(800000); // $8,000
    expect(r.minimumAppliedCents).toBe(0);
    expect(r.finalTotalCents).toBe(800400);
  });

  it("Enterprise (5,000+) → manual review, no auto bill", () => {
    const r = computePmPortfolioMonthlyBillFromList(communities(6000), PM_PLANS);
    expect(r.resolvedTierPlanKey).toBe("pm_enterprise");
    expect(r.manualReviewRequired).toBe(true);
    expect(r.perDoorAmountCents).toBeNull();
    expect(r.computedSubtotalCents).toBe(0);
    expect(r.minimumAppliedCents).toBe(0);
    expect(r.finalTotalCents).toBe(0);
    expect(r.lines.every((l) => l.isEnterprise && l.computedLineCents === 0)).toBe(true);
  });

  it("tier is determined by TOTAL doors, not the largest community", () => {
    // 6 communities of 100 = 600 total → Growth, even though each alone is Starter-range.
    const r = computePmPortfolioMonthlyBillFromList(
      communities(100, 100, 100, 100, 100, 100),
      PM_PLANS,
    );
    expect(r.totalDoors).toBe(600);
    expect(r.resolvedTierPlanKey).toBe("pm_growth");
    expect(r.computedSubtotalCents).toBe(255000); // 600 × $4.25 = $2,550
    expect(r.finalTotalCents).toBe(255000);
  });

  it("exact tier boundary at 500 stays in Starter", () => {
    const r = computePmPortfolioMonthlyBillFromList(communities(250, 250), PM_PLANS);
    expect(r.totalDoors).toBe(500);
    expect(r.resolvedTierPlanKey).toBe("pm_starter");
  });

  it("exact tier boundary at 2,000 stays in Growth", () => {
    const r = computePmPortfolioMonthlyBillFromList(communities(2000), PM_PLANS);
    expect(r.resolvedTierPlanKey).toBe("pm_growth");
  });

  it("exact tier boundary at 5,000 stays in Scale", () => {
    const r = computePmPortfolioMonthlyBillFromList(communities(5000), PM_PLANS);
    expect(r.resolvedTierPlanKey).toBe("pm_scale");
  });

  it("throws on empty portfolio", () => {
    expect(() => computePmPortfolioMonthlyBillFromList([], PM_PLANS)).toThrow(
      /at least one community/i,
    );
  });

  it("throws on invalid door count", () => {
    expect(() =>
      computePmPortfolioMonthlyBillFromList(communities(0), PM_PLANS),
    ).toThrow(/invalid door count/i);
  });
});

// ── Self-managed DECLINING per-unit model (William-ratified 2026-06-21) ───────
//
//   Small Community      (1–40)     $129/mo FLAT  → 12900¢ (floor; only minimum)
//   Mid Community         (41–100)   $3.75/unit/mo → 375¢  (units × 375)
//   Large Community       (101–250)  $3.50/unit/mo → 350¢  (units × 350)
//   Enterprise Concierge  (251+)     custom / negotiable — manual
//
// Worked examples (per the dispatch):
//   18 units  → Small  → $129    (flat floor)
//   75 units  → Mid    → $281.25 (= 75 × $3.75)
//   150 units → Large  → $525    (= 150 × $3.50)
//   250 units → Large  → $875    (= 250 × $3.50)

const SM_PLANS: PlanCatalog[] = [
  pmPlan({
    planKey: "small_community",
    accountType: "self_managed",
    displayName: "Small Community",
    pricingModel: "flat_per_association",
    unitMin: 1,
    unitMax: 40,
    monthlyAmountCents: SM_FLAT_FLOOR_CENTS, // 12900 — $129/mo flat
    minimumAmountCents: SM_FLAT_FLOOR_CENTS, // 12900 — $129 floor
  }),
  pmPlan({
    planKey: "mid_community",
    accountType: "self_managed",
    displayName: "Mid Community",
    pricingModel: "per_door", // per-UNIT (mirrors PM per-door storage)
    unitMin: 41,
    unitMax: 100,
    monthlyAmountCents: SM_PER_UNIT_RATE_CENTS.mid_community, // 375 — $3.75/unit
    minimumAmountCents: null, // no separate minimum
  }),
  pmPlan({
    planKey: "large_community",
    accountType: "self_managed",
    displayName: "Large Community",
    pricingModel: "per_door",
    unitMin: 101,
    unitMax: 250,
    monthlyAmountCents: SM_PER_UNIT_RATE_CENTS.large_community, // 350 — $3.50/unit
    minimumAmountCents: null,
  }),
  pmPlan({
    planKey: "enterprise_concierge",
    accountType: "self_managed",
    displayName: "Enterprise Concierge",
    pricingModel: "enterprise_manual",
    unitMin: 251,
    unitMax: null,
    monthlyAmountCents: null,
    minimumAmountCents: null,
  }),
];

describe("resolveSelfManagedPlanFromList", () => {
  it("matches a unit count to the correct community tier", () => {
    expect(resolveSelfManagedPlanFromList(18, SM_PLANS).planKey).toBe("small_community");
    expect(resolveSelfManagedPlanFromList(40, SM_PLANS).planKey).toBe("small_community");
    expect(resolveSelfManagedPlanFromList(41, SM_PLANS).planKey).toBe("mid_community");
    expect(resolveSelfManagedPlanFromList(100, SM_PLANS).planKey).toBe("mid_community");
    expect(resolveSelfManagedPlanFromList(101, SM_PLANS).planKey).toBe("large_community");
    expect(resolveSelfManagedPlanFromList(250, SM_PLANS).planKey).toBe("large_community");
    expect(resolveSelfManagedPlanFromList(251, SM_PLANS).planKey).toBe("enterprise_concierge");
    expect(resolveSelfManagedPlanFromList(5000, SM_PLANS).planKey).toBe("enterprise_concierge");
  });

  it("throws below 1 unit", () => {
    expect(() => resolveSelfManagedPlanFromList(0, SM_PLANS)).toThrow(/invalid unit count/i);
  });
});

describe("computeSelfManagedMonthlyBillFromList — declining per-unit model", () => {
  it("WORKED EXAMPLE: 18 units → Small → $129 (flat floor)", () => {
    const r = computeSelfManagedMonthlyBillFromList(18, SM_PLANS);
    expect(r.planKey).toBe("small_community");
    expect(r.pricingModel).toBe("flat_per_association");
    expect(r.flatAmountCents).toBe(12900);
    expect(r.perUnitAmountCents).toBeNull();
    expect(r.finalTotalCents).toBe(12900); // $129
    expect(r.manualReviewRequired).toBe(false);
  });

  it("WORKED EXAMPLE: 75 units → Mid → $281.25 (= 75 × $3.75)", () => {
    const r = computeSelfManagedMonthlyBillFromList(75, SM_PLANS);
    expect(r.planKey).toBe("mid_community");
    expect(r.pricingModel).toBe("per_door");
    expect(r.perUnitAmountCents).toBe(375); // $3.75/unit
    expect(r.flatAmountCents).toBeNull();
    expect(r.computedSubtotalCents).toBe(28125); // 75 × 375 = $281.25
    expect(r.minimumAppliedCents).toBe(0);
    expect(r.finalTotalCents).toBe(28125);
  });

  it("WORKED EXAMPLE: 150 units → Large → $525 (= 150 × $3.50)", () => {
    const r = computeSelfManagedMonthlyBillFromList(150, SM_PLANS);
    expect(r.planKey).toBe("large_community");
    expect(r.perUnitAmountCents).toBe(350); // $3.50/unit
    expect(r.computedSubtotalCents).toBe(52500); // 150 × 350 = $525
    expect(r.finalTotalCents).toBe(52500);
    expect(r.minimumAppliedCents).toBe(0);
  });

  it("WORKED EXAMPLE: 250 units → Large → $875 (= 250 × $3.50)", () => {
    const r = computeSelfManagedMonthlyBillFromList(250, SM_PLANS);
    expect(r.planKey).toBe("large_community");
    expect(r.perUnitAmountCents).toBe(350);
    expect(r.computedSubtotalCents).toBe(87500); // 250 × 350 = $875
    expect(r.finalTotalCents).toBe(87500);
  });

  it("Mid entry (41 units) naturally exceeds the $129 floor → $153.75, no top-up", () => {
    const r = computeSelfManagedMonthlyBillFromList(41, SM_PLANS);
    expect(r.planKey).toBe("mid_community");
    expect(r.computedSubtotalCents).toBe(15375); // 41 × 375 = $153.75
    expect(r.tierMinimumCents).toBe(0); // no separate minimum on Mid
    expect(r.minimumAppliedCents).toBe(0);
    expect(r.finalTotalCents).toBe(15375);
  });

  it("Large entry (101 units) naturally exceeds the $129 floor → $353.50, no top-up", () => {
    const r = computeSelfManagedMonthlyBillFromList(101, SM_PLANS);
    expect(r.planKey).toBe("large_community");
    expect(r.computedSubtotalCents).toBe(35350); // 101 × 350 = $353.50
    expect(r.minimumAppliedCents).toBe(0);
    expect(r.finalTotalCents).toBe(35350);
  });

  it("Small floor holds across the whole 1–40 band (flat $129 regardless of unit count)", () => {
    expect(computeSelfManagedMonthlyBillFromList(1, SM_PLANS).finalTotalCents).toBe(12900);
    expect(computeSelfManagedMonthlyBillFromList(40, SM_PLANS).finalTotalCents).toBe(12900);
  });

  it("exact tier boundary at 40 stays Small (flat); 41 flips to Mid (per-unit)", () => {
    expect(computeSelfManagedMonthlyBillFromList(40, SM_PLANS).planKey).toBe("small_community");
    expect(computeSelfManagedMonthlyBillFromList(41, SM_PLANS).planKey).toBe("mid_community");
  });

  it("exact tier boundary at 100 stays Mid; 101 flips to Large", () => {
    expect(computeSelfManagedMonthlyBillFromList(100, SM_PLANS).planKey).toBe("mid_community");
    expect(computeSelfManagedMonthlyBillFromList(101, SM_PLANS).planKey).toBe("large_community");
  });

  it("Enterprise Concierge (251+) → manual review, no auto bill", () => {
    const r = computeSelfManagedMonthlyBillFromList(400, SM_PLANS);
    expect(r.planKey).toBe("enterprise_concierge");
    expect(r.manualReviewRequired).toBe(true);
    expect(r.flatAmountCents).toBeNull();
    expect(r.perUnitAmountCents).toBeNull();
    expect(r.computedSubtotalCents).toBe(0);
    expect(r.finalTotalCents).toBe(0);
  });

  it("throws below 1 unit", () => {
    expect(() => computeSelfManagedMonthlyBillFromList(0, SM_PLANS)).toThrow(/invalid unit count/i);
  });
});
