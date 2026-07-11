// @vitest-environment jsdom
//
// This file is `.ts` (a lib helper test), so under the default vitest config it
// would run in the `node` environment (jsdom is auto-applied only to `.tsx`
// client tests). The localStorage persistence cases below need a DOM, so we pin
// jsdom for this file explicitly.
/**
 * Plaid OAuth round-trip helper tests.
 *
 * Pins the OAuth return-detection + link_token persistence that drives the
 * `receivedRedirectUri` re-init flow on financial-bank-connections.tsx. When an
 * OAuth bank (Chase, BofA, Wells Fargo) redirects the browser back to
 * /api/plaid/oauth-return → /app/financial/bank-connections?oauth_state_id=…,
 * the page must (a) detect the return and (b) restore the SAME link_token saved
 * before the hand-off so usePlaidLink can resume with receivedRedirectUri.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  PLAID_OAUTH_TOKEN_KEY,
  isPlaidOAuthReturn,
  readSavedOAuthToken,
  saveOAuthToken,
  clearOAuthToken,
} from "./plaid-oauth";

describe("isPlaidOAuthReturn", () => {
  it("is TRUE when oauth_state_id is present (Plaid's own param)", () => {
    expect(isPlaidOAuthReturn("?oauth_state_id=abc123")).toBe(true);
  });

  it("is TRUE when plaidOAuthReturn=1 is present (our server-route flag)", () => {
    expect(isPlaidOAuthReturn("?plaidOAuthReturn=1")).toBe(true);
  });

  it("is TRUE when both params are present", () => {
    expect(isPlaidOAuthReturn("?oauth_state_id=abc&plaidOAuthReturn=1")).toBe(true);
  });

  it("is FALSE on a plain (non-return) navigation", () => {
    expect(isPlaidOAuthReturn("")).toBe(false);
    expect(isPlaidOAuthReturn("?foo=bar")).toBe(false);
  });
});

describe("OAuth link_token persistence across the redirect round-trip", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    window.localStorage.clear();
  });

  it("save → read returns the SAME token (survives the page reload)", () => {
    expect(readSavedOAuthToken()).toBeNull();
    saveOAuthToken("link-prod-oauth-token-xyz");
    expect(readSavedOAuthToken()).toBe("link-prod-oauth-token-xyz");
    // Stored under the canonical key the page reads on return.
    expect(window.localStorage.getItem(PLAID_OAUTH_TOKEN_KEY)).toBe(
      "link-prod-oauth-token-xyz",
    );
  });

  it("clear removes the token (so a later non-OAuth open doesn't resume a stale session)", () => {
    saveOAuthToken("link-prod-oauth-token-xyz");
    clearOAuthToken();
    expect(readSavedOAuthToken()).toBeNull();
  });

  it("read returns null when nothing was saved (token vanished → surface, don't open empty)", () => {
    expect(readSavedOAuthToken()).toBeNull();
  });
});
