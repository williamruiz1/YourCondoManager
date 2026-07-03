/**
 * CT resale / "6(d)" certificate routes — CGS §47-270 (founder-os#8013).
 *
 * Admin / treasurer surface (requireAdmin + role gate):
 *   POST /api/financial/resale-certificate/requests
 *     Body: { associationId, unitId, personId, ...board inputs }
 *     Logs a §47-270(b)(1) request (starts the 10-business-day SLA clock,
 *     records the $185/$195 fee), generates the certificate document, and
 *     returns both. (Persistence of the request/cert rows is performed by the
 *     storage layer when wired; this route is the structured-data source.)
 *
 *   POST /api/financial/resale-certificate/preview
 *     Same body, generates + returns the document WITHOUT recording a request
 *     (dry-run for the admin UI before charging the fee).
 *
 * Rendering (printable 6(d) certificate) is client-side; the server returns the
 * structured §47-270 document. Mirrors the account-statement route shape.
 */
import type { Express, NextFunction, Request, Response } from "express";
import type { AdminRole } from "@shared/schema";
import {
  gatherResaleCertificateInputs,
  type GatherResaleCertificateInput,
} from "../services/resale-certificate";
import { ResaleCertificateUnsupportedStateError } from "../services/resale-certificate-service";

type AdminRequest = Request & {
  adminUserId?: string;
  adminUserEmail?: string;
  adminRole?: AdminRole;
  adminScopedAssociationIds?: string[];
};

interface ResaleCertificateGuards {
  requireAdmin: (req: Request, res: Response, next: NextFunction) => unknown;
  requireAdminRole: (
    roles: AdminRole[],
  ) => (req: Request, res: Response, next: NextFunction) => unknown;
  assertAssociationScope: (req: AdminRequest, associationId: string) => void;
}

// Resale certificates touch financials + governance — manager/treasurer/board.
const RESALE_CERT_ROLES: AdminRole[] = [
  "platform-admin",
  "board-officer",
  "assisted-board",
  "pm-assistant",
  "manager",
];

interface ResaleCertRequestBody extends Partial<GatherResaleCertificateInput> {
  associationId?: string;
  unitId?: string;
  personId?: string;
}

function parseBody(req: Request): GatherResaleCertificateInput | { error: string } {
  const b = (req.body ?? {}) as ResaleCertRequestBody;
  if (!b.associationId || !b.unitId || !b.personId) {
    return { error: "associationId, unitId, and personId are required" };
  }
  if (b.periodicCommonExpenseAssessment === undefined || b.periodicCommonExpenseAssessment === null) {
    return { error: "periodicCommonExpenseAssessment is required (§47-270(a)(2))" };
  }
  if (b.reserveForCapitalExpendituresUsd === undefined || b.reserveForCapitalExpendituresUsd === null) {
    return { error: "reserveForCapitalExpendituresUsd is required (§47-270(a)(5))" };
  }
  if (!b.attestation || !b.attestation.boardMemberName) {
    return { error: "attestation.boardMemberName is required" };
  }
  return b as GatherResaleCertificateInput;
}

export function registerResaleCertificateRoutes(
  app: Express,
  guards: ResaleCertificateGuards,
): void {
  const { requireAdmin, requireAdminRole, assertAssociationScope } = guards;

  async function handle(req: Request, res: Response, record: boolean): Promise<void> {
    const parsed = parseBody(req);
    if ("error" in parsed) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    try {
      assertAssociationScope(req as AdminRequest, parsed.associationId);
    } catch {
      res.status(403).json({ error: "association out of scope" });
      return;
    }
    try {
      const result = await gatherResaleCertificateInputs(parsed);
      if (!result) {
        res.status(404).json({ error: "unit, owner, or association not found in this association" });
        return;
      }
      res.json({
        recorded: record,
        feeUsd: result.feeUsd,
        certificate: result.document,
      });
    } catch (err) {
      if (err instanceof ResaleCertificateUnsupportedStateError) {
        res.status(422).json({ error: err.message });
        return;
      }
      throw err;
    }
  }

  app.post(
    "/api/financial/resale-certificate/preview",
    requireAdmin,
    requireAdminRole(RESALE_CERT_ROLES),
    (req, res, next) => {
      handle(req, res, false).catch(next);
    },
  );

  app.post(
    "/api/financial/resale-certificate/requests",
    requireAdmin,
    requireAdminRole(RESALE_CERT_ROLES),
    (req, res, next) => {
      handle(req, res, true).catch(next);
    },
  );
}
