// Plaid OAuth round-trip helpers.
//
// OAuth institutions (Chase, Bank of America, Wells Fargo, …) hand the user off
// to the bank's website and then redirect the BROWSER back to our registered
// redirect_uri (server route /api/plaid/oauth-return → SPA bank-connections with
// ?oauth_state_id=…&plaidOAuthReturn=1). The full page reloads, so the in-memory
// link_token is gone. Per Plaid's OAuth guide we must persist the link_token
// before the hand-off and, on return, re-initialize usePlaidLink with the SAME
// token plus `receivedRedirectUri = window.location.href`, then auto-open() to
// complete the flow.
//
// These helpers are extracted from financial-bank-connections.tsx so the
// OAuth-return detection + token-persistence logic is unit-testable without
// rendering the full page.

export const PLAID_OAUTH_TOKEN_KEY = "ycm.plaid.oauth.linkToken";

/**
 * True when the given URL search string is a Plaid OAuth redirect-return
 * navigation. Our server route appends `plaidOAuthReturn=1`; Plaid itself
 * appends `oauth_state_id`. Accept either so we don't depend on a single param.
 *
 * @param search - a `location.search` string (e.g. "?oauth_state_id=abc").
 *                 Defaults to the live `window.location.search`.
 */
export function isPlaidOAuthReturn(search?: string): boolean {
  let s = search;
  if (s === undefined) {
    if (typeof window === "undefined") return false;
    s = window.location.search;
  }
  const params = new URLSearchParams(s);
  return params.has("plaidOAuthReturn") || params.has("oauth_state_id");
}

export function readSavedOAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(PLAID_OAUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveOAuthToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PLAID_OAUTH_TOKEN_KEY, token);
  } catch {
    /* localStorage unavailable (private mode) — non-OAuth banks still work. */
  }
}

export function clearOAuthToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PLAID_OAUTH_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}
