/**
 * Document management routes — extracted from the server/routes.ts God-file
 * (founder-os#10758, YCM audit Wave 3 — ARCH-B-001 / CQ-002).
 *
 * MOVE-ONLY, behavior-preserving: the 11 admin `/api/documents/*` handlers
 * (documents CRUD + missing-files audit + tags + versions) are relocated here
 * VERBATIM and re-wired via `registerDocumentRoutes(app, guards)`. The
 * route-inventory snapshot test proves the exposed (method, path) set is
 * byte-identical before/after this extraction.
 *
 * Single admin surface (`requireAdmin` + `requireAdminRole`), no portal routes,
 * no money/ledger path. Second domain of the staged decomposition (after
 * vendors), same injected-guards pattern as autopay.ts / admin-payments.ts.
 */

import type { Express, NextFunction, Request } from "express";
import fs from "fs";
import path from "path";
import { and, eq, inArray, ne, or, sql } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import {
  insertDocumentSchema,
  insertDocumentTagSchema,
  documents,
  documentVersions,
  auditLogs,
} from "@shared/schema";
import type { AdminRole } from "@shared/schema";
import { sendAssociationAdminEmailNotification } from "../admin-notification-service";

type AdminRequest = Request & {
  adminUserId?: string;
  adminUserEmail?: string;
  adminRole?: AdminRole;
  adminScopedAssociationIds?: string[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyMiddleware = (req: any, res: any, next: NextFunction) => any;
type RoleMiddlewareFactory = (roles: AdminRole[]) => AnyMiddleware;

// Local copies of the routes.ts pure helpers (identical bodies) — keeps this
// module free of a routes.ts import for trivial helpers.
function getParam(value: string | string[] | undefined): string {
  if (!value) return "";
  return Array.isArray(value) ? value[0] : value;
}
function escapeHtml(value: string | null | undefined): string {
  return (value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

/** Closure helpers + multer injected from routes.ts (no behavior change). */
export interface DocumentRouteGuards {
  requireAdmin: AnyMiddleware;
  requireAdminRole: RoleMiddlewareFactory;
  getAssociationIdQuery: (req: Request) => string | undefined;
  assertAssociationScope: (req: AdminRequest, associationId: string) => void;
  assertAssociationInputScope: (req: AdminRequest, associationId: string | null | undefined) => void;
  assertResourceScope: (req: AdminRequest, resourceType: string, id: string) => Promise<void>;
  upload: { single(field: string): AnyMiddleware };
  /** The multer upload directory (routes.ts's `uploadDir`) — for the
   * missing-files existence check. Injected so this module owns no env logic. */
  uploadDir: string;
}

export function registerDocumentRoutes(app: Express, guards: DocumentRouteGuards): void {
  const {
    requireAdmin,
    requireAdminRole,
    getAssociationIdQuery,
    assertAssociationScope,
    assertAssociationInputScope,
    assertResourceScope,
    upload,
    uploadDir,
  } = guards;

  app.get("/api/documents", requireAdmin, requireAdminRole(["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getDocuments(getAssociationIdQuery(req));
      // Enrich with version count and current version info
      const versionCounts = await db
        .select({ documentId: documentVersions.documentId, count: sql<number>`count(*)`, currentVersionNumber: sql<number>`max(case when ${documentVersions.isCurrent} = 1 then ${documentVersions.versionNumber} else null end)` })
        .from(documentVersions)
        .groupBy(documentVersions.documentId);
      const versionMap = new Map(versionCounts.map(v => [v.documentId, { count: Number(v.count), currentVersionNumber: v.currentVersionNumber }]));
      res.json(result.map(d => ({ ...d, versionCount: versionMap.get(d.id)?.count ?? 0, currentVersionNumber: versionMap.get(d.id)?.currentVersionNumber ?? null })));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/documents/missing-files", requireAdmin, requireAdminRole(["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager"]), async (req, res) => {
    try {
      const docs = await storage.getDocuments(getAssociationIdQuery(req));
      const missingIds: string[] = [];
      for (const doc of docs) {
        if (!doc.fileUrl) {
          missingIds.push(doc.id);
          continue;
        }
        // fileUrl is like /api/uploads/filename
        const filename = doc.fileUrl.replace(/^\/api\/uploads\//, "");
        const filePath = path.join(uploadDir, filename);
        if (!fs.existsSync(filePath)) {
          missingIds.push(doc.id);
        }
      }
      res.json({ missingIds });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/documents", requireAdmin, requireAdminRole(["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager"]), upload.single("file"), async (req: AdminRequest, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: "File is required" });
      }

      assertAssociationScope(req, String(req.body.associationId || ""));

      const parentDocumentId = req.body.parentDocumentId?.trim() || null;
      let versionNumber = 1;

      if (parentDocumentId) {
        // Validate the parent document belongs to the same association and scoped to admin
        await assertResourceScope(req, "document", parentDocumentId);
        // Find the root of the version chain — walk up to the document with no parentDocumentId
        let rootId = parentDocumentId;
        let chainDoc = await db.select().from(documents).where(eq(documents.id, parentDocumentId));
        while (chainDoc[0]?.parentDocumentId) {
          rootId = chainDoc[0].parentDocumentId;
          chainDoc = await db.select().from(documents).where(eq(documents.id, rootId));
        }
        // Fetch all documents in the chain (root + direct children) to get version numbers and ids
        const allInChain = await db.select({ id: documents.id, versionNumber: documents.versionNumber })
          .from(documents)
          .where(or(eq(documents.id, rootId), eq(documents.parentDocumentId, rootId)));
        const maxVersion = allInChain.reduce((max, d) => Math.max(max, d.versionNumber), 0);
        versionNumber = maxVersion + 1;
        const chainIds = allInChain.map((d) => d.id);
        // Mark all documents in the version chain as no longer current
        await db.update(documents).set({ isCurrentVersion: 0 })
          .where(or(eq(documents.id, rootId), eq(documents.parentDocumentId, rootId)));
        // Also clear isCurrent on all documentVersions entries for the chain documents
        if (chainIds.length > 0) {
          await db.update(documentVersions).set({ isCurrent: 0 })
            .where(inArray(documentVersions.documentId, chainIds));
        }
      }

      const effectiveDate = req.body.effectiveDate ? new Date(req.body.effectiveDate) : null;
      const amendmentNotes = req.body.amendmentNotes?.trim() || null;

      const result = await storage.createDocument({
        associationId: req.body.associationId,
        title: req.body.title,
        documentType: req.body.documentType,
        uploadedBy: req.body.uploadedBy || req.adminUserEmail || null,
        fileUrl: `/api/uploads/${file.filename}`,
        isPortalVisible: req.body.isPortalVisible === "1" || req.body.isPortalVisible === "true" ? 1 : 0,
        portalAudience: typeof req.body.portalAudience === "string" && req.body.portalAudience ? req.body.portalAudience : "owner",
        parentDocumentId,
        versionNumber,
        isCurrentVersion: 1,
      }, req.adminUserEmail);

      // Also add a documentVersions entry capturing effective date and amendment notes
      if (parentDocumentId && (effectiveDate || amendmentNotes)) {
        const existingVersions = await storage.getDocumentVersions(result.id);
        if (existingVersions.length > 0) {
          await db.update(documentVersions)
            .set({ effectiveDate, amendmentNotes })
            .where(eq(documentVersions.id, existingVersions[0].id));
        }
      }

      res.status(201).json(result);

      sendAssociationAdminEmailNotification({
        associationId: result.associationId,
        category: "documents",
        priority: "realtime",
        excludeEmails: req.adminUserEmail ? [req.adminUserEmail] : [],
        email: {
          subject: `Document added: ${result.title}`,
          html: `<p>A document has been added to the workspace.</p>
            <p><strong>Title:</strong> ${escapeHtml(result.title)}</p>
            <p><strong>Type:</strong> ${escapeHtml(result.documentType)}</p>
            <p><strong>Uploaded by:</strong> ${escapeHtml(req.adminUserEmail || "system")}</p>`,
          text: `A document has been added to the workspace.\nTitle: ${result.title}\nType: ${result.documentType}\nUploaded by: ${req.adminUserEmail || "system"}`,
          templateKey: "document-added-admin",
          metadata: {
            documentId: result.id,
            associationId: result.associationId,
            parentDocumentId: result.parentDocumentId,
          },
        },
      }).catch((error) => console.error("[documents] Failed to send document admin notification:", error));
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/documents/:id", requireAdmin, requireAdminRole(["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager"]), async (req: AdminRequest, res) => {
    try {
      await assertResourceScope(req, "document", getParam(req.params.id));
      const deleted = await storage.deleteDocument(getParam(req.params.id), req.adminUserEmail);
      if (!deleted) return res.status(404).json({ message: "Not found" });
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/documents/:id", requireAdmin, requireAdminRole(["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager"]), async (req: AdminRequest, res) => {
    try {
      await assertResourceScope(req, "document", getParam(req.params.id));
      const parsed = insertDocumentSchema.partial().parse(req.body);
      if (Object.prototype.hasOwnProperty.call(parsed, "associationId")) {
        assertAssociationInputScope(req, parsed.associationId ?? null);
      }
      const result = await storage.updateDocument(getParam(req.params.id), parsed, req.adminUserEmail);
      if (!result) return res.status(404).json({ message: "Document not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/documents/:id/tags", requireAdmin, requireAdminRole(["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "document", getParam(req.params.id));
      const result = await storage.getDocumentTags(getParam(req.params.id));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/documents/:id/tags", requireAdmin, requireAdminRole(["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager"]), async (req: AdminRequest, res) => {
    try {
      await assertResourceScope(req, "document", getParam(req.params.id));
      const parsed = insertDocumentTagSchema.parse({
        ...req.body,
        documentId: getParam(req.params.id),
      });
      const result = await storage.createDocumentTag(parsed, req.adminUserEmail);
      res.status(201).json(result);
    } catch (error: any) {
      if (error?.code === "23505") {
        return res.status(409).json({ message: "Tag already exists for this entity" });
      }
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/documents/:id/versions", requireAdmin, requireAdminRole(["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "document", getParam(req.params.id));
      const result = await storage.getDocumentVersions(getParam(req.params.id));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/documents/:id/versions", requireAdmin, requireAdminRole(["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager"]), upload.single("file"), async (req: AdminRequest, res) => {
    try {
      const documentId = getParam(req.params.id);
      await assertResourceScope(req, "document", documentId);
      const existingVersions = await storage.getDocumentVersions(documentId);
      const file = req.file;
      const title = req.body.title;
      if (!file || !title) {
        return res.status(400).json({ message: "File and title are required" });
      }
      const effectiveDate = req.body.effectiveDate ? new Date(req.body.effectiveDate) : null;
      const amendmentNotes = req.body.amendmentNotes?.trim() || null;
      const result = await storage.createDocumentVersion({
        documentId,
        versionNumber: (existingVersions[0]?.versionNumber ?? 0) + 1,
        title,
        fileUrl: `/api/uploads/${file.filename}`,
        effectiveDate,
        amendmentNotes,
        isCurrent: 1,
        uploadedBy: req.body.uploadedBy || req.adminUserEmail || null,
      }, req.adminUserEmail);
      // Mark all other versions as not current
      await db.update(documentVersions)
        .set({ isCurrent: 0 })
        .where(and(eq(documentVersions.documentId, documentId), ne(documentVersions.id, result.id)));
      res.status(201).json(result);

      const [documentRow] = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
      if (documentRow) {
        sendAssociationAdminEmailNotification({
          associationId: documentRow.associationId,
          category: "documents",
          priority: "realtime",
          excludeEmails: req.adminUserEmail ? [req.adminUserEmail] : [],
          email: {
            subject: `New document version: ${documentRow.title}`,
            html: `<p>A new version of a document has been uploaded.</p>
              <p><strong>Title:</strong> ${escapeHtml(documentRow.title)}</p>
              <p><strong>Version:</strong> ${result.versionNumber}</p>
              <p><strong>Uploaded by:</strong> ${escapeHtml(req.adminUserEmail || "system")}</p>`,
            text: `A new version of a document has been uploaded.\nTitle: ${documentRow.title}\nVersion: ${result.versionNumber}\nUploaded by: ${req.adminUserEmail || "system"}`,
            templateKey: "document-version-added-admin",
            metadata: {
              documentId,
              documentVersionId: result.id,
              associationId: documentRow.associationId,
            },
          },
        }).catch((error) => console.error("[documents] Failed to send document version admin notification:", error));
      }
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/documents/:id/versions/:versionId/set-current", requireAdmin, requireAdminRole(["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager"]), async (req: AdminRequest, res) => {
    try {
      const documentId = getParam(req.params.id);
      const versionId = getParam(req.params.versionId);
      await assertResourceScope(req, "document", documentId);
      const [doc] = await db.select().from(documents).where(eq(documents.id, documentId));
      if (!doc) return res.status(404).json({ message: "Document not found" });
      const [version] = await db.select().from(documentVersions)
        .where(and(eq(documentVersions.id, versionId), eq(documentVersions.documentId, documentId)));
      if (!version) return res.status(404).json({ message: "Version not found" });
      // Find the previously current version for the audit log
      const [prevCurrent] = await db.select().from(documentVersions)
        .where(and(eq(documentVersions.documentId, documentId), eq(documentVersions.isCurrent, 1)));
      // Clear current flag on all versions for this document
      await db.update(documentVersions).set({ isCurrent: 0 }).where(eq(documentVersions.documentId, documentId));
      // Set this version as current
      const [updated] = await db.update(documentVersions)
        .set({ isCurrent: 1 })
        .where(eq(documentVersions.id, versionId))
        .returning();
      // Log the rollback event in the audit trail
      const reason = req.body?.reason?.trim() || null;
      await db.insert(auditLogs).values({
        actorEmail: req.adminUserEmail || "system",
        action: "rollback",
        entityType: "document",
        entityId: documentId,
        associationId: doc.associationId,
        beforeJson: prevCurrent ? { versionId: prevCurrent.id, versionNumber: prevCurrent.versionNumber } : null,
        afterJson: { versionId: updated.id, versionNumber: updated.versionNumber, reason },
      });
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/documents/:id/versions/export", requireAdmin, requireAdminRole(["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const documentId = getParam(req.params.id);
      await assertResourceScope(req, "document", documentId);
      const [doc] = await db.select().from(documents).where(eq(documents.id, documentId));
      if (!doc) return res.status(404).json({ message: "Document not found" });
      const versions = await storage.getDocumentVersions(documentId);
      const format = req.query.format === "csv" ? "csv" : "json";
      if (format === "csv") {
        const lines = [
          ["Version", "Title", "Effective Date", "Amendment Notes", "Uploaded By", "Created At", "Is Current", "File URL"].join(","),
          ...versions.map(v => [
            v.versionNumber,
            `"${(v.title || "").replace(/"/g, '""')}"`,
            v.effectiveDate ? new Date(v.effectiveDate).toISOString().split("T")[0] : "",
            `"${(v.amendmentNotes || "").replace(/"/g, '""')}"`,
            `"${(v.uploadedBy || "").replace(/"/g, '""')}"`,
            new Date(v.createdAt).toISOString(),
            v.isCurrent ? "Yes" : "No",
            v.fileUrl,
          ].join(",")),
        ];
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="amendment-history-${documentId}.csv"`);
        return res.send(lines.join("\n"));
      }
      res.json({ document: { id: doc.id, title: doc.title, documentType: doc.documentType }, versions });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
}
