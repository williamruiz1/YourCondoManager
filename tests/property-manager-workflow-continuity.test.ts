import { describe, expect, it } from "vitest";
import {
  resolveSignupAdminRole,
  resolveSignupPlan,
} from "../shared/signup-plan-keys";
import { resolveViewModeEntitlement } from "../shared/view-mode-entitlement";
import { readFileSync } from "node:fs";

describe("Property Manager identity and multi-association boundary", () => {
  it("grants Manager only from a paid property-manager signup track", () => {
    for (const slug of [
      "property-manager",
      "property-manager-starter",
      "property-manager-growth",
      "property-manager-scale",
    ]) {
      expect(resolveSignupAdminRole(resolveSignupPlan(slug))).toBe("manager");
    }
  });

  it("keeps self-managed and unknown-safe-default signups in Board Officer", () => {
    expect(resolveSignupAdminRole(resolveSignupPlan("self-managed"))).toBe("board-officer");
    expect(resolveSignupAdminRole(resolveSignupPlan("not-a-real-plan"))).toBe("board-officer");
  });

  it("does not use association count to elevate a board member", () => {
    const oneAssociationBoard = resolveViewModeEntitlement({
      role: "board-officer",
      email: "volunteer@example.com",
    });
    const multiAssociationBoard = resolveViewModeEntitlement({
      role: "board-officer",
      email: "volunteer@example.com",
    });

    expect(oneAssociationBoard).toEqual({ viewMode: "board", locked: true });
    expect(multiAssociationBoard).toEqual(oneAssociationBoard);
  });

  it("gives the paid Manager persona the manager workspace", () => {
    expect(
      resolveViewModeEntitlement({
        role: "manager",
        email: "manager@example.com",
      }),
    ).toEqual({ viewMode: "manager", locked: false });
  });

  it("routes a second self-managed HOA through checkout instead of direct creation", () => {
    for (const path of [
      "client/src/pages/new-association.tsx",
      "client/src/pages/associations.tsx",
    ]) {
      const source = readFileSync(path, "utf8");
      expect(source).toContain('"/api/admin/associations/start-checkout"');
      expect(source).toMatch(/(?:previousCount|activeCount) >= 1 && isSelfManaged/);
      expect(source).toContain("window.location.assign(checkout.checkoutUrl)");
    }
  });

  it("requires a paid PM plan for direct portfolio expansion", () => {
    const source = readFileSync("server/routes.ts", "utf8");
    const anchor = source.indexOf('app.post("/api/associations"');
    const handler = source.slice(anchor, anchor + 2600);
    expect(handler).toContain('requireAdminRole(["platform-admin", "manager"])');
    expect(handler).toContain('subscription?.plan === "property-manager"');
    expect(handler).toContain("PROPERTY_MANAGER_PLAN_REQUIRED");
  });

  it("resolves PM subscription billing across the portfolio without relying on scope order", () => {
    const source = readFileSync("server/routes.ts", "utf8");
    const anchor = source.indexOf("async function resolveAdminBillingSubscription");
    const helper = source.slice(anchor, anchor + 2200);
    expect(helper).toContain('subscription?.plan === "property-manager"');
    expect(helper).toContain("requestedAssociationId");
    expect(helper.indexOf('subscription?.plan === "property-manager"')).toBeLessThan(
      helper.indexOf("subscription?.associationId === requestedAssociationId"),
    );
  });
});
