/**
 * Meeting-prep end-to-end flow test (founder-os#9478).
 *
 * Exercises the REAL data-fetching implementations (`defaultMeetingPrepDataDeps`)
 * against a faithful in-memory db mock covering every source table
 * (maintenance_requests, records_requests, work_orders, agent_actions,
 * governance_meetings, meeting_notes) — the SAME harness shape
 * `violation-triage-flow.test.ts` uses for the W1 foundation tables. Proves,
 * through actual read code (not fakes):
 *
 *  1. Aggregation pulls from each source AND respects associationId isolation
 *     — a second association's rows never leak into the first's activity.
 *  3. The orchestrator (`prepareMeetingPacket`) files a REAL L1
 *     `suggest.meeting_prep` action through the REAL W1 `fileAction` (not a
 *     mock), with the packet as payload + traceable reasoning, and it is
 *     visible on the real `listQueue` surface afterward.
 *  5. End-to-end (mocked DB): aggregate → draft → queue, verified.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => {
  type Row = Record<string, any>;
  const state = { seq: 1 };
  const nextId = (p: string) => `${p}-${String(state.seq++).padStart(4, "0")}`;

  const tables: Record<string, Row[]> = {
    maintenanceRequests: [],
    recordsRequests: [],
    workOrders: [],
    agentActions: [],
    agentActionAuditLog: [],
    agentActionToggles: [],
    governanceMeetings: [],
    meetingNotes: [],
  };

  const mk = (name: string, cols: string[]) => {
    const t: any = { __table: name };
    for (const c of cols) Object.defineProperty(t, c, { value: { __col: c }, configurable: true });
    return t;
  };

  const MR = mk("maintenanceRequests", ["id", "associationId", "status", "createdAt", "responseDueAt"]);
  const RR = mk("recordsRequests", ["id", "associationId", "status", "createdAt", "responseDueAt"]);
  const WO = mk("workOrders", ["id", "associationId", "status", "createdAt", "scheduledFor"]);
  const ACT = mk("agentActions", ["id", "associationId", "status", "createdAt", "statutoryDeadline", "actionType"]);
  const AUD = mk("agentActionAuditLog", ["id", "actionId", "associationId", "createdAt"]);
  const TOG = mk("agentActionToggles", ["id", "associationId", "actionType"]);
  const GM = mk("governanceMeetings", ["id", "associationId", "status", "scheduledAt"]);
  const MN = mk("meetingNotes", ["id", "meetingId", "createdAt"]);

  const matches = (row: Row, w: any): boolean => {
    if (!w) return true;
    switch (w.op) {
      case "eq":
        return row[w.col.__col] === w.val;
      case "inArray":
        return w.vals.includes(row[w.col.__col]);
      case "notInArray":
        return !w.vals.includes(row[w.col.__col]);
      case "lt": {
        const rowVal = row[w.col.__col];
        const rn = rowVal instanceof Date ? rowVal.getTime() : rowVal;
        const wn = w.val instanceof Date ? w.val.getTime() : w.val;
        return rn < wn;
      }
      case "and":
        return w.clauses.every((c: any) => matches(row, c));
      default:
        return true;
    }
  };

  const sortBy = (rows: Row[], order: any): Row[] => {
    if (!order) return rows;
    const dir = order.op === "desc" ? -1 : 1;
    const col = order.col.__col;
    return [...rows].sort((a, b) => {
      const av = a[col];
      const bv = b[col];
      const an = av instanceof Date ? av.getTime() : av;
      const bn = bv instanceof Date ? bv.getTime() : bv;
      if (an < bn) return -1 * dir;
      if (an > bn) return 1 * dir;
      return 0;
    });
  };

  return { tables, mk, MR, RR, WO, ACT, AUD, TOG, GM, MN, matches, sortBy, state, nextId };
});

vi.mock("@shared/schema", () => ({
  maintenanceRequests: H.MR,
  recordsRequests: H.RR,
  workOrders: H.WO,
  agentActions: H.ACT,
  agentActionAuditLog: H.AUD,
  agentActionToggles: H.TOG,
  governanceMeetings: H.GM,
  meetingNotes: H.MN,
}));

vi.mock("drizzle-orm", () => ({
  eq: (col: any, val: any) => ({ op: "eq", col, val }),
  and: (...clauses: any[]) => ({ op: "and", clauses }),
  inArray: (col: any, vals: any[]) => ({ op: "inArray", col, vals }),
  notInArray: (col: any, vals: any[]) => ({ op: "notInArray", col, vals }),
  lt: (col: any, val: any) => ({ op: "lt", col, val }),
  asc: (col: any) => ({ op: "asc", col }),
  desc: (col: any) => ({ op: "desc", col }),
}));

vi.mock("../../db", () => {
  const { tables, nextId, matches, sortBy } = H;
  const tableFor = (t: any) => tables[t.__table];
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
          const st: { where?: any; order?: any } = {};
          const chain: any = {
            where(w: any) {
              st.where = w;
              return chain;
            },
            orderBy(o: any) {
              st.order = o;
              return chain;
            },
            then(resolve: any) {
              const rows = sortBy(tableFor(table).filter((r) => matches(r, st.where)), st.order);
              return Promise.resolve(resolve(rows));
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

import { listQueue, getAuditLog } from "../agent-action-service";
import {
  defaultMeetingPrepDataDeps,
  prepareMeetingPacket,
  MEETING_PREP_ACTION_TYPE,
} from "../meeting-prep-service";

const ASSOC_A = "assoc-a";
const ASSOC_B = "assoc-b";
const NOW = new Date("2026-07-08T12:00:00Z");

beforeEach(() => {
  for (const key of Object.keys(H.tables)) H.tables[key].length = 0;
  H.state.seq = 1;
});

function seedTwoAssociations() {
  // maintenance_requests — one open per association, one resolved (excluded) for A.
  H.tables.maintenanceRequests.push(
    { id: "mr-a-open", associationId: ASSOC_A, status: "submitted", title: "A leak", description: "Leaking pipe", locationText: "Unit 3", category: "plumbing", priority: "high", createdAt: new Date("2026-07-01"), responseDueAt: null, unitId: null },
    { id: "mr-a-resolved", associationId: ASSOC_A, status: "resolved", title: "A fixed thing", description: "n/a", locationText: null, category: "general", priority: "low", createdAt: new Date("2026-06-01"), responseDueAt: null, unitId: null },
    { id: "mr-b-open", associationId: ASSOC_B, status: "submitted", title: "B leak", description: "B pipe", locationText: null, category: "plumbing", priority: "medium", createdAt: new Date("2026-07-01"), responseDueAt: null, unitId: null },
  );

  // records_requests — one open per association, statutory deadlines.
  H.tables.recordsRequests.push(
    { id: "rr-a-open", associationId: ASSOC_A, status: "received", requesterName: "Pat A", recordsRequested: "Financial statements", receivedAt: new Date("2026-07-01"), responseDueAt: new Date("2026-07-10"), createdAt: new Date("2026-07-01") },
    { id: "rr-a-fulfilled", associationId: ASSOC_A, status: "fulfilled", requesterName: "Old A", recordsRequested: "n/a", receivedAt: new Date("2026-05-01"), responseDueAt: new Date("2026-05-10"), createdAt: new Date("2026-05-01") },
    { id: "rr-b-open", associationId: ASSOC_B, status: "received", requesterName: "Pat B", recordsRequested: "Bylaws", receivedAt: new Date("2026-07-01"), responseDueAt: new Date("2026-07-20"), createdAt: new Date("2026-07-01") },
  );

  // work_orders — one open per association, one closed (excluded) for A.
  H.tables.workOrders.push(
    { id: "wo-a-open", associationId: ASSOC_A, status: "open", title: "A gutter", description: "Fix gutter", category: "exterior", priority: "medium", createdAt: new Date("2026-07-02"), scheduledFor: null, vendorId: null },
    { id: "wo-a-closed", associationId: ASSOC_A, status: "closed", title: "A done", description: "n/a", category: "general", priority: "low", createdAt: new Date("2026-06-01"), scheduledFor: null, vendorId: null },
    { id: "wo-b-open", associationId: ASSOC_B, status: "open", title: "B gutter", description: "B fix", category: "exterior", priority: "high", createdAt: new Date("2026-07-02"), scheduledFor: null, vendorId: null },
  );

  // agent_actions — a violation-notice type per association (queued = open),
  // plus an old executed one for A that predates the lookback window (excluded).
  H.tables.agentActions.push(
    { id: "va-a-queued", associationId: ASSOC_A, actionType: "reversible.draft_notice", status: "queued", severity: "medium", reasoning: "Landscaping notice for A", level: "L2", createdAt: new Date("2026-07-03"), statutoryDeadline: null },
    { id: "va-a-old", associationId: ASSOC_A, actionType: "reversible.draft_notice", status: "executed", severity: "low", reasoning: "Old resolved notice", level: "L2", createdAt: new Date("2026-01-01"), statutoryDeadline: null },
    { id: "va-b-queued", associationId: ASSOC_B, actionType: "irreversible.send_owner_notice", status: "approved", severity: "high", reasoning: "Send notice for B", level: "L3", createdAt: new Date("2026-07-03"), statutoryDeadline: null },
  );

  // governance_meetings — a completed meeting per association before NOW, plus
  // one for A that's completed but AFTER NOW (must be excluded as "prior").
  H.tables.governanceMeetings.push(
    { id: "gm-a-prior", associationId: ASSOC_A, status: "completed", title: "A June Meeting", scheduledAt: new Date("2026-06-15T18:00:00Z"), summaryText: "Discussed the roof.", notes: null, agenda: null },
    { id: "gm-a-future", associationId: ASSOC_A, status: "completed", title: "A Future Meeting", scheduledAt: new Date("2026-08-01T18:00:00Z"), summaryText: null, notes: null, agenda: null },
    { id: "gm-b-prior", associationId: ASSOC_B, status: "completed", title: "B June Meeting", scheduledAt: new Date("2026-06-20T18:00:00Z"), summaryText: "B minutes.", notes: null, agenda: null },
  );
  H.tables.meetingNotes.push(
    { id: "mn-a-1", meetingId: "gm-a-prior", noteType: "action_item", content: "Follow up on roof estimate.", createdAt: new Date("2026-06-15T18:30:00Z") },
    { id: "mn-b-1", meetingId: "gm-b-prior", noteType: "general", content: "B note.", createdAt: new Date("2026-06-20T18:30:00Z") },
  );
}

describe("defaultMeetingPrepDataDeps — real fetchers, tenant isolation (AC1)", () => {
  beforeEach(seedTwoAssociations);

  it("fetchOpenMaintenanceRequests returns only the open row for the given association", async () => {
    const rowsA = await defaultMeetingPrepDataDeps.fetchOpenMaintenanceRequests(ASSOC_A);
    expect(rowsA.map((r) => r.ref.id)).toEqual(["mr-a-open"]);
    const rowsB = await defaultMeetingPrepDataDeps.fetchOpenMaintenanceRequests(ASSOC_B);
    expect(rowsB.map((r) => r.ref.id)).toEqual(["mr-b-open"]);
    // No cross-association leakage in either direction.
    expect(rowsA.some((r) => r.ref.id === "mr-b-open")).toBe(false);
    expect(rowsB.some((r) => r.ref.id === "mr-a-open")).toBe(false);
  });

  it("fetchOpenRecordsRequests excludes fulfilled/withheld/closed and isolates by association", async () => {
    const rowsA = await defaultMeetingPrepDataDeps.fetchOpenRecordsRequests(ASSOC_A, NOW);
    expect(rowsA.map((r) => r.ref.id)).toEqual(["rr-a-open"]);
    expect(rowsA[0].severity).toBe("critical"); // due 2026-07-10, NOW=2026-07-08T12:00 → 1.5 days out
    const rowsB = await defaultMeetingPrepDataDeps.fetchOpenRecordsRequests(ASSOC_B, NOW);
    expect(rowsB.map((r) => r.ref.id)).toEqual(["rr-b-open"]);
  });

  it("fetchOpenWorkOrders excludes closed/cancelled and isolates by association", async () => {
    const rowsA = await defaultMeetingPrepDataDeps.fetchOpenWorkOrders(ASSOC_A);
    expect(rowsA.map((r) => r.ref.id)).toEqual(["wo-a-open"]);
    const rowsB = await defaultMeetingPrepDataDeps.fetchOpenWorkOrders(ASSOC_B);
    expect(rowsB.map((r) => r.ref.id)).toEqual(["wo-b-open"]);
  });

  it("fetchViolationActions includes still-open actions + recent ones since sinceDate, isolated by association", async () => {
    const since = new Date("2026-06-01");
    const rowsA = await defaultMeetingPrepDataDeps.fetchViolationActions(ASSOC_A, since);
    expect(rowsA.map((r) => r.ref.id)).toEqual(["va-a-queued"]); // old executed one predates `since`
    const rowsB = await defaultMeetingPrepDataDeps.fetchViolationActions(ASSOC_B, since);
    expect(rowsB.map((r) => r.ref.id)).toEqual(["va-b-queued"]);
  });

  it("fetchPriorMeeting picks the most recent COMPLETED meeting strictly before the given date, isolated by association", async () => {
    const priorA = await defaultMeetingPrepDataDeps.fetchPriorMeeting(ASSOC_A, NOW);
    expect(priorA?.ref.id).toBe("gm-a-prior"); // the future one is excluded
    expect(priorA?.notes.map((n) => n.id)).toEqual(["mn-a-1"]);
    const priorB = await defaultMeetingPrepDataDeps.fetchPriorMeeting(ASSOC_B, NOW);
    expect(priorB?.ref.id).toBe("gm-b-prior");
    expect(priorB?.notes.map((n) => n.id)).toEqual(["mn-b-1"]);
  });
});

describe("prepareMeetingPacket — full real path (AC3 + AC5)", () => {
  beforeEach(seedTwoAssociations);

  it("aggregates real rows, drafts the agenda, and files a real L1 suggest.meeting_prep action visible on the real queue", async () => {
    const result = await prepareMeetingPacket({ associationId: ASSOC_A, meetingDate: NOW, createdByAgent: "meeting-prep-test" });

    expect(result.action.actionType).toBe(MEETING_PREP_ACTION_TYPE);
    expect(result.action.level).toBe("L1"); // real server-authoritative ladder
    expect(result.action.status).toBe("queued");

    // Association A's activity only — one item per open source.
    expect(result.packet.activityCounts).toEqual({
      maintenance_request: 1,
      records_request: 1,
      work_order: 1,
      violation_action: 1,
    });
    expect(result.packet.priorMeeting?.title).toBe("A June Meeting");

    // The action is really on the queue (through the real fileAction → agent_actions
    // table) and has a real 'filed' audit entry.
    const queue = await listQueue(ASSOC_A);
    expect(queue.map((a) => a.id)).toContain(result.action.id);
    const audit = await getAuditLog(result.action.id, ASSOC_A);
    expect(audit.map((e) => e.event)).toContain("filed");

    // Never leaks association B's rows into A's packet.
    const allRefIds = result.agenda.sections.flatMap((s) => s.lines.flatMap((l) => l.sourceRefs.map((r) => r.id)));
    expect(allRefIds).not.toContain("mr-b-open");
    expect(allRefIds).not.toContain("wo-b-open");
    expect(allRefIds).not.toContain("rr-b-open");
    expect(allRefIds).not.toContain("va-b-queued");
  });

  it("tenant isolation holds for association B's independent run", async () => {
    const result = await prepareMeetingPacket({ associationId: ASSOC_B, meetingDate: NOW });
    expect(result.packet.activityCounts).toEqual({
      maintenance_request: 1,
      records_request: 1,
      work_order: 1,
      violation_action: 1,
    });
    expect(result.packet.priorMeeting?.title).toBe("B June Meeting");
    const allRefIds = result.agenda.sections.flatMap((s) => s.lines.flatMap((l) => l.sourceRefs.map((r) => r.id)));
    expect(allRefIds).not.toContain("mr-a-open");
  });
});
