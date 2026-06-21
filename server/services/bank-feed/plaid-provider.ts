/**
 * PlaidProvider — concrete BankFeedProvider implementation backed by the Plaid SDK.
 *
 * All interaction with Plaid happens here. No other YCM file should import
 * from `plaid` directly — depend on the BankFeedProvider interface instead.
 *
 * Env vars required:
 *   PLAID_CLIENT_ID          — client ID (same across all environments)
 *   PLAID_SECRET_SANDBOX     — secret for sandbox env
 *   PLAID_SECRET_DEVELOPMENT — secret for development env
 *   PLAID_SECRET_PRODUCTION  — secret for production env
 *   PLAID_ENV                — "sandbox" | "development" | "production"
 *   PLAID_WEBHOOK_URL        — URL Plaid will POST webhook events to
 *   PLAID_REDIRECT_URI       — OAuth redirect URI (used for Link OAuth flows)
 *   PLAID_WEBHOOK_VERIFICATION — optional; "false" disables JWT verification
 *                                (DANGEROUS — production refuses to boot if so)
 *
 * Production hardening (2026-06-21):
 *   - verifyWebhook performs real JWT (JWS/ES256) verification in production
 *     (see ./plaid-webhook-verify.ts) and throws on any failure.
 *   - transactions are pulled via /transactions/sync (cursor-based);
 *     getTransactions(/transactions/get) is retained only as deprecated.
 *   - the env-flip guard (./plaid-env-guard.ts) refuses production unless the
 *     verifier + prod keys are wired.
 */

import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
  type Transaction,
  type RemovedTransaction,
  type AccountBase,
} from "plaid";
import { debug } from "../../logger";
import type {
  BankFeedProvider,
  BankAccountSnapshot,
  BankTransactionSnapshot,
  TransactionSyncResult,
  WebhookEvent,
} from "./provider";
import { verifyPlaidWebhook } from "./plaid-webhook-verify";
import { shouldEnforceWebhookVerification } from "./plaid-env-guard";

// ── Plaid client singleton ───────────────────────────────────────────────────

function getPlaidSecret(): string {
  const env = (process.env.PLAID_ENV ?? "sandbox").toLowerCase();
  switch (env) {
    case "production":
      return process.env.PLAID_SECRET_PRODUCTION ?? "";
    case "development":
      return process.env.PLAID_SECRET_DEVELOPMENT ?? "";
    default:
      return process.env.PLAID_SECRET_SANDBOX ?? "";
  }
}

function buildPlaidClient(): PlaidApi {
  const env = (process.env.PLAID_ENV ?? "sandbox").toLowerCase();
  const baseUrl =
    env === "production"
      ? PlaidEnvironments.production
      : env === "development"
        ? PlaidEnvironments.development
        : PlaidEnvironments.sandbox;

  const config = new Configuration({
    basePath: baseUrl,
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID ?? "",
        "PLAID-SECRET": getPlaidSecret(),
      },
    },
  });

  return new PlaidApi(config);
}

// Lazy singleton — built on first use so missing env vars surface at runtime
// rather than cold-start (matches the pattern used throughout storage.ts).
let _plaidClient: PlaidApi | null = null;
function getClient(): PlaidApi {
  if (!_plaidClient) {
    _plaidClient = buildPlaidClient();
  }
  return _plaidClient;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Map a Plaid AccountBase to our provider-agnostic snapshot shape. */
function mapAccount(account: AccountBase): BankAccountSnapshot {
  return {
    providerAccountId: account.account_id,
    name: account.name,
    mask: account.mask ?? null,
    type: account.type,
    subtype: account.subtype ?? null,
    currentBalanceCents:
      account.balances.current != null
        ? Math.round(account.balances.current * 100)
        : null,
    availableBalanceCents:
      account.balances.available != null
        ? Math.round(account.balances.available * 100)
        : null,
  };
}

/**
 * Map a Plaid Transaction to our provider-agnostic snapshot shape.
 *
 * Plaid amount sign convention: positive = money OUT of the account (debit),
 * negative = money INTO the account (credit). We preserve that convention in
 * amountCents so the reconciliation layer doesn't need to know about Plaid.
 */
function mapTransaction(txn: Transaction): BankTransactionSnapshot {
  return {
    providerTransactionId: txn.transaction_id,
    providerAccountId: txn.account_id,
    amountCents: Math.round(txn.amount * 100),
    isoCurrencyCode: txn.iso_currency_code ?? "USD",
    date: txn.date,
    name: txn.name,
    merchantName: txn.merchant_name ?? null,
    category:
      txn.personal_finance_category?.primary ??
      (txn.category && txn.category.length > 0 ? txn.category[0] : null),
    pending: txn.pending,
  };
}

/** Case-insensitive header lookup (Express lowercases, but be defensive). */
function lookupHeaderCI(
  headers: Record<string, string>,
  name: string,
): string {
  const target = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === target) return v ?? "";
  }
  return "";
}

// ── PlaidProvider ────────────────────────────────────────────────────────────

export class PlaidProvider implements BankFeedProvider {
  async createLinkToken(opts: {
    associationId: string;
    userId: string;
  }): Promise<{ linkToken: string }> {
    debug("[PlaidProvider] createLinkToken", { associationId: opts.associationId });

    const webhookUrl = process.env.PLAID_WEBHOOK_URL;
    const redirectUri = process.env.PLAID_REDIRECT_URI;

    const response = await getClient().linkTokenCreate({
      user: {
        // client_user_id must be unique and stable for the end user.
        // We combine associationId + userId to scope it properly.
        client_user_id: `${opts.associationId}:${opts.userId}`,
      },
      client_name: "YourCondoManager",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
      ...(webhookUrl ? { webhook: webhookUrl } : {}),
      ...(redirectUri ? { redirect_uri: redirectUri } : {}),
    });

    return { linkToken: response.data.link_token };
  }

  async exchangePublicToken(publicToken: string): Promise<{
    accessToken: string;
    itemId: string;
  }> {
    debug("[PlaidProvider] exchangePublicToken");

    const response = await getClient().itemPublicTokenExchange({
      public_token: publicToken,
    });

    return {
      accessToken: response.data.access_token,
      itemId: response.data.item_id,
    };
  }

  async getAccounts(accessToken: string): Promise<BankAccountSnapshot[]> {
    debug("[PlaidProvider] getAccounts");

    const response = await getClient().accountsGet({
      access_token: accessToken,
    });

    return response.data.accounts.map(mapAccount);
  }

  async getTransactions(
    accessToken: string,
    since: Date,
  ): Promise<BankTransactionSnapshot[]> {
    debug("[PlaidProvider] getTransactions", { since: since.toISOString() });

    const startDate = since.toISOString().slice(0, 10); // YYYY-MM-DD
    const endDate = new Date().toISOString().slice(0, 10);

    // Page through all results — Plaid paginates at 500 by default.
    const all: BankTransactionSnapshot[] = [];
    let offset = 0;
    const count = 500;

    while (true) {
      const response = await getClient().transactionsGet({
        access_token: accessToken,
        start_date: startDate,
        end_date: endDate,
        options: {
          count,
          offset,
          include_personal_finance_category: true,
        },
      });

      const { transactions, total_transactions } = response.data;
      all.push(...transactions.map(mapTransaction));

      offset += transactions.length;
      if (offset >= total_transactions) break;
    }

    return all;
  }

  async syncTransactions(
    accessToken: string,
    cursor: string | null,
  ): Promise<TransactionSyncResult> {
    debug("[PlaidProvider] syncTransactions", { hasCursor: cursor != null });

    const added: BankTransactionSnapshot[] = [];
    const modified: BankTransactionSnapshot[] = [];
    const removed: string[] = [];

    // Plaid requires `null`/omitted cursor for the initial sync, then the
    // returned cursor for each subsequent page. We drain `has_more` here so the
    // caller persists exactly one final cursor per sync.
    let nextCursor: string = cursor ?? "";
    let hasMore = true;
    // Safety ceiling: Plaid pages 100-500 txns; thousands of pages would be
    // pathological. Bound the loop so a provider bug can't spin forever.
    let pageGuard = 0;
    const MAX_PAGES = 1000;

    while (hasMore) {
      if (pageGuard++ >= MAX_PAGES) {
        throw new Error(
          `Plaid syncTransactions exceeded ${MAX_PAGES} pages — aborting to avoid an unbounded loop`,
        );
      }

      const response = await getClient().transactionsSync({
        access_token: accessToken,
        // Initial sync: omit cursor entirely. Subsequent: pass the latest.
        ...(nextCursor ? { cursor: nextCursor } : {}),
        options: {
          include_personal_finance_category: true,
        },
      });

      const data = response.data;
      for (const txn of data.added as Transaction[]) {
        added.push(mapTransaction(txn));
      }
      for (const txn of data.modified as Transaction[]) {
        modified.push(mapTransaction(txn));
      }
      for (const rt of data.removed as RemovedTransaction[]) {
        if (rt.transaction_id) removed.push(rt.transaction_id);
      }

      nextCursor = data.next_cursor;
      hasMore = data.has_more;
    }

    return { added, modified, removed, nextCursor, hasMore: false };
  }

  async verifyWebhook(
    headers: Record<string, string>,
    rawBody: string,
  ): Promise<WebhookEvent> {
    debug("[PlaidProvider] verifyWebhook");

    // Production (and any env where verification is explicitly forced on):
    // perform full JWT (JWS/ES256) signature + body-hash + replay verification.
    // Plaid does NOT sign sandbox webhooks, so sandbox/development skip the
    // signature check (unless PLAID_WEBHOOK_VERIFICATION forces it on). The
    // decision is mechanical via the env guard — a production runtime cannot
    // reach the parse step without first passing verification.
    if (shouldEnforceWebhookVerification()) {
      // Header names are case-insensitive over the wire; Express lowercases
      // them. Look the value up case-insensitively for safety.
      const jwt = lookupHeaderCI(headers, "plaid-verification");
      // Throws on ANY verification failure — caller MUST reject the webhook.
      await verifyPlaidWebhook(getClient(), jwt, rawBody);
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      throw new Error("Plaid webhook body is not valid JSON");
    }

    const webhookType = (parsed.webhook_type as string) ?? "";
    const webhookCode = (parsed.webhook_code as string) ?? "";
    const itemId = (parsed.item_id as string) ?? "";
    const error =
      parsed.error != null
        ? JSON.stringify(parsed.error)
        : null;

    return { webhookType, webhookCode, itemId, error };
  }

  async removeConnection(accessToken: string): Promise<void> {
    debug("[PlaidProvider] removeConnection");

    await getClient().itemRemove({
      access_token: accessToken,
    });
  }
}
