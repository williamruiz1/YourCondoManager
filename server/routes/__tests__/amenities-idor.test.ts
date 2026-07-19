/**
 * Amenities tenant-isolation (A-AUTHZ-003).
 *
 * The admin routes previously trusted a raw client `associationId` on the list and
 * queried every by-id amenity/reservation/block handler with no association gate
 * (cross-tenant IDOR — including reservation edits that move deposit MONEY). These
 * tests capture the handlers and drive them against a mocked db to prove a
 * tenant-A admin cannot reach tenant-B amenities/reservations, and platform-admin
 * still can.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Thenable-chain db mock (via vi.hoisted so it exists before the hoisted
//    vi.mock factory). `await db.select()...where()` shifts the next queued result;
//    the first queued value is the association-id lookup the guard reads. ────────
const H = vi.hoisted(() => {
  const state = { queue: [] as any[] };
  function chain(): any {
    const c: any = { then: (resolve: any) => resolve(state.queue.length ? state.queue.shift() : []) };
    for (const mm of ["from", "where", "orderBy", "innerJoin", "leftJoin", "set", "values", "returning", "limit", "groupBy"]) {
      c[mm] = () => chain();
    }
    return c;
  }
  return {
    state,
    db: { select: () => chain(), update: () => chain(), insert: () => chain(), delete: () => chain() },
  };
});
function setQueue(q: any[]) { H.state.queue = q; }
vi.mock("../../db", () => ({ db: H.db }));
vi.mock("../../services/amenity-money-service", () => ({
  captureAmenityBookingMoney: vi.fn(async () => ({ mutated: false })),
  resolveAmenityDeposit: vi.fn(async () => ({ mutated: false })),
}));

import { registerAmenityRoutes } from "../amenities";

type Handler = (req: any, res: any) => any;
const handlers = new Map<string, Handler>();
function fakeApp() {
  const app: any = {};
  for (const m of ["get", "post", "patch", "delete", "put"]) {
    app[m] = (path: string, ...hs: Handler[]) => handlers.set(`${m.toUpperCase()} ${path}`, hs[hs.length - 1]);
  }
  return app;
}
const passthrough = (_req: any, _res: any, next?: any) => (next ? next() : undefined);
const roleFactory = () => passthrough;
function fakeRes() {
  return { _s: 200, _j: undefined as any, status(c: number) { this._s = c; return this; }, json(b: any) { this._j = b; return this; } };
}
async function invoke(key: string, req: any) {
  const res = fakeRes();
  await handlers.get(key)!({ query: {}, params: {}, body: {}, ...req }, res);
  return res;
}

beforeEach(() => {
  handlers.clear();
  setQueue([]);
  registerAmenityRoutes(fakeApp(), passthrough as any, roleFactory as any, passthrough as any);
});
afterEach(() => vi.restoreAllMocks());

const tenantAmgr = { adminRole: "manager", adminScopedAssociationIds: ["tenantA"] };
const tenantBmgr = { adminRole: "manager", adminScopedAssociationIds: ["tenantB"] };
const platform = { adminRole: "platform-admin", adminScopedAssociationIds: [] };

/** Queue: the by-id association lookup resolves to tenant B, then any main query. */
function ownedByTenantB() { setQueue([[{ associationId: "tenantB" }], []]); }

describe("amenities IDOR (A-AUTHZ-003)", () => {
  it("tenant A admin GET ?associationId=tenantB → 403 (raw client id no longer trusted)", async () => {
    const res = await invoke("GET /api/amenities", { query: { associationId: "tenantB" }, ...tenantAmgr });
    expect(res._s).toBe(403);
  });

  it("tenant A admin PATCH /:id of a tenant B amenity → 404 (denied)", async () => {
    ownedByTenantB();
    const res = await invoke("PATCH /api/amenities/:id", { params: { id: "am1" }, body: { name: "x" }, ...tenantAmgr });
    expect(res._s).toBe(404);
  });

  it("tenant A admin DELETE /:id of a tenant B amenity → 404 (denied)", async () => {
    ownedByTenantB();
    const res = await invoke("DELETE /api/amenities/:id", { params: { id: "am1" }, ...tenantAmgr });
    expect(res._s).toBe(404);
  });

  it("tenant A admin GET /:id/reservations of a tenant B amenity → 404 (denied)", async () => {
    ownedByTenantB();
    const res = await invoke("GET /api/amenities/:id/reservations", { params: { id: "am1" }, ...tenantAmgr });
    expect(res._s).toBe(404);
  });

  it("tenant A admin PATCH a tenant B reservation (deposit MONEY) → 404 (denied)", async () => {
    ownedByTenantB();
    const res = await invoke("PATCH /api/amenity-reservations/:id", { params: { id: "rv1" }, body: { status: "approved" }, ...tenantAmgr });
    expect(res._s).toBe(404);
  });

  it("tenant B admin PATCH their OWN reservation → 200 (same-tenant still works)", async () => {
    setQueue([[{ associationId: "tenantB" }], [{ id: "rv1", status: "approved" }]]);
    const res = await invoke("PATCH /api/amenity-reservations/:id", { params: { id: "rv1" }, body: { status: "approved" }, ...tenantBmgr });
    expect(res._s).toBe(200);
  });

  it("platform-admin retains cross-tenant amenity access", async () => {
    // lookup → tenantB; then the UPDATE returns the row (platform-admin passes the gate).
    setQueue([[{ associationId: "tenantB" }], [{ id: "am1", name: "x", associationId: "tenantB" }]]);
    const res = await invoke("PATCH /api/amenities/:id", { params: { id: "am1" }, body: { name: "x" }, ...platform });
    expect(res._s).toBe(200);
  });
});
