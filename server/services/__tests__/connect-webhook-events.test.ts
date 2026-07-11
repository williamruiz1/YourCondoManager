/**
 * Connect webhook enabled-events ensure tests (item 3, R3.4).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let captured: any[] = [];
let endpointEvents: string[] = [];

vi.mock("../stripe-connect", () => ({
  callPlatformStripe: vi.fn(async (opts: any) => {
    captured.push(opts);
    if (opts.method === "GET") {
      return { id: "we_1", enabled_events: endpointEvents };
    }
    // POST update — echo the enabled_events from the body
    const out: string[] = [];
    for (const [k, v] of (opts.body as URLSearchParams).entries()) {
      if (k.startsWith("enabled_events[")) out.push(v);
    }
    endpointEvents = out;
    return { id: "we_1", enabled_events: out };
  }),
}));

import {
  ensureConnectWebhookEvents,
  DESIRED_CONNECT_ENABLED_EVENTS,
} from "../connect-webhook-events";

beforeEach(() => {
  captured = [];
});
afterEach(() => vi.clearAllMocks());

describe("ensureConnectWebhookEvents", () => {
  it("R3.4 desired set includes the 5 failure/dispute events", () => {
    const set = new Set(DESIRED_CONNECT_ENABLED_EVENTS as readonly string[]);
    for (const e of [
      "payment_intent.payment_failed",
      "charge.failed",
      "charge.refunded",
      "charge.dispute.created",
      "charge.dispute.closed",
    ]) {
      expect(set.has(e)).toBe(true);
    }
  });

  it("R3.4 adds only the missing events (idempotent union)", async () => {
    // Endpoint currently only has the lifecycle events.
    endpointEvents = ["account.updated", "charge.succeeded", "payout.paid"];
    const result = await ensureConnectWebhookEvents("we_1");
    expect(result.added).toEqual([
      "payment_intent.payment_failed",
      "charge.failed",
      "charge.refunded",
      "charge.dispute.created",
      "charge.dispute.closed",
    ]);
    expect(result.alreadyPresent).toContain("account.updated");
    // a POST update was issued
    expect(captured.some((c) => c.method === "POST")).toBe(true);
  });

  it("R3.4 no-op when all desired events already present", async () => {
    endpointEvents = [...(DESIRED_CONNECT_ENABLED_EVENTS as readonly string[])];
    const result = await ensureConnectWebhookEvents("we_1");
    expect(result.added).toEqual([]);
    // GET only, no POST
    expect(captured.some((c) => c.method === "POST")).toBe(false);
  });

  it("rejects a missing endpointId", async () => {
    await expect(ensureConnectWebhookEvents("")).rejects.toThrow(/endpointId/);
  });
});
