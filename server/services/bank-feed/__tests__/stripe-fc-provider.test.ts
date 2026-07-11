/**
 * StripeFcProvider tests — the READ-ONLY Stripe Financial Connections bank-feed
 * provider (drop-in alternative to PlaidProvider).
 *
 * We mock `fetch` (Stripe API) + getSecret (platform key) — no network. We
 * assert the provider:
 *   1. createLinkToken creates an FC Session with READ-ONLY permissions only
 *      (balances+transactions, NO payment_method) and returns the client_secret.
 *   2. exchangePublicToken retrieves the session, subscribes accounts, and
 *      synthesizes the opaque access blob + session-id itemId.
 *   3. getAccounts maps FC balance/category → the provider-agnostic snapshot.
 *   4. syncTransactions maps FC transactions into the snapshot shape, NEGATES
 *      the FC amount sign (Plaid convention: + = debit), paginates per account,
 *      and returns a per-account cursor map.
 *   5. verifyWebhook maps FC event types → the provider-agnostic WebhookEvent.
 *   6. removeConnection disconnects each FC account.
 */

import { createHmac } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// getSecret returns the platform Stripe key. Mock it so no real secret store
// is touched and no PLATFORM_STRIPE_SECRET_KEY env is required.
vi.mock("../../../platform-secrets-store", () => ({
  getSecret: vi.fn(async (envVar: string) => {
    if (envVar === "STRIPE_FC_WEBHOOK_SECRET") return "whsec_test_fc";
    return "sk_test_platform_123";
  }),
}));

vi.mock("../../../logger", () => ({ debug: vi.fn(), log: vi.fn() }));

import { StripeFcProvider, mapFcAccount, mapFcTransaction } from "../stripe-fc-provider";

// ── fetch mock plumbing ──────────────────────────────────────────────────────

type FetchCall = { url: string; method: string; body: string | undefined };
let fetchCalls: FetchCall[] = [];
// queue of responses keyed by a matcher fn; we route by URL substring.
let routes: Array<{ match: (url: string, method: string) => boolean; body: any; status?: number }> =
  [];

function jsonResponse(body: any, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

beforeEach(() => {
  fetchCalls = [];
  routes = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const method = (init?.method ?? "GET").toUpperCase();
    const body = typeof init?.body === "string" ? init.body : undefined;
    fetchCalls.push({ url, method, body });
    const route = routes.find((r) => r.match(url, method));
    if (!route) {
      return jsonResponse({ error: { message: `no mock for ${method} ${url}` } }, 500);
    }
    return jsonResponse(route.body, route.status ?? 200);
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function on(match: (url: string, method: string) => boolean, body: any, status?: number) {
  routes.push({ match, body, status });
}

// ── createLinkToken ──────────────────────────────────────────────────────────

describe("StripeFcProvider.createLinkToken", () => {
  it("creates a READ-ONLY FC session (balances+transactions, no payment_method) and returns client_secret", async () => {
    // customer search miss → create customer → create session
    on((u, m) => u.includes("/customers/search") && m === "GET", { data: [] });
    on((u, m) => u.endsWith("/customers") && m === "POST", { id: "cus_fc_1" });
    on(
      (u, m) => u.includes("/financial_connections/sessions") && m === "POST",
      { id: "fcsess_1", client_secret: "fcsess_1_secret_abc" },
    );

    const provider = new StripeFcProvider();
    const { linkToken } = await provider.createLinkToken({
      associationId: "assoc-1",
      userId: "user-1",
    });

    expect(linkToken).toBe("fcsess_1_secret_abc");

    const sessionCall = fetchCalls.find((c) =>
      c.url.includes("/financial_connections/sessions"),
    );
    expect(sessionCall).toBeDefined();
    const sentBody = sessionCall!.body ?? "";
    // READ-ONLY: balances + transactions requested, payment_method NEVER.
    expect(sentBody).toContain("permissions%5B%5D=balances");
    expect(sentBody).toContain("permissions%5B%5D=transactions");
    expect(sentBody).not.toContain("payment_method");
    // account_holder is a customer (the per-association FC customer).
    expect(sentBody).toContain("account_holder%5Btype%5D=customer");
    expect(sentBody).toContain("account_holder%5Bcustomer%5D=cus_fc_1");
  });

  it("reuses an existing FC customer when search finds one (no customer create)", async () => {
    on((u, m) => u.includes("/customers/search") && m === "GET", { data: [{ id: "cus_existing" }] });
    on(
      (u, m) => u.includes("/financial_connections/sessions") && m === "POST",
      { id: "fcsess_2", client_secret: "secret_2" },
    );

    const provider = new StripeFcProvider();
    await provider.createLinkToken({ associationId: "assoc-1", userId: "user-1" });

    const createdCustomer = fetchCalls.find(
      (c) => c.url.endsWith("/customers") && c.method === "POST",
    );
    expect(createdCustomer).toBeUndefined(); // reused, not created
  });
});

// ── exchangePublicToken ──────────────────────────────────────────────────────

describe("StripeFcProvider.exchangePublicToken", () => {
  it("retrieves the session, subscribes accounts, and returns an access blob + session-id itemId", async () => {
    on(
      (u, m) => u.includes("/financial_connections/sessions/fcsess_9") && m === "GET",
      {
        id: "fcsess_9",
        account_holder: { customer: "cus_9" },
        accounts: { data: [{ id: "fca_1" }, { id: "fca_2" }] },
      },
    );
    on((u, m) => u.includes("/subscribe") && m === "POST", { id: "fca_x", subscriptions: ["transactions"] });

    const provider = new StripeFcProvider();
    const { accessToken, itemId } = await provider.exchangePublicToken("fcsess_9");

    expect(itemId).toBe("fcsess_9");
    const blob = JSON.parse(accessToken);
    expect(blob.customerId).toBe("cus_9");
    expect(blob.accountIds).toEqual(["fca_1", "fca_2"]);
    expect(blob.sessionId).toBe("fcsess_9");

    // both accounts subscribed to transactions
    const subs = fetchCalls.filter((c) => c.url.includes("/subscribe"));
    expect(subs.length).toBe(2);
    expect(subs[0].body).toContain("features%5B%5D=transactions");
  });

  it("throws when the session has no linked accounts", async () => {
    on(
      (u, m) => u.includes("/financial_connections/sessions/empty") && m === "GET",
      { id: "empty", accounts: { data: [] } },
    );
    const provider = new StripeFcProvider();
    await expect(provider.exchangePublicToken("empty")).rejects.toThrow(/no linked accounts/i);
  });
});

// ── getAccounts ──────────────────────────────────────────────────────────────

describe("StripeFcProvider.getAccounts", () => {
  it("refreshes balance then maps FC account → snapshot (cash → depository)", async () => {
    on((u, m) => u.includes("/refresh") && m === "POST", { id: "fca_1" });
    on(
      (u, m) => u.includes("/financial_connections/accounts/fca_1") && m === "GET",
      {
        id: "fca_1",
        display_name: "Chase Checking",
        last4: "6789",
        category: "cash",
        subcategory: "checking",
        balance: { current: { usd: 1234567 }, type: "cash" },
      },
    );

    const provider = new StripeFcProvider();
    const blob = JSON.stringify({ v: 1, customerId: "cus_1", accountIds: ["fca_1"], sessionId: "s" });
    const snaps = await provider.getAccounts(blob);

    expect(snaps).toHaveLength(1);
    expect(snaps[0]).toMatchObject({
      providerAccountId: "fca_1",
      name: "Chase Checking",
      mask: "6789",
      type: "depository", // cash → depository
      subtype: "checking",
      currentBalanceCents: 1234567,
      availableBalanceCents: 1234567,
    });
  });
});

// ── syncTransactions ─────────────────────────────────────────────────────────

describe("StripeFcProvider.syncTransactions", () => {
  it("maps FC transactions, NEGATES the amount sign, and returns the transaction_refresh cursor", async () => {
    // single page, has_more false. FC: +amount = money IN; we negate so + = debit.
    on(
      (u, m) =>
        u.includes("/financial_connections/transactions") &&
        m === "GET" &&
        u.includes("account=fca_1"),
      {
        has_more: false,
        data: [
          {
            id: "fctxn_1",
            account: "fca_1",
            amount: 5000, // money IN (deposit) → should map to -5000 (credit)
            currency: "usd",
            transacted_at: 1_700_000_000,
            description: "Owner dues deposit",
            status: "posted",
          },
          {
            id: "fctxn_2",
            account: "fca_1",
            amount: -2500, // money OUT → should map to +2500 (debit)
            currency: "usd",
            transacted_at: 1_700_100_000,
            description: "Landscaping vendor",
            status: "pending",
          },
        ],
      },
    );
    // Account GET returns the current transaction_refresh.id — the cursor we
    // persist (NOT a last-seen txn id) so the next sync pulls only the delta.
    on(
      (u, m) =>
        u.includes("/financial_connections/accounts/fca_1") &&
        !u.includes("/transactions") &&
        m === "GET",
      { id: "fca_1", transaction_refresh: { id: "fctxnref_now", status: "succeeded" } },
    );

    const provider = new StripeFcProvider();
    const blob = JSON.stringify({ v: 1, customerId: "c", accountIds: ["fca_1"], sessionId: "s" });
    const result = await provider.syncTransactions(blob, null);

    expect(result.added).toHaveLength(2);
    expect(result.modified).toHaveLength(0);
    expect(result.removed).toHaveLength(0);
    // sign negation
    expect(result.added[0]).toMatchObject({
      providerTransactionId: "fctxn_1",
      amountCents: -5000, // money in → credit (negative) per Plaid convention
      pending: false,
      isoCurrencyCode: "USD",
    });
    expect(result.added[1]).toMatchObject({
      providerTransactionId: "fctxn_2",
      amountCents: 2500, // money out → debit (positive)
      pending: true,
    });
    // cursor is a per-account map pointing at the account's transaction_refresh id
    const cursorMap = JSON.parse(result.nextCursor);
    expect(cursorMap).toEqual({ fca_1: "fctxnref_now" });
    expect(result.hasMore).toBe(false);
  });

  it("passes the persisted refresh cursor as transaction_refresh[after] on a resumed sync", async () => {
    on(
      (u, m) => u.includes("/financial_connections/transactions") && m === "GET",
      { has_more: false, data: [] },
    );
    on(
      (u, m) =>
        u.includes("/financial_connections/accounts/fca_1") &&
        !u.includes("/transactions") &&
        m === "GET",
      { id: "fca_1", transaction_refresh: { id: "fctxnref_after_sync", status: "succeeded" } },
    );

    const provider = new StripeFcProvider();
    const blob = JSON.stringify({ v: 1, customerId: "c", accountIds: ["fca_1"], sessionId: "s" });
    const result = await provider.syncTransactions(
      blob,
      JSON.stringify({ fca_1: "fctxnref_prev" }),
    );

    const listCall = fetchCalls.find((c) =>
      c.url.includes("/financial_connections/transactions"),
    );
    // The list call carries the prior refresh id as transaction_refresh[after]
    // (URL-encoded as transaction_refresh%5Bafter%5D), NEVER starting_after on
    // a fresh resumption — that is the fix for the missed-status-update bug.
    expect(decodeURIComponent(listCall!.url)).toContain(
      "transaction_refresh[after]=fctxnref_prev",
    );
    expect(listCall!.url).not.toContain("starting_after=fctxnref_prev");
    // And the cursor advances to the account's CURRENT refresh id.
    expect(JSON.parse(result.nextCursor)).toEqual({ fca_1: "fctxnref_after_sync" });
  });

  it("drains pagination across pages for one account, then reads the refresh cursor", async () => {
    // Script: list page 1 (has_more) → list page 2 (final) → account GET (refresh id).
    let listCall = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      const method = (init?.method ?? "GET").toUpperCase();
      fetchCalls.push({ url, method, body: typeof init?.body === "string" ? init.body : undefined });
      if (url.includes("/financial_connections/transactions")) {
        listCall += 1;
        if (listCall === 1) {
          return jsonResponse({
            has_more: true,
            data: [{ id: "p1", account: "fca_1", amount: 100, currency: "usd", status: "posted" }],
          });
        }
        return jsonResponse({
          has_more: false,
          data: [{ id: "p2", account: "fca_1", amount: 200, currency: "usd", status: "posted" }],
        });
      }
      // Account GET → transaction_refresh id (the new cursor).
      return jsonResponse({
        id: "fca_1",
        transaction_refresh: { id: "fctxnref_p2", status: "succeeded" },
      });
    }));

    const provider = new StripeFcProvider();
    const blob = JSON.stringify({ v: 1, customerId: "c", accountIds: ["fca_1"], sessionId: "s" });
    const result = await provider.syncTransactions(blob, null);
    expect(result.added.map((t) => t.providerTransactionId)).toEqual(["p1", "p2"]);
    // Within-result pagination uses starting_after; the persisted cursor is the
    // account's transaction_refresh id, NOT the last txn id.
    const page2 = fetchCalls.find(
      (c) => c.url.includes("/financial_connections/transactions") && c.url.includes("starting_after=p1"),
    );
    expect(page2).toBeTruthy();
    expect(JSON.parse(result.nextCursor)).toEqual({ fca_1: "fctxnref_p2" });
  });

  it("routes a VOIDED FC transaction to `removed` (not `added`) so a phantom deposit leaves the books", async () => {
    on(
      (u, m) => u.includes("/financial_connections/transactions") && m === "GET",
      {
        has_more: false,
        data: [
          // posted live deposit → added
          {
            id: "fctxn_live",
            account: "fca_1",
            amount: 5000,
            currency: "usd",
            transacted_at: 1_700_000_000,
            status: "posted",
          },
          // voided via status → removed
          {
            id: "fctxn_voided_status",
            account: "fca_1",
            amount: 1000,
            currency: "usd",
            status: "void",
          },
          // voided via status_transitions.void_at → removed
          {
            id: "fctxn_voided_at",
            account: "fca_1",
            amount: 2000,
            currency: "usd",
            status: "posted",
            status_transitions: { posted_at: 1_700_000_000, void_at: 1_700_200_000 },
          },
        ],
      },
    );
    on(
      (u, m) =>
        u.includes("/financial_connections/accounts/fca_1") &&
        !u.includes("/transactions") &&
        m === "GET",
      { id: "fca_1", transaction_refresh: { id: "fctxnref_v", status: "succeeded" } },
    );

    const provider = new StripeFcProvider();
    const blob = JSON.stringify({ v: 1, customerId: "c", accountIds: ["fca_1"], sessionId: "s" });
    const result = await provider.syncTransactions(blob, null);

    expect(result.added.map((t) => t.providerTransactionId)).toEqual(["fctxn_live"]);
    expect(result.removed.sort()).toEqual(["fctxn_voided_at", "fctxn_voided_status"]);
  });

  it("re-emits a pending→posted txn (stable id) in `added` so the row's pending flag flips on upsert", async () => {
    // The SAME id (fctxn_dues) reappears on the next sync now status=posted —
    // this is exactly the case the old starting_after cursor MISSED. With the
    // refresh cursor it re-appears, lands in `added`, and the sync engine's
    // upsert flips pending 1→0 on the existing row.
    on(
      (u, m) => u.includes("/financial_connections/transactions") && m === "GET",
      {
        has_more: false,
        data: [
          {
            id: "fctxn_dues",
            account: "fca_1",
            amount: 5000,
            currency: "usd",
            transacted_at: 1_700_000_000,
            status: "posted", // previously seen as pending; same id, now posted
          },
        ],
      },
    );
    on(
      (u, m) =>
        u.includes("/financial_connections/accounts/fca_1") &&
        !u.includes("/transactions") &&
        m === "GET",
      { id: "fca_1", transaction_refresh: { id: "fctxnref_2", status: "succeeded" } },
    );

    const provider = new StripeFcProvider();
    const blob = JSON.stringify({ v: 1, customerId: "c", accountIds: ["fca_1"], sessionId: "s" });
    const result = await provider.syncTransactions(
      blob,
      JSON.stringify({ fca_1: "fctxnref_1" }),
    );

    expect(result.added).toEqual([
      expect.objectContaining({
        providerTransactionId: "fctxn_dues",
        amountCents: -5000, // deposit → credit
        pending: false, // posted now
      }),
    ]);
    expect(result.removed).toHaveLength(0);
  });
});

// ── verifyWebhook ────────────────────────────────────────────────────────────

describe("StripeFcProvider.verifyWebhook", () => {
  function signed(body: string, secret = "whsec_test_fc") {
    const t = Math.floor(Date.now() / 1000);
    const sig = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
    return `t=${t},v1=${sig}`;
  }

  it("maps refreshed_transactions → TRANSACTIONS/SYNC_UPDATES_AVAILABLE and verifies the signature", async () => {
    // force verification on in test
    process.env.STRIPE_FC_WEBHOOK_VERIFICATION = "1";
    const body = JSON.stringify({
      type: "financial_connections.account.refreshed_transactions",
      data: { object: { id: "fca_77" } },
    });
    const provider = new StripeFcProvider();
    const event = await provider.verifyWebhook(
      { "stripe-signature": signed(body) },
      body,
    );
    expect(event).toMatchObject({
      webhookType: "TRANSACTIONS",
      webhookCode: "SYNC_UPDATES_AVAILABLE",
      itemId: "fca_77",
    });
    delete process.env.STRIPE_FC_WEBHOOK_VERIFICATION;
  });

  it("rejects a bad signature when verification is enforced", async () => {
    process.env.STRIPE_FC_WEBHOOK_VERIFICATION = "1";
    const body = JSON.stringify({ type: "x", data: { object: { id: "a" } } });
    const provider = new StripeFcProvider();
    await expect(
      provider.verifyWebhook({ "stripe-signature": "t=1,v1=deadbeef" }, body),
    ).rejects.toThrow(/verification|tolerance/i);
    delete process.env.STRIPE_FC_WEBHOOK_VERIFICATION;
  });

  it("maps disconnected → ITEM/USER_PERMISSION_REVOKED (verification skipped off-prod with no secret)", async () => {
    // no STRIPE_FC_WEBHOOK_VERIFICATION + NODE_ENV not production → skip sig check
    const body = JSON.stringify({
      type: "financial_connections.account.disconnected",
      data: { object: { id: "fca_88" } },
    });
    const provider = new StripeFcProvider();
    const event = await provider.verifyWebhook({}, body);
    expect(event).toMatchObject({
      webhookType: "ITEM",
      webhookCode: "USER_PERMISSION_REVOKED",
      itemId: "fca_88",
    });
  });
});

// ── removeConnection ─────────────────────────────────────────────────────────

describe("StripeFcProvider.removeConnection", () => {
  it("disconnects each FC account", async () => {
    on((u, m) => u.includes("/disconnect") && m === "POST", { id: "fca", status: "disconnected" });
    const provider = new StripeFcProvider();
    const blob = JSON.stringify({ v: 1, customerId: "c", accountIds: ["fca_1", "fca_2"], sessionId: "s" });
    await provider.removeConnection(blob);
    const disconnects = fetchCalls.filter((c) => c.url.includes("/disconnect"));
    expect(disconnects).toHaveLength(2);
  });
});

// ── pure mappers (no fetch) ──────────────────────────────────────────────────

describe("FC pure mappers", () => {
  it("mapFcTransaction negates the amount sign + derives ISO date", () => {
    const snap = mapFcTransaction({
      id: "t1",
      account: "a1",
      amount: 1000, // money in
      currency: "usd",
      transacted_at: 1_700_000_000,
      description: "Deposit",
      status: "posted",
    });
    expect(snap.amountCents).toBe(-1000);
    expect(snap.isoCurrencyCode).toBe("USD");
    expect(snap.pending).toBe(false);
    expect(snap.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("mapFcAccount translates credit category + reads single-currency balance", () => {
    const snap = mapFcAccount({
      id: "a2",
      display_name: "Amex",
      category: "credit",
      subcategory: "credit_card",
      balance: { current: { usd: 500 } },
    });
    expect(snap.type).toBe("credit");
    expect(snap.currentBalanceCents).toBe(500);
  });
});
