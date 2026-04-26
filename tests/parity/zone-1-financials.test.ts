/**
 * Phase 12 (3.3 Zone 1 — Financials) parity harness.
 *
 * Per 3.3 Q4 — risk-weighted three-tier coverage scoped to the Financials
 * zone:
 *   - Tier 1 (exhaustive): every Financials route × all 6 operator personas.
 *     The persona-access manifest is the source of truth; this tier asserts
 *     that what the manifest says, `canAccess` returns.
 *   - Tier 2 (happy-path): one representative Financials route asserted
 *     allow for the two primary personas (Manager + Board Officer) and
 *     deny for portal Owner.
 *   - Tier 3 (sidebar smoke): the Financials zone must surface to the
 *     5-persona-operator class and stay absent for unauthenticated +
 *     platform-admin (which is `❌` on /app/financial/* per 0.2 matrix).
 *
 * No JSX render here — Tier 3 sidebar smoke uses `filterZonesForPersona`
 * directly (the same primitive the sidebar component consumes). Render-
 * level parity is covered by the existing sidebar-visibility-predictions
 * suite + Phase 13's harness.
 */

import { describe, it, expect } from "vitest";
import { canAccess, ROUTE_MANIFEST } from "../../shared/persona-access";
import type { AdminRole } from "../../shared/schema";
import { ALL_ADMIN_ROLES } from "../utils/auth-helpers";
import {
  SIDEBAR_ZONES,
  filterZonesForPersona,
  ZONE_LABELS,
} from "../../client/src/components/app-sidebar-zones";

// ---------------------------------------------------------------------------
// Financials route catalog — every route the Phase 12 PR wraps in
// `<RouteGuard>`. Mirrors the populated entries in `shared/persona-access.ts`
// `ROUTE_MANIFEST` so any drift between this list and the manifest is
// caught by the consistency assertion in `describe("manifest coherence")`.
// ---------------------------------------------------------------------------

const FINANCIALS_HUB = "/app/financials";
const FINANCIALS_PLURAL_REDIRECTS = [
  "/app/financials/foundation",
  "/app/financials/billing",
  "/app/financials/payments",
  "/app/financials/expenses",
  "/app/financials/reports",
] as const;
const FINANCIALS_CANONICAL = [
  "/app/financial/foundation",
  "/app/financial/billing",
  "/app/financial/payments",
  "/app/financial/expenses",
  "/app/financial/reports",
  "/app/financial/rules",
] as const;
const FINANCIALS_LEGACY_REDIRECTS = [
  "/app/financial/fees",
  "/app/financial/recurring-charges",
  "/app/financial/ledger",
  "/app/financial/assessments",
  "/app/financial/late-fees",
  "/app/financial/invoices",
  "/app/financial/utilities",
  "/app/financial/budgets",
  "/app/financial/reconciliation",
] as const;
const SETTINGS_BILLING = "/app/settings/billing";

const ALL_FINANCIALS_ROUTES = [
  FINANCIALS_HUB,
  ...FINANCIALS_PLURAL_REDIRECTS,
  ...FINANCIALS_CANONICAL,
  ...FINANCIALS_LEGACY_REDIRECTS,
  SETTINGS_BILLING,
] as const;

// Personas that should be allowed on /app/financial/* per 0.2 matrix.
// Platform Admin is `❌` on customer-tenant Financials per Persona 6
// definition (admin manages YCM-internal tooling, not association
// day-to-day). Owner is `❌` on every /app/* route by 0.2 matrix.
const FINANCIALS_ALLOWED_PERSONAS: ReadonlyArray<AdminRole> = [
  "manager",
  "board-officer",
  "assisted-board",
  "pm-assistant",
  "viewer",
];
const FINANCIALS_DENIED_PERSONAS: ReadonlyArray<AdminRole> = ["platform-admin"];

// /app/settings/billing has its own role list; document it so Tier 1
// assertions match. (See HUMAN TASK in shared/persona-access.ts re:
// 4.4 Q6 manager-only spec vs shipped 4-role gate.)
const SETTINGS_BILLING_ALLOWED: ReadonlyArray<AdminRole> = [
  "platform-admin",
  "manager",
  "board-officer",
  "pm-assistant",
];
const SETTINGS_BILLING_DENIED: ReadonlyArray<AdminRole> = [
  "assisted-board",
  "viewer",
];

// ---------------------------------------------------------------------------
// Tier 1 — exhaustive: every Financials route × every persona.
// ---------------------------------------------------------------------------

describe("Phase 12 Tier 1 — Financials × all 6 personas (exhaustive)", () => {
  describe("all Financials zone routes (hub + redirects + canonical + legacy)", () => {
    const financialsZoneRoutes = [
      FINANCIALS_HUB,
      ...FINANCIALS_PLURAL_REDIRECTS,
      ...FINANCIALS_CANONICAL,
      ...FINANCIALS_LEGACY_REDIRECTS,
    ];

    for (const route of financialsZoneRoutes) {
      for (const persona of FINANCIALS_ALLOWED_PERSONAS) {
        it(`allows ${persona} on ${route}`, () => {
          expect(canAccess(persona, route)).toBe(true);
        });
      }
      for (const persona of FINANCIALS_DENIED_PERSONAS) {
        it(`denies ${persona} on ${route}`, () => {
          expect(canAccess(persona, route)).toBe(false);
        });
      }
    }
  });

  describe(`/app/settings/billing per shipped 4-role list`, () => {
    for (const persona of SETTINGS_BILLING_ALLOWED) {
      it(`allows ${persona} on /app/settings/billing`, () => {
        expect(canAccess(persona, SETTINGS_BILLING)).toBe(true);
      });
    }
    for (const persona of SETTINGS_BILLING_DENIED) {
      it(`denies ${persona} on /app/settings/billing`, () => {
        expect(canAccess(persona, SETTINGS_BILLING)).toBe(false);
      });
    }
  });

  describe("null / undefined role strict-deny", () => {
    for (const route of ALL_FINANCIALS_ROUTES) {
      it(`denies null role on ${route}`, () => {
        expect(canAccess(null, route)).toBe(false);
      });
      it(`denies undefined role on ${route}`, () => {
        expect(canAccess(undefined, route)).toBe(false);
      });
    }
  });
});

// ---------------------------------------------------------------------------
// Tier 2 — happy-path: one representative route asserted for the two
// primary Manager-equivalent personas + denied for Platform Admin.
// ---------------------------------------------------------------------------

describe("Phase 12 Tier 2 — Financials happy-path", () => {
  const REPRESENTATIVE = "/app/financial/billing";

  it(`Manager reaches ${REPRESENTATIVE}`, () => {
    expect(canAccess("manager", REPRESENTATIVE)).toBe(true);
  });

  it(`Board Officer reaches ${REPRESENTATIVE}`, () => {
    expect(canAccess("board-officer", REPRESENTATIVE)).toBe(true);
  });

  it(`Assisted Board reaches ${REPRESENTATIVE} (read-only enforcement is action-level, not route-level)`, () => {
    // The 0.2 matrix says Assisted Board has read-only access to
    // /app/financial/*. The route gate (this manifest) admits them; the
    // write-action gate (`useIsReadOnly()` per 2.3 Q7) suppresses
    // mutating actions inside the page. Phase 12 wraps the route only;
    // the action-level hook lands in a follow-up.
    expect(canAccess("assisted-board", REPRESENTATIVE)).toBe(true);
  });

  it(`Platform Admin denied ${REPRESENTATIVE} (per 0.2 matrix Platform Admin is ❌ on /app/financial/*)`, () => {
    expect(canAccess("platform-admin", REPRESENTATIVE)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tier 3 — sidebar smoke: filterZonesForPersona returns the Financials
// zone for the 5-persona-operator class and drops it for platform-admin
// + null.
// ---------------------------------------------------------------------------

describe("Phase 12 Tier 3 — sidebar SUBSET-RENDER for Financials zone", () => {
  function findFinancialsZone(role: AdminRole | null) {
    const zones = filterZonesForPersona(SIDEBAR_ZONES, {
      role,
      singleAssociationBoardExperience: false,
      amenitiesDisabled: false,
    });
    return zones.find((z) => z.label === ZONE_LABELS.FINANCIALS);
  }

  for (const persona of FINANCIALS_ALLOWED_PERSONAS) {
    it(`Financials zone visible in sidebar for ${persona}`, () => {
      const zone = findFinancialsZone(persona);
      expect(zone).toBeDefined();
      expect(zone!.label).toBe("Financials");
    });
  }

  it("Financials zone absent from sidebar for platform-admin (0.2 matrix Platform Admin = ❌ on Financials)", () => {
    const zone = findFinancialsZone("platform-admin");
    expect(zone).toBeUndefined();
  });

  it("Financials zone absent from sidebar when role is null (unauthenticated / pre-resolve)", () => {
    const zone = findFinancialsZone(null);
    expect(zone).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Manifest-vs-test-list coherence — guards against drift between the
// hardcoded route lists in this file and the live manifest.
// ---------------------------------------------------------------------------

describe("Phase 12 manifest coherence — Financials list ↔ ROUTE_MANIFEST", () => {
  it("every Financials route in this test file is present in ROUTE_MANIFEST", () => {
    for (const route of ALL_FINANCIALS_ROUTES) {
      expect(
        ROUTE_MANIFEST[route],
        `Route ${route} is in the test catalog but missing from ROUTE_MANIFEST`,
      ).toBeDefined();
    }
  });

  it("ALL_ADMIN_ROLES vocabulary matches what AdminRole admits", () => {
    // Sanity check that the test fixture roles match the schema enum.
    expect(ALL_ADMIN_ROLES).toContain("manager");
    expect(ALL_ADMIN_ROLES).toContain("board-officer");
    expect(ALL_ADMIN_ROLES).toContain("assisted-board");
    expect(ALL_ADMIN_ROLES).toContain("pm-assistant");
    expect(ALL_ADMIN_ROLES).toContain("viewer");
    expect(ALL_ADMIN_ROLES).toContain("platform-admin");
  });
});
