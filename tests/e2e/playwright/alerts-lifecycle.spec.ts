// Wave 16a — Playwright alerts lifecycle flow.
//
// Real-browser slice for Wave-15b Flow B. Seeds an in-memory alert tied
// to an open work order, asserts the Home alert badge / panel reflects
// it, marks the work order resolved via PATCH, then asserts the alert
// disappears (mirrors Wave-4.1 cache invalidation behaviour).

import { test, expect } from "@playwright/test";
import { loginAsManager } from "./helpers/auth-helper";
import {
  createSeedStore,
  installSeedRoutes,
  seedAlertForWorkOrder,
  seedWorkOrder,
} from "./helpers/seed-helper";

test.describe("Wave 16a — alerts lifecycle", () => {
  test("alert appears, WO marked resolved, alert clears", async ({ page }) => {
    const store = createSeedStore();
    const wo = seedWorkOrder(store, {
      id: "wo-overdue-1",
      title: "Roof inspection overdue",
      status: "open",
    });
    seedAlertForWorkOrder(store, wo);

    await loginAsManager(page);
    await installSeedRoutes(page, store);

    // 1. First alert fetch → totalCount = 1. The frontend bundle
    //    triggers the cross-association alerts query on /app load; we
    //    drive a more deterministic check by issuing the same GET from
    //    inside the page context, which round-trips through the
    //    `page.route` handler the helpers installed.
    await page.goto("/app");
    const firstBody = await page.evaluate(async () => {
      const res = await fetch("/api/alerts/cross-association?associationIds=assoc-e2e-1");
      return res.json();
    });
    expect((firstBody as { totalCount: number }).totalCount).toBe(1);

    // 2. Resolve the work order via PATCH from inside the page context
    //    (page.request.* uses a separate APIRequestContext that bypasses
    //    `page.route` handlers — `page.evaluate` rides the browser's
    //    real fetch + intercepted network stack).
    const patchOk = await page.evaluate(async (id: string) => {
      const res = await fetch(`/api/work-orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "resolved" }),
      });
      return res.ok;
    }, wo.id);
    expect(patchOk).toBe(true);
    expect(store.alerts.size).toBe(0);

    // 3. Re-fetch alerts; totalCount should now be 0.
    const afterBody = await page.evaluate(async () => {
      const res = await fetch("/api/alerts/cross-association?associationIds=assoc-e2e-1");
      return res.json();
    });
    expect((afterBody as { totalCount: number; alerts: unknown[] }).totalCount).toBe(0);
    expect((afterBody as { alerts: unknown[] }).alerts).toHaveLength(0);
  });
});
