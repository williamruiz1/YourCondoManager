/**
 * CT CGS §47-260 — owner records-request workflow routes. (founder-os#8017)
 *
 * Admin-facing endpoints to log an owner's §47-260(b) records request, offer
 * the two statutory examination dates, attach candidate records with their
 * §47-260(c)/(d) withholding classification, compute the §47-260(e) copy fee,
 * and drive the request lifecycle to fulfillment.
 *
 * Thin glue: all statutory LOGIC (response-due timing, copy fee, withholding
 * filter) lives in server/services/records-retention-service.ts and is
 * unit-tested. Multi-tenant: every query scoped by associationId.
 */

import type { Express, NextFunction, Request, Response } from "express";
import { storage } from "../storage";
// A-AUTHZ-002/004: the shared, fail-closed tenant-isolation guards. Every route
// in this module now enforces association scope (was: role-only, cross-tenant IDOR).
import {
  assertAssociationScope,
  assertAssociationInputScope,
  resolveScopedAssociationId,
} from "../lib/tenant-scope";
import {
  insertRecordsRequestSchema,
  insertRecordsRequestItemSchema,
  type AdminRole,
} from "@shared/schema";
import {
  computeResponseDueDate,
  computeCopyFeeCents,
  computeIncludedFlag,
  filterDisclosableRecords,
  type WithholdableRecord,
} from "../services/records-retention-service";

type AdminRequest = Request & {
  adminUserId?: string;
  adminUserEmail?: string;
  adminRole?: AdminRole;
  adminScopedAssociationIds?: string[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyMiddleware = (req: any, res: any, next: NextFunction) => any;
type RoleMiddlewareFactory = (roles: AdminRole[]) => AnyMiddleware;

/** Normalize an Express route/query param that this repo types as
 * `string | string[]` down to a single string. */
function p(value: string | string[] | undefined): string {
  if (!value) return "";
  return Array.isArray(value) ? value[0] : value;
}

/** Load-time scope gate for a by-id row: true iff the admin's scope includes the
 * row's association (platform-admin always true). A false result → the caller
 * responds 404 so a cross-tenant id is indistinguishable from a missing one (no
 * existence oracle). */
function inScope(req: AdminRequest, associationId: string | null | undefined): boolean {
  try {
    assertAssociationScope(req, associationId ?? "");
    return true;
  } catch {
    return false;
  }
}

/** True when an error is a tenant-scope denial (→ 403) vs a real server error. */
function isScopeError(e: unknown): boolean {
  const m = e instanceof Error ? e.message : "";
  return /outside admin scope|association is outside|associationId is required|No association scopes/i.test(m);
}

const READ_ROLES: AdminRole[] = [
  "platform-admin",
  "board-officer",
  "assisted-board",
  "pm-assistant",
  "manager",
  "viewer",
];
const WRITE_ROLES: AdminRole[] = [
  "platform-admin",
  "board-officer",
  "assisted-board",
  "pm-assistant",
  "manager",
];

export function registerRecordsRequestRoutes(
  app: Express,
  requireAdmin: AnyMiddleware,
  requireAdminRole: RoleMiddlewareFactory,
): void {
  // List records requests (optionally scoped to an association).
  app.get(
    "/api/records-requests",
    requireAdmin,
    requireAdminRole(READ_ROLES),
    async (req: AdminRequest, res: Response) => {
      // A-AUTHZ-002: scope the list. resolveScopedAssociationId validates any
      // requested associationId against the admin's scope and — for a non-platform
      // admin — never returns undefined-meaning-all-tenants.
      let associationId: string | undefined;
      try {
        associationId = resolveScopedAssociationId(req);
      } catch (e) {
        if (isScopeError(e)) { res.status(403).json({ error: "Association is outside your scope" }); return; }
        throw e;
      }
      const requests = await storage.getRecordsRequests(associationId);
      res.json(requests);
    },
  );

  // Get a single records request plus its candidate records (items).
  app.get(
    "/api/records-requests/:id",
    requireAdmin,
    requireAdminRole(READ_ROLES),
    async (req: AdminRequest, res: Response) => {
      const request = await storage.getRecordsRequest(p(req.params.id));
      if (!request || !inScope(req, request.associationId)) {
        res.status(404).json({ error: "Records request not found" });
        return;
      }
      const items = await storage.getRecordsRequestItems(request.id);
      res.json({ request, items });
    },
  );

  // Create a records request. §47-260(b): the response-due date is computed
  // server-side (receivedAt + 5 business days) — never trusted from the client.
  app.post(
    "/api/records-requests",
    requireAdmin,
    requireAdminRole(WRITE_ROLES),
    async (req: AdminRequest, res: Response) => {
      // A-AUTHZ-002: reject a client-supplied cross-tenant associationId UP FRONT
      // (before schema validation) so a non-scoped admin can never create a request
      // inside another tenant.
      try {
        assertAssociationInputScope(req, req.body?.associationId);
      } catch (e) {
        if (isScopeError(e)) { res.status(403).json({ error: "Association is outside your scope" }); return; }
        throw e;
      }
      const receivedAt = req.body?.receivedAt ? new Date(req.body.receivedAt) : new Date();
      const responseDueAt = computeResponseDueDate(receivedAt); // §47-260(b)
      const parsed = insertRecordsRequestSchema.safeParse({
        ...req.body,
        receivedAt,
        responseDueAt,
        status: req.body?.status ?? "received",
      });
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid records request", details: parsed.error.flatten() });
        return;
      }
      const created = await storage.createRecordsRequest(parsed.data, req.adminUserEmail);
      res.status(201).json(created);
    },
  );

  // Update a records request (offer exam dates, advance status, set fee, etc.).
  app.patch(
    "/api/records-requests/:id",
    requireAdmin,
    requireAdminRole(WRITE_ROLES),
    async (req: AdminRequest, res: Response) => {
      // A-AUTHZ-002: load first + assert scope BEFORE mutating (was: update by raw id).
      const existing = await storage.getRecordsRequest(p(req.params.id));
      if (!existing || !inScope(req, existing.associationId)) {
        res.status(404).json({ error: "Records request not found" });
        return;
      }
      const patch: Record<string, unknown> = { ...req.body };
      // Never let a client re-home a request into another tenant via the patch body.
      delete patch.associationId;
      if (typeof patch.receivedAt === "string") patch.receivedAt = new Date(patch.receivedAt);
      if (typeof patch.responseDueAt === "string") patch.responseDueAt = new Date(patch.responseDueAt);
      if (typeof patch.examDate1 === "string") patch.examDate1 = new Date(patch.examDate1);
      if (typeof patch.examDate2 === "string") patch.examDate2 = new Date(patch.examDate2);
      if (typeof patch.fulfilledAt === "string") patch.fulfilledAt = new Date(patch.fulfilledAt);
      const updated = await storage.updateRecordsRequest(existing.id, patch, req.adminUserEmail);
      if (!updated) {
        res.status(404).json({ error: "Records request not found" });
        return;
      }
      res.json(updated);
    },
  );

  // §47-260(e) — compute the reasonable copy fee for a request and persist it.
  app.post(
    "/api/records-requests/:id/copy-fee",
    requireAdmin,
    requireAdminRole(WRITE_ROLES),
    async (req: AdminRequest, res: Response) => {
      const request = await storage.getRecordsRequest(p(req.params.id));
      if (!request || !inScope(req, request.associationId)) {
        res.status(404).json({ error: "Records request not found" });
        return;
      }
      const pageCount = Number(req.body?.pageCount ?? 0);
      const copyFeeCents = computeCopyFeeCents({
        pageCount,
        perPageCents: req.body?.perPageCents,
        supervisionFeeCents: req.body?.supervisionFeeCents,
      });
      const updated = await storage.updateRecordsRequest(
        request.id,
        { pageCount, copyFeeCents },
        req.adminUserEmail,
      );
      res.json({ copyFeeCents, request: updated });
    },
  );

  // Attach a candidate record to a request with its §47-260(c)/(d) withholding
  // class. `included` is computed (mandatory → 0; permissive → 0 only when
  // withheld; none → 1) so the persisted flag can never contradict the statute.
  app.post(
    "/api/records-requests/:id/items",
    requireAdmin,
    requireAdminRole(WRITE_ROLES),
    async (req: AdminRequest, res: Response) => {
      const request = await storage.getRecordsRequest(p(req.params.id));
      if (!request || !inScope(req, request.associationId)) {
        res.status(404).json({ error: "Records request not found" });
        return;
      }
      const withholdingClass = req.body?.withholdingClass ?? "none";
      const included = computeIncludedFlag(withholdingClass, req.body?.permissiveWithheld === true);
      const parsed = insertRecordsRequestItemSchema.safeParse({
        ...req.body,
        requestId: request.id,
        associationId: request.associationId,
        withholdingClass,
        included,
      });
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid records request item", details: parsed.error.flatten() });
        return;
      }
      const created = await storage.createRecordsRequestItem(parsed.data);
      res.status(201).json(created);
    },
  );

  // §47-260(c)/(d) — return the disclosure partition (what the owner receives
  // vs. what is withheld, with the statutory reason class) for a request.
  app.get(
    "/api/records-requests/:id/disclosure",
    requireAdmin,
    requireAdminRole(READ_ROLES),
    async (req: AdminRequest, res: Response) => {
      const request = await storage.getRecordsRequest(p(req.params.id));
      if (!request || !inScope(req, request.associationId)) {
        res.status(404).json({ error: "Records request not found" });
        return;
      }
      const items = await storage.getRecordsRequestItems(request.id);
      const candidates: WithholdableRecord[] = items.map((item) => ({
        id: item.id,
        label: item.label,
        recordType: item.recordType,
        withholdingClass: item.withholdingClass,
        permissiveWithheld: item.withholdingClass === "permissive" && item.included === 0,
      }));
      const { disclosed, withheld } = filterDisclosableRecords(candidates);
      res.json({ disclosed, withheld });
    },
  );
}
