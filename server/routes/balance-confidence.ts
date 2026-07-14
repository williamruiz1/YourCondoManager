/**
 * Owner-balance confidence routes (founder-os#11196 / research #832 §5).
 *
 * Surfaces the per-unit, per-category confidence tier that annotates a unit's
 * balance in the owner portal ("preliminary — under review" for LOW / DISPUTED),
 * plus the audit provenance and the documented dispute amount.
 *
 * Two surfaces, ONE board-only visibility rule enforced HERE (server-side):
 *
 *   Owner portal (requirePortal — owner sees THEIR OWN units):
 *     GET /api/portal/balance-confidence
 *     - association + person resolved from the portal session (never the query).
 *     - scoped to the units the owner owns (ownerships ⋈ units).
 *     - `disputeAmount` is STRIPPED for any row flagged
 *       `disputeVisibleToBoardOnly` — the owner never sees the dollar figure of
 *       a board-only dispute (they still see the DISPUTED tier + review state).
 *
 *   Board / treasurer (requireAdmin + read roles — any unit in scope):
 *     GET /api/financial/balance-confidence?associationId=
 *     - `disputeAmount` is INCLUDED (board-only figure is for the board).
 *
 * The confidence table is additive display metadata; the balance of record is
 * always `owner_ledger_entries`. When no confidence row exists for a unit, the
 * portal simply renders the balance card as before (fail-open).
 */
import type { Express, NextFunction, Request, Response } from "express";
import { and, eq, inArray } from "drizzle-orm";
import type { AdminRole } from "@shared/schema";
import { db } from "../db";
import { ownerBalanceConfidence, ownerships, units } from "@shared/schema";
import {
  toBoardShape,
  toOwnerSafe,
} from "../services/balance-confidence-visibility";

type AdminRequest = Request & {
  adminUserId?: string;
  adminRole?: AdminRole;
};

type PortalRequest = Request & {
  portalAssociationId?: string;
  portalPersonId?: string;
};

interface ConfidenceGuards {
  requireAdmin: (req: Request, res: Response, next: NextFunction) => unknown;
  requireAdminRole: (
    roles: AdminRole[],
  ) => (req: Request, res: Response, next: NextFunction) => unknown;
  requirePortal: (req: Request, res: Response, next: NextFunction) => unknown;
  getAssociationIdQuery: (req: Request) => string | undefined;
  assertAssociationScope: (req: AdminRequest, associationId: string) => void;
}

// Same read-only role set as the rest of the read-only financial surfaces.
const CONFIDENCE_READ_ROLES: AdminRole[] = [
  "platform-admin",
  "board-officer",
  "assisted-board",
  "pm-assistant",
  "manager",
  "viewer",
];

// Owner-safe / board shapes + the board-only dispute-visibility rule live in
// server/services/balance-confidence-visibility.ts (pure + unit-tested).

export function registerBalanceConfidenceRoutes(
  app: Express,
  guards: ConfidenceGuards,
): void {
  const {
    requireAdmin,
    requireAdminRole,
    requirePortal,
    getAssociationIdQuery,
    assertAssociationScope,
  } = guards;

  // ── Owner portal — confidence for the owner's OWN units ─────────────────────
  app.get(
    "/api/portal/balance-confidence",
    requirePortal,
    async (req: PortalRequest, res: Response) => {
      try {
        if (!req.portalAssociationId || !req.portalPersonId) {
          return res.status(403).json({ message: "Not authorized" });
        }
        // The units this owner owns in this association (person-scoped — an
        // owner cannot see another owner's confidence rows).
        const ownedUnits = await db
          .select({ unitId: ownerships.unitId })
          .from(ownerships)
          .innerJoin(units, eq(ownerships.unitId, units.id))
          .where(
            and(
              eq(ownerships.personId, req.portalPersonId),
              eq(units.associationId, req.portalAssociationId),
            ),
          );
        const unitIds = Array.from(new Set(ownedUnits.map((u) => u.unitId)));
        if (unitIds.length === 0) {
          return res.json({ confidence: [] });
        }
        const rows = await db
          .select()
          .from(ownerBalanceConfidence)
          .where(
            and(
              eq(ownerBalanceConfidence.associationId, req.portalAssociationId),
              inArray(ownerBalanceConfidence.unitId, unitIds),
            ),
          );
        res.json({ confidence: rows.map(toOwnerSafe) });
      } catch (error: any) {
        res.status(500).json({ message: error.message });
      }
    },
  );

  // ── Board / treasurer — confidence for any unit in the association ──────────
  app.get(
    "/api/financial/balance-confidence",
    requireAdmin,
    requireAdminRole(CONFIDENCE_READ_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const associationId = getAssociationIdQuery(req);
        if (!associationId) {
          return res.status(400).json({ message: "associationId is required" });
        }
        assertAssociationScope(req, associationId);

        const rows = await db
          .select()
          .from(ownerBalanceConfidence)
          .where(eq(ownerBalanceConfidence.associationId, associationId));
        res.json({ confidence: rows.map(toBoardShape) });
      } catch (error: any) {
        res.status(500).json({ message: error.message });
      }
    },
  );
}
