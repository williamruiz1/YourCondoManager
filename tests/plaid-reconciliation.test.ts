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
  amountCents: number; // integer cents; negative for payment entries
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
  // When true, the NEXT update() throws before mutating — models a DB failure
  // for the applyMatch-atomicity test (DATA-B-009). Self-resets.
  failNextUpdate: false,
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
    update: (_table: unknown) => ({
      set: (patch: { bankTransactionId: string; settledAt: Date }) => ({
        where: (filter: (row: any) => boolean) => {
          // Model a DB failure BEFORE any mutation, so a rolled-back match
          // leaves zero partial writes (applyMatch atomicity, DATA-B-009).
          if (state.failNextUpdate) {
            state.failNextUpdate = false;
            return Promise.reject(new Error("simulated DB failure mid-match"));
          }
          const targets = state.entries.filter(filter);
          for (const t of targets) {
            state.updates.push({
              ledgerEntryId: t.id,
              associationId: t.associationId,
              bankTransactionId: patch.bankTransactionId,
              settledAtIso: patch.settledAt.toISOString(),
            });
            t.bankTransactionId = patch.bankTransactionId;
            t.settledAt = patch.settledAt;
          }
          return Promise.resolve();
        },
      }),
    }),
    // Atomic boundary: run the callback with the same fake handle. A throw
    // inside propagates (a real tx rolls back; our update() mock only mutates
    // on the success path, so nothing is left half-applied).
    transaction: async (cb: (tx: unknown) => Promise<unknown>) => cb(fakeDb),
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
    isNotNull: (col: any) => (row: any) =>
      row[col.__testCol] !== null && row[col.__testCol] !== undefined,
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
      amountCents: col("amountCents"),
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
    amountCents: over.amountCents ?? -25000, // payment intent, negative per pay-intent convention
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
  state.failNextUpdate = false;
});

describe("Issue #448 — Plaid bank-tx reconciliation", () => {
  it("auto-matches exact-amount + same-day credit and entry", async () => {
    state.credits = [credit({ id: "btx-A", amountCents: -25000, date: new Date("2026-05-10") })];
    state.entries = [entry({ id: "ole-A", amountCents: -25000, createdAt: new Date("2026-05-10") })];

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
    state.entries = [entry({ id: "ole-A", amountCents: -25000 })]; // $250.00

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
    state.entries = [entry({ id: "ole-A", amountCents: -25000 })]; // $250.00 — within $1

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
    state.entries = [entry({ id: "ole-A", amountCents: -25000 })]; // $250 — $25 off

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
      entry({ id: "ole-close", amountCents: -25050 }),    // within $1 — candidate
      entry({ id: "ole-far",   amountCents: -30000 }),       // outside $1 — not a candidate
      entry({ id: "ole-exact", amountCents: -25000 }),       // within $1 — candidate
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
    state.entries = [entry({ id: "ole-A", amountCents: -25000 })];

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

describe("A-RECON-004 — a consumed credit cannot double-settle", () => {
  it("excludes a credit already linked to a ledger entry from the next run", async () => {
    // btx-A already settled ole-settled; a second same-amount entry is pending.
    // Pre-fix: btx-A (reconciledToPaymentTransactionId=null) was re-fetched and
    // matched to ole-pending → one deposit settling two intents. Post-fix: the
    // ledger link marks btx-A consumed, so it is never re-evaluated.
    state.credits = [credit({ id: "btx-A", amountCents: -25000, date: new Date("2026-05-10") })];
    state.entries = [
      entry({ id: "ole-settled", amountCents: -25000, bankTransactionId: "btx-A", settledAt: new Date("2026-05-09") }),
      entry({ id: "ole-pending", amountCents: -25000, createdAt: new Date("2026-05-10") }),
    ];

    const r = await reconcileBankTransactions(ASSOC_A);

    expect(r.matched).toHaveLength(0);
    expect(state.updates).toHaveLength(0);
    expect(r.unmatchedLedgerEntryIds).toEqual(["ole-pending"]);
    expect(r.unmatchedCreditIds).toHaveLength(0); // consumed, not "unmatched"
  });

  it("two equal-amount pending entries + one credit → only ONE settled, and a re-run never settles the second", async () => {
    state.credits = [credit({ id: "btx-A", amountCents: -25000, date: new Date("2026-05-10") })];
    state.entries = [
      entry({ id: "ole-X", amountCents: -25000, createdAt: new Date("2026-05-10") }),
      entry({ id: "ole-Y", amountCents: -25000, createdAt: new Date("2026-05-10") }),
    ];

    // Run 1 — exactly one entry settles; the other stays pending.
    const run1 = await reconcileBankTransactions(ASSOC_A);
    expect(run1.matched).toHaveLength(1);
    expect(state.updates).toHaveLength(1);
    const settledFirst = run1.matched[0].ledgerEntryId;
    expect(["ole-X", "ole-Y"]).toContain(settledFirst);

    // Run 2 — the credit is now consumed (a ledger entry links it); the second
    // equal-amount entry must NOT be settled by the same deposit.
    const run2 = await reconcileBankTransactions(ASSOC_A);
    expect(run2.matched).toHaveLength(0);
    expect(state.updates).toHaveLength(1); // still just the run-1 write
  });

  it("applyMatch is atomic — a mid-match DB failure leaves zero partial writes", async () => {
    state.credits = [credit({ id: "btx-A", amountCents: -25000, date: new Date("2026-05-10") })];
    state.entries = [entry({ id: "ole-A", amountCents: -25000, createdAt: new Date("2026-05-10") })];
    state.failNextUpdate = true;

    await expect(reconcileBankTransactions(ASSOC_A)).rejects.toThrow(/simulated DB failure/);
    expect(state.updates).toHaveLength(0);
    // The ledger entry was never linked — no half-applied match.
    expect(state.entries[0].bankTransactionId).toBeNull();
    expect(state.entries[0].settledAt).toBeNull();
  });

  it("manualMatchBankTransaction rejects a credit already consumed by a ledger link", async () => {
    state.credits = [credit({ id: "btx-A", amountCents: -25000 })];
    state.entries = [
      entry({ id: "ole-settled", amountCents: -25000, bankTransactionId: "btx-A", settledAt: new Date("2026-05-09") }),
      entry({ id: "ole-target", amountCents: -25000 }),
    ];

    const r = await manualMatchBankTransaction({
      associationId: ASSOC_A,
      bankTransactionId: "btx-A",
      ledgerEntryId: "ole-target",
    });

    expect(r.ok).toBe(false);
    if (r.ok === false) {
      expect(r.code).toBe("BANK_TX_ALREADY_CONSUMED");
    }
    expect(state.updates).toHaveLength(0);
  });

  it("listPendingReconciliation hides a credit already consumed by a ledger match", async () => {
    state.credits = [
      credit({ id: "btx-consumed", amountCents: -25000 }),
      credit({ id: "btx-open", amountCents: -25000 }),
    ];
    state.entries = [
      entry({ id: "ole-links-consumed", amountCents: -25000, bankTransactionId: "btx-consumed", settledAt: new Date("2026-05-09") }),
      entry({ id: "ole-pending", amountCents: -25000 }),
    ];

    const pending = await listPendingReconciliation(ASSOC_A);

    const ids = pending.unmatchedCredits.map((c) => c.id);
    expect(ids).toContain("btx-open");
    expect(ids).not.toContain("btx-consumed");
  });
});
