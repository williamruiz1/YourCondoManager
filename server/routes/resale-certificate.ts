/**
 * Connecticut resale certificate / "6(d)" routes (founder-os#8013).
 *
 * Statutory basis: Conn. Gen. Stat. §47-270 (CIOA resale certificate). The
 * association must furnish a resale certificate within 10 BUSINESS days of a
 * written request (§47-270(b)) for a $185 statutory fee (§47-270(b)(1)). A CT
 * unit cannot close a resale without it, and §47-270(c) binds the association
 * to the figures stated — so generation pulls LIVE ledger data.
 *
 * Surfaces (admin / treasurer only — all tenant-fenced via assertAssociationScope):
 *   POST /api/financial/resale-certificate/request
 *        — open a request: starts the §47-270(b) 10-business-day SLA timer +
 *          assesses the $185 statutory fee (server-computed).
 *   GET  /api/financial/resale-certificate/preview?associationId=&unitId=
 *        — live preview of the assembled certificate (no persistence).
 *   GET  /api/financial/resale-certificate/:requestId
 *        — generate the certificate for a request + persist the live snapshot,
 *          including the SLA status (business days remaining / overdue).
 *   POST /api/financial/resale-certificate/:requestId/attest
 *        — board officer signs/attests the generated certificate.
 *
 * Rendering (print view) is client-side; this server is the structured-data +
 * workflow source.
 */
import type { Express, NextFunction, Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import type { AdminRole } from "@shared/schema";
import { db } from "../db";
import { resaleCertificateRequests } from "@shared/schema";
import {
  buildResaleCertificate,
  createResaleCertificateRequest,
  generateForRequest,
} from "../services/resale-certificate";
import { businessDaysUntil } from "../services/resale-certificate-template";

type AdminRequest = Request & {
  adminUserId?: string;
  adminUserEmail?: string;
  adminRole?: AdminRole;
  adminScopedAssociationIds?: string[];
};

interface ResaleCertGuards {
  requireAdmin: (req: Request, res: Response, next: NextFunction) => unknown;
  requireAdminRole: (
    roles: AdminRole[],
  ) => (req: Request, res: Response, next: NextFunction) => unknown;
  getAssociationIdQuery: (req: Request) => string | undefined;
  assertAssociationScope: (req: AdminRequest, associationId: string) => void;
}

// Read-capable roles (preview / generate). Same set as the read-only financial
// surfaces, minus viewer for the write paths below.
const RESALE_READ_ROLES: AdminRole[] = [
  "platform-admin",
  "board-officer",
  "assisted-board",
  "pm-assistant",
  "manager",
  "viewer",
];
// Write-capable roles (open request / generate-and-persist / attest).
const RESALE_WRITE_ROLES: AdminRole[] = [
  "platform-admin",
  "board-officer",
  "assisted-board",
  "pm-assistant",
  "manager",
];

export function registerResaleCertificateRoutes(
  app: Express,
  guards: ResaleCertGuards,
): void {
  const { requireAdmin, requireAdminRole, getAssociationIdQuery, assertAssociationScope } =
    guards;

  // ── Live preview (no persistence) ──────────────────────────────────────────
  app.get(
    "/api/financial/resale-certificate/preview",
    requireAdmin,
    requireAdminRole(RESALE_READ_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const associationId = getAssociationIdQuery(req);
        if (!associationId) {
          return res.status(400).json({ message: "associationId is required" });
        }
        assertAssociationScope(req, associationId);

        const unitId =
          typeof req.query.unitId === "string" ? req.query.unitId : undefined;
        if (!unitId) {
          return res.status(400).json({ message: "unitId is required" });
        }

        const certificate = await buildResaleCertificate({ associationId, unitId });
        if (!certificate) {
          return res
            .status(404)
            .json({ message: "Unit not found in this association" });
        }
        res.json(certificate);
      } catch (error: any) {
        res.status(500).json({ message: error.message });
      }
    },
  );

  // ── Open a request (start §47-270(b) SLA + $185 fee) ───────────────────────
  app.post(
    "/api/financial/resale-certificate/request",
    requireAdmin,
    requireAdminRole(RESALE_WRITE_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const associationId =
          getAssociationIdQuery(req) ??
          (typeof req.body?.associationId === "string"
            ? req.body.associationId
            : undefined);
        if (!associationId) {
          return res.status(400).json({ message: "associationId is required" });
        }
        assertAssociationScope(req, associationId);

        const unitId =
          typeof req.body?.unitId === "string" ? req.body.unitId : undefined;
        if (!unitId) {
          return res.status(400).json({ message: "unitId is required" });
        }

        const request = await createResaleCertificateRequest({
          associationId,
          unitId,
          sellerPersonId:
            typeof req.body?.sellerPersonId === "string"
              ? req.body.sellerPersonId
              : null,
          requestedByName:
            typeof req.body?.requestedByName === "string"
              ? req.body.requestedByName
              : null,
          requestedByEmail:
            typeof req.body?.requestedByEmail === "string"
              ? req.body.requestedByEmail
              : null,
          copyFeeCents:
            typeof req.body?.copyFeeCents === "number"
              ? Math.max(0, Math.round(req.body.copyFeeCents))
              : 0,
          expediteFeeCents:
            typeof req.body?.expediteFeeCents === "number"
              ? Math.max(0, Math.round(req.body.expediteFeeCents))
              : 0,
          notes: typeof req.body?.notes === "string" ? req.body.notes : null,
        });
        if (!request) {
          return res.status(404).json({
            message: "Unit or seller not found in this association",
          });
        }
        res.status(201).json(request);
      } catch (error: any) {
        res.status(500).json({ message: error.message });
      }
    },
  );

  // ── Generate the certificate for a request (persist snapshot + SLA status) ──
  app.get(
    "/api/financial/resale-certificate/:requestId",
    requireAdmin,
    requireAdminRole(RESALE_WRITE_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const associationId = getAssociationIdQuery(req);
        if (!associationId) {
          return res.status(400).json({ message: "associationId is required" });
        }
        assertAssociationScope(req, associationId);

        const result = await generateForRequest({
          associationId,
          requestId: String(req.params.requestId),
        });
        if (!result) {
          return res
            .status(404)
            .json({ message: "Request or unit not found in this association" });
        }

        const now = new Date();
        const businessDaysRemaining = businessDaysUntil(
          now,
          new Date(result.request.slaDueAt),
        );
        res.json({
          request: result.request,
          certificate: result.certificate,
          sla: {
            // §47-270(b): 10 business days from the written request.
            dueAt: result.request.slaDueAt,
            businessDaysRemaining,
            overdue: businessDaysRemaining < 0,
            statutoryFeeCents: result.request.statutoryFeeCents,
            copyFeeCents: result.request.copyFeeCents,
            expediteFeeCents: result.request.expediteFeeCents,
            totalFeeCents:
              result.request.statutoryFeeCents +
              result.request.copyFeeCents +
              result.request.expediteFeeCents,
          },
        });
      } catch (error: any) {
        res.status(500).json({ message: error.message });
      }
    },
  );

  // ── Board attestation (§47-270 requires the association to prepare/sign) ────
  app.post(
    "/api/financial/resale-certificate/:requestId/attest",
    requireAdmin,
    requireAdminRole(RESALE_WRITE_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const associationId = getAssociationIdQuery(req);
        if (!associationId) {
          return res.status(400).json({ message: "associationId is required" });
        }
        assertAssociationScope(req, associationId);

        const attestedByName =
          typeof req.body?.attestedByName === "string"
            ? req.body.attestedByName.trim()
            : "";
        if (!attestedByName) {
          return res
            .status(400)
            .json({ message: "attestedByName is required to attest the certificate" });
        }

        const [existing] = await db
          .select()
          .from(resaleCertificateRequests)
          .where(
            and(
              eq(resaleCertificateRequests.id, String(req.params.requestId)),
              eq(resaleCertificateRequests.associationId, associationId),
            ),
          )
          .limit(1);
        if (!existing) {
          return res
            .status(404)
            .json({ message: "Request not found in this association" });
        }
        if (!existing.generatedAt) {
          return res.status(409).json({
            message: "Generate the certificate before attesting (no snapshot yet)",
          });
        }

        const now = new Date();
        const [updated] = await db
          .update(resaleCertificateRequests)
          .set({
            status: "attested",
            attestedByName,
            attestedByAdminId: req.adminUserId ?? null,
            attestedAt: now,
            updatedAt: now,
          })
          .where(eq(resaleCertificateRequests.id, existing.id))
          .returning();
        res.json(updated);
      } catch (error: any) {
        res.status(500).json({ message: error.message });
      }
    },
  );
}
