/**
 * stripe-fetch.test.ts — acceptance tests for the canonical Stripe client
 * (founder-os#10780, CQ-008). Proves the money-safety invariants:
 *  - byte-identical request construction (URL / method / headers / body)
 *  - Idempotency-Key present on money POSTs, absent on GET / keyless POST
 *  - retry OFF by default (single fetch = zero behavior change)
 *  - retry, when ON, replays a GET or an idempotent POST — but NEVER a keyless
 *    money POST (double-charge guard)
 *  - opt-in timeout attaches an AbortSignal; absent otherwise
 *  - returns the raw Response (never parses / never throws on !ok)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stripeFetch } from "../stripe-fetch";

function mockResp(status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => ({ id: "obj_1" }) };
}
function calls(): Array<[string, RequestInit]> {
  return (globalThis.fetch as any).mock.calls;
}
function lastInit(): RequestInit {
  const c = calls();
  return c[c.length - 1][1];
}
function header(init: RequestInit, name: string): string | undefined {
  return (init.headers as Record<string, string>)[name];
}

beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.restoreAllMocks());

describe("stripeFetch — request construction (byte-identical)", () => {
  it("POST with body + account + idempotency: exact URL / method / headers / body", async () => {
    globalThis.fetch = vi.fn(async () => mockResp(200)) as any;
    const body = new URLSearchParams();
    body.set("amount", "100");
    await stripeFetch({
      path: "/checkout/sessions",
      method: "POST",
      secretKey: "sk_test_x",
      body,
      stripeAccount: "acct_1",
      idempotencyKey: "idem_1",
    });
    const [url, init] = calls()[0];
    expect(url).toBe("https://api.stripe.com/v1/checkout/sessions");
    expect(init.method).toBe("POST");
    expect(header(init, "Authorization")).toBe("Bearer sk_test_x");
    expect(header(init, "Content-Type")).toBe("application/x-www-form-urlencoded");
    expect(header(init, "Stripe-Account")).toBe("acct_1");
    expect(header(init, "Idempotency-Key")).toBe("idem_1");
    expect(init.body).toBe("amount=100");
  });

  it("GET: no Content-Type, no body, no Stripe-Account; idempotency ignored", async () => {
    globalThis.fetch = vi.fn(async () => mockResp(200)) as any;
    await stripeFetch({ path: "/account", method: "GET", secretKey: "sk", idempotencyKey: "ignored" });
    const init = lastInit();
    expect(init.method).toBe("GET");
    expect(header(init, "Content-Type")).toBeUndefined();
    expect(header(init, "Idempotency-Key")).toBeUndefined();
    expect(header(init, "Stripe-Account")).toBeUndefined();
    expect(init.body).toBeUndefined();
  });

  it("defaults method to GET when omitted (matches a bare fetch(url))", async () => {
    globalThis.fetch = vi.fn(async () => mockResp(200)) as any;
    await stripeFetch({ path: "/account", secretKey: "sk" });
    expect(lastInit().method).toBe("GET");
  });

  it("key is caller-supplied — a connected-account key routes to that account", async () => {
    globalThis.fetch = vi.fn(async () => mockResp(200)) as any;
    await stripeFetch({ path: "/customers", method: "POST", secretKey: "sk_connected_acct", body: new URLSearchParams() });
    expect(header(lastInit(), "Authorization")).toBe("Bearer sk_connected_acct");
  });
});

describe("stripeFetch — Idempotency-Key per money mutation", () => {
  it("present on a money POST with a key; absent on a keyless POST", async () => {
    globalThis.fetch = vi.fn(async () => mockResp(200)) as any;
    const b = new URLSearchParams();
    b.set("amount", "1");
    await stripeFetch({ path: "/payment_intents", method: "POST", secretKey: "sk", body: b, idempotencyKey: "k1" });
    expect(header(lastInit(), "Idempotency-Key")).toBe("k1");
    await stripeFetch({ path: "/customers", method: "POST", secretKey: "sk", body: b });
    expect(header(lastInit(), "Idempotency-Key")).toBeUndefined();
  });
});

describe("stripeFetch — retry (default off) + money-safety guard", () => {
  it("retry OFF (default): single fetch even on 500 — zero behavior change, returns the response", async () => {
    globalThis.fetch = vi.fn(async () => mockResp(500)) as any;
    const r = await stripeFetch({ path: "/account", method: "GET", secretKey: "sk" });
    expect(calls().length).toBe(1);
    expect(r.status).toBe(500); // returned, NOT thrown
  });

  it("retry ON (GET): replays a transient 500 then returns success", async () => {
    let n = 0;
    globalThis.fetch = vi.fn(async () => {
      n += 1;
      return mockResp(n < 3 ? 500 : 200);
    }) as any;
    const r = await stripeFetch({ path: "/account", method: "GET", secretKey: "sk", retry: { retries: 3, baseMs: 1 } });
    expect(n).toBe(3);
    expect(r.status).toBe(200);
  });

  it("retry ON (idempotent POST): replays a 429 because the Idempotency-Key makes it safe", async () => {
    let n = 0;
    globalThis.fetch = vi.fn(async () => {
      n += 1;
      return mockResp(n < 2 ? 429 : 200);
    }) as any;
    const b = new URLSearchParams();
    b.set("amount", "1");
    const r = await stripeFetch({
      path: "/payment_intents",
      method: "POST",
      secretKey: "sk",
      body: b,
      idempotencyKey: "k",
      retry: { retries: 2, baseMs: 1 },
    });
    expect(n).toBe(2);
    expect(r.status).toBe(200);
  });

  it("MONEY-SAFETY: never retries a keyless POST even when retry:true (no double-charge)", async () => {
    globalThis.fetch = vi.fn(async () => mockResp(500)) as any;
    const b = new URLSearchParams();
    b.set("amount", "1");
    const r = await stripeFetch({ path: "/payment_intents", method: "POST", secretKey: "sk", body: b, retry: true });
    expect(calls().length).toBe(1); // NOT replayed
    expect(r.status).toBe(500);
  });

  it("retry ON: replays a network error then succeeds", async () => {
    let n = 0;
    globalThis.fetch = vi.fn(async () => {
      n += 1;
      if (n < 2) throw new Error("ECONNRESET");
      return mockResp(200);
    }) as any;
    const r = await stripeFetch({ path: "/account", method: "GET", secretKey: "sk", retry: { retries: 2, baseMs: 1 } });
    expect(n).toBe(2);
    expect(r.status).toBe(200);
  });

  it("retry OFF: a network error propagates (byte-identical to a raw fetch)", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("ECONNRESET");
    }) as any;
    await expect(stripeFetch({ path: "/account", method: "GET", secretKey: "sk" })).rejects.toThrow("ECONNRESET");
    expect(calls().length).toBe(1);
  });
});

describe("stripeFetch — timeout (opt-in)", () => {
  it("attaches an AbortSignal only when timeoutMs is set", async () => {
    globalThis.fetch = vi.fn(async () => mockResp(200)) as any;
    await stripeFetch({ path: "/account", method: "GET", secretKey: "sk" });
    expect((lastInit() as any).signal).toBeUndefined();
    await stripeFetch({ path: "/account", method: "GET", secretKey: "sk", timeoutMs: 5000 });
    expect((lastInit() as any).signal).toBeDefined();
  });
});
