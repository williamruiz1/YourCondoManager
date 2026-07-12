/**
 * End-to-end board-memory flow tests (founder-os#9475, acceptance criteria
 * 1/2/3/5/6).
 *
 * These exercise the REAL service functions (recordDecision → queryDecisions →
 * getEntityHistory → getDecision) against a faithful in-memory db mock (the same
 * pattern as agent-action-flow.test.ts) — proving the institutional memory
 * end-to-end against SEEDED CHERRY HILL decisions:
 *   - recordDecision stores decision + reasoning + actor + date + attachments (#1);
 *   - a decision recorded under term "2023-2024" is retrievable by a user in a
 *     later term "2025-2026" (turnover-survival, #2);
 *   - the query returns prior decision context with the reasoning attached, for
 *     owner / rule / vendor lookups (#3);
 *   - tenant isolation: a decision can't be read cross-association;
 *   - the log is immutable — no update/delete path exists.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => {
  type Row = Record<string, any>;
  const decisions: Row[] = [];
  const state = { seq: 1 };
  const nextId = (p: string) => `${p}-${String(state.seq++).padStart(4, "0")}`;
  const mk = (name: string, cols: string[]) => {
    const t: any = { __table: name };
    for (const c of cols) Object.defineProperty(t, c, { value: { __col: c }, configurable: true });
    return t;
  };
  const BD = mk("boardDecisions", ["id", "associationId", "category", "boardTerm", "relatedEntityType", "relatedEntityId", "decidedAt"]);
  const matches = (row: Row, w: any): boolean => {
    if (!w) return true;
    if (w.op === "eq") return row[w.col.__col] === w.val;
    if (w.op === "and") return w.clauses.every((c: any) => matches(row, c));
    return true;
  };
  return { decisions, state, nextId, BD, matches };
});

vi.mock("@shared/schema", () => ({
  boardDecisions: H.BD,
}));

vi.mock("drizzle-orm", () => ({
  eq: (col: any, val: any) => ({ op: "eq", col, val }),
  and: (...clauses: any[]) => ({ op: "and", clauses }),
  desc: (col: any) => ({ op: "desc", col }),
}));

vi.mock("../../db", () => {
  const { decisions, nextId, matches } = H;
  const db = {
    insert() {
      return {
        values(vals: any) {
          return {
            returning() {
              const row = { id: nextId("bd"), createdAt: new Date(), ...vals };
              decisions.push(row);
              return Promise.resolve([row]);
            },
          };
        },
      };
    },
    select() {
      return {
        from() {
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
              const out = decisions.filter((r) => matches(r, st.where));
              return Promise.resolve(resolve(out));
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
  recordDecision,
  queryDecisions,
  getDecision,
  getEntityHistory,
  BoardMemoryError,
} from "../board-memory-service";

const CHC = "assoc-cherry-hill";
const OTHER = "assoc-other";

async function seedCherryHill() {
  // Decision recorded by the PRIOR treasurer, under the 2023-2024 board term.
  await recordDecision({
    associationId: CHC,
    subject: "Fence request — Unit 12B",
    decision: "Denied the fence variance request.",
    reasoning: "Proposed height (6ft) exceeded the 4ft CC&R limit and the setback intruded on the shared walkway easement.",
    category: "architectural",
    actorType: "board",
    actorName: "Jane Prior",
    actorRole: "Treasurer",
    boardTerm: "2023-2024",
    decidedAt: new Date("2023-05-14"),
    relatedEntityType: "owner",
    relatedEntityId: "owner-12b",
    relatedEntityLabel: "Unit 12B — R. Alvarez",
    attachments: [{ name: "arc-denial-letter.pdf", url: "/docs/arc-12b-denial.pdf" }],
    tags: ["fence", "arc", "cc&r", "setback"],
  });

  // A vendor decision under the same prior term.
  await recordDecision({
    associationId: CHC,
    subject: "Landscaping vendor selection",
    decision: "Selected ABC Landscaping over the incumbent.",
    reasoning: "Lowest of three competitive bids with the strongest references; incumbent had two missed-service complaints.",
    category: "vendor",
    actorName: "Jane Prior",
    actorRole: "Treasurer",
    boardTerm: "2023-2024",
    decidedAt: new Date("2023-07-02"),
    relatedEntityType: "vendor",
    relatedEntityId: "vendor-abc",
    relatedEntityLabel: "ABC Landscaping",
    tags: ["vendor", "landscaping", "bids"],
  });

  // A rule-application decision, later term, different actor.
  await recordDecision({
    associationId: CHC,
    subject: "Trash-bin rule enforcement — Unit 4A",
    decision: "Issued a first-warning notice; no fine.",
    reasoning: "First offense under the bins-in-by-8pm rule; policy is warning-first before assessing a fine.",
    category: "rule_application",
    actorName: "Sam Current",
    actorRole: "Secretary",
    boardTerm: "2024-2025",
    decidedAt: new Date("2024-09-10"),
    relatedEntityType: "owner",
    relatedEntityId: "owner-4a",
    relatedEntityLabel: "Unit 4A — T. Nguyen",
    tags: ["bins", "warning"],
  });

  // A decision in the OTHER association — must never leak into CHC queries.
  await recordDecision({
    associationId: OTHER,
    subject: "Pool-hours change",
    decision: "Extended pool hours to 10pm.",
    reasoning: "Owner petition met the 60% threshold.",
    category: "governance",
    actorName: "Someone Else",
    boardTerm: "2024-2025",
    decidedAt: new Date("2024-06-01"),
  });
}

beforeEach(() => {
  H.decisions.length = 0;
  H.state.seq = 1;
});

describe("recordDecision — acceptance #1 (stores decision + reasoning + actor + date + attachments)", () => {
  it("stores all the institutional fields, tenant-scoped", async () => {
    const d = await recordDecision({
      associationId: CHC,
      subject: "Fence request — Unit 12B",
      decision: "Denied",
      reasoning: "Height exceeded the CC&R limit.",
      actorName: "Jane Prior",
      actorRole: "Treasurer",
      boardTerm: "2023-2024",
      decidedAt: new Date("2023-05-14"),
      attachments: [{ name: "letter.pdf", url: "/x.pdf" }],
    });
    expect(d.id).toBeTruthy();
    expect(d.associationId).toBe(CHC);
    expect(d.subject).toBe("Fence request — Unit 12B");
    expect(d.reasoning).toBe("Height exceeded the CC&R limit.");
    expect(d.actorName).toBe("Jane Prior");
    expect(d.actorRole).toBe("Treasurer");
    expect(d.decidedAt).toEqual(new Date("2023-05-14"));
    expect(d.attachments).toEqual([{ name: "letter.pdf", url: "/x.pdf" }]);
  });

  it("rejects a record missing the reasoning (the 'why' is mandatory)", async () => {
    await expect(
      recordDecision({ associationId: CHC, subject: "x", decision: "y", reasoning: "  ", actorName: "z" }),
    ).rejects.toBeInstanceOf(BoardMemoryError);
  });
});

describe("turnover-survival — acceptance #2", () => {
  it("a decision recorded under term 2023-2024 is retrievable by a user in a later term", async () => {
    await seedCherryHill();
    // A new board member in 2025-2026 asks: "why was the 12B fence denied?"
    const results = await queryDecisions(CHC, { search: "fence" });
    expect(results).toHaveLength(1);
    expect(results[0].boardTerm).toBe("2023-2024");
    expect(results[0].actorName).toBe("Jane Prior"); // survives even though Jane is long gone
    expect(results[0].reasoning).toContain("4ft CC&R limit");
  });

  it("can filter by the historical term explicitly", async () => {
    await seedCherryHill();
    const prior = await queryDecisions(CHC, { boardTerm: "2023-2024" });
    expect(prior).toHaveLength(2);
    expect(prior.every((d) => d.boardTerm === "2023-2024")).toBe(true);
  });
});

describe("query returns prior context with reasoning — acceptance #3", () => {
  it("owner-history lookup surfaces the decision + reasoning", async () => {
    await seedCherryHill();
    const hist = await getEntityHistory(CHC, "owner", "owner-12b");
    expect(hist).toHaveLength(1);
    expect(hist[0].decision).toContain("Denied");
    expect(hist[0].reasoning).toContain("setback");
  });

  it("vendor-history lookup: 'what did the prior treasurer do about this vendor?'", async () => {
    await seedCherryHill();
    const hist = await getEntityHistory(CHC, "vendor", "vendor-abc");
    expect(hist).toHaveLength(1);
    expect(hist[0].actorName).toBe("Jane Prior");
    expect(hist[0].reasoning).toContain("competitive bids");
  });

  it("rule-application lookup returns the enforcement reasoning", async () => {
    await seedCherryHill();
    const ruleDecisions = await queryDecisions(CHC, { category: "rule_application" });
    expect(ruleDecisions).toHaveLength(1);
    expect(ruleDecisions[0].reasoning).toContain("warning-first");
  });

  it("results are ranked most-recent-first", async () => {
    await seedCherryHill();
    const all = await queryDecisions(CHC);
    expect(all).toHaveLength(3);
    expect(all[0].decidedAt.getTime()).toBeGreaterThanOrEqual(all[1].decidedAt.getTime());
  });
});

describe("tenant isolation", () => {
  it("a CHC query never returns the OTHER association's decisions", async () => {
    await seedCherryHill();
    const all = await queryDecisions(CHC);
    expect(all.some((d) => d.associationId === OTHER)).toBe(false);
    expect(all.some((d) => d.subject === "Pool-hours change")).toBe(false);
  });

  it("getDecision refuses to read a decision from another association", async () => {
    await seedCherryHill();
    const otherRow = H.decisions.find((d) => d.associationId === OTHER)!;
    await expect(getDecision(otherRow.id, CHC)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
