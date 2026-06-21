/**
 * pricing-service.ts — Plan resolution and PM portfolio billing computation.
 *
 * Two exported functions:
 *  - resolveSelfManagedPlan: match a unit count to the correct plan_catalog row
 *  - computePmPortfolioMonthlyBill: compute monthly bill for a PM portfolio
 *
 * Both functions accept a plans array parameter so they can be unit-tested
 * without a live database. The DB-backed overloads fetch from plan_catalog
 * automatically.
 */

import { db } from "../db";
import { planCatalog, type PlanCatalog } from "@shared/schema";
import { eq, and } from "drizzle-orm";

// ── Types ────────────────────────────────────────────────────────────────────

export type PmComplexInput = {
  associationId: string;
  unitCount: number;
};

export type PmLineItem = {
  associationId: string;
  /** Doors (units) managed in this community. */
  unitCount: number;
  /** The portfolio-level per-door tier this community rolls up into. */
  planKey: string;
  displayName: string;
  /** Per-door rate (cents) for the resolved tier. Null for enterprise. */
  perDoorAmountCents: number | null;
  /** This community's share of the door-count bill: unitCount × perDoorAmountCents. */
  computedLineCents: number;
  isEnterprise: boolean;
};

export type PmPortfolioBillResult = {
  lines: PmLineItem[];
  /** Total doors managed across the whole PM portfolio. */
  totalDoors: number;
  /** The per-door tier the portfolio's TOTAL door count resolves into. */
  resolvedTierPlanKey: string;
  resolvedTierDisplayName: string;
  /** Per-door rate (cents) for the resolved tier. Null for enterprise. */
  perDoorAmountCents: number | null;
  /** totalDoors × perDoorAmountCents (0 for enterprise / manual). */
  computedSubtotalCents: number;
  /** The resolved tier's monthly minimum (cents); 0 if none. */
  tierMinimumCents: number;
  /** Top-up applied when the door-count bill falls below the tier minimum. */
  minimumAppliedCents: number;
  /** max(computedSubtotalCents, tierMinimumCents). */
  finalTotalCents: number;
  manualReviewRequired: boolean;
};

/**
 * Canonical PM per-door rate (cents). $4.00/door/mo FLAT across all tiers per
 * pricing-model-v3 §2.1. Sourced from plan_catalog rows at runtime; this is the
 * expected value the seed encodes, kept here as a documented reference for the
 * pure-function callers that pass their own plan list.
 */
export const PM_PER_DOOR_RATE_CENTS = 400; // $4.00/door/mo

// ── Helpers (pure, testable) ─────────────────────────────────────────────────

/**
 * Pure function: resolve a self-managed plan from a provided list.
 * Throws if unitCount is invalid or no matching band exists.
 */
export function resolveSelfManagedPlanFromList(
  unitCount: number,
  plans: PlanCatalog[],
): PlanCatalog {
  if (unitCount < 1) {
    throw new Error(`Invalid unit count: ${unitCount}. Must be >= 1.`);
  }

  const matched = plans.find(
    (p) =>
      p.accountType === "self_managed" &&
      p.status === "active" &&
      p.unitMin !== null &&
      unitCount >= p.unitMin &&
      (p.unitMax === null || unitCount <= p.unitMax),
  );

  if (!matched) {
    throw new Error(
      `No active self-managed plan found for ${unitCount} units. ` +
      `Associations above 200 units should contact sales.`,
    );
  }

  return matched;
}

/**
 * Pure function: compute PM portfolio monthly bill from a provided plan list.
 *
 * Per-door model (pricing-model-v3 §2):
 *   1. Sum total doors across every managed community.
 *   2. Resolve the per-door TIER by the PORTFOLIO's total door count
 *      (≤500 / 501–2,000 / 2,001–5,000 / 5,000+), NOT per-community.
 *   3. bill = max(totalDoors × $4.00, tierMinimum).
 *
 * Tier MEMBERSHIP gates features + sets the minimum; the per-door RATE is flat
 * ($4) across every non-enterprise tier. Enterprise (5,000+) is manual billing.
 */
export function computePmPortfolioMonthlyBillFromList(
  complexes: PmComplexInput[],
  plans: PlanCatalog[],
): PmPortfolioBillResult {
  if (complexes.length === 0) {
    throw new Error("At least one community is required.");
  }

  const pmPlans = plans.filter(
    (p) => p.accountType === "property_manager" && p.status === "active",
  );

  // Validate doors up front + compute the portfolio total.
  let totalDoors = 0;
  for (const community of complexes) {
    if (community.unitCount < 1) {
      throw new Error(
        `Invalid door count for association ${community.associationId}: ${community.unitCount}`,
      );
    }
    totalDoors += community.unitCount;
  }

  // Resolve the tier by the PORTFOLIO's total door count.
  const tier = pmPlans.find(
    (p) =>
      p.unitMin !== null &&
      totalDoors >= p.unitMin &&
      (p.unitMax === null || totalDoors <= p.unitMax),
  );

  if (!tier) {
    throw new Error(
      `No PM plan found for a portfolio of ${totalDoors} total doors.`,
    );
  }

  const isEnterprise = tier.pricingModel === "enterprise_manual";
  const perDoorAmountCents = isEnterprise ? null : (tier.monthlyAmountCents ?? 0);

  // Per-community line items reflect each community's share of the door-count
  // bill at the portfolio's resolved per-door rate. (Enterprise → 0; manual.)
  const lines: PmLineItem[] = complexes.map((community) => ({
    associationId: community.associationId,
    unitCount: community.unitCount,
    planKey: tier.planKey,
    displayName: tier.displayName,
    perDoorAmountCents,
    computedLineCents: isEnterprise
      ? 0
      : community.unitCount * (perDoorAmountCents ?? 0),
    isEnterprise,
  }));

  const manualReviewRequired = isEnterprise;

  const computedSubtotalCents = isEnterprise
    ? 0
    : totalDoors * (perDoorAmountCents ?? 0);

  const tierMinimumCents = isEnterprise ? 0 : (tier.minimumAmountCents ?? 0);

  let minimumAppliedCents = 0;
  let finalTotalCents = computedSubtotalCents;

  if (!manualReviewRequired && computedSubtotalCents < tierMinimumCents) {
    minimumAppliedCents = tierMinimumCents - computedSubtotalCents;
    finalTotalCents = tierMinimumCents;
  }

  return {
    lines,
    totalDoors,
    resolvedTierPlanKey: tier.planKey,
    resolvedTierDisplayName: tier.displayName,
    perDoorAmountCents,
    computedSubtotalCents,
    tierMinimumCents,
    minimumAppliedCents,
    finalTotalCents,
    manualReviewRequired,
  };
}

// ── DB-backed public API ─────────────────────────────────────────────────────

async function fetchActivePlans(accountType: "self_managed" | "property_manager"): Promise<PlanCatalog[]> {
  return db
    .select()
    .from(planCatalog)
    .where(
      and(
        eq(planCatalog.accountType, accountType),
        eq(planCatalog.status, "active"),
      ),
    );
}

/**
 * Resolve the correct self-managed plan for a given unit count.
 * Queries plan_catalog for active self_managed plans.
 */
export async function resolveSelfManagedPlan(unitCount: number): Promise<PlanCatalog> {
  const plans = await fetchActivePlans("self_managed");
  return resolveSelfManagedPlanFromList(unitCount, plans);
}

/**
 * Compute the monthly bill for a PM portfolio.
 * Queries plan_catalog for active property_manager plans.
 */
export async function computePmPortfolioMonthlyBill(
  complexes: PmComplexInput[],
): Promise<PmPortfolioBillResult> {
  const plans = await fetchActivePlans("property_manager");
  return computePmPortfolioMonthlyBillFromList(complexes, plans);
}
