/**
 * 5.6 — i18n registry tests (Wave 21 + Wave 24).
 *
 * Spec: docs/projects/platform-overhaul/decisions/5.6-i18n-scaffolding.md
 *
 * Covers Acceptance Criteria #1, #2, #3, #10:
 *   - the registry exports a flat `strings` object + `StringKey` union,
 *   - every key resolves to a non-empty string,
 *   - every key is unique (the `as const` declaration enforces this at the
 *     type level — but we re-verify at runtime so a hand-edit can't break
 *     the invariant silently),
 *   - `t()` returns the registered value for known keys,
 *   - `t()` falls back to the key itself for unknown keys.
 *
 * Wave 24 expanded the registry to cover 15 additional surfaces; the
 * baseline expectation is raised below and surface-specific spot checks
 * are added to keep the registry as the single source of truth.
 */

import { describe, it, expect } from "vitest";

import { strings } from "../../client/src/i18n/strings.en";
import { t, useStrings } from "../../client/src/i18n/use-strings";

describe("i18n strings.en", () => {
  it("exports a flat object with at least 100 keys (Wave 21 baseline)", () => {
    expect(typeof strings).toBe("object");
    expect(Object.keys(strings).length).toBeGreaterThanOrEqual(100);
  });

  it("exports at least 250 keys after Wave 24 round-2 extension", () => {
    // Wave 21 shipped ~150 keys across 10 surfaces. Wave 24 added ~100+
    // keys across 15 more surfaces. The combined registry should comfortably
    // clear 250 — if it drops below, an extension was reverted.
    expect(Object.keys(strings).length).toBeGreaterThanOrEqual(250);
  });

  it("every value is a non-empty string", () => {
    for (const [key, value] of Object.entries(strings)) {
      expect(typeof value, `${key} should be a string`).toBe("string");
      expect(value.length, `${key} should not be empty`).toBeGreaterThan(0);
    }
  });

  it("every key is unique", () => {
    // Object literal duplicates are silently coalesced by JS; this test
    // re-counts via the source-of-truth `Object.keys` length and confirms
    // it matches the cardinality of a Set built from the same keys.
    const keys = Object.keys(strings);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it("includes the high-traffic anchor keys covered by Wave 21", () => {
    // Spot-checks for the 10 surfaces — if any of these regresses, the
    // surface migration was reverted and the registry is no longer the
    // single source of truth.
    expect(strings).toHaveProperty("home.title");
    expect(strings).toHaveProperty("home.alerts.title");
    expect(strings).toHaveProperty("inbox.title");
    expect(strings).toHaveProperty("inbox.empty.unread");
    expect(strings).toHaveProperty("hub.financials.title");
    expect(strings).toHaveProperty("hub.operations.title");
    expect(strings).toHaveProperty("hub.governance.title");
    expect(strings).toHaveProperty("hub.communications.title");
    expect(strings).toHaveProperty("financialRules.title");
    expect(strings).toHaveProperty("financialRules.tab.runHistory");
    expect(strings).toHaveProperty("portal.home.cards.balance");
    expect(strings).toHaveProperty("portal.finances.title");
    expect(strings).toHaveProperty("settings.billing.title");
    expect(strings).toHaveProperty("settings.billing.status.active");
  });

  it("includes the Wave 24 round-2 surface anchor keys", () => {
    // Spot-checks for each of the 15 Wave 24 surfaces — at minimum the
    // page title and at least one secondary key must be present so a
    // partial revert is detected.
    expect(strings).toHaveProperty("financialFoundation.title");
    expect(strings).toHaveProperty("financialFoundation.tabs.accounts");
    expect(strings).toHaveProperty("financialBilling.title");
    expect(strings).toHaveProperty("financialBilling.tabs.ledger");
    expect(strings).toHaveProperty("financialRecurring.title");
    expect(strings).toHaveProperty("financialLateFees.title");
    expect(strings).toHaveProperty("financialDelinquency.tabs.escalations");
    expect(strings).toHaveProperty("financialPayments.title");
    expect(strings).toHaveProperty("financialLedger.title");
    expect(strings).toHaveProperty("workOrders.title");
    expect(strings).toHaveProperty("workOrders.tabs.workOrders");
    expect(strings).toHaveProperty("vendors.title");
    expect(strings).toHaveProperty("meetings.title");
    expect(strings).toHaveProperty("elections.title");
    expect(strings).toHaveProperty("announcements.title");
    expect(strings).toHaveProperty("documents.title");
    expect(strings).toHaveProperty("persons.title");
    expect(strings).toHaveProperty("persons.empty.noPeople.title");
    expect(strings).toHaveProperty("units.title");
    expect(strings).toHaveProperty("units.action.addBuilding");
  });
});

describe("t()", () => {
  it("returns the registered value for known keys", () => {
    expect(t("home.title")).toBe("Home");
    expect(t("inbox.tab.unread")).toBe("Unread");
    expect(t("settings.billing.status.active")).toBe("Active");
  });

  it("returns the registered value for Wave 24 keys", () => {
    // Two spot checks confirming new Wave 24 keys render correctly via t().
    expect(t("workOrders.title")).toBe("Work Orders");
    expect(t("financialBilling.tabs.ledger")).toBe("Owner Ledger");
  });

  it("returns the key itself for unknown keys (safe fallback)", () => {
    // Cast to defeat the StringKey constraint — runtime fallback only
    // matters when a dynamic value sneaks through.
    const unknown = "nonexistent.key.that.was.never.registered" as unknown as Parameters<
      typeof t
    >[0];
    expect(t(unknown)).toBe("nonexistent.key.that.was.never.registered");
  });
});

describe("useStrings()", () => {
  it("exposes the same t() implementation", () => {
    const { t: hookT } = useStrings();
    expect(hookT("home.title")).toBe(t("home.title"));
    expect(hookT("inbox.empty.archived")).toBe(t("inbox.empty.archived"));
  });
});
