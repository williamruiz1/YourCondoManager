/**
 * YCM Chief-of-Staff agent-action routes (founder-os#9474, W1 foundation).
 *
 *   POST /api/agent/actions              — agent files an action (level assigned
 *                                          server-side from the action-type).
 *   POST /api/agent/actions/:id/approve  — a human approves (L4 → board role).
 *   POST /api/agent/actions/:id/reject   — a human rejects.
 *   POST /api/agent/actions/:id/execute  — run the permission gate + actuate the
 *                                          executed fact (writes the audit entry).
 *   GET  /api/agent/queue                — the surface: severity-ranked, statutory-pinned.
 *   GET  /api/agent/actions/:id/audit    — the immutable audit trail (one click from queue).
 *
 * Isolation: every read/write is scoped by associationId asserted against the
 * authenticated session (`assertAssociationScope`), never trusted from the body
 * alone. The permission ladder (level → required approval) is enforced in the
 * service; L4 board-role approval is enforced from `req.adminRole`.
 */
import type { Express, NextFunction, Request, Response } from "express";
import { z } from "zod";
import { type AdminRole } from "@shared/schema";
import {
  fileAction,
  approveAction,
  rejectAction,
  executeAction,
  listQueue,
  getAuditLog,
  AgentActionError,
} from "../services/agent-action-service";

export type AdminRequest = Request & {
  adminUserId?: string;
  adminUserEmail?: string;
  adminRole?: AdminRole;
  adminScopedAssociationIds?: string[];
};

interface AgentActionGuards {
  requireAdmin: (req: Request, res: Response, next: NextFunction) => unknown;
  requireAdminRole: (roles: AdminRole[]) => (req: Request, res: Response, next: NextFunction) => unknown;
  getAssociationIdQuery: (req: Request) => string | undefined;
  assertAssociationScope: (req: AdminRequest, associationId: string) => void;
}

// Who may FILE / EXECUTE / APPROVE actions. board-officer is the board seat that
// can approve L4; platform-admin is super. manager/pm-assistant can operate the
// queue for L1-L3 but the L4 board-role gate lives in the service.
const AGENT_ACTION_WRITE_ROLES: AdminRole[] = ["platform-admin", "board-officer", "manager", "pm-assistant"];
// Reading the queue + audit is wider so viewers can audit.
const AGENT_ACTION_READ_ROLES: AdminRole[] = ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"];

const fileSchema = z.object({
  associationId: z.string().min(1),
  actionType: z.string().trim().min(1),
  reasoning: z.string().trim().min(1),
  createdByAgent: z.string().trim().min(1),
  targetEntityType: z.string().trim().optional().nullable(),
  targetEntityId: z.string().trim().optional().nullable(),
  payload: z.unknown().optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  statutoryDeadline: z.coerce.date().optional().nullable(),
});

const associationBodySchema = z.object({ associationId: z.string().min(1) });
const rejectSchema = z.object({ associationId: z.string().min(1), reason: z.string().trim().max(1000).optional().nullable() });

function sendError(res: Response, error: unknown): Response {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: "Invalid input", code: "INVALID_INPUT", issues: error.issues });
  }
  if (error instanceof AgentActionError) {
    return res.status(error.httpStatus).json({ error: error.message, code: error.code });
  }
  const message = error instanceof Error ? error.message : String(error);
  return res.status(400).json({ error: message, code: "AGENT_ACTION_ERROR" });
}

function approverFrom(req: AdminRequest): { adminUserId: string; email: string; role?: string | null } {
  if (!req.adminUserId) {
    throw new AgentActionError("No authenticated admin identity on request", "UNAUTHENTICATED", 401);
  }
  return { adminUserId: req.adminUserId, email: req.adminUserEmail ?? "unknown", role: req.adminRole };
}

export function registerAgentActionRoutes(app: Express, guards: AgentActionGuards): void {
  const { requireAdmin, requireAdminRole, getAssociationIdQuery, assertAssociationScope } = guards;

  // POST /api/agent/actions — agent files an action.
  app.post(
    "/api/agent/actions",
    requireAdmin,
    requireAdminRole(AGENT_ACTION_WRITE_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const parsed = fileSchema.parse(req.body);
        assertAssociationScope(req, parsed.associationId);
        const created = await fileAction({
          associationId: parsed.associationId,
          actionType: parsed.actionType,
          reasoning: parsed.reasoning,
          createdByAgent: parsed.createdByAgent,
          targetEntityType: parsed.targetEntityType ?? null,
          targetEntityId: parsed.targetEntityId ?? null,
          payload: parsed.payload,
          severity: parsed.severity,
          statutoryDeadline: parsed.statutoryDeadline ?? null,
        });
        return res.status(201).json({ action: created });
      } catch (error) {
        return sendError(res, error);
      }
    },
  );

  // POST /api/agent/actions/:id/approve — a human approves.
  app.post(
    "/api/agent/actions/:id/approve",
    requireAdmin,
    requireAdminRole(AGENT_ACTION_WRITE_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const { associationId } = associationBodySchema.parse(req.body);
        assertAssociationScope(req, associationId);
        const updated = await approveAction(req.params.id as string, associationId, approverFrom(req));
        return res.json({ action: updated });
      } catch (error) {
        return sendError(res, error);
      }
    },
  );

  // POST /api/agent/actions/:id/reject — a human rejects.
  app.post(
    "/api/agent/actions/:id/reject",
    requireAdmin,
    requireAdminRole(AGENT_ACTION_WRITE_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const parsed = rejectSchema.parse(req.body);
        assertAssociationScope(req, parsed.associationId);
        const updated = await rejectAction(req.params.id as string, parsed.associationId, approverFrom(req), parsed.reason ?? undefined);
        return res.json({ action: updated });
      } catch (error) {
        return sendError(res, error);
      }
    },
  );

  // POST /api/agent/actions/:id/execute — run the gate + actuate the executed fact.
  app.post(
    "/api/agent/actions/:id/execute",
    requireAdmin,
    requireAdminRole(AGENT_ACTION_WRITE_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const { associationId } = associationBodySchema.parse(req.body);
        assertAssociationScope(req, associationId);
        const actor = approverFrom(req);
        const updated = await executeAction(req.params.id as string, associationId, {
          actorType: "human",
          actorId: actor.adminUserId,
          actorEmail: actor.email,
        });
        return res.json({ action: updated });
      } catch (error) {
        return sendError(res, error);
      }
    },
  );

  // GET /api/agent/queue?associationId=&status= — the surface (severity-ranked).
  app.get(
    "/api/agent/queue",
    requireAdmin,
    requireAdminRole(AGENT_ACTION_READ_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const associationId = getAssociationIdQuery(req);
        if (!associationId) {
          return res.status(400).json({ error: "associationId query param is required", code: "INVALID_INPUT" });
        }
        assertAssociationScope(req, associationId);
        const statusParam = typeof req.query.status === "string" ? req.query.status : undefined;
        const statuses =
          statusParam === "all"
            ? (["draft", "queued", "approved", "rejected", "executed", "failed"] as any)
            : statusParam
              ? [statusParam as any]
              : undefined;
        const items = await listQueue(associationId, { statuses });
        return res.json({ queue: items });
      } catch (error) {
        return sendError(res, error);
      }
    },
  );

  // GET /api/agent/actions/:id/audit — immutable audit trail (one click from queue).
  app.get(
    "/api/agent/actions/:id/audit",
    requireAdmin,
    requireAdminRole(AGENT_ACTION_READ_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const associationId = getAssociationIdQuery(req);
        if (!associationId) {
          return res.status(400).json({ error: "associationId query param is required", code: "INVALID_INPUT" });
        }
        assertAssociationScope(req, associationId);
        const log = await getAuditLog(req.params.id as string, associationId);
        return res.json({ audit: log });
      } catch (error) {
        return sendError(res, error);
      }
    },
  );
}
