/**
 * ACH return / payment-failure handling for the platform Connect webhook
 * (payment-correctness hardening 2026-06-30).
 *
 * ACH (`us_bank_account`) is DELAYED NOTIFICATION: a charge can succeed at
 * submit, then fail DAYS later when the bank returns it (e.g. R01 insufficient
 * funds) — arriving as `payment_intent.payment_failed` / `charge.failed`. ACH is
 * the Stripe Smart-Retries EXCEPTION: Stripe does NOT auto-retry a bank return,
 * so we must EXPLICITLY mark the installment delinquent and queue our own retry.
 *
 * This service is invoked by the Connect webhook on a failed/returned charge.
 * It:
 *   1. Dedups on the platform webhook event id (idempotent re-delivery).
 *   2. Finds the linked paymentTransactions row by provider intent / charge id.
 *   3. Marks it `failed` (delinquent) and runs markTransactionForRetry (which
 *      classifies soft vs hard and schedules the explicit retry).
 *
 * It NEVER moves money — it only reads a failure event and updates our DB.
 */

import { eq, or } from "drizzle-orm";
import { paymentTransactions, platformWebhookEvents } from "@shared/schema";

// Lazy db + retry-service accessors — importing this module must NOT eagerly
// load server/db.ts (which throws when DATABASE_URL is unset, e.g. in route-unit
// tests that mock other seams; retry-service also imports db at its top). These
// are only touched when a handler actually runs.
async function getDb() {
  const { db } = await import("../db");
  return db;
}
async function getRetryService() {
  return import("./retry-service");
}

/** The robust failure/dispute event set the Connect endpoint must subscribe to. */
export const CONNECT_FAILURE_EVENT_TYPES = [
  "payment_intent.payment_failed",
  "charge.failed",
  "charge.refunded",
  "charge.dispute.created",
  "charge.dispute.closed",
] as const;

export type ConnectFailureEventType = (typeof CONNECT_FAILURE_EVENT_TYPES)[number];

export interface AchFailureResult {
  action:
    | "duplicate" // already processed this event id
    | "txn-marked-failed" // found + marked delinquent + queued retry
    | "txn-not-found" // no matching transaction (e.g. portal one-off, manual)
    | "no-reference"; // event had no usable charge/intent id
  transactionId?: string;
  retryEligible?: boolean;
}

/**
 * Idempotently record a platform webhook event. Returns true if this is the
 * FIRST time we've seen the event id (caller should process), false if a
 * duplicate (caller should skip).
 */
async function claimEvent(eventId: string, eventType: string): Promise<boolean> {
  const db = await getDb();
  const existing = await db
    .select({ id: platformWebhookEvents.id })
    .from(platformWebhookEvents)
    .where(eq(platformWebhookEvents.providerEventId, eventId))
    .limit(1);
  if (existing.length > 0) return false;

  try {
    await db.insert(platformWebhookEvents).values({
      provider: "stripe",
      providerEventId: eventId,
      eventType,
      status: "received",
    });
    return true;
  } catch {
    // Unique-constraint race — another delivery claimed it first.
    return false;
  }
}

/**
 * Handle a failed / returned Connect charge.
 *
 * @param params.eventId    the Stripe event id (for dedup)
 * @param params.eventType  one of CONNECT_FAILURE_EVENT_TYPES
 * @param params.object     the event data object (payment_intent or charge)
 */
export async function handleAchFailureEvent(params: {
  eventId: string;
  eventType: string;
  object: {
    id?: string;
    payment_intent?: string | null;
    failure_code?: string | null;
    failure_message?: string | null;
    last_payment_error?: { code?: string; message?: string } | null;
  } | undefined;
}): Promise<AchFailureResult> {
  const db = await getDb();
  const claimed = await claimEvent(params.eventId, params.eventType);
  if (!claimed) {
    return { action: "duplicate" };
  }

  const obj = params.object ?? {};
  // The intent id (`pi_…`) is the most reliable link; charge events also carry
  // `payment_intent`. The charge id (`ch_…`) is the fallback.
  const intentId =
    typeof obj.payment_intent === "string"
      ? obj.payment_intent
      : typeof obj.id === "string" && obj.id.startsWith("pi_")
        ? obj.id
        : null;
  const chargeId = typeof obj.id === "string" && obj.id.startsWith("ch_") ? obj.id : null;

  if (!intentId && !chargeId) {
    await markEventProcessed(params.eventId, "no-reference");
    return { action: "no-reference" };
  }

  // Find the linked transaction by intent or charge id.
  const conditions = [];
  if (intentId) conditions.push(eq(paymentTransactions.providerIntentId, intentId));
  if (chargeId) conditions.push(eq(paymentTransactions.providerPaymentId, chargeId));
  const [txn] = await db
    .select()
    .from(paymentTransactions)
    .where(conditions.length === 1 ? conditions[0] : or(...conditions))
    .limit(1);

  if (!txn) {
    await markEventProcessed(params.eventId, "txn-not-found");
    return { action: "txn-not-found" };
  }

  const failureCode =
    obj.failure_code ?? obj.last_payment_error?.code ?? "ach_return";
  const failureReason =
    obj.failure_message ?? obj.last_payment_error?.message ?? "ACH charge returned/failed";

  // Mark the transaction failed (delinquent) — the explicit ACH-return path.
  await db
    .update(paymentTransactions)
    .set({
      status: "failed",
      failureCode,
      failureReason,
      failedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(paymentTransactions.id, txn.id));

  // Queue the explicit retry / dunning per the association's delinquency
  // settings (soft codes like insufficient_funds → retry; hard → not eligible).
  const { getDelinquencySettings, markTransactionForRetry } = await getRetryService();
  const settings = await getDelinquencySettings(txn.associationId);
  await markTransactionForRetry(txn.id, failureCode, failureReason, settings);

  // Re-read retry eligibility for the result.
  const [updated] = await db
    .select({ retryEligible: paymentTransactions.retryEligible })
    .from(paymentTransactions)
    .where(eq(paymentTransactions.id, txn.id))
    .limit(1);

  await markEventProcessed(params.eventId, "txn-marked-failed");
  return {
    action: "txn-marked-failed",
    transactionId: txn.id,
    retryEligible: (updated?.retryEligible ?? 0) === 1,
  };
}

async function markEventProcessed(eventId: string, action: string): Promise<void> {
  const db = await getDb();
  await db
    .update(platformWebhookEvents)
    .set({ status: "processed", processedAt: new Date(), errorMessage: action })
    .where(eq(platformWebhookEvents.providerEventId, eventId));
}
