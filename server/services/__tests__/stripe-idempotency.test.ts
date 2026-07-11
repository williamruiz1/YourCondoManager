/**
 * Idempotency-key helper tests (payment-correctness hardening 2026-06-30).
 *
 * R2.2 — stable deterministic keys per logical op; same inputs → same key;
 * different op / amount → different key. <=255 chars, url-safe.
 */
import { describe, expect, it } from "vitest";
import {
  checkoutSessionKey,
  offSessionChargeKey,
  paymentIntentKey,
  refundKey,
  paymentLinkCheckoutKey,
} from "../stripe-idempotency";

describe("stripe idempotency keys", () => {
  it("checkout session key is stable per transaction", () => {
    expect(checkoutSessionKey("txn-1")).toBe(checkoutSessionKey("txn-1"));
    expect(checkoutSessionKey("txn-1")).not.toBe(checkoutSessionKey("txn-2"));
  });

  it("off-session charge key is stable per transaction", () => {
    expect(offSessionChargeKey("txn-1")).toBe(offSessionChargeKey("txn-1"));
    expect(offSessionChargeKey("txn-1")).not.toBe(offSessionChargeKey("txn-2"));
  });

  it("checkout and charge keys for the same txn are distinct (different ops)", () => {
    expect(checkoutSessionKey("txn-1")).not.toBe(offSessionChargeKey("txn-1"));
  });

  it("payment intent key collapses identical dues ops and distinguishes amount", () => {
    const base = { associationId: "a1", unitId: "u1", period: "2026-06", amountCents: 27000 };
    expect(paymentIntentKey(base)).toBe(paymentIntentKey({ ...base }));
    expect(paymentIntentKey(base)).not.toBe(paymentIntentKey({ ...base, amountCents: 27001 }));
    expect(paymentIntentKey(base)).not.toBe(paymentIntentKey({ ...base, period: "2026-07" }));
    expect(paymentIntentKey(base)).not.toBe(paymentIntentKey({ ...base, unitId: "u2" }));
  });

  it("refund key distinguishes full vs partial and per-amount", () => {
    const full = refundKey({ chargeId: "ch_1", amountCents: null });
    const partial50 = refundKey({ chargeId: "ch_1", amountCents: 5000 });
    const partial75 = refundKey({ chargeId: "ch_1", amountCents: 7500 });
    expect(full).toBe(refundKey({ chargeId: "ch_1", amountCents: null }));
    expect(full).not.toBe(partial50);
    expect(partial50).not.toBe(partial75);
    // different charge → different key even for same amount
    expect(refundKey({ chargeId: "ch_2", amountCents: 5000 })).not.toBe(partial50);
  });

  it("A-STRIPE-005 — requestId disambiguates two distinct equal-amount partial refunds", () => {
    // The bug: charge+amount alone collapses two legitimately-distinct $25
    // partial refunds of one charge within Stripe's 24h window (the 2nd is
    // silently replayed as the 1st). A per-request id makes them distinct.
    const base = { chargeId: "ch_1", amountCents: 2500 };
    const refundA = refundKey({ ...base, requestId: "req-A" });
    const refundB = refundKey({ ...base, requestId: "req-B" });
    expect(refundA).not.toBe(refundB); // two distinct decisions → distinct keys → both succeed
    // A true network retry of ONE decision reuses its id → collapses.
    expect(refundKey({ ...base, requestId: "req-A" })).toBe(refundA);
  });

  it("A-STRIPE-005 — requestId is backward-compatible (absent → legacy key)", () => {
    const legacy = refundKey({ chargeId: "ch_1", amountCents: 2500 });
    // Omitted / null / empty requestId must produce the byte-identical old key
    // so existing callers are unchanged.
    expect(refundKey({ chargeId: "ch_1", amountCents: 2500, requestId: undefined })).toBe(legacy);
    expect(refundKey({ chargeId: "ch_1", amountCents: 2500, requestId: null })).toBe(legacy);
    expect(refundKey({ chargeId: "ch_1", amountCents: 2500, requestId: "" })).toBe(legacy);
    // And a requestId still stays within Stripe's 255-char cap.
    expect(refundKey({ chargeId: "ch_1", amountCents: 2500, requestId: "x".repeat(300) }).length)
      .toBeLessThanOrEqual(255);
  });

  it("payment-link checkout key keyed by link+amount+period", () => {
    const base = { linkToken: "tok_1", amountCents: 10000, period: "2026-06" };
    expect(paymentLinkCheckoutKey(base)).toBe(paymentLinkCheckoutKey({ ...base }));
    expect(paymentLinkCheckoutKey(base)).not.toBe(paymentLinkCheckoutKey({ ...base, amountCents: 5000 }));
  });

  it("keys are url-safe and <=255 chars", () => {
    const dirty = refundKey({ chargeId: "ch /weird?&id", amountCents: 100 });
    expect(dirty.length).toBeLessThanOrEqual(255);
    expect(dirty).toMatch(/^[a-zA-Z0-9._:-]+$/);
  });
});
