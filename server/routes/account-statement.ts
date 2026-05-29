/**
 * Owner account-statement routes (readiness P0-3 / Issue #206).
 *
 * Two surfaces, one computation engine (server/services/account-statement.ts):
 *
 *   Owner portal (requirePortal — owner views their OWN statement):
 *     GET /api/portal/statement?from=&to=[&unitId=]
 *     - associationId + personId resolved from the portal session (NEVER from
 *       the query — an owner cannot request someone else's statement).
 *     - optional unitId narrows to one of the owner's units.
 *
 *   Admin / treasurer (requireAdmin — generate for any owner):
 *     GET /api/financial/owner-ledger/statement?associationId=&personId=&from=&to=[&unitId=]
 *     - associationId is tenant-fenced via assertAssociationScope.
 *
 * Both return the same `AccountStatementWithHeader` JSON. Rendering (print-CSS
 * statement view) is client-side; the server is the structured-data source.
 */
import type { Express, NextFunction, Request, Response } from "express";
import type { AdminRole } from "@shared/schema";
import {
  buildAccountStatement,
  parsePeriodBounds,
} from "../services/account-statement";

type AdminRequest = Request & {
  adminUserId?: string;
  adminUserEmail?: string;
  adminRole?: AdminRole;
  adminScopedAssociationIds?: string[];
};

type PortalRequest = Request & {
  portalAccessId?: string;
  portalAssociationId?: string;
  portalPersonId?: string;
  portalUnitId?: string | null;
};

interface StatementGuards {
  requireAdmin: (req: Request, res: Response, next: NextFunction) => unknown;
  requireAdminRole: (
    roles: AdminRole[],
  ) => (req: Request, res: Response, next: NextFunction) => unknown;
  requirePortal: (req: Request, res: Response, next: NextFunction) => unknown;
  getAssociationIdQuery: (req: Request) => string | undefined;
  assertAssociationScope: (req: AdminRequest, associationId: string) => void;
}

// Read-only statement view — same role set as the rest of the read-only
// financial surfaces (entries / summary).
const STATEMENT_READ_ROLES: AdminRole[] = [
  "platform-admin",
  "board-officer",
  "assisted-board",
  "pm-assistant",
  "manager",
  "viewer",
];

export function registerAccountStatementRoutes(
  app: Express,
  guards: StatementGuards,
): void {
  const {
    requireAdmin,
    requireAdminRole,
    requirePortal,
    getAssociationIdQuery,
    assertAssociationScope,
  } = guards;

  // ── Owner portal — own statement ───────────────────────────────────────────
  app.get(
    "/api/portal/statement",
    requirePortal,
    async (req: PortalRequest, res: Response) => {
      try {
        if (!req.portalAssociationId || !req.portalPersonId) {
          return res.status(403).json({ message: "Not authorized" });
        }
        const bounds = parsePeriodBounds(
          typeof req.query.from === "string" ? req.query.from : undefined,
          typeof req.query.to === "string" ? req.query.to : undefined,
        );
        if (!bounds) {
          return res.status(400).json({
            message: "from and to are required (yyyy-mm-dd) and from must be <= to",
          });
        }

        // Owner may narrow to one of THEIR units. We don't independently verify
        // the unit belongs to the owner here because the ledger query is
        // already person-scoped — a unitId the owner doesn't own simply yields
        // zero matching entries (no data leak).
        const unitId =
          typeof req.query.unitId === "string" && req.query.unitId.length > 0
            ? req.query.unitId
            : null;

        const statement = await buildAccountStatement({
          associationId: req.portalAssociationId,
          personId: req.portalPersonId,
          unitId,
          from: bounds.from,
          to: bounds.to,
        });
        if (!statement) {
          return res.status(404).json({ message: "Statement unavailable" });
        }
        res.json(statement);
      } catch (error: any) {
        res.status(500).json({ message: error.message });
      }
    },
  );

  // ── Admin / treasurer — statement for any owner ────────────────────────────
  app.get(
    "/api/financial/owner-ledger/statement",
    requireAdmin,
    requireAdminRole(STATEMENT_READ_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const associationId = getAssociationIdQuery(req);
        if (!associationId) {
          return res.status(400).json({ message: "associationId is required" });
        }
        assertAssociationScope(req, associationId);

        const personId =
          typeof req.query.personId === "string" ? req.query.personId : undefined;
        if (!personId) {
          return res.status(400).json({ message: "personId is required" });
        }

        const bounds = parsePeriodBounds(
          typeof req.query.from === "string" ? req.query.from : undefined,
          typeof req.query.to === "string" ? req.query.to : undefined,
        );
        if (!bounds) {
          return res.status(400).json({
            message: "from and to are required (yyyy-mm-dd) and from must be <= to",
          });
        }

        const unitId =
          typeof req.query.unitId === "string" && req.query.unitId.length > 0
            ? req.query.unitId
            : null;

        const statement = await buildAccountStatement({
          associationId,
          personId,
          unitId,
          from: bounds.from,
          to: bounds.to,
        });
        if (!statement) {
          // person not in this association → 404 (don't confirm existence
          // across tenants).
          return res
            .status(404)
            .json({ message: "Owner not found in this association" });
        }
        res.json(statement);
      } catch (error: any) {
        res.status(500).json({ message: error.message });
      }
    },
  );
}
