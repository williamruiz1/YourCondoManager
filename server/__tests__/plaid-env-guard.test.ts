/**
 * Plaid production env-flip guard tests (BLINDSPOT F7).
 *
 * The guard makes the safe rollout order MECHANICAL: production cannot boot
 * unless webhook verification is wired + prod credentials are present. These
 * tests verify the guard fails-closed in production and never blocks sandbox.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  evaluatePlaidEnv,
  assertPlaidEnvSafe,
  isPlaidProduction,
  shouldEnforceWebhookVerification,
} from "../services/bank-feed/plaid-env-guard";

// Snapshot + restore the env keys this guard reads.
const KEYS = [
  "PLAID_ENV",
  "PLAID_CLIENT_ID",
  "PLAID_SECRET_PRODUCTION",
  "PLAID_WEBHOOK_URL",
  "PLAID_WEBHOOK_VERIFICATION",
] as const;

let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = {};
  for (const k of KEYS) saved[k] = process.env[k];
  for (const k of KEYS) delete process.env[k];
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("Plaid env guard (F7)", () => {
  it("sandbox (default) is always safe and never blocks boot", () => {
    // PLAID_ENV unset → sandbox.
    const result = evaluatePlaidEnv();
    expect(result.ok).toBe(true);
    expect(result.env).toBe("sandbox");
    expect(() => assertPlaidEnvSafe()).not.toThrow();
    expect(isPlaidProduction()).toBe(false);
  });

  it("development is safe and never blocks boot", () => {
    process.env.PLAID_ENV = "development";
    expect(evaluatePlaidEnv().ok).toBe(true);
    expect(() => assertPlaidEnvSafe()).not.toThrow();
  });

  it("production WITHOUT prod credentials fails closed (refuses boot)", () => {
    process.env.PLAID_ENV = "production";
    // No client id / secret / webhook url.
    const result = evaluatePlaidEnv();
    expect(result.ok).toBe(false);
    expect(result.problems.length).toBeGreaterThan(0);
    expect(() => assertPlaidEnvSafe()).toThrow(/refusing to boot/i);
  });

  it("production with verification explicitly DISABLED fails closed", () => {
    process.env.PLAID_ENV = "production";
    process.env.PLAID_CLIENT_ID = "client-id";
    process.env.PLAID_SECRET_PRODUCTION = "secret";
    process.env.PLAID_WEBHOOK_URL = "https://example.com/api/webhooks/plaid";
    process.env.PLAID_WEBHOOK_VERIFICATION = "false";

    const result = evaluatePlaidEnv();
    expect(result.ok).toBe(false);
    expect(result.problems.join(" ")).toMatch(/verification is DISABLED/i);
    expect(() => assertPlaidEnvSafe()).toThrow();
  });

  it("production with ALL rails wired passes (verification on by default)", () => {
    process.env.PLAID_ENV = "production";
    process.env.PLAID_CLIENT_ID = "client-id";
    process.env.PLAID_SECRET_PRODUCTION = "secret";
    process.env.PLAID_WEBHOOK_URL = "https://example.com/api/webhooks/plaid";
    // PLAID_WEBHOOK_VERIFICATION unset → verification ON (fail-safe).

    const result = evaluatePlaidEnv();
    expect(result.ok).toBe(true);
    expect(result.problems).toEqual([]);
    expect(() => assertPlaidEnvSafe()).not.toThrow();
    expect(isPlaidProduction()).toBe(true);
  });

  it("enforces webhook verification in production, regardless of flag", () => {
    process.env.PLAID_ENV = "production";
    expect(shouldEnforceWebhookVerification()).toBe(true);
  });

  it("does NOT enforce in sandbox unless explicitly forced on", () => {
    // sandbox, no flag → not enforced (Plaid doesn't sign sandbox webhooks)
    expect(shouldEnforceWebhookVerification()).toBe(false);
    // sandbox, forced on → enforced (lets us test the verifier path)
    process.env.PLAID_WEBHOOK_VERIFICATION = "true";
    expect(shouldEnforceWebhookVerification()).toBe(true);
  });
});
