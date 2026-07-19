/**
 * Records-requests tenant-isolation (A-AUTHZ-002).
 *
 * The module previously gated by ROLE only — every by-id route fetched by raw id
 * with no association check (cross-tenant IDOR), and the list returned ALL tenants.
 * These tests capture the production handlers and drive them with a mocked storage
 * layer to prove cross-tenant access is now denied and same-tenant still passes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocked storage: a records-request that belongs to TENANT B. vi.hoisted keeps
//    the mock fns defined before the hoisted vi.mock factory runs. ─────────────
const TENANT_B_REQUEST = { id: "rr1", associationId: "tenantB" };
const m = vi.hoisted(() => ({
  getRecordsRequest: vi.fn(),
  getRecordsRequests: vi.fn(async () => [] as any[]),
  getRecordsRequestItems: vi.fn(async () => [] as any[]),
  updateRecordsRequest: vi.fn(async () => ({ id: "rr1", associationId: "tenantB" } as any)),
  createRecordsRequest: vi.fn(async (data: any) => ({ id: "new", ...data })),
}));
const { getRecordsRequest, getRecordsRequests, updateRecordsRequest, createRecordsRequest } = m;
vi.mock("../../storage", () => ({ storage: m }));
vi.mock("../../services/records-retention-service", () => ({
  computeResponseDueDate: () => new Date("2026-01-08"),
  computeCopyFeeCents: () => 0,
  computeIncludedFlag: () => 1,
  filterDisclosableRecords: () => ({ disclosed: [], withheld: [] }),
}));

import { registerRecordsRequestRoutes } from "../records-requests";

// ── Handler-capture fake app (tests the route handler in isolation; the auth
//    middleware is applied at wire-time and its scope fields are set on req). ──
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
  const h = handlers.get(key)!;
  const res = fakeRes();
  await h({ query: {}, params: {}, body: {}, ...req }, res);
  return res;
}

beforeEach(() => {
  handlers.clear();
  vi.clearAllMocks();
  getRecordsRequest.mockResolvedValue(TENANT_B_REQUEST as any);
  registerRecordsRequestRoutes(fakeApp(), passthrough as any, roleFactory as any);
});
afterEach(() => vi.restoreAllMocks());

const tenantAmgr = { adminRole: "manager", adminScopedAssociationIds: ["tenantA"] };
const tenantBmgr = { adminRole: "manager", adminScopedAssociationIds: ["tenantB"] };
const platform = { adminRole: "platform-admin", adminScopedAssociationIds: [] };

describe("records-requests IDOR (A-AUTHZ-002)", () => {
  it("tenant A admin GET /:id of a tenant B request → 404 (no cross-tenant access)", async () => {
    const res = await invoke("GET /api/records-requests/:id", { params: { id: "rr1" }, ...tenantAmgr });
    expect(res._s).toBe(404);
  });

  it("tenant B admin GET /:id of their own request → 200", async () => {
    const res = await invoke("GET /api/records-requests/:id", { params: { id: "rr1" }, ...tenantBmgr });
    expect(res._s).toBe(200);
    expect(res._j.request.id).toBe("rr1");
  });

  it("tenant A admin PATCH of a tenant B request → 404 (denied, no mutation)", async () => {
    const res = await invoke("PATCH /api/records-requests/:id", { params: { id: "rr1" }, body: { status: "closed" }, ...tenantAmgr });
    expect(res._s).toBe(404);
    expect(updateRecordsRequest).not.toHaveBeenCalled();
  });

  it("GET list without associationId does NOT return all tenants for a non-platform admin", async () => {
    await invoke("GET /api/records-requests", { ...tenantBmgr }); // single scope → defaults to tenantB
    expect(getRecordsRequests).toHaveBeenCalledWith("tenantB");
  });

  it("GET list: multi-scope admin without associationId → 403 (must specify)", async () => {
    const res = await invoke("GET /api/records-requests", { adminRole: "manager", adminScopedAssociationIds: ["tenantA", "tenantB"] });
    expect(res._s).toBe(403);
    expect(getRecordsRequests).not.toHaveBeenCalled();
  });

  it("POST cannot create a request in a non-scoped association", async () => {
    const res = await invoke("POST /api/records-requests", { body: { associationId: "tenantB", receivedAt: "2026-01-01" }, ...tenantAmgr });
    expect(res._s).toBe(403);
    expect(createRecordsRequest).not.toHaveBeenCalled();
  });

  it("platform-admin retains cross-tenant access", async () => {
    const res = await invoke("GET /api/records-requests/:id", { params: { id: "rr1" }, ...platform });
    expect(res._s).toBe(200);
  });
});
