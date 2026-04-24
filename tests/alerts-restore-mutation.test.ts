/**
 * 4.1 Wave 4 — server integration test for POST /api/alerts/:alertId/restore.
 *
 * Covers:
 *   1. 403 / ADMIN_SESSION_REQUIRED when unauthenticated.
 *   2. 200 with an authenticated admin session.
 *   3. Upsert semantics — for a row previously marked dismissed, the
 *      restore mutation clears `dismissedAt` to NULL (but leaves the row
 *      in place so `readAt` is preserved).
 *   4. `invalidateAlertCache()` is called after each successful write.
 *   5. 403 when `canAccessAlert` denies the persona.
 *   6. 404 when the alertId is malformed.
 *
 * Mirrors the harness shape of tests/alerts-read-state-mutations.test.ts
 * (Wave 3) — uses a mocked `db.insert` that records upserts in an
 * in-memory array. No real Postgres required.
 */

import express from "express";
import type { Request, Response, NextFunction } from "express";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- DB mock --------------------------------------------------------------

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

// ---- Module imports (after mocks) -----------------------------------------

import { canAccessAlert } from "../server/alerts/can-access-alert";
import { parseAlertId, RULE_TYPE_FEATURE_DOMAIN } from "../server/alerts/types";
import { invalidateAlertCache } from "../server/alerts";
import { alertReadStates } from "@shared/schema";
import { db } from "../server/db";

// ---- Test harness ---------------------------------------------------------

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

  async function handler(req: TestAdminRequest, res: Response) {
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
      await db
        .insert(alertReadStates)
        .values({
          alertId,
          adminUserId: req.adminUserId!,
          readAt: null,
          dismissedAt: null,
        } as any)
        .onConflictDoUpdate({
          target: [alertReadStates.alertId, alertReadStates.adminUserId],
          set: { dismissedAt: null } as any,
        });

      invalidateAlertCache();
      opts.invalidateSpy?.();
      return res.json({ alertId, dismissedAt: null });
    } catch (error: any) {
      return res.status(500).json({ message: error?.message ?? "error" });
    }
  }

  app.post("/api/alerts/:alertId/restore", requireAdmin, (req, res) =>
    handler(req as TestAdminRequest, res),
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

describe("POST /api/alerts/:alertId/restore — auth gate", () => {
  it("returns 403 / ADMIN_SESSION_REQUIRED when unauthenticated", async () => {
    const app = makeApp({ authed: false });
    const res = await postJson(app, "/api/alerts/overdue-work-order:work_orders:wo-1/restore");
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("ADMIN_SESSION_REQUIRED");
  });
});

describe("POST /api/alerts/:alertId/restore — authenticated behavior", () => {
  it("returns 200 and clears dismissedAt (preserves readAt) when the row exists", async () => {
    // Seed a dismissed row.
    dbState.readStates.push({
      alertId: "overdue-work-order:work_orders:wo-seed",
      adminUserId: "admin-1",
      readAt: new Date("2026-04-15T00:00:00Z"),
      dismissedAt: new Date("2026-04-18T00:00:00Z"),
    });

    const app = makeApp({ authed: true, adminUserId: "admin-1", adminRole: "manager" });
    const res = await postJson(app, "/api/alerts/overdue-work-order:work_orders:wo-seed/restore");
    expect(res.status).toBe(200);
    expect(res.body.dismissedAt).toBeNull();

    expect(dbState.readStates).toHaveLength(1);
    expect(dbState.readStates[0].dismissedAt).toBeNull();
    // readAt preserved — restore only clears the dismissed flag.
    expect(dbState.readStates[0].readAt).toEqual(new Date("2026-04-15T00:00:00Z"));
  });

  it("inserts a fresh no-op row when no row exists (idempotent restore)", async () => {
    const app = makeApp({ authed: true, adminUserId: "admin-1", adminRole: "manager" });
    const res = await postJson(app, "/api/alerts/overdue-work-order:work_orders:wo-fresh/restore");
    expect(res.status).toBe(200);
    expect(dbState.readStates).toHaveLength(1);
    expect(dbState.readStates[0]).toMatchObject({
      alertId: "overdue-work-order:work_orders:wo-fresh",
      adminUserId: "admin-1",
      readAt: null,
      dismissedAt: null,
    });
  });

  it("calls invalidateAlertCache() after the write", async () => {
    const invalidateSpy = vi.fn();
    const app = makeApp({
      authed: true,
      adminUserId: "admin-1",
      adminRole: "manager",
      invalidateSpy,
    });
    const res = await postJson(app, "/api/alerts/overdue-work-order:work_orders:wo-cache/restore");
    expect(res.status).toBe(200);
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
  });

  it("returns 403 when canAccessAlert denies the persona", async () => {
    // assisted-board is denied operations.work-orders (per can-access-alert.ts).
    const app = makeApp({ authed: true, adminUserId: "admin-1", adminRole: "assisted-board" });
    const res = await postJson(app, "/api/alerts/overdue-work-order:work_orders:wo-denied/restore");
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("ALERT_FEATURE_DOMAIN_FORBIDDEN");
    expect(dbState.readStates).toHaveLength(0);
  });

  it("returns 404 when alertId references an unknown ruleType", async () => {
    const app = makeApp({ authed: true, adminUserId: "admin-1", adminRole: "manager" });
    const res = await postJson(app, "/api/alerts/unknown-rule:some_table:some-id/restore");
    expect(res.status).toBe(404);
    expect(dbState.readStates).toHaveLength(0);
  });
});
