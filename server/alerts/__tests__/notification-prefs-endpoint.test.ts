/**
 * 4.1 Tier 3 (Wave 32) — Integration tests for notification-preferences and
 * push-subscribe endpoints.
 *
 * Verifies:
 *   1. PATCH /api/admin/notification-preferences round-trips email + push
 *      booleans.
 *   2. GET returns defaults when no prefs row exists (email=true, push=false).
 *   3. POST /api/admin/push/subscribe creates an admin_push_subscriptions
 *      row, idempotent on duplicate endpoint.
 *   4. DELETE /api/admin/push/subscribe soft-deletes (is_active=0).
 *
 * Uses the same in-memory DB stub pattern as `notifications.test.ts` —
 * the route handlers are extracted into a tiny express app rather than
 * loading the full server/routes.ts (which would require booting most of
 * the YCM stack just to test 4 endpoints).
 */

import express from "express";
import { describe, it, expect, vi, beforeEach } from "vitest";

interface PrefsRow {
  id: string;
  adminUserId: string;
  notifyAlertsEmail: number;
  notifyAlertsPush: number;
}
interface PushSubRow {
  id: string;
  adminUserId: string;
  endpoint: string;
  p256dhKey: string;
  authKey: string;
  isActive: number;
}

const store: { prefs: PrefsRow[]; subs: PushSubRow[] } = { prefs: [], subs: [] };

function reset() {
  store.prefs = [];
  store.subs = [];
}

function extractValues(cond: any, into: Map<string, any>, depth = 0) {
  if (!cond || typeof cond !== "object" || depth > 10) return;
  const chunks = cond.queryChunks ?? cond.fragment?.queryChunks;
  if (Array.isArray(chunks)) {
    let lastCol: string | null = null;
    for (const c of chunks) {
      if (!c) continue;
      const ctor = c?.constructor?.name;
      if (ctor === "StringChunk") continue;
      if (typeof c === "object" && typeof c.name === "string" && (c.columnType !== undefined || c.table !== undefined)) {
        lastCol = c.name;
        continue;
      }
      if (typeof c === "object" && Array.isArray(c.queryChunks)) {
        extractValues(c, into, depth + 1);
        continue;
      }
      if (ctor === "Param" && lastCol) {
        if (!into.has(lastCol)) into.set(lastCol, c.value);
        lastCol = null;
      }
    }
  }
  if (Array.isArray(cond.queries)) {
    for (const q of cond.queries) extractValues(q, into, depth + 1);
  }
}

vi.mock("../../db", async () => {
  const { getTableName } = await import("drizzle-orm");
  function dispatch(t: string, vals: Map<string, any>): any[] {
    if (t === "admin_user_preferences") {
      const adminId = vals.get("admin_user_id");
      return store.prefs.filter((p) => (adminId ? p.adminUserId === adminId : true));
    }
    if (t === "admin_push_subscriptions") {
      const adminId = vals.get("admin_user_id");
      const endpoint = vals.get("endpoint");
      return store.subs.filter((s) => {
        if (adminId && s.adminUserId !== adminId) return false;
        if (endpoint && s.endpoint !== endpoint) return false;
        return true;
      });
    }
    return [];
  }
  function makeBuilder(t: string) {
    const b: any = { _t: t, _vals: new Map() };
    const exec = () => Promise.resolve(dispatch(b._t, b._vals));
    b.where = (cond?: any) => {
      if (cond) extractValues(cond, b._vals);
      const ret: any = Promise.resolve(dispatch(b._t, b._vals));
      ret.limit = () => Promise.resolve(dispatch(b._t, b._vals));
      ret.then = (r: any, j: any) => exec().then(r, j);
      return ret;
    };
    b.limit = () => Promise.resolve(dispatch(b._t, b._vals));
    b.then = (r: any, j: any) => exec().then(r, j);
    return b;
  }
  return {
    db: {
      select: () => ({
        from: (table: any) => makeBuilder(getTableName(table)),
      }),
      insert: (table: any) => {
        const t = getTableName(table);
        return {
          values: (vals: any) => {
            const row: any = { id: `id-${Date.now()}-${Math.random()}`, ...vals };
            if (t === "admin_user_preferences") {
              row.notifyAlertsEmail = vals.notifyAlertsEmail ?? 1;
              row.notifyAlertsPush = vals.notifyAlertsPush ?? 0;
              store.prefs.push(row);
            } else if (t === "admin_push_subscriptions") {
              row.isActive = 1;
              store.subs.push(row);
            }
            const ret: any = Promise.resolve([row]);
            ret.returning = async () => [row];
            return ret;
          },
        };
      },
      update: (table: any) => {
        const t = getTableName(table);
        return {
          set: (patch: any) => ({
            where: (cond: any) => {
              const vals = new Map<string, any>();
              if (cond) extractValues(cond, vals);
              let updated: any[] = [];
              if (t === "admin_user_preferences") {
                const id = vals.get("id");
                for (const r of store.prefs) {
                  if (id && r.id !== id) continue;
                  if (patch.notifyAlertsEmail !== undefined) r.notifyAlertsEmail = patch.notifyAlertsEmail;
                  if (patch.notifyAlertsPush !== undefined) r.notifyAlertsPush = patch.notifyAlertsPush;
                  updated.push(r);
                }
              } else if (t === "admin_push_subscriptions") {
                const id = vals.get("id");
                const endpoint = vals.get("endpoint");
                const adminId = vals.get("admin_user_id");
                for (const r of store.subs) {
                  if (id && r.id !== id) continue;
                  if (endpoint && r.endpoint !== endpoint) continue;
                  if (adminId && r.adminUserId !== adminId) continue;
                  if (patch.isActive !== undefined) r.isActive = patch.isActive;
                  if (patch.p256dhKey) r.p256dhKey = patch.p256dhKey;
                  if (patch.authKey) r.authKey = patch.authKey;
                  if (patch.adminUserId) r.adminUserId = patch.adminUserId;
                  updated.push(r);
                }
              }
              const ret: any = Promise.resolve(updated);
              ret.returning = async () => updated;
              return ret;
            },
          }),
        };
      },
    },
  };
});

// ---- Mount the route handlers in a tiny express app -----------------------
//
// We import the actual `db` module (now stubbed) and the schema
// references, then re-implement the four route handlers verbatim from
// `server/routes.ts`. This keeps the test focused on the contract (URL +
// JSON shape) without booting the full server.

import { db } from "../../db";
import { adminPushSubscriptions, adminUserPreferences } from "@shared/schema";
import { and, eq } from "drizzle-orm";

function makeApp() {
  const app = express();
  app.use(express.json());

  // Fake auth — set req.adminUserId to a header value for testability.
  const requireAdmin = (req: any, res: any, next: any) => {
    const id = req.header("x-test-admin-id");
    if (!id) return res.status(403).json({ code: "ADMIN_SESSION_REQUIRED" });
    req.adminUserId = id;
    next();
  };

  async function loadOrCreatePrefsRow(adminUserId: string) {
    const [existing] = await db
      .select()
      .from(adminUserPreferences)
      .where(eq(adminUserPreferences.adminUserId, adminUserId))
      .limit(1);
    if (existing) return existing;
    const [created] = await db.insert(adminUserPreferences).values({ adminUserId }).returning();
    return created;
  }

  app.get("/api/admin/notification-preferences", requireAdmin, async (req: any, res: any) => {
    const [prefs] = await db
      .select()
      .from(adminUserPreferences)
      .where(eq(adminUserPreferences.adminUserId, req.adminUserId))
      .limit(1);
    const email = prefs?.notifyAlertsEmail ?? 1;
    const push = prefs?.notifyAlertsPush ?? 0;
    res.json({ email: email !== 0, push: push !== 0 });
  });

  app.patch("/api/admin/notification-preferences", requireAdmin, async (req: any, res: any) => {
    const { email, push } = req.body ?? {};
    const patch: any = { updatedAt: new Date() };
    if (typeof email === "boolean") patch.notifyAlertsEmail = email ? 1 : 0;
    if (typeof push === "boolean") patch.notifyAlertsPush = push ? 1 : 0;
    if (patch.notifyAlertsEmail === undefined && patch.notifyAlertsPush === undefined) {
      return res.status(400).json({ message: "At least one of email/push must be a boolean" });
    }
    const row = await loadOrCreatePrefsRow(req.adminUserId);
    const [updated] = await db
      .update(adminUserPreferences)
      .set(patch)
      .where(eq(adminUserPreferences.id, row.id))
      .returning();
    res.json({
      email: (updated.notifyAlertsEmail ?? 1) !== 0,
      push: (updated.notifyAlertsPush ?? 0) !== 0,
    });
  });

  app.post("/api/admin/push/subscribe", requireAdmin, async (req: any, res: any) => {
    const { endpoint, keys } = req.body ?? {};
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ message: "endpoint, keys.p256dh, keys.auth required" });
    }
    const [existing] = await db
      .select()
      .from(adminPushSubscriptions)
      .where(eq(adminPushSubscriptions.endpoint, endpoint))
      .limit(1);
    if (existing) {
      const [updated] = await db
        .update(adminPushSubscriptions)
        .set({
          adminUserId: req.adminUserId,
          p256dhKey: keys.p256dh,
          authKey: keys.auth,
          isActive: 1,
          updatedAt: new Date(),
        })
        .where(eq(adminPushSubscriptions.id, existing.id))
        .returning();
      return res.json({ id: updated.id, ok: true });
    }
    const [created] = await db
      .insert(adminPushSubscriptions)
      .values({
        adminUserId: req.adminUserId,
        endpoint,
        p256dhKey: keys.p256dh,
        authKey: keys.auth,
        isActive: 1,
      })
      .returning();
    res.status(201).json({ id: created.id, ok: true });
  });

  app.delete("/api/admin/push/subscribe", requireAdmin, async (req: any, res: any) => {
    const { endpoint } = req.body ?? {};
    if (!endpoint) return res.status(400).json({ message: "endpoint required" });
    await db
      .update(adminPushSubscriptions)
      .set({ isActive: 0, updatedAt: new Date() })
      .where(
        and(
          eq(adminPushSubscriptions.adminUserId, req.adminUserId),
          eq(adminPushSubscriptions.endpoint, endpoint),
        ),
      );
    res.json({ ok: true });
  });

  return app;
}

async function startApp() {
  const app = makeApp();
  const server = app.listen(0);
  await new Promise((resolve) => server.on("listening", resolve));
  const port = (server.address() as { port: number }).port;
  return { server, base: `http://127.0.0.1:${port}` };
}

describe("notification preferences + push subscribe endpoints", () => {
  beforeEach(() => reset());

  it("GET /notification-preferences returns defaults when no prefs row exists", async () => {
    const { server, base } = await startApp();
    try {
      const r = await fetch(`${base}/api/admin/notification-preferences`, {
        headers: { "x-test-admin-id": "admin-1" },
      });
      expect(r.status).toBe(200);
      const body = await r.json();
      expect(body).toEqual({ email: true, push: false });
    } finally {
      server.close();
    }
  });

  it("PATCH /notification-preferences round-trips email and push", async () => {
    const { server, base } = await startApp();
    try {
      // Disable email, enable push.
      const r1 = await fetch(`${base}/api/admin/notification-preferences`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-test-admin-id": "admin-1" },
        body: JSON.stringify({ email: false, push: true }),
      });
      expect(r1.status).toBe(200);
      expect(await r1.json()).toEqual({ email: false, push: true });

      // Read back
      const r2 = await fetch(`${base}/api/admin/notification-preferences`, {
        headers: { "x-test-admin-id": "admin-1" },
      });
      expect(await r2.json()).toEqual({ email: false, push: true });

      // Partial PATCH — toggle only email back on
      const r3 = await fetch(`${base}/api/admin/notification-preferences`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-test-admin-id": "admin-1" },
        body: JSON.stringify({ email: true }),
      });
      expect(await r3.json()).toEqual({ email: true, push: true });
    } finally {
      server.close();
    }
  });

  it("PATCH with no booleans returns 400", async () => {
    const { server, base } = await startApp();
    try {
      const r = await fetch(`${base}/api/admin/notification-preferences`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-test-admin-id": "admin-1" },
        body: JSON.stringify({}),
      });
      expect(r.status).toBe(400);
    } finally {
      server.close();
    }
  });

  it("POST /push/subscribe creates an admin_push_subscriptions row", async () => {
    const { server, base } = await startApp();
    try {
      const r = await fetch(`${base}/api/admin/push/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-test-admin-id": "admin-1" },
        body: JSON.stringify({
          endpoint: "https://push.example/abc",
          keys: { p256dh: "PPPP", auth: "AAAA" },
        }),
      });
      expect(r.status).toBe(201);
      expect(store.subs).toHaveLength(1);
      expect(store.subs[0]).toMatchObject({
        adminUserId: "admin-1",
        endpoint: "https://push.example/abc",
        isActive: 1,
      });
    } finally {
      server.close();
    }
  });

  it("POST /push/subscribe is idempotent on duplicate endpoint (upserts)", async () => {
    const { server, base } = await startApp();
    try {
      const body = JSON.stringify({
        endpoint: "https://push.example/dup",
        keys: { p256dh: "P1", auth: "A1" },
      });
      await fetch(`${base}/api/admin/push/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-test-admin-id": "admin-1" },
        body,
      });
      // 2nd call with same endpoint, different keys.
      const r = await fetch(`${base}/api/admin/push/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-test-admin-id": "admin-1" },
        body: JSON.stringify({
          endpoint: "https://push.example/dup",
          keys: { p256dh: "P2", auth: "A2" },
        }),
      });
      expect(r.status).toBe(200);
      expect(store.subs).toHaveLength(1);
      expect(store.subs[0]?.p256dhKey).toBe("P2");
    } finally {
      server.close();
    }
  });

  it("DELETE /push/subscribe soft-deletes by setting is_active=0", async () => {
    const { server, base } = await startApp();
    try {
      await fetch(`${base}/api/admin/push/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-test-admin-id": "admin-1" },
        body: JSON.stringify({
          endpoint: "https://push.example/del",
          keys: { p256dh: "P", auth: "A" },
        }),
      });
      expect(store.subs[0]?.isActive).toBe(1);
      const r = await fetch(`${base}/api/admin/push/subscribe`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-test-admin-id": "admin-1" },
        body: JSON.stringify({ endpoint: "https://push.example/del" }),
      });
      expect(r.status).toBe(200);
      expect(store.subs[0]?.isActive).toBe(0);
    } finally {
      server.close();
    }
  });

  it("returns 403 without x-test-admin-id (auth gate)", async () => {
    const { server, base } = await startApp();
    try {
      const r = await fetch(`${base}/api/admin/notification-preferences`);
      expect(r.status).toBe(403);
    } finally {
      server.close();
    }
  });
});
