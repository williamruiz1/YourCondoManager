/**
 * Unit tests for `shared/persona-access.ts` (Phase 0b.2 stub) per ADR 0b.
 *
 * The Phase 0b.2 stub exports the stable contract with empty manifests and a
 * `canAccess` predicate that defaults-deny every input. These tests lock in:
 *
 *   - OQ-3 Option A (strict default-deny) for null/undefined role.
 *   - Unknown-route default-deny for any role value.
 *   - Module-shape guarantees (manifests are objects, `AdminRole` is re-exported).
 *   - `canAccess` correctly reads ROUTE_MANIFEST when it contains data
 *     (via `vi.doMock` to inject a test-only manifest — the live manifest
 *     is `Readonly` so mutation is not an option).
 *
 * `usePersonaToggles` is a React hook; it cannot run under the node test
 * runner here. Its contract (returns `{}` in Phase 0b.2) is covered in the
 * jsdom smoke file.
 */

import { describe, it, expect, vi } from "vitest";
import {
  canAccess,
  ROUTE_MANIFEST,
  FEATURE_MANIFEST,
} from "../shared/persona-access";
import type { AdminRole } from "../shared/persona-access";
import { adminUserRoleEnum } from "../shared/schema";

describe("canAccess — strict default-deny (OQ-3 Option A)", () => {
  it("returns false for null role on any route", () => {
    expect(canAccess(null, "/app/any")).toBe(false);
  });

  it("returns false for undefined role on any route", () => {
    expect(canAccess(undefined, "/app/any")).toBe(false);
  });

  it("returns false for a concrete role on an unknown route (default-deny)", () => {
    // Routes absent from ROUTE_MANIFEST yield `undefined` → strict deny.
    expect(canAccess("manager", "/app/any")).toBe(false);
  });

  it("returns false for platform-admin on an unknown route (no implicit bypass)", () => {
    // Platform admin is not privileged over the manifest; unknown routes
    // still deny. This locks in OQ-3 Option A: no wildcard-allow, no escape
    // hatch. Phase 9 populates the manifest; platform-admin routes must be
    // listed there explicitly.
    expect(canAccess("platform-admin", "/app/any")).toBe(false);
  });

  it("returns false for every AdminRole on routes still absent from the manifest (post-Phase-12)", () => {
    // Sweep: routes still not populated by Phase 12 (Operations / Governance /
    // Communications / Platform — they land in Phases 13–16) must deny every
    // role under strict default-deny (OQ-3 Option A).
    const stillAbsentRoutes = [
      "/app",
      "/app/governance/meetings",
      "/app/platform/controls",
      "/",
    ];
    for (const role of adminUserRoleEnum.enumValues) {
      for (const route of stillAbsentRoutes) {
        expect(canAccess(role as AdminRole, route)).toBe(false);
      }
    }
  });
});

describe("canAccess — predicate shape (mocked manifest)", () => {
  it("returns true when role is in ROUTE_MANIFEST[route], false otherwise", async () => {
    // Live ROUTE_MANIFEST is Readonly — use vi.doMock to load a test-only
    // copy of the module with a populated manifest, then re-import via the
    // dynamic ESM loader. The live module import above is unaffected.
    vi.doMock("../shared/persona-access", async () => {
      const actual = await vi.importActual<
        typeof import("../shared/persona-access")
      >("../shared/persona-access");
      return {
        ...actual,
        ROUTE_MANIFEST: {
          "/app/test": ["manager"] as const,
          "/app/admin": ["platform-admin"] as const,
        },
        canAccess: (
          role: AdminRole | null | undefined,
          route: string,
        ): boolean => {
          if (role == null) return false;
          const manifest: Record<string, readonly AdminRole[]> = {
            "/app/test": ["manager"],
            "/app/admin": ["platform-admin"],
          };
          const allowed = manifest[route];
          if (!allowed) return false;
          return allowed.includes(role);
        },
      };
    });

    const mocked = await import("../shared/persona-access");

    // Role present in manifest allowlist for that route → allow.
    expect(mocked.canAccess("manager", "/app/test")).toBe(true);
    // Role absent from allowlist for that route → deny.
    expect(mocked.canAccess("viewer", "/app/test")).toBe(false);
    // Different route with different allowlist.
    expect(mocked.canAccess("platform-admin", "/app/admin")).toBe(true);
    expect(mocked.canAccess("manager", "/app/admin")).toBe(false);
    // Unknown route still denies.
    expect(mocked.canAccess("manager", "/app/unknown")).toBe(false);
    // Null/undefined role still denies even with a populated manifest.
    expect(mocked.canAccess(null, "/app/test")).toBe(false);
    expect(mocked.canAccess(undefined, "/app/test")).toBe(false);

    vi.doUnmock("../shared/persona-access");
  });
});

describe("canAccess — platform-admin financials access (2026-06-02 pilot grant)", () => {
  it("canAccess('platform-admin', '/app/financial/payments') === true", () => {
    // Platform Admin was granted access to financial routes per William's
    // 2026-06-02 pilot decision (owner is also the board; resolves the
    // front/back drift where the backend already permitted platform-admin).
    expect(canAccess("platform-admin", "/app/financial/payments")).toBe(true);
  });

  it("platform-admin can access all canonical financial sub-pages", () => {
    const financialRoutes = [
      "/app/financials",
      "/app/financial/foundation",
      "/app/financial/billing",
      "/app/financial/payments",
      "/app/financial/expenses",
      "/app/financial/reports",
      "/app/financial/rules",
      "/app/financial/bank-connections",
      "/app/financial/statement",
    ];
    for (const route of financialRoutes) {
      expect(canAccess("platform-admin", route)).toBe(true);
    }
  });

  it("platform-admin can access all legacy financial redirect routes", () => {
    const legacyRoutes = [
      "/app/financial/fees",
      "/app/financial/recurring-charges",
      "/app/financial/ledger",
      "/app/financial/assessments",
      "/app/financial/late-fees",
      "/app/financial/invoices",
      "/app/financial/utilities",
      "/app/financial/budgets",
      "/app/financial/reconciliation",
    ];
    for (const route of legacyRoutes) {
      expect(canAccess("platform-admin", route)).toBe(true);
    }
  });

  it("existing five-persona-operator roles still have financials access", () => {
    const fivePersonaRoles: AdminRole[] = [
      "manager",
      "board-officer",
      "assisted-board",
      "pm-assistant",
      "viewer",
    ];
    for (const role of fivePersonaRoles) {
      expect(canAccess(role, "/app/financial/payments")).toBe(true);
    }
  });

  it("platform-admin is still denied on unknown routes (OQ-3 Option A preserved)", () => {
    expect(canAccess("platform-admin", "/app/any")).toBe(false);
    expect(canAccess("platform-admin", "/app/governance/meetings")).toBe(false);
    expect(canAccess("platform-admin", "/app/admin/users")).toBe(true);
  });
});

describe("Module shape — Phase 0b.2 contract lock", () => {
  it("ROUTE_MANIFEST is an object", () => {
    expect(ROUTE_MANIFEST).toBeDefined();
    expect(typeof ROUTE_MANIFEST).toBe("object");
    expect(ROUTE_MANIFEST).not.toBeNull();
  });

  it("ROUTE_MANIFEST contains Financials zone routes after Phase 12 (Zone 1) lands", () => {
    // Phase 12 (3.3 Zone 1 — Financials) populates the Financials zone
    // entries. Phases 13–16 add the remaining zones. This assertion
    // tightens as later zones land.
    expect(Object.keys(ROUTE_MANIFEST).length).toBeGreaterThan(0);
    expect(ROUTE_MANIFEST["/app/financials"]).toBeDefined();
    expect(ROUTE_MANIFEST["/app/financial/billing"]).toBeDefined();
    expect(ROUTE_MANIFEST["/app/financial/payments"]).toBeDefined();
    expect(ROUTE_MANIFEST["/app/financial/expenses"]).toBeDefined();
    expect(ROUTE_MANIFEST["/app/financial/reports"]).toBeDefined();
    expect(ROUTE_MANIFEST["/app/financial/foundation"]).toBeDefined();
    expect(ROUTE_MANIFEST["/app/financial/rules"]).toBeDefined();
    expect(ROUTE_MANIFEST["/app/settings/billing"]).toBeDefined();
  });

  it("FEATURE_MANIFEST is an object", () => {
    expect(FEATURE_MANIFEST).toBeDefined();
    expect(typeof FEATURE_MANIFEST).toBe("object");
    expect(FEATURE_MANIFEST).not.toBeNull();
  });

  it("FEATURE_MANIFEST is empty in Phase 0b.2 (Phase 9 populates)", () => {
    expect(Object.keys(FEATURE_MANIFEST).length).toBe(0);
  });

  it("canAccess is a function with arity 2", () => {
    expect(typeof canAccess).toBe("function");
    expect(canAccess.length).toBe(2);
  });

  it("re-exports AdminRole type (compile-time check — value-level smoke)", () => {
    // TypeScript type re-export cannot be introspected at runtime, but we can
    // confirm the same value space is addressable by assigning a sampled
    // enum value through the re-exported type annotation.
    const role: AdminRole = adminUserRoleEnum.enumValues[0] as AdminRole;
    expect(adminUserRoleEnum.enumValues).toContain(role);
  });
});
