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

// A-LEDGER-007 regression guard — the /api/portal/plaid/pay route's FIRST
// statement is `if (!isPortalPlaidPayEnabled()) return res.status(503)…`, so
// the disabled default IS the 503-producing state. This pins the safe default
// so a future edit can't silently flip the money-moving path on: the route
// stays 503 until the guard returns true, which requires an explicit affirmative
// PORTAL_PLAID_PAY_ENABLED value (proven above). The referenceId uniqueness
// groundwork (this dispatch) changes NO behavior while the flag is off.
describe("A-LEDGER-007 — portal Plaid-pay stays 503-gated by default", () => {
  it("default (unset) keeps the pay route disabled → 503", () => {
    delete process.env.PORTAL_PLAID_PAY_ENABLED;
    // route short-circuits to 503 whenever this is false
    expect(isPortalPlaidPayEnabled()).toBe(false);
  });

  it("only an explicit affirmative value can enable the money path (no accidental enable)", () => {
    for (const accidental of ["2", "enabled", "y", "t", "ok", "1.0", " "]) {
      process.env.PORTAL_PLAID_PAY_ENABLED = accidental;
      expect(isPortalPlaidPayEnabled()).toBe(false);
    }
  });
});
