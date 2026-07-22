/**
 * Route-level integration tests for the admin manual-payment recording
 * surface (founder-os#2479).
 *
 * The drizzle layer + the reconciliation auto-matcher are mocked. We
 * exercise:
 *   1. POST /api/admin/payments/record across all 6 method types.
 *   2. Auto-match invocation after recording (and that disabling it skips
 *      the matcher).
 *   3. Role-gating: write requires platform-admin or board-officer.
 *   4. Bulk-paste path: parser + per-row partial-success outcome.
 *   5. Audit-log entry is written alongside every ledger insert.
 *   6. GET /api/admin/payments/recent returns the most-recent N rows.
 *
 * Mock seams (per the pattern in stripe-connect.test.ts):
 *   - vi.mock("../../db") — replaces drizzle's `db.insert(...).values(...).returning()`
 *     and `db.select(...).from(...).where(...).orderBy(...).limit(...)` chains
 *     with in-memory fixture state.
 *   - vi.mock("../../services/reconciliation/auto-matcher") — observes calls
 *     to `runAutoMatch` without hitting any real DB.
 */
import express, { type NextFunction, type Request, type Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Fixture state (mutated by mocks) ──────────────────────────────────────────
type LedgerRow = {
  id: string;
  associationId: string;
  unitId: string;
  personId: string;
  entryType: string;
  amount: number;
  amountCents: number;
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
  beforeJson: any;
  afterJson: any;
  createdAt: Date;
};

const ledger: LedgerRow[] = [];
const audit: AuditRow[] = [];
let nextId = 1;
const fakeId = () => `id-${String(nextId++).padStart(4, "0")}`;
let autoMatchCalls: string[] = [];

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Build a minimal drizzle-shaped query builder over the in-memory ledger.
// We only implement the chain shapes our route handler actually calls.
function buildSelectChain<T>(rows: T[]) {
  const state: {
    rows: T[];
    where?: (r: T) => boolean;
    order?: { col: keyof T; dir: "asc" | "desc" };
    limit?: number;
  } = { rows };
  const chain: any = {
    from: () => chain,
    where: (predicate: (r: T) => boolean) => {
      state.where = predicate;
      return chain;
    },
    orderBy: (orderSpec: { col: keyof T; dir: "asc" | "desc" }) => {
      state.order = orderSpec;
      return chain;
    },
    limit: (n: number) => {
      state.limit = n;
      return chain;
    },
    then: (resolve: (rows: T[]) => void) => {
      let out = state.where ? state.rows.filter(state.where) : state.rows.slice();
      if (state.order) {
        const { col, dir } = state.order;
        out = out.slice().sort((a, b) => {
          const av = a[col] as any;
          const bv = b[col] as any;
          if (av === bv) return 0;
          if (av instanceof Date && bv instanceof Date) {
            return dir === "asc"
              ? av.getTime() - bv.getTime()
              : bv.getTime() - av.getTime();
          }
          return dir === "asc"
            ? av > bv
              ? 1
              : -1
            : av < bv
              ? 1
              : -1;
        });
      }
      if (state.limit) out = out.slice(0, state.limit);
      resolve(out);
    },
  };
  return chain;
}

// Symbol-tagged predicate carriers so the drizzle `and`/`eq`/`desc`/`inArray`
// mocks below can be composed into a single boolean predicate the chain mock
// can apply.
type Pred<T> = (r: T) => boolean;
const PRED = Symbol("pred");

vi.mock("../../db", () => ({
  db: {
    insert: (_table: any) => ({
      values: (vals: any) => {
        // Build the actual row up front so both the .returning() path AND
        // the bare `await db.insert(t).values(v)` path see the same write.
        let row: LedgerRow | AuditRow;
        if (vals.entryType) {
          const r: LedgerRow = {
            id: fakeId(),
            associationId: vals.associationId,
            unitId: vals.unitId,
            personId: vals.personId,
            entryType: vals.entryType,
            amount: vals.amount,
            amountCents:
              typeof vals.amountCents === "number"
                ? vals.amountCents
                : Math.round(vals.amount * 100),
            postedAt: vals.postedAt instanceof Date ? vals.postedAt : new Date(vals.postedAt),
            description: vals.description ?? null,
            referenceType: vals.referenceType ?? null,
            referenceId: vals.referenceId ?? null,
            bankTransactionId: null,
            settledAt: null,
            createdAt: new Date(),
          };
          ledger.push(r);
          row = r;
        } else {
          const r: AuditRow = {
            id: fakeId(),
            actorEmail: vals.actorEmail,
            action: vals.action,
            entityType: vals.entityType,
            entityId: vals.entityId ?? null,
            associationId: vals.associationId ?? null,
            beforeJson: vals.beforeJson ?? null,
            afterJson: vals.afterJson ?? null,
            createdAt: new Date(),
          };
          audit.push(r);
          row = r;
        }
        const result: any = {
          returning: async () => [row],
          // Support `await db.insert(t).values(v)` (no `.returning()`) — the
          // audit-log writes use this shape.
          then: (resolve: any) => resolve([row]),
        };
        return result;
      },
    }),
    select: () => ({
      from: (table: any) => {
        // Route by table identity (tagged on the mock for ../../@shared/schema).
        const isAudit = table?.__tag === "auditLogs";
        if (isAudit) return buildSelectChain(audit);
        return buildSelectChain(ledger);
      },
    }),
    update: () => ({
      set: () => ({ where: async () => undefined }),
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
    amountCents: "amountCents",
  } as any;
  const auditLogs = {
    __tag: "auditLogs",
    action: "action",
    entityId: "entityId",
    associationId: "associationId",
  } as any;
  return {
    ownerLedgerEntries,
    auditLogs,
    // AdminRole type is erased at runtime.
  };
});

// drizzle-orm helpers — return predicate carriers the chain mock can use.
vi.mock("drizzle-orm", () => ({
  and: (...preds: Array<Pred<any>>) => (r: any) => preds.every((p) => p(r)),
  eq: (col: any, val: any) => (r: any) => r[String(col)] === val,
  desc: (col: any) => ({ col: String(col), dir: "desc" as const }),
  asc: (col: any) => ({ col: String(col), dir: "asc" as const }),
  inArray: (col: any, vals: any[]) => (r: any) => vals.includes(r[String(col)]),
  isNull: (col: any) => (r: any) => r[String(col)] === null || r[String(col)] === undefined,
}));

vi.mock("../../services/reconciliation/auto-matcher", () => ({
  runAutoMatch: vi.fn(async (associationId: string) => {
    autoMatchCalls.push(associationId);
    return {
      matched: [],
      needsManualReview: [],
      unmatchedBankTransactionCount: 0,
      unmatchedLedgerEntryCount: 0,
    };
  }),
}));

// Now import the registrar (mocks must precede import).
import { registerAdminPaymentsRoutes } from "../admin-payments";

// ── Test fixture: express app with stub admin middleware ─────────────────────

function makeApp(opts?: { role?: string }) {
  const app = express();
  app.use(express.json());
  app.use((req: Request & { adminUserId?: string; adminUserEmail?: string; adminRole?: string }, _res, next) => {
    req.adminUserId = "admin-test";
    req.adminUserEmail = "admin@example.com";
    req.adminRole = opts?.role ?? "platform-admin";
    next();
  });

  const requireAdmin = (_req: Request, _res: Response, next: NextFunction) => next();
  const requireAdminRole = (roles: string[]) =>
    (req: Request & { adminRole?: string }, res: Response, next: NextFunction) => {
      if (!req.adminRole || !roles.includes(req.adminRole)) {
        return res.status(403).json({ error: "forbidden" });
      }
      return next();
    };
  const getAssociationIdQuery = (req: Request) =>
    typeof req.query.associationId === "string" ? req.query.associationId : undefined;
  const assertAssociationScope = () => {
    /* allow */
  };

  registerAdminPaymentsRoutes(app, {
    requireAdmin,
    requireAdminRole: requireAdminRole as any,
    getAssociationIdQuery,
    assertAssociationScope: assertAssociationScope as any,
  });
  return app;
}

async function withApp<T>(opts: { role?: string } | undefined, fn: (url: string) => Promise<T>): Promise<T> {
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
  ledger.length = 0;
  audit.length = 0;
  nextId = 1;
  autoMatchCalls = [];
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/admin/payments/record — method coverage", () => {
  const baseBody = {
    associationId: "assoc-1",
    unitId: "unit-1",
    personId: "person-1",
    amount: 250,
    receivedAt: "2026-05-25T12:00:00Z",
    attemptBankMatch: false,
  };

  it.each([
    ["cash", {}, "Cash payment", "cash:-"],
    ["check", { checkNumber: "1042" }, "Check #1042", "check:1042"],
    ["zelle", { zelleSender: "WILLIAM RUIZ" }, "Zelle from WILLIAM RUIZ", "zelle:WILLIAM RUIZ"],
    ["external-ach", {}, "External ACH", "external-ach:-"],
    ["venmo", { zelleSender: "@williamruiz" }, "Venmo from @williamruiz", "venmo:@williamruiz"],
    ["other", { notes: "Stripe payout refund" }, "Manual payment — Stripe payout refund", "other:-"],
  ])("records a %s payment with the correct description", async (method, extra, expectedDesc, expectedRefId) => {
    await withApp(undefined, async (url) => {
      const res = await fetch(`${url}/api/admin/payments/record`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...baseBody, method, ...extra }),
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.payment.method).toBe(method);
      expect(body.payment.description).toBe(expectedDesc);
      // Amount stored as negative (credit).
      expect(body.payment.amount).toBe(-250);
    });
    expect(ledger).toHaveLength(1);
    expect(ledger[0].entryType).toBe("payment");
    expect(ledger[0].referenceType).toBe("manual-recorded-payment");
    expect(ledger[0].referenceId).toBe(expectedRefId);
    expect(audit).toHaveLength(1);
    expect(audit[0].action).toBe("payment.manual-record");
  });
});

describe("POST /api/admin/payments/record — auto-match invocation", () => {
  const baseBody = {
    associationId: "assoc-1",
    unitId: "unit-1",
    personId: "person-1",
    amount: 250,
    method: "check",
    checkNumber: "9999",
    receivedAt: "2026-05-25T12:00:00Z",
  };

  it("invokes runAutoMatch by default after recording", async () => {
    await withApp(undefined, async (url) => {
      const res = await fetch(`${url}/api/admin/payments/record`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(baseBody),
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.autoMatch).not.toBeNull();
    });
    expect(autoMatchCalls).toEqual(["assoc-1"]);
  });

  it("skips auto-match when attemptBankMatch=false", async () => {
    await withApp(undefined, async (url) => {
      const res = await fetch(`${url}/api/admin/payments/record`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...baseBody, attemptBankMatch: false }),
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.autoMatch).toBeNull();
    });
    expect(autoMatchCalls).toEqual([]);
  });
});

describe("POST /api/admin/payments/record — permission boundary", () => {
  const baseBody = {
    associationId: "assoc-1",
    unitId: "unit-1",
    personId: "person-1",
    amount: 250,
    method: "cash",
    receivedAt: "2026-05-25T12:00:00Z",
    attemptBankMatch: false,
  };

  it("403s for viewer", async () => {
    await withApp({ role: "viewer" }, async (url) => {
      const res = await fetch(`${url}/api/admin/payments/record`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(baseBody),
      });
      expect(res.status).toBe(403);
    });
  });

  it("403s for manager (write is platform-admin + board-officer only)", async () => {
    await withApp({ role: "manager" }, async (url) => {
      const res = await fetch(`${url}/api/admin/payments/record`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(baseBody),
      });
      expect(res.status).toBe(403);
    });
  });

  it("201s for board-officer", async () => {
    await withApp({ role: "board-officer" }, async (url) => {
      const res = await fetch(`${url}/api/admin/payments/record`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(baseBody),
      });
      expect(res.status).toBe(201);
    });
  });

  it("201s for platform-admin", async () => {
    await withApp({ role: "platform-admin" }, async (url) => {
      const res = await fetch(`${url}/api/admin/payments/record`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(baseBody),
      });
      expect(res.status).toBe(201);
    });
  });
});

describe("POST /api/admin/payments/record — validation", () => {
  it("400s on missing associationId", async () => {
    await withApp(undefined, async (url) => {
      const res = await fetch(`${url}/api/admin/payments/record`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "cash", amount: 100, personId: "p1", unitId: "u1", receivedAt: "2026-05-25" }),
      });
      expect(res.status).toBe(400);
    });
  });

  it("400s on negative amount", async () => {
    await withApp(undefined, async (url) => {
      const res = await fetch(`${url}/api/admin/payments/record`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          associationId: "a1",
          personId: "p1",
          unitId: "u1",
          amount: -50,
          method: "cash",
          receivedAt: "2026-05-25",
        }),
      });
      expect(res.status).toBe(400);
    });
  });

  it("400s on invalid method", async () => {
    await withApp(undefined, async (url) => {
      const res = await fetch(`${url}/api/admin/payments/record`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          associationId: "a1",
          personId: "p1",
          unitId: "u1",
          amount: 100,
          method: "bitcoin",
          receivedAt: "2026-05-25",
        }),
      });
      expect(res.status).toBe(400);
    });
  });
});

describe("POST /api/admin/payments/record-bulk", () => {
  it("records 5 rows in one call and runs auto-match once", async () => {
    await withApp(undefined, async (url) => {
      const rows = Array.from({ length: 5 }, (_, i) => ({
        associationId: "assoc-1",
        unitId: `unit-${i + 1}`,
        personId: `person-${i + 1}`,
        amount: 100 + i,
        method: "check",
        checkNumber: `100${i}`,
        receivedAt: "2026-05-25T12:00:00Z",
      }));
      const res = await fetch(`${url}/api/admin/payments/record-bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ associationId: "assoc-1", rows }),
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.recorded).toHaveLength(5);
      expect(body.failures).toHaveLength(0);
    });
    expect(ledger).toHaveLength(5);
    // Auto-match runs once for the whole batch, not once per row.
    expect(autoMatchCalls).toEqual(["assoc-1"]);
  });

  it("returns partial success when some rows fail", async () => {
    await withApp(undefined, async (url) => {
      const rows = [
        // valid
        {
          associationId: "assoc-1",
          unitId: "u1",
          personId: "p1",
          amount: 100,
          method: "cash",
          receivedAt: "2026-05-25",
        },
        // wrong associationId → fails the per-row guard
        {
          associationId: "assoc-other",
          unitId: "u2",
          personId: "p2",
          amount: 200,
          method: "cash",
          receivedAt: "2026-05-25",
        },
      ];
      const res = await fetch(`${url}/api/admin/payments/record-bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ associationId: "assoc-1", rows }),
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.recorded).toHaveLength(1);
      expect(body.failures).toHaveLength(1);
      expect(body.failures[0].index).toBe(1);
    });
  });
});

describe("GET /api/admin/payments/recent", () => {
  it("returns the most-recent N rows in descending postedAt order", async () => {
    await withApp(undefined, async (url) => {
      // Seed three records via the endpoint to populate ledger + audit.
      for (let i = 0; i < 3; i++) {
        const days = i; // 0, 1, 2 days ago
        const dt = new Date(Date.now() - days * 86_400_000).toISOString();
        await fetch(`${url}/api/admin/payments/record`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            associationId: "assoc-1",
            unitId: "u1",
            personId: "p1",
            amount: 100 * (i + 1),
            method: "cash",
            receivedAt: dt,
            attemptBankMatch: false,
          }),
        });
      }
      const res = await fetch(`${url}/api/admin/payments/recent?associationId=assoc-1&limit=20`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.entries).toHaveLength(3);
      // Newest first
      expect(body.entries[0].amount).toBe(-100);
      expect(body.entries[0].method).toBe("cash");
      expect(body.entries[0].actorEmail).toBe("admin@example.com");
    });
  });

  it("400s without associationId", async () => {
    await withApp(undefined, async (url) => {
      const res = await fetch(`${url}/api/admin/payments/recent`);
      expect(res.status).toBe(400);
    });
  });
});
