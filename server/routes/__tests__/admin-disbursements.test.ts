/**
 * Route-level tests for the admin disbursement dual-approval surface —
 * HOA Remediation Phase 2.
 *
 * Focus: role gating (only money-OUT WRITE roles can create/approve) + the
 * maker≠checker control surfaced end-to-end through the route (a 403
 * SELF_APPROVAL_FORBIDDEN when the creator tries to approve). The underlying
 * service is exercised directly in disbursement-service.test.ts; here we mock
 * the service to assert the route wiring, role guards, and error→HTTP mapping.
 */
import express, { type NextFunction, type Request, type Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock the service so we test the ROUTE (guards + error mapping) ────────────
const H = vi.hoisted(() => {
  class DisbursementError extends Error {
    constructor(message: string, public readonly code: string) {
      super(message);
      this.name = "DisbursementError";
    }
  }
  return {
    createDisbursement: vi.fn(),
    approveDisbursement: vi.fn(),
    rejectDisbursement: vi.fn(),
    submitDisbursement: vi.fn(),
    markDisbursementPaid: vi.fn(),
    listDisbursements: vi.fn(),
    DisbursementError,
  };
});

const DisbursementError = H.DisbursementError;

vi.mock("../../services/disbursement-service", () => ({
  createDisbursement: H.createDisbursement,
  approveDisbursement: H.approveDisbursement,
  rejectDisbursement: H.rejectDisbursement,
  submitDisbursement: H.submitDisbursement,
  markDisbursementPaid: H.markDisbursementPaid,
  listDisbursements: H.listDisbursements,
  DisbursementError: H.DisbursementError,
}));

import { registerAdminDisbursementRoutes } from "../admin-disbursements";

function makeApp(opts?: { role?: string; adminUserId?: string }) {
  const app = express();
  app.use(express.json());
  app.use(
    (
      req: Request & { adminUserId?: string; adminUserEmail?: string; adminRole?: string },
      _res,
      next,
    ) => {
      req.adminUserId = opts?.adminUserId ?? "admin-1";
      req.adminUserEmail = "a@example.com";
      req.adminRole = opts?.role ?? "platform-admin";
      next();
    },
  );

  const requireAdmin = (_req: Request, _res: Response, next: NextFunction) => next();
  const requireAdminRole =
    (roles: string[]) =>
    (req: Request & { adminRole?: string }, res: Response, next: NextFunction) => {
      if (!req.adminRole || !roles.includes(req.adminRole)) {
        return res.status(403).json({ error: "forbidden", code: "ADMIN_ROLE_FORBIDDEN" });
      }
      return next();
    };
  const getAssociationIdQuery = (req: Request) =>
    typeof req.query.associationId === "string" ? req.query.associationId : undefined;
  const assertAssociationScope = () => {
    /* allow */
  };

  registerAdminDisbursementRoutes(app, {
    requireAdmin,
    requireAdminRole: requireAdminRole as any,
    getAssociationIdQuery,
    assertAssociationScope: assertAssociationScope as any,
  });
  return app;
}

async function withApp<T>(
  opts: { role?: string; adminUserId?: string } | undefined,
  fn: (url: string) => Promise<T>,
): Promise<T> {
  const app = makeApp(opts);
  const server = await new Promise<{ port: number; close: () => Promise<void> }>(
    (resolve, reject) => {
      const s = app.listen(0, () => {
        const port = (s.address() as { port: number }).port;
        resolve({ port, close: () => new Promise((r) => s.close(() => r(undefined))) });
      });
      s.on("error", reject);
    },
  );
  try {
    return await fn(`http://127.0.0.1:${server.port}`);
  } finally {
    await server.close();
  }
}

beforeEach(() => {
  for (const fn of Object.values(H)) {
    if (typeof (fn as any)?.mockReset === "function") (fn as any).mockReset();
  }
});
afterEach(() => vi.clearAllMocks());

describe("role gating", () => {
  it("viewer cannot create a disbursement (403)", async () => {
    const res = await withApp({ role: "viewer" }, (url) =>
      fetch(`${url}/api/admin/disbursements`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ associationId: "a1", vendorName: "V", amountCents: 100 }),
      }),
    );
    expect(res.status).toBe(403);
    expect(H.createDisbursement).not.toHaveBeenCalled();
  });

  it("pm-assistant cannot approve a disbursement (403)", async () => {
    const res = await withApp({ role: "pm-assistant" }, (url) =>
      fetch(`${url}/api/admin/disbursements/d1/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ associationId: "a1" }),
      }),
    );
    expect(res.status).toBe(403);
    expect(H.approveDisbursement).not.toHaveBeenCalled();
  });

  it("board-officer CAN create a disbursement (201)", async () => {
    H.createDisbursement.mockResolvedValue({ id: "d1", status: "pending-approval" });
    const res = await withApp({ role: "board-officer" }, (url) =>
      fetch(`${url}/api/admin/disbursements`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ associationId: "a1", vendorName: "Acme", amountCents: 5000 }),
      }),
    );
    expect(res.status).toBe(201);
    expect(H.createDisbursement).toHaveBeenCalledOnce();
    // The maker identity is passed through from the request.
    expect(H.createDisbursement.mock.calls[0][1]).toMatchObject({ adminUserId: "admin-1" });
  });

  it("viewer CAN read the disbursement list (200)", async () => {
    H.listDisbursements.mockResolvedValue([]);
    const res = await withApp({ role: "viewer" }, (url) =>
      fetch(`${url}/api/admin/disbursements?associationId=a1`),
    );
    expect(res.status).toBe(200);
  });
});

describe("maker ≠ checker surfaced through the route", () => {
  it("maps SELF_APPROVAL_FORBIDDEN to 403", async () => {
    H.approveDisbursement.mockRejectedValue(
      new DisbursementError("cannot approve your own", "SELF_APPROVAL_FORBIDDEN"),
    );
    const res = await withApp({ role: "board-officer" }, (url) =>
      fetch(`${url}/api/admin/disbursements/d1/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ associationId: "a1" }),
      }),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("SELF_APPROVAL_FORBIDDEN");
  });

  it("maps INVALID_TRANSITION to 409", async () => {
    H.markDisbursementPaid.mockRejectedValue(
      new DisbursementError("cannot pay a pending", "INVALID_TRANSITION"),
    );
    const res = await withApp({ role: "manager" }, (url) =>
      fetch(`${url}/api/admin/disbursements/d1/pay`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ associationId: "a1" }),
      }),
    );
    expect(res.status).toBe(409);
  });

  it("maps NOT_FOUND to 404", async () => {
    H.approveDisbursement.mockRejectedValue(
      new DisbursementError("not found", "NOT_FOUND"),
    );
    const res = await withApp({ role: "board-officer" }, (url) =>
      fetch(`${url}/api/admin/disbursements/nope/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ associationId: "a1" }),
      }),
    );
    expect(res.status).toBe(404);
  });

  it("passes the CHECKER identity to approve (so the service can compare maker≠checker)", async () => {
    H.approveDisbursement.mockResolvedValue({ id: "d1", status: "approved" });
    await withApp({ role: "board-officer", adminUserId: "admin-checker" }, (url) =>
      fetch(`${url}/api/admin/disbursements/d1/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ associationId: "a1" }),
      }),
    );
    expect(H.approveDisbursement).toHaveBeenCalledOnce();
    // (id, associationId, actor)
    expect(H.approveDisbursement.mock.calls[0][2]).toMatchObject({
      adminUserId: "admin-checker",
    });
  });
});
