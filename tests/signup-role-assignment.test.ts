/**
 * Signup Role Assignment Tests — migrated to Vitest (AC-6).
 *
 * Original: tests/signup-role-assignment.ts (standalone tsx runner)
 * Validates that the public signup flow assigns the correct default role
 * and that platform-admin is never reachable via public signup.
 *
 * References:
 *   - paid property-manager track → manager
 *   - self-managed track → board-officer
 *   - platform-admin is never reachable through public signup
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import {
  resolveSignupAdminRole,
  resolveSignupPlan,
} from "../shared/signup-plan-keys";

describe("Signup role assignment (source-scan)", () => {
  const routesSource = fs.readFileSync("server/routes.ts", "utf8");

  it("contains /api/public/signup/start endpoint", () => {
    expect(routesSource).toContain("/api/public/signup/start");
  });

  it("derives the account persona from the commercial track", () => {
    expect(resolveSignupAdminRole(resolveSignupPlan("property-manager"))).toBe("manager");
    expect(resolveSignupAdminRole(resolveSignupPlan("property-manager-growth"))).toBe("manager");
    expect(resolveSignupAdminRole(resolveSignupPlan("self-managed"))).toBe("board-officer");
    expect(resolveSignupAdminRole(resolveSignupPlan("unknown-safe-default"))).toBe("board-officer");
  });

  it("signup INSERT uses the derived role", () => {
    const signupIdx = routesSource.indexOf('app.post("/api/public/signup/start"');
    const region = routesSource.substring(signupIdx, signupIdx + 7500);
    expect(region).toContain("const signupRole = resolveSignupAdminRole(resolved)");
    expect(region).toMatch(/role:\s*signupRole/);
  });

  it('signup INSERT does NOT use role: "platform-admin"', () => {
    const signupIdx = routesSource.indexOf('app.post("/api/public/signup/start"');
    const region = routesSource.substring(signupIdx, signupIdx + 7500);
    expect(region).not.toMatch(/role:\s*["']platform-admin["']/);
  });

  it("writes canonical plan metadata instead of tier-specific signup slugs", () => {
    const signupIdx = routesSource.indexOf('app.post("/api/public/signup/start"');
    const region = routesSource.substring(signupIdx, signupIdx + 9000);
    expect(region).toContain('sessionParams.set("subscription_data[metadata][plan]", resolved.track)');
    expect(region).toContain('sessionParams.set("subscription_data[metadata][signupSlug]", plan)');
    expect(region).not.toContain('sessionParams.set("subscription_data[metadata][plan]", plan)');
  });

  it("provisionWorkspace does NOT set role to platform-admin", () => {
    const provisionIdx = routesSource.indexOf("async function provisionWorkspace");
    expect(provisionIdx).toBeGreaterThan(-1);
    const region = routesSource.substring(provisionIdx, provisionIdx + 3000);
    expect(region).not.toMatch(/role:\s*["']platform-admin["']/);
  });
});
