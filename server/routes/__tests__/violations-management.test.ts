/**
 * Route-level tests for the Violations MANAGEMENT surface
 * (founder-os#10569, YCM Redesign M8).
 *
 * Focus: the ROUTE wiring (feature-flag gate + role gating + error→HTTP
 * mapping) with the service mocked — mirrors server/routes/__tests__/arc.test.ts.
 * Proves:
 *   - VIOLATIONS_MANAGEMENT_ENABLED off -> every route 404s BEFORE the
 *     service runs (the flag-gate this whole module exists behind);
 *   - flag on -> read roles (incl. viewer) can list/get, write roles
 *     (manager/board-officer/…) can send a notice / transition status;
 *   - a `viewer` (read-only role) CANNOT send a notice or transition status
 *     (403, service never called);
 *   - the service's NOT_FOUND / INVALID_TRANSITION errors map through the
 *     route to 404 / 409;
 *   - bad request bodies (zod) map to 400 BEFORE the service runs.
 */
import express, { type NextFunction, type Request, type Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => {
  class ViolationsManagementError extends Error {
    constructor(message: string, public readonly code: string, public readonly httpStatus = 400) {
      super(message);
      this.name = "ViolationsManagementError";
    }
  }
  return {
    listViolationsForManagement: vi.fn(),
    getViolationDetail: vi.fn(),
    sendViolationNotice: vi.fn(),
    transitionViolationStatus: vi.fn(),
    ViolationsManagementError,
  };
});

const ViolationsManagementError = H.ViolationsManagementError;

vi.mock("../../services/violations-management-service", () => ({
  listViolationsForManagement: H.listViolationsForManagement,
  getViolationDetail: H.getViolationDetail,
  sendViolationNotice: H.sendViolationNotice,
  transitionViolationStatus: H.transitionViolationStatus,
  ViolationsManagementError: H.ViolationsManagementError,
}));

// The flag defaults OFF; each describe block sets it explicitly so tests
// never depend on ambient env state (and never leak into one another).
const FLAG_ENV_KEY = "FEATURE_FLAG_VIOLATIONS_MANAGEMENT_ENABLED";

import { registerViolationsManagementRoutes } from "../violations-management";

function makeApp(opts?: { role?: string }) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.adminUserId = "admin-1";
    req.adminUserEmail = "manager@example.com";
    req.adminRole = opts?.role ?? "manager";
    next();
  });

  const requireAdmin = (_req: Request, _res: Response, next: NextFunction) => next();
  const requireAdminRole =
    (roles: string[]) =>
    (req: any, res: Response, next: NextFunction) => {
      if (!req.adminRole || !roles.includes(req.adminRole)) {
        return res.status(403).json({ error: "forbidden", code: "ADMIN_ROLE_FORBIDDEN" });
      }
      return next();
    };
  const getAssociationIdQuery = (req: Request) =>
    typeof req.query.associationId === "string" ? req.query.associationId : undefined;

  registerViolationsManagementRoutes(app, {
    requireAdmin,
    requireAdminRole: requireAdminRole as any,
    getAssociationIdQuery,
  });
  return app;
}

async function withApp<T>(
  opts: Parameters<typeof makeApp>[0],
  fn: (url: string) => Promise<T>,
): Promise<T> {
  const app = makeApp(opts);
  const server = await new Promise<{ port: number; close: () => Promise<void> }>((resolve, reject) => {
    const s = app.listen(0, () => {
      const port = (s.address() as { port: number }).port;
      resolve({ port, close: () => new Promise((r) => s.close(() => r(undefined))) });
    });
    s.on("error", reject);
  });
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
  delete process.env[FLAG_ENV_KEY];
});
afterEach(() => {
  vi.clearAllMocks();
  delete process.env[FLAG_ENV_KEY];
});

describe("feature-flag gate — VIOLATIONS_MANAGEMENT_ENABLED off (default)", () => {
  it("GET /api/violations/management/:id 404s before the service runs", async () => {
    const res = await withApp({}, (url) => fetch(`${url}/api/violations/management/v1?associationId=a1`));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("NOT_FOUND");
    expect(H.getViolationDetail).not.toHaveBeenCalled();
  });

  it("POST .../notices 404s before the service runs", async () => {
    const res = await withApp({}, (url) =>
      fetch(`${url}/api/violations/management/v1/notices?associationId=a1`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(404);
    expect(H.sendViolationNotice).not.toHaveBeenCalled();
  });

  it("POST .../status 404s before the service runs", async () => {
    const res = await withApp({}, (url) =>
      fetch(`${url}/api/violations/management/v1/status?associationId=a1`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "cured" }),
      }),
    );
    expect(res.status).toBe(404);
    expect(H.transitionViolationStatus).not.toHaveBeenCalled();
  });

  it("GET /api/violations/management (list) with an associationId 404s (empty query still returns [] with no associationId)", async () => {
    const res = await withApp({}, (url) => fetch(`${url}/api/violations/management?associationId=a1`));
    expect(res.status).toBe(404);
    expect(H.listViolationsForManagement).not.toHaveBeenCalled();
  });

  it("GET /api/violations/management with NO associationId returns empty result, not 404 (mirrors the pre-existing GET /api/violations convention)", async () => {
    const res = await withApp({}, (url) => fetch(`${url}/api/violations/management`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ violations: [], stats: { open: 0, openOver30Days: 0, noticeSent: 0, escalated: 0, curedLast30Days: 0 } });
  });
});

describe("flag on — role gating + happy paths", () => {
  beforeEach(() => {
    process.env[FLAG_ENV_KEY] = "true";
  });

  it("viewer (read role) CAN list violations (200)", async () => {
    H.listViolationsForManagement.mockResolvedValue({ violations: [], stats: { open: 0, openOver30Days: 0, noticeSent: 0, escalated: 0, curedLast30Days: 0 } });
    const res = await withApp({ role: "viewer" }, (url) => fetch(`${url}/api/violations/management?associationId=a1`));
    expect(res.status).toBe(200);
    expect(H.listViolationsForManagement).toHaveBeenCalledWith("a1");
  });

  it("viewer CANNOT send a notice (403, service never called)", async () => {
    const res = await withApp({ role: "viewer" }, (url) =>
      fetch(`${url}/api/violations/management/v1/notices?associationId=a1`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(403);
    expect(H.sendViolationNotice).not.toHaveBeenCalled();
  });

  it("a manager CAN send a notice (201) and the parsed body reaches the service", async () => {
    H.sendViolationNotice.mockResolvedValue({ violation: { id: "v1", status: "notice-sent" }, event: { id: "e1" } });
    const res = await withApp({ role: "manager" }, (url) =>
      fetch(`${url}/api/violations/management/v1/notices?associationId=a1`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channel: "email", note: "final warning" }),
      }),
    );
    expect(res.status).toBe(201);
    expect(H.sendViolationNotice).toHaveBeenCalledWith("v1", "a1", { channel: "email", note: "final warning" }, "manager@example.com");
  });

  it("a board-officer CAN transition status (200)", async () => {
    H.transitionViolationStatus.mockResolvedValue({ violation: { id: "v1", status: "cured" }, event: { id: "e2" } });
    const res = await withApp({ role: "board-officer" }, (url) =>
      fetch(`${url}/api/violations/management/v1/status?associationId=a1`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "cured" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(H.transitionViolationStatus).toHaveBeenCalledWith("v1", "a1", "cured", undefined, "manager@example.com");
  });

  it("an invalid status in the body 400s BEFORE the service runs (zod)", async () => {
    const res = await withApp({ role: "manager" }, (url) =>
      fetch(`${url}/api/violations/management/v1/status?associationId=a1`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "not-a-real-status" }),
      }),
    );
    expect(res.status).toBe(400);
    expect(H.transitionViolationStatus).not.toHaveBeenCalled();
  });

  it("GET detail for a missing violation maps the service's NOT_FOUND to 404", async () => {
    H.getViolationDetail.mockRejectedValue(new ViolationsManagementError("Violation not found", "NOT_FOUND", 404));
    const res = await withApp({ role: "manager" }, (url) => fetch(`${url}/api/violations/management/nope?associationId=a1`));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("NOT_FOUND");
  });

  it("an illegal status transition maps the service's INVALID_TRANSITION to 409", async () => {
    H.transitionViolationStatus.mockRejectedValue(
      new ViolationsManagementError('Cannot move a violation from "closed" to "escalated"', "INVALID_TRANSITION", 409),
    );
    const res = await withApp({ role: "manager" }, (url) =>
      fetch(`${url}/api/violations/management/v1/status?associationId=a1`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "escalated" }),
      }),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("INVALID_TRANSITION");
  });
});
