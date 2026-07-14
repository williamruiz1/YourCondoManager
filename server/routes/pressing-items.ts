/**
 * Pressing-Items routes (founder-os#1256, Phase 1).
 *
 * Two surfaces consume the widget:
 *   GET  /api/portal/pressing-items           — owner-portal home widget
 *   POST /api/portal/pressing-items/:id/snooze — owner-portal snooze action
 *   GET  /api/admin/pressing-items            — admin dashboard widget
 *   POST /api/admin/pressing-items/:id/snooze — admin snooze action
 *   POST /api/admin/pressing-items/scan       — manual scan trigger (platform admin)
 *
 * Role lensing:
 *   - Portal callers: lensed via `req.portalEffectiveRole` (board seat
 *     required) + `req.portalBoardRoleTitle` (the specific office —
 *     Treasurer/Secretary/President/plain board member). A plain owner
 *     with NO board seat sees nothing — pressing items are board/officer
 *     business, not a fellow owner's business (see `lensRoleFromPortal`).
 *   - Admin callers: lensed via `req.adminRole` (`board-officer`,
 *     `assisted-board` etc. all default to `board`; specific treasurer /
 *     secretary / president lensing arrives when finer admin roles ship).
 *
 * Isolation: every read filters by `associationId` derived from the
 * authenticated session, never from the request body or query.
 */

import type { Express, NextFunction, Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { pressingItems, type PressingItemActorRole } from "@shared/schema";
import {
  getRoleLensedPressingItems,
  scanAssociation,
} from "../services/pressing-items/scanner";

type PortalRequest = Request & {
  portalAssociationId?: string;
  portalPersonId?: string;
  portalEffectiveRole?: string;
  portalBoardRoleTitle?: string | null;
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

/**
 * Lenses a portal caller to the pressing-items bucket for their ACTUAL
 * board seat — not a blanket "board" fallback. `portalEffectiveRole` is the
 * Phase 8a collapsed role (`owner` | `board-member` | `owner-board-member`)
 * and never equals "treasurer"/"secretary"/"president", so the officer
 * title has to come from `portalBoardRoleTitle` (`board_roles.role`,
 * free-text — "Treasurer", "treasurer", "Vice President", etc.).
 *
 * Returns `null` for a caller with NO board seat at all (a plain owner) —
 * pressing items (unmatched bank transactions, other owners' delinquency
 * status, vendor insurance, compliance deadlines) are board/officer
 * business, not something a fellow owner should see on their own portal
 * home. Before this fix every portal caller fell through to the "board"
 * lens (sees every class) because none of the collapsed role strings ever
 * matched "treasurer"/"secretary"/"president" — so a plain owner with no
 * board role saw other owners' delinquency balances and unmatched bank
 * transactions (founder-os/YCM pressing-items plain-English fix,
 * 2026-07-14).
 */
export function lensRoleFromPortal(req: PortalRequest): PressingItemActorRole | null {
  const hasBoardSeat =
    req.portalEffectiveRole === "board-member" || req.portalEffectiveRole === "owner-board-member";
  if (!hasBoardSeat) return null;

  const title = (req.portalBoardRoleTitle || "").trim().toLowerCase();
  if (title.includes("treasurer")) return "treasurer";
  if (title.includes("secretary")) return "secretary";
  if (title.includes("president")) return "president"; // covers "President" + "Vice President"
  return "board"; // a board seat with no more specific office (plain "board member")
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

  // ── Portal: GET ────────────────────────────────────────────────────────
  app.get(
    "/api/portal/pressing-items",
    requirePortal,
    async (req: PortalRequest, res: Response) => {
      if (!req.portalAssociationId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      // No board seat at all (plain owner) — pressing items are board/officer
      // business (unmatched bank transactions, other owners' delinquency
      // status, etc.), never surfaced to a fellow owner's own portal home.
      const actorRole = lensRoleFromPortal(req);
      if (!actorRole) {
        return res.json({ items: [] });
      }
      try {
        const items = await getRoleLensedPressingItems({
          associationId: req.portalAssociationId,
          actorRole,
          limit: 25,
        });
        res.json({ items });
      } catch (err: any) {
        console.error("[pressing-items] portal GET failed", err);
        res.status(500).json({ message: err?.message ?? "Failed to load pressing items" });
      }
    },
  );

  // ── Portal: snooze ─────────────────────────────────────────────────────
  app.post(
    "/api/portal/pressing-items/:id/snooze",
    requirePortal,
    async (req: PortalRequest, res: Response) => {
      if (!req.portalAssociationId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const id = String(req.params.id);
      const until = (req.body as { until?: string }).until;
      if (!until || Number.isNaN(Date.parse(until))) {
        return res.status(400).json({ message: "ISO 8601 `until` required" });
      }
      try {
        const result = await db
          .update(pressingItems)
          .set({ snoozedUntil: new Date(until), updatedAt: new Date() })
          .where(
            and(
              eq(pressingItems.id, id),
              eq(pressingItems.associationId, req.portalAssociationId),
            ),
          )
          .returning({ id: pressingItems.id });
        if (result.length === 0) {
          return res.status(404).json({ message: "Pressing item not found" });
        }
        res.json({ id, snoozedUntil: until });
      } catch (err: any) {
        console.error("[pressing-items] portal snooze failed", err);
        res.status(500).json({ message: err?.message ?? "Failed to snooze" });
      }
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
