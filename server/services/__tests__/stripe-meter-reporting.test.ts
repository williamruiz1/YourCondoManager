/**
 * stripe-meter-reporting.test.ts — Stripe Billing-Meter usage reporting.
 *
 * Verifies the gap-closing behavior for metered (per-unit / per-door) subscriptions:
 *   1. the correct meter event_name is resolved per tier (matches the migration
 *      scripts' findOrCreateMeter event_names: ycm_sm_units_<planKey> /
 *      ycm_pm_doors_<planKey>);
 *   2. a meter event reports the RIGHT unit/door COUNT as payload[value] against the
 *      right customer + event_name;
 *   3. double-billing is structurally prevented on the SUM meters — the same
 *      (subscription, period) snapshot always produces the SAME deterministic
 *      identifier (Stripe dedups), and a forced re-report (count changed) produces a
 *      DISTINCT identifier so it is not silently deduped away.
 *
 * Pure / injected-POST only — no DB, no live key, no network.
 */

import { describe, it, expect, vi } from "vitest";

import {
  resolveMeterEventName,
  buildMeterEventIdentifier,
  reportMeterEvent,
  type MeterPoster,
} from "../stripe-meter-reporting";

describe("resolveMeterEventName", () => {
  it("maps self-managed tiers to ycm_sm_units_<planKey> (matches the SM migration meter)", () => {
    expect(resolveMeterEventName("self_managed", "mid_community")).toBe("ycm_sm_units_mid_community");
    expect(resolveMeterEventName("self_managed", "large_community")).toBe("ycm_sm_units_large_community");
  });

  it("maps property-manager tiers to ycm_pm_doors_<planKey> (matches the PM migration meter)", () => {
    expect(resolveMeterEventName("property_manager", "pm_starter")).toBe("ycm_pm_doors_pm_starter");
    expect(resolveMeterEventName("property_manager", "pm_growth")).toBe("ycm_pm_doors_pm_growth");
    expect(resolveMeterEventName("property_manager", "pm_scale")).toBe("ycm_pm_doors_pm_scale");
  });

  it("throws on a missing planKey rather than emitting a malformed event_name", () => {
    expect(() => resolveMeterEventName("self_managed", "")).toThrow();
  });
});

describe("buildMeterEventIdentifier — double-bill guard on SUM meters", () => {
  it("is deterministic for the same (subscription, period) → Stripe dedups a retry", () => {
    const a = buildMeterEventIdentifier("sub_123", 1780500000);
    const b = buildMeterEventIdentifier("sub_123", 1780500000);
    expect(a).toBe(b);
  });

  it("differs across periods so each period's snapshot is reported once", () => {
    const p1 = buildMeterEventIdentifier("sub_123", 1780500000);
    const p2 = buildMeterEventIdentifier("sub_123", 1783100000);
    expect(p1).not.toBe(p2);
  });

  it("a forced mid-period re-report (count changed) yields a DISTINCT identifier", () => {
    const base = buildMeterEventIdentifier("sub_123", 1780500000);
    const forced = buildMeterEventIdentifier("sub_123", 1780500000, 42);
    expect(forced).not.toBe(base);
  });

  it("never exceeds Stripe's 100-char identifier limit", () => {
    const id = buildMeterEventIdentifier("sub_aVeryLongStripeSubscriptionIdentifierThatGoesOnAndOnAndOn", 1780500000, 999999);
    expect(id.length).toBeLessThanOrEqual(100);
  });
});

describe("reportMeterEvent — reports the right count to Stripe", () => {
  it("POSTs the resolved unit count as payload[value] for a self-managed Mid community", async () => {
    const calls: Array<{ path: string; body: Record<string, string> }> = [];
    const post: MeterPoster = vi.fn(async (path, body) => {
      calls.push({ path, body: Object.fromEntries(body.entries()) });
      return { identifier: body.get("identifier"), object: "billing.meter_event" };
    });

    // A 60-unit Mid Community self-managed subscription.
    const eventName = resolveMeterEventName("self_managed", "mid_community");
    const identifier = buildMeterEventIdentifier("sub_sm_1", 1780500000);
    await reportMeterEvent({
      post,
      eventName,
      stripeCustomerId: "cus_sm_1",
      value: 60,
      identifier,
    });

    expect(post).toHaveBeenCalledTimes(1);
    expect(calls[0].path).toBe("/billing/meter_events");
    expect(calls[0].body.event_name).toBe("ycm_sm_units_mid_community");
    expect(calls[0].body["payload[stripe_customer_id]"]).toBe("cus_sm_1");
    // The billed quantity = the community's unit count.
    expect(calls[0].body["payload[value]"]).toBe("60");
    expect(calls[0].body.identifier).toBe(identifier);
  });

  it("POSTs the resolved total-door count for a property-manager portfolio", async () => {
    const calls: Array<Record<string, string>> = [];
    const post: MeterPoster = vi.fn(async (_path, body) => {
      calls.push(Object.fromEntries(body.entries()));
      return {};
    });

    // A PM Starter portfolio with 320 total doors.
    await reportMeterEvent({
      post,
      eventName: resolveMeterEventName("property_manager", "pm_starter"),
      stripeCustomerId: "cus_pm_1",
      value: 320,
      identifier: buildMeterEventIdentifier("sub_pm_1", 1780500000),
    });

    expect(calls[0].event_name).toBe("ycm_pm_doors_pm_starter");
    expect(calls[0]["payload[value]"]).toBe("320");
    expect(calls[0]["payload[stripe_customer_id]"]).toBe("cus_pm_1");
  });

  it("rejects a negative / non-finite value (never reports garbage to a live meter)", async () => {
    const post: MeterPoster = vi.fn(async () => ({}));
    await expect(
      reportMeterEvent({ post, eventName: "ycm_sm_units_mid_community", stripeCustomerId: "cus_x", value: -1, identifier: "id" }),
    ).rejects.toThrow();
    expect(post).not.toHaveBeenCalled();
  });

  it("requires a customer id (a meter event without a customer cannot be billed)", async () => {
    const post: MeterPoster = vi.fn(async () => ({}));
    await expect(
      reportMeterEvent({ post, eventName: "ycm_sm_units_mid_community", stripeCustomerId: "", value: 10, identifier: "id" }),
    ).rejects.toThrow();
    expect(post).not.toHaveBeenCalled();
  });
});
