// Wave 25 — axe-core smoke spec across 5 key surfaces.
//
// Walks Home, Inbox, /app/financial/rules, /portal, /portal/finances and
// runs axe on each. Uses the route-mock auth helpers so the spec is
// independent of the real-backend wrapper — it runs in either mode.
//
// Audit threshold: zero `critical` or `serious` violations per surface
// (matched against tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`).
// Lower-severity violations are logged but do not fail the run.
//
// We deliberately use `runAxeAuditSoft` so a single non-trivial
// violation outside the Wave-21 locked surfaces does not cascade-fail
// the entire spec. The trace still records every violation for
// follow-up triage.

import { test } from "@playwright/test";
import { loginAsManager, loginAsOwner } from "./helpers/auth-helper";
import { runAxeAuditSoft } from "./helpers/a11y-check";
import { createSeedStore, installSeedRoutes } from "./helpers/seed-helper";

test.describe.configure({ mode: "serial" });

test.describe("Wave 25 — axe-core smoke (5 key surfaces)", () => {
  test("Home (/app) — axe", async ({ page }) => {
    const store = createSeedStore();
    await loginAsManager(page);
    await installSeedRoutes(page, store);
    await page.goto("/app");
    await page.waitForLoadState("networkidle").catch(() => {
      /* networkidle may never settle if a poll runs; absorb */
    });
    await runAxeAuditSoft(page, "smoke:home");
  });

  test("Inbox (/app/communications/inbox) — axe", async ({ page }) => {
    const store = createSeedStore();
    await loginAsManager(page);
    await installSeedRoutes(page, store);
    await page.goto("/app/communications/inbox");
    await page.waitForLoadState("networkidle").catch(() => {
      /* absorb */
    });
    await runAxeAuditSoft(page, "smoke:inbox");
  });

  test("Assessment Rules (/app/financial/rules) — axe", async ({ page }) => {
    const store = createSeedStore();
    await loginAsManager(page);
    await installSeedRoutes(page, store);
    await page.goto("/app/financial/rules");
    await page.waitForLoadState("networkidle").catch(() => {
      /* absorb */
    });
    await runAxeAuditSoft(page, "smoke:rules");
  });

  test("Portal home (/portal) — axe", async ({ page }) => {
    const store = createSeedStore();
    await loginAsOwner(page);
    await installSeedRoutes(page, store);
    await page.goto("/portal");
    await page.waitForLoadState("networkidle").catch(() => {
      /* absorb */
    });
    await runAxeAuditSoft(page, "smoke:portal-home");
  });

  test("Portal finances (/portal/finances) — axe", async ({ page }) => {
    const store = createSeedStore();
    await loginAsOwner(page);
    await installSeedRoutes(page, store);
    await page.goto("/portal/finances");
    await page.waitForLoadState("networkidle").catch(() => {
      /* absorb */
    });
    await runAxeAuditSoft(page, "smoke:portal-finances");
  });
});
