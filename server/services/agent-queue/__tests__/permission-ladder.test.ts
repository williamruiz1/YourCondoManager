/**
 * permission-ladder.test.ts — the four-level gate (founder-os#9474).
 *
 * Verifies the AC gating requirements:
 *   - L1 executes with no approval (advisory only → never executes a side-effect)
 *   - L2 honors the per-toggle default (OFF = queue; ON or approved = execute)
 *   - L3 CANNOT execute without a recorded human approval
 *   - L4 requires a board-level approval
 *   - unknown action-types fail CLOSED to L3
 *   - queue ranking pins statutory-deadline items to the top
 *
 * DB-free — pure logic.
 */
import { describe, it, expect } from "vitest";
import {
  levelForActionType,
  isKnownActionType,
  requiredApproval,
  canExecute,
  rankQueue,
  severityRank,
  UNKNOWN_ACTION_LEVEL,
  type RankableAction,
} from "../permission-ladder";

describe("levelForActionType", () => {
  it("maps known action types to their level", () => {
    expect(levelForActionType("owner-faq.suggest")).toBe("L1");
    expect(levelForActionType("owner-faq.send-reply")).toBe("L2");
    expect(levelForActionType("payment.apply")).toBe("L3");
    expect(levelForActionType("assessment.ratify")).toBe("L4");
  });

  it("fails CLOSED to L3 for an unknown action type", () => {
    expect(levelForActionType("something.new")).toBe("L3");
    expect(UNKNOWN_ACTION_LEVEL).toBe("L3");
    expect(isKnownActionType("something.new")).toBe(false);
    expect(isKnownActionType("owner-faq.send-reply")).toBe(true);
  });
});

describe("requiredApproval", () => {
  it("maps each level to its approval requirement", () => {
    expect(requiredApproval("L1")).toBe("none");
    expect(requiredApproval("L2")).toBe("toggle");
    expect(requiredApproval("L3")).toBe("human");
    expect(requiredApproval("L4")).toBe("board");
  });
});

describe("canExecute — the gate", () => {
  const base = { autoExecuteEnabled: false, hasHumanApproval: false, hasBoardApproval: false };

  it("L1 never executes a side-effect (advisory only)", () => {
    const r = canExecute({ ...base, level: "L1" });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/advisory/i);
  });

  it("L2 with the toggle OFF and no approval is HELD (the default)", () => {
    const r = canExecute({ ...base, level: "L2" });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/held for review/i);
  });

  it("L2 auto-executes when the per-association toggle is ON", () => {
    const r = canExecute({ ...base, level: "L2", autoExecuteEnabled: true });
    expect(r.ok).toBe(true);
    expect(r.reason).toMatch(/auto-execute/i);
  });

  it("L2 executes on a recorded human approval even with the toggle OFF", () => {
    const r = canExecute({ ...base, level: "L2", hasHumanApproval: true });
    expect(r.ok).toBe(true);
  });

  it("L3 CANNOT execute without a recorded human approval", () => {
    expect(canExecute({ ...base, level: "L3" }).ok).toBe(false);
    // Toggle must NOT unlock L3.
    expect(canExecute({ ...base, level: "L3", autoExecuteEnabled: true }).ok).toBe(false);
    expect(canExecute({ ...base, level: "L3", hasHumanApproval: true }).ok).toBe(true);
  });

  it("L4 requires a board-level approval (human approval alone is insufficient)", () => {
    expect(canExecute({ ...base, level: "L4" }).ok).toBe(false);
    expect(canExecute({ ...base, level: "L4", hasHumanApproval: true }).ok).toBe(false);
    expect(canExecute({ ...base, level: "L4", hasBoardApproval: true }).ok).toBe(true);
  });
});

describe("rankQueue — severity ranking", () => {
  const mk = (over: Partial<RankableAction>): RankableAction => ({
    level: "L1",
    statutoryDeadline: false,
    createdAtMs: 1_000_000,
    ...over,
  });

  it("pins statutory-deadline items to the top regardless of level", () => {
    const items = [
      mk({ level: "L4", statutoryDeadline: false }),
      mk({ level: "L1", statutoryDeadline: true }), // statutory but lowest level
    ];
    const ranked = rankQueue(items);
    expect(ranked[0].statutoryDeadline).toBe(true);
  });

  it("orders non-statutory items by level (L4 first)", () => {
    const items = [mk({ level: "L1" }), mk({ level: "L4" }), mk({ level: "L2" }), mk({ level: "L3" })];
    const ranked = rankQueue(items);
    expect(ranked.map((r) => r.level)).toEqual(["L4", "L3", "L2", "L1"]);
  });

  it("severityRank is lower (earlier) for statutory items", () => {
    expect(severityRank(mk({ statutoryDeadline: true }))).toBeLessThan(
      severityRank(mk({ statutoryDeadline: false })),
    );
  });
});
