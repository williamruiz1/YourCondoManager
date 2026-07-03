/**
 * Stripe Financial Connections (FC) env guard.
 *
 * Mirror of plaid-env-guard.ts for the FC bank-feed provider. Two jobs:
 *
 *   1. The feature flag — STRIPE_FINANCIAL_CONNECTIONS_ENABLED. DEFAULT OFF.
 *      When OFF, ./index.ts selects PlaidProvider exactly as before. The flag
 *      accepts "1" / "true" / "yes" / "on" (case-insensitive); anything else
 *      (incl. unset) → OFF. This is the kill-switch + the gradual-rollout seam:
 *      Plaid stays the default until William flips it.
 *
 *   2. The webhook-verification enforcement decision — shouldEnforceFcWebhook-
 *      Verification(). Production MUST verify the Stripe webhook signature; a
 *      non-production env with no STRIPE_FC_WEBHOOK_SECRET may skip (parity with
 *      Plaid's sandbox-skip). The guard refuses to let a production runtime
 *      reach the webhook parse step unverified — a guard beats a checklist.
 *
 * "Production" here = the live Stripe key is in use. We treat NODE_ENV=production
 * as the production signal (the same machine that serves live traffic), with an
 * explicit STRIPE_FC_ENV override for the rare case of testing the prod path
 * off-prod. We deliberately do NOT read the secret key prefix at module scope
 * (the key is resolved async via getSecret); NODE_ENV is the synchronous,
 * deploy-time signal, exactly as the rest of the server uses it.
 */

/**
 * Is the Stripe Financial Connections bank feed enabled? DEFAULT OFF.
 *
 * This is the load-bearing flag: when false (the default), the bank-feed
 * singleton (./index.ts) uses PlaidProvider and NOTHING about the FC path is
 * reachable. Flip to "1" / "true" / "yes" / "on" to make FC the bank-feed
 * provider. Plaid stays default until William flips the vendor.
 */
export function isStripeFinancialConnectionsEnabled(): boolean {
  const raw = (process.env.STRIPE_FINANCIAL_CONNECTIONS_ENABLED ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

/** Resolve the FC "environment": production | test. */
export function stripeFcEnv(): string {
  const explicit = (process.env.STRIPE_FC_ENV ?? "").trim().toLowerCase();
  if (explicit === "production" || explicit === "test") return explicit;
  return (process.env.NODE_ENV ?? "").toLowerCase() === "production" ? "production" : "test";
}

export function isStripeFcProduction(): boolean {
  return stripeFcEnv() === "production";
}

/**
 * Whether the runtime should ENFORCE FC webhook signature verification right
 * now. True in production (always), or whenever verification is explicitly
 * forced on via STRIPE_FC_WEBHOOK_VERIFICATION. False only in test/non-prod
 * where a signing secret may be absent AND verification hasn't been forced on.
 *
 * The webhook handler / provider uses this to decide reject-on-failure vs.
 * parse-only.
 */
export function shouldEnforceFcWebhookVerification(): boolean {
  if (isStripeFcProduction()) return true;
  const raw = (process.env.STRIPE_FC_WEBHOOK_VERIFICATION ?? "").trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "on" || raw === "enabled";
}

export interface StripeFcEnvCheckResult {
  ok: boolean;
  env: string;
  enabled: boolean;
  problems: string[];
}

/**
 * Evaluate whether the current FC configuration is safe to run.
 *
 * If the flag is OFF: always ok (the FC path is inert; Plaid handles the feed).
 *
 * If the flag is ON and env is test: ok (Stripe FC test data is always
 * available; webhook signature may be skipped without a secret).
 *
 * If the flag is ON and env is production: ALL of the following must hold:
 *   - webhook signature verification is enforced (it always is in production)
 *   - STRIPE_FC_WEBHOOK_SECRET is present (so the verifier can run)
 *
 * The platform Stripe secret itself is validated lazily at first call (it is
 * resolved async via getSecret), so it is not asserted here.
 */
export function evaluateStripeFcEnv(): StripeFcEnvCheckResult {
  const env = stripeFcEnv();
  const enabled = isStripeFinancialConnectionsEnabled();

  if (!enabled) {
    return { ok: true, env, enabled, problems: [] };
  }
  if (env !== "production") {
    return { ok: true, env, enabled, problems: [] };
  }

  const problems: string[] = [];
  if (!process.env.STRIPE_FC_WEBHOOK_SECRET?.trim()) {
    problems.push(
      "STRIPE_FC_WEBHOOK_SECRET is not set — production must verify FC webhook " +
        "signatures; an unverified handler accepts forged bank transactions",
    );
  }
  return { ok: problems.length === 0, env, enabled, problems };
}

/**
 * Boot-time assertion (call once at startup, alongside assertPlaidEnvSafe). If
 * FC is enabled in production without the webhook secret wired, THROW — aborting
 * boot. You cannot run FC in production without the verifier wired, even by
 * accident. Returns the evaluation (for logging) when safe.
 */
export function assertStripeFcEnvSafe(): StripeFcEnvCheckResult {
  const result = evaluateStripeFcEnv();
  if (!result.ok) {
    throw new Error(
      `Stripe FC production guard FAILED — refusing to boot with ` +
        `STRIPE_FINANCIAL_CONNECTIONS_ENABLED + production:\n` +
        result.problems.map((p) => `  - ${p}`).join("\n") +
        `\n\nWire STRIPE_FC_WEBHOOK_SECRET before going live, OR disable the flag.`,
    );
  }
  return result;
}
