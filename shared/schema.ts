import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp, pgEnum, jsonb, uniqueIndex, index, date, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { HUB_VISIBILITY_ALL_VALUES } from "./hub-visibility";

export const associations = pgTable("associations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  associationType: text("association_type"),
  dateFormed: text("date_formed"),
  ein: text("ein"),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  country: text("country").notNull().default("USA"),
  isArchived: integer("is_archived").notNull().default(0),
  archivedAt: timestamp("archived_at"),
  // 4.2 Q3 addendum (3a): per-association amenities feature toggle. Defaults to
  // enabled (1). When 0, the owner-portal amenities entry is hidden, the
  // /portal/amenities route 404s, and amenity-reservation APIs return 404.
  amenitiesEnabled: integer("amenities_enabled").notNull().default(1),
  // Maps onboarding (Phase 1): coordinates stored after admin confirms satellite view
  latitudeDeg: decimal("latitude_deg", { precision: 10, scale: 7 }),
  longitudeDeg: decimal("longitude_deg", { precision: 10, scale: 7 }),
  // CT CIOA reserve disclosure (#8016, from the #1035 audit §Area 1). Connecticut
  // does NOT mandate a reserve study or a minimum funding level — that is Delaware
  // (DUCIOA §81-315). CT requires DISCLOSURE only: the annual budget summary must
  // STATE the reserve amount + the basis on which reserves are calculated/funded
  // (CGS §47-261e(a)), and the resale certificate must state the reserve amount
  // (CGS §47-270(a)(5)). These two fields are the board-declared persisted store
  // for that disclosure — NOT a live bank balance and NOT a funding-mandate gate.
  // reserveBalanceCents: the stated reserve amount, in cents (matches the cents
  // convention used by financialAccounts.currentBalanceCents). Null = not yet stated.
  reserveBalanceCents: integer("reserve_balance_cents"),
  // reserveBasis: the §47-261e(a) narrative — "the basis on which reserves are
  // calculated and funded" (e.g. "per the 2026 reserve study, funded at 10% of the
  // annual operating budget"). Null = not yet stated.
  reserveBasis: text("reserve_basis"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const units = pgTable("units", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  buildingId: varchar("building_id"),
  unitNumber: text("unit_number").notNull(),
  building: text("building"),
  squareFootage: real("square_footage"),
  // ── Phase 1 (P0-3): unique per-unit payment reference ──────────────────────
  // A short, human-readable, stable per-unit reference (e.g. "CHC-0007") that
  // owners put on their remittance (Stripe metadata + mailed-check memo). The
  // reconciliation matcher's Tier-0 pass resolves a deposit to this unit at
  // confidence 1.0 BEFORE any name-guessing. NULLABLE + backfillable — additive;
  // units without a ref match exactly as they do today (person/name path).
  // Uniqueness is scoped per association (see units_assoc_account_ref_uq).
  unitAccountRef: text("unit_account_ref"),
  // ── Phase 1 (P0-1): designated primary contact for the payer roster ────────
  // Which co-owner is the "primary contact" for the unit's balance. NULLABLE —
  // when null, callers fall back to the earliest-startDate active ownership.
  // Additive metadata; does NOT change the balance owner (the UNIT is the
  // balance-bearing entity). Kept as a plain varchar holding a persons.id
  // (persons is declared after units, so no inline .references() wrapper to
  // avoid a forward-declaration cycle); the migration adds the FK constraint.
  primaryContactPersonId: varchar("primary_contact_person_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueAssociationBuildingUnitNumber: uniqueIndex("units_association_building_unit_number_uq").on(table.associationId, table.buildingId, table.unitNumber),
  // P0-3: a unit_account_ref must be unique WITHIN an association. Postgres
  // treats NULLs as distinct, so un-backfilled units (NULL ref) don't collide.
  uniqueAssociationAccountRef: uniqueIndex("units_assoc_account_ref_uq").on(table.associationId, table.unitAccountRef),
}));

export const buildings = pgTable("buildings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  name: text("name").notNull(),
  address: text("address").notNull(),
  totalUnits: integer("total_units"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueBuildingNamePerAssociation: uniqueIndex("buildings_association_name_uq").on(table.associationId, table.name),
}));

export const persons = pgTable("persons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").references(() => associations.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  mailingAddress: text("mailing_address"),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  contactPreference: text("contact_preference").notNull().default("email"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const personContactPointChannelEnum = pgEnum("person_contact_point_channel", ["email", "phone"]);
export const personContactPoints = pgTable("person_contact_points", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  personId: varchar("person_id").notNull().references(() => persons.id),
  associationId: varchar("association_id").references(() => associations.id),
  channel: personContactPointChannelEnum("channel").notNull(),
  value: text("value").notNull(),
  normalizedValue: text("normalized_value").notNull(),
  isPrimary: integer("is_primary").notNull().default(0),
  source: text("source").notNull().default("manual"),
  sourceRecordId: varchar("source_record_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniquePersonChannelValue: uniqueIndex("person_contact_points_person_channel_value_uq").on(table.personId, table.channel, table.normalizedValue),
}));

export const ownerships = pgTable("ownerships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  unitId: varchar("unit_id").notNull().references(() => units.id),
  personId: varchar("person_id").notNull().references(() => persons.id),
  ownershipPercentage: real("ownership_percentage").notNull().default(100),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  relationshipNotesJson: jsonb("relationship_notes_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const occupancyTypeEnum = pgEnum("occupancy_type", ["OWNER_OCCUPIED", "TENANT"]);

export const occupancies = pgTable("occupancies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  unitId: varchar("unit_id").notNull().references(() => units.id),
  personId: varchar("person_id").notNull().references(() => persons.id),
  occupancyType: occupancyTypeEnum("occupancy_type").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
});

export const boardRoles = pgTable("board_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  personId: varchar("person_id").notNull().references(() => persons.id),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  role: text("role").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
});

export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  title: text("title").notNull(),
  fileUrl: text("file_url").notNull(),
  documentType: text("document_type").notNull(),
  isPortalVisible: integer("is_portal_visible").notNull().default(0),
  portalAudience: text("portal_audience").notNull().default("owner"),
  priorVersionsPortalVisible: integer("prior_versions_portal_visible").notNull().default(0),
  uploadedBy: text("uploaded_by"),
  parentDocumentId: varchar("parent_document_id"),
  versionNumber: integer("version_number").notNull().default(1),
  isCurrentVersion: integer("is_current_version").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const unitChangeHistory = pgTable("unit_change_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  unitId: varchar("unit_id").notNull().references(() => units.id),
  fieldName: text("field_name").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  changedBy: text("changed_by").notNull().default("system"),
  changedAt: timestamp("changed_at").defaultNow().notNull(),
});

export const documentTags = pgTable("document_tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull().references(() => documents.id),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueTag: uniqueIndex("document_tags_unique_uq").on(table.documentId, table.entityType, table.entityId),
}));

export const documentVersions = pgTable("document_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull().references(() => documents.id),
  versionNumber: integer("version_number").notNull(),
  title: text("title").notNull(),
  fileUrl: text("file_url").notNull(),
  effectiveDate: timestamp("effective_date"),
  amendmentNotes: text("amendment_notes"),
  isCurrent: integer("is_current").notNull().default(0),
  uploadedBy: text("uploaded_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueVersionPerDocument: uniqueIndex("document_versions_document_version_uq").on(table.documentId, table.versionNumber),
}));

export const adminUserRoleEnum = pgEnum("admin_user_role", ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"]);

/**
 * Canonical TypeScript type for admin user roles.
 *
 * Derived from `adminUserRoleEnum.enumValues` so the type and the Drizzle
 * pgEnum can never drift. This is THE source of truth for the `AdminRole`
 * type — all other local declarations across client/, server/, and tests
 * should import from here. Phase 8c cleanup consolidates the remaining
 * parallel declarations identified in the Phase 8 audit.
 */
export type AdminRole = (typeof adminUserRoleEnum.enumValues)[number];

export const adminUsers = pgTable("admin_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  role: adminUserRoleEnum("role").notNull().default("viewer"),
  isActive: integer("is_active").notNull().default(1),
  // 4.4 Q2 AC 5 — per-admin-user dismissal of the post-signup onboarding banner on Home.
  // NULL = never dismissed; any timestamp = banner hidden from that moment forward.
  onboardingDismissedAt: timestamp("onboarding_dismissed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueEmail: uniqueIndex("admin_users_email_uq").on(table.email),
}));

export const adminUserPreferences = pgTable("admin_user_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminUserId: varchar("admin_user_id").notNull().references(() => adminUsers.id),
  emailNotifications: integer("email_notifications").notNull().default(1),
  pushNotifications: integer("push_notifications").notNull().default(1),
  desktopNotifications: integer("desktop_notifications").notNull().default(1),
  alertDigest: text("alert_digest").notNull().default("daily"),
  quietHoursEnabled: integer("quiet_hours_enabled").notNull().default(0),
  quietHoursStart: text("quiet_hours_start").notNull().default("22:00"),
  quietHoursEnd: text("quiet_hours_end").notNull().default("07:00"),
  notificationCategoryPreferencesJson: jsonb("notification_category_preferences_json").notNull().default(sql`'{}'::jsonb`),
  // 4.1 Tier 3 (Wave 32) — per-user opt-in for OUT-OF-BAND delivery of
  // severity:'critical' alerts. Distinct from the broad
  // emailNotifications/pushNotifications toggles above (which gate
  // category-level fan-out across YCM); these two columns gate the
  // critical-alert push/email channels specifically.
  // Email default ON; push default OFF (requires subscription enrollment).
  notifyAlertsEmail: integer("notify_alerts_email").notNull().default(1),
  notifyAlertsPush: integer("notify_alerts_push").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueAdmin: uniqueIndex("admin_user_prefs_admin_uq").on(table.adminUserId),
}));

export const userSessions = pgTable("user_sessions", {
  sid: varchar("sid").primaryKey(),
  sess: jsonb("sess").notNull(),
  expire: timestamp("expire").notNull(),
});

// #342 (WS3) — consent audit trail. One row per (user, policy_version) the
// user has agreed to. Re-consent at version bump is implemented by the
// (user_id, policy_version) lookup missing in this table.
export const consentRecords = pgTable("consent_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  userEmail: text("user_email").notNull(),
  policyVersion: text("policy_version").notNull(),
  consentedAt: timestamp("consented_at").defaultNow().notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
}, (table) => ({
  userIdx: index("consent_records_user_id_idx").on(table.userId),
  userVersionIdx: index("consent_records_user_version_idx").on(table.userId, table.policyVersion),
}));

// #1522 (WS4) — deletion request flow. Owners submit a request via the
// portal; a platform-admin approves it; approval anonymizes PII on the
// user's records (financial records retained per 7-year policy). See
// migrations/0031_deletion_requests.sql for the schema spec.
export const deletionRequests = pgTable("deletion_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  userEmail: text("user_email").notNull(),
  status: text("status").notNull().default("pending"),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  approvedAt: timestamp("approved_at"),
  approvedBy: text("approved_by"),
  cancelledAt: timestamp("cancelled_at"),
}, (table) => ({
  userStatusIdx: index("deletion_requests_user_id_status_idx").on(table.userId, table.status),
  statusRequestedIdx: index("deletion_requests_status_requested_at_idx").on(table.status, table.requestedAt),
}));

// #1340 — go-live readiness gate attestations. Each row is one admin marking
// one gate (e.g. 'A.6', 'B.3') as verified for one association. Used by the
// /admin/go-live-readiness dashboard to render "Verified by X on Y" for the
// 👤-manual gates from wiki/products/ycm/cherry-hill-go-live-checklist-v1.md.
// Note: YCM canonically uses `associations`/`associationId`; the founder-os
// dispatch text said `community_id` but we align to YCM convention per OP #20.
export const goLiveGateAttestations = pgTable("go_live_gate_attestations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  gateId: text("gate_id").notNull(),
  attestedByUserId: text("attested_by_user_id").notNull(),
  attestedByEmail: text("attested_by_email").notNull(),
  attestedAt: timestamp("attested_at").defaultNow().notNull(),
  notes: text("notes"),
}, (table) => ({
  assocGateLookupIdx: index("go_live_gate_attestations_assoc_gate_idx").on(
    table.associationId,
    table.gateId,
    table.attestedAt,
  ),
  assocGateUserUniq: uniqueIndex("go_live_gate_attestations_assoc_gate_user_uniq").on(
    table.associationId,
    table.gateId,
    table.attestedByUserId,
  ),
}));

// YCM#220 / readiness P2-5 — treasurer month-close attestation. ONE row per
// (association, calendar month) recording that a treasurer/admin closed the
// books for that period: who + when + a snapshot of the matched/unmatched
// reconciliation counts at close time. `status` toggles closed → reopened
// (re-opening is an explicit, audit-logged action). "Is June reconciled?" is
// answered by a single row lookup: a `closed`-status row for (assoc, '2026-06')
// means yes. This is an ATTESTATION record only — it does NOT lock ledger
// writes retroactively (full period-locking of postings is out of scope). The
// forensic close/reopen history lives in audit_logs. See
// migrations/0054_period_closes.sql.
export const periodCloses = pgTable("period_closes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  periodMonth: text("period_month").notNull(), // 'YYYY-MM' (e.g. '2026-06')
  status: text("status").notNull().default("closed"), // 'closed' | 'reopened'
  matchedCount: integer("matched_count").notNull().default(0),
  unmatchedBankTxCount: integer("unmatched_bank_tx_count").notNull().default(0),
  unmatchedLedgerEntryCount: integer("unmatched_ledger_entry_count").notNull().default(0),
  closedByUserId: text("closed_by_user_id").notNull(),
  closedByEmail: text("closed_by_email").notNull(),
  closedAt: timestamp("closed_at").defaultNow().notNull(),
  reopenedByUserId: text("reopened_by_user_id"),
  reopenedByEmail: text("reopened_by_email"),
  reopenedAt: timestamp("reopened_at"),
  notes: text("notes"),
}, (table) => ({
  assocMonthUniq: uniqueIndex("period_closes_assoc_month_uniq").on(
    table.associationId,
    table.periodMonth,
  ),
  assocLookupIdx: index("period_closes_assoc_idx").on(
    table.associationId,
    table.periodMonth,
  ),
}));

// #1327 — self-managed onboarding wizard state machine. One row per admin user
// who lands on the Day-0-14 wizard. Step state persists across logout/login;
// reminder cadence sweeps incomplete wizards at Day 7/10/12/13/14. See
// migrations/0027_onboarding_progress.sql for the step-number mapping.
export const onboardingProgress = pgTable("onboarding_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminUserId: varchar("admin_user_id").notNull().references(() => adminUsers.id, { onDelete: "cascade" }),
  associationId: varchar("association_id").references(() => associations.id, { onDelete: "set null" }),
  currentStep: integer("current_step").notNull().default(1),
  stepsCompleted: jsonb("steps_completed").notNull().default(sql`'[]'::jsonb`),
  stepsSkipped: jsonb("steps_skipped").notNull().default(sql`'[]'::jsonb`),
  wizardStartedAt: timestamp("wizard_started_at").defaultNow().notNull(),
  wizardTargetCompletionAt: timestamp("wizard_target_completion_at").notNull(),
  wizardCompletedAt: timestamp("wizard_completed_at"),
  lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(),
  // #1617 (Child C) — per-day reminder-sent tracking. NULL = not yet sent.
  // The automation sweep filters on NULL + day-N threshold to keep sends
  // idempotent across restarts and slow ticks.
  day7ReminderSentAt: timestamp("day7_reminder_sent_at"),
  day10ReminderSentAt: timestamp("day10_reminder_sent_at"),
  day12ReminderSentAt: timestamp("day12_reminder_sent_at"),
  day13ReminderSentAt: timestamp("day13_reminder_sent_at"),
  day14ReminderSentAt: timestamp("day14_reminder_sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueAdminUser: uniqueIndex("onboarding_progress_admin_user_uq").on(table.adminUserId),
}));

export const oauthProviderEnum = pgEnum("oauth_provider", ["google"]);
export const authUsers = pgTable("auth_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminUserId: varchar("admin_user_id").references(() => adminUsers.id),
  email: text("email").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  avatarUrl: text("avatar_url"),
  isActive: integer("is_active").notNull().default(1),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueAuthUserEmail: uniqueIndex("auth_users_email_uq").on(table.email),
}));

export const authExternalAccounts = pgTable("auth_external_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => authUsers.id),
  provider: oauthProviderEnum("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  providerEmail: text("provider_email"),
  profileJson: jsonb("profile_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueProviderAccount: uniqueIndex("auth_external_accounts_provider_account_uq").on(table.provider, table.providerAccountId),
}));

export const permissionChangeLogs = pgTable("permission_change_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => adminUsers.id),
  oldRole: adminUserRoleEnum("old_role").notNull(),
  newRole: adminUserRoleEnum("new_role").notNull(),
  changedBy: text("changed_by").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  actorEmail: text("actor_email").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  associationId: varchar("association_id").references(() => associations.id),
  beforeJson: jsonb("before_json"),
  afterJson: jsonb("after_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// auth_events — every authentication event logged for forensic reconstruction
// + new-IP anomaly detection (WS12 / Issue #388 / Plaid attestation evidence).
// See migrations/0024_auth_events.sql for the canonical DDL +
// docs/security/zero-trust-architecture.md §5 for usage rationale.
export const authEvents = pgTable("auth_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => authUsers.id, { onDelete: "set null" }),
  adminUserId: varchar("admin_user_id").references(() => adminUsers.id, { onDelete: "set null" }),
  eventType: text("event_type").notNull(),       // oauth-login | magic-link-redeem | session-restore | logout | session-expired
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  outcome: text("outcome").notNull().default("success"),  // success | failure
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  authEventsUserCreatedIdx: index("auth_events_user_id_created_at_idx").on(table.userId, table.createdAt),
  authEventsAdminCreatedIdx: index("auth_events_admin_user_id_created_at_idx").on(table.adminUserId, table.createdAt),
  authEventsEventTypeIdx: index("auth_events_event_type_idx").on(table.eventType),
}));

export const feeFrequencyEnum = pgEnum("fee_frequency", ["monthly", "quarterly", "annually", "one-time"]);
export const hoaFeeSchedules = pgTable("hoa_fee_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  name: text("name").notNull(),
  amount: real("amount").notNull(),
  frequency: feeFrequencyEnum("frequency").notNull().default("monthly"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  graceDays: integer("grace_days").notNull().default(0),
  isActive: integer("is_active").notNull().default(1),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 4.3 Q7 canonical rule model — new enums (added in Wave 6; legacy feeFrequencyEnum /
// recurringChargeFrequencyEnum retained for this wave. Wave 7 will migrate to
// assessmentFrequencyEnum. See docs/projects/platform-overhaul/decisions/4.3-recurring-assessment-rules-engine.md.
export const assessmentAllocationMethodEnum = pgEnum("assessment_allocation_method", [
  "per-unit-equal",
  "per-sq-ft",
  "per-ownership-share",
  "custom",
]);
export const assessmentFrequencyEnum = pgEnum("assessment_frequency", [
  "monthly",
  "quarterly",
  "annually",
  "semi-annually",
  "one-time",
]);
export const assessmentUnitScopeModeEnum = pgEnum("assessment_unit_scope_mode", [
  "all-units",
  "inclusion-list",
  "exclusion-list",
  "unit-type-filter",
]);

export const specialAssessments = pgTable("special_assessments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  name: text("name").notNull(),
  totalAmount: real("total_amount").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  installmentCount: integer("installment_count").notNull().default(1),
  notes: text("notes"),
  isActive: integer("is_active").notNull().default(1),
  autoPostEnabled: integer("auto_post_enabled").notNull().default(0),
  excludedUnitIdsJson: jsonb("excluded_unit_ids_json").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  // 4.3 Q5 loan-style detail fields (nullable for backward compatibility).
  interestRatePercent: real("interest_rate_percent"),
  termMonths: integer("term_months"),
  allocationMethod: assessmentAllocationMethodEnum("allocation_method").notNull().default("per-unit-equal"),
  allocationCustomJson: jsonb("allocation_custom_json").$type<Record<string, number>>(),
  paymentOptionsJson: jsonb("payment_options_json").$type<{
    lumpSumAllowed: boolean;
    lumpSumDiscountPercent: number | null;
    customInstallmentPlansAllowed: boolean;
  }>(),
  // 4.3 Q7 canonical rule model — unit scope mode (the existing
  // excludedUnitIdsJson maps to the "exclusion-list" mode when populated).
  unitScopeMode: assessmentUnitScopeModeEnum("unit_scope_mode").notNull().default("all-units"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const lateFeeTypeEnum = pgEnum("late_fee_type", ["flat", "percent"]);
export const lateFeeRules = pgTable("late_fee_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  name: text("name").notNull(),
  feeType: lateFeeTypeEnum("fee_type").notNull().default("flat"),
  feeAmount: real("fee_amount").notNull(),
  graceDays: integer("grace_days").notNull().default(0),
  maxFee: real("max_fee"),
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const lateFeeEvents = pgTable("late_fee_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  ruleId: varchar("rule_id").notNull().references(() => lateFeeRules.id),
  referenceType: text("reference_type"),
  referenceId: text("reference_id"),
  balanceAmount: real("balance_amount").notNull(),
  dueDate: timestamp("due_date").notNull(),
  asOfDate: timestamp("as_of_date").notNull(),
  calculatedFee: real("calculated_fee").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const financialAccounts = pgTable("financial_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  name: text("name").notNull(),
  accountCode: text("account_code"),
  accountType: text("account_type").notNull().default("expense"),
  isActive: integer("is_active").notNull().default(1),
  // Bank → Chart-of-Accounts bridge (migration 0047). `source` distinguishes a
  // hand-entered COA row ('manual', the default — every pre-existing row) from
  // one mirrored from a linked Plaid bank account ('plaid'). A 'plaid' row is
  // owned by its bank connection: read-only in the COA UI and balance-synced.
  source: text("source").notNull().default("manual"),
  // FK to the bank account this row mirrors (only set when source='plaid'). The
  // bridge upserts keyed on this column, so re-linking/re-syncing is idempotent.
  linkedBankAccountId: varchar("linked_bank_account_id").references(() => bankAccounts.id),
  // Synced balance for a linked bank row (cents, mirrors bankAccounts.current_balance_cents).
  // Null for manual rows (manual COA entries don't carry a balance today).
  currentBalanceCents: integer("current_balance_cents"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  // One COA row per linked bank account — the upsert conflict target for the
  // bridge (idempotent re-link/re-sync). Postgres allows many NULLs, so manual
  // rows (linked_bank_account_id NULL) never collide.
  linkedBankAccountUq: uniqueIndex("financial_accounts_linked_bank_account_uq").on(table.linkedBankAccountId),
}));

export const financialCategories = pgTable("financial_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  name: text("name").notNull(),
  categoryType: text("category_type").notNull().default("expense"),
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const budgetVersionStatusEnum = pgEnum("budget_version_status", ["draft", "proposed", "ratified", "archived"]);
export const budgets = pgTable("budgets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  name: text("name").notNull(),
  fiscalYear: integer("fiscal_year").notNull(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const budgetVersions = pgTable("budget_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  budgetId: varchar("budget_id").notNull().references(() => budgets.id),
  versionNumber: integer("version_number").notNull(),
  status: budgetVersionStatusEnum("status").notNull().default("draft"),
  notes: text("notes"),
  ratifiedAt: timestamp("ratified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueVersionPerBudget: uniqueIndex("budget_versions_budget_version_uq").on(table.budgetId, table.versionNumber),
}));

export const budgetLines = pgTable("budget_lines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  budgetVersionId: varchar("budget_version_id").notNull().references(() => budgetVersions.id),
  accountId: varchar("account_id").references(() => financialAccounts.id),
  categoryId: varchar("category_id").references(() => financialCategories.id),
  lineItemName: text("line_item_name").notNull(),
  plannedAmount: real("planned_amount").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const invoiceStatusEnum = pgEnum("invoice_status", ["draft", "received", "approved", "paid", "void"]);
export const vendorStatusEnum = pgEnum("vendor_status", ["active", "inactive", "pending-renewal"]);
export const vendors = pgTable("vendors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  name: text("name").notNull(),
  trade: text("trade").notNull().default("general"),
  serviceArea: text("service_area"),
  primaryContactName: text("primary_contact_name"),
  primaryEmail: text("primary_email"),
  primaryPhone: text("primary_phone"),
  licenseNumber: text("license_number"),
  insuranceExpiresAt: timestamp("insurance_expires_at"),
  // W-9 on file, tracked as a received-date (null = not on file). Founder-os#9482.
  w9ReceivedAt: timestamp("w9_received_at"),
  status: vendorStatusEnum("status").notNull().default("active"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueVendorPerAssociation: uniqueIndex("vendors_association_name_uq").on(table.associationId, table.name),
}));

export const vendorInvoices = pgTable("vendor_invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  vendorId: varchar("vendor_id").references(() => vendors.id),
  vendorName: text("vendor_name").notNull(),
  invoiceNumber: text("invoice_number"),
  invoiceDate: timestamp("invoice_date").notNull(),
  dueDate: timestamp("due_date"),
  amount: real("amount").notNull(),
  status: invoiceStatusEnum("status").notNull().default("received"),
  accountId: varchar("account_id").references(() => financialAccounts.id),
  categoryId: varchar("category_id").references(() => financialCategories.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const utilityPaymentStatusEnum = pgEnum("utility_payment_status", ["due", "scheduled", "paid"]);
export const utilityPayments = pgTable("utility_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  utilityType: text("utility_type").notNull(),
  providerName: text("provider_name").notNull(),
  servicePeriodStart: timestamp("service_period_start"),
  servicePeriodEnd: timestamp("service_period_end"),
  dueDate: timestamp("due_date"),
  paidDate: timestamp("paid_date"),
  amount: real("amount").notNull(),
  status: utilityPaymentStatusEnum("status").notNull().default("due"),
  accountId: varchar("account_id").references(() => financialAccounts.id),
  categoryId: varchar("category_id").references(() => financialCategories.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Disbursements — dual-approval (maker-checker) money-OUT control ────────────
//
// HOA Remediation Phase 2 (hoa-remediation-roadmap.html): segregation of duties
// on disbursements — the #1 embezzlement control. A disbursement records a
// money-OUT request (a payment to a vendor / against a vendor invoice) that MUST
// be approved by a DIFFERENT admin than the one who created it (maker ≠ checker)
// before it can be marked payable / paid.
//
// NET-NEW, ADDITIVE, ZERO live-book exposure: this table + its lifecycle are new.
// It does NOT post to the owner ledger, the GL, or any existing money path — it
// is an approval-gate record that PRECEDES any real payment. Marking a
// disbursement "paid" here records the approved-payment fact; it wires to no
// existing payout rail in this phase.
//
// Lifecycle (status): draft → pending-approval → approved → paid
//                             (or → rejected from draft / pending-approval)
// Maker ≠ checker is enforced SERVER-SIDE in the service layer, not just the UI:
// createdByAdminUserId can never equal approvedByAdminUserId / rejectedByAdminUserId.
export const disbursementStatusEnum = pgEnum("disbursement_status", [
  "draft",
  "pending-approval",
  "approved",
  "paid",
  "rejected",
]);

export const disbursements = pgTable("disbursements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  // The payee. vendorId is the linked vendor (optional — an ad-hoc payee is
  // allowed via vendorName only). Amount is stored in INTEGER CENTS so money
  // math is exact (mirrors the GL cents convention).
  vendorId: varchar("vendor_id").references(() => vendors.id),
  vendorName: text("vendor_name").notNull(),
  // Optional link to the vendor invoice this disbursement pays.
  vendorInvoiceId: varchar("vendor_invoice_id").references(() => vendorInvoices.id),
  amountCents: integer("amount_cents").notNull(),
  memo: text("memo"),
  status: disbursementStatusEnum("status").notNull().default("draft"),
  // MAKER — the admin who created the request. notNull: every disbursement has
  // an accountable originator. This is the identity checked against the approver.
  createdByAdminUserId: varchar("created_by_admin_user_id").notNull().references(() => adminUsers.id),
  createdByEmail: text("created_by_email").notNull(),
  // CHECKER — the DIFFERENT admin who approved (or rejected) the request.
  // Null until an approve/reject decision is recorded. Enforced ≠ maker.
  approvedByAdminUserId: varchar("approved_by_admin_user_id").references(() => adminUsers.id),
  approvedByEmail: text("approved_by_email"),
  approvedAt: timestamp("approved_at"),
  rejectedByAdminUserId: varchar("rejected_by_admin_user_id").references(() => adminUsers.id),
  rejectedByEmail: text("rejected_by_email"),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  // Set when a disbursement is marked paid (records the approved-payment fact;
  // wires to no live payout rail in this phase).
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  // Unit-of-work read index: list a tenant's disbursements by recency + status.
  disbursementsAssocStatusIdx: index("disbursements_assoc_status_created_idx").on(
    table.associationId,
    table.status,
    table.createdAt,
  ),
}));

// ── Architectural Review Committee (ARC) workflow (founder-os dispatch #9481) ──
// Owner architectural-change-request lifecycle: intake → committee routing →
// decision capture → records → appeal path. The agent moves a request through
// the WORKFLOW steps (intake, routing, recording an appeal) — those are L2
// plumbing. The APPROVE/DENY decision stays a HUMAN committee decision, and a
// DENIAL is member-affecting (L4): the service refuses any decision from a
// non-human actor, so an agent alone can never actuate a denial.
//
// NET-NEW / ADDITIVE: one new table + one enum + one index. Touches no
// existing table, column, money path, or governance record.
//
// Status flow:
//   submitted → under-review → approved
//                            → denied → appealed → appeal-approved
//                                                 → appeal-denied
export const arcRequestStatusEnum = pgEnum("arc_request_status", [
  "submitted",
  "under-review",
  "approved",
  "denied",
  "appealed",
  "appeal-approved",
  "appeal-denied",
]);

export const arcRequests = pgTable("arc_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  // The unit the proposed change affects (optional — an owner may hold multiple
  // units; the request is still association-scoped either way).
  unitId: varchar("unit_id").references(() => units.id),
  // What the owner wants to change.
  title: text("title").notNull(),
  // Free-text category (e.g. "fence", "deck", "exterior-paint"). Kept as text
  // (not an enum) so associations aren't boxed into a fixed taxonomy.
  category: text("category"),
  description: text("description").notNull(),
  // Supporting files as a JSON array of { name, url } objects. Additive metadata;
  // the workflow does not depend on any file being present.
  attachments: jsonb("attachments").$type<{ name: string; url: string }[]>().notNull().default(sql`'[]'::jsonb`),
  status: arcRequestStatusEnum("status").notNull().default("submitted"),
  // ── Submitter identity ──
  // "owner" = portal owner (identity from the portal session), "admin" = an
  // admin submitting on the owner's behalf, "agent" = an automated actor.
  submittedByType: text("submitted_by_type").notNull().default("owner"),
  submittedByEmail: text("submitted_by_email").notNull(),
  submittedByPersonId: varchar("submitted_by_person_id"),
  submittedByAdminUserId: varchar("submitted_by_admin_user_id").references(() => adminUsers.id),
  // ── Routing to committee (L2 workflow step) ──
  routedByAdminUserId: varchar("routed_by_admin_user_id").references(() => adminUsers.id),
  routedByEmail: text("routed_by_email"),
  routedAt: timestamp("routed_at"),
  committeeNote: text("committee_note"),
  // ── Decision capture (HUMAN committee decision; denial = L4) ──
  decidedByAdminUserId: varchar("decided_by_admin_user_id").references(() => adminUsers.id),
  decidedByEmail: text("decided_by_email"),
  decidedAt: timestamp("decided_at"),
  decisionReason: text("decision_reason"),
  // ── Appeal path ──
  appealReason: text("appeal_reason"),
  appealedByEmail: text("appealed_by_email"),
  appealedAt: timestamp("appealed_at"),
  appealDecidedByAdminUserId: varchar("appeal_decided_by_admin_user_id").references(() => adminUsers.id),
  appealDecidedByEmail: text("appeal_decided_by_email"),
  appealDecidedAt: timestamp("appeal_decided_at"),
  appealDecisionReason: text("appeal_decision_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  // Tenant-scoped list index: an association's ARC requests by status + recency.
  arcRequestsAssocStatusIdx: index("arc_requests_assoc_status_created_idx").on(
    table.associationId,
    table.status,
    table.createdAt,
  ),
}));

export const paymentMethodConfigs = pgTable("payment_method_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  methodType: text("method_type").notNull().default("other"),
  displayName: text("display_name").notNull(),
  instructions: text("instructions").notNull(),
  accountName: text("account_name"),
  bankName: text("bank_name"),
  routingNumber: text("routing_number"),
  accountNumber: text("account_number"),
  mailingAddress: text("mailing_address"),
  paymentNotes: text("payment_notes"),
  zelleHandle: text("zelle_handle"),
  supportEmail: text("support_email"),
  supportPhone: text("support_phone"),
  isActive: integer("is_active").notNull().default(1),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const paymentGatewayProviderEnum = pgEnum("payment_gateway_provider", ["stripe", "other"]);
export const paymentGatewayValidationStatusEnum = pgEnum("payment_gateway_validation_status", ["valid", "invalid"]);
export const paymentGatewayConnections = pgTable("payment_gateway_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  provider: paymentGatewayProviderEnum("provider").notNull().default("stripe"),
  providerAccountId: text("provider_account_id"),
  publishableKey: text("publishable_key"),
  secretKeyMasked: text("secret_key_masked"),
  webhookSecretMasked: text("webhook_secret_masked"),
  validationStatus: paymentGatewayValidationStatusEnum("validation_status").notNull().default("valid"),
  validationMessage: text("validation_message"),
  isActive: integer("is_active").notNull().default(1),
  lastValidatedAt: timestamp("last_validated_at"),
  metadataJson: jsonb("metadata_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueGatewayPerAssociationProvider: uniqueIndex("payment_gateway_connections_assoc_provider_uq").on(table.associationId, table.provider),
}));

export const ownerPaymentLinkStatusEnum = pgEnum("owner_payment_link_status", ["active", "paid", "expired", "void"]);
export const ownerPaymentLinks = pgTable("owner_payment_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  token: text("token").notNull(),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  unitId: varchar("unit_id").notNull().references(() => units.id),
  personId: varchar("person_id").notNull().references(() => persons.id),
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("USD"),
  status: ownerPaymentLinkStatusEnum("status").notNull().default("active"),
  allowPartial: integer("allow_partial").notNull().default(0),
  memo: text("memo"),
  expiresAt: timestamp("expires_at"),
  paidAt: timestamp("paid_at"),
  voidedAt: timestamp("voided_at"),
  metadataJson: jsonb("metadata_json"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueOwnerPaymentLinkToken: uniqueIndex("owner_payment_links_token_uq").on(table.token),
}));

export const paymentEventStatusEnum = pgEnum("payment_event_status", ["received", "processed", "ignored", "failed"]);
export const paymentWebhookEvents = pgTable("payment_webhook_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  provider: paymentGatewayProviderEnum("provider").notNull().default("stripe"),
  providerEventId: text("provider_event_id").notNull(),
  paymentLinkId: varchar("payment_link_id").references(() => ownerPaymentLinks.id),
  unitId: varchar("unit_id").references(() => units.id),
  personId: varchar("person_id").references(() => persons.id),
  // Money is INTEGER CENTS (founder-os#10779, migration 0068) — exact by construction,
  // mirroring the convention used by disbursements.amount_cents and the GL tables.
  // Supersedes the float8 dollars column from 0060 and its round-before-sum discipline.
  // NULLABLE is meaningful here: this is an audit record of what the gateway reported,
  // so "the gateway sent no amount" (NULL) stays distinguishable from "zero cents" (0).
  amountCents: integer("amount_cents"),
  currency: text("currency").default("USD"),
  status: paymentEventStatusEnum("status").notNull().default("received"),
  eventType: text("event_type"),
  gatewayReference: text("gateway_reference"),
  rawPayloadJson: jsonb("raw_payload_json"),
  processedAt: timestamp("processed_at"),
  ownerLedgerEntryId: text("owner_ledger_entry_id"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueProviderEventByAssociation: uniqueIndex("payment_webhook_events_assoc_provider_event_uq").on(table.associationId, table.provider, table.providerEventId),
}));

// Payment event state transitions — audit trail for webhook state machine
export const paymentEventTransitions = pgTable("payment_event_transitions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  webhookEventId: varchar("webhook_event_id").notNull().references(() => paymentWebhookEvents.id),
  fromStatus: text("from_status").notNull(),
  toStatus: text("to_status").notNull(),
  reason: text("reason"),
  transitionedAt: timestamp("transitioned_at").defaultNow().notNull(),
  transitionedBy: text("transitioned_by").notNull().default("system"),
});
export type PaymentEventTransition = typeof paymentEventTransitions.$inferSelect;
export const insertPaymentEventTransitionSchema = createInsertSchema(paymentEventTransitions);

export const expenseAttachmentTypeEnum = pgEnum("expense_attachment_type", ["invoice", "utility-payment"]);
export const expenseAttachments = pgTable("expense_attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  expenseType: expenseAttachmentTypeEnum("expense_type").notNull(),
  expenseId: text("expense_id").notNull(),
  title: text("title").notNull(),
  fileUrl: text("file_url").notNull(),
  uploadedBy: text("uploaded_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const ownerLedgerEntryTypeEnum = pgEnum("owner_ledger_entry_type", ["charge", "assessment", "payment", "late-fee", "credit", "adjustment"]);
export const ownerLedgerEntries = pgTable("owner_ledger_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  // The UNIT is the balance-bearing entity (Phase 1 / P0-1). unitId stays
  // notNull and is the sole balance key. Every existing row already carries a
  // valid unitId, so the unit balance is fully derivable today.
  unitId: varchar("unit_id").notNull().references(() => units.id),
  // Phase 1 (P0-1) — SEMANTIC pivot: personId is now "tendered-by" METADATA
  // (who paid), NOT the balance owner. The UNIT bears the balance; co-owners
  // are jointly & severally liable. We deliberately keep the Drizzle/TS type
  // notNull() (so the ~30 existing call sites that read entry.personId stay
  // type-clean and BACKWARD-COMPATIBLE — no cascade), while relaxing the intent:
  // for a unit-level payment where no single person tendered, callers set the
  // unit's primary-contact person as the "tendered-by" value rather than being
  // blocked. The ACTUAL database NOT NULL relaxation (so a NULL personId can be
  // stored) is a staged, gated, flag-guarded step deferred to the migration
  // PLAN (docs/phase1-unit-centric-migration-plan.md §Phase C) — it is NOT run
  // here and NOT reflected in the column type, precisely to avoid breaking
  // existing data / existing readers. Balance-of-record reads should group by
  // unitId, not personId (see buildUnitAccountStatement).
  personId: varchar("person_id").notNull().references(() => persons.id),
  entryType: ownerLedgerEntryTypeEnum("entry_type").notNull(),
  // Money is INTEGER CENTS (founder-os#10779, migration 0068) — exact by construction,
  // mirroring disbursements.amount_cents and the GL cents convention. This REPLACES the
  // float8-dollars column from 0060: callers no longer recover cents via
  // Math.round(Math.abs(amount) * 100), and there is no round-before-sum discipline to
  // remember — summing integer cents is exact. Sign convention is unchanged (payments and
  // credits are negative; charges/assessments/late-fees are positive).
  amountCents: integer("amount_cents").notNull(),
  postedAt: timestamp("posted_at").notNull(),
  description: text("description"),
  referenceType: text("reference_type"),
  referenceId: text("reference_id"),
  // Issue #448: Plaid bank-tx reconciliation. NULL = pending; populated on match.
  bankTransactionId: varchar("bank_transaction_id"),
  settledAt: timestamp("settled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // A-WEBHOOK-001/002 (founder-os#10737): the ONE canonical cross-path payment
  // identity — normally the Stripe payment_intent id — shared across every
  // endpoint/event that can observe the SAME underlying payment
  // (checkout.session.completed, payment_intent.succeeded, charge.succeeded,
  // payout.paid belt-and-suspenders, autopay's synchronous off-session charge).
  // Populated ONLY for entryType='payment' credit writes made through
  // `postPaymentLedgerEntry` (server/services/ledger-payment-identity.ts); NULL
  // for reversal/adjustment rows and for legacy/non-Stripe callers that have no
  // PI id to key on (those keep the pre-existing referenceType+referenceId
  // check — no new protection, no regression). See the partial unique index
  // below, which is what actually makes a cross-namespace or concurrent
  // double-credit for the same payment_intent impossible at the DB layer.
  paymentIdentityKey: text("payment_identity_key"),
}, (table) => ({
  // Phase 1 (P0-1): unit-scoped statement + aging reads group by
  // (associationId, unitId, postedAt). Additive index — no column change.
  byAssocUnitPosted: index("owner_ledger_entries_assoc_unit_posted_idx").on(table.associationId, table.unitId, table.postedAt),
  // A-WEBHOOK-001/002: ONE payment (associationId + payment_intent id) can post
  // AT MOST ONE 'payment' ledger row, no matter which of the three disjoint
  // write paths (payment-webhook / autopay_payment_transaction / stripe_charge)
  // gets there first. Partial (WHERE paymentIdentityKey IS NOT NULL) so legacy
  // rows with no key are never compared against each other.
  uniquePaymentIdentity: uniqueIndex("owner_ledger_entries_payment_identity_uq")
    .on(table.associationId, table.entryType, table.paymentIdentityKey)
    .where(sql`${table.paymentIdentityKey} is not null`),
}));

export const paymentPlanStatusEnum = pgEnum("payment_plan_status", ["active", "completed", "defaulted", "cancelled"]);
export const paymentPlans = pgTable("payment_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  unitId: varchar("unit_id").notNull().references(() => units.id),
  personId: varchar("person_id").notNull().references(() => persons.id),
  totalAmount: real("total_amount").notNull(),
  amountPaid: real("amount_paid").notNull().default(0),
  installmentAmount: real("installment_amount").notNull(),
  installmentFrequency: text("installment_frequency").notNull().default("monthly"),
  startDate: timestamp("start_date").notNull(),
  nextDueDate: timestamp("next_due_date"),
  endDate: timestamp("end_date"),
  status: paymentPlanStatusEnum("status").notNull().default("active"),
  notes: text("notes"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type PaymentPlan = typeof paymentPlans.$inferSelect;
export type InsertPaymentPlan = typeof paymentPlans.$inferInsert;

// Recurring charge schedules — define auto-charge rules per association
export const recurringChargeFrequencyEnum = pgEnum("recurring_charge_frequency", ["monthly", "quarterly", "annual"]);
export const recurringChargeScheduleStatusEnum = pgEnum("recurring_charge_schedule_status", ["active", "paused", "archived"]);
export const recurringChargeSchedules = pgTable("recurring_charge_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  unitId: varchar("unit_id").references(() => units.id), // null = all units (legacy; new code should consult unitScopeMode)
  chargeDescription: text("charge_description").notNull(),
  entryType: ownerLedgerEntryTypeEnum("entry_type").notNull().default("charge"),
  amount: real("amount").notNull(),
  frequency: recurringChargeFrequencyEnum("frequency").notNull().default("monthly"),
  dayOfMonth: integer("day_of_month").notNull().default(1), // 1-28
  nextRunDate: timestamp("next_run_date"),
  status: recurringChargeScheduleStatusEnum("status").notNull().default("active"),
  maxRetries: integer("max_retries").notNull().default(3),
  // 4.3 Q7 canonical rule model — unit scope, grace period, universal end date.
  unitScopeMode: assessmentUnitScopeModeEnum("unit_scope_mode").notNull().default("all-units"),
  includedUnitIdsJson: jsonb("included_unit_ids_json").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  unitTypeFilter: text("unit_type_filter"),
  graceDays: integer("grace_days").notNull().default(0),
  endDate: timestamp("end_date"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type RecurringChargeSchedule = typeof recurringChargeSchedules.$inferSelect;
export type InsertRecurringChargeSchedule = typeof recurringChargeSchedules.$inferInsert;
export const insertRecurringChargeScheduleSchema = createInsertSchema(recurringChargeSchedules, {
  // 4.3 Q7 canonical rule model — all optional for backward compatibility.
  unitScopeMode: z
    .enum(["all-units", "inclusion-list", "exclusion-list", "unit-type-filter"])
    .optional(),
  includedUnitIdsJson: z.array(z.string()).optional(),
  unitTypeFilter: z.string().nullable().optional(),
  graceDays: z.number().int().min(0, "graceDays must be >= 0").optional(),
  endDate: z.coerce.date().nullable().optional(),
});

// Recurring charge runs — execution history with retry tracking
export const recurringChargeRunStatusEnum = pgEnum("recurring_charge_run_status", ["pending", "success", "failed", "skipped", "retrying"]);
export const recurringChargeRuns = pgTable("recurring_charge_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scheduleId: varchar("schedule_id").notNull().references(() => recurringChargeSchedules.id),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  unitId: varchar("unit_id").references(() => units.id),
  amount: real("amount").notNull(),
  status: recurringChargeRunStatusEnum("status").notNull().default("pending"),
  ledgerEntryId: varchar("ledger_entry_id").references(() => ownerLedgerEntries.id),
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").notNull().default(0),
  nextRetryAt: timestamp("next_retry_at"),
  ranAt: timestamp("ran_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type RecurringChargeRun = typeof recurringChargeRuns.$inferSelect;
export type InsertRecurringChargeRun = typeof recurringChargeRuns.$inferInsert;
export const insertRecurringChargeRunSchema = createInsertSchema(recurringChargeRuns);

// 4.3 Q3 Wave 7 — Unified assessment-execution run log.
// Canonical audit trail for the assessment orchestrator
// (server/assessment-execution.ts). Written by both the recurring-charge and
// special-assessment handlers via the orchestrator. See
// docs/projects/platform-overhaul/decisions/4.3-recurring-assessment-rules-engine.md#q3.
export const assessmentRuleTypeEnum = pgEnum("assessment_rule_type_enum", [
  "recurring",
  "special-assessment",
  "late-fee",
]);
export const assessmentRunStatusEnum = pgEnum("assessment_run_status_enum", [
  "success",
  "failed",
  "retrying",
  "skipped",
  "deferred",
]);
export const assessmentRunLog = pgTable("assessment_run_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  ruleType: assessmentRuleTypeEnum("rule_type").notNull(),
  ruleId: varchar("rule_id").notNull(),
  unitId: varchar("unit_id"),
  runStartedAt: timestamp("run_started_at").defaultNow().notNull(),
  runCompletedAt: timestamp("run_completed_at"),
  status: assessmentRunStatusEnum("status").notNull(),
  amount: real("amount"),
  ledgerEntryId: varchar("ledger_entry_id"),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  retryAttempt: integer("retry_attempt").notNull().default(0),
}, (table) => ({
  assessmentRunLogAssociationIdx: index("assessment_run_log_association_idx")
    .on(table.associationId),
  assessmentRunLogRuleIdx: index("assessment_run_log_rule_idx")
    .on(table.ruleType, table.ruleId),
  assessmentRunLogStartedAtIdx: index("assessment_run_log_started_at_idx")
    .on(table.runStartedAt),
}));
export type AssessmentRunLogRow = typeof assessmentRunLog.$inferSelect;
export type InsertAssessmentRunLogRow = typeof assessmentRunLog.$inferInsert;

// 5.4 Wave 33 — In-process background job queue (perf 5.4-F3).
// Persists job state for the rule-run background path so the status endpoint
// can survive across restarts and report progress to a polling client. The
// row contains NO PII — `payload` references existing entities (associations,
// rules) by id only.
//
// Valid `state` values (enforced by CHECK constraint in migration 0016):
//   'queued'  — enqueued, awaiting worker pick-up.
//   'running' — worker has dequeued and is iterating units.
//   'done'    — worker finished without throwing. `result_json` populated.
//   'failed'  — worker threw. `error` populated.
//
// The `idempotency_key` column is a partial-unique index (only enforced for
// non-null values where state is queued/running). The dispatch endpoint
// derives the key from `(jobType, ruleId, asOfDate)` so a duplicate enqueue
// returns the existing jobId instead of spawning a second run.
export const backgroundJobs = pgTable("background_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobType: text("job_type").notNull(),
  payload: jsonb("payload").notNull(),
  state: text("state").notNull().default("queued"),
  idempotencyKey: text("idempotency_key"),
  enqueuedAt: timestamp("enqueued_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  error: text("error"),
  resultJson: jsonb("result_json"),
}, (table) => ({
  backgroundJobsStateEnqueuedAtIdx: index("background_jobs_state_enqueued_at_idx")
    .on(table.state, table.enqueuedAt),
}));
export type BackgroundJob = typeof backgroundJobs.$inferSelect;
export type InsertBackgroundJob = typeof backgroundJobs.$inferInsert;

export const meetingStatusEnum = pgEnum("meeting_status", ["scheduled", "in-progress", "completed", "cancelled"]);
export const meetingSummaryStatusEnum = pgEnum("meeting_summary_status", ["draft", "published"]);
export const governanceMeetings = pgTable("governance_meetings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  meetingType: text("meeting_type").notNull(),
  title: text("title").notNull(),
  scheduledAt: timestamp("scheduled_at").notNull(),
  location: text("location"),
  status: meetingStatusEnum("status").notNull().default("scheduled"),
  agenda: text("agenda"),
  notes: text("notes"),
  summaryText: text("summary_text"),
  summaryStatus: meetingSummaryStatusEnum("summary_status").notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const meetingAgendaItems = pgTable("meeting_agenda_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  meetingId: varchar("meeting_id").notNull().references(() => governanceMeetings.id),
  title: text("title").notNull(),
  description: text("description"),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const meetingNotes = pgTable("meeting_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  meetingId: varchar("meeting_id").notNull().references(() => governanceMeetings.id),
  noteType: text("note_type").notNull().default("general"),
  content: text("content").notNull(),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const resolutionStatusEnum = pgEnum("resolution_status", ["draft", "open", "approved", "rejected", "archived"]);
export const resolutions = pgTable("resolutions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  meetingId: varchar("meeting_id").references(() => governanceMeetings.id),
  title: text("title").notNull(),
  description: text("description"),
  status: resolutionStatusEnum("status").notNull().default("draft"),
  passedAt: timestamp("passed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const voteChoiceEnum = pgEnum("vote_choice", ["yes", "no", "abstain"]);
export const voteRecords = pgTable("vote_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  resolutionId: varchar("resolution_id").notNull().references(() => resolutions.id),
  voterPersonId: varchar("voter_person_id").references(() => persons.id),
  voteChoice: voteChoiceEnum("vote_choice").notNull(),
  voteWeight: real("vote_weight").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Digital Voting / Election Campaigns ──────────────────────────────────────
export const voteCampaigns = pgTable("vote_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  title: text("title").notNull(),
  description: text("description"),
  voteType: text("vote_type").notNull().default("resolution"), // 'election' | 'resolution' | 'poll'
  weightingRule: text("weighting_rule").notNull().default("unit"), // 'unit' | 'person' | 'board'
  isSecretBallot: integer("is_secret_ballot").notNull().default(0),
  quorumPercent: real("quorum_percent"),
  openAt: timestamp("open_at"),
  closeAt: timestamp("close_at"),
  status: text("status").notNull().default("draft"), // 'draft' | 'open' | 'closed' | 'certified'
  certifiedAt: timestamp("certified_at"),
  certifiedBy: text("certified_by"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const voteQuestions = pgTable("vote_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull().references(() => voteCampaigns.id),
  questionText: text("question_text").notNull(),
  choiceType: text("choice_type").notNull().default("yes-no"), // 'yes-no' | 'single' | 'multi'
  options: jsonb("options").$type<string[]>().default([]),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const voteBallots = pgTable("vote_ballots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull().references(() => voteCampaigns.id),
  unitId: varchar("unit_id").references(() => units.id),
  personId: varchar("person_id").references(() => persons.id),
  tokenHash: text("token_hash").notNull(),
  status: text("status").notNull().default("pending"), // 'pending' | 'cast' | 'proxy'
  proxyPersonId: varchar("proxy_person_id").references(() => persons.id),
  proxyDocumentUrl: text("proxy_document_url"),
  castAt: timestamp("cast_at"),
  castIp: text("cast_ip"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const voteAnswers = pgTable("vote_answers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ballotId: varchar("ballot_id").notNull().references(() => voteBallots.id),
  questionId: varchar("question_id").notNull().references(() => voteQuestions.id),
  selectedOptions: jsonb("selected_options").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
// ─────────────────────────────────────────────────────────────────────────────

export const calendarEvents = pgTable("calendar_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  eventType: text("event_type").notNull().default("governance"),
  title: text("title").notNull(),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at"),
  relatedType: text("related_type"),
  relatedId: text("related_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const complianceTemplateScopeEnum = pgEnum("compliance_template_scope", ["ct-baseline", "state-library", "association"]);
export const regulatoryPublicationStatusEnum = pgEnum("regulatory_publication_status", ["draft", "review", "published", "archived"]);
export const governanceComplianceTemplates = pgTable("governance_compliance_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").references(() => associations.id),
  baseTemplateId: varchar("base_template_id").references((): any => governanceComplianceTemplates.id),
  scope: complianceTemplateScopeEnum("scope").notNull().default("ct-baseline"),
  stateCode: text("state_code"),
  year: integer("year").notNull(),
  versionNumber: integer("version_number").notNull().default(1),
  name: text("name").notNull(),
  sourceAuthority: text("source_authority"),
  sourceUrl: text("source_url"),
  sourceDocumentTitle: text("source_document_title"),
  sourceDocumentDate: timestamp("source_document_date"),
  effectiveDate: timestamp("effective_date"),
  lastSourceUpdatedAt: timestamp("last_source_updated_at"),
  lastVerifiedAt: timestamp("last_verified_at"),
  lastSyncedAt: timestamp("last_synced_at"),
  nextReviewDueAt: timestamp("next_review_due_at"),
  publicationStatus: regulatoryPublicationStatusEnum("publication_status").notNull().default("draft"),
  publishedAt: timestamp("published_at"),
  reviewNotes: text("review_notes"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const governanceTemplateItems = pgTable("governance_template_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull().references(() => governanceComplianceTemplates.id),
  title: text("title").notNull(),
  description: text("description"),
  legalReference: text("legal_reference"),
  sourceCitation: text("source_citation"),
  sourceUrl: text("source_url"),
  dueMonth: integer("due_month").notNull(),
  dueDay: integer("due_day").notNull(),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const governanceTaskStatusEnum = pgEnum("governance_task_status", ["todo", "in-progress", "done"]);
export const annualGovernanceTasks = pgTable("annual_governance_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  templateId: varchar("template_id").references(() => governanceComplianceTemplates.id),
  templateItemId: varchar("template_item_id").references(() => governanceTemplateItems.id),
  title: text("title").notNull(),
  description: text("description"),
  status: governanceTaskStatusEnum("status").notNull().default("todo"),
  ownerPersonId: varchar("owner_person_id").references(() => persons.id),
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
  evidenceUrlsJson: jsonb("evidence_urls_json").notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const complianceAlertOverrideStatusEnum = pgEnum("compliance_alert_override_status", ["active", "suppressed", "resolved"]);
export const complianceAlertOverrides = pgTable("compliance_alert_overrides", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  templateId: varchar("template_id").references(() => governanceComplianceTemplates.id),
  templateItemId: varchar("template_item_id").notNull().references(() => governanceTemplateItems.id),
  status: complianceAlertOverrideStatusEnum("status").notNull().default("active"),
  suppressionReason: text("suppression_reason"),
  suppressedUntil: timestamp("suppressed_until"),
  notes: text("notes"),
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const ingestionSourceTypeEnum = pgEnum("ingestion_source_type", ["file-upload", "pasted-text"]);
export const ingestionJobStatusEnum = pgEnum("ingestion_job_status", ["queued", "processing", "completed", "failed"]);
export const aiIngestionJobs = pgTable("ai_ingestion_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").references(() => associations.id),
  sourceDocumentId: varchar("source_document_id").references(() => documents.id),
  sourceType: ingestionSourceTypeEnum("source_type").notNull(),
  sourceFilename: text("source_filename"),
  sourceText: text("source_text"),
  contextNotes: text("context_notes"),
  sourceFileUrl: text("source_file_url"),
  status: ingestionJobStatusEnum("status").notNull().default("queued"),
  submittedBy: text("submitted_by"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const extractionReviewStatusEnum = pgEnum("extraction_review_status", ["pending-review", "approved", "rejected"]);
export const aiExtractedRecords = pgTable("ai_extracted_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => aiIngestionJobs.id),
  associationId: varchar("association_id").references(() => associations.id),
  recordType: text("record_type").notNull(),
  payloadJson: jsonb("payload_json").notNull(),
  confidenceScore: real("confidence_score"),
  reviewStatus: extractionReviewStatusEnum("review_status").notNull().default("pending-review"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  supersededAt: timestamp("superseded_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const ingestionCorrectionFamilyEnum = pgEnum("ingestion_correction_family", ["owner-roster", "bank-statement"]);
export const associationIngestionCorrectionMemory = pgTable("association_ingestion_correction_memory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  recordType: ingestionCorrectionFamilyEnum("record_type").notNull(),
  correctionKind: text("correction_kind").notNull(),
  correctionKey: text("correction_key").notNull(),
  sourceExtractedRecordId: varchar("source_extracted_record_id").references(() => aiExtractedRecords.id),
  payloadJson: jsonb("payload_json").notNull(),
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueAssociationCorrectionKey: uniqueIndex("assoc_ingestion_correction_memory_uq").on(table.associationId, table.recordType, table.correctionKey),
}));

export const ingestionExceptionStatusEnum = pgEnum("ingestion_exception_status", ["open", "resolved", "dismissed"]);
export const aiIngestionExceptions = pgTable("ai_ingestion_exceptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ingestionJobId: varchar("ingestion_job_id").notNull().references(() => aiIngestionJobs.id),
  extractedRecordId: varchar("extracted_record_id").notNull().references(() => aiExtractedRecords.id),
  associationId: varchar("association_id").references(() => associations.id),
  recordType: text("record_type").notNull(),
  exceptionKind: text("exception_kind").notNull(),
  severity: text("severity").notNull().default("warning"),
  status: ingestionExceptionStatusEnum("status").notNull().default("open"),
  entityKey: text("entity_key"),
  message: text("message").notNull(),
  contextJson: jsonb("context_json"),
  suggestionsJson: jsonb("suggestions_json"),
  resolutionJson: jsonb("resolution_json"),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: text("resolved_by"),
  supersededAt: timestamp("superseded_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const ingestionImportModeEnum = pgEnum("ingestion_import_mode", ["preview", "commit"]);
export const aiIngestionImportRuns = pgTable("ai_ingestion_import_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ingestionJobId: varchar("ingestion_job_id").notNull().references(() => aiIngestionJobs.id),
  extractedRecordId: varchar("extracted_record_id").notNull().references(() => aiExtractedRecords.id),
  associationId: varchar("association_id").references(() => associations.id),
  mode: ingestionImportModeEnum("mode").notNull(),
  targetModule: text("target_module").notNull().default("none"),
  runStatus: text("run_status").notNull().default("recorded"),
  summaryJson: jsonb("summary_json").notNull(),
  createdEntityRefsJson: jsonb("created_entity_refs_json"),
  actorEmail: text("actor_email"),
  errorMessage: text("error_message"),
  rolledBackAt: timestamp("rolled_back_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const clauseRecords = pgTable("clause_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ingestionJobId: varchar("ingestion_job_id").notNull().references(() => aiIngestionJobs.id),
  extractedRecordId: varchar("extracted_record_id").references(() => aiExtractedRecords.id),
  associationId: varchar("association_id").references(() => associations.id),
  sourceDocumentId: varchar("source_document_id").references(() => documents.id),
  title: text("title").notNull(),
  clauseText: text("clause_text").notNull(),
  confidenceScore: real("confidence_score"),
  reviewStatus: extractionReviewStatusEnum("review_status").notNull().default("pending-review"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  supersededAt: timestamp("superseded_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const clauseTags = pgTable("clause_tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clauseRecordId: varchar("clause_record_id").notNull().references(() => clauseRecords.id),
  tag: text("tag").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const suggestedLinks = pgTable("suggested_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clauseRecordId: varchar("clause_record_id").notNull().references(() => clauseRecords.id),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  confidenceScore: real("confidence_score"),
  isApproved: integer("is_approved").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueSuggestedLink: uniqueIndex("suggested_links_unique_uq").on(table.clauseRecordId, table.entityType, table.entityId),
}));

export const noticeTemplates = pgTable("notice_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").references(() => associations.id),
  name: text("name").notNull(),
  channel: text("channel").notNull().default("email"),
  subjectTemplate: text("subject_template").notNull(),
  headerTemplate: text("header_template"),
  bodyTemplate: text("body_template").notNull(),
  footerTemplate: text("footer_template"),
  signatureTemplate: text("signature_template"),
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const noticeSends = pgTable("notice_sends", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").references(() => associations.id),
  templateId: varchar("template_id").references(() => noticeTemplates.id),
  campaignKey: text("campaign_key"),
  recipientEmail: text("recipient_email").notNull(),
  recipientPersonId: varchar("recipient_person_id").references(() => persons.id),
  subjectRendered: text("subject_rendered").notNull(),
  bodyRendered: text("body_rendered").notNull(),
  status: text("status").notNull().default("queued"),
  provider: text("provider").notNull().default("internal-mock"),
  providerMessageId: text("provider_message_id"),
  metadataJson: jsonb("metadata_json"),
  sentBy: text("sent_by"),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  deliveredAt: timestamp("delivered_at"),
  openedAt: timestamp("opened_at"),
  bouncedAt: timestamp("bounced_at"),
  bounceType: text("bounce_type"),
  bounceReason: text("bounce_reason"),
  retryCount: integer("retry_count").notNull().default(0),
  lastRetryAt: timestamp("last_retry_at"),
});

export const communicationHistory = pgTable("communication_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").references(() => associations.id),
  channel: text("channel").notNull().default("email"),
  direction: text("direction").notNull().default("outbound"),
  subject: text("subject"),
  bodySnippet: text("body_snippet"),
  recipientEmail: text("recipient_email"),
  recipientPersonId: varchar("recipient_person_id").references(() => persons.id),
  relatedType: text("related_type"),
  relatedId: text("related_id"),
  metadataJson: jsonb("metadata_json"),
  deliveryStatus: text("delivery_status"),
  deliveryStatusUpdatedAt: timestamp("delivery_status_updated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const smsDeliveryLogs = pgTable("sms_delivery_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageSid: text("message_sid").notNull(),
  associationId: varchar("association_id").references(() => associations.id),
  recipientPersonId: varchar("recipient_person_id").references(() => persons.id),
  toNumber: text("to_number").notNull(),
  fromNumber: text("from_number"),
  messageStatus: text("message_status").notNull(),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  rawPayloadJson: jsonb("raw_payload_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portalAccessId: varchar("portal_access_id").notNull().references(() => portalAccess.id),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  personId: varchar("person_id").notNull().references(() => persons.id),
  endpoint: text("endpoint").notNull(),
  p256dhKey: text("p256dh_key").notNull(),
  authKey: text("auth_key").notNull(),
  userAgent: text("user_agent"),
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniquePushEndpoint: uniqueIndex("push_subscriptions_endpoint_uq").on(table.endpoint),
}));

export const emailLogs = pgTable("email_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").references(() => associations.id),
  toAddress: text("to_address").notNull(),
  ccAddresses: jsonb("cc_addresses").notNull().default(sql`'[]'::jsonb`),
  bccAddresses: jsonb("bcc_addresses").notNull().default(sql`'[]'::jsonb`),
  subject: text("subject").notNull(),
  templateKey: text("template_key"),
  status: text("status").notNull().default("queued"),
  provider: text("provider").notNull().default("internal-mock"),
  providerMessageId: text("provider_message_id"),
  errorMessage: text("error_message"),
  metadataJson: jsonb("metadata_json"),
  trackingToken: text("tracking_token"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const emailEvents = pgTable("email_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  emailLogId: varchar("email_log_id").notNull().references(() => emailLogs.id),
  eventType: text("event_type").notNull(),
  url: text("url"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  occurredAt: timestamp("occurred_at").defaultNow().notNull(),
});

export const permissionEnvelopes = pgTable("permission_envelopes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").references(() => associations.id),
  name: text("name").notNull(),
  audience: text("audience").notNull().default("owner-self-service"),
  permissionsJson: jsonb("permissions_json").notNull(),
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const adminAssociationScopes = pgTable("admin_association_scopes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminUserId: varchar("admin_user_id").notNull().references(() => adminUsers.id),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  scope: text("scope").notNull().default("read-write"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueAdminAssociationScope: uniqueIndex("admin_association_scopes_unique_uq").on(table.adminUserId, table.associationId),
}));

// Phase 8a — portal role enum collapsed from ["owner", "tenant", "readonly", "board-member"]
// to ["owner", "board-member"]. Retired values are backfilled to "owner" by
// migration 0014_portal_role_collapse.sql. Tenant-vs-owner occupancy is now
// carried by `persons.residentType` / `portalAccess` provisioning metadata,
// NOT by the portal role. See:
//   - docs/projects/platform-overhaul/decisions/2.2-owner-portal-access-boundaries.md Q1
//   - docs/projects/platform-overhaul/decisions/3.3-role-gating-corrections.md Q1
export const portalAccessRoleEnum = pgEnum("portal_access_role", ["owner", "board-member"]);
export const portalAccessStatusEnum = pgEnum("portal_access_status", ["invited", "active", "suspended", "revoked", "expired"]);
export const portalAccess = pgTable("portal_access", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  personId: varchar("person_id").notNull().references(() => persons.id),
  unitId: varchar("unit_id").references(() => units.id),
  email: text("email").notNull(),
  role: portalAccessRoleEnum("role").notNull().default("owner"),
  status: portalAccessStatusEnum("status").notNull().default("active"),
  boardRoleId: varchar("board_role_id").references(() => boardRoles.id),
  invitedBy: text("invited_by"),
  invitedAt: timestamp("invited_at"),
  acceptedAt: timestamp("accepted_at"),
  suspendedAt: timestamp("suspended_at"),
  revokedAt: timestamp("revoked_at"),
  lastLoginAt: timestamp("last_login_at"),
  smsOptIn: integer("sms_opt_in").notNull().default(0),
  smsOptInChangedAt: timestamp("sms_opt_in_changed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniquePortalAccessPerAssociationEmailUnit: uniqueIndex("portal_access_assoc_email_unit_uq").on(table.associationId, table.email, sql`COALESCE(${table.unitId}, '')`),
}));

export const associationMemberships = pgTable("association_memberships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  personId: varchar("person_id").notNull().references(() => persons.id),
  unitId: varchar("unit_id").references(() => units.id),
  membershipType: text("membership_type").notNull().default("owner"),
  status: text("status").notNull().default("active"),
  isPrimary: integer("is_primary").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const onboardingResidentTypeEnum = pgEnum("onboarding_resident_type", ["owner", "tenant"]);
export const onboardingInviteStatusEnum = pgEnum("onboarding_invite_status", ["active", "submitted", "approved", "rejected", "expired", "revoked"]);
export const onboardingSubmissionStatusEnum = pgEnum("onboarding_submission_status", ["pending", "approved", "rejected"]);

export const onboardingInvites = pgTable("onboarding_invites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  unitId: varchar("unit_id").references(() => units.id),
  residentType: onboardingResidentTypeEnum("resident_type").notNull(),
  email: text("email"),
  phone: text("phone"),
  deliveryChannel: text("delivery_channel").notNull().default("link"),
  token: text("token").notNull(),
  status: onboardingInviteStatusEnum("status").notNull().default("active"),
  expiresAt: timestamp("expires_at"),
  createdBy: text("created_by"),
  lastSentAt: timestamp("last_sent_at"),
  submittedAt: timestamp("submitted_at"),
  approvedAt: timestamp("approved_at"),
  rejectedAt: timestamp("rejected_at"),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueOnboardingInviteToken: uniqueIndex("onboarding_invites_token_uq").on(table.token),
}));

export const onboardingSubmissions = pgTable("onboarding_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  inviteId: varchar("invite_id").references(() => onboardingInvites.id),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  unitId: varchar("unit_id").notNull().references(() => units.id),
  residentType: onboardingResidentTypeEnum("resident_type").notNull(),
  sourceChannel: text("source_channel").notNull().default("unit-link"),
  status: onboardingSubmissionStatusEnum("status").notNull().default("pending"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  mailingAddress: text("mailing_address"),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  contactPreference: text("contact_preference").notNull().default("email"),
  occupancyIntent: text("occupancy_intent"),
  startDate: timestamp("start_date").notNull(),
  ownershipPercentage: real("ownership_percentage"),
  additionalOwnersJson: jsonb("additional_owners_json"),
  tenantResidentsJson: jsonb("tenant_residents_json"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  rejectionReason: text("rejection_reason"),
  createdPersonId: varchar("created_person_id").references(() => persons.id),
  createdOccupancyId: varchar("created_occupancy_id").references(() => occupancies.id),
  createdOwnershipId: varchar("created_ownership_id").references(() => ownerships.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// 4.3 Q6 — PM toggle registry (per-association boolean overrides)
//
// Each row is a `(associationId, toggleKey)` pair with an enabled flag. The
// table exists so Managers can flip per-association PM-toggle overrides that
// extend the default PM-Managed Default Access Table described in ADR 0.2
// ("PM Toggle Configuration Model"). Default state for any toggle key is
// OFF — the absence of a row means "not overridden" which we resolve to
// disabled for every consumer today (Assisted Board write expansion).
//
// Valid toggle keys are enumerated in `PM_TOGGLE_KEYS` below; the server
// rejects PUTs with any other key. This keeps the set tractable and prevents
// drive-by key pollution.
// ---------------------------------------------------------------------------
export const pmToggles = pgTable("pm_toggles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  toggleKey: text("toggle_key").notNull(),
  enabled: integer("enabled").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: varchar("updated_by").references(() => adminUsers.id),
}, (table) => ({
  uniquePmToggleAssociationKey: uniqueIndex("pm_toggles_association_key_uq").on(table.associationId, table.toggleKey),
}));

export const PM_TOGGLE_KEYS = ["assessment_rules_write"] as const;
export type PmToggleKey = (typeof PM_TOGGLE_KEYS)[number];

export function isPmToggleKey(value: unknown): value is PmToggleKey {
  return typeof value === "string" && (PM_TOGGLE_KEYS as readonly string[]).includes(value);
}

export const tenantConfigs = pgTable("tenant_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  portalName: text("portal_name").notNull().default("Owner Portal"),
  supportEmail: text("support_email"),
  allowContactUpdates: integer("allow_contact_updates").notNull().default(1),
  ownerDocumentVisibility: text("owner_document_visibility").notNull().default("owner-safe"),
  gmailIntegrationStatus: text("gmail_integration_status").notNull().default("not-configured"),
  defaultNoticeFooter: text("default_notice_footer"),
  managementType: text("management_type").notNull().default("self-managed"),
  managementCompanyName: text("management_company_name"),
  aiIngestionRolloutMode: text("ai_ingestion_rollout_mode").notNull().default("full"),
  aiIngestionCanaryPercent: integer("ai_ingestion_canary_percent").notNull().default(100),
  aiIngestionRolloutNotes: text("ai_ingestion_rollout_notes"),
  smsFromNumber: text("sms_from_number"),
  // ── Tenant sending alias (migration 0049) ──────────────────────────────
  // Per-association sending identity on the verified yourcondomanager.org
  // domain. Owner-facing email (dues notices, announcements, receipts) is sent
  // FROM `<email_slug>@yourcondomanager.org` with `email_display_name` as the
  // friendly "From" name and a Reply-To pointing at the tenant's real inbox.
  // GATED behind the TENANT_SENDING_ALIAS_ENABLED flag (default OFF) — when the
  // flag is off, or when these are null, the global EMAIL_FROM default is used,
  // so existing behavior is unchanged. `email_slug` is GLOBALLY UNIQUE so a
  // tenant's alias can only ever resolve to its own association (anti-spoofing).
  emailSlug: text("email_slug"),
  emailDisplayName: text("email_display_name"),
  emailReplyToOverride: text("email_reply_to_override"),
  // Advanced (design only, flag-gated, NOT live in v1): a tenant's own send
  // domain (requires per-domain Resend verification before it can be used).
  customSendDomain: text("custom_send_domain"),
  customSendDomainVerified: integer("custom_send_domain_verified").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueTenantConfigAssociation: uniqueIndex("tenant_configs_association_uq").on(table.associationId),
  // Global uniqueness of the sending-alias local-part across ALL tenants. A
  // partial index (WHERE email_slug IS NOT NULL) so unconfigured tenants don't
  // collide on NULL.
  uniqueTenantEmailSlug: uniqueIndex("tenant_configs_email_slug_uq").on(table.emailSlug).where(sql`email_slug IS NOT NULL`),
}));

export const emailThreads = pgTable("email_threads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  subject: text("subject").notNull(),
  participantsJson: jsonb("participants_json").notNull().default(sql`'[]'::jsonb`),
  source: text("source").notNull().default("internal"),
  lastMessageAt: timestamp("last_message_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const contactUpdateReviewStatusEnum = pgEnum("contact_update_review_status", ["pending", "approved", "rejected"]);
export const contactUpdateRequests = pgTable("contact_update_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  portalAccessId: varchar("portal_access_id").notNull().references(() => portalAccess.id),
  personId: varchar("person_id").notNull().references(() => persons.id),
  requestJson: jsonb("request_json").notNull(),
  reviewStatus: contactUpdateReviewStatusEnum("review_status").notNull().default("pending"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const maintenanceRequestStatusEnum = pgEnum("maintenance_request_status", [
  "submitted",
  "triaged",
  "in-progress",
  "resolved",
  "closed",
  "rejected",
]);
export const maintenanceRequestPriorityEnum = pgEnum("maintenance_request_priority", ["low", "medium", "high", "urgent"]);
export const maintenanceRequests = pgTable("maintenance_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  unitId: varchar("unit_id").references(() => units.id),
  submittedByPersonId: varchar("submitted_by_person_id").references(() => persons.id),
  submittedByPortalAccessId: varchar("submitted_by_portal_access_id").references(() => portalAccess.id),
  submittedByEmail: text("submitted_by_email"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  locationText: text("location_text"),
  category: text("category").notNull().default("general"),
  priority: maintenanceRequestPriorityEnum("priority").notNull().default("medium"),
  status: maintenanceRequestStatusEnum("status").notNull().default("submitted"),
  attachmentUrlsJson: jsonb("attachment_urls_json").notNull().default(sql`'[]'::jsonb`),
  assignedTo: text("assigned_to"),
  resolutionNotes: text("resolution_notes"),
  responseDueAt: timestamp("response_due_at"),
  escalationStage: integer("escalation_stage").notNull().default(0),
  escalatedAt: timestamp("escalated_at"),
  lastEscalationNoticeAt: timestamp("last_escalation_notice_at"),
  triagedAt: timestamp("triaged_at"),
  resolvedAt: timestamp("resolved_at"),
  closedAt: timestamp("closed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const workOrderStatusEnum = pgEnum("work_order_status", ["open", "assigned", "in-progress", "pending-review", "closed", "cancelled"]);
export const workOrders = pgTable("work_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  maintenanceRequestId: varchar("maintenance_request_id").references(() => maintenanceRequests.id),
  unitId: varchar("unit_id").references(() => units.id),
  vendorId: varchar("vendor_id").references(() => vendors.id),
  vendorInvoiceId: varchar("vendor_invoice_id").references(() => vendorInvoices.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  locationText: text("location_text"),
  category: text("category").notNull().default("general"),
  priority: maintenanceRequestPriorityEnum("priority").notNull().default("medium"),
  status: workOrderStatusEnum("status").notNull().default("open"),
  assignedTo: text("assigned_to"),
  estimatedCost: real("estimated_cost"),
  actualCost: real("actual_cost"),
  scheduledFor: timestamp("scheduled_for"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  resolutionNotes: text("resolution_notes"),
  photosJson: jsonb("photos_json").notNull().default(sql`'[]'::jsonb`),
  vendorEstimatedCompletionDate: timestamp("vendor_estimated_completion_date"),
  vendorNotes: text("vendor_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueMaintenanceRequestWorkOrder: uniqueIndex("work_orders_request_uq").on(table.maintenanceRequestId),
}));

export const inspectionLocationTypeEnum = pgEnum("inspection_location_type", ["unit", "common-area", "building"]);
export const inspectionConditionEnum = pgEnum("inspection_condition", ["excellent", "good", "fair", "poor", "critical"]);
export const inspectionFindingSeverityEnum = pgEnum("inspection_finding_severity", ["low", "medium", "high", "critical"]);
export const inspectionFindingStatusEnum = pgEnum("inspection_finding_status", ["open", "monitoring", "resolved"]);

export const inspectionRecords = pgTable("inspection_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  unitId: varchar("unit_id").references(() => units.id),
  locationType: inspectionLocationTypeEnum("location_type").notNull().default("unit"),
  locationText: text("location_text").notNull(),
  inspectionType: text("inspection_type").notNull().default("routine"),
  inspectorName: text("inspector_name").notNull(),
  overallCondition: inspectionConditionEnum("overall_condition").notNull().default("good"),
  summary: text("summary"),
  inspectedAt: timestamp("inspected_at").notNull().defaultNow(),
  findingsJson: jsonb("findings_json").notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const maintenanceFrequencyUnitEnum = pgEnum("maintenance_frequency_unit", ["month", "quarter", "year"]);
export const maintenanceScheduleStatusEnum = pgEnum("maintenance_schedule_status", ["active", "paused", "archived"]);
export const maintenanceInstanceStatusEnum = pgEnum("maintenance_instance_status", ["scheduled", "due", "converted", "completed", "skipped"]);

export const maintenanceScheduleTemplates = pgTable("maintenance_schedule_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  unitId: varchar("unit_id").references(() => units.id),
  vendorId: varchar("vendor_id").references(() => vendors.id),
  title: text("title").notNull(),
  component: text("component").notNull(),
  description: text("description"),
  locationText: text("location_text").notNull(),
  frequencyUnit: maintenanceFrequencyUnitEnum("frequency_unit").notNull().default("quarter"),
  frequencyInterval: integer("frequency_interval").notNull().default(1),
  responsibleParty: text("responsible_party"),
  autoCreateWorkOrder: integer("auto_create_work_order").notNull().default(0),
  nextDueAt: timestamp("next_due_at").notNull(),
  status: maintenanceScheduleStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const maintenanceScheduleInstances = pgTable("maintenance_schedule_instances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull().references(() => maintenanceScheduleTemplates.id),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  unitId: varchar("unit_id").references(() => units.id),
  vendorId: varchar("vendor_id").references(() => vendors.id),
  workOrderId: varchar("work_order_id").references(() => workOrders.id),
  title: text("title").notNull(),
  component: text("component").notNull(),
  locationText: text("location_text").notNull(),
  dueAt: timestamp("due_at").notNull(),
  status: maintenanceInstanceStatusEnum("status").notNull().default("scheduled"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const assetConditionEnum = pgEnum("asset_condition", ["excellent", "good", "fair", "poor", "unknown"]);
export const associationAssets = pgTable("association_assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  unitId: varchar("unit_id").references(() => units.id),
  vendorId: varchar("vendor_id").references(() => vendors.id),
  name: text("name").notNull(),
  assetType: text("asset_type").notNull(),
  manufacturer: text("manufacturer"),
  model: text("model"),
  serialNumber: text("serial_number"),
  location: text("location"),
  installDate: timestamp("install_date"),
  warrantyExpiresAt: timestamp("warranty_expires_at"),
  lastServicedAt: timestamp("last_serviced_at"),
  nextServiceDueAt: timestamp("next_service_due_at"),
  estimatedLifespanYears: integer("estimated_lifespan_years"),
  replacementCostEstimate: real("replacement_cost_estimate"),
  condition: assetConditionEnum("condition").notNull().default("unknown"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const communityAnnouncementPriorityEnum = pgEnum("community_announcement_priority", ["normal", "important", "urgent"]);
export const communityAnnouncements = pgTable("community_announcements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  title: text("title").notNull(),
  body: text("body").notNull(),
  priority: communityAnnouncementPriorityEnum("priority").notNull().default("normal"),
  authorName: text("author_name"),
  publishedAt: timestamp("published_at"),
  expiresAt: timestamp("expires_at"),
  isPinned: integer("is_pinned").notNull().default(0),
  isPublished: integer("is_published").notNull().default(0),
  targetAudience: text("target_audience").notNull().default("all"),
  createdBy: text("created_by"),
  // Hub notice extensions
  noticeCategory: text("notice_category"),
  visibilityLevel: text("visibility_level"),
  attachments: jsonb("attachments").default(sql`'[]'::jsonb`),
  isDraft: integer("is_draft").notNull().default(0),
  scheduledPublishAt: timestamp("scheduled_publish_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type CommunityAnnouncement = typeof communityAnnouncements.$inferSelect;
export type InsertCommunityAnnouncement = typeof communityAnnouncements.$inferInsert;

export const residentFeedbackCategoryEnum = pgEnum("resident_feedback_category", ["maintenance", "management", "amenities", "communication", "neighbor", "financial", "general"]);
export const residentFeedbacks = pgTable("resident_feedbacks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  unitId: varchar("unit_id").references(() => units.id),
  personId: varchar("person_id").references(() => persons.id),
  category: residentFeedbackCategoryEnum("category").notNull().default("general"),
  satisfactionScore: integer("satisfaction_score"),
  subject: text("subject"),
  feedbackText: text("feedback_text"),
  isAnonymous: integer("is_anonymous").notNull().default(0),
  adminNotes: text("admin_notes"),
  status: text("status").notNull().default("open"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type ResidentFeedback = typeof residentFeedbacks.$inferSelect;
export type InsertResidentFeedback = typeof residentFeedbacks.$inferInsert;

export const boardPackageStatusEnum = pgEnum("board_package_status", ["draft", "approved", "distributed"]);
export const boardPackageTemplates = pgTable("board_package_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  title: text("title").notNull(),
  frequency: text("frequency").notNull().default("monthly"),
  autoGenerate: integer("auto_generate").notNull().default(0),
  meetingType: text("meeting_type"),
  generateDaysBefore: integer("generate_days_before").notNull().default(7),
  lastAutoGeneratedAt: timestamp("last_auto_generated_at"),
  sectionsJson: jsonb("sections_json").notNull().default(sql`'[]'::jsonb`),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const boardPackages = pgTable("board_packages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").references(() => boardPackageTemplates.id),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  meetingId: varchar("meeting_id").references(() => governanceMeetings.id),
  title: text("title").notNull(),
  periodLabel: text("period_label").notNull(),
  status: boardPackageStatusEnum("status").notNull().default("draft"),
  contentJson: jsonb("content_json").notNull().default(sql`'[]'::jsonb`),
  annotationsJson: jsonb("annotations_json").notNull().default(sql`'[]'::jsonb`),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at"),
  distributedBy: text("distributed_by"),
  distributedAt: timestamp("distributed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const roadmapProjectStatusEnum = pgEnum("roadmap_project_status", ["active", "complete", "archived"]);
export const paymentReminderRules = pgTable("payment_reminder_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  name: text("name").notNull(),
  templateId: varchar("template_id").references(() => noticeTemplates.id),
  daysRelativeToDue: integer("days_relative_to_due").notNull().default(0),
  triggerOn: text("trigger_on").notNull().default("overdue"),
  minBalanceThreshold: real("min_balance_threshold").notNull().default(0),
  isActive: integer("is_active").notNull().default(1),
  lastRunAt: timestamp("last_run_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type PaymentReminderRule = typeof paymentReminderRules.$inferSelect;
export type InsertPaymentReminderRule = typeof paymentReminderRules.$inferInsert;

// Webhook signing secrets — per-association HMAC keys for payment webhook verification
export const webhookSigningSecrets = pgTable("webhook_signing_secrets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  secretHash: text("secret_hash").notNull(), // bcrypt/sha256 hash of actual secret — never store plaintext
  secretHint: text("secret_hint"), // last 4 chars of secret for display
  provider: text("provider").notNull().default("generic"), // "stripe", "square", "generic"
  isActive: integer("is_active").notNull().default(1),
  rotatedAt: timestamp("rotated_at"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueAssocProvider: uniqueIndex("webhook_signing_secrets_assoc_provider_uq").on(table.associationId, table.provider),
}));
export type WebhookSigningSecret = typeof webhookSigningSecrets.$inferSelect;
export type InsertWebhookSigningSecret = typeof webhookSigningSecrets.$inferInsert;
export const insertWebhookSigningSecretSchema = createInsertSchema(webhookSigningSecrets);

// Owner saved payment methods — per-owner payment method preferences (no sensitive data stored)
export const savedPaymentMethodTypeEnum = pgEnum("saved_payment_method_type", ["ach", "check", "zelle", "other"]);
export const savedPaymentMethodStatusEnum = pgEnum("saved_payment_method_status", [
  "pending_verification", "active", "inactive", "revoked", "failed",
]);
export const savedPaymentMethods = pgTable("saved_payment_methods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  personId: varchar("person_id").notNull().references(() => persons.id),
  methodType: savedPaymentMethodTypeEnum("method_type").notNull().default("ach"),
  displayName: text("display_name").notNull(), // e.g., "Chase checking ••••1234"
  last4: text("last4"), // last 4 digits of account (display only)
  bankName: text("bank_name"),
  externalTokenRef: text("external_token_ref"), // reference to payment processor token (no raw account data)
  provider: paymentGatewayProviderEnum("provider").notNull().default("stripe"),
  providerCustomerId: text("provider_customer_id"),
  providerPaymentMethodId: text("provider_payment_method_id"),
  status: savedPaymentMethodStatusEnum("status").notNull().default("pending_verification"),
  verifiedAt: timestamp("verified_at"),
  isDefault: integer("is_default").notNull().default(0),
  isActive: integer("is_active").notNull().default(1),
  addedAt: timestamp("added_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type SavedPaymentMethod = typeof savedPaymentMethods.$inferSelect;
export type InsertSavedPaymentMethod = typeof savedPaymentMethods.$inferInsert;
export const insertSavedPaymentMethodSchema = createInsertSchema(savedPaymentMethods);

// Autopay enrollment — owners opting in to automatic recurring payments
export const autopayFrequencyEnum = pgEnum("autopay_frequency", ["monthly", "quarterly", "annual"]);
export const autopayEnrollmentStatusEnum = pgEnum("autopay_enrollment_status", ["active", "paused", "cancelled"]);
export const autopayEnrollments = pgTable("autopay_enrollments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  unitId: varchar("unit_id").notNull().references(() => units.id),
  personId: varchar("person_id").notNull().references(() => persons.id),
  paymentMethodId: varchar("payment_method_id").references(() => savedPaymentMethods.id),
  amount: real("amount").notNull(),
  frequency: autopayFrequencyEnum("frequency").notNull().default("monthly"),
  dayOfMonth: integer("day_of_month").notNull().default(1),
  status: autopayEnrollmentStatusEnum("status").notNull().default("active"),
  nextPaymentDate: timestamp("next_payment_date"),
  description: text("description").notNull().default("Autopay HOA dues"),
  enrolledBy: text("enrolled_by"),
  enrolledAt: timestamp("enrolled_at").defaultNow().notNull(),
  cancelledBy: text("cancelled_by"),
  cancelledAt: timestamp("cancelled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type AutopayEnrollment = typeof autopayEnrollments.$inferSelect;
export type InsertAutopayEnrollment = typeof autopayEnrollments.$inferInsert;
export const insertAutopayEnrollmentSchema = createInsertSchema(autopayEnrollments);

// Autopay run history
export const autopayRunStatusEnum = pgEnum("autopay_run_status", ["success", "failed", "skipped"]);
export const autopayRuns = pgTable("autopay_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  enrollmentId: varchar("enrollment_id").notNull().references(() => autopayEnrollments.id),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  amount: real("amount").notNull(),
  status: autopayRunStatusEnum("status").notNull().default("success"),
  ledgerEntryId: varchar("ledger_entry_id").references(() => ownerLedgerEntries.id),
  paymentTransactionId: varchar("payment_transaction_id").references(() => paymentTransactions.id),
  errorMessage: text("error_message"),
  ranAt: timestamp("ran_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type AutopayRun = typeof autopayRuns.$inferSelect;
export type InsertAutopayRun = typeof autopayRuns.$inferInsert;
export const insertAutopayRunSchema = createInsertSchema(autopayRuns);

// Partial-payment rules — per-association rules controlling minimum payment amounts and receipt behavior
export const partialPaymentRules = pgTable("partial_payment_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  allowPartialPayments: integer("allow_partial_payments").notNull().default(1), // 0=no, 1=yes
  minimumPaymentAmount: real("minimum_payment_amount"), // null = no minimum
  minimumPaymentPercent: real("minimum_payment_percent"), // % of balance due, null = no minimum
  requirePaymentConfirmation: integer("require_payment_confirmation").notNull().default(1),
  sendReceiptEmail: integer("send_receipt_email").notNull().default(1),
  receiptEmailTemplate: text("receipt_email_template"), // template text for receipt
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueAssocPartialRule: uniqueIndex("partial_payment_rules_assoc_uq").on(table.associationId),
}));
export type PartialPaymentRule = typeof partialPaymentRules.$inferSelect;
export type InsertPartialPaymentRule = typeof partialPaymentRules.$inferInsert;
export const insertPartialPaymentRuleSchema = createInsertSchema(partialPaymentRules);

export const financialApprovalStatusEnum = pgEnum("financial_approval_status", ["pending", "approved", "rejected", "cancelled"]);
export const financialApprovals = pgTable("financial_approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  requestedBy: text("requested_by").notNull(),
  approverId: varchar("approver_id").references(() => adminUsers.id),
  status: financialApprovalStatusEnum("status").notNull().default("pending"),
  changeType: text("change_type").notNull(),
  changeDescription: text("change_description").notNull(),
  changeAmount: real("change_amount"),
  changePayloadJson: jsonb("change_payload_json"),
  requiredApprovers: integer("required_approvers").notNull().default(2),
  approvedBy: text("approved_by"),
  resolvedAt: timestamp("resolved_at"),
  resolverNotes: text("resolver_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type FinancialApproval = typeof financialApprovals.$inferSelect;
export type InsertFinancialApproval = typeof financialApprovals.$inferInsert;

export const roadmapTaskStatusEnum = pgEnum("roadmap_task_status", ["todo", "in-progress", "done"]);
export const roadmapEffortEnum = pgEnum("roadmap_effort", ["small", "medium", "large"]);
export const roadmapPriorityEnum = pgEnum("roadmap_priority", ["low", "medium", "high", "critical"]);

/**
 * Roadmap tables (roadmapProjects, roadmapWorkstreams, roadmapTasks) are intentionally
 * global/admin-scoped and do NOT have an associationId column. They track platform-wide
 * development work visible only to admin users, not tenant-specific data.
 */
export const roadmapProjects = pgTable("admin_roadmap_projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  status: roadmapProjectStatusEnum("status").notNull().default("active"),
  isCollapsed: integer("is_collapsed").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const roadmapWorkstreams = pgTable("admin_roadmap_workstreams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => roadmapProjects.id),
  title: text("title").notNull(),
  description: text("description"),
  orderIndex: integer("order_index").notNull().default(0),
  isCollapsed: integer("is_collapsed").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const roadmapTasks = pgTable("admin_roadmap_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => roadmapProjects.id),
  workstreamId: varchar("workstream_id").notNull().references(() => roadmapWorkstreams.id),
  title: text("title").notNull(),
  description: text("description"),
  status: roadmapTaskStatusEnum("status").notNull().default("todo"),
  effort: roadmapEffortEnum("effort"),
  priority: roadmapPriorityEnum("priority"),
  dependencyTaskIds: text("dependency_task_ids").array().notNull().default(sql`'{}'::text[]`),
  targetStartDate: timestamp("target_start_date"),
  targetEndDate: timestamp("target_end_date"),
  completedDate: timestamp("completed_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const roadmapTaskAttachments = pgTable("admin_roadmap_task_attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => roadmapTasks.id),
  fileUrl: text("file_url").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes"),
  uploadedBy: text("uploaded_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const executiveUpdateStatusEnum = pgEnum("executive_update_status", ["draft", "published"]);
export const executiveSourceTypeEnum = pgEnum("executive_source_type", ["manual", "roadmap-task", "roadmap-project"]);
export const executiveEvidenceTypeEnum = pgEnum("executive_evidence_type", ["release-note", "metric", "screenshot", "link", "note"]);

export const executiveUpdates = pgTable("admin_executive_updates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  headline: text("headline").notNull(),
  summary: text("summary").notNull(),
  problemStatement: text("problem_statement"),
  solutionSummary: text("solution_summary"),
  featuresDelivered: text("features_delivered").array().notNull().default(sql`'{}'::text[]`),
  businessValue: text("business_value"),
  status: executiveUpdateStatusEnum("status").notNull().default("draft"),
  sourceType: executiveSourceTypeEnum("source_type").notNull().default("manual"),
  sourceKey: text("source_key"),
  projectId: varchar("project_id").references(() => roadmapProjects.id),
  workstreamId: varchar("workstream_id").references(() => roadmapWorkstreams.id),
  taskId: varchar("task_id").references(() => roadmapTasks.id),
  deliveredAt: timestamp("delivered_at"),
  displayOrder: integer("display_order").notNull().default(0),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueSourceKey: uniqueIndex("admin_executive_updates_source_key_uq").on(table.sourceKey),
}));

export const executiveEvidence = pgTable("admin_executive_evidence", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  executiveUpdateId: varchar("executive_update_id").notNull().references(() => executiveUpdates.id),
  evidenceType: executiveEvidenceTypeEnum("evidence_type").notNull().default("note"),
  label: text("label").notNull(),
  value: text("value").notNull(),
  metadataJson: jsonb("metadata_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const analysisVersions = pgTable("admin_analysis_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  resourceId: text("resource_id").notNull(),
  module: text("module").notNull(),
  version: integer("version").notNull(),
  payloadJson: jsonb("payload_json").notNull(),
  itemCount: integer("item_count").notNull().default(0),
  trigger: text("trigger").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const analysisRuns = pgTable("admin_analysis_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  resourceId: text("resource_id").notNull(),
  module: text("module").notNull(),
  action: text("action").notNull(),
  success: integer("success").notNull().default(1),
  durationMs: integer("duration_ms").notNull().default(0),
  itemCount: integer("item_count").notNull().default(0),
  errorMessage: text("error_message"),
  metadataJson: jsonb("metadata_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insurancePolicyTypeEnum = pgEnum("insurance_policy_type", ["master", "d-and-o", "fidelity-bond", "umbrella", "liability", "flood", "earthquake", "other"]);

export const associationInsurancePolicies = pgTable("association_insurance_policies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  policyType: insurancePolicyTypeEnum("policy_type").notNull(),
  carrier: text("carrier").notNull(),
  policyNumber: text("policy_number"),
  effectiveDate: timestamp("effective_date"),
  expirationDate: timestamp("expiration_date"),
  premiumAmount: real("premium_amount"),
  coverageAmount: real("coverage_amount"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAssociationSchema = createInsertSchema(associations).omit({ id: true, createdAt: true });
export const insertBuildingSchema = createInsertSchema(buildings).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUnitSchema = createInsertSchema(units).omit({ id: true, createdAt: true });
export const insertPersonSchema = createInsertSchema(persons).omit({ id: true, createdAt: true });
export const insertPersonContactPointSchema = createInsertSchema(personContactPoints).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOwnershipSchema = createInsertSchema(ownerships).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOccupancySchema = createInsertSchema(occupancies).omit({ id: true });
export const insertBoardRoleSchema = createInsertSchema(boardRoles).omit({ id: true });
export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, createdAt: true });
export const insertDocumentTagSchema = createInsertSchema(documentTags).omit({ id: true, createdAt: true });
export const insertDocumentVersionSchema = createInsertSchema(documentVersions).omit({ id: true, createdAt: true });
export const insertAdminUserSchema = createInsertSchema(adminUsers).omit({ id: true, createdAt: true, updatedAt: true });
export const insertConsentRecordSchema = createInsertSchema(consentRecords).omit({ id: true, consentedAt: true });
export type ConsentRecord = typeof consentRecords.$inferSelect;
export type InsertConsentRecord = z.infer<typeof insertConsentRecordSchema>;

// #1522 (WS4) — deletion request types. Insert schema omits server-managed
// fields (id, timestamps, approval audit) — only userId + userEmail come
// from the portal POST body.
export const insertDeletionRequestSchema = createInsertSchema(deletionRequests).omit({
  id: true,
  requestedAt: true,
  approvedAt: true,
  approvedBy: true,
  cancelledAt: true,
  status: true,
});
export type DeletionRequest = typeof deletionRequests.$inferSelect;
export type InsertDeletionRequest = z.infer<typeof insertDeletionRequestSchema>;

// #1340 — go-live readiness gate attestations. Insert schema omits
// server-managed fields. Only association, gate, attester identity, and
// optional notes come from the admin POST body.
export const insertGoLiveGateAttestationSchema = createInsertSchema(goLiveGateAttestations).omit({
  id: true,
  attestedAt: true,
});
export type GoLiveGateAttestation = typeof goLiveGateAttestations.$inferSelect;
export type InsertGoLiveGateAttestation = z.infer<typeof insertGoLiveGateAttestationSchema>;

// Period-close attestation (YCM#220). Server manages id + timestamps + the
// reopen fields; only association, month, snapshot counts, and closer identity
// come from the service on close.
export const insertPeriodCloseSchema = createInsertSchema(periodCloses).omit({
  id: true,
  closedAt: true,
  reopenedAt: true,
});
export type PeriodClose = typeof periodCloses.$inferSelect;
export type InsertPeriodClose = z.infer<typeof insertPeriodCloseSchema>;

export const insertOnboardingProgressSchema = createInsertSchema(onboardingProgress, {
  stepsCompleted: z.array(z.number().int().min(1).max(7)).default([]),
  stepsSkipped: z.array(z.number().int().min(1).max(7)).default([]),
}).omit({ id: true, createdAt: true, updatedAt: true, lastActivityAt: true });
export type OnboardingProgress = typeof onboardingProgress.$inferSelect;
export type InsertOnboardingProgress = z.infer<typeof insertOnboardingProgressSchema>;
export const insertAuthUserSchema = createInsertSchema(authUsers).omit({ id: true, createdAt: true, updatedAt: true, lastLoginAt: true });
export const insertAuthExternalAccountSchema = createInsertSchema(authExternalAccounts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export const insertHoaFeeScheduleSchema = createInsertSchema(hoaFeeSchedules, {
  startDate: z.coerce.date(),
  endDate: z.coerce.date().nullable().optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });
// 4.3 Q5/Q7 — the base object schema is exported so callers that need
// `.partial()` (e.g. PATCH routes) can still do so. The runtime-validated
// schema used by INSERT paths layers a superRefine on top of the base to
// enforce that allocationMethod='custom' requires allocationCustomJson.
export const insertSpecialAssessmentSchemaBase = createInsertSchema(specialAssessments, {
  excludedUnitIdsJson: z.array(z.string()).default([]),
  // 4.3 Q5/Q7 new fields — optional for backward compatibility with
  // existing callers and historical rows that pre-date Wave 6.
  interestRatePercent: z.number().min(0, "interestRatePercent must be >= 0").nullable().optional(),
  termMonths: z.number().int().min(0).nullable().optional(),
  allocationMethod: z
    .enum(["per-unit-equal", "per-sq-ft", "per-ownership-share", "custom"])
    .optional(),
  allocationCustomJson: z.record(z.string(), z.number()).nullable().optional(),
  paymentOptionsJson: z
    .object({
      lumpSumAllowed: z.boolean(),
      lumpSumDiscountPercent: z.number().nullable(),
      customInstallmentPlansAllowed: z.boolean(),
    })
    .nullable()
    .optional(),
  unitScopeMode: z
    .enum(["all-units", "inclusion-list", "exclusion-list", "unit-type-filter"])
    .optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertSpecialAssessmentSchema = insertSpecialAssessmentSchemaBase.superRefine(
  (value, ctx) => {
    if (value.allocationMethod === "custom") {
      const custom = value.allocationCustomJson;
      if (custom === undefined || custom === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["allocationCustomJson"],
          message:
            "allocationCustomJson is required when allocationMethod is 'custom'",
        });
      }
    }
  },
);
export const insertLateFeeRuleSchema = createInsertSchema(lateFeeRules).omit({ id: true, createdAt: true, updatedAt: true });
export const insertLateFeeEventSchema = createInsertSchema(lateFeeEvents).omit({ id: true, createdAt: true });
export const insertFinancialAccountSchema = createInsertSchema(financialAccounts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFinancialCategorySchema = createInsertSchema(financialCategories).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBudgetSchema = createInsertSchema(budgets).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBudgetVersionSchema = createInsertSchema(budgetVersions).omit({ id: true, createdAt: true, updatedAt: true, ratifiedAt: true });
export const insertBudgetLineSchema = createInsertSchema(budgetLines).omit({ id: true, createdAt: true, updatedAt: true });
export const insertVendorSchema = createInsertSchema(vendors).omit({ id: true, createdAt: true, updatedAt: true });
export const insertVendorInvoiceSchema = createInsertSchema(vendorInvoices).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDisbursementSchema = createInsertSchema(disbursements).omit({
  id: true,
  status: true,
  approvedByAdminUserId: true,
  approvedByEmail: true,
  approvedAt: true,
  rejectedByAdminUserId: true,
  rejectedByEmail: true,
  rejectedAt: true,
  rejectionReason: true,
  paidAt: true,
  createdAt: true,
  updatedAt: true,
});
export const insertArcRequestSchema = createInsertSchema(arcRequests).omit({
  id: true,
  status: true,
  routedByAdminUserId: true,
  routedByEmail: true,
  routedAt: true,
  committeeNote: true,
  decidedByAdminUserId: true,
  decidedByEmail: true,
  decidedAt: true,
  decisionReason: true,
  appealReason: true,
  appealedByEmail: true,
  appealedAt: true,
  appealDecidedByAdminUserId: true,
  appealDecidedByEmail: true,
  appealDecidedAt: true,
  appealDecisionReason: true,
  createdAt: true,
  updatedAt: true,
});
export const insertUtilityPaymentSchema = createInsertSchema(utilityPayments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPaymentMethodConfigSchema = createInsertSchema(paymentMethodConfigs).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPaymentGatewayConnectionSchema = createInsertSchema(paymentGatewayConnections).omit({ id: true, createdAt: true, updatedAt: true, lastValidatedAt: true });
export const insertOwnerPaymentLinkSchema = createInsertSchema(ownerPaymentLinks).omit({ id: true, token: true, createdAt: true, updatedAt: true, paidAt: true, voidedAt: true });
export const insertPaymentWebhookEventSchema = createInsertSchema(paymentWebhookEvents).omit({ id: true, createdAt: true, updatedAt: true, processedAt: true, ownerLedgerEntryId: true });
export const insertExpenseAttachmentSchema = createInsertSchema(expenseAttachments).omit({ id: true, createdAt: true });
export const insertOwnerLedgerEntrySchema = createInsertSchema(ownerLedgerEntries).omit({ id: true, createdAt: true });
export const insertPaymentPlanSchema = createInsertSchema(paymentPlans).omit({ id: true, createdAt: true, updatedAt: true });
export const insertGovernanceMeetingSchema = createInsertSchema(governanceMeetings).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMeetingAgendaItemSchema = createInsertSchema(meetingAgendaItems).omit({ id: true, createdAt: true });
export const insertMeetingNoteSchema = createInsertSchema(meetingNotes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertResolutionSchema = createInsertSchema(resolutions).omit({ id: true, createdAt: true, updatedAt: true, passedAt: true });
export const insertVoteRecordSchema = createInsertSchema(voteRecords).omit({ id: true, createdAt: true });
export const insertCalendarEventSchema = createInsertSchema(calendarEvents).omit({ id: true, createdAt: true, updatedAt: true });
export const insertGovernanceComplianceTemplateSchema = createInsertSchema(governanceComplianceTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertGovernanceTemplateItemSchema = createInsertSchema(governanceTemplateItems).omit({ id: true, createdAt: true });
export const insertAnnualGovernanceTaskSchema = createInsertSchema(annualGovernanceTasks).omit({ id: true, createdAt: true, updatedAt: true, completedAt: true });
export const insertComplianceAlertOverrideSchema = createInsertSchema(complianceAlertOverrides).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAiIngestionJobSchema = createInsertSchema(aiIngestionJobs).omit({ id: true, createdAt: true, updatedAt: true, startedAt: true, completedAt: true, errorMessage: true, status: true });
export const insertAiExtractedRecordSchema = createInsertSchema(aiExtractedRecords).omit({ id: true, createdAt: true, updatedAt: true, reviewedBy: true, reviewedAt: true, reviewStatus: true, supersededAt: true });
export const insertAssociationIngestionCorrectionMemorySchema = createInsertSchema(associationIngestionCorrectionMemory).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAiIngestionExceptionSchema = createInsertSchema(aiIngestionExceptions).omit({ id: true, createdAt: true, updatedAt: true, resolvedAt: true, supersededAt: true });
export const insertAiIngestionImportRunSchema = createInsertSchema(aiIngestionImportRuns).omit({ id: true, createdAt: true, updatedAt: true, rolledBackAt: true });
export const insertClauseRecordSchema = createInsertSchema(clauseRecords).omit({ id: true, createdAt: true, updatedAt: true, reviewedBy: true, reviewedAt: true, reviewStatus: true, supersededAt: true });
export const insertClauseTagSchema = createInsertSchema(clauseTags).omit({ id: true, createdAt: true });
export const insertSuggestedLinkSchema = createInsertSchema(suggestedLinks).omit({ id: true, createdAt: true, updatedAt: true, isApproved: true });
export const insertNoticeTemplateSchema = createInsertSchema(noticeTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertNoticeSendSchema = createInsertSchema(noticeSends).omit({ id: true, sentAt: true });
export const insertCommunicationHistorySchema = createInsertSchema(communicationHistory).omit({ id: true, createdAt: true });
export const insertSmsDeliveryLogSchema = createInsertSchema(smsDeliveryLogs).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEmailLogSchema = createInsertSchema(emailLogs).omit({ id: true, sentAt: true, createdAt: true, updatedAt: true });
export const insertEmailEventSchema = createInsertSchema(emailEvents).omit({ id: true, occurredAt: true });
export const insertPermissionEnvelopeSchema = createInsertSchema(permissionEnvelopes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAdminAssociationScopeSchema = createInsertSchema(adminAssociationScopes).omit({ id: true, createdAt: true });
export const insertPortalAccessSchema = createInsertSchema(portalAccess).omit({ id: true, createdAt: true, updatedAt: true, lastLoginAt: true });
export const insertAssociationMembershipSchema = createInsertSchema(associationMemberships).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOnboardingInviteSchema = createInsertSchema(onboardingInvites).omit({
  id: true,
  token: true,
  status: true,
  submittedAt: true,
  approvedAt: true,
  rejectedAt: true,
  revokedAt: true,
  createdAt: true,
  updatedAt: true,
});
export const insertOnboardingSubmissionSchema = createInsertSchema(onboardingSubmissions).omit({
  id: true,
  status: true,
  submittedAt: true,
  reviewedBy: true,
  reviewedAt: true,
  rejectionReason: true,
  createdPersonId: true,
  createdOccupancyId: true,
  createdOwnershipId: true,
  createdAt: true,
  updatedAt: true,
});
export const insertTenantConfigSchema = createInsertSchema(tenantConfigs).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEmailThreadSchema = createInsertSchema(emailThreads).omit({ id: true, createdAt: true, updatedAt: true, lastMessageAt: true });
export const insertContactUpdateRequestSchema = createInsertSchema(contactUpdateRequests).omit({ id: true, createdAt: true, updatedAt: true, reviewStatus: true, reviewedBy: true, reviewedAt: true });
export const insertMaintenanceRequestSchema = createInsertSchema(maintenanceRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  responseDueAt: true,
  escalationStage: true,
  escalatedAt: true,
  lastEscalationNoticeAt: true,
  triagedAt: true,
  resolvedAt: true,
  closedAt: true,
});
export const insertWorkOrderSchema = createInsertSchema(workOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  startedAt: true,
  completedAt: true,
});
export const inspectionFindingItemSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  status: z.enum(["open", "monitoring", "resolved"]).default("open"),
  photoUrls: z.array(z.string()).default([]),
  linkedWorkOrderId: z.string().nullable().optional(),
});
export const insertInspectionRecordSchema = createInsertSchema(inspectionRecords)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    findingsJson: z.array(inspectionFindingItemSchema).optional(),
  });
export const insertMaintenanceScheduleTemplateSchema = createInsertSchema(maintenanceScheduleTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertMaintenanceScheduleInstanceSchema = createInsertSchema(maintenanceScheduleInstances).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertAssociationAssetSchema = createInsertSchema(associationAssets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type AssociationAsset = typeof associationAssets.$inferSelect;
export type InsertAssociationAsset = typeof associationAssets.$inferInsert;

export const insertBoardPackageTemplateSchema = createInsertSchema(boardPackageTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertBoardPackageSchema = createInsertSchema(boardPackages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
// `visibility_level` on community_announcements is a plain text column (NOT
// enum-bound) and nullable. Post-HV-3 the column is constrained to the new
// vocabulary via a CHECK constraint added in
// `0018_hub_visibility_rename_drop_old.sql`. The zod schema mirrors that
// constraint so invalid writes fail at the API boundary, not the DB.
export const insertCommunityAnnouncementSchema = createInsertSchema(communityAnnouncements).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  visibilityLevel: z.enum(HUB_VISIBILITY_ALL_VALUES).nullable().optional(),
});
export const insertResidentFeedbackSchema = createInsertSchema(residentFeedbacks).omit({ id: true, createdAt: true, updatedAt: true, resolvedAt: true });
export const insertPaymentReminderRuleSchema = createInsertSchema(paymentReminderRules).omit({ id: true, createdAt: true, updatedAt: true, lastRunAt: true });
export const insertFinancialApprovalSchema = createInsertSchema(financialApprovals).omit({ id: true, createdAt: true, updatedAt: true, resolvedAt: true });
export const insertRoadmapProjectSchema = createInsertSchema(roadmapProjects).omit({ id: true, createdAt: true, updatedAt: true });
export const insertRoadmapWorkstreamSchema = createInsertSchema(roadmapWorkstreams).omit({ id: true, createdAt: true, updatedAt: true });
export const insertRoadmapTaskSchema = createInsertSchema(roadmapTasks).omit({ id: true, createdAt: true, updatedAt: true, completedDate: true }).extend({
  dependencyTaskIds: z.array(z.string()).optional(),
});
export const insertRoadmapTaskAttachmentSchema = createInsertSchema(roadmapTaskAttachments).omit({ id: true, createdAt: true });
export const insertExecutiveUpdateSchema = createInsertSchema(executiveUpdates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertExecutiveEvidenceSchema = createInsertSchema(executiveEvidence).omit({ id: true, createdAt: true });
export const insertAnalysisVersionSchema = createInsertSchema(analysisVersions).omit({ id: true, createdAt: true });
export const insertAnalysisRunSchema = createInsertSchema(analysisRuns).omit({ id: true, createdAt: true });
export const insertAssociationInsurancePolicySchema = createInsertSchema(associationInsurancePolicies).omit({ id: true, createdAt: true, updatedAt: true });

export type Association = typeof associations.$inferSelect;
export type InsertAssociation = z.infer<typeof insertAssociationSchema>;
export type Building = typeof buildings.$inferSelect;
export type InsertBuilding = z.infer<typeof insertBuildingSchema>;
export type Unit = typeof units.$inferSelect;
export type InsertUnit = z.infer<typeof insertUnitSchema>;
export type Person = typeof persons.$inferSelect;
export type InsertPerson = z.infer<typeof insertPersonSchema>;
export type PersonContactPoint = typeof personContactPoints.$inferSelect;
export type InsertPersonContactPoint = z.infer<typeof insertPersonContactPointSchema>;
export type Ownership = typeof ownerships.$inferSelect;
export type InsertOwnership = z.infer<typeof insertOwnershipSchema>;
export type Occupancy = typeof occupancies.$inferSelect;
export type InsertOccupancy = z.infer<typeof insertOccupancySchema>;
export type BoardRole = typeof boardRoles.$inferSelect;
export type InsertBoardRole = z.infer<typeof insertBoardRoleSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type UnitChangeHistory = typeof unitChangeHistory.$inferSelect;
export type DocumentTag = typeof documentTags.$inferSelect;
export type InsertDocumentTag = z.infer<typeof insertDocumentTagSchema>;
export type DocumentVersion = typeof documentVersions.$inferSelect;
export type InsertDocumentVersion = z.infer<typeof insertDocumentVersionSchema>;
export type AdminUser = typeof adminUsers.$inferSelect;
export type InsertAdminUser = z.infer<typeof insertAdminUserSchema>;
export type AuthUser = typeof authUsers.$inferSelect;
export type InsertAuthUser = z.infer<typeof insertAuthUserSchema>;
export type AuthExternalAccount = typeof authExternalAccounts.$inferSelect;
export type InsertAuthExternalAccount = z.infer<typeof insertAuthExternalAccountSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type PermissionChangeLog = typeof permissionChangeLogs.$inferSelect;
export type HoaFeeSchedule = typeof hoaFeeSchedules.$inferSelect;
export type InsertHoaFeeSchedule = z.infer<typeof insertHoaFeeScheduleSchema>;
export type SpecialAssessment = typeof specialAssessments.$inferSelect;
export type InsertSpecialAssessment = z.infer<typeof insertSpecialAssessmentSchema>;
export type LateFeeRule = typeof lateFeeRules.$inferSelect;
export type InsertLateFeeRule = z.infer<typeof insertLateFeeRuleSchema>;
export type LateFeeEvent = typeof lateFeeEvents.$inferSelect;
export type InsertLateFeeEvent = z.infer<typeof insertLateFeeEventSchema>;
export type FinancialAccount = typeof financialAccounts.$inferSelect;
export type InsertFinancialAccount = z.infer<typeof insertFinancialAccountSchema>;
export type FinancialCategory = typeof financialCategories.$inferSelect;
export type InsertFinancialCategory = z.infer<typeof insertFinancialCategorySchema>;
export type Budget = typeof budgets.$inferSelect;
export type InsertBudget = z.infer<typeof insertBudgetSchema>;
export type BudgetVersion = typeof budgetVersions.$inferSelect;
export type InsertBudgetVersion = z.infer<typeof insertBudgetVersionSchema>;
export type BudgetLine = typeof budgetLines.$inferSelect;
export type InsertBudgetLine = z.infer<typeof insertBudgetLineSchema>;
export type Vendor = typeof vendors.$inferSelect;
export type InsertVendor = z.infer<typeof insertVendorSchema>;
export type VendorInvoice = typeof vendorInvoices.$inferSelect;
export type InsertVendorInvoice = z.infer<typeof insertVendorInvoiceSchema>;
export type Disbursement = typeof disbursements.$inferSelect;
export type InsertDisbursement = z.infer<typeof insertDisbursementSchema>;
export type DisbursementStatus = (typeof disbursementStatusEnum.enumValues)[number];
export type ArcRequest = typeof arcRequests.$inferSelect;
export type InsertArcRequest = z.infer<typeof insertArcRequestSchema>;
export type ArcRequestStatus = (typeof arcRequestStatusEnum.enumValues)[number];
export type UtilityPayment = typeof utilityPayments.$inferSelect;
export type InsertUtilityPayment = z.infer<typeof insertUtilityPaymentSchema>;
export type PaymentMethodConfig = typeof paymentMethodConfigs.$inferSelect;
export type InsertPaymentMethodConfig = z.infer<typeof insertPaymentMethodConfigSchema>;
export type PaymentGatewayConnection = typeof paymentGatewayConnections.$inferSelect;
export type InsertPaymentGatewayConnection = z.infer<typeof insertPaymentGatewayConnectionSchema>;
export type OwnerPaymentLink = typeof ownerPaymentLinks.$inferSelect;
export type InsertOwnerPaymentLink = z.infer<typeof insertOwnerPaymentLinkSchema>;
export type PaymentWebhookEvent = typeof paymentWebhookEvents.$inferSelect;
export type InsertPaymentWebhookEvent = z.infer<typeof insertPaymentWebhookEventSchema>;
export type ExpenseAttachment = typeof expenseAttachments.$inferSelect;
export type InsertExpenseAttachment = z.infer<typeof insertExpenseAttachmentSchema>;
export type OwnerLedgerEntry = typeof ownerLedgerEntries.$inferSelect;
export type InsertOwnerLedgerEntry = z.infer<typeof insertOwnerLedgerEntrySchema>;
export type GovernanceMeeting = typeof governanceMeetings.$inferSelect;
export type InsertGovernanceMeeting = z.infer<typeof insertGovernanceMeetingSchema>;
export type MeetingAgendaItem = typeof meetingAgendaItems.$inferSelect;
export type InsertMeetingAgendaItem = z.infer<typeof insertMeetingAgendaItemSchema>;
export type MeetingNote = typeof meetingNotes.$inferSelect;
export type InsertMeetingNote = z.infer<typeof insertMeetingNoteSchema>;
export type Resolution = typeof resolutions.$inferSelect;
export type InsertResolution = z.infer<typeof insertResolutionSchema>;
export type VoteRecord = typeof voteRecords.$inferSelect;
export type InsertVoteRecord = z.infer<typeof insertVoteRecordSchema>;
export const insertVoteCampaignSchema = createInsertSchema(voteCampaigns).omit({ id: true, createdAt: true, updatedAt: true, certifiedAt: true });
export const insertVoteQuestionSchema = createInsertSchema(voteQuestions).omit({ id: true, createdAt: true });
export const insertVoteBallotSchema = createInsertSchema(voteBallots).omit({ id: true, createdAt: true, castAt: true });
export const insertVoteAnswerSchema = createInsertSchema(voteAnswers).omit({ id: true, createdAt: true });
export type VoteCampaign = typeof voteCampaigns.$inferSelect;
export type VoteQuestion = typeof voteQuestions.$inferSelect;
export type VoteBallot = typeof voteBallots.$inferSelect;
export type VoteAnswer = typeof voteAnswers.$inferSelect;
export type InsertVoteCampaign = z.infer<typeof insertVoteCampaignSchema>;
export type InsertVoteQuestion = z.infer<typeof insertVoteQuestionSchema>;
export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;
export type GovernanceComplianceTemplate = typeof governanceComplianceTemplates.$inferSelect;
export type InsertGovernanceComplianceTemplate = z.infer<typeof insertGovernanceComplianceTemplateSchema>;
export type GovernanceTemplateItem = typeof governanceTemplateItems.$inferSelect;
export type InsertGovernanceTemplateItem = z.infer<typeof insertGovernanceTemplateItemSchema>;
export type AnnualGovernanceTask = typeof annualGovernanceTasks.$inferSelect;
export type InsertAnnualGovernanceTask = z.infer<typeof insertAnnualGovernanceTaskSchema>;
export type ComplianceAlertOverride = typeof complianceAlertOverrides.$inferSelect;
export type InsertComplianceAlertOverride = z.infer<typeof insertComplianceAlertOverrideSchema>;
export type AiIngestionJob = typeof aiIngestionJobs.$inferSelect;
export type InsertAiIngestionJob = z.infer<typeof insertAiIngestionJobSchema>;
export type AiExtractedRecord = typeof aiExtractedRecords.$inferSelect;
export type InsertAiExtractedRecord = z.infer<typeof insertAiExtractedRecordSchema>;
export type AssociationIngestionCorrectionMemory = typeof associationIngestionCorrectionMemory.$inferSelect;
export type InsertAssociationIngestionCorrectionMemory = z.infer<typeof insertAssociationIngestionCorrectionMemorySchema>;
export type AiIngestionException = typeof aiIngestionExceptions.$inferSelect;
export type InsertAiIngestionException = z.infer<typeof insertAiIngestionExceptionSchema>;
export type AiIngestionImportRun = typeof aiIngestionImportRuns.$inferSelect;
export type InsertAiIngestionImportRun = z.infer<typeof insertAiIngestionImportRunSchema>;
export type ClauseRecord = typeof clauseRecords.$inferSelect;
export type InsertClauseRecord = z.infer<typeof insertClauseRecordSchema>;
export type ClauseTag = typeof clauseTags.$inferSelect;
export type InsertClauseTag = z.infer<typeof insertClauseTagSchema>;
export type SuggestedLink = typeof suggestedLinks.$inferSelect;
export type InsertSuggestedLink = z.infer<typeof insertSuggestedLinkSchema>;
export type NoticeTemplate = typeof noticeTemplates.$inferSelect;
export type InsertNoticeTemplate = z.infer<typeof insertNoticeTemplateSchema>;
export type NoticeSend = typeof noticeSends.$inferSelect;
export type InsertNoticeSend = z.infer<typeof insertNoticeSendSchema>;
export type CommunicationHistory = typeof communicationHistory.$inferSelect;
export type InsertCommunicationHistory = z.infer<typeof insertCommunicationHistorySchema>;
export type SmsDeliveryLog = typeof smsDeliveryLogs.$inferSelect;
export type InsertSmsDeliveryLog = z.infer<typeof insertSmsDeliveryLogSchema>;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;
export type EmailLog = typeof emailLogs.$inferSelect;
export type InsertEmailLog = z.infer<typeof insertEmailLogSchema>;
export type EmailEvent = typeof emailEvents.$inferSelect;
export type InsertEmailEvent = z.infer<typeof insertEmailEventSchema>;
export type PermissionEnvelope = typeof permissionEnvelopes.$inferSelect;
export type InsertPermissionEnvelope = z.infer<typeof insertPermissionEnvelopeSchema>;
export type AdminAssociationScope = typeof adminAssociationScopes.$inferSelect;
export type InsertAdminAssociationScope = z.infer<typeof insertAdminAssociationScopeSchema>;
export type PortalAccess = typeof portalAccess.$inferSelect;
export type InsertPortalAccess = z.infer<typeof insertPortalAccessSchema>;
export type AssociationMembership = typeof associationMemberships.$inferSelect;
export type InsertAssociationMembership = z.infer<typeof insertAssociationMembershipSchema>;
export type OnboardingInvite = typeof onboardingInvites.$inferSelect;
export type InsertOnboardingInvite = z.infer<typeof insertOnboardingInviteSchema>;
export type OnboardingSubmission = typeof onboardingSubmissions.$inferSelect;
export type InsertOnboardingSubmission = z.infer<typeof insertOnboardingSubmissionSchema>;
export type TenantConfig = typeof tenantConfigs.$inferSelect;
export type InsertTenantConfig = z.infer<typeof insertTenantConfigSchema>;
export type EmailThread = typeof emailThreads.$inferSelect;
export type InsertEmailThread = z.infer<typeof insertEmailThreadSchema>;
export type ContactUpdateRequest = typeof contactUpdateRequests.$inferSelect;
export type InsertContactUpdateRequest = z.infer<typeof insertContactUpdateRequestSchema>;
export type MaintenanceRequest = typeof maintenanceRequests.$inferSelect;
export type InsertMaintenanceRequest = z.infer<typeof insertMaintenanceRequestSchema>;
export type WorkOrder = typeof workOrders.$inferSelect;
export type InsertWorkOrder = z.infer<typeof insertWorkOrderSchema>;
export type InspectionRecord = typeof inspectionRecords.$inferSelect;
export type InspectionFindingItem = z.infer<typeof inspectionFindingItemSchema>;
export type InsertInspectionRecord = z.infer<typeof insertInspectionRecordSchema>;
export type MaintenanceScheduleTemplate = typeof maintenanceScheduleTemplates.$inferSelect;
export type InsertMaintenanceScheduleTemplate = z.infer<typeof insertMaintenanceScheduleTemplateSchema>;
export type MaintenanceScheduleInstance = typeof maintenanceScheduleInstances.$inferSelect;
export type InsertMaintenanceScheduleInstance = z.infer<typeof insertMaintenanceScheduleInstanceSchema>;
export type BoardPackageTemplate = typeof boardPackageTemplates.$inferSelect;
export type InsertBoardPackageTemplate = z.infer<typeof insertBoardPackageTemplateSchema>;
export type BoardPackage = typeof boardPackages.$inferSelect;
export type InsertBoardPackage = z.infer<typeof insertBoardPackageSchema>;
export type RoadmapProject = typeof roadmapProjects.$inferSelect;
export type InsertRoadmapProject = z.infer<typeof insertRoadmapProjectSchema>;
export type RoadmapWorkstream = typeof roadmapWorkstreams.$inferSelect;
export type InsertRoadmapWorkstream = z.infer<typeof insertRoadmapWorkstreamSchema>;
export type RoadmapTask = typeof roadmapTasks.$inferSelect;
export type InsertRoadmapTask = z.infer<typeof insertRoadmapTaskSchema>;
export type RoadmapTaskAttachment = typeof roadmapTaskAttachments.$inferSelect;
export type InsertRoadmapTaskAttachment = z.infer<typeof insertRoadmapTaskAttachmentSchema>;
export type ExecutiveUpdate = typeof executiveUpdates.$inferSelect;
export type InsertExecutiveUpdate = z.infer<typeof insertExecutiveUpdateSchema>;
export type ExecutiveEvidence = typeof executiveEvidence.$inferSelect;
export type InsertExecutiveEvidence = z.infer<typeof insertExecutiveEvidenceSchema>;
export type AnalysisVersion = typeof analysisVersions.$inferSelect;
export type InsertAnalysisVersion = z.infer<typeof insertAnalysisVersionSchema>;
export type AnalysisRun = typeof analysisRuns.$inferSelect;
export type InsertAnalysisRun = z.infer<typeof insertAnalysisRunSchema>;
export type AssociationInsurancePolicy = typeof associationInsurancePolicies.$inferSelect;
export type InsertAssociationInsurancePolicy = z.infer<typeof insertAssociationInsurancePolicySchema>;

// Delinquency thresholds and escalation tracking
export const delinquencyEscalationStatusEnum = pgEnum("delinquency_escalation_status", ["active", "resolved", "referred", "on_payment_plan"]);

export const delinquencyThresholds = pgTable("delinquency_thresholds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  stage: integer("stage").notNull(),
  stageName: text("stage_name").notNull(),
  minimumBalance: real("minimum_balance").notNull().default(0),
  minimumDaysOverdue: integer("minimum_days_overdue").notNull().default(30),
  actionType: text("action_type").notNull().default("notice"),
  noticeTemplateId: varchar("notice_template_id").references(() => noticeTemplates.id),
  lateFeePct: real("late_fee_pct"),
  lateFeeFlat: real("late_fee_flat"),
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertDelinquencyThresholdSchema = createInsertSchema(delinquencyThresholds).omit({ id: true, createdAt: true });
export type DelinquencyThreshold = typeof delinquencyThresholds.$inferSelect;
export type InsertDelinquencyThreshold = z.infer<typeof insertDelinquencyThresholdSchema>;

export const delinquencyEscalations = pgTable("delinquency_escalations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  personId: varchar("person_id").notNull().references(() => persons.id),
  unitId: varchar("unit_id").notNull().references(() => units.id),
  currentStage: integer("current_stage").notNull().default(1),
  balance: real("balance").notNull(),
  daysPastDue: integer("days_past_due").notNull().default(0),
  status: delinquencyEscalationStatusEnum("status").notNull().default("active"),
  lastNoticeAt: timestamp("last_notice_at"),
  nextActionAt: timestamp("next_action_at"),
  resolvedAt: timestamp("resolved_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export const insertDelinquencyEscalationSchema = createInsertSchema(delinquencyEscalations).omit({ id: true, createdAt: true, updatedAt: true });
export type DelinquencyEscalation = typeof delinquencyEscalations.$inferSelect;
export type InsertDelinquencyEscalation = z.infer<typeof insertDelinquencyEscalationSchema>;

// Governance reminder cadence rules
export const governanceReminderTriggerEnum = pgEnum("governance_reminder_trigger", ["before_meeting", "after_meeting", "task_due", "board_term_expiry"]);
export const governanceReminderRecipientEnum = pgEnum("governance_reminder_recipient", ["all_owners", "board_members", "managers", "meeting_attendees"]);

export const governanceReminderRules = pgTable("governance_reminder_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  name: text("name").notNull(),
  trigger: governanceReminderTriggerEnum("trigger").notNull(),
  daysOffset: integer("days_offset").notNull().default(3),
  recipientType: governanceReminderRecipientEnum("recipient_type").notNull().default("all_owners"),
  subjectTemplate: text("subject_template").notNull(),
  bodyTemplate: text("body_template").notNull(),
  meetingTypes: text("meeting_types"),
  isActive: integer("is_active").notNull().default(1),
  lastRunAt: timestamp("last_run_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export const insertGovernanceReminderRuleSchema = createInsertSchema(governanceReminderRules).omit({ id: true, createdAt: true, updatedAt: true });
export type GovernanceReminderRule = typeof governanceReminderRules.$inferSelect;
export type InsertGovernanceReminderRule = z.infer<typeof insertGovernanceReminderRuleSchema>;

export type ResidentialDatasetUnitOwner = {
  ownership: Ownership;
  person: Person | null;
};

export type ResidentialDatasetUnitOccupancy = {
  occupancy: Occupancy;
  person: Person | null;
};

export type ResidentialDatasetUnitOccupancyStatus = "OWNER_OCCUPIED" | "RENTAL_OCCUPIED" | "VACANT" | "UNASSIGNED";

export type ResidentialDatasetUnitDirectoryItem = {
  unit: Unit;
  association: Association | null;
  owners: ResidentialDatasetUnitOwner[];
  activeOccupancy: ResidentialDatasetUnitOccupancy | null;
  occupancyStatus: ResidentialDatasetUnitOccupancyStatus;
  ownerCount: number;
  tenantCount: number;
  occupantCount: number;
  lastOccupancyUpdate: string | null;
};

export type ResidentialDatasetPersonDirectoryItem = {
  person: Person;
  ownedUnitIds: string[];
  occupiedUnitIds: string[];
  isOwner: boolean;
  isOccupant: boolean;
  isTenant: boolean;
  isOwnerOccupant: boolean;
};

export type ResidentialDatasetSummary = {
  associations: number;
  units: number;
  persons: number;
  activeOwners: number;
  activeOccupancies: number;
  activeTenancies: number;
  ownerOccupiedUnits: number;
  rentalOccupiedUnits: number;
  vacantUnits: number;
  unassignedUnits: number;
  occupancyRatePercent: number;
};

export type ResidentialDataset = {
  associations: Association[];
  units: Unit[];
  persons: Person[];
  ownerships: Ownership[];
  occupancies: Occupancy[];
  unitDirectory: ResidentialDatasetUnitDirectoryItem[];
  personDirectory: ResidentialDatasetPersonDirectoryItem[];
  summary: ResidentialDatasetSummary;
};

// Bank statement reconciliation
export const reconciliationMatchStatusEnum = pgEnum("reconciliation_match_status", ["unmatched", "auto_matched", "manual_matched", "disputed", "excluded"]);

export const bankStatementImports = pgTable("bank_statement_imports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  filename: text("filename").notNull(),
  importedBy: text("imported_by"),
  statementDate: timestamp("statement_date"),
  openingBalance: real("opening_balance"),
  closingBalance: real("closing_balance"),
  transactionCount: integer("transaction_count").notNull().default(0),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertBankStatementImportSchema = createInsertSchema(bankStatementImports).omit({ id: true, createdAt: true });
export type BankStatementImport = typeof bankStatementImports.$inferSelect;
export type InsertBankStatementImport = z.infer<typeof insertBankStatementImportSchema>;

export const bankStatementTransactions = pgTable("bank_statement_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  importId: varchar("import_id").notNull().references(() => bankStatementImports.id),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  transactionDate: timestamp("transaction_date").notNull(),
  description: text("description").notNull(),
  amount: real("amount").notNull(),
  bankReference: text("bank_reference"),
  checkNumber: text("check_number"),
  matchStatus: reconciliationMatchStatusEnum("match_status").notNull().default("unmatched"),
  matchedLedgerEntryId: varchar("matched_ledger_entry_id").references(() => ownerLedgerEntries.id),
  matchedBy: text("matched_by"),
  matchedAt: timestamp("matched_at"),
  matchNotes: text("match_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertBankStatementTransactionSchema = createInsertSchema(bankStatementTransactions).omit({ id: true, createdAt: true });
export type BankStatementTransaction = typeof bankStatementTransactions.$inferSelect;
export type InsertBankStatementTransaction = z.infer<typeof insertBankStatementTransactionSchema>;

// Financial system alerts
export const financialAlertSeverityEnum = pgEnum("financial_alert_severity", ["info", "warning", "critical"]);
export const financialAlertTypeEnum = pgEnum("financial_alert_type", ["large_payment", "duplicate_payment", "negative_adjustment", "overdue_assessment", "reconciliation_gap", "budget_overage", "delinquency_spike", "expired_insurance_doc", "audit_anomaly"]);

export const financialAlerts = pgTable("financial_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  alertType: financialAlertTypeEnum("alert_type").notNull(),
  severity: financialAlertSeverityEnum("severity").notNull().default("warning"),
  title: text("title").notNull(),
  message: text("message").notNull(),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  amount: real("amount"),
  isRead: integer("is_read").notNull().default(0),
  isDismissed: integer("is_dismissed").notNull().default(0),
  dismissedBy: text("dismissed_by"),
  dismissedAt: timestamp("dismissed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertFinancialAlertSchema = createInsertSchema(financialAlerts).omit({ id: true, createdAt: true });
export type FinancialAlert = typeof financialAlerts.$inferSelect;
export type InsertFinancialAlert = z.infer<typeof insertFinancialAlertSchema>;

// Reconciliation period close controls
export const reconciliationPeriodStatusEnum = pgEnum("reconciliation_period_status", ["open", "closed", "locked"]);

export const reconciliationPeriods = pgTable("reconciliation_periods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  periodLabel: text("period_label").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  status: reconciliationPeriodStatusEnum("status").notNull().default("open"),
  importId: varchar("import_id").references(() => bankStatementImports.id),
  closedBy: text("closed_by"),
  closedAt: timestamp("closed_at"),
  lockedBy: text("locked_by"),
  lockedAt: timestamp("locked_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export const insertReconciliationPeriodSchema = createInsertSchema(reconciliationPeriods).omit({ id: true, createdAt: true, updatedAt: true });
export type ReconciliationPeriod = typeof reconciliationPeriods.$inferSelect;
export type InsertReconciliationPeriod = z.infer<typeof insertReconciliationPeriodSchema>;

// Collections handoff records
export const collectionsHandoffStatusEnum = pgEnum("collections_handoff_status", ["referred", "active", "settled", "withdrawn", "judgment"]);

export const collectionsHandoffs = pgTable("collections_handoffs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  unitId: varchar("unit_id").notNull().references(() => units.id),
  personId: varchar("person_id").notNull().references(() => persons.id),
  referralDate: timestamp("referral_date").notNull(),
  referralAmount: real("referral_amount").notNull(),
  currentBalance: real("current_balance").notNull(),
  daysPastDue: integer("days_past_due").notNull().default(0),
  status: collectionsHandoffStatusEnum("status").notNull().default("referred"),
  agencyName: text("agency_name"),
  agencyContactName: text("agency_contact_name"),
  agencyEmail: text("agency_email"),
  agencyPhone: text("agency_phone"),
  agencyCaseNumber: text("agency_case_number"),
  settlementAmount: real("settlement_amount"),
  settlementDate: timestamp("settlement_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export const insertCollectionsHandoffSchema = createInsertSchema(collectionsHandoffs).omit({ id: true, createdAt: true, updatedAt: true });
export type CollectionsHandoff = typeof collectionsHandoffs.$inferSelect;
export type InsertCollectionsHandoff = z.infer<typeof insertCollectionsHandoffSchema>;

// ─── Full Digital Voting & Elections ─────────────────────────────────────────

export const electionVoteTypeEnum = pgEnum("election_vote_type", ["board-election", "resolution", "community-referendum", "amendment-ratification"]);
export const electionVotingRuleEnum = pgEnum("election_voting_rule", ["unit-weighted", "person-weighted", "board-only"]);
export const electionStatusEnum = pgEnum("election_status", ["draft", "open", "closed", "certified", "cancelled"]);
export const electionResultVisibilityEnum = pgEnum("election_result_visibility", ["public", "admin-only"]);

export const elections = pgTable("elections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  meetingId: varchar("meeting_id").references(() => governanceMeetings.id),
  title: text("title").notNull(),
  description: text("description"),
  voteType: electionVoteTypeEnum("vote_type").notNull().default("resolution"),
  votingRule: electionVotingRuleEnum("voting_rule").notNull().default("unit-weighted"),
  isSecretBallot: integer("is_secret_ballot").notNull().default(0),
  resultVisibility: electionResultVisibilityEnum("result_visibility").notNull().default("public"),
  status: electionStatusEnum("status").notNull().default("draft"),
  opensAt: timestamp("opens_at"),
  closesAt: timestamp("closes_at"),
  nominationsOpenAt: timestamp("nominations_open_at"),
  nominationsCloseAt: timestamp("nominations_close_at"),
  quorumPercent: real("quorum_percent").notNull().default(50),
  maxChoices: integer("max_choices"),
  eligibleVoterCount: integer("eligible_voter_count").notNull().default(0),
  certifiedBy: text("certified_by"),
  certifiedAt: timestamp("certified_at"),
  certificationSummary: text("certification_summary"),
  resultDocumentId: varchar("result_document_id"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export const insertElectionSchema = createInsertSchema(elections).omit({ id: true, createdAt: true, updatedAt: true, certifiedAt: true, certificationSummary: true, resultDocumentId: true });
export type Election = typeof elections.$inferSelect;
export type InsertElection = z.infer<typeof insertElectionSchema>;

// Candidates/options for an election
export const electionOptions = pgTable("election_options", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  electionId: varchar("election_id").notNull().references(() => elections.id),
  label: text("label").notNull(),
  description: text("description"),
  bio: text("bio"),
  photoUrl: text("photo_url"),
  currentRole: text("current_role"),
  nominationStatement: text("nomination_statement"),
  nominatedByPersonId: varchar("nominated_by_person_id").references(() => persons.id),
  nominationStatus: text("nomination_status").default("approved"),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertElectionOptionSchema = createInsertSchema(electionOptions).omit({ id: true, createdAt: true });
export type ElectionOption = typeof electionOptions.$inferSelect;
export type InsertElectionOption = z.infer<typeof insertElectionOptionSchema>;

// Unique ballot token per eligible voter per election
export const electionBallotTokenStatusEnum = pgEnum("election_ballot_token_status", ["pending", "cast", "consumed-by-proxy", "revoked"]);
export const electionBallotTokens = pgTable("election_ballot_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  electionId: varchar("election_id").notNull().references(() => elections.id),
  token: text("token").notNull(),
  personId: varchar("person_id").references(() => persons.id),
  unitId: varchar("unit_id").references(() => units.id),
  status: electionBallotTokenStatusEnum("status").notNull().default("pending"),
  sentAt: timestamp("sent_at"),
  castAt: timestamp("cast_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueTokenPerElection: uniqueIndex("election_ballot_tokens_election_token_uq").on(table.electionId, table.token),
  uniqueVoterPerElection: uniqueIndex("election_ballot_tokens_election_person_uq").on(table.electionId, table.personId),
}));
export const insertElectionBallotTokenSchema = createInsertSchema(electionBallotTokens).omit({ id: true, createdAt: true, castAt: true, sentAt: true });
export type ElectionBallotToken = typeof electionBallotTokens.$inferSelect;
export type InsertElectionBallotToken = z.infer<typeof insertElectionBallotTokenSchema>;

// Actual ballot cast by a voter
export const electionBallotCasts = pgTable("election_ballot_casts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  electionId: varchar("election_id").notNull().references(() => elections.id),
  ballotTokenId: varchar("ballot_token_id").notNull().references(() => electionBallotTokens.id),
  personId: varchar("person_id").references(() => persons.id),
  unitId: varchar("unit_id").references(() => units.id),
  // JSON array of selected option IDs; null when secret ballot anonymization is applied
  choicesJson: jsonb("choices_json"),
  voteWeight: real("vote_weight").notNull().default(1),
  isProxy: integer("is_proxy").notNull().default(0),
  proxyForPersonId: varchar("proxy_for_person_id").references(() => persons.id),
  proxyForUnitId: varchar("proxy_for_unit_id").references(() => units.id),
  confirmationRef: text("confirmation_ref").notNull(),
  castAt: timestamp("cast_at").defaultNow().notNull(),
}, (table) => ({
  uniqueBallotPerToken: uniqueIndex("election_ballot_casts_token_uq").on(table.ballotTokenId),
}));
export const insertElectionBallotCastSchema = createInsertSchema(electionBallotCasts).omit({ id: true, castAt: true });
export type ElectionBallotCast = typeof electionBallotCasts.$inferSelect;
export type InsertElectionBallotCast = z.infer<typeof insertElectionBallotCastSchema>;

// Proxy designations — owner designates another person to vote on their behalf
export const electionProxyDesignations = pgTable("election_proxy_designations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  electionId: varchar("election_id").notNull().references(() => elections.id),
  ownerPersonId: varchar("owner_person_id").notNull().references(() => persons.id),
  ownerUnitId: varchar("owner_unit_id").references(() => units.id),
  proxyPersonId: varchar("proxy_person_id").notNull().references(() => persons.id),
  designatedAt: timestamp("designated_at").defaultNow().notNull(),
  revokedAt: timestamp("revoked_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueProxyPerOwnerElection: uniqueIndex("election_proxy_designations_election_owner_uq").on(table.electionId, table.ownerPersonId),
}));
export const insertElectionProxyDesignationSchema = createInsertSchema(electionProxyDesignations).omit({ id: true, createdAt: true, designatedAt: true });
export type ElectionProxyDesignation = typeof electionProxyDesignations.$inferSelect;
export type InsertElectionProxyDesignation = z.infer<typeof insertElectionProxyDesignationSchema>;

// Proxy document uploads — scanned physical proxy forms
export const electionProxyDocuments = pgTable("election_proxy_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  electionId: varchar("election_id").notNull().references(() => elections.id),
  ownerPersonId: varchar("owner_person_id").references(() => persons.id),
  ownerUnitId: varchar("owner_unit_id").references(() => units.id),
  fileUrl: text("file_url").notNull(),
  title: text("title").notNull(),
  uploadedBy: text("uploaded_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertElectionProxyDocumentSchema = createInsertSchema(electionProxyDocuments).omit({ id: true, createdAt: true });
export type ElectionProxyDocument = typeof electionProxyDocuments.$inferSelect;
export type InsertElectionProxyDocument = z.infer<typeof insertElectionProxyDocumentSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Budget ratification — Connecticut CGS §47-261e negative-option (owner-veto)
// adoption of budgets + special assessments. The statutory ratification flow
// sits OVER the existing budgets/budgetVersions engine and binds the version
// status to a real owner vote (negative option) instead of an admin flip.
//   §47-261e(a) — 30-day owner budget summary (with reserve statement) + a
//                 ratification meeting 10–60 days out; the budget is ratified
//                 UNLESS a majority of all unit owners reject it; on rejection
//                 the last-ratified budget continues.
//   §47-261e(b) — special assessment: the (a) ratification procedure applies
//                 when the assessment meets/exceeds the threshold (default 15%
//                 of the current annual budget); below it the board may impose
//                 it without an owner vote.
//   §47-261e(c) — emergency special assessment: a two-thirds board vote + a
//                 written emergency attestation makes it effective immediately,
//                 without owner ratification.
//   §47-261e(d)/(e) — loan-security owner-approval mechanics: OUT OF SCOPE here
//                 (smaller follow-on per the dispatch).
export const budgetRatificationTypeEnum = pgEnum("budget_ratification_type", [
  "annual-budget", // §47-261e(a)
  "special-assessment", // §47-261e(b)
  "emergency-assessment", // §47-261e(c)
]);
export const budgetRatificationStatusEnum = pgEnum("budget_ratification_status", [
  "summary-pending", // adopted; 30-day owner summary not yet distributed
  "summary-distributed", // summary sent; ratification meeting scheduled
  "voting-open", // ratification meeting / window open
  "ratified", // window closed; majority did NOT reject → effective
  "rejected", // majority of all owners rejected → reverted to last-ratified
  "imposed-no-vote", // §(b) special assessment below threshold → imposed, no vote
  "emergency-imposed", // §(c) two-thirds emergency attestation → imposed immediately
  "superseded",
]);

export const budgetRatifications = pgTable("budget_ratifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  budgetId: varchar("budget_id").references(() => budgets.id),
  budgetVersionId: varchar("budget_version_id").references(() => budgetVersions.id),
  // Reuse the elections/voting/quorum engine for the negative-option ballot.
  electionId: varchar("election_id").references(() => elections.id),
  ratificationType: budgetRatificationTypeEnum("ratification_type").notNull().default("annual-budget"),
  statuteCitation: text("statute_citation").notNull().default("CGS §47-261e"),
  // §47-261e(a) — summary distribution + ratification window
  adoptedAt: timestamp("adopted_at").notNull(),
  summaryDueBy: timestamp("summary_due_by").notNull(), // adoptedAt + 30 days
  summarySentAt: timestamp("summary_sent_at"),
  reserveStatementIncluded: integer("reserve_statement_included").notNull().default(0), // §47-261e(a)
  reserveStatement: text("reserve_statement"),
  meetingDate: timestamp("meeting_date"),
  votingWindowMinDate: timestamp("voting_window_min_date"), // summarySentAt + 10 days
  votingWindowMaxDate: timestamp("voting_window_max_date"), // summarySentAt + 60 days
  // Negative-option tally — budget ratified UNLESS a majority of all owners reject
  totalOwnerCount: integer("total_owner_count").notNull().default(0),
  rejectVoteCount: integer("reject_vote_count").notNull().default(0),
  rejectThresholdRule: text("reject_threshold_rule").notNull().default("majority-of-all"),
  rejectThresholdCount: integer("reject_threshold_count"),
  // §47-261e(b) — special-assessment threshold gate
  assessmentAmount: real("assessment_amount"),
  baselineAnnualBudget: real("baseline_annual_budget"),
  specialAssessmentThresholdPct: real("special_assessment_threshold_pct").notNull().default(15),
  requiresOwnerRatification: integer("requires_owner_ratification").notNull().default(1),
  // §47-261e(c) — emergency attestation
  boardSeatCount: integer("board_seat_count"),
  boardVotesInFavor: integer("board_votes_in_favor"),
  emergencyAttestation: text("emergency_attestation"),
  emergencyAttestedBy: text("emergency_attested_by"),
  emergencyAttestedAt: timestamp("emergency_attested_at"),
  // Outcome
  status: budgetRatificationStatusEnum("status").notNull().default("summary-pending"),
  outcome: text("outcome"), // 'ratified' | 'rejected' | 'imposed-no-vote' | 'emergency-imposed'
  revertedToBudgetVersionId: varchar("reverted_to_budget_version_id").references(() => budgetVersions.id),
  resolvedAt: timestamp("resolved_at"),
  notes: text("notes"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export const insertBudgetRatificationSchema = createInsertSchema(budgetRatifications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
});
export type BudgetRatification = typeof budgetRatifications.$inferSelect;
export type InsertBudgetRatification = z.infer<typeof insertBudgetRatificationSchema>;

// §47-261e(a) — per-owner log of the 30-day budget-summary distribution.
export const budgetRatificationSummarySends = pgTable("budget_ratification_summary_sends", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ratificationId: varchar("ratification_id").notNull().references(() => budgetRatifications.id),
  recipientPersonId: varchar("recipient_person_id").references(() => persons.id),
  recipientEmail: text("recipient_email").notNull(),
  noticeSendId: varchar("notice_send_id").references(() => noticeSends.id),
  subjectRendered: text("subject_rendered"),
  bodyRendered: text("body_rendered"),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
}, (table) => ({
  uniqueRecipientPerRatification: uniqueIndex("budget_ratification_summary_sends_ratification_email_uq").on(table.ratificationId, table.recipientEmail),
}));
export const insertBudgetRatificationSummarySendSchema = createInsertSchema(budgetRatificationSummarySends).omit({ id: true, sentAt: true });
export type BudgetRatificationSummarySend = typeof budgetRatificationSummarySends.$inferSelect;
export type InsertBudgetRatificationSummarySend = z.infer<typeof insertBudgetRatificationSummarySendSchema>;

// ─────────────────────────────────────────────────────────────────────────────

// Portal login OTP tokens for verifiable authentication
// associationId is nullable — OTP is now issued per-email across all associations
export const portalLoginTokens = pgTable("portal_login_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").references(() => associations.id),
  email: text("email").notNull(),
  otpHash: text("otp_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  attempts: integer("attempts").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type PortalLoginToken = typeof portalLoginTokens.$inferSelect;

// ─────────────────────────────────────────────────────────────────────────────
// Vendor Portal — invitation-based auth scoped to a vendor record

export const vendorPortalInvitationStatusEnum = pgEnum("vendor_portal_invitation_status", ["pending", "accepted", "revoked", "expired"]);

export const vendorPortalCredentials = pgTable("vendor_portal_credentials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vendorId: varchar("vendor_id").notNull().references(() => vendors.id),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  email: text("email").notNull(),
  status: vendorPortalInvitationStatusEnum("status").notNull().default("pending"),
  invitedBy: text("invited_by"),
  invitedAt: timestamp("invited_at").defaultNow().notNull(),
  acceptedAt: timestamp("accepted_at"),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueVendorEmail: uniqueIndex("vendor_portal_credentials_vendor_email_uq").on(table.vendorId, table.email),
}));

export const insertVendorPortalCredentialSchema = createInsertSchema(vendorPortalCredentials).omit({ id: true, createdAt: true, updatedAt: true, invitedAt: true, acceptedAt: true, lastLoginAt: true });
export type VendorPortalCredential = typeof vendorPortalCredentials.$inferSelect;
export type InsertVendorPortalCredential = z.infer<typeof insertVendorPortalCredentialSchema>;

export const vendorPortalLoginTokens = pgTable("vendor_portal_login_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vendorId: varchar("vendor_id").notNull().references(() => vendors.id),
  email: text("email").notNull(),
  otpHash: text("otp_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  attempts: integer("attempts").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type VendorPortalLoginToken = typeof vendorPortalLoginTokens.$inferSelect;

// Vendor work order activity log — tracks all vendor actions for the audit trail
export const vendorWorkOrderActivityTypeEnum = pgEnum("vendor_work_order_activity_type", ["status_change", "note_added", "photo_uploaded", "invoice_uploaded", "estimated_completion_set"]);

export const vendorWorkOrderActivity = pgTable("vendor_work_order_activity", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workOrderId: varchar("work_order_id").notNull().references(() => workOrders.id),
  vendorId: varchar("vendor_id").notNull().references(() => vendors.id),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  activityType: vendorWorkOrderActivityTypeEnum("activity_type").notNull(),
  note: text("note"),
  previousStatus: text("previous_status"),
  newStatus: text("new_status"),
  fileUrl: text("file_url"),
  fileType: text("file_type"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type VendorWorkOrderActivity = typeof vendorWorkOrderActivity.$inferSelect;

// ── Platform Secrets ─────────────────────────────────────────────────────────
// Stores runtime-configurable credentials (Twilio, VAPID, etc.) in the DB.
// Values are stored encrypted at rest. Env vars always take precedence.
export const platformSecrets = pgTable("platform_secrets", {
  key: varchar("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: text("updated_by"),
});
export type PlatformSecret = typeof platformSecrets.$inferSelect;

// ── Platform Settings ────────────────────────────────────────────────────────
// Runtime-tunable non-secret platform configuration. Distinct from
// `platform_secrets` (encrypted credentials) — these are admin-editable
// knobs like the Stripe Connect application-fee rate.
// Per Issue founder-os#969 (spec §1.2 — application fee rate stored in
// `platform_settings` so future rate changes don't require a deploy).
export const platformSettings = pgTable("platform_settings", {
  key: varchar("key").primaryKey(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: text("updated_by"),
});
export type PlatformSetting = typeof platformSettings.$inferSelect;
export type InsertPlatformSetting = typeof platformSettings.$inferInsert;

// ── Platform Subscription Billing ────────────────────────────────────────────

export const platformSubscriptionStatusEnum = pgEnum("platform_subscription_status", [
  "trialing", "active", "past_due", "canceled", "unpaid", "incomplete",
]);

// PRICING STALE — "enterprise" enum value will need migration when
// PM tier naming is finalized. See docs/strategy/pricing-and-positioning.md
export const platformPlanEnum = pgEnum("platform_plan", [
  "self-managed", "property-manager", "enterprise",
]);

export const platformSubscriptions = pgTable("platform_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  plan: platformPlanEnum("plan").notNull(),
  status: platformSubscriptionStatusEnum("status").notNull().default("trialing"),
  stripeCustomerId: text("stripe_customer_id").notNull(),
  stripeSubscriptionId: text("stripe_subscription_id"),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  trialEndsAt: timestamp("trial_ends_at"),
  cancelAtPeriodEnd: integer("cancel_at_period_end").notNull().default(0),
  unitTier: integer("unit_tier"),
  unitCount: integer("unit_count"),
  adminEmail: text("admin_email").notNull(),
  // Stripe metered-usage reporting ledger (migration 0048). For metered tiers
  // (per-unit self-managed Mid/Large, per-door PM) the reconcile reports the
  // current unit/door count to the Stripe Billing Meter once per billing period.
  // These columns are the local idempotency anchor: a subscription whose
  // lastUsageReportedPeriodEnd matches the live current_period_end is already
  // reported for this period → the reconcile skips it (never double-reports to a
  // SUM meter). NULL on flat tiers (never metered) and on never-yet-reported rows.
  lastUsageReportedValue: integer("last_usage_reported_value"),
  lastUsageReportedPeriodEnd: timestamp("last_usage_reported_period_end"),
  lastUsageReportedAt: timestamp("last_usage_reported_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueAssociation: uniqueIndex("platform_subscriptions_association_uq").on(table.associationId),
}));

export type PlatformSubscription = typeof platformSubscriptions.$inferSelect;
export type InsertPlatformSubscription = typeof platformSubscriptions.$inferInsert;
export const insertPlatformSubscriptionSchema = createInsertSchema(platformSubscriptions);

export const platformWebhookEvents = pgTable("platform_webhook_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  provider: text("provider").notNull().default("stripe"),
  providerEventId: text("provider_event_id").notNull(),
  eventType: text("event_type").notNull(),
  status: text("status").notNull().default("received"),
  rawPayloadJson: text("raw_payload_json"),
  errorMessage: text("error_message"),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueProviderEvent: uniqueIndex("platform_webhook_events_provider_event_uq").on(table.provider, table.providerEventId),
}));

export type PlatformWebhookEvent = typeof platformWebhookEvents.$inferSelect;

// ═══════════════════════════════════════════════════════════════════════════════
// Community Hub — Association microsite & infrastructure map
// ═══════════════════════════════════════════════════════════════════════════════

// ── Hub visibility levels — dual-vocab parity window (1.5 HV-1) ──────────────
// Old vocab (role-coupled): public | resident | owner | board | admin.
// New vocab (role-agnostic, per 2.1 Q11): public | residents | unit-owners |
//   board-only | operator-only. Both legal during HV-1 (additive) and HV-2
//   (backfill + dual-read). HV-3 drops the old values via enum recreate.
// Vocabulary (post-HV-3, Wave 36):
//   public | residents | unit-owners | board-only | operator-only
// `public` is preserved verbatim (public-API safe — see
// `routes.ts:/api/hub/:identifier/public`). Old vocab
// (`resident|owner|board|admin`) was dropped via the
// `0018_hub_visibility_rename_drop_old.sql` recreate-and-recast migration.
// Helper: shared/hub-visibility.ts.
export const hubVisibilityLevelEnum = pgEnum("hub_visibility_level",
  ["public", "residents", "unit-owners", "board-only", "operator-only"]);
export const hubInfoBlockCategoryEnum = pgEnum("hub_info_block_category", ["trash", "parking", "emergency", "maintenance", "rules", "amenities", "custom"]);
export const hubActionRouteTypeEnum = pgEnum("hub_action_route_type", ["internal", "external"]);
export const hubMapNodeTypeEnum = pgEnum("hub_map_node_type", ["building", "unit", "common-area", "parking", "amenity", "path", "infrastructure"]);
export const hubMapIssueCategoryEnum = pgEnum("hub_map_issue_category", ["maintenance", "repair", "safety", "landscaping", "suggestion", "inspection", "other"]);
export const hubMapIssueStatusEnum = pgEnum("hub_map_issue_status", ["reported", "under-review", "approved", "in-progress", "resolved", "dismissed"]);
export const hubNoticeCategoryEnum = pgEnum("hub_notice_category", ["general", "maintenance", "governance", "safety", "seasonal", "meeting", "financial"]);

// Hub page configuration — one per association
export const hubPageConfigs = pgTable("hub_page_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  isEnabled: integer("is_enabled").notNull().default(0),
  logoUrl: text("logo_url"),
  bannerImageUrl: text("banner_image_url"),
  communityDescription: text("community_description"),
  sectionOrder: jsonb("section_order").notNull().default(sql`'["notices","quick-actions","info-blocks","map","contacts"]'::jsonb`),
  enabledSections: jsonb("enabled_sections").notNull().default(sql`'["notices","quick-actions","info-blocks","contacts"]'::jsonb`),
  themeColor: text("theme_color"),
  slug: text("slug"),
  welcomeModeEnabled: integer("welcome_mode_enabled").notNull().default(0),
  welcomeHeadline: text("welcome_headline"),
  welcomeHighlights: jsonb("welcome_highlights"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueAssociation: uniqueIndex("hub_page_configs_association_uq").on(table.associationId),
  uniqueSlug: uniqueIndex("hub_page_configs_slug_uq").on(table.slug),
}));
export type HubPageConfig = typeof hubPageConfigs.$inferSelect;
export type InsertHubPageConfig = typeof hubPageConfigs.$inferInsert;
export const insertHubPageConfigSchema = createInsertSchema(hubPageConfigs);

// Hub action links — quick action buttons on the hub (max 8 per association)
export const hubActionLinks = pgTable("hub_action_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  label: text("label").notNull(),
  iconKey: text("icon_key"),
  routeType: hubActionRouteTypeEnum("route_type").notNull().default("internal"),
  routeTarget: text("route_target").notNull(),
  orderIndex: integer("order_index").notNull().default(0),
  isEnabled: integer("is_enabled").notNull().default(1),
  autoDerived: integer("auto_derived").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type HubActionLink = typeof hubActionLinks.$inferSelect;
export type InsertHubActionLink = typeof hubActionLinks.$inferInsert;
export const insertHubActionLinkSchema = createInsertSchema(hubActionLinks);

// Hub info blocks — community information cards
export const hubInfoBlocks = pgTable("hub_info_blocks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  category: hubInfoBlockCategoryEnum("category").notNull().default("custom"),
  title: text("title").notNull(),
  body: text("body"),
  externalLinks: jsonb("external_links").notNull().default(sql`'[]'::jsonb`),
  orderIndex: integer("order_index").notNull().default(0),
  isEnabled: integer("is_enabled").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type HubInfoBlock = typeof hubInfoBlocks.$inferSelect;
export type InsertHubInfoBlock = typeof hubInfoBlocks.$inferInsert;
export const insertHubInfoBlockSchema = createInsertSchema(hubInfoBlocks);

// Hub map layers — site plan images for the infrastructure map
export const hubMapLayers = pgTable("hub_map_layers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  name: text("name").notNull(),
  baseImageUrl: text("base_image_url").notNull(),
  coordinateSystem: jsonb("coordinate_system"),
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type HubMapLayer = typeof hubMapLayers.$inferSelect;
export type InsertHubMapLayer = typeof hubMapLayers.$inferInsert;
export const insertHubMapLayerSchema = createInsertSchema(hubMapLayers);

// Hub map nodes — buildings, areas, amenities placed on a map layer
export const hubMapNodes = pgTable("hub_map_nodes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  layerId: varchar("layer_id").notNull().references(() => hubMapLayers.id),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  nodeType: hubMapNodeTypeEnum("node_type").notNull(),
  label: text("label").notNull(),
  linkedBuildingId: varchar("linked_building_id").references(() => buildings.id),
  linkedUnitId: varchar("linked_unit_id").references(() => units.id),
  geometry: jsonb("geometry").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type HubMapNode = typeof hubMapNodes.$inferSelect;
export type InsertHubMapNode = typeof hubMapNodes.$inferInsert;
export const insertHubMapNodeSchema = createInsertSchema(hubMapNodes);

// Hub map issues — location-based issue reports on the infrastructure map
export const hubMapIssues = pgTable("hub_map_issues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  mapNodeId: varchar("map_node_id").references(() => hubMapNodes.id),
  layerId: varchar("layer_id").notNull().references(() => hubMapLayers.id),
  reportedByPortalAccessId: varchar("reported_by_portal_access_id").references(() => portalAccess.id),
  title: text("title").notNull(),
  description: text("description"),
  category: hubMapIssueCategoryEnum("category").notNull().default("maintenance"),
  images: jsonb("images").notNull().default(sql`'[]'::jsonb`),
  coordinates: jsonb("coordinates"),
  status: hubMapIssueStatusEnum("status").notNull().default("reported"),
  visibilityLevel: hubVisibilityLevelEnum("visibility_level").notNull().default("board-only"),
  priority: roadmapPriorityEnum("priority").notNull().default("medium"),
  linkedTicketId: varchar("linked_ticket_id"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type HubMapIssue = typeof hubMapIssues.$inferSelect;
export type InsertHubMapIssue = typeof hubMapIssues.$inferInsert;
// Post-HV-3 (Wave 36): the `visibility_level` column on hub_map_issues is
// enum-bound to the new vocabulary only (5 values). See shared/hub-visibility.ts.
export const insertHubMapIssueSchema = createInsertSchema(hubMapIssues).extend({
  visibilityLevel: z.enum(HUB_VISIBILITY_ALL_VALUES).optional(),
});

// ── Amenity Booking System ────────────────────────────────────────────────────

export const amenities = pgTable("amenities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("general"),
  capacity: integer("capacity"),
  bookingWindowDays: integer("booking_window_days").notNull().default(30),
  minDurationMinutes: integer("min_duration_minutes").notNull().default(30),
  maxDurationMinutes: integer("max_duration_minutes").notNull().default(240),
  requiresApproval: integer("requires_approval").notNull().default(0),
  isActive: integer("is_active").notNull().default(1),
  // ── Amenity money loop (YCM Financial Core — Phase 3, migration 0042) ────────
  // ADDITIVE / forward-only. These govern what a booking CAN charge. They default
  // to 0 so every existing amenity stays free — no live behaviour changes. The
  // money is INTEGER CENTS (never a float) so GL postings stay exact.
  /** Usage fee charged when this amenity is booked (income). 0 == free. */
  usageFeeCents: integer("usage_fee_cents").notNull().default(0),
  /** Refundable deposit held on booking (a liability until refunded/forfeited). */
  depositCents: integer("deposit_cents").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type Amenity = typeof amenities.$inferSelect;
export type InsertAmenity = typeof amenities.$inferInsert;
export const insertAmenitySchema = createInsertSchema(amenities);

export const amenityReservationStatusEnum = pgEnum("amenity_reservation_status", ["pending", "approved", "rejected", "cancelled"]);

export const amenityReservations = pgTable("amenity_reservations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  amenityId: varchar("amenity_id").notNull().references(() => amenities.id),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  personId: varchar("person_id").notNull().references(() => persons.id),
  startAt: timestamp("start_at").notNull(),
  endAt: timestamp("end_at").notNull(),
  status: amenityReservationStatusEnum("status").notNull().default("pending"),
  notes: text("notes"),
  // Wave 49 (gap-audit follow-up): identifier of the admin user who approved
  // the reservation. Stores `admin_users.id`. Originally this column was
  // declared as a foreign key to `persons.id`, which made it impossible to
  // write the approving admin (admins are not persons). The FK was dropped
  // in migration 0021 and the column is now a free-form varchar. Always
  // written by the admin PATCH handler when status flips to "approved" so
  // the reservation has a complete audit trail.
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  // ── Amenity money loop (YCM Financial Core — Phase 3, migration 0042) ────────
  // ADDITIVE / forward-only. These snapshot the money STATE of this reservation
  // — the fee charged, the deposit held, and how the deposit was resolved. They
  // are the source facts the GL posting service reads to DERIVE balanced journal
  // entries; the GL is parallel + flag-gated and never source-of-truth here.
  // INTEGER CENTS throughout. Defaults keep every existing reservation a no-op.
  /** Usage fee billed for this booking, in cents (snapshot of amenity fee). */
  feeChargedCents: integer("fee_charged_cents").notNull().default(0),
  /** Refundable deposit held on this booking, in cents (a liability). */
  depositHeldCents: integer("deposit_held_cents").notNull().default(0),
  /** Portion of the held deposit refunded on checkout/return, in cents. */
  depositRefundedCents: integer("deposit_refunded_cents").notNull().default(0),
  /** Portion of the held deposit forfeited (kept as income), in cents. */
  depositForfeitedCents: integer("deposit_forfeited_cents").notNull().default(0),
  // A-STRIPE-003 (founder-os#10752, migration 0058): the deposit-hold
  // PaymentIntent id (pi_…) persisted at hold time. ADDITIVE / nullable —
  // legacy reservations stay null and fall back to Stripe Search. Refund/forfeit
  // look this up DIRECTLY (strongly consistent) instead of the eventually-
  // consistent Search API, so a resolution issued right after the hold resolves.
  depositHoldIntentId: varchar("deposit_hold_intent_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type AmenityReservation = typeof amenityReservations.$inferSelect;
export type InsertAmenityReservation = typeof amenityReservations.$inferInsert;
export const insertAmenityReservationSchema = createInsertSchema(amenityReservations);

export const amenityBlocks = pgTable("amenity_blocks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  amenityId: varchar("amenity_id").notNull().references(() => amenities.id),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  startAt: timestamp("start_at").notNull(),
  endAt: timestamp("end_at").notNull(),
  reason: text("reason"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type AmenityBlock = typeof amenityBlocks.$inferSelect;
export type InsertAmenityBlock = typeof amenityBlocks.$inferInsert;
export const insertAmenityBlockSchema = createInsertSchema(amenityBlocks);

// ── Billing Data Model (Phase 0) ─────────────────────────────────────────────

export const billingAccountTypeEnum = pgEnum("billing_account_type", [
  "self_managed", "property_manager",
]);

export const planCatalogStatusEnum = pgEnum("plan_catalog_status", [
  "draft", "active", "retired",
]);

export const pricingModelEnum = pgEnum("pricing_model", [
  "flat_per_association", "per_complex", "per_door", "enterprise_manual",
]);

export const planCatalog = pgTable("plan_catalog", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planKey: text("plan_key").notNull(),
  accountType: billingAccountTypeEnum("account_type").notNull(),
  displayName: text("display_name").notNull(),
  status: planCatalogStatusEnum("status").notNull().default("draft"),
  pricingModel: pricingModelEnum("pricing_model").notNull(),
  unitMin: integer("unit_min"),
  unitMax: integer("unit_max"),
  currency: text("currency").notNull().default("USD"),
  billingFrequencySupported: jsonb("billing_frequency_supported").$type<string[]>().notNull().default(sql`'["monthly"]'::jsonb`),
  monthlyAmountCents: integer("monthly_amount_cents"),
  annualEffectiveMonthlyCents: integer("annual_effective_monthly_cents"),
  annualBilledAmountCents: integer("annual_billed_amount_cents"),
  // Per-tier monthly minimum (cents). For per_door tiers this is the floor the
  // portfolio is billed when (totalDoors × monthlyAmountCents) falls below it.
  // NULL for plans with no minimum.
  minimumAmountCents: integer("minimum_amount_cents"),
  // LIVE Stripe ids for this tier (migration 0046). The public signup/subscribe
  // route resolves the Stripe price off the unit/door-resolved plan_catalog row,
  // so price IDs are never hardcoded in the frontend. stripePriceId is the
  // recurring price the subscription line item uses (flat OR metered/usage);
  // stripeProductId is the parent product (reference). NULL on manual/enterprise
  // tiers (billed by hand).
  stripePriceId: text("stripe_price_id"),
  stripeProductId: text("stripe_product_id"),
  recommendedInSignup: integer("recommended_in_signup").notNull().default(0),
  version: integer("version").notNull().default(1),
  effectiveFrom: timestamp("effective_from").notNull(),
  effectiveTo: timestamp("effective_to"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniquePlanKey: uniqueIndex("plan_catalog_plan_key_uq").on(table.planKey),
}));

export type PlanCatalog = typeof planCatalog.$inferSelect;
export type InsertPlanCatalog = typeof planCatalog.$inferInsert;
export const insertPlanCatalogSchema = createInsertSchema(planCatalog);

export const billingAccountStatusEnum = pgEnum("billing_account_status", [
  "draft", "trialing", "active", "past_due", "canceled",
]);

export const billingAccounts = pgTable("billing_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountType: billingAccountTypeEnum("account_type").notNull(),
  associationId: varchar("association_id").references(() => associations.id),
  billingStatus: billingAccountStatusEnum("billing_status").notNull().default("draft"),
  currency: text("currency").notNull().default("USD"),
  provider: text("provider"),
  providerCustomerId: text("provider_customer_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type BillingAccount = typeof billingAccounts.$inferSelect;
export type InsertBillingAccount = typeof billingAccounts.$inferInsert;
export const insertBillingAccountSchema = createInsertSchema(billingAccounts);

export const billingIntervalEnum = pgEnum("billing_interval", [
  "monthly", "annual",
]);

export const billingSubscriptionStatusEnum = pgEnum("billing_subscription_status", [
  "pending", "active", "past_due", "canceled",
]);

export const billingSubscriptions = pgTable("billing_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  billingAccountId: varchar("billing_account_id").notNull().references(() => billingAccounts.id),
  planCatalogId: varchar("plan_catalog_id").references(() => planCatalog.id),
  pricingVersion: integer("pricing_version").notNull().default(1),
  billingInterval: billingIntervalEnum("billing_interval").notNull().default("monthly"),
  priceSnapshotCents: integer("price_snapshot_cents"),
  priceSnapshotJson: jsonb("price_snapshot_json"),
  status: billingSubscriptionStatusEnum("status").notNull().default("pending"),
  startedAt: timestamp("started_at").notNull(),
  endedAt: timestamp("ended_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type BillingSubscription = typeof billingSubscriptions.$inferSelect;
export type InsertBillingSubscription = typeof billingSubscriptions.$inferInsert;
export const insertBillingSubscriptionSchema = createInsertSchema(billingSubscriptions);

export const billingSubscriptionItems = pgTable("billing_subscription_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  billingSubscriptionId: varchar("billing_subscription_id").notNull().references(() => billingSubscriptions.id),
  associationId: varchar("association_id").references(() => associations.id),
  planKey: text("plan_key").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitAmountCents: integer("unit_amount_cents"),
  lineTotalCents: integer("line_total_cents"),
  pricingSnapshotJson: jsonb("pricing_snapshot_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type BillingSubscriptionItem = typeof billingSubscriptionItems.$inferSelect;
export type InsertBillingSubscriptionItem = typeof billingSubscriptionItems.$inferInsert;
export const insertBillingSubscriptionItemSchema = createInsertSchema(billingSubscriptionItems);

export const signupPlanSelectionStatusEnum = pgEnum("signup_plan_selection_status", [
  "draft", "resolved", "converted", "abandoned",
]);

export const signupPlanSelections = pgTable("signup_plan_selections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  signupSessionId: varchar("signup_session_id").notNull(),
  accountType: billingAccountTypeEnum("account_type").notNull(),
  associationUnitCount: integer("association_unit_count"),
  pmComplexCount: integer("pm_complex_count"),
  pmComplexSnapshotJson: jsonb("pm_complex_snapshot_json"),
  resolvedPlanCatalogId: varchar("resolved_plan_catalog_id").references(() => planCatalog.id),
  resolvedPricingJson: jsonb("resolved_pricing_json"),
  billingInterval: billingIntervalEnum("billing_interval"),
  status: signupPlanSelectionStatusEnum("status").notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Phase 1A: Owner Payment Transactions ────────────────────────────────────

export const paymentTransactionStatusEnum = pgEnum("payment_transaction_status", [
  "draft", "initiated", "pending", "succeeded", "failed", "canceled", "reversed",
]);

export const paymentTransactionSourceEnum = pgEnum("payment_transaction_source", [
  "owner_initiated", "autopay",
]);

export const failureCategoryEnum = pgEnum("failure_category", ["soft", "hard", "unknown"]);

export const paymentTransactions = pgTable("payment_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  unitId: varchar("unit_id").notNull().references(() => units.id),
  personId: varchar("person_id").notNull().references(() => persons.id),
  billingAccountId: varchar("billing_account_id").references(() => billingAccounts.id),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("USD"),
  status: paymentTransactionStatusEnum("status").notNull().default("draft"),
  provider: paymentGatewayProviderEnum("provider").notNull().default("stripe"),
  providerPaymentId: text("provider_payment_id"),
  providerIntentId: text("provider_intent_id"),
  providerCustomerId: text("provider_customer_id"),
  description: text("description"),
  receiptReference: text("receipt_reference"),
  failureCode: text("failure_code"),
  failureReason: text("failure_reason"),
  submittedAt: timestamp("submitted_at"),
  confirmedAt: timestamp("confirmed_at"),
  failedAt: timestamp("failed_at"),
  metadataJson: jsonb("metadata_json"),
  source: paymentTransactionSourceEnum("source").notNull().default("owner_initiated"),
  paymentMethodId: varchar("payment_method_id").references(() => savedPaymentMethods.id),
  autopayEnrollmentId: varchar("autopay_enrollment_id").references(() => autopayEnrollments.id),
  isOffSession: integer("is_off_session").notNull().default(0),
  attemptNumber: integer("attempt_number").notNull().default(1),
  retryOfTransactionId: varchar("retry_of_transaction_id"),
  failureCategory: failureCategoryEnum("failure_category"),
  retryEligible: integer("retry_eligible").notNull().default(0),
  nextRetryAt: timestamp("next_retry_at"),
  /**
   * Set when a receipt email is successfully dispatched after
   * payment_intent.succeeded.  NULL means not yet sent.  Used as an
   * idempotency guard — Stripe can re-deliver webhooks; if this is
   * already set we skip re-sending (P0-2 / Issue #205).
   */
  receiptEmailSentAt: timestamp("receipt_email_sent_at"),
  /**
   * CT convenience-fee structure (founder-os wiki/research/chc-processing-fee-legality-2026-07-14.md
   * §6). `amountCents` above is the TOTAL actually charged via Stripe
   * (assessment + fee, when a fee applies) — unchanged meaning, so existing
   * reconciliation/receipt code that reads `amountCents` as "what Stripe
   * charged" keeps working byte-for-byte. `platformFeeCents` carves out the
   * portion of `amountCents` that is the platform processing fee (0 when no
   * fee applies — every existing row and every association with the fee flag
   * off gets 0 here, so nothing downstream changes for them). The
   * association's owner-ledger credit is computed as
   * `amountCents - platformFeeCents` (assessment at face value) — see
   * server/services/ledger-payment-identity.ts + storage.ts
   * processPaymentWebhookEvent. The fee itself books to `platform_processing_fees`,
   * never to `owner_ledger_entries`.
   */
  platformFeeCents: integer("platform_fee_cents").notNull().default(0),
  /** Which payment method the owner chose at checkout ('ach' | 'card'). Null for
   *  legacy/off-session rows created before this field existed. Display/receipt
   *  only — never drives money logic. */
  checkoutMethod: text("checkout_method"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueReceiptReference: uniqueIndex("payment_transactions_receipt_ref_uq").on(table.receiptReference),
}));

export type PaymentTransaction = typeof paymentTransactions.$inferSelect;
export type InsertPaymentTransaction = typeof paymentTransactions.$inferInsert;
export const insertPaymentTransactionSchema = createInsertSchema(paymentTransactions);

// ── CT convenience-fee structure (founder-os wiki/research/chc-processing-fee-legality-2026-07-14.md) ──
//
// Two additive tables, both DEFAULT-OFF / DEFAULT-EMPTY for every existing
// association — no behavior changes anywhere until an association's row in
// `association_fee_settings` explicitly sets `cardFeeEnabled = 1`.
//
// `association_fee_settings` — per-association configuration (one row per
// association, upserted). While `cardFeeEnabled` is 0/false (the default),
// `/api/portal/pay` behaves byte-identically to today (ACH-only, no fee),
// mirroring the existing `isMultiPartyConnectEnabled()` flag philosophy
// (server/services/multi-party-connect/flag.ts).
//
// `platform_processing_fees` — the platform-revenue record. This is
// STRUCTURALLY SEPARATE from `owner_ledger_entries`: the association's ledger
// never contains a fee row, and this table never contains an assessment row.
// The card fee is charged AND KEPT BY THE PLATFORM (YCM as an independent
// third-party processor) per the memo's §6 recommended structure — the
// association never sets, collects, or receives it.
//
// CORRECTED 2026-07-14 (William, voice — the original PR's assumption here
// was WRONG, verified live against production): Cherry Hill Court
// Condominiums has an ACTIVE Stripe Connect sub-merchant
// (payment_gateway_connections.provider_account_id = acct_1TnzDnArorHrelxs,
// status active, charges_enabled/payouts_enabled/details_submitted all
// true) — NOT a single shared platform Stripe account. YCM has its OWN
// separate platform Stripe account; Cherry Hill's dues charges route as a
// DIRECT CHARGE to Cherry Hill's own connected account via
// stripe-connect-resolver.ts's `resolveConnectChargeRouting`.
//
// So for a Connect-routed association, the fee does NOT land in the same
// balance as the assessment — Stripe's own `application_fee_amount`
// mechanism (already scaffolded for the platform's base application fee,
// see stripe-charge-metadata.ts computeApplicationFeeCents) is extended to
// carry the convenience/manual fee too, so Stripe itself transfers the fee
// to YCM's platform balance while the assessment settles to the
// association's own bank via their connected account. This is a REAL money
// split, not just bookkeeping — see server/routes/payment-portal.ts and
// `settlementMethod` below. `platform_processing_fees` remains the
// canonical RECORD of every fee (both settlement methods), and the
// association's ledger still never contains a fee row.
//
// The 'accounting_only' settlement method (this table's original design)
// remains correct for any association that is NOT Connect-onboarded (the
// legacy manual-key path, one Stripe account, no Connect) — there the fee
// and the assessment genuinely land in the same balance and this table is
// the ONLY separation. Check `settlementMethod` per row to know which
// applied.

export const associationFeeSettings = pgTable("association_fee_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  /** Master switch. 0 (default) = card-fee feature is fully inert; the owner
   *  checkout stays ACH-only, byte-identical to pre-existing behavior. */
  cardFeeEnabled: integer("card_fee_enabled").notNull().default(0),
  /** Percentage component of the card fee, in basis points (e.g. 290 = 2.90%,
   *  matching Stripe's real blended card rate per the memo §4/§6.3 — "keep it
   *  tied to actual cost rather than a round flat number"). */
  cardFeePercentBps: integer("card_fee_percent_bps").notNull().default(290),
  /** Fixed-cents component of the card fee (e.g. 30 = $0.30, Stripe's real
   *  per-transaction card fee). */
  cardFeeFixedCents: integer("card_fee_fixed_cents").notNull().default(30),
  /** ACH fee in cents. Default 0 (free) per the memo §6.4 — ACH's real Stripe
   *  cost (~0.8%, capped at $5) is cheap enough that absorbing it keeps ACH
   *  clearly the cheaper, encouraged rail. Kept configurable (not hardcoded)
   *  in case the association's attorney/board later approves the memo's
   *  small-flat-fee alternative ($1-2). */
  achFeeCents: integer("ach_fee_cents").notNull().default(0),
  /**
   * Manual cash/check processing fee (William, voice, 2026-07-14): when an
   * owner pays by cash or check, the TREASURER's manual handling work is a
   * real platform cost — William's policy is that fee IS charged, same
   * separation principle as the card fee (owed to the platform, never the
   * association). Master switch — 0 (default) = fully inert, the manual
   * payment-recording endpoint behaves byte-identically to before.
   */
  manualFeeEnabled: integer("manual_fee_enabled").notNull().default(0),
  /** Flat manual-processing fee in cents (no Stripe cost driver here, so a
   *  flat fee rather than percentage — default $5.00, configurable). */
  manualFeeCents: integer("manual_fee_cents").notNull().default(500),
  updatedBy: text("updated_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueAssociation: uniqueIndex("association_fee_settings_association_uq").on(table.associationId),
}));
export type AssociationFeeSettings = typeof associationFeeSettings.$inferSelect;
export type InsertAssociationFeeSettings = typeof associationFeeSettings.$inferInsert;
export const insertAssociationFeeSettingsSchema = createInsertSchema(associationFeeSettings).omit({ id: true, createdAt: true, updatedAt: true });

export const platformProcessingFeeTypeEnum = pgEnum("platform_processing_fee_type", ["card_processing", "ach", "manual_processing"]);

/**
 * "owed" — a fee recorded but not yet collected from the owner (the cash/check
 * case: the owner paid dues in cash, the manual-processing fee is a separate
 * receivable to be collected with their next payment or paid directly).
 * "collected" — the fee money has actually moved to the platform (the card
 * case: collected in the SAME Stripe charge as the dues, so booked already-collected).
 */
export const platformProcessingFeeStatusEnum = pgEnum("platform_processing_fee_status", ["owed", "collected"]);

export const platformProcessingFees = pgTable("platform_processing_fees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  paymentTransactionId: varchar("payment_transaction_id").references(() => paymentTransactions.id),
  unitId: varchar("unit_id").references(() => units.id),
  personId: varchar("person_id").references(() => persons.id),
  feeType: platformProcessingFeeTypeEnum("fee_type").notNull().default("card_processing"),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("USD"),
  status: platformProcessingFeeStatusEnum("status").notNull().default("collected"),
  collectedAt: timestamp("collected_at"),
  /**
   * How the money actually moved (added 2026-07-14 — the Stripe-topology
   * correction). Cherry Hill Court runs an ACTIVE Stripe Connect sub-merchant
   * (verified live in prod: payment_gateway_connections.provider_account_id =
   * acct_1TnzDnArorHrelxs, status active) — NOT the single-platform-account
   * model this table's original design doc assumed. So for a Connect-routed
   * charge, the REAL money split happens via Stripe's own
   * `application_fee_amount` (server/services/payment-service.ts
   * initiateStripeCheckout + server/routes/payment-portal.ts) — Stripe itself
   * transfers the fee to YCM's platform Stripe balance, and this row is the
   * canonical RECORD of that transfer, not the mechanism. 'accounting_only'
   * is the fallback for a non-Connect (manual-key) association, where there is
   * only one Stripe account and this row is the ONLY separation there is —
   * and for manual_processing fees, which never touch Stripe at all.
   */
  settlementMethod: text("settlement_method").notNull().default("accounting_only"),
  /**
   * THE canonical dedup key (replaces stripePaymentIntentId as the unique
   * target — see the partial unique index below). For a card-processing fee:
   * the Stripe payment_intent id (same value ledger-payment-identity.ts uses).
   * For a manual-processing fee: `manual:<ownerLedgerEntries.id>` — one manual
   * fee per manually-recorded cash/check ledger entry.
   */
  idempotencyKey: text("idempotency_key"),
  /** Retained for the card-processing path's direct Stripe cross-reference
   *  (reporting/audit convenience) — the identity check now runs on
   *  idempotencyKey above, which carries the SAME value for card fees. */
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueIdempotencyKey: uniqueIndex("platform_processing_fees_idempotency_key_uq")
    .on(table.idempotencyKey)
    .where(sql`${table.idempotencyKey} is not null`),
  associationIdx: index("platform_processing_fees_association_idx").on(table.associationId, table.createdAt),
  statusIdx: index("platform_processing_fees_status_idx").on(table.associationId, table.personId, table.status),
}));
export type PlatformProcessingFee = typeof platformProcessingFees.$inferSelect;
export type InsertPlatformProcessingFee = typeof platformProcessingFees.$inferInsert;
export const insertPlatformProcessingFeeSchema = createInsertSchema(platformProcessingFees).omit({ id: true, createdAt: true });

// ── Stripe Connect payout reconciliation (founder-os#970 / dispatch #3) ──────
// Canonical spec: wiki/products/ycm/stripe-connect-spec.md §4 (reconciliation
// flow) + §7.3. When a daily Stripe payout lands on a HOA's bank, the
// `payout.paid` webhook explodes the batch back into per-owner ledger entries
// so the HOA's books match the bank deposit exactly. These two tables persist
// the payout↔charge↔ledger linkage that powers the admin reconciliation report
// and the AR-aging reconciled/unreconciled filter. The core `owner_ledger_entries`
// table is intentionally untouched (reconciled-status is derived via join).

// One row per Stripe payout (the reconciliation "header"). `amountCents` is the
// NET amount that hits the HOA's bank; `grossAmountCents` is the sum of owner
// charge gross; `feeAmountCents` = Stripe processing + YCM application fees +
// refunds/adjustments. gross - fee == net (zero variance, spec §4.1).
export const stripePayoutStatusEnum = pgEnum("stripe_payout_status", [
  "pending",
  "in_transit",
  "paid",
  "failed",
  "canceled",
]);
export const stripePayouts = pgTable("stripe_payouts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  connectedAccountId: text("connected_account_id"), // acct_…
  payoutId: text("payout_id").notNull(), // po_…
  keyMode: text("key_mode"), // 'test' | 'live' (Gap D auditability)
  status: stripePayoutStatusEnum("status").notNull().default("paid"),
  amountCents: integer("amount_cents").notNull().default(0), // NET — hits the bank
  grossAmountCents: integer("gross_amount_cents").notNull().default(0), // sum of charge gross
  feeAmountCents: integer("fee_amount_cents").notNull().default(0), // stripe + app fees + adjustments
  currency: text("currency").notNull().default("usd"),
  chargeCount: integer("charge_count").notNull().default(0),
  arrivalDate: timestamp("arrival_date"),
  reconciledAt: timestamp("reconciled_at"),
  rawPayloadJson: jsonb("raw_payload_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniquePayoutPerAccount: uniqueIndex("stripe_payouts_account_payout_uq").on(table.connectedAccountId, table.payoutId),
  payoutAssociationIdx: index("stripe_payouts_association_idx").on(table.associationId, table.arrivalDate),
}));
export type StripePayout = typeof stripePayouts.$inferSelect;
export type InsertStripePayout = typeof stripePayouts.$inferInsert;

// One row per charge included in a payout. Links the charge to the owner ledger
// entry that records the payment, with the per-owner gross/fee/net breakdown the
// reconciliation report renders. `ownerLedgerEntryId` is nullable because a
// charge may be reconciled before its Gap-C ledger entry resolves (defensive),
// but in practice the charge.succeeded handler writes the ledger entry first.
export const stripePayoutItems = pgTable("stripe_payout_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  payoutReconId: varchar("payout_recon_id").notNull().references(() => stripePayouts.id),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  chargeId: text("charge_id").notNull(), // ch_… (balance-transaction source)
  paymentIntentId: text("payment_intent_id"),
  ownerLedgerEntryId: varchar("owner_ledger_entry_id").references(() => ownerLedgerEntries.id),
  ownerId: varchar("owner_id"),
  unitId: varchar("unit_id"),
  ownerName: text("owner_name"),
  unitLabel: text("unit_label"),
  chargeType: text("charge_type"),
  grossAmountCents: integer("gross_amount_cents").notNull().default(0),
  feeAmountCents: integer("fee_amount_cents").notNull().default(0),
  netAmountCents: integer("net_amount_cents").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueChargePerPayout: uniqueIndex("stripe_payout_items_payout_charge_uq").on(table.payoutReconId, table.chargeId),
  itemChargeIdx: index("stripe_payout_items_charge_idx").on(table.chargeId),
  itemLedgerIdx: index("stripe_payout_items_ledger_idx").on(table.ownerLedgerEntryId),
}));
export type StripePayoutItem = typeof stripePayoutItems.$inferSelect;
export type InsertStripePayoutItem = typeof stripePayoutItems.$inferInsert;

// ── Phase 3: Delinquency Settings & Notices ─────────────────────────────────

export const delinquencySettings = pgTable("delinquency_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").references(() => associations.id),
  gracePeriodDays: integer("grace_period_days").notNull().default(15),
  bucketBoundariesJson: jsonb("bucket_boundaries_json").notNull().default(sql`'[30,60,90]'::jsonb`),
  maxRetryAttempts: integer("max_retry_attempts").notNull().default(3),
  retryScheduleJson: jsonb("retry_schedule_json").notNull().default(sql`'[3,7,14]'::jsonb`),
  noticeStagesJson: jsonb("notice_stages_json"),
  autoLateFeeEnabled: integer("auto_late_fee_enabled").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type DelinquencySettings = typeof delinquencySettings.$inferSelect;
export type InsertDelinquencySettings = typeof delinquencySettings.$inferInsert;
export const insertDelinquencySettingsSchema = createInsertSchema(delinquencySettings);

export const delinquencyNoticeStageEnum = pgEnum("delinquency_notice_stage", [
  "payment_failed_notice", "delinquency_notice_1", "delinquency_notice_2", "final_notice",
]);

export const delinquencyNoticeStatusEnum = pgEnum("delinquency_notice_status", [
  "queued", "sent", "skipped", "failed",
]);

export const delinquencyNotices = pgTable("delinquency_notices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  personId: varchar("person_id").notNull().references(() => persons.id),
  unitId: varchar("unit_id").notNull().references(() => units.id),
  noticeStage: delinquencyNoticeStageEnum("notice_stage").notNull(),
  triggerDaysPastDue: integer("trigger_days_past_due").notNull(),
  amountOwedCents: integer("amount_owed_cents").notNull(),
  escalationId: varchar("escalation_id").references(() => delinquencyEscalations.id),
  noticeSendId: varchar("notice_send_id").references(() => noticeSends.id),
  status: delinquencyNoticeStatusEnum("status").notNull().default("queued"),
  delinquencyPeriodKey: text("delinquency_period_key").notNull(),
  payloadSnapshotJson: jsonb("payload_snapshot_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueNoticePerPeriod: uniqueIndex("delinquency_notices_dedup_uq").on(
    table.associationId, table.personId, table.unitId, table.noticeStage, table.delinquencyPeriodKey,
  ),
}));
export type DelinquencyNotice = typeof delinquencyNotices.$inferSelect;
export type InsertDelinquencyNotice = typeof delinquencyNotices.$inferInsert;
export const insertDelinquencyNoticeSchema = createInsertSchema(delinquencyNotices);

// ---------------------------------------------------------------------------
// 4.1 Wave 2 — Cross-association alert engine — read-state table
// ---------------------------------------------------------------------------
//
// Per `docs/projects/platform-overhaul/decisions/4.1-cross-association-alert-engine.md`
// Q7 "Selected Resolution" — global read-state keyed on a deterministic
// `alertId` string (format: `${ruleType}:${recordType}:${recordId}`) and the
// admin user who read / dismissed the alert. Same underlying record yields
// the same alertId across all three surfaces (Home panel, hub widget,
// central inbox), so interacting with it in any surface clears it everywhere.
//
// `alertId` is a free-form text identifier (NOT a FK) — the alert records
// themselves are computed on the fly by the server/alerts/ resolvers from the
// canonical source tables (work_orders / maintenance_schedule_instances /
// elections / owner_ledger_entries / documents). There is no
// alert_records table; read-state is the only persisted alert data.
//
// Wave 2 scope: table ships; no mutation endpoints yet — Wave 3 adds
// read / dismiss mutations once the Home panel UI is in place.

export const alertReadStates = pgTable("alert_read_states", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  alertId: text("alert_id").notNull(),
  adminUserId: varchar("admin_user_id").notNull().references(() => adminUsers.id),
  readAt: timestamp("read_at"),
  dismissedAt: timestamp("dismissed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueAlertAdmin: uniqueIndex("alert_read_states_alert_admin_uq").on(table.alertId, table.adminUserId),
}));
export type AlertReadState = typeof alertReadStates.$inferSelect;
export type InsertAlertReadState = typeof alertReadStates.$inferInsert;
export const insertAlertReadStateSchema = createInsertSchema(alertReadStates).omit({ id: true, createdAt: true });

// 4.1 Tier 3 (Wave 32) — alert push + email notifications.
//
// Spec: docs/projects/platform-overhaul/decisions/4.1-tier-3-notifications.md
//
// `alert_notifications` deduplicates out-of-band fan-out per
// (alertId, adminUserId, channel). One row per delivery attempt. Because
// `alertId` is deterministic (Wave 2 Q7), re-running the fan-out is
// idempotent.
//
// `delivery_status` discriminates the lifecycle:
//   - 'pending'                  : insert-then-send window (rare, transient)
//   - 'sent'                     : provider accepted
//   - 'failed'                   : provider rejected / threw — error_message
//                                  carries the reason
//   - 'suppressed-pre-existing'  : seeded on first-ever fan-out cycle for
//                                  alerts that existed before Wave 32 shipped,
//                                  so we don't retroactively notify users
//                                  about pre-Wave-32 critical alerts
//
// Channel mirrors `delivery_status` for the suppression case so the
// composite uniqueness key stays consistent.
//
// Index on (admin_user_id, sent_at) supports the 60-minute rolling
// rate-limit count (5/user/hour).
export const alertNotifications = pgTable("alert_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  alertId: text("alert_id").notNull(),
  adminUserId: varchar("admin_user_id").notNull().references(() => adminUsers.id),
  channel: text("channel").notNull(),
  deliveryStatus: text("delivery_status").notNull(),
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueAlertAdminChannel: uniqueIndex("alert_notifications_alert_admin_channel_uq").on(
    table.alertId,
    table.adminUserId,
    table.channel,
  ),
  adminSentAtIdx: index("alert_notifications_admin_sent_at_idx").on(table.adminUserId, table.sentAt),
}));
export type AlertNotification = typeof alertNotifications.$inferSelect;
export type InsertAlertNotification = typeof alertNotifications.$inferInsert;

// 4.1 Tier 3 (Wave 32) — operator-side push subscriptions (parallel to the
// portal-side `push_subscriptions` table which is keyed on portal_access_id).
// Operators (managers, board officers, platform admins) can enroll any
// number of devices/browsers. is_active is the soft-delete signal — set to
// 0 when the user disables push or when send fails with a 410 Gone.
export const adminPushSubscriptions = pgTable("admin_push_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminUserId: varchar("admin_user_id").notNull().references(() => adminUsers.id),
  endpoint: text("endpoint").notNull(),
  p256dhKey: text("p256dh_key").notNull(),
  authKey: text("auth_key").notNull(),
  userAgent: text("user_agent"),
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueAdminPushEndpoint: uniqueIndex("admin_push_subscriptions_endpoint_uq").on(table.endpoint),
}));
export type AdminPushSubscription = typeof adminPushSubscriptions.$inferSelect;
export type InsertAdminPushSubscription = typeof adminPushSubscriptions.$inferInsert;

// ── Bank Feed (Plaid integration) ────────────────────────────────────────────
//
// Three tables scoped per-association:
//   bank_connections   — one row per institution link (Plaid item)
//   bank_accounts      — one row per account under a connection
//   bank_transactions  — transaction feed; reconciles to payment_transactions
//
// All three tables carry associationId for tenant isolation.

export const bankConnectionStatusEnum = pgEnum("bank_connection_status", [
  "active",
  "needs_reauth",
  "revoked",
  "error",
]);

export const bankConnections = pgTable("bank_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  // NULL = admin/association-scope; set = portal-owner-scope (owner pay flow).
  portalAccessId: varchar("portal_access_id").references(() => portalAccess.id),
  provider: text("provider").notNull(), // 'plaid' for now; interface allows future providers
  providerItemId: text("provider_item_id").notNull(), // Plaid's item_id
  accessTokenEncrypted: text("access_token_encrypted").notNull(),
  institutionName: text("institution_name"),
  status: bankConnectionStatusEnum("status").notNull().default("active"),
  connectedByUserId: varchar("connected_by_user_id"),
  lastSyncedAt: timestamp("last_synced_at"),
  // Plaid /transactions/sync resumption cursor. NULL = no sync yet (the initial
  // sync omits the cursor). Persisted after each successful sync (P-3).
  transactionsCursor: text("transactions_cursor"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type BankConnection = typeof bankConnections.$inferSelect;
export type InsertBankConnection = typeof bankConnections.$inferInsert;

export const bankAccounts = pgTable("bank_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bankConnectionId: varchar("bank_connection_id")
    .notNull()
    .references(() => bankConnections.id),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  portalAccessId: varchar("portal_access_id").references(() => portalAccess.id),
  providerAccountId: text("provider_account_id").notNull(), // Plaid's account_id
  name: text("name").notNull(),
  mask: text("mask"), // last 4 digits of account number
  type: text("type").notNull(), // depository | credit | etc.
  subtype: text("subtype"), // checking | savings | etc.
  currentBalanceCents: integer("current_balance_cents"),
  availableBalanceCents: integer("available_balance_cents"),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type BankAccount = typeof bankAccounts.$inferSelect;
export type InsertBankAccount = typeof bankAccounts.$inferInsert;

export const bankTransactions = pgTable("bank_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bankAccountId: varchar("bank_account_id")
    .notNull()
    .references(() => bankAccounts.id),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  providerTransactionId: text("provider_transaction_id").notNull().unique(),
  amountCents: integer("amount_cents").notNull(),
  isoCurrencyCode: text("iso_currency_code").notNull().default("USD"),
  date: date("date").notNull(),
  name: text("name").notNull(),
  merchantName: text("merchant_name"),
  category: text("category"),
  pending: integer("pending").notNull().default(0),
  reconciledToPaymentTransactionId: varchar("reconciled_to_payment_transaction_id").references(
    () => paymentTransactions.id,
  ),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type BankTransaction = typeof bankTransactions.$inferSelect;
export type InsertBankTransaction = typeof bankTransactions.$inferInsert;

// ── bank_feed_sync_runs — per-run audit log for the automated bank-feed sync
// engine (founder-os#2478). Every tick of the automation sweep AND every
// webhook-triggered immediate sync writes one row here. Drives observability
// ("did the sync engine actually run?") + post-hoc reconciliation analysis.
//
// Trigger taxonomy:
//   - 'sweep'   = the 5-min automation sweep picked this connection up
//   - 'webhook' = Plaid SYNC_UPDATES_AVAILABLE webhook triggered immediate sync
//   - 'manual'  = admin clicked POST /api/plaid/sync (the existing button path)
//
// Each row captures connection + timing + counts + error. `error` is NULL on
// success; populated with a short message on failure (advisory-lock collision,
// Plaid 5xx, etc.). Successful runs always update bank_connections.last_synced_at.
export const bankFeedSyncRuns = pgTable("bank_feed_sync_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  connectionId: varchar("connection_id")
    .notNull()
    .references(() => bankConnections.id),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  trigger: text("trigger").notNull(), // 'sweep' | 'webhook' | 'manual'
  startedAt: timestamp("started_at").defaultNow().notNull(),
  finishedAt: timestamp("finished_at"),
  transactionsImported: integer("transactions_imported").notNull().default(0),
  matchesMade: integer("matches_made").notNull().default(0),
  unmatchedCount: integer("unmatched_count").notNull().default(0),
  error: text("error"),
}, (table) => ({
  byConnection: index("bank_feed_sync_runs_by_connection").on(table.connectionId, table.startedAt),
  byAssociation: index("bank_feed_sync_runs_by_association").on(table.associationId, table.startedAt),
}));

export type BankFeedSyncRun = typeof bankFeedSyncRuns.$inferSelect;
export type InsertBankFeedSyncRun = typeof bankFeedSyncRuns.$inferInsert;

// ── AI Assistant interactions (founder-os#1318, Phase 0) ─────────────────────
//
// Audit-log table for every resident-chat turn. Captures prompt + response
// + tool calls + token/cost telemetry so the cost-economics dashboard
// (founder-os#1261) can read against a real schema in Phase 1.
//
// Phase 0 (mock adapter) writes mock cost ($0) and rough token counts;
// the Phase 1 LLM adapter writes real values via the same row shape.
export const aiAssistantInteractions = pgTable("ai_assistant_interactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull(),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  personId: varchar("person_id").notNull().references(() => persons.id),
  turnIndex: integer("turn_index").notNull(),
  prompt: text("prompt").notNull(),
  response: text("response").notNull(),
  toolCalls: jsonb("tool_calls").notNull().default(sql`'[]'::jsonb`),
  tokensIn: integer("tokens_in").notNull().default(0),
  tokensOut: integer("tokens_out").notNull().default(0),
  latencyMs: integer("latency_ms").notNull().default(0),
  costEstimate: real("cost_estimate").notNull().default(0),
  model: text("model").notNull().default("mock-phase-0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  byConversation: index("ai_assistant_interactions_by_conversation").on(table.conversationId, table.turnIndex),
  byOwner: index("ai_assistant_interactions_by_owner").on(table.associationId, table.personId, table.createdAt),
}));

export type AiAssistantInteraction = typeof aiAssistantInteractions.$inferSelect;
export type InsertAiAssistantInteraction = typeof aiAssistantInteractions.$inferInsert;
export const insertAiAssistantInteractionSchema = createInsertSchema(aiAssistantInteractions);

// ── Document embeddings (founder-os#1256, Phase 1 RAG) ───────────────────────
//
// 1024-dim chunk store for owner-portal + admin RAG retrieval. The embedding
// column is `vector(1024)` in Postgres (pgvector); Drizzle doesn't ship a
// first-class type for that yet, so we declare it as `text` here and use raw
// SQL for the writes/reads. The runtime is unaffected — pgvector silently
// accepts the `'[0.1, 0.2, …]'` text literal form on INSERT.
export const documentEmbeddings = pgTable("document_embeddings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  documentId: varchar("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  // Held as text for Drizzle's sake — pgvector accepts the bracketed-array
  // literal form. Reads in retriever.ts use raw SQL.
  embedding: text("embedding"),
  metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
  model: text("model").notNull().default("voyage-3-lite"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueChunk: uniqueIndex("document_embeddings_document_chunk_uq").on(table.documentId, table.chunkIndex),
  byAssoc: index("document_embeddings_assoc_idx").on(table.associationId),
}));

export type DocumentEmbedding = typeof documentEmbeddings.$inferSelect;
export type InsertDocumentEmbedding = typeof documentEmbeddings.$inferInsert;

// ── Pressing items widget (founder-os#1256, Phase 1) ─────────────────────────
//
// Proactive surface — role-lensed feed of items requiring board attention.
// Populated by the pressing-items scanner (server/services/pressing-items/
// scanner.ts), refreshed every 15 min via the automation tick.
export const pressingItems = pgTable("pressing_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  itemClass: text("item_class").notNull(),
  severity: text("severity").notNull().default("medium"),
  title: text("title").notNull(),
  description: text("description"),
  // The original, unmodified bank-feed memo (ACH addenda dump, etc.) for
  // classes like `unidentified_txn` whose title is a HUMANIZED summary of
  // this raw text. Never shown as the title — surfaced in an expandable
  // "original bank memo" affordance for auditors/treasurers. Null for
  // classes with no underlying raw memo.
  rawDetail: text("raw_detail"),
  actorRole: text("actor_role").notNull().default("board"),
  relatedRecordType: text("related_record_type"),
  relatedRecordId: varchar("related_record_id"),
  dedupeKey: text("dedupe_key"),
  snoozedUntil: timestamp("snoozed_until"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueDedupe: uniqueIndex("pressing_items_assoc_dedupe_uq").on(table.associationId, table.dedupeKey),
  byAssocRole: index("pressing_items_assoc_role_idx").on(table.associationId, table.actorRole),
}));

export type PressingItem = typeof pressingItems.$inferSelect;
export type InsertPressingItem = typeof pressingItems.$inferInsert;
export const insertPressingItemSchema = createInsertSchema(pressingItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type PressingItemClass =
  | "unidentified_txn"
  | "delinquency_rising"
  | "document_attention"
  | "compliance_deadline";

export type PressingItemSeverity = "low" | "medium" | "high" | "critical";

export type PressingItemActorRole = "treasurer" | "secretary" | "president" | "board";

/** Per-role lens. `board` sees everything. */
export const PRESSING_ITEM_ROLE_LENS: Record<PressingItemActorRole, PressingItemClass[]> = {
  treasurer: ["unidentified_txn", "delinquency_rising"],
  secretary: ["document_attention", "compliance_deadline"],
  president: ["compliance_deadline", "delinquency_rising"],
  board: ["unidentified_txn", "delinquency_rising", "document_attention", "compliance_deadline"],
};

// ── bank_descriptor_aliases — descriptor→owner learning table ─────────────────
//
// When a treasurer manually matches a bank-tx descriptor to a specific owner,
// the normalized descriptor is stored here so future credits with the same
// descriptor auto-match without human intervention (founder-os#2480 tail /
// Gap 4 learning path). See migrations/0037_bank_descriptor_aliases.sql.
export const bankDescriptorAliases = pgTable("bank_descriptor_aliases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  /** Lowercased, punctuation → space, whitespace-collapsed, trimmed. */
  normalizedDescriptor: text("normalized_descriptor").notNull(),
  personId: varchar("person_id").notNull().references(() => persons.id),
  unitId: varchar("unit_id").notNull().references(() => units.id),
  /** Number of times this alias has been confirmed by a human match. */
  matchCount: integer("match_count").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type BankDescriptorAlias = typeof bankDescriptorAliases.$inferSelect;
export type InsertBankDescriptorAlias = typeof bankDescriptorAliases.$inferInsert;

// ── Fund-aware double-entry General Ledger (YCM Financial Core — Phase 1) ──────
//
// Audit anchor: audits/AUDIT-financial-reporting-orchestration.md Gap F1.
// Build anchor: audits/YCM-financial-build-plan-2026-06-20.md Phase 1.
//
// FORWARD-ONLY / PARALLEL (per BLINDSPOT F4): this GL runs ALONGSIDE the existing
// dues-only `owner_ledger_entries` subledger. The owner ledger STAYS the system
// of record. These tables are ADDITIVE — no existing row is touched, no live
// money path writes here automatically. GL postings are DERIVED from the owner
// ledger by `server/services/gl/posting.ts`, gated behind the `GL_ENABLED`
// feature flag (default OFF). The GL may NOT become source-of-truth until the
// reconcile-to-the-cent gate (script/verify-gl-reconcile.ts) passes — that flip
// is intentionally OUT of this phase's scope.
//
// Money is stored in INTEGER CENTS (debit/credit) — never floats — so the
// double-entry invariant (Σdebits == Σcredits) is exact and cannot float-drift.

/** GL account classification. `normalBalance` is derived from this. */
export const glAccountTypeEnum = pgEnum("gl_account_type", [
  "asset",
  "liability",
  "equity",
  "income",
  "expense",
]);

/** The fund dimension — operating vs. reserve segregation (CINC/CAMS-style). */
export const glFundEnum = pgEnum("gl_fund", ["operating", "reserve"]);

/** Side a posting lands on. Debit or credit. */
export const glSideEnum = pgEnum("gl_side", ["debit", "credit"]);

// gl_accounts — the chart of accounts. One row per account per association.
// `accountCode` is the human GL number (e.g. "4000" Assessment Income, "1010"
// Operating Cash, "1015" Interfund Receivable). `normalBalance` records whether
// the account increases on the debit (asset/expense) or credit (liability/
// equity/income) side — used to derive a signed balance from raw debit/credit.
export const glAccounts = pgTable(
  "gl_accounts",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    associationId: varchar("association_id").notNull().references(() => associations.id),
    accountCode: text("account_code").notNull(),
    name: text("name").notNull(),
    accountType: glAccountTypeEnum("account_type").notNull(),
    /** Fail-safe: a missing fund tag degrades to 'operating', never crashes. */
    fund: glFundEnum("fund").notNull().default("operating"),
    /** 'debit' for asset/expense, 'credit' for liability/equity/income. */
    normalBalance: glSideEnum("normal_balance").notNull(),
    isActive: integer("is_active").notNull().default(1),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    // One canonical account per (association, code, fund). Lets the same code
    // exist once per fund (e.g. "1010" Operating Cash vs Reserve Cash).
    uniqueCodePerAssocFund: uniqueIndex("gl_accounts_assoc_code_fund_uq").on(
      table.associationId,
      table.accountCode,
      table.fund,
    ),
    byAssoc: index("gl_accounts_assoc_idx").on(table.associationId),
  }),
);

// gl_entries — the journal. One row per debit-or-credit leg. A balanced
// transaction shares a `journalId` and its legs sum to zero (Σdebit==Σcredit).
//
// `sourceType` + `sourceId` link a leg back to its originating fact
// (owner_ledger_entry / vendor_invoice / bank_transaction / amenity_reservation),
// making GL posting IDEMPOTENT: re-posting the same source produces no
// duplicate legs (enforced by the unique index below).
export const glEntries = pgTable(
  "gl_entries",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    associationId: varchar("association_id").notNull().references(() => associations.id),
    /** All legs of one balanced transaction share this id. */
    journalId: varchar("journal_id").notNull(),
    glAccountId: varchar("gl_account_id").notNull().references(() => glAccounts.id),
    fund: glFundEnum("fund").notNull().default("operating"),
    side: glSideEnum("side").notNull(),
    /** Positive integer cents. The side (debit/credit) carries direction. */
    amountCents: integer("amount_cents").notNull(),
    postedAt: timestamp("posted_at").notNull(),
    description: text("description"),
    /** owner_ledger_entry | vendor_invoice | bank_transaction | amenity_reservation | opening_balance */
    sourceType: text("source_type"),
    sourceId: text("source_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    byAssoc: index("gl_entries_assoc_idx").on(table.associationId),
    byJournal: index("gl_entries_journal_idx").on(table.journalId),
    byAccount: index("gl_entries_account_idx").on(table.glAccountId),
    // Idempotency: a given (source, account, side) posts at most once. Re-running
    // the posting service is a safe no-op — it never double-posts a source fact.
    uniqueSourceLeg: uniqueIndex("gl_entries_source_leg_uq").on(
      table.sourceType,
      table.sourceId,
      table.glAccountId,
      table.side,
    ),
  }),
);

export const insertGlAccountSchema = createInsertSchema(glAccounts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertGlEntrySchema = createInsertSchema(glEntries).omit({ id: true, createdAt: true });

export type GlAccount = typeof glAccounts.$inferSelect;
export type InsertGlAccount = z.infer<typeof insertGlAccountSchema>;
export type GlEntry = typeof glEntries.$inferSelect;
export type InsertGlEntry = z.infer<typeof insertGlEntrySchema>;

export type GlAccountType = (typeof glAccountTypeEnum.enumValues)[number];
export type GlFund = (typeof glFundEnum.enumValues)[number];
export type GlSide = (typeof glSideEnum.enumValues)[number];

// ──────────────────────────────────────────────────────────────────────────────
// Financial statements — Phase 2 (DERIVED, forward-only, parallel, flag-gated).
//
// budget_line_gl_mappings — an OPTIONAL bridge letting a budget_line (planned
// spend) carry a tie to a GL account code + fund, so the DERIVED budget-vs-actual
// statement can join planned amounts to GL-derived actuals by (code, fund). The
// mapping is optional enrichment: budget-vs-actual falls back to category-name
// matching when a line is unmapped. ADDITIVE — touches no existing table/row.
//
// These statements are DERIVED and NOT source-of-truth. The owner ledger stays
// the system of record; the GL stays parallel (GL_ENABLED default OFF).
// ──────────────────────────────────────────────────────────────────────────────
export const budgetLineGlMappings = pgTable(
  "budget_line_gl_mappings",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    budgetLineId: varchar("budget_line_id").notNull().references(() => budgetLines.id),
    /** The GL account code the planned amount tracks against (e.g. "5100"). */
    glAccountCode: text("gl_account_code").notNull(),
    /** operating | reserve — reuses the GL fund enum for exact segregation. */
    fund: glFundEnum("fund").notNull().default("operating"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    // One mapping per budget line.
    uniqueLine: uniqueIndex("budget_line_gl_mappings_line_uq").on(table.budgetLineId),
    byCodeFund: index("budget_line_gl_mappings_code_fund_idx").on(table.glAccountCode, table.fund),
  }),
);

export const insertBudgetLineGlMappingSchema = createInsertSchema(budgetLineGlMappings).omit({ id: true, createdAt: true, updatedAt: true });
export type BudgetLineGlMapping = typeof budgetLineGlMappings.$inferSelect;
export type InsertBudgetLineGlMapping = z.infer<typeof insertBudgetLineGlMappingSchema>;

// ──────────────────────────────────────────────────────────────────────────────
// rate_limit_counters — the shared, multi-machine-correct backing store for the
// Postgres-backed rate limiter (see server/rate-limit.ts + docs/rate-limiting.md).
//
// WHY THIS TABLE: the in-memory limiter keeps an independent counter per Fly
// machine, so with `min_machines_running = 1` + auto-start (fly.toml already
// provisions 2 machines), an attacker load-balanced across machines gets Nx the
// intended quota on money-mutation + auth-brute-force surfaces. This table makes
// the counter shared across all machines using the EXISTING Postgres — no Redis,
// no new infra service.
//
// One row per (limiter key = tier:client-ip). A fixed-window counter: `count`
// increments within a window; when `windowStart` advances to a new window the
// row atomically resets to 1 (see the ON CONFLICT upsert in server/rate-limit.ts).
// ADDITIVE — touches no existing table/row. Fail-open: if this table is
// unavailable the limiter degrades to the per-machine in-memory limiter.
// ──────────────────────────────────────────────────────────────────────────────
export const rateLimitCounters = pgTable(
  "rate_limit_counters",
  {
    /** `${tier}:${clientIp}` — one bucket per tier per client. */
    key: text("key").primaryKey(),
    /** Start of the current fixed window (ms since epoch, floored to windowMs). */
    windowStart: timestamp("window_start").notNull(),
    /** Requests seen in the current window. */
    count: integer("count").notNull().default(0),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    // Sweep stale windows cheaply (DELETE WHERE window_start < cutoff).
    byWindow: index("rate_limit_counters_window_idx").on(table.windowStart),
  }),
);

export type RateLimitCounter = typeof rateLimitCounters.$inferSelect;
// Connecticut resale / "6(d)" certificate — CGS §47-270 (founder-os#8013)
// ──────────────────────────────────────────────────────────────────────────────
// A CT condo/HOA association MUST furnish a resale certificate within 10
// business days of a unit-owner's request, for a statutory fee of $185 (CPI-
// adjusted per §47-213; +$10 expedite for ≤3-business-day turnaround). A unit
// legally cannot close without it, and §47-270(c) caps the purchaser's liability
// at the amounts stated — so accuracy is financially binding on the association.
//
// `resaleCertificateRequests` = the intake/workflow row (who requested, when,
// the 10-business-day SLA clock, the fee, expedite flag, fulfillment status).
// `resaleCertificates` = the generated, immutable snapshot of the §47-270(a)
// disclosures plus the (b)/(c) statutory metadata, stored as JSON `payload`.
//
// State is parameterized (`state` defaults to "CT") so the template can later
// carry DE §81-409 etc. without a schema change — but ONLY CT is implemented.
export const resaleCertificateRequestStatusEnum = pgEnum("resale_certificate_request_status", [
  "requested",
  "in-progress",
  "fulfilled",
  "cancelled",
]);

export const resaleCertificateRequests = pgTable(
  "resale_certificate_requests",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    associationId: varchar("association_id").notNull().references(() => associations.id),
    unitId: varchar("unit_id").notNull().references(() => units.id),
    // The selling unit owner who made the request (§47-270(b)(1) — request in a
    // record "from a unit owner").
    personId: varchar("person_id").notNull().references(() => persons.id),
    state: text("state").notNull().default("CT"),
    requestedAt: timestamp("requested_at").notNull(),
    // §47-270(b)(1): furnish not later than 10 business days after receipt (3 if
    // expedited). Computed at request time + stored so the SLA clock is auditable.
    expedited: integer("expedited").notNull().default(0),
    dueAt: timestamp("due_at").notNull(),
    // Statutory fee in whole dollars at request time ($185, or $195 expedited).
    feeUsd: integer("fee_usd").notNull(),
    purchaserName: text("purchaser_name"),
    status: resaleCertificateRequestStatusEnum("status").notNull().default("requested"),
    fulfilledAt: timestamp("fulfilled_at"),
    certificateId: varchar("certificate_id"),
    notes: text("notes"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    byAssocStatus: index("resale_cert_requests_assoc_status_idx").on(table.associationId, table.status),
    byUnit: index("resale_cert_requests_unit_idx").on(table.unitId),
  }),
);

export const resaleCertificates = pgTable(
  "resale_certificates",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    associationId: varchar("association_id").notNull().references(() => associations.id),
    unitId: varchar("unit_id").notNull().references(() => units.id),
    requestId: varchar("request_id").references(() => resaleCertificateRequests.id),
    state: text("state").notNull().default("CT"),
    statuteCitation: text("statute_citation").notNull().default("CGS §47-270"),
    generatedAt: timestamp("generated_at").notNull(),
    // §47-270 validity window — the certificate speaks as of generatedAt; many
    // associations treat it as valid for a bounded period. Stored for the
    // attestation block.
    validUntil: timestamp("valid_until"),
    feeUsd: integer("fee_usd").notNull(),
    // Full structured §47-270(a)(1)-(15) + (b)/(c) snapshot. Immutable once written.
    payload: jsonb("payload").notNull(),
    // Board attestation (§47-270 the certificate is signed/attested by the board).
    attestedByName: text("attested_by_name"),
    attestedAt: timestamp("attested_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    byAssocUnit: index("resale_certs_assoc_unit_idx").on(table.associationId, table.unitId),
  }),
);

export const insertResaleCertificateRequestSchema = createInsertSchema(resaleCertificateRequests).omit({
  id: true,
  dueAt: true,
  feeUsd: true,
  status: true,
  fulfilledAt: true,
  certificateId: true,
  createdAt: true,
  updatedAt: true,
});
export type ResaleCertificateRequest = typeof resaleCertificateRequests.$inferSelect;
export type InsertResaleCertificateRequest = z.infer<typeof insertResaleCertificateRequestSchema>;

export const insertResaleCertificateSchema = createInsertSchema(resaleCertificates).omit({
  id: true,
  createdAt: true,
});
export type ResaleCertificate = typeof resaleCertificates.$inferSelect;
export type InsertResaleCertificate = z.infer<typeof insertResaleCertificateSchema>;
// Statutory assessment lien (CT CGS §47-258 / DE §81-316) — BUILD #8014
// ──────────────────────────────────────────────────────────────────────────────
//
// Connecticut General Statutes §47-258 gives a common-interest community an
// AUTOMATIC lien on a unit for unpaid common-expense assessments, with a 9-month
// SUPER-PRIORITY over a first mortgage. Delaware §81-316 carries the same 9-month
// super-priority — the super-priority calc is state-portable (see
// server/services/assessment-lien-service.ts → computeSuperPriority).
//
// This is a GREENFIELD lien primitive: it sits OVER the existing delinquency /
// escalation / notice engine (delinquencyEscalations, delinquencyNotices,
// noticeSends) and does NOT replace it. The lien is the statutory lifecycle
// object; the escalation/notice rows remain the operational collections feed.
//
// §47-258(a) — lien arises automatically on the unpaid assessment (arose-date).
// §47-258(b) — 9-month super-priority over first mortgage.
// §47-258(d) — no separate recording is required for the lien to be enforceable.
// §47-258(e) — a 3-year statute of limitations runs from the arose-date.
// §47-258(m) — a 2-month + board-vote/standard-policy + written-demand-with-
//              mortgagee-copy GATE precedes foreclosure, then a 60-day notice.
//
// ALL queries are association-scoped (associationId). ADDITIVE — touches no
// existing table/row. Actual foreclosure filing / legal action is OUT OF SCOPE.

export const assessmentLienStatusEnum = pgEnum("assessment_lien_status", [
  "active", "released", "expired",
]);

export const assessmentLiens = pgTable("assessment_liens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  unitId: varchar("unit_id").notNull().references(() => units.id),
  personId: varchar("person_id").references(() => persons.id),
  /** Optional tie back to the escalation that drove this lien (operational feed). */
  escalationId: varchar("escalation_id").references(() => delinquencyEscalations.id),
  /** Free-form reference (e.g. originating special-assessment id / ledger key). */
  sourceReference: text("source_reference"),
  /** §47-258(a): the date the lien arose = the date the assessment became due. */
  aroseDate: timestamp("arose_date").notNull(),
  /** Principal unpaid common-expense assessment the lien secures. */
  principalAmount: real("principal_amount").notNull(),
  /** Per-month common-expense charge — input to the §47-258(b) super-priority calc. */
  monthlyCommonExpense: real("monthly_common_expense").notNull().default(0),
  /** Statute the lien is asserted under — portable: "47-258" (CT) | "81-316" (DE). */
  statuteSection: text("statute_section").notNull().default("47-258"),
  status: assessmentLienStatusEnum("status").notNull().default("active"),
  /** §47-258(e): arose-date + 3 years. After this the lien is unenforceable. */
  expiresAt: timestamp("expires_at").notNull(),
  releasedAt: timestamp("released_at"),
  releaseReason: text("release_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  byAssociation: index("assessment_liens_association_idx").on(table.associationId),
  byUnit: index("assessment_liens_unit_idx").on(table.associationId, table.unitId),
}));
export const insertAssessmentLienSchema = createInsertSchema(assessmentLiens).omit({ id: true, createdAt: true, updatedAt: true });
export type AssessmentLien = typeof assessmentLiens.$inferSelect;
export type InsertAssessmentLien = z.infer<typeof insertAssessmentLienSchema>;

// §47-258(m) pre-foreclosure gate evaluation + 60-day notice record.
export const assessmentLienPreforeclosureResultEnum = pgEnum("assessment_lien_preforeclosure_result", [
  "allowed", "blocked",
]);

export const assessmentLienPreforeclosures = pgTable("assessment_lien_preforeclosures", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  lienId: varchar("lien_id").notNull().references(() => assessmentLiens.id),
  unitId: varchar("unit_id").notNull().references(() => units.id),
  personId: varchar("person_id").references(() => persons.id),
  /** §47-258(m)(1) gate inputs. */
  monthsOwed: integer("months_owed").notNull(),
  boardVoteOrPolicyAttested: integer("board_vote_or_policy_attested").notNull().default(0),
  writtenDemandSent: integer("written_demand_sent").notNull().default(0),
  mortgageeCopySent: integer("mortgagee_copy_sent").notNull().default(0),
  /** §47-258(m)(1) gate verdict + machine-readable block reasons. */
  gateResult: assessmentLienPreforeclosureResultEnum("gate_result").notNull(),
  gateBlockReasonsJson: jsonb("gate_block_reasons_json").notNull().default(sql`'[]'::jsonb`),
  /** §47-258(m)(2) 60-day notice. */
  noticeSendId: varchar("notice_send_id").references(() => noticeSends.id),
  mortgageeNoticeSendId: varchar("mortgagee_notice_send_id").references(() => noticeSends.id),
  noticeIssuedAt: timestamp("notice_issued_at"),
  noticeDeadlineAt: timestamp("notice_deadline_at"),
  noticeDays: integer("notice_days").notNull().default(60),
  totalDue: real("total_due"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  byLien: index("assessment_lien_preforeclosures_lien_idx").on(table.lienId),
  byAssociation: index("assessment_lien_preforeclosures_association_idx").on(table.associationId),
}));
export const insertAssessmentLienPreforeclosureSchema = createInsertSchema(assessmentLienPreforeclosures).omit({ id: true, createdAt: true });
export type AssessmentLienPreforeclosure = typeof assessmentLienPreforeclosures.$inferSelect;
export type InsertAssessmentLienPreforeclosure = z.infer<typeof insertAssessmentLienPreforeclosureSchema>;

// CT CGS §47-260 — Association records: statutory retention + owner
// records-request workflow + mandatory/permissive withholding.
// (founder-os#8017)
//
// Builds over the existing records substrate (documents / documentVersions /
// meetingNotes / voteRecords / ownerships) — these tables add the statutory
// retention metadata, the records-request lifecycle, and the per-record
// withholding classification §47-260(c)/(d) requires. The statutory LOGIC
// lives in pure functions in server/services/records-retention-service.ts.
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Canonical record-type keys used by the §47-260 retention engine and the
 * records-request workflow. Mirrors the §47-260(a) enumerated categories.
 * The retention period for each is computed by `retentionPeriodYears()` in
 * the service (§47-260(a)(5) = 3yr financials/tax; §47-260(a)(11) = 1yr
 * ballots/proxies/voting; everything else = permanent / no statutory expiry).
 */
export const recordTypeEnum = pgEnum("records_record_type", [
  "financial_statement", // §47-260(a)(5) — 3yr
  "tax_return",          // §47-260(a)(5) — 3yr
  "ballot",              // §47-260(a)(11) — 1yr
  "proxy",               // §47-260(a)(11) — 1yr
  "voting_record",       // §47-260(a)(11) — 1yr
  "receipts_expenditures", // §47-260(a)(1)
  "meeting_minutes",     // §47-260(a)(2)
  "owner_roster",        // §47-260(a)(3)
  "organizational_docs", // §47-260(a)(4)
  "contract",            // §47-260(a) general
  "other",
]);
export type RecordType = (typeof recordTypeEnum.enumValues)[number];

/** §47-260(c)/(d) — how a record is classified for owner disclosure. */
export const recordsWithholdingClassEnum = pgEnum("records_withholding_class", [
  "none",       // disclosable
  "mandatory",  // §47-260(c) — MUST be withheld (personnel/salary/medical, unredacted ballots/proxies)
  "permissive", // §47-260(d) — MAY be withheld (active negotiation, litigation/mediation, attorney-client, exec session)
]);
export type RecordsWithholdingClass = (typeof recordsWithholdingClassEnum.enumValues)[number];

/** §47-260(b) records-request lifecycle. */
export const recordsRequestStatusEnum = pgEnum("records_request_status", [
  "received",      // 30-day notice received from owner
  "dates_offered", // two exam dates offered within 5 business days (§47-260(b))
  "examined",      // owner inspected
  "fulfilled",     // copies provided / request closed satisfied
  "withheld",      // request fully withheld (§47-260(c)/(d))
  "closed",        // closed (withdrawn / superseded)
]);
export type RecordsRequestStatus = (typeof recordsRequestStatusEnum.enumValues)[number];

/**
 * §47-260(b) — an owner's records-inspection request and its lifecycle.
 * Multi-tenant: every row scoped by associationId.
 */
export const recordsRequests = pgTable("records_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  // The requesting unit owner. Nullable FK to ownerships so the request can be
  // attributed to an authorized agent who is not in the roster.
  ownershipId: varchar("ownership_id").references(() => ownerships.id),
  requesterName: text("requester_name").notNull(),
  requesterEmail: text("requester_email"),
  // §47-260(b) — "a record reasonably identifying the specific records requested".
  recordsRequested: text("records_requested").notNull(),
  // When the association received the 30-day notice. Drives the response-due clock.
  receivedAt: timestamp("received_at").notNull(),
  // §47-260(b) — association must offer two exam dates "not later than five
  // business days following the date of receiving such notice". Computed by
  // computeResponseDueDate(receivedAt) at create time.
  responseDueAt: timestamp("response_due_at").notNull(),
  examDate1: timestamp("exam_date_1"),
  examDate2: timestamp("exam_date_2"),
  status: recordsRequestStatusEnum("status").notNull().default("received"),
  // §47-260(e) — computed reasonable copy fee in cents (per-page + supervision).
  copyFeeCents: integer("copy_fee_cents"),
  pageCount: integer("page_count"),
  fulfilledAt: timestamp("fulfilled_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  byAssociation: index("records_requests_association_idx").on(table.associationId),
  byStatus: index("records_requests_status_idx").on(table.associationId, table.status),
}));

/**
 * A candidate record attached to a records-request, carrying its §47-260(c)/(d)
 * withholding classification. `included` is computed at response time by
 * filterDisclosableRecords(): mandatory → always excluded; permissive →
 * excluded only when withheld; none → included.
 */
export const recordsRequestItems = pgTable("records_request_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId: varchar("request_id").notNull().references(() => recordsRequests.id),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  recordType: recordTypeEnum("record_type").notNull(),
  // Optional link to the underlying document (existing records substrate).
  documentId: varchar("document_id").references(() => documents.id),
  label: text("label").notNull(),
  // §47-260(c)/(d) classification for THIS record in THIS request.
  withholdingClass: recordsWithholdingClassEnum("withholding_class").notNull().default("none"),
  withholdingReason: text("withholding_reason"),
  // 1 = disclosed to owner in the response; 0 = withheld. Computed at response time.
  included: integer("included").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  byRequest: index("records_request_items_request_idx").on(table.requestId),
}));

export const insertRecordsRequestSchema = createInsertSchema(recordsRequests).omit({ id: true, createdAt: true, updatedAt: true });
export const insertRecordsRequestItemSchema = createInsertSchema(recordsRequestItems).omit({ id: true, createdAt: true });
export type RecordsRequest = typeof recordsRequests.$inferSelect;
export type InsertRecordsRequest = z.infer<typeof insertRecordsRequestSchema>;
export type RecordsRequestItem = typeof recordsRequestItems.$inferSelect;
export type InsertRecordsRequestItem = z.infer<typeof insertRecordsRequestItemSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// YCM Chief-of-Staff agent queue + four-level permission ladder + audit log
// (founder-os#9474 / W1 foundation; ratified 2026-07-04; research #833 §5.1/§7.2/§9)
//
// The queue IS the chief-of-staff surface — every agent-proposed action routes
// through it. The permission LADDER is server-authoritative: the level is
// assigned from the action-TYPE (never trusted from the agent), and the gate
// refuses to execute an L3/L4 action without a recorded human approval.
//
//   L1 suggest            — always allowed; surfaces with no approval.
//   L2 reversible          — per-toggle default (association agent-autonomy toggle
//                            per action-type; queues for approval unless enabled).
//   L3 financial/irreversible — ALWAYS requires a recorded human approval.
//   L4 board/member-affecting — requires BOARD-level approval (board-officer role).
//
// Tenant-isolated per YCM convention: associationId derived from the session,
// never from the request body. Additive / net-new: touches no existing table.
// ─────────────────────────────────────────────────────────────────────────────

export const agentActionLevelEnum = pgEnum("agent_action_level", ["L1", "L2", "L3", "L4"]);
export const agentActionStatusEnum = pgEnum("agent_action_status", [
  "draft",     // being assembled by the agent
  "queued",    // on the queue, awaiting a human (L2-off / L3 / L4) or ready to execute (L1 / L2-on)
  "approved",  // a human recorded approval (L3/L4, or L2 when a toggle required it)
  "rejected",  // a human declined
  "executed",  // actuated — has an immutable audit-log entry
  "failed",    // execution attempted and errored
]);

// agent_actions — the chief-of-staff queue. One row per proposed/executed action.
export const agentActions = pgTable("agent_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  // action-TYPE is the key the ladder maps to a level (server-authoritative).
  actionType: text("action_type").notNull(),
  // level is assigned by the ladder from actionType; stored for audit + queue sort.
  level: agentActionLevelEnum("level").notNull(),
  status: agentActionStatusEnum("status").notNull().default("queued"),
  // Where the action lands + what it does.
  targetEntityType: text("target_entity_type"),
  targetEntityId: varchar("target_entity_id"),
  payload: jsonb("payload"),
  // Human-readable "why" — every queue item shows the agent's reasoning inline.
  reasoning: text("reasoning").notNull(),
  // Queue ranking. severity ∈ {low,medium,high,critical}; a statutory deadline
  // pins the item to the top of the stack (sorted by deadline asc).
  severity: text("severity").notNull().default("medium"),
  statutoryDeadline: timestamp("statutory_deadline"),
  // Provenance of the proposing agent (name/persona/run id — free-form).
  createdByAgent: text("created_by_agent").notNull(),
  // The human who decided. Null until an approve/reject is recorded.
  approvedByUserId: varchar("approved_by_user_id").references(() => adminUsers.id),
  approvedByEmail: text("approved_by_email"),
  approvedAt: timestamp("approved_at"),
  rejectedByUserId: varchar("rejected_by_user_id").references(() => adminUsers.id),
  rejectedByEmail: text("rejected_by_email"),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  executedAt: timestamp("executed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  // Queue read index: list an association's actions by status + recency.
  byAssocStatus: index("agent_actions_assoc_status_idx").on(table.associationId, table.status, table.createdAt),
  // Statutory-first ranking index.
  byAssocDeadline: index("agent_actions_assoc_deadline_idx").on(table.associationId, table.statutoryDeadline),
}));

// agent_action_audit_log — append-only, immutable. One row per lifecycle event
// (filed / approved / rejected / executed / failed). One click from the queue.
export const agentActionAuditLog = pgTable("agent_action_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  actionId: varchar("action_id").notNull().references(() => agentActions.id),
  // The lifecycle event this row records.
  event: text("event").notNull(), // filed | approved | rejected | executed | failed
  // Who caused it — an agent name (agent-authored) or an admin identity (human).
  actorType: text("actor_type").notNull(), // agent | human | system
  actorId: text("actor_id"),
  actorEmail: text("actor_email"),
  // Human-readable explanation of the event (the "why", carried forward).
  detail: text("detail"),
  // Immutable snapshot of the action state at the moment of the event.
  snapshot: jsonb("snapshot"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  byAction: index("agent_action_audit_action_idx").on(table.actionId, table.createdAt),
  byAssoc: index("agent_action_audit_assoc_idx").on(table.associationId, table.createdAt),
}));

// agent_action_toggles — per-association, per-action-type L2 autonomy toggle.
// When autoApprove=1, an L2 (reversible) action of that type executes without a
// human approval; default (absent / 0) → L2 queues for approval. L1 ignores it;
// L3/L4 always require approval regardless of any toggle.
export const agentActionToggles = pgTable("agent_action_toggles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  actionType: text("action_type").notNull(),
  autoApprove: integer("auto_approve").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqAssocType: uniqueIndex("agent_action_toggles_assoc_type_uq").on(table.associationId, table.actionType),
}));

export const insertAgentActionSchema = createInsertSchema(agentActions).omit({
  id: true,
  level: true,
  status: true,
  approvedByUserId: true,
  approvedByEmail: true,
  approvedAt: true,
  rejectedByUserId: true,
  rejectedByEmail: true,
  rejectedAt: true,
  rejectionReason: true,
  executedAt: true,
  createdAt: true,
  updatedAt: true,
});
export type AgentAction = typeof agentActions.$inferSelect;
export type InsertAgentAction = z.infer<typeof insertAgentActionSchema>;
export type AgentActionAuditEntry = typeof agentActionAuditLog.$inferSelect;
export type AgentActionToggle = typeof agentActionToggles.$inferSelect;
export type AgentActionLevel = (typeof agentActionLevelEnum.enumValues)[number];
export type AgentActionStatus = (typeof agentActionStatusEnum.enumValues)[number];

// ─────────────────────────────────────────────────────────────────────────────
// Statutory records production (founder-os#9483 — ratified 2026-07-04).
//
// The unifying ISSUANCE layer over the statutory-document generators. Owner /
// closing-agent requests a statutory document; we generate the right packet
// (resale certificate — CGS §47-270, reusing #8013's generator; estoppel — the
// closing account-status subset; records-request — a §47-260 response), PIN its
// statutory deadline into the shared chief-of-staff agent-action queue (so the
// countdown is always visible + surfaces a near-deadline reminder), and GATE
// issuance at L3 of the permission ladder — a recorded PM sign — via the same
// executeAction gate the whole platform uses. Issuance is structurally
// impossible without the L3 approval.
//
// Additive / net-new: one new table + two enums. References existing tables
// (associations, units, persons, agent_actions, records_requests, admin_users);
// touches no existing column or row. Tenant-isolated: association_id on the row,
// derived from the session, never from the request body.
// ─────────────────────────────────────────────────────────────────────────────

/** The kind of statutory document produced. */
export const statutoryRecordTypeEnum = pgEnum("statutory_record_type", [
  "resale_certificate", // CGS §47-270 — reuses #8013's generator
  "estoppel_certificate", // closing account-status subset (money owed + good standing)
  "records_request", // CGS §47-260 — owner records-inspection response
]);
export type StatutoryRecordType = (typeof statutoryRecordTypeEnum.enumValues)[number];

/** intake/generate → (signed) → issued lifecycle. */
export const statutoryRecordStatusEnum = pgEnum("statutory_record_status", [
  "generated", // packet built + persisted + queued; awaiting the L3 PM sign
  "signed", // the PM recorded the L3 approval; ready to issue
  "issued", // actuated THROUGH the L3 gate — final, immutable payload
  "rejected", // the PM declined
]);
export type StatutoryRecordStatus = (typeof statutoryRecordStatusEnum.enumValues)[number];

export const statutoryRecords = pgTable("statutory_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  recordType: statutoryRecordTypeEnum("record_type").notNull(),
  status: statutoryRecordStatusEnum("status").notNull().default("generated"),
  // Who the packet is for (a closing agent / owner). Free-form so it can be an
  // external requester who is not in the roster.
  requesterName: text("requester_name").notNull(),
  requesterEmail: text("requester_email"),
  // Optional unit / owner scope (resale cert + estoppel are unit-scoped; a
  // records-request may not be).
  unitId: varchar("unit_id").references(() => units.id),
  personId: varchar("person_id").references(() => persons.id),
  // When the request was received — drives the deadline clock.
  receivedAt: timestamp("received_at").notNull(),
  expedited: integer("expedited").notNull().default(0),
  // The pinned statutory deadline + how many business days it was (audit).
  deadlineAt: timestamp("deadline_at").notNull(),
  slaBusinessDays: integer("sla_business_days").notNull(),
  statuteCitation: text("statute_citation").notNull(),
  // The generated packet (the §47-270 / estoppel / §47-260 document).
  documentPayload: jsonb("document_payload").notNull(),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
  // The shared-queue item that surfaces the deadline + carries the L3 sign gate.
  agentActionId: varchar("agent_action_id").references(() => agentActions.id),
  // When a full §47-260 records-request lifecycle already exists, link to it.
  linkedRecordsRequestId: varchar("linked_records_request_id").references(() => recordsRequests.id),
  // The L3 PM sign.
  signedByUserId: varchar("signed_by_user_id").references(() => adminUsers.id),
  signedByEmail: text("signed_by_email"),
  signedAt: timestamp("signed_at"),
  issuedAt: timestamp("issued_at"),
  rejectedReason: text("rejected_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  byAssocStatus: index("statutory_records_assoc_status_idx").on(table.associationId, table.status),
  // Deadline-first surfacing index (near-deadline sweep).
  byAssocDeadline: index("statutory_records_assoc_deadline_idx").on(table.associationId, table.deadlineAt),
}));

export const insertStatutoryRecordSchema = createInsertSchema(statutoryRecords).omit({
  id: true,
  status: true,
  agentActionId: true,
  signedByUserId: true,
  signedByEmail: true,
  signedAt: true,
  issuedAt: true,
  rejectedReason: true,
  createdAt: true,
  updatedAt: true,
});
export type StatutoryRecord = typeof statutoryRecords.$inferSelect;
export type InsertStatutoryRecord = z.infer<typeof insertStatutoryRecordSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Cross-board-cycle institutional memory (founder-os#9475, W1).
//
// A volunteer HOA board turns over every 1-3 years, and institutional memory
// evaporates with it: the new treasurer/secretary/president cannot answer "why
// was the fence request denied?" or "what did the prior treasurer do about this
// vendor?" This is a queryable DECISION LOG that survives board turnover — one
// immutable row per board decision, carrying the decision, the reasoning, the
// actor (denormalized to TEXT so it survives even after that admin user is
// deleted), the board term, the date, linked attachments, and an optional link
// to the entity (owner / vendor / rule / unit) the decision touched.
//
//   READ-ONLY (L1) by design. Querying this memory NEVER actuates: there is no
//   approve/execute/actuate path off a query — it only SURFACES prior context.
//   Recording a decision is an append-only WRITE-TO the log (institutional
//   logging, like the audit log), NOT a write FROM memory to any other system.
//   The log is immutable: the app never UPDATEs or DELETEs a recorded decision
//   (a decision is a historical FACT; you don't rewrite board history).
//
// Tenant-isolated per YCM convention: associationId derived from the session,
// never from the request body. Additive / net-new: touches no existing table.
// ─────────────────────────────────────────────────────────────────────────────

// The decision domains the query interface can filter + surface history on.
export const boardDecisionCategoryEnum = pgEnum("board_decision_category", [
  "rule_application", // an owner/unit rule was applied or enforced
  "vendor",           // a vendor was selected, renewed, disputed, terminated
  "owner",            // an owner request/dispute/waiver was decided
  "financial",        // a financial decision (budget, reserve, assessment)
  "governance",       // bylaws / policy / procedure decisions
  "architectural",    // ARC / architectural-change decisions
  "general",          // anything else
]);
export type BoardDecisionCategory = (typeof boardDecisionCategoryEnum.enumValues)[number];

// board_decisions — the institutional-memory decision log. One immutable row per
// board decision; persists across board terms (turnover-survival).
export const boardDecisions = pgTable("board_decisions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  // What was decided (short subject) + the decision outcome.
  subject: text("subject").notNull(),
  decision: text("decision").notNull(),
  // The load-bearing "why" — every memory result surfaces the reasoning inline.
  reasoning: text("reasoning").notNull(),
  category: boardDecisionCategoryEnum("category").notNull().default("general"),
  // ── Actor — DENORMALIZED to text so the memory survives board turnover even
  // after the deciding admin user is removed. actorType ∈ {board|admin|agent|
  // committee}. recordedByUserId is an optional provenance FK (nullable, does
  // NOT gate retrieval).
  actorType: text("actor_type").notNull().default("board"),
  actorName: text("actor_name").notNull(),
  actorRole: text("actor_role"),
  recordedByUserId: varchar("recorded_by_user_id").references(() => adminUsers.id),
  // ── Turnover-survival key: the board term this decision was made under
  // (e.g. "2023-2024"). Retrievable by anyone in any later term.
  boardTerm: text("board_term"),
  decidedAt: timestamp("decided_at").notNull().defaultNow(),
  // ── History-surfacing link: the entity this decision touched. entityType ∈
  // {owner|vendor|rule|unit|...}; entityLabel is a denormalized human label so
  // history reads even if the linked row later changes/leaves.
  relatedEntityType: text("related_entity_type"),
  relatedEntityId: varchar("related_entity_id"),
  relatedEntityLabel: text("related_entity_label"),
  // Optional provenance link to the agent_action that produced this decision.
  sourceActionId: varchar("source_action_id").references(() => agentActions.id),
  // Linked supporting documents — { name, url } array (additive metadata).
  attachments: jsonb("attachments").$type<{ name: string; url: string }[]>().notNull().default(sql`'[]'::jsonb`),
  // Free-form tags to widen natural-language-style lookup.
  tags: jsonb("tags").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  // Query index: an association's decisions by category + recency.
  byAssocCategory: index("board_decisions_assoc_category_idx").on(table.associationId, table.category, table.decidedAt),
  // History-surfacing index: decisions tied to a specific entity.
  byAssocEntity: index("board_decisions_assoc_entity_idx").on(table.associationId, table.relatedEntityType, table.relatedEntityId),
  // Turnover-survival index: decisions by term.
  byAssocTerm: index("board_decisions_assoc_term_idx").on(table.associationId, table.boardTerm),
}));

export const insertBoardDecisionSchema = createInsertSchema(boardDecisions).omit({
  id: true,
  createdAt: true,
});
export type BoardDecision = typeof boardDecisions.$inferSelect;
export type InsertBoardDecision = z.infer<typeof insertBoardDecisionSchema>;

// ───────────────────────────────────────────────────────────────────────────
// Rule violations (founder-os#9487 — Board mode "log a violation" wizard).
//
// A volunteer HOA board's most common enforcement action is recording that a
// unit broke a community rule (bins left out, unauthorized parking, noise,
// pets, an architectural change without approval). The platform had no
// first-class table for this before Board mode — enforcement lived in ad-hoc
// notes. This lean table backs the "Log a violation" wizard: one row per
// logged violation, association-scoped, optionally tied to a unit + owner, with
// an optional fine amount (the wizard posts the fine as a separate owner-ledger
// `charge` entry and links it back via `ledgerEntryId`). Deliberately minimal —
// no notice-generation / escalation workflow here (that is a later dispatch).
export const violationStatusEnum = pgEnum("violation_status", ["open", "notice-sent", "cured", "escalated", "closed"]);

export const violations = pgTable("violations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  unitId: varchar("unit_id").references(() => units.id),
  personId: varchar("person_id").references(() => persons.id),
  // Free-text category the board picks from a plain-English list in the wizard
  // (Trash / bins, Parking, Noise, Pets, Architectural, Landscaping, Other).
  violationType: text("violation_type").notNull(),
  description: text("description").notNull(),
  observedAt: timestamp("observed_at").defaultNow().notNull(),
  status: violationStatusEnum("status").notNull().default("open"),
  // Optional fine posted alongside the violation. `ledgerEntryId` links to the
  // owner-ledger `charge` row created for the fine (set by the wizard flow).
  fineAmount: real("fine_amount"),
  ledgerEntryId: varchar("ledger_entry_id"),
  loggedByEmail: text("logged_by_email"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  byAssociation: index("violations_association_idx").on(table.associationId),
  byUnit: index("violations_unit_idx").on(table.unitId),
}));

// `ledgerEntryId` + `loggedByEmail` are server-managed (set from the fine flow /
// the authenticated admin), so they are omitted from the client insert schema.
export const insertViolationSchema = createInsertSchema(violations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  ledgerEntryId: true,
  loggedByEmail: true,
});
export type Violation = typeof violations.$inferSelect;
export type InsertViolation = z.infer<typeof insertViolationSchema>;
