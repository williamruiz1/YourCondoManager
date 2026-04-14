-- Phase 2: Saved Payment Methods + Autopay charging

-- New enums
CREATE TYPE "public"."saved_payment_method_status" AS ENUM(
  'pending_verification', 'active', 'inactive', 'revoked', 'failed'
);--> statement-breakpoint
CREATE TYPE "public"."payment_transaction_source" AS ENUM(
  'owner_initiated', 'autopay'
);--> statement-breakpoint

-- saved_payment_methods: provider fields + status
ALTER TABLE "saved_payment_methods"
  ADD COLUMN "provider" "payment_gateway_provider" DEFAULT 'stripe' NOT NULL;--> statement-breakpoint
ALTER TABLE "saved_payment_methods"
  ADD COLUMN "provider_customer_id" text;--> statement-breakpoint
ALTER TABLE "saved_payment_methods"
  ADD COLUMN "provider_payment_method_id" text;--> statement-breakpoint
ALTER TABLE "saved_payment_methods"
  ADD COLUMN "status" "saved_payment_method_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "saved_payment_methods"
  ADD COLUMN "verified_at" timestamp;--> statement-breakpoint

-- autopay_enrollments: link to saved payment method
ALTER TABLE "autopay_enrollments"
  ADD COLUMN "payment_method_id" varchar;--> statement-breakpoint
ALTER TABLE "autopay_enrollments"
  ADD CONSTRAINT "autopay_enrollments_payment_method_id_fk"
  FOREIGN KEY ("payment_method_id") REFERENCES "public"."saved_payment_methods"("id")
  ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- autopay_runs: link to payment_transaction
ALTER TABLE "autopay_runs"
  ADD COLUMN "payment_transaction_id" varchar;--> statement-breakpoint
ALTER TABLE "autopay_runs"
  ADD CONSTRAINT "autopay_runs_payment_transaction_id_fk"
  FOREIGN KEY ("payment_transaction_id") REFERENCES "public"."payment_transactions"("id")
  ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- payment_transactions: source, method link, enrollment link, off-session flag
ALTER TABLE "payment_transactions"
  ADD COLUMN "source" "payment_transaction_source" DEFAULT 'owner_initiated' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_transactions"
  ADD COLUMN "payment_method_id" varchar;--> statement-breakpoint
ALTER TABLE "payment_transactions"
  ADD CONSTRAINT "payment_transactions_payment_method_id_fk"
  FOREIGN KEY ("payment_method_id") REFERENCES "public"."saved_payment_methods"("id")
  ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions"
  ADD COLUMN "autopay_enrollment_id" varchar;--> statement-breakpoint
ALTER TABLE "payment_transactions"
  ADD CONSTRAINT "payment_transactions_autopay_enrollment_id_fk"
  FOREIGN KEY ("autopay_enrollment_id") REFERENCES "public"."autopay_enrollments"("id")
  ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions"
  ADD COLUMN "is_off_session" integer DEFAULT 0 NOT NULL;
