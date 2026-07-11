/**
 * A-WEBHOOK-003 — Stripe webhook replay-window regression lock.
 *
 * THE VULN (before this fix): both Stripe signature verifiers
 * (`verifyStripeWebhookSignature` in server/routes/stripe-connect.ts and the
 * inline verifier in server/routes.ts) computed the HMAC over
 * `${t}.${rawBody}` and constant-time-compared it, but NEVER validated that the
 * `t=` timestamp was recent — so a captured, validly-signed webhook body could
 * be replayed indefinitely. Stripe's own `constructEvent` enforces a default
 * 5-minute tolerance for exactly this reason; the Plaid verifier already does.
 *
 * THE FIX: `isStripeTimestampFresh(t)` rejects a timestamp outside the
 * tolerance window even when the HMAC matches.
 */
import { describe, expect, it } from "vitest";
import {
  isStripeTimestampFresh,
  STRIPE_WEBHOOK_TOLERANCE_S,
} from "../stripe-connect";

describe("A-WEBHOOK-003 — Stripe webhook timestamp freshness", () => {
  const now = 1_800_000_000; // fixed "now" (unix seconds) for determinism

  it("accepts a fresh timestamp (t === now)", () => {
    expect(isStripeTimestampFresh(String(now), now)).toBe(true);
  });

  it("accepts a timestamp with clock skew within tolerance", () => {
    // just inside the window on both sides
    expect(isStripeTimestampFresh(String(now - (STRIPE_WEBHOOK_TOLERANCE_S - 1)), now)).toBe(true);
    expect(isStripeTimestampFresh(String(now + (STRIPE_WEBHOOK_TOLERANCE_S - 1)), now)).toBe(true);
    // exactly at the boundary is still accepted (<=)
    expect(isStripeTimestampFresh(String(now - STRIPE_WEBHOOK_TOLERANCE_S), now)).toBe(true);
  });

  it("rejects a stale timestamp older than the tolerance (replay)", () => {
    expect(isStripeTimestampFresh(String(now - (STRIPE_WEBHOOK_TOLERANCE_S + 1)), now)).toBe(false);
    // a captured event replayed an hour later
    expect(isStripeTimestampFresh(String(now - 3600), now)).toBe(false);
  });

  it("rejects a far-future timestamp (beyond tolerance)", () => {
    expect(isStripeTimestampFresh(String(now + (STRIPE_WEBHOOK_TOLERANCE_S + 1)), now)).toBe(false);
  });

  it("rejects a non-numeric / missing timestamp", () => {
    expect(isStripeTimestampFresh("not-a-number", now)).toBe(false);
    expect(isStripeTimestampFresh("", now)).toBe(false);
  });

  it("defaults tolerance to 5 minutes", () => {
    expect(STRIPE_WEBHOOK_TOLERANCE_S).toBe(300);
  });
});
