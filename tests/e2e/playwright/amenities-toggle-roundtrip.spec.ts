// Wave 16a — Playwright amenities toggle round-trip flow.
//
// Real-browser slice that converts the Wave-15b Flow E skeleton
// (`tests/e2e/amenities-toggle-roundtrip.test.ts` — `describe.skip`)
// into a live round-trip. Manager flips `amenitiesEnabled = false` via
// the settings PATCH endpoint; we then switch persona to Owner and
// assert the portal-side amenities settings query returns
// `amenitiesEnabled: false` + the `/api/portal/amenities` listing
// endpoint 404s. Flip back to true, refetch, and assert the entry
// returns.

import { test, expect } from "@playwright/test";
import { loginAsManager, loginAsOwner } from "./helpers/auth-helper";
import { createSeedStore, installSeedRoutes } from "./helpers/seed-helper";

test.describe("Wave 16a — amenities toggle round-trip", () => {
  test("manager flip → owner reflects → manager flip back", async ({ page }) => {
    const store = createSeedStore();
    await loginAsManager(page);
    await installSeedRoutes(page, store);

    // Visit any /app page so page.evaluate can issue same-origin
    // fetches (Playwright's evaluate runs in the page context).
    await page.goto("/app");

    // 1. Manager disables amenities.
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

    // 2. Switch persona to Owner.
    await loginAsOwner(page);

    // 3. Owner-side settings query reflects the flip.
    await page.goto("/portal");
    const ownerSettings = await page.evaluate(async () => {
      const res = await fetch("/api/portal/amenities/settings");
      return { ok: res.ok, body: await res.json() };
    });
    expect(ownerSettings.ok).toBe(true);
    expect((ownerSettings.body as { amenitiesEnabled: boolean }).amenitiesEnabled).toBe(false);

    // 4. The amenities listing endpoint 404s — the route guard at the
    //    server level returns "Amenities disabled for this association".
    const ownerListing = await page.evaluate(async () => {
      const res = await fetch("/api/portal/amenities");
      return res.status;
    });
    expect(ownerListing).toBe(404);

    // 5. Visit /portal/amenities — the page should render the disabled
    //    state (PortalShell still resolves; the zone child handles the
    //    404). Asserting the URL is enough to confirm the route is
    //    reachable; deep-content assertions are a follow-up.
    await page.goto("/portal/amenities");
    await expect(page).toHaveURL(/\/portal\/amenities/);

    // 6. Flip back to enabled and verify both endpoints recover.
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
});
