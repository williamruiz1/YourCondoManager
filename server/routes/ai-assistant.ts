/**
 * AI Assistant — SSE streaming routes (founder-os#1318, Phase 0).
 *
 * Owner-facing chat endpoints. The SSE frame shape matches the founder-os#1244
 * spec (`delta` / `complete` / `error` event types) so the Phase 1 wiring
 * doesn't need to reshape the streaming protocol.
 *
 * Routes (owner-portal only — all require `requirePortal`):
 *   POST /api/ai/conversation         — open a new conversation; returns handle
 *   POST /api/ai/conversation/stream  — send a turn; streams the reply via SSE
 *
 * Feature flag: `AI_ASSISTANT_ENABLED` (per-association via
 * `getFeatureFlagForAssociation`). Default OFF; CHC opts in at go-live.
 */

import type { Express, NextFunction, Request, Response } from "express";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import { ownerships, units } from "@shared/schema";
import { getFeatureFlagForAssociation } from "@shared/feature-flags";
import { boundAdapter } from "../services/ai-assistant";
import { IsolationViolationError } from "../services/ai-assistant/tools";
import { getRoleLensedPressingItems } from "../services/pressing-items/scanner";
import type {
  AssistantMessage,
  AssistantSubMode,
  CallerContext,
  ConversationHandle,
} from "../services/ai-assistant/types";

type PortalRequest = Request & {
  portalAccessId?: string;
  portalAssociationId?: string;
  portalPersonId?: string;
  portalUnitId?: string | null;
  portalEmail?: string;
  portalRole?: string;
};

export interface AiAssistantRouteHelpers {
  requirePortal: (req: any, res: Response, next: NextFunction) => any;
}

async function getOwnerUnitIds(associationId: string, personId: string): Promise<string[]> {
  const rows = await db
    .select({ unitId: units.id })
    .from(ownerships)
    .innerJoin(units, eq(ownerships.unitId, units.id))
    .where(
      and(
        eq(ownerships.personId, personId),
        eq(units.associationId, associationId),
        isNull(ownerships.endDate),
      ),
    );
  return [...new Set(rows.map((r) => r.unitId))];
}

/**
 * 403 unless the feature flag is ON for this association. Returns the
 * authoritative caller context the tool layer needs for isolation.
 */
async function gateFeatureFlag(
  req: PortalRequest,
  res: Response,
): Promise<{ caller: CallerContext } | null> {
  if (!req.portalAssociationId || !req.portalPersonId) {
    res.status(403).json({ message: "Not authorized" });
    return null;
  }
  const enabled = getFeatureFlagForAssociation("AI_ASSISTANT_ENABLED", req.portalAssociationId);
  if (!enabled) {
    res.status(404).json({ message: "AI assistant not available for this community" });
    return null;
  }
  const unitIds = await getOwnerUnitIds(req.portalAssociationId, req.portalPersonId);
  return {
    caller: {
      associationId: req.portalAssociationId,
      personId: req.portalPersonId,
      unitIds,
    },
  };
}

export function registerAiAssistantRoutes(app: Express, helpers: AiAssistantRouteHelpers): void {
  const { requirePortal } = helpers;

  // ── POST /api/ai/conversation — open a new handle ───────────────────────

  app.post("/api/ai/conversation", requirePortal, async (req: PortalRequest, res: Response) => {
    const gate = await gateFeatureFlag(req, res);
    if (!gate) return;

    try {
      const subMode = ((req.body as { subMode?: string }).subMode ?? "resident") as AssistantSubMode;
      if (subMode !== "resident") {
        return res.status(400).json({ message: "Only the 'resident' sub-mode is supported in Phase 0" });
      }
      const handle = await boundAdapter.createConversation(subMode);
      res.json(handle);
    } catch (err: any) {
      // Surface to Sentry via the existing observability wiring (founder-os#1030).
      // Sentry's auto-capture on uncaught Express errors covers this path; we
      // still log for parity with other handlers.
      console.error("[ai-assistant] createConversation failed", err);
      res.status(500).json({ message: err?.message ?? "Failed to open conversation" });
    }
  });

  // ── POST /api/ai/conversation/stream — turn with SSE reply ──────────────

  app.post("/api/ai/conversation/stream", requirePortal, async (req: PortalRequest, res: Response) => {
    const gate = await gateFeatureFlag(req, res);
    if (!gate) return;

    const body = req.body as {
      conversation?: ConversationHandle;
      userMessage?: AssistantMessage;
      history?: AssistantMessage[];
    };
    if (!body.conversation?.id || !body.userMessage?.text) {
      return res.status(400).json({ message: "conversation + userMessage required" });
    }

    // SSE response setup
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // disable Nginx buffering if proxied
    res.flushHeaders?.();

    const writeEvent = (data: object) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const stream = boundAdapter.sendTurn({
        conversation: body.conversation,
        userMessage: body.userMessage,
        history: body.history ?? [],
        caller: gate.caller,
      });

      for await (const event of stream) {
        writeEvent(event);
        if (event.type === "complete" || event.type === "error") break;
      }
    } catch (err: unknown) {
      const isolationViolation = err instanceof IsolationViolationError;
      writeEvent({
        type: "error",
        reason: isolationViolation
          ? "Isolation guard refused tool call (cross-owner access attempted)"
          : err instanceof Error ? err.message : "Unknown error",
        retriable: !isolationViolation,
      });
      // Surface to Sentry via the existing observability wiring (founder-os#1030).
      console.error("[ai-assistant] sendTurn stream failed", err);
    } finally {
      res.end();
    }
  });

  // ── GET /api/ai/chat-opener — pressing-items-primed greeting ────────────
  //
  // founder-os#1256 Phase 1: when the chat opens, the first AI message is
  // generated from the top-3 pressing items + a greeting, NOT a blank
  // "what can I help with?" prompt. The client renders this as the
  // assistant's opening turn before the user has typed anything.
  //
  // This is a cheap synchronous endpoint — no LLM call yet. It returns the
  // raw pressing items + a deterministic opener template; if the client
  // wants a more natural-language opener, it can pass them into a turn
  // with `subMode=resident` and ask "summarize what I should look at today".
  app.get("/api/ai/chat-opener", requirePortal, async (req: PortalRequest, res: Response) => {
    const gate = await gateFeatureFlag(req, res);
    if (!gate) return;

    try {
      const items = await getRoleLensedPressingItems({
        associationId: gate.caller.associationId,
        actorRole: "board",
        limit: 3,
      });
      const opener = renderOpener(items);
      res.json({ opener, items });
    } catch (err: any) {
      console.error("[ai-assistant] chat-opener failed", err);
      res.status(500).json({ message: err?.message ?? "Failed to load chat opener" });
    }
  });
}

function renderOpener(
  items: Array<{ title: string }>,
): string {
  if (items.length === 0) {
    return "Hi — nothing urgent on my radar for you today. What can I help with?";
  }
  const titles = items.map((i) => i.title);
  const list =
    titles.length === 1
      ? `[${titles[0]}]`
      : titles.length === 2
      ? `[${titles[0]}] and [${titles[1]}]`
      : `[${titles[0]}], [${titles[1]}], and [${titles[2]}]`;
  return `Here's what I'd look at first today: ${list}. Want me to help with any of these?`;
}
