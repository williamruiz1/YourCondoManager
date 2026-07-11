/**
 * Stripe Idempotency-Key helpers — A-STRIPE-004 (platform billing) +
 * A-STRIPE-005 (refund disambiguator).
 *
 * These are pure functions, so they are exercised directly.
 */
import { describe, it, expect } from "vitest";
import {
  refundKey,
  platformCustomerKey,
  platformSubscriptionKey,
  platformCheckoutKey,
} from "../server/services/stripe-idempotency";

describe("A-STRIPE-005 — refundKey disambiguator", () => {
  it("collapses a true network retry of the SAME refund request", () => {
    const a = refundKey({ chargeId: "ch_1", amountCents: 2500, refundRequestId: "req-abc" });
    const b = refundKey({ chargeId: "ch_1", amountCents: 2500, refundRequestId: "req-abc" });
    expect(a).toBe(b);
  });

  it("gives two DISTINCT equal-amount partial refunds of one charge distinct keys", () => {
    // The bug: without a disambiguator these two collapse in Stripe's 24h window
    // and the second refund is silently dropped.
    const first = refundKey({ chargeId: "ch_1", amountCents: 2500, refundRequestId: "req-1" });
    const second = refundKey({ chargeId: "ch_1", amountCents: 2500, refundRequestId: "req-2" });
    expect(first).not.toBe(second);
  });

  it("still distinguishes different amounts on the same charge", () => {
    const partial = refundKey({ chargeId: "ch_1", amountCents: 2500 });
    const full = refundKey({ chargeId: "ch_1", amountCents: null });
    expect(partial).not.toBe(full);
  });

  it("is backward-compatible: omitting refundRequestId keeps the prior (charge,amount) key", () => {
    // Load-bearing: a refund in flight when this deploys (keyed the old way)
    // must still collapse against a retry, so the absent-disambiguator key must
    // equal the pre-change key exactly.
    const withOut = refundKey({ chargeId: "ch_1", amountCents: 2500 });
    expect(withOut).toBe("ycm:refund:ch_1:2500");
    const fullWithout = refundKey({ chargeId: "ch_1", amountCents: null });
    expect(fullWithout).toBe("ycm:refund:ch_1:full");
  });
});

describe("A-STRIPE-004 — platform billing keys", () => {
  it("customer key is stable per association (a retry reuses the customer)", () => {
    expect(platformCustomerKey("assoc-1")).toBe(platformCustomerKey("assoc-1"));
    expect(platformCustomerKey("assoc-1")).not.toBe(platformCustomerKey("assoc-2"));
  });

  it("subscription key is stable per association+plan (retry replays one subscription)", () => {
    const k1 = platformSubscriptionKey({ associationId: "assoc-1", plan: "self-managed" });
    const k1b = platformSubscriptionKey({ associationId: "assoc-1", plan: "self-managed" });
    expect(k1).toBe(k1b);
  });

  it("a DIFFERENT plan is a distinct subscription key", () => {
    const a = platformSubscriptionKey({ associationId: "assoc-1", plan: "self-managed" });
    const b = platformSubscriptionKey({ associationId: "assoc-1", plan: "full-service" });
    expect(a).not.toBe(b);
  });

  it("checkout key is stable per association+plan and distinct from the subscription key", () => {
    const co = platformCheckoutKey({ associationId: "assoc-1", plan: "self-managed" });
    expect(co).toBe(platformCheckoutKey({ associationId: "assoc-1", plan: "self-managed" }));
    expect(co).not.toBe(platformSubscriptionKey({ associationId: "assoc-1", plan: "self-managed" }));
  });

  it("all keys are within Stripe's 255-char limit and url-safe", () => {
    const keys = [
      refundKey({ chargeId: "ch_x".repeat(200), amountCents: 5, refundRequestId: "r".repeat(200) }),
      platformCustomerKey("a".repeat(300)),
      platformSubscriptionKey({ associationId: "a".repeat(300), plan: "p".repeat(300) }),
    ];
    for (const k of keys) {
      expect(k.length).toBeLessThanOrEqual(255);
      expect(k).toMatch(/^[a-zA-Z0-9._:-]+$/);
    }
  });
});
