/**
 * Bank-reconciliation suggestion agent-ability routes (founder-os#9480, W2).
 *
 *   POST /api/agent/recon-suggestion — read unmatched bank credits + pending
 *     ledger pay-intents, propose matched pairs (confidence band + reasoning),
 *     and file each as a `financial.reconcile_bank_match` (L3) action onto the
 *     W1 chief-of-staff queue (founder-os#9474). NEVER commits a pairing.
 *   GET  /api/agent/recon-suggestion/preview — the same read→score→select
 *     pipeline WITHOUT filing anything (dry-run a treasurer can inspect).
 *   POST /api/agent/recon-suggestion/:actionId/execute — actuate ONE approved
 *     proposal: refused through the real W1 gate unless a human approval is
 *     recorded; commits via the existing manual-match validations.
 *
 * Isolation: associationId asserted against the authenticated session
 * (`assertAssociationScope`) before anything is read, filed, or committed.
 */
import type { Express, NextFunction, Request, Response } from "express";
import { z } from "zod";
import { type AdminRole } from "@shared/schema";
import { AgentActionError } from "../services/agent-action-service";
import {
  DEFAULT_MAX_PROPOSALS,
  executeApprovedReconMatch,
  fileReconSuggestions,
  previewReconSuggestions,
} from "../services/recon-suggestion-service";

type AdminRequest = Request & {
  adminUserId?: string;
  adminUserEmail?: string;
  adminRole?: AdminRole;
  adminScopedAssociationIds?: string[];
};

interface ReconSuggestionGuards {
  requireAdmin: (req: Request, res: Response, next: NextFunction) => unknown;
  requireAdminRole: (roles: AdminRole[]) => (req: Request, res: Response, next: NextFunction) => unknown;
  assertAssociationScope: (req: AdminRequest, associationId: string) => void;
}

// Same write roles as the W1 agent-action queue (these routes FILE + EXECUTE
// actions); preview is read-only and wider, mirroring meeting-prep.
const RECON_SUGGEST_WRITE_ROLES: AdminRole[] = ["platform-admin", "board-officer", "manager", "pm-assistant"];
const RECON_SUGGEST_READ_ROLES: AdminRole[] = ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"];

const runSchema = z.object({
  associationId: z.string().min(1),
  maxProposals: z.coerce.number().int().min(1).max(100).optional(),
  createdByAgent: z.string().trim().max(120).optional(),
});

const executeSchema = z.object({
  associationId: z.string().min(1),
});

function sendError(res: Response, error: unknown): Response {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: "Invalid input", code: "INVALID_INPUT", issues: error.issues });
  }
  if (error instanceof AgentActionError) {
    return res.status(error.httpStatus).json({ error: error.message, code: error.code });
  }
  const message = error instanceof Error ? error.message : String(error);
  return res.status(400).json({ error: message, code: "RECON_SUGGESTION_ERROR" });
}

export function registerReconSuggestionRoutes(app: Express, guards: ReconSuggestionGuards): void {
  const { requireAdmin, requireAdminRole, assertAssociationScope } = guards;

  // POST /api/agent/recon-suggestion — propose + file L3 pairing suggestions.
  app.post(
    "/api/agent/recon-suggestion",
    requireAdmin,
    requireAdminRole(RECON_SUGGEST_WRITE_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const parsed = runSchema.parse(req.body);
        assertAssociationScope(req, parsed.associationId);
        const result = await fileReconSuggestions({
          associationId: parsed.associationId,
          maxProposals: parsed.maxProposals,
          createdByAgent: parsed.createdByAgent,
        });
        // 201: new L3 pairing proposals are queued for human approval.
        return res.status(201).json({
          actions: result.actions,
          proposals: result.proposals,
          summary: {
            filed: result.actions.length,
            reviewRowCount: result.reviewRowCount,
            skippedOpenProposals: result.skippedOpenProposals,
          },
        });
      } catch (error) {
        return sendError(res, error);
      }
    },
  );

  // GET /api/agent/recon-suggestion/preview?associationId= — dry-run.
  app.get(
    "/api/agent/recon-suggestion/preview",
    requireAdmin,
    requireAdminRole(RECON_SUGGEST_READ_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const associationId = typeof req.query.associationId === "string" ? req.query.associationId : undefined;
        if (!associationId) {
          return res.status(400).json({ error: "associationId query param is required", code: "INVALID_INPUT" });
        }
        assertAssociationScope(req, associationId);
        const maxProposals =
          typeof req.query.maxProposals === "string" && req.query.maxProposals !== ""
            ? Number(req.query.maxProposals)
            : DEFAULT_MAX_PROPOSALS;
        const result = await previewReconSuggestions(associationId, undefined, maxProposals);
        return res.json(result);
      } catch (error) {
        return sendError(res, error);
      }
    },
  );

  // POST /api/agent/recon-suggestion/:actionId/execute — commit ONE approved
  // pairing through the W1 gate + the existing manual-match validations.
  app.post(
    "/api/agent/recon-suggestion/:actionId/execute",
    requireAdmin,
    requireAdminRole(RECON_SUGGEST_WRITE_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const parsed = executeSchema.parse(req.body);
        assertAssociationScope(req, parsed.associationId);
        const actionId = String(req.params.actionId ?? "");
        if (!actionId) {
          return res.status(400).json({ error: "actionId path param is required", code: "INVALID_INPUT" });
        }
        const result = await executeApprovedReconMatch({
          actionId,
          associationId: parsed.associationId,
          actor: { actorType: "human", actorId: req.adminUserId, actorEmail: req.adminUserEmail },
        });
        return res.json(result);
      } catch (error) {
        return sendError(res, error);
      }
    },
  );
}
