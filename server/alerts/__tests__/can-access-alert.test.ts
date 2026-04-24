/**
 * 4.1 Wave 2 — Unit test: canAccessAlert predicate.
 *
 * Per 4.1 Q5 AC: tests cover "Assisted Board seeing maintenance-request
 * alerts but not unit-management alerts within the same zone" — i.e.
 * feature-domain filtering beats zone-only filtering.
 */

import { describe, it, expect } from "vitest";
import { canAccessAlert } from "../can-access-alert";
import { FEATURE_DOMAINS } from "../types";

const EMPTY_TOGGLES = {} as const;

describe("canAccessAlert", () => {
  it("Manager sees alerts in every Tier 1 feature domain", () => {
    for (const domain of Object.values(FEATURE_DOMAINS)) {
      expect(canAccessAlert("manager", domain, EMPTY_TOGGLES)).toBe(true);
    }
  });

  it("Platform Admin sees alerts in every Tier 1 feature domain", () => {
    for (const domain of Object.values(FEATURE_DOMAINS)) {
      expect(canAccessAlert("platform-admin", domain, EMPTY_TOGGLES)).toBe(true);
    }
  });

  it("Assisted Board sees permitted feature domains but NOT operations.work-orders", () => {
    // Permitted per 0.2 PM-Managed Default Access Table:
    expect(canAccessAlert("assisted-board", FEATURE_DOMAINS.OPERATIONS_MAINTENANCE_REQUESTS, EMPTY_TOGGLES)).toBe(true);
    expect(canAccessAlert("assisted-board", FEATURE_DOMAINS.GOVERNANCE_DOCUMENTS, EMPTY_TOGGLES)).toBe(true);
    expect(canAccessAlert("assisted-board", FEATURE_DOMAINS.GOVERNANCE_ELECTIONS, EMPTY_TOGGLES)).toBe(true);
    expect(canAccessAlert("assisted-board", FEATURE_DOMAINS.FINANCIALS_REPORTS, EMPTY_TOGGLES)).toBe(true);
    expect(canAccessAlert("assisted-board", FEATURE_DOMAINS.FINANCIALS_DELINQUENCY, EMPTY_TOGGLES)).toBe(true);
    // DENIED — work orders are PM operational, not board oversight (aligns
    // with the 4.1 Q5 AC example: unit-management alerts denied to Assisted
    // Board even though Operations zone is visible).
    expect(canAccessAlert("assisted-board", FEATURE_DOMAINS.OPERATIONS_WORK_ORDERS, EMPTY_TOGGLES)).toBe(false);
  });

  it("Tier 2 feature domains route correctly for Assisted Board", () => {
    // governance-compliance (insurance expiry) mirrors governance.documents
    // — board-level oversight, so Assisted Board can view.
    expect(canAccessAlert("assisted-board", FEATURE_DOMAINS.GOVERNANCE_COMPLIANCE, EMPTY_TOGGLES)).toBe(true);
    // vendors is PM-operational, like work orders — Assisted Board denied.
    expect(canAccessAlert("assisted-board", FEATURE_DOMAINS.VENDORS, EMPTY_TOGGLES)).toBe(false);
  });

  it("Tier 2 feature domains resolve for Board Officer, PM Assistant, Manager, Platform Admin", () => {
    for (const role of ["board-officer", "pm-assistant", "manager", "platform-admin"] as const) {
      expect(canAccessAlert(role, FEATURE_DOMAINS.VENDORS, EMPTY_TOGGLES)).toBe(true);
      expect(canAccessAlert(role, FEATURE_DOMAINS.GOVERNANCE_COMPLIANCE, EMPTY_TOGGLES)).toBe(true);
    }
  });

  it("Viewer can see governance-compliance (view-only row) but NOT vendors", () => {
    expect(canAccessAlert("viewer", FEATURE_DOMAINS.GOVERNANCE_COMPLIANCE, EMPTY_TOGGLES)).toBe(true);
    expect(canAccessAlert("viewer", FEATURE_DOMAINS.VENDORS, EMPTY_TOGGLES)).toBe(false);
  });

  it("Unknown feature domains are denied for non-Manager personas (Wave 2 default-deny)", () => {
    expect(canAccessAlert("assisted-board", "unknown.future-domain", EMPTY_TOGGLES)).toBe(false);
    expect(canAccessAlert("viewer", "unknown.future-domain", EMPTY_TOGGLES)).toBe(false);
    // Manager / Platform-Admin always allowed.
    expect(canAccessAlert("manager", "unknown.future-domain", EMPTY_TOGGLES)).toBe(true);
    expect(canAccessAlert("platform-admin", "unknown.future-domain", EMPTY_TOGGLES)).toBe(true);
  });
});
