/**
 * ACH-failure / dunning handler tests (payment-correctness hardening 2026-06-30).
 *
 * R3.2 — a failed-charge event for a known intent marks the txn failed + queues
 *        the explicit retry (markTransactionForRetry invoked).
 * R3.3 — idempotent on the provider event id (re-delivery → "duplicate").
 * R3.4 — the desired enabled-events list contains the 5 failure/dispute events;
 *        ensureConnectWebhookEvents adds only the missing ones.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── In-memory state for db mock ────────────────────────────────────────────────
type Txn = {
  id: string;
  associationId: string;
  providerIntentId: string | null;
  providerPaymentId: string | null;
  status: string;
  retryEligible: number;
};
let txns: Txn[] = [];
let seenEventIds = new Set<string>();
let retryCalls: Array<{ id: string; code: string }> = [];

// Capture which txn was updated to "failed".
let updatedStatuses: Record<string, string> = {};

vi.mock("../../db", () => {
  // Minimal drizzle-shaped chains used by ach-failure-service.
  const selectImpl = (cols: any) => {
    const state: { table?: string; pred?: (r: any) => boolean } = {};
    const chain: any = {
      from: (t: any) => {
        state.table = t.__name;
        return chain;
      },
      where: (p: any) => {
        state.pred = p;
        return chain;
      },
      limit: (_n: number) => {
        if (state.table === "platform_webhook_events") {
          // event dedup select
          const found = Array.from(seenEventIds).filter((id) => state.pred?.({ providerEventId: id }));
          return Promise.resolve(found.length ? [{ id: "ev-row" }] : []);
        }
        if (state.table === "payment_transactions") {
          const out = txns.filter((t) => state.pred?.(t));
          // when selecting retryEligible only, map shape
          if (cols && cols.retryEligible) {
            return Promise.resolve(out.map((t) => ({ retryEligible: t.retryEligible })));
          }
          return Promise.resolve(out);
        }
        return Promise.resolve([]);
      },
    };
    return chain;
  };
  return {
    db: {
      select: (cols?: any) => selectImpl(cols),
      insert: (t: any) => ({
        values: (vals: any) => {
          if (t.__name === "platform_webhook_events") {
            seenEventIds.add(vals.providerEventId);
          }
          return Promise.resolve();
        },
      }),
      update: (t: any) => ({
        set: (vals: any) => ({
          where: (pred: any) => {
            if (t.__name === "payment_transactions") {
              for (const txn of txns) {
                if (pred(txn)) {
                  if (vals.status) {
                    txn.status = vals.status;
                    updatedStatuses[txn.id] = vals.status;
                  }
                }
              }
            }
            return Promise.resolve();
          },
        }),
      }),
    },
  };
});

// Schema tables — tag with __name so the db mock can route.
vi.mock("@shared/schema", () => ({
  paymentTransactions: {
    __name: "payment_transactions",
    providerIntentId: { __col: "providerIntentId" },
    providerPaymentId: { __col: "providerPaymentId" },
    id: { __col: "id" },
    retryEligible: { __col: "retryEligible" },
  },
  platformWebhookEvents: {
    __name: "platform_webhook_events",
    providerEventId: { __col: "providerEventId" },
  },
}));

// drizzle eq/or — return predicates that read the tagged column.
vi.mock("drizzle-orm", () => ({
  eq: (col: any, val: any) => (row: any) => row[col.__col] === val,
  or: (...preds: any[]) => (row: any) => preds.some((p) => p(row)),
}));

// retry-service — observe markTransactionForRetry + set eligibility.
vi.mock("../retry-service", () => ({
  getDelinquencySettings: vi.fn(async () => ({ maxRetryAttempts: 3, retryScheduleJson: [3, 7, 14] })),
  markTransactionForRetry: vi.fn(async (id: string, code: string) => {
    retryCalls.push({ id, code });
    // soft code → eligible
    const soft = ["insufficient_funds", "ach_return"].includes(code);
    const txn = txns.find((t) => t.id === id);
    if (txn) txn.retryEligible = soft ? 1 : 0;
  }),
}));

import { handleAchFailureEvent, CONNECT_FAILURE_EVENT_TYPES } from "../ach-failure-service";

beforeEach(() => {
  txns = [
    {
      id: "txn-1",
      associationId: "a1",
      providerIntentId: "pi_known",
      providerPaymentId: null,
      status: "succeeded",
      retryEligible: 0,
    },
  ];
  seenEventIds = new Set();
  retryCalls = [];
  updatedStatuses = {};
});
afterEach(() => vi.clearAllMocks());

describe("handleAchFailureEvent", () => {
  it("R3.2 marks the linked txn failed + queues retry (soft code → eligible)", async () => {
    const result = await handleAchFailureEvent({
      eventId: "evt_1",
      eventType: "payment_intent.payment_failed",
      object: { id: "pi_known", failure_code: "insufficient_funds", failure_message: "R01" },
    });
    expect(result.action).toBe("txn-marked-failed");
    expect(result.transactionId).toBe("txn-1");
    expect(updatedStatuses["txn-1"]).toBe("failed");
    expect(retryCalls).toHaveLength(1);
    expect(retryCalls[0].code).toBe("insufficient_funds");
    expect(result.retryEligible).toBe(true);
  });

  it("R3.2 links a charge.failed by payment_intent reference", async () => {
    const result = await handleAchFailureEvent({
      eventId: "evt_2",
      eventType: "charge.failed",
      object: { id: "ch_x", payment_intent: "pi_known", failure_code: "insufficient_funds" },
    });
    expect(result.action).toBe("txn-marked-failed");
    expect(result.transactionId).toBe("txn-1");
  });

  it("R3.3 idempotent — re-delivery of the same event id is a duplicate", async () => {
    await handleAchFailureEvent({
      eventId: "evt_dup",
      eventType: "payment_intent.payment_failed",
      object: { id: "pi_known", failure_code: "insufficient_funds" },
    });
    retryCalls = [];
    const second = await handleAchFailureEvent({
      eventId: "evt_dup",
      eventType: "payment_intent.payment_failed",
      object: { id: "pi_known", failure_code: "insufficient_funds" },
    });
    expect(second.action).toBe("duplicate");
    expect(retryCalls).toHaveLength(0);
  });

  it("returns txn-not-found when no transaction matches", async () => {
    const result = await handleAchFailureEvent({
      eventId: "evt_3",
      eventType: "payment_intent.payment_failed",
      object: { id: "pi_unknown", failure_code: "insufficient_funds" },
    });
    expect(result.action).toBe("txn-not-found");
    expect(retryCalls).toHaveLength(0);
  });

  it("returns no-reference when the event has no usable id", async () => {
    const result = await handleAchFailureEvent({
      eventId: "evt_4",
      eventType: "charge.failed",
      object: {},
    });
    expect(result.action).toBe("no-reference");
  });

  it("R3.1 the failure/dispute event set is the documented 5", () => {
    expect(CONNECT_FAILURE_EVENT_TYPES).toEqual([
      "payment_intent.payment_failed",
      "charge.failed",
      "charge.refunded",
      "charge.dispute.created",
      "charge.dispute.closed",
    ]);
  });
});
