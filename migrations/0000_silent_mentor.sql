CREATE TYPE "public"."admin_user_role" AS ENUM('platform-admin', 'board-admin', 'manager', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."asset_condition" AS ENUM('excellent', 'good', 'fair', 'poor', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."autopay_enrollment_status" AS ENUM('active', 'paused', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."autopay_frequency" AS ENUM('monthly', 'quarterly', 'annual');--> statement-breakpoint
CREATE TYPE "public"."autopay_run_status" AS ENUM('success', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."board_package_status" AS ENUM('draft', 'approved', 'distributed');--> statement-breakpoint
CREATE TYPE "public"."budget_version_status" AS ENUM('draft', 'proposed', 'ratified', 'archived');--> statement-breakpoint
CREATE TYPE "public"."collections_handoff_status" AS ENUM('referred', 'active', 'settled', 'withdrawn', 'judgment');--> statement-breakpoint
CREATE TYPE "public"."community_announcement_priority" AS ENUM('normal', 'important', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."compliance_alert_override_status" AS ENUM('active', 'suppressed', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."compliance_template_scope" AS ENUM('ct-baseline', 'state-library', 'association');--> statement-breakpoint
CREATE TYPE "public"."contact_update_review_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."delinquency_escalation_status" AS ENUM('active', 'resolved', 'referred', 'on_payment_plan');--> statement-breakpoint
CREATE TYPE "public"."election_ballot_token_status" AS ENUM('pending', 'cast', 'consumed-by-proxy', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."election_result_visibility" AS ENUM('public', 'admin-only');--> statement-breakpoint
CREATE TYPE "public"."election_status" AS ENUM('draft', 'open', 'closed', 'certified', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."election_vote_type" AS ENUM('board-election', 'resolution', 'community-referendum', 'amendment-ratification');--> statement-breakpoint
CREATE TYPE "public"."election_voting_rule" AS ENUM('unit-weighted', 'person-weighted', 'board-only');--> statement-breakpoint
CREATE TYPE "public"."executive_evidence_type" AS ENUM('release-note', 'metric', 'screenshot', 'link', 'note');--> statement-breakpoint
CREATE TYPE "public"."executive_source_type" AS ENUM('manual', 'roadmap-task', 'roadmap-project');--> statement-breakpoint
CREATE TYPE "public"."executive_update_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."expense_attachment_type" AS ENUM('invoice', 'utility-payment');--> statement-breakpoint
CREATE TYPE "public"."extraction_review_status" AS ENUM('pending-review', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."fee_frequency" AS ENUM('monthly', 'quarterly', 'annually', 'one-time');--> statement-breakpoint
CREATE TYPE "public"."financial_alert_severity" AS ENUM('info', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."financial_alert_type" AS ENUM('large_payment', 'duplicate_payment', 'negative_adjustment', 'overdue_assessment', 'reconciliation_gap', 'budget_overage', 'delinquency_spike', 'expired_insurance_doc', 'audit_anomaly');--> statement-breakpoint
CREATE TYPE "public"."financial_approval_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."governance_reminder_recipient" AS ENUM('all_owners', 'board_members', 'managers', 'meeting_attendees');--> statement-breakpoint
CREATE TYPE "public"."governance_reminder_trigger" AS ENUM('before_meeting', 'after_meeting', 'task_due', 'board_term_expiry');--> statement-breakpoint
CREATE TYPE "public"."governance_task_status" AS ENUM('todo', 'in-progress', 'done');--> statement-breakpoint
CREATE TYPE "public"."hub_action_route_type" AS ENUM('internal', 'external');--> statement-breakpoint
CREATE TYPE "public"."hub_info_block_category" AS ENUM('trash', 'parking', 'emergency', 'maintenance', 'rules', 'amenities', 'custom');--> statement-breakpoint
CREATE TYPE "public"."hub_map_issue_category" AS ENUM('maintenance', 'repair', 'safety', 'landscaping', 'suggestion', 'inspection', 'other');--> statement-breakpoint
CREATE TYPE "public"."hub_map_issue_status" AS ENUM('reported', 'under-review', 'approved', 'in-progress', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."hub_map_node_type" AS ENUM('building', 'unit', 'common-area', 'parking', 'amenity', 'path', 'infrastructure');--> statement-breakpoint
CREATE TYPE "public"."hub_notice_category" AS ENUM('general', 'maintenance', 'governance', 'safety', 'seasonal', 'meeting', 'financial');--> statement-breakpoint
CREATE TYPE "public"."hub_visibility_level" AS ENUM('public', 'resident', 'owner', 'board', 'admin');--> statement-breakpoint
CREATE TYPE "public"."ingestion_correction_family" AS ENUM('owner-roster', 'bank-statement');--> statement-breakpoint
CREATE TYPE "public"."ingestion_exception_status" AS ENUM('open', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."ingestion_import_mode" AS ENUM('preview', 'commit');--> statement-breakpoint
CREATE TYPE "public"."ingestion_job_status" AS ENUM('queued', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ingestion_source_type" AS ENUM('file-upload', 'pasted-text');--> statement-breakpoint
CREATE TYPE "public"."inspection_condition" AS ENUM('excellent', 'good', 'fair', 'poor', 'critical');--> statement-breakpoint
CREATE TYPE "public"."inspection_finding_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."inspection_finding_status" AS ENUM('open', 'monitoring', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."inspection_location_type" AS ENUM('unit', 'common-area', 'building');--> statement-breakpoint
CREATE TYPE "public"."insurance_policy_type" AS ENUM('master', 'd-and-o', 'fidelity-bond', 'umbrella', 'liability', 'flood', 'earthquake', 'other');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'received', 'approved', 'paid', 'void');--> statement-breakpoint
CREATE TYPE "public"."late_fee_type" AS ENUM('flat', 'percent');--> statement-breakpoint
CREATE TYPE "public"."maintenance_frequency_unit" AS ENUM('month', 'quarter', 'year');--> statement-breakpoint
CREATE TYPE "public"."maintenance_instance_status" AS ENUM('scheduled', 'due', 'converted', 'completed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."maintenance_request_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."maintenance_request_status" AS ENUM('submitted', 'triaged', 'in-progress', 'resolved', 'closed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."maintenance_schedule_status" AS ENUM('active', 'paused', 'archived');--> statement-breakpoint
CREATE TYPE "public"."meeting_status" AS ENUM('scheduled', 'in-progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."meeting_summary_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."oauth_provider" AS ENUM('google');--> statement-breakpoint
CREATE TYPE "public"."occupancy_type" AS ENUM('OWNER_OCCUPIED', 'TENANT');--> statement-breakpoint
CREATE TYPE "public"."onboarding_invite_status" AS ENUM('active', 'submitted', 'approved', 'rejected', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."onboarding_resident_type" AS ENUM('owner', 'tenant');--> statement-breakpoint
CREATE TYPE "public"."onboarding_submission_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."owner_ledger_entry_type" AS ENUM('charge', 'assessment', 'payment', 'late-fee', 'credit', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."owner_payment_link_status" AS ENUM('active', 'paid', 'expired', 'void');--> statement-breakpoint
CREATE TYPE "public"."payment_event_status" AS ENUM('received', 'processed', 'ignored', 'failed');--> statement-breakpoint
CREATE TYPE "public"."payment_gateway_provider" AS ENUM('stripe', 'other');--> statement-breakpoint
CREATE TYPE "public"."payment_gateway_validation_status" AS ENUM('valid', 'invalid');--> statement-breakpoint
CREATE TYPE "public"."payment_plan_status" AS ENUM('active', 'completed', 'defaulted', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."person_contact_point_channel" AS ENUM('email', 'phone');--> statement-breakpoint
CREATE TYPE "public"."platform_plan" AS ENUM('self-managed', 'property-manager', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."platform_subscription_status" AS ENUM('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete');--> statement-breakpoint
CREATE TYPE "public"."portal_access_role" AS ENUM('owner', 'tenant', 'readonly', 'board-member');--> statement-breakpoint
CREATE TYPE "public"."portal_access_status" AS ENUM('invited', 'active', 'suspended', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "public"."reconciliation_match_status" AS ENUM('unmatched', 'auto_matched', 'manual_matched', 'disputed', 'excluded');--> statement-breakpoint
CREATE TYPE "public"."reconciliation_period_status" AS ENUM('open', 'closed', 'locked');--> statement-breakpoint
CREATE TYPE "public"."recurring_charge_frequency" AS ENUM('monthly', 'quarterly', 'annual');--> statement-breakpoint
CREATE TYPE "public"."recurring_charge_run_status" AS ENUM('pending', 'success', 'failed', 'skipped', 'retrying');--> statement-breakpoint
CREATE TYPE "public"."recurring_charge_schedule_status" AS ENUM('active', 'paused', 'archived');--> statement-breakpoint
CREATE TYPE "public"."regulatory_publication_status" AS ENUM('draft', 'review', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."resident_feedback_category" AS ENUM('maintenance', 'management', 'amenities', 'communication', 'neighbor', 'financial', 'general');--> statement-breakpoint
CREATE TYPE "public"."resolution_status" AS ENUM('draft', 'open', 'approved', 'rejected', 'archived');--> statement-breakpoint
CREATE TYPE "public"."roadmap_effort" AS ENUM('small', 'medium', 'large');--> statement-breakpoint
CREATE TYPE "public"."roadmap_priority" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."roadmap_project_status" AS ENUM('active', 'complete', 'archived');--> statement-breakpoint
CREATE TYPE "public"."roadmap_task_status" AS ENUM('todo', 'in-progress', 'done');--> statement-breakpoint
CREATE TYPE "public"."saved_payment_method_type" AS ENUM('ach', 'check', 'zelle', 'other');--> statement-breakpoint
CREATE TYPE "public"."utility_payment_status" AS ENUM('due', 'scheduled', 'paid');--> statement-breakpoint
CREATE TYPE "public"."vendor_portal_invitation_status" AS ENUM('pending', 'accepted', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "public"."vendor_status" AS ENUM('active', 'inactive', 'pending-renewal');--> statement-breakpoint
CREATE TYPE "public"."vendor_work_order_activity_type" AS ENUM('status_change', 'note_added', 'photo_uploaded', 'invoice_uploaded', 'estimated_completion_set');--> statement-breakpoint
CREATE TYPE "public"."vote_choice" AS ENUM('yes', 'no', 'abstain');--> statement-breakpoint
CREATE TYPE "public"."work_order_status" AS ENUM('open', 'assigned', 'in-progress', 'pending-review', 'closed', 'cancelled');--> statement-breakpoint
CREATE TABLE "admin_association_scopes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" varchar NOT NULL,
	"association_id" varchar NOT NULL,
	"scope" text DEFAULT 'read-write' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_user_preferences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" varchar NOT NULL,
	"email_notifications" integer DEFAULT 1 NOT NULL,
	"push_notifications" integer DEFAULT 1 NOT NULL,
	"desktop_notifications" integer DEFAULT 1 NOT NULL,
	"alert_digest" text DEFAULT 'daily' NOT NULL,
	"quiet_hours_enabled" integer DEFAULT 0 NOT NULL,
	"quiet_hours_start" text DEFAULT '22:00' NOT NULL,
	"quiet_hours_end" text DEFAULT '07:00' NOT NULL,
	"notification_category_preferences_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"role" "admin_user_role" DEFAULT 'viewer' NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_extracted_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar NOT NULL,
	"association_id" varchar,
	"record_type" text NOT NULL,
	"payload_json" jsonb NOT NULL,
	"confidence_score" real,
	"review_status" "extraction_review_status" DEFAULT 'pending-review' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"superseded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_ingestion_exceptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ingestion_job_id" varchar NOT NULL,
	"extracted_record_id" varchar NOT NULL,
	"association_id" varchar,
	"record_type" text NOT NULL,
	"exception_kind" text NOT NULL,
	"severity" text DEFAULT 'warning' NOT NULL,
	"status" "ingestion_exception_status" DEFAULT 'open' NOT NULL,
	"entity_key" text,
	"message" text NOT NULL,
	"context_json" jsonb,
	"suggestions_json" jsonb,
	"resolution_json" jsonb,
	"resolved_at" timestamp,
	"resolved_by" text,
	"superseded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_ingestion_import_runs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ingestion_job_id" varchar NOT NULL,
	"extracted_record_id" varchar NOT NULL,
	"association_id" varchar,
	"mode" "ingestion_import_mode" NOT NULL,
	"target_module" text DEFAULT 'none' NOT NULL,
	"run_status" text DEFAULT 'recorded' NOT NULL,
	"summary_json" jsonb NOT NULL,
	"created_entity_refs_json" jsonb,
	"actor_email" text,
	"error_message" text,
	"rolled_back_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_ingestion_jobs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar,
	"source_document_id" varchar,
	"source_type" "ingestion_source_type" NOT NULL,
	"source_filename" text,
	"source_text" text,
	"context_notes" text,
	"source_file_url" text,
	"status" "ingestion_job_status" DEFAULT 'queued' NOT NULL,
	"submitted_by" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_analysis_runs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_id" text NOT NULL,
	"module" text NOT NULL,
	"action" text NOT NULL,
	"success" integer DEFAULT 1 NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"metadata_json" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_analysis_versions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_id" text NOT NULL,
	"module" text NOT NULL,
	"version" integer NOT NULL,
	"payload_json" jsonb NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"trigger" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "annual_governance_tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"template_id" varchar,
	"template_item_id" varchar,
	"title" text NOT NULL,
	"description" text,
	"status" "governance_task_status" DEFAULT 'todo' NOT NULL,
	"owner_person_id" varchar,
	"due_date" timestamp,
	"completed_at" timestamp,
	"notes" text,
	"evidence_urls_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "association_assets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"unit_id" varchar,
	"vendor_id" varchar,
	"name" text NOT NULL,
	"asset_type" text NOT NULL,
	"manufacturer" text,
	"model" text,
	"serial_number" text,
	"location" text,
	"install_date" timestamp,
	"warranty_expires_at" timestamp,
	"last_serviced_at" timestamp,
	"next_service_due_at" timestamp,
	"estimated_lifespan_years" integer,
	"replacement_cost_estimate" real,
	"condition" "asset_condition" DEFAULT 'unknown' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "association_ingestion_correction_memory" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"record_type" "ingestion_correction_family" NOT NULL,
	"correction_kind" text NOT NULL,
	"correction_key" text NOT NULL,
	"source_extracted_record_id" varchar,
	"payload_json" jsonb NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "association_insurance_policies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"policy_type" "insurance_policy_type" NOT NULL,
	"carrier" text NOT NULL,
	"policy_number" text,
	"effective_date" timestamp,
	"expiration_date" timestamp,
	"premium_amount" real,
	"coverage_amount" real,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "association_memberships" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"person_id" varchar NOT NULL,
	"unit_id" varchar,
	"membership_type" text DEFAULT 'owner' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"is_primary" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "associations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"association_type" text,
	"date_formed" text,
	"ein" text,
	"address" text NOT NULL,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"country" text DEFAULT 'USA' NOT NULL,
	"is_archived" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_email" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"association_id" varchar,
	"before_json" jsonb,
	"after_json" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_external_accounts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"provider" "oauth_provider" NOT NULL,
	"provider_account_id" text NOT NULL,
	"provider_email" text,
	"profile_json" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" varchar,
	"email" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"avatar_url" text,
	"is_active" integer DEFAULT 1 NOT NULL,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "autopay_enrollments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"unit_id" varchar NOT NULL,
	"person_id" varchar NOT NULL,
	"amount" real NOT NULL,
	"frequency" "autopay_frequency" DEFAULT 'monthly' NOT NULL,
	"day_of_month" integer DEFAULT 1 NOT NULL,
	"status" "autopay_enrollment_status" DEFAULT 'active' NOT NULL,
	"next_payment_date" timestamp,
	"description" text DEFAULT 'Autopay HOA dues' NOT NULL,
	"enrolled_by" text,
	"enrolled_at" timestamp DEFAULT now() NOT NULL,
	"cancelled_by" text,
	"cancelled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "autopay_runs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" varchar NOT NULL,
	"association_id" varchar NOT NULL,
	"amount" real NOT NULL,
	"status" "autopay_run_status" DEFAULT 'success' NOT NULL,
	"ledger_entry_id" varchar,
	"error_message" text,
	"ran_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_statement_imports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"filename" text NOT NULL,
	"imported_by" text,
	"statement_date" timestamp,
	"opening_balance" real,
	"closing_balance" real,
	"transaction_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_statement_transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_id" varchar NOT NULL,
	"association_id" varchar NOT NULL,
	"transaction_date" timestamp NOT NULL,
	"description" text NOT NULL,
	"amount" real NOT NULL,
	"bank_reference" text,
	"check_number" text,
	"match_status" "reconciliation_match_status" DEFAULT 'unmatched' NOT NULL,
	"matched_ledger_entry_id" varchar,
	"matched_by" text,
	"matched_at" timestamp,
	"match_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board_package_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"title" text NOT NULL,
	"frequency" text DEFAULT 'monthly' NOT NULL,
	"auto_generate" integer DEFAULT 0 NOT NULL,
	"meeting_type" text,
	"generate_days_before" integer DEFAULT 7 NOT NULL,
	"last_auto_generated_at" timestamp,
	"sections_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board_packages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" varchar,
	"association_id" varchar NOT NULL,
	"meeting_id" varchar,
	"title" text NOT NULL,
	"period_label" text NOT NULL,
	"status" "board_package_status" DEFAULT 'draft' NOT NULL,
	"content_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"annotations_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"approved_by" text,
	"approved_at" timestamp,
	"distributed_by" text,
	"distributed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board_roles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" varchar NOT NULL,
	"association_id" varchar NOT NULL,
	"role" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp
);
--> statement-breakpoint
CREATE TABLE "budget_lines" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"budget_version_id" varchar NOT NULL,
	"account_id" varchar,
	"category_id" varchar,
	"line_item_name" text NOT NULL,
	"planned_amount" real NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_versions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"budget_id" varchar NOT NULL,
	"version_number" integer NOT NULL,
	"status" "budget_version_status" DEFAULT 'draft' NOT NULL,
	"notes" text,
	"ratified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"name" text NOT NULL,
	"fiscal_year" integer NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "buildings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"total_units" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"event_type" text DEFAULT 'governance' NOT NULL,
	"title" text NOT NULL,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp,
	"related_type" text,
	"related_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clause_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ingestion_job_id" varchar NOT NULL,
	"extracted_record_id" varchar,
	"association_id" varchar,
	"source_document_id" varchar,
	"title" text NOT NULL,
	"clause_text" text NOT NULL,
	"confidence_score" real,
	"review_status" "extraction_review_status" DEFAULT 'pending-review' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"superseded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clause_tags" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clause_record_id" varchar NOT NULL,
	"tag" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collections_handoffs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"unit_id" varchar NOT NULL,
	"person_id" varchar NOT NULL,
	"referral_date" timestamp NOT NULL,
	"referral_amount" real NOT NULL,
	"current_balance" real NOT NULL,
	"days_past_due" integer DEFAULT 0 NOT NULL,
	"status" "collections_handoff_status" DEFAULT 'referred' NOT NULL,
	"agency_name" text,
	"agency_contact_name" text,
	"agency_email" text,
	"agency_phone" text,
	"agency_case_number" text,
	"settlement_amount" real,
	"settlement_date" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "communication_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar,
	"channel" text DEFAULT 'email' NOT NULL,
	"direction" text DEFAULT 'outbound' NOT NULL,
	"subject" text,
	"body_snippet" text,
	"recipient_email" text,
	"recipient_person_id" varchar,
	"related_type" text,
	"related_id" text,
	"metadata_json" jsonb,
	"delivery_status" text,
	"delivery_status_updated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_announcements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"priority" "community_announcement_priority" DEFAULT 'normal' NOT NULL,
	"author_name" text,
	"published_at" timestamp,
	"expires_at" timestamp,
	"is_pinned" integer DEFAULT 0 NOT NULL,
	"is_published" integer DEFAULT 0 NOT NULL,
	"target_audience" text DEFAULT 'all' NOT NULL,
	"created_by" text,
	"notice_category" text,
	"visibility_level" text,
	"attachments" jsonb DEFAULT '[]'::jsonb,
	"is_draft" integer DEFAULT 0 NOT NULL,
	"scheduled_publish_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_alert_overrides" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"template_id" varchar,
	"template_item_id" varchar NOT NULL,
	"status" "compliance_alert_override_status" DEFAULT 'active' NOT NULL,
	"suppression_reason" text,
	"suppressed_until" timestamp,
	"notes" text,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_update_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"portal_access_id" varchar NOT NULL,
	"person_id" varchar NOT NULL,
	"request_json" jsonb NOT NULL,
	"review_status" "contact_update_review_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delinquency_escalations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"person_id" varchar NOT NULL,
	"unit_id" varchar NOT NULL,
	"current_stage" integer DEFAULT 1 NOT NULL,
	"balance" real NOT NULL,
	"days_past_due" integer DEFAULT 0 NOT NULL,
	"status" "delinquency_escalation_status" DEFAULT 'active' NOT NULL,
	"last_notice_at" timestamp,
	"next_action_at" timestamp,
	"resolved_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delinquency_thresholds" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"stage" integer NOT NULL,
	"stage_name" text NOT NULL,
	"minimum_balance" real DEFAULT 0 NOT NULL,
	"minimum_days_overdue" integer DEFAULT 30 NOT NULL,
	"action_type" text DEFAULT 'notice' NOT NULL,
	"notice_template_id" varchar,
	"late_fee_pct" real,
	"late_fee_flat" real,
	"is_active" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_tags" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_versions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar NOT NULL,
	"version_number" integer NOT NULL,
	"title" text NOT NULL,
	"file_url" text NOT NULL,
	"effective_date" timestamp,
	"amendment_notes" text,
	"is_current" integer DEFAULT 0 NOT NULL,
	"uploaded_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"title" text NOT NULL,
	"file_url" text NOT NULL,
	"document_type" text NOT NULL,
	"is_portal_visible" integer DEFAULT 0 NOT NULL,
	"portal_audience" text DEFAULT 'owner' NOT NULL,
	"prior_versions_portal_visible" integer DEFAULT 0 NOT NULL,
	"uploaded_by" text,
	"parent_document_id" varchar,
	"version_number" integer DEFAULT 1 NOT NULL,
	"is_current_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "election_ballot_casts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"election_id" varchar NOT NULL,
	"ballot_token_id" varchar NOT NULL,
	"person_id" varchar,
	"unit_id" varchar,
	"choices_json" jsonb,
	"vote_weight" real DEFAULT 1 NOT NULL,
	"is_proxy" integer DEFAULT 0 NOT NULL,
	"proxy_for_person_id" varchar,
	"proxy_for_unit_id" varchar,
	"confirmation_ref" text NOT NULL,
	"cast_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "election_ballot_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"election_id" varchar NOT NULL,
	"token" text NOT NULL,
	"person_id" varchar,
	"unit_id" varchar,
	"status" "election_ballot_token_status" DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp,
	"cast_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "election_options" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"election_id" varchar NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"bio" text,
	"photo_url" text,
	"current_role" text,
	"nomination_statement" text,
	"nominated_by_person_id" varchar,
	"nomination_status" text DEFAULT 'approved',
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "election_proxy_designations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"election_id" varchar NOT NULL,
	"owner_person_id" varchar NOT NULL,
	"owner_unit_id" varchar,
	"proxy_person_id" varchar NOT NULL,
	"designated_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "election_proxy_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"election_id" varchar NOT NULL,
	"owner_person_id" varchar,
	"owner_unit_id" varchar,
	"file_url" text NOT NULL,
	"title" text NOT NULL,
	"uploaded_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "elections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"meeting_id" varchar,
	"title" text NOT NULL,
	"description" text,
	"vote_type" "election_vote_type" DEFAULT 'resolution' NOT NULL,
	"voting_rule" "election_voting_rule" DEFAULT 'unit-weighted' NOT NULL,
	"is_secret_ballot" integer DEFAULT 0 NOT NULL,
	"result_visibility" "election_result_visibility" DEFAULT 'public' NOT NULL,
	"status" "election_status" DEFAULT 'draft' NOT NULL,
	"opens_at" timestamp,
	"closes_at" timestamp,
	"nominations_open_at" timestamp,
	"nominations_close_at" timestamp,
	"quorum_percent" real DEFAULT 50 NOT NULL,
	"max_choices" integer,
	"eligible_voter_count" integer DEFAULT 0 NOT NULL,
	"certified_by" text,
	"certified_at" timestamp,
	"certification_summary" text,
	"result_document_id" varchar,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_log_id" varchar NOT NULL,
	"event_type" text NOT NULL,
	"url" text,
	"ip_address" text,
	"user_agent" text,
	"occurred_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar,
	"to_address" text NOT NULL,
	"cc_addresses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"bcc_addresses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subject" text NOT NULL,
	"template_key" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"provider" text DEFAULT 'internal-mock' NOT NULL,
	"provider_message_id" text,
	"error_message" text,
	"metadata_json" jsonb,
	"tracking_token" text,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_threads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"subject" text NOT NULL,
	"participants_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" text DEFAULT 'internal' NOT NULL,
	"last_message_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_executive_evidence" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"executive_update_id" varchar NOT NULL,
	"evidence_type" "executive_evidence_type" DEFAULT 'note' NOT NULL,
	"label" text NOT NULL,
	"value" text NOT NULL,
	"metadata_json" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_executive_updates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"headline" text NOT NULL,
	"summary" text NOT NULL,
	"problem_statement" text,
	"solution_summary" text,
	"features_delivered" text[] DEFAULT '{}'::text[] NOT NULL,
	"business_value" text,
	"status" "executive_update_status" DEFAULT 'draft' NOT NULL,
	"source_type" "executive_source_type" DEFAULT 'manual' NOT NULL,
	"source_key" text,
	"project_id" varchar,
	"workstream_id" varchar,
	"task_id" varchar,
	"delivered_at" timestamp,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense_attachments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"expense_type" "expense_attachment_type" NOT NULL,
	"expense_id" text NOT NULL,
	"title" text NOT NULL,
	"file_url" text NOT NULL,
	"uploaded_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_accounts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"name" text NOT NULL,
	"account_code" text,
	"account_type" text DEFAULT 'expense' NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_alerts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"alert_type" "financial_alert_type" NOT NULL,
	"severity" "financial_alert_severity" DEFAULT 'warning' NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"amount" real,
	"is_read" integer DEFAULT 0 NOT NULL,
	"is_dismissed" integer DEFAULT 0 NOT NULL,
	"dismissed_by" text,
	"dismissed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_approvals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"requested_by" text NOT NULL,
	"approver_id" varchar,
	"status" "financial_approval_status" DEFAULT 'pending' NOT NULL,
	"change_type" text NOT NULL,
	"change_description" text NOT NULL,
	"change_amount" real,
	"change_payload_json" jsonb,
	"required_approvers" integer DEFAULT 2 NOT NULL,
	"approved_by" text,
	"resolved_at" timestamp,
	"resolver_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"name" text NOT NULL,
	"category_type" text DEFAULT 'expense' NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "governance_compliance_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar,
	"base_template_id" varchar,
	"scope" "compliance_template_scope" DEFAULT 'ct-baseline' NOT NULL,
	"state_code" text,
	"year" integer NOT NULL,
	"version_number" integer DEFAULT 1 NOT NULL,
	"name" text NOT NULL,
	"source_authority" text,
	"source_url" text,
	"source_document_title" text,
	"source_document_date" timestamp,
	"effective_date" timestamp,
	"last_source_updated_at" timestamp,
	"last_verified_at" timestamp,
	"last_synced_at" timestamp,
	"next_review_due_at" timestamp,
	"publication_status" "regulatory_publication_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp,
	"review_notes" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "governance_meetings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"meeting_type" text NOT NULL,
	"title" text NOT NULL,
	"scheduled_at" timestamp NOT NULL,
	"location" text,
	"status" "meeting_status" DEFAULT 'scheduled' NOT NULL,
	"agenda" text,
	"notes" text,
	"summary_text" text,
	"summary_status" "meeting_summary_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "governance_reminder_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"name" text NOT NULL,
	"trigger" "governance_reminder_trigger" NOT NULL,
	"days_offset" integer DEFAULT 3 NOT NULL,
	"recipient_type" "governance_reminder_recipient" DEFAULT 'all_owners' NOT NULL,
	"subject_template" text NOT NULL,
	"body_template" text NOT NULL,
	"meeting_types" text,
	"is_active" integer DEFAULT 1 NOT NULL,
	"last_run_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "governance_template_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"legal_reference" text,
	"source_citation" text,
	"source_url" text,
	"due_month" integer NOT NULL,
	"due_day" integer NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hoa_fee_schedules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"name" text NOT NULL,
	"amount" real NOT NULL,
	"frequency" "fee_frequency" DEFAULT 'monthly' NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"grace_days" integer DEFAULT 0 NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hub_action_links" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"label" text NOT NULL,
	"icon_key" text,
	"route_type" "hub_action_route_type" DEFAULT 'internal' NOT NULL,
	"route_target" text NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"is_enabled" integer DEFAULT 1 NOT NULL,
	"auto_derived" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hub_info_blocks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"category" "hub_info_block_category" DEFAULT 'custom' NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"external_links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"is_enabled" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hub_map_issues" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"map_node_id" varchar,
	"layer_id" varchar NOT NULL,
	"reported_by_portal_access_id" varchar,
	"title" text NOT NULL,
	"description" text,
	"category" "hub_map_issue_category" DEFAULT 'maintenance' NOT NULL,
	"images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"coordinates" jsonb,
	"status" "hub_map_issue_status" DEFAULT 'reported' NOT NULL,
	"visibility_level" "hub_visibility_level" DEFAULT 'board' NOT NULL,
	"priority" "roadmap_priority" DEFAULT 'medium' NOT NULL,
	"linked_ticket_id" varchar,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hub_map_layers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"name" text NOT NULL,
	"base_image_url" text NOT NULL,
	"coordinate_system" jsonb,
	"is_active" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hub_map_nodes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"layer_id" varchar NOT NULL,
	"association_id" varchar NOT NULL,
	"node_type" "hub_map_node_type" NOT NULL,
	"label" text NOT NULL,
	"linked_building_id" varchar,
	"linked_unit_id" varchar,
	"geometry" jsonb NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hub_page_configs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"is_enabled" integer DEFAULT 0 NOT NULL,
	"logo_url" text,
	"banner_image_url" text,
	"community_description" text,
	"section_order" jsonb DEFAULT '["notices","quick-actions","info-blocks","map","contacts"]'::jsonb NOT NULL,
	"enabled_sections" jsonb DEFAULT '["notices","quick-actions","info-blocks","contacts"]'::jsonb NOT NULL,
	"theme_color" text,
	"slug" text,
	"welcome_mode_enabled" integer DEFAULT 0 NOT NULL,
	"welcome_headline" text,
	"welcome_highlights" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inspection_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"unit_id" varchar,
	"location_type" "inspection_location_type" DEFAULT 'unit' NOT NULL,
	"location_text" text NOT NULL,
	"inspection_type" text DEFAULT 'routine' NOT NULL,
	"inspector_name" text NOT NULL,
	"overall_condition" "inspection_condition" DEFAULT 'good' NOT NULL,
	"summary" text,
	"inspected_at" timestamp DEFAULT now() NOT NULL,
	"findings_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "late_fee_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"rule_id" varchar NOT NULL,
	"reference_type" text,
	"reference_id" text,
	"balance_amount" real NOT NULL,
	"due_date" timestamp NOT NULL,
	"as_of_date" timestamp NOT NULL,
	"calculated_fee" real NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "late_fee_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"name" text NOT NULL,
	"fee_type" "late_fee_type" DEFAULT 'flat' NOT NULL,
	"fee_amount" real NOT NULL,
	"grace_days" integer DEFAULT 0 NOT NULL,
	"max_fee" real,
	"is_active" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"unit_id" varchar,
	"submitted_by_person_id" varchar,
	"submitted_by_portal_access_id" varchar,
	"submitted_by_email" text,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"location_text" text,
	"category" text DEFAULT 'general' NOT NULL,
	"priority" "maintenance_request_priority" DEFAULT 'medium' NOT NULL,
	"status" "maintenance_request_status" DEFAULT 'submitted' NOT NULL,
	"attachment_urls_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"assigned_to" text,
	"resolution_notes" text,
	"response_due_at" timestamp,
	"escalation_stage" integer DEFAULT 0 NOT NULL,
	"escalated_at" timestamp,
	"last_escalation_notice_at" timestamp,
	"triaged_at" timestamp,
	"resolved_at" timestamp,
	"closed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_schedule_instances" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" varchar NOT NULL,
	"association_id" varchar NOT NULL,
	"unit_id" varchar,
	"vendor_id" varchar,
	"work_order_id" varchar,
	"title" text NOT NULL,
	"component" text NOT NULL,
	"location_text" text NOT NULL,
	"due_at" timestamp NOT NULL,
	"status" "maintenance_instance_status" DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_schedule_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"unit_id" varchar,
	"vendor_id" varchar,
	"title" text NOT NULL,
	"component" text NOT NULL,
	"description" text,
	"location_text" text NOT NULL,
	"frequency_unit" "maintenance_frequency_unit" DEFAULT 'quarter' NOT NULL,
	"frequency_interval" integer DEFAULT 1 NOT NULL,
	"responsible_party" text,
	"auto_create_work_order" integer DEFAULT 0 NOT NULL,
	"next_due_at" timestamp NOT NULL,
	"status" "maintenance_schedule_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_agenda_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_notes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" varchar NOT NULL,
	"note_type" text DEFAULT 'general' NOT NULL,
	"content" text NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notice_sends" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar,
	"template_id" varchar,
	"campaign_key" text,
	"recipient_email" text NOT NULL,
	"recipient_person_id" varchar,
	"subject_rendered" text NOT NULL,
	"body_rendered" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"provider" text DEFAULT 'internal-mock' NOT NULL,
	"provider_message_id" text,
	"metadata_json" jsonb,
	"sent_by" text,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"delivered_at" timestamp,
	"opened_at" timestamp,
	"bounced_at" timestamp,
	"bounce_type" text,
	"bounce_reason" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"last_retry_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "notice_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar,
	"name" text NOT NULL,
	"channel" text DEFAULT 'email' NOT NULL,
	"subject_template" text NOT NULL,
	"header_template" text,
	"body_template" text NOT NULL,
	"footer_template" text,
	"signature_template" text,
	"is_active" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "occupancies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" varchar NOT NULL,
	"person_id" varchar NOT NULL,
	"occupancy_type" "occupancy_type" NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp
);
--> statement-breakpoint
CREATE TABLE "onboarding_invites" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"unit_id" varchar,
	"resident_type" "onboarding_resident_type" NOT NULL,
	"email" text,
	"phone" text,
	"delivery_channel" text DEFAULT 'link' NOT NULL,
	"token" text NOT NULL,
	"status" "onboarding_invite_status" DEFAULT 'active' NOT NULL,
	"expires_at" timestamp,
	"created_by" text,
	"last_sent_at" timestamp,
	"submitted_at" timestamp,
	"approved_at" timestamp,
	"rejected_at" timestamp,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_submissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invite_id" varchar,
	"association_id" varchar NOT NULL,
	"unit_id" varchar NOT NULL,
	"resident_type" "onboarding_resident_type" NOT NULL,
	"source_channel" text DEFAULT 'unit-link' NOT NULL,
	"status" "onboarding_submission_status" DEFAULT 'pending' NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text,
	"phone" text,
	"mailing_address" text,
	"emergency_contact_name" text,
	"emergency_contact_phone" text,
	"contact_preference" text DEFAULT 'email' NOT NULL,
	"occupancy_intent" text,
	"start_date" timestamp NOT NULL,
	"ownership_percentage" real,
	"additional_owners_json" jsonb,
	"tenant_residents_json" jsonb,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"rejection_reason" text,
	"created_person_id" varchar,
	"created_occupancy_id" varchar,
	"created_ownership_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "owner_ledger_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"unit_id" varchar NOT NULL,
	"person_id" varchar NOT NULL,
	"entry_type" "owner_ledger_entry_type" NOT NULL,
	"amount" real NOT NULL,
	"posted_at" timestamp NOT NULL,
	"description" text,
	"reference_type" text,
	"reference_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "owner_payment_links" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"association_id" varchar NOT NULL,
	"unit_id" varchar NOT NULL,
	"person_id" varchar NOT NULL,
	"amount" real NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" "owner_payment_link_status" DEFAULT 'active' NOT NULL,
	"allow_partial" integer DEFAULT 0 NOT NULL,
	"memo" text,
	"expires_at" timestamp,
	"paid_at" timestamp,
	"voided_at" timestamp,
	"metadata_json" jsonb,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ownerships" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" varchar NOT NULL,
	"person_id" varchar NOT NULL,
	"ownership_percentage" real DEFAULT 100 NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"relationship_notes_json" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partial_payment_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"allow_partial_payments" integer DEFAULT 1 NOT NULL,
	"minimum_payment_amount" real,
	"minimum_payment_percent" real,
	"require_payment_confirmation" integer DEFAULT 1 NOT NULL,
	"send_receipt_email" integer DEFAULT 1 NOT NULL,
	"receipt_email_template" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_event_transitions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_event_id" varchar NOT NULL,
	"from_status" text NOT NULL,
	"to_status" text NOT NULL,
	"reason" text,
	"transitioned_at" timestamp DEFAULT now() NOT NULL,
	"transitioned_by" text DEFAULT 'system' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_gateway_connections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"provider" "payment_gateway_provider" DEFAULT 'stripe' NOT NULL,
	"provider_account_id" text,
	"publishable_key" text,
	"secret_key_masked" text,
	"webhook_secret_masked" text,
	"validation_status" "payment_gateway_validation_status" DEFAULT 'valid' NOT NULL,
	"validation_message" text,
	"is_active" integer DEFAULT 1 NOT NULL,
	"last_validated_at" timestamp,
	"metadata_json" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_method_configs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"method_type" text DEFAULT 'other' NOT NULL,
	"display_name" text NOT NULL,
	"instructions" text NOT NULL,
	"account_name" text,
	"bank_name" text,
	"routing_number" text,
	"account_number" text,
	"mailing_address" text,
	"payment_notes" text,
	"zelle_handle" text,
	"support_email" text,
	"support_phone" text,
	"is_active" integer DEFAULT 1 NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_plans" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"unit_id" varchar NOT NULL,
	"person_id" varchar NOT NULL,
	"total_amount" real NOT NULL,
	"amount_paid" real DEFAULT 0 NOT NULL,
	"installment_amount" real NOT NULL,
	"installment_frequency" text DEFAULT 'monthly' NOT NULL,
	"start_date" timestamp NOT NULL,
	"next_due_date" timestamp,
	"end_date" timestamp,
	"status" "payment_plan_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_reminder_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"name" text NOT NULL,
	"template_id" varchar,
	"days_relative_to_due" integer DEFAULT 0 NOT NULL,
	"trigger_on" text DEFAULT 'overdue' NOT NULL,
	"min_balance_threshold" real DEFAULT 0 NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL,
	"last_run_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_webhook_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"provider" "payment_gateway_provider" DEFAULT 'stripe' NOT NULL,
	"provider_event_id" text NOT NULL,
	"payment_link_id" varchar,
	"unit_id" varchar,
	"person_id" varchar,
	"amount" real,
	"currency" text DEFAULT 'USD',
	"status" "payment_event_status" DEFAULT 'received' NOT NULL,
	"event_type" text,
	"gateway_reference" text,
	"raw_payload_json" jsonb,
	"processed_at" timestamp,
	"owner_ledger_entry_id" text,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permission_change_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"old_role" "admin_user_role" NOT NULL,
	"new_role" "admin_user_role" NOT NULL,
	"changed_by" text NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permission_envelopes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar,
	"name" text NOT NULL,
	"audience" text DEFAULT 'owner-self-service' NOT NULL,
	"permissions_json" jsonb NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "person_contact_points" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" varchar NOT NULL,
	"association_id" varchar,
	"channel" "person_contact_point_channel" NOT NULL,
	"value" text NOT NULL,
	"normalized_value" text NOT NULL,
	"is_primary" integer DEFAULT 0 NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"source_record_id" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "persons" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text,
	"phone" text,
	"mailing_address" text,
	"emergency_contact_name" text,
	"emergency_contact_phone" text,
	"contact_preference" text DEFAULT 'email' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_secrets" (
	"key" varchar PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "platform_subscriptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"plan" "platform_plan" NOT NULL,
	"status" "platform_subscription_status" DEFAULT 'trialing' NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"stripe_subscription_id" text,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"trial_ends_at" timestamp,
	"cancel_at_period_end" integer DEFAULT 0 NOT NULL,
	"unit_tier" integer,
	"admin_email" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_webhook_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text DEFAULT 'stripe' NOT NULL,
	"provider_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"raw_payload_json" text,
	"error_message" text,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_access" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"person_id" varchar NOT NULL,
	"unit_id" varchar,
	"email" text NOT NULL,
	"role" "portal_access_role" DEFAULT 'owner' NOT NULL,
	"status" "portal_access_status" DEFAULT 'active' NOT NULL,
	"board_role_id" varchar,
	"invited_by" text,
	"invited_at" timestamp,
	"accepted_at" timestamp,
	"suspended_at" timestamp,
	"revoked_at" timestamp,
	"last_login_at" timestamp,
	"sms_opt_in" integer DEFAULT 0 NOT NULL,
	"sms_opt_in_changed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_login_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar,
	"email" text NOT NULL,
	"otp_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portal_access_id" varchar NOT NULL,
	"association_id" varchar NOT NULL,
	"person_id" varchar NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh_key" text NOT NULL,
	"auth_key" text NOT NULL,
	"user_agent" text,
	"is_active" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reconciliation_periods" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"period_label" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"status" "reconciliation_period_status" DEFAULT 'open' NOT NULL,
	"import_id" varchar,
	"closed_by" text,
	"closed_at" timestamp,
	"locked_by" text,
	"locked_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_charge_runs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schedule_id" varchar NOT NULL,
	"association_id" varchar NOT NULL,
	"unit_id" varchar,
	"amount" real NOT NULL,
	"status" "recurring_charge_run_status" DEFAULT 'pending' NOT NULL,
	"ledger_entry_id" varchar,
	"error_message" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"next_retry_at" timestamp,
	"ran_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_charge_schedules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"unit_id" varchar,
	"charge_description" text NOT NULL,
	"entry_type" "owner_ledger_entry_type" DEFAULT 'charge' NOT NULL,
	"amount" real NOT NULL,
	"frequency" "recurring_charge_frequency" DEFAULT 'monthly' NOT NULL,
	"day_of_month" integer DEFAULT 1 NOT NULL,
	"next_run_date" timestamp,
	"status" "recurring_charge_schedule_status" DEFAULT 'active' NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resident_feedbacks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"unit_id" varchar,
	"person_id" varchar,
	"category" "resident_feedback_category" DEFAULT 'general' NOT NULL,
	"satisfaction_score" integer,
	"subject" text,
	"feedback_text" text,
	"is_anonymous" integer DEFAULT 0 NOT NULL,
	"admin_notes" text,
	"status" text DEFAULT 'open' NOT NULL,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resolutions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"meeting_id" varchar,
	"title" text NOT NULL,
	"description" text,
	"status" "resolution_status" DEFAULT 'draft' NOT NULL,
	"passed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_roadmap_projects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "roadmap_project_status" DEFAULT 'active' NOT NULL,
	"is_collapsed" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_roadmap_task_attachments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" varchar NOT NULL,
	"file_url" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer,
	"uploaded_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_roadmap_tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"workstream_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "roadmap_task_status" DEFAULT 'todo' NOT NULL,
	"effort" "roadmap_effort",
	"priority" "roadmap_priority",
	"dependency_task_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"target_start_date" timestamp,
	"target_end_date" timestamp,
	"completed_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_roadmap_workstreams" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"order_index" integer DEFAULT 0 NOT NULL,
	"is_collapsed" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_payment_methods" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"person_id" varchar NOT NULL,
	"method_type" "saved_payment_method_type" DEFAULT 'ach' NOT NULL,
	"display_name" text NOT NULL,
	"last4" text,
	"bank_name" text,
	"external_token_ref" text,
	"is_default" integer DEFAULT 0 NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_delivery_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_sid" text NOT NULL,
	"association_id" varchar,
	"recipient_person_id" varchar,
	"to_number" text NOT NULL,
	"from_number" text,
	"message_status" text NOT NULL,
	"error_code" text,
	"error_message" text,
	"raw_payload_json" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "special_assessments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"name" text NOT NULL,
	"total_amount" real NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"installment_count" integer DEFAULT 1 NOT NULL,
	"notes" text,
	"is_active" integer DEFAULT 1 NOT NULL,
	"auto_post_enabled" integer DEFAULT 0 NOT NULL,
	"excluded_unit_ids_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suggested_links" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clause_record_id" varchar NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"confidence_score" real,
	"is_approved" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_configs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"portal_name" text DEFAULT 'Owner Portal' NOT NULL,
	"support_email" text,
	"allow_contact_updates" integer DEFAULT 1 NOT NULL,
	"owner_document_visibility" text DEFAULT 'owner-safe' NOT NULL,
	"gmail_integration_status" text DEFAULT 'not-configured' NOT NULL,
	"default_notice_footer" text,
	"management_type" text DEFAULT 'self-managed' NOT NULL,
	"management_company_name" text,
	"ai_ingestion_rollout_mode" text DEFAULT 'full' NOT NULL,
	"ai_ingestion_canary_percent" integer DEFAULT 100 NOT NULL,
	"ai_ingestion_rollout_notes" text,
	"sms_from_number" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unit_change_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" varchar NOT NULL,
	"field_name" text NOT NULL,
	"old_value" text,
	"new_value" text,
	"changed_by" text DEFAULT 'system' NOT NULL,
	"changed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"building_id" varchar,
	"unit_number" text NOT NULL,
	"building" text,
	"square_footage" real,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "utility_payments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"utility_type" text NOT NULL,
	"provider_name" text NOT NULL,
	"service_period_start" timestamp,
	"service_period_end" timestamp,
	"due_date" timestamp,
	"paid_date" timestamp,
	"amount" real NOT NULL,
	"status" "utility_payment_status" DEFAULT 'due' NOT NULL,
	"account_id" varchar,
	"category_id" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_invoices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"vendor_id" varchar,
	"vendor_name" text NOT NULL,
	"invoice_number" text,
	"invoice_date" timestamp NOT NULL,
	"due_date" timestamp,
	"amount" real NOT NULL,
	"status" "invoice_status" DEFAULT 'received' NOT NULL,
	"account_id" varchar,
	"category_id" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_portal_credentials" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" varchar NOT NULL,
	"association_id" varchar NOT NULL,
	"email" text NOT NULL,
	"status" "vendor_portal_invitation_status" DEFAULT 'pending' NOT NULL,
	"invited_by" text,
	"invited_at" timestamp DEFAULT now() NOT NULL,
	"accepted_at" timestamp,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_portal_login_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" varchar NOT NULL,
	"email" text NOT NULL,
	"otp_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_work_order_activity" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_order_id" varchar NOT NULL,
	"vendor_id" varchar NOT NULL,
	"association_id" varchar NOT NULL,
	"activity_type" "vendor_work_order_activity_type" NOT NULL,
	"note" text,
	"previous_status" text,
	"new_status" text,
	"file_url" text,
	"file_type" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"name" text NOT NULL,
	"trade" text DEFAULT 'general' NOT NULL,
	"service_area" text,
	"primary_contact_name" text,
	"primary_email" text,
	"primary_phone" text,
	"license_number" text,
	"insurance_expires_at" timestamp,
	"status" "vendor_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vote_answers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ballot_id" varchar NOT NULL,
	"question_id" varchar NOT NULL,
	"selected_options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vote_ballots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" varchar NOT NULL,
	"unit_id" varchar,
	"person_id" varchar,
	"token_hash" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"proxy_person_id" varchar,
	"proxy_document_url" text,
	"cast_at" timestamp,
	"cast_ip" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vote_campaigns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"vote_type" text DEFAULT 'resolution' NOT NULL,
	"weighting_rule" text DEFAULT 'unit' NOT NULL,
	"is_secret_ballot" integer DEFAULT 0 NOT NULL,
	"quorum_percent" real,
	"open_at" timestamp,
	"close_at" timestamp,
	"status" text DEFAULT 'draft' NOT NULL,
	"certified_at" timestamp,
	"certified_by" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vote_questions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" varchar NOT NULL,
	"question_text" text NOT NULL,
	"choice_type" text DEFAULT 'yes-no' NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vote_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resolution_id" varchar NOT NULL,
	"voter_person_id" varchar,
	"vote_choice" "vote_choice" NOT NULL,
	"vote_weight" real DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_signing_secrets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"secret_hash" text NOT NULL,
	"secret_hint" text,
	"provider" text DEFAULT 'generic' NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL,
	"rotated_at" timestamp,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_orders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"maintenance_request_id" varchar,
	"unit_id" varchar,
	"vendor_id" varchar,
	"vendor_invoice_id" varchar,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"location_text" text,
	"category" text DEFAULT 'general' NOT NULL,
	"priority" "maintenance_request_priority" DEFAULT 'medium' NOT NULL,
	"status" "work_order_status" DEFAULT 'open' NOT NULL,
	"assigned_to" text,
	"estimated_cost" real,
	"actual_cost" real,
	"scheduled_for" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"resolution_notes" text,
	"photos_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"vendor_estimated_completion_date" timestamp,
	"vendor_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_association_scopes" ADD CONSTRAINT "admin_association_scopes_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_association_scopes" ADD CONSTRAINT "admin_association_scopes_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_user_preferences" ADD CONSTRAINT "admin_user_preferences_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_extracted_records" ADD CONSTRAINT "ai_extracted_records_job_id_ai_ingestion_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."ai_ingestion_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_extracted_records" ADD CONSTRAINT "ai_extracted_records_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_ingestion_exceptions" ADD CONSTRAINT "ai_ingestion_exceptions_ingestion_job_id_ai_ingestion_jobs_id_fk" FOREIGN KEY ("ingestion_job_id") REFERENCES "public"."ai_ingestion_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_ingestion_exceptions" ADD CONSTRAINT "ai_ingestion_exceptions_extracted_record_id_ai_extracted_records_id_fk" FOREIGN KEY ("extracted_record_id") REFERENCES "public"."ai_extracted_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_ingestion_exceptions" ADD CONSTRAINT "ai_ingestion_exceptions_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_ingestion_import_runs" ADD CONSTRAINT "ai_ingestion_import_runs_ingestion_job_id_ai_ingestion_jobs_id_fk" FOREIGN KEY ("ingestion_job_id") REFERENCES "public"."ai_ingestion_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_ingestion_import_runs" ADD CONSTRAINT "ai_ingestion_import_runs_extracted_record_id_ai_extracted_records_id_fk" FOREIGN KEY ("extracted_record_id") REFERENCES "public"."ai_extracted_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_ingestion_import_runs" ADD CONSTRAINT "ai_ingestion_import_runs_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_ingestion_jobs" ADD CONSTRAINT "ai_ingestion_jobs_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_ingestion_jobs" ADD CONSTRAINT "ai_ingestion_jobs_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annual_governance_tasks" ADD CONSTRAINT "annual_governance_tasks_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annual_governance_tasks" ADD CONSTRAINT "annual_governance_tasks_template_id_governance_compliance_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."governance_compliance_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annual_governance_tasks" ADD CONSTRAINT "annual_governance_tasks_template_item_id_governance_template_items_id_fk" FOREIGN KEY ("template_item_id") REFERENCES "public"."governance_template_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annual_governance_tasks" ADD CONSTRAINT "annual_governance_tasks_owner_person_id_persons_id_fk" FOREIGN KEY ("owner_person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "association_assets" ADD CONSTRAINT "association_assets_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "association_assets" ADD CONSTRAINT "association_assets_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "association_assets" ADD CONSTRAINT "association_assets_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "association_ingestion_correction_memory" ADD CONSTRAINT "association_ingestion_correction_memory_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "association_ingestion_correction_memory" ADD CONSTRAINT "association_ingestion_correction_memory_source_extracted_record_id_ai_extracted_records_id_fk" FOREIGN KEY ("source_extracted_record_id") REFERENCES "public"."ai_extracted_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "association_insurance_policies" ADD CONSTRAINT "association_insurance_policies_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "association_memberships" ADD CONSTRAINT "association_memberships_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "association_memberships" ADD CONSTRAINT "association_memberships_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "association_memberships" ADD CONSTRAINT "association_memberships_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_external_accounts" ADD CONSTRAINT "auth_external_accounts_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_users" ADD CONSTRAINT "auth_users_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "autopay_enrollments" ADD CONSTRAINT "autopay_enrollments_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "autopay_enrollments" ADD CONSTRAINT "autopay_enrollments_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "autopay_enrollments" ADD CONSTRAINT "autopay_enrollments_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "autopay_runs" ADD CONSTRAINT "autopay_runs_enrollment_id_autopay_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."autopay_enrollments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "autopay_runs" ADD CONSTRAINT "autopay_runs_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "autopay_runs" ADD CONSTRAINT "autopay_runs_ledger_entry_id_owner_ledger_entries_id_fk" FOREIGN KEY ("ledger_entry_id") REFERENCES "public"."owner_ledger_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_statement_imports" ADD CONSTRAINT "bank_statement_imports_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_statement_transactions" ADD CONSTRAINT "bank_statement_transactions_import_id_bank_statement_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."bank_statement_imports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_statement_transactions" ADD CONSTRAINT "bank_statement_transactions_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_statement_transactions" ADD CONSTRAINT "bank_statement_transactions_matched_ledger_entry_id_owner_ledger_entries_id_fk" FOREIGN KEY ("matched_ledger_entry_id") REFERENCES "public"."owner_ledger_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_package_templates" ADD CONSTRAINT "board_package_templates_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_packages" ADD CONSTRAINT "board_packages_template_id_board_package_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."board_package_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_packages" ADD CONSTRAINT "board_packages_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_packages" ADD CONSTRAINT "board_packages_meeting_id_governance_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."governance_meetings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_roles" ADD CONSTRAINT "board_roles_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_roles" ADD CONSTRAINT "board_roles_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_budget_version_id_budget_versions_id_fk" FOREIGN KEY ("budget_version_id") REFERENCES "public"."budget_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_account_id_financial_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_category_id_financial_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."financial_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_versions" ADD CONSTRAINT "budget_versions_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clause_records" ADD CONSTRAINT "clause_records_ingestion_job_id_ai_ingestion_jobs_id_fk" FOREIGN KEY ("ingestion_job_id") REFERENCES "public"."ai_ingestion_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clause_records" ADD CONSTRAINT "clause_records_extracted_record_id_ai_extracted_records_id_fk" FOREIGN KEY ("extracted_record_id") REFERENCES "public"."ai_extracted_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clause_records" ADD CONSTRAINT "clause_records_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clause_records" ADD CONSTRAINT "clause_records_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clause_tags" ADD CONSTRAINT "clause_tags_clause_record_id_clause_records_id_fk" FOREIGN KEY ("clause_record_id") REFERENCES "public"."clause_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections_handoffs" ADD CONSTRAINT "collections_handoffs_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections_handoffs" ADD CONSTRAINT "collections_handoffs_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections_handoffs" ADD CONSTRAINT "collections_handoffs_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_history" ADD CONSTRAINT "communication_history_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_history" ADD CONSTRAINT "communication_history_recipient_person_id_persons_id_fk" FOREIGN KEY ("recipient_person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_announcements" ADD CONSTRAINT "community_announcements_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_alert_overrides" ADD CONSTRAINT "compliance_alert_overrides_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_alert_overrides" ADD CONSTRAINT "compliance_alert_overrides_template_id_governance_compliance_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."governance_compliance_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_alert_overrides" ADD CONSTRAINT "compliance_alert_overrides_template_item_id_governance_template_items_id_fk" FOREIGN KEY ("template_item_id") REFERENCES "public"."governance_template_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_update_requests" ADD CONSTRAINT "contact_update_requests_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_update_requests" ADD CONSTRAINT "contact_update_requests_portal_access_id_portal_access_id_fk" FOREIGN KEY ("portal_access_id") REFERENCES "public"."portal_access"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_update_requests" ADD CONSTRAINT "contact_update_requests_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delinquency_escalations" ADD CONSTRAINT "delinquency_escalations_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delinquency_escalations" ADD CONSTRAINT "delinquency_escalations_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delinquency_escalations" ADD CONSTRAINT "delinquency_escalations_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delinquency_thresholds" ADD CONSTRAINT "delinquency_thresholds_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delinquency_thresholds" ADD CONSTRAINT "delinquency_thresholds_notice_template_id_notice_templates_id_fk" FOREIGN KEY ("notice_template_id") REFERENCES "public"."notice_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_tags" ADD CONSTRAINT "document_tags_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_ballot_casts" ADD CONSTRAINT "election_ballot_casts_election_id_elections_id_fk" FOREIGN KEY ("election_id") REFERENCES "public"."elections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_ballot_casts" ADD CONSTRAINT "election_ballot_casts_ballot_token_id_election_ballot_tokens_id_fk" FOREIGN KEY ("ballot_token_id") REFERENCES "public"."election_ballot_tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_ballot_casts" ADD CONSTRAINT "election_ballot_casts_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_ballot_casts" ADD CONSTRAINT "election_ballot_casts_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_ballot_casts" ADD CONSTRAINT "election_ballot_casts_proxy_for_person_id_persons_id_fk" FOREIGN KEY ("proxy_for_person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_ballot_casts" ADD CONSTRAINT "election_ballot_casts_proxy_for_unit_id_units_id_fk" FOREIGN KEY ("proxy_for_unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_ballot_tokens" ADD CONSTRAINT "election_ballot_tokens_election_id_elections_id_fk" FOREIGN KEY ("election_id") REFERENCES "public"."elections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_ballot_tokens" ADD CONSTRAINT "election_ballot_tokens_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_ballot_tokens" ADD CONSTRAINT "election_ballot_tokens_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_options" ADD CONSTRAINT "election_options_election_id_elections_id_fk" FOREIGN KEY ("election_id") REFERENCES "public"."elections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_options" ADD CONSTRAINT "election_options_nominated_by_person_id_persons_id_fk" FOREIGN KEY ("nominated_by_person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_proxy_designations" ADD CONSTRAINT "election_proxy_designations_election_id_elections_id_fk" FOREIGN KEY ("election_id") REFERENCES "public"."elections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_proxy_designations" ADD CONSTRAINT "election_proxy_designations_owner_person_id_persons_id_fk" FOREIGN KEY ("owner_person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_proxy_designations" ADD CONSTRAINT "election_proxy_designations_owner_unit_id_units_id_fk" FOREIGN KEY ("owner_unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_proxy_designations" ADD CONSTRAINT "election_proxy_designations_proxy_person_id_persons_id_fk" FOREIGN KEY ("proxy_person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_proxy_documents" ADD CONSTRAINT "election_proxy_documents_election_id_elections_id_fk" FOREIGN KEY ("election_id") REFERENCES "public"."elections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_proxy_documents" ADD CONSTRAINT "election_proxy_documents_owner_person_id_persons_id_fk" FOREIGN KEY ("owner_person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_proxy_documents" ADD CONSTRAINT "election_proxy_documents_owner_unit_id_units_id_fk" FOREIGN KEY ("owner_unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elections" ADD CONSTRAINT "elections_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elections" ADD CONSTRAINT "elections_meeting_id_governance_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."governance_meetings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_email_log_id_email_logs_id_fk" FOREIGN KEY ("email_log_id") REFERENCES "public"."email_logs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_executive_evidence" ADD CONSTRAINT "admin_executive_evidence_executive_update_id_admin_executive_updates_id_fk" FOREIGN KEY ("executive_update_id") REFERENCES "public"."admin_executive_updates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_executive_updates" ADD CONSTRAINT "admin_executive_updates_project_id_admin_roadmap_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."admin_roadmap_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_executive_updates" ADD CONSTRAINT "admin_executive_updates_workstream_id_admin_roadmap_workstreams_id_fk" FOREIGN KEY ("workstream_id") REFERENCES "public"."admin_roadmap_workstreams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_executive_updates" ADD CONSTRAINT "admin_executive_updates_task_id_admin_roadmap_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."admin_roadmap_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_attachments" ADD CONSTRAINT "expense_attachments_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_alerts" ADD CONSTRAINT "financial_alerts_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_approvals" ADD CONSTRAINT "financial_approvals_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_approvals" ADD CONSTRAINT "financial_approvals_approver_id_admin_users_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_categories" ADD CONSTRAINT "financial_categories_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "governance_compliance_templates" ADD CONSTRAINT "governance_compliance_templates_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "governance_compliance_templates" ADD CONSTRAINT "governance_compliance_templates_base_template_id_governance_compliance_templates_id_fk" FOREIGN KEY ("base_template_id") REFERENCES "public"."governance_compliance_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "governance_meetings" ADD CONSTRAINT "governance_meetings_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "governance_reminder_rules" ADD CONSTRAINT "governance_reminder_rules_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "governance_template_items" ADD CONSTRAINT "governance_template_items_template_id_governance_compliance_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."governance_compliance_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hoa_fee_schedules" ADD CONSTRAINT "hoa_fee_schedules_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_action_links" ADD CONSTRAINT "hub_action_links_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_info_blocks" ADD CONSTRAINT "hub_info_blocks_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_map_issues" ADD CONSTRAINT "hub_map_issues_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_map_issues" ADD CONSTRAINT "hub_map_issues_map_node_id_hub_map_nodes_id_fk" FOREIGN KEY ("map_node_id") REFERENCES "public"."hub_map_nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_map_issues" ADD CONSTRAINT "hub_map_issues_layer_id_hub_map_layers_id_fk" FOREIGN KEY ("layer_id") REFERENCES "public"."hub_map_layers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_map_issues" ADD CONSTRAINT "hub_map_issues_reported_by_portal_access_id_portal_access_id_fk" FOREIGN KEY ("reported_by_portal_access_id") REFERENCES "public"."portal_access"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_map_layers" ADD CONSTRAINT "hub_map_layers_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_map_nodes" ADD CONSTRAINT "hub_map_nodes_layer_id_hub_map_layers_id_fk" FOREIGN KEY ("layer_id") REFERENCES "public"."hub_map_layers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_map_nodes" ADD CONSTRAINT "hub_map_nodes_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_map_nodes" ADD CONSTRAINT "hub_map_nodes_linked_building_id_buildings_id_fk" FOREIGN KEY ("linked_building_id") REFERENCES "public"."buildings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_map_nodes" ADD CONSTRAINT "hub_map_nodes_linked_unit_id_units_id_fk" FOREIGN KEY ("linked_unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_page_configs" ADD CONSTRAINT "hub_page_configs_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_records" ADD CONSTRAINT "inspection_records_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_records" ADD CONSTRAINT "inspection_records_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "late_fee_events" ADD CONSTRAINT "late_fee_events_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "late_fee_events" ADD CONSTRAINT "late_fee_events_rule_id_late_fee_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."late_fee_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "late_fee_rules" ADD CONSTRAINT "late_fee_rules_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_submitted_by_person_id_persons_id_fk" FOREIGN KEY ("submitted_by_person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_submitted_by_portal_access_id_portal_access_id_fk" FOREIGN KEY ("submitted_by_portal_access_id") REFERENCES "public"."portal_access"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_schedule_instances" ADD CONSTRAINT "maintenance_schedule_instances_template_id_maintenance_schedule_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."maintenance_schedule_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_schedule_instances" ADD CONSTRAINT "maintenance_schedule_instances_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_schedule_instances" ADD CONSTRAINT "maintenance_schedule_instances_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_schedule_instances" ADD CONSTRAINT "maintenance_schedule_instances_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_schedule_instances" ADD CONSTRAINT "maintenance_schedule_instances_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_schedule_templates" ADD CONSTRAINT "maintenance_schedule_templates_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_schedule_templates" ADD CONSTRAINT "maintenance_schedule_templates_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_schedule_templates" ADD CONSTRAINT "maintenance_schedule_templates_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_agenda_items" ADD CONSTRAINT "meeting_agenda_items_meeting_id_governance_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."governance_meetings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_notes" ADD CONSTRAINT "meeting_notes_meeting_id_governance_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."governance_meetings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_sends" ADD CONSTRAINT "notice_sends_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_sends" ADD CONSTRAINT "notice_sends_template_id_notice_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."notice_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_sends" ADD CONSTRAINT "notice_sends_recipient_person_id_persons_id_fk" FOREIGN KEY ("recipient_person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_templates" ADD CONSTRAINT "notice_templates_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupancies" ADD CONSTRAINT "occupancies_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupancies" ADD CONSTRAINT "occupancies_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_invites" ADD CONSTRAINT "onboarding_invites_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_invites" ADD CONSTRAINT "onboarding_invites_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_submissions" ADD CONSTRAINT "onboarding_submissions_invite_id_onboarding_invites_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."onboarding_invites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_submissions" ADD CONSTRAINT "onboarding_submissions_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_submissions" ADD CONSTRAINT "onboarding_submissions_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_submissions" ADD CONSTRAINT "onboarding_submissions_created_person_id_persons_id_fk" FOREIGN KEY ("created_person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_submissions" ADD CONSTRAINT "onboarding_submissions_created_occupancy_id_occupancies_id_fk" FOREIGN KEY ("created_occupancy_id") REFERENCES "public"."occupancies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_submissions" ADD CONSTRAINT "onboarding_submissions_created_ownership_id_ownerships_id_fk" FOREIGN KEY ("created_ownership_id") REFERENCES "public"."ownerships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_ledger_entries" ADD CONSTRAINT "owner_ledger_entries_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_ledger_entries" ADD CONSTRAINT "owner_ledger_entries_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_ledger_entries" ADD CONSTRAINT "owner_ledger_entries_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_payment_links" ADD CONSTRAINT "owner_payment_links_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_payment_links" ADD CONSTRAINT "owner_payment_links_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_payment_links" ADD CONSTRAINT "owner_payment_links_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ownerships" ADD CONSTRAINT "ownerships_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ownerships" ADD CONSTRAINT "ownerships_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partial_payment_rules" ADD CONSTRAINT "partial_payment_rules_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_event_transitions" ADD CONSTRAINT "payment_event_transitions_webhook_event_id_payment_webhook_events_id_fk" FOREIGN KEY ("webhook_event_id") REFERENCES "public"."payment_webhook_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_gateway_connections" ADD CONSTRAINT "payment_gateway_connections_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_method_configs" ADD CONSTRAINT "payment_method_configs_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_plans" ADD CONSTRAINT "payment_plans_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_plans" ADD CONSTRAINT "payment_plans_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_plans" ADD CONSTRAINT "payment_plans_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reminder_rules" ADD CONSTRAINT "payment_reminder_rules_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reminder_rules" ADD CONSTRAINT "payment_reminder_rules_template_id_notice_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."notice_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_webhook_events" ADD CONSTRAINT "payment_webhook_events_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_webhook_events" ADD CONSTRAINT "payment_webhook_events_payment_link_id_owner_payment_links_id_fk" FOREIGN KEY ("payment_link_id") REFERENCES "public"."owner_payment_links"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_webhook_events" ADD CONSTRAINT "payment_webhook_events_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_webhook_events" ADD CONSTRAINT "payment_webhook_events_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_change_logs" ADD CONSTRAINT "permission_change_logs_user_id_admin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_envelopes" ADD CONSTRAINT "permission_envelopes_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_contact_points" ADD CONSTRAINT "person_contact_points_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_contact_points" ADD CONSTRAINT "person_contact_points_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persons" ADD CONSTRAINT "persons_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_subscriptions" ADD CONSTRAINT "platform_subscriptions_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_access" ADD CONSTRAINT "portal_access_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_access" ADD CONSTRAINT "portal_access_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_access" ADD CONSTRAINT "portal_access_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_access" ADD CONSTRAINT "portal_access_board_role_id_board_roles_id_fk" FOREIGN KEY ("board_role_id") REFERENCES "public"."board_roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_login_tokens" ADD CONSTRAINT "portal_login_tokens_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_portal_access_id_portal_access_id_fk" FOREIGN KEY ("portal_access_id") REFERENCES "public"."portal_access"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_periods" ADD CONSTRAINT "reconciliation_periods_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_periods" ADD CONSTRAINT "reconciliation_periods_import_id_bank_statement_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."bank_statement_imports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_charge_runs" ADD CONSTRAINT "recurring_charge_runs_schedule_id_recurring_charge_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."recurring_charge_schedules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_charge_runs" ADD CONSTRAINT "recurring_charge_runs_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_charge_runs" ADD CONSTRAINT "recurring_charge_runs_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_charge_runs" ADD CONSTRAINT "recurring_charge_runs_ledger_entry_id_owner_ledger_entries_id_fk" FOREIGN KEY ("ledger_entry_id") REFERENCES "public"."owner_ledger_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_charge_schedules" ADD CONSTRAINT "recurring_charge_schedules_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_charge_schedules" ADD CONSTRAINT "recurring_charge_schedules_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resident_feedbacks" ADD CONSTRAINT "resident_feedbacks_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resident_feedbacks" ADD CONSTRAINT "resident_feedbacks_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resident_feedbacks" ADD CONSTRAINT "resident_feedbacks_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resolutions" ADD CONSTRAINT "resolutions_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resolutions" ADD CONSTRAINT "resolutions_meeting_id_governance_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."governance_meetings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_roadmap_task_attachments" ADD CONSTRAINT "admin_roadmap_task_attachments_task_id_admin_roadmap_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."admin_roadmap_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_roadmap_tasks" ADD CONSTRAINT "admin_roadmap_tasks_project_id_admin_roadmap_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."admin_roadmap_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_roadmap_tasks" ADD CONSTRAINT "admin_roadmap_tasks_workstream_id_admin_roadmap_workstreams_id_fk" FOREIGN KEY ("workstream_id") REFERENCES "public"."admin_roadmap_workstreams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_roadmap_workstreams" ADD CONSTRAINT "admin_roadmap_workstreams_project_id_admin_roadmap_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."admin_roadmap_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_payment_methods" ADD CONSTRAINT "saved_payment_methods_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_payment_methods" ADD CONSTRAINT "saved_payment_methods_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_delivery_logs" ADD CONSTRAINT "sms_delivery_logs_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_delivery_logs" ADD CONSTRAINT "sms_delivery_logs_recipient_person_id_persons_id_fk" FOREIGN KEY ("recipient_person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "special_assessments" ADD CONSTRAINT "special_assessments_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggested_links" ADD CONSTRAINT "suggested_links_clause_record_id_clause_records_id_fk" FOREIGN KEY ("clause_record_id") REFERENCES "public"."clause_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_configs" ADD CONSTRAINT "tenant_configs_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_change_history" ADD CONSTRAINT "unit_change_history_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utility_payments" ADD CONSTRAINT "utility_payments_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utility_payments" ADD CONSTRAINT "utility_payments_account_id_financial_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utility_payments" ADD CONSTRAINT "utility_payments_category_id_financial_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."financial_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_invoices" ADD CONSTRAINT "vendor_invoices_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_invoices" ADD CONSTRAINT "vendor_invoices_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_invoices" ADD CONSTRAINT "vendor_invoices_account_id_financial_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_invoices" ADD CONSTRAINT "vendor_invoices_category_id_financial_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."financial_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_portal_credentials" ADD CONSTRAINT "vendor_portal_credentials_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_portal_credentials" ADD CONSTRAINT "vendor_portal_credentials_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_portal_login_tokens" ADD CONSTRAINT "vendor_portal_login_tokens_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_work_order_activity" ADD CONSTRAINT "vendor_work_order_activity_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_work_order_activity" ADD CONSTRAINT "vendor_work_order_activity_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_work_order_activity" ADD CONSTRAINT "vendor_work_order_activity_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_answers" ADD CONSTRAINT "vote_answers_ballot_id_vote_ballots_id_fk" FOREIGN KEY ("ballot_id") REFERENCES "public"."vote_ballots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_answers" ADD CONSTRAINT "vote_answers_question_id_vote_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."vote_questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_ballots" ADD CONSTRAINT "vote_ballots_campaign_id_vote_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."vote_campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_ballots" ADD CONSTRAINT "vote_ballots_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_ballots" ADD CONSTRAINT "vote_ballots_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_ballots" ADD CONSTRAINT "vote_ballots_proxy_person_id_persons_id_fk" FOREIGN KEY ("proxy_person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_campaigns" ADD CONSTRAINT "vote_campaigns_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_questions" ADD CONSTRAINT "vote_questions_campaign_id_vote_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."vote_campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_records" ADD CONSTRAINT "vote_records_resolution_id_resolutions_id_fk" FOREIGN KEY ("resolution_id") REFERENCES "public"."resolutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_records" ADD CONSTRAINT "vote_records_voter_person_id_persons_id_fk" FOREIGN KEY ("voter_person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_signing_secrets" ADD CONSTRAINT "webhook_signing_secrets_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_maintenance_request_id_maintenance_requests_id_fk" FOREIGN KEY ("maintenance_request_id") REFERENCES "public"."maintenance_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_vendor_invoice_id_vendor_invoices_id_fk" FOREIGN KEY ("vendor_invoice_id") REFERENCES "public"."vendor_invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_association_scopes_unique_uq" ON "admin_association_scopes" USING btree ("admin_user_id","association_id");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_user_prefs_admin_uq" ON "admin_user_preferences" USING btree ("admin_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_users_email_uq" ON "admin_users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "assoc_ingestion_correction_memory_uq" ON "association_ingestion_correction_memory" USING btree ("association_id","record_type","correction_key");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_external_accounts_provider_account_uq" ON "auth_external_accounts" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_users_email_uq" ON "auth_users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "budget_versions_budget_version_uq" ON "budget_versions" USING btree ("budget_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "buildings_association_name_uq" ON "buildings" USING btree ("association_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "document_tags_unique_uq" ON "document_tags" USING btree ("document_id","entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "document_versions_document_version_uq" ON "document_versions" USING btree ("document_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "election_ballot_casts_token_uq" ON "election_ballot_casts" USING btree ("ballot_token_id");--> statement-breakpoint
CREATE UNIQUE INDEX "election_ballot_tokens_election_token_uq" ON "election_ballot_tokens" USING btree ("election_id","token");--> statement-breakpoint
CREATE UNIQUE INDEX "election_ballot_tokens_election_person_uq" ON "election_ballot_tokens" USING btree ("election_id","person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "election_proxy_designations_election_owner_uq" ON "election_proxy_designations" USING btree ("election_id","owner_person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_executive_updates_source_key_uq" ON "admin_executive_updates" USING btree ("source_key");--> statement-breakpoint
CREATE UNIQUE INDEX "hub_page_configs_association_uq" ON "hub_page_configs" USING btree ("association_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hub_page_configs_slug_uq" ON "hub_page_configs" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "onboarding_invites_token_uq" ON "onboarding_invites" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "owner_payment_links_token_uq" ON "owner_payment_links" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "partial_payment_rules_assoc_uq" ON "partial_payment_rules" USING btree ("association_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_gateway_connections_assoc_provider_uq" ON "payment_gateway_connections" USING btree ("association_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_webhook_events_assoc_provider_event_uq" ON "payment_webhook_events" USING btree ("association_id","provider","provider_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "person_contact_points_person_channel_value_uq" ON "person_contact_points" USING btree ("person_id","channel","normalized_value");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_subscriptions_association_uq" ON "platform_subscriptions" USING btree ("association_id");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_webhook_events_provider_event_uq" ON "platform_webhook_events" USING btree ("provider","provider_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "portal_access_assoc_email_unit_uq" ON "portal_access" USING btree ("association_id","email",COALESCE("unit_id", ''));--> statement-breakpoint
CREATE UNIQUE INDEX "push_subscriptions_endpoint_uq" ON "push_subscriptions" USING btree ("endpoint");--> statement-breakpoint
CREATE UNIQUE INDEX "suggested_links_unique_uq" ON "suggested_links" USING btree ("clause_record_id","entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_configs_association_uq" ON "tenant_configs" USING btree ("association_id");--> statement-breakpoint
CREATE UNIQUE INDEX "units_association_building_unit_number_uq" ON "units" USING btree ("association_id","building_id","unit_number");--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_portal_credentials_vendor_email_uq" ON "vendor_portal_credentials" USING btree ("vendor_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "vendors_association_name_uq" ON "vendors" USING btree ("association_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_signing_secrets_assoc_provider_uq" ON "webhook_signing_secrets" USING btree ("association_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "work_orders_request_uq" ON "work_orders" USING btree ("maintenance_request_id");