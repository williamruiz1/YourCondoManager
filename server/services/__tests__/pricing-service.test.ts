/**
 * pricing-service.test.ts — PM per-door billing + self-managed plan resolution.
 *
 * Covers the canonical pricing-model-v3 §2 PM track:
 *   $4/door FLAT across all tiers; tier resolved by PORTFOLIO total doors;
 *   bill = max(totalDoors × $4, tierMinimum); enterprise (5,000+) = manual.
 *
 * Worked examples (pricing-model-v3 §2.4):
 *   100 doors  → Starter  → $500 (min applied; door bill $400 < $500)
 *   500 doors  → Starter  → $2,000 (= 500 × $4)
 *   1,500 doors → Growth  → $6,000 (= 1,500 × $4)
 *   3,000 doors → Scale   → $12,000 (= 3,000 × $4)
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
    monthlyAmountCents: PM_PER_DOOR_RATE_CENTS,
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
    monthlyAmountCents: 400,
    minimumAmountCents: 50000, // $500
  }),
  pmPlan({
    planKey: "pm_growth",
    displayName: "PM Growth",
    pricingModel: "per_door",
    unitMin: 501,
    unitMax: 2000,
    monthlyAmountCents: 400,
    minimumAmountCents: 200000, // $2,000
  }),
  pmPlan({
    planKey: "pm_scale",
    displayName: "PM Scale",
    pricingModel: "per_door",
    unitMin: 2001,
    unitMax: 5000,
    monthlyAmountCents: 400,
    minimumAmountCents: 500000, // $5,000
  }),
  pmPlan({
    planKey: "pm_enterprise",
    displayName: "PM Enterprise",
    pricingModel: "enterprise_manual",
    unitMin: 5001,
    unitMax: null,
    monthlyAmountCents: null,
    minimumAmountCents: 1250000, // $12,500 (reference; manual billing)
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
  it("flat $4/door applies across the portfolio (single community, mid Starter)", () => {
    const r = computePmPortfolioMonthlyBillFromList(communities(300), PM_PLANS);
    expect(r.totalDoors).toBe(300);
    expect(r.resolvedTierPlanKey).toBe("pm_starter");
    expect(r.perDoorAmountCents).toBe(400);
    // 300 × $4 = $1,200 — above the $500 minimum, so no top-up.
    expect(r.computedSubtotalCents).toBe(120000);
    expect(r.minimumAppliedCents).toBe(0);
    expect(r.finalTotalCents).toBe(120000);
    expect(r.manualReviewRequired).toBe(false);
  });

  it("WORKED EXAMPLE: 100 doors → Starter → $500 minimum applied", () => {
    const r = computePmPortfolioMonthlyBillFromList(communities(100), PM_PLANS);
    expect(r.totalDoors).toBe(100);
    expect(r.resolvedTierPlanKey).toBe("pm_starter");
    expect(r.computedSubtotalCents).toBe(40000); // 100 × $4 = $400
    expect(r.tierMinimumCents).toBe(50000); // $500
    expect(r.minimumAppliedCents).toBe(10000); // top-up $100
    expect(r.finalTotalCents).toBe(50000); // $500 floor wins
  });

  it("WORKED EXAMPLE: 500 doors → Starter → $2,000 (= 500 × $4)", () => {
    const r = computePmPortfolioMonthlyBillFromList(communities(500), PM_PLANS);
    expect(r.resolvedTierPlanKey).toBe("pm_starter");
    expect(r.finalTotalCents).toBe(200000); // $2,000
    expect(r.minimumAppliedCents).toBe(0);
  });

  it("WORKED EXAMPLE: 1,500 doors → Growth → $6,000 (= 1,500 × $4)", () => {
    // Split across multiple communities to prove tier is by PORTFOLIO total.
    const r = computePmPortfolioMonthlyBillFromList(
      communities(800, 400, 300),
      PM_PLANS,
    );
    expect(r.totalDoors).toBe(1500);
    expect(r.resolvedTierPlanKey).toBe("pm_growth");
    expect(r.computedSubtotalCents).toBe(600000); // $6,000
    expect(r.minimumAppliedCents).toBe(0); // above $2,000 min
    expect(r.finalTotalCents).toBe(600000);
    // Each line is its community's share at $4/door.
    expect(r.lines.map((l) => l.computedLineCents)).toEqual([
      320000, 160000, 120000,
    ]);
    expect(r.lines.every((l) => l.planKey === "pm_growth")).toBe(true);
  });

  it("WORKED EXAMPLE: 3,000 doors → Scale → $12,000 (= 3,000 × $4)", () => {
    const r = computePmPortfolioMonthlyBillFromList(communities(3000), PM_PLANS);
    expect(r.resolvedTierPlanKey).toBe("pm_scale");
    expect(r.computedSubtotalCents).toBe(1200000); // $12,000
    expect(r.minimumAppliedCents).toBe(0); // above $5,000 min
    expect(r.finalTotalCents).toBe(1200000);
  });

  it("Growth minimum applies just over the boundary (501 doors → $2,000 floor)", () => {
    const r = computePmPortfolioMonthlyBillFromList(communities(501), PM_PLANS);
    expect(r.resolvedTierPlanKey).toBe("pm_growth");
    expect(r.computedSubtotalCents).toBe(200400); // 501 × $4 = $2,004
    expect(r.tierMinimumCents).toBe(200000);
    expect(r.minimumAppliedCents).toBe(0); // door bill already > min
    expect(r.finalTotalCents).toBe(200400);
  });

  it("Scale minimum tops up a low-end Scale portfolio (2,001 doors → $5,000 floor)", () => {
    const r = computePmPortfolioMonthlyBillFromList(communities(2001), PM_PLANS);
    expect(r.resolvedTierPlanKey).toBe("pm_scale");
    expect(r.computedSubtotalCents).toBe(800400); // 2,001 × $4 = $8,004
    expect(r.tierMinimumCents).toBe(500000);
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
    expect(r.computedSubtotalCents).toBe(240000); // 600 × $4 = $2,400
    expect(r.finalTotalCents).toBe(240000);
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
