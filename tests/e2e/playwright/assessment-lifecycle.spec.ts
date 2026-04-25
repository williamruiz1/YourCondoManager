// Wave 16a — Playwright assessment lifecycle flow.
//
// Real-browser slice for Wave-15b Flow C. Manager creates an assessment
// rule, runs it, asserts the run-history endpoint exposes the run, then
// switches to Owner persona and asserts the portal ledger query
// surfaces the resulting entry.
//
// The actual `/app/financial/rules` UI fetches a long tail of
// foundation endpoints — driving the form end-to-end through clicks
// would require stubbing 10+ side queries. Instead this spec drives the
// same HTTP contract the React UI exercises (POST → run → run-history →
// portal/ledger) through Playwright's `request` API, which still rides
// the live dev-server JS bundle if hit through the page (the route
// table installed by the helpers handles the rest).

import { test, expect } from "@playwright/test";
import { loginAsManager, loginAsOwner } from "./helpers/auth-helper";
import { createSeedStore, installSeedRoutes } from "./helpers/seed-helper";

test.describe("Wave 16a — assessment lifecycle", () => {
  test("manager creates rule + runs it, owner sees ledger entry", async ({ page }) => {
    const store = createSeedStore();
    await loginAsManager(page);
    await installSeedRoutes(page, store);

    // 1. Manager opens the rules surface (the route exists — passing the
    //    workspace gate is enough to render the chrome).
    await page.goto("/app/financial/rules");
    await expect(page).toHaveURL(/\/app\/financial\/rules/);

    // 2. Create a rule via POST. We use page.evaluate so the request
    //    rides the browser's network stack and lands on our
    //    `page.route` handlers (page.request.* uses a separate
    //    APIRequestContext that bypasses route handlers).
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

    // 3. Run the rule (live mode → posts a ledger entry).
    const runResult = await page.evaluate(async (ruleId: string) => {
      const res = await fetch(`/api/financial/rules/${ruleId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      return { ok: res.ok, body: await res.json() };
    }, rule.id);
    expect(runResult.ok).toBe(true);
    const runBody = runResult.body as { runId: string; chargesCreated: number };
    expect(runBody.chargesCreated).toBe(1);
    expect(runBody.runId).toBeTruthy();

    // 4. Run history shows one entry.
    const historyResult = await page.evaluate(async (ruleId: string) => {
      const res = await fetch(`/api/financial/rules/${ruleId}/run-history`);
      return { ok: res.ok, body: await res.json() };
    }, rule.id);
    expect(historyResult.ok).toBe(true);
    const history = historyResult.body as Array<{ id: string; chargesCreated: number }>;
    expect(history).toHaveLength(1);
    expect(history[0].chargesCreated).toBe(1);

    // 5. Switch persona to Owner and verify the new ledger entry shows
    //    up at /portal/finances/ledger.
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

    // 6. Navigate to the owner ledger page (still gated by PortalShell
    //    → portalAccessId is set + /api/portal/me is stubbed).
    await page.goto("/portal/finances/ledger");
    await expect(page).toHaveURL(/\/portal\/finances\/ledger/);
  });
});
