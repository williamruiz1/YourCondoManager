// Wave 46 — Dark-mode axe smoke spec.
//
// Mirrors the Wave 25 a11y-smoke spec but flips the workspace into dark
// mode before each axe pass. Workspace-only — owner portal and public
// marketing pages are intentionally light-only per applyTheme() in
// `client/src/hooks/use-user-settings.ts` (dark mode is applied only on
// pathnames starting with `/app`).
//
// Surfaces walked in dark:
//   - /app                                (Home / dashboard)
//   - /app/communications/inbox           (Inbox)
//   - /app/financial/rules                (Assessment rules — was the
//                                          surface where dark mode was
//                                          first reported broken)
//
// Threshold: zero `critical` or `serious` violations per surface
// (matches Wave 25). Lower-severity violations are logged via the soft
// variant and recorded in the trace.

import { test } from "@playwright/test";
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
      window.localStorage.setItem("user-settings-admin-id", "playwright-dark");
      window.localStorage.setItem(
        "user-settings-playwright-dark",
        JSON.stringify({ theme: "dark" }),
      );
    } catch {
      /* localStorage unavailable; tests will fall back to default */
    }
    document.documentElement.classList.add("dark");
  });
}

test.describe("Wave 46 — dark-mode axe smoke (workspace surfaces)", () => {
  test("Home (/app) — axe in dark", async ({ page }) => {
    const store = createSeedStore();
    await forceWorkspaceDarkMode(page);
    await loginAsManager(page);
    await installSeedRoutes(page, store);
    await page.goto("/app");
    await page.waitForLoadState("networkidle").catch(() => {
      /* absorb networkidle stalls from background polls */
    });
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
    await runAxeAuditSoft(page, "dark:rules");
  });
});
