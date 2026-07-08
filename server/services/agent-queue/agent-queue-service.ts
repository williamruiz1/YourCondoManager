/**
 * agent-queue-service.ts — the agent Chief-of-Staff queue (founder-os#9474).
 *
 * Persistence + lifecycle over the pure permission-ladder. Tenant-isolated by
 * associationId on every read/write (the CallerContext.associationId is the
 * ONLY authoritative scope — never an LLM-supplied id).
 *
 *   fileAction   — an agent ability files an action at its ladder level.
 *   approveAction — a human/board records an approval.
 *   getQueue     — the severity-ranked surface (statutory pinned to top).
 *   getAuditLog  — the immutable per-action trail.
 *
 * Every lifecycle event writes an append-only audit row.
 */
import { and, eq, desc } from "drizzle-orm";

import { db } from "../../db";
import {
  agentActions,
  agentActionAuditLog,
  type AgentAction,
  type AgentActionAuditEntry,
} from "../../../shared/schema";
import { isToggleEnabled } from "../../pm-toggles";
import {
  levelForActionType,
  canExecute,
  rankQueue,
  requiredApproval,
  type AgentActionLevel,
} from "./permission-ladder";

/** The per-association toggle that enables L2 auto-execute (default OFF). */
export const AGENT_OWNER_FAQ_AUTOSEND_TOGGLE = "agent_owner_faq_autosend" as const;

export interface FileActionInput {
  associationId: string;
  actionType: string;
  payload: Record<string, unknown>;
  reasoning: string;
  sourceData?: Record<string, unknown>;
  createdByAgent: string;
  targetEntity?: string | null;
  statutoryDeadline?: boolean;
}

export interface FileActionResult {
  action: AgentAction;
  level: AgentActionLevel;
  /** Whether the action auto-executed at file-time (only possible for L2 + toggle ON). */
  autoExecuted: boolean;
  /** The gate's reason (for the caller + the audit trail). */
  gateReason: string;
}

async function appendAudit(
  actionId: string,
  associationId: string,
  event: string,
  actor: string,
  detail: Record<string, unknown> = {},
): Promise<void> {
  await db.insert(agentActionAuditLog).values({ actionId, associationId, event, actor, detail });
}

/**
 * File an agent action into the queue. The level is derived from the action-type
 * (fail-closed to L3 for unknown types). For L2, the per-association auto-send
 * toggle decides whether it auto-executes now or queues for review (default:
 * queue). L1 is advisory (queued as a suggestion, never executes). L3/L4 always
 * queue for human/board approval.
 */
export async function fileAction(input: FileActionInput): Promise<FileActionResult> {
  const level = levelForActionType(input.actionType);
  const autoExecuteEnabled =
    level === "L2" ? await isToggleEnabled(input.associationId, AGENT_OWNER_FAQ_AUTOSEND_TOGGLE) : false;

  const gate = canExecute({
    level,
    autoExecuteEnabled,
    hasHumanApproval: false,
    hasBoardApproval: false,
  });
  const autoExecuted = gate.ok; // only true for L2 + toggle ON at file-time

  const [action] = await db
    .insert(agentActions)
    .values({
      associationId: input.associationId,
      actionType: input.actionType,
      level,
      status: autoExecuted ? "executed" : "queued",
      targetEntity: input.targetEntity ?? null,
      payload: input.payload,
      reasoning: input.reasoning,
      sourceData: input.sourceData ?? {},
      createdByAgent: input.createdByAgent,
      statutoryDeadline: input.statutoryDeadline ? 1 : 0,
      ...(autoExecuted ? { executedAt: new Date(), approvalKind: "auto-toggle" } : {}),
    })
    .returning();

  await appendAudit(action.id, input.associationId, "filed", input.createdByAgent, {
    level,
    requiredApproval: requiredApproval(level),
    autoExecuted,
    gateReason: gate.reason,
  });
  if (autoExecuted) {
    await appendAudit(action.id, input.associationId, "executed", input.createdByAgent, {
      via: "auto-toggle",
    });
  }

  return { action, level, autoExecuted, gateReason: gate.reason };
}

export interface ApproveActionInput {
  associationId: string;
  actionId: string;
  approverUserId: string;
  /** "human" for L1/L2/L3; "board" for L4. */
  approvalKind: "human" | "board";
}

export interface ApproveActionResult {
  action: AgentAction;
  executed: boolean;
  reason: string;
}

/**
 * Record an approval and execute if the ladder now permits it. Tenant-scoped:
 * the action must belong to associationId or it is treated as not found.
 */
export async function approveAction(input: ApproveActionInput): Promise<ApproveActionResult> {
  const [existing] = await db
    .select()
    .from(agentActions)
    .where(and(eq(agentActions.id, input.actionId), eq(agentActions.associationId, input.associationId)));

  if (!existing) {
    throw new Error("agent action not found in this association");
  }
  if (existing.status === "executed" || existing.status === "audited") {
    return { action: existing, executed: existing.status === "executed", reason: "already terminal" };
  }

  const gate = canExecute({
    level: existing.level,
    autoExecuteEnabled: false,
    hasHumanApproval: input.approvalKind === "human" || input.approvalKind === "board",
    hasBoardApproval: input.approvalKind === "board",
  });

  const now = new Date();
  const [updated] = await db
    .update(agentActions)
    .set({
      approvedByUserId: input.approverUserId,
      approvedAt: now,
      approvalKind: input.approvalKind,
      status: gate.ok ? "executed" : "approved",
      ...(gate.ok ? { executedAt: now } : {}),
      updatedAt: now,
    })
    .where(and(eq(agentActions.id, input.actionId), eq(agentActions.associationId, input.associationId)))
    .returning();

  await appendAudit(input.actionId, input.associationId, "approved", input.approverUserId, {
    approvalKind: input.approvalKind,
  });
  if (gate.ok) {
    await appendAudit(input.actionId, input.associationId, "executed", input.approverUserId, {
      reason: gate.reason,
    });
  } else {
    await appendAudit(input.actionId, input.associationId, "blocked", input.approverUserId, {
      reason: gate.reason,
    });
  }

  return { action: updated, executed: gate.ok, reason: gate.reason };
}

/** The severity-ranked queue surface for an association (statutory pinned top). */
export async function getQueue(associationId: string): Promise<AgentAction[]> {
  const rows = await db
    .select()
    .from(agentActions)
    .where(eq(agentActions.associationId, associationId))
    .orderBy(desc(agentActions.createdAt));

  // Rank a lightweight projection (carrying the original index), then return the
  // untouched AgentAction rows in ranked order — no reshaping of the DB row type.
  const ranked = rankQueue(
    rows.map((r, index) => ({
      index,
      level: r.level,
      statutoryDeadline: r.statutoryDeadline === 1,
      createdAtMs: r.createdAt.getTime(),
    })),
  );
  return ranked.map((r) => rows[r.index]);
}

/** The immutable audit trail for one action (tenant-scoped). */
export async function getAuditLog(associationId: string, actionId: string): Promise<AgentActionAuditEntry[]> {
  return db
    .select()
    .from(agentActionAuditLog)
    .where(and(eq(agentActionAuditLog.actionId, actionId), eq(agentActionAuditLog.associationId, associationId)))
    .orderBy(agentActionAuditLog.at);
}
