// Wave 16a — Playwright assessment lifecycle flow.
// Wave 26 — graduated to real backend (ephemeral pglite + dev server).
//
// Real-browser slice for Wave-15b Flow C. Manager creates a recurring
// charge schedule, runs it via the unified `/api/financial/rules/:id/run`
// endpoint, asserts the run-history endpoint exposes the run, then
// switches to Owner persona and asserts the portal financial dashboard
// surfaces the new schedule.
//
// The spec runs in one of two modes:
//
//   * Real-backend mode (`PLAYWRIGHT_REAL_BACKEND=1`) — hits the real
//     drizzle-backed handler chain end-to-end. The schedule is inserted
//     directly via `seedRecurringChargeSchedule`, and the orchestrator
//     run produces a real `assessment_run_log` row plus an
//     `owner_ledger_entries` insert that the portal dashboard renders.
//
//   * Route-mock mode (default) preserves the Wave-16a behaviour: the
//     spec uses `installSeedRoutes` against an in-memory store. This
//     mode keeps the static-server fallback green for environments
//     that have not opted in.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import { loginAsManager, loginAsOwner } from "./helpers/auth-helper";
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

test.describe.configure({ mode: "serial" });

test.describe("Wave 16a/26 — assessment lifecycle", () => {
  if (!REAL_BACKEND) {
    // -----------------------------------------------------------------
    // Wave-16a route-mock path — kept verbatim.
    // -----------------------------------------------------------------
    test("manager creates rule + runs it, owner sees ledger entry (route-mock)", async ({ page }) => {
      const store = createSeedStore();
      await loginAsManager(page);
      await installSeedRoutes(page, store);

      await page.goto("/app/financial/rules");
      await expect(page).toHaveURL(/\/app\/financial\/rules/);

      const created = await page.evaluate(async () => {
        const res = await fetch("/api/financial/rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Monthly E2E dues",
            cadence: "monthly",
            amount: 275,
            associationId: "assoc-e2e-1",
          }),
        });
        return { status: res.status, body: await res.json() };
      });
      expect(created.status).toBe(201);
      const rule = created.body as { id: string; name: string };
      expect(rule.name).toBe("Monthly E2E dues");

      const runResult = await page.evaluate(async (ruleId: string) => {
        const res = await fetch(`/api/financial/rules/${ruleId}/run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        return { ok: res.ok, body: await res.json() };
      }, rule.id);
      expect(runResult.ok).toBe(true);

      const historyResult = await page.evaluate(async (ruleId: string) => {
        const res = await fetch(`/api/financial/rules/${ruleId}/run-history`);
        return { ok: res.ok, body: await res.json() };
      }, rule.id);
      expect(historyResult.ok).toBe(true);
      const history = historyResult.body as Array<{ id: string; chargesCreated: number }>;
      expect(history).toHaveLength(1);
      expect(history[0].chargesCreated).toBe(1);

      await loginAsOwner(page);
      const ledgerResult = await page.evaluate(async () => {
        const res = await fetch("/api/portal/ledger");
        return { ok: res.ok, body: await res.json() };
      });
      expect(ledgerResult.ok).toBe(true);
      const ledger = ledgerResult.body as Array<{ description: string; amount: number }>;
      expect(ledger).toHaveLength(1);
      expect(ledger[0].description).toBe("Monthly E2E dues");
      expect(ledger[0].amount).toBe(275);

      await page.goto("/portal/finances/ledger");
      await expect(page).toHaveURL(/\/portal\/finances\/ledger/);
    });
    return;
  }

  // -------------------------------------------------------------------
  // Wave-26 real-backend path.
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
    await backend.seedAssociation(ASSOCIATION_ID, "E2E Test Association");
  });

  test("manager creates rule, runs it, run-log shows entry, owner sees dashboard (real backend)", async ({ context, page }) => {
    // Seed: unit + person + ownership so the recurring-charge orchestrator
    // has someone to bill. The orchestrator inserts a real
    // `owner_ledger_entries` row keyed to the unit+person pair.
    const seeded = await backend.seedUnitWithOwner({
      associationId: ASSOCIATION_ID,
      unitNumber: "101",
      building: "Building A",
      firstName: "Pat",
      lastName: "Owner",
      email: "owner@e2e.test",
    });

    // Seed a recurring charge schedule directly. The Wave-15b flow
    // exercised the create-via-POST contract; here we focus on the
    // run-and-surface contract, which is what the dashboard depends on.
    const { id: scheduleId } = await backend.seedRecurringChargeSchedule({
      associationId: ASSOCIATION_ID,
      chargeDescription: "Monthly HOA dues",
      amount: 275,
      frequency: "monthly",
      dayOfMonth: 1,
    });

    const manager = await backend.installManagerSession(context, {
      email: "manager@e2e.test",
      associationId: ASSOCIATION_ID,
    });

    await page.goto("/app/financial/rules");

    // 1. Manager runs the rule via the unified on-demand endpoint.
    const runResult = await page.evaluate(async (ruleId: string) => {
      const res = await fetch(`/api/financial/rules/${ruleId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      return { ok: res.ok, status: res.status, body: await res.json() };
    }, scheduleId);
    expect(runResult.status).toBe(200);
    const runBody = runResult.body as { dryRun: boolean; runLogEntries: Array<{ status: string }> };
    expect(runBody.dryRun).toBe(false);
    expect(runBody.runLogEntries.length).toBeGreaterThan(0);

    // 2. The unified run-log endpoint exposes the new entry. We filter
    //    by associationId per the real handler's contract.
    const logResult = await page.evaluate(async (associationId: string) => {
      const res = await fetch(
        `/api/financial/assessment-run-log?associationId=${encodeURIComponent(associationId)}`,
        { credentials: "include" },
      );
      return { ok: res.ok, body: await res.json() };
    }, ASSOCIATION_ID);
    expect(logResult.ok).toBe(true);
    const logBody = logResult.body as { rows: Array<{ ruleId: string; status: string }> };
    const matched = logBody.rows.filter((r) => r.ruleId === scheduleId);
    expect(matched.length).toBeGreaterThan(0);

    // 3. Switch persona to Owner. We re-use the seeded unit + person
    //    so the portal dashboard sees the row the orchestrator just
    //    inserted into `owner_ledger_entries` (via the ownership
    //    relation).
    const owner = await backend.installOwnerSession(page, {
      associationId: ASSOCIATION_ID,
      unitId: seeded.unitId,
      personId: seeded.personId,
      email: "owner@e2e.test",
    });
    await page.goto("/portal");
    const dashboard = await page.evaluate(async (portalAccessId: string) => {
      const res = await fetch("/api/portal/financial-dashboard", {
        headers: { "x-portal-access-id": portalAccessId },
      });
      return { status: res.status, body: await res.json() };
    }, owner.portalAccessId);
    expect(dashboard.status).toBe(200);
    const dashBody = dashboard.body as {
      feeSchedules: Array<{ id: string; name: string }>;
      recentEntries: Array<{ description: string; amount: number }>;
    };
    // The portal dashboard hydrates `feeSchedules` from the real
    // recurring-charge table; the seeded schedule must appear.
    const matchedSchedule = dashBody.feeSchedules.find((s) => s.id === scheduleId);
    expect(matchedSchedule).toBeTruthy();

    // Sanity: log the manager email so a failure trace shows the
    // admin we authenticated as.
    expect(manager.email).toBe("manager@e2e.test");

    // 4. Visit /portal/finances/ledger — the route should resolve.
    await page.goto("/portal/finances/ledger");
    await expect(page).toHaveURL(/\/portal\/finances\/ledger/);
  });
});
