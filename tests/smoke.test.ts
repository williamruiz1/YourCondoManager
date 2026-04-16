/**
 * Smoke tests proving the Vitest infrastructure works (AC-7).
 *
 * - One shared test importing from shared/schema.ts
 * - One server test importing from server/
 * - These run in the "server" vitest project (node environment).
 */

import { describe, it, expect } from "vitest";
import { adminUserRoleEnum } from "../shared/schema";
import { ALL_ADMIN_ROLES, mockAdminSession, mockPortalSession, mockUnauthenticated } from "./utils/auth-helpers";
import { assertRouteAllowed, assertRouteBlocked } from "./utils/route-guard-helpers";
import { assertNavItemVisible, assertNavItemHidden, getVisibleNavItems } from "./utils/sidebar-helpers";

describe("Shared: schema imports", () => {
  it("adminUserRoleEnum contains all six operator roles", () => {
    const roles = adminUserRoleEnum.enumValues;
    expect(roles).toContain("platform-admin");
    expect(roles).toContain("manager");
    expect(roles).toContain("board-officer");
    expect(roles).toContain("assisted-board");
    expect(roles).toContain("pm-assistant");
    expect(roles).toContain("viewer");
    expect(roles).not.toContain("board-admin");
  });
});

describe("Auth helpers: session mocking", () => {
  it("mockAdminSession creates a valid admin session for each role", () => {
    for (const role of ALL_ADMIN_ROLES) {
      const session = mockAdminSession(role);
      expect(session.authenticated).toBe(true);
      expect(session.admin.role).toBe(role);
      expect(session.admin.id).toBe(`test-admin-${role}`);
      expect(session.associationIds.length).toBeGreaterThan(0);
    }
  });

  it("mockPortalSession creates a valid portal session", () => {
    const session = mockPortalSession("owner");
    expect(session.authenticated).toBe(true);
    expect(session.portal.role).toBe("owner");
  });

  it("mockUnauthenticated returns an unauthenticated session", () => {
    const session = mockUnauthenticated();
    expect(session.authenticated).toBe(false);
  });
});

describe("Route guard helpers: assertion logic", () => {
  it("assertRouteAllowed passes for an allowed role", () => {
    const config = { "/app/financial/billing": ["manager", "board-officer", "assisted-board", "pm-assistant", "viewer"] as const };
    expect(() => assertRouteAllowed("/app/financial/billing", "manager", config)).not.toThrow();
  });

  it("assertRouteBlocked passes for a blocked role", () => {
    const config = { "/app/platform/controls": ["platform-admin"] as const };
    expect(() => assertRouteBlocked("/app/platform/controls", "manager", config)).not.toThrow();
  });
});

describe("Sidebar helpers: visibility map", () => {
  it("Manager sees Home but not Platform Controls", () => {
    assertNavItemVisible("manager", "Home");
    assertNavItemHidden("manager", "Platform Controls");
  });

  it("Platform Admin sees Platform Controls but not Financials", () => {
    assertNavItemVisible("platform-admin", "Platform Controls");
    assertNavItemHidden("platform-admin", "Financials");
  });

  it("Assisted Board sees only permitted domains", () => {
    const items = getVisibleNavItems("assisted-board");
    expect(items).toContain("Home");
    expect(items).toContain("Financials");
    expect(items).not.toContain("Settings");
    expect(items).not.toContain("Platform Controls");
  });
});
