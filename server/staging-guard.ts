/**
 * Staging side-effect kill-switch (founder-os#10193 — YCM redesign F0).
 *
 * The `yourcondomanager-staging` review environment runs on a CLONE of the real
 * Cherry Hill Court production data (real owners, units, ledger, balances) so
 * William can review the redesign against realistic records. Because the data is
 * real, browsing/clicking staging must NEVER reach a real owner or move real
 * money. This module is the load-bearing, credential-independent guarantee:
 *
 *   - It short-circuits every real-world outbound effect (email / SMS / push)
 *     to a simulated "staging-sink" no-op.
 *   - It refuses to let a LIVE Stripe key (`sk_live_...`) ever be used, so even
 *     if the cloned `platform_secrets` table carries the production live key it
 *     cannot charge or pay out.
 *
 * WHY code-level (not just "don't set the creds"): SMS/push/Stripe resolve
 * credentials from the cloned `platform_secrets` DB table as a fallback
 * (getSecret is env-first, DB-second). A DB clone therefore CARRIES prod creds.
 * Absence-of-env alone is NOT safe — this switch fires BEFORE the send/charge.
 *
 * Activation: set on the staging Fly app only. Prod never sets these, so prod
 * behaviour is unchanged (fail-safe default = OFF, side effects allowed).
 *   OUTBOUND_SIDE_EFFECTS_DISABLED=1   (canonical)
 *   APP_ENV=staging                    (also trips it)
 *   YCM_STAGING=1                      (also trips it)
 */

let warned = false;

/**
 * True when this process is a side-effect-suppressed review environment.
 * Any one of the three signals trips it (defence in depth against a single
 * mis-set env var).
 */
// Any Fly app whose name marks it a review/clone environment. FLY_APP_NAME is
// set AUTOMATICALLY by Fly to the app name, independent of which fly.*.toml
// deployed it — so this is a FAIL-SAFE against the founder-os#10193 recurrence
// where `yourcondomanager-staging` was deployed with the PROD `fly.toml` (no
// kill-switch env), silently re-arming real email/SMS/Stripe on cloned real
// data. Keying off the app NAME means a review app can never be un-armed by a
// wrong deploy config. Prod is exactly "yourcondomanager" → never matches.
function isReviewFlyApp(): boolean {
  const app = process.env.FLY_APP_NAME || "";
  return /(^|-)(staging|preview|review|clone)(-|$)/i.test(app);
}

export function outboundSideEffectsDisabled(): boolean {
  const disabled =
    process.env.OUTBOUND_SIDE_EFFECTS_DISABLED === "1" ||
    process.env.APP_ENV === "staging" ||
    process.env.YCM_STAGING === "1" ||
    isReviewFlyApp();
  if (disabled && !warned) {
    warned = true;
    // eslint-disable-next-line no-console
    console.warn(
      "[staging-guard] OUTBOUND SIDE EFFECTS DISABLED — email/SMS/push routed to sink; live Stripe keys refused. This is a review environment on cloned real data.",
    );
  }
  return disabled;
}

/** The environment label emitted on Stripe metadata + surfaced in banners. */
export function appEnvironment(): "production" | "staging" | "development" {
  if (outboundSideEffectsDisabled()) return "staging";
  if (process.env.NODE_ENV === "production") return "production";
  return "development";
}

/**
 * Guard a resolved Stripe secret key. In a side-effect-suppressed environment a
 * LIVE key (`sk_live_...`) is refused outright — throwing here is safer than a
 * silent no-op because it makes any accidental live-key wiring loud and fatal
 * at the point of use, instead of quietly moving real money. Test keys
 * (`sk_test_...`) pass through, so Stripe TEST mode works normally on staging.
 */
export function assertStripeKeySafe(secretKey: string | null | undefined): void {
  if (!outboundSideEffectsDisabled()) return;
  if (secretKey && secretKey.startsWith("sk_live_")) {
    throw new Error(
      "[staging-guard] Refusing to use a LIVE Stripe key (sk_live_...) in the staging review environment. " +
        "Set PLATFORM_STRIPE_SECRET_KEY to a test key (sk_test_...) or leave it unset.",
    );
  }
}

/**
 * Log a suppressed outbound effect to the process log as the staging sink.
 * Keeps a visible audit trail without reaching the real world.
 */
export function logSuppressedOutbound(
  channel: "email" | "sms" | "push",
  detail: Record<string, unknown>,
): void {
  // eslint-disable-next-line no-console
  console.warn(`[staging-guard][${channel}-sink] suppressed outbound (cloned-real-data review env)`, detail);
}
