/**
 * AP-suggestion END-TO-END flow test (founder-os#9477, W2 acceptance criteria).
 *
 * Exercises the REAL path — `suggestAndQueueApInvoice` (with injected in-memory
 * candidate loaders but the REAL W1 `fileAction`) → the queue → approve →
 * execute — against a faithful in-memory db mock (same harness as
 * agent-action-flow.test.ts). This proves, not mocks:
 *   - an ingested invoice files a vendor-match + GL-code suggestion with a
 *     confidence band (criteria 1 + 3);
 *   - the suggestion files as an L3 action that CANNOT execute without a recorded
 *     human approval (criterion 2 — the mandatory human gate);
 *   - the reasoning carried on the action names why the vendor + GL code were
 *     chosen (criterion 4);
 *   - after a human approves, the coding executes and leaves an audit trail
 *     (ingest→suggest→queue→approve→execute end-to-end, criterion 5).
 */
import { beforeEach, describe, expect, it } from "vitest";

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

import { vi } from "vitest";

vi.mock("@shared/schema", () => ({
  agentActions: H.ACT,
  agentActionAuditLog: H.AUD,
  agentActionToggles: H.TOG,
  // Referenced only by the default (uninjected) AP deps — dummies keep the import graph happy.
  vendors: { __table: "vendors" },
  glAccounts: { __table: "glAccounts" },
  glEntries: { __table: "glEntries" },
}));

vi.mock("drizzle-orm", () => ({
  eq: (col: any, val: any) => ({ op: "eq", col, val }),
  and: (...clauses: any[]) => ({ op: "and", clauses }),
  inArray: (col: any, vals: any[]) => ({ op: "inArray", col, vals }),
  asc: (col: any) => ({ op: "asc", col }),
  desc: (col: any) => ({ op: "desc", col }),
  sql: () => ({ op: "sql" }),
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

import { fileAction, approveAction, executeAction, getAuditLog, AgentActionError } from "../agent-action-service";
import {
  suggestAndQueueApInvoice,
  type ApSuggestionDeps,
  type VendorCandidate,
  type GlAccountCandidate,
} from "../ap-suggestion-service";

const ASSOC = "assoc-1";
const OTHER = "assoc-2";
const boardApprover = { adminUserId: "u-board", email: "board@x.com", role: "board-officer" };

const VENDORS: VendorCandidate[] = [
  { id: "v-plumb", name: "ABC Plumbing, Inc.", trade: "plumbing" },
  { id: "v-land", name: "Elm Landscaping LLC", trade: "landscaping" },
];
const GL: GlAccountCandidate[] = [
  { id: "gl-rm", accountCode: "5200", name: "Repairs & Maintenance", accountType: "expense" },
  { id: "gl-land", accountCode: "5300", name: "Landscaping & Grounds", accountType: "expense" },
  { id: "gl-misc", accountCode: "5900", name: "Uncategorized Expense", accountType: "expense" },
];

// Deps: in-memory candidate loaders + the REAL W1 fileAction (so the L3 gate is
// genuinely exercised, not mocked).
function makeDeps(history: Record<string, { glAccountId: string; count: number }[]> = {}): ApSuggestionDeps {
  return {
    loadVendors: async () => VENDORS,
    loadExpenseGlAccounts: async () => GL,
    loadVendorGlHistory: async (_assoc, vendorId) => history[vendorId] ?? [],
    file: fileAction,
  };
}

beforeEach(() => {
  H.actions.length = 0;
  H.audit.length = 0;
  H.toggles.length = 0;
  H.state.seq = 1;
});

describe("suggestAndQueueApInvoice — ingest → suggest → queue at L3", () => {
  it("files a vendor-match + GL-code suggestion with a confidence band at L3", async () => {
    const { action, suggestion } = await suggestAndQueueApInvoice(
      { associationId: ASSOC, vendorName: "ABC Plumbing Inc", amount: 940.25, invoiceNumber: "INV-1", memo: "pipe repair" },
      makeDeps({ "v-plumb": [{ glAccountId: "gl-rm", count: 9 }] }),
    );
    // Criterion 1 — vendor-match + GL-code suggestion produced.
    expect(suggestion.vendorMatch?.vendorId).toBe("v-plumb");
    expect(suggestion.glSuggestion?.accountCode).toBe("5200");
    // Criterion 2 — filed at L3, queued (not executed).
    expect(action.level).toBe("L3");
    expect(action.status).toBe("queued");
    expect(action.actionType).toBe("financial.ap_invoice_coding");
    // Criterion 3 — the confidence band rides in the payload the queue renders.
    expect((action.payload as any).confidence.band).toBe(suggestion.confidence.band);
    expect(["high", "medium", "low"]).toContain((action.payload as any).confidence.band);
    // Criterion 4 — reasoning names why the vendor + GL code were chosen.
    expect(action.reasoning).toContain("ABC Plumbing");
    expect(action.reasoning).toContain("5200");
  });

  it("CANNOT execute without a recorded human approval (the mandatory L3 gate)", async () => {
    const { action } = await suggestAndQueueApInvoice(
      { associationId: ASSOC, vendorName: "Elm Landscaping", amount: 300, invoiceNumber: "INV-2" },
      makeDeps(),
    );
    // Execute BEFORE any approval → refused by the W1 gate.
    await expect(executeAction(action.id, ASSOC, { actorType: "human", actorId: "u1", actorEmail: "u@x.com" })).rejects.toMatchObject({
      code: "APPROVAL_REQUIRED",
    });
    // A human approves → then it executes → and the executed fact is audited.
    const approved = await approveAction(action.id, ASSOC, boardApprover);
    expect(approved.status).toBe("approved");
    const executed = await executeAction(action.id, ASSOC, { actorType: "human", actorId: boardApprover.adminUserId, actorEmail: boardApprover.email });
    expect(executed.status).toBe("executed");
    const log = await getAuditLog(action.id, ASSOC);
    expect(log.map((e) => e.event)).toEqual(["filed", "approved", "executed"]);
  });

  it("low-confidence suggestion still queues at L3 (a human always sees it)", async () => {
    const { action, suggestion } = await suggestAndQueueApInvoice(
      { associationId: ASSOC, vendorName: "Totally Unknown Vendor QQ", amount: 75 },
      makeDeps(),
    );
    expect(suggestion.vendorMatch).toBeNull();
    expect((action.payload as any).confidence.band).toBe("low");
    expect(action.level).toBe("L3");
    // Low confidence → higher severity so a human reviews it sooner.
    expect(action.severity).toBe("high");
    // Still cannot slip through without approval.
    await expect(executeAction(action.id, ASSOC, {})).rejects.toBeInstanceOf(AgentActionError);
  });

  it("tenant isolation: an action filed for one association can't be acted on from another", async () => {
    const { action } = await suggestAndQueueApInvoice(
      { associationId: ASSOC, vendorName: "ABC Plumbing", amount: 100 },
      makeDeps(),
    );
    await expect(approveAction(action.id, OTHER, boardApprover)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects an invoice with no vendor name (validation)", async () => {
    await expect(
      suggestAndQueueApInvoice({ associationId: ASSOC, vendorName: "   ", amount: 10 }, makeDeps()),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });
});
