/**
 * Signup Role Assignment Tests — migrated to Vitest (AC-6).
 *
 * Original: tests/signup-role-assignment.ts (standalone tsx runner)
 * Validates that the public signup flow assigns the correct default role
 * and that platform-admin is never reachable via public signup.
 *
 * References:
 *   - 4.4 Q1 decision: signup default is "manager", never "platform-admin"
 *   - 0.2 §Persona 1 (Manager): the signup persona
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";

describe("Signup role assignment (source-scan)", () => {
  const routesSource = fs.readFileSync("server/routes.ts", "utf8");

  it("contains /api/public/signup/start endpoint", () => {
    expect(routesSource).toContain("/api/public/signup/start");
  });

  // Window widened 5000 -> 6000 (founder-os#10752): the Stripe idempotency
  // hardening pass added a plan/price-resolution rewrite + explanatory
  // comments ahead of the signup INSERT, pushing role: "manager" from
  // ~4300 to ~5158 chars past the anchor. 6000 gives comfortable margin
  // (measured: the route mount for the NEXT endpoint starts at ~5328).
  it('signup INSERT uses role: "manager"', () => {
    // Anchor on the actual route handler (a comment sits above the handler),
    // and use a 6000-char window (the #10752 Stripe idempotency pass pushed the
    // INSERT to ~5158 past the anchor; 6000 gives margin).
    const signupIdx = routesSource.indexOf('app.post("/api/public/signup/start"');
    const region = routesSource.substring(signupIdx, signupIdx + 6000);
    expect(region).toContain('role: "manager"');
  });

  it('signup INSERT does NOT use role: "platform-admin"', () => {
    const signupIdx = routesSource.indexOf('app.post("/api/public/signup/start"');
    const region = routesSource.substring(signupIdx, signupIdx + 6000);
    expect(region).not.toMatch(/role:\s*["']platform-admin["']/);
  });

  it("provisionWorkspace does NOT set role to platform-admin", () => {
    const provisionIdx = routesSource.indexOf("async function provisionWorkspace");
    expect(provisionIdx).toBeGreaterThan(-1);
    const region = routesSource.substring(provisionIdx, provisionIdx + 3000);
    expect(region).not.toMatch(/role:\s*["']platform-admin["']/);
  });
});
