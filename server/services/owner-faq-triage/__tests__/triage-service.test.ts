/**
 * triage-service.test.ts — the intake→classify→ground→draft→queue path,
 * END-TO-END against the REAL landed W1 foundation (founder-os#9474's
 * `agent-action-service.ts`: fileAction/executeAction/setToggle + the
 * server-authoritative permission ladder) — not a mocked service. Same
 * faithful in-memory-db mock pattern as
 * `server/services/__tests__/agent-action-flow.test.ts`, so this proves the
 * owner-FAQ triage ability actually gates through the real ladder, not just
 * through injected fakes of it (founder-os#9476, W1).
 *
 * Verifies:
 *   - a grounded balance inquiry files an L2 "reversible.send_owner_faq_reply"
 *     action that is HELD for review by DEFAULT (auto-send toggle OFF ->
 *     nothing sends without human approval — the core safety AC)
 *   - with the per-association toggle ON, the SAME reply auto-sends
 *   - an "other" inquiry files an L1 "suggest.owner_faq_reply" advisory
 *     suggestion that NEVER sends, even if the toggle happens to be on
 *   - the filed action carries reasoning + sourceData (explainability)
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

vi.mock("../../../db", () => {
  const { actions, audit, toggles, nextId, matches } = H;
  const tableFor = (t: any) => (t.__table === "agentActions" ? actions : t.__table === "agentActionToggles" ? toggles : audit);
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

import { fileAction, executeAction, setToggle } from "../../agent-action-service";
import { classifyInquiry } from "../classifier";
import { triageInquiry, type TriageInput } from "../triage-service";
import type { GroundingSnapshot } from "../draft-generator";

const ASSOC = "assoc-1";

beforeEach(() => {
  H.actions.length = 0;
  H.audit.length = 0;
  H.toggles.length = 0;
  H.state.seq = 1;
});

const balanceInput: TriageInput = {
  associationId: ASSOC,
  personId: "person-1",
  unitIds: ["unit-1"],
  text: "Hi, what's my current balance? How much do I owe?",
};

const groundBalance = async (): Promise<GroundingSnapshot> => ({
  ownerName: "Jordan",
  balanceCents: 12500,
  balanceAsOf: "2026-07-01",
});

describe("triageInquiry — end-to-end against the REAL landed W1 foundation", () => {
  it("a grounded balance inquiry files L2, HELD for review by default (toggle OFF -> nothing sends)", async () => {
    const r = await triageInquiry(balanceInput, {
      classify: classifyInquiry,
      ground: groundBalance,
      fileAction,
      executeAction,
    });

    expect(r.classification.category).toBe("balance");
    expect(r.draft.draftText).toContain("$125.00");
    expect(r.actionType).toBe("reversible.send_owner_faq_reply");
    expect(r.action.level).toBe("L2");
    // The core safety AC: default is queue-for-review, NOT auto-send.
    expect(r.autoSent).toBe(false);
    expect(r.action.status).toBe("queued");
  });

  it("with the per-association L2 autonomy toggle ON, the SAME reply auto-sends", async () => {
    await setToggle(ASSOC, "reversible.send_owner_faq_reply", true);
    const r = await triageInquiry(balanceInput, {
      classify: classifyInquiry,
      ground: groundBalance,
      fileAction,
      executeAction,
    });
    expect(r.autoSent).toBe(true);
    expect(r.action.status).toBe("executed");
  });

  it("an 'other' inquiry files an L1 advisory suggestion that NEVER sends, even with the toggle on", async () => {
    // Toggle a DIFFERENT (or even the same) action-type on — irrelevant, since
    // the L1 path never attempts to execute.
    await setToggle(ASSOC, "reversible.send_owner_faq_reply", true);
    const other: TriageInput = { ...balanceInput, text: "My neighbor's dog keeps barking at night." };
    const r = await triageInquiry(other, {
      classify: classifyInquiry,
      ground: async () => ({}),
      fileAction,
      executeAction,
    });
    expect(r.classification.category).toBe("other");
    expect(r.actionType).toBe("suggest.owner_faq_reply");
    expect(r.action.level).toBe("L1");
    expect(r.autoSent).toBe(false);
    expect(r.action.status).toBe("queued");
  });

  it("a balance inquiry with no ledger data flags needsData and files L1 (never fabricates, never sends)", async () => {
    const r = await triageInquiry(balanceInput, {
      classify: classifyInquiry,
      ground: async () => ({}), // no balance available
      fileAction,
      executeAction,
    });
    expect(r.draft.needsData).toBe(true);
    expect(r.actionType).toBe("suggest.owner_faq_reply");
    expect(r.action.level).toBe("L1");
    expect(r.autoSent).toBe(false);
  });

  it("the filed action carries reasoning + sourceData (explainability)", async () => {
    const r = await triageInquiry(balanceInput, {
      classify: classifyInquiry,
      ground: groundBalance,
      fileAction,
      executeAction,
    });
    expect(r.action.reasoning).toMatch(/balance/i);
    expect(r.action.createdByAgent).toBe("agent:owner-faq-triage");
    const payload = r.action.payload as any;
    expect(payload.sourceData.balanceCents).toBe(12500);
    expect(payload.draftReply).toContain("$125.00");
  });
});
