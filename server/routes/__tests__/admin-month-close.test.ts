/**
 * Route-level tests for the treasurer month-close surface (YCM#220).
 *
 * Focus: ROLE GATING (only reconciliation WRITE roles can close/reopen; read
 * roles incl. viewer can view) + PeriodCloseError → HTTP status mapping. The
 * lifecycle logic itself is exercised in
 * server/services/reconciliation/__tests__/period-close.test.ts; here we mock
 * the service to assert route wiring, guards, and error→HTTP mapping.
 *
 * The month-close endpoints live inside admin-reconciliation.ts, which imports
 * `../db` + the sibling reconciliation services at module scope. We stub those
 * so the route module loads hermetically (no live DB, no Plaid/Stripe).
 */
import express, { type NextFunction, type Request, type Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => {
  class PeriodCloseError extends Error {
    constructor(
      message: string,
      public readonly code: string,
      public readonly detail?: Record<string, unknown>,
    ) {
      super(message);
      this.name = "PeriodCloseError";
    }
  }
  return {
    getMonthCloseState: vi.fn(),
    closeMonth: vi.fn(),
    reopenMonth: vi.fn(),
    PeriodCloseError,
  };
});

const PeriodCloseError = H.PeriodCloseError;

// Keep the route module load hermetic.
vi.mock("../../db", () => ({ db: {} }));
vi.mock("../../services/reconciliation/auto-matcher", () => ({
  runAutoMatch: vi.fn(),
  listManualReviewCandidates: vi.fn(),
  findOwnerSuggestionsForUnmatchedCredits: vi.fn(),
  createPaymentFromSuggestion: vi.fn(),
  listAssociationOwners: vi.fn(),
  upsertDescriptorAlias: vi.fn(),
}));
vi.mock("../../services/reconciliation/report", () => ({
  buildReconciliationReport: vi.fn(),
  buildReconciliationTransactionLedger: vi.fn(),
  NON_OWNER_INCOME_ACTION: "reconciliation.non_owner_income",
}));
vi.mock("../../services/plaid-reconciliation", () => ({
  manualMatchBankTransaction: vi.fn(),
  listPendingReconciliation: vi.fn(),
}));
vi.mock("../../services/reconciliation/period-close", () => ({
  getMonthCloseState: H.getMonthCloseState,
  closeMonth: H.closeMonth,
  reopenMonth: H.reopenMonth,
  PeriodCloseError: H.PeriodCloseError,
}));

import { registerAdminReconciliationRoutes } from "../admin-reconciliation";

function makeApp(opts?: { role?: string }) {
  const app = express();
  app.use(express.json());
  app.use(
    (
      req: Request & { adminUserId?: string; adminUserEmail?: string; adminRole?: string },
      _res,
      next,
    ) => {
      req.adminUserId = "admin-1";
      req.adminUserEmail = "treasurer@example.com";
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

  registerAdminReconciliationRoutes(app, {
    requireAdmin,
    requireAdminRole: requireAdminRole as any,
    getAssociationIdQuery,
    assertAssociationScope: assertAssociationScope as any,
  });
  return app;
}

async function withApp<T>(
  opts: { role?: string } | undefined,
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
  H.getMonthCloseState.mockReset();
  H.closeMonth.mockReset();
  H.reopenMonth.mockReset();
});
afterEach(() => vi.clearAllMocks());

describe("role gating", () => {
  it("viewer CAN view the month-close state (200)", async () => {
    H.getMonthCloseState.mockResolvedValue({ periodMonth: "2026-06", isClosed: false });
    const res = await withApp({ role: "viewer" }, (url) =>
      fetch(`${url}/api/admin/reconciliation/month-close?associationId=a1&month=2026-06`),
    );
    expect(res.status).toBe(200);
    expect(H.getMonthCloseState).toHaveBeenCalledWith({
      associationId: "a1",
      periodMonth: "2026-06",
    });
  });

  it("viewer CANNOT close a month (403)", async () => {
    const res = await withApp({ role: "viewer" }, (url) =>
      fetch(`${url}/api/admin/reconciliation/month-close`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ associationId: "a1", month: "2026-06" }),
      }),
    );
    expect(res.status).toBe(403);
    expect(H.closeMonth).not.toHaveBeenCalled();
  });

  it("viewer CANNOT reopen a month (403)", async () => {
    const res = await withApp({ role: "viewer" }, (url) =>
      fetch(`${url}/api/admin/reconciliation/month-reopen`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ associationId: "a1", month: "2026-06" }),
      }),
    );
    expect(res.status).toBe(403);
    expect(H.reopenMonth).not.toHaveBeenCalled();
  });

  it("board-officer CAN close a month (200)", async () => {
    H.closeMonth.mockResolvedValue({ id: "pc-1", status: "closed" });
    const res = await withApp({ role: "board-officer" }, (url) =>
      fetch(`${url}/api/admin/reconciliation/month-close`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ associationId: "a1", month: "2026-06", acknowledgeUnmatched: true }),
      }),
    );
    expect(res.status).toBe(200);
    expect(H.closeMonth).toHaveBeenCalledWith(
      expect.objectContaining({
        associationId: "a1",
        periodMonth: "2026-06",
        acknowledgeUnmatched: true,
        actorEmail: "treasurer@example.com",
      }),
    );
  });
});

describe("error → HTTP mapping", () => {
  it("UNMATCHED_ACK_REQUIRED → 409 with detail", async () => {
    H.closeMonth.mockRejectedValue(
      new PeriodCloseError("stragglers", "UNMATCHED_ACK_REQUIRED", { unmatchedTotal: 3 }),
    );
    const res = await withApp({ role: "platform-admin" }, (url) =>
      fetch(`${url}/api/admin/reconciliation/month-close`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ associationId: "a1", month: "2026-06" }),
      }),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("UNMATCHED_ACK_REQUIRED");
    expect(body.detail.unmatchedTotal).toBe(3);
  });

  it("ALREADY_CLOSED → 409", async () => {
    H.closeMonth.mockRejectedValue(new PeriodCloseError("already", "ALREADY_CLOSED"));
    const res = await withApp({ role: "platform-admin" }, (url) =>
      fetch(`${url}/api/admin/reconciliation/month-close`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ associationId: "a1", month: "2026-06" }),
      }),
    );
    expect(res.status).toBe(409);
  });

  it("NOT_CLOSED reopen → 409", async () => {
    H.reopenMonth.mockRejectedValue(new PeriodCloseError("not closed", "NOT_CLOSED"));
    const res = await withApp({ role: "platform-admin" }, (url) =>
      fetch(`${url}/api/admin/reconciliation/month-reopen`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ associationId: "a1", month: "2026-06" }),
      }),
    );
    expect(res.status).toBe(409);
  });

  it("INVALID_PERIOD → 400", async () => {
    H.getMonthCloseState.mockRejectedValue(new PeriodCloseError("bad", "INVALID_PERIOD"));
    const res = await withApp({ role: "platform-admin" }, (url) =>
      fetch(`${url}/api/admin/reconciliation/month-close?associationId=a1&month=xxxx`),
    );
    expect(res.status).toBe(400);
  });

  it("missing month → 400 MISSING_MONTH", async () => {
    const res = await withApp({ role: "platform-admin" }, (url) =>
      fetch(`${url}/api/admin/reconciliation/month-close?associationId=a1`),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("MISSING_MONTH");
  });
});
