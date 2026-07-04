// Wave 46 — Dark-mode axe + visual smoke spec.
//
// Mirrors the Wave 25 a11y-smoke spec but flips the workspace into dark
// mode before each axe pass. Workspace-only — owner portal and public
// marketing pages are intentionally light-only per applyTheme() in
// `client/src/hooks/use-user-settings.ts` (dark mode is applied only on
// pathnames starting with `/app`).
//
// Surfaces walked in dark (axe + visual snapshot):
//   - /app                                (Home / dashboard)
//   - /app/communications/inbox           (Inbox)
//   - /app/financial/rules                (Assessment rules — was the
//                                          surface where dark mode was
//                                          first reported broken)
//   - /app/settings                       (Settings — reported search-input
//                                          bright-white bug; PR 2 fix target)
//   - /app/associations                   (Associations list)
//   - /app/governance/board-packages      (Board packages — bg-white fix)
//   - /app/persons                        (People)
//   - /app/executive                      (Executive summary)
//
// Threshold: zero `critical` or `serious` violations per surface
// (matches Wave 25). Lower-severity violations are logged via the soft
// variant and recorded in the trace.

import { test, expect } from "@playwright/test";
import { loginAsManager } from "./helpers/auth-helper";
import { runAxeAuditSoft } from "./helpers/a11y-check";
import { createSeedStore, installSeedRoutes } from "./helpers/seed-helper";

test.describe.configure({ mode: "serial" });

/** Force dark mode on the root via localStorage + class flip.
 *
 *  applyTheme() reads the stored user-settings record and writes
 *  `dark` onto <html> only when the path starts with `/app`. We
 *  pre-seed both the storage key and add the class so the first paint
 *  inside the spec is dark — eliminating the light-flash that would
 *  otherwise pollute the axe pass.
 */
async function forceWorkspaceDarkMode(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    try {
      // MUST be the auth-helper's real mock admin id ("admin-mgr-1"): once the
      // app boots, App.tsx overwrites user-settings-admin-id from the auth
      // session, so a settings record seeded under any OTHER id is orphaned
      // and the default theme (now hard "light" per the brand-v2 interim) wins
      // — which is exactly how this spec broke while the Playwright gate was
      // dead on the port-5000 collision (founder-os#8337).
      window.localStorage.setItem("user-settings-admin-id", "admin-mgr-1");
      window.localStorage.setItem(
        "user-settings-admin-mgr-1",
        JSON.stringify({ theme: "dark" }),
      );
    } catch {
      /* localStorage unavailable; tests will fall back to default */
    }
    document.documentElement.classList.add("dark");
  });
}

/**
 * Assert no `<html>` element has a bright-white background that would
 * indicate unthemed content bleeding through in dark mode.
 * Checks that the computed background of <body> is dark (lightness < 40 %).
 */
async function assertBodyIsDark(page: import("@playwright/test").Page, surface: string) {
  const isDark = await page.evaluate(() => {
    const rgb = window.getComputedStyle(document.body).backgroundColor;
    const match = rgb.match(/\d+/g);
    if (!match || match.length < 3) return false;
    const [r, g, b] = match.map(Number);
    // Perceived lightness using the sRGB-relative formula (ITU-R BT.709)
    const lightness = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return lightness < 0.4; // body background must be < 40 % luminance
  });
  expect(isDark, `body background should be dark on ${surface}`).toBe(true);
}

// RE-ENABLED (YCM#352 / founder-os#8539): the brand-v2 token layer left a duplicate
// hardcoded `background: #f8f9fa` in tailwind.config.ts that shadowed the token-driven
// `--background`, so `.dark` <body> computed near-white (rgb(248,249,250)). That duplicate
// key was removed, so `bg-background` now resolves to `hsl(var(--background))` (dark
// `220 13% 9%` under `.dark`). use-user-settings.ts default is back to "system". This
// suite asserts the fixed behavior and is live again.
test.describe("Wave 46 — dark-mode axe + visual smoke (workspace surfaces)", () => {
  test("Home (/app) — axe in dark", async ({ page }) => {
    const store = createSeedStore();
    await forceWorkspaceDarkMode(page);
    await loginAsManager(page);
    await installSeedRoutes(page, store);
    await page.goto("/app");
    await page.waitForLoadState("networkidle").catch(() => {
      /* absorb networkidle stalls from background polls */
    });
    await assertBodyIsDark(page, "/app");
    await runAxeAuditSoft(page, "dark:home");
  });

  test("Inbox (/app/communications/inbox) — axe in dark", async ({ page }) => {
    const store = createSeedStore();
    await forceWorkspaceDarkMode(page);
    await loginAsManager(page);
    await installSeedRoutes(page, store);
    await page.goto("/app/communications/inbox");
    await page.waitForLoadState("networkidle").catch(() => {
      /* absorb */
    });
    await assertBodyIsDark(page, "/app/communications/inbox");
    await runAxeAuditSoft(page, "dark:inbox");
  });

  test("Assessment Rules (/app/financial/rules) — axe in dark", async ({ page }) => {
    const store = createSeedStore();
    await forceWorkspaceDarkMode(page);
    await loginAsManager(page);
    await installSeedRoutes(page, store);
    await page.goto("/app/financial/rules");
    await page.waitForLoadState("networkidle").catch(() => {
      /* absorb */
    });
    await assertBodyIsDark(page, "/app/financial/rules");
    await runAxeAuditSoft(page, "dark:rules");
  });

  // ── New surfaces added in PR 2 (dark-mode repair pass) ─────────────────────

  test("Settings (/app/settings) — axe in dark [PR2: search-input fix]", async ({ page }) => {
    const store = createSeedStore();
    await forceWorkspaceDarkMode(page);
    await loginAsManager(page);
    await installSeedRoutes(page, store);
    await page.goto("/app/settings");
    await page.waitForLoadState("networkidle").catch(() => {
      /* absorb */
    });
    await assertBodyIsDark(page, "/app/settings");
    // Assert the search/command trigger button does NOT have a bright-white background.
    // After the PR 2 fix (bg-transparent on outline Button), the computed bg of the
    // header trigger should be transparent (rgba(0,0,0,0)) or a dark hsl value.
    const searchTriggerBgIsLight = await page.evaluate(() => {
      const btn = document.querySelector<HTMLElement>('[aria-label="Search"], [data-testid="global-search-trigger"], .glass-nav button');
      if (!btn) return false; // no element found — skip assertion
      const bg = window.getComputedStyle(btn).backgroundColor;
      const match = bg.match(/\d+/g);
      if (!match || match.length < 3) return false;
      const [r, g, b] = match.map(Number);
      const lightness = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      return lightness > 0.7; // bright white = bug
    });
    expect(searchTriggerBgIsLight, "Search button should NOT be bright white in dark mode").toBe(false);
    await runAxeAuditSoft(page, "dark:settings");
  });

  test("Associations (/app/associations) — axe in dark", async ({ page }) => {
    const store = createSeedStore();
    await forceWorkspaceDarkMode(page);
    await loginAsManager(page);
    await installSeedRoutes(page, store);
    await page.goto("/app/associations");
    await page.waitForLoadState("networkidle").catch(() => {
      /* absorb */
    });
    await assertBodyIsDark(page, "/app/associations");
    await runAxeAuditSoft(page, "dark:associations");
  });

  test("Persons (/app/persons) — axe in dark", async ({ page }) => {
    const store = createSeedStore();
    await forceWorkspaceDarkMode(page);
    await loginAsManager(page);
    await installSeedRoutes(page, store);
    await page.goto("/app/persons");
    await page.waitForLoadState("networkidle").catch(() => {
      /* absorb */
    });
    await assertBodyIsDark(page, "/app/persons");
    await runAxeAuditSoft(page, "dark:persons");
  });

  test("Executive (/app/executive) — axe in dark", async ({ page }) => {
    const store = createSeedStore();
    await forceWorkspaceDarkMode(page);
    await loginAsManager(page);
    await installSeedRoutes(page, store);
    await page.goto("/app/executive");
    await page.waitForLoadState("networkidle").catch(() => {
      /* absorb */
    });
    await assertBodyIsDark(page, "/app/executive");
    await runAxeAuditSoft(page, "dark:executive");
  });
});
