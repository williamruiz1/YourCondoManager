// Wave 16a — Playwright owner portal navigation flow.
// Wave 26 — graduated to real backend (ephemeral pglite + dev server).
//
// Real-browser slice that converts the Wave-15b Flow D skeleton into a
// live navigation pass. Visits each of the seven owner-portal zones and
// asserts each renders without error, then exercises the legacy-URL
// compat layer at `/portal?tab=financials` → redirect to
// `/portal/finances`.
//
// The spec runs in one of two modes depending on the environment:
//
//   * Real-backend mode (`PLAYWRIGHT_REAL_BACKEND=1`) — globalSetup
//     spins up pglite + pg-gateway, the dev server connects to it, and
//     this spec inserts a real `portal_access` row + unit + person so
//     `requirePortal` resolves and every zone child fetch hits real
//     handlers backed by an empty (but valid) DB.
//
//   * Route-mock mode (default) preserves the Wave-16a behaviour: the
//     spec uses `page.route` + the in-memory store from
//     `installSeedRoutes`. Static-server fallback CI keeps working
//     unchanged.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import { loginAsOwner } from "./helpers/auth-helper";
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

const ZONES = [
  { path: "/portal", label: "Home" },
  { path: "/portal/finances", label: "My Finances" },
  { path: "/portal/requests", label: "Requests" },
  { path: "/portal/community", label: "Community" },
  { path: "/portal/amenities", label: "Amenities" },
  { path: "/portal/documents", label: "Documents" },
  { path: "/portal/notices", label: "Notices" },
] as const;

test.describe.configure({ mode: "serial" });

test.describe("Wave 16a/26 — owner portal navigation", () => {
  if (!REAL_BACKEND) {
    // -----------------------------------------------------------------
    // Wave-16a route-mock path — kept verbatim.
    // -----------------------------------------------------------------
    test("owner navigates all seven zones without error (route-mock)", async ({ page }) => {
      const store = createSeedStore();
      await loginAsOwner(page);
      await installSeedRoutes(page, store);

      const pageErrors: Array<{ zone: string; error: string }> = [];
      page.on("pageerror", (err) => {
        pageErrors.push({ zone: page.url(), error: err.message });
      });

      for (const zone of ZONES) {
        await page.goto(zone.path);
        await expect(page).toHaveURL(new RegExp(zone.path.replace(/\//g, "\\/")));
        await page
          .getByTestId("portal-main")
          .waitFor({ state: "visible", timeout: 15_000 });
      }

      expect(pageErrors, `unexpected page errors: ${JSON.stringify(pageErrors)}`).toEqual([]);
    });

    test("legacy /portal?tab=financials redirects to /portal/finances (route-mock)", async ({ page }) => {
      const store = createSeedStore();
      await loginAsOwner(page);
      await installSeedRoutes(page, store);

      await page.goto("/portal?tab=financials");
      await page.waitForURL(/\/portal\/finances($|\?|#)/, { timeout: 10_000 });
      expect(new URL(page.url()).pathname).toBe("/portal/finances");
    });
    return;
  }

  // -------------------------------------------------------------------
  // Wave-26 real-backend path. A single portal_access row is enough —
  // every zone-child endpoint reads from the real DB and returns []
  // when no rows exist for that owner.
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

  test("owner navigates all seven zones without error (real backend)", async ({ page }) => {
    // Seed: one association with all zones reachable. Empty content is
    // fine — the contract under test is "every zone renders the shell
    // and a top-level <main data-testid=portal-main> without throwing".
    await backend.installOwnerSession(page, { associationId: ASSOCIATION_ID });
    await backend.seedAmenity({ associationId: ASSOCIATION_ID, name: "Pool" });

    const pageErrors: Array<{ zone: string; error: string }> = [];
    page.on("pageerror", (err) => {
      pageErrors.push({ zone: page.url(), error: err.message });
    });

    for (const zone of ZONES) {
      await page.goto(zone.path);
      await expect(page).toHaveURL(new RegExp(zone.path.replace(/\//g, "\\/")));
      await page
        .getByTestId("portal-main")
        .waitFor({ state: "visible", timeout: 15_000 });
    }

    expect(pageErrors, `unexpected page errors: ${JSON.stringify(pageErrors)}`).toEqual([]);
  });

  test("legacy /portal?tab=financials redirects to /portal/finances (real backend)", async ({ page }) => {
    await backend.installOwnerSession(page, { associationId: ASSOCIATION_ID });

    await page.goto("/portal?tab=financials");
    await page.waitForURL(/\/portal\/finances($|\?|#)/, { timeout: 10_000 });
    expect(new URL(page.url()).pathname).toBe("/portal/finances");
  });
});
