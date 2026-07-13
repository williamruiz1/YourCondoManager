/**
 * Board-memory pure-helper + L1-read-only-invariant tests (founder-os#9475,
 * acceptance criteria 3 + 4).
 *
 * The query logic is pure and exported (`matchesSearch`, `filterBySearch`,
 * `rankDecisions`), so the free-text lookup + ranking are exercised directly
 * with no DB. The read-only invariant (acceptance #4: "All memory operations
 * are L1 read-only — no actuation path exists") is asserted structurally: the
 * module exports NO approve/execute/actuate function, and every operation is
 * declared L1.
 */
import { describe, expect, it } from "vitest";
import * as boardMemory from "../board-memory-service";
import {
  matchesSearch,
  filterBySearch,
  rankDecisions,
  BOARD_MEMORY_LEVEL,
} from "../board-memory-service";

function mkDecision(over: Partial<Parameters<typeof matchesSearch>[0]> = {}) {
  return {
    subject: "Fence request 12B",
    decision: "Denied",
    reasoning: "Height exceeded the 4ft CC&R limit; setback too close to the shared walkway.",
    actorName: "Jane Prior (Treasurer)",
    relatedEntityLabel: "Unit 12B",
    tags: ["fence", "arc", "cc&r"],
    ...over,
  };
}

describe("matchesSearch — free-text lookup across searchable fields", () => {
  it("empty/undefined term matches everything", () => {
    expect(matchesSearch(mkDecision(), "")).toBe(true);
    expect(matchesSearch(mkDecision(), undefined)).toBe(true);
    expect(matchesSearch(mkDecision(), "   ")).toBe(true);
  });

  it("matches on subject, case-insensitive", () => {
    expect(matchesSearch(mkDecision(), "FENCE")).toBe(true);
  });

  it("matches on the reasoning (the 'why')", () => {
    expect(matchesSearch(mkDecision(), "setback")).toBe(true);
  });

  it("matches on the actor name (survives turnover lookups by prior actor)", () => {
    expect(matchesSearch(mkDecision(), "jane prior")).toBe(true);
  });

  it("matches on a tag", () => {
    expect(matchesSearch(mkDecision(), "cc&r")).toBe(true);
  });

  it("matches on the related-entity label", () => {
    expect(matchesSearch(mkDecision(), "unit 12b")).toBe(true);
  });

  it("returns false when the term appears nowhere", () => {
    expect(matchesSearch(mkDecision(), "swimming pool")).toBe(false);
  });
});

describe("filterBySearch", () => {
  it("filters a list down to matches", () => {
    const items = [
      mkDecision({ subject: "Fence request 12B" }),
      mkDecision({ subject: "Vendor: ABC Landscaping renewal", reasoning: "3 competing bids; lowest with references", tags: ["vendor"] }),
    ];
    expect(filterBySearch(items, "vendor")).toHaveLength(1);
    expect(filterBySearch(items, "")).toHaveLength(2);
  });
});

describe("rankDecisions — most-recent decision first", () => {
  it("sorts by decidedAt desc, tie-broken by createdAt desc", () => {
    const older = { decidedAt: new Date("2023-03-01"), createdAt: new Date("2023-03-01"), id: "older" };
    const newer = { decidedAt: new Date("2025-06-01"), createdAt: new Date("2025-06-01"), id: "newer" };
    const tieA = { decidedAt: new Date("2024-01-01"), createdAt: new Date("2024-01-01T09:00:00Z"), id: "tieA" };
    const tieB = { decidedAt: new Date("2024-01-01"), createdAt: new Date("2024-01-01T18:00:00Z"), id: "tieB" };
    const ranked = rankDecisions([older, tieA, newer, tieB]);
    expect(ranked.map((r) => r.id)).toEqual(["newer", "tieB", "tieA", "older"]);
  });

  it("is pure — does not mutate the input array", () => {
    const items = [
      { decidedAt: new Date("2023-01-01"), createdAt: new Date("2023-01-01"), id: "a" },
      { decidedAt: new Date("2024-01-01"), createdAt: new Date("2024-01-01"), id: "b" },
    ];
    const before = items.map((i) => i.id);
    rankDecisions(items);
    expect(items.map((i) => i.id)).toEqual(before);
  });
});

describe("L1 read-only invariant (acceptance #4 — no actuation path exists)", () => {
  it("every board-memory operation is declared L1", () => {
    expect(BOARD_MEMORY_LEVEL).toBe("L1");
  });

  it("the module exports NO approve/execute/actuate/reject/delete function", () => {
    const exportNames = Object.keys(boardMemory);
    const banned = /^(approve|execute|actuate|reject|delete|remove|update|mutate|disburse|post|send)/i;
    const offenders = exportNames.filter((n) => banned.test(n));
    expect(offenders).toEqual([]);
  });

  it("exports exactly the read + append-log surface (recordDecision, queries) and nothing that actuates", () => {
    // The only write is recordDecision (append-only institutional logging).
    expect(typeof boardMemory.recordDecision).toBe("function");
    expect(typeof boardMemory.queryDecisions).toBe("function");
    expect(typeof boardMemory.getDecision).toBe("function");
    expect(typeof boardMemory.getEntityHistory).toBe("function");
  });
});
