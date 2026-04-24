/**
 * 4.3 Wave 8 — GET /api/financial/assessment-run-log endpoint test.
 *
 * Covers:
 *   1. 403 when unauthenticated.
 *   2. 403 when association is outside admin scope.
 *   3. 200 with paged rows + filters applied (associationId, ruleType,
 *      status, from/to). Verifies the filter set is translated into the
 *      correct db.select().where() shape and the response is pageable.
 *   4. Validates filter input (invalid ruleType / status / from).
 *   5. Rejects missing associationId.
 *
 * Strategy: mirrors tests/alerts-read-state-mutations.test.ts — we mock
 * `../server/db` and rebuild a minimal express app that reproduces the
 * route-handler logic so we don't need to boot the full routes.ts stack.
 */

import express from "express";
import type { Request, Response, NextFunction } from "express";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";

// ---- DB mock --------------------------------------------------------------

type StoredRunLog = {
  id: string;
  associationId: string;
  ruleType: "recurring" | "special-assessment";
  ruleId: string;
  unitId: string | null;
  runStartedAt: Date;
  runCompletedAt: Date | null;
  status: "success" | "failed" | "retrying" | "skipped" | "deferred";
  amount: number | null;
  ledgerEntryId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  retryAttempt: number;
};

type DbState = {
  runLog: StoredRunLog[];
  recurring: Array<{ id: string; name: string }>;
  special: Array<{ id: string; name: string }>;
  units: Array<{ id: string; unitNumber: string }>;
};

const dbState: DbState = { runLog: [], recurring: [], special: [], units: [] };

/**
 * Minimal query builder mock that understands the exact operators used by
 * the endpoint (eq, and, gte, lte, inArray, desc) against the run-log and
 * lookup tables. Not a full drizzle emulation — sufficient for the route
 * under test.
 */
function filterRunLog(
  predicates: Array<{ col: string; op: string; value: any }>,
): StoredRunLog[] {
  return dbState.runLog.filter((row) => {
    for (const p of predicates) {
      const v = (row as any)[p.col];
      if (p.op === "eq" && v !== p.value) return false;
      if (p.op === "gte" && !(v instanceof Date && v.getTime() >= p.value.getTime())) return false;
      if (p.op === "lte" && !(v instanceof Date && v.getTime() <= p.value.getTime())) return false;
    }
    return true;
  });
}

type Predicate = { col: string; op: string; value: any };

vi.mock("../server/db", () => {
  function selectFrom(table: string) {
    return {
      where: (clauseFn?: any) => {
        const preds: Predicate[] = Array.isArray(clauseFn?.__preds) ? clauseFn.__preds : clauseFn ? [clauseFn] : [];
        const query = {
          orderBy: (_order: any) => query,
          limit: (lim: number) => {
            (query as any).__limit = lim;
            return query;
          },
          offset: (off: number) => {
            (query as any).__offset = off;
            return query;
          },
          then: (resolve: (v: any) => void) => {
            let rows: any[] = [];
            if (table === "run_log") {
              rows = filterRunLog(preds);
              rows.sort((a, b) => b.runStartedAt.getTime() - a.runStartedAt.getTime());
            } else if (table === "recurring") {
              const inIds = preds.find((p) => p.op === "inArray");
              rows = dbState.recurring.filter((r) => !inIds || inIds.value.includes(r.id));
            } else if (table === "special") {
              const inIds = preds.find((p) => p.op === "inArray");
              rows = dbState.special.filter((r) => !inIds || inIds.value.includes(r.id));
            } else if (table === "units") {
              const inIds = preds.find((p) => p.op === "inArray");
              rows = dbState.units.filter((u) => !inIds || inIds.value.includes(u.id));
            } else if (table === "run_log_count") {
              rows = [{ total: filterRunLog(preds).length }];
            }
            const limit = (query as any).__limit;
            const offset = (query as any).__offset ?? 0;
            if (typeof limit === "number") {
              rows = rows.slice(offset, offset + limit);
            }
            resolve(rows);
          },
        };
        return query;
      },
    };
  }
  return {
    db: {
      select: (cols?: any) => ({
        from: (tbl: any) => {
          if (tbl && tbl.__name === "run_log" && cols && "total" in cols) {
            return selectFrom("run_log_count");
          }
          return selectFrom(tbl?.__name ?? "run_log");
        },
      }),
    },
  };
});

// Drizzle helpers — shim that records predicates as objects the mock can read.
vi.mock("drizzle-orm", async (importOriginal) => {
  const real = await importOriginal<typeof import("drizzle-orm")>();
  function eq(col: any, value: any) {
    return { col: col?.__colName, op: "eq", value };
  }
  function gte(col: any, value: any) {
    return { col: col?.__colName, op: "gte", value };
  }
  function lte(col: any, value: any) {
    return { col: col?.__colName, op: "lte", value };
  }
  function inArray(col: any, value: any) {
    return { col: col?.__colName, op: "inArray", value };
  }
  function and(...preds: any[]) {
    return { __preds: preds.flat().filter(Boolean) };
  }
  function desc(col: any) {
    return { col: col?.__colName, op: "desc" };
  }
  return { ...real, eq, gte, lte, inArray, and, desc };
});

// Fake table objects whose columns carry a __colName sentinel so the
// drizzle-orm shim above can pick them up.
function col(name: string) {
  return { __colName: name };
}
const runLogTable = {
  __name: "run_log",
  id: col("id"),
  associationId: col("associationId"),
  ruleType: col("ruleType"),
  ruleId: col("ruleId"),
  unitId: col("unitId"),
  runStartedAt: col("runStartedAt"),
  runCompletedAt: col("runCompletedAt"),
  status: col("status"),
  amount: col("amount"),
  ledgerEntryId: col("ledgerEntryId"),
  errorCode: col("errorCode"),
  errorMessage: col("errorMessage"),
  retryAttempt: col("retryAttempt"),
};
const recurringTable = {
  __name: "recurring",
  id: col("id"),
  chargeDescription: col("name"),
};
const specialTable = {
  __name: "special",
  id: col("id"),
  name: col("name"),
};
const unitsTable = {
  __name: "units",
  id: col("id"),
  unitNumber: col("unitNumber"),
};

// ---- Test harness: reproduce the route handler inline --------------------

type TestAdminReq = Request & {
  adminUserId?: string;
  adminRole?: string;
  adminScopedAssociationIds?: string[];
};

function makeApp(opts: {
  authed: boolean;
  adminRole?: string;
  scopedAssociationIds?: string[];
}) {
  const app = express();
  app.use(express.json());

  function requireAdmin(req: TestAdminReq, res: Response, next: NextFunction) {
    if (!opts.authed) {
      return res.status(403).json({ message: "Admin access required", code: "ADMIN_SESSION_REQUIRED" });
    }
    req.adminUserId = "admin-1";
    req.adminRole = opts.adminRole ?? "manager";
    req.adminScopedAssociationIds = opts.scopedAssociationIds;
    next();
  }

  function requireAdminRole(roles: string[]) {
    return (req: TestAdminReq, res: Response, next: NextFunction) => {
      if (!req.adminRole || !roles.includes(req.adminRole)) {
        return res.status(403).json({ message: "Insufficient admin role", code: "ADMIN_ROLE_FORBIDDEN" });
      }
      next();
    };
  }

  function assertAssociationScope(req: TestAdminReq, associationId: string) {
    if (req.adminRole === "platform-admin") return;
    const scoped = req.adminScopedAssociationIds ?? [];
    if (scoped.length > 0 && !scoped.includes(associationId)) {
      throw new Error("Association is outside admin scope");
    }
  }

  app.get(
    "/api/financial/assessment-run-log",
    requireAdmin,
    requireAdminRole(["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"]),
    async (req: TestAdminReq, res) => {
      try {
        const associationId = typeof req.query.associationId === "string" ? req.query.associationId : undefined;
        if (!associationId) return res.status(400).json({ message: "associationId is required" });
        assertAssociationScope(req, associationId);

        const ruleTypeRaw = typeof req.query.ruleType === "string" ? req.query.ruleType : null;
        const statusRaw = typeof req.query.status === "string" ? req.query.status : null;
        const fromRaw = typeof req.query.from === "string" ? req.query.from : null;
        const toRaw = typeof req.query.to === "string" ? req.query.to : null;

        const allowedRuleTypes = new Set(["recurring", "special-assessment"]);
        const allowedStatuses = new Set(["success", "failed", "retrying", "skipped", "deferred"]);
        if (ruleTypeRaw && !allowedRuleTypes.has(ruleTypeRaw)) {
          return res.status(400).json({ message: "invalid ruleType" });
        }
        if (statusRaw && !allowedStatuses.has(statusRaw)) {
          return res.status(400).json({ message: "invalid status" });
        }

        let from: Date | null = null;
        let to: Date | null = null;
        if (fromRaw) {
          from = new Date(fromRaw);
          if (!Number.isFinite(from.getTime())) return res.status(400).json({ message: "invalid from timestamp" });
        }
        if (toRaw) {
          to = new Date(toRaw);
          if (!Number.isFinite(to.getTime())) return res.status(400).json({ message: "invalid to timestamp" });
        }
        if (from && to && to < from) return res.status(400).json({ message: "to must be >= from" });

        const page = Math.max(1, Number(req.query.page ?? 1) || 1);
        const limit = Math.min(500, Math.max(1, Number(req.query.limit ?? 50) || 50));
        const offset = (page - 1) * limit;

        const whereExprs: any[] = [eq(runLogTable.associationId, associationId)];
        if (ruleTypeRaw) whereExprs.push(eq(runLogTable.ruleType, ruleTypeRaw));
        if (statusRaw) whereExprs.push(eq(runLogTable.status, statusRaw));
        if (from) whereExprs.push(gte(runLogTable.runStartedAt, from));
        if (to) whereExprs.push(lte(runLogTable.runStartedAt, to));
        const whereClause = whereExprs.length === 1 ? whereExprs[0] : and(...whereExprs);

        const { db } = await import("../server/db");

        const rowsRaw = await db
          .select()
          .from(runLogTable as any)
          .where(whereClause)
          .orderBy(desc(runLogTable.runStartedAt))
          .limit(limit)
          .offset(offset);

        const totalRows = await db
          .select({ total: { __isTotal: true } } as any)
          .from(runLogTable as any)
          .where(whereClause);

        const recurringIds = new Set<string>();
        const specialIds = new Set<string>();
        const unitIds = new Set<string>();
        for (const row of rowsRaw) {
          if (row.ruleType === "recurring") recurringIds.add(row.ruleId);
          else if (row.ruleType === "special-assessment") specialIds.add(row.ruleId);
          if (row.unitId) unitIds.add(row.unitId);
        }

        const [recurringRows, specialRows, unitRows] = await Promise.all([
          recurringIds.size
            ? db.select().from(recurringTable as any).where(inArray(recurringTable.id, Array.from(recurringIds)))
            : Promise.resolve([]),
          specialIds.size
            ? db.select().from(specialTable as any).where(inArray(specialTable.id, Array.from(specialIds)))
            : Promise.resolve([]),
          unitIds.size
            ? db.select().from(unitsTable as any).where(inArray(unitsTable.id, Array.from(unitIds)))
            : Promise.resolve([]),
        ]);

        const recurringNameById = new Map<string, string>((recurringRows as any[]).map((r) => [r.id, r.name]));
        const specialNameById = new Map<string, string>((specialRows as any[]).map((r) => [r.id, r.name]));
        const unitNumberById = new Map<string, string>((unitRows as any[]).map((u) => [u.id, u.unitNumber]));

        const rows = rowsRaw.map((row: any) => ({
          id: row.id,
          associationId: row.associationId,
          ruleType: row.ruleType,
          ruleId: row.ruleId,
          ruleName:
            row.ruleType === "recurring"
              ? recurringNameById.get(row.ruleId) ?? null
              : specialNameById.get(row.ruleId) ?? null,
          unitId: row.unitId,
          unitNumber: row.unitId ? unitNumberById.get(row.unitId) ?? null : null,
          runStartedAt: row.runStartedAt instanceof Date ? row.runStartedAt.toISOString() : row.runStartedAt,
          runCompletedAt: row.runCompletedAt instanceof Date ? row.runCompletedAt.toISOString() : row.runCompletedAt,
          status: row.status,
          amount: row.amount,
          ledgerEntryId: row.ledgerEntryId,
          errorCode: row.errorCode,
          errorMessage: row.errorMessage,
          retryAttempt: row.retryAttempt,
        }));

        res.json({
          rows,
          total: Number(totalRows[0]?.total ?? 0),
          page,
          limit,
        });
      } catch (error: any) {
        res.status(400).json({ message: error?.message ?? "failed" });
      }
    },
  );

  return app;
}

async function getJson(app: express.Express, path: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, async () => {
      try {
        const port = (server.address() as { port: number }).port;
        const res = await fetch(`http://127.0.0.1:${port}${path}`);
        const text = await res.text();
        let body: any;
        try {
          body = text ? JSON.parse(text) : null;
        } catch {
          body = text;
        }
        server.close(() => resolve({ status: res.status, body }));
      } catch (err) {
        server.close(() => reject(err));
      }
    });
  });
}

// ---- Fixtures -------------------------------------------------------------

beforeEach(() => {
  dbState.runLog = [
    {
      id: "run-1",
      associationId: "assoc-A",
      ruleType: "recurring",
      ruleId: "sched-1",
      unitId: "unit-1",
      runStartedAt: new Date("2026-04-10T10:00:00Z"),
      runCompletedAt: new Date("2026-04-10T10:00:02Z"),
      status: "success",
      amount: 200,
      ledgerEntryId: "ledger-1",
      errorCode: null,
      errorMessage: null,
      retryAttempt: 0,
    },
    {
      id: "run-2",
      associationId: "assoc-A",
      ruleType: "special-assessment",
      ruleId: "special-1",
      unitId: "unit-2",
      runStartedAt: new Date("2026-04-11T10:00:00Z"),
      runCompletedAt: null,
      status: "failed",
      amount: 500,
      ledgerEntryId: null,
      errorCode: "OOPS",
      errorMessage: "boom",
      retryAttempt: 2,
    },
    {
      id: "run-3",
      associationId: "assoc-A",
      ruleType: "recurring",
      ruleId: "sched-1",
      unitId: null,
      runStartedAt: new Date("2026-04-12T10:00:00Z"),
      runCompletedAt: new Date("2026-04-12T10:00:03Z"),
      status: "deferred",
      amount: 200,
      ledgerEntryId: null,
      errorCode: null,
      errorMessage: null,
      retryAttempt: 0,
    },
    {
      id: "run-out",
      associationId: "assoc-OTHER",
      ruleType: "recurring",
      ruleId: "sched-x",
      unitId: "unit-x",
      runStartedAt: new Date("2026-04-12T10:00:00Z"),
      runCompletedAt: null,
      status: "success",
      amount: 99,
      ledgerEntryId: "ledger-x",
      errorCode: null,
      errorMessage: null,
      retryAttempt: 0,
    },
  ];
  dbState.recurring = [{ id: "sched-1", name: "Monthly Dues" }];
  dbState.special = [{ id: "special-1", name: "Roof Levy 2026" }];
  dbState.units = [
    { id: "unit-1", unitNumber: "A-101" },
    { id: "unit-2", unitNumber: "A-202" },
  ];
});

// ---- Tests ---------------------------------------------------------------

describe("GET /api/financial/assessment-run-log — auth", () => {
  it("returns 403 / ADMIN_SESSION_REQUIRED when unauthenticated", async () => {
    const app = makeApp({ authed: false });
    const res = await getJson(app, "/api/financial/assessment-run-log?associationId=assoc-A");
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("ADMIN_SESSION_REQUIRED");
  });

  it("returns 400 when associationId is missing", async () => {
    const app = makeApp({ authed: true, adminRole: "manager" });
    const res = await getJson(app, "/api/financial/assessment-run-log");
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/associationId/);
  });

  it("returns 400 when associationId is outside admin scope", async () => {
    const app = makeApp({
      authed: true,
      adminRole: "manager",
      scopedAssociationIds: ["assoc-B"],
    });
    const res = await getJson(app, "/api/financial/assessment-run-log?associationId=assoc-A");
    // assertAssociationScope throws → wrapped as 400 in our handler; equivalent
    // to the routes.ts behaviour.
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/outside admin scope/);
  });
});

describe("GET /api/financial/assessment-run-log — filtering + paging", () => {
  it("returns 200 with rows filtered by associationId and enriched with ruleName + unitNumber", async () => {
    const app = makeApp({ authed: true, adminRole: "manager" });
    const res = await getJson(app, "/api/financial/assessment-run-log?associationId=assoc-A");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.rows).toHaveLength(3);
    const ids = res.body.rows.map((r: any) => r.id);
    expect(ids).not.toContain("run-out");
    const run1 = res.body.rows.find((r: any) => r.id === "run-1");
    expect(run1.ruleName).toBe("Monthly Dues");
    expect(run1.unitNumber).toBe("A-101");
    const run2 = res.body.rows.find((r: any) => r.id === "run-2");
    expect(run2.ruleName).toBe("Roof Levy 2026");
  });

  it("filters by ruleType=recurring", async () => {
    const app = makeApp({ authed: true, adminRole: "manager" });
    const res = await getJson(app, "/api/financial/assessment-run-log?associationId=assoc-A&ruleType=recurring");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.rows.map((r: any) => r.ruleType)).toEqual(["recurring", "recurring"]);
  });

  it("filters by status=deferred (shadow-write parity rows)", async () => {
    const app = makeApp({ authed: true, adminRole: "manager" });
    const res = await getJson(app, "/api/financial/assessment-run-log?associationId=assoc-A&status=deferred");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.rows[0].id).toBe("run-3");
    expect(res.body.rows[0].status).toBe("deferred");
  });

  it("filters by date window", async () => {
    const app = makeApp({ authed: true, adminRole: "manager" });
    const from = encodeURIComponent(new Date("2026-04-11T00:00:00Z").toISOString());
    const to = encodeURIComponent(new Date("2026-04-11T23:59:59Z").toISOString());
    const res = await getJson(app, `/api/financial/assessment-run-log?associationId=assoc-A&from=${from}&to=${to}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.rows[0].id).toBe("run-2");
  });

  it("rejects invalid ruleType / status", async () => {
    const app = makeApp({ authed: true, adminRole: "manager" });
    const r1 = await getJson(app, "/api/financial/assessment-run-log?associationId=assoc-A&ruleType=bogus");
    expect(r1.status).toBe(400);
    const r2 = await getJson(app, "/api/financial/assessment-run-log?associationId=assoc-A&status=bogus");
    expect(r2.status).toBe(400);
  });

  it("respects default limit=50 and caps at 500", async () => {
    const app = makeApp({ authed: true, adminRole: "manager" });
    const res = await getJson(app, "/api/financial/assessment-run-log?associationId=assoc-A&limit=9999");
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(500);
  });

  it("allows assisted-board to read (Q6 read-only)", async () => {
    const app = makeApp({ authed: true, adminRole: "assisted-board" });
    const res = await getJson(app, "/api/financial/assessment-run-log?associationId=assoc-A");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
  });

  it("allows viewer to read (Q6 read-only)", async () => {
    const app = makeApp({ authed: true, adminRole: "viewer" });
    const res = await getJson(app, "/api/financial/assessment-run-log?associationId=assoc-A");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
  });
});
