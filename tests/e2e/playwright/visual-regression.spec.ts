// Wave 25 — Visual regression scaffold.
//
// Uses Playwright's built-in `toHaveScreenshot()` against PNG baselines
// committed under `tests/e2e/playwright/__screenshots__/`. No external
// services (Percy, Chromatic, BrowserStack) — the snapshots are stored
// in-repo and diffed locally.
//
// Tag every spec with `@visual` so the dedicated `test:playwright:visual`
// npm script can grep them out of the rest of the Playwright suite.
//
// Update flow: after an intentional UI change, run
//   npm run test:playwright:visual:update
// review the diff in `git status`, and commit the new baseline PNG.
//
// See `implementation-artifacts/visual-regression-runbook.md` for the
// full operational guide.

import { test, expect } from "@playwright/test";
import { loginAsManager, loginAsOwner } from "./helpers/auth-helper";
import { createSeedStore, installSeedRoutes } from "./helpers/seed-helper";

// `maxDiffPixels` absorbs the small font / antialiasing jitter you get
// across machines without letting a real visual regression slip through.
// 200 px is roughly 1/10000 of a 1280×800 viewport — tight enough to
// catch a missing component, loose enough to ignore a sub-pixel shift.
const SNAPSHOT_OPTIONS = { maxDiffPixels: 200, animations: "disabled" } as const;

test.describe.configure({ mode: "serial" });

test.describe("Wave 25 — visual regression baselines @visual", () => {
  test("home @visual", async ({ page }) => {
    const store = createSeedStore();
    await loginAsManager(page);
    await installSeedRoutes(page, store);
    await page.goto("/app");
    await page.waitForLoadState("networkidle").catch(() => {
      /* absorb */
    });
    await expect(page).toHaveScreenshot("home.png", SNAPSHOT_OPTIONS);
  });

  test("inbox @visual", async ({ page }) => {
    const store = createSeedStore();
    await loginAsManager(page);
    await installSeedRoutes(page, store);
    await page.goto("/app/communications/inbox");
    await page.waitForLoadState("networkidle").catch(() => {
      /* absorb */
    });
    await expect(page).toHaveScreenshot("inbox.png", SNAPSHOT_OPTIONS);
  });

  test("rules @visual", async ({ page }) => {
    const store = createSeedStore();
    await loginAsManager(page);
    await installSeedRoutes(page, store);
    await page.goto("/app/financial/rules");
    await page.waitForLoadState("networkidle").catch(() => {
      /* absorb */
    });
    await expect(page).toHaveScreenshot("rules.png", SNAPSHOT_OPTIONS);
  });

  test("portal @visual", async ({ page }) => {
    const store = createSeedStore();
    await loginAsOwner(page);
    await installSeedRoutes(page, store);
    await page.goto("/portal");
    await page.waitForLoadState("networkidle").catch(() => {
      /* absorb */
    });
    await expect(page).toHaveScreenshot("portal.png", SNAPSHOT_OPTIONS);
  });
});
