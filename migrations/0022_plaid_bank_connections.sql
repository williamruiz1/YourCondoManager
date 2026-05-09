-- Migration: Add Plaid bank-feed tables
-- Context: Bank-feed reconciliation layer (bank_connections, bank_accounts,
--   bank_transactions). All three tables are scoped per-association for
--   multi-tenant isolation. bank_connections stores Plaid item credentials
--   with the access_token encrypted at rest (accessTokenEncrypted column).
-- Spec: PLAID-SETUP-FOR-YCM-2026-05-07.md

-- Enum for bank connection health state
CREATE TYPE "public"."bank_connection_status" AS ENUM('active', 'needs_reauth', 'revoked', 'error');--> statement-breakpoint

-- One row per institution link (Plaid item) per association.
CREATE TABLE "bank_connections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"provider" text NOT NULL,
	"provider_item_id" text NOT NULL,
	"access_token_encrypted" text NOT NULL,
	"institution_name" text,
	"status" "bank_connection_status" DEFAULT 'active' NOT NULL,
	"connected_by_user_id" varchar,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "bank_connections" ADD CONSTRAINT "bank_connections_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- One row per bank account under a connection.
CREATE TABLE "bank_accounts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_connection_id" varchar NOT NULL,
	"association_id" varchar NOT NULL,
	"provider_account_id" text NOT NULL,
	"name" text NOT NULL,
	"mask" text,
	"type" text NOT NULL,
	"subtype" text,
	"current_balance_cents" integer,
	"available_balance_cents" integer,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_bank_connection_id_bank_connections_id_fk" FOREIGN KEY ("bank_connection_id") REFERENCES "public"."bank_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- Transaction feed; reconciles to payment_transactions.
CREATE TABLE "bank_transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_account_id" varchar NOT NULL,
	"association_id" varchar NOT NULL,
	"provider_transaction_id" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"iso_currency_code" text DEFAULT 'USD' NOT NULL,
	"date" date NOT NULL,
	"name" text NOT NULL,
	"merchant_name" text,
	"category" text,
	"pending" integer DEFAULT 0 NOT NULL,
	"reconciled_to_payment_transaction_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bank_transactions_provider_transaction_id_unique" UNIQUE("provider_transaction_id")
);--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_reconciled_to_payment_transaction_id_payment_transactions_id_fk" FOREIGN KEY ("reconciled_to_payment_transaction_id") REFERENCES "public"."payment_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
