/**
 * Vendor management routes — extracted from the server/routes.ts God-file
 * (founder-os#10758, YCM audit Wave 3 — ARCH-B-001 / CQ-002).
 *
 * MOVE-ONLY, behavior-preserving: the 8 admin `/api/vendors/*` handlers are
 * relocated here VERBATIM (bodies unchanged) and re-wired via
 * `registerVendorRoutes(app, guards)`. The route-inventory snapshot test
 * (server/routes/__tests__/route-inventory-snapshot.test.ts) proves the exposed
 * (method, path) set is byte-identical before/after this extraction.
 *
 * Single admin surface (`requireAdmin` + `requireAdminRole`), no portal routes,
 * no money/ledger path — the lowest-cross-coupling first extraction of the
 * staged decomposition (the extraction PATTERN proof for the higher-value,
 * higher-risk domains that follow).
 *
 * The scope-guard helpers (assertAssociationScope / assertResourceScope /
 * assertAssociationInputScope), the association-id query reader, the alert-cache
 * invalidator, and the multer `upload` instance are injected as `guards` so this
 * module owns no closure state from routes.ts (same pattern as autopay.ts /
 * admin-payments.ts).
 */

import type { Express, NextFunction, Request } from "express";
import { storage } from "../storage";
import { insertVendorSchema } from "@shared/schema";
import type { AdminRole } from "@shared/schema";
import { vendorComplianceStatus } from "../services/vendor-compliance";

type AdminRequest = Request & {
  adminUserId?: string;
  adminUserEmail?: string;
  adminRole?: AdminRole;
  adminScopedAssociationIds?: string[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyMiddleware = (req: any, res: any, next: NextFunction) => any;
type RoleMiddlewareFactory = (roles: AdminRole[]) => AnyMiddleware;

// Local copy of the routes.ts query-param normalizer (identical body) — keeps
// this module free of a routes.ts import for a trivial pure helper.
function getParam(value: string | string[] | undefined): string {
  if (!value) return "";
  return Array.isArray(value) ? value[0] : value;
}

/** Closure helpers + multer injected from routes.ts (no behavior change). */
export interface VendorRouteGuards {
  requireAdmin: AnyMiddleware;
  requireAdminRole: RoleMiddlewareFactory;
  getAssociationIdQuery: (req: Request) => string | undefined;
  assertAssociationScope: (req: AdminRequest, associationId: string) => void;
  assertAssociationInputScope: (req: AdminRequest, associationId: string | null | undefined) => void;
  assertResourceScope: (req: AdminRequest, resourceType: string, id: string) => Promise<void>;
  safeInvalidateAlertCache: () => void;
  upload: { single(field: string): AnyMiddleware };
}

export function registerVendorRoutes(app: Express, guards: VendorRouteGuards): void {
  const {
    requireAdmin,
    requireAdminRole,
    getAssociationIdQuery,
    assertAssociationScope,
    assertAssociationInputScope,
    assertResourceScope,
    safeInvalidateAlertCache,
    upload,
  } = guards;

  app.get("/api/vendors", requireAdmin, requireAdminRole(["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getVendors(getAssociationIdQuery(req));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/vendors/:id/metrics", requireAdmin, requireAdminRole(["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const vendorId = getParam(req.params.id);
      const allWorkOrders = await storage.getWorkOrders({});
      const vendorWOs = allWorkOrders.filter((wo) => wo.vendorId === vendorId);
      const now = Date.now();
      const closedWOs = vendorWOs.filter((wo) => wo.status === "closed");
      const openWOs = vendorWOs.filter((wo) => wo.status !== "closed" && wo.status !== "cancelled");
      const avgResolutionDays = closedWOs.length > 0
        ? Math.round(closedWOs.reduce((sum, wo) => {
            const created = new Date(wo.createdAt).getTime();
            const closed = new Date(wo.updatedAt).getTime();
            return sum + (closed - created) / (1000 * 60 * 60 * 24);
          }, 0) / closedWOs.length)
        : null;
      const byStatus: Record<string, number> = {};
      for (const wo of vendorWOs) {
        byStatus[wo.status] = (byStatus[wo.status] ?? 0) + 1;
      }
      const byPriority: Record<string, number> = {};
      for (const wo of vendorWOs) {
        const p = wo.priority || "normal";
        byPriority[p] = (byPriority[p] ?? 0) + 1;
      }
      res.json({
        totalWorkOrders: vendorWOs.length,
        openWorkOrders: openWOs.length,
        closedWorkOrders: closedWOs.length,
        avgResolutionDays,
        byStatus,
        byPriority,
        recentWorkOrders: vendorWOs
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 5)
          .map((wo) => ({ id: wo.id, title: wo.title, status: wo.status, priority: wo.priority, createdAt: wo.createdAt })),
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/vendors", requireAdmin, requireAdminRole(["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager"]), async (req, res) => {
    try {
      const parsed = insertVendorSchema.parse(req.body);
      assertAssociationScope(req as AdminRequest, parsed.associationId);
      const result = await storage.createVendor(parsed);
      safeInvalidateAlertCache(); // 15a: vendor-contract-renewal source write
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/vendors/:id", requireAdmin, requireAdminRole(["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "vendor", getParam(req.params.id));
      const parsed = insertVendorSchema.partial().parse(req.body);
      if (Object.prototype.hasOwnProperty.call(parsed, "associationId")) {
        assertAssociationInputScope(req as AdminRequest, parsed.associationId ?? null);
      }
      const result = await storage.updateVendor(getParam(req.params.id), parsed);
      if (!result) return res.status(404).json({ message: "Vendor not found" });
      safeInvalidateAlertCache(); // 15a: vendor-contract-renewal source write (status/insurance-expiry changes)
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/vendors/renewal-alerts", requireAdmin, requireAdminRole(["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getVendorRenewalAlerts(getAssociationIdQuery(req));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Vendor compliance status (W-9 / COI / insurance-expiry) — founder-os#9482.
  // Additive alongside /api/vendors and /api/vendors/renewal-alerts; does not
  // change either existing response shape.
  app.get("/api/vendors/compliance", requireAdmin, requireAdminRole(["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"]), async (req, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      const vendorRows = (await storage.getVendors(associationId)).filter((v) => v.status !== "inactive");
      const coiMap = await storage.getVendorCoiOnFileMap(vendorRows.map((v) => v.id));
      const result = vendorRows.map((vendor) => {
        const hasCurrentCoi = Boolean(coiMap[vendor.id]);
        const insuranceExpiresAt = vendor.insuranceExpiresAt ? new Date(vendor.insuranceExpiresAt) : null;
        const w9ReceivedAt = vendor.w9ReceivedAt ? new Date(vendor.w9ReceivedAt) : null;
        const { status, daysUntilExpiry, missing } = vendorComplianceStatus({
          w9ReceivedAt,
          hasCurrentCoi,
          insuranceExpiresAt,
        });
        return {
          vendorId: vendor.id,
          vendorName: vendor.name,
          associationId: vendor.associationId,
          w9ReceivedAt,
          hasCurrentCoi,
          insuranceExpiresAt,
          complianceStatus: status,
          daysUntilExpiry,
          missing,
        };
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/vendors/:id/documents", requireAdmin, requireAdminRole(["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "vendor", getParam(req.params.id));
      const result = await storage.getVendorDocuments(getParam(req.params.id));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/vendors/:id/documents", requireAdmin, requireAdminRole(["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager"]), upload.single("file"), async (req: AdminRequest, res) => {
    try {
      const vendorId = getParam(req.params.id);
      await assertResourceScope(req, "vendor", vendorId);
      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: "File is required" });
      }
      const vendorAssociationId = await storage.getAssociationIdForScopedResource("vendor", vendorId);
      if (!vendorAssociationId) {
        return res.status(404).json({ message: "Vendor not found" });
      }
      assertAssociationScope(req, vendorAssociationId);

      const result = await storage.createVendorDocument(
        vendorId,
        {
          associationId: vendorAssociationId,
          title: String(req.body.title || ""),
          documentType: String(req.body.documentType || "Vendor"),
          uploadedBy: req.body.uploadedBy || req.adminUserEmail || null,
          fileUrl: `/api/uploads/${file.filename}`,
        },
        req.adminUserEmail,
      );
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });
}
