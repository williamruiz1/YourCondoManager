/**
 * Issue #448 — Plaid bank-tx ↔ owner-ledger reconciliation tests.
 *
 * Strategy: mock the `db` module to return deterministic arrays for the two
 * select() queries (bank_transactions, owner_ledger_entries) and capture
 * update() invocations to assert the match-apply behavior. The reconciliation
 * service is pure logic over those inputs, so this exercises the matcher
 * end-to-end without a Postgres dependency.
 *
 * Acceptance criteria coverage (Issue #448):
 *   1. exact match           → applies, sets bank_transaction_id + settled_at
 *   2. near-amount no match  → off by >$1 in auto-pass leaves both unmatched
 *   3. outside date window   → >3 days delta leaves both unmatched
 *   4. tenant isolation      → cross-association credit/entry never matches
 *   5. idempotency           → already-settled rows excluded by select filter
 *   6. manual override       → manualMatchBankTransaction within ±$1 tolerance
 *
 * Plus: best-candidate selection by smallest |dateDelta| (tie-break by createdAt).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

type Credit = {
  id: string;
  associationId: string;
  amountCents: number; // negative = credit per Plaid convention normalization
  date: Date;
  reconciledToPaymentTransactionId: string | null;
};

type LedgerEntry = {
  id: string;
  associationId: string;
  amount: number; // negative for payment entries
  referenceType: string | null;
  bankTransactionId: string | null;
  settledAt: Date | null;
  createdAt: Date;
  postedAt: Date;
  description?: string | null;
};

type UpdateCall = {
  ledgerEntryId: string;
  associationId: string;
  bankTransactionId: string;
  settledAtIso: string;
};

// Shared mutable state — vi.hoisted so vi.mock factories below can read it
// (vi.mock factories are hoisted to module top; without hoisted() they cannot
// see file-scope `const` declarations).
const state = vi.hoisted(() => ({
  credits: [] as Array<{
    id: string;
    associationId: string;
    amountCents: number;
    date: Date;
    reconciledToPaymentTransactionId: string | null;
  }>,
  entries: [] as Array<{
    id: string;
    associationId: string;
    amount: number;
    referenceType: string | null;
    bankTransactionId: string | null;
    settledAt: Date | null;
    createdAt: Date;
    postedAt: Date;
    description?: string | null;
  }>,
  updates: [] as UpdateCall[],
}));

vi.mock("../server/db", () => {
  let pendingTableRef: "credits" | "entries" = "credits";
  let pendingWhereFilters: Array<(row: any) => boolean> = [];
  let pendingLimit: number | null = null;

  const fakeDb = {
    select: (_columns?: unknown) => ({
      from: (tableRef: any) => {
        pendingTableRef =
          tableRef.__testTableId === "bank_transactions" ? "credits" : "entries";
        pendingWhereFilters = [];
        pendingLimit = null;
        const exec = () => {
          const rows = pendingTableRef === "credits" ? state.credits : state.entries;
          const filtered = rows.filter((r: any) =>
            pendingWhereFilters.every((f) => f(r)),
          );
          return pendingLimit != null ? filtered.slice(0, pendingLimit) : filtered;
        };
        const chain: any = {
          where: (filter: (row: any) => boolean) => {
            pendingWhereFilters.push(filter);
            return chain;
          },
          orderBy: (_o: unknown) => Promise.resolve(exec()),
          limit: (n: number) => {
            pendingLimit = n;
            return Promise.resolve(exec());
          },
          then: (resolve: (v: any) => any, reject?: (e: any) => any) =>
            Promise.resolve(exec()).then(resolve, reject),
        };
        return chain;
      },
    }),
    update: (table: any) => ({
      set: (patch: any) => ({
        where: (filter: (row: any) => boolean) => {
          const isCredit = table?.__testTableId === "bank_transactions";
          if (isCredit) {
            // A-RECON-004: the bank-credit consumed marker.
            for (const c of state.credits.filter(filter)) {
              if ("reconciledToPaymentTransactionId" in patch) {
                c.reconciledToPaymentTransactionId = patch.reconciledToPaymentTransactionId;
              }
            }
          } else {
            for (const t of state.entries.filter(filter)) {
              state.updates.push({
                ledgerEntryId: t.id,
                associationId: t.associationId,
                bankTransactionId: patch.bankTransactionId,
                settledAtIso: patch.settledAt.toISOString(),
              });
              t.bankTransactionId = patch.bankTransactionId;
              t.settledAt = patch.settledAt;
            }
          }
          return Promise.resolve();
        },
      }),
    }),
    // applyMatch writes both sides atomically (A-RECON-004). The mock runs the
    // callback with the same fakeDb (no real rollback — the required "zero partial
    // rows after DB failure" rollback proof needs a transactional DB; see the PR note).
    transaction: async (cb: (tx: any) => Promise<void>) => {
      await cb(fakeDb);
    },
  };

  return { db: fakeDb };
});

vi.mock("drizzle-orm", async (orig) => {
  const original = (await orig()) as Record<string, unknown>;
  return {
    ...original,
    eq: (col: any, value: any) => (row: any) => row[col.__testCol] === value,
    isNull: (col: any) => (row: any) =>
      row[col.__testCol] === null || row[col.__testCol] === undefined,
    and: (...preds: Array<(r: any) => boolean>) => (row: any) =>
      preds.every((p) => p(row)),
    asc: (_col: any) => null,
    desc: (_col: any) => null,
  };
});

vi.mock("@shared/schema", () => {
  const col = (name: string) => ({ __testCol: name });
  return {
    bankTransactions: {
      __testTableId: "bank_transactions",
      id: col("id"),
      associationId: col("associationId"),
      reconciledToPaymentTransactionId: col("reconciledToPaymentTransactionId"),
      date: col("date"),
    },
    ownerLedgerEntries: {
      __testTableId: "owner_ledger_entries",
      id: col("id"),
      associationId: col("associationId"),
      referenceType: col("referenceType"),
      settledAt: col("settledAt"),
      bankTransactionId: col("bankTransactionId"),
      amount: col("amount"),
      description: col("description"),
      createdAt: col("createdAt"),
    },
  };
});

import {
  reconcileBankTransactions,
  manualMatchBankTransaction,
  listPendingReconciliation,
} from "../server/services/plaid-reconciliation";

const ASSOC_A = "assoc-A";
const ASSOC_B = "assoc-B";

function credit(over: Partial<Credit>): Credit {
  return {
    id: over.id ?? "btx-1",
    associationId: over.associationId ?? ASSOC_A,
    amountCents: over.amountCents ?? -25000, // $250 inflow
    date: over.date ?? new Date("2026-05-10"),
    reconciledToPaymentTransactionId: over.reconciledToPaymentTransactionId ?? null,
  };
}

function entry(over: Partial<LedgerEntry>): LedgerEntry {
  return {
    id: over.id ?? "ole-1",
    associationId: over.associationId ?? ASSOC_A,
    amount: over.amount ?? -250, // payment intent, negative per pay-intent convention
    referenceType: over.referenceType ?? "plaid-pay-intent",
    bankTransactionId: over.bankTransactionId ?? null,
    settledAt: over.settledAt ?? null,
    createdAt: over.createdAt ?? new Date("2026-05-10"),
    postedAt: over.postedAt ?? new Date("2026-05-10"),
    description: over.description ?? null,
  };
}

beforeEach(() => {
  state.credits = [];
  state.entries = [];
  state.updates = [];
});

describe("Issue #448 — Plaid bank-tx reconciliation", () => {
  it("auto-matches exact-amount + same-day credit and entry", async () => {
    state.credits = [credit({ id: "btx-A", amountCents: -25000, date: new Date("2026-05-10") })];
    state.entries = [entry({ id: "ole-A", amount: -250, createdAt: new Date("2026-05-10") })];

    const r = await reconcileBankTransactions(ASSOC_A);

    expect(r.matched).toHaveLength(1);
    expect(r.matched[0]).toMatchObject({
      bankTransactionId: "btx-A",
      ledgerEntryId: "ole-A",
      amountCents: 25000,
      dateDeltaDays: 0,
    });
    expect(state.updates).toHaveLength(1);
    expect(state.updates[0].bankTransactionId).toBe("btx-A");
    expect(state.updates[0].ledgerEntryId).toBe("ole-A");
    expect(r.unmatchedCreditIds).toHaveLength(0);
    expect(r.unmatchedLedgerEntryIds).toHaveLength(0);
  });

  it("does not auto-match when amounts differ by more than zero cents", async () => {
    state.credits = [credit({ id: "btx-A", amountCents: -25001 })]; // $250.01
    state.entries = [entry({ id: "ole-A", amount: -250 })]; // $250.00

    const r = await reconcileBankTransactions(ASSOC_A);

    expect(r.matched).toHaveLength(0);
    expect(state.updates).toHaveLength(0);
    expect(r.unmatchedCreditIds).toEqual(["btx-A"]);
    expect(r.unmatchedLedgerEntryIds).toEqual(["ole-A"]);
  });

  it("does not auto-match when date delta exceeds 3 days", async () => {
    state.credits = [credit({ id: "btx-A", date: new Date("2026-05-10") })];
    state.entries = [entry({ id: "ole-A", createdAt: new Date("2026-05-05") })]; // 5 days earlier

    const r = await reconcileBankTransactions(ASSOC_A);

    expect(r.matched).toHaveLength(0);
    expect(state.updates).toHaveLength(0);
  });

  it("enforces tenant isolation — never cross-association matches", async () => {
    state.credits = [credit({ id: "btx-A", associationId: ASSOC_A })];
    state.entries = [entry({ id: "ole-B", associationId: ASSOC_B })];

    const rA = await reconcileBankTransactions(ASSOC_A);
    expect(rA.matched).toHaveLength(0);
    expect(rA.unmatchedLedgerEntryIds).toHaveLength(0); // entry-B not visible from assoc-A

    const rB = await reconcileBankTransactions(ASSOC_B);
    expect(rB.matched).toHaveLength(0);
    expect(rB.unmatchedCreditIds).toHaveLength(0); // credit-A not visible from assoc-B
  });

  it("is idempotent — already-settled entries are not re-matched", async () => {
    state.credits = [credit({ id: "btx-A" })];
    state.entries = [
      entry({
        id: "ole-A",
        settledAt: new Date("2026-05-09"),
        bankTransactionId: "btx-OLD",
      }),
    ];

    const r = await reconcileBankTransactions(ASSOC_A);

    expect(r.matched).toHaveLength(0);
    expect(state.updates).toHaveLength(0);
    // Already-settled entry is excluded by select filter → not in unmatched either
    expect(r.unmatchedLedgerEntryIds).toHaveLength(0);
  });

  it("manualMatchBankTransaction succeeds within $1 tolerance", async () => {
    state.credits = [credit({ id: "btx-A", amountCents: -25055 })]; // $250.55
    state.entries = [entry({ id: "ole-A", amount: -250 })]; // $250.00 — within $1

    const r = await manualMatchBankTransaction({
      associationId: ASSOC_A,
      bankTransactionId: "btx-A",
      ledgerEntryId: "ole-A",
    });

    expect(r.ok).toBe(true);
    expect(state.updates).toHaveLength(1);
    expect(state.updates[0].ledgerEntryId).toBe("ole-A");
  });

  it("manualMatchBankTransaction rejects outside-$1 tolerance", async () => {
    state.credits = [credit({ id: "btx-A", amountCents: -27500 })]; // $275
    state.entries = [entry({ id: "ole-A", amount: -250 })]; // $250 — $25 off

    const r = await manualMatchBankTransaction({
      associationId: ASSOC_A,
      bankTransactionId: "btx-A",
      ledgerEntryId: "ole-A",
    });

    expect(r.ok).toBe(false);
    if (r.ok === false) {
      expect(r.code).toBe("AMOUNT_OUT_OF_TOLERANCE");
    }
    expect(state.updates).toHaveLength(0);
  });

  it("manualMatchBankTransaction enforces tenant isolation", async () => {
    state.credits = [credit({ id: "btx-A", associationId: ASSOC_A })];
    state.entries = [entry({ id: "ole-B", associationId: ASSOC_B })];

    // Try to cross-pair through ASSOC_A's scope
    const r = await manualMatchBankTransaction({
      associationId: ASSOC_A,
      bankTransactionId: "btx-A",
      ledgerEntryId: "ole-B",
    });

    expect(r.ok).toBe(false);
    if (r.ok === false) {
      expect(r.code).toBe("LEDGER_ENTRY_UNAVAILABLE");
    }
    expect(state.updates).toHaveLength(0);
  });

  it("listPendingReconciliation returns unmatched credits with ±$1 candidates", async () => {
    state.credits = [credit({ id: "btx-1", amountCents: -25000 })];
    state.entries = [
      entry({ id: "ole-close", amount: -250.5 }),    // within $1 — candidate
      entry({ id: "ole-far",   amount: -300 }),       // outside $1 — not a candidate
      entry({ id: "ole-exact", amount: -250 }),       // within $1 — candidate
    ];

    const pending = await listPendingReconciliation(ASSOC_A);

    expect(pending.unmatchedCredits).toHaveLength(1);
    expect(pending.unmatchedCredits[0].candidates.map((c) => c.id).sort()).toEqual([
      "ole-close",
      "ole-exact",
    ]);
    expect(pending.pendingEntryCount).toBe(3);
  });

  it("greedy matcher picks the smallest-date-delta candidate", async () => {
    state.credits = [credit({ id: "btx-A", date: new Date("2026-05-10") })];
    state.entries = [
      entry({ id: "ole-far",   createdAt: new Date("2026-05-08") }), // delta 2
      entry({ id: "ole-close", createdAt: new Date("2026-05-09") }), // delta 1 ← winner
    ];

    const r = await reconcileBankTransactions(ASSOC_A);

    expect(r.matched).toHaveLength(1);
    expect(r.matched[0].ledgerEntryId).toBe("ole-close");
    // The other one remains unmatched
    expect(r.unmatchedLedgerEntryIds).toEqual(["ole-far"]);
  });

  it("a debit (positive amountCents) never matches as a credit", async () => {
    state.credits = [credit({ id: "btx-A", amountCents: 25000 })]; // POSITIVE = debit
    state.entries = [entry({ id: "ole-A", amount: -250 })];

    const r = await reconcileBankTransactions(ASSOC_A);

    expect(r.matched).toHaveLength(0);
    expect(r.unmatchedCreditIds).toHaveLength(0); // not a credit at all
  });

  it("bank credits already linked to a payment_transaction are excluded", async () => {
    state.credits = [
      credit({ id: "btx-already", reconciledToPaymentTransactionId: "pt-X" }),
    ];
    state.entries = [entry({ id: "ole-A" })];

    const r = await reconcileBankTransactions(ASSOC_A);

    expect(r.matched).toHaveLength(0);
    expect(state.updates).toHaveLength(0);
  });
});

describe("A-RECON-004 (founder-os#10753) — a matched credit is CONSUMED (no double-settle)", () => {
  it("marks the bank credit consumed (reconciledToPaymentTransactionId) on a match", async () => {
    state.credits = [credit({ id: "btx-A", amountCents: -25000 })];
    state.entries = [entry({ id: "ole-A", amount: -250 })];

    await reconcileBankTransactions(ASSOC_A);

    // The credit is now linked to the ledger entry it settled → excluded from future runs.
    expect(state.credits.find((c) => c.id === "btx-A")?.reconciledToPaymentTransactionId).toBe("ole-A");
  });

  it("a consumed credit is excluded from the next reconcile run", async () => {
    state.credits = [credit({ id: "btx-A", amountCents: -25000 })];
    state.entries = [entry({ id: "ole-A", amount: -250 })];

    await reconcileBankTransactions(ASSOC_A); // consumes btx-A

    // Second run: the credit is already reconciled → not a candidate.
    state.updates = [];
    const r2 = await reconcileBankTransactions(ASSOC_A);
    expect(r2.matched).toHaveLength(0);
    expect(state.updates).toHaveLength(0);
  });

  it("THE BUG: two equal-amount pending entries + one credit → only ONE is ever settled", async () => {
    // Before the fix, run 1 matched the credit to ole-A, run 2 re-fetched the still-
    // "unmatched" credit and settled ole-B too — one deposit paying two intents.
    state.credits = [credit({ id: "btx-A", amountCents: -25000, date: new Date("2026-05-10") })];
    state.entries = [
      entry({ id: "ole-A", amount: -250, createdAt: new Date("2026-05-10") }),
      entry({ id: "ole-B", amount: -250, createdAt: new Date("2026-05-10") }),
    ];

    const r1 = await reconcileBankTransactions(ASSOC_A);
    const r2 = await reconcileBankTransactions(ASSOC_A); // must NOT settle the second entry

    const settled = state.entries.filter((e) => e.bankTransactionId === "btx-A");
    expect(settled).toHaveLength(1); // exactly one entry settled by the single deposit
    expect(r1.matched).toHaveLength(1);
    expect(r2.matched).toHaveLength(0); // credit consumed → no second settlement
  });
});
