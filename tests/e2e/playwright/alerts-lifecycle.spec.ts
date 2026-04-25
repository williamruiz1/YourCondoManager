// Wave 16a — Playwright alerts lifecycle flow.
// Wave 17 — graduated to real backend (ephemeral pglite + dev server).
//
// Real-browser slice for Wave-15b Flow B. The spec runs in one of two
// modes depending on the environment it is launched in:
//
//   * Real-backend mode (`PLAYWRIGHT_REAL_BACKEND=1`) — globalSetup
//     spins up an in-process Postgres (pglite) fronted by pg-gateway,
//     `npm run dev` connects to it as if it were a normal local
//     Postgres, and this spec inserts real DB rows. The alert engine,
//     PATCH handler, and 60s server-side cache all run for real.
//
//   * Route-mock mode (default — every other CI / local invocation)
//     keeps the Wave-16a behavior: the spec uses `page.route` to stub
//     `/api/*`. This mode is preserved so the static-server fallback
//     and the four sibling specs that have not yet been migrated stay
//     green.
//
// The two modes share the same assertions: alert badge shows 1, PATCH
// the work order to closed, alert disappears.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import { loginAsManager } from "./helpers/auth-helper";
import {
  createRealBackend,
  createSeedStore,
  installSeedRoutes,
  seedAlertForWorkOrder,
  seedWorkOrder,
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
  // The wrapper script (`script/playwright-real-backend.ts`) writes
  // this file before launching the dev server. Tests read it back to
  // build their own pg.Pool for direct DB seeding.
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (fs.existsSync(HANDOFF_PATH)) {
      const raw = fs.readFileSync(HANDOFF_PATH, "utf8");
      return JSON.parse(raw) as RealBackendHandoff;
    }
    // Synchronous spin — the file should exist by the time the
    // webServer is ready, but absorb a small races window.
    const start = Date.now();
    while (Date.now() - start < 100) {
      /* spin */
    }
  }
  throw new Error(`Real-backend handoff file not found at ${HANDOFF_PATH}`);
}

test.describe("Wave 16a/17 — alerts lifecycle", () => {
  if (!REAL_BACKEND) {
    // -----------------------------------------------------------------
    // Wave-16a route-mock path — kept verbatim so the four sibling
    // specs that still depend on `installSeedRoutes` keep working.
    // -----------------------------------------------------------------
    test("alert appears, WO marked resolved, alert clears (route-mock)", async ({ page }) => {
      const store = createSeedStore();
      const wo = seedWorkOrder(store, {
        id: "wo-overdue-1",
        title: "Roof inspection overdue",
        status: "open",
      });
      seedAlertForWorkOrder(store, wo);

      await loginAsManager(page);
      await installSeedRoutes(page, store);

      await page.goto("/app");
      const firstBody = await page.evaluate(async () => {
        const res = await fetch("/api/alerts/cross-association?associationIds=assoc-e2e-1");
        return res.json();
      });
      expect((firstBody as { totalCount: number }).totalCount).toBe(1);

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

      const afterBody = await page.evaluate(async () => {
        const res = await fetch("/api/alerts/cross-association?associationIds=assoc-e2e-1");
        return res.json();
      });
      expect((afterBody as { totalCount: number; alerts: unknown[] }).totalCount).toBe(0);
      expect((afterBody as { alerts: unknown[] }).alerts).toHaveLength(0);
    });
    return;
  }

  // -------------------------------------------------------------------
  // Wave-17 real-backend path. Each test gets a clean DB via the
  // `reset()` hook so seeded rows from a prior test cannot bleed in.
  // -------------------------------------------------------------------
  let backend: RealBackendHandle;

  test.beforeAll(async () => {
    const handoff = readHandoff();
    backend = await createRealBackend({
      connectionString: handoff.connectionString,
      sessionSecret: handoff.sessionSecret,
      // The dev server runs with `NODE_ENV=development` (set by
      // `script/playwright-real-backend.ts`) which switches the
      // cookie name to `sid_dev` per server/index.ts.
      cookieName: "sid_dev",
    });
  });

  test.afterAll(async () => {
    await backend?.cleanup();
  });

  test.beforeEach(async () => {
    await backend.reset();
    await backend.seedAssociation(ASSOCIATION_ID, "E2E Test Association");
  });

  test("alert appears, WO closed, alert clears (real backend)", async ({ context, page }) => {
    const session = await backend.installManagerSession(context, {
      email: "manager@e2e.test",
      associationId: ASSOCIATION_ID,
    });

    const { id: workOrderId } = await backend.seedOverdueWorkOrder({
      title: "Roof inspection overdue",
      associationId: ASSOCIATION_ID,
    });

    // Trigger any non-API request first so the cookie attaches before
    // we hit the REST endpoint.
    await page.goto("/app");

    // 1. First alerts fetch — totalCount = 1, anchored on real WO.
    const firstBody = await page.evaluate(async () => {
      const res = await fetch("/api/alerts/cross-association", { credentials: "include" });
      return { status: res.status, body: await res.json() };
    });
    expect(firstBody.status).toBe(200);
    expect(Array.isArray((firstBody.body as { alerts: unknown[] }).alerts)).toBe(true);
    const overdueAlerts = (firstBody.body as { alerts: Array<{ ruleType: string; recordId: string }> }).alerts.filter(
      (a) => a.ruleType === "overdue-work-order",
    );
    expect(overdueAlerts).toHaveLength(1);
    expect(overdueAlerts[0].recordId).toBe(workOrderId);

    // 2. PATCH the WO to closed. The dev server's
    //    `safeInvalidateAlertCache()` runs after the write so the next
    //    GET returns fresh data.
    const patch = await page.evaluate(async (id: string) => {
      const res = await fetch(`/api/work-orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "closed" }),
      });
      return { status: res.status, ok: res.ok };
    }, workOrderId);
    expect(patch.ok).toBe(true);

    // 3. Re-fetch alerts; the overdue alert anchored to this WO is gone.
    const afterBody = await page.evaluate(async () => {
      const res = await fetch("/api/alerts/cross-association", { credentials: "include" });
      return { status: res.status, body: await res.json() };
    });
    expect(afterBody.status).toBe(200);
    const remainingOverdue = (
      afterBody.body as { alerts: Array<{ ruleType: string; recordId: string }> }
    ).alerts.filter((a) => a.ruleType === "overdue-work-order" && a.recordId === workOrderId);
    expect(remainingOverdue).toHaveLength(0);

    // Sanity: log the session we used so a failure trace shows the
    // admin we authenticated as.
    expect(session.email).toBe("manager@e2e.test");
  });
});
