/**
 * Meeting-prep agent-ability route (founder-os#9478).
 *
 *   POST /api/agent/meeting-prep         — aggregate activity, draft the agenda
 *     + packet, and file it as a `suggest.meeting_prep` (L1) action onto the
 *     W1 chief-of-staff queue (founder-os#9474) for human review. NEVER
 *     distributes — sending the packet is a separate, never-auto-filed L2
 *     action (`reversible.distribute_meeting_packet`) out of scope here.
 *   GET  /api/agent/meeting-prep/preview — the same aggregate→draft→assemble
 *     pipeline WITHOUT filing anything (a dry-run preview a board member can
 *     read before asking the agent to actually queue the draft).
 *
 * Isolation: the associationId is asserted against the authenticated session
 * (`assertAssociationScope`) before anything is read or filed — never trusted
 * from the body/query alone. Write access mirrors the W1 agent-action write
 * roles; read access (preview) mirrors the W1 read roles.
 */
import type { Express, NextFunction, Request, Response } from "express";
import { z } from "zod";
import { type AdminRole } from "@shared/schema";
import { AgentActionError } from "../services/agent-action-service";
import { aggregateActivity, assemblePacket, draftAgenda, prepareMeetingPacket } from "../services/meeting-prep-service";

type AdminRequest = Request & {
  adminUserId?: string;
  adminUserEmail?: string;
  adminRole?: AdminRole;
  adminScopedAssociationIds?: string[];
};

interface MeetingPrepGuards {
  requireAdmin: (req: Request, res: Response, next: NextFunction) => unknown;
  requireAdminRole: (roles: AdminRole[]) => (req: Request, res: Response, next: NextFunction) => unknown;
  assertAssociationScope: (req: AdminRequest, associationId: string) => void;
}

// Same write roles as the W1 agent-action queue (this ability FILES an action).
const MEETING_PREP_WRITE_ROLES: AdminRole[] = ["platform-admin", "board-officer", "manager", "pm-assistant"];
// Preview is read-only; wider so viewers can see the draft before it's filed.
const MEETING_PREP_READ_ROLES: AdminRole[] = ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"];

const prepSchema = z.object({
  associationId: z.string().min(1),
  meetingDate: z.coerce.date().optional(),
  sinceDate: z.coerce.date().optional(),
  targetMeetingId: z.string().trim().optional().nullable(),
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
  return res.status(400).json({ error: message, code: "MEETING_PREP_ERROR" });
}

export function registerMeetingPrepRoutes(app: Express, guards: MeetingPrepGuards): void {
  const { requireAdmin, requireAdminRole, assertAssociationScope } = guards;

  // POST /api/agent/meeting-prep — aggregate + draft + file the L1 suggestion.
  app.post(
    "/api/agent/meeting-prep",
    requireAdmin,
    requireAdminRole(MEETING_PREP_WRITE_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const parsed = prepSchema.parse(req.body);
        assertAssociationScope(req, parsed.associationId);
        const result = await prepareMeetingPacket({
          associationId: parsed.associationId,
          meetingDate: parsed.meetingDate,
          sinceDate: parsed.sinceDate,
          targetMeetingId: parsed.targetMeetingId ?? null,
          createdByAgent: parsed.createdByAgent,
        });
        // 201: a new L1 suggest.meeting_prep action is queued for human review.
        return res.status(201).json({
          action: result.action,
          agendaSummary: {
            sections: result.agenda.sections.map((s) => ({ title: s.title, itemCount: s.lines.length })),
            sinceDate: result.agenda.sinceDate,
          },
          packet: result.packet,
        });
      } catch (error) {
        return sendError(res, error);
      }
    },
  );

  // GET /api/agent/meeting-prep/preview?associationId=&sinceDate= — dry-run,
  // no action is filed.
  app.get(
    "/api/agent/meeting-prep/preview",
    requireAdmin,
    requireAdminRole(MEETING_PREP_READ_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const associationId = typeof req.query.associationId === "string" ? req.query.associationId : undefined;
        if (!associationId) {
          return res.status(400).json({ error: "associationId query param is required", code: "INVALID_INPUT" });
        }
        assertAssociationScope(req, associationId);
        const sinceDate = typeof req.query.sinceDate === "string" ? new Date(req.query.sinceDate) : undefined;
        const activity = await aggregateActivity(associationId, { sinceDate });
        const agenda = draftAgenda(activity);
        const packet = assemblePacket(agenda, activity);
        return res.json({ packet });
      } catch (error) {
        return sendError(res, error);
      }
    },
  );
}
