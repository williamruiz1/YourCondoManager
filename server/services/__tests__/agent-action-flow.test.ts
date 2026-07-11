/**
 * End-to-end gating-flow tests (founder-os#9474, acceptance criteria 1/2/3/5/6).
 *
 * These exercise the REAL service functions (fileAction → approve → execute →
 * getAuditLog) against a faithful in-memory db mock (the same pattern as
 * disbursement-service.test.ts) — proving the permission ladder end-to-end, not
 * a mocked service:
 *   - fileAction assigns the level SERVER-SIDE from the action-type;
 *   - an L3 action CANNOT execute without a recorded human approval;
 *   - an L4 action requires a BOARD-level approver;
 *   - an L2 action honors the per-toggle default;
 *   - an L1 action executes with none;
 *   - every executed action leaves an immutable audit-log entry;
 *   - tenant isolation: an action can't be acted on cross-association.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => {
  type Row = Record<string, any>;
  const actions: Row[] = [];
  const audit: Row[] = [];
  const toggles: Row[] = [];
  const state = { seq: 1 };
  const nextId = (p: string) => `${p}-${String(state.seq++).padStart(4, "0")}`;
  const mk = (name: string, cols: string[]) => {
    const t: any = { __table: name };
    for (const c of cols) Object.defineProperty(t, c, { value: { __col: c }, configurable: true });
    return t;
  };
  const ACT = mk("agentActions", ["id", "associationId", "status", "createdAt", "statutoryDeadline"]);
  const AUD = mk("agentActionAuditLog", ["id", "actionId", "associationId", "createdAt"]);
  const TOG = mk("agentActionToggles", ["id", "associationId", "actionType"]);
  const matches = (row: Row, w: any): boolean => {
    if (!w) return true;
    if (w.op === "eq") return row[w.col.__col] === w.val;
    if (w.op === "inArray") return w.vals.includes(row[w.col.__col]);
    if (w.op === "and") return w.clauses.every((c: any) => matches(row, c));
    return true;
  };
  return { actions, audit, toggles, state, nextId, ACT, AUD, TOG, matches };
});

vi.mock("@shared/schema", () => ({
  agentActions: H.ACT,
  agentActionAuditLog: H.AUD,
  agentActionToggles: H.TOG,
}));

vi.mock("drizzle-orm", () => ({
  eq: (col: any, val: any) => ({ op: "eq", col, val }),
  and: (...clauses: any[]) => ({ op: "and", clauses }),
  inArray: (col: any, vals: any[]) => ({ op: "inArray", col, vals }),
  asc: (col: any) => ({ op: "asc", col }),
  desc: (col: any) => ({ op: "desc", col }),
}));

vi.mock("../../db", () => {
  const { actions, audit, toggles, nextId, matches } = H;
  const tableFor = (t: any) => (t.__table === "agentActions" ? actions : t.__table === "agentActionAuditLog" ? audit : toggles);
  const db = {
    insert(table: any) {
      return {
        values(vals: any) {
          return {
            returning() {
              const prefix = table.__table === "agentActions" ? "act" : table.__table === "agentActionToggles" ? "tog" : "aud";
              const row = { id: nextId(prefix), createdAt: new Date(), updatedAt: new Date(), ...vals };
              tableFor(table).push(row);
              return Promise.resolve([row]);
            },
            then(resolve: any) {
              // insert without .returning() — the audit path.
              const row = { id: nextId("aud"), createdAt: new Date(), ...vals };
              tableFor(table).push(row);
              return Promise.resolve(resolve(undefined));
            },
          };
        },
      };
    },
    select() {
      return {
        from(table: any) {
          const st: { where?: any } = {};
          const chain: any = {
            where(w: any) {
              st.where = w;
              return chain;
            },
            orderBy() {
              return chain;
            },
            then(resolve: any) {
              const out = tableFor(table).filter((r) => matches(r, st.where));
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
              const rows = tableFor(table).filter((r) => matches(r, st.where));
              for (const r of rows) Object.assign(r, vals);
              return Promise.resolve(rows);
            },
            then(resolve: any) {
              const rows = tableFor(table).filter((r) => matches(r, st.where));
              for (const r of rows) Object.assign(r, vals);
              return Promise.resolve(resolve(undefined));
            },
          };
          return chain;
        },
      };
    },
  };
  return { db };
});

import {
  fileAction,
  approveAction,
  rejectAction,
  executeAction,
  listQueue,
  getAuditLog,
  setToggle,
  AgentActionError,
} from "../agent-action-service";

const ASSOC = "assoc-1";
const boardApprover = { adminUserId: "u-board", email: "board@x.com", role: "board-officer" };
const mgrApprover = { adminUserId: "u-mgr", email: "mgr@x.com", role: "manager" };

beforeEach(() => {
  H.actions.length = 0;
  H.audit.length = 0;
  H.toggles.length = 0;
  H.state.seq = 1;
});

describe("fileAction — server-authoritative level + filed audit", () => {
  it("assigns level from the action-type and writes a 'filed' audit row", async () => {
    const a = await fileAction({ associationId: ASSOC, actionType: "financial.approve_disbursement", reasoning: "vendor invoice due", createdByAgent: "ycm-cos" });
    expect(a.level).toBe("L3");
    expect(a.status).toBe("queued");
    const log = await getAuditLog(a.id, ASSOC);
    expect(log.map((e) => e.event)).toEqual(["filed"]);
    expect(log[0].actorType).toBe("agent");
  });

  it("an unknown action-type fails closed to L3", async () => {
    const a = await fileAction({ associationId: ASSOC, actionType: "novel.unmapped", reasoning: "?", createdByAgent: "cos" });
    expect(a.level).toBe("L3");
  });
});

describe("L3 — CANNOT execute without a recorded human approval", () => {
  it("execute before approval throws APPROVAL_REQUIRED; after approval it executes + audits", async () => {
    const a = await fileAction({ associationId: ASSOC, actionType: "financial.post_ledger_entry", reasoning: "post accrual", createdByAgent: "cos" });
    await expect(executeAction(a.id, ASSOC, { actorType: "human" })).rejects.toMatchObject({ code: "APPROVAL_REQUIRED" });

    const approved = await approveAction(a.id, ASSOC, mgrApprover);
    expect(approved.status).toBe("approved");
    const executed = await executeAction(a.id, ASSOC, { actorType: "human", actorId: mgrApprover.adminUserId });
    expect(executed.status).toBe("executed");
    expect(executed.executedAt).toBeInstanceOf(Date);

    const log = await getAuditLog(a.id, ASSOC);
    expect(log.map((e) => e.event)).toEqual(["filed", "approved", "executed"]);
  });
});

describe("L4 — requires a BOARD-level approver", () => {
  it("a non-board approver is refused; a board approver can approve then execute", async () => {
    const a = await fileAction({ associationId: ASSOC, actionType: "board.record_vote", reasoning: "record the motion", createdByAgent: "cos" });
    expect(a.level).toBe("L4");
    await expect(approveAction(a.id, ASSOC, mgrApprover)).rejects.toMatchObject({ code: "BOARD_APPROVAL_REQUIRED" });
    await approveAction(a.id, ASSOC, boardApprover);
    const executed = await executeAction(a.id, ASSOC, { actorType: "human", actorId: boardApprover.adminUserId });
    expect(executed.status).toBe("executed");
  });
});

describe("L2 — honors the per-toggle default", () => {
  it("toggle OFF → execute refused; toggle ON → executes with no approval", async () => {
    const a = await fileAction({ associationId: ASSOC, actionType: "reversible.tag_record", reasoning: "tag as duplicate", createdByAgent: "cos" });
    expect(a.level).toBe("L2");
    await expect(executeAction(a.id, ASSOC, { actorType: "system" })).rejects.toMatchObject({ code: "APPROVAL_REQUIRED" });

    await setToggle(ASSOC, "reversible.tag_record", true);
    const executed = await executeAction(a.id, ASSOC, { actorType: "system" });
    expect(executed.status).toBe("executed");
    const log = await getAuditLog(a.id, ASSOC);
    expect(log.some((e) => e.event === "executed")).toBe(true);
  });
});

describe("L1 — executes with no approval", () => {
  it("an L1 action executes immediately and leaves filed+executed audit", async () => {
    const a = await fileAction({ associationId: ASSOC, actionType: "suggest.summary", reasoning: "here's the month recap", createdByAgent: "cos" });
    expect(a.level).toBe("L1");
    const executed = await executeAction(a.id, ASSOC, { actorType: "agent", actorId: "cos" });
    expect(executed.status).toBe("executed");
    expect((await getAuditLog(a.id, ASSOC)).map((e) => e.event)).toEqual(["filed", "executed"]);
  });
});

describe("tenant isolation", () => {
  it("an action cannot be approved or executed from a different association", async () => {
    const a = await fileAction({ associationId: ASSOC, actionType: "financial.issue_refund", reasoning: "refund overpay", createdByAgent: "cos" });
    await expect(approveAction(a.id, "assoc-OTHER", boardApprover)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(executeAction(a.id, "assoc-OTHER", { actorType: "human" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("listQueue — the severity-ranked, statutory-pinned surface", () => {
  it("returns queued+approved items with reasoning, statutory pinned to top", async () => {
    const soon = new Date(Date.now() + 86400_000);
    await fileAction({ associationId: ASSOC, actionType: "suggest.summary", reasoning: "low prio", createdByAgent: "cos", severity: "low" });
    const stat = await fileAction({ associationId: ASSOC, actionType: "irreversible.send_owner_notice", reasoning: "statutory notice due", createdByAgent: "cos", severity: "medium", statutoryDeadline: soon });
    const queue = await listQueue(ASSOC);
    expect(queue.length).toBe(2);
    expect(queue[0].id).toBe(stat.id); // statutory pinned to top
    expect(queue[0].reasoning).toBe("statutory notice due");
  });

  it("a rejected action drops off the default queue", async () => {
    const a = await fileAction({ associationId: ASSOC, actionType: "reversible.draft_notice", reasoning: "draft", createdByAgent: "cos" });
    await rejectAction(a.id, ASSOC, mgrApprover, "not needed");
    const queue = await listQueue(ASSOC);
    expect(queue.find((x) => x.id === a.id)).toBeUndefined();
  });
});
