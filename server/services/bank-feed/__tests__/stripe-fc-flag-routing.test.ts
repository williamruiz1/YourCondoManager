/**
 * Flag-routing tests — the STRIPE_FINANCIAL_CONNECTIONS_ENABLED flag selects
 * which BankFeedProvider the bank-feed singleton (./index.ts) exposes, and the
 * env guard's behavior. The whole drop-in pivot turns on this flag:
 *   - OFF (default) → PlaidProvider (unchanged behavior)
 *   - ON            → StripeFcProvider
 *
 * We reset modules between cases so the singleton is re-selected against the
 * current env. We mock the SDK + secrets so neither provider's constructor
 * touches the network.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../platform-secrets-store", () => ({
  getSecret: vi.fn(async () => "sk_test_x"),
}));
vi.mock("../../../logger", () => ({ debug: vi.fn(), log: vi.fn() }));
// Mock the plaid SDK so importing PlaidProvider never reaches a real client.
vi.mock("plaid", () => ({
  PlaidApi: class {},
  Configuration: class {},
  PlaidEnvironments: { sandbox: "", development: "", production: "" },
  Products: { Transactions: "transactions" },
  CountryCode: { Us: "US" },
}));

const ORIGINAL = process.env.STRIPE_FINANCIAL_CONNECTIONS_ENABLED;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.STRIPE_FINANCIAL_CONNECTIONS_ENABLED;
  else process.env.STRIPE_FINANCIAL_CONNECTIONS_ENABLED = ORIGINAL;
  vi.resetModules();
});

describe("bank-feed provider selection (flag routing)", () => {
  it("defaults to PlaidProvider when the flag is unset", async () => {
    delete process.env.STRIPE_FINANCIAL_CONNECTIONS_ENABLED;
    vi.resetModules();
    const { bankFeedProvider } = await import("../index");
    expect(bankFeedProvider.constructor.name).toBe("PlaidProvider");
  });

  it("uses PlaidProvider when the flag is '0'/'false'/'off'", async () => {
    for (const off of ["0", "false", "off", "no", ""]) {
      process.env.STRIPE_FINANCIAL_CONNECTIONS_ENABLED = off;
      vi.resetModules();
      const { bankFeedProvider } = await import("../index");
      expect(bankFeedProvider.constructor.name).toBe("PlaidProvider");
    }
  });

  it("uses StripeFcProvider when the flag is '1'/'true'/'yes'/'on'", async () => {
    for (const on of ["1", "true", "yes", "on", "TRUE", "On"]) {
      process.env.STRIPE_FINANCIAL_CONNECTIONS_ENABLED = on;
      vi.resetModules();
      const { bankFeedProvider } = await import("../index");
      expect(bankFeedProvider.constructor.name).toBe("StripeFcProvider");
    }
  });
});

describe("stripe-fc-env-guard", () => {
  it("flag helper accepts 1/true/yes/on and rejects everything else", async () => {
    const { isStripeFinancialConnectionsEnabled } = await import("../stripe-fc-env-guard");
    for (const on of ["1", "true", "yes", "on"]) {
      process.env.STRIPE_FINANCIAL_CONNECTIONS_ENABLED = on;
      expect(isStripeFinancialConnectionsEnabled()).toBe(true);
    }
    for (const off of ["0", "false", "off", "maybe", ""]) {
      process.env.STRIPE_FINANCIAL_CONNECTIONS_ENABLED = off;
      expect(isStripeFinancialConnectionsEnabled()).toBe(false);
    }
  });

  it("evaluateStripeFcEnv is OK when the flag is OFF (FC path inert)", async () => {
    const { evaluateStripeFcEnv } = await import("../stripe-fc-env-guard");
    process.env.STRIPE_FINANCIAL_CONNECTIONS_ENABLED = "0";
    const r = evaluateStripeFcEnv();
    expect(r.ok).toBe(true);
    expect(r.enabled).toBe(false);
  });

  it("assertStripeFcEnvSafe THROWS when enabled in production without the webhook secret", async () => {
    const { assertStripeFcEnvSafe } = await import("../stripe-fc-env-guard");
    process.env.STRIPE_FINANCIAL_CONNECTIONS_ENABLED = "1";
    process.env.STRIPE_FC_ENV = "production";
    const savedSecret = process.env.STRIPE_FC_WEBHOOK_SECRET;
    delete process.env.STRIPE_FC_WEBHOOK_SECRET;
    expect(() => assertStripeFcEnvSafe()).toThrow(/STRIPE_FC_WEBHOOK_SECRET/);
    // and passes once the secret is wired
    process.env.STRIPE_FC_WEBHOOK_SECRET = "whsec_live";
    expect(() => assertStripeFcEnvSafe()).not.toThrow();
    delete process.env.STRIPE_FC_ENV;
    if (savedSecret === undefined) delete process.env.STRIPE_FC_WEBHOOK_SECRET;
    else process.env.STRIPE_FC_WEBHOOK_SECRET = savedSecret;
  });
});
