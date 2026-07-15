/**
 * Statutory records production routes (founder-os#9483).
 *
 * The admin/PM surface for the statutory-document issuance lifecycle:
 *
 *   POST /api/statutory-records/intake        — intake a request, generate the
 *                                               packet, pin the deadline into the
 *                                               chief-of-staff queue.
 *   POST /api/statutory-records/:id/sign      — the PM's L3 sign (records the
 *                                               approval on the linked queue item).
 *   POST /api/statutory-records/:id/issue     — issue THROUGH the L3 gate (refused
 *                                               unless signed).
 *   POST /api/statutory-records/:id/reject    — the PM declines.
 *   GET  /api/statutory-records               — list (tenant-scoped).
 *   GET  /api/statutory-records/:id           — retrieve one.
 *   GET  /api/statutory-records/reminders/due — near-deadline reminder sweep.
 *
 * Generation composes the EXISTING statutory-document engines:
 *   - resale_certificate  → gatherResaleCertificateInputs (#8013, CGS §47-270)
 *   - estoppel_certificate→ buildEstoppelCertificateDocument (closing subset)
 *   - records_request     → buildRecordsRequestResponse (CGS §47-260)
 *
 * Isolation: associationId asserted against the authenticated session via
 * assertAssociationScope, never trusted from the body alone.
 */
import type { Express, NextFunction, Request, Response } from "express";
import { z } from "zod";
import { type AdminRole, type StatutoryRecordType } from "@shared/schema";
import { db } from "../db";
import { and, eq } from "drizzle-orm";
import { associations, units, persons } from "@shared/schema";
import { gatherResaleCertificateInputs } from "../services/resale-certificate";
import { buildEstoppelCertificateDocument } from "../services/estoppel-certificate-service";
import { buildRecordsRequestResponse } from "../services/records-request-response-service";
import type { ResaleCertificateLedgerEntry } from "../services/resale-certificate-service";
import { ownerLedgerEntries } from "@shared/schema";
import {
  intakeStatutoryRecord,
  signStatutoryRecord,
  issueStatutoryRecord,
  rejectStatutoryRecord,
  getStatutoryRecord,
  listStatutoryRecords,
  listStatutoryDeadlineReminders,
  StatutoryRecordError,
} from "../services/statutory-records-service";

type AdminRequest = Request & {
  adminUserId?: string;
  adminUserEmail?: string;
  adminRole?: AdminRole;
  adminScopedAssociationIds?: string[];
};

interface StatutoryRecordsGuards {
  requireAdmin: (req: Request, res: Response, next: NextFunction) => unknown;
  requireAdminRole: (roles: AdminRole[]) => (req: Request, res: Response, next: NextFunction) => unknown;
  getAssociationIdQuery: (req: Request) => string | undefined;
  assertAssociationScope: (req: AdminRequest, associationId: string) => void;
}

// Statutory records touch financials + governance + legal issuance — the PM/board
// operate them; viewer can read.
const WRITE_ROLES: AdminRole[] = ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager"];
const READ_ROLES: AdminRole[] = ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"];

const RECORD_TYPES = ["resale_certificate", "estoppel_certificate", "records_request"] as const;

const intakeSchema = z.object({
  associationId: z.string().min(1),
  recordType: z.enum(RECORD_TYPES),
  requesterName: z.string().trim().min(1),
  requesterEmail: z.string().trim().optional().nullable(),
  unitId: z.string().trim().optional().nullable(),
  personId: z.string().trim().optional().nullable(),
  receivedAt: z.coerce.date().optional(),
  expedited: z.boolean().optional(),
  // Board-supplied inputs (mirrors the resale-cert route contract).
  periodicCommonExpenseAssessment: z.number().optional(),
  reserveForCapitalExpendituresUsd: z.number().optional(),
  reserveBasis: z.string().optional().nullable(),
  transferFeeUsd: z.number().optional().nullable(),
  attestation: z.object({ boardMemberName: z.string().trim().min(1), validityDays: z.number().optional() }).optional(),
  // records_request specifics.
  recordsRequested: z.string().optional(),
  examDate1: z.coerce.date().optional().nullable(),
  examDate2: z.coerce.date().optional().nullable(),
  copyFee: z.object({ pageCount: z.number(), perPageCents: z.number().optional(), supervisionFeeCents: z.number().optional() }).optional(),
  linkedRecordsRequestId: z.string().trim().optional().nullable(),
  createdByAgent: z.string().trim().optional(),
});

const associationBodySchema = z.object({ associationId: z.string().min(1) });
const rejectSchema = z.object({ associationId: z.string().min(1), reason: z.string().trim().max(1000).optional().nullable() });

function sendError(res: Response, error: unknown): Response {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: "Invalid input", code: "INVALID_INPUT", issues: error.issues });
  }
  if (error instanceof StatutoryRecordError) {
    return res.status(error.httpStatus).json({ error: error.message, code: error.code });
  }
  // AgentActionError (re-thrown from the L3 gate) carries httpStatus + code.
  const anyErr = error as { httpStatus?: number; code?: string; message?: string };
  if (anyErr && typeof anyErr.httpStatus === "number" && typeof anyErr.code === "string") {
    return res.status(anyErr.httpStatus).json({ error: anyErr.message ?? "error", code: anyErr.code });
  }
  const message = error instanceof Error ? error.message : String(error);
  return res.status(400).json({ error: message, code: "STATUTORY_RECORD_ERROR" });
}

function signerFrom(req: AdminRequest): { adminUserId: string; email: string; role?: string | null } {
  if (!req.adminUserId) {
    throw new StatutoryRecordError("No authenticated admin identity on request", "UNAUTHENTICATED", 401);
  }
  return { adminUserId: req.adminUserId, email: req.adminUserEmail ?? "unknown", role: req.adminRole };
}

/**
 * Generate the statutory document for a record type by composing the existing
 * engines. Returns null when the tenant/unit/owner can't be resolved.
 */
async function generateDocument(
  input: z.infer<typeof intakeSchema>,
): Promise<{ documentPayload: unknown; statuteCitation: string } | null> {
  const state = "CT";
  const recordType = input.recordType as StatutoryRecordType;

  if (recordType === "resale_certificate") {
    if (input.periodicCommonExpenseAssessment == null) {
      throw new StatutoryRecordError("periodicCommonExpenseAssessment is required (§47-270(a)(2))", "VALIDATION");
    }
    if (input.reserveForCapitalExpendituresUsd == null) {
      throw new StatutoryRecordError("reserveForCapitalExpendituresUsd is required (§47-270(a)(5))", "VALIDATION");
    }
    if (!input.attestation?.boardMemberName) {
      throw new StatutoryRecordError("attestation.boardMemberName is required", "VALIDATION");
    }
    if (!input.unitId || !input.personId) {
      throw new StatutoryRecordError("unitId and personId are required for a resale certificate", "VALIDATION");
    }
    const result = await gatherResaleCertificateInputs({
      associationId: input.associationId,
      unitId: input.unitId,
      personId: input.personId,
      state,
      requestedAt: input.receivedAt,
      expedited: input.expedited,
      periodicCommonExpenseAssessment: input.periodicCommonExpenseAssessment,
      reserveForCapitalExpendituresUsd: input.reserveForCapitalExpendituresUsd,
      reserveBasis: input.reserveBasis ?? null,
      attestation: { boardMemberName: input.attestation.boardMemberName, validityDays: input.attestation.validityDays },
    });
    if (!result) return null;
    return { documentPayload: result.document, statuteCitation: result.document.statuteCitation };
  }

  if (recordType === "estoppel_certificate") {
    if (input.periodicCommonExpenseAssessment == null) {
      throw new StatutoryRecordError("periodicCommonExpenseAssessment is required", "VALIDATION");
    }
    if (!input.attestation?.boardMemberName) {
      throw new StatutoryRecordError("attestation.boardMemberName is required", "VALIDATION");
    }
    if (!input.unitId || !input.personId) {
      throw new StatutoryRecordError("unitId and personId are required for an estoppel certificate", "VALIDATION");
    }
    const [assoc] = await db
      .select({ name: associations.name })
      .from(associations)
      .where(eq(associations.id, input.associationId))
      .limit(1);
    if (!assoc) return null;
    const [unit] = await db
      .select({ unitNumber: units.unitNumber, building: units.building })
      .from(units)
      .where(and(eq(units.id, input.unitId), eq(units.associationId, input.associationId)))
      .limit(1);
    if (!unit) return null;
    const [owner] = await db
      .select({ firstName: persons.firstName, lastName: persons.lastName })
      .from(persons)
      .where(and(eq(persons.id, input.personId), eq(persons.associationId, input.associationId)))
      .limit(1);
    if (!owner) return null;
    const ledgerRows = await db
      .select({
        entryType: ownerLedgerEntries.entryType,
        amountCents: ownerLedgerEntries.amountCents,
        description: ownerLedgerEntries.description,
        referenceType: ownerLedgerEntries.referenceType,
      })
      .from(ownerLedgerEntries)
      .where(
        and(
          eq(ownerLedgerEntries.associationId, input.associationId),
          eq(ownerLedgerEntries.unitId, input.unitId),
          eq(ownerLedgerEntries.personId, input.personId),
        ),
      );
    const ownerLedger: ResaleCertificateLedgerEntry[] = ledgerRows.map((r) => ({
      entryType: r.entryType,
      amount: r.amountCents / 100,
      description: r.description,
      referenceType: r.referenceType,
    }));
    const doc = buildEstoppelCertificateDocument({
      state,
      association: { name: assoc.name },
      unit: { unitNumber: unit.unitNumber, building: unit.building },
      sellingOwnerName: `${owner.firstName} ${owner.lastName}`.trim(),
      periodicCommonExpenseAssessment: input.periodicCommonExpenseAssessment,
      ownerLedger,
      reserveForCapitalExpendituresUsd: input.reserveForCapitalExpendituresUsd ?? null,
      transferFeeUsd: input.transferFeeUsd ?? null,
      attestation: { boardMemberName: input.attestation.boardMemberName, validityDays: input.attestation.validityDays },
      generatedAt: input.receivedAt ?? new Date(),
    });
    return { documentPayload: doc, statuteCitation: doc.statuteCitation };
  }

  // records_request.
  if (!input.recordsRequested) {
    throw new StatutoryRecordError("recordsRequested is required for a records-request", "VALIDATION");
  }
  const [assoc] = await db
    .select({ name: associations.name })
    .from(associations)
    .where(eq(associations.id, input.associationId))
    .limit(1);
  if (!assoc) return null;
  const doc = buildRecordsRequestResponse({
    state,
    association: { name: assoc.name },
    requesterName: input.requesterName,
    requesterEmail: input.requesterEmail ?? null,
    recordsRequested: input.recordsRequested,
    receivedAt: input.receivedAt ?? new Date(),
    examDate1: input.examDate1 ?? null,
    examDate2: input.examDate2 ?? null,
    copyFee: input.copyFee,
    generatedAt: input.receivedAt ?? new Date(),
  });
  return { documentPayload: doc, statuteCitation: doc.statuteCitation };
}

export function registerStatutoryRecordsRoutes(app: Express, guards: StatutoryRecordsGuards): void {
  const { requireAdmin, requireAdminRole, getAssociationIdQuery, assertAssociationScope } = guards;

  // Intake: generate + persist + pin the deadline into the queue.
  app.post(
    "/api/statutory-records/intake",
    requireAdmin,
    requireAdminRole(WRITE_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const parsed = intakeSchema.parse(req.body);
        assertAssociationScope(req, parsed.associationId);
        const generated = await generateDocument(parsed);
        if (!generated) {
          return res.status(404).json({ error: "association, unit, or owner not found in this association", code: "NOT_FOUND" });
        }
        const result = await intakeStatutoryRecord({
          associationId: parsed.associationId,
          recordType: parsed.recordType as StatutoryRecordType,
          requesterName: parsed.requesterName,
          requesterEmail: parsed.requesterEmail ?? null,
          unitId: parsed.unitId ?? null,
          personId: parsed.personId ?? null,
          receivedAt: parsed.receivedAt,
          expedited: parsed.expedited,
          documentPayload: generated.documentPayload,
          createdByAgent: parsed.createdByAgent,
          linkedRecordsRequestId: parsed.linkedRecordsRequestId ?? null,
        });
        return res.status(201).json({
          record: result.record,
          agentActionId: result.agentActionId,
          deadlineAt: result.deadlineAt,
          document: generated.documentPayload,
        });
      } catch (error) {
        return sendError(res, error);
      }
    },
  );

  // Sign (the L3 PM approval).
  app.post(
    "/api/statutory-records/:id/sign",
    requireAdmin,
    requireAdminRole(WRITE_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const { associationId } = associationBodySchema.parse(req.body);
        assertAssociationScope(req, associationId);
        const updated = await signStatutoryRecord(req.params.id as string, associationId, signerFrom(req));
        return res.json({ record: updated });
      } catch (error) {
        return sendError(res, error);
      }
    },
  );

  // Issue (THROUGH the L3 gate — refused unless signed).
  app.post(
    "/api/statutory-records/:id/issue",
    requireAdmin,
    requireAdminRole(WRITE_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const { associationId } = associationBodySchema.parse(req.body);
        assertAssociationScope(req, associationId);
        const actor = signerFrom(req);
        const updated = await issueStatutoryRecord(req.params.id as string, associationId, {
          actorType: "human",
          actorId: actor.adminUserId,
          actorEmail: actor.email,
        });
        return res.json({ record: updated });
      } catch (error) {
        return sendError(res, error);
      }
    },
  );

  // Reject.
  app.post(
    "/api/statutory-records/:id/reject",
    requireAdmin,
    requireAdminRole(WRITE_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const parsed = rejectSchema.parse(req.body);
        assertAssociationScope(req, parsed.associationId);
        const updated = await rejectStatutoryRecord(
          req.params.id as string,
          parsed.associationId,
          signerFrom(req),
          parsed.reason ?? undefined,
        );
        return res.json({ record: updated });
      } catch (error) {
        return sendError(res, error);
      }
    },
  );

  // Near-deadline reminder sweep (registered BEFORE the /:id route).
  app.get(
    "/api/statutory-records/reminders/due",
    requireAdmin,
    requireAdminRole(READ_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const associationId = getAssociationIdQuery(req);
        if (!associationId) {
          return res.status(400).json({ error: "associationId query param is required", code: "INVALID_INPUT" });
        }
        assertAssociationScope(req, associationId);
        const withinDays = typeof req.query.withinDays === "string" ? Number(req.query.withinDays) : 5;
        const reminders = await listStatutoryDeadlineReminders(associationId, Number.isFinite(withinDays) ? withinDays : 5);
        return res.json({ reminders });
      } catch (error) {
        return sendError(res, error);
      }
    },
  );

  // List.
  app.get(
    "/api/statutory-records",
    requireAdmin,
    requireAdminRole(READ_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const associationId = getAssociationIdQuery(req);
        if (!associationId) {
          return res.status(400).json({ error: "associationId query param is required", code: "INVALID_INPUT" });
        }
        assertAssociationScope(req, associationId);
        const recordType = typeof req.query.recordType === "string" ? (req.query.recordType as StatutoryRecordType) : undefined;
        const records = await listStatutoryRecords(associationId, { recordType });
        return res.json({ records });
      } catch (error) {
        return sendError(res, error);
      }
    },
  );

  // Retrieve one.
  app.get(
    "/api/statutory-records/:id",
    requireAdmin,
    requireAdminRole(READ_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const associationId = getAssociationIdQuery(req);
        if (!associationId) {
          return res.status(400).json({ error: "associationId query param is required", code: "INVALID_INPUT" });
        }
        assertAssociationScope(req, associationId);
        const record = await getStatutoryRecord(req.params.id as string, associationId);
        return res.json({ record });
      } catch (error) {
        return sendError(res, error);
      }
    },
  );
}
