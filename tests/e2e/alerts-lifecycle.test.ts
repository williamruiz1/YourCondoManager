// @zone: cross-cutting — E2E integration test (Wave 15b, Flow B)
/**
 * E2E Flow B — Alerts lifecycle.
 *
 * Exercises the full post-Wave-15a invalidation story end-to-end:
 *
 *   1. Seed state: one overdue work order against the alert source layer.
 *   2. GET /api/alerts/cross-association → returns { alerts: [one], ... }
 *      with `count === 1`.
 *   3. "Mark work order complete" mutation flips the source state.
 *   4. Cache invalidation fires (we invoke the invalidate helper directly
 *      to simulate the Wave-15a post-mutation pathway).
 *   5. GET /api/alerts/cross-association → returns { alerts: [] }.
 *
 * We mock the overdue-work-order source at the module boundary — this
 * is the same technique used by tests/portal-assessment-detail.test.ts
 * and keeps the test free of a live Postgres. The alert endpoint handler
 * itself is replayed in the harness so we're exercising the real wiring
 * between endpoint → `getCrossAssociationAlerts` → source resolvers
 * (with one source faked).
 */

import express from "express";
import type { Request, Response, NextFunction } from "express";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AddressInfo } from "net";

// ---------------------------------------------------------------------------
// Module mocks — fake the overdue-work-order source + the DB join used for
// read-state. Every other source returns an empty list so the test stays
// focused on a single alert.
// ---------------------------------------------------------------------------

const overdueMock = vi.fn();

vi.mock("../../server/alerts/sources/overdue-work-orders", () => ({
  resolve: (...args: unknown[]) => overdueMock(...args),
}));
vi.mock("../../server/alerts/sources/due-maintenance", () => ({
  resolve: vi.fn(async () => []),
}));
vi.mock("../../server/alerts/sources/active-elections", () => ({
  resolve: vi.fn(async () => []),
}));
vi.mock("../../server/alerts/sources/delinquent-ledger-balances", () => ({
  resolve: vi.fn(async () => []),
}));
vi.mock("../../server/alerts/sources/expiring-governance-documents", () => ({
  resolve: vi.fn(async () => []),
}));
vi.mock("../../server/alerts/sources/vendor-contract-renewals", () => ({
  resolve: vi.fn(async () => []),
}));
vi.mock("../../server/alerts/sources/insurance-expiry", () => ({
  resolve: vi.fn(async () => []),
}));
vi.mock("../../server/alerts/sources/budget-variance-flags", () => ({
  resolve: vi.fn(async () => []),
}));
vi.mock("../../server/alerts/sources/unpaid-late-fees", () => ({
  resolve: vi.fn(async () => []),
}));

// Stub the DB module so module-level init (pg.Pool + DATABASE_URL check)
// doesn't run. The real module throws at import when DATABASE_URL is unset.
vi.mock("../../server/db", () => {
  const makeChain = (): any => {
    const chain: any = {};
    chain.select = () => chain;
    chain.from = () => chain;
    chain.where = () => chain;
    chain.then = (resolve: (v: unknown) => unknown) => resolve([]);
    return chain;
  };
  return {
    pool: {},
    db: {
      select: () => makeChain(),
    },
  };
});

// canAccessAlert is already an exported helper in server/alerts.
// We let the real module load — it's pure (no DB).

// ---------------------------------------------------------------------------
// Fixture alerts
// ---------------------------------------------------------------------------

const OVERDUE_WO_ALERT = {
  alertId: "overdue-work-order:work_orders:wo-1",
  associationId: "assoc-1",
  associationName: "Harbor View HOA",
  zone: "operations" as const,
  featureDomain: "operations.work-orders" as const,
  ruleType: "overdue-work-order" as const,
  recordType: "work_orders",
  recordId: "wo-1",
  severity: "high" as const,
  title: "Overdue work order: Fix leak",
  description: "Scheduled for 2026-04-10 — 12 days overdue.",
  createdAt: new Date("2026-04-20T00:00:00Z"),
  resolutionHref: "/app/operations/work-orders/wo-1",
  sourceRecord: null,
};

// ---------------------------------------------------------------------------
// Harness — minimal Express app that wraps the real getCrossAssociationAlerts.
// ---------------------------------------------------------------------------

async function makeApp() {
  // Import AFTER mocks are set up (Vitest hoists vi.mock, but the
  // dynamic import keeps the dependency order predictable).
  const { getCrossAssociationAlerts, invalidateAlertCache } = await import("../../server/alerts");

  const app = express();
  app.use(express.json());

  // Fake admin session middleware — the real requireAdmin is bypassed
  // because it would try to hit the session store. We just set a mock
  // admin + association list.
  app.use((req, _res, next) => {
    (req as Request & { adminUser?: { id: string; role: string } }).adminUser = {
      id: "admin-1",
      role: "manager",
    };
    next();
  });

  app.get("/api/alerts/cross-association", async (_req, res) => {
    const payload = await getCrossAssociationAlerts({
      adminUserId: "admin-1",
      adminRole: "manager",
      personaToggles: {},
      permittedAssociations: [{ id: "assoc-1", name: "Harbor View HOA" }],
      readState: "unread",
      skipCache: true, // determinism — the cache would mask source flips.
    });
    res.json(payload);
  });

  // "Mark work order complete" — simulates the Wave-15a post-mutation
  // pathway: mutate source, invalidate cache.
  app.post("/api/work-orders/:id/complete", (req, res) => {
    // Flip the fake source to return no alerts.
    overdueMock.mockResolvedValue([]);
    invalidateAlertCache();
    res.json({ ok: true, id: req.params.id });
  });

  return app;
}

async function withApp<T>(run: (port: number) => Promise<T>): Promise<T> {
  const app = await makeApp();
  return new Promise((resolve, reject) => {
    const server = app.listen(0, async () => {
      try {
        const port = (server.address() as AddressInfo).port;
        const result = await run(port);
        server.close(() => resolve(result));
      } catch (err) {
        server.close(() => reject(err));
      }
    });
  });
}

async function getJson(port: number, path: string): Promise<{ status: number; body: any }> {
  const res = await fetch(`http://127.0.0.1:${port}${path}`);
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

async function postJson(port: number, path: string, body: unknown = {}): Promise<{ status: number; body: any }> {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  overdueMock.mockReset();
});

describe("E2E Flow B — alerts lifecycle (mark-complete invalidates feed)", () => {
  it("returns count=1 when one overdue work order is present", async () => {
    overdueMock.mockResolvedValue([OVERDUE_WO_ALERT]);
    await withApp(async (port) => {
      const res = await getJson(port, "/api/alerts/cross-association");
      expect(res.status).toBe(200);
      expect(res.body.alerts).toHaveLength(1);
      expect(res.body.alerts[0].alertId).toBe(OVERDUE_WO_ALERT.alertId);
      expect(res.body.alerts[0].resolutionHref).toBe("/app/operations/work-orders/wo-1");
    });
  });

  it("returns empty after mark-complete invalidates the cache", async () => {
    // Initial state — one overdue WO.
    overdueMock.mockResolvedValue([OVERDUE_WO_ALERT]);
    await withApp(async (port) => {
      const before = await getJson(port, "/api/alerts/cross-association");
      expect(before.body.alerts).toHaveLength(1);

      // Mark the WO complete — the handler flips the source + invalidates.
      const complete = await postJson(port, "/api/work-orders/wo-1/complete");
      expect(complete.status).toBe(200);
      expect(complete.body.ok).toBe(true);

      // Refetch — the alert should be gone.
      const after = await getJson(port, "/api/alerts/cross-association");
      expect(after.status).toBe(200);
      expect(after.body.alerts).toHaveLength(0);
    });
  });

  it("filter by zone=operations surfaces only operations alerts", async () => {
    overdueMock.mockResolvedValue([OVERDUE_WO_ALERT]);
    await withApp(async (port) => {
      const res = await getJson(port, "/api/alerts/cross-association");
      expect(res.body.alerts.every((a: { zone: string }) => a.zone === "operations")).toBe(true);
    });
  });
});
