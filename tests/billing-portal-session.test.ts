/**
 * Billing portal-session endpoint — 4.4 Q6 (Wave 13) source-scan tests.
 *
 * Verifies:
 *   - return_url points at /app/settings/billing (Manager-accessible surface),
 *     not /app/platform/controls (Platform Admin only per 0.2).
 *   - requireAdminRole gate includes manager, board-officer, pm-assistant,
 *     and platform-admin.
 *   - requireAdmin (auth) is applied.
 *
 * Same source-scan pattern as tests/signup-session-continuity.test.ts.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";

const routesSource = fs.readFileSync("server/routes.ts", "utf8");

function handlerRegion(anchor: string, before = 0, after = 800): string {
  const idx = routesSource.indexOf(anchor);
  if (idx < 0) return "";
  return routesSource.substring(Math.max(0, idx - before), idx + after);
}

describe("Billing portal-session (4.4 Q6 Wave 13)", () => {
  const anchor = '"/api/admin/billing/portal-session"';
  const handler = handlerRegion(anchor, 80, 1200);

  it("mounts at POST /api/admin/billing/portal-session", () => {
    expect(routesSource).toContain('app.post("/api/admin/billing/portal-session"');
  });

  it("return_url ends with /app/settings/billing (Manager surface, not platform controls)", () => {
    // Must NOT reference the old Platform-Admin return URL:
    expect(handler).not.toContain("/app/platform/controls");
    // Must reference the new Manager surface:
    expect(handler).toContain("/app/settings/billing");
  });

  it("auth gate applies requireAdmin", () => {
    expect(handler).toMatch(/app\.post\(\s*"\/api\/admin\/billing\/portal-session"\s*,\s*requireAdmin/);
  });

  it("role gate permits manager + board-officer + pm-assistant + platform-admin", () => {
    // Extract the requireAdminRole call from the handler line.
    const roleGate = handler.match(/requireAdminRole\(\[([^\]]+)\]\)/);
    expect(roleGate).not.toBeNull();
    const roles = roleGate![1];
    expect(roles).toContain("\"platform-admin\"");
    expect(roles).toContain("\"manager\"");
    expect(roles).toContain("\"board-officer\"");
    expect(roles).toContain("\"pm-assistant\"");
    // Viewer must NOT be in the role list.
    expect(roles).not.toContain("\"viewer\"");
  });
});

describe("Billing subscription endpoint (4.4 Q6 Wave 13)", () => {
  it("GET /api/admin/billing/subscription is still mounted behind requireAdmin", () => {
    expect(routesSource).toMatch(
      /app\.get\(\s*"\/api\/admin\/billing\/subscription"\s*,\s*requireAdmin/,
    );
  });

  it("returns { status: 'none' } when no association context exists (early exit)", () => {
    const handler = handlerRegion('"/api/admin/billing/subscription"', 0, 600);
    expect(handler).toMatch(/status:\s*"none"/);
  });
});
