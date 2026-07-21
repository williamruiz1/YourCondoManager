import { describe, expect, it } from "vitest";

import { delegatedWorkspaceRouteAllowed } from "./delegated-workspace-guard";
import { createDefaultDelegatedAccessMatrix } from "@shared/delegated-feature-access";

describe("delegated workspace page guard", () => {
  it("fails closed for an ungranted PM Assistant route", () => {
    const access = createDefaultDelegatedAccessMatrix("pm-assistant");
    expect(delegatedWorkspaceRouteAllowed("pm-assistant", "/app/work-orders", access)).toBe(false);
    expect(delegatedWorkspaceRouteAllowed("pm-assistant", "/app/unmapped-future-page", access)).toBe(false);
  });

  it("opens a granted page and its zone landing without widening other features", () => {
    const defaults = createDefaultDelegatedAccessMatrix("pm-assistant");
    const access = {
      ...defaults,
      "financials.owner-ledger": { view: true, write: false },
    };
    expect(delegatedWorkspaceRouteAllowed("pm-assistant", "/app/financial/billing", access)).toBe(true);
    expect(delegatedWorkspaceRouteAllowed("pm-assistant", "/app/financials", access)).toBe(true);
    expect(delegatedWorkspaceRouteAllowed("pm-assistant", "/app/financial/payments", access)).toBe(false);
  });

  it("never delegates platform, AI, or commercial billing pages", () => {
    const defaults = createDefaultDelegatedAccessMatrix("pm-assistant");
    const access = Object.fromEntries(
      Object.entries(defaults).map(([feature, permissions]) => [feature, { ...permissions, view: true }]),
    ) as typeof defaults;
    expect(delegatedWorkspaceRouteAllowed("pm-assistant", "/app/platform/controls", access)).toBe(false);
    expect(delegatedWorkspaceRouteAllowed("pm-assistant", "/app/ai/ingestion", access)).toBe(false);
    expect(delegatedWorkspaceRouteAllowed("pm-assistant", "/app/settings/billing", access)).toBe(false);
  });
});
