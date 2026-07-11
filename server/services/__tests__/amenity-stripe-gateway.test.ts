/**
 * Amenity Stripe gateway — idempotency + strongly-consistent lookup (founder-os#10752).
 *
 * A-STRIPE-001 — forfeit (capture) and refund (cancel) carry a stable
 *                Idempotency-Key, so a network retry doesn't double-capture /
 *                error-loop; distinct partial forfeit amounts → distinct keys.
 * A-STRIPE-003 — the stored deposit-hold PaymentIntent id drives a DIRECT lookup
 *                (no eventually-consistent Stripe Search); search is the fallback
 *                only when no stored id is present (legacy reservations).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { amenityForfeitKey, amenityRefundKey } from "../stripe-idempotency";

// Active saved payment method → a resolvable Stripe context.
const METHOD = {
  personId: "person-1",
  associationId: "assoc-1",
  isActive: 1,
  isDefault: 1,
  status: "active",
  providerCustomerId: "cus_1",
  providerPaymentMethodId: "pm_1",
};

vi.mock("../../db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({ limit: () => Promise.resolve([METHOD]) }),
        }),
      }),
    }),
  },
}));

vi.mock("../stripe-connect-resolver", () => ({
  resolveConnectChargeRouting: vi.fn(async () => ({
    platformSecretKey: "sk_test_platform",
    stripeAccountHeader: "acct_1",
  })),
}));

vi.mock("../../storage", () => ({
  storage: { getActivePaymentGatewayConnection: vi.fn(async () => ({ secretKey: "sk_test_platform" })) },
}));

vi.mock("@shared/schema", () => ({ savedPaymentMethods: {} }));

import { createStripeAmenityGateway } from "../amenity-stripe-gateway";

type FetchCall = { url: string; method?: string; headers?: Record<string, string>; body?: string };
let calls: FetchCall[] = [];

function stubFetch() {
  const impl = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({
      url,
      method: init?.method,
      headers: init?.headers as Record<string, string>,
      body: init?.body as string,
    });
    // Search endpoint returns a hit; POST endpoints echo an intent id.
    if (url.includes("/payment_intents/search")) {
      return { ok: true, json: async () => ({ data: [{ id: "pi_searched" }] }) } as unknown as Response;
    }
    return { ok: true, json: async () => ({ id: "pi_result", status: "canceled" }) } as unknown as Response;
  });
  vi.stubGlobal("fetch", impl);
}

const GW = () => createStripeAmenityGateway({ associationId: "assoc-1", personId: "person-1" });

beforeEach(() => {
  calls = [];
  stubFetch();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("amenity gateway — A-STRIPE-003 strongly-consistent lookup", () => {
  it("refundDeposit uses the STORED hold id directly (no Stripe Search call)", async () => {
    const r = await GW().refundDeposit({ reservationId: "res-1", amountCents: 20000, holdIntentId: "pi_stored" });
    expect(r.ok).toBe(true);
    // No search endpoint hit; the cancel goes straight to the stored id.
    expect(calls.some((c) => c.url.includes("/payment_intents/search"))).toBe(false);
    const cancel = calls.find((c) => c.url.includes("/pi_stored/cancel"));
    expect(cancel).toBeTruthy();
  });

  it("forfeitDeposit uses the STORED hold id directly", async () => {
    await GW().forfeitDeposit({ reservationId: "res-1", amountCents: 5000, holdIntentId: "pi_stored" });
    expect(calls.some((c) => c.url.includes("/payment_intents/search"))).toBe(false);
    expect(calls.find((c) => c.url.includes("/pi_stored/capture"))).toBeTruthy();
  });

  it("legacy (no stored id) falls back to Stripe Search", async () => {
    await GW().refundDeposit({ reservationId: "res-1", amountCents: 20000, holdIntentId: null });
    // First a search, then a cancel on the searched id.
    expect(calls.some((c) => c.url.includes("/payment_intents/search"))).toBe(true);
    expect(calls.find((c) => c.url.includes("/pi_searched/cancel"))).toBeTruthy();
  });
});

describe("amenity gateway — A-STRIPE-001 idempotency keys", () => {
  it("refund (cancel) carries the amenity refund Idempotency-Key", async () => {
    await GW().refundDeposit({ reservationId: "res-1", amountCents: 20000, holdIntentId: "pi_stored" });
    const cancel = calls.find((c) => c.url.includes("/cancel"))!;
    expect(cancel.headers?.["Idempotency-Key"]).toBe(amenityRefundKey({ reservationId: "res-1", amountCents: 20000 }));
  });

  it("forfeit (capture) carries the amenity forfeit Idempotency-Key + amount_to_capture", async () => {
    await GW().forfeitDeposit({ reservationId: "res-1", amountCents: 5000, holdIntentId: "pi_stored" });
    const capture = calls.find((c) => c.url.includes("/capture"))!;
    expect(capture.headers?.["Idempotency-Key"]).toBe(amenityForfeitKey({ reservationId: "res-1", amountCents: 5000 }));
    expect(capture.body).toContain("amount_to_capture=5000");
  });

  it("distinct partial forfeits of different amounts produce distinct keys", async () => {
    await GW().forfeitDeposit({ reservationId: "res-1", amountCents: 5000, holdIntentId: "pi_stored" });
    await GW().forfeitDeposit({ reservationId: "res-1", amountCents: 7500, holdIntentId: "pi_stored" });
    const captureKeys = calls.filter((c) => c.url.includes("/capture")).map((c) => c.headers?.["Idempotency-Key"]);
    expect(captureKeys[0]).not.toBe(captureKeys[1]);
  });
});
