/**
 * Route-level tests for POST /api/admin/payments/reverse and the Stripe
 * /refund route's ledger-reversal side effect (founder-os#8535 / YCM#286 —
 * wires the tested payment-edge-cases module into live admin routes).
 *
 * Covered:
 *   A1 — role gate: viewer 403; board-officer (treasurer-equivalent) allowed.
 *   A2 — full reversal: posts the equal-and-opposite adjustment, audit row
 *        written, ledger invariant holds (newBalance = prior + amount).
 *   A3 — cumulative cap: partial reversals never exceed the original; a
 *        fully-reversed entry refuses further reversal.
 *   A4 — Stripe-backed entries are refused with USE_STRIPE_REFUND (the money
 *        must move through /refund).
 *   A5 — /refund posts the matching ledger reversal when the charge's ledger
 *        entry exists (ledger + Stripe stay consistent).
 *
 * Mocks: an in-memory owner_ledger_entries table behind the db chains the
 * routes use; refund-service observed, never real.
 */
import express, { type NextFunction, type Request, type Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── In-memory ledger + audit state ───────────────────────────────────────────
type Row = Record<string, any>;
let ledgerRows: Row[] = [];
let auditInserts: Row[] = [];
let idSeq = 0;

vi.mock("../../services/refund-service", () => ({
  isRefundsEnabled: () => true,
  refundConnectCharge: vi.fn(async (params: any) => ({
    refundId: "re_test_9",
    status: "succeeded",
    amountCents: params.amountCents ?? 20000,
    applicationFeeRefunded: true,
    connectedAccountId: "acct_hoa_1",
  })),
}));

vi.mock("../../services/reconciliation/auto-matcher", () => ({
  runAutoMatch: vi.fn(async () => null),
}));

// Minimal drizzle-shaped mock over the in-memory rows. The routes only use:
//   db.select().from(t).where(cond)[.limit(n)]  → filtered rows
//   db.insert(t).values(v)[.returning()]        → audit capture / row insert
// Filtering: drizzle `eq`/`and` produce opaque objects; instead of parsing
// them we capture the *values* the route passes by monkey-patching a query
// context — simplest reliable form: the mock scans conditions by value using
// a recorded call. To keep this dependency-free we filter with the REAL
// drizzle condition objects applied manually: each eq(column, value) carries
// the column's `name` and the value; and(...) nests them.
function condToPredicate(cond: any): (row: Row) => boolean {
  if (!cond) return () => true;
  // drizzle `and(...)` / `eq(...)` produce SQL objects whose queryChunks
  // interleave Column objects (have `.name`), StringChunk objects (have a
  // string[] `.value` but NO `.encoder`), and Param objects (the bound value —
  // discriminated by having an `.encoder`). Pair each Column with the next
  // Param to recover `field = value` clauses.
  const clauses: Array<{ field: string; value: any }> = [];
  function walk(c: any) {
    if (!c || typeof c !== "object") return;
    const chunks = c.queryChunks ?? [];
    let field: string | null = null;
    for (const ch of chunks) {
      if (!ch || typeof ch !== "object") continue;
      if (Array.isArray(ch.queryChunks)) {
        walk(ch);
      } else if (typeof ch.name === "string" && ch.name.length > 0) {
        field = ch.name;
      } else if ("encoder" in ch && "value" in ch && field !== null) {
        clauses.push({ field, value: ch.value });
        field = null;
      }
    }
  }
  walk(cond);
  const camel = (snake: string) => snake.replace(/_([a-z])/g, (_, ch) => ch.toUpperCase());
  return (row: Row) => clauses.every((cl) => row[camel(cl.field)] === cl.value);
}

vi.mock("../../db", () => ({
  db: {
    select: () => ({
      from: (_t: any) => ({
        where: (cond: any) => {
          const rows = ledgerRows.filter(condToPredicate(cond));
          const result: any = Promise.resolve(rows);
          result.limit = (n: number) => Promise.resolve(rows.slice(0, n));
          return result;
        },
      }),
    }),
    insert: (table: any) => ({
      values: (vals: any) => {
        const isLedger =
          vals && typeof vals === "object" && !Array.isArray(vals) && "entryType" in vals;
        if (isLedger) {
          const row = { id: `led-${++idSeq}`, ...vals };
          ledgerRows.push(row);
          const p: any = Promise.resolve();
          p.returning = () => Promise.resolve([row]);
          return p;
        }
        auditInserts.push(vals);
        const p: any = Promise.resolve();
        p.returning = () => Promise.resolve([{ id: `aud-${++idSeq}`, ...vals }]);
        return p;
      },
    }),
  },
}));

import { registerAdminPaymentsRoutes } from "../admin-payments";

function makeApp(role = "platform-admin") {
  const app = express();
  app.use(express.json());
  app.use((req: Request & { adminUserEmail?: string; adminRole?: string }, _res, next) => {
    req.adminUserEmail = "treasurer@example.com";
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
  registerAdminPaymentsRoutes(app, {
    requireAdmin,
    requireAdminRole: requireAdminRole as any,
    getAssociationIdQuery: (req: Request) =>
      typeof req.query.associationId === "string" ? req.query.associationId : undefined,
    assertAssociationScope: (() => {}) as any,
  });
  return app;
}

async function post(app: express.Express, path: string, body: any) {
  const server = await new Promise<{ port: number; close: () => Promise<void> }>((resolve) => {
    const s = app.listen(0, () => {
      const port = (s.address() as { port: number }).port;
      resolve({ port, close: () => new Promise((r) => s.close(() => r(undefined))) });
    });
  });
  try {
    const res = await fetch(`http://127.0.0.1:${server.port}${path}`, {
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

function seedPayment(over: Partial<Row> = {}): Row {
  const row: Row = {
    id: `led-${++idSeq}`,
    associationId: "a1",
    unitId: "u1",
    personId: "p1",
    entryType: "payment",
    amount: -200,
    postedAt: new Date("2026-06-01T00:00:00Z"),
    description: "Check #1042",
    referenceType: "manual-recorded-payment",
    referenceId: "check:1042",
    ...over,
  };
  ledgerRows.push(row);
  return row;
}

beforeEach(() => {
  ledgerRows = [];
  auditInserts = [];
  idSeq = 0;
});
afterEach(() => vi.clearAllMocks());

describe("POST /api/admin/payments/reverse", () => {
  it("A1 viewer is forbidden (role gate)", async () => {
    const target = seedPayment();
    const { status } = await post(makeApp("viewer"), "/api/admin/payments/reverse", {
      associationId: "a1",
      ledgerEntryId: target.id,
      reason: "duplicate payment",
    });
    expect(status).toBe(403);
    expect(ledgerRows).toHaveLength(1); // nothing written
  });

  it("A1 board-officer (treasurer-equivalent) is allowed", async () => {
    const target = seedPayment();
    const { status } = await post(makeApp("board-officer"), "/api/admin/payments/reverse", {
      associationId: "a1",
      ledgerEntryId: target.id,
      reason: "duplicate payment",
    });
    expect(status).toBe(201);
  });

  it("A2 full reversal posts the equal-and-opposite adjustment + audit; invariant holds", async () => {
    // A charge (+200) and its payment (−200): balance 0 before reversal.
    seedPayment({ entryType: "assessment", amount: 200, referenceType: null, referenceId: null });
    const target = seedPayment();

    const { status, json } = await post(makeApp("platform-admin"), "/api/admin/payments/reverse", {
      associationId: "a1",
      ledgerEntryId: target.id,
      reason: "owner paid twice on 6/28",
    });
    expect(status).toBe(201);
    expect(json.reversal.reversedEntryId).toBe(target.id);
    expect(json.reversal.amountReversed).toBe(200);
    // Ledger invariant: reversing a −200 receipt raises the balance by +200.
    expect(json.reversal.newBalance).toBe(json.reversal.priorBalance + 200);

    // Forward-only: original untouched; a new POSITIVE adjustment references it.
    const reversal = ledgerRows.find((r) => r.referenceType === "refund-reversal");
    expect(reversal).toBeTruthy();
    expect(reversal!.entryType).toBe("adjustment");
    expect(reversal!.amount).toBe(200);
    expect(reversal!.referenceId).toBe(target.id);
    expect(ledgerRows.find((r) => r.id === target.id)!.amount).toBe(-200);

    // Audited with who/what/why.
    const audit = auditInserts.find((a) => a.action === "payment.reverse");
    expect(audit).toBeTruthy();
    expect(audit!.actorEmail).toBe("treasurer@example.com");
    expect(audit!.afterJson.reason).toBe("owner paid twice on 6/28");
    expect(audit!.afterJson.amountReversed).toBe(200);
  });

  it("A3 cumulative cap: partials never exceed the original; fully-reversed refuses more", async () => {
    const target = seedPayment();
    const app = makeApp("platform-admin");

    const p1 = await post(app, "/api/admin/payments/reverse", {
      associationId: "a1",
      ledgerEntryId: target.id,
      amount: 150,
      reason: "partial refund per board vote",
    });
    expect(p1.status).toBe(201);

    // 150 already reversed → only 50 remains; 100 must be refused.
    const p2 = await post(app, "/api/admin/payments/reverse", {
      associationId: "a1",
      ledgerEntryId: target.id,
      amount: 100,
      reason: "second partial",
    });
    expect(p2.status).toBe(400);
    expect(p2.json.code).toBe("EXCEEDS_REMAINING");

    // The exact remainder is fine…
    const p3 = await post(app, "/api/admin/payments/reverse", {
      associationId: "a1",
      ledgerEntryId: target.id,
      amount: 50,
      reason: "remainder",
    });
    expect(p3.status).toBe(201);

    // …and once fully reversed, any further attempt is refused.
    const p4 = await post(app, "/api/admin/payments/reverse", {
      associationId: "a1",
      ledgerEntryId: target.id,
      amount: 1,
      reason: "should fail",
    });
    expect(p4.status).toBe(400);
    expect(p4.json.code).toBe("ALREADY_REVERSED");
  });

  it("A4 Stripe-backed receipts are refused with a pointer to /refund", async () => {
    const target = seedPayment({ referenceType: "stripe_charge", referenceId: "ch_live_1" });
    const { status, json } = await post(makeApp("platform-admin"), "/api/admin/payments/reverse", {
      associationId: "a1",
      ledgerEntryId: target.id,
      reason: "should not ledger-reverse a stripe receipt",
    });
    expect(status).toBe(409);
    expect(json.code).toBe("USE_STRIPE_REFUND");
    expect(ledgerRows).toHaveLength(1);
  });

  it("404s an entry that belongs to a different association", async () => {
    const target = seedPayment({ associationId: "OTHER" });
    const { status, json } = await post(makeApp("platform-admin"), "/api/admin/payments/reverse", {
      associationId: "a1",
      ledgerEntryId: target.id,
      reason: "cross-association attempt",
    });
    expect(status).toBe(404);
    expect(json.code).toBe("ENTRY_NOT_FOUND");
  });

  it("requires a reason", async () => {
    const target = seedPayment();
    const { status, json } = await post(makeApp("platform-admin"), "/api/admin/payments/reverse", {
      associationId: "a1",
      ledgerEntryId: target.id,
    });
    expect(status).toBe(400);
    expect(json.code).toBe("INVALID_INPUT");
  });
});

describe("POST /api/admin/payments/refund — ledger-reversal side effect (A5)", () => {
  it("posts the matching ledger reversal when the charge's ledger entry exists", async () => {
    const chargeEntry = seedPayment({
      amount: -200,
      referenceType: "stripe_charge",
      referenceId: "ch_live_1",
      description: "Stripe payment",
    });

    const { status, json } = await post(makeApp("platform-admin"), "/api/admin/payments/refund", {
      associationId: "a1",
      chargeId: "ch_live_1",
      amountCents: 20000,
    });
    expect(status).toBe(201);
    expect(json.refund.refundId).toBe("re_test_9");
    // Ledger + Stripe stay consistent: the reversal posted for the same amount.
    expect(json.ledgerReversal).toBeTruthy();
    expect(json.ledgerReversal.amountReversed).toBe(200);
    expect(json.ledgerReversal.reversedEntryId).toBe(chargeEntry.id);
    const reversal = ledgerRows.find((r) => r.referenceType === "refund-reversal");
    expect(reversal).toBeTruthy();
    expect(reversal!.amount).toBe(200);
    // Both the Stripe refund and the ledger reversal are audited.
    expect(auditInserts.some((a) => a.action === "payment.refund")).toBe(true);
    expect(auditInserts.some((a) => a.action === "payment.refund-ledger-reversal")).toBe(true);
  });

  it("fail-soft: refund still succeeds (201) when no ledger entry exists for the charge", async () => {
    const { status, json } = await post(makeApp("platform-admin"), "/api/admin/payments/refund", {
      associationId: "a1",
      chargeId: "ch_never_recorded",
    });
    expect(status).toBe(201);
    expect(json.refund.refundId).toBe("re_test_9");
    expect(json.ledgerReversal).toBeNull();
  });
});
