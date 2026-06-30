/**
 * Connect webhook event-subscription management
 * (payment-correctness hardening 2026-06-30, item 3).
 *
 * The platform Connect webhook endpoint must subscribe to the robust set of
 * lifecycle + failure/dispute events so ACH returns and disputes are handled.
 * This module is the single source of truth for the desired `enabled_events`
 * and provides an idempotent "ensure" that adds only MISSING events to an
 * existing Stripe Connect webhook endpoint.
 *
 * SAFETY: this only reads + updates the webhook-endpoint config (which events
 * Stripe sends us). It moves no money. The dashboard surfaces it as an explicit
 * admin action; it never runs automatically.
 */

import { callPlatformStripe } from "./stripe-connect";

/**
 * The full set of events the platform Connect endpoint should subscribe to.
 * Lifecycle events (already handled) + the failure/dispute set (item 3).
 */
export const DESIRED_CONNECT_ENABLED_EVENTS = [
  // Lifecycle (already handled in the webhook switch)
  "account.updated",
  "charge.succeeded",
  "payout.paid",
  // Failure / return / dispute set (item 3 — the gap this closes)
  "payment_intent.payment_failed",
  "charge.failed",
  "charge.refunded",
  "charge.dispute.created",
  "charge.dispute.closed",
] as const;

export interface EnsureEventsResult {
  endpointId: string;
  added: string[];
  alreadyPresent: string[];
  finalEvents: string[];
}

/**
 * Idempotently ensure the given Connect webhook endpoint subscribes to all of
 * DESIRED_CONNECT_ENABLED_EVENTS. Adds only the missing ones (union with the
 * endpoint's current set). Returns what changed.
 *
 * @param endpointId  the Stripe webhook endpoint id (`we_…`) for the Connect
 *                    listener (event delivery scoped to connected accounts).
 */
export async function ensureConnectWebhookEvents(
  endpointId: string,
): Promise<EnsureEventsResult> {
  if (!endpointId) throw new Error("endpointId is required");

  const current = await callPlatformStripe<{ id: string; enabled_events?: string[] }>({
    method: "GET",
    path: `/webhook_endpoints/${encodeURIComponent(endpointId)}`,
  });

  const currentSet = new Set(current.enabled_events ?? []);
  const desired = DESIRED_CONNECT_ENABLED_EVENTS as readonly string[];
  const added = desired.filter((e) => !currentSet.has(e));
  const alreadyPresent = desired.filter((e) => currentSet.has(e));

  if (added.length === 0) {
    return {
      endpointId,
      added: [],
      alreadyPresent,
      finalEvents: Array.from(currentSet),
    };
  }

  // Union: keep any events Stripe already had + add the missing desired ones.
  const finalEvents = Array.from(new Set([...currentSet, ...desired]));
  const body = new URLSearchParams();
  finalEvents.forEach((e, i) => body.set(`enabled_events[${i}]`, e));

  const updated = await callPlatformStripe<{ id: string; enabled_events?: string[] }>({
    method: "POST",
    path: `/webhook_endpoints/${encodeURIComponent(endpointId)}`,
    body,
  });

  return {
    endpointId,
    added,
    alreadyPresent,
    finalEvents: updated.enabled_events ?? finalEvents,
  };
}
