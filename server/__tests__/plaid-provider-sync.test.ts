/**
 * PlaidProvider.syncTransactions tests (P-3 — /transactions/sync migration).
 *
 * Mocks the `plaid` SDK so PlaidApi.transactionsSync returns scripted pages,
 * then asserts the provider:
 *   1. drains pagination (has_more loop) into one combined delta
 *   2. maps added / modified / removed correctly
 *   3. omits the cursor on the initial sync, then passes it on subsequent pages
 *   4. returns the final next_cursor for the caller to persist
 *   5. preserves Plaid's amount sign convention in the snapshot mapping
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Scripted pages the mock transactionsSync returns, in order.
let pages: any[] = [];
let syncCalls: any[] = [];

vi.mock("plaid", () => {
  class PlaidApi {
    async transactionsSync(req: any) {
      syncCalls.push(req);
      const page = pages.shift();
      return { data: page };
    }
  }
  return {
    PlaidApi,
    Configuration: class {},
    PlaidEnvironments: { sandbox: "https://sandbox.plaid.com", development: "", production: "" },
    Products: { Transactions: "transactions" },
    CountryCode: { Us: "US" },
  };
});

vi.mock("../../logger", () => ({ debug: vi.fn(), log: vi.fn() }));
vi.mock("./plaid-webhook-verify", () => ({ verifyPlaidWebhook: vi.fn() }));
vi.mock("./plaid-env-guard", () => ({ shouldEnforceWebhookVerification: () => false }));

import { PlaidProvider } from "../services/bank-feed/plaid-provider";

function txn(id: string, acct: string, amount: number, name = "Txn"): any {
  return {
    transaction_id: id,
    account_id: acct,
    amount, // dollars; provider converts to cents
    iso_currency_code: "USD",
    date: "2026-06-20",
    name,
    merchant_name: null,
    personal_finance_category: { primary: "INCOME" },
    category: null,
    pending: false,
  };
}

describe("PlaidProvider.syncTransactions (P-3)", () => {
  beforeEach(() => {
    pages = [];
    syncCalls = [];
  });
  afterEach(() => vi.clearAllMocks());

  it("drains pagination and combines added/modified/removed across pages", async () => {
    pages = [
      {
        added: [txn("t1", "a1", -50.0)], // credit (money in)
        modified: [],
        removed: [],
        next_cursor: "cursor-1",
        has_more: true,
      },
      {
        added: [txn("t2", "a1", 25.5)], // debit (money out)
        modified: [txn("t3", "a1", -10.0)],
        removed: [{ transaction_id: "t-old" }],
        next_cursor: "cursor-final",
        has_more: false,
      },
    ];

    const provider = new PlaidProvider();
    const result = await provider.syncTransactions("access-tok", null);

    expect(result.added.map((t) => t.providerTransactionId)).toEqual(["t1", "t2"]);
    expect(result.modified.map((t) => t.providerTransactionId)).toEqual(["t3"]);
    expect(result.removed).toEqual(["t-old"]);
    expect(result.nextCursor).toBe("cursor-final");
    expect(result.hasMore).toBe(false);

    // Sign convention preserved: -50.00 → -5000 cents (credit).
    expect(result.added[0].amountCents).toBe(-5000);
    // 25.50 → 2550 cents (debit).
    expect(result.added[1].amountCents).toBe(2550);
  });

  it("omits cursor on initial sync, then passes the returned cursor on next page", async () => {
    pages = [
      { added: [], modified: [], removed: [], next_cursor: "c1", has_more: true },
      { added: [], modified: [], removed: [], next_cursor: "c2", has_more: false },
    ];

    const provider = new PlaidProvider();
    await provider.syncTransactions("access-tok", null);

    // First call: no cursor field (initial sync).
    expect(syncCalls[0].cursor).toBeUndefined();
    // Second call: the cursor returned by page 1.
    expect(syncCalls[1].cursor).toBe("c1");
  });

  it("passes a persisted cursor through on a subsequent (delta) sync", async () => {
    pages = [
      { added: [], modified: [], removed: [], next_cursor: "c-next", has_more: false },
    ];

    const provider = new PlaidProvider();
    const result = await provider.syncTransactions("access-tok", "saved-cursor");

    expect(syncCalls[0].cursor).toBe("saved-cursor");
    expect(result.nextCursor).toBe("c-next");
  });
});
