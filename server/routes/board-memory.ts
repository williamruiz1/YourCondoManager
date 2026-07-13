/**
 * YCM cross-board-cycle institutional-memory routes (founder-os#9475, W1).
 *
 *   POST /api/agent/memory/decisions        — record a decision into the log
 *                                             (institutional logging; append-only).
 *   GET  /api/agent/memory/decisions        — query the memory (read-only surface).
 *   GET  /api/agent/memory/decisions/:id     — one decision's full context.
 *   GET  /api/agent/memory/history           — owner/vendor/rule/unit decision history.
 *
 * READ-ONLY (L1) by design: there is NO approve/execute/actuate endpoint here.
 * Querying the memory surfaces prior context with zero side effect on the
 * record-of-truth; recording is append-only institutional logging.
 *
 * Isolation: every read/write is scoped by associationId asserted against the
 * authenticated session (`assertAssociationScope`), never trusted from the body
 * alone.
 */
import type { Express, NextFunction, Request, Response } from "express";
import { z } from "zod";
import { type AdminRole } from "@shared/schema";
import {
  recordDecision,
  queryDecisions,
  getDecision,
  getEntityHistory,
  BoardMemoryError,
} from "../services/board-memory-service";

type AdminRequest = Request & {
  adminUserId?: string;
  adminUserEmail?: string;
  adminRole?: AdminRole;
  adminScopedAssociationIds?: string[];
};

interface BoardMemoryGuards {
  requireAdmin: (req: Request, res: Response, next: NextFunction) => unknown;
  requireAdminRole: (roles: AdminRole[]) => (req: Request, res: Response, next: NextFunction) => unknown;
  getAssociationIdQuery: (req: Request) => string | undefined;
  assertAssociationScope: (req: AdminRequest, associationId: string) => void;
}

// Recording an institutional decision is a board/manager function.
const MEMORY_WRITE_ROLES: AdminRole[] = ["platform-admin", "board-officer", "manager", "pm-assistant"];
// Reading the memory is wide — the whole point is any later board member can query it.
const MEMORY_READ_ROLES: AdminRole[] = ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"];

const attachmentSchema = z.object({ name: z.string().trim().min(1), url: z.string().trim().min(1) });

const recordSchema = z.object({
  associationId: z.string().min(1),
  subject: z.string().trim().min(1),
  decision: z.string().trim().min(1),
  reasoning: z.string().trim().min(1),
  category: z.enum(["rule_application", "vendor", "owner", "financial", "governance", "architectural", "general"]).optional(),
  actorType: z.string().trim().optional(),
  actorName: z.string().trim().min(1),
  actorRole: z.string().trim().optional().nullable(),
  boardTerm: z.string().trim().optional().nullable(),
  decidedAt: z.coerce.date().optional().nullable(),
  relatedEntityType: z.string().trim().optional().nullable(),
  relatedEntityId: z.string().trim().optional().nullable(),
  relatedEntityLabel: z.string().trim().optional().nullable(),
  sourceActionId: z.string().trim().optional().nullable(),
  attachments: z.array(attachmentSchema).optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
});

const categoryQuery = z.enum(["rule_application", "vendor", "owner", "financial", "governance", "architectural", "general"]);

function sendError(res: Response, error: unknown): Response {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: "Invalid input", code: "INVALID_INPUT", issues: error.issues });
  }
  if (error instanceof BoardMemoryError) {
    return res.status(error.httpStatus).json({ error: error.message, code: error.code });
  }
  const message = error instanceof Error ? error.message : String(error);
  return res.status(400).json({ error: message, code: "BOARD_MEMORY_ERROR" });
}

export function registerBoardMemoryRoutes(app: Express, guards: BoardMemoryGuards): void {
  const { requireAdmin, requireAdminRole, getAssociationIdQuery, assertAssociationScope } = guards;

  // POST /api/agent/memory/decisions — record a decision into the log.
  app.post(
    "/api/agent/memory/decisions",
    requireAdmin,
    requireAdminRole(MEMORY_WRITE_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const parsed = recordSchema.parse(req.body);
        assertAssociationScope(req, parsed.associationId);
        const created = await recordDecision({
          associationId: parsed.associationId,
          subject: parsed.subject,
          decision: parsed.decision,
          reasoning: parsed.reasoning,
          category: parsed.category,
          actorType: parsed.actorType,
          actorName: parsed.actorName,
          actorRole: parsed.actorRole ?? null,
          // Provenance: who recorded it (the session admin), independent of the
          // denormalized actorName (which may be a prior board member).
          recordedByUserId: req.adminUserId ?? null,
          boardTerm: parsed.boardTerm ?? null,
          decidedAt: parsed.decidedAt ?? null,
          relatedEntityType: parsed.relatedEntityType ?? null,
          relatedEntityId: parsed.relatedEntityId ?? null,
          relatedEntityLabel: parsed.relatedEntityLabel ?? null,
          sourceActionId: parsed.sourceActionId ?? null,
          attachments: parsed.attachments,
          tags: parsed.tags,
        });
        return res.status(201).json({ decision: created });
      } catch (error) {
        return sendError(res, error);
      }
    },
  );

  // GET /api/agent/memory/decisions?associationId=&category=&search=&boardTerm=&entityType=&entityId=&limit=
  app.get(
    "/api/agent/memory/decisions",
    requireAdmin,
    requireAdminRole(MEMORY_READ_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const associationId = getAssociationIdQuery(req);
        if (!associationId) {
          return res.status(400).json({ error: "associationId query param is required", code: "INVALID_INPUT" });
        }
        assertAssociationScope(req, associationId);
        const categoryParam = typeof req.query.category === "string" ? categoryQuery.parse(req.query.category) : undefined;
        const items = await queryDecisions(associationId, {
          category: categoryParam,
          boardTerm: typeof req.query.boardTerm === "string" ? req.query.boardTerm : undefined,
          relatedEntityType: typeof req.query.entityType === "string" ? req.query.entityType : undefined,
          relatedEntityId: typeof req.query.entityId === "string" ? req.query.entityId : undefined,
          search: typeof req.query.search === "string" ? req.query.search : undefined,
          limit: typeof req.query.limit === "string" ? Number(req.query.limit) : undefined,
        });
        return res.json({ decisions: items });
      } catch (error) {
        return sendError(res, error);
      }
    },
  );

  // GET /api/agent/memory/decisions/:id — one decision's full context.
  app.get(
    "/api/agent/memory/decisions/:id",
    requireAdmin,
    requireAdminRole(MEMORY_READ_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const associationId = getAssociationIdQuery(req);
        if (!associationId) {
          return res.status(400).json({ error: "associationId query param is required", code: "INVALID_INPUT" });
        }
        assertAssociationScope(req, associationId);
        const decision = await getDecision(req.params.id as string, associationId);
        return res.json({ decision });
      } catch (error) {
        return sendError(res, error);
      }
    },
  );

  // GET /api/agent/memory/history?associationId=&entityType=owner|vendor|rule|unit&entityId=&limit=
  app.get(
    "/api/agent/memory/history",
    requireAdmin,
    requireAdminRole(MEMORY_READ_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const associationId = getAssociationIdQuery(req);
        if (!associationId) {
          return res.status(400).json({ error: "associationId query param is required", code: "INVALID_INPUT" });
        }
        assertAssociationScope(req, associationId);
        const entityType = typeof req.query.entityType === "string" ? req.query.entityType : undefined;
        const entityId = typeof req.query.entityId === "string" ? req.query.entityId : undefined;
        if (!entityType || !entityId) {
          return res.status(400).json({ error: "entityType and entityId query params are required", code: "INVALID_INPUT" });
        }
        const history = await getEntityHistory(associationId, entityType, entityId, {
          limit: typeof req.query.limit === "string" ? Number(req.query.limit) : undefined,
        });
        return res.json({ entityType, entityId, history });
      } catch (error) {
        return sendError(res, error);
      }
    },
  );
}
