/**
 * agent-queue.ts — HTTP surface for the agent Chief-of-Staff queue.
 *
 * founder-os#9474 (foundation endpoints) + #9476 (owner-FAQ triage intake).
 *
 * Admin/board endpoints (queue + approve + audit):
 *   POST /api/agent/actions                — file an agent action
 *   POST /api/agent/actions/:id/approve    — human/board approval → executes if the ladder permits
 *   GET  /api/agent/queue                  — severity-ranked queue (statutory pinned top)
 *   GET  /api/agent/actions/:id/audit      — the immutable audit trail for one action
 *
 * Owner-FAQ triage intake (#9476):
 *   POST /api/agent/owner-faq/triage       — intake an owner inquiry → classify →
 *                                            ground → draft → file an L1/L2 action.
 *
 * Every endpoint is tenant-scoped: the associationId comes from the admin
 * association scope (assertAssociationScope) or the portal session
 * (req.portalAssociationId) — NEVER from an untrusted body id.
 */
import type { Express, NextFunction, Request, Response } from "express";
import { z } from "zod";

import {
  fileAction,
  approveAction,
  getQueue,
  getAuditLog,
} from "../services/agent-queue/agent-queue-service";
import { triageInquiryProd } from "../services/owner-faq-triage/triage-service";
import type { AdminRole } from "../../shared/schema";

type AdminRequest = Request & {
  adminUserId?: string;
  adminUserEmail?: string;
  adminRole?: AdminRole;
  portalAssociationId?: string;
  portalPersonId?: string;
};

export interface AgentQueueRouteHelpers {
  requireAdmin: (req: any, res: Response, next: NextFunction) => any;
  requireAdminRole: (roles: AdminRole[]) => (req: any, res: Response, next: NextFunction) => any;
  requirePortal: (req: any, res: Response, next: NextFunction) => any;
  getAssociationIdQuery: (req: Request) => string | undefined;
  assertAssociationScope: (req: AdminRequest, associationId: string) => void;
}

const REVIEW_ROLES: AdminRole[] = [
  "platform-admin",
  "board-officer",
  "assisted-board",
  "pm-assistant",
  "manager",
];

const fileActionBody = z.object({
  actionType: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).default({}),
  reasoning: z.string().min(1),
  sourceData: z.record(z.string(), z.unknown()).optional(),
  createdByAgent: z.string().min(1),
  targetEntity: z.string().nullish(),
  statutoryDeadline: z.boolean().optional(),
});

const triageBody = z.object({
  text: z.string().min(1),
  channel: z.string().optional(),
});

export function registerAgentQueueRoutes(app: Express, helpers: AgentQueueRouteHelpers): void {
  const { requireAdmin, requireAdminRole, requirePortal, getAssociationIdQuery, assertAssociationScope } = helpers;

  // ── Admin/board: file an action ─────────────────────────────────────────────
  app.post(
    "/api/agent/actions",
    requireAdmin as any,
    requireAdminRole(REVIEW_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const associationId = getAssociationIdQuery(req);
        if (!associationId) return res.status(400).json({ message: "associationId is required" });
        assertAssociationScope(req, associationId);
        const body = fileActionBody.parse(req.body);
        const result = await fileAction({ associationId, ...body, payload: body.payload });
        return res.status(201).json(result);
      } catch (error: any) {
        return res.status(400).json({ message: error.message });
      }
    },
  );

  // ── Admin/board: approve (human or board) → executes if the ladder permits ──
  app.post(
    "/api/agent/actions/:id/approve",
    requireAdmin as any,
    requireAdminRole(REVIEW_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const associationId = getAssociationIdQuery(req);
        if (!associationId) return res.status(400).json({ message: "associationId is required" });
        assertAssociationScope(req, associationId);
        const approvalKind = req.body?.approvalKind === "board" ? "board" : "human";
        // Board-level approval requires an actual board officer.
        if (approvalKind === "board" && req.adminRole !== "board-officer" && req.adminRole !== "platform-admin") {
          return res.status(403).json({ message: "board-level approval requires a board officer" });
        }
        const result = await approveAction({
          associationId,
          actionId: String(req.params.id),
          approverUserId: req.adminUserId || req.adminUserEmail || "admin",
          approvalKind,
        });
        return res.json(result);
      } catch (error: any) {
        const code = /not found/i.test(error.message) ? 404 : 400;
        return res.status(code).json({ message: error.message });
      }
    },
  );

  // ── Admin/board: the queue surface ──────────────────────────────────────────
  app.get(
    "/api/agent/queue",
    requireAdmin as any,
    requireAdminRole(REVIEW_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const associationId = getAssociationIdQuery(req);
        if (!associationId) return res.status(400).json({ message: "associationId is required" });
        assertAssociationScope(req, associationId);
        return res.json(await getQueue(associationId));
      } catch (error: any) {
        return res.status(400).json({ message: error.message });
      }
    },
  );

  // ── Admin/board: the immutable audit trail for one action ───────────────────
  app.get(
    "/api/agent/actions/:id/audit",
    requireAdmin as any,
    requireAdminRole(REVIEW_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const associationId = getAssociationIdQuery(req);
        if (!associationId) return res.status(400).json({ message: "associationId is required" });
        assertAssociationScope(req, associationId);
        return res.json(await getAuditLog(associationId, String(req.params.id)));
      } catch (error: any) {
        return res.status(400).json({ message: error.message });
      }
    },
  );

  // ── Portal: owner submits an inquiry → triage (#9476) ───────────────────────
  // Scope is the owner's session (portalAssociationId / portalPersonId). The
  // agent drafts a reply into the queue for review; it does NOT send here.
  app.post(
    "/api/agent/owner-faq/triage",
    requirePortal as any,
    async (req: AdminRequest, res: Response) => {
      try {
        if (!req.portalAssociationId || !req.portalPersonId) {
          return res.status(400).json({ message: "No portal context" });
        }
        const { text, channel } = triageBody.parse(req.body);
        const result = await triageInquiryProd({
          associationId: req.portalAssociationId,
          personId: req.portalPersonId,
          unitIds: (req as any).portalUnitId ? [(req as any).portalUnitId as string] : [],
          text,
          channel: channel ?? "portal",
        });
        // Return the classification + draft + queue outcome; the reply itself is
        // held in the queue for review (default) — nothing is sent to the owner here.
        return res.status(201).json({
          category: result.classification.category,
          confidence: result.classification.confidence,
          actionType: result.actionType,
          level: result.fileResult.level,
          queued: !result.fileResult.autoExecuted,
          needsData: result.draft.needsData,
          reasoning: result.fileResult.action.reasoning ?? result.draft.reasoning,
        });
      } catch (error: any) {
        return res.status(400).json({ message: error.message });
      }
    },
  );
}
