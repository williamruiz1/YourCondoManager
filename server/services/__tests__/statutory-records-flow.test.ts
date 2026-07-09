/**
 * End-to-end statutory-records lifecycle tests (founder-os#9483) — exercise the
 * REAL service functions (intake → sign → issue) AND the REAL agent-action
 * permission gate against a faithful in-memory db mock (same pattern as
 * agent-action-flow.test.ts). Proves:
 *   R2  intake pins the statutory deadline onto the queue item (statutoryDeadline)
 *       + near-deadline reminder surfacing.
 *   R3  issuance is L3-gated: issue-without-sign THROWS and the record stays
 *       'generated'; after the PM sign, issue → 'issued'. (cannot actuate without it)
 *   R4  the produced record is persisted + retrievable (get/list, tenant-scoped).
 *   Tenant isolation: a record cannot be signed/issued/read cross-association.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => {
  type Row = Record<string, any>;
  const actions: Row[] = [];
  const audit: Row[] = [];
  const toggles: Row[] = [];
  const records: Row[] = [];
  const state = { seq: 1 };
  const nextId = (p: string) => `${p}-${String(state.seq++).padStart(4, "0")}`;
  // Proxy so any column access (table.id, table.associationId, …) yields a marker.
  const mk = (name: string) =>
    new Proxy(
      { __table: name },
      {
        get(target: any, prop: string) {
          if (prop === "__table") return target.__table;
          return { __col: prop };
        },
      },
    ) as any;
  const ACT = mk("agentActions");
  const AUD = mk("agentActionAuditLog");
  const TOG = mk("agentActionToggles");
  const REC = mk("statutoryRecords");
  const val = (v: any) => (v && v.__col ? undefined : v);
  const matches = (row: Row, w: any): boolean => {
    if (!w) return true;
    switch (w.op) {
      case "eq":
        return row[w.col.__col] === w.val;
      case "inArray":
        return w.vals.includes(row[w.col.__col]);
      case "lte":
        return row[w.col.__col] != null && row[w.col.__col].getTime() <= w.val.getTime();
      case "gte":
        return row[w.col.__col] != null && row[w.col.__col].getTime() >= w.val.getTime();
      case "and":
        return w.clauses.every((c: any) => matches(row, c));
      default:
        return true;
    }
  };
  void val;
  return { actions, audit, toggles, records, state, nextId, ACT, AUD, TOG, REC, matches };
});

vi.mock("@shared/schema", () => ({
  agentActions: H.ACT,
  agentActionAuditLog: H.AUD,
  agentActionToggles: H.TOG,
  statutoryRecords: H.REC,
}));

vi.mock("drizzle-orm", () => ({
  eq: (col: any, val: any) => ({ op: "eq", col, val }),
  and: (...clauses: any[]) => ({ op: "and", clauses }),
  inArray: (col: any, vals: any[]) => ({ op: "inArray", col, vals }),
  lte: (col: any, val: any) => ({ op: "lte", col, val }),
  gte: (col: any, val: any) => ({ op: "gte", col, val }),
  asc: (col: any) => ({ op: "asc", col }),
  desc: (col: any) => ({ op: "desc", col }),
}));

vi.mock("../../db", () => {
  const { actions, audit, toggles, records, nextId, matches } = H;
  const tableFor = (t: any) =>
    t.__table === "agentActions"
      ? actions
      : t.__table === "agentActionAuditLog"
        ? audit
        : t.__table === "agentActionToggles"
          ? toggles
          : records;
  const prefixFor = (t: any) =>
    t.__table === "agentActions" ? "act" : t.__table === "agentActionAuditLog" ? "aud" : t.__table === "agentActionToggles" ? "tog" : "rec";
  const db = {
    insert(table: any) {
      return {
        values(vals: any) {
          return {
            returning() {
              const row = { id: nextId(prefixFor(table)), createdAt: new Date(), updatedAt: new Date(), ...vals };
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
          };
          return chain;
        },
      };
    },
  };
  return { db };
});

import {
  intakeStatutoryRecord,
  signStatutoryRecord,
  issueStatutoryRecord,
  getStatutoryRecord,
  listStatutoryRecords,
  listStatutoryDeadlineReminders,
  StatutoryRecordError,
} from "../statutory-records-service";
import { AgentActionError, rankQueue } from "../agent-action-service";

const ASSOC = "assoc-1";
const OTHER = "assoc-2";
const pm = { adminUserId: "u-pm", email: "pm@x.com", role: "manager" };
const WED = new Date("2026-07-08T12:00:00.000Z");

beforeEach(() => {
  H.actions.length = 0;
  H.audit.length = 0;
  H.toggles.length = 0;
  H.records.length = 0;
  H.state.seq = 1;
});

async function intakeEstoppel(assoc = ASSOC, receivedAt = WED) {
  return intakeStatutoryRecord({
    associationId: assoc,
    recordType: "estoppel_certificate",
    requesterName: "Closing Agent Co",
    receivedAt,
    documentPayload: { statuteCitation: "CGS §47-270 (closing account-status subset)", stub: true },
  });
}

describe("intake — pins the statutory deadline onto the queue (R2)", () => {
  it("files an L3 queue item carrying the record's statutoryDeadline", async () => {
    const { record, agentActionId, deadlineAt } = await intakeEstoppel();
    expect(record.status).toBe("generated");
    expect(record.agentActionId).toBe(agentActionId);
    // deadline = §47-270 10 business days from Wed 07-08 → 07-22.
    expect(deadlineAt.toISOString().slice(0, 10)).toBe("2026-07-22");
    const action = H.actions.find((a) => a.id === agentActionId);
    expect(action.level).toBe("L3");
    expect(action.actionType).toBe("irreversible.issue_statutory_record");
    expect(action.statutoryDeadline?.toISOString().slice(0, 10)).toBe("2026-07-22");
    expect(action.targetEntityType).toBe("statutory_record");
    expect(action.targetEntityId).toBe(record.id);
  });

  it("the pinned queue item ranks ABOVE a non-statutory critical item (rankQueue)", async () => {
    const { agentActionId } = await intakeEstoppel();
    const statutoryItem = H.actions.find((a) => a.id === agentActionId)!;
    const nonStatutoryCritical = { statutoryDeadline: null, severity: "critical", createdAt: new Date("2026-06-01") };
    const ranked = rankQueue([nonStatutoryCritical as any, statutoryItem as any]);
    expect(ranked[0]).toBe(statutoryItem); // statutory deadline pins to the top
  });
});

describe("issuance is L3-gated — cannot actuate without the PM sign (R3)", () => {
  it("issue BEFORE sign throws APPROVAL_REQUIRED and the record stays 'generated'", async () => {
    const { record } = await intakeEstoppel();
    await expect(
      issueStatutoryRecord(record.id, ASSOC, { actorType: "human", actorId: pm.adminUserId }),
    ).rejects.toBeInstanceOf(AgentActionError);
    await expect(
      issueStatutoryRecord(record.id, ASSOC, { actorType: "human", actorId: pm.adminUserId }),
    ).rejects.toMatchObject({ code: "APPROVAL_REQUIRED" });
    const still = await getStatutoryRecord(record.id, ASSOC);
    expect(still.status).toBe("generated");
    expect(still.issuedAt ?? null).toBeNull();
  });

  it("sign (L3 approval) THEN issue → 'issued', with the sign recorded", async () => {
    const { record } = await intakeEstoppel();
    const signed = await signStatutoryRecord(record.id, ASSOC, pm);
    expect(signed.status).toBe("signed");
    expect(signed.signedByEmail).toBe("pm@x.com");
    expect(signed.signedAt).toBeInstanceOf(Date);

    const issued = await issueStatutoryRecord(record.id, ASSOC, {
      actorType: "human",
      actorId: pm.adminUserId,
      actorEmail: pm.email,
    });
    expect(issued.status).toBe("issued");
    expect(issued.issuedAt).toBeInstanceOf(Date);

    // The immutable agent-action audit log carries the sign + issue events.
    const events = H.audit.filter((e) => e.actionId === record.agentActionId).map((e) => e.event);
    expect(events).toEqual(["filed", "approved", "executed"]);
  });
});

describe("persistence + retrieval (R4)", () => {
  it("persists the packet + is retrievable by get and list", async () => {
    const { record } = await intakeEstoppel();
    const got = await getStatutoryRecord(record.id, ASSOC);
    expect(got.documentPayload).toMatchObject({ stub: true });
    expect(got.statuteCitation).toContain("§47-270");

    const list = await listStatutoryRecords(ASSOC);
    expect(list.map((r) => r.id)).toContain(record.id);
    const filtered = await listStatutoryRecords(ASSOC, { recordType: "estoppel_certificate" });
    expect(filtered.length).toBe(1);
  });
});

describe("near-deadline reminder sweep (R2)", () => {
  it("surfaces a record whose deadline is within the window", async () => {
    // Received on a date whose §47-260 5-business-day deadline is near `now`.
    const recRequest = await intakeStatutoryRecord({
      associationId: ASSOC,
      recordType: "records_request",
      requesterName: "Owner Smith",
      receivedAt: WED,
      documentPayload: { statuteCitation: "CGS §47-260", stub: true },
    });
    // now = a day just before the 07-15 deadline → within a 3-day window.
    const now = new Date("2026-07-14T12:00:00.000Z");
    const reminders = await listStatutoryDeadlineReminders(ASSOC, 3, now);
    expect(reminders.map((r) => r.id)).toContain(recRequest.record.id);

    // A far-off deadline (07-22) is NOT surfaced by a 3-day window at `now`.
    const farReminders = await listStatutoryDeadlineReminders(ASSOC, 3, new Date("2026-07-01T12:00:00.000Z"));
    expect(farReminders.length).toBe(0);
  });
});

describe("tenant isolation", () => {
  it("a record cannot be read, signed, or issued from another association", async () => {
    const { record } = await intakeEstoppel(ASSOC);
    await expect(getStatutoryRecord(record.id, OTHER)).rejects.toBeInstanceOf(StatutoryRecordError);
    await expect(signStatutoryRecord(record.id, OTHER, pm)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      issueStatutoryRecord(record.id, OTHER, { actorType: "human" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    // The other association's list is empty.
    expect((await listStatutoryRecords(OTHER)).length).toBe(0);
  });
});
