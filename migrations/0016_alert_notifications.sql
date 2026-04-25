-- Migration: 4.1 Tier 3 (Wave 32) — alert push + email notifications.
-- Spec: docs/projects/platform-overhaul/decisions/4.1-tier-3-notifications.md
--
-- Adds:
--   1. notify_alerts_email / notify_alerts_push columns on
--      admin_user_preferences (per-user opt-in toggles for severity:'critical'
--      out-of-band fan-out).
--   2. alert_notifications table (dedup + status tracking, rate-limit index).
--   3. admin_push_subscriptions table (operator-side parallel to portal
--      push_subscriptions which is keyed on portal_access_id).
--
-- Backwards-compat: all new columns default-have safe values (email opt-in
-- ON, push opt-in OFF). Existing rows stay valid without UPDATE.

ALTER TABLE "admin_user_preferences"
  ADD COLUMN IF NOT EXISTS "notify_alerts_email" integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE "admin_user_preferences"
  ADD COLUMN IF NOT EXISTS "notify_alerts_push" integer NOT NULL DEFAULT 0;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "alert_notifications" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "alert_id" text NOT NULL,
  "admin_user_id" varchar NOT NULL,
  "channel" text NOT NULL,
  "delivery_status" text NOT NULL,
  "error_message" text,
  "sent_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "alert_notifications_admin_user_id_admin_users_id_fk"
    FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "alert_notifications_alert_admin_channel_uq"
  ON "alert_notifications" ("alert_id", "admin_user_id", "channel");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "alert_notifications_admin_sent_at_idx"
  ON "alert_notifications" ("admin_user_id", "sent_at");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "admin_push_subscriptions" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "admin_user_id" varchar NOT NULL,
  "endpoint" text NOT NULL,
  "p256dh_key" text NOT NULL,
  "auth_key" text NOT NULL,
  "user_agent" text,
  "is_active" integer NOT NULL DEFAULT 1,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "admin_push_subscriptions_admin_user_id_admin_users_id_fk"
    FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "admin_push_subscriptions_endpoint_uq"
  ON "admin_push_subscriptions" ("endpoint");
