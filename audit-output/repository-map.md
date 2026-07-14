# Repository Map — YourCondoManager (YCM)

**Protocol:** codebase-audit-protocol-v1 — Phase 2 (System Map)
**Audited ref:** `origin/main` @ `1e6f941` via clean worktree `/tmp/ycm-audit` (see `audit-charter.md` for baseline + limitations)
**Mapping method:** wiring validated by reading imports + route registration (`server/index.ts`, `server/routes.ts`, `server/routes/*`), not by folder names.

---

## 1. Apps / services + entry points

ONE deployable service: an Express 5 server that serves both the JSON API and the built React SPA.

| Component | Entry point | Notes |
|---|---|---|
| Server | `server/index.ts` | Boots express-session (pg-backed via `connect-pg-simple`), rate limiters, Plaid webhook raw-body handling, calls `registerRoutes(httpServer, app)`, then starts in-process schedulers (`startElectionScheduler`, `startDeprovisioningScheduler`, `startVendorComplianceScheduler`) + `recoverInFlightJobs()` for the background job queue |
| API routing | `server/routes.ts` (**20,553 lines** — the monolith) + `server/routes/` (16 extracted modules) | `registerRoutes()` at routes.ts:1396 registers everything; extracted modules register via `registerXxxRoutes(...)` imports at routes.ts:294–307 |
| Client | `client/src/main.tsx` → `App.tsx` | React 18 + Vite 7 + Wouter; 95 page files under `client/src/pages/`, 227 `.tsx` total; TanStack Query for data; Radix/shadcn components; Storybook configured |
| Prod runtime | `dist/index.cjs` (`npm start`) | Built by `script/build.ts` (esbuild bundle of server + Vite build of client); Dockerfile 2-stage (`node:20-alpine` builder → slim runner, `npm ci --omit=dev`) |
| Dev runtime | `script/dev.ts` (`npm run dev`) | tsx + Vite middleware (`server/vite.ts`) |

**Internal packages:** none published. `shared/` is the cross-stack package (imported as `@shared/*`): `shared/schema.ts` (4,910 lines, THE Drizzle schema + Zod insert schemas), plus feature flags, persona-access, portal-per-unit math, payment-period, role-labels, community-slug, hub-visibility, policy-version. **No `@ycm/design-system` package exists at this ref** — design-system work lives on unmerged branches (`build/ycm-redesign-f1-design-system`).

Two script dirs: `script/` (142 files — dev/build/verify/agent-backbone tooling) and `scripts/` (18 files — migration + Stripe product-migration runners).

## 2. API route surface

- ~**515 unique method+path route registrations** across `server/routes.ts` (644 `app.<verb>(` calls) + `server/routes/*.ts` (92 more). The brief's "~141 routes" undercounts; by distinct paths the surface is ~515.
- Extracted route modules (each takes `requireAdmin`/`requirePortal`/scope helpers as injected deps): `account-statement`, `admin-disbursements`, `admin-payments`, `admin-reconciliation`, `agent-actions`, `ai-assistant`, `amenities`, `autopay`, `meeting-prep`, `observability-smoke-test`, `payment-portal`, `pressing-items`, `records-requests`, `resale-certificate`, `stripe-connect`, `violation-triage`.
- `server/test-routes.ts` — test-mode-only routes (gated; worth a specialist check that the gate can't leak into prod).

## 3. AuthN / AuthZ

Two disjoint auth systems:

**Admin (staff/board) — Passport Google OAuth** (`server/auth.ts`): `passport-google-oauth20`, scope `["profile","email"]`; session in Postgres via `connect-pg-simple`; cookies httpOnly, secure-when-https, sameSite lax; cookie-domain scoping to `.yourcondomanager.org` in prod (`server/session-cookie-domain.ts`). Roles: pgEnum `admin_user_role` = `platform-admin | board-officer | assisted-board | pm-assistant | manager | viewer` (`shared/schema.ts:202`, single source of truth). Middleware: `requireAdmin` (routes.ts:1130, session hydration, 403 + structured log on fail) and `requireAdminRole([...])` (routes.ts:1219).

**Owner/board portal — header-token access, NOT Passport**: `requirePortal` (routes.ts:1294) reads `x-portal-access-id` header → `storage.resolvePortalAccessContext()` → hydrates `portalAssociationId`/`portalPersonId`/`portalUnitId`/role. Portal roles collapsed to `owner` + boolean board access (`server/portal-role-collapse.ts`; `portal_access_role` enum = `owner | board-member`). Signup/login is **OTP-first** (auth.ts:479 "OTP-first signup preserved" — no password prompt). The portal access id in a header is effectively a bearer credential — high-value target for the security lane.

**Tenant isolation:** `assertAssociationScope(req, associationId)` (routes.ts:1171) — `platform-admin` bypasses; all other roles must have the association in `adminScopedAssociationIds`; **empty scope = fail-closed deny** (hardened per PPM workitem a8dd8fbd, previously fail-open). Companions: `assertAssociationInputScope`, `assertResourceScope` (resolves a resource's association then delegates — note: unresolvable resource → returns without deny, a soft spot worth specialist review). All 16 extracted route modules import/receive the scope helpers — enforcement is per-call-site (hundreds of sites), not structural middleware; coverage completeness is a prime specialist-lane target.

## 4. Database

- Drizzle ORM → PostgreSQL (Neon in prod). Schema: `shared/schema.ts` — **183 `pgTable` definitions** (brief said ~169; 183 at this ref).
- Migrations: `migrations/` — **58 SQL files** + `meta/_journal.json`. Runner: `scripts/migrate.cjs` (CommonJS for the slim prod image) — drizzle `migrate()` with sha256 hash journal (`drizzle.__drizzle_migrations`), idempotent, **runs as Fly `release_command` on every deploy; non-zero exit aborts the whole deploy**. One-shot journal backfill: `scripts/backfill-migration-journal.cjs`.
- Migration integrity is additionally surfaced at runtime: `/api/health` returns 503 `stale` if `getMigrationHealth()` (`server/migration-health.ts`) detects journal/hash drift.
- Data access: `server/storage.ts` (very large storage layer) + `server/db.ts`; `server/services/*` for domain services.
- Money is stored as **integer cents** in GL/amenity columns (documented in `server/services/gl/amenity-posting.ts`).

## 5. Background jobs / schedulers (all in-process, single machine)

| Mechanism | File | Purpose |
|---|---|---|
| Job queue (DB-persisted, in-process, concurrency 1/association) | `server/job-queue.ts` + `background_jobs` table | Large-association (>500 units) financial rule runs off the request thread; idempotency via partial unique index (migration 0016); `recoverInFlightJobs()` at boot |
| Election auto-close | `server/election-scheduler.ts` | 60s interval |
| De-provisioning | `server/de-provisioning.ts` | scheduler |
| Vendor compliance sweep | `server/vendor-compliance-scheduler.ts` | daily; files L1 agent-action queue items (W-9/COI/insurance expiry) |
| Assessment execution | `server/assessment-execution.ts` | unified orchestrator — the sole live ledger-posting path (`ASSESSMENT_EXECUTION_UNIFIED` default ON) |

No Redis/BullMQ/external queue — deliberate (documented). All of this assumes the **single-machine** topology; horizontal scaling breaks job-queue exclusivity, in-memory rate limits, and the uploads volume simultaneously.

## 6. External integrations

| Integration | How wired | Notes |
|---|---|---|
| **Stripe** | **Raw `fetch` to `https://api.stripe.com/v1`** — no `stripe` npm SDK. Call sites: `server/routes.ts` (incl. a generic passthrough at :16232), `server/storage.ts`, `server/services/payment-service.ts`, `server/services/amenity-stripe-gateway.ts`, `server/services/stripe-connect-storage.ts` | Checkout sessions, subscriptions, Connect. Webhook signature verification present (`constructEvent`-equivalent usage in routes.ts/storage.ts). Hand-rolled HTTP means no SDK-level idempotency-key/retry defaults — specialist lane must verify per-call idempotency on money paths |
| **Stripe Connect** | `server/routes/stripe-connect.ts`, `server/services/stripe-connect-storage.ts` | Per-association connected accounts; amenity gateway charges "per the association's connect config" |
| **Plaid** | `plaid` SDK; `server/services/bank-feed/` — `plaid-provider.ts`, `plaid-webhook-verify.ts` (webhook JWT verification), `plaid-env-guard.ts` (sandbox/live flip guard), `bank-feed-sync.ts` (`/transactions/sync`) | Sandbox per brief; provider abstraction (`provider.ts`) |
| **Email** | `nodemailer` SMTP (`server/email-provider.ts`) — Gmail SMTP default (smtp.gmail.com:465) or generic SMTP env config; transient-code retry set | OTP delivery depends on this |
| **SMS** | Twilio via env/platform-secrets (`server/sms-provider.ts`), simulation fallback when unconfigured | |
| **Push** | Web Push VAPID, hand-rolled (no web-push npm pkg) (`server/push-provider.ts`) | |
| **Google Maps** | client loader; **API key hardcoded as a Fly build arg in `fly.toml`** (`VITE_GOOGLE_MAPS_API_KEY = "AIzaSy..."`) — committed to the repo; restriction status documented in `docs/runbooks` (Maps-key restriction runbook exists) | Flag for security lane |
| **Sentry / GA4** | Dynamic-import opt-in (`server/observability.ts`); `@sentry/node` NOT in package.json; DSN build args empty in fly.toml | **Effectively no error tracking in prod** at this ref |
| **AI assistant** | `server/routes/ai-assistant.ts`, flag `AI_ASSISTANT_ENABLED` default OFF, per-community opt-in | Cherry Hill first target |

## 7. Feature flags (`shared/feature-flags.ts` + `server/services/gl/flag.ts`)

- Env-var-backed (`FEATURE_FLAG_<KEY>`, client `VITE_FEATURE_FLAG_<KEY>`), typed keys, per-association overrides (`FEATURE_FLAG_<KEY>_<associationId>`).
- Live keys: `BOARD_SHUNT_ACTIVE` (default ON), `ASSESSMENT_EXECUTION_UNIFIED` (default ON — sole ledger poster), `AI_ASSISTANT_ENABLED` (default OFF). Retired: `PORTAL_ROLE_COLLAPSE`, `HUB_VISIBILITY_RENAME`.
- **GL/money-loop gating is a separate mechanism**: `GL_ENABLED` (global) OR `GL_ENABLED_ASSOCIATIONS` (per-association allowlist), both default OFF; runtime-sync adds a **reconcile-to-cent hard gate** on top. The amenity money loop (`server/services/amenity-money-service.ts`, HEAD commit) rides the same allowlist: non-allowlisted association = pure no-op (no charge, no column write, no GL); columns written only after the Stripe op succeeds; GL sync is best-effort/non-fatal and never blocks the money path. Enabling for CHC is an explicit env flip (William-ratify gate), not code.
- **`OUTBOUND_SIDE_EFFECTS_DISABLED` (staging guard per the brief) does NOT exist anywhere in this ref** — consistent with there being no staging environment.

## 8. Infra + deployment topology

- Fly.io app `yourcondomanager` (ewr), **single machine** (min 1, auto-stop/start), 512MB shared-cpu-1x, port 5000, force-https, health check GET `/api/health` every 30s.
- Volume `ycm_uploads` → `/data` (`UPLOAD_DIR=/data/uploads`) for governing docs — binds to ONE machine; scale-out requires object-storage migration (documented in fly.toml).
- `release_command = node scripts/migrate.cjs` (migration gate before machines roll).
- **No staging environment** (see charter §7). Prod is the first live env after CI.
- DB: Neon Postgres; PITR ~6h window; weekly independent `pg_dump` via `db-backup.yml` (Mondays 07:17 UTC), restore runbook at `docs/runbooks/db-backup-restore.md`.

## 9. CI/CD (`.github/workflows/`)

| Workflow | Trigger | Notes |
|---|---|---|
| `ci.yml` | PR→main + push→main | 4 jobs, **all self-hosted macOS ARM64 (mac-ycm)**: check (tsc+eslint), test (vitest), build, playwright (route-mock + real-backend + axe; **visual regression is `continue-on-error: true` — non-required**, macOS-rendered baselines don't match). PR runs cancel-in-progress; main runs never cancelled (branch-protection-theater fix, founder-os#8337). Playwright on port 5013 (5000 = macOS AirPlay), browser-install retry w/ backoff |
| `fly-deploy.yml` | push→main | auto prod deploy, `--strategy immediate`, queue-don't-cancel concurrency |
| `security.yml` | PR→main | fails on **critical** CVEs only; high/moderate → PR label |
| `db-backup.yml` | weekly cron | Neon logical backup via Fly-read DATABASE_URL |
| `uptime-monitor.yml` | every 5 min | curls `/api/health`; GitHub-notification alerting (post 2026-05-25 3h-undetected outage) |
| `security-compliance-calendar.yml` | cron | compliance cadence |

Single-point-of-failure note: **every CI job AND the prod deploy run on one self-hosted Mac runner** — runner down ⇒ no merges and no deploys.

## 10. Tests inventory

- Vitest: `tests/` (86 files, incl. `tests/e2e/*.test.ts`, middleware, parity, fixtures, i18n), `server/**/*.test.ts` (95), `client/src` (7). Split configs client/server.
- Playwright: `tests/e2e/playwright/` — 8 specs (a11y-smoke, a11y-dark-mode, alerts-lifecycle, amenities-toggle-roundtrip, assessment-lifecycle, migration-smoke-endpoints, owner-portal-navigation, signup-onboarding) + visual-regression (non-blocking).
- 9 `verify:*` domain scripts (financial, gl-reconcile, gl-amenity, gl-statements, elections, vendors, work-orders, seed-integrity, owner-portal multi-unit) + `tests/payment-acceptance.ts`.
- Lint covers `client/src` ONLY — server/shared are un-linted (typecheck only).

## 11. Monitoring / logging / docs

- `/api/health`: DB ping + migration-hash integrity (503 on stale). `/api/health/details` (platform-admin only): entity counts, assoc list, auth recency, missing-schedule warnings (associations that will never auto-bill).
- Logging: bespoke `server/logger.ts` (console; debug suppressed in prod). No structured log shipping. Sentry not installed (see §6).
- Docs: extensive `docs/` tree (19 subdirs) — runbooks, incidents (incl. 2026-05-25 Fly Postgres postmortem), security (zero-trust architecture, financial-route role matrix, auth-session parity 2026-07-09), specs, projects (platform-overhaul artifacts), operator-runbook. `AGENTS.md` has stale claims (says "no test runner configured" — false).

## 12. Critical data flows (money paths)

1. **Owner pays dues:** portal → `payment-portal.ts`/routes.ts → Stripe Checkout session (raw fetch) → Stripe webhook → signature verify → payment transaction rows → owner ledger entries (`owner_ledger_entries`) → receipt email. Ledger = system of record.
2. **Assessments:** `assessment-execution.ts` orchestrator (unified, flag ON) posts recurring dues + special-assessment installments to owner ledger; health check flags associations with ledger entries but no active schedule.
3. **Autopay + delinquency retries:** `routes/autopay.ts`, migrations 0004/0005; saved methods.
4. **Reconciliation:** Plaid `/transactions/sync` (`bank-feed-sync.ts`) → bank tx rows → `admin-reconciliation.ts` matching against owner ledger.
5. **Parallel GL:** owner-ledger/amenity events → `gl/runtime-sync.ts`/`amenity-runtime-sync.ts` → posting services → GL legs (integer cents, reconcile-to-cent gated, default OFF, never source-of-truth).
6. **Amenity money loop (NEW, HEAD):** booking → fee charge + deposit hold via `amenity-stripe-gateway.ts` → money columns on reservation row → optional GL sync. Allowlist-gated, fail-safe-off.
7. **Platform billing:** signup → plan catalog → Stripe subscriptions (`payment-service.ts`); per-door/per-unit pricing migrations staged in `scripts/`.

## 13. Trust boundaries

1. Public internet → Express (rate-limited in-memory; force-https at Fly edge).
2. Unauthenticated → admin session (Google OAuth; `requireAdmin` + role gates).
3. Unauthenticated → portal (OTP → `x-portal-access-id` bearer header — **weakest-looking boundary; header token, per-request DB resolution**).
4. Admin ↔ cross-tenant (`assertAssociationScope` — fail-closed but call-site-based, not structural).
5. Stripe/Plaid webhooks → server (signature/JWT verification).
6. Test-mode routes (`test-routes.ts`, `PLAYWRIGHT_TEST_MODE`) → must never be reachable in prod.
7. Build-time secrets in repo (Maps API key in fly.toml).

## 14. HIGH-RISK components / areas needing deeper review

Ranked; see `agent-reports/mapper-summary.md` for the top-10 handoff list.

1. **`server/routes.ts` monolith (20.5k lines, 644 route registrations)** — auth/scope enforcement is per-call-site; a single missed `assertAssociationScope` = cross-tenant leak. Needs systematic route×middleware×scope matrix (docs/security/financial-route-role-matrix.md exists — verify against code).
2. **Stripe via raw fetch, no SDK** — idempotency keys, retry semantics, error taxonomy, amount handling on every money call site (routes.ts:6227, :16232 passthrough, payment-service, amenity gateway, storage.ts).
3. **Webhook → ledger integrity** — replay protection, idempotent event processing, out-of-order events, verify-then-write ordering.
4. **Portal auth model** — `x-portal-access-id` bearer header: rotation, expiry, revocation (`is_active`), brute-force resistance, logging exposure; OTP issuance/verification hardening.
5. **Tenant isolation coverage** — completeness sweep of all ~515 routes for scope assertion; `assertResourceScope`'s "unresolvable → pass" branch.
6. **Amenity money loop + GL** (new at HEAD) — invariant review before the CHC allowlist flip: refund/forfeit paths, partial-failure (charge ok / column write fail), deposit lifecycle.
7. **Reconciliation + Plaid** — env-flip guard correctness, webhook JWT verification, match/duplicate logic.
8. **Single-machine coupling** — in-memory rate limiting, in-process job queue, volume-bound uploads: correctness under machine replacement + auto-stop/start, and what breaks first on scale-out.
9. **No staging + auto-deploy-on-merge + no Sentry** — every merge reaches the live customer with no pre-prod env and no error telemetry; blast-radius controls = CI + `/api/health` + 5-min uptime cron only.
10. **CI single point of failure + secrets hygiene** — one self-hosted Mac gates all merges/deploys; Maps key committed in fly.toml; `security.yml` blocks only critical CVEs.
11. **Session/cookie + OAuth surface** — recent `auth-session-parity-2026-07-09.md` and OAuth-loop fix commits suggest active fragility; review cookie-domain scoping and OAuth callback handling.
12. **`test-routes.ts` / test-mode gating** — confirm unreachable in production builds.
