/**
 * Platform Stripe request helper — idempotency + retry (A-STRIPE-004).
 *
 * Proves: a money-moving / create POST carries a stable Idempotency-Key ACROSS
 * retries (so Stripe replays the first object instead of creating a second on a
 * 429/5xx retry), and non-idempotent POSTs are NOT retried.
 */
import { describe, expect, it, vi } from "vitest";
import { platformStripeRequest } from "../platform-stripe-request";

const noSleep = async () => {};

function okResp(body: Record<string, unknown>) {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}
function errResp(status: number, body: Record<string, unknown> = { error: { message: "boom" } }) {
  return { ok: false, status, json: async () => body } as unknown as Response;
}

describe("platformStripeRequest — A-STRIPE-004", () => {
  it("subscription create retry (500→200) does NOT produce a second subscription — same key both attempts", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(errResp(500))
      .mockResolvedValueOnce(okResp({ id: "sub_1", object: "subscription" }));
    const out = await platformStripeRequest("sk_test", "POST", "/subscriptions", new URLSearchParams(), {
      idempotencyKey: "plat-sub:a1:self-managed:new",
      fetchImpl,
      sleep: noSleep,
    });
    expect(out.id).toBe("sub_1");
    // Retried once → exactly two fetches, BOTH carrying the SAME idempotency key.
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const key1 = (fetchImpl.mock.calls[0][1].headers as Record<string, string>)["Idempotency-Key"];
    const key2 = (fetchImpl.mock.calls[1][1].headers as Record<string, string>)["Idempotency-Key"];
    expect(key1).toBe("plat-sub:a1:self-managed:new");
    expect(key2).toBe(key1); // Stripe replays the first subscription on the retry.
  });

  it("customer create retry (429→200) reuses the customer — one logical customer", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(errResp(429))
      .mockResolvedValueOnce(okResp({ id: "cus_1" }));
    const out = await platformStripeRequest("sk_test", "POST", "/customers", new URLSearchParams(), {
      idempotencyKey: "plat-cust:a1:self-managed",
      fetchImpl,
      sleep: noSleep,
    });
    expect(out.id).toBe("cus_1");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("a POST WITHOUT an idempotency key is NOT retried (avoids duplicate money movement)", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(errResp(500));
    await expect(
      platformStripeRequest("sk_test", "POST", "/customers", new URLSearchParams(), {
        fetchImpl,
        sleep: noSleep,
      }),
    ).rejects.toThrow(/boom/);
    expect(fetchImpl).toHaveBeenCalledTimes(1); // no retry without a key
  });

  it("a GET is retried on 5xx even without a key (naturally safe)", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(errResp(503))
      .mockResolvedValueOnce(okResp({ id: "sub_1", status: "active" }));
    const out = await platformStripeRequest("sk_test", "GET", "/subscriptions/sub_1", undefined, {
      fetchImpl,
      sleep: noSleep,
    });
    expect(out.status).toBe("active");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    // GET never sets an Idempotency-Key header.
    expect((fetchImpl.mock.calls[0][1].headers as Record<string, string>)["Idempotency-Key"]).toBeUndefined();
  });

  it("exhausts retries then throws the Stripe error message", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(errResp(500, { error: { message: "still down" } }));
    await expect(
      platformStripeRequest("sk_test", "POST", "/subscriptions", new URLSearchParams(), {
        idempotencyKey: "k",
        maxRetries: 2,
        fetchImpl,
        sleep: noSleep,
      }),
    ).rejects.toThrow(/still down/);
    expect(fetchImpl).toHaveBeenCalledTimes(3); // 1 + 2 retries
  });

  it("a 4xx (non-429) is NOT retried — it's a real error", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(errResp(400, { error: { message: "bad request" } }));
    await expect(
      platformStripeRequest("sk_test", "POST", "/customers", new URLSearchParams(), {
        idempotencyKey: "k",
        fetchImpl,
        sleep: noSleep,
      }),
    ).rejects.toThrow(/bad request/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
