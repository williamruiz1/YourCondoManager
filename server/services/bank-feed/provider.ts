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
   * Returns transactions since the given date for the given access_token.
   * Uses Plaid's /transactions/sync endpoint internally.
   */
  getTransactions(
    accessToken: string,
    since: Date,
  ): Promise<BankTransactionSnapshot[]>;

  /**
   * Validates an inbound Plaid webhook payload.
   * Throws if verification fails; returns the parsed event on success.
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
