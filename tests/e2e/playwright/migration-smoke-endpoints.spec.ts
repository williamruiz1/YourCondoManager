// founder-os #2476 — auth-surface smoke suite.
//
// Reproduces, as an automated CI gate, the seven-endpoint smoke test that
// was run by hand against production after the missing `auth_events`
// migration (0024) was patched. The point of #2476 is that a schema drift
// (six migrations silently skipped production) went undetected because no
// automated check ever exercised the auth surface end-to-end. This spec is
// that check: it boots the app against a real (ephemeral pglite) DB with a
// fully-materialised schema, seeds a single owner, and asserts every
// endpoint in the post-patch smoke list responds as expected.
//
// Endpoints (matching the dispatch's "Auth surface — endpoint smoke test"):
//   200 OK with a valid portal session:
//     /api/health
//     /api/portal/financial-dashboard
//     /api/portal/ledger
//     /api/portal/announcements
//     /api/portal/payment-methods
//     /api/portal/elections/active
//   401 without a cookie (expected):
//     /api/auth/me
//
// Real-backend ONLY. In route-mock / static-server mode there are no real
// `/api/*` handlers, so the suite skips itself — it has no meaning without
// a migrated DB behind the dev server.
//
// Boot-seed note: the dev server runs `seedDatabase()` asynchronously at
// boot (server/index.ts). pglite is single-threaded, so DB-backed requests
// fired while that seed is in flight queue behind it and can take tens of
// seconds. We therefore poll each endpoint with a deadline rather than
// asserting on the first response — once the boot-seed drains, every
// request returns immediately. `/api/auth/me` and the eventual 200s are
// the contract; transient slowness during seed is not a failure.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect, type APIRequestContext, type APIResponse } from "@playwright/test";
import { createRealBackend, type RealBackendHandle } from "./helpers/seed-helper";

const REAL_BACKEND = process.env.PLAYWRIGHT_REAL_BACKEND === "1";
const ASSOCIATION_ID = "assoc-e2e-1";
const HANDOFF_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  ".playwright-real-backend.json",
);

// Per-request abort + overall retry budget. A request issued while the
// boot-seed is hammering pglite can hang; we abort it after
// PER_REQUEST_TIMEOUT_MS and retry until READY_BUDGET_MS elapses.
const PER_REQUEST_TIMEOUT_MS = 15_000;
const READY_BUDGET_MS = 150_000;

interface RealBackendHandoff {
  connectionString: string;
  sessionSecret: string;
}

function readHandoff(): RealBackendHandoff {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (fs.existsSync(HANDOFF_PATH)) {
      return JSON.parse(fs.readFileSync(HANDOFF_PATH, "utf8")) as RealBackendHandoff;
    }
    const start = Date.now();
    while (Date.now() - start < 100) {
      /* spin */
    }
  }
  throw new Error(`Real-backend handoff file not found at ${HANDOFF_PATH}`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * GET `url` repeatedly until it returns `expectedStatus`, or the budget
 * elapses. Returns the final response so the caller can assert. Each
 * attempt is bounded by PER_REQUEST_TIMEOUT_MS so a request that hangs
 * during the boot-seed is aborted and retried rather than blocking the
 * whole test.
 */
async function getUntilStatus(
  request: APIRequestContext,
  url: string,
  expectedStatus: number,
  headers?: Record<string, string>,
): Promise<APIResponse | null> {
  const deadline = Date.now() + READY_BUDGET_MS;
  let last: APIResponse | null = null;
  while (Date.now() < deadline) {
    try {
      last = await request.get(url, { headers, timeout: PER_REQUEST_TIMEOUT_MS });
      if (last.status() === expectedStatus) return last;
    } catch {
      // aborted (timeout) or transient connection error during seed — retry
      last = null;
    }
    await sleep(1000);
  }
  return last;
}

// 200-expecting endpoints that require an authenticated owner. `/api/health`
// is public but included because it was first in the dispatch smoke list and
// now doubles as the migration-health gate (#2476 — it returns 503 if
// migrations are stale).
const AUTHED_OK_ENDPOINTS = [
  "/api/portal/financial-dashboard",
  "/api/portal/ledger",
  "/api/portal/announcements",
  "/api/portal/payment-methods",
  "/api/portal/elections/active",
] as const;

test.describe("founder-os #2476 — auth-surface smoke suite", () => {
  test.skip(!REAL_BACKEND, "real-backend only (no /api handlers in route-mock mode)");
  // API-only (no browser is launched), so running it under all three
  // browser projects would just repeat identical assertions. Run once.
  test.skip(({ browserName }) => browserName !== "chromium", "API-only — run once on chromium");
  // Generous: the first DB-backed request may wait out the boot-seed.
  test.setTimeout(READY_BUDGET_MS + 60_000);

  let backend: RealBackendHandle;
  let portalAccessId: string;

  test.beforeAll(async () => {
    const handoff = readHandoff();
    backend = await createRealBackend({
      connectionString: handoff.connectionString,
      sessionSecret: handoff.sessionSecret,
      cookieName: "sid_dev",
    });
    // Seed once. We deliberately do NOT truncate: the dev server's boot-seed
    // may still be writing, and TRUNCATE would contend for table locks. Our
    // synthetic association id never collides with the seed's UUID-keyed demo
    // data, and every endpoint scopes results to our portalAccessId.
    await backend.seedAssociation(ASSOCIATION_ID, "Smoke Test Association");
    const session = await backend.seedPortalAccess({ associationId: ASSOCIATION_ID });
    portalAccessId = session.portalAccessId;
  });

  test.afterAll(async () => {
    await backend?.cleanup();
  });

  test("public + portal endpoints return 200 with a valid portal session", async ({ request }) => {
    const health = await getUntilStatus(request, "/api/health", 200);
    expect(health, "/api/health never returned 200").not.toBeNull();
    expect(health!.status(), "/api/health").toBe(200);
    // /api/health also gates on migration health — a 200 proves the
    // boot-time check (server/migration-health.ts) did not flag the schema
    // as stale. (In the pglite test DB the schema is materialised via
    // drizzle-kit push, so there is no __drizzle_migrations table and the
    // status is "error"/"unknown" rather than "stale" — still a 200.)
    const healthBody = (await health!.json()) as { migrations?: { status?: string } };
    expect(healthBody.migrations?.status, "/api/health migration status").not.toBe("stale");

    const authedHeaders = { "x-portal-access-id": portalAccessId };
    for (const endpoint of AUTHED_OK_ENDPOINTS) {
      const res = await getUntilStatus(request, endpoint, 200, authedHeaders);
      expect(res, `${endpoint} never returned 200 within budget`).not.toBeNull();
      expect(res!.status(), endpoint).toBe(200);
    }
  });

  test("/api/auth/me returns 401 without a cookie", async ({ request }) => {
    // No DB query in this handler, so it answers instantly even mid-seed;
    // still routed through getUntilStatus for symmetry / boot resilience.
    const me = await getUntilStatus(request, "/api/auth/me", 401);
    expect(me, "/api/auth/me never returned 401").not.toBeNull();
    expect(me!.status(), "/api/auth/me (no cookie)").toBe(401);
  });
});
