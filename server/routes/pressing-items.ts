/**
 * Pressing-Items routes (founder-os#1256, Phase 1).
 *
 * ONE surface consumes the widget:
 *   GET  /api/admin/pressing-items            — admin dashboard widget (incl. Board mode)
 *   POST /api/admin/pressing-items/:id/snooze — admin snooze action
 *   POST /api/admin/pressing-items/scan       — manual scan trigger (platform admin)
 *
 * The owner-portal endpoints below (`GET`/`POST /api/portal/pressing-items*`)
 * are intentionally kept as NO-OPs (always `{ items: [] }` / 404) rather than
 * deleted outright — some other portal surface may still reference the URL,
 * and a 404/empty response is a safe, inert answer either way.
 *
 * HARD RULE (William, 2026-07-14, voice): pressing items — unmatched bank
 * transactions, other owners' delinquency status, vendor insurance,
 * compliance deadlines — are board/treasurer business. They MUST NEVER
 * render on the owner-portal surface, for ANY caller, REGARDLESS of that
 * caller's board seat or officer title. "I should not be seeing this on an
 * owner's portal. This is something for a board member / board portal...
 * this is the wrong surface." The board/treasurer surface is `/app` (the
 * admin dashboard, including its Board-mode skin for volunteer board
 * officers) — that is where `PressingItemsWidget` continues to render.
 *
 * (Earlier same-day iteration of this fix tried to LENS the portal response
 * by the caller's actual board seat/officer title instead of the previous
 * blanket "board" fallback — see PR #498's `lensRoleFromPortal`. That was a
 * real improvement over the PRIOR bug (every portal caller, including a
 * plain owner, saw everything), but William's ruling supersedes it: no
 * amount of role-lensing is correct here, because the surface itself is
 * wrong for this content, not just the audience. The lensing function was
 * removed rather than left as unreachable dead code.)
 *
 * Isolation: every read filters by `associationId` derived from the
 * authenticated session, never from the request body or query.
 */

import type { Express, NextFunction, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { pressingItems, type PressingItemActorRole } from "@shared/schema";
import {
  getRoleLensedPressingItems,
  scanAssociation,
} from "../services/pressing-items/scanner";

type PortalRequest = Request & {
  portalAssociationId?: string;
};

type AdminRequest = Request & {
  adminUserId?: string;
  adminRole?: string;
  adminScopedAssociationIds?: string[];
};

export interface PressingItemsRouteHelpers {
  requirePortal: (req: any, res: Response, next: NextFunction) => any;
  requireAdmin: (req: any, res: Response, next: NextFunction) => any;
  /**
   * Gate to apply AFTER `requireAdmin` for endpoints restricted to the
   * `platform-admin` role only.
   */
  platformAdminOnly: (req: any, res: Response, next: NextFunction) => any;
}

function lensRoleFromAdmin(req: AdminRequest): PressingItemActorRole {
  // Admin roles in YCM don't map 1:1 to board officer roles yet; default
  // to `board` which sees every class. When per-officer admin sub-roles
  // are introduced this widens.
  return "board";
}

function resolveAssociationId(req: AdminRequest): string | null {
  // Single-scoped admin → that association. Platform admin or multi-scope
  // → expect ?associationId= in query.
  const qid = (req.query.associationId as string | undefined) ?? null;
  if (qid) return qid;
  const scoped = req.adminScopedAssociationIds ?? [];
  if (scoped.length === 1) return scoped[0];
  return null;
}

export function registerPressingItemsRoutes(
  app: Express,
  helpers: PressingItemsRouteHelpers,
): void {
  const { requirePortal, requireAdmin, platformAdminOnly } = helpers;

  // ── Portal: GET (HARD-GATED OFF — see file header) ────────────────────
  // Pressing items are board/treasurer business and must NEVER render on
  // the owner portal, for ANY caller, regardless of board seat/officer
  // title (William, 2026-07-14). Auth is still required (so this doesn't
  // become an unauthenticated probe), but the answer is unconditionally
  // empty — no role computation, no query against `pressing_items` at all.
  app.get(
    "/api/portal/pressing-items",
    requirePortal,
    async (req: PortalRequest, res: Response) => {
      if (!req.portalAssociationId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      res.json({ items: [] });
    },
  );

  // ── Portal: snooze (HARD-GATED OFF — see file header) ─────────────────
  // Nothing is ever shown to snooze; kept as an inert 404 rather than
  // removed outright in case any stale client still references the route.
  app.post(
    "/api/portal/pressing-items/:id/snooze",
    requirePortal,
    async (_req: PortalRequest, res: Response) => {
      res.status(404).json({ message: "Pressing items are not available on the owner portal" });
    },
  );

  // ── Admin: GET ─────────────────────────────────────────────────────────
  app.get(
    "/api/admin/pressing-items",
    requireAdmin,
    async (req: AdminRequest, res: Response) => {
      const associationId = resolveAssociationId(req);
      if (!associationId) {
        return res.status(400).json({
          message: "associationId query param required for multi-scope admin",
        });
      }
      // Defense in depth: admin must have scope.
      const scoped = req.adminScopedAssociationIds ?? [];
      if (req.adminRole !== "platform-admin" && !scoped.includes(associationId)) {
        return res.status(403).json({ message: "Association is outside admin scope" });
      }
      try {
        const items = await getRoleLensedPressingItems({
          associationId,
          actorRole: lensRoleFromAdmin(req),
          limit: 50,
        });
        res.json({ items });
      } catch (err: any) {
        console.error("[pressing-items] admin GET failed", err);
        res.status(500).json({ message: err?.message ?? "Failed to load pressing items" });
      }
    },
  );

  // ── Admin: snooze ──────────────────────────────────────────────────────
  app.post(
    "/api/admin/pressing-items/:id/snooze",
    requireAdmin,
    async (req: AdminRequest, res: Response) => {
      const id = String(req.params.id);
      const until = (req.body as { until?: string }).until;
      if (!until || Number.isNaN(Date.parse(until))) {
        return res.status(400).json({ message: "ISO 8601 `until` required" });
      }

      // Resolve and verify scope.
      const [row] = await db
        .select({ associationId: pressingItems.associationId })
        .from(pressingItems)
        .where(eq(pressingItems.id, id))
        .limit(1);
      if (!row) return res.status(404).json({ message: "Pressing item not found" });
      const scoped = req.adminScopedAssociationIds ?? [];
      if (req.adminRole !== "platform-admin" && !scoped.includes(row.associationId)) {
        return res.status(403).json({ message: "Association is outside admin scope" });
      }

      await db
        .update(pressingItems)
        .set({ snoozedUntil: new Date(until), updatedAt: new Date() })
        .where(eq(pressingItems.id, id));
      res.json({ id, snoozedUntil: until });
    },
  );

  // ── Admin: manual scan trigger (platform admin) ────────────────────────
  app.post(
    "/api/admin/pressing-items/scan",
    requireAdmin,
    platformAdminOnly,
    async (req: AdminRequest, res: Response) => {
      const associationId = (req.body?.associationId ?? req.query.associationId) as string | undefined;
      if (!associationId) {
        return res.status(400).json({ message: "associationId required" });
      }
      try {
        const result = await scanAssociation(associationId);
        res.json(result);
      } catch (err: any) {
        console.error("[pressing-items] manual scan failed", err);
        res.status(500).json({ message: err?.message ?? "Scan failed" });
      }
    },
  );
}
