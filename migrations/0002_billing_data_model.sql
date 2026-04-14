-- Phase 0: Billing data model foundation
-- Adds plan_catalog, billing_accounts, billing_subscriptions,
-- billing_subscription_items, signup_plan_selections tables.
-- Also adds unit_count column to existing platform_subscriptions.

-- New enums
CREATE TYPE "public"."billing_account_type" AS ENUM('self_managed', 'property_manager');--> statement-breakpoint
CREATE TYPE "public"."plan_catalog_status" AS ENUM('draft', 'active', 'retired');--> statement-breakpoint
CREATE TYPE "public"."pricing_model" AS ENUM('flat_per_association', 'per_complex', 'enterprise_manual');--> statement-breakpoint
CREATE TYPE "public"."billing_account_status" AS ENUM('draft', 'trialing', 'active', 'past_due', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."billing_interval" AS ENUM('monthly', 'annual');--> statement-breakpoint
CREATE TYPE "public"."billing_subscription_status" AS ENUM('pending', 'active', 'past_due', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."signup_plan_selection_status" AS ENUM('draft', 'resolved', 'converted', 'abandoned');--> statement-breakpoint

-- plan_catalog
CREATE TABLE "plan_catalog" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_key" text NOT NULL,
	"account_type" "billing_account_type" NOT NULL,
	"display_name" text NOT NULL,
	"status" "plan_catalog_status" DEFAULT 'draft' NOT NULL,
	"pricing_model" "pricing_model" NOT NULL,
	"unit_min" integer,
	"unit_max" integer,
	"currency" text DEFAULT 'USD' NOT NULL,
	"billing_frequency_supported" jsonb DEFAULT '["monthly"]'::jsonb NOT NULL,
	"monthly_amount_cents" integer,
	"annual_effective_monthly_cents" integer,
	"annual_billed_amount_cents" integer,
	"recommended_in_signup" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"effective_from" timestamp NOT NULL,
	"effective_to" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "plan_catalog_plan_key_uq" ON "plan_catalog" USING btree ("plan_key");--> statement-breakpoint

-- billing_accounts
CREATE TABLE "billing_accounts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_type" "billing_account_type" NOT NULL,
	"association_id" varchar,
	"billing_status" "billing_account_status" DEFAULT 'draft' NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"provider" text,
	"provider_customer_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "billing_accounts" ADD CONSTRAINT "billing_accounts_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- billing_subscriptions
CREATE TABLE "billing_subscriptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"billing_account_id" varchar NOT NULL,
	"plan_catalog_id" varchar,
	"pricing_version" integer DEFAULT 1 NOT NULL,
	"billing_interval" "billing_interval" DEFAULT 'monthly' NOT NULL,
	"price_snapshot_cents" integer,
	"price_snapshot_json" jsonb,
	"status" "billing_subscription_status" DEFAULT 'pending' NOT NULL,
	"started_at" timestamp NOT NULL,
	"ended_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_billing_account_id_billing_accounts_id_fk" FOREIGN KEY ("billing_account_id") REFERENCES "public"."billing_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_plan_catalog_id_plan_catalog_id_fk" FOREIGN KEY ("plan_catalog_id") REFERENCES "public"."plan_catalog"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- billing_subscription_items
CREATE TABLE "billing_subscription_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"billing_subscription_id" varchar NOT NULL,
	"association_id" varchar,
	"plan_key" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_amount_cents" integer,
	"line_total_cents" integer,
	"pricing_snapshot_json" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "billing_subscription_items" ADD CONSTRAINT "billing_subscription_items_billing_subscription_id_billing_subscriptions_id_fk" FOREIGN KEY ("billing_subscription_id") REFERENCES "public"."billing_subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_subscription_items" ADD CONSTRAINT "billing_subscription_items_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- signup_plan_selections
CREATE TABLE "signup_plan_selections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"signup_session_id" varchar NOT NULL,
	"account_type" "billing_account_type" NOT NULL,
	"association_unit_count" integer,
	"pm_complex_count" integer,
	"pm_complex_snapshot_json" jsonb,
	"resolved_plan_catalog_id" varchar,
	"resolved_pricing_json" jsonb,
	"billing_interval" "billing_interval",
	"status" "signup_plan_selection_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "signup_plan_selections" ADD CONSTRAINT "signup_plan_selections_resolved_plan_catalog_id_plan_catalog_id_fk" FOREIGN KEY ("resolved_plan_catalog_id") REFERENCES "public"."plan_catalog"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- Add unit_count to existing platform_subscriptions (addendum task 6)
ALTER TABLE "platform_subscriptions" ADD COLUMN "unit_count" integer;
