/**
 * Maker-checker (segregation of duties) enforcement tests for the disbursement
 * dual-approval service — HOA Remediation Phase 2.
 *
 * These exercise the REAL service logic against an in-memory db mock that
 * implements the exact drizzle chain shapes the service calls. The point is to
 * prove the money-OUT control server-side:
 *
 *   1. A person CANNOT approve/reject a disbursement they created (maker ≠ checker).
 *   2. A DIFFERENT authorized person CAN approve/reject it.
 *   3. Status transitions are enforced (approve only pending; pay only approved).
 *   4. Tenant isolation — a disbursement can't be acted on cross-association.
 *   5. Every create/approve/reject/pay writes an audit row.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── In-memory tables + sentinels (hoisted so vi.mock factories can use them) ──
// vi.mock is hoisted above normal top-level consts, so the shared mock state
// must be created via vi.hoisted() to be initialized before the factories run.
const H = vi.hoisted(() => {
  type Row = Record<string, any>;
  const disbursementsTable: Row[] = [];
  const auditTable: Row[] = [];
  const state = { idSeq: 1 };
  const nextId = () => `disb-${String(state.idSeq++).padStart(4, "0")}`;
  // Tagged sentinels standing in for the schema table objects.
  const DISB = { __table: "disbursements" } as any;
  const AUDIT = { __table: "auditLogs" } as any;
  // Tag the columns the service references so the mock can resolve them.
  for (const col of ["id", "associationId", "status", "createdAt"]) {
    Object.defineProperty(DISB, col, { value: { __col: col }, configurable: true });
  }
  const matches = (row: Row, where: any): boolean => {
    if (!where) return true;
    if (where.op === "eq") return row[where.col.__col] === where.val;
    if (where.op === "and") return where.clauses.every((c: any) => matches(row, c));
    return true;
  };
  return { disbursementsTable, auditTable, state, nextId, DISB, AUDIT, matches };
});

const { disbursementsTable, auditTable, state, nextId, DISB, AUDIT, matches } = H;

vi.mock("@shared/schema", () => ({
  disbursements: H.DISB,
  auditLogs: H.AUDIT,
}));

// drizzle-orm helpers → simple predicate builders the mock can evaluate.
vi.mock("drizzle-orm", () => {
  const eq = (col: any, val: any) => ({ op: "eq", col, val });
  const and = (...clauses: any[]) => ({ op: "and", clauses });
  const desc = (col: any) => ({ op: "desc", col });
  return { eq, and, desc };
});

vi.mock("../../db", () => {
  const { disbursementsTable, auditTable, nextId, matches } = H;
  const db = {
    insert(table: any) {
      return {
        values(vals: any) {
          const chain = {
            returning() {
              if (table.__table === "disbursements") {
                const row = {
                  id: nextId(),
                  vendorId: null,
                  vendorInvoiceId: null,
                  memo: null,
                  approvedByAdminUserId: null,
                  approvedByEmail: null,
                  approvedAt: null,
                  rejectedByAdminUserId: null,
                  rejectedByEmail: null,
                  rejectedAt: null,
                  rejectionReason: null,
                  paidAt: null,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  ...vals,
                };
                disbursementsTable.push(row);
                return Promise.resolve([row]);
              }
              return Promise.resolve([{ id: nextId(), ...vals }]);
            },
            then(resolve: any) {
              // insert without returning (auditLogs path)
              if (table.__table === "auditLogs") {
                auditTable.push({ id: nextId(), ...vals });
              }
              return Promise.resolve(resolve(undefined));
            },
          };
          return chain;
        },
      };
    },
    select() {
      return {
        from(table: any) {
          const state: { where?: any; order?: any; limit?: number } = {};
          const chain: any = {
            where(w: any) {
              state.where = w;
              return chain;
            },
            orderBy(o: any) {
              state.order = o;
              return chain;
            },
            limit(n: number) {
              state.limit = n;
              return chain;
            },
            then(resolve: any) {
              const source =
                table.__table === "disbursements" ? disbursementsTable : auditTable;
              let out = source.filter((r) => matches(r, state.where));
              if (state.order?.op === "desc") {
                const col = state.order.col.__col;
                out = out
                  .slice()
                  .sort((a, b) => (a[col] > b[col] ? -1 : a[col] < b[col] ? 1 : 0));
              }
              if (typeof state.limit === "number") out = out.slice(0, state.limit);
              return Promise.resolve(resolve(out));
            },
          };
          return chain;
        },
      };
    },
    update(table: any) {
      return {
        set(vals: any) {
          const state: { where?: any } = {};
          const chain: any = {
            where(w: any) {
              state.where = w;
              return chain;
            },
            returning() {
              const source =
                table.__table === "disbursements" ? disbursementsTable : auditTable;
              const updated: any[] = [];
              for (const r of source) {
                if (matches(r, state.where)) {
                  Object.assign(r, vals);
                  updated.push(r);
                }
              }
              return Promise.resolve(updated);
            },
          };
          return chain;
        },
      };
    },
  };
  return { db };
});

// Import the service AFTER mocks are declared.
import {
  approveDisbursement,
  createDisbursement,
  DisbursementError,
  listDisbursements,
  markDisbursementPaid,
  rejectDisbursement,
  submitDisbursement,
} from "../disbursement-service";

const ASSOC = "assoc-1";
const MAKER = { adminUserId: "admin-maker", email: "maker@example.com" };
const CHECKER = { adminUserId: "admin-checker", email: "checker@example.com" };

async function makePending() {
  return createDisbursement(
    {
      associationId: ASSOC,
      vendorName: "Acme Landscaping",
      amountCents: 125000,
      memo: "June grounds maintenance",
      submitForApproval: true,
    },
    MAKER,
  );
}

beforeEach(() => {
  disbursementsTable.length = 0;
  auditTable.length = 0;
  state.idSeq = 1;
  vi.clearAllMocks();
});

describe("maker ≠ checker enforcement (segregation of duties)", () => {
  it("rejects self-approval: the maker CANNOT approve their own disbursement", async () => {
    const d = await makePending();
    await expect(approveDisbursement(d.id, ASSOC, MAKER)).rejects.toMatchObject({
      code: "SELF_APPROVAL_FORBIDDEN",
    });
    // Row must remain pending — no state change on a blocked self-approval.
    expect(disbursementsTable[0].status).toBe("pending-approval");
    expect(disbursementsTable[0].approvedByAdminUserId).toBeNull();
  });

  it("rejects self-rejection: the maker CANNOT reject their own disbursement", async () => {
    const d = await makePending();
    await expect(
      rejectDisbursement(d.id, ASSOC, MAKER, "changed my mind"),
    ).rejects.toMatchObject({ code: "SELF_APPROVAL_FORBIDDEN" });
    expect(disbursementsTable[0].status).toBe("pending-approval");
  });

  it("allows a DIFFERENT authorized admin to approve", async () => {
    const d = await makePending();
    const approved = await approveDisbursement(d.id, ASSOC, CHECKER);
    expect(approved.status).toBe("approved");
    expect(approved.approvedByAdminUserId).toBe(CHECKER.adminUserId);
    expect(approved.approvedByEmail).toBe(CHECKER.email);
    expect(approved.approvedAt).toBeInstanceOf(Date);
    // maker identity preserved + distinct from checker.
    expect(approved.createdByAdminUserId).toBe(MAKER.adminUserId);
    expect(approved.createdByAdminUserId).not.toBe(approved.approvedByAdminUserId);
  });

  it("allows a DIFFERENT authorized admin to reject with a reason", async () => {
    const d = await makePending();
    const rejected = await rejectDisbursement(d.id, ASSOC, CHECKER, "missing W-9");
    expect(rejected.status).toBe("rejected");
    expect(rejected.rejectedByAdminUserId).toBe(CHECKER.adminUserId);
    expect(rejected.rejectionReason).toBe("missing W-9");
  });
});

describe("status transition enforcement", () => {
  it("cannot approve a draft (only pending-approval)", async () => {
    const draft = await createDisbursement(
      { associationId: ASSOC, vendorName: "V", amountCents: 100, submitForApproval: false },
      MAKER,
    );
    expect(draft.status).toBe("draft");
    await expect(approveDisbursement(draft.id, ASSOC, CHECKER)).rejects.toMatchObject({
      code: "INVALID_TRANSITION",
    });
  });

  it("submit moves draft → pending-approval", async () => {
    const draft = await createDisbursement(
      { associationId: ASSOC, vendorName: "V", amountCents: 100, submitForApproval: false },
      MAKER,
    );
    const submitted = await submitDisbursement(draft.id, ASSOC, MAKER);
    expect(submitted.status).toBe("pending-approval");
  });

  it("cannot pay a pending disbursement (only approved can be paid)", async () => {
    const d = await makePending();
    await expect(markDisbursementPaid(d.id, ASSOC, CHECKER)).rejects.toMatchObject({
      code: "INVALID_TRANSITION",
    });
  });

  it("full happy path: create → approve (by checker) → pay", async () => {
    const d = await makePending();
    await approveDisbursement(d.id, ASSOC, CHECKER);
    const paid = await markDisbursementPaid(d.id, ASSOC, MAKER);
    expect(paid.status).toBe("paid");
    expect(paid.paidAt).toBeInstanceOf(Date);
  });

  it("cannot approve an already-approved disbursement (double-approval blocked)", async () => {
    const d = await makePending();
    await approveDisbursement(d.id, ASSOC, CHECKER);
    await expect(approveDisbursement(d.id, ASSOC, CHECKER)).rejects.toMatchObject({
      code: "INVALID_TRANSITION",
    });
  });
});

describe("tenant isolation", () => {
  it("refuses to act on a disbursement from another association", async () => {
    const d = await makePending();
    await expect(
      approveDisbursement(d.id, "assoc-OTHER", CHECKER),
    ).rejects.toMatchObject({ code: "ASSOCIATION_SCOPE" });
  });

  it("throws NOT_FOUND for an unknown disbursement id", async () => {
    await expect(approveDisbursement("nope", ASSOC, CHECKER)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("list is scoped to the requested association", async () => {
    await makePending();
    await createDisbursement(
      { associationId: "assoc-2", vendorName: "Other", amountCents: 500 },
      MAKER,
    );
    const rows = await listDisbursements({ associationId: ASSOC });
    expect(rows).toHaveLength(1);
    expect(rows[0].associationId).toBe(ASSOC);
  });
});

describe("audit trail", () => {
  it("writes an audit row for create, approve, and pay", async () => {
    const d = await makePending();
    await approveDisbursement(d.id, ASSOC, CHECKER);
    await markDisbursementPaid(d.id, ASSOC, MAKER);
    const actions = auditTable.map((a) => a.action);
    expect(actions).toContain("disbursement.create");
    expect(actions).toContain("disbursement.approve");
    expect(actions).toContain("disbursement.paid");
    // audit rows carry the actor + entity + association.
    const approveAudit = auditTable.find((a) => a.action === "disbursement.approve");
    expect(approveAudit.actorEmail).toBe(CHECKER.email);
    expect(approveAudit.entityType).toBe("disbursement");
    expect(approveAudit.associationId).toBe(ASSOC);
  });

  it("error class is a DisbursementError with a stable code", async () => {
    const d = await makePending();
    const err = await approveDisbursement(d.id, ASSOC, MAKER).catch((e) => e);
    expect(err).toBeInstanceOf(DisbursementError);
    expect(err.code).toBe("SELF_APPROVAL_FORBIDDEN");
  });
});
