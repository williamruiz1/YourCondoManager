-- Phase 1A: Owner Payment Portal — payment_transactions table
-- Tracks each ACH payment attempt from initiation through async Stripe confirmation.

CREATE TYPE "public"."payment_transaction_status" AS ENUM(
  'draft', 'initiated', 'pending', 'succeeded', 'failed', 'canceled', 'reversed'
);--> statement-breakpoint

CREATE TABLE "payment_transactions" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "association_id" varchar NOT NULL,
  "unit_id" varchar NOT NULL,
  "person_id" varchar NOT NULL,
  "billing_account_id" varchar,
  "amount_cents" integer NOT NULL,
  "currency" text DEFAULT 'USD' NOT NULL,
  "status" "payment_transaction_status" DEFAULT 'draft' NOT NULL,
  "provider" "payment_gateway_provider" DEFAULT 'stripe' NOT NULL,
  "provider_payment_id" text,
  "provider_intent_id" text,
  "provider_customer_id" text,
  "description" text,
  "receipt_reference" text,
  "failure_code" text,
  "failure_reason" text,
  "submitted_at" timestamp,
  "confirmed_at" timestamp,
  "failed_at" timestamp,
  "metadata_json" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE UNIQUE INDEX "payment_transactions_receipt_ref_uq"
  ON "payment_transactions" USING btree ("receipt_reference")
  WHERE receipt_reference IS NOT NULL;--> statement-breakpoint

ALTER TABLE "payment_transactions"
  ADD CONSTRAINT "payment_transactions_association_id_fk"
  FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id")
  ON DELETE no action ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "payment_transactions"
  ADD CONSTRAINT "payment_transactions_unit_id_fk"
  FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id")
  ON DELETE no action ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "payment_transactions"
  ADD CONSTRAINT "payment_transactions_person_id_fk"
  FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id")
  ON DELETE no action ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "payment_transactions"
  ADD CONSTRAINT "payment_transactions_billing_account_id_fk"
  FOREIGN KEY ("billing_account_id") REFERENCES "public"."billing_accounts"("id")
  ON DELETE no action ON UPDATE no action;
