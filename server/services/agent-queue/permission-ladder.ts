/**
 * permission-ladder.ts — the four-level agent permission ladder (pure logic).
 *
 * founder-os#9474 (W1 foundation). This is the gating layer every agent ability
 * (owner-FAQ triage #9476, AP suggestions, meeting prep, …) actuates through.
 *
 * The ladder (research #833 [472] §5.1 / §7.2):
 *   L1 suggest      — read-only / advisory. Always allowed, never sends on its own.
 *   L2 reversible    — writes to YCM-owned state that can be undone (e.g. sending a
 *                      drafted owner reply). Default = QUEUE for human approval; a
 *                      per-association toggle may enable auto-execute.
 *   L3 financial/irreversible — touches money or anything not cleanly reversible.
 *                      ALWAYS requires a recorded human approval.
 *   L4 board/member-affecting — governance / board-level. ALWAYS requires a
 *                      board-level approval.
 *
 * DB-free by construction — the service layer wires these into persistence.
 */

export type AgentActionLevel = "L1" | "L2" | "L3" | "L4";

export type AgentActionStatus =
  | "draft" // filed by the agent, not yet queued for a human
  | "queued" // awaiting a human/board decision
  | "approved" // a human approved; ready to execute
  | "executed" // side-effect performed
  | "audited"; // terminal — logged + closed

/**
 * The approval a level requires before its side-effect may execute.
 *   - "none"   — L1: nothing to approve; advisory only.
 *   - "toggle" — L2: honors the per-association auto-execute toggle. When the
 *                toggle is OFF (the DEFAULT), a human approval is required.
 *   - "human"  — L3: a recorded human approval is ALWAYS required.
 *   - "board"  — L4: a board-level approval is ALWAYS required.
 */
export type ApprovalRequirement = "none" | "toggle" | "human" | "board";

/**
 * Canonical action-type → level map. Action types are stable string keys the
 * agent abilities file under; unknown types fail CLOSED to L3 (treat unknown
 * side-effects as financial/irreversible until explicitly classified) so a new
 * ability can never accidentally auto-execute at a lower gate than intended.
 */
const ACTION_TYPE_LEVELS: Record<string, AgentActionLevel> = {
  // ── L1 — suggest / advisory (read-only, no side-effect) ──────────────────
  "owner-faq.suggest": "L1",
  "insight.surface": "L1",
  "reminder.suggest": "L1",

  // ── L2 — reversible YCM-owned writes ─────────────────────────────────────
  // Sending a drafted owner reply is reversible (a follow-up correction can be
  // sent); it is the owner-FAQ triage ability's send action (#9476).
  "owner-faq.send-reply": "L2",
  "document.share": "L2",
  "meeting.notify": "L2",

  // ── L3 — financial / irreversible (always human-approve) ─────────────────
  "payment.apply": "L3",
  "refund.issue": "L3",
  "late-fee.assess": "L3",
  "disbursement.create": "L3",

  // ── L4 — board / member-affecting (always board-approve) ─────────────────
  "assessment.ratify": "L4",
  "board.resolution": "L4",
  "governance.change": "L4",
};

/** Fail-closed default for an unrecognized action type. */
export const UNKNOWN_ACTION_LEVEL: AgentActionLevel = "L3";

/** Map an action-type key to its ladder level (fail-closed to L3 if unknown). */
export function levelForActionType(actionType: string): AgentActionLevel {
  return ACTION_TYPE_LEVELS[actionType] ?? UNKNOWN_ACTION_LEVEL;
}

/** Whether an action-type is a known, explicitly-classified type. */
export function isKnownActionType(actionType: string): boolean {
  return actionType in ACTION_TYPE_LEVELS;
}

/** The approval a level requires. */
export function requiredApproval(level: AgentActionLevel): ApprovalRequirement {
  switch (level) {
    case "L1":
      return "none";
    case "L2":
      return "toggle";
    case "L3":
      return "human";
    case "L4":
      return "board";
  }
}

export interface CanExecuteInput {
  level: AgentActionLevel;
  /** Whether the L2 per-association auto-execute toggle is ON. Ignored for other levels. */
  autoExecuteEnabled: boolean;
  /** Whether a recorded human approval exists for this action. */
  hasHumanApproval: boolean;
  /** Whether a recorded board-level approval exists for this action. */
  hasBoardApproval: boolean;
}

export interface CanExecuteResult {
  ok: boolean;
  /** Machine-readable reason — always set, for audit + explainability. */
  reason: string;
}

/**
 * The gate. Decides whether an action's side-effect may execute NOW.
 *
 *   L1 → never executes a side-effect (advisory only) → ok:false, reason explains.
 *   L2 → executes ONLY if the auto-execute toggle is ON or a human approved.
 *        (Toggle OFF + no approval = the DEFAULT "queue for review" behavior.)
 *   L3 → executes ONLY with a recorded human approval.
 *   L4 → executes ONLY with a recorded board approval.
 *
 * Fail-closed: any path that isn't explicitly permitted returns ok:false.
 */
export function canExecute(input: CanExecuteInput): CanExecuteResult {
  const { level, autoExecuteEnabled, hasHumanApproval, hasBoardApproval } = input;
  switch (level) {
    case "L1":
      return {
        ok: false,
        reason: "L1 is advisory only — it surfaces a suggestion and never executes a side-effect.",
      };
    case "L2":
      if (hasHumanApproval) {
        return { ok: true, reason: "L2 executed on a recorded human approval." };
      }
      if (autoExecuteEnabled) {
        return { ok: true, reason: "L2 auto-executed — the per-association auto-execute toggle is ON." };
      }
      return {
        ok: false,
        reason: "L2 held for review — auto-execute toggle is OFF (default) and no human approval recorded.",
      };
    case "L3":
      return hasHumanApproval
        ? { ok: true, reason: "L3 executed on a recorded human approval." }
        : { ok: false, reason: "L3 blocked — financial/irreversible action requires a recorded human approval." };
    case "L4":
      return hasBoardApproval
        ? { ok: true, reason: "L4 executed on a recorded board approval." }
        : { ok: false, reason: "L4 blocked — board/member-affecting action requires a board-level approval." };
  }
}

/**
 * Severity rank for the queue surface. LOWER sorts to the TOP.
 * Statutory-deadline items pin to the top regardless of level, then by level
 * (L4 > L3 > L2 > L1 urgency), then by age (older first).
 */
export interface RankableAction {
  level: AgentActionLevel;
  statutoryDeadline: boolean;
  createdAtMs: number;
}

export function severityRank(a: RankableAction): number {
  // Statutory-deadline items get a huge negative offset → always first.
  const statutory = a.statutoryDeadline ? -1_000_000 : 0;
  const levelWeight: Record<AgentActionLevel, number> = { L4: 0, L3: 1, L2: 2, L1: 3 };
  // Age contributes a tiny tiebreaker (older = slightly earlier).
  const ageTiebreak = a.createdAtMs / 1e15;
  return statutory + levelWeight[a.level] + ageTiebreak;
}

/** Rank a queue: statutory-deadline pinned to top, then level, then age. */
export function rankQueue<T extends RankableAction>(actions: T[]): T[] {
  return [...actions].sort((x, y) => severityRank(x) - severityRank(y));
}
