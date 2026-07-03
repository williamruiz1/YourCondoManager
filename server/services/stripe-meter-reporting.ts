/**
 * stripe-meter-reporting.ts — report per-unit / per-door usage to Stripe Billing Meters.
 *
 * THE GAP THIS CLOSES
 * -------------------
 * Metered subscriptions (per-unit self-managed Mid/Large, per-door property-manager)
 * are created on the correct Stripe Billing-Meter price, but the unit/door COUNT was
 * never reported to Stripe — so the meter (a SUM aggregator) had no usage to bill.
 * This service reports that count via the modern Billing Meter Events API:
 *
 *     POST /v1/billing/meter_events
 *       event_name = ycm_sm_units_<planKey> | ycm_pm_doors_<planKey>
 *       payload[stripe_customer_id] = <customerId>
 *       payload[value]              = <current unit/door count>
 *       identifier                  = <deterministic per (subscription, period)>
 *
 * SUM-vs-SET SEMANTICS — WHY WE REPORT ONCE PER PERIOD
 * ---------------------------------------------------
 * The meters were created with `default_aggregation.formula = sum` (see
 * scripts/migrate-*-stripe-products-to-per-*.ts). A SUM meter ADDS every reported
 * `value` within the billing period. Stripe Billing Meters have NO native "set the
 * current value" mode — only additive events. To bill the CURRENT count (not a
 * running total), we therefore report the snapshot exactly ONCE per billing period
 * per subscription. Re-reporting the same count inside a period would DOUBLE-BILL.
 *
 * Double-billing is prevented by two independent guards:
 *   1. A deterministic Stripe `identifier` keyed to (stripeSubscriptionId, periodEnd).
 *      Stripe dedups events sharing an identifier for 24h+, so an accidental retry
 *      within the period is a no-op on Stripe's side.
 *   2. A local ledger (platform_subscriptions.last_usage_reported_period_end,
 *      migration 0048): the reconcile skips any subscription whose stored period-end
 *      already matches the live current_period_end. When the count CHANGES mid-period
 *      the caller may force a re-report (see reportSubscriptionUsage `force`), which
 *      uses a count-stamped identifier so the new snapshot is a distinct event — the
 *      reconcile/invoice path is responsible for not stacking these (the default
 *      once-per-period reconcile never forces).
 *
 * The low-level POST is injected (`MeterPoster`) so callers wire it to the platform
 * Stripe client (server/routes.ts `stripeRequest`) and tests can run with a stub —
 * no live key, no network, no risk to live money.
 */

/** A self-managed community is billed on its own unit count; a PM portfolio on total doors. */
export type MeteredPlanKind = "self_managed" | "property_manager";

/**
 * Minimal low-level POST to Stripe. Returns the created meter-event object (or at
 * least its `identifier`). Injected by the caller so this module never touches
 * secrets or the network directly. Mirrors the shape of routes.ts `stripeRequest`.
 */
export type MeterPoster = (
  path: string,
  body: URLSearchParams,
) => Promise<Record<string, unknown>>;

/** Meter event_name prefixes — MUST match the migration scripts' findOrCreateMeter(). */
const SM_EVENT_PREFIX = "ycm_sm_units_"; // scripts/migrate-sm-stripe-products-to-per-unit.ts
const PM_EVENT_PREFIX = "ycm_pm_doors_"; // scripts/migrate-pm-stripe-products-to-per-door.ts

/**
 * Resolve the Stripe meter `event_name` for a metered subscription's tier.
 *
 * The meter was created per plan tier with event_name `ycm_sm_units_<planKey>`
 * (self-managed) or `ycm_pm_doors_<planKey>` (property-manager), e.g.
 * `ycm_sm_units_mid_community`, `ycm_pm_doors_pm_starter`. The `planKey` is the
 * plan_catalog.plan_key the subscription resolved to.
 *
 * Pure + side-effect-free so it is unit-testable.
 */
export function resolveMeterEventName(kind: MeteredPlanKind, planKey: string): string {
  const key = (planKey ?? "").trim();
  if (!key) throw new Error("resolveMeterEventName: planKey is required");
  return (kind === "property_manager" ? PM_EVENT_PREFIX : SM_EVENT_PREFIX) + key;
}

/**
 * Build the deterministic Stripe meter-event identifier for a (subscription, period)
 * snapshot. Same subscription + same period-end → same identifier → Stripe dedups
 * → the SUM meter cannot double-count from a retry.
 *
 * When `valueStamp` is supplied (a forced mid-period re-report because the count
 * changed), it is folded into the identifier so the new snapshot is a DISTINCT event
 * rather than a deduped no-op. The default once-per-period reconcile omits it.
 */
export function buildMeterEventIdentifier(
  stripeSubscriptionId: string,
  periodEndEpochSec: number | null,
  valueStamp?: number,
): string {
  const periodPart = periodEndEpochSec != null ? String(periodEndEpochSec) : "noperiod";
  const base = `ycm_usage_${stripeSubscriptionId}_${periodPart}`;
  const stamped = valueStamp != null ? `${base}_v${valueStamp}` : base;
  // Stripe caps identifier at 100 chars; sub ids + epoch fit comfortably, but clamp defensively.
  return stamped.slice(0, 100);
}

export type ReportMeterEventArgs = {
  post: MeterPoster;
  eventName: string;
  stripeCustomerId: string;
  /** The unit/door count to report (the snapshot value for a SUM meter). */
  value: number;
  identifier: string;
  /** Optional explicit event timestamp (Unix seconds); defaults to Stripe's now. */
  timestampEpochSec?: number;
};

/**
 * Low-level: POST one meter event. Throws on a non-OK Stripe response (the injected
 * `post` is expected to throw on !ok, mirroring routes.ts stripeRequest). Callers on
 * the signup path wrap this best-effort; the reconcile lets failures bubble to retry.
 */
export async function reportMeterEvent(
  args: ReportMeterEventArgs,
): Promise<Record<string, unknown>> {
  if (!args.stripeCustomerId) throw new Error("reportMeterEvent: stripeCustomerId is required");
  if (!Number.isFinite(args.value) || args.value < 0) {
    throw new Error(`reportMeterEvent: invalid value ${args.value}`);
  }
  const body = new URLSearchParams({
    event_name: args.eventName,
    "payload[stripe_customer_id]": args.stripeCustomerId,
    "payload[value]": String(Math.trunc(args.value)),
    identifier: args.identifier,
  });
  if (args.timestampEpochSec != null) {
    body.set("timestamp", String(Math.trunc(args.timestampEpochSec)));
  }
  return args.post("/billing/meter_events", body);
}

/** Result of a single subscription's usage-report attempt (for logging / reconcile rollup). */
export type ReportSubscriptionUsageResult =
  | { status: "reported"; eventName: string; value: number; identifier: string }
  | { status: "skipped-not-metered" }
  | { status: "skipped-already-reported"; periodEnd: number | null }
  | { status: "skipped-no-customer" }
  | { status: "error"; message: string };
