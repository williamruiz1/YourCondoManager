/**
 * Route-level tests for the ARC workflow surface — founder-os dispatch #9481.
 *
 * Focus: the ROUTE wiring (guards + role gating + error→HTTP mapping) with the
 * service mocked. Proves:
 *   - only committee (board-officer / platform-admin) roles can hit the decision
 *     endpoint; other roles get 403 BEFORE the service runs;
 *   - the service's L4 gate (AGENT_DECISION_FORBIDDEN / BOARD_APPROVAL_REQUIRED)
 *     maps to 403 through the route;
 *   - the portal owner-submit + non-owner-appeal paths behave.
 */
import express, { type NextFunction, type Request, type Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => {
  class ArcError extends Error {
    constructor(message: string, public readonly code: string) {
      super(message);
      this.name = "ArcError";
    }
  }
  return {
    submitArcRequest: vi.fn(),
    routeArcRequest: vi.fn(),
    recordArcDecision: vi.fn(),
    appealArcDenial: vi.fn(),
    recordAppealDecision: vi.fn(),
    getArcRequest: vi.fn(),
    listArcRequests: vi.fn(),
    ArcError,
  };
});

const ArcError = H.ArcError;

vi.mock("../../services/arc-service", () => ({
  submitArcRequest: H.submitArcRequest,
  routeArcRequest: H.routeArcRequest,
  recordArcDecision: H.recordArcDecision,
  appealArcDenial: H.appealArcDenial,
  recordAppealDecision: H.recordAppealDecision,
  getArcRequest: H.getArcRequest,
  listArcRequests: H.listArcRequests,
  ArcError: H.ArcError,
}));

import { registerArcRoutes } from "../arc";

function makeApp(opts?: {
  role?: string;
  adminUserId?: string;
  portalPersonId?: string;
  portalAssociationId?: string;
}) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.adminUserId = opts?.adminUserId ?? "admin-1";
    req.adminUserEmail = "a@example.com";
    req.adminRole = opts?.role ?? "platform-admin";
    req.portalAssociationId = opts?.portalAssociationId ?? "assoc-1";
    req.portalPersonId = opts?.portalPersonId ?? "person-1";
    req.portalEmail = "owner@example.com";
    req.portalUnitId = "unit-1";
    next();
  });

  const requireAdmin = (_req: Request, _res: Response, next: NextFunction) => next();
  const requirePortal = (_req: Request, _res: Response, next: NextFunction) => next();
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
  const assertAssociationScope = () => {
    /* allow */
  };

  registerArcRoutes(app, {
    requireAdmin,
    requireAdminRole: requireAdminRole as any,
    requirePortal,
    getAssociationIdQuery,
    assertAssociationScope: assertAssociationScope as any,
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
});
afterEach(() => vi.clearAllMocks());

describe("role gating — intake + decision", () => {
  it("viewer cannot submit an ARC request (403)", async () => {
    const res = await withApp({ role: "viewer" }, (url) =>
      fetch(`${url}/api/admin/arc/requests`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ associationId: "a1", title: "Fence", description: "New fence" }),
      }),
    );
    expect(res.status).toBe(403);
    expect(H.submitArcRequest).not.toHaveBeenCalled();
  });

  it("assisted-board CAN submit (201)", async () => {
    H.submitArcRequest.mockResolvedValue({ id: "arc-1", status: "submitted" });
    const res = await withApp({ role: "assisted-board" }, (url) =>
      fetch(`${url}/api/admin/arc/requests`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ associationId: "a1", title: "Fence", description: "New fence" }),
      }),
    );
    expect(res.status).toBe(201);
    expect(H.submitArcRequest).toHaveBeenCalledOnce();
  });

  it("a manager (non-committee) cannot record a decision (403 — route gate)", async () => {
    const res = await withApp({ role: "manager" }, (url) =>
      fetch(`${url}/api/admin/arc/requests/arc-1/decision`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ associationId: "a1", decision: "denied", reason: "no" }),
      }),
    );
    expect(res.status).toBe(403);
    expect(H.recordArcDecision).not.toHaveBeenCalled();
  });

  it("a board-officer CAN reach the decision endpoint (200) + the checker identity is passed", async () => {
    H.recordArcDecision.mockResolvedValue({ id: "arc-1", status: "denied" });
    const res = await withApp({ role: "board-officer", adminUserId: "admin-board" }, (url) =>
      fetch(`${url}/api/admin/arc/requests/arc-1/decision`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ associationId: "a1", decision: "denied", reason: "Covenant." }),
      }),
    );
    expect(res.status).toBe(200);
    expect(H.recordArcDecision).toHaveBeenCalledOnce();
    // (id, associationId, decision, reason, actor)
    expect(H.recordArcDecision.mock.calls[0][4]).toMatchObject({
      actorType: "human",
      adminUserId: "admin-board",
      role: "board-officer",
    });
  });

  it("viewer CAN read the ARC list (200)", async () => {
    H.listArcRequests.mockResolvedValue([]);
    const res = await withApp({ role: "viewer" }, (url) =>
      fetch(`${url}/api/admin/arc/requests?associationId=a1`),
    );
    expect(res.status).toBe(200);
  });
});

describe("L4 gate surfaced through the route (service error → HTTP)", () => {
  it("maps AGENT_DECISION_FORBIDDEN to 403", async () => {
    H.recordArcDecision.mockRejectedValue(
      new ArcError("agent cannot deny", "AGENT_DECISION_FORBIDDEN"),
    );
    const res = await withApp({ role: "board-officer" }, (url) =>
      fetch(`${url}/api/admin/arc/requests/arc-1/decision`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ associationId: "a1", decision: "denied", reason: "x" }),
      }),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("AGENT_DECISION_FORBIDDEN");
  });

  it("maps INVALID_TRANSITION to 409", async () => {
    H.recordArcDecision.mockRejectedValue(new ArcError("bad state", "INVALID_TRANSITION"));
    const res = await withApp({ role: "platform-admin" }, (url) =>
      fetch(`${url}/api/admin/arc/requests/arc-1/decision`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ associationId: "a1", decision: "approved", reason: "ok" }),
      }),
    );
    expect(res.status).toBe(409);
  });

  it("maps NOT_FOUND to 404", async () => {
    H.getArcRequest.mockRejectedValue(new ArcError("nope", "NOT_FOUND"));
    const res = await withApp({ role: "board-officer" }, (url) =>
      fetch(`${url}/api/admin/arc/requests/nope?associationId=a1`),
    );
    expect(res.status).toBe(404);
  });
});

describe("portal (owner) surface", () => {
  it("owner submits via portal (201) with session-derived association + person", async () => {
    H.submitArcRequest.mockResolvedValue({ id: "arc-9", status: "submitted" });
    const res = await withApp({ portalPersonId: "person-1", portalAssociationId: "assoc-1" }, (url) =>
      fetch(`${url}/api/portal/arc/requests`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Deck", description: "New rear deck." }),
      }),
    );
    expect(res.status).toBe(201);
    // association + person come from the session, NEVER the body.
    expect(H.submitArcRequest.mock.calls[0][0]).toMatchObject({
      associationId: "assoc-1",
      submittedByPersonId: "person-1",
      submittedByType: "owner",
    });
  });

  it("owner cannot appeal a request they do not own (403 NOT_OWNER)", async () => {
    H.getArcRequest.mockResolvedValue({ id: "arc-9", submittedByPersonId: "person-OTHER", status: "denied" });
    const res = await withApp({ portalPersonId: "person-1" }, (url) =>
      fetch(`${url}/api/portal/arc/requests/arc-9/appeal`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "please reconsider" }),
      }),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("NOT_OWNER");
    expect(H.appealArcDenial).not.toHaveBeenCalled();
  });

  it("owner CAN appeal their OWN denied request (200)", async () => {
    H.getArcRequest.mockResolvedValue({ id: "arc-9", submittedByPersonId: "person-1", status: "denied" });
    H.appealArcDenial.mockResolvedValue({ id: "arc-9", status: "appealed" });
    const res = await withApp({ portalPersonId: "person-1" }, (url) =>
      fetch(`${url}/api/portal/arc/requests/arc-9/appeal`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "the neighbor has one" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(H.appealArcDenial).toHaveBeenCalledOnce();
  });
});
