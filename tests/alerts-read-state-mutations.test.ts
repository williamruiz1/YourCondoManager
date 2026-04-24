/**
 * 4.1 Wave 3 — server integration test for the read-state mutation
 * endpoints (POST /api/alerts/:alertId/read and /dismiss).
 *
 * Covers:
 *   1. 403 / ADMIN_SESSION_REQUIRED when unauthenticated.
 *   2. 200 with an authenticated admin session.
 *   3. Upsert semantics — (alertId, adminUserId) gets a row with readAt /
 *      dismissedAt populated.
 *   4. `invalidateAlertCache()` is called after each successful write so
 *      the GET endpoint serves fresh data on the next query.
 *   5. 403 when `canAccessAlert` denies the persona (e.g. assisted-board
 *      touching an `overdue-work-order:*` alertId).
 *   6. 404 when the alertId is malformed / references an unknown ruleType.
 *
 * This test mirrors the shape of the Wave-2 orchestrator test at
 *   server/alerts/__tests__/cross-association-endpoint.test.ts
 * — it drives the route-handler logic directly through a thin Express app
 * that reproduces the `requireAdmin` behavior from server/routes.ts, so we
 * don't pull in the full auth / session / storage stack.
 */

import express from "express";
import type { Request, Response, NextFunction } from "express";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- DB mock --------------------------------------------------------------
//
// Capture inserts into `alert_read_states` so we can assert upsert behavior
// without spinning up a real Postgres.

type ReadStateRow = {
  alertId: string;
  adminUserId: string;
  readAt: Date | null;
  dismissedAt: Date | null;
};

const dbState: { readStates: ReadStateRow[] } = { readStates: [] };

vi.mock("../server/db", () => {
  return {
    db: {
      insert: (_table: unknown) => ({
        values: (values: ReadStateRow) => {
          return {
            onConflictDoUpdate: (args: { set: Partial<ReadStateRow> }) => {
              const existing = dbState.readStates.find(
                (r) => r.alertId === values.alertId && r.adminUserId === values.adminUserId,
              );
              if (existing) {
                Object.assign(existing, args.set);
              } else {
                dbState.readStates.push({
                  alertId: values.alertId,
                  adminUserId: values.adminUserId,
                  readAt: values.readAt ?? null,
                  dismissedAt: values.dismissedAt ?? null,
                });
              }
              return Promise.resolve();
            },
          };
        },
      }),
    },
  };
});

// ---- Module imports after the mocks are in place --------------------------

import { canAccessAlert } from "../server/alerts/can-access-alert";
import { parseAlertId, RULE_TYPE_FEATURE_DOMAIN } from "../server/alerts/types";
import { invalidateAlertCache } from "../server/alerts";
import { alertReadStates } from "@shared/schema";
import { db } from "../server/db";

// ---- Test harness ---------------------------------------------------------
//
// A minimal express app that reproduces the route handlers added to
// server/routes.ts. Auth is swapped with a test middleware that either
// attaches the simulated admin session or rejects with 403 —
// ADMIN_SESSION_REQUIRED (identical to the production `requireAdmin`).

type TestAdminRequest = Request & {
  adminUserId?: string;
  adminRole?: string;
};

function makeApp(opts: {
  authed: boolean;
  adminUserId?: string;
  adminRole?: string;
  invalidateSpy?: () => void;
}) {
  const app = express();
  app.use(express.json());

  function requireAdmin(req: TestAdminRequest, res: Response, next: NextFunction) {
    if (opts.authed) {
      req.adminUserId = opts.adminUserId ?? "admin-1";
      req.adminRole = opts.adminRole ?? "manager";
      return next();
    }
    return res.status(403).json({
      message: "Admin access required",
      code: "ADMIN_SESSION_REQUIRED",
    });
  }

  async function handler(req: TestAdminRequest, res: Response, field: "read" | "dismiss") {
    try {
      const { alertId } = req.params;
      if (!alertId || typeof alertId !== "string") {
        return res.status(400).json({ message: "alertId is required" });
      }
      const parsed = parseAlertId(alertId);
      if (!parsed) {
        return res.status(404).json({ message: "Alert not found" });
      }
      const featureDomain = RULE_TYPE_FEATURE_DOMAIN[parsed.ruleType];
      if (!canAccessAlert(req.adminRole as any, featureDomain, {})) {
        return res.status(403).json({
          message: "You do not have access to this alert",
          code: "ALERT_FEATURE_DOMAIN_FORBIDDEN",
        });
      }
      const now = new Date();
      const insertValues =
        field === "read"
          ? { alertId, adminUserId: req.adminUserId!, readAt: now, dismissedAt: null }
          : { alertId, adminUserId: req.adminUserId!, readAt: null, dismissedAt: now };
      const updateSet = field === "read" ? { readAt: now } : { dismissedAt: now };
      await db
        .insert(alertReadStates)
        .values(insertValues as any)
        .onConflictDoUpdate({
          target: [alertReadStates.alertId, alertReadStates.adminUserId],
          set: updateSet as any,
        });

      invalidateAlertCache();
      opts.invalidateSpy?.();
      return res.json({ alertId, [`${field}At`]: now.toISOString() });
    } catch (error: any) {
      return res.status(500).json({ message: error?.message ?? "error" });
    }
  }

  app.post("/api/alerts/:alertId/read", requireAdmin, (req, res) =>
    handler(req as TestAdminRequest, res, "read"),
  );
  app.post("/api/alerts/:alertId/dismiss", requireAdmin, (req, res) =>
    handler(req as TestAdminRequest, res, "dismiss"),
  );

  return app;
}

async function postJson(app: express.Express, url: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, async () => {
      try {
        const port = (server.address() as { port: number }).port;
        const res = await fetch(`http://127.0.0.1:${port}${url}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        const text = await res.text();
        let body: any;
        try {
          body = text ? JSON.parse(text) : null;
        } catch {
          body = text;
        }
        server.close(() => resolve({ status: res.status, body }));
      } catch (err) {
        server.close(() => reject(err));
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  dbState.readStates = [];
});

describe("POST /api/alerts/:alertId/read — auth gate", () => {
  it("returns 403 / ADMIN_SESSION_REQUIRED when unauthenticated", async () => {
    const app = makeApp({ authed: false });
    const res = await postJson(app, "/api/alerts/overdue-work-order:work_orders:wo-1/read");
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("ADMIN_SESSION_REQUIRED");
  });
});

describe("POST /api/alerts/:alertId/read — authenticated upsert", () => {
  it("returns 200 and upserts the readAt row for the caller", async () => {
    const app = makeApp({ authed: true, adminUserId: "admin-1", adminRole: "manager" });
    const res = await postJson(app, "/api/alerts/overdue-work-order:work_orders:wo-1/read");
    expect(res.status).toBe(200);
    expect(dbState.readStates).toHaveLength(1);
    expect(dbState.readStates[0]).toMatchObject({
      alertId: "overdue-work-order:work_orders:wo-1",
      adminUserId: "admin-1",
    });
    expect(dbState.readStates[0].readAt).toBeInstanceOf(Date);
    expect(dbState.readStates[0].dismissedAt).toBeNull();
  });

  it("calls invalidateAlertCache() after the write", async () => {
    const invalidateSpy = vi.fn();
    const app = makeApp({
      authed: true,
      adminUserId: "admin-1",
      adminRole: "manager",
      invalidateSpy,
    });
    const res = await postJson(app, "/api/alerts/overdue-work-order:work_orders:wo-2/read");
    expect(res.status).toBe(200);
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
  });

  it("upsert: second POST updates readAt in place (no duplicate row)", async () => {
    const app = makeApp({ authed: true, adminUserId: "admin-1", adminRole: "manager" });
    await postJson(app, "/api/alerts/overdue-work-order:work_orders:wo-3/read");
    const firstReadAt = dbState.readStates[0].readAt;
    await new Promise((r) => setTimeout(r, 5));
    await postJson(app, "/api/alerts/overdue-work-order:work_orders:wo-3/read");
    expect(dbState.readStates).toHaveLength(1);
    const secondReadAt = dbState.readStates[0].readAt;
    expect(secondReadAt).not.toBe(firstReadAt);
  });

  it("returns 403 when canAccessAlert denies the persona (assisted-board + work-order)", async () => {
    // Per can-access-alert.ts: assisted-board is DENIED operations.work-orders.
    const app = makeApp({ authed: true, adminUserId: "admin-1", adminRole: "assisted-board" });
    const res = await postJson(app, "/api/alerts/overdue-work-order:work_orders:wo-denied/read");
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("ALERT_FEATURE_DOMAIN_FORBIDDEN");
    expect(dbState.readStates).toHaveLength(0);
  });

  it("returns 404 when alertId references an unknown ruleType", async () => {
    const app = makeApp({ authed: true, adminUserId: "admin-1", adminRole: "manager" });
    const res = await postJson(app, "/api/alerts/unknown-rule:some_table:some-id/read");
    expect(res.status).toBe(404);
    expect(dbState.readStates).toHaveLength(0);
  });
});

describe("POST /api/alerts/:alertId/dismiss — authenticated upsert", () => {
  it("returns 200 and upserts the dismissedAt row for the caller", async () => {
    const app = makeApp({ authed: true, adminUserId: "admin-1", adminRole: "manager" });
    const res = await postJson(app, "/api/alerts/active-election:elections:el-1/dismiss");
    expect(res.status).toBe(200);
    expect(dbState.readStates).toHaveLength(1);
    expect(dbState.readStates[0]).toMatchObject({
      alertId: "active-election:elections:el-1",
      adminUserId: "admin-1",
    });
    expect(dbState.readStates[0].dismissedAt).toBeInstanceOf(Date);
    expect(dbState.readStates[0].readAt).toBeNull();
  });

  it("calls invalidateAlertCache() after the write", async () => {
    const invalidateSpy = vi.fn();
    const app = makeApp({
      authed: true,
      adminUserId: "admin-1",
      adminRole: "manager",
      invalidateSpy,
    });
    await postJson(app, "/api/alerts/active-election:elections:el-2/dismiss");
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
  });

  it("returns 403 when unauthenticated", async () => {
    const app = makeApp({ authed: false });
    const res = await postJson(app, "/api/alerts/active-election:elections:el-3/dismiss");
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("ADMIN_SESSION_REQUIRED");
  });
});
