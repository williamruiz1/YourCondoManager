/**
 * Permission-ladder gating tests (founder-os#9474, acceptance criteria 3 + 4).
 *
 * The ladder logic is pure and exported (`levelForActionType`, `evaluateGate`,
 * `isBoardRole`, `rankQueue`), so the gating matrix is exercised directly with no
 * DB — deterministic proof of the acceptance criteria:
 *   - an L1 action executes with no approval;
 *   - an L2 action honors the per-toggle default (off → needs approval; on → executes);
 *   - an L3 action CANNOT execute without a recorded human approval;
 *   - an L4 action requires a board-level approval;
 *   - the queue is severity-ranked with statutory-deadline items pinned to top.
 */
import { describe, expect, it } from "vitest";
import {
  levelForActionType,
  evaluateGate,
  isBoardRole,
  rankQueue,
  ACTION_TYPE_LEVELS,
  DEFAULT_UNKNOWN_LEVEL,
} from "../agent-action-service";

describe("levelForActionType — server-authoritative level assignment", () => {
  it("maps known action-types to their canonical level", () => {
    expect(levelForActionType("suggest.owner_faq_reply")).toBe("L1");
    expect(levelForActionType("reversible.snooze_pressing_item")).toBe("L2");
    expect(levelForActionType("financial.approve_disbursement")).toBe("L3");
    expect(levelForActionType("board.record_vote")).toBe("L4");
    expect(levelForActionType("member.assess_fine")).toBe("L4");
  });

  it("FAILS CLOSED: an unknown action-type defaults to L3 (always-human-approve)", () => {
    expect(levelForActionType("totally.unknown.action")).toBe(DEFAULT_UNKNOWN_LEVEL);
    expect(DEFAULT_UNKNOWN_LEVEL).toBe("L3");
  });

  it("every mapped type is one of the four levels", () => {
    for (const level of Object.values(ACTION_TYPE_LEVELS)) {
      expect(["L1", "L2", "L3", "L4"]).toContain(level);
    }
  });
});

describe("evaluateGate — the four-level execution gate", () => {
  it("L1 executes with NO approval", () => {
    expect(evaluateGate({ level: "L1", status: "queued", autoApprove: false })).toEqual({ executable: true });
  });

  it("L2 honors the per-toggle default: toggle OFF → needs approval", () => {
    const g = evaluateGate({ level: "L2", status: "queued", autoApprove: false });
    expect(g.executable).toBe(false);
    expect(g.code).toBe("APPROVAL_REQUIRED");
  });

  it("L2 honors the per-toggle default: toggle ON → executes", () => {
    expect(evaluateGate({ level: "L2", status: "queued", autoApprove: true })).toEqual({ executable: true });
  });

  it("L2 with a recorded approval executes even when the toggle is off", () => {
    expect(evaluateGate({ level: "L2", status: "approved", autoApprove: false }).executable).toBe(true);
  });

  it("L3 CANNOT execute without a recorded human approval", () => {
    const g = evaluateGate({ level: "L3", status: "queued", autoApprove: false });
    expect(g.executable).toBe(false);
    expect(g.code).toBe("APPROVAL_REQUIRED");
  });

  it("L3 executes once approved", () => {
    expect(evaluateGate({ level: "L3", status: "approved", autoApprove: false }).executable).toBe(true);
  });

  it("an L3 toggle can NEVER bypass approval (toggle is ignored for L3)", () => {
    // Even a stray autoApprove flag cannot execute an unapproved L3.
    expect(evaluateGate({ level: "L3", status: "queued", autoApprove: true }).executable).toBe(false);
  });

  it("L4 requires approval; unapproved → BOARD_APPROVAL_REQUIRED", () => {
    const g = evaluateGate({ level: "L4", status: "queued", autoApprove: false });
    expect(g.executable).toBe(false);
    expect(g.code).toBe("BOARD_APPROVAL_REQUIRED");
  });

  it("L4 executes once (board-)approved", () => {
    expect(evaluateGate({ level: "L4", status: "approved", autoApprove: false }).executable).toBe(true);
  });

  it("a rejected action is never executable", () => {
    expect(evaluateGate({ level: "L1", status: "rejected", autoApprove: true }).executable).toBe(false);
    expect(evaluateGate({ level: "L3", status: "rejected", autoApprove: false }).code).toBe("REJECTED");
  });

  it("an already-executed action is not re-executable", () => {
    expect(evaluateGate({ level: "L1", status: "executed", autoApprove: true }).executable).toBe(false);
  });
});

describe("isBoardRole — L4 board-approval gate", () => {
  it("board-officer and platform-admin are board-level; others are not", () => {
    expect(isBoardRole("board-officer")).toBe(true);
    expect(isBoardRole("platform-admin")).toBe(true);
    expect(isBoardRole("manager")).toBe(false);
    expect(isBoardRole("pm-assistant")).toBe(false);
    expect(isBoardRole("viewer")).toBe(false);
    expect(isBoardRole(undefined)).toBe(false);
    expect(isBoardRole(null)).toBe(false);
  });
});

describe("rankQueue — severity-ranked, statutory-pinned surface", () => {
  const d = (iso: string) => new Date(iso);
  it("pins statutory-deadline items to the TOP, soonest first", () => {
    const items = [
      { id: "a", statutoryDeadline: null, severity: "critical", createdAt: d("2026-07-01") },
      { id: "b", statutoryDeadline: d("2026-08-01"), severity: "low", createdAt: d("2026-07-02") },
      { id: "c", statutoryDeadline: d("2026-07-15"), severity: "low", createdAt: d("2026-07-03") },
    ];
    const ranked = rankQueue(items).map((i) => i.id);
    expect(ranked[0]).toBe("c"); // soonest statutory deadline
    expect(ranked[1]).toBe("b"); // later statutory deadline
    expect(ranked[2]).toBe("a"); // non-statutory, even though critical
  });

  it("orders non-statutory items by severity (desc) then created (asc)", () => {
    const items = [
      { id: "low", statutoryDeadline: null, severity: "low", createdAt: d("2026-07-01") },
      { id: "crit", statutoryDeadline: null, severity: "critical", createdAt: d("2026-07-02") },
      { id: "high", statutoryDeadline: null, severity: "high", createdAt: d("2026-07-03") },
      { id: "med", statutoryDeadline: null, severity: "medium", createdAt: d("2026-07-04") },
    ];
    expect(rankQueue(items).map((i) => i.id)).toEqual(["crit", "high", "med", "low"]);
  });

  it("breaks a severity tie by oldest-first", () => {
    const items = [
      { id: "newer", statutoryDeadline: null, severity: "high", createdAt: d("2026-07-05") },
      { id: "older", statutoryDeadline: null, severity: "high", createdAt: d("2026-07-01") },
    ];
    expect(rankQueue(items).map((i) => i.id)).toEqual(["older", "newer"]);
  });
});
