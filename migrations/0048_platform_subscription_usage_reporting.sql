-- Migration 0048 — Stripe metered-usage reporting tracking on platform_subscriptions
--
-- Closes the TODO(usage-reporting) gap: metered (per-unit / per-door) subscriptions
-- are created on the correct Stripe Billing-Meter price, but the unit/door COUNT
-- was never reported to Stripe, so the meter (a SUM aggregator) had nothing to bill.
--
-- The reporting model is a per-billing-period SNAPSHOT against a SUM meter: each
-- active metered subscription reports its CURRENT count exactly ONCE per period,
-- with a deterministic Stripe meter-event `identifier` keyed to
-- (subscriptionId, periodEnd) so accidental retries dedup (Stripe enforces
-- identifier uniqueness for 24h+) and the SUM meter never double-counts. These
-- three columns are the local idempotency ledger that lets the periodic reconcile
-- skip a subscription whose current period has already been reported, AND that
-- records what was last reported for audit.
--
--   last_usage_reported_value       — the count last reported to the meter (units
--                                     for self-managed, total portfolio doors for PM).
--   last_usage_reported_period_end  — the billing-period end the report was scoped
--                                     to. The reconcile reports once per (sub, period):
--                                     a sub whose stored value here matches the live
--                                     current_period_end is already reported → skip.
--   last_usage_reported_at          — wall-clock time of the last successful report
--                                     (observability / audit only; never a gate).
--
-- Forward-only, additive. No destructive DDL, no data backfill. Pre-existing rows
-- default to NULL (never reported) so the first reconcile pass reports them. Flat
-- tiers (Small $129) never touch these columns — they are not metered.

ALTER TABLE "platform_subscriptions"
  ADD COLUMN IF NOT EXISTS "last_usage_reported_value" integer;--> statement-breakpoint

ALTER TABLE "platform_subscriptions"
  ADD COLUMN IF NOT EXISTS "last_usage_reported_period_end" timestamp;--> statement-breakpoint

ALTER TABLE "platform_subscriptions"
  ADD COLUMN IF NOT EXISTS "last_usage_reported_at" timestamp;
