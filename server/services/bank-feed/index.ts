/**
 * Bank-feed service entry point.
 *
 * Exports the singleton BankFeedProvider. All YCM code that needs bank data
 * imports from here — never directly from a provider implementation file.
 * Swapping to a different provider is a one-line change in this file.
 */

import { PlaidProvider } from "./plaid-provider";
import type { BankFeedProvider } from "./provider";

export { BankFeedProvider };
export type {
  BankAccountSnapshot,
  BankTransactionSnapshot,
  WebhookEvent,
} from "./provider";

export const bankFeedProvider: BankFeedProvider = new PlaidProvider();
