// Wave 16a — Playwright amenities toggle round-trip flow.
// Wave 26 — graduated to real backend (ephemeral pglite + dev server).
//
// The spec runs in one of two modes depending on the environment:
//
//   * Real-backend mode (`PLAYWRIGHT_REAL_BACKEND=1`) — globalSetup spins up
//     pglite + pg-gateway, the dev server connects to it as if it were a
//     normal Postgres, and this spec exercises real DB rows. The Manager
//     PATCH hits the real `/api/associations/:id/settings/amenities`
//     handler; the Owner-side `/api/portal/amenities/settings` and
//     `/api/portal/amenities` reads run against the same row.
//
//   * Route-mock mode (default) preserves the Wave-16a behaviour: the
//     spec uses `page.route` to stub `/api/*` against an in-memory
//     store. This mode is kept so the static-server fallback stays
//     green for environments that have not opted in to the real
//     backend.
//
// Both modes share the same assertions: Manager flips `amenitiesEnabled`
// off → Owner-side reads reflect the flip → Manager flips back → Owner
// reads recover.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import { loginAsManager, loginAsOwner } from "./helpers/auth-helper";
import {
  createRealBackend,
  createSeedStore,
  installSeedRoutes,
  type RealBackendHandle,
} from "./helpers/seed-helper";

const REAL_BACKEND = process.env.PLAYWRIGHT_REAL_BACKEND === "1";
const ASSOCIATION_ID = "assoc-e2e-1";
const HANDOFF_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  ".playwright-real-backend.json",
);

interface RealBackendHandoff {
  connectionString: string;
  sessionSecret: string;
}

function readHandoff(): RealBackendHandoff {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (fs.existsSync(HANDOFF_PATH)) {
      const raw = fs.readFileSync(HANDOFF_PATH, "utf8");
      return JSON.parse(raw) as RealBackendHandoff;
    }
    const start = Date.now();
    while (Date.now() - start < 100) {
      /* spin */
    }
  }
  throw new Error(`Real-backend handoff file not found at ${HANDOFF_PATH}`);
}

test.describe.configure({ mode: "serial" });

test.describe("Wave 16a/26 — amenities toggle round-trip", () => {
  if (!REAL_BACKEND) {
    // -----------------------------------------------------------------
    // Wave-16a route-mock path — kept verbatim so static-server CI runs
    // unchanged.
    // -----------------------------------------------------------------
    test("manager flip → owner reflects → manager flip back (route-mock)", async ({ page }) => {
      const store = createSeedStore();
      await loginAsManager(page);
      await installSeedRoutes(page, store);

      await page.goto("/app");

      const disable = await page.evaluate(async () => {
        const res = await fetch("/api/associations/assoc-e2e-1/settings/amenities", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amenitiesEnabled: false }),
        });
        return { ok: res.ok, body: await res.json() };
      });
      expect(disable.ok).toBe(true);
      expect((disable.body as { amenitiesEnabled: boolean }).amenitiesEnabled).toBe(false);
      expect(store.associations.get("assoc-e2e-1")?.amenitiesEnabled).toBe(false);

      await loginAsOwner(page);

      await page.goto("/portal");
      const ownerSettings = await page.evaluate(async () => {
        const res = await fetch("/api/portal/amenities/settings");
        return { ok: res.ok, body: await res.json() };
      });
      expect(ownerSettings.ok).toBe(true);
      expect((ownerSettings.body as { amenitiesEnabled: boolean }).amenitiesEnabled).toBe(false);

      const ownerListing = await page.evaluate(async () => {
        const res = await fetch("/api/portal/amenities");
        return res.status;
      });
      expect(ownerListing).toBe(404);

      await page.goto("/portal/amenities");
      await expect(page).toHaveURL(/\/portal\/amenities/);

      await loginAsManager(page);
      await page.goto("/app");
      const enable = await page.evaluate(async () => {
        const res = await fetch("/api/associations/assoc-e2e-1/settings/amenities", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amenitiesEnabled: true }),
        });
        return res.ok;
      });
      expect(enable).toBe(true);
      expect(store.associations.get("assoc-e2e-1")?.amenitiesEnabled).toBe(true);

      await loginAsOwner(page);
      await page.goto("/portal");
      const ownerSettingsAfter = await page.evaluate(async () => {
        const res = await fetch("/api/portal/amenities/settings");
        return res.json();
      });
      expect((ownerSettingsAfter as { amenitiesEnabled: boolean }).amenitiesEnabled).toBe(true);

      const ownerListingAfter = await page.evaluate(async () => {
        const res = await fetch("/api/portal/amenities");
        return res.status;
      });
      expect(ownerListingAfter).toBe(200);

      await page.goto("/portal/amenities");
      await expect(page).toHaveURL(/\/portal\/amenities/);
    });
    return;
  }

  // -------------------------------------------------------------------
  // Wave-26 real-backend path. Both the Manager PATCH and the Owner
  // reads run against the real handler, against rows seeded directly
  // into the ephemeral pglite via createRealBackend.
  // -------------------------------------------------------------------
  let backend: RealBackendHandle;

  test.beforeAll(async () => {
    const handoff = readHandoff();
    backend = await createRealBackend({
      connectionString: handoff.connectionString,
      sessionSecret: handoff.sessionSecret,
      cookieName: "sid_dev",
    });
  });

  test.afterAll(async () => {
    await backend?.cleanup();
  });

  test.beforeEach(async () => {
    await backend.reset();
    await backend.seedAssociation(ASSOCIATION_ID, "E2E Test Association", { amenitiesEnabled: true });
  });

  test("manager flip → owner reflects → manager flip back (real backend)", async ({ context, page }) => {
    // Seed: one Owner + one amenity so the listing endpoint has rows
    // to return when the toggle is on.
    const owner = await backend.installOwnerSession(page, { associationId: ASSOCIATION_ID });
    await backend.seedAmenity({ associationId: ASSOCIATION_ID, name: "Pool" });

    // Install a manager session on the same browser context. The
    // manager flow uses session cookies; the owner flow uses a
    // localStorage portalAccessId — they coexist.
    await backend.installManagerSession(context, {
      email: "manager@e2e.test",
      associationId: ASSOCIATION_ID,
    });

    // Trigger any non-API request first so cookies + localStorage are
    // both attached before we hit the REST endpoints.
    await page.goto("/app");

    // 1. Manager disables amenities via the real PATCH handler.
    const disable = await page.evaluate(async (associationId: string) => {
      const res = await fetch(`/api/associations/${associationId}/settings/amenities`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ amenitiesEnabled: false }),
      });
      return { ok: res.ok, status: res.status, body: await res.json() };
    }, ASSOCIATION_ID);
    expect(disable.status).toBe(200);
    expect((disable.body as { amenitiesEnabled: boolean }).amenitiesEnabled).toBe(false);

    // 2. Owner-side settings query reflects the flip.
    await page.goto("/portal");
    const ownerSettings = await page.evaluate(async (portalAccessId: string) => {
      const res = await fetch("/api/portal/amenities/settings", {
        headers: { "x-portal-access-id": portalAccessId },
      });
      return { status: res.status, body: await res.json() };
    }, owner.portalAccessId);
    expect(ownerSettings.status).toBe(200);
    expect((ownerSettings.body as { amenitiesEnabled: boolean }).amenitiesEnabled).toBe(false);

    // 3. Owner-side amenity listing 404s — the route guard on the real
    //    handler returns "Amenities disabled for this association".
    const ownerListing = await page.evaluate(async (portalAccessId: string) => {
      const res = await fetch("/api/portal/amenities", {
        headers: { "x-portal-access-id": portalAccessId },
      });
      return res.status;
    }, owner.portalAccessId);
    expect(ownerListing).toBe(404);

    // 4. Visit /portal/amenities and assert the route is reachable.
    await page.goto("/portal/amenities");
    await expect(page).toHaveURL(/\/portal\/amenities/);

    // 5. Manager flips the toggle back on.
    const enable = await page.evaluate(async (associationId: string) => {
      const res = await fetch(`/api/associations/${associationId}/settings/amenities`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ amenitiesEnabled: true }),
      });
      return { ok: res.ok, body: await res.json() };
    }, ASSOCIATION_ID);
    expect(enable.ok).toBe(true);
    expect((enable.body as { amenitiesEnabled: boolean }).amenitiesEnabled).toBe(true);

    // 6. Owner reads recover.
    await page.goto("/portal");
    const ownerSettingsAfter = await page.evaluate(async (portalAccessId: string) => {
      const res = await fetch("/api/portal/amenities/settings", {
        headers: { "x-portal-access-id": portalAccessId },
      });
      return res.json();
    }, owner.portalAccessId);
    expect((ownerSettingsAfter as { amenitiesEnabled: boolean }).amenitiesEnabled).toBe(true);

    const ownerListingAfter = await page.evaluate(async (portalAccessId: string) => {
      const res = await fetch("/api/portal/amenities", {
        headers: { "x-portal-access-id": portalAccessId },
      });
      return res.status;
    }, owner.portalAccessId);
    expect(ownerListingAfter).toBe(200);

    await page.goto("/portal/amenities");
    await expect(page).toHaveURL(/\/portal\/amenities/);
  });
});
