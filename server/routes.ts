import { z } from "zod";
import type { Express, NextFunction, Request, Response } from "express";
import { type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import { createHmac, timingSafeEqual } from "crypto";
import { storage } from "./storage";
import { db } from "./db";
import { getGoogleOAuthStatus, registerAuthRoutes } from "./auth";
import { buildFtphDocumentationFeatureTree } from "./ftph-feature-tree";
import { and, eq, gte, ilike, inArray, isNotNull, isNull, notInArray, or, sql } from "drizzle-orm";
import {
  getEmailLog,
  getEmailLogs,
  getEmailPolicy,
  getEmailProviderStatus,
  getTrackingPixelBuffer,
  handleEmailClickTracking,
  handleEmailOpenTracking,
  isEmailProviderConfigured,
  purgeTrackingData,
  sendPlatformEmail,
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
  boardPackages,
  boardPackageTemplates,
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
  governanceComplianceTemplates,
  governanceTemplateItems,
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
  workOrders,
  maintenanceRequests,
  vendors,
  annualGovernanceTasks,
  ownerLedgerEntries,
  ownerships,
  persons,
  units,
  associationInsurancePolicies,
  insertAssociationInsurancePolicySchema,
  governanceMeetings,
  associationAssets,
  insertAssociationAssetSchema,
  paymentPlans,
  insertPaymentPlanSchema,
  financialApprovals,
  insertFinancialApprovalSchema,
  paymentReminderRules,
  insertPaymentReminderRuleSchema,
  residentFeedbacks,
  insertResidentFeedbackSchema,
  communityAnnouncements,
  insertCommunityAnnouncementSchema,
  documentVersions,
  noticeTemplates,
  noticeSends,
  governanceReminderRules,
  insertGovernanceReminderRuleSchema,
  delinquencyThresholds,
  insertDelinquencyThresholdSchema,
  delinquencyEscalations,
  insertDelinquencyEscalationSchema,
  collectionsHandoffs,
  insertCollectionsHandoffSchema,
  bankStatementImports,
  bankStatementTransactions,
  insertBankStatementTransactionSchema,
  reconciliationPeriods,
  insertReconciliationPeriodSchema,
  financialAlerts,
  insertFinancialAlertSchema,
  recurringChargeSchedules,
  insertRecurringChargeScheduleSchema,
  recurringChargeRuns,
  insertRecurringChargeRunSchema,
  featureFlags,
  insertFeatureFlagSchema,
  associationFeatureFlags,
  insertAssociationFeatureFlagSchema,
  partialPaymentRules,
  insertPartialPaymentRuleSchema,
  autopayEnrollments,
  insertAutopayEnrollmentSchema,
  autopayRuns,
  savedPaymentMethods,
  insertSavedPaymentMethodSchema,
  webhookSigningSecrets,
  insertWebhookSigningSecretSchema,
  paymentWebhookEvents,
  paymentEventTransitions,
  portalLoginTokens,
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

const SLA_HOURS: Record<string, number> = { urgent: 4, high: 12, medium: 48, low: 120 };
function computeResponseDueAt(priority: string, from: Date = new Date()): Date {
  const hours = SLA_HOURS[priority] ?? 48;
  return new Date(from.getTime() + hours * 60 * 60 * 1000);
}

function getParam(value: string | string[] | undefined): string {
  if (!value) return "";
  return Array.isArray(value) ? value[0] : value;
}

function getAssociationIdQuery(req: Request): string | undefined {
  const requested = typeof req.query.associationId === "string" ? req.query.associationId : undefined;
  const adminReq = req as AdminRequest;

  // platform-admin has unrestricted access; skip scope enforcement
  if (!adminReq.adminRole || adminReq.adminRole === "platform-admin") {
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
  console.log("[applyAdminContext]", {
    adminUserId: adminUser.id,
    email: adminUser.email,
    rawRole: adminUser.role,
    normalizedRole,
    isPublishedState,
  });
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
    console.log("[applyAdminContext][scoped]", {
      email: adminUser.email,
      scopeCount: req.adminScopedAssociationIds.length,
      scopedAssociationIds: req.adminScopedAssociationIds,
    });
  } else {
    req.adminScopedAssociationIds = [];
    console.log("[applyAdminContext][platform-admin] full access granted", { email: adminUser.email });
  }
  req.adminUserId = adminUser.id;
  req.adminUserEmail = adminUser.email;
  req.adminRole = normalizedRole;
}


async function tryHydrateAdminFromSession(req: AdminRequest): Promise<boolean> {
  const authUser = req.user as { id?: string; adminUserId?: string | null; email?: string | null } | undefined;
  if (req.isAuthenticated?.() && authUser) {
    const adminById = authUser.adminUserId
      ? await storage.getAdminUserById(authUser.adminUserId)
      : undefined;
    const adminByEmail = authUser.email
      ? await storage.getAdminUserByEmail(authUser.email.trim().toLowerCase())
      : undefined;

    console.log("[tryHydrateAdminFromSession][passport-path]", {
      authUserId: authUser.id || null,
      authEmail: authUser.email || null,
      sessionAdminUserId: authUser.adminUserId || null,
      adminById: adminById ? { id: adminById.id, role: adminById.role, isActive: adminById.isActive } : null,
      adminByEmail: adminByEmail ? { id: adminByEmail.id, role: adminByEmail.role, isActive: adminByEmail.isActive } : null,
    });

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

    if (resolvedAdmin && resolvedAdmin.isActive === 1) {
      console.log("[tryHydrateAdminFromSession][resolved]", { email: authUser.email, role: resolvedAdmin.role, adminUserId: resolvedAdmin.id });
      await applyAdminContext(req, resolvedAdmin);
      return true;
    }
    // No admin record found for this authenticated user. Admin accounts must be explicitly
    // created by a platform-admin — automatic promotion from portal access is disabled.
    // To grant access, a platform-admin must create an admin user for this email.
    console.error("[tryHydrateAdminFromSession][no-admin-record]", {
      authEmail: authUser.email || null,
      hint: "Admin accounts must be explicitly created. Set PLATFORM_ADMIN_EMAILS to bootstrap the first platform-admin.",
    });
    return false;
  }

  const serializedAuthUserId = (req.session as { passport?: { user?: string } } | undefined)?.passport?.user;
  if (!serializedAuthUserId) {
    console.log("[tryHydrateAdminFromSession][no-session]", { path: req.path });
    return false;
  }
  const sessionAuthUser = await storage.getAuthUserById(String(serializedAuthUserId));
  if (!sessionAuthUser || sessionAuthUser.isActive !== 1) {
    console.error("[tryHydrateAdminFromSession][session-user-not-found-or-inactive]", { serializedAuthUserId });
    return false;
  }

  if (!req.user && req.login) {
    await new Promise<void>((resolve, reject) => {
      req.login!(sessionAuthUser as Express.User, (error) => {
        if (error) return reject(error);
        return resolve();
      });
    });
  }

  console.log("[tryHydrateAdminFromSession][session-fallback-path]", {
    sessionAuthUserId: sessionAuthUser.id,
    sessionEmail: sessionAuthUser.email,
    sessionAdminUserId: sessionAuthUser.adminUserId || null,
  });

  const adminUser = sessionAuthUser.adminUserId
    ? await storage.getAdminUserById(sessionAuthUser.adminUserId)
    : await storage.getAdminUserByEmail(sessionAuthUser.email);
  if (!adminUser || adminUser.isActive !== 1) {
    // Admin account does not exist or is inactive. Must be explicitly created by a platform-admin.
    console.error("[tryHydrateAdminFromSession][no-admin-record]", {
      sessionEmail: sessionAuthUser.email,
      sessionAdminUserId: sessionAuthUser.adminUserId || null,
      hint: "Admin accounts must be explicitly created. Set PLATFORM_ADMIN_EMAILS to bootstrap the first platform-admin.",
    });
    return false;
  }

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
  if (req.adminRole === "platform-admin") return;
  const scopedAssociationIds = req.adminScopedAssociationIds ?? [];
  if (!associationId) {
    throw new Error("associationId is required");
  }
  if (req.adminRole && scopedAssociationIds.length > 0 && !scopedAssociationIds.includes(associationId)) {
    throw new Error("Association is outside admin scope");
  }
}

function assertAssociationInputScope(req: AdminRequest, associationId: string | null | undefined) {
  if (req.adminRole === "platform-admin") return;
  if (!associationId) {
    throw new Error("associationId is required");
  }
  assertAssociationScope(req, associationId);
}

async function assertResourceScope(req: AdminRequest, resourceType: string, id: string) {
  if (req.adminRole === "platform-admin") return;
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

  // Health/diagnostics endpoint — shows DB state for deployment verification
  app.get("/api/health", async (_req, res) => {
    try {
      const [countsResult, assocListResult, authResult] = await Promise.all([
        db.execute(sql`
          SELECT
            (SELECT COUNT(*)::int FROM associations) AS associations,
            (SELECT COUNT(*)::int FROM units) AS units,
            (SELECT COUNT(*)::int FROM buildings) AS buildings,
            (SELECT COUNT(*)::int FROM persons) AS persons,
            (SELECT COUNT(*)::int FROM auth_users) AS auth_users,
            (SELECT COUNT(*)::int FROM admin_users) AS admin_users,
            (SELECT COUNT(*)::int FROM admin_users WHERE is_active = 1 AND role = 'platform-admin') AS platform_admins
        `),
        db.execute(sql`
          SELECT id, name, city, state,
            (SELECT COUNT(*)::int FROM units u WHERE u.association_id = a.id) AS unit_count,
            (SELECT COUNT(*)::int FROM buildings b WHERE b.association_id = a.id) AS building_count
          FROM associations a
          ORDER BY name
          LIMIT 50
        `),
        db.execute(sql`
          SELECT id, email, admin_user_id, is_active, last_login_at
          FROM auth_users
          ORDER BY last_login_at DESC NULLS LAST
          LIMIT 10
        `),
      ]);
      const c = countsResult.rows[0] as any;
      const dbHost = process.env.PGHOST ?? "unknown";
      const dbName = process.env.PGDATABASE ?? "unknown";
      res.json({
        status: "ok",
        env: process.env.NODE_ENV ?? "development",
        db: { host: dbHost, name: dbName },
        emailProviderConfigured: isEmailProviderConfigured(),
        counts: {
          associations: c.associations,
          units: c.units,
          buildings: c.buildings,
          persons: c.persons,
          auth_users: c.auth_users,
          admin_users: c.admin_users,
          platform_admins: c.platform_admins,
        },
        associations: assocListResult.rows,
        recentAuthUsers: authResult.rows,
      });
    } catch (err: any) {
      res.status(500).json({ status: "error", message: err.message });
    }
  });

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

  app.get("/api/dashboard/alerts", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      const now = new Date();
      const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

      const [workOrders, complianceTasks, vendorAlerts] = await Promise.all([
        storage.getWorkOrders({ associationId }),
        storage.getAnnualGovernanceTasks(associationId),
        storage.getVendorRenewalAlerts(associationId),
      ]);

      // Work orders that are open/urgent (not closed or cancelled)
      const openWorkOrders = workOrders.filter(
        (wo) => wo.status !== "closed" && wo.status !== "cancelled",
      );
      const urgentWorkOrders = openWorkOrders.filter((wo) => wo.priority === "urgent");
      const overdueWorkOrders = openWorkOrders.filter((wo) => {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return new Date(wo.createdAt) < sevenDaysAgo && wo.status === "open";
      });

      // Compliance tasks overdue or due within 14 days
      const overdueComplianceTasks = complianceTasks.filter(
        (t) => t.status !== "done" && t.dueDate && new Date(t.dueDate) < now,
      );
      const upcomingComplianceTasks = complianceTasks.filter(
        (t) => t.status !== "done" && t.dueDate && new Date(t.dueDate) >= now && new Date(t.dueDate) <= in14Days,
      );

      // Vendor insurance alerts
      const expiredVendors = vendorAlerts.filter((v) => v.severity === "expired");
      const dueSoonVendors = vendorAlerts.filter((v) => v.severity === "due-soon");

      // Delinquent accounts (only when associationId scoped)
      let delinquentCount = 0;
      let orphanWarnings: Array<{ type: string; message: string; count: number }> = [];
      if (associationId) {
        const ledger = await storage.getOwnerLedgerSummary(associationId);
        delinquentCount = ledger.filter((entry) => entry.balance > 0).length;

        // Orphan detection sweep
        const [allWorkOrders, allVendors] = await Promise.all([
          storage.getWorkOrders({ associationId }),
          storage.getVendors(associationId),
        ]);
        const vendorIds = new Set(allVendors.map((v) => v.id));
        const woWithMissingVendor = allWorkOrders.filter(
          (wo) => wo.vendorId && !vendorIds.has(wo.vendorId) && wo.status !== "closed" && wo.status !== "cancelled",
        );
        if (woWithMissingVendor.length > 0) {
          orphanWarnings.push({ type: "work-order-vendor", message: "Work orders assigned to deleted/missing vendors", count: woWithMissingVendor.length });
        }

        // Ledger entries with no matching ownership
        const allLedger = await storage.getOwnerLedgerEntries(associationId);
        const allOwnerships = await storage.getOwnerships(associationId);
        const ownershipPersonIds = new Set(allOwnerships.map((o) => o.personId));
        const orphanedLedger = allLedger.filter((e) => e.personId && !ownershipPersonIds.has(e.personId));
        if (orphanedLedger.length > 0) {
          orphanWarnings.push({ type: "ledger-no-owner", message: "Ledger entries for persons with no active ownership", count: orphanedLedger.length });
        }
      }

      res.json({
        workOrders: {
          urgent: urgentWorkOrders.length,
          stalledOpen: overdueWorkOrders.length,
          totalOpen: openWorkOrders.length,
          items: urgentWorkOrders.slice(0, 5).map((wo) => ({
            id: wo.id,
            title: wo.title,
            priority: wo.priority,
            status: wo.status,
            associationId: wo.associationId,
          })),
        },
        complianceTasks: {
          overdue: overdueComplianceTasks.length,
          dueSoon: upcomingComplianceTasks.length,
          items: overdueComplianceTasks.slice(0, 5).map((t) => ({
            id: t.id,
            title: t.title,
            dueDate: t.dueDate,
            associationId: t.associationId,
          })),
        },
        vendorInsurance: {
          expired: expiredVendors.length,
          dueSoon: dueSoonVendors.length,
          items: expiredVendors.slice(0, 3).concat(dueSoonVendors.slice(0, 2)).map((v) => ({
            vendorId: v.vendorId,
            vendorName: v.vendorName,
            daysUntilExpiry: v.daysUntilExpiry,
            severity: v.severity,
          })),
        },
        delinquentAccounts: {
          count: delinquentCount,
        },
        orphanWarnings,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/portfolio/summary", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const allAssociations = await storage.getAssociations({ includeArchived: false });
      const visibleAssociations = req.adminRole === "platform-admin"
        ? allAssociations
        : allAssociations.filter((a) => (req.adminScopedAssociationIds ?? []).includes(a.id));

      const summaries = await Promise.all(
        visibleAssociations.map(async (assoc) => {
          const [workOrders, complianceTasks, vendorAlerts, ledgerSummary, insurancePolicies] = await Promise.all([
            storage.getWorkOrders({ associationId: assoc.id }),
            storage.getAnnualGovernanceTasks(assoc.id),
            storage.getVendorRenewalAlerts(assoc.id),
            storage.getOwnerLedgerSummary(assoc.id),
            db.select().from(associationInsurancePolicies).where(eq(associationInsurancePolicies.associationId, assoc.id)),
          ]);
          const now = new Date();
          const openWorkOrders = workOrders.filter((wo) => wo.status !== "closed" && wo.status !== "cancelled").length;
          const urgentWorkOrders = workOrders.filter((wo) => wo.priority === "urgent" && wo.status !== "closed" && wo.status !== "cancelled").length;
          const overdueCompliance = complianceTasks.filter((t) => t.status !== "done" && t.dueDate && new Date(t.dueDate) < now).length;
          const delinquentAccounts = ledgerSummary.filter((e) => e.balance > 0).length;
          const expiredInsurance = insurancePolicies.filter((p) => p.expirationDate && new Date(p.expirationDate) < now).length;
          const expiredVendorInsurance = vendorAlerts.filter((v) => v.severity === "expired").length;
          const alertScore = urgentWorkOrders * 3 + overdueCompliance * 2 + delinquentAccounts + expiredInsurance * 2 + expiredVendorInsurance;
          const health: "good" | "warning" | "critical" = alertScore === 0 ? "good" : alertScore <= 3 ? "warning" : "critical";
          return {
            associationId: assoc.id,
            associationName: assoc.name,
            city: assoc.city || null,
            state: assoc.state || null,
            openWorkOrders,
            urgentWorkOrders,
            overdueCompliance,
            delinquentAccounts,
            expiredInsurance,
            expiredVendorInsurance,
            health,
          };
        })
      );

      res.json(summaries);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Portfolio-level threshold alerts
  app.get("/api/portfolio/threshold-alerts", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const allAssociations = await storage.getAssociations({ includeArchived: false });
      const visibleAssociations = req.adminRole === "platform-admin"
        ? allAssociations
        : allAssociations.filter((a) => (req.adminScopedAssociationIds ?? []).includes(a.id));

      const alerts: { id: string; associationId: string; associationName: string; alertType: string; severity: "critical" | "warning" | "info"; message: string; value: number; threshold: number }[] = [];

      await Promise.all(visibleAssociations.map(async (assoc) => {
        const [workOrders, complianceTasks, ledgerSummary, insurancePolicies] = await Promise.all([
          storage.getWorkOrders({ associationId: assoc.id }),
          storage.getAnnualGovernanceTasks(assoc.id),
          storage.getOwnerLedgerSummary(assoc.id),
          db.select().from(associationInsurancePolicies).where(eq(associationInsurancePolicies.associationId, assoc.id)),
        ]);
        const now = new Date();
        const urgentWOs = workOrders.filter((wo) => wo.priority === "urgent" && wo.status !== "closed" && wo.status !== "cancelled").length;
        const overdueCompliance = complianceTasks.filter((t) => t.status !== "done" && t.dueDate && new Date(t.dueDate) < now).length;
        const delinquentCount = ledgerSummary.filter((e) => e.balance > 0).length;
        const expiredInsurance = insurancePolicies.filter((p) => p.expirationDate && new Date(p.expirationDate) < now).length;
        const expiringIn30 = insurancePolicies.filter((p) => {
          if (!p.expirationDate) return false;
          const exp = new Date(p.expirationDate);
          return exp > now && exp < new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        }).length;
        const delinquentTotal = ledgerSummary.filter((e) => e.balance > 0).reduce((s, e) => s + e.balance, 0);

        if (urgentWOs >= 3) alerts.push({ id: `wo-${assoc.id}`, associationId: assoc.id, associationName: assoc.name, alertType: "urgent_work_orders", severity: "critical", message: `${urgentWOs} urgent open work orders`, value: urgentWOs, threshold: 3 });
        else if (urgentWOs > 0) alerts.push({ id: `wo-${assoc.id}`, associationId: assoc.id, associationName: assoc.name, alertType: "urgent_work_orders", severity: "warning", message: `${urgentWOs} urgent open work orders`, value: urgentWOs, threshold: 1 });

        if (overdueCompliance >= 3) alerts.push({ id: `comp-${assoc.id}`, associationId: assoc.id, associationName: assoc.name, alertType: "overdue_compliance", severity: "critical", message: `${overdueCompliance} overdue compliance tasks`, value: overdueCompliance, threshold: 3 });
        else if (overdueCompliance > 0) alerts.push({ id: `comp-${assoc.id}`, associationId: assoc.id, associationName: assoc.name, alertType: "overdue_compliance", severity: "warning", message: `${overdueCompliance} overdue compliance tasks`, value: overdueCompliance, threshold: 1 });

        if (delinquentCount >= 5) alerts.push({ id: `del-${assoc.id}`, associationId: assoc.id, associationName: assoc.name, alertType: "delinquency", severity: "critical", message: `${delinquentCount} delinquent accounts ($${delinquentTotal.toFixed(0)})`, value: delinquentCount, threshold: 5 });
        else if (delinquentCount > 0) alerts.push({ id: `del-${assoc.id}`, associationId: assoc.id, associationName: assoc.name, alertType: "delinquency", severity: "warning", message: `${delinquentCount} delinquent accounts ($${delinquentTotal.toFixed(0)})`, value: delinquentCount, threshold: 1 });

        if (expiredInsurance > 0) alerts.push({ id: `ins-${assoc.id}`, associationId: assoc.id, associationName: assoc.name, alertType: "expired_insurance", severity: "critical", message: `${expiredInsurance} expired insurance ${expiredInsurance === 1 ? "policy" : "policies"}`, value: expiredInsurance, threshold: 1 });
        if (expiringIn30 > 0) alerts.push({ id: `insexp-${assoc.id}`, associationId: assoc.id, associationName: assoc.name, alertType: "expiring_insurance", severity: "warning", message: `${expiringIn30} insurance ${expiringIn30 === 1 ? "policy" : "policies"} expiring within 30 days`, value: expiringIn30, threshold: 1 });
      }));

      alerts.sort((a, b) => {
        const order = { critical: 0, warning: 1, info: 2 };
        return order[a.severity] - order[b.severity];
      });

      res.json(alerts);
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
      console.log("[GET /api/associations]", {
        adminUserId: adminReq.adminUserId || null,
        adminUserEmail: adminReq.adminUserEmail || null,
        adminRole: adminReq.adminRole || null,
        isPublishedState,
        totalInDb: result.length,
        returnedToClient: scopedResult.length,
        scopedAssociationIds: adminReq.adminRole !== "platform-admin" ? (adminReq.adminScopedAssociationIds ?? []) : "n/a (platform-admin)",
      });
      if (adminReq.adminRole !== "platform-admin" && scopedResult.length === 0 && result.length > 0) {
        console.error("[associations][empty-scope-result]", {
          adminUserId: adminReq.adminUserId || null,
          adminUserEmail: adminReq.adminUserEmail || null,
          adminRole: adminReq.adminRole || null,
          scopedAssociationIds: adminReq.adminScopedAssociationIds ?? [],
          totalAssociations: result.length,
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

  // Insurance policies
  app.get("/api/associations/:id/insurance", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getParam(req.params.id);
      assertAssociationScope(req, associationId);
      const result = await db.select().from(associationInsurancePolicies).where(eq(associationInsurancePolicies.associationId, associationId));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/associations/:id/insurance", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getParam(req.params.id);
      assertAssociationScope(req, associationId);
      const parsed = insertAssociationInsurancePolicySchema.parse({ ...req.body, associationId });
      const [result] = await db.insert(associationInsurancePolicies).values(parsed).returning();
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/associations/:id/insurance/:policyId", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getParam(req.params.id);
      assertAssociationScope(req, associationId);
      const policyId = getParam(req.params.policyId);
      const parsed = insertAssociationInsurancePolicySchema.partial().parse(req.body);
      const [result] = await db.update(associationInsurancePolicies)
        .set({ ...parsed, updatedAt: new Date() })
        .where(eq(associationInsurancePolicies.id, policyId))
        .returning();
      if (!result) return res.status(404).json({ message: "Not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/associations/:id/insurance/:policyId", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getParam(req.params.id);
      assertAssociationScope(req, associationId);
      const policyId = getParam(req.params.policyId);
      await db.delete(associationInsurancePolicies).where(eq(associationInsurancePolicies.id, policyId));
      res.status(204).send();
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

  app.post("/api/units/import", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const rows = z.array(insertUnitSchema).parse(req.body.rows);
      assertAssociationScope(req, rows[0]?.associationId ?? "");
      const results: Array<{ index: number; unitNumber: string; status: "created" | "skipped"; error?: string }> = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          assertAssociationScope(req, row.associationId);
          await storage.createUnit(row, req.adminUserEmail);
          results.push({ index: i, unitNumber: row.unitNumber, status: "created" });
        } catch (err: any) {
          results.push({ index: i, unitNumber: row.unitNumber, status: "skipped", error: err?.code === "23505" ? "Duplicate unit number" : err.message });
        }
      }
      res.json({ results, createdCount: results.filter((r) => r.status === "created").length, skippedCount: results.filter((r) => r.status === "skipped").length });
    } catch (error: any) {
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

  app.post("/api/persons/import", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const rows = z.array(insertPersonSchema).parse(req.body.rows);
      const results: Array<{ index: number; name: string; status: "created" | "skipped"; error?: string }> = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          await storage.createPerson(row, req.adminUserEmail);
          results.push({ index: i, name: `${row.firstName} ${row.lastName}`, status: "created" });
        } catch (err: any) {
          results.push({ index: i, name: `${row.firstName} ${row.lastName}`, status: "skipped", error: err.message });
        }
      }
      res.json({ results, createdCount: results.filter((r) => r.status === "created").length, skippedCount: results.filter((r) => r.status === "skipped").length });
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
      const personId = getParam(req.params.id);
      // Relationship validation — warn if person has dependent records
      if (req.query.force !== "true") {
        const [ledgerCount, ownershipCount, boardRoleCount] = await Promise.all([
          db.select().from(ownerLedgerEntries).where(eq(ownerLedgerEntries.personId, personId)).then((r) => r.length),
          db.select().from(ownerships).where(eq(ownerships.personId, personId)).then((r) => r.length),
          db.select().from(boardRoles).where(eq(boardRoles.personId, personId)).then((r) => r.length),
        ]);
        const warnings: string[] = [];
        if (ledgerCount > 0) warnings.push(`${ledgerCount} ledger entr${ledgerCount === 1 ? "y" : "ies"}`);
        if (ownershipCount > 0) warnings.push(`${ownershipCount} ownership record${ownershipCount === 1 ? "" : "s"}`);
        if (boardRoleCount > 0) warnings.push(`${boardRoleCount} board role${boardRoleCount === 1 ? "" : "s"}`);
        if (warnings.length > 0) {
          return res.status(409).json({
            message: `This person has dependent records: ${warnings.join(", ")}. Delete these first or pass ?force=true to remove anyway.`,
            dependentRecords: { ledgerCount, ownershipCount, boardRoleCount },
          });
        }
      }
      const deleted = await storage.deletePerson(personId, req.adminUserEmail);
      if (!deleted) return res.status(404).json({ message: "Not found" });
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Global cross-module search
  app.get("/api/search", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
      if (!q || q.length < 2) return res.json({ results: [] });
      const assocId = getAssociationIdQuery(req);
      const pattern = `%${q}%`;

      const [matchPersons, matchUnits, matchVendors, matchWorkOrders, matchDocs] = await Promise.all([
        db.select({ id: persons.id, firstName: persons.firstName, lastName: persons.lastName, email: persons.email })
          .from(persons)
          .where(or(ilike(persons.firstName, pattern), ilike(persons.lastName, pattern), ilike(persons.email, pattern)))
          .limit(5),
        db.select({ id: units.id, unitNumber: units.unitNumber, associationId: units.associationId })
          .from(units)
          .where(ilike(units.unitNumber, pattern))
          .limit(5),
        db.select({ id: vendors.id, name: vendors.name })
          .from(vendors)
          .where(ilike(vendors.name, pattern))
          .limit(5),
        db.select({ id: workOrders.id, title: workOrders.title, associationId: workOrders.associationId })
          .from(workOrders)
          .where(ilike(workOrders.title, pattern))
          .limit(5),
        db.select({ id: documents.id, title: documents.title, associationId: documents.associationId })
          .from(documents)
          .where(ilike(documents.title, pattern))
          .limit(5),
      ]);

      const results: Array<{ type: string; id: string; label: string; href: string }> = [
        ...matchPersons
          .map((p) => ({ type: "person", id: p.id, label: `${p.firstName} ${p.lastName}${p.email ? ` — ${p.email}` : ""}`, href: "/app/persons" })),
        ...matchUnits
          .filter((u) => !assocId || u.associationId === assocId)
          .map((u) => ({ type: "unit", id: u.id, label: `Unit ${u.unitNumber}`, href: "/app/units" })),
        ...matchVendors
          .map((v) => ({ type: "vendor", id: v.id, label: v.name, href: "/app/vendors" })),
        ...matchWorkOrders
          .filter((w) => !assocId || w.associationId === assocId)
          .map((w) => ({ type: "work-order", id: w.id, label: w.title, href: "/app/work-orders" })),
        ...matchDocs
          .filter((d) => !assocId || d.associationId === assocId)
          .map((d) => ({ type: "document", id: d.id, label: d.title, href: "/app/documents" })),
      ];

      res.json({ results });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
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

  app.get("/api/documents/missing-files", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
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
        isPortalVisible: req.body.isPortalVisible === "1" || req.body.isPortalVisible === "true" ? 1 : 0,
        portalAudience: typeof req.body.portalAudience === "string" && req.body.portalAudience ? req.body.portalAudience : "owner",
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

  // Financial alerts
  app.get("/api/financial/alerts", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      assertAssociationScope(req, associationId);
      const rows = await db.select().from(financialAlerts)
        .where(and(eq(financialAlerts.associationId, associationId), eq(financialAlerts.isDismissed, 0)))
        .orderBy(financialAlerts.createdAt);
      res.json(rows);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/financial/alerts/generate", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const associationId = req.body.associationId as string;
      assertAssociationInputScope(req, associationId);
      const now = new Date();
      const created: unknown[] = [];

      // Scan for large payments (>$5000)
      const entries = await db.select().from(ownerLedgerEntries).where(eq(ownerLedgerEntries.associationId, associationId));
      for (const e of entries) {
        if (Math.abs(e.amount) > 5000 && e.entryType === "payment") {
          const [existing] = await db.select().from(financialAlerts)
            .where(and(eq(financialAlerts.associationId, associationId), eq(financialAlerts.entityId, e.id), eq(financialAlerts.alertType, "large_payment"))).limit(1);
          if (!existing) {
            const [a] = await db.insert(financialAlerts).values({
              associationId,
              alertType: "large_payment",
              severity: "warning",
              title: "Large Payment Detected",
              message: `Payment of $${Math.abs(e.amount).toFixed(2)} exceeds $5,000 threshold. Posted: ${new Date(e.postedAt).toLocaleDateString()}.`,
              entityType: "ledger_entry",
              entityId: e.id,
              amount: e.amount,
            }).returning();
            created.push(a);
          }
        }
      }

      // Scan for unmatched reconciliation transactions
      const unmatched = await db.select().from(bankStatementTransactions)
        .where(and(eq(bankStatementTransactions.associationId, associationId), eq(bankStatementTransactions.matchStatus, "unmatched")));
      if (unmatched.length > 5) {
        const [existing] = await db.select().from(financialAlerts)
          .where(and(eq(financialAlerts.associationId, associationId), eq(financialAlerts.alertType, "reconciliation_gap"))).limit(1);
        if (!existing) {
          const [a] = await db.insert(financialAlerts).values({
            associationId,
            alertType: "reconciliation_gap",
            severity: "critical",
            title: "Reconciliation Gap",
            message: `${unmatched.length} bank statement transactions remain unmatched. Review required.`,
            entityType: "reconciliation",
            entityId: null,
          }).returning();
          created.push(a);
        }
      }

      // Delinquency spike
      const escalations = await db.select().from(delinquencyEscalations)
        .where(and(eq(delinquencyEscalations.associationId, associationId), eq(delinquencyEscalations.status, "active")));
      if (escalations.length >= 3) {
        const [existing] = await db.select().from(financialAlerts)
          .where(and(eq(financialAlerts.associationId, associationId), eq(financialAlerts.alertType, "delinquency_spike"))).limit(1);
        if (!existing) {
          const total = escalations.reduce((s, e) => s + e.balance, 0);
          const [a] = await db.insert(financialAlerts).values({
            associationId,
            alertType: "delinquency_spike",
            severity: "critical",
            title: "Delinquency Spike",
            message: `${escalations.length} accounts in active delinquency escalation. Total: $${Math.abs(total).toFixed(2)}.`,
            amount: total,
          }).returning();
          created.push(a);
        }
      }

      res.json({ generated: created.length, alerts: created });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/financial/alerts/:id/dismiss", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const id = req.params.id as string;
      const [existing] = await db.select().from(financialAlerts).where(eq(financialAlerts.id, id)).limit(1);
      if (!existing) return res.status(404).json({ message: "Alert not found" });
      assertAssociationScope(req, existing.associationId);
      const [updated] = await db.update(financialAlerts).set({
        isDismissed: 1,
        dismissedBy: req.adminUserEmail || "admin",
        dismissedAt: new Date(),
      }).where(eq(financialAlerts.id, id)).returning();
      res.json(updated);
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
      const rawFilename = getParam(req.params.filename);
      // Prevent path traversal: only allow basename, no slashes or dots leading out
      const filename = path.basename(rawFilename);
      if (!filename || filename !== rawFilename || filename.startsWith(".")) {
        return res.status(400).json({ message: "Invalid filename" });
      }

      const filePath = path.join(uploadDir, filename);
      // Ensure the resolved path is still inside uploadDir
      const resolvedPath = path.resolve(filePath);
      if (!resolvedPath.startsWith(path.resolve(uploadDir) + path.sep)) {
        return res.status(400).json({ message: "Invalid filename" });
      }

      if (!fs.existsSync(resolvedPath)) {
        return res.status(404).json({ message: "File not found" });
      }

      const fileUrl = `/api/uploads/${filename}`;

      if (req.isAuthenticated?.() && req.user) {
        const authUser = req.user as { adminUserId?: string | null; email?: string | null };
        const adminUser = authUser.adminUserId
          ? await storage.getAdminUserById(authUser.adminUserId)
          : (authUser.email ? await storage.getAdminUserByEmail(authUser.email.trim().toLowerCase()) : undefined);
        if (adminUser && adminUser.isActive === 1) {
          // For non-platform-admin users, verify the file belongs to a document in their scoped associations
          if (adminUser.role !== "platform-admin") {
            const scopedAssociationIds = await storage.getAdminAssociationScopesByUserId(adminUser.id)
              .then((scopes) => scopes.map((s) => s.associationId));
            if (scopedAssociationIds.length > 0) {
              // Check documents table for an entry with this fileUrl in the scoped associations
              const [matchingDoc] = await db
                .select({ id: documents.id })
                .from(documents)
                .where(and(eq(documents.fileUrl, fileUrl), inArray(documents.associationId, scopedAssociationIds)))
                .limit(1);
              if (!matchingDoc) {
                // Also check document versions
                const [matchingVersion] = await db
                  .select({ documentId: documentVersions.documentId })
                  .from(documentVersions)
                  .innerJoin(documents, eq(documentVersions.documentId, documents.id))
                  .where(and(eq(documentVersions.fileUrl, fileUrl), inArray(documents.associationId, scopedAssociationIds)))
                  .limit(1);
                if (!matchingVersion) {
                  return res.status(403).json({ message: "File is not accessible for your association scope" });
                }
              }
            }
          }
          return res.sendFile(resolvedPath);
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

      const portalDocs = await storage.getPortalDocuments(portalAccess.id);
      const directMatch = portalDocs.some((doc) => doc.fileUrl === fileUrl);
      if (directMatch) {
        return res.sendFile(resolvedPath);
      }

      const versionLists = await Promise.all(portalDocs.map((doc) => storage.getDocumentVersions(doc.id)));
      const versionMatch = versionLists.some((versions) => versions.some((version) => version.fileUrl === fileUrl));
      if (versionMatch) {
        return res.sendFile(resolvedPath);
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

  // Delinquency thresholds
  app.get("/api/financial/delinquency-thresholds", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      assertAssociationScope(req, associationId);
      const rows = await db.select().from(delinquencyThresholds).where(eq(delinquencyThresholds.associationId, associationId)).orderBy(delinquencyThresholds.stage);
      res.json(rows);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/financial/delinquency-thresholds", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const parsed = insertDelinquencyThresholdSchema.parse(req.body);
      assertAssociationScope(req, parsed.associationId);
      const [row] = await db.insert(delinquencyThresholds).values(parsed).returning();
      res.status(201).json(row);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/financial/delinquency-thresholds/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const id = getParam(req.params.id);
      const [existing] = await db.select().from(delinquencyThresholds).where(eq(delinquencyThresholds.id, id)).limit(1);
      if (!existing) return res.status(404).json({ message: "Threshold not found" });
      assertAssociationScope(req, existing.associationId);
      const parsed = insertDelinquencyThresholdSchema.partial().parse(req.body);
      const [updated] = await db.update(delinquencyThresholds).set(parsed).where(eq(delinquencyThresholds.id, id)).returning();
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/financial/delinquency-thresholds/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const id = getParam(req.params.id);
      const [existing] = await db.select().from(delinquencyThresholds).where(eq(delinquencyThresholds.id, id)).limit(1);
      if (!existing) return res.status(404).json({ message: "Threshold not found" });
      assertAssociationScope(req, existing.associationId);
      await db.delete(delinquencyThresholds).where(eq(delinquencyThresholds.id, id));
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Delinquency escalations
  app.get("/api/financial/delinquency-escalations", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      assertAssociationScope(req, associationId);
      const rows = await db.select().from(delinquencyEscalations).where(eq(delinquencyEscalations.associationId, associationId)).orderBy(delinquencyEscalations.currentStage);
      res.json(rows);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/financial/delinquency-escalations/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const id = getParam(req.params.id);
      const [existing] = await db.select().from(delinquencyEscalations).where(eq(delinquencyEscalations.id, id)).limit(1);
      if (!existing) return res.status(404).json({ message: "Escalation not found" });
      assertAssociationScope(req, existing.associationId);
      const parsed = insertDelinquencyEscalationSchema.partial().parse(req.body);
      const [updated] = await db.update(delinquencyEscalations).set({ ...parsed, updatedAt: new Date() }).where(eq(delinquencyEscalations.id, id)).returning();
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Run delinquency escalation scan – finds owners exceeding any threshold and creates/updates escalations
  app.post("/api/financial/delinquency-escalations/run", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getAssociationIdQuery(req) || req.body?.associationId;
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      assertAssociationScope(req, associationId);

      const [thresholds, allLedger] = await Promise.all([
        db.select().from(delinquencyThresholds).where(and(eq(delinquencyThresholds.associationId, associationId), eq(delinquencyThresholds.isActive, 1))).orderBy(delinquencyThresholds.stage),
        storage.getOwnerLedgerEntries(associationId),
      ]);

      if (thresholds.length === 0) return res.json({ escalated: 0, message: "No active thresholds configured" });

      // Compute per-person balance
      const balanceMap = new Map<string, { personId: string; unitId: string; balance: number; oldestCharge: Date | null }>();
      for (const entry of allLedger) {
        const key = `${entry.personId}:${entry.unitId}`;
        const existing2 = balanceMap.get(key) ?? { personId: entry.personId, unitId: entry.unitId, balance: 0, oldestCharge: null };
        existing2.balance += entry.amount;
        if ((entry.entryType === "charge" || entry.entryType === "assessment") && entry.postedAt) {
          const chargeDate = new Date(entry.postedAt);
          if (!existing2.oldestCharge || chargeDate < existing2.oldestCharge) existing2.oldestCharge = chargeDate;
        }
        balanceMap.set(key, existing2);
      }

      const now = new Date();
      let escalatedCount = 0;
      const escalationResults: object[] = [];

      for (const account of Array.from(balanceMap.values())) {
        if (account.balance >= 0) continue; // Not delinquent
        const balanceOwed = Math.abs(account.balance);
        const daysPastDue = account.oldestCharge ? Math.floor((now.getTime() - account.oldestCharge.getTime()) / (24 * 60 * 60 * 1000)) : 0;

        // Find the highest stage threshold this account qualifies for
        const qualifyingThreshold = [...thresholds].reverse().find((t) =>
          balanceOwed >= t.minimumBalance && daysPastDue >= t.minimumDaysOverdue
        );
        if (!qualifyingThreshold) continue;

        // Check if escalation record already exists
        const [existingEscalation] = await db.select().from(delinquencyEscalations)
          .where(and(eq(delinquencyEscalations.associationId, associationId), eq(delinquencyEscalations.personId, account.personId), eq(delinquencyEscalations.unitId, account.unitId)))
          .limit(1);

        if (existingEscalation) {
          if (existingEscalation.status !== "active") continue;
          if (existingEscalation.currentStage < qualifyingThreshold.stage) {
            // Advance stage
            await db.update(delinquencyEscalations).set({
              currentStage: qualifyingThreshold.stage,
              balance: -balanceOwed,
              daysPastDue,
              updatedAt: now,
              nextActionAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
            }).where(eq(delinquencyEscalations.id, existingEscalation.id));
            escalatedCount++;
            escalationResults.push({ personId: account.personId, unitId: account.unitId, stage: qualifyingThreshold.stage, action: "advanced" });
          }
        } else {
          // Create new escalation
          const [newEsc] = await db.insert(delinquencyEscalations).values({
            associationId,
            personId: account.personId,
            unitId: account.unitId,
            currentStage: qualifyingThreshold.stage,
            balance: -balanceOwed,
            daysPastDue,
            status: "active",
            nextActionAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
          }).returning();
          escalatedCount++;
          escalationResults.push({ personId: account.personId, unitId: account.unitId, stage: qualifyingThreshold.stage, action: "created", id: newEsc.id });
        }
      }

      res.json({ escalated: escalatedCount, results: escalationResults });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Collections handoff records
  app.get("/api/financial/collections-handoffs", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      assertAssociationScope(req, associationId);
      const rows = await db.select().from(collectionsHandoffs)
        .where(eq(collectionsHandoffs.associationId, associationId))
        .orderBy(collectionsHandoffs.referralDate);
      res.json(rows);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/financial/collections-handoffs", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const parsed = insertCollectionsHandoffSchema.parse(req.body);
      assertAssociationInputScope(req, parsed.associationId);
      const [result] = await db.insert(collectionsHandoffs).values(parsed).returning();
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/financial/collections-handoffs/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const id = req.params.id as string;
      const [existing] = await db.select().from(collectionsHandoffs).where(eq(collectionsHandoffs.id, id)).limit(1);
      if (!existing) return res.status(404).json({ message: "Not found" });
      assertAssociationScope(req, existing.associationId);
      const allowed = ["status", "agencyName", "agencyContactName", "agencyEmail", "agencyPhone", "agencyCaseNumber", "currentBalance", "daysPastDue", "settlementAmount", "settlementDate", "notes"] as const;
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      for (const k of allowed) {
        if (k in req.body) updates[k] = req.body[k];
      }
      const [updated] = await db.update(collectionsHandoffs).set(updates).where(eq(collectionsHandoffs.id, id)).returning();
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Collections aging dashboard
  app.get("/api/financial/collections-aging", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      assertAssociationScope(req, associationId);

      // Get all ledger entries to compute balances per unit
      const entries = await db.select().from(ownerLedgerEntries).where(eq(ownerLedgerEntries.associationId, associationId));
      const unitMap = new Map<string, { charged: number; paid: number }>();
      for (const e of entries) {
        if (!e.unitId) continue;
        const cur = unitMap.get(e.unitId) ?? { charged: 0, paid: 0 };
        if (e.amount < 0) cur.paid += Math.abs(e.amount);
        else cur.charged += e.amount;
        unitMap.set(e.unitId, cur);
      }

      // AR aging buckets: current (0-30), 31-60, 61-90, 91-120, 120+
      const buckets = { current: 0, days31to60: 0, days61to90: 0, days91to120: 0, over120: 0 };
      const unitAging: { unitId: string; balance: number; bucket: string }[] = [];

      // Use delinquency escalations for daysPastDue data
      const escalations = await db.select().from(delinquencyEscalations).where(eq(delinquencyEscalations.associationId, associationId));
      const escalationByUnit = new Map(escalations.map(e => [e.unitId, e]));

      for (const [unitId, bal] of Array.from(unitMap.entries())) {
        const balance = bal.charged - bal.paid;
        if (balance <= 0) continue;
        const esc = escalationByUnit.get(unitId);
        const days = esc?.daysPastDue ?? 0;
        let bucket = "current";
        if (days > 120) { bucket = "over120"; buckets.over120 += balance; }
        else if (days > 90) { bucket = "days91to120"; buckets.days91to120 += balance; }
        else if (days > 60) { bucket = "days61to90"; buckets.days61to90 += balance; }
        else if (days > 30) { bucket = "days31to60"; buckets.days31to60 += balance; }
        else { buckets.current += balance; }
        unitAging.push({ unitId, balance, bucket });
      }

      const handoffs = await db.select().from(collectionsHandoffs)
        .where(eq(collectionsHandoffs.associationId, associationId));

      res.json({
        buckets,
        unitAging,
        handoffs,
        totalDelinquent: Object.values(buckets).reduce((a, b) => a + b, 0),
        activeHandoffs: handoffs.filter(h => h.status === "active" || h.status === "referred").length,
        settledAmount: handoffs.filter(h => h.status === "settled").reduce((a, h) => a + (h.settlementAmount ?? 0), 0),
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Payment plans
  app.get("/api/financial/payment-plans", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      assertAssociationScope(req, associationId);
      const rows = await db.select().from(paymentPlans).where(eq(paymentPlans.associationId, associationId));
      res.json(rows);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/financial/payment-plans", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const parsed = insertPaymentPlanSchema.parse({ ...req.body, createdBy: req.adminUserEmail ?? null });
      assertAssociationInputScope(req, parsed.associationId);
      const [result] = await db.insert(paymentPlans).values(parsed).returning();
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/financial/payment-plans/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const id = getParam(req.params.id);
      const [existing] = await db.select().from(paymentPlans).where(eq(paymentPlans.id, id)).limit(1);
      if (!existing) return res.status(404).json({ message: "Payment plan not found" });
      assertAssociationScope(req, existing.associationId);
      const updates = insertPaymentPlanSchema.partial().parse(req.body);
      const [result] = await db.update(paymentPlans).set({ ...updates, updatedAt: new Date() }).where(eq(paymentPlans.id, id)).returning();
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // ── Recurring charge schedules ──────────────────────────────────────────
  app.get("/api/financial/recurring-charges/schedules", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      assertAssociationScope(req, associationId);
      const rows = await db.select().from(recurringChargeSchedules).where(eq(recurringChargeSchedules.associationId, associationId));
      res.json(rows);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/financial/recurring-charges/schedules", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const body = { ...req.body, createdBy: req.adminUserEmail || req.body.createdBy || "unknown" };
      const parsed = insertRecurringChargeScheduleSchema.parse(body);
      assertAssociationInputScope(req, parsed.associationId);
      // Compute initial nextRunDate based on dayOfMonth and frequency
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), parsed.dayOfMonth ?? 1);
      if (next <= now) {
        // Move to next month
        next.setMonth(next.getMonth() + 1);
      }
      const [result] = await db.insert(recurringChargeSchedules).values({ ...parsed, nextRunDate: next }).returning();
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/financial/recurring-charges/schedules/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const id = req.params.id as string;
      const [existing] = await db.select().from(recurringChargeSchedules).where(eq(recurringChargeSchedules.id, id)).limit(1);
      if (!existing) return res.status(404).json({ message: "Schedule not found" });
      assertAssociationScope(req, existing.associationId);
      const updates = insertRecurringChargeScheduleSchema.partial().parse(req.body);
      const [result] = await db.update(recurringChargeSchedules).set({ ...updates, updatedAt: new Date() }).where(eq(recurringChargeSchedules.id, id)).returning();
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Run due recurring charges — processes all active schedules for an association whose nextRunDate <= now
  app.post("/api/financial/recurring-charges/run", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const { associationId } = req.body as { associationId: string };
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      assertAssociationInputScope(req, associationId);

      const now = new Date();
      const due = await db.select().from(recurringChargeSchedules).where(
        and(
          eq(recurringChargeSchedules.associationId, associationId),
          eq(recurringChargeSchedules.status, "active"),
        )
      );
      const dueNow = due.filter(s => !s.nextRunDate || new Date(s.nextRunDate) <= now);

      let succeeded = 0;
      let failed = 0;
      const runIds: string[] = [];

      for (const schedule of dueNow) {
        // Determine which units to charge — if unitId set, just that unit; else all units in association
        let targetUnitIds: string[] = [];
        if (schedule.unitId) {
          targetUnitIds = [schedule.unitId];
        } else {
          const assocUnits = await db.select({ id: units.id }).from(units).where(eq(units.associationId, associationId));
          targetUnitIds = assocUnits.map(u => u.id);
        }

        for (const unitId of targetUnitIds) {
          // Find the primary person for this unit via ownership
          const [ownership] = await db.select().from(ownerships).where(eq(ownerships.unitId, unitId)).limit(1);

          // Create a run record
          const [run] = await db.insert(recurringChargeRuns).values({
            scheduleId: schedule.id,
            associationId,
            unitId,
            amount: schedule.amount,
            status: "pending",
            ranAt: now,
          }).returning();

          if (!ownership) {
            // No owner — skip but record
            await db.update(recurringChargeRuns).set({ status: "skipped", errorMessage: "No active ownership found for unit" }).where(eq(recurringChargeRuns.id, run.id));
            failed++;
            runIds.push(run.id);
            continue;
          }

          try {
            // Create ledger entry
            const [entry] = await db.insert(ownerLedgerEntries).values({
              associationId,
              unitId,
              personId: ownership.personId,
              entryType: schedule.entryType,
              amount: schedule.amount,
              postedAt: now,
              description: schedule.chargeDescription,
              referenceType: "recurring_charge_schedule",
              referenceId: schedule.id,
            }).returning();
            await db.update(recurringChargeRuns).set({ status: "success", ledgerEntryId: entry.id }).where(eq(recurringChargeRuns.id, run.id));
            succeeded++;
          } catch (err: any) {
            await db.update(recurringChargeRuns).set({
              status: "failed",
              errorMessage: err.message,
              retryCount: 0,
              nextRetryAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), // retry in 24h
            }).where(eq(recurringChargeRuns.id, run.id));
            failed++;
          }
          runIds.push(run.id);
        }

        // Advance nextRunDate
        const nextRunDate = new Date(now);
        if (schedule.frequency === "monthly") nextRunDate.setMonth(nextRunDate.getMonth() + 1);
        else if (schedule.frequency === "quarterly") nextRunDate.setMonth(nextRunDate.getMonth() + 3);
        else if (schedule.frequency === "annual") nextRunDate.setFullYear(nextRunDate.getFullYear() + 1);
        nextRunDate.setDate(schedule.dayOfMonth ?? 1);
        await db.update(recurringChargeSchedules).set({ nextRunDate, updatedAt: new Date() }).where(eq(recurringChargeSchedules.id, schedule.id));
      }

      res.json({ succeeded, failed, totalSchedulesDue: dueNow.length, runIds });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // List run history for an association
  app.get("/api/financial/recurring-charges/runs", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      assertAssociationScope(req, associationId);
      const scheduleId = typeof req.query.scheduleId === "string" ? req.query.scheduleId : undefined;
      const rows = scheduleId
        ? await db.select().from(recurringChargeRuns).where(and(eq(recurringChargeRuns.associationId, associationId), eq(recurringChargeRuns.scheduleId, scheduleId)))
        : await db.select().from(recurringChargeRuns).where(eq(recurringChargeRuns.associationId, associationId));
      res.json(rows);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Retry a failed run
  app.post("/api/financial/recurring-charges/runs/:id/retry", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const id = req.params.id as string;
      const [run] = await db.select().from(recurringChargeRuns).where(eq(recurringChargeRuns.id, id)).limit(1);
      if (!run) return res.status(404).json({ message: "Run not found" });
      assertAssociationScope(req, run.associationId);
      if (run.status !== "failed" && run.status !== "retrying") return res.status(400).json({ message: "Only failed runs can be retried" });

      const [schedule] = await db.select().from(recurringChargeSchedules).where(eq(recurringChargeSchedules.id, run.scheduleId)).limit(1);
      if (!schedule) return res.status(404).json({ message: "Schedule not found" });
      if ((run.retryCount ?? 0) >= (schedule.maxRetries ?? 3)) return res.status(400).json({ message: `Max retries (${schedule.maxRetries}) reached` });

      // Mark as retrying
      await db.update(recurringChargeRuns).set({ status: "retrying", retryCount: (run.retryCount ?? 0) + 1, nextRetryAt: null }).where(eq(recurringChargeRuns.id, id));

      const [ownership] = run.unitId
        ? await db.select().from(ownerships).where(eq(ownerships.unitId, run.unitId)).limit(1)
        : [null];

      if (!ownership || !run.unitId) {
        await db.update(recurringChargeRuns).set({ status: "skipped", errorMessage: "No active ownership found for unit" }).where(eq(recurringChargeRuns.id, id));
        return res.json({ status: "skipped" });
      }

      const now = new Date();
      const [entry] = await db.insert(ownerLedgerEntries).values({
        associationId: run.associationId,
        unitId: run.unitId,
        personId: ownership.personId,
        entryType: schedule.entryType,
        amount: run.amount,
        postedAt: now,
        description: schedule.chargeDescription,
        referenceType: "recurring_charge_schedule",
        referenceId: schedule.id,
      }).returning();
      await db.update(recurringChargeRuns).set({ status: "success", ledgerEntryId: entry.id, ranAt: now }).where(eq(recurringChargeRuns.id, id));
      res.json({ status: "success", ledgerEntryId: entry.id });
    } catch (error: any) {
      await db.update(recurringChargeRuns).set({ status: "failed", errorMessage: error.message }).where(eq(recurringChargeRuns.id, req.params.id as string));
      res.status(400).json({ message: error.message });
    }
  });

  // Financial approvals (two-person approval for material financial changes)
  app.get("/api/financial/approvals", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      assertAssociationScope(req, associationId);
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const rows = status
        ? await db.select().from(financialApprovals).where(and(eq(financialApprovals.associationId, associationId), eq(financialApprovals.status, status as "pending" | "approved" | "rejected" | "cancelled")))
        : await db.select().from(financialApprovals).where(eq(financialApprovals.associationId, associationId));
      res.json(rows);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/financial/approvals", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const parsed = insertFinancialApprovalSchema.parse({ ...req.body, requestedBy: req.adminUserEmail || req.body.requestedBy || "unknown" });
      assertAssociationInputScope(req, parsed.associationId);
      const [result] = await db.insert(financialApprovals).values(parsed).returning();
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/financial/approvals/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const id = getParam(req.params.id);
      const [existing] = await db.select().from(financialApprovals).where(eq(financialApprovals.id, id)).limit(1);
      if (!existing) return res.status(404).json({ message: "Approval not found" });
      assertAssociationScope(req, existing.associationId);
      const { status, resolverNotes } = req.body as { status?: string; resolverNotes?: string };
      if (status && !["pending", "approved", "rejected", "cancelled"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      // Prevent the requester from approving their own request
      if (status === "approved" && existing.requestedBy === (req.adminUserEmail || "")) {
        return res.status(403).json({ message: "You cannot approve your own financial change request." });
      }
      const [result] = await db.update(financialApprovals).set({
        status: status as "pending" | "approved" | "rejected" | "cancelled" | undefined ?? existing.status,
        approvedBy: status === "approved" ? (req.adminUserEmail || null) : existing.approvedBy,
        resolvedAt: status && status !== "pending" ? new Date() : existing.resolvedAt,
        resolverNotes: resolverNotes ?? existing.resolverNotes,
        updatedAt: new Date(),
      }).where(eq(financialApprovals.id, id)).returning();
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Payment reminder rules
  app.get("/api/financial/reminder-rules", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      assertAssociationScope(req, associationId);
      const rows = await db.select().from(paymentReminderRules).where(eq(paymentReminderRules.associationId, associationId));
      res.json(rows);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/financial/reminder-rules", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const parsed = insertPaymentReminderRuleSchema.parse(req.body);
      assertAssociationInputScope(req, parsed.associationId);
      const [result] = await db.insert(paymentReminderRules).values(parsed).returning();
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/financial/reminder-rules/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const id = getParam(req.params.id);
      const [existing] = await db.select().from(paymentReminderRules).where(eq(paymentReminderRules.id, id)).limit(1);
      if (!existing) return res.status(404).json({ message: "Reminder rule not found" });
      assertAssociationScope(req, existing.associationId);
      const updates = insertPaymentReminderRuleSchema.partial().parse(req.body);
      const [result] = await db.update(paymentReminderRules).set({ ...updates, updatedAt: new Date() }).where(eq(paymentReminderRules.id, id)).returning();
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/financial/reminder-rules/:id/run", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const id = getParam(req.params.id);
      const [rule] = await db.select().from(paymentReminderRules).where(eq(paymentReminderRules.id, id)).limit(1);
      if (!rule) return res.status(404).json({ message: "Reminder rule not found" });
      assertAssociationScope(req, rule.associationId);
      if (!rule.isActive) return res.status(400).json({ message: "Reminder rule is not active" });

      // Get delinquent ledger entries
      const overdueEntries = await db.select().from(ownerLedgerEntries)
        .where(and(
          eq(ownerLedgerEntries.associationId, rule.associationId),
          eq(ownerLedgerEntries.entryType, "charge"),
        ));

      // Calculate balances per person
      const balanceMap = new Map<string, { personId: string; unitId: string; balance: number }>();
      overdueEntries.forEach((entry) => {
        const key = entry.personId;
        const current = balanceMap.get(key) ?? { personId: entry.personId, unitId: entry.unitId, balance: 0 };
        current.balance += entry.amount;
        balanceMap.set(key, current);
      });

      // Also include payment credits
      const credits = await db.select().from(ownerLedgerEntries).where(and(
        eq(ownerLedgerEntries.associationId, rule.associationId),
        inArray(ownerLedgerEntries.entryType, ["payment", "credit", "adjustment"]),
      ));
      credits.forEach((entry) => {
        const key = entry.personId;
        const current = balanceMap.get(key);
        if (current) current.balance += entry.amount; // payments are negative amounts
      });

      const delinquent = Array.from(balanceMap.values()).filter(b => b.balance < -(rule.minBalanceThreshold ?? 0));

      // Fetch template if configured
      let template = null;
      if (rule.templateId) {
        const [tpl] = await db.select().from(noticeTemplates).where(eq(noticeTemplates.id, rule.templateId)).limit(1);
        template = tpl;
      }

      // Create mock sends for each delinquent account
      const sends: Array<{ personId: string; unitId: string; balance: number; sent: boolean }> = [];
      for (const account of delinquent) {
        const subject = template ? template.subjectTemplate : `Payment Reminder - Balance Due`;
        const body = template ? template.bodyTemplate : `This is a reminder that your account has an outstanding balance of $${Math.abs(account.balance).toFixed(2)}.`;
        await db.insert(noticeSends).values({
          associationId: rule.associationId,
          templateId: rule.templateId,
          campaignKey: `payment-reminder-${rule.id}-${Date.now()}`,
          recipientEmail: `owner-${account.personId}@example.com`,
          recipientPersonId: account.personId,
          subjectRendered: subject,
          bodyRendered: body,
          status: "sent",
          provider: "internal-mock",
          sentBy: req.adminUserEmail || "system",
          metadataJson: { ruleId: rule.id, balance: account.balance, unitId: account.unitId },
        });
        sends.push({ ...account, sent: true });
      }

      // Update lastRunAt
      await db.update(paymentReminderRules).set({ lastRunAt: new Date(), updatedAt: new Date() }).where(eq(paymentReminderRules.id, id));

      res.json({ sent: sends.length, accounts: sends });
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

  app.get("/api/vendors/:id/metrics", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
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
      // Signature verification: support both legacy shared-secret and HMAC-SHA256
      const stripeSignature = req.header("stripe-signature");
      const hmacSignature = req.header("x-webhook-hmac-sha256");
      const webhookSharedSecret = process.env.PAYMENT_WEBHOOK_SHARED_SECRET;

      if (stripeSignature || hmacSignature) {
        // HMAC-SHA256 verification — lookup signing secret for this association
        const associationIdForVerify = typeof req.body.associationId === "string" ? req.body.associationId : null;
        if (associationIdForVerify) {
          const [sigSecret] = await db.select().from(webhookSigningSecrets).where(
            and(eq(webhookSigningSecrets.associationId, associationIdForVerify), eq(webhookSigningSecrets.isActive, 1))
          ).limit(1);
          if (sigSecret) {
            const payload = JSON.stringify(req.body);
            const expected = createHmac("sha256", sigSecret.secretHash).update(payload).digest("hex");
            const provided = hmacSignature || (stripeSignature ? stripeSignature.split(",").find(p => p.startsWith("v1="))?.slice(3) : null);
            if (!provided) return res.status(403).json({ message: "Missing webhook signature" });
            try {
              const expectedBuf = Buffer.from(expected, "utf8");
              const providedBuf = Buffer.from(provided, "utf8");
              if (expectedBuf.length !== providedBuf.length || !timingSafeEqual(expectedBuf, providedBuf)) {
                return res.status(403).json({ message: "Invalid webhook signature" });
              }
            } catch {
              return res.status(403).json({ message: "Invalid webhook signature" });
            }
          }
        }
      } else if (webhookSharedSecret) {
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

  // Admin payment activity feed
  app.get("/api/financial/payment-activity", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      assertAssociationScope(req, associationId);
      const limit = Math.min(parseInt(String(req.query.limit ?? "100")), 500);
      const entries = await db.select().from(ownerLedgerEntries)
        .where(and(
          eq(ownerLedgerEntries.associationId, associationId),
          inArray(ownerLedgerEntries.entryType, ["payment", "credit", "adjustment"])
        ))
        .orderBy(ownerLedgerEntries.postedAt)
        .limit(limit);
      // Compute summary stats
      const totalPayments = entries.filter(e => e.entryType === "payment").reduce((s, e) => s + Math.abs(e.amount), 0);
      const totalCredits = entries.filter(e => e.entryType === "credit").reduce((s, e) => s + Math.abs(e.amount), 0);
      const totalAdjustments = entries.filter(e => e.entryType === "adjustment").reduce((s, e) => s + e.amount, 0);
      const last30Days = entries.filter(e => new Date(e.postedAt) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
      res.json({ entries, stats: { totalPayments, totalCredits, totalAdjustments, last30DaysCount: last30Days.length, last30DaysTotal: last30Days.reduce((s, e) => s + Math.abs(e.amount), 0) } });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Admin payment exceptions: large payments, negative adjustments, duplicate-day entries
  app.get("/api/financial/payment-exceptions", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      assertAssociationScope(req, associationId);

      const entries = await db.select().from(ownerLedgerEntries)
        .where(eq(ownerLedgerEntries.associationId, associationId))
        .orderBy(ownerLedgerEntries.postedAt);

      const exceptions: { id: string; entryId: string; type: string; description: string; amount: number; unitId: string; personId: string; postedAt: Date }[] = [];

      // Flag large payments (> $5000)
      for (const e of entries) {
        if (Math.abs(e.amount) > 5000) {
          exceptions.push({ id: `large-${e.id}`, entryId: e.id, type: "large_payment", description: `Large ${e.entryType}: $${Math.abs(e.amount).toFixed(2)}`, amount: e.amount, unitId: e.unitId, personId: e.personId, postedAt: e.postedAt });
        }
      }

      // Flag negative adjustments
      for (const e of entries.filter(e => e.entryType === "adjustment" && e.amount < -200)) {
        exceptions.push({ id: `negadj-${e.id}`, entryId: e.id, type: "negative_adjustment", description: `Negative adjustment: $${e.amount.toFixed(2)}`, amount: e.amount, unitId: e.unitId, personId: e.personId, postedAt: e.postedAt });
      }

      // Flag duplicate same-day same-unit same-amount payments
      const seen = new Map<string, string>();
      for (const e of entries.filter(e => e.entryType === "payment")) {
        const day = new Date(e.postedAt).toDateString();
        const key = `${e.unitId}:${day}:${e.amount}`;
        if (seen.has(key)) {
          exceptions.push({ id: `dup-${e.id}`, entryId: e.id, type: "duplicate_payment", description: `Possible duplicate payment on ${day}: $${Math.abs(e.amount).toFixed(2)}`, amount: e.amount, unitId: e.unitId, personId: e.personId, postedAt: e.postedAt });
        } else {
          seen.set(key, e.id);
        }
      }

      res.json(exceptions.sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()));
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Bank statement reconciliation
  app.get("/api/financial/reconciliation/imports", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      assertAssociationScope(req, associationId);
      const imports = await db.select().from(bankStatementImports).where(eq(bankStatementImports.associationId, associationId)).orderBy(bankStatementImports.createdAt);
      res.json(imports);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/financial/reconciliation/imports", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const associationId = req.body.associationId as string;
      assertAssociationInputScope(req, associationId);
      const { filename, statementDate, openingBalance, closingBalance, transactions: rawTransactions } = req.body;
      const [newImport] = await db.insert(bankStatementImports).values({
        associationId,
        filename: filename || "manual-import",
        importedBy: req.adminUserEmail || null,
        statementDate: statementDate ? new Date(statementDate) : null,
        openingBalance: openingBalance ? parseFloat(openingBalance) : null,
        closingBalance: closingBalance ? parseFloat(closingBalance) : null,
        transactionCount: Array.isArray(rawTransactions) ? rawTransactions.length : 0,
        status: "pending",
      }).returning();

      if (Array.isArray(rawTransactions) && rawTransactions.length > 0) {
        const txValues = rawTransactions.map((tx: any) => ({
          importId: newImport.id,
          associationId,
          transactionDate: new Date(tx.date),
          description: String(tx.description || ""),
          amount: parseFloat(tx.amount),
          bankReference: tx.bankReference || null,
          checkNumber: tx.checkNumber || null,
        }));
        await db.insert(bankStatementTransactions).values(txValues);
      }

      res.status(201).json(newImport);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/financial/reconciliation/transactions", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      assertAssociationScope(req, associationId);
      const importId = req.query.importId as string | undefined;
      const statusFilter = req.query.status as string | undefined;

      let q = db.select().from(bankStatementTransactions).where(eq(bankStatementTransactions.associationId, associationId));
      if (importId) q = db.select().from(bankStatementTransactions).where(and(eq(bankStatementTransactions.associationId, associationId), eq(bankStatementTransactions.importId, importId)));

      const transactions = await q.orderBy(bankStatementTransactions.transactionDate);
      const filtered = statusFilter ? transactions.filter(t => t.matchStatus === statusFilter) : transactions;
      res.json(filtered);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Auto-match: find ledger entries close in date and amount
  app.post("/api/financial/reconciliation/auto-match", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const associationId = req.body.associationId as string;
      assertAssociationInputScope(req, associationId);
      const importId = req.body.importId as string;

      const transactions = await db.select().from(bankStatementTransactions)
        .where(and(eq(bankStatementTransactions.importId, importId), eq(bankStatementTransactions.matchStatus, "unmatched")));

      const ledgerEntries = await db.select().from(ownerLedgerEntries).where(eq(ownerLedgerEntries.associationId, associationId));
      const now = new Date();
      let matched = 0;

      for (const tx of transactions) {
        // Find ledger entries with same amount (within $0.01) within 5-day window
        const txDate = new Date(tx.transactionDate);
        const candidates = ledgerEntries.filter(e => {
          const eDate = new Date(e.postedAt);
          const daysDiff = Math.abs((eDate.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24));
          const amountMatch = Math.abs(Math.abs(e.amount) - Math.abs(tx.amount)) < 0.01;
          return daysDiff <= 5 && amountMatch;
        });
        if (candidates.length === 1) {
          await db.update(bankStatementTransactions).set({
            matchStatus: "auto_matched",
            matchedLedgerEntryId: candidates[0].id,
            matchedBy: "auto",
            matchedAt: now,
          }).where(eq(bankStatementTransactions.id, tx.id));
          matched++;
        }
      }

      res.json({ matched, total: transactions.length });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Reconciliation period close controls
  app.get("/api/financial/reconciliation/periods", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      assertAssociationScope(req, associationId);
      const periods = await db.select().from(reconciliationPeriods).where(eq(reconciliationPeriods.associationId, associationId)).orderBy(reconciliationPeriods.startDate);
      res.json(periods);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/financial/reconciliation/periods", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const parsed = insertReconciliationPeriodSchema.parse(req.body);
      assertAssociationInputScope(req, parsed.associationId);
      const [result] = await db.insert(reconciliationPeriods).values(parsed).returning();
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/financial/reconciliation/periods/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const id = req.params.id as string;
      const [existing] = await db.select().from(reconciliationPeriods).where(eq(reconciliationPeriods.id, id)).limit(1);
      if (!existing) return res.status(404).json({ message: "Period not found" });
      assertAssociationScope(req, existing.associationId);

      if (existing.status === "locked" && req.adminRole !== "platform-admin") {
        return res.status(403).json({ message: "Period is locked — only platform admins can modify locked periods" });
      }

      const { action, notes } = req.body;
      const now = new Date();
      const updates: Record<string, unknown> = { updatedAt: now, notes: notes || existing.notes };
      if (action === "close") {
        updates.status = "closed";
        updates.closedBy = req.adminUserEmail || "admin";
        updates.closedAt = now;
      } else if (action === "lock") {
        if (existing.status !== "closed") return res.status(400).json({ message: "Period must be closed before locking" });
        updates.status = "locked";
        updates.lockedBy = req.adminUserEmail || "admin";
        updates.lockedAt = now;
      } else if (action === "reopen") {
        if (req.adminRole !== "platform-admin") return res.status(403).json({ message: "Only platform admins can reopen periods" });
        updates.status = "open";
      }

      const [updated] = await db.update(reconciliationPeriods).set(updates).where(eq(reconciliationPeriods.id, id)).returning();
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Manual match
  app.patch("/api/financial/reconciliation/transactions/:id/match", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const id = req.params.id as string;
      const [tx] = await db.select().from(bankStatementTransactions).where(eq(bankStatementTransactions.id, id)).limit(1);
      if (!tx) return res.status(404).json({ message: "Transaction not found" });
      assertAssociationScope(req, tx.associationId);
      const { ledgerEntryId, matchStatus, matchNotes } = req.body;
      const [updated] = await db.update(bankStatementTransactions).set({
        matchStatus: matchStatus || "manual_matched",
        matchedLedgerEntryId: ledgerEntryId || null,
        matchedBy: req.adminUserEmail || "admin",
        matchedAt: new Date(),
        matchNotes: matchNotes || null,
      }).where(eq(bankStatementTransactions.id, id)).returning();
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/financial/owner-ledger/import", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const associationId = req.body.associationId as string;
      assertAssociationScope(req, associationId);

      // Load lookup tables
      const [allPersons, allUnits] = await Promise.all([
        storage.getPersons(associationId),
        storage.getUnits(associationId),
      ]);
      const personByEmail = new Map(allPersons.filter((p) => p.email).map((p) => [p.email!.toLowerCase().trim(), p.id]));
      const unitByNumber = new Map(allUnits.map((u) => [u.unitNumber.toLowerCase().trim(), u.id]));

      const rows = z.array(z.object({
        personEmail: z.string(),
        unitNumber: z.string(),
        entryType: z.enum(["charge", "assessment", "payment", "late-fee", "credit", "adjustment"]),
        amount: z.coerce.number(),
        postedAt: z.string(),
        description: z.string().optional(),
      })).parse(req.body.rows);

      const results: Array<{ index: number; label: string; status: "created" | "skipped"; error?: string }> = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const label = `${row.personEmail} / ${row.unitNumber} / ${row.entryType}`;
        try {
          const personId = personByEmail.get(row.personEmail.toLowerCase().trim());
          if (!personId) throw new Error(`No person found with email "${row.personEmail}"`);
          const unitId = unitByNumber.get(row.unitNumber.toLowerCase().trim());
          if (!unitId) throw new Error(`No unit found with number "${row.unitNumber}"`);
          await storage.createOwnerLedgerEntry({
            associationId,
            personId,
            unitId,
            entryType: row.entryType,
            amount: row.amount,
            postedAt: new Date(row.postedAt),
            description: row.description ?? null,
            referenceType: "import",
            referenceId: undefined,
          });
          results.push({ index: i, label, status: "created" });
        } catch (err: any) {
          results.push({ index: i, label, status: "skipped", error: err.message });
        }
      }
      res.json({ results, createdCount: results.filter((r) => r.status === "created").length, skippedCount: results.filter((r) => r.status === "skipped").length });
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

  // Association-level template assignment: assign a state library template to an association
  app.post("/api/governance/templates/:templateId/assign", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const baseTemplateId = getParam(req.params.templateId);
      const associationId = req.body.associationId as string;
      assertAssociationInputScope(req, associationId);

      // Load the base template
      const [baseTemplate] = await db.select().from(governanceComplianceTemplates).where(eq(governanceComplianceTemplates.id, baseTemplateId)).limit(1);
      if (!baseTemplate) return res.status(404).json({ message: "Template not found" });

      // Check if already assigned
      const [existing] = await db.select().from(governanceComplianceTemplates)
        .where(and(eq(governanceComplianceTemplates.associationId, associationId), eq(governanceComplianceTemplates.baseTemplateId, baseTemplateId))).limit(1);
      if (existing) return res.json({ assigned: existing, alreadyExists: true });

      // Create association overlay
      const [assigned] = await db.insert(governanceComplianceTemplates).values({
        associationId,
        baseTemplateId,
        scope: "association",
        stateCode: baseTemplate.stateCode,
        year: baseTemplate.year,
        versionNumber: 1,
        name: req.body.name || `${baseTemplate.name} (${associationId.slice(0, 6)} overlay)`,
        sourceAuthority: baseTemplate.sourceAuthority,
        sourceUrl: baseTemplate.sourceUrl,
        publicationStatus: "published",
        createdBy: req.adminUserEmail || "admin",
      }).returning();

      // Copy template items to the overlay
      const items = await db.select().from(governanceTemplateItems).where(eq(governanceTemplateItems.templateId, baseTemplateId));
      if (items.length > 0) {
        await db.insert(governanceTemplateItems).values(items.map(item => ({
          templateId: assigned.id,
          title: item.title,
          description: item.description,
          legalReference: item.legalReference,
          sourceCitation: item.sourceCitation,
          dueMonth: item.dueMonth,
          dueDay: item.dueDay,
          orderIndex: item.orderIndex,
        })));
      }

      res.status(201).json({ assigned, alreadyExists: false });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Template version history: list all versions of a template (same baseTemplateId or same name/stateCode)
  app.get("/api/governance/templates/:templateId/versions", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const templateId = getParam(req.params.templateId);
      const [template] = await db.select().from(governanceComplianceTemplates).where(eq(governanceComplianceTemplates.id, templateId)).limit(1);
      if (!template) return res.status(404).json({ message: "Template not found" });

      // Find all templates with same base: either this one or those derived from it
      const allTemplates = await db.select().from(governanceComplianceTemplates);
      const versions = allTemplates.filter(t =>
        t.id === templateId ||
        t.baseTemplateId === templateId ||
        (template.baseTemplateId && t.id === template.baseTemplateId) ||
        (template.baseTemplateId && t.baseTemplateId === template.baseTemplateId)
      ).sort((a, b) => b.versionNumber - a.versionNumber);

      res.json(versions);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Create new version of a template
  app.post("/api/governance/templates/:templateId/new-version", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const templateId = getParam(req.params.templateId);
      const [existing] = await db.select().from(governanceComplianceTemplates).where(eq(governanceComplianceTemplates.id, templateId)).limit(1);
      if (!existing) return res.status(404).json({ message: "Template not found" });
      await assertResourceScope(req, "governance-template", templateId);

      const [newVersion] = await db.insert(governanceComplianceTemplates).values({
        associationId: existing.associationId,
        baseTemplateId: existing.baseTemplateId ?? existing.id,
        scope: existing.scope,
        stateCode: existing.stateCode,
        year: req.body.year ?? existing.year,
        versionNumber: existing.versionNumber + 1,
        name: existing.name,
        sourceAuthority: existing.sourceAuthority,
        sourceUrl: req.body.sourceUrl ?? existing.sourceUrl,
        publicationStatus: "draft",
        reviewNotes: req.body.reviewNotes ?? null,
        createdBy: req.adminUserEmail || "admin",
      }).returning();

      // Copy items
      const items = await db.select().from(governanceTemplateItems).where(eq(governanceTemplateItems.templateId, templateId));
      if (items.length > 0) {
        await db.insert(governanceTemplateItems).values(items.map(item => ({
          templateId: newVersion.id,
          title: item.title,
          description: item.description,
          legalReference: item.legalReference,
          sourceCitation: item.sourceCitation,
          dueMonth: item.dueMonth,
          dueDay: item.dueDay,
          orderIndex: item.orderIndex,
        })));
      }

      res.status(201).json(newVersion);
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

  app.post("/api/governance/tasks/:id/evidence", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), upload.single("file"), async (req: AdminRequest, res) => {
    try {
      const taskId = getParam(req.params.id);
      const file = req.file;
      if (!file) return res.status(400).json({ message: "No file uploaded" });
      const fileUrl = `/api/uploads/${file.filename}`;
      const [current] = await db.select().from(annualGovernanceTasks).where(eq(annualGovernanceTasks.id, taskId));
      if (!current) return res.status(404).json({ message: "Task not found" });
      assertAssociationScope(req, current.associationId);
      const existingUrls = Array.isArray(current.evidenceUrlsJson) ? (current.evidenceUrlsJson as string[]) : [];
      const updated = await storage.updateAnnualGovernanceTask(taskId, { evidenceUrlsJson: [...existingUrls, fileUrl] } as any);
      res.json(updated);
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

  app.get("/api/governance/platform-gaps", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      assertAssociationScope(req, associationId);

      const now = new Date();
      const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

      const [policies, meetings, boardRoleRows, openWorkOrderRows, boardDocs] = await Promise.all([
        db.select().from(associationInsurancePolicies).where(eq(associationInsurancePolicies.associationId, associationId)),
        db.select().from(governanceMeetings).where(and(eq(governanceMeetings.associationId, associationId), gte(governanceMeetings.scheduledAt, oneYearAgo))),
        db.select().from(boardRoles).where(and(eq(boardRoles.associationId, associationId), isNull(boardRoles.endDate))),
        db.select().from(workOrders).where(and(eq(workOrders.associationId, associationId), notInArray(workOrders.status, ["closed", "cancelled"]))),
        db.select().from(documents).where(and(eq(documents.associationId, associationId), inArray(documents.documentType, ["bylaws", "cc&rs", "rules-and-regulations", "budget", "financial-report"]))),
      ]);

      type PlatformGap = { category: string; title: string; description: string; severity: "low" | "medium" | "high"; recordType: string; recordCount: number; actionUrl?: string };
      const gaps: PlatformGap[] = [];

      // Insurance gaps
      const activeInsurance = policies.filter(p => !p.expirationDate || p.expirationDate > now);
      const expiringInsurance = policies.filter(p => p.expirationDate && p.expirationDate > now && p.expirationDate <= thirtyDaysOut);
      const expiredInsurance = policies.filter(p => p.expirationDate && p.expirationDate <= now);
      if (policies.length === 0) {
        gaps.push({ category: "Insurance", title: "No insurance policies on file", description: "No insurance policies have been recorded for this association. At minimum, general liability and property insurance are typically required.", severity: "high", recordType: "insurance", recordCount: 0 });
      }
      expiredInsurance.forEach(p => gaps.push({ category: "Insurance", title: `${p.policyType} policy expired`, description: `${p.carrier} policy expired on ${p.expirationDate?.toLocaleDateString()}. Renew immediately to maintain coverage.`, severity: "high", recordType: "insurance", recordCount: 1 }));
      expiringInsurance.forEach(p => gaps.push({ category: "Insurance", title: `${p.policyType} policy expiring soon`, description: `${p.carrier} policy expires on ${p.expirationDate?.toLocaleDateString()}. Begin renewal process within 30 days.`, severity: "medium", recordType: "insurance", recordCount: 1 }));

      // Meeting gaps
      const annualMeetings = meetings.filter(m => m.meetingType === "annual" || m.title?.toLowerCase().includes("annual"));
      const lastYear = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      const recentAnnual = annualMeetings.filter(m => new Date(m.scheduledAt) >= lastYear);
      if (recentAnnual.length === 0) {
        gaps.push({ category: "Meetings", title: "No annual meeting in past 12 months", description: "Most HOA bylaws require at least one annual meeting per year. No annual meeting record found in the past 12 months.", severity: "high", recordType: "meeting", recordCount: annualMeetings.length });
      }
      const regularMeetings = meetings.filter(m => new Date(m.scheduledAt) >= ninetyDaysAgo);
      if (regularMeetings.length === 0) {
        gaps.push({ category: "Meetings", title: "No meetings in past 90 days", description: "No board meetings have been recorded in the past 90 days. Regular meeting cadence is typically required by governing documents.", severity: "medium", recordType: "meeting", recordCount: meetings.length });
      }

      // Board composition gaps
      const activePresidents = boardRoleRows.filter(r => r.role?.toLowerCase().includes("president"));
      const activeTreasurers = boardRoleRows.filter(r => r.role?.toLowerCase().includes("treasurer"));
      const activeSecretaries = boardRoleRows.filter(r => r.role?.toLowerCase().includes("secretary"));
      if (activePresidents.length === 0) gaps.push({ category: "Board", title: "No active President on record", description: "The association has no active President recorded. This officer role is required by most governing documents.", severity: "high", recordType: "board-role", recordCount: boardRoleRows.length });
      if (activeTreasurers.length === 0) gaps.push({ category: "Board", title: "No active Treasurer on record", description: "The association has no active Treasurer recorded. This officer role is typically required for financial oversight.", severity: "medium", recordType: "board-role", recordCount: boardRoleRows.length });
      if (activeSecretaries.length === 0) gaps.push({ category: "Board", title: "No active Secretary on record", description: "The association has no active Secretary recorded. This officer role is typically required for meeting minutes.", severity: "medium", recordType: "board-role", recordCount: boardRoleRows.length });

      // Work order gaps
      const urgentOpen = openWorkOrderRows.filter(w => w.priority === "urgent");
      if (urgentOpen.length > 0) {
        gaps.push({ category: "Maintenance", title: `${urgentOpen.length} urgent work order${urgentOpen.length > 1 ? "s" : ""} unresolved`, description: `${urgentOpen.length} urgent work order${urgentOpen.length > 1 ? "s remain" : " remains"} open. Unresolved urgent maintenance may indicate compliance risk or liability exposure.`, severity: "high", recordType: "work-order", recordCount: urgentOpen.length });
      }
      if (openWorkOrderRows.length > 10) {
        gaps.push({ category: "Maintenance", title: `${openWorkOrderRows.length} open work orders`, description: `There are ${openWorkOrderRows.length} open work orders. A large backlog may indicate deferred maintenance issues.`, severity: "medium", recordType: "work-order", recordCount: openWorkOrderRows.length });
      }

      // Document gaps
      const docTypes = new Set(boardDocs.map(d => d.documentType));
      if (!docTypes.has("bylaws") && !docTypes.has("cc&rs")) {
        gaps.push({ category: "Documents", title: "No governing documents on file", description: "No bylaws or CC&Rs have been uploaded for this association. These foundational documents should be on file.", severity: "high", recordType: "document", recordCount: boardDocs.length });
      }
      if (!docTypes.has("budget") && !docTypes.has("financial-report")) {
        gaps.push({ category: "Documents", title: "No financial records on file", description: "No budget or financial report documents have been uploaded. Current financial records should be maintained and accessible.", severity: "medium", recordType: "document", recordCount: boardDocs.length });
      }

      res.json(gaps.sort((a, b) => {
        const s = { high: 0, medium: 1, low: 2 };
        return s[a.severity] - s[b.severity] || a.category.localeCompare(b.category);
      }));
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

  // Governance reminder cadence rules
  app.get("/api/governance/reminder-rules", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      assertAssociationScope(req, associationId);
      const rows = await db.select().from(governanceReminderRules).where(eq(governanceReminderRules.associationId, associationId));
      res.json(rows);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/governance/reminder-rules", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const parsed = insertGovernanceReminderRuleSchema.parse(req.body);
      assertAssociationScope(req, parsed.associationId);
      const [row] = await db.insert(governanceReminderRules).values(parsed).returning();
      res.status(201).json(row);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/governance/reminder-rules/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const id = getParam(req.params.id);
      const [existing] = await db.select().from(governanceReminderRules).where(eq(governanceReminderRules.id, id)).limit(1);
      if (!existing) return res.status(404).json({ message: "Reminder rule not found" });
      assertAssociationScope(req, existing.associationId);
      const parsed = insertGovernanceReminderRuleSchema.partial().parse(req.body);
      const [updated] = await db.update(governanceReminderRules).set({ ...parsed, updatedAt: new Date() }).where(eq(governanceReminderRules.id, id)).returning();
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/governance/reminder-rules/:id/run", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const id = getParam(req.params.id);
      const [rule] = await db.select().from(governanceReminderRules).where(eq(governanceReminderRules.id, id)).limit(1);
      if (!rule) return res.status(404).json({ message: "Reminder rule not found" });
      assertAssociationScope(req, rule.associationId);
      if (!rule.isActive) return res.status(400).json({ message: "Rule is inactive" });

      const now = new Date();
      const windowStart = new Date(now.getTime() + (rule.daysOffset - 1) * 24 * 60 * 60 * 1000);
      const windowEnd = new Date(now.getTime() + (rule.daysOffset + 1) * 24 * 60 * 60 * 1000);

      // Find meetings in the window based on trigger type
      let targetMeetings: Array<{ id: string; title: string; scheduledAt: Date | null; meetingType: string }> = [];
      if (rule.trigger === "before_meeting" || rule.trigger === "after_meeting") {
        const allMeetings = await db.select().from(governanceMeetings).where(eq(governanceMeetings.associationId, rule.associationId));
        targetMeetings = allMeetings.filter((m) => {
          if (!m.scheduledAt) return false;
          const meetDate = new Date(m.scheduledAt);
          if (rule.trigger === "before_meeting") return meetDate >= windowStart && meetDate <= windowEnd;
          if (rule.trigger === "after_meeting") {
            const pastWindow = new Date(now.getTime() - (rule.daysOffset + 1) * 24 * 60 * 60 * 1000);
            const pastWindowEnd = new Date(now.getTime() - (rule.daysOffset - 1) * 24 * 60 * 60 * 1000);
            return meetDate >= pastWindow && meetDate <= pastWindowEnd;
          }
          return false;
        }).filter((m) => !rule.meetingTypes || rule.meetingTypes.split(",").includes(m.meetingType));
      }

      // Determine recipients based on recipientType
      let recipientEmails: string[] = [];
      if (rule.recipientType === "board_members") {
        const roles = await db.select().from(boardRoles).where(and(eq(boardRoles.associationId, rule.associationId), isNull(boardRoles.endDate)));
        const personIds = roles.map((r) => r.personId).filter(Boolean) as string[];
        const allPersons = await storage.getPersons(rule.associationId);
        recipientEmails = allPersons.filter((p) => personIds.includes(p.id) && p.email).map((p) => p.email!);
      } else if (rule.recipientType === "all_owners") {
        const allOwnerships = await storage.getOwnerships(rule.associationId);
        const ownerPersonIds = Array.from(new Set(allOwnerships.filter((o) => !o.endDate).map((o) => o.personId)));
        const allPersons = await storage.getPersons(rule.associationId);
        recipientEmails = allPersons.filter((p) => ownerPersonIds.includes(p.id) && p.email).map((p) => p.email!);
      }

      if (recipientEmails.length === 0) {
        return res.json({ sent: 0, message: "No eligible recipients found" });
      }

      // Create notice sends for each recipient x meeting combination
      const sends: Array<object> = [];
      const subject = rule.subjectTemplate;
      const body = rule.bodyTemplate;
      const campaignKey = `gov-reminder-${rule.id}-${Date.now()}`;

      for (const email of recipientEmails.slice(0, 50)) {
        const [send] = await db.insert(noticeSends).values({
          associationId: rule.associationId,
          campaignKey,
          recipientEmail: email,
          subjectRendered: subject,
          bodyRendered: body,
          status: "sent",
          provider: "internal-mock",
          sentBy: req.adminUserEmail || "system",
        }).returning();
        sends.push(send);
      }

      await db.update(governanceReminderRules).set({ lastRunAt: new Date(), updatedAt: new Date() }).where(eq(governanceReminderRules.id, id));

      res.json({ sent: sends.length, meetings: targetMeetings.length, recipients: recipientEmails.length });
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

  // Delivery tracking: mark delivered, opened, or bounced
  app.patch("/api/communications/sends/:id/delivery", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const id = getParam(req.params.id);
      const [existing] = await db.select().from(noticeSends).where(eq(noticeSends.id, id)).limit(1);
      if (!existing) return res.status(404).json({ message: "Notice send not found" });
      if (existing.associationId) assertAssociationScope(req, existing.associationId);

      const event = typeof req.body.event === "string" ? req.body.event : null;
      if (!event || !["delivered", "opened", "bounced", "retry"].includes(event)) {
        return res.status(400).json({ message: "event must be delivered, opened, bounced, or retry" });
      }

      const update: Partial<typeof existing> = {};
      if (event === "delivered") {
        update.deliveredAt = new Date();
        update.status = "delivered";
      } else if (event === "opened") {
        update.openedAt = new Date();
        update.status = "opened";
      } else if (event === "bounced") {
        update.bouncedAt = new Date();
        update.status = "bounced";
        update.bounceType = typeof req.body.bounceType === "string" ? req.body.bounceType : "hard";
        update.bounceReason = typeof req.body.bounceReason === "string" ? req.body.bounceReason : null;
      } else if (event === "retry") {
        const newRetryCount = (existing.retryCount ?? 0) + 1;
        update.retryCount = newRetryCount;
        update.lastRetryAt = new Date();
        update.status = "queued";
        update.bouncedAt = null;
        update.bounceType = null;
        update.bounceReason = null;
      }

      const [updated] = await db.update(noticeSends).set(update).where(eq(noticeSends.id, id)).returning();
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Delivery stats for a campaign or association
  app.get("/api/communications/delivery-stats", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      assertAssociationScope(req, associationId);
      const campaignKey = typeof req.query.campaignKey === "string" ? req.query.campaignKey : undefined;

      const whereClause = campaignKey
        ? and(eq(noticeSends.associationId, associationId), eq(noticeSends.campaignKey, campaignKey))
        : eq(noticeSends.associationId, associationId);

      const sends = await db.select().from(noticeSends).where(whereClause);
      const total = sends.length;
      const delivered = sends.filter((s) => s.status === "delivered" || s.status === "opened").length;
      const opened = sends.filter((s) => s.status === "opened").length;
      const bounced = sends.filter((s) => s.status === "bounced").length;
      const queued = sends.filter((s) => s.status === "queued").length;
      const hardBounces = sends.filter((s) => s.bounceType === "hard").length;
      const softBounces = sends.filter((s) => s.bounceType === "soft").length;
      const bouncedEmails = sends.filter((s) => s.status === "bounced").map((s) => ({
        id: s.id,
        email: s.recipientEmail,
        type: s.bounceType,
        reason: s.bounceReason,
        bouncedAt: s.bouncedAt,
        retryCount: s.retryCount,
      }));

      res.json({
        total,
        delivered,
        opened,
        bounced,
        queued,
        hardBounces,
        softBounces,
        deliveryRate: total > 0 ? Math.round((delivered / total) * 100) : 0,
        openRate: delivered > 0 ? Math.round((opened / delivered) * 100) : 0,
        bounceRate: total > 0 ? Math.round((bounced / total) * 100) : 0,
        bouncedEmails,
      });
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
      const workOrderId = getParam(req.params.id);
      await assertResourceScope(req, "work-order", workOrderId);
      const parsed = insertWorkOrderSchema.partial().parse(req.body);
      if (Object.prototype.hasOwnProperty.call(parsed, "associationId")) {
        assertAssociationInputScope(req, parsed.associationId ?? null);
      }
      const [before] = await db.select().from(workOrders).where(eq(workOrders.id, workOrderId));
      const result = await storage.updateWorkOrder(workOrderId, parsed, req.adminUserEmail);
      if (!result) return res.status(404).json({ message: "Work order not found" });
      res.json(result);

      // Fire-and-forget notifications after response is sent
      const vendorAssigned = parsed.vendorId && parsed.vendorId !== before?.vendorId;
      const statusChanged = parsed.status && parsed.status !== before?.status;
      const nowClosed = statusChanged && parsed.status === "closed";

      if (vendorAssigned && parsed.vendorId) {
        db.select().from(vendors).where(eq(vendors.id, parsed.vendorId)).then(([vendor]) => {
          if (vendor?.primaryEmail) {
            sendPlatformEmail({
              associationId: result.associationId,
              to: vendor.primaryEmail,
              subject: `Work Order Assigned: ${result.title}`,
              text: [
                `You have been assigned a new work order.`,
                ``,
                `Title: ${result.title}`,
                `Priority: ${result.priority}`,
                `Location: ${result.locationText || "See work order details"}`,
                `Description: ${result.description}`,
                ``,
                `Please acknowledge receipt by contacting the property manager.`,
              ].join("\n"),
              templateKey: "work-order-vendor-assignment",
            }).catch(() => {});
          }
        }).catch(() => {});
      }

      if (nowClosed && result.maintenanceRequestId) {
        db.select().from(maintenanceRequests).where(eq(maintenanceRequests.id, result.maintenanceRequestId)).then(([req]) => {
          if (req?.submittedByEmail) {
            sendPlatformEmail({
              associationId: result.associationId,
              to: req.submittedByEmail,
              subject: `Your maintenance request has been completed: ${result.title}`,
              text: [
                `Good news — the work order for your maintenance request has been marked complete.`,
                ``,
                `Request: ${result.title}`,
                `${result.resolutionNotes ? `Resolution notes: ${result.resolutionNotes}` : ""}`,
                ``,
                `If you have any questions, please contact your property management team.`,
              ].join("\n"),
              templateKey: "work-order-completion-resident",
            }).catch(() => {});
          }
        }).catch(() => {});
      }
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/work-orders/:id/photos", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), upload.single("file"), async (req: AdminRequest, res) => {
    try {
      const workOrderId = getParam(req.params.id);
      await assertResourceScope(req, "work-order", workOrderId);
      const file = req.file;
      if (!file) return res.status(400).json({ message: "No file uploaded" });
      const label = typeof req.body.label === "string" ? req.body.label : "";
      const photoType = typeof req.body.type === "string" ? req.body.type : "general";
      const fileUrl = `/api/uploads/${file.filename}`;
      const [current] = await db.select().from(workOrders).where(eq(workOrders.id, workOrderId));
      if (!current) return res.status(404).json({ message: "Work order not found" });
      const existingPhotos = Array.isArray(current.photosJson) ? (current.photosJson as any[]) : [];
      const newPhoto = { url: fileUrl, label, type: photoType, uploadedAt: new Date().toISOString() };
      const updated = await storage.updateWorkOrder(workOrderId, { photosJson: [...existingPhotos, newPhoto] } as any, req.adminUserEmail);
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/maintenance/requests/:id/convert-to-work-order", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const requestId = getParam(req.params.id);
      await assertResourceScope(req, "maintenance-request", requestId);
      const parsed = insertWorkOrderSchema.partial().parse({
        ...req.body,
        associationId: req.body?.associationId ?? getAssociationIdQuery(req),
      });
      if (Object.prototype.hasOwnProperty.call(parsed, "associationId")) {
        assertAssociationInputScope(req, parsed.associationId ?? null);
      }
      const result = await storage.convertMaintenanceRequestToWorkOrder(requestId, parsed, req.adminUserEmail);
      res.status(201).json(result);

      // Notify resident that request was escalated to a work order
      db.select().from(maintenanceRequests).where(eq(maintenanceRequests.id, requestId)).then(([mreq]) => {
        if (mreq?.submittedByEmail) {
          sendPlatformEmail({
            associationId: result.associationId,
            to: mreq.submittedByEmail,
            subject: `Your maintenance request is being actioned: ${result.title}`,
            text: [
              `Your maintenance request has been reviewed and a work order has been created to address it.`,
              ``,
              `Request: ${result.title}`,
              `Priority: ${result.priority}`,
              ``,
              `You will receive another update when the work has been completed. Thank you for your patience.`,
            ].join("\n"),
            templateKey: "work-order-created-resident",
          }).catch(() => {});
        }
      }).catch(() => {});
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

  // Asset registry
  app.get("/api/assets", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      assertAssociationScope(req, associationId);
      const result = await db.select().from(associationAssets).where(eq(associationAssets.associationId, associationId));
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/assets", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const parsed = insertAssociationAssetSchema.parse({ ...req.body });
      assertAssociationInputScope(req, parsed.associationId);
      const [result] = await db.insert(associationAssets).values(parsed).returning();
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/assets/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const id = getParam(req.params.id);
      const [existing] = await db.select().from(associationAssets).where(eq(associationAssets.id, id)).limit(1);
      if (!existing) return res.status(404).json({ message: "Asset not found" });
      assertAssociationScope(req, existing.associationId);
      const updates = insertAssociationAssetSchema.partial().parse(req.body);
      const [result] = await db.update(associationAssets).set({ ...updates, updatedAt: new Date() }).where(eq(associationAssets.id, id)).returning();
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/assets/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const id = getParam(req.params.id);
      const [existing] = await db.select().from(associationAssets).where(eq(associationAssets.id, id)).limit(1);
      if (!existing) return res.status(404).json({ message: "Asset not found" });
      assertAssociationScope(req, existing.associationId);
      await db.delete(associationAssets).where(eq(associationAssets.id, id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Resident feedback
  app.get("/api/feedback", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      assertAssociationScope(req, associationId);
      const rows = await db.select().from(residentFeedbacks).where(eq(residentFeedbacks.associationId, associationId));
      res.json(rows);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/feedback/analytics", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      assertAssociationScope(req, associationId);
      const rows = await db.select().from(residentFeedbacks).where(eq(residentFeedbacks.associationId, associationId));
      const total = rows.length;
      const rated = rows.filter(r => r.satisfactionScore !== null);
      const avgScore = rated.length ? rated.reduce((sum, r) => sum + (r.satisfactionScore ?? 0), 0) / rated.length : null;
      const byCategory = rows.reduce<Record<string, { count: number; avgScore: number | null }>>((acc, r) => {
        const cat = r.category;
        if (!acc[cat]) acc[cat] = { count: 0, avgScore: null };
        acc[cat].count++;
        return acc;
      }, {});
      const byStatus = rows.reduce<Record<string, number>>((acc, r) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc; }, {});
      const scoreDistribution = [1, 2, 3, 4, 5].map(score => ({
        score,
        count: rows.filter(r => r.satisfactionScore === score).length,
      }));
      res.json({ total, avgScore, byCategory, byStatus, scoreDistribution });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/feedback", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const parsed = insertResidentFeedbackSchema.parse(req.body);
      assertAssociationInputScope(req, parsed.associationId);
      const [result] = await db.insert(residentFeedbacks).values(parsed).returning();
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/feedback/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const id = getParam(req.params.id);
      const [existing] = await db.select().from(residentFeedbacks).where(eq(residentFeedbacks.id, id)).limit(1);
      if (!existing) return res.status(404).json({ message: "Feedback not found" });
      assertAssociationScope(req, existing.associationId);
      const updates = insertResidentFeedbackSchema.partial().parse(req.body);
      const resolvedAt = updates.status === "resolved" && existing.status !== "resolved" ? new Date() : existing.resolvedAt;
      const [result] = await db.update(residentFeedbacks).set({ ...updates, resolvedAt, updatedAt: new Date() }).where(eq(residentFeedbacks.id, id)).returning();
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Portal: submit feedback
  app.post("/api/portal/feedback", requirePortal, async (req: PortalRequest, res) => {
    try {
      const { category, satisfactionScore, subject, feedbackText, isAnonymous } = req.body;
      const [result] = await db.insert(residentFeedbacks).values({
        associationId: req.portalAssociationId!,
        unitId: null,
        personId: isAnonymous ? null : req.portalPersonId,
        category: category ?? "general",
        satisfactionScore: satisfactionScore ?? null,
        subject: subject ?? null,
        feedbackText: feedbackText ?? null,
        isAnonymous: isAnonymous ? 1 : 0,
        status: "open",
      }).returning();
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Community announcements (admin CRUD)
  app.get("/api/announcements", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      assertAssociationScope(req, associationId);
      const rows = await db.select().from(communityAnnouncements).where(eq(communityAnnouncements.associationId, associationId));
      res.json(rows.sort((a, b) => (b.isPinned - a.isPinned) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/announcements", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const parsed = insertCommunityAnnouncementSchema.parse({ ...req.body, createdBy: req.adminUserEmail ?? null });
      assertAssociationInputScope(req, parsed.associationId);
      const [result] = await db.insert(communityAnnouncements).values(parsed).returning();
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/announcements/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const id = getParam(req.params.id);
      const [existing] = await db.select().from(communityAnnouncements).where(eq(communityAnnouncements.id, id)).limit(1);
      if (!existing) return res.status(404).json({ message: "Announcement not found" });
      assertAssociationScope(req, existing.associationId);
      const updates = insertCommunityAnnouncementSchema.partial().parse(req.body);
      const [result] = await db.update(communityAnnouncements).set({ ...updates, updatedAt: new Date() }).where(eq(communityAnnouncements.id, id)).returning();
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/announcements/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const id = getParam(req.params.id);
      const [existing] = await db.select().from(communityAnnouncements).where(eq(communityAnnouncements.id, id)).limit(1);
      if (!existing) return res.status(404).json({ message: "Announcement not found" });
      assertAssociationScope(req, existing.associationId);
      await db.delete(communityAnnouncements).where(eq(communityAnnouncements.id, id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Portal: get published announcements
  app.get("/api/portal/announcements", requirePortal, async (req: PortalRequest, res) => {
    try {
      const now = new Date();
      const rows = await db.select().from(communityAnnouncements).where(
        and(
          eq(communityAnnouncements.associationId, req.portalAssociationId!),
          eq(communityAnnouncements.isPublished, 1),
        ),
      );
      const active = rows.filter(r => !r.expiresAt || new Date(r.expiresAt) > now);
      res.json(active.sort((a, b) => (b.isPinned - a.isPinned) || new Date(b.publishedAt ?? b.createdAt).getTime() - new Date(a.publishedAt ?? a.createdAt).getTime()));
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

  // ── Webhook signing secrets management ──────────────────────────────────
  app.get("/api/admin/webhook-secrets", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      assertAssociationScope(req, associationId);
      const rows = await db.select({
        id: webhookSigningSecrets.id,
        associationId: webhookSigningSecrets.associationId,
        secretHint: webhookSigningSecrets.secretHint,
        provider: webhookSigningSecrets.provider,
        isActive: webhookSigningSecrets.isActive,
        rotatedAt: webhookSigningSecrets.rotatedAt,
        createdAt: webhookSigningSecrets.createdAt,
      }).from(webhookSigningSecrets).where(eq(webhookSigningSecrets.associationId, associationId));
      res.json(rows);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/admin/webhook-secrets", requireAdmin, requireAdminRole(["platform-admin"]), async (req: AdminRequest, res) => {
    try {
      const { associationId, plainSecret, provider } = req.body as { associationId: string; plainSecret: string; provider?: string };
      if (!associationId || !plainSecret) return res.status(400).json({ message: "associationId and plainSecret are required" });
      assertAssociationInputScope(req, associationId);
      if (plainSecret.length < 16) return res.status(400).json({ message: "Secret must be at least 16 characters" });

      // Store hash of secret (we use HMAC itself so signing is verifiable; never store plaintext)
      const secretHash = createHmac("sha256", plainSecret).update("webhook-secret-key").digest("hex");
      const secretHint = `••••${plainSecret.slice(-4)}`;

      // Deactivate old
      await db.update(webhookSigningSecrets).set({ isActive: 0, rotatedAt: new Date() }).where(
        and(eq(webhookSigningSecrets.associationId, associationId), eq(webhookSigningSecrets.provider, provider || "generic"))
      );

      const [result] = await db.insert(webhookSigningSecrets).values({
        associationId,
        secretHash,
        secretHint,
        provider: provider || "generic",
        isActive: 1,
        createdBy: req.adminUserEmail || "unknown",
      }).returning();
      res.status(201).json({ ...result, secretHash: undefined }); // never return hash
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Payment event state transitions — admin can force-transition an event state
  app.get("/api/admin/payment-events", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      assertAssociationScope(req, associationId);
      const rows = await db.select().from(paymentWebhookEvents).where(eq(paymentWebhookEvents.associationId, associationId));
      res.json(rows);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/admin/payment-events/:id/status", requireAdmin, requireAdminRole(["platform-admin"]), async (req: AdminRequest, res) => {
    try {
      const id = req.params.id as string;
      const [event] = await db.select().from(paymentWebhookEvents).where(eq(paymentWebhookEvents.id, id)).limit(1);
      if (!event) return res.status(404).json({ message: "Event not found" });
      assertAssociationScope(req, event.associationId);
      const { status, reason } = req.body as { status: "received" | "processed" | "ignored" | "failed"; reason?: string };
      if (!["received", "processed", "ignored", "failed"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      const fromStatus = event.status;
      const [updated] = await db.update(paymentWebhookEvents).set({ status, updatedAt: new Date(), ...(status === "processed" ? { processedAt: new Date() } : {}) }).where(eq(paymentWebhookEvents.id, id)).returning();
      // Record state transition
      await db.insert(paymentEventTransitions).values({
        webhookEventId: id,
        fromStatus,
        toStatus: status,
        reason: reason || "Manual admin override",
        transitionedBy: req.adminUserEmail || "admin",
      });
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/admin/payment-events/:id/transitions", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const id = req.params.id as string;
      const rows = await db.select().from(paymentEventTransitions).where(eq(paymentEventTransitions.webhookEventId, id));
      res.json(rows);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // ── Autopay enrollment ───────────────────────────────────────────────────
  app.get("/api/financial/autopay/enrollments", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      assertAssociationScope(req, associationId);
      const rows = await db.select().from(autopayEnrollments).where(eq(autopayEnrollments.associationId, associationId));
      res.json(rows);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/financial/autopay/enrollments", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const parsed = insertAutopayEnrollmentSchema.parse({ ...req.body, enrolledBy: req.adminUserEmail || "unknown" });
      assertAssociationInputScope(req, parsed.associationId);
      // Compute first nextPaymentDate
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), parsed.dayOfMonth ?? 1);
      if (next <= now) next.setMonth(next.getMonth() + 1);
      const [result] = await db.insert(autopayEnrollments).values({ ...parsed, nextPaymentDate: next }).returning();
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/financial/autopay/enrollments/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const id = req.params.id as string;
      const [existing] = await db.select().from(autopayEnrollments).where(eq(autopayEnrollments.id, id)).limit(1);
      if (!existing) return res.status(404).json({ message: "Enrollment not found" });
      assertAssociationScope(req, existing.associationId);
      const updates = insertAutopayEnrollmentSchema.partial().parse(req.body);
      const now = new Date();
      const setClauses: Partial<typeof existing> = { ...updates, updatedAt: now };
      if (updates.status === "cancelled") {
        (setClauses as any).cancelledBy = req.adminUserEmail || "unknown";
        (setClauses as any).cancelledAt = now;
      }
      const [result] = await db.update(autopayEnrollments).set(setClauses).where(eq(autopayEnrollments.id, id)).returning();
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Run due autopay charges — processes all active enrollments whose nextPaymentDate <= now
  app.post("/api/financial/autopay/run", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const { associationId } = req.body as { associationId: string };
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      assertAssociationInputScope(req, associationId);

      const now = new Date();
      const enrollments = await db.select().from(autopayEnrollments).where(
        and(eq(autopayEnrollments.associationId, associationId), eq(autopayEnrollments.status, "active"))
      );
      const dueNow = enrollments.filter(e => !e.nextPaymentDate || new Date(e.nextPaymentDate) <= now);

      let succeeded = 0;
      let failed = 0;

      for (const enrollment of dueNow) {
        try {
          const [entry] = await db.insert(ownerLedgerEntries).values({
            associationId,
            unitId: enrollment.unitId,
            personId: enrollment.personId,
            entryType: "payment",
            amount: -Math.abs(enrollment.amount),
            postedAt: now,
            description: enrollment.description,
            referenceType: "autopay_enrollment",
            referenceId: enrollment.id,
          }).returning();

          await db.insert(autopayRuns).values({
            enrollmentId: enrollment.id,
            associationId,
            amount: enrollment.amount,
            status: "success",
            ledgerEntryId: entry.id,
            ranAt: now,
          });

          // Advance nextPaymentDate
          const next = new Date(now);
          if (enrollment.frequency === "monthly") next.setMonth(next.getMonth() + 1);
          else if (enrollment.frequency === "quarterly") next.setMonth(next.getMonth() + 3);
          else if (enrollment.frequency === "annual") next.setFullYear(next.getFullYear() + 1);
          next.setDate(enrollment.dayOfMonth ?? 1);
          await db.update(autopayEnrollments).set({ nextPaymentDate: next, updatedAt: new Date() }).where(eq(autopayEnrollments.id, enrollment.id));
          succeeded++;
        } catch (err: any) {
          await db.insert(autopayRuns).values({
            enrollmentId: enrollment.id,
            associationId,
            amount: enrollment.amount,
            status: "failed",
            errorMessage: err.message,
            ranAt: now,
          });
          failed++;
        }
      }
      res.json({ succeeded, failed, totalDue: dueNow.length });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/financial/autopay/runs", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      assertAssociationScope(req, associationId);
      const rows = await db.select().from(autopayRuns).where(eq(autopayRuns.associationId, associationId));
      res.json(rows);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Portal: owner enroll/view/cancel autopay
  app.get("/api/portal/autopay", requirePortal, async (req: PortalRequest, res) => {
    try {
      const rows = await db.select().from(autopayEnrollments).where(
        and(eq(autopayEnrollments.associationId, req.portalAssociationId!), eq(autopayEnrollments.personId, req.portalPersonId!))
      );
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/portal/autopay/enroll", requirePortal, async (req: PortalRequest, res) => {
    try {
      const { amount, frequency, dayOfMonth, description, unitId } = req.body as {
        amount: number; frequency: string; dayOfMonth: number; description?: string; unitId: string;
      };
      if (!amount || amount <= 0) return res.status(400).json({ message: "amount must be positive" });
      if (!unitId) return res.status(400).json({ message: "unitId is required" });

      // Check if already enrolled
      const [existing] = await db.select().from(autopayEnrollments).where(
        and(
          eq(autopayEnrollments.associationId, req.portalAssociationId!),
          eq(autopayEnrollments.personId, req.portalPersonId!),
          eq(autopayEnrollments.unitId, unitId),
          eq(autopayEnrollments.status, "active"),
        )
      ).limit(1);
      if (existing) return res.status(409).json({ message: "Autopay already active for this unit" });

      const now = new Date();
      const day = dayOfMonth || 1;
      const next = new Date(now.getFullYear(), now.getMonth(), day);
      if (next <= now) next.setMonth(next.getMonth() + 1);

      const [enrollment] = await db.insert(autopayEnrollments).values({
        associationId: req.portalAssociationId!,
        unitId,
        personId: req.portalPersonId!,
        amount,
        frequency: (frequency || "monthly") as "monthly" | "quarterly" | "annual",
        dayOfMonth: day,
        status: "active",
        nextPaymentDate: next,
        description: description || "Autopay HOA dues",
        enrolledBy: req.portalPersonId!,
      }).returning();
      res.status(201).json(enrollment);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/portal/autopay/:enrollmentId", requirePortal, async (req: PortalRequest, res) => {
    try {
      const enrollmentId = req.params.enrollmentId as string;
      const [enrollment] = await db.select().from(autopayEnrollments).where(eq(autopayEnrollments.id, enrollmentId)).limit(1);
      if (!enrollment) return res.status(404).json({ message: "Enrollment not found" });
      if (enrollment.personId !== req.portalPersonId) return res.status(403).json({ message: "Not authorized" });

      const { status } = req.body as { status: "paused" | "cancelled" };
      const now = new Date();
      const [result] = await db.update(autopayEnrollments).set({
        status: status as "paused" | "cancelled",
        cancelledBy: status === "cancelled" ? req.portalPersonId! : undefined,
        cancelledAt: status === "cancelled" ? now : undefined,
        updatedAt: now,
      }).where(eq(autopayEnrollments.id, enrollmentId)).returning();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ── Saved payment methods (portal) ──────────────────────────────────────
  app.get("/api/portal/payment-methods", requirePortal, async (req: PortalRequest, res) => {
    try {
      const rows = await db.select().from(savedPaymentMethods).where(
        and(
          eq(savedPaymentMethods.associationId, req.portalAssociationId!),
          eq(savedPaymentMethods.personId, req.portalPersonId!),
          eq(savedPaymentMethods.isActive, 1),
        )
      );
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/portal/payment-methods", requirePortal, async (req: PortalRequest, res) => {
    try {
      const { methodType, displayName, last4, bankName, externalTokenRef } = req.body as {
        methodType: string; displayName: string; last4?: string; bankName?: string; externalTokenRef?: string;
      };
      if (!displayName) return res.status(400).json({ message: "displayName is required" });

      // If setting as default, clear existing defaults
      if (req.body.isDefault) {
        await db.update(savedPaymentMethods).set({ isDefault: 0 }).where(
          and(eq(savedPaymentMethods.associationId, req.portalAssociationId!), eq(savedPaymentMethods.personId, req.portalPersonId!))
        );
      }

      const [result] = await db.insert(savedPaymentMethods).values({
        associationId: req.portalAssociationId!,
        personId: req.portalPersonId!,
        methodType: (methodType || "ach") as "ach" | "card" | "check" | "zelle" | "other",
        displayName,
        last4: last4 || null,
        bankName: bankName || null,
        externalTokenRef: externalTokenRef || null,
        isDefault: req.body.isDefault ? 1 : 0,
      }).returning();
      res.status(201).json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/portal/payment-methods/:id", requirePortal, async (req: PortalRequest, res) => {
    try {
      const id = req.params.id as string;
      const [method] = await db.select().from(savedPaymentMethods).where(eq(savedPaymentMethods.id, id)).limit(1);
      if (!method) return res.status(404).json({ message: "Payment method not found" });
      if (method.personId !== req.portalPersonId) return res.status(403).json({ message: "Not authorized" });

      const { isDefault, isActive, displayName } = req.body as { isDefault?: number; isActive?: number; displayName?: string };

      // If setting as default, clear existing defaults first
      if (isDefault === 1) {
        await db.update(savedPaymentMethods).set({ isDefault: 0 }).where(
          and(eq(savedPaymentMethods.associationId, req.portalAssociationId!), eq(savedPaymentMethods.personId, req.portalPersonId!))
        );
      }

      const [result] = await db.update(savedPaymentMethods).set({
        ...(isDefault !== undefined ? { isDefault } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        ...(displayName ? { displayName } : {}),
        updatedAt: new Date(),
      }).where(eq(savedPaymentMethods.id, id)).returning();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ── Partial payment rules ────────────────────────────────────────────────
  app.get("/api/financial/partial-payment-rules", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      assertAssociationScope(req, associationId);
      const [rule] = await db.select().from(partialPaymentRules).where(eq(partialPaymentRules.associationId, associationId)).limit(1);
      res.json(rule ?? null);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/financial/partial-payment-rules", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const body = { ...req.body };
      const parsed = insertPartialPaymentRuleSchema.parse(body);
      assertAssociationInputScope(req, parsed.associationId);
      const existing = await db.select().from(partialPaymentRules).where(eq(partialPaymentRules.associationId, parsed.associationId)).limit(1);
      if (existing.length > 0) {
        const [result] = await db.update(partialPaymentRules).set({ ...parsed, updatedAt: new Date() }).where(eq(partialPaymentRules.associationId, parsed.associationId)).returning();
        return res.json(result);
      }
      const [result] = await db.insert(partialPaymentRules).values(parsed).returning();
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // ── QA seed data management ──────────────────────────────────────────────
  // Preview which associations match QA/test patterns
  app.get("/api/admin/qa-seed/preview", requireAdmin, requireAdminRole(["platform-admin"]), async (req: AdminRequest, res) => {
    try {
      const all = await storage.getAssociations({ includeArchived: true });
      const qaPatterns = [/^QA\s/i, /\bVerify\b/i, /\bVerification\b/i, /AI Ingestion (Verify|Benchmark)/i, /^M\d Verify/i, /^M\d [AB] \w{8}/i, /\bDbg Assoc\b/i, /Test Towers/i, /\d{6,}$/];
      const qaAssocs = all.filter(a => qaPatterns.some(p => p.test(a.name)));
      res.json({ count: qaAssocs.length, associations: qaAssocs.map(a => ({ id: a.id, name: a.name, city: (a as any).city })) });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Dry-run or actual purge of QA associations (platform-admin only, requires explicit confirmation)
  app.post("/api/admin/qa-seed/purge", requireAdmin, requireAdminRole(["platform-admin"]), async (req: AdminRequest, res) => {
    try {
      const { confirm, dryRun } = req.body as { confirm?: boolean; dryRun?: boolean };
      if (!dryRun && !confirm) return res.status(400).json({ message: "Must send confirm=true to execute purge" });

      const all = await storage.getAssociations({ includeArchived: true });
      const qaPatterns = [/^QA\s/i, /\bVerify\b/i, /\bVerification\b/i, /AI Ingestion (Verify|Benchmark)/i, /^M\d Verify/i, /^M\d [AB] \w{8}/i, /\bDbg Assoc\b/i, /Test Towers/i, /\d{6,}$/];
      const qaAssocs = all.filter(a => qaPatterns.some(p => p.test(a.name)));

      if (dryRun) {
        return res.json({ dryRun: true, wouldDelete: qaAssocs.length, associations: qaAssocs.map(a => ({ id: a.id, name: a.name })) });
      }

      return res.json({
        dryRun: false,
        identified: qaAssocs.length,
        message: `Identified ${qaAssocs.length} QA associations. Use DELETE /api/associations/:id for each to hard-delete.`,
        associationIds: qaAssocs.map(a => a.id),
        associations: qaAssocs.map(a => ({ id: a.id, name: a.name })),
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // ── Feature flags + staged rollout controls ─────────────────────────────
  // List all feature flags (platform-admin only for write, all for read)
  app.get("/api/admin/feature-flags", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const rows = await db.select().from(featureFlags);
      res.json(rows);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/admin/feature-flags", requireAdmin, requireAdminRole(["platform-admin"]), async (req: AdminRequest, res) => {
    try {
      const parsed = insertFeatureFlagSchema.parse({ ...req.body, createdBy: req.adminUserEmail || "unknown" });
      const [result] = await db.insert(featureFlags).values(parsed).returning();
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/admin/feature-flags/:id", requireAdmin, requireAdminRole(["platform-admin"]), async (req: AdminRequest, res) => {
    try {
      const id = req.params.id as string;
      const updates = insertFeatureFlagSchema.partial().parse(req.body);
      const [result] = await db.update(featureFlags).set({ ...updates, updatedAt: new Date() }).where(eq(featureFlags.id, id)).returning();
      if (!result) return res.status(404).json({ message: "Flag not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Per-association flag overrides
  app.get("/api/admin/feature-flags/associations", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      if (!associationId) {
        // Return all if platform-admin
        const rows = await db.select().from(associationFeatureFlags);
        return res.json(rows);
      }
      assertAssociationScope(req, associationId);
      const rows = await db.select().from(associationFeatureFlags).where(eq(associationFeatureFlags.associationId, associationId));
      res.json(rows);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/admin/feature-flags/:flagId/associations/:associationId", requireAdmin, requireAdminRole(["platform-admin"]), async (req: AdminRequest, res) => {
    try {
      const flagId = req.params.flagId as string;
      const assocId = req.params.associationId as string;
      const { enabled, rolloutPercent, notes } = req.body as { enabled: number; rolloutPercent?: number; notes?: string };
      // Upsert
      const existing = await db.select().from(associationFeatureFlags).where(
        and(eq(associationFeatureFlags.flagId, flagId), eq(associationFeatureFlags.associationId, assocId))
      ).limit(1);
      if (existing.length > 0) {
        const [result] = await db.update(associationFeatureFlags).set({
          enabled,
          rolloutPercent: rolloutPercent ?? existing[0].rolloutPercent,
          notes: notes ?? existing[0].notes,
          updatedBy: req.adminUserEmail || "unknown",
          updatedAt: new Date(),
        }).where(and(eq(associationFeatureFlags.flagId, flagId), eq(associationFeatureFlags.associationId, assocId))).returning();
        return res.json(result);
      }
      const [result] = await db.insert(associationFeatureFlags).values({
        flagId,
        associationId: assocId,
        enabled,
        rolloutPercent: rolloutPercent ?? 100,
        notes,
        updatedBy: req.adminUserEmail || "unknown",
      }).returning();
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

  // Portal OTP login — step 1: request a one-time code (email-only, no association ID required)
  app.post("/api/portal/request-login", async (req, res) => {
    try {
      const email = getParam(req.body?.email).trim().toLowerCase();
      if (!email) return res.status(400).json({ message: "email is required" });

      // Check whether this email has any active portal access across any association
      const accesses = await storage.getPortalAccessesByEmail(email);
      const activeAccesses = accesses.filter((a) => {
        if (a.status !== "active" && a.status !== "invited") return false;
        if (a.role !== "board-member" && !a.unitId) return false;
        return true;
      });

      // Auto-provision portal access if the email matches a known owner/person with no existing access
      if (activeAccesses.length === 0) {
        const matchingPersons = await db
          .select()
          .from(persons)
          .where(ilike(persons.email, email));

        if (matchingPersons.length > 0) {
          const personIds = matchingPersons.map((p) => p.id);

          // Find all active ownerships for these persons
          const activeOwnerships = await db
            .select({ personId: ownerships.personId, unitId: ownerships.unitId })
            .from(ownerships)
            .where(and(inArray(ownerships.personId, personIds), isNull(ownerships.endDate)));

          if (activeOwnerships.length > 0) {
            const unitIds = Array.from(new Set(activeOwnerships.map((o) => o.unitId)));

            // Resolve each unit's associationId
            const unitRows = await db
              .select({ id: units.id, associationId: units.associationId })
              .from(units)
              .where(inArray(units.id, unitIds));

            const unitAssocMap = new Map(unitRows.map((u) => [u.id, u.associationId]));

            // Build unique (associationId, personId) pairs to provision
            const toProvision = new Map<string, { associationId: string; personId: string; unitId: string }>();
            for (const o of activeOwnerships) {
              const associationId = unitAssocMap.get(o.unitId);
              if (!associationId) continue;
              const key = `${associationId}:${o.personId}`;
              if (!toProvision.has(key)) {
                toProvision.set(key, { associationId, personId: o.personId, unitId: o.unitId });
              }
            }

            // Check for any existing portal access records (any status) before creating
            const existingByAssoc = new Set(accesses.map((a) => a.associationId));

            for (const { associationId, personId, unitId } of Array.from(toProvision.values())) {
              if (existingByAssoc.has(associationId)) continue; // already has access (even if suspended/revoked)
              await storage.createPortalAccess(
                { associationId, personId, unitId, email, role: "owner", status: "active" },
                "system:auto-provision"
              );
              console.log("[portal-otp][auto-provision] Created portal access", { email, associationId, personId });
            }

            // Re-fetch after provisioning
            const refreshed = await storage.getPortalAccessesByEmail(email);
            activeAccesses.push(...refreshed.filter((a) => a.status === "active" || a.status === "invited"));
          }
        }
      }

      // Always respond with same message to avoid email enumeration
      if (activeAccesses.length === 0) {
        return res.json({ message: "If an account exists for this email, a login code has been sent." });
      }

      // Generate a 6-digit OTP (one token covers all associations for this email)
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const otpHash = createHmac("sha256", process.env.SESSION_SECRET || "portal-otp-secret").update(otp).digest("hex");
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      // Replace any existing pending token for this email
      await db.delete(portalLoginTokens).where(eq(portalLoginTokens.email, email));
      await db.insert(portalLoginTokens).values({ associationId: null, email, otpHash, expiresAt });

      // Send the OTP via email; fall back to simulation mode
      const emailProviderReady = isEmailProviderConfigured();
      if (emailProviderReady) {
        try {
          await sendPlatformEmail({
            to: email,
            subject: "Your Owner Portal Login Code — Your Condo Management",
            html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">

        <!-- Header -->
        <tr><td style="background-color:#1e293b;border-radius:12px 12px 0 0;padding:28px 32px">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <div style="display:inline-block;background-color:#6366f1;color:#ffffff;font-size:13px;font-weight:700;letter-spacing:0.05em;padding:6px 12px;border-radius:6px">YCM</div>
              </td>
            </tr>
            <tr><td style="padding-top:14px">
              <div style="font-size:20px;font-weight:600;color:#ffffff">Your Condo Management</div>
              <div style="font-size:13px;color:#94a3b8;margin-top:2px">Owner Portal</div>
            </td></tr>
          </table>
        </td></tr>

        <!-- Body -->
        <tr><td style="background-color:#ffffff;padding:32px">
          <p style="margin:0 0 8px;font-size:22px;font-weight:600;color:#0f172a">Your login code</p>
          <p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.6">
            Use the code below to sign in to your owner portal.<br>
            This code expires in <strong style="color:#0f172a">15 minutes</strong>.
          </p>

          <!-- Code block -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
            <tr><td style="background-color:#f1f5f9;border:2px dashed #cbd5e1;border-radius:10px;padding:28px;text-align:center">
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.12em;color:#64748b;margin-bottom:10px;font-weight:600">One-time code</div>
              <div style="font-size:42px;font-weight:700;letter-spacing:0.3em;color:#1e293b;font-family:'Courier New',Courier,monospace">${otp}</div>
            </td></tr>
          </table>

          <p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6">
            Enter this code on the login screen to access your account. For security, do not share this code with anyone — Your Condo Management will never ask for it.
          </p>

          <table cellpadding="0" cellspacing="0" style="margin-bottom:8px">
            <tr><td style="background-color:#fef3c7;border-left:3px solid #f59e0b;border-radius:0 4px 4px 0;padding:10px 14px">
              <span style="font-size:13px;color:#92400e">If you did not request this code, you can safely ignore this email.</span>
            </td></tr>
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background-color:#f1f5f9;border-radius:0 0 12px 12px;padding:20px 32px">
          <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center">
            &copy; ${new Date().getFullYear()} Your Condo Management &nbsp;&middot;&nbsp; Owner Portal &nbsp;&middot;&nbsp; This is an automated message, please do not reply.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
            text: `Your Condo Management — Owner Portal\n\nYour login code is: ${otp}\n\nThis code expires in 15 minutes. Enter it on the login screen to access your account.\n\nDo not share this code with anyone. If you did not request it, you can safely ignore this email.\n\n© ${new Date().getFullYear()} Your Condo Management`,
          });
        } catch (emailErr: any) {
          console.error("[portal-otp][email-send-failed]", { email, error: emailErr.message });
        }
      } else {
        console.warn("[portal-otp][simulation-mode] Email provider not configured — OTP will be returned in dev response", { email, otp });
      }

      const response: Record<string, unknown> = { message: "If an account exists for this email, a login code has been sent." };
      if (!emailProviderReady) {
        response.simulatedOtp = otp;
        response.simulationMode = true;
      }
      res.json(response);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Portal OTP login — step 2: verify code
  // Returns either { portalAccessId } (single association) or { associations: [...] } (picker needed)
  app.post("/api/portal/verify-login", async (req, res) => {
    try {
      const email = getParam(req.body?.email).trim().toLowerCase();
      const otp = getParam(req.body?.otp).trim();
      // Optional: owner has already chosen an association from the picker
      const chosenAssociationId = getParam(req.body?.associationId) || null;
      if (!email || !otp) return res.status(400).json({ message: "email and otp are required" });

      const [token] = await db
        .select()
        .from(portalLoginTokens)
        .where(eq(portalLoginTokens.email, email))
        .limit(1);

      if (!token) return res.status(400).json({ message: "No pending login code. Request a new one." });
      if (token.usedAt) return res.status(400).json({ message: "Login code already used. Request a new one." });
      if (new Date() > token.expiresAt) return res.status(400).json({ message: "Login code expired. Request a new one." });
      if (token.attempts >= 5) return res.status(429).json({ message: "Too many attempts. Request a new login code." });

      // Increment attempts before verifying to prevent timing-based enumeration
      await db.update(portalLoginTokens).set({ attempts: token.attempts + 1 }).where(eq(portalLoginTokens.id, token.id));

      const expectedHash = createHmac("sha256", process.env.SESSION_SECRET || "portal-otp-secret").update(otp).digest("hex");
      const match = timingSafeEqual(Buffer.from(expectedHash, "hex"), Buffer.from(token.otpHash, "hex"));
      if (!match) return res.status(400).json({ message: "Invalid login code." });

      // Mark token used
      await db.update(portalLoginTokens).set({ usedAt: new Date() }).where(eq(portalLoginTokens.id, token.id));

      // Resolve all active portal accesses for this email
      const allAccesses = await storage.getPortalAccessesByEmail(email);
      const activeAccesses = allAccesses.filter((a) => {
        if (a.status !== "active" && a.status !== "invited") return false;
        // Non-board accounts must have a unit linked — no unit means nothing useful to show
        if (a.role !== "board-member" && !a.unitId) return false;
        return true;
      });
      if (activeAccesses.length === 0) return res.status(404).json({ message: "No active portal access found" });

      // If owner has multiple associations and hasn't chosen yet, return the list
      if (activeAccesses.length > 1 && !chosenAssociationId) {
        const assocIds = activeAccesses.map((a) => a.associationId);
        const allAssocs = await storage.getAssociations();
        const assocMap = new Map(allAssocs.filter((a) => assocIds.includes(a.id)).map((a) => [a.id, a]));
        return res.json({
          associations: activeAccesses.map((a) => ({
            portalAccessId: a.id,
            associationId: a.associationId,
            associationName: assocMap.get(a.associationId)?.name ?? a.associationId,
            associationCity: assocMap.get(a.associationId)?.city ?? null,
            role: a.role,
            email: a.email,
          })),
        });
      }

      // Single association, or owner already picked one
      const access = chosenAssociationId
        ? activeAccesses.find((a) => a.associationId === chosenAssociationId)
        : activeAccesses[0];
      if (!access) return res.status(404).json({ message: "No portal access found for that association" });

      let sessionAccess = access;
      if (access.status === "invited" && access.boardRoleId) {
        const [boardRole] = (await storage.getBoardRoles(access.associationId)).filter((r) => r.id === access.boardRoleId);
        if (boardRole) {
          sessionAccess = (await storage.updatePortalAccess(access.id, { status: "active", acceptedAt: access.acceptedAt ?? new Date() }, "system")) ?? access;
        }
      }
      if (sessionAccess.status !== "active") return res.status(404).json({ message: "No active portal access found" });
      await storage.touchPortalAccessLogin(sessionAccess.id);
      res.json({ portalAccessId: sessionAccess.id, associationId: sessionAccess.associationId, role: sessionAccess.role, email: sessionAccess.email });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Legacy email-only portal session (kept for backward compatibility; deprecated in favor of OTP flow)
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
    let unitNumber: string | null = null;
    let building: string | null = null;
    if (access.unitId) {
      const unit = await storage.getUnitById(access.unitId);
      if (unit) {
        unitNumber = unit.unitNumber ?? null;
        building = unit.building ?? null;
      }
    }
    res.json({
      ...access,
      hasBoardAccess: Boolean(req.portalHasBoardAccess),
      effectiveRole: req.portalEffectiveRole || access.role,
      boardRoleId: req.portalBoardRoleId ?? access.boardRoleId ?? null,
      unitNumber,
      building,
    });
  });

  // Returns public-facing details for the portal user's association
  app.get("/api/portal/association", requirePortal, async (req: PortalRequest, res) => {
    try {
      const assocs = await storage.getAssociations();
      const assoc = assocs.find((a) => a.id === req.portalAssociationId);
      if (!assoc) return res.status(404).json({ message: "Association not found" });
      res.json({
        id: assoc.id,
        name: assoc.name,
        associationType: assoc.associationType ?? null,
        address: assoc.address ?? null,
        city: assoc.city ?? null,
        state: assoc.state ?? null,
        country: assoc.country ?? null,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Returns all associations the signed-in owner's email has portal access to (for switcher)
  app.get("/api/portal/my-associations", requirePortal, async (req: PortalRequest, res) => {
    try {
      const email = req.portalEmail || "";
      const accesses = await storage.getPortalAccessesByEmail(email);
      const active = accesses.filter((a) => a.status === "active" || a.status === "invited");
      const allAssocs = await storage.getAssociations();
      const assocMap = new Map(allAssocs.map((a) => [a.id, a]));
      // Fetch unit info for all accesses that have a unitId
      const unitIds = active.map((a) => a.unitId).filter(Boolean) as string[];
      const unitMap = new Map<string, { unitNumber: string | null; building: string | null }>();
      if (unitIds.length > 0) {
        const unitRows = await db.select().from(units).where(inArray(units.id, unitIds));
        for (const u of unitRows) unitMap.set(u.id, { unitNumber: u.unitNumber, building: u.building });
      }
      res.json(active.map((a) => ({
        portalAccessId: a.id,
        associationId: a.associationId,
        associationName: assocMap.get(a.associationId)?.name ?? a.associationId,
        associationCity: assocMap.get(a.associationId)?.city ?? null,
        role: a.role,
        email: a.email,
        unitId: a.unitId ?? null,
        unitNumber: a.unitId ? (unitMap.get(a.unitId)?.unitNumber ?? null) : null,
        building: a.unitId ? (unitMap.get(a.unitId)?.building ?? null) : null,
      })));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/portal/units-balance", requirePortal, async (req: PortalRequest, res) => {
    try {
      if (!req.portalAssociationId || !req.portalPersonId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      // Find all active portal_access records for this person in this association
      const email = req.portalEmail || "";
      const accesses = await storage.getPortalAccessesByEmail(email);
      const myAccesses = accesses.filter(
        (a) => a.associationId === req.portalAssociationId && (a.status === "active" || a.status === "invited") && a.unitId
      );
      const unitIds = myAccesses.map((a) => a.unitId).filter(Boolean) as string[];
      if (unitIds.length === 0) return res.json([]);
      const [allEntries, unitRows] = await Promise.all([
        storage.getOwnerLedgerEntries(req.portalAssociationId),
        db.select().from(units).where(inArray(units.id, unitIds)),
      ]);
      const unitMap = new Map(unitRows.map((u) => [u.id, u]));
      const result = unitIds.map((unitId) => {
        const entries = allEntries.filter((e) => e.personId === req.portalPersonId && e.unitId === unitId);
        const balance = entries.reduce((sum, e) => sum + e.amount, 0);
        const unit = unitMap.get(unitId);
        return {
          unitId,
          unitNumber: unit?.unitNumber ?? null,
          building: unit?.building ?? null,
          portalAccessId: myAccesses.find((a) => a.unitId === unitId)?.id ?? null,
          balance,
        };
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
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

  app.get("/api/portal/ledger", requirePortal, async (req: PortalRequest, res) => {
    try {
      if (!req.portalAssociationId || !req.portalPersonId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const allEntries = await storage.getOwnerLedgerEntries(req.portalAssociationId);
      const myEntries = allEntries.filter((e) => e.personId === req.portalPersonId);
      const balance = myEntries.reduce((sum, e) => sum + e.amount, 0);
      res.json({ entries: myEntries, balance });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/portal/financial-dashboard", requirePortal, async (req: PortalRequest, res) => {
    try {
      if (!req.portalAssociationId || !req.portalPersonId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const [allEntries, feeSchedules, paymentPlansAll] = await Promise.all([
        storage.getOwnerLedgerEntries(req.portalAssociationId),
        storage.getHoaFeeSchedules(req.portalAssociationId),
        db.select().from(paymentPlans).where(
          and(eq(paymentPlans.associationId, req.portalAssociationId), eq(paymentPlans.personId, req.portalPersonId))
        ),
      ]);
      const myEntries = allEntries.filter((e) => e.personId === req.portalPersonId);
      const balance = myEntries.reduce((sum, e) => sum + e.amount, 0);
      const activeSchedules = feeSchedules.filter((s) => s.isActive === 1);
      const activePlan = paymentPlansAll.find((p) => p.status === "active") ?? null;
      // Compute next charge due date from active fee schedules
      const nextDue = activeSchedules.length > 0 ? (activeSchedules[0].startDate ? new Date(activeSchedules[0].startDate) : null) : null;
      res.json({
        balance,
        totalCharged: myEntries.filter((e) => ["charge", "assessment", "late-fee"].includes(e.entryType)).reduce((s, e) => s + e.amount, 0),
        totalPaid: Math.abs(myEntries.filter((e) => ["payment", "credit"].includes(e.entryType)).reduce((s, e) => s + e.amount, 0)),
        feeSchedules: activeSchedules.map((s) => ({ id: s.id, name: s.name, amount: s.amount, frequency: s.frequency })),
        nextDueDate: nextDue ? nextDue.toISOString() : null,
        paymentPlan: activePlan ? {
          id: activePlan.id,
          totalAmount: activePlan.totalAmount,
          amountPaid: activePlan.amountPaid,
          installmentAmount: activePlan.installmentAmount,
          installmentFrequency: activePlan.installmentFrequency,
          nextDueDate: activePlan.nextDueDate,
          status: activePlan.status,
        } : null,
        recentEntries: myEntries.slice(-10),
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/portal/payment", requirePortal, async (req: PortalRequest, res) => {
    try {
      if (!req.portalAssociationId || !req.portalPersonId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const amount = Number(req.body.amount);
      if (!amount || !Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ message: "amount must be a positive number" });
      }
      const description = typeof req.body.description === "string" ? req.body.description.trim() : "Owner payment";
      const unitIdFromBody = typeof req.body.unitId === "string" ? req.body.unitId : null;
      if (!unitIdFromBody) {
        return res.status(400).json({ message: "unitId is required to record a payment" });
      }

      // Check partial-payment rules
      const [partialRule] = await db.select().from(partialPaymentRules).where(eq(partialPaymentRules.associationId, req.portalAssociationId)).limit(1);
      if (partialRule) {
        if (!partialRule.allowPartialPayments) {
          // Must pay full balance
          const allEntries = await db.select().from(ownerLedgerEntries).where(
            and(eq(ownerLedgerEntries.associationId, req.portalAssociationId), eq(ownerLedgerEntries.unitId, unitIdFromBody))
          );
          const balance = allEntries.reduce((sum, e) => sum + (e.amount ?? 0), 0);
          if (balance > 0 && Math.abs(amount - balance) > 0.01) {
            return res.status(400).json({ message: `Partial payments are not allowed. Full balance due: $${balance.toFixed(2)}` });
          }
        }
        if (partialRule.minimumPaymentAmount && amount < partialRule.minimumPaymentAmount) {
          return res.status(400).json({ message: `Minimum payment is $${partialRule.minimumPaymentAmount.toFixed(2)}` });
        }
        if (partialRule.minimumPaymentPercent) {
          const allEntries = await db.select().from(ownerLedgerEntries).where(
            and(eq(ownerLedgerEntries.associationId, req.portalAssociationId), eq(ownerLedgerEntries.unitId, unitIdFromBody))
          );
          const balance = allEntries.reduce((sum, e) => sum + (e.amount ?? 0), 0);
          if (balance > 0) {
            const minRequired = balance * (partialRule.minimumPaymentPercent / 100);
            if (amount < minRequired) {
              return res.status(400).json({ message: `Minimum payment is ${partialRule.minimumPaymentPercent}% of balance ($${minRequired.toFixed(2)})` });
            }
          }
        }
      }

      // Record as a negative ledger entry (payment reduces balance)
      const [entry] = await db.insert(ownerLedgerEntries).values({
        associationId: req.portalAssociationId,
        personId: req.portalPersonId,
        unitId: unitIdFromBody,
        entryType: "payment",
        amount: -Math.abs(amount),
        description,
        postedAt: new Date(),
      }).returning();

      const receiptData = {
        entry,
        receipt: {
          confirmationNumber: entry.id.slice(0, 8).toUpperCase(),
          amount: Math.abs(amount),
          description,
          postedAt: entry.postedAt,
          message: "Payment recorded successfully",
        },
      };
      res.status(201).json(receiptData);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
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

  // Public endpoint — no auth required.
  // Returns whether at least one active platform-admin exists.
  // Use this in deployment health checks or post-deploy validation.
  // If hasAdmin is false, set PLATFORM_ADMIN_EMAILS env var and restart.
  app.get("/api/system/bootstrap-status", async (_req, res) => {
    try {
      const allAdmins = await storage.getAdminUsers();
      const activePlatformAdmins = allAdmins.filter(
        (u) => u.role === "platform-admin" && u.isActive === 1
      );
      res.json({
        hasAdmin: activePlatformAdmins.length > 0,
        adminCount: activePlatformAdmins.length,
        message:
          activePlatformAdmins.length > 0
            ? "Platform is configured correctly."
            : "No active platform-admin found. Set PLATFORM_ADMIN_EMAILS env var and restart the server.",
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
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

  app.patch("/api/admin/users/:id/active", requireAdmin, requireAdminRole(["platform-admin"]), async (req: AdminRequest, res) => {
    try {
      const isActive = req.body?.isActive;
      if (typeof isActive !== "boolean") {
        return res.status(400).json({ message: "isActive must be a boolean" });
      }
      if (req.adminUserId === getParam(req.params.id)) {
        return res.status(400).json({ message: "Cannot change your own active status" });
      }
      const result = await storage.setAdminUserActive(
        getParam(req.params.id),
        isActive,
        req.adminUserEmail || "system",
      );
      if (!result) return res.status(404).json({ message: "Admin user not found" });
      res.json(result);
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

  // Board package distribution history
  app.get("/api/admin/board-packages/distribution-history", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      assertAssociationScope(req, associationId);
      const distributed = await db.select().from(boardPackages)
        .where(and(
          eq(boardPackages.associationId, associationId),
          isNotNull(boardPackages.distributedAt)
        ))
        .orderBy(boardPackages.distributedAt);
      const autoScheduleStats = await db.select().from(boardPackageTemplates)
        .where(eq(boardPackageTemplates.associationId, associationId));
      res.json({
        distributed,
        autoScheduleStats: autoScheduleStats.map(t => ({
          id: t.id,
          title: t.title,
          autoGenerate: t.autoGenerate,
          lastAutoGeneratedAt: t.lastAutoGeneratedAt,
          generateDaysBefore: t.generateDaysBefore,
          frequency: t.frequency,
        })),
      });
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
