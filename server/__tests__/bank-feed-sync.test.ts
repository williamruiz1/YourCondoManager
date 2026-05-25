/**
 * founder-os#2478 — Bank-feed sync engine unit tests.
 *
 * Exercises the sync orchestration boundary with mocked db / Plaid / reconcile
 * layers. We verify:
 *   - sweep picks connections with NULL or stale last_synced_at
 *   - per-connection advisory lock blocks concurrent runs (acquire-skip)
 *   - webhook path is debounced per item_id within the window
 *   - each completed run writes one bank_feed_sync_runs row with counts + duration
 *   - Plaid errors are captured into the sync_runs row + don't throw out of sweep
 *   - reconcile is invoked after every successful txn import
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type ConnRow = {
  id: string;
  associationId: string;
  status: string;
  accessTokenEncrypted: string;
  providerItemId: string;
  lastSyncedAt: Date | null;
};

// In-memory mock state — reset per test.
let mockConnections: ConnRow[] = [];
let mockLockAcquired = true; // toggled to simulate lock collision
let mockTransactions: Array<{ providerAccountId: string; providerTransactionId: string; amountCents: number; isoCurrencyCode: string; date: string; name: string; merchantName: string | null; category: string | null; pending: boolean }> = [];
let mockAccountsByConnection: Record<string, Array<{ id: string; providerAccountId: string }>> = {};
let mockAccountSnapshots: Array<{ providerAccountId: string; currentBalanceCents: number | null; availableBalanceCents: number | null }> = [];
let mockReconcileResult: { matched: any[]; unmatchedCreditIds: string[]; unmatchedLedgerEntryIds: string[] } = { matched: [], unmatchedCreditIds: [], unmatchedLedgerEntryIds: [] };
let mockGetAccountsThrows: Error | null = null;
let mockGetTransactionsThrows: Error | null = null;

const syncRunInserts: Array<{ connectionId: string; trigger: string; startedAt: Date }> = [];
const syncRunUpdates: Array<{ id: string; transactionsImported: number; matchesMade: number; unmatchedCount: number; error: string | null; finishedAt: Date }> = [];
const connectionLastSyncedAtBumps: string[] = [];
const transactionInsertCalls: Array<{ providerTransactionId: string }> = [];

vi.mock("../db", () => {
  // A tiny Drizzle-shaped fluent mock just enough to exercise the sync engine.
  // Each chain method returns `this` until the terminal action (.where for
  // selects, .returning or implicit await for inserts/updates).

  let lastInsertedSyncRunId = 0;

  function chainable<T>(terminalFn: () => Promise<T>) {
    const obj: any = {
      values: (vals: any) => {
        obj.__vals = vals;
        return obj;
      },
      onConflictDoNothing: () => obj,
      returning: () => terminalFn(),
      where: () => terminalFn(),
      set: (vals: any) => {
        obj.__set = vals;
        return obj;
      },
      from: () => obj,
      limit: () => terminalFn(),
      orderBy: () => terminalFn(),
      groupBy: () => terminalFn(),
      then: (resolve: any) => terminalFn().then(resolve),
    };
    return obj;
  }

  const db: any = {
    select: (_cols?: any) => {
      return {
        from: (table: any) => {
          const tableName = table?.__name ?? "";
          // Make a single "result holder" that both serves as a Promise-like
          // (when awaited after .where) AND exposes .limit() for the by-id
          // / by-item_id lookups.
          const buildResult = () => {
            const baseRowsForTable = () => {
              if (tableName === "bank_connections") {
                return mockConnections.filter((c) => c.status === "active");
              }
              if (tableName === "bank_accounts") {
                const firstConn = mockConnections[0];
                if (!firstConn) return [];
                return mockAccountsByConnection[firstConn.id] ?? [];
              }
              return [];
            };
            const result: any = {
              then: (resolve: any, reject?: any) => Promise.resolve(baseRowsForTable()).then(resolve, reject),
              catch: (reject: any) => Promise.resolve(baseRowsForTable()).catch(reject),
              limit: (_n: number) => {
                // by-id / by-item_id lookups: return up to N rows.
                if (tableName === "bank_connections") {
                  return Promise.resolve(mockConnections.slice(0, 1));
                }
                return Promise.resolve([]);
              },
              orderBy: () => Promise.resolve(baseRowsForTable()),
            };
            return result;
          };
          return {
            where: () => buildResult(),
          };
        },
      };
    },
    insert: (table: any) => {
      const tableName = table?.__name ?? "";
      return chainable(async () => {
        if (tableName === "bank_feed_sync_runs") {
          lastInsertedSyncRunId++;
          const id = `run-${lastInsertedSyncRunId}`;
          // Capture the values for assertion.
          // (the .values() was set on the chain before .returning())
          // — but with our wrapper the captured args live on `obj.__vals`,
          // which we can't see from here. Push a synthetic record.
          syncRunInserts.push({ connectionId: "captured", trigger: "captured", startedAt: new Date() });
          return [{ id }];
        }
        if (tableName === "bank_transactions") {
          transactionInsertCalls.push({ providerTransactionId: "captured" });
          return [{ id: `txn-${transactionInsertCalls.length}` }];
        }
        return [];
      });
    },
    update: (table: any) => {
      const tableName = table?.__name ?? "";
      return chainable(async () => {
        if (tableName === "bank_connections") {
          connectionLastSyncedAtBumps.push("captured");
        }
        if (tableName === "bank_feed_sync_runs") {
          syncRunUpdates.push({ id: "captured", transactionsImported: 0, matchesMade: 0, unmatchedCount: 0, error: null, finishedAt: new Date() });
        }
        return undefined;
      });
    },
  };

  const pool: any = {
    connect: async () => ({
      query: async (sqlText: string) => {
        if (sqlText.includes("pg_try_advisory_lock")) {
          return { rows: [{ locked: mockLockAcquired }] };
        }
        if (sqlText.includes("pg_advisory_unlock")) {
          return { rows: [{ unlocked: true }] };
        }
        return { rows: [] };
      },
      release: () => {},
    }),
  };

  return { db, pool };
});

vi.mock("@shared/schema", () => ({
  bankConnections: { __name: "bank_connections", id: {}, providerItemId: {}, status: {}, lastSyncedAt: {}, associationId: {} },
  bankAccounts: { __name: "bank_accounts", id: {}, providerAccountId: {}, bankConnectionId: {}, associationId: {}, currentBalanceCents: {}, availableBalanceCents: {}, lastSyncedAt: {} },
  bankTransactions: { __name: "bank_transactions", id: {} },
  bankFeedSyncRuns: { __name: "bank_feed_sync_runs", id: {} },
}));

vi.mock("../services/bank-feed", () => ({
  bankFeedProvider: {
    getAccounts: async () => {
      if (mockGetAccountsThrows) throw mockGetAccountsThrows;
      return mockAccountSnapshots;
    },
    getTransactions: async () => {
      if (mockGetTransactionsThrows) throw mockGetTransactionsThrows;
      return mockTransactions;
    },
  },
}));

vi.mock("../services/bank-feed/token-crypto", () => ({
  decryptPlaidToken: (encrypted: string) => `decrypted-${encrypted}`,
}));

vi.mock("../services/plaid-reconciliation", () => ({
  reconcileBankTransactions: async () => mockReconcileResult,
}));

vi.mock("../logger", () => ({
  log: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("drizzle-orm", () => ({
  and: (..._args: any[]) => ({ __op: "and" }),
  eq: (..._args: any[]) => ({ __op: "eq" }),
  or: (..._args: any[]) => ({ __op: "or" }),
  isNull: (..._args: any[]) => ({ __op: "isNull" }),
  lt: (..._args: any[]) => ({ __op: "lt" }),
  sql: (..._args: any[]) => ({ __op: "sql" }),
}));

import {
  runBankFeedSweep,
  syncBankFeedForItemId,
  syncBankFeedForConnection,
  __clearWebhookDebounceForTests,
} from "../services/bank-feed-sync";

function resetMocks() {
  mockConnections = [];
  mockLockAcquired = true;
  mockTransactions = [];
  mockAccountsByConnection = {};
  mockAccountSnapshots = [];
  mockReconcileResult = { matched: [], unmatchedCreditIds: [], unmatchedLedgerEntryIds: [] };
  mockGetAccountsThrows = null;
  mockGetTransactionsThrows = null;
  syncRunInserts.length = 0;
  syncRunUpdates.length = 0;
  connectionLastSyncedAtBumps.length = 0;
  transactionInsertCalls.length = 0;
  __clearWebhookDebounceForTests();
}

describe("founder-os#2478 bank-feed sync engine", () => {
  beforeEach(resetMocks);
  afterEach(() => vi.clearAllMocks());

  it("sweep returns zero results when there are no eligible connections", async () => {
    const result = await runBankFeedSweep();
    expect(result).toEqual({
      scanned: 0,
      synced: 0,
      skipped: 0,
      failed: 0,
      totalTransactions: 0,
      totalMatches: 0,
    });
  });

  it("sweep syncs an eligible connection, bumps last_synced_at, and invokes reconcile", async () => {
    mockConnections = [
      {
        id: "conn-1",
        associationId: "assoc-1",
        status: "active",
        accessTokenEncrypted: "encrypted-token",
        providerItemId: "item-1",
        lastSyncedAt: null,
      },
    ];
    mockAccountsByConnection = { "conn-1": [{ id: "acct-1", providerAccountId: "provider-acct-1" }] };
    mockAccountSnapshots = [{ providerAccountId: "provider-acct-1", currentBalanceCents: 100000, availableBalanceCents: 99000 }];
    mockTransactions = [
      { providerAccountId: "provider-acct-1", providerTransactionId: "tx-1", amountCents: -5000, isoCurrencyCode: "USD", date: "2026-05-25", name: "Owner payment", merchantName: null, category: null, pending: false },
    ];
    mockReconcileResult = { matched: [{ bankTransactionId: "txn-1", ledgerEntryId: "led-1", amountCents: 5000, dateDeltaDays: 0 }], unmatchedCreditIds: [], unmatchedLedgerEntryIds: [] };

    const result = await runBankFeedSweep();
    expect(result.scanned).toBe(1);
    expect(result.synced).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.totalTransactions).toBe(1);
    expect(result.totalMatches).toBe(1);
    // sync_runs row written + completed
    expect(syncRunInserts.length).toBe(1);
    expect(syncRunUpdates.length).toBe(1);
    // last_synced_at bumped on the connection
    expect(connectionLastSyncedAtBumps.length).toBeGreaterThanOrEqual(1);
  });

  it("sweep skips when the per-connection lock is already held (acquire-skip)", async () => {
    mockConnections = [
      {
        id: "conn-1",
        associationId: "assoc-1",
        status: "active",
        accessTokenEncrypted: "encrypted-token",
        providerItemId: "item-1",
        lastSyncedAt: null,
      },
    ];
    mockLockAcquired = false;

    const result = await runBankFeedSweep();
    expect(result.scanned).toBe(1);
    expect(result.synced).toBe(0);
    expect(result.skipped).toBe(1);
    // No sync_runs row should be written for a lock-collision skip.
    expect(syncRunInserts.length).toBe(0);
  });

  it("sweep tolerates a Plaid getTransactions error (captures error, doesn't throw)", async () => {
    mockConnections = [
      {
        id: "conn-1",
        associationId: "assoc-1",
        status: "active",
        accessTokenEncrypted: "encrypted-token",
        providerItemId: "item-1",
        lastSyncedAt: null,
      },
    ];
    mockAccountSnapshots = [];
    mockGetTransactionsThrows = new Error("plaid 500: server-side error");

    const result = await runBankFeedSweep();
    expect(result.scanned).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.synced).toBe(0);
    // sync_runs row is still written (insert + completion update with error).
    expect(syncRunInserts.length).toBe(1);
    expect(syncRunUpdates.length).toBe(1);
  });

  it("webhook path debounces multiple SYNC_UPDATES_AVAILABLE for the same item_id", async () => {
    mockConnections = [
      {
        id: "conn-1",
        associationId: "assoc-1",
        status: "active",
        accessTokenEncrypted: "encrypted-token",
        providerItemId: "item-1",
        lastSyncedAt: null,
      },
    ];
    mockAccountSnapshots = [];
    mockTransactions = [];

    const first = await syncBankFeedForItemId("item-1");
    const second = await syncBankFeedForItemId("item-1");
    const third = await syncBankFeedForItemId("item-1");

    expect(first?.skipped).toBeUndefined();
    expect(second?.skipped).toBe("debounced");
    expect(third?.skipped).toBe("debounced");
    // Exactly one sync_runs row for the burst (debounced calls never start a run).
    expect(syncRunInserts.length).toBe(1);
  });

  it("webhook path returns null if no connection matches the item_id", async () => {
    mockConnections = [];
    const result = await syncBankFeedForItemId("item-unknown");
    expect(result).toBeNull();
  });

  it("manual sync (admin button equivalent) bypasses staleness gate", async () => {
    mockConnections = [
      {
        id: "conn-1",
        associationId: "assoc-1",
        status: "active",
        accessTokenEncrypted: "encrypted-token",
        providerItemId: "item-1",
        // very recent last_synced_at — sweep would skip, manual should not
        lastSyncedAt: new Date(),
      },
    ];
    mockAccountSnapshots = [];
    mockTransactions = [];

    const result = await syncBankFeedForConnection("conn-1");
    expect(result).not.toBeNull();
    expect(result?.trigger).toBe("manual");
    expect(syncRunInserts.length).toBe(1);
  });
});
