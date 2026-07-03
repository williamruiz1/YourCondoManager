/**
 * Route-level tests for POST /api/admin/payments/refund
 * (payment-correctness hardening 2026-06-30, issue #286).
 *
 * R1.4 — admin-only + role gate + association scope; valid body → refund.
 * R1.5 — an audit row is written for every refund.
 * R1.6 — REFUNDS_ENABLED off → 503 at the route (before any service call).
 *
 * Mocks: refund-service (observe inputs) + db (capture audit insert).
 */
import express, { type NextFunction, type Request, type Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock state ────────────────────────────────────────────────────────────────
let refundsEnabled = true;
let refundCalls: any[] = [];
let auditInserts: any[] = [];

vi.mock("../../services/refund-service", () => ({
  isRefundsEnabled: () => refundsEnabled,
  refundConnectCharge: vi.fn(async (params: any) => {
    refundCalls.push(params);
    return {
      refundId: "re_test_1",
      status: "succeeded",
      amountCents: params.amountCents ?? 27000,
      applicationFeeRefunded: params.refundApplicationFee !== false,
      connectedAccountId: "acct_hoa_1",
    };
  }),
}));

vi.mock("../../db", () => ({
  db: {
    insert: (_t: any) => ({
      values: (vals: any) => {
        auditInserts.push(vals);
        return Promise.resolve();
      },
    }),
  },
}));

// auto-matcher import in admin-payments — stub so it doesn't pull real deps.
vi.mock("../../services/reconciliation/auto-matcher", () => ({
  runAutoMatch: vi.fn(async () => null),
}));

import { registerAdminPaymentsRoutes } from "../admin-payments";

function makeApp(role = "platform-admin") {
  const app = express();
  app.use(express.json());
  app.use((req: Request & { adminUserEmail?: string; adminRole?: string }, _res, next) => {
    req.adminUserEmail = "admin@example.com";
    req.adminRole = role;
    next();
  });
  const requireAdmin = (_req: Request, _res: Response, next: NextFunction) => next();
  const requireAdminRole =
    (roles: string[]) => (req: Request & { adminRole?: string }, res: Response, next: NextFunction) => {
      if (!req.adminRole || !roles.includes(req.adminRole)) {
        return res.status(403).json({ error: "forbidden" });
      }
      return next();
    };
  let scopeAsserted = 0;
  const assertAssociationScope = () => {
    scopeAsserted++;
  };
  registerAdminPaymentsRoutes(app, {
    requireAdmin,
    requireAdminRole: requireAdminRole as any,
    getAssociationIdQuery: (req: Request) =>
      typeof req.query.associationId === "string" ? req.query.associationId : undefined,
    assertAssociationScope: assertAssociationScope as any,
  });
  (app as any)._scopeAsserted = () => scopeAsserted;
  return app;
}

async function post(app: express.Express, body: any) {
  const server = await new Promise<{ port: number; close: () => Promise<void> }>((resolve) => {
    const s = app.listen(0, () => {
      const port = (s.address() as { port: number }).port;
      resolve({ port, close: () => new Promise((r) => s.close(() => r(undefined))) });
    });
  });
  try {
    const res = await fetch(`http://127.0.0.1:${server.port}/api/admin/payments/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, json };
  } finally {
    await server.close();
  }
}

beforeEach(() => {
  refundsEnabled = true;
  refundCalls = [];
  auditInserts = [];
});
afterEach(() => vi.clearAllMocks());

describe("POST /api/admin/payments/refund", () => {
  it("R1.4 platform-admin can refund; default app-fee-refund flows through", async () => {
    const app = makeApp("platform-admin");
    const { status, json } = await post(app, { associationId: "a1", chargeId: "ch_1" });
    expect(status).toBe(201);
    expect(json.refund.refundId).toBe("re_test_1");
    expect(refundCalls).toHaveLength(1);
    expect(refundCalls[0].chargeId).toBe("ch_1");
    // scope was asserted
    expect((app as any)._scopeAsserted()).toBe(1);
  });

  it("R1.4 viewer is forbidden (role gate)", async () => {
    const app = makeApp("viewer");
    const { status } = await post(app, { associationId: "a1", chargeId: "ch_1" });
    expect(status).toBe(403);
    expect(refundCalls).toHaveLength(0);
  });

  it("R1.4 manager is allowed", async () => {
    const app = makeApp("manager");
    const { status } = await post(app, { associationId: "a1", chargeId: "ch_1" });
    expect(status).toBe(201);
  });

  it("R1.5 writes an audit row with app-fee-refunded + charge", async () => {
    const app = makeApp("platform-admin");
    await post(app, { associationId: "a1", chargeId: "ch_1", amountCents: 5000 });
    expect(auditInserts).toHaveLength(1);
    expect(auditInserts[0].action).toBe("payment.refund");
    expect(auditInserts[0].afterJson.chargeId).toBe("ch_1");
    expect(auditInserts[0].afterJson.applicationFeeRefunded).toBe(true);
  });

  it("R1.6 returns 503 when REFUNDS_ENABLED is off", async () => {
    refundsEnabled = false;
    const app = makeApp("platform-admin");
    const { status, json } = await post(app, { associationId: "a1", chargeId: "ch_1" });
    expect(status).toBe(503);
    expect(json.code).toBe("REFUNDS_DISABLED");
    expect(refundCalls).toHaveLength(0);
  });

  it("rejects invalid body (missing chargeId)", async () => {
    const app = makeApp("platform-admin");
    const { status, json } = await post(app, { associationId: "a1" });
    expect(status).toBe(400);
    expect(json.code).toBe("INVALID_INPUT");
  });
});
