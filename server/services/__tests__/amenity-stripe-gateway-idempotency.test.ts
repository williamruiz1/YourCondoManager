/**
 * A-STRIPE-001 (founder-os#10752, YCM audit Wave 2) — the amenity deposit
 * forfeit (PaymentIntent capture) and refund (PaymentIntent cancel) — the two
 * gateway calls that MOVE money — must carry a stable Idempotency-Key, like
 * chargeFee/holdDeposit already do. Without it, a retry after a DB-write failure
 * could double-capture a resident's deposit.
 *
 * This test drives the REAL gateway with a mocked Stripe context + a global
 * `fetch` spy, and asserts the `Idempotency-Key` header on the capture/cancel
 * POSTs (and that distinct forfeit amounts produce distinct keys → a partial
 * re-forfeit of a different amount is a distinct operation, not a replay).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Context chain mocks (make resolveStripeContext return a usable ctx) ───────
const validMethod = {
  status: "active",
  providerCustomerId: "cus_1",
  providerPaymentMethodId: "pm_1",
  isActive: 1,
  isDefault: 1,
};
// Chainable db.select()…limit() → [validMethod]
vi.mock("../../db", () => {
  const chain: any = {
    select: () => chain,
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => Promise.resolve([validMethod]),
  };
  return { db: chain };
});
vi.mock("@shared/schema", () => ({ savedPaymentMethods: {} }));
vi.mock("../stripe-connect-resolver", () => ({
  resolveConnectChargeRouting: async () => ({
    platformSecretKey: "sk_test_gateway",
    stripeAccountHeader: "acct_test",
  }),
}));
vi.mock("../../storage", () => ({
  storage: { getActivePaymentGatewayConnection: async () => null },
}));

import { createStripeAmenityGateway } from "../amenity-stripe-gateway";

const HOLD_ID = "pi_hold_abc";

// A fetch spy: answers the metadata search with the hold intent, and the
// capture/cancel POSTs with success — recording the Idempotency-Key header.
function installFetchSpy() {
  const seen: Array<{ url: string; method: string; idempotencyKey: string | undefined }> = [];
  const spy = vi.fn(async (url: string, init?: any) => {
    const method = init?.method ?? "GET";
    const idempotencyKey = init?.headers?.["Idempotency-Key"];
    seen.push({ url, method, idempotencyKey });
    if (url.includes("/payment_intents/search")) {
      return { ok: true, json: async () => ({ data: [{ id: HOLD_ID }] }) } as any;
    }
    // capture / cancel → success (body carries an id so stripePost returns ok)
    return { ok: true, json: async () => ({ id: HOLD_ID, status: "succeeded" }) } as any;
  });
  vi.stubGlobal("fetch", spy);
  return seen;
}

describe("A-STRIPE-001 — amenity forfeit/refund carry an Idempotency-Key", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("forfeitDeposit sends a stable, amount-scoped Idempotency-Key on the capture", async () => {
    const seen = installFetchSpy();
    const gw = createStripeAmenityGateway({ associationId: "assoc_1", personId: "person_1" });
    const res = await gw.forfeitDeposit({ reservationId: "resv_1", amountCents: 5000 });
    expect(res.ok).toBe(true);
    const capture = seen.find((s) => s.url.includes(`/${HOLD_ID}/capture`));
    expect(capture, "capture POST must have fired").toBeTruthy();
    expect(capture!.idempotencyKey).toBe(`amn-forfeit-resv_1-${HOLD_ID}-5000`);
  });

  it("refundDeposit sends a stable Idempotency-Key on the cancel", async () => {
    const seen = installFetchSpy();
    const gw = createStripeAmenityGateway({ associationId: "assoc_1", personId: "person_1" });
    const res = await gw.refundDeposit({ reservationId: "resv_1" });
    expect(res.ok).toBe(true);
    const cancel = seen.find((s) => s.url.includes(`/${HOLD_ID}/cancel`));
    expect(cancel, "cancel POST must have fired").toBeTruthy();
    expect(cancel!.idempotencyKey).toBe(`amn-refund-resv_1-${HOLD_ID}`);
  });

  it("distinct forfeit amounts produce distinct keys (a different partial is a distinct op)", async () => {
    const seen1 = installFetchSpy();
    const gw = createStripeAmenityGateway({ associationId: "assoc_1", personId: "person_1" });
    await gw.forfeitDeposit({ reservationId: "resv_1", amountCents: 5000 });
    const k1 = seen1.find((s) => s.url.includes("/capture"))!.idempotencyKey;
    vi.unstubAllGlobals();

    const seen2 = installFetchSpy();
    await gw.forfeitDeposit({ reservationId: "resv_1", amountCents: 7500 });
    const k2 = seen2.find((s) => s.url.includes("/capture"))!.idempotencyKey;
    expect(k1).not.toBe(k2);
    // a true retry of the SAME amount collapses to the SAME key
    expect(k1).toBe(`amn-forfeit-resv_1-${HOLD_ID}-5000`);
  });
});
