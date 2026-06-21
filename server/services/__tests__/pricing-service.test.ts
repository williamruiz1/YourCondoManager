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
  resolveSelfManagedPlanFromList,
  PM_PER_DOOR_RATE_CENTS,
  PM_TIER_MINIMUM_CENTS,
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

// ── Self-managed resolution (unchanged behavior — guard regression) ───────────

describe("resolveSelfManagedPlanFromList", () => {
  const smPlans: PlanCatalog[] = [
    pmPlan({
      planKey: "small_community",
      accountType: "self_managed",
      displayName: "Small Community",
      pricingModel: "flat_per_association",
      unitMin: 1,
      unitMax: 30,
    }),
    pmPlan({
      planKey: "mid_community",
      accountType: "self_managed",
      displayName: "Mid Community",
      pricingModel: "flat_per_association",
      unitMin: 31,
      unitMax: 75,
    }),
  ];

  it("matches a unit count to the correct self-managed band", () => {
    expect(resolveSelfManagedPlanFromList(18, smPlans).planKey).toBe("small_community");
    expect(resolveSelfManagedPlanFromList(50, smPlans).planKey).toBe("mid_community");
  });

  it("throws below 1 unit", () => {
    expect(() => resolveSelfManagedPlanFromList(0, smPlans)).toThrow(/invalid unit count/i);
  });

  it("throws when no band matches", () => {
    expect(() => resolveSelfManagedPlanFromList(999, smPlans)).toThrow(/no active self-managed plan/i);
  });
});
