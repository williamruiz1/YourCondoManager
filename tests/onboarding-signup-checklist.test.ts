/**
 * Onboarding signup-checklist endpoint + storage helper — source scan.
 *
 * 4.4 Q2 AC 1-5:
 *   - 4 locked checklist items (association-details, board-officer,
 *     units, first-document)
 *   - Dismissal persisted per admin_users row
 *   - No new /app/onboarding route is added (AC 3)
 *
 * These are source-scan assertions following the pattern established in
 * tests/signup-role-assignment.test.ts. They lock down the 4 signals and
 * the dismiss endpoint so the next agent cannot silently drift off-spec.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");
const routesSource = fs.readFileSync(path.join(ROOT, "server/routes.ts"), "utf8");
const storageSource = fs.readFileSync(path.join(ROOT, "server/storage.ts"), "utf8");
const schemaSource = fs.readFileSync(path.join(ROOT, "shared/schema.ts"), "utf8");
const dashboardSource = fs.readFileSync(path.join(ROOT, "client/src/pages/dashboard.tsx"), "utf8");
const checklistSource = fs.readFileSync(
  path.join(ROOT, "client/src/components/signup-onboarding-checklist.tsx"),
  "utf8",
);

describe("4.4 Q2 onboarding banner — schema", () => {
  it("admin_users has onboarding_dismissed_at column in shared/schema.ts", () => {
    expect(schemaSource).toMatch(/onboardingDismissedAt:\s*timestamp\("onboarding_dismissed_at"\)/);
  });

  it("migrations/0007_onboarding_dismissed_at.sql exists and adds the column", () => {
    const migration = fs.readFileSync(
      path.join(ROOT, "migrations/0007_onboarding_dismissed_at.sql"),
      "utf8",
    );
    expect(migration).toMatch(/ALTER TABLE admin_users/i);
    expect(migration).toMatch(/onboarding_dismissed_at/);
  });
});

describe("4.4 Q2 onboarding banner — server endpoints", () => {
  it("GET /api/onboarding/signup-checklist is registered", () => {
    expect(routesSource).toContain('app.get("/api/onboarding/signup-checklist"');
  });

  it("POST /api/onboarding/dismiss is registered", () => {
    expect(routesSource).toContain('app.post("/api/onboarding/dismiss"');
  });

  it("/api/onboarding/state handler is preserved (not removed)", () => {
    // Existing callers (e.g. getAssociationOverview) depend on its shape.
    expect(routesSource).toContain('app.get("/api/onboarding/state"');
  });

  it("dismiss endpoint returns 204", () => {
    const idx = routesSource.indexOf('app.post("/api/onboarding/dismiss"');
    const region = routesSource.substring(idx, idx + 1200);
    expect(region).toMatch(/res\.status\(204\)/);
  });
});

describe("4.4 Q2 onboarding banner — storage helpers", () => {
  it("getSignupOnboardingChecklist is declared on IStorage", () => {
    expect(storageSource).toMatch(/getSignupOnboardingChecklist\(adminUserId:\s*string\)/);
  });

  it("dismissSignupOnboardingBanner is declared on IStorage", () => {
    expect(storageSource).toMatch(/dismissSignupOnboardingBanner\(adminUserId:\s*string\)/);
  });

  it("checklist returns the four Q2 booleans in its signature", () => {
    const idx = storageSource.indexOf("async getSignupOnboardingChecklist");
    expect(idx).toBeGreaterThan(-1);
    const region = storageSource.substring(idx, idx + 4000);
    expect(region).toContain("associationDetailsComplete");
    expect(region).toContain("boardOfficerInvited");
    expect(region).toContain("unitsAdded");
    expect(region).toContain("firstDocumentUploaded");
    expect(region).toContain("dismissed");
  });

  it("checklist impl detects the 'TBD' address/city/state sentinel (AC 1)", () => {
    const idx = storageSource.indexOf("async getSignupOnboardingChecklist");
    const region = storageSource.substring(idx, idx + 6000);
    expect(region).toMatch(/row\.address\s*!==\s*["']TBD["']/);
    expect(region).toMatch(/row\.city\s*!==\s*["']TBD["']/);
    expect(region).toMatch(/row\.state\s*!==\s*["']TBD["']/);
  });

  it("checklist impl queries board_roles OR admin_users.role='board-officer' (item 2)", () => {
    const idx = storageSource.indexOf("async getSignupOnboardingChecklist");
    const region = storageSource.substring(idx, idx + 6000);
    expect(region).toContain("boardRoles");
    expect(region).toMatch(/role,\s*["']board-officer["']/);
  });

  it("checklist impl queries units and documents tables (items 3 & 4)", () => {
    const idx = storageSource.indexOf("async getSignupOnboardingChecklist");
    const region = storageSource.substring(idx, idx + 6000);
    expect(region).toMatch(/from\(units\)/);
    expect(region).toMatch(/from\(documents\)/);
  });

  it("dismiss helper writes onboarding_dismissed_at with NOW()-equivalent", () => {
    const idx = storageSource.indexOf("async dismissSignupOnboardingBanner");
    expect(idx).toBeGreaterThan(-1);
    const region = storageSource.substring(idx, idx + 1200);
    expect(region).toMatch(/onboardingDismissedAt:\s*new Date\(\)/);
  });
});

describe("4.4 Q2 onboarding banner — client integration", () => {
  it("dashboard.tsx imports and renders SignupOnboardingChecklist", () => {
    expect(dashboardSource).toContain(
      'import { SignupOnboardingChecklist } from "@/components/signup-onboarding-checklist"',
    );
    expect(dashboardSource).toContain("<SignupOnboardingChecklist />");
  });

  it("dashboard.tsx no longer renders the old 5-item 'Association Setup' card", () => {
    expect(dashboardSource).not.toContain(">Association Setup<");
    expect(dashboardSource).not.toMatch(/unitsConfigured\.completed/);
    expect(dashboardSource).not.toMatch(/communicationTemplatesConfigured/);
  });

  it("checklist component consumes /api/onboarding/signup-checklist", () => {
    expect(checklistSource).toContain('"/api/onboarding/signup-checklist"');
  });

  it("checklist component posts to /api/onboarding/dismiss", () => {
    expect(checklistSource).toContain('"/api/onboarding/dismiss"');
    expect(checklistSource).toMatch(/apiRequest\(\s*"POST"/);
  });

  it("checklist component wires the four Q2 items with click-through hrefs (AC 2)", () => {
    // Each item must have a real /app/* href (no new /app/onboarding route).
    expect(checklistSource).toContain('href: "/app/association-context"');
    expect(checklistSource).toContain('href: "/app/board"');
    expect(checklistSource).toContain('href: "/app/units"');
    expect(checklistSource).toContain('href: "/app/documents"');
  });

  it("does not add a new /app/onboarding route (AC 3)", () => {
    // Negative scan for the route used as a string literal / href (ignoring
    // comments that may reference the spec).
    const linkLikePattern = /["'`]\/app\/onboarding/;
    expect(dashboardSource).not.toMatch(linkLikePattern);
    expect(checklistSource).not.toMatch(linkLikePattern);
  });

  it("banner hides when dismissed OR when all items complete (AC 4/5)", () => {
    expect(checklistSource).toContain("if (data.dismissed) return null;");
    expect(checklistSource).toMatch(/completedCount\s*===\s*ITEMS\.length/);
  });
});
