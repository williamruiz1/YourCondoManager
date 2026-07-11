/**
 * Architectural Review Committee (ARC) workflow service — founder-os dispatch #9481.
 *
 * The SERVER-SIDE authority for the owner architectural-change-request lifecycle:
 *
 *   intake  → routing → decision → records → appeal
 *   submitted → under-review → approved
 *                            → denied → appealed → appeal-approved
 *                                                → appeal-denied
 *
 * Ladder placement (reuses the canonical four-level permission ladder in
 * agent-action-service.ts — founder-os#9474, NOT a parallel mechanism):
 *
 *   - INTAKE + ROUTING are WORKFLOW PLUMBING → L2 (reversible). An agent may move
 *     a request through these steps.
 *   - The APPROVE/DENY DECISION (and the appeal decision) is MEMBER-AFFECTING → L4.
 *     Per the ladder, an L4 action can NEVER be actuated by an agent alone — it
 *     requires a BOARD-level HUMAN decision. This is enforced HERE, server-side:
 *     `recordArcDecision` / `recordAppealDecision` refuse any non-human actor and
 *     any non-board role, reusing `levelForActionType` + `isBoardRole` from the
 *     canonical ladder. A DENIAL is the load-bearing case (it carries appeal
 *     rights), so the L4 gate is what guarantees "the agent alone cannot deny."
 *
 * Tenant isolation: every read/write is scoped by associationId. Every mutating
 * step writes an append-only audit_logs row (entityType "arc_request").
 *
 * NET-NEW / ADDITIVE: one new table (arc_requests). Touches no money path, no
 * governance record, no existing table.
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import {
  arcRequests,
  auditLogs,
  type AdminRole,
  type ArcRequest,
  type ArcRequestStatus,
} from "@shared/schema";
import { levelForActionType, isBoardRole } from "./agent-action-service";

// ── Error taxonomy ────────────────────────────────────────────────────────────
// Routes map these to HTTP status + { error, code }.

export type ArcErrorCode =
  | "NOT_FOUND"
  | "INVALID_TRANSITION"
  | "ASSOCIATION_SCOPE"
  | "VALIDATION"
  // L4 gate — an agent (non-human actor) cannot actuate a member-affecting
  // decision. THE control the dispatch's acceptance criterion tests.
  | "AGENT_DECISION_FORBIDDEN"
  // L4 gate — a human who is not a board-level committee member cannot decide.
  | "BOARD_APPROVAL_REQUIRED";

export class ArcError extends Error {
  constructor(
    message: string,
    public readonly code: ArcErrorCode,
  ) {
    super(message);
    this.name = "ArcError";
  }
}

// ── Actor ─────────────────────────────────────────────────────────────────────
// actorType is the load-bearing L4 discriminant: "human" = a real admin/portal
// session; "agent" = an automated actor. An "agent" can perform L2 plumbing but
// can NEVER actuate an L4 decision.

export interface ArcActor {
  actorType: "human" | "agent";
  email: string;
  adminUserId?: string | null;
  /** The admin role of a human actor — used for the L4 board-role check. */
  role?: AdminRole | null;
  /** Portal person id when an owner is the actor. */
  personId?: string | null;
}

export interface SubmitArcRequestInput {
  associationId: string;
  unitId?: string | null;
  title: string;
  category?: string | null;
  description: string;
  attachments?: { name: string; url: string }[];
  /** How the submitter arrived: 'owner' (portal), 'admin' (on behalf), 'agent'. */
  submittedByType?: "owner" | "admin" | "agent";
  submittedByPersonId?: string | null;
}

// ── Ladder action-types (canonical map lives in agent-action-service.ts) ───────
const ARC_ROUTE_ACTION = "reversible.arc_route"; // L2
const ARC_DECISION_ACTION = "member.arc_decision"; // L4
const ARC_APPEAL_DECISION_ACTION = "member.arc_appeal_decision"; // L4

// ── Audit helper ────────────────────────────────────────────────────────────

async function writeAudit(params: {
  actorEmail: string;
  action: string;
  arcRequestId: string;
  associationId: string;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  await db.insert(auditLogs).values({
    actorEmail: params.actorEmail,
    action: params.action,
    entityType: "arc_request",
    entityId: params.arcRequestId,
    associationId: params.associationId,
    beforeJson: (params.before ?? null) as any,
    afterJson: (params.after ?? null) as any,
  });
}

// ── The L4 gate (reuses the canonical ladder) ──────────────────────────────────
// A committee decision (approve/deny) and an appeal decision are L4
// member-affecting actions. The ladder says an L4 action can never be actuated
// by an agent, and requires a board-level approver. We assert BOTH here so the
// invariant holds regardless of the route's own role gate (belt-and-suspenders)
// AND so it is unit-testable at the service level.
function assertBoardHumanDecision(actor: ArcActor, actionType: string, verb: string): void {
  const level = levelForActionType(actionType); // "L4"
  if (actor.actorType !== "human") {
    throw new ArcError(
      `An ${level} (member-affecting) ARC ${verb} cannot be actuated by an agent — it requires a board-level human decision.`,
      "AGENT_DECISION_FORBIDDEN",
    );
  }
  if (!isBoardRole(actor.role)) {
    throw new ArcError(
      `Recording an ARC ${verb} is an ${level} board decision — it requires a board-level role (board-officer or platform-admin).`,
      "BOARD_APPROVAL_REQUIRED",
    );
  }
}

// ── Fetch one (tenant-scoped) ──────────────────────────────────────────────────

async function fetchScoped(
  arcRequestId: string,
  associationId: string,
): Promise<ArcRequest> {
  const [row] = await db
    .select()
    .from(arcRequests)
    .where(eq(arcRequests.id, arcRequestId))
    .limit(1);

  if (!row) {
    throw new ArcError("ARC request not found", "NOT_FOUND");
  }
  if (row.associationId !== associationId) {
    // Never leak cross-tenant existence — treat as scope violation.
    throw new ArcError(
      "ARC request is outside the requested association",
      "ASSOCIATION_SCOPE",
    );
  }
  return row;
}

// ── Intake (L2) ─────────────────────────────────────────────────────────────

/** Submit a new ARC request. Intake is workflow plumbing (L2); an owner, an
 * admin-on-behalf, or an agent may file one. Starts at status "submitted". */
export async function submitArcRequest(
  input: SubmitArcRequestInput,
  submitter: ArcActor,
): Promise<ArcRequest> {
  if (!input.title?.trim()) {
    throw new ArcError("An ARC request requires a title", "VALIDATION");
  }
  if (!input.description?.trim()) {
    throw new ArcError("An ARC request requires a description", "VALIDATION");
  }

  const [inserted] = await db
    .insert(arcRequests)
    .values({
      associationId: input.associationId,
      unitId: input.unitId ?? null,
      title: input.title.trim(),
      category: input.category ?? null,
      description: input.description.trim(),
      attachments: input.attachments ?? [],
      status: "submitted",
      submittedByType: input.submittedByType ?? "owner",
      submittedByEmail: submitter.email,
      submittedByPersonId: input.submittedByPersonId ?? submitter.personId ?? null,
      submittedByAdminUserId: submitter.adminUserId ?? null,
    })
    .returning();

  await writeAudit({
    actorEmail: submitter.email,
    action: "arc.submit",
    arcRequestId: inserted.id,
    associationId: input.associationId,
    after: {
      title: inserted.title,
      status: inserted.status,
      submittedByType: inserted.submittedByType,
      attachmentCount: (inserted.attachments ?? []).length,
    },
  });

  return inserted;
}

// ── Routing to committee (L2 plumbing) ────────────────────────────────────────

/** Route a submitted request to the review committee (submitted → under-review).
 * Workflow plumbing → L2: an agent may perform this step. */
export async function routeArcRequest(
  arcRequestId: string,
  associationId: string,
  actor: ArcActor,
  committeeNote?: string | null,
): Promise<ArcRequest> {
  // Documented L2: routing is reversible plumbing (agent-actionable).
  void levelForActionType(ARC_ROUTE_ACTION);

  const row = await fetchScoped(arcRequestId, associationId);
  if (row.status !== "submitted") {
    throw new ArcError(
      `Cannot route a request in status "${row.status}" (only "submitted" can be routed to committee)`,
      "INVALID_TRANSITION",
    );
  }

  const now = new Date();
  const [updated] = await db
    .update(arcRequests)
    .set({
      status: "under-review",
      routedByAdminUserId: actor.adminUserId ?? null,
      routedByEmail: actor.email,
      routedAt: now,
      committeeNote: committeeNote ?? null,
      updatedAt: now,
    })
    .where(eq(arcRequests.id, arcRequestId))
    .returning();

  await writeAudit({
    actorEmail: actor.email,
    action: "arc.route",
    arcRequestId,
    associationId,
    before: { status: row.status },
    after: { status: updated.status },
  });
  return updated;
}

// ── Decision capture (L4 — HUMAN board decision; denial is member-affecting) ──

/**
 * Record the committee's approve/deny decision (under-review → approved | denied).
 *
 * L4 GATE: this is a member-affecting decision. An agent alone can NEVER actuate
 * it — `assertBoardHumanDecision` refuses a non-human actor (and any non-board
 * role). A DENIAL in particular carries member-appeal rights; the L4 gate is the
 * control that keeps the deny decision a human board decision.
 */
export async function recordArcDecision(
  arcRequestId: string,
  associationId: string,
  decision: "approved" | "denied",
  reason: string,
  decider: ArcActor,
): Promise<ArcRequest> {
  // THE L4 CONTROL — enforced before any state read/write.
  assertBoardHumanDecision(decider, ARC_DECISION_ACTION, decision === "denied" ? "denial" : "approval");

  if (!reason?.trim()) {
    throw new ArcError("An ARC decision requires a reason", "VALIDATION");
  }

  const row = await fetchScoped(arcRequestId, associationId);
  if (row.status !== "under-review") {
    throw new ArcError(
      `Cannot record a decision on a request in status "${row.status}" (only "under-review" can be decided)`,
      "INVALID_TRANSITION",
    );
  }

  const now = new Date();
  const [updated] = await db
    .update(arcRequests)
    .set({
      status: decision === "approved" ? "approved" : "denied",
      decidedByAdminUserId: decider.adminUserId ?? null,
      decidedByEmail: decider.email,
      decidedAt: now,
      decisionReason: reason.trim(),
      updatedAt: now,
    })
    .where(eq(arcRequests.id, arcRequestId))
    .returning();

  await writeAudit({
    actorEmail: decider.email,
    action: decision === "approved" ? "arc.approve" : "arc.deny",
    arcRequestId,
    associationId,
    before: { status: row.status },
    after: {
      status: updated.status,
      level: "L4",
      decidedByAdminUserId: decider.adminUserId ?? null,
      reason: reason.trim(),
    },
  });
  return updated;
}

// ── Appeal path ───────────────────────────────────────────────────────────────

/** An owner (or admin on behalf) appeals a DENIED request (denied → appealed).
 * Filing an appeal is workflow plumbing (L2) — anyone with the request may file
 * it; the appeal DECISION below is the L4 board decision. */
export async function appealArcDenial(
  arcRequestId: string,
  associationId: string,
  appealReason: string,
  appellant: ArcActor,
): Promise<ArcRequest> {
  if (!appealReason?.trim()) {
    throw new ArcError("An appeal requires a reason", "VALIDATION");
  }

  const row = await fetchScoped(arcRequestId, associationId);
  if (row.status !== "denied") {
    throw new ArcError(
      `Cannot appeal a request in status "${row.status}" (only a "denied" request can be appealed)`,
      "INVALID_TRANSITION",
    );
  }

  const now = new Date();
  const [updated] = await db
    .update(arcRequests)
    .set({
      status: "appealed",
      appealReason: appealReason.trim(),
      appealedByEmail: appellant.email,
      appealedAt: now,
      updatedAt: now,
    })
    .where(eq(arcRequests.id, arcRequestId))
    .returning();

  await writeAudit({
    actorEmail: appellant.email,
    action: "arc.appeal",
    arcRequestId,
    associationId,
    before: { status: row.status },
    after: { status: updated.status },
  });
  return updated;
}

/**
 * Record the committee's decision on an appeal (appealed → appeal-approved |
 * appeal-denied). Like the original decision, this is L4 — a HUMAN board
 * decision; an agent alone can never actuate it.
 */
export async function recordAppealDecision(
  arcRequestId: string,
  associationId: string,
  decision: "appeal-approved" | "appeal-denied",
  reason: string,
  decider: ArcActor,
): Promise<ArcRequest> {
  assertBoardHumanDecision(
    decider,
    ARC_APPEAL_DECISION_ACTION,
    decision === "appeal-denied" ? "appeal denial" : "appeal approval",
  );

  if (!reason?.trim()) {
    throw new ArcError("An appeal decision requires a reason", "VALIDATION");
  }

  const row = await fetchScoped(arcRequestId, associationId);
  if (row.status !== "appealed") {
    throw new ArcError(
      `Cannot record an appeal decision on a request in status "${row.status}" (only "appealed" can be decided)`,
      "INVALID_TRANSITION",
    );
  }

  const now = new Date();
  const [updated] = await db
    .update(arcRequests)
    .set({
      status: decision,
      appealDecidedByAdminUserId: decider.adminUserId ?? null,
      appealDecidedByEmail: decider.email,
      appealDecidedAt: now,
      appealDecisionReason: reason.trim(),
      updatedAt: now,
    })
    .where(eq(arcRequests.id, arcRequestId))
    .returning();

  await writeAudit({
    actorEmail: decider.email,
    action: decision === "appeal-approved" ? "arc.appeal_approve" : "arc.appeal_deny",
    arcRequestId,
    associationId,
    before: { status: row.status },
    after: { status: updated.status, level: "L4", reason: reason.trim() },
  });
  return updated;
}

// ── Records / retrieval (feeds board memory) ──────────────────────────────────

/** Retrieve one ARC request (tenant-scoped). The decision record is the board
 * memory — this is how a board reads a prior determination for a unit. */
export async function getArcRequest(
  arcRequestId: string,
  associationId: string,
): Promise<ArcRequest> {
  return fetchScoped(arcRequestId, associationId);
}

/** List an association's ARC requests, optionally filtered by status / unit. */
export async function listArcRequests(params: {
  associationId: string;
  status?: ArcRequestStatus;
  unitId?: string;
  limit?: number;
}): Promise<ArcRequest[]> {
  const limit = Math.min(Math.max(params.limit ?? 100, 1), 500);
  const clauses = [eq(arcRequests.associationId, params.associationId)];
  if (params.status) clauses.push(eq(arcRequests.status, params.status));
  if (params.unitId) clauses.push(eq(arcRequests.unitId, params.unitId));

  return db
    .select()
    .from(arcRequests)
    .where(clauses.length === 1 ? clauses[0] : and(...clauses))
    .orderBy(desc(arcRequests.createdAt))
    .limit(limit);
}
