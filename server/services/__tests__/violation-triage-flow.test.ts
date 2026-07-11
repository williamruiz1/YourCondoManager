/**
 * Violation-triage end-to-end flow test (founder-os#9479, W2 — AC3 + AC5).
 *
 * Exercises the REAL ability composed with the REAL W1 agent-action service
 * (fileAction → listQueue → getAuditLog → executeAction gate → approveAction →
 * executeAction) against a faithful in-memory db mock — the SAME harness the W1
 * foundation flow test uses. Proves, through actual foundation code (not a fake):
 *   - intake→categorize→draft→route files a real L2 `reversible.draft_notice`
 *     onto the queue with a 'filed' audit entry (AC5);
 *   - the queued draft CANNOT execute without a recorded human approval (AC3 —
 *     the notice cannot issue without a signature);
 *   - after a human approves (signs), the draft executes (finalize+route) — and it
 *     is STILL a draft: no `irreversible.send_owner_notice` (L3 send) action is
 *     ever created here (issuing stays a separate human-approved step);
 *   - tenant isolation: a different association cannot act on the action.
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

import { approveAction, executeAction, listQueue, getAuditLog } from "../agent-action-service";
import { triageAndQueueViolation, DRAFT_NOTICE_ACTION_TYPE, SEND_NOTICE_ACTION_TYPE } from "../violation-triage-service";

const ASSOC = "assoc-1";
const mgrApprover = { adminUserId: "u-mgr", email: "mgr@x.com", role: "manager" };

beforeEach(() => {
  H.actions.length = 0;
  H.audit.length = 0;
  H.toggles.length = 0;
  H.state.seq = 1;
});

describe("violation triage → W1 queue end-to-end (real fileAction)", () => {
  it("files a real L2 draft_notice, refuses to issue without approval, then executes once a human signs — and never creates a send action", async () => {
    // AC5 — intake → categorize → draft → route through the REAL W1 gate.
    const { action, categorization, notice } = await triageAndQueueViolation({
      associationId: ASSOC,
      report: {
        description: "The front lawn is completely overgrown with weeds and dead grass",
        photos: ["lawn1.jpg", "lawn2.jpg"],
        unitLabel: "14C",
        ownerName: "Pat Rivera",
      },
      associationName: "Cherry Hill Court",
    });

    // Categorized + grounded + drafted.
    expect(categorization.category).toBe("landscaping");
    expect(notice.body).toContain(categorization.rule.citation);

    // A real L2 draft_notice row is on the queue with a 'filed' audit entry.
    expect(action.actionType).toBe(DRAFT_NOTICE_ACTION_TYPE);
    expect(action.level).toBe("L2");
    expect(action.status).toBe("queued");
    const queue = await listQueue(ASSOC);
    expect(queue.map((a) => a.id)).toContain(action.id);
    const filedLog = await getAuditLog(action.id, ASSOC);
    expect(filedLog.map((e) => e.event)).toContain("filed");

    // AC3 — the draft CANNOT execute (issue) without a recorded human approval.
    await expect(executeAction(action.id, ASSOC, { actorType: "human" })).rejects.toMatchObject({ code: "APPROVAL_REQUIRED" });

    // A human signs (approves) → the draft may now execute (finalize + route).
    await approveAction(action.id, ASSOC, mgrApprover);
    const executed = await executeAction(action.id, ASSOC, { actorType: "human", actorId: mgrApprover.adminUserId });
    expect(executed.status).toBe("executed");
    // Still a DRAFT — executing an L2 draft finalizes/routes it; it did NOT become
    // a send. Issuing the notice is a separate L3 step, never created here.
    expect(executed.actionType).toBe(DRAFT_NOTICE_ACTION_TYPE);
    expect(H.actions.some((a) => a.actionType === SEND_NOTICE_ACTION_TYPE)).toBe(false);

    // Full audit lifecycle recorded.
    const finalLog = await getAuditLog(action.id, ASSOC);
    expect(finalLog.map((e) => e.event)).toEqual(["filed", "approved", "executed"]);
  });

  it("tenant isolation — another association cannot act on the action", async () => {
    const { action } = await triageAndQueueViolation({
      associationId: ASSOC,
      report: { description: "inoperable truck parked in the driveway" },
    });
    await expect(approveAction(action.id, "other-assoc", mgrApprover)).rejects.toBeTruthy();
    await expect(executeAction(action.id, "other-assoc", { actorType: "human" })).rejects.toBeTruthy();
  });
});
