/**
 * Bank-reconciliation suggestion agent — end-to-end flow test
 * (founder-os#9480, W2). read → propose → queue → approve → commit, through
 * the REAL W1 agent-action code (not fakes):
 *
 *  1. `fileReconSuggestions` files REAL `financial.reconcile_bank_match`
 *     actions through the REAL `fileAction` — server-assigned L3, payload +
 *     reasoning intact — visible on the REAL `listQueue` surface.
 *  2. The execute leg BEFORE any approval refuses through the REAL
 *     `evaluateGate` (APPROVAL_REQUIRED) and the commit lever is NEVER called
 *     — the acceptance criterion "no pairing commits without a recorded human
 *     approval", proven against the real gate code.
 *  3. After a REAL `approveAction`, the execute leg commits (lever called with
 *     the exact pairing) and the REAL `executeAction` marks it executed.
 *  4. The REAL audit log carries filed → approved → executed, in order.
 *  5. Tenant isolation: association B cannot load/approve/execute A's action.
 *  6. Open-proposal dedupe: a second agent run against the same review rows
 *     files nothing new (the real default `listOpenProposalRefs` reads the
 *     real queued action's payload).
 *
 * Same in-memory db harness shape as meeting-prep-flow.test.ts (W1 tables
 * only); the auto-matcher review rows + the commit lever are injected at the
 * service's deps seam — their internals are covered by the existing
 * auto-matcher / plaid-reconciliation suites.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => {
  type Row = Record<string, any>;
  const state = { seq: 1 };
  const nextId = (p: string) => `${p}-${String(state.seq++).padStart(4, "0")}`;

  const tables: Record<string, Row[]> = {
    agentActions: [],
    agentActionAuditLog: [],
    agentActionToggles: [],
  };

  const mk = (name: string, cols: string[]) => {
    const t: any = { __table: name };
    for (const c of cols) Object.defineProperty(t, c, { value: { __col: c }, configurable: true });
    return t;
  };

  const ACT = mk("agentActions", [
    "id", "associationId", "actionType", "level", "status", "targetEntityType", "targetEntityId",
    "payload", "reasoning", "severity", "statutoryDeadline", "createdByAgent",
    "approvedByUserId", "approvedByEmail", "approvedAt",
    "rejectedByUserId", "rejectedByEmail", "rejectedAt", "rejectionReason",
    "executedAt", "createdAt", "updatedAt",
  ]);
  const AUD = mk("agentActionAuditLog", ["id", "actionId", "associationId", "event", "actorType", "actorId", "actorEmail", "detail", "snapshot", "createdAt"]);
  const TOG = mk("agentActionToggles", ["id", "associationId", "actionType", "autoApprove", "updatedAt"]);

  const matches = (row: Row, w: any): boolean => {
    if (!w) return true;
    switch (w.op) {
      case "eq":
        return row[w.col.__col] === w.val;
      case "inArray":
        return w.vals.includes(row[w.col.__col]);
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
      const av = a[col] instanceof Date ? a[col].getTime() : a[col];
      const bv = b[col] instanceof Date ? b[col].getTime() : b[col];
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  };

  return { tables, ACT, AUD, TOG, matches, sortBy, state, nextId };
});

vi.mock("@shared/schema", () => ({
  agentActions: H.ACT,
  agentActionAuditLog: H.AUD,
  agentActionToggles: H.TOG,
  // Referenced at module load by the auto-matcher / plaid-reconciliation
  // imports; never queried here (their entrypoints are injected away).
  bankTransactions: {},
  ownerLedgerEntries: {},
  bankDescriptorAliases: {},
  ownerships: {},
  persons: {},
  units: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: (col: any, val: any) => ({ op: "eq", col, val }),
  and: (...clauses: any[]) => ({ op: "and", clauses }),
  inArray: (col: any, vals: any[]) => ({ op: "inArray", col, vals }),
  notInArray: (col: any, vals: any[]) => ({ op: "notInArray", col, vals }),
  lt: (col: any, val: any) => ({ op: "lt", col, val }),
  gte: (col: any, val: any) => ({ op: "gte", col, val }),
  isNull: (col: any) => ({ op: "isNull", col }),
  isNotNull: (col: any) => ({ op: "isNotNull", col }),
  asc: (col: any) => ({ op: "asc", col }),
  desc: (col: any) => ({ op: "desc", col }),
  sql: () => ({}),
}));

// Module-load side-steps for the auto-matcher's deeper imports (flag reads,
// roster loaders) — the flow test injects review rows at the deps seam.
vi.mock("../unit-centric-flag", () => ({ isUnitCentricEnabledForAssociation: vi.fn(async () => false) }));
vi.mock("../unit-payer-roster", () => ({
  loadUnitPayerRosters: vi.fn(async () => new Map()),
  rosterNameMatch: vi.fn(() => "none"),
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
              const row = { id: nextId(table.__table === "agentActions" ? "act" : "row"), createdAt: new Date(), updatedAt: new Date(), ...vals };
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

import { approveAction, getAuditLog, listQueue } from "../agent-action-service";
import {
  defaultReconExecuteDeps,
  executeApprovedReconMatch,
  fileReconSuggestions,
  RECON_MATCH_ACTION_TYPE,
  type ReconExecuteDeps,
  type ReconSuggestionDataDeps,
  type ReviewRow,
} from "../recon-suggestion-service";
// Re-import the real default deps AFTER mocks so the flow uses the real
// fileAction + the real default listOpenProposalRefs against the mocked db.
import { defaultReconSuggestionDataDeps } from "../recon-suggestion-service";

const ASSOC_A = "assoc-a";
const ASSOC_B = "assoc-b";
const APPROVER = { adminUserId: "admin-1", email: "treasurer@example.com", role: "manager" };
const ACTOR = { actorType: "human", actorId: "admin-1", actorEmail: "treasurer@example.com" };

const REVIEW_ROWS: ReviewRow[] = [
  {
    bankTransactionId: "btx-450",
    candidates: [
      { ledgerEntryId: "le-450", confidence: 0.75, signals: { amountDeltaCents: 0, dateDeltaDays: 2, payorMatch: "partial" } },
    ],
    reason: "low-confidence",
  },
];

function dataDeps(rows: ReviewRow[] = REVIEW_ROWS): ReconSuggestionDataDeps {
  return {
    listReviewCandidates: vi.fn(async () => rows),
    // The REAL default — reads the mocked-db agent_actions table, so the
    // dedupe path is exercised against real filed payloads.
    listOpenProposalRefs: defaultReconSuggestionDataDeps.listOpenProposalRefs,
  };
}

function commitSpy() {
  return vi.fn(async (input: { associationId: string; bankTransactionId: string; ledgerEntryId: string }) => ({
    ok: true as const,
    outcome: { bankTransactionId: input.bankTransactionId, ledgerEntryId: input.ledgerEntryId, amountCents: 45000, dateDeltaDays: 2 },
  }));
}

function execDeps(commit = commitSpy()): { deps: ReconExecuteDeps; commit: ReturnType<typeof commitSpy> } {
  return {
    deps: {
      loadAction: defaultReconExecuteDeps.loadAction,
      commit: commit as unknown as ReconExecuteDeps["commit"],
      execute: defaultReconExecuteDeps.execute,
    },
    commit,
  };
}

beforeEach(() => {
  for (const key of Object.keys(H.tables)) H.tables[key].length = 0;
  H.state.seq = 1;
});

describe("read → propose → queue (real fileAction, real queue)", () => {
  it("files a REAL L3 action with the pairing payload, visible on the real listQueue", async () => {
    const result = await fileReconSuggestions(
      { associationId: ASSOC_A },
      { data: dataDeps(), file: (await import("../agent-action-service")).fileAction },
    );
    expect(result.actions).toHaveLength(1);
    const action = result.actions[0];
    expect(action.level).toBe("L3"); // server-assigned from the real ladder
    expect(action.status).toBe("queued");
    expect(action.actionType).toBe(RECON_MATCH_ACTION_TYPE);
    expect((action.payload as any).ledgerEntryId).toBe("le-450");
    expect(action.reasoning).toContain("nothing settles without this approval");

    const queue = await listQueue(ASSOC_A);
    expect(queue.map((q) => q.id)).toContain(action.id);

    const audit = await getAuditLog(action.id, ASSOC_A);
    expect(audit.map((a) => a.event)).toEqual(["filed"]);
  });

  it("a second run dedupes against the open proposal (real listOpenProposalRefs) — nothing new filed", async () => {
    const file = (await import("../agent-action-service")).fileAction;
    const first = await fileReconSuggestions({ associationId: ASSOC_A }, { data: dataDeps(), file });
    expect(first.actions).toHaveLength(1);
    const second = await fileReconSuggestions({ associationId: ASSOC_A }, { data: dataDeps(), file });
    expect(second.actions).toHaveLength(0);
    expect(second.skippedOpenProposals).toBe(1);
  });
});

describe("approve → commit (the mandatory human gate, through the REAL gate code)", () => {
  async function fileOne(): Promise<string> {
    const file = (await import("../agent-action-service")).fileAction;
    const r = await fileReconSuggestions({ associationId: ASSOC_A }, { data: dataDeps(), file });
    return r.actions[0].id;
  }

  it("REFUSES to commit before approval — APPROVAL_REQUIRED from the real gate; the lever is never called", async () => {
    const actionId = await fileOne();
    const { deps, commit } = execDeps();
    await expect(
      executeApprovedReconMatch({ actionId, associationId: ASSOC_A, actor: ACTOR }, deps),
    ).rejects.toMatchObject({ code: "APPROVAL_REQUIRED" });
    expect(commit).not.toHaveBeenCalled();
    // still queued, no executedAt.
    const [row] = H.tables.agentActions.filter((r) => r.id === actionId);
    expect(row.status).toBe("queued");
    expect(row.executedAt ?? null).toBeNull();
  });

  it("after a REAL approveAction, execute commits the exact pairing then marks executed; audit = filed→approved→executed", async () => {
    const actionId = await fileOne();
    await approveAction(actionId, ASSOC_A, APPROVER);

    const { deps, commit } = execDeps();
    const result = await executeApprovedReconMatch({ actionId, associationId: ASSOC_A, actor: ACTOR }, deps);

    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith({ associationId: ASSOC_A, bankTransactionId: "btx-450", ledgerEntryId: "le-450" });
    expect(result.action.status).toBe("executed");
    expect(result.outcome.ledgerEntryId).toBe("le-450");

    const audit = await getAuditLog(actionId, ASSOC_A);
    expect(audit.map((a) => a.event)).toEqual(["filed", "approved", "executed"]);
    expect(audit[1].actorEmail).toBe(APPROVER.email); // the RECORDED human approval
  });

  it("a commit-lever refusal (record settled elsewhere since approval) surfaces cleanly and the action is NOT marked executed", async () => {
    const actionId = await fileOne();
    await approveAction(actionId, ASSOC_A, APPROVER);
    const refusing = vi.fn(async () => ({ ok: false as const, reason: "already reconciled", code: "BANK_TX_ALREADY_CONSUMED" }));
    const { deps } = execDeps(refusing as unknown as ReturnType<typeof commitSpy>);
    await expect(
      executeApprovedReconMatch({ actionId, associationId: ASSOC_A, actor: ACTOR }, deps),
    ).rejects.toMatchObject({ code: "BANK_TX_ALREADY_CONSUMED" });
    const [row] = H.tables.agentActions.filter((r) => r.id === actionId);
    expect(row.status).toBe("approved"); // approved-but-unexecuted; nothing half-applied
  });

  it("tenant isolation: association B cannot execute (or even load) A's action", async () => {
    const actionId = await fileOne();
    await approveAction(actionId, ASSOC_A, APPROVER);
    const { deps, commit } = execDeps();
    await expect(
      executeApprovedReconMatch({ actionId, associationId: ASSOC_B, actor: ACTOR }, deps),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(commit).not.toHaveBeenCalled();
  });
});
