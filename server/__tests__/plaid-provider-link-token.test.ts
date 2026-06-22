/**
 * PlaidProvider.createLinkToken tests.
 *
 * Regression guard for the production "Internal error occurred" bug: when the
 * link token was created WITH `redirect_uri`, Plaid Link was forced into OAuth
 * mode, but the client never implemented the OAuth return flow
 * (`receivedRedirectUri` + a `/api/plaid/oauth-return` route), so Link threw an
 * internal error right after the loading bars.
 *
 * The fix is to run Link in standard (non-OAuth) mode by NOT requesting
 * `redirect_uri` at token-create time. These tests pin that:
 *   1. createLinkToken NEVER sends `redirect_uri`, even when PLAID_REDIRECT_URI is set.
 *   2. The webhook IS still sent when PLAID_WEBHOOK_URL is set.
 *   3. The core token-create config is intact (client_name, products, country, user).
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

describe("PlaidProvider.createLinkToken (non-OAuth Link mode)", () => {
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

  it("does NOT send redirect_uri even when PLAID_REDIRECT_URI is set (avoids broken OAuth flow)", async () => {
    process.env.PLAID_REDIRECT_URI = "https://app.yourcondomanager.org/api/plaid/oauth-return";
    process.env.PLAID_WEBHOOK_URL = "https://app.yourcondomanager.org/api/webhooks/plaid";

    const provider = new PlaidProvider();
    const { linkToken } = await provider.createLinkToken({ associationId: "assoc-1", userId: "user-1" });

    expect(linkToken).toBe("link-sandbox-test-token");
    expect(linkTokenCreateCalls).toHaveLength(1);
    const req = linkTokenCreateCalls[0];
    // The bug: redirect_uri forced OAuth mode with no client return handling.
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
    // No webhook set in env this time → omitted.
    expect(req).not.toHaveProperty("webhook");
    expect(req).not.toHaveProperty("redirect_uri");
  });
});
