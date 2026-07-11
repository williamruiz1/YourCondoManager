-- Migration 0053 — rate_limit_counters (multi-machine-correct rate limiter store)
--
-- Backing store for the Postgres-backed rate limiter (server/rate-limit.ts
-- createPgRateLimiter + docs/rate-limiting.md). The in-memory limiter keeps an
-- independent counter per Fly machine; fly.toml provisions 2 machines (one
-- auto-stopped), so a load-balanced attacker could get up to 2x the intended
-- quota on money-mutation + auth-brute-force surfaces. This table makes the
-- fixed-window counter SHARED across all machines using the EXISTING Postgres —
-- no Redis, no new infra service.
--
-- One row per (limiter key = "tier:client-ip"). The limiter atomically upserts
-- the row and reads back the post-increment count; when window_start advances to
-- a new window the count resets to 1 (see the ON CONFLICT upsert in the app).
--
-- NET-NEW / ADDITIVE / ZERO live-book exposure: creates ONE new table + one
-- index. Touches NO existing table, column, or row; no backfill; no destructive
-- DDL. Safe to run on a live production DB.
CREATE TABLE IF NOT EXISTS "rate_limit_counters" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rate_limit_counters_window_idx" ON "rate_limit_counters" ("window_start");
