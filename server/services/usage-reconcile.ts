/**
 * usage-reconcile.ts — report current per-unit / per-door usage to Stripe Billing
 * Meters for every active metered platform subscription, once per billing period.
 *
 * WHY A PERIODIC RECONCILE (not purely on-change)
 * -----------------------------------------------
 * The Stripe meters are SUM aggregators (see stripe-meter-reporting.ts). The robust,
 * simple model the prompt explicitly blesses is: report each active metered
 * subscription's CURRENT count exactly once per billing period. This is:
 *   - correct: the first invoice of each period reflects the live unit/door count;
 *   - idempotent: the local ledger (migration 0048) + a deterministic Stripe
 *     `identifier` make re-runs no-ops, so it is safe to run hourly/daily;
 *   - robust to drift: a count that changed since signup is picked up next period
 *     with no extra plumbing in every add-unit / portfolio-change code path.
 *
 * The signup path (provisionWorkspace) ALSO reports the initial count immediately on
 * subscription creation via reportInitialUsageForAssociation() below, so the FIRST
 * invoice is correct even before the first reconcile tick.
 *
 * The actual count is the source of truth resolved live:
 *   - self-managed → COUNT(units) for the subscription's association;
 *   - property-manager → SUM(COUNT(units)) across every association the
 *     subscription's admin manages (the portfolio's total doors).
 *
 * Tier (and therefore whether the subscription is metered + which meter event_name)
 * is resolved LIVE from that count via pricing-service, exactly as signup does — so
 * this never relies on a denormalized planKey that could drift.
 */

import { assertStripeKeySafe } from "../staging-guard";
import { db } from "../db";
import { units, associations, adminAssociationScopes, adminUsers, platformSubscriptions } from "@shared/schema";
import { eq, count, inArray } from "drizzle-orm";
import {
  resolveSelfManagedPlanFromList,
  computePmPortfolioMonthlyBillFromList,
} from "./pricing-service";
import { planCatalog, type PlanCatalog, type PlatformSubscription } from "@shared/schema";
import { and } from "drizzle-orm";
import {
  resolveMeterEventName,
  buildMeterEventIdentifier,
  reportMeterEvent,
  type MeterPoster,
  type ReportSubscriptionUsageResult,
} from "./stripe-meter-reporting";
import { getSecret } from "../platform-secrets-store";

// ── Standalone Stripe meter poster ───────────────────────────────────────────

/**
 * Build a MeterPoster bound to the platform Stripe credential, reading the secret
 * the SAME way as routes.ts `stripeRequest` (env PLATFORM_STRIPE_SECRET_KEY or the
 * platform-secrets store). Lets the boot-time automation sweep run the reconcile
 * without importing routes.ts (no circular dependency, no hardcoded key). Returns
 * null when no key is configured — the caller then no-ops the reconcile.
 */
export async function createPlatformStripeMeterPoster(): Promise<MeterPoster | null> {
  const secretKey = await getSecret("PLATFORM_STRIPE_SECRET_KEY", "platform_stripe_secret_key");
  assertStripeKeySafe(secretKey); // founder-os#10193 F0 — refuse live Stripe key in staging
  if (!secretKey?.trim()) return null;
  return async (path, body) => {
    const resp = await fetch(`https://api.stripe.com/v1${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
    const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
    if (!resp.ok) {
      const errMsg = (data.error as any)?.message ?? `Stripe error ${resp.status}`;
      throw new Error(errMsg);
    }
    return data;
  };
}

/**
 * Run the per-period usage reconcile using the platform Stripe credential. No-op
 * (returns null) when Stripe is not configured. Convenience wrapper for the
 * automation sweep so it doesn't have to build the poster itself.
 */
export async function runUsageReconcileSweep(): Promise<ReconcileSummary | null> {
  const post = await createPlatformStripeMeterPoster();
  if (!post) return null;
  return reconcileAllSubscriptionUsage(post);
}

// ── Live count helpers ───────────────────────────────────────────────────────

/** Live unit count for one association (COUNT(units) — the canonical count, same as routes.ts:3869). */
export async function getAssociationUnitCount(associationId: string): Promise<number> {
  const [{ c = 0 } = { c: 0 }] = await db
    .select({ c: count() })
    .from(units)
    .where(eq(units.associationId, associationId));
  return Number(c) || 0;
}

/**
 * Live total-door count for a property-manager portfolio: sum of unit counts across
 * every association the subscription's admin (adminEmail → adminUsers.id → scopes)
 * manages. Falls back to the subscription's own association if no scopes resolve.
 */
export async function getPmPortfolioDoorCount(sub: PlatformSubscription): Promise<{ totalDoors: number; associationIds: string[] }> {
  // Resolve the managing admin from the subscription's adminEmail.
  const admin = await db
    .select({ id: adminUsers.id })
    .from(adminUsers)
    .where(eq(adminUsers.email, sub.adminEmail.toLowerCase().trim()))
    .then((r) => r[0]);

  let associationIds: string[] = [];
  if (admin) {
    const scopes = await db
      .select({ associationId: adminAssociationScopes.associationId })
      .from(adminAssociationScopes)
      .where(eq(adminAssociationScopes.adminUserId, admin.id));
    associationIds = scopes.map((s) => s.associationId).filter((x): x is string => !!x);
  }
  // Always include the subscription's own association; dedupe.
  if (sub.associationId && !associationIds.includes(sub.associationId)) {
    associationIds.push(sub.associationId);
  }
  if (associationIds.length === 0) return { totalDoors: 0, associationIds: [] };

  const rows = await db
    .select({ associationId: units.associationId, c: count() })
    .from(units)
    .where(inArray(units.associationId, associationIds))
    .groupBy(units.associationId);

  const totalDoors = rows.reduce((sum, r) => sum + (Number(r.c) || 0), 0);
  return { totalDoors, associationIds };
}

// ── Tier resolution (live, mirrors signup) ───────────────────────────────────

async function fetchActivePlans(accountType: "self_managed" | "property_manager"): Promise<PlanCatalog[]> {
  return db
    .select()
    .from(planCatalog)
    .where(and(eq(planCatalog.accountType, accountType), eq(planCatalog.status, "active")));
}

/**
 * Resolve, for a subscription, whether it is metered and (if so) the meter
 * event_name + current count to report. Returns null when the subscription is on a
 * flat tier (Small $129) or otherwise not metered — those bill via a licensed price
 * and need no usage report.
 */
export async function resolveMeteredUsage(
  sub: PlatformSubscription,
): Promise<{ eventName: string; value: number } | null> {
  if (sub.plan === "self-managed") {
    const unitCount = await getAssociationUnitCount(sub.associationId);
    if (unitCount < 1) return null;
    const plans = await fetchActivePlans("self_managed");
    let tier: PlanCatalog;
    try {
      tier = resolveSelfManagedPlanFromList(unitCount, plans);
    } catch {
      return null; // 251+ → Enterprise manual; no auto usage.
    }
    // Only per_door (= per-UNIT for SM Mid/Large) tiers are metered. Small is flat.
    if (tier.pricingModel !== "per_door") return null;
    return { eventName: resolveMeterEventName("self_managed", tier.planKey), value: unitCount };
  }

  if (sub.plan === "property-manager") {
    const { totalDoors } = await getPmPortfolioDoorCount(sub);
    if (totalDoors < 1) return null;
    const plans = await fetchActivePlans("property_manager");
    const complexes = [{ associationId: sub.associationId, unitCount: totalDoors }];
    let result;
    try {
      result = computePmPortfolioMonthlyBillFromList(complexes, plans);
    } catch {
      return null;
    }
    if (result.manualReviewRequired) return null; // Enterprise → manual.
    return {
      eventName: resolveMeterEventName("property_manager", result.resolvedTierPlanKey),
      value: result.totalDoors,
    };
  }

  return null; // enterprise plan → manual billing.
}

// ── Reporting one subscription ───────────────────────────────────────────────

/** Epoch seconds for a Date | null (the subscription's current_period_end). */
function periodEndEpoch(sub: PlatformSubscription): number | null {
  return sub.currentPeriodEnd ? Math.trunc(sub.currentPeriodEnd.getTime() / 1000) : null;
}

export type ReportOptions = {
  /** Force a report even if the current period was already reported (count changed). */
  force?: boolean;
  /** Skip the local ledger write (used by the initial-report path which writes via provisionWorkspace flow). */
  skipLedgerWrite?: boolean;
};

/**
 * Report one subscription's current usage. Idempotent by default: skips when the
 * live current_period_end already matches the ledger's last_usage_reported_period_end
 * (already reported this period). Writes the ledger on success.
 */
export async function reportSubscriptionUsage(
  sub: PlatformSubscription,
  post: MeterPoster,
  opts: ReportOptions = {},
): Promise<ReportSubscriptionUsageResult> {
  if (!sub.stripeCustomerId) return { status: "skipped-no-customer" };

  const metered = await resolveMeteredUsage(sub);
  if (!metered) return { status: "skipped-not-metered" };

  const periodEpoch = periodEndEpoch(sub);

  // Idempotency: same billing period already reported → skip (unless forced by a
  // detected count change).
  if (!opts.force && sub.lastUsageReportedPeriodEnd && sub.currentPeriodEnd) {
    const ledgerEpoch = Math.trunc(sub.lastUsageReportedPeriodEnd.getTime() / 1000);
    if (ledgerEpoch === periodEpoch) {
      return { status: "skipped-already-reported", periodEnd: periodEpoch };
    }
  }

  const identifier = buildMeterEventIdentifier(
    sub.stripeSubscriptionId ?? sub.id,
    periodEpoch,
    opts.force ? metered.value : undefined,
  );

  try {
    await reportMeterEvent({
      post,
      eventName: metered.eventName,
      stripeCustomerId: sub.stripeCustomerId,
      value: metered.value,
      identifier,
    });
  } catch (e: any) {
    return { status: "error", message: e?.message ?? "meter-event-post-failed" };
  }

  if (!opts.skipLedgerWrite) {
    await db
      .update(platformSubscriptions)
      .set({
        lastUsageReportedValue: metered.value,
        lastUsageReportedPeriodEnd: sub.currentPeriodEnd ?? null,
        lastUsageReportedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(platformSubscriptions.id, sub.id));
  }

  return { status: "reported", eventName: metered.eventName, value: metered.value, identifier };
}

// ── The periodic reconcile (iterate all active metered subscriptions) ────────

export type ReconcileSummary = {
  scanned: number;
  reported: number;
  skipped: number;
  errors: number;
  details: Array<{ subscriptionId: string; associationId: string; result: ReportSubscriptionUsageResult }>;
};

/** Subscription statuses that should carry usage. Trialing subs still accrue meter usage. */
const BILLABLE_STATUSES = new Set(["active", "trialing", "past_due"]);

/**
 * Report current usage for every active metered subscription, once per period.
 * Safe to run on a schedule (idempotent). `post` is the injected Stripe POST.
 */
export async function reconcileAllSubscriptionUsage(post: MeterPoster): Promise<ReconcileSummary> {
  const subs = await db.select().from(platformSubscriptions);
  const summary: ReconcileSummary = { scanned: 0, reported: 0, skipped: 0, errors: 0, details: [] };

  for (const sub of subs) {
    if (!BILLABLE_STATUSES.has(sub.status)) continue;
    summary.scanned++;
    let result: ReportSubscriptionUsageResult;
    try {
      result = await reportSubscriptionUsage(sub, post);
    } catch (e: any) {
      result = { status: "error", message: e?.message ?? "reconcile-failed" };
    }
    if (result.status === "reported") summary.reported++;
    else if (result.status === "error") summary.errors++;
    else summary.skipped++;
    summary.details.push({ subscriptionId: sub.id, associationId: sub.associationId, result });
  }
  return summary;
}

/**
 * Initial-report convenience for the signup path: report current usage for the
 * subscription that was just created for `associationId`. Best-effort — the caller
 * (provisionWorkspace) wraps this so a failure never fails signup; the periodic
 * reconcile is the backstop. Looks the subscription up fresh so it carries the
 * stripe ids written moments earlier.
 */
export async function reportInitialUsageForAssociation(
  associationId: string,
  post: MeterPoster,
): Promise<ReportSubscriptionUsageResult> {
  const sub = await db
    .select()
    .from(platformSubscriptions)
    .where(eq(platformSubscriptions.associationId, associationId))
    .then((r) => r[0]);
  if (!sub) return { status: "error", message: "subscription-not-found" };
  // force:true so the initial report fires even though current_period_end may be
  // null at provision time (no ledger to compare against yet).
  return reportSubscriptionUsage(sub, post, { force: true });
}
