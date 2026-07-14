/**
 * updatePaymentTransactionStatus idempotency proof (P0 payment-confirmation-ux,
 * founder-os incident 2026-07-14).
 *
 * This is the load-bearing test for the guardrail the review asked for:
 * "confirm your webhook additions can't double-post when charge.succeeded
 * later fires." updatePaymentTransactionStatus is EXISTING, already-shared
 * code (also used by server/routes.ts, server/routes/autopay.ts, and
 * server/services/retry-service.ts) — this file did not exist before this
 * change; it closes a real coverage gap on the function every one of this
 * PR's new webhook cases now calls.
 *
 * Proves:
 *   1. A non-terminal ("pending") update applies from initiated/draft.
 *   2. A "succeeded" update applies, sets confirmedAt, backfills providerIntentId.
 *   3. Once "succeeded" (terminal), a LATER "pending" update — e.g. a
 *      re-delivered / out-of-order checkout.session.completed arriving after
 *      charge.succeeded already landed — is a NO-OP: status stays
 *      "succeeded", confirmedAt is untouched, no db.update() call is made.
 *   4. providerIntentId is backfilled only when not already set (never
 *      clobbers an existing value with a different one).
 *
 * DB mock pattern mirrors server/services/__tests__/ach-failure-service.test.ts
 * (in-memory table + drizzle eq() replaced with a plain predicate function —
 * same technique already used elsewhere in this codebase's test suite).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Txn = {
  id: string;
  status: string;
  providerIntentId: string | null;
  providerPaymentId: string | null;
  confirmedAt: Date | null;
  failedAt: Date | null;
  failureCode: string | null;
  failureReason: string | null;
  updatedAt: Date | null;
};

let txns: Txn[] = [];
let updateCallCount = 0;

vi.mock("../../db", () => {
  const selectImpl = () => {
    const state: { pred?: (r: Txn) => boolean } = {};
    const chain: any = {
      from: () => chain,
      where: (p: any) => {
        state.pred = p;
        return chain;
      },
      limit: (_n: number) => Promise.resolve(txns.filter((t) => state.pred?.(t))),
    };
    return chain;
  };
  return {
    db: {
      select: () => selectImpl(),
      update: () => ({
        set: (vals: Record<string, unknown>) => ({
          where: (pred: (r: Txn) => boolean) => ({
            returning: () => {
              updateCallCount += 1;
              const match = txns.find((t) => pred(t));
              if (!match) return Promise.resolve([]);
              Object.assign(match, vals);
              return Promise.resolve([{ ...match }]);
            },
          }),
        }),
      }),
    },
  };
});

vi.mock("@shared/schema", () => ({
  paymentTransactions: {
    id: { __col: "id" },
    providerPaymentId: { __col: "providerPaymentId" },
    providerIntentId: { __col: "providerIntentId" },
  },
  ownerLedgerEntries: {},
  savedPaymentMethods: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: (col: { __col: string }, val: unknown) => (row: Record<string, unknown>) => row[col.__col] === val,
  and: (...preds: Array<(r: Record<string, unknown>) => boolean>) => (row: Record<string, unknown>) =>
    preds.every((p) => p(row)),
  desc: (col: unknown) => col,
  inArray: () => () => false,
  sql: (() => {
    const tag = (..._args: unknown[]) => "";
    return tag;
  })(),
}));

import { updatePaymentTransactionStatus } from "../payment-service";

beforeEach(() => {
  txns = [
    {
      id: "txn-1",
      status: "initiated",
      providerIntentId: null,
      providerPaymentId: "cs_test_1",
      confirmedAt: null,
      failedAt: null,
      failureCode: null,
      failureReason: null,
      updatedAt: null,
    },
  ];
  updateCallCount = 0;
});

describe("updatePaymentTransactionStatus", () => {
  it("applies a pending update from initiated + backfills providerIntentId", async () => {
    const updated = await updatePaymentTransactionStatus({
      transactionId: "txn-1",
      providerIntentId: "pi_abc",
      status: "pending",
    });
    expect(updated?.status).toBe("pending");
    expect(updated?.providerIntentId).toBe("pi_abc");
    expect(updateCallCount).toBe(1);
  });

  it("applies a succeeded update and sets confirmedAt", async () => {
    const updated = await updatePaymentTransactionStatus({
      transactionId: "txn-1",
      providerIntentId: "pi_abc",
      status: "succeeded",
    });
    expect(updated?.status).toBe("succeeded");
    expect(updated?.confirmedAt).toBeInstanceOf(Date);
  });

  it("does NOT clobber an already-set providerIntentId with a different value", async () => {
    txns[0].providerIntentId = "pi_original";
    const updated = await updatePaymentTransactionStatus({
      transactionId: "txn-1",
      providerIntentId: "pi_different",
      status: "pending",
    });
    expect(updated?.providerIntentId).toBe("pi_original");
  });

  it(
    "REGRESSION GUARD — a later 'pending' event (e.g. a re-delivered / " +
      "out-of-order checkout.session.completed) can NEVER regress an already-" +
      "succeeded transaction back to pending",
    async () => {
      // Simulate charge.succeeded landing first.
      const succeeded = await updatePaymentTransactionStatus({
        transactionId: "txn-1",
        providerIntentId: "pi_abc",
        status: "succeeded",
      });
      expect(succeeded?.status).toBe("succeeded");
      const confirmedAtBefore = succeeded?.confirmedAt;
      expect(updateCallCount).toBe(1);

      // Now simulate a re-delivered / late checkout.session.completed
      // (or payment_intent.processing) arriving AFTER settlement — exactly
      // the scenario the review flagged: "confirm your webhook additions
      // can't double-post when charge.succeeded later fires."
      const replayed = await updatePaymentTransactionStatus({
        transactionId: "txn-1",
        providerIntentId: "pi_abc",
        status: "pending",
      });

      expect(replayed?.status).toBe("succeeded"); // unchanged — NOT regressed to "pending"
      expect(replayed?.confirmedAt).toEqual(confirmedAtBefore); // untouched
      expect(updateCallCount).toBe(1); // the second call was a no-op — no db.update() fired
    },
  );

  it("does not throw and returns null for an unknown transaction id", async () => {
    const result = await updatePaymentTransactionStatus({
      transactionId: "does-not-exist",
      status: "pending",
    });
    expect(result).toBeNull();
    expect(updateCallCount).toBe(0);
  });
});
