import { aliasedTable, and, desc, eq, getTableColumns, gte, ilike, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { execFile } from "child_process";
import { readFile } from "fs/promises";
import path from "path";
import { promisify } from "util";
import { inflateRawSync } from "zlib";
import { db } from "./db";
import { sendPlatformEmail } from "./email-provider";
import {
  adminAssociationScopes,
  adminUserPreferences,
  associationMemberships,
  adminUsers,
  authUsers,
  authExternalAccounts,
  auditLogs,
  aiExtractedRecords,
  aiIngestionExceptions,
  aiIngestionJobs,
  aiIngestionImportRuns,
  analysisRuns,
  analysisVersions,
  associations,
  buildings,
  annualGovernanceTasks,
  boardRoles,
  boardPackages,
  boardPackageTemplates,
  budgetLines,
  budgets,
  budgetVersions,
  calendarEvents,
  clauseRecords,
  clauseTags,
  complianceAlertOverrides,
  communicationHistory,
  contactUpdateRequests,
  inspectionRecords,
  maintenanceScheduleInstances,
  maintenanceScheduleTemplates,
  maintenanceRequests,
  associationIngestionCorrectionMemory,
  documentTags,
  documentVersions,
  emailThreads,
  executiveEvidence,
  executiveUpdates,
  documents,
  expenseAttachments,
  financialAccounts,
  financialCategories,
  governanceComplianceTemplates,
  governanceMeetings,
  governanceTemplateItems,
  meetingAgendaItems,
  meetingNotes,
  hoaFeeSchedules,
  occupancies,
  ownerships,
  permissionChangeLogs,
  personContactPoints,
  persons,
  roadmapProjects,
  roadmapTaskAttachments,
  roadmapTasks,
  roadmapWorkstreams,
  lateFeeEvents,
  lateFeeRules,
  noticeSends,
  noticeTemplates,
  ownerLedgerEntries,
  ownerPaymentLinks,
  paymentGatewayConnections,
  paymentMethodConfigs,
  paymentWebhookEvents,
  platformSubscriptions,
  platformWebhookEvents,
  permissionEnvelopes,
  onboardingInvites,
  onboardingSubmissions,
  portalAccess,
  resolutions,
  suggestedLinks,
  specialAssessments,
  tenantConfigs,
  unitChangeHistory,
  units,
  voteRecords,
  vendors,
  workOrders,
  type AdminAssociationScope,
  type AssociationMembership,
  type AdminUser,
  type AuthUser,
  type AuthExternalAccount,
  type AuditLog,
  type AiExtractedRecord,
  type AiIngestionException,
  type AiIngestionJob,
  type AiIngestionImportRun,
  type AnalysisRun,
  type AnalysisVersion,
  type Association,
  type AssociationIngestionCorrectionMemory,
  type Building,
  type AnnualGovernanceTask,
  type BoardRole,
  type BoardPackage,
  type BoardPackageTemplate,
  type Budget,
  type BudgetLine,
  type BudgetVersion,
  type CalendarEvent,
  type ClauseRecord,
  type ClauseTag,
  type ComplianceAlertOverride,
  type CommunicationHistory,
  type ContactUpdateRequest,
  type InspectionFindingItem,
  type InspectionRecord,
  type InsertMaintenanceScheduleInstance,
  type InsertMaintenanceScheduleTemplate,
  type MaintenanceRequest,
  type MaintenanceScheduleInstance,
  type MaintenanceScheduleTemplate,
  type DocumentTag,
  type DocumentVersion,
  type Document,
  type EmailThread,
  type InsertAdminAssociationScope,
  type InsertAssociationMembership,
  type InsertAdminUser,
  type InsertAuthUser,
  type InsertAuthExternalAccount,
  type InsertAuditLog,
  type InsertAiExtractedRecord,
  type InsertAiIngestionException,
  type InsertAiIngestionJob,
  type InsertAiIngestionImportRun,
  type InsertAnalysisRun,
  type InsertAnalysisVersion,
  type InsertAssociation,
  type InsertAssociationIngestionCorrectionMemory,
  type InsertBuilding,
  type InsertAnnualGovernanceTask,
  type InsertBoardRole,
  type InsertBoardPackage,
  type InsertBoardPackageTemplate,
  type InsertBudget,
  type InsertBudgetLine,
  type InsertBudgetVersion,
  type InsertCalendarEvent,
  type InsertComplianceAlertOverride,
  type InsertClauseRecord,
  type InsertClauseTag,
  type InsertCommunicationHistory,
  type InsertContactUpdateRequest,
  type InsertInspectionRecord,
  type InsertMaintenanceRequest,
  type InsertDocument,
  type InsertDocumentTag,
  type InsertDocumentVersion,
  type InsertEmailThread,
  type InsertExecutiveEvidence,
  type InsertExecutiveUpdate,
  type InsertExpenseAttachment,
  type InsertFinancialAccount,
  type InsertFinancialCategory,
  type InsertGovernanceComplianceTemplate,
  type InsertGovernanceMeeting,
  type InsertGovernanceTemplateItem,
  type InsertMeetingAgendaItem,
  type InsertMeetingNote,
  type InsertHoaFeeSchedule,
  type InsertOwnerLedgerEntry,
  type InsertOwnerPaymentLink,
  type InsertPaymentGatewayConnection,
  type InsertPaymentMethodConfig,
  type InsertPaymentWebhookEvent,
  type InsertOccupancy,
  type InsertOwnership,
  type InsertPerson,
  type InsertPersonContactPoint,
  type InsertRoadmapProject,
  type InsertRoadmapTask,
  type InsertRoadmapWorkstream,
  type InsertSpecialAssessment,
  type InsertLateFeeRule,
  type InsertNoticeSend,
  type InsertNoticeTemplate,
  type InsertOnboardingInvite,
  type InsertOnboardingSubmission,
  type InsertPermissionEnvelope,
  type InsertPortalAccess,
  type InsertResolution,
  type InsertSuggestedLink,
  type InsertTenantConfig,
  type InsertUnit,
  type InsertUtilityPayment,
  type InsertVendorInvoice,
  type InsertWorkOrder,
  type InsertVoteRecord,
  type Occupancy,
  type Ownership,
  type Person,
  type PersonContactPoint,
  type HoaFeeSchedule,
  type ExpenseAttachment,
  type FinancialAccount,
  type FinancialCategory,
  type GovernanceComplianceTemplate,
  type GovernanceMeeting,
  type GovernanceTemplateItem,
  type MeetingAgendaItem,
  type MeetingNote,
  type OwnerLedgerEntry,
  type OwnerPaymentLink,
  type PaymentGatewayConnection,
  type PaymentMethodConfig,
  type PaymentWebhookEvent,
  type PlatformSubscription,
  type InsertPlatformSubscription,
  type UnitChangeHistory,
  type RoadmapProject,
  type RoadmapTask,
  type RoadmapWorkstream,
  type ExecutiveEvidence,
  type ExecutiveUpdate,
  type LateFeeEvent,
  type LateFeeRule,
  type NoticeSend,
  type NoticeTemplate,
  type OnboardingInvite,
  type OnboardingSubmission,
  type PermissionEnvelope,
  type PortalAccess,
  type Resolution,
  type ResidentialDataset,
  type ResidentialDatasetUnitOccupancy,
  type ResidentialDatasetUnitOwner,
  type SuggestedLink,
  type SpecialAssessment,
  type Unit,
  type UtilityPayment,
  type Vendor,
  type InsertVendor,
  type VendorInvoice,
  type WorkOrder,
  type VoteRecord,
  type TenantConfig,
  utilityPayments,
  vendorInvoices,
  elections,
  electionOptions,
  electionBallotTokens,
  electionBallotCasts,
  electionProxyDesignations,
  electionProxyDocuments,
  type Election,
  type InsertElection,
  type ElectionOption,
  type InsertElectionOption,
  type ElectionBallotToken,
  type InsertElectionBallotToken,
  type ElectionBallotCast,
  type InsertElectionBallotCast,
  type ElectionProxyDesignation,
  type InsertElectionProxyDesignation,
  type ElectionProxyDocument,
  type InsertElectionProxyDocument,
} from "@shared/schema";
import { normalizeAdminNotificationPreferences } from "@shared/admin-notification-preferences";
import { governanceStateTemplateLibrary } from "@shared/governance-state-template-library";

type WorkState = "not-started" | "in-progress" | "complete";
const execFileAsync = promisify(execFile);

interface ProgressSummary {
  totalTasks: number;
  todoTasks: number;
  inProgressTasks: number;
  doneTasks: number;
  completionRate: number;
  state: WorkState;
}

interface WorkstreamProgress extends ProgressSummary {
  workstreamId: string;
}

interface ProjectProgress extends ProgressSummary {
  projectId: string;
  workstreamCount: number;
}

interface TimelineItem {
  taskId: string;
  projectId: string;
  workstreamId: string;
  title: string;
  targetStartDate: Date | null;
  targetEndDate: Date | null;
  dependencyTaskIds: string[];
  startsBeforeDependenciesComplete: boolean;
}

interface AnalysisDiffSummary {
  added: number;
  removed: number;
  changed: number;
  previousCount: number;
  currentCount: number;
}

export interface RoadmapResponse {
  projects: (RoadmapProject & { progress: ProjectProgress })[];
  workstreams: (RoadmapWorkstream & { progress: WorkstreamProgress })[];
  tasks: RoadmapTask[];
  timeline: TimelineItem[];
  executiveUpdates: ExecutiveUpdate[];
  analysisVersions: AnalysisVersion[];
  refreshedAt: string;
}

type NotificationRecipient = {
  personId: string;
  email: string;
  role: "owner" | "tenant" | "board-member";
  unitId: string;
};

type NotificationRecipientResolution = {
  recipients: NotificationRecipient[];
  candidateCount: number;
  missingEmailCount: number;
  duplicateEmailCount: number;
  skippedRecipients: number;
};

function toCompletionState(todo: number, inProgress: number, done: number): WorkState {
  if (todo > 0 && inProgress === 0 && done === 0) return "not-started";
  if (done > 0 && todo === 0 && inProgress === 0) return "complete";
  return "in-progress";
}

function computeProgress(tasks: RoadmapTask[]): ProgressSummary {
  const totalTasks = tasks.length;
  const todoTasks = tasks.filter((t) => t.status === "todo").length;
  const inProgressTasks = tasks.filter((t) => t.status === "in-progress").length;
  const doneTasks = tasks.filter((t) => t.status === "done").length;
  const completionRate = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);

  return {
    totalTasks,
    todoTasks,
    inProgressTasks,
    doneTasks,
    completionRate,
    state: totalTasks === 0 ? "not-started" : toCompletionState(todoTasks, inProgressTasks, doneTasks),
  };
}

function maskSecret(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 6) return "*".repeat(trimmed.length);
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-2)}`;
}

type EncryptedGatewaySecret = {
  alg: "aes-256-gcm";
  iv: string;
  tag: string;
  ciphertext: string;
};

type PaymentGatewayCredentialMetadata = {
  encryptedSecretKey?: EncryptedGatewaySecret | null;
  encryptedWebhookSecret?: EncryptedGatewaySecret | null;
  verification?: {
    provider: "stripe" | "other";
    mode: "live-account" | "structural";
    accountId?: string | null;
    livemode?: boolean | null;
    verifiedAt: string;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getGatewayEncryptionKey(): Buffer {
  const raw = process.env.PAYMENT_GATEWAY_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error("PAYMENT_GATEWAY_ENCRYPTION_KEY must be set before saving payment gateway credentials");
  }
  return createHash("sha256").update(raw).digest();
}

function encryptGatewaySecret(secret: string): EncryptedGatewaySecret {
  const key = getGatewayEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    alg: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

function decryptGatewaySecret(secret: EncryptedGatewaySecret | null | undefined): string | null {
  if (!secret) return null;
  if (secret.alg !== "aes-256-gcm") {
    throw new Error("Unsupported gateway secret encryption algorithm");
  }
  const key = getGatewayEncryptionKey();
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(secret.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(secret.tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(secret.ciphertext, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

function sanitizePaymentGatewayMetadata(metadataJson: unknown): unknown {
  if (!isRecord(metadataJson)) return metadataJson;
  const sanitized = { ...metadataJson };
  delete sanitized._gatewayCredentials;
  return sanitized;
}

function sanitizePaymentGatewayConnection(connection: PaymentGatewayConnection): PaymentGatewayConnection {
  return {
    ...connection,
    metadataJson: sanitizePaymentGatewayMetadata(connection.metadataJson),
  };
}

async function verifyStripeGatewayCredentials(payload: {
  publishableKey: string;
  secretKey: string;
  providerAccountId: string | null;
}): Promise<{ accountId: string; livemode: boolean; checks: string[] }> {
  const checks: string[] = [];
  if (!payload.publishableKey.startsWith("pk_")) {
    throw new Error("Stripe publishable key must start with pk_");
  }
  if (!payload.secretKey.startsWith("sk_")) {
    throw new Error("Stripe secret key must start with sk_");
  }

  const keyMode = payload.secretKey.startsWith("sk_live_") ? "live" : payload.secretKey.startsWith("sk_test_") ? "test" : "unknown";
  const publishableMode = payload.publishableKey.startsWith("pk_live_") ? "live" : payload.publishableKey.startsWith("pk_test_") ? "test" : "unknown";
  if (keyMode !== "unknown" && publishableMode !== "unknown" && keyMode !== publishableMode) {
    throw new Error("Stripe publishable and secret keys must both be test or both be live");
  }

  const response = await fetch("https://api.stripe.com/v1/account", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${payload.secretKey}`,
    },
  });

  const body = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok || !body || typeof body.id !== "string") {
    const providerMessage =
      body && isRecord(body.error) && typeof body.error.message === "string"
        ? body.error.message
        : "Stripe rejected the provided credentials";
    throw new Error(`Stripe live verification failed: ${providerMessage}`);
  }

  const accountId = body.id;
  const livemode = Boolean(body.livemode);
  if (payload.providerAccountId && payload.providerAccountId !== accountId) {
    throw new Error(`Stripe account mismatch: provided ${payload.providerAccountId} but key belongs to ${accountId}`);
  }

  checks.push(`Verified Stripe account ${accountId} via live API call.`);
  checks.push(`Account mode: ${livemode ? "live" : "test"}.`);
  return { accountId, livemode, checks };
}

function normalizeCurrency(value: unknown): string {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "USD";
  return raw || "USD";
}

function maskAccountNumber(value?: string | null): string {
  const digits = (value || "").replace(/\s+/g, "");
  if (!digits) return "";
  if (digits.length <= 4) return digits;
  return `****${digits.slice(-4)}`;
}

function parseOptionalDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function inferComplianceObligationType(text: string): string {
  const normalized = text.toLowerCase();
  if (normalized.includes("quorum") || normalized.includes("notice") || normalized.includes("meeting")) return "meeting-governance";
  if (normalized.includes("budget") || normalized.includes("audit") || normalized.includes("assessment") || normalized.includes("reserve")) return "financial-governance";
  if (normalized.includes("election") || normalized.includes("director") || normalized.includes("term") || normalized.includes("board member")) return "board-composition";
  if (normalized.includes("record") || normalized.includes("minutes") || normalized.includes("document")) return "records-retention";
  return "general-compliance";
}

function tokenizeComplianceText(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 4),
  );
}

function countTokenOverlap(left: Set<string>, right: Set<string>): number {
  let count = 0;
  left.forEach((token) => {
    if (right.has(token)) count += 1;
  });
  return count;
}

function normalizePayload(value: unknown): unknown {
  const volatileKeys = new Set(["id", "createdAt", "updatedAt"]);

  if (Array.isArray(value)) {
    return value.map((item) => normalizePayload(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !volatileKeys.has(key))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, nestedValue]) => [key, normalizePayload(nestedValue)]);

  return Object.fromEntries(entries);
}

function toComparableSet(payload: unknown): string[] {
  const normalized = normalizePayload(payload);

  if (Array.isArray(normalized)) {
    return normalized.map((item) => JSON.stringify(item)).sort();
  }

  if (normalized && typeof normalized === "object" && Array.isArray((normalized as Record<string, unknown>).items)) {
    return ((normalized as Record<string, unknown>).items as unknown[])
      .map((item) => JSON.stringify(item))
      .sort();
  }

  return [JSON.stringify(normalized)];
}

function extractComparableMap(payload: unknown): Map<string, string> {
  const normalized = normalizePayload(payload);
  const map = new Map<string, string>();

  const items: unknown[] = Array.isArray(normalized)
    ? normalized
    : (normalized && typeof normalized === "object" && Array.isArray((normalized as Record<string, unknown>).items)
        ? ((normalized as Record<string, unknown>).items as unknown[])
        : [normalized]);

  for (const item of items) {
    if (item && typeof item === "object" && typeof (item as Record<string, unknown>).id === "string") {
      map.set((item as Record<string, unknown>).id as string, JSON.stringify(item));
    }
  }

  return map;
}

function computeAnalysisDiff(previousPayload: unknown, currentPayload: unknown): AnalysisDiffSummary {
  const previousSet = toComparableSet(previousPayload);
  const currentSet = toComparableSet(currentPayload);
  const prev = new Set(previousSet);
  const curr = new Set(currentSet);

  const added = currentSet.filter((item) => !prev.has(item)).length;
  const removed = previousSet.filter((item) => !curr.has(item)).length;

  let changed = 0;
  const prevMap = extractComparableMap(previousPayload);
  const currMap = extractComparableMap(currentPayload);
  prevMap.forEach((prevValue, id) => {
    const currentValue = currMap.get(id);
    if (currentValue && currentValue !== prevValue) {
      changed += 1;
    }
  });

  return {
    added,
    removed,
    changed,
    previousCount: previousSet.length,
    currentCount: currentSet.length,
  };
}

type OwnerRosterItem = {
  unitNumber: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  mailingAddress: string | null;
  ownershipPercentage: number | null;
  startDate: string | null;
};

type ContactRosterItem = {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  mailingAddress: string | null;
};

type AiIngestionImportSummary = {
  imported: boolean;
  dryRun: boolean;
  targetModule: string;
  sourceRecordId?: string;
  sourceRecordType?: string;
  sourceJobId?: string;
  destinationPlan?: DestinationRoutePlan | null;
  routeMatched?: boolean;
  unresolvedExceptionCount?: number;
  blockingExceptionCount?: number;
  unresolvedExceptions?: OwnerRosterUnresolvedException[];
  createdPersons: number;
  updatedPersons: number;
  createdUnits: number;
  createdOwnerships: number;
  createdVendorInvoices: number;
  createdOwnerLedgerEntries: number;
  createdVendorInvoiceIds: string[];
  createdOwnerLedgerEntryIds: string[];
  skippedRows: number;
  message: string;
  details: Array<{
    module: string;
    action: "create" | "update" | "skip";
    entityKey: string;
    reason: string;
    beforeJson?: unknown;
    afterJson?: unknown;
    suggestions?: string[];
  }>;
};

type BankStatementResolutionHint = {
  txIndex: number;
  reason: "missing-amount" | "invalid-date" | "unit-unresolved" | "person-unresolved";
  transaction: {
    unitNumber: string | null;
    ownerEmail: string | null;
    ownerName: string | null;
    amount: number | null;
    postedAt: string | null;
    description: string | null;
    entryType: "payment" | "charge" | "credit" | "adjustment";
  };
  unitCandidates: Array<{ unitId: string; unitNumber: string }>;
  personCandidates: Array<{ personId: string; name: string; email: string | null; unitNumbers: string[] }>;
};

type AiIngestionExtractionRecord = {
  recordType: "owner-roster" | "contact-roster" | "meeting-notes" | "invoice-draft" | "bank-statement" | "document-metadata";
  confidenceScore: number | null;
  payloadJson: Record<string, unknown>;
};

type AiIngestionExtractionClause = {
  title: string;
  clauseText: string;
  confidenceScore: number | null;
  tags: string[];
  suggestedLinks: Array<{
    entityType: string;
    entityId: string;
    confidenceScore: number | null;
  }>;
};

type AiIngestionExtractionResult = {
  records: AiIngestionExtractionRecord[];
  clauses: AiIngestionExtractionClause[];
};

type IngestionClassification = {
  predictedRecordType: AiIngestionExtractionRecord["recordType"];
  confidence: number;
  threshold: number;
  requiresManualReview: boolean;
  rationale: string;
  candidateTypes: Array<{ recordType: AiIngestionExtractionRecord["recordType"]; score: number }>;
};

type IngestionSourceFormat =
  | "structured-table"
  | "address-block-roster"
  | "delimited-list"
  | "freeform-text";

type OwnerRosterQuality = {
  score: number;
  warnings: string[];
  format: IngestionSourceFormat;
};

type NormalizedOwnerContact = {
  displayName: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
};

type NormalizedOwnerRosterEntry = {
  buildingAddress: string | null;
  unitNumber: string;
  ownerText: string;
  ownerCandidates: NormalizedOwnerContact[];
  phones: string[];
  emails: string[];
  notes: string[];
};

type OwnerRosterUnresolvedException = {
  kind: "unit-unresolved" | "contact-assignment-needed" | "owner-name-incomplete";
  unitNumber: string;
  message: string;
  blocking: boolean;
};

type CanonicalIngestionEntityType =
  | "building"
  | "unit"
  | "person"
  | "contact-point"
  | "ownership-candidate"
  | "bank-transaction"
  | "note"
  | "exception";

type CanonicalIngestionRouteTarget =
  | "units"
  | "persons"
  | "ownerships"
  | "contacts"
  | "owner-ledger"
  | "financial-invoices"
  | "exceptions"
  | "governance"
  | "metadata";

type CanonicalIngestionEntity = {
  id: string;
  entityType: CanonicalIngestionEntityType;
  routeTarget: CanonicalIngestionRouteTarget;
  routeStatus: "ready" | "needs-review";
  entityKey: string;
  relatedEntityIds: string[];
  attributes: Record<string, unknown>;
  sourceRefs: Array<{
    kind: string;
    index: number;
    path?: string;
  }>;
};

type CanonicalIngestionGraph = {
  version: 1;
  recordType: AiIngestionExtractionRecord["recordType"];
  contextSnapshot: {
    associationName: string | null;
    knownUnitNumbers: string[];
    knownBuildings: string[];
    knownOwnerNames: string[];
  };
  entities: CanonicalIngestionEntity[];
};

type AssociationIngestionContext = {
  knownUnitNumbers: string[];
  knownBuildings: string[];
  knownOwnerNames: string[];
  associationName: string | null;
  ownerRosterCorrectionHints?: AssociationOwnerRosterCorrectionHints;
  bankStatementCorrectionHints?: AssociationBankStatementCorrectionHints;
};

type IngestionTrace = {
  provider: "openai" | "fallback";
  model: string | null;
  fallbackReason: string | null;
};

type AssociationOwnerRosterCorrectionHints = {
  unitRemaps: Array<{
    fromUnitNumber: string;
    toUnitNumber: string;
    ownerText: string | null;
    buildingAddress: string | null;
  }>;
  ownerNameFixes: Array<{
    unitNumber: string;
    displayName: string;
    firstName: string;
    lastName: string;
  }>;
};

type AssociationBankStatementCorrectionHints = {
  transactionMappings: Array<{
    description: string | null;
    unitNumber: string | null;
    ownerEmail: string | null;
    ownerName: string | null;
  }>;
};

type FallbackParserStrategy = {
  format: IngestionSourceFormat | "bank-statement" | "invoice-draft" | "meeting-notes" | "document-metadata";
  appliesTo: (input: {
    job: AiIngestionJob;
    sourceText: string;
    format: IngestionSourceFormat;
  }) => boolean;
  build: (input: {
    job: AiIngestionJob;
    sourceText: string;
    ownerRosterCorrectionHints?: AssociationOwnerRosterCorrectionHints;
    bankStatementCorrectionHints?: AssociationBankStatementCorrectionHints;
  }) => AiIngestionExtractionResult;
};

type DestinationRoutePlan = {
  primaryModule: "owners" | "persons" | "owner-ledger" | "financial-invoices" | "governance" | "metadata";
  entityCounts: {
    units: number;
    persons: number;
    ownerships: number;
    contactPoints: number;
    ownerLedgerEntries: number;
    vendorInvoices: number;
    exceptions: number;
  };
  routeReason: string;
};

const DIRECT_TEXT_PARSEABLE_EXTENSIONS = new Set([
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

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeHeaderToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function splitStructuredColumns(rawLine: string): string[] {
  if (rawLine.includes("\t")) {
    return rawLine.split("\t").map((part) => part.trim());
  }
  if (rawLine.includes("|")) {
    return rawLine.split("|").map((part) => part.trim());
  }
  if (rawLine.includes(",")) {
    return rawLine.split(",").map((part) => part.trim());
  }
  return rawLine.split(/\s{2,}/).map((part) => part.trim());
}

function findColumnIndex(headers: string[], aliases: string[]): number {
  return headers.findIndex((header) => aliases.includes(header));
}

function detectIngestionSourceFormat(sourceText: string): IngestionSourceFormat {
  const lines = sourceText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 40);
  if (lines.length === 0) return "freeform-text";

  const tabularLines = lines.filter((line) => line.includes("\t") || line.includes("|") || line.includes(","));
  const addressLines = lines.filter((line) => looksLikeStreetAddress(line));
  const shortLeadingTokenLines = lines.filter((line) => /^[A-Z0-9-]{1,4}\s+[A-Za-z]/.test(line));

  if (tabularLines.length >= Math.max(2, Math.floor(lines.length * 0.35))) return "structured-table";
  if (addressLines.length >= 1 && shortLeadingTokenLines.length >= 2) return "address-block-roster";
  if (shortLeadingTokenLines.length >= Math.max(3, Math.floor(lines.length * 0.4))) return "delimited-list";
  return "freeform-text";
}

function normalizeUploadedText(rawText: string, extension: string): string {
  if (!rawText.trim()) return "";

  if (extension === ".json") {
    try {
      return JSON.stringify(JSON.parse(rawText), null, 2);
    } catch {
      return rawText;
    }
  }

  if (extension === ".html" || extension === ".htm" || extension === ".xml") {
    return rawText
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/\r/g, "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .join("\n");
  }

  return rawText;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringField(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stringListField(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim())
    : [];
}

function textBlockField(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!Array.isArray(value)) return null;
  const joined = value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim())
    .join("\n");
  return joined.trim() || null;
}

function normalizeLooseDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  const next = new Date(value);
  return Number.isNaN(next.getTime()) ? null : next;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

function xmlTextContent(xml: string): string {
  return decodeXmlEntities(
    xml
      .replace(/<w:tab\/>/g, "\t")
      .replace(/<w:br\/>/g, "\n")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<\/(?:row|tr)>/g, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\r/g, ""),
  )
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function extractZipEntries(buffer: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>();
  const eocdSignature = 0x06054b50;
  let eocdOffset = -1;
  for (let offset = Math.max(0, buffer.length - 65557); offset <= buffer.length - 22; offset += 1) {
    if (buffer.readUInt32LE(offset) === eocdSignature) {
      eocdOffset = offset;
    }
  }
  if (eocdOffset < 0) return entries;

  const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const centralEnd = centralDirectoryOffset + centralDirectorySize;
  let offset = centralDirectoryOffset;
  while (offset + 46 <= centralEnd && offset + 46 <= buffer.length) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileName = buffer.slice(offset + 46, offset + 46 + fileNameLength).toString("utf8");

    if (!fileName.endsWith("/")) {
      if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
        offset += 46 + fileNameLength + extraLength + commentLength;
        continue;
      }
      const localFileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
      const compressedData = buffer.slice(dataStart, dataStart + compressedSize);
      const content = compressionMethod === 0
        ? compressedData
        : (compressionMethod === 8 ? inflateRawSync(compressedData) : null);
      if (content) entries.set(fileName, content);
    }

    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
}

function extractDocxText(buffer: Buffer): string {
  const entries = extractZipEntries(buffer);
  const doc = entries.get("word/document.xml");
  if (!doc) return "";
  return xmlTextContent(doc.toString("utf8"));
}

function extractXlsxText(buffer: Buffer): string {
  const entries = extractZipEntries(buffer);
  const sharedStringsXml = entries.get("xl/sharedStrings.xml")?.toString("utf8") ?? "";
  const sharedStrings = Array.from(sharedStringsXml.matchAll(/<si[\s\S]*?<\/si>/g)).map((match) => xmlTextContent(match[0]));

  const workbookXml = entries.get("xl/workbook.xml")?.toString("utf8") ?? "";
  const relsXml = entries.get("xl/_rels/workbook.xml.rels")?.toString("utf8") ?? "";
  const relTargets = new Map<string, string>();
  for (const match of Array.from(relsXml.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g))) {
    relTargets.set(match[1], match[2]);
  }

  const sheets = Array.from(workbookXml.matchAll(/<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g))
    .map((match) => ({
      name: decodeXmlEntities(match[1]),
      target: relTargets.get(match[2]) || "",
    }))
    .filter((sheet) => sheet.target);

  const lines: string[] = [];
  for (const sheet of sheets) {
    const normalizedTarget = sheet.target.startsWith("xl/") ? sheet.target : `xl/${sheet.target.replace(/^\/+/, "")}`;
    const xml = entries.get(normalizedTarget)?.toString("utf8");
    if (!xml) continue;

    const rowValues: string[][] = [];
    for (const rowMatch of Array.from(xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g))) {
      const values: string[] = [];
      for (const cellMatch of Array.from(rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g))) {
        const attrs = cellMatch[1];
        const body = cellMatch[2];
        const typeMatch = attrs.match(/\bt="([^"]+)"/);
        const type = typeMatch?.[1] ?? "";
        let value = "";
        if (type === "s") {
          const index = Number((body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "").trim());
          value = Number.isFinite(index) ? (sharedStrings[index] ?? "") : "";
        } else if (type === "inlineStr") {
          value = xmlTextContent(body.match(/<is>([\s\S]*?)<\/is>/)?.[1] ?? body);
        } else {
          value = decodeXmlEntities((body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "").trim());
        }
        values.push(value);
      }
      if (values.some((value) => value.trim().length > 0)) {
        rowValues.push(values);
      }
    }

    if (rowValues.length > 0) {
      lines.push(`[Sheet] ${sheet.name}`);
      lines.push(...rowValues.map((row) => row.join("\t").trimEnd()));
      lines.push("");
    }
  }

  return lines.join("\n").trim();
}

async function extractUploadedText(filePath: string, extension: string): Promise<string> {
  if (DIRECT_TEXT_PARSEABLE_EXTENSIONS.has(extension)) {
    const rawText = await readFile(filePath, "utf8");
    return normalizeUploadedText(rawText, extension).trim();
  }

  if (extension === ".pdf") {
    const { stdout } = await execFileAsync("pdftotext", ["-layout", "-enc", "UTF-8", filePath, "-"], {
      maxBuffer: 10 * 1024 * 1024,
    });
    return stdout.trim();
  }

  if (extension === ".docx") {
    return extractDocxText(await readFile(filePath));
  }

  if (extension === ".xlsx") {
    return extractXlsxText(await readFile(filePath));
  }

  return "";
}

function classifyIngestionSource(job: AiIngestionJob, sourceText: string): IngestionClassification {
  const lower = sourceText.toLowerCase();
  const sourceName = (job.sourceFilename ?? "").toLowerCase();
  const context = (job.contextNotes ?? "").toLowerCase();
  const bucket = `${sourceName}\n${context}\n${lower.slice(0, 8000)}`;

  const scoreType = (terms: string[]): number => terms.reduce((acc, term) => acc + ((bucket.match(new RegExp(term, "g"))?.length ?? 0)), 0);
  const candidates: IngestionClassification["candidateTypes"] = [
    { recordType: "owner-roster", score: scoreType(["owner", "unit", "ownership", "mailing", "hoa roster"]) },
    { recordType: "contact-roster", score: scoreType(["contact", "phone", "email list", "directory"]) },
    { recordType: "invoice-draft", score: scoreType(["invoice", "vendor", "amount due", "bill", "po number"]) },
    { recordType: "bank-statement", score: scoreType(["statement", "transaction", "debit", "credit", "ending balance"]) },
    { recordType: "meeting-notes", score: scoreType(["meeting", "minutes", "agenda", "resolution", "motion"]) },
    { recordType: "document-metadata", score: 1 },
  ];
  candidates.sort((a, b) => b.score - a.score);

  const [top, second] = candidates;
  const dominance = top.score <= 0 ? 0 : (top.score - (second?.score ?? 0)) / Math.max(1, top.score);
  const richness = Math.min(1, sourceText.length / 3000);
  const confidence = Number(Math.max(0.35, Math.min(0.95, 0.45 + dominance * 0.35 + richness * 0.2)).toFixed(2));
  const thresholdByType: Record<AiIngestionExtractionRecord["recordType"], number> = {
    "owner-roster": 0.62,
    "contact-roster": 0.58,
    "invoice-draft": 0.6,
    "bank-statement": 0.62,
    "meeting-notes": 0.55,
    "document-metadata": 0.5,
  };
  const predictedRecordType = top.recordType;
  const threshold = thresholdByType[predictedRecordType];
  const requiresManualReview = confidence < threshold;
  const rationale = `Predicted ${predictedRecordType} (${Math.round(confidence * 100)}% confidence, threshold ${Math.round(threshold * 100)}%).`;

  return {
    predictedRecordType,
    confidence,
    threshold,
    requiresManualReview,
    rationale,
    candidateTypes: candidates,
  };
}

function parseName(fullName: string): { firstName: string; lastName: string } | null {
  const normalized = normalizeWhitespace(
    fullName
      .replace(/\s*&\s*.*/g, "")
      .replace(/^(mr|mrs|ms|dr)\.?\s+/i, "")
      .replace(/\s+(jr|sr|ii|iii|iv)\.?$/i, ""),
  );
  if (!normalized) return null;
  const parts = normalized.split(" ");
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "Unknown" };
  }
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

function parseOwnershipPercentage(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.match(/(\d+(?:\.\d+)?)\s*%?/);
  if (!match) return null;
  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(100, parsed));
}

function parseRosterDate(value: string | undefined): string | null {
  if (!value) return null;
  const normalized = normalizeWhitespace(value);
  if (!normalized) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function extractEmails(value: string): string[] {
  return Array.from(value.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi))
    .map((match) => match[0].toLowerCase());
}

function extractPhones(value: string): string[] {
  return Array.from(value.matchAll(/(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]*)\d{3}[-.\s]*\d{4}/g))
    .map((match) => normalizeWhitespace(match[0]));
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => normalizeWhitespace(value)).filter(Boolean)));
}

function canonicalizeEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = normalizeWhitespace(value).toLowerCase();
  return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(normalized) ? normalized : null;
}

function canonicalizePhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  const normalized = normalizeWhitespace(value);
  return normalized || null;
}

function canonicalizeAddress(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = normalizeWhitespace(
    value
      .replace(/[|`]/g, " ")
      .replace(/\s*,\s*/g, ", ")
      .replace(/\s{2,}/g, " "),
  );
  return normalized || null;
}

function canonicalizePersonNameParts(name: { firstName: string; lastName: string } | null): { firstName: string; lastName: string } | null {
  if (!name) return null;
  const firstName = normalizeWhitespace(name.firstName.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9'`.-]+$/g, ""));
  const lastName = normalizeWhitespace(name.lastName.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9'`.-]+$/g, ""));
  if (!firstName || !lastName) return null;
  return { firstName, lastName };
}

function canonicalizeOwnerRosterItem(item: OwnerRosterItem): OwnerRosterItem | null {
  const normalizedName = canonicalizePersonNameParts({ firstName: item.firstName, lastName: item.lastName });
  const unitNumber = parseUnitNumber(item.unitNumber);
  if (!normalizedName || !unitNumber) return null;
  return {
    unitNumber,
    firstName: normalizedName.firstName,
    lastName: normalizedName.lastName,
    email: canonicalizeEmail(item.email),
    phone: canonicalizePhone(item.phone),
    mailingAddress: canonicalizeAddress(item.mailingAddress),
    ownershipPercentage: item.ownershipPercentage == null ? null : Math.max(0, Math.min(100, Number(item.ownershipPercentage))),
    startDate: parseRosterDate(item.startDate ?? undefined),
  };
}

function canonicalizeContactRosterItem(item: ContactRosterItem): ContactRosterItem | null {
  const normalizedName = canonicalizePersonNameParts({ firstName: item.firstName, lastName: item.lastName });
  if (!normalizedName) return null;
  const email = canonicalizeEmail(item.email);
  const phone = canonicalizePhone(item.phone);
  if (!email && !phone) return null;
  return {
    firstName: normalizedName.firstName,
    lastName: normalizedName.lastName,
    email,
    phone,
    mailingAddress: canonicalizeAddress(item.mailingAddress),
  };
}

function parseUnitNumber(value: string | undefined): string {
  if (!value) return "";
  const normalized = normalizeWhitespace(value);
  if (!normalized) return "";
  const labeledMatch = normalized.match(/(?:unit|apt|apartment|suite|ste|lot|home|space|#)\s*[:#-]?\s*([A-Z0-9-]+)/i);
  if (labeledMatch) return labeledMatch[1].toUpperCase();
  if (/^[A-Z0-9-]+$/i.test(normalized)) return normalized.toUpperCase();
  const tokenMatch = normalized.match(/\b([A-Z]?\d+[A-Z0-9-]*|[A-Z]{1,3}-\d+[A-Z0-9-]*)\b/i);
  return tokenMatch?.[1]?.toUpperCase() ?? "";
}

function parseOwnerRosterRowFromHeaders(columns: string[], headers: string[]): OwnerRosterItem | null {
  const unitIndex = findColumnIndex(headers, ["unit", "unitnumber", "unitno", "unitid", "lot", "lotnumber", "suite", "apartment", "apt"]);
  const nameIndex = findColumnIndex(headers, ["owner", "ownername", "name", "fullname", "ownerfullname"]);
  const firstNameIndex = findColumnIndex(headers, ["firstname", "first", "givenname"]);
  const lastNameIndex = findColumnIndex(headers, ["lastname", "last", "surname", "familyname"]);
  const emailIndex = findColumnIndex(headers, ["email", "emailaddress", "emailaddr", "e-mail"]);
  const phoneIndex = findColumnIndex(headers, ["phone", "phonenumber", "telephone", "mobile", "cell"]);
  const addressIndex = findColumnIndex(headers, ["address", "mailingaddress", "mailing", "mailaddress", "streetaddress"]);
  const percentageIndex = findColumnIndex(headers, ["ownership", "ownershippercentage", "ownershippct", "percentage", "percent"]);
  const startDateIndex = findColumnIndex(headers, ["startdate", "start", "purchasedate", "closedate", "effectivedate"]);

  const unitNumber = parseUnitNumber(unitIndex >= 0 ? columns[unitIndex] : undefined);
  if (!unitNumber) return null;

  const parsedName =
    firstNameIndex >= 0 || lastNameIndex >= 0
      ? {
          firstName: normalizeWhitespace(firstNameIndex >= 0 ? columns[firstNameIndex] ?? "" : ""),
          lastName: normalizeWhitespace(lastNameIndex >= 0 ? columns[lastNameIndex] ?? "" : ""),
        }
      : parseName(nameIndex >= 0 ? columns[nameIndex] ?? "" : "");
  if (!parsedName?.firstName || !parsedName?.lastName) return null;

  return {
    unitNumber,
    firstName: parsedName.firstName,
    lastName: parsedName.lastName,
    email: emailIndex >= 0 && columns[emailIndex] ? columns[emailIndex].trim().toLowerCase() || null : null,
    phone: phoneIndex >= 0 && columns[phoneIndex] ? normalizeWhitespace(columns[phoneIndex]) || null : null,
    mailingAddress: addressIndex >= 0 && columns[addressIndex] ? normalizeWhitespace(columns[addressIndex]) || null : null,
    ownershipPercentage: parseOwnershipPercentage(percentageIndex >= 0 ? columns[percentageIndex] : undefined),
    startDate: parseRosterDate(startDateIndex >= 0 ? columns[startDateIndex] : undefined),
  };
}

function looksLikeStreetAddress(line: string): boolean {
  return /\b\d{2,6}\s+.+\b(?:ave|avenue|st|street|rd|road|dr|drive|blvd|boulevard|ln|lane|ct|court|pl|place|way)\b/i.test(line)
    || /\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/i.test(line);
}

function parseOwnerCandidates(ownerText: string): { candidates: NormalizedOwnerContact[]; notes: string[] } {
  const notes: string[] = [];
  let working = normalizeWhitespace(ownerText);
  if (!working) return { candidates: [], notes };

  const parenNotes = Array.from(working.matchAll(/\(([^)]+)\)/g)).map((match) => normalizeWhitespace(match[1]));
  notes.push(...parenNotes);
  working = normalizeWhitespace(working.replace(/\(([^)]+)\)/g, " "));

  const akaMatch = working.match(/\bAKA\b\s+(.+)$/i);
  if (akaMatch) {
    notes.push(`AKA ${normalizeWhitespace(akaMatch[1])}`);
    working = normalizeWhitespace(working.replace(/\bAKA\b\s+(.+)$/i, " "));
  }

  const colonNotes = working.match(/\:\s*(.+)$/);
  if (colonNotes) {
    notes.push(normalizeWhitespace(colonNotes[1]));
    working = normalizeWhitespace(working.replace(/\:\s*(.+)$/, " "));
  }

  const hyphenNote = working.match(/\s-\s(.+)$/);
  if (hyphenNote) {
    notes.push(normalizeWhitespace(hyphenNote[1]));
    working = normalizeWhitespace(working.replace(/\s-\s(.+)$/, " "));
  }

  working = normalizeWhitespace(working.replace(/\b(?:owner|owners)\b/gi, " "));
  if (!working) return { candidates: [], notes: dedupeStrings(notes) };

  if (/\b(?:llc|inc|corp|co|trust|estate)\b/i.test(working)) {
    const parsed = parseName(working);
    return {
      candidates: parsed ? [{ displayName: working, firstName: parsed.firstName, lastName: parsed.lastName }] : [],
      notes: dedupeStrings(notes),
    };
  }

  if (working.includes("&") || /\band\b/i.test(working)) {
    const standardized = working.replace(/\s*&\s*/g, " and ");
    const parts = standardized.split(/\s+and\s+/i).map((part) => normalizeWhitespace(part)).filter(Boolean);
    if (parts.length === 2) {
      const [left, right] = parts;
      const leftTokens = left.split(" ");
      const rightTokens = right.split(" ");
      if (leftTokens.length === 1 && rightTokens.length >= 2) {
        const sharedLast = rightTokens[rightTokens.length - 1];
        return {
          candidates: [
            { displayName: `${left} ${sharedLast}`, firstName: left, lastName: sharedLast, email: null, phone: null },
            { displayName: right, firstName: rightTokens.slice(0, -1).join(" "), lastName: sharedLast, email: null, phone: null },
          ],
          notes: dedupeStrings(notes),
        };
      }
      const parsedCandidates: NormalizedOwnerContact[] = parts.flatMap((part) => {
        const parsed = parseName(part);
        if (!parsed) return [];
        return [{ displayName: part, firstName: parsed.firstName, lastName: parsed.lastName, email: null, phone: null }];
      });
      if (parsedCandidates.length > 0) {
        return { candidates: parsedCandidates, notes: dedupeStrings(notes) };
      }
    }
  }

  const parsed = parseName(working);
  return {
    candidates: parsed ? [{ displayName: working, firstName: parsed.firstName, lastName: parsed.lastName, email: null, phone: null }] : [],
    notes: dedupeStrings(notes),
  };
}

function normalizeOwnerRosterAddressBlocks(sourceText: string): NormalizedOwnerRosterEntry[] {
  const lines = sourceText
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);
  if (!lines.length) return [];

  const parsedEntries: NormalizedOwnerRosterEntry[] = [];
  let currentAddress: string | null = null;

  for (const line of lines) {
    const emails = extractEmails(line);
    const phones = extractPhones(line);

    if (looksLikeStreetAddress(line) && emails.length === 0 && phones.length === 0) {
      currentAddress = line;
      continue;
    }
    if (/^unit\s*#?/i.test(line)) continue;

    const cleaned = normalizeWhitespace(
      line
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, " ")
        .replace(/(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]*)\d{3}[-.\s]*\d{4}/g, " ")
        .replace(/[|,`]/g, " "),
    );
    const unitMatch = cleaned.match(/^([A-Z0-9-]{1,4})\b\s*(.*)$/i);
    if (!unitMatch) continue;

    const unitToken = unitMatch[1].toUpperCase();
    const unitLooksValid = /^[A-Z0-9-]{1,4}$/i.test(unitToken);
    if (!unitLooksValid) continue;

    let ownerText = normalizeWhitespace(unitMatch[2]);
    if (!ownerText) continue;
    ownerText = ownerText.replace(/^\#/, "").trim();

    const { candidates, notes } = parseOwnerCandidates(ownerText);
    if (candidates.length === 0) continue;

    parsedEntries.push({
      buildingAddress: currentAddress,
      unitNumber: unitToken,
      ownerText,
      ownerCandidates: candidates,
      phones: dedupeStrings(phones),
      emails: dedupeStrings(emails),
      notes,
    });
  }

  return parsedEntries;
}

function buildOwnerRosterItemsFromNormalizedEntries(entries: NormalizedOwnerRosterEntry[]): OwnerRosterItem[] {
  return entries.flatMap((entry) => {
    const candidateCount = entry.ownerCandidates.length;
    const ownershipPercentage = candidateCount > 1 ? Number((100 / candidateCount).toFixed(2)) : null;
    return entry.ownerCandidates.map((candidate, index) => ({
      unitNumber: entry.unitNumber,
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      email: candidate.email ?? entry.emails[index] ?? entry.emails[0] ?? null,
      phone: candidate.phone ?? entry.phones[index] ?? entry.phones[0] ?? null,
      mailingAddress: entry.buildingAddress,
      ownershipPercentage,
      startDate: null,
    }));
  });
}

function applyOwnerRosterCorrectionHints(
  entries: NormalizedOwnerRosterEntry[],
  hints?: AssociationOwnerRosterCorrectionHints,
): NormalizedOwnerRosterEntry[] {
  if (!hints || (!hints.unitRemaps.length && !hints.ownerNameFixes.length)) return entries;

  return entries.map((entry) => {
    const matchingUnitRemap = hints.unitRemaps.find((hint) => {
      if (hint.fromUnitNumber.toUpperCase() !== entry.unitNumber.toUpperCase()) return false;
      if (hint.ownerText && normalizeWhitespace(hint.ownerText).toUpperCase() !== normalizeWhitespace(entry.ownerText).toUpperCase()) return false;
      if (hint.buildingAddress && normalizeWhitespace(hint.buildingAddress).toUpperCase() !== normalizeWhitespace(entry.buildingAddress ?? "").toUpperCase()) return false;
      return true;
    });

    const ownerCandidates = entry.ownerCandidates.map((candidate) => {
      const matchingNameFix = hints.ownerNameFixes.find((hint) => (
        hint.unitNumber.toUpperCase() === (matchingUnitRemap?.toUnitNumber ?? entry.unitNumber).toUpperCase()
          && normalizeWhitespace(hint.displayName).toUpperCase() === normalizeWhitespace(candidate.displayName).toUpperCase()
      ));
      if (!matchingNameFix) return candidate;
      return {
        ...candidate,
        firstName: matchingNameFix.firstName,
        lastName: matchingNameFix.lastName,
      };
    });

    return {
      ...entry,
      unitNumber: matchingUnitRemap?.toUnitNumber ?? entry.unitNumber,
      ownerCandidates,
    };
  });
}

function parseOwnerRosterFromAddressBlocks(
  sourceText: string,
  hints?: AssociationOwnerRosterCorrectionHints,
): { entries: NormalizedOwnerRosterEntry[]; items: OwnerRosterItem[] } {
  const entries = applyOwnerRosterCorrectionHints(normalizeOwnerRosterAddressBlocks(sourceText), hints);
  return {
    entries,
    items: buildOwnerRosterItemsFromNormalizedEntries(entries),
  };
}

function ownerRosterLooksCorrupted(items: OwnerRosterItem[]): boolean {
  if (items.length === 0) return false;
  let suspicious = 0;
  for (const item of items) {
    if (item.lastName === "Unknown") suspicious += 1;
    if (item.firstName.length === 1) suspicious += 1;
    if (item.unitNumber.length > 4) suspicious += 1;
    if (/^(new|haven|ave|street|road)$/i.test(item.unitNumber)) suspicious += 2;
    if (looksLikeStreetAddress(`${item.firstName} ${item.lastName}`)) suspicious += 2;
    if (/^\d/.test(item.firstName)) suspicious += 2;
  }
  return suspicious / items.length >= 1.25;
}

function scoreOwnerRosterItems(items: OwnerRosterItem[], sourceText: string): OwnerRosterQuality {
  const format = detectIngestionSourceFormat(sourceText);
  if (items.length === 0) {
    return {
      score: 0,
      warnings: ["No owner rows were extracted."],
      format,
    };
  }

  let validUnits = 0;
  let validNames = 0;
  let contactCoverage = 0;
  let suspiciousUnits = 0;
  let suspiciousNames = 0;

  for (const item of items) {
    if (/^[A-Z0-9-]{1,6}$/.test(item.unitNumber) && !/^(new|haven|ave|street|road|owner)$/i.test(item.unitNumber)) {
      validUnits += 1;
    } else {
      suspiciousUnits += 1;
    }

    const fullName = `${item.firstName} ${item.lastName}`.trim();
    const looksNamed = item.firstName.length > 1 && item.lastName.length > 1 && item.lastName !== "Unknown";
    if (looksNamed && !looksLikeStreetAddress(fullName) && !/^\d/.test(item.firstName)) {
      validNames += 1;
    } else {
      suspiciousNames += 1;
    }

    if (item.email || item.phone) contactCoverage += 1;
  }

  const unitRate = validUnits / items.length;
  const nameRate = validNames / items.length;
  const contactRate = contactCoverage / items.length;
  const suspiciousRate = (suspiciousUnits + suspiciousNames) / Math.max(items.length, 1);
  const score = Number(Math.max(0, Math.min(1, (unitRate * 0.4) + (nameRate * 0.4) + (contactRate * 0.2) - (suspiciousRate * 0.25))).toFixed(2));
  const warnings: string[] = [];

  if (unitRate < 0.8) warnings.push("Many extracted rows have weak or invalid unit identifiers.");
  if (nameRate < 0.8) warnings.push("Many extracted rows have incomplete owner names.");
  if (contactRate < 0.5) warnings.push("Contact coverage is low across extracted rows.");
  if (ownerRosterLooksCorrupted(items)) warnings.push("Extracted rows look structurally corrupted for an owner roster.");

  return { score, warnings, format };
}

function chooseBestOwnerRosterItems(
  sourceText: string,
  aiItems: OwnerRosterItem[],
  hints?: AssociationOwnerRosterCorrectionHints,
): { items: OwnerRosterItem[]; quality: OwnerRosterQuality; strategy: "ai" | "deterministic-parser" | "merged"; normalizedEntries: NormalizedOwnerRosterEntry[] } {
  const normalizedBlock = parseOwnerRosterFromAddressBlocks(sourceText, hints);
  const parsedItems = normalizedBlock.items.length > 0 ? normalizedBlock.items : parseOwnerRosterText(sourceText);
  const aiQuality = scoreOwnerRosterItems(aiItems, sourceText);
  const parsedQuality = scoreOwnerRosterItems(parsedItems, sourceText);

  if (aiItems.length === 0) {
    return { items: parsedItems, quality: parsedQuality, strategy: "deterministic-parser", normalizedEntries: normalizedBlock.entries };
  }
  if (parsedItems.length === 0) {
    return { items: aiItems, quality: aiQuality, strategy: "ai", normalizedEntries: [] };
  }
  if (ownerRosterLooksCorrupted(aiItems) || parsedQuality.score >= aiQuality.score + 0.15) {
    return { items: parsedItems, quality: parsedQuality, strategy: "deterministic-parser", normalizedEntries: normalizedBlock.entries };
  }

  const mergedItems = mergeOwnerRosterItems(aiItems, parsedItems);
  const mergedQuality = scoreOwnerRosterItems(mergedItems, sourceText);
  if (mergedQuality.score >= aiQuality.score && mergedQuality.score >= parsedQuality.score) {
    return { items: mergedItems, quality: mergedQuality, strategy: "merged", normalizedEntries: normalizedBlock.entries };
  }

  return aiQuality.score >= parsedQuality.score
    ? { items: aiItems, quality: aiQuality, strategy: "ai", normalizedEntries: [] }
    : { items: parsedItems, quality: parsedQuality, strategy: "deterministic-parser", normalizedEntries: normalizedBlock.entries };
}

function parseContactRosterRowFromHeaders(columns: string[], headers: string[]): ContactRosterItem | null {
  const nameIndex = findColumnIndex(headers, ["owner", "ownername", "name", "fullname", "contact", "contactname"]);
  const firstNameIndex = findColumnIndex(headers, ["firstname", "first", "givenname"]);
  const lastNameIndex = findColumnIndex(headers, ["lastname", "last", "surname", "familyname"]);
  const emailIndex = findColumnIndex(headers, ["email", "emailaddress", "emailaddr", "e-mail"]);
  const phoneIndex = findColumnIndex(headers, ["phone", "phonenumber", "telephone", "mobile", "cell"]);
  const addressIndex = findColumnIndex(headers, ["address", "mailingaddress", "mailing", "mailaddress", "streetaddress"]);

  const parsedName =
    firstNameIndex >= 0 || lastNameIndex >= 0
      ? {
          firstName: normalizeWhitespace(firstNameIndex >= 0 ? columns[firstNameIndex] ?? "" : ""),
          lastName: normalizeWhitespace(lastNameIndex >= 0 ? columns[lastNameIndex] ?? "" : ""),
        }
      : parseName(nameIndex >= 0 ? columns[nameIndex] ?? "" : "");
  if (!parsedName?.firstName || !parsedName?.lastName) return null;

  const email = emailIndex >= 0 && columns[emailIndex] ? columns[emailIndex].trim().toLowerCase() || null : null;
  const phone = phoneIndex >= 0 && columns[phoneIndex] ? normalizeWhitespace(columns[phoneIndex]) || null : null;
  if (!email && !phone) return null;

  return {
    firstName: parsedName.firstName,
    lastName: parsedName.lastName,
    email,
    phone,
    mailingAddress: addressIndex >= 0 && columns[addressIndex] ? normalizeWhitespace(columns[addressIndex]) || null : null,
  };
}

function parseOwnerRosterText(sourceText: string): OwnerRosterItem[] {
  const lines = sourceText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
  const phoneRegex = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]*)\d{3}[-.\s]*\d{4}/;
  const dateRegex = /\b\d{4}-\d{2}-\d{2}\b/;
  const headerKeywords = /(unit|owner|name|email|phone|address|mailing)/i;
  const parsedItems: OwnerRosterItem[] = [];
  const structuredRows = lines.map((line) => splitStructuredColumns(line));
  const normalizedHeaders = structuredRows[0]?.map((part) => normalizeHeaderToken(part)) ?? [];
  const recognizedHeaderCount = normalizedHeaders.filter((header) =>
    ["unit", "unitnumber", "unitno", "owner", "ownername", "name", "firstname", "lastname", "email", "phone", "address", "mailingaddress", "ownershippercentage", "percent", "startdate"].includes(header),
  ).length;
  const addressBlock = parseOwnerRosterFromAddressBlocks(sourceText);
  if (addressBlock.items.length > 0) {
    return addressBlock.items;
  }

  if (recognizedHeaderCount >= 2 && normalizedHeaders.length >= 2) {
    for (const columns of structuredRows.slice(1)) {
      const item = parseOwnerRosterRowFromHeaders(columns, normalizedHeaders);
      if (item) {
        const canonical = canonicalizeOwnerRosterItem(item);
        if (canonical) parsedItems.push(canonical);
      }
    }
    if (parsedItems.length > 0) return parsedItems;
  }

  for (const rawLine of lines) {
    if (headerKeywords.test(rawLine) && !emailRegex.test(rawLine) && !phoneRegex.test(rawLine)) {
      continue;
    }

    const columns = splitStructuredColumns(rawLine);

    if (columns.length < 2) continue;

    const email = columns.find((part) => emailRegex.test(part))?.match(emailRegex)?.[0] ?? null;
    const phone = columns.find((part) => phoneRegex.test(part))?.match(phoneRegex)?.[0] ?? null;
    const startDate = columns.find((part) => dateRegex.test(part))?.match(dateRegex)?.[0] ?? null;
    const percentage = parseOwnershipPercentage(columns.find((part) => /%/.test(part)));

    const lowerColumns = columns.map((part) => part.toLowerCase());
    const nameIndex = lowerColumns.findIndex((part) => !emailRegex.test(part) && !phoneRegex.test(part) && !dateRegex.test(part) && !/%/.test(part) && /[a-z]/i.test(part));
    if (nameIndex === -1) continue;

    let unitNumber = "";
    for (let i = 0; i < columns.length; i += 1) {
      if (i === nameIndex) continue;
      const column = columns[i];
      if (emailRegex.test(column) || phoneRegex.test(column) || dateRegex.test(column) || /%/.test(column)) continue;
      const parsedUnit = parseUnitNumber(column);
      if (parsedUnit) {
        unitNumber = parsedUnit;
        break;
      }
    }
    if (!unitNumber) continue;

    const parsedName = parseName(columns[nameIndex]);
    if (!parsedName) continue;

    const mailingAddress = columns
      .filter((part, index) => index !== nameIndex)
      .filter((part) => !emailRegex.test(part) && !phoneRegex.test(part) && !dateRegex.test(part) && !/%/.test(part))
      .slice(1)
      .join(", ")
      .trim() || null;

    const canonical = canonicalizeOwnerRosterItem({
      unitNumber,
      firstName: parsedName.firstName,
      lastName: parsedName.lastName,
      email,
      phone,
      mailingAddress,
      ownershipPercentage: percentage,
      startDate,
    });
    if (canonical) parsedItems.push(canonical);
  }

  return parsedItems;
}

function parseContactRosterText(sourceText: string): ContactRosterItem[] {
  const lines = sourceText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
  const phoneRegex = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]*)\d{3}[-.\s]*\d{4}/;
  const headerKeywords = /(owner|name|email|phone|address|mailing|contact)/i;
  const parsedItems: ContactRosterItem[] = [];
  const structuredRows = lines.map((line) => splitStructuredColumns(line));
  const normalizedHeaders = structuredRows[0]?.map((part) => normalizeHeaderToken(part)) ?? [];
  const recognizedHeaderCount = normalizedHeaders.filter((header) =>
    ["owner", "ownername", "name", "firstname", "lastname", "contact", "contactname", "email", "phone", "address", "mailingaddress"].includes(header),
  ).length;

  if (recognizedHeaderCount >= 2 && normalizedHeaders.length >= 2) {
    for (const columns of structuredRows.slice(1)) {
      const item = parseContactRosterRowFromHeaders(columns, normalizedHeaders);
      if (item) {
        const canonical = canonicalizeContactRosterItem(item);
        if (canonical) parsedItems.push(canonical);
      }
    }
    if (parsedItems.length > 0) return parsedItems;
  }

  for (const rawLine of lines) {
    if (headerKeywords.test(rawLine) && !emailRegex.test(rawLine) && !phoneRegex.test(rawLine)) {
      continue;
    }

    const columns = splitStructuredColumns(rawLine);

    if (columns.length < 1) continue;

    const email = columns.find((part) => emailRegex.test(part))?.match(emailRegex)?.[0]?.toLowerCase() ?? null;
    const phone = columns.find((part) => phoneRegex.test(part))?.match(phoneRegex)?.[0] ?? null;
    const namePart = columns.find((part) => !emailRegex.test(part) && !phoneRegex.test(part) && /[a-z]/i.test(part)) ?? "";
    const parsedName = parseName(namePart);
    if (!parsedName) continue;
    if (!email && !phone) continue;

    const mailingAddress = columns
      .filter((part) => part !== namePart)
      .filter((part) => !emailRegex.test(part) && !phoneRegex.test(part))
      .join(", ")
      .trim() || null;

    const canonical = canonicalizeContactRosterItem({
      firstName: parsedName.firstName,
      lastName: parsedName.lastName,
      email,
      phone,
      mailingAddress,
    });
    if (canonical) parsedItems.push(canonical);
  }

  return parsedItems;
}

function buildOwnerRosterKey(item: Pick<OwnerRosterItem, "unitNumber" | "firstName" | "lastName" | "email">): string {
  const unit = item.unitNumber.trim().toUpperCase();
  const email = item.email?.trim().toLowerCase() ?? "";
  const firstName = item.firstName.trim().toLowerCase();
  const lastName = item.lastName.trim().toLowerCase();
  return `${unit}|${email || `${firstName}|${lastName}`}`;
}

function buildContactRosterKey(item: Pick<ContactRosterItem, "firstName" | "lastName" | "email">): string {
  const email = item.email?.trim().toLowerCase() ?? "";
  const firstName = item.firstName.trim().toLowerCase();
  const lastName = item.lastName.trim().toLowerCase();
  return email || `${firstName}|${lastName}`;
}

function mergeOwnerRosterItems(primaryItems: OwnerRosterItem[], fallbackItems: OwnerRosterItem[]): OwnerRosterItem[] {
  if (fallbackItems.length === 0) return primaryItems;
  if (ownerRosterLooksCorrupted(primaryItems) && fallbackItems.length > 0) {
    return fallbackItems;
  }
  const fallbackByKey = new Map(fallbackItems.map((item) => [buildOwnerRosterKey(item), item]));
  const merged = primaryItems.map((item) => {
    const fallback = fallbackByKey.get(buildOwnerRosterKey(item));
    if (!fallback) return item;
    return {
      ...item,
      email: item.email ?? fallback.email,
      phone: item.phone ?? fallback.phone,
      mailingAddress: item.mailingAddress ?? fallback.mailingAddress,
      ownershipPercentage: item.ownershipPercentage ?? fallback.ownershipPercentage,
      startDate: item.startDate ?? fallback.startDate,
    };
  });
  const primaryKeys = new Set(primaryItems.map((item) => buildOwnerRosterKey(item)));
  const unmatchedFallback = fallbackItems.filter((item) => !primaryKeys.has(buildOwnerRosterKey(item)));
  return [...merged, ...unmatchedFallback];
}

function mergeContactRosterItems(primaryItems: ContactRosterItem[], fallbackItems: ContactRosterItem[]): ContactRosterItem[] {
  if (fallbackItems.length === 0) return primaryItems;
  const fallbackByKey = new Map(fallbackItems.map((item) => [buildContactRosterKey(item), item]));
  const merged = primaryItems.map((item) => {
    const fallback = fallbackByKey.get(buildContactRosterKey(item));
    if (!fallback) return item;
    return {
      ...item,
      email: item.email ?? fallback.email,
      phone: item.phone ?? fallback.phone,
      mailingAddress: item.mailingAddress ?? fallback.mailingAddress,
    };
  });
  const primaryKeys = new Set(primaryItems.map((item) => buildContactRosterKey(item)));
  const unmatchedFallback = fallbackItems.filter((item) => !primaryKeys.has(buildContactRosterKey(item)));
  return [...merged, ...unmatchedFallback];
}

function attachIngestionTrace(payloadJson: Record<string, unknown>, trace: IngestionTrace): Record<string, unknown> {
  return {
    ...payloadJson,
    _ingestionTrace: trace,
  };
}

function extractOwnerRosterItems(payload: unknown): OwnerRosterItem[] {
  if (!payload || typeof payload !== "object") return [];
  const items = (payload as Record<string, unknown>).items;
  if (!Array.isArray(items)) {
    return extractCanonicalOwnerImportRows(payload).map((row) => ({
      unitNumber: row.unitNumber,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.contactPoints.find((contact) => contact.channel === "email" && contact.isPrimary)?.value
        ?? row.contactPoints.find((contact) => contact.channel === "email")?.value
        ?? null,
      phone: row.contactPoints.find((contact) => contact.channel === "phone" && contact.isPrimary)?.value
        ?? row.contactPoints.find((contact) => contact.channel === "phone")?.value
        ?? null,
      mailingAddress: row.mailingAddress,
      ownershipPercentage: row.ownershipPercentage,
      startDate: null,
    }));
  }

  return items.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const unitNumber = typeof row.unitNumber === "string" ? normalizeWhitespace(row.unitNumber).toUpperCase() : "";
    const firstName = typeof row.firstName === "string" ? normalizeWhitespace(row.firstName) : "";
    const lastName = typeof row.lastName === "string" ? normalizeWhitespace(row.lastName) : "";
    if (!unitNumber || !firstName || !lastName) return [];

    return [{
      unitNumber,
      firstName,
      lastName,
      email: typeof row.email === "string" && row.email.trim() ? row.email.trim().toLowerCase() : null,
      phone: typeof row.phone === "string" && row.phone.trim() ? row.phone.trim() : null,
      mailingAddress: typeof row.mailingAddress === "string" && row.mailingAddress.trim() ? row.mailingAddress.trim() : null,
      ownershipPercentage: typeof row.ownershipPercentage === "number" ? row.ownershipPercentage : null,
      startDate: typeof row.startDate === "string" && row.startDate.trim() ? row.startDate.trim() : null,
    }];
  });
}

function extractNormalizedOwnerRosterEntries(payload: unknown): NormalizedOwnerRosterEntry[] {
  if (!payload || typeof payload !== "object") return [];
  const entries = (payload as Record<string, unknown>).normalizedEntries;
  if (!Array.isArray(entries)) return [];

  return entries.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    const unitNumber = typeof row.unitNumber === "string" ? normalizeWhitespace(row.unitNumber).toUpperCase() : "";
    if (!unitNumber) return [];

    const ownerCandidates = Array.isArray(row.ownerCandidates)
      ? row.ownerCandidates.flatMap((candidate) => {
          if (!candidate || typeof candidate !== "object") return [];
          const value = candidate as Record<string, unknown>;
          const firstName = typeof value.firstName === "string" ? normalizeWhitespace(value.firstName) : "";
          const lastName = typeof value.lastName === "string" ? normalizeWhitespace(value.lastName) : "";
          const displayName = typeof value.displayName === "string" ? normalizeWhitespace(value.displayName) : `${firstName} ${lastName}`.trim();
          if (!firstName || !lastName) return [];
          return [{
            firstName,
            lastName,
            displayName,
            email: typeof value.email === "string" && value.email.trim() ? value.email.trim().toLowerCase() : null,
            phone: typeof value.phone === "string" && value.phone.trim() ? normalizeWhitespace(value.phone) : null,
          }];
        })
      : [];
    if (ownerCandidates.length === 0) return [];

    const emails = Array.isArray(row.emails) ? row.emails.filter((value): value is string => typeof value === "string").map((value) => value.trim().toLowerCase()).filter(Boolean) : [];
    const phones = Array.isArray(row.phones) ? row.phones.filter((value): value is string => typeof value === "string").map((value) => normalizeWhitespace(value)).filter(Boolean) : [];
    const notes = Array.isArray(row.notes) ? row.notes.filter((value): value is string => typeof value === "string").map((value) => normalizeWhitespace(value)).filter(Boolean) : [];

    return [{
      buildingAddress: typeof row.buildingAddress === "string" && row.buildingAddress.trim() ? row.buildingAddress.trim() : null,
      unitNumber,
      ownerText: typeof row.ownerText === "string" ? normalizeWhitespace(row.ownerText) : ownerCandidates.map((candidate) => candidate.displayName).join(" / "),
      ownerCandidates,
      emails,
      phones,
      notes,
    }];
  });
}

function getOwnerRosterQuality(payload: unknown): OwnerRosterQuality | null {
  if (!payload || typeof payload !== "object") return null;
  const quality = (payload as Record<string, unknown>).extractionQuality;
  if (!quality || typeof quality !== "object" || Array.isArray(quality)) return null;
  const row = quality as Record<string, unknown>;
  return {
    score: typeof row.score === "number" ? row.score : 0,
    warnings: Array.isArray(row.warnings) ? row.warnings.filter((value): value is string => typeof value === "string") : [],
    format: row.format === "structured-table" || row.format === "address-block-roster" || row.format === "delimited-list" || row.format === "freeform-text"
      ? row.format
      : "freeform-text",
  };
}

function buildOwnerRosterUnresolvedExceptions(
  entries: NormalizedOwnerRosterEntry[],
  knownUnitNumbers: string[] = [],
): OwnerRosterUnresolvedException[] {
  const knownUnits = new Set(knownUnitNumbers.map((value) => value.toUpperCase()));
  const exceptions: OwnerRosterUnresolvedException[] = [];

  for (const entry of entries) {
    if (knownUnits.size > 0 && !knownUnits.has(entry.unitNumber.toUpperCase())) {
      exceptions.push({
        kind: "unit-unresolved",
        unitNumber: entry.unitNumber,
        message: `Unit ${entry.unitNumber} does not match an existing unit in the selected association.`,
        blocking: false,
      });
    }

    if (entry.ownerCandidates.length > 1) {
      const hasSharedEmails = entry.emails.length > 0 && entry.ownerCandidates.some((candidate) => !candidate.email);
      const hasSharedPhones = entry.phones.length > 0 && entry.ownerCandidates.some((candidate) => !candidate.phone);
      if (hasSharedEmails || hasSharedPhones) {
        exceptions.push({
          kind: "contact-assignment-needed",
          unitNumber: entry.unitNumber,
          message: `Unit ${entry.unitNumber} has multiple owners with shared contact data that should be assigned explicitly.`,
          blocking: true,
        });
      }
    }

    for (const candidate of entry.ownerCandidates) {
      if (!candidate.firstName.trim() || !candidate.lastName.trim()) {
        exceptions.push({
          kind: "owner-name-incomplete",
          unitNumber: entry.unitNumber,
          message: `Unit ${entry.unitNumber} has an owner candidate with incomplete first/last name.`,
          blocking: true,
        });
      }
    }
  }

  return exceptions;
}

function extractAssociationOwnerRosterCorrectionHintsFromPayload(payload: unknown): AssociationOwnerRosterCorrectionHints {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { unitRemaps: [], ownerNameFixes: [] };
  }

  const row = payload as Record<string, unknown>;
  const operatorCorrections = Array.isArray(row.operatorCorrections) ? row.operatorCorrections : [];
  const normalizedEntries = extractNormalizedOwnerRosterEntries(payload);
  const unitRemaps: AssociationOwnerRosterCorrectionHints["unitRemaps"] = [];
  const ownerNameFixes: AssociationOwnerRosterCorrectionHints["ownerNameFixes"] = [];

  for (const correction of operatorCorrections) {
    if (!correction || typeof correction !== "object" || Array.isArray(correction)) continue;
    const item = correction as Record<string, unknown>;
    const entryIndex = typeof item.entryIndex === "number" ? item.entryIndex : -1;
    const candidateIndex = typeof item.candidateIndex === "number" ? item.candidateIndex : -1;
    const field = typeof item.field === "string" ? item.field : "";
    const kind = typeof item.kind === "string" ? item.kind : "";
    const entry = normalizedEntries[entryIndex];

    if ((kind === "unit-remap" || field === "unitNumber") && entry && typeof item.before === "string" && typeof item.after === "string") {
      const fromUnitNumber = normalizeWhitespace(item.before).toUpperCase();
      const toUnitNumber = normalizeWhitespace(item.after).toUpperCase();
      if (fromUnitNumber && toUnitNumber && fromUnitNumber !== toUnitNumber) {
        unitRemaps.push({
          fromUnitNumber,
          toUnitNumber,
          ownerText: entry.ownerText || null,
          buildingAddress: entry.buildingAddress || null,
        });
      }
    }

    if (kind === "candidate-edit" && entry && candidateIndex >= 0) {
      const candidate = entry.ownerCandidates[candidateIndex];
      if (!candidate) continue;
      if ((field === "firstName" || field === "lastName") && candidate.firstName.trim() && candidate.lastName.trim()) {
        ownerNameFixes.push({
          unitNumber: entry.unitNumber,
          displayName: candidate.displayName,
          firstName: candidate.firstName,
          lastName: candidate.lastName,
        });
      }
    }
  }

  return {
    unitRemaps: dedupeBy(unitRemaps, (item) => `${item.fromUnitNumber}|${item.toUnitNumber}|${item.ownerText ?? ""}|${item.buildingAddress ?? ""}`),
    ownerNameFixes: dedupeBy(ownerNameFixes, (item) => `${item.unitNumber}|${item.displayName}|${item.firstName}|${item.lastName}`),
  };
}

function extractAssociationBankStatementCorrectionHintsFromPayload(payload: unknown): AssociationBankStatementCorrectionHints {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { transactionMappings: [] };
  }

  const row = payload as Record<string, unknown>;
  const operatorCorrections = Array.isArray(row.operatorCorrections) ? row.operatorCorrections : [];
  const transactions = extractBankStatementTransactions(payload);
  const mappings: AssociationBankStatementCorrectionHints["transactionMappings"] = [];
  const touchedIndexes = new Set<number>();

  for (const correction of operatorCorrections) {
    if (!correction || typeof correction !== "object" || Array.isArray(correction)) continue;
    const item = correction as Record<string, unknown>;
    const kind = typeof item.kind === "string" ? item.kind : "";
    const txIndex = typeof item.txIndex === "number" ? item.txIndex : -1;
    const field = typeof item.field === "string" ? item.field : "";
    if (kind !== "bank-transaction-edit" && field !== "unitNumber" && field !== "ownerEmail" && field !== "ownerName") continue;
    if (txIndex < 0 || !transactions[txIndex]) continue;
    touchedIndexes.add(txIndex);
  }

  for (const txIndex of Array.from(touchedIndexes)) {
    const txn = transactions[txIndex];
    if (!txn) continue;
    if (!txn.description && !txn.ownerEmail && !txn.ownerName) continue;
    mappings.push({
      description: txn.description,
      unitNumber: txn.unitNumber,
      ownerEmail: txn.ownerEmail,
      ownerName: txn.ownerName,
    });
  }

  return {
    transactionMappings: dedupeBy(mappings, (item) => `${normalizeBankTransactionDescription(item.description)}|${item.unitNumber ?? ""}|${item.ownerEmail ?? ""}|${item.ownerName ?? ""}`),
  };
}

function buildOwnerRosterCorrectionMemoryEntries(
  associationId: string,
  extractedRecordId: string,
  payload: unknown,
  actorEmail?: string | null,
): InsertAssociationIngestionCorrectionMemory[] {
  const hints = extractAssociationOwnerRosterCorrectionHintsFromPayload(payload);
  return [
    ...hints.unitRemaps.map((hint) => ({
      associationId,
      recordType: "owner-roster" as const,
      correctionKind: "unit-remap",
      correctionKey: `${hint.fromUnitNumber}|${hint.toUnitNumber}|${hint.ownerText ?? ""}|${hint.buildingAddress ?? ""}`,
      sourceExtractedRecordId: extractedRecordId,
      payloadJson: hint,
      createdBy: actorEmail ?? null,
      updatedBy: actorEmail ?? null,
    })),
    ...hints.ownerNameFixes.map((hint) => ({
      associationId,
      recordType: "owner-roster" as const,
      correctionKind: "owner-name-fix",
      correctionKey: `${hint.unitNumber}|${hint.displayName}|${hint.firstName}|${hint.lastName}`,
      sourceExtractedRecordId: extractedRecordId,
      payloadJson: hint,
      createdBy: actorEmail ?? null,
      updatedBy: actorEmail ?? null,
    })),
  ];
}

function buildBankStatementCorrectionMemoryEntries(
  associationId: string,
  extractedRecordId: string,
  payload: unknown,
  actorEmail?: string | null,
): InsertAssociationIngestionCorrectionMemory[] {
  const hints = extractAssociationBankStatementCorrectionHintsFromPayload(payload);
  return hints.transactionMappings.map((hint) => ({
    associationId,
    recordType: "bank-statement" as const,
    correctionKind: "transaction-mapping",
    correctionKey: `${normalizeBankTransactionDescription(hint.description)}|${hint.unitNumber ?? ""}|${hint.ownerEmail ?? ""}|${hint.ownerName ?? ""}`,
    sourceExtractedRecordId: extractedRecordId,
    payloadJson: hint,
    createdBy: actorEmail ?? null,
    updatedBy: actorEmail ?? null,
  }));
}

function buildAiIngestionExceptionRowsFromPayload(params: {
  ingestionJobId: string;
  extractedRecordId: string;
  associationId: string | null;
  recordType: string;
  payload: unknown;
  bankHints?: BankStatementResolutionHint[];
}): InsertAiIngestionException[] {
  const payloadRow = (params.payload && typeof params.payload === "object" && !Array.isArray(params.payload))
    ? params.payload as Record<string, unknown>
    : {};
  const canonicalGraph = extractCanonicalIngestionGraph(params.payload);

  if (params.recordType === "owner-roster") {
    const exceptions = canonicalGraph
      ? canonicalGraph.entities
          .filter((entity) => entity.entityType === "exception")
          .map((entity) => ({
            kind: String(entity.attributes.kind ?? "unit-unresolved") as OwnerRosterUnresolvedException["kind"],
            unitNumber: String(entity.attributes.unitNumber ?? entity.entityKey),
            message: String(entity.attributes.message ?? "Canonical exception requires review."),
            blocking: Boolean(entity.attributes.blocking),
          }))
      : buildOwnerRosterUnresolvedExceptions(extractNormalizedOwnerRosterEntries(params.payload));
    return exceptions.map((exception) => ({
      ingestionJobId: params.ingestionJobId,
      extractedRecordId: params.extractedRecordId,
      associationId: params.associationId,
      recordType: params.recordType,
      exceptionKind: exception.kind,
      severity: exception.blocking ? "blocking" : "warning",
      status: "open",
      entityKey: exception.unitNumber,
      message: exception.message,
      contextJson: {
        unitNumber: exception.unitNumber,
        blocking: exception.blocking,
      },
      suggestionsJson: null,
      resolutionJson: null,
      resolvedBy: null,
    }));
  }

  if (params.recordType === "bank-statement") {
    const hints = params.bankHints ?? [];
    return hints.map((hint) => ({
      ingestionJobId: params.ingestionJobId,
      extractedRecordId: params.extractedRecordId,
      associationId: params.associationId,
      recordType: params.recordType,
      exceptionKind: hint.reason,
      severity: hint.reason === "missing-amount" || hint.reason === "invalid-date" ? "blocking" : "warning",
      status: "open",
      entityKey: `${hint.txIndex}`,
      message: `Transaction ${hint.txIndex + 1} requires resolution: ${hint.reason.replace(/-/g, " ")}.`,
      contextJson: {
        txIndex: hint.txIndex,
        transaction: hint.transaction,
        routeReason: payloadRow.destinationPlan,
      },
      suggestionsJson: {
        unitCandidates: hint.unitCandidates,
        personCandidates: hint.personCandidates,
      },
      resolutionJson: null,
      resolvedBy: null,
    }));
  }

  return [];
}

function buildCanonicalContextSnapshot(context?: AssociationIngestionContext): CanonicalIngestionGraph["contextSnapshot"] {
  return {
    associationName: context?.associationName ?? null,
    knownUnitNumbers: context?.knownUnitNumbers?.slice(0, 200) ?? [],
    knownBuildings: context?.knownBuildings?.slice(0, 50) ?? [],
    knownOwnerNames: context?.knownOwnerNames?.slice(0, 100) ?? [],
  };
}

function buildCanonicalOwnerRosterGraph(
  payload: unknown,
  context?: AssociationIngestionContext,
): CanonicalIngestionGraph {
  const entries = extractNormalizedOwnerRosterEntries(payload);
  const items = entries.length > 0 ? buildOwnerRosterItemsFromNormalizedEntries(entries) : extractOwnerRosterItems(payload);
  const ownerEntries = entries.length > 0
    ? entries
    : items.map((item) => ({
        buildingAddress: item.mailingAddress,
        unitNumber: item.unitNumber,
        ownerText: `${item.firstName} ${item.lastName}`,
        ownerCandidates: [{
          displayName: `${item.firstName} ${item.lastName}`,
          firstName: item.firstName,
          lastName: item.lastName,
          email: item.email,
          phone: item.phone,
        }],
        emails: item.email ? [item.email] : [],
        phones: item.phone ? [item.phone] : [],
        notes: [],
      }));
  const unresolvedExceptions = buildOwnerRosterUnresolvedExceptions(ownerEntries, context?.knownUnitNumbers ?? []);
  const entities: CanonicalIngestionEntity[] = [];
  const buildingByAddress = new Map<string, string>();

  ownerEntries.forEach((entry, entryIndex) => {
    let buildingEntityId: string | null = null;
    if (entry.buildingAddress) {
      const addressKey = canonicalizeAddress(entry.buildingAddress) ?? entry.buildingAddress;
      if (!buildingByAddress.has(addressKey)) {
        const id = `building-${buildingByAddress.size + 1}`;
        buildingByAddress.set(addressKey, id);
        entities.push({
          id,
          entityType: "building",
          routeTarget: "units",
          routeStatus: "ready",
          entityKey: addressKey,
          relatedEntityIds: [],
          attributes: {
            address: entry.buildingAddress,
            knownBuildingMatch: (context?.knownBuildings ?? []).find((value) => value.toLowerCase() === entry.buildingAddress?.toLowerCase()) ?? null,
          },
          sourceRefs: [{ kind: "normalized-entry", index: entryIndex, path: "buildingAddress" }],
        });
      }
      buildingEntityId = buildingByAddress.get(addressKey) ?? null;
    }

    const unitEntityId = `unit-${entryIndex + 1}`;
    const unitKnown = (context?.knownUnitNumbers ?? []).includes(entry.unitNumber.toUpperCase());
    entities.push({
      id: unitEntityId,
      entityType: "unit",
      routeTarget: "units",
      routeStatus: unitKnown ? "ready" : "needs-review",
      entityKey: entry.unitNumber.toUpperCase(),
      relatedEntityIds: buildingEntityId ? [buildingEntityId] : [],
      attributes: {
        unitNumber: entry.unitNumber,
        buildingAddress: entry.buildingAddress,
        knownUnit: unitKnown,
      },
      sourceRefs: [{ kind: "normalized-entry", index: entryIndex, path: "unitNumber" }],
    });

    entry.notes.forEach((note, noteIndex) => {
      entities.push({
        id: `note-${entryIndex + 1}-${noteIndex + 1}`,
        entityType: "note",
        routeTarget: "ownerships",
        routeStatus: "ready",
        entityKey: `${entry.unitNumber}|${note}`,
        relatedEntityIds: [unitEntityId],
        attributes: {
          unitNumber: entry.unitNumber,
          note,
        },
        sourceRefs: [{ kind: "normalized-entry", index: entryIndex, path: `notes.${noteIndex}` }],
      });
    });

    entry.ownerCandidates.forEach((candidate, candidateIndex) => {
      const personEntityId = `person-${entryIndex + 1}-${candidateIndex + 1}`;
      entities.push({
        id: personEntityId,
        entityType: "person",
        routeTarget: "persons",
        routeStatus: "ready",
        entityKey: `${candidate.firstName.toLowerCase()}|${candidate.lastName.toLowerCase()}|${entry.unitNumber}`,
        relatedEntityIds: [unitEntityId],
        attributes: {
          firstName: candidate.firstName,
          lastName: candidate.lastName,
          displayName: candidate.displayName,
          mailingAddress: entry.buildingAddress,
          knownOwnerNameMatch: (context?.knownOwnerNames ?? []).find((value) => value.toLowerCase() === candidate.displayName.toLowerCase()) ?? null,
        },
        sourceRefs: [{ kind: "normalized-entry", index: entryIndex, path: `ownerCandidates.${candidateIndex}` }],
      });

      const candidateEmails = dedupeBy(
        [
          candidate.email,
          entry.emails[candidateIndex],
          ...(entry.ownerCandidates.length === 1 ? entry.emails : []),
        ]
          .filter((value): value is string => Boolean(value)),
        (value) => value.toLowerCase(),
      );
      const candidatePhones = dedupeBy(
        [
          candidate.phone,
          entry.phones[candidateIndex],
          ...(entry.ownerCandidates.length === 1 ? entry.phones : []),
        ]
          .filter((value): value is string => Boolean(value)),
        (value) => value,
      );

      candidateEmails.forEach((email, emailIndex) => {
        entities.push({
          id: `contact-email-${entryIndex + 1}-${candidateIndex + 1}-${emailIndex + 1}`,
          entityType: "contact-point",
          routeTarget: "contacts",
          routeStatus: "ready",
          entityKey: `email|${email}`,
          relatedEntityIds: [personEntityId, unitEntityId],
          attributes: {
            channel: "email",
            value: email,
            isPrimary: emailIndex === 0,
            ownerUnitNumber: entry.unitNumber,
          },
          sourceRefs: [{ kind: "normalized-entry", index: entryIndex, path: "emails" }],
        });
      });

      candidatePhones.forEach((phone, phoneIndex) => {
        entities.push({
          id: `contact-phone-${entryIndex + 1}-${candidateIndex + 1}-${phoneIndex + 1}`,
          entityType: "contact-point",
          routeTarget: "contacts",
          routeStatus: "ready",
          entityKey: `phone|${phone}`,
          relatedEntityIds: [personEntityId, unitEntityId],
          attributes: {
            channel: "phone",
            value: phone,
            isPrimary: phoneIndex === 0,
            ownerUnitNumber: entry.unitNumber,
          },
          sourceRefs: [{ kind: "normalized-entry", index: entryIndex, path: "phones" }],
        });
      });

      const noteIds = entities
        .filter((entity) => entity.entityType === "note" && entity.attributes.unitNumber === entry.unitNumber)
        .map((entity) => entity.id);
      entities.push({
        id: `ownership-${entryIndex + 1}-${candidateIndex + 1}`,
        entityType: "ownership-candidate",
        routeTarget: "ownerships",
        routeStatus: candidateEmails.length > 1 || candidatePhones.length > 1 || !unitKnown ? "needs-review" : "ready",
        entityKey: `${entry.unitNumber}|${candidate.firstName.toLowerCase()}|${candidate.lastName.toLowerCase()}`,
        relatedEntityIds: [unitEntityId, personEntityId, ...noteIds],
        attributes: {
          unitNumber: entry.unitNumber,
          ownershipPercentage: entry.ownerCandidates.length > 1 ? Number((100 / entry.ownerCandidates.length).toFixed(2)) : 100,
          buildingAddress: entry.buildingAddress,
          relationshipNotes: entry.notes,
          contactAssignmentNeeded: entry.ownerCandidates.length > 1 && (entry.emails.length > 0 || entry.phones.length > 0),
        },
        sourceRefs: [{ kind: "normalized-entry", index: entryIndex }],
      });
    });
  });

  unresolvedExceptions.forEach((exception, index) => {
    entities.push({
      id: `exception-${index + 1}`,
      entityType: "exception",
      routeTarget: "exceptions",
      routeStatus: "needs-review",
      entityKey: `${exception.kind}|${exception.unitNumber}`,
      relatedEntityIds: entities.filter((entity) => entity.entityType === "unit" && entity.entityKey === exception.unitNumber.toUpperCase()).map((entity) => entity.id),
      attributes: {
        kind: exception.kind,
        unitNumber: exception.unitNumber,
        message: exception.message,
        blocking: exception.blocking,
      },
      sourceRefs: [{ kind: "derived-exception", index }],
    });
  });

  return {
    version: 1,
    recordType: "owner-roster",
    contextSnapshot: buildCanonicalContextSnapshot(context),
    entities,
  };
}

function buildCanonicalContactRosterGraph(
  payload: unknown,
  context?: AssociationIngestionContext,
): CanonicalIngestionGraph {
  const items = extractContactRosterItems(payload);
  const entities: CanonicalIngestionEntity[] = [];
  items.forEach((item, index) => {
    const personEntityId = `person-${index + 1}`;
    entities.push({
      id: personEntityId,
      entityType: "person",
      routeTarget: "persons",
      routeStatus: "ready",
      entityKey: `${item.firstName.toLowerCase()}|${item.lastName.toLowerCase()}|${item.email ?? ""}`,
      relatedEntityIds: [],
      attributes: {
        firstName: item.firstName,
        lastName: item.lastName,
        mailingAddress: item.mailingAddress,
        knownOwnerNameMatch: (context?.knownOwnerNames ?? []).find((value) => value.toLowerCase() === `${item.firstName} ${item.lastName}`.toLowerCase()) ?? null,
      },
      sourceRefs: [{ kind: "item", index }],
    });
    [
      { channel: "email" as const, value: item.email },
      { channel: "phone" as const, value: item.phone },
    ]
      .filter((contact) => Boolean(contact.value))
      .forEach((contact, contactIndex) => {
        entities.push({
          id: `contact-${index + 1}-${contactIndex + 1}`,
          entityType: "contact-point",
          routeTarget: "contacts",
          routeStatus: "ready",
          entityKey: `${contact.channel}|${contact.value}`,
          relatedEntityIds: [personEntityId],
          attributes: {
            channel: contact.channel,
            value: contact.value,
            isPrimary: true,
          },
          sourceRefs: [{ kind: "item", index, path: contact.channel }],
        });
      });
  });
  return {
    version: 1,
    recordType: "contact-roster",
    contextSnapshot: buildCanonicalContextSnapshot(context),
    entities,
  };
}

function buildCanonicalBankStatementGraph(
  payload: unknown,
  context?: AssociationIngestionContext,
): CanonicalIngestionGraph {
  const transactions = extractBankStatementTransactions(payload);
  const entities: CanonicalIngestionEntity[] = [];
  transactions.forEach((transaction, index) => {
    const unitKnown = transaction.unitNumber ? (context?.knownUnitNumbers ?? []).includes(transaction.unitNumber.toUpperCase()) : false;
    const nameKnown = transaction.ownerName
      ? (context?.knownOwnerNames ?? []).some((value) => value.toLowerCase() === transaction.ownerName?.toLowerCase())
      : false;
    entities.push({
      id: `bank-transaction-${index + 1}`,
      entityType: "bank-transaction",
      routeTarget: "owner-ledger",
      routeStatus: transaction.unitNumber && unitKnown && (transaction.ownerEmail || nameKnown) ? "ready" : "needs-review",
      entityKey: `${index}|${normalizeBankTransactionDescription(transaction.description)}`,
      relatedEntityIds: [],
      attributes: {
        txIndex: index,
        unitNumber: transaction.unitNumber,
        ownerEmail: transaction.ownerEmail,
        ownerName: transaction.ownerName,
        amount: transaction.amount,
        postedAt: transaction.postedAt,
        description: transaction.description,
        entryType: transaction.entryType,
        knownUnit: unitKnown,
        knownOwner: nameKnown,
      },
      sourceRefs: [{ kind: "transaction", index }],
    });
  });
  return {
    version: 1,
    recordType: "bank-statement",
    contextSnapshot: buildCanonicalContextSnapshot(context),
    entities,
  };
}

function buildCanonicalIngestionGraph(
  recordType: AiIngestionExtractionRecord["recordType"],
  payload: unknown,
  context?: AssociationIngestionContext,
): CanonicalIngestionGraph | null {
  switch (recordType) {
    case "owner-roster":
      return buildCanonicalOwnerRosterGraph(payload, context);
    case "contact-roster":
      return buildCanonicalContactRosterGraph(payload, context);
    case "bank-statement":
      return buildCanonicalBankStatementGraph(payload, context);
    default:
      return null;
  }
}

function extractCanonicalIngestionGraph(payload: unknown): CanonicalIngestionGraph | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const value = (payload as Record<string, unknown>).canonicalEntities;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (row.version !== 1 || typeof row.recordType !== "string" || !Array.isArray(row.entities)) return null;
  return row as unknown as CanonicalIngestionGraph;
}

function ensureCanonicalIngestionGraph(
  recordType: AiIngestionExtractionRecord["recordType"],
  payload: unknown,
  context?: AssociationIngestionContext,
): CanonicalIngestionGraph | null {
  return extractCanonicalIngestionGraph(payload) ?? buildCanonicalIngestionGraph(recordType, payload, context);
}

function attachCanonicalEntities(
  recordType: AiIngestionExtractionRecord["recordType"],
  payloadJson: Record<string, unknown>,
  context?: AssociationIngestionContext,
): Record<string, unknown> {
  const canonicalGraph = ensureCanonicalIngestionGraph(recordType, payloadJson, context);
  if (!canonicalGraph) return payloadJson;
  return {
    ...payloadJson,
    canonicalEntities: canonicalGraph,
  };
}

function buildDestinationRoutePlan(
  recordType: AiIngestionExtractionRecord["recordType"],
  payload: unknown,
): DestinationRoutePlan {
  const canonicalGraph = extractCanonicalIngestionGraph(payload);
  if (canonicalGraph) {
    const count = (predicate: (entity: CanonicalIngestionEntity) => boolean) => canonicalGraph.entities.filter(predicate).length;
    const exceptionCount = count((entity) => entity.entityType === "exception");
    return {
      primaryModule:
        recordType === "owner-roster"
          ? "owners"
          : recordType === "contact-roster"
            ? "persons"
            : recordType === "bank-statement"
              ? "owner-ledger"
              : recordType === "invoice-draft"
                ? "financial-invoices"
                : recordType === "meeting-notes"
                  ? "governance"
                  : "metadata",
      entityCounts: {
        units: count((entity) => entity.entityType === "unit"),
        persons: count((entity) => entity.entityType === "person"),
        ownerships: count((entity) => entity.entityType === "ownership-candidate"),
        contactPoints: count((entity) => entity.entityType === "contact-point"),
        ownerLedgerEntries: count((entity) => entity.entityType === "bank-transaction"),
        vendorInvoices: recordType === "invoice-draft" ? 1 : 0,
        exceptions: exceptionCount,
      },
      routeReason: `Canonical ${recordType} entities route deterministically to destination modules and exception review.`,
    };
  }

  if (recordType === "owner-roster") {
    const entries = extractNormalizedOwnerRosterEntries(payload);
    const items = entries.length > 0 ? buildOwnerRosterItemsFromNormalizedEntries(entries) : extractOwnerRosterItems(payload);
    const unitCount = new Set(items.map((item) => item.unitNumber)).size;
    const personCount = items.length;
    const exceptionCount = buildOwnerRosterUnresolvedExceptions(entries).length;
    return {
      primaryModule: "owners",
      entityCounts: {
        units: unitCount,
        persons: personCount,
        ownerships: items.length,
        contactPoints: items.filter((item) => item.email || item.phone).length,
        ownerLedgerEntries: 0,
        vendorInvoices: 0,
        exceptions: exceptionCount,
      },
      routeReason: "Normalized owner facts route to units, persons, ownerships, and exception review.",
    };
  }

  if (recordType === "contact-roster") {
    const items = extractContactRosterItems(payload);
    return {
      primaryModule: "persons",
      entityCounts: {
        units: 0,
        persons: items.length,
        ownerships: 0,
        contactPoints: items.filter((item) => item.email || item.phone).length,
        ownerLedgerEntries: 0,
        vendorInvoices: 0,
        exceptions: 0,
      },
      routeReason: "Contact rows route to person/contact updates without ownership creation.",
    };
  }

  if (recordType === "bank-statement") {
    const txns = extractBankStatementTransactions(payload);
    return {
      primaryModule: "owner-ledger",
      entityCounts: {
        units: 0,
        persons: 0,
        ownerships: 0,
        contactPoints: 0,
        ownerLedgerEntries: txns.length,
        vendorInvoices: 0,
        exceptions: 0,
      },
      routeReason: "Statement transactions route to owner-ledger entries after unit/person resolution.",
    };
  }

  if (recordType === "invoice-draft") {
    return {
      primaryModule: "financial-invoices",
      entityCounts: {
        units: 0,
        persons: 0,
        ownerships: 0,
        contactPoints: 0,
        ownerLedgerEntries: 0,
        vendorInvoices: 1,
        exceptions: 0,
      },
      routeReason: "Invoice facts route to vendor invoice creation or duplicate review.",
    };
  }

  if (recordType === "meeting-notes") {
    return {
      primaryModule: "governance",
      entityCounts: {
        units: 0,
        persons: 0,
        ownerships: 0,
        contactPoints: 0,
        ownerLedgerEntries: 0,
        vendorInvoices: 0,
        exceptions: 0,
      },
      routeReason: "Meeting notes route to governance review rather than direct import.",
    };
  }

  return {
    primaryModule: "metadata",
    entityCounts: {
      units: 0,
      persons: 0,
      ownerships: 0,
      contactPoints: 0,
      ownerLedgerEntries: 0,
      vendorInvoices: 0,
      exceptions: 0,
    },
    routeReason: "Unclassified document routes to metadata/manual review.",
  };
}

function attachDestinationRouting(
  recordType: AiIngestionExtractionRecord["recordType"],
  payloadJson: Record<string, unknown>,
): Record<string, unknown> {
  const destinationPlan = buildDestinationRoutePlan(recordType, payloadJson);
  return {
    ...payloadJson,
    destinationModule: destinationPlan.primaryModule,
    destinationPlan,
  };
}

function extractDestinationRoutePlan(payload: unknown): DestinationRoutePlan | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const plan = (payload as Record<string, unknown>).destinationPlan;
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) return null;
  const row = plan as Record<string, unknown>;
  const entityCounts = row.entityCounts;
  if (!entityCounts || typeof entityCounts !== "object" || Array.isArray(entityCounts)) return null;
  const counts = entityCounts as Record<string, unknown>;
  const primaryModule = row.primaryModule;
  if (primaryModule !== "owners" && primaryModule !== "persons" && primaryModule !== "owner-ledger" && primaryModule !== "financial-invoices" && primaryModule !== "governance" && primaryModule !== "metadata") {
    return null;
  }
  return {
    primaryModule,
    entityCounts: {
      units: typeof counts.units === "number" ? counts.units : 0,
      persons: typeof counts.persons === "number" ? counts.persons : 0,
      ownerships: typeof counts.ownerships === "number" ? counts.ownerships : 0,
      contactPoints: typeof counts.contactPoints === "number" ? counts.contactPoints : 0,
      ownerLedgerEntries: typeof counts.ownerLedgerEntries === "number" ? counts.ownerLedgerEntries : 0,
      vendorInvoices: typeof counts.vendorInvoices === "number" ? counts.vendorInvoices : 0,
      exceptions: typeof counts.exceptions === "number" ? counts.exceptions : 0,
    },
    routeReason: typeof row.routeReason === "string" ? row.routeReason : "",
  };
}

function extractCanonicalOwnerImportRows(payload: unknown): Array<{
  unitNumber: string;
  buildingAddress: string | null;
  firstName: string;
  lastName: string;
  displayName: string;
  mailingAddress: string | null;
  ownershipPercentage: number | null;
  relationshipNotes: string[];
  contactPoints: Array<{ channel: "email" | "phone"; value: string; isPrimary: boolean }>;
}> {
  const graph = extractCanonicalIngestionGraph(payload);
  if (!graph) return [];
  const entitiesById = new Map(graph.entities.map((entity) => [entity.id, entity]));
  return graph.entities
    .filter((entity) => entity.entityType === "ownership-candidate")
    .flatMap((ownershipEntity) => {
      const unitEntity = ownershipEntity.relatedEntityIds
        .map((id) => entitiesById.get(id))
        .find((entity) => entity?.entityType === "unit");
      const personEntity = ownershipEntity.relatedEntityIds
        .map((id) => entitiesById.get(id))
        .find((entity) => entity?.entityType === "person");
      if (!unitEntity || !personEntity) return [];
      const contactPoints = graph.entities
        .filter((entity) => entity.entityType === "contact-point" && entity.relatedEntityIds.includes(personEntity.id))
        .flatMap((entity) => {
          const channel = entity.attributes.channel;
          const value = entity.attributes.value;
          if ((channel !== "email" && channel !== "phone") || typeof value !== "string" || !value) return [];
          return [{
            channel: channel as "email" | "phone",
            value,
            isPrimary: Boolean(entity.attributes.isPrimary),
          }];
        });
      const relationshipNotes = ownershipEntity.relatedEntityIds
        .map((id) => entitiesById.get(id))
        .filter((entity): entity is CanonicalIngestionEntity => Boolean(entity && entity.entityType === "note"))
        .flatMap((entity) => typeof entity.attributes.note === "string" ? [entity.attributes.note] : []);
      const firstName = typeof personEntity.attributes.firstName === "string" ? personEntity.attributes.firstName : "";
      const lastName = typeof personEntity.attributes.lastName === "string" ? personEntity.attributes.lastName : "";
      const unitNumber = typeof unitEntity.attributes.unitNumber === "string" ? unitEntity.attributes.unitNumber : "";
      if (!firstName || !lastName || !unitNumber) return [];
      return [{
        unitNumber,
        buildingAddress: typeof unitEntity.attributes.buildingAddress === "string" ? unitEntity.attributes.buildingAddress : null,
        firstName,
        lastName,
        displayName: typeof personEntity.attributes.displayName === "string" ? personEntity.attributes.displayName : `${firstName} ${lastName}`,
        mailingAddress: typeof personEntity.attributes.mailingAddress === "string" ? personEntity.attributes.mailingAddress : null,
        ownershipPercentage: typeof ownershipEntity.attributes.ownershipPercentage === "number" ? ownershipEntity.attributes.ownershipPercentage : null,
        relationshipNotes,
        contactPoints,
      }];
    });
}

function extractCanonicalContactImportRows(payload: unknown): Array<{
  firstName: string;
  lastName: string;
  mailingAddress: string | null;
  contactPoints: Array<{ channel: "email" | "phone"; value: string; isPrimary: boolean }>;
}> {
  const graph = extractCanonicalIngestionGraph(payload);
  if (!graph) return [];
  return graph.entities
    .filter((entity) => entity.entityType === "person")
    .flatMap((personEntity) => {
      const firstName = typeof personEntity.attributes.firstName === "string" ? personEntity.attributes.firstName : "";
      const lastName = typeof personEntity.attributes.lastName === "string" ? personEntity.attributes.lastName : "";
      if (!firstName || !lastName) return [];
      const contactPoints = graph.entities
        .filter((entity) => entity.entityType === "contact-point" && entity.relatedEntityIds.includes(personEntity.id))
        .flatMap((entity) => {
          const channel = entity.attributes.channel;
          const value = entity.attributes.value;
          if ((channel !== "email" && channel !== "phone") || typeof value !== "string" || !value) return [];
          return [{
            channel: channel as "email" | "phone",
            value,
            isPrimary: Boolean(entity.attributes.isPrimary),
          }];
        });
      return [{
        firstName,
        lastName,
        mailingAddress: typeof personEntity.attributes.mailingAddress === "string" ? personEntity.attributes.mailingAddress : null,
        contactPoints,
      }];
    });
}

function extractCanonicalBankTransactions(payload: unknown): BankStatementTransaction[] {
  const graph = extractCanonicalIngestionGraph(payload);
  if (!graph) return [];
  return graph.entities
    .filter((entity) => entity.entityType === "bank-transaction")
    .flatMap((entity) => {
      const entryType = entity.attributes.entryType;
      if (entryType !== "payment" && entryType !== "charge" && entryType !== "credit" && entryType !== "adjustment") return [];
      return [{
        unitNumber: typeof entity.attributes.unitNumber === "string" ? entity.attributes.unitNumber : null,
        ownerEmail: typeof entity.attributes.ownerEmail === "string" ? entity.attributes.ownerEmail : null,
        ownerName: typeof entity.attributes.ownerName === "string" ? entity.attributes.ownerName : null,
        amount: typeof entity.attributes.amount === "number" ? entity.attributes.amount : toNumber(entity.attributes.amount),
        postedAt: typeof entity.attributes.postedAt === "string" ? entity.attributes.postedAt : null,
        description: typeof entity.attributes.description === "string" ? entity.attributes.description : null,
        entryType,
      }];
    });
}

function dedupeBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function normalizePersonContactPointValue(channel: "email" | "phone", value: string | null | undefined): string | null {
  return channel === "email" ? canonicalizeEmail(value) : canonicalizePhone(value);
}

async function mapInBatches<T, R>(
  items: T[],
  batchSize: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    const batchResults = await Promise.all(
      batch.map((item, batchIndex) => mapper(item, index + batchIndex)),
    );
    results.push(...batchResults);
  }
  return results;
}

function extractContactRosterItems(payload: unknown): ContactRosterItem[] {
  if (!payload || typeof payload !== "object") return [];
  const items = (payload as Record<string, unknown>).items;
  if (!Array.isArray(items)) {
    return extractCanonicalContactImportRows(payload).map((row) => ({
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.contactPoints.find((contact) => contact.channel === "email" && contact.isPrimary)?.value
        ?? row.contactPoints.find((contact) => contact.channel === "email")?.value
        ?? null,
      phone: row.contactPoints.find((contact) => contact.channel === "phone" && contact.isPrimary)?.value
        ?? row.contactPoints.find((contact) => contact.channel === "phone")?.value
        ?? null,
      mailingAddress: row.mailingAddress,
    }));
  }

  return items.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const firstName = typeof row.firstName === "string" ? normalizeWhitespace(row.firstName) : "";
    const lastName = typeof row.lastName === "string" ? normalizeWhitespace(row.lastName) : "";
    if (!firstName || !lastName) return [];

    return [{
      firstName,
      lastName,
      email: typeof row.email === "string" && row.email.trim() ? row.email.trim().toLowerCase() : null,
      phone: typeof row.phone === "string" && row.phone.trim() ? row.phone.trim() : null,
      mailingAddress: typeof row.mailingAddress === "string" && row.mailingAddress.trim() ? row.mailingAddress.trim() : null,
    }];
  });
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

type BankStatementTransaction = {
  unitNumber: string | null;
  ownerEmail: string | null;
  ownerName: string | null;
  amount: number | null;
  postedAt: string | null;
  description: string | null;
  entryType: "payment" | "charge" | "credit" | "adjustment";
};

function extractBankStatementTransactions(payload: unknown): BankStatementTransaction[] {
  if (!payload || typeof payload !== "object") return [];
  const transactions = (payload as Record<string, unknown>).transactions;
  if (!Array.isArray(transactions)) return extractCanonicalBankTransactions(payload);

  return transactions.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const amount = toNumber(row.amount);
    const postedAt = typeof row.postedAt === "string" && row.postedAt.trim() ? row.postedAt.trim() : null;
    const description = typeof row.description === "string" && row.description.trim() ? row.description.trim() : null;
    const entryTypeRaw = typeof row.entryType === "string" ? row.entryType : "";
    const entryType: BankStatementTransaction["entryType"] =
      entryTypeRaw === "payment" || entryTypeRaw === "charge" || entryTypeRaw === "credit" || entryTypeRaw === "adjustment"
        ? entryTypeRaw
        : (amount != null && amount < 0 ? "payment" : "charge");

    return [{
      unitNumber: typeof row.unitNumber === "string" && row.unitNumber.trim() ? row.unitNumber.trim().toUpperCase() : null,
      ownerEmail: typeof row.ownerEmail === "string" && row.ownerEmail.trim() ? row.ownerEmail.trim().toLowerCase() : null,
      ownerName: typeof row.ownerName === "string" && row.ownerName.trim() ? row.ownerName.trim() : null,
      amount,
      postedAt,
      description,
      entryType,
    }];
  });
}

function normalizeBankStatementTransactions(payload: unknown): { transactions: BankStatementTransaction[]; invalidCount: number } {
  const raw = extractBankStatementTransactions(payload);
  const normalized: BankStatementTransaction[] = [];
  let invalidCount = 0;

  for (const txn of raw) {
    const amountValid = txn.amount != null && Number.isFinite(txn.amount);
    const dateValid = txn.postedAt ? toDate(txn.postedAt) != null : false;
    const hasOwnerHint = Boolean(txn.unitNumber || txn.ownerEmail || txn.ownerName);
    if (!amountValid || !dateValid || !hasOwnerHint) {
      invalidCount += 1;
      continue;
    }
    normalized.push({
      ...txn,
      amount: Number(txn.amount),
      postedAt: txn.postedAt!,
    });
  }

  return { transactions: normalized, invalidCount };
}

function normalizeBankTransactionDescription(value: string | null | undefined): string {
  return normalizeWhitespace((value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " "));
}

function applyBankStatementCorrectionHints(
  transactions: BankStatementTransaction[],
  hints?: AssociationBankStatementCorrectionHints,
): BankStatementTransaction[] {
  if (!hints || hints.transactionMappings.length === 0) return transactions;

  return transactions.map((txn) => {
    const descriptionKey = normalizeBankTransactionDescription(txn.description);
    const match = hints.transactionMappings.find((hint) => {
      const hintDescriptionKey = normalizeBankTransactionDescription(hint.description);
      if (descriptionKey && hintDescriptionKey && descriptionKey === hintDescriptionKey) return true;
      if (txn.ownerEmail && hint.ownerEmail && txn.ownerEmail === hint.ownerEmail) return true;
      if (txn.ownerName && hint.ownerName && normalizeWhitespace(txn.ownerName).toLowerCase() === normalizeWhitespace(hint.ownerName).toLowerCase()) return true;
      return false;
    });
    if (!match) return txn;

    return {
      ...txn,
      unitNumber: txn.unitNumber ?? match.unitNumber ?? null,
      ownerEmail: txn.ownerEmail ?? match.ownerEmail ?? null,
      ownerName: txn.ownerName ?? match.ownerName ?? null,
    };
  });
}

function parseInvoiceDraftText(sourceText: string): {
  vendorName: string;
  invoiceNumber: string | null;
  amount: number | null;
  invoiceDate: string | null;
  dueDate: string | null;
  notes: string | null;
  status: string | null;
} {
  const lines = sourceText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const joined = lines.join("\n");
  const datePattern = /(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})/;

  const vendorLine =
    lines.find((line) => /^vendor\s*[:\-]/i.test(line)) ??
    lines.find((line) => /^from\s*[:\-]/i.test(line)) ??
    lines.find((line) => line.length <= 90 && !/invoice|date|amount|due|total|balance/i.test(line)) ??
    "Extracted Vendor";
  const vendorName = normalizeWhitespace(vendorLine.replace(/^(vendor|from)\s*[:\-]\s*/i, "")) || "Extracted Vendor";

  const invoiceNumber =
    joined.match(/invoice\s*(?:#|number|no\.?)?\s*[:\-]?\s*([A-Z0-9-]+)/i)?.[1] ??
    joined.match(/\b(?:inv|bill)\s*#\s*([A-Z0-9-]+)/i)?.[1] ??
    null;

  const invoiceDateRaw =
    joined.match(/invoice\s*date\s*[:\-]?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})/i)?.[1] ??
    lines.find((line) => /^date\s*[:\-]/i.test(line))?.match(datePattern)?.[1] ??
    joined.match(datePattern)?.[1] ??
    null;
  const dueDateRaw =
    joined.match(/due\s*date\s*[:\-]?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})/i)?.[1] ??
    null;

  const amountRaw =
    joined.match(/(?:amount\s*due|total\s*due|invoice\s*total|balance\s*due)\s*[:\-]?\s*(\-?\$?[0-9,]+(?:\.[0-9]{2})?)/i)?.[1] ??
    joined.match(/(\-?\$?[0-9,]+(?:\.[0-9]{2}))/)?.[1] ??
    null;

  return {
    vendorName,
    invoiceNumber,
    amount: amountRaw ? toNumber(amountRaw) : null,
    invoiceDate: invoiceDateRaw ? (toDate(invoiceDateRaw)?.toISOString().slice(0, 10) ?? invoiceDateRaw) : null,
    dueDate: dueDateRaw ? (toDate(dueDateRaw)?.toISOString().slice(0, 10) ?? dueDateRaw) : null,
    notes: lines.slice(0, 5).join(" ").slice(0, 300) || null,
    status: null,
  };
}

function parseBankStatementText(sourceText: string): {
  statementPeriod: string | null;
  transactions: BankStatementTransaction[];
} {
  const lines = sourceText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const transactions: BankStatementTransaction[] = [];
  const datePattern = /(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})/;
  const moneyPattern = /(?:-\$?\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\$-\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\$?\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g;
  const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

  const periodLine = lines.find((line) => /statement\s*period|period\s*[:\-]/i.test(line));
  const statementPeriod = periodLine
    ? normalizeWhitespace(periodLine.replace(/^.*?(statement\s*period|period)\s*[:\-]?\s*/i, ""))
    : null;

  for (const line of lines) {
    if (/^date\b.*\b(amount|balance)\b/i.test(line)) continue;
    const dateMatch = line.match(datePattern);
    if (!dateMatch) continue;

    const amounts = Array.from(line.matchAll(moneyPattern)).map((match) => match[0]);
    if (amounts.length === 0) continue;
    const amount = toNumber(amounts[amounts.length - 1]);
    if (amount == null) continue;

    const unitNumber = line.match(/(?:unit|apt|suite|#)\s*([A-Z0-9-]+)/i)?.[1]?.toUpperCase() ?? null;
    const ownerEmail = line.match(emailPattern)?.[0]?.toLowerCase() ?? null;
    const ownerName =
      line.match(/(?:owner|for)\s+([A-Z][A-Za-z'`.-]+(?:\s+[A-Z][A-Za-z'`.-]+){0,2})/)?.[1] ??
      null;

    const lower = line.toLowerCase();
    const entryType: BankStatementTransaction["entryType"] = lower.includes("credit")
      ? "credit"
      : lower.includes("adjust")
        ? "adjustment"
        : lower.includes("payment") || amount < 0
          ? "payment"
          : "charge";

    transactions.push({
      unitNumber,
      ownerEmail,
      ownerName,
      amount,
      postedAt: toDate(dateMatch[1])?.toISOString().slice(0, 10) ?? dateMatch[1],
      description: normalizeWhitespace(line).slice(0, 240),
      entryType,
    });

    if (transactions.length >= 250) break;
  }

  return { statementPeriod, transactions };
}

function enrichExtractionWithFallback(
  job: AiIngestionJob,
  sourceText: string,
  extraction: AiIngestionExtractionResult,
  associationContext?: AssociationIngestionContext,
): AiIngestionExtractionResult {
  const fallback = buildFallbackIngestionExtraction(
    job,
    sourceText,
    associationContext?.ownerRosterCorrectionHints,
    associationContext?.bankStatementCorrectionHints,
  );
  const baseExtraction = (extraction.records.length === 0 && extraction.clauses.length === 0)
    ? fallback
    : extraction;
  const records = baseExtraction.records.map((record) => {
    if (record.recordType === "owner-roster") {
      const basePayload = (record.payloadJson && typeof record.payloadJson === "object" ? record.payloadJson : {}) as Record<string, unknown>;
      const baseItems = extractOwnerRosterItems(basePayload);
      const selection = chooseBestOwnerRosterItems(sourceText, baseItems, associationContext?.ownerRosterCorrectionHints);
      const unresolvedExceptions = buildOwnerRosterUnresolvedExceptions(selection.normalizedEntries);
      if (selection.items.length === 0) return record;
      return {
        ...record,
        payloadJson: attachCanonicalEntities("owner-roster", attachDestinationRouting("owner-roster", {
          ...basePayload,
          title: typeof basePayload.title === "string" && basePayload.title.trim() ? basePayload.title : "Extracted Owner Roster",
          itemCount: selection.items.length,
          items: selection.items,
          normalizedEntries: selection.normalizedEntries,
          unresolvedExceptions,
          feedbackSignals: {
            priorUnitRemaps: associationContext?.ownerRosterCorrectionHints?.unitRemaps.length ?? 0,
            priorOwnerNameFixes: associationContext?.ownerRosterCorrectionHints?.ownerNameFixes.length ?? 0,
          },
          extractionStrategy: selection.strategy,
          extractionQuality: selection.quality,
        }), associationContext),
      };
    }

    if (record.recordType === "contact-roster") {
      const basePayload = (record.payloadJson && typeof record.payloadJson === "object" ? record.payloadJson : {}) as Record<string, unknown>;
      const baseItems = extractContactRosterItems(basePayload);
      const parsedItems = parseContactRosterText(sourceText);
      if (baseItems.length > 0) {
        const mergedItems = mergeContactRosterItems(baseItems, parsedItems);
        return {
          ...record,
          payloadJson: attachCanonicalEntities("contact-roster", attachDestinationRouting("contact-roster", {
            ...basePayload,
            title: typeof basePayload.title === "string" && basePayload.title.trim() ? basePayload.title : "Extracted Contact Roster",
            itemCount: mergedItems.length,
            items: mergedItems,
          }), associationContext),
        };
      }
      if (parsedItems.length === 0) return record;
      return {
        ...record,
        payloadJson: attachCanonicalEntities("contact-roster", attachDestinationRouting("contact-roster", {
          ...basePayload,
          title: typeof basePayload.title === "string" && basePayload.title.trim() ? basePayload.title : "Extracted Contact Roster",
          itemCount: parsedItems.length,
          items: parsedItems,
        }), associationContext),
      };
    }

    if (record.recordType === "invoice-draft") {
      const basePayload = (record.payloadJson && typeof record.payloadJson === "object" ? record.payloadJson : {}) as Record<string, unknown>;
      const parsedInvoice = parseInvoiceDraftText(sourceText);
      const merged = {
        vendorName: typeof basePayload.vendorName === "string" && basePayload.vendorName.trim() ? basePayload.vendorName : parsedInvoice.vendorName,
        invoiceNumber: typeof basePayload.invoiceNumber === "string" && basePayload.invoiceNumber.trim() ? basePayload.invoiceNumber : parsedInvoice.invoiceNumber,
        amount: toNumber(basePayload.amount) ?? parsedInvoice.amount,
        invoiceDate: typeof basePayload.invoiceDate === "string" && basePayload.invoiceDate.trim() ? basePayload.invoiceDate : parsedInvoice.invoiceDate,
        dueDate: typeof basePayload.dueDate === "string" && basePayload.dueDate.trim() ? basePayload.dueDate : parsedInvoice.dueDate,
        notes: typeof basePayload.notes === "string" && basePayload.notes.trim() ? basePayload.notes : parsedInvoice.notes,
        status: typeof basePayload.status === "string" && basePayload.status.trim() ? basePayload.status : parsedInvoice.status,
      };
      return { ...record, payloadJson: { ...basePayload, ...merged } };
    }

    if (record.recordType === "bank-statement") {
      const basePayload = (record.payloadJson && typeof record.payloadJson === "object" ? record.payloadJson : {}) as Record<string, unknown>;
      const normalizedBase = normalizeBankStatementTransactions(basePayload);
      const parsedBank = parseBankStatementText(sourceText);
      const hintedBaseTransactions = applyBankStatementCorrectionHints(normalizedBase.transactions, associationContext?.bankStatementCorrectionHints);
      const parsedNormalized = normalizeBankStatementTransactions({
        transactions: applyBankStatementCorrectionHints(parsedBank.transactions, associationContext?.bankStatementCorrectionHints),
      });
      const transactions = hintedBaseTransactions.length > 0 ? hintedBaseTransactions : parsedNormalized.transactions;
      return {
        ...record,
        payloadJson: attachCanonicalEntities("bank-statement", attachDestinationRouting("bank-statement", {
          ...basePayload,
          statementPeriod:
            (typeof basePayload.statementPeriod === "string" && basePayload.statementPeriod.trim())
              ? basePayload.statementPeriod
              : parsedBank.statementPeriod,
          transactions,
          feedbackSignals: {
            priorBankTransactionMappings: associationContext?.bankStatementCorrectionHints?.transactionMappings.length ?? 0,
          },
        }), associationContext),
      };
    }

    return record;
  });

  const finalRecords = records.length > 0 ? records : fallback.records;
  const finalClauses = baseExtraction.clauses.length > 0 ? baseExtraction.clauses : fallback.clauses;
  return { records: finalRecords, clauses: finalClauses };
}

function applyClassificationGuardrails(
  extraction: AiIngestionExtractionResult,
  classification: IngestionClassification,
): AiIngestionExtractionResult {
  const records = [...extraction.records];
  const alreadyHasPredicted = records.some((row) => row.recordType === classification.predictedRecordType);
  if (!alreadyHasPredicted && classification.predictedRecordType !== "document-metadata") {
    records.push({
      recordType: "document-metadata",
      confidenceScore: classification.confidence,
      payloadJson: {
        title: "Classifier Routing Warning",
        warning: `Classifier predicted ${classification.predictedRecordType} but extractor did not emit that record type.`,
        classifier: classification,
      },
    });
  }

  if (classification.requiresManualReview) {
    records.push({
      recordType: "document-metadata",
      confidenceScore: classification.confidence,
      payloadJson: {
        title: "Manual Routing Required",
        warning: "Classifier confidence is below threshold; review and route manually before commit.",
        classifier: classification,
      },
    });
  }

  return {
    records,
    clauses: extraction.clauses,
  };
}

function buildOwnerRosterFallbackExtraction(
  job: AiIngestionJob,
  sourceText: string,
  ownerRosterCorrectionHints?: AssociationOwnerRosterCorrectionHints,
): AiIngestionExtractionResult {
  const ownerRosterItems = parseOwnerRosterText(sourceText);
  const normalizedBlock = parseOwnerRosterFromAddressBlocks(sourceText, ownerRosterCorrectionHints);
  const quality = scoreOwnerRosterItems(ownerRosterItems, sourceText);
  const unresolvedExceptions = buildOwnerRosterUnresolvedExceptions(normalizedBlock.entries);
  return {
    records: [{
      recordType: "owner-roster",
      confidenceScore: 0.72,
      payloadJson: attachDestinationRouting("owner-roster", {
        title: "Extracted Owner Roster",
        itemCount: ownerRosterItems.length,
        items: ownerRosterItems,
        normalizedEntries: normalizedBlock.entries,
        unresolvedExceptions,
        feedbackSignals: {
          priorUnitRemaps: ownerRosterCorrectionHints?.unitRemaps.length ?? 0,
          priorOwnerNameFixes: ownerRosterCorrectionHints?.ownerNameFixes.length ?? 0,
        },
        extractionStrategy: "deterministic-parser",
        extractionQuality: quality,
      }),
    }],
    clauses: [],
  };
}

function buildContactRosterFallbackExtraction(sourceText: string): AiIngestionExtractionResult {
  const contactRosterItems = parseContactRosterText(sourceText);
  return {
    records: [{
      recordType: "contact-roster",
      confidenceScore: 0.68,
      payloadJson: attachDestinationRouting("contact-roster", {
        title: "Extracted Contact Roster",
        itemCount: contactRosterItems.length,
        items: contactRosterItems,
      }),
    }],
    clauses: [],
  };
}

function buildBankStatementFallbackExtraction(
  sourceText: string,
  bankStatementCorrectionHints?: AssociationBankStatementCorrectionHints,
): AiIngestionExtractionResult {
  const parsed = parseBankStatementText(sourceText);
  return {
    records: [{
      recordType: "bank-statement",
      confidenceScore: 0.7,
      payloadJson: attachDestinationRouting("bank-statement", {
        statementPeriod: parsed.statementPeriod,
        transactionCountEstimate: sourceText.split(/\r?\n/).filter((line) => /\d/.test(line)).length,
        transactions: applyBankStatementCorrectionHints(parsed.transactions, bankStatementCorrectionHints),
        feedbackSignals: {
          priorBankTransactionMappings: bankStatementCorrectionHints?.transactionMappings.length ?? 0,
        },
        rawSnippet: sourceText.slice(0, 600),
      }),
    }],
    clauses: [],
  };
}

function buildInvoiceDraftFallbackExtraction(sourceText: string): AiIngestionExtractionResult {
  const amountMatch = sourceText.match(/\$?\d{1,3}(?:,\d{3})*(?:\.\d{2})?/);
  const dateMatch = sourceText.match(/\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/);
  const vendorLine = sourceText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !/invoice|date|amount|due/i.test(line)) ?? "Extracted Vendor";
  return {
    records: [{
      recordType: "invoice-draft",
      confidenceScore: 0.66,
      payloadJson: attachDestinationRouting("invoice-draft", {
        vendorName: vendorLine,
        invoiceNumber: null,
        amount: amountMatch ? toNumber(amountMatch[0]) : null,
        invoiceDate: dateMatch?.[0] ?? null,
        dueDate: null,
        rawSnippet: sourceText.slice(0, 400),
      }),
    }],
    clauses: [],
  };
}

function buildMeetingNotesFallbackExtraction(sourceText: string): AiIngestionExtractionResult {
  return {
    records: [{
      recordType: "meeting-notes",
      confidenceScore: 0.62,
      payloadJson: attachDestinationRouting("meeting-notes", {
        title: "Extracted Meeting Notes",
        summary: sourceText.slice(0, 400),
        suggestedMeetingType: /budget/i.test(sourceText) ? "budget" : "board",
      }),
    }],
    clauses: [],
  };
}

function buildDocumentMetadataFallbackExtraction(job: AiIngestionJob, sourceText: string): AiIngestionExtractionResult {
  return {
    records: [{
      recordType: "document-metadata",
      confidenceScore: 0.5,
      payloadJson: attachDestinationRouting("document-metadata", {
        title: job.sourceFilename || "Uploaded Document",
        tags: ["review-required"],
        snippet: sourceText.slice(0, 400),
      }),
    }],
    clauses: [],
  };
}

function getFallbackParserStrategies(): FallbackParserStrategy[] {
  return [
    {
      format: "address-block-roster",
      appliesTo: ({ job, sourceText }) => Boolean(job.associationId) && parseOwnerRosterText(sourceText).length > 0,
      build: ({ job, sourceText, ownerRosterCorrectionHints }) => buildOwnerRosterFallbackExtraction(job, sourceText, ownerRosterCorrectionHints),
    },
    {
      format: "structured-table",
      appliesTo: ({ job, sourceText }) => Boolean(job.associationId) && parseOwnerRosterText(sourceText).length > 0,
      build: ({ job, sourceText, ownerRosterCorrectionHints }) => buildOwnerRosterFallbackExtraction(job, sourceText, ownerRosterCorrectionHints),
    },
    {
      format: "delimited-list",
      appliesTo: ({ job, sourceText }) => Boolean(job.associationId) && parseOwnerRosterText(sourceText).length > 0,
      build: ({ job, sourceText, ownerRosterCorrectionHints }) => buildOwnerRosterFallbackExtraction(job, sourceText, ownerRosterCorrectionHints),
    },
    {
      format: "bank-statement",
      appliesTo: ({ sourceText }) => /statement|transaction|beginning balance|ending balance|debit|credit/i.test(sourceText),
      build: ({ sourceText, bankStatementCorrectionHints }) => buildBankStatementFallbackExtraction(sourceText, bankStatementCorrectionHints),
    },
    {
      format: "structured-table",
      appliesTo: ({ sourceText }) => parseContactRosterText(sourceText).length > 0,
      build: ({ sourceText }) => buildContactRosterFallbackExtraction(sourceText),
    },
    {
      format: "freeform-text",
      appliesTo: ({ sourceText }) => /invoice|vendor|amount|due/i.test(sourceText),
      build: ({ sourceText }) => buildInvoiceDraftFallbackExtraction(sourceText),
    },
    {
      format: "freeform-text",
      appliesTo: ({ sourceText }) => /meeting|minutes|agenda|resolution|board/i.test(sourceText),
      build: ({ sourceText }) => buildMeetingNotesFallbackExtraction(sourceText),
    },
    {
      format: "document-metadata",
      appliesTo: () => true,
      build: ({ job, sourceText }) => buildDocumentMetadataFallbackExtraction(job, sourceText),
    },
  ];
}

function buildFallbackIngestionExtraction(
  job: AiIngestionJob,
  sourceText: string,
  ownerRosterCorrectionHints?: AssociationOwnerRosterCorrectionHints,
  bankStatementCorrectionHints?: AssociationBankStatementCorrectionHints,
): AiIngestionExtractionResult {
  const format = detectIngestionSourceFormat(sourceText);
  const strategy = getFallbackParserStrategies().find((candidate) => candidate.appliesTo({ job, sourceText, format }));
  const strategyResult = strategy
    ? strategy.build({ job, sourceText, ownerRosterCorrectionHints, bankStatementCorrectionHints })
    : buildDocumentMetadataFallbackExtraction(job, sourceText);

  const isBylawLike = /bylaw|article|section|quorum|board|amendment|notice/i.test(sourceText);
  const clauses = isBylawLike
    ? (() => {
        const sectionMatches = Array.from(sourceText.matchAll(/(Article\s+[A-Za-z0-9IVX]+|Section\s+\d+(\.\d+)?)/gi));
        const chunks = sectionMatches.length > 0
          ? sectionMatches.slice(0, 8).map((match, index) => ({
              title: match[1],
              clauseText: sourceText.slice(match.index ?? 0, Math.min(sourceText.length, (sectionMatches[index + 1]?.index ?? sourceText.length))).trim(),
            }))
          : [{ title: "General Bylaw Clause", clauseText: sourceText.slice(0, 1200).trim() || "No source text provided." }];

        return chunks.map((chunk) => {
          const lower = chunk.clauseText.toLowerCase();
          const tags: string[] = [];
          const suggestedLinks: AiIngestionExtractionClause["suggestedLinks"] = [];
          if (lower.includes("meeting")) tags.push("meetings");
          if (lower.includes("budget")) {
            tags.push("budget");
            suggestedLinks.push({
              entityType: "governance-template-item",
              entityId: "budget-review",
              confidenceScore: 0.7,
            });
          }
          if (lower.includes("notice")) tags.push("notice");
          return {
            title: chunk.title,
            clauseText: chunk.clauseText,
            confidenceScore: 0.62,
            tags,
            suggestedLinks,
          };
        });
      })()
    : [];

  return {
    records: strategyResult.records,
    clauses,
  };
}

export interface IStorage {
  getAssociations(options?: { includeArchived?: boolean }): Promise<Association[]>;
  createAssociation(data: InsertAssociation, actorEmail?: string): Promise<Association>;
  updateAssociation(id: string, data: Partial<InsertAssociation>, actorEmail?: string): Promise<Association | undefined>;
  deleteAssociation(id: string, actorEmail?: string): Promise<boolean>;

  getBuildings(associationId?: string): Promise<Building[]>;
  getBuildingById(id: string): Promise<Building | undefined>;
  createBuilding(data: InsertBuilding, actorEmail?: string): Promise<Building>;
  updateBuilding(id: string, data: Partial<InsertBuilding>, actorEmail?: string): Promise<Building | undefined>;

  getUnits(associationId?: string): Promise<Unit[]>;
  getUnitById(id: string): Promise<Unit | undefined>;
  createUnit(data: InsertUnit, actorEmail?: string): Promise<Unit>;
  updateUnit(id: string, data: Partial<InsertUnit>, changedBy?: string): Promise<Unit | undefined>;
  deleteUnit(id: string, actorEmail?: string): Promise<boolean>;

  getPersons(associationId?: string): Promise<Person[]>;
  createPerson(data: InsertPerson, actorEmail?: string): Promise<Person>;
  updatePerson(id: string, data: Partial<InsertPerson>, actorEmail?: string): Promise<Person | undefined>;
  deletePerson(id: string, actorEmail?: string): Promise<boolean>;

  getOwnerships(associationId?: string): Promise<Ownership[]>;
  createOwnership(data: InsertOwnership, actorEmail?: string): Promise<Ownership>;
  updateOwnership(id: string, data: Partial<InsertOwnership>, actorEmail?: string): Promise<Ownership | undefined>;
  deleteOwnership(id: string, actorEmail?: string): Promise<boolean>;

  getOccupancies(associationId?: string): Promise<Occupancy[]>;
  createOccupancy(data: InsertOccupancy, actorEmail?: string): Promise<Occupancy>;
  deleteOccupancy(id: string, actorEmail?: string): Promise<boolean>;
  submitOnboardingIntake(input: {
    associationId: string;
    unitId: string;
    occupancyType: "OWNER_OCCUPIED" | "TENANT";
    person: {
      firstName: string;
      lastName: string;
      email?: string | null;
      phone?: string | null;
      mailingAddress?: string | null;
      emergencyContactName?: string | null;
      emergencyContactPhone?: string | null;
      contactPreference?: string | null;
    };
    startDate: Date;
    ownershipPercentage?: number | null;
  }): Promise<{
    person: Person;
    occupancy: Occupancy;
    ownership: Ownership | null;
  }>;
  getOnboardingInvites(associationId: string): Promise<Array<OnboardingInvite & { unitLabel?: string; associationName?: string }>>;
  createOnboardingInvite(data: InsertOnboardingInvite): Promise<OnboardingInvite & { inviteUrl: string }>;
  getOrCreateUnitOnboardingLink(input: {
    associationId: string;
    unitId: string;
    residentType: "owner" | "tenant";
    createdBy?: string | null;
    expiresAt?: Date | null;
  }): Promise<OnboardingInvite & { inviteUrl: string; created: boolean }>;
  regenerateUnitOnboardingLink(input: {
    associationId: string;
    unitId: string;
    residentType: "owner" | "tenant";
    createdBy?: string | null;
    expiresAt?: Date | null;
  }): Promise<OnboardingInvite & { inviteUrl: string }>;
  getOnboardingInviteByToken(token: string): Promise<(OnboardingInvite & {
    unitLabel?: string;
    unitBuilding?: string | null;
    associationName?: string;
    associationAddress?: string | null;
    associationCity?: string | null;
    associationState?: string | null;
    associationCountry?: string | null;
  }) | undefined>;
  sendOnboardingInvite(id: string, sentBy?: string | null): Promise<{ invite: OnboardingInvite; history: CommunicationHistory; delivery: { status: "sent" | "failed" | "simulated"; logId: string; provider: string; messageId: string | null; errorMessage?: string | null } }>;
  runOnboardingInviteReminderSweep(input: { associationId: string; sentBy?: string | null; olderThanHours?: number }): Promise<{ processed: number; sent: number; failed: number }>;
  createOnboardingSubmissionFromInvite(token: string, input: {
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
    mailingAddress?: string | null;
    emergencyContactName?: string | null;
    emergencyContactPhone?: string | null;
    contactPreference?: string | null;
    startDate: Date;
    ownershipPercentage?: number | null;
  }): Promise<OnboardingSubmission>;
  getOnboardingSubmissions(associationId: string): Promise<Array<OnboardingSubmission & {
    unitLabel?: string;
    associationName?: string;
    inviteEmail?: string | null;
    matchedPersonId?: string | null;
    matchBasis?: "email" | "name" | "none";
    reviewNotes?: string[];
  }>>;
  reviewOnboardingSubmission(id: string, input: { decision: "approved" | "rejected"; reviewedBy: string; rejectionReason?: string | null }): Promise<OnboardingSubmission>;
  getResidentialDataset(associationId?: string): Promise<ResidentialDataset>;
  getAssociationOnboardingState(associationId: string): Promise<{
    associationId: string;
    state: "not-started" | "in-progress" | "blocked" | "complete";
    blockers: string[];
    remediationActions: string[];
    remediationItems: Array<{ label: string; href: string; summary: string }>;
    scorePercent: number;
    components: {
      unitsConfigured: { score: number; total: number; completed: number };
      ownerDataCollected: { score: number; total: number; completed: number };
      tenantDataCollected: { score: number; total: number; completed: number };
      boardMembersConfigured: { score: number; total: number; completed: number };
      paymentMethodsConfigured: { score: number; total: number; completed: number };
      communicationTemplatesConfigured: { score: number; total: number; completed: number };
    };
  }>;
  // [4.4 Q2 AC 1-5] Post-signup Home-banner checklist — 4 locked items +
  // per-admin-user dismissal state.
  getSignupOnboardingChecklist(adminUserId: string): Promise<{
    associationDetailsComplete: boolean;
    boardOfficerInvited: boolean;
    unitsAdded: boolean;
    firstDocumentUploaded: boolean;
    dismissed: boolean;
    dismissedAt: string | null;
  }>;
  dismissSignupOnboardingBanner(adminUserId: string): Promise<void>;
  getAssociationOverview(associationId: string): Promise<{
    associationId: string;
    units: number;
    activeOwners: number;
    activeOccupants: number;
    ownerOccupiedUnits: number;
    rentalOccupiedUnits: number;
    vacantUnits: number;
    unassignedUnits: number;
    occupancyRatePercent: number;
    maintenanceOpen: number;
    maintenanceOverdue: number;
    paymentMethodsActive: number;
    onboardingState: "not-started" | "in-progress" | "blocked" | "complete";
    onboardingScorePercent: number;
    contactCoveragePercent: number;
  }>;

  getBoardRoles(associationId?: string): Promise<BoardRole[]>;
  createBoardRole(data: InsertBoardRole, actorEmail?: string): Promise<BoardRole>;
  deleteBoardRole(id: string, actorEmail?: string): Promise<boolean>;

  getDocuments(associationId?: string): Promise<Document[]>;
  getVendorDocuments(vendorId: string): Promise<Document[]>;
  createDocument(data: InsertDocument, actorEmail?: string): Promise<Document>;
  createVendorDocument(vendorId: string, data: InsertDocument, actorEmail?: string): Promise<Document>;
  updateDocument(id: string, data: Partial<InsertDocument>, actorEmail?: string): Promise<Document | undefined>;
  deleteDocument(id: string, actorEmail?: string): Promise<boolean>;
  getHoaFeeSchedules(associationId?: string): Promise<HoaFeeSchedule[]>;
  createHoaFeeSchedule(data: InsertHoaFeeSchedule): Promise<HoaFeeSchedule>;
  updateHoaFeeSchedule(id: string, data: Partial<InsertHoaFeeSchedule>): Promise<HoaFeeSchedule | undefined>;
  getSpecialAssessments(associationId?: string): Promise<SpecialAssessment[]>;
  createSpecialAssessment(data: InsertSpecialAssessment): Promise<SpecialAssessment>;
  updateSpecialAssessment(id: string, data: Partial<InsertSpecialAssessment>): Promise<SpecialAssessment | undefined>;
  getLateFeeRules(associationId?: string): Promise<LateFeeRule[]>;
  createLateFeeRule(data: InsertLateFeeRule): Promise<LateFeeRule>;
  updateLateFeeRule(id: string, data: Partial<InsertLateFeeRule>): Promise<LateFeeRule | undefined>;
  getLateFeeEvents(associationId?: string): Promise<LateFeeEvent[]>;
  calculateLateFee(input: {
    associationId: string;
    ruleId: string;
    balanceAmount: number;
    dueDate: Date;
    asOfDate: Date;
    referenceType?: string | null;
    referenceId?: string | null;
    apply?: boolean;
  }): Promise<{ calculatedFee: number; daysLate: number; appliedEventId: string | null }>;
  getFinancialAccounts(associationId?: string): Promise<FinancialAccount[]>;
  createFinancialAccount(data: InsertFinancialAccount): Promise<FinancialAccount>;
  updateFinancialAccount(id: string, data: Partial<InsertFinancialAccount>): Promise<FinancialAccount | undefined>;
  getFinancialCategories(associationId?: string): Promise<FinancialCategory[]>;
  createFinancialCategory(data: InsertFinancialCategory): Promise<FinancialCategory>;
  updateFinancialCategory(id: string, data: Partial<InsertFinancialCategory>): Promise<FinancialCategory | undefined>;
  getBudgets(associationId?: string): Promise<Budget[]>;
  createBudget(data: InsertBudget): Promise<Budget>;
  updateBudget(id: string, data: Partial<InsertBudget>): Promise<Budget | undefined>;
  getBudgetVersions(budgetId: string): Promise<BudgetVersion[]>;
  createBudgetVersion(data: InsertBudgetVersion): Promise<BudgetVersion>;
  updateBudgetVersion(id: string, data: Partial<InsertBudgetVersion>): Promise<BudgetVersion | undefined>;
  getBudgetLines(budgetVersionId: string): Promise<BudgetLine[]>;
  createBudgetLine(data: InsertBudgetLine): Promise<BudgetLine>;
  updateBudgetLine(id: string, data: Partial<InsertBudgetLine>): Promise<BudgetLine | undefined>;
  getBudgetVariance(associationId: string, budgetVersionId: string): Promise<Array<{
    budgetLineId: string;
    lineItemName: string;
    plannedAmount: number;
    actualAmount: number;
    varianceAmount: number;
    accountId: string | null;
    categoryId: string | null;
  }>>;
  getVendorInvoices(associationId?: string): Promise<VendorInvoice[]>;
  getVendors(associationId?: string): Promise<Vendor[]>;
  getVendorRenewalAlerts(associationId?: string): Promise<Array<{ vendorId: string; vendorName: string; associationId: string; daysUntilExpiry: number; severity: "expired" | "due-soon"; insuranceExpiresAt: Date }>>;
  createVendor(data: InsertVendor): Promise<Vendor>;
  updateVendor(id: string, data: Partial<InsertVendor>): Promise<Vendor | undefined>;
  createVendorInvoice(data: InsertVendorInvoice): Promise<VendorInvoice>;
  updateVendorInvoice(id: string, data: Partial<InsertVendorInvoice>): Promise<VendorInvoice | undefined>;
  getUtilityPayments(associationId?: string): Promise<UtilityPayment[]>;
  createUtilityPayment(data: InsertUtilityPayment): Promise<UtilityPayment>;
  updateUtilityPayment(id: string, data: Partial<InsertUtilityPayment>): Promise<UtilityPayment | undefined>;
  getPaymentMethodConfigs(associationId?: string): Promise<PaymentMethodConfig[]>;
  createPaymentMethodConfig(data: InsertPaymentMethodConfig): Promise<PaymentMethodConfig>;
  updatePaymentMethodConfig(id: string, data: Partial<InsertPaymentMethodConfig>): Promise<PaymentMethodConfig | undefined>;
  getPaymentGatewayConnections(associationId?: string): Promise<PaymentGatewayConnection[]>;
  getActivePaymentGatewayConnection(payload: {
    associationId: string;
    provider?: "stripe" | "other" | null;
  }): Promise<{
    connection: PaymentGatewayConnection;
    publishableKey: string | null;
    secretKey: string | null;
    webhookSecret: string | null;
  } | null>;
  validateAndUpsertPaymentGatewayConnection(payload: {
    associationId: string;
    provider: "stripe" | "other";
    providerAccountId?: string | null;
    publishableKey?: string | null;
    secretKey?: string | null;
    webhookSecret?: string | null;
    isActive?: boolean;
    metadataJson?: Record<string, unknown> | null;
  }): Promise<{
    validated: boolean;
    checks: string[];
    connection: PaymentGatewayConnection;
  }>;
  createOwnerPaymentLink(payload: {
    associationId: string;
    unitId: string;
    personId: string;
    amount?: number | null;
    currency?: string | null;
    allowPartial?: boolean;
    memo?: string | null;
    expiresAt?: Date | string | null;
    createdBy?: string | null;
    metadataJson?: Record<string, unknown> | null;
  }): Promise<{ link: OwnerPaymentLink; paymentUrl: string; outstandingBalance: number }>;
  getOwnerPaymentLinkByToken(token: string): Promise<OwnerPaymentLink | undefined>;
  processPaymentWebhookEvent(payload: {
    associationId: string;
    provider: "stripe" | "other";
    providerEventId: string;
    eventType?: string | null;
    status?: "succeeded" | "failed" | "pending" | null;
    amount?: number | null;
    currency?: string | null;
    personId?: string | null;
    unitId?: string | null;
    paymentLinkToken?: string | null;
    gatewayReference?: string | null;
    rawPayloadJson?: unknown;
  }): Promise<{
    duplicate: boolean;
    event: PaymentWebhookEvent;
    ownerLedgerEntry: OwnerLedgerEntry | null;
    message: string;
  }>;
  sendPaymentInstructionNotice(payload: {
    associationId: string;
    templateId?: string | null;
    subject?: string | null;
    body?: string | null;
    audience?: "owners" | "occupants" | "all";
    ccOwners?: boolean;
    requireApproval?: boolean | null;
    scheduledFor?: Date | string | null;
    sentBy?: string | null;
  }): Promise<{
    recipientCount: number;
    sentCount: number;
    sendIds: string[];
    skippedRecipients: number;
    missingEmailCount: number;
    duplicateEmailCount: number;
    variables: Record<string, string>;
  }>;
  getExpenseAttachments(expenseType?: "invoice" | "utility-payment", expenseId?: string, associationId?: string): Promise<ExpenseAttachment[]>;
  createExpenseAttachment(data: InsertExpenseAttachment): Promise<ExpenseAttachment>;
  getOwnerLedgerEntries(associationId?: string): Promise<OwnerLedgerEntry[]>;
  createOwnerLedgerEntry(data: InsertOwnerLedgerEntry): Promise<OwnerLedgerEntry>;
  getOwnerLedgerSummary(associationId: string): Promise<Array<{ personId: string; unitId: string; balance: number }>>;
  getGovernanceMeetings(associationId?: string): Promise<GovernanceMeeting[]>;
  createGovernanceMeeting(data: InsertGovernanceMeeting): Promise<GovernanceMeeting>;
  updateGovernanceMeeting(id: string, data: Partial<InsertGovernanceMeeting>): Promise<GovernanceMeeting | undefined>;
  getMeetingAgendaItems(meetingId: string): Promise<MeetingAgendaItem[]>;
  createMeetingAgendaItem(data: InsertMeetingAgendaItem): Promise<MeetingAgendaItem>;
  getMeetingNotes(meetingId: string): Promise<MeetingNote[]>;
  createMeetingNote(data: InsertMeetingNote): Promise<MeetingNote>;
  updateMeetingNote(id: string, data: Partial<InsertMeetingNote>): Promise<MeetingNote | undefined>;
  getResolutions(associationId?: string): Promise<Resolution[]>;
  createResolution(data: InsertResolution): Promise<Resolution>;
  updateResolution(id: string, data: Partial<InsertResolution>): Promise<Resolution | undefined>;
  getVoteRecords(resolutionId: string): Promise<VoteRecord[]>;
  createVoteRecord(data: InsertVoteRecord): Promise<VoteRecord>;
  getCalendarEvents(associationId?: string): Promise<CalendarEvent[]>;
  createCalendarEvent(data: InsertCalendarEvent): Promise<CalendarEvent>;
  updateCalendarEvent(id: string, data: Partial<InsertCalendarEvent>): Promise<CalendarEvent | undefined>;
  getGovernanceComplianceTemplates(associationId?: string): Promise<GovernanceComplianceTemplate[]>;
  createGovernanceComplianceTemplate(data: InsertGovernanceComplianceTemplate): Promise<GovernanceComplianceTemplate>;
  updateGovernanceComplianceTemplate(id: string, data: Partial<InsertGovernanceComplianceTemplate>): Promise<GovernanceComplianceTemplate | undefined>;
  bootstrapGovernanceStateTemplateLibrary(states?: string[]): Promise<{ created: number; updated: number }>;
  getGovernanceTemplateItems(templateId: string): Promise<GovernanceTemplateItem[]>;
  createGovernanceTemplateItem(data: InsertGovernanceTemplateItem): Promise<GovernanceTemplateItem>;
  getAnnualGovernanceTasks(associationId?: string): Promise<AnnualGovernanceTask[]>;
  createAnnualGovernanceTask(data: InsertAnnualGovernanceTask): Promise<AnnualGovernanceTask>;
  updateAnnualGovernanceTask(id: string, data: Partial<InsertAnnualGovernanceTask>): Promise<AnnualGovernanceTask | undefined>;
  getComplianceGapAlerts(associationId: string): Promise<Array<{
    templateId: string;
    templateItemId: string;
    templateName: string;
    templateItemTitle: string;
    obligationType: string;
    severity: "low" | "medium" | "high";
    status: "active" | "suppressed" | "resolved";
    sourceAuthority: string | null;
    sourceUrl: string | null;
    legalReference: string | null;
    dueMonth: number;
    dueDay: number;
    matchedRuleCount: number;
    matchedRuleIds: string[];
    suppressionReason: string | null;
    suppressedUntil: Date | null;
    staleRegulatoryRecord: boolean;
  }>>;
  upsertComplianceAlertOverride(data: InsertComplianceAlertOverride): Promise<ComplianceAlertOverride>;
  generateAnnualGovernanceTasksFromTemplate(input: {
    associationId: string;
    templateId: string;
    year: number;
    ownerPersonId?: string | null;
  }): Promise<{ created: number }>;
  getAiIngestionJobs(associationId?: string): Promise<AiIngestionJob[]>;
  getAiIngestionMonitoring(windowDays?: number): Promise<{
    windowDays: number;
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    processingJobs: number;
    queuedJobs: number;
    failureRate: number;
    avgDurationMs: number;
    alerts: string[];
  }>;
  createAiIngestionJob(data: InsertAiIngestionJob & { submittedBy?: string | null; sourceFileUrl?: string | null }): Promise<AiIngestionJob>;
  processAiIngestionJob(jobId: string): Promise<AiIngestionJob>;
  getAiExtractedRecords(jobId?: string, options?: { includeSuperseded?: boolean }): Promise<AiExtractedRecord[]>;
  getAiIngestionJobHistorySummary(jobId: string): Promise<{
    activeRecordCount: number;
    supersededRecordCount: number;
    activeClauseCount: number;
    supersededClauseCount: number;
    lastSupersededAt: Date | null;
  }>;
  previewAiIngestionSupersededCleanup(retentionDays: number): Promise<{
    retentionDays: number;
    purgeableClauses: number;
    purgeableExtractedRecords: number;
    blockedExtractedRecords: number;
    oldestEligibleSupersededAt: Date | null;
    message: string;
  }>;
  executeAiIngestionSupersededCleanup(retentionDays: number): Promise<{
    retentionDays: number;
    deletedClauses: number;
    deletedClauseTags: number;
    deletedSuggestedLinks: number;
    deletedExtractedRecords: number;
    blockedExtractedRecords: number;
    message: string;
  }>;
  getAiExtractedRecordById(id: string): Promise<AiExtractedRecord | undefined>;
  createAiExtractedRecord(data: InsertAiExtractedRecord): Promise<AiExtractedRecord>;
  createAiIngestionImportRun(data: InsertAiIngestionImportRun): Promise<AiIngestionImportRun>;
  getAiIngestionImportRuns(extractedRecordId: string): Promise<AiIngestionImportRun[]>;
  getBankStatementResolutionHints(recordId: string): Promise<BankStatementResolutionHint[]>;
  rollbackAiIngestionImportRun(runId: string, actorEmail?: string): Promise<{
    rolledBack: boolean;
    deletedVendorInvoices: number;
    deletedOwnerLedgerEntries: number;
    message: string;
  }>;
  reprocessAiIngestionImportRun(runId: string, options?: {
    rollbackFirst?: boolean;
    actorEmail?: string;
  }): Promise<{
    reprocessed: boolean;
    ingestionJobId: string | null;
    rolledBack: boolean;
    message: string;
  }>;
  previewRollbackAiIngestionImportRun(runId: string): Promise<{
    canRollback: boolean;
    vendorInvoicesToDelete: number;
    ownerLedgerEntriesToDelete: number;
    missingRefs: number;
    message: string;
  }>;
  reviewAiExtractedRecord(id: string, payload: { reviewStatus: "approved" | "rejected"; payloadJson?: unknown; reviewedBy?: string | null }): Promise<AiExtractedRecord | undefined>;
  getClauseRecords(filters?: { ingestionJobId?: string; associationId?: string; reviewStatus?: "pending-review" | "approved" | "rejected"; query?: string; includeSuperseded?: boolean }): Promise<ClauseRecord[]>;
  createClauseRecord(data: InsertClauseRecord): Promise<ClauseRecord>;
  reviewClauseRecord(id: string, payload: { reviewStatus: "approved" | "rejected"; title?: string; clauseText?: string; reviewedBy?: string | null }): Promise<ClauseRecord | undefined>;
  getComplianceRuleRecords(filters?: { associationId?: string; clauseRecordId?: string }): Promise<AiExtractedRecord[]>;
  extractComplianceRulesFromClauses(options?: { associationId?: string; actorEmail?: string | null }): Promise<{ processed: number; created: number; recordIds: string[]; source: "approved-clauses" | "template-fallback" }>;
  importApprovedAiExtractedRecord(
    id: string,
    actorEmail?: string,
    options?: { mode?: "preview" | "commit"; payloadOverride?: unknown },
  ): Promise<{
    imported: boolean;
    dryRun: boolean;
    targetModule: string;
    createdPersons: number;
    updatedPersons: number;
    createdUnits: number;
    createdOwnerships: number;
    createdVendorInvoices: number;
    createdOwnerLedgerEntries: number;
    skippedRows: number;
    message: string;
  }>;
  getClauseTags(clauseRecordId: string): Promise<ClauseTag[]>;
  createClauseTag(data: InsertClauseTag): Promise<ClauseTag>;
  getSuggestedLinks(clauseRecordId: string): Promise<SuggestedLink[]>;
  createSuggestedLink(data: InsertSuggestedLink): Promise<SuggestedLink>;
  updateSuggestedLink(id: string, data: { isApproved?: number; confidenceScore?: number | null }): Promise<SuggestedLink | undefined>;
  getApprovedClauseLinksForGovernance(associationId?: string): Promise<Array<{
    clauseRecordId: string;
    clauseTitle: string;
    clauseText: string;
    entityType: string;
    entityId: string;
    confidenceScore: number | null;
    isApproved: number;
  }>>;
  getNoticeTemplates(associationId?: string): Promise<NoticeTemplate[]>;
  createNoticeTemplate(data: InsertNoticeTemplate): Promise<NoticeTemplate>;
  updateNoticeTemplate(id: string, data: Partial<InsertNoticeTemplate>): Promise<NoticeTemplate | undefined>;
  sendNotice(payload: {
    associationId?: string | null;
    templateId?: string | null;
    campaignKey?: string | null;
    recipientEmail: string;
    recipientPersonId?: string | null;
    recipientUnitId?: string | null;
    recipientRole?: "owner" | "tenant" | "board-member" | null;
    subject?: string | null;
    body?: string | null;
    variables?: Record<string, string>;
    metadataJson?: Record<string, unknown> | null;
    requireApproval?: boolean | null;
    scheduledFor?: Date | string | null;
    bypassReadinessGate?: boolean | null;
    sentBy?: string | null;
  }): Promise<{ send: NoticeSend; history: CommunicationHistory }>;
  resolveNotificationRecipients(payload: {
    associationId: string;
    targetType: "all-owners" | "all-tenants" | "all-occupants" | "selected-units" | "individual-owner" | "individual-tenant" | "board-members";
    selectedUnitIds?: string[];
    selectedPersonId?: string | null;
    selectedUnitAudience?: "owners" | "tenants" | "occupants" | "all";
    messageClass?: "general" | "operational" | "maintenance" | "financial" | "governance";
    ccOwners?: boolean;
  }): Promise<Array<{
    personId: string;
    email: string;
    role: "owner" | "tenant" | "board-member";
    unitId: string;
  }>>;
  resolveNotificationRecipientPreview(payload: {
    associationId: string;
    targetType: "all-owners" | "all-tenants" | "all-occupants" | "selected-units" | "individual-owner" | "individual-tenant" | "board-members";
    selectedUnitIds?: string[];
    selectedPersonId?: string | null;
    selectedUnitAudience?: "owners" | "tenants" | "occupants" | "all";
    messageClass?: "general" | "operational" | "maintenance" | "financial" | "governance";
    ccOwners?: boolean;
  }): Promise<NotificationRecipientResolution>;
  sendTargetedNotice(payload: {
    associationId: string;
    targetType: "all-owners" | "all-tenants" | "all-occupants" | "selected-units" | "individual-owner" | "individual-tenant" | "board-members";
    selectedUnitIds?: string[];
    selectedPersonId?: string | null;
    selectedUnitAudience?: "owners" | "tenants" | "occupants" | "all";
    messageClass?: "general" | "operational" | "maintenance" | "financial" | "governance";
    ccOwners?: boolean;
    templateId?: string | null;
    subject?: string | null;
    body?: string | null;
    variables?: Record<string, string>;
    requireApproval?: boolean | null;
    scheduledFor?: Date | string | null;
    bypassReadinessGate?: boolean | null;
    sentBy?: string | null;
  }): Promise<{
    recipientCount: number;
    sentCount: number;
    sendIds: string[];
    skippedRecipients: number;
    missingEmailCount: number;
    duplicateEmailCount: number;
  }>;
  getAssociationContactReadiness(associationId: string): Promise<{
    associationId: string;
    activeOwners: number;
    activeOccupants: number;
    contactableOwners: number;
    contactableOccupants: number;
    contactCoveragePercent: number;
    canSendNotices: boolean;
    blockingReasons: string[];
  }>;
  getAssociationOnboardingCompleteness(associationId: string): Promise<{
    associationId: string;
    scorePercent: number;
    components: {
      unitsConfigured: { score: number; total: number; completed: number };
      ownerDataCollected: { score: number; total: number; completed: number };
      tenantDataCollected: { score: number; total: number; completed: number };
      boardMembersConfigured: { score: number; total: number; completed: number };
      paymentMethodsConfigured: { score: number; total: number; completed: number };
      communicationTemplatesConfigured: { score: number; total: number; completed: number };
    };
  }>;
  getNoticeSends(associationId?: string, status?: string): Promise<NoticeSend[]>;
  reviewNoticeSend(
    id: string,
    payload: { decision: "approved" | "rejected"; actedBy?: string | null },
  ): Promise<{ send: NoticeSend; history: CommunicationHistory } | undefined>;
  runScheduledNotices(options?: {
    associationId?: string;
    now?: Date;
    actedBy?: string | null;
  }): Promise<{ processed: number; sendIds: string[] }>;
  getCommunicationHistory(associationId?: string): Promise<CommunicationHistory[]>;
  getPermissionEnvelopes(associationId?: string): Promise<PermissionEnvelope[]>;
  createPermissionEnvelope(data: InsertPermissionEnvelope): Promise<PermissionEnvelope>;
  updatePermissionEnvelope(id: string, data: Partial<InsertPermissionEnvelope>): Promise<PermissionEnvelope | undefined>;
  getAdminAssociationScopes(): Promise<AdminAssociationScope[]>;
  getAdminAssociationScopesByUserId(adminUserId: string): Promise<AdminAssociationScope[]>;
  upsertAdminAssociationScope(data: InsertAdminAssociationScope): Promise<AdminAssociationScope>;
  getPortalAccesses(associationId?: string): Promise<PortalAccess[]>;
  getPortalAccessesByEmail(email: string): Promise<PortalAccess[]>;
  createPortalAccess(data: InsertPortalAccess, actorEmail?: string | null): Promise<PortalAccess>;
  updatePortalAccess(id: string, data: Partial<InsertPortalAccess>, actorEmail?: string | null): Promise<PortalAccess | undefined>;
  getPortalAccessById(id: string): Promise<PortalAccess | undefined>;
  getPortalAccessByAssociationEmail(associationId: string, email: string): Promise<PortalAccess | undefined>;
  resolvePortalAccessContext(portalAccessId: string): Promise<{
    access: PortalAccess;
    boardRole: BoardRole | null;
    hasBoardAccess: boolean;
    effectiveRole: "owner" | "tenant" | "readonly" | "board-member" | "owner-board-member";
  } | undefined>;
  inviteBoardMemberAccess(input: {
    associationId: string;
    personId: string;
    boardRoleId: string;
    email?: string | null;
    invitedBy?: string | null;
  }): Promise<PortalAccess>;
  touchPortalAccessLogin(id: string): Promise<void>;
  getAssociationMemberships(associationId?: string): Promise<AssociationMembership[]>;
  upsertAssociationMembership(data: InsertAssociationMembership): Promise<AssociationMembership>;
  getTenantConfig(associationId: string): Promise<TenantConfig | undefined>;
  upsertTenantConfig(data: InsertTenantConfig): Promise<TenantConfig>;
  getEmailThreads(associationId?: string): Promise<EmailThread[]>;
  upsertEmailThread(data: InsertEmailThread): Promise<EmailThread>;
  getContactUpdateRequests(filters?: { associationId?: string; portalAccessId?: string }): Promise<ContactUpdateRequest[]>;
  createContactUpdateRequest(data: InsertContactUpdateRequest): Promise<ContactUpdateRequest>;
  reviewContactUpdateRequest(id: string, payload: { reviewStatus: "approved" | "rejected"; reviewedBy?: string | null }): Promise<ContactUpdateRequest | undefined>;
  getMaintenanceRequests(filters?: {
    associationId?: string;
    portalAccessId?: string;
    status?: string;
  }): Promise<MaintenanceRequest[]>;
  createMaintenanceRequest(data: InsertMaintenanceRequest): Promise<MaintenanceRequest>;
  updateMaintenanceRequest(id: string, data: Partial<InsertMaintenanceRequest>): Promise<MaintenanceRequest | undefined>;
  getWorkOrders(filters?: {
    associationId?: string;
    unitId?: string;
    vendorId?: string;
    maintenanceRequestId?: string;
    status?: string;
  }): Promise<WorkOrder[]>;
  createWorkOrder(data: InsertWorkOrder, actorEmail?: string): Promise<WorkOrder>;
  updateWorkOrder(id: string, data: Partial<InsertWorkOrder>, actorEmail?: string): Promise<WorkOrder | undefined>;
  convertMaintenanceRequestToWorkOrder(id: string, payload?: Partial<InsertWorkOrder>, actorEmail?: string): Promise<WorkOrder>;
  getInspectionRecords(filters?: {
    associationId?: string;
    unitId?: string;
    inspectionType?: string;
  }): Promise<InspectionRecord[]>;
  createInspectionRecord(data: InsertInspectionRecord, actorEmail?: string): Promise<InspectionRecord>;
  updateInspectionRecord(id: string, data: Partial<InsertInspectionRecord>, actorEmail?: string): Promise<InspectionRecord | undefined>;
  convertInspectionFindingToWorkOrder(
    id: string,
    findingIndex: number,
    payload?: Partial<InsertWorkOrder>,
    actorEmail?: string,
  ): Promise<WorkOrder>;
  getMaintenanceScheduleTemplates(filters?: { associationId?: string; unitId?: string; status?: string }): Promise<MaintenanceScheduleTemplate[]>;
  createMaintenanceScheduleTemplate(data: InsertMaintenanceScheduleTemplate, actorEmail?: string): Promise<MaintenanceScheduleTemplate>;
  updateMaintenanceScheduleTemplate(
    id: string,
    data: Partial<InsertMaintenanceScheduleTemplate>,
    actorEmail?: string,
  ): Promise<MaintenanceScheduleTemplate | undefined>;
  getMaintenanceScheduleInstances(filters?: { associationId?: string; templateId?: string; status?: string }): Promise<MaintenanceScheduleInstance[]>;
  createMaintenanceScheduleInstance(data: InsertMaintenanceScheduleInstance, actorEmail?: string): Promise<MaintenanceScheduleInstance>;
  generateMaintenanceScheduleInstances(
    templateId: string,
    options?: { throughDate?: Date; actorEmail?: string | null },
  ): Promise<MaintenanceScheduleInstance[]>;
  convertMaintenanceInstanceToWorkOrder(
    id: string,
    payload?: Partial<InsertWorkOrder>,
    actorEmail?: string,
  ): Promise<WorkOrder>;
  runMaintenanceEscalationSweep(options?: {
    associationId?: string;
    now?: Date;
    actorEmail?: string | null;
  }): Promise<{
    processed: number;
    escalated: number;
    escalatedIds: string[];
  }>;
  getPortalDocuments(portalAccessId: string): Promise<Document[]>;
  getPortalCommunicationHistory(portalAccessId: string): Promise<CommunicationHistory[]>;
  getUnitChangeHistory(unitId: string): Promise<UnitChangeHistory[]>;
  getAssociationIdForScopedResource(resourceType: string, id: string): Promise<string | null | undefined>;
  createDocumentTag(data: InsertDocumentTag, actorEmail?: string): Promise<DocumentTag>;
  getDocumentTags(documentId: string): Promise<DocumentTag[]>;
  createDocumentVersion(data: InsertDocumentVersion, actorEmail?: string): Promise<DocumentVersion>;
  getDocumentVersions(documentId: string): Promise<DocumentVersion[]>;
  getAuditLogs(associationId?: string): Promise<AuditLog[]>;
  getAdminUsers(): Promise<AdminUser[]>;
  getAdminUserById(id: string): Promise<AdminUser | undefined>;
  getAdminUserByEmail(email: string): Promise<AdminUser | undefined>;
  upsertAdminUser(data: InsertAdminUser): Promise<AdminUser>;
  updateAdminUserRole(id: string, role: NonNullable<InsertAdminUser["role"]>, changedBy: string, reason?: string): Promise<AdminUser | undefined>;
  setAdminUserActive(id: string, isActive: boolean, changedBy: string): Promise<AdminUser | undefined>;
  getAuthUserById(id: string): Promise<AuthUser | undefined>;
  getAuthUserByEmail(email: string): Promise<AuthUser | undefined>;
  createAuthUser(data: InsertAuthUser): Promise<AuthUser>;
  updateAuthUser(id: string, data: Partial<InsertAuthUser>): Promise<AuthUser | undefined>;
  getAuthExternalAccount(provider: "google", providerAccountId: string): Promise<AuthExternalAccount | undefined>;
  getAuthExternalAccountByProviderEmail(provider: "google", providerEmail: string): Promise<AuthExternalAccount | undefined>;
  createAuthExternalAccount(data: InsertAuthExternalAccount): Promise<AuthExternalAccount>;
  upsertAuthExternalAccount(data: InsertAuthExternalAccount): Promise<AuthExternalAccount>;
  touchAuthUserLogin(userId: string): Promise<void>;

  getDashboardStats(options?: {
    associationIds?: string[];
    includeArchived?: boolean;
  }): Promise<{
    totalAssociations: number;
    totalUnits: number;
    totalOwners: number;
    totalTenants: number;
    totalBoardMembers: number;
    totalDocuments: number;
  }>;
  getOperationsDashboard(associationId?: string): Promise<{
    totals: {
      openWorkOrders: number;
      dueMaintenance: number;
      openFindings: number;
      activeVendors: number;
      pendingRenewalVendors: number;
      overdueInstances: number;
    };
    workOrderAging: { open: number; inProgress: number; pendingReview: number; closed: number };
    vendorStatus: { active: number; inactive: number; pendingRenewal: number };
    recentWorkOrders: WorkOrder[];
    dueInstances: MaintenanceScheduleInstance[];
    recentInspections: InspectionRecord[];
    recentAudit: AuditLog[];
  }>;
  exportOperationsReport(
    reportType: "vendors" | "work-orders" | "maintenance",
    associationId?: string,
  ): Promise<{ filename: string; contentType: string; body: string }>;
  getBoardPackageTemplates(associationId?: string): Promise<BoardPackageTemplate[]>;
  createBoardPackageTemplate(data: InsertBoardPackageTemplate): Promise<BoardPackageTemplate>;
  updateBoardPackageTemplate(id: string, data: Partial<InsertBoardPackageTemplate>): Promise<BoardPackageTemplate | undefined>;
  getBoardPackages(associationId?: string): Promise<BoardPackage[]>;
  createBoardPackage(data: InsertBoardPackage): Promise<BoardPackage>;
  updateBoardPackage(id: string, data: Partial<InsertBoardPackage>, actorEmail?: string): Promise<BoardPackage | undefined>;
  generateBoardPackage(templateId: string, options?: { periodLabel?: string; meetingId?: string | null }): Promise<BoardPackage>;
  runScheduledBoardPackageGeneration(options?: {
    associationId?: string;
    now?: Date;
    actorEmail?: string | null;
  }): Promise<{
    processed: number;
    generated: number;
    packageIds: string[];
  }>;
  distributeBoardPackage(
    id: string,
    payload?: { recipientEmails?: string[]; message?: string | null; actorEmail?: string | null },
  ): Promise<{
    boardPackage: BoardPackage;
    recipients: string[];
    historyIds: string[];
    sentCount: number;
    failedCount: number;
    failedRecipients: string[];
  }>;

  // Platform Subscriptions
  getPlatformSubscription(associationId: string): Promise<PlatformSubscription | undefined>;
  getPlatformSubscriptionByStripeId(stripeSubscriptionId: string): Promise<PlatformSubscription | undefined>;
  createPlatformSubscription(data: InsertPlatformSubscription): Promise<PlatformSubscription>;
  updatePlatformSubscription(id: string, data: Partial<InsertPlatformSubscription>): Promise<PlatformSubscription | undefined>;
  listPlatformSubscriptions(): Promise<PlatformSubscription[]>;

  getRoadmap(): Promise<RoadmapResponse>;
  createRoadmapProject(data: InsertRoadmapProject): Promise<RoadmapProject>;
  createRoadmapWorkstream(data: InsertRoadmapWorkstream): Promise<RoadmapWorkstream>;
  createRoadmapTask(data: InsertRoadmapTask): Promise<RoadmapTask>;
  updateRoadmapTask(id: string, data: Partial<InsertRoadmapTask>): Promise<RoadmapTask | undefined>;
  updateRoadmapProject(id: string, data: Partial<InsertRoadmapProject>): Promise<RoadmapProject | undefined>;
  updateRoadmapWorkstream(id: string, data: Partial<InsertRoadmapWorkstream>): Promise<RoadmapWorkstream | undefined>;
  getRoadmapProject(id: string): Promise<RoadmapProject | undefined>;
  getRoadmapWorkstream(id: string): Promise<RoadmapWorkstream | undefined>;
  getRoadmapTask(id: string): Promise<RoadmapTask | undefined>;
  deleteRoadmapProject(id: string): Promise<void>;
  deleteRoadmapWorkstream(id: string): Promise<void>;
  deleteRoadmapTask(id: string): Promise<void>;
  getExecutiveUpdates(): Promise<ExecutiveUpdate[]>;
  createExecutiveUpdate(data: InsertExecutiveUpdate): Promise<ExecutiveUpdate>;
  updateExecutiveUpdate(id: string, data: Partial<InsertExecutiveUpdate>): Promise<ExecutiveUpdate | undefined>;
  getExecutiveEvidence(executiveUpdateId: string): Promise<ExecutiveEvidence[]>;
  createExecutiveEvidence(data: InsertExecutiveEvidence): Promise<ExecutiveEvidence>;
  syncExecutiveFromRoadmap(): Promise<{ created: number; updated: number }>;

  getAnalysisHistory(resourceId: string, module: string): Promise<{
    versions: (AnalysisVersion & { diffFromPrevious: AnalysisDiffSummary | null })[];
    runs: AnalysisRun[];
  }>;
  createAnalysisVersion(data: InsertAnalysisVersion): Promise<AnalysisVersion>;
  createAnalysisRun(data: InsertAnalysisRun): Promise<AnalysisRun>;
  revertAnalysisVersion(resourceId: string, module: string, versionId: string): Promise<AnalysisVersion>;

  getAdminAnalytics(days: number, associationId?: string): Promise<{
    analyzerMetrics: {
      totalRuns: number;
      successRate: number;
      avgDurationMs: number;
      avgItemCount: number;
    };
    roadmapMetrics: {
      totalProjects: number;
      totalWorkstreams: number;
      totalTasks: number;
      taskStatusDistribution: { todo: number; inProgress: number; done: number };
        completionRate: number;
        taskThroughput: number;
      };
      collectionMetrics: {
        associationId: string | null;
        totalCharges: number;
        totalPayments: number;
        totalCredits: number;
        openBalance: number;
        collectionRate: number;
        monthlyTrend: Array<{
          period: string;
          charges: number;
          payments: number;
          credits: number;
          collectionRate: number;
        }>;
        agingBuckets: {
          current: number;
          thirtyDays: number;
          sixtyDays: number;
          ninetyPlus: number;
        };
        delinquencyMovement: Array<{
          period: string;
          delinquentAccounts: number;
          totalBalance: number;
        }>;
      };
      reserveProjection: {
        associationId: string | null;
        currentReserveBalance: number;
        annualReserveContributions: number;
        annualReserveExpenses: number;
        annualSpecialAssessmentContribution: number;
        forecastWindows: Array<{
          months: number;
          projectedEndingBalance: number;
          projectedNetChange: number;
        }>;
      };
      expenseCategoryTrend: {
        associationId: string | null;
        categories: Array<{
          categoryId: string | null;
          categoryName: string;
          actualAmount: number;
          plannedAmount: number;
          varianceAmount: number;
        }>;
      };
    }>;

  // Elections
  getElections(associationId?: string, meetingId?: string): Promise<Election[]>;
  getElection(id: string): Promise<Election | undefined>;
  createElection(data: InsertElection): Promise<Election>;
  updateElection(id: string, data: Partial<InsertElection>): Promise<Election | undefined>;
  getElectionOptions(electionId: string): Promise<ElectionOption[]>;
  createElectionOption(data: InsertElectionOption): Promise<ElectionOption>;
  deleteElectionOption(id: string): Promise<void>;
  getNominationsForElection(electionId: string): Promise<ElectionOption[]>;
  approveNomination(optionId: string): Promise<ElectionOption | undefined>;
  rejectNomination(optionId: string): Promise<ElectionOption | undefined>;
  getPortalNominationsForElection(portalAccessId: string, electionId: string): Promise<ElectionOption[]>;
  submitNomination(data: { electionId: string; label: string; bio?: string; photoUrl?: string; currentRole?: string; nominationStatement?: string; nominatedByPersonId: string }): Promise<ElectionOption>;
  generateBallotTokens(electionId: string, actorEmail?: string): Promise<{ created: number }>;
  getBallotTokens(electionId: string): Promise<ElectionBallotToken[]>;
  getBallotTokenByToken(token: string): Promise<ElectionBallotToken | undefined>;
  castBallot(data: { token: string; choicesJson: string[]; personId?: string | null }): Promise<ElectionBallotCast>;
  getBallotCasts(electionId: string): Promise<ElectionBallotCast[]>;
  getProxyDesignations(electionId: string): Promise<(ElectionProxyDesignation & { ownerName: string; proxyName: string })[]>;
  createProxyDesignation(data: InsertElectionProxyDesignation): Promise<ElectionProxyDesignation>;
  revokeProxyDesignation(id: string): Promise<ElectionProxyDesignation | undefined>;
  getProxyDocuments(electionId: string): Promise<ElectionProxyDocument[]>;
  createProxyDocument(data: InsertElectionProxyDocument): Promise<ElectionProxyDocument>;
  getElectionTally(electionId: string): Promise<{
    electionId: string;
    eligibleCount: number;
    castCount: number;
    participationPercent: number;
    quorumPercent: number;
    quorumMet: boolean;
    optionTallies: Array<{ optionId: string; label: string; votes: number; percent: number }>;
    totalWeightedVotes: number;
    isCertified: boolean;
    certifiedAt: string | null;
  }>;
  certifyElection(id: string, actorEmail: string, certificationSummary?: string): Promise<Election>;
  revokeAllPendingTokens(electionId: string): Promise<number>;
  deleteElection(id: string): Promise<void>;
  getBallotTokensWithNames(electionId: string): Promise<Array<{
    id: string; token: string; personId: string | null; unitId: string | null;
    status: string; sentAt: Date | null; castAt: Date | null;
    voterName: string; unitNumber: string;
    confirmationRef: string | null;
  }>>;
  getVoterEmailsForElection(electionId: string): Promise<Array<{ tokenId: string; email: string; token: string; firstName: string }>>;
  getPendingVoterEmailsForElection(electionId: string): Promise<Array<{ tokenId: string; email: string; token: string; firstName: string }>>;
  markBallotTokensSent(tokenIds: string[]): Promise<void>;
  resendBallotToken(tokenId: string): Promise<{ token: string; email: string; personId: string; electionId: string } | null>;
  getOwnerElectionHistory(portalAccessId: string): Promise<Array<{
    election: Election;
    participated: boolean;
    status: "voted" | "proxy-designated" | "not-voted";
    outcome: string | null;
  }>>;
  getOwnerActiveElections(portalAccessId: string): Promise<Array<{
    election: Election;
    token: string;
  }>>;
  getElectionDetailForPortal(portalAccessId: string, electionId: string): Promise<{
    election: Election;
    options: ElectionOption[];
    participated: boolean;
    status: "voted" | "proxy-designated" | "not-voted";
    ballotToken: string | null;
    proxyDesignation: { id: string; proxyPersonId: string; proxyName: string; designatedAt: string; notes: string | null } | null;
    tally: { eligibleCount: number; castCount: number; participationPercent: number; quorumPercent: number; quorumMet: boolean; optionTallies: Array<{ optionId: string; label: string; votes: number; percent: number }> } | null;
  } | null>;
  getAssociationOwnersForProxy(portalAccessId: string, electionId: string): Promise<Array<{ personId: string; firstName: string; lastName: string }>>;
  revokeProxyDesignationForPortal(portalAccessId: string, designationId: string): Promise<boolean>;
  getBoardPendingElections(portalAccessId: string): Promise<Array<{
    election: Election;
    token: string;
  }>>;
  getCertifiedElections(associationId: string): Promise<Array<{
    election: Election;
    participationPercent: number;
    outcome: string | null;
  }>>;
  getRecentlyCertifiedBoardElections(associationId: string): Promise<Election[]>;
  closeExpiredElections(): Promise<number>;
  getActiveElectionsSummary(associationId?: string): Promise<Array<{
    id: string;
    title: string;
    associationId: string;
    status: string;
    closesAt: Date | null;
    eligibleVoterCount: number;
    castCount: number;
    participationPercent: number;
    quorumPercent: number;
    quorumMet: boolean;
  }>>;
  getElectionComplianceSummary(associationId: string): Promise<{
    totalElections: number;
    byYear: Array<{ year: number; count: number; quorumMet: number; quorumFailed: number; avgParticipation: number }>;
    overallAvgParticipation: number;
  }>;
  getElectionAnalytics(associationId: string): Promise<{
    totalElections: number;
    averageTurnoutPercent: number;
    highestParticipation: { electionId: string; title: string; participationPercent: number } | null;
    lowestParticipation: { electionId: string; title: string; participationPercent: number } | null;
    quorumFailureRate: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
  }>;
}

export class DatabaseStorage implements IStorage {
  private async recordAuditEvent(event: InsertAuditLog) {
    await db.insert(auditLogs).values(event);
  }

  private normalizeEmail(value?: string | null): string {
    return (value || "").trim().toLowerCase();
  }

  private normalizeName(value?: string | null): string {
    return (value || "").trim().toLowerCase();
  }

  private normalizeOnboardingContactPreference(value?: string | null): string {
    const normalized = (value || "").trim().toLowerCase();
    return normalized || "email";
  }

  private isDateRangeActive(startDate: Date, endDate?: Date | null, now = new Date()): boolean {
    return startDate <= now && (!endDate || endDate >= now);
  }

  private deriveUnitOccupancySnapshot(input: {
    ownerships: Ownership[];
    occupancies: Occupancy[];
    personById: Map<string, Person>;
    now?: Date;
  }): {
    owners: ResidentialDatasetUnitOwner[];
    activeOccupancy: ResidentialDatasetUnitOccupancy | null;
    occupancyStatus: "OWNER_OCCUPIED" | "RENTAL_OCCUPIED" | "VACANT" | "UNASSIGNED";
    ownerCount: number;
    tenantCount: number;
    occupantCount: number;
    lastOccupancyUpdate: string | null;
  } {
    const now = input.now ?? new Date();
    const activeOwnerships = input.ownerships.filter((row) => this.isDateRangeActive(row.startDate, row.endDate, now));
    const activeOccupancies = input.occupancies.filter((row) => this.isDateRangeActive(row.startDate, row.endDate, now));
    const activeTenantOccupancies = activeOccupancies.filter((row) => row.occupancyType === "TENANT");
    const activeOwnerOccupancies = activeOccupancies.filter((row) => row.occupancyType === "OWNER_OCCUPIED");

    let occupancyStatus: "OWNER_OCCUPIED" | "RENTAL_OCCUPIED" | "VACANT" | "UNASSIGNED" = "UNASSIGNED";
    if (activeOwnerships.length > 0) {
      if (activeTenantOccupancies.length > 0) occupancyStatus = "RENTAL_OCCUPIED";
      else if (activeOwnerOccupancies.length > 0) occupancyStatus = "OWNER_OCCUPIED";
      else occupancyStatus = "VACANT";
    }

    const activityDates = [
      ...input.ownerships.flatMap((row) => [row.startDate, row.endDate].filter(Boolean) as Date[]),
      ...input.occupancies.flatMap((row) => [row.startDate, row.endDate].filter(Boolean) as Date[]),
    ];
    const lastOccupancyUpdate = activityDates.length > 0
      ? new Date(Math.max(...activityDates.map((value) => new Date(value).getTime()))).toISOString()
      : null;

    const activeOccupancyRow = occupancyStatus === "OWNER_OCCUPIED"
      ? activeOwnerOccupancies[0] ?? null
      : occupancyStatus === "RENTAL_OCCUPIED"
        ? activeTenantOccupancies[0] ?? null
        : null;

    return {
      owners: activeOwnerships.map((ownership) => ({
        ownership,
        person: input.personById.get(ownership.personId) ?? null,
      })),
      activeOccupancy: activeOccupancyRow
        ? {
          occupancy: activeOccupancyRow,
          person: input.personById.get(activeOccupancyRow.personId) ?? null,
        }
        : null,
      occupancyStatus,
      ownerCount: activeOwnerships.length,
      tenantCount: activeTenantOccupancies.length,
      occupantCount: activeOccupancies.length,
      lastOccupancyUpdate,
    };
  }

  private normalizeOnboardingParticipant(
    value: unknown,
    options?: { requireName?: boolean; requireContact?: boolean },
  ): {
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    mailingAddress?: string | null;
    emergencyContactName?: string | null;
    emergencyContactPhone?: string | null;
    contactPreference?: string | null;
    ownershipPercentage?: number | null;
  } | null {
    if (!value || typeof value !== "object") return null;
    const row = value as Record<string, unknown>;
    const firstName = typeof row.firstName === "string" ? row.firstName.trim() : "";
    const lastName = typeof row.lastName === "string" ? row.lastName.trim() : "";
    const email = typeof row.email === "string" ? row.email.trim() || null : null;
    const phone = typeof row.phone === "string" ? row.phone.trim() || null : null;
    if (options?.requireName !== false && (!firstName || !lastName)) return null;
    if (options?.requireContact && !email && !phone) return null;
    const ownershipPercentage = typeof row.ownershipPercentage === "number"
      ? row.ownershipPercentage
      : typeof row.ownershipPercentage === "string" && row.ownershipPercentage.trim()
        ? Number(row.ownershipPercentage)
        : null;
    return {
      firstName,
      lastName,
      email,
      phone,
      mailingAddress: typeof row.mailingAddress === "string" ? row.mailingAddress.trim() || null : null,
      emergencyContactName: typeof row.emergencyContactName === "string" ? row.emergencyContactName.trim() || null : null,
      emergencyContactPhone: typeof row.emergencyContactPhone === "string" ? row.emergencyContactPhone.trim() || null : null,
      contactPreference: typeof row.contactPreference === "string" ? this.normalizeOnboardingContactPreference(row.contactPreference) : null,
      ownershipPercentage: ownershipPercentage !== null && Number.isFinite(ownershipPercentage) ? ownershipPercentage : null,
    };
  }

  private normalizeAdditionalOwners(value: unknown) {
    if (!Array.isArray(value)) return [];
    return value
      .map((row) => this.normalizeOnboardingParticipant(row, { requireName: true, requireContact: true }))
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .slice(0, 1);
  }

  private normalizeTenantResidents(value: unknown) {
    if (!Array.isArray(value)) return [];
    return value
      .map((row) => this.normalizeOnboardingParticipant(row, { requireName: true, requireContact: true }))
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
  }

  private async upsertOnboardingPerson(input: {
    associationId: string;
    person: {
      firstName: string;
      lastName: string;
      email?: string | null;
      phone?: string | null;
      mailingAddress?: string | null;
      emergencyContactName?: string | null;
      emergencyContactPhone?: string | null;
      contactPreference?: string | null;
    };
  }): Promise<Person> {
    const match = await this.findMatchingOnboardingPerson({
      associationId: input.associationId,
      firstName: input.person.firstName,
      lastName: input.person.lastName,
      email: input.person.email ?? null,
    });

    let person: Person;
    if (match.person) {
      person = match.person;
      const patch: Partial<InsertPerson> = {};
      if (!person.email && input.person.email) patch.email = input.person.email;
      if (!person.phone && input.person.phone) patch.phone = input.person.phone;
      if (!person.mailingAddress && input.person.mailingAddress) patch.mailingAddress = input.person.mailingAddress;
      if (!person.emergencyContactName && input.person.emergencyContactName) patch.emergencyContactName = input.person.emergencyContactName;
      if (!person.emergencyContactPhone && input.person.emergencyContactPhone) patch.emergencyContactPhone = input.person.emergencyContactPhone;
      if (Object.keys(patch).length > 0) {
        person = (await this.updatePerson(person.id, patch, "system")) ?? person;
      }
      return person;
    }

    [person] = await db
      .insert(persons)
      .values({
        firstName: input.person.firstName,
        lastName: input.person.lastName,
        email: input.person.email ?? null,
        phone: input.person.phone ?? null,
        mailingAddress: input.person.mailingAddress ?? null,
        emergencyContactName: input.person.emergencyContactName ?? null,
        emergencyContactPhone: input.person.emergencyContactPhone ?? null,
        contactPreference: input.person.contactPreference ?? "email",
      })
      .returning();

    return person;
  }

  private async ensureOnboardingPortalAccess(input: {
    associationId: string;
    personId: string;
    unitId: string;
    email?: string | null;
    role: "owner" | "tenant";
  }) {
    const email = (input.email || "").trim();
    if (!email) return;
    const existingPortalAccess = await this.getPortalAccessByAssociationEmail(input.associationId, email);
    if (!existingPortalAccess) {
      await this.createPortalAccess({
        associationId: input.associationId,
        personId: input.personId,
        unitId: input.unitId,
        email,
        role: input.role,
        status: "active",
      }, "system");
      return;
    }

    await this.updatePortalAccess(existingPortalAccess.id, {
      personId: input.personId,
      unitId: input.unitId,
      role: input.role,
      status: "active",
    }, "system");
  }

  private async findMatchingOnboardingPerson(input: {
    associationId: string;
    firstName: string;
    lastName: string;
    email?: string | null;
  }): Promise<{ person: Person | null; matchBasis: "email" | "name" | "none"; reviewNotes: string[]; requiresManualReview: boolean }> {
    const people = await this.getPersons(input.associationId);
    const normalizedEmail = this.normalizeEmail(input.email);
    if (normalizedEmail) {
      const emailMatch = people.find((person) => this.normalizeEmail(person.email) === normalizedEmail) ?? null;
      if (emailMatch) {
        return {
          person: emailMatch,
          matchBasis: "email",
          reviewNotes: [`Matched existing resident by email ${normalizedEmail}.`],
          requiresManualReview: false,
        };
      }
    }

    const normalizedFirst = this.normalizeName(input.firstName);
    const normalizedLast = this.normalizeName(input.lastName);
    const nameMatches = people.filter((person) =>
      this.normalizeName(person.firstName) === normalizedFirst && this.normalizeName(person.lastName) === normalizedLast,
    );
    if (nameMatches.length === 1) {
      return {
        person: nameMatches[0],
        matchBasis: "name",
        reviewNotes: ["Matched a single existing resident by first and last name."],
        requiresManualReview: false,
      };
    }
    if (nameMatches.length > 1) {
      return {
        person: null,
        matchBasis: "none",
        reviewNotes: [`Found ${nameMatches.length} existing residents with the same name; manual review is required.`],
        requiresManualReview: true,
      };
    }

    return {
      person: null,
      matchBasis: "none",
      reviewNotes: ["No existing resident match was found; approval will create a new person record."],
      requiresManualReview: false,
    };
  }

  async getAssociations(options?: { includeArchived?: boolean }): Promise<Association[]> {
    const includeArchived = options?.includeArchived ?? false;
    if (includeArchived) {
      return db.select().from(associations);
    }
    return db.select().from(associations).where(eq(associations.isArchived, 0));
  }

  async createAssociation(data: InsertAssociation, actorEmail?: string): Promise<Association> {
    const [result] = await db.insert(associations).values(data).returning();
    await this.recordAuditEvent({
      actorEmail: actorEmail || "system",
      action: "create",
      entityType: "association",
      entityId: result.id,
      associationId: result.id,
      beforeJson: null,
      afterJson: result,
    });
    return result;
  }

  async updateAssociation(id: string, data: Partial<InsertAssociation>, actorEmail?: string): Promise<Association | undefined> {
    const [before] = await db.select().from(associations).where(eq(associations.id, id));
    if (!before) return undefined;

    const nextData: Partial<InsertAssociation> = { ...data };
    if (typeof nextData.isArchived === "number" && nextData.archivedAt === undefined) {
      nextData.archivedAt = nextData.isArchived === 1 ? new Date() : null;
    }

    const [result] = await db.update(associations).set(nextData).where(eq(associations.id, id)).returning();
    if (result) {
      await this.recordAuditEvent({
        actorEmail: actorEmail || "system",
        action: "update",
        entityType: "association",
        entityId: result.id,
        associationId: result.id,
        beforeJson: before,
        afterJson: result,
      });
    }
    return result;
  }

  async deleteAssociation(id: string, actorEmail?: string): Promise<boolean> {
    const [before] = await db.select().from(associations).where(eq(associations.id, id));
    if (!before) return false;

    const unitLinks = await db.select({ id: units.id }).from(units).where(eq(units.associationId, id));
    if (unitLinks.length > 0) {
      throw new Error("Cannot delete association with linked units");
    }
    const boardRoleLinks = await db.select({ id: boardRoles.id }).from(boardRoles).where(eq(boardRoles.associationId, id));
    if (boardRoleLinks.length > 0) {
      throw new Error("Cannot delete association with linked board roles");
    }
    const documentLinks = await db.select({ id: documents.id }).from(documents).where(eq(documents.associationId, id));
    if (documentLinks.length > 0) {
      throw new Error("Cannot delete association with linked documents");
    }

    // Preserve audit history while allowing association deletion despite FK linkage.
    await db.update(auditLogs).set({ associationId: null }).where(eq(auditLogs.associationId, id));

    const [deleted] = await db.delete(associations).where(eq(associations.id, id)).returning();
    if (!deleted) return false;

    await this.recordAuditEvent({
      actorEmail: actorEmail || "system",
      action: "delete",
      entityType: "association",
      entityId: before.id,
      associationId: null,
      beforeJson: before,
      afterJson: null,
    });
    return true;
  }

  async getBuildings(associationId?: string): Promise<Building[]> {
    if (!associationId) return db.select().from(buildings);
    return db.select().from(buildings).where(eq(buildings.associationId, associationId));
  }

  async getBuildingById(id: string): Promise<Building | undefined> {
    const [result] = await db.select().from(buildings).where(eq(buildings.id, id));
    return result;
  }

  async createBuilding(data: InsertBuilding, actorEmail?: string): Promise<Building> {
    const [result] = await db.insert(buildings).values(data).returning();
    await this.recordAuditEvent({
      actorEmail: actorEmail || "system",
      action: "create",
      entityType: "building",
      entityId: result.id,
      associationId: result.associationId,
      beforeJson: null,
      afterJson: result,
    });
    return result;
  }

  async updateBuilding(id: string, data: Partial<InsertBuilding>, actorEmail?: string): Promise<Building | undefined> {
    const [existing] = await db.select().from(buildings).where(eq(buildings.id, id));
    if (!existing) return undefined;

    const [result] = await db
      .update(buildings)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(buildings.id, id))
      .returning();

    if (!result) return undefined;

    await this.recordAuditEvent({
      actorEmail: actorEmail || "system",
      action: "update",
      entityType: "building",
      entityId: result.id,
      associationId: result.associationId,
      beforeJson: existing,
      afterJson: result,
    });

    return result;
  }

  async getUnits(associationId?: string): Promise<Unit[]> {
    if (!associationId) return db.select().from(units);
    return db.select().from(units).where(eq(units.associationId, associationId));
  }

  async getUnitById(id: string): Promise<Unit | undefined> {
    const [result] = await db.select().from(units).where(eq(units.id, id));
    return result;
  }

  async createUnit(data: InsertUnit, actorEmail?: string): Promise<Unit> {
    const payload: InsertUnit = { ...data };
    if (payload.buildingId) {
      const [building] = await db.select().from(buildings).where(eq(buildings.id, payload.buildingId));
      if (!building) throw new Error("Building not found");
      if (building.associationId !== payload.associationId) {
        throw new Error("Building must belong to the same association");
      }
      if (!payload.building?.trim()) {
        payload.building = building.name;
      }
    }

    const [result] = await db.insert(units).values(payload).returning();
    await this.recordAuditEvent({
      actorEmail: actorEmail || "system",
      action: "create",
      entityType: "unit",
      entityId: result.id,
      associationId: result.associationId,
      beforeJson: null,
      afterJson: result,
    });
    return result;
  }

  async updateUnit(id: string, data: Partial<InsertUnit>, changedBy?: string): Promise<Unit | undefined> {
    const [existing] = await db.select().from(units).where(eq(units.id, id));
    if (!existing) return undefined;

    const nextAssociationId = data.associationId ?? existing.associationId;
    const nextBuildingId = data.buildingId === undefined ? existing.buildingId : data.buildingId;
    const payload: Partial<InsertUnit> = { ...data };

    if (nextBuildingId) {
      const [building] = await db.select().from(buildings).where(eq(buildings.id, nextBuildingId));
      if (!building) throw new Error("Building not found");
      if (building.associationId !== nextAssociationId) {
        throw new Error("Building must belong to the same association");
      }
      if (payload.buildingId !== undefined && payload.building === undefined) {
        payload.building = building.name;
      }
    }

    const [result] = await db.update(units).set(payload).where(eq(units.id, id)).returning();
    if (!result) return undefined;

    const trackableFields: (keyof InsertUnit)[] = ["associationId", "buildingId", "unitNumber", "building", "squareFootage"];
    for (const field of trackableFields) {
      const before = existing[field];
      const after = result[field as keyof Unit];
      const beforeValue = before === null || before === undefined ? null : String(before);
      const afterValue = after === null || after === undefined ? null : String(after);
      if (beforeValue !== afterValue) {
        await db.insert(unitChangeHistory).values({
          unitId: id,
          fieldName: field,
          oldValue: beforeValue,
          newValue: afterValue,
          changedBy: changedBy || "system",
        });
      }
    }

    await this.recordAuditEvent({
      actorEmail: changedBy || "system",
      action: "update",
      entityType: "unit",
      entityId: result.id,
      associationId: result.associationId,
      beforeJson: existing,
      afterJson: result,
    });

    return result;
  }

  async deleteUnit(id: string, actorEmail?: string): Promise<boolean> {
    const [before] = await db.select().from(units).where(eq(units.id, id));
    if (!before) return false;

    const [ownershipLink] = await db.select({ id: ownerships.id }).from(ownerships).where(eq(ownerships.unitId, id)).limit(1);
    if (ownershipLink) throw new Error("Cannot delete unit with ownership history");

    const [occupancyLink] = await db.select({ id: occupancies.id }).from(occupancies).where(eq(occupancies.unitId, id)).limit(1);
    if (occupancyLink) throw new Error("Cannot delete unit with occupancy history");

    const [deleted] = await db.delete(units).where(eq(units.id, id)).returning();
    if (!deleted) return false;

    await this.recordAuditEvent({
      actorEmail: actorEmail || "system",
      action: "delete",
      entityType: "unit",
      entityId: before.id,
      associationId: before.associationId,
      beforeJson: before,
      afterJson: null,
    });
    return true;
  }

  async getPersons(associationId?: string): Promise<Person[]> {
    if (!associationId) return db.select().from(persons);

    const associationUnits = await db
      .select({ id: units.id })
      .from(units)
      .where(eq(units.associationId, associationId));
    const unitIds = associationUnits.map((row) => row.id);

    const [ownerRows, occupancyRows, boardRows, ledgerRows] = await Promise.all([
      unitIds.length
        ? db
            .select({ personId: ownerships.personId })
            .from(ownerships)
            .where(inArray(ownerships.unitId, unitIds))
        : Promise.resolve([]),
      unitIds.length
        ? db
            .select({ personId: occupancies.personId })
            .from(occupancies)
            .where(inArray(occupancies.unitId, unitIds))
        : Promise.resolve([]),
      db
        .select({ personId: boardRoles.personId })
        .from(boardRoles)
        .where(eq(boardRoles.associationId, associationId)),
      db
        .select({ personId: ownerLedgerEntries.personId })
        .from(ownerLedgerEntries)
        .where(eq(ownerLedgerEntries.associationId, associationId)),
    ]);

    const linkedPersonIds = Array.from(
      new Set(
        [...ownerRows, ...occupancyRows, ...boardRows, ...ledgerRows]
          .map((row) => row.personId)
          .filter(Boolean),
      ),
    );

    // Also include persons directly tagged with this association (e.g. added but not yet assigned to a unit)
    const directRows = await db
      .select({ id: persons.id })
      .from(persons)
      .where(eq(persons.associationId, associationId));
    const directPersonIds = directRows.map((r) => r.id);

    const personIds = Array.from(new Set([...linkedPersonIds, ...directPersonIds]));

    if (personIds.length === 0) return [];
    return db.select().from(persons).where(inArray(persons.id, personIds));
  }

  private async syncPersonContactPoints(
    personId: string,
    associationId: string | null | undefined,
    contacts: Array<{ channel: "email" | "phone"; value: string | null | undefined; isPrimary?: boolean; source?: string; sourceRecordId?: string | null; notes?: string | null }>,
  ): Promise<void> {
    const normalizedRows = contacts.flatMap((contact) => {
      const normalizedValue = normalizePersonContactPointValue(contact.channel, contact.value);
      if (!normalizedValue) return [];
      return [{
        personId,
        associationId: associationId ?? null,
        channel: contact.channel,
        value: normalizedValue,
        normalizedValue,
        isPrimary: contact.isPrimary ? 1 : 0,
        source: contact.source ?? "manual",
        sourceRecordId: contact.sourceRecordId ?? null,
        notes: contact.notes ?? null,
      } satisfies InsertPersonContactPoint];
    });

    for (const row of dedupeBy(normalizedRows, (item) => `${item.channel}|${item.normalizedValue}`)) {
      const [existing] = await db
        .select()
        .from(personContactPoints)
        .where(and(
          eq(personContactPoints.personId, row.personId),
          eq(personContactPoints.channel, row.channel),
          eq(personContactPoints.normalizedValue, row.normalizedValue),
        ))
        .limit(1);

      if (existing) {
        await db
          .update(personContactPoints)
          .set({
            associationId: row.associationId ?? existing.associationId,
            isPrimary: row.isPrimary || existing.isPrimary,
            source: row.source || existing.source,
            sourceRecordId: row.sourceRecordId ?? existing.sourceRecordId,
            notes: row.notes ?? existing.notes,
            updatedAt: new Date(),
          })
          .where(eq(personContactPoints.id, existing.id));
        continue;
      }

      await db.insert(personContactPoints).values(row);
    }
  }

  async createPerson(data: InsertPerson, actorEmail?: string): Promise<Person> {
    const [result] = await db.insert(persons).values(data).returning();
    await this.syncPersonContactPoints(result.id, result.associationId, [
      { channel: "email", value: result.email, isPrimary: true, source: "person-record" },
      { channel: "phone", value: result.phone, isPrimary: true, source: "person-record" },
    ]);
    await this.recordAuditEvent({
      actorEmail: actorEmail || "system",
      action: "create",
      entityType: "person",
      entityId: result.id,
      associationId: null,
      beforeJson: null,
      afterJson: result,
    });
    return result;
  }

  async updatePerson(id: string, data: Partial<InsertPerson>, actorEmail?: string): Promise<Person | undefined> {
    const [before] = await db.select().from(persons).where(eq(persons.id, id));
    if (!before) return undefined;
    const [result] = await db.update(persons).set(data).where(eq(persons.id, id)).returning();
    if (result) {
      await this.syncPersonContactPoints(result.id, result.associationId, [
        { channel: "email", value: result.email, isPrimary: true, source: "person-record" },
        { channel: "phone", value: result.phone, isPrimary: true, source: "person-record" },
      ]);
      await this.recordAuditEvent({
        actorEmail: actorEmail || "system",
        action: "update",
        entityType: "person",
        entityId: result.id,
        associationId: null,
        beforeJson: before,
        afterJson: result,
      });
    }
    return result;
  }

  async deletePerson(id: string, actorEmail?: string): Promise<boolean> {
    const [before] = await db.select().from(persons).where(eq(persons.id, id));
    if (!before) return false;

    const [ownershipLink] = await db.select({ id: ownerships.id }).from(ownerships).where(eq(ownerships.personId, id)).limit(1);
    if (ownershipLink) throw new Error("Cannot delete person with ownership history");

    const [occupancyLink] = await db.select({ id: occupancies.id }).from(occupancies).where(eq(occupancies.personId, id)).limit(1);
    if (occupancyLink) throw new Error("Cannot delete person with occupancy history");

    const [boardLink] = await db.select({ id: boardRoles.id }).from(boardRoles).where(eq(boardRoles.personId, id)).limit(1);
    if (boardLink) throw new Error("Cannot delete person with board role history");

    const [deleted] = await db.delete(persons).where(eq(persons.id, id)).returning();
    if (!deleted) return false;

    await this.recordAuditEvent({
      actorEmail: actorEmail || "system",
      action: "delete",
      entityType: "person",
      entityId: before.id,
      associationId: null,
      beforeJson: before,
      afterJson: null,
    });
    return true;
  }

  async getOwnerships(associationId?: string): Promise<Ownership[]> {
    if (!associationId) return db.select().from(ownerships);
    const associationUnits = await db
      .select({ id: units.id })
      .from(units)
      .where(eq(units.associationId, associationId));
    const unitIds = associationUnits.map((row) => row.id);
    if (unitIds.length === 0) return [];
    return db.select().from(ownerships).where(inArray(ownerships.unitId, unitIds));
  }

  private async syncUnitScopedAssociationMembership(
    unitId: string,
    personId: string,
    membershipType: "owner" | "tenant",
  ): Promise<void> {
    const [unit] = await db
      .select({ associationId: units.associationId })
      .from(units)
      .where(eq(units.id, unitId))
      .limit(1);
    if (!unit) return;

    const hasActiveRelationship = membershipType === "owner"
      ? Boolean((await db
        .select({ id: ownerships.id })
        .from(ownerships)
        .where(and(
          eq(ownerships.unitId, unitId),
          eq(ownerships.personId, personId),
          isNull(ownerships.endDate),
        ))
        .limit(1))[0])
      : Boolean((await db
        .select({ id: occupancies.id })
        .from(occupancies)
        .where(and(
          eq(occupancies.unitId, unitId),
          eq(occupancies.personId, personId),
          isNull(occupancies.endDate),
        ))
        .limit(1))[0]);

    if (hasActiveRelationship) {
      await this.upsertAssociationMembership({
        associationId: unit.associationId,
        personId,
        unitId,
        membershipType,
        status: "active",
        isPrimary: 1,
      });
      return;
    }

    await db
      .update(associationMemberships)
      .set({ status: "inactive", updatedAt: new Date() })
      .where(and(
        eq(associationMemberships.associationId, unit.associationId),
        eq(associationMemberships.personId, personId),
        eq(associationMemberships.unitId, unitId),
        eq(associationMemberships.membershipType, membershipType),
      ));
  }

  async createOwnership(data: InsertOwnership, actorEmail?: string): Promise<Ownership> {
    const activeOwnershipsForUnit = await db
      .select()
      .from(ownerships)
      .where(and(eq(ownerships.unitId, data.unitId), eq(ownerships.endDate, null as any)));

    const duplicateActiveOwner = activeOwnershipsForUnit.find((row) => row.personId === data.personId);
    if (duplicateActiveOwner && !data.endDate) {
      throw new Error("Active ownership already exists for this owner and unit");
    }

    if (!data.endDate) {
      const existingPercentage = activeOwnershipsForUnit.reduce((sum, row) => sum + row.ownershipPercentage, 0);
      const incomingPercentage = data.ownershipPercentage ?? 100;
      if (existingPercentage + incomingPercentage > 100) {
        throw new Error("Active ownership percentages cannot exceed 100 for a unit");
      }
    }

    const [result] = await db.insert(ownerships).values(data).returning();
    await this.syncUnitScopedAssociationMembership(result.unitId, result.personId, "owner");
    const [unitRow] = await db.select({ associationId: units.associationId }).from(units).where(eq(units.id, result.unitId));
    await this.recordAuditEvent({
      actorEmail: actorEmail || "system",
      action: "create",
      entityType: "ownership",
      entityId: result.id,
      associationId: unitRow?.associationId || null,
      beforeJson: null,
      afterJson: result,
    });
    return result;
  }

  async updateOwnership(id: string, data: Partial<InsertOwnership>, actorEmail?: string): Promise<Ownership | undefined> {
    const [before] = await db.select().from(ownerships).where(eq(ownerships.id, id));
    if (!before) return undefined;

    const next = {
      unitId: data.unitId ?? before.unitId,
      personId: data.personId ?? before.personId,
      ownershipPercentage: data.ownershipPercentage ?? before.ownershipPercentage,
      startDate: data.startDate ?? before.startDate,
      endDate: data.endDate === undefined ? before.endDate : data.endDate,
    };

    const conflictingOwnerships = await db
      .select()
      .from(ownerships)
      .where(and(
        eq(ownerships.unitId, next.unitId),
        eq(ownerships.personId, next.personId),
        eq(ownerships.endDate, null as any),
      ));
    if (conflictingOwnerships.some((row) => row.id !== id)) {
      throw new Error("Active ownership already exists for this owner and unit");
    }

    if (next.endDate == null) {
      const activeOwnershipsForUnit = await db
        .select()
        .from(ownerships)
        .where(and(eq(ownerships.unitId, next.unitId), eq(ownerships.endDate, null as any)));
      const existingPercentage = activeOwnershipsForUnit
        .filter((row) => row.id !== id)
        .reduce((sum, row) => sum + row.ownershipPercentage, 0);
      if (existingPercentage + (next.ownershipPercentage ?? 100) > 100.0001) {
        throw new Error("Active ownership percentages cannot exceed 100 for a unit");
      }
    }

    const [result] = await db
      .update(ownerships)
      .set(data)
      .where(eq(ownerships.id, id))
      .returning();
    if (result) {
      await this.syncUnitScopedAssociationMembership(before.unitId, before.personId, "owner");
      await this.syncUnitScopedAssociationMembership(result.unitId, result.personId, "owner");
      await this.recordAuditEvent({
        actorEmail: actorEmail || "system",
        action: "update",
        entityType: "ownership",
        entityId: result.id,
        associationId: null,
        beforeJson: before,
        afterJson: result,
      });
    }
    return result;
  }

  async deleteOwnership(id: string, actorEmail?: string): Promise<boolean> {
    const [before] = await db.select().from(ownerships).where(eq(ownerships.id, id));
    if (!before) return false;

    const [deleted] = await db.delete(ownerships).where(eq(ownerships.id, id)).returning();
    if (!deleted) return false;
    await this.syncUnitScopedAssociationMembership(before.unitId, before.personId, "owner");
    const [unitRow] = await db.select({ associationId: units.associationId }).from(units).where(eq(units.id, before.unitId));

    await this.recordAuditEvent({
      actorEmail: actorEmail || "system",
      action: "delete",
      entityType: "ownership",
      entityId: before.id,
      associationId: unitRow?.associationId || null,
      beforeJson: before,
      afterJson: null,
    });
    return true;
  }

  async getOccupancies(associationId?: string): Promise<Occupancy[]> {
    if (!associationId) return db.select().from(occupancies);
    const associationUnits = await db
      .select({ id: units.id })
      .from(units)
      .where(eq(units.associationId, associationId));
    const unitIds = associationUnits.map((row) => row.id);
    if (unitIds.length === 0) return [];
    return db.select().from(occupancies).where(inArray(occupancies.unitId, unitIds));
  }

  async createOccupancy(data: InsertOccupancy, actorEmail?: string): Promise<Occupancy> {
    if (!data.endDate) {
      const currentActive = await db
        .select()
        .from(occupancies)
        .where(and(eq(occupancies.unitId, data.unitId), eq(occupancies.endDate, null as any)));

      for (const row of currentActive) {
        await db
          .update(occupancies)
          .set({ endDate: data.startDate })
          .where(eq(occupancies.id, row.id));
        await this.syncUnitScopedAssociationMembership(
          row.unitId,
          row.personId,
          row.occupancyType === "TENANT" ? "tenant" : "owner",
        );
      }
    }

    const [result] = await db.insert(occupancies).values(data).returning();
    await this.syncUnitScopedAssociationMembership(
      result.unitId,
      result.personId,
      result.occupancyType === "TENANT" ? "tenant" : "owner",
    );
    const [unitRow] = await db.select({ associationId: units.associationId }).from(units).where(eq(units.id, result.unitId));
    await this.recordAuditEvent({
      actorEmail: actorEmail || "system",
      action: "create",
      entityType: "occupancy",
      entityId: result.id,
      associationId: unitRow?.associationId || null,
      beforeJson: null,
      afterJson: result,
    });
    return result;
  }

  async deleteOccupancy(id: string, actorEmail?: string): Promise<boolean> {
    const [before] = await db.select().from(occupancies).where(eq(occupancies.id, id));
    if (!before) return false;

    const [deleted] = await db.delete(occupancies).where(eq(occupancies.id, id)).returning();
    if (!deleted) return false;
    await this.syncUnitScopedAssociationMembership(
      before.unitId,
      before.personId,
      before.occupancyType === "TENANT" ? "tenant" : "owner",
    );
    const [unitRow] = await db.select({ associationId: units.associationId }).from(units).where(eq(units.id, before.unitId));

    await this.recordAuditEvent({
      actorEmail: actorEmail || "system",
      action: "delete",
      entityType: "occupancy",
      entityId: before.id,
      associationId: unitRow?.associationId || null,
      beforeJson: before,
      afterJson: null,
    });
    return true;
  }

  async submitOnboardingIntake(input: {
    associationId: string;
    unitId: string;
    occupancyType: "OWNER_OCCUPIED" | "TENANT";
    person: {
      firstName: string;
      lastName: string;
      email?: string | null;
      phone?: string | null;
      mailingAddress?: string | null;
      emergencyContactName?: string | null;
      emergencyContactPhone?: string | null;
      contactPreference?: string | null;
    };
    startDate: Date;
    ownershipPercentage?: number | null;
  }): Promise<{
    person: Person;
    occupancy: Occupancy;
    ownership: Ownership | null;
  }> {
    const [unit] = await db.select().from(units).where(eq(units.id, input.unitId));
    if (!unit || unit.associationId !== input.associationId) {
      throw new Error("Unit not found for association");
    }
    if (!(input.person.email || "").trim() && !(input.person.phone || "").trim()) {
      throw new Error("Onboarding intake requires at least one contact method: email or phone");
    }
    if (input.occupancyType === "OWNER_OCCUPIED") {
      const ownershipPercentage = input.ownershipPercentage ?? 100;
      if (!Number.isFinite(ownershipPercentage) || ownershipPercentage <= 0 || ownershipPercentage > 100) {
        throw new Error("Owner onboarding requires an ownership percentage between 0 and 100");
      }
    }
    const person = await this.upsertOnboardingPerson({
      associationId: input.associationId,
      person: input.person,
    });

    const occupancy = await this.createOccupancy({
      unitId: input.unitId,
      personId: person.id,
      occupancyType: input.occupancyType,
      startDate: input.startDate,
      endDate: null,
    });

    let ownership: Ownership | null = null;
    if (input.occupancyType === "OWNER_OCCUPIED") {
      ownership = await this.createOwnership({
        unitId: input.unitId,
        personId: person.id,
        ownershipPercentage: input.ownershipPercentage ?? 100,
        startDate: input.startDate,
        endDate: null,
      });
    }

    return { person, occupancy, ownership };
  }

  async getOnboardingInvites(associationId: string): Promise<Array<OnboardingInvite & { unitLabel?: string; associationName?: string }>> {
    const rows = await db
      .select({
        invite: onboardingInvites,
        unitNumber: units.unitNumber,
        associationName: associations.name,
      })
      .from(onboardingInvites)
      .leftJoin(units, eq(units.id, onboardingInvites.unitId))
      .innerJoin(associations, eq(associations.id, onboardingInvites.associationId))
      .where(eq(onboardingInvites.associationId, associationId))
      .orderBy(desc(onboardingInvites.createdAt));

    return rows.map(({ invite, unitNumber, associationName }) => ({
      ...invite,
      unitLabel: unitNumber ?? undefined,
      associationName,
    }));
  }

  async createOnboardingInvite(data: InsertOnboardingInvite): Promise<OnboardingInvite & { inviteUrl: string }> {
    if (data.unitId) {
      const [unit] = await db.select().from(units).where(eq(units.id, data.unitId));
      if (!unit || unit.associationId !== data.associationId) {
        throw new Error("Unit not found for association");
      }
    }

    const token = randomBytes(24).toString("base64url");
    const expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      throw new Error("expiresAt must be a valid date");
    }

    const [invite] = await db
      .insert(onboardingInvites)
      .values({
        associationId: data.associationId,
        unitId: data.unitId,
        residentType: data.residentType,
        email: data.email ?? null,
        phone: data.phone ?? null,
        deliveryChannel: data.deliveryChannel ?? "link",
        token,
        status: "active",
        expiresAt,
        createdBy: data.createdBy ?? null,
        lastSentAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    const appBaseUrl = (process.env.APP_BASE_URL || "http://localhost:5000").replace(/\/$/, "");
    return {
      ...invite,
      inviteUrl: `${appBaseUrl}/onboarding/${encodeURIComponent(invite.token)}`,
    };
  }

  async getOrCreateUnitOnboardingLink(input: {
    associationId: string;
    unitId: string;
    residentType: "owner" | "tenant";
    createdBy?: string | null;
    expiresAt?: Date | null;
  }): Promise<OnboardingInvite & { inviteUrl: string; created: boolean }> {
    const [unit] = await db.select().from(units).where(eq(units.id, input.unitId));
    if (!unit || unit.associationId !== input.associationId) {
      throw new Error("Unit not found for association");
    }

    const invites = await db
      .select()
      .from(onboardingInvites)
      .where(and(
        eq(onboardingInvites.associationId, input.associationId),
        eq(onboardingInvites.unitId, input.unitId),
        eq(onboardingInvites.residentType, input.residentType),
        eq(onboardingInvites.deliveryChannel, "unit-link"),
      ))
      .orderBy(desc(onboardingInvites.createdAt));

    const activeInvite = invites.find((invite) => {
      if (invite.status !== "active") return false;
      if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) return false;
      return true;
    });

    const appBaseUrl = (process.env.APP_BASE_URL || "http://localhost:5000").replace(/\/$/, "");
    if (activeInvite) {
      return {
        ...activeInvite,
        inviteUrl: `${appBaseUrl}/onboarding/${encodeURIComponent(activeInvite.token)}`,
        created: false,
      };
    }

    const created = await this.createOnboardingInvite({
      associationId: input.associationId,
      unitId: input.unitId,
      residentType: input.residentType,
      email: null,
      phone: null,
      deliveryChannel: "unit-link",
      expiresAt: input.expiresAt ?? null,
      createdBy: input.createdBy ?? null,
    });

    return {
      ...created,
      created: true,
    };
  }

  async regenerateUnitOnboardingLink(input: {
    associationId: string;
    unitId: string;
    residentType: "owner" | "tenant";
    createdBy?: string | null;
    expiresAt?: Date | null;
  }): Promise<OnboardingInvite & { inviteUrl: string }> {
    const [unit] = await db.select().from(units).where(eq(units.id, input.unitId));
    if (!unit || unit.associationId !== input.associationId) {
      throw new Error("Unit not found for association");
    }

    await db
      .update(onboardingInvites)
      .set({
        status: "revoked",
        revokedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(onboardingInvites.associationId, input.associationId),
        eq(onboardingInvites.unitId, input.unitId),
        eq(onboardingInvites.residentType, input.residentType),
        eq(onboardingInvites.deliveryChannel, "unit-link"),
        eq(onboardingInvites.status, "active"),
      ));

    return this.createOnboardingInvite({
      associationId: input.associationId,
      unitId: input.unitId,
      residentType: input.residentType,
      email: null,
      phone: null,
      deliveryChannel: "unit-link",
      expiresAt: input.expiresAt ?? null,
      createdBy: input.createdBy ?? null,
    });
  }

  async getOnboardingInviteByToken(token: string): Promise<(OnboardingInvite & {
    unitLabel?: string;
    unitBuilding?: string | null;
    associationName?: string;
    associationAddress?: string | null;
    associationCity?: string | null;
    associationState?: string | null;
    associationCountry?: string | null;
  }) | undefined> {
    const [row] = await db
      .select({
        invite: onboardingInvites,
        unitNumber: units.unitNumber,
        unitBuilding: units.building,
        associationName: associations.name,
        associationAddress: associations.address,
        associationCity: associations.city,
        associationState: associations.state,
        associationCountry: associations.country,
      })
      .from(onboardingInvites)
      .leftJoin(units, eq(units.id, onboardingInvites.unitId))
      .innerJoin(associations, eq(associations.id, onboardingInvites.associationId))
      .where(eq(onboardingInvites.token, token));

    if (!row) return undefined;

    let invite = row.invite;
    if (invite.status === "active" && invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
      const [expired] = await db
        .update(onboardingInvites)
        .set({ status: "expired", updatedAt: new Date() })
        .where(eq(onboardingInvites.id, invite.id))
        .returning();
      invite = expired;
    }

    return {
      ...invite,
      unitLabel: row.unitNumber ?? undefined,
      unitBuilding: row.unitBuilding,
      associationName: row.associationName,
      associationAddress: row.associationAddress,
      associationCity: row.associationCity,
      associationState: row.associationState,
      associationCountry: row.associationCountry,
    };
  }

  async sendOnboardingInvite(
    id: string,
    sentBy?: string | null,
  ): Promise<{
    invite: OnboardingInvite;
    history: CommunicationHistory;
    delivery: { status: "sent" | "failed" | "simulated"; logId: string; provider: string; messageId: string | null; errorMessage?: string | null };
  }> {
    const [row] = await db
      .select({
        invite: onboardingInvites,
        unitNumber: units.unitNumber,
        associationName: associations.name,
      })
      .from(onboardingInvites)
      .leftJoin(units, eq(units.id, onboardingInvites.unitId))
      .innerJoin(associations, eq(associations.id, onboardingInvites.associationId))
      .where(eq(onboardingInvites.id, id));

    if (!row) throw new Error("Onboarding invite not found");
    if (!row.invite.email || !row.invite.email.trim()) {
      throw new Error("Onboarding invite email is required to send outreach");
    }

    const appBaseUrl = (process.env.APP_BASE_URL || "http://localhost:5000").replace(/\/$/, "");
    const inviteUrl = `${appBaseUrl}/onboarding/${encodeURIComponent(row.invite.token)}`;
    const subject = row.unitNumber
      ? `${row.associationName} onboarding for Unit ${row.unitNumber}`
      : `${row.associationName} owner onboarding`;
    const body = [
      `You have been invited to complete ${row.invite.residentType} onboarding for ${row.associationName}.`,
      row.unitNumber ? `Unit: ${row.unitNumber}` : null,
      "",
      `Complete your onboarding form here: ${inviteUrl}`,
      "",
      "If you were not expecting this message, contact the association administrator.",
    ].filter(Boolean).join("\n");

    const delivery = await sendPlatformEmail({
      associationId: row.invite.associationId,
      to: row.invite.email,
      subject,
      text: body,
      templateKey: "onboarding-invite",
      metadata: {
        onboardingInviteId: row.invite.id,
        residentType: row.invite.residentType,
        unitId: row.invite.unitId,
      },
      enableTracking: true,
    });

    const [invite] = await db
      .update(onboardingInvites)
      .set({
        lastSentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(onboardingInvites.id, row.invite.id))
      .returning();

    const history = await this.createCommunicationHistoryRecord({
      associationId: invite.associationId,
      channel: "email",
      direction: "outbound",
      subject,
      bodySnippet: body.slice(0, 500),
      recipientEmail: invite.email,
      recipientPersonId: null,
      relatedType: delivery.status === "sent" ? "onboarding-invite" : "onboarding-invite-failed",
      relatedId: invite.id,
      metadataJson: {
        inviteUrl,
        emailLogId: delivery.logId,
        provider: delivery.provider,
        providerMessageId: delivery.messageId,
        sentBy: sentBy ?? null,
        errorMessage: delivery.errorMessage ?? null,
      },
    });

    if (delivery.status === "sent") {
      await this.upsertEmailThread({
        associationId: invite.associationId,
        subject,
        participantsJson: [invite.email],
        source: "internal",
      });
    }

    return { invite, history, delivery };
  }

  async runOnboardingInviteReminderSweep(input: {
    associationId: string;
    sentBy?: string | null;
    olderThanHours?: number;
  }): Promise<{ processed: number; sent: number; failed: number }> {
    const olderThanHours = Number.isFinite(input.olderThanHours) ? Math.max(0, Number(input.olderThanHours)) : 24;
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    const invites = await db
      .select()
      .from(onboardingInvites)
      .where(eq(onboardingInvites.associationId, input.associationId))
      .orderBy(desc(onboardingInvites.createdAt));

    const eligible = invites.filter((invite) => {
      if (invite.status !== "active") return false;
      if (!invite.email || !invite.email.trim()) return false;
      if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) return false;
      if (!invite.lastSentAt) return true;
      return invite.lastSentAt <= cutoff;
    });

    let sent = 0;
    let failed = 0;
    for (const invite of eligible) {
      const result = await this.sendOnboardingInvite(invite.id, input.sentBy ?? null);
      if (result.delivery.status === "sent") sent += 1;
      else failed += 1;
    }

    return {
      processed: eligible.length,
      sent,
      failed,
    };
  }

  async createOnboardingSubmissionFromInvite(token: string, input: {
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
    unitId?: string | null;
    mailingAddress?: string | null;
    emergencyContactName?: string | null;
    emergencyContactPhone?: string | null;
    contactPreference?: string | null;
    startDate: Date;
    occupancyIntent?: string | null;
    ownershipPercentage?: number | null;
    additionalOwners?: Array<{
      firstName: string;
      lastName: string;
      email?: string | null;
      phone?: string | null;
      ownershipPercentage?: number | null;
    }> | null;
    tenantResidents?: Array<{
      firstName: string;
      lastName: string;
      email?: string | null;
      phone?: string | null;
    }> | null;
  }): Promise<OnboardingSubmission> {
    const invite = await this.getOnboardingInviteByToken(token);
    if (!invite) throw new Error("Onboarding invite not found");
    if (invite.status !== "active") {
      throw new Error(`Invite is ${invite.status}`);
    }
    if (Number.isNaN(input.startDate.getTime())) {
      throw new Error("startDate must be valid");
    }
    const resolvedUnitId = invite.unitId || input.unitId;
    if (!resolvedUnitId) {
      throw new Error("Unit selection is required");
    }
    if (!invite.unitId && resolvedUnitId) {
      const [unit] = await db.select().from(units).where(eq(units.id, resolvedUnitId));
      if (!unit || unit.associationId !== invite.associationId) {
        throw new Error("Selected unit not found for this association");
      }
    }
    if (!(input.email || "").trim() && !(input.phone || "").trim()) {
      throw new Error(`${invite.residentType === "owner" ? "Owner" : "Tenant"} intake requires at least an email or phone number`);
    }
    const occupancyIntent = invite.residentType === "owner"
      ? ((input.occupancyIntent || "owner-occupied").trim().toLowerCase())
      : "tenant";
    if (invite.residentType === "owner" && !["owner-occupied", "rental", "vacant"].includes(occupancyIntent)) {
      throw new Error("Owner intake occupancyIntent must be owner-occupied, rental, or vacant");
    }
    const additionalOwners = invite.residentType === "owner" ? this.normalizeAdditionalOwners(input.additionalOwners) : [];
    const tenantResidents = invite.residentType === "owner" ? this.normalizeTenantResidents(input.tenantResidents) : [];
    if (invite.residentType === "owner" && additionalOwners.length > 1) {
      throw new Error("Owner intake supports at most one additional owner");
    }
    if (invite.residentType === "owner" && occupancyIntent === "owner-occupied" && tenantResidents.length > 0) {
      throw new Error("Owner-occupied submissions cannot include tenant residents");
    }
    if (invite.residentType === "owner" && occupancyIntent === "vacant" && tenantResidents.length > 0) {
      throw new Error("Vacant submissions cannot include tenant residents");
    }
    if (invite.residentType === "owner" && occupancyIntent === "rental" && tenantResidents.length === 0) {
      throw new Error("Rental owner submissions must include at least one tenant resident");
    }
    if (invite.residentType === "owner") {
      const ownershipPercentage = input.ownershipPercentage ?? 100;
      if (!Number.isFinite(ownershipPercentage) || ownershipPercentage <= 0 || ownershipPercentage > 100) {
        throw new Error("Owner intake requires an ownership percentage between 0 and 100");
      }
    }

    const [submission] = await db
      .insert(onboardingSubmissions)
      .values({
        inviteId: invite.id,
        associationId: invite.associationId,
        unitId: resolvedUnitId,
        residentType: invite.residentType,
        sourceChannel: "unit-link",
        status: "pending",
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email ?? null,
        phone: input.phone ?? null,
        mailingAddress: input.mailingAddress ?? null,
        emergencyContactName: input.emergencyContactName ?? null,
        emergencyContactPhone: input.emergencyContactPhone ?? null,
        contactPreference: input.contactPreference ?? "email",
        occupancyIntent: invite.residentType === "owner" ? occupancyIntent : null,
        startDate: input.startDate,
        ownershipPercentage: invite.residentType === "owner" ? (input.ownershipPercentage ?? 100) : null,
        additionalOwnersJson: invite.residentType === "owner" && additionalOwners.length > 0 ? additionalOwners : null,
        tenantResidentsJson: invite.residentType === "owner" && tenantResidents.length > 0 ? tenantResidents : null,
        submittedAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    await db
      .update(onboardingInvites)
      .set({ status: "submitted", submittedAt: new Date(), updatedAt: new Date() })
      .where(eq(onboardingInvites.id, invite.id));

    return submission;
  }

  async getOnboardingSubmissions(associationId: string): Promise<Array<OnboardingSubmission & {
    unitLabel?: string;
    associationName?: string;
    inviteEmail?: string | null;
    matchedPersonId?: string | null;
    matchBasis?: "email" | "name" | "none";
    reviewNotes?: string[];
  }>> {
    const rows = await db
      .select({
        submission: onboardingSubmissions,
        unitNumber: units.unitNumber,
        associationName: associations.name,
        inviteEmail: onboardingInvites.email,
      })
      .from(onboardingSubmissions)
      .innerJoin(units, eq(units.id, onboardingSubmissions.unitId))
      .innerJoin(associations, eq(associations.id, onboardingSubmissions.associationId))
      .leftJoin(onboardingInvites, eq(onboardingInvites.id, onboardingSubmissions.inviteId))
      .where(eq(onboardingSubmissions.associationId, associationId))
      .orderBy(desc(onboardingSubmissions.submittedAt));

    return Promise.all(rows.map(async ({ submission, unitNumber, associationName, inviteEmail }) => {
      const match = await this.findMatchingOnboardingPerson({
        associationId: submission.associationId,
        firstName: submission.firstName,
        lastName: submission.lastName,
        email: submission.email ?? inviteEmail ?? null,
      });
      const submissionReviewNotes = [...match.reviewNotes];
      const additionalOwners = this.normalizeAdditionalOwners(submission.additionalOwnersJson);
      const tenantResidents = this.normalizeTenantResidents(submission.tenantResidentsJson);
      if (submission.residentType === "owner") {
        if (submission.occupancyIntent === "rental" || submission.occupancyIntent === "vacant" || submission.occupancyIntent === "owner-occupied") {
          submissionReviewNotes.push(`Occupancy intent: ${submission.occupancyIntent}.`);
        }
        if (additionalOwners.length > 0) {
          submissionReviewNotes.push(`Includes ${additionalOwners.length} additional owner record for approval.`);
        }
        if (tenantResidents.length > 0) {
          submissionReviewNotes.push(`Includes ${tenantResidents.length} tenant resident record${tenantResidents.length === 1 ? "" : "s"} for approval.`);
        }
      }
      return {
        ...submission,
        unitLabel: unitNumber,
        associationName,
        inviteEmail,
        matchedPersonId: match.person?.id ?? null,
        matchBasis: match.matchBasis,
        reviewNotes: submissionReviewNotes,
      };
    }));
  }

  async reviewOnboardingSubmission(
    id: string,
    input: { decision: "approved" | "rejected"; reviewedBy: string; rejectionReason?: string | null },
  ): Promise<OnboardingSubmission> {
    const [submission] = await db.select().from(onboardingSubmissions).where(eq(onboardingSubmissions.id, id));
    if (!submission) throw new Error("Onboarding submission not found");
    if (submission.status !== "pending") throw new Error("Only pending submissions can be reviewed");

    if (input.decision === "rejected") {
      const [rejected] = await db
        .update(onboardingSubmissions)
        .set({
          status: "rejected",
          reviewedBy: input.reviewedBy,
          reviewedAt: new Date(),
          rejectionReason: input.rejectionReason ?? null,
          updatedAt: new Date(),
        })
        .where(eq(onboardingSubmissions.id, id))
        .returning();

      if (submission.inviteId) {
        await db
          .update(onboardingInvites)
          .set({ status: "rejected", rejectedAt: new Date(), updatedAt: new Date() })
          .where(eq(onboardingInvites.id, submission.inviteId));
      }

      return rejected;
    }

    const match = await this.findMatchingOnboardingPerson({
      associationId: submission.associationId,
      firstName: submission.firstName,
      lastName: submission.lastName,
      email: submission.email ?? null,
    });
    if (match.requiresManualReview) {
      throw new Error(match.reviewNotes.join(" "));
    }

    let result: { person: Person; occupancy: Occupancy | null; ownership: Ownership | null };
    if (submission.residentType === "tenant") {
      result = await this.submitOnboardingIntake({
        associationId: submission.associationId,
        unitId: submission.unitId,
        occupancyType: "TENANT",
        person: {
          firstName: submission.firstName,
          lastName: submission.lastName,
          email: submission.email ?? null,
          phone: submission.phone ?? null,
          mailingAddress: submission.mailingAddress ?? null,
          emergencyContactName: submission.emergencyContactName ?? null,
          emergencyContactPhone: submission.emergencyContactPhone ?? null,
          contactPreference: submission.contactPreference ?? "email",
        },
        startDate: submission.startDate,
        ownershipPercentage: null,
      });

      await this.upsertAssociationMembership({
        associationId: submission.associationId,
        personId: result.person.id,
        unitId: submission.unitId,
        membershipType: "tenant",
        status: "active",
        isPrimary: 1,
      });
      await this.ensureOnboardingPortalAccess({
        associationId: submission.associationId,
        personId: result.person.id,
        unitId: submission.unitId,
        email: submission.email ?? null,
        role: "tenant",
      });
    } else {
      const occupancyIntent = (submission.occupancyIntent || "owner-occupied").trim().toLowerCase();
      const additionalOwners = this.normalizeAdditionalOwners(submission.additionalOwnersJson);
      const tenantResidents = this.normalizeTenantResidents(submission.tenantResidentsJson);

      const primaryOwner = await this.upsertOnboardingPerson({
        associationId: submission.associationId,
        person: {
          firstName: submission.firstName,
          lastName: submission.lastName,
          email: submission.email ?? null,
          phone: submission.phone ?? null,
          mailingAddress: submission.mailingAddress ?? null,
          emergencyContactName: submission.emergencyContactName ?? null,
          emergencyContactPhone: submission.emergencyContactPhone ?? null,
          contactPreference: submission.contactPreference ?? "email",
        },
      });
      const primaryOwnership = await this.createOwnership({
        unitId: submission.unitId,
        personId: primaryOwner.id,
        ownershipPercentage: submission.ownershipPercentage ?? 100,
        startDate: submission.startDate,
        endDate: null,
      });
      const primaryOccupancy = occupancyIntent === "owner-occupied"
        ? await this.createOccupancy({
          unitId: submission.unitId,
          personId: primaryOwner.id,
          occupancyType: "OWNER_OCCUPIED",
          startDate: submission.startDate,
          endDate: null,
        })
        : null;

      await this.upsertAssociationMembership({
        associationId: submission.associationId,
        personId: primaryOwner.id,
        unitId: submission.unitId,
        membershipType: "owner",
        status: "active",
        isPrimary: 1,
      });
      await this.ensureOnboardingPortalAccess({
        associationId: submission.associationId,
        personId: primaryOwner.id,
        unitId: submission.unitId,
        email: submission.email ?? null,
        role: "owner",
      });

      for (const additionalOwner of additionalOwners) {
        const ownerPerson = await this.upsertOnboardingPerson({
          associationId: submission.associationId,
          person: additionalOwner,
        });
        await this.createOwnership({
          unitId: submission.unitId,
          personId: ownerPerson.id,
          ownershipPercentage: additionalOwner.ownershipPercentage ?? 50,
          startDate: submission.startDate,
          endDate: null,
        });
        await this.upsertAssociationMembership({
          associationId: submission.associationId,
          personId: ownerPerson.id,
          unitId: submission.unitId,
          membershipType: "owner",
          status: "active",
          isPrimary: 0,
        });
        await this.ensureOnboardingPortalAccess({
          associationId: submission.associationId,
          personId: ownerPerson.id,
          unitId: submission.unitId,
          email: additionalOwner.email ?? null,
          role: "owner",
        });
      }

      for (const tenantResident of tenantResidents) {
        const tenantPerson = await this.upsertOnboardingPerson({
          associationId: submission.associationId,
          person: tenantResident,
        });
        await this.createOccupancy({
          unitId: submission.unitId,
          personId: tenantPerson.id,
          occupancyType: "TENANT",
          startDate: submission.startDate,
          endDate: null,
        });
        await this.upsertAssociationMembership({
          associationId: submission.associationId,
          personId: tenantPerson.id,
          unitId: submission.unitId,
          membershipType: "tenant",
          status: "active",
          isPrimary: 0,
        });
        await this.ensureOnboardingPortalAccess({
          associationId: submission.associationId,
          personId: tenantPerson.id,
          unitId: submission.unitId,
          email: tenantResident.email ?? null,
          role: "tenant",
        });
      }

      result = {
        person: primaryOwner,
        occupancy: primaryOccupancy,
        ownership: primaryOwnership,
      };
    }

    const [approved] = await db
      .update(onboardingSubmissions)
      .set({
        status: "approved",
        reviewedBy: input.reviewedBy,
        reviewedAt: new Date(),
        rejectionReason: null,
        createdPersonId: result.person.id,
        createdOccupancyId: result.occupancy?.id ?? null,
        createdOwnershipId: result.ownership?.id ?? null,
        updatedAt: new Date(),
      })
      .where(eq(onboardingSubmissions.id, id))
      .returning();

    if (submission.inviteId) {
      await db
        .update(onboardingInvites)
        .set({ status: "approved", approvedAt: new Date(), updatedAt: new Date() })
        .where(eq(onboardingInvites.id, submission.inviteId));
    }

    return approved;
  }

  async getResidentialDataset(associationId?: string): Promise<ResidentialDataset> {
    const [associationRows, unitRows, personRows, ownershipRows, occupancyRows] = await Promise.all([
      associationId ? db.select().from(associations).where(eq(associations.id, associationId)) : this.getAssociations(),
      this.getUnits(associationId),
      this.getPersons(associationId),
      this.getOwnerships(associationId),
      this.getOccupancies(associationId),
    ]);

    const associationById = new Map(associationRows.map((row) => [row.id, row]));
    const personById = new Map(personRows.map((row) => [row.id, row]));
    const unitById = new Map(unitRows.map((row) => [row.id, row]));
    const now = new Date();

    const ownershipsByUnitId = new Map<string, Ownership[]>();
    const activeOwnerPersonIds = new Set<string>();
    for (const ownership of ownershipRows) {
      if (!unitById.has(ownership.unitId)) continue;
      const list = ownershipsByUnitId.get(ownership.unitId) ?? [];
      list.push(ownership);
      ownershipsByUnitId.set(ownership.unitId, list);

      if (this.isDateRangeActive(ownership.startDate, ownership.endDate, now)) {
        activeOwnerPersonIds.add(ownership.personId);
      }
    }

    const occupanciesByUnitId = new Map<string, Occupancy[]>();
    for (const occupancy of occupancyRows) {
      if (!unitById.has(occupancy.unitId)) continue;
      const list = occupanciesByUnitId.get(occupancy.unitId) ?? [];
      list.push(occupancy);
      occupanciesByUnitId.set(occupancy.unitId, list);
    }

    const unitDirectory: ResidentialDataset["unitDirectory"] = unitRows.map((unit) => {
      const snapshot = this.deriveUnitOccupancySnapshot({
        ownerships: ownershipsByUnitId.get(unit.id) ?? [],
        occupancies: occupanciesByUnitId.get(unit.id) ?? [],
        personById,
        now,
      });
      return {
        unit,
        association: associationById.get(unit.associationId) ?? null,
        owners: snapshot.owners,
        activeOccupancy: snapshot.activeOccupancy,
        occupancyStatus: snapshot.occupancyStatus,
        ownerCount: snapshot.ownerCount,
        tenantCount: snapshot.tenantCount,
        occupantCount: snapshot.occupantCount,
        lastOccupancyUpdate: snapshot.lastOccupancyUpdate,
      };
    });

    const ownedUnitsByPerson = new Map<string, Set<string>>();
    for (const ownership of ownershipRows) {
      if (!unitById.has(ownership.unitId)) continue;
      const set = ownedUnitsByPerson.get(ownership.personId) ?? new Set<string>();
      set.add(ownership.unitId);
      ownedUnitsByPerson.set(ownership.personId, set);
    }

    const occupiedUnitsByPerson = new Map<string, Set<string>>();
    for (const occupancy of occupancyRows) {
      if (!unitById.has(occupancy.unitId)) continue;
      const isActive = this.isDateRangeActive(occupancy.startDate, occupancy.endDate, now);
      if (!isActive) continue;
      const set = occupiedUnitsByPerson.get(occupancy.personId) ?? new Set<string>();
      set.add(occupancy.unitId);
      occupiedUnitsByPerson.set(occupancy.personId, set);
    }

    const personDirectory: ResidentialDataset["personDirectory"] = personRows.map((person) => {
      const ownedUnitIds = Array.from(ownedUnitsByPerson.get(person.id) ?? new Set<string>());
      const occupiedUnitIds = Array.from(occupiedUnitsByPerson.get(person.id) ?? new Set<string>());
      const isOwner = ownedUnitIds.length > 0;
      const isOccupant = occupiedUnitIds.length > 0;
      const isOwnerOccupant = isOwner && isOccupant;
      const isTenant = isOccupant && occupiedUnitIds.some((unitId) => !ownedUnitIds.includes(unitId));

      return {
        person,
        ownedUnitIds,
        occupiedUnitIds,
        isOwner,
        isOccupant,
        isTenant,
        isOwnerOccupant,
      };
    });

    const activeOccupancies = occupancyRows.filter((row) => this.isDateRangeActive(row.startDate, row.endDate, now));
    const ownerOccupiedUnits = unitDirectory.filter((row) => row.occupancyStatus === "OWNER_OCCUPIED").length;
    const rentalOccupiedUnits = unitDirectory.filter((row) => row.occupancyStatus === "RENTAL_OCCUPIED").length;
    const vacantUnits = unitDirectory.filter((row) => row.occupancyStatus === "VACANT").length;
    const unassignedUnits = unitDirectory.filter((row) => row.occupancyStatus === "UNASSIGNED").length;
    const occupancyRatePercent = unitRows.length > 0 ? Math.round(((ownerOccupiedUnits + rentalOccupiedUnits) / unitRows.length) * 100) : 0;

    return {
      associations: associationRows,
      units: unitRows,
      persons: personRows,
      ownerships: ownershipRows,
      occupancies: occupancyRows,
      unitDirectory,
      personDirectory,
      summary: {
        associations: associationRows.length,
        units: unitRows.length,
        persons: personRows.length,
        activeOwners: activeOwnerPersonIds.size,
        activeOccupancies: activeOccupancies.length,
        activeTenancies: activeOccupancies.filter((row) => row.occupancyType === "TENANT").length,
        ownerOccupiedUnits,
        rentalOccupiedUnits,
        vacantUnits,
        unassignedUnits,
        occupancyRatePercent,
      },
    };
  }

  async getAssociationOnboardingState(associationId: string): Promise<{
    associationId: string;
    state: "not-started" | "in-progress" | "blocked" | "complete";
    blockers: string[];
    remediationActions: string[];
    remediationItems: Array<{ label: string; href: string; summary: string }>;
    scorePercent: number;
    components: {
      unitsConfigured: { score: number; total: number; completed: number };
      ownerDataCollected: { score: number; total: number; completed: number };
      tenantDataCollected: { score: number; total: number; completed: number };
      boardMembersConfigured: { score: number; total: number; completed: number };
      paymentMethodsConfigured: { score: number; total: number; completed: number };
      communicationTemplatesConfigured: { score: number; total: number; completed: number };
    };
  }> {
    const completeness = await this.getAssociationOnboardingCompleteness(associationId);
    const readiness = await this.getAssociationContactReadiness(associationId);

    const blockers = [...readiness.blockingReasons];
    const remediationItems: Array<{ label: string; href: string; summary: string }> = [];
    const pushRemediation = (label: string, href: string, summary: string) => {
      if (!remediationItems.some((item) => item.label === label && item.href === href)) {
        remediationItems.push({ label, href, summary });
      }
    };

    if (completeness.components.unitsConfigured.completed === 0) {
      pushRemediation("Create Units", "/app/units", "No units are configured for this association.");
    }
    if (completeness.components.ownerDataCollected.total > completeness.components.ownerDataCollected.completed) {
      pushRemediation(
        "Send Owner Form Links",
        "/app/association-context",
        `${completeness.components.ownerDataCollected.total - completeness.components.ownerDataCollected.completed} units are missing owner information.`,
      );
    }
    if (completeness.components.tenantDataCollected.total > completeness.components.tenantDataCollected.completed) {
      pushRemediation(
        "Collect Tenant Data",
        "/app/association-context",
        `${completeness.components.tenantDataCollected.total - completeness.components.tenantDataCollected.completed} units do not have tenant records yet.`,
      );
    }
    if (completeness.components.boardMembersConfigured.completed === 0) {
      pushRemediation("Configure Board Members", "/app/board", "No active board assignments are configured.");
    }
    if (completeness.components.paymentMethodsConfigured.completed === 0) {
      pushRemediation("Configure Payments", "/app/financial-ledger", "No active payment methods are configured.");
    }
    if (completeness.components.communicationTemplatesConfigured.completed === 0) {
      pushRemediation("Configure Communications", "/app/communications", "No communication templates are configured for the association.");
    }
    if (readiness.contactCoveragePercent < 70) {
      pushRemediation("Resolve Missing Contact Data", "/app/association-context", `Contact coverage is ${readiness.contactCoveragePercent}%, below the 70% threshold.`);
    }

    const remediationActions = remediationItems.map((item) => `${item.label}: ${item.summary}`);

    let state: "not-started" | "in-progress" | "blocked" | "complete" = "in-progress";
    if (completeness.scorePercent === 0) state = "not-started";
    if (blockers.length > 0 && completeness.scorePercent > 0) state = "blocked";
    if (completeness.scorePercent >= 95 && blockers.length === 0) state = "complete";

    return {
      associationId,
      state,
      blockers,
      remediationActions,
      remediationItems,
      scorePercent: completeness.scorePercent,
      components: completeness.components,
    };
  }

  // [4.4 Q2 AC 1-5] Four-item signup onboarding checklist used by the Home
  // banner. Aggregates state across ALL associations scoped to the admin
  // user; each item is complete when ANY scoped association satisfies it
  // (a single workspace-level checklist, not per-association). Platform-
  // admins fall back to "all associations" since they are not required to
  // carry admin_association_scopes rows.
  async getSignupOnboardingChecklist(adminUserId: string): Promise<{
    associationDetailsComplete: boolean;
    boardOfficerInvited: boolean;
    unitsAdded: boolean;
    firstDocumentUploaded: boolean;
    dismissed: boolean;
    dismissedAt: string | null;
  }> {
    const [adminUser] = await db.select().from(adminUsers).where(eq(adminUsers.id, adminUserId));
    if (!adminUser) {
      return {
        associationDetailsComplete: false,
        boardOfficerInvited: false,
        unitsAdded: false,
        firstDocumentUploaded: false,
        dismissed: false,
        dismissedAt: null,
      };
    }

    // Resolve the association set the admin user can see.
    // Platform-admin → all associations; everyone else → admin_association_scopes rows.
    let associationIds: string[] = [];
    if (adminUser.role === "platform-admin") {
      const all = await db.select({ id: associations.id }).from(associations).where(eq(associations.isArchived, 0));
      associationIds = all.map((row) => row.id);
    } else {
      const scopes = await db
        .select({ associationId: adminAssociationScopes.associationId })
        .from(adminAssociationScopes)
        .where(eq(adminAssociationScopes.adminUserId, adminUserId));
      associationIds = Array.from(new Set(scopes.map((row) => row.associationId)));
    }

    const dismissedAt = adminUser.onboardingDismissedAt;

    if (associationIds.length === 0) {
      return {
        associationDetailsComplete: false,
        boardOfficerInvited: false,
        unitsAdded: false,
        firstDocumentUploaded: false,
        dismissed: Boolean(dismissedAt),
        dismissedAt: dismissedAt ? dismissedAt.toISOString() : null,
      };
    }

    // Item 1 — association details: complete if ANY scoped association has
    // a non-"TBD" address/city/state (matches the signup stub sentinel at
    // server/routes.ts :: /api/public/signup/start).
    const assocRows = await db
      .select({ address: associations.address, city: associations.city, state: associations.state })
      .from(associations)
      .where(inArray(associations.id, associationIds));
    const associationDetailsComplete = assocRows.some(
      (row) => row.address !== "TBD" && row.city !== "TBD" && row.state !== "TBD",
    );

    // Item 2 — board officer invited. Two signals (OR):
    //   (a) a board_roles row exists for one of the scoped associations
    //   (the existing "add board member" workflow writes here), OR
    //   (b) an admin_users row with role=board-officer is scoped to one of
    //   the associations (admin-level invite).
    const boardRoleRows = await db
      .select({ id: boardRoles.id })
      .from(boardRoles)
      .where(inArray(boardRoles.associationId, associationIds))
      .limit(1);
    let boardOfficerInvited = boardRoleRows.length > 0;
    if (!boardOfficerInvited) {
      const officerScopes = await db
        .select({ adminUserId: adminAssociationScopes.adminUserId })
        .from(adminAssociationScopes)
        .innerJoin(adminUsers, eq(adminUsers.id, adminAssociationScopes.adminUserId))
        .where(
          and(
            inArray(adminAssociationScopes.associationId, associationIds),
            eq(adminUsers.role, "board-officer"),
          ),
        )
        .limit(1);
      boardOfficerInvited = officerScopes.length > 0;
    }

    // Item 3 — units added.
    const unitRows = await db
      .select({ id: units.id })
      .from(units)
      .where(inArray(units.associationId, associationIds))
      .limit(1);
    const unitsAdded = unitRows.length > 0;

    // Item 4 — first governing document uploaded.
    const docRows = await db
      .select({ id: documents.id })
      .from(documents)
      .where(inArray(documents.associationId, associationIds))
      .limit(1);
    const firstDocumentUploaded = docRows.length > 0;

    return {
      associationDetailsComplete,
      boardOfficerInvited,
      unitsAdded,
      firstDocumentUploaded,
      dismissed: Boolean(dismissedAt),
      dismissedAt: dismissedAt ? dismissedAt.toISOString() : null,
    };
  }

  async dismissSignupOnboardingBanner(adminUserId: string): Promise<void> {
    await db
      .update(adminUsers)
      .set({ onboardingDismissedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(adminUsers.id, adminUserId), isNull(adminUsers.onboardingDismissedAt)));
  }

  async getAssociationOverview(associationId: string): Promise<{
    associationId: string;
    units: number;
    activeOwners: number;
    activeOccupants: number;
    ownerOccupiedUnits: number;
    rentalOccupiedUnits: number;
    vacantUnits: number;
    unassignedUnits: number;
    occupancyRatePercent: number;
    maintenanceOpen: number;
    maintenanceOverdue: number;
    paymentMethodsActive: number;
    onboardingState: "not-started" | "in-progress" | "blocked" | "complete";
    onboardingScorePercent: number;
    contactCoveragePercent: number;
  }> {
    const [maintenanceRows, paymentMethods, onboardingState, readiness, residentialDataset] = await Promise.all([
      this.getMaintenanceRequests({ associationId }),
      this.getPaymentMethodConfigs(associationId),
      this.getAssociationOnboardingState(associationId),
      this.getAssociationContactReadiness(associationId),
      this.getResidentialDataset(associationId),
    ]);

    const now = new Date();
    const maintenanceOpenRows = maintenanceRows.filter((row) => row.status !== "resolved" && row.status !== "closed" && row.status !== "rejected");
    const maintenanceOverdue = maintenanceOpenRows.filter((row) => row.responseDueAt && row.responseDueAt < now).length;

    return {
      associationId,
      units: residentialDataset.summary.units,
      activeOwners: residentialDataset.summary.activeOwners,
      activeOccupants: residentialDataset.summary.activeOccupancies,
      ownerOccupiedUnits: residentialDataset.summary.ownerOccupiedUnits,
      rentalOccupiedUnits: residentialDataset.summary.rentalOccupiedUnits,
      vacantUnits: residentialDataset.summary.vacantUnits,
      unassignedUnits: residentialDataset.summary.unassignedUnits,
      occupancyRatePercent: residentialDataset.summary.occupancyRatePercent,
      maintenanceOpen: maintenanceOpenRows.length,
      maintenanceOverdue,
      paymentMethodsActive: paymentMethods.filter((row) => row.isActive === 1).length,
      onboardingState: onboardingState.state,
      onboardingScorePercent: onboardingState.scorePercent,
      contactCoveragePercent: readiness.contactCoveragePercent,
    };
  }

  async getBoardRoles(associationId?: string): Promise<BoardRole[]> {
    if (!associationId) return db.select().from(boardRoles);
    return db.select().from(boardRoles).where(eq(boardRoles.associationId, associationId));
  }

  async createBoardRole(data: InsertBoardRole, actorEmail?: string): Promise<BoardRole> {
    if (!data.endDate) {
      const conflictingActiveRole = await db
        .select()
        .from(boardRoles)
        .where(
          and(
            eq(boardRoles.personId, data.personId),
            eq(boardRoles.associationId, data.associationId),
            eq(boardRoles.role, data.role),
            eq(boardRoles.endDate, null as any),
          ),
        );

      if (conflictingActiveRole.length > 0) {
        throw new Error("This person already has an active assignment for this role");
      }
    }

    const [result] = await db.insert(boardRoles).values(data).returning();
    await this.recordAuditEvent({
      actorEmail: actorEmail || "system",
      action: "create",
      entityType: "board-role",
      entityId: result.id,
      associationId: result.associationId,
      beforeJson: null,
      afterJson: result,
    });
    return result;
  }

  async deleteBoardRole(id: string, actorEmail?: string): Promise<boolean> {
    const [before] = await db.select().from(boardRoles).where(eq(boardRoles.id, id));
    if (!before) return false;
    const [deleted] = await db.delete(boardRoles).where(eq(boardRoles.id, id)).returning();
    if (!deleted) return false;

    await this.recordAuditEvent({
      actorEmail: actorEmail || "system",
      action: "delete",
      entityType: "board-role",
      entityId: before.id,
      associationId: before.associationId,
      beforeJson: before,
      afterJson: null,
    });
    return true;
  }

  async getDocuments(associationId?: string): Promise<Document[]> {
    if (!associationId) return db.select().from(documents);
    return db.select().from(documents).where(eq(documents.associationId, associationId));
  }

  async getVendorDocuments(vendorId: string): Promise<Document[]> {
    return db
      .select({
        id: documents.id,
        associationId: documents.associationId,
        title: documents.title,
        fileUrl: documents.fileUrl,
        documentType: documents.documentType,
        isPortalVisible: documents.isPortalVisible,
        portalAudience: documents.portalAudience,
        priorVersionsPortalVisible: documents.priorVersionsPortalVisible,
        uploadedBy: documents.uploadedBy,
        parentDocumentId: documents.parentDocumentId,
        versionNumber: documents.versionNumber,
        isCurrentVersion: documents.isCurrentVersion,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .innerJoin(documentTags, eq(documentTags.documentId, documents.id))
      .where(and(eq(documentTags.entityType, "vendor"), eq(documentTags.entityId, vendorId)))
      .orderBy(desc(documents.createdAt));
  }

  async createDocument(data: InsertDocument, actorEmail?: string): Promise<Document> {
    const [result] = await db.insert(documents).values(data).returning();
    await db.insert(documentVersions).values({
      documentId: result.id,
      versionNumber: result.versionNumber ?? 1,
      title: result.title,
      fileUrl: result.fileUrl,
      uploadedBy: result.uploadedBy,
      isCurrent: 1,
    });
    await this.recordAuditEvent({
      actorEmail: actorEmail || "system",
      action: "create",
      entityType: "document",
      entityId: result.id,
      associationId: result.associationId,
      beforeJson: null,
      afterJson: result,
    });
    return result;
  }

  async createVendorDocument(vendorId: string, data: InsertDocument, actorEmail?: string): Promise<Document> {
    const [vendor] = await db.select().from(vendors).where(eq(vendors.id, vendorId));
    if (!vendor) {
      throw new Error("Vendor not found");
    }
    if (vendor.associationId !== data.associationId) {
      throw new Error("Vendor does not belong to the selected association");
    }

    const result = await this.createDocument(data, actorEmail);
    await this.createDocumentTag(
      {
        documentId: result.id,
        entityType: "vendor",
        entityId: vendor.id,
      },
      actorEmail,
    );
    return result;
  }

  async updateDocument(id: string, data: Partial<InsertDocument>, actorEmail?: string): Promise<Document | undefined> {
    const [before] = await db.select().from(documents).where(eq(documents.id, id));
    if (!before) return undefined;
    const [result] = await db
      .update(documents)
      .set(data)
      .where(eq(documents.id, id))
      .returning();
    await this.recordAuditEvent({
      actorEmail: actorEmail || "system",
      action: "update",
      entityType: "document",
      entityId: result.id,
      associationId: result.associationId,
      beforeJson: before,
      afterJson: result,
    });
    return result;
  }

  async deleteDocument(id: string, actorEmail?: string): Promise<boolean> {
    const [before] = await db.select().from(documents).where(eq(documents.id, id));
    if (!before) return false;

    await db.delete(documentTags).where(eq(documentTags.documentId, id));
    await db.delete(documentVersions).where(eq(documentVersions.documentId, id));
    const [deleted] = await db.delete(documents).where(eq(documents.id, id)).returning();
    if (!deleted) return false;

    await this.recordAuditEvent({
      actorEmail: actorEmail || "system",
      action: "delete",
      entityType: "document",
      entityId: before.id,
      associationId: before.associationId,
      beforeJson: before,
      afterJson: null,
    });
    return true;
  }

  async getHoaFeeSchedules(associationId?: string): Promise<HoaFeeSchedule[]> {
    if (!associationId) return db.select().from(hoaFeeSchedules).orderBy(desc(hoaFeeSchedules.createdAt));
    return db
      .select()
      .from(hoaFeeSchedules)
      .where(eq(hoaFeeSchedules.associationId, associationId))
      .orderBy(desc(hoaFeeSchedules.createdAt));
  }

  async createHoaFeeSchedule(data: InsertHoaFeeSchedule): Promise<HoaFeeSchedule> {
    const [result] = await db
      .insert(hoaFeeSchedules)
      .values({ ...data, updatedAt: new Date() })
      .returning();
    return result;
  }

  async updateHoaFeeSchedule(id: string, data: Partial<InsertHoaFeeSchedule>): Promise<HoaFeeSchedule | undefined> {
    const [result] = await db
      .update(hoaFeeSchedules)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(hoaFeeSchedules.id, id))
      .returning();
    return result;
  }

  async getSpecialAssessments(associationId?: string): Promise<SpecialAssessment[]> {
    if (!associationId) return db.select().from(specialAssessments).orderBy(desc(specialAssessments.createdAt));
    return db
      .select()
      .from(specialAssessments)
      .where(eq(specialAssessments.associationId, associationId))
      .orderBy(desc(specialAssessments.createdAt));
  }

  async createSpecialAssessment(data: InsertSpecialAssessment): Promise<SpecialAssessment> {
    const [result] = await db
      .insert(specialAssessments)
      .values({ ...data, updatedAt: new Date() })
      .returning();
    return result;
  }

  async updateSpecialAssessment(id: string, data: Partial<InsertSpecialAssessment>): Promise<SpecialAssessment | undefined> {
    const [result] = await db
      .update(specialAssessments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(specialAssessments.id, id))
      .returning();
    return result;
  }

  async getLateFeeRules(associationId?: string): Promise<LateFeeRule[]> {
    if (!associationId) return db.select().from(lateFeeRules).orderBy(desc(lateFeeRules.createdAt));
    return db
      .select()
      .from(lateFeeRules)
      .where(eq(lateFeeRules.associationId, associationId))
      .orderBy(desc(lateFeeRules.createdAt));
  }

  async createLateFeeRule(data: InsertLateFeeRule): Promise<LateFeeRule> {
    const [result] = await db.insert(lateFeeRules).values({ ...data, updatedAt: new Date() }).returning();
    return result;
  }

  async updateLateFeeRule(id: string, data: Partial<InsertLateFeeRule>): Promise<LateFeeRule | undefined> {
    const [result] = await db
      .update(lateFeeRules)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(lateFeeRules.id, id))
      .returning();
    return result;
  }

  async getLateFeeEvents(associationId?: string): Promise<LateFeeEvent[]> {
    if (!associationId) {
      return db.select().from(lateFeeEvents).orderBy(desc(lateFeeEvents.createdAt));
    }
    return db
      .select()
      .from(lateFeeEvents)
      .where(eq(lateFeeEvents.associationId, associationId))
      .orderBy(desc(lateFeeEvents.createdAt));
  }

  async calculateLateFee(input: {
    associationId: string;
    ruleId: string;
    balanceAmount: number;
    dueDate: Date;
    asOfDate: Date;
    referenceType?: string | null;
    referenceId?: string | null;
    apply?: boolean;
  }): Promise<{ calculatedFee: number; daysLate: number; appliedEventId: string | null }> {
    const [rule] = await db.select().from(lateFeeRules).where(eq(lateFeeRules.id, input.ruleId));
    if (!rule) {
      throw new Error("Late fee rule not found");
    }
    if (rule.associationId !== input.associationId) {
      throw new Error("Rule does not belong to the provided association");
    }

    const msPerDay = 1000 * 60 * 60 * 24;
    const rawDaysLate = Math.floor((input.asOfDate.getTime() - input.dueDate.getTime()) / msPerDay);
    const daysLate = Math.max(0, rawDaysLate);

    if (daysLate <= rule.graceDays || input.balanceAmount <= 0) {
      return { calculatedFee: 0, daysLate, appliedEventId: null };
    }

    let calculatedFee =
      rule.feeType === "flat"
        ? rule.feeAmount
        : Number(((input.balanceAmount * rule.feeAmount) / 100).toFixed(2));

    if (rule.maxFee !== null && rule.maxFee !== undefined) {
      calculatedFee = Math.min(calculatedFee, rule.maxFee);
    }
    if (calculatedFee < 0) calculatedFee = 0;

    let appliedEventId: string | null = null;
    if (input.apply) {
      const [event] = await db
        .insert(lateFeeEvents)
        .values({
          associationId: input.associationId,
          ruleId: input.ruleId,
          referenceType: input.referenceType ?? null,
          referenceId: input.referenceId ?? null,
          balanceAmount: input.balanceAmount,
          dueDate: input.dueDate,
          asOfDate: input.asOfDate,
          calculatedFee,
        })
        .returning();
      appliedEventId = event.id;
    }

    return { calculatedFee, daysLate, appliedEventId };
  }

  async getFinancialAccounts(associationId?: string): Promise<FinancialAccount[]> {
    if (!associationId) return db.select().from(financialAccounts).orderBy(desc(financialAccounts.createdAt));
    return db
      .select()
      .from(financialAccounts)
      .where(eq(financialAccounts.associationId, associationId))
      .orderBy(desc(financialAccounts.createdAt));
  }

  async createFinancialAccount(data: InsertFinancialAccount): Promise<FinancialAccount> {
    const [result] = await db
      .insert(financialAccounts)
      .values({ ...data, updatedAt: new Date() })
      .returning();
    return result;
  }

  async updateFinancialAccount(id: string, data: Partial<InsertFinancialAccount>): Promise<FinancialAccount | undefined> {
    const [result] = await db
      .update(financialAccounts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(financialAccounts.id, id))
      .returning();
    return result;
  }

  async getFinancialCategories(associationId?: string): Promise<FinancialCategory[]> {
    if (!associationId) return db.select().from(financialCategories).orderBy(desc(financialCategories.createdAt));
    return db
      .select()
      .from(financialCategories)
      .where(eq(financialCategories.associationId, associationId))
      .orderBy(desc(financialCategories.createdAt));
  }

  async createFinancialCategory(data: InsertFinancialCategory): Promise<FinancialCategory> {
    const [result] = await db
      .insert(financialCategories)
      .values({ ...data, updatedAt: new Date() })
      .returning();
    return result;
  }

  async updateFinancialCategory(id: string, data: Partial<InsertFinancialCategory>): Promise<FinancialCategory | undefined> {
    const [result] = await db
      .update(financialCategories)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(financialCategories.id, id))
      .returning();
    return result;
  }

  async getBudgets(associationId?: string): Promise<Budget[]> {
    if (!associationId) return db.select().from(budgets).orderBy(desc(budgets.createdAt));
    return db
      .select()
      .from(budgets)
      .where(eq(budgets.associationId, associationId))
      .orderBy(desc(budgets.createdAt));
  }

  async createBudget(data: InsertBudget): Promise<Budget> {
    const [result] = await db
      .insert(budgets)
      .values({ ...data, updatedAt: new Date() })
      .returning();
    return result;
  }

  async updateBudget(id: string, data: Partial<InsertBudget>): Promise<Budget | undefined> {
    const [result] = await db
      .update(budgets)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(budgets.id, id))
      .returning();
    return result;
  }

  async getBudgetVersions(budgetId: string): Promise<BudgetVersion[]> {
    return db
      .select()
      .from(budgetVersions)
      .where(eq(budgetVersions.budgetId, budgetId))
      .orderBy(desc(budgetVersions.versionNumber));
  }

  async createBudgetVersion(data: InsertBudgetVersion): Promise<BudgetVersion> {
    const [budget] = await db.select().from(budgets).where(eq(budgets.id, data.budgetId));
    if (!budget) throw new Error("Budget not found");

    if (data.status === "ratified") {
      const [existingRatified] = await db
        .select()
        .from(budgetVersions)
        .where(and(eq(budgetVersions.budgetId, data.budgetId), eq(budgetVersions.status, "ratified")))
        .limit(1);
      if (existingRatified) throw new Error("Budget already has a ratified version");
    }

    const [result] = await db
      .insert(budgetVersions)
      .values({
        ...data,
        ratifiedAt: data.status === "ratified" ? new Date() : null,
        updatedAt: new Date(),
      })
      .returning();
    return result;
  }

  async updateBudgetVersion(id: string, data: Partial<InsertBudgetVersion>): Promise<BudgetVersion | undefined> {
    const [existing] = await db.select().from(budgetVersions).where(eq(budgetVersions.id, id));
    if (!existing) return undefined;

    const nextStatus = data.status ?? existing.status;
    if (nextStatus === "ratified" && existing.status !== "ratified") {
      const [conflict] = await db
        .select()
        .from(budgetVersions)
        .where(and(eq(budgetVersions.budgetId, existing.budgetId), eq(budgetVersions.status, "ratified")))
        .limit(1);
      if (conflict && conflict.id !== existing.id) throw new Error("Budget already has a ratified version");
    }

    const patch: Partial<InsertBudgetVersion> & { updatedAt: Date; ratifiedAt?: Date | null } = {
      ...data,
      updatedAt: new Date(),
    };
    if ("status" in data) {
      patch.ratifiedAt = data.status === "ratified" ? new Date() : null;
    }

    const [result] = await db
      .update(budgetVersions)
      .set(patch as any)
      .where(eq(budgetVersions.id, id))
      .returning();
    return result;
  }

  async getBudgetLines(budgetVersionId: string): Promise<BudgetLine[]> {
    return db
      .select()
      .from(budgetLines)
      .where(eq(budgetLines.budgetVersionId, budgetVersionId))
      .orderBy(budgetLines.sortOrder);
  }

  async createBudgetLine(data: InsertBudgetLine): Promise<BudgetLine> {
    const [result] = await db
      .insert(budgetLines)
      .values({ ...data, updatedAt: new Date() })
      .returning();
    return result;
  }

  async updateBudgetLine(id: string, data: Partial<InsertBudgetLine>): Promise<BudgetLine | undefined> {
    const [result] = await db
      .update(budgetLines)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(budgetLines.id, id))
      .returning();
    return result;
  }

  async getBudgetVariance(associationId: string, budgetVersionId: string): Promise<Array<{
    budgetLineId: string;
    lineItemName: string;
    plannedAmount: number;
    actualAmount: number;
    varianceAmount: number;
    accountId: string | null;
    categoryId: string | null;
  }>> {
    const [version] = await db.select().from(budgetVersions).where(eq(budgetVersions.id, budgetVersionId));
    if (!version) throw new Error("Budget version not found");

    const [budget] = await db.select().from(budgets).where(eq(budgets.id, version.budgetId));
    if (!budget) throw new Error("Budget not found");
    if (budget.associationId !== associationId) throw new Error("Budget does not belong to association");

    const lines = await this.getBudgetLines(budgetVersionId);
    const invoices = await db
      .select()
      .from(vendorInvoices)
      .where(and(eq(vendorInvoices.associationId, associationId), gte(vendorInvoices.invoiceDate, budget.periodStart)));
    const utilities = await db
      .select()
      .from(utilityPayments)
      .where(and(eq(utilityPayments.associationId, associationId), gte(utilityPayments.createdAt, budget.periodStart)));

    const varianceRows = lines.map((line) => {
      const invoiceActual = invoices
        .filter((inv) => (line.accountId ? inv.accountId === line.accountId : true) && (line.categoryId ? inv.categoryId === line.categoryId : true))
        .reduce((sum, inv) => sum + inv.amount, 0);
      const utilityActual = utilities
        .filter((util) => (line.accountId ? util.accountId === line.accountId : true) && (line.categoryId ? util.categoryId === line.categoryId : true))
        .reduce((sum, util) => sum + util.amount, 0);
      const actualAmount = invoiceActual + utilityActual;
      const varianceAmount = line.plannedAmount - actualAmount;
      return {
        budgetLineId: line.id,
        lineItemName: line.lineItemName,
        plannedAmount: line.plannedAmount,
        actualAmount,
        varianceAmount,
        accountId: line.accountId ?? null,
        categoryId: line.categoryId ?? null,
      };
    });

    return varianceRows;
  }

  async getVendorInvoices(associationId?: string): Promise<VendorInvoice[]> {
    if (!associationId) return db.select().from(vendorInvoices).orderBy(desc(vendorInvoices.createdAt));
    return db
      .select()
      .from(vendorInvoices)
      .where(eq(vendorInvoices.associationId, associationId))
      .orderBy(desc(vendorInvoices.createdAt));
  }

  async getVendors(associationId?: string): Promise<Vendor[]> {
    if (!associationId) return db.select().from(vendors).orderBy(desc(vendors.updatedAt), desc(vendors.createdAt));
    return db
      .select()
      .from(vendors)
      .where(eq(vendors.associationId, associationId))
      .orderBy(desc(vendors.updatedAt), desc(vendors.createdAt));
  }

  async getVendorRenewalAlerts(associationId?: string): Promise<Array<{ vendorId: string; vendorName: string; associationId: string; daysUntilExpiry: number; severity: "expired" | "due-soon"; insuranceExpiresAt: Date }>> {
    const rows = await this.getVendors(associationId);
    const now = new Date();
    const alerts = rows
      .filter((vendor) => Boolean(vendor.insuranceExpiresAt) && vendor.status !== "inactive")
      .map((vendor) => {
        const insuranceExpiresAt = new Date(vendor.insuranceExpiresAt as Date);
        const daysUntilExpiry = Math.floor((insuranceExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return {
          vendorId: vendor.id,
          vendorName: vendor.name,
          associationId: vendor.associationId,
          daysUntilExpiry,
          severity: daysUntilExpiry < 0 ? "expired" as const : "due-soon" as const,
          insuranceExpiresAt,
        };
      })
      .filter((item) => item.daysUntilExpiry <= 30)
      .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

    return alerts;
  }

  private deriveVendorStatus(
    status: InsertVendor["status"] | undefined,
    insuranceExpiresAt: Date | null | undefined,
  ): "active" | "inactive" | "pending-renewal" {
    if (status === "inactive") return "inactive" as const;
    if (insuranceExpiresAt) {
      const daysUntilExpiry = Math.floor((insuranceExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysUntilExpiry <= 30) return "pending-renewal" as const;
    }
    return status === "pending-renewal" ? "pending-renewal" : "active";
  }

  async createVendor(data: InsertVendor): Promise<Vendor> {
    const insuranceExpiresAt = data.insuranceExpiresAt ? new Date(data.insuranceExpiresAt) : null;
    const status = this.deriveVendorStatus(data.status, insuranceExpiresAt);
    const [result] = await db
      .insert(vendors)
      .values({ ...data, insuranceExpiresAt, status, updatedAt: new Date() })
      .returning();
    return result;
  }

  async updateVendor(id: string, data: Partial<InsertVendor>): Promise<Vendor | undefined> {
    const [before] = await db.select().from(vendors).where(eq(vendors.id, id));
    if (!before) return undefined;
    const insuranceExpiresAt = data.insuranceExpiresAt === undefined
      ? before.insuranceExpiresAt
      : (data.insuranceExpiresAt ? new Date(data.insuranceExpiresAt) : null);
    const status = this.deriveVendorStatus(data.status ?? before.status, insuranceExpiresAt);
    const [result] = await db
      .update(vendors)
      .set({ ...data, insuranceExpiresAt, status, updatedAt: new Date() })
      .where(eq(vendors.id, id))
      .returning();
    return result;
  }

  private async normalizeVendorInvoiceData(
    data: Pick<InsertVendorInvoice, "associationId" | "vendorId" | "vendorName">,
    existing?: VendorInvoice,
  ): Promise<Pick<InsertVendorInvoice, "vendorId" | "vendorName">> {
    const associationId = data.associationId ?? existing?.associationId;
    const nextVendorId = data.vendorId !== undefined ? data.vendorId : (existing?.vendorId ?? null);
    const inputVendorName = data.vendorName !== undefined ? data.vendorName : existing?.vendorName;
    const trimmedVendorName = typeof inputVendorName === "string" ? inputVendorName.trim() : "";

    if (nextVendorId) {
      const [vendor] = await db.select().from(vendors).where(eq(vendors.id, nextVendorId));
      if (!vendor) {
        throw new Error("Vendor not found");
      }
      if (associationId && vendor.associationId !== associationId) {
        throw new Error("Vendor does not belong to the selected association");
      }
      return {
        vendorId: vendor.id,
        vendorName: vendor.name,
      };
    }

    if (!trimmedVendorName) {
      throw new Error("Vendor name is required");
    }

    if (!associationId) {
      throw new Error("Association is required for vendor filing");
    }

    const [existingVendor] = await db
      .select()
      .from(vendors)
      .where(and(eq(vendors.associationId, associationId), eq(vendors.name, trimmedVendorName)))
      .limit(1);

    if (existingVendor) {
      return {
        vendorId: existingVendor.id,
        vendorName: existingVendor.name,
      };
    }

    const [createdVendor] = await db
      .insert(vendors)
      .values({
        associationId,
        name: trimmedVendorName,
        trade: "general",
        status: "active",
        updatedAt: new Date(),
      })
      .returning();

    return {
      vendorId: createdVendor.id,
      vendorName: createdVendor.name,
    };
  }

  async createVendorInvoice(data: InsertVendorInvoice): Promise<VendorInvoice> {
    const vendorFields = await this.normalizeVendorInvoiceData(data);
    const [result] = await db
      .insert(vendorInvoices)
      .values({ ...data, ...vendorFields, updatedAt: new Date() })
      .returning();
    return result;
  }

  async updateVendorInvoice(id: string, data: Partial<InsertVendorInvoice>): Promise<VendorInvoice | undefined> {
    const [existing] = await db.select().from(vendorInvoices).where(eq(vendorInvoices.id, id));
    if (!existing) return undefined;

    const vendorFields =
      data.vendorId !== undefined || data.vendorName !== undefined || data.associationId !== undefined
        ? await this.normalizeVendorInvoiceData(
            {
              associationId: data.associationId ?? existing.associationId,
              vendorId: data.vendorId !== undefined ? data.vendorId : existing.vendorId,
              vendorName: data.vendorName !== undefined ? data.vendorName : existing.vendorName,
            },
            existing,
          )
        : {
            vendorId: existing.vendorId,
            vendorName: existing.vendorName,
          };

    const [result] = await db
      .update(vendorInvoices)
      .set({ ...data, ...vendorFields, updatedAt: new Date() })
      .where(eq(vendorInvoices.id, id))
      .returning();
    return result;
  }

  async getUtilityPayments(associationId?: string): Promise<UtilityPayment[]> {
    if (!associationId) return db.select().from(utilityPayments).orderBy(desc(utilityPayments.createdAt));
    return db
      .select()
      .from(utilityPayments)
      .where(eq(utilityPayments.associationId, associationId))
      .orderBy(desc(utilityPayments.createdAt));
  }

  async createUtilityPayment(data: InsertUtilityPayment): Promise<UtilityPayment> {
    const [result] = await db
      .insert(utilityPayments)
      .values({ ...data, updatedAt: new Date() })
      .returning();
    return result;
  }

  async updateUtilityPayment(id: string, data: Partial<InsertUtilityPayment>): Promise<UtilityPayment | undefined> {
    const [result] = await db
      .update(utilityPayments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(utilityPayments.id, id))
      .returning();
    return result;
  }

  async getPaymentMethodConfigs(associationId?: string): Promise<PaymentMethodConfig[]> {
    if (!associationId) {
      return db.select().from(paymentMethodConfigs).orderBy(paymentMethodConfigs.displayOrder, desc(paymentMethodConfigs.createdAt));
    }
    return db
      .select()
      .from(paymentMethodConfigs)
      .where(eq(paymentMethodConfigs.associationId, associationId))
      .orderBy(paymentMethodConfigs.displayOrder, desc(paymentMethodConfigs.createdAt));
  }

  async createPaymentMethodConfig(data: InsertPaymentMethodConfig): Promise<PaymentMethodConfig> {
    const [result] = await db
      .insert(paymentMethodConfigs)
      .values({ ...data, updatedAt: new Date() })
      .returning();
    return result;
  }

  async updatePaymentMethodConfig(id: string, data: Partial<InsertPaymentMethodConfig>): Promise<PaymentMethodConfig | undefined> {
    const [result] = await db
      .update(paymentMethodConfigs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(paymentMethodConfigs.id, id))
      .returning();
    return result;
  }

  private renderStructuredPaymentMethodInstructions(method: PaymentMethodConfig): string {
    const lines = [method.displayName];
    if (method.bankName) lines.push(`Bank: ${method.bankName}`);
    if (method.accountName) lines.push(`Account Name: ${method.accountName}`);
    if (method.routingNumber) lines.push(`Routing Number: ${method.routingNumber}`);
    if (method.accountNumber) lines.push(`Account Number: ${maskAccountNumber(method.accountNumber)}`);
    if (method.zelleHandle) lines.push(`Zelle: ${method.zelleHandle}`);
    if (method.mailingAddress) lines.push(`Mailing Address: ${method.mailingAddress}`);
    if (method.paymentNotes) lines.push(`Notes: ${method.paymentNotes}`);
    if (method.instructions?.trim()) lines.push(method.instructions.trim());
    return lines.filter(Boolean).join("\n");
  }

  async getPaymentGatewayConnections(associationId?: string): Promise<PaymentGatewayConnection[]> {
    if (!associationId) {
      const rows = await db.select().from(paymentGatewayConnections).orderBy(desc(paymentGatewayConnections.updatedAt));
      return rows.map((row) => sanitizePaymentGatewayConnection(row));
    }
    const rows = await db
      .select()
      .from(paymentGatewayConnections)
      .where(eq(paymentGatewayConnections.associationId, associationId))
      .orderBy(desc(paymentGatewayConnections.updatedAt));
    return rows.map((row) => sanitizePaymentGatewayConnection(row));
  }

  async getActivePaymentGatewayConnection(payload: {
    associationId: string;
    provider?: "stripe" | "other" | null;
  }): Promise<{
    connection: PaymentGatewayConnection;
    publishableKey: string | null;
    secretKey: string | null;
    webhookSecret: string | null;
  } | null> {
    const providerFilter = payload.provider ?? null;
    const rows = await db
      .select()
      .from(paymentGatewayConnections)
      .where(and(
        eq(paymentGatewayConnections.associationId, payload.associationId),
        eq(paymentGatewayConnections.isActive, 1),
        providerFilter ? eq(paymentGatewayConnections.provider, providerFilter) : undefined,
      ))
      .orderBy(desc(paymentGatewayConnections.updatedAt))
      .limit(1);
    const connection = rows[0];
    if (!connection) return null;

    const metadata = isRecord(connection.metadataJson) ? connection.metadataJson : {};
    const gatewayCredentials = isRecord(metadata._gatewayCredentials)
      ? metadata._gatewayCredentials as PaymentGatewayCredentialMetadata
      : null;

    return {
      connection: sanitizePaymentGatewayConnection(connection),
      publishableKey: connection.publishableKey?.trim() || null,
      secretKey: decryptGatewaySecret(gatewayCredentials?.encryptedSecretKey ?? null),
      webhookSecret: decryptGatewaySecret(gatewayCredentials?.encryptedWebhookSecret ?? null),
    };
  }

  async validateAndUpsertPaymentGatewayConnection(payload: {
    associationId: string;
    provider: "stripe" | "other";
    providerAccountId?: string | null;
    publishableKey?: string | null;
    secretKey?: string | null;
    webhookSecret?: string | null;
    isActive?: boolean;
    metadataJson?: Record<string, unknown> | null;
  }): Promise<{ validated: boolean; checks: string[]; connection: PaymentGatewayConnection }> {
    const [association] = await db.select({ id: associations.id }).from(associations).where(eq(associations.id, payload.associationId));
    if (!association) {
      throw new Error("Association not found");
    }

    const checks: string[] = [];
    const providerAccountId = payload.providerAccountId?.trim() || null;
    const publishableKey = payload.publishableKey?.trim() || null;
    const secretKey = payload.secretKey?.trim() || null;
    const webhookSecret = payload.webhookSecret?.trim() || null;
    const baseMetadata = isRecord(payload.metadataJson) ? { ...payload.metadataJson } : {};
    let validationMessage = "Gateway credentials passed validation.";

    if (payload.provider === "stripe") {
      if (!publishableKey || !publishableKey.startsWith("pk_")) checks.push("Stripe publishable key must start with pk_");
      if (!secretKey || !secretKey.startsWith("sk_")) checks.push("Stripe secret key must start with sk_");
      if (!webhookSecret || !webhookSecret.startsWith("whsec_")) checks.push("Stripe webhook secret must start with whsec_");
      if (providerAccountId && !providerAccountId.startsWith("acct_")) checks.push("Stripe account id must start with acct_");
    } else {
      if (!secretKey || secretKey.length < 8) checks.push("Provider secret key must be at least 8 characters");
      if (webhookSecret && webhookSecret.length < 8) checks.push("Webhook secret must be at least 8 characters");
    }

    if (checks.length > 0) {
      throw new Error(checks.join("; "));
    }

    let resolvedProviderAccountId = providerAccountId;
    const verification: PaymentGatewayCredentialMetadata["verification"] = {
      provider: payload.provider,
      mode: payload.provider === "stripe" ? "live-account" : "structural",
      verifiedAt: new Date().toISOString(),
    };

    if (payload.provider === "stripe") {
      const verified = await verifyStripeGatewayCredentials({
        publishableKey: publishableKey!,
        secretKey: secretKey!,
        providerAccountId,
      });
      resolvedProviderAccountId = verified.accountId;
      verification.accountId = verified.accountId;
      verification.livemode = verified.livemode;
      checks.push(...verified.checks);
      validationMessage = `Stripe credentials verified for account ${verified.accountId}.`;
    } else {
      checks.push("Stored non-Stripe provider credentials after structural validation.");
      validationMessage = "Provider credentials passed structural validation and were stored securely.";
    }

    const credentialMetadata: PaymentGatewayCredentialMetadata = {
      encryptedSecretKey: secretKey ? encryptGatewaySecret(secretKey) : null,
      encryptedWebhookSecret: webhookSecret ? encryptGatewaySecret(webhookSecret) : null,
      verification,
    };

    const values: InsertPaymentGatewayConnection = {
      associationId: payload.associationId,
      provider: payload.provider,
      providerAccountId: resolvedProviderAccountId,
      publishableKey,
      secretKeyMasked: secretKey ? maskSecret(secretKey) : null,
      webhookSecretMasked: webhookSecret ? maskSecret(webhookSecret) : null,
      validationStatus: "valid",
      validationMessage,
      isActive: payload.isActive === false ? 0 : 1,
      metadataJson: {
        ...baseMetadata,
        _gatewayCredentials: credentialMetadata,
      },
    };

    const [existing] = await db
      .select({ id: paymentGatewayConnections.id })
      .from(paymentGatewayConnections)
      .where(and(
        eq(paymentGatewayConnections.associationId, payload.associationId),
        eq(paymentGatewayConnections.provider, payload.provider),
      ));

    let connection: PaymentGatewayConnection;
    if (existing) {
      const [updated] = await db
        .update(paymentGatewayConnections)
        .set({
          ...values,
          lastValidatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(paymentGatewayConnections.id, existing.id))
        .returning();
      connection = updated;
    } else {
      const [created] = await db
        .insert(paymentGatewayConnections)
        .values({
          ...values,
          lastValidatedAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      connection = created;
    }

    return {
      validated: true,
      checks,
      connection: sanitizePaymentGatewayConnection(connection),
    };
  }

  async createOwnerPaymentLink(payload: {
    associationId: string;
    unitId: string;
    personId: string;
    amount?: number | null;
    currency?: string | null;
    allowPartial?: boolean;
    memo?: string | null;
    expiresAt?: Date | string | null;
    createdBy?: string | null;
    metadataJson?: Record<string, unknown> | null;
  }): Promise<{ link: OwnerPaymentLink; paymentUrl: string; outstandingBalance: number }> {
    const [association, unit, person] = await Promise.all([
      db.select({ id: associations.id }).from(associations).where(eq(associations.id, payload.associationId)).then((rows) => rows[0]),
      db.select({ id: units.id, associationId: units.associationId }).from(units).where(eq(units.id, payload.unitId)).then((rows) => rows[0]),
      db.select({ id: persons.id }).from(persons).where(eq(persons.id, payload.personId)).then((rows) => rows[0]),
    ]);
    if (!association) throw new Error("Association not found");
    if (!unit || unit.associationId !== payload.associationId) throw new Error("Unit not found in association");
    if (!person) throw new Error("Person not found");

    const entries = await db
      .select({ amount: ownerLedgerEntries.amount })
      .from(ownerLedgerEntries)
      .where(and(
        eq(ownerLedgerEntries.associationId, payload.associationId),
        eq(ownerLedgerEntries.unitId, payload.unitId),
        eq(ownerLedgerEntries.personId, payload.personId),
      ));
    const outstandingBalance = Number(entries.reduce((sum, row) => sum + row.amount, 0).toFixed(2));
    if (outstandingBalance <= 0) {
      throw new Error("Owner ledger balance is not payable");
    }

    const requestedAmount = typeof payload.amount === "number" ? Number(payload.amount) : outstandingBalance;
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      throw new Error("Payment link amount must be greater than zero");
    }
    const roundedAmount = Number(requestedAmount.toFixed(2));
    if (roundedAmount > outstandingBalance) {
      throw new Error(`Payment link amount ${roundedAmount} exceeds outstanding balance ${outstandingBalance}`);
    }

    const allowPartial = payload.allowPartial === true;
    if (!allowPartial && Math.abs(roundedAmount - outstandingBalance) > 0.009) {
      throw new Error("Exact outstanding amount required when partial payments are disabled");
    }

    const token = randomBytes(24).toString("base64url");
    const expiresAt = payload.expiresAt ? new Date(payload.expiresAt) : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      throw new Error("expiresAt must be a valid date");
    }

    const [link] = await db
      .insert(ownerPaymentLinks)
      .values({
        associationId: payload.associationId,
        unitId: payload.unitId,
        personId: payload.personId,
        token,
        amount: roundedAmount,
        currency: normalizeCurrency(payload.currency),
        status: "active",
        allowPartial: allowPartial ? 1 : 0,
        memo: payload.memo ?? null,
        expiresAt,
        metadataJson: payload.metadataJson ?? null,
        createdBy: payload.createdBy ?? null,
        updatedAt: new Date(),
      })
      .returning();

    const appBaseUrl = (process.env.APP_BASE_URL || "http://localhost:5000").replace(/\/$/, "");
    return {
      link,
      paymentUrl: `${appBaseUrl}/api/portal/payments/link/${encodeURIComponent(link.token)}`,
      outstandingBalance,
    };
  }

  async getOwnerPaymentLinkByToken(token: string): Promise<OwnerPaymentLink | undefined> {
    const [link] = await db.select().from(ownerPaymentLinks).where(eq(ownerPaymentLinks.token, token));
    if (!link) return undefined;
    if (link.status !== "active") return link;

    if (link.expiresAt && link.expiresAt.getTime() < Date.now()) {
      const [expired] = await db
        .update(ownerPaymentLinks)
        .set({ status: "expired", updatedAt: new Date() })
        .where(eq(ownerPaymentLinks.id, link.id))
        .returning();
      return expired;
    }

    return link;
  }

  async processPaymentWebhookEvent(payload: {
    associationId: string;
    provider: "stripe" | "other";
    providerEventId: string;
    eventType?: string | null;
    status?: "succeeded" | "failed" | "pending" | null;
    amount?: number | null;
    currency?: string | null;
    personId?: string | null;
    unitId?: string | null;
    paymentLinkToken?: string | null;
    gatewayReference?: string | null;
    rawPayloadJson?: unknown;
  }): Promise<{ duplicate: boolean; event: PaymentWebhookEvent; ownerLedgerEntry: OwnerLedgerEntry | null; message: string }> {
    const [existing] = await db
      .select()
      .from(paymentWebhookEvents)
      .where(and(
        eq(paymentWebhookEvents.associationId, payload.associationId),
        eq(paymentWebhookEvents.provider, payload.provider),
        eq(paymentWebhookEvents.providerEventId, payload.providerEventId),
      ));

    if (existing) {
      const ownerLedgerEntry = existing.ownerLedgerEntryId
        ? (await db.select().from(ownerLedgerEntries).where(eq(ownerLedgerEntries.id, existing.ownerLedgerEntryId)).then((rows) => rows[0] ?? null))
        : null;
      return {
        duplicate: true,
        event: existing,
        ownerLedgerEntry,
        message: "Webhook event already processed",
      };
    }

    const status = payload.status ?? "pending";
    const [association] = await db.select({ id: associations.id }).from(associations).where(eq(associations.id, payload.associationId));
    if (!association) throw new Error("Association not found");

    const link = payload.paymentLinkToken
      ? await this.getOwnerPaymentLinkByToken(payload.paymentLinkToken)
      : undefined;
    if (link && link.associationId !== payload.associationId) {
      throw new Error("Payment link does not belong to association");
    }

    const personId = payload.personId || link?.personId || null;
    const unitId = payload.unitId || link?.unitId || null;
    const amountRaw = typeof payload.amount === "number" ? payload.amount : link?.amount ?? null;
    const amount = amountRaw == null ? null : Number(Math.abs(amountRaw).toFixed(2));

    const [receivedEvent] = await db
      .insert(paymentWebhookEvents)
      .values({
        associationId: payload.associationId,
        provider: payload.provider,
        providerEventId: payload.providerEventId,
        paymentLinkId: link?.id ?? null,
        unitId,
        personId,
        amount,
        currency: normalizeCurrency(payload.currency || link?.currency),
        status: "received",
        eventType: payload.eventType ?? null,
        gatewayReference: payload.gatewayReference ?? null,
        rawPayloadJson: payload.rawPayloadJson ?? null,
        updatedAt: new Date(),
      })
      .returning();

    if (status !== "succeeded") {
      const [ignoredEvent] = await db
        .update(paymentWebhookEvents)
        .set({
          status: status === "failed" ? "failed" : "ignored",
          errorMessage: status === "failed" ? "Payment provider reported a failed charge." : "Payment event not in succeeded status.",
          processedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(paymentWebhookEvents.id, receivedEvent.id))
        .returning();
      return {
        duplicate: false,
        event: ignoredEvent,
        ownerLedgerEntry: null,
        message: "Payment event ignored because it was not successful",
      };
    }

    if (!personId || !unitId || !amount || amount <= 0) {
      const [failedEvent] = await db
        .update(paymentWebhookEvents)
        .set({
          status: "failed",
          errorMessage: "Missing personId, unitId, or amount for successful payment event.",
          processedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(paymentWebhookEvents.id, receivedEvent.id))
        .returning();
      return {
        duplicate: false,
        event: failedEvent,
        ownerLedgerEntry: null,
        message: "Payment event could not be posted to owner ledger",
      };
    }

    const [unit] = await db.select({ id: units.id, associationId: units.associationId }).from(units).where(eq(units.id, unitId));
    const [person] = await db.select({ id: persons.id }).from(persons).where(eq(persons.id, personId));
    if (!unit || unit.associationId !== payload.associationId || !person) {
      const [failedEvent] = await db
        .update(paymentWebhookEvents)
        .set({
          status: "failed",
          errorMessage: "Resolved person or unit is invalid for association.",
          processedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(paymentWebhookEvents.id, receivedEvent.id))
        .returning();
      return {
        duplicate: false,
        event: failedEvent,
        ownerLedgerEntry: null,
        message: "Payment event references invalid person or unit",
      };
    }

    const [ownerLedgerEntry] = await db
      .insert(ownerLedgerEntries)
      .values({
        associationId: payload.associationId,
        unitId,
        personId,
        entryType: "payment",
        amount: Number((-Math.abs(amount)).toFixed(2)),
        postedAt: new Date(),
        description: payload.eventType ? `Payment webhook (${payload.eventType})` : "Payment webhook",
        referenceType: "payment-webhook",
        referenceId: receivedEvent.id,
      })
      .returning();

    if (link && link.status === "active") {
      await db
        .update(ownerPaymentLinks)
        .set({
          status: "paid",
          paidAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(ownerPaymentLinks.id, link.id));
    }

    const [processedEvent] = await db
      .update(paymentWebhookEvents)
      .set({
        status: "processed",
        ownerLedgerEntryId: ownerLedgerEntry.id,
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(paymentWebhookEvents.id, receivedEvent.id))
      .returning();

    return {
      duplicate: false,
      event: processedEvent,
      ownerLedgerEntry,
      message: "Payment webhook processed and owner ledger updated",
    };
  }

  async sendPaymentInstructionNotice(payload: {
    associationId: string;
    templateId?: string | null;
    subject?: string | null;
    body?: string | null;
    targetType?: "all-owners" | "individual-owner" | "selected-units";
    selectedUnitIds?: string[];
    selectedPersonId?: string | null;
    ccOwners?: boolean;
    requireApproval?: boolean | null;
    scheduledFor?: Date | string | null;
    sentBy?: string | null;
  }): Promise<{
    recipientCount: number;
    sentCount: number;
    sendIds: string[];
    skippedRecipients: number;
    missingEmailCount: number;
    duplicateEmailCount: number;
    variables: Record<string, string>;
  }> {
    const methods = (await this.getPaymentMethodConfigs(payload.associationId)).filter((row) => row.isActive === 1);
    if (methods.length === 0) {
      throw new Error("No active payment method configurations found for association");
    }

    const methodLines = methods
      .map((row, index) => `${index + 1}.\n${this.renderStructuredPaymentMethodInstructions(row)}`)
      .join("\n");
    const supportEmails = Array.from(new Set(methods.map((row) => row.supportEmail).filter((v): v is string => Boolean(v && v.trim()))));
    const supportPhones = Array.from(new Set(methods.map((row) => row.supportPhone).filter((v): v is string => Boolean(v && v.trim()))));
    const mailingAddresses = Array.from(new Set(methods.map((row) => row.mailingAddress).filter((v): v is string => Boolean(v && v.trim()))));
    const zelleHandles = Array.from(new Set(methods.map((row) => row.zelleHandle).filter((v): v is string => Boolean(v && v.trim()))));

    const variables: Record<string, string> = {
      payment_methods: methodLines,
      payment_support_email: supportEmails.join(", "),
      payment_support_phone: supportPhones.join(", "),
      payment_mailing_address: mailingAddresses.join("\n"),
      payment_zelle_handle: zelleHandles.join(", "),
      payment_method_count: String(methods.length),
    };

    const result = await this.sendTargetedNotice({
      associationId: payload.associationId,
      targetType: payload.targetType ?? "all-owners",
      selectedUnitIds: payload.selectedUnitIds,
      selectedPersonId: payload.selectedPersonId ?? null,
      selectedUnitAudience: payload.targetType === "selected-units" ? "owners" : undefined,
      messageClass: "financial",
      ccOwners: payload.ccOwners ?? false,
      templateId: payload.templateId ?? null,
      subject: payload.subject ?? null,
      body: payload.body ?? null,
      variables,
      requireApproval: payload.requireApproval ?? null,
      scheduledFor: payload.scheduledFor ?? null,
      sentBy: payload.sentBy ?? null,
    });

    return {
      ...result,
      variables,
    };
  }

  async getExpenseAttachments(expenseType?: "invoice" | "utility-payment", expenseId?: string, associationId?: string): Promise<ExpenseAttachment[]> {
    const whereClauses = [];
    if (expenseType) whereClauses.push(eq(expenseAttachments.expenseType, expenseType));
    if (expenseId) whereClauses.push(eq(expenseAttachments.expenseId, expenseId));
    if (associationId) whereClauses.push(eq(expenseAttachments.associationId, associationId));

    if (whereClauses.length > 0) {
      return db
        .select()
        .from(expenseAttachments)
        .where(and(...whereClauses))
        .orderBy(desc(expenseAttachments.createdAt));
    }
    return db.select().from(expenseAttachments).orderBy(desc(expenseAttachments.createdAt));
  }

  async createExpenseAttachment(data: InsertExpenseAttachment): Promise<ExpenseAttachment> {
    const [result] = await db.insert(expenseAttachments).values(data).returning();
    return result;
  }

  async getOwnerLedgerEntries(associationId?: string): Promise<OwnerLedgerEntry[]> {
    if (!associationId) {
      return db.select().from(ownerLedgerEntries).orderBy(desc(ownerLedgerEntries.postedAt));
    }
    return db
      .select()
      .from(ownerLedgerEntries)
      .where(eq(ownerLedgerEntries.associationId, associationId))
      .orderBy(desc(ownerLedgerEntries.postedAt));
  }

  async createOwnerLedgerEntry(data: InsertOwnerLedgerEntry): Promise<OwnerLedgerEntry> {
    const [result] = await db.insert(ownerLedgerEntries).values(data).returning();
    return result;
  }

  async getOwnerLedgerSummary(associationId: string): Promise<Array<{ personId: string; unitId: string; balance: number }>> {
    const entries = await this.getOwnerLedgerEntries(associationId);
    const rollup = new Map<string, { personId: string; unitId: string; balance: number }>();
    for (const entry of entries) {
      const key = `${entry.personId}:${entry.unitId}`;
      const current = rollup.get(key) ?? { personId: entry.personId, unitId: entry.unitId, balance: 0 };
      current.balance += entry.amount;
      rollup.set(key, current);
    }
    return Array.from(rollup.values()).sort((a, b) => b.balance - a.balance);
  }

  async getGovernanceMeetings(associationId?: string): Promise<GovernanceMeeting[]> {
    if (!associationId) {
      return db.select().from(governanceMeetings).orderBy(desc(governanceMeetings.scheduledAt));
    }
    return db
      .select()
      .from(governanceMeetings)
      .where(eq(governanceMeetings.associationId, associationId))
      .orderBy(desc(governanceMeetings.scheduledAt));
  }

  async createGovernanceMeeting(data: InsertGovernanceMeeting): Promise<GovernanceMeeting> {
    const [result] = await db
      .insert(governanceMeetings)
      .values({ ...data, updatedAt: new Date() })
      .returning();
    return result;
  }

  async updateGovernanceMeeting(id: string, data: Partial<InsertGovernanceMeeting>): Promise<GovernanceMeeting | undefined> {
    const [next] = await db.select().from(governanceMeetings).where(eq(governanceMeetings.id, id));
    if (!next) return undefined;
    const status = data.status ?? next.status;
    const completedAtStatus = status === "completed";
    const [result] = await db
      .update(governanceMeetings)
      .set({
        ...data,
        summaryStatus: data.summaryStatus ?? next.summaryStatus,
        updatedAt: new Date(),
        ...(completedAtStatus && !next.notes ? { notes: data.notes ?? next.notes } : {}),
      })
      .where(eq(governanceMeetings.id, id))
      .returning();
    return result;
  }

  async getMeetingAgendaItems(meetingId: string): Promise<MeetingAgendaItem[]> {
    return db
      .select()
      .from(meetingAgendaItems)
      .where(eq(meetingAgendaItems.meetingId, meetingId))
      .orderBy(meetingAgendaItems.orderIndex);
  }

  async createMeetingAgendaItem(data: InsertMeetingAgendaItem): Promise<MeetingAgendaItem> {
    const [result] = await db.insert(meetingAgendaItems).values(data).returning();
    return result;
  }

  async getMeetingNotes(meetingId: string): Promise<MeetingNote[]> {
    return db
      .select()
      .from(meetingNotes)
      .where(eq(meetingNotes.meetingId, meetingId))
      .orderBy(desc(meetingNotes.createdAt));
  }

  async createMeetingNote(data: InsertMeetingNote): Promise<MeetingNote> {
    const [result] = await db.insert(meetingNotes).values({ ...data, updatedAt: new Date() }).returning();
    return result;
  }

  async updateMeetingNote(id: string, data: Partial<InsertMeetingNote>): Promise<MeetingNote | undefined> {
    const [result] = await db
      .update(meetingNotes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(meetingNotes.id, id))
      .returning();
    return result;
  }

  async getResolutions(associationId?: string): Promise<Resolution[]> {
    if (!associationId) {
      return db.select().from(resolutions).orderBy(desc(resolutions.createdAt));
    }
    return db
      .select()
      .from(resolutions)
      .where(eq(resolutions.associationId, associationId))
      .orderBy(desc(resolutions.createdAt));
  }

  async createResolution(data: InsertResolution): Promise<Resolution> {
    const [result] = await db
      .insert(resolutions)
      .values({
        ...data,
        passedAt: data.status === "approved" ? new Date() : null,
        updatedAt: new Date(),
      })
      .returning();
    return result;
  }

  async updateResolution(id: string, data: Partial<InsertResolution>): Promise<Resolution | undefined> {
    const patch: Partial<InsertResolution> & { updatedAt: Date; passedAt?: Date | null } = {
      ...data,
      updatedAt: new Date(),
    };
    if ("status" in data) {
      patch.passedAt = data.status === "approved" ? new Date() : null;
    }
    const [result] = await db.update(resolutions).set(patch as any).where(eq(resolutions.id, id)).returning();
    return result;
  }

  async getVoteRecords(resolutionId: string): Promise<VoteRecord[]> {
    return db.select().from(voteRecords).where(eq(voteRecords.resolutionId, resolutionId)).orderBy(desc(voteRecords.createdAt));
  }

  async createVoteRecord(data: InsertVoteRecord): Promise<VoteRecord> {
    let result: VoteRecord;
    if (data.voterPersonId) {
      const [existingVote] = await db
        .select()
        .from(voteRecords)
        .where(
          and(
            eq(voteRecords.resolutionId, data.resolutionId),
            eq(voteRecords.voterPersonId, data.voterPersonId),
          ),
        );

      if (existingVote) {
        const [updated] = await db
          .update(voteRecords)
          .set({
            voteChoice: data.voteChoice,
            voteWeight: data.voteWeight,
            createdAt: new Date(),
          })
          .where(eq(voteRecords.id, existingVote.id))
          .returning();
        result = updated;
      } else {
        const [created] = await db.insert(voteRecords).values(data).returning();
        result = created;
      }
    } else {
      const [created] = await db.insert(voteRecords).values(data).returning();
      result = created;
    }

    const votes = await this.getVoteRecords(result.resolutionId);
    const tallies = votes.reduce(
      (acc, vote) => {
        acc[vote.voteChoice] += vote.voteWeight;
        return acc;
      },
      { yes: 0, no: 0, abstain: 0 },
    );
    const status: InsertResolution["status"] =
      tallies.yes > tallies.no ? "approved" : tallies.no > tallies.yes ? "rejected" : "open";
    await this.updateResolution(result.resolutionId, { status });
    return result;
  }

  async getCalendarEvents(associationId?: string): Promise<CalendarEvent[]> {
    if (!associationId) {
      return db.select().from(calendarEvents).orderBy(calendarEvents.startsAt);
    }
    return db
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.associationId, associationId))
      .orderBy(calendarEvents.startsAt);
  }

  async createCalendarEvent(data: InsertCalendarEvent): Promise<CalendarEvent> {
    const [result] = await db
      .insert(calendarEvents)
      .values({ ...data, updatedAt: new Date() })
      .returning();
    return result;
  }

  async updateCalendarEvent(id: string, data: Partial<InsertCalendarEvent>): Promise<CalendarEvent | undefined> {
    const [result] = await db
      .update(calendarEvents)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(calendarEvents.id, id))
      .returning();
    return result;
  }

  async getGovernanceComplianceTemplates(associationId?: string): Promise<GovernanceComplianceTemplate[]> {
    if (!associationId) {
      return db
        .select()
        .from(governanceComplianceTemplates)
        .orderBy(desc(governanceComplianceTemplates.year), desc(governanceComplianceTemplates.versionNumber), desc(governanceComplianceTemplates.createdAt));
    }

    const [association] = await db.select().from(associations).where(eq(associations.id, associationId));
    const normalizedState = association?.state?.trim().toUpperCase() || null;

    const whereClause = normalizedState
      ? or(
          eq(governanceComplianceTemplates.associationId, associationId),
          and(
            isNull(governanceComplianceTemplates.associationId),
            or(
              and(
                eq(governanceComplianceTemplates.scope, "state-library"),
                eq(governanceComplianceTemplates.stateCode, normalizedState),
              ),
              and(
                eq(governanceComplianceTemplates.scope, "ct-baseline"),
                or(
                  eq(governanceComplianceTemplates.stateCode, "CT"),
                  isNull(governanceComplianceTemplates.stateCode),
                ),
              ),
            ),
          ),
        )
      : eq(governanceComplianceTemplates.associationId, associationId);

    return db
      .select()
      .from(governanceComplianceTemplates)
      .where(whereClause)
      .orderBy(desc(governanceComplianceTemplates.year), desc(governanceComplianceTemplates.versionNumber), desc(governanceComplianceTemplates.createdAt));
  }

  async createGovernanceComplianceTemplate(data: InsertGovernanceComplianceTemplate): Promise<GovernanceComplianceTemplate> {
    const now = new Date();
    const publicationStatus = data.publicationStatus
      || (data.scope === "association" ? "draft" : "review");
    const publishedAt = publicationStatus === "published" ? (parseOptionalDate(data.publishedAt) || now) : null;
    const [result] = await db
      .insert(governanceComplianceTemplates)
      .values({
        ...data,
        stateCode: data.stateCode?.trim().toUpperCase() || null,
        sourceUrl: data.sourceUrl?.trim() || null,
        sourceAuthority: data.sourceAuthority?.trim() || null,
        sourceDocumentTitle: data.sourceDocumentTitle?.trim() || null,
        sourceDocumentDate: parseOptionalDate(data.sourceDocumentDate),
        effectiveDate: parseOptionalDate(data.effectiveDate),
        lastSourceUpdatedAt: parseOptionalDate(data.lastSourceUpdatedAt),
        lastVerifiedAt: parseOptionalDate(data.lastVerifiedAt),
        lastSyncedAt: parseOptionalDate(data.lastSyncedAt),
        nextReviewDueAt: parseOptionalDate(data.nextReviewDueAt),
        publicationStatus,
        publishedAt,
        reviewNotes: data.reviewNotes?.trim() || null,
        updatedAt: now,
      })
      .returning();
    return result;
  }

  async updateGovernanceComplianceTemplate(id: string, data: Partial<InsertGovernanceComplianceTemplate>): Promise<GovernanceComplianceTemplate | undefined> {
    const [existing] = await db.select().from(governanceComplianceTemplates).where(eq(governanceComplianceTemplates.id, id));
    if (!existing) return undefined;

    const nextPublicationStatus = data.publicationStatus ?? existing.publicationStatus;
    const publishedAt =
      nextPublicationStatus === "published"
        ? (parseOptionalDate(data.publishedAt) || existing.publishedAt || new Date())
        : nextPublicationStatus === "archived"
          ? existing.publishedAt
          : null;

    const [result] = await db
      .update(governanceComplianceTemplates)
      .set({
        ...data,
        stateCode: data.stateCode === undefined ? undefined : (data.stateCode?.trim().toUpperCase() || null),
        sourceUrl: data.sourceUrl === undefined ? undefined : (data.sourceUrl?.trim() || null),
        sourceAuthority: data.sourceAuthority === undefined ? undefined : (data.sourceAuthority?.trim() || null),
        sourceDocumentTitle: data.sourceDocumentTitle === undefined ? undefined : (data.sourceDocumentTitle?.trim() || null),
        sourceDocumentDate: data.sourceDocumentDate === undefined ? undefined : parseOptionalDate(data.sourceDocumentDate),
        effectiveDate: data.effectiveDate === undefined ? undefined : parseOptionalDate(data.effectiveDate),
        lastSourceUpdatedAt: data.lastSourceUpdatedAt === undefined ? undefined : parseOptionalDate(data.lastSourceUpdatedAt),
        lastVerifiedAt: data.lastVerifiedAt === undefined ? undefined : parseOptionalDate(data.lastVerifiedAt),
        lastSyncedAt: data.lastSyncedAt === undefined ? undefined : parseOptionalDate(data.lastSyncedAt),
        nextReviewDueAt: data.nextReviewDueAt === undefined ? undefined : parseOptionalDate(data.nextReviewDueAt),
        publicationStatus: nextPublicationStatus,
        publishedAt,
        reviewNotes: data.reviewNotes === undefined ? undefined : (data.reviewNotes?.trim() || null),
        updatedAt: new Date(),
      })
      .where(eq(governanceComplianceTemplates.id, id))
      .returning();

    return result;
  }

  async bootstrapGovernanceStateTemplateLibrary(states?: string[]): Promise<{ created: number; updated: number }> {
    const requestedStates = new Set((states ?? []).map((value) => value.trim().toUpperCase()).filter(Boolean));
    const seedTemplates = governanceStateTemplateLibrary.filter((template) => requestedStates.size === 0 || requestedStates.has(template.stateCode));
    let created = 0;
    let updated = 0;

    for (const seed of seedTemplates) {
      const legacyScope = seed.stateCode === "CT" ? "ct-baseline" : "state-library";
      const [existing] = await db
        .select()
        .from(governanceComplianceTemplates)
        .where(
          and(
            isNull(governanceComplianceTemplates.associationId),
            isNull(governanceComplianceTemplates.baseTemplateId),
            eq(governanceComplianceTemplates.versionNumber, seed.versionNumber),
            seed.stateCode === "CT"
              ? or(
                  eq(governanceComplianceTemplates.stateCode, "CT"),
                  isNull(governanceComplianceTemplates.stateCode),
                )
              : eq(governanceComplianceTemplates.stateCode, seed.stateCode),
            or(
              eq(governanceComplianceTemplates.scope, "state-library"),
              eq(governanceComplianceTemplates.scope, legacyScope),
            ),
          ),
        );

      const template = existing
        ? (
            await db
              .update(governanceComplianceTemplates)
              .set({
                name: seed.name,
                scope: seed.stateCode === "CT" ? "ct-baseline" : "state-library",
                stateCode: seed.stateCode,
                sourceAuthority: seed.sourceAuthority,
                sourceUrl: seed.sourceUrl,
                sourceDocumentTitle: seed.sourceDocumentTitle,
                sourceDocumentDate: parseOptionalDate(seed.sourceDocumentDate),
                effectiveDate: parseOptionalDate(seed.effectiveDate),
                lastSourceUpdatedAt: parseOptionalDate(seed.sourceDocumentDate),
                lastVerifiedAt: new Date(),
                lastSyncedAt: new Date(),
                nextReviewDueAt: addDays(new Date(), seed.verificationCadenceDays),
                publicationStatus: "published",
                publishedAt: existing.publishedAt || new Date(),
                reviewNotes: "Managed regulatory library record sourced from an authoritative jurisdiction reference.",
                updatedAt: new Date(),
              })
              .where(eq(governanceComplianceTemplates.id, existing.id))
              .returning()
          )[0]
        : (
            await db
              .insert(governanceComplianceTemplates)
              .values({
                associationId: null,
                baseTemplateId: null,
                scope: seed.stateCode === "CT" ? "ct-baseline" : "state-library",
                stateCode: seed.stateCode,
                year: new Date().getFullYear(),
                versionNumber: seed.versionNumber,
                name: seed.name,
                sourceAuthority: seed.sourceAuthority,
                sourceUrl: seed.sourceUrl,
                sourceDocumentTitle: seed.sourceDocumentTitle,
                sourceDocumentDate: parseOptionalDate(seed.sourceDocumentDate),
                effectiveDate: parseOptionalDate(seed.effectiveDate),
                lastSourceUpdatedAt: parseOptionalDate(seed.sourceDocumentDate),
                lastVerifiedAt: new Date(),
                lastSyncedAt: new Date(),
                nextReviewDueAt: addDays(new Date(), seed.verificationCadenceDays),
                publicationStatus: "published",
                publishedAt: new Date(),
                reviewNotes: "Managed regulatory library record sourced from an authoritative jurisdiction reference.",
                createdBy: "system-state-library",
                updatedAt: new Date(),
              })
              .returning()
          )[0];

      if (existing) updated += 1;
      else created += 1;

      const existingItems = await this.getGovernanceTemplateItems(template.id);
      if (existingItems.length === 0) {
        await db.insert(governanceTemplateItems).values(
          seed.items.map((item) => ({
            templateId: template.id,
            title: item.title,
            description: item.description,
            legalReference: item.legalReference,
            sourceCitation: item.sourceCitation,
            sourceUrl: item.sourceUrl,
            dueMonth: item.dueMonth,
            dueDay: item.dueDay,
            orderIndex: item.orderIndex,
          })),
        );
      } else {
        for (const item of seed.items) {
          const existingItem = existingItems.find((candidate) => candidate.title === item.title);
          if (existingItem) {
            await db
              .update(governanceTemplateItems)
              .set({
                description: item.description,
                legalReference: item.legalReference,
                sourceCitation: item.sourceCitation,
                sourceUrl: item.sourceUrl,
                dueMonth: item.dueMonth,
                dueDay: item.dueDay,
                orderIndex: item.orderIndex,
              })
              .where(eq(governanceTemplateItems.id, existingItem.id));
          } else {
            await db.insert(governanceTemplateItems).values({
              templateId: template.id,
              title: item.title,
              description: item.description,
              legalReference: item.legalReference,
              sourceCitation: item.sourceCitation,
              sourceUrl: item.sourceUrl,
              dueMonth: item.dueMonth,
              dueDay: item.dueDay,
              orderIndex: item.orderIndex,
            });
          }
        }
      }
    }

    return { created, updated };
  }

  async getGovernanceTemplateItems(templateId: string): Promise<GovernanceTemplateItem[]> {
    return db
      .select()
      .from(governanceTemplateItems)
      .where(eq(governanceTemplateItems.templateId, templateId))
      .orderBy(governanceTemplateItems.orderIndex);
  }

  async createGovernanceTemplateItem(data: InsertGovernanceTemplateItem): Promise<GovernanceTemplateItem> {
    const [result] = await db.insert(governanceTemplateItems).values(data).returning();
    return result;
  }

  async getAnnualGovernanceTasks(associationId?: string): Promise<AnnualGovernanceTask[]> {
    if (!associationId) {
      return db.select().from(annualGovernanceTasks).orderBy(annualGovernanceTasks.dueDate, desc(annualGovernanceTasks.createdAt));
    }
    return db
      .select()
      .from(annualGovernanceTasks)
      .where(eq(annualGovernanceTasks.associationId, associationId))
      .orderBy(annualGovernanceTasks.dueDate, desc(annualGovernanceTasks.createdAt));
  }

  async createAnnualGovernanceTask(data: InsertAnnualGovernanceTask): Promise<AnnualGovernanceTask> {
    const [result] = await db
      .insert(annualGovernanceTasks)
      .values({ ...data, updatedAt: new Date() })
      .returning();
    return result;
  }

  async updateAnnualGovernanceTask(id: string, data: Partial<InsertAnnualGovernanceTask>): Promise<AnnualGovernanceTask | undefined> {
    const [existing] = await db.select().from(annualGovernanceTasks).where(eq(annualGovernanceTasks.id, id));
    if (!existing) return undefined;
    const status = data.status ?? existing.status;
    const completedAt =
      existing.status !== "done" && status === "done"
        ? new Date()
        : existing.status === "done" && status !== "done"
          ? null
          : existing.completedAt;

    const [result] = await db
      .update(annualGovernanceTasks)
      .set({ ...data, status, completedAt, updatedAt: new Date() })
      .where(eq(annualGovernanceTasks.id, id))
      .returning();
    return result;
  }

  async getComplianceGapAlerts(associationId: string): Promise<Array<{
    templateId: string;
    templateItemId: string;
    templateName: string;
    templateItemTitle: string;
    obligationType: string;
    severity: "low" | "medium" | "high";
    status: "active" | "suppressed" | "resolved";
    sourceAuthority: string | null;
    sourceUrl: string | null;
    legalReference: string | null;
    dueMonth: number;
    dueDay: number;
    matchedRuleCount: number;
    matchedRuleIds: string[];
    suppressionReason: string | null;
    suppressedUntil: Date | null;
    staleRegulatoryRecord: boolean;
  }>> {
    const [association] = await db.select().from(associations).where(eq(associations.id, associationId));
    if (!association) return [];

    const normalizedState = association.state?.trim().toUpperCase() || null;
    const templates = await this.getGovernanceComplianceTemplates(associationId);
    const applicableTemplates = templates.filter((template) => {
      if (template.publicationStatus !== "published") return false;
      if (template.associationId === associationId) return true;
      if (!template.associationId && template.scope === "ct-baseline") return normalizedState === "CT" || !normalizedState;
      if (!template.associationId && template.scope === "state-library") return !normalizedState || template.stateCode === normalizedState;
      return false;
    });

    const itemsByTemplate = new Map<string, GovernanceTemplateItem[]>();
    for (const template of applicableTemplates) {
      itemsByTemplate.set(template.id, await this.getGovernanceTemplateItems(template.id));
    }

    const rules = await this.getComplianceRuleRecords({ associationId });
    const activeOverrides = await db
      .select()
      .from(complianceAlertOverrides)
      .where(eq(complianceAlertOverrides.associationId, associationId));
    const overrideByItemId = new Map<string, ComplianceAlertOverride>();
    activeOverrides.forEach((override) => {
      overrideByItemId.set(override.templateItemId, override);
    });

    const normalizedRules = rules.map((rule) => {
      const payload = (rule.payloadJson && typeof rule.payloadJson === "object" ? rule.payloadJson : {}) as Record<string, unknown>;
      const obligationType = typeof payload.obligationType === "string" ? payload.obligationType : "general-compliance";
      const sourceText = [
        typeof payload.sourceTitle === "string" ? payload.sourceTitle : "",
        typeof payload.obligationText === "string" ? payload.obligationText : "",
        typeof payload.sourceClauseText === "string" ? payload.sourceClauseText : "",
      ].join(" ");
      return {
        id: rule.id,
        obligationType,
        tokens: tokenizeComplianceText(sourceText),
      };
    });

    const alerts: Array<{
      templateId: string;
      templateItemId: string;
      templateName: string;
      templateItemTitle: string;
      obligationType: string;
      severity: "low" | "medium" | "high";
      status: "active" | "suppressed" | "resolved";
      sourceAuthority: string | null;
      sourceUrl: string | null;
      legalReference: string | null;
      dueMonth: number;
      dueDay: number;
      matchedRuleCount: number;
      matchedRuleIds: string[];
      suppressionReason: string | null;
      suppressedUntil: Date | null;
      staleRegulatoryRecord: boolean;
    }> = [];

    for (const template of applicableTemplates) {
      const items = itemsByTemplate.get(template.id) ?? [];
      const staleRegulatoryRecord = Boolean(template.nextReviewDueAt && template.nextReviewDueAt < new Date());
      for (const item of items) {
        const sourceText = [item.title, item.description || "", item.legalReference || "", item.sourceCitation || ""].join(" ");
        const obligationType = inferComplianceObligationType(sourceText);
        const itemTokens = tokenizeComplianceText(sourceText);
        const matchedRules = normalizedRules.filter((rule) => {
          if (rule.obligationType === obligationType) return true;
          return countTokenOverlap(itemTokens, rule.tokens) >= 2;
        });
        if (matchedRules.length > 0) continue;

        const override = overrideByItemId.get(item.id);
        const overrideActive = override && (!override.suppressedUntil || override.suppressedUntil >= new Date());
        const status = overrideActive ? override.status : "active";
        const severity: "low" | "medium" | "high" =
          staleRegulatoryRecord || obligationType === "financial-governance" || obligationType === "board-composition"
            ? "high"
            : obligationType === "meeting-governance" || obligationType === "records-retention"
              ? "medium"
              : "low";

        alerts.push({
          templateId: template.id,
          templateItemId: item.id,
          templateName: template.name,
          templateItemTitle: item.title,
          obligationType,
          severity,
          status,
          sourceAuthority: template.sourceAuthority,
          sourceUrl: item.sourceUrl || template.sourceUrl,
          legalReference: item.legalReference,
          dueMonth: item.dueMonth,
          dueDay: item.dueDay,
          matchedRuleCount: 0,
          matchedRuleIds: [],
          suppressionReason: overrideActive ? override?.suppressionReason || null : null,
          suppressedUntil: overrideActive ? override?.suppressedUntil || null : null,
          staleRegulatoryRecord,
        });
      }
    }

    return alerts.sort((left, right) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[left.severity] - severityOrder[right.severity]
        || left.dueMonth - right.dueMonth
        || left.dueDay - right.dueDay
        || left.templateItemTitle.localeCompare(right.templateItemTitle);
    });
  }

  async upsertComplianceAlertOverride(data: InsertComplianceAlertOverride): Promise<ComplianceAlertOverride> {
    const [existing] = await db
      .select()
      .from(complianceAlertOverrides)
      .where(and(
        eq(complianceAlertOverrides.associationId, data.associationId),
        eq(complianceAlertOverrides.templateItemId, data.templateItemId),
      ))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(complianceAlertOverrides)
        .set({
          templateId: data.templateId ?? existing.templateId,
          status: data.status ?? existing.status,
          suppressionReason: data.suppressionReason ?? existing.suppressionReason,
          suppressedUntil: data.suppressedUntil ?? existing.suppressedUntil,
          notes: data.notes ?? existing.notes,
          updatedBy: data.updatedBy ?? data.createdBy ?? existing.updatedBy,
          updatedAt: new Date(),
        })
        .where(eq(complianceAlertOverrides.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(complianceAlertOverrides)
      .values({
        ...data,
        updatedBy: data.updatedBy ?? data.createdBy ?? null,
      })
      .returning();
    return created;
  }

  async generateAnnualGovernanceTasksFromTemplate(input: {
    associationId: string;
    templateId: string;
    year: number;
    ownerPersonId?: string | null;
  }): Promise<{ created: number }> {
    const [selectedTemplate] = await db.select().from(governanceComplianceTemplates).where(eq(governanceComplianceTemplates.id, input.templateId));
    if (!selectedTemplate) {
      throw new Error("Governance compliance template not found");
    }

    const templateIds = new Set<string>([selectedTemplate.id]);
    if (selectedTemplate.baseTemplateId) {
      templateIds.add(selectedTemplate.baseTemplateId);
    }

    const overlays = await db
      .select()
      .from(governanceComplianceTemplates)
      .where(
        and(
          eq(governanceComplianceTemplates.associationId, input.associationId),
          inArray(governanceComplianceTemplates.baseTemplateId, Array.from(templateIds)),
        ),
      );
    for (const overlay of overlays) {
      templateIds.add(overlay.id);
      if (overlay.baseTemplateId) templateIds.add(overlay.baseTemplateId);
    }

    const itemRows = await Promise.all(Array.from(templateIds).map((templateId) => this.getGovernanceTemplateItems(templateId)));
    const items = itemRows.flat().sort((a, b) => a.orderIndex - b.orderIndex);
    let created = 0;
    for (const item of items) {
      const dueDate = new Date(Date.UTC(input.year, Math.max(0, Math.min(11, item.dueMonth - 1)), Math.max(1, Math.min(31, item.dueDay))));
      const [existing] = await db
        .select()
        .from(annualGovernanceTasks)
        .where(
          and(
            eq(annualGovernanceTasks.associationId, input.associationId),
            eq(annualGovernanceTasks.templateItemId, item.id),
            eq(annualGovernanceTasks.dueDate, dueDate),
          ),
        );
      if (existing) continue;

      await db.insert(annualGovernanceTasks).values({
        associationId: input.associationId,
        templateId: input.templateId,
        templateItemId: item.id,
        title: item.title,
        description: item.description,
        status: "todo",
        ownerPersonId: input.ownerPersonId ?? null,
        dueDate,
        notes: null,
        updatedAt: new Date(),
      });
      created += 1;
    }
    return { created };
  }

  async getAiIngestionJobs(associationId?: string): Promise<AiIngestionJob[]> {
    if (!associationId) return db.select().from(aiIngestionJobs).orderBy(desc(aiIngestionJobs.createdAt));
    return db
      .select()
      .from(aiIngestionJobs)
      .where(eq(aiIngestionJobs.associationId, associationId))
      .orderBy(desc(aiIngestionJobs.createdAt));
  }

  async getAiIngestionMonitoring(windowDays = 14): Promise<{
    windowDays: number;
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    processingJobs: number;
    queuedJobs: number;
    providerFailureRecords: number;
    parserFallbackRecords: number;
    qualityWarningRecords: number;
    approvedRecords: number;
    rejectedRecords: number;
    previewRuns: number;
    appliedRuns: number;
    noopRuns: number;
    supersededRecords: number;
    supersededClauses: number;
    jobsWithSupersededOutputs: number;
    oldestSupersededAgeDays: number;
    failureRate: number;
    avgDurationMs: number;
    alerts: string[];
  }> {
    const since = new Date(Date.now() - Math.max(1, windowDays) * 24 * 60 * 60 * 1000);
    const jobs = await db
      .select()
      .from(aiIngestionJobs)
      .where(gte(aiIngestionJobs.createdAt, since))
      .orderBy(desc(aiIngestionJobs.createdAt));
    const [records, importRuns, clauses] = await Promise.all([
      db
        .select()
        .from(aiExtractedRecords)
        .where(gte(aiExtractedRecords.createdAt, since))
        .orderBy(desc(aiExtractedRecords.createdAt)),
      db
        .select()
        .from(aiIngestionImportRuns)
        .where(gte(aiIngestionImportRuns.createdAt, since))
        .orderBy(desc(aiIngestionImportRuns.createdAt)),
      db
        .select()
        .from(clauseRecords)
        .where(gte(clauseRecords.createdAt, since))
        .orderBy(desc(clauseRecords.createdAt)),
    ]);

    const totalJobs = jobs.length;
    const completedJobs = jobs.filter((job) => job.status === "completed").length;
    const failedJobs = jobs.filter((job) => job.status === "failed").length;
    const processingJobs = jobs.filter((job) => job.status === "processing").length;
    const queuedJobs = jobs.filter((job) => job.status === "queued").length;
    const providerFailureRecords = records.filter((record) => {
      const payload = record.payloadJson as Record<string, unknown> | null;
      const trace = payload?._ingestionTrace;
      return Boolean(trace && typeof trace === "object" && typeof (trace as Record<string, unknown>).fallbackReason === "string" && ((trace as Record<string, unknown>).fallbackReason as string).trim());
    }).length;
    const parserFallbackRecords = records.filter((record) => {
      const payload = record.payloadJson as Record<string, unknown> | null;
      const trace = payload?._ingestionTrace;
      return Boolean(trace && typeof trace === "object" && (trace as Record<string, unknown>).provider === "fallback");
    }).length;
    const qualityWarningRecords = records.filter((record) => {
      const payload = record.payloadJson as Record<string, unknown> | null;
      const quality = payload?.extractionQuality;
      return Boolean(quality && typeof quality === "object" && Array.isArray((quality as Record<string, unknown>).warnings) && ((quality as Record<string, unknown>).warnings as unknown[]).length > 0);
    }).length;
    const approvedRecords = records.filter((record) => record.reviewStatus === "approved").length;
    const rejectedRecords = records.filter((record) => record.reviewStatus === "rejected").length;
    const previewRuns = importRuns.filter((run) => run.mode === "preview").length;
    const appliedRuns = importRuns.filter((run) => run.runStatus === "applied").length;
    const noopRuns = importRuns.filter((run) => run.runStatus === "noop" || run.runStatus === "preview-noop").length;
    const supersededRecords = records.filter((record) => Boolean(record.supersededAt)).length;
    const supersededClauses = clauses.filter((clause) => Boolean(clause.supersededAt)).length;
    const jobsWithSupersededOutputs = new Set([
      ...records.filter((record) => Boolean(record.supersededAt)).map((record) => record.jobId),
      ...clauses.filter((clause) => Boolean(clause.supersededAt)).map((clause) => clause.ingestionJobId),
    ]).size;
    const oldestSupersededAt = [
      ...records.map((record) => record.supersededAt).filter((value): value is Date => value instanceof Date),
      ...clauses.map((clause) => clause.supersededAt).filter((value): value is Date => value instanceof Date),
    ].sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
    const oldestSupersededAgeDays = oldestSupersededAt
      ? Math.max(0, Math.floor((Date.now() - oldestSupersededAt.getTime()) / (24 * 60 * 60 * 1000)))
      : 0;
    const failureRate = totalJobs === 0 ? 0 : Number((failedJobs / totalJobs).toFixed(3));

    const durations = jobs
      .filter((job) => job.startedAt && job.completedAt)
      .map((job) => Math.max(0, new Date(job.completedAt!).getTime() - new Date(job.startedAt!).getTime()));
    const avgDurationMs = durations.length === 0 ? 0 : Math.round(durations.reduce((sum, ms) => sum + ms, 0) / durations.length);

    const alerts: string[] = [];
    if (totalJobs >= 5 && failureRate >= 0.2) alerts.push(`High failure rate: ${Math.round(failureRate * 100)}% in last ${windowDays}d.`);
    if (queuedJobs + processingJobs >= 10) alerts.push(`Ingestion backlog detected: ${queuedJobs} queued, ${processingJobs} processing.`);
    if (avgDurationMs >= 120000) alerts.push(`Slow processing detected: average ${Math.round(avgDurationMs / 1000)}s.`);
    if (parserFallbackRecords >= 5) alerts.push(`Parser fallback usage is elevated: ${parserFallbackRecords} records used fallback extraction.`);
    if (qualityWarningRecords >= 5) alerts.push(`Quality warnings are elevated: ${qualityWarningRecords} extracted records carry warnings.`);
    if (approvedRecords + rejectedRecords >= 5 && rejectedRecords > approvedRecords) alerts.push(`Review rejection rate is elevated: ${rejectedRecords} rejected vs ${approvedRecords} approved.`);
    if (previewRuns >= 5 && appliedRuns === 0) alerts.push("Previews are running but no imports are being applied.");
    if (jobsWithSupersededOutputs >= 3) alerts.push(`Superseded ingestion history is accumulating across ${jobsWithSupersededOutputs} jobs.`);
    if (oldestSupersededAgeDays >= 14) alerts.push(`Old superseded ingestion outputs are still retained after ${oldestSupersededAgeDays} days.`);
    if (alerts.length === 0) alerts.push("No active ingestion alerts.");

    return {
      windowDays,
      totalJobs,
      completedJobs,
      failedJobs,
      processingJobs,
      queuedJobs,
      providerFailureRecords,
      parserFallbackRecords,
      qualityWarningRecords,
      approvedRecords,
      rejectedRecords,
      previewRuns,
      appliedRuns,
      noopRuns,
      supersededRecords,
      supersededClauses,
      jobsWithSupersededOutputs,
      oldestSupersededAgeDays,
      failureRate,
      avgDurationMs,
      alerts,
    };
  }

  async createAiIngestionJob(data: InsertAiIngestionJob & { submittedBy?: string | null; sourceFileUrl?: string | null }): Promise<AiIngestionJob> {
    const [result] = await db
      .insert(aiIngestionJobs)
      .values({
        ...data,
        submittedBy: data.submittedBy ?? null,
        sourceFileUrl: data.sourceFileUrl ?? null,
        status: "queued",
        updatedAt: new Date(),
      })
      .returning();
    return result;
  }

  async createAiExtractedRecord(data: InsertAiExtractedRecord): Promise<AiExtractedRecord> {
    const [result] = await db
      .insert(aiExtractedRecords)
      .values({ ...data, reviewStatus: "pending-review", updatedAt: new Date() })
      .returning();
    return result;
  }

  async getAiExtractedRecords(jobId?: string, options?: { includeSuperseded?: boolean }): Promise<AiExtractedRecord[]> {
    const includeSuperseded = options?.includeSuperseded === true;
    const whereClause = jobId
      ? and(
          eq(aiExtractedRecords.jobId, jobId),
          ...(includeSuperseded ? [] : [isNull(aiExtractedRecords.supersededAt)]),
        )
      : (includeSuperseded ? undefined : isNull(aiExtractedRecords.supersededAt));

    const query = db.select().from(aiExtractedRecords);
    return whereClause
      ? query.where(whereClause).orderBy(desc(aiExtractedRecords.createdAt))
      : query.orderBy(desc(aiExtractedRecords.createdAt));
  }

  async getAiIngestionJobHistorySummary(jobId: string): Promise<{
    activeRecordCount: number;
    supersededRecordCount: number;
    activeClauseCount: number;
    supersededClauseCount: number;
    lastSupersededAt: Date | null;
  }> {
    const [records, clauses] = await Promise.all([
      db.select({ supersededAt: aiExtractedRecords.supersededAt }).from(aiExtractedRecords).where(eq(aiExtractedRecords.jobId, jobId)),
      db.select({ supersededAt: clauseRecords.supersededAt }).from(clauseRecords).where(eq(clauseRecords.ingestionJobId, jobId)),
    ]);

    const supersededTimestamps = [
      ...records.map((row) => row.supersededAt).filter((value): value is Date => value instanceof Date),
      ...clauses.map((row) => row.supersededAt).filter((value): value is Date => value instanceof Date),
    ];

    return {
      activeRecordCount: records.filter((row) => !row.supersededAt).length,
      supersededRecordCount: records.filter((row) => Boolean(row.supersededAt)).length,
      activeClauseCount: clauses.filter((row) => !row.supersededAt).length,
      supersededClauseCount: clauses.filter((row) => Boolean(row.supersededAt)).length,
      lastSupersededAt: supersededTimestamps.sort((a, b) => b.getTime() - a.getTime())[0] ?? null,
    };
  }

  async previewAiIngestionSupersededCleanup(retentionDays: number): Promise<{
    retentionDays: number;
    purgeableClauses: number;
    purgeableExtractedRecords: number;
    blockedExtractedRecords: number;
    oldestEligibleSupersededAt: Date | null;
    message: string;
  }> {
    const normalizedRetentionDays = Math.max(1, Math.min(365, Math.round(retentionDays)));
    const cutoff = new Date(Date.now() - normalizedRetentionDays * 24 * 60 * 60 * 1000);
    const [supersededRecords, supersededClauses, importRuns] = await Promise.all([
      db.select().from(aiExtractedRecords).where(and(isNotNull(aiExtractedRecords.supersededAt), lte(aiExtractedRecords.supersededAt, cutoff))),
      db.select().from(clauseRecords).where(and(isNotNull(clauseRecords.supersededAt), lte(clauseRecords.supersededAt, cutoff))),
      db.select({ extractedRecordId: aiIngestionImportRuns.extractedRecordId }).from(aiIngestionImportRuns),
    ]);

    const referencedExtractedRecordIds = new Set(importRuns.map((run) => run.extractedRecordId));
    const clauseReferencedExtractedRecordIds = new Set(
      supersededClauses
        .map((clause) => clause.extractedRecordId)
        .filter((value): value is string => Boolean(value)),
    );

    const purgeableExtractedRecords = supersededRecords.filter((record) => !referencedExtractedRecordIds.has(record.id) && !clauseReferencedExtractedRecordIds.has(record.id));
    const oldestEligibleSupersededAt = [...supersededClauses, ...purgeableExtractedRecords]
      .map((row) => row.supersededAt)
      .filter((value): value is Date => value instanceof Date)
      .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

    return {
      retentionDays: normalizedRetentionDays,
      purgeableClauses: supersededClauses.length,
      purgeableExtractedRecords: purgeableExtractedRecords.length,
      blockedExtractedRecords: supersededRecords.length - purgeableExtractedRecords.length,
      oldestEligibleSupersededAt,
      message: `Cleanup preview: ${supersededClauses.length} superseded clauses and ${purgeableExtractedRecords.length} superseded extracted records are purgeable after ${normalizedRetentionDays}d retention.`,
    };
  }

  async executeAiIngestionSupersededCleanup(retentionDays: number): Promise<{
    retentionDays: number;
    deletedClauses: number;
    deletedClauseTags: number;
    deletedSuggestedLinks: number;
    deletedExtractedRecords: number;
    blockedExtractedRecords: number;
    message: string;
  }> {
    const preview = await this.previewAiIngestionSupersededCleanup(retentionDays);
    const normalizedRetentionDays = preview.retentionDays;
    const cutoff = new Date(Date.now() - normalizedRetentionDays * 24 * 60 * 60 * 1000);
    const purgeableClauses = await db
      .select({ id: clauseRecords.id })
      .from(clauseRecords)
      .where(and(isNotNull(clauseRecords.supersededAt), lte(clauseRecords.supersededAt, cutoff)));
    const purgeableClauseIds = purgeableClauses.map((row) => row.id);

    let deletedClauseTags = 0;
    let deletedSuggestedLinks = 0;
    let deletedClauses = 0;
    if (purgeableClauseIds.length > 0) {
      deletedClauseTags = (await db.delete(clauseTags).where(inArray(clauseTags.clauseRecordId, purgeableClauseIds)).returning({ id: clauseTags.id })).length;
      deletedSuggestedLinks = (await db.delete(suggestedLinks).where(inArray(suggestedLinks.clauseRecordId, purgeableClauseIds)).returning({ id: suggestedLinks.id })).length;
      deletedClauses = (await db.delete(clauseRecords).where(inArray(clauseRecords.id, purgeableClauseIds)).returning({ id: clauseRecords.id })).length;
    }

    const supersededRecords = await db
      .select()
      .from(aiExtractedRecords)
      .where(and(isNotNull(aiExtractedRecords.supersededAt), lte(aiExtractedRecords.supersededAt, cutoff)));
    const [importRuns, remainingClauses] = await Promise.all([
      db.select({ extractedRecordId: aiIngestionImportRuns.extractedRecordId }).from(aiIngestionImportRuns),
      db.select({ extractedRecordId: clauseRecords.extractedRecordId }).from(clauseRecords).where(isNotNull(clauseRecords.extractedRecordId)),
    ]);
    const referencedExtractedRecordIds = new Set(importRuns.map((run) => run.extractedRecordId));
    const clauseReferencedExtractedRecordIds = new Set(
      remainingClauses
        .map((clause) => clause.extractedRecordId)
        .filter((value): value is string => Boolean(value)),
    );
    const purgeableExtractedRecordIds = supersededRecords
      .filter((record) => !referencedExtractedRecordIds.has(record.id) && !clauseReferencedExtractedRecordIds.has(record.id))
      .map((record) => record.id);
    const deletedExtractedRecords = purgeableExtractedRecordIds.length > 0
      ? (await db.delete(aiExtractedRecords).where(inArray(aiExtractedRecords.id, purgeableExtractedRecordIds)).returning({ id: aiExtractedRecords.id })).length
      : 0;

    return {
      retentionDays: normalizedRetentionDays,
      deletedClauses,
      deletedClauseTags,
      deletedSuggestedLinks,
      deletedExtractedRecords,
      blockedExtractedRecords: preview.blockedExtractedRecords,
      message: `Cleanup complete: deleted ${deletedClauses} superseded clauses and ${deletedExtractedRecords} superseded extracted records after ${normalizedRetentionDays}d retention.`,
    };
  }

  async getAiExtractedRecordById(id: string): Promise<AiExtractedRecord | undefined> {
    const [result] = await db.select().from(aiExtractedRecords).where(eq(aiExtractedRecords.id, id));
    return result;
  }

  async createAiIngestionImportRun(data: InsertAiIngestionImportRun): Promise<AiIngestionImportRun> {
    const [result] = await db
      .insert(aiIngestionImportRuns)
      .values({ ...data, updatedAt: new Date() })
      .returning();
    return result;
  }

  async getAiIngestionImportRuns(extractedRecordId: string): Promise<AiIngestionImportRun[]> {
    return db
      .select()
      .from(aiIngestionImportRuns)
      .where(eq(aiIngestionImportRuns.extractedRecordId, extractedRecordId))
      .orderBy(desc(aiIngestionImportRuns.createdAt));
  }

  async getBankStatementResolutionHints(recordId: string): Promise<BankStatementResolutionHint[]> {
    const [record] = await db.select().from(aiExtractedRecords).where(eq(aiExtractedRecords.id, recordId));
    if (!record || record.recordType !== "bank-statement" || !record.associationId) return [];

    const [associationUnits, associationOwnerships] = await Promise.all([
      this.getUnits(record.associationId),
      db
      .select()
      .from(ownerships)
      .where(and(
        eq(ownerships.endDate, null as any),
      )),
    ]);
    const bankCorrectionHints = await this.getAssociationBankStatementCorrectionHints(record.associationId);
    const associationUnitSet = new Set(associationUnits.map((u) => u.id));
    const scopedOwnerships = associationOwnerships.filter((own) => associationUnitSet.has(own.unitId));
    const unitById = new Map(associationUnits.map((u) => [u.id, u]));
    const personIds = Array.from(new Set(scopedOwnerships.map((own) => own.personId)));
    const scopedPersons = personIds.length > 0
      ? await db.select().from(persons).where(inArray(persons.id, personIds))
      : [];
    const unitNumbersByPerson = new Map<string, string[]>();
    for (const own of scopedOwnerships) {
      const unit = unitById.get(own.unitId);
      if (!unit) continue;
      const list = unitNumbersByPerson.get(own.personId) ?? [];
      if (!list.includes(unit.unitNumber)) list.push(unit.unitNumber);
      unitNumbersByPerson.set(own.personId, list);
    }

    const txns = extractBankStatementTransactions(record.payloadJson);
    const hints: BankStatementResolutionHint[] = [];

    for (let index = 0; index < txns.length; index += 1) {
      const txn = txns[index];
      const matchingCorrection = bankCorrectionHints.transactionMappings.find((hint) => {
        const txnDescription = normalizeBankTransactionDescription(txn.description);
        const hintDescription = normalizeBankTransactionDescription(hint.description);
        if (txnDescription && hintDescription && txnDescription === hintDescription) return true;
        if (txn.ownerEmail && hint.ownerEmail && txn.ownerEmail === hint.ownerEmail) return true;
        if (txn.ownerName && hint.ownerName && normalizeWhitespace(txn.ownerName).toLowerCase() === normalizeWhitespace(hint.ownerName).toLowerCase()) return true;
        return false;
      });
      const postedAt = txn.postedAt ? toDate(txn.postedAt) : null;
      const unit = txn.unitNumber
        ? associationUnits.find((row) => row.unitNumber.toUpperCase() === txn.unitNumber)
        : null;
      const person = scopedPersons.find((row) => {
        if (txn.ownerEmail && row.email?.toLowerCase() === txn.ownerEmail) return true;
        if (!txn.ownerName) return false;
        const parsed = parseName(txn.ownerName);
        if (!parsed) return false;
        return row.firstName.toLowerCase() === parsed.firstName.toLowerCase() && row.lastName.toLowerCase() === parsed.lastName.toLowerCase();
      });

      let reason: BankStatementResolutionHint["reason"] | null = null;
      if (txn.amount == null || !Number.isFinite(txn.amount)) reason = "missing-amount";
      else if (!postedAt) reason = "invalid-date";
      else if (!unit) reason = "unit-unresolved";
      else if (!person) reason = "person-unresolved";
      if (!reason) continue;

      const unitCandidates = associationUnits
        .filter((candidate) => {
          if (!txn.unitNumber) return true;
          return candidate.unitNumber.includes(txn.unitNumber) || txn.unitNumber.includes(candidate.unitNumber);
        })
        .sort((left, right) => {
          const leftScore = matchingCorrection?.unitNumber === left.unitNumber ? 1 : 0;
          const rightScore = matchingCorrection?.unitNumber === right.unitNumber ? 1 : 0;
          return rightScore - leftScore;
        })
        .slice(0, 8)
        .map((candidate) => ({ unitId: candidate.id, unitNumber: candidate.unitNumber }));

      const personCandidatesBase = scopedPersons
        .filter((candidate) => {
          if (txn.ownerEmail && candidate.email) {
            const local = txn.ownerEmail.split("@")[0];
            if (candidate.email.toLowerCase().includes(local)) return true;
          }
          if (txn.ownerName) {
            const token = txn.ownerName.toLowerCase().split(" ")[0];
            if (`${candidate.firstName} ${candidate.lastName}`.toLowerCase().includes(token)) return true;
          }
          if (unit) {
            const personUnits = unitNumbersByPerson.get(candidate.id) ?? [];
            if (personUnits.includes(unit.unitNumber)) return true;
          }
          return false;
        })
        .slice(0, 8);
      const personCandidates = (personCandidatesBase.length > 0 ? personCandidatesBase : scopedPersons.slice(0, 8))
        .sort((left, right) => {
          const leftName = `${left.firstName} ${left.lastName}`;
          const rightName = `${right.firstName} ${right.lastName}`;
          const leftScore = (matchingCorrection?.ownerEmail && left.email === matchingCorrection.ownerEmail ? 1 : 0)
            + (matchingCorrection?.ownerName && leftName.toLowerCase() === matchingCorrection.ownerName.toLowerCase() ? 1 : 0);
          const rightScore = (matchingCorrection?.ownerEmail && right.email === matchingCorrection.ownerEmail ? 1 : 0)
            + (matchingCorrection?.ownerName && rightName.toLowerCase() === matchingCorrection.ownerName.toLowerCase() ? 1 : 0);
          return rightScore - leftScore;
        })
        .map((candidate) => ({
          personId: candidate.id,
          name: `${candidate.firstName} ${candidate.lastName}`,
          email: candidate.email ?? null,
          unitNumbers: unitNumbersByPerson.get(candidate.id) ?? [],
        }));

      hints.push({
        txIndex: index,
        reason,
        transaction: txn,
        unitCandidates,
        personCandidates,
      });
    }

    return hints;
  }

  private async getAiIngestionSourceText(job: AiIngestionJob): Promise<string> {
    const pastedText = job.sourceText?.trim() ?? "";
    let fileText = "";

    if (job.sourceFileUrl) {
      const filename = job.sourceFileUrl.replace("/api/uploads/", "");
      const extension = path.extname(filename).toLowerCase();
      try {
        fileText = await extractUploadedText(path.resolve("uploads", filename), extension);
      } catch {
        fileText = "";
      }
    }

    if (pastedText && fileText) {
      return [
        "Pasted Input:",
        pastedText,
        "",
        "File-Derived Input:",
        fileText,
      ].join("\n");
    }

    return pastedText || fileText;
  }

  private async clearIngestionOutputs(jobId: string): Promise<void> {
    const now = new Date();
    await db
      .update(clauseRecords)
      .set({
        supersededAt: now,
        updatedAt: now,
      })
      .where(and(eq(clauseRecords.ingestionJobId, jobId), isNull(clauseRecords.supersededAt)));

    await db
      .update(aiExtractedRecords)
      .set({
        supersededAt: now,
        updatedAt: now,
      })
      .where(and(eq(aiExtractedRecords.jobId, jobId), isNull(aiExtractedRecords.supersededAt)));

    await db
      .update(aiIngestionExceptions)
      .set({
        supersededAt: now,
        updatedAt: now,
      })
      .where(and(eq(aiIngestionExceptions.ingestionJobId, jobId), isNull(aiIngestionExceptions.supersededAt)));
  }

  private async getAssociationOwnerRosterCorrectionHints(associationId: string): Promise<AssociationOwnerRosterCorrectionHints> {
    const rows = await db
      .select({ correctionKind: associationIngestionCorrectionMemory.correctionKind, payloadJson: associationIngestionCorrectionMemory.payloadJson })
      .from(associationIngestionCorrectionMemory)
      .where(and(
        eq(associationIngestionCorrectionMemory.associationId, associationId),
        eq(associationIngestionCorrectionMemory.recordType, "owner-roster"),
      ))
      .orderBy(desc(associationIngestionCorrectionMemory.updatedAt))
      .limit(60);

    if (rows.length === 0) {
      const records = await db
        .select({ payloadJson: aiExtractedRecords.payloadJson })
        .from(aiExtractedRecords)
        .where(and(
          eq(aiExtractedRecords.associationId, associationId),
          eq(aiExtractedRecords.recordType, "owner-roster"),
        ))
        .orderBy(desc(aiExtractedRecords.reviewedAt), desc(aiExtractedRecords.updatedAt))
        .limit(25);

      const fallbackCombined: AssociationOwnerRosterCorrectionHints = { unitRemaps: [], ownerNameFixes: [] };
      for (const record of records) {
        const hints = extractAssociationOwnerRosterCorrectionHintsFromPayload(record.payloadJson);
        fallbackCombined.unitRemaps.push(...hints.unitRemaps);
        fallbackCombined.ownerNameFixes.push(...hints.ownerNameFixes);
      }
      return {
        unitRemaps: dedupeBy(fallbackCombined.unitRemaps, (item) => `${item.fromUnitNumber}|${item.toUnitNumber}|${item.ownerText ?? ""}|${item.buildingAddress ?? ""}`).slice(0, 20),
        ownerNameFixes: dedupeBy(fallbackCombined.ownerNameFixes, (item) => `${item.unitNumber}|${item.displayName}|${item.firstName}|${item.lastName}`).slice(0, 30),
      };
    }

    const combined: AssociationOwnerRosterCorrectionHints = { unitRemaps: [], ownerNameFixes: [] };
    for (const row of rows) {
      if (row.correctionKind === "unit-remap" && row.payloadJson && typeof row.payloadJson === "object" && !Array.isArray(row.payloadJson)) {
        combined.unitRemaps.push(row.payloadJson as AssociationOwnerRosterCorrectionHints["unitRemaps"][number]);
      }
      if (row.correctionKind === "owner-name-fix" && row.payloadJson && typeof row.payloadJson === "object" && !Array.isArray(row.payloadJson)) {
        combined.ownerNameFixes.push(row.payloadJson as AssociationOwnerRosterCorrectionHints["ownerNameFixes"][number]);
      }
    }

    return {
      unitRemaps: dedupeBy(combined.unitRemaps, (item) => `${item.fromUnitNumber}|${item.toUnitNumber}|${item.ownerText ?? ""}|${item.buildingAddress ?? ""}`).slice(0, 20),
      ownerNameFixes: dedupeBy(combined.ownerNameFixes, (item) => `${item.unitNumber}|${item.displayName}|${item.firstName}|${item.lastName}`).slice(0, 30),
    };
  }

  private async getAssociationBankStatementCorrectionHints(associationId: string): Promise<AssociationBankStatementCorrectionHints> {
    const rows = await db
      .select({ payloadJson: associationIngestionCorrectionMemory.payloadJson })
      .from(associationIngestionCorrectionMemory)
      .where(and(
        eq(associationIngestionCorrectionMemory.associationId, associationId),
        eq(associationIngestionCorrectionMemory.recordType, "bank-statement"),
      ))
      .orderBy(desc(associationIngestionCorrectionMemory.updatedAt))
      .limit(40);

    if (rows.length === 0) {
      const records = await db
        .select({ payloadJson: aiExtractedRecords.payloadJson })
        .from(aiExtractedRecords)
        .where(and(
          eq(aiExtractedRecords.associationId, associationId),
          eq(aiExtractedRecords.recordType, "bank-statement"),
        ))
        .orderBy(desc(aiExtractedRecords.reviewedAt), desc(aiExtractedRecords.updatedAt))
        .limit(25);
      const fallbackMappings = records.flatMap((record) => extractAssociationBankStatementCorrectionHintsFromPayload(record.payloadJson).transactionMappings);
      return {
        transactionMappings: dedupeBy(fallbackMappings, (item) => `${normalizeBankTransactionDescription(item.description)}|${item.unitNumber ?? ""}|${item.ownerEmail ?? ""}|${item.ownerName ?? ""}`).slice(0, 40),
      };
    }

    const mappings = rows.flatMap((row) => {
      if (!row.payloadJson || typeof row.payloadJson !== "object" || Array.isArray(row.payloadJson)) return [];
      return [row.payloadJson as AssociationBankStatementCorrectionHints["transactionMappings"][number]];
    });
    return {
      transactionMappings: dedupeBy(mappings, (item) => `${normalizeBankTransactionDescription(item.description)}|${item.unitNumber ?? ""}|${item.ownerEmail ?? ""}|${item.ownerName ?? ""}`).slice(0, 40),
    };
  }

  private async upsertAssociationIngestionCorrectionMemoryRows(rows: InsertAssociationIngestionCorrectionMemory[]): Promise<void> {
    for (const row of rows) {
      const [existing] = await db
        .select()
        .from(associationIngestionCorrectionMemory)
        .where(and(
          eq(associationIngestionCorrectionMemory.associationId, row.associationId),
          eq(associationIngestionCorrectionMemory.recordType, row.recordType),
          eq(associationIngestionCorrectionMemory.correctionKey, row.correctionKey),
        ))
        .limit(1);

      if (existing) {
        await db
          .update(associationIngestionCorrectionMemory)
          .set({
            correctionKind: row.correctionKind,
            sourceExtractedRecordId: row.sourceExtractedRecordId ?? existing.sourceExtractedRecordId,
            payloadJson: row.payloadJson,
            updatedBy: row.updatedBy ?? existing.updatedBy,
            updatedAt: new Date(),
          })
          .where(eq(associationIngestionCorrectionMemory.id, existing.id));
        continue;
      }

      await db.insert(associationIngestionCorrectionMemory).values(row);
    }
  }

  private async syncCorrectionMemoryForExtractedRecord(record: AiExtractedRecord, payload: unknown, actorEmail?: string | null): Promise<void> {
    if (!record.associationId) return;
    const rows = [
      ...buildOwnerRosterCorrectionMemoryEntries(record.associationId, record.id, payload, actorEmail),
      ...buildBankStatementCorrectionMemoryEntries(record.associationId, record.id, payload, actorEmail),
    ];
    if (rows.length === 0) return;
    await this.upsertAssociationIngestionCorrectionMemoryRows(rows);
  }

  private async syncAiIngestionExceptionsForRecord(record: AiExtractedRecord, payload: unknown): Promise<void> {
    if (!record.associationId) return;
    const bankHints = record.recordType === "bank-statement"
      ? await this.getBankStatementResolutionHints(record.id)
      : [];
    const rows = buildAiIngestionExceptionRowsFromPayload({
      ingestionJobId: record.jobId,
      extractedRecordId: record.id,
      associationId: record.associationId,
      recordType: record.recordType,
      payload,
      bankHints,
    });
    const now = new Date();
    await db
      .update(aiIngestionExceptions)
      .set({ supersededAt: now, updatedAt: now })
      .where(and(eq(aiIngestionExceptions.extractedRecordId, record.id), isNull(aiIngestionExceptions.supersededAt)));
    if (rows.length > 0) {
      await db.insert(aiIngestionExceptions).values(rows);
    }
  }

  private async buildAssociationIngestionContext(associationId: string): Promise<AssociationIngestionContext> {
    const [associationRecord, associationUnits, associationBuildings, associationPersons, activeOwnerships, contacts] = await Promise.all([
      db.select({ name: associations.name }).from(associations).where(eq(associations.id, associationId)).limit(1),
      this.getUnits(associationId),
      this.getBuildings(associationId),
      this.getPersons(associationId),
      db.select().from(ownerships).where(eq(ownerships.endDate, null as any)),
      db.select().from(personContactPoints).where(eq(personContactPoints.associationId, associationId)),
    ]);

    const unitIdSet = new Set(associationUnits.map((unit) => unit.id));
    const personById = new Map(associationPersons.map((person) => [person.id, person]));
    const missingOwnedPersonIds = activeOwnerships
      .filter((ownership) => unitIdSet.has(ownership.unitId) && !personById.has(ownership.personId))
      .map((ownership) => ownership.personId);
    if (missingOwnedPersonIds.length > 0) {
      const additionalPersons = await db.select().from(persons).where(inArray(persons.id, Array.from(new Set(missingOwnedPersonIds))));
      additionalPersons.forEach((person) => personById.set(person.id, person));
    }
    const ownerNames = new Set<string>();

    activeOwnerships
      .filter((ownership) => unitIdSet.has(ownership.unitId))
      .forEach((ownership) => {
        const person = personById.get(ownership.personId);
        if (!person) return;
        ownerNames.add(`${person.firstName} ${person.lastName}`);
      });

    contacts.forEach((contact) => {
      const person = personById.get(contact.personId);
      if (!person) return;
      ownerNames.add(`${person.firstName} ${person.lastName}`);
    });

    return {
      knownUnitNumbers: associationUnits.map((unit) => unit.unitNumber.toUpperCase()).slice(0, 200),
      knownBuildings: associationBuildings
        .map((building) => building.name || building.address)
        .filter((value): value is string => Boolean(value))
        .slice(0, 50),
      knownOwnerNames: Array.from(ownerNames).slice(0, 100),
      associationName: associationRecord[0]?.name ?? null,
      ownerRosterCorrectionHints: await this.getAssociationOwnerRosterCorrectionHints(associationId),
      bankStatementCorrectionHints: await this.getAssociationBankStatementCorrectionHints(associationId),
    };
  }

  private async extractWithAi(
    job: AiIngestionJob,
    sourceText: string,
    classification: IngestionClassification,
    associationContext?: AssociationIngestionContext,
  ): Promise<AiIngestionExtractionResult | null> {
    const apiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
    if (!apiKey || !sourceText.trim()) return null;

    const model = process.env.OPENAI_INGESTION_MODEL || "gpt-4o-mini";
    const sourceSample = sourceText.slice(0, 15000);
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content: [{
              type: "input_text",
              text: [
                "You extract structured records from HOA and condo operations documents.",
                "Return only JSON matching the schema.",
                "Prefer owner-roster when the content contains owners, unit numbers, emails, phones, or mailing addresses.",
                "Use contact-roster for contact lists that do not reliably include unit ownership mapping.",
                "For owner-roster payloadJson, use { title, itemCount, items }.",
                "Each owner-roster item must include unitNumber, firstName, lastName, email, phone, mailingAddress, ownershipPercentage, startDate.",
                "Preserve one item per source row whenever possible. Do not collapse multiple owners into one record.",
                "Copy phone numbers, emails, unit identifiers, and mailing addresses exactly when present.",
                "If a value is absent, use null instead of guessing.",
                "For invoice-draft payloadJson, include vendorName, invoiceNumber, amount, invoiceDate, dueDate, notes, status.",
                "Use bank-statement for statement-style transaction exports.",
                "Only emit clauses for bylaw/governance-style text.",
                "Use contextNotes as operator intent and prioritization guidance.",
                "Use classificationHint as routing guidance. If confidence is low, include document-metadata with warning context.",
                "Use ownerRosterCorrectionHints from associationContext as examples of prior operator corrections for this association.",
                "If owner-roster extraction presents a unit alias or malformed owner name that matches a prior corrected pattern, prefer the corrected interpretation.",
                "Use bankStatementCorrectionHints from associationContext as examples of prior transaction mapping corrections for this association.",
                "If a bank transaction description or owner hint matches a prior corrected mapping, prefer the corrected unit/person interpretation.",
              ].join(" "),
            }],
          },
          {
            role: "user",
            content: [{
              type: "input_text",
              text: JSON.stringify({
                associationId: job.associationId,
                sourceFilename: job.sourceFilename,
                contextNotes: job.contextNotes ?? null,
                classificationHint: classification,
                associationContext: associationContext ?? null,
                sourceText: sourceSample,
              }),
            }],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "ai_ingestion_result",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                records: {
                  type: "array",
                  items: {
                    oneOf: [
                      {
                        type: "object",
                        additionalProperties: false,
                        properties: {
                          recordType: { type: "string", const: "owner-roster" },
                          confidenceScore: { anyOf: [{ type: "number" }, { type: "null" }] },
                          payloadJson: {
                            type: "object",
                            additionalProperties: false,
                            properties: {
                              title: { type: "string" },
                              itemCount: { type: "number" },
                              items: {
                                type: "array",
                                items: {
                                  type: "object",
                                  additionalProperties: false,
                                  properties: {
                                    unitNumber: { type: "string" },
                                    firstName: { type: "string" },
                                    lastName: { type: "string" },
                                    email: { anyOf: [{ type: "string" }, { type: "null" }] },
                                    phone: { anyOf: [{ type: "string" }, { type: "null" }] },
                                    mailingAddress: { anyOf: [{ type: "string" }, { type: "null" }] },
                                    ownershipPercentage: { anyOf: [{ type: "number" }, { type: "null" }] },
                                    startDate: { anyOf: [{ type: "string" }, { type: "null" }] },
                                  },
                                  required: ["unitNumber", "firstName", "lastName", "email", "phone", "mailingAddress", "ownershipPercentage", "startDate"],
                                },
                              },
                            },
                            required: ["title", "itemCount", "items"],
                          },
                        },
                        required: ["recordType", "confidenceScore", "payloadJson"],
                      },
                      {
                        type: "object",
                        additionalProperties: false,
                        properties: {
                          recordType: { type: "string", const: "contact-roster" },
                          confidenceScore: { anyOf: [{ type: "number" }, { type: "null" }] },
                          payloadJson: {
                            type: "object",
                            additionalProperties: false,
                            properties: {
                              title: { type: "string" },
                              itemCount: { type: "number" },
                              items: {
                                type: "array",
                                items: {
                                  type: "object",
                                  additionalProperties: false,
                                  properties: {
                                    firstName: { type: "string" },
                                    lastName: { type: "string" },
                                    email: { anyOf: [{ type: "string" }, { type: "null" }] },
                                    phone: { anyOf: [{ type: "string" }, { type: "null" }] },
                                    mailingAddress: { anyOf: [{ type: "string" }, { type: "null" }] },
                                  },
                                  required: ["firstName", "lastName", "email", "phone", "mailingAddress"],
                                },
                              },
                            },
                            required: ["title", "itemCount", "items"],
                          },
                        },
                        required: ["recordType", "confidenceScore", "payloadJson"],
                      },
                      {
                        type: "object",
                        additionalProperties: false,
                        properties: {
                          recordType: { type: "string", const: "invoice-draft" },
                          confidenceScore: { anyOf: [{ type: "number" }, { type: "null" }] },
                          payloadJson: {
                            type: "object",
                            additionalProperties: true,
                            properties: {
                              vendorName: { type: "string" },
                              invoiceNumber: { anyOf: [{ type: "string" }, { type: "null" }] },
                              amount: { anyOf: [{ type: "number" }, { type: "null" }] },
                              invoiceDate: { anyOf: [{ type: "string" }, { type: "null" }] },
                              dueDate: { anyOf: [{ type: "string" }, { type: "null" }] },
                              notes: { anyOf: [{ type: "string" }, { type: "null" }] },
                              status: { anyOf: [{ type: "string" }, { type: "null" }] },
                            },
                            required: ["vendorName", "invoiceNumber", "amount", "invoiceDate", "dueDate", "notes", "status"],
                          },
                        },
                        required: ["recordType", "confidenceScore", "payloadJson"],
                      },
                      {
                        type: "object",
                        additionalProperties: false,
                        properties: {
                          recordType: { type: "string", const: "bank-statement" },
                          confidenceScore: { anyOf: [{ type: "number" }, { type: "null" }] },
                          payloadJson: {
                            type: "object",
                            additionalProperties: true,
                            properties: {
                              statementPeriod: { anyOf: [{ type: "string" }, { type: "null" }] },
                              transactions: {
                                type: "array",
                                items: {
                                  type: "object",
                                  additionalProperties: false,
                                  properties: {
                                    unitNumber: { anyOf: [{ type: "string" }, { type: "null" }] },
                                    ownerEmail: { anyOf: [{ type: "string" }, { type: "null" }] },
                                    ownerName: { anyOf: [{ type: "string" }, { type: "null" }] },
                                    amount: { anyOf: [{ type: "number" }, { type: "string" }, { type: "null" }] },
                                    postedAt: { anyOf: [{ type: "string" }, { type: "null" }] },
                                    description: { anyOf: [{ type: "string" }, { type: "null" }] },
                                    entryType: { anyOf: [{ type: "string" }, { type: "null" }] },
                                  },
                                  required: ["unitNumber", "ownerEmail", "ownerName", "amount", "postedAt", "description", "entryType"],
                                },
                              },
                            },
                            required: ["statementPeriod", "transactions"],
                          },
                        },
                        required: ["recordType", "confidenceScore", "payloadJson"],
                      },
                      {
                        type: "object",
                        additionalProperties: false,
                        properties: {
                          recordType: {
                            type: "string",
                            enum: ["meeting-notes", "document-metadata"],
                          },
                          confidenceScore: { anyOf: [{ type: "number" }, { type: "null" }] },
                          payloadJson: { type: "object", additionalProperties: true },
                        },
                        required: ["recordType", "confidenceScore", "payloadJson"],
                      },
                    ],
                  },
                },
                clauses: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      title: { type: "string" },
                      clauseText: { type: "string" },
                      confidenceScore: { anyOf: [{ type: "number" }, { type: "null" }] },
                      tags: {
                        type: "array",
                        items: { type: "string" },
                      },
                      suggestedLinks: {
                        type: "array",
                        items: {
                          type: "object",
                          additionalProperties: false,
                          properties: {
                            entityType: { type: "string" },
                            entityId: { type: "string" },
                            confidenceScore: { anyOf: [{ type: "number" }, { type: "null" }] },
                          },
                          required: ["entityType", "entityId", "confidenceScore"],
                        },
                      },
                    },
                    required: ["title", "clauseText", "confidenceScore", "tags", "suggestedLinks"],
                  },
                },
              },
              required: ["records", "clauses"],
            },
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`AI extraction failed with status ${response.status}`);
    }

    const data = await response.json();
    const content = Array.isArray(data.output)
      ? data.output.flatMap((item: any) => Array.isArray(item.content) ? item.content : [])
      : [];
    const textChunk = content.find((item: any) => typeof item.text === "string");
    if (!textChunk?.text) {
      throw new Error("AI extraction returned no structured output");
    }

    return JSON.parse(textChunk.text) as AiIngestionExtractionResult;
  }

  async processAiIngestionJob(jobId: string): Promise<AiIngestionJob> {
    const [job] = await db.select().from(aiIngestionJobs).where(eq(aiIngestionJobs.id, jobId));
    if (!job) throw new Error("Ingestion job not found");
    if (job.status === "processing") throw new Error("Ingestion job is already processing");

    await db
      .update(aiIngestionJobs)
      .set({ status: "processing", startedAt: new Date(), completedAt: null, errorMessage: null, updatedAt: new Date() })
      .where(eq(aiIngestionJobs.id, jobId));

    try {
      await this.clearIngestionOutputs(job.id);
      const sourceText = await this.getAiIngestionSourceText(job);
      if (!sourceText.trim()) {
        throw new Error("No parsable source text found. Provide pasted text or upload a pdf/docx/xlsx/txt/md/csv/tsv/json/log/html/xml/eml file.");
      }
      const classification = classifyIngestionSource(job, sourceText);
      const associationContext = job.associationId
        ? await this.buildAssociationIngestionContext(job.associationId)
        : {
            knownUnitNumbers: [],
            knownBuildings: [],
            knownOwnerNames: [],
            associationName: null,
            ownerRosterCorrectionHints: { unitRemaps: [], ownerNameFixes: [] },
            bankStatementCorrectionHints: { transactionMappings: [] },
          };
      let extraction = null as AiIngestionExtractionResult | null;
      const aiConfigured = Boolean(process.env.OPENAI_API_KEY || process.env.AI_API_KEY);
      const aiModel = aiConfigured ? (process.env.OPENAI_INGESTION_MODEL || "gpt-4o-mini") : null;
      let trace: IngestionTrace = {
        provider: aiConfigured ? "fallback" : "fallback",
        model: aiModel,
        fallbackReason: aiConfigured ? "AI extraction did not return a result." : "AI is not configured; using fallback extraction.",
      };

      try {
        extraction = await this.extractWithAi(job, sourceText, classification, associationContext);
        if (extraction) {
          trace = {
            provider: "openai",
            model: aiModel,
            fallbackReason: null,
          };
        }
      } catch (error) {
        console.error("AI ingestion extraction failed, falling back to heuristics:", error);
        trace = {
          provider: "fallback",
          model: aiModel,
          fallbackReason: error instanceof Error ? error.message : "Unknown AI extraction failure.",
        };
      }

      const resolvedExtractionBase = applyClassificationGuardrails(
        enrichExtractionWithFallback(job, sourceText, extraction ?? { records: [], clauses: [] }, associationContext),
        classification,
      );
      const resolvedExtraction: AiIngestionExtractionResult = {
        records: resolvedExtractionBase.records.map((record) => ({
          ...record,
          payloadJson: attachIngestionTrace(
            attachDestinationRouting(
              record.recordType,
              attachCanonicalEntities(record.recordType, record.payloadJson, associationContext),
            ),
            trace,
          ),
        })),
        clauses: resolvedExtractionBase.clauses,
      };

      const createdRecordsByType = new Map<AiIngestionExtractionRecord["recordType"], AiExtractedRecord[]>();
      const createdExtractedRecords: AiExtractedRecord[] = [];
      for (const record of resolvedExtraction.records) {
        const created = await this.createAiExtractedRecord({
          jobId: job.id,
          associationId: job.associationId ?? null,
          recordType: record.recordType,
          payloadJson: record.payloadJson,
          confidenceScore: record.confidenceScore ?? null,
        });
        createdExtractedRecords.push(created);
        const bucket = createdRecordsByType.get(record.recordType) ?? [];
        bucket.push(created);
        createdRecordsByType.set(record.recordType, bucket);
        await this.syncCorrectionMemoryForExtractedRecord(created, record.payloadJson, job.submittedBy ?? null);
      }

      for (const record of createdExtractedRecords) {
        await this.syncAiIngestionExceptionsForRecord(record, record.payloadJson);
      }

      if (resolvedExtraction.clauses.length > 0 && createdExtractedRecords.length === 0) {
        const created = await this.createAiExtractedRecord({
          jobId: job.id,
          associationId: job.associationId ?? null,
          recordType: "document-metadata",
          payloadJson: attachIngestionTrace(attachDestinationRouting("document-metadata", {
            title: job.sourceFilename || "Clause Source Document",
            tags: ["clause-source-trace"],
            snippet: sourceText.slice(0, 400),
          }), trace),
          confidenceScore: null,
        });
        createdExtractedRecords.push(created);
        createdRecordsByType.set("document-metadata", [created]);
      }

      const clauseTraceRecord = createdRecordsByType.get("document-metadata")?.[0]
        ?? createdRecordsByType.get("meeting-notes")?.[0]
        ?? createdExtractedRecords[0]
        ?? null;

      for (const clauseInput of resolvedExtraction.clauses) {
        const clause = await this.createClauseRecord({
          ingestionJobId: job.id,
          extractedRecordId: clauseTraceRecord?.id ?? null,
          associationId: job.associationId ?? null,
          sourceDocumentId: job.sourceDocumentId ?? null,
          title: clauseInput.title,
          clauseText: clauseInput.clauseText,
          confidenceScore: clauseInput.confidenceScore ?? null,
        });

        for (const tag of clauseInput.tags) {
          await this.createClauseTag({ clauseRecordId: clause.id, tag });
        }
        for (const link of clauseInput.suggestedLinks) {
          await this.createSuggestedLink({
            clauseRecordId: clause.id,
            entityType: link.entityType,
            entityId: link.entityId,
            confidenceScore: link.confidenceScore ?? null,
          });
        }
      }

      const [updated] = await db
        .update(aiIngestionJobs)
        .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
        .where(eq(aiIngestionJobs.id, job.id))
        .returning();
      return updated;
    } catch (error: any) {
      const [failed] = await db
        .update(aiIngestionJobs)
        .set({ status: "failed", errorMessage: error.message || "Processing failed", updatedAt: new Date() })
        .where(eq(aiIngestionJobs.id, job.id))
        .returning();
      return failed;
    }
  }

  async reviewAiExtractedRecord(id: string, payload: { reviewStatus: "approved" | "rejected"; payloadJson?: unknown; reviewedBy?: string | null }): Promise<AiExtractedRecord | undefined> {
    const [existing] = await db.select().from(aiExtractedRecords).where(eq(aiExtractedRecords.id, id));
    if (!existing) return undefined;
    const reviewContext = existing.associationId ? await this.buildAssociationIngestionContext(existing.associationId) : undefined;
    const nextPayload = payload.payloadJson && typeof payload.payloadJson === "object" && !Array.isArray(payload.payloadJson)
      ? attachDestinationRouting(
          existing.recordType as AiIngestionExtractionRecord["recordType"],
          attachCanonicalEntities(existing.recordType as AiIngestionExtractionRecord["recordType"], payload.payloadJson as Record<string, unknown>, reviewContext),
        )
      : payload.payloadJson;
    const [result] = await db
      .update(aiExtractedRecords)
      .set({
        reviewStatus: payload.reviewStatus,
        payloadJson: nextPayload ?? undefined,
        reviewedBy: payload.reviewedBy ?? null,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(aiExtractedRecords.id, id))
      .returning();
    if (result) {
      await this.syncCorrectionMemoryForExtractedRecord(result, nextPayload ?? result.payloadJson, payload.reviewedBy ?? null);
      await this.syncAiIngestionExceptionsForRecord(result, nextPayload ?? result.payloadJson);
    }
    return result;
  }

  private emptyImportSummary(targetModule = "none", message = "No import executed", dryRun = false): AiIngestionImportSummary {
    return {
      imported: false,
      dryRun,
      targetModule,
      sourceRecordId: undefined,
      sourceRecordType: undefined,
      sourceJobId: undefined,
      destinationPlan: null,
      routeMatched: false,
      unresolvedExceptionCount: 0,
      blockingExceptionCount: 0,
      unresolvedExceptions: [],
      createdPersons: 0,
      updatedPersons: 0,
      createdUnits: 0,
      createdOwnerships: 0,
      createdVendorInvoices: 0,
      createdOwnerLedgerEntries: 0,
      createdVendorInvoiceIds: [],
      createdOwnerLedgerEntryIds: [],
      skippedRows: 0,
      message,
      details: [],
    };
  }

  private async importOwnerRosterRecord(
    associationId: string,
    payloadJson: unknown,
    actorEmail?: string,
    mode: "preview" | "commit" = "commit",
  ): Promise<AiIngestionImportSummary> {
    const dryRun = mode === "preview";
    const canonicalRows = extractCanonicalOwnerImportRows(payloadJson);
    const normalizedEntries = extractNormalizedOwnerRosterEntries(payloadJson);
    const items = normalizedEntries.length > 0
      ? buildOwnerRosterItemsFromNormalizedEntries(normalizedEntries)
      : extractOwnerRosterItems(payloadJson);
    const ownerRows = canonicalRows.length > 0
      ? canonicalRows
      : items.map((item) => ({
          unitNumber: item.unitNumber,
          buildingAddress: item.mailingAddress,
          firstName: item.firstName,
          lastName: item.lastName,
          displayName: `${item.firstName} ${item.lastName}`,
          mailingAddress: item.mailingAddress,
          ownershipPercentage: item.ownershipPercentage,
          relationshipNotes: [] as string[],
          contactPoints: dedupeBy([
            item.email ? { channel: "email" as const, value: item.email, isPrimary: true } : null,
            item.phone ? { channel: "phone" as const, value: item.phone, isPrimary: true } : null,
          ].filter((value): value is { channel: "email" | "phone"; value: string; isPrimary: boolean } => Boolean(value)), (value) => `${value.channel}|${value.value}`),
        }));
    if (!ownerRows.length && !normalizedEntries.length) {
      return this.emptyImportSummary("owners", "No owner roster rows were eligible for import.", dryRun);
    }

    const [associationUnits, allPersons, allContactPoints, activeOwnerships] = await Promise.all([
      this.getUnits(associationId),
      this.getPersons(associationId),
      db.select().from(personContactPoints).where(eq(personContactPoints.associationId, associationId)),
      db.select().from(ownerships).where(eq(ownerships.endDate, null as any)),
    ]);

    const unitIdSet = new Set(associationUnits.map((unit) => unit.id));
    const scopedOwnerships = activeOwnerships.filter((ownership) => unitIdSet.has(ownership.unitId));
    const unresolvedExceptions = extractCanonicalIngestionGraph(payloadJson)
      ? extractCanonicalIngestionGraph(payloadJson)!.entities
          .filter((entity) => entity.entityType === "exception")
          .map((entity) => ({
            kind: String(entity.attributes.kind ?? "unit-unresolved") as OwnerRosterUnresolvedException["kind"],
            unitNumber: String(entity.attributes.unitNumber ?? entity.entityKey),
            message: String(entity.attributes.message ?? "Canonical exception requires review."),
            blocking: Boolean(entity.attributes.blocking),
          }))
      : buildOwnerRosterUnresolvedExceptions(
          normalizedEntries.length > 0
            ? normalizedEntries
            : ownerRows.map((row) => ({
                buildingAddress: row.buildingAddress,
                unitNumber: row.unitNumber,
                ownerText: row.displayName,
                ownerCandidates: [{
                  displayName: row.displayName,
                  firstName: row.firstName,
                  lastName: row.lastName,
                }],
                emails: row.contactPoints.filter((contact) => contact.channel === "email").map((contact) => contact.value),
                phones: row.contactPoints.filter((contact) => contact.channel === "phone").map((contact) => contact.value),
                notes: row.relationshipNotes,
              })),
          associationUnits.map((unit) => unit.unitNumber),
        );
    if (unresolvedExceptions.some((exception) => exception.blocking) && !dryRun) {
      return {
        ...this.emptyImportSummary("owners", `Owner roster import blocked by unresolved exceptions. ${unresolvedExceptions.map((item) => item.message).join(" ")}`, false),
        unresolvedExceptionCount: unresolvedExceptions.length,
        blockingExceptionCount: unresolvedExceptions.filter((exception) => exception.blocking).length,
        unresolvedExceptions,
        skippedRows: unresolvedExceptions.length,
        details: unresolvedExceptions.map((exception) => ({
          module: "owners",
          action: "skip" as const,
          entityKey: exception.unitNumber,
          reason: exception.message,
        })),
      };
    }

    let createdPersons = 0;
    let updatedPersons = 0;
    let createdUnits = 0;
    let createdOwnerships = 0;
    let skippedRows = 0;
    const details: AiIngestionImportSummary["details"] = [];
    for (const exception of unresolvedExceptions) {
      details.push({
        module: "owners",
        action: "skip",
        entityKey: exception.unitNumber,
        reason: exception.message,
      });
    }

    for (const row of ownerRows) {
      try {
        let unit = associationUnits.find((existingUnit) => existingUnit.unitNumber.toUpperCase() === row.unitNumber.toUpperCase());
        if (!unit) {
          if (!dryRun) {
            unit = await this.createUnit({
              associationId,
              unitNumber: row.unitNumber,
              building: null,
              squareFootage: null,
            }, actorEmail);
            associationUnits.push(unit);
          }
          createdUnits += 1;
          if (!unit) {
            skippedRows += 1;
            details.push({
              module: "owners",
              action: "skip",
              entityKey: `${row.unitNumber}:${row.firstName} ${row.lastName}`,
              reason: "Unit creation required in commit mode; preview cannot provide unit id.",
            });
            continue;
          }
      details.push({
        module: "units",
        action: "create",
        entityKey: row.unitNumber,
        reason: dryRun ? "Unit would be created." : "Unit created.",
        beforeJson: null,
        afterJson: { associationId, unitNumber: row.unitNumber },
      });
        }

        const lowerFirst = row.firstName.toLowerCase();
        const lowerLast = row.lastName.toLowerCase();
        const candidateEmails = dedupeBy(
          row.contactPoints.filter((contact) => contact.channel === "email").map((contact) => contact.value),
          (value) => value.toLowerCase(),
        );
        const candidatePhones = dedupeBy(
          row.contactPoints.filter((contact) => contact.channel === "phone").map((contact) => contact.value),
          (value) => value,
        );
        const unitOwnershipMatches = unit
          ? scopedOwnerships
              .filter((ownership) => ownership.unitId === unit.id)
              .map((ownership) => allPersons.find((personRow) => personRow.id === ownership.personId))
              .filter((value): value is Person => Boolean(value))
          : [];
        const exactNameMatch = allPersons.find((personRow) => personRow.firstName.toLowerCase() === lowerFirst && personRow.lastName.toLowerCase() === lowerLast);
        const exactEmailAndNameMatch = candidateEmails.length > 0
          ? allPersons.find((personRow) => candidateEmails.includes(personRow.email?.toLowerCase() ?? "") && personRow.firstName.toLowerCase() === lowerFirst && personRow.lastName.toLowerCase() === lowerLast)
          : undefined;
        const contactPointMatch = allContactPoints.find((contact) => (
          (contact.channel === "email" && candidateEmails.includes(contact.normalizedValue))
          || (contact.channel === "phone" && candidatePhones.includes(contact.normalizedValue))
        ));
        const unitOwnerNameMatch = unitOwnershipMatches.find((personRow) => personRow.firstName.toLowerCase() === lowerFirst && personRow.lastName.toLowerCase() === lowerLast);
        let person = exactEmailAndNameMatch
          ?? unitOwnerNameMatch
          ?? (contactPointMatch ? allPersons.find((personRow) => personRow.id === contactPointMatch.personId) : undefined)
          ?? exactNameMatch;
        if (!person) {
          if (!dryRun) {
            person = await this.createPerson({
              associationId,
              firstName: row.firstName,
              lastName: row.lastName,
              email: candidateEmails[0] ?? null,
              phone: candidatePhones[0] ?? null,
              mailingAddress: row.mailingAddress,
            }, actorEmail);
            allPersons.push(person);
          }
          createdPersons += 1;
          if (!person) {
            skippedRows += 1;
            details.push({
              module: "persons",
              action: "skip",
              entityKey: `${row.firstName} ${row.lastName}`,
              reason: "Person creation required in commit mode; preview cannot provide person id.",
            });
            continue;
          }
          if (!dryRun) {
            await this.syncPersonContactPoints(person.id, associationId, [
              ...candidateEmails.map((value, index) => ({
                channel: "email" as const,
                value,
                isPrimary: index === 0,
                source: "ai-ingestion-owner-roster",
                notes: row.relationshipNotes.join(" ") || null,
              })),
              ...candidatePhones.map((value, index) => ({
                channel: "phone" as const,
                value,
                isPrimary: index === 0,
                source: "ai-ingestion-owner-roster",
                notes: row.relationshipNotes.join(" ") || null,
              })),
            ]);
          }
          details.push({
            module: "persons",
            action: "create",
            entityKey: `${row.firstName} ${row.lastName}`,
            reason: dryRun ? "Person would be created." : "Person created.",
            beforeJson: null,
            afterJson: {
              firstName: row.firstName,
              lastName: row.lastName,
              email: candidateEmails[0] ?? null,
              phone: candidatePhones[0] ?? null,
              mailingAddress: row.mailingAddress,
              notes: row.relationshipNotes.length ? row.relationshipNotes : undefined,
            },
          });
        } else {
          const patch: Partial<InsertPerson> = {};
          if (!person.email && candidateEmails[0]) patch.email = candidateEmails[0];
          if (!person.phone && candidatePhones[0]) patch.phone = candidatePhones[0];
          if (!person.mailingAddress && row.mailingAddress) patch.mailingAddress = row.mailingAddress;
          if (Object.keys(patch).length > 0) {
            if (!dryRun) {
              person = (await this.updatePerson(person.id, patch, actorEmail)) ?? person;
            }
            updatedPersons += 1;
            details.push({
              module: "persons",
              action: "update",
              entityKey: `${row.firstName} ${row.lastName}`,
              reason: dryRun ? "Person would be updated with missing fields." : "Person updated with missing fields.",
              beforeJson: {
                email: person.email,
                phone: person.phone,
                mailingAddress: person.mailingAddress,
              },
              afterJson: {
                email: patch.email ?? person.email,
                phone: patch.phone ?? person.phone,
                mailingAddress: patch.mailingAddress ?? person.mailingAddress,
              },
            });
          }
          if (!dryRun) {
            const primaryEmail = patch.email ?? person?.email ?? candidateEmails[0] ?? null;
            const primaryPhone = patch.phone ?? person?.phone ?? candidatePhones[0] ?? null;
            await this.syncPersonContactPoints(person.id, associationId, [
              ...candidateEmails.map((value, index) => ({
                channel: "email" as const,
                value,
                isPrimary: value === primaryEmail,
                source: "ai-ingestion-owner-roster",
                notes: row.relationshipNotes.join(" ") || null,
              })),
              ...candidatePhones.map((value, index) => ({
                channel: "phone" as const,
                value,
                isPrimary: value === primaryPhone,
                source: "ai-ingestion-owner-roster",
                notes: row.relationshipNotes.join(" ") || null,
              })),
            ]);
          }
        }

        if (!person) {
          skippedRows += 1;
          details.push({
            module: "owners",
            action: "skip",
            entityKey: `${row.unitNumber}:${row.firstName} ${row.lastName}`,
            reason: "Person was not available after import processing.",
          });
          continue;
        }

        const existingOwnerships = await db
          .select()
          .from(ownerships)
          .where(and(eq(ownerships.unitId, unit.id), eq(ownerships.personId, person.id), eq(ownerships.endDate, null as any)));
        if (existingOwnerships.length > 0) {
          skippedRows += 1;
          details.push({
            module: "owners",
            action: "skip",
            entityKey: `${row.unitNumber}:${row.firstName} ${row.lastName}`,
            reason: "Active ownership already exists for unit/person.",
            suggestions: row.relationshipNotes.length ? row.relationshipNotes : undefined,
          });
          continue;
        }

        if (!dryRun) {
          await this.createOwnership({
            unitId: unit.id,
            personId: person.id,
            ownershipPercentage: row.ownershipPercentage ?? 100,
            startDate: new Date(),
            endDate: null,
            relationshipNotesJson: row.relationshipNotes.length > 0 ? row.relationshipNotes : null,
          }, actorEmail);
        }
        createdOwnerships += 1;
        details.push({
          module: "owners",
          action: "create",
          entityKey: `${row.unitNumber}:${row.firstName} ${row.lastName}`,
          reason: dryRun ? "Ownership would be created." : "Ownership created.",
          beforeJson: null,
          afterJson: {
            ownershipPercentage: row.ownershipPercentage ?? 100,
            startDate: null,
            notes: row.relationshipNotes.length ? row.relationshipNotes : undefined,
          },
        });
      } catch {
        skippedRows += 1;
        details.push({
          module: "owners",
          action: "skip",
          entityKey: `${row.unitNumber}:${row.firstName} ${row.lastName}`,
          reason: "Row failed validation or import execution.",
        });
      }
    }

    const imported = createdOwnerships > 0 || createdPersons > 0 || createdUnits > 0 || updatedPersons > 0;
    return {
      imported,
      dryRun,
      targetModule: "owners",
      unresolvedExceptionCount: unresolvedExceptions.length,
      blockingExceptionCount: unresolvedExceptions.filter((exception) => exception.blocking).length,
      unresolvedExceptions,
      createdPersons,
      updatedPersons,
      createdUnits,
      createdOwnerships,
      createdVendorInvoices: 0,
      createdOwnerLedgerEntries: 0,
      createdVendorInvoiceIds: [],
      createdOwnerLedgerEntryIds: [],
      skippedRows,
      message: imported
        ? `${dryRun ? "Preview" : "Owners import"} complete: ${createdOwnerships} ownerships, ${createdPersons} people, ${createdUnits} units ${dryRun ? "would be" : ""} created.`
        : "No owner changes were applied.",
      details,
    };
  }

  private async importContactRosterRecord(
    associationId: string | null,
    payloadJson: unknown,
    actorEmail?: string,
    mode: "preview" | "commit" = "commit",
  ): Promise<AiIngestionImportSummary> {
    const dryRun = mode === "preview";
    const canonicalRows = extractCanonicalContactImportRows(payloadJson);
    const items = extractContactRosterItems(payloadJson);
    const rows = canonicalRows.length > 0
      ? canonicalRows
      : items.map((item) => ({
          firstName: item.firstName,
          lastName: item.lastName,
          mailingAddress: item.mailingAddress,
          contactPoints: dedupeBy([
            item.email ? { channel: "email" as const, value: item.email, isPrimary: true } : null,
            item.phone ? { channel: "phone" as const, value: item.phone, isPrimary: true } : null,
          ].filter((value): value is { channel: "email" | "phone"; value: string; isPrimary: boolean } => Boolean(value)), (value) => `${value.channel}|${value.value}`),
        }));
    if (!rows.length) {
      return this.emptyImportSummary("persons", "No contact rows were eligible for import.", dryRun);
    }

    const [allPersons, allContactPoints] = await Promise.all([
      associationId ? this.getPersons(associationId) : db.select().from(persons),
      associationId ? db.select().from(personContactPoints).where(eq(personContactPoints.associationId, associationId)) : db.select().from(personContactPoints),
    ]);
    let createdPersons = 0;
    let updatedPersons = 0;
    let skippedRows = 0;
    const details: AiIngestionImportSummary["details"] = [];

    for (const row of rows) {
      try {
        const emails = row.contactPoints.filter((contact) => contact.channel === "email").map((contact) => contact.value);
        const phones = row.contactPoints.filter((contact) => contact.channel === "phone").map((contact) => contact.value);
        const contactPointMatch = allContactPoints.find((contact) => (
          (contact.channel === "email" && emails.includes(contact.normalizedValue))
          || (contact.channel === "phone" && phones.includes(contact.normalizedValue))
        ));
        const personMatch = (contactPointMatch
          ? allPersons.find((person) => person.id === contactPointMatch.personId)
          : undefined)
          ?? allPersons.find((person) => {
            if (emails.length > 0 && emails.includes(person.email?.toLowerCase() ?? "")) return true;
            return person.firstName.toLowerCase() === row.firstName.toLowerCase() && person.lastName.toLowerCase() === row.lastName.toLowerCase();
          });

        if (!personMatch) {
          if (!dryRun) {
            const created = await this.createPerson({
              associationId,
              firstName: row.firstName,
              lastName: row.lastName,
              email: emails[0] ?? null,
              phone: phones[0] ?? null,
              mailingAddress: row.mailingAddress,
            }, actorEmail);
            allPersons.push(created);
            await this.syncPersonContactPoints(
              created.id,
              associationId,
              row.contactPoints.map((contact) => ({
                channel: contact.channel,
                value: contact.value,
                isPrimary: contact.isPrimary,
                source: "ai-ingestion-contact-roster",
              })),
            );
          }
          createdPersons += 1;
          details.push({
            module: "persons",
            action: "create",
            entityKey: `${row.firstName} ${row.lastName}`,
            reason: dryRun ? "Person would be created." : "Person created.",
            beforeJson: null,
            afterJson: {
              firstName: row.firstName,
              lastName: row.lastName,
              email: emails[0] ?? null,
              phone: phones[0] ?? null,
              mailingAddress: row.mailingAddress,
            },
          });
          continue;
        }

        const patch: Partial<InsertPerson> = {};
        if (!personMatch.email && emails[0]) patch.email = emails[0];
        if (!personMatch.phone && phones[0]) patch.phone = phones[0];
        if (!personMatch.mailingAddress && row.mailingAddress) patch.mailingAddress = row.mailingAddress;
        if (Object.keys(patch).length > 0) {
          if (!dryRun) {
            await this.updatePerson(personMatch.id, patch, actorEmail);
            await this.syncPersonContactPoints(
              personMatch.id,
              associationId,
              row.contactPoints.map((contact) => ({
                channel: contact.channel,
                value: contact.value,
                isPrimary: contact.isPrimary,
                source: "ai-ingestion-contact-roster",
              })),
            );
          }
          updatedPersons += 1;
          details.push({
            module: "persons",
            action: "update",
            entityKey: `${row.firstName} ${row.lastName}`,
            reason: dryRun ? "Person would be updated with missing fields." : "Person updated with missing fields.",
            beforeJson: {
              email: personMatch.email,
              phone: personMatch.phone,
              mailingAddress: personMatch.mailingAddress,
            },
            afterJson: {
              email: patch.email ?? personMatch.email,
              phone: patch.phone ?? personMatch.phone,
              mailingAddress: patch.mailingAddress ?? personMatch.mailingAddress,
            },
          });
        } else {
          if (!dryRun) {
            await this.syncPersonContactPoints(
              personMatch.id,
              associationId,
              row.contactPoints.map((contact) => ({
                channel: contact.channel,
                value: contact.value,
                isPrimary: contact.isPrimary,
                source: "ai-ingestion-contact-roster",
              })),
            );
          }
          skippedRows += 1;
          details.push({
            module: "persons",
            action: "skip",
            entityKey: `${row.firstName} ${row.lastName}`,
            reason: "No changes required.",
          });
        }
      } catch {
        skippedRows += 1;
        details.push({
          module: "persons",
          action: "skip",
          entityKey: `${row.firstName} ${row.lastName}`,
          reason: "Row failed validation or import execution.",
        });
      }
    }

    const imported = createdPersons > 0 || updatedPersons > 0;
    return {
      imported,
      dryRun,
      targetModule: "persons",
      createdPersons,
      updatedPersons,
      createdUnits: 0,
      createdOwnerships: 0,
      createdVendorInvoices: 0,
      createdOwnerLedgerEntries: 0,
      createdVendorInvoiceIds: [],
      createdOwnerLedgerEntryIds: [],
      skippedRows,
      message: imported
        ? `${dryRun ? "Preview" : "Contacts import"} complete: ${createdPersons} people ${dryRun ? "would be" : ""} created, ${updatedPersons} ${dryRun ? "would be" : ""} updated.`
        : "No contact changes were applied.",
      details,
    };
  }

  private async importInvoiceDraftRecord(
    associationId: string,
    payloadJson: unknown,
    mode: "preview" | "commit" = "commit",
  ): Promise<AiIngestionImportSummary> {
    const dryRun = mode === "preview";
    if (!payloadJson || typeof payloadJson !== "object") {
      return this.emptyImportSummary("financial-invoices", "Invoice payload is missing.", dryRun);
    }

    const payload = payloadJson as Record<string, unknown>;
    const vendorName = typeof payload.vendorName === "string" ? normalizeWhitespace(payload.vendorName) : "";
    const amount = toNumber(payload.amount ?? payload.amountText);
    const invoiceDate = toDate(payload.invoiceDate) ?? new Date();
    const dueDate = toDate(payload.dueDate);
    const invoiceNumber = typeof payload.invoiceNumber === "string" && payload.invoiceNumber.trim() ? payload.invoiceNumber.trim() : null;
    const notes = typeof payload.notes === "string" ? payload.notes : typeof payload.rawSnippet === "string" ? payload.rawSnippet : null;
    const statusInput = typeof payload.status === "string" ? payload.status : "received";
    const status = ["draft", "received", "approved", "paid", "void"].includes(statusInput) ? statusInput as InsertVendorInvoice["status"] : "received";

    if (!vendorName || amount == null) {
      return this.emptyImportSummary("financial-invoices", "Invoice payload is missing vendorName or amount.", dryRun);
    }

    const duplicateByNumber = invoiceNumber
      ? await db
          .select({ id: vendorInvoices.id })
          .from(vendorInvoices)
          .where(and(
            eq(vendorInvoices.associationId, associationId),
            eq(vendorInvoices.vendorName, vendorName),
            eq(vendorInvoices.invoiceNumber, invoiceNumber),
          ))
      : [];

    if (duplicateByNumber.length > 0) {
      return {
        ...this.emptyImportSummary("financial-invoices", "Duplicate invoice detected by vendor + invoice number. Import skipped.", dryRun),
        skippedRows: 1,
        details: [{
          module: "financial-invoices",
          action: "skip",
          entityKey: `${vendorName}:${invoiceNumber}`,
          reason: "Duplicate by vendor and invoice number.",
        }],
      };
    }

    const duplicateBySignature = await db
      .select({ id: vendorInvoices.id })
      .from(vendorInvoices)
      .where(and(
        eq(vendorInvoices.associationId, associationId),
        eq(vendorInvoices.vendorName, vendorName),
        eq(vendorInvoices.amount, amount),
        eq(vendorInvoices.invoiceDate, invoiceDate),
      ));
    if (duplicateBySignature.length > 0) {
      return {
        ...this.emptyImportSummary("financial-invoices", "Potential duplicate invoice detected by vendor + amount + date. Import skipped.", dryRun),
        skippedRows: 1,
        details: [{
          module: "financial-invoices",
          action: "skip",
          entityKey: `${vendorName}:${amount}:${invoiceDate.toISOString().slice(0, 10)}`,
          reason: "Potential duplicate by vendor, amount, and invoice date.",
        }],
      };
    }

    let createdInvoiceId: string | null = null;
    if (!dryRun) {
      const created = await this.createVendorInvoice({
        associationId,
        vendorName,
        invoiceNumber,
        invoiceDate,
        dueDate,
        amount,
        status,
        accountId: null,
        categoryId: null,
        notes,
      });
      createdInvoiceId = created.id;
    }

    return {
      imported: true,
      dryRun,
      targetModule: "financial-invoices",
      createdPersons: 0,
      updatedPersons: 0,
      createdUnits: 0,
      createdOwnerships: 0,
      createdVendorInvoices: 1,
      createdOwnerLedgerEntries: 0,
      createdVendorInvoiceIds: createdInvoiceId ? [createdInvoiceId] : [],
      createdOwnerLedgerEntryIds: [],
      skippedRows: 0,
      message: dryRun ? "Preview complete: 1 invoice would be imported into Financial Invoices." : "Invoice imported into Financial Invoices.",
        details: [{
          module: "financial-invoices",
          action: "create",
          entityKey: `${vendorName}:${invoiceNumber || "no-number"}`,
          reason: dryRun ? "Invoice would be created." : "Invoice created.",
          beforeJson: null,
          afterJson: {
            vendorName,
            invoiceNumber,
            amount,
            invoiceDate,
            dueDate,
            status,
          },
        }],
    };
  }

  private async importBankStatementRecord(
    record: AiExtractedRecord,
    mode: "preview" | "commit" = "commit",
  ): Promise<AiIngestionImportSummary> {
    const dryRun = mode === "preview";
    if (!record.associationId) {
      return this.emptyImportSummary("owner-ledger", "Association is required for bank statement import.", dryRun);
    }
    const canonicalTransactions = extractCanonicalBankTransactions(record.payloadJson);
    const { transactions, invalidCount } = normalizeBankStatementTransactions(
      canonicalTransactions.length > 0 ? { transactions: canonicalTransactions } : record.payloadJson,
    );
    if (!transactions.length) {
      return this.emptyImportSummary("owner-ledger", "No valid bank statement transactions found in payload.", dryRun);
    }

    const [associationUnits, allPersons, allContactPoints, activeOwnerships] = await Promise.all([
      this.getUnits(record.associationId),
      this.getPersons(record.associationId),
      db.select().from(personContactPoints).where(eq(personContactPoints.associationId, record.associationId)),
      db.select().from(ownerships).where(eq(ownerships.endDate, null as any)),
    ]);
    const unitIdSet = new Set(associationUnits.map((unit) => unit.id));
    const scopedOwnerships = activeOwnerships.filter((ownership) => unitIdSet.has(ownership.unitId));

    let createdOwnerLedgerEntries = 0;
    const createdOwnerLedgerEntryIds: string[] = [];
    let skippedRows = invalidCount;
    const details: AiIngestionImportSummary["details"] = [];

    for (let index = 0; index < transactions.length; index += 1) {
      const txn = transactions[index];
      if (txn.amount == null || !txn.postedAt) {
        skippedRows += 1;
        details.push({
          module: "owner-ledger",
          action: "skip",
          entityKey: `txn-${index + 1}`,
          reason: "Missing amount or postedAt.",
        });
        continue;
      }

      const unit = txn.unitNumber
        ? associationUnits.find((row) => row.unitNumber.toUpperCase() === txn.unitNumber)
        : null;
      if (!unit) {
        skippedRows += 1;
        const unitHints = associationUnits
          .map((row) => row.unitNumber)
          .filter((unitNumber) => (txn.unitNumber ? unitNumber.includes(txn.unitNumber.slice(0, 2)) : false))
          .slice(0, 3);
        details.push({
          module: "owner-ledger",
          action: "skip",
          entityKey: `txn-${index + 1}`,
          reason: "Unit could not be resolved for transaction.",
          suggestions: unitHints.length ? unitHints.map((value) => `Try unit ${value}`) : undefined,
        });
        continue;
      }

      const person = allPersons.find((row) => {
        if (txn.ownerEmail && row.email?.toLowerCase() === txn.ownerEmail) return true;
        if (txn.ownerEmail && allContactPoints.some((contact) => contact.personId === row.id && contact.channel === "email" && contact.normalizedValue === txn.ownerEmail)) return true;
        if (!txn.ownerName) return false;
        const parsed = parseName(txn.ownerName);
        if (!parsed) return false;
        const sameName = row.firstName.toLowerCase() === parsed.firstName.toLowerCase() && row.lastName.toLowerCase() === parsed.lastName.toLowerCase();
        if (!sameName) return false;
        if (!unit) return true;
        return scopedOwnerships.some((ownership) => ownership.unitId === unit.id && ownership.personId === row.id);
      });
      if (!person) {
        skippedRows += 1;
        const personHints = allPersons
          .filter((row) => {
            if (txn.ownerEmail && row.email) return row.email.toLowerCase().includes(txn.ownerEmail.split("@")[0]);
            if (txn.ownerName) {
              const lower = txn.ownerName.toLowerCase();
              return `${row.firstName} ${row.lastName}`.toLowerCase().includes(lower.split(" ")[0]);
            }
            return false;
          })
          .slice(0, 3)
          .map((row) => `${row.firstName} ${row.lastName}${row.email ? ` <${row.email}>` : ""}`);
        details.push({
          module: "owner-ledger",
          action: "skip",
          entityKey: `txn-${index + 1}`,
          reason: "Person could not be resolved for transaction.",
          suggestions: personHints.length ? personHints : undefined,
        });
        continue;
      }

      const postedAt = toDate(txn.postedAt);
      if (!postedAt) {
        skippedRows += 1;
        details.push({
          module: "owner-ledger",
          action: "skip",
          entityKey: `txn-${index + 1}`,
          reason: "Invalid postedAt date.",
        });
        continue;
      }

      const referenceId = `${record.id}:${index}`;
      const [existing] = await db
        .select({ id: ownerLedgerEntries.id })
        .from(ownerLedgerEntries)
        .where(and(
          eq(ownerLedgerEntries.referenceType, "ai-bank-statement"),
          eq(ownerLedgerEntries.referenceId, referenceId),
        ));
      if (existing) {
        skippedRows += 1;
        details.push({
          module: "owner-ledger",
          action: "skip",
          entityKey: referenceId,
          reason: "Transaction already imported.",
        });
        continue;
      }

      if (!dryRun) {
        const created = await this.createOwnerLedgerEntry({
          associationId: record.associationId,
          unitId: unit.id,
          personId: person.id,
          entryType: txn.entryType,
          amount: Math.abs(txn.amount),
          postedAt,
          description: txn.description ?? "Imported from bank statement",
          referenceType: "ai-bank-statement",
          referenceId,
        });
        createdOwnerLedgerEntryIds.push(created.id);
      }
      createdOwnerLedgerEntries += 1;
        details.push({
          module: "owner-ledger",
          action: "create",
          entityKey: referenceId,
          reason: dryRun ? "Owner ledger entry would be created." : "Owner ledger entry created.",
          beforeJson: null,
          afterJson: {
            associationId: record.associationId,
            unitId: unit.id,
            personId: person.id,
            entryType: txn.entryType,
            amount: Math.abs(txn.amount),
            postedAt,
            description: txn.description ?? "Imported from bank statement",
          },
        });
    }

    const imported = createdOwnerLedgerEntries > 0;
    return {
      imported,
      dryRun,
      targetModule: "owner-ledger",
      createdPersons: 0,
      updatedPersons: 0,
      createdUnits: 0,
      createdOwnerships: 0,
      createdVendorInvoices: 0,
      createdOwnerLedgerEntries,
      createdVendorInvoiceIds: [],
      createdOwnerLedgerEntryIds,
      skippedRows,
      message: imported
        ? `${dryRun ? "Preview" : "Bank statement import"} complete: ${createdOwnerLedgerEntries} owner-ledger entries ${dryRun ? "would be" : ""} created.`
        : "No owner-ledger entries were eligible for import from bank statement payload.",
      details,
    };
  }

  private inferDocumentTypeFromMetadata(payloadJson: unknown, fallbackTitle?: string | null): string {
    const payload = asRecord(payloadJson);
    const explicit = stringField(payload.documentType) || stringField(payload.category);
    if (explicit) return explicit;

    const terms = [
      fallbackTitle ?? "",
      stringField(payload.title) ?? "",
      stringField(payload.summary) ?? "",
      stringField(payload.snippet) ?? "",
      ...stringListField(payload.tags),
    ].join(" ").toLowerCase();

    if (/minutes|meeting|agenda|board packet/.test(terms)) return "Meeting Minutes";
    if (/bylaw|rule|policy|covenant|compliance/.test(terms)) return "Bylaws";
    if (/financial|budget|invoice|statement|reserve|audit/.test(terms)) return "Financial Report";
    if (/insurance|certificate|coverage/.test(terms)) return "Insurance";
    if (/legal|lawsuit|claim|contract/.test(terms)) return "Legal";
    if (/maintenance|repair|inspection|vendor/.test(terms)) return "Maintenance";
    return "Other";
  }

  private async importDocumentMetadataRecord(
    record: AiExtractedRecord,
    payloadJson: unknown,
    actorEmail?: string,
    mode: "preview" | "commit" = "commit",
  ): Promise<AiIngestionImportSummary> {
    const dryRun = mode === "preview";
    const [job] = await db.select().from(aiIngestionJobs).where(eq(aiIngestionJobs.id, record.jobId));
    if (!job || !record.associationId) {
      return this.emptyImportSummary("documents", "Association and ingestion job are required for document metadata import.", dryRun);
    }

    const payload = asRecord(payloadJson);
    const title = stringField(payload.title) || job.sourceFilename || "Imported Document";
    const documentType = this.inferDocumentTypeFromMetadata(payloadJson, job.sourceFilename);
    const snippet = stringField(payload.summary) || stringField(payload.snippet);
    const tags = stringListField(payload.tags);
    const details: AiIngestionImportSummary["details"] = [];

    if (job.sourceDocumentId) {
      const [existing] = await db.select().from(documents).where(eq(documents.id, job.sourceDocumentId));
      if (!existing) {
        return this.emptyImportSummary("documents", "Linked repository document was not found for metadata import.", dryRun);
      }

      const updates: Partial<InsertDocument> = {};
      if (title.trim() !== existing.title) updates.title = title.trim();
      if (documentType.trim() && documentType !== existing.documentType) updates.documentType = documentType;

      if (Object.keys(updates).length === 0) {
        return {
          ...this.emptyImportSummary("documents", "Document metadata matches the linked repository document. No update needed.", dryRun),
          details: [{
            module: "documents",
            action: "skip",
            entityKey: existing.id,
            reason: "Linked repository document already reflects the imported metadata.",
            beforeJson: existing,
            afterJson: {
              ...existing,
              inferredTags: tags,
              snippet,
            },
          }],
        };
      }

      const afterJson = {
        ...existing,
        ...updates,
        inferredTags: tags,
        snippet,
      };
      details.push({
        module: "documents",
        action: "update",
        entityKey: existing.id,
        reason: dryRun ? "Linked repository document would be updated from imported metadata." : "Linked repository document updated from imported metadata.",
        beforeJson: existing,
        afterJson,
      });

      if (!dryRun) {
        await this.updateDocument(existing.id, updates, actorEmail || "system");
      }

      return {
        ...this.emptyImportSummary("documents", dryRun ? "Preview complete: linked repository document would be updated." : "Document metadata import complete: linked repository document updated.", dryRun),
        imported: true,
        details,
      };
    }

    if (!job.sourceFileUrl) {
      return this.emptyImportSummary("documents", "No source file is attached to this ingestion job, so a repository document cannot be created.", dryRun);
    }

    const draftDocument: InsertDocument = {
      associationId: record.associationId,
      title,
      fileUrl: job.sourceFileUrl,
      documentType,
      isPortalVisible: 0,
      portalAudience: "owner",
      uploadedBy: actorEmail || job.submittedBy || null,
    };
    details.push({
      module: "documents",
      action: "create",
      entityKey: job.sourceFileUrl,
      reason: dryRun ? "Repository document would be created from ingestion source metadata." : "Repository document created from ingestion source metadata.",
      beforeJson: null,
      afterJson: {
        ...draftDocument,
        inferredTags: tags,
        snippet,
      },
    });

    if (!dryRun) {
      await this.createDocument(draftDocument, actorEmail || "system");
    }

    return {
      ...this.emptyImportSummary("documents", dryRun ? "Preview complete: repository document would be created." : "Document metadata import complete: repository document created.", dryRun),
      imported: true,
      details,
    };
  }

  private async importMeetingNotesRecord(
    record: AiExtractedRecord,
    payloadJson: unknown,
    actorEmail?: string,
    mode: "preview" | "commit" = "commit",
  ): Promise<AiIngestionImportSummary> {
    const dryRun = mode === "preview";
    const [job] = await db.select().from(aiIngestionJobs).where(eq(aiIngestionJobs.id, record.jobId));
    if (!job || !record.associationId) {
      return this.emptyImportSummary("governance", "Association and ingestion job are required for meeting-note import.", dryRun);
    }

    const payload = asRecord(payloadJson);
    const title = stringField(payload.title) || job.sourceFilename || "Imported Meeting Notes";
    const meetingType = stringField(payload.meetingType) || stringField(payload.suggestedMeetingType) || "board";
    const scheduledAt = normalizeLooseDate(payload.scheduledAt) || normalizeLooseDate(payload.meetingDate) || job.createdAt;
    const location = stringField(payload.location);
    const agenda = textBlockField(payload.agenda);
    const summary = stringField(payload.summary) || stringField(payload.snippet);
    const noteContent = textBlockField(payload.notes) || textBlockField(payload.minutes) || summary;
    if (!noteContent) {
      return this.emptyImportSummary("governance", "Meeting notes payload is missing importable note content.", dryRun);
    }

    const existingMeetings = await this.getGovernanceMeetings(record.associationId);
    const normalizedTitle = title.trim().toLowerCase();
    const sameDayMeeting = existingMeetings.find((meeting) => {
      const meetingTitle = meeting.title.trim().toLowerCase();
      return meetingTitle === normalizedTitle
        && meeting.meetingType === meetingType
        && meeting.scheduledAt.toDateString() === scheduledAt.toDateString();
    });

    let meetingId = sameDayMeeting?.id ?? "";
    const details: AiIngestionImportSummary["details"] = [];

    if (!sameDayMeeting) {
      const draftMeeting: InsertGovernanceMeeting = {
        associationId: record.associationId,
        meetingType,
        title,
        scheduledAt,
        location: location ?? null,
        status: "completed",
        agenda: agenda ?? null,
        notes: noteContent,
        summaryText: summary ?? null,
        summaryStatus: "draft",
      };
      details.push({
        module: "governance",
        action: "create",
        entityKey: title,
        reason: dryRun ? "Governance meeting would be created from imported meeting notes." : "Governance meeting created from imported meeting notes.",
        beforeJson: null,
        afterJson: draftMeeting,
      });
      if (!dryRun) {
        const createdMeeting = await this.createGovernanceMeeting(draftMeeting);
        meetingId = createdMeeting.id;
      }
    } else {
      meetingId = sameDayMeeting.id;
      const updatePatch: Partial<InsertGovernanceMeeting> = {};
      if (!sameDayMeeting.location && location) updatePatch.location = location;
      if (!sameDayMeeting.agenda && agenda) updatePatch.agenda = agenda;
      if (!sameDayMeeting.notes && noteContent) updatePatch.notes = noteContent;
      if (!sameDayMeeting.summaryText && summary) updatePatch.summaryText = summary;
      if (Object.keys(updatePatch).length > 0) {
        details.push({
          module: "governance",
          action: "update",
          entityKey: sameDayMeeting.id,
          reason: dryRun ? "Matched governance meeting would be enriched with imported notes." : "Matched governance meeting enriched with imported notes.",
          beforeJson: sameDayMeeting,
          afterJson: { ...sameDayMeeting, ...updatePatch },
        });
        if (!dryRun) {
          await this.updateGovernanceMeeting(sameDayMeeting.id, updatePatch);
        }
      }
    }

    const existingNotes = sameDayMeeting && !dryRun ? await this.getMeetingNotes(sameDayMeeting.id) : [];
    const duplicateNote = existingNotes.find((note) => note.noteType === "ai-import" && note.content.trim() === noteContent.trim());
    if (duplicateNote) {
      details.push({
        module: "governance",
        action: "skip",
        entityKey: duplicateNote.id,
        reason: "Matching AI-import note already exists for the target meeting.",
        beforeJson: duplicateNote,
        afterJson: duplicateNote,
      });
      return {
        ...this.emptyImportSummary("governance", "Matching meeting note already exists. No new note created.", dryRun),
        imported: details.some((detail) => detail.action !== "skip"),
        details,
      };
    }

    const noteDraft: InsertMeetingNote = {
      meetingId: meetingId || "preview-meeting",
      noteType: "ai-import",
      content: noteContent,
      createdBy: actorEmail || job.submittedBy || "system",
    };
    details.push({
      module: "governance",
      action: "create",
      entityKey: meetingId || title,
      reason: dryRun ? "Meeting note would be created from imported notes payload." : "Meeting note created from imported notes payload.",
      beforeJson: null,
      afterJson: noteDraft,
    });

    if (!dryRun) {
      await this.createMeetingNote(noteDraft);
    }

    return {
      ...this.emptyImportSummary("governance", dryRun ? "Preview complete: governance meeting import planned." : "Meeting notes import complete.", dryRun),
      imported: true,
      details,
    };
  }

  async importApprovedAiExtractedRecord(
    id: string,
    actorEmail?: string,
    options?: { mode?: "preview" | "commit"; payloadOverride?: unknown },
  ): Promise<AiIngestionImportSummary> {
    const mode = options?.mode === "preview" ? "preview" : "commit";
    const [record] = await db.select().from(aiExtractedRecords).where(eq(aiExtractedRecords.id, id));
    if (!record) {
      return this.emptyImportSummary("none", "Record not found.", mode === "preview");
    }
    if (mode === "commit" && record.reviewStatus !== "approved") {
      return this.emptyImportSummary("none", "Record not approved for commit import.", false);
    }
    if (!record.associationId) {
      return this.emptyImportSummary("none", "Association is required for import.", mode === "preview");
    }
    const overridePayload = options?.payloadOverride;
    const payload = overridePayload && typeof overridePayload === "object" && !Array.isArray(overridePayload)
      ? attachDestinationRouting(
          record.recordType as AiIngestionExtractionRecord["recordType"],
          attachCanonicalEntities(
            record.recordType as AiIngestionExtractionRecord["recordType"],
            overridePayload as Record<string, unknown>,
            await this.buildAssociationIngestionContext(record.associationId),
          ),
        )
      : (overridePayload ?? record.payloadJson);
    const destinationPlan = extractDestinationRoutePlan(payload);
    if (record.recordType === "owner-roster" && mode === "commit") {
      const quality = getOwnerRosterQuality(payload);
      if (quality && (quality.score < 0.7 || quality.warnings.some((warning) => /corrupted|invalid unit|incomplete owner names/i.test(warning)))) {
        return this.emptyImportSummary(
          "owners",
          `Owner roster import blocked by quality gate. ${quality.warnings.join(" ") || "Extraction quality is below threshold."}`,
          false,
        );
      }
    }
    let summary: AiIngestionImportSummary;
    const routeModule = destinationPlan?.primaryModule ?? null;
    switch (routeModule ?? record.recordType) {
      case "owners":
      case "owner-roster":
        summary = await this.importOwnerRosterRecord(record.associationId, payload, actorEmail, mode);
        break;
      case "persons":
      case "contact-roster":
        summary = await this.importContactRosterRecord(record.associationId, payload, actorEmail, mode);
        break;
      case "financial-invoices":
      case "invoice-draft":
        summary = await this.importInvoiceDraftRecord(record.associationId, payload, mode);
        break;
      case "owner-ledger":
      case "bank-statement":
        summary = await this.importBankStatementRecord({ ...record, payloadJson: payload }, mode);
        break;
      case "governance":
      case "meeting-notes":
        summary = await this.importMeetingNotesRecord(record, payload, actorEmail, mode);
        break;
      case "metadata":
      case "document-metadata":
        summary = await this.importDocumentMetadataRecord(record, payload, actorEmail, mode);
        break;
      default:
        summary = this.emptyImportSummary(
          "none",
          routeModule
            ? `No importer configured for routed module '${routeModule}'.`
            : `No importer configured for recordType '${record.recordType}'.`,
          mode === "preview",
        );
        break;
    }

    return {
      ...summary,
      destinationPlan,
      routeMatched: destinationPlan ? summary.targetModule === destinationPlan.primaryModule : false,
      sourceRecordId: record.id,
      sourceRecordType: record.recordType,
      sourceJobId: record.jobId,
    };
  }

  async rollbackAiIngestionImportRun(runId: string, actorEmail?: string): Promise<{
    rolledBack: boolean;
    deletedVendorInvoices: number;
    deletedOwnerLedgerEntries: number;
    message: string;
  }> {
    const [run] = await db.select().from(aiIngestionImportRuns).where(eq(aiIngestionImportRuns.id, runId));
    if (!run) {
      return { rolledBack: false, deletedVendorInvoices: 0, deletedOwnerLedgerEntries: 0, message: "Import run not found." };
    }
    if (run.mode !== "commit") {
      return { rolledBack: false, deletedVendorInvoices: 0, deletedOwnerLedgerEntries: 0, message: "Only commit runs can be rolled back." };
    }
    if (run.rolledBackAt) {
      return { rolledBack: false, deletedVendorInvoices: 0, deletedOwnerLedgerEntries: 0, message: "Import run was already rolled back." };
    }

    const refs = (run.createdEntityRefsJson && typeof run.createdEntityRefsJson === "object"
      ? run.createdEntityRefsJson
      : {}) as {
      vendorInvoiceIds?: unknown;
      ownerLedgerEntryIds?: unknown;
    };
    const vendorInvoiceIds = Array.isArray(refs.vendorInvoiceIds) ? refs.vendorInvoiceIds.filter((id): id is string => typeof id === "string") : [];
    const ownerLedgerEntryIds = Array.isArray(refs.ownerLedgerEntryIds) ? refs.ownerLedgerEntryIds.filter((id): id is string => typeof id === "string") : [];

    let deletedVendorInvoices = 0;
    let deletedOwnerLedgerEntries = 0;

    if (ownerLedgerEntryIds.length > 0) {
      const removed = await db
        .delete(ownerLedgerEntries)
        .where(inArray(ownerLedgerEntries.id, ownerLedgerEntryIds))
        .returning({ id: ownerLedgerEntries.id });
      deletedOwnerLedgerEntries = removed.length;
    }

    if (vendorInvoiceIds.length > 0) {
      const removed = await db
        .delete(vendorInvoices)
        .where(inArray(vendorInvoices.id, vendorInvoiceIds))
        .returning({ id: vendorInvoices.id });
      deletedVendorInvoices = removed.length;
    }

    await db
      .update(aiIngestionImportRuns)
      .set({
        runStatus: "rolled-back",
        rolledBackAt: new Date(),
        errorMessage: actorEmail ? `Rolled back by ${actorEmail}` : "Rolled back",
        updatedAt: new Date(),
      })
      .where(eq(aiIngestionImportRuns.id, run.id));

    return {
      rolledBack: deletedVendorInvoices > 0 || deletedOwnerLedgerEntries > 0,
      deletedVendorInvoices,
      deletedOwnerLedgerEntries,
      message: `Rollback complete. Removed ${deletedVendorInvoices} invoices and ${deletedOwnerLedgerEntries} owner-ledger entries.`,
    };
  }

  async reprocessAiIngestionImportRun(runId: string, options?: {
    rollbackFirst?: boolean;
    actorEmail?: string;
  }): Promise<{
    reprocessed: boolean;
    ingestionJobId: string | null;
    rolledBack: boolean;
    message: string;
  }> {
    const [run] = await db.select().from(aiIngestionImportRuns).where(eq(aiIngestionImportRuns.id, runId));
    if (!run) {
      return { reprocessed: false, ingestionJobId: null, rolledBack: false, message: "Import run not found." };
    }

    let rolledBack = false;
    if (options?.rollbackFirst) {
      if (run.mode !== "commit") {
        return { reprocessed: false, ingestionJobId: run.ingestionJobId, rolledBack: false, message: "Only commit runs can be rolled back before reprocess." };
      }
      if (!run.rolledBackAt) {
        const rollback = await this.rollbackAiIngestionImportRun(run.id, options.actorEmail);
        if (!rollback.rolledBack && rollback.deletedVendorInvoices === 0 && rollback.deletedOwnerLedgerEntries === 0) {
          return { reprocessed: false, ingestionJobId: run.ingestionJobId, rolledBack: false, message: rollback.message };
        }
        rolledBack = rollback.rolledBack;
      }
    } else if (run.mode === "commit" && !run.rolledBackAt) {
      return {
        reprocessed: false,
        ingestionJobId: run.ingestionJobId,
        rolledBack: false,
        message: "Commit run must be rolled back before reprocess, or request rollback first.",
      };
    }

    await this.processAiIngestionJob(run.ingestionJobId);
    return {
      reprocessed: true,
      ingestionJobId: run.ingestionJobId,
      rolledBack,
      message: rolledBack ? "Import run rolled back and source job reprocessed." : "Source job reprocessed.",
    };
  }

  async previewRollbackAiIngestionImportRun(runId: string): Promise<{
    canRollback: boolean;
    vendorInvoicesToDelete: number;
    ownerLedgerEntriesToDelete: number;
    missingRefs: number;
    message: string;
  }> {
    const [run] = await db.select().from(aiIngestionImportRuns).where(eq(aiIngestionImportRuns.id, runId));
    if (!run) {
      return { canRollback: false, vendorInvoicesToDelete: 0, ownerLedgerEntriesToDelete: 0, missingRefs: 0, message: "Import run not found." };
    }
    if (run.mode !== "commit" || run.rolledBackAt) {
      return { canRollback: false, vendorInvoicesToDelete: 0, ownerLedgerEntriesToDelete: 0, missingRefs: 0, message: "Run is not eligible for rollback preview." };
    }

    const refs = (run.createdEntityRefsJson && typeof run.createdEntityRefsJson === "object"
      ? run.createdEntityRefsJson
      : {}) as {
      vendorInvoiceIds?: unknown;
      ownerLedgerEntryIds?: unknown;
    };
    const vendorInvoiceIds = Array.isArray(refs.vendorInvoiceIds) ? refs.vendorInvoiceIds.filter((id): id is string => typeof id === "string") : [];
    const ownerLedgerEntryIds = Array.isArray(refs.ownerLedgerEntryIds) ? refs.ownerLedgerEntryIds.filter((id): id is string => typeof id === "string") : [];

    const [existingInvoices, existingLedger] = await Promise.all([
      vendorInvoiceIds.length
        ? db.select({ id: vendorInvoices.id }).from(vendorInvoices).where(inArray(vendorInvoices.id, vendorInvoiceIds))
        : Promise.resolve([]),
      ownerLedgerEntryIds.length
        ? db.select({ id: ownerLedgerEntries.id }).from(ownerLedgerEntries).where(inArray(ownerLedgerEntries.id, ownerLedgerEntryIds))
        : Promise.resolve([]),
    ]);

    const vendorInvoicesToDelete = existingInvoices.length;
    const ownerLedgerEntriesToDelete = existingLedger.length;
    const missingRefs = (vendorInvoiceIds.length - vendorInvoicesToDelete) + (ownerLedgerEntryIds.length - ownerLedgerEntriesToDelete);

    return {
      canRollback: vendorInvoicesToDelete > 0 || ownerLedgerEntriesToDelete > 0,
      vendorInvoicesToDelete,
      ownerLedgerEntriesToDelete,
      missingRefs,
      message: `Rollback preview: ${vendorInvoicesToDelete} invoices and ${ownerLedgerEntriesToDelete} owner-ledger entries would be deleted.`,
    };
  }

  async getClauseRecords(filters?: { ingestionJobId?: string; associationId?: string; reviewStatus?: "pending-review" | "approved" | "rejected"; query?: string; includeSuperseded?: boolean }): Promise<ClauseRecord[]> {
    const clauses = await db
      .select()
      .from(clauseRecords)
      .where(filters?.includeSuperseded ? undefined : isNull(clauseRecords.supersededAt))
      .orderBy(desc(clauseRecords.createdAt));
    return clauses.filter((row) => {
      if (filters?.ingestionJobId && row.ingestionJobId !== filters.ingestionJobId) return false;
      if (filters?.associationId && row.associationId !== filters.associationId) return false;
      if (filters?.reviewStatus && row.reviewStatus !== filters.reviewStatus) return false;
      if (filters?.query) {
        const q = filters.query.toLowerCase();
        if (!row.title.toLowerCase().includes(q) && !row.clauseText.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }

  async createClauseRecord(data: InsertClauseRecord): Promise<ClauseRecord> {
    const [result] = await db
      .insert(clauseRecords)
      .values({ ...data, reviewStatus: "pending-review", updatedAt: new Date() })
      .returning();
    return result;
  }

  async reviewClauseRecord(id: string, payload: { reviewStatus: "approved" | "rejected"; title?: string; clauseText?: string; reviewedBy?: string | null }): Promise<ClauseRecord | undefined> {
    const [result] = await db
      .update(clauseRecords)
      .set({
        reviewStatus: payload.reviewStatus,
        title: payload.title ?? undefined,
        clauseText: payload.clauseText ?? undefined,
        reviewedBy: payload.reviewedBy ?? null,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(clauseRecords.id, id))
      .returning();
    return result;
  }

  async getComplianceRuleRecords(filters?: { associationId?: string; clauseRecordId?: string }): Promise<AiExtractedRecord[]> {
    const rows = await db.select().from(aiExtractedRecords).orderBy(desc(aiExtractedRecords.createdAt));
    return rows.filter((row) => {
      if (row.recordType !== "compliance-rule") return false;
      if (filters?.associationId && row.associationId !== filters.associationId) return false;
      if (filters?.clauseRecordId) {
        const payload = row.payloadJson as Record<string, unknown> | null;
        if (!payload || payload.clauseRecordId !== filters.clauseRecordId) return false;
      }
      return true;
    });
  }

  async extractComplianceRulesFromClauses(options?: { associationId?: string; actorEmail?: string | null }): Promise<{ processed: number; created: number; recordIds: string[]; source: "approved-clauses" | "template-fallback" }> {
    const clauses = await this.getClauseRecords({
      associationId: options?.associationId,
      reviewStatus: "approved",
    });
    const existingRules = await this.getComplianceRuleRecords({ associationId: options?.associationId });
    const existingByClauseId = new Set(
      existingRules
        .map((row) => {
          const payload = row.payloadJson as Record<string, unknown> | null;
          return typeof payload?.clauseRecordId === "string" ? payload.clauseRecordId : null;
        })
        .filter((value): value is string => Boolean(value)),
    );
    const existingByTemplateItemId = new Set(
      existingRules
        .map((row) => {
          const payload = row.payloadJson as Record<string, unknown> | null;
          return typeof payload?.templateItemId === "string" ? payload.templateItemId : null;
        })
        .filter((value): value is string => Boolean(value)),
    );

    const recordIds: string[] = [];
    if (clauses.length === 0 && options?.associationId) {
      const templates = await this.getGovernanceComplianceTemplates(options.associationId);
      const stateLibraryTemplate = templates.find((template) => !template.associationId && (template.scope === "state-library" || template.scope === "ct-baseline"));
      if (stateLibraryTemplate) {
        const templateItems = await this.getGovernanceTemplateItems(stateLibraryTemplate.id);
        for (const item of templateItems) {
          if (existingByTemplateItemId.has(item.id)) continue;
          const month = Math.max(1, Math.min(12, item.dueMonth || 1));
          const cadence = month >= 1 && month <= 12 ? "annual" : "event-driven";
          const created = await this.createAiExtractedRecord({
            jobId: stateLibraryTemplate.id,
            associationId: options.associationId,
            recordType: "compliance-rule",
            payloadJson: {
              templateItemId: item.id,
              templateId: stateLibraryTemplate.id,
              sourceTitle: item.title,
              obligationType: "general-compliance",
              frequency: cadence,
              severity: "medium",
              obligationText: item.description?.trim() || item.title,
              sourceClauseText: item.legalReference || item.sourceCitation || item.description || item.title,
              extractedAt: new Date().toISOString(),
              extractedBy: options.actorEmail || "system",
            },
            confidenceScore: 0.7,
          });
          recordIds.push(created.id);
        }
        return {
          processed: templateItems.length,
          created: recordIds.length,
          recordIds,
          source: "template-fallback",
        };
      }
    }

    for (const clause of clauses) {
      if (existingByClauseId.has(clause.id)) continue;
      const text = `${clause.title}\n${clause.clauseText}`.toLowerCase();
      const obligationType = text.includes("quorum") || text.includes("notice") || text.includes("meeting")
        ? "meeting-governance"
        : text.includes("budget") || text.includes("audit") || text.includes("assessment") || text.includes("reserve")
          ? "financial-governance"
          : text.includes("election") || text.includes("director") || text.includes("term")
            ? "board-composition"
            : text.includes("record") || text.includes("minutes") || text.includes("document")
              ? "records-retention"
              : "general-compliance";
      const frequency = text.includes("annual") || text.includes("annually") || text.includes("each year")
        ? "annual"
        : text.includes("monthly")
          ? "monthly"
          : text.includes("quarter")
            ? "quarterly"
            : "event-driven";
      const severity = text.includes("quorum") || text.includes("audit") || text.includes("budget") || text.includes("election")
        ? "high"
        : text.includes("notice") || text.includes("meeting")
          ? "medium"
          : "low";
      const firstSentence = clause.clauseText.split(/(?<=[.!?])\s+/)[0] || clause.clauseText;

      const created = await this.createAiExtractedRecord({
        jobId: clause.ingestionJobId,
        associationId: clause.associationId ?? null,
        recordType: "compliance-rule",
        payloadJson: {
          clauseRecordId: clause.id,
          sourceTitle: clause.title,
          obligationType,
          frequency,
          severity,
          obligationText: firstSentence.trim(),
          sourceClauseText: clause.clauseText,
          extractedAt: new Date().toISOString(),
          extractedBy: options?.actorEmail || "system",
        },
        confidenceScore: clause.confidenceScore ?? 0.75,
      });
      recordIds.push(created.id);
    }

    return {
      processed: clauses.length,
      created: recordIds.length,
      recordIds,
      source: "approved-clauses",
    };
  }

  async getClauseTags(clauseRecordId: string): Promise<ClauseTag[]> {
    return db.select().from(clauseTags).where(eq(clauseTags.clauseRecordId, clauseRecordId)).orderBy(desc(clauseTags.createdAt));
  }

  async createClauseTag(data: InsertClauseTag): Promise<ClauseTag> {
    const [result] = await db.insert(clauseTags).values(data).returning();
    return result;
  }

  async getSuggestedLinks(clauseRecordId: string): Promise<SuggestedLink[]> {
    return db.select().from(suggestedLinks).where(eq(suggestedLinks.clauseRecordId, clauseRecordId)).orderBy(desc(suggestedLinks.createdAt));
  }

  async createSuggestedLink(data: InsertSuggestedLink): Promise<SuggestedLink> {
    const [result] = await db
      .insert(suggestedLinks)
      .values({ ...data, isApproved: 0, updatedAt: new Date() })
      .returning();
    return result;
  }

  async updateSuggestedLink(id: string, data: { isApproved?: number; confidenceScore?: number | null }): Promise<SuggestedLink | undefined> {
    const [result] = await db
      .update(suggestedLinks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(suggestedLinks.id, id))
      .returning();
    return result;
  }

  async getApprovedClauseLinksForGovernance(associationId?: string): Promise<Array<{
    clauseRecordId: string;
    clauseTitle: string;
    clauseText: string;
    entityType: string;
    entityId: string;
    confidenceScore: number | null;
    isApproved: number;
  }>> {
    const clauses = await this.getClauseRecords({ associationId, reviewStatus: "approved" });
    if (!clauses.length) return [];
    const clauseIdSet = new Set(clauses.map((c) => c.id));
    const links = (await db.select().from(suggestedLinks).orderBy(desc(suggestedLinks.updatedAt)))
      .filter((row) => row.isApproved === 1 && clauseIdSet.has(row.clauseRecordId));
    const clauseMap = new Map(clauses.map((c) => [c.id, c]));
    return links.map((link) => {
      const clause = clauseMap.get(link.clauseRecordId)!;
      return {
        clauseRecordId: clause.id,
        clauseTitle: clause.title,
        clauseText: clause.clauseText,
        entityType: link.entityType,
        entityId: link.entityId,
        confidenceScore: link.confidenceScore ?? null,
        isApproved: link.isApproved,
      };
    });
  }

  async getNoticeTemplates(associationId?: string): Promise<NoticeTemplate[]> {
    if (!associationId) {
      return db.select().from(noticeTemplates).orderBy(desc(noticeTemplates.createdAt));
    }
    return db
      .select()
      .from(noticeTemplates)
      .where(or(eq(noticeTemplates.associationId, associationId), isNull(noticeTemplates.associationId)))
      .orderBy(desc(noticeTemplates.createdAt));
  }

  async createNoticeTemplate(data: InsertNoticeTemplate): Promise<NoticeTemplate> {
    const [result] = await db
      .insert(noticeTemplates)
      .values({ ...data, updatedAt: new Date() })
      .returning();
    return result;
  }

  async updateNoticeTemplate(id: string, data: Partial<InsertNoticeTemplate>): Promise<NoticeTemplate | undefined> {
    const [result] = await db
      .update(noticeTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(noticeTemplates.id, id))
      .returning();
    return result;
  }

  private static escapeHtmlEntities(value: string): string {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  private static stripHtmlToText(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&mdash;/gi, "—")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  private static buildNoticeEmailHtml(params: {
    associationName: string;
    associationType: string | null;
    associationAddress: string;
    associationCity: string;
    associationState: string;
    noticeDate: string;
    supportEmail: string | null;
    unitLabel: string | null;
    sections: string[];
  }): string {
    const esc = DatabaseStorage.escapeHtmlEntities;

    const addressParts = [params.associationAddress, params.associationCity, params.associationState]
      .map((v) => v.trim())
      .filter(Boolean);
    const addressLine = esc(addressParts.join(", "));
    const typeLabel = params.associationType ? ` &mdash; ${esc(params.associationType)}` : "";

    const bodyHtmlSections = params.sections
      .map((section) =>
        section
          .split(/\n{2,}/)
          .map(
            (para) =>
              `<p style="margin:0 0 14px 0;color:#333333;font-size:15px;line-height:1.65;">${esc(para).replaceAll("\n", "<br/>")}</p>`,
          )
          .join(""),
      )
      .join('<hr style="border:none;border-top:1px solid #eeeeee;margin:20px 0;" />');

    const supportLine = params.supportEmail
      ? `<br/>Questions? Contact <a href="mailto:${esc(params.supportEmail)}" style="color:#1e3a5f;text-decoration:none;">${esc(params.supportEmail)}</a>.`
      : "";

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${esc(params.associationName)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f2f5;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.10);">
        <tr>
          <td style="background-color:#1e3a5f;padding:28px 36px;">
            <div style="color:#ffffff;font-size:22px;font-weight:bold;letter-spacing:0.01em;margin-bottom:6px;">${esc(params.associationName)}</div>
            <div style="color:#a8c4e0;font-size:13px;">${addressLine}${typeLabel}</div>
          </td>
        </tr>
        <tr>
          <td style="background-color:#e8eef4;padding:10px 36px;border-bottom:2px solid #1e3a5f;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="color:#1e3a5f;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;">
                  Official Community Notice${params.unitLabel ? ` &nbsp;&middot;&nbsp; <span style="font-weight:normal;text-transform:none;">${esc(params.unitLabel)}</span>` : ""}
                </td>
                <td align="right" style="color:#666666;font-size:11px;">${esc(params.noticeDate)}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 36px;background-color:#ffffff;">
            ${bodyHtmlSections}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 36px;background-color:#f8f9fa;border-top:1px solid #e0e0e0;">
            <p style="margin:0;color:#888888;font-size:12px;line-height:1.6;">
              This notice was sent by <strong>${esc(params.associationName)}</strong>.${supportLine}
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 36px;background-color:#f0f2f5;border-top:1px solid #e8eaed;text-align:center;">
            <p style="margin:0;color:#bbbbbb;font-size:11px;letter-spacing:0.02em;">Powered by <span style="color:#9aaabb;">Your Condo Manager</span></p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
  }

  private async renderNoticeContent(payload: {
    associationId?: string | null;
    templateId?: string | null;
    subject?: string | null;
    body?: string | null;
    recipientPersonId?: string | null;
    recipientUnitId?: string | null;
    recipientRole?: "owner" | "tenant" | "board-member" | null;
    variables?: Record<string, string>;
  }): Promise<{ associationId: string | null; subject: string; body: string; bodyHtml: string }> {
    let associationId = payload.associationId ?? null;
    let subject = payload.subject || "";
    let letterhead = "";
    let header = "";
    let body = payload.body || "";
    let footer = "";
    let signature = "";

    if (payload.templateId) {
      const [template] = await db.select().from(noticeTemplates).where(eq(noticeTemplates.id, payload.templateId));
      if (!template) throw new Error("Notice template not found");
      if (associationId && template.associationId && template.associationId !== associationId) {
        throw new Error("Template association mismatch");
      }
      associationId = associationId ?? template.associationId ?? null;
      subject = template.subjectTemplate;
      header = template.headerTemplate ?? "";
      body = template.bodyTemplate;
      footer = template.footerTemplate ?? "";
      signature = template.signatureTemplate ?? "";
    }

    const vars = await this.buildCanonicalNoticeVariables({
      associationId,
      recipientPersonId: payload.recipientPersonId ?? null,
      recipientUnitId: payload.recipientUnitId ?? null,
      recipientRole: payload.recipientRole ?? null,
      variables: payload.variables ?? {},
    });
    for (const [key, value] of Object.entries(vars)) {
      const token = new RegExp(`{{\\s*${key}\\s*}}`, "g");
      subject = subject.replace(token, value);
      header = header.replace(token, value);
      body = body.replace(token, value);
      footer = footer.replace(token, value);
      signature = signature.replace(token, value);
    }

    if (associationId) {
      const associationLine = vars.association_name.trim();
      const locationParts = [vars.association_address, vars.association_city, vars.association_state]
        .map((value) => value.trim())
        .filter(Boolean);
      const locationLine = locationParts.join(", ");
      const generatedLine = `Notice generated ${new Date().toLocaleDateString("en-US")}`;
      letterhead = ["Association Notice", associationLine, locationLine, generatedLine]
        .filter(Boolean)
        .join("\n")
        .trim();
    }

    let associationRecord: { name: string; associationType: string | null; address: string; city: string; state: string } | null = null;
    let supportEmail: string | null = null;

    if (associationId) {
      const config = await this.getTenantConfig(associationId);
      const configuredFooter = config?.defaultNoticeFooter?.trim();
      if (!footer && configuredFooter) {
        footer = configuredFooter;
      }
      supportEmail = config?.supportEmail?.trim() || null;
      const [assocRow] = await db.select().from(associations).where(eq(associations.id, associationId)).limit(1);
      if (assocRow) {
        associationRecord = {
          name: assocRow.name,
          associationType: assocRow.associationType ?? null,
          address: assocRow.address,
          city: assocRow.city,
          state: assocRow.state,
        };
      }
    }

    const renderedBody = [letterhead, header.trim(), body.trim(), footer.trim(), signature.trim()]
      .filter(Boolean)
      .join("\n\n")
      .trim();

    const contentSections = [header.trim(), body.trim(), footer.trim(), signature.trim()].filter(Boolean);
    const bodyHtml = associationRecord
      ? DatabaseStorage.buildNoticeEmailHtml({
          associationName: associationRecord.name,
          associationType: associationRecord.associationType,
          associationAddress: associationRecord.address,
          associationCity: associationRecord.city,
          associationState: associationRecord.state,
          noticeDate: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
          supportEmail,
          unitLabel: vars.unit_label || null,
          sections: contentSections.length > 0 ? contentSections : [body.trim() || renderedBody],
        })
      : renderedBody;

    return { associationId, subject, body: renderedBody, bodyHtml };
  }

  private async validateCommunicationReadiness(associationId: string, bypassReadinessGate?: boolean | null): Promise<void> {
    if (bypassReadinessGate) return;
    const readiness = await this.getAssociationContactReadiness(associationId);
    if (!readiness.canSendNotices) {
      throw new Error(
        `Communication blocked by contact readiness gate: ${readiness.blockingReasons.join("; ")}`,
      );
    }
  }

  private async buildCanonicalNoticeVariables(input: {
    associationId: string | null;
    recipientPersonId?: string | null;
    recipientUnitId?: string | null;
    recipientRole?: "owner" | "tenant" | "board-member" | null;
    variables?: Record<string, string>;
  }): Promise<Record<string, string>> {
    const appBaseUrl = (process.env.APP_BASE_URL || "http://localhost:5000").replace(/\/$/, "");
    const baseVariables: Record<string, string> = {
      maintenance_request_link: `${appBaseUrl}/app/maintenance`,
      owner_submission_link: "",
      tenant_submission_link: "",
      association_name: "",
      association_address: "",
      association_city: "",
      association_state: "",
      unit_number: "",
      unit_building: "",
      unit_label: "",
      owner_name: "",
      tenant_name: "",
      recipient_name: "",
      board_signature: "",
    };

    let association: Association | null = null;
    let person: Person | null = null;
    let unit: Unit | null = null;

    if (input.associationId) {
      const [row] = await db.select().from(associations).where(eq(associations.id, input.associationId)).limit(1);
      association = row ?? null;
    }
    if (input.recipientPersonId) {
      const [row] = await db.select().from(persons).where(eq(persons.id, input.recipientPersonId)).limit(1);
      person = row ?? null;
    }
    if (input.recipientUnitId) {
      const [row] = await db.select().from(units).where(eq(units.id, input.recipientUnitId)).limit(1);
      unit = row ?? null;
    } else if (input.associationId && input.recipientPersonId) {
      const now = new Date();
      const [ownershipRow, occupancyRow] = await Promise.all([
        db.select().from(ownerships).where(eq(ownerships.personId, input.recipientPersonId)),
        db.select().from(occupancies).where(eq(occupancies.personId, input.recipientPersonId)),
      ]);
      const activeOwnership = ownershipRow.find((row) => this.isDateRangeActive(row.startDate, row.endDate, now));
      const activeOccupancy = occupancyRow.find((row) => this.isDateRangeActive(row.startDate, row.endDate, now));
      const unitId = activeOwnership?.unitId ?? activeOccupancy?.unitId ?? null;
      if (unitId) {
        const [row] = await db.select().from(units).where(eq(units.id, unitId)).limit(1);
        unit = row ?? null;
      }
    }

    if (association) {
      baseVariables.association_name = association.name;
      baseVariables.association_address = association.address;
      baseVariables.association_city = association.city;
      baseVariables.association_state = association.state;
    }
    if (unit) {
      baseVariables.unit_number = unit.unitNumber;

      let buildingName = unit.building?.trim() ?? "";
      if (!buildingName && unit.buildingId) {
        const [buildingRow] = await db.select().from(buildings).where(eq(buildings.id, unit.buildingId)).limit(1);
        buildingName = buildingRow?.name?.trim() ?? "";
      }
      baseVariables.unit_building = buildingName;
      baseVariables.unit_label = buildingName
        ? `${buildingName}, Unit ${unit.unitNumber}`
        : `Unit ${unit.unitNumber}`;

      if (input.associationId) {
        const ownerLink = await this.getOrCreateUnitOnboardingLink({
          associationId: input.associationId,
          unitId: unit.id,
          residentType: "owner",
        });
        const tenantLink = await this.getOrCreateUnitOnboardingLink({
          associationId: input.associationId,
          unitId: unit.id,
          residentType: "tenant",
        });
        baseVariables.owner_submission_link = ownerLink.inviteUrl;
        baseVariables.tenant_submission_link = tenantLink.inviteUrl;
      }
    }
    if (person) {
      const fullName = `${person.firstName} ${person.lastName}`.trim();
      baseVariables.recipient_name = fullName;
      if (input.recipientRole === "owner") {
        baseVariables.owner_name = fullName;
      } else if (input.recipientRole === "tenant") {
        baseVariables.tenant_name = fullName;
      } else {
        baseVariables.owner_name = fullName;
        baseVariables.tenant_name = fullName;
      }
    }

    if (input.associationId) {
      const config = await this.getTenantConfig(input.associationId);
      const managementType = config?.managementType ?? "self-managed";
      const managementCompanyName = config?.managementCompanyName?.trim() ?? "";

      if (managementType === "property-managed" && managementCompanyName) {
        baseVariables.board_signature = [
          managementCompanyName,
          association ? `On behalf of ${association.name}` : "",
        ].filter(Boolean).join("\n");
      } else {
        const currentRoles = await db
          .select({ role: boardRoles.role, personId: boardRoles.personId })
          .from(boardRoles)
          .where(and(eq(boardRoles.associationId, input.associationId), isNull(boardRoles.endDate)));
        if (currentRoles.length > 0) {
          const rolePersonIds = currentRoles.map((r) => r.personId);
          const rolePersons = await db
            .select({ id: persons.id, firstName: persons.firstName, lastName: persons.lastName })
            .from(persons)
            .where(inArray(persons.id, rolePersonIds));
          const personNameById = new Map(rolePersons.map((p) => [p.id, `${p.firstName} ${p.lastName}`.trim()]));
          const roleOrder = ["President", "Vice President", "Treasurer", "Secretary"];
          const sortedRoles = [...currentRoles].sort((a, b) => {
            const ai = roleOrder.indexOf(a.role);
            const bi = roleOrder.indexOf(b.role);
            return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
          });
          const lines = sortedRoles
            .map((r) => {
              const name = personNameById.get(r.personId);
              return name ? `${name}, ${r.role}` : null;
            })
            .filter(Boolean) as string[];
          const header = association ? `${association.name} Board` : "Association Board";
          baseVariables.board_signature = [header, ...lines].join("\n");
        } else {
          baseVariables.board_signature = association ? `${association.name} Board` : "Association Board";
        }
      }
    }

    return {
      ...baseVariables,
      ...(input.variables ?? {}),
    };
  }

  private async createCommunicationHistoryRecord(payload: InsertCommunicationHistory): Promise<CommunicationHistory> {
    const [history] = await db.insert(communicationHistory).values(payload).returning();
    return history;
  }

  private async deliverNoticeSend(send: NoticeSend, sentBy?: string | null): Promise<{ send: NoticeSend; history: CommunicationHistory }> {
    const now = new Date();
    const isHtmlBody = send.bodyRendered.trimStart().startsWith("<");
    const htmlBody = isHtmlBody ? send.bodyRendered : undefined;
    const textBody = isHtmlBody ? DatabaseStorage.stripHtmlToText(send.bodyRendered) : send.bodyRendered;
    const delivery = await sendPlatformEmail({
      associationId: send.associationId ?? null,
      to: send.recipientEmail,
      subject: send.subjectRendered,
      text: textBody,
      html: htmlBody,
      templateKey: send.templateId ?? "notice-send",
      metadata: {
        noticeSendId: send.id,
        recipientPersonId: send.recipientPersonId ?? null,
        campaignKey: send.campaignKey ?? null,
      },
      enableTracking: true,
    });
    const [updatedSend] = await db
      .update(noticeSends)
      .set({
        status: delivery.status,
        provider: delivery.provider,
        providerMessageId: delivery.messageId,
        sentBy: sentBy ?? send.sentBy ?? null,
        sentAt: now,
      })
      .where(eq(noticeSends.id, send.id))
      .returning();

    const history = await this.createCommunicationHistoryRecord({
      associationId: updatedSend.associationId ?? null,
      channel: "email",
      direction: "outbound",
      subject: updatedSend.subjectRendered,
      bodySnippet: updatedSend.bodyRendered.slice(0, 500),
      recipientEmail: updatedSend.recipientEmail,
      recipientPersonId: updatedSend.recipientPersonId ?? null,
      relatedType: delivery.status === "sent" ? "notice-send" : "notice-send-failed",
      relatedId: updatedSend.id,
      metadataJson: {
        provider: updatedSend.provider,
        providerMessageId: updatedSend.providerMessageId,
        emailLogId: delivery.logId,
        errorMessage: delivery.errorMessage ?? null,
        campaignKey: updatedSend.campaignKey ?? null,
        sendMetadata: updatedSend.metadataJson ?? null,
      },
    });

    if (delivery.status === "sent" && updatedSend.associationId) {
      await this.upsertEmailThread({
        associationId: updatedSend.associationId,
        subject: updatedSend.subjectRendered || "(no subject)",
        participantsJson: [updatedSend.recipientEmail],
        source: "internal",
      });
    }

    return { send: updatedSend, history };
  }

  async sendNotice(payload: {
    associationId?: string | null;
    templateId?: string | null;
    campaignKey?: string | null;
    recipientEmail: string;
    recipientPersonId?: string | null;
    recipientUnitId?: string | null;
    recipientRole?: "owner" | "tenant" | "board-member" | null;
    subject?: string | null;
    body?: string | null;
    variables?: Record<string, string>;
    metadataJson?: Record<string, unknown> | null;
    requireApproval?: boolean | null;
    scheduledFor?: Date | string | null;
    bypassReadinessGate?: boolean | null;
    sentBy?: string | null;
  }): Promise<{ send: NoticeSend; history: CommunicationHistory }> {
    const rendered = await this.renderNoticeContent(payload);
    if (rendered.associationId) {
      await this.validateCommunicationReadiness(rendered.associationId, payload.bypassReadinessGate);
    }
    const scheduledForDate =
      payload.scheduledFor == null
        ? null
        : payload.scheduledFor instanceof Date
          ? payload.scheduledFor
          : new Date(payload.scheduledFor);
    const hasValidSchedule = Boolean(scheduledForDate && !Number.isNaN(scheduledForDate.getTime()));
    const now = new Date();
    const requireApproval = Boolean(payload.requireApproval);

    const status = requireApproval
      ? "pending-approval"
      : hasValidSchedule && scheduledForDate! > now
        ? "scheduled"
        : "sent";

    const [send] = await db
      .insert(noticeSends)
      .values({
        associationId: rendered.associationId,
        templateId: payload.templateId ?? null,
        campaignKey: payload.campaignKey ?? null,
        recipientEmail: payload.recipientEmail,
        recipientPersonId: payload.recipientPersonId ?? null,
        subjectRendered: rendered.subject,
        bodyRendered: rendered.bodyHtml || rendered.body,
        status,
        provider: status === "sent" ? "internal-queued" : "internal-queued",
        providerMessageId: null,
        metadataJson: payload.metadataJson ?? null,
        sentBy: payload.sentBy ?? null,
        sentAt: hasValidSchedule ? scheduledForDate! : now,
      })
      .returning();

    if (status === "sent") {
      return this.deliverNoticeSend(send, payload.sentBy ?? null);
    }

    const history = await this.createCommunicationHistoryRecord({
      associationId: send.associationId ?? null,
      channel: "email",
      direction: "outbound",
      subject: send.subjectRendered,
      bodySnippet: send.bodyRendered.slice(0, 500),
      recipientEmail: send.recipientEmail,
      recipientPersonId: send.recipientPersonId ?? null,
      relatedType: status === "scheduled" ? "notice-scheduled" : "notice-awaiting-approval",
      relatedId: send.id,
      metadataJson: {
        status,
        scheduledFor: send.sentAt.toISOString(),
        campaignKey: send.campaignKey ?? null,
        sendMetadata: send.metadataJson ?? null,
      },
    });

    return { send, history };
  }

  async getNoticeSends(associationId?: string, status?: string): Promise<NoticeSend[]> {
    let rows = await db.select().from(noticeSends).orderBy(desc(noticeSends.sentAt));
    if (associationId) {
      rows = rows.filter((row) => row.associationId === associationId);
    }
    if (status) {
      rows = rows.filter((row) => row.status === status);
    }
    return rows;
  }

  private async resolveNotificationRecipientResolution(payload: {
    associationId: string;
    targetType: "all-owners" | "all-tenants" | "all-occupants" | "selected-units" | "individual-owner" | "individual-tenant" | "board-members";
    selectedUnitIds?: string[];
    selectedPersonId?: string | null;
    selectedUnitAudience?: "owners" | "tenants" | "occupants" | "all";
    messageClass?: "general" | "operational" | "maintenance" | "financial" | "governance";
    ccOwners?: boolean;
  }): Promise<NotificationRecipientResolution> {
    const now = new Date();
    const unitRows = await db.select().from(units).where(eq(units.associationId, payload.associationId));
    const allUnitIds = unitRows.map((row) => row.id);
    const selectedUnitIdSet = new Set((payload.selectedUnitIds ?? []).filter((unitId) => allUnitIds.includes(unitId)));
    const unitIds = payload.targetType === "selected-units" && selectedUnitIdSet.size > 0
      ? Array.from(selectedUnitIdSet)
      : allUnitIds;
    if (unitIds.length === 0) {
      return {
        recipients: [],
        candidateCount: 0,
        missingEmailCount: 0,
        duplicateEmailCount: 0,
        skippedRecipients: 0,
      };
    }

    const [ownershipRows, occupancyRows, boardRoleRows] = await Promise.all([
      db.select().from(ownerships).where(inArray(ownerships.unitId, unitIds)),
      db.select().from(occupancies).where(inArray(occupancies.unitId, unitIds)),
      db.select().from(boardRoles).where(eq(boardRoles.associationId, payload.associationId)),
    ]);

    const activeOwners = ownershipRows.filter((row) => this.isDateRangeActive(row.startDate, row.endDate, now));
    const activeOccupancies = occupancyRows.filter((row) => this.isDateRangeActive(row.startDate, row.endDate, now));
    const activeTenants = activeOccupancies.filter((row) => row.occupancyType === "TENANT");
    const activeOwnerOccupants = activeOccupancies.filter((row) => row.occupancyType === "OWNER_OCCUPIED");
    const activeBoardMembers = boardRoleRows.filter((row) => this.isDateRangeActive(row.startDate, row.endDate, now));
    const selectedUnitAudience = payload.selectedUnitAudience ?? "all";
    const messageClass = payload.messageClass ?? "general";

    const rawRecipients: Array<{
      personId: string;
      role: "owner" | "tenant" | "board-member";
      unitId: string;
    }> = [];

    if (payload.targetType === "all-owners") {
      for (const row of activeOwners) rawRecipients.push({ personId: row.personId, role: "owner", unitId: row.unitId });
    } else if (payload.targetType === "all-tenants") {
      for (const row of activeTenants) rawRecipients.push({ personId: row.personId, role: "tenant", unitId: row.unitId });
    } else if (payload.targetType === "all-occupants") {
      for (const row of activeOwnerOccupants) rawRecipients.push({ personId: row.personId, role: "owner", unitId: row.unitId });
      for (const row of activeTenants) rawRecipients.push({ personId: row.personId, role: "tenant", unitId: row.unitId });
    } else if (payload.targetType === "selected-units") {
      if (selectedUnitIdSet.size === 0) {
        return {
          recipients: [],
          candidateCount: 0,
          missingEmailCount: 0,
          duplicateEmailCount: 0,
          skippedRecipients: 0,
        };
      }
      if (selectedUnitAudience === "owners" || selectedUnitAudience === "all") {
        for (const row of activeOwners.filter((row) => selectedUnitIdSet.has(row.unitId))) {
          rawRecipients.push({ personId: row.personId, role: "owner", unitId: row.unitId });
        }
      }
      if (selectedUnitAudience === "tenants" || selectedUnitAudience === "all") {
        for (const row of activeTenants.filter((row) => selectedUnitIdSet.has(row.unitId))) {
          rawRecipients.push({ personId: row.personId, role: "tenant", unitId: row.unitId });
        }
      }
      if (selectedUnitAudience === "occupants") {
        for (const row of activeOwnerOccupants.filter((row) => selectedUnitIdSet.has(row.unitId))) {
          rawRecipients.push({ personId: row.personId, role: "owner", unitId: row.unitId });
        }
        for (const row of activeTenants.filter((row) => selectedUnitIdSet.has(row.unitId))) {
          rawRecipients.push({ personId: row.personId, role: "tenant", unitId: row.unitId });
        }
      }
    } else if (payload.targetType === "individual-owner") {
      for (const row of activeOwners.filter((row) => row.personId === payload.selectedPersonId)) {
        rawRecipients.push({ personId: row.personId, role: "owner", unitId: row.unitId });
      }
    } else if (payload.targetType === "individual-tenant") {
      for (const row of activeTenants.filter((row) => row.personId === payload.selectedPersonId)) {
        rawRecipients.push({ personId: row.personId, role: "tenant", unitId: row.unitId });
      }
    } else if (payload.targetType === "board-members") {
      for (const row of activeBoardMembers) {
        rawRecipients.push({ personId: row.personId, role: "board-member", unitId: "" });
      }
    }

    if (payload.ccOwners && payload.targetType !== "all-owners" && payload.targetType !== "individual-owner") {
      for (const row of activeOwners) {
        rawRecipients.push({ personId: row.personId, role: "owner", unitId: row.unitId });
      }
    }

    const routedRecipients = rawRecipients.filter((row) => {
      if (messageClass === "financial" || messageClass === "governance") {
        return row.role === "owner" || row.role === "board-member";
      }
      return true;
    });

    const personIds = Array.from(new Set(routedRecipients.map((row) => row.personId)));
    if (personIds.length === 0) {
      return {
        recipients: [],
        candidateCount: 0,
        missingEmailCount: 0,
        duplicateEmailCount: 0,
        skippedRecipients: 0,
      };
    }
    const personRows = await db.select().from(persons).where(inArray(persons.id, personIds));
    const personById = new Map(personRows.map((row) => [row.id, row]));

    const deduped = new Map<string, NotificationRecipient>();
    let missingEmailCount = 0;
    let duplicateEmailCount = 0;
    for (const row of routedRecipients) {
      const person = personById.get(row.personId);
      if (!person?.email?.trim()) {
        missingEmailCount += 1;
        continue;
      }
      const key = person.email.trim().toLowerCase();
      if (!key) {
        missingEmailCount += 1;
        continue;
      }
      const existing = deduped.get(key);
      if (!existing) {
        deduped.set(key, {
          personId: row.personId,
          email: person.email,
          role: row.role,
          unitId: row.unitId,
        });
        continue;
      }
      duplicateEmailCount += 1;
      const rank = { "board-member": 3, owner: 2, tenant: 1 } as const;
      if (rank[row.role] > rank[existing.role]) {
        deduped.set(key, {
          personId: row.personId,
          email: person.email,
          role: row.role,
          unitId: row.unitId,
        });
      }
    }

    const recipients = Array.from(deduped.values()).sort((a, b) => a.email.localeCompare(b.email));
    return {
      recipients,
      candidateCount: routedRecipients.length,
      missingEmailCount,
      duplicateEmailCount,
      skippedRecipients: missingEmailCount + duplicateEmailCount,
    };
  }

  async resolveNotificationRecipients(payload: {
    associationId: string;
    targetType: "all-owners" | "all-tenants" | "all-occupants" | "selected-units" | "individual-owner" | "individual-tenant" | "board-members";
    selectedUnitIds?: string[];
    selectedPersonId?: string | null;
    selectedUnitAudience?: "owners" | "tenants" | "occupants" | "all";
    messageClass?: "general" | "operational" | "maintenance" | "financial" | "governance";
    ccOwners?: boolean;
  }): Promise<NotificationRecipient[]> {
    const result = await this.resolveNotificationRecipientResolution(payload);
    return result.recipients;
  }

  async resolveNotificationRecipientPreview(payload: {
    associationId: string;
    targetType: "all-owners" | "all-tenants" | "all-occupants" | "selected-units" | "individual-owner" | "individual-tenant" | "board-members";
    selectedUnitIds?: string[];
    selectedPersonId?: string | null;
    selectedUnitAudience?: "owners" | "tenants" | "occupants" | "all";
    messageClass?: "general" | "operational" | "maintenance" | "financial" | "governance";
    ccOwners?: boolean;
  }): Promise<NotificationRecipientResolution> {
    return this.resolveNotificationRecipientResolution(payload);
  }

  async sendTargetedNotice(payload: {
    associationId: string;
    targetType: "all-owners" | "all-tenants" | "all-occupants" | "selected-units" | "individual-owner" | "individual-tenant" | "board-members";
    selectedUnitIds?: string[];
    selectedPersonId?: string | null;
    selectedUnitAudience?: "owners" | "tenants" | "occupants" | "all";
    messageClass?: "general" | "operational" | "maintenance" | "financial" | "governance";
    ccOwners?: boolean;
    templateId?: string | null;
    subject?: string | null;
    body?: string | null;
    variables?: Record<string, string>;
    requireApproval?: boolean | null;
    scheduledFor?: Date | string | null;
    bypassReadinessGate?: boolean | null;
    sentBy?: string | null;
  }): Promise<{
    recipientCount: number;
    sentCount: number;
    sendIds: string[];
    skippedRecipients: number;
    missingEmailCount: number;
    duplicateEmailCount: number;
  }> {
    await this.validateCommunicationReadiness(payload.associationId, payload.bypassReadinessGate);
    const resolution = await this.resolveNotificationRecipientResolution({
      associationId: payload.associationId,
      targetType: payload.targetType,
      selectedUnitIds: payload.selectedUnitIds,
      selectedPersonId: payload.selectedPersonId ?? null,
      selectedUnitAudience: payload.selectedUnitAudience,
      messageClass: payload.messageClass,
      ccOwners: payload.ccOwners,
    });
    const recipients = resolution.recipients;
    const campaignKey = randomBytes(12).toString("base64url");
    const campaignMetadata = {
      campaignKey,
      targetType: payload.targetType,
      selectedUnitIds: payload.selectedUnitIds ?? [],
      selectedPersonId: payload.selectedPersonId ?? null,
      selectedUnitAudience: payload.selectedUnitAudience ?? null,
      messageClass: payload.messageClass ?? "general",
      ccOwners: payload.ccOwners ?? false,
      recipientSet: recipients.map((recipient) => ({
        personId: recipient.personId,
        email: recipient.email,
        role: recipient.role,
        unitId: recipient.unitId,
      })),
      recipientSummary: {
        recipientCount: recipients.length,
        candidateCount: resolution.candidateCount,
        missingEmailCount: resolution.missingEmailCount,
        duplicateEmailCount: resolution.duplicateEmailCount,
        skippedRecipients: resolution.skippedRecipients,
      },
    };

    const results = await mapInBatches(recipients, 10, async (recipient) => {
      return this.sendNotice({
        associationId: payload.associationId,
        templateId: payload.templateId ?? null,
        campaignKey,
        recipientEmail: recipient.email,
        recipientPersonId: recipient.personId,
        recipientUnitId: recipient.unitId || null,
        recipientRole: recipient.role,
        subject: payload.subject ?? null,
        body: payload.body ?? null,
        variables: payload.variables,
        metadataJson: {
          ...campaignMetadata,
          recipient: {
            personId: recipient.personId,
            email: recipient.email,
            role: recipient.role,
            unitId: recipient.unitId,
          },
        },
        requireApproval: payload.requireApproval ?? null,
        scheduledFor: payload.scheduledFor ?? null,
        bypassReadinessGate: true,
        sentBy: payload.sentBy ?? null,
      });
    });
    const sendIds = results.map((result) => result.send.id);

    await this.createCommunicationHistoryRecord({
      associationId: payload.associationId,
      channel: "email",
      direction: "outbound",
      subject: payload.subject ?? null,
      bodySnippet: (payload.body ?? "").slice(0, 500),
      recipientEmail: null,
      recipientPersonId: null,
      relatedType: "notice-recipient-set",
      relatedId: campaignKey,
      metadataJson: {
        ...campaignMetadata,
        sendIds,
        templateId: payload.templateId ?? null,
      },
    });

    return {
      recipientCount: recipients.length,
      sentCount: sendIds.length,
      sendIds,
      skippedRecipients: resolution.skippedRecipients,
      missingEmailCount: resolution.missingEmailCount,
      duplicateEmailCount: resolution.duplicateEmailCount,
    };
  }

  async getAssociationContactReadiness(associationId: string): Promise<{
    associationId: string;
    activeOwners: number;
    activeOccupants: number;
    contactableOwners: number;
    contactableOccupants: number;
    contactCoveragePercent: number;
    canSendNotices: boolean;
    blockingReasons: string[];
  }> {
    const now = new Date();
    const unitRows = await db.select().from(units).where(eq(units.associationId, associationId));
    const unitIds = unitRows.map((row) => row.id);
    if (unitIds.length === 0) {
      return {
        associationId,
        activeOwners: 0,
        activeOccupants: 0,
        contactableOwners: 0,
        contactableOccupants: 0,
        contactCoveragePercent: 0,
        canSendNotices: false,
        blockingReasons: ["No units configured for association."],
      };
    }

    const [ownershipRows, occupancyRows] = await Promise.all([
      db.select().from(ownerships).where(inArray(ownerships.unitId, unitIds)),
      db.select().from(occupancies).where(inArray(occupancies.unitId, unitIds)),
    ]);
    const activeOwners = ownershipRows.filter((row) => row.startDate <= now && (!row.endDate || row.endDate >= now));
    const activeOccupants = occupancyRows.filter((row) => row.startDate <= now && (!row.endDate || row.endDate >= now));

    const personIds = Array.from(new Set([...activeOwners.map((row) => row.personId), ...activeOccupants.map((row) => row.personId)]));
    const personRows = personIds.length > 0 ? await db.select().from(persons).where(inArray(persons.id, personIds)) : [];
    const personById = new Map(personRows.map((row) => [row.id, row]));
    const hasContact = (personId: string) => {
      const person = personById.get(personId);
      if (!person) return false;
      return Boolean((person.email || "").trim() || (person.phone || "").trim());
    };

    const contactableOwners = activeOwners.filter((row) => hasContact(row.personId)).length;
    const contactableOccupants = activeOccupants.filter((row) => hasContact(row.personId)).length;
    const activePeopleCount = activeOwners.length + activeOccupants.length;
    const contactablePeopleCount = contactableOwners + contactableOccupants;
    const contactCoveragePercent = activePeopleCount > 0 ? Math.round((contactablePeopleCount / activePeopleCount) * 100) : 0;

    const blockingReasons: string[] = [];
    if (activeOwners.length === 0) blockingReasons.push("No active owners mapped to units.");
    if (contactCoveragePercent < 70) blockingReasons.push(`Contact coverage ${contactCoveragePercent}% is below required 70%.`);

    return {
      associationId,
      activeOwners: activeOwners.length,
      activeOccupants: activeOccupants.length,
      contactableOwners,
      contactableOccupants,
      contactCoveragePercent,
      canSendNotices: blockingReasons.length === 0,
      blockingReasons,
    };
  }

  async getAssociationOnboardingCompleteness(associationId: string): Promise<{
    associationId: string;
    scorePercent: number;
    components: {
      unitsConfigured: { score: number; total: number; completed: number };
      ownerDataCollected: { score: number; total: number; completed: number };
      tenantDataCollected: { score: number; total: number; completed: number };
      boardMembersConfigured: { score: number; total: number; completed: number };
      paymentMethodsConfigured: { score: number; total: number; completed: number };
      communicationTemplatesConfigured: { score: number; total: number; completed: number };
    };
  }> {
    const unitRows = await db.select().from(units).where(eq(units.associationId, associationId));
    const unitIds = unitRows.map((row) => row.id);

    const [ownershipRows, occupancyRows, paymentMethods, boardRoleRows, templates] = await Promise.all([
      unitIds.length > 0 ? db.select().from(ownerships).where(inArray(ownerships.unitId, unitIds)) : Promise.resolve([]),
      unitIds.length > 0 ? db.select().from(occupancies).where(inArray(occupancies.unitId, unitIds)) : Promise.resolve([]),
      this.getPaymentMethodConfigs(associationId),
      this.getBoardRoles(associationId),
      this.getNoticeTemplates(associationId),
    ]);

    const now = new Date();
    const activeOwnershipUnitIds = new Set(
      ownershipRows.filter((row) => this.isDateRangeActive(row.startDate, row.endDate, now)).map((row) => row.unitId),
    );
    const activeTenantUnitIds = new Set(
      occupancyRows
        .filter((row) => row.occupancyType === "TENANT" && this.isDateRangeActive(row.startDate, row.endDate, now))
        .map((row) => row.unitId),
    );
    const activeBoardRoles = boardRoleRows.filter((row) => this.isDateRangeActive(row.startDate, row.endDate, now));
    const activePaymentMethods = paymentMethods.filter((row) => row.isActive === 1);
    const scopedTemplates = templates.filter((row) => row.associationId === associationId || row.associationId === null);

    const unitsConfigured = {
      total: 1,
      completed: unitRows.length > 0 ? 1 : 0,
      score: unitRows.length > 0 ? 100 : 0,
    };
    const ownerDataCollected = {
      total: unitRows.length,
      completed: activeOwnershipUnitIds.size,
      score: unitRows.length > 0 ? Math.round((activeOwnershipUnitIds.size / unitRows.length) * 100) : 0,
    };
    const tenantDataCollected = {
      total: unitRows.length,
      completed: activeTenantUnitIds.size,
      score: unitRows.length > 0 ? Math.round((activeTenantUnitIds.size / unitRows.length) * 100) : 0,
    };
    const boardMembersConfigured = {
      total: 1,
      completed: activeBoardRoles.length > 0 ? 1 : 0,
      score: activeBoardRoles.length > 0 ? 100 : 0,
    };
    const paymentMethodsConfigured = {
      total: 1,
      completed: activePaymentMethods.length > 0 ? 1 : 0,
      score: activePaymentMethods.length > 0 ? 100 : 0,
    };
    const communicationTemplatesConfigured = {
      total: 1,
      completed: scopedTemplates.length > 0 ? 1 : 0,
      score: scopedTemplates.length > 0 ? 100 : 0,
    };

    const weighted = (
      unitsConfigured.score +
      ownerDataCollected.score +
      tenantDataCollected.score +
      boardMembersConfigured.score +
      paymentMethodsConfigured.score +
      communicationTemplatesConfigured.score
    ) / 6;

    return {
      associationId,
      scorePercent: Math.round(weighted),
      components: {
        unitsConfigured,
        ownerDataCollected,
        tenantDataCollected,
        boardMembersConfigured,
        paymentMethodsConfigured,
        communicationTemplatesConfigured,
      },
    };
  }

  async reviewNoticeSend(
    id: string,
    payload: { decision: "approved" | "rejected"; actedBy?: string | null },
  ): Promise<{ send: NoticeSend; history: CommunicationHistory } | undefined> {
    const [existing] = await db.select().from(noticeSends).where(eq(noticeSends.id, id));
    if (!existing) return undefined;
    if (existing.status !== "pending-approval") {
      throw new Error("Only pending-approval notices can be reviewed");
    }

    if (payload.decision === "rejected") {
      const [send] = await db
        .update(noticeSends)
        .set({
          status: "rejected",
          sentBy: payload.actedBy ?? existing.sentBy ?? null,
        })
        .where(eq(noticeSends.id, id))
        .returning();

      const history = await this.createCommunicationHistoryRecord({
        associationId: send.associationId ?? null,
        channel: "email",
        direction: "outbound",
        subject: send.subjectRendered,
        bodySnippet: send.bodyRendered.slice(0, 500),
        recipientEmail: send.recipientEmail,
        recipientPersonId: send.recipientPersonId ?? null,
        relatedType: "notice-approval-rejected",
        relatedId: send.id,
        metadataJson: { actedBy: payload.actedBy ?? null },
      });
      return { send, history };
    }

    if (existing.sentAt > new Date()) {
      const [send] = await db
        .update(noticeSends)
        .set({
          status: "scheduled",
          sentBy: payload.actedBy ?? existing.sentBy ?? null,
          provider: "internal-queued",
          providerMessageId: null,
        })
        .where(eq(noticeSends.id, id))
        .returning();

      const history = await this.createCommunicationHistoryRecord({
        associationId: send.associationId ?? null,
        channel: "email",
        direction: "outbound",
        subject: send.subjectRendered,
        bodySnippet: send.bodyRendered.slice(0, 500),
        recipientEmail: send.recipientEmail,
        recipientPersonId: send.recipientPersonId ?? null,
        relatedType: "notice-approved-scheduled",
        relatedId: send.id,
        metadataJson: {
          actedBy: payload.actedBy ?? null,
          scheduledFor: send.sentAt.toISOString(),
        },
      });
      return { send, history };
    }

    return this.deliverNoticeSend(existing, payload.actedBy ?? existing.sentBy ?? null);
  }

  async runScheduledNotices(options?: {
    associationId?: string;
    now?: Date;
    actedBy?: string | null;
  }): Promise<{ processed: number; sendIds: string[] }> {
    const now = options?.now ?? new Date();
    const ready = options?.associationId
      ? await db
          .select()
          .from(noticeSends)
          .where(
            and(
              eq(noticeSends.associationId, options.associationId),
              eq(noticeSends.status, "scheduled"),
              lte(noticeSends.sentAt, now),
            ),
          )
      : await db
          .select()
          .from(noticeSends)
          .where(and(eq(noticeSends.status, "scheduled"), lte(noticeSends.sentAt, now)));

    const results = await mapInBatches(ready, 10, async (row) => {
      return this.deliverNoticeSend(row, options?.actedBy ?? "scheduler@system");
    });
    const sendIds = results.map((result) => result.send.id);

    return { processed: sendIds.length, sendIds };
  }

  async getCommunicationHistory(associationId?: string): Promise<CommunicationHistory[]> {
    if (!associationId) {
      return db.select().from(communicationHistory).orderBy(desc(communicationHistory.createdAt));
    }
    return db
      .select()
      .from(communicationHistory)
      .where(eq(communicationHistory.associationId, associationId))
      .orderBy(desc(communicationHistory.createdAt));
  }

  async getPermissionEnvelopes(associationId?: string): Promise<PermissionEnvelope[]> {
    if (!associationId) {
      return db.select().from(permissionEnvelopes).orderBy(desc(permissionEnvelopes.createdAt));
    }
    return db
      .select()
      .from(permissionEnvelopes)
      .where(eq(permissionEnvelopes.associationId, associationId))
      .orderBy(desc(permissionEnvelopes.createdAt));
  }

  async createPermissionEnvelope(data: InsertPermissionEnvelope): Promise<PermissionEnvelope> {
    const [result] = await db
      .insert(permissionEnvelopes)
      .values({ ...data, updatedAt: new Date() })
      .returning();
    return result;
  }

  async updatePermissionEnvelope(id: string, data: Partial<InsertPermissionEnvelope>): Promise<PermissionEnvelope | undefined> {
    const [result] = await db
      .update(permissionEnvelopes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(permissionEnvelopes.id, id))
      .returning();
    return result;
  }

  async getAdminAssociationScopes(): Promise<AdminAssociationScope[]> {
    return db.select().from(adminAssociationScopes).orderBy(desc(adminAssociationScopes.createdAt));
  }

  async getAdminAssociationScopesByUserId(adminUserId: string): Promise<AdminAssociationScope[]> {
    return db
      .select()
      .from(adminAssociationScopes)
      .where(eq(adminAssociationScopes.adminUserId, adminUserId))
      .orderBy(desc(adminAssociationScopes.createdAt));
  }

  async upsertAdminAssociationScope(data: InsertAdminAssociationScope): Promise<AdminAssociationScope> {
    const [existing] = await db
      .select()
      .from(adminAssociationScopes)
      .where(and(eq(adminAssociationScopes.adminUserId, data.adminUserId), eq(adminAssociationScopes.associationId, data.associationId)));
    if (!existing) {
      const [created] = await db.insert(adminAssociationScopes).values(data).returning();
      return created;
    }
    const [updated] = await db
      .update(adminAssociationScopes)
      .set({ scope: data.scope })
      .where(eq(adminAssociationScopes.id, existing.id))
      .returning();
    return updated;
  }

  async getPortalAccesses(associationId?: string): Promise<PortalAccess[]> {
    if (!associationId) return db.select().from(portalAccess).orderBy(desc(portalAccess.createdAt));
    return db.select().from(portalAccess).where(eq(portalAccess.associationId, associationId)).orderBy(desc(portalAccess.createdAt));
  }

  async getPortalAccessesByEmail(email: string): Promise<PortalAccess[]> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return [];
    return db
      .select()
      .from(portalAccess)
      .where(eq(portalAccess.email, normalizedEmail))
      .orderBy(desc(portalAccess.createdAt));
  }

  async createPortalAccess(data: InsertPortalAccess, actorEmail?: string | null): Promise<PortalAccess> {
    const now = new Date();
    const normalizedEmail = data.email.trim().toLowerCase();
    const status = data.status ?? "active";
    const [result] = await db
      .insert(portalAccess)
      .values({
        ...data,
        email: normalizedEmail,
        status,
        invitedAt: data.invitedAt ?? (status === "invited" ? now : data.invitedAt ?? null),
        acceptedAt: data.acceptedAt ?? (status === "active" ? now : data.acceptedAt ?? null),
        suspendedAt: data.suspendedAt ?? (status === "suspended" ? now : null),
        revokedAt: data.revokedAt ?? (status === "revoked" ? now : null),
        updatedAt: now,
      })
      .returning();
    await this.recordAuditEvent({
      actorEmail: actorEmail || "system",
      action: "create",
      entityType: "portal-access",
      entityId: result.id,
      associationId: result.associationId,
      beforeJson: null,
      afterJson: result,
    });
    return result;
  }

  async updatePortalAccess(id: string, data: Partial<InsertPortalAccess>, actorEmail?: string | null): Promise<PortalAccess | undefined> {
    const [before] = await db.select().from(portalAccess).where(eq(portalAccess.id, id));
    if (!before) return undefined;
    const patch = { ...data } as Partial<InsertPortalAccess>;
    if (typeof patch.email === "string") {
      patch.email = patch.email.trim().toLowerCase();
    }
    const now = new Date();
    const nextStatus = patch.status ?? before.status;
    if (patch.status && patch.status !== before.status) {
      if (nextStatus === "invited" && patch.invitedAt === undefined) patch.invitedAt = now;
      if (nextStatus === "active") {
        if (patch.acceptedAt === undefined) patch.acceptedAt = before.acceptedAt ?? now;
        if (patch.suspendedAt === undefined) patch.suspendedAt = null;
      }
      if (nextStatus === "suspended" && patch.suspendedAt === undefined) patch.suspendedAt = now;
      if (nextStatus === "revoked" && patch.revokedAt === undefined) patch.revokedAt = now;
    }
    const [result] = await db
      .update(portalAccess)
      .set({ ...patch, updatedAt: now })
      .where(eq(portalAccess.id, id))
      .returning();
    if (result) {
      await this.recordAuditEvent({
        actorEmail: actorEmail || "system",
        action: "update",
        entityType: "portal-access",
        entityId: result.id,
        associationId: result.associationId,
        beforeJson: before,
        afterJson: result,
      });
    }
    return result;
  }

  async getPortalAccessById(id: string): Promise<PortalAccess | undefined> {
    const [result] = await db.select().from(portalAccess).where(eq(portalAccess.id, id));
    return result;
  }

  async getPortalAccessByAssociationEmail(associationId: string, email: string): Promise<PortalAccess | undefined> {
    const [result] = await db
      .select()
      .from(portalAccess)
      .where(and(eq(portalAccess.associationId, associationId), eq(portalAccess.email, email.trim().toLowerCase())));
    return result;
  }

  async resolvePortalAccessContext(portalAccessId: string): Promise<{
    access: PortalAccess;
    boardRole: BoardRole | null;
    hasBoardAccess: boolean;
    effectiveRole: "owner" | "tenant" | "readonly" | "board-member" | "owner-board-member";
  } | undefined> {
    let access = await this.getPortalAccessById(portalAccessId);
    if (!access || access.status !== "active") return undefined;

    // Enforce 30-day session expiry based on last login
    const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
    if (access.lastLoginAt) {
      const elapsed = Date.now() - new Date(access.lastLoginAt).getTime();
      if (elapsed > SESSION_MAX_AGE_MS) return undefined;
    }

    let boardRole: BoardRole | null = null;
    if (access.boardRoleId) {
      const now = new Date();
      const [matchedRole] = await db
        .select()
        .from(boardRoles)
        .where(
          and(
            eq(boardRoles.id, access.boardRoleId),
            eq(boardRoles.associationId, access.associationId),
            eq(boardRoles.personId, access.personId),
            lte(boardRoles.startDate, now),
            or(isNull(boardRoles.endDate), gte(boardRoles.endDate, now)),
          ),
        );
      boardRole = matchedRole ?? null;
    }

    const [ownerMembership] = await db
      .select()
      .from(associationMemberships)
      .where(
        and(
          eq(associationMemberships.associationId, access.associationId),
          eq(associationMemberships.personId, access.personId),
          eq(associationMemberships.membershipType, "owner"),
          eq(associationMemberships.status, "active"),
        ),
      );
    const hasOwnerAccess = Boolean(ownerMembership) || access.role === "owner";

    if (access.boardRoleId && !boardRole) {
      if (hasOwnerAccess) {
        access = (await this.updatePortalAccess(access.id, {
          role: "owner",
          boardRoleId: null,
        }, "system")) ?? access;
      } else if (access.role === "board-member") {
        await this.updatePortalAccess(access.id, {
          status: "expired",
        }, "system");
        return undefined;
      }
    }

    const hasBoardAccess = Boolean(boardRole);
    const effectiveRole = hasBoardAccess
      ? ((hasOwnerAccess || access.role === "owner") ? "owner-board-member" : "board-member")
      : (hasOwnerAccess ? "owner" : access.role);

    return {
      access,
      boardRole,
      hasBoardAccess,
      effectiveRole,
    };
  }

  async inviteBoardMemberAccess(input: {
    associationId: string;
    personId: string;
    boardRoleId: string;
    email?: string | null;
    invitedBy?: string | null;
  }): Promise<PortalAccess> {
    const [person] = await db.select().from(persons).where(eq(persons.id, input.personId));
    if (!person) {
      throw new Error("Person not found");
    }

    const [boardRole] = await db
      .select()
      .from(boardRoles)
      .where(
        and(
          eq(boardRoles.id, input.boardRoleId),
          eq(boardRoles.personId, input.personId),
          eq(boardRoles.associationId, input.associationId),
        ),
      );
    if (!boardRole) {
      throw new Error("Board role not found for this person and association");
    }

    const normalizedEmail = (input.email || person.email || "").trim().toLowerCase();
    if (!normalizedEmail) {
      throw new Error("Board member invitation requires an email address");
    }

    const now = new Date();
    const [ownerMembership] = await db
      .select()
      .from(associationMemberships)
      .where(
        and(
          eq(associationMemberships.associationId, input.associationId),
          eq(associationMemberships.personId, input.personId),
          eq(associationMemberships.membershipType, "owner"),
          eq(associationMemberships.status, "active"),
        ),
      );

    const existing = await this.getPortalAccessByAssociationEmail(input.associationId, normalizedEmail);
    const nextRole = ownerMembership || existing?.role === "owner" ? "owner" : "board-member";
    const nextStatus = existing?.status === "active" ? "active" : "invited";

    if (!existing) {
      return this.createPortalAccess({
        associationId: input.associationId,
        personId: input.personId,
        unitId: ownerMembership?.unitId ?? null,
        email: normalizedEmail,
        role: nextRole,
        status: nextStatus,
        boardRoleId: input.boardRoleId,
        invitedBy: input.invitedBy ?? null,
        invitedAt: now,
        acceptedAt: nextStatus === "active" ? now : null,
        suspendedAt: null,
        revokedAt: null,
      }, input.invitedBy ?? "system");
    }

    const updated = await this.updatePortalAccess(existing.id, {
      personId: input.personId,
      unitId: existing.unitId ?? ownerMembership?.unitId ?? null,
      email: normalizedEmail,
      role: nextRole,
      status: nextStatus,
      boardRoleId: input.boardRoleId,
      invitedBy: input.invitedBy ?? existing.invitedBy ?? null,
      invitedAt: now,
      acceptedAt: nextStatus === "active" ? (existing.acceptedAt ?? now) : existing.acceptedAt ?? null,
      suspendedAt: existing.suspendedAt ?? null,
      revokedAt: existing.revokedAt ?? null,
    }, input.invitedBy ?? "system");
    if (!updated) {
      throw new Error("Failed to update board member access");
    }
    return updated;
  }

  async touchPortalAccessLogin(id: string): Promise<void> {
    await db.update(portalAccess).set({ lastLoginAt: new Date(), updatedAt: new Date() }).where(eq(portalAccess.id, id));
  }

  async getAssociationMemberships(associationId?: string): Promise<AssociationMembership[]> {
    if (!associationId) return db.select().from(associationMemberships).orderBy(desc(associationMemberships.createdAt));
    return db
      .select()
      .from(associationMemberships)
      .where(eq(associationMemberships.associationId, associationId))
      .orderBy(desc(associationMemberships.createdAt));
  }

  async upsertAssociationMembership(data: InsertAssociationMembership): Promise<AssociationMembership> {
    const membershipType = data.membershipType ?? "owner";
    const candidates = await db
      .select()
      .from(associationMemberships)
      .where(
        and(
          eq(associationMemberships.associationId, data.associationId),
          eq(associationMemberships.personId, data.personId),
          eq(associationMemberships.membershipType, membershipType),
        ),
      );
    const [existing] = candidates.filter((row) => row.unitId === (data.unitId ?? null));
    if (!existing) {
      const [created] = await db
        .insert(associationMemberships)
        .values({ ...data, membershipType, updatedAt: new Date() })
        .returning();
      return created;
    }
    const [updated] = await db
      .update(associationMemberships)
      .set({ ...data, membershipType, updatedAt: new Date() })
      .where(eq(associationMemberships.id, existing.id))
      .returning();
    return updated;
  }

  async getTenantConfig(associationId: string): Promise<TenantConfig | undefined> {
    const [result] = await db.select().from(tenantConfigs).where(eq(tenantConfigs.associationId, associationId));
    return result;
  }

  async upsertTenantConfig(data: InsertTenantConfig): Promise<TenantConfig> {
    const [existing] = await db.select().from(tenantConfigs).where(eq(tenantConfigs.associationId, data.associationId));
    if (!existing) {
      const [created] = await db.insert(tenantConfigs).values({ ...data, updatedAt: new Date() }).returning();
      return created;
    }
    const [updated] = await db
      .update(tenantConfigs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(tenantConfigs.id, existing.id))
      .returning();
    return updated;
  }

  async getEmailThreads(associationId?: string): Promise<EmailThread[]> {
    if (!associationId) return db.select().from(emailThreads).orderBy(desc(emailThreads.lastMessageAt));
    return db
      .select()
      .from(emailThreads)
      .where(eq(emailThreads.associationId, associationId))
      .orderBy(desc(emailThreads.lastMessageAt));
  }

  async upsertEmailThread(data: InsertEmailThread): Promise<EmailThread> {
    const [existing] = await db
      .select()
      .from(emailThreads)
      .where(and(eq(emailThreads.associationId, data.associationId), eq(emailThreads.subject, data.subject)));
    if (!existing) {
      const [created] = await db
        .insert(emailThreads)
        .values({
          ...data,
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      return created;
    }
    const incomingParticipants = Array.isArray(data.participantsJson) ? data.participantsJson : [];
    const existingParticipants = Array.isArray(existing.participantsJson) ? existing.participantsJson : [];
    const merged = Array.from(new Set([...existingParticipants, ...incomingParticipants]));
    const [updated] = await db
      .update(emailThreads)
      .set({
        participantsJson: merged,
        source: data.source,
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(emailThreads.id, existing.id))
      .returning();
    return updated;
  }

  async getContactUpdateRequests(filters?: { associationId?: string; portalAccessId?: string }): Promise<ContactUpdateRequest[]> {
    const rows = await db.select().from(contactUpdateRequests).orderBy(desc(contactUpdateRequests.createdAt));
    return rows.filter((row) => {
      if (filters?.associationId && row.associationId !== filters.associationId) return false;
      if (filters?.portalAccessId && row.portalAccessId !== filters.portalAccessId) return false;
      return true;
    });
  }

  async createContactUpdateRequest(data: InsertContactUpdateRequest): Promise<ContactUpdateRequest> {
    const [result] = await db
      .insert(contactUpdateRequests)
      .values({ ...data, reviewStatus: "pending", updatedAt: new Date() })
      .returning();
    await this.recordAuditEvent({
      actorEmail: "portal-user",
      action: "create",
      entityType: "contact-update-request",
      entityId: result.id,
      associationId: result.associationId,
      beforeJson: null,
      afterJson: result,
    });
    return result;
  }

  async reviewContactUpdateRequest(id: string, payload: { reviewStatus: "approved" | "rejected"; reviewedBy?: string | null }): Promise<ContactUpdateRequest | undefined> {
    const [before] = await db.select().from(contactUpdateRequests).where(eq(contactUpdateRequests.id, id));
    if (!before) return undefined;

    const [result] = await db
      .update(contactUpdateRequests)
      .set({
        reviewStatus: payload.reviewStatus,
        reviewedBy: payload.reviewedBy ?? null,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(contactUpdateRequests.id, id))
      .returning();

    if (payload.reviewStatus === "approved" && result.requestJson && typeof result.requestJson === "object") {
      const patch = result.requestJson as Record<string, unknown>;
      const personPatch: Partial<InsertPerson> = {};
      if (typeof patch.email === "string") personPatch.email = patch.email;
      if (typeof patch.phone === "string") personPatch.phone = patch.phone;
      if (typeof patch.mailingAddress === "string") personPatch.mailingAddress = patch.mailingAddress;
      if (typeof patch.emergencyContactName === "string") personPatch.emergencyContactName = patch.emergencyContactName;
      if (typeof patch.emergencyContactPhone === "string") personPatch.emergencyContactPhone = patch.emergencyContactPhone;
      if (typeof patch.contactPreference === "string") personPatch.contactPreference = patch.contactPreference;
      if (Object.keys(personPatch).length > 0) {
        await db.update(persons).set(personPatch).where(eq(persons.id, result.personId));
      }
    }

    await this.recordAuditEvent({
      actorEmail: payload.reviewedBy || "system",
      action: "update",
      entityType: "contact-update-request",
      entityId: result.id,
      associationId: result.associationId,
      beforeJson: before,
      afterJson: result,
    });
    return result;
  }

  async getMaintenanceRequests(filters?: {
    associationId?: string;
    portalAccessId?: string;
    status?: string;
  }): Promise<MaintenanceRequest[]> {
    let rows = await db.select().from(maintenanceRequests).orderBy(desc(maintenanceRequests.createdAt));
    if (filters?.associationId) rows = rows.filter((row) => row.associationId === filters.associationId);
    if (filters?.portalAccessId) rows = rows.filter((row) => row.submittedByPortalAccessId === filters.portalAccessId);
    if (filters?.status) rows = rows.filter((row) => row.status === filters.status);
    return rows;
  }

  private getMaintenanceResponseDueAt(priority: "low" | "medium" | "high" | "urgent", fromDate?: Date): Date {
    const start = fromDate ? new Date(fromDate) : new Date();
    const hoursByPriority: Record<string, number> = {
      low: 120,
      medium: 48,
      high: 12,
      urgent: 4,
    };
    const addHours = hoursByPriority[priority] ?? 48;
    start.setTime(start.getTime() + addHours * 60 * 60 * 1000);
    return start;
  }

  async createMaintenanceRequest(data: InsertMaintenanceRequest): Promise<MaintenanceRequest> {
    const priority = data.priority ?? "medium";
    const responseDueAt = this.getMaintenanceResponseDueAt(priority);
    const [result] = await db
      .insert(maintenanceRequests)
      .values({
        ...data,
        priority,
        status: data.status ?? "submitted",
        responseDueAt,
        escalationStage: 0,
        updatedAt: new Date(),
      })
      .returning();

    await this.createCommunicationHistoryRecord({
      associationId: result.associationId,
      channel: "portal",
      direction: "inbound",
      subject: `Maintenance request: ${result.title}`,
      bodySnippet: result.description.slice(0, 500),
      recipientEmail: null,
      recipientPersonId: result.submittedByPersonId ?? null,
      relatedType: "maintenance-request",
      relatedId: result.id,
      metadataJson: {
        status: result.status,
        priority: result.priority,
      },
    });

    await this.recordAuditEvent({
      actorEmail: result.submittedByEmail || "portal-user",
      action: "create",
      entityType: "maintenance-request",
      entityId: result.id,
      associationId: result.associationId,
      beforeJson: null,
      afterJson: result,
    });

    return result;
  }

  async updateMaintenanceRequest(id: string, data: Partial<InsertMaintenanceRequest>): Promise<MaintenanceRequest | undefined> {
    const [before] = await db.select().from(maintenanceRequests).where(eq(maintenanceRequests.id, id));
    if (!before) return undefined;

    const status = data.status ?? before.status;
    const nextPriority = data.priority ?? before.priority;
    const [result] = await db
      .update(maintenanceRequests)
      .set({
        ...data,
        status,
        responseDueAt: before.responseDueAt ?? this.getMaintenanceResponseDueAt(nextPriority),
        triagedAt: status === "triaged" && !before.triagedAt ? new Date() : before.triagedAt,
        resolvedAt: status === "resolved" && !before.resolvedAt ? new Date() : before.resolvedAt,
        closedAt: status === "closed" && !before.closedAt ? new Date() : before.closedAt,
        updatedAt: new Date(),
      })
      .where(eq(maintenanceRequests.id, id))
      .returning();

    if (before.status !== result.status) {
      await this.createCommunicationHistoryRecord({
        associationId: result.associationId,
        channel: "email",
        direction: "outbound",
        subject: `Maintenance status update: ${result.title}`,
        bodySnippet: `Status changed from ${before.status} to ${result.status}.`,
        recipientEmail: result.submittedByEmail ?? null,
        recipientPersonId: result.submittedByPersonId ?? null,
        relatedType: "maintenance-request-status",
        relatedId: result.id,
        metadataJson: {
          from: before.status,
          to: result.status,
        },
      });
    }

    await this.recordAuditEvent({
      actorEmail: "system",
      action: "update",
      entityType: "maintenance-request",
      entityId: result.id,
      associationId: result.associationId,
      beforeJson: before,
      afterJson: result,
    });

    return result;
  }

  private async validateWorkOrderAssociations(data: {
    associationId: string;
    unitId?: string | null;
    vendorId?: string | null;
    maintenanceRequestId?: string | null;
    vendorInvoiceId?: string | null;
  }) {
    if (data.unitId) {
      const [unit] = await db.select({ associationId: units.associationId }).from(units).where(eq(units.id, data.unitId));
      if (!unit) throw new Error("Unit not found");
      if (unit.associationId !== data.associationId) throw new Error("Unit does not belong to the selected association");
    }

    if (data.vendorId) {
      const [vendor] = await db.select({ associationId: vendors.associationId }).from(vendors).where(eq(vendors.id, data.vendorId));
      if (!vendor) throw new Error("Vendor not found");
      if (vendor.associationId !== data.associationId) throw new Error("Vendor does not belong to the selected association");
    }

    if (data.maintenanceRequestId) {
      const [request] = await db
        .select({ associationId: maintenanceRequests.associationId })
        .from(maintenanceRequests)
        .where(eq(maintenanceRequests.id, data.maintenanceRequestId));
      if (!request) throw new Error("Maintenance request not found");
      if (request.associationId !== data.associationId) throw new Error("Maintenance request does not belong to the selected association");
    }

    if (data.vendorInvoiceId) {
      const [invoice] = await db
        .select({ associationId: vendorInvoices.associationId, vendorId: vendorInvoices.vendorId })
        .from(vendorInvoices)
        .where(eq(vendorInvoices.id, data.vendorInvoiceId));
      if (!invoice) throw new Error("Vendor invoice not found");
      if (invoice.associationId !== data.associationId) throw new Error("Vendor invoice does not belong to the selected association");
      if (data.vendorId && invoice.vendorId && invoice.vendorId !== data.vendorId) {
        throw new Error("Vendor invoice does not belong to the selected vendor");
      }
    }
  }

  private normalizeInspectionFindings(findings: unknown): InspectionFindingItem[] {
    if (!Array.isArray(findings)) return [];
    const normalized: InspectionFindingItem[] = [];
    for (const finding of findings) {
      if (!finding || typeof finding !== "object") continue;
      const item = finding as Record<string, unknown>;
      const title = typeof item.title === "string" ? item.title.trim() : "";
      if (!title) continue;
      normalized.push({
        title,
        description: typeof item.description === "string" ? item.description.trim() : null,
        severity:
          item.severity === "low" || item.severity === "medium" || item.severity === "high" || item.severity === "critical"
            ? item.severity
            : "medium",
        status: item.status === "monitoring" || item.status === "resolved" ? item.status : "open",
        photoUrls: Array.isArray(item.photoUrls) ? item.photoUrls.filter((value): value is string => typeof value === "string" && value.trim().length > 0) : [],
        linkedWorkOrderId: typeof item.linkedWorkOrderId === "string" && item.linkedWorkOrderId.trim().length > 0 ? item.linkedWorkOrderId : null,
      });
    }
    return normalized;
  }

  async getInspectionRecords(filters?: {
    associationId?: string;
    unitId?: string;
    inspectionType?: string;
  }): Promise<InspectionRecord[]> {
    let rows = await db.select().from(inspectionRecords).orderBy(desc(inspectionRecords.inspectedAt), desc(inspectionRecords.updatedAt));
    if (filters?.associationId) rows = rows.filter((row) => row.associationId === filters.associationId);
    if (filters?.unitId) rows = rows.filter((row) => row.unitId === filters.unitId);
    if (filters?.inspectionType) rows = rows.filter((row) => row.inspectionType === filters.inspectionType);
    return rows;
  }

  async createInspectionRecord(data: InsertInspectionRecord, actorEmail?: string): Promise<InspectionRecord> {
    if (data.unitId) {
      const [unit] = await db.select({ associationId: units.associationId }).from(units).where(eq(units.id, data.unitId));
      if (!unit) throw new Error("Unit not found");
      if (unit.associationId !== data.associationId) throw new Error("Unit does not belong to the selected association");
    }

    const now = new Date();
    const [result] = await db
      .insert(inspectionRecords)
      .values({
        ...data,
        findingsJson: this.normalizeInspectionFindings(data.findingsJson),
        updatedAt: now,
      })
      .returning();

    await this.recordAuditEvent({
      actorEmail: actorEmail || "system",
      action: "create",
      entityType: "inspection-record",
      entityId: result.id,
      associationId: result.associationId,
      beforeJson: null,
      afterJson: result,
    });

    return result;
  }

  async updateInspectionRecord(id: string, data: Partial<InsertInspectionRecord>, actorEmail?: string): Promise<InspectionRecord | undefined> {
    const [before] = await db.select().from(inspectionRecords).where(eq(inspectionRecords.id, id));
    if (!before) return undefined;

    const nextAssociationId = data.associationId ?? before.associationId;
    const nextUnitId = data.unitId !== undefined ? data.unitId : before.unitId;
    if (nextUnitId) {
      const [unit] = await db.select({ associationId: units.associationId }).from(units).where(eq(units.id, nextUnitId));
      if (!unit) throw new Error("Unit not found");
      if (unit.associationId !== nextAssociationId) throw new Error("Unit does not belong to the selected association");
    }

    const [result] = await db
      .update(inspectionRecords)
      .set({
        ...data,
        associationId: nextAssociationId,
        findingsJson: data.findingsJson !== undefined ? this.normalizeInspectionFindings(data.findingsJson) : before.findingsJson,
        updatedAt: new Date(),
      })
      .where(eq(inspectionRecords.id, id))
      .returning();

    await this.recordAuditEvent({
      actorEmail: actorEmail || "system",
      action: "update",
      entityType: "inspection-record",
      entityId: result.id,
      associationId: result.associationId,
      beforeJson: before,
      afterJson: result,
    });

    return result;
  }

  async convertInspectionFindingToWorkOrder(
    id: string,
    findingIndex: number,
    payload?: Partial<InsertWorkOrder>,
    actorEmail?: string,
  ): Promise<WorkOrder> {
    const [record] = await db.select().from(inspectionRecords).where(eq(inspectionRecords.id, id));
    if (!record) throw new Error("Inspection record not found");

    const findings = this.normalizeInspectionFindings(record.findingsJson);
    const finding = findings[findingIndex];
    if (!finding) throw new Error("Inspection finding not found");
    if (finding.linkedWorkOrderId) {
      const [existing] = await db.select().from(workOrders).where(eq(workOrders.id, finding.linkedWorkOrderId));
      if (existing) return existing;
    }

    const workOrder = await this.createWorkOrder(
      {
        associationId: record.associationId,
        unitId: payload?.unitId ?? record.unitId ?? null,
        vendorId: payload?.vendorId ?? null,
        vendorInvoiceId: payload?.vendorInvoiceId ?? null,
        maintenanceRequestId: payload?.maintenanceRequestId ?? null,
        title: payload?.title ?? `${record.inspectionType}: ${finding.title}`,
        description: payload?.description ?? [finding.description, record.summary].filter(Boolean).join("\n\n"),
        locationText: payload?.locationText ?? record.locationText,
        category: payload?.category ?? "inspection-follow-up",
        priority:
          payload?.priority ??
          (finding.severity === "critical" ? "urgent" : finding.severity === "high" ? "high" : finding.severity === "low" ? "low" : "medium"),
        status: payload?.status ?? "open",
        assignedTo: payload?.assignedTo ?? null,
        estimatedCost: payload?.estimatedCost ?? null,
        actualCost: payload?.actualCost ?? null,
        scheduledFor: payload?.scheduledFor ?? null,
        resolutionNotes: payload?.resolutionNotes ?? null,
      },
      actorEmail,
    );

    findings[findingIndex] = {
      ...finding,
      linkedWorkOrderId: workOrder.id,
      status: finding.status === "resolved" ? "resolved" : "monitoring",
    };

    await db
      .update(inspectionRecords)
      .set({
        findingsJson: findings,
        updatedAt: new Date(),
      })
      .where(eq(inspectionRecords.id, id));

    await this.recordAuditEvent({
      actorEmail: actorEmail || "system",
      action: "create",
      entityType: "inspection-finding-conversion",
      entityId: workOrder.id,
      associationId: record.associationId,
      beforeJson: { inspectionRecordId: record.id, findingIndex, finding },
      afterJson: { workOrderId: workOrder.id, findingIndex, finding: findings[findingIndex] },
    });

    return workOrder;
  }

  private computeNextMaintenanceDueAt(
    dueAt: Date,
    frequencyUnit: MaintenanceScheduleTemplate["frequencyUnit"],
    frequencyInterval: number,
  ) {
    const next = new Date(dueAt);
    const interval = Math.max(1, frequencyInterval || 1);
    if (frequencyUnit === "year") {
      next.setFullYear(next.getFullYear() + interval);
      return next;
    }
    if (frequencyUnit === "quarter") {
      next.setMonth(next.getMonth() + interval * 3);
      return next;
    }
    next.setMonth(next.getMonth() + interval);
    return next;
  }

  async getMaintenanceScheduleTemplates(filters?: { associationId?: string; unitId?: string; status?: string }): Promise<MaintenanceScheduleTemplate[]> {
    let rows = await db
      .select()
      .from(maintenanceScheduleTemplates)
      .orderBy(desc(maintenanceScheduleTemplates.updatedAt), desc(maintenanceScheduleTemplates.createdAt));
    if (filters?.associationId) rows = rows.filter((row) => row.associationId === filters.associationId);
    if (filters?.unitId) rows = rows.filter((row) => row.unitId === filters.unitId);
    if (filters?.status) rows = rows.filter((row) => row.status === filters.status);
    return rows;
  }

  async createMaintenanceScheduleTemplate(data: InsertMaintenanceScheduleTemplate, actorEmail?: string): Promise<MaintenanceScheduleTemplate> {
    await this.validateWorkOrderAssociations({
      associationId: data.associationId,
      unitId: data.unitId ?? undefined,
      vendorId: data.vendorId ?? undefined,
    });

    const [result] = await db
      .insert(maintenanceScheduleTemplates)
      .values({
        ...data,
        updatedAt: new Date(),
      })
      .returning();

    await this.recordAuditEvent({
      actorEmail: actorEmail || "system",
      action: "create",
      entityType: "maintenance-schedule-template",
      entityId: result.id,
      associationId: result.associationId,
      beforeJson: null,
      afterJson: result,
    });

    return result;
  }

  async updateMaintenanceScheduleTemplate(
    id: string,
    data: Partial<InsertMaintenanceScheduleTemplate>,
    actorEmail?: string,
  ): Promise<MaintenanceScheduleTemplate | undefined> {
    const [before] = await db.select().from(maintenanceScheduleTemplates).where(eq(maintenanceScheduleTemplates.id, id));
    if (!before) return undefined;

    await this.validateWorkOrderAssociations({
      associationId: data.associationId ?? before.associationId,
      unitId: data.unitId !== undefined ? data.unitId : before.unitId,
      vendorId: data.vendorId !== undefined ? data.vendorId : before.vendorId,
    });

    const [result] = await db
      .update(maintenanceScheduleTemplates)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(maintenanceScheduleTemplates.id, id))
      .returning();

    await this.recordAuditEvent({
      actorEmail: actorEmail || "system",
      action: "update",
      entityType: "maintenance-schedule-template",
      entityId: result.id,
      associationId: result.associationId,
      beforeJson: before,
      afterJson: result,
    });

    return result;
  }

  async getMaintenanceScheduleInstances(filters?: { associationId?: string; templateId?: string; status?: string }): Promise<MaintenanceScheduleInstance[]> {
    let rows = await db
      .select()
      .from(maintenanceScheduleInstances)
      .orderBy(maintenanceScheduleInstances.dueAt, desc(maintenanceScheduleInstances.updatedAt));
    if (filters?.associationId) rows = rows.filter((row) => row.associationId === filters.associationId);
    if (filters?.templateId) rows = rows.filter((row) => row.templateId === filters.templateId);
    if (filters?.status) rows = rows.filter((row) => row.status === filters.status);
    return rows;
  }

  async createMaintenanceScheduleInstance(data: InsertMaintenanceScheduleInstance, actorEmail?: string): Promise<MaintenanceScheduleInstance> {
    await this.validateWorkOrderAssociations({
      associationId: data.associationId,
      unitId: data.unitId ?? undefined,
      vendorId: data.vendorId ?? undefined,
    });

    const [result] = await db
      .insert(maintenanceScheduleInstances)
      .values({
        ...data,
        updatedAt: new Date(),
      })
      .returning();

    await this.recordAuditEvent({
      actorEmail: actorEmail || "system",
      action: "create",
      entityType: "maintenance-schedule-instance",
      entityId: result.id,
      associationId: result.associationId,
      beforeJson: null,
      afterJson: result,
    });

    return result;
  }

  async generateMaintenanceScheduleInstances(
    templateId: string,
    options?: { throughDate?: Date; actorEmail?: string | null },
  ): Promise<MaintenanceScheduleInstance[]> {
    const [template] = await db.select().from(maintenanceScheduleTemplates).where(eq(maintenanceScheduleTemplates.id, templateId));
    if (!template) throw new Error("Maintenance schedule template not found");

    const throughDate = options?.throughDate ?? this.computeNextMaintenanceDueAt(new Date(template.nextDueAt), template.frequencyUnit, 3);
    const existing = await this.getMaintenanceScheduleInstances({ templateId });
    const existingDueKeys = new Set(existing.map((row) => new Date(row.dueAt).toISOString()));
    const created: MaintenanceScheduleInstance[] = [];
    let dueAt = new Date(template.nextDueAt);

    while (dueAt <= throughDate) {
      const dueKey = dueAt.toISOString();
      if (!existingDueKeys.has(dueKey)) {
        const instance = await this.createMaintenanceScheduleInstance(
          {
            templateId: template.id,
            associationId: template.associationId,
            unitId: template.unitId,
            vendorId: template.vendorId,
            workOrderId: null,
            title: template.title,
            component: template.component,
            locationText: template.locationText,
            dueAt,
            status: dueAt <= new Date() ? "due" : "scheduled",
          },
          options?.actorEmail || undefined,
        );
        created.push(instance);
      }
      dueAt = this.computeNextMaintenanceDueAt(dueAt, template.frequencyUnit, template.frequencyInterval);
    }

    const [updatedTemplate] = await db
      .update(maintenanceScheduleTemplates)
      .set({
        nextDueAt: dueAt,
        updatedAt: new Date(),
      })
      .where(eq(maintenanceScheduleTemplates.id, template.id))
      .returning();

    await this.recordAuditEvent({
      actorEmail: options?.actorEmail || "system",
      action: "update",
      entityType: "maintenance-schedule-template-generation",
      entityId: updatedTemplate.id,
      associationId: updatedTemplate.associationId,
      beforeJson: template,
      afterJson: updatedTemplate,
    });

    return created;
  }

  async convertMaintenanceInstanceToWorkOrder(
    id: string,
    payload?: Partial<InsertWorkOrder>,
    actorEmail?: string,
  ): Promise<WorkOrder> {
    const [instance] = await db.select().from(maintenanceScheduleInstances).where(eq(maintenanceScheduleInstances.id, id));
    if (!instance) throw new Error("Maintenance schedule instance not found");
    if (instance.workOrderId) {
      const [existing] = await db.select().from(workOrders).where(eq(workOrders.id, instance.workOrderId));
      if (existing) return existing;
    }

    const workOrder = await this.createWorkOrder(
      {
        associationId: instance.associationId,
        unitId: payload?.unitId ?? instance.unitId ?? null,
        vendorId: payload?.vendorId ?? instance.vendorId ?? null,
        vendorInvoiceId: payload?.vendorInvoiceId ?? null,
        maintenanceRequestId: payload?.maintenanceRequestId ?? null,
        title: payload?.title ?? instance.title,
        description: payload?.description ?? `Preventive maintenance for ${instance.component}`,
        locationText: payload?.locationText ?? instance.locationText,
        category: payload?.category ?? "preventive-maintenance",
        priority: payload?.priority ?? "medium",
        status: payload?.status ?? "open",
        assignedTo: payload?.assignedTo ?? null,
        estimatedCost: payload?.estimatedCost ?? null,
        actualCost: payload?.actualCost ?? null,
        scheduledFor: payload?.scheduledFor ?? instance.dueAt,
        resolutionNotes: payload?.resolutionNotes ?? null,
      },
      actorEmail,
    );

    await db
      .update(maintenanceScheduleInstances)
      .set({
        workOrderId: workOrder.id,
        status: "converted",
        updatedAt: new Date(),
      })
      .where(eq(maintenanceScheduleInstances.id, id));

    await this.recordAuditEvent({
      actorEmail: actorEmail || "system",
      action: "create",
      entityType: "maintenance-schedule-instance-conversion",
      entityId: workOrder.id,
      associationId: instance.associationId,
      beforeJson: instance,
      afterJson: { workOrderId: workOrder.id, instanceId: instance.id },
    });

    return workOrder;
  }

  async getWorkOrders(filters?: {
    associationId?: string;
    unitId?: string;
    vendorId?: string;
    maintenanceRequestId?: string;
    status?: string;
  }): Promise<WorkOrder[]> {
    let rows = await db.select().from(workOrders).orderBy(desc(workOrders.updatedAt), desc(workOrders.createdAt));
    if (filters?.associationId) rows = rows.filter((row) => row.associationId === filters.associationId);
    if (filters?.unitId) rows = rows.filter((row) => row.unitId === filters.unitId);
    if (filters?.vendorId) rows = rows.filter((row) => row.vendorId === filters.vendorId);
    if (filters?.maintenanceRequestId) rows = rows.filter((row) => row.maintenanceRequestId === filters.maintenanceRequestId);
    if (filters?.status) rows = rows.filter((row) => row.status === filters.status);
    return rows;
  }

  async createWorkOrder(data: InsertWorkOrder, actorEmail?: string): Promise<WorkOrder> {
    await this.validateWorkOrderAssociations(data);

    const status = data.status ?? "open";
    const now = new Date();
    const [result] = await db
      .insert(workOrders)
      .values({
        ...data,
        status,
        startedAt: status === "in-progress" ? now : null,
        completedAt: status === "closed" ? now : null,
        updatedAt: now,
      })
      .returning();

    if (result.maintenanceRequestId) {
      await this.updateMaintenanceRequest(result.maintenanceRequestId, {
        status: status === "closed" ? "resolved" : status === "in-progress" ? "in-progress" : "triaged",
        assignedTo: result.assignedTo ?? undefined,
      });

      const [request] = await db.select().from(maintenanceRequests).where(eq(maintenanceRequests.id, result.maintenanceRequestId));
      if (request?.submittedByEmail || request?.submittedByPersonId) {
        await this.createCommunicationHistoryRecord({
          associationId: result.associationId,
          channel: "email",
          direction: "outbound",
          subject: `Maintenance work order created: ${result.title}`,
          bodySnippet: `Your maintenance request has been converted into a managed work order with status ${result.status}.`,
          recipientEmail: request.submittedByEmail ?? null,
          recipientPersonId: request.submittedByPersonId ?? null,
          relatedType: "work-order-created",
          relatedId: result.id,
          metadataJson: {
            maintenanceRequestId: request.id,
            status: result.status,
            vendorId: result.vendorId,
          },
        });
      }
    }

    await this.recordAuditEvent({
      actorEmail: actorEmail || "system",
      action: "create",
      entityType: "work-order",
      entityId: result.id,
      associationId: result.associationId,
      beforeJson: null,
      afterJson: result,
    });

    return result;
  }

  async updateWorkOrder(id: string, data: Partial<InsertWorkOrder>, actorEmail?: string): Promise<WorkOrder | undefined> {
    const [before] = await db.select().from(workOrders).where(eq(workOrders.id, id));
    if (!before) return undefined;

    const nextAssociationId = data.associationId ?? before.associationId;
    await this.validateWorkOrderAssociations({
      associationId: nextAssociationId,
      unitId: data.unitId !== undefined ? data.unitId : before.unitId,
      vendorId: data.vendorId !== undefined ? data.vendorId : before.vendorId,
      maintenanceRequestId: data.maintenanceRequestId !== undefined ? data.maintenanceRequestId : before.maintenanceRequestId,
      vendorInvoiceId: data.vendorInvoiceId !== undefined ? data.vendorInvoiceId : before.vendorInvoiceId,
    });

    const status = data.status ?? before.status;
    const now = new Date();
    const [result] = await db
      .update(workOrders)
      .set({
        ...data,
        associationId: nextAssociationId,
        status,
        startedAt: status === "in-progress" && !before.startedAt ? now : before.startedAt,
        completedAt: status === "closed" ? (before.completedAt ?? now) : before.completedAt,
        updatedAt: now,
      })
      .where(eq(workOrders.id, id))
      .returning();

    if (result.maintenanceRequestId) {
      await this.updateMaintenanceRequest(result.maintenanceRequestId, {
        status: status === "closed" ? "resolved" : status === "in-progress" ? "in-progress" : "triaged",
        assignedTo: result.assignedTo ?? undefined,
        resolutionNotes: result.resolutionNotes ?? undefined,
      });

      const [request] = await db.select().from(maintenanceRequests).where(eq(maintenanceRequests.id, result.maintenanceRequestId));
      if ((before.status !== result.status || before.assignedTo !== result.assignedTo) && (request?.submittedByEmail || request?.submittedByPersonId)) {
        await this.createCommunicationHistoryRecord({
          associationId: result.associationId,
          channel: "email",
          direction: "outbound",
          subject: `Maintenance work order update: ${result.title}`,
          bodySnippet: `Work order status is now ${result.status}${result.assignedTo ? ` and assigned to ${result.assignedTo}` : ""}.`,
          recipientEmail: request.submittedByEmail ?? null,
          recipientPersonId: request.submittedByPersonId ?? null,
          relatedType: "work-order-status",
          relatedId: result.id,
          metadataJson: {
            maintenanceRequestId: request.id,
            fromStatus: before.status,
            toStatus: result.status,
            assignedTo: result.assignedTo,
          },
        });
      }
    }

    await this.recordAuditEvent({
      actorEmail: actorEmail || "system",
      action: "update",
      entityType: "work-order",
      entityId: result.id,
      associationId: result.associationId,
      beforeJson: before,
      afterJson: result,
    });

    return result;
  }

  async convertMaintenanceRequestToWorkOrder(id: string, payload?: Partial<InsertWorkOrder>, actorEmail?: string): Promise<WorkOrder> {
    const [request] = await db.select().from(maintenanceRequests).where(eq(maintenanceRequests.id, id));
    if (!request) throw new Error("Maintenance request not found");

    const existing = await this.getWorkOrders({ maintenanceRequestId: id });
    if (existing[0]) {
      return existing[0];
    }

    return this.createWorkOrder(
      {
        associationId: request.associationId,
        maintenanceRequestId: request.id,
        unitId: payload?.unitId ?? request.unitId ?? null,
        vendorId: payload?.vendorId ?? null,
        vendorInvoiceId: payload?.vendorInvoiceId ?? null,
        title: payload?.title ?? request.title,
        description: payload?.description ?? request.description,
        locationText: payload?.locationText ?? request.locationText ?? null,
        category: payload?.category ?? request.category,
        priority: payload?.priority ?? request.priority,
        status: payload?.status ?? "open",
        assignedTo: payload?.assignedTo ?? request.assignedTo ?? null,
        estimatedCost: payload?.estimatedCost ?? null,
        actualCost: payload?.actualCost ?? null,
        scheduledFor: payload?.scheduledFor ?? null,
        resolutionNotes: payload?.resolutionNotes ?? request.resolutionNotes ?? null,
      },
      actorEmail,
    );
  }

  async runMaintenanceEscalationSweep(options?: {
    associationId?: string;
    now?: Date;
    actorEmail?: string | null;
  }): Promise<{
    processed: number;
    escalated: number;
    escalatedIds: string[];
  }> {
    const now = options?.now ?? new Date();
    const eligible = await this.getMaintenanceRequests({ associationId: options?.associationId });
    const openItems = eligible.filter((row) =>
      row.status === "submitted" || row.status === "triaged" || row.status === "in-progress",
    );

    const escalatedIds: string[] = [];
    for (const item of openItems) {
      if (!item.responseDueAt || item.responseDueAt > now) continue;
      if (item.escalationStage >= 3) continue;

      const increment = item.priority === "urgent" ? 2 : 1;
      const nextStage = Math.min(3, item.escalationStage + increment);
      const [updated] = await db
        .update(maintenanceRequests)
        .set({
          escalationStage: nextStage,
          escalatedAt: now,
          lastEscalationNoticeAt: now,
          updatedAt: now,
        })
        .where(eq(maintenanceRequests.id, item.id))
        .returning();

      const supportEmail = (await this.getTenantConfig(updated.associationId))?.supportEmail ?? null;
      await this.createCommunicationHistoryRecord({
        associationId: updated.associationId,
        channel: "email",
        direction: "outbound",
        subject: `${updated.priority === "urgent" ? "Urgent " : ""}maintenance escalation stage ${nextStage}: ${updated.title}`,
        bodySnippet: `Request ${updated.id} exceeded SLA response due at ${updated.responseDueAt?.toISOString()}.`,
        recipientEmail: supportEmail,
        recipientPersonId: null,
        relatedType: "maintenance-escalation",
        relatedId: updated.id,
        metadataJson: {
          escalationStage: nextStage,
          priority: updated.priority,
          actorEmail: options?.actorEmail ?? "scheduler@system",
        },
      });

      await this.recordAuditEvent({
        actorEmail: options?.actorEmail || "scheduler@system",
        action: "update",
        entityType: "maintenance-request-escalation",
        entityId: updated.id,
        associationId: updated.associationId,
        beforeJson: item,
        afterJson: updated,
      });

      escalatedIds.push(updated.id);
    }

    return {
      processed: openItems.length,
      escalated: escalatedIds.length,
      escalatedIds,
    };
  }

  async getPortalDocuments(portalAccessId: string): Promise<Document[]> {
    const resolved = await this.resolvePortalAccessContext(portalAccessId);
    if (!resolved) return [];
    const { access, hasBoardAccess } = resolved;
    if (hasBoardAccess) {
      return db.select().from(documents).where(eq(documents.associationId, access.associationId));
    }

    const base = await db
      .select()
      .from(documents)
      .where(and(eq(documents.associationId, access.associationId), eq(documents.isPortalVisible, 1)));

    if (access.role === "tenant") {
      return base.filter((doc) => doc.portalAudience !== "owner");
    }
    return base;
  }

  async getPortalCommunicationHistory(portalAccessId: string): Promise<CommunicationHistory[]> {
    const resolved = await this.resolvePortalAccessContext(portalAccessId);
    if (!resolved) return [];
    const { access, hasBoardAccess } = resolved;
    const all = await this.getCommunicationHistory(access.associationId);
    if (hasBoardAccess) return all;
    return all.filter((row) => row.recipientEmail === access.email || row.recipientPersonId === access.personId);
  }

  async getUnitChangeHistory(unitId: string): Promise<UnitChangeHistory[]> {
    return db.select().from(unitChangeHistory).where(eq(unitChangeHistory.unitId, unitId)).orderBy(desc(unitChangeHistory.changedAt));
  }

  async getAssociationIdForScopedResource(resourceType: string, id: string): Promise<string | null | undefined> {
    switch (resourceType) {
      case "board-role": {
        const [result] = await db.select({ associationId: boardRoles.associationId }).from(boardRoles).where(eq(boardRoles.id, id));
        return result?.associationId;
      }
      case "document": {
        const [result] = await db.select({ associationId: documents.associationId }).from(documents).where(eq(documents.id, id));
        return result?.associationId;
      }
      case "document-tag": {
        const [result] = await db
          .select({ associationId: documents.associationId })
          .from(documentTags)
          .innerJoin(documents, eq(documents.id, documentTags.documentId))
          .where(eq(documentTags.id, id));
        return result?.associationId;
      }
      case "document-version": {
        const [result] = await db
          .select({ associationId: documents.associationId })
          .from(documentVersions)
          .innerJoin(documents, eq(documents.id, documentVersions.documentId))
          .where(eq(documentVersions.id, id));
        return result?.associationId;
      }
      case "hoa-fee-schedule": {
        const [result] = await db.select({ associationId: hoaFeeSchedules.associationId }).from(hoaFeeSchedules).where(eq(hoaFeeSchedules.id, id));
        return result?.associationId;
      }
      case "special-assessment": {
        const [result] = await db.select({ associationId: specialAssessments.associationId }).from(specialAssessments).where(eq(specialAssessments.id, id));
        return result?.associationId;
      }
      case "late-fee-rule": {
        const [result] = await db.select({ associationId: lateFeeRules.associationId }).from(lateFeeRules).where(eq(lateFeeRules.id, id));
        return result?.associationId;
      }
      case "financial-account": {
        const [result] = await db.select({ associationId: financialAccounts.associationId }).from(financialAccounts).where(eq(financialAccounts.id, id));
        return result?.associationId;
      }
      case "financial-category": {
        const [result] = await db.select({ associationId: financialCategories.associationId }).from(financialCategories).where(eq(financialCategories.id, id));
        return result?.associationId;
      }
      case "budget": {
        const [result] = await db.select({ associationId: budgets.associationId }).from(budgets).where(eq(budgets.id, id));
        return result?.associationId;
      }
      case "onboarding-submission": {
        const [result] = await db
          .select({ associationId: onboardingSubmissions.associationId })
          .from(onboardingSubmissions)
          .where(eq(onboardingSubmissions.id, id));
        return result?.associationId;
      }
      case "onboarding-invite": {
        const [result] = await db
          .select({ associationId: onboardingInvites.associationId })
          .from(onboardingInvites)
          .where(eq(onboardingInvites.id, id));
        return result?.associationId;
      }
      case "budget-version": {
        const [result] = await db
          .select({ associationId: budgets.associationId })
          .from(budgetVersions)
          .innerJoin(budgets, eq(budgets.id, budgetVersions.budgetId))
          .where(eq(budgetVersions.id, id));
        return result?.associationId;
      }
      case "budget-line": {
        const [result] = await db
          .select({ associationId: budgets.associationId })
          .from(budgetLines)
          .innerJoin(budgetVersions, eq(budgetVersions.id, budgetLines.budgetVersionId))
          .innerJoin(budgets, eq(budgets.id, budgetVersions.budgetId))
          .where(eq(budgetLines.id, id));
        return result?.associationId;
      }
      case "vendor-invoice": {
        const [result] = await db.select({ associationId: vendorInvoices.associationId }).from(vendorInvoices).where(eq(vendorInvoices.id, id));
        return result?.associationId;
      }
      case "vendor": {
        const [result] = await db.select({ associationId: vendors.associationId }).from(vendors).where(eq(vendors.id, id));
        return result?.associationId;
      }
      case "utility-payment": {
        const [result] = await db.select({ associationId: utilityPayments.associationId }).from(utilityPayments).where(eq(utilityPayments.id, id));
        return result?.associationId;
      }
      case "payment-method-config": {
        const [result] = await db.select({ associationId: paymentMethodConfigs.associationId }).from(paymentMethodConfigs).where(eq(paymentMethodConfigs.id, id));
        return result?.associationId;
      }
      case "governance-meeting": {
        const [result] = await db.select({ associationId: governanceMeetings.associationId }).from(governanceMeetings).where(eq(governanceMeetings.id, id));
        return result?.associationId;
      }
      case "meeting-agenda-item": {
        const [result] = await db
          .select({ associationId: governanceMeetings.associationId })
          .from(meetingAgendaItems)
          .innerJoin(governanceMeetings, eq(governanceMeetings.id, meetingAgendaItems.meetingId))
          .where(eq(meetingAgendaItems.id, id));
        return result?.associationId;
      }
      case "meeting-note": {
        const [result] = await db
          .select({ associationId: governanceMeetings.associationId })
          .from(meetingNotes)
          .innerJoin(governanceMeetings, eq(governanceMeetings.id, meetingNotes.meetingId))
          .where(eq(meetingNotes.id, id));
        return result?.associationId;
      }
      case "resolution": {
        const [result] = await db.select({ associationId: resolutions.associationId }).from(resolutions).where(eq(resolutions.id, id));
        return result?.associationId;
      }
      case "vote-record": {
        const [result] = await db
          .select({ associationId: resolutions.associationId })
          .from(voteRecords)
          .innerJoin(resolutions, eq(resolutions.id, voteRecords.resolutionId))
          .where(eq(voteRecords.id, id));
        return result?.associationId;
      }
      case "calendar-event": {
        const [result] = await db.select({ associationId: calendarEvents.associationId }).from(calendarEvents).where(eq(calendarEvents.id, id));
        return result?.associationId;
      }
      case "governance-template": {
        const [result] = await db.select({ associationId: governanceComplianceTemplates.associationId }).from(governanceComplianceTemplates).where(eq(governanceComplianceTemplates.id, id));
        return result?.associationId;
      }
      case "governance-template-item": {
        const [result] = await db
          .select({ associationId: governanceComplianceTemplates.associationId })
          .from(governanceTemplateItems)
          .innerJoin(governanceComplianceTemplates, eq(governanceComplianceTemplates.id, governanceTemplateItems.templateId))
          .where(eq(governanceTemplateItems.id, id));
        return result?.associationId;
      }
      case "annual-governance-task": {
        const [result] = await db.select({ associationId: annualGovernanceTasks.associationId }).from(annualGovernanceTasks).where(eq(annualGovernanceTasks.id, id));
        return result?.associationId;
      }
      case "ai-ingestion-job": {
        const [result] = await db.select({ associationId: aiIngestionJobs.associationId }).from(aiIngestionJobs).where(eq(aiIngestionJobs.id, id));
        return result?.associationId;
      }
      case "ai-extracted-record": {
        const [result] = await db.select({ associationId: aiExtractedRecords.associationId }).from(aiExtractedRecords).where(eq(aiExtractedRecords.id, id));
        return result?.associationId;
      }
      case "ai-ingestion-import-run": {
        const [result] = await db.select({ associationId: aiIngestionImportRuns.associationId }).from(aiIngestionImportRuns).where(eq(aiIngestionImportRuns.id, id));
        return result?.associationId;
      }
      case "clause-record": {
        const [result] = await db.select({ associationId: clauseRecords.associationId }).from(clauseRecords).where(eq(clauseRecords.id, id));
        return result?.associationId;
      }
      case "clause-tag": {
        const [result] = await db
          .select({ associationId: clauseRecords.associationId })
          .from(clauseTags)
          .innerJoin(clauseRecords, eq(clauseRecords.id, clauseTags.clauseRecordId))
          .where(eq(clauseTags.id, id));
        return result?.associationId;
      }
      case "suggested-link": {
        const [result] = await db
          .select({ associationId: clauseRecords.associationId })
          .from(suggestedLinks)
          .innerJoin(clauseRecords, eq(clauseRecords.id, suggestedLinks.clauseRecordId))
          .where(eq(suggestedLinks.id, id));
        return result?.associationId;
      }
      case "notice-template": {
        const [result] = await db.select({ associationId: noticeTemplates.associationId }).from(noticeTemplates).where(eq(noticeTemplates.id, id));
        return result?.associationId;
      }
      case "notice-send": {
        const [result] = await db.select({ associationId: noticeSends.associationId }).from(noticeSends).where(eq(noticeSends.id, id));
        return result?.associationId;
      }
      case "communication-history": {
        const [result] = await db.select({ associationId: communicationHistory.associationId }).from(communicationHistory).where(eq(communicationHistory.id, id));
        return result?.associationId;
      }
      case "permission-envelope": {
        const [result] = await db.select({ associationId: permissionEnvelopes.associationId }).from(permissionEnvelopes).where(eq(permissionEnvelopes.id, id));
        return result?.associationId;
      }
      case "portal-access": {
        const [result] = await db.select({ associationId: portalAccess.associationId }).from(portalAccess).where(eq(portalAccess.id, id));
        return result?.associationId;
      }
      case "association-membership": {
        const [result] = await db.select({ associationId: associationMemberships.associationId }).from(associationMemberships).where(eq(associationMemberships.id, id));
        return result?.associationId;
      }
      case "tenant-config": {
        const [result] = await db.select({ associationId: tenantConfigs.associationId }).from(tenantConfigs).where(eq(tenantConfigs.id, id));
        return result?.associationId;
      }
      case "maintenance-request": {
        const [result] = await db.select({ associationId: maintenanceRequests.associationId }).from(maintenanceRequests).where(eq(maintenanceRequests.id, id));
        return result?.associationId;
      }
      case "work-order": {
        const [result] = await db.select({ associationId: workOrders.associationId }).from(workOrders).where(eq(workOrders.id, id));
        return result?.associationId;
      }
      case "inspection-record": {
        const [result] = await db.select({ associationId: inspectionRecords.associationId }).from(inspectionRecords).where(eq(inspectionRecords.id, id));
        return result?.associationId;
      }
      case "maintenance-schedule-template": {
        const [result] = await db.select({ associationId: maintenanceScheduleTemplates.associationId }).from(maintenanceScheduleTemplates).where(eq(maintenanceScheduleTemplates.id, id));
        return result?.associationId;
      }
      case "maintenance-schedule-instance": {
        const [result] = await db.select({ associationId: maintenanceScheduleInstances.associationId }).from(maintenanceScheduleInstances).where(eq(maintenanceScheduleInstances.id, id));
        return result?.associationId;
      }
      case "board-package-template": {
        const [result] = await db.select({ associationId: boardPackageTemplates.associationId }).from(boardPackageTemplates).where(eq(boardPackageTemplates.id, id));
        return result?.associationId;
      }
      case "board-package": {
        const [result] = await db.select({ associationId: boardPackages.associationId }).from(boardPackages).where(eq(boardPackages.id, id));
        return result?.associationId;
      }
      case "contact-update-request": {
        const [result] = await db.select({ associationId: contactUpdateRequests.associationId }).from(contactUpdateRequests).where(eq(contactUpdateRequests.id, id));
        return result?.associationId;
      }
      default:
        return undefined;
    }
  }

  async createDocumentTag(data: InsertDocumentTag, actorEmail?: string): Promise<DocumentTag> {
    const [doc] = await db.select({ associationId: documents.associationId }).from(documents).where(eq(documents.id, data.documentId));
    if (!doc) {
      throw new Error("Document not found");
    }
    if (data.entityType === "vendor") {
      const [vendor] = await db.select({ associationId: vendors.associationId }).from(vendors).where(eq(vendors.id, data.entityId));
      if (!vendor) {
        throw new Error("Vendor not found");
      }
      if (vendor.associationId !== doc.associationId) {
        throw new Error("Vendor and document must belong to the same association");
      }
    }

    const [result] = await db.insert(documentTags).values(data).returning();
    await this.recordAuditEvent({
      actorEmail: actorEmail || "system",
      action: "create",
      entityType: "document-tag",
      entityId: result.id,
      associationId: doc?.associationId || null,
      beforeJson: null,
      afterJson: result,
    });
    return result;
  }

  async getDocumentTags(documentId: string): Promise<DocumentTag[]> {
    return db.select().from(documentTags).where(eq(documentTags.documentId, documentId));
  }

  async createDocumentVersion(data: InsertDocumentVersion, actorEmail?: string): Promise<DocumentVersion> {
    const [result] = await db.insert(documentVersions).values(data).returning();
    const [doc] = await db.select({ associationId: documents.associationId }).from(documents).where(eq(documents.id, result.documentId));
    await this.recordAuditEvent({
      actorEmail: actorEmail || "system",
      action: "create",
      entityType: "document-version",
      entityId: result.id,
      associationId: doc?.associationId || null,
      beforeJson: null,
      afterJson: result,
    });
    return result;
  }

  async getDocumentVersions(documentId: string): Promise<DocumentVersion[]> {
    return db.select().from(documentVersions).where(eq(documentVersions.documentId, documentId)).orderBy(desc(documentVersions.versionNumber));
  }

  async getAuditLogs(associationId?: string): Promise<AuditLog[]> {
    if (!associationId) {
      return db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt));
    }
    return db.select().from(auditLogs).where(eq(auditLogs.associationId, associationId)).orderBy(desc(auditLogs.createdAt));
  }

  async getAdminUsers(): Promise<AdminUser[]> {
    return db.select().from(adminUsers);
  }

  async getAdminUserById(id: string): Promise<AdminUser | undefined> {
    const [result] = await db.select().from(adminUsers).where(eq(adminUsers.id, id));
    return result;
  }

  async getAdminUserByEmail(email: string): Promise<AdminUser | undefined> {
    const normalizedEmail = email.trim().toLowerCase();
    const [result] = await db.select().from(adminUsers).where(ilike(adminUsers.email, normalizedEmail));
    return result;
  }

  async upsertAdminUser(data: InsertAdminUser): Promise<AdminUser> {
    const normalizedEmail = data.email.trim().toLowerCase();
    const existing = await this.getAdminUserByEmail(normalizedEmail);
    if (!existing) {
      const [created] = await db.insert(adminUsers).values({ ...data, email: normalizedEmail }).returning();
      return created;
    }

    // When updating an existing user, preserve their current role to prevent accidental downgrades.
    // Role changes must go through updateAdminUserRole which enforces audit logging.
    const [updated] = await db
      .update(adminUsers)
      .set({ isActive: data.isActive, updatedAt: new Date() })
      .where(eq(adminUsers.id, existing.id))
      .returning();
    return updated;
  }

  async updateAdminUserRole(id: string, role: NonNullable<InsertAdminUser["role"]>, changedBy: string, reason?: string): Promise<AdminUser | undefined> {
    const [existing] = await db.select().from(adminUsers).where(eq(adminUsers.id, id));
    if (!existing) return undefined;
    if (!reason?.trim()) {
      throw new Error("Reason is required for permission changes");
    }

    if (existing.role === "platform-admin" && role !== "platform-admin") {
      const activeUsers = await db.select().from(adminUsers).where(eq(adminUsers.isActive, 1));
      const remainingPlatformAdmins = activeUsers.filter((user) => user.role === "platform-admin" && user.id !== id);
      if (remainingPlatformAdmins.length === 0) {
        throw new Error("Cannot remove the last platform-admin");
      }
    }

    const [updated] = await db
      .update(adminUsers)
      .set({ role, updatedAt: new Date() })
      .where(eq(adminUsers.id, id))
      .returning();

    await db.insert(permissionChangeLogs).values({
      userId: existing.id,
      oldRole: existing.role as NonNullable<InsertAdminUser["role"]>,
      newRole: role,
      changedBy,
      reason: reason.trim(),
    });

    await this.recordAuditEvent({
      actorEmail: changedBy,
      action: "update",
      entityType: "admin-user-role",
      entityId: existing.id,
      associationId: null,
      beforeJson: { role: existing.role },
      afterJson: { role: updated.role, reason: reason.trim() },
    });

    return updated;
  }

  async setAdminUserActive(id: string, isActive: boolean, changedBy: string): Promise<AdminUser | undefined> {
    const [existing] = await db.select().from(adminUsers).where(eq(adminUsers.id, id));
    if (!existing) return undefined;

    // Prevent deactivating the last active platform-admin
    if (!isActive && existing.role === "platform-admin" && existing.isActive === 1) {
      const activeAdmins = await db.select().from(adminUsers).where(eq(adminUsers.isActive, 1));
      const remainingPlatformAdmins = activeAdmins.filter((u) => u.role === "platform-admin" && u.id !== id);
      if (remainingPlatformAdmins.length === 0) {
        throw new Error("Cannot deactivate the last active platform-admin");
      }
    }

    const [updated] = await db
      .update(adminUsers)
      .set({ isActive: isActive ? 1 : 0, updatedAt: new Date() })
      .where(eq(adminUsers.id, id))
      .returning();

    await this.recordAuditEvent({
      actorEmail: changedBy,
      action: "update",
      entityType: "admin-user-active",
      entityId: id,
      associationId: null,
      beforeJson: { isActive: existing.isActive },
      afterJson: { isActive: updated.isActive },
    });

    return updated;
  }

  async getAuthUserById(id: string): Promise<AuthUser | undefined> {
    const [result] = await db.select().from(authUsers).where(eq(authUsers.id, id));
    return result;
  }

  async getAuthUserByEmail(email: string): Promise<AuthUser | undefined> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return undefined;
    const [result] = await db.select().from(authUsers).where(eq(authUsers.email, normalizedEmail));
    return result;
  }

  async createAuthUser(data: InsertAuthUser): Promise<AuthUser> {
    const [result] = await db
      .insert(authUsers)
      .values({
        ...data,
        email: data.email.trim().toLowerCase(),
      })
      .returning();
    return result;
  }

  async updateAuthUser(id: string, data: Partial<InsertAuthUser>): Promise<AuthUser | undefined> {
    const [existing] = await db.select().from(authUsers).where(eq(authUsers.id, id));
    if (!existing) return undefined;

    const [result] = await db
      .update(authUsers)
      .set({
        ...data,
        email: typeof data.email === "string" ? data.email.trim().toLowerCase() : data.email,
        updatedAt: new Date(),
      })
      .where(eq(authUsers.id, id))
      .returning();
    return result;
  }

  async getAuthExternalAccount(provider: "google", providerAccountId: string): Promise<AuthExternalAccount | undefined> {
    const normalizedProviderAccountId = providerAccountId.trim();
    if (!normalizedProviderAccountId) return undefined;
    const [result] = await db
      .select()
      .from(authExternalAccounts)
      .where(and(
        eq(authExternalAccounts.provider, provider),
        eq(authExternalAccounts.providerAccountId, normalizedProviderAccountId),
      ));
    return result;
  }

  async getAuthExternalAccountByProviderEmail(provider: "google", providerEmail: string): Promise<AuthExternalAccount | undefined> {
    const normalizedProviderEmail = providerEmail.trim().toLowerCase();
    if (!normalizedProviderEmail) return undefined;
    const [result] = await db
      .select()
      .from(authExternalAccounts)
      .where(and(
        eq(authExternalAccounts.provider, provider),
        eq(authExternalAccounts.providerEmail, normalizedProviderEmail),
      ));
    return result;
  }

  async createAuthExternalAccount(data: InsertAuthExternalAccount): Promise<AuthExternalAccount> {
    const [result] = await db
      .insert(authExternalAccounts)
      .values({
        ...data,
        providerAccountId: data.providerAccountId.trim(),
        providerEmail: data.providerEmail ? data.providerEmail.trim().toLowerCase() : null,
      })
      .returning();
    return result;
  }

  async upsertAuthExternalAccount(data: InsertAuthExternalAccount): Promise<AuthExternalAccount> {
    const existing = await this.getAuthExternalAccount(data.provider, data.providerAccountId);
    if (!existing) {
      return this.createAuthExternalAccount(data);
    }
    const [result] = await db
      .update(authExternalAccounts)
      .set({
        ...data,
        providerAccountId: data.providerAccountId.trim(),
        providerEmail: data.providerEmail ? data.providerEmail.trim().toLowerCase() : null,
        updatedAt: new Date(),
      })
      .where(eq(authExternalAccounts.id, existing.id))
      .returning();
    return result;
  }

  async touchAuthUserLogin(userId: string): Promise<void> {
    await db
      .update(authUsers)
      .set({
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(authUsers.id, userId));
  }

  async getDashboardStats(options?: {
    associationIds?: string[];
    includeArchived?: boolean;
  }) {
    const includeArchived = options?.includeArchived ?? false;
    const scopedAssociationIds = Array.from(new Set((options?.associationIds ?? []).filter(Boolean)));

    const associationWhere = scopedAssociationIds.length > 0
      ? (includeArchived
          ? inArray(associations.id, scopedAssociationIds)
          : and(eq(associations.isArchived, 0), inArray(associations.id, scopedAssociationIds)))
      : (includeArchived ? undefined : eq(associations.isArchived, 0));

    const allAssociations = associationWhere
      ? await db.select().from(associations).where(associationWhere)
      : await db.select().from(associations);

    const associationIds = allAssociations.map((association) => association.id);
    if (associationIds.length === 0) {
      return {
        totalAssociations: 0,
        totalUnits: 0,
        totalOwners: 0,
        totalTenants: 0,
        totalBoardMembers: 0,
        totalDocuments: 0,
      };
    }

    const [scopedUnits, scopedBoardRoles, scopedDocuments] = await Promise.all([
      db.select().from(units).where(inArray(units.associationId, associationIds)),
      db.select().from(boardRoles).where(inArray(boardRoles.associationId, associationIds)),
      db.select().from(documents).where(inArray(documents.associationId, associationIds)),
    ]);

    const unitIds = scopedUnits.map((unit) => unit.id);
    const [allOwnerships, allOccupancies] = unitIds.length > 0
      ? await Promise.all([
        db.select().from(ownerships).where(inArray(ownerships.unitId, unitIds)),
        db.select().from(occupancies).where(inArray(occupancies.unitId, unitIds)),
      ])
      : [[], []];

    const activeOwnerships = allOwnerships.filter((ownership) => !ownership.endDate);
    const activeTenants = allOccupancies.filter((occupancy) => occupancy.occupancyType === "TENANT" && !occupancy.endDate);
    const activeBoardMembers = scopedBoardRoles.filter((role) => !role.endDate);

    return {
      totalAssociations: allAssociations.length,
      totalUnits: scopedUnits.length,
      totalOwners: activeOwnerships.length,
      totalTenants: activeTenants.length,
      totalBoardMembers: activeBoardMembers.length,
      totalDocuments: scopedDocuments.length,
    };
  }

  async getOperationsDashboard(associationId?: string) {
    const [allWorkOrders, allVendors, allInspections, allInstances, allAuditLogs] = await Promise.all([
      this.getWorkOrders({ associationId }),
      this.getVendors(associationId),
      this.getInspectionRecords({ associationId }),
      this.getMaintenanceScheduleInstances({ associationId }),
      this.getAuditLogs(associationId),
    ]);

    const now = new Date();
    const dueInstances = allInstances.filter((instance) => instance.status === "due" || instance.dueAt <= now);
    const openWorkOrders = allWorkOrders.filter((order) => order.status !== "closed" && order.status !== "cancelled");
    const openFindings = allInspections
      .flatMap((record) => this.normalizeInspectionFindings(record.findingsJson))
      .filter((finding) => finding.status !== "resolved").length;

    const opsEntityTypes = new Set([
      "vendor",
      "work-order",
      "inspection-record",
      "inspection-finding-conversion",
      "maintenance-schedule-template",
      "maintenance-schedule-instance",
      "maintenance-schedule-template-generation",
      "maintenance-schedule-instance-conversion",
    ]);

    return {
      totals: {
        openWorkOrders: openWorkOrders.length,
        dueMaintenance: dueInstances.length,
        openFindings,
        activeVendors: allVendors.filter((vendor) => vendor.status === "active").length,
        pendingRenewalVendors: allVendors.filter((vendor) => vendor.status === "pending-renewal").length,
        overdueInstances: allInstances.filter((instance) => instance.dueAt < now && !instance.workOrderId && instance.status !== "completed").length,
      },
      workOrderAging: {
        open: allWorkOrders.filter((order) => order.status === "open" || order.status === "assigned").length,
        inProgress: allWorkOrders.filter((order) => order.status === "in-progress").length,
        pendingReview: allWorkOrders.filter((order) => order.status === "pending-review").length,
        closed: allWorkOrders.filter((order) => order.status === "closed").length,
      },
      vendorStatus: {
        active: allVendors.filter((vendor) => vendor.status === "active").length,
        inactive: allVendors.filter((vendor) => vendor.status === "inactive").length,
        pendingRenewal: allVendors.filter((vendor) => vendor.status === "pending-renewal").length,
      },
      recentWorkOrders: allWorkOrders.slice(0, 8),
      dueInstances: dueInstances.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime()).slice(0, 8),
      recentInspections: allInspections.slice(0, 8),
      recentAudit: allAuditLogs.filter((entry) => opsEntityTypes.has(entry.entityType)).slice(0, 10),
    };
  }

  async exportOperationsReport(
    reportType: "vendors" | "work-orders" | "maintenance",
    associationId?: string,
  ) {
    const escapeCsv = (value: unknown) => {
      const text = value == null ? "" : String(value);
      if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
        return `"${text.replace(/"/g, "\"\"")}"`;
      }
      return text;
    };

    if (reportType === "vendors") {
      const vendors = await this.getVendors(associationId);
      const rows = [
        ["name", "trade", "status", "serviceArea", "primaryContactName", "primaryEmail", "insuranceExpiresAt"],
        ...vendors.map((vendor) => [
          vendor.name,
          vendor.trade,
          vendor.status,
          vendor.serviceArea ?? "",
          vendor.primaryContactName ?? "",
          vendor.primaryEmail ?? "",
          vendor.insuranceExpiresAt?.toISOString() ?? "",
        ]),
      ];
      return {
        filename: "vendor-report.csv",
        contentType: "text/csv; charset=utf-8",
        body: rows.map((row) => row.map(escapeCsv).join(",")).join("\n"),
      };
    }

    if (reportType === "work-orders") {
      const workOrders = await this.getWorkOrders({ associationId });
      const rows = [
        ["title", "status", "priority", "locationText", "assignedTo", "estimatedCost", "actualCost", "vendorId", "unitId", "updatedAt"],
        ...workOrders.map((order) => [
          order.title,
          order.status,
          order.priority,
          order.locationText ?? "",
          order.assignedTo ?? "",
          order.estimatedCost ?? "",
          order.actualCost ?? "",
          order.vendorId ?? "",
          order.unitId ?? "",
          order.updatedAt.toISOString(),
        ]),
      ];
      return {
        filename: "work-order-report.csv",
        contentType: "text/csv; charset=utf-8",
        body: rows.map((row) => row.map(escapeCsv).join(",")).join("\n"),
      };
    }

    const [templates, instances] = await Promise.all([
      this.getMaintenanceScheduleTemplates({ associationId }),
      this.getMaintenanceScheduleInstances({ associationId }),
    ]);
    const templateById = new Map(templates.map((template) => [template.id, template]));
    const rows = [
      ["templateTitle", "component", "locationText", "dueAt", "instanceStatus", "workOrderId", "templateStatus"],
      ...instances.map((instance) => {
        const template = templateById.get(instance.templateId);
        return [
          instance.title,
          instance.component,
          instance.locationText,
          instance.dueAt.toISOString(),
          instance.status,
          instance.workOrderId ?? "",
          template?.status ?? "",
        ];
      }),
    ];
    return {
      filename: "maintenance-report.csv",
      contentType: "text/csv; charset=utf-8",
      body: rows.map((row) => row.map(escapeCsv).join(",")).join("\n"),
    };
  }

  async getBoardPackageTemplates(associationId?: string): Promise<BoardPackageTemplate[]> {
    if (!associationId) {
      return db.select().from(boardPackageTemplates).orderBy(desc(boardPackageTemplates.updatedAt), desc(boardPackageTemplates.createdAt));
    }
    return db
      .select()
      .from(boardPackageTemplates)
      .where(eq(boardPackageTemplates.associationId, associationId))
      .orderBy(desc(boardPackageTemplates.updatedAt), desc(boardPackageTemplates.createdAt));
  }

  async createBoardPackageTemplate(data: InsertBoardPackageTemplate): Promise<BoardPackageTemplate> {
    const [result] = await db.insert(boardPackageTemplates).values({ ...data, updatedAt: new Date() }).returning();
    await this.recordAuditEvent({
      actorEmail: "system",
      action: "create",
      entityType: "board-package-template",
      entityId: result.id,
      associationId: result.associationId,
      beforeJson: null,
      afterJson: result,
    });
    return result;
  }

  async updateBoardPackageTemplate(id: string, data: Partial<InsertBoardPackageTemplate>): Promise<BoardPackageTemplate | undefined> {
    const [before] = await db.select().from(boardPackageTemplates).where(eq(boardPackageTemplates.id, id));
    if (!before) return undefined;
    const [result] = await db
      .update(boardPackageTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(boardPackageTemplates.id, id))
      .returning();
    await this.recordAuditEvent({
      actorEmail: "system",
      action: "update",
      entityType: "board-package-template",
      entityId: result.id,
      associationId: result.associationId,
      beforeJson: before,
      afterJson: result,
    });
    return result;
  }

  async getBoardPackages(associationId?: string): Promise<BoardPackage[]> {
    if (!associationId) {
      return db.select().from(boardPackages).orderBy(desc(boardPackages.updatedAt), desc(boardPackages.createdAt));
    }
    return db
      .select()
      .from(boardPackages)
      .where(eq(boardPackages.associationId, associationId))
      .orderBy(desc(boardPackages.updatedAt), desc(boardPackages.createdAt));
  }

  async createBoardPackage(data: InsertBoardPackage): Promise<BoardPackage> {
    const [result] = await db.insert(boardPackages).values({ ...data, updatedAt: new Date() }).returning();
    await this.recordAuditEvent({
      actorEmail: "system",
      action: "create",
      entityType: "board-package",
      entityId: result.id,
      associationId: result.associationId,
      beforeJson: null,
      afterJson: result,
    });
    return result;
  }

  async updateBoardPackage(id: string, data: Partial<InsertBoardPackage>, actorEmail?: string): Promise<BoardPackage | undefined> {
    const [before] = await db.select().from(boardPackages).where(eq(boardPackages.id, id));
    if (!before) return undefined;
    const nextStatus = data.status ?? before.status;
    const now = new Date();
    const [result] = await db
      .update(boardPackages)
      .set({
        ...data,
        approvedBy:
          nextStatus === "approved"
            ? data.approvedBy ?? before.approvedBy ?? actorEmail ?? "system"
            : nextStatus === "draft"
              ? null
              : before.approvedBy,
        approvedAt:
          nextStatus === "approved"
            ? data.approvedAt ?? before.approvedAt ?? now
            : nextStatus === "draft"
              ? null
              : before.approvedAt,
        distributedBy:
          nextStatus === "distributed"
            ? data.distributedBy ?? before.distributedBy ?? actorEmail ?? "system"
            : nextStatus === "draft"
              ? null
              : before.distributedBy,
        distributedAt:
          nextStatus === "distributed"
            ? data.distributedAt ?? before.distributedAt ?? now
            : nextStatus === "draft"
              ? null
              : before.distributedAt,
        updatedAt: now,
      })
      .where(eq(boardPackages.id, id))
      .returning();
    await this.recordAuditEvent({
      actorEmail: actorEmail || "system",
      action: "update",
      entityType: "board-package",
      entityId: result.id,
      associationId: result.associationId,
      beforeJson: before,
      afterJson: result,
    });
    return result;
  }

  private getBoardPackagePeriodLabel(template: BoardPackageTemplate, scheduledAt?: Date) {
    const baseDate = scheduledAt ? new Date(scheduledAt) : new Date();
    if (template.frequency === "meeting-driven") {
      return `${template.meetingType || "meeting"} · ${baseDate.toLocaleDateString("en-US")}`;
    }
    if (template.frequency === "annual") {
      return String(baseDate.getFullYear());
    }
    if (template.frequency === "quarterly") {
      return `Q${Math.floor(baseDate.getMonth() / 3) + 1} ${baseDate.getFullYear()}`;
    }
    return baseDate.toLocaleString("en-US", { month: "long", year: "numeric" });
  }

  async generateBoardPackage(templateId: string, options?: { periodLabel?: string; meetingId?: string | null }): Promise<BoardPackage> {
    const [template] = await db.select().from(boardPackageTemplates).where(eq(boardPackageTemplates.id, templateId));
    if (!template) throw new Error("Board package template not found");
    const [meeting] = options?.meetingId
      ? await db.select().from(governanceMeetings).where(eq(governanceMeetings.id, options.meetingId))
      : [undefined];
    if (meeting && meeting.associationId !== template.associationId) {
      throw new Error("Meeting does not belong to the selected association");
    }

    const periodLabel = options?.periodLabel || this.getBoardPackagePeriodLabel(template, meeting?.scheduledAt ? new Date(meeting.scheduledAt) : undefined);
    const [existing] = await db
      .select()
      .from(boardPackages)
      .where(
        and(
          eq(boardPackages.templateId, template.id),
          eq(boardPackages.periodLabel, periodLabel),
          meeting ? eq(boardPackages.meetingId, meeting.id) : isNull(boardPackages.meetingId),
        ),
      );
    if (existing) return existing;

    const sections = Array.isArray(template.sectionsJson)
      ? template.sectionsJson.filter((value): value is string => typeof value === "string")
      : [];
    const requiresFinancial = sections.includes("financial") || sections.includes("delinquency");
    const requiresGovernance = sections.includes("governance");
    const requiresOperations = sections.includes("maintenance") || sections.includes("delinquency");
    const [operations, meetings, budgets, ledgerEntries] = await Promise.all([
      requiresOperations ? this.getOperationsDashboard(template.associationId) : null,
      requiresGovernance ? this.getGovernanceMeetings(template.associationId) : [],
      requiresFinancial ? this.getBudgets(template.associationId) : [],
      requiresFinancial ? this.getOwnerLedgerEntries(template.associationId) : [],
    ]);

    const content = sections.map((sectionKey) => {
      if (sectionKey === "financial") {
        const receivable = ledgerEntries.reduce((acc, entry) => acc + (entry.entryType === "charge" || entry.entryType === "late-fee" ? entry.amount : 0), 0);
        const payments = ledgerEntries.reduce((acc, entry) => acc + (entry.entryType === "payment" ? entry.amount : 0), 0);
        return {
          key: "financial",
          title: "Financial Summary",
          items: [
            `Open receivables posted: ${receivable.toFixed(2)}`,
            `Payments recorded: ${payments.toFixed(2)}`,
            `Budget count: ${budgets.length}`,
          ],
        };
      }
      if (sectionKey === "governance") {
        return {
          key: "governance",
          title: "Governance Summary",
          items: [
            `Meetings tracked: ${meetings.length}`,
            `Completed meetings: ${meetings.filter((meeting) => meeting.status === "completed").length}`,
            `Published summaries: ${meetings.filter((meeting) => meeting.summaryStatus === "published").length}`,
          ],
        };
      }
      if (sectionKey === "maintenance") {
        return {
          key: "maintenance",
          title: "Operations Summary",
          items: [
            `Open work orders: ${operations?.totals.openWorkOrders ?? 0}`,
            `Due maintenance instances: ${operations?.totals.dueMaintenance ?? 0}`,
            `Open inspection findings: ${operations?.totals.openFindings ?? 0}`,
          ],
        };
      }
      if (sectionKey === "delinquency") {
        const unpaidCharges = ledgerEntries.filter((entry) => entry.entryType === "charge" || entry.entryType === "late-fee").length;
        return {
          key: "delinquency",
          title: "Delinquency Snapshot",
          items: [
            `Charge entries posted: ${unpaidCharges}`,
            `Payments posted: ${ledgerEntries.filter((entry) => entry.entryType === "payment").length}`,
            `Pending renewal vendors: ${operations?.totals.pendingRenewalVendors ?? 0}`,
          ],
        };
      }
      return {
        key: sectionKey,
        title: sectionKey,
        items: [],
      };
    });

    return this.createBoardPackage({
      templateId: template.id,
      associationId: template.associationId,
      meetingId: meeting?.id ?? null,
      title: `${template.title} Package`,
      periodLabel,
      status: "draft",
      contentJson: content,
      annotationsJson: [],
    });
  }

  async runScheduledBoardPackageGeneration(options?: {
    associationId?: string;
    now?: Date;
    actorEmail?: string | null;
  }): Promise<{
    processed: number;
    generated: number;
    packageIds: string[];
  }> {
    const now = options?.now ?? new Date();
    const templates = (await this.getBoardPackageTemplates(options?.associationId)).filter((template) => Boolean(template.autoGenerate));
    const packageIds: string[] = [];

    for (const template of templates) {
      const meetings = (await this.getGovernanceMeetings(template.associationId))
        .filter((meeting) => meeting.status === "scheduled")
        .filter((meeting) => !template.meetingType || meeting.meetingType === template.meetingType);
      const leadDays = Math.max(0, template.generateDaysBefore || 0);
      let generatedForTemplate = false;

      for (const meeting of meetings) {
        const triggerAt = new Date(meeting.scheduledAt);
        triggerAt.setDate(triggerAt.getDate() - leadDays);
        if (triggerAt > now) continue;

        const periodLabel = this.getBoardPackagePeriodLabel(template, new Date(meeting.scheduledAt));
        const [existing] = await db
          .select()
          .from(boardPackages)
          .where(
            and(
              eq(boardPackages.templateId, template.id),
              eq(boardPackages.meetingId, meeting.id),
              eq(boardPackages.periodLabel, periodLabel),
            ),
          );
        if (existing) continue;

        const created = await this.generateBoardPackage(template.id, {
          meetingId: meeting.id,
          periodLabel,
        });
        packageIds.push(created.id);
        generatedForTemplate = true;
      }

      if (generatedForTemplate) {
        await db
          .update(boardPackageTemplates)
          .set({
            lastAutoGeneratedAt: now,
            updatedAt: new Date(),
          })
          .where(eq(boardPackageTemplates.id, template.id));

        await this.recordAuditEvent({
          actorEmail: options?.actorEmail || "scheduler@system",
          action: "update",
          entityType: "board-package-template-scheduled-generation",
          entityId: template.id,
          associationId: template.associationId,
          beforeJson: template,
          afterJson: { lastAutoGeneratedAt: now, generatedCount: packageIds.length },
        });
      }
    }

    return {
      processed: templates.length,
      generated: packageIds.length,
      packageIds,
    };
  }

  private async getDefaultBoardPackageRecipients(associationId: string): Promise<string[]> {
    const rows = await db
      .select({
        adminUserId: adminUsers.id,
        email: adminUsers.email,
        role: adminUsers.role,
        isActive: adminUsers.isActive,
        emailNotifications: adminUserPreferences.emailNotifications,
        pushNotifications: adminUserPreferences.pushNotifications,
        desktopNotifications: adminUserPreferences.desktopNotifications,
        alertDigest: adminUserPreferences.alertDigest,
        quietHoursEnabled: adminUserPreferences.quietHoursEnabled,
        quietHoursStart: adminUserPreferences.quietHoursStart,
        quietHoursEnd: adminUserPreferences.quietHoursEnd,
        notificationCategoryPreferencesJson: adminUserPreferences.notificationCategoryPreferencesJson,
      })
      .from(adminAssociationScopes)
      .innerJoin(adminUsers, eq(adminUsers.id, adminAssociationScopes.adminUserId))
      .leftJoin(adminUserPreferences, eq(adminUserPreferences.adminUserId, adminUsers.id))
      .where(eq(adminAssociationScopes.associationId, associationId));

    return Array.from(
      new Set(
        rows
          .filter((row) => row.isActive === 1)
          .filter((row) => row.role === "platform-admin" || row.role === "board-officer" || row.role === "assisted-board" || row.role === "pm-assistant" || row.role === "viewer")
          .filter((row) => {
            const preferences = normalizeAdminNotificationPreferences({
              emailNotifications: row.emailNotifications,
              pushNotifications: row.pushNotifications,
              desktopNotifications: row.desktopNotifications,
              alertDigest: row.alertDigest as any,
              quietHoursEnabled: row.quietHoursEnabled,
              quietHoursStart: row.quietHoursStart,
              quietHoursEnd: row.quietHoursEnd,
              notificationCategoryPreferences: (row.notificationCategoryPreferencesJson ?? {}) as Record<string, boolean>,
            });
            return preferences.emailNotifications && preferences.notificationCategoryPreferences.boardPackages;
          })
          .map((row) => row.email.trim().toLowerCase())
          .filter(Boolean),
      ),
    );
  }

  private renderBoardPackageText(boardPackage: BoardPackage): string {
    const sections = Array.isArray(boardPackage.contentJson) ? boardPackage.contentJson : [];
    const sectionText = sections.map((section: any, index: number) => {
      const title = typeof section?.title === "string" ? section.title : `Section ${index + 1}`;
      const items = Array.isArray(section?.items) ? section.items.map((item: unknown) => `- ${String(item)}`).join("\n") : "- No items";
      return `${title}\n${items}`;
    }).join("\n\n");
    return `${boardPackage.title}\n${boardPackage.periodLabel}\n\n${sectionText}`.trim();
  }

  private renderBoardPackageHtml(boardPackage: BoardPackage, message?: string | null): string {
    const sections = Array.isArray(boardPackage.contentJson) ? boardPackage.contentJson : [];
    const safeMessage = message ? `<p>${message.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\n", "<br/>")}</p>` : "";
    const sectionHtml = sections.map((section: any, index: number) => {
      const title = typeof section?.title === "string" ? section.title : `Section ${index + 1}`;
      const items = Array.isArray(section?.items) ? section.items.map((item: unknown) => `<li>${String(item)}</li>`).join("") : "<li>No items</li>";
      return `<section><h3>${title}</h3><ul>${items}</ul></section>`;
    }).join("");
    return `<div><h2>${boardPackage.title}</h2><p>${boardPackage.periodLabel}</p>${safeMessage}${sectionHtml}</div>`;
  }

  async distributeBoardPackage(
    id: string,
    payload?: { recipientEmails?: string[]; message?: string | null; actorEmail?: string | null },
  ): Promise<{
    boardPackage: BoardPackage;
    recipients: string[];
    historyIds: string[];
    sentCount: number;
    failedCount: number;
    failedRecipients: string[];
  }> {
    const [boardPackage] = await db.select().from(boardPackages).where(eq(boardPackages.id, id));
    if (!boardPackage) throw new Error("Board package not found");
    if (boardPackage.status === "draft") {
      throw new Error("Board package must be approved before distribution");
    }

    const explicitRecipients = Array.isArray(payload?.recipientEmails)
      ? payload!.recipientEmails.map((email) => email.trim().toLowerCase()).filter(Boolean)
      : [];
    const recipients = explicitRecipients.length > 0
      ? Array.from(new Set(explicitRecipients))
      : await this.getDefaultBoardPackageRecipients(boardPackage.associationId);
    if (recipients.length === 0) {
      throw new Error("No board package recipients are available");
    }

    const historyIds: string[] = [];
    let sentCount = 0;
    const failedRecipients: string[] = [];
    const textBody = this.renderBoardPackageText(boardPackage);
    const htmlBody = this.renderBoardPackageHtml(boardPackage, payload?.message ?? null);
    const actorEmail = payload?.actorEmail || "system";

    for (const recipientEmail of recipients) {
      const delivery = await sendPlatformEmail({
        associationId: boardPackage.associationId,
        to: recipientEmail,
        subject: `${boardPackage.title} - ${boardPackage.periodLabel}`,
        text: [payload?.message || "", textBody].filter(Boolean).join("\n\n"),
        html: htmlBody,
        templateKey: "board-package-distribution",
        metadata: {
          boardPackageId: boardPackage.id,
          associationId: boardPackage.associationId,
        },
        attachments: [
          {
            filename: `${boardPackage.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "board-package"}.txt`,
            contentType: "text/plain; charset=utf-8",
            content: textBody,
          },
        ],
        enableTracking: true,
      });

      const history = await this.createCommunicationHistoryRecord({
        associationId: boardPackage.associationId,
        channel: "email",
        direction: "outbound",
        subject: `${boardPackage.title} - ${boardPackage.periodLabel}`,
        bodySnippet: textBody.slice(0, 500),
        recipientEmail,
        recipientPersonId: null,
        relatedType: delivery.status === "sent" ? "board-package-distribution" : "board-package-distribution-failed",
        relatedId: boardPackage.id,
        metadataJson: {
          emailLogId: delivery.logId,
          provider: delivery.provider,
          providerMessageId: delivery.messageId,
          distributedBy: actorEmail,
          message: payload?.message ?? null,
          status: delivery.status,
          errorMessage: delivery.errorMessage ?? null,
        },
      });
      historyIds.push(history.id);

      if (delivery.status === "sent") {
        sentCount += 1;
      } else {
        failedRecipients.push(recipientEmail);
      }

      await this.upsertEmailThread({
        associationId: boardPackage.associationId,
        subject: `${boardPackage.title} - ${boardPackage.periodLabel}`,
        participantsJson: [recipientEmail],
        source: "internal",
      });
    }

    if (sentCount === 0) {
      throw new Error("Board package delivery failed for all recipients.");
    }

    let boardPackageResult = boardPackage;
    if (failedRecipients.length === 0) {
      const updated = await this.updateBoardPackage(boardPackage.id, { status: "distributed" }, actorEmail);
      if (!updated) throw new Error("Board package not found after distribution");
      boardPackageResult = updated;
    }

    return {
      boardPackage: boardPackageResult,
      recipients,
      historyIds,
      sentCount,
      failedCount: failedRecipients.length,
      failedRecipients,
    };
  }

  private async validateRoadmapDependencyIds(projectId: string, dependencyTaskIds: string[] = [], selfTaskId?: string): Promise<string[]> {
    const uniqueIds = Array.from(new Set(dependencyTaskIds.filter(Boolean))).filter((id) => id !== selfTaskId);
    if (uniqueIds.length === 0) return [];

    const rows = await db
      .select({ id: roadmapTasks.id, projectId: roadmapTasks.projectId })
      .from(roadmapTasks)
      .where(inArray(roadmapTasks.id, uniqueIds));

    const foundIds = new Set(rows.map((r) => r.id));
    const missingIds = uniqueIds.filter((id) => !foundIds.has(id));
    if (missingIds.length > 0) {
      throw new Error(`Invalid dependency task IDs: ${missingIds.join(", ")}`);
    }

    const crossProject = rows.filter((r) => r.projectId !== projectId).map((r) => r.id);
    if (crossProject.length > 0) {
      throw new Error(`Dependencies must stay within the same project: ${crossProject.join(", ")}`);
    }

    // Cycle detection: check that the proposed dependency edges would not create a
    // cycle. For updates, selfTaskId is the task being modified; for creates, we use
    // a synthetic placeholder ID to represent the not-yet-inserted task.
    const nodeId = selfTaskId ?? `__new_task_${Date.now()}__`;
    const allProjectTasks = await db
      .select({ id: roadmapTasks.id, dependencyTaskIds: roadmapTasks.dependencyTaskIds })
      .from(roadmapTasks)
      .where(eq(roadmapTasks.projectId, projectId));

    // Build adjacency map representing the dependency graph after the proposed change.
    const depMap = new Map<string, string[]>();
    for (const t of allProjectTasks) {
      depMap.set(t.id, (t.dependencyTaskIds ?? []) as string[]);
    }
    // Apply proposed change: nodeId will depend on uniqueIds.
    depMap.set(nodeId, uniqueIds);

    // DFS from nodeId following dependency edges; reaching nodeId again means a cycle.
    const visited = new Set<string>();
    const stack: string[] = [...uniqueIds];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === nodeId) {
        throw new Error("Circular dependency detected");
      }
      if (visited.has(current)) continue;
      visited.add(current);
      const deps = depMap.get(current) ?? [];
      for (const dep of deps) {
        stack.push(dep);
      }
    }

    return uniqueIds;
  }

  private async buildRoadmapResponse(): Promise<RoadmapResponse> {
    const [projects, workstreams, tasks, execUpdates, analysisVers] = await Promise.all([
      db.select().from(roadmapProjects),
      db.select().from(roadmapWorkstreams),
      db.select().from(roadmapTasks),
      db.select().from(executiveUpdates).orderBy(desc(executiveUpdates.deliveredAt), desc(executiveUpdates.updatedAt)),
      db.select().from(analysisVersions).orderBy(desc(analysisVersions.createdAt)),
    ]);

    const taskByWorkstream = new Map<string, RoadmapTask[]>();
    const taskByProject = new Map<string, RoadmapTask[]>();
    for (const task of tasks) {
      const wsList = taskByWorkstream.get(task.workstreamId) ?? [];
      wsList.push(task);
      taskByWorkstream.set(task.workstreamId, wsList);

      const projectList = taskByProject.get(task.projectId) ?? [];
      projectList.push(task);
      taskByProject.set(task.projectId, projectList);
    }

    const workstreamCountByProject = workstreams.reduce<Record<string, number>>((acc, ws) => {
      acc[ws.projectId] = (acc[ws.projectId] ?? 0) + 1;
      return acc;
    }, {});

    const workstreamsWithProgress = workstreams
      .map((workstream) => {
        const progress = computeProgress(taskByWorkstream.get(workstream.id) ?? []);
        return {
          ...workstream,
          progress: {
            ...progress,
            workstreamId: workstream.id,
          },
        };
      })
      .sort((a, b) => {
        if (a.projectId !== b.projectId) return a.projectId.localeCompare(b.projectId);
        return a.orderIndex - b.orderIndex;
      });

    const projectsWithProgress = projects
      .map((project) => {
        const progress = computeProgress(taskByProject.get(project.id) ?? []);
        return {
          ...project,
          progress: {
            ...progress,
            projectId: project.id,
            workstreamCount: workstreamCountByProject[project.id] ?? 0,
          },
        };
      })
      .sort((a, b) => {
        if (a.status === b.status) return a.title.localeCompare(b.title);
        const rank: Record<string, number> = { active: 0, complete: 1, archived: 2 };
        return (rank[a.status] ?? 99) - (rank[b.status] ?? 99);
      });

    const taskMap = new Map(tasks.map((task) => [task.id, task]));
    const timeline = tasks
      .map((task): TimelineItem => {
        const startsBeforeDependenciesComplete = task.dependencyTaskIds.some((dependencyId) => {
          const dependencyTask = taskMap.get(dependencyId);
          if (!dependencyTask || !task.targetStartDate || !dependencyTask.completedDate) return false;
          return task.targetStartDate < dependencyTask.completedDate;
        });

        return {
          taskId: task.id,
          projectId: task.projectId,
          workstreamId: task.workstreamId,
          title: task.title,
          targetStartDate: task.targetStartDate,
          targetEndDate: task.targetEndDate,
          dependencyTaskIds: task.dependencyTaskIds,
          startsBeforeDependenciesComplete,
        };
      })
      .sort((a, b) => {
        const aTime = a.targetStartDate?.getTime() ?? a.targetEndDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const bTime = b.targetStartDate?.getTime() ?? b.targetEndDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      });

    return {
      projects: projectsWithProgress,
      workstreams: workstreamsWithProgress,
      tasks,
      timeline,
      executiveUpdates: execUpdates,
      analysisVersions: analysisVers,
      refreshedAt: new Date().toISOString(),
    };
  }

  async getPlatformSubscription(associationId: string): Promise<PlatformSubscription | undefined> {
    const [row] = await db.select().from(platformSubscriptions).where(eq(platformSubscriptions.associationId, associationId));
    return row;
  }

  async getPlatformSubscriptionByStripeId(stripeSubscriptionId: string): Promise<PlatformSubscription | undefined> {
    const [row] = await db.select().from(platformSubscriptions).where(eq(platformSubscriptions.stripeSubscriptionId, stripeSubscriptionId));
    return row;
  }

  async createPlatformSubscription(data: InsertPlatformSubscription): Promise<PlatformSubscription> {
    const [row] = await db.insert(platformSubscriptions).values(data).returning();
    return row;
  }

  async updatePlatformSubscription(id: string, data: Partial<InsertPlatformSubscription>): Promise<PlatformSubscription | undefined> {
    const [row] = await db.update(platformSubscriptions).set({ ...data, updatedAt: new Date() }).where(eq(platformSubscriptions.id, id)).returning();
    return row;
  }

  async listPlatformSubscriptions(): Promise<PlatformSubscription[]> {
    return db.select().from(platformSubscriptions);
  }

  async getRoadmap(): Promise<RoadmapResponse> {
    return this.buildRoadmapResponse();
  }

  private async upsertExecutiveUpdateBySource(payload: {
    sourceType: "roadmap-task" | "roadmap-project";
    sourceKey: string;
    legacySourceKeys?: string[];
    status: "draft" | "published";
    title: string;
    headline: string;
    summary: string;
    problemStatement: string | null;
    solutionSummary: string | null;
    featuresDelivered: string[];
    businessValue: string | null;
    projectId: string | null;
    workstreamId: string | null;
    taskId: string | null;
    deliveredAt: Date | null;
  }): Promise<"created" | "updated"> {
    const [exactMatch] = await db
      .select()
      .from(executiveUpdates)
      .where(eq(executiveUpdates.sourceKey, payload.sourceKey))
      .limit(1);

    let current = exactMatch;
    if (!current) {
      const legacyKeys = (payload.legacySourceKeys ?? []).filter(Boolean);
      if (legacyKeys.length) {
        const legacyMatches = await db
          .select()
          .from(executiveUpdates)
          .where(inArray(executiveUpdates.sourceKey, legacyKeys))
          .limit(1);
        current = legacyMatches[0];
      }
    }

    if (!current) {
      await db.insert(executiveUpdates).values({
        title: payload.title,
        headline: payload.headline,
        summary: payload.summary,
        problemStatement: payload.problemStatement,
        solutionSummary: payload.solutionSummary,
        featuresDelivered: payload.featuresDelivered,
        businessValue: payload.businessValue,
        status: payload.status,
        sourceType: payload.sourceType,
        sourceKey: payload.sourceKey,
        projectId: payload.projectId,
        workstreamId: payload.workstreamId,
        taskId: payload.taskId,
        deliveredAt: payload.deliveredAt,
        displayOrder: 0,
        createdBy: "system",
        updatedAt: new Date(),
      });
      return "created";
    }

    const shouldUpdateSourceKey = current.sourceKey !== payload.sourceKey;
    await db
      .update(executiveUpdates)
      .set({
        title: payload.title,
        headline: payload.headline,
        summary: payload.summary,
        problemStatement: payload.problemStatement,
        solutionSummary: payload.solutionSummary,
        featuresDelivered: payload.featuresDelivered,
        businessValue: payload.businessValue,
        status: payload.status,
        ...(shouldUpdateSourceKey ? { sourceKey: payload.sourceKey } : {}),
        projectId: payload.projectId,
        workstreamId: payload.workstreamId,
        taskId: payload.taskId,
        deliveredAt: payload.deliveredAt,
        updatedAt: new Date(),
      })
      .where(eq(executiveUpdates.id, current.id));

    return "updated";
  }

  private async syncExecutiveUpdateFromTask(taskId: string): Promise<"created" | "updated" | "skipped"> {
    const [task] = await db.select().from(roadmapTasks).where(eq(roadmapTasks.id, taskId));
    if (!task || task.status !== "done") return "skipped";

    const [project] = await db.select().from(roadmapProjects).where(eq(roadmapProjects.id, task.projectId));
    const [workstream] = await db.select().from(roadmapWorkstreams).where(eq(roadmapWorkstreams.id, task.workstreamId));
    if (!project || !workstream) return "skipped";

    return this.upsertExecutiveUpdateBySource({
      sourceType: "roadmap-task",
      sourceKey: `roadmap-task:${task.id}`,
      status: "draft",
      title: `${project.title}: ${task.title}`,
      headline: task.title,
      summary: `Delivered in ${workstream.title}. ${task.description || "Roadmap deliverable completed."}`,
      problemStatement: `- Delivery Need: ${task.description || "Roadmap deliverable required completion."}`,
      solutionSummary: `- Delivered Outcome: ${task.title} completed in ${workstream.title}.`,
      featuresDelivered: [`Execution Item: ${task.title}`],
      businessValue: `Moves ${project.title} forward with a completed, production-tracked deliverable.`,
      projectId: project.id,
      workstreamId: workstream.id,
      taskId: task.id,
      deliveredAt: task.completedDate ?? new Date(),
    });
  }

  private async syncExecutiveUpdateFromProject(projectId: string): Promise<"created" | "updated" | "skipped"> {
    const [project] = await db.select().from(roadmapProjects).where(eq(roadmapProjects.id, projectId));
    if (!project || project.status !== "complete") return "skipped";

    const tasks = await db.select().from(roadmapTasks).where(eq(roadmapTasks.projectId, project.id));
    const doneCount = tasks.filter((task) => task.status === "done").length;
    const totalCount = tasks.length;
    const completion = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);
    const latestCompleted = tasks
      .filter((task) => task.status === "done")
      .map((task) => task.completedDate?.getTime() ?? 0)
      .sort((a, b) => b - a)[0] ?? 0;
    const deliveredAt = latestCompleted > 0 ? new Date(latestCompleted) : new Date();
    const completedTaskTitles = tasks
      .filter((task) => task.status === "done")
      .slice(0, 8)
      .map((task) => `Delivered Item: ${task.title}`);

    return this.upsertExecutiveUpdateBySource({
      sourceType: "roadmap-project",
      sourceKey: `slide:roadmap-project:${project.id}`,
      legacySourceKeys: [`roadmap-project:${project.id}`],
      status: "published",
      title: `${project.title} completed`,
      headline: `${project.title} reached ${completion}%`,
      summary: `Project completed with ${doneCount}/${totalCount} roadmap tasks delivered (${completion}%).`,
      problemStatement: `- Program Goal: Complete ${project.title} with clear execution tracking.\n- Delivery Requirement: Close all planned roadmap tasks for this phase.`,
      solutionSummary: `- Execution Result: ${project.title} is now complete.\n- Delivery Proof: ${doneCount} of ${totalCount} tasks are marked done (${completion}%).`,
      featuresDelivered: completedTaskTitles.length ? completedTaskTitles : ["Delivery Status: Project marked complete on roadmap"],
      businessValue: "Creates a clean executive proof point for customer-facing progress and product maturity.",
      projectId: project.id,
      workstreamId: null,
      taskId: null,
      deliveredAt,
    });
  }

  async createRoadmapProject(data: InsertRoadmapProject): Promise<RoadmapProject> {
    const [result] = await db.insert(roadmapProjects).values(data).returning();
    return result;
  }

  async createRoadmapWorkstream(data: InsertRoadmapWorkstream): Promise<RoadmapWorkstream> {
    const [project] = await db.select().from(roadmapProjects).where(eq(roadmapProjects.id, data.projectId));
    if (!project) {
      throw new Error("Project not found");
    }
    const [result] = await db.insert(roadmapWorkstreams).values(data).returning();
    return result;
  }

  async createRoadmapTask(data: InsertRoadmapTask): Promise<RoadmapTask> {
    const [workstream] = await db
      .select()
      .from(roadmapWorkstreams)
      .where(eq(roadmapWorkstreams.id, data.workstreamId));

    if (!workstream) {
      throw new Error("Workstream not found");
    }

    if (workstream.projectId !== data.projectId) {
      throw new Error("Task projectId must match workstream projectId");
    }

    const dependencyTaskIds = await this.validateRoadmapDependencyIds(data.projectId, data.dependencyTaskIds ?? []);
    const status = data.status ?? "todo";

    const [result] = await db
      .insert(roadmapTasks)
      .values({
        ...data,
        status,
        dependencyTaskIds,
        completedDate: status === "done" ? new Date() : null,
      })
      .returning();

    if (result.status === "done") {
      await this.syncExecutiveUpdateFromTask(result.id);
    }

    return result;
  }

  async updateRoadmapTask(id: string, data: Partial<InsertRoadmapTask>): Promise<RoadmapTask | undefined> {
    const [existing] = await db.select().from(roadmapTasks).where(eq(roadmapTasks.id, id));
    if (!existing) return undefined;

    const nextProjectId = data.projectId ?? existing.projectId;
    const nextWorkstreamId = data.workstreamId ?? existing.workstreamId;

    const [workstream] = await db
      .select()
      .from(roadmapWorkstreams)
      .where(eq(roadmapWorkstreams.id, nextWorkstreamId));
    if (!workstream) {
      throw new Error("Workstream not found");
    }
    if (workstream.projectId !== nextProjectId) {
      throw new Error("Task projectId must match workstream projectId");
    }

    const status = data.status ?? existing.status;
    let completedDate = existing.completedDate;
    if (existing.status !== "done" && status === "done") {
      completedDate = new Date();
    }
    if (existing.status === "done" && status !== "done") {
      completedDate = null;
    }

    const dependencyTaskIds = data.dependencyTaskIds
      ? await this.validateRoadmapDependencyIds(nextProjectId, data.dependencyTaskIds, id)
      : existing.dependencyTaskIds;

    const [result] = await db
      .update(roadmapTasks)
      .set({
        ...data,
        projectId: nextProjectId,
        workstreamId: nextWorkstreamId,
        status,
        dependencyTaskIds,
        completedDate,
        updatedAt: new Date(),
      })
      .where(eq(roadmapTasks.id, id))
      .returning();

    if (result && result.status === "done") {
      await this.syncExecutiveUpdateFromTask(result.id);
    }

    return result;
  }

  async updateRoadmapProject(id: string, data: Partial<InsertRoadmapProject>): Promise<RoadmapProject | undefined> {
    if (data.status === "complete") {
      const tasks = await db.select({ id: roadmapTasks.id, status: roadmapTasks.status }).from(roadmapTasks).where(eq(roadmapTasks.projectId, id));
      const remaining = tasks.filter((task) => task.status !== "done").length;
      if (remaining > 0) {
        throw new Error(`Cannot mark project complete while ${remaining} task(s) are not done`);
      }
    }

    const [result] = await db
      .update(roadmapProjects)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(roadmapProjects.id, id))
      .returning();
    if (result && result.status === "complete") {
      await this.syncExecutiveUpdateFromProject(result.id);
    }
    return result;
  }

  async updateRoadmapWorkstream(id: string, data: Partial<InsertRoadmapWorkstream>): Promise<RoadmapWorkstream | undefined> {
    const [existing] = await db.select().from(roadmapWorkstreams).where(eq(roadmapWorkstreams.id, id));
    if (!existing) return undefined;

    if (data.projectId && data.projectId !== existing.projectId) {
      const [targetProject] = await db.select({ id: roadmapProjects.id }).from(roadmapProjects).where(eq(roadmapProjects.id, data.projectId));
      if (!targetProject) {
        throw new Error("Project not found");
      }

      const linkedTasks = await db.select({ id: roadmapTasks.id }).from(roadmapTasks).where(eq(roadmapTasks.workstreamId, id)).limit(1);
      if (linkedTasks.length > 0) {
        throw new Error("Cannot move workstream to another project while tasks are linked; move tasks first");
      }
    }

    const [result] = await db
      .update(roadmapWorkstreams)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(roadmapWorkstreams.id, id))
      .returning();
    return result;
  }

  async getRoadmapProject(id: string): Promise<RoadmapProject | undefined> {
    const [result] = await db.select().from(roadmapProjects).where(eq(roadmapProjects.id, id));
    return result;
  }

  async getRoadmapWorkstream(id: string): Promise<RoadmapWorkstream | undefined> {
    const [result] = await db.select().from(roadmapWorkstreams).where(eq(roadmapWorkstreams.id, id));
    return result;
  }

  async getRoadmapTask(id: string): Promise<RoadmapTask | undefined> {
    const [result] = await db.select().from(roadmapTasks).where(eq(roadmapTasks.id, id));
    return result;
  }

  async deleteRoadmapTask(id: string): Promise<void> {
    const [existing] = await db.select({ id: roadmapTasks.id }).from(roadmapTasks).where(eq(roadmapTasks.id, id));
    if (!existing) return;
    await db.delete(roadmapTasks).where(eq(roadmapTasks.id, id));
    await db
      .update(roadmapTasks)
      .set({ dependencyTaskIds: sql`array_remove(${roadmapTasks.dependencyTaskIds}, ${id})` })
      .where(sql`${id} = ANY(${roadmapTasks.dependencyTaskIds})`);
  }

  async createRoadmapTaskAttachment(data: {
    taskId: string;
    fileUrl: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number | null;
    uploadedBy: string | null;
  }) {
    const [result] = await db
      .insert(roadmapTaskAttachments)
      .values(data)
      .returning();
    return result;
  }

  async getRoadmapTaskAttachments(taskId: string) {
    return db
      .select()
      .from(roadmapTaskAttachments)
      .where(eq(roadmapTaskAttachments.taskId, taskId));
  }

  async deleteRoadmapTaskAttachment(id: string): Promise<void> {
    await db.delete(roadmapTaskAttachments).where(eq(roadmapTaskAttachments.id, id));
  }

  async deleteRoadmapWorkstream(id: string): Promise<void> {
    const [existing] = await db.select({ id: roadmapWorkstreams.id }).from(roadmapWorkstreams).where(eq(roadmapWorkstreams.id, id));
    if (!existing) return;
    const tasks = await db.select({ id: roadmapTasks.id }).from(roadmapTasks).where(eq(roadmapTasks.workstreamId, id));
    for (const task of tasks) {
      await this.deleteRoadmapTask(task.id);
    }
    await db.delete(roadmapWorkstreams).where(eq(roadmapWorkstreams.id, id));
  }

  async deleteRoadmapProject(id: string): Promise<void> {
    const [existing] = await db.select({ id: roadmapProjects.id }).from(roadmapProjects).where(eq(roadmapProjects.id, id));
    if (!existing) return;
    const workstreams = await db.select({ id: roadmapWorkstreams.id }).from(roadmapWorkstreams).where(eq(roadmapWorkstreams.projectId, id));
    for (const workstream of workstreams) {
      await this.deleteRoadmapWorkstream(workstream.id);
    }
    await db.delete(roadmapProjects).where(eq(roadmapProjects.id, id));
  }

  async getExecutiveUpdates(): Promise<ExecutiveUpdate[]> {
    return db
      .select()
      .from(executiveUpdates)
      .orderBy(desc(executiveUpdates.deliveredAt), desc(executiveUpdates.updatedAt), desc(executiveUpdates.createdAt));
  }

  async createExecutiveUpdate(data: InsertExecutiveUpdate): Promise<ExecutiveUpdate> {
    const [result] = await db
      .insert(executiveUpdates)
      .values({ ...data, updatedAt: new Date() })
      .returning();
    return result;
  }

  async updateExecutiveUpdate(id: string, data: Partial<InsertExecutiveUpdate>): Promise<ExecutiveUpdate | undefined> {
    const [result] = await db
      .update(executiveUpdates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(executiveUpdates.id, id))
      .returning();
    return result;
  }

  async getExecutiveEvidence(executiveUpdateId: string): Promise<ExecutiveEvidence[]> {
    return db
      .select()
      .from(executiveEvidence)
      .where(eq(executiveEvidence.executiveUpdateId, executiveUpdateId))
      .orderBy(desc(executiveEvidence.createdAt));
  }

  async createExecutiveEvidence(data: InsertExecutiveEvidence): Promise<ExecutiveEvidence> {
    const [result] = await db.insert(executiveEvidence).values(data).returning();
    return result;
  }

  async syncExecutiveFromRoadmap(): Promise<{ created: number; updated: number }> {
    const [tasks, projects] = await Promise.all([
      db.select().from(roadmapTasks).where(eq(roadmapTasks.status, "done")),
      db.select().from(roadmapProjects).where(eq(roadmapProjects.status, "complete")),
    ]);

    let created = 0;
    let updated = 0;

    for (const task of tasks) {
      const result = await this.syncExecutiveUpdateFromTask(task.id);
      if (result === "created") created += 1;
      if (result === "updated") updated += 1;
    }
    for (const project of projects) {
      const result = await this.syncExecutiveUpdateFromProject(project.id);
      if (result === "created") created += 1;
      if (result === "updated") updated += 1;
    }

    return { created, updated };
  }

  async getAnalysisHistory(resourceId: string, module: string) {
    const [versions, runs] = await Promise.all([
      db
        .select()
        .from(analysisVersions)
        .where(and(eq(analysisVersions.resourceId, resourceId), eq(analysisVersions.module, module)))
        .orderBy(desc(analysisVersions.version)),
      db
        .select()
        .from(analysisRuns)
        .where(and(eq(analysisRuns.resourceId, resourceId), eq(analysisRuns.module, module)))
        .orderBy(desc(analysisRuns.createdAt)),
    ]);

    const versionsWithDiff = versions.map((version, index) => {
      const previousVersion = versions[index + 1];
      if (!previousVersion) {
        return { ...version, diffFromPrevious: null };
      }

      return {
        ...version,
        diffFromPrevious: computeAnalysisDiff(previousVersion.payloadJson, version.payloadJson),
      };
    });

    return {
      versions: versionsWithDiff,
      runs,
    };
  }

  async createAnalysisVersion(data: InsertAnalysisVersion): Promise<AnalysisVersion> {
    const [lastVersion] = await db
      .select({ version: analysisVersions.version })
      .from(analysisVersions)
      .where(and(eq(analysisVersions.resourceId, data.resourceId), eq(analysisVersions.module, data.module)))
      .orderBy(desc(analysisVersions.version))
      .limit(1);

    const [result] = await db
      .insert(analysisVersions)
      .values({
        ...data,
        version: (lastVersion?.version ?? 0) + 1,
      })
      .returning();

    return result;
  }

  async createAnalysisRun(data: InsertAnalysisRun): Promise<AnalysisRun> {
    const [result] = await db
      .insert(analysisRuns)
      .values(data)
      .returning();

    return result;
  }

  async revertAnalysisVersion(resourceId: string, module: string, versionId: string): Promise<AnalysisVersion> {
    const [target] = await db
      .select()
      .from(analysisVersions)
      .where(
        and(
          eq(analysisVersions.id, versionId),
          eq(analysisVersions.resourceId, resourceId),
          eq(analysisVersions.module, module),
        ),
      );

    if (!target) {
      throw new Error("Version not found");
    }

    return this.createAnalysisVersion({
      resourceId,
      module,
      version: target.version,
      payloadJson: target.payloadJson as any,
      itemCount: target.itemCount,
      trigger: `revert:${target.id}`,
    });
  }

  async getAdminAnalytics(days: number, associationId?: string) {
    const boundedDays = Math.max(1, Math.min(days || 30, 365));
    const since = new Date(Date.now() - boundedDays * 24 * 60 * 60 * 1000);

    const [projects, workstreams, tasks, runs, ledgerEntries, budgetsList, allBudgetVersions, allBudgetLines, accounts, categories, assessments] = await Promise.all([
      db.select().from(roadmapProjects),
      db.select().from(roadmapWorkstreams),
      db.select().from(roadmapTasks),
      db.select().from(analysisRuns).where(gte(analysisRuns.createdAt, since)),
      associationId
        ? db.select().from(ownerLedgerEntries).where(and(eq(ownerLedgerEntries.associationId, associationId), gte(ownerLedgerEntries.postedAt, since)))
        : db.select().from(ownerLedgerEntries).where(gte(ownerLedgerEntries.postedAt, since)),
      associationId ? db.select().from(budgets).where(eq(budgets.associationId, associationId)) : db.select().from(budgets),
      db.select().from(budgetVersions),
      db.select().from(budgetLines),
      associationId ? db.select().from(financialAccounts).where(eq(financialAccounts.associationId, associationId)) : db.select().from(financialAccounts),
      associationId ? db.select().from(financialCategories).where(eq(financialCategories.associationId, associationId)) : db.select().from(financialCategories),
      associationId ? db.select().from(specialAssessments).where(eq(specialAssessments.associationId, associationId)) : db.select().from(specialAssessments),
    ]);

    const totalRuns = runs.length;
    const successCount = runs.filter((run) => run.success === 1).length;
    const durationTotal = runs.reduce((acc, run) => acc + run.durationMs, 0);
    const itemCountTotal = runs.reduce((acc, run) => acc + run.itemCount, 0);

    const activeProjects = projects.filter((project) => project.status !== "archived");
    const archivedProjects = projects.filter((project) => project.status === "archived");
    const activeProjectIds = new Set(activeProjects.map((project) => project.id));
    const activeWorkstreams = workstreams.filter((workstream) => activeProjectIds.has(workstream.projectId));
    const activeTasks = tasks.filter((task) => activeProjectIds.has(task.projectId));

    const taskCountByProject = tasks.reduce<Record<string, number>>((acc, task) => {
      acc[task.projectId] = (acc[task.projectId] ?? 0) + 1;
      return acc;
    }, {});
    const doneTaskCountByProject = tasks.reduce<Record<string, number>>((acc, task) => {
      if (task.status === "done") {
        acc[task.projectId] = (acc[task.projectId] ?? 0) + 1;
      }
      return acc;
    }, {});
    const archivedCompletedProjects = archivedProjects.filter((project) => {
      const totalTaskCount = taskCountByProject[project.id] ?? 0;
      return totalTaskCount > 0 && (doneTaskCountByProject[project.id] ?? 0) === totalTaskCount;
    }).length;

    const todo = activeTasks.filter((task) => task.status === "todo").length;
    const inProgress = activeTasks.filter((task) => task.status === "in-progress").length;
    const done = activeTasks.filter((task) => task.status === "done").length;

    const throughput = activeTasks.filter((task) => task.completedDate && task.completedDate >= since).length;
    const monthlyBuckets = new Map<string, { charges: number; payments: number; credits: number }>();
    const charges = ledgerEntries.filter((entry) => entry.entryType === "charge" || entry.entryType === "assessment" || entry.entryType === "late-fee");
    const payments = ledgerEntries.filter((entry) => entry.entryType === "payment");
    const credits = ledgerEntries.filter((entry) => entry.entryType === "credit" || entry.entryType === "adjustment");

    for (const entry of ledgerEntries) {
      const postedAt = new Date(entry.postedAt);
      const period = `${postedAt.getUTCFullYear()}-${String(postedAt.getUTCMonth() + 1).padStart(2, "0")}`;
      const current = monthlyBuckets.get(period) ?? { charges: 0, payments: 0, credits: 0 };
      if (entry.entryType === "payment") {
        current.payments += Math.abs(entry.amount);
      } else if (entry.entryType === "credit" || entry.entryType === "adjustment") {
        current.credits += Math.abs(entry.amount);
      } else if (entry.entryType === "charge" || entry.entryType === "assessment" || entry.entryType === "late-fee") {
        current.charges += Math.abs(entry.amount);
      }
      monthlyBuckets.set(period, current);
    }

    const totalCharges = charges.reduce((acc, entry) => acc + Math.abs(entry.amount), 0);
    const totalPayments = payments.reduce((acc, entry) => acc + Math.abs(entry.amount), 0);
    const totalCredits = credits.reduce((acc, entry) => acc + Math.abs(entry.amount), 0);
    const openBalance = Number((totalCharges - totalPayments - totalCredits).toFixed(2));
    const collectionBase = totalCharges === 0 ? 0 : ((totalPayments + totalCredits) / totalCharges) * 100;
    const monthlyTrend = Array.from(monthlyBuckets.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([period, values]) => ({
        period,
        charges: Number(values.charges.toFixed(2)),
        payments: Number(values.payments.toFixed(2)),
        credits: Number(values.credits.toFixed(2)),
        collectionRate: values.charges === 0 ? 0 : Number((((values.payments + values.credits) / values.charges) * 100).toFixed(2)),
      }));
    const accountBalances = new Map<string, number>();
    const accountLatestChargeAt = new Map<string, Date | null>();

    for (const entry of ledgerEntries) {
      const key = `${entry.personId}:${entry.unitId}`;
      accountBalances.set(key, (accountBalances.get(key) ?? 0) + entry.amount);
      if (entry.entryType === "charge" || entry.entryType === "assessment" || entry.entryType === "late-fee") {
        const postedAt = new Date(entry.postedAt);
        const existing = accountLatestChargeAt.get(key);
        if (!existing || postedAt > existing) {
          accountLatestChargeAt.set(key, postedAt);
        }
      }
    }

    const agingBuckets = {
      current: 0,
      thirtyDays: 0,
      sixtyDays: 0,
      ninetyPlus: 0,
    };
    const delinquencyMovementMap = new Map<string, { delinquentAccounts: number; totalBalance: number }>();

    for (const [key, balance] of Array.from(accountBalances.entries())) {
      if (balance <= 0) continue;
      const lastChargeAt = accountLatestChargeAt.get(key);
      const ageDays = lastChargeAt ? Math.max(0, Math.floor((Date.now() - lastChargeAt.getTime()) / (24 * 60 * 60 * 1000))) : 0;
      if (ageDays >= 90) agingBuckets.ninetyPlus += balance;
      else if (ageDays >= 60) agingBuckets.sixtyDays += balance;
      else if (ageDays >= 30) agingBuckets.thirtyDays += balance;
      else agingBuckets.current += balance;

      const period = lastChargeAt
        ? `${lastChargeAt.getUTCFullYear()}-${String(lastChargeAt.getUTCMonth() + 1).padStart(2, "0")}`
        : "current";
      const current = delinquencyMovementMap.get(period) ?? { delinquentAccounts: 0, totalBalance: 0 };
      current.delinquentAccounts += 1;
      current.totalBalance += balance;
      delinquencyMovementMap.set(period, current);
    }

    const delinquencyMovement = Array.from(delinquencyMovementMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([period, value]) => ({
        period,
        delinquentAccounts: value.delinquentAccounts,
        totalBalance: Number(value.totalBalance.toFixed(2)),
      }));
    const budgetIds = new Set(budgetsList.map((budget) => budget.id));
    const scopedVersions = allBudgetVersions.filter((version) => budgetIds.has(version.budgetId));
    const selectedVersions = new Map<string, typeof allBudgetVersions[number]>();
    for (const version of scopedVersions) {
      const existing = selectedVersions.get(version.budgetId);
      if (!existing) {
        selectedVersions.set(version.budgetId, version);
        continue;
      }
      const existingScore = existing.status === "ratified" ? 10_000 + existing.versionNumber : existing.versionNumber;
      const nextScore = version.status === "ratified" ? 10_000 + version.versionNumber : version.versionNumber;
      if (nextScore > existingScore) {
        selectedVersions.set(version.budgetId, version);
      }
    }
    const selectedVersionIds = new Set(Array.from(selectedVersions.values()).map((version) => version.id));
    const scopedLines = allBudgetLines.filter((line) => selectedVersionIds.has(line.budgetVersionId));
    const accountById = new Map(accounts.map((account) => [account.id, account]));
    const categoryById = new Map(categories.map((category) => [category.id, category]));
    const isReserveLine = (line: typeof scopedLines[number]) => {
      const account = line.accountId ? accountById.get(line.accountId) : null;
      const category = line.categoryId ? categoryById.get(line.categoryId) : null;
      const text = `${line.lineItemName} ${account?.name || ""} ${account?.accountType || ""} ${category?.name || ""} ${category?.categoryType || ""}`.toLowerCase();
      return text.includes("reserve");
    };
    const reserveLines = scopedLines.filter(isReserveLine);
    const annualReserveContributions = reserveLines
      .filter((line) => {
        const text = `${line.lineItemName} ${(line.accountId ? accountById.get(line.accountId)?.name : "") || ""} ${(line.categoryId ? categoryById.get(line.categoryId)?.name : "") || ""}`.toLowerCase();
        return text.includes("contribution") || text.includes("funding") || text.includes("transfer") || text.includes("income") || text.includes("deposit");
      })
      .reduce((acc, line) => acc + Math.abs(line.plannedAmount), 0);
    const annualReserveExpenses = reserveLines
      .filter((line) => {
        const text = `${line.lineItemName} ${(line.accountId ? accountById.get(line.accountId)?.name : "") || ""} ${(line.categoryId ? categoryById.get(line.categoryId)?.name : "") || ""}`.toLowerCase();
        return text.includes("repair") || text.includes("replacement") || text.includes("project") || text.includes("roof") || text.includes("capital") || text.includes("expense");
      })
      .reduce((acc, line) => acc + Math.abs(line.plannedAmount), 0);
    const fallbackReservePlanned = reserveLines.reduce((acc, line) => acc + Math.abs(line.plannedAmount), 0);
    const normalizedAnnualReserveContributions = annualReserveContributions > 0 ? annualReserveContributions : Number((fallbackReservePlanned * 0.6).toFixed(2));
    const normalizedAnnualReserveExpenses = annualReserveExpenses > 0 ? annualReserveExpenses : Number((fallbackReservePlanned * 0.4).toFixed(2));
    const annualSpecialAssessmentContribution = assessments
      .filter((assessment) => assessment.isActive === 1)
      .reduce((acc, assessment) => {
        const start = new Date(assessment.startDate);
        const end = assessment.endDate ? new Date(assessment.endDate) : null;
        const durationMonths = end
          ? Math.max(1, (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth()) + 1)
          : Math.max(1, assessment.installmentCount || 1);
        const annualized = (assessment.totalAmount / durationMonths) * 12;
        return acc + annualized;
      }, 0);
    const currentReserveBalance = Number((normalizedAnnualReserveContributions + annualSpecialAssessmentContribution - normalizedAnnualReserveExpenses).toFixed(2));
    const forecastWindows = [12, 24, 36].map((months) => {
      const projectedNetChange = ((normalizedAnnualReserveContributions + annualSpecialAssessmentContribution - normalizedAnnualReserveExpenses) / 12) * months;
      return {
        months,
        projectedNetChange: Number(projectedNetChange.toFixed(2)),
        projectedEndingBalance: Number((currentReserveBalance + projectedNetChange).toFixed(2)),
      };
    });
    const expenseCategoryMap = new Map<string, { categoryId: string | null; categoryName: string; actualAmount: number; plannedAmount: number }>();
    const categoryNameFor = (categoryId: string | null) => {
      if (!categoryId) return "Uncategorized";
      return categoryById.get(categoryId)?.name || "Uncategorized";
    };

    for (const line of scopedLines) {
      const key = line.categoryId ?? "uncategorized";
      const current = expenseCategoryMap.get(key) ?? {
        categoryId: line.categoryId ?? null,
        categoryName: categoryNameFor(line.categoryId ?? null),
        actualAmount: 0,
        plannedAmount: 0,
      };
      current.plannedAmount += line.plannedAmount;
      expenseCategoryMap.set(key, current);
    }

    const invoiceCategoryBuckets = new Map<string, number>();
    for (const invoice of await this.getVendorInvoices(associationId)) {
      if (new Date(invoice.invoiceDate) < since) continue;
      const key = invoice.categoryId ?? "uncategorized";
      invoiceCategoryBuckets.set(key, (invoiceCategoryBuckets.get(key) ?? 0) + invoice.amount);
    }

    const utilityCategoryBuckets = new Map<string, number>();
    for (const utility of await this.getUtilityPayments(associationId)) {
      if (new Date(utility.createdAt) < since) continue;
      const key = utility.categoryId ?? "uncategorized";
      utilityCategoryBuckets.set(key, (utilityCategoryBuckets.get(key) ?? 0) + utility.amount);
    }

    for (const [key, amount] of Array.from(invoiceCategoryBuckets.entries())) {
      const current = expenseCategoryMap.get(key) ?? {
        categoryId: key === "uncategorized" ? null : key,
        categoryName: categoryNameFor(key === "uncategorized" ? null : key),
        actualAmount: 0,
        plannedAmount: 0,
      };
      current.actualAmount += amount;
      expenseCategoryMap.set(key, current);
    }

    for (const [key, amount] of Array.from(utilityCategoryBuckets.entries())) {
      const current = expenseCategoryMap.get(key) ?? {
        categoryId: key === "uncategorized" ? null : key,
        categoryName: categoryNameFor(key === "uncategorized" ? null : key),
        actualAmount: 0,
        plannedAmount: 0,
      };
      current.actualAmount += amount;
      expenseCategoryMap.set(key, current);
    }

    const expenseCategoryTrend = Array.from(expenseCategoryMap.values())
      .map((row) => ({
        ...row,
        actualAmount: Number(row.actualAmount.toFixed(2)),
        plannedAmount: Number(row.plannedAmount.toFixed(2)),
        varianceAmount: Number((row.plannedAmount - row.actualAmount).toFixed(2)),
      }))
      .sort((a, b) => Math.abs(b.actualAmount) - Math.abs(a.actualAmount))
      .slice(0, 8);

    return {
      analyzerMetrics: {
        totalRuns,
        successRate: totalRuns === 0 ? 0 : Number(((successCount / totalRuns) * 100).toFixed(2)),
        avgDurationMs: totalRuns === 0 ? 0 : Math.round(durationTotal / totalRuns),
        avgItemCount: totalRuns === 0 ? 0 : Math.round(itemCountTotal / totalRuns),
      },
      roadmapMetrics: {
        totalProjects: activeProjects.length,
        totalWorkstreams: activeWorkstreams.length,
        totalTasks: activeTasks.length,
        archivedProjects: archivedProjects.length,
        archivedCompletedProjects,
        taskStatusDistribution: {
          todo,
          inProgress,
          done,
        },
        completionRate: activeTasks.length === 0 ? 0 : Number(((done / activeTasks.length) * 100).toFixed(2)),
        taskThroughput: throughput,
      },
      collectionMetrics: {
        associationId: associationId ?? null,
        totalCharges: Number(totalCharges.toFixed(2)),
        totalPayments: Number(totalPayments.toFixed(2)),
        totalCredits: Number(totalCredits.toFixed(2)),
        openBalance,
        collectionRate: Number(collectionBase.toFixed(2)),
        monthlyTrend,
        agingBuckets: {
          current: Number(agingBuckets.current.toFixed(2)),
          thirtyDays: Number(agingBuckets.thirtyDays.toFixed(2)),
          sixtyDays: Number(agingBuckets.sixtyDays.toFixed(2)),
          ninetyPlus: Number(agingBuckets.ninetyPlus.toFixed(2)),
        },
        delinquencyMovement,
      },
      reserveProjection: {
        associationId: associationId ?? null,
        currentReserveBalance,
        annualReserveContributions: Number(normalizedAnnualReserveContributions.toFixed(2)),
        annualReserveExpenses: Number(normalizedAnnualReserveExpenses.toFixed(2)),
        annualSpecialAssessmentContribution: Number(annualSpecialAssessmentContribution.toFixed(2)),
        forecastWindows,
      },
      expenseCategoryTrend: {
        associationId: associationId ?? null,
        categories: expenseCategoryTrend,
      },
    };
  }

  // ─── Elections ────────────────────────────────────────────────────────────

  async getElections(associationId?: string, meetingId?: string): Promise<Election[]> {
    const conditions = [];
    if (associationId) conditions.push(eq(elections.associationId, associationId));
    if (meetingId) conditions.push(eq(elections.meetingId, meetingId));
    if (conditions.length === 0) {
      return db.select().from(elections).orderBy(desc(elections.createdAt));
    }
    return db
      .select()
      .from(elections)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(desc(elections.createdAt));
  }

  async getElection(id: string): Promise<Election | undefined> {
    const [row] = await db.select().from(elections).where(eq(elections.id, id));
    return row;
  }

  async createElection(data: InsertElection): Promise<Election> {
    const [row] = await db
      .insert(elections)
      .values({ ...data, updatedAt: new Date() })
      .returning();
    return row;
  }

  async updateElection(id: string, data: Partial<InsertElection>): Promise<Election | undefined> {
    const [row] = await db
      .update(elections)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(elections.id, id))
      .returning();
    return row;
  }

  async getElectionOptions(electionId: string): Promise<ElectionOption[]> {
    return db
      .select()
      .from(electionOptions)
      .where(eq(electionOptions.electionId, electionId))
      .orderBy(electionOptions.orderIndex);
  }

  async createElectionOption(data: InsertElectionOption): Promise<ElectionOption> {
    const [row] = await db.insert(electionOptions).values(data).returning();
    return row;
  }

  async deleteElectionOption(id: string): Promise<void> {
    await db.delete(electionOptions).where(eq(electionOptions.id, id));
  }

  async getNominationsForElection(electionId: string): Promise<ElectionOption[]> {
    return db
      .select()
      .from(electionOptions)
      .where(
        and(
          eq(electionOptions.electionId, electionId),
          isNotNull(electionOptions.nominationStatus),
        ),
      )
      .orderBy(electionOptions.createdAt);
  }

  async approveNomination(optionId: string): Promise<ElectionOption | undefined> {
    const [row] = await db
      .update(electionOptions)
      .set({ nominationStatus: "approved" })
      .where(eq(electionOptions.id, optionId))
      .returning();
    return row;
  }

  async rejectNomination(optionId: string): Promise<ElectionOption | undefined> {
    const [row] = await db
      .update(electionOptions)
      .set({ nominationStatus: "rejected" })
      .where(eq(electionOptions.id, optionId))
      .returning();
    return row;
  }

  async getPortalNominationsForElection(portalAccessId: string, electionId: string): Promise<ElectionOption[]> {
    const resolved = await this.resolvePortalAccessContext(portalAccessId);
    if (!resolved) return [];
    const { access } = resolved;
    if (!access.personId) return [];
    return db
      .select()
      .from(electionOptions)
      .where(
        and(
          eq(electionOptions.electionId, electionId),
          eq(electionOptions.nominatedByPersonId, access.personId),
        ),
      )
      .orderBy(electionOptions.createdAt);
  }

  async submitNomination(data: { electionId: string; label: string; bio?: string; photoUrl?: string; currentRole?: string; nominationStatement?: string; nominatedByPersonId: string }): Promise<ElectionOption> {
    const [row] = await db
      .insert(electionOptions)
      .values({
        electionId: data.electionId,
        label: data.label,
        bio: data.bio ?? null,
        photoUrl: data.photoUrl ?? null,
        currentRole: data.currentRole ?? null,
        nominationStatement: data.nominationStatement ?? null,
        nominatedByPersonId: data.nominatedByPersonId,
        nominationStatus: "pending",
        orderIndex: 0,
      })
      .returning();
    return row;
  }

  async generateBallotTokens(electionId: string, _actorEmail?: string): Promise<{ created: number }> {
    const [election] = await db.select().from(elections).where(eq(elections.id, electionId));
    if (!election) return { created: 0 };

    let eligiblePairs: Array<{ personId: string; unitId: string | null }> = [];

    if (election.votingRule === "board-only") {
      const boardMembers = await db
        .select({ personId: boardRoles.personId })
        .from(boardRoles)
        .where(and(eq(boardRoles.associationId, election.associationId), isNull(boardRoles.endDate)));
      eligiblePairs = boardMembers.map((b) => ({ personId: b.personId, unitId: null }));
    } else if (election.votingRule === "unit-weighted") {
      const unitOwners = await db
        .select({ personId: ownerships.personId, unitId: ownerships.unitId })
        .from(ownerships)
        .innerJoin(units, eq(units.id, ownerships.unitId))
        .where(and(eq(units.associationId, election.associationId), isNull(ownerships.endDate)));
      const seen = new Set<string>();
      for (const row of unitOwners) {
        if (!seen.has(row.unitId)) {
          seen.add(row.unitId);
          eligiblePairs.push({ personId: row.personId, unitId: row.unitId });
        }
      }
    } else {
      const owners = await db
        .select({ personId: ownerships.personId, unitId: ownerships.unitId })
        .from(ownerships)
        .innerJoin(units, eq(units.id, ownerships.unitId))
        .where(and(eq(units.associationId, election.associationId), isNull(ownerships.endDate)));
      const seenPersons = new Set<string>();
      for (const row of owners) {
        if (!seenPersons.has(row.personId)) {
          seenPersons.add(row.personId);
          eligiblePairs.push({ personId: row.personId, unitId: row.unitId });
        }
      }
    }

    const existing = await db
      .select({ personId: electionBallotTokens.personId })
      .from(electionBallotTokens)
      .where(eq(electionBallotTokens.electionId, electionId));
    const existingPersonIds = new Set(existing.map((e) => e.personId));

    let created = 0;
    for (const pair of eligiblePairs) {
      if (existingPersonIds.has(pair.personId)) continue;
      const token = randomBytes(32).toString("hex");
      await db.insert(electionBallotTokens).values({
        electionId,
        token,
        personId: pair.personId,
        unitId: pair.unitId,
        status: "pending",
      });
      created++;
    }

    await db
      .update(elections)
      .set({ eligibleVoterCount: eligiblePairs.length, updatedAt: new Date() })
      .where(eq(elections.id, electionId));

    return { created };
  }

  async getBallotTokens(electionId: string): Promise<ElectionBallotToken[]> {
    return db
      .select()
      .from(electionBallotTokens)
      .where(eq(electionBallotTokens.electionId, electionId))
      .orderBy(electionBallotTokens.createdAt);
  }

  async getBallotTokenByToken(token: string): Promise<ElectionBallotToken | undefined> {
    const [row] = await db
      .select()
      .from(electionBallotTokens)
      .where(eq(electionBallotTokens.token, token));
    return row;
  }

  async castBallot(data: {
    token: string;
    choicesJson: string[];
    personId?: string | null;
  }): Promise<ElectionBallotCast> {
    const ballotToken = await this.getBallotTokenByToken(data.token);
    if (!ballotToken) throw new Error("Invalid ballot token");
    if (ballotToken.status !== "pending") throw new Error("Ballot token already used or revoked");

    const [election] = await db.select().from(elections).where(eq(elections.id, ballotToken.electionId));
    if (!election) throw new Error("Election not found");
    if (election.status !== "open") throw new Error("Election is not open");

    const now = new Date();
    if (election.opensAt && now < new Date(election.opensAt)) throw new Error("Election has not opened yet");
    if (election.closesAt && now > new Date(election.closesAt)) throw new Error("Election has closed");

    // maxChoices validation
    if (election.maxChoices && data.choicesJson.length > election.maxChoices) {
      throw new Error(`Too many choices selected. Maximum allowed: ${election.maxChoices}`);
    }

    if (ballotToken.unitId) {
      const [proxyCast] = await db
        .select()
        .from(electionBallotCasts)
        .where(
          and(
            eq(electionBallotCasts.electionId, ballotToken.electionId),
            eq(electionBallotCasts.proxyForUnitId, ballotToken.unitId),
          ),
        );
      if (proxyCast) throw new Error("A proxy has already voted on behalf of your unit");
    }

    const confirmationRef = randomBytes(8).toString("hex").toUpperCase();
    const storedChoices = election.isSecretBallot ? null : data.choicesJson;

    const [cast] = await db
      .insert(electionBallotCasts)
      .values({
        electionId: ballotToken.electionId,
        ballotTokenId: ballotToken.id,
        personId: ballotToken.personId,
        unitId: ballotToken.unitId,
        choicesJson: storedChoices,
        voteWeight: 1,
        isProxy: 0,
        confirmationRef,
      })
      .returning();

    await db
      .update(electionBallotTokens)
      .set({ status: "cast", castAt: now })
      .where(eq(electionBallotTokens.id, ballotToken.id));

    return cast;
  }

  async getBallotCasts(electionId: string): Promise<ElectionBallotCast[]> {
    return db
      .select()
      .from(electionBallotCasts)
      .where(eq(electionBallotCasts.electionId, electionId))
      .orderBy(electionBallotCasts.castAt);
  }

  async getProxyDesignations(electionId: string): Promise<(ElectionProxyDesignation & { ownerName: string; proxyName: string })[]> {
    const ownerPerson = aliasedTable(persons, "owner_person");
    const proxyPerson = aliasedTable(persons, "proxy_person");

    const rows = await db
      .select({
        ...getTableColumns(electionProxyDesignations),
        ownerName: sql<string>`concat(${ownerPerson.firstName}, ' ', ${ownerPerson.lastName})`,
        proxyName: sql<string>`concat(${proxyPerson.firstName}, ' ', ${proxyPerson.lastName})`,
      })
      .from(electionProxyDesignations)
      .leftJoin(ownerPerson, eq(electionProxyDesignations.ownerPersonId, ownerPerson.id))
      .leftJoin(proxyPerson, eq(electionProxyDesignations.proxyPersonId, proxyPerson.id))
      .where(eq(electionProxyDesignations.electionId, electionId))
      .orderBy(electionProxyDesignations.designatedAt);
    return rows;
  }

  async createProxyDesignation(data: InsertElectionProxyDesignation): Promise<ElectionProxyDesignation> {
    const [existing] = await db
      .select()
      .from(electionProxyDesignations)
      .where(
        and(
          eq(electionProxyDesignations.electionId, data.electionId),
          eq(electionProxyDesignations.ownerPersonId, data.ownerPersonId),
        ),
      );

    if (existing) {
      const [updated] = await db
        .update(electionProxyDesignations)
        .set({ proxyPersonId: data.proxyPersonId, notes: data.notes ?? null, revokedAt: null, designatedAt: new Date() })
        .where(eq(electionProxyDesignations.id, existing.id))
        .returning();
      return updated;
    }

    const [row] = await db.insert(electionProxyDesignations).values({ ...data, designatedAt: new Date() }).returning();

    await db
      .update(electionBallotTokens)
      .set({ status: "consumed-by-proxy" })
      .where(
        and(
          eq(electionBallotTokens.electionId, data.electionId),
          eq(electionBallotTokens.personId, data.ownerPersonId),
          eq(electionBallotTokens.status, "pending"),
        ),
      );

    return row;
  }

  async revokeProxyDesignation(id: string): Promise<ElectionProxyDesignation | undefined> {
    const [existing] = await db
      .select()
      .from(electionProxyDesignations)
      .where(eq(electionProxyDesignations.id, id));

    if (!existing) return undefined;

    const [row] = await db
      .update(electionProxyDesignations)
      .set({ revokedAt: new Date() })
      .where(eq(electionProxyDesignations.id, id))
      .returning();

    await db
      .update(electionBallotTokens)
      .set({ status: "pending" })
      .where(
        and(
          eq(electionBallotTokens.electionId, existing.electionId),
          eq(electionBallotTokens.personId, existing.ownerPersonId),
          eq(electionBallotTokens.status, "consumed-by-proxy"),
        ),
      );

    return row;
  }

  async getProxyDocuments(electionId: string): Promise<ElectionProxyDocument[]> {
    return db
      .select()
      .from(electionProxyDocuments)
      .where(eq(electionProxyDocuments.electionId, electionId))
      .orderBy(electionProxyDocuments.createdAt);
  }

  async createProxyDocument(data: InsertElectionProxyDocument): Promise<ElectionProxyDocument> {
    const [row] = await db.insert(electionProxyDocuments).values(data).returning();
    return row;
  }

  async getElectionTally(electionId: string): Promise<{
    electionId: string;
    eligibleCount: number;
    castCount: number;
    participationPercent: number;
    quorumPercent: number;
    quorumMet: boolean;
    optionTallies: Array<{ optionId: string; label: string; votes: number; percent: number }>;
    totalWeightedVotes: number;
    isCertified: boolean;
    certifiedAt: string | null;
  }> {
    const [election] = await db.select().from(elections).where(eq(elections.id, electionId));
    if (!election) throw new Error("Election not found");

    const options = await this.getElectionOptions(electionId);
    const casts = await this.getBallotCasts(electionId);

    const castCount = casts.length;
    const eligibleCount = Math.max(election.eligibleVoterCount, 1);
    const participationPercent = Math.round((castCount / eligibleCount) * 100);
    const quorumMet = participationPercent >= (election.quorumPercent || 50);

    const optionVotes: Record<string, number> = {};
    for (const opt of options) {
      optionVotes[opt.id] = 0;
    }

    if (!election.isSecretBallot) {
      for (const cast of casts) {
        const choices = (cast.choicesJson as string[] | null) ?? [];
        for (const choiceId of choices) {
          if (choiceId in optionVotes) {
            optionVotes[choiceId] = (optionVotes[choiceId] ?? 0) + cast.voteWeight;
          }
        }
      }
    }

    const rawTotalVotes = Object.values(optionVotes).reduce((a, b) => a + b, 0);
    const totalVotes = Math.max(rawTotalVotes, 1);

    const optionTallies = options.map((opt) => ({
      optionId: opt.id,
      label: opt.label,
      votes: optionVotes[opt.id] ?? 0,
      percent: election.isSecretBallot ? 0 : Math.round(((optionVotes[opt.id] ?? 0) / totalVotes) * 100),
    }));

    return {
      electionId,
      eligibleCount: election.eligibleVoterCount,
      castCount,
      participationPercent,
      quorumPercent: election.quorumPercent,
      quorumMet,
      optionTallies,
      totalWeightedVotes: rawTotalVotes,
      isCertified: election.status === "certified",
      certifiedAt: election.certifiedAt ? new Date(election.certifiedAt).toISOString() : null,
    };
  }

  async certifyElection(id: string, actorEmail: string, certificationSummary?: string): Promise<Election> {
    const [row] = await db
      .update(elections)
      .set({ status: "certified", certifiedBy: actorEmail, certifiedAt: new Date(), certificationSummary: certificationSummary || null, updatedAt: new Date() })
      .where(eq(elections.id, id))
      .returning();
    return row;
  }

  async revokeAllPendingTokens(electionId: string): Promise<number> {
    const result = await db
      .update(electionBallotTokens)
      .set({ status: "revoked" })
      .where(
        and(
          eq(electionBallotTokens.electionId, electionId),
          eq(electionBallotTokens.status, "pending"),
        ),
      )
      .returning();
    return result.length;
  }

  async deleteElection(id: string): Promise<void> {
    const casts = await this.getBallotCasts(id);
    if (casts.length > 0) throw new Error("Cannot delete election with cast votes");
    await db.delete(electionProxyDocuments).where(eq(electionProxyDocuments.electionId, id));
    await db.delete(electionProxyDesignations).where(eq(electionProxyDesignations.electionId, id));
    await db.delete(electionBallotTokens).where(eq(electionBallotTokens.electionId, id));
    await db.delete(electionOptions).where(eq(electionOptions.electionId, id));
    await db.delete(elections).where(eq(elections.id, id));
  }

  async getBallotTokensWithNames(electionId: string): Promise<Array<{
    id: string; token: string; personId: string | null; unitId: string | null;
    status: string; sentAt: Date | null; castAt: Date | null;
    voterName: string; unitNumber: string;
    confirmationRef: string | null;
  }>> {
    const tokens = await db
      .select({
        id: electionBallotTokens.id,
        token: electionBallotTokens.token,
        personId: electionBallotTokens.personId,
        unitId: electionBallotTokens.unitId,
        status: electionBallotTokens.status,
        sentAt: electionBallotTokens.sentAt,
        castAt: electionBallotTokens.castAt,
        firstName: persons.firstName,
        lastName: persons.lastName,
        unitNumber: units.unitNumber,
      })
      .from(electionBallotTokens)
      .leftJoin(persons, eq(persons.id, electionBallotTokens.personId))
      .leftJoin(units, eq(units.id, electionBallotTokens.unitId))
      .where(eq(electionBallotTokens.electionId, electionId))
      .orderBy(electionBallotTokens.createdAt);

    const casts = await db
      .select({
        ballotTokenId: electionBallotCasts.ballotTokenId,
        confirmationRef: electionBallotCasts.confirmationRef,
      })
      .from(electionBallotCasts)
      .where(eq(electionBallotCasts.electionId, electionId));

    const castMap = new Map(casts.map((c) => [c.ballotTokenId, c.confirmationRef]));

    return tokens.map((t) => ({
      id: t.id,
      token: t.token,
      personId: t.personId,
      unitId: t.unitId,
      status: t.status,
      sentAt: t.sentAt,
      castAt: t.castAt,
      voterName: t.firstName && t.lastName ? `${t.firstName} ${t.lastName}` : t.firstName || t.lastName || "Unknown",
      unitNumber: t.unitNumber || "—",
      confirmationRef: castMap.get(t.id) ?? null,
    }));
  }

  async getVoterEmailsForElection(electionId: string): Promise<Array<{ tokenId: string; email: string; token: string; firstName: string }>> {
    const rows = await db
      .select({
        tokenId: electionBallotTokens.id,
        email: persons.email,
        token: electionBallotTokens.token,
        firstName: persons.firstName,
      })
      .from(electionBallotTokens)
      .innerJoin(persons, eq(persons.id, electionBallotTokens.personId))
      .where(eq(electionBallotTokens.electionId, electionId));
    return rows.filter((r) => r.email && r.email.trim()) as Array<{ tokenId: string; email: string; token: string; firstName: string }>;
  }

  async getPendingVoterEmailsForElection(electionId: string): Promise<Array<{ tokenId: string; email: string; token: string; firstName: string }>> {
    const rows = await db
      .select({
        tokenId: electionBallotTokens.id,
        email: persons.email,
        token: electionBallotTokens.token,
        firstName: persons.firstName,
      })
      .from(electionBallotTokens)
      .innerJoin(persons, eq(persons.id, electionBallotTokens.personId))
      .where(and(
        eq(electionBallotTokens.electionId, electionId),
        eq(electionBallotTokens.status, "pending"),
      ));
    return rows.filter((r) => r.email && r.email.trim()) as Array<{ tokenId: string; email: string; token: string; firstName: string }>;
  }

  async markBallotTokensSent(tokenIds: string[]): Promise<void> {
    if (tokenIds.length === 0) return;
    await db
      .update(electionBallotTokens)
      .set({ sentAt: new Date() })
      .where(inArray(electionBallotTokens.id, tokenIds));
  }

  async resendBallotToken(tokenId: string): Promise<{ token: string; email: string; personId: string; electionId: string } | null> {
    const rows = await db
      .select({
        token: electionBallotTokens.token,
        email: persons.email,
        personId: electionBallotTokens.personId,
        electionId: electionBallotTokens.electionId,
        status: electionBallotTokens.status,
      })
      .from(electionBallotTokens)
      .innerJoin(persons, eq(persons.id, electionBallotTokens.personId))
      .where(eq(electionBallotTokens.id, tokenId));

    if (rows.length === 0) return null;
    const row = rows[0];
    if (row.status !== "pending") return null;
    if (!row.email || !row.email.trim()) return null;

    // Update sentAt timestamp
    await db
      .update(electionBallotTokens)
      .set({ sentAt: new Date() })
      .where(eq(electionBallotTokens.id, tokenId));

    return {
      token: row.token,
      email: row.email,
      personId: row.personId!,
      electionId: row.electionId,
    };
  }

  async getOwnerElectionHistory(portalAccessId: string): Promise<Array<{
    election: Election;
    participated: boolean;
    status: "voted" | "proxy-designated" | "not-voted";
    outcome: string | null;
  }>> {
    const resolved = await this.resolvePortalAccessContext(portalAccessId);
    if (!resolved) return [];

    const { access } = resolved;
    const assocElections = await this.getElections(access.associationId ?? undefined);

    const results = [];
    for (const election of assocElections) {
      if (election.resultVisibility === "admin-only" && election.status !== "certified") continue;

      const token = access.personId
        ? await db
            .select()
            .from(electionBallotTokens)
            .where(
              and(
                eq(electionBallotTokens.electionId, election.id),
                eq(electionBallotTokens.personId, access.personId),
              ),
            )
            .then((rows) => rows[0])
        : undefined;

      const proxyDesignation = access.personId
        ? await db
            .select()
            .from(electionProxyDesignations)
            .where(
              and(
                eq(electionProxyDesignations.electionId, election.id),
                eq(electionProxyDesignations.ownerPersonId, access.personId),
                isNull(electionProxyDesignations.revokedAt),
              ),
            )
            .then((rows) => rows[0])
        : undefined;

      let status: "voted" | "proxy-designated" | "not-voted" = "not-voted";
      if (token?.status === "cast") status = "voted";
      else if (proxyDesignation) status = "proxy-designated";
      else if (token?.status === "consumed-by-proxy") status = "proxy-designated";

      let outcome: string | null = null;
      if (election.status === "certified" && election.resultVisibility === "public") {
        const tally = await this.getElectionTally(election.id);
        if (tally.optionTallies.length > 0) {
          const top = tally.optionTallies.reduce((a, b) => (a.votes >= b.votes ? a : b));
          outcome = `${top.label} (${top.votes} votes)`;
        }
      }

      results.push({ election, participated: status !== "not-voted", status, outcome });
    }

    return results;
  }

  async getOwnerActiveElections(portalAccessId: string): Promise<Array<{
    election: Election;
    token: string;
  }>> {
    const resolved = await this.resolvePortalAccessContext(portalAccessId);
    if (!resolved) return [];

    const { access } = resolved;
    if (!access.personId) return [];

    const assocElections = await this.getElections(access.associationId ?? undefined);
    const results: Array<{ election: Election; token: string }> = [];

    for (const election of assocElections) {
      if (election.status !== "open") continue;

      const [tokenRow] = await db
        .select()
        .from(electionBallotTokens)
        .where(
          and(
            eq(electionBallotTokens.electionId, election.id),
            eq(electionBallotTokens.personId, access.personId),
            eq(electionBallotTokens.status, "pending"),
          ),
        );

      if (tokenRow) {
        results.push({ election, token: tokenRow.token });
      }
    }

    return results;
  }

  async getElectionDetailForPortal(portalAccessId: string, electionId: string): Promise<{
    election: Election;
    options: ElectionOption[];
    participated: boolean;
    status: "voted" | "proxy-designated" | "not-voted";
    ballotToken: string | null;
    proxyDesignation: { id: string; proxyPersonId: string; proxyName: string; designatedAt: string; notes: string | null } | null;
    tally: { eligibleCount: number; castCount: number; participationPercent: number; quorumPercent: number; quorumMet: boolean; optionTallies: Array<{ optionId: string; label: string; votes: number; percent: number }> } | null;
  } | null> {
    const resolved = await this.resolvePortalAccessContext(portalAccessId);
    if (!resolved) return null;

    const { access } = resolved;
    const election = await this.getElection(electionId);
    if (!election) return null;

    if (election.associationId !== access.associationId) return null;

    const options = await this.getElectionOptions(electionId);

    const token = access.personId
      ? await db
          .select()
          .from(electionBallotTokens)
          .where(
            and(
              eq(electionBallotTokens.electionId, electionId),
              eq(electionBallotTokens.personId, access.personId),
            ),
          )
          .then((rows) => rows[0])
      : undefined;

    const proxyRow = access.personId
      ? await db
          .select()
          .from(electionProxyDesignations)
          .where(
            and(
              eq(electionProxyDesignations.electionId, electionId),
              eq(electionProxyDesignations.ownerPersonId, access.personId),
              isNull(electionProxyDesignations.revokedAt),
            ),
          )
          .then((rows) => rows[0])
      : undefined;

    let status: "voted" | "proxy-designated" | "not-voted" = "not-voted";
    if (token?.status === "cast") status = "voted";
    else if (proxyRow) status = "proxy-designated";
    else if (token?.status === "consumed-by-proxy") status = "proxy-designated";

    let proxyDesignation: { id: string; proxyPersonId: string; proxyName: string; designatedAt: string; notes: string | null } | null = null;
    if (proxyRow) {
      const [proxyPerson] = await db.select().from(persons).where(eq(persons.id, proxyRow.proxyPersonId));
      proxyDesignation = {
        id: proxyRow.id,
        proxyPersonId: proxyRow.proxyPersonId,
        proxyName: proxyPerson ? `${proxyPerson.firstName ?? ""} ${proxyPerson.lastName ?? ""}`.trim() : "Unknown",
        designatedAt: new Date(proxyRow.designatedAt).toISOString(),
        notes: proxyRow.notes,
      };
    }

    const ballotToken = (token && token.status === "pending") ? token.token : null;

    let tally: { eligibleCount: number; castCount: number; participationPercent: number; quorumPercent: number; quorumMet: boolean; optionTallies: Array<{ optionId: string; label: string; votes: number; percent: number }> } | null = null;
    if (election.status === "certified" && election.resultVisibility === "public") {
      const fullTally = await this.getElectionTally(electionId);
      tally = {
        eligibleCount: fullTally.eligibleCount,
        castCount: fullTally.castCount,
        participationPercent: fullTally.participationPercent,
        quorumPercent: fullTally.quorumPercent,
        quorumMet: fullTally.quorumMet,
        optionTallies: fullTally.optionTallies,
      };
    }

    return { election, options, participated: status !== "not-voted", status, ballotToken, proxyDesignation, tally };
  }

  async getAssociationOwnersForProxy(portalAccessId: string, electionId: string): Promise<Array<{ personId: string; firstName: string; lastName: string }>> {
    const resolved = await this.resolvePortalAccessContext(portalAccessId);
    if (!resolved) return [];

    const { access } = resolved;
    if (!access.associationId || !access.personId) return [];

    const allAccess = await db
      .select({
        personId: portalAccess.personId,
        firstName: persons.firstName,
        lastName: persons.lastName,
      })
      .from(portalAccess)
      .innerJoin(persons, eq(persons.id, portalAccess.personId))
      .where(
        and(
          eq(portalAccess.associationId, access.associationId),
          eq(portalAccess.status, "active"),
        ),
      );

    return allAccess
      .filter((p) => p.personId !== access.personId && p.personId !== null)
      .map((p) => ({
        personId: p.personId!,
        firstName: p.firstName ?? "",
        lastName: p.lastName ?? "",
      }));
  }

  async revokeProxyDesignationForPortal(portalAccessId: string, designationId: string): Promise<boolean> {
    const resolved = await this.resolvePortalAccessContext(portalAccessId);
    if (!resolved) return false;

    const { access } = resolved;
    if (!access.personId) return false;

    const [designation] = await db
      .select()
      .from(electionProxyDesignations)
      .where(
        and(
          eq(electionProxyDesignations.id, designationId),
          eq(electionProxyDesignations.ownerPersonId, access.personId),
          isNull(electionProxyDesignations.revokedAt),
        ),
      );

    if (!designation) return false;

    await this.revokeProxyDesignation(designationId);
    return true;
  }

  async getBoardPendingElections(portalAccessId: string): Promise<Array<{
    election: Election;
    token: string;
  }>> {
    const resolved = await this.resolvePortalAccessContext(portalAccessId);
    if (!resolved || !resolved.hasBoardAccess) return [];

    const { access } = resolved;
    if (!access.personId || !access.associationId) return [];

    const assocElections = await this.getElections(access.associationId);
    const results: Array<{ election: Election; token: string }> = [];

    for (const election of assocElections) {
      if (election.status !== "open") continue;
      if (election.votingRule !== "board-only") continue;

      const tokenRow = await db
        .select()
        .from(electionBallotTokens)
        .where(
          and(
            eq(electionBallotTokens.electionId, election.id),
            eq(electionBallotTokens.personId, access.personId),
            eq(electionBallotTokens.status, "pending"),
          ),
        )
        .then((rows) => rows[0]);

      if (tokenRow) {
        results.push({ election, token: tokenRow.token });
      }
    }

    return results;
  }

  async getCertifiedElections(associationId: string): Promise<Array<{
    election: Election;
    participationPercent: number;
    outcome: string | null;
  }>> {
    const certified = await db
      .select()
      .from(elections)
      .where(
        and(
          eq(elections.associationId, associationId),
          eq(elections.status, "certified"),
        ),
      )
      .orderBy(desc(elections.certifiedAt));

    const results: Array<{ election: Election; participationPercent: number; outcome: string | null }> = [];

    for (const election of certified) {
      const tally = await this.getElectionTally(election.id);
      let outcome: string | null = null;
      if (election.resultVisibility === "public" && tally.optionTallies.length > 0) {
        const top = tally.optionTallies.reduce((a, b) => (a.votes >= b.votes ? a : b));
        outcome = `${top.label} (${top.votes} votes)`;
      }
      results.push({ election, participationPercent: tally.participationPercent, outcome });
    }

    return results;
  }

  async getRecentlyCertifiedBoardElections(associationId: string): Promise<Election[]> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return db
      .select()
      .from(elections)
      .where(
        and(
          eq(elections.associationId, associationId),
          eq(elections.status, "certified"),
          eq(elections.voteType, "board-election"),
          gte(elections.certifiedAt, sevenDaysAgo),
        ),
      )
      .orderBy(desc(elections.certifiedAt));
  }

  async closeExpiredElections(): Promise<number> {
    const now = new Date();
    const expired = await db
      .select()
      .from(elections)
      .where(
        and(
          eq(elections.status, "open"),
          isNotNull(elections.closesAt),
          lte(elections.closesAt, now),
        ),
      );

    for (const election of expired) {
      await db
        .update(elections)
        .set({ status: "closed", updatedAt: now })
        .where(eq(elections.id, election.id));
    }

    return expired.length;
  }

  async getActiveElectionsSummary(associationId?: string): Promise<Array<{
    id: string;
    title: string;
    associationId: string;
    status: string;
    closesAt: Date | null;
    eligibleVoterCount: number;
    castCount: number;
    participationPercent: number;
    quorumPercent: number;
    quorumMet: boolean;
  }>> {
    const conditions = [
      sql`${elections.status} IN ('open', 'closed')`,
    ];
    if (associationId) {
      conditions.push(eq(elections.associationId, associationId));
    }

    const rows = await db
      .select()
      .from(elections)
      .where(and(...conditions))
      .orderBy(elections.closesAt);

    const results = [];
    for (const election of rows) {
      const casts = await this.getBallotCasts(election.id);
      const castCount = casts.length;
      const eligibleCount = Math.max(election.eligibleVoterCount, 1);
      const participationPercent = Math.round((castCount / eligibleCount) * 100);
      const quorumMet = participationPercent >= (election.quorumPercent || 50);

      results.push({
        id: election.id,
        title: election.title,
        associationId: election.associationId,
        status: election.status,
        closesAt: election.closesAt,
        eligibleVoterCount: election.eligibleVoterCount,
        castCount,
        participationPercent,
        quorumPercent: election.quorumPercent,
        quorumMet,
      });
    }

    return results;
  }

  async getElectionComplianceSummary(associationId: string): Promise<{
    totalElections: number;
    byYear: Array<{ year: number; count: number; quorumMet: number; quorumFailed: number; avgParticipation: number }>;
    overallAvgParticipation: number;
  }> {
    const allElections = await db
      .select()
      .from(elections)
      .where(
        and(
          eq(elections.associationId, associationId),
          sql`${elections.status} IN ('closed', 'certified')`,
        ),
      )
      .orderBy(desc(elections.createdAt));

    const yearMap = new Map<number, { count: number; quorumMet: number; quorumFailed: number; participationSum: number }>();
    let totalParticipation = 0;

    for (const election of allElections) {
      const year = election.certifiedAt
        ? new Date(election.certifiedAt).getFullYear()
        : election.closesAt
          ? new Date(election.closesAt).getFullYear()
          : new Date(election.createdAt).getFullYear();

      const casts = await this.getBallotCasts(election.id);
      const castCount = casts.length;
      const eligibleCount = Math.max(election.eligibleVoterCount, 1);
      const participation = Math.round((castCount / eligibleCount) * 100);
      const quorumMet = participation >= (election.quorumPercent || 50);

      totalParticipation += participation;

      if (!yearMap.has(year)) {
        yearMap.set(year, { count: 0, quorumMet: 0, quorumFailed: 0, participationSum: 0 });
      }
      const entry = yearMap.get(year)!;
      entry.count++;
      if (quorumMet) entry.quorumMet++;
      else entry.quorumFailed++;
      entry.participationSum += participation;
    }

    const byYear = Array.from(yearMap.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([year, data]) => ({
        year,
        count: data.count,
        quorumMet: data.quorumMet,
        quorumFailed: data.quorumFailed,
        avgParticipation: data.count > 0 ? Math.round(data.participationSum / data.count) : 0,
      }));

    return {
      totalElections: allElections.length,
      byYear,
      overallAvgParticipation: allElections.length > 0 ? Math.round(totalParticipation / allElections.length) : 0,
    };
  }

  async getElectionAnalytics(associationId: string): Promise<{
    totalElections: number;
    averageTurnoutPercent: number;
    highestParticipation: { electionId: string; title: string; participationPercent: number } | null;
    lowestParticipation: { electionId: string; title: string; participationPercent: number } | null;
    quorumFailureRate: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
  }> {
    const allElections = await db
      .select()
      .from(elections)
      .where(eq(elections.associationId, associationId))
      .orderBy(desc(elections.createdAt));

    if (allElections.length === 0) {
      return {
        totalElections: 0,
        averageTurnoutPercent: 0,
        highestParticipation: null,
        lowestParticipation: null,
        quorumFailureRate: 0,
        byType: {},
        byStatus: {},
      };
    }

    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let totalParticipation = 0;
    let quorumFailures = 0;
    let closedOrCertifiedCount = 0;
    let highest: { electionId: string; title: string; participationPercent: number } | null = null;
    let lowest: { electionId: string; title: string; participationPercent: number } | null = null;

    for (const election of allElections) {
      byType[election.voteType] = (byType[election.voteType] || 0) + 1;
      byStatus[election.status] = (byStatus[election.status] || 0) + 1;

      if (election.status === "closed" || election.status === "certified") {
        closedOrCertifiedCount++;
        const casts = await this.getBallotCasts(election.id);
        const castCount = casts.length;
        const eligibleCount = Math.max(election.eligibleVoterCount, 1);
        const participation = Math.round((castCount / eligibleCount) * 100);
        totalParticipation += participation;

        const quorumMet = participation >= (election.quorumPercent || 50);
        if (!quorumMet) quorumFailures++;

        if (!highest || participation > highest.participationPercent) {
          highest = { electionId: election.id, title: election.title, participationPercent: participation };
        }
        if (!lowest || participation < lowest.participationPercent) {
          lowest = { electionId: election.id, title: election.title, participationPercent: participation };
        }
      }
    }

    return {
      totalElections: allElections.length,
      averageTurnoutPercent: closedOrCertifiedCount > 0 ? Math.round(totalParticipation / closedOrCertifiedCount) : 0,
      highestParticipation: highest,
      lowestParticipation: lowest,
      quorumFailureRate: closedOrCertifiedCount > 0 ? Math.round((quorumFailures / closedOrCertifiedCount) * 100) : 0,
      byType,
      byStatus,
    };
  }
}

export const storage = new DatabaseStorage();
