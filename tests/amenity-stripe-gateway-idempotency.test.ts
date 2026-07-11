/**
 * A-STRIPE-001 — amenity deposit forfeit/refund carry a stable Idempotency-Key.
 *
 * `forfeitDeposit` (PaymentIntent capture) and `refundDeposit` (PaymentIntent
 * cancel) MOVE money but previously sent NO Idempotency-Key (unlike chargeFee /
 * holdDeposit), violating the codebase's own invariant. This test drives the
 * real gateway with mocked Stripe context + a fetch spy and asserts the
 * money-moving POST carries the expected key:
 *   - forfeit → `amn-forfeit-<reservationId>-<amountCents>` (amount in the grain
 *     so distinct partial forfeits are distinct keys, no double-capture on retry)
 *   - refund  → `amn-refund-<reservationId>` (a cancel has no amount)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const method = {
  status: "active",
  providerCustomerId: "cus_test",
  providerPaymentMethodId: "pm_test",
  isActive: 1,
  isDefault: 1,
};

// Mock the gateway's Stripe-context dependencies. Paths resolve to the same
// modules the SUT imports (vitest matches on resolved absolute path).
vi.mock("../server/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => Promise.resolve([method]),
          }),
        }),
      }),
    }),
  },
}));

vi.mock("../server/storage", () => ({
  storage: {
    getActivePaymentGatewayConnection: async () => null,
  },
}));

vi.mock("../server/services/stripe-connect-resolver", () => ({
  resolveConnectChargeRouting: async () => ({
    platformSecretKey: "sk_test_platform",
    stripeAccountHeader: "acct_test",
  }),
}));

import { createStripeAmenityGateway } from "../server/services/amenity-stripe-gateway";

type FetchCall = { url: string; method: string; idempotencyKey: string | undefined };
let calls: FetchCall[] = [];

beforeEach(() => {
  calls = [];
  vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push({
      url: String(url),
      method: String(init?.method ?? "GET"),
      idempotencyKey: headers["Idempotency-Key"],
    });
    // GET search → return one deposit-hold intent; POST capture/cancel → ok.
    if (String(url).includes("/payment_intents/search")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: [{ id: "pi_hold_123" }] }),
      } as Response);
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({ id: "pi_hold_123", status: "succeeded" }),
    } as Response);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const gateway = () => createStripeAmenityGateway({ associationId: "assoc-1", personId: "person-1" });

function moneyMovingPost(): FetchCall | undefined {
  return calls.find(
    (c) => c.method === "POST" && /\/payment_intents\/[^/]+\/(capture|cancel)/.test(c.url),
  );
}

describe("A-STRIPE-001 — amenity forfeit/refund idempotency", () => {
  it("forfeit (capture) sends amn-forfeit-<reservation>-<amount>", async () => {
    const r = await gateway().forfeitDeposit({ reservationId: "res-9", amountCents: 2500 });
    expect(r.ok).toBe(true);
    const post = moneyMovingPost();
    expect(post?.url).toContain("/payment_intents/pi_hold_123/capture");
    expect(post?.idempotencyKey).toBe("amn-forfeit-res-9-2500");
  });

  it("distinct partial forfeit AMOUNTS produce distinct keys (no double-capture collapse)", async () => {
    await gateway().forfeitDeposit({ reservationId: "res-9", amountCents: 2500 });
    const first = moneyMovingPost()?.idempotencyKey;
    calls = [];
    await gateway().forfeitDeposit({ reservationId: "res-9", amountCents: 4000 });
    const second = moneyMovingPost()?.idempotencyKey;
    expect(first).toBe("amn-forfeit-res-9-2500");
    expect(second).toBe("amn-forfeit-res-9-4000");
    expect(first).not.toBe(second);
  });

  it("refund (cancel) sends amn-refund-<reservation>", async () => {
    const r = await gateway().refundDeposit({ reservationId: "res-9", amountCents: 0 });
    expect(r.ok).toBe(true);
    const post = moneyMovingPost();
    expect(post?.url).toContain("/payment_intents/pi_hold_123/cancel");
    expect(post?.idempotencyKey).toBe("amn-refund-res-9");
  });

  it("a forfeit RETRY reuses the same key (Stripe replays, no double-capture)", async () => {
    await gateway().forfeitDeposit({ reservationId: "res-9", amountCents: 2500 });
    const firstKey = moneyMovingPost()?.idempotencyKey;
    calls = [];
    await gateway().forfeitDeposit({ reservationId: "res-9", amountCents: 2500 });
    const retryKey = moneyMovingPost()?.idempotencyKey;
    expect(retryKey).toBe(firstKey);
  });
});
