// Wave 16a — Playwright owner portal navigation flow.
//
// Real-browser slice that converts the Wave-15b Flow D skeleton
// (`tests/e2e/owner-portal-navigation.client.test.tsx` — `describe.skip`)
// into a live navigation pass. Visits each of the seven owner-portal
// zones and asserts each renders without error. Then exercises the
// legacy-URL compat layer at `/portal?tab=financials` → redirect to
// `/portal/finances`.

import { test, expect } from "@playwright/test";
import { loginAsOwner } from "./helpers/auth-helper";
import { createSeedStore, installSeedRoutes } from "./helpers/seed-helper";

const ZONES = [
  { path: "/portal", label: "Home" },
  { path: "/portal/finances", label: "My Finances" },
  { path: "/portal/requests", label: "Requests" },
  { path: "/portal/community", label: "Community" },
  { path: "/portal/amenities", label: "Amenities" },
  { path: "/portal/documents", label: "Documents" },
  { path: "/portal/notices", label: "Notices" },
] as const;

test.describe("Wave 16a — owner portal navigation", () => {
  test("owner navigates all seven zones without error", async ({ page }) => {
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
      // PortalShell renders a top-level <main data-testid="portal-main">
      // on every zone. We wait on the testid (more deterministic than
      // raw `<main>` which other layout layers may also render).
      await page
        .getByTestId("portal-main")
        .waitFor({ state: "visible", timeout: 15_000 });
    }

    expect(pageErrors, `unexpected page errors: ${JSON.stringify(pageErrors)}`).toEqual([]);
  });

  test("legacy /portal?tab=financials redirects to /portal/finances", async ({ page }) => {
    const store = createSeedStore();
    await loginAsOwner(page);
    await installSeedRoutes(page, store);

    await page.goto("/portal?tab=financials");
    // The PortalShell legacy-URL effect calls window.location.assign
    // after a replaceState — wait for the URL to settle on the new
    // canonical path.
    await page.waitForURL(/\/portal\/finances($|\?|#)/, { timeout: 10_000 });
    expect(new URL(page.url()).pathname).toBe("/portal/finances");
  });
});
