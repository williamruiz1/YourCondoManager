import type { Express, NextFunction, Request, Response } from "express";
import { type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { db } from "./db";
import { getGoogleOAuthStatus, registerAuthRoutes } from "./auth";
import { buildFtphDocumentationFeatureTree } from "./ftph-feature-tree";
import { eq } from "drizzle-orm";
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
  insertBoardPackageSchema,
  insertBoardPackageTemplateSchema,
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
  insertOnboardingInviteSchema,
  insertTenantConfigSchema,
  insertContactUpdateRequestSchema,
  insertComplianceAlertOverrideSchema,
  insertInspectionRecordSchema,
  insertMaintenanceScheduleTemplateSchema,
  insertMaintenanceRequestSchema,
  insertWorkOrderSchema,
  insertPermissionEnvelopeSchema,
  insertResolutionSchema,
  insertSpecialAssessmentSchema,
  insertUnitSchema,
  insertUtilityPaymentSchema,
  insertPaymentMethodConfigSchema,
  insertVendorSchema,
  insertVendorInvoiceSchema,
  insertVoteRecordSchema,
  boardRoles,
  resolutions,
  documents,
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

const DIRECT_INGEST_PARSEABLE_EXTENSIONS = new Set([
  ...Array.from(TEXT_PARSEABLE_EXTENSIONS),
  ".pdf",
  ".docx",
  ".xlsx",
]);

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
type PortalRequest = Request & {
  portalAccessId?: string;
  portalAssociationId?: string;
  portalPersonId?: string;
  portalEmail?: string;
  portalRole?: string;
  portalBoardRoleId?: string | null;
  portalHasBoardAccess?: boolean;
  portalEffectiveRole?: string;
};
type AiIngestionRolloutMode = "disabled" | "canary" | "full";

function normalizeAiIngestionRolloutMode(value: unknown): AiIngestionRolloutMode {
  return value === "disabled" || value === "canary" || value === "full" ? value : "full";
}

function normalizeAdminRole(value: unknown): AdminRole {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "platform-admin" || normalized === "board-admin" || normalized === "manager" || normalized === "viewer") {
    return normalized;
  }
  if (normalized === "admin" || normalized === "super-admin" || normalized === "superadmin" || normalized === "platform_admin") {
    return "platform-admin";
  }
  if (normalized === "association-admin" || normalized === "board_admin" || normalized === "board-member" || normalized === "boardmember") {
    return "board-admin";
  }
  if (normalized === "association-manager" || normalized === "operator") {
    return "manager";
  }
  return "viewer";
}

async function applyAdminContext(req: AdminRequest, adminUser: { id: string; email: string; role: string }) {
  const normalizedRole = normalizeAdminRole(adminUser.role);
  if (normalizedRole !== "platform-admin") {
    let scopes = await storage.getAdminAssociationScopesByUserId(adminUser.id);
    const portalRows = await storage.getPortalAccessesByEmail(adminUser.email);
    const activeAssociationIds = Array.from(new Set(
      portalRows
        .filter((row) => row.status === "active")
        .map((row) => row.associationId),
    ));
    const scopedAssociationIds = new Set(scopes.map((scope) => scope.associationId));
    const missingAssociationIds = activeAssociationIds.filter((associationId) => !scopedAssociationIds.has(associationId));

    if (missingAssociationIds.length > 0) {
      for (const associationId of missingAssociationIds) {
        await storage.upsertAdminAssociationScope({
          adminUserId: adminUser.id,
          associationId,
          scope: "read-write",
        });
      }
      scopes = await storage.getAdminAssociationScopesByUserId(adminUser.id);
      console.warn("[admin-scope][auto-hydrate]", {
        adminUserId: adminUser.id,
        email: adminUser.email,
        hydratedAssociationIds: missingAssociationIds,
        resultingScopeCount: scopes.length,
      });
    } else if (scopes.length === 0) {
      if (activeAssociationIds.length === 0) {
        console.error("[admin-scope][missing]", {
          adminUserId: adminUser.id,
          email: adminUser.email,
          reason: "No admin scopes and no active portal_access rows by email.",
        });
      }
    }
    req.adminScopedAssociationIds = scopes.map((scope) => scope.associationId);
  } else {
    req.adminScopedAssociationIds = [];
  }
  req.adminUserId = adminUser.id;
  req.adminUserEmail = adminUser.email;
  req.adminRole = normalizedRole;
}


async function tryHydrateAdminFromSession(req: AdminRequest): Promise<boolean> {
  async function resolveOrBootstrapAdminFromEmail(
    email: string,
    authUserId?: string,
  ): Promise<Awaited<ReturnType<typeof storage.getAdminUserByEmail>>> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return undefined;
    const existing = await storage.getAdminUserByEmail(normalizedEmail);
    if (existing && existing.isActive === 1) return existing;

    const portalRows = await storage.getPortalAccessesByEmail(normalizedEmail);
    const activeAssociationIds = Array.from(new Set(
      portalRows
        .filter((row) => row.status === "active")
        .map((row) => row.associationId),
    ));
    if (activeAssociationIds.length === 0) return undefined;

    const createdOrUpdated = await storage.upsertAdminUser({
      email: normalizedEmail,
      role: "board-admin",
      isActive: 1,
    });
    for (const associationId of activeAssociationIds) {
      await storage.upsertAdminAssociationScope({
        adminUserId: createdOrUpdated.id,
        associationId,
        scope: "read-write",
      });
    }
    if (authUserId) {
      await storage.updateAuthUser(authUserId, { adminUserId: createdOrUpdated.id });
    }
    console.warn("[auth-admin-link][portal-bootstrap]", {
      authUserId: authUserId || null,
      email: normalizedEmail,
      adminUserId: createdOrUpdated.id,
      hydratedAssociationIds: activeAssociationIds,
    });
    return createdOrUpdated;
  }

  const authUser = req.user as { id?: string; adminUserId?: string | null; email?: string | null } | undefined;
  if (req.isAuthenticated?.() && authUser) {
    const adminById = authUser.adminUserId
      ? await storage.getAdminUserById(authUser.adminUserId)
      : undefined;
    const adminByEmail = authUser.email
      ? await storage.getAdminUserByEmail(authUser.email.trim().toLowerCase())
      : undefined;

    let resolvedAdmin = adminById && adminById.isActive === 1 ? adminById : undefined;
    if (!resolvedAdmin && adminByEmail && adminByEmail.isActive === 1) {
      resolvedAdmin = adminByEmail;
    }
    if (adminById && adminByEmail && adminById.id !== adminByEmail.id && authUser.id) {
      resolvedAdmin = adminByEmail.isActive === 1 ? adminByEmail : resolvedAdmin;
      if (resolvedAdmin?.id === adminByEmail.id) {
        await storage.updateAuthUser(authUser.id, { adminUserId: adminByEmail.id });
        console.warn("[auth-admin-link][relinked]", {
          authUserId: authUser.id,
          authEmail: authUser.email || null,
          fromAdminUserId: adminById.id,
          toAdminUserId: adminByEmail.id,
        });
      }
    }
    if (!resolvedAdmin && authUser.email) {
      resolvedAdmin = await resolveOrBootstrapAdminFromEmail(authUser.email, authUser.id);
    }

    if (resolvedAdmin && resolvedAdmin.isActive === 1) {
      await applyAdminContext(req, resolvedAdmin);
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
  const fallbackAdmin = (!adminUser || adminUser.isActive !== 1)
    ? await resolveOrBootstrapAdminFromEmail(sessionAuthUser.email, sessionAuthUser.id)
    : adminUser;
  if (!fallbackAdmin || fallbackAdmin.isActive !== 1) return false;

  await applyAdminContext(req, fallbackAdmin);
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

  console.error("[auth][forbidden]", {
    code: "ADMIN_SESSION_REQUIRED",
    path: req.path,
    method: req.method,
    hasSessionAuth: Boolean(req.isAuthenticated?.()),
    hasSessionUser: Boolean((req as Request & { user?: unknown }).user),
  });
  return res.status(403).json({
    message: "Admin access required",
    code: "ADMIN_SESSION_REQUIRED",
    detail: "A valid authenticated admin session was not resolved for this request.",
  });
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
      console.error("[auth][forbidden]", {
        code: "ADMIN_ROLE_FORBIDDEN",
        path: req.path,
        method: req.method,
        currentRole: req.adminRole || null,
        requiredRoles: roles,
        adminUserId: req.adminUserId || null,
        adminUserEmail: req.adminUserEmail || null,
      });
      return res.status(403).json({
        message: "Insufficient admin role",
        code: "ADMIN_ROLE_FORBIDDEN",
        detail: "Authenticated admin role does not satisfy this endpoint.",
        currentRole: req.adminRole || null,
        requiredRoles: roles,
      });
    }
    return next();
  };
}

async function requirePortal(req: PortalRequest, res: Response, next: NextFunction) {
  const portalAccessId = req.header("x-portal-access-id") || "";
  if (!portalAccessId) return res.status(403).json({ message: "Portal access required" });
  const resolved = await storage.resolvePortalAccessContext(portalAccessId);
  if (!resolved) {
    return res.status(403).json({ message: "Invalid or inactive portal access" });
  }
  const { access, boardRole, hasBoardAccess, effectiveRole } = resolved;
  req.portalAccessId = access.id;
  req.portalAssociationId = access.associationId;
  req.portalPersonId = access.personId;
  req.portalEmail = access.email;
  req.portalRole = access.role;
  req.portalBoardRoleId = boardRole?.id ?? null;
  req.portalHasBoardAccess = hasBoardAccess;
  req.portalEffectiveRole = effectiveRole;
  await storage.touchPortalAccessLogin(access.id);
  return next();
}

function requirePortalBoard(req: PortalRequest, res: Response, next: NextFunction) {
  if (!req.portalHasBoardAccess || !req.portalAssociationId) {
    return res.status(403).json({ message: "Board-member access required" });
  }
  return next();
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  registerAuthRoutes(app);

  app.get("/api/dashboard/stats", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const scopedAssociationIds = req.adminRole === "platform-admin" ? undefined : (req.adminScopedAssociationIds ?? []);
      const stats = await storage.getDashboardStats({
        associationIds: scopedAssociationIds,
        includeArchived: false,
      });
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
      if (adminReq.adminRole !== "platform-admin" && scopedResult.length === 0 && result.length > 0) {
        console.error("[associations][empty-scope-result]", {
          adminUserId: adminReq.adminUserId || null,
          adminUserEmail: adminReq.adminUserEmail || null,
          adminRole: adminReq.adminRole || null,
          scopedAssociationIds: adminReq.adminScopedAssociationIds ?? [],
          totalAssociations: result.length,
          isPublishedState,
        });
      }
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

  app.get("/api/addresses/search", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const query = typeof req.query.query === "string" ? req.query.query.trim() : "";
      if (query.length < 3) {
        return res.status(400).json({ message: "query must be at least 3 characters" });
      }

      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("q", query);
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("addressdetails", "1");
      url.searchParams.set("namedetails", "1");
      url.searchParams.set("limit", "8");
      url.searchParams.set("countrycodes", "us");

      const response = await fetch(url.toString(), {
        headers: {
          "User-Agent": "CondoManager/1.0 (address-search)",
          "Accept-Language": "en-US,en",
        },
      });
      if (!response.ok) {
        return res.status(502).json({ message: "Address search failed" });
      }

      const payload = await response.json();
      const rows = Array.isArray(payload) ? payload : [];
      const results = rows.map(normalizeAssociationSearchResult);
      res.json({ results });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/debug/admin-context", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const allAssociations = await storage.getAssociations({ includeArchived: true });
      const scopedAssociationIds = req.adminRole === "platform-admin"
        ? allAssociations.map((association) => association.id)
        : (req.adminScopedAssociationIds ?? []);
      const scopedAssociations = allAssociations
        .filter((association) => scopedAssociationIds.includes(association.id))
        .map((association) => ({
          id: association.id,
          name: association.name,
          isArchived: association.isArchived,
        }));

      res.json({
        runtime: {
          nodeEnv: process.env.NODE_ENV || null,
          isPublishedState,
        },
        resolvedAdmin: {
          adminUserId: req.adminUserId || null,
          adminUserEmail: req.adminUserEmail || null,
          adminRole: req.adminRole || null,
          scopedAssociationIds,
          scopedAssociations,
        },
        requestAuthSignals: {
          hasSessionUser: Boolean((req as Request & { user?: unknown }).user),
        },
      });
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
      const parsed = insertOwnershipSchema.parse({
        unitId: req.body?.unitId,
        personId: req.body?.personId,
        ownershipPercentage: req.body?.ownershipPercentage,
        startDate: req.body?.startDate ? new Date(req.body.startDate) : req.body?.startDate,
        endDate: req.body?.endDate ? new Date(req.body.endDate) : null,
      });
      const result = await storage.createOwnership(parsed, req.adminUserEmail);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/ownerships/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const parsed = insertOwnershipSchema.partial().parse({
        ...req.body,
        startDate: req.body?.startDate ? new Date(req.body.startDate) : req.body?.startDate,
        endDate: req.body?.endDate ? new Date(req.body.endDate) : req.body?.endDate,
      });
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
      const parsed = insertOccupancySchema.parse({
        unitId: req.body?.unitId,
        personId: req.body?.personId,
        occupancyType: req.body?.occupancyType,
        startDate: req.body?.startDate ? new Date(req.body.startDate) : req.body?.startDate,
        endDate: req.body?.endDate ? new Date(req.body.endDate) : null,
      });
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
      const parsed = insertBoardRoleSchema.parse({
        ...req.body,
        startDate: req.body?.startDate ? new Date(req.body.startDate) : req.body?.startDate,
        endDate: req.body?.endDate ? new Date(req.body.endDate) : null,
      });
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

  app.post("/api/board-roles/:id/invite-access", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      await assertResourceScope(req, "board-role", getParam(req.params.id));
      const roleId = getParam(req.params.id);
      const scopedRoles = await storage.getBoardRoles(getAssociationIdQuery(req));
      const boardRole = scopedRoles.find((row) => row.id === roleId);
      if (!boardRole) return res.status(404).json({ message: "Board role not found" });

      const people = await storage.getPersons(boardRole.associationId);
      const person = people.find((row) => row.id === boardRole.personId);
      if (!person) return res.status(404).json({ message: "Board member person not found" });

      const result = await storage.inviteBoardMemberAccess({
        associationId: boardRole.associationId,
        personId: boardRole.personId,
        boardRoleId: boardRole.id,
        email: typeof req.body?.email === "string" ? req.body.email : person.email,
        invitedBy: req.adminUserEmail ?? null,
      });
      res.status(201).json(result);
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

      if (req.isAuthenticated?.() && req.user) {
        const authUser = req.user as { adminUserId?: string | null; email?: string | null };
        const adminUser = authUser.adminUserId
          ? await storage.getAdminUserById(authUser.adminUserId)
          : (authUser.email ? await storage.getAdminUserByEmail(authUser.email.trim().toLowerCase()) : undefined);
        if (adminUser && adminUser.isActive === 1) {
          return res.sendFile(filePath);
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

  app.get("/api/vendors", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getVendors(getAssociationIdQuery(req));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/vendors", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const parsed = insertVendorSchema.parse(req.body);
      assertAssociationScope(req as AdminRequest, parsed.associationId);
      const result = await storage.createVendor(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/vendors/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "vendor", getParam(req.params.id));
      const parsed = insertVendorSchema.partial().parse(req.body);
      if (Object.prototype.hasOwnProperty.call(parsed, "associationId")) {
        assertAssociationInputScope(req as AdminRequest, parsed.associationId ?? null);
      }
      const result = await storage.updateVendor(getParam(req.params.id), parsed);
      if (!result) return res.status(404).json({ message: "Vendor not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/vendors/renewal-alerts", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getVendorRenewalAlerts(getAssociationIdQuery(req));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/vendors/:id/documents", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "vendor", getParam(req.params.id));
      const result = await storage.getVendorDocuments(getParam(req.params.id));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/vendors/:id/documents", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), upload.single("file"), async (req: AdminRequest, res) => {
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
      const targetType = typeof req.body?.targetType === "string" ? req.body.targetType : "all-owners";
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      if (!["all-owners", "individual-owner", "selected-units"].includes(targetType)) {
        return res.status(400).json({ message: "targetType must be all-owners, individual-owner, or selected-units" });
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
        targetType: targetType as any,
        selectedUnitIds: Array.isArray(req.body.selectedUnitIds) ? req.body.selectedUnitIds.filter((value: unknown) => typeof value === "string") : [],
        selectedPersonId: typeof req.body.selectedPersonId === "string" ? req.body.selectedPersonId : null,
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
      const parsed = insertGovernanceMeetingSchema.parse({
        ...req.body,
        scheduledAt: req.body?.scheduledAt ? new Date(req.body.scheduledAt) : req.body?.scheduledAt,
      });
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
      const parsed = insertGovernanceMeetingSchema.partial().parse({
        ...req.body,
        scheduledAt: req.body?.scheduledAt ? new Date(req.body.scheduledAt) : req.body?.scheduledAt,
      });
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
      const resolutionId = getParam(req.params.id);
      await assertResourceScope(req as AdminRequest, "resolution", resolutionId);

      const voterPersonId = typeof req.body?.voterPersonId === "string" ? req.body.voterPersonId.trim() : "";
      if (!voterPersonId) {
        return res.status(400).json({ message: "voterPersonId is required" });
      }

      const [resolutionRow] = await db
        .select({ associationId: resolutions.associationId })
        .from(resolutions)
        .where(eq(resolutions.id, resolutionId));
      if (!resolutionRow) {
        return res.status(404).json({ message: "Resolution not found" });
      }

      const boardMembers = await db
        .select({ personId: boardRoles.personId, endDate: boardRoles.endDate })
        .from(boardRoles)
        .where(eq(boardRoles.associationId, resolutionRow.associationId));
      const now = Date.now();
      const isActiveBoardMember = boardMembers.some((member) => {
        if (member.personId !== voterPersonId) return false;
        return !member.endDate || new Date(member.endDate).getTime() >= now;
      });
      if (!isActiveBoardMember) {
        return res.status(400).json({ message: "Selected voter is not an active board member for this association" });
      }

      const parsed = insertVoteRecordSchema.parse({
        ...req.body,
        voterPersonId,
        resolutionId,
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
      if ((parsed.scope === "state-library" || parsed.scope === "ct-baseline") && req.adminRole !== "platform-admin") {
        throw new Error("Only platform admins can manage state library templates");
      }
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

  app.patch("/api/governance/templates/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      await assertResourceScope(req, "governance-template", getParam(req.params.id));
      const parsed = insertGovernanceComplianceTemplateSchema.partial().parse(req.body);
      if ((parsed.scope === "state-library" || parsed.scope === "ct-baseline") && req.adminRole !== "platform-admin") {
        throw new Error("Only platform admins can manage state library templates");
      }
      if (parsed.associationId) {
        assertAssociationScope(req, parsed.associationId);
      }
      const result = await storage.updateGovernanceComplianceTemplate(getParam(req.params.id), parsed);
      if (!result) return res.status(404).json({ message: "Governance compliance template not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/governance/templates/bootstrap-state-library", requireAdmin, requireAdminRole(["platform-admin"]), async (req: AdminRequest, res) => {
    try {
      const states = Array.isArray(req.body?.states)
        ? req.body.states.filter((value: unknown): value is string => typeof value === "string")
        : undefined;
      const result = await storage.bootstrapGovernanceStateTemplateLibrary(states);
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
      const parsed = insertAnnualGovernanceTaskSchema.parse({
        ...req.body,
        dueDate: req.body?.dueDate ? new Date(req.body.dueDate) : null,
      });
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
      const parsed = insertAnnualGovernanceTaskSchema.partial().parse({
        ...req.body,
        dueDate: req.body?.dueDate ? new Date(req.body.dueDate) : req.body?.dueDate,
      });
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

  app.get("/api/ai/ingestion/superseded-cleanup-preview", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const retentionDaysRaw = typeof req.query.retentionDays === "string" ? Number(req.query.retentionDays) : undefined;
      const retentionDays = Number.isFinite(retentionDaysRaw) ? Math.max(1, Math.min(365, Math.round(retentionDaysRaw!))) : 30;
      const result = await storage.previewAiIngestionSupersededCleanup(retentionDays);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/ai/ingestion/superseded-cleanup", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const retentionDaysRaw = typeof req.body?.retentionDays === "number"
        ? req.body.retentionDays
        : typeof req.body?.retentionDays === "string"
          ? Number(req.body.retentionDays)
          : undefined;
      const retentionDays = Number.isFinite(retentionDaysRaw) ? Math.max(1, Math.min(365, Math.round(retentionDaysRaw!))) : 30;
      const result = await storage.executeAiIngestionSupersededCleanup(retentionDays);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
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
      const sourceDocumentId = typeof req.body.sourceDocumentId === "string" && req.body.sourceDocumentId.trim() ? req.body.sourceDocumentId.trim() : null;
      const fileExt = req.file ? path.extname(req.file.originalname).toLowerCase() : "";
      const fileIsDirectlyParseable = req.file ? DIRECT_INGEST_PARSEABLE_EXTENSIONS.has(fileExt) : false;
      const associationId = typeof req.body.associationId === "string" && req.body.associationId.trim() ? req.body.associationId.trim() : null;
      let linkedDocument: { id: string; associationId: string; title: string; fileUrl: string } | null = null;

      if (sourceDocumentId) {
        await assertResourceScope(req, "document", sourceDocumentId);
        const [document] = await db
          .select({
            id: documents.id,
            associationId: documents.associationId,
            title: documents.title,
            fileUrl: documents.fileUrl,
          })
          .from(documents)
          .where(eq(documents.id, sourceDocumentId))
          .limit(1);
        if (!document) {
          return res.status(404).json({ message: "Selected source document was not found." });
        }
        if (associationId && document.associationId !== associationId) {
          return res.status(400).json({ message: "Selected source document does not belong to the chosen association." });
        }
        linkedDocument = document;
      }

      if (!req.file && !sourceText && !linkedDocument) {
        return res.status(400).json({ message: "Upload a file, paste source text, or select a repository document." });
      }

      if (req.file && !fileIsDirectlyParseable && !sourceText) {
        return res.status(400).json({
          message: `File type '${fileExt || "unknown"}' is not yet directly parseable. Paste extracted text in Source Text or upload a pdf/docx/xlsx/txt/md/csv/tsv/json/log/html/xml/eml file.`,
        });
      }

      const sourceType = req.file || linkedDocument ? "file-upload" : "pasted-text";
      const parsed = insertAiIngestionJobSchema.parse({
        associationId,
        sourceDocumentId: linkedDocument?.id ?? null,
        sourceType,
        sourceFilename: req.file?.originalname ?? linkedDocument?.title ?? null,
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
        sourceFileUrl: req.file ? `/api/uploads/${req.file.filename}` : linkedDocument?.fileUrl ?? null,
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
      const includeSuperseded = req.query.includeSuperseded === "1" || req.query.includeSuperseded === "true";
      const result = await storage.getAiExtractedRecords(getParam(req.params.id), { includeSuperseded });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/ai/ingestion/jobs/:id/history-summary", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "ai-ingestion-job", getParam(req.params.id));
      const result = await storage.getAiIngestionJobHistorySummary(getParam(req.params.id));
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
      const includeSuperseded = req.query.includeSuperseded === "1" || req.query.includeSuperseded === "true";
      const result = await storage.getClauseRecords({
        ingestionJobId,
        associationId,
        reviewStatus: reviewStatus === "approved" || reviewStatus === "rejected" || reviewStatus === "pending-review" ? reviewStatus : undefined,
        query,
        includeSuperseded,
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/ai/ingestion/compliance-rules", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      if (associationId) {
        assertAssociationScope(req as AdminRequest, associationId);
      }
      const clauseRecordId = typeof req.query.clauseRecordId === "string" ? req.query.clauseRecordId : undefined;
      const result = await storage.getComplianceRuleRecords({
        associationId: associationId || undefined,
        clauseRecordId,
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/ai/ingestion/compliance-rules/extract", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const associationId = typeof req.body?.associationId === "string" ? req.body.associationId : getAssociationIdQuery(req);
      if (associationId) {
        assertAssociationScope(req, associationId);
      }
      const result = await storage.extractComplianceRulesFromClauses({
        associationId: associationId || undefined,
        actorEmail: req.adminUserEmail || "admin",
      });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/governance/compliance-alerts", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      if (!associationId) {
        throw new Error("associationId is required");
      }
      assertAssociationScope(req, associationId);
      const result = await storage.getComplianceGapAlerts(associationId);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/governance/compliance-alert-overrides", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const parsed = insertComplianceAlertOverrideSchema.parse({
        ...req.body,
        createdBy: req.body.createdBy || req.adminUserEmail || null,
        updatedBy: req.body.updatedBy || req.adminUserEmail || null,
      });
      assertAssociationScope(req, parsed.associationId);
      const result = await storage.upsertComplianceAlertOverride(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
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
      const targetType = typeof req.query.targetType === "string" ? req.query.targetType : "all-occupants";
      const selectedUnitAudience = typeof req.query.selectedUnitAudience === "string" ? req.query.selectedUnitAudience : "all";
      const messageClass = typeof req.query.messageClass === "string" ? req.query.messageClass : "general";
      const selectedPersonId = typeof req.query.selectedPersonId === "string" ? req.query.selectedPersonId : null;
      const selectedUnitIds = typeof req.query.selectedUnitIds === "string"
        ? req.query.selectedUnitIds.split(",").map((value) => value.trim()).filter(Boolean)
        : [];
      const ccOwners = req.query.ccOwners === "1" || req.query.ccOwners === "true";
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      if (!["all-owners", "all-tenants", "all-occupants", "selected-units", "individual-owner", "individual-tenant", "board-members"].includes(targetType)) {
        return res.status(400).json({ message: "targetType is invalid" });
      }
      if (!["owners", "tenants", "occupants", "all"].includes(selectedUnitAudience)) {
        return res.status(400).json({ message: "selectedUnitAudience is invalid" });
      }
      if (!["general", "operational", "maintenance", "financial", "governance"].includes(messageClass)) {
        return res.status(400).json({ message: "messageClass is invalid" });
      }
      const result = await storage.resolveNotificationRecipientPreview({
        associationId,
        targetType: targetType as any,
        selectedUnitIds,
        selectedPersonId,
        selectedUnitAudience: selectedUnitAudience as any,
        messageClass: messageClass as any,
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
      const targetType = req.body.targetType;
      const selectedUnitAudience = req.body.selectedUnitAudience;
      const messageClass = req.body.messageClass;
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      if (!["all-owners", "all-tenants", "all-occupants", "selected-units", "individual-owner", "individual-tenant", "board-members"].includes(targetType)) {
        return res.status(400).json({ message: "targetType is invalid" });
      }
      if (selectedUnitAudience && !["owners", "tenants", "occupants", "all"].includes(selectedUnitAudience)) {
        return res.status(400).json({ message: "selectedUnitAudience is invalid" });
      }
      if (messageClass && !["general", "operational", "maintenance", "financial", "governance"].includes(messageClass)) {
        return res.status(400).json({ message: "messageClass is invalid" });
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
        targetType,
        selectedUnitIds: Array.isArray(req.body.selectedUnitIds) ? req.body.selectedUnitIds.filter((value: unknown) => typeof value === "string") : [],
        selectedPersonId: typeof req.body.selectedPersonId === "string" ? req.body.selectedPersonId : null,
        selectedUnitAudience: selectedUnitAudience || undefined,
        messageClass: messageClass || undefined,
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

  app.get("/api/onboarding/invites", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      assertAssociationInputScope(req as AdminRequest, associationId || null);
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      const result = await storage.getOnboardingInvites(associationId);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/onboarding/invites", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const parsed = insertOnboardingInviteSchema.parse({
        associationId: req.body.associationId,
        unitId: req.body.unitId,
        residentType: req.body.residentType,
        email: req.body.email || null,
        phone: req.body.phone || null,
        deliveryChannel: req.body.deliveryChannel || "link",
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null,
        createdBy: req.adminUserEmail || null,
      });
      assertAssociationScope(req, parsed.associationId);
      const result = await storage.createOnboardingInvite(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/onboarding/unit-links/ensure", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getParam(req.body.associationId);
      const unitId = getParam(req.body.unitId);
      const residentType = req.body.residentType;
      assertAssociationScope(req, associationId);
      if (!associationId || !unitId) return res.status(400).json({ message: "associationId and unitId are required" });
      if (residentType !== "owner" && residentType !== "tenant") {
        return res.status(400).json({ message: "residentType must be owner or tenant" });
      }

      const result = await storage.getOrCreateUnitOnboardingLink({
        associationId,
        unitId,
        residentType,
        createdBy: req.adminUserEmail || null,
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null,
      });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/onboarding/unit-links/regenerate", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getParam(req.body.associationId);
      const unitId = getParam(req.body.unitId);
      const residentType = req.body.residentType;
      assertAssociationScope(req, associationId);
      if (!associationId || !unitId) return res.status(400).json({ message: "associationId and unitId are required" });
      if (residentType !== "owner" && residentType !== "tenant") {
        return res.status(400).json({ message: "residentType must be owner or tenant" });
      }

      const result = await storage.regenerateUnitOnboardingLink({
        associationId,
        unitId,
        residentType,
        createdBy: req.adminUserEmail || null,
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null,
      });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/onboarding/submissions", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      assertAssociationInputScope(req as AdminRequest, associationId || null);
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      const result = await storage.getOnboardingSubmissions(associationId);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/onboarding/invites/:id/send", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const id = getParam(req.params.id);
      await assertResourceScope(req, "onboarding-invite", id);
      const result = await storage.sendOnboardingInvite(id, req.adminUserEmail || null);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/onboarding/invites/reminders/run", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getParam(req.body?.associationId);
      assertAssociationScope(req, associationId);
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      const olderThanHours = typeof req.body?.olderThanHours === "number" ? req.body.olderThanHours : 24;
      const result = await storage.runOnboardingInviteReminderSweep({
        associationId,
        sentBy: req.adminUserEmail || null,
        olderThanHours,
      });
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

  app.patch("/api/onboarding/submissions/:id/review", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const id = getParam(req.params.id);
      const decision = req.body?.decision;
      if (decision !== "approved" && decision !== "rejected") {
        return res.status(400).json({ message: "decision must be approved or rejected" });
      }
      await assertResourceScope(req, "onboarding-submission", id);
      const result = await storage.reviewOnboardingSubmission(id, {
        decision,
        reviewedBy: req.adminUserEmail || "system",
        rejectionReason: typeof req.body?.rejectionReason === "string" ? req.body.rejectionReason : null,
      });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/public/onboarding/invite/:token", async (req, res) => {
    try {
      const token = getParam(req.params.token);
      if (!token) return res.status(400).json({ message: "token is required" });
      const invite = await storage.getOnboardingInviteByToken(token);
      if (!invite) return res.status(404).json({ message: "Invite not found" });
      const submissions = await storage.getOnboardingSubmissions(invite.associationId);
      const latestSubmission = submissions.find((submission) => submission.inviteId === invite.id) || null;
      res.json({
        id: invite.id,
        associationId: invite.associationId,
        associationName: invite.associationName,
        associationAddress: invite.associationAddress,
        associationCity: invite.associationCity,
        associationState: invite.associationState,
        associationCountry: invite.associationCountry,
        unitId: invite.unitId,
        unitLabel: invite.unitLabel,
        unitBuilding: invite.unitBuilding,
        residentType: invite.residentType,
        status: invite.status,
        email: invite.email,
        phone: invite.phone,
        expiresAt: invite.expiresAt,
        latestSubmissionStatus: latestSubmission?.status ?? null,
        latestSubmissionRejectionReason: latestSubmission?.rejectionReason ?? null,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/public/onboarding/invite/:token/submit", async (req, res) => {
    try {
      const token = getParam(req.params.token);
      if (!token) return res.status(400).json({ message: "token is required" });
      const startDate = new Date(req.body?.startDate);
      if (Number.isNaN(startDate.getTime())) return res.status(400).json({ message: "startDate must be valid" });
      const firstName = typeof req.body?.firstName === "string" ? req.body.firstName.trim() : "";
      const lastName = typeof req.body?.lastName === "string" ? req.body.lastName.trim() : "";
      if (!firstName || !lastName) return res.status(400).json({ message: "firstName and lastName are required" });

      const result = await storage.createOnboardingSubmissionFromInvite(token, {
        firstName,
        lastName,
        email: typeof req.body?.email === "string" ? req.body.email.trim() || null : null,
        phone: typeof req.body?.phone === "string" ? req.body.phone.trim() || null : null,
        mailingAddress: typeof req.body?.mailingAddress === "string" ? req.body.mailingAddress.trim() || null : null,
        emergencyContactName: typeof req.body?.emergencyContactName === "string" ? req.body.emergencyContactName.trim() || null : null,
        emergencyContactPhone: typeof req.body?.emergencyContactPhone === "string" ? req.body.emergencyContactPhone.trim() || null : null,
        contactPreference: typeof req.body?.contactPreference === "string" ? req.body.contactPreference.trim() || "email" : "email",
        startDate,
        occupancyIntent: typeof req.body?.occupancyIntent === "string" ? req.body.occupancyIntent.trim() || null : null,
        ownershipPercentage: typeof req.body?.ownershipPercentage === "number" ? req.body.ownershipPercentage : null,
        additionalOwners: Array.isArray(req.body?.additionalOwners) ? req.body.additionalOwners : null,
        tenantResidents: Array.isArray(req.body?.tenantResidents) ? req.body.tenantResidents : null,
      });
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/associations/:id/overview", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const associationId = getParam(req.params.id);
      const startedAt = Date.now();
      assertAssociationScope(req as AdminRequest, associationId);
      const result = await storage.getAssociationOverview(associationId);
      res.setHeader("x-association-overview-duration-ms", String(Date.now() - startedAt));
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

  app.get("/api/work-orders", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getWorkOrders({
        associationId: getAssociationIdQuery(req),
        unitId: typeof req.query.unitId === "string" ? req.query.unitId : undefined,
        vendorId: typeof req.query.vendorId === "string" ? req.query.vendorId : undefined,
        maintenanceRequestId: typeof req.query.maintenanceRequestId === "string" ? req.query.maintenanceRequestId : undefined,
        status: typeof req.query.status === "string" ? req.query.status : undefined,
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/work-orders", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const parsed = insertWorkOrderSchema.parse(req.body);
      assertAssociationScope(req, parsed.associationId);
      const result = await storage.createWorkOrder(parsed, req.adminUserEmail);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/work-orders/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      await assertResourceScope(req, "work-order", getParam(req.params.id));
      const parsed = insertWorkOrderSchema.partial().parse(req.body);
      if (Object.prototype.hasOwnProperty.call(parsed, "associationId")) {
        assertAssociationInputScope(req, parsed.associationId ?? null);
      }
      const result = await storage.updateWorkOrder(getParam(req.params.id), parsed, req.adminUserEmail);
      if (!result) return res.status(404).json({ message: "Work order not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/maintenance/requests/:id/convert-to-work-order", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      await assertResourceScope(req, "maintenance-request", getParam(req.params.id));
      const parsed = insertWorkOrderSchema.partial().parse({
        ...req.body,
        associationId: req.body?.associationId ?? getAssociationIdQuery(req),
      });
      if (Object.prototype.hasOwnProperty.call(parsed, "associationId")) {
        assertAssociationInputScope(req, parsed.associationId ?? null);
      }
      const result = await storage.convertMaintenanceRequestToWorkOrder(getParam(req.params.id), parsed, req.adminUserEmail);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/inspections", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getInspectionRecords({
        associationId: getAssociationIdQuery(req),
        unitId: typeof req.query.unitId === "string" ? req.query.unitId : undefined,
        inspectionType: typeof req.query.inspectionType === "string" ? req.query.inspectionType : undefined,
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/inspections", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const parsed = insertInspectionRecordSchema.parse(req.body);
      assertAssociationScope(req, parsed.associationId);
      const result = await storage.createInspectionRecord(parsed, req.adminUserEmail);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/inspections/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      await assertResourceScope(req, "inspection-record", getParam(req.params.id));
      const parsed = insertInspectionRecordSchema.partial().parse(req.body);
      if (Object.prototype.hasOwnProperty.call(parsed, "associationId")) {
        assertAssociationInputScope(req, parsed.associationId ?? null);
      }
      const result = await storage.updateInspectionRecord(getParam(req.params.id), parsed, req.adminUserEmail);
      if (!result) return res.status(404).json({ message: "Inspection record not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/inspections/:id/findings/:findingIndex/convert-to-work-order", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      await assertResourceScope(req, "inspection-record", getParam(req.params.id));
      const parsed = insertWorkOrderSchema.partial().parse({
        ...req.body,
        associationId: req.body?.associationId ?? getAssociationIdQuery(req),
      });
      if (Object.prototype.hasOwnProperty.call(parsed, "associationId")) {
        assertAssociationInputScope(req, parsed.associationId ?? null);
      }
      const result = await storage.convertInspectionFindingToWorkOrder(
        getParam(req.params.id),
        Number.parseInt(getParam(req.params.findingIndex), 10),
        parsed,
        req.adminUserEmail,
      );
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/maintenance/schedules", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      const [templates, instances] = await Promise.all([
        storage.getMaintenanceScheduleTemplates({
          associationId,
          unitId: typeof req.query.unitId === "string" ? req.query.unitId : undefined,
          status: typeof req.query.status === "string" ? req.query.status : undefined,
        }),
        storage.getMaintenanceScheduleInstances({
          associationId,
          templateId: typeof req.query.templateId === "string" ? req.query.templateId : undefined,
          status: typeof req.query.instanceStatus === "string" ? req.query.instanceStatus : undefined,
        }),
      ]);
      res.json({ templates, instances });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/maintenance/schedules", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const parsed = insertMaintenanceScheduleTemplateSchema.parse(req.body);
      assertAssociationScope(req, parsed.associationId);
      const result = await storage.createMaintenanceScheduleTemplate(parsed, req.adminUserEmail);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/maintenance/schedules/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      await assertResourceScope(req, "maintenance-schedule-template", getParam(req.params.id));
      const parsed = insertMaintenanceScheduleTemplateSchema.partial().parse(req.body);
      if (Object.prototype.hasOwnProperty.call(parsed, "associationId")) {
        assertAssociationInputScope(req, parsed.associationId ?? null);
      }
      const result = await storage.updateMaintenanceScheduleTemplate(getParam(req.params.id), parsed, req.adminUserEmail);
      if (!result) return res.status(404).json({ message: "Maintenance schedule template not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/maintenance/schedules/:id/generate", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      await assertResourceScope(req, "maintenance-schedule-template", getParam(req.params.id));
      const throughDate = req.body?.throughDate ? new Date(req.body.throughDate) : undefined;
      const result = await storage.generateMaintenanceScheduleInstances(getParam(req.params.id), {
        throughDate,
        actorEmail: req.adminUserEmail || "system",
      });
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/maintenance/instances/:id/convert-to-work-order", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      await assertResourceScope(req, "maintenance-schedule-instance", getParam(req.params.id));
      const parsed = insertWorkOrderSchema.partial().parse({
        ...req.body,
        associationId: req.body?.associationId ?? getAssociationIdQuery(req),
      });
      if (Object.prototype.hasOwnProperty.call(parsed, "associationId")) {
        assertAssociationInputScope(req, parsed.associationId ?? null);
      }
      const result = await storage.convertMaintenanceInstanceToWorkOrder(getParam(req.params.id), parsed, req.adminUserEmail);
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

  app.get("/api/platform/auth/google-status", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      res.json(getGoogleOAuthStatus(req));
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
      const result = await storage.createPortalAccess(parsed, (req as AdminRequest).adminUserEmail ?? "system");
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
      const result = await storage.updatePortalAccess(getParam(req.params.id), parsed, (req as AdminRequest).adminUserEmail ?? "system");
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
      const email = getParam(req.body?.email).trim().toLowerCase();
      if (!associationId || !email) return res.status(400).json({ message: "associationId and email are required" });
      const access = await storage.getPortalAccessByAssociationEmail(associationId, email);
      if (!access) return res.status(404).json({ message: "No portal access found" });

      let sessionAccess = access;
      if (access.status === "invited" && access.boardRoleId) {
        const [boardRole] = access.boardRoleId
          ? (await storage.getBoardRoles(access.associationId)).filter((row) => row.id === access.boardRoleId)
          : [];
        if (!boardRole) {
          return res.status(403).json({ message: "Board invite is not linked to an active board role" });
        }
        sessionAccess = (await storage.updatePortalAccess(access.id, {
          status: "active",
          acceptedAt: access.acceptedAt ?? new Date(),
        }, "system")) ?? access;
      }

      if (sessionAccess.status !== "active") return res.status(404).json({ message: "No active portal access found" });
      await storage.touchPortalAccessLogin(sessionAccess.id);
      res.json({ portalAccessId: sessionAccess.id, associationId: sessionAccess.associationId, role: sessionAccess.role, email: sessionAccess.email });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/portal/me", requirePortal, async (req: PortalRequest, res) => {
    const access = await storage.getPortalAccessById(req.portalAccessId || "");
    if (!access) return res.status(404).json({ message: "Portal access not found" });
    res.json({
      ...access,
      hasBoardAccess: Boolean(req.portalHasBoardAccess),
      effectiveRole: req.portalEffectiveRole || access.role,
      boardRoleId: req.portalBoardRoleId ?? access.boardRoleId ?? null,
    });
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
        portalAccessId: req.portalHasBoardAccess ? undefined : req.portalAccessId,
        associationId: req.portalHasBoardAccess ? req.portalAssociationId : undefined,
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/portal/maintenance-attachments", requirePortal, upload.array("files", 5), async (req: PortalRequest, res) => {
    try {
      const files = Array.isArray(req.files) ? req.files : [];
      if (!files.length) {
        return res.status(400).json({ message: "At least one file is required" });
      }
      const urls = files.map((file) => `/api/uploads/${file.filename}`);
      res.status(201).json({ urls });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
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

  app.get("/api/portal/board/overview", requirePortal, requirePortalBoard, async (req: PortalRequest, res) => {
    try {
      const result = await storage.getAssociationOverview(req.portalAssociationId || "");
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/portal/board/dashboard", requirePortal, requirePortalBoard, async (req: PortalRequest, res) => {
    try {
      const associationId = req.portalAssociationId || "";
      const [
        overview,
        budgets,
        ledgerEntries,
        vendorInvoices,
        utilityPayments,
        governanceMeetings,
        governanceTasks,
        auditEntries,
        documents,
        maintenanceRequests,
        noticeSends,
        boardPackages,
        boardRoles,
      ] = await Promise.all([
        storage.getAssociationOverview(associationId),
        storage.getBudgets(associationId),
        storage.getOwnerLedgerEntries(associationId),
        storage.getVendorInvoices(associationId),
        storage.getUtilityPayments(associationId),
        storage.getGovernanceMeetings(associationId),
        storage.getAnnualGovernanceTasks(associationId),
        storage.getAuditLogs(associationId),
        storage.getDocuments(associationId),
        storage.getMaintenanceRequests({ associationId }),
        storage.getNoticeSends(associationId),
        storage.getBoardPackages(associationId),
        storage.getBoardRoles(associationId),
      ]);

      const totalCharges = ledgerEntries
        .filter((entry) => entry.entryType === "charge" || entry.entryType === "assessment" || entry.entryType === "late-fee")
        .reduce((sum, entry) => sum + entry.amount, 0);
      const totalPayments = ledgerEntries
        .filter((entry) => entry.entryType === "payment" || entry.entryType === "credit")
        .reduce((sum, entry) => sum + Math.abs(entry.amount), 0);
      const openBalance = Math.max(0, totalCharges - totalPayments);
      const totalInvoices = vendorInvoices.reduce((sum, invoice) => sum + invoice.amount, 0);
      const totalUtilities = utilityPayments.reduce((sum, payment) => sum + payment.amount, 0);
      const openTasks = governanceTasks.filter((task) => task.status !== "done");
      const upcomingMeetings = governanceMeetings
        .filter((meeting) => new Date(meeting.scheduledAt) >= new Date())
        .slice(0, 5);
      const draftMeetings = governanceMeetings.filter((meeting) => meeting.summaryStatus === "draft");
      const unpublishedDocuments = documents.filter((document) => document.isPortalVisible !== 1).slice(0, 10);
      const recentActivity = auditEntries.slice(0, 20);
      const recentMaintenanceRequests = maintenanceRequests.slice(0, 8);
      const boardRole = boardRoles.find((role) => role.id === req.portalBoardRoleId) ?? null;
      const meetingStateCounts = {
        scheduled: governanceMeetings.filter((meeting) => meeting.status === "scheduled").length,
        "in-progress": governanceMeetings.filter((meeting) => meeting.status === "in-progress").length,
        completed: governanceMeetings.filter((meeting) => meeting.status === "completed").length,
        cancelled: governanceMeetings.filter((meeting) => meeting.status === "cancelled").length,
      };
      const meetingSummaryCounts = {
        draft: governanceMeetings.filter((meeting) => meeting.summaryStatus === "draft").length,
        published: governanceMeetings.filter((meeting) => meeting.summaryStatus === "published").length,
      };
      const taskStateCounts = {
        todo: governanceTasks.filter((task) => task.status === "todo").length,
        "in-progress": governanceTasks.filter((task) => task.status === "in-progress").length,
        done: governanceTasks.filter((task) => task.status === "done").length,
      };
      const maintenanceStateCounts = {
        submitted: maintenanceRequests.filter((request) => request.status === "submitted").length,
        triaged: maintenanceRequests.filter((request) => request.status === "triaged").length,
        "in-progress": maintenanceRequests.filter((request) => request.status === "in-progress").length,
        resolved: maintenanceRequests.filter((request) => request.status === "resolved").length,
        closed: maintenanceRequests.filter((request) => request.status === "closed").length,
        rejected: maintenanceRequests.filter((request) => request.status === "rejected").length,
      };
      const noticeStateCounts = noticeSends.reduce<Record<string, number>>((acc, send) => {
        acc[send.status] = (acc[send.status] ?? 0) + 1;
        return acc;
      }, {});
      const boardPackageStateCounts = {
        draft: boardPackages.filter((item) => item.status === "draft").length,
        approved: boardPackages.filter((item) => item.status === "approved").length,
        distributed: boardPackages.filter((item) => item.status === "distributed").length,
      };
      const documentsPortalVisible = documents.filter((document) => document.isPortalVisible === 1).length;
      const documentsInternalOnly = documents.length - documentsPortalVisible;
      const urgentOpenMaintenanceCount = maintenanceRequests.filter(
        (request) =>
          (request.priority === "urgent" || request.priority === "high") &&
          request.status !== "resolved" &&
          request.status !== "closed" &&
          request.status !== "rejected",
      ).length;
      const attentionItems = [
        ...(overview.maintenanceOverdue > 0 ? [{
          key: "maintenance-overdue",
          label: "Overdue maintenance requires action",
          detail: `${overview.maintenanceOverdue} maintenance items are overdue.`,
          tone: "high",
        }] : []),
        ...(openTasks.filter((task) => task.dueDate && new Date(task.dueDate) < new Date()).length > 0 ? [{
          key: "governance-overdue",
          label: "Governance tasks are overdue",
          detail: `${openTasks.filter((task) => task.dueDate && new Date(task.dueDate) < new Date()).length} governance tasks are past due.`,
          tone: "high",
        }] : []),
        ...(upcomingMeetings.length > 0 ? [{
          key: "upcoming-meetings",
          label: "Meetings need preparation",
          detail: `${upcomingMeetings.length} upcoming meetings are on the calendar.`,
          tone: "medium",
        }] : []),
        ...(draftMeetings.length > 0 ? [{
          key: "draft-meetings",
          label: "Meeting summaries remain in draft",
          detail: `${draftMeetings.length} meeting records have not been published.`,
          tone: "medium",
        }] : []),
        ...(openBalance > 0 ? [{
          key: "open-balance",
          label: "Owner balance exposure is still open",
          detail: `$${openBalance.toFixed(2)} remains outstanding on the owner ledger.`,
          tone: "medium",
        }] : []),
        ...(unpublishedDocuments.length > 0 ? [{
          key: "document-visibility",
          label: "Documents may need board review or publication",
          detail: `${unpublishedDocuments.length} documents are not portal-visible.`,
          tone: "low",
        }] : []),
      ];

      res.json({
        attention: {
          items: attentionItems,
          maintenanceOverdue: overview.maintenanceOverdue,
          overdueGovernanceTasks: openTasks.filter((task) => task.dueDate && new Date(task.dueDate) < new Date()).length,
          upcomingMeetingCount: upcomingMeetings.length,
          draftMeetingCount: draftMeetings.length,
          unpublishedDocumentCount: unpublishedDocuments.length,
        },
        financial: {
          budgetCount: budgets.length,
          ledgerEntryCount: ledgerEntries.length,
          totalCharges,
          totalPayments,
          openBalance: Number((totalCharges - totalPayments).toFixed(2)),
          totalInvoices: Number(totalInvoices.toFixed(2)),
          totalUtilities: Number(totalUtilities.toFixed(2)),
          recentLedgerEntries: ledgerEntries.slice(0, 10),
          recentInvoices: vendorInvoices.slice(0, 10),
        },
        governance: {
          meetingCount: governanceMeetings.length,
          upcomingMeetings: upcomingMeetings.map((meeting) => ({
            id: meeting.id,
            title: meeting.title,
            scheduledAt: meeting.scheduledAt.toISOString(),
            meetingType: meeting.meetingType,
            status: meeting.status,
            summaryStatus: meeting.summaryStatus,
          })),
          taskCount: governanceTasks.length,
          openTaskCount: openTasks.length,
          openTasks: openTasks.slice(0, 10).map((task) => ({
            id: task.id,
            title: task.title,
            dueDate: task.dueDate ? task.dueDate.toISOString() : null,
            status: task.status,
          })),
        },
        workflowStates: {
          access: {
            status: req.portalRole === "board-member" ? "active" : "owner-plus-board",
            effectiveRole: req.portalEffectiveRole || req.portalRole || "board-member",
            boardRole: boardRole?.role ?? null,
            boardTerm: boardRole
              ? {
                  startDate: boardRole.startDate.toISOString(),
                  endDate: boardRole.endDate ? boardRole.endDate.toISOString() : null,
                  isActive: !boardRole.endDate || new Date(boardRole.endDate) >= new Date(),
                }
              : null,
          },
          governance: {
            meetingsByStatus: meetingStateCounts,
            summariesByStatus: meetingSummaryCounts,
            tasksByStatus: taskStateCounts,
          },
          maintenance: {
            requestsByStatus: maintenanceStateCounts,
            urgentOpenCount: urgentOpenMaintenanceCount,
            recent: recentMaintenanceRequests.map((request) => ({
              id: request.id,
              title: request.title,
              priority: request.priority,
              status: request.status,
              responseDueAt: request.responseDueAt ? request.responseDueAt.toISOString() : null,
              locationText: request.locationText,
              createdAt: request.createdAt.toISOString(),
            })),
          },
          communications: {
            noticesByStatus: noticeStateCounts,
            documentsPortalVisible,
            documentsInternalOnly,
            boardPackagesByStatus: boardPackageStateCounts,
          },
        },
        activity: {
          recent: recentActivity.map((entry) => ({
            id: entry.id,
            entityType: entry.entityType,
            action: entry.action,
            actorEmail: entry.actorEmail,
            createdAt: entry.createdAt,
          })),
        },
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/portal/board/association", requirePortal, requirePortalBoard, async (req: PortalRequest, res) => {
    try {
      const associations = await storage.getAssociations();
      const association = associations.find((row) => row.id === req.portalAssociationId);
      if (!association) return res.status(404).json({ message: "Association not found" });
      res.json(association);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/portal/board/association", requirePortal, requirePortalBoard, async (req: PortalRequest, res) => {
    try {
      const payload = insertAssociationSchema.partial().parse({
        name: req.body?.name,
        associationType: req.body?.associationType,
        dateFormed: req.body?.dateFormed,
        ein: req.body?.ein,
        address: req.body?.address,
        city: req.body?.city,
        state: req.body?.state,
        country: req.body?.country,
      });
      const result = await storage.updateAssociation(
        req.portalAssociationId || "",
        payload,
        `portal:${req.portalEmail || "unknown"}`,
      );
      if (!result) return res.status(404).json({ message: "Association not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/portal/board/meetings", requirePortal, requirePortalBoard, async (req: PortalRequest, res) => {
    try {
      const result = await storage.getGovernanceMeetings(req.portalAssociationId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/portal/board/meetings", requirePortal, requirePortalBoard, async (req: PortalRequest, res) => {
    try {
      const parsed = insertGovernanceMeetingSchema.parse({
        associationId: req.portalAssociationId,
        meetingType: req.body?.meetingType,
        title: req.body?.title,
        scheduledAt: req.body?.scheduledAt,
        location: req.body?.location ?? null,
        status: req.body?.status,
        agenda: req.body?.agenda ?? null,
        notes: req.body?.notes ?? null,
        summaryText: req.body?.summaryText ?? null,
        summaryStatus: req.body?.summaryStatus,
      });
      const result = await storage.createGovernanceMeeting(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/portal/board/meetings/:id", requirePortal, requirePortalBoard, async (req: PortalRequest, res) => {
    try {
      const meeting = (await storage.getGovernanceMeetings(req.portalAssociationId)).find((row) => row.id === getParam(req.params.id));
      if (!meeting) return res.status(404).json({ message: "Meeting not found in association" });
      const parsed = insertGovernanceMeetingSchema.partial().parse({
        meetingType: req.body?.meetingType,
        title: req.body?.title,
        scheduledAt: req.body?.scheduledAt,
        location: req.body?.location,
        status: req.body?.status,
        agenda: req.body?.agenda,
        notes: req.body?.notes,
        summaryText: req.body?.summaryText,
        summaryStatus: req.body?.summaryStatus,
      });
      const result = await storage.updateGovernanceMeeting(meeting.id, parsed);
      if (!result) return res.status(404).json({ message: "Meeting not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/portal/board/governance-tasks", requirePortal, requirePortalBoard, async (req: PortalRequest, res) => {
    try {
      const result = await storage.getAnnualGovernanceTasks(req.portalAssociationId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/portal/board/governance-tasks", requirePortal, requirePortalBoard, async (req: PortalRequest, res) => {
    try {
      const parsed = insertAnnualGovernanceTaskSchema.parse({
        associationId: req.portalAssociationId,
        title: req.body?.title,
        description: req.body?.description ?? null,
        status: req.body?.status,
        ownerPersonId: req.body?.ownerPersonId ?? null,
        dueDate: req.body?.dueDate ?? null,
        notes: req.body?.notes ?? null,
      });
      const result = await storage.createAnnualGovernanceTask(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/portal/board/governance-tasks/:id", requirePortal, requirePortalBoard, async (req: PortalRequest, res) => {
    try {
      const task = (await storage.getAnnualGovernanceTasks(req.portalAssociationId)).find((row) => row.id === getParam(req.params.id));
      if (!task) return res.status(404).json({ message: "Governance task not found in association" });
      const parsed = insertAnnualGovernanceTaskSchema.partial().parse({
        title: req.body?.title,
        description: req.body?.description,
        status: req.body?.status,
        ownerPersonId: req.body?.ownerPersonId,
        dueDate: req.body?.dueDate,
        notes: req.body?.notes,
      });
      const result = await storage.updateAnnualGovernanceTask(task.id, parsed);
      if (!result) return res.status(404).json({ message: "Governance task not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/portal/board/documents", requirePortal, requirePortalBoard, async (req: PortalRequest, res) => {
    try {
      const result = await storage.getDocuments(req.portalAssociationId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/portal/board/documents", requirePortal, requirePortalBoard, upload.single("file"), async (req: PortalRequest, res) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ message: "File is required" });
      const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
      const documentType = typeof req.body?.documentType === "string" ? req.body.documentType.trim() : "";
      if (!title || !documentType) {
        return res.status(400).json({ message: "title and documentType are required" });
      }
      const result = await storage.createDocument({
        associationId: req.portalAssociationId || "",
        title,
        documentType,
        portalAudience: typeof req.body?.portalAudience === "string" ? req.body.portalAudience : "owner",
        isPortalVisible: req.body?.isPortalVisible === "1" || req.body?.isPortalVisible === "true" ? 1 : 0,
        uploadedBy: `portal:${req.portalEmail || "unknown"}`,
        fileUrl: `/api/uploads/${file.filename}`,
      }, `portal:${req.portalEmail || "unknown"}`);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/portal/board/documents/:id", requirePortal, requirePortalBoard, async (req: PortalRequest, res) => {
    try {
      const document = (await storage.getDocuments(req.portalAssociationId)).find((row) => row.id === getParam(req.params.id));
      if (!document) return res.status(404).json({ message: "Document not found in association" });
      const payload = insertDocumentSchema.partial().parse({
        title: req.body?.title,
        documentType: req.body?.documentType,
        portalAudience: req.body?.portalAudience,
        isPortalVisible: req.body?.isPortalVisible,
      });
      const result = await storage.updateDocument(document.id, payload, `portal:${req.portalEmail || "unknown"}`);
      if (!result) return res.status(404).json({ message: "Document not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/portal/board/communications/sends", requirePortal, requirePortalBoard, async (req: PortalRequest, res) => {
    try {
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const result = await storage.getNoticeSends(req.portalAssociationId, status);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/portal/board/communications/history", requirePortal, requirePortalBoard, async (req: PortalRequest, res) => {
    try {
      const result = await storage.getCommunicationHistory(req.portalAssociationId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/portal/board/communications/send", requirePortal, requirePortalBoard, async (req: PortalRequest, res) => {
    try {
      const recipientEmail = typeof req.body?.recipientEmail === "string" ? req.body.recipientEmail.trim() : "";
      const subject = typeof req.body?.subject === "string" ? req.body.subject.trim() : "";
      const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
      if (!recipientEmail || !subject || !body) {
        return res.status(400).json({ message: "recipientEmail, subject, and body are required" });
      }
      const result = await storage.sendNotice({
        associationId: req.portalAssociationId,
        recipientEmail,
        subject,
        body,
        scheduledFor: typeof req.body?.scheduledFor === "string" ? req.body.scheduledFor : null,
        requireApproval: req.body?.requireApproval === true || req.body?.requireApproval === "true",
        sentBy: `portal:${req.portalEmail || "unknown"}`,
      });
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/portal/board/maintenance-requests/:id", requirePortal, requirePortalBoard, async (req: PortalRequest, res) => {
    try {
      const request = (await storage.getMaintenanceRequests({ associationId: req.portalAssociationId })).find((row) => row.id === getParam(req.params.id));
      if (!request) return res.status(404).json({ message: "Maintenance request not found in association" });
      const parsed = insertMaintenanceRequestSchema.partial().parse({
        title: req.body?.title,
        description: req.body?.description,
        locationText: req.body?.locationText,
        category: req.body?.category,
        priority: req.body?.priority,
        status: req.body?.status,
        assignedTo: req.body?.assignedTo,
        resolutionNotes: req.body?.resolutionNotes,
      });
      const result = await storage.updateMaintenanceRequest(request.id, parsed);
      if (!result) return res.status(404).json({ message: "Maintenance request not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/portal/board/vendor-invoices", requirePortal, requirePortalBoard, async (req: PortalRequest, res) => {
    try {
      const result = await storage.getVendorInvoices(req.portalAssociationId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/portal/board/vendor-invoices", requirePortal, requirePortalBoard, async (req: PortalRequest, res) => {
    try {
      const parsed = insertVendorInvoiceSchema.parse({
        associationId: req.portalAssociationId,
        vendorId: req.body?.vendorId ?? null,
        vendorName: req.body?.vendorName,
        invoiceNumber: req.body?.invoiceNumber ?? null,
        invoiceDate: req.body?.invoiceDate,
        dueDate: req.body?.dueDate ?? null,
        amount: req.body?.amount,
        status: req.body?.status,
        accountId: req.body?.accountId ?? null,
        categoryId: req.body?.categoryId ?? null,
        notes: req.body?.notes ?? null,
      });
      const result = await storage.createVendorInvoice(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/portal/board/vendor-invoices/:id", requirePortal, requirePortalBoard, async (req: PortalRequest, res) => {
    try {
      const invoice = (await storage.getVendorInvoices(req.portalAssociationId)).find((row) => row.id === getParam(req.params.id));
      if (!invoice) return res.status(404).json({ message: "Vendor invoice not found in association" });
      const parsed = insertVendorInvoiceSchema.partial().parse({
        vendorId: req.body?.vendorId,
        vendorName: req.body?.vendorName,
        invoiceNumber: req.body?.invoiceNumber,
        invoiceDate: req.body?.invoiceDate,
        dueDate: req.body?.dueDate,
        amount: req.body?.amount,
        status: req.body?.status,
        accountId: req.body?.accountId,
        categoryId: req.body?.categoryId,
        notes: req.body?.notes,
      });
      const result = await storage.updateVendorInvoice(invoice.id, parsed);
      if (!result) return res.status(404).json({ message: "Vendor invoice not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/portal/board/owner-ledger/entries", requirePortal, requirePortalBoard, async (req: PortalRequest, res) => {
    try {
      const result = await storage.getOwnerLedgerEntries(req.portalAssociationId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/portal/board/owner-ledger/summary", requirePortal, requirePortalBoard, async (req: PortalRequest, res) => {
    try {
      const result = await storage.getOwnerLedgerSummary(req.portalAssociationId || "");
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/portal/board/owner-ledger/entries", requirePortal, requirePortalBoard, async (req: PortalRequest, res) => {
    try {
      const unit = (await storage.getUnits(req.portalAssociationId)).find((row) => row.id === req.body?.unitId);
      if (!unit) return res.status(400).json({ message: "Unit not found in association" });
      const person = (await storage.getPersons(req.portalAssociationId)).find((row) => row.id === req.body?.personId);
      if (!person) return res.status(400).json({ message: "Person not found in association" });
      const parsed = insertOwnerLedgerEntrySchema.parse({
        associationId: req.portalAssociationId,
        unitId: unit.id,
        personId: person.id,
        entryType: req.body?.entryType,
        amount: req.body?.amount,
        postedAt: req.body?.postedAt,
        description: req.body?.description ?? null,
        referenceType: req.body?.referenceType ?? null,
        referenceId: req.body?.referenceId ?? null,
      });
      const result = await storage.createOwnerLedgerEntry(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/portal/board/persons", requirePortal, requirePortalBoard, async (req: PortalRequest, res) => {
    try {
      const result = await storage.getPersons(req.portalAssociationId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/portal/board/persons/:id", requirePortal, requirePortalBoard, async (req: PortalRequest, res) => {
    try {
      const people = await storage.getPersons(req.portalAssociationId);
      const person = people.find((row) => row.id === getParam(req.params.id));
      if (!person) return res.status(404).json({ message: "Person not found in association" });
      const payload = insertPersonSchema.partial().parse(req.body);
      const result = await storage.updatePerson(person.id, payload, `portal:${req.portalEmail || "unknown"}`);
      if (!result) return res.status(404).json({ message: "Person not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/portal/board/units", requirePortal, requirePortalBoard, async (req: PortalRequest, res) => {
    try {
      const result = await storage.getUnits(req.portalAssociationId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/portal/board/units/:id", requirePortal, requirePortalBoard, async (req: PortalRequest, res) => {
    try {
      const unit = (await storage.getUnits(req.portalAssociationId)).find((row) => row.id === getParam(req.params.id));
      if (!unit) return res.status(404).json({ message: "Unit not found in association" });
      const payload = insertUnitSchema.partial().parse({
        buildingId: req.body?.buildingId,
        unitNumber: req.body?.unitNumber,
        building: req.body?.building,
        squareFootage: req.body?.squareFootage,
      });
      const result = await storage.updateUnit(unit.id, payload, `portal:${req.portalEmail || "unknown"}`);
      if (!result) return res.status(404).json({ message: "Unit not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/portal/board/roles", requirePortal, requirePortalBoard, async (req: PortalRequest, res) => {
    try {
      const result = await storage.getBoardRoles(req.portalAssociationId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/portal/board/roles", requirePortal, requirePortalBoard, async (req: PortalRequest, res) => {
    try {
      const payload = insertBoardRoleSchema.parse({
        personId: req.body?.personId,
        associationId: req.portalAssociationId,
        role: req.body?.role,
        startDate: req.body?.startDate,
        endDate: req.body?.endDate ?? null,
      });
      const result = await storage.createBoardRole(payload, `portal:${req.portalEmail || "unknown"}`);
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

  app.get("/api/admin/roadmap/feature-tree", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (_req, res) => {
    try {
      const result = await buildFtphDocumentationFeatureTree();
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
      const associationId = getAssociationIdQuery(req);
      if (associationId) {
        assertAssociationScope(req as AdminRequest, associationId);
      }
      const result = await storage.getAdminAnalytics(days, associationId || undefined);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/board-packages/templates", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      res.json(await storage.getBoardPackageTemplates(getAssociationIdQuery(req)));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/board-packages/templates", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const parsed = insertBoardPackageTemplateSchema.parse(req.body);
      assertAssociationScope(req as AdminRequest, parsed.associationId);
      res.status(201).json(await storage.createBoardPackageTemplate(parsed));
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/admin/board-packages/templates/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "board-package-template", getParam(req.params.id));
      const parsed = insertBoardPackageTemplateSchema.partial().parse(req.body);
      const result = await storage.updateBoardPackageTemplate(getParam(req.params.id), parsed);
      if (!result) return res.status(404).json({ message: "Board package template not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/admin/board-packages", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      res.json(await storage.getBoardPackages(getAssociationIdQuery(req)));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/board-packages/generate/:templateId", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "board-package-template", getParam(req.params.templateId));
      res.status(201).json(await storage.generateBoardPackage(getParam(req.params.templateId), {
        periodLabel: req.body?.periodLabel,
        meetingId: req.body?.meetingId,
      }));
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/admin/board-packages/run-scheduled", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const associationId = getAssociationIdQuery(req) || req.body?.associationId;
      if (associationId) {
        assertAssociationScope(req as AdminRequest, associationId);
      }
      res.json(await storage.runScheduledBoardPackageGeneration({
        associationId: associationId || undefined,
        actorEmail: (req as AdminRequest).adminUserEmail || "admin",
      }));
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/admin/board-packages/:id/distribute", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "board-package", getParam(req.params.id));
      const recipientEmails = Array.isArray(req.body?.recipientEmails)
        ? req.body.recipientEmails.filter((value: unknown): value is string => typeof value === "string")
        : [];
      res.json(await storage.distributeBoardPackage(getParam(req.params.id), {
        recipientEmails,
        message: typeof req.body?.message === "string" ? req.body.message : null,
        actorEmail: (req as AdminRequest).adminUserEmail || "admin",
      }));
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/admin/board-packages/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      await assertResourceScope(req as AdminRequest, "board-package", getParam(req.params.id));
      const parsed = insertBoardPackageSchema.partial().parse(req.body);
      const result = await storage.updateBoardPackage(getParam(req.params.id), parsed, (req as AdminRequest).adminUserEmail || "admin");
      if (!result) return res.status(404).json({ message: "Board package not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/operations/dashboard", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getOperationsDashboard(getAssociationIdQuery(req));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/operations/reports/:reportType", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const reportType = getParam(req.params.reportType);
      if (reportType !== "vendors" && reportType !== "work-orders" && reportType !== "maintenance") {
        return res.status(400).json({ message: "Invalid report type" });
      }
      const result = await storage.exportOperationsReport(reportType, getAssociationIdQuery(req));
      res.setHeader("Content-Type", result.contentType);
      res.setHeader("Content-Disposition", `attachment; filename=\"${result.filename}\"`);
      res.send(result.body);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  return httpServer;
}
