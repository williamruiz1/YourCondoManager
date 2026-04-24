/**
 * Wave 12 — Phase 8c + 5.1 cleanup regression tests.
 *
 * Asserts that the following symbols/routes are gone from the server bundle:
 *   1. `requirePortalBoard` / `requirePortalBoardReadOnly` — 8b deprecation
 *      wrappers deleted in Wave 12.
 *   2. `POST /api/financial/recurring-charges/run` — 4.3 Q8 shim retired.
 *   3. `POST /api/financial/assessments/run` — 4.3 Q8 shim retired.
 *
 * These tests live outside `tests/portal-board-gating.test.ts` (deleted in
 * Wave 12) so the assertion surface survives into future releases.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const ROUTES_FILE = resolve(process.cwd(), "server/routes.ts");
const ROUTES_SRC = readFileSync(ROUTES_FILE, "utf-8");

describe("Wave 12 — retired 8b portal-board middleware wrappers", () => {
  it("server/routes.ts no longer defines requirePortalBoard", () => {
    // The textual invariant `function requirePortalBoard` is what the smoke
    // script checked for. Wave 12 removed the wrapper entirely; all route
    // handlers now reference requireBoardAccess from
    // ./portal-role-collapse.
    expect(ROUTES_SRC).not.toMatch(/function\s+requirePortalBoard\b/);
    expect(ROUTES_SRC).not.toMatch(/function\s+requirePortalBoardReadOnly\b/);
  });

  it("server/routes.ts still references requireBoardAccess (canonical path)", () => {
    expect(ROUTES_SRC).toMatch(/requireBoardAccess/);
  });
});

describe("Wave 12 — retired 4.3 legacy per-subsystem run endpoints", () => {
  it("server/routes.ts no longer registers POST /api/financial/recurring-charges/run", () => {
    expect(ROUTES_SRC).not.toMatch(
      /app\.post\(\s*["']\/api\/financial\/recurring-charges\/run["']/,
    );
  });

  it("server/routes.ts no longer registers POST /api/financial/assessments/run", () => {
    expect(ROUTES_SRC).not.toMatch(
      /app\.post\(\s*["']\/api\/financial\/assessments\/run["']/,
    );
  });

  it("server/routes.ts still registers the unified /api/financial/rules/:ruleId/run", () => {
    expect(ROUTES_SRC).toMatch(
      /app\.post\(\s*["']\/api\/financial\/rules\/:ruleId\/run["']/,
    );
  });
});
