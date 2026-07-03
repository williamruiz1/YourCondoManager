/**
 * Admin disbursement dual-approval (maker-checker) routes.
 *
 * HOA Remediation Phase 2 (artifacts/ycm/hoa-remediation-roadmap.html §Phase 2):
 * segregation of duties on money-OUT — the #1 HOA embezzlement control. A
 * disbursement is a money-OUT request (payment to a vendor / vendor invoice)
 * that MUST be approved by a DIFFERENT admin than the one who created it
 * (maker ≠ checker) before it can be marked payable / paid.
 *
 * Endpoints
 *   POST /api/admin/disbursements            create a request (maker)
 *   GET  /api/admin/disbursements            list (tenant-scoped; ?status=)
 *   POST /api/admin/disbursements/:id/submit draft → pending-approval (maker)
 *   POST /api/admin/disbursements/:id/approve pending → approved (CHECKER, ≠ maker)
 *   POST /api/admin/disbursements/:id/reject  pending → rejected  (CHECKER, ≠ maker)
 *   POST /api/admin/disbursements/:id/pay     approved → paid
 *
 * Authorization: money-OUT WRITE (create/submit/approve/reject/pay) is gated to
 * board-officer / treasurer-equivalent / manager / platform-admin. There is no
 * `treasurer` AdminRole in this codebase (the canonical enum is platform-admin /
 * board-officer / assisted-board / pm-assistant / manager / viewer per
 * shared/schema.ts L169) — board-officer is the treasurer-equivalent for boards.
 * READ is wider (any operator persona) so PMs / viewers can audit.
 *
 * The maker ≠ checker rule is enforced SERVER-SIDE in
 * server/services/disbursement-service.ts (not the UI): the creator's
 * adminUserId can never equal the approver/rejecter's adminUserId.
 *
 * NET-NEW / ADDITIVE: touches no existing money path (owner ledger / GL / payout
 * rail). "paid" records the approved-payment fact only.
 */
import type { Express, NextFunction, Request, Response } from "express";
import { z } from "zod";
import { type AdminRole } from "@shared/schema";
import {
  approveDisbursement,
  createDisbursement,
  DisbursementError,
  listDisbursements,
  markDisbursementPaid,
  rejectDisbursement,
  submitDisbursement,
} from "../services/disbursement-service";

// ── Reusable request shape (mirrored from admin-payments.ts) ─────────────────

export type AdminRequest = Request & {
  adminUserId?: string;
  adminUserEmail?: string;
  adminRole?: AdminRole;
  adminScopedAssociationIds?: string[];
};

interface AdminGuards {
  requireAdmin: (req: Request, res: Response, next: NextFunction) => unknown;
  requireAdminRole: (
    roles: AdminRole[],
  ) => (req: Request, res: Response, next: NextFunction) => unknown;
  getAssociationIdQuery: (req: Request) => string | undefined;
  assertAssociationScope: (req: AdminRequest, associationId: string) => void;
}

// Money-OUT WRITE roles — segregation of duties operates WITHIN this set: any
// two DIFFERENT members can be maker + checker. board-officer is the
// treasurer-equivalent. `viewer`, `assisted-board`, `pm-assistant` are excluded
// from writing money out (they can still read the queue).
const DISBURSEMENT_WRITE_ROLES: AdminRole[] = [
  "platform-admin",
  "board-officer",
  "manager",
];
// Read wider than write so PMs / viewers can audit the approval queue.
const DISBURSEMENT_READ_ROLES: AdminRole[] = [
  "platform-admin",
  "board-officer",
  "assisted-board",
  "pm-assistant",
  "manager",
  "viewer",
];

// ── Schemas ───────────────────────────────────────────────────────────────────

const createSchema = z.object({
  associationId: z.string().min(1),
  vendorId: z.string().min(1).optional().nullable(),
  vendorName: z.string().trim().min(1),
  vendorInvoiceId: z.string().min(1).optional().nullable(),
  // Accept dollars OR cents at the boundary? Keep it explicit: amountCents is
  // the wire contract (integer cents), so money math is never a float.
  amountCents: z.coerce.number().int().refine((n) => n > 0, {
    message: "amountCents must be a positive integer (money OUT is always > 0)",
  }),
  memo: z.string().trim().optional().nullable(),
  submitForApproval: z.boolean().optional().default(true),
});

const rejectSchema = z.object({
  associationId: z.string().min(1),
  reason: z.string().trim().max(1000).optional().nullable(),
});

const associationBodySchema = z.object({
  associationId: z.string().min(1),
});

// ── Error → HTTP mapping ──────────────────────────────────────────────────────

function sendDisbursementError(res: Response, error: unknown): Response {
  if (error instanceof z.ZodError) {
    return res
      .status(400)
      .json({ error: "Invalid input", code: "INVALID_INPUT", issues: error.issues });
  }
  if (error instanceof DisbursementError) {
    const status =
      error.code === "NOT_FOUND"
        ? 404
        : error.code === "SELF_APPROVAL_FORBIDDEN"
          ? 403
          : error.code === "ASSOCIATION_SCOPE"
            ? 403
            : 409; // INVALID_TRANSITION → conflict
    return res.status(status).json({ error: error.message, code: error.code });
  }
  const message = error instanceof Error ? error.message : String(error);
  return res.status(400).json({ error: message, code: "DISBURSEMENT_ERROR" });
}

function actorFrom(req: AdminRequest): { adminUserId: string; email: string } {
  // requireAdmin has already hydrated the session; adminUserId is present.
  // Fail loud if not (a route reaching here without it is a middleware bug).
  if (!req.adminUserId) {
    throw new DisbursementError(
      "No authenticated admin identity on request",
      "ASSOCIATION_SCOPE",
    );
  }
  return { adminUserId: req.adminUserId, email: req.adminUserEmail ?? "unknown" };
}

// ── Registrar ───────────────────────────────────────────────────────────────

export function registerAdminDisbursementRoutes(
  app: Express,
  guards: AdminGuards,
): void {
  const { requireAdmin, requireAdminRole, getAssociationIdQuery, assertAssociationScope } =
    guards;

  // POST /api/admin/disbursements — create a money-OUT request (maker).
  app.post(
    "/api/admin/disbursements",
    requireAdmin,
    requireAdminRole(DISBURSEMENT_WRITE_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const parsed = createSchema.parse(req.body);
        assertAssociationScope(req, parsed.associationId);
        const created = await createDisbursement(parsed, actorFrom(req));
        return res.status(201).json({ disbursement: created });
      } catch (error) {
        return sendDisbursementError(res, error);
      }
    },
  );

  // GET /api/admin/disbursements?associationId=&status=&limit= — tenant-scoped list.
  app.get(
    "/api/admin/disbursements",
    requireAdmin,
    requireAdminRole(DISBURSEMENT_READ_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const associationId = getAssociationIdQuery(req);
        if (!associationId) {
          return res
            .status(400)
            .json({ error: "associationId query param is required", code: "INVALID_INPUT" });
        }
        assertAssociationScope(req, associationId);
        const statusParam =
          typeof req.query.status === "string" ? req.query.status : undefined;
        const limitParam =
          typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
        const rows = await listDisbursements({
          associationId,
          status: statusParam as any,
          limit: Number.isFinite(limitParam) ? limitParam : undefined,
        });
        return res.json({ disbursements: rows });
      } catch (error) {
        return sendDisbursementError(res, error);
      }
    },
  );

  // POST /api/admin/disbursements/:id/submit — draft → pending-approval.
  app.post(
    "/api/admin/disbursements/:id/submit",
    requireAdmin,
    requireAdminRole(DISBURSEMENT_WRITE_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const { associationId } = associationBodySchema.parse(req.body);
        assertAssociationScope(req, associationId);
        const updated = await submitDisbursement(
          req.params.id as string,
          associationId,
          actorFrom(req),
        );
        return res.json({ disbursement: updated });
      } catch (error) {
        return sendDisbursementError(res, error);
      }
    },
  );

  // POST /api/admin/disbursements/:id/approve — pending → approved (CHECKER ≠ maker).
  app.post(
    "/api/admin/disbursements/:id/approve",
    requireAdmin,
    requireAdminRole(DISBURSEMENT_WRITE_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const { associationId } = associationBodySchema.parse(req.body);
        assertAssociationScope(req, associationId);
        const updated = await approveDisbursement(
          req.params.id as string,
          associationId,
          actorFrom(req),
        );
        return res.json({ disbursement: updated });
      } catch (error) {
        return sendDisbursementError(res, error);
      }
    },
  );

  // POST /api/admin/disbursements/:id/reject — pending → rejected (CHECKER ≠ maker).
  app.post(
    "/api/admin/disbursements/:id/reject",
    requireAdmin,
    requireAdminRole(DISBURSEMENT_WRITE_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const parsed = rejectSchema.parse(req.body);
        assertAssociationScope(req, parsed.associationId);
        const updated = await rejectDisbursement(
          req.params.id as string,
          parsed.associationId,
          actorFrom(req),
          parsed.reason,
        );
        return res.json({ disbursement: updated });
      } catch (error) {
        return sendDisbursementError(res, error);
      }
    },
  );

  // POST /api/admin/disbursements/:id/pay — approved → paid.
  app.post(
    "/api/admin/disbursements/:id/pay",
    requireAdmin,
    requireAdminRole(DISBURSEMENT_WRITE_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const { associationId } = associationBodySchema.parse(req.body);
        assertAssociationScope(req, associationId);
        const updated = await markDisbursementPaid(
          req.params.id as string,
          associationId,
          actorFrom(req),
        );
        return res.json({ disbursement: updated });
      } catch (error) {
        return sendDisbursementError(res, error);
      }
    },
  );
}
