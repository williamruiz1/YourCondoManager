-- Migration 0068 — founder_feedback (William-only contextual feedback widget).
--
-- Canonical spec: dispatch "feat(feedback): William-only contextual feedback
-- button (all surfaces)" — 2026-07-17.
--
-- New, additive, standalone table. Durable sink for the simple "click
-- Feedback, type a note, submit" affordance available on every surface
-- William visits (admin app, owner portal, public pages when authenticated).
-- Distinct from admin_roadmap_tasks (the heavier inspect-element ->
-- roadmap-ticket admin flow, unchanged by this migration). No foreign keys —
-- identity may resolve via an admin session, a portal session, or a general
-- authenticated session, and is re-verified server-side against a fixed
-- email allowlist on every write (see server/founder-feedback.ts).
--
-- Purely additive (CREATE TABLE IF NOT EXISTS + index); no destructive
-- changes, fully reversible (DROP TABLE founder_feedback).

CREATE TABLE IF NOT EXISTS "founder_feedback" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"surface" text NOT NULL,
	"identity_id" text,
	"note" text NOT NULL,
	"severity" text,
	"route" text NOT NULL,
	"page_title" text,
	"viewport_width" integer,
	"viewport_height" integer,
	"app_version" text,
	"user_agent" text,
	"github_issue_url" text,
	"github_issue_number" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "founder_feedback_created_at_idx" ON "founder_feedback" USING btree ("created_at");
