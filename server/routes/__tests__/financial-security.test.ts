/**
 * P1-7 — Board roles/permissions audit on financial-mutation routes.
 *
 * Two acceptance criteria from Issue #214:
 *   1. A non-privileged role is rejected (HTTP 403) on financial-mutation
 *      endpoints.
 *   2. Tenant isolation holds: an admin scoped to association A cannot
 *      post payments against association B.
 *
 * Approach: the admin-payments route is the canonical financial-mutation
 * surface (payments, the tightest role gate in the codebase). We spin up
 * a lightweight express app with stub middleware that injects the role
 * under test — the same pattern used in admin-payments.test.ts.
 *
 * This file does NOT test every financial route individually (that would
 * be a 57-endpoint matrix). Instead it:
 *   a) verifies the `requireAdminRole` middleware enforces the write-role
 *      boundary in a real Express request/response cycle using
 *      `/api/admin/payments/record` as the representative route.
 *   b) verifies the `assertAssociationScope` helper (reproduced here as a
 *      contract copy, per the convention in
 *      server/__tests__/assert-association-scope.test.ts) denies cross-
 *      association access.
 *
 * The role→capability matrix is documented in
 * docs/security/financial-route-role-matrix.md.
 */

import express, { type NextFunction, type Request, type Response } from "express";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AdminRole } from "@shared/schema";

// ── Fixture store (shared across mocked db calls) ─────────────────────────────

type LedgerRow = {
  id: string;
  associationId: string;
  unitId: string;
  personId: string;
  entryType: string;
  amount: number;
  postedAt: Date;
  description: string | null;
  referenceType: string | null;
  referenceId: string | null;
  bankTransactionId: string | null;
  settledAt: Date | null;
  createdAt: Date;
};
type AuditRow = {
  id: string;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string | null;
  associationId: string | null;
  beforeJson: unknown;
  afterJson: unknown;
  createdAt: Date;
};

const ledger: LedgerRow[] = [];
const audit: AuditRow[] = [];
let nextId = 1;
const fakeId = () => `id-${String(nextId++).padStart(4, "0")}`;

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("../../db", () => ({
  db: {
    insert: (_table: unknown) => ({
      values: (vals: Record<string, unknown>) => {
        let row: LedgerRow | AuditRow;
        if (vals["entryType"]) {
          const r: LedgerRow = {
            id: fakeId(),
            associationId: String(vals["associationId"]),
            unitId: String(vals["unitId"]),
            personId: String(vals["personId"]),
            entryType: String(vals["entryType"]),
            amount: Number(vals["amount"]),
            postedAt:
              vals["postedAt"] instanceof Date
                ? vals["postedAt"]
                : new Date(vals["postedAt"] as string),
            description: (vals["description"] as string) ?? null,
            referenceType: (vals["referenceType"] as string) ?? null,
            referenceId: (vals["referenceId"] as string) ?? null,
            bankTransactionId: null,
            settledAt: null,
            createdAt: new Date(),
          };
          ledger.push(r);
          row = r;
        } else {
          const r: AuditRow = {
            id: fakeId(),
            actorEmail: String(vals["actorEmail"]),
            action: String(vals["action"]),
            entityType: String(vals["entityType"]),
            entityId: (vals["entityId"] as string) ?? null,
            associationId: (vals["associationId"] as string) ?? null,
            beforeJson: vals["beforeJson"] ?? null,
            afterJson: vals["afterJson"] ?? null,
            createdAt: new Date(),
          };
          audit.push(r);
          row = r;
        }
        return {
          returning: async () => [row],
          then: (resolve: (rows: unknown[]) => void) => resolve([row]),
        };
      },
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: async () => [],
          }),
        }),
      }),
    }),
  },
}));

vi.mock("@shared/schema", async () => {
  const ownerLedgerEntries = {
    __tag: "ownerLedgerEntries",
    associationId: "associationId",
    entryType: "entryType",
    referenceType: "referenceType",
    postedAt: "postedAt",
    id: "id",
    settledAt: "settledAt",
    bankTransactionId: "bankTransactionId",
  } as unknown as Record<string, string>;
  const auditLogs = {
    __tag: "auditLogs",
    action: "action",
    entityId: "entityId",
    associationId: "associationId",
  } as unknown as Record<string, string>;
  return { ownerLedgerEntries, auditLogs };
});

vi.mock("drizzle-orm", () => ({
  and: (...preds: Array<(r: unknown) => boolean>) => (r: unknown) =>
    preds.every((p) => p(r)),
  eq: (col: unknown, val: unknown) => (r: Record<string, unknown>) =>
    r[String(col)] === val,
  desc: (col: unknown) => ({ col: String(col), dir: "desc" as const }),
  inArray: (col: unknown, vals: unknown[]) => (r: Record<string, unknown>) =>
    vals.includes(r[String(col)]),
  isNull: (col: unknown) => (r: Record<string, unknown>) =>
    r[String(col)] === null || r[String(col)] === undefined,
}));

vi.mock("../../services/reconciliation/auto-matcher", () => ({
  runAutoMatch: vi.fn(async () => ({
    matched: [],
    needsManualReview: [],
    unmatchedBankTransactionCount: 0,
    unmatchedLedgerEntryCount: 0,
  })),
}));

import { registerAdminPaymentsRoutes } from "../admin-payments";

// ── Helper: build a minimal express app with stub admin middleware ─────────────

/**
 * `scopedAssociations`: the association IDs the acting admin is scoped to.
 * Defaults to ["assoc-A"] (i.e. the actor has access to assoc-A only).
 */
function makeApp(opts: {
  role: AdminRole;
  scopedAssociations?: string[];
}) {
  const app = express();
  app.use(express.json());

  // Stub out admin-session middleware: inject role + scoped associations.
  app.use(
    (
      req: Request & {
        adminUserId?: string;
        adminUserEmail?: string;
        adminRole?: AdminRole;
        adminScopedAssociationIds?: string[];
      },
      _res: Response,
      next: NextFunction,
    ) => {
      req.adminUserId = "test-admin";
      req.adminUserEmail = "test@example.com";
      req.adminRole = opts.role;
      req.adminScopedAssociationIds = opts.scopedAssociations ?? ["assoc-A"];
      next();
    },
  );

  // Stub requireAdmin (session presence is already injected above).
  const requireAdmin = (_req: Request, _res: Response, next: NextFunction) =>
    next();

  // Real-ish requireAdminRole: checks req.adminRole against the allowed list,
  // mirrors the production implementation in server/routes.ts.
  const requireAdminRole =
    (roles: AdminRole[]) =>
    (
      req: Request & { adminRole?: AdminRole },
      res: Response,
      next: NextFunction,
    ) => {
      if (!req.adminRole || !roles.includes(req.adminRole)) {
        return res.status(403).json({
          message: "Insufficient admin role",
          code: "ADMIN_ROLE_FORBIDDEN",
          currentRole: req.adminRole ?? null,
          requiredRoles: roles,
        });
      }
      return next();
    };

  const getAssociationIdQuery = (req: Request) =>
    typeof req.query["associationId"] === "string"
      ? req.query["associationId"]
      : undefined;

  // Real-ish assertAssociationScope: mirrors server/routes.ts production helper.
  const assertAssociationScope = (
    req: Request & { adminRole?: AdminRole; adminScopedAssociationIds?: string[] },
    associationId: string,
  ) => {
    if (req.adminRole === "platform-admin") return;
    if (!associationId) throw new Error("associationId is required");
    if (!req.adminRole) throw new Error("Association is outside admin scope");
    const scoped = req.adminScopedAssociationIds ?? [];
    if (scoped.length === 0 || !scoped.includes(associationId)) {
      throw new Error("Association is outside admin scope");
    }
  };

  registerAdminPaymentsRoutes(app, {
    requireAdmin,
    requireAdminRole: requireAdminRole as Parameters<
      typeof registerAdminPaymentsRoutes
    >[1]["requireAdminRole"],
    getAssociationIdQuery,
    assertAssociationScope: assertAssociationScope as Parameters<
      typeof registerAdminPaymentsRoutes
    >[1]["assertAssociationScope"],
  });

  return app;
}

/** Spin up a real HTTP server on a random port, run fn, tear down. */
async function withApp<T>(
  opts: { role: AdminRole; scopedAssociations?: string[] },
  fn: (baseUrl: string) => Promise<T>,
): Promise<T> {
  const app = makeApp(opts);
  const server = await new Promise<{ port: number; close: () => Promise<void> }>(
    (resolve, reject) => {
      const s = app.listen(0, () => {
        const port = (s.address() as { port: number }).port;
        resolve({
          port,
          close: () => new Promise<void>((r) => s.close(() => r())),
        });
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

const BASE_PAYMENT = {
  associationId: "assoc-A",
  unitId: "unit-1",
  personId: "person-1",
  amount: 150,
  method: "check",
  checkNumber: "5001",
  receivedAt: "2026-06-01T10:00:00Z",
  attemptBankMatch: false,
} as const;

// ── Reset fixture state between tests ─────────────────────────────────────────

beforeEach(() => {
  ledger.length = 0;
  audit.length = 0;
  nextId = 1;
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── Section 1: Role-gate enforcement ─────────────────────────────────────────

describe("P1-7 § Role-gate — non-privileged roles are rejected on financial-mutation endpoints", () => {
  /**
   * `viewer` is the most restrictive admin role. Attempting to POST a payment
   * must return HTTP 403. This is the canonical acceptance-criterion test from
   * Issue #214: "automated test asserting a non-privileged role is rejected on
   * a financial-mutation endpoint."
   */
  it("viewer role: POST /api/admin/payments/record → 403 ADMIN_ROLE_FORBIDDEN", async () => {
    const status = await withApp({ role: "viewer" }, async (url) => {
      const res = await fetch(`${url}/api/admin/payments/record`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(BASE_PAYMENT),
      });
      const body = (await res.json()) as { code?: string };
      expect(body.code).toBe("ADMIN_ROLE_FORBIDDEN");
      return res.status;
    });
    expect(status).toBe(403);
    // Confirm: no ledger write happened.
    expect(ledger).toHaveLength(0);
  });

  it("viewer role: POST /api/admin/payments/record-bulk → 403 ADMIN_ROLE_FORBIDDEN", async () => {
    const status = await withApp({ role: "viewer" }, async (url) => {
      const res = await fetch(`${url}/api/admin/payments/record-bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          associationId: "assoc-A",
          rows: [BASE_PAYMENT],
          attemptBankMatch: false,
        }),
      });
      return res.status;
    });
    expect(status).toBe(403);
    expect(ledger).toHaveLength(0);
  });

  /**
   * Control: board-officer IS a write role — the same request succeeds.
   */
  it("board-officer role: POST /api/admin/payments/record → 201 (write allowed)", async () => {
    const status = await withApp(
      { role: "board-officer", scopedAssociations: ["assoc-A"] },
      async (url) => {
        const res = await fetch(`${url}/api/admin/payments/record`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(BASE_PAYMENT),
        });
        return res.status;
      },
    );
    expect(status).toBe(201);
    expect(ledger).toHaveLength(1);
  });

  /**
   * platform-admin also has full write access.
   */
  it("platform-admin role: POST /api/admin/payments/record → 201 (write allowed)", async () => {
    const status = await withApp(
      { role: "platform-admin" },
      async (url) => {
        const res = await fetch(`${url}/api/admin/payments/record`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(BASE_PAYMENT),
        });
        return res.status;
      },
    );
    expect(status).toBe(201);
    expect(ledger).toHaveLength(1);
  });

  /**
   * `manager` and `pm-assistant` are read-only for the payment-record
   * endpoint (RECORD_ROLES = ["platform-admin", "board-officer"] only).
   */
  it.each(["manager", "pm-assistant", "assisted-board"] as AdminRole[])(
    "%s role: POST /api/admin/payments/record → 403",
    async (role) => {
      const status = await withApp(
        { role, scopedAssociations: ["assoc-A"] },
        async (url) => {
          const res = await fetch(`${url}/api/admin/payments/record`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(BASE_PAYMENT),
          });
          return res.status;
        },
      );
      expect(status).toBe(403);
      expect(ledger).toHaveLength(0);
    },
  );
});

// ── Section 2: Tenant isolation ───────────────────────────────────────────────

describe("P1-7 § Tenant isolation — assertAssociationScope blocks cross-association writes", () => {
  /**
   * An admin scoped to `assoc-A` attempts to post a payment for `assoc-B`.
   * The `assertAssociationScope` helper must throw, causing the handler to
   * return 400 (the route's catch-all for thrown errors). The ledger must
   * stay empty.
   *
   * This is the canonical tenant-isolation acceptance criterion from Issue
   * #214: "automated test asserting tenant isolation holds (one association
   * can't touch another's financial data)."
   */
  it("board-officer scoped to assoc-A is denied writing to assoc-B", async () => {
    const status = await withApp(
      { role: "board-officer", scopedAssociations: ["assoc-A"] },
      async (url) => {
        const res = await fetch(`${url}/api/admin/payments/record`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...BASE_PAYMENT,
            associationId: "assoc-B", // ← different association
          }),
        });
        return res.status;
      },
    );
    // assertAssociationScope throws → handler's catch converts to 400.
    expect(status).toBe(400);
    expect(ledger).toHaveLength(0);
  });

  it("platform-admin is allowed to write to any association (no scope restriction)", async () => {
    const status = await withApp(
      { role: "platform-admin", scopedAssociations: [] },
      async (url) => {
        const res = await fetch(`${url}/api/admin/payments/record`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...BASE_PAYMENT,
            associationId: "assoc-B", // ← platform-admin bypasses scope
          }),
        });
        return res.status;
      },
    );
    expect(status).toBe(201);
    expect(ledger).toHaveLength(1);
  });

  it("board-officer scoped to assoc-A CAN write to assoc-A (their own association)", async () => {
    const status = await withApp(
      { role: "board-officer", scopedAssociations: ["assoc-A"] },
      async (url) => {
        const res = await fetch(`${url}/api/admin/payments/record`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(BASE_PAYMENT),
        });
        return res.status;
      },
    );
    expect(status).toBe(201);
    expect(ledger).toHaveLength(1);
    expect(ledger[0].associationId).toBe("assoc-A");
  });

  it("board-officer with empty scope is denied even for their own association (fail-closed)", async () => {
    const status = await withApp(
      { role: "board-officer", scopedAssociations: [] },
      async (url) => {
        const res = await fetch(`${url}/api/admin/payments/record`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(BASE_PAYMENT),
        });
        return res.status;
      },
    );
    expect(status).toBe(400);
    expect(ledger).toHaveLength(0);
  });
});

// ── Section 3: Role-capability matrix contract ────────────────────────────────

/**
 * Locks the RECORD_ROLES / READ_ROLES boundary from admin-payments.ts as a
 * typed contract. If someone widens the write-role list without auditing,
 * this test fails and forces a conscious review.
 */
describe("P1-7 § Role-capability matrix — READ_ROLES vs RECORD_ROLES contract", () => {
  const WRITE_ROLES: AdminRole[] = ["platform-admin", "board-officer"];
  const READ_ONLY_ROLES: AdminRole[] = [
    "assisted-board",
    "pm-assistant",
    "manager",
    "viewer",
  ];

  it("all WRITE_ROLES can POST a payment (control group)", async () => {
    for (const role of WRITE_ROLES) {
      ledger.length = 0;
      const status = await withApp(
        { role, scopedAssociations: ["assoc-A"] },
        async (url) => {
          const res = await fetch(`${url}/api/admin/payments/record`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(BASE_PAYMENT),
          });
          return res.status;
        },
      );
      expect(status, `role ${role} should be allowed`).toBe(201);
      expect(ledger, `role ${role} should have written a ledger row`).toHaveLength(1);
    }
  });

  it("all READ_ONLY_ROLES are denied POST /api/admin/payments/record (matrix lock)", async () => {
    for (const role of READ_ONLY_ROLES) {
      ledger.length = 0;
      const status = await withApp(
        { role, scopedAssociations: ["assoc-A"] },
        async (url) => {
          const res = await fetch(`${url}/api/admin/payments/record`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(BASE_PAYMENT),
          });
          return res.status;
        },
      );
      expect(status, `role ${role} should be denied`).toBe(403);
      expect(ledger, `role ${role} must not write to the ledger`).toHaveLength(0);
    }
  });
});
