import type { Express, NextFunction, Request, Response } from "express";
import { type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { registerAuthRoutes } from "./auth";
import {
  getEmailLog,
  getEmailLogs,
  getEmailPolicy,
  getEmailProviderStatus,
  getTrackingPixelBuffer,
  handleEmailClickTracking,
  handleEmailOpenTracking,
  purgeTrackingData,
  verifyEmailConnection,
} from "./email-provider";
import {
  insertAdminUserSchema,
  insertAdminAssociationScopeSchema,
  insertAiIngestionJobSchema,
  insertClauseTagSchema,
  insertSuggestedLinkSchema,
  insertAnalysisRunSchema,
  insertAnalysisVersionSchema,
  insertExecutiveEvidenceSchema,
  insertExecutiveUpdateSchema,
  insertAssociationSchema,
  insertBuildingSchema,
  insertBoardRoleSchema,
  insertDocumentSchema,
  insertDocumentTagSchema,
  insertAnnualGovernanceTaskSchema,
  insertCalendarEventSchema,
  insertExpenseAttachmentSchema,
  insertBudgetLineSchema,
  insertBudgetSchema,
  insertBudgetVersionSchema,
  insertFinancialAccountSchema,
  insertFinancialCategorySchema,
  insertGovernanceComplianceTemplateSchema,
  insertGovernanceMeetingSchema,
  insertGovernanceTemplateItemSchema,
  insertMeetingAgendaItemSchema,
  insertMeetingNoteSchema,
  insertHoaFeeScheduleSchema,
  insertOwnerLedgerEntrySchema,
  insertOccupancySchema,
  insertOwnershipSchema,
  insertPersonSchema,
  insertRoadmapTaskSchema,
  insertRoadmapWorkstreamSchema,
  insertRoadmapProjectSchema,
  insertLateFeeRuleSchema,
  insertNoticeTemplateSchema,
  insertPortalAccessSchema,
  insertAssociationMembershipSchema,
  insertTenantConfigSchema,
  insertContactUpdateRequestSchema,
  insertMaintenanceRequestSchema,
  insertPermissionEnvelopeSchema,
  insertResolutionSchema,
  insertSpecialAssessmentSchema,
  insertUnitSchema,
  insertUtilityPaymentSchema,
  insertPaymentMethodConfigSchema,
  insertVendorInvoiceSchema,
  insertVoteRecordSchema,
} from "@shared/schema";

const uploadDir = path.resolve("uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const TEXT_PARSEABLE_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".csv",
  ".tsv",
  ".json",
  ".log",
  ".html",
  ".htm",
  ".xml",
  ".eml",
]);

const ADMIN_API_KEY = (process.env.ADMIN_API_KEY || "").trim();
const isPublishedState = process.env.NODE_ENV === "production";

function getParam(value: string | string[] | undefined): string {
  if (!value) return "";
  return Array.isArray(value) ? value[0] : value;
}

function getAssociationIdQuery(req: Request): string | undefined {
  const requested = typeof req.query.associationId === "string" ? req.query.associationId : undefined;
  const adminReq = req as AdminRequest;

  if (!isPublishedState || !adminReq.adminRole || adminReq.adminRole === "platform-admin") {
    return requested;
  }

  const scopedAssociationIds = adminReq.adminScopedAssociationIds ?? [];
  if (requested) {
    if (!scopedAssociationIds.includes(requested)) {
      throw new Error("Requested association is outside admin scope");
    }
    return requested;
  }

  if (scopedAssociationIds.length === 0) {
    throw new Error("No association scopes assigned to this admin");
  }
  if (scopedAssociationIds.length === 1) {
    return scopedAssociationIds[0];
  }

  throw new Error("associationId is required for multi-association scoped admins");
}

function getIncludeArchivedQuery(req: Request): boolean {
  if (typeof req.query.includeArchived !== "string") return false;
  const value = req.query.includeArchived.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

function parseBooleanLike(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes") return true;
  if (normalized === "0" || normalized === "false" || normalized === "no") return false;
  return fallback;
}

type AssociationSearchResult = {
  source: "openstreetmap";
  displayName: string;
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
};

function normalizeAssociationSearchResult(item: any): AssociationSearchResult {
  const addressParts = item?.address ?? {};
  const name =
    String(item?.namedetails?.name || item?.name || "").trim() ||
    String(item?.display_name || "").split(",")[0]?.trim() ||
    "Unknown Association";
  const houseNumber = typeof addressParts.house_number === "string" ? addressParts.house_number.trim() : "";
  const road = typeof addressParts.road === "string" ? addressParts.road.trim() : "";
  const address = [houseNumber, road].filter(Boolean).join(" ").trim() || String(item?.display_name || "").split(",").slice(1, 3).join(", ").trim() || "Address unavailable";
  const city =
    String(addressParts.city || addressParts.town || addressParts.village || addressParts.suburb || "").trim() ||
    "Unknown";
  const state = String(addressParts.state || addressParts.region || "").trim() || "Unknown";
  const country = String(addressParts.country || "").trim() || "USA";
  const latitude = Number.isFinite(Number(item?.lat)) ? Number(item.lat) : null;
  const longitude = Number.isFinite(Number(item?.lon)) ? Number(item.lon) : null;

  return {
    source: "openstreetmap",
    displayName: String(item?.display_name || "").trim() || name,
    name,
    address,
    city,
    state,
    country,
    latitude,
    longitude,
  };
}

function isNonEmptyText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validateExecutiveSlidePayload(payload: Record<string, unknown>, options: { partial: boolean }) {
  const sourceKey = typeof payload.sourceKey === "string" ? payload.sourceKey : "";
  const isSlide = sourceKey.startsWith("slide:");
  if (!isSlide) return;

  const missing: string[] = [];

  if (options.partial) {
    if ("problemStatement" in payload && !isNonEmptyText(payload.problemStatement)) {
      missing.push("problemStatement");
    }
    if ("solutionSummary" in payload && !isNonEmptyText(payload.solutionSummary)) {
      missing.push("solutionSummary");
    }
    if ("featuresDelivered" in payload) {
      const list = payload.featuresDelivered;
      const validList =
        Array.isArray(list) &&
        list.length > 0 &&
        list.every((item) => typeof item === "string" && item.trim().length > 0);
      if (!validList) missing.push("featuresDelivered");
    }
  } else {
    if (!isNonEmptyText(payload.problemStatement)) missing.push("problemStatement");
    if (!isNonEmptyText(payload.solutionSummary)) missing.push("solutionSummary");
    const featuresDelivered = payload.featuresDelivered;
    const validFeatures =
      Array.isArray(featuresDelivered) &&
      featuresDelivered.length > 0 &&
      featuresDelivered.every((item) => typeof item === "string" && item.trim().length > 0);
    if (!validFeatures) missing.push("featuresDelivered");
  }

  if (missing.length > 0) {
    throw new Error(`slide:* updates require valid ${missing.join(", ")}`);
  }
}

type AdminRole = "platform-admin" | "board-admin" | "manager" | "viewer";
type AdminRequest = Request & {
  adminUserId?: string;
  adminUserEmail?: string;
  adminRole?: AdminRole;
  adminScopedAssociationIds?: string[];
};
type PortalRequest = Request & { portalAccessId?: string; portalAssociationId?: string; portalPersonId?: string; portalEmail?: string };
type AiIngestionRolloutMode = "disabled" | "canary" | "full";

function normalizeAiIngestionRolloutMode(value: unknown): AiIngestionRolloutMode {
  return value === "disabled" || value === "canary" || value === "full" ? value : "full";
}

async function applyAdminContext(req: AdminRequest, adminUser: { id: string; email: string; role: string }) {
  if (adminUser.role !== "platform-admin") {
    const scopes = await storage.getAdminAssociationScopesByUserId(adminUser.id);
    req.adminScopedAssociationIds = scopes.map((scope) => scope.associationId);
  } else {
    req.adminScopedAssociationIds = [];
  }
  req.adminUserId = adminUser.id;
  req.adminUserEmail = adminUser.email;
  req.adminRole = adminUser.role as AdminRole;
}

async function tryHydrateAdminFromSession(req: AdminRequest): Promise<boolean> {
  const authUser = req.user as { id?: string; adminUserId?: string | null; email?: string | null } | undefined;
  if (req.isAuthenticated?.() && authUser) {
    const adminUser = authUser.adminUserId
      ? await storage.getAdminUserById(authUser.adminUserId)
      : (authUser.email ? await storage.getAdminUserByEmail(authUser.email) : undefined);
    if (adminUser && adminUser.isActive === 1) {
      await applyAdminContext(req, adminUser);
      return true;
    }
  }

  const serializedAuthUserId = (req.session as { passport?: { user?: string } } | undefined)?.passport?.user;
  if (!serializedAuthUserId) return false;
  const sessionAuthUser = await storage.getAuthUserById(String(serializedAuthUserId));
  if (!sessionAuthUser || sessionAuthUser.isActive !== 1) return false;

  if (!req.user && req.login) {
    await new Promise<void>((resolve, reject) => {
      req.login!(sessionAuthUser as Express.User, (error) => {
        if (error) return reject(error);
        return resolve();
      });
    });
  }

  const adminUser = sessionAuthUser.adminUserId
    ? await storage.getAdminUserById(sessionAuthUser.adminUserId)
    : await storage.getAdminUserByEmail(sessionAuthUser.email);
  if (!adminUser || adminUser.isActive !== 1) return false;

  await applyAdminContext(req, adminUser);
  return true;
}

function normalizeAiIngestionCanaryPercent(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 100;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function hashToPercent(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) % 9973;
  }
  return hash % 100;
}

function evaluateAiIngestionRollout(input: {
  mode: AiIngestionRolloutMode;
  canaryPercent: number;
  fingerprint: string;
}): { allowed: boolean; bucket: number; reason: string } {
  if (input.mode === "full") return { allowed: true, bucket: 0, reason: "Rollout mode is full." };
  if (input.mode === "disabled") return { allowed: false, bucket: 100, reason: "AI ingestion rollout is currently disabled for this association." };
  const bucket = hashToPercent(input.fingerprint);
  const allowed = bucket < input.canaryPercent;
  return {
    allowed,
    bucket,
    reason: allowed
      ? `Canary bucket ${bucket} is within ${input.canaryPercent}% rollout.`
      : `Canary bucket ${bucket} exceeds ${input.canaryPercent}% rollout.`,
  };
}

async function requireAdmin(req: AdminRequest, res: Response, next: NextFunction) {
  if (await tryHydrateAdminFromSession(req)) {
    return next();
  }

  const adminUserEmail = (req.header("x-admin-user-email") || "").trim().toLowerCase();

  if (!ADMIN_API_KEY) {
    if (process.env.NODE_ENV !== "production" && adminUserEmail) {
      const adminUser = await storage.getAdminUserByEmail(adminUserEmail);
      if (adminUser && adminUser.isActive === 1) {
        await applyAdminContext(req, adminUser);
        req.adminUserEmail = adminUserEmail;
        return next();
      }
    }
    return res.status(403).json({ message: "Admin access required" });
  }

  const providedKey = req.header("x-admin-api-key");
  if (!providedKey || providedKey !== ADMIN_API_KEY) {
    return res.status(403).json({ message: "Admin access required" });
  }
  if (!adminUserEmail) {
    return res.status(403).json({ message: "Admin access required" });
  }
  const adminUser = await storage.getAdminUserByEmail(adminUserEmail);
  if (!adminUser || adminUser.isActive !== 1) {
    return res.status(403).json({ message: "Inactive or unknown admin user" });
  }
  await applyAdminContext(req, adminUser);
  req.adminUserEmail = adminUserEmail;
  return next();
}

function assertAssociationScope(req: AdminRequest, associationId: string) {
  if (!isPublishedState) return;
  if (req.adminRole === "platform-admin") return;
  const scopedAssociationIds = req.adminScopedAssociationIds ?? [];
  if (!associationId) {
    throw new Error("associationId is required");
  }
  if (!scopedAssociationIds.includes(associationId)) {
    throw new Error("Association is outside admin scope");
  }
}

function assertAssociationInputScope(req: AdminRequest, associationId: string | null | undefined) {
  if (!isPublishedState || req.adminRole === "platform-admin") return;
  if (!associationId) {
    throw new Error("associationId is required");
  }
  assertAssociationScope(req, associationId);
}

async function assertResourceScope(req: AdminRequest, resourceType: string, id: string) {
  if (!isPublishedState || req.adminRole === "platform-admin") return;
  const associationId = await storage.getAssociationIdForScopedResource(resourceType, id);
  if (!associationId) return;
  assertAssociationScope(req, associationId);
}

function requireAdminRole(roles: AdminRole[]) {
  return (req: AdminRequest, res: Response, next: NextFunction) => {
    if (!req.adminRole || !roles.includes(req.adminRole)) {
      return res.status(403).json({ message: "Insufficient admin role" });
    }
    return next();
  };
}

async function requirePortal(req: PortalRequest, res: Response, next: NextFunction) {
  const portalAccessId = req.header("x-portal-access-id") || "";
  if (!portalAccessId) return res.status(403).json({ message: "Portal access required" });
  const access = await storage.getPortalAccessById(portalAccessId);
  if (!access || access.status !== "active") {
    return res.status(403).json({ message: "Invalid or inactive portal access" });
  }
  req.portalAccessId = access.id;
  req.portalAssociationId = access.associationId;
  req.portalPersonId = access.personId;
  req.portalEmail = access.email;
  await storage.touchPortalAccessLogin(access.id);
  return next();
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  registerAuthRoutes(app);

  app.get("/api/dashboard/stats", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (_req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/associations", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getAssociations({ includeArchived: getIncludeArchivedQuery(req) });
      const adminReq = req as AdminRequest;
      const scopedResult = adminReq.adminRole === "platform-admin"
        ? result
        : result.filter((association) => (adminReq.adminScopedAssociationIds ?? []).includes(association.id));
      res.json(scopedResult);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/associations/search", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const query = typeof req.query.query === "string" ? req.query.query.trim() : "";
      if (query.length < 3) {
        return res.status(400).json({ message: "query must be at least 3 characters" });
      }

      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("q", `${query} condominium`);
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("addressdetails", "1");
      url.searchParams.set("namedetails", "1");
      url.searchParams.set("limit", "8");
      url.searchParams.set("countrycodes", "us");

      const response = await fetch(url.toString(), {
        headers: {
          "User-Agent": "CondoManager/1.0 (association-search)",
          "Accept-Language": "en-US,en",
        },
      });
      if (!response.ok) {
        return res.status(502).json({ message: "Directory search failed" });
      }

      const payload = await response.json();
      const rows = Array.isArray(payload) ? payload : [];
      const results = rows
        .map(normalizeAssociationSearchResult)
        .filter((row) => row.name !== "Unknown Association");

      res.json({ results });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/associations", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const parsed = insertAssociationSchema.parse(req.body);
      const result = await storage.createAssociation(parsed, req.adminUserEmail);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/associations/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      assertAssociationScope(req, getParam(req.params.id));
      const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
      const parsed = insertAssociationSchema.partial().parse({
        ...body,
        archivedAt:
          body.archivedAt == null
            ? body.archivedAt
            : body.archivedAt instanceof Date
              ? body.archivedAt
              : new Date(String(body.archivedAt)),
      });
      if (Object.keys(parsed).length === 0) {
        return res.status(400).json({ message: "No association fields provided" });
      }
      const result = await storage.updateAssociation(getParam(req.params.id), parsed, req.adminUserEmail);
      if (!result) return res.status(404).json({ message: "Not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/associations/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      assertAssociationScope(req, getParam(req.params.id));
      const deleted = await storage.deleteAssociation(getParam(req.params.id), req.adminUserEmail);
      if (!deleted) return res.status(404).json({ message: "Not found" });
      res.status(204).send();
    } catch (error: any) {
      const message = String(error?.message || "");
      if (message.startsWith("Cannot delete association with linked")) {
        return res.status(409).json({ message, code: "ASSOCIATION_DELETE_BLOCKED" });
      }
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/associations/:id/archive", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      assertAssociationScope(req, getParam(req.params.id));
      const result = await storage.updateAssociation(
        getParam(req.params.id),
        { isArchived: 1, archivedAt: new Date() },
        req.adminUserEmail,
      );
      if (!result) return res.status(404).json({ message: "Not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/associations/:id/restore", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      assertAssociationScope(req, getParam(req.params.id));
      const result = await storage.updateAssociation(
        getParam(req.params.id),
        { isArchived: 0, archivedAt: null },
        req.adminUserEmail,
      );
      if (!result) return res.status(404).json({ message: "Not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/buildings", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getBuildings(getAssociationIdQuery(req));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/buildings", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const parsed = insertBuildingSchema.parse(req.body);
      assertAssociationScope(req, parsed.associationId);
      const result = await storage.createBuilding(parsed, req.adminUserEmail);
      res.status(201).json(result);
    } catch (error: any) {
      if (error?.code === "23505") {
        return res.status(409).json({ message: "Building name already exists for this association" });
      }
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/buildings/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const buildingId = getParam(req.params.id);
      const existing = await storage.getBuildingById(buildingId);
      if (!existing) return res.status(404).json({ message: "Building not found" });
      assertAssociationScope(req, existing.associationId);

      const parsed = insertBuildingSchema.partial().parse(req.body);
      if (parsed.associationId) {
        assertAssociationScope(req, parsed.associationId);
      }

      const result = await storage.updateBuilding(buildingId, parsed, req.adminUserEmail);
      if (!result) return res.status(404).json({ message: "Building not found" });
      res.json(result);
    } catch (error: any) {
      if (error?.code === "23505") {
        return res.status(409).json({ message: "Building name already exists for this association" });
      }
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/units", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getUnits(getAssociationIdQuery(req));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/units", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const parsed = insertUnitSchema.parse(req.body);
      assertAssociationScope(req, parsed.associationId);
      const result = await storage.createUnit(parsed, req.adminUserEmail);
      res.status(201).json(result);
    } catch (error: any) {
      if (error?.code === "23505") {
        return res.status(409).json({ message: "Unit number already exists in this building" });
      }
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/units/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const unitId = getParam(req.params.id);
      const existing = await storage.getUnitById(unitId);
      if (!existing) return res.status(404).json({ message: "Not found" });
      assertAssociationScope(req, existing.associationId);

      const parsed = insertUnitSchema.partial().parse(req.body);
      if (parsed.associationId) {
        assertAssociationScope(req, parsed.associationId);
      }

      const result = await storage.updateUnit(unitId, parsed, req.adminUserEmail);
      if (!result) return res.status(404).json({ message: "Not found" });
      res.json(result);
    } catch (error: any) {
      if (error?.code === "23505") {
        return res.status(409).json({ message: "Unit number already exists in this building" });
      }
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/units/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const unitId = getParam(req.params.id);
      const existing = await storage.getUnitById(unitId);
      if (!existing) return res.status(404).json({ message: "Not found" });
      assertAssociationScope(req, existing.associationId);

      const deleted = await storage.deleteUnit(unitId, req.adminUserEmail);
      if (!deleted) return res.status(404).json({ message: "Not found" });
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/units/:id/history", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const unitId = getParam(req.params.id);
      const existing = await storage.getUnitById(unitId);
      if (!existing) return res.status(404).json({ message: "Not found" });
      assertAssociationScope(req, existing.associationId);

      const result = await storage.getUnitChangeHistory(unitId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/persons", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getPersons(getAssociationIdQuery(req));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/persons", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const parsed = insertPersonSchema.parse(req.body);
      const result = await storage.createPerson(parsed, req.adminUserEmail);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/persons/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const parsed = insertPersonSchema.partial().parse(req.body);
      const result = await storage.updatePerson(getParam(req.params.id), parsed, req.adminUserEmail);
      if (!result) return res.status(404).json({ message: "Not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/persons/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const deleted = await storage.deletePerson(getParam(req.params.id), req.adminUserEmail);
      if (!deleted) return res.status(404).json({ message: "Not found" });
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/ownerships", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getOwnerships(getAssociationIdQuery(req));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/ownerships", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const parsed = insertOwnershipSchema.parse(req.body);
      const result = await storage.createOwnership(parsed, req.adminUserEmail);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/ownerships/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const parsed = insertOwnershipSchema.partial().parse(req.body);
      const result = await storage.updateOwnership(getParam(req.params.id), parsed, req.adminUserEmail);
      if (!result) return res.status(404).json({ message: "Not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/owners/bulk-update", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
      if (!rows || rows.length === 0) {
        return res.status(400).json({ message: "rows must be a non-empty array" });
      }

      const results: Array<{ ownershipId: string; personId: string; status: "updated" | "skipped"; message?: string }> = [];
      for (const row of rows) {
        if (!row || typeof row !== "object") {
          throw new Error("Each bulk update row must be an object.");
        }
        const ownershipId = typeof row.ownershipId === "string" ? row.ownershipId : "";
        const personId = typeof row.personId === "string" ? row.personId : "";
        if (!ownershipId || !personId) {
          throw new Error("Each bulk update row must include ownershipId and personId.");
        }

        const personPatch = insertPersonSchema.partial().parse({
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email,
          phone: row.phone,
          mailingAddress: row.mailingAddress,
        });
        const ownershipPatch = insertOwnershipSchema.partial().parse({
          ownershipPercentage: row.ownershipPercentage,
          startDate: row.startDate,
          endDate: row.endDate,
        });

        const hasPersonPatch = Object.keys(personPatch).length > 0;
        const hasOwnershipPatch = Object.keys(ownershipPatch).length > 0;
        if (!hasPersonPatch && !hasOwnershipPatch) {
          results.push({ ownershipId, personId, status: "skipped", message: "No changes supplied." });
          continue;
        }

        if (hasPersonPatch) {
          const person = await storage.updatePerson(personId, personPatch, req.adminUserEmail);
          if (!person) {
            throw new Error(`Person not found for ownership ${ownershipId}.`);
          }
        }
        if (hasOwnershipPatch) {
          const ownership = await storage.updateOwnership(ownershipId, ownershipPatch, req.adminUserEmail);
          if (!ownership) {
            throw new Error(`Ownership not found: ${ownershipId}.`);
          }
        }
        results.push({ ownershipId, personId, status: "updated" });
      }

      res.json({ updatedCount: results.filter((row) => row.status === "updated").length, results });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/ownerships/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const deleted = await storage.deleteOwnership(getParam(req.params.id), req.adminUserEmail);
      if (!deleted) return res.status(404).json({ message: "Not found" });
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/occupancies", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getOccupancies(getAssociationIdQuery(req));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/occupancies", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const parsed = insertOccupancySchema.parse(req.body);
      const result = await storage.createOccupancy(parsed, req.adminUserEmail);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/occupancies/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const deleted = await storage.deleteOccupancy(getParam(req.params.id), req.adminUserEmail);
      if (!deleted) return res.status(404).json({ message: "Not found" });
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/residential/dataset", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getResidentialDataset(getAssociationIdQuery(req));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/board-roles", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getBoardRoles(getAssociationIdQuery(req));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/board-roles", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const parsed = insertBoardRoleSchema.parse(req.body);
      assertAssociationScope(req, parsed.associationId);
      const result = await storage.createBoardRole(parsed, req.adminUserEmail);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/board-roles/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      await assertResourceScope(req, "board-role", getParam(req.params.id));
      const deleted = await storage.deleteBoardRole(getParam(req.params.id), req.adminUserEmail);
      if (!deleted) return res.status(404).json({ message: "Not found" });
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/documents", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getDocuments(getAssociationIdQuery(req));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/documents", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), upload.single("file"), async (req: AdminRequest, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: "File is required" });
      }

      assertAssociationScope(req, String(req.body.associationId || ""));
      const result = await storage.createDocument({
        associationId: req.body.associationId,
        title: req.body.title,
        documentType: req.body.documentType,
        uploadedBy: req.body.uploadedBy || req.adminUserEmail || null,
        fileUrl: `/api/uploads/${file.filename}`,
      }, req.adminUserEmail);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/documents/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      await assertResourceScope(req, "document", getParam(req.params.id));
      const deleted = await storage.deleteDocument(getParam(req.params.id), req.adminUserEmail);
      if (!deleted) return res.status(404).json({ message: "Not found" });
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/documents/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
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

  app.get("/api/documents/:id/tags", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "document", getParam(req.params.id));
      const result = await storage.getDocumentTags(getParam(req.params.id));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/documents/:id/tags", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
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

  app.get("/api/documents/:id/versions", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "document", getParam(req.params.id));
      const result = await storage.getDocumentVersions(getParam(req.params.id));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/documents/:id/versions", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), upload.single("file"), async (req: AdminRequest, res) => {
    try {
      const documentId = getParam(req.params.id);
      await assertResourceScope(req, "document", documentId);
      const existingVersions = await storage.getDocumentVersions(documentId);
      const file = req.file;
      const title = req.body.title;
      if (!file || !title) {
        return res.status(400).json({ message: "File and title are required" });
      }
      const result = await storage.createDocumentVersion({
        documentId,
        versionNumber: (existingVersions[0]?.versionNumber ?? 0) + 1,
        title,
        fileUrl: `/api/uploads/${file.filename}`,
        uploadedBy: req.body.uploadedBy || req.adminUserEmail || null,
      }, req.adminUserEmail);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/audit-logs", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getAuditLogs(getAssociationIdQuery(req));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/uploads/:filename", async (req, res) => {
    try {
      const filename = getParam(req.params.filename);
      const filePath = path.join(uploadDir, filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "File not found" });
      }

      const providedAdminKey = req.header("x-admin-api-key");
      if (providedAdminKey && ADMIN_API_KEY && providedAdminKey === ADMIN_API_KEY) {
        const adminUserEmail = (req.header("x-admin-user-email") || "").trim().toLowerCase();
        if (adminUserEmail) {
          const adminUser = await storage.getAdminUserByEmail(adminUserEmail);
          if (adminUser && adminUser.isActive === 1) {
            return res.sendFile(filePath);
          }
        }
      }

      const portalAccessId = req.header("x-portal-access-id") || "";
      if (!portalAccessId) {
        return res.status(403).json({ message: "Upload access requires admin or portal credentials" });
      }

      const portalAccess = await storage.getPortalAccessById(portalAccessId);
      if (!portalAccess || portalAccess.status !== "active") {
        return res.status(403).json({ message: "Portal access required" });
      }

      const fileUrl = `/api/uploads/${filename}`;
      const portalDocs = await storage.getPortalDocuments(portalAccess.id);
      const directMatch = portalDocs.some((doc) => doc.fileUrl === fileUrl);
      if (directMatch) {
        return res.sendFile(filePath);
      }

      const versionLists = await Promise.all(portalDocs.map((doc) => storage.getDocumentVersions(doc.id)));
      const versionMatch = versionLists.some((versions) => versions.some((version) => version.fileUrl === fileUrl));
      if (versionMatch) {
        return res.sendFile(filePath);
      }

      return res.status(403).json({ message: "File is not visible for this portal access" });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/financial/fee-schedules", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getHoaFeeSchedules(getAssociationIdQuery(req));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/financial/fee-schedules", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const parsed = insertHoaFeeScheduleSchema.parse(req.body);
      assertAssociationInputScope(req as AdminRequest, parsed.associationId);
      const result = await storage.createHoaFeeSchedule(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/financial/fee-schedules/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "hoa-fee-schedule", getParam(req.params.id));
      const parsed = insertHoaFeeScheduleSchema.partial().parse(req.body);
      if (Object.prototype.hasOwnProperty.call(parsed, "associationId")) {
        assertAssociationInputScope(req as AdminRequest, parsed.associationId ?? null);
      }
      const result = await storage.updateHoaFeeSchedule(getParam(req.params.id), parsed);
      if (!result) return res.status(404).json({ message: "Fee schedule not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/financial/assessments", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getSpecialAssessments(getAssociationIdQuery(req));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/financial/assessments", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const parsed = insertSpecialAssessmentSchema.parse(req.body);
      assertAssociationInputScope(req as AdminRequest, parsed.associationId);
      const result = await storage.createSpecialAssessment(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/financial/assessments/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "special-assessment", getParam(req.params.id));
      const parsed = insertSpecialAssessmentSchema.partial().parse(req.body);
      if (Object.prototype.hasOwnProperty.call(parsed, "associationId")) {
        assertAssociationInputScope(req as AdminRequest, parsed.associationId ?? null);
      }
      const result = await storage.updateSpecialAssessment(getParam(req.params.id), parsed);
      if (!result) return res.status(404).json({ message: "Assessment not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/financial/late-fee-rules", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getLateFeeRules(getAssociationIdQuery(req));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/financial/late-fee-rules", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const parsed = insertLateFeeRuleSchema.parse(req.body);
      assertAssociationInputScope(req as AdminRequest, parsed.associationId);
      const result = await storage.createLateFeeRule(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/financial/late-fee-rules/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "late-fee-rule", getParam(req.params.id));
      const parsed = insertLateFeeRuleSchema.partial().parse(req.body);
      if (Object.prototype.hasOwnProperty.call(parsed, "associationId")) {
        assertAssociationInputScope(req as AdminRequest, parsed.associationId ?? null);
      }
      const result = await storage.updateLateFeeRule(getParam(req.params.id), parsed);
      if (!result) return res.status(404).json({ message: "Late fee rule not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/financial/late-fee-events", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getLateFeeEvents(getAssociationIdQuery(req));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/financial/late-fees/calculate", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const associationId = getParam(req.body.associationId);
      assertAssociationScope(req as AdminRequest, associationId);
      const ruleId = getParam(req.body.ruleId);
      const balanceAmount = Number(req.body.balanceAmount);
      const dueDate = new Date(req.body.dueDate);
      const asOfDate = new Date(req.body.asOfDate);
      const apply = Boolean(req.body.apply);
      if (!associationId || !ruleId || !Number.isFinite(balanceAmount) || Number.isNaN(dueDate.getTime()) || Number.isNaN(asOfDate.getTime())) {
        return res.status(400).json({ message: "associationId, ruleId, balanceAmount, dueDate, and asOfDate are required" });
      }
      const result = await storage.calculateLateFee({
        associationId,
        ruleId,
        balanceAmount,
        dueDate,
        asOfDate,
        referenceType: req.body.referenceType ?? null,
        referenceId: req.body.referenceId ?? null,
        apply,
      });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/financial/accounts", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getFinancialAccounts(getAssociationIdQuery(req));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/financial/accounts", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const parsed = insertFinancialAccountSchema.parse(req.body);
      assertAssociationScope(req as AdminRequest, parsed.associationId);
      const result = await storage.createFinancialAccount(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/financial/accounts/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "financial-account", getParam(req.params.id));
      const parsed = insertFinancialAccountSchema.partial().parse(req.body);
      if (Object.prototype.hasOwnProperty.call(parsed, "associationId")) {
        assertAssociationInputScope(req as AdminRequest, parsed.associationId ?? null);
      }
      const result = await storage.updateFinancialAccount(getParam(req.params.id), parsed);
      if (!result) return res.status(404).json({ message: "Account not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/financial/categories", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getFinancialCategories(getAssociationIdQuery(req));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/financial/categories", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const parsed = insertFinancialCategorySchema.parse(req.body);
      assertAssociationScope(req as AdminRequest, parsed.associationId);
      const result = await storage.createFinancialCategory(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/financial/categories/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "financial-category", getParam(req.params.id));
      const parsed = insertFinancialCategorySchema.partial().parse(req.body);
      if (Object.prototype.hasOwnProperty.call(parsed, "associationId")) {
        assertAssociationInputScope(req as AdminRequest, parsed.associationId ?? null);
      }
      const result = await storage.updateFinancialCategory(getParam(req.params.id), parsed);
      if (!result) return res.status(404).json({ message: "Category not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/financial/budgets", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getBudgets(getAssociationIdQuery(req));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/financial/budgets", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const parsed = insertBudgetSchema.parse(req.body);
      assertAssociationScope(req as AdminRequest, parsed.associationId);
      const result = await storage.createBudget(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/financial/budgets/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "budget", getParam(req.params.id));
      const parsed = insertBudgetSchema.partial().parse(req.body);
      if (Object.prototype.hasOwnProperty.call(parsed, "associationId")) {
        assertAssociationInputScope(req as AdminRequest, parsed.associationId ?? null);
      }
      const result = await storage.updateBudget(getParam(req.params.id), parsed);
      if (!result) return res.status(404).json({ message: "Budget not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/financial/budgets/:budgetId/versions", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "budget", getParam(req.params.budgetId));
      const result = await storage.getBudgetVersions(getParam(req.params.budgetId));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/financial/budget-versions", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const parsed = insertBudgetVersionSchema.parse(req.body);
      await assertResourceScope(req as AdminRequest, "budget", parsed.budgetId);
      const result = await storage.createBudgetVersion(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/financial/budget-versions/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "budget-version", getParam(req.params.id));
      const parsed = insertBudgetVersionSchema.partial().parse(req.body);
      const result = await storage.updateBudgetVersion(getParam(req.params.id), parsed);
      if (!result) return res.status(404).json({ message: "Budget version not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/financial/budget-versions/:budgetVersionId/lines", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "budget-version", getParam(req.params.budgetVersionId));
      const result = await storage.getBudgetLines(getParam(req.params.budgetVersionId));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/financial/budget-lines", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const parsed = insertBudgetLineSchema.parse(req.body);
      await assertResourceScope(req as AdminRequest, "budget-version", parsed.budgetVersionId);
      const result = await storage.createBudgetLine(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/financial/budget-lines/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "budget-line", getParam(req.params.id));
      const parsed = insertBudgetLineSchema.partial().parse(req.body);
      const result = await storage.updateBudgetLine(getParam(req.params.id), parsed);
      if (!result) return res.status(404).json({ message: "Budget line not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/financial/budgets/:associationId/variance/:budgetVersionId", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      assertAssociationScope(req as AdminRequest, getParam(req.params.associationId));
      const result = await storage.getBudgetVariance(
        getParam(req.params.associationId),
        getParam(req.params.budgetVersionId),
      );
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/financial/invoices", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getVendorInvoices(getAssociationIdQuery(req));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/financial/invoices", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const parsed = insertVendorInvoiceSchema.parse(req.body);
      assertAssociationScope(req as AdminRequest, parsed.associationId);
      const result = await storage.createVendorInvoice(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/financial/invoices/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "vendor-invoice", getParam(req.params.id));
      const parsed = insertVendorInvoiceSchema.partial().parse(req.body);
      if (Object.prototype.hasOwnProperty.call(parsed, "associationId")) {
        assertAssociationInputScope(req as AdminRequest, parsed.associationId ?? null);
      }
      const result = await storage.updateVendorInvoice(getParam(req.params.id), parsed);
      if (!result) return res.status(404).json({ message: "Invoice not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/financial/utilities", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getUtilityPayments(getAssociationIdQuery(req));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/financial/utilities", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const parsed = insertUtilityPaymentSchema.parse(req.body);
      assertAssociationScope(req as AdminRequest, parsed.associationId);
      const result = await storage.createUtilityPayment(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/financial/utilities/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "utility-payment", getParam(req.params.id));
      const parsed = insertUtilityPaymentSchema.partial().parse(req.body);
      if (Object.prototype.hasOwnProperty.call(parsed, "associationId")) {
        assertAssociationInputScope(req as AdminRequest, parsed.associationId ?? null);
      }
      const result = await storage.updateUtilityPayment(getParam(req.params.id), parsed);
      if (!result) return res.status(404).json({ message: "Utility payment not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/financial/payment-methods", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getPaymentMethodConfigs(getAssociationIdQuery(req));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/financial/payment-methods", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const parsed = insertPaymentMethodConfigSchema.parse(req.body);
      assertAssociationScope(req as AdminRequest, parsed.associationId);
      const result = await storage.createPaymentMethodConfig(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/financial/payment-methods/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "payment-method-config", getParam(req.params.id));
      const parsed = insertPaymentMethodConfigSchema.partial().parse(req.body);
      if (Object.prototype.hasOwnProperty.call(parsed, "associationId")) {
        assertAssociationInputScope(req as AdminRequest, parsed.associationId ?? null);
      }
      const result = await storage.updatePaymentMethodConfig(getParam(req.params.id), parsed);
      if (!result) return res.status(404).json({ message: "Payment method config not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/financial/payment-gateway/connections", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getPaymentGatewayConnections(getAssociationIdQuery(req));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/financial/payment-gateway/validate", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const associationId = getParam(req.body.associationId);
      assertAssociationScope(req as AdminRequest, associationId);
      const providerRaw = typeof req.body.provider === "string" ? req.body.provider : "";
      const provider = providerRaw === "stripe" || providerRaw === "other" ? providerRaw : null;
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      if (!provider) return res.status(400).json({ message: "provider must be stripe or other" });

      const result = await storage.validateAndUpsertPaymentGatewayConnection({
        associationId,
        provider,
        providerAccountId: typeof req.body.providerAccountId === "string" ? req.body.providerAccountId : null,
        publishableKey: typeof req.body.publishableKey === "string" ? req.body.publishableKey : null,
        secretKey: typeof req.body.secretKey === "string" ? req.body.secretKey : null,
        webhookSecret: typeof req.body.webhookSecret === "string" ? req.body.webhookSecret : null,
        isActive: parseBooleanLike(req.body.isActive, true),
        metadataJson: req.body.metadataJson && typeof req.body.metadataJson === "object" ? req.body.metadataJson : null,
      });
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/financial/owner-payment-links", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getParam(req.body.associationId);
      assertAssociationScope(req, associationId);
      const unitId = getParam(req.body.unitId);
      const personId = getParam(req.body.personId);
      if (!associationId || !unitId || !personId) {
        return res.status(400).json({ message: "associationId, unitId, and personId are required" });
      }

      const amountRaw = req.body.amount;
      const amount = amountRaw == null || amountRaw === "" ? null : Number(amountRaw);
      if (amount != null && (!Number.isFinite(amount) || amount <= 0)) {
        return res.status(400).json({ message: "amount must be a positive number" });
      }

      const expiresAtRaw = req.body.expiresAt;
      const expiresAt = typeof expiresAtRaw === "string" && expiresAtRaw.trim().length > 0 ? new Date(expiresAtRaw) : null;
      if (expiresAt && Number.isNaN(expiresAt.getTime())) {
        return res.status(400).json({ message: "expiresAt must be a valid date string" });
      }

      const result = await storage.createOwnerPaymentLink({
        associationId,
        unitId,
        personId,
        amount,
        currency: typeof req.body.currency === "string" ? req.body.currency : null,
        allowPartial: parseBooleanLike(req.body.allowPartial, false),
        memo: typeof req.body.memo === "string" ? req.body.memo : null,
        expiresAt,
        createdBy: req.adminUserEmail || null,
        metadataJson: req.body.metadataJson && typeof req.body.metadataJson === "object" ? req.body.metadataJson : null,
      });
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/portal/payments/link/:token", async (req, res) => {
    try {
      const token = getParam(req.params.token);
      if (!token) return res.status(400).json({ message: "token is required" });
      const link = await storage.getOwnerPaymentLinkByToken(token);
      if (!link) return res.status(404).json({ message: "Payment link not found" });
      res.json(link);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/webhooks/payments", async (req, res) => {
    try {
      const webhookSharedSecret = process.env.PAYMENT_WEBHOOK_SHARED_SECRET;
      if (webhookSharedSecret) {
        const provided = req.header("x-payment-webhook-secret");
        if (!provided || provided !== webhookSharedSecret) {
          return res.status(403).json({ message: "Invalid webhook secret" });
        }
      }

      const associationId = getParam(req.body.associationId);
      const providerRaw = typeof req.body.provider === "string" ? req.body.provider : "";
      const provider = providerRaw === "stripe" || providerRaw === "other" ? providerRaw : null;
      const providerEventId = getParam(req.body.providerEventId);
      if (!associationId || !provider || !providerEventId) {
        return res.status(400).json({ message: "associationId, provider, and providerEventId are required" });
      }

      const statusRaw = typeof req.body.status === "string" ? req.body.status : null;
      const status = statusRaw === "succeeded" || statusRaw === "failed" || statusRaw === "pending" ? statusRaw : null;
      const amountRaw = req.body.amount;
      const amount = amountRaw == null || amountRaw === "" ? null : Number(amountRaw);
      if (amount != null && !Number.isFinite(amount)) {
        return res.status(400).json({ message: "amount must be numeric when provided" });
      }

      const result = await storage.processPaymentWebhookEvent({
        associationId,
        provider,
        providerEventId,
        eventType: typeof req.body.eventType === "string" ? req.body.eventType : null,
        status,
        amount,
        currency: typeof req.body.currency === "string" ? req.body.currency : null,
        personId: typeof req.body.personId === "string" ? req.body.personId : null,
        unitId: typeof req.body.unitId === "string" ? req.body.unitId : null,
        paymentLinkToken: typeof req.body.paymentLinkToken === "string" ? req.body.paymentLinkToken : null,
        gatewayReference: typeof req.body.gatewayReference === "string" ? req.body.gatewayReference : null,
        rawPayloadJson: req.body,
      });

      res.status(result.duplicate ? 200 : 201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/financial/payment-instructions/send", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getParam(req.body.associationId);
      assertAssociationScope(req, associationId);
      const audience = req.body?.audience;
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      if (audience && audience !== "owners" && audience !== "occupants" && audience !== "all") {
        return res.status(400).json({ message: "audience must be owners, occupants, or all" });
      }
      const scheduledForRaw = req.body.scheduledFor;
      const scheduledFor =
        typeof scheduledForRaw === "string" && scheduledForRaw.trim().length > 0
          ? new Date(scheduledForRaw)
          : null;
      if (scheduledFor && Number.isNaN(scheduledFor.getTime())) {
        return res.status(400).json({ message: "scheduledFor must be a valid date string" });
      }
      const result = await storage.sendPaymentInstructionNotice({
        associationId,
        templateId: req.body.templateId || null,
        subject: req.body.subject || null,
        body: req.body.body || null,
        audience: audience || "owners",
        ccOwners: Boolean(req.body.ccOwners),
        requireApproval: Boolean(req.body.requireApproval),
        scheduledFor,
        sentBy: req.adminUserEmail || null,
      });
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/financial/expense-attachments", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const expenseType = typeof req.query.expenseType === "string" ? req.query.expenseType : undefined;
      const expenseId = typeof req.query.expenseId === "string" ? req.query.expenseId : undefined;
      const result = await storage.getExpenseAttachments(
        expenseType === "invoice" || expenseType === "utility-payment" ? expenseType : undefined,
        expenseId,
        getAssociationIdQuery(req),
      );
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/financial/expense-attachments", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), upload.single("file"), async (req: AdminRequest, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: "File is required" });
      }
      const parsed = insertExpenseAttachmentSchema.parse({
        associationId: req.body.associationId,
        expenseType: req.body.expenseType,
        expenseId: req.body.expenseId,
        title: req.body.title,
        fileUrl: `/api/uploads/${file.filename}`,
        uploadedBy: req.body.uploadedBy || req.adminUserEmail || null,
      });
      assertAssociationScope(req, parsed.associationId);
      const result = await storage.createExpenseAttachment(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/financial/owner-ledger/entries", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getOwnerLedgerEntries(getAssociationIdQuery(req));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/financial/owner-ledger/entries", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const parsed = insertOwnerLedgerEntrySchema.parse(req.body);
      assertAssociationScope(req as AdminRequest, parsed.associationId);
      const result = await storage.createOwnerLedgerEntry(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/financial/owner-ledger/summary/:associationId", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      assertAssociationScope(req as AdminRequest, getParam(req.params.associationId));
      const result = await storage.getOwnerLedgerSummary(getParam(req.params.associationId));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/governance/meetings", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getGovernanceMeetings(getAssociationIdQuery(req));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/governance/meetings", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const parsed = insertGovernanceMeetingSchema.parse(req.body);
      assertAssociationScope(req as AdminRequest, parsed.associationId);
      const result = await storage.createGovernanceMeeting(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/governance/meetings/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "governance-meeting", getParam(req.params.id));
      const parsed = insertGovernanceMeetingSchema.partial().parse(req.body);
      if (Object.prototype.hasOwnProperty.call(parsed, "associationId")) {
        assertAssociationInputScope(req as AdminRequest, parsed.associationId ?? null);
      }
      const result = await storage.updateGovernanceMeeting(getParam(req.params.id), parsed);
      if (!result) return res.status(404).json({ message: "Meeting not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/governance/meetings/:id/agenda-items", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "governance-meeting", getParam(req.params.id));
      const result = await storage.getMeetingAgendaItems(getParam(req.params.id));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/governance/meetings/:id/agenda-items", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "governance-meeting", getParam(req.params.id));
      const parsed = insertMeetingAgendaItemSchema.parse({
        ...req.body,
        meetingId: getParam(req.params.id),
      });
      const result = await storage.createMeetingAgendaItem(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/governance/meetings/:id/notes", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "governance-meeting", getParam(req.params.id));
      const result = await storage.getMeetingNotes(getParam(req.params.id));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/governance/meetings/:id/notes", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      await assertResourceScope(req, "governance-meeting", getParam(req.params.id));
      const parsed = insertMeetingNoteSchema.parse({
        ...req.body,
        meetingId: getParam(req.params.id),
        createdBy: req.body.createdBy || req.adminUserEmail || null,
      });
      const result = await storage.createMeetingNote(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/governance/meeting-notes/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "meeting-note", getParam(req.params.id));
      const parsed = insertMeetingNoteSchema.partial().parse(req.body);
      const result = await storage.updateMeetingNote(getParam(req.params.id), parsed);
      if (!result) return res.status(404).json({ message: "Meeting note not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/governance/resolutions", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getResolutions(getAssociationIdQuery(req));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/governance/resolutions", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const parsed = insertResolutionSchema.parse(req.body);
      assertAssociationScope(req as AdminRequest, parsed.associationId);
      const result = await storage.createResolution(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/governance/resolutions/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "resolution", getParam(req.params.id));
      const parsed = insertResolutionSchema.partial().parse(req.body);
      if (Object.prototype.hasOwnProperty.call(parsed, "associationId")) {
        assertAssociationInputScope(req as AdminRequest, parsed.associationId ?? null);
      }
      const result = await storage.updateResolution(getParam(req.params.id), parsed);
      if (!result) return res.status(404).json({ message: "Resolution not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/governance/resolutions/:id/votes", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "resolution", getParam(req.params.id));
      const result = await storage.getVoteRecords(getParam(req.params.id));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/governance/resolutions/:id/votes", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "resolution", getParam(req.params.id));
      const parsed = insertVoteRecordSchema.parse({
        ...req.body,
        resolutionId: getParam(req.params.id),
      });
      const result = await storage.createVoteRecord(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/governance/calendar/events", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getCalendarEvents(getAssociationIdQuery(req));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/governance/calendar/events", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const parsed = insertCalendarEventSchema.parse(req.body);
      assertAssociationScope(req as AdminRequest, parsed.associationId);
      const result = await storage.createCalendarEvent(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/governance/calendar/events/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "calendar-event", getParam(req.params.id));
      const parsed = insertCalendarEventSchema.partial().parse(req.body);
      if (Object.prototype.hasOwnProperty.call(parsed, "associationId")) {
        assertAssociationInputScope(req as AdminRequest, parsed.associationId ?? null);
      }
      const result = await storage.updateCalendarEvent(getParam(req.params.id), parsed);
      if (!result) return res.status(404).json({ message: "Calendar event not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/governance/templates", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getGovernanceComplianceTemplates(getAssociationIdQuery(req));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/governance/templates", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const parsed = insertGovernanceComplianceTemplateSchema.parse({
        ...req.body,
        createdBy: req.body.createdBy || req.adminUserEmail || null,
      });
      if (!parsed.associationId && req.adminRole !== "platform-admin") {
        throw new Error("associationId is required for scoped admins");
      }
      if (parsed.associationId) {
        assertAssociationScope(req, parsed.associationId);
      }
      const result = await storage.createGovernanceComplianceTemplate(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/governance/templates/:templateId/items", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "governance-template", getParam(req.params.templateId));
      const result = await storage.getGovernanceTemplateItems(getParam(req.params.templateId));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/governance/templates/:templateId/items", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "governance-template", getParam(req.params.templateId));
      const parsed = insertGovernanceTemplateItemSchema.parse({
        ...req.body,
        templateId: getParam(req.params.templateId),
      });
      const result = await storage.createGovernanceTemplateItem(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/governance/tasks", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getAnnualGovernanceTasks(getAssociationIdQuery(req));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/governance/tasks", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const parsed = insertAnnualGovernanceTaskSchema.parse(req.body);
      assertAssociationScope(req as AdminRequest, parsed.associationId);
      const result = await storage.createAnnualGovernanceTask(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/governance/tasks/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "annual-governance-task", getParam(req.params.id));
      const parsed = insertAnnualGovernanceTaskSchema.partial().parse(req.body);
      if (Object.prototype.hasOwnProperty.call(parsed, "associationId")) {
        assertAssociationInputScope(req as AdminRequest, parsed.associationId ?? null);
      }
      const result = await storage.updateAnnualGovernanceTask(getParam(req.params.id), parsed);
      if (!result) return res.status(404).json({ message: "Governance task not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/governance/tasks/generate", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const associationId = getParam(req.body.associationId);
      assertAssociationScope(req as AdminRequest, associationId);
      const templateId = getParam(req.body.templateId);
      const year = Number(req.body.year);
      const ownerPersonId = req.body.ownerPersonId ? getParam(req.body.ownerPersonId) : null;
      if (!associationId || !templateId || !Number.isInteger(year)) {
        return res.status(400).json({ message: "associationId, templateId and year are required" });
      }
      const result = await storage.generateAnnualGovernanceTasksFromTemplate({
        associationId,
        templateId,
        year,
        ownerPersonId,
      });
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/ai/ingestion/jobs", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getAiIngestionJobs(getAssociationIdQuery(req));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/ai/ingestion/runtime-status", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (_req, res) => {
    const aiConfigured = Boolean(process.env.OPENAI_API_KEY || process.env.AI_API_KEY);
    res.json({
      aiConfigured,
      provider: aiConfigured ? "openai" : "fallback",
      model: aiConfigured ? (process.env.OPENAI_INGESTION_MODEL || "gpt-4o-mini") : null,
    });
  });

  app.get("/api/ai/ingestion/monitoring", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const windowDaysRaw = typeof req.query.windowDays === "string" ? Number(req.query.windowDays) : undefined;
      const windowDays = Number.isFinite(windowDaysRaw) ? Math.max(1, Math.min(90, Math.round(windowDaysRaw!))) : 14;
      const result = await storage.getAiIngestionMonitoring(windowDays);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/ai/ingestion/rollout-policy", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const associationId = typeof req.query.associationId === "string" ? req.query.associationId : "";
      assertAssociationInputScope(req as AdminRequest, associationId || null);
      if (!associationId) return res.status(400).json({ message: "associationId is required." });
      const config = await storage.getTenantConfig(associationId);
      const mode = normalizeAiIngestionRolloutMode(config?.aiIngestionRolloutMode);
      const canaryPercent = normalizeAiIngestionCanaryPercent(config?.aiIngestionCanaryPercent);
      res.json({
        associationId,
        mode,
        canaryPercent,
        notes: config?.aiIngestionRolloutNotes ?? "",
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/ai/ingestion/rollout-policy", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const associationId = typeof req.body.associationId === "string" ? req.body.associationId : "";
      assertAssociationInputScope(req, associationId || null);
      if (!associationId) return res.status(400).json({ message: "associationId is required." });
      const existing = await storage.getTenantConfig(associationId);
      const mode = normalizeAiIngestionRolloutMode(req.body.mode);
      const canaryPercent = normalizeAiIngestionCanaryPercent(req.body.canaryPercent);
      const notes = typeof req.body.notes === "string" ? req.body.notes.trim() : "";
      const updated = await storage.upsertTenantConfig({
        associationId,
        portalName: existing?.portalName ?? "Owner Portal",
        supportEmail: existing?.supportEmail ?? null,
        allowContactUpdates: existing?.allowContactUpdates ?? 1,
        ownerDocumentVisibility: existing?.ownerDocumentVisibility ?? "owner-safe",
        gmailIntegrationStatus: existing?.gmailIntegrationStatus ?? "not-configured",
        defaultNoticeFooter: existing?.defaultNoticeFooter ?? null,
        aiIngestionRolloutMode: mode,
        aiIngestionCanaryPercent: canaryPercent,
        aiIngestionRolloutNotes: notes || null,
      });
      res.json({
        associationId,
        mode: normalizeAiIngestionRolloutMode(updated.aiIngestionRolloutMode),
        canaryPercent: normalizeAiIngestionCanaryPercent(updated.aiIngestionCanaryPercent),
        notes: updated.aiIngestionRolloutNotes ?? "",
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/ai/ingestion/jobs", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), upload.single("file"), async (req: AdminRequest, res) => {
    try {
      const sourceText = typeof req.body.sourceText === "string" ? req.body.sourceText.trim() : "";
      const contextNotes = typeof req.body.contextNotes === "string" ? req.body.contextNotes.trim() : "";
      const fileExt = req.file ? path.extname(req.file.originalname).toLowerCase() : "";
      const fileIsTextParseable = req.file ? TEXT_PARSEABLE_EXTENSIONS.has(fileExt) : false;

      if (!req.file && !sourceText) {
        return res.status(400).json({ message: "Upload a file or paste source text." });
      }

      if (req.file && !fileIsTextParseable && !sourceText) {
        return res.status(400).json({
          message: `File type '${fileExt || "unknown"}' is not yet directly parseable. Paste extracted text in Source Text or upload a txt/md/csv/tsv/json/log/html/xml/eml file.`,
        });
      }

      const sourceType = req.file ? "file-upload" : "pasted-text";
      const parsed = insertAiIngestionJobSchema.parse({
        associationId: req.body.associationId || null,
        sourceType,
        sourceFilename: req.file?.originalname ?? null,
        sourceText: sourceText || null,
        contextNotes: contextNotes || null,
      });
      if (parsed.associationId) {
        const tenantConfig = await storage.getTenantConfig(parsed.associationId);
        const rolloutMode = normalizeAiIngestionRolloutMode(tenantConfig?.aiIngestionRolloutMode);
        const canaryPercent = normalizeAiIngestionCanaryPercent(tenantConfig?.aiIngestionCanaryPercent);
        const fingerprint = [
          parsed.associationId,
          parsed.sourceFilename ?? "",
          parsed.sourceText?.slice(0, 120) ?? "",
          contextNotes,
          req.adminUserEmail ?? "",
        ].join("|");
        const rolloutDecision = evaluateAiIngestionRollout({
          mode: rolloutMode,
          canaryPercent,
          fingerprint,
        });
        if (!rolloutDecision.allowed) {
          return res.status(409).json({
            message: `Ingestion blocked by rollout policy. ${rolloutDecision.reason}`,
            rollout: {
              mode: rolloutMode,
              canaryPercent,
              bucket: rolloutDecision.bucket,
            },
          });
        }
      }
      const result = await storage.createAiIngestionJob({
        ...parsed,
        sourceFileUrl: req.file ? `/api/uploads/${req.file.filename}` : null,
        submittedBy: req.adminUserEmail || null,
      });
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/ai/ingestion/jobs/:id/process", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "ai-ingestion-job", getParam(req.params.id));
      const result = await storage.processAiIngestionJob(getParam(req.params.id));
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/ai/ingestion/jobs/:id/records", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "ai-ingestion-job", getParam(req.params.id));
      const result = await storage.getAiExtractedRecords(getParam(req.params.id));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/ai/ingestion/records/:id/review", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      await assertResourceScope(req, "ai-extracted-record", getParam(req.params.id));
      const status = req.body?.reviewStatus;
      if (status !== "approved" && status !== "rejected") {
        return res.status(400).json({ message: "reviewStatus must be approved or rejected" });
      }
      const importMode = req.body?.importMode === "preview" ? "preview" : "commit";
      if (status === "approved" && importMode === "preview") {
        const current = await storage.getAiExtractedRecordById(getParam(req.params.id));
        if (!current) return res.status(404).json({ message: "Record not found" });
        const importSummary = await storage.importApprovedAiExtractedRecord(current.id, req.adminUserEmail || undefined, {
          mode: "preview",
          payloadOverride: req.body?.payloadJson,
        });
        await storage.createAiIngestionImportRun({
          ingestionJobId: current.jobId,
          extractedRecordId: current.id,
          associationId: current.associationId ?? null,
          mode: "preview",
          targetModule: importSummary.targetModule,
          runStatus: importSummary.imported ? "preview-success" : "preview-noop",
          summaryJson: importSummary,
          createdEntityRefsJson: {
            vendorInvoiceIds: importSummary.createdVendorInvoiceIds,
            ownerLedgerEntryIds: importSummary.createdOwnerLedgerEntryIds,
          },
          actorEmail: req.adminUserEmail || null,
          errorMessage: null,
        });
        return res.json({ ...current, importSummary });
      }

      const result = await storage.reviewAiExtractedRecord(getParam(req.params.id), {
        reviewStatus: status,
        payloadJson: req.body?.payloadJson,
        reviewedBy: req.adminUserEmail || null,
      });
      if (!result) return res.status(404).json({ message: "Record not found" });
      const importSummary = status === "approved"
        ? await storage.importApprovedAiExtractedRecord(result.id, req.adminUserEmail || undefined, { mode: "commit" })
        : null;
      if (importSummary) {
        await storage.createAiIngestionImportRun({
          ingestionJobId: result.jobId,
          extractedRecordId: result.id,
          associationId: result.associationId ?? null,
          mode: "commit",
          targetModule: importSummary.targetModule,
          runStatus: importSummary.imported ? "applied" : "noop",
          summaryJson: importSummary,
          createdEntityRefsJson: {
            vendorInvoiceIds: importSummary.createdVendorInvoiceIds,
            ownerLedgerEntryIds: importSummary.createdOwnerLedgerEntryIds,
          },
          actorEmail: req.adminUserEmail || null,
          errorMessage: null,
        });
      }
      res.json({ ...result, importSummary });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/ai/ingestion/records/:id/import-runs", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "ai-extracted-record", getParam(req.params.id));
      const result = await storage.getAiIngestionImportRuns(getParam(req.params.id));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/ai/ingestion/records/:id/bank-resolution", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "ai-extracted-record", getParam(req.params.id));
      const result = await storage.getBankStatementResolutionHints(getParam(req.params.id));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/ai/ingestion/import-runs/:runId/rollback", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      await assertResourceScope(req, "ai-ingestion-import-run", getParam(req.params.runId));
      const result = await storage.rollbackAiIngestionImportRun(getParam(req.params.runId), req.adminUserEmail || undefined);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/ai/ingestion/import-runs/:runId/rollback-preview", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "ai-ingestion-import-run", getParam(req.params.runId));
      const result = await storage.previewRollbackAiIngestionImportRun(getParam(req.params.runId));
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/ai/ingestion/import-runs/:runId/reprocess", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      await assertResourceScope(req, "ai-ingestion-import-run", getParam(req.params.runId));
      const result = await storage.reprocessAiIngestionImportRun(getParam(req.params.runId), {
        rollbackFirst: Boolean(req.body?.rollbackFirst),
        actorEmail: req.adminUserEmail || undefined,
      });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/ai/ingestion/clauses", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const ingestionJobId = typeof req.query.ingestionJobId === "string" ? req.query.ingestionJobId : undefined;
      const associationId = getAssociationIdQuery(req);
      const reviewStatus = typeof req.query.reviewStatus === "string" ? req.query.reviewStatus : undefined;
      const query = typeof req.query.q === "string" ? req.query.q : undefined;
      const result = await storage.getClauseRecords({
        ingestionJobId,
        associationId,
        reviewStatus: reviewStatus === "approved" || reviewStatus === "rejected" || reviewStatus === "pending-review" ? reviewStatus : undefined,
        query,
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/ai/ingestion/clauses/:id/review", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      await assertResourceScope(req, "clause-record", getParam(req.params.id));
      const status = req.body?.reviewStatus;
      if (status !== "approved" && status !== "rejected") {
        return res.status(400).json({ message: "reviewStatus must be approved or rejected" });
      }
      const payload: { reviewStatus: "approved" | "rejected"; title?: string; clauseText?: string; reviewedBy?: string | null } = {
        reviewStatus: status,
        reviewedBy: req.adminUserEmail || null,
      };
      if (typeof req.body?.title === "string") payload.title = req.body.title;
      if (typeof req.body?.clauseText === "string") payload.clauseText = req.body.clauseText;

      const result = await storage.reviewClauseRecord(getParam(req.params.id), payload);
      if (!result) return res.status(404).json({ message: "Clause record not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/ai/ingestion/clauses/:id/tags", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "clause-record", getParam(req.params.id));
      const result = await storage.getClauseTags(getParam(req.params.id));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/ai/ingestion/clauses/:id/tags", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "clause-record", getParam(req.params.id));
      const parsed = insertClauseTagSchema.parse({
        clauseRecordId: getParam(req.params.id),
        tag: req.body?.tag,
      });
      const result = await storage.createClauseTag(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/ai/ingestion/clauses/:id/suggested-links", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "clause-record", getParam(req.params.id));
      const result = await storage.getSuggestedLinks(getParam(req.params.id));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/ai/ingestion/clauses/:id/suggested-links", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "clause-record", getParam(req.params.id));
      const parsed = insertSuggestedLinkSchema.parse({
        clauseRecordId: getParam(req.params.id),
        entityType: req.body?.entityType,
        entityId: req.body?.entityId,
        confidenceScore: req.body?.confidenceScore ?? null,
      });
      const result = await storage.createSuggestedLink(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/ai/ingestion/suggested-links/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "suggested-link", getParam(req.params.id));
      const payload: { isApproved?: number; confidenceScore?: number | null } = {};
      if (typeof req.body?.isApproved === "boolean") payload.isApproved = req.body.isApproved ? 1 : 0;
      if (req.body?.isApproved === 0 || req.body?.isApproved === 1) payload.isApproved = req.body.isApproved;
      if (typeof req.body?.confidenceScore === "number" || req.body?.confidenceScore === null) {
        payload.confidenceScore = req.body.confidenceScore;
      }
      if (Object.keys(payload).length === 0) {
        return res.status(400).json({ message: "At least one of isApproved or confidenceScore is required" });
      }
      const result = await storage.updateSuggestedLink(getParam(req.params.id), payload);
      if (!result) return res.status(404).json({ message: "Suggested link not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/ai/ingestion/governance/approved-links", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getApprovedClauseLinksForGovernance(getAssociationIdQuery(req));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/communications/templates", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getNoticeTemplates(getAssociationIdQuery(req));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/communications/templates", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const parsed = insertNoticeTemplateSchema.parse(req.body);
      if (parsed.associationId) assertAssociationScope(req as AdminRequest, parsed.associationId);
      const result = await storage.createNoticeTemplate(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/communications/templates/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "notice-template", getParam(req.params.id));
      const parsed = insertNoticeTemplateSchema.partial().parse(req.body);
      if (Object.prototype.hasOwnProperty.call(parsed, "associationId")) {
        assertAssociationInputScope(req as AdminRequest, parsed.associationId ?? null);
      }
      const result = await storage.updateNoticeTemplate(getParam(req.params.id), parsed);
      if (!result) return res.status(404).json({ message: "Template not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/communications/send", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const recipientEmail = getParam(req.body.recipientEmail);
      if (!recipientEmail) {
        return res.status(400).json({ message: "recipientEmail is required" });
      }
      const requireApproval = Boolean(req.body.requireApproval);
      const scheduledForRaw = req.body.scheduledFor;
      const scheduledFor =
        typeof scheduledForRaw === "string" && scheduledForRaw.trim().length > 0
          ? new Date(scheduledForRaw)
          : null;
      if (scheduledFor && Number.isNaN(scheduledFor.getTime())) {
        return res.status(400).json({ message: "scheduledFor must be a valid date string" });
      }
      assertAssociationInputScope(req, req.body.associationId || null);
      const result = await storage.sendNotice({
        associationId: req.body.associationId || null,
        templateId: req.body.templateId || null,
        recipientEmail,
        recipientPersonId: req.body.recipientPersonId || null,
        subject: req.body.subject || null,
        body: req.body.body || null,
        variables: req.body.variables || {},
        requireApproval,
        scheduledFor,
        bypassReadinessGate: Boolean(req.body.bypassReadinessGate),
        sentBy: req.adminUserEmail || null,
      });
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/communications/recipients/preview", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      const audience = typeof req.query.audience === "string" ? req.query.audience : "all";
      const ccOwners = req.query.ccOwners === "1" || req.query.ccOwners === "true";
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      if (audience !== "owners" && audience !== "occupants" && audience !== "all") {
        return res.status(400).json({ message: "audience must be owners, occupants, or all" });
      }
      const result = await storage.resolveNotificationRecipientPreview({
        associationId,
        audience,
        ccOwners,
      });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/communications/send-targeted", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getParam(req.body.associationId);
      assertAssociationScope(req, associationId);
      const audience = req.body.audience;
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      if (audience !== "owners" && audience !== "occupants" && audience !== "all") {
        return res.status(400).json({ message: "audience must be owners, occupants, or all" });
      }
      const scheduledForRaw = req.body.scheduledFor;
      const scheduledFor =
        typeof scheduledForRaw === "string" && scheduledForRaw.trim().length > 0
          ? new Date(scheduledForRaw)
          : null;
      if (scheduledFor && Number.isNaN(scheduledFor.getTime())) {
        return res.status(400).json({ message: "scheduledFor must be a valid date string" });
      }
      const result = await storage.sendTargetedNotice({
        associationId,
        audience,
        ccOwners: Boolean(req.body.ccOwners),
        templateId: req.body.templateId || null,
        subject: req.body.subject || null,
        body: req.body.body || null,
        variables: req.body.variables || {},
        requireApproval: Boolean(req.body.requireApproval),
        scheduledFor,
        bypassReadinessGate: Boolean(req.body.bypassReadinessGate),
        sentBy: req.adminUserEmail || null,
      });
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/communications/readiness", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      assertAssociationInputScope(req as AdminRequest, associationId || null);
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      const result = await storage.getAssociationContactReadiness(associationId);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/onboarding/completeness", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      assertAssociationInputScope(req as AdminRequest, associationId || null);
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      const result = await storage.getAssociationOnboardingCompleteness(associationId);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/onboarding/state", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      assertAssociationInputScope(req as AdminRequest, associationId || null);
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      const result = await storage.getAssociationOnboardingState(associationId);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/onboarding/intake", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const associationId = getParam(req.body.associationId);
      assertAssociationScope(req as AdminRequest, associationId);
      const unitId = getParam(req.body.unitId);
      const occupancyType = req.body.occupancyType;
      const person = req.body.person;
      const startDate = new Date(req.body.startDate);
      if (!associationId || !unitId) return res.status(400).json({ message: "associationId and unitId are required" });
      if (occupancyType !== "OWNER_OCCUPIED" && occupancyType !== "TENANT") {
        return res.status(400).json({ message: "occupancyType must be OWNER_OCCUPIED or TENANT" });
      }
      if (!person || typeof person !== "object") return res.status(400).json({ message: "person payload is required" });
      if (!person.firstName || !person.lastName) return res.status(400).json({ message: "person firstName and lastName are required" });
      if (Number.isNaN(startDate.getTime())) return res.status(400).json({ message: "startDate must be valid" });

      const result = await storage.submitOnboardingIntake({
        associationId,
        unitId,
        occupancyType,
        person: {
          firstName: String(person.firstName),
          lastName: String(person.lastName),
          email: person.email || null,
          phone: person.phone || null,
          mailingAddress: person.mailingAddress || null,
          emergencyContactName: person.emergencyContactName || null,
          emergencyContactPhone: person.emergencyContactPhone || null,
          contactPreference: person.contactPreference || "email",
        },
        startDate,
        ownershipPercentage: typeof req.body.ownershipPercentage === "number" ? req.body.ownershipPercentage : null,
      });
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/associations/:id/overview", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      assertAssociationScope(req as AdminRequest, getParam(req.params.id));
      const result = await storage.getAssociationOverview(getParam(req.params.id));
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/communications/sends", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const result = await storage.getNoticeSends(getAssociationIdQuery(req), status);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/communications/sends/:id/approval", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      await assertResourceScope(req, "notice-send", getParam(req.params.id));
      const decision = req.body?.decision;
      if (decision !== "approved" && decision !== "rejected") {
        return res.status(400).json({ message: "decision must be approved or rejected" });
      }
      const result = await storage.reviewNoticeSend(getParam(req.params.id), {
        decision,
        actedBy: req.adminUserEmail || null,
      });
      if (!result) return res.status(404).json({ message: "Notice send not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/communications/run-scheduled", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getAssociationIdQuery(req) || req.body?.associationId || undefined;
      assertAssociationInputScope(req, associationId ?? null);
      const result = await storage.runScheduledNotices({
        associationId,
        actedBy: req.adminUserEmail || "scheduler@system",
      });
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/communications/history", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getCommunicationHistory(getAssociationIdQuery(req));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/maintenance/requests", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const result = await storage.getMaintenanceRequests({
        associationId: getAssociationIdQuery(req),
        status,
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/maintenance/requests", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const parsed = insertMaintenanceRequestSchema.parse(req.body);
      assertAssociationScope(req as AdminRequest, parsed.associationId);
      const result = await storage.createMaintenanceRequest(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/maintenance/requests/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "maintenance-request", getParam(req.params.id));
      const parsed = insertMaintenanceRequestSchema.partial().parse(req.body);
      if (Object.prototype.hasOwnProperty.call(parsed, "associationId")) {
        assertAssociationInputScope(req as AdminRequest, parsed.associationId ?? null);
      }
      const result = await storage.updateMaintenanceRequest(getParam(req.params.id), parsed);
      if (!result) return res.status(404).json({ message: "Maintenance request not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/maintenance/escalations/run", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      assertAssociationInputScope(req, (getAssociationIdQuery(req) || req.body?.associationId || null) as string | null);
      const result = await storage.runMaintenanceEscalationSweep({
        associationId: getAssociationIdQuery(req) || req.body?.associationId || undefined,
        actorEmail: req.adminUserEmail || "scheduler@system",
      });
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/platform/permission-envelopes", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getPermissionEnvelopes(getAssociationIdQuery(req));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/platform/permission-envelopes", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const parsed = insertPermissionEnvelopeSchema.parse(req.body);
      assertAssociationInputScope(req as AdminRequest, parsed.associationId ?? null);
      const result = await storage.createPermissionEnvelope(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/platform/permission-envelopes/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "permission-envelope", getParam(req.params.id));
      const parsed = insertPermissionEnvelopeSchema.partial().parse(req.body);
      if (Object.prototype.hasOwnProperty.call(parsed, "associationId")) {
        assertAssociationInputScope(req as AdminRequest, parsed.associationId ?? null);
      }
      const result = await storage.updatePermissionEnvelope(getParam(req.params.id), parsed);
      if (!result) return res.status(404).json({ message: "Permission envelope not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/platform/admin-association-scopes", requireAdmin, requireAdminRole(["platform-admin"]), async (_req, res) => {
    try {
      const result = await storage.getAdminAssociationScopes();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/platform/admin-association-scopes", requireAdmin, requireAdminRole(["platform-admin"]), async (req, res) => {
    try {
      const parsed = insertAdminAssociationScopeSchema.parse(req.body);
      const result = await storage.upsertAdminAssociationScope(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/platform/tenant-config", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      const result = await storage.getTenantConfig(associationId);
      res.json(result ?? null);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/platform/tenant-config", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const parsed = insertTenantConfigSchema.parse(req.body);
      assertAssociationInputScope(req as AdminRequest, parsed.associationId);
      const result = await storage.upsertTenantConfig(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/platform/email-threads", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getEmailThreads(getAssociationIdQuery(req));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/platform/email/provider-status", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (_req, res) => {
    try {
      res.json(getEmailProviderStatus());
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/platform/email/policy", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (_req, res) => {
    try {
      res.json(getEmailPolicy());
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/platform/email/verify", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (_req, res) => {
    try {
      const result = await verifyEmailConnection();
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ ok: false, message: error.message });
    }
  });

  app.post("/api/platform/email/test", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const to = getParam(req.body?.to);
      if (!to) return res.status(400).json({ message: "to is required" });
      assertAssociationInputScope(req, req.body?.associationId || null);
      const result = await storage.sendNotice({
        associationId: req.body?.associationId || null,
        recipientEmail: to,
        recipientPersonId: null,
        subject: req.body?.subject || "Platform Gmail Integration Test",
        body: req.body?.body || "This is a test email from the platform.",
        variables: {},
        requireApproval: false,
        bypassReadinessGate: true,
        sentBy: req.adminUserEmail || null,
      });
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/platform/email/logs", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const associationId = getAssociationIdQuery(req) || undefined;
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
      res.json(await getEmailLogs({ associationId, status, limit }));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/platform/email/logs/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await getEmailLog(getParam(req.params.id));
      if (!result) return res.status(404).json({ message: "Email log not found" });
      assertAssociationInputScope(req as AdminRequest, result.associationId ?? null);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/platform/email/tracking/purge", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const olderThan =
        typeof req.body?.olderThan === "string" && req.body.olderThan.trim()
          ? new Date(req.body.olderThan)
          : undefined;
      if (olderThan && Number.isNaN(olderThan.getTime())) {
        return res.status(400).json({ message: "olderThan must be a valid date string" });
      }
      res.status(200).json(await purgeTrackingData(olderThan));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/platform/email/tracking/pixel/:token", async (req, res) => {
    try {
      await handleEmailOpenTracking({
        token: getParam(req.params.token),
        headers: req.headers as Record<string, unknown>,
        ipAddress: req.ip,
      });
    } catch {
      // Tracking should never block pixel delivery.
    }
    res.setHeader("Content-Type", "image/gif");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.status(200).send(getTrackingPixelBuffer());
  });

  app.get("/api/platform/email/tracking/click/:token", async (req, res) => {
    try {
      const destination = await handleEmailClickTracking({
        token: getParam(req.params.token),
        headers: req.headers as Record<string, unknown>,
        ipAddress: req.ip,
      });
      if (!destination) return res.status(400).json({ message: "Invalid or expired tracking token" });
      res.redirect(destination);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/portal/access", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getPortalAccesses(getAssociationIdQuery(req));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/portal/access", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const parsed = insertPortalAccessSchema.parse(req.body);
      assertAssociationInputScope(req as AdminRequest, parsed.associationId);
      const result = await storage.createPortalAccess(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/portal/access/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "portal-access", getParam(req.params.id));
      const parsed = insertPortalAccessSchema.partial().parse(req.body);
      if (Object.prototype.hasOwnProperty.call(parsed, "associationId")) {
        assertAssociationInputScope(req as AdminRequest, parsed.associationId ?? null);
      }
      const result = await storage.updatePortalAccess(getParam(req.params.id), parsed);
      if (!result) return res.status(404).json({ message: "Portal access not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/portal/memberships", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getAssociationMemberships(getAssociationIdQuery(req));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/portal/memberships", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const parsed = insertAssociationMembershipSchema.parse(req.body);
      assertAssociationInputScope(req as AdminRequest, parsed.associationId);
      const result = await storage.upsertAssociationMembership(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/portal/contact-updates/admin", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getContactUpdateRequests({ associationId: getAssociationIdQuery(req) });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/portal/contact-updates/:id/review", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      await assertResourceScope(req, "contact-update-request", getParam(req.params.id));
      const reviewStatus = req.body?.reviewStatus;
      if (reviewStatus !== "approved" && reviewStatus !== "rejected") {
        return res.status(400).json({ message: "reviewStatus must be approved or rejected" });
      }
      const result = await storage.reviewContactUpdateRequest(getParam(req.params.id), {
        reviewStatus,
        reviewedBy: req.adminUserEmail || null,
      });
      if (!result) return res.status(404).json({ message: "Contact update request not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/portal/session", async (req, res) => {
    try {
      const associationId = getParam(req.body?.associationId);
      const email = getParam(req.body?.email);
      if (!associationId || !email) return res.status(400).json({ message: "associationId and email are required" });
      const access = await storage.getPortalAccessByAssociationEmail(associationId, email);
      if (!access || access.status !== "active") return res.status(404).json({ message: "No active portal access found" });
      await storage.touchPortalAccessLogin(access.id);
      res.json({ portalAccessId: access.id, associationId: access.associationId, role: access.role, email: access.email });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/portal/me", requirePortal, async (req: PortalRequest, res) => {
    const access = await storage.getPortalAccessById(req.portalAccessId || "");
    if (!access) return res.status(404).json({ message: "Portal access not found" });
    res.json(access);
  });

  app.get("/api/portal/documents", requirePortal, async (req: PortalRequest, res) => {
    try {
      const result = await storage.getPortalDocuments(req.portalAccessId || "");
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/portal/notices", requirePortal, async (req: PortalRequest, res) => {
    try {
      const result = await storage.getPortalCommunicationHistory(req.portalAccessId || "");
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/portal/contact-updates", requirePortal, async (req: PortalRequest, res) => {
    try {
      const result = await storage.getContactUpdateRequests({ portalAccessId: req.portalAccessId });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/portal/contact-updates", requirePortal, async (req: PortalRequest, res) => {
    try {
      const parsed = insertContactUpdateRequestSchema.parse({
        associationId: req.portalAssociationId,
        portalAccessId: req.portalAccessId,
        personId: req.portalPersonId,
        requestJson: req.body?.requestJson ?? {},
      });
      const result = await storage.createContactUpdateRequest(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/portal/maintenance-requests", requirePortal, async (req: PortalRequest, res) => {
    try {
      const result = await storage.getMaintenanceRequests({
        portalAccessId: req.portalAccessId,
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/portal/maintenance-requests", requirePortal, async (req: PortalRequest, res) => {
    try {
      const parsed = insertMaintenanceRequestSchema.parse({
        associationId: req.portalAssociationId,
        submittedByPortalAccessId: req.portalAccessId,
        submittedByPersonId: req.portalPersonId,
        submittedByEmail: req.portalEmail,
        unitId: req.body?.unitId ?? null,
        title: req.body?.title,
        description: req.body?.description,
        locationText: req.body?.locationText ?? null,
        category: req.body?.category ?? "general",
        priority: req.body?.priority ?? "medium",
        status: "submitted",
        attachmentUrlsJson: Array.isArray(req.body?.attachmentUrlsJson) ? req.body.attachmentUrlsJson : [],
        assignedTo: null,
        resolutionNotes: null,
      });
      const result = await storage.createMaintenanceRequest(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/admin/users", requireAdmin, requireAdminRole(["platform-admin"]), async (_req, res) => {
    try {
      const result = await storage.getAdminUsers();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/users", requireAdmin, requireAdminRole(["platform-admin"]), async (req: AdminRequest, res) => {
    try {
      const parsed = insertAdminUserSchema.parse(req.body);
      const result = await storage.upsertAdminUser(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/admin/users/:id/role", requireAdmin, requireAdminRole(["platform-admin"]), async (req: AdminRequest, res) => {
    try {
      const role = req.body?.role;
      const allowedRoles = ["platform-admin", "board-admin", "manager", "viewer"];
      if (!allowedRoles.includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }
      const reason = req.body?.reason;
      const result = await storage.updateAdminUserRole(
        getParam(req.params.id),
        role as "platform-admin" | "board-admin" | "manager" | "viewer",
        req.adminUserEmail || "system",
        reason,
      );
      if (!result) return res.status(404).json({ message: "Admin user not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/admin/executive/updates", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (_req, res) => {
    try {
      const result = await storage.getExecutiveUpdates();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/executive/updates", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      validateExecutiveSlidePayload(req.body as Record<string, unknown>, { partial: false });
      const parsed = insertExecutiveUpdateSchema.parse({
        ...req.body,
        createdBy: req.body.createdBy || req.adminUserEmail || null,
      });
      const result = await storage.createExecutiveUpdate(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/admin/executive/updates/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      validateExecutiveSlidePayload(req.body as Record<string, unknown>, { partial: true });
      const parsed = insertExecutiveUpdateSchema.partial().parse(req.body);
      const result = await storage.updateExecutiveUpdate(getParam(req.params.id), parsed);
      if (!result) return res.status(404).json({ message: "Executive update not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/admin/executive/updates/:id/evidence", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getExecutiveEvidence(getParam(req.params.id));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/executive/updates/:id/evidence", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const parsed = insertExecutiveEvidenceSchema.parse({
        ...req.body,
        executiveUpdateId: getParam(req.params.id),
      });
      const result = await storage.createExecutiveEvidence(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/admin/executive/sync", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (_req, res) => {
    try {
      const result = await storage.syncExecutiveFromRoadmap();
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/admin/roadmap", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (_req, res) => {
    try {
      const result = await storage.getRoadmap();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/projects", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const parsed = insertRoadmapProjectSchema.parse(req.body);
      const result = await storage.createRoadmapProject(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/admin/workstreams", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const parsed = insertRoadmapWorkstreamSchema.parse(req.body);
      const result = await storage.createRoadmapWorkstream(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/admin/tasks", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const parsed = insertRoadmapTaskSchema.parse(req.body);
      const result = await storage.createRoadmapTask(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/admin/tasks/:taskId", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const parsed = insertRoadmapTaskSchema.partial().parse(req.body);
      const result = await storage.updateRoadmapTask(getParam(req.params.taskId), parsed);
      if (!result) return res.status(404).json({ message: "Task not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/admin/projects/:projectId", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const parsed = insertRoadmapProjectSchema.partial().parse(req.body);
      const result = await storage.updateRoadmapProject(getParam(req.params.projectId), parsed);
      if (!result) return res.status(404).json({ message: "Project not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/admin/workstreams/:workstreamId", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const parsed = insertRoadmapWorkstreamSchema.partial().parse(req.body);
      const result = await storage.updateRoadmapWorkstream(getParam(req.params.workstreamId), parsed);
      if (!result) return res.status(404).json({ message: "Workstream not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/analysis/:resourceId/history/:module", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const result = await storage.getAnalysisHistory(getParam(req.params.resourceId), getParam(req.params.module));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/analysis/:resourceId/history/:module/:versionId/revert", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const result = await storage.revertAnalysisVersion(
        getParam(req.params.resourceId),
        getParam(req.params.module),
        getParam(req.params.versionId),
      );
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/analysis/:resourceId/history/:module/versions", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const parsed = insertAnalysisVersionSchema.parse({
        ...req.body,
        resourceId: getParam(req.params.resourceId),
        module: getParam(req.params.module),
      });
      const result = await storage.createAnalysisVersion(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/analysis/:resourceId/history/:module/runs", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const parsed = insertAnalysisRunSchema.parse({
        ...req.body,
        resourceId: getParam(req.params.resourceId),
        module: getParam(req.params.module),
      });
      const result = await storage.createAnalysisRun(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/admin/analytics", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const days = Number(req.query.days ?? 30);
      const result = await storage.getAdminAnalytics(days);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  return httpServer;
}
