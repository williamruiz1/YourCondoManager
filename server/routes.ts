import { z } from "zod";
import type { Express, NextFunction, Request, Response } from "express";
import { type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import { createHmac, timingSafeEqual } from "crypto";
import { storage } from "./storage";
import { db } from "./db";
import { debug } from "./logger";
import { getGoogleOAuthStatus, registerAuthRoutes } from "./auth";
import {
  sendAssociationAdminEmailNotification,
  sendDirectAdminEmailNotification,
  sendPlatformAdminEmailNotification,
} from "./admin-notification-service";
import { processSpecialAssessmentInstallments } from "./assessment-installments";
import { buildFtphDocumentationFeatureTree } from "./ftph-feature-tree";
import { and, count, desc, eq, gte, ilike, inArray, isNotNull, isNull, lte, ne, notInArray, or, sql, sum } from "drizzle-orm";
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
import { getSmsProviderStatus, isSmsProviderConfigured, normalizePhoneNumber, sendSms } from "./sms-provider";
import { getVapidPublicKey, getPushProviderStatus, sendPushNotification, isPushProviderConfigured } from "./push-provider";
import { getSecret, setSecret, deleteSecret, invalidateSecretsCache } from "./platform-secrets-store";
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
  budgets,
  budgetVersions,
  budgetLines,
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
  insertElectionSchema,
  insertElectionOptionSchema,
  insertElectionProxyDesignationSchema,
  insertElectionProxyDocumentSchema,
  elections,
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
  buildings,
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
  partialPaymentRules,
  insertPartialPaymentRuleSchema,
  savedPaymentMethods,
  insertSavedPaymentMethodSchema,
  webhookSigningSecrets,
  insertWebhookSigningSecretSchema,
  paymentWebhookEvents,
  paymentEventTransitions,
  portalLoginTokens,
  occupancies,
  associations,
  vendorPortalCredentials,
  vendorPortalLoginTokens,
  vendorWorkOrderActivity,
  insertVendorPortalCredentialSchema,
  vendorInvoices,
  communicationHistory,
  portalAccess,
  smsDeliveryLogs,
  pushSubscriptions,
  auditLogs,
  adminUserPreferences,
  platformSubscriptions,
  platformWebhookEvents,
  roadmapProjects,
  roadmapWorkstreams,
  tenantConfigs,
  adminUsers,
  meetingNotes,
  electionBallotTokens,
  hubPageConfigs,
  hubActionLinks,
  hubInfoBlocks,
  hubMapLayers,
  hubMapNodes,
  hubMapIssues,
  insertHubPageConfigSchema,
  insertHubActionLinkSchema,
  insertHubInfoBlockSchema,
  insertHubMapLayerSchema,
  insertHubMapNodeSchema,
  insertHubMapIssueSchema,
} from "@shared/schema";
import {
  ADMIN_CONTEXTUAL_FEEDBACK_INBOX_WORKSTREAM_TITLE,
  ADMIN_CONTEXTUAL_FEEDBACK_PROJECT_ID,
  ADMIN_CONTEXTUAL_FEEDBACK_PROJECT_TITLE,
} from "@shared/admin-contextual-feedback";
import { normalizeAdminNotificationPreferences } from "@shared/admin-notification-preferences";
import { registerAutopayRoutes } from "./routes/autopay";

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

const adminContextualFeedbackSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().min(1).max(4000),
  feedbackType: z.enum(["bug", "enhancement"]),
  priority: z.enum(["low", "medium", "high", "critical"]).default("high"),
  screenshotBase64: z.string().max(5_000_000).nullable().optional(),
  context: z.object({
    route: z.string().min(1),
    selector: z.string().min(1).max(1000),
    domPath: z.string().min(1).max(2000),
    bounds: z.object({
      top: z.number(),
      left: z.number(),
      width: z.number(),
      height: z.number(),
      right: z.number(),
      bottom: z.number(),
    }),
    scroll: z.object({
      x: z.number(),
      y: z.number(),
    }),
    viewport: z.object({
      width: z.number(),
      height: z.number(),
    }),
    timestamp: z.string().min(1),
    componentName: z.string().nullable(),
    nodeName: z.string().min(1),
    className: z.string(),
    elementLabel: z.string().min(1),
    textPreview: z.string().nullable(),
  }),
});

const ADMIN_CONTEXTUAL_FEEDBACK_PROJECT_DESCRIPTION =
  "Platform-admin-only contextual feedback widget for inspecting live UI, capturing route and DOM context, and writing findings into the existing Admin roadmap.";
const ADMIN_CONTEXTUAL_FEEDBACK_INBOX_WORKSTREAM_DESCRIPTION =
  "Inbox for contextual feedback tickets captured from the live app before they are refined or moved into other implementation workstreams.";
const ADMIN_CONTEXTUAL_FEEDBACK_INBOX_WORKSTREAM_ORDER_INDEX = 3;

async function ensureAdminContextualFeedbackRoadmapTarget() {
  let project =
    await storage.getRoadmapProject(ADMIN_CONTEXTUAL_FEEDBACK_PROJECT_ID) ??
    (await db
      .select()
      .from(roadmapProjects)
      .where(eq(roadmapProjects.title, ADMIN_CONTEXTUAL_FEEDBACK_PROJECT_TITLE))
      .limit(1))[0];

  if (!project) {
    [project] = await db
      .insert(roadmapProjects)
      .values({
        id: ADMIN_CONTEXTUAL_FEEDBACK_PROJECT_ID,
        title: ADMIN_CONTEXTUAL_FEEDBACK_PROJECT_TITLE,
        description: ADMIN_CONTEXTUAL_FEEDBACK_PROJECT_DESCRIPTION,
        status: "active",
      })
      .returning();
  }

  let workstream = (await db
    .select()
    .from(roadmapWorkstreams)
    .where(and(
      eq(roadmapWorkstreams.projectId, project.id),
      eq(roadmapWorkstreams.title, ADMIN_CONTEXTUAL_FEEDBACK_INBOX_WORKSTREAM_TITLE),
    ))
    .limit(1))[0];

  if (!workstream) {
    [workstream] = await db
      .insert(roadmapWorkstreams)
      .values({
        projectId: project.id,
        title: ADMIN_CONTEXTUAL_FEEDBACK_INBOX_WORKSTREAM_TITLE,
        description: ADMIN_CONTEXTUAL_FEEDBACK_INBOX_WORKSTREAM_DESCRIPTION,
        orderIndex: ADMIN_CONTEXTUAL_FEEDBACK_INBOX_WORKSTREAM_ORDER_INDEX,
      })
      .returning();
  }

  return { project, workstream };
}

const isPublishedState = process.env.NODE_ENV === "production";
const portalOtpSecretRaw = process.env.PORTAL_OTP_SECRET?.trim() || process.env.SESSION_SECRET?.trim() || "";
const portalOtpSecret = portalOtpSecretRaw;

const SLA_HOURS: Record<string, number> = { urgent: 4, high: 12, medium: 48, low: 120 };
function computeResponseDueAt(priority: string, from: Date = new Date()): Date {
  const hours = SLA_HOURS[priority] ?? 48;
  return new Date(from.getTime() + hours * 60 * 60 * 1000);
}

function escapeHtml(value: string | null | undefined): string {
  return (value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}


function isValidEmailAddress(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function formatCurrency(amount: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

function shouldReturnJson(req: Request): boolean {
  const accept = (req.headers.accept || "").toLowerCase();
  return req.query.format === "json" || accept.includes("application/json");
}

/**
 * Build a standardized error response payload.
 * All error responses should use this helper so the shape is consistent:
 *   { message: string, code?: string }
 */
function errorPayload(error: unknown, code?: string): { message: string; code?: string } {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "Internal server error";
  return code ? { message, code } : { message };
}

function parseStripeSignature(headerValue: string): { timestamp: string | null; signature: string | null } {
  const parts = headerValue.split(",").map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2) || null;
  const signature = parts.find((part) => part.startsWith("v1="))?.slice(3) || null;
  return { timestamp, signature };
}

function isStripeEventPayload(value: unknown): value is {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
} {
  return Boolean(
    value
      && typeof value === "object"
      && typeof (value as Record<string, unknown>).id === "string"
      && typeof (value as Record<string, unknown>).type === "string"
      && (value as Record<string, unknown>).data
      && typeof (value as Record<string, unknown>).data === "object",
  );
}

function getStripeEventMetadata(payload: unknown): Record<string, unknown> {
  if (!isStripeEventPayload(payload)) return {};
  const object = payload.data.object;
  const metadata = object && typeof object === "object" ? object.metadata : null;
  return metadata && typeof metadata === "object" ? metadata as Record<string, unknown> : {};
}

function normalizeStripeWebhookPayload(payload: unknown): {
  associationId: string | null;
  providerEventId: string | null;
  eventType: string | null;
  status: "succeeded" | "failed" | "pending";
  amount: number | null;
  currency: string | null;
  personId: string | null;
  unitId: string | null;
  paymentLinkToken: string | null;
  gatewayReference: string | null;
  rawPayloadJson: unknown;
} | null {
  if (!isStripeEventPayload(payload)) return null;
  const object = payload.data.object;
  const metadata = getStripeEventMetadata(payload);
  const amountCents =
    typeof object.amount_total === "number"
      ? object.amount_total
      : typeof object.amount_received === "number"
        ? object.amount_received
        : typeof object.amount === "number"
          ? object.amount
          : null;
  const paymentStatus = typeof object.payment_status === "string" ? object.payment_status : null;
  const eventType = payload.type;
  let status: "succeeded" | "failed" | "pending" = "pending";
  if (
    eventType === "checkout.session.async_payment_succeeded"
    || eventType === "payment_intent.succeeded"
    || (eventType === "checkout.session.completed" && paymentStatus === "paid")
  ) {
    status = "succeeded";
  } else if (
    eventType === "checkout.session.async_payment_failed"
    || eventType === "payment_intent.payment_failed"
  ) {
    status = "failed";
  }

  return {
    associationId: typeof metadata.associationId === "string" ? metadata.associationId : null,
    providerEventId: payload.id,
    eventType,
    status,
    amount: typeof amountCents === "number" ? Number((amountCents / 100).toFixed(2)) : null,
    currency: typeof object.currency === "string" ? object.currency : typeof metadata.currency === "string" ? metadata.currency : null,
    personId: typeof metadata.personId === "string" ? metadata.personId : null,
    unitId: typeof metadata.unitId === "string" ? metadata.unitId : null,
    paymentLinkToken: typeof metadata.paymentLinkToken === "string" ? metadata.paymentLinkToken : null,
    gatewayReference:
      typeof object.payment_intent === "string"
        ? object.payment_intent
        : typeof object.id === "string"
          ? object.id
          : null,
    rawPayloadJson: payload,
  };
}

function renderPaymentLinkPage(params: {
  associationName: string;
  ownerName: string;
  unitLabel: string;
  linkToken: string;
  status: string;
  amountDue: number;
  currency: string;
  memo: string | null;
  expiresAt: Date | null;
  allowPartial: boolean;
  outstandingBalance: number;
  checkoutAvailable: boolean;
  manualInstructions: string[];
  stateMessage: string;
  stateTone: "info" | "warning" | "success" | "danger";
  flashMessage: string | null;
}): string {
  const toneStyles = {
    info: { bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" },
    warning: { bg: "#fff7ed", border: "#fdba74", text: "#c2410c" },
    success: { bg: "#ecfdf5", border: "#86efac", text: "#15803d" },
    danger: { bg: "#fef2f2", border: "#fca5a5", text: "#b91c1c" },
  }[params.stateTone];
  const flashHtml = params.flashMessage
    ? `<div style="margin:0 0 16px 0;padding:14px 16px;border-radius:12px;background:#f8fafc;border:1px solid #cbd5e1;color:#334155;font-size:14px;line-height:1.6;">${escapeHtml(params.flashMessage)}</div>`
    : "";
  const manualInstructionsHtml = params.manualInstructions.length > 0
    ? `<div style="margin-top:20px;">
        <div style="font-size:14px;font-weight:700;color:#0f172a;margin-bottom:10px;">Other approved payment methods</div>
        <div style="display:grid;gap:12px;">
          ${params.manualInstructions.map((instruction) => `<div style="border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;background:#ffffff;white-space:pre-wrap;font-size:14px;line-height:1.6;color:#334155;">${escapeHtml(instruction)}</div>`).join("")}
        </div>
      </div>`
    : "";
  const paymentFormHtml = params.checkoutAvailable
    ? `<form method="POST" action="/api/portal/payments/link/${encodeURIComponent(params.linkToken)}/checkout-session" style="display:grid;gap:14px;">
        ${params.allowPartial
          ? `<label style="display:grid;gap:6px;">
              <span style="font-size:13px;font-weight:600;color:#334155;">Amount to pay</span>
              <input name="amount" type="number" min="0.01" max="${params.amountDue.toFixed(2)}" step="0.01" value="${params.amountDue.toFixed(2)}" style="border:1px solid #cbd5e1;border-radius:10px;padding:12px 14px;font-size:16px;"/>
            </label>
            <div style="font-size:12px;color:#64748b;">You can pay up to ${escapeHtml(formatCurrency(params.amountDue, params.currency))} with this link.</div>`
          : `<input type="hidden" name="amount" value="${params.amountDue.toFixed(2)}"/>
            <div style="font-size:14px;color:#334155;">This payment link is locked to the exact amount due.</div>`}
        <button type="submit" style="appearance:none;border:none;border-radius:12px;background:#0f766e;color:#ffffff;font-size:15px;font-weight:700;padding:14px 18px;cursor:pointer;">
          Pay by ACH bank transfer
        </button>
        <div style="font-size:12px;color:#64748b;">You will be redirected to a secure hosted checkout session to complete payment.</div>
      </form>`
    : `<div style="font-size:14px;color:#475569;line-height:1.7;">Online ACH checkout is not currently active for this association. Use one of the approved payment methods below.</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${escapeHtml(params.associationName)} Payment Portal</title>
</head>
<body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <div style="max-width:760px;margin:0 auto;padding:32px 16px 48px;">
    <div style="border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(15,23,42,0.12);background:#ffffff;">
      <div style="background:#1e3a5f;padding:30px 32px;">
        <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#bfdbfe;font-weight:700;">Owner Portal</div>
        <div style="font-size:28px;line-height:1.2;font-weight:800;color:#ffffff;margin-top:8px;">${escapeHtml(params.associationName)}</div>
        <div style="font-size:14px;color:#cbd5e1;margin-top:10px;">Secure payment access for ${escapeHtml(params.ownerName)} · ${escapeHtml(params.unitLabel)}</div>
      </div>
      <div style="padding:28px 32px 32px;">
        ${flashHtml}
        <div style="padding:14px 16px;border-radius:14px;background:${toneStyles.bg};border:1px solid ${toneStyles.border};color:${toneStyles.text};font-size:14px;line-height:1.6;margin-bottom:20px;">${escapeHtml(params.stateMessage)}</div>
        <div style="display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));margin-bottom:24px;">
          <div style="border:1px solid #e2e8f0;border-radius:14px;padding:16px;background:#f8fafc;">
            <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;font-weight:700;">This link covers</div>
            <div style="font-size:26px;font-weight:800;margin-top:8px;">${escapeHtml(formatCurrency(params.amountDue, params.currency))}</div>
          </div>
          <div style="border:1px solid #e2e8f0;border-radius:14px;padding:16px;background:#f8fafc;">
            <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;font-weight:700;">Outstanding balance</div>
            <div style="font-size:26px;font-weight:800;margin-top:8px;">${escapeHtml(formatCurrency(params.outstandingBalance, params.currency))}</div>
          </div>
          <div style="border:1px solid #e2e8f0;border-radius:14px;padding:16px;background:#f8fafc;">
            <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;font-weight:700;">Link status</div>
            <div style="font-size:20px;font-weight:800;margin-top:12px;text-transform:capitalize;">${escapeHtml(params.status.replaceAll("-", " "))}</div>
          </div>
        </div>
        ${params.memo ? `<div style="margin-bottom:18px;font-size:14px;color:#475569;line-height:1.7;"><strong style="color:#0f172a;">Memo:</strong> ${escapeHtml(params.memo)}</div>` : ""}
        ${params.expiresAt ? `<div style="margin-bottom:18px;font-size:13px;color:#64748b;">This link expires on ${escapeHtml(params.expiresAt.toLocaleString())}.</div>` : ""}
        <div style="border:1px solid #e2e8f0;border-radius:18px;padding:20px;background:#f8fafc;">
          <div style="font-size:18px;font-weight:800;color:#0f172a;margin-bottom:8px;">Pay your balance</div>
          <div style="font-size:14px;line-height:1.7;color:#475569;margin-bottom:16px;">Use the secure ACH checkout below, or pay with one of the alternate methods configured by the association.</div>
          ${paymentFormHtml}
        </div>
        ${manualInstructionsHtml}
      </div>
      <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;line-height:1.6;">
        This payment portal link is intended for the recipient named above. If you reached this page in error, contact the association before making a payment.
      </div>
    </div>
  </div>
</body>
</html>`;
}

function getParam(value: string | string[] | undefined): string {
  if (!value) return "";
  return Array.isArray(value) ? value[0] : value;
}

function normalizeBaseUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim().replace(/\/$/, "");
  return trimmed || null;
}

function isLocalBaseUrl(value: string | null | undefined): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

function requestBaseUrl(req: Request): string | null {
  const forwardedProto = (req.header("x-forwarded-proto") || "").split(",")[0]?.trim().toLowerCase();
  const forwardedHost = (req.header("x-forwarded-host") || "").split(",")[0]?.trim();
  const host = forwardedHost || req.header("host") || "";
  if (!host) return null;

  const proto = forwardedProto || (req.protocol ? req.protocol.toLowerCase() : "http");
  if (proto !== "http" && proto !== "https") return null;
  return `${proto}://${host}`;
}

async function resolvePublicAppBaseUrl(req: Request): Promise<string> {
  const configuredBaseUrl = normalizeBaseUrl(await getSecret("APP_BASE_URL", "app_base_url"));
  if (configuredBaseUrl && !isLocalBaseUrl(configuredBaseUrl)) {
    return configuredBaseUrl;
  }

  const requestUrl = normalizeBaseUrl(requestBaseUrl(req));
  if (requestUrl) return requestUrl;
  return configuredBaseUrl || "http://localhost:5000";
}

async function resolveInviteUrl(req: Request, token: string): Promise<string> {
  const baseUrl = await resolvePublicAppBaseUrl(req);
  return `${baseUrl}/onboarding/${encodeURIComponent(token)}`;
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
  portalUnitId?: string | null;
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
  debug("[applyAdminContext]", {
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
    debug("[applyAdminContext][scoped]", {
      email: adminUser.email,
      scopeCount: req.adminScopedAssociationIds.length,
      scopedAssociationIds: req.adminScopedAssociationIds,
    });
  } else {
    req.adminScopedAssociationIds = [];
    debug("[applyAdminContext][platform-admin] full access granted", { email: adminUser.email });
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

    debug("[tryHydrateAdminFromSession][passport-path]", {
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
      debug("[tryHydrateAdminFromSession][resolved]", { email: authUser.email, role: resolvedAdmin.role, adminUserId: resolvedAdmin.id });
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
    debug("[tryHydrateAdminFromSession][no-session]", { path: req.path });
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

  debug("[tryHydrateAdminFromSession][session-fallback-path]", {
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

async function requireActiveSubscription(req: AdminRequest, res: Response, next: NextFunction) {
  // Platform admins bypass subscription checks
  if (req.adminRole === "platform-admin") return next();

  const associationId = req.adminScopedAssociationIds?.[0];
  if (!associationId) return next(); // No association context — let other middleware handle

  const sub = await storage.getPlatformSubscription(associationId);
  if (!sub) {
    // No subscription record — allow access (legacy/free associations)
    return next();
  }

  const activeStatuses = ["active", "trialing", "past_due"];
  if (activeStatuses.includes(sub.status)) {
    return next();
  }

  return res.status(402).json({
    message: "Subscription inactive",
    code: "SUBSCRIPTION_REQUIRED",
    detail: "Your subscription is no longer active. Please update your billing to continue.",
    subscriptionStatus: sub.status,
    plan: sub.plan,
  });
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
  req.portalUnitId = access.unitId ?? null;
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

function requirePortalBoardReadOnly(_req: PortalRequest, res: Response, _next: NextFunction) {
  return res.status(403).json({ message: "Board workspace is read-only for board members" });
}

async function getOwnedPortalUnitsForAssociation(input: {
  associationId: string;
  personId: string;
  email: string;
}) {
  const normalizedEmail = input.email.trim().toLowerCase();
  if (!normalizedEmail) return [];

  const ownedUnitRows = await db
    .select({
      unitId: units.id,
      unitNumber: units.unitNumber,
      building: units.building,
      squareFootage: units.squareFootage,
    })
    .from(ownerships)
    .innerJoin(units, eq(ownerships.unitId, units.id))
    .where(
      and(
        eq(ownerships.personId, input.personId),
        eq(units.associationId, input.associationId),
        isNull(ownerships.endDate),
      ),
    );

  const ownedUnits = Array.from(
    new Map(ownedUnitRows.map((unit) => [unit.unitId, unit])).values(),
  );

  const existingAccesses = (await storage.getPortalAccessesByEmail(normalizedEmail)).filter(
    (access) =>
      access.associationId === input.associationId &&
      access.personId === input.personId &&
      Boolean(access.unitId) &&
      (access.status === "active" || access.status === "invited"),
  );

  const accessByUnitId = new Map<string, typeof existingAccesses[number]>();
  for (const access of existingAccesses) {
    if (access.unitId) {
      accessByUnitId.set(access.unitId, access);
    }
  }

  for (const unit of ownedUnits) {
    if (accessByUnitId.has(unit.unitId)) continue;
    try {
      const created = await storage.createPortalAccess(
        {
          associationId: input.associationId,
          personId: input.personId,
          unitId: unit.unitId,
          email: normalizedEmail,
          role: "owner",
          status: "active",
        },
        "system:portal-owner-unit-sync",
      );
      if (created.unitId) {
        accessByUnitId.set(created.unitId, created);
      }
    } catch (error) {
      console.warn("[portal-owner-unit-sync] Failed to create portal access", {
        associationId: input.associationId,
        personId: input.personId,
        unitId: unit.unitId,
        email: normalizedEmail,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return ownedUnits.map((unit) => ({
    ...unit,
    portalAccessId: accessByUnitId.get(unit.unitId)?.id ?? null,
  }));
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  registerAuthRoutes(app);

  // Amenity booking routes
  const { registerAmenityRoutes } = await import("./routes/amenities");
  registerAmenityRoutes(app, requireAdmin, requireAdminRole, requirePortal);

  // Autopay enrollment & recurring collection routes
  registerAutopayRoutes(app, {
    requireAdmin,
    requireAdminRole,
    requirePortal,
    getAssociationIdQuery,
    assertAssociationScope,
    assertAssociationInputScope,
  });

  // Lightweight public health check for monitors, load balancers, and liveness probes
  app.get("/api/health", async (_req, res) => {
    try {
      await db.execute(sql`SELECT 1`);
      res.json({ status: "ok" });
    } catch (err: any) {
      res.status(500).json({ status: "error", message: "Database unreachable" });
    }
  });

  // Detailed diagnostics endpoint — admin-only, shows DB state for deployment verification
  app.get("/api/health/details", requireAdmin, requireAdminRole(["platform-admin"]), async (_req, res) => {
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
      res.status(500).json(errorPayload(err));
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
      debug("[GET /api/associations]", {
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
        return res.status(409).json(errorPayload(message, "ASSOCIATION_DELETE_BLOCKED"));
      }
      res.status(400).json(errorPayload(error));
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

      sendAssociationAdminEmailNotification({
        associationId,
        category: "insurance",
        priority: "realtime",
        excludeEmails: req.adminUserEmail ? [req.adminUserEmail] : [],
        email: {
          subject: `Insurance policy added: ${result.policyType}`,
          html: `<p>An insurance policy has been added.</p>
            <p><strong>Policy type:</strong> ${escapeHtml(result.policyType)}</p>
            <p><strong>Carrier:</strong> ${escapeHtml(result.carrier)}</p>`,
          text: `An insurance policy has been added.\nPolicy type: ${result.policyType}\nCarrier: ${result.carrier}`,
          templateKey: "insurance-policy-added-admin",
          metadata: { policyId: result.id, associationId },
        },
      }).catch((error) => console.error("[insurance] Failed to send insurance notification:", error));
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

      sendAssociationAdminEmailNotification({
        associationId,
        category: "insurance",
        priority: "realtime",
        excludeEmails: req.adminUserEmail ? [req.adminUserEmail] : [],
        email: {
          subject: `Insurance policy updated: ${result.policyType}`,
          html: `<p>An insurance policy has been updated.</p>
            <p><strong>Policy type:</strong> ${escapeHtml(result.policyType)}</p>
            <p><strong>Carrier:</strong> ${escapeHtml(result.carrier)}</p>`,
          text: `An insurance policy has been updated.\nPolicy type: ${result.policyType}\nCarrier: ${result.carrier}`,
          templateKey: "insurance-policy-updated-admin",
          metadata: { policyId: result.id, associationId },
        },
      }).catch((error) => console.error("[insurance] Failed to send insurance update notification:", error));
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
      if (parsed.phone) parsed.phone = normalizePhoneNumber(parsed.phone) || null;
      if (parsed.emergencyContactPhone) parsed.emergencyContactPhone = normalizePhoneNumber(parsed.emergencyContactPhone) || null;
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

      const [unit] = await db.select({ associationId: units.associationId, unitNumber: units.unitNumber }).from(units).where(eq(units.id, result.unitId)).limit(1);
      if (unit) {
        sendAssociationAdminEmailNotification({
          associationId: unit.associationId,
          category: "occupancy",
          priority: "realtime",
          excludeEmails: req.adminUserEmail ? [req.adminUserEmail] : [],
          email: {
            subject: `Occupancy recorded for unit ${unit.unitNumber}`,
            html: `<p>A new occupancy record has been created.</p>
              <p><strong>Unit:</strong> ${escapeHtml(unit.unitNumber)}</p>
              <p><strong>Occupancy type:</strong> ${escapeHtml(result.occupancyType)}</p>`,
            text: `A new occupancy record has been created.\nUnit: ${unit.unitNumber}\nOccupancy type: ${result.occupancyType}`,
            templateKey: "occupancy-created-admin",
            metadata: { occupancyId: result.id, associationId: unit.associationId, unitId: result.unitId },
          },
        }).catch((error) => console.error("[occupancy] Failed to send occupancy notification:", error));
      }
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/occupancies/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const id = getParam(req.params.id);
      const [existing] = await db.select().from(occupancies).where(eq(occupancies.id, id));
      if (!existing) return res.status(404).json({ message: "Not found" });
      const [unit] = await db.select({ associationId: units.associationId }).from(units).where(eq(units.id, existing.unitId));
      if (!unit) return res.status(404).json({ message: "Unit not found" });
      assertAssociationScope(req, unit.associationId);
      const endDate = req.body?.endDate ? new Date(req.body.endDate) : null;
      const [result] = await db.update(occupancies).set({ endDate }).where(eq(occupancies.id, id)).returning();
      res.json(result);

      sendAssociationAdminEmailNotification({
        associationId: unit.associationId,
        category: "occupancy",
        priority: "realtime",
        excludeEmails: req.adminUserEmail ? [req.adminUserEmail] : [],
        email: {
          subject: `Occupancy updated for unit record ${result.id}`,
          html: `<p>An occupancy record has been updated.</p>
            <p><strong>Unit association:</strong> ${escapeHtml(unit.associationId)}</p>
            <p><strong>End date:</strong> ${result.endDate ? escapeHtml(new Date(result.endDate).toLocaleDateString()) : "Active"}</p>`,
          text: `An occupancy record has been updated.\nAssociation: ${unit.associationId}\nEnd date: ${result.endDate ? new Date(result.endDate).toLocaleDateString() : "Active"}`,
          templateKey: "occupancy-updated-admin",
          metadata: { occupancyId: result.id, associationId: unit.associationId, unitId: result.unitId },
        },
      }).catch((error) => console.error("[occupancy] Failed to send occupancy update notification:", error));
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

  app.patch("/api/documents/:id/versions/:versionId/set-current", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
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

  app.get("/api/documents/:id/versions/export", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
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
      if (result.isActive === 1 && result.autoPostEnabled === 1) {
        await processSpecialAssessmentInstallments(result.associationId, { assessmentId: result.id });
      }
      res.status(201).json(result);

      sendAssociationAdminEmailNotification({
        associationId: result.associationId,
        category: "assessments",
        priority: "realtime",
        excludeEmails: (req as AdminRequest).adminUserEmail ? [(req as AdminRequest).adminUserEmail!] : [],
        email: {
          subject: `Assessment created: ${result.name}`,
          html: `<p>A special assessment has been created.</p><p><strong>Name:</strong> ${escapeHtml(result.name)}</p><p><strong>Total amount:</strong> $${Number(result.totalAmount).toFixed(2)}</p>`,
          text: `A special assessment has been created.\nName: ${result.name}\nTotal amount: $${Number(result.totalAmount).toFixed(2)}`,
          templateKey: "assessment-created-admin",
          metadata: { assessmentId: result.id, associationId: result.associationId },
        },
      }).catch((error) => console.error("[assessments] Failed to send assessment notification:", error));
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
      if (result.isActive === 1 && result.autoPostEnabled === 1) {
        await processSpecialAssessmentInstallments(result.associationId, { assessmentId: result.id });
      }
      res.json(result);

      sendAssociationAdminEmailNotification({
        associationId: result.associationId,
        category: "assessments",
        priority: "realtime",
        excludeEmails: (req as AdminRequest).adminUserEmail ? [(req as AdminRequest).adminUserEmail!] : [],
        email: {
          subject: `Assessment updated: ${result.name}`,
          html: `<p>A special assessment has been updated.</p><p><strong>Name:</strong> ${escapeHtml(result.name)}</p><p><strong>Total amount:</strong> $${Number(result.totalAmount).toFixed(2)}</p>`,
          text: `A special assessment has been updated.\nName: ${result.name}\nTotal amount: $${Number(result.totalAmount).toFixed(2)}`,
          templateKey: "assessment-updated-admin",
          metadata: { assessmentId: result.id, associationId: result.associationId },
        },
      }).catch((error) => console.error("[assessments] Failed to send assessment update notification:", error));
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/financial/assessments/run", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const associationId = typeof req.body?.associationId === "string" ? req.body.associationId : "";
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      assertAssociationInputScope(req, associationId);
      const summary = await processSpecialAssessmentInstallments(associationId);
      res.json(summary);
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

      sendAssociationAdminEmailNotification({
        associationId: result.associationId,
        category: "lateFees",
        priority: "realtime",
        excludeEmails: (req as AdminRequest).adminUserEmail ? [(req as AdminRequest).adminUserEmail!] : [],
        email: {
          subject: `Late fee rule created: ${result.name}`,
          html: `<p>A late fee rule has been created.</p><p><strong>Name:</strong> ${escapeHtml(result.name)}</p>`,
          text: `A late fee rule has been created.\nName: ${result.name}`,
          templateKey: "late-fee-rule-created-admin",
          metadata: { lateFeeRuleId: result.id, associationId: result.associationId },
        },
      }).catch((error) => console.error("[late-fees] Failed to send late fee rule notification:", error));
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

      sendAssociationAdminEmailNotification({
        associationId: result.associationId,
        category: "lateFees",
        priority: "realtime",
        excludeEmails: (req as AdminRequest).adminUserEmail ? [(req as AdminRequest).adminUserEmail!] : [],
        email: {
          subject: `Late fee rule updated: ${result.name}`,
          html: `<p>A late fee rule has been updated.</p><p><strong>Name:</strong> ${escapeHtml(result.name)}</p>`,
          text: `A late fee rule has been updated.\nName: ${result.name}`,
          templateKey: "late-fee-rule-updated-admin",
          metadata: { lateFeeRuleId: result.id, associationId: result.associationId },
        },
      }).catch((error) => console.error("[late-fees] Failed to send late fee rule update notification:", error));
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

      sendAssociationAdminEmailNotification({
        associationId,
        category: "lateFees",
        priority: "realtime",
        excludeEmails: (req as AdminRequest).adminUserEmail ? [(req as AdminRequest).adminUserEmail!] : [],
        email: {
          subject: `Late fee ${apply ? "applied" : "calculated"} for balance event`,
          html: `<p>A late fee has been ${apply ? "applied" : "calculated"}.</p><p><strong>Calculated fee:</strong> $${Number(result.calculatedFee).toFixed(2)}</p>`,
          text: `A late fee has been ${apply ? "applied" : "calculated"}.\nCalculated fee: $${Number(result.calculatedFee).toFixed(2)}`,
          templateKey: "late-fee-calculated-admin",
          metadata: { associationId, ruleId, apply, calculatedFee: result.calculatedFee },
        },
      }).catch((error) => console.error("[late-fees] Failed to send late fee calculation notification:", error));
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

      // Resolve real person emails for delivery
      const allPersons = await storage.getPersons(rule.associationId);
      const personEmailMap = new Map(allPersons.filter(p => p.email).map(p => [p.id, p.email!]));
      const emailProviderReady = isEmailProviderConfigured();

      const sends: Array<{ personId: string; unitId: string; balance: number; sent: boolean }> = [];
      const campaignKey = `payment-reminder-${rule.id}-${Date.now()}`;
      for (const account of delinquent) {
        const subject = template ? template.subjectTemplate : `Payment Reminder - Balance Due`;
        const body = template ? template.bodyTemplate : `This is a reminder that your account has an outstanding balance of $${Math.abs(account.balance).toFixed(2)}.`;
        const recipientEmail = personEmailMap.get(account.personId) ?? `owner-${account.personId}@placeholder.local`;

        let sendStatus = "simulated";
        let provider = "simulation";
        let providerMessageId: string | null = null;

        if (personEmailMap.has(account.personId) && emailProviderReady) {
          try {
            const result = await sendPlatformEmail({
              to: recipientEmail,
              subject,
              html: body,
              associationId: rule.associationId,
            });
            sendStatus = result.status === "sent" ? "sent" : result.status;
            provider = result.provider;
            providerMessageId = result.messageId;
          } catch (_err) {
            sendStatus = "failed";
          }
        }

        await db.insert(noticeSends).values({
          associationId: rule.associationId,
          templateId: rule.templateId,
          campaignKey,
          recipientEmail,
          recipientPersonId: account.personId,
          subjectRendered: subject,
          bodyRendered: body,
          status: sendStatus,
          provider,
          providerMessageId,
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

  // GET /api/financial/accounts/activity — Per-account budget vs actual roll-up
  // Aggregates planned amounts (latest ratified budget version) and committed
  // invoice amounts (status in approved|paid) per chart-of-accounts entry.
  app.get("/api/financial/accounts/activity", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      assertAssociationScope(req, associationId);

      const [accounts, budgets, invoices] = await Promise.all([
        storage.getFinancialAccounts(associationId),
        storage.getBudgets(associationId),
        storage.getVendorInvoices(associationId),
      ]);

      // Collect all budget lines from the latest ratified version of each budget.
      // Parallelized per-budget: (1) resolve ratified version, (2) fetch lines.
      const perBudgetLines = await Promise.all(
        budgets.map(async (budget) => {
          const versions = await storage.getBudgetVersions(budget.id);
          const ratified = versions
            .filter((v) => v.status === "ratified")
            .sort((a, b) => (b.ratifiedAt?.getTime() ?? 0) - (a.ratifiedAt?.getTime() ?? 0))[0];
          if (!ratified) return null;
          const lines = await storage.getBudgetLines(ratified.id);
          return lines.map((line) => ({
            accountId: line.accountId ?? null,
            plannedAmount: line.plannedAmount,
          }));
        }),
      );
      const allLines: { accountId: string | null; plannedAmount: number }[] = [];
      let activeBudgetCount = 0;
      for (const group of perBudgetLines) {
        if (!group) continue;
        activeBudgetCount += 1;
        allLines.push(...group);
      }

      const COUNTABLE_INVOICE_STATUSES = new Set(["approved", "paid"]);
      const countableInvoices = invoices.filter((inv) => COUNTABLE_INVOICE_STATUSES.has(inv.status));

      const rows = accounts.map((account) => {
        const linesForAccount = allLines.filter((l) => l.accountId === account.id);
        const budgetedAmount = linesForAccount.reduce((sum, l) => sum + l.plannedAmount, 0);
        const accountInvoices = countableInvoices.filter((inv) => inv.accountId === account.id);
        const invoicedAmount = accountInvoices.reduce((sum, inv) => sum + inv.amount, 0);
        const variance = Number((budgetedAmount - invoicedAmount).toFixed(2));
        const utilizationPct = budgetedAmount > 0
          ? Math.round((invoicedAmount / budgetedAmount) * 1000) / 10
          : null;
        return {
          accountId: account.id,
          accountCode: account.accountCode,
          accountName: account.name,
          accountType: account.accountType,
          isActive: account.isActive,
          budgetedAmount: Number(budgetedAmount.toFixed(2)),
          invoicedAmount: Number(invoicedAmount.toFixed(2)),
          variance,
          utilizationPct,
          invoiceCount: accountInvoices.length,
        };
      });

      // Stable sort: by accountCode (string), then by accountName as tiebreaker.
      rows.sort((a, b) => {
        const codeA = a.accountCode ?? "";
        const codeB = b.accountCode ?? "";
        if (codeA !== codeB) return codeA.localeCompare(codeB);
        return a.accountName.localeCompare(b.accountName);
      });

      const totals = rows.reduce(
        (acc, r) => ({
          budgetedAmount: acc.budgetedAmount + r.budgetedAmount,
          invoicedAmount: acc.invoicedAmount + r.invoicedAmount,
        }),
        { budgetedAmount: 0, invoicedAmount: 0 },
      );
      const portfolioUtilizationPct = totals.budgetedAmount > 0
        ? Math.round((totals.invoicedAmount / totals.budgetedAmount) * 1000) / 10
        : null;

      res.json({
        associationId,
        accounts: rows,
        totals: {
          budgetedAmount: Number(totals.budgetedAmount.toFixed(2)),
          invoicedAmount: Number(totals.invoicedAmount.toFixed(2)),
          variance: Number((totals.budgetedAmount - totals.invoicedAmount).toFixed(2)),
          utilizationPct: portfolioUtilizationPct,
        },
        meta: {
          activeBudgetCount,
          totalAccounts: accounts.length,
          totalCountableInvoices: countableInvoices.length,
        },
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
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

      sendAssociationAdminEmailNotification({
        associationId: result.associationId,
        category: "invoices",
        priority: "realtime",
        excludeEmails: (req as AdminRequest).adminUserEmail ? [(req as AdminRequest).adminUserEmail!] : [],
        email: {
          subject: `Invoice created: ${result.invoiceNumber || result.id}`,
          html: `<p>A vendor invoice has been created.</p><p><strong>Invoice number:</strong> ${escapeHtml(result.invoiceNumber || result.id)}</p><p><strong>Amount:</strong> $${Number(result.amount).toFixed(2)}</p>`,
          text: `A vendor invoice has been created.\nInvoice number: ${result.invoiceNumber || result.id}\nAmount: $${Number(result.amount).toFixed(2)}`,
          templateKey: "invoice-created-admin",
          metadata: { invoiceId: result.id, associationId: result.associationId },
        },
      }).catch((error) => console.error("[invoices] Failed to send invoice notification:", error));
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

      sendAssociationAdminEmailNotification({
        associationId: result.associationId,
        category: "invoices",
        priority: "realtime",
        excludeEmails: (req as AdminRequest).adminUserEmail ? [(req as AdminRequest).adminUserEmail!] : [],
        email: {
          subject: `Invoice updated: ${result.invoiceNumber || result.id}`,
          html: `<p>A vendor invoice has been updated.</p><p><strong>Invoice number:</strong> ${escapeHtml(result.invoiceNumber || result.id)}</p><p><strong>Amount:</strong> $${Number(result.amount).toFixed(2)}</p>`,
          text: `A vendor invoice has been updated.\nInvoice number: ${result.invoiceNumber || result.id}\nAmount: $${Number(result.amount).toFixed(2)}`,
          templateKey: "invoice-updated-admin",
          metadata: { invoiceId: result.id, associationId: result.associationId },
        },
      }).catch((error) => console.error("[invoices] Failed to send invoice update notification:", error));
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

      sendAssociationAdminEmailNotification({
        associationId: result.associationId,
        category: "payments",
        priority: "realtime",
        excludeEmails: (req as AdminRequest).adminUserEmail ? [(req as AdminRequest).adminUserEmail!] : [],
        email: {
          subject: `Payment method configured: ${result.displayName}`,
          html: `<p>A payment method configuration has been created.</p><p><strong>Display name:</strong> ${escapeHtml(result.displayName)}</p><p><strong>Method type:</strong> ${escapeHtml(result.methodType)}</p>`,
          text: `A payment method configuration has been created.\nDisplay name: ${result.displayName}\nMethod type: ${result.methodType}`,
          templateKey: "payment-method-created-admin",
          metadata: { paymentMethodConfigId: result.id, associationId: result.associationId },
        },
      }).catch((error) => console.error("[payments] Failed to send payment method notification:", error));
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

      sendAssociationAdminEmailNotification({
        associationId: result.associationId,
        category: "payments",
        priority: "realtime",
        excludeEmails: (req as AdminRequest).adminUserEmail ? [(req as AdminRequest).adminUserEmail!] : [],
        email: {
          subject: `Payment method updated: ${result.displayName}`,
          html: `<p>A payment method configuration has been updated.</p><p><strong>Display name:</strong> ${escapeHtml(result.displayName)}</p><p><strong>Method type:</strong> ${escapeHtml(result.methodType)}</p>`,
          text: `A payment method configuration has been updated.\nDisplay name: ${result.displayName}\nMethod type: ${result.methodType}`,
          templateKey: "payment-method-updated-admin",
          metadata: { paymentMethodConfigId: result.id, associationId: result.associationId },
        },
      }).catch((error) => console.error("[payments] Failed to send payment method update notification:", error));
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

  app.post("/api/portal/payments/link/:token/checkout-session", async (req, res) => {
    try {
      const token = getParam(req.params.token);
      if (!token) return res.status(400).json({ message: "token is required" });

      const link = await storage.getOwnerPaymentLinkByToken(token);
      if (!link) {
        if (shouldReturnJson(req)) return res.status(404).json({ message: "Payment link not found" });
        return res.status(404).send("Payment link not found");
      }
      if (link.status !== "active") {
        const message = `This payment link is ${link.status}.`;
        if (shouldReturnJson(req)) return res.status(400).json({ message });
        return res.redirect(303, `/api/portal/payments/link/${encodeURIComponent(token)}?checkout=unavailable`);
      }

      const gateway = await storage.getActivePaymentGatewayConnection({
        associationId: link.associationId,
        provider: "stripe",
      });
      if (!gateway?.secretKey) {
        const message = "Online ACH checkout is not configured for this association.";
        if (shouldReturnJson(req)) return res.status(400).json({ message });
        return res.redirect(303, `/api/portal/payments/link/${encodeURIComponent(token)}?checkout=unavailable`);
      }

      const [association, unit, person, entries] = await Promise.all([
        db.select().from(associations).where(eq(associations.id, link.associationId)).then((rows) => rows[0] ?? null),
        db.select().from(units).where(eq(units.id, link.unitId)).then((rows) => rows[0] ?? null),
        db.select().from(persons).where(eq(persons.id, link.personId)).then((rows) => rows[0] ?? null),
        db.select({ amount: ownerLedgerEntries.amount }).from(ownerLedgerEntries).where(and(
          eq(ownerLedgerEntries.associationId, link.associationId),
          eq(ownerLedgerEntries.unitId, link.unitId),
          eq(ownerLedgerEntries.personId, link.personId),
        )),
      ]);

      if (!association || !unit || !person) {
        throw new Error("Payment link references invalid association data");
      }

      const outstandingBalance = Number(entries.reduce((sum, row) => sum + row.amount, 0).toFixed(2));
      const maxAllowedAmount = Number(Math.min(
        Math.max(outstandingBalance, 0),
        Math.max(link.amount, 0),
      ).toFixed(2));
      if (maxAllowedAmount <= 0) {
        const message = "This balance is no longer payable.";
        if (shouldReturnJson(req)) return res.status(400).json({ message });
        return res.redirect(303, `/api/portal/payments/link/${encodeURIComponent(token)}?checkout=unavailable`);
      }

      const requestedAmountRaw = typeof req.body?.amount === "string" ? req.body.amount : req.body?.amount;
      const requestedAmount = requestedAmountRaw == null || requestedAmountRaw === ""
        ? maxAllowedAmount
        : Number(requestedAmountRaw);
      if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
        throw new Error("amount must be a positive number");
      }

      const amount = Number(requestedAmount.toFixed(2));
      if (amount > maxAllowedAmount) {
        throw new Error(`Payment amount exceeds the available balance for this link (${formatCurrency(maxAllowedAmount, link.currency)})`);
      }
      if (!link.allowPartial && Math.abs(amount - maxAllowedAmount) > 0.009) {
        throw new Error("This payment link requires the exact amount due");
      }

      const appBaseUrl = (process.env.APP_BASE_URL || "http://localhost:5000").replace(/\/$/, "");
      const successUrl = `${appBaseUrl}/api/portal/payments/link/${encodeURIComponent(token)}?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${appBaseUrl}/api/portal/payments/link/${encodeURIComponent(token)}?checkout=cancelled`;
      const description = link.memo?.trim() || `${association.name} owner payment`;
      const amountCents = Math.round(amount * 100);
      const currency = (link.currency || "USD").toLowerCase();

      const sessionParams = new URLSearchParams();
      sessionParams.set("mode", "payment");
      sessionParams.set("success_url", successUrl);
      sessionParams.set("cancel_url", cancelUrl);
      sessionParams.set("payment_method_types[0]", "us_bank_account");
      sessionParams.set("billing_address_collection", "auto");
      if (person.email?.trim()) {
        sessionParams.set("customer_email", person.email.trim());
      }
      sessionParams.set("payment_method_options[us_bank_account][verification_method]", "instant");
      sessionParams.set("line_items[0][quantity]", "1");
      sessionParams.set("line_items[0][price_data][currency]", currency);
      sessionParams.set("line_items[0][price_data][unit_amount]", String(amountCents));
      sessionParams.set("line_items[0][price_data][product_data][name]", description);
      sessionParams.set("payment_intent_data[description]", `${association.name} payment for ${unit.unitNumber}`);
      sessionParams.set("payment_intent_data[metadata][associationId]", link.associationId);
      sessionParams.set("payment_intent_data[metadata][unitId]", link.unitId);
      sessionParams.set("payment_intent_data[metadata][personId]", link.personId);
      sessionParams.set("payment_intent_data[metadata][paymentLinkToken]", link.token);
      sessionParams.set("payment_intent_data[metadata][currency]", link.currency || "USD");
      sessionParams.set("payment_intent_data[metadata][amount]", amount.toFixed(2));
      sessionParams.set("metadata[associationId]", link.associationId);
      sessionParams.set("metadata[unitId]", link.unitId);
      sessionParams.set("metadata[personId]", link.personId);
      sessionParams.set("metadata[paymentLinkToken]", link.token);
      sessionParams.set("metadata[currency]", link.currency || "USD");
      sessionParams.set("metadata[amount]", amount.toFixed(2));

      const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${gateway.secretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: sessionParams.toString(),
      });

      const stripeBody = await stripeResponse.json().catch(() => null) as Record<string, unknown> | null;
      if (!stripeResponse.ok || !stripeBody || typeof stripeBody.url !== "string") {
        const providerMessage =
          stripeBody && typeof stripeBody.error === "object" && stripeBody.error && typeof (stripeBody.error as Record<string, unknown>).message === "string"
            ? (stripeBody.error as Record<string, unknown>).message as string
            : "Stripe could not create a hosted checkout session";
        throw new Error(providerMessage);
      }

      if (shouldReturnJson(req)) {
        return res.status(201).json({
          checkoutUrl: stripeBody.url,
          checkoutSessionId: typeof stripeBody.id === "string" ? stripeBody.id : null,
          amount,
          currency: link.currency,
        });
      }

      res.redirect(303, stripeBody.url);
    } catch (error: any) {
      if (shouldReturnJson(req)) {
        return res.status(400).json({ message: error.message });
      }
      const token = getParam(req.params.token);
      const safeToken = token ? encodeURIComponent(token) : "";
      res.redirect(303, `/api/portal/payments/link/${safeToken}?checkout=error&message=${encodeURIComponent(error.message)}`);
    }
  });

  app.get("/api/portal/payments/link/:token", async (req, res) => {
    try {
      const token = getParam(req.params.token);
      if (!token) return res.status(400).json({ message: "token is required" });
      const link = await storage.getOwnerPaymentLinkByToken(token);
      if (!link) return res.status(404).json({ message: "Payment link not found" });
      if (shouldReturnJson(req)) {
        return res.json(link);
      }

      const [association, unit, person, entries, paymentMethods, gateway] = await Promise.all([
        db.select().from(associations).where(eq(associations.id, link.associationId)).then((rows) => rows[0] ?? null),
        db.select().from(units).where(eq(units.id, link.unitId)).then((rows) => rows[0] ?? null),
        db.select().from(persons).where(eq(persons.id, link.personId)).then((rows) => rows[0] ?? null),
        db.select({ amount: ownerLedgerEntries.amount }).from(ownerLedgerEntries).where(and(
          eq(ownerLedgerEntries.associationId, link.associationId),
          eq(ownerLedgerEntries.unitId, link.unitId),
          eq(ownerLedgerEntries.personId, link.personId),
        )),
        storage.getPaymentMethodConfigs(link.associationId),
        storage.getActivePaymentGatewayConnection({ associationId: link.associationId, provider: "stripe" }),
      ]);

      if (!association || !unit || !person) {
        return res.status(404).send("Payment link references invalid association data");
      }

      const outstandingBalance = Number(Math.max(0, entries.reduce((sum, row) => sum + row.amount, 0)).toFixed(2));
      const amountDue = Number(Math.min(outstandingBalance || link.amount, link.amount).toFixed(2));
      const activeMethods = paymentMethods.filter((method) => method.isActive === 1);
      const manualInstructions = activeMethods.map((method) => {
        const lines = [method.displayName];
        if (method.bankName) lines.push(`Bank: ${method.bankName}`);
        if (method.accountName) lines.push(`Account name: ${method.accountName}`);
        if (method.routingNumber) lines.push(`Routing number: ${method.routingNumber}`);
        if (method.accountNumber) {
          const accountDigits = method.accountNumber.replace(/\s+/g, "");
          const maskedAccountNumber = accountDigits.length > 4
            ? `****${accountDigits.slice(-4)}`
            : accountDigits;
          lines.push(`Account number: ${maskedAccountNumber}`);
        }
        if (method.zelleHandle) lines.push(`Zelle: ${method.zelleHandle}`);
        if (method.mailingAddress) lines.push(`Mailing address: ${method.mailingAddress}`);
        if (method.instructions?.trim()) lines.push(method.instructions.trim());
        return lines.filter(Boolean).join("\n");
      });

      let stateMessage = "Use this secure payment link to complete your association payment.";
      let stateTone: "info" | "warning" | "success" | "danger" = "info";
      if (link.status === "paid") {
        stateMessage = "This payment link has already been used successfully.";
        stateTone = "success";
      } else if (link.status === "expired") {
        stateMessage = "This payment link has expired. Contact the association if you still need to pay online.";
        stateTone = "warning";
      } else if (link.status === "void") {
        stateMessage = "This payment link has been voided and can no longer be used.";
        stateTone = "danger";
      } else if (outstandingBalance <= 0) {
        stateMessage = "There is no remaining payable balance on this account.";
        stateTone = "success";
      }

      const checkoutQuery = typeof req.query.checkout === "string" ? req.query.checkout : null;
      const checkoutMessages: Record<string, string> = {
        success: "Stripe accepted the payment session. ACH payments can remain pending while the bank confirms settlement.",
        cancelled: "Checkout was cancelled. You can try again when ready.",
        unavailable: "Online ACH checkout is not active for this payment link. Use one of the alternate payment methods below.",
        error: typeof req.query.message === "string" ? req.query.message : "Online checkout could not be started.",
      };

      res.status(200).setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(renderPaymentLinkPage({
        associationName: association.name,
        ownerName: `${person.firstName} ${person.lastName}`.trim() || (person.email || "Owner"),
        unitLabel: [unit.building ? `Building ${unit.building}` : null, unit.unitNumber ? `Unit ${unit.unitNumber}` : null].filter(Boolean).join(" · ") || "Unit",
        linkToken: link.token,
        status: link.status,
        amountDue: Math.max(amountDue, 0),
        currency: link.currency || "USD",
        memo: link.memo,
        expiresAt: link.expiresAt,
        allowPartial: link.allowPartial === 1,
        outstandingBalance,
        checkoutAvailable: link.status === "active" && outstandingBalance > 0 && amountDue > 0 && Boolean(gateway?.secretKey),
        manualInstructions,
        stateMessage,
        stateTone,
        flashMessage: checkoutQuery ? (checkoutMessages[checkoutQuery] || null) : null,
      }));
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

      const normalizedStripeEvent = normalizeStripeWebhookPayload(req.body);
      if (stripeSignature && normalizedStripeEvent?.associationId) {
        const gateway = await storage.getActivePaymentGatewayConnection({
          associationId: normalizedStripeEvent.associationId,
          provider: "stripe",
        });
        if (!gateway?.webhookSecret) {
          return res.status(403).json({ message: "Stripe webhook secret is not configured" });
        }
        const rawBody = Buffer.isBuffer(req.rawBody) ? req.rawBody.toString("utf8") : JSON.stringify(req.body);
        const { timestamp, signature } = parseStripeSignature(stripeSignature);
        if (!timestamp || !signature) {
          return res.status(403).json({ message: "Missing Stripe signature components" });
        }
        const expected = createHmac("sha256", gateway.webhookSecret)
          .update(`${timestamp}.${rawBody}`)
          .digest("hex");
        const expectedBuf = Buffer.from(expected, "utf8");
        const providedBuf = Buffer.from(signature, "utf8");
        if (expectedBuf.length !== providedBuf.length || !timingSafeEqual(expectedBuf, providedBuf)) {
          return res.status(403).json({ message: "Invalid Stripe webhook signature" });
        }

        const result = await storage.processPaymentWebhookEvent({
          associationId: normalizedStripeEvent.associationId,
          provider: "stripe",
          providerEventId: normalizedStripeEvent.providerEventId || "",
          eventType: normalizedStripeEvent.eventType,
          status: normalizedStripeEvent.status,
          amount: normalizedStripeEvent.amount,
          currency: normalizedStripeEvent.currency,
          personId: normalizedStripeEvent.personId,
          unitId: normalizedStripeEvent.unitId,
          paymentLinkToken: normalizedStripeEvent.paymentLinkToken,
          gatewayReference: normalizedStripeEvent.gatewayReference,
          rawPayloadJson: normalizedStripeEvent.rawPayloadJson,
        });
        return res.status(200).json(result);
      }

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

      sendAssociationAdminEmailNotification({
        associationId,
        category: "reconciliation",
        priority: "realtime",
        excludeEmails: req.adminUserEmail ? [req.adminUserEmail] : [],
        email: {
          subject: `Bank statement import created: ${newImport.filename}`,
          html: `<p>A bank statement import has been created.</p><p><strong>Filename:</strong> ${escapeHtml(newImport.filename)}</p><p><strong>Transactions:</strong> ${newImport.transactionCount}</p>`,
          text: `A bank statement import has been created.\nFilename: ${newImport.filename}\nTransactions: ${newImport.transactionCount}`,
          templateKey: "reconciliation-import-created-admin",
          metadata: { importId: newImport.id, associationId },
        },
      }).catch((error) => console.error("[reconciliation] Failed to send import notification:", error));
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

      sendAssociationAdminEmailNotification({
        associationId: result.associationId,
        category: "reconciliation",
        priority: "realtime",
        excludeEmails: req.adminUserEmail ? [req.adminUserEmail] : [],
        email: {
          subject: `Reconciliation period opened`,
          html: `<p>A reconciliation period has been created.</p><p><strong>Start date:</strong> ${escapeHtml(new Date(result.startDate).toLocaleDateString())}</p><p><strong>End date:</strong> ${escapeHtml(new Date(result.endDate).toLocaleDateString())}</p>`,
          text: `A reconciliation period has been created.\nStart date: ${new Date(result.startDate).toLocaleDateString()}\nEnd date: ${new Date(result.endDate).toLocaleDateString()}`,
          templateKey: "reconciliation-period-created-admin",
          metadata: { periodId: result.id, associationId: result.associationId },
        },
      }).catch((error) => console.error("[reconciliation] Failed to send period notification:", error));
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

      sendAssociationAdminEmailNotification({
        associationId: updated.associationId,
        category: "reconciliation",
        priority: "realtime",
        excludeEmails: req.adminUserEmail ? [req.adminUserEmail] : [],
        email: {
          subject: `Reconciliation period ${String(updates.status || updated.status)}`,
          html: `<p>A reconciliation period has been updated.</p><p><strong>Status:</strong> ${escapeHtml(String(updates.status || updated.status))}</p><p><strong>Notes:</strong> ${escapeHtml(String((updates.notes as string | null) || updated.notes || "None"))}</p>`,
          text: `A reconciliation period has been updated.\nStatus: ${String(updates.status || updated.status)}\nNotes: ${String((updates.notes as string | null) || updated.notes || "None")}`,
          templateKey: "reconciliation-period-updated-admin",
          metadata: { periodId: updated.id, associationId: updated.associationId, action: action || null },
        },
      }).catch((error) => console.error("[reconciliation] Failed to send period update notification:", error));
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

  // GET /api/financial/reports/profit-loss?startDate&endDate&associationId
  app.get("/api/financial/reports/profit-loss", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      assertAssociationScope(req, associationId);

      const startDateParam = typeof req.query.startDate === "string" ? req.query.startDate : null;
      const endDateParam = typeof req.query.endDate === "string" ? req.query.endDate : null;
      const startDate = startDateParam ? new Date(startDateParam) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const endDate = endDateParam ? new Date(endDateParam) : new Date();

      const conditions = [
        eq(ownerLedgerEntries.associationId, associationId),
        gte(ownerLedgerEntries.postedAt, startDate),
        lte(ownerLedgerEntries.postedAt, endDate),
      ];

      const entries = await db.select().from(ownerLedgerEntries).where(and(...conditions));

      // Income: payments received and credits
      const incomeEntries = entries.filter(e => e.entryType === "payment" || e.entryType === "credit");
      // Expenses/adjustments: credits, adjustments that reduce income
      const expenseEntries = entries.filter(e => e.entryType === "adjustment");

      const incomeByCategory: Record<string, number> = {};
      for (const e of incomeEntries) {
        const key = e.entryType;
        incomeByCategory[key] = (incomeByCategory[key] ?? 0) + Math.abs(e.amount);
      }

      const expenseByCategory: Record<string, number> = {};
      for (const e of expenseEntries) {
        const key = e.entryType;
        expenseByCategory[key] = (expenseByCategory[key] ?? 0) + Math.abs(e.amount);
      }

      const totalIncome = Object.values(incomeByCategory).reduce((s, v) => s + v, 0);
      const totalExpenses = Object.values(expenseByCategory).reduce((s, v) => s + v, 0);
      const net = totalIncome - totalExpenses;

      // Budget comparison: find ratified budget version overlapping the period
      const assocBudgets = await db.select().from(budgets)
        .where(and(
          eq(budgets.associationId, associationId),
          lte(budgets.periodStart, endDate),
          gte(budgets.periodEnd, startDate),
        ));

      let budgetComparison: { planned: number; actual: number; variance: number } = { planned: 0, actual: totalIncome, variance: totalIncome };

      if (assocBudgets.length > 0) {
        const budgetIds = assocBudgets.map(b => b.id);
        const versions = await db.select().from(budgetVersions)
          .where(and(inArray(budgetVersions.budgetId, budgetIds), sql`${budgetVersions.status} = 'ratified'`))
          .orderBy(desc(budgetVersions.versionNumber))
          .limit(1);

        if (versions.length > 0) {
          const lines = await db.select().from(budgetLines).where(eq(budgetLines.budgetVersionId, versions[0].id));
          const totalPlanned = lines.reduce((s, l) => s + l.plannedAmount, 0);
          budgetComparison = { planned: totalPlanned, actual: totalIncome, variance: totalIncome - totalPlanned };
        }
      }

      res.json({
        income: {
          total: totalIncome,
          byCategory: Object.entries(incomeByCategory).map(([category, amount]) => ({ category, amount })),
        },
        expenses: {
          total: totalExpenses,
          byCategory: Object.entries(expenseByCategory).map(([category, amount]) => ({ category, amount })),
        },
        net,
        budgetComparison,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/financial/reports/ar-aging?associationId
  app.get("/api/financial/reports/ar-aging", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      assertAssociationScope(req, associationId);

      const now = new Date();

      // Get all charge/assessment/late-fee entries
      const chargeEntries = await db.select().from(ownerLedgerEntries).where(and(
        eq(ownerLedgerEntries.associationId, associationId),
        inArray(ownerLedgerEntries.entryType, ["charge", "assessment", "late-fee"]),
      ));

      // Get all payment/credit entries to compute net balance per unit
      const paymentEntries = await db.select().from(ownerLedgerEntries).where(and(
        eq(ownerLedgerEntries.associationId, associationId),
        inArray(ownerLedgerEntries.entryType, ["payment", "credit", "adjustment"]),
      ));

      // Get unit info
      const unitList = await db.select({ id: units.id, unitNumber: units.unitNumber }).from(units)
        .where(eq(units.associationId, associationId));
      const unitMap: Record<string, string> = {};
      for (const u of unitList) unitMap[u.id] = u.unitNumber;

      // Group charges by unit
      const unitCharges: Record<string, { amount: number; postedAt: Date }[]> = {};
      for (const e of chargeEntries) {
        if (!unitCharges[e.unitId]) unitCharges[e.unitId] = [];
        unitCharges[e.unitId].push({ amount: e.amount, postedAt: e.postedAt });
      }

      // Total payments/credits per unit
      const unitPayments: Record<string, number> = {};
      for (const e of paymentEntries) {
        unitPayments[e.unitId] = (unitPayments[e.unitId] ?? 0) + Math.abs(e.amount);
      }

      // Buckets per unit
      const buckets = { current: 0, days30: 0, days60: 0, days90: 0, days120plus: 0 };
      const byUnit: { unitId: string; unitNumber: string; current: number; days30: number; days60: number; days90: number; days120plus: number; total: number }[] = [];

      let summaryTotal = 0;
      const summaryCurrent = { ...buckets };

      for (const [unitId, charges] of Object.entries(unitCharges)) {
        // Compute remaining balance: total charges minus payments
        const totalCharged = charges.reduce((s, c) => s + c.amount, 0);
        const totalPaid = unitPayments[unitId] ?? 0;
        const outstanding = totalCharged - totalPaid;

        if (outstanding <= 0) continue; // no balance due

        // Distribute outstanding across aging buckets based on charge dates (oldest first)
        const sortedCharges = [...charges].sort((a, b) => new Date(a.postedAt).getTime() - new Date(b.postedAt).getTime());
        let remaining = outstanding;
        const unitBuckets = { current: 0, days30: 0, days60: 0, days90: 0, days120plus: 0 };

        for (const charge of sortedCharges) {
          if (remaining <= 0) break;
          const ageMs = now.getTime() - new Date(charge.postedAt).getTime();
          const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
          const chargeRemaining = Math.min(charge.amount, remaining);

          if (ageDays <= 30) unitBuckets.current += chargeRemaining;
          else if (ageDays <= 60) unitBuckets.days30 += chargeRemaining;
          else if (ageDays <= 90) unitBuckets.days60 += chargeRemaining;
          else if (ageDays <= 120) unitBuckets.days90 += chargeRemaining;
          else unitBuckets.days120plus += chargeRemaining;

          remaining -= chargeRemaining;
        }

        const unitTotal = unitBuckets.current + unitBuckets.days30 + unitBuckets.days60 + unitBuckets.days90 + unitBuckets.days120plus;
        byUnit.push({ unitId, unitNumber: unitMap[unitId] ?? unitId, ...unitBuckets, total: unitTotal });

        summaryCurrent.current += unitBuckets.current;
        summaryCurrent.days30 += unitBuckets.days30;
        summaryCurrent.days60 += unitBuckets.days60;
        summaryCurrent.days90 += unitBuckets.days90;
        summaryCurrent.days120plus += unitBuckets.days120plus;
        summaryTotal += unitTotal;
      }

      byUnit.sort((a, b) => b.total - a.total);

      res.json({
        summary: { ...summaryCurrent, total: summaryTotal },
        byUnit,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/financial/reports/board-summary?month&year&associationId
  app.get("/api/financial/reports/board-summary", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      assertAssociationScope(req, associationId);

      const now = new Date();
      const month = parseInt(typeof req.query.month === "string" ? req.query.month : String(now.getMonth() + 1));
      const year = parseInt(typeof req.query.year === "string" ? req.query.year : String(now.getFullYear()));

      const periodStart = new Date(year, month - 1, 1);
      const periodEnd = new Date(year, month, 0, 23, 59, 59);

      const monthEntries = await db.select().from(ownerLedgerEntries).where(and(
        eq(ownerLedgerEntries.associationId, associationId),
        gte(ownerLedgerEntries.postedAt, periodStart),
        lte(ownerLedgerEntries.postedAt, periodEnd),
      ));

      const assessmentsBilled = monthEntries
        .filter(e => e.entryType === "charge" || e.entryType === "assessment")
        .reduce((s, e) => s + e.amount, 0);

      const paymentsReceived = monthEntries
        .filter(e => e.entryType === "payment")
        .reduce((s, e) => s + Math.abs(e.amount), 0);

      const collectionRate = assessmentsBilled > 0 ? Math.min(100, (paymentsReceived / assessmentsBilled) * 100) : 100;
      const totalOutstanding = Math.max(0, assessmentsBilled - paymentsReceived);

      // Delinquent units: units with net balance < 0 as of end of month
      const allEntries = await db.select({
        unitId: ownerLedgerEntries.unitId,
        entryType: ownerLedgerEntries.entryType,
        amount: ownerLedgerEntries.amount,
      }).from(ownerLedgerEntries).where(and(
        eq(ownerLedgerEntries.associationId, associationId),
        lte(ownerLedgerEntries.postedAt, periodEnd),
      ));

      const unitBalances: Record<string, number> = {};
      for (const e of allEntries) {
        if (!unitBalances[e.unitId]) unitBalances[e.unitId] = 0;
        if (e.entryType === "charge" || e.entryType === "assessment" || e.entryType === "late-fee") {
          unitBalances[e.unitId] += e.amount;
        } else if (e.entryType === "payment" || e.entryType === "credit") {
          unitBalances[e.unitId] -= Math.abs(e.amount);
        } else if (e.entryType === "adjustment") {
          unitBalances[e.unitId] += e.amount;
        }
      }

      const delinquentUnits = Object.values(unitBalances).filter(b => b > 0).length;

      // Budget utilization: find ratified budget covering this month
      let budgetUtilization: number | null = null;

      const assocBudgets = await db.select().from(budgets).where(and(
        eq(budgets.associationId, associationId),
        lte(budgets.periodStart, periodEnd),
        gte(budgets.periodEnd, periodStart),
      ));

      if (assocBudgets.length > 0) {
        const budgetIds = assocBudgets.map(b => b.id);
        const versions = await db.select().from(budgetVersions)
          .where(and(inArray(budgetVersions.budgetId, budgetIds), sql`${budgetVersions.status} = 'ratified'`))
          .orderBy(desc(budgetVersions.versionNumber))
          .limit(1);

        if (versions.length > 0) {
          const lines = await db.select().from(budgetLines).where(eq(budgetLines.budgetVersionId, versions[0].id));
          const totalPlanned = lines.reduce((s, l) => s + l.plannedAmount, 0);
          if (totalPlanned > 0) {
            budgetUtilization = Math.round((paymentsReceived / totalPlanned) * 100);
          }
        }
      }

      res.json({
        assessmentsBilled,
        paymentsReceived,
        collectionRate: Math.round(collectionRate * 10) / 10,
        totalOutstanding,
        delinquentUnits,
        budgetUtilization,
      });
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

  // ─── Elections ─────────────────────────────────────────────────────────────

  app.get("/api/elections", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const meetingId = typeof req.query.meetingId === "string" ? req.query.meetingId : undefined;
      const result = await storage.getElections(getAssociationIdQuery(req), meetingId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/elections", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const parsed = insertElectionSchema.parse({ ...req.body, createdBy: req.adminUserEmail || null });
      assertAssociationScope(req as AdminRequest, parsed.associationId);
      // Date validation: closesAt must be after opensAt
      if (parsed.opensAt && parsed.closesAt && new Date(parsed.closesAt) <= new Date(parsed.opensAt)) {
        return res.status(400).json({ message: "Closing date must be after opening date." });
      }
      const result = await storage.createElection(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // 11.3: Election compliance summary for governance page
  app.get("/api/elections/compliance-summary", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      const result = await storage.getElectionComplianceSummary(associationId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/elections/active-summary", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getActiveElectionsSummary(getAssociationIdQuery(req));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Cross-election participation analytics
  app.get("/api/elections/analytics", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      if (!associationId) return res.status(400).json({ message: "associationId query parameter is required" });
      const analytics = await storage.getElectionAnalytics(associationId);
      res.json(analytics);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/elections/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getElection(getParam(req.params.id));
      if (!result) return res.status(404).json({ message: "Election not found" });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/elections/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const parsed = insertElectionSchema.partial().parse(req.body);
      const electionId = getParam(req.params.id);

      // Date validation: closesAt must be after opensAt when both are provided
      if (parsed.opensAt && parsed.closesAt && new Date(parsed.closesAt) <= new Date(parsed.opensAt)) {
        return res.status(400).json({ message: "Closing date must be after opening date." });
      }
      // Also check against existing values when only one date is being updated
      if (parsed.opensAt || parsed.closesAt) {
        const existing = await storage.getElection(electionId);
        if (existing) {
          const effectiveOpensAt = parsed.opensAt ? new Date(parsed.opensAt) : (existing.opensAt ? new Date(existing.opensAt) : null);
          const effectiveClosesAt = parsed.closesAt ? new Date(parsed.closesAt) : (existing.closesAt ? new Date(existing.closesAt) : null);
          if (effectiveOpensAt && effectiveClosesAt && effectiveClosesAt <= effectiveOpensAt) {
            return res.status(400).json({ message: "Closing date must be after opening date." });
          }
        }
      }

      // Guard: draft->open requires at least 1 ballot option
      // Also capture whether this is a draft->open transition for post-update side effects
      let isDraftToOpen = false;
      if (parsed.status === "open") {
        const existing = await storage.getElection(electionId);
        if (existing && existing.status === "draft") {
          const opts = await storage.getElectionOptions(electionId);
          if (opts.length === 0) {
            return res.status(400).json({ message: "At least one ballot option is required before opening voting." });
          }
          isDraftToOpen = true;
        }
      }

      // If cancelling an open election, revoke all pending tokens
      if (parsed.status === "cancelled") {
        const existing = await storage.getElection(electionId);
        if (existing && existing.status === "open") {
          await storage.revokeAllPendingTokens(existing.id);
        }
      }
      const result = await storage.updateElection(electionId, parsed);
      if (!result) return res.status(404).json({ message: "Election not found" });

      // WS6.4: If closesAt was extended on an open election, notify pending voters
      if (!isDraftToOpen && result && result.status === "open" && parsed.closesAt) {
        const appBaseUrl = (process.env.APP_BASE_URL || "").replace(/\/$/, "");
        (async () => {
          try {
            const pendingVoters = await storage.getPendingVoterEmailsForElection(result.id);
            const newClosesAtStr = result.closesAt ? new Date(result.closesAt).toLocaleDateString("en-US", { dateStyle: "long" }) : "TBD";
            for (const voter of pendingVoters) {
              const voteUrl = `${appBaseUrl}/vote/${voter.token}`;
              await sendPlatformEmail({
                to: voter.email,
                subject: `${result.title} — Deadline Extended`,
                html: `
                  <h2>${result.title} — Deadline Extended</h2>
                  <p>The voting deadline has been extended to <strong>${newClosesAtStr}</strong>.</p>
                  <p>If you haven't voted yet, there's still time.</p>
                  <p style="margin:24px 0">
                    <a href="${voteUrl}" style="display:inline-block;padding:12px 24px;background-color:#4f46e5;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600">
                      Cast Your Vote
                    </a>
                  </p>
                  <p style="font-size:12px;color:#6b7280">If the button doesn't work, copy this link: ${voteUrl}</p>
                `,
                associationId: result.associationId,
                templateKey: "election-deadline-extended",
              });
            }
            debug(`[elections] Sent ${pendingVoters.length} deadline extension emails for election ${result.id}`);
          } catch (err) {
            console.error("[elections] Failed to send deadline extension emails:", err);
          }
        })();
      }

      // Side effects on draft->open transition (fire-and-forget)
      if (isDraftToOpen && result) {
        const appBaseUrl = (process.env.APP_BASE_URL || "").replace(/\/$/, "");

        // 9.1: Auto-send ballot invitation emails
        (async () => {
          try {
            const voters = await storage.getVoterEmailsForElection(result.id);
            const closesAtStr = result.closesAt ? new Date(result.closesAt).toLocaleDateString("en-US", { dateStyle: "long" }) : "TBD";
            const tokenIds: string[] = [];
            for (const voter of voters) {
              const voteUrl = `${appBaseUrl}/vote/${voter.token}`;
              await sendPlatformEmail({
                to: voter.email,
                subject: `${result.title} — Your Vote`,
                html: `
                  <h2>${result.title}</h2>
                  ${result.description ? `<p>${result.description}</p>` : ""}
                  <p>Voting is now open and closes on <strong>${closesAtStr}</strong>.</p>
                  <p style="margin:24px 0">
                    <a href="${voteUrl}" style="display:inline-block;padding:12px 24px;background-color:#4f46e5;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600">
                      Cast Your Vote
                    </a>
                  </p>
                  <p style="font-size:12px;color:#6b7280">If the button doesn't work, copy this link: ${voteUrl}</p>
                `,
                associationId: result.associationId,
                templateKey: "election-ballot-invitation",
              });
              tokenIds.push(voter.tokenId);
            }
            if (tokenIds.length > 0) {
              await storage.markBallotTokensSent(tokenIds);
            }
            debug(`[elections] Sent ${tokenIds.length} ballot invitation emails for election ${result.id}`);
          } catch (err) {
            console.error("[elections] Failed to send ballot invitation emails:", err);
          }
        })();

        // 9.3: Auto-create community announcement
        (async () => {
          try {
            const closesAtStr = result.closesAt ? new Date(result.closesAt).toLocaleDateString("en-US", { dateStyle: "long" }) : "TBD";
            await db.insert(communityAnnouncements).values({
              associationId: result.associationId,
              title: `${result.title} — Voting Now Open`,
              body: `${result.description || "A new election has been opened for your community."}\n\nVoting closes on ${closesAtStr}. All eligible voters will receive ballot instructions by email.`,
              priority: "important",
              isPublished: 1,
              publishedAt: new Date(),
              targetAudience: "all",
              createdBy: "system",
            });
            debug(`[elections] Created community announcement for election ${result.id}`);
          } catch (err) {
            console.error("[elections] Failed to create community announcement:", err);
          }
        })();
      }

      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/elections/:id", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      await storage.deleteElection(getParam(req.params.id));
      res.json({ ok: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/elections/:id/tokens-detail", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getBallotTokensWithNames(getParam(req.params.id));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/elections/:id/options", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getElectionOptions(getParam(req.params.id));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/elections/:id/options", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const parsed = insertElectionOptionSchema.parse({ ...req.body, electionId: getParam(req.params.id) });
      const result = await storage.createElectionOption(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/elections/:id/options/:optionId", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      await storage.deleteElectionOption(getParam(req.params.optionId));
      res.json({ ok: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // ── Nomination management (admin) ──────────────────────────────────────────
  app.get("/api/elections/:id/nominations", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const nominations = await storage.getNominationsForElection(getParam(req.params.id));
      res.json(nominations);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/elections/:id/nominations/:optionId/approve", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const result = await storage.approveNomination(getParam(req.params.optionId));
      if (!result) return res.status(404).json({ message: "Nomination not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/elections/:id/nominations/:optionId/reject", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const result = await storage.rejectNomination(getParam(req.params.optionId));
      if (!result) return res.status(404).json({ message: "Nomination not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/elections/:id/generate-tokens", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const result = await storage.generateBallotTokens(getParam(req.params.id), req.adminUserEmail || undefined);
      if (result.created === 0) {
        return res.json({ created: 0, warning: "No eligible voters found for the selected voting rule." });
      }
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/elections/:id/tokens", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getBallotTokens(getParam(req.params.id));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/elections/:id/casts", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getBallotCasts(getParam(req.params.id));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/elections/:id/tally", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getElectionTally(getParam(req.params.id));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/elections/:id/certify", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const election = await storage.getElection(getParam(req.params.id));
      if (!election) return res.status(404).json({ message: "Election not found" });
      if (election.status !== "closed") return res.status(400).json({ message: "Election must be closed before certification" });
      const tally = await storage.getElectionTally(getParam(req.params.id));
      if (!tally.quorumMet) return res.status(400).json({ message: `Quorum not met — ${tally.participationPercent}% participation, ${tally.quorumPercent}% required` });

      // Generate certification summary
      const winners = tally.optionTallies.length > 0
        ? [...tally.optionTallies].sort((a, b) => b.votes - a.votes)
        : [];
      const topVotes = winners.length > 0 ? winners[0].votes : 0;
      const winnerLabels = winners.filter((w) => w.votes === topVotes && w.votes > 0).map((w) => w.label);
      const optionLines = tally.optionTallies.map((o) => `  ${o.label}: ${o.votes} votes (${o.percent}%)`).join("\n");
      const certificationSummary = [
        `ELECTION CERTIFICATION SUMMARY`,
        `==============================`,
        `Title: ${election.title}`,
        `Vote Type: ${election.voteType}`,
        `Voting Rule: ${election.votingRule}`,
        ``,
        `Participation`,
        `  Eligible Voters: ${tally.eligibleCount}`,
        `  Ballots Cast: ${tally.castCount}`,
        `  Participation: ${tally.participationPercent}%`,
        `  Quorum Required: ${tally.quorumPercent}%`,
        `  Quorum Status: MET`,
        ``,
        ...(tally.optionTallies.length > 0 ? [
          `Results by Option`,
          optionLines,
          ``,
        ] : []),
        ...(winnerLabels.length > 0 ? [`Winner(s): ${winnerLabels.join(", ")}`, ``] : []),
        `Certified by: ${req.adminUserEmail || "unknown"}`,
        `Certified at: ${new Date().toISOString()}`,
      ].join("\n");

      const result = await storage.certifyElection(getParam(req.params.id), req.adminUserEmail || "unknown", certificationSummary);

      // 11.1: Auto-create result certificate document in the documents table
      (async () => {
        try {
          const certDate = result.certifiedAt ? new Date(result.certifiedAt).toLocaleDateString("en-US", { dateStyle: "long" }) : new Date().toLocaleDateString("en-US", { dateStyle: "long" });
          const docTitle = `Election Results: ${result.title} — ${certDate}`;
          // Store the certification summary as a text-based data URI so it has a resolvable fileUrl
          const textContent = certificationSummary;
          const dataUri = `data:text/plain;base64,${Buffer.from(textContent).toString("base64")}`;
          const doc = await storage.createDocument({
            associationId: result.associationId,
            title: docTitle,
            fileUrl: dataUri,
            documentType: "Governance > Elections",
            isPortalVisible: 0,
            portalAudience: "owner",
            priorVersionsPortalVisible: 0,
            uploadedBy: req.adminUserEmail || "system",
            versionNumber: 1,
            isCurrentVersion: 1,
          }, req.adminUserEmail || "system");
          // Update election with the resultDocumentId
          await db.update(elections).set({ resultDocumentId: doc.id }).where(eq(elections.id, result.id));
          debug(`[elections] Created result certificate document ${doc.id} for election ${result.id}`);
        } catch (err) {
          console.error("[elections] Failed to create result certificate document:", err);
        }
      })();

      // 9.4: Send results email on certification when resultVisibility is public (fire-and-forget)
      if (result.resultVisibility === "public") {
        (async () => {
          try {
            const voters = await storage.getVoterEmailsForElection(result.id);
            const isSecret = Boolean(result.isSecretBallot);
            const resultRows = tally.optionTallies
              .map((o) => `<tr><td style="padding:4px 12px;border:1px solid #e5e7eb">${o.label}</td><td style="padding:4px 12px;border:1px solid #e5e7eb;text-align:right">${isSecret ? "—" : o.votes}</td><td style="padding:4px 12px;border:1px solid #e5e7eb;text-align:right">${o.percent}%</td></tr>`)
              .join("");
            const resultsTable = tally.optionTallies.length > 0
              ? `<table style="border-collapse:collapse;margin:16px 0;width:100%">
                  <thead><tr style="background:#f9fafb"><th style="padding:6px 12px;border:1px solid #e5e7eb;text-align:left">Option</th><th style="padding:6px 12px;border:1px solid #e5e7eb;text-align:right">${isSecret ? "" : "Votes"}</th><th style="padding:6px 12px;border:1px solid #e5e7eb;text-align:right">%</th></tr></thead>
                  <tbody>${resultRows}</tbody>
                </table>`
              : "";
            for (const voter of voters) {
              await sendPlatformEmail({
                to: voter.email,
                subject: `${result.title} — Election Results`,
                html: `
                  <h2>${result.title} — Results</h2>
                  <p>The election has been certified. Here are the official results:</p>
                  <p><strong>Participation:</strong> ${tally.participationPercent}% (${tally.castCount} of ${tally.eligibleCount} eligible voters)</p>
                  ${isSecret ? "<p><em>This was a secret ballot — only aggregate percentages are shown.</em></p>" : ""}
                  ${resultsTable}
                  <p style="font-size:12px;color:#6b7280;margin-top:16px">Certified by ${result.certifiedBy || "administration"} on ${result.certifiedAt ? new Date(result.certifiedAt).toLocaleDateString("en-US", { dateStyle: "long" }) : "today"}.</p>
                `,
                associationId: result.associationId,
                templateKey: "election-results-announcement",
              });
            }
            debug(`[elections] Sent ${voters.length} results emails for election ${result.id}`);
          } catch (err) {
            console.error("[elections] Failed to send results emails:", err);
          }
        })();
      }

      // WS4.2: Append election results to linked meeting minutes (fire-and-forget)
      if (result.meetingId) {
        (async () => {
          try {
            const meetingId = result.meetingId!;
            const [meeting] = await db.select().from(governanceMeetings).where(eq(governanceMeetings.id, meetingId));
            if (!meeting) {
              console.warn(`[elections] Meeting ${meetingId} not found for election ${result.id}, skipping minutes integration`);
              return;
            }

            const optionLines = tally.optionTallies.map((o) => `  - ${o.label}: ${o.votes} votes (${o.percent}%)`).join("\n");
            const noteContent = [
              `ELECTION RESULTS: ${result.title}`,
              `─────────────────────────────────`,
              `Vote Type: ${result.voteType}`,
              `Voting Rule: ${result.votingRule}`,
              ``,
              `Participation:`,
              `  Eligible Voters: ${tally.eligibleCount}`,
              `  Ballots Cast: ${tally.castCount}`,
              `  Participation Rate: ${tally.participationPercent}%`,
              `  Quorum Required: ${tally.quorumPercent}%`,
              `  Quorum Status: ${tally.quorumMet ? "MET" : "NOT MET"}`,
              ``,
              ...(tally.optionTallies.length > 0 ? [
                `Vote Totals:`,
                optionLines,
                ``,
              ] : []),
              `Certified by: ${req.adminUserEmail || "unknown"}`,
              `Certified at: ${new Date().toISOString()}`,
            ].join("\n");

            await storage.createMeetingNote({
              meetingId,
              noteType: "election-results",
              content: noteContent,
              createdBy: req.adminUserEmail || "system",
            });
            debug(`[elections] Appended election results to meeting ${meetingId} for election ${result.id}`);
          } catch (err) {
            console.error("[elections] Failed to append election results to meeting minutes:", err);
          }
        })();
      }

      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // 9.2: Send reminders to pending voters
  app.post("/api/elections/:id/send-reminders", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const election = await storage.getElection(getParam(req.params.id));
      if (!election) return res.status(404).json({ message: "Election not found" });
      if (election.status !== "open") return res.status(400).json({ message: "Reminders can only be sent for open elections" });

      const pendingVoters = await storage.getPendingVoterEmailsForElection(election.id);
      const tally = await storage.getElectionTally(election.id);
      const appBaseUrl = (process.env.APP_BASE_URL || "").replace(/\/$/, "");
      const closesAtStr = election.closesAt ? new Date(election.closesAt).toLocaleDateString("en-US", { dateStyle: "long" }) : "TBD";

      // Fire-and-forget email sending
      (async () => {
        try {
          for (const voter of pendingVoters) {
            const voteUrl = `${appBaseUrl}/vote/${voter.token}`;
            await sendPlatformEmail({
              to: voter.email,
              subject: `Reminder: ${election.title} — Your Vote`,
              html: `
                <h2>Reminder: ${election.title}</h2>
                ${election.description ? `<p>${election.description}</p>` : ""}
                <p>Voting closes on <strong>${closesAtStr}</strong>. So far, <strong>${tally.participationPercent}%</strong> of eligible voters have participated.</p>
                <p>Your vote matters — don't miss your chance to have a say.</p>
                <p style="margin:24px 0">
                  <a href="${voteUrl}" style="display:inline-block;padding:12px 24px;background-color:#4f46e5;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600">
                    Cast Your Vote
                  </a>
                </p>
                <p style="font-size:12px;color:#6b7280">If the button doesn't work, copy this link: ${voteUrl}</p>
              `,
              associationId: election.associationId,
              templateKey: "election-voting-reminder",
            });
          }
          debug(`[elections] Sent ${pendingVoters.length} reminder emails for election ${election.id}`);
        } catch (err) {
          console.error("[elections] Failed to send reminder emails:", err);
        }
      })();

      res.json({ sent: pendingVoters.length, message: `Sending reminders to ${pendingVoters.length} pending voter(s).` });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // WS1.3: Per-token ballot resend
  app.post("/api/elections/:id/tokens/:tokenId/resend", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const electionId = getParam(req.params.id);
      const tokenId = getParam(req.params.tokenId);

      const election = await storage.getElection(electionId);
      if (!election) return res.status(404).json({ message: "Election not found" });
      if (election.status !== "open") return res.status(400).json({ message: "Ballots can only be resent for open elections" });

      const tokenData = await storage.resendBallotToken(tokenId);
      if (!tokenData) return res.status(404).json({ message: "Token not found or not in pending status" });
      if (tokenData.electionId !== electionId) return res.status(400).json({ message: "Token does not belong to this election" });

      const appBaseUrl = (process.env.APP_BASE_URL || "").replace(/\/$/, "");
      const voteUrl = `${appBaseUrl}/vote/${tokenData.token}`;
      const closesAtStr = election.closesAt ? new Date(election.closesAt).toLocaleDateString("en-US", { dateStyle: "long" }) : "TBD";

      // Fire-and-forget email sending
      (async () => {
        try {
          await sendPlatformEmail({
            to: tokenData.email,
            subject: `${election.title} — Your Vote`,
            html: `
              <h2>${election.title}</h2>
              ${election.description ? `<p>${election.description}</p>` : ""}
              <p>Voting is now open and closes on <strong>${closesAtStr}</strong>.</p>
              <p style="margin:24px 0">
                <a href="${voteUrl}" style="display:inline-block;padding:12px 24px;background-color:#4f46e5;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600">
                  Cast Your Vote
                </a>
              </p>
              <p style="font-size:12px;color:#6b7280">If the button doesn't work, copy this link: ${voteUrl}</p>
            `,
            associationId: election.associationId,
            templateKey: "election-ballot-invitation",
          });
          debug(`[elections] Resent ballot email for token ${tokenId} in election ${electionId}`);
        } catch (err) {
          console.error("[elections] Failed to resend ballot email:", err);
        }
      })();

      res.json({ ok: true, message: "Ballot resent" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/elections/:id/proxies", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getProxyDesignations(getParam(req.params.id));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/elections/:id/proxies", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const parsed = insertElectionProxyDesignationSchema.parse({ ...req.body, electionId: getParam(req.params.id) });
      const result = await storage.createProxyDesignation(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/elections/proxies/:proxyId", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const result = await storage.revokeProxyDesignation(getParam(req.params.proxyId));
      if (!result) return res.status(404).json({ message: "Proxy designation not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/elections/:id/proxy-documents", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const result = await storage.getProxyDocuments(getParam(req.params.id));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/elections/:id/proxy-documents", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), upload.single("file"), async (req: AdminRequest, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "File is required" });
      const fileUrl = `/uploads/${req.file.filename}`;
      const parsed = insertElectionProxyDocumentSchema.parse({
        electionId: getParam(req.params.id),
        ownerPersonId: req.body.ownerPersonId || null,
        ownerUnitId: req.body.ownerUnitId || null,
        title: req.body.title || req.file.originalname,
        fileUrl,
        uploadedBy: req.adminUserEmail || null,
      });
      const result = await storage.createProxyDocument(parsed);

      // 11.2: Mirror proxy document into the documents table for governance record-keeping
      (async () => {
        try {
          const election = await storage.getElection(getParam(req.params.id));
          if (election) {
            await storage.createDocument({
              associationId: election.associationId,
              title: `Proxy Form: ${parsed.title}`,
              fileUrl: parsed.fileUrl,
              documentType: "Governance > Proxy Forms",
              isPortalVisible: 0,
              portalAudience: "owner",
              priorVersionsPortalVisible: 0,
              uploadedBy: parsed.uploadedBy || "system",
              versionNumber: 1,
              isCurrentVersion: 1,
            }, parsed.uploadedBy || "system");
            debug(`[elections] Mirrored proxy document to documents table for election ${election.id}`);
          }
        } catch (err) {
          console.error("[elections] Failed to mirror proxy document:", err);
        }
      })();

      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Portal ballot endpoint (no admin auth — uses ballot token)
  app.get("/api/elections/ballot/:token", async (req, res) => {
    try {
      const token = getParam(req.params.token);
      const ballotToken = await storage.getBallotTokenByToken(token);
      if (!ballotToken) return res.status(404).json({ message: "Invalid ballot token" });

      const election = await storage.getElection(ballotToken.electionId);
      if (!election) return res.status(404).json({ message: "Election not found" });

      const options = await storage.getElectionOptions(ballotToken.electionId);
      res.json({
        election: {
          id: election.id,
          title: election.title,
          description: election.description,
          voteType: election.voteType,
          isSecretBallot: election.isSecretBallot,
          closesAt: election.closesAt,
          status: election.status,
          maxChoices: election.maxChoices,
        },
        options,
        ballotToken: { id: ballotToken.id, status: ballotToken.status, electionId: ballotToken.electionId },
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/elections/ballot/:token/cast", async (req, res) => {
    try {
      const token = getParam(req.params.token);
      const choices: string[] = Array.isArray(req.body.choices) ? req.body.choices : [];
      const result = await storage.castBallot({ token, choicesJson: choices });
      res.status(201).json({ confirmationRef: result.confirmationRef, castAt: result.castAt });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Portal proxy designation (requires portal auth)
  app.get("/api/portal/elections", requirePortal, async (req: PortalRequest, res) => {
    try {
      const history = await storage.getOwnerElectionHistory(req.portalAccessId!);
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/portal/elections/:id/proxy", requirePortal, async (req: PortalRequest, res) => {
    try {
      const electionId = getParam(req.params.id);
      const resolved = await storage.resolvePortalAccessContext(req.portalAccessId!);
      if (!resolved) return res.status(403).json({ message: "Portal access not found" });

      const { access } = resolved;
      if (!access.personId) return res.status(400).json({ message: "No person linked to portal access" });

      const parsed = insertElectionProxyDesignationSchema.parse({
        electionId,
        ownerPersonId: access.personId,
        ownerUnitId: access.unitId ?? null,
        proxyPersonId: req.body.proxyPersonId,
        notes: req.body.notes ?? null,
      });
      const result = await storage.createProxyDesignation(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // ── Portal nomination routes ───────────────────────────────────────────────
  app.get("/api/portal/elections/:id/nominations", requirePortal, async (req: PortalRequest, res) => {
    try {
      const nominations = await storage.getPortalNominationsForElection(req.portalAccessId!, getParam(req.params.id));
      res.json(nominations);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/portal/elections/:id/nominate", requirePortal, async (req: PortalRequest, res) => {
    try {
      const electionId = getParam(req.params.id);
      const election = await storage.getElection(electionId);
      if (!election) return res.status(404).json({ message: "Election not found" });

      // Verify nomination window is open
      const now = new Date();
      if (!election.nominationsOpenAt || !election.nominationsCloseAt) {
        return res.status(400).json({ message: "This election does not accept nominations" });
      }
      if (now < new Date(election.nominationsOpenAt)) {
        return res.status(400).json({ message: "Nominations have not opened yet" });
      }
      if (now > new Date(election.nominationsCloseAt)) {
        return res.status(400).json({ message: "Nominations have closed" });
      }

      const resolved = await storage.resolvePortalAccessContext(req.portalAccessId!);
      if (!resolved) return res.status(403).json({ message: "Portal access not found" });
      const { access } = resolved;
      if (!access.personId) return res.status(400).json({ message: "No person linked to portal access" });

      const result = await storage.submitNomination({
        electionId,
        label: req.body.label,
        bio: req.body.bio,
        photoUrl: req.body.photoUrl,
        currentRole: req.body.currentRole,
        nominationStatement: req.body.nominationStatement,
        nominatedByPersonId: access.personId,
      });

      // Fire-and-forget email notification to preference-eligible admins
      sendAssociationAdminEmailNotification({
        associationId: election.associationId,
        category: "elections",
        priority: "realtime",
        email: {
          subject: `New Nomination: ${result.label} for ${election.title}`,
          html: `<p>A new self-nomination has been submitted for <strong>${election.title}</strong>.</p>
               <p>Candidate: ${result.label}</p>
               ${result.nominationStatement ? `<p>Statement: ${result.nominationStatement}</p>` : ""}
               <p>Please review and approve or reject this nomination in the admin panel.</p>`,
          templateKey: "election-nomination-submitted",
          metadata: {
            electionId: election.id,
            electionTitle: election.title,
            nominationId: result.id,
          },
        },
      }).catch((err) => console.error("[elections] Failed to send nomination notification email:", err));

      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Board-only elections with pending ballot tokens for the logged-in board member
  app.get("/api/portal/elections/board-pending", requirePortal, async (req: PortalRequest, res) => {
    try {
      const pending = await storage.getBoardPendingElections(req.portalAccessId!);
      res.json(pending);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Certified election archive for the association
  app.get("/api/portal/elections/archive", requirePortal, async (req: PortalRequest, res) => {
    try {
      if (!req.portalAssociationId) return res.status(400).json({ message: "No association context" });
      const archive = await storage.getCertifiedElections(req.portalAssociationId);
      res.json(archive);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Recently certified board elections (for roster update prompt)
  app.get("/api/portal/elections/board-certified", requirePortal, async (req: PortalRequest, res) => {
    try {
      if (!req.portalAssociationId) return res.status(400).json({ message: "No association context" });
      const certified = await storage.getRecentlyCertifiedBoardElections(req.portalAssociationId);
      res.json(certified);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Active elections with pending ballot for the logged-in owner
  app.get("/api/portal/elections/active", requirePortal, async (req: PortalRequest, res) => {
    try {
      const active = await storage.getOwnerActiveElections(req.portalAccessId!);
      res.json(active);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Election detail for portal
  app.get("/api/portal/elections/:id/detail", requirePortal, async (req: PortalRequest, res) => {
    try {
      const electionId = getParam(req.params.id);
      const detail = await storage.getElectionDetailForPortal(req.portalAccessId!, electionId);
      if (!detail) return res.status(404).json({ message: "Election not found" });
      res.json(detail);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get association owners for proxy designation picker
  app.get("/api/portal/elections/:id/proxy-candidates", requirePortal, async (req: PortalRequest, res) => {
    try {
      const electionId = getParam(req.params.id);
      const owners = await storage.getAssociationOwnersForProxy(req.portalAccessId!, electionId);
      res.json(owners);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Revoke proxy designation from portal
  app.post("/api/portal/elections/proxy/:designationId/revoke", requirePortal, async (req: PortalRequest, res) => {
    try {
      const designationId = getParam(req.params.designationId);
      const success = await storage.revokeProxyDesignationForPortal(req.portalAccessId!, designationId);
      if (!success) return res.status(404).json({ message: "Proxy designation not found or not yours" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // HTML result report export (print as PDF via browser)
  app.get("/api/elections/:id/result-report", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const election = await storage.getElection(getParam(req.params.id));
      if (!election) return res.status(404).json({ message: "Election not found" });
      const tally = await storage.getElectionTally(election.id);

      // Fetch association name
      const allAssociations = await storage.getAssociations({ includeArchived: true });
      const association = allAssociations.find((a: any) => a.id === election.associationId);
      const associationName = association?.name || "Unknown Association";

      // Determine winner(s) — option(s) with the highest vote count
      const maxVotes = Math.max(...tally.optionTallies.map((o: any) => o.votes), 0);
      const winnerIds = new Set(
        tally.optionTallies.filter((o: any) => o.votes === maxVotes && maxVotes > 0).map((o: any) => o.optionId),
      );

      const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

      const optionRows = election.isSecretBallot
        ? `<tr><td colspan="4" style="text-align:center;font-style:italic;">Secret ballot &mdash; individual choices are anonymized. Total votes cast: ${tally.castCount}</td></tr>`
        : tally.optionTallies
            .map((opt: any) => {
              const isWinner = winnerIds.has(opt.optionId);
              const rowStyle = isWinner ? ' style="background:#e6ffe6;font-weight:bold;"' : "";
              return `<tr${rowStyle}>
                <td>${escHtml(opt.label)}${isWinner ? ' <span style="color:#16a34a;">&#9733; Winner</span>' : ""}</td>
                <td style="text-align:right;">${opt.votes}</td>
                <td style="text-align:right;">${opt.percent}%</td>
                <td style="width:40%;"><div style="background:#e5e7eb;border-radius:4px;overflow:hidden;height:20px;"><div style="background:#2563eb;height:100%;width:${opt.percent}%;min-width:${opt.percent > 0 ? "2px" : "0"};"></div></div></td>
              </tr>`;
            })
            .join("\n");

      let certificationHtml: string;
      if (election.status === "certified") {
        certificationHtml = `
          <p><strong>Status:</strong> <span style="color:#16a34a;font-weight:bold;">CERTIFIED</span></p>
          <p><strong>Certified by:</strong> ${escHtml(election.certifiedBy || "N/A")}</p>
          <p><strong>Certified at:</strong> ${election.certifiedAt ? new Date(election.certifiedAt).toLocaleString() : "N/A"}</p>
          ${election.certificationSummary ? `<p><strong>Summary:</strong> ${escHtml(election.certificationSummary)}</p>` : ""}`;
      } else {
        certificationHtml = `<p style="color:#b91c1c;">Not yet certified.</p>`;
      }

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Election Result Report - ${escHtml(election.title)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 1.5; }
    h1 { font-size: 24px; margin-bottom: 4px; }
    h2 { font-size: 18px; margin-top: 28px; margin-bottom: 12px; border-bottom: 2px solid #e5e7eb; padding-bottom: 4px; }
    .subtitle { color: #6b7280; font-size: 14px; margin-bottom: 24px; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin-bottom: 16px; }
    .meta-grid dt { font-weight: 600; color: #374151; }
    .meta-grid dd { color: #4b5563; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { padding: 8px 12px; border: 1px solid #e5e7eb; font-size: 14px; }
    th { background: #f9fafb; text-align: left; font-weight: 600; }
    .quorum-badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-weight: 600; font-size: 13px; }
    .quorum-met { background: #dcfce7; color: #16a34a; }
    .quorum-not-met { background: #fee2e2; color: #b91c1c; }
    .print-btn { background: #2563eb; color: #fff; border: none; padding: 10px 24px; border-radius: 6px; font-size: 14px; cursor: pointer; margin-top: 24px; }
    .print-btn:hover { background: #1d4ed8; }
    @media print {
      .print-btn { display: none !important; }
      body { padding: 20px; }
      h2 { break-after: avoid; }
      table { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>Election Result Report</h1>
  <p class="subtitle">${escHtml(associationName)}</p>

  <h2>Election Details</h2>
  <dl class="meta-grid">
    <dt>Title</dt><dd>${escHtml(election.title)}</dd>
    <dt>Type</dt><dd>${escHtml(election.voteType)}</dd>
    <dt>Voting Rule</dt><dd>${escHtml(election.votingRule)}</dd>
    <dt>Status</dt><dd>${escHtml(election.status)}</dd>
    <dt>Opens</dt><dd>${election.opensAt ? new Date(election.opensAt).toLocaleString() : "N/A"}</dd>
    <dt>Closes</dt><dd>${election.closesAt ? new Date(election.closesAt).toLocaleString() : "N/A"}</dd>
  </dl>

  <h2>Participation</h2>
  <dl class="meta-grid">
    <dt>Eligible Voters</dt><dd>${tally.eligibleCount}</dd>
    <dt>Ballots Cast</dt><dd>${tally.castCount}</dd>
    <dt>Participation</dt><dd>${tally.participationPercent}%</dd>
    <dt>Quorum Required</dt><dd>${tally.quorumPercent}%</dd>
    <dt>Quorum Status</dt><dd><span class="quorum-badge ${tally.quorumMet ? "quorum-met" : "quorum-not-met"}">${tally.quorumMet ? "MET" : "NOT MET"}</span></dd>
  </dl>

  <h2>Vote Totals</h2>
  <table>
    <thead><tr><th>Option</th><th style="text-align:right;">Votes</th><th style="text-align:right;">%</th><th>Distribution</th></tr></thead>
    <tbody>
      ${optionRows}
    </tbody>
  </table>

  <h2>Certification</h2>
  ${certificationHtml}

  <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>

  <p style="margin-top:32px;font-size:12px;color:#9ca3af;text-align:center;">Generated on ${new Date().toLocaleString()}</p>
</body>
</html>`;

      res.setHeader("Content-Type", "text/html");
      res.send(html);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Voter eligibility audit report (HTML, printable)
  app.get("/api/elections/:id/eligibility-report", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const election = await storage.getElection(getParam(req.params.id));
      if (!election) return res.status(404).json({ message: "Election not found" });

      const tokens = await storage.getBallotTokensWithNames(election.id);
      const proxies = await storage.getProxyDesignations(election.id);

      // Build proxy lookup: personId -> proxy info (active = not revoked)
      const proxyMap = new Map<string, { proxyName: string }>();
      for (const p of proxies) {
        if (!p.revokedAt) {
          proxyMap.set(p.ownerPersonId, { proxyName: p.proxyName });
        }
      }

      const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

      const voterRows = tokens.map((t: any) => {
        const hasVoted = t.status === "cast";
        const proxyInfo = t.personId ? proxyMap.get(t.personId) : null;
        let votingStatus: string;
        let statusClass: string;
        if (hasVoted && proxyInfo) {
          votingStatus = `Voted by Proxy (${escHtml(proxyInfo.proxyName)})`;
          statusClass = "status-proxy";
        } else if (hasVoted) {
          votingStatus = "Voted";
          statusClass = "status-voted";
        } else if (proxyInfo) {
          votingStatus = `Proxy Designated (${escHtml(proxyInfo.proxyName)})`;
          statusClass = "status-proxy";
        } else {
          votingStatus = "Has Not Voted";
          statusClass = "status-not-voted";
        }

        return `<tr>
          <td>${escHtml(t.voterName)}</td>
          <td>${escHtml(t.unitNumber)}</td>
          <td class="${statusClass}">${votingStatus}</td>
          <td>${t.castAt ? new Date(t.castAt).toLocaleString() : "&mdash;"}</td>
        </tr>`;
      }).join("\n");

      const votedCount = tokens.filter((t: any) => t.status === "cast").length;
      const proxyCount = tokens.filter((t: any) => t.personId && proxyMap.has(t.personId)).length;
      const notVotedCount = tokens.filter((t: any) => t.status !== "cast").length;

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Voter Eligibility Report - ${escHtml(election.title)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; padding: 40px; max-width: 900px; margin: 0 auto; line-height: 1.5; }
    h1 { font-size: 24px; margin-bottom: 4px; }
    h2 { font-size: 18px; margin-top: 28px; margin-bottom: 12px; border-bottom: 2px solid #e5e7eb; padding-bottom: 4px; }
    .subtitle { color: #6b7280; font-size: 14px; margin-bottom: 24px; }
    .summary-bar { display: flex; gap: 24px; margin-bottom: 20px; }
    .summary-item { padding: 12px 20px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb; }
    .summary-item .label { font-size: 12px; color: #6b7280; text-transform: uppercase; }
    .summary-item .value { font-size: 22px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { padding: 8px 12px; border: 1px solid #e5e7eb; font-size: 14px; }
    th { background: #f9fafb; text-align: left; font-weight: 600; }
    .status-voted { color: #16a34a; font-weight: 600; }
    .status-proxy { color: #2563eb; font-weight: 600; }
    .status-not-voted { color: #b91c1c; font-weight: 600; }
    .print-btn { background: #2563eb; color: #fff; border: none; padding: 10px 24px; border-radius: 6px; font-size: 14px; cursor: pointer; margin-top: 24px; }
    .print-btn:hover { background: #1d4ed8; }
    @media print {
      .print-btn { display: none !important; }
      body { padding: 20px; }
      h2 { break-after: avoid; }
      table { break-inside: auto; }
      tr { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>Voter Eligibility Audit Report</h1>
  <p class="subtitle">${escHtml(election.title)} &mdash; Voting Rule: ${escHtml(election.votingRule)}</p>

  <div class="summary-bar">
    <div class="summary-item"><div class="label">Eligible</div><div class="value">${tokens.length}</div></div>
    <div class="summary-item"><div class="label">Voted</div><div class="value status-voted">${votedCount}</div></div>
    <div class="summary-item"><div class="label">Proxies</div><div class="value status-proxy">${proxyCount}</div></div>
    <div class="summary-item"><div class="label">Not Voted</div><div class="value status-not-voted">${notVotedCount}</div></div>
  </div>

  <h2>Voter Detail</h2>
  <table>
    <thead>
      <tr><th>Voter Name</th><th>Unit</th><th>Status</th><th>Vote Timestamp</th></tr>
    </thead>
    <tbody>
      ${voterRows}
    </tbody>
  </table>

  <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>

  <p style="margin-top:32px;font-size:12px;color:#9ca3af;text-align:center;">Generated on ${new Date().toLocaleString()}</p>
</body>
</html>`;

      res.setHeader("Content-Type", "text/html");
      res.send(html);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Audit trail export
  app.get("/api/elections/:id/audit-export", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req, res) => {
    try {
      const election = await storage.getElection(getParam(req.params.id));
      if (!election) return res.status(404).json({ message: "Election not found" });

      const tokens = await storage.getBallotTokens(election.id);
      const casts = await storage.getBallotCasts(election.id);
      const proxies = await storage.getProxyDesignations(election.id);
      const proxyDocs = await storage.getProxyDocuments(election.id);

      const rows: string[][] = [
        ["Election ID", "Title", "Vote Type", "Voting Rule", "Status", "Opens At", "Closes At", "Secret Ballot"],
        [
          election.id,
          election.title,
          election.voteType,
          election.votingRule,
          election.status,
          election.opensAt ? new Date(election.opensAt).toISOString() : "",
          election.closesAt ? new Date(election.closesAt).toISOString() : "",
          election.isSecretBallot ? "YES" : "NO",
        ],
        [],
        ["--- Ballot Tokens ---"],
        ["Token ID", "Person ID", "Unit ID", "Status", "Sent At", "Cast At"],
        ...tokens.map((t) => [
          t.id,
          t.personId ?? "",
          t.unitId ?? "",
          t.status,
          t.sentAt ? new Date(t.sentAt).toISOString() : "",
          t.castAt ? new Date(t.castAt).toISOString() : "",
        ]),
        [],
        ["--- Ballots Cast ---"],
        ["Cast ID", "Person ID", "Unit ID", "Is Proxy", "Proxy For Person", "Proxy For Unit", "Confirmation Ref", "Cast At"],
        ...casts.map((c) => [
          c.id,
          c.personId ?? "",
          c.unitId ?? "",
          c.isProxy ? "YES" : "NO",
          c.proxyForPersonId ?? "",
          c.proxyForUnitId ?? "",
          c.confirmationRef,
          new Date(c.castAt).toISOString(),
        ]),
        [],
        ["--- Proxy Designations ---"],
        ["Proxy ID", "Owner Person ID", "Owner Unit ID", "Proxy Person ID", "Designated At", "Revoked At"],
        ...proxies.map((p) => [
          p.id,
          p.ownerPersonId,
          p.ownerUnitId ?? "",
          p.proxyPersonId,
          new Date(p.designatedAt).toISOString(),
          p.revokedAt ? new Date(p.revokedAt).toISOString() : "",
        ]),
        [],
        ["--- Proxy Documents ---"],
        ["Document ID", "Owner Person ID", "Owner Unit ID", "Title", "Uploaded By", "Created At"],
        ...proxyDocs.map((d) => [
          d.id,
          d.ownerPersonId ?? "",
          d.ownerUnitId ?? "",
          d.title,
          d.uploadedBy ?? "",
          new Date(d.createdAt).toISOString(),
        ]),
      ];

      const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
      const filename = `election-audit-${election.id}.csv`;
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Type", "text/csv");
      res.send(csv);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ────────────────────────────────────────────────────────────────────────────

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

      sendAssociationAdminEmailNotification({
        associationId: result.associationId,
        category: "compliance",
        priority: "realtime",
        excludeEmails: (req as AdminRequest).adminUserEmail ? [(req as AdminRequest).adminUserEmail!] : [],
        email: {
          subject: `Governance task created: ${result.title}`,
          html: `<p>A governance compliance task has been created.</p><p><strong>Title:</strong> ${escapeHtml(result.title)}</p><p><strong>Status:</strong> ${escapeHtml(result.status)}</p>`,
          text: `A governance compliance task has been created.\nTitle: ${result.title}\nStatus: ${result.status}`,
          templateKey: "governance-task-created-admin",
          metadata: { taskId: result.id, associationId: result.associationId },
        },
      }).catch((error) => console.error("[compliance] Failed to send governance task notification:", error));
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

      sendAssociationAdminEmailNotification({
        associationId: result.associationId,
        category: "compliance",
        priority: "realtime",
        excludeEmails: (req as AdminRequest).adminUserEmail ? [(req as AdminRequest).adminUserEmail!] : [],
        email: {
          subject: `Governance task updated: ${result.title}`,
          html: `<p>A governance compliance task has been updated.</p><p><strong>Title:</strong> ${escapeHtml(result.title)}</p><p><strong>Status:</strong> ${escapeHtml(result.status)}</p>`,
          text: `A governance compliance task has been updated.\nTitle: ${result.title}\nStatus: ${result.status}`,
          templateKey: "governance-task-updated-admin",
          metadata: { taskId: result.id, associationId: result.associationId },
        },
      }).catch((error) => console.error("[compliance] Failed to send governance task update notification:", error));
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

      sendAssociationAdminEmailNotification({
        associationId: result.associationId,
        category: "compliance",
        priority: "realtime",
        excludeEmails: req.adminUserEmail ? [req.adminUserEmail] : [],
        email: {
          subject: `Compliance alert override saved`,
          html: `<p>A compliance alert override has been saved.</p><p><strong>Association:</strong> ${escapeHtml(result.associationId)}</p>`,
          text: `A compliance alert override has been saved.\nAssociation: ${result.associationId}`,
          templateKey: "compliance-alert-override-admin",
          metadata: { complianceAlertOverrideId: result.id, associationId: result.associationId },
        },
      }).catch((error) => console.error("[compliance] Failed to send compliance override notification:", error));
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
      const emailProviderReadyGov = isEmailProviderConfigured();

      for (const email of recipientEmails.slice(0, 50)) {
        let sendStatus = "simulated";
        let provider = "simulation";
        let providerMessageId: string | null = null;

        if (emailProviderReadyGov) {
          try {
            const result = await sendPlatformEmail({
              to: email,
              subject,
              html: body,
              associationId: rule.associationId,
            });
            sendStatus = result.status === "sent" ? "sent" : result.status;
            provider = result.provider;
            providerMessageId = result.messageId;
          } catch (_err) {
            sendStatus = "failed";
          }
        }

        const [send] = await db.insert(noticeSends).values({
          associationId: rule.associationId,
          campaignKey,
          recipientEmail: email,
          subjectRendered: subject,
          bodyRendered: body,
          status: sendStatus,
          provider,
          providerMessageId,
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

  // SMS broadcast — send to all opted-in residents of an association
  app.post("/api/communications/send-sms", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getParam(req.body.associationId);
      assertAssociationScope(req, associationId);
      const body: string = typeof req.body.body === "string" ? req.body.body.trim() : "";
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      if (!body) return res.status(400).json({ message: "body is required" });

      // Per-dispatch cap and 24h daily limit per association
      const SMS_DISPATCH_LIMIT = 100;
      const SMS_DAILY_LIMIT = 500;

      // 24h daily rate limit check
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentSmsRows = await db.select().from(communicationHistory).where(
        and(
          eq(communicationHistory.associationId, associationId),
          eq(communicationHistory.channel, "sms"),
          eq(communicationHistory.direction, "outbound"),
          gte(communicationHistory.createdAt, since24h),
        )
      );
      if (recentSmsRows.length >= SMS_DAILY_LIMIT) {
        return res.status(429).json({
          message: `Daily SMS limit reached (${SMS_DAILY_LIMIT} messages per 24 hours). Try again later.`,
          dailyLimit: SMS_DAILY_LIMIT,
          sentLast24h: recentSmsRows.length,
        });
      }
      const remainingDaily = SMS_DAILY_LIMIT - recentSmsRows.length;

      // Resolve the association sending number (per-assoc override or global)
      const tenantCfg = await storage.getTenantConfig(associationId);
      const fromNumber = tenantCfg?.smsFromNumber || null;

      // Resolve association name for SMS template
      const [assocRow] = await db.select({ name: associations.name }).from(associations).where(eq(associations.id, associationId));
      const associationName = assocRow?.name ?? "Your Association";

      // Collect opted-in portal access records with phone numbers
      const accesses = await storage.getPortalAccesses(associationId);
      const allPersons = await storage.getPersons(associationId);
      const personPhoneMap = new Map<string, string>();
      const personNameMap = new Map<string, string>();
      for (const p of allPersons) {
        if (p.phone) personPhoneMap.set(p.id, p.phone);
        personNameMap.set(p.id, `${p.firstName} ${p.lastName}`.trim());
      }

      const optedInCount = accesses.filter((a) => a.smsOptIn === 1 && a.status === "active").length;

      // Apply both per-dispatch and remaining-daily caps
      const effectiveLimit = Math.min(SMS_DISPATCH_LIMIT, remainingDaily);
      const candidates = accesses.filter((a) =>
        a.smsOptIn === 1 &&
        a.status === "active" &&
        personPhoneMap.has(a.personId),
      ).slice(0, effectiveLimit);

      const eligibleCount = candidates.length;

      // Campaign key groups all history records for this dispatch (for delivery receipt drill-down)
      const campaignKey = `sms-broadcast-${associationId}-${Date.now()}`;

      const results: Array<{ personId: string; phone: string; status: string }> = [];
      for (const access of candidates) {
        // Final per-send opt-out guard (TCPA compliance: re-verify before each send)
        const [freshAccess] = await db.select({ smsOptIn: portalAccess.smsOptIn })
          .from(portalAccess)
          .where(eq(portalAccess.id, access.id))
          .limit(1);
        if (!freshAccess || freshAccess.smsOptIn !== 1) {
          results.push({ personId: access.personId, phone: personPhoneMap.get(access.personId)!, status: "opted-out" });
          continue;
        }

        const rawPhone = personPhoneMap.get(access.personId)!;
        const toNumber = normalizePhoneNumber(rawPhone);
        if (!toNumber) {
          results.push({ personId: access.personId, phone: rawPhone, status: "invalid-phone" });
          continue;
        }
        const ownerName = personNameMap.get(access.personId) || "Resident";
        const formattedBody = `Your Condo Manager on behalf of ${associationName} to ${ownerName}\n${body}`;
        const result = await sendSms({ to: toNumber, body: formattedBody, from: fromNumber, associationId });
        await db.insert(communicationHistory).values({
          associationId,
          channel: "sms",
          direction: "outbound",
          subject: body.slice(0, 80),
          bodySnippet: body.slice(0, 200),
          recipientEmail: access.email,
          recipientPersonId: access.personId,
          relatedType: "sms-broadcast",
          relatedId: campaignKey,
          deliveryStatus: result.status,
          metadataJson: { messageSid: result.messageSid, provider: result.provider, status: result.status, fromNumber, toNumber },
        });
        results.push({ personId: access.personId, phone: toNumber, status: result.status });
      }

      const sent = results.filter((r) => r.status === "sent" || r.status === "simulated").length;
      const failed = results.filter((r) => r.status === "failed").length;
      // Count total eligible (opted-in + has phone) before the slice cap was applied
      const totalEligible = accesses.filter((a) =>
        a.smsOptIn === 1 &&
        a.status === "active" &&
        personPhoneMap.has(a.personId),
      ).length;
      res.status(201).json({
        sent,
        failed,
        optedInCount,
        eligibleCount,
        campaignKey,
        rateLimitApplied: totalEligible > SMS_DISPATCH_LIMIT,
        dailyLimitApplied: remainingDaily < totalEligible,
        sentLast24h: recentSmsRows.length,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Web Push broadcast — send to all active push subscriptions of an association
  app.post("/api/communications/send-push", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getParam(req.body.associationId);
      assertAssociationScope(req, associationId);
      const title: string = typeof req.body.title === "string" ? req.body.title.trim() : "";
      const body: string = typeof req.body.body === "string" ? req.body.body.trim() : "";
      const url: string = typeof req.body.url === "string" ? req.body.url.trim() : "/";
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      if (!title || !body) return res.status(400).json({ message: "title and body are required" });

      const subs = await db.select().from(pushSubscriptions)
        .where(and(eq(pushSubscriptions.associationId, associationId), eq(pushSubscriptions.isActive, 1)));

      let sent = 0;
      let failed = 0;
      let expired = 0;

      for (const sub of subs) {
        const result = await sendPushNotification(
          { endpoint: sub.endpoint, p256dhKey: sub.p256dhKey, authKey: sub.authKey },
          { title, body, url, icon: "/favicon.png", tag: `announcement-${Date.now()}` },
        );
        if (result.status === "sent" || result.status === "simulated") {
          sent++;
          await db.insert(communicationHistory).values({
            associationId,
            channel: "push",
            direction: "outbound",
            subject: title,
            bodySnippet: body.slice(0, 200),
            recipientPersonId: sub.personId,
            relatedType: "push-broadcast",
            relatedId: null,
            metadataJson: { endpoint: sub.endpoint.slice(0, 80), status: result.status },
            deliveryStatus: result.status === "sent" ? "delivered" : "simulated",
          });
        } else if (result.status === "expired") {
          expired++;
          // Mark subscription inactive
          await db.update(pushSubscriptions).set({ isActive: 0, updatedAt: new Date() }).where(eq(pushSubscriptions.endpoint, sub.endpoint));
        } else {
          failed++;
        }
      }

      res.status(201).json({ sent, failed, expired, total: subs.length });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Preview push subscription count for an association
  app.get("/api/communications/push-subscriber-count", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      assertAssociationInputScope(req, associationId || null);
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      const subs = await db.select().from(pushSubscriptions)
        .where(and(eq(pushSubscriptions.associationId, associationId), eq(pushSubscriptions.isActive, 1)));
      res.json({ count: subs.length });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Preview SMS recipient count (opted-in with phone numbers)
  app.get("/api/communications/sms-recipient-count", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      assertAssociationInputScope(req, associationId || null);
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      const accesses = await storage.getPortalAccesses(associationId);
      const allPersons = await storage.getPersons(associationId);
      const personPhoneMap = new Map<string, string>();
      for (const p of allPersons) {
        if (p.phone) personPhoneMap.set(p.id, p.phone);
      }
      const optedIn = accesses.filter((a) => a.smsOptIn === 1 && a.status === "active").length;
      const eligible = accesses.filter((a) => a.smsOptIn === 1 && a.status === "active" && personPhoneMap.has(a.personId)).length;
      res.json({ optedIn, eligible });
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
        unitId: req.body.unitId || null,
        residentType: req.body.residentType,
        email: req.body.email || null,
        phone: req.body.phone || null,
        deliveryChannel: req.body.deliveryChannel || "link",
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null,
        createdBy: req.adminUserEmail || null,
      });
      assertAssociationScope(req, parsed.associationId);
      const result = await storage.createOnboardingInvite(parsed);
      res.status(201).json({
        ...result,
        inviteUrl: await resolveInviteUrl(req, result.token),
      });
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
      res.json({
        ...result,
        inviteUrl: await resolveInviteUrl(req, result.token),
      });
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
      res.json({
        ...result,
        inviteUrl: await resolveInviteUrl(req, result.token),
      });
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
      let availableUnits: Array<{ id: string; unitNumber: string; building: string | null }> | null = null;
      if (!invite.unitId) {
        const allUnits = await storage.getUnits(invite.associationId);
        availableUnits = allUnits
          .map((u) => ({ id: u.id, unitNumber: u.unitNumber, building: u.building }))
          .sort((a, b) => {
            if ((a.building || "") !== (b.building || "")) return (a.building || "").localeCompare(b.building || "");
            return a.unitNumber.localeCompare(b.unitNumber);
          });
      }
      res.json({
        id: invite.id,
        associationId: invite.associationId,
        associationName: invite.associationName,
        associationAddress: invite.associationAddress,
        associationCity: invite.associationCity,
        associationState: invite.associationState,
        associationCountry: invite.associationCountry,
        unitId: invite.unitId ?? null,
        unitLabel: invite.unitLabel ?? null,
        unitBuilding: invite.unitBuilding ?? null,
        residentType: invite.residentType,
        status: invite.status,
        email: invite.email,
        phone: invite.phone,
        expiresAt: invite.expiresAt,
        latestSubmissionStatus: latestSubmission?.status ?? null,
        latestSubmissionRejectionReason: latestSubmission?.rejectionReason ?? null,
        availableUnits,
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
        phone: typeof req.body?.phone === "string" ? normalizePhoneNumber(req.body.phone.trim()) || null : null,
        unitId: typeof req.body?.unitId === "string" ? req.body.unitId.trim() || null : null,
        mailingAddress: typeof req.body?.mailingAddress === "string" ? req.body.mailingAddress.trim() || null : null,
        emergencyContactName: typeof req.body?.emergencyContactName === "string" ? req.body.emergencyContactName.trim() || null : null,
        emergencyContactPhone: typeof req.body?.emergencyContactPhone === "string" ? normalizePhoneNumber(req.body.emergencyContactPhone.trim()) || null : null,
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

  app.post("/api/public/demo-request", async (req, res) => {
    try {
      const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
      const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
      const company = typeof req.body?.company === "string" ? req.body.company.trim() : "";
      const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";

      if (!name || !email) {
        return res.status(400).json({ message: "name and email are required" });
      }

      // Validate email format
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: "Invalid email format" });
      }

      // Send email to admin
      const emailBody = `
Demo Request from Your Condo Manager Website

Name: ${name}
Email: ${email}
Company: ${company || "Not provided"}

Message:
${message || "No message provided"}

---
This is an automated demo request from the Your Condo Manager website.
      `.trim();

      const notification = await sendPlatformAdminEmailNotification({
        category: "platformOps",
        priority: "realtime",
        email: {
          subject: `New Demo Request: ${name}`,
          text: emailBody,
          replyTo: email,
        },
      });

      if (notification.recipients.length === 0) {
        await sendPlatformEmail({
          to: "contact@yourcondomanager.org",
          subject: `New Demo Request: ${name}`,
          text: emailBody,
          replyTo: email,
        });
      }

      res.json({ success: true, message: "Demo request submitted successfully" });
    } catch (error: any) {
      console.error("Demo request error:", error);
      res.status(500).json({ message: error.message || "Failed to submit demo request" });
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

  app.delete("/api/work-orders/:id/photos", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const workOrderId = getParam(req.params.id);
      await assertResourceScope(req, "work-order", workOrderId);
      const url = typeof req.body?.url === "string" ? req.body.url : "";
      if (!url) return res.status(400).json({ message: "url is required" });
      const [current] = await db.select().from(workOrders).where(eq(workOrders.id, workOrderId));
      if (!current) return res.status(404).json({ message: "Work order not found" });
      const existingPhotos = Array.isArray(current.photosJson) ? (current.photosJson as any[]) : [];
      const nextPhotos = existingPhotos.filter((p) => p?.url !== url);
      if (nextPhotos.length === existingPhotos.length) {
        return res.status(404).json({ message: "Photo not found" });
      }
      const updated = await storage.updateWorkOrder(workOrderId, { photosJson: nextPhotos } as any, req.adminUserEmail);
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

      sendAssociationAdminEmailNotification({
        associationId: result.associationId,
        category: "inspections",
        priority: "realtime",
        excludeEmails: req.adminUserEmail ? [req.adminUserEmail] : [],
        email: {
          subject: `Inspection logged: ${result.inspectionType}`,
          html: `<p>A new inspection record has been created.</p>
            <p><strong>Inspection type:</strong> ${escapeHtml(result.inspectionType)}</p>
            <p><strong>Inspected at:</strong> ${result.inspectedAt ? escapeHtml(new Date(result.inspectedAt).toLocaleString()) : "Not recorded"}</p>
            <p><strong>Created by:</strong> ${escapeHtml(req.adminUserEmail || "system")}</p>`,
          text: `A new inspection record has been created.\nInspection type: ${result.inspectionType}\nInspected at: ${result.inspectedAt ? new Date(result.inspectedAt).toLocaleString() : "Not recorded"}\nCreated by: ${req.adminUserEmail || "system"}`,
          templateKey: "inspection-created-admin",
          metadata: {
            inspectionId: result.id,
            associationId: result.associationId,
          },
        },
      }).catch((error) => console.error("[inspections] Failed to send inspection admin notification:", error));
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

      sendAssociationAdminEmailNotification({
        associationId: result.associationId,
        category: "announcements",
        priority: "realtime",
        excludeEmails: req.adminUserEmail ? [req.adminUserEmail] : [],
        email: {
          subject: `Announcement published: ${result.title}`,
          html: `<p>A community announcement has been published.</p>
            <p><strong>Title:</strong> ${escapeHtml(result.title)}</p>
            <p><strong>Created by:</strong> ${escapeHtml(req.adminUserEmail || "system")}</p>`,
          text: `A community announcement has been published.\nTitle: ${result.title}\nCreated by: ${req.adminUserEmail || "system"}`,
          templateKey: "announcement-published-admin",
          metadata: {
            announcementId: result.id,
            associationId: result.associationId,
          },
        },
      }).catch((error) => console.error("[announcements] Failed to send announcement admin notification:", error));
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

      sendAssociationAdminEmailNotification({
        associationId: result.associationId,
        category: "associationContext",
        priority: "realtime",
        excludeEmails: (req as AdminRequest).adminUserEmail ? [(req as AdminRequest).adminUserEmail!] : [],
        email: {
          subject: `Association settings updated`,
          html: `<p>Association-level tenant configuration has been updated.</p><p><strong>Portal name:</strong> ${escapeHtml(result.portalName || "Owner Portal")}</p><p><strong>Support email:</strong> ${escapeHtml(result.supportEmail || "Not set")}</p>`,
          text: `Association-level tenant configuration has been updated.\nPortal name: ${result.portalName || "Owner Portal"}\nSupport email: ${result.supportEmail || "Not set"}`,
          templateKey: "association-context-updated-admin",
          metadata: { associationId: result.associationId, tenantConfigId: result.id },
        },
      }).catch((error) => console.error("[association-context] Failed to send tenant config notification:", error));
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
      const normalizedMethodType = methodType || "ach";
      if (!["ach", "check", "zelle", "other"].includes(normalizedMethodType)) {
        return res.status(400).json({ message: "methodType must be ach, check, zelle, or other" });
      }

      // If setting as default, clear existing defaults
      if (req.body.isDefault) {
        await db.update(savedPaymentMethods).set({ isDefault: 0 }).where(
          and(eq(savedPaymentMethods.associationId, req.portalAssociationId!), eq(savedPaymentMethods.personId, req.portalPersonId!))
        );
      }

      const [result] = await db.insert(savedPaymentMethods).values({
        associationId: req.portalAssociationId!,
        personId: req.portalPersonId!,
        methodType: normalizedMethodType as "ach" | "check" | "zelle" | "other",
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

  app.delete("/api/portal/payment-methods/:id", requirePortal, async (req: PortalRequest, res) => {
    try {
      const id = req.params.id as string;
      const [method] = await db.select().from(savedPaymentMethods).where(eq(savedPaymentMethods.id, id)).limit(1);
      if (!method) return res.status(404).json({ message: "Payment method not found" });
      if (method.personId !== req.portalPersonId) return res.status(403).json({ message: "Not authorized" });
      const [result] = await db.update(savedPaymentMethods).set({
        isActive: 0,
        isDefault: 0,
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

  app.get("/api/platform/sms/provider-status", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (_req, res) => {
    try {
      res.json(await getSmsProviderStatus());
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/platform/sms/configure", requireAdmin, requireAdminRole(["platform-admin"]), async (req: AdminRequest, res) => {
    try {
      const { accountSid, authToken, fromNumber, statusCallbackUrl } = req.body ?? {};
      if (accountSid !== undefined) {
        accountSid ? await setSecret("twilio.accountSid", accountSid, req.adminUserEmail) : await deleteSecret("twilio.accountSid");
      }
      if (authToken !== undefined) {
        authToken ? await setSecret("twilio.authToken", authToken, req.adminUserEmail) : await deleteSecret("twilio.authToken");
      }
      if (fromNumber !== undefined) {
        fromNumber ? await setSecret("twilio.fromNumber", fromNumber, req.adminUserEmail) : await deleteSecret("twilio.fromNumber");
      }
      if (statusCallbackUrl !== undefined) {
        statusCallbackUrl ? await setSecret("twilio.statusCallbackUrl", statusCallbackUrl, req.adminUserEmail) : await deleteSecret("twilio.statusCallbackUrl");
      }
      invalidateSecretsCache();
      res.json({ message: "SMS credentials saved", status: await getSmsProviderStatus() });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/platform/push/provider-status", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (_req, res) => {
    try {
      res.json(await getPushProviderStatus());
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/platform/push/configure", requireAdmin, requireAdminRole(["platform-admin"]), async (req: AdminRequest, res) => {
    try {
      const { vapidPublicKey, vapidPrivateKey, vapidSubject } = req.body ?? {};
      if (vapidPublicKey !== undefined) {
        vapidPublicKey ? await setSecret("vapid.publicKey", vapidPublicKey, req.adminUserEmail) : await deleteSecret("vapid.publicKey");
      }
      if (vapidPrivateKey !== undefined) {
        vapidPrivateKey ? await setSecret("vapid.privateKey", vapidPrivateKey, req.adminUserEmail) : await deleteSecret("vapid.privateKey");
      }
      if (vapidSubject !== undefined) {
        vapidSubject ? await setSecret("vapid.subject", vapidSubject, req.adminUserEmail) : await deleteSecret("vapid.subject");
      }
      invalidateSecretsCache();
      res.json({ message: "Push credentials saved", status: await getPushProviderStatus() });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Web Push VAPID public key — served to portal clients so they can subscribe
  app.get("/api/portal/push/vapid-public-key", async (_req, res) => {
    const key = await getVapidPublicKey();
    if (!key) return res.json({ configured: false, publicKey: null });
    res.json({ configured: true, publicKey: key });
  });

  // Register a push subscription from the portal client
  app.post("/api/portal/push/subscribe", requirePortal, async (req: PortalRequest, res) => {
    try {
      if (!req.portalAccessId || !req.portalAssociationId || !req.portalPersonId) {
        return res.status(403).json({ message: "Portal context required" });
      }
      const { endpoint, keys } = req.body ?? {};
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return res.status(400).json({ message: "endpoint, keys.p256dh, and keys.auth are required" });
      }
      const userAgent = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"].slice(0, 300) : null;

      // Upsert subscription by endpoint
      const existing = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint)).limit(1);
      if (existing.length > 0) {
        await db.update(pushSubscriptions)
          .set({ portalAccessId: req.portalAccessId, associationId: req.portalAssociationId, personId: req.portalPersonId, p256dhKey: keys.p256dh, authKey: keys.auth, isActive: 1, updatedAt: new Date() })
          .where(eq(pushSubscriptions.endpoint, endpoint));
      } else {
        await db.insert(pushSubscriptions).values({
          portalAccessId: req.portalAccessId,
          associationId: req.portalAssociationId,
          personId: req.portalPersonId,
          endpoint,
          p256dhKey: keys.p256dh,
          authKey: keys.auth,
          userAgent,
          isActive: 1,
        });
      }
      res.status(201).json({ subscribed: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Unregister a push subscription
  app.post("/api/portal/push/unsubscribe", requirePortal, async (req: PortalRequest, res) => {
    try {
      const { endpoint } = req.body ?? {};
      if (!endpoint) return res.status(400).json({ message: "endpoint is required" });
      await db.update(pushSubscriptions)
        .set({ isActive: 0, updatedAt: new Date() })
        .where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.portalAccessId, req.portalAccessId || "")));
      res.json({ unsubscribed: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
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

      // Sync portal access for every active ownership unit — runs on every login attempt so
      // units added after the first login are automatically provisioned.
      {
        debug("[portal-provision] Starting ownership sync", { email, existingAccessCount: accesses.length });

        const matchingPersons = await db
          .select()
          .from(persons)
          .where(ilike(persons.email, email));

        debug("[portal-provision] Matched persons", { count: matchingPersons.length, personIds: matchingPersons.map((p) => p.id) });

        if (matchingPersons.length > 0) {
          const personIds = matchingPersons.map((p) => p.id);

          const activeOwnerships = await db
            .select({ personId: ownerships.personId, unitId: ownerships.unitId })
            .from(ownerships)
            .where(and(inArray(ownerships.personId, personIds), isNull(ownerships.endDate)));

          debug("[portal-provision] Active ownerships found", { count: activeOwnerships.length, ownerships: activeOwnerships });

          if (activeOwnerships.length > 0) {
            const unitIds = Array.from(new Set(activeOwnerships.map((o) => o.unitId)));

            const unitRows = await db
              .select({ id: units.id, associationId: units.associationId })
              .from(units)
              .where(inArray(units.id, unitIds));

            debug("[portal-provision] Resolved units", { unitRows });

            const unitAssocMap = new Map(unitRows.map((u) => [u.id, u.associationId]));

            // Key by associationId:unitId — one portal_access row per unit per association
            const existingKeys = new Set(accesses.map((a) => `${a.associationId}:${a.unitId ?? ""}`));
            debug("[portal-provision] Existing access keys", { existingKeys: Array.from(existingKeys) });

            for (const o of activeOwnerships) {
              const associationId = unitAssocMap.get(o.unitId);
              if (!associationId) {
                console.warn("[portal-provision] No associationId resolved for unitId", { unitId: o.unitId });
                continue;
              }
              const key = `${associationId}:${o.unitId}`;
              if (existingKeys.has(key)) {
                debug("[portal-provision] Skipping — already provisioned", { key });
                continue;
              }
              await storage.createPortalAccess(
                { associationId, personId: o.personId, unitId: o.unitId, email, role: "owner", status: "active" },
                "system:auto-provision"
              );
              debug("[portal-provision] Created portal access", { email, associationId, unitId: o.unitId });
            }

            // Re-fetch active accesses after any new provisioning
            const refreshed = await storage.getPortalAccessesByEmail(email);
            debug("[portal-provision] Post-sync accesses", { count: refreshed.length, ids: refreshed.map((a) => ({ id: a.id, unitId: a.unitId, status: a.status })) });
            activeAccesses.length = 0;
            activeAccesses.push(
              ...refreshed.filter((a) => {
                if (a.status !== "active" && a.status !== "invited") return false;
                if (a.role !== "board-member" && !a.unitId) return false;
                return true;
              })
            );
          } else {
            console.warn("[portal-provision] No active ownerships found for persons", { personIds });
          }
        } else {
          console.warn("[portal-provision] No person record matched email", { email });
        }
      }

      // Always respond with same message to avoid email enumeration
      if (activeAccesses.length === 0) {
        return res.json({ message: "If an account exists for this email, a login code has been sent." });
      }

      // Generate a 6-digit OTP (one token covers all associations for this email)
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const otpHash = createHmac("sha256", portalOtpSecret).update(otp).digest("hex");
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
      const chosenPortalAccessId = getParam(req.body?.portalAccessId) || null;
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

      const expectedHash = createHmac("sha256", portalOtpSecret).update(otp).digest("hex");
      const match = timingSafeEqual(Buffer.from(expectedHash, "hex"), Buffer.from(token.otpHash, "hex"));
      if (!match) return res.status(400).json({ message: "Invalid login code." });

      // Resolve all active portal accesses for this email
      const allAccesses = await storage.getPortalAccessesByEmail(email);
      const activeAccesses = allAccesses.filter((a) => {
        if (a.status !== "active" && a.status !== "invited") return false;
        // Non-board accounts must have a unit linked — no unit means nothing useful to show
        if (a.role !== "board-member" && !a.unitId) return false;
        return true;
      });
      debug("[portal-verify] Active accesses after OTP", { email, count: activeAccesses.length, accesses: activeAccesses.map((a) => ({ id: a.id, unitId: a.unitId, associationId: a.associationId, status: a.status })) });
      if (activeAccesses.length === 0) return res.status(404).json({ message: "No active portal access found" });

      // Only require a picker when the email spans multiple associations.
      // Owners can choose among units after sign-in from within the portal.
      const distinctAssociationIds = Array.from(new Set(activeAccesses.map((a) => a.associationId)));
      if (distinctAssociationIds.length > 1 && !chosenPortalAccessId && !chosenAssociationId) {
        const assocIds = Array.from(new Set(activeAccesses.map((a) => a.associationId)));
        const unitIds = activeAccesses.map((a) => a.unitId).filter(Boolean) as string[];
        const [allAssocs, unitRows] = await Promise.all([
          storage.getAssociations(),
          unitIds.length > 0 ? db.select().from(units).where(inArray(units.id, unitIds)) : Promise.resolve([]),
        ]);
        const assocMap = new Map(allAssocs.filter((a) => assocIds.includes(a.id)).map((a) => [a.id, a]));
        const unitMap = new Map(unitRows.map((u) => [u.id, u]));
        return res.json({
          associations: activeAccesses.map((a) => ({
            portalAccessId: a.id,
            associationId: a.associationId,
            associationName: assocMap.get(a.associationId)?.name ?? a.associationId,
            associationCity: assocMap.get(a.associationId)?.city ?? null,
            role: a.role,
            email: a.email,
            unitId: a.unitId ?? null,
            unitNumber: a.unitId ? (unitMap.get(a.unitId)?.unitNumber ?? null) : null,
            building: a.unitId ? (unitMap.get(a.unitId)?.building ?? null) : null,
          })),
        });
      }

      // Single association, or owner already picked one
      const access = chosenPortalAccessId
        ? activeAccesses.find((a) => a.id === chosenPortalAccessId)
          : chosenAssociationId
            ? activeAccesses.find((a) => a.associationId === chosenAssociationId)
            : activeAccesses[0];
      if (!access) return res.status(404).json({ message: "No portal access found for that association" });

      // Only consume the OTP once a concrete portal access has been selected.
      await db.update(portalLoginTokens).set({ usedAt: new Date() }).where(eq(portalLoginTokens.id, token.id));

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

    // Fetch the person record so the portal can show current contact info on file
    const [person] = await db.select().from(persons).where(eq(persons.id, access.personId)).limit(1);

    // Fetch active occupants for the unit (tenants + owner-occupants)
    let unitOccupants: Array<{ personId: string; firstName: string; lastName: string; email: string | null; phone: string | null; occupancyType: string }> = [];
    if (access.unitId) {
      const activeOccupancies = await db.select().from(occupancies)
        .where(and(eq(occupancies.unitId, access.unitId), isNull(occupancies.endDate)));
      if (activeOccupancies.length > 0) {
        const occupantPersonIds = activeOccupancies.map((o) => o.personId);
        const occupantPersons = await db.select().from(persons).where(inArray(persons.id, occupantPersonIds));
        const personMap = new Map(occupantPersons.map((p) => [p.id, p]));
        unitOccupants = activeOccupancies.map((o) => {
          const p = personMap.get(o.personId);
          return {
            personId: o.personId,
            firstName: p?.firstName ?? "",
            lastName: p?.lastName ?? "",
            email: p?.email ?? null,
            phone: p?.phone ?? null,
            occupancyType: o.occupancyType,
          };
        });
      }
    }

    res.json({
      ...access,
      hasBoardAccess: Boolean(req.portalHasBoardAccess),
      effectiveRole: req.portalEffectiveRole || access.role,
      boardRoleId: req.portalBoardRoleId ?? access.boardRoleId ?? null,
      unitNumber,
      building,
      // Current contact info on file
      firstName: person?.firstName ?? null,
      lastName: person?.lastName ?? null,
      phone: person?.phone ?? null,
      mailingAddress: person?.mailingAddress ?? null,
      emergencyContactName: person?.emergencyContactName ?? null,
      emergencyContactPhone: person?.emergencyContactPhone ?? null,
      contactPreference: person?.contactPreference ?? null,
      // Active occupants for this unit
      unitOccupants,
    });
  });

  app.patch("/api/portal/me", requirePortal, async (req: PortalRequest, res) => {
    try {
      if (!req.portalPersonId) {
        return res.status(403).json({ message: "Portal person context required" });
      }
      const payload = req.body ?? {};
      const patch: Record<string, string | null> = {};
      if ("phone" in payload) patch.phone = typeof payload.phone === "string" ? normalizePhoneNumber(payload.phone.trim()) || null : null;
      if ("mailingAddress" in payload) patch.mailingAddress = typeof payload.mailingAddress === "string" ? payload.mailingAddress.trim() || null : null;
      if ("emergencyContactName" in payload) patch.emergencyContactName = typeof payload.emergencyContactName === "string" ? payload.emergencyContactName.trim() || null : null;
      if ("emergencyContactPhone" in payload) patch.emergencyContactPhone = typeof payload.emergencyContactPhone === "string" ? normalizePhoneNumber(payload.emergencyContactPhone.trim()) || null : null;
      if ("contactPreference" in payload) patch.contactPreference = typeof payload.contactPreference === "string" ? payload.contactPreference.trim() || null : null;
      if (Object.keys(patch).length === 0) {
        const [person] = await db.select().from(persons).where(eq(persons.id, req.portalPersonId)).limit(1);
        return res.json(person ?? {});
      }
      const result = await storage.updatePerson(req.portalPersonId, patch, req.portalEmail || "portal-user");
      if (!result) return res.status(404).json({ message: "Person not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // SMS opt-in / opt-out for portal residents
  app.patch("/api/portal/me/sms-opt-in", requirePortal, async (req: PortalRequest, res) => {
    try {
      if (!req.portalAccessId) return res.status(403).json({ message: "Portal access required" });
      const optIn = req.body?.smsOptIn;
      if (typeof optIn !== "boolean" && optIn !== 0 && optIn !== 1) {
        return res.status(400).json({ message: "smsOptIn must be true or false" });
      }
      const smsOptInValue = optIn ? 1 : 0;
      const result = await storage.updatePortalAccess(
        req.portalAccessId,
        { smsOptIn: smsOptInValue, smsOptInChangedAt: new Date() },
        req.portalEmail || "portal-user",
      );
      if (!result) return res.status(404).json({ message: "Portal access not found" });
      await db.insert(communicationHistory).values({
        associationId: result.associationId,
        channel: "sms",
        direction: "inbound",
        subject: smsOptInValue ? "SMS opt-in" : "SMS opt-out",
        bodySnippet: smsOptInValue ? "Resident opted in to SMS notifications." : "Resident opted out of SMS notifications.",
        recipientEmail: result.email,
        recipientPersonId: result.personId,
        relatedType: "sms-preference",
        relatedId: result.id,
        metadataJson: { smsOptIn: smsOptInValue, changedVia: "portal-profile" },
      });
      res.json({ smsOptIn: Boolean(result.smsOptIn) });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Twilio STOP/START webhook for inbound SMS opt-out/opt-in
  app.post("/api/webhooks/twilio/sms-status", async (req, res) => {
    try {
      const body = req.body ?? {};
      const from: string = body.From ?? "";
      const msgBody: string = (body.Body ?? "").trim().toUpperCase();
      if (!from) return res.status(200).send("ok");
      const normalized = normalizePhoneNumber(from);
      if (!normalized) return res.status(200).send("ok");
      const allPersons = await db.select().from(persons).where(eq(persons.phone, normalized)).limit(5);
      const personIds = allPersons.map((p) => p.id);
      if (personIds.length > 0) {
        const accesses = await db.select().from(portalAccess).where(inArray(portalAccess.personId, personIds));
        const isOptOut = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(msgBody);
        const isOptIn = ["START", "UNSTOP", "YES"].includes(msgBody);
        if (isOptOut || isOptIn) {
          const smsOptInValue = isOptIn ? 1 : 0;
          for (const access of accesses) {
            await storage.updatePortalAccess(access.id, { smsOptIn: smsOptInValue, smsOptInChangedAt: new Date() }, "twilio-webhook");
            await db.insert(communicationHistory).values({
              associationId: access.associationId,
              channel: "sms",
              direction: "inbound",
              subject: isOptIn ? "SMS opt-in via STOP/START" : "SMS opt-out via STOP/START",
              bodySnippet: `Inbound keyword: ${msgBody}`,
              recipientEmail: access.email,
              recipientPersonId: access.personId,
              relatedType: "sms-preference",
              relatedId: access.id,
              metadataJson: { smsOptIn: smsOptInValue, keyword: msgBody, fromNumber: from, tcpa: true },
            });
          }
        }
      }
      res.status(200).send("ok");
    } catch (error: any) {
      console.error("[twilio-sms-webhook]", error.message);
      res.status(200).send("ok");
    }
  });

  // Twilio Delivery Receipt (DLR) webhook — receives MessageStatus updates
  app.post("/api/webhooks/twilio/sms-delivery", async (req, res) => {
    try {
      const body = req.body ?? {};
      const messageSid: string = body.MessageSid ?? "";
      const messageStatus: string = body.MessageStatus ?? "";
      const toNumber: string = body.To ?? "";
      const fromNumber: string = body.From ?? "";
      const errorCode: string | null = body.ErrorCode ?? null;
      if (!messageSid || !messageStatus) return res.status(200).send("ok");

      const existingLogs = await db.select().from(smsDeliveryLogs).where(eq(smsDeliveryLogs.messageSid, messageSid)).limit(1);
      if (existingLogs.length > 0) {
        await db.update(smsDeliveryLogs)
          .set({ messageStatus, errorCode, rawPayloadJson: body, updatedAt: new Date() })
          .where(eq(smsDeliveryLogs.messageSid, messageSid));
      } else {
        // Resolve associationId from the matching communicationHistory row so
        // admin-scoped DLR queries (which filter by associationId) can find these logs.
        const [matchingHistory] = await db.select({ associationId: communicationHistory.associationId, recipientPersonId: communicationHistory.recipientPersonId })
          .from(communicationHistory)
          .where(
            and(
              eq(communicationHistory.channel, "sms"),
              sql`metadata_json->>'messageSid' = ${messageSid}`,
            ),
          )
          .limit(1);
        await db.insert(smsDeliveryLogs).values({
          messageSid,
          toNumber,
          fromNumber: fromNumber || null,
          messageStatus,
          errorCode,
          rawPayloadJson: body,
          associationId: matchingHistory?.associationId ?? null,
          recipientPersonId: matchingHistory?.recipientPersonId ?? null,
        });
      }

      // Update matching communication_history delivery status
      await db.update(communicationHistory)
        .set({ deliveryStatus: messageStatus, deliveryStatusUpdatedAt: new Date() })
        .where(
          and(
            eq(communicationHistory.channel, "sms"),
            sql`metadata_json->>'messageSid' = ${messageSid}`,
          ),
        );

      res.status(200).send("ok");
    } catch (error: any) {
      console.error("[twilio-dlr-webhook]", error.message);
      res.status(200).send("ok");
    }
  });

  // Admin: view SMS delivery logs for an association
  app.get("/api/communications/sms-delivery-logs", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      assertAssociationInputScope(req as AdminRequest, associationId || null);
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      const logs = await db.select().from(smsDeliveryLogs)
        .where(eq(smsDeliveryLogs.associationId, associationId))
        .orderBy(desc(smsDeliveryLogs.createdAt))
        .limit(200);
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/portal/occupancy", requirePortal, async (req: PortalRequest, res) => {
    try {
      if (!req.portalAssociationId || !req.portalPersonId || !req.portalEmail) {
        return res.status(403).json({ message: "Portal owner context required" });
      }

      const unitId = getParam(req.body?.unitId);
      const occupancyType = req.body?.occupancyType;
      if (!unitId) return res.status(400).json({ message: "unitId is required" });
      if (occupancyType !== "OWNER_OCCUPIED" && occupancyType !== "TENANT") {
        return res.status(400).json({ message: "occupancyType must be OWNER_OCCUPIED or TENANT" });
      }

      const ownedUnits = await getOwnedPortalUnitsForAssociation({
        associationId: req.portalAssociationId,
        personId: req.portalPersonId,
        email: req.portalEmail,
      });
      if (!ownedUnits.some((unit) => unit.unitId === unitId)) {
        return res.status(403).json({ message: "You can only update occupancy for units you own" });
      }

      if (occupancyType === "OWNER_OCCUPIED") {
        const occupancy = await storage.createOccupancy({
          unitId,
          personId: req.portalPersonId,
          occupancyType: "OWNER_OCCUPIED",
          startDate: new Date(),
          endDate: null,
        }, req.portalEmail);
        return res.status(201).json({ occupancy });
      }

      const tenant = req.body?.tenant;
      if (!tenant || typeof tenant !== "object") {
        return res.status(400).json({ message: "tenant details are required for tenant occupancy" });
      }

      const firstName = getParam(tenant.firstName);
      const lastName = getParam(tenant.lastName);
      const email = getParam(tenant.email).trim() || null;
      const phone = normalizePhoneNumber(getParam(tenant.phone).trim()) || null;
      if (!firstName || !lastName) {
        return res.status(400).json({ message: "tenant firstName and lastName are required" });
      }
      if (!email) {
        return res.status(400).json({ message: "tenant email is required" });
      }
      if (!isValidEmailAddress(email)) {
        return res.status(400).json({ message: "tenant email must be a valid email address" });
      }

      let tenantPerson = null;
      if (email) {
        [tenantPerson] = await db
          .select()
          .from(persons)
          .where(and(eq(persons.associationId, req.portalAssociationId), ilike(persons.email, email)))
          .limit(1);
      }
      if (!tenantPerson && phone) {
        [tenantPerson] = await db
          .select()
          .from(persons)
          .where(and(eq(persons.associationId, req.portalAssociationId), eq(persons.phone, phone)))
          .limit(1);
      }

      if (tenantPerson) {
        tenantPerson = (await storage.updatePerson(tenantPerson.id, {
          firstName,
          lastName,
          email,
          phone,
          associationId: req.portalAssociationId,
        }, req.portalEmail)) ?? tenantPerson;
      } else {
        tenantPerson = await storage.createPerson({
          associationId: req.portalAssociationId,
          firstName,
          lastName,
          email,
          phone,
          mailingAddress: null,
          emergencyContactName: null,
          emergencyContactPhone: null,
          contactPreference: email ? "email" : "phone",
        }, req.portalEmail);
      }

      const occupancy = await storage.createOccupancy({
        unitId,
        personId: tenantPerson.id,
        occupancyType: "TENANT",
        startDate: new Date(),
        endDate: null,
      }, req.portalEmail);

      res.status(201).json({ occupancy, person: tenantPerson });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
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
      const ownedCurrentAssociationUnits = req.portalAssociationId && req.portalPersonId
        ? await getOwnedPortalUnitsForAssociation({
          associationId: req.portalAssociationId,
          personId: req.portalPersonId,
          email,
        })
        : [];
      debug("[portal-my-associations]", { email, totalAccesses: accesses.length, activeCount: active.length, active: active.map((a) => ({ id: a.id, unitId: a.unitId, associationId: a.associationId })) });
      const allAssocs = await storage.getAssociations();
      const assocMap = new Map(allAssocs.map((a) => [a.id, a]));
      // Fetch unit info for all accesses that have a unitId
      const unitIds = active.map((a) => a.unitId).filter(Boolean) as string[];
      const unitMap = new Map<string, { unitNumber: string | null; building: string | null }>();
      if (unitIds.length > 0) {
        const unitRows = await db.select().from(units).where(inArray(units.id, unitIds));
        for (const u of unitRows) unitMap.set(u.id, { unitNumber: u.unitNumber, building: u.building });
      }
      const ownedCurrentAssociationEntries = ownedCurrentAssociationUnits.map((unit) => ({
        portalAccessId: unit.portalAccessId,
        associationId: req.portalAssociationId!,
        associationName: assocMap.get(req.portalAssociationId!)?.name ?? req.portalAssociationId!,
        associationCity: assocMap.get(req.portalAssociationId!)?.city ?? null,
        role: "owner",
        email,
        unitId: unit.unitId,
        unitNumber: unit.unitNumber ?? null,
        building: unit.building ?? null,
      }));
      const otherAccessEntries = active
        .filter((a) => a.associationId !== req.portalAssociationId || !a.unitId)
        .map((a) => ({
        portalAccessId: a.id,
        associationId: a.associationId,
        associationName: assocMap.get(a.associationId)?.name ?? a.associationId,
        associationCity: assocMap.get(a.associationId)?.city ?? null,
        role: a.role,
        email: a.email,
        unitId: a.unitId ?? null,
        unitNumber: a.unitId ? (unitMap.get(a.unitId)?.unitNumber ?? null) : null,
        building: a.unitId ? (unitMap.get(a.unitId)?.building ?? null) : null,
      }));

      const combined = Array.from(
        new Map(
          [...otherAccessEntries, ...ownedCurrentAssociationEntries]
            .filter((entry) => entry.portalAccessId)
            .map((entry) => [entry.portalAccessId!, entry]),
        ).values(),
      );

      res.json(combined);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/portal/units-balance", requirePortal, async (req: PortalRequest, res) => {
    try {
      if (!req.portalAssociationId || !req.portalPersonId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const email = req.portalEmail || "";
      const ownedUnits = await getOwnedPortalUnitsForAssociation({
        associationId: req.portalAssociationId,
        personId: req.portalPersonId,
        email,
      });
      const unitIds = ownedUnits.map((unit) => unit.unitId);
      debug("[portal-units-balance]", { email, associationId: req.portalAssociationId, personId: req.portalPersonId, ownedUnitCount: ownedUnits.length, unitIds });
      if (unitIds.length === 0) return res.json([]);
      const allEntries = await storage.getOwnerLedgerEntries(req.portalAssociationId);
      const result = unitIds.map((unitId) => {
        const entries = allEntries.filter((e) => e.personId === req.portalPersonId && e.unitId === unitId);
        const balance = entries.reduce((sum, e) => sum + e.amount, 0);
        const unit = ownedUnits.find((entry) => entry.unitId === unitId);
        return {
          unitId,
          unitNumber: unit?.unitNumber ?? null,
          building: unit?.building ?? null,
          portalAccessId: unit?.portalAccessId ?? null,
          balance,
        };
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/portal/my-units", requirePortal, async (req: PortalRequest, res) => {
    try {
      if (!req.portalAssociationId || !req.portalPersonId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const email = req.portalEmail || "";
      const ownedUnits = await getOwnedPortalUnitsForAssociation({
        associationId: req.portalAssociationId,
        personId: req.portalPersonId,
        email,
      });
      const unitIds = ownedUnits.map((unit) => unit.unitId);
      if (unitIds.length === 0) return res.json([]);

      const [allEntries, allOccupancies] = await Promise.all([
        storage.getOwnerLedgerEntries(req.portalAssociationId),
        db.select().from(occupancies).where(and(inArray(occupancies.unitId, unitIds), isNull(occupancies.endDate))),
      ]);

      // Fetch persons for all occupants in one query
      const occupantPersonIds = Array.from(new Set(allOccupancies.map((o) => o.personId)));
      const occupantPersons = occupantPersonIds.length > 0
        ? await db.select().from(persons).where(inArray(persons.id, occupantPersonIds))
        : [];
      const personMap = new Map(occupantPersons.map((p) => [p.id, p]));
      const unitMap = new Map(ownedUnits.map((u) => [u.unitId, u]));

      const result = unitIds.map((unitId) => {
        const unit = unitMap.get(unitId);
        const entries = allEntries.filter((e) => e.personId === req.portalPersonId && e.unitId === unitId);
        const balance = entries.reduce((sum, e) => sum + e.amount, 0);
        const unitOccupancies = allOccupancies.filter((o) => o.unitId === unitId);
        const occupants = unitOccupancies.map((o) => {
          const p = personMap.get(o.personId);
          return {
            personId: o.personId,
            firstName: p?.firstName ?? "",
            lastName: p?.lastName ?? "",
            email: p?.email ?? null,
            phone: p?.phone ?? null,
            occupancyType: o.occupancyType,
          };
        });
        return {
          unitId,
          portalAccessId: unit?.portalAccessId ?? null,
          unitNumber: unit?.unitNumber ?? null,
          building: unit?.building ?? null,
          squareFootage: unit?.squareFootage ?? null,
          balance,
          occupants,
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
      // For each document, resolve the current version fileUrl and optionally attach version history
      const enriched = await Promise.all(result.map(async (doc) => {
        const versions = await storage.getDocumentVersions(doc.id);
        const currentVersion = versions.find((v) => v.isCurrent) ?? versions[0] ?? null;
        const fileUrl = currentVersion?.fileUrl ?? doc.fileUrl;
        const priorVersions = doc.priorVersionsPortalVisible
          ? versions.map((v) => ({
              id: v.id,
              versionNumber: v.versionNumber,
              title: v.title,
              fileUrl: v.fileUrl,
              effectiveDate: v.effectiveDate,
              amendmentNotes: v.amendmentNotes,
              isCurrent: v.isCurrent,
              createdAt: v.createdAt,
            }))
          : undefined;
        return { ...doc, fileUrl, currentVersionNumber: currentVersion?.versionNumber ?? null, versions: priorVersions };
      }));
      res.json(enriched);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const portalNoticeHtmlToText = (value: string | null | undefined): string => {
    if (!value) return "";

    return value
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6])\s*\/?>/gi, "\n")
      .replace(/<li[^>]*>/gi, "- ")
      .replace(/<\/(ul|ol)>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, "\"")
      .replace(/&#39;/gi, "'")
      .replace(/&mdash;/gi, "—")
      .replace(/\r/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  };

  app.get("/api/portal/notices", requirePortal, async (req: PortalRequest, res) => {
    try {
      const result = await storage.getPortalCommunicationHistory(req.portalAccessId || "");
      const relatedNoticeIds = result
        .filter((row) => row.relatedId && typeof row.relatedId === "string" && (row.relatedType || "").startsWith("notice"))
        .map((row) => row.relatedId!) as string[];
      const noticeBodyById = new Map<string, string>();
      if (relatedNoticeIds.length > 0) {
        const sends = await db
          .select({ id: noticeSends.id, bodyRendered: noticeSends.bodyRendered })
          .from(noticeSends)
          .where(inArray(noticeSends.id, Array.from(new Set(relatedNoticeIds))));
        for (const send of sends) {
          noticeBodyById.set(send.id, send.bodyRendered);
        }
      }
      const noticeRows = result.filter((row) => (row.relatedType || "").startsWith("notice"));
      res.json(noticeRows.map((row) => ({
        ...row,
        bodyText: portalNoticeHtmlToText(row.relatedId ? (noticeBodyById.get(row.relatedId) ?? row.bodySnippet ?? null) : row.bodySnippet),
      })));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/portal/communications", requirePortal, async (req: PortalRequest, res) => {
    try {
      const result = await storage.getPortalCommunicationHistory(req.portalAccessId || "");
      const limitRaw = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 100;
      const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 100;
      res.json(result.slice(0, limit));
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

      if (result.associationId) {
        sendAssociationAdminEmailNotification({
          associationId: result.associationId,
          category: "maintenance",
          priority: "realtime",
          email: {
            subject: `New maintenance request: ${result.title}`,
            html: `<p>A new maintenance request was submitted through the portal.</p>
              <p><strong>Title:</strong> ${escapeHtml(result.title)}</p>
              <p><strong>Priority:</strong> ${escapeHtml(result.priority)}</p>
              <p><strong>Location:</strong> ${escapeHtml(result.locationText || "Not provided")}</p>
              <p><strong>Submitted by:</strong> ${escapeHtml(req.portalEmail || "portal user")}</p>`,
            text: `A new maintenance request was submitted through the portal.\nTitle: ${result.title}\nPriority: ${result.priority}\nLocation: ${result.locationText || "Not provided"}\nSubmitted by: ${req.portalEmail || "portal user"}`,
            templateKey: "maintenance-request-admin",
            metadata: {
              maintenanceRequestId: result.id,
              associationId: result.associationId,
            },
          },
        }).catch((error) => console.error("[maintenance] Failed to send maintenance admin notification:", error));
      }
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
      const ownerUnitId = req.portalUnitId ?? null;
      const [allEntries, activeSchedules, paymentPlansAll] = await Promise.all([
        storage.getOwnerLedgerEntries(req.portalAssociationId),
        // Recurring charge schedules scoped to this owner's unit (or association-wide schedules)
        db.select().from(recurringChargeSchedules).where(
          and(
            eq(recurringChargeSchedules.associationId, req.portalAssociationId),
            eq(recurringChargeSchedules.status, "active"),
            or(
              isNull(recurringChargeSchedules.unitId),
              ownerUnitId ? eq(recurringChargeSchedules.unitId, ownerUnitId) : sql`false`
            )
          )
        ),
        db.select().from(paymentPlans).where(
          and(eq(paymentPlans.associationId, req.portalAssociationId), eq(paymentPlans.personId, req.portalPersonId))
        ),
      ]);
      const myEntries = allEntries.filter((e) => e.personId === req.portalPersonId);
      const balance = myEntries.reduce((sum, e) => sum + e.amount, 0);
      const activePlan = paymentPlansAll.find((p) => p.status === "active") ?? null;
      // Next due date from the soonest upcoming nextRunDate
      const nextDue = activeSchedules
        .map((s) => s.nextRunDate ? new Date(s.nextRunDate) : null)
        .filter(Boolean)
        .sort((a, b) => a!.getTime() - b!.getTime())[0] ?? null;
      res.json({
        balance,
        totalCharged: myEntries.filter((e) => ["charge", "assessment", "late-fee"].includes(e.entryType)).reduce((s, e) => s + e.amount, 0),
        totalPaid: Math.abs(myEntries.filter((e) => ["payment", "credit"].includes(e.entryType)).reduce((s, e) => s + e.amount, 0)),
        feeSchedules: activeSchedules.map((s) => ({ id: s.id, name: s.chargeDescription, amount: s.amount, frequency: s.frequency })),
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
      const classifyBoardActivity = (entityType: string, action: string) => {
        const entity = entityType.toLowerCase();
        const normalizedAction = action.toLowerCase();
        if (entity.includes("portal") || entity.includes("board-role") || normalizedAction.includes("access")) {
          return { lane: "access", laneLabel: "Access" };
        }
        if (entity.includes("meeting") || entity.includes("governance") || entity.includes("board-package")) {
          return { lane: "governance", laneLabel: "Governance" };
        }
        if (entity.includes("ledger") || entity.includes("invoice") || entity.includes("payment") || entity.includes("budget") || entity.includes("utility")) {
          return { lane: "financial", laneLabel: "Financial" };
        }
        if (entity.includes("document") || entity.includes("notice") || entity.includes("communication")) {
          return { lane: "communications", laneLabel: "Communications" };
        }
        if (entity.includes("maintenance") || entity.includes("work-order") || entity.includes("inspection")) {
          return { lane: "operations", laneLabel: "Operations" };
        }
        return { lane: "general", laneLabel: "General" };
      };
      const summarizeAuditEntry = (entry: { entityType: string; action: string; beforeJson: unknown; afterJson: unknown }) => {
        const classification = classifyBoardActivity(entry.entityType, entry.action);
        const before = entry.beforeJson && typeof entry.beforeJson === "object" ? entry.beforeJson as Record<string, unknown> : null;
        const after = entry.afterJson && typeof entry.afterJson === "object" ? entry.afterJson as Record<string, unknown> : null;
        const beforeKeys = before ? Object.keys(before) : [];
        const afterKeys = after ? Object.keys(after) : [];
        const changedFields = Array.from(new Set([...beforeKeys, ...afterKeys])).filter((key) => {
          const beforeValue = before ? JSON.stringify(before[key] ?? null) : "__missing__";
          const afterValue = after ? JSON.stringify(after[key] ?? null) : "__missing__";
          return beforeValue !== afterValue;
        });
        const entityLabel = entry.entityType.replace(/[-_]/g, " ");
        let summary = `${entry.action} ${entityLabel}`.trim();
        if (entry.entityType === "portal-access" && after?.status) {
          summary = `Board access ${String(after.status).replace(/-/g, " ")}`;
        } else if (entry.entityType === "board-package" && after?.status) {
          summary = `Board package ${String(after.status).replace(/-/g, " ")}`;
        } else if (entry.entityType === "governance-meeting" && after?.title) {
          summary = `${entry.action} meeting ${String(after.title)}`;
        } else if (entry.entityType === "document" && after?.title) {
          summary = `${entry.action} document ${String(after.title)}`;
        } else if (entry.entityType === "maintenance-request" && after?.title) {
          summary = `${entry.action} maintenance request ${String(after.title)}`;
        } else if (entry.entityType === "vendor-invoice" && after?.invoiceNumber) {
          summary = `${entry.action} vendor invoice ${String(after.invoiceNumber)}`;
        } else if (entry.entityType === "annual-governance-task" && after?.title) {
          summary = `${entry.action} governance task ${String(after.title)}`;
        }
        return {
          lane: classification.lane,
          laneLabel: classification.laneLabel,
          summary,
          changedFields: changedFields.slice(0, 6),
        };
      };
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
            ...summarizeAuditEntry(entry),
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

  // Session-authenticated board endpoints (for Google sign-in board-admin users)
  app.get("/api/board/overview", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      assertAssociationScope(req, associationId);
      const result = await storage.getAssociationOverview(associationId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/board/dashboard", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getAssociationIdQuery(req);
      if (!associationId) return res.status(400).json({ message: "associationId is required" });
      assertAssociationScope(req, associationId);
      const classifyBoardActivity = (entityType: string, action: string) => {
        const entity = entityType.toLowerCase();
        const normalizedAction = action.toLowerCase();
        if (entity.includes("portal") || entity.includes("board-role") || normalizedAction.includes("access")) return { lane: "access", laneLabel: "Access" };
        if (entity.includes("meeting") || entity.includes("governance") || entity.includes("board-package")) return { lane: "governance", laneLabel: "Governance" };
        if (entity.includes("ledger") || entity.includes("invoice") || entity.includes("payment") || entity.includes("budget") || entity.includes("utility")) return { lane: "financial", laneLabel: "Financial" };
        if (entity.includes("document") || entity.includes("notice") || entity.includes("communication")) return { lane: "communications", laneLabel: "Communications" };
        if (entity.includes("maintenance") || entity.includes("work-order") || entity.includes("inspection")) return { lane: "operations", laneLabel: "Operations" };
        return { lane: "general", laneLabel: "General" };
      };
      const summarizeAuditEntry = (entry: { entityType: string; action: string; beforeJson: unknown; afterJson: unknown }) => {
        const classification = classifyBoardActivity(entry.entityType, entry.action);
        const before = entry.beforeJson && typeof entry.beforeJson === "object" ? entry.beforeJson as Record<string, unknown> : null;
        const after = entry.afterJson && typeof entry.afterJson === "object" ? entry.afterJson as Record<string, unknown> : null;
        const beforeKeys = before ? Object.keys(before) : [];
        const afterKeys = after ? Object.keys(after) : [];
        const changedFields = Array.from(new Set([...beforeKeys, ...afterKeys])).filter((key) => {
          const beforeValue = before ? JSON.stringify(before[key] ?? null) : "__missing__";
          const afterValue = after ? JSON.stringify(after[key] ?? null) : "__missing__";
          return beforeValue !== afterValue;
        });
        const entityLabel = entry.entityType.replace(/[-_]/g, " ");
        let summary = `${entry.action} ${entityLabel}`.trim();
        if (entry.entityType === "portal-access" && after?.status) summary = `Board access ${String(after.status).replace(/-/g, " ")}`;
        else if (entry.entityType === "board-package" && after?.status) summary = `Board package ${String(after.status).replace(/-/g, " ")}`;
        else if (entry.entityType === "governance-meeting" && after?.title) summary = `${entry.action} meeting ${String(after.title)}`;
        else if (entry.entityType === "document" && after?.title) summary = `${entry.action} document ${String(after.title)}`;
        else if (entry.entityType === "maintenance-request" && after?.title) summary = `${entry.action} maintenance request ${String(after.title)}`;
        else if (entry.entityType === "vendor-invoice" && after?.invoiceNumber) summary = `${entry.action} vendor invoice ${String(after.invoiceNumber)}`;
        else if (entry.entityType === "annual-governance-task" && after?.title) summary = `${entry.action} governance task ${String(after.title)}`;
        return { lane: classification.lane, laneLabel: classification.laneLabel, summary, changedFields: changedFields.slice(0, 6) };
      };
      const [overview, budgets, ledgerEntries, vendorInvoices, utilityPayments, governanceMeetings, governanceTasks, auditEntries, documents, maintenanceRequests, noticeSends, boardPackages] = await Promise.all([
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
      ]);
      const totalCharges = ledgerEntries.filter((e) => e.entryType === "charge" || e.entryType === "assessment" || e.entryType === "late-fee").reduce((sum, e) => sum + e.amount, 0);
      const totalPayments = ledgerEntries.filter((e) => e.entryType === "payment" || e.entryType === "credit").reduce((sum, e) => sum + Math.abs(e.amount), 0);
      const openBalance = Math.max(0, totalCharges - totalPayments);
      const totalInvoices = vendorInvoices.reduce((sum, i) => sum + i.amount, 0);
      const totalUtilities = utilityPayments.reduce((sum, p) => sum + p.amount, 0);
      const openTasks = governanceTasks.filter((t) => t.status !== "done");
      const upcomingMeetings = governanceMeetings.filter((m) => new Date(m.scheduledAt) >= new Date()).slice(0, 5);
      const draftMeetings = governanceMeetings.filter((m) => m.summaryStatus === "draft");
      const unpublishedDocuments = documents.filter((d) => d.isPortalVisible !== 1).slice(0, 10);
      const recentMaintenanceRequests = maintenanceRequests.slice(0, 8);
      const urgentOpenMaintenanceCount = maintenanceRequests.filter((r) => (r.priority === "urgent" || r.priority === "high") && r.status !== "resolved" && r.status !== "closed" && r.status !== "rejected").length;
      const attentionItems = [
        ...(overview.maintenanceOverdue > 0 ? [{ key: "maintenance-overdue", label: "Overdue maintenance requires action", detail: `${overview.maintenanceOverdue} maintenance items are overdue.`, tone: "high" }] : []),
        ...(openTasks.filter((t) => t.dueDate && new Date(t.dueDate) < new Date()).length > 0 ? [{ key: "governance-overdue", label: "Governance tasks are overdue", detail: `${openTasks.filter((t) => t.dueDate && new Date(t.dueDate) < new Date()).length} governance tasks are past due.`, tone: "high" }] : []),
        ...(upcomingMeetings.length > 0 ? [{ key: "upcoming-meetings", label: "Meetings need preparation", detail: `${upcomingMeetings.length} upcoming meetings are on the calendar.`, tone: "medium" }] : []),
        ...(draftMeetings.length > 0 ? [{ key: "draft-meetings", label: "Meeting summaries remain in draft", detail: `${draftMeetings.length} meeting records have not been published.`, tone: "medium" }] : []),
        ...(openBalance > 0 ? [{ key: "open-balance", label: "Owner balance exposure is still open", detail: `$${openBalance.toFixed(2)} remains outstanding on the owner ledger.`, tone: "medium" }] : []),
        ...(unpublishedDocuments.length > 0 ? [{ key: "document-visibility", label: "Documents may need board review or publication", detail: `${unpublishedDocuments.length} documents are not portal-visible.`, tone: "low" }] : []),
      ];
      res.json({
        attention: { items: attentionItems, maintenanceOverdue: overview.maintenanceOverdue, overdueGovernanceTasks: openTasks.filter((t) => t.dueDate && new Date(t.dueDate) < new Date()).length, upcomingMeetingCount: upcomingMeetings.length, draftMeetingCount: draftMeetings.length, unpublishedDocumentCount: unpublishedDocuments.length },
        financial: { budgetCount: budgets.length, ledgerEntryCount: ledgerEntries.length, totalCharges, totalPayments, openBalance: Number((totalCharges - totalPayments).toFixed(2)), totalInvoices: Number(totalInvoices.toFixed(2)), totalUtilities: Number(totalUtilities.toFixed(2)), recentLedgerEntries: ledgerEntries.slice(0, 10), recentInvoices: vendorInvoices.slice(0, 10) },
        governance: { meetingCount: governanceMeetings.length, upcomingMeetings: upcomingMeetings.map((m) => ({ id: m.id, title: m.title, scheduledAt: m.scheduledAt.toISOString(), meetingType: m.meetingType, status: m.status, summaryStatus: m.summaryStatus })), taskCount: governanceTasks.length, openTaskCount: openTasks.length, openTasks: openTasks.slice(0, 10).map((t) => ({ id: t.id, title: t.title, dueDate: t.dueDate ? t.dueDate.toISOString() : null, status: t.status })) },
        workflowStates: {
          access: { status: "active", effectiveRole: "board-admin", boardRole: null, boardTerm: null },
          governance: { meetingsByStatus: { scheduled: governanceMeetings.filter((m) => m.status === "scheduled").length, "in-progress": governanceMeetings.filter((m) => m.status === "in-progress").length, completed: governanceMeetings.filter((m) => m.status === "completed").length, cancelled: governanceMeetings.filter((m) => m.status === "cancelled").length }, summariesByStatus: { draft: draftMeetings.length, published: governanceMeetings.filter((m) => m.summaryStatus === "published").length }, tasksByStatus: { todo: governanceTasks.filter((t) => t.status === "todo").length, "in-progress": governanceTasks.filter((t) => t.status === "in-progress").length, done: governanceTasks.filter((t) => t.status === "done").length } },
          maintenance: { requestsByStatus: { submitted: maintenanceRequests.filter((r) => r.status === "submitted").length, triaged: maintenanceRequests.filter((r) => r.status === "triaged").length, "in-progress": maintenanceRequests.filter((r) => r.status === "in-progress").length, resolved: maintenanceRequests.filter((r) => r.status === "resolved").length, closed: maintenanceRequests.filter((r) => r.status === "closed").length, rejected: maintenanceRequests.filter((r) => r.status === "rejected").length }, urgentOpenCount: urgentOpenMaintenanceCount, recent: recentMaintenanceRequests.map((r) => ({ id: r.id, title: r.title, priority: r.priority, status: r.status, responseDueAt: r.responseDueAt ? r.responseDueAt.toISOString() : null, locationText: r.locationText, createdAt: r.createdAt.toISOString() })) },
          communications: { noticesByStatus: noticeSends.reduce<Record<string, number>>((acc, s) => { acc[s.status] = (acc[s.status] ?? 0) + 1; return acc; }, {}), documentsPortalVisible: documents.filter((d) => d.isPortalVisible === 1).length, documentsInternalOnly: documents.filter((d) => d.isPortalVisible !== 1).length, boardPackagesByStatus: { draft: boardPackages.filter((b) => b.status === "draft").length, approved: boardPackages.filter((b) => b.status === "approved").length, distributed: boardPackages.filter((b) => b.status === "distributed").length } },
        },
        activity: { recent: auditEntries.slice(0, 20).map((entry) => ({ id: entry.id, entityType: entry.entityType, action: entry.action, actorEmail: entry.actorEmail, createdAt: entry.createdAt, ...summarizeAuditEntry(entry) })) },
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/portal/board/association", requirePortal, requirePortalBoard, requirePortalBoardReadOnly, async (req: PortalRequest, res) => {
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

  app.post("/api/portal/board/meetings", requirePortal, requirePortalBoard, requirePortalBoardReadOnly, async (req: PortalRequest, res) => {
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

  app.patch("/api/portal/board/meetings/:id", requirePortal, requirePortalBoard, requirePortalBoardReadOnly, async (req: PortalRequest, res) => {
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

  app.post("/api/portal/board/governance-tasks", requirePortal, requirePortalBoard, requirePortalBoardReadOnly, async (req: PortalRequest, res) => {
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

  app.patch("/api/portal/board/governance-tasks/:id", requirePortal, requirePortalBoard, requirePortalBoardReadOnly, async (req: PortalRequest, res) => {
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

  app.post("/api/portal/board/documents", requirePortal, requirePortalBoard, requirePortalBoardReadOnly, upload.single("file"), async (req: PortalRequest, res) => {
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

  app.patch("/api/portal/board/documents/:id", requirePortal, requirePortalBoard, requirePortalBoardReadOnly, async (req: PortalRequest, res) => {
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

  app.post("/api/portal/board/communications/send", requirePortal, requirePortalBoard, requirePortalBoardReadOnly, async (req: PortalRequest, res) => {
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

  app.patch("/api/portal/board/maintenance-requests/:id", requirePortal, requirePortalBoard, requirePortalBoardReadOnly, async (req: PortalRequest, res) => {
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

  app.post("/api/portal/board/vendor-invoices", requirePortal, requirePortalBoard, requirePortalBoardReadOnly, async (req: PortalRequest, res) => {
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

  app.patch("/api/portal/board/vendor-invoices/:id", requirePortal, requirePortalBoard, requirePortalBoardReadOnly, async (req: PortalRequest, res) => {
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

  app.post("/api/portal/board/owner-ledger/entries", requirePortal, requirePortalBoard, requirePortalBoardReadOnly, async (req: PortalRequest, res) => {
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

  app.patch("/api/portal/board/persons/:id", requirePortal, requirePortalBoard, requirePortalBoardReadOnly, async (req: PortalRequest, res) => {
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

  app.patch("/api/portal/board/units/:id", requirePortal, requirePortalBoard, requirePortalBoardReadOnly, async (req: PortalRequest, res) => {
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

  app.post("/api/portal/board/roles", requirePortal, requirePortalBoard, requirePortalBoardReadOnly, async (req: PortalRequest, res) => {
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
      const targetAdminUserId = getParam(req.params.id);
      const isActive = req.body?.isActive;
      if (typeof isActive !== "boolean") {
        return res.status(400).json({ message: "isActive must be a boolean" });
      }
      if (req.adminUserId === targetAdminUserId) {
        return res.status(400).json({ message: "Cannot change your own active status" });
      }
      const result = await storage.setAdminUserActive(
        targetAdminUserId,
        isActive,
        req.adminUserEmail || "system",
      );
      if (!result) return res.status(404).json({ message: "Admin user not found" });
      res.json(result);

      sendDirectAdminEmailNotification({
        adminUserId: result.id,
        category: "adminAccess",
        priority: "realtime",
        email: {
          subject: `Your Condo Manager admin access has been ${isActive ? "enabled" : "disabled"}`,
          html: `<p>Your Condo Manager admin account access has been <strong>${isActive ? "enabled" : "disabled"}</strong>.</p>
            <p>Changed by: ${req.adminUserEmail || "system"}</p>`,
          text: `Your Condo Manager admin account access has been ${isActive ? "enabled" : "disabled"}.\nChanged by: ${req.adminUserEmail || "system"}`,
        },
      }).catch((error) => console.error("[admin-access] Failed to send active status notification:", error));
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/admin/users/:id/role", requireAdmin, requireAdminRole(["platform-admin"]), async (req: AdminRequest, res) => {
    try {
      const targetAdminUserId = getParam(req.params.id);
      const role = req.body?.role;
      const allowedRoles = ["platform-admin", "board-admin", "manager", "viewer"];
      if (!allowedRoles.includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }
      const reason = req.body?.reason;
      const result = await storage.updateAdminUserRole(
        targetAdminUserId,
        role as "platform-admin" | "board-admin" | "manager" | "viewer",
        req.adminUserEmail || "system",
        reason,
      );
      if (!result) return res.status(404).json({ message: "Admin user not found" });
      res.json(result);

      sendDirectAdminEmailNotification({
        adminUserId: result.id,
        category: "adminAccess",
        priority: "realtime",
        email: {
          subject: `Your Condo Manager admin role is now ${role}`,
          html: `<p>Your Condo Manager admin role has been updated to <strong>${role}</strong>.</p>
            <p>Changed by: ${req.adminUserEmail || "system"}</p>
            <p>Reason: ${typeof reason === "string" && reason.trim() ? reason.trim() : "No reason provided"}</p>`,
          text: `Your Condo Manager admin role has been updated to ${role}.\nChanged by: ${req.adminUserEmail || "system"}\nReason: ${typeof reason === "string" && reason.trim() ? reason.trim() : "No reason provided"}`,
        },
      }).catch((error) => console.error("[admin-access] Failed to send role change notification:", error));
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // ── Admin notification preferences (per-user) ───────────────────────────────

  app.get("/api/admin/me/preferences", requireAdmin, async (req: AdminRequest, res) => {
    try {
      const adminUserId = req.adminUserId;
      if (!adminUserId) return res.status(401).json({ message: "Not authenticated" });
      const [prefs] = await db.select().from(adminUserPreferences).where(eq(adminUserPreferences.adminUserId, adminUserId)).limit(1);
      if (!prefs) {
        return res.json(normalizeAdminNotificationPreferences(undefined));
      }
      res.json(normalizeAdminNotificationPreferences({
        emailNotifications: prefs.emailNotifications,
        pushNotifications: prefs.pushNotifications,
        desktopNotifications: prefs.desktopNotifications,
        alertDigest: prefs.alertDigest as any,
        quietHoursEnabled: prefs.quietHoursEnabled,
        quietHoursStart: prefs.quietHoursStart,
        quietHoursEnd: prefs.quietHoursEnd,
        notificationCategoryPreferences: (prefs.notificationCategoryPreferencesJson ?? {}) as Record<string, boolean>,
      }));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/admin/me/preferences", requireAdmin, async (req: AdminRequest, res) => {
    try {
      const adminUserId = req.adminUserId;
      if (!adminUserId) return res.status(401).json({ message: "Not authenticated" });
      const normalized = normalizeAdminNotificationPreferences(req.body ?? {});
      const updatePayload = {
        emailNotifications: normalized.emailNotifications ? 1 : 0,
        pushNotifications: normalized.pushNotifications ? 1 : 0,
        desktopNotifications: normalized.desktopNotifications ? 1 : 0,
        alertDigest: normalized.alertDigest,
        quietHoursEnabled: normalized.quietHoursEnabled ? 1 : 0,
        quietHoursStart: normalized.quietHoursStart,
        quietHoursEnd: normalized.quietHoursEnd,
        notificationCategoryPreferencesJson: normalized.notificationCategoryPreferences,
        updatedAt: new Date(),
      };

      const [existing] = await db.select().from(adminUserPreferences).where(eq(adminUserPreferences.adminUserId, adminUserId)).limit(1);
      if (existing) {
        const [updated] = await db.update(adminUserPreferences)
          .set(updatePayload)
          .where(eq(adminUserPreferences.id, existing.id))
          .returning();
        return res.json(normalizeAdminNotificationPreferences({
          emailNotifications: updated.emailNotifications,
          pushNotifications: updated.pushNotifications,
          desktopNotifications: updated.desktopNotifications,
          alertDigest: updated.alertDigest as any,
          quietHoursEnabled: updated.quietHoursEnabled,
          quietHoursStart: updated.quietHoursStart,
          quietHoursEnd: updated.quietHoursEnd,
          notificationCategoryPreferences: (updated.notificationCategoryPreferencesJson ?? {}) as Record<string, boolean>,
        }));
      }
      const [created] = await db.insert(adminUserPreferences)
        .values({
          adminUserId,
          emailNotifications: updatePayload.emailNotifications,
          pushNotifications: updatePayload.pushNotifications,
          desktopNotifications: updatePayload.desktopNotifications,
          alertDigest: updatePayload.alertDigest,
          quietHoursEnabled: updatePayload.quietHoursEnabled,
          quietHoursStart: updatePayload.quietHoursStart,
          quietHoursEnd: updatePayload.quietHoursEnd,
          notificationCategoryPreferencesJson: updatePayload.notificationCategoryPreferencesJson,
        })
        .returning();
      res.status(201).json(normalizeAdminNotificationPreferences({
        emailNotifications: created.emailNotifications,
        pushNotifications: created.pushNotifications,
        desktopNotifications: created.desktopNotifications,
        alertDigest: created.alertDigest as any,
        quietHoursEnabled: created.quietHoursEnabled,
        quietHoursStart: created.quietHoursStart,
        quietHoursEnd: created.quietHoursEnd,
        notificationCategoryPreferences: (created.notificationCategoryPreferencesJson ?? {}) as Record<string, boolean>,
      }));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
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

  // ── Platform Billing / Subscription Routes ──────────────────────────────────

  // Helper: make a Stripe API call using the platform secret key
  async function stripeRequest(method: string, path: string, body?: URLSearchParams): Promise<Record<string, unknown>> {
    const secretKey = await getSecret("PLATFORM_STRIPE_SECRET_KEY", "platform_stripe_secret_key");
    if (!secretKey) throw new Error("Platform Stripe key not configured");
    const resp = await fetch(`https://api.stripe.com/v1${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body?.toString(),
    });
    const data = await resp.json().catch(() => ({})) as Record<string, unknown>;
    if (!resp.ok) {
      const errMsg = (data.error as any)?.message ?? `Stripe error ${resp.status}`;
      throw new Error(errMsg);
    }
    return data;
  }

  // Provision a new workspace after successful checkout
  async function provisionWorkspace(sessionData: Record<string, unknown>): Promise<void> {
    const meta = (sessionData.metadata ?? {}) as Record<string, string>;
    const associationId = meta.associationId;
    const adminUserId = meta.adminUserId;
    const plan = (meta.plan ?? "self-managed") as "self-managed" | "property-manager" | "enterprise";
    if (!associationId || !adminUserId) return;

    // Idempotency: skip if already provisioned
    const existing = await storage.getPlatformSubscription(associationId);
    if (existing) return;

    const customerId = typeof sessionData.customer === "string" ? sessionData.customer : "";
    const subscription = sessionData.subscription as Record<string, unknown> | null;
    const subId = typeof subscription?.id === "string" ? subscription.id : null;
    const trialEnd = typeof subscription?.trial_end === "number" ? new Date(subscription.trial_end * 1000) : null;
    const periodEnd = typeof subscription?.current_period_end === "number" ? new Date(subscription.current_period_end * 1000) : null;
    const status = trialEnd ? "trialing" : "active";

    const adminUser = await db.select().from(adminUsers).where(eq(adminUsers.id, adminUserId)).then(r => r[0]);
    if (!adminUser) return;

    await db.update(adminUsers).set({ isActive: 1 }).where(eq(adminUsers.id, adminUserId));

    await storage.createPlatformSubscription({
      associationId,
      plan,
      status: status as any,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subId,
      currentPeriodEnd: periodEnd,
      trialEndsAt: trialEnd,
      adminEmail: adminUser.email,
    });

    // Create TenantConfig if missing
    const existingConfig = await db.select().from(tenantConfigs).where(eq(tenantConfigs.associationId, associationId)).then(r => r[0]);
    if (!existingConfig) {
      await db.insert(tenantConfigs).values({ associationId, portalName: "Owner Portal", supportEmail: adminUser.email }).catch(() => {});
    }
  }

  // GET /api/admin/billing/subscription — current subscription for the active association
  app.get("/api/admin/billing/subscription", requireAdmin, async (req: AdminRequest, res) => {
    try {
      const associationId = (req.adminScopedAssociationIds?.[0]) ?? req.query.associationId as string;
      if (!associationId) return res.json({ status: "none" });
      const sub = await storage.getPlatformSubscription(associationId);
      if (!sub) return res.json({ status: "none" });
      res.json(sub);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/admin/billing/portal-session — Stripe Customer Portal redirect
  app.post("/api/admin/billing/portal-session", requireAdmin, async (req: AdminRequest, res) => {
    try {
      const associationId = req.adminScopedAssociationIds?.[0];
      if (!associationId) return res.status(400).json({ message: "No association context" });
      const sub = await storage.getPlatformSubscription(associationId);
      if (!sub?.stripeCustomerId) return res.status(400).json({ message: "No billing account found" });
      const baseUrl = (await getSecret("APP_BASE_URL", "app_base_url")) ?? "https://app.yourcondomanager.org";
      const params = new URLSearchParams({ customer: sub.stripeCustomerId, return_url: `${baseUrl}/app/platform/controls` });
      const session = await stripeRequest("POST", "/billing_portal/sessions", params);
      res.json({ url: session.url });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // GET /api/platform/billing/summary — platform-admin MRR dashboard
  app.get("/api/platform/billing/summary", requireAdmin, requireAdminRole(["platform-admin"]), async (_req, res) => {
    try {
      const subs = await storage.listPlatformSubscriptions();
      const planPrice: Record<string, number> = { "self-managed": 99, "property-manager": 449, "enterprise": 0 };
      const active = subs.filter(s => s.status === "active").length;
      const trialing = subs.filter(s => s.status === "trialing").length;
      const pastDue = subs.filter(s => s.status === "past_due").length;
      const canceled = subs.filter(s => s.status === "canceled").length;
      const mrr = subs.filter(s => ["active", "past_due"].includes(s.status)).reduce((n, s) => n + (planPrice[s.plan] ?? 0), 0);
      const byPlan = {
        selfManaged: subs.filter(s => s.plan === "self-managed").length,
        propertyManager: subs.filter(s => s.plan === "property-manager").length,
        enterprise: subs.filter(s => s.plan === "enterprise").length,
      };
      res.json({ total: subs.length, active, trialing, pastDue, canceled, mrr, byPlan });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/platform/billing/configure — save platform Stripe config to secrets store
  app.post("/api/platform/billing/configure", requireAdmin, requireAdminRole(["platform-admin"]), async (req, res) => {
    try {
      const { secretKey, publishableKey, webhookSecret, planPriceIdsJson, appBaseUrl } = req.body as Record<string, string>;
      if (secretKey?.trim()) await setSecret("platform_stripe_secret_key", secretKey.trim());
      if (publishableKey?.trim()) await setSecret("platform_stripe_publishable_key", publishableKey.trim());
      if (webhookSecret?.trim()) await setSecret("platform_stripe_webhook_secret", webhookSecret.trim());
      if (planPriceIdsJson?.trim()) await setSecret("stripe_plan_price_ids", planPriceIdsJson.trim());
      if (appBaseUrl?.trim()) await setSecret("app_base_url", appBaseUrl.trim());
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/public/signup/start — create Stripe customer + checkout session
  app.post("/api/public/signup/start", async (req, res) => {
    try {
      const { name, email, organizationName, associationType, unitCount, plan } = req.body as Record<string, string>;
      if (!name || !email || !organizationName || !plan) return res.status(400).json({ message: "name, email, organizationName, and plan are required" });

      // Enterprise → contact sales
      if (plan === "enterprise") return res.json({ enterpriseContact: true });

      const secretKey = await getSecret("PLATFORM_STRIPE_SECRET_KEY", "platform_stripe_secret_key");
      if (!secretKey) return res.status(503).json({ message: "Billing not configured" });

      const priceIdsRaw = await getSecret("STRIPE_PLAN_PRICE_IDS", "stripe_plan_price_ids");
      const priceIds = priceIdsRaw ? JSON.parse(priceIdsRaw) as Record<string, string> : {};
      const priceId = priceIds[plan];
      if (!priceId) return res.status(503).json({ message: "Plan pricing not configured" });

      // Check for existing account
      const existingUser = await db.select().from(adminUsers).where(eq(adminUsers.email, email.toLowerCase().trim())).then(r => r[0]);
      if (existingUser) return res.status(409).json({ message: "An account with this email already exists." });

      // Create Stripe customer
      const customerParams = new URLSearchParams({ email: email.trim(), name: name.trim() });
      customerParams.set("metadata[organizationName]", organizationName);
      customerParams.set("metadata[plan]", plan);
      const customer = await stripeRequest("POST", "/customers", customerParams);
      const customerId = customer.id as string;

      // Create stub association + admin user
      const [assoc] = await db.insert(associations).values({ name: organizationName, associationType: associationType || "HOA", address: "TBD", city: "TBD", state: "TBD", country: "USA" }).returning();
      const [adminUser] = await db.insert(adminUsers).values({ email: email.toLowerCase().trim(), role: "platform-admin", isActive: 0 }).returning();

      // Create Stripe Checkout Session
      const baseUrl = (await getSecret("APP_BASE_URL", "app_base_url")) ?? "https://app.yourcondomanager.org";
      const sessionParams = new URLSearchParams({
        mode: "subscription",
        payment_method_collection: "if_required",
        customer: customerId,
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": "1",
        "subscription_data[trial_period_days]": "14",
        success_url: `${baseUrl}/signup/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/pricing`,
      });
      sessionParams.set("subscription_data[metadata][associationId]", assoc.id);
      sessionParams.set("subscription_data[metadata][adminUserId]", adminUser.id);
      sessionParams.set("subscription_data[metadata][plan]", plan);
      sessionParams.set("metadata[associationId]", assoc.id);
      sessionParams.set("metadata[adminUserId]", adminUser.id);
      sessionParams.set("metadata[plan]", plan);

      const session = await stripeRequest("POST", "/checkout/sessions", sessionParams);
      res.json({ checkoutUrl: session.url, sessionId: session.id });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // GET /api/public/signup/complete — provision workspace after checkout
  app.get("/api/public/signup/complete", async (req, res) => {
    try {
      const sessionId = req.query.session_id as string;
      if (!sessionId) return res.status(400).json({ message: "session_id required" });
      const session = await stripeRequest("GET", `/checkout/sessions/${sessionId}?expand[]=subscription`);
      if (session.status !== "complete" && (session as any).payment_status !== "no_payment_required" && (session as any).payment_status !== "paid") {
        return res.status(400).json({ message: "Checkout not completed" });
      }
      await provisionWorkspace(session);
      const meta = (session.metadata ?? {}) as Record<string, string>;
      const adminUser = meta.adminUserId ? await db.select().from(adminUsers).where(eq(adminUsers.id, meta.adminUserId)).then(r => r[0]) : null;
      res.json({ success: true, email: adminUser?.email ?? null, associationId: meta.associationId });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/webhooks/platform/stripe — Stripe lifecycle events
  app.post("/api/webhooks/platform/stripe", async (req, res) => {
    try {
      const stripeSignature = req.header("stripe-signature");
      const webhookSecret = await getSecret("PLATFORM_STRIPE_WEBHOOK_SECRET", "platform_stripe_webhook_secret");

      if (stripeSignature && webhookSecret) {
        const rawBody = Buffer.isBuffer((req as any).rawBody) ? (req as any).rawBody.toString("utf8") : JSON.stringify(req.body);
        const { timestamp, signature } = parseStripeSignature(stripeSignature);
        if (timestamp && signature) {
          const expected = createHmac("sha256", webhookSecret).update(`${timestamp}.${rawBody}`).digest("hex");
          const expectedBuf = Buffer.from(expected, "utf8");
          const providedBuf = Buffer.from(signature, "utf8");
          if (expectedBuf.length !== providedBuf.length || !timingSafeEqual(expectedBuf, providedBuf)) {
            return res.status(403).json({ message: "Invalid webhook signature" });
          }
        }
      }

      const event = req.body as Record<string, unknown>;
      const eventId = event.id as string;
      const eventType = event.type as string;
      const eventObj = (event.data && typeof event.data === "object" ? (event.data as any).object : {}) as Record<string, unknown>;

      // Upsert webhook event record (idempotent)
      await db.insert(platformWebhookEvents).values({
        providerEventId: eventId,
        eventType,
        status: "received",
        rawPayloadJson: JSON.stringify(event),
      }).onConflictDoNothing();

      let processed = false;

      if (eventType === "checkout.session.completed") {
        await provisionWorkspace(eventObj);
        processed = true;
      } else if (eventType === "customer.subscription.updated" || eventType === "customer.subscription.deleted") {
        const subId = eventObj.id as string;
        const sub = await storage.getPlatformSubscriptionByStripeId(subId);
        if (sub) {
          const statusMap: Record<string, string> = { active: "active", trialing: "trialing", past_due: "past_due", canceled: "canceled", unpaid: "unpaid", incomplete: "incomplete" };
          const newStatus = eventType === "customer.subscription.deleted" ? "canceled" : (statusMap[eventObj.status as string] ?? sub.status);
          const periodEnd = typeof eventObj.current_period_end === "number" ? new Date(eventObj.current_period_end * 1000) : undefined;
          const trialEnd = typeof eventObj.trial_end === "number" ? new Date(eventObj.trial_end * 1000) : undefined;
          const cancelAtEnd = (eventObj.cancel_at_period_end as boolean) ? 1 : 0;
          await storage.updatePlatformSubscription(sub.id, { status: newStatus as any, currentPeriodEnd: periodEnd, trialEndsAt: trialEnd, cancelAtPeriodEnd: cancelAtEnd });
        }
        processed = true;
      } else if (eventType === "invoice.payment_succeeded") {
        const subId = (eventObj.subscription as string) ?? null;
        if (subId) {
          const sub = await storage.getPlatformSubscriptionByStripeId(subId);
          if (sub) await storage.updatePlatformSubscription(sub.id, { status: "active" });
        }
        processed = true;
      } else if (eventType === "invoice.payment_failed") {
        const subId = (eventObj.subscription as string) ?? null;
        if (subId) {
          const sub = await storage.getPlatformSubscriptionByStripeId(subId);
          if (sub) {
            await storage.updatePlatformSubscription(sub.id, { status: "past_due" });
            // Send dunning email
            const assocAdminEmail = sub.adminEmail;
            if (assocAdminEmail) {
              await sendPlatformEmail({
                to: assocAdminEmail,
                subject: "Action required: payment failed for your Your Condo Manager subscription",
                html: `<p>Hi,</p><p>We were unable to process your payment for your <strong>${sub.plan}</strong> Your Condo Manager subscription.</p><p>Please update your payment method to continue using Your Condo Manager without interruption.</p><p><a href="https://app.yourcondomanager.org/app/platform/controls">Update payment method →</a></p>`,
                text: `Your Condo Manager ${sub.plan} subscription payment failed. Please update your payment method at https://app.yourcondomanager.org/app/platform/controls`,
              }).catch(() => {});
            }
          }
        }
        processed = true;
      }

      await db.update(platformWebhookEvents)
        .set({ status: processed ? "processed" : "ignored", processedAt: new Date() })
        .where(eq(platformWebhookEvents.providerEventId, eventId));

      res.json({ received: true });
    } catch (e: any) {
      console.error("Platform webhook error:", e.message);
      res.status(500).json({ message: e.message });
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

  app.post("/api/admin/contextual-feedback", requireAdmin, requireAdminRole(["platform-admin"]), async (req: AdminRequest, res) => {
    try {
      const parsed = adminContextualFeedbackSchema.parse(req.body);
      const { project, workstream } = await ensureAdminContextualFeedbackRoadmapTarget();

      const adminIdentity = [req.adminUserEmail || null, req.adminUserId ? `id:${req.adminUserId}` : null].filter(Boolean).join(" · ");
      const titlePrefix = parsed.feedbackType === "bug" ? "[Feedback Bug]" : "[Feedback Enhancement]";
      const routeLabel = parsed.context.route.length > 48 ? `${parsed.context.route.slice(0, 45)}...` : parsed.context.route;
      const description = [
        parsed.description.trim(),
        "",
        "Context",
        `- route: ${parsed.context.route}`,
        `- selector: ${parsed.context.selector}`,
        `- domPath: ${parsed.context.domPath}`,
        `- elementLabel: ${parsed.context.elementLabel}`,
        `- componentName: ${parsed.context.componentName || "unknown"}`,
        `- nodeName: ${parsed.context.nodeName}`,
        `- className: ${parsed.context.className || "none"}`,
        `- bounds: top=${parsed.context.bounds.top}, left=${parsed.context.bounds.left}, width=${parsed.context.bounds.width}, height=${parsed.context.bounds.height}`,
        `- scroll: x=${parsed.context.scroll.x}, y=${parsed.context.scroll.y}`,
        `- viewport: width=${parsed.context.viewport.width}, height=${parsed.context.viewport.height}`,
        `- timestamp: ${parsed.context.timestamp}`,
        `- admin: ${adminIdentity || "unknown"}`,
        ...(parsed.context.textPreview ? [`- textPreview: ${parsed.context.textPreview}`] : []),
      ].join("\n");

      const task = await storage.createRoadmapTask({
        projectId: project.id,
        workstreamId: workstream.id,
        title: `${titlePrefix} ${routeLabel} - ${parsed.title.trim()}`.slice(0, 200),
        description,
        status: "todo",
        priority: parsed.priority,
        effort: null,
        dependencyTaskIds: [],
        targetStartDate: null,
        targetEndDate: null,
      });

      let screenshotAttachment = null;
      if (parsed.screenshotBase64) {
        try {
          const match = parsed.screenshotBase64.match(/^data:(image\/\w+);base64,(.+)$/);
          if (match) {
            const mimeType = match[1];
            const ext = mimeType === "image/png" ? "png" : mimeType === "image/jpeg" ? "jpg" : "webp";
            const buffer = Buffer.from(match[2], "base64");
            const filename = `feedback-${task.id}-${Date.now()}.${ext}`;
            const filePath = path.join(uploadDir, filename);
            fs.writeFileSync(filePath, buffer);
            screenshotAttachment = await storage.createRoadmapTaskAttachment({
              taskId: task.id,
              fileUrl: `/api/uploads/${filename}`,
              fileName: `screenshot.${ext}`,
              mimeType,
              sizeBytes: buffer.length,
              uploadedBy: req.adminUserEmail || null,
            });
          }
        } catch {
          // Screenshot saving is best-effort; do not fail ticket creation
        }
      }

      res.status(201).json({
        task: {
          id: task.id,
          title: task.title,
          status: task.status,
          projectId: task.projectId,
          workstreamId: task.workstreamId,
        },
        targetProject: {
          id: project.id,
          title: project.title,
        },
        targetWorkstream: {
          id: workstream.id,
          title: workstream.title,
        },
        screenshot: screenshotAttachment ? {
          id: screenshotAttachment.id,
          fileUrl: screenshotAttachment.fileUrl,
        } : null,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
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

  app.get("/api/admin/projects/:projectId", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const result = await storage.getRoadmapProject(getParam(req.params.projectId));
      if (!result) return res.status(404).json({ message: "Project not found" });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/workstreams/:workstreamId", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const result = await storage.getRoadmapWorkstream(getParam(req.params.workstreamId));
      if (!result) return res.status(404).json({ message: "Workstream not found" });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/tasks/:taskId", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const result = await storage.getRoadmapTask(getParam(req.params.taskId));
      if (!result) return res.status(404).json({ message: "Task not found" });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/admin/projects/:projectId", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const result = await storage.getRoadmapProject(getParam(req.params.projectId));
      if (!result) return res.status(404).json({ message: "Project not found" });
      await storage.deleteRoadmapProject(getParam(req.params.projectId));
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/admin/workstreams/:workstreamId", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const result = await storage.getRoadmapWorkstream(getParam(req.params.workstreamId));
      if (!result) return res.status(404).json({ message: "Workstream not found" });
      await storage.deleteRoadmapWorkstream(getParam(req.params.workstreamId));
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/admin/tasks/:taskId", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const result = await storage.getRoadmapTask(getParam(req.params.taskId));
      if (!result) return res.status(404).json({ message: "Task not found" });
      await storage.deleteRoadmapTask(getParam(req.params.taskId));
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/tasks/:taskId/attachments", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req, res) => {
    try {
      const task = await storage.getRoadmapTask(getParam(req.params.taskId));
      if (!task) return res.status(404).json({ message: "Task not found" });
      const attachments = await storage.getRoadmapTaskAttachments(task.id);
      res.json({ attachments });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/tasks/:taskId/attachments", requireAdmin, requireAdminRole(["platform-admin"]), upload.single("file"), async (req: AdminRequest, res) => {
    try {
      const task = await storage.getRoadmapTask(getParam(req.params.taskId));
      if (!task) return res.status(404).json({ message: "Task not found" });

      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file) return res.status(400).json({ message: "No file uploaded" });

      const allowedMimeTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"];
      if (!allowedMimeTypes.includes(file.mimetype)) {
        fs.unlinkSync(file.path);
        return res.status(400).json({ message: "Only image files (PNG, JPEG, WebP, GIF) are allowed" });
      }

      const attachment = await storage.createRoadmapTaskAttachment({
        taskId: task.id,
        fileUrl: `/api/uploads/${file.filename}`,
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        uploadedBy: req.adminUserEmail || null,
      });

      res.status(201).json(attachment);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/admin/tasks/:taskId/attachments/:attachmentId", requireAdmin, requireAdminRole(["platform-admin"]), async (req, res) => {
    try {
      await storage.deleteRoadmapTaskAttachment(getParam(req.params.attachmentId));
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
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


  // ── Vendor Portal ─────────────────────────────────────────────────────────

  const vendorPortalOtpSecret = process.env.PORTAL_OTP_SECRET || "vendor-portal-dev-secret";

  type VendorPortalRequest = Request & {
    vendorPortalCredentialId?: string;
    vendorId?: string;
    vendorAssociationIds?: string[];
  };

  async function requireVendorPortal(req: VendorPortalRequest, res: Response, next: NextFunction) {
    const credentialId = req.header("x-vendor-portal-credential-id") || "";
    if (!credentialId) return res.status(403).json({ message: "Vendor portal access required" });
    const [credential] = await db
      .select()
      .from(vendorPortalCredentials)
      .where(eq(vendorPortalCredentials.id, credentialId))
      .limit(1);
    if (!credential || credential.status !== "accepted") {
      return res.status(403).json({ message: "Invalid or inactive vendor portal credential" });
    }
    await db
      .update(vendorPortalCredentials)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(vendorPortalCredentials.id, credentialId));
    req.vendorPortalCredentialId = credentialId;
    req.vendorId = credential.vendorId;
    req.vendorAssociationIds = [credential.associationId];
    return next();
  }

  // Manager: invite vendor to portal
  app.post(
    "/api/vendors/:id/portal-invite",
    requireAdmin,
    requireAdminRole(["platform-admin", "board-admin", "manager"]),
    async (req: AdminRequest, res) => {
      try {
        const vendorId = getParam(req.params.id);
        await assertResourceScope(req, "vendor", vendorId);
        const { email } = req.body as { email: string };
        if (!email) return res.status(400).json({ message: "email is required" });
        const [vendor] = await db.select().from(vendors).where(eq(vendors.id, vendorId)).limit(1);
        if (!vendor) return res.status(404).json({ message: "Vendor not found" });

        const cleanEmail = email.toLowerCase().trim();
        await db
          .delete(vendorPortalCredentials)
          .where(and(eq(vendorPortalCredentials.vendorId, vendorId), eq(vendorPortalCredentials.email, cleanEmail)));
        const [credential] = await db
          .insert(vendorPortalCredentials)
          .values({
            vendorId,
            associationId: vendor.associationId,
            email: cleanEmail,
            status: "pending",
            invitedBy: req.adminUserEmail || "manager",
            invitedAt: new Date(),
          })
          .returning();

        const emailReady = isEmailProviderConfigured();
        if (emailReady) {
          try {
            const portalUrl = `${process.env.APP_BASE_URL || "http://localhost:5000"}/vendor-portal`;
            await sendPlatformEmail({
              to: credential.email,
              subject: `You've been invited to the Vendor Portal — ${vendor.name}`,
              html: `<p>Hello,</p><p>You have been invited to the vendor portal for <strong>${vendor.name}</strong>.</p><p>Visit <a href="${portalUrl}">${portalUrl}</a> to sign in.</p>`,
              text: `You have been invited to the vendor portal for ${vendor.name}. Visit ${portalUrl} to sign in.`,
            });
          } catch (e: any) {
            console.error("[vendor-portal-invite][email-error]", e.message);
          }
        } else {
          console.warn("[vendor-portal-invite][simulation-mode]", { email: credential.email });
        }

        res.json(credential);
      } catch (error: any) {
        res.status(400).json({ message: error.message });
      }
    },
  );

  // Manager: get portal credential status for a vendor
  app.get(
    "/api/vendors/:id/portal-credential",
    requireAdmin,
    requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]),
    async (req: AdminRequest, res) => {
      try {
        const vendorId = getParam(req.params.id);
        await assertResourceScope(req, "vendor", vendorId);
        const rows = await db.select().from(vendorPortalCredentials).where(eq(vendorPortalCredentials.vendorId, vendorId));
        res.json(rows);
      } catch (error: any) {
        res.status(500).json({ message: error.message });
      }
    },
  );

  // Manager: revoke vendor portal credential
  app.patch(
    "/api/vendors/:id/portal-credential/:credentialId/revoke",
    requireAdmin,
    requireAdminRole(["platform-admin", "board-admin", "manager"]),
    async (req: AdminRequest, res) => {
      try {
        const vendorId = getParam(req.params.id);
        const credentialId = getParam(req.params.credentialId);
        await assertResourceScope(req, "vendor", vendorId);
        const [updated] = await db
          .update(vendorPortalCredentials)
          .set({ status: "revoked", updatedAt: new Date() })
          .where(and(eq(vendorPortalCredentials.id, credentialId), eq(vendorPortalCredentials.vendorId, vendorId)))
          .returning();
        if (!updated) return res.status(404).json({ message: "Credential not found" });
        res.json(updated);
      } catch (error: any) {
        res.status(400).json({ message: error.message });
      }
    },
  );

  // Vendor Portal OTP login — step 1: request code
  app.post("/api/vendor-portal/request-login", async (req, res) => {
    try {
      const email = getParam(req.body?.email).trim().toLowerCase();
      if (!email) return res.status(400).json({ message: "email is required" });

      const allCredentials = await db
        .select()
        .from(vendorPortalCredentials)
        .where(
          and(
            eq(vendorPortalCredentials.email, email),
            or(eq(vendorPortalCredentials.status, "pending"), eq(vendorPortalCredentials.status, "accepted")),
          ),
        );

      if (allCredentials.length === 0) {
        return res.json({ message: "If an account exists for this email, a login code has been sent." });
      }

      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const otpHash = createHmac("sha256", vendorPortalOtpSecret).update(otp).digest("hex");
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      const vendorId = allCredentials[0].vendorId;

      await db
        .delete(vendorPortalLoginTokens)
        .where(and(eq(vendorPortalLoginTokens.email, email), eq(vendorPortalLoginTokens.vendorId, vendorId)));
      await db.insert(vendorPortalLoginTokens).values({ vendorId, email, otpHash, expiresAt });

      const emailReady = isEmailProviderConfigured();
      if (emailReady) {
        try {
          await sendPlatformEmail({
            to: email,
            subject: "Your Vendor Portal Login Code",
            html: `<p>Your login code is: <strong style="font-size:24px;letter-spacing:0.2em;">${otp}</strong></p><p>This code expires in 15 minutes.</p>`,
            text: `Your vendor portal login code is: ${otp}\n\nThis code expires in 15 minutes.`,
          });
        } catch (e: any) {
          console.error("[vendor-portal-otp][email-error]", e.message);
        }
      } else {
        console.warn("[vendor-portal-otp][simulation-mode]", { email, otp });
      }

      const response: Record<string, unknown> = { message: "If an account exists for this email, a login code has been sent." };
      if (!emailReady) {
        response.simulatedOtp = otp;
        response.simulationMode = true;
      }
      res.json(response);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Vendor Portal OTP login — step 2: verify code
  app.post("/api/vendor-portal/verify-login", async (req, res) => {
    try {
      const email = getParam(req.body?.email).trim().toLowerCase();
      const otp = getParam(req.body?.otp).trim();
      if (!email || !otp) return res.status(400).json({ message: "email and otp are required" });

      const allCredentials = await db
        .select()
        .from(vendorPortalCredentials)
        .where(
          and(
            eq(vendorPortalCredentials.email, email),
            or(eq(vendorPortalCredentials.status, "pending"), eq(vendorPortalCredentials.status, "accepted")),
          ),
        );
      if (allCredentials.length === 0) return res.status(404).json({ message: "No active vendor portal access found" });

      const vendorId = allCredentials[0].vendorId;
      const [token] = await db
        .select()
        .from(vendorPortalLoginTokens)
        .where(and(eq(vendorPortalLoginTokens.email, email), eq(vendorPortalLoginTokens.vendorId, vendorId)))
        .limit(1);

      if (!token) return res.status(400).json({ message: "No pending login code. Request a new one." });
      if (token.usedAt) return res.status(400).json({ message: "Login code already used. Request a new one." });
      if (new Date() > token.expiresAt) return res.status(400).json({ message: "Login code expired. Request a new one." });
      if (token.attempts >= 5) return res.status(429).json({ message: "Too many attempts. Request a new login code." });

      await db.update(vendorPortalLoginTokens).set({ attempts: token.attempts + 1 }).where(eq(vendorPortalLoginTokens.id, token.id));

      const expectedHash = createHmac("sha256", vendorPortalOtpSecret).update(otp).digest("hex");
      const match = timingSafeEqual(Buffer.from(expectedHash, "hex"), Buffer.from(token.otpHash, "hex"));
      if (!match) return res.status(400).json({ message: "Invalid login code." });

      await db.update(vendorPortalLoginTokens).set({ usedAt: new Date() }).where(eq(vendorPortalLoginTokens.id, token.id));

      for (const cred of allCredentials.filter((c) => c.status === "pending")) {
        await db
          .update(vendorPortalCredentials)
          .set({ status: "accepted", acceptedAt: new Date(), updatedAt: new Date() })
          .where(eq(vendorPortalCredentials.id, cred.id));
      }

      const [finalCred] = await db
        .select()
        .from(vendorPortalCredentials)
        .where(and(eq(vendorPortalCredentials.email, email), eq(vendorPortalCredentials.vendorId, vendorId)))
        .limit(1);

      res.json({
        vendorPortalCredentialId: finalCred.id,
        vendorId: finalCred.vendorId,
        associationId: finalCred.associationId,
        email: finalCred.email,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Vendor Portal: get current vendor info
  app.get("/api/vendor-portal/me", requireVendorPortal, async (req: VendorPortalRequest, res) => {
    try {
      const [vendor] = await db.select().from(vendors).where(eq(vendors.id, req.vendorId!)).limit(1);
      if (!vendor) return res.status(404).json({ message: "Vendor not found" });
      const [credential] = await db
        .select()
        .from(vendorPortalCredentials)
        .where(eq(vendorPortalCredentials.id, req.vendorPortalCredentialId!))
        .limit(1);
      res.json({ vendor, credential });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Vendor Portal: list work orders scoped to this vendor
  app.get("/api/vendor-portal/work-orders", requireVendorPortal, async (req: VendorPortalRequest, res) => {
    try {
      const rows = await db
        .select()
        .from(workOrders)
        .where(and(eq(workOrders.vendorId, req.vendorId!), inArray(workOrders.associationId, req.vendorAssociationIds!)))
        .orderBy(workOrders.updatedAt);
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Vendor Portal: get single work order with activity log (scoped)
  app.get("/api/vendor-portal/work-orders/:id", requireVendorPortal, async (req: VendorPortalRequest, res) => {
    try {
      const workOrderId = getParam(req.params.id);
      const [wo] = await db
        .select()
        .from(workOrders)
        .where(
          and(
            eq(workOrders.id, workOrderId),
            eq(workOrders.vendorId, req.vendorId!),
            inArray(workOrders.associationId, req.vendorAssociationIds!),
          ),
        )
        .limit(1);
      if (!wo) return res.status(404).json({ message: "Work order not found" });

      const activity = await db
        .select()
        .from(vendorWorkOrderActivity)
        .where(eq(vendorWorkOrderActivity.workOrderId, workOrderId))
        .orderBy(vendorWorkOrderActivity.createdAt);

      let unit = null;
      if (wo.unitId) {
        const unitRows = await db.select().from(units).where(eq(units.id, wo.unitId)).limit(1);
        unit = unitRows[0] ?? null;
      }

      res.json({ ...wo, activity, unit });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Vendor Portal: update work order status
  app.patch("/api/vendor-portal/work-orders/:id/status", requireVendorPortal, async (req: VendorPortalRequest, res) => {
    try {
      const workOrderId = getParam(req.params.id);
      const { status, note } = req.body as { status: string; note: string };
      if (!status) return res.status(400).json({ message: "status is required" });
      if (!note || !note.trim()) return res.status(400).json({ message: "note is required when updating status" });

      const validVendorStatuses = ["assigned", "in-progress", "pending-review", "closed"];
      if (!validVendorStatuses.includes(status)) {
        return res.status(400).json({ message: `Invalid status. Must be one of: ${validVendorStatuses.join(", ")}` });
      }

      const [existing] = await db
        .select()
        .from(workOrders)
        .where(
          and(
            eq(workOrders.id, workOrderId),
            eq(workOrders.vendorId, req.vendorId!),
            inArray(workOrders.associationId, req.vendorAssociationIds!),
          ),
        )
        .limit(1);
      if (!existing) return res.status(404).json({ message: "Work order not found" });

      const previousStatus = existing.status;
      const now = new Date();
      const statusUpdates: Record<string, unknown> = { status, updatedAt: now };
      if (status === "in-progress" && !existing.startedAt) statusUpdates.startedAt = now;
      if ((status === "closed" || status === "pending-review") && !existing.completedAt) statusUpdates.completedAt = now;

      const [updated] = await db.update(workOrders).set(statusUpdates).where(eq(workOrders.id, workOrderId)).returning();

      await db.insert(vendorWorkOrderActivity).values({
        workOrderId,
        vendorId: req.vendorId!,
        associationId: req.vendorAssociationIds![0],
        activityType: "status_change",
        previousStatus,
        newStatus: status,
        note: note.trim(),
      });

      if ((status === "pending-review" || status === "closed") && isEmailProviderConfigured()) {
        const [vendor] = await db.select().from(vendors).where(eq(vendors.id, req.vendorId!)).limit(1);
        debug(`[vendor-portal] Job marked complete: workOrder=${workOrderId}, vendor=${vendor?.name}`);
      }

      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Vendor Portal: add note to work order
  app.post("/api/vendor-portal/work-orders/:id/notes", requireVendorPortal, async (req: VendorPortalRequest, res) => {
    try {
      const workOrderId = getParam(req.params.id);
      const { note } = req.body as { note: string };
      if (!note || !note.trim()) return res.status(400).json({ message: "note is required" });

      const [existing] = await db
        .select()
        .from(workOrders)
        .where(
          and(
            eq(workOrders.id, workOrderId),
            eq(workOrders.vendorId, req.vendorId!),
            inArray(workOrders.associationId, req.vendorAssociationIds!),
          ),
        )
        .limit(1);
      if (!existing) return res.status(404).json({ message: "Work order not found" });

      const [activity] = await db
        .insert(vendorWorkOrderActivity)
        .values({
          workOrderId,
          vendorId: req.vendorId!,
          associationId: req.vendorAssociationIds![0],
          activityType: "note_added",
          note: note.trim(),
        })
        .returning();

      const combinedNotes = [existing.vendorNotes, note.trim()].filter(Boolean).join("\n---\n");
      await db.update(workOrders).set({ vendorNotes: combinedNotes, updatedAt: new Date() }).where(eq(workOrders.id, workOrderId));

      res.json(activity);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Vendor Portal: set estimated completion date
  app.patch("/api/vendor-portal/work-orders/:id/estimated-completion", requireVendorPortal, async (req: VendorPortalRequest, res) => {
    try {
      const workOrderId = getParam(req.params.id);
      const { estimatedCompletionDate } = req.body as { estimatedCompletionDate: string };
      if (!estimatedCompletionDate) return res.status(400).json({ message: "estimatedCompletionDate is required" });

      const [existing] = await db
        .select()
        .from(workOrders)
        .where(
          and(
            eq(workOrders.id, workOrderId),
            eq(workOrders.vendorId, req.vendorId!),
            inArray(workOrders.associationId, req.vendorAssociationIds!),
          ),
        )
        .limit(1);
      if (!existing) return res.status(404).json({ message: "Work order not found" });

      const completionDate = new Date(estimatedCompletionDate);
      const [updated] = await db
        .update(workOrders)
        .set({ vendorEstimatedCompletionDate: completionDate, updatedAt: new Date() })
        .where(eq(workOrders.id, workOrderId))
        .returning();

      await db.insert(vendorWorkOrderActivity).values({
        workOrderId,
        vendorId: req.vendorId!,
        associationId: req.vendorAssociationIds![0],
        activityType: "estimated_completion_set",
        note: `Estimated completion set to ${completionDate.toLocaleDateString()}`,
      });

      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Vendor Portal: upload completion photo
  app.post(
    "/api/vendor-portal/work-orders/:id/photos",
    requireVendorPortal,
    upload.single("file"),
    async (req: VendorPortalRequest, res) => {
      try {
        const workOrderId = getParam(req.params.id);
        const file = req.file;
        if (!file) return res.status(400).json({ message: "file is required" });
        const { label } = req.body as { label?: string };

        const [existing] = await db
          .select()
          .from(workOrders)
          .where(
            and(
              eq(workOrders.id, workOrderId),
              eq(workOrders.vendorId, req.vendorId!),
              inArray(workOrders.associationId, req.vendorAssociationIds!),
            ),
          )
          .limit(1);
        if (!existing) return res.status(404).json({ message: "Work order not found" });

        const fileUrl = `/api/uploads/${file.filename}`;
        const currentPhotos = (existing.photosJson as any[]) || [];
        const newPhoto = { url: fileUrl, label: label || "Completion photo", type: "completion", uploadedAt: new Date().toISOString(), uploadedByVendor: true };
        await db
          .update(workOrders)
          .set({ photosJson: [...currentPhotos, newPhoto], updatedAt: new Date() })
          .where(eq(workOrders.id, workOrderId));

        await db.insert(vendorWorkOrderActivity).values({
          workOrderId,
          vendorId: req.vendorId!,
          associationId: req.vendorAssociationIds![0],
          activityType: "photo_uploaded",
          note: label || "Completion photo uploaded",
          fileUrl,
          fileType: "photo",
        });

        res.json({ url: fileUrl, label: newPhoto.label });
      } catch (error: any) {
        res.status(400).json({ message: error.message });
      }
    },
  );

  // Vendor Portal: upload invoice (creates record in financial module flagged for manager review)
  app.post(
    "/api/vendor-portal/work-orders/:id/invoice",
    requireVendorPortal,
    upload.single("file"),
    async (req: VendorPortalRequest, res) => {
      try {
        const workOrderId = getParam(req.params.id);
        const file = req.file;
        if (!file) return res.status(400).json({ message: "file is required" });
        const { invoiceNumber, amount, invoiceDate } = req.body as { invoiceNumber?: string; amount?: string; invoiceDate?: string };

        const [existing] = await db
          .select()
          .from(workOrders)
          .where(
            and(
              eq(workOrders.id, workOrderId),
              eq(workOrders.vendorId, req.vendorId!),
              inArray(workOrders.associationId, req.vendorAssociationIds!),
            ),
          )
          .limit(1);
        if (!existing) return res.status(404).json({ message: "Work order not found" });

        const [vendor] = await db.select().from(vendors).where(eq(vendors.id, req.vendorId!)).limit(1);
        const fileUrl = `/uploads/${file.filename}`;
        const parsedAmount = amount ? parseFloat(amount) : 0;
        const parsedDate = invoiceDate ? new Date(invoiceDate) : new Date();

        const [invoice] = await db
          .insert(vendorInvoices)
          .values({
            associationId: req.vendorAssociationIds![0],
            vendorId: req.vendorId!,
            vendorName: vendor?.name || "Unknown Vendor",
            invoiceNumber: invoiceNumber || null,
            invoiceDate: parsedDate,
            amount: parsedAmount,
            status: "received",
            notes: `Submitted via vendor portal for work order: ${existing.title}. File: ${fileUrl}`,
          })
          .returning();

        await db.update(workOrders).set({ vendorInvoiceId: invoice.id, updatedAt: new Date() }).where(eq(workOrders.id, workOrderId));

        await db.insert(vendorWorkOrderActivity).values({
          workOrderId,
          vendorId: req.vendorId!,
          associationId: req.vendorAssociationIds![0],
          activityType: "invoice_uploaded",
          note: `Invoice uploaded${invoiceNumber ? ` (#${invoiceNumber})` : ""}${parsedAmount ? ` for $${parsedAmount.toFixed(2)}` : ""}`,
          fileUrl,
          fileType: "invoice",
        });

        res.json({ invoice, fileUrl });
      } catch (error: any) {
        res.status(400).json({ message: error.message });
      }
    },
  );

  // Manager-facing: vendor activity feed for a work order
  app.get(
    "/api/work-orders/:id/vendor-activity",
    requireAdmin,
    requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]),
    async (req: AdminRequest, res) => {
      try {
        const workOrderId = getParam(req.params.id);
        const activity = await db
          .select()
          .from(vendorWorkOrderActivity)
          .where(eq(vendorWorkOrderActivity.workOrderId, workOrderId))
          .orderBy(vendorWorkOrderActivity.createdAt);
        res.json(activity);
      } catch (error: any) {
        res.status(500).json({ message: error.message });
      }
    },
  );

  // ── Workstream 5: Enhanced Portfolio & Association Workspace APIs ──────────

  // 1. GET /api/admin/portfolio/summary — Portfolio-level financial aggregation
  app.get("/api/admin/portfolio/summary", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const allAssociations = await storage.getAssociations({ includeArchived: false });
      const visibleAssociations = req.adminRole === "platform-admin"
        ? allAssociations
        : allAssociations.filter((a) => (req.adminScopedAssociationIds ?? []).includes(a.id));

      let totalOperatingFunds = 0;
      let totalReserveFunds = 0;
      let totalDelinquentAccounts = 0;
      let totalOwnerAccounts = 0;

      await Promise.all(visibleAssociations.map(async (assoc) => {
        const [accounts, ledgerSummary] = await Promise.all([
          storage.getFinancialAccounts(assoc.id),
          storage.getOwnerLedgerSummary(assoc.id),
        ]);

        for (const acct of accounts) {
          if (acct.accountType === "reserve" || acct.name.toLowerCase().includes("reserve")) {
            totalReserveFunds += 0; // balances aren't stored on account rows; use placeholder
          }
        }

        const delinquent = ledgerSummary.filter((e) => e.balance > 0);
        totalDelinquentAccounts += delinquent.length;
        totalOwnerAccounts += ledgerSummary.length;
      }));

      const delinquencyRate = totalOwnerAccounts > 0
        ? Math.round((totalDelinquentAccounts / totalOwnerAccounts) * 100 * 10) / 10
        : 0;

      res.json({
        totalAssociations: visibleAssociations.length,
        totalOperatingFunds,
        totalReserveFunds,
        delinquencyRate,
        portfolioYield: 0, // placeholder — no revenue data available
        totalDelinquentAccounts,
        totalOwnerAccounts,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // 2. GET /api/admin/portfolio/associations — Enhanced association list with computed health
  app.get("/api/admin/portfolio/associations", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const allAssociations = await storage.getAssociations({ includeArchived: false });
      const visibleAssociations = req.adminRole === "platform-admin"
        ? allAssociations
        : allAssociations.filter((a) => (req.adminScopedAssociationIds ?? []).includes(a.id));

      const results = await Promise.all(visibleAssociations.map(async (assoc) => {
        const [unitsList, ledgerSummary, wos] = await Promise.all([
          storage.getUnits(assoc.id),
          storage.getOwnerLedgerSummary(assoc.id),
          storage.getWorkOrders({ associationId: assoc.id }),
        ]);

        const delinquentCount = ledgerSummary.filter((e) => e.balance > 0).length;
        const delinquencyPct = ledgerSummary.length > 0 ? (delinquentCount / ledgerSummary.length) * 100 : 0;
        const openWOs = wos.filter((wo) => wo.status !== "closed" && wo.status !== "cancelled").length;

        // Age check — "Transitioning" if created < 6 months ago
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const isNew = assoc.createdAt && new Date(assoc.createdAt) > sixMonthsAgo;

        let status: "Stable" | "Critical" | "Transitioning" = "Stable";
        if (delinquencyPct > 10) status = "Critical";
        else if (isNew) status = "Transitioning";

        return {
          associationId: assoc.id,
          name: assoc.name,
          city: assoc.city || null,
          state: assoc.state || null,
          unitCount: unitsList.length,
          operatingBalance: 0,
          reserveBalance: 0,
          delinquencyPct: Math.round(delinquencyPct * 10) / 10,
          openWorkOrders: openWOs,
          status,
        };
      }));

      res.json(results);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // 3. GET /api/admin/portfolio/alerts — Critical alerts aggregation
  app.get("/api/admin/portfolio/alerts", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const allAssociations = await storage.getAssociations({ includeArchived: false });
      const visibleAssociations = req.adminRole === "platform-admin"
        ? allAssociations
        : allAssociations.filter((a) => (req.adminScopedAssociationIds ?? []).includes(a.id));

      const alerts: Array<{
        associationId: string;
        associationName: string;
        type: string;
        severity: "critical" | "warning" | "info";
        description: string;
      }> = [];

      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      await Promise.all(visibleAssociations.map(async (assoc) => {
        const [wos, ledgerSummary] = await Promise.all([
          storage.getWorkOrders({ associationId: assoc.id }),
          storage.getOwnerLedgerSummary(assoc.id),
        ]);

        // Overdue high-priority work orders (high/urgent, open > 7 days)
        const overdueHighPriority = wos.filter((wo) =>
          (wo.priority === "high" || wo.priority === "urgent") &&
          wo.status !== "closed" && wo.status !== "cancelled" &&
          new Date(wo.createdAt) < sevenDaysAgo
        );
        if (overdueHighPriority.length > 0) {
          alerts.push({
            associationId: assoc.id,
            associationName: assoc.name,
            type: "overdue_work_orders",
            severity: overdueHighPriority.length >= 3 ? "critical" : "warning",
            description: `${overdueHighPriority.length} high-priority work order${overdueHighPriority.length === 1 ? "" : "s"} overdue (>7 days)`,
          });
        }

        // Delinquency spikes
        const delinquentCount = ledgerSummary.filter((e) => e.balance > 0).length;
        const delinquencyPct = ledgerSummary.length > 0 ? (delinquentCount / ledgerSummary.length) * 100 : 0;
        if (delinquencyPct > 15) {
          alerts.push({
            associationId: assoc.id,
            associationName: assoc.name,
            type: "delinquency_spike",
            severity: "critical",
            description: `Delinquency rate at ${Math.round(delinquencyPct)}% (${delinquentCount} accounts)`,
          });
        } else if (delinquencyPct > 8) {
          alerts.push({
            associationId: assoc.id,
            associationName: assoc.name,
            type: "delinquency_spike",
            severity: "warning",
            description: `Delinquency rate at ${Math.round(delinquencyPct)}% (${delinquentCount} accounts)`,
          });
        }
      }));

      // Sort by severity
      const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
      alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

      res.json(alerts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // 4. GET /api/admin/associations/:id/workspace — Single-request workspace data
  app.get("/api/admin/associations/:id/workspace", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getParam(req.params.id);
      const [assocRows, overview, onboardingState, wos] = await Promise.all([
        db.select().from(associations).where(eq(associations.id, associationId)),
        storage.getAssociationOverview(associationId),
        storage.getAssociationOnboardingState(associationId),
        storage.getWorkOrders({ associationId }),
      ]);

      const assoc = assocRows[0];
      if (!assoc) {
        return res.status(404).json({ message: "Association not found" });
      }

      const highPriorityOpen = wos.filter(
        (wo) => (wo.priority === "high" || wo.priority === "urgent") && wo.status !== "closed" && wo.status !== "cancelled"
      ).length;

      res.json({
        associationId: assoc.id,
        name: assoc.name,
        address: assoc.address,
        city: assoc.city,
        state: assoc.state,
        country: assoc.country,
        units: overview.units,
        occupancyRatePercent: overview.occupancyRatePercent,
        activeOwners: overview.activeOwners,
        activeOccupants: overview.activeOccupants,
        reserveFund: 0, // placeholder — no reserve balance table
        openTickets: overview.maintenanceOpen,
        highPriorityTickets: highPriorityOpen,
        maintenanceOverdue: overview.maintenanceOverdue,
        onboardingScorePercent: onboardingState.scorePercent,
        onboardingState: onboardingState.state,
        onboardingComponents: onboardingState.components,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // 5. GET /api/admin/associations/:id/activity — Recent activity feed
  app.get("/api/admin/associations/:id/activity", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getParam(req.params.id);
      const events: Array<{
        type: string;
        title: string;
        description: string;
        actor: string;
        timestamp: string;
        icon: string;
      }> = [];

      // Get recent work orders
      const wos = await storage.getWorkOrders({ associationId });
      const recentWOs = wos
        .sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime())
        .slice(0, 4);
      for (const wo of recentWOs) {
        events.push({
          type: "work_order",
          title: wo.status === "closed" ? "Work order closed" : wo.status === "open" ? "Work order created" : `Work order ${wo.status}`,
          description: wo.title,
          actor: wo.assignedTo || "System",
          timestamp: (wo.updatedAt ?? wo.createdAt).toISOString(),
          icon: "build",
        });
      }

      // Get recent ledger entries
      const ledger = await storage.getOwnerLedgerEntries(associationId);
      const recentLedger = ledger
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 3);
      for (const entry of recentLedger) {
        events.push({
          type: "financial",
          title: entry.entryType === "payment" ? "Payment received" : `Ledger ${entry.entryType}`,
          description: `${entry.description || entry.entryType} — $${Math.abs(entry.amount).toFixed(2)}`,
          actor: "System",
          timestamp: entry.createdAt.toISOString(),
          icon: entry.entryType === "payment" ? "payments" : "receipt_long",
        });
      }

      // Get recent documents
      const docs = await db.select().from(documents).where(eq(documents.associationId, associationId)).orderBy(desc(documents.createdAt)).limit(3);
      for (const doc of docs) {
        events.push({
          type: "document",
          title: "Document uploaded",
          description: doc.title,
          actor: "System",
          timestamp: doc.createdAt.toISOString(),
          icon: "description",
        });
      }

      // Sort all events by timestamp descending, limit to 10
      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      res.json(events.slice(0, 10));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // 6. GET /api/admin/portfolio/recent-activity — Portfolio-wide activity feed
  app.get("/api/admin/portfolio/recent-activity", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const allAssociations = await storage.getAssociations({ includeArchived: false });
      const visibleAssociations = req.adminRole === "platform-admin"
        ? allAssociations
        : allAssociations.filter((a) => (req.adminScopedAssociationIds ?? []).includes(a.id));

      const limitRaw = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 20;
      const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 20;

      const events: Array<{
        type: "work_order" | "financial" | "document";
        title: string;
        description: string;
        associationId: string;
        associationName: string;
        timestamp: string;
        icon: string;
      }> = [];

      await Promise.all(visibleAssociations.map(async (assoc) => {
        const [wos, ledger, docs] = await Promise.all([
          storage.getWorkOrders({ associationId: assoc.id }),
          storage.getOwnerLedgerEntries(assoc.id),
          db.select().from(documents).where(eq(documents.associationId, assoc.id)).orderBy(desc(documents.createdAt)).limit(3),
        ]);

        for (const wo of wos.slice().sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime()).slice(0, 3)) {
          events.push({
            type: "work_order",
            title: wo.status === "closed" ? "Work order closed" : wo.status === "open" ? "Work order created" : `Work order ${wo.status}`,
            description: wo.title,
            associationId: assoc.id,
            associationName: assoc.name,
            timestamp: (wo.updatedAt ?? wo.createdAt).toISOString(),
            icon: "build",
          });
        }

        for (const entry of ledger.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 2)) {
          events.push({
            type: "financial",
            title: entry.entryType === "payment" ? "Payment received" : `Ledger ${entry.entryType}`,
            description: `${entry.description || entry.entryType} — $${Math.abs(entry.amount).toFixed(2)}`,
            associationId: assoc.id,
            associationName: assoc.name,
            timestamp: entry.createdAt.toISOString(),
            icon: entry.entryType === "payment" ? "payments" : "receipt_long",
          });
        }

        for (const doc of docs) {
          events.push({
            type: "document",
            title: "Document uploaded",
            description: doc.title,
            associationId: assoc.id,
            associationName: assoc.name,
            timestamp: doc.createdAt.toISOString(),
            icon: "description",
          });
        }
      }));

      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      res.json(events.slice(0, limit));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Community Hub — Admin API (hub config, action links, info blocks)
  // ═══════════════════════════════════════════════════════════════════════════

  // GET hub config for an association
  app.get("/api/associations/:id/hub/config", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getParam(req.params.id);
      assertAssociationScope(req, associationId);
      const [config] = await db.select().from(hubPageConfigs).where(eq(hubPageConfigs.associationId, associationId));
      res.json(config || null);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // PUT (upsert) hub config
  app.put("/api/associations/:id/hub/config", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getParam(req.params.id);
      assertAssociationScope(req, associationId);
      const body = { ...req.body, associationId };
      const [existing] = await db.select().from(hubPageConfigs).where(eq(hubPageConfigs.associationId, associationId));
      if (existing) {
        const [updated] = await db.update(hubPageConfigs)
          .set({ ...body, updatedAt: new Date() })
          .where(eq(hubPageConfigs.id, existing.id))
          .returning();
        res.json(updated);
      } else {
        const [created] = await db.insert(hubPageConfigs).values(body).returning();
        res.json(created);
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // GET action links for an association
  app.get("/api/associations/:id/hub/action-links", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getParam(req.params.id);
      assertAssociationScope(req, associationId);
      const links = await db.select().from(hubActionLinks)
        .where(eq(hubActionLinks.associationId, associationId))
        .orderBy(hubActionLinks.orderIndex);
      res.json(links);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // POST create action link
  app.post("/api/associations/:id/hub/action-links", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getParam(req.params.id);
      assertAssociationScope(req, associationId);
      // Enforce max 8 action links per association
      const existing = await db.select().from(hubActionLinks).where(eq(hubActionLinks.associationId, associationId));
      if (existing.length >= 8) return res.status(400).json({ message: "Maximum 8 action links per association" });
      const [created] = await db.insert(hubActionLinks).values({ ...req.body, associationId }).returning();
      res.json(created);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // PUT update action link
  app.put("/api/associations/:id/hub/action-links/:linkId", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getParam(req.params.id);
      assertAssociationScope(req, associationId);
      const [updated] = await db.update(hubActionLinks)
        .set({ ...req.body, updatedAt: new Date() })
        .where(and(eq(hubActionLinks.id, getParam(req.params.linkId)), eq(hubActionLinks.associationId, associationId)))
        .returning();
      if (!updated) return res.status(404).json({ message: "Action link not found" });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // DELETE action link
  app.delete("/api/associations/:id/hub/action-links/:linkId", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getParam(req.params.id);
      assertAssociationScope(req, associationId);
      const [deleted] = await db.delete(hubActionLinks)
        .where(and(eq(hubActionLinks.id, getParam(req.params.linkId)), eq(hubActionLinks.associationId, associationId)))
        .returning();
      if (!deleted) return res.status(404).json({ message: "Action link not found" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // GET info blocks for an association
  app.get("/api/associations/:id/hub/info-blocks", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getParam(req.params.id);
      assertAssociationScope(req, associationId);
      const blocks = await db.select().from(hubInfoBlocks)
        .where(eq(hubInfoBlocks.associationId, associationId))
        .orderBy(hubInfoBlocks.orderIndex);
      res.json(blocks);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // POST create info block
  app.post("/api/associations/:id/hub/info-blocks", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getParam(req.params.id);
      assertAssociationScope(req, associationId);
      const [created] = await db.insert(hubInfoBlocks).values({ ...req.body, associationId }).returning();
      res.json(created);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // PUT update info block
  app.put("/api/associations/:id/hub/info-blocks/:blockId", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getParam(req.params.id);
      assertAssociationScope(req, associationId);
      const [updated] = await db.update(hubInfoBlocks)
        .set({ ...req.body, updatedAt: new Date() })
        .where(and(eq(hubInfoBlocks.id, getParam(req.params.blockId)), eq(hubInfoBlocks.associationId, associationId)))
        .returning();
      if (!updated) return res.status(404).json({ message: "Info block not found" });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // DELETE info block
  app.delete("/api/associations/:id/hub/info-blocks/:blockId", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getParam(req.params.id);
      assertAssociationScope(req, associationId);
      const [deleted] = await db.delete(hubInfoBlocks)
        .where(and(eq(hubInfoBlocks.id, getParam(req.params.blockId)), eq(hubInfoBlocks.associationId, associationId)))
        .returning();
      if (!deleted) return res.status(404).json({ message: "Info block not found" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Community Hub — Map API (layers, nodes, issues)
  // ═══════════════════════════════════════════════════════════════════════════

  // GET map layers
  app.get("/api/associations/:id/hub/map/layers", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getParam(req.params.id);
      assertAssociationScope(req, associationId);
      const layers = await db.select().from(hubMapLayers).where(eq(hubMapLayers.associationId, associationId));
      res.json(layers);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // POST create map layer
  app.post("/api/associations/:id/hub/map/layers", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getParam(req.params.id);
      assertAssociationScope(req, associationId);
      const [created] = await db.insert(hubMapLayers).values({ ...req.body, associationId }).returning();
      res.json(created);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // PUT update map layer
  app.put("/api/associations/:id/hub/map/layers/:layerId", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getParam(req.params.id);
      assertAssociationScope(req, associationId);
      const [updated] = await db.update(hubMapLayers)
        .set({ ...req.body, updatedAt: new Date() })
        .where(and(eq(hubMapLayers.id, getParam(req.params.layerId)), eq(hubMapLayers.associationId, associationId)))
        .returning();
      if (!updated) return res.status(404).json({ message: "Map layer not found" });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // GET map nodes for a layer
  app.get("/api/associations/:id/hub/map/layers/:layerId/nodes", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getParam(req.params.id);
      assertAssociationScope(req, associationId);
      const nodes = await db.select().from(hubMapNodes)
        .where(and(eq(hubMapNodes.layerId, getParam(req.params.layerId)), eq(hubMapNodes.associationId, associationId)));
      res.json(nodes);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // POST create map node
  app.post("/api/associations/:id/hub/map/nodes", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getParam(req.params.id);
      assertAssociationScope(req, associationId);
      const [created] = await db.insert(hubMapNodes).values({ ...req.body, associationId }).returning();
      res.json(created);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // PUT update map node
  app.put("/api/associations/:id/hub/map/nodes/:nodeId", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getParam(req.params.id);
      assertAssociationScope(req, associationId);
      const [updated] = await db.update(hubMapNodes)
        .set({ ...req.body, updatedAt: new Date() })
        .where(and(eq(hubMapNodes.id, getParam(req.params.nodeId)), eq(hubMapNodes.associationId, associationId)))
        .returning();
      if (!updated) return res.status(404).json({ message: "Map node not found" });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // DELETE map node
  app.delete("/api/associations/:id/hub/map/nodes/:nodeId", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getParam(req.params.id);
      assertAssociationScope(req, associationId);
      const [deleted] = await db.delete(hubMapNodes)
        .where(and(eq(hubMapNodes.id, getParam(req.params.nodeId)), eq(hubMapNodes.associationId, associationId)))
        .returning();
      if (!deleted) return res.status(404).json({ message: "Map node not found" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // GET map issues (admin view — all issues for the association)
  app.get("/api/associations/:id/hub/map/issues", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getParam(req.params.id);
      assertAssociationScope(req, associationId);
      const statusFilter = req.query.status as string | undefined;
      const categoryFilter = req.query.category as string | undefined;
      const conditions = [eq(hubMapIssues.associationId, associationId)];
      if (statusFilter) conditions.push(eq(hubMapIssues.status, statusFilter as any));
      if (categoryFilter) conditions.push(eq(hubMapIssues.category, categoryFilter as any));
      const issues = await db.select().from(hubMapIssues)
        .where(and(...conditions))
        .orderBy(desc(hubMapIssues.createdAt));
      res.json(issues);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // PUT update map issue status (admin review)
  app.put("/api/associations/:id/hub/map/issues/:issueId", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getParam(req.params.id);
      assertAssociationScope(req, associationId);
      const updates: Record<string, any> = { ...req.body, updatedAt: new Date() };
      if (req.body.status === "under-review" || req.body.status === "approved" || req.body.status === "dismissed") {
        updates.reviewedBy = req.adminUserEmail;
        updates.reviewedAt = new Date();
      }
      if (req.body.status === "resolved") {
        updates.resolvedAt = new Date();
      }
      const [updated] = await db.update(hubMapIssues)
        .set(updates)
        .where(and(eq(hubMapIssues.id, getParam(req.params.issueId)), eq(hubMapIssues.associationId, associationId)))
        .returning();
      if (!updated) return res.status(404).json({ message: "Map issue not found" });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Community Hub — Notices API (extends communityAnnouncements)
  // ═══════════════════════════════════════════════════════════════════════════

  // GET hub notices for admin
  app.get("/api/associations/:id/hub/notices", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getParam(req.params.id);
      assertAssociationScope(req, associationId);
      const notices = await db.select().from(communityAnnouncements)
        .where(eq(communityAnnouncements.associationId, associationId))
        .orderBy(desc(communityAnnouncements.createdAt));
      res.json(notices);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // POST create hub notice
  app.post("/api/associations/:id/hub/notices", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getParam(req.params.id);
      assertAssociationScope(req, associationId);
      const [created] = await db.insert(communityAnnouncements).values({
        ...req.body,
        associationId,
        createdBy: req.adminUserEmail,
      }).returning();
      res.json(created);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // PUT update hub notice
  app.put("/api/associations/:id/hub/notices/:noticeId", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getParam(req.params.id);
      assertAssociationScope(req, associationId);
      const [updated] = await db.update(communityAnnouncements)
        .set({ ...req.body, updatedAt: new Date() })
        .where(and(eq(communityAnnouncements.id, getParam(req.params.noticeId)), eq(communityAnnouncements.associationId, associationId)))
        .returning();
      if (!updated) return res.status(404).json({ message: "Notice not found" });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // DELETE hub notice
  app.delete("/api/associations/:id/hub/notices/:noticeId", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getParam(req.params.id);
      assertAssociationScope(req, associationId);
      const [deleted] = await db.delete(communityAnnouncements)
        .where(and(eq(communityAnnouncements.id, getParam(req.params.noticeId)), eq(communityAnnouncements.associationId, associationId)))
        .returning();
      if (!deleted) return res.status(404).json({ message: "Notice not found" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // POST auto-populate hub from existing association data
  app.post("/api/associations/:id/hub/auto-populate", requireAdmin, requireAdminRole(["platform-admin", "board-admin", "manager"]), async (req: AdminRequest, res) => {
    try {
      const associationId = getParam(req.params.id);
      assertAssociationScope(req, associationId);

      const [assoc] = await db.select().from(associations).where(eq(associations.id, associationId));
      if (!assoc) return res.status(404).json({ message: "Association not found" });

      const results: string[] = [];

      // 1. Ensure hub config exists
      let [config] = await db.select().from(hubPageConfigs).where(eq(hubPageConfigs.associationId, associationId));
      if (!config) {
        const slug = assoc.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
        [config] = await db.insert(hubPageConfigs).values({
          associationId,
          isEnabled: 0,
          communityDescription: `Welcome to ${assoc.name}. Located in ${assoc.city}, ${assoc.state}.`,
          slug,
          sectionOrder: ["notices", "quick-actions", "info-blocks", "buildings", "contacts"],
          enabledSections: ["notices", "quick-actions", "info-blocks", "buildings", "contacts"],
        }).returning();
        results.push("Created hub configuration with slug: " + slug);
      }
      const hubSlug = config.slug || associationId;

      // 2. Auto-derive quick action links if none exist
      const existingLinks = await db.select().from(hubActionLinks).where(eq(hubActionLinks.associationId, associationId));
      if (existingLinks.length === 0) {
        const defaultLinks = [
          { label: "Owner Portal", routeTarget: `/portal?association_id=${associationId}&return_url=/community/${hubSlug}`, routeType: "internal" as const, orderIndex: 0, iconKey: "person" },
          { label: "Submit Maintenance Request", routeTarget: `/portal?association_id=${associationId}&tab=maintenance&return_url=/community/${hubSlug}`, routeType: "internal" as const, orderIndex: 1, iconKey: "build" },
          { label: "Pay Dues", routeTarget: `/portal?association_id=${associationId}&tab=payments&return_url=/community/${hubSlug}`, routeType: "internal" as const, orderIndex: 2, iconKey: "payments" },
          { label: "View Documents", routeTarget: `/portal?association_id=${associationId}&tab=documents&return_url=/community/${hubSlug}`, routeType: "internal" as const, orderIndex: 3, iconKey: "description" },
        ];
        for (const link of defaultLinks) {
          await db.insert(hubActionLinks).values({ ...link, associationId, autoDerived: 1 });
        }
        results.push("Created " + defaultLinks.length + " default quick action links");
      }

      // 3. Auto-derive info blocks from association details if none exist
      const existingBlocks = await db.select().from(hubInfoBlocks).where(eq(hubInfoBlocks.associationId, associationId));
      if (existingBlocks.length === 0) {
        const blocks: Array<{ category: any; title: string; body: string; orderIndex: number }> = [];

        // Get building count for a summary
        const buildingsList = await db.select().from(buildings).where(eq(buildings.associationId, associationId));
        const unitsList = await db.select().from(units).where(eq(units.associationId, associationId));

        if (buildingsList.length > 0 || unitsList.length > 0) {
          blocks.push({
            category: "custom",
            title: "Community Overview",
            body: `${assoc.name} is a ${assoc.associationType || "community"} located at ${assoc.address}, ${assoc.city}, ${assoc.state}.\n\n${buildingsList.length > 0 ? `Buildings: ${buildingsList.length}` : ""}${unitsList.length > 0 ? `\nUnits: ${unitsList.length}` : ""}`,
            orderIndex: 0,
          });
        }

        blocks.push({
          category: "emergency",
          title: "Emergency Contacts",
          body: "For emergencies, please contact:\n- 911 for fire, police, or medical emergencies\n- Your property management office during business hours",
          orderIndex: 1,
        });

        blocks.push({
          category: "rules",
          title: "Community Guidelines",
          body: "Please review the community rules and regulations available in the Documents section of the Owner Portal.",
          orderIndex: 2,
        });

        for (const block of blocks) {
          await db.insert(hubInfoBlocks).values({ ...block, associationId });
        }
        results.push("Created " + blocks.length + " default info blocks");
      }

      // 4. Seed initial notices from recent community announcements if none exist
      const existingNotices = await db.select().from(communityAnnouncements)
        .where(and(eq(communityAnnouncements.associationId, associationId), eq(communityAnnouncements.isPublished, 1)))
        .limit(1);
      if (existingNotices.length === 0) {
        await db.insert(communityAnnouncements).values({
          associationId,
          title: "Welcome to the Community Hub",
          body: `The ${assoc.name} Community Hub is now available. Visit this page for community notices, important information, and quick access to owner services.`,
          priority: "normal",
          isPinned: 1,
          isPublished: 1,
          publishedAt: new Date(),
          targetAudience: "all",
          createdBy: req.adminUserEmail,
          visibilityLevel: "public",
          isDraft: 0,
        });
        results.push("Created welcome notice");
      }

      res.json({ success: true, actions: results });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Community Hub — Public API (no auth required)
  // ═══════════════════════════════════════════════════════════════════════════

  // Simple in-memory rate limiter for public hub API
  const hubPublicRateLimit = new Map<string, { count: number; resetAt: number }>();
  const HUB_RATE_LIMIT_MAX = 60;
  const HUB_RATE_LIMIT_WINDOW_MS = 60_000;

  function checkHubRateLimit(ip: string): boolean {
    const now = Date.now();
    const entry = hubPublicRateLimit.get(ip);
    if (!entry || now > entry.resetAt) {
      hubPublicRateLimit.set(ip, { count: 1, resetAt: now + HUB_RATE_LIMIT_WINDOW_MS });
      return true;
    }
    if (entry.count >= HUB_RATE_LIMIT_MAX) return false;
    entry.count++;
    return true;
  }

  // Periodic cleanup of stale rate limit entries
  setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of hubPublicRateLimit) {
      if (now > entry.resetAt) hubPublicRateLimit.delete(ip);
    }
  }, 300_000);

  // GET public hub data by association ID or slug
  app.get("/api/hub/:identifier/public", async (req, res) => {
    const clientIp = req.ip || req.socket.remoteAddress || "unknown";
    if (!checkHubRateLimit(clientIp)) {
      return res.status(429).json({ message: "Too many requests. Please try again later." });
    }
    try {
      const identifier = getParam(req.params.identifier);
      // Try slug first, then ID
      let config = (await db.select().from(hubPageConfigs).where(eq(hubPageConfigs.slug, identifier)))[0];
      if (!config) {
        config = (await db.select().from(hubPageConfigs).where(eq(hubPageConfigs.associationId, identifier)))[0];
      }
      if (!config || !config.isEnabled) {
        return res.status(404).json({ message: "Community hub not found or not enabled" });
      }

      const associationId = config.associationId;

      // Get association name
      const [association] = await db.select({ name: associations.name, city: associations.city, state: associations.state })
        .from(associations).where(eq(associations.id, associationId));

      // Get public notices (published, not expired, public visibility)
      const now = new Date();
      const publicNotices = await db.select().from(communityAnnouncements)
        .where(and(
          eq(communityAnnouncements.associationId, associationId),
          eq(communityAnnouncements.isPublished, 1),
          or(isNull(communityAnnouncements.expiresAt), gte(communityAnnouncements.expiresAt, now)),
          or(isNull(communityAnnouncements.visibilityLevel), eq(communityAnnouncements.visibilityLevel, "public")),
          eq(communityAnnouncements.isDraft, 0),
        ))
        .orderBy(desc(communityAnnouncements.publishedAt))
        .limit(10);

      // Get public info blocks
      const publicInfoBlocks = await db.select().from(hubInfoBlocks)
        .where(and(eq(hubInfoBlocks.associationId, associationId), eq(hubInfoBlocks.isEnabled, 1)))
        .orderBy(hubInfoBlocks.orderIndex);

      // Get enabled action links
      const publicActionLinks = await db.select().from(hubActionLinks)
        .where(and(eq(hubActionLinks.associationId, associationId), eq(hubActionLinks.isEnabled, 1)))
        .orderBy(hubActionLinks.orderIndex);

      // Get upcoming public meetings (scheduled, future)
      const upcomingMeetings = await db.select({
        id: governanceMeetings.id,
        title: governanceMeetings.title,
        meetingType: governanceMeetings.meetingType,
        scheduledAt: governanceMeetings.scheduledAt,
        location: governanceMeetings.location,
      }).from(governanceMeetings)
        .where(and(
          eq(governanceMeetings.associationId, associationId),
          eq(governanceMeetings.status, "scheduled"),
          gte(governanceMeetings.scheduledAt, now),
        ))
        .orderBy(governanceMeetings.scheduledAt)
        .limit(5);

      // Get public documents (portal-visible, current version)
      const publicDocuments = await db.select({
        id: documents.id,
        title: documents.title,
        documentType: documents.documentType,
        fileUrl: documents.fileUrl,
        createdAt: documents.createdAt,
      }).from(documents)
        .where(and(
          eq(documents.associationId, associationId),
          eq(documents.isPortalVisible, 1),
          eq(documents.isCurrentVersion, 1),
        ))
        .orderBy(desc(documents.createdAt))
        .limit(10);

      res.json({
        config: {
          communityDescription: config.communityDescription,
          logoUrl: config.logoUrl,
          bannerImageUrl: config.bannerImageUrl,
          themeColor: config.themeColor,
          sectionOrder: config.sectionOrder,
          enabledSections: config.enabledSections,
          slug: config.slug,
          welcomeModeEnabled: config.welcomeModeEnabled,
          welcomeHeadline: config.welcomeHeadline,
          welcomeHighlights: config.welcomeHighlights,
        },
        association: association || null,
        notices: publicNotices,
        infoBlocks: publicInfoBlocks,
        actionLinks: publicActionLinks,
        meetings: upcomingMeetings,
        documents: publicDocuments,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // GET public buildings list for a hub (by slug or association ID)
  app.get("/api/hub/:identifier/buildings", async (req, res) => {
    const clientIp = req.ip || req.socket.remoteAddress || "unknown";
    if (!checkHubRateLimit(clientIp)) {
      return res.status(429).json({ message: "Too many requests. Please try again later." });
    }
    try {
      const identifier = getParam(req.params.identifier);
      let config = (await db.select().from(hubPageConfigs).where(eq(hubPageConfigs.slug, identifier)))[0];
      if (!config) {
        config = (await db.select().from(hubPageConfigs).where(eq(hubPageConfigs.associationId, identifier)))[0];
      }
      if (!config || !config.isEnabled) {
        return res.status(404).json({ message: "Community hub not found or not enabled" });
      }
      const associationId = config.associationId;
      const buildingsList = await db.select().from(buildings).where(eq(buildings.associationId, associationId));
      const unitsList = await db.select({
        id: units.id,
        buildingId: units.buildingId,
        unitNumber: units.unitNumber,
        building: units.building,
        squareFootage: units.squareFootage,
      }).from(units).where(eq(units.associationId, associationId));

      const unitsByBuilding = unitsList.reduce<Record<string, typeof unitsList>>((acc, unit) => {
        const key = unit.buildingId || "__none__";
        if (!acc[key]) acc[key] = [];
        acc[key].push(unit);
        return acc;
      }, {});

      const result = buildingsList.map((b) => ({
        id: b.id,
        name: b.name,
        address: b.address,
        totalUnits: b.totalUnits,
        notes: b.notes,
        unitCount: (unitsByBuilding[b.id] || []).length,
      }));

      // Also include units not linked to a building
      const unlinkedUnits = unitsByBuilding["__none__"] || [];
      res.json({ buildings: result, unlinkedUnitCount: unlinkedUnits.length });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // GET public building detail (single building with its units)
  app.get("/api/hub/:identifier/buildings/:buildingId", async (req, res) => {
    const clientIp = req.ip || req.socket.remoteAddress || "unknown";
    if (!checkHubRateLimit(clientIp)) {
      return res.status(429).json({ message: "Too many requests. Please try again later." });
    }
    try {
      const identifier = getParam(req.params.identifier);
      const buildingId = getParam(req.params.buildingId);
      let config = (await db.select().from(hubPageConfigs).where(eq(hubPageConfigs.slug, identifier)))[0];
      if (!config) {
        config = (await db.select().from(hubPageConfigs).where(eq(hubPageConfigs.associationId, identifier)))[0];
      }
      if (!config || !config.isEnabled) {
        return res.status(404).json({ message: "Community hub not found or not enabled" });
      }
      const associationId = config.associationId;
      const [building] = await db.select().from(buildings)
        .where(and(eq(buildings.id, buildingId), eq(buildings.associationId, associationId)));
      if (!building) return res.status(404).json({ message: "Building not found" });

      const buildingUnits = await db.select({
        id: units.id,
        unitNumber: units.unitNumber,
        building: units.building,
        squareFootage: units.squareFootage,
      }).from(units)
        .where(and(eq(units.associationId, associationId), eq(units.buildingId, buildingId)));

      res.json({ building, units: buildingUnits });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Community Hub — Portal API (authenticated residents)
  // ═══════════════════════════════════════════════════════════════════════════

  // GET hub data for authenticated portal user (role-filtered)
  app.get("/api/hub/portal/home", requirePortal, async (req: PortalRequest, res) => {
    try {
      const associationId = req.portalAssociationId!;
      const role = req.portalRole || "readonly";

      const [config] = await db.select().from(hubPageConfigs).where(eq(hubPageConfigs.associationId, associationId));
      if (!config || !config.isEnabled) {
        return res.status(404).json({ message: "Community hub not enabled for this association" });
      }

      const [association] = await db.select({ name: associations.name, city: associations.city, state: associations.state })
        .from(associations).where(eq(associations.id, associationId));

      // Visibility hierarchy: public < resident < owner < board < admin
      const visibilityLevels = ["public"];
      if (["tenant", "owner", "board-member", "readonly"].includes(role)) visibilityLevels.push("resident");
      if (["owner", "board-member"].includes(role)) visibilityLevels.push("owner");
      if (role === "board-member" || req.portalHasBoardAccess) visibilityLevels.push("board");

      // Get role-filtered notices
      const now = new Date();
      const notices = await db.select().from(communityAnnouncements)
        .where(and(
          eq(communityAnnouncements.associationId, associationId),
          eq(communityAnnouncements.isPublished, 1),
          or(isNull(communityAnnouncements.expiresAt), gte(communityAnnouncements.expiresAt, now)),
          eq(communityAnnouncements.isDraft, 0),
          or(
            isNull(communityAnnouncements.visibilityLevel),
            inArray(communityAnnouncements.visibilityLevel, visibilityLevels),
          ),
        ))
        .orderBy(desc(communityAnnouncements.isPinned), desc(communityAnnouncements.publishedAt))
        .limit(20);

      const infoBlocks = await db.select().from(hubInfoBlocks)
        .where(and(eq(hubInfoBlocks.associationId, associationId), eq(hubInfoBlocks.isEnabled, 1)))
        .orderBy(hubInfoBlocks.orderIndex);

      const actionLinks = await db.select().from(hubActionLinks)
        .where(and(eq(hubActionLinks.associationId, associationId), eq(hubActionLinks.isEnabled, 1)))
        .orderBy(hubActionLinks.orderIndex);

      // Map data — layers and issues visible to the user's role
      const mapLayers = await db.select().from(hubMapLayers)
        .where(and(eq(hubMapLayers.associationId, associationId), eq(hubMapLayers.isActive, 1)));

      let mapIssues: any[] = [];
      if (mapLayers.length > 0) {
        const issueConditions = [
          eq(hubMapIssues.associationId, associationId),
          inArray(hubMapIssues.visibilityLevel, visibilityLevels as any),
        ];
        mapIssues = await db.select().from(hubMapIssues)
          .where(and(...issueConditions))
          .orderBy(desc(hubMapIssues.createdAt))
          .limit(50);
      }

      // Map nodes for all active layers
      let mapNodes: any[] = [];
      if (mapLayers.length > 0) {
        mapNodes = await db.select().from(hubMapNodes)
          .where(eq(hubMapNodes.associationId, associationId));
      }

      res.json({
        config: {
          communityDescription: config.communityDescription,
          logoUrl: config.logoUrl,
          bannerImageUrl: config.bannerImageUrl,
          themeColor: config.themeColor,
          sectionOrder: config.sectionOrder,
          enabledSections: config.enabledSections,
        },
        association: association || null,
        notices,
        infoBlocks,
        actionLinks,
        map: {
          layers: mapLayers,
          nodes: mapNodes,
          issues: mapIssues,
        },
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // POST report a map issue (portal user)
  app.post("/api/hub/portal/map/issues", requirePortal, async (req: PortalRequest, res) => {
    try {
      const associationId = req.portalAssociationId!;
      const [config] = await db.select().from(hubPageConfigs).where(eq(hubPageConfigs.associationId, associationId));
      if (!config || !config.isEnabled) {
        return res.status(404).json({ message: "Community hub not enabled" });
      }
      const [created] = await db.insert(hubMapIssues).values({
        ...req.body,
        associationId,
        reportedByPortalAccessId: req.portalAccessId,
        status: "reported",
        visibilityLevel: "board",
      }).returning();
      res.json(created);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // GET portal user's own reported map issues
  app.get("/api/hub/portal/map/issues/mine", requirePortal, async (req: PortalRequest, res) => {
    try {
      const issues = await db.select().from(hubMapIssues)
        .where(eq(hubMapIssues.reportedByPortalAccessId, req.portalAccessId!))
        .orderBy(desc(hubMapIssues.createdAt));
      res.json(issues);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  return httpServer;
}
