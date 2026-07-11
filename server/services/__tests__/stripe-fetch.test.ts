/**
 * stripeFetch — the shared Stripe transport (CQ-008 consolidation, founder-os#10755).
 *
 * These cover the two required-test groups from the dispatch:
 *  - idempotency-key presence per money mutation (POST carries the key; GET does not)
 *  - retry / timeout behavior on the wrapper (money-safe: a keyless POST is never
 *    retried; a keyed POST / GET is; 4xx is not; network + timeout retry then rethrow)
 *
 * The wrapper is byte-behavior-identical to the 9 raw fetch() sites it replaces:
 * caller passes its own secretKey, header assembly matches, and it never throws on
 * an HTTP status (callers keep their own validation).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stripeFetch } from "../stripe-fetch";

const KEY = "sk_test_platform";

function mockFetchSequence(
  responses: Array<
    { ok: boolean; status: number; body?: unknown } | Error
  >,
) {
  let i = 0;
  return vi.fn(async () => {
    const r = responses[Math.min(i, responses.length - 1)];
    i++;
    if (r instanceof Error) throw r;
    return {
      ok: r.ok,
      status: r.status,
      json: async () => r.body ?? {},
    } as any;
  });
}

function lastInit(mock: any): RequestInit {
  const calls = mock.mock.calls;
  return calls[calls.length - 1][1] as RequestInit;
}
function headerOf(init: RequestInit, name: string): string | undefined {
  return (init.headers as Record<string, string>)[name];
}

beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.restoreAllMocks());

describe("stripeFetch — header assembly (byte-identical to the raw sites)", () => {
  it("sends the caller's secret key as the Bearer token — never resolves its own", async () => {
    const f = mockFetchSequence([{ ok: true, status: 200, body: { id: "x" } }]);
    globalThis.fetch = f as any;
    await stripeFetch({ secretKey: "sk_test_caller_owns_this", method: "GET", path: "/account" });
    expect(headerOf(lastInit(f), "Authorization")).toBe("Bearer sk_test_caller_owns_this");
  });

  it("sets Content-Type only when a body is present", async () => {
    const f = mockFetchSequence([{ ok: true, status: 200 }, { ok: true, status: 200 }]);
    globalThis.fetch = f as any;
    await stripeFetch({ secretKey: KEY, method: "GET", path: "/account" });
    expect(headerOf(lastInit(f), "Content-Type")).toBeUndefined();
    await stripeFetch({ secretKey: KEY, method: "POST", path: "/customers", body: new URLSearchParams({ a: "1" }) });
    expect(headerOf(lastInit(f), "Content-Type")).toBe("application/x-www-form-urlencoded");
  });

  it("sets Stripe-Account only when provided", async () => {
    const f = mockFetchSequence([{ ok: true, status: 200 }]);
    globalThis.fetch = f as any;
    await stripeFetch({ secretKey: KEY, method: "POST", path: "/customers", body: new URLSearchParams(), stripeAccount: "acct_123" });
    expect(headerOf(lastInit(f), "Stripe-Account")).toBe("acct_123");
  });

  it("builds the URL with base + path + query", async () => {
    const f = mockFetchSequence([{ ok: true, status: 200 }]);
    globalThis.fetch = f as any;
    await stripeFetch({ secretKey: KEY, method: "GET", path: "/balance_transactions", query: new URLSearchParams({ limit: "5" }) });
    expect((f.mock.calls[0] as any)[0]).toBe("https://api.stripe.com/v1/balance_transactions?limit=5");
  });
});

describe("stripeFetch — idempotency-key presence per money mutation", () => {
  it("applies Idempotency-Key on a POST money mutation", async () => {
    const f = mockFetchSequence([{ ok: true, status: 200, body: { id: "pi_1" } }]);
    globalThis.fetch = f as any;
    await stripeFetch({ secretKey: KEY, method: "POST", path: "/payment_intents", body: new URLSearchParams({ amount: "100" }), idempotencyKey: "ycm:charge:txn-1" });
    expect(headerOf(lastInit(f), "Idempotency-Key")).toBe("ycm:charge:txn-1");
  });

  it("never applies Idempotency-Key on a GET (Stripe ignores it; keeps behavior clean)", async () => {
    const f = mockFetchSequence([{ ok: true, status: 200 }]);
    globalThis.fetch = f as any;
    await stripeFetch({ secretKey: KEY, method: "GET", path: "/checkout/sessions/cs_1", idempotencyKey: "ycm:should-not-apply" });
    expect(headerOf(lastInit(f), "Idempotency-Key")).toBeUndefined();
  });
});

describe("stripeFetch — money-safe retry behavior", () => {
  it("retries a keyed POST on a 5xx, then succeeds", async () => {
    const f = mockFetchSequence([
      { ok: false, status: 500 },
      { ok: true, status: 200, body: { id: "pi_ok" } },
    ]);
    globalThis.fetch = f as any;
    const res = await stripeFetch({ secretKey: KEY, method: "POST", path: "/payment_intents", body: new URLSearchParams(), idempotencyKey: "ycm:k", timeoutMs: 50 });
    expect(res.ok).toBe(true);
    expect((res.data as any).id).toBe("pi_ok");
    expect(f.mock.calls.length).toBe(2);
  });

  it("NEVER retries a keyless POST (no double charge) — returns the failure", async () => {
    const f = mockFetchSequence([{ ok: false, status: 500, body: { error: { message: "boom" } } }]);
    globalThis.fetch = f as any;
    const res = await stripeFetch({ secretKey: KEY, method: "POST", path: "/customers", body: new URLSearchParams(), timeoutMs: 50 });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(500);
    expect(f.mock.calls.length).toBe(1); // exactly one attempt — not retried
  });

  it("retries a GET on 429, then succeeds", async () => {
    const f = mockFetchSequence([
      { ok: false, status: 429 },
      { ok: true, status: 200, body: { id: "acct_1" } },
    ]);
    globalThis.fetch = f as any;
    const res = await stripeFetch({ secretKey: KEY, method: "GET", path: "/account", timeoutMs: 50 });
    expect(res.ok).toBe(true);
    expect(f.mock.calls.length).toBe(2);
  });

  it("does NOT retry a 4xx (non-429) — a caller error is returned, not retried", async () => {
    const f = mockFetchSequence([{ ok: false, status: 400, body: { error: { message: "bad request" } } }]);
    globalThis.fetch = f as any;
    const res = await stripeFetch({ secretKey: KEY, method: "GET", path: "/account", timeoutMs: 50 });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(400);
    expect(f.mock.calls.length).toBe(1);
  });

  it("retries a network error on a retriable call, then rethrows after exhaustion", async () => {
    const f = mockFetchSequence([new Error("ECONNRESET"), new Error("ECONNRESET"), new Error("ECONNRESET")]);
    globalThis.fetch = f as any;
    await expect(
      stripeFetch({ secretKey: KEY, method: "GET", path: "/account", maxRetries: 2, timeoutMs: 50 }),
    ).rejects.toThrow("ECONNRESET");
    expect(f.mock.calls.length).toBe(3); // initial + 2 retries
  });

  it("never throws on an HTTP error status — returns {ok,status,data} for the caller to validate", async () => {
    const f = mockFetchSequence([{ ok: false, status: 402, body: { error: { message: "card_declined" } } }]);
    globalThis.fetch = f as any;
    const res = await stripeFetch({ secretKey: KEY, method: "POST", path: "/payment_intents", body: new URLSearchParams(), idempotencyKey: "ycm:k", timeoutMs: 50 });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(402);
    expect((res.data as any).error.message).toBe("card_declined");
  });
});
