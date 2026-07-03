/**
 * Stripe Financial Connections (FC) client collection helper.
 *
 * Drop-in alternative to the react-plaid-link flow for linking an HOA's bank
 * for the READ-ONLY reconciliation feed, gated by the server's bank-feed
 * provider (GET /api/bank-feed/provider returns provider="stripe_fc" + the
 * publishable key when STRIPE_FINANCIAL_CONNECTIONS_ENABLED is ON).
 *
 * It lazy-loads Stripe.js from the official CDN ON DEMAND (no new npm dep, no
 * bundle churn, no Stripe.js loaded for the Plaid path) and runs the hosted
 * FC OAuth collection flow via stripe.collectFinancialConnectionsAccounts().
 * Chase (and other large banks) complete via the bank's own OAuth inside that
 * hosted modal — no separate redirect-return plumbing on our side.
 *
 * Flow:
 *   1. server createLinkToken → returns the FC Session client_secret (as
 *      `linkToken`, matching the Plaid interface).
 *   2. stripe.collectFinancialConnectionsAccounts({ clientSecret }) → opens the
 *      hosted modal; on success returns the linked FC accounts + the session.
 *   3. we return the FC SESSION id, which the caller passes to the existing
 *      /api/plaid/exchange-token route (which, under the FC provider, retrieves
 *      the session, subscribes the accounts, and persists the connection).
 *
 * READ-ONLY: the session was created server-side with permissions
 * balances+transactions only (no payment_method), so this flow can never move
 * money.
 */

const STRIPE_JS_SRC = "https://js.stripe.com/v3/";

// Minimal shape of the Stripe.js global we use (avoid a @stripe/stripe-js dep).
interface StripeJsAccount {
  id: string;
  institution_name?: string | null;
  display_name?: string | null;
}
interface StripeJsFcSession {
  id: string;
  accounts?: StripeJsAccount[];
}
interface StripeJsCollectResult {
  financialConnectionsSession?: StripeJsFcSession;
  error?: { message?: string };
}
interface StripeJsClient {
  collectFinancialConnectionsAccounts(opts: {
    clientSecret: string;
  }): Promise<StripeJsCollectResult>;
}
type StripeJsFactory = (publishableKey: string) => StripeJsClient;

declare global {
  interface Window {
    Stripe?: StripeJsFactory;
  }
}

let stripeJsLoadPromise: Promise<StripeJsFactory> | null = null;

/** Lazy-load Stripe.js from the CDN exactly once. */
function loadStripeJs(): Promise<StripeJsFactory> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Stripe.js can only load in the browser"));
  }
  if (window.Stripe) return Promise.resolve(window.Stripe);
  if (stripeJsLoadPromise) return stripeJsLoadPromise;

  stripeJsLoadPromise = new Promise<StripeJsFactory>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${STRIPE_JS_SRC}"]`,
    );
    const onReady = () => {
      if (window.Stripe) resolve(window.Stripe);
      else reject(new Error("Stripe.js loaded but window.Stripe is missing"));
    };
    if (existing) {
      existing.addEventListener("load", onReady, { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Failed to load Stripe.js")),
        { once: true },
      );
      // If it already loaded before we attached, resolve now.
      if (window.Stripe) onReady();
      return;
    }
    const script = document.createElement("script");
    script.src = STRIPE_JS_SRC;
    script.async = true;
    script.addEventListener("load", onReady, { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("Failed to load Stripe.js")),
      { once: true },
    );
    document.head.appendChild(script);
  });

  return stripeJsLoadPromise;
}

export interface FcCollectOutcome {
  /** The FC session id to hand to /api/plaid/exchange-token. */
  sessionId: string;
  /** Best-effort institution name for display/labeling. */
  institutionName: string | null;
}

/**
 * Run the Stripe FC hosted collection flow.
 *
 * @param publishableKey platform Stripe publishable key (from
 *                        GET /api/bank-feed/provider).
 * @param clientSecret   FC Session client_secret (the server createLinkToken's
 *                        `linkToken`).
 * @returns the FC session id + institution name, or throws if the user
 *          cancels / Stripe errors.
 */
export async function collectFinancialConnections(
  publishableKey: string,
  clientSecret: string,
): Promise<FcCollectOutcome> {
  if (!publishableKey) {
    throw new Error("Stripe publishable key is not configured");
  }
  const Stripe = await loadStripeJs();
  const stripe = Stripe(publishableKey);

  const result = await stripe.collectFinancialConnectionsAccounts({ clientSecret });
  if (result.error) {
    throw new Error(result.error.message || "Bank connection was cancelled or failed");
  }
  const session = result.financialConnectionsSession;
  if (!session?.id) {
    // No session id usually means the user closed the modal without linking.
    throw new Error("Bank connection was not completed");
  }
  const firstAccount = session.accounts?.[0];
  const institutionName =
    firstAccount?.institution_name || firstAccount?.display_name || null;
  return { sessionId: session.id, institutionName };
}
