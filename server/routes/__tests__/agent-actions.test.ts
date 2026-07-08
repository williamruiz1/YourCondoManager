/**
 * Route-level tests for the YCM agent-action surface (founder-os#9474).
 *
 * Focus: route wiring, role guards, and error→HTTP mapping. The service is
 * mocked here (the ladder logic is exercised directly in
 * agent-action-service.test.ts); this asserts the endpoints call the service
 * correctly and map AgentActionError codes to the right HTTP status.
 */
import express, { type NextFunction, type Request, type Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => {
  class AgentActionError extends Error {
    constructor(message: string, public readonly code: string, public readonly httpStatus: number = 400) {
      super(message);
      this.name = "AgentActionError";
    }
  }
  return {
    fileAction: vi.fn(),
    approveAction: vi.fn(),
    rejectAction: vi.fn(),
    executeAction: vi.fn(),
    listQueue: vi.fn(),
    getAuditLog: vi.fn(),
    AgentActionError,
  };
});

vi.mock("../../services/agent-action-service", () => ({
  fileAction: H.fileAction,
  approveAction: H.approveAction,
  rejectAction: H.rejectAction,
  executeAction: H.executeAction,
  listQueue: H.listQueue,
  getAuditLog: H.getAuditLog,
  AgentActionError: H.AgentActionError,
}));

import { registerAgentActionRoutes } from "../agent-actions";

function makeApp(opts?: { role?: string; adminUserId?: string }) {
  const app = express();
  app.use(express.json());
  app.use((req: Request & { adminUserId?: string; adminUserEmail?: string; adminRole?: string }, _res, next) => {
    req.adminUserId = opts?.adminUserId ?? "admin-1";
    req.adminUserEmail = "a@example.com";
    req.adminRole = opts?.role ?? "platform-admin";
    next();
  });
  const requireAdmin = (_req: Request, _res: Response, next: NextFunction) => next();
  const requireAdminRole =
    (roles: string[]) => (req: Request & { adminRole?: string }, res: Response, next: NextFunction) => {
      if (!req.adminRole || !roles.includes(req.adminRole)) {
        return res.status(403).json({ error: "forbidden", code: "ADMIN_ROLE_FORBIDDEN" });
      }
      return next();
    };
  const getAssociationIdQuery = (req: Request) =>
    typeof req.query.associationId === "string" ? req.query.associationId : undefined;
  const assertAssociationScope = () => {
    /* allow in tests */
  };
  registerAgentActionRoutes(app, {
    requireAdmin,
    requireAdminRole: requireAdminRole as any,
    getAssociationIdQuery,
    assertAssociationScope: assertAssociationScope as any,
  });
  return app;
}

async function withApp<T>(opts: { role?: string; adminUserId?: string } | undefined, fn: (url: string) => Promise<T>): Promise<T> {
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
});
afterEach(() => vi.clearAllMocks());

describe("POST /api/agent/actions — file an action", () => {
  it("viewer cannot file an action (403)", async () => {
    const res = await withApp({ role: "viewer" }, (url) =>
      fetch(`${url}/api/agent/actions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ associationId: "assoc-1", actionType: "suggest.summary", reasoning: "x", createdByAgent: "cos" }),
      }),
    );
    expect(res.status).toBe(403);
    expect(H.fileAction).not.toHaveBeenCalled();
  });

  it("board-officer files an action → 201 with the created action", async () => {
    H.fileAction.mockResolvedValue({ id: "act-1", level: "L1", status: "queued" });
    const res = await withApp({ role: "board-officer" }, (url) =>
      fetch(`${url}/api/agent/actions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ associationId: "assoc-1", actionType: "suggest.summary", reasoning: "found a duplicate charge", createdByAgent: "ycm-cos" }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.action.id).toBe("act-1");
    expect(H.fileAction).toHaveBeenCalledWith(expect.objectContaining({ associationId: "assoc-1", actionType: "suggest.summary", createdByAgent: "ycm-cos" }));
  });

  it("rejects invalid input (missing reasoning) with 400", async () => {
    const res = await withApp(undefined, (url) =>
      fetch(`${url}/api/agent/actions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ associationId: "assoc-1", actionType: "suggest.summary", createdByAgent: "cos" }),
      }),
    );
    expect(res.status).toBe(400);
    expect(H.fileAction).not.toHaveBeenCalled();
  });
});

describe("POST /api/agent/actions/:id/approve — approval + board gate", () => {
  it("maps a BOARD_APPROVAL_REQUIRED service error to 403", async () => {
    H.approveAction.mockRejectedValue(new H.AgentActionError("L4 requires a board-level approver", "BOARD_APPROVAL_REQUIRED", 403));
    const res = await withApp({ role: "manager" }, (url) =>
      fetch(`${url}/api/agent/actions/act-9/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ associationId: "assoc-1" }),
      }),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("BOARD_APPROVAL_REQUIRED");
  });

  it("passes the approver role through to the service", async () => {
    H.approveAction.mockResolvedValue({ id: "act-9", status: "approved" });
    await withApp({ role: "board-officer", adminUserId: "admin-7" }, (url) =>
      fetch(`${url}/api/agent/actions/act-9/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ associationId: "assoc-1" }),
      }),
    );
    expect(H.approveAction).toHaveBeenCalledWith("act-9", "assoc-1", expect.objectContaining({ adminUserId: "admin-7", role: "board-officer" }));
  });
});

describe("POST /api/agent/actions/:id/execute — gate mapping", () => {
  it("maps APPROVAL_REQUIRED (409) from the gate", async () => {
    H.executeAction.mockRejectedValue(new H.AgentActionError("L3 requires approval", "APPROVAL_REQUIRED", 409));
    const res = await withApp(undefined, (url) =>
      fetch(`${url}/api/agent/actions/act-3/execute`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ associationId: "assoc-1" }),
      }),
    );
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("APPROVAL_REQUIRED");
  });
});

describe("GET /api/agent/queue — the surface", () => {
  it("viewer CAN read the queue (200)", async () => {
    H.listQueue.mockResolvedValue([{ id: "a", reasoning: "why", severity: "high" }]);
    const res = await withApp({ role: "viewer" }, (url) => fetch(`${url}/api/agent/queue?associationId=assoc-1`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.queue[0].reasoning).toBe("why");
    expect(H.listQueue).toHaveBeenCalledWith("assoc-1", expect.any(Object));
  });

  it("400 when associationId is missing", async () => {
    const res = await withApp(undefined, (url) => fetch(`${url}/api/agent/queue`));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/agent/actions/:id/audit — immutable trail", () => {
  it("returns the audit log for the action", async () => {
    H.getAuditLog.mockResolvedValue([{ id: "e1", event: "filed" }, { id: "e2", event: "executed" }]);
    const res = await withApp({ role: "viewer" }, (url) => fetch(`${url}/api/agent/actions/act-1/audit?associationId=assoc-1`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.audit.map((e: any) => e.event)).toEqual(["filed", "executed"]);
  });
});
