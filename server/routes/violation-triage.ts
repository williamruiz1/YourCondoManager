/**
 * Violation-intake triage route (founder-os#9479, W2).
 *
 *   POST /api/agent/violations/triage — intake an owner's violation report
 *     (description + photos), categorize it against the applicable rule, draft the
 *     violation notice grounded in the rule + evidence, and file it as a
 *     `reversible.draft_notice` (L2) action on the chief-of-staff queue routed to
 *     the PM/board. The notice CANNOT issue here — the draft is queued at L2, and
 *     issuing (send) is a separate `irreversible.send_owner_notice` (L3) action a
 *     human always approves + signs through the existing W1 routes.
 *
 * Isolation: the associationId is asserted against the authenticated session
 * (`assertAssociationScope`) before anything is filed — never trusted from the
 * body alone. Write access mirrors the W1 agent-action write roles.
 */
import type { Express, NextFunction, Request, Response } from "express";
import { z } from "zod";
import { type AdminRole } from "@shared/schema";
import { AgentActionError } from "../services/agent-action-service";
import { triageAndQueueViolation } from "../services/violation-triage-service";

type AdminRequest = Request & {
  adminUserId?: string;
  adminUserEmail?: string;
  adminRole?: AdminRole;
  adminScopedAssociationIds?: string[];
};

interface ViolationTriageGuards {
  requireAdmin: (req: Request, res: Response, next: NextFunction) => unknown;
  requireAdminRole: (roles: AdminRole[]) => (req: Request, res: Response, next: NextFunction) => unknown;
  assertAssociationScope: (req: AdminRequest, associationId: string) => void;
}

// Same write roles as the W1 agent-action queue.
const VIOLATION_WRITE_ROLES: AdminRole[] = ["platform-admin", "board-officer", "manager", "pm-assistant"];

const associationRuleSchema = z.object({
  category: z.string().min(1),
  ruleId: z.string().min(1),
  citation: z.string().min(1),
  text: z.string().min(1),
});

const triageSchema = z.object({
  associationId: z.string().min(1),
  description: z.string().trim().min(1).max(4000),
  photos: z.array(z.string().trim().min(1).max(1024)).max(50).optional(),
  unitLabel: z.string().trim().max(240).optional().nullable(),
  ownerName: z.string().trim().max(240).optional().nullable(),
  reportedBy: z.string().trim().max(240).optional().nullable(),
  rules: z.array(associationRuleSchema).max(200).optional(),
  reportEntityId: z.string().trim().max(120).optional().nullable(),
  associationName: z.string().trim().max(240).optional().nullable(),
  cureByDays: z.coerce.number().int().min(1).max(90).optional(),
  createdByAgent: z.string().trim().max(120).optional(),
});

function sendError(res: Response, error: unknown): Response {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: "Invalid input", code: "INVALID_INPUT", issues: error.issues });
  }
  if (error instanceof AgentActionError) {
    return res.status(error.httpStatus).json({ error: error.message, code: error.code });
  }
  const message = error instanceof Error ? error.message : String(error);
  return res.status(400).json({ error: message, code: "VIOLATION_TRIAGE_ERROR" });
}

export function registerViolationTriageRoutes(app: Express, guards: ViolationTriageGuards): void {
  const { requireAdmin, requireAdminRole, assertAssociationScope } = guards;

  app.post(
    "/api/agent/violations/triage",
    requireAdmin,
    requireAdminRole(VIOLATION_WRITE_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const parsed = triageSchema.parse(req.body);
        assertAssociationScope(req, parsed.associationId);
        const result = await triageAndQueueViolation({
          associationId: parsed.associationId,
          report: {
            description: parsed.description,
            photos: parsed.photos,
            unitLabel: parsed.unitLabel ?? null,
            ownerName: parsed.ownerName ?? null,
            reportedBy: parsed.reportedBy ?? null,
            rules: parsed.rules as never,
          },
          reportEntityId: parsed.reportEntityId ?? null,
          associationName: parsed.associationName ?? null,
          cureByDays: parsed.cureByDays,
          createdByAgent: parsed.createdByAgent,
        });
        // 201: a new L2 draft-notice action is queued for human review + signature.
        return res.status(201).json(result);
      } catch (error) {
        return sendError(res, error);
      }
    },
  );
}
