-- Phase 3: Delinquency, Retries, and Aging Visibility

-- New enums
CREATE TYPE "public"."failure_category" AS ENUM('soft', 'hard', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."delinquency_notice_stage" AS ENUM(
  'payment_failed_notice', 'delinquency_notice_1', 'delinquency_notice_2', 'final_notice'
);--> statement-breakpoint
CREATE TYPE "public"."delinquency_notice_status" AS ENUM(
  'queued', 'sent', 'skipped', 'failed'
);--> statement-breakpoint

-- payment_transactions: retry columns
ALTER TABLE "payment_transactions"
  ADD COLUMN "attempt_number" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_transactions"
  ADD COLUMN "retry_of_transaction_id" varchar;--> statement-breakpoint
ALTER TABLE "payment_transactions"
  ADD COLUMN "failure_category" "failure_category";--> statement-breakpoint
ALTER TABLE "payment_transactions"
  ADD COLUMN "retry_eligible" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_transactions"
  ADD COLUMN "next_retry_at" timestamp;--> statement-breakpoint

-- delinquency_settings table
CREATE TABLE "delinquency_settings" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "association_id" varchar,
  "grace_period_days" integer DEFAULT 15 NOT NULL,
  "bucket_boundaries_json" jsonb DEFAULT '[30,60,90]'::jsonb NOT NULL,
  "max_retry_attempts" integer DEFAULT 3 NOT NULL,
  "retry_schedule_json" jsonb DEFAULT '[3,7,14]'::jsonb NOT NULL,
  "notice_stages_json" jsonb,
  "auto_late_fee_enabled" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "delinquency_settings"
  ADD CONSTRAINT "delinquency_settings_association_id_fk"
  FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id")
  ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- delinquency_notices table
CREATE TABLE "delinquency_notices" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "association_id" varchar NOT NULL,
  "person_id" varchar NOT NULL,
  "unit_id" varchar NOT NULL,
  "notice_stage" "delinquency_notice_stage" NOT NULL,
  "trigger_days_past_due" integer NOT NULL,
  "amount_owed_cents" integer NOT NULL,
  "escalation_id" varchar,
  "notice_send_id" varchar,
  "status" "delinquency_notice_status" DEFAULT 'queued' NOT NULL,
  "delinquency_period_key" text NOT NULL,
  "payload_snapshot_json" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE UNIQUE INDEX "delinquency_notices_dedup_uq"
  ON "delinquency_notices" ("association_id", "person_id", "unit_id", "notice_stage", "delinquency_period_key");--> statement-breakpoint

ALTER TABLE "delinquency_notices"
  ADD CONSTRAINT "delinquency_notices_association_id_fk"
  FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id")
  ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delinquency_notices"
  ADD CONSTRAINT "delinquency_notices_person_id_fk"
  FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id")
  ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delinquency_notices"
  ADD CONSTRAINT "delinquency_notices_unit_id_fk"
  FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id")
  ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delinquency_notices"
  ADD CONSTRAINT "delinquency_notices_escalation_id_fk"
  FOREIGN KEY ("escalation_id") REFERENCES "public"."delinquency_escalations"("id")
  ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delinquency_notices"
  ADD CONSTRAINT "delinquency_notices_notice_send_id_fk"
  FOREIGN KEY ("notice_send_id") REFERENCES "public"."notice_sends"("id")
  ON DELETE no action ON UPDATE no action;
