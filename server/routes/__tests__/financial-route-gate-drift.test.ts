/**
 * P1-7 drift-guard (dispatch founder-os#8537).
 *
 * The role→capability matrix is only as good as the gates actually wired on
 * each route. The 2026-07-03 re-audit confirmed all 54 financial-mutation
 * routes carry `requireAdminRole`. This test is the REGRESSION FENCE: it reads
 * the route source and fails if any current-or-future financial-MUTATION route
 * (POST/PUT/PATCH/DELETE under the financial surface) is registered WITHOUT a
 * `requireAdminRole(...)` gate — i.e. left `requireAdmin`-only, which a `viewer`
 * would pass.
 *
 * This is a static source assertion (not a runtime request cycle) on purpose:
 * it catches "someone added a new /api/financial route and forgot the role
 * gate" at test-time, which is exactly the drift that let the matrix doc fall
 * ~15 PRs behind before this audit. The runtime middleware contract itself is
 * covered by financial-security.test.ts.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const routesDir = resolve(here, "..", "..");

/** Route source files that register financial-mutation endpoints. */
const SOURCES = [
  "routes.ts",
  "routes/admin-payments.ts",
  "routes/admin-reconciliation.ts",
  "routes/autopay.ts",
  "routes/stripe-connect.ts",
].map((rel) => resolve(routesDir, rel));

/**
 * Financial-mutation path fragments whose write routes MUST be role-gated.
 * Portal (owner self-service) + webhooks are deliberately excluded — they use
 * a different auth model (portal-session / crypto signature), documented in
 * docs/security/financial-route-role-matrix.md §H, §I, §Known gaps.
 */
const FINANCIAL_MUTATION_PATTERNS = [
  /\/api\/financial\//,
  /\/api\/admin\/payments\//,
  /\/api\/admin\/reconciliation\//,
  /\/api\/plaid\/(create-link-token|exchange-token|sync|reconcile|connections)/,
];

/** Explicitly-allowed non-role-gated exceptions (read routes, portal, webhooks). */
const isMutationVerb = (verb: string) =>
  verb === "post" || verb === "put" || verb === "patch" || verb === "delete";

type RouteReg = { file: string; verb: string; path: string; line: number; head: string };

/** Parse `app.<verb>("<path>", <middleware...>` registrations from a source file. */
function parseRoutes(file: string): RouteReg[] {
  const src = readFileSync(file, "utf8");
  const lines = src.split("\n");
  const out: RouteReg[] = [];
  const re = /\b(?:app|router)\.(post|put|patch|delete)\(\s*["'`]([^"'`]+)["'`]/;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(re);
    if (!m) continue;
    // Grab the registration head (this line + next 2) to inspect the middleware chain.
    const head = lines.slice(i, i + 3).join(" ");
    out.push({ file, verb: m[1], path: m[2], line: i + 1, head });
  }
  return out;
}

describe("P1-7 drift-guard § every financial-mutation route is role-gated", () => {
  const all = SOURCES.flatMap(parseRoutes);

  it("parsed a non-trivial number of route registrations (sanity)", () => {
    expect(all.length).toBeGreaterThan(50);
  });

  it("no financial-mutation route is requireAdmin-only (missing requireAdminRole)", () => {
    const offenders = all
      .filter((r) => isMutationVerb(r.verb))
      .filter((r) => FINANCIAL_MUTATION_PATTERNS.some((p) => p.test(r.path)))
      // A gated route names requireAdminRole in its middleware head.
      .filter((r) => !/requireAdminRole\s*\(/.test(r.head));

    // Helpful failure message: list the exact offending routes.
    const detail = offenders
      .map((r) => `  ${r.verb.toUpperCase()} ${r.path}  (${r.file.split("/").slice(-2).join("/")}:${r.line})`)
      .join("\n");

    expect(
      offenders,
      offenders.length
        ? `Financial-mutation route(s) registered WITHOUT requireAdminRole — a viewer could mutate:\n${detail}\n` +
            `Add requireAdminRole([...write roles]) after requireAdmin, per docs/security/financial-route-role-matrix.md.`
        : "",
    ).toHaveLength(0);
  });

  it("the treasurer-only payment routes stay tightest (RECORD_ROLES = platform-admin + board-officer only)", () => {
    // admin-payments.ts mounts on a sub-router with relative paths (/record),
    // so assert the invariant at its source: RECORD_ROLES must stay the tight
    // 2-role treasurer set, and the record route must carry the role gate.
    const src = readFileSync(resolve(routesDir, "routes/admin-payments.ts"), "utf8");
    const recordRolesDef = src.match(/const\s+RECORD_ROLES[^=]*=\s*(\[[^\]]*\])/);
    expect(recordRolesDef, "admin-payments.ts must define RECORD_ROLES").toBeTruthy();
    const roles = recordRolesDef![1];
    expect(roles).toMatch(/platform-admin/);
    expect(roles).toMatch(/board-officer/);
    // The broad operator roles must NOT be in the payments-record gate.
    for (const broad of ["assisted-board", "pm-assistant", "manager", "viewer"]) {
      expect(roles, `RECORD_ROLES must NOT include ${broad}`).not.toMatch(broad);
    }
    // The record route registration references the role gate (multi-line
    // app.post("/api/admin/payments/record", ..., requireAdminRole(RECORD_ROLES))).
    const recordReg = src.match(
      /app\.(?:post|put)\(\s*["'`]\/api\/admin\/payments\/record["'`][\s\S]{0,240}/,
    );
    expect(recordReg, "POST /api/admin/payments/record must be registered").toBeTruthy();
    expect(recordReg![0]).toMatch(/requireAdminRole\s*\(\s*RECORD_ROLES\s*\)/);
  });
});
