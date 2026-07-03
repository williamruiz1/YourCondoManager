/**
 * Plaid production env guard (BLINDSPOT F7 — env-flip-before-verification).
 *
 * The dangerous sequencing risk: flipping `PLAID_ENV=production` is a one-line
 * Fly secret (effort-S), while wiring webhook JWT verification is real work
 * (effort-M). If the env is flipped first "just to test prod link," the
 * production webhook endpoint would accept UNAUTHENTICATED bodies that drive
 * bank-transaction sync into the reconciliation engine.
 *
 * The fix per F7 is to make the safe order MECHANICAL, not procedural: the app
 * refuses to run in production-Plaid mode unless webhook verification is wired
 * and the production credentials are present. A guard beats a checklist.
 *
 * This module does NOT flip the environment — that stays an owner-controlled,
 * deploy-time secret. It only asserts the rails are safe BEFORE production
 * traffic can flow.
 */

// Set this OFF only with an explicit, documented decision. Default = ON. The
// existence of the verifier is the real gate; this flag is the override seam.
function webhookVerificationEnabled(): boolean {
  // Verification is on unless explicitly disabled. We treat the explicit string
  // "false" / "0" / "off" as the only disables — anything else (including unset)
  // keeps verification ON (fail-safe: you cannot accidentally disable it).
  const raw = (process.env.PLAID_WEBHOOK_VERIFICATION ?? "").trim().toLowerCase();
  if (raw === "false" || raw === "0" || raw === "off" || raw === "disabled") {
    return false;
  }
  return true;
}

export function plaidEnv(): string {
  return (process.env.PLAID_ENV ?? "sandbox").toLowerCase();
}

export function isPlaidProduction(): boolean {
  return plaidEnv() === "production";
}

/**
 * Is the OWNER-PORTAL Plaid "pay from bank" path enabled? DEFAULT OFF.
 *
 * WHY DEFAULT OFF (settlement-risk gate): `POST /api/portal/plaid/pay` records a
 * `payment` (negative) owner-ledger entry IMMEDIATELY — lowering the owner's
 * on-ledger balance — but there is NO ACH execution and NO settlement
 * reconciliation behind it (the route's own comment defers execution to a
 * "follow-up job" that does not exist). That means an owner could reduce their
 * recorded balance without money ever moving. Until the path posts the ledger
 * entry only on CONFIRMED settlement (mirroring the Stripe webhook-"succeeded"
 * pattern), it stays disabled and Cherry Hill uses the SAFE Stripe ACH path.
 *
 * Enable explicitly with PORTAL_PLAID_PAY_ENABLED=1 (or true/yes/on) ONLY after
 * settlement reconciliation exists. Anything else (incl. unset) → OFF.
 */
export function isPortalPlaidPayEnabled(): boolean {
  const raw = (process.env.PORTAL_PLAID_PAY_ENABLED ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export interface PlaidEnvCheckResult {
  ok: boolean;
  env: string;
  problems: string[];
}

/**
 * Evaluate whether the current Plaid configuration is safe to run.
 *
 * In sandbox/development: always ok (verification may be skipped by Plaid in
 * sandbox; this never blocks local/dev work).
 *
 * In production: ALL of the following must hold, or the result is not-ok:
 *   - webhook JWT verification is enabled (not explicitly disabled)
 *   - PLAID_CLIENT_ID is present
 *   - PLAID_SECRET_PRODUCTION is present
 *   - PLAID_WEBHOOK_URL is present (Plaid needs a URL to sign + POST to)
 */
export function evaluatePlaidEnv(): PlaidEnvCheckResult {
  const env = plaidEnv();
  if (env !== "production") {
    return { ok: true, env, problems: [] };
  }

  const problems: string[] = [];

  if (!webhookVerificationEnabled()) {
    problems.push(
      "webhook JWT verification is DISABLED (PLAID_WEBHOOK_VERIFICATION=false) — " +
        "production must verify webhooks; an unverified handler accepts forged bank transactions",
    );
  }
  if (!process.env.PLAID_CLIENT_ID?.trim()) {
    problems.push("PLAID_CLIENT_ID is not set");
  }
  if (!process.env.PLAID_SECRET_PRODUCTION?.trim()) {
    problems.push("PLAID_SECRET_PRODUCTION is not set");
  }
  if (!process.env.PLAID_WEBHOOK_URL?.trim()) {
    problems.push(
      "PLAID_WEBHOOK_URL is not set — Plaid cannot deliver signed webhooks without it",
    );
  }

  return { ok: problems.length === 0, env, problems };
}

/**
 * Boot-time assertion. Call once at startup. If the Plaid config is unsafe for
 * production, THROW — aborting boot. The whole point of F7: you cannot flip the
 * env to production without the verifier + keys wired, even by accident.
 *
 * Returns the evaluation (for logging) when safe.
 */
export function assertPlaidEnvSafe(): PlaidEnvCheckResult {
  const result = evaluatePlaidEnv();
  if (!result.ok) {
    throw new Error(
      `Plaid production guard FAILED — refusing to boot with PLAID_ENV=production:\n` +
        result.problems.map((p) => `  - ${p}`).join("\n") +
        `\n\nFix the rails before going live, OR set PLAID_ENV back to sandbox. ` +
        `Never flip the env ahead of webhook verification (BLINDSPOT F7).`,
    );
  }
  return result;
}

/**
 * Whether the runtime should ENFORCE webhook verification right now. True in
 * production (always), or whenever verification is explicitly enabled. False
 * only in sandbox/development where Plaid does not sign webhooks AND
 * verification hasn't been explicitly forced on.
 *
 * The webhook handler uses this to decide reject-on-failure vs. parse-only.
 */
export function shouldEnforceWebhookVerification(): boolean {
  if (isPlaidProduction()) return true;
  // Allow forcing verification on in sandbox for testing the verifier path.
  const raw = (process.env.PLAID_WEBHOOK_VERIFICATION ?? "").trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "on" || raw === "enabled";
}
