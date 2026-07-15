/**
 * Violations MANAGEMENT routes (founder-os#10569, YCM Redesign M8).
 *
 * Builds the MISSING management surface (list · filter · detail · status
 * timeline · notice history) over the pre-existing `violations` table + CRUD
 * (GET/POST/PATCH /api/violations, founder-os#9487, unchanged/untouched by
 * this file) — per the signed-off wireframe's own build note: "This
 * wireframe is the missing management surface... that ties them together."
 * Wireframe: artifacts/ycm-redesign-m8-violations/ycm-redesign-m8-violations-wireframe.html
 *
 * Feature-gated behind VIOLATIONS_MANAGEMENT_ENABLED (default OFF) until
 * William signs off — per the wireframe's "needs William signoff before
 * build" stamp. Gated routes return 404 (not 403) when the flag is off, so a
 * disabled feature is indistinguishable from a route that doesn't exist yet
 * (mirrors the GL_ENABLED-gated financial-statement routes' convention).
 *
 * Does NOT touch the pre-existing GET/POST/PATCH /api/violations, the
 * board-mode Log-Violation wizard, or fine/ledger posting — those already
 * ship unconditionally and are out of scope here (money-safety: this module
 * is display + status-transition only, per the wireframe's own note).
 */
import type { Express, NextFunction, Request, Response } from "express";
import { z } from "zod";
import { type AdminRole } from "@shared/schema";
import { getFeatureFlagForAssociation } from "@shared/feature-flags";
import {
  ViolationsManagementError,
  getViolationDetail,
  listViolationsForManagement,
  sendViolationNotice,
  transitionViolationStatus,
} from "../services/violations-management-service";

type AdminRequest = Request & {
  adminUserId?: string;
  adminUserEmail?: string;
  adminRole?: AdminRole;
  adminScopedAssociationIds?: string[];
};

// Mirrors the `getParam` helper in server/routes.ts — route params can be
// typed `string | string[]` (repeated path segments); normalize to a plain
// string the same way the rest of the codebase does.
function getParam(value: string | string[] | undefined): string {
  if (!value) return "";
  return Array.isArray(value) ? value[0] : value;
}

interface ViolationsManagementGuards {
  requireAdmin: (req: Request, res: Response, next: NextFunction) => unknown;
  requireAdminRole: (roles: AdminRole[]) => (req: Request, res: Response, next: NextFunction) => unknown;
  getAssociationIdQuery: (req: Request) => string | undefined;
}

// Same read/write role split the pre-existing GET/POST/PATCH /api/violations uses.
const READ_ROLES: AdminRole[] = ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"];
const WRITE_ROLES: AdminRole[] = ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager"];

const noticeSchema = z.object({
  channel: z.enum(["email", "portal", "certified-mail"]).optional(),
  note: z.string().trim().max(2000).optional().nullable(),
});

const statusSchema = z.object({
  status: z.enum(["open", "notice-sent", "cured", "escalated", "closed"]),
  note: z.string().trim().max(2000).optional().nullable(),
});

function sendError(res: Response, error: unknown): Response {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: "Invalid input", code: "INVALID_INPUT", issues: error.issues });
  }
  if (error instanceof ViolationsManagementError) {
    return res.status(error.httpStatus).json({ error: error.message, code: error.code });
  }
  const message = error instanceof Error ? error.message : String(error);
  return res.status(400).json({ error: message, code: "VIOLATIONS_MANAGEMENT_ERROR" });
}

export function registerViolationsManagementRoutes(app: Express, guards: ViolationsManagementGuards): void {
  const { requireAdmin, requireAdminRole, getAssociationIdQuery } = guards;

  // Returns true (and lets the caller proceed) when the flag is ON for this
  // association; otherwise writes a 404 and returns false. Callers MUST
  // `return` immediately when this returns false.
  function requireFlag(res: Response, associationId: string): boolean {
    if (getFeatureFlagForAssociation("VIOLATIONS_MANAGEMENT_ENABLED", associationId)) return true;
    res.status(404).json({ error: "Not found", code: "NOT_FOUND" });
    return false;
  }

  app.get(
    "/api/violations/management",
    requireAdmin,
    requireAdminRole(READ_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const associationId = getAssociationIdQuery(req);
        if (!associationId) {
          return res.json({ violations: [], stats: { open: 0, openOver30Days: 0, noticeSent: 0, escalated: 0, curedLast30Days: 0 } });
        }
        if (!requireFlag(res, associationId)) return;
        const result = await listViolationsForManagement(associationId);
        res.json(result);
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  app.get(
    "/api/violations/management/:id",
    requireAdmin,
    requireAdminRole(READ_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const associationId = getAssociationIdQuery(req);
        if (!associationId) throw new ViolationsManagementError("associationId is required", "ASSOCIATION_REQUIRED", 400);
        if (!requireFlag(res, associationId)) return;
        const result = await getViolationDetail(getParam(req.params.id), associationId);
        res.json(result);
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  app.post(
    "/api/violations/management/:id/notices",
    requireAdmin,
    requireAdminRole(WRITE_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const associationId = getAssociationIdQuery(req);
        if (!associationId) throw new ViolationsManagementError("associationId is required", "ASSOCIATION_REQUIRED", 400);
        if (!requireFlag(res, associationId)) return;
        const parsed = noticeSchema.parse(req.body ?? {});
        const result = await sendViolationNotice(getParam(req.params.id), associationId, parsed, req.adminUserEmail ?? "system");
        res.status(201).json(result);
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  app.post(
    "/api/violations/management/:id/status",
    requireAdmin,
    requireAdminRole(WRITE_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const associationId = getAssociationIdQuery(req);
        if (!associationId) throw new ViolationsManagementError("associationId is required", "ASSOCIATION_REQUIRED", 400);
        if (!requireFlag(res, associationId)) return;
        const parsed = statusSchema.parse(req.body);
        const result = await transitionViolationStatus(
          getParam(req.params.id),
          associationId,
          parsed.status,
          parsed.note,
          req.adminUserEmail ?? "system",
        );
        res.json(result);
      } catch (error) {
        sendError(res, error);
      }
    },
  );
}
