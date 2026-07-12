/**
 * Agent-action service — YCM Chief-of-Staff queue + four-level permission ladder
 * + append-only audit log (founder-os#9474, W1 foundation).
 *
 * The queue IS the chief-of-staff surface; every agent-proposed action routes
 * through it. The ladder is SERVER-AUTHORITATIVE: the level is assigned from the
 * action-TYPE (never trusted from the agent), and the execution gate refuses an
 * L3/L4 action without a recorded human approval — L4 requiring a BOARD-level
 * approver.
 *
 *   L1 suggest             — always executable; no approval.
 *   L2 reversible          — per-toggle default (association auto-approve toggle
 *                            per action-type); else requires an approval.
 *   L3 financial/irreversible — ALWAYS requires a recorded human approval.
 *   L4 board/member-affecting — requires a BOARD-level approval (board-officer).
 *
 * Tenant isolation: every read/write is scoped by associationId derived from the
 * caller's session — never from the request body. The audit log is append-only;
 * this service never UPDATEs or DELETEs it.
 *
 * Design note: the pure ladder functions (`levelForActionType`, `evaluateGate`,
 * `isBoardRole`, `rankQueue`) carry the gating logic and are exported for direct
 * unit testing; the DB operations compose them.
 */
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  agentActions,
  agentActionAuditLog,
  agentActionToggles,
  type AgentAction,
  type AgentActionAuditEntry,
  type AgentActionLevel,
  type AgentActionStatus,
} from "@shared/schema";

export class AgentActionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: number = 400,
  ) {
    super(message);
    this.name = "AgentActionError";
  }
}

// ── The action-type → level map (server-authoritative). ──────────────────────
// The AGENT proposes an action-type; the SERVER decides the privilege level from
// this map. An UNKNOWN action-type fails CLOSED to L3 (always-human-approve) so a
// mislabeled or novel action can never slip through as low-privilege.
export const ACTION_TYPE_LEVELS: Record<string, AgentActionLevel> = {
  // L1 — suggest / advisory. Always allowed, no side effects on the record of
  // truth beyond surfacing.
  "suggest.owner_faq_reply": "L1",
  "suggest.meeting_prep": "L1",
  "suggest.summary": "L1",
  "suggest.ap_categorization": "L1",
  "suggest.flag_anomaly": "L1",
  // Vendor compliance renewal reminder (founder-os#9482, W-9/COI/insurance
  // expiry sweep) — informational only; never auto-terminates a vendor.
  "suggest.vendor_compliance_renewal": "L1",
  // L2 — reversible. Honors the per-association per-type autonomy toggle.
  "reversible.snooze_pressing_item": "L2",
  "reversible.tag_record": "L2",
  "reversible.draft_notice": "L2",
  "reversible.schedule_reminder": "L2",
  "reversible.assign_work_order": "L2",
  // Meeting-prep packet distribution (founder-os#9478, W3) — sending the drafted
  // agenda/packet to the board/owners. Reversible in the sense that a re-send /
  // correction is always possible; still requires an approval unless the
  // association's L2 autonomy toggle is on for this type.
  "reversible.distribute_meeting_packet": "L2",
  // ARC workflow plumbing (founder-os#9481, W2). Moving a request through intake
  // and routing is reversible workflow plumbing — the agent may do it (L2). The
  // approve/deny DECISION is L4 (member-affecting) below.
  "reversible.arc_route": "L2",
  // L3 — financial / irreversible. ALWAYS requires a human approval.
  "financial.approve_disbursement": "L3",
  "financial.post_ledger_entry": "L3",
  "financial.issue_refund": "L3",
  "irreversible.send_owner_notice": "L3",
  "irreversible.delete_record": "L3",
  // Issuance of a statutory record (resale certificate / estoppel / records
  // response — founder-os#9483). Irreversible + legally-binding on the
  // association; ALWAYS requires the PM's recorded sign before it is issued.
  "irreversible.issue_statutory_record": "L3",
  // L4 — board / member-affecting. Requires a BOARD-level approval.
  "board.publish_meeting_minutes": "L4",
  "board.record_vote": "L4",
  "board.amend_governance": "L4",
  "member.assess_fine": "L4",
  "member.change_assessment": "L4",
  // ARC committee decision (founder-os#9481, W2). Approving OR denying an owner's
  // architectural-change request is member-affecting → L4: it can NEVER be
  // actuated by an agent alone; it requires a board-level human decision. A
  // DENIAL in particular carries member-appeal rights, so the L4 gate is the
  // load-bearing control. The appeal decision is likewise L4.
  "member.arc_decision": "L4",
  "member.arc_appeal_decision": "L4",
};

export const DEFAULT_UNKNOWN_LEVEL: AgentActionLevel = "L3";

/** Server-authoritative level for an action-type; unknown → fail-closed to L3. */
export function levelForActionType(actionType: string): AgentActionLevel {
  return ACTION_TYPE_LEVELS[actionType] ?? DEFAULT_UNKNOWN_LEVEL;
}

// Board-level roles that may approve an L4 (board/member-affecting) action.
// platform-admin is the super-role; board-officer is the board seat.
export const BOARD_APPROVAL_ROLES = ["platform-admin", "board-officer"] as const;
export function isBoardRole(role: string | undefined | null): boolean {
  return !!role && (BOARD_APPROVAL_ROLES as readonly string[]).includes(role);
}

/**
 * PURE execution gate. Given a level, the current status, and whether the L2
 * autonomy toggle is on, decide whether the action may EXECUTE now.
 *   L1 → always.
 *   L2 → toggle-on executes; otherwise needs an approval.
 *   L3 → only when approved.
 *   L4 → only when approved (approval path enforces the board-role requirement).
 */
export function evaluateGate(params: {
  level: AgentActionLevel;
  status: AgentActionStatus;
  autoApprove: boolean;
}): { executable: boolean; code?: string; reason?: string } {
  const { level, status, autoApprove } = params;
  if (status === "executed") return { executable: false, code: "ALREADY_EXECUTED", reason: "action already executed" };
  if (status === "rejected") return { executable: false, code: "REJECTED", reason: "action was rejected" };
  switch (level) {
    case "L1":
      return { executable: true };
    case "L2":
      if (autoApprove || status === "approved") return { executable: true };
      return { executable: false, code: "APPROVAL_REQUIRED", reason: "L2 action requires approval (autonomy toggle off)" };
    case "L3":
      if (status === "approved") return { executable: true };
      return { executable: false, code: "APPROVAL_REQUIRED", reason: "L3 (financial/irreversible) requires a recorded human approval" };
    case "L4":
      if (status === "approved") return { executable: true };
      return { executable: false, code: "BOARD_APPROVAL_REQUIRED", reason: "L4 (board/member-affecting) requires a board-level approval" };
    default:
      return { executable: false, code: "UNKNOWN_LEVEL", reason: "unknown level" };
  }
}

// Severity ranking for the queue stack (higher = more severe).
const SEVERITY_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
function severityRank(sev: string): number {
  return SEVERITY_RANK[sev] ?? 0;
}

/**
 * PURE queue ranking. Statutory-deadline items pin to the TOP (soonest deadline
 * first); then by severity (desc); then by created (asc — oldest first).
 */
export function rankQueue<T extends { statutoryDeadline: Date | null; severity: string; createdAt: Date }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aHas = a.statutoryDeadline != null;
    const bHas = b.statutoryDeadline != null;
    if (aHas && bHas) {
      const d = a.statutoryDeadline!.getTime() - b.statutoryDeadline!.getTime();
      if (d !== 0) return d;
    } else if (aHas !== bHas) {
      return aHas ? -1 : 1; // statutory items above non-statutory
    }
    const s = severityRank(b.severity) - severityRank(a.severity);
    if (s !== 0) return s;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

// ── DB operations ────────────────────────────────────────────────────────────

async function writeAudit(entry: {
  associationId: string;
  actionId: string;
  event: string;
  actorType: string;
  actorId?: string | null;
  actorEmail?: string | null;
  detail?: string | null;
  snapshot?: unknown;
}): Promise<void> {
  await db.insert(agentActionAuditLog).values({
    associationId: entry.associationId,
    actionId: entry.actionId,
    event: entry.event,
    actorType: entry.actorType,
    actorId: entry.actorId ?? null,
    actorEmail: entry.actorEmail ?? null,
    detail: entry.detail ?? null,
    snapshot: (entry.snapshot ?? null) as any,
  });
}

export interface FileActionInput {
  associationId: string;
  actionType: string;
  reasoning: string;
  createdByAgent: string;
  targetEntityType?: string | null;
  targetEntityId?: string | null;
  payload?: unknown;
  severity?: string;
  statutoryDeadline?: Date | null;
}

/** Agent files an action onto the queue. Level is assigned server-side. */
export async function fileAction(input: FileActionInput): Promise<AgentAction> {
  if (!input.associationId) throw new AgentActionError("associationId required", "VALIDATION");
  if (!input.actionType) throw new AgentActionError("actionType required", "VALIDATION");
  if (!input.reasoning || !input.reasoning.trim()) throw new AgentActionError("reasoning required", "VALIDATION");
  if (!input.createdByAgent) throw new AgentActionError("createdByAgent required", "VALIDATION");

  const level = levelForActionType(input.actionType);
  const [created] = await db
    .insert(agentActions)
    .values({
      associationId: input.associationId,
      actionType: input.actionType,
      level,
      status: "queued",
      targetEntityType: input.targetEntityType ?? null,
      targetEntityId: input.targetEntityId ?? null,
      payload: (input.payload ?? null) as any,
      reasoning: input.reasoning,
      severity: input.severity ?? "medium",
      statutoryDeadline: input.statutoryDeadline ?? null,
      createdByAgent: input.createdByAgent,
    })
    .returning();

  await writeAudit({
    associationId: created.associationId,
    actionId: created.id,
    event: "filed",
    actorType: "agent",
    actorId: created.createdByAgent,
    detail: created.reasoning,
    snapshot: created,
  });
  return created;
}

async function loadScoped(actionId: string, associationId: string): Promise<AgentAction> {
  const [row] = await db
    .select()
    .from(agentActions)
    .where(and(eq(agentActions.id, actionId), eq(agentActions.associationId, associationId)));
  if (!row) throw new AgentActionError("agent action not found", "NOT_FOUND", 404);
  return row;
}

export interface Approver {
  adminUserId: string;
  email: string;
  role?: string | null;
}

/** A human approves a queued action. L4 requires a board-level approver. */
export async function approveAction(actionId: string, associationId: string, approver: Approver): Promise<AgentAction> {
  const action = await loadScoped(actionId, associationId);
  if (action.status !== "queued") {
    throw new AgentActionError(`cannot approve an action in status "${action.status}"`, "INVALID_STATE", 409);
  }
  if (action.level === "L1") {
    throw new AgentActionError("L1 (suggest) actions need no approval", "NO_APPROVAL_NEEDED");
  }
  if (action.level === "L4" && !isBoardRole(approver.role)) {
    throw new AgentActionError("L4 (board/member-affecting) requires a board-level approver", "BOARD_APPROVAL_REQUIRED", 403);
  }
  const [updated] = await db
    .update(agentActions)
    .set({
      status: "approved",
      approvedByUserId: approver.adminUserId,
      approvedByEmail: approver.email,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(agentActions.id, actionId), eq(agentActions.associationId, associationId)))
    .returning();
  await writeAudit({
    associationId,
    actionId,
    event: "approved",
    actorType: "human",
    actorId: approver.adminUserId,
    actorEmail: approver.email,
    detail: `approved by ${approver.email} (role=${approver.role ?? "n/a"})`,
    snapshot: updated,
  });
  return updated;
}

/** A human rejects a queued action. */
export async function rejectAction(actionId: string, associationId: string, approver: Approver, reason?: string): Promise<AgentAction> {
  const action = await loadScoped(actionId, associationId);
  if (action.status !== "queued") {
    throw new AgentActionError(`cannot reject an action in status "${action.status}"`, "INVALID_STATE", 409);
  }
  const [updated] = await db
    .update(agentActions)
    .set({
      status: "rejected",
      rejectedByUserId: approver.adminUserId,
      rejectedByEmail: approver.email,
      rejectedAt: new Date(),
      rejectionReason: reason ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(agentActions.id, actionId), eq(agentActions.associationId, associationId)))
    .returning();
  await writeAudit({
    associationId,
    actionId,
    event: "rejected",
    actorType: "human",
    actorId: approver.adminUserId,
    actorEmail: approver.email,
    detail: reason ?? "rejected",
    snapshot: updated,
  });
  return updated;
}

async function autoApproveFor(associationId: string, actionType: string): Promise<boolean> {
  const [row] = await db
    .select()
    .from(agentActionToggles)
    .where(and(eq(agentActionToggles.associationId, associationId), eq(agentActionToggles.actionType, actionType)));
  return !!row && row.autoApprove === 1;
}

/**
 * Execute an action THROUGH the permission gate. Refuses (throwing
 * AgentActionError) when the ladder requires an approval that isn't recorded.
 * On success, marks the action executed and writes an immutable audit entry.
 *
 * In this W1 foundation "execute" records the executed FACT + audit entry; the
 * concrete downstream ability (owner-FAQ reply, AP posting, …) is a separate
 * dispatch that actuates THROUGH this gate.
 */
export async function executeAction(actionId: string, associationId: string, actor: { actorType?: string; actorId?: string; actorEmail?: string }): Promise<AgentAction> {
  const action = await loadScoped(actionId, associationId);
  const autoApprove = action.level === "L2" ? await autoApproveFor(associationId, action.actionType) : false;
  const gate = evaluateGate({ level: action.level, status: action.status, autoApprove });
  if (!gate.executable) {
    throw new AgentActionError(gate.reason ?? "action not executable", gate.code ?? "NOT_EXECUTABLE", gate.code === "BOARD_APPROVAL_REQUIRED" ? 403 : 409);
  }
  const [updated] = await db
    .update(agentActions)
    .set({ status: "executed", executedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(agentActions.id, actionId), eq(agentActions.associationId, associationId)))
    .returning();
  await writeAudit({
    associationId,
    actionId,
    event: "executed",
    actorType: actor.actorType ?? "system",
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    detail: `executed at level ${action.level}${autoApprove ? " (L2 autonomy toggle)" : action.status === "approved" ? " (human-approved)" : ""}`,
    snapshot: updated,
  });
  return updated;
}

export interface QueueOptions {
  statuses?: AgentActionStatus[];
}

/** The queue surface — severity-ranked, statutory-pinned. */
export async function listQueue(associationId: string, opts: QueueOptions = {}): Promise<AgentAction[]> {
  const statuses = opts.statuses ?? (["queued", "approved"] as AgentActionStatus[]);
  const rows = await db
    .select()
    .from(agentActions)
    .where(and(eq(agentActions.associationId, associationId), inArray(agentActions.status, statuses)))
    .orderBy(desc(agentActions.createdAt));
  return rankQueue(rows);
}

/** Immutable audit trail for one action (scoped), oldest event first. */
export async function getAuditLog(actionId: string, associationId: string): Promise<AgentActionAuditEntry[]> {
  await loadScoped(actionId, associationId); // enforce scope / existence
  return db
    .select()
    .from(agentActionAuditLog)
    .where(and(eq(agentActionAuditLog.actionId, actionId), eq(agentActionAuditLog.associationId, associationId)))
    .orderBy(asc(agentActionAuditLog.createdAt));
}

/** Set the per-association L2 autonomy toggle for an action-type. */
export async function setToggle(associationId: string, actionType: string, autoApprove: boolean): Promise<void> {
  const [existing] = await db
    .select()
    .from(agentActionToggles)
    .where(and(eq(agentActionToggles.associationId, associationId), eq(agentActionToggles.actionType, actionType)));
  if (existing) {
    await db
      .update(agentActionToggles)
      .set({ autoApprove: autoApprove ? 1 : 0, updatedAt: new Date() })
      .where(eq(agentActionToggles.id, existing.id));
  } else {
    await db.insert(agentActionToggles).values({ associationId, actionType, autoApprove: autoApprove ? 1 : 0 });
  }
}
