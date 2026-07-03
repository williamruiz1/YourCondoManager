/**
 * Bank-account → Chart-of-Accounts bridge — unit tests.
 *
 * Verifies the bridge that mirrors a linked Plaid bank account into the Chart
 * of Accounts (`financial_accounts`) as a balance-synced asset row:
 *   - upsert produces source='plaid', accountType='asset', the name+last4,
 *     the synced balance, and the linked_bank_account_id FK
 *   - the upsert conflict target is linked_bank_account_id → idempotent on
 *     re-link/re-sync (no duplicate; same row refreshed)
 *   - balance sync updates only the matching source='plaid' row
 *   - deactivate marks the mirror inactive (soft, not deleted)
 *
 * The Drizzle `db` is mocked with a fluent recorder so the test asserts on the
 * exact insert/update shape the bridge emits, without a live database.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Recorded calls, reset per test.
let insertCalls: Array<{ table: string; values: any; conflict: any }> = [];
let updateCalls: Array<{ table: string; set: any }> = [];

function tableName(t: any): string {
  // The schema objects carry a drizzle symbol with the SQL name; fall back to
  // a best-effort tag so assertions stay readable.
  return t?.[Symbol.for("drizzle:Name")] ?? t?._?.name ?? "unknown";
}

vi.mock("../../db", () => {
  return {
    db: {
      insert: (table: any) => {
        const rec: any = { table: tableName(table), values: undefined, conflict: undefined };
        const chain: any = {
          values: (vals: any) => {
            rec.values = vals;
            return chain;
          },
          onConflictDoUpdate: (cfg: any) => {
            rec.conflict = cfg;
            insertCalls.push(rec);
            return Promise.resolve();
          },
          onConflictDoNothing: () => {
            insertCalls.push(rec);
            return Promise.resolve();
          },
          // Plain insert with no conflict clause (awaited directly).
          then: (resolve: any) => {
            insertCalls.push(rec);
            return Promise.resolve().then(resolve);
          },
        };
        return chain;
      },
      update: (table: any) => {
        const rec: any = { table: tableName(table), set: undefined };
        const chain: any = {
          set: (vals: any) => {
            rec.set = vals;
            return chain;
          },
          where: () => {
            updateCalls.push(rec);
            return Promise.resolve();
          },
        };
        return chain;
      },
    },
  };
});

vi.mock("../../logger", () => ({ log: vi.fn() }));

import {
  upsertBridgedFinancialAccount,
  bridgeLinkedBankAccounts,
  syncBridgedFinancialAccountBalance,
  deactivateBridgedFinancialAccounts,
  bridgedAccountName,
  PLAID_COA_ACCOUNT_TYPE,
} from "../financial-account-bank-bridge";

beforeEach(() => {
  insertCalls = [];
  updateCalls = [];
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("bridgedAccountName", () => {
  it("appends the last-4 with a bullet separator when a mask is present", () => {
    expect(bridgedAccountName("Chase Operating", "1234")).toBe("Chase Operating ••1234");
  });
  it("falls back to the bare name when there is no mask", () => {
    expect(bridgedAccountName("Reserve", null)).toBe("Reserve");
  });
});

describe("upsertBridgedFinancialAccount — creates the linked COA mirror row", () => {
  it("inserts an asset/bank row with source=plaid, the synced balance, and the FK", async () => {
    await upsertBridgedFinancialAccount({
      id: "bank-acct-1",
      associationId: "assoc-1",
      name: "Chase Operating",
      mask: "1234",
      currentBalanceCents: 250000,
    });

    expect(insertCalls).toHaveLength(1);
    const { values, conflict } = insertCalls[0];
    expect(values.associationId).toBe("assoc-1");
    expect(values.name).toBe("Chase Operating ••1234");
    expect(values.accountType).toBe(PLAID_COA_ACCOUNT_TYPE); // "asset"
    expect(values.source).toBe("plaid");
    expect(values.linkedBankAccountId).toBe("bank-acct-1");
    expect(values.currentBalanceCents).toBe(250000);
    expect(values.isActive).toBe(1);

    // Idempotency: the conflict target is the linked_bank_account_id column, so
    // re-running upserts the same row rather than inserting a duplicate.
    expect(conflict).toBeTruthy();
    expect(conflict.set.currentBalanceCents).toBe(250000);
    expect(conflict.set.name).toBe("Chase Operating ••1234");
  });

  it("is idempotent — re-linking the SAME bank account does not duplicate (always upsert-keyed)", async () => {
    const acct = {
      id: "bank-acct-1",
      associationId: "assoc-1",
      name: "Chase Operating",
      mask: "1234",
      currentBalanceCents: 250000,
    };
    // Two link/sync passes for the same account.
    await upsertBridgedFinancialAccount(acct);
    await upsertBridgedFinancialAccount({ ...acct, currentBalanceCents: 260000 });

    expect(insertCalls).toHaveLength(2);
    // Both are upserts keyed on linked_bank_account_id (never a plain insert) —
    // so the DB resolves them to a single row. Second pass carries the new balance.
    expect(insertCalls[0].conflict).toBeTruthy();
    expect(insertCalls[1].conflict).toBeTruthy();
    expect(insertCalls[0].values.linkedBankAccountId).toBe("bank-acct-1");
    expect(insertCalls[1].values.linkedBankAccountId).toBe("bank-acct-1");
    expect(insertCalls[1].conflict.set.currentBalanceCents).toBe(260000);
  });

  it("tolerates a null balance (sets currentBalanceCents to null, not undefined)", async () => {
    await upsertBridgedFinancialAccount({
      id: "bank-acct-2",
      associationId: "assoc-1",
      name: "Reserve",
      mask: null,
      currentBalanceCents: null,
    });
    expect(insertCalls[0].values.currentBalanceCents).toBeNull();
    expect(insertCalls[0].values.name).toBe("Reserve");
  });
});

describe("bridgeLinkedBankAccounts — mirrors every account of a connection", () => {
  it("upserts one COA row per linked account and returns the count mirrored", async () => {
    const mirrored = await bridgeLinkedBankAccounts([
      { id: "a1", associationId: "assoc-1", name: "Operating", mask: "1111", currentBalanceCents: 1000 },
      { id: "a2", associationId: "assoc-1", name: "Reserve", mask: "2222", currentBalanceCents: 2000 },
    ]);
    expect(mirrored).toBe(2);
    expect(insertCalls).toHaveLength(2);
    expect(insertCalls.map((c) => c.values.linkedBankAccountId).sort()).toEqual(["a1", "a2"]);
  });
});

describe("syncBridgedFinancialAccountBalance — refreshes the mirror balance", () => {
  it("updates the matching linked row's balance", async () => {
    await syncBridgedFinancialAccountBalance("bank-acct-1", 999900);
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].set.currentBalanceCents).toBe(999900);
  });
});

describe("deactivateBridgedFinancialAccounts — unlink soft-removes the mirror", () => {
  it("marks each linked row inactive (soft, not deleted)", async () => {
    await deactivateBridgedFinancialAccounts(["a1", "a2"]);
    expect(updateCalls).toHaveLength(2);
    expect(updateCalls.every((c) => c.set.isActive === 0)).toBe(true);
  });
  it("no-ops on an empty id list", async () => {
    await deactivateBridgedFinancialAccounts([]);
    expect(updateCalls).toHaveLength(0);
  });
});
