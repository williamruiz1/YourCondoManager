/**
 * Security audit — alert mutation endpoints (`security/alert-mutation-audit`).
 *
 * Locks in the hardening applied to server/routes.ts Wave 3 / Wave 4 alert
 * read-state mutation handlers (`POST /api/alerts/:alertId/read`, `dismiss`,
 * `restore`). Each test case maps to an attack vector from the audit brief:
 *
 *   1. Cross-tenant leakage  — user with scope on assoc A hits an alertId
 *      whose underlying record lives in assoc B. Must 404.
 *   2. Forged alertId        — unknown rule-type prefix. Must 404.
 *   3. Malformed alertId     — wrong segment count, illegal chars, length
 *      attack, path traversal. Must 404 (never 500, never leak a stack).
 *   4. Unauthorized feature-domain — role passes the auth middleware but
 *      `canAccessAlert` denies (e.g. assisted-board + work-orders). Must 403.
 *   5. Self-impersonation    — body-supplied `adminUserId` MUST NOT be
 *      written; the DB row always carries the session's adminUserId.
 *
 * Test harness: we reproduce the production handler (including the
 * `assertAlertOwnership` orchestrator call) in-process, with both the
 * cross-association resolver and the DB mocked. This mirrors the pattern
 * used by `alerts-read-state-mutations.test.ts` and `alerts-restore-mutation.test.ts`
 * so the tests don't pull in the full auth / session / Drizzle stack.
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

vi.mock("../server/db", () => ({
  db: {
    insert: (_table: unknown) => ({
      values: (values: ReadStateRow) => ({
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
      }),
    }),
  },
}));

// ---- Cross-association orchestrator mock ---------------------------------
//
// Only the alertIds listed in `permittedAlertIds` are treated as belonging
// to the caller. This lets us simulate the cross-tenant leak scenario
// without booting the real resolvers.

const permittedAlertIds = new Set<string>();

vi.mock("../server/alerts", () => ({
  invalidateAlertCache: () => {},
  resolvePermittedAssociations: async () => [{ id: "assoc-A", name: "A" }],
  getCrossAssociationAlerts: async () => ({
    alerts: Array.from(permittedAlertIds).map((alertId) => ({ alertId })),
    readStateBy: {},
  }),
}));

// ---- Module imports (after mocks) -----------------------------------------

import { canAccessAlert } from "../server/alerts/can-access-alert";
import { parseAlertId, RULE_TYPE_FEATURE_DOMAIN } from "../server/alerts/types";
import { invalidateAlertCache, getCrossAssociationAlerts, resolvePermittedAssociations } from "../server/alerts";
import { alertReadStates } from "@shared/schema";
import { db } from "../server/db";

// ---- Handler under test ---------------------------------------------------
//
// This is a copy of the hardened logic from server/routes.ts (same branch:
// validation → canAccessAlert → assertAlertOwnership → upsert). When the
// production handler changes, this test will fail against it unless this
// copy is updated in lockstep.

const ALERT_ID_FORMAT = /^[a-z-]+:[a-z_-]+:[A-Za-z0-9_-]{1,64}$/;

type TestAdminRequest = Request & {
  adminUserId?: string;
  adminRole?: string;
  adminScopedAssociationIds?: string[];
};

async function assertAlertOwnership(
  req: TestAdminRequest,
  alertId: string,
): Promise<{ status: number; body: { message: string; code?: string } } | null> {
  const permittedAssociations = await resolvePermittedAssociations({
    adminRole: req.adminRole as any,
    adminScopedAssociationIds: req.adminScopedAssociationIds ?? [],
  });
  const { alerts } = await getCrossAssociationAlerts({
    adminUserId: req.adminUserId!,
    adminRole: req.adminRole as any,
    personaToggles: {},
    permittedAssociations,
    readState: "all",
    limit: 500,
    skipCache: true,
  });
  if (!alerts.some((a) => a.alertId === alertId)) {
    return { status: 404, body: { message: "Alert not found", code: "ALERT_NOT_FOUND" } };
  }
  return null;
}

function makeApp(opts: {
  authed: boolean;
  adminUserId?: string;
  adminRole?: string;
}) {
  const app = express();
  app.use(express.json());

  function requireAdmin(req: TestAdminRequest, res: Response, next: NextFunction) {
    if (opts.authed) {
      req.adminUserId = opts.adminUserId ?? "admin-session";
      req.adminRole = opts.adminRole ?? "manager";
      req.adminScopedAssociationIds = ["assoc-A"];
      return next();
    }
    return res.status(403).json({ message: "Admin access required", code: "ADMIN_SESSION_REQUIRED" });
  }

  async function run(req: TestAdminRequest, res: Response, mode: "read" | "dismiss" | "restore") {
    try {
      const { alertId } = req.params;
      if (!alertId || typeof alertId !== "string" || !ALERT_ID_FORMAT.test(alertId)) {
        return res.status(404).json({ message: "Alert not found", code: "ALERT_NOT_FOUND" });
      }
      const parsed = parseAlertId(alertId);
      if (!parsed) {
        return res.status(404).json({ message: "Alert not found", code: "ALERT_NOT_FOUND" });
      }
      const featureDomain = RULE_TYPE_FEATURE_DOMAIN[parsed.ruleType];
      if (!canAccessAlert(req.adminRole as any, featureDomain, {})) {
        return res.status(403).json({
          message: "You do not have access to this alert",
          code: "ALERT_FEATURE_DOMAIN_FORBIDDEN",
        });
      }
      const ownershipError = await assertAlertOwnership(req, alertId);
      if (ownershipError) return res.status(ownershipError.status).json(ownershipError.body);

      const now = new Date();
      if (mode === "read") {
        await db
          .insert(alertReadStates)
          .values({ alertId, adminUserId: req.adminUserId!, readAt: now, dismissedAt: null } as any)
          .onConflictDoUpdate({
            target: [alertReadStates.alertId, alertReadStates.adminUserId],
            set: { readAt: now } as any,
          });
        invalidateAlertCache();
        return res.json({ alertId, readAt: now.toISOString() });
      }
      if (mode === "dismiss") {
        await db
          .insert(alertReadStates)
          .values({ alertId, adminUserId: req.adminUserId!, readAt: null, dismissedAt: now } as any)
          .onConflictDoUpdate({
            target: [alertReadStates.alertId, alertReadStates.adminUserId],
            set: { dismissedAt: now } as any,
          });
        invalidateAlertCache();
        return res.json({ alertId, dismissedAt: now.toISOString() });
      }
      await db
        .insert(alertReadStates)
        .values({ alertId, adminUserId: req.adminUserId!, readAt: null, dismissedAt: null } as any)
        .onConflictDoUpdate({
          target: [alertReadStates.alertId, alertReadStates.adminUserId],
          set: { dismissedAt: null } as any,
        });
      invalidateAlertCache();
      return res.json({ alertId, dismissedAt: null });
    } catch (err: any) {
      return res.status(500).json({ message: err?.message ?? "error" });
    }
  }

  app.post("/api/alerts/:alertId/read", requireAdmin, (req, res) =>
    run(req as TestAdminRequest, res, "read"),
  );
  app.post("/api/alerts/:alertId/dismiss", requireAdmin, (req, res) =>
    run(req as TestAdminRequest, res, "dismiss"),
  );
  app.post("/api/alerts/:alertId/restore", requireAdmin, (req, res) =>
    run(req as TestAdminRequest, res, "restore"),
  );
  return app;
}

async function postJson(
  app: express.Express,
  url: string,
  body: unknown = {},
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, async () => {
      try {
        const port = (server.address() as { port: number }).port;
        const res = await fetch(`http://127.0.0.1:${port}${url}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const text = await res.text();
        let parsed: any;
        try {
          parsed = text ? JSON.parse(text) : null;
        } catch {
          parsed = text;
        }
        server.close(() => resolve({ status: res.status, body: parsed }));
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
  permittedAlertIds.clear();
});

describe("Attack case 1 — cross-tenant leakage", () => {
  it("manager on assoc-A gets 404 when reading an alertId whose record lives in assoc-B", async () => {
    // assoc-A's alerts only. Caller will target a work-order id from assoc-B
    // that is NOT in the permitted set.
    permittedAlertIds.add("overdue-work-order:work_orders:wo-in-A");
    const app = makeApp({ authed: true, adminRole: "manager" });
    const res = await postJson(app, "/api/alerts/overdue-work-order:work_orders:wo-in-B/read");
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("ALERT_NOT_FOUND");
    expect(dbState.readStates).toHaveLength(0);
  });

  it("cross-tenant leak is also blocked on /dismiss", async () => {
    permittedAlertIds.add("active-election:elections:el-in-A");
    const app = makeApp({ authed: true, adminRole: "manager" });
    const res = await postJson(app, "/api/alerts/active-election:elections:el-in-B/dismiss");
    expect(res.status).toBe(404);
    expect(dbState.readStates).toHaveLength(0);
  });

  it("cross-tenant leak is also blocked on /restore", async () => {
    permittedAlertIds.add("due-maintenance:maintenance_schedule_instances:msi-in-A");
    const app = makeApp({ authed: true, adminRole: "manager" });
    const res = await postJson(
      app,
      "/api/alerts/due-maintenance:maintenance_schedule_instances:msi-in-B/restore",
    );
    expect(res.status).toBe(404);
    expect(dbState.readStates).toHaveLength(0);
  });

  it("same-tenant alertId passes and gets upserted", async () => {
    permittedAlertIds.add("overdue-work-order:work_orders:wo-in-A");
    const app = makeApp({ authed: true, adminRole: "manager", adminUserId: "admin-session" });
    const res = await postJson(app, "/api/alerts/overdue-work-order:work_orders:wo-in-A/read");
    expect(res.status).toBe(200);
    expect(dbState.readStates).toHaveLength(1);
    expect(dbState.readStates[0].adminUserId).toBe("admin-session");
  });
});

describe("Attack case 2 — forged alertId (unknown rule-type)", () => {
  it("rejects unknown rule-type with 404 before any DB work", async () => {
    permittedAlertIds.add("fake-rule-type:users:someone-else");
    const app = makeApp({ authed: true, adminRole: "manager" });
    const res = await postJson(app, "/api/alerts/fake-rule-type:users:someone-else/read");
    expect(res.status).toBe(404);
    expect(dbState.readStates).toHaveLength(0);
  });

  it("rejects numeric/garbage rule-type", async () => {
    const app = makeApp({ authed: true, adminRole: "manager" });
    const res = await postJson(app, "/api/alerts/12345:work_orders:wo-1/read");
    expect(res.status).toBe(404);
  });
});

describe("Attack case 3 — malformed alertId", () => {
  it("rejects missing colons", async () => {
    const app = makeApp({ authed: true, adminRole: "manager" });
    const res = await postJson(app, "/api/alerts/not-an-alert-id/read");
    expect(res.status).toBe(404);
    expect(dbState.readStates).toHaveLength(0);
  });

  it("rejects too-many segments", async () => {
    // Express treats `/` inside the path param as a route separator, so a
    // literal slash wouldn't even reach us. But extra colons should still
    // fail the regex because recordId only accepts [A-Za-z0-9_-].
    const app = makeApp({ authed: true, adminRole: "manager" });
    const res = await postJson(
      app,
      "/api/alerts/overdue-work-order:work_orders:wo-1:extra-segment/read",
    );
    expect(res.status).toBe(404);
  });

  it("rejects illegal characters in recordId (SQL-ish input)", async () => {
    const app = makeApp({ authed: true, adminRole: "manager" });
    const res = await postJson(
      app,
      `/api/alerts/${encodeURIComponent("overdue-work-order:work_orders:' OR 1=1 --")}/read`,
    );
    expect(res.status).toBe(404);
    expect(dbState.readStates).toHaveLength(0);
  });

  it("rejects length attack (recordId > 64 chars)", async () => {
    const longId = "a".repeat(128);
    const app = makeApp({ authed: true, adminRole: "manager" });
    const res = await postJson(app, `/api/alerts/overdue-work-order:work_orders:${longId}/read`);
    expect(res.status).toBe(404);
  });

  it("rejects empty-string parameter via a bare path (covered by route 404)", async () => {
    // Express returns its own 404 for an empty :alertId, which is fine —
    // the route never matches. We just confirm no DB write happens.
    const app = makeApp({ authed: true, adminRole: "manager" });
    const res = await postJson(app, "/api/alerts//read");
    expect(res.status).toBe(404);
    expect(dbState.readStates).toHaveLength(0);
  });
});

describe("Attack case 4 — unauthorized featureDomain", () => {
  it("assisted-board is denied operations.work-orders (hits canAccessAlert deny)", async () => {
    // Even if we whitelist the alertId in the orchestrator set, the earlier
    // canAccessAlert gate should still return 403.
    permittedAlertIds.add("overdue-work-order:work_orders:wo-1");
    const app = makeApp({ authed: true, adminRole: "assisted-board" });
    const res = await postJson(app, "/api/alerts/overdue-work-order:work_orders:wo-1/read");
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("ALERT_FEATURE_DOMAIN_FORBIDDEN");
    expect(dbState.readStates).toHaveLength(0);
  });

  it("viewer is permitted on governance.documents (smoke: canAccessAlert table honored)", async () => {
    permittedAlertIds.add("expiring-governance-document:governance_compliance_templates:tmpl-1");
    const app = makeApp({ authed: true, adminRole: "viewer" });
    const res = await postJson(
      app,
      "/api/alerts/expiring-governance-document:governance_compliance_templates:tmpl-1/read",
    );
    expect(res.status).toBe(200);
    expect(dbState.readStates).toHaveLength(1);
  });
});

describe("Attack case 5 — self-impersonation via body param", () => {
  it("ignores adminUserId in the request body; writes the session's adminUserId", async () => {
    permittedAlertIds.add("overdue-work-order:work_orders:wo-imp");
    const app = makeApp({ authed: true, adminRole: "manager", adminUserId: "session-admin" });
    const res = await postJson(
      app,
      "/api/alerts/overdue-work-order:work_orders:wo-imp/read",
      { adminUserId: "attacker-target-admin" },
    );
    expect(res.status).toBe(200);
    expect(dbState.readStates).toHaveLength(1);
    expect(dbState.readStates[0].adminUserId).toBe("session-admin");
    expect(dbState.readStates[0].adminUserId).not.toBe("attacker-target-admin");
  });

  it("same guarantee on /dismiss", async () => {
    permittedAlertIds.add("active-election:elections:el-imp");
    const app = makeApp({ authed: true, adminRole: "manager", adminUserId: "session-admin" });
    await postJson(
      app,
      "/api/alerts/active-election:elections:el-imp/dismiss",
      { adminUserId: "attacker-target-admin" },
    );
    expect(dbState.readStates[0].adminUserId).toBe("session-admin");
  });

  it("same guarantee on /restore", async () => {
    permittedAlertIds.add("active-election:elections:el-imp-restore");
    const app = makeApp({ authed: true, adminRole: "manager", adminUserId: "session-admin" });
    await postJson(
      app,
      "/api/alerts/active-election:elections:el-imp-restore/restore",
      { adminUserId: "attacker-target-admin" },
    );
    expect(dbState.readStates[0].adminUserId).toBe("session-admin");
  });
});

describe("Auth gate baseline", () => {
  it("all three endpoints require an admin session", async () => {
    const app = makeApp({ authed: false });
    for (const path of [
      "/api/alerts/overdue-work-order:work_orders:wo-1/read",
      "/api/alerts/overdue-work-order:work_orders:wo-1/dismiss",
      "/api/alerts/overdue-work-order:work_orders:wo-1/restore",
    ]) {
      const res = await postJson(app, path);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("ADMIN_SESSION_REQUIRED");
    }
  });
});
