/**
 * Owner-FAQ triage intake route (founder-os#9476, W1).
 *
 *   POST /api/portal/agent/owner-faq/triage — an owner submits a routine
 *   inquiry ("what's my balance?", "did my payment post?", "when's the next
 *   meeting?"); the agent classifies it, drafts a grounded reply from the
 *   owner's REAL ledger/portal state, and files it into the W1 Chief-of-Staff
 *   queue (founder-os#9474) for review — default is queue-for-review, NOT
 *   auto-send (see server/services/owner-faq-triage/triage-service.ts).
 *
 * Portal-scoped: associationId/personId/unitId are derived from the
 * authenticated portal session (`requirePortal`), never trusted from the
 * request body — the same tenant-isolation convention every portal route
 * follows.
 */
import type { Express, NextFunction, Request, Response } from "express";
import { z } from "zod";
import { triageInquiryProd } from "../services/owner-faq-triage/triage-service";

type PortalRequest = Request & {
  portalAssociationId?: string;
  portalPersonId?: string;
  portalUnitId?: string | null;
};

export interface OwnerFaqTriageGuards {
  requirePortal: (req: any, res: Response, next: NextFunction) => any;
}

const intakeSchema = z.object({
  text: z.string().trim().min(1).max(4000),
  channel: z.string().trim().max(100).optional(),
});

export function registerOwnerFaqTriageRoutes(app: Express, guards: OwnerFaqTriageGuards): void {
  const { requirePortal } = guards;

  app.post("/api/portal/agent/owner-faq/triage", requirePortal, async (req: PortalRequest, res: Response) => {
    try {
      const parsed = intakeSchema.parse(req.body);
      if (!req.portalAssociationId || !req.portalPersonId) {
        return res.status(403).json({ message: "Portal access required" });
      }
      const result = await triageInquiryProd({
        associationId: req.portalAssociationId,
        personId: req.portalPersonId,
        unitIds: req.portalUnitId ? [req.portalUnitId] : [],
        text: parsed.text,
        channel: parsed.channel ?? "portal",
      });
      return res.status(201).json({
        category: result.classification.category,
        actionType: result.actionType,
        actionId: result.action.id,
        status: result.action.status,
        autoSent: result.autoSent,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", code: "INVALID_INPUT", issues: error.issues });
      }
      const message = error instanceof Error ? error.message : String(error);
      return res.status(400).json({ error: message, code: "OWNER_FAQ_TRIAGE_ERROR" });
    }
  });
}
