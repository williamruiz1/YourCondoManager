import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp, pgEnum, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const units = pgTable("units", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  buildingId: varchar("building_id"),
  unitNumber: text("unit_number").notNull(),
  building: text("building"),
  squareFootage: real("square_footage"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueAssociationBuildingUnitNumber: uniqueIndex("units_association_building_unit_number_uq").on(table.associationId, table.buildingId, table.unitNumber),
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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
  amount: real("amount"),
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
  unitId: varchar("unit_id").notNull().references(() => units.id),
  personId: varchar("person_id").notNull().references(() => persons.id),
  entryType: ownerLedgerEntryTypeEnum("entry_type").notNull(),
  amount: real("amount").notNull(),
  postedAt: timestamp("posted_at").notNull(),
  description: text("description"),
  referenceType: text("reference_type"),
  referenceId: text("reference_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueTenantConfigAssociation: uniqueIndex("tenant_configs_association_uq").on(table.associationId),
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
// enum-bound) and nullable — see `hub_visibility_level` dual-vocab parity
// note above. Accept old ∪ new vocabularies during HV-1 + HV-2. HV-3 narrows
// this to new vocab only.
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
// Mapping (see docs/projects/platform-overhaul/decisions/1.5-hub-visibility-rename.md):
//   public   → public        (preserved verbatim — public-API safe)
//   resident → residents
//   owner    → unit-owners
//   board    → board-only
//   admin    → operator-only
// Translation helper: shared/hub-visibility.ts.
export const hubVisibilityLevelEnum = pgEnum("hub_visibility_level",
  ["public", "resident", "owner", "board", "admin",
   "residents", "unit-owners", "board-only", "operator-only"]);
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
  visibilityLevel: hubVisibilityLevelEnum("visibility_level").notNull().default("board"),
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
// Parity window: the `visibility_level` column on hub_map_issues is enum-bound
// and now accepts both old and new vocabularies. Callers may POST either
// during HV-1 + HV-2; HV-3 narrows to new vocab only via the recreate/recast
// migration. See shared/hub-visibility.ts.
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
  approvedBy: varchar("approved_by").references(() => persons.id),
  approvedAt: timestamp("approved_at"),
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
  "flat_per_association", "per_complex", "enterprise_manual",
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueReceiptReference: uniqueIndex("payment_transactions_receipt_ref_uq").on(table.receiptReference),
}));

export type PaymentTransaction = typeof paymentTransactions.$inferSelect;
export type InsertPaymentTransaction = typeof paymentTransactions.$inferInsert;
export const insertPaymentTransactionSchema = createInsertSchema(paymentTransactions);

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
