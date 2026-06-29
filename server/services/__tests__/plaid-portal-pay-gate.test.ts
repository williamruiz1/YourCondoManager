/**
 * Portal Plaid "pay from bank" settlement-risk gate (isPortalPlaidPayEnabled).
 *
 * The portal pay path posts a `payment` ledger CREDIT immediately, before ACH
 * funds settle, with no settlement reconciliation — so it ships DISABLED. This
 * verifies the flag is OFF by default and turns on ONLY with an explicit
 * affirmative value, mirroring the GL flag's parser.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isPortalPlaidPayEnabled } from "../bank-feed/plaid-env-guard";

beforeEach(() => {
  delete process.env.PORTAL_PLAID_PAY_ENABLED;
});
afterEach(() => {
  delete process.env.PORTAL_PLAID_PAY_ENABLED;
});

describe("isPortalPlaidPayEnabled — default OFF, explicit ON only", () => {
  it("is OFF when unset (the safe default — Cherry Hill uses Stripe ACH)", () => {
    expect(isPortalPlaidPayEnabled()).toBe(false);
  });

  it.each(["1", "true", "TRUE", "yes", "on", " On "])(
    "is ON for affirmative value %j",
    (v) => {
      process.env.PORTAL_PLAID_PAY_ENABLED = v;
      expect(isPortalPlaidPayEnabled()).toBe(true);
    },
  );

  it.each(["0", "false", "off", "no", "", "disabled", "maybe"])(
    "stays OFF for non-affirmative value %j",
    (v) => {
      process.env.PORTAL_PLAID_PAY_ENABLED = v;
      expect(isPortalPlaidPayEnabled()).toBe(false);
    },
  );
});
