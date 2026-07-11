/**
 * ARC workflow service tests — founder-os dispatch #9481.
 *
 * Exercises the REAL service logic against an in-memory db mock (same technique
 * as disbursement-service.test.ts). Proves the acceptance criteria:
 *
 *   AC1  intake → routing (submitted → under-review), with attachments.
 *   AC2  decision (approve/deny + reasoning) captured + persisted; appeal path.
 *   AC3  a DENIAL is L4 (member-affecting) and CANNOT be actuated by the agent
 *        alone — the L4 gate refuses a non-human actor (and a non-board role).
 *   AC4  the decision record is retrievable (getArcRequest / listArcRequests).
 *   +    tenant isolation; every mutating step writes an audit row.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── In-memory tables + sentinels (hoisted for vi.mock factories) ──────────────
const H = vi.hoisted(() => {
  type Row = Record<string, any>;
  const arcTable: Row[] = [];
  const auditTable: Row[] = [];
  const state = { idSeq: 1 };
  const nextId = () => `arc-${String(state.idSeq++).padStart(4, "0")}`;
  const ARC = { __table: "arcRequests" } as any;
  const AUDIT = { __table: "auditLogs" } as any;
  for (const col of ["id", "associationId", "status", "unitId", "createdAt"]) {
    Object.defineProperty(ARC, col, { value: { __col: col }, configurable: true });
  }
  const matches = (row: Row, where: any): boolean => {
    if (!where) return true;
    if (where.op === "eq") return row[where.col.__col] === where.val;
    if (where.op === "and") return where.clauses.every((c: any) => matches(row, c));
    return true;
  };
  return { arcTable, auditTable, state, nextId, ARC, AUDIT, matches };
});

const { arcTable, auditTable, state, nextId, matches } = H;

vi.mock("@shared/schema", () => ({
  arcRequests: H.ARC,
  auditLogs: H.AUDIT,
  // agent-action-service (imported transitively) references these at module top
  // level for value imports; it never touches them in the pure ladder functions
  // this suite exercises, so bare sentinels are sufficient.
  agentActions: { __table: "agentActions" },
  agentActionAuditLog: { __table: "agentActionAuditLog" },
  agentActionToggles: { __table: "agentActionToggles" },
}));

vi.mock("drizzle-orm", () => {
  const eq = (col: any, val: any) => ({ op: "eq", col, val });
  const and = (...clauses: any[]) => ({ op: "and", clauses });
  const desc = (col: any) => ({ op: "desc", col });
  const asc = (col: any) => ({ op: "asc", col });
  const inArray = (col: any, vals: any[]) => ({ op: "inArray", col, vals });
  return { eq, and, desc, asc, inArray };
});

vi.mock("../../db", () => {
  const { arcTable, auditTable, nextId, matches } = H;
  const db = {
    insert(table: any) {
      return {
        values(vals: any) {
          return {
            returning() {
              if (table.__table === "arcRequests") {
                const row = {
                  id: nextId(),
                  unitId: null,
                  category: null,
                  attachments: [],
                  submittedByType: "owner",
                  submittedByPersonId: null,
                  submittedByAdminUserId: null,
                  routedByAdminUserId: null,
                  routedByEmail: null,
                  routedAt: null,
                  committeeNote: null,
                  decidedByAdminUserId: null,
                  decidedByEmail: null,
                  decidedAt: null,
                  decisionReason: null,
                  appealReason: null,
                  appealedByEmail: null,
                  appealedAt: null,
                  appealDecidedByAdminUserId: null,
                  appealDecidedByEmail: null,
                  appealDecidedAt: null,
                  appealDecisionReason: null,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  ...vals,
                };
                arcTable.push(row);
                return Promise.resolve([row]);
              }
              return Promise.resolve([{ id: nextId(), ...vals }]);
            },
            then(resolve: any) {
              if (table.__table === "auditLogs") auditTable.push({ id: nextId(), ...vals });
              return Promise.resolve(resolve(undefined));
            },
          };
        },
      };
    },
    select() {
      return {
        from(table: any) {
          const st: { where?: any; order?: any; limit?: number } = {};
          const chain: any = {
            where(w: any) {
              st.where = w;
              return chain;
            },
            orderBy(o: any) {
              st.order = o;
              return chain;
            },
            limit() {
              return chain;
            },
            then(resolve: any) {
              const source = table.__table === "arcRequests" ? arcTable : auditTable;
              let out = source.filter((r) => matches(r, st.where));
              if (st.order?.op === "desc") {
                const col = st.order.col.__col;
                out = out.slice().sort((a, b) => (a[col] > b[col] ? -1 : a[col] < b[col] ? 1 : 0));
              }
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
          const st: { where?: any } = {};
          const chain: any = {
            where(w: any) {
              st.where = w;
              return chain;
            },
            returning() {
              const source = table.__table === "arcRequests" ? arcTable : auditTable;
              const updated: any[] = [];
              for (const r of source) {
                if (matches(r, st.where)) {
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

// Import AFTER mocks.
import {
  appealArcDenial,
  ArcError,
  getArcRequest,
  listArcRequests,
  recordAppealDecision,
  recordArcDecision,
  routeArcRequest,
  submitArcRequest,
} from "../arc-service";
import { levelForActionType } from "../agent-action-service";

const ASSOC = "assoc-1";
const OWNER = { actorType: "human" as const, email: "owner@example.com", personId: "person-1" };
const AGENT = { actorType: "agent" as const, email: "cos-agent@ycm" };
const BOARD = {
  actorType: "human" as const,
  email: "board@example.com",
  adminUserId: "admin-board",
  role: "board-officer" as const,
};
const MANAGER = {
  actorType: "human" as const,
  email: "mgr@example.com",
  adminUserId: "admin-mgr",
  role: "manager" as const,
};

async function makeSubmitted(actor = OWNER) {
  return submitArcRequest(
    {
      associationId: ASSOC,
      unitId: "unit-7",
      title: "New cedar privacy fence",
      category: "fence",
      description: "6ft cedar fence along the rear property line.",
      attachments: [{ name: "site-plan.pdf", url: "https://files/x/site-plan.pdf" }],
      submittedByType: "owner",
    },
    actor,
  );
}

async function makeUnderReview() {
  const r = await makeSubmitted();
  return routeArcRequest(r.id, ASSOC, BOARD);
}

beforeEach(() => {
  arcTable.length = 0;
  auditTable.length = 0;
  state.idSeq = 1;
  vi.clearAllMocks();
});

describe("AC1 — intake + committee routing", () => {
  it("owner submits a request with attachments; status = submitted", async () => {
    const r = await makeSubmitted();
    expect(r.status).toBe("submitted");
    expect(r.title).toBe("New cedar privacy fence");
    expect(r.attachments).toHaveLength(1);
    expect(r.submittedByType).toBe("owner");
    expect(r.submittedByPersonId).toBe("person-1");
  });

  it("intake requires a title and a description", async () => {
    await expect(
      submitArcRequest(
        { associationId: ASSOC, title: "", description: "x" } as any,
        OWNER,
      ),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("routes a submitted request to committee (submitted → under-review)", async () => {
    const r = await makeSubmitted();
    const routed = await routeArcRequest(r.id, ASSOC, BOARD, "Assigned to the ARC committee.");
    expect(routed.status).toBe("under-review");
    expect(routed.routedByEmail).toBe(BOARD.email);
    expect(routed.committeeNote).toBe("Assigned to the ARC committee.");
  });

  it("cannot route a request that is not submitted", async () => {
    const r = await makeUnderReview();
    await expect(routeArcRequest(r.id, ASSOC, BOARD)).rejects.toMatchObject({
      code: "INVALID_TRANSITION",
    });
  });

  it("routing is L2 plumbing an AGENT may perform", async () => {
    const r = await makeSubmitted();
    const routed = await routeArcRequest(r.id, ASSOC, AGENT);
    expect(routed.status).toBe("under-review");
  });
});

describe("AC3 — the DENIAL is L4 and an agent alone CANNOT actuate it", () => {
  it("the ARC decision action-type is L4 in the canonical ladder", () => {
    expect(levelForActionType("member.arc_decision")).toBe("L4");
    expect(levelForActionType("member.arc_appeal_decision")).toBe("L4");
  });

  it("an AGENT cannot record a DENIAL (AGENT_DECISION_FORBIDDEN) — the request is unchanged", async () => {
    const r = await makeUnderReview();
    await expect(
      recordArcDecision(r.id, ASSOC, "denied", "Violates the 4ft fence covenant.", AGENT),
    ).rejects.toMatchObject({ code: "AGENT_DECISION_FORBIDDEN" });
    // No state change — the agent's attempt did nothing.
    expect(arcTable[0].status).toBe("under-review");
    expect(arcTable[0].decidedByAdminUserId).toBeNull();
  });

  it("an AGENT cannot record an APPROVAL either (L4 blocks both)", async () => {
    const r = await makeUnderReview();
    await expect(
      recordArcDecision(r.id, ASSOC, "approved", "Looks fine.", AGENT),
    ).rejects.toMatchObject({ code: "AGENT_DECISION_FORBIDDEN" });
  });

  it("a non-board HUMAN (manager) cannot record a decision (BOARD_APPROVAL_REQUIRED)", async () => {
    const r = await makeUnderReview();
    await expect(
      recordArcDecision(r.id, ASSOC, "denied", "No.", MANAGER),
    ).rejects.toMatchObject({ code: "BOARD_APPROVAL_REQUIRED" });
  });

  it("the L4 gate fires BEFORE any transition check (agent on a non-under-review row still 403s)", async () => {
    const r = await makeSubmitted(); // status submitted, not under-review
    await expect(
      recordArcDecision(r.id, ASSOC, "denied", "x", AGENT),
    ).rejects.toMatchObject({ code: "AGENT_DECISION_FORBIDDEN" });
  });
});

describe("AC2/AC4 — decision capture, persistence, retrieval, appeal path", () => {
  it("a board member DENIES with reasoning; it persists and is retrievable", async () => {
    const r = await makeUnderReview();
    const denied = await recordArcDecision(
      r.id,
      ASSOC,
      "denied",
      "Exceeds the 4ft height covenant (Art. VII §3).",
      BOARD,
    );
    expect(denied.status).toBe("denied");
    expect(denied.decisionReason).toBe("Exceeds the 4ft height covenant (Art. VII §3).");
    expect(denied.decidedByAdminUserId).toBe("admin-board");
    expect(denied.decidedAt).toBeInstanceOf(Date);
    // Retrievable (board memory).
    const fetched = await getArcRequest(r.id, ASSOC);
    expect(fetched.status).toBe("denied");
    expect(fetched.decisionReason).toContain("4ft height covenant");
  });

  it("a board member APPROVES with reasoning", async () => {
    const r = await makeUnderReview();
    const approved = await recordArcDecision(r.id, ASSOC, "approved", "Matches existing units.", BOARD);
    expect(approved.status).toBe("approved");
    expect(approved.decisionReason).toBe("Matches existing units.");
  });

  it("a decision requires a reason", async () => {
    const r = await makeUnderReview();
    await expect(
      recordArcDecision(r.id, ASSOC, "approved", "   ", BOARD),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("full appeal path: deny → owner appeals → board decides the appeal (L4)", async () => {
    const r = await makeUnderReview();
    await recordArcDecision(r.id, ASSOC, "denied", "Covenant violation.", BOARD);
    const appealed = await appealArcDenial(r.id, ASSOC, "The neighbor has an identical fence.", OWNER);
    expect(appealed.status).toBe("appealed");
    expect(appealed.appealReason).toContain("identical fence");

    // An agent cannot decide the appeal (L4).
    await expect(
      recordAppealDecision(r.id, ASSOC, "appeal-approved", "ok", AGENT),
    ).rejects.toMatchObject({ code: "AGENT_DECISION_FORBIDDEN" });

    const resolved = await recordAppealDecision(
      r.id,
      ASSOC,
      "appeal-approved",
      "Granted — precedent applies.",
      BOARD,
    );
    expect(resolved.status).toBe("appeal-approved");
    expect(resolved.appealDecisionReason).toBe("Granted — precedent applies.");
  });

  it("cannot appeal a request that was not denied", async () => {
    const r = await makeUnderReview();
    await recordArcDecision(r.id, ASSOC, "approved", "Approved.", BOARD);
    await expect(appealArcDenial(r.id, ASSOC, "reason", OWNER)).rejects.toMatchObject({
      code: "INVALID_TRANSITION",
    });
  });

  it("cannot decide a request that is not under-review", async () => {
    const r = await makeSubmitted(); // still submitted
    await expect(
      recordArcDecision(r.id, ASSOC, "approved", "x", BOARD),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });
});

describe("tenant isolation + retrieval", () => {
  it("refuses to act on a request from another association", async () => {
    const r = await makeUnderReview();
    await expect(
      recordArcDecision(r.id, "assoc-OTHER", "denied", "x", BOARD),
    ).rejects.toMatchObject({ code: "ASSOCIATION_SCOPE" });
  });

  it("throws NOT_FOUND for an unknown id", async () => {
    await expect(getArcRequest("nope", ASSOC)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("list is scoped to the requested association and filterable by status", async () => {
    await makeSubmitted();
    await submitArcRequest(
      { associationId: "assoc-2", title: "Deck", description: "New deck." },
      OWNER,
    );
    const rows = await listArcRequests({ associationId: ASSOC });
    expect(rows).toHaveLength(1);
    expect(rows[0].associationId).toBe(ASSOC);

    const submitted = await listArcRequests({ associationId: ASSOC, status: "submitted" });
    expect(submitted).toHaveLength(1);
    const denied = await listArcRequests({ associationId: ASSOC, status: "denied" });
    expect(denied).toHaveLength(0);
  });
});

describe("audit trail", () => {
  it("writes an audit row for submit, route, deny, appeal, and appeal decision", async () => {
    const r = await makeUnderReview();
    await recordArcDecision(r.id, ASSOC, "denied", "Covenant.", BOARD);
    await appealArcDenial(r.id, ASSOC, "Appeal reason.", OWNER);
    await recordAppealDecision(r.id, ASSOC, "appeal-denied", "Upheld.", BOARD);
    const actions = auditTable.map((a) => a.action);
    expect(actions).toContain("arc.submit");
    expect(actions).toContain("arc.route");
    expect(actions).toContain("arc.deny");
    expect(actions).toContain("arc.appeal");
    expect(actions).toContain("arc.appeal_deny");
    const denyAudit = auditTable.find((a) => a.action === "arc.deny");
    expect(denyAudit.actorEmail).toBe(BOARD.email);
    expect(denyAudit.entityType).toBe("arc_request");
    expect(denyAudit.associationId).toBe(ASSOC);
    expect(denyAudit.afterJson.level).toBe("L4");
  });

  it("error class is an ArcError with a stable code", async () => {
    const r = await makeUnderReview();
    const err = await recordArcDecision(r.id, ASSOC, "denied", "x", AGENT).catch((e) => e);
    expect(err).toBeInstanceOf(ArcError);
    expect(err.code).toBe("AGENT_DECISION_FORBIDDEN");
  });
});
