/**
 * Trial duration source-scan tests — 4.4 Q5 (Wave 39, founder-ratified
 * 2026-04-26).
 *
 * Locks the founder decisions:
 *   - trial_period_days = 21 (was 14 in Wave 13)
 *   - 7-day grace window (unchanged)
 *   - payment_method_collection = "if_required" (unchanged, no CC upfront)
 *   - signup-success page references "21-day free trial" + "7 days of grace"
 *   - settings.billing.trial.note references "21-day free trial"
 *
 * If a future agent changes any of these without updating the founder
 * Decision Log in decisions/4.4-signup-and-checkout-flow.md, this suite
 * fails — surfacing the regression.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";

describe("Trial duration & signup copy (4.4 Q5 Wave 39)", () => {
  it("server/routes.ts passes trial_period_days = 21 to Stripe Checkout", () => {
    const routesSource = fs.readFileSync("server/routes.ts", "utf8");
    expect(routesSource).toContain(
      '"subscription_data[trial_period_days]": "21"',
    );
    // Belt-and-suspenders: explicitly confirm the Wave-13 default is gone.
    expect(routesSource).not.toContain(
      '"subscription_data[trial_period_days]": "14"',
    );
  });

  it("server/routes.ts keeps payment_method_collection = if_required (no CC upfront)", () => {
    const routesSource = fs.readFileSync("server/routes.ts", "utf8");
    expect(routesSource).toContain(
      'payment_method_collection: "if_required"',
    );
  });

  it("plan-signup-success page references the 21-day trial + 7 days of grace", () => {
    const src = fs.readFileSync(
      "client/src/pages/plan-signup-success.tsx",
      "utf8",
    );
    expect(src).toMatch(/21-day free trial/i);
    expect(src).toMatch(/7 days of grace/i);
    expect(src).toMatch(/no credit card required/i);
    // Wave 13 copy is gone.
    expect(src).not.toMatch(/14-day free trial/i);
  });

  it("plan-signup page references the 21-day trial", () => {
    const src = fs.readFileSync("client/src/pages/plan-signup.tsx", "utf8");
    expect(src).toMatch(/21-day free trial/);
    expect(src).not.toMatch(/14-day free trial/);
  });

  it("settings.billing.trial.note string references the 21-day trial + 7-day grace", () => {
    const src = fs.readFileSync("client/src/i18n/strings.en.ts", "utf8");
    expect(src).toMatch(/21-day free trial · 7-day grace window/);
  });

  it("4.4 decision doc Q5 is locked at 2026-04-26 with founder-ratified 21-day trial", () => {
    const doc = fs.readFileSync(
      "docs/projects/platform-overhaul/decisions/4.4-signup-and-checkout-flow.md",
      "utf8",
    );
    // Q5 SPEC LOCKED marker dated 2026-04-26.
    expect(doc).toMatch(/Q5.*SPEC LOCKED.*2026-04-26/i);
    // Per-HOA self-managed billing model documented.
    expect(doc).toMatch(/per-HOA/);
    // 21-day trial referenced in the doc.
    expect(doc).toMatch(/21[- ]day/);
  });
});
