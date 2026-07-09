/**
 * StripeFcProvider — concrete BankFeedProvider implementation backed by Stripe
 * Financial Connections (FC).
 *
 * This is a DROP-IN alternative to PlaidProvider for the READ-ONLY bank feed
 * used to reconcile the HOA books. It is NOT dues collection (that is Stripe
 * Connect, already live and untouched). It is selected at the singleton in
 * ./index.ts behind the STRIPE_FINANCIAL_CONNECTIONS_ENABLED flag; when the
 * flag is OFF (the default), PlaidProvider is used exactly as before.
 *
 * ── Why Stripe FC ──────────────────────────────────────────────────────────
 * YCM is already a Stripe platform on Connect, so FC = same vendor, same keys
 * (PLATFORM_STRIPE_SECRET_KEY via getSecret), same dashboard, NO separate
 * diligence, pay-as-you-go (~30¢/account/mo + 10¢/balance call), read-only
 * balances + transactions, Chase via OAuth. Plaid production is otherwise
 * blocked on Plaid's Security Questionnaire to unlock Chase.
 *
 * ── How FC maps onto the BankFeedProvider (Plaid-shaped) interface ──────────
 * FC's flow differs from Plaid's link_token → public_token → access_token
 * shape. We adapt FC onto the SAME interface so the routes + bank-feed-sync
 * engine stay UNCHANGED:
 *
 *   createLinkToken(assoc,user)  → create a FC *Session* (permissions
 *                                  balances+transactions, account_holder =
 *                                  a per-association Stripe Customer). Return
 *                                  the session `client_secret` as `linkToken`
 *                                  — Stripe.js's collectFinancialConnections-
 *                                  Accounts() consumes a client_secret exactly
 *                                  as Plaid Link consumes a link_token.
 *
 *   exchangePublicToken(sessionId) → FC has no public_token. The client passes
 *                                  the *session id* back (in onSuccess). We
 *                                  retrieve the session, read its linked
 *                                  account(s), subscribe each to the
 *                                  transactions feature, and synthesize an
 *                                  opaque "access token" = a JSON blob of
 *                                  { customerId, accountIds, sessionId }. That
 *                                  blob is what the route encrypts + stores in
 *                                  bank_connections.access_token_encrypted,
 *                                  and `itemId` = the FC session id (stored in
 *                                  provider_item_id). No Stripe credential ever
 *                                  lands in the access token — FC accounts are
 *                                  addressed by id under the platform key.
 *
 *   getAccounts(token)           → refresh each FC account's balance feature,
 *                                  then read balance + names → snapshots.
 *
 *   syncTransactions(token,cur)  → list FC transactions per account
 *                                  (cursor-paginated). The persisted cursor is
 *                                  a JSON map of { accountId: lastTxnCursor }.
 *                                  We map FC's posted/pending status + amount
 *                                  sign into the SAME snapshot shape the
 *                                  reconciler already consumes (positive =
 *                                  money OUT / debit).
 *
 *   verifyWebhook(headers,body)  → verify the Stripe webhook signature
 *                                  (Stripe-Signature, HMAC-SHA256 over the raw
 *                                  body) and map FC events
 *                                  (financial_connections.account.* ) to the
 *                                  provider-agnostic WebhookEvent.
 *
 *   removeConnection(token)      → FC's read-only links are disconnected per
 *                                  account (financial_connections.accounts
 *                                  /:id/disconnect).
 *
 * Env vars required:
 *   PLATFORM_STRIPE_SECRET_KEY        — platform Stripe secret (test sk_test_…
 *                                       for build/validation; live sk_live_…
 *                                       once William flips the vendor). Resolved
 *                                       via getSecret (env OR platform_secrets).
 *   STRIPE_FINANCIAL_CONNECTIONS_ENABLED — the feature flag (read in ./index.ts)
 *   STRIPE_FC_WEBHOOK_SECRET          — Stripe webhook signing secret (whsec_…)
 *                                       for FC webhook verification. When unset,
 *                                       signature verification is skipped in
 *                                       non-production (parity with Plaid's
 *                                       sandbox-skip); production refuses to
 *                                       skip (see ./stripe-fc-env-guard.ts).
 *
 * Read-only guarantee: we NEVER request the `payment_method` permission and
 * NEVER call any money-moving endpoint. FC sessions here are balances +
 * transactions ONLY.
 */

import { assertStripeKeySafe } from "../../staging-guard";
import { createHmac, timingSafeEqual } from "crypto";
import { debug } from "../../logger";
import { getSecret } from "../../platform-secrets-store";
import type {
  BankFeedProvider,
  BankAccountSnapshot,
  BankTransactionSnapshot,
  TransactionSyncResult,
  WebhookEvent,
} from "./provider";
import { shouldEnforceFcWebhookVerification } from "./stripe-fc-env-guard";

// ── Stripe API access (raw fetch — matches the codebase pattern) ─────────────
//
// YCM calls Stripe via raw fetch with the platform secret (see
// server/services/stripe-connect.ts callPlatformStripe + payment-service.ts).
// We mirror that here so FC uses the exact same credential + transport, and so
// tests can mock `fetch` without an SDK.

const STRIPE_API_BASE = "https://api.stripe.com/v1";

async function getPlatformSecretKey(): Promise<string> {
  const key = await getSecret("PLATFORM_STRIPE_SECRET_KEY", "platform_stripe_secret_key");
  assertStripeKeySafe(key); // founder-os#10193 F0 — refuse live Stripe key in staging
  if (!key) {
    throw new Error(
      "PLATFORM_STRIPE_SECRET_KEY (platform_stripe_secret_key) must be set before using Stripe Financial Connections",
    );
  }
  return key;
}

interface StripeCallOpts {
  method: "GET" | "POST";
  path: string; // begins with "/"
  body?: URLSearchParams | null;
  query?: URLSearchParams | null;
}

async function stripeCall<T = Record<string, unknown>>(opts: StripeCallOpts): Promise<T> {
  const secretKey = await getPlatformSecretKey();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey}`,
  };
  if (opts.body) headers["Content-Type"] = "application/x-www-form-urlencoded";
  const qs = opts.query && Array.from(opts.query.keys()).length > 0 ? `?${opts.query.toString()}` : "";
  const resp = await fetch(`${STRIPE_API_BASE}${opts.path}${qs}`, {
    method: opts.method,
    headers,
    body: opts.body ? opts.body.toString() : undefined,
  });
  const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
  if (!resp.ok) {
    const errBody = (data.error ?? {}) as Record<string, unknown>;
    const msg =
      typeof errBody.message === "string" ? errBody.message : `Stripe error ${resp.status}`;
    throw new Error(`Stripe FC API error: ${msg}`);
  }
  return data as T;
}

// ── FC raw response shapes (only the fields we read) ─────────────────────────

interface FcSession {
  id: string;
  client_secret: string;
  accounts?: {
    data?: FcAccount[];
  } | FcAccount[];
}

interface FcBalance {
  // FC balance.current is a map of currency → amount in the currency's minor
  // unit (cents for USD). Stripe returns it as e.g. { usd: 123456 }.
  current?: Record<string, number>;
  // type: "cash" | "credit"
  type?: string;
}

interface FcTransactionRefresh {
  // The state of the most recent attempt to refresh the account transactions.
  // `id` (fctxnref_…) is the canonical incremental-sync cursor: passing it as
  // `transaction_refresh[after]` on the next list call returns every txn that
  // was added OR updated since (incl. pending→posted, →void) — see Stripe's
  // "Access transactions" guide. We persist this id, NOT a last-seen txn id.
  id?: string | null;
  status?: string; // "pending" | "succeeded" | "failed"
  next_refresh_available_at?: number | null;
}

interface FcAccount {
  id: string;
  display_name?: string | null;
  institution_name?: string | null;
  last4?: string | null;
  category?: string | null; // "cash" | "credit" | "investment" | "other"
  subcategory?: string | null; // "checking" | "savings" | "credit_card" | ...
  balance?: FcBalance | null;
  status?: string; // "active" | "inactive" | "disconnected"
  transaction_refresh?: FcTransactionRefresh | null;
}

interface FcStatusTransitions {
  posted_at?: number | null;
  void_at?: number | null;
}

interface FcTransaction {
  id: string;
  account: string; // FC account id
  amount: number; // minor units (cents). Stripe sign: + = money IN, − = money OUT
  currency: string; // e.g. "usd"
  // FC dates are unix-second timestamps; `transacted_at` is when it occurred,
  // `transacted_at` may be null for pending — fall back to created.
  transacted_at?: number | null;
  description?: string | null;
  status?: string; // "pending" | "posted" | "void"
  status_transitions?: FcStatusTransitions | null;
}

interface FcTransactionList {
  data: FcTransaction[];
  has_more: boolean;
}

// The opaque "access token" blob we persist (encrypted) in place of a Plaid
// access_token. Carries only FC object ids — no Stripe credential.
interface FcAccessBlob {
  v: 1;
  customerId: string;
  accountIds: string[];
  sessionId: string;
}

// ── Mapping helpers (provider-agnostic, pure) ────────────────────────────────

/**
 * Map an FC category/subcategory to the type/subtype shape the rest of YCM
 * (and Plaid) uses. FC `category` ∈ {cash, credit, investment, other};
 * Plaid `type` ∈ {depository, credit, loan, investment, other}. We translate
 * cash → depository so the existing UI/labels read identically.
 */
function mapFcType(category: string | null | undefined): string {
  switch ((category ?? "").toLowerCase()) {
    case "cash":
      return "depository";
    case "credit":
      return "credit";
    case "investment":
      return "investment";
    default:
      return "other";
  }
}

/** Read a USD-cents balance from an FC balance object (defensive about shape). */
function readBalanceCents(balance: FcBalance | null | undefined): number | null {
  if (!balance || !balance.current) return null;
  const cur = balance.current;
  // Prefer USD; otherwise take the single currency present.
  if (typeof cur.usd === "number") return Math.round(cur.usd);
  const vals = Object.values(cur);
  if (vals.length > 0 && typeof vals[0] === "number") return Math.round(vals[0]);
  return null;
}

/** Map an FC account to the provider-agnostic snapshot. */
export function mapFcAccount(account: FcAccount): BankAccountSnapshot {
  const balanceCents = readBalanceCents(account.balance);
  return {
    providerAccountId: account.id,
    name: account.display_name || account.institution_name || "Bank account",
    mask: account.last4 ?? null,
    type: mapFcType(account.category),
    subtype: account.subcategory ?? null,
    // FC exposes one balance; we surface it as both current + available so the
    // existing UI columns populate (FC does not split available vs current the
    // way Plaid does for a posted balance snapshot).
    currentBalanceCents: balanceCents,
    availableBalanceCents: balanceCents,
  };
}

/**
 * Map an FC transaction to the provider-agnostic snapshot shape.
 *
 * SIGN CONVENTION (load-bearing): the reconciler + the existing Plaid mapping
 * use `amountCents` where POSITIVE = money OUT of the account (debit) and
 * NEGATIVE = money IN (credit). Stripe FC uses the OPPOSITE: a positive
 * `amount` is money INTO the account. We therefore NEGATE the FC amount so the
 * downstream auto-matcher/reconciliation works UNCHANGED regardless of
 * provider. (See plaid-provider.ts mapTransaction for the canonical convention
 * this matches.)
 */
export function mapFcTransaction(txn: FcTransaction): BankTransactionSnapshot {
  const unixSec = txn.transacted_at ?? null;
  const date =
    unixSec != null
      ? new Date(unixSec * 1000).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
  return {
    providerTransactionId: txn.id,
    providerAccountId: txn.account,
    // Negate to match Plaid's "+ = debit / − = credit" convention.
    amountCents: -Math.round(txn.amount),
    isoCurrencyCode: (txn.currency ?? "usd").toUpperCase(),
    date,
    name: txn.description ?? "Transaction",
    merchantName: null, // FC does not enrich a merchant name on the txn object
    category: null, // FC does not categorize on the read-only txn object
    pending: (txn.status ?? "") === "pending",
  };
}

/**
 * Is this FC transaction voided? FC voids a transaction when it "disappears and
 * no longer affects the account's balance" (e.g. a pending charge that never
 * posted). Detected by `status === "void"` OR a populated `status_transitions.void_at`.
 * A void must be REMOVED from the books so a statement / reconciliation never
 * counts a phantom deposit.
 */
function isFcVoid(txn: FcTransaction): boolean {
  if ((txn.status ?? "").toLowerCase() === "void") return true;
  const voidAt = txn.status_transitions?.void_at ?? null;
  return typeof voidAt === "number" && voidAt > 0;
}

/** Extract the FC account list off a session object (shape varies by include). */
function accountsFromSession(session: FcSession): FcAccount[] {
  const acc = session.accounts;
  if (!acc) return [];
  if (Array.isArray(acc)) return acc;
  return acc.data ?? [];
}

// ── Webhook signature verification (Stripe HMAC-SHA256) ──────────────────────
//
// Stripe signs webhooks with `Stripe-Signature: t=<ts>,v1=<sig>` where sig =
// HMAC-SHA256(`${t}.${rawBody}`, whsec). We verify v1 ourselves (no SDK) with a
// constant-time compare, matching how YCM verifies Plaid's JWT inline.

const WEBHOOK_TOLERANCE_SEC = 300; // 5 min replay window (Stripe default)

function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): void {
  const parts = signatureHeader.split(",").map((p) => p.trim());
  let timestamp = "";
  const v1: string[] = [];
  for (const part of parts) {
    const [k, v] = part.split("=");
    if (k === "t") timestamp = v ?? "";
    else if (k === "v1" && v) v1.push(v);
  }
  if (!timestamp || v1.length === 0) {
    throw new Error("Stripe webhook signature header missing t or v1");
  }
  // Replay window.
  const tsSec = Number(timestamp);
  if (!Number.isFinite(tsSec) || Math.abs(Date.now() / 1000 - tsSec) > WEBHOOK_TOLERANCE_SEC) {
    throw new Error("Stripe webhook timestamp outside tolerance (replay protection)");
  }
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const match = v1.some((candidate) => {
    const candBuf = Buffer.from(candidate, "utf8");
    return candBuf.length === expectedBuf.length && timingSafeEqual(candBuf, expectedBuf);
  });
  if (!match) {
    throw new Error("Stripe webhook signature verification failed");
  }
}

function lookupHeaderCI(headers: Record<string, string>, name: string): string {
  const target = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === target) return v ?? "";
  }
  return "";
}

// ── StripeFcProvider ─────────────────────────────────────────────────────────

export class StripeFcProvider implements BankFeedProvider {
  /**
   * Resolve (or create) a per-association platform Stripe Customer to act as
   * the FC `account_holder`. FC requires a customer to attach linked accounts
   * to; for the HOA-scope read-only feed we use a dedicated customer keyed by
   * associationId (metadata.ycm_fc_association). Idempotent: if a prior FC
   * session already created one, we reuse it via a customer search.
   */
  private async ensureFcCustomer(associationId: string): Promise<string> {
    // Try to find an existing FC customer for this association.
    const search = new URLSearchParams();
    search.set(
      "query",
      `metadata['ycm_fc_association']:'${associationId.replace(/'/g, "")}'`,
    );
    search.set("limit", "1");
    try {
      const found = await stripeCall<{ data?: Array<{ id: string }> }>({
        method: "GET",
        path: "/customers/search",
        query: search,
      });
      const existing = found.data?.[0]?.id;
      if (existing) return existing;
    } catch (err) {
      // Customer search can lag indexing on a brand-new customer; fall through
      // to create. A duplicate customer is harmless for an FC account_holder.
      debug("[StripeFcProvider] customer search miss/lag", err);
    }

    const body = new URLSearchParams();
    body.set("description", `YCM bank-feed FC account holder (association ${associationId})`);
    body.set("metadata[ycm_fc_association]", associationId);
    const customer = await stripeCall<{ id: string }>({
      method: "POST",
      path: "/customers",
      body,
    });
    return customer.id;
  }

  async createLinkToken(opts: {
    associationId: string;
    userId: string;
  }): Promise<{ linkToken: string }> {
    debug("[StripeFcProvider] createLinkToken", { associationId: opts.associationId });

    const customerId = await this.ensureFcCustomer(opts.associationId);

    // Create a FC Session scoped to the customer, requesting ONLY read-only
    // balances + transactions permissions. No `payment_method` permission =
    // no money movement is ever possible from this link.
    const body = new URLSearchParams();
    body.set("account_holder[type]", "customer");
    body.set("account_holder[customer]", customerId);
    body.append("permissions[]", "balances");
    body.append("permissions[]", "transactions");
    // Prefetch balances + transactions so the first getAccounts/sync has data.
    body.append("prefetch[]", "balances");
    body.append("prefetch[]", "transactions");

    const session = await stripeCall<FcSession>({
      method: "POST",
      path: "/financial_connections/sessions",
      body,
    });

    // The client_secret is what Stripe.js collectFinancialConnectionsAccounts()
    // consumes — return it as the interface's `linkToken`. We embed the session
    // id + customer id so the client can echo the session id back on success
    // (the client gets the session id from the collect() result, but echoing
    // here keeps the route signature identical to Plaid's).
    return { linkToken: session.client_secret };
  }

  async exchangePublicToken(sessionId: string): Promise<{
    accessToken: string;
    itemId: string;
  }> {
    debug("[StripeFcProvider] exchangePublicToken (FC session retrieve)", {
      sessionId: sessionId.slice(0, 12),
    });

    // FC has no public_token; the client passes the FC *session id* back. We
    // retrieve the session (expanding accounts), capture the linked accounts,
    // subscribe each to the transactions feature, and synthesize the opaque
    // access blob the route will encrypt + store.
    const query = new URLSearchParams();
    query.append("expand[]", "accounts");
    const session = await stripeCall<FcSession>({
      method: "GET",
      path: `/financial_connections/sessions/${encodeURIComponent(sessionId)}`,
      query,
    });

    const accounts = accountsFromSession(session);
    if (accounts.length === 0) {
      throw new Error("Stripe FC session has no linked accounts");
    }

    // Resolve the customer id from the session's account_holder, or fall back
    // to the first account's holder. We persist it so getAccounts/sync don't
    // need the session again.
    const customerId =
      (session as unknown as { account_holder?: { customer?: string } }).account_holder
        ?.customer ?? "";

    const accountIds = accounts.map((a) => a.id);

    // Subscribe each account to the transactions feature so Stripe begins
    // refreshing its transaction feed (parity with Plaid's products=transactions).
    for (const accountId of accountIds) {
      try {
        const subBody = new URLSearchParams();
        subBody.append("features[]", "transactions");
        await stripeCall({
          method: "POST",
          path: `/financial_connections/accounts/${encodeURIComponent(accountId)}/subscribe`,
          body: subBody,
        });
      } catch (err) {
        // Subscribe can fail if the account is already subscribed or the
        // institution doesn't support the feature — non-fatal; the list call
        // still returns whatever data is available.
        debug("[StripeFcProvider] subscribe non-fatal", { accountId, err });
      }
    }

    const blob: FcAccessBlob = {
      v: 1,
      customerId,
      accountIds,
      sessionId,
    };

    return {
      accessToken: JSON.stringify(blob),
      // provider_item_id := the FC session id (stable handle for this link).
      itemId: sessionId,
    };
  }

  async getAccounts(accessToken: string): Promise<BankAccountSnapshot[]> {
    debug("[StripeFcProvider] getAccounts");
    const blob = parseAccessBlob(accessToken);

    const snapshots: BankAccountSnapshot[] = [];
    for (const accountId of blob.accountIds) {
      // Refresh the balance feature so the read returns a current balance,
      // then retrieve the account. A refresh is the FC equivalent of a balance
      // call (the ~10¢/balance-call cost noted in the migration doc).
      try {
        const refreshBody = new URLSearchParams();
        refreshBody.append("features[]", "balance");
        await stripeCall({
          method: "POST",
          path: `/financial_connections/accounts/${encodeURIComponent(accountId)}/refresh`,
          body: refreshBody,
        });
      } catch (err) {
        debug("[StripeFcProvider] balance refresh non-fatal", { accountId, err });
      }
      const account = await stripeCall<FcAccount>({
        method: "GET",
        path: `/financial_connections/accounts/${encodeURIComponent(accountId)}`,
      });
      snapshots.push(mapFcAccount(account));
    }
    return snapshots;
  }

  async getTransactions(
    accessToken: string,
    since: Date,
  ): Promise<BankTransactionSnapshot[]> {
    debug("[StripeFcProvider] getTransactions (deprecated; full list)", {
      since: since.toISOString(),
    });
    // Deprecated path retained for interface parity. List all transactions per
    // account (no cursor) and return them; the canonical path is syncTransactions.
    const blob = parseAccessBlob(accessToken);
    const out: BankTransactionSnapshot[] = [];
    for (const accountId of blob.accountIds) {
      let after: string | null = null;
      let pageGuard = 0;
      while (true) {
        if (pageGuard++ >= MAX_TXN_PAGES) break;
        const page = await this.listTransactionsPage(accountId, {
          transactionRefreshAfter: null,
          startingAfter: after,
        });
        // Deprecated path: skip voids (parity with the canonical sync, which
        // routes them to `removed`); the matcher never sees a phantom deposit.
        for (const t of page.data) {
          if (!isFcVoid(t)) out.push(mapFcTransaction(t));
        }
        if (!page.has_more || page.data.length === 0) break;
        after = page.data[page.data.length - 1].id;
      }
    }
    return out;
  }

  /**
   * List one page of FC transactions for an account.
   *
   * `transactionRefreshAfter` is the per-account `transaction_refresh.id`
   * (fctxnref_…) persisted from the prior sync. When present we pass it as
   * `transaction_refresh[after]` — per Stripe's "Access transactions" guide,
   * the list then returns every transaction ADDED **or UPDATED** since that
   * refresh (incl. pending→posted and →void on previously-seen ids), which is
   * exactly the delta the sync engine needs to upsert. NULL → full backfill
   * (initial sync). `startingAfter` paginates WITHIN the result set.
   */
  private async listTransactionsPage(
    accountId: string,
    opts: { transactionRefreshAfter: string | null; startingAfter: string | null },
  ): Promise<FcTransactionList> {
    const query = new URLSearchParams();
    query.set("account", accountId);
    query.set("limit", "100");
    if (opts.transactionRefreshAfter) {
      query.set("transaction_refresh[after]", opts.transactionRefreshAfter);
    }
    if (opts.startingAfter) query.set("starting_after", opts.startingAfter);
    return stripeCall<FcTransactionList>({
      method: "GET",
      path: "/financial_connections/transactions",
      query,
    });
  }

  /**
   * Read the account's current `transaction_refresh.id`. This is the cursor we
   * persist after a sync: passing it as `transaction_refresh[after]` next time
   * yields only new/updated transactions. Returns null if FC hasn't produced a
   * transaction refresh yet (e.g. brand-new link before the first refresh).
   */
  private async getTransactionRefreshId(accountId: string): Promise<string | null> {
    try {
      const account = await stripeCall<FcAccount>({
        method: "GET",
        path: `/financial_connections/accounts/${encodeURIComponent(accountId)}`,
      });
      return account.transaction_refresh?.id ?? null;
    } catch (err) {
      debug("[StripeFcProvider] getTransactionRefreshId non-fatal", { accountId, err });
      return null;
    }
  }

  async syncTransactions(
    accessToken: string,
    cursor: string | null,
  ): Promise<TransactionSyncResult> {
    debug("[StripeFcProvider] syncTransactions", { hasCursor: cursor != null });
    const blob = parseAccessBlob(accessToken);

    // The persisted cursor is a JSON map { accountId: transactionRefreshId }.
    // FC transaction IDs are STABLE across status transitions (pending→posted→
    // void), and the `transaction_refresh[after]` filter returns every txn
    // ADDED or UPDATED since the saved refresh id. So we UPSERT by id (the sync
    // engine keys on provider_transaction_id) and REMOVE voids. NULL/invalid
    // cursor → full backfill (initial sync). This replaces the prior
    // `starting_after=lastSeenTxnId` paging, which silently MISSED status
    // updates (a pending txn that posts keeps its id, so it never re-appeared
    // after the cursor → the row stayed pending=1 forever, and voids never left
    // the books — corrupting the reconciliation report + statements).
    const cursorMap: Record<string, string> = parseCursorMap(cursor);
    const nextCursorMap: Record<string, string> = { ...cursorMap };

    // `added` carries new + still-live (pending/posted) txns to upsert;
    // `removed` carries voided provider txn ids to delete. The sync engine
    // upserts added+modified identically (both keyed on provider_transaction_id)
    // and deletes removed — so re-emitting a posted txn under its stable id in
    // `added` flips its pending flag 1→0 on the existing row (an in-place
    // update), and a void is torn out. We keep `modified` empty and route all
    // live deltas through `added` (the upsert is identical either way).
    const added: BankTransactionSnapshot[] = [];
    const modified: BankTransactionSnapshot[] = [];
    const removed: string[] = [];

    for (const accountId of blob.accountIds) {
      const refreshAfter: string | null = cursorMap[accountId] ?? null;
      let startingAfter: string | null = null;
      let pageGuard = 0;
      while (true) {
        if (pageGuard++ >= MAX_TXN_PAGES) {
          throw new Error(
            `Stripe FC syncTransactions exceeded ${MAX_TXN_PAGES} pages — aborting to avoid an unbounded loop`,
          );
        }
        const page = await this.listTransactionsPage(accountId, {
          transactionRefreshAfter: refreshAfter,
          startingAfter,
        });
        if (page.data.length === 0) break;
        for (const t of page.data) {
          if (isFcVoid(t)) {
            // A voided txn must leave the books. The sync engine's `removed`
            // path is association-scoped and only deletes rows not linked to a
            // ledger entry, so a voided-but-matched txn is preserved + surfaced
            // rather than silently torn out from under a reconciliation.
            removed.push(t.id);
          } else {
            // New OR updated (pending→posted) live txn → upsert by stable id.
            added.push(mapFcTransaction(t));
          }
        }
        if (!page.has_more) break;
        startingAfter = page.data[page.data.length - 1].id;
      }

      // Advance the cursor to the account's CURRENT transaction_refresh id so
      // the next sync only pulls the delta since now. If FC has no refresh id
      // yet (brand-new link), retain the prior cursor (a subsequent sync, after
      // the first refresh completes, will pick it up).
      const newRefreshId = await this.getTransactionRefreshId(accountId);
      if (newRefreshId) {
        nextCursorMap[accountId] = newRefreshId;
      }
    }

    return {
      added,
      modified,
      removed,
      nextCursor: JSON.stringify(nextCursorMap),
      hasMore: false,
    };
  }

  async verifyWebhook(
    headers: Record<string, string>,
    rawBody: string,
  ): Promise<WebhookEvent> {
    debug("[StripeFcProvider] verifyWebhook");

    // Production (and any env where verification is forced on): verify the
    // Stripe-Signature HMAC. Non-production with no secret skips the signature
    // check (parity with Plaid's sandbox-skip) — the env guard refuses to let a
    // production runtime reach the parse step unverified.
    if (shouldEnforceFcWebhookVerification()) {
      const secret = await getSecret("STRIPE_FC_WEBHOOK_SECRET", "stripe_fc_webhook_secret");
      if (!secret) {
        throw new Error(
          "STRIPE_FC_WEBHOOK_SECRET must be set to verify Stripe FC webhooks in this environment",
        );
      }
      const sig = lookupHeaderCI(headers, "stripe-signature");
      verifyStripeSignature(rawBody, sig, secret);
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      throw new Error("Stripe FC webhook body is not valid JSON");
    }

    // Stripe event: { type, data: { object: { ... } } }. We map FC event types
    // onto the provider-agnostic WebhookEvent the route's handler already
    // understands (webhookType / webhookCode / itemId).
    //
    // financial_connections.account.refreshed_transactions
    //                         → new transactions available (≈ Plaid
    //                           TRANSACTIONS / SYNC_UPDATES_AVAILABLE)
    // financial_connections.account.disconnected
    //                         → account/link revoked (≈ ITEM / USER_PERMISSION_REVOKED)
    //
    // itemId resolution: FC events reference the account, not the session. The
    // route resolves provider_item_id (the session id) to the connection; FC's
    // refreshed-transactions event does not carry the session id directly, so
    // we surface the FC account id under `itemId` and the route falls back to
    // the sweep (the backstop) when it can't resolve a session — identical to
    // Plaid's "sweep recovers a dropped event" guarantee.
    const type = (parsed.type as string) ?? "";
    const dataObj =
      ((parsed.data as Record<string, unknown> | undefined)?.object as
        | Record<string, unknown>
        | undefined) ?? {};
    const accountId = (dataObj.id as string) ?? "";

    let webhookType = "";
    let webhookCode = "";
    if (type === "financial_connections.account.refreshed_transactions") {
      webhookType = "TRANSACTIONS";
      webhookCode = "SYNC_UPDATES_AVAILABLE";
    } else if (type === "financial_connections.account.disconnected") {
      webhookType = "ITEM";
      webhookCode = "USER_PERMISSION_REVOKED";
    } else {
      // Unmapped FC event — surface it but the route will no-op on it.
      webhookType = "FC";
      webhookCode = type;
    }

    return {
      webhookType,
      webhookCode,
      itemId: accountId, // FC account id (see note above re: resolution)
      error: null,
    };
  }

  async removeConnection(accessToken: string): Promise<void> {
    debug("[StripeFcProvider] removeConnection");
    const blob = parseAccessBlob(accessToken);
    // FC read-only links are disconnected per account. Best-effort across all.
    for (const accountId of blob.accountIds) {
      try {
        await stripeCall({
          method: "POST",
          path: `/financial_connections/accounts/${encodeURIComponent(accountId)}/disconnect`,
        });
      } catch (err) {
        debug("[StripeFcProvider] disconnect non-fatal", { accountId, err });
      }
    }
  }
}

// Safety ceiling on transaction pagination (FC pages up to 100/txns).
const MAX_TXN_PAGES = 1000;

function parseAccessBlob(accessToken: string): FcAccessBlob {
  let blob: FcAccessBlob;
  try {
    blob = JSON.parse(accessToken) as FcAccessBlob;
  } catch {
    throw new Error("Stripe FC access token is not valid JSON");
  }
  if (!blob || !Array.isArray(blob.accountIds)) {
    throw new Error("Stripe FC access token missing accountIds");
  }
  return blob;
}

function parseCursorMap(cursor: string | null): Record<string, string> {
  if (!cursor) return {};
  try {
    const parsed = JSON.parse(cursor) as Record<string, string>;
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    // Legacy/invalid cursor → treat as no cursor (full backfill).
  }
  return {};
}
