/**
 * AP / vendor-invoice suggestion route (founder-os#9477, W2).
 *
 *   POST /api/agent/ap/suggest — ingest an inbound vendor invoice, produce a
 *     vendor-match + GL-code suggestion (with a confidence band), and file it as
 *     an L3 (financial) action on the chief-of-staff queue. The suggestion CANNOT
 *     actuate here — it is queued at L3, and the human approves + executes through
 *     the existing W1 routes (`/api/agent/actions/:id/approve` then `.../execute`).
 *
 * Isolation: the associationId is asserted against the authenticated session
 * (`assertAssociationScope`) before anything is loaded or filed — never trusted
 * from the body alone. Write access mirrors the W1 agent-action write roles.
 */
import type { Express, NextFunction, Request, Response } from "express";
import { z } from "zod";
import { type AdminRole } from "@shared/schema";
import { AgentActionError } from "../services/agent-action-service";
import { suggestAndQueueApInvoice } from "../services/ap-suggestion-service";

type AdminRequest = Request & {
  adminUserId?: string;
  adminUserEmail?: string;
  adminRole?: AdminRole;
  adminScopedAssociationIds?: string[];
};

interface ApSuggestionGuards {
  requireAdmin: (req: Request, res: Response, next: NextFunction) => unknown;
  requireAdminRole: (roles: AdminRole[]) => (req: Request, res: Response, next: NextFunction) => unknown;
  assertAssociationScope: (req: AdminRequest, associationId: string) => void;
}

// Same write roles as the W1 agent-action queue.
const AP_WRITE_ROLES: AdminRole[] = ["platform-admin", "board-officer", "manager", "pm-assistant"];

const suggestSchema = z.object({
  associationId: z.string().min(1),
  vendorName: z.string().trim().min(1),
  amount: z.coerce.number().finite().nonnegative(),
  invoiceNumber: z.string().trim().max(120).optional().nullable(),
  memo: z.string().trim().max(2000).optional().nullable(),
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
  return res.status(400).json({ error: message, code: "AP_SUGGESTION_ERROR" });
}

export function registerApSuggestionRoutes(app: Express, guards: ApSuggestionGuards): void {
  const { requireAdmin, requireAdminRole, assertAssociationScope } = guards;

  app.post(
    "/api/agent/ap/suggest",
    requireAdmin,
    requireAdminRole(AP_WRITE_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const parsed = suggestSchema.parse(req.body);
        assertAssociationScope(req, parsed.associationId);
        const { action, suggestion } = await suggestAndQueueApInvoice({
          associationId: parsed.associationId,
          vendorName: parsed.vendorName,
          amount: parsed.amount,
          invoiceNumber: parsed.invoiceNumber ?? null,
          memo: parsed.memo ?? null,
          createdByAgent: parsed.createdByAgent,
        });
        // 201: a new L3 action is queued for human approval.
        return res.status(201).json({ action, suggestion });
      } catch (error) {
        return sendError(res, error);
      }
    },
  );
}
