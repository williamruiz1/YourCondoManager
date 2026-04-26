// Wave 16a — Playwright owner portal navigation flow.
// Wave 26 — graduated to real backend (ephemeral pglite + dev server).
// Wave 16c — per-zone deep-content assertions added on top of the
// existing shell visibility check.
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
//
// Wave 16c — Before this wave, the per-zone navigation loop only
// asserted that `[data-testid="portal-main"]` (the PortalShell <main>)
// rendered. That confirmed the route resolved and the session gate
// passed but said nothing about whether the zone's body actually
// rendered: a child fan-out failure that triggered the global
// ErrorBoundary fallback would still satisfy `portal-main` visible.
// `assertZoneRendered` below replaces that with a four-part check per
// zone (no error-boundary, container present, heading text, breadcrumb
// trail) that fails loudly when only the shell renders.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect, type Page } from "@playwright/test";
import { loginAsOwner } from "./helpers/auth-helper";
import { runAxeAuditSoft } from "./helpers/a11y-check";
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

/**
 * Wave 16c — per-zone selector inventory.
 *
 * Each zone is verified by four signals that together prove the body
 * rendered (not just the shell):
 *
 *   1. `containerTestId` — the top-level `<div data-testid="portal-…">`
 *      wrapper inside the shell's <main>. If this is missing, only the
 *      shell painted (which is exactly the failure mode Wave-16a's
 *      `portal-main` check could not catch).
 *   2. `headingTestId` + `headingTextPattern` — the zone's <h1>. The
 *      pattern is matched against the rendered text; for zones whose
 *      heading varies by user state (e.g. portal-home's greeting) the
 *      pattern accepts either form.
 *   3. `breadcrumbLast` — the trailing breadcrumb segment. Confirms the
 *      shell's `resolvePortalBreadcrumb` produced a trail for this
 *      route. Hidden when the route is unrecognised.
 *   4. `extraTestId` (optional) — one zone-specific structural element
 *      that proves data-driven content reached the DOM. Picked
 *      conservatively — must be present for empty-DB renders.
 */
type ZoneAssertion = {
  path: string;
  label: string;
  containerTestId: string;
  headingTestId: string;
  headingTextPattern: RegExp;
  breadcrumbLast: string;
  extraTestId?: string;
};

const ZONES: readonly ZoneAssertion[] = [
  {
    path: "/portal",
    label: "Home",
    containerTestId: "portal-home",
    headingTestId: "portal-home-heading",
    // First-render: greeting fallback "Welcome to your portal";
    // session.firstName populated: "Welcome, <name>".
    headingTextPattern: /Welcome/,
    breadcrumbLast: "Home",
    extraTestId: "portal-home-summary-cards",
  },
  {
    path: "/portal/finances",
    label: "My Finances",
    containerTestId: "portal-finances",
    headingTestId: "portal-finances-heading",
    headingTextPattern: /My Finances/,
    breadcrumbLast: "My Finances",
    // Always rendered (`balance ?? 0` → "$0.00") regardless of seed data.
    extraTestId: "portal-finances-balance",
  },
  {
    path: "/portal/requests",
    label: "Requests",
    containerTestId: "portal-requests",
    headingTestId: "portal-requests-heading",
    headingTextPattern: /My Requests/,
    breadcrumbLast: "My Requests",
    extraTestId: "portal-requests-form",
  },
  {
    path: "/portal/community",
    label: "Community",
    containerTestId: "portal-community",
    headingTestId: "portal-community-heading",
    headingTextPattern: /My Community/,
    breadcrumbLast: "My Community",
    extraTestId: "portal-community-shortcuts",
  },
  {
    path: "/portal/amenities",
    label: "Amenities",
    containerTestId: "portal-amenities",
    headingTestId: "portal-amenities-heading",
    headingTextPattern: /Amenities/,
    breadcrumbLast: "Amenities",
    // Heading + container are the only universally-present anchors —
    // the amenities grid is empty with the route-mock seed. No extra.
  },
  {
    path: "/portal/documents",
    label: "Documents",
    containerTestId: "portal-documents",
    headingTestId: "portal-documents-heading",
    headingTextPattern: /Association documents/,
    breadcrumbLast: "Documents",
  },
  {
    path: "/portal/notices",
    label: "Notices",
    containerTestId: "portal-notices",
    headingTestId: "portal-notices-heading",
    headingTextPattern: /Notices/,
    breadcrumbLast: "Notices",
  },
] as const;

/**
 * Wave 16c — verify a zone rendered fully, not just the shell.
 *
 * Order matters: the error-boundary check runs FIRST so that when a
 * zone's data fan-out throws (the original Wave-16a blind spot) the
 * test fails on the most diagnostic assertion rather than a
 * downstream "heading not found".
 */
async function assertZoneRendered(page: Page, zone: ZoneAssertion): Promise<void> {
  // Shell rendered.
  await page
    .getByTestId("portal-main")
    .waitFor({ state: "visible", timeout: 15_000 });

  // Error-boundary fallback must NOT be on the page. The boundary
  // testid (`error-boundary-fallback`) is set in
  // `client/src/components/error-boundary.tsx`. Hidden state covers
  // both "not present in DOM" and "present but invisible".
  await expect(
    page.getByTestId("error-boundary-fallback"),
    `error boundary rendered for ${zone.path}`,
  ).toBeHidden();

  // Zone container — the <main>'s direct child wrapper rendered.
  const container = page.getByTestId(zone.containerTestId);
  await expect(container, `${zone.containerTestId} not visible at ${zone.path}`).toBeVisible({
    timeout: 15_000,
  });

  // Heading testid present and text matches the zone's expected pattern.
  const heading = page.getByTestId(zone.headingTestId);
  await expect(heading, `${zone.headingTestId} not visible at ${zone.path}`).toBeVisible();
  await expect(heading, `${zone.headingTestId} text mismatch at ${zone.path}`).toHaveText(
    zone.headingTextPattern,
  );

  // Breadcrumb trail — the last segment matches the zone's label.
  const breadcrumb = page.getByTestId("portal-breadcrumb");
  await expect(breadcrumb, `breadcrumb missing at ${zone.path}`).toBeVisible();
  // The trail is rendered as <li> children; the LAST <li> is the
  // current page (aria-current="page" is set there). Match against
  // the breadcrumb's full text — looser than `.last()` and resilient
  // to DOM structure changes within the breadcrumb component.
  await expect(breadcrumb, `breadcrumb trail wrong at ${zone.path}`).toContainText(
    zone.breadcrumbLast,
  );

  // Optional extra: a zone-specific stable element that proves data
  // reached the DOM (not just the static heading).
  if (zone.extraTestId) {
    await expect(
      page.getByTestId(zone.extraTestId),
      `${zone.extraTestId} not visible at ${zone.path}`,
    ).toBeVisible();
  }
}

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
        // Wave 16c — full zone render assertion (replaces the prior
        // shell-only check). See `assertZoneRendered` above for the
        // four-part contract.
        await assertZoneRendered(page, zone);
      }

      expect(pageErrors, `unexpected page errors: ${JSON.stringify(pageErrors)}`).toEqual([]);

      // Wave 25 — axe-core audit on the final zone visited.
      await runAxeAuditSoft(page, "portal-nav:route-mock");
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
      // Wave 16c — full zone render assertion (see helper).
      await assertZoneRendered(page, zone);
    }

    expect(pageErrors, `unexpected page errors: ${JSON.stringify(pageErrors)}`).toEqual([]);

    // Wave 25 — axe-core audit on the final zone visited.
    await runAxeAuditSoft(page, "portal-nav:real-backend");
  });

  test("legacy /portal?tab=financials redirects to /portal/finances (real backend)", async ({ page }) => {
    await backend.installOwnerSession(page, { associationId: ASSOCIATION_ID });

    await page.goto("/portal?tab=financials");
    await page.waitForURL(/\/portal\/finances($|\?|#)/, { timeout: 10_000 });
    expect(new URL(page.url()).pathname).toBe("/portal/finances");
  });
});
