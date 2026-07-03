/**
 * Owner-finances rework (2026-06-30) — Stripe setup-checkout Connect-awareness.
 *
 * William finding #2: the owner "Add method" button was dead for Cherry Hill
 * Court because the saved-payment-method SETUP path only used the legacy manual
 * `gateway.secretKey`. CHC pays via Stripe CONNECT (no manual key), so the
 * endpoint 400'd. The fix makes the setup path Connect-aware: when a connected
 * account is active, the customer + setup session are created ON that connected
 * account via the `Stripe-Account` header (platform key).
 *
 * These tests verify the SERVICE layer carries the `Stripe-Account` header when
 * given `stripeAccountHeader`, and omits it on the legacy manual-key path.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `ensureStripeCustomer` reads the DB to dedupe an existing customer; the other
// two functions don't. Mock `db` so the "no existing customer" path is taken.
vi.mock("../../db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [], // no existing saved customer → create a new one
        }),
      }),
    }),
  },
}));

import {
  ensureStripeCustomer,
  initiateStripeSetupCheckout,
  fetchStripeCheckoutSession,
} from "../payment-service";

const PLATFORM_KEY = "sk_test_platform";
const CONNECT_ACCT = "acct_1TnzDnArorHrelxs"; // CHC connected account

function lastFetchCall() {
  const calls = (globalThis.fetch as any).mock.calls;
  return calls[calls.length - 1] as [string, RequestInit];
}
function headerOf(init: RequestInit, name: string): string | undefined {
  return (init.headers as Record<string, string>)[name];
}

beforeEach(() => {
  vi.restoreAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("ensureStripeCustomer — Connect header", () => {
  it("sets Stripe-Account when stripeAccountHeader is provided", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ id: "cus_123" }) }) as any;

    const id = await ensureStripeCustomer({
      secretKey: PLATFORM_KEY,
      stripeAccountHeader: CONNECT_ACCT,
      associationId: "assoc-chc",
      personId: "person-1",
      email: "owner@example.com",
    });

    expect(id).toBe("cus_123");
    const [url, init] = lastFetchCall();
    expect(url).toBe("https://api.stripe.com/v1/customers");
    expect(headerOf(init, "Stripe-Account")).toBe(CONNECT_ACCT);
    expect(headerOf(init, "Authorization")).toBe(`Bearer ${PLATFORM_KEY}`);
  });

  it("omits Stripe-Account on the legacy manual-key path", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ id: "cus_456" }) }) as any;

    await ensureStripeCustomer({
      secretKey: "sk_test_manual",
      associationId: "assoc-manual",
      personId: "person-2",
    });

    const [, init] = lastFetchCall();
    expect(headerOf(init, "Stripe-Account")).toBeUndefined();
  });
});

describe("initiateStripeSetupCheckout — Connect header + card+ACH", () => {
  it("creates the setup session on the connected account when header is set", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ id: "cs_test", url: "https://checkout.stripe.com/c/pay/cs_test" }) }) as any;

    const result = await initiateStripeSetupCheckout({
      secretKey: PLATFORM_KEY,
      stripeAccountHeader: CONNECT_ACCT,
      stripeCustomerId: "cus_123",
      appBaseUrl: "https://yourcondomanager.fly.dev",
      associationId: "assoc-chc",
      personId: "person-1",
    });

    expect(result.checkoutUrl).toContain("checkout.stripe.com");
    expect(result.sessionId).toBe("cs_test");

    const [url, init] = lastFetchCall();
    expect(url).toBe("https://api.stripe.com/v1/checkout/sessions");
    expect(headerOf(init, "Stripe-Account")).toBe(CONNECT_ACCT);
    // setup mode, customer, card + ACH offered
    const body = String((init as any).body);
    expect(body).toContain("mode=setup");
    expect(body).toContain("customer=cus_123");
    expect(body).toContain("payment_method_types%5B0%5D=card");
    expect(body).toContain("payment_method_types%5B1%5D=us_bank_account");
  });

  it("omits Stripe-Account on the manual-key path", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ id: "cs_m", url: "https://checkout.stripe.com/c/pay/cs_m" }) }) as any;

    await initiateStripeSetupCheckout({
      secretKey: "sk_test_manual",
      stripeCustomerId: "cus_m",
      appBaseUrl: "https://example.com",
      associationId: "assoc-manual",
      personId: "person-2",
    });

    const [, init] = lastFetchCall();
    expect(headerOf(init, "Stripe-Account")).toBeUndefined();
  });
});

describe("fetchStripeCheckoutSession — Connect header on return fetch", () => {
  it("fetches the connected-account session WITH the Stripe-Account header", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ id: "cs_test", setup_intent: null }) }) as any;

    await fetchStripeCheckoutSession({
      secretKey: PLATFORM_KEY,
      stripeAccountHeader: CONNECT_ACCT,
      sessionId: "cs_test",
    });

    const [url, init] = lastFetchCall();
    expect(url).toContain("/v1/checkout/sessions/cs_test");
    expect(headerOf(init, "Stripe-Account")).toBe(CONNECT_ACCT);
  });

  it("omits the header on the manual-key path", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ id: "cs_m" }) }) as any;

    await fetchStripeCheckoutSession({ secretKey: "sk_test_manual", sessionId: "cs_m" });

    const [, init] = lastFetchCall();
    expect(headerOf(init, "Stripe-Account")).toBeUndefined();
  });
});
