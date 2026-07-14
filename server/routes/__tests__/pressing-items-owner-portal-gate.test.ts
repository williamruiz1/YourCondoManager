/**
 * Owner-portal hard-gate tests for the pressing-items routes (YCM
 * pressing-items plain-English fix, 2026-07-14 — William voice ruling
 * following live-verify on #498/#499).
 *
 * William's ruling superseded the earlier per-role lensing fix: pressing
 * items (unmatched bank transactions, other owners' delinquency status,
 * vendor insurance, compliance deadlines) are board/treasurer business and
 * must NEVER render on the owner-portal surface — for ANY caller,
 * REGARDLESS of that caller's board seat or officer title. "I should not be
 * seeing this on an owner's portal... this is the wrong surface."
 *
 * These tests pin: (1) the portal GET returns `{ items: [] }` even when the
 * request carries strong board-officer signals (owner-board-member +
 * Treasurer title) that would previously have unlocked the full feed;
 * (2) `scanAssociation`/`getRoleLensedPressingItems` are never invoked on
 * the portal path at all — no query against `pressing_items` happens, not
 * just an empty response; (3) the admin surface (where Board mode lives)
 * is unaffected and still returns real items.
 */
import express, { type NextFunction, type Request, type Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let scanCalls: any[] = [];
let lensedCalls: any[] = [];

vi.mock("../../services/pressing-items/scanner", () => ({
  scanAssociation: vi.fn(async (associationId: string) => {
    scanCalls.push(associationId);
    return { scanned: 0, inserted: 0, updated: 0, resolved: 0, perClass: {} };
  }),
  getRoleLensedPressingItems: vi.fn(async (opts: any) => {
    lensedCalls.push(opts);
    return [
      {
        id: "pi-1",
        itemClass: "unidentified_txn",
        severity: "medium",
        title: "Incoming transfer from Luz Miranda — $626.35 (May 19) — needs matching",
        description: null,
        rawDetail: "ORIG CO NAME:...",
        actorRole: "treasurer",
        relatedRecordType: "bank_transaction",
        relatedRecordId: "tx-1",
        snoozedUntil: null,
        createdAt: new Date(),
      },
    ];
  }),
}));

vi.mock("../../db", () => ({ db: {} }));

import { registerPressingItemsRoutes } from "../pressing-items";

type PortalReq = Request & {
  portalAssociationId?: string;
  portalEffectiveRole?: string;
  portalBoardRoleTitle?: string | null;
};
type AdminReq = Request & { adminRole?: string; adminScopedAssociationIds?: string[] };

function makeApp() {
  const app = express();
  app.use(express.json());

  // Simulates the REAL requirePortal middleware resolving a caller who is an
  // owner-board-member with the Treasurer title — the strongest possible
  // signal that would have unlocked the feed under the PRIOR (per-role
  // lensing) fix. The point of these tests is that it must not matter.
  const requirePortal = (req: PortalReq, _res: Response, next: NextFunction) => {
    req.portalAssociationId = "assoc-1";
    req.portalEffectiveRole = "owner-board-member";
    req.portalBoardRoleTitle = "Treasurer";
    next();
  };
  const requireAdmin = (req: AdminReq, _res: Response, next: NextFunction) => {
    req.adminRole = "platform-admin";
    req.adminScopedAssociationIds = ["assoc-1"];
    next();
  };
  const platformAdminOnly = (_req: Request, _res: Response, next: NextFunction) => next();

  registerPressingItemsRoutes(app, { requirePortal: requirePortal as any, requireAdmin: requireAdmin as any, platformAdminOnly });
  return app;
}

async function get(app: express.Express, path: string) {
  const server = await new Promise<{ port: number; close: () => Promise<void> }>((resolve) => {
    const s = app.listen(0, () => {
      const port = (s.address() as { port: number }).port;
      resolve({ port, close: () => new Promise((r) => s.close(() => r(undefined))) });
    });
  });
  try {
    const res = await fetch(`http://127.0.0.1:${server.port}${path}`);
    const json = await res.json().catch(() => ({}));
    return { status: res.status, json };
  } finally {
    await server.close();
  }
}

beforeEach(() => {
  scanCalls = [];
  lensedCalls = [];
});
afterEach(() => vi.clearAllMocks());

describe("GET /api/portal/pressing-items — owner-portal hard gate", () => {
  it("returns an empty list even for a caller with owner-board-member + Treasurer signals", async () => {
    const app = makeApp();
    const { status, json } = await get(app, "/api/portal/pressing-items");
    expect(status).toBe(200);
    expect(json).toEqual({ items: [] });
  });

  it("never queries pressing_items on the portal path — no role-based lensing happens at all", async () => {
    const app = makeApp();
    await get(app, "/api/portal/pressing-items");
    expect(lensedCalls).toHaveLength(0);
    expect(scanCalls).toHaveLength(0);
  });
});

describe("POST /api/portal/pressing-items/:id/snooze — owner-portal hard gate", () => {
  it("returns 404 rather than mutating anything (nothing is ever shown to snooze)", async () => {
    const app = makeApp();
    const server = await new Promise<{ port: number; close: () => Promise<void> }>((resolve) => {
      const s = app.listen(0, () => {
        const port = (s.address() as { port: number }).port;
        resolve({ port, close: () => new Promise((r) => s.close(() => r(undefined))) });
      });
    });
    try {
      const res = await fetch(`http://127.0.0.1:${server.port}/api/portal/pressing-items/pi-1/snooze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ until: new Date().toISOString() }),
      });
      expect(res.status).toBe(404);
    } finally {
      await server.close();
    }
  });
});

describe("GET /api/admin/pressing-items — unaffected (Board mode continues to live here)", () => {
  it("still returns real items for the admin surface", async () => {
    const app = makeApp();
    const { status, json } = await get(app, "/api/admin/pressing-items?associationId=assoc-1");
    expect(status).toBe(200);
    expect(json.items).toHaveLength(1);
    expect(json.items[0].title).toContain("Luz Miranda");
    expect(lensedCalls).toHaveLength(1);
    expect(lensedCalls[0].actorRole).toBe("board");
  });
});
