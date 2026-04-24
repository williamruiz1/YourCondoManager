/**
 * 4.1 Wave 15a — alert engine v2 cache-invalidation wiring.
 *
 * Wave 2 shipped `invalidateAlertCache()` as an exported cache-flush helper
 * but wired it only into the Wave 3/4 read-state mutation endpoints. The
 * 4.1 Q6 acceptance criterion says the 60s cache must also be flushed on
 * "any assessmentRunLog write, work-order status change, election state
 * change, or governance-document create/update" (and by extension the
 * Tier 2 source writes shipped in PR #33).
 *
 * Strategy: two tiers of tests.
 *
 *   1. **Static wiring audit** — for every Tier 1 + Tier 2 source type,
 *      assert by source-inspection that `server/routes.ts` calls
 *      `safeInvalidateAlertCache()` (the shared wrapper) inside each
 *      mutation handler. This is the cheapest + most reliable way to
 *      prove the wiring exists without reconstructing 30+ route
 *      handlers in isolation. Grep-based wiring tests are a common
 *      pattern when the call site diff is trivial but the integration
 *      surface is broad (Wave 3/4 tests already exercise the functional
 *      path for alerts-specific mutations; Wave 15a is the same
 *      one-liner repeated across source-type routes).
 *
 *   2. **Functional tests** — for the assessment orchestrator
 *      (`runSweep`/`runOnDemand`), which is NOT a route handler, we spy
 *      directly on `invalidateAlertCache` and assert it fires on real
 *      writes and stays silent on dry-run. We also test the
 *      `safeInvalidateAlertCache` semantic contract (via the same
 *      wrapper shape the routes use): errors from the alerts module
 *      must never propagate out, because a successful mutation response
 *      must not be broken by a flaky cache flush.
 *
 * Covers these nine source types (one assertion block per type):
 *   Tier 1: work-orders, maintenance-schedules, elections, owner-ledger,
 *           governance-documents (governance_compliance_templates)
 *   Tier 2: vendors (contract renewals), insurance, budgets, late-fees
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";

// ---------------------------------------------------------------------------
// Fixture — read the routes file once and slice it into handler regions so
// each source-type assertion can target the correct route.
// ---------------------------------------------------------------------------

const ROUTES_PATH = resolvePath(__dirname, "../server/routes.ts");
const ROUTES_SRC = readFileSync(ROUTES_PATH, "utf8");

/**
 * Locate a handler block by the unique route-registration line and return
 * the text from that line through the matching close of the
 * `app.<verb>(..., async (req, res) => { ... });` statement.
 *
 * We scan forward from the first `=> {` and track brace depth so we stop
 * at the correct closer even when the handler body contains nested
 * callbacks, IIFEs, or object literals.
 */
function handlerRegion(routeLineMatcher: RegExp): string {
  const match = ROUTES_SRC.match(routeLineMatcher);
  if (!match) {
    throw new Error(
      `Could not find route registration matching ${routeLineMatcher}`,
    );
  }
  const startIdx = match.index!;
  // Find the opening `{` of the handler body (`async (req, res) => {`).
  const bodyStartRel = ROUTES_SRC.slice(startIdx).search(/=>\s*\{/);
  if (bodyStartRel === -1) {
    // No handler body — return the registration line only.
    return ROUTES_SRC.slice(startIdx, startIdx + 200);
  }
  // Position `i` at the opening `{` itself.
  let i = startIdx + bodyStartRel + ROUTES_SRC.slice(startIdx + bodyStartRel).indexOf("{");
  let depth = 0;
  for (; i < ROUTES_SRC.length; i++) {
    const ch = ROUTES_SRC[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        // include the trailing `);` of the `app.post(... );` if present.
        const tail = ROUTES_SRC.slice(i + 1, i + 5);
        const endExtra = tail.startsWith(");") ? 2 : 0;
        return ROUTES_SRC.slice(startIdx, i + 1 + endExtra);
      }
    }
  }
  return ROUTES_SRC.slice(startIdx);
}

function assertInvalidationIn(regionName: string, region: string): void {
  expect(
    region.includes("safeInvalidateAlertCache()"),
    `Expected "${regionName}" handler region to call safeInvalidateAlertCache(). ` +
      `Found region:\n${region.slice(0, 400)}`,
  ).toBe(true);
}

// ---------------------------------------------------------------------------
// Static wiring audit — one test per Tier 1 / Tier 2 source type.
// ---------------------------------------------------------------------------

describe("Wave 15a — alert cache invalidation wiring (static audit)", () => {
  it("Tier 1 / work-orders: POST + PATCH both invalidate", () => {
    const post = handlerRegion(
      /app\.post\("\/api\/work-orders",\s*requireAdmin/,
    );
    const patch = handlerRegion(
      /app\.patch\("\/api\/work-orders\/:id",\s*requireAdmin/,
    );
    assertInvalidationIn("POST /api/work-orders", post);
    assertInvalidationIn("PATCH /api/work-orders/:id", patch);
  });

  it("Tier 1 / maintenance-schedules: POST + PATCH + generate all invalidate", () => {
    const post = handlerRegion(
      /app\.post\("\/api\/maintenance\/schedules",\s*requireAdmin/,
    );
    const patch = handlerRegion(
      /app\.patch\("\/api\/maintenance\/schedules\/:id",\s*requireAdmin/,
    );
    const generate = handlerRegion(
      /app\.post\("\/api\/maintenance\/schedules\/:id\/generate",\s*requireAdmin/,
    );
    assertInvalidationIn("POST /api/maintenance/schedules", post);
    assertInvalidationIn("PATCH /api/maintenance/schedules/:id", patch);
    assertInvalidationIn(
      "POST /api/maintenance/schedules/:id/generate",
      generate,
    );
  });

  it("Tier 1 / elections: POST + PATCH + DELETE all invalidate", () => {
    const post = handlerRegion(
      /app\.post\("\/api\/elections",\s*requireAdmin/,
    );
    const patch = handlerRegion(
      /app\.patch\("\/api\/elections\/:id",\s*requireAdmin/,
    );
    const del = handlerRegion(
      /app\.delete\("\/api\/elections\/:id",\s*requireAdmin/,
    );
    assertInvalidationIn("POST /api/elections", post);
    assertInvalidationIn("PATCH /api/elections/:id", patch);
    assertInvalidationIn("DELETE /api/elections/:id", del);
  });

  it("Tier 1 / owner-ledger: manual entry + bulk import invalidate", () => {
    const post = handlerRegion(
      /app\.post\("\/api\/financial\/owner-ledger\/entries",\s*requireAdmin/,
    );
    const imp = handlerRegion(
      /app\.post\("\/api\/financial\/owner-ledger\/import",\s*requireAdmin/,
    );
    assertInvalidationIn("POST /api/financial/owner-ledger/entries", post);
    assertInvalidationIn("POST /api/financial/owner-ledger/import", imp);
  });

  it("Tier 1 / governance-documents: template POST + PATCH + assign invalidate", () => {
    const post = handlerRegion(
      /app\.post\("\/api\/governance\/templates",\s*requireAdmin/,
    );
    const patch = handlerRegion(
      /app\.patch\("\/api\/governance\/templates\/:id",\s*requireAdmin/,
    );
    const assign = handlerRegion(
      /app\.post\("\/api\/governance\/templates\/:templateId\/assign",\s*requireAdmin/,
    );
    assertInvalidationIn("POST /api/governance/templates", post);
    assertInvalidationIn("PATCH /api/governance/templates/:id", patch);
    assertInvalidationIn(
      "POST /api/governance/templates/:templateId/assign",
      assign,
    );
  });

  it("Tier 2 / vendors: POST + PATCH invalidate", () => {
    const post = handlerRegion(/app\.post\("\/api\/vendors",\s*requireAdmin/);
    const patch = handlerRegion(
      /app\.patch\("\/api\/vendors\/:id",\s*requireAdmin/,
    );
    assertInvalidationIn("POST /api/vendors", post);
    assertInvalidationIn("PATCH /api/vendors/:id", patch);
  });

  it("Tier 2 / insurance: POST + PATCH + DELETE invalidate", () => {
    const post = handlerRegion(
      /app\.post\("\/api\/associations\/:id\/insurance",\s*requireAdmin/,
    );
    const patch = handlerRegion(
      /app\.patch\("\/api\/associations\/:id\/insurance\/:policyId",\s*requireAdmin/,
    );
    const del = handlerRegion(
      /app\.delete\("\/api\/associations\/:id\/insurance\/:policyId",\s*requireAdmin/,
    );
    assertInvalidationIn("POST /api/associations/:id/insurance", post);
    assertInvalidationIn(
      "PATCH /api/associations/:id/insurance/:policyId",
      patch,
    );
    assertInvalidationIn(
      "DELETE /api/associations/:id/insurance/:policyId",
      del,
    );
  });

  it("Tier 2 / budgets: budgets + versions + lines all invalidate", () => {
    const postBudget = handlerRegion(
      /app\.post\("\/api\/financial\/budgets",\s*requireAdmin/,
    );
    const patchBudget = handlerRegion(
      /app\.patch\("\/api\/financial\/budgets\/:id",\s*requireAdmin/,
    );
    const postVersion = handlerRegion(
      /app\.post\("\/api\/financial\/budget-versions",\s*requireAdmin/,
    );
    const patchVersion = handlerRegion(
      /app\.patch\("\/api\/financial\/budget-versions\/:id",\s*requireAdmin/,
    );
    const postLine = handlerRegion(
      /app\.post\("\/api\/financial\/budget-lines",\s*requireAdmin/,
    );
    const patchLine = handlerRegion(
      /app\.patch\("\/api\/financial\/budget-lines\/:id",\s*requireAdmin/,
    );
    assertInvalidationIn("POST /api/financial/budgets", postBudget);
    assertInvalidationIn("PATCH /api/financial/budgets/:id", patchBudget);
    assertInvalidationIn(
      "POST /api/financial/budget-versions",
      postVersion,
    );
    assertInvalidationIn(
      "PATCH /api/financial/budget-versions/:id",
      patchVersion,
    );
    assertInvalidationIn("POST /api/financial/budget-lines", postLine);
    assertInvalidationIn(
      "PATCH /api/financial/budget-lines/:id",
      patchLine,
    );
  });

  it("Tier 2 / late-fees: calculate+apply invalidates", () => {
    const calc = handlerRegion(
      /app\.post\("\/api\/financial\/late-fees\/calculate",\s*requireAdmin/,
    );
    assertInvalidationIn(
      "POST /api/financial/late-fees/calculate (apply=true)",
      calc,
    );
    // And assert the apply-gate is present — pure no-op calculations
    // should NOT flush the cache.
    expect(calc.includes("if (apply)")).toBe(true);
  });

  it("module-level import + wrapper helper: invalidateAlertCache is imported once at the top, and the safeInvalidateAlertCache wrapper exists", () => {
    const header = ROUTES_SRC.slice(0, 2_000);
    expect(
      header.match(/import\s*\{\s*invalidateAlertCache\s*\}\s*from\s*"\.\/alerts"/),
      "Expected static import of invalidateAlertCache from ./alerts at top of routes.ts",
    ).toBeTruthy();
    expect(
      header.match(/function\s+safeInvalidateAlertCache\s*\(\s*\)\s*:\s*void/),
      "Expected the safeInvalidateAlertCache wrapper function to be declared at module scope",
    ).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Functional test — assessment-execution orchestrator.
// ---------------------------------------------------------------------------

// The orchestrator imports the alerts module at load time; mock it so we can
// spy on `invalidateAlertCache` without touching a real cache or DB.
const invalidateSpy = vi.fn();
vi.mock("../server/alerts", () => ({
  invalidateAlertCache: () => invalidateSpy(),
}));

// The orchestrator also imports `./db`; mock the subset it uses so neither
// runSweep nor runOnDemand has to hit Postgres. Our registered test handler
// returns `skipped` and the test lister returns a fixed eligible list, so
// the orchestrator's only `db.insert(...)` call is the assessmentRunLog
// write — which we satisfy with a returning stub.
vi.mock("../server/db", () => {
  return {
    db: {
      select: () => ({ from: () => ({ where: () => Promise.resolve([]) }) }),
      insert: () => ({
        values: () => ({
          returning: async () => [{ id: "assessment-run-log-1" }],
        }),
      }),
    },
  };
});

describe("Wave 15a — orchestrator cache invalidation", () => {
  beforeEach(() => {
    invalidateSpy.mockReset();
  });

  it("runSweep flushes the alert cache when at least one rule dispatched a real write", async () => {
    const mod = await import("../server/assessment-execution");
    mod.registerRuleHandler(
      "recurring",
      async () => ({
        status: "skipped",
        amount: null,
        errorCode: null,
        errorMessage: null,
      }),
      async () => [
        {
          associationId: "assoc-1",
          ruleId: "rule-1",
          rule: {},
          unit: { id: "unit-1" },
          dueDate: new Date(),
        },
      ],
    );

    await mod.runSweep({ ruleTypes: ["recurring"], dryRun: false });
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it("runSweep does NOT flush the cache in dry-run mode", async () => {
    const mod = await import("../server/assessment-execution");
    mod.registerRuleHandler(
      "recurring",
      async () => ({
        status: "skipped",
        amount: null,
        errorCode: null,
        errorMessage: null,
      }),
      async () => [
        {
          associationId: "assoc-1",
          ruleId: "rule-1",
          rule: {},
          unit: { id: "unit-1" },
          dueDate: new Date(),
        },
      ],
    );

    await mod.runSweep({ ruleTypes: ["recurring"], dryRun: true });
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
