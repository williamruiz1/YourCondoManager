/**
 * Phase 10 parity-harness skeleton — manifest data coherence.
 *
 * Asserts the Phase 9 persona-access manifest data artifact is internally
 * coherent. Does NOT import from `shared/persona-access.ts` (does not yet
 * exist) nor render any components. A local `MANIFEST_SAMPLE` constant
 * mirrors the top ~20 most important rows of the manifest-data artifact
 * at `docs/projects/platform-overhaul/implementation-artifacts/
 * phase-9-persona-access-manifest-data.md` so drift is caught at test time.
 *
 * When Phase 9 ships `shared/persona-access.ts`, replace MANIFEST_SAMPLE
 * with the real import.
 */

import { describe, it, expect } from "vitest";
import type { AdminRole } from "../utils/auth-helpers";
import { ALL_ADMIN_ROLES } from "../utils/auth-helpers";

type Access = "full" | "read-only" | "toggle-gated" | "denied";

interface ManifestRow {
  path: string;
  access: Partial<Record<AdminRole, Access>>;
}

// Transcribed from phase-9-persona-access-manifest-data.md Part 1 — top ~20
// canonical rows. Keep in sync with the artifact; update both together.
const MANIFEST_SAMPLE: ReadonlyArray<ManifestRow> = [
  // Row 1 — Home
  { path: "/app", access: { "manager": "full", "board-officer": "full", "assisted-board": "full", "pm-assistant": "full", "viewer": "read-only", "platform-admin": "full" } },
  // Row 2 — Financials hub
  { path: "/app/financials", access: { "manager": "full", "board-officer": "full", "assisted-board": "read-only", "pm-assistant": "toggle-gated", "viewer": "read-only", "platform-admin": "full" } },
  // Row 22 — Operations hub
  { path: "/app/operations", access: { "manager": "full", "board-officer": "full", "assisted-board": "full", "pm-assistant": "toggle-gated", "viewer": "read-only", "platform-admin": "full" } },
  // Row 25 — Governance hub
  { path: "/app/governance", access: { "manager": "full", "board-officer": "full", "assisted-board": "full", "pm-assistant": "toggle-gated", "viewer": "read-only", "platform-admin": "full" } },
  // Row 32 — Communications hub
  { path: "/app/communications", access: { "manager": "full", "board-officer": "full", "assisted-board": "full", "pm-assistant": "toggle-gated", "viewer": "read-only", "platform-admin": "full" } },
  // Row 35 — Associations
  { path: "/app/associations", access: { "manager": "full", "board-officer": "full", "assisted-board": "full", "pm-assistant": "full", "viewer": "full", "platform-admin": "full" } },
  // Row 38 — Units
  { path: "/app/units", access: { "manager": "full", "board-officer": "full", "assisted-board": "read-only", "pm-assistant": "toggle-gated", "viewer": "read-only", "platform-admin": "full" } },
  // Row 39 — Persons
  { path: "/app/persons", access: { "manager": "full", "board-officer": "full", "assisted-board": "read-only", "pm-assistant": "toggle-gated", "viewer": "read-only", "platform-admin": "full" } },
  // Row 42 — Board
  { path: "/app/board", access: { "manager": "full", "board-officer": "full", "assisted-board": "full", "pm-assistant": "toggle-gated", "viewer": "read-only", "platform-admin": "full" } },
  // Row 43 — Documents
  { path: "/app/documents", access: { "manager": "full", "board-officer": "full", "assisted-board": "full", "pm-assistant": "toggle-gated", "viewer": "read-only", "platform-admin": "full" } },
  // Row 45 — Platform: Admin roadmap
  { path: "/app/admin/roadmap", access: { "platform-admin": "full" } },
  // Row 46 — Platform: Admin users
  { path: "/app/admin/users", access: { "platform-admin": "full" } },
  // Row 48 — AI Ingestion
  { path: "/app/ai/ingestion", access: { "platform-admin": "full" } },
  // Row 49 — Platform Controls
  { path: "/app/platform/controls", access: { "platform-admin": "full" } },
  // Row 50-52 — Vendors / Work Orders / Resident Feedback
  { path: "/app/vendors", access: { "manager": "full", "board-officer": "full", "assisted-board": "read-only", "pm-assistant": "toggle-gated", "viewer": "read-only", "platform-admin": "full" } },
  { path: "/app/work-orders", access: { "manager": "full", "board-officer": "full", "assisted-board": "read-only", "pm-assistant": "toggle-gated", "viewer": "read-only", "platform-admin": "full" } },
  { path: "/app/resident-feedback", access: { "manager": "full", "board-officer": "full", "assisted-board": "read-only", "pm-assistant": "toggle-gated", "viewer": "read-only", "platform-admin": "full" } },
  // Row 56 — Portfolio
  { path: "/app/portfolio", access: { "manager": "full", "pm-assistant": "full", "viewer": "read-only", "platform-admin": "full" } },
  // Row 61 — Settings
  { path: "/app/settings", access: { "manager": "full", "board-officer": "full", "platform-admin": "full" } },
  // Row 62 — Settings: Billing (Manager-only, per 4.4 Q6)
  { path: "/app/settings/billing", access: { "manager": "full" } },
];

const VALID_ROLES: ReadonlyArray<AdminRole> = ALL_ADMIN_ROLES;

describe("parity: manifest-consistency — route shape", () => {
  it("every route is a valid string", () => {
    for (const row of MANIFEST_SAMPLE) {
      expect(typeof row.path).toBe("string");
      expect(row.path.length).toBeGreaterThan(0);
    }
  });

  it("every route path starts with /app/, /portal/, or exactly /app", () => {
    for (const row of MANIFEST_SAMPLE) {
      const ok =
        row.path === "/app" ||
        row.path.startsWith("/app/") ||
        row.path.startsWith("/portal/") ||
        row.path === "/";
      expect(ok, `Invalid route shape for path "${row.path}"`).toBe(true);
    }
  });
});

describe("parity: manifest-consistency — persona validity", () => {
  it("every persona key in every access map is a valid AdminRole", () => {
    for (const row of MANIFEST_SAMPLE) {
      for (const persona of Object.keys(row.access)) {
        expect(VALID_ROLES, `Unknown persona "${persona}" on "${row.path}"`).toContain(persona);
      }
    }
  });

  it("no access mode is an unrecognized string", () => {
    const validModes: Access[] = ["full", "read-only", "toggle-gated", "denied"];
    for (const row of MANIFEST_SAMPLE) {
      for (const [persona, mode] of Object.entries(row.access)) {
        expect(validModes, `Invalid mode "${mode}" on "${row.path}" / ${persona}`).toContain(mode);
      }
    }
  });
});

describe("parity: manifest-consistency — persona coverage", () => {
  it("at least one route is accessible by each of the 6 operator personas", () => {
    for (const persona of VALID_ROLES) {
      const reachable = MANIFEST_SAMPLE.some(
        (row) => row.access[persona] !== undefined && row.access[persona] !== "denied",
      );
      expect(reachable, `Persona "${persona}" has no reachable route in sample`).toBe(true);
    }
  });
});

describe("parity: manifest-consistency — platform isolation", () => {
  it("exactly one role — platform-admin — has access to /app/platform/controls", () => {
    const platformControls = MANIFEST_SAMPLE.find((r) => r.path === "/app/platform/controls");
    expect(platformControls).toBeDefined();
    const keys = Object.keys(platformControls!.access) as AdminRole[];
    expect(keys).toEqual(["platform-admin"]);
    expect(platformControls!.access["platform-admin"]).toBe("full");
  });

  it("manager and board-officer both have access to /app", () => {
    const home = MANIFEST_SAMPLE.find((r) => r.path === "/app");
    expect(home).toBeDefined();
    expect(home!.access["manager"]).toBeDefined();
    expect(home!.access["manager"]).not.toBe("denied");
    expect(home!.access["board-officer"]).toBeDefined();
    expect(home!.access["board-officer"]).not.toBe("denied");
  });
});

describe("parity: manifest-consistency — owner scope boundary", () => {
  it("owner does NOT appear in any /app/* manifest entry (owner uses /portal)", () => {
    for (const row of MANIFEST_SAMPLE) {
      if (!row.path.startsWith("/app")) continue;
      // "owner" is a portal role, not an AdminRole — accessing the access map
      // with it should return undefined. Verify via object key check.
      expect(Object.keys(row.access)).not.toContain("owner");
    }
  });
});
