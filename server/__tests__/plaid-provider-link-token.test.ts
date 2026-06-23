/**
 * PlaidProvider.createLinkToken tests.
 *
 * OAuth support (2026-06-23): OAuth institutions (Chase, Bank of America, Wells
 * Fargo, and most large US banks) REQUIRE `redirect_uri` on the link token.
 * Without it Plaid returns "You have not been enabled for this institution"
 * and the OAuth hand-off can never run.
 *
 * A prior fix had DROPPED `redirect_uri` to stop a "double-open / forced OAuth"
 * crash that was actually caused by the client never implementing the OAuth
 * return flow. That made non-OAuth banks work but broke OAuth banks. The correct
 * fix — now in place — is to implement the client OAuth return flow
 * (persist link_token across the redirect, re-init usePlaidLink with
 * `receivedRedirectUri`, auto-open) AND set `redirect_uri` here.
 *
 * These tests pin the corrected behavior:
 *   1. createLinkToken SENDS `redirect_uri` when PLAID_REDIRECT_URI is set.
 *   2. createLinkToken OMITS `redirect_uri` when PLAID_REDIRECT_URI is NOT set
 *      (so a sandbox/dev install with no redirect configured still works in
 *      standard non-OAuth mode).
 *   3. The webhook IS still sent when PLAID_WEBHOOK_URL is set.
 *   4. The core token-create config is intact (client_name, products, country, user).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let linkTokenCreateCalls: any[] = [];

vi.mock("plaid", () => {
  class PlaidApi {
    async linkTokenCreate(req: any) {
      linkTokenCreateCalls.push(req);
      return { data: { link_token: "link-sandbox-test-token" } };
    }
  }
  return {
    PlaidApi,
    Configuration: class {},
    PlaidEnvironments: { sandbox: "https://sandbox.plaid.com", development: "", production: "" },
    Products: { Transactions: "transactions" },
    CountryCode: { Us: "US" },
  };
});

vi.mock("../../logger", () => ({ debug: vi.fn(), log: vi.fn() }));
vi.mock("./plaid-webhook-verify", () => ({ verifyPlaidWebhook: vi.fn() }));
vi.mock("./plaid-env-guard", () => ({ shouldEnforceWebhookVerification: () => false }));

import { PlaidProvider } from "../services/bank-feed/plaid-provider";

const ENV_KEYS = ["PLAID_REDIRECT_URI", "PLAID_WEBHOOK_URL"] as const;
const saved: Record<string, string | undefined> = {};

describe("PlaidProvider.createLinkToken (OAuth-capable Link mode)", () => {
  beforeEach(() => {
    linkTokenCreateCalls = [];
    for (const k of ENV_KEYS) saved[k] = process.env[k];
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    vi.clearAllMocks();
  });

  it("SENDS redirect_uri when PLAID_REDIRECT_URI is set (required for OAuth banks)", async () => {
    process.env.PLAID_REDIRECT_URI = "https://app.yourcondomanager.org/api/plaid/oauth-return";
    process.env.PLAID_WEBHOOK_URL = "https://app.yourcondomanager.org/api/webhooks/plaid";

    const provider = new PlaidProvider();
    const { linkToken } = await provider.createLinkToken({ associationId: "assoc-1", userId: "user-1" });

    expect(linkToken).toBe("link-sandbox-test-token");
    expect(linkTokenCreateCalls).toHaveLength(1);
    const req = linkTokenCreateCalls[0];
    // OAuth institutions fail without redirect_uri ("not been enabled for this
    // institution"). The client implements the receivedRedirectUri return flow.
    expect(req.redirect_uri).toBe(
      "https://app.yourcondomanager.org/api/plaid/oauth-return",
    );
  });

  it("OMITS redirect_uri when PLAID_REDIRECT_URI is NOT set (standard non-OAuth mode)", async () => {
    delete process.env.PLAID_REDIRECT_URI;
    process.env.PLAID_WEBHOOK_URL = "https://app.yourcondomanager.org/api/webhooks/plaid";

    const provider = new PlaidProvider();
    await provider.createLinkToken({ associationId: "assoc-1b", userId: "user-1b" });

    const req = linkTokenCreateCalls[0];
    expect(req).not.toHaveProperty("redirect_uri");
    expect(req.redirect_uri).toBeUndefined();
  });

  it("still sends the webhook when PLAID_WEBHOOK_URL is set", async () => {
    process.env.PLAID_WEBHOOK_URL = "https://app.yourcondomanager.org/api/webhooks/plaid";
    delete process.env.PLAID_REDIRECT_URI;

    const provider = new PlaidProvider();
    await provider.createLinkToken({ associationId: "assoc-2", userId: "user-2" });

    const req = linkTokenCreateCalls[0];
    expect(req.webhook).toBe("https://app.yourcondomanager.org/api/webhooks/plaid");
    expect(req).not.toHaveProperty("redirect_uri");
  });

  it("preserves the core token-create config (client_name, products, country, scoped user)", async () => {
    delete process.env.PLAID_REDIRECT_URI;
    delete process.env.PLAID_WEBHOOK_URL;

    const provider = new PlaidProvider();
    await provider.createLinkToken({ associationId: "assoc-3", userId: "user-3" });

    const req = linkTokenCreateCalls[0];
    expect(req.client_name).toBe("YourCondoManager");
    expect(req.products).toEqual(["transactions"]);
    expect(req.country_codes).toEqual(["US"]);
    expect(req.user.client_user_id).toBe("assoc-3:user-3");
    // No webhook / redirect set in env this time → both omitted.
    expect(req).not.toHaveProperty("webhook");
    expect(req).not.toHaveProperty("redirect_uri");
  });
});
