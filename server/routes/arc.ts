/**
 * Architectural Review Committee (ARC) workflow routes — founder-os dispatch #9481.
 *
 * Owner architectural-change-request lifecycle: intake → committee routing →
 * decision capture → records → appeal path.
 *
 * Two surfaces:
 *   Admin / committee (requireAdmin):
 *     POST /api/admin/arc/requests                 intake (admin on behalf)
 *     GET  /api/admin/arc/requests                 list (tenant-scoped; ?status=&unitId=)
 *     GET  /api/admin/arc/requests/:id             retrieve one (board memory)
 *     POST /api/admin/arc/requests/:id/route       submitted → under-review (L2)
 *     POST /api/admin/arc/requests/:id/decision    approve/deny (L4 board decision)
 *     POST /api/admin/arc/requests/:id/appeal      record an appeal on behalf (L2)
 *     POST /api/admin/arc/requests/:id/appeal-decision  appeal decision (L4)
 *   Owner portal (requirePortal — identity from session, never from body):
 *     POST /api/portal/arc/requests                owner submits
 *     GET  /api/portal/arc/requests                owner lists their OWN requests
 *     POST /api/portal/arc/requests/:id/appeal     owner appeals their OWN denial
 *
 * Authorization:
 *   - The COMMITTEE DECISION (approve/deny + appeal decision) is gated to the
 *     BOARD SEATS (platform-admin, board-officer) — the L4 board-level roles. The
 *     service ALSO enforces the L4 gate (human + board role) so an agent alone can
 *     never actuate a denial, independent of the route.
 *   - Routing is L2 plumbing (wider operator write roles).
 *   - READ is widest (any operator persona) so PMs / viewers can audit.
 */
import type { Express, NextFunction, Request, Response } from "express";
import { z } from "zod";
import { type AdminRole } from "@shared/schema";
import {
  appealArcDenial,
  ArcError,
  getArcRequest,
  listArcRequests,
  recordAppealDecision,
  recordArcDecision,
  routeArcRequest,
  submitArcRequest,
} from "../services/arc-service";

// ── Reusable request shapes ─────────────────────────────────────────────────

export type AdminRequest = Request & {
  adminUserId?: string;
  adminUserEmail?: string;
  adminRole?: AdminRole;
  adminScopedAssociationIds?: string[];
};

type PortalRequest = Request & {
  portalAccessId?: string;
  portalAssociationId?: string;
  portalPersonId?: string;
  portalUnitId?: string | null;
  portalEmail?: string;
};

interface ArcGuards {
  requireAdmin: (req: Request, res: Response, next: NextFunction) => unknown;
  requireAdminRole: (
    roles: AdminRole[],
  ) => (req: Request, res: Response, next: NextFunction) => unknown;
  requirePortal: (req: Request, res: Response, next: NextFunction) => unknown;
  getAssociationIdQuery: (req: Request) => string | undefined;
  assertAssociationScope: (req: AdminRequest, associationId: string) => void;
}

// ── Role sets ────────────────────────────────────────────────────────────────

// The COMMITTEE — the board seats that may record an approve/deny (L4). Aligned
// with the ladder's BOARD_APPROVAL_ROLES so the route gate + the service gate
// agree.
const COMMITTEE_DECISION_ROLES: AdminRole[] = ["platform-admin", "board-officer"];
// Intake / routing / appeal-filing — L2 plumbing. Any operator who writes (not
// the strictly view-only `viewer`).
const ARC_WRITE_ROLES: AdminRole[] = [
  "platform-admin",
  "board-officer",
  "manager",
  "pm-assistant",
  "assisted-board",
];
// READ wider than write so PMs / viewers can audit the review log.
const ARC_READ_ROLES: AdminRole[] = [
  "platform-admin",
  "board-officer",
  "assisted-board",
  "pm-assistant",
  "manager",
  "viewer",
];

// ── Schemas ────────────────────────────────────────────────────────────────

const attachmentSchema = z.object({
  name: z.string().trim().min(1),
  url: z.string().trim().min(1),
});

const submitAdminSchema = z.object({
  associationId: z.string().min(1),
  unitId: z.string().min(1).optional().nullable(),
  title: z.string().trim().min(1),
  category: z.string().trim().optional().nullable(),
  description: z.string().trim().min(1),
  attachments: z.array(attachmentSchema).optional(),
});

const submitPortalSchema = z.object({
  // associationId + personId + unitId come from the portal session, NEVER body.
  unitId: z.string().min(1).optional().nullable(),
  title: z.string().trim().min(1),
  category: z.string().trim().optional().nullable(),
  description: z.string().trim().min(1),
  attachments: z.array(attachmentSchema).optional(),
});

const routeSchema = z.object({
  associationId: z.string().min(1),
  committeeNote: z.string().trim().max(2000).optional().nullable(),
});

const decisionSchema = z.object({
  associationId: z.string().min(1),
  decision: z.enum(["approved", "denied"]),
  reason: z.string().trim().min(1).max(4000),
});

const appealAdminSchema = z.object({
  associationId: z.string().min(1),
  reason: z.string().trim().min(1).max(4000),
});

const appealPortalSchema = z.object({
  reason: z.string().trim().min(1).max(4000),
});

const appealDecisionSchema = z.object({
  associationId: z.string().min(1),
  decision: z.enum(["appeal-approved", "appeal-denied"]),
  reason: z.string().trim().min(1).max(4000),
});

const ARC_STATUSES = [
  "submitted",
  "under-review",
  "approved",
  "denied",
  "appealed",
  "appeal-approved",
  "appeal-denied",
] as const;

// ── Error → HTTP mapping ──────────────────────────────────────────────────────

function sendArcError(res: Response, error: unknown): Response {
  if (error instanceof z.ZodError) {
    return res
      .status(400)
      .json({ error: "Invalid input", code: "INVALID_INPUT", issues: error.issues });
  }
  if (error instanceof ArcError) {
    const status =
      error.code === "NOT_FOUND"
        ? 404
        : error.code === "AGENT_DECISION_FORBIDDEN" ||
            error.code === "BOARD_APPROVAL_REQUIRED" ||
            error.code === "ASSOCIATION_SCOPE"
          ? 403
          : error.code === "VALIDATION"
            ? 400
            : 409; // INVALID_TRANSITION → conflict
    return res.status(status).json({ error: error.message, code: error.code });
  }
  const message = error instanceof Error ? error.message : String(error);
  return res.status(400).json({ error: message, code: "ARC_ERROR" });
}

function adminActor(req: AdminRequest) {
  return {
    actorType: "human" as const,
    adminUserId: req.adminUserId,
    email: req.adminUserEmail ?? "unknown",
    role: req.adminRole,
  };
}

// ── Registrar ─────────────────────────────────────────────────────────────

export function registerArcRoutes(app: Express, guards: ArcGuards): void {
  const {
    requireAdmin,
    requireAdminRole,
    requirePortal,
    getAssociationIdQuery,
    assertAssociationScope,
  } = guards;

  // ── Admin intake (on behalf of an owner) ──
  app.post(
    "/api/admin/arc/requests",
    requireAdmin,
    requireAdminRole(ARC_WRITE_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const parsed = submitAdminSchema.parse(req.body);
        assertAssociationScope(req, parsed.associationId);
        const created = await submitArcRequest(
          {
            associationId: parsed.associationId,
            unitId: parsed.unitId ?? null,
            title: parsed.title,
            category: parsed.category ?? null,
            description: parsed.description,
            attachments: parsed.attachments ?? [],
            submittedByType: "admin",
          },
          adminActor(req),
        );
        return res.status(201).json({ request: created });
      } catch (error) {
        return sendArcError(res, error);
      }
    },
  );

  // ── Admin list (tenant-scoped) ──
  app.get(
    "/api/admin/arc/requests",
    requireAdmin,
    requireAdminRole(ARC_READ_ROLES),
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
          typeof req.query.status === "string" &&
          (ARC_STATUSES as readonly string[]).includes(req.query.status)
            ? (req.query.status as (typeof ARC_STATUSES)[number])
            : undefined;
        const unitId = typeof req.query.unitId === "string" ? req.query.unitId : undefined;
        const limitParam =
          typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
        const rows = await listArcRequests({
          associationId,
          status: statusParam,
          unitId,
          limit: Number.isFinite(limitParam) ? limitParam : undefined,
        });
        return res.json({ requests: rows });
      } catch (error) {
        return sendArcError(res, error);
      }
    },
  );

  // ── Admin retrieve one (board memory) ──
  app.get(
    "/api/admin/arc/requests/:id",
    requireAdmin,
    requireAdminRole(ARC_READ_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const associationId = getAssociationIdQuery(req);
        if (!associationId) {
          return res
            .status(400)
            .json({ error: "associationId query param is required", code: "INVALID_INPUT" });
        }
        assertAssociationScope(req, associationId);
        const row = await getArcRequest(req.params.id as string, associationId);
        return res.json({ request: row });
      } catch (error) {
        return sendArcError(res, error);
      }
    },
  );

  // ── Admin route to committee (L2) ──
  app.post(
    "/api/admin/arc/requests/:id/route",
    requireAdmin,
    requireAdminRole(ARC_WRITE_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const parsed = routeSchema.parse(req.body);
        assertAssociationScope(req, parsed.associationId);
        const updated = await routeArcRequest(
          req.params.id as string,
          parsed.associationId,
          adminActor(req),
          parsed.committeeNote,
        );
        return res.json({ request: updated });
      } catch (error) {
        return sendArcError(res, error);
      }
    },
  );

  // ── Admin decision (L4 — board seats only; service re-enforces the L4 gate) ──
  app.post(
    "/api/admin/arc/requests/:id/decision",
    requireAdmin,
    requireAdminRole(COMMITTEE_DECISION_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const parsed = decisionSchema.parse(req.body);
        assertAssociationScope(req, parsed.associationId);
        const updated = await recordArcDecision(
          req.params.id as string,
          parsed.associationId,
          parsed.decision,
          parsed.reason,
          adminActor(req),
        );
        return res.json({ request: updated });
      } catch (error) {
        return sendArcError(res, error);
      }
    },
  );

  // ── Admin record an appeal on behalf (L2) ──
  app.post(
    "/api/admin/arc/requests/:id/appeal",
    requireAdmin,
    requireAdminRole(ARC_WRITE_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const parsed = appealAdminSchema.parse(req.body);
        assertAssociationScope(req, parsed.associationId);
        const updated = await appealArcDenial(
          req.params.id as string,
          parsed.associationId,
          parsed.reason,
          adminActor(req),
        );
        return res.json({ request: updated });
      } catch (error) {
        return sendArcError(res, error);
      }
    },
  );

  // ── Admin appeal decision (L4) ──
  app.post(
    "/api/admin/arc/requests/:id/appeal-decision",
    requireAdmin,
    requireAdminRole(COMMITTEE_DECISION_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const parsed = appealDecisionSchema.parse(req.body);
        assertAssociationScope(req, parsed.associationId);
        const updated = await recordAppealDecision(
          req.params.id as string,
          parsed.associationId,
          parsed.decision,
          parsed.reason,
          adminActor(req),
        );
        return res.json({ request: updated });
      } catch (error) {
        return sendArcError(res, error);
      }
    },
  );

  // ── Portal: owner submits their OWN request ──
  app.post(
    "/api/portal/arc/requests",
    requirePortal,
    async (req: PortalRequest, res: Response) => {
      try {
        if (!req.portalAssociationId || !req.portalPersonId) {
          return res.status(403).json({ error: "Portal session required", code: "PORTAL_REQUIRED" });
        }
        const parsed = submitPortalSchema.parse(req.body);
        const created = await submitArcRequest(
          {
            associationId: req.portalAssociationId,
            // The owner's own unit from the session unless the request names one.
            unitId: parsed.unitId ?? req.portalUnitId ?? null,
            title: parsed.title,
            category: parsed.category ?? null,
            description: parsed.description,
            attachments: parsed.attachments ?? [],
            submittedByType: "owner",
            submittedByPersonId: req.portalPersonId,
          },
          {
            actorType: "human",
            email: req.portalEmail ?? "owner",
            personId: req.portalPersonId,
          },
        );
        return res.status(201).json({ request: created });
      } catch (error) {
        return sendArcError(res, error);
      }
    },
  );

  // ── Portal: owner lists their OWN requests ──
  app.get(
    "/api/portal/arc/requests",
    requirePortal,
    async (req: PortalRequest, res: Response) => {
      try {
        if (!req.portalAssociationId || !req.portalPersonId) {
          return res.status(403).json({ error: "Portal session required", code: "PORTAL_REQUIRED" });
        }
        const rows = await listArcRequests({ associationId: req.portalAssociationId });
        // Owner-scope: only the requests this person submitted.
        const own = rows.filter((r) => r.submittedByPersonId === req.portalPersonId);
        return res.json({ requests: own });
      } catch (error) {
        return sendArcError(res, error);
      }
    },
  );

  // ── Portal: owner appeals their OWN denied request ──
  app.post(
    "/api/portal/arc/requests/:id/appeal",
    requirePortal,
    async (req: PortalRequest, res: Response) => {
      try {
        if (!req.portalAssociationId || !req.portalPersonId) {
          return res.status(403).json({ error: "Portal session required", code: "PORTAL_REQUIRED" });
        }
        // Confirm ownership before mutating — an owner can only appeal a request
        // they filed (tenant + person scoped).
        const existing = await getArcRequest(req.params.id as string, req.portalAssociationId);
        if (existing.submittedByPersonId !== req.portalPersonId) {
          return res
            .status(403)
            .json({ error: "This request is not yours to appeal", code: "NOT_OWNER" });
        }
        const parsed = appealPortalSchema.parse(req.body);
        const updated = await appealArcDenial(
          req.params.id as string,
          req.portalAssociationId,
          parsed.reason,
          { actorType: "human", email: req.portalEmail ?? "owner", personId: req.portalPersonId },
        );
        return res.json({ request: updated });
      } catch (error) {
        return sendArcError(res, error);
      }
    },
  );
}
