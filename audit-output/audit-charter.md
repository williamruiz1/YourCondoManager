# Audit Charter — YourCondoManager (YCM)

**Protocol:** codebase-audit-protocol-v1 — Phase 1 (Baseline)
**Date:** 2026-07-10
**Author:** Baseline + System-Mapping sub-agent

## 1. Repo root + audited ref

- **Canonical repo (William's machine):** `/Users/williamruiz/code/YourCondoManager`
- **Audited from:** `/tmp/ycm-audit` — a **clean git worktree** checked out at `origin/main`
- **Commit audited:** `1e6f94131ae22dd5c741b07e6ab235d07f42d9ab` — "feat(amenities): live amenity money loop — fee/deposit capture + wire GL sync (flag-gated, default-off) [founder-os#10181 / #329] (#430)"
- **Worktree status at audit time:** clean (`git status --short` = 0 lines); `HEAD` confirmed to be an ancestor of `origin/main` (i.e. exactly `origin/main`, no divergence).

### Limitation — why a worktree was used instead of the shared checkout

The shared checkout at `/Users/williamruiz/code/YourCondoManager` is currently on a **detached-HEAD / stale artifact branch** with **88 dirty files** left by other concurrent agents (multiple `.claude/worktrees/*`, other in-flight branches such as `artifact/chc-chase-payment-match-preview`, `build/amenity-money-loop-10181`, `build/ci-playwright-cache-10172`, etc. are all checked out in sibling worktrees off the same `.git`). Auditing that checkout directly would have (a) risked reading someone else's in-flight, uncommitted work as if it were canonical `main`, and (b) risked disturbing another agent's working tree (a hard violation of `worker-worktree-isolation-protocol.md`). A fresh, isolated, read-only worktree pinned to `origin/main` was the correct and only safe baseline. All findings and maps in this audit describe the code **as committed on `main` @ `1e6f941`**, not any in-flight branch work.

The repo has a very large number of open branches (~150+, many with divergent WIP): audit scope is `main` only. In-flight branch work (design/redesign prototypes, pricing-v2 experiments, per-door/per-unit billing migrations, reconciliation breadth work, etc.) is explicitly OUT of scope for this baseline and is not reflected below.

## 2. Stack summary

| Layer | Technology |
|---|---|
| Language | TypeScript (strict-ish; `tsc` via `npm run check`), `type: module` (ESM) |
| Frontend | React 18.3 + Vite 7, Wouter (routing), TanStack Query 5, Radix UI primitives, Tailwind CSS 3 (+ `@tailwindcss/vite` v4 devDep present but Tailwind itself pinned v3), shadcn-style component set, Storybook 10 |
| Backend | Express 5, Node 20 (Dockerfile pins `node:20-alpine`; no `.nvmrc`/`engines` field found), ESM throughout |
| ORM / DB | Drizzle ORM 0.45 + drizzle-kit 0.31, PostgreSQL (Neon-hosted in prod, per DB-backup workflow comments), `pg` driver, `connect-pg-simple` for session store |
| Auth | Passport.js — `passport-google-oauth20` (admin/staff login) + a custom portal-access-id header flow (owner/board portal — NOT Passport-backed); `express-session` w/ `connect-pg-simple` |
| Payments | Stripe (no `stripe` npm SDK in `package.json` — likely invoked via raw HTTP/fetch or a service wrapper; confirmed extensive Stripe Connect usage in `server/routes/stripe-connect.ts` and `server/services/`), Stripe webhooks (`stripe.webhooks.constructEvent` present in `server/routes.ts` / `server/storage.ts` / `server/services/stripe-connect-storage.ts`) |
| Bank feeds | Plaid (`plaid` + `react-plaid-link` npm packages), Plaid webhook verification (`server/services/bank-feed/plaid-webhook-verify.ts`), env-flip guard (`plaid-env-guard.ts`) — **sandbox environment**, per the task brief |
| Email/SMS/Push | `nodemailer` (email-provider.ts), `sms-provider.ts`, `push-provider.ts` (providers abstracted, not confirmed which live vendor is wired without deeper read) |
| Testing | Vitest 4 (client config + server config split — `vitest.config.client.ts` / `vitest.config.server.ts` / `vitest.config.ts`), Playwright 1.60 (`tests/e2e/playwright/`, 8 spec files incl. a11y + visual-regression), `@axe-core/playwright` for accessibility |
| Observability | `@sentry/node` — **dynamically imported, NOT in `package.json` dependencies** (opt-in per `INSTALL-OBSERVABILITY.md`); `VITE_SENTRY_DSN` / `VITE_GA_MEASUREMENT_ID` are empty strings in `fly.toml` build args — **Sentry/GA are effectively OFF in production today** unless installed + configured out-of-band |
| Deploy target | Fly.io, single app `yourcondomanager` (prod). **No staging app/environment exists in this repo** (see Limitation below) |
| CI/CD | GitHub Actions, but runners are **self-hosted macOS (`mac-ycm`)**, not GitHub-hosted `ubuntu-latest` (migrated 2026-05-24 per a cost-boundary rule — metered GitHub-hosted runners are disallowed without explicit authorization) |

### Package manager
npm (`package-lock.json` present, `npm ci --legacy-peer-deps` used in CI/Docker). 72 runtime deps, 39 dev deps.

## 3. Test commands (as declared in `package.json`)

| Command | Purpose |
|---|---|
| `npm run check` | `tsc` type-check (no emit config confirmed at repo root `tsconfig.json`) |
| `npm run lint` | `eslint client/src` — **note: lint scope is `client/src` only, does not cover `server/` or `shared/`** |
| `npm test` / `npm run test:client` / `npm run test:server` | Vitest unit/integration suites (split by config) |
| `npm run test:e2e` | `vitest run tests/e2e` (Vitest-based e2e, distinct from Playwright) |
| `npm run test:playwright[:chromium\|:real\|:test-mode\|:visual]` | Playwright browser e2e — route-mocked, real-backend, and visual-regression variants |
| `npm run build` | Production bundle sanity (used as its own CI gate) |
| `npm run migrate` / `migrate:backfill[:dry]` | Drizzle migration runner + one-shot backfill (see §7) |
| `npm run verify:*` (9 scripts) | Domain-specific verification scripts: mobile journeys, owner-portal multi-unit, elections, vendors, work-orders, seed-integrity, financial, gl-reconcile, gl-amenity, gl-statements |

**Note:** `AGENTS.md` (repo root, agent-facing conventions doc) states *"There is no automated test runner configured yet"* — this is **stale**; the repo has an extensive Vitest + Playwright test surface (188 test files by rough count across `tests/`, `client/src`, `server/`) plus 9 dedicated `verify:*` correctness scripts. Flagging as a doc-drift item for the specialist docs/DX lane, not treated as a finding here.

## 4. Deploy target(s)

- **Production:** Fly.io app `yourcondomanager`, region `ewr`, single machine (`min_machines_running = 1`, `auto_stop_machines = "stop"`, shared-cpu-1x / 512mb), persistent volume `ycm_uploads` mounted at `/data` for governing-document uploads. `release_command = "node scripts/migrate.cjs"` runs the migration runner on every deploy, on a dedicated short-lived machine, BEFORE app machines roll — this is a hard migration-integrity gate (deploy aborts on non-zero exit).
- **Deploy trigger:** `.github/workflows/fly-deploy.yml` — auto-deploys on every push to `main` (`flyctl deploy --remote-only --strategy immediate`), also manually triggerable. Runs on the same self-hosted macOS runner as CI. `concurrency.cancel-in-progress: false` (deliberately — a documented incident on 2026-07-03 showed `cancel-in-progress: true` caused 5 consecutive deploys to be killed mid-flight, leaving prod stale).
- **Staging:** **NONE EXISTS.** No `fly.staging.toml`, no `yourcondomanager-staging` app reference anywhere in the repo. This differs from the audit brief's assumption of a `yourcondomanager-staging` app — recording as a baseline correction. All CI/deploy validation happens via: self-hosted CI (tsc/lint/vitest/build/playwright) gating the PR merge, then an automatic prod deploy on merge to `main`. There is no pre-prod environment to smoke-test against; prod IS the first live environment any merged change reaches.

## 5. Critical business workflows (identified, not yet deep-reviewed)

| Workflow | Entry points (files) | Notes |
|---|---|---|
| **Owner dues payment (Stripe)** | `server/routes/payment-portal.ts`, `server/routes/admin-payments.ts`, `server/routes/admin-reconciliation.ts`, `server/storage.ts` (Stripe calls) | Direct-account Stripe (no Connect for owner dues — see repository-map for the Connect-vs-direct distinction) |
| **Stripe webhook → ledger** | `server/routes.ts` (constructEvent usage), `server/services/stripe-connect-storage.ts` | Webhook signature verification confirmed present; full idempotency/retry review deferred to the financial-integrity specialist lane |
| **Reconciliation** | `server/routes/admin-reconciliation.ts`, `server/services/bank-feed/*` (Plaid tx sync) | Bank-tx ↔ owner-ledger matching; in-flight branch work (`feat/plaid-reconciliation-448-020`, `feat/reconciliation-auto-match-breadth`) NOT in this baseline — main-branch reconciliation surface only |
| **GL sync (parallel general ledger)** | `server/services/gl/*` (`gl-posting-service.ts`, `amenity-posting.ts`, `amenity-posting-service.ts`, `amenity-runtime-sync.ts`, `runtime-sync.ts`, `flag.ts`, `posting.ts`) | **Confirmed default-OFF**, two-layer gate: `GL_ENABLED` (global) OR `GL_ENABLED_ASSOCIATIONS` (allowlist) — plus a hard reconcile-to-cent gate in `runtime-sync.ts` even for allowlisted associations. Forward-only/parallel — the owner ledger stays system-of-record; GL never gates the live money path. |
| **Portal OTP / access-id login** | `server/auth.ts`, `server/routes.ts` (`requirePortal`), portal access resolved via `x-portal-access-id` header, NOT Passport session | Distinct auth model from admin login — worth a dedicated auth-flow deep-dive (see repository-map §Auth) |
| **Admin Google OAuth** | `server/auth.ts` (`passport-google-oauth20`, scope `["profile","email"]`) | Session-cookie-domain handling in `server/session-cookie-domain.ts`; a recent doc `docs/security/auth-session-parity-2026-07-09.md` suggests this is an active area of scrutiny |
| **Amenity booking + the new "money loop"** | `server/routes/amenities.ts`, `server/services/amenity-money-service.ts`, `server/services/amenity-stripe-gateway.ts`, `shared/schema.ts` (migration 0042) | **This is the HEAD commit** — fee/deposit capture + GL wiring, flag-gated, default-off, per-association allowlist (`GL_ENABLED_ASSOCIATIONS`), fail-safe-off (non-allowlisted association = pure no-op), columns only written after the real Stripe op succeeds (no fabricated liabilities) |
| **Notices / announcements** | Not yet traced in depth — present in `client/src/pages` and likely `server/routes.ts`; deferred to specialist lane |
| **Assessments (recurring + special)** | `server/assessment-execution.ts`, `server/assessment-execution-parity.ts`, `server/assessment-ownership.ts`, `server/portal-assessment-detail.ts` | `ASSESSMENT_EXECUTION_UNIFIED` flag: **default ON** (flipped in Wave 12; legacy per-subsystem posters deleted) — this is the sole live posting path today, unlike the still-default-OFF GL/amenity-money flags |

## 6. Inaccessible systems (explicit limitations of this audit)

This audit is **static/read-only** against a code checkout. The following are NOT accessible and NOT verified:

- **Production database** (Neon) — no live schema/data inspection; table/column facts below are read from `shared/schema.ts` migration source only, not confirmed against the running prod DB state.
- **Stripe dashboard / live Stripe account state** — webhook endpoint configuration, live vs. test mode status, Connect account statuses, actual charge/payout history — not accessible.
- **Live Plaid integration** — the brief states Plaid is in **sandbox**; not independently verified from code alone (env-driven, `plaid-env-guard.ts` exists to prevent sandbox/live cross-wiring but the actual configured environment is a runtime/secrets fact, not a code fact).
- **Live webhooks** (Stripe, Plaid) — delivery success/failure history, replay behavior under real network conditions — not observable statically.
- **Fly.io runtime state** — actual machine count, current deployed revision, volume contents, secrets values — not accessible from a static code audit.
- **GitHub Actions runtime/self-hosted-runner health** — whether the `mac-ycm` self-hosted runner is currently online/healthy is not verifiable from repo contents.
- **Sentry / GA4** — whether these are actually installed/configured out-of-band per `INSTALL-OBSERVABILITY.md` (the repo's own dependency manifest says no) is not verifiable statically.

## 7. Correction to audit brief

The task brief assumed a `fly.staging.toml` / staging app exists. **It does not, at this ref.** This is recorded here as a baseline fact so downstream specialist lanes do not waste effort chasing a staging environment that isn't part of the current architecture — all environment-parity and pre-prod-testing findings should be framed against "there is no pre-prod environment; CI is the only gate before prod."
