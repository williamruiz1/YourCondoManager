/**
 * Bank-feed service entry point.
 *
 * Exports the singleton BankFeedProvider. All YCM code that needs bank data
 * imports from here — never directly from a provider implementation file.
 * Swapping to a different provider is a one-line change in this file.
 *
 * Provider selection (2026-06-30): governed by the
 * STRIPE_FINANCIAL_CONNECTIONS_ENABLED feature flag (DEFAULT OFF). When the
 * flag is ON, the bank feed uses Stripe Financial Connections (FC) — a
 * READ-ONLY balances + transactions feed for reconciliation, same vendor as
 * YCM's existing Stripe Connect dues path. When OFF (the default), it uses
 * Plaid exactly as before. This is the drop-in vendor pivot seam: the routes,
 * the sync engine, and the reconciler all depend only on this interface, so
 * the switch is invisible to them.
 *
 * NOTE: this is dues-RECONCILIATION only (the bank-transaction feed used to
 * reconcile the books). It is NOT dues collection — that remains Stripe
 * Connect, which is untouched by this file.
 */

import { PlaidProvider } from "./plaid-provider";
import { StripeFcProvider } from "./stripe-fc-provider";
import { isStripeFinancialConnectionsEnabled } from "./stripe-fc-env-guard";
import type { BankFeedProvider } from "./provider";

export { BankFeedProvider };
export type {
  BankAccountSnapshot,
  BankTransactionSnapshot,
  WebhookEvent,
} from "./provider";

/**
 * Select the bank-feed provider once at module load. The flag is a deploy-time
 * env var; flipping it is a process restart (a Fly secret + redeploy), matching
 * how PLAID_ENV and the rest of the bank-feed config are operated.
 */
function selectBankFeedProvider(): BankFeedProvider {
  return isStripeFinancialConnectionsEnabled()
    ? new StripeFcProvider()
    : new PlaidProvider();
}

export const bankFeedProvider: BankFeedProvider = selectBankFeedProvider();
