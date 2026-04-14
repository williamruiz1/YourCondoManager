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
  unitCount: number;
  planKey: string;
  displayName: string;
  unitAmountCents: number | null;
  isEnterprise: boolean;
};

export type PmPortfolioBillResult = {
  lines: PmLineItem[];
  computedSubtotalCents: number;
  minimumAppliedCents: number;
  finalTotalCents: number;
  manualReviewRequired: boolean;
};

const PM_MONTHLY_MINIMUM_CENTS = 30000; // $300/mo minimum

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
 */
export function computePmPortfolioMonthlyBillFromList(
  complexes: PmComplexInput[],
  plans: PlanCatalog[],
): PmPortfolioBillResult {
  if (complexes.length === 0) {
    throw new Error("At least one complex is required.");
  }

  const pmPlans = plans.filter(
    (p) => p.accountType === "property_manager" && p.status === "active",
  );

  const lines: PmLineItem[] = complexes.map((complex) => {
    if (complex.unitCount < 1) {
      throw new Error(
        `Invalid unit count for association ${complex.associationId}: ${complex.unitCount}`,
      );
    }

    const matched = pmPlans.find(
      (p) =>
        p.unitMin !== null &&
        complex.unitCount >= p.unitMin &&
        (p.unitMax === null || complex.unitCount <= p.unitMax),
    );

    if (!matched) {
      throw new Error(
        `No PM plan found for ${complex.unitCount} units (association ${complex.associationId}).`,
      );
    }

    const isEnterprise = matched.pricingModel === "enterprise_manual";

    return {
      associationId: complex.associationId,
      unitCount: complex.unitCount,
      planKey: matched.planKey,
      displayName: matched.displayName,
      unitAmountCents: matched.monthlyAmountCents,
      isEnterprise,
    };
  });

  const manualReviewRequired = lines.some((l) => l.isEnterprise);

  const computedSubtotalCents = lines.reduce(
    (sum, l) => sum + (l.isEnterprise ? 0 : (l.unitAmountCents ?? 0)),
    0,
  );

  let minimumAppliedCents = 0;
  let finalTotalCents = computedSubtotalCents;

  if (!manualReviewRequired && computedSubtotalCents < PM_MONTHLY_MINIMUM_CENTS) {
    minimumAppliedCents = PM_MONTHLY_MINIMUM_CENTS - computedSubtotalCents;
    finalTotalCents = PM_MONTHLY_MINIMUM_CENTS;
  }

  return {
    lines,
    computedSubtotalCents,
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
