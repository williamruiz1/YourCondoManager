/**
 * Disbursement dual-approval (maker-checker) service.
 *
 * HOA Remediation Phase 2 (artifacts/ycm/hoa-remediation-roadmap.html §Phase 2):
 * segregation of duties on disbursements — the #1 HOA embezzlement control.
 *
 * This is the SERVER-SIDE authority for the money-OUT approval gate. Every
 * business rule that matters lives here (not in the route, not in the UI):
 *
 *   1. MAKER ≠ CHECKER — the admin who created a disbursement can NEVER be the
 *      admin who approves OR rejects it. Enforced by identity comparison here,
 *      so a compromised/misbehaving UI cannot bypass it.
 *   2. STATUS TRANSITIONS — a disbursement moves draft → pending-approval →
 *      approved → paid (or → rejected). Approve/reject only act on a
 *      pending-approval request; paid only follows approved. Invalid
 *      transitions are refused.
 *   3. TENANT ISOLATION — every read/write is scoped to associationId (the
 *      route also asserts association scope; belt-and-suspenders here).
 *
 * NET-NEW, ADDITIVE, ZERO live-book exposure: creating/approving/paying a
 * disbursement posts to NO existing money path (owner ledger, GL, payout rail).
 * It is an approval-gate record that PRECEDES any real payment. "paid" records
 * the approved-payment fact only.
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { auditLogs, disbursements, type Disbursement } from "@shared/schema";

// ── Error taxonomy ────────────────────────────────────────────────────────────
// Callers (routes) map these to HTTP status + { error, code }. Keeping the
// codes here (not string-matching messages) makes the route mapping robust.

export class DisbursementError extends Error {
  constructor(
    message: string,
    public readonly code: DisbursementErrorCode,
  ) {
    super(message);
    this.name = "DisbursementError";
  }
}

export type DisbursementErrorCode =
  | "SELF_APPROVAL_FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_TRANSITION"
  | "ASSOCIATION_SCOPE";

// ── Inputs ────────────────────────────────────────────────────────────────────

export interface CreateDisbursementInput {
  associationId: string;
  vendorId?: string | null;
  vendorName: string;
  vendorInvoiceId?: string | null;
  amountCents: number;
  memo?: string | null;
  /** Whether to submit for approval immediately (status pending-approval) or
   * leave as a draft the maker can edit before submitting. */
  submitForApproval?: boolean;
}

interface Actor {
  adminUserId: string;
  email: string;
}

// ── Audit helper ──────────────────────────────────────────────────────────────

async function writeAudit(params: {
  actorEmail: string;
  action: string;
  disbursementId: string;
  associationId: string;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  await db.insert(auditLogs).values({
    actorEmail: params.actorEmail,
    action: params.action,
    entityType: "disbursement",
    entityId: params.disbursementId,
    associationId: params.associationId,
    beforeJson: (params.before ?? null) as any,
    afterJson: (params.after ?? null) as any,
  });
}

// ── Create ────────────────────────────────────────────────────────────────────

/**
 * Create a money-OUT request. The creator becomes the MAKER
 * (createdByAdminUserId) — the identity that can never approve/reject this row.
 */
export async function createDisbursement(
  input: CreateDisbursementInput,
  maker: Actor,
): Promise<Disbursement> {
  const status = input.submitForApproval ? "pending-approval" : "draft";

  const [inserted] = await db
    .insert(disbursements)
    .values({
      associationId: input.associationId,
      vendorId: input.vendorId ?? null,
      vendorName: input.vendorName,
      vendorInvoiceId: input.vendorInvoiceId ?? null,
      amountCents: input.amountCents,
      memo: input.memo ?? null,
      status,
      createdByAdminUserId: maker.adminUserId,
      createdByEmail: maker.email,
    })
    .returning();

  await writeAudit({
    actorEmail: maker.email,
    action: "disbursement.create",
    disbursementId: inserted.id,
    associationId: input.associationId,
    after: {
      amountCents: inserted.amountCents,
      vendorName: inserted.vendorName,
      status: inserted.status,
      createdByAdminUserId: inserted.createdByAdminUserId,
    },
  });

  return inserted;
}

// ── Read (fetch one, tenant-scoped) ───────────────────────────────────────────

async function fetchScoped(
  disbursementId: string,
  associationId: string,
): Promise<Disbursement> {
  const [row] = await db
    .select()
    .from(disbursements)
    .where(eq(disbursements.id, disbursementId))
    .limit(1);

  if (!row) {
    throw new DisbursementError("Disbursement not found", "NOT_FOUND");
  }
  if (row.associationId !== associationId) {
    // Never leak cross-tenant existence — treat as scope violation.
    throw new DisbursementError(
      "Disbursement is outside the requested association",
      "ASSOCIATION_SCOPE",
    );
  }
  return row;
}

// ── Submit a draft for approval ───────────────────────────────────────────────

export async function submitDisbursement(
  disbursementId: string,
  associationId: string,
  actor: Actor,
): Promise<Disbursement> {
  const row = await fetchScoped(disbursementId, associationId);
  if (row.status !== "draft") {
    throw new DisbursementError(
      `Cannot submit a disbursement in status "${row.status}" (only "draft" can be submitted)`,
      "INVALID_TRANSITION",
    );
  }
  const [updated] = await db
    .update(disbursements)
    .set({ status: "pending-approval", updatedAt: new Date() })
    .where(eq(disbursements.id, disbursementId))
    .returning();

  await writeAudit({
    actorEmail: actor.email,
    action: "disbursement.submit",
    disbursementId,
    associationId,
    before: { status: row.status },
    after: { status: updated.status },
  });
  return updated;
}

// ── Approve (maker ≠ checker) ─────────────────────────────────────────────────

/**
 * Approve a pending disbursement. The approver (CHECKER) MUST be a different
 * admin than the creator (MAKER). Enforced by identity comparison — this is the
 * segregation-of-duties control, done server-side.
 */
export async function approveDisbursement(
  disbursementId: string,
  associationId: string,
  checker: Actor,
): Promise<Disbursement> {
  const row = await fetchScoped(disbursementId, associationId);

  if (row.status !== "pending-approval") {
    throw new DisbursementError(
      `Cannot approve a disbursement in status "${row.status}" (only "pending-approval" can be approved)`,
      "INVALID_TRANSITION",
    );
  }

  // ── THE CONTROL: maker ≠ checker ──
  if (row.createdByAdminUserId === checker.adminUserId) {
    throw new DisbursementError(
      "You cannot approve a disbursement you created. A different authorized admin must approve it (segregation of duties).",
      "SELF_APPROVAL_FORBIDDEN",
    );
  }

  const now = new Date();
  const [updated] = await db
    .update(disbursements)
    .set({
      status: "approved",
      approvedByAdminUserId: checker.adminUserId,
      approvedByEmail: checker.email,
      approvedAt: now,
      updatedAt: now,
    })
    .where(eq(disbursements.id, disbursementId))
    .returning();

  await writeAudit({
    actorEmail: checker.email,
    action: "disbursement.approve",
    disbursementId,
    associationId,
    before: { status: row.status },
    after: {
      status: updated.status,
      approvedByAdminUserId: checker.adminUserId,
      createdByAdminUserId: row.createdByAdminUserId,
    },
  });
  return updated;
}

// ── Reject (maker ≠ checker) ──────────────────────────────────────────────────

/**
 * Reject a pending disbursement. Like approval, the rejecter must be a
 * different admin than the creator (the creator cannot self-clear their own
 * request by rejecting-and-recreating without a second party in the loop).
 */
export async function rejectDisbursement(
  disbursementId: string,
  associationId: string,
  checker: Actor,
  reason?: string | null,
): Promise<Disbursement> {
  const row = await fetchScoped(disbursementId, associationId);

  if (row.status !== "pending-approval") {
    throw new DisbursementError(
      `Cannot reject a disbursement in status "${row.status}" (only "pending-approval" can be rejected)`,
      "INVALID_TRANSITION",
    );
  }

  if (row.createdByAdminUserId === checker.adminUserId) {
    throw new DisbursementError(
      "You cannot reject a disbursement you created. A different authorized admin must review it (segregation of duties).",
      "SELF_APPROVAL_FORBIDDEN",
    );
  }

  const now = new Date();
  const [updated] = await db
    .update(disbursements)
    .set({
      status: "rejected",
      rejectedByAdminUserId: checker.adminUserId,
      rejectedByEmail: checker.email,
      rejectedAt: now,
      rejectionReason: reason ?? null,
      updatedAt: now,
    })
    .where(eq(disbursements.id, disbursementId))
    .returning();

  await writeAudit({
    actorEmail: checker.email,
    action: "disbursement.reject",
    disbursementId,
    associationId,
    before: { status: row.status },
    after: {
      status: updated.status,
      rejectedByAdminUserId: checker.adminUserId,
      reason: reason ?? null,
    },
  });
  return updated;
}

// ── Mark paid (approved → paid) ───────────────────────────────────────────────

/**
 * Mark an approved disbursement as paid. Records the approved-payment fact;
 * wires to no live payout rail in this phase. Only an "approved" disbursement
 * may be paid — an unapproved money-OUT can never reach "paid".
 */
export async function markDisbursementPaid(
  disbursementId: string,
  associationId: string,
  actor: Actor,
): Promise<Disbursement> {
  const row = await fetchScoped(disbursementId, associationId);

  if (row.status !== "approved") {
    throw new DisbursementError(
      `Cannot mark a disbursement paid from status "${row.status}" (only "approved" can be paid)`,
      "INVALID_TRANSITION",
    );
  }

  const now = new Date();
  const [updated] = await db
    .update(disbursements)
    .set({ status: "paid", paidAt: now, updatedAt: now })
    .where(eq(disbursements.id, disbursementId))
    .returning();

  await writeAudit({
    actorEmail: actor.email,
    action: "disbursement.paid",
    disbursementId,
    associationId,
    before: { status: row.status },
    after: { status: updated.status, paidAt: now.toISOString() },
  });
  return updated;
}

// ── List (tenant-scoped, optionally filtered by status) ───────────────────────

export async function listDisbursements(params: {
  associationId: string;
  status?: Disbursement["status"];
  limit?: number;
}): Promise<Disbursement[]> {
  const limit = Math.min(Math.max(params.limit ?? 100, 1), 500);
  const where = params.status
    ? and(
        eq(disbursements.associationId, params.associationId),
        eq(disbursements.status, params.status),
      )
    : eq(disbursements.associationId, params.associationId);

  return db
    .select()
    .from(disbursements)
    .where(where)
    .orderBy(desc(disbursements.createdAt))
    .limit(limit);
}
