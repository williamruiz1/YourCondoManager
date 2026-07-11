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
  amenityForfeitKey,
  amenityRefundKey,
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

  // A-STRIPE-005 — a per-refund-request disambiguator makes two DISTINCT partial
  // refunds of the same charge+amount distinct keys, while a true retry collapses.
  it("refund key: distinct requestIds → distinct keys; same request → same key", () => {
    const base = { chargeId: "ch_1", amountCents: 2500 };
    const reqA = refundKey({ ...base, requestId: "rr_A" });
    const reqB = refundKey({ ...base, requestId: "rr_B" });
    // Two legitimately distinct $25 refunds of the same charge → both succeed.
    expect(reqA).not.toBe(reqB);
    // A true network retry of ONE refund (same request) collapses.
    expect(reqA).toBe(refundKey({ ...base, requestId: "rr_A" }));
    // Omitting requestId degrades to the legacy charge+amount grain (back-compat).
    const legacy = refundKey(base);
    expect(legacy).toBe(refundKey({ ...base }));
    expect(legacy).not.toBe(reqA);
  });

  // A-STRIPE-001 — amenity forfeit/refund keys are stable per (reservation,amount)
  // and distinguish different amounts (distinct partial forfeits).
  it("amenity forfeit key: stable per reservation+amount; distinct amounts distinct", () => {
    expect(amenityForfeitKey({ reservationId: "r1", amountCents: 5000 })).toBe(
      amenityForfeitKey({ reservationId: "r1", amountCents: 5000 }),
    );
    expect(amenityForfeitKey({ reservationId: "r1", amountCents: 5000 })).not.toBe(
      amenityForfeitKey({ reservationId: "r1", amountCents: 7500 }),
    );
    expect(amenityForfeitKey({ reservationId: "r1", amountCents: 5000 })).not.toBe(
      amenityForfeitKey({ reservationId: "r2", amountCents: 5000 }),
    );
  });

  it("amenity refund key: stable per reservation+amount; distinct from forfeit", () => {
    expect(amenityRefundKey({ reservationId: "r1", amountCents: 5000 })).toBe(
      amenityRefundKey({ reservationId: "r1", amountCents: 5000 }),
    );
    // A refund (release) and a forfeit (capture) of the same hold are DIFFERENT ops.
    expect(amenityRefundKey({ reservationId: "r1", amountCents: 5000 })).not.toBe(
      amenityForfeitKey({ reservationId: "r1", amountCents: 5000 }),
    );
  });
});
