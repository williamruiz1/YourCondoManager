/**
 * BankFeedProvider — provider-agnostic abstraction for bank data connections.
 *
 * All YCM code that needs bank-feed data MUST depend on this interface,
 * never on the Plaid SDK or any other provider SDK directly. This lets
 * a future swap to MX, Finicity, or another provider cost 1-2 weeks
 * (new implementation file) instead of a codebase-wide rewrite.
 *
 * Current implementation: PlaidProvider (server/services/bank-feed/plaid-provider.ts)
 */

// ── Value types returned by the provider ────────────────────────────────────

export interface BankAccountSnapshot {
  providerAccountId: string;
  name: string;
  mask: string | null;
  type: string; // depository | credit | loan | investment | other
  subtype: string | null; // checking | savings | etc.
  currentBalanceCents: number | null;
  availableBalanceCents: number | null;
}

export interface BankTransactionSnapshot {
  providerTransactionId: string;
  providerAccountId: string;
  amountCents: number; // positive = debit (money out), negative = credit (money in)
  isoCurrencyCode: string;
  date: string; // ISO 8601 date string, e.g. "2026-01-15"
  name: string;
  merchantName: string | null;
  category: string | null;
  pending: boolean;
}

export interface WebhookEvent {
  webhookType: string; // e.g. "TRANSACTIONS", "ITEM"
  webhookCode: string; // e.g. "SYNC_UPDATES_AVAILABLE", "ERROR"
  itemId: string; // Plaid's item_id (matches providerItemId in bank_connections)
  error: string | null;
}

/**
 * Result of a cursor-based incremental transactions sync (/transactions/sync).
 *
 * `added` + `modified` carry full transaction snapshots to upsert; `removed`
 * carries provider transaction ids to delete (Plaid removes a pending txn once
 * it posts under a new id). `nextCursor` MUST be persisted by the caller and
 * passed back on the next sync — it is the resumption point. The provider
 * drains all pages internally, so `hasMore` is always false on return.
 */
export interface TransactionSyncResult {
  added: BankTransactionSnapshot[];
  modified: BankTransactionSnapshot[];
  removed: string[]; // providerTransactionId values to delete
  nextCursor: string;
  hasMore: boolean;
}

// ── Provider interface ───────────────────────────────────────────────────────

export interface BankFeedProvider {
  /**
   * Returns a link_token the frontend uses to launch the Plaid Link UI.
   * Scoped to a specific association + user for multi-tenant isolation.
   */
  createLinkToken(opts: {
    associationId: string;
    userId: string;
  }): Promise<{ linkToken: string }>;

  /**
   * Exchanges the public_token returned by Plaid Link's onSuccess callback
   * for a permanent access_token + item_id.
   * The caller is responsible for encrypting and storing the access_token.
   */
  exchangePublicToken(publicToken: string): Promise<{
    accessToken: string;
    itemId: string;
  }>;

  /**
   * Returns all accounts associated with the given access_token.
   */
  getAccounts(accessToken: string): Promise<BankAccountSnapshot[]>;

  /**
   * @deprecated Use {@link syncTransactions} (cursor-based /transactions/sync).
   *
   * Returns transactions since the given date for the given access_token via
   * Plaid's DEPRECATED /transactions/get. Retained only for any legacy caller;
   * the canonical path is the incremental cursor sync below.
   */
  getTransactions(
    accessToken: string,
    since: Date,
  ): Promise<BankTransactionSnapshot[]>;

  /**
   * Incrementally sync transactions via Plaid's /transactions/sync (the
   * canonical, non-deprecated endpoint). Pass the last persisted cursor
   * (`null` for a first/initial sync); the provider drains every page and
   * returns the combined added/modified/removed deltas plus the new cursor to
   * persist. Idempotent against duplicate webhook deliveries — re-running with
   * the same cursor returns the same delta.
   */
  syncTransactions(
    accessToken: string,
    cursor: string | null,
  ): Promise<TransactionSyncResult>;

  /**
   * Validates an inbound Plaid webhook payload. In production this performs
   * full JWT (JWS/ES256) signature + body-hash + replay verification and
   * THROWS on any failure; the caller MUST reject unverified webhooks.
   *
   * @param headers inbound HTTP headers (carry the `Plaid-Verification` JWT)
   * @param rawBody the EXACT raw request body bytes (NOT re-serialized JSON) —
   *                the signed body hash is checked against these bytes
   */
  verifyWebhook(
    headers: Record<string, string>,
    rawBody: string,
  ): Promise<WebhookEvent>;

  /**
   * Removes a connection (calls Plaid's /item/remove endpoint).
   * Should be called as part of per-tenant offboarding to revoke access
   * at the provider level before deleting the bank_connections row.
   */
  removeConnection(accessToken: string): Promise<void>;
}
