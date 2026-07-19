# Rate limiting

**Status:** live · **Anchors:** YCM#211 (production-readiness P1-4), founder-os#8536
**Code:** `server/rate-limit.ts` (limiters) · `server/index.ts` (route mounts) · `shared/schema.ts` (`rate_limit_counters`) · `migrations/0053_rate_limit_counters.sql`

## Purpose

**Abuse protection, not customer throttling.** Every limit below is deliberately
generous — an 18-unit HOA doing normal work (a treasurer recording a batch of
payments, a resident logging in) never hits them. The limits exist to blunt
brute-force and automated-flood attacks on the two surfaces that matter most:
**money mutations** and **auth**.

## The multi-machine problem (and the answer)

`fly.toml` provisions **2 machines** (`min_machines_running = 1`,
`auto_start_machines = true`, one auto-stopped). The original limiter
(`createRateLimiter`) keeps its counter **in memory, per process** — so a second
machine has an independent counter. An attacker whose requests are load-balanced
across both machines gets up to **2× the intended quota** on exactly the
money/auth surfaces we most need to protect.

**Answer: a Postgres-backed shared fixed-window limiter** (`createPgRateLimiter`).
One counter row per `(tier, client-IP)` in the existing Postgres
(`rate_limit_counters`), incremented atomically. All machines read/write the same
row, so the quota is enforced **fleet-wide**, correctly, regardless of how many
machines are running.

- **No new infra.** Reuses the Postgres YCM already runs. **No Redis** (explicit
  non-goal — one fewer service to run, secure, and pay for).
- **Atomic.** Each request is a single `INSERT … ON CONFLICT DO UPDATE …
  RETURNING count` statement; concurrent requests (even across machines)
  serialize on the row lock and can never over-count. Fixed-window: when
  `window_start` advances the counter atomically resets to 1.
- **Fail-open.** If Postgres is unavailable the limiter degrades to a per-machine
  in-memory limiter (same window/max) and logs the fallback. Rate limiting is
  abuse protection, not a security gate — a transient DB blip must never DoS
  legitimate traffic. Protection degrades gracefully (still per-machine) rather
  than vanishing or blocking everyone.
- **Bounded storage.** One row per active `(tier, IP)`; the
  `rate_limit_counters_window_idx` index makes a `DELETE WHERE window_start <
  cutoff` sweep cheap if ever needed. For an HOA the row count is trivial.

Why not "just pin to one machine"? That was the alternative (set
`max_machines_running = 1`). Rejected: it throws away the second machine that
exists for deploy rollover / failover, and it silently breaks again the moment
someone scales up. The Postgres counter is correct at any machine count.

## Tiers & limits

| Tier | Window | Max | Key | Rationale |
|---|---|---|---|---|
| `auth-verify` | 10 min | 15 | **account (email) + IP**, falls back to `:token` param or bare IP when no email on the request | OTP / token verification — the tightest brute-force surface. Keyed by account+IP (not bare IP) since 2026-07-17 — see below. |
| `auth-request` | 1 min | 10 | IP | Login request / magic-link send — email-enumeration + OTP-spam. Stays IP-only: the "account" here is the arbitrary *target* email being mailed, and keying by target email would let an attacker mail-bomb one inbox indefinitely by rotating source IPs. |
| `money-write` | 1 min | 60 | IP | Financial mutations + admin writes. 60/min is permissive for a treasurer recording a batch, blocks an automated write flood. |
| `invite-gen` | 1 min | 20 | IP | Onboarding invite sends — email-send abuse. |
| `public` (in-memory) | 1 min | 20 | IP | Coarse guard on the public marketing/API surface; per-machine is acceptable (non-money, non-auth). |

### `auth-verify` account+IP keying (2026-07-17 rebalance)

Trigger: William (platform owner) was rate-limited signing in and got a "too
many sign-in attempts" lockout. Investigation (`flyctl logs` + a read-only
query against `rate_limit_counters` / `auth_events` in the incident window)
found **no evidence this specific lockout came from YCM's own limiter** — no
matching request ever reached the app in that window, which points at an
upstream cause (most likely Google's own OAuth-side throttling on repeated
sign-in attempts, outside this codebase). Independent of that specific
incident, the investigation surfaced a real structural weakness worth fixing
regardless:

- `/api/portal/verify-login` costs **two calls** for any account with portal
  access to more than one association — the OTP-verify call returns an
  association picker, and picking an association re-submits the same OTP to
  the same endpoint. A single successful multi-association login already
  spends 2 of the window's budget before any retry.
- The limiter was keyed purely by **IP**, so every user behind the same NAT /
  VPN / shared office or building WiFi — or a household with more than one
  owner — shared **one** budget. One person's retries could lock out someone
  else with no relationship to them.

Fix: `auth-verify` is now keyed by **`email:ip`** (see `authVerifyKey` in
`server/index.ts`), and the ceiling moved from 10 to 15 per 10-minute window.
This is still tight per account+IP pair — brute-forcing an OTP is bounded by
the **existing, unchanged** per-token `attempts >= 5` cap
(`portalLoginTokens.attempts` in `server/routes.ts`), which is IP/account-
agnostic and is the real floor against guessing a specific code. The window
ceiling's job is bounding request *volume*, not guess-space — raising it and
keying it by account removes the false-lockout risk without weakening that
floor. Routes with no email on the request (the admin-gated, bodyless
`/api/platform/email/verify` health check) fall back to bare IP — unchanged
behavior. The election-ballot routes (`/api/elections/ballot/:token[/cast]`)
key by `tok-<token>:ip` — same protection shape as email+IP, scoped to the
one-time ballot token instead.

`onWriteOnly(...)` wraps the money/admin/invite mounts so **GET reads**
(dashboards, reports, statements) are never throttled — only POST/PUT/PATCH/DELETE.

## 429 response contract

Every limited route, on exceeding its quota, returns:

- **HTTP 429**
- **`Retry-After`** header — integer seconds until the window resets.
- **Plain-English JSON body** — `{ "message": "Too many …, please …" }` (tier-specific, human-readable — no codes or jargon).

## Route coverage

All financial-mutation + auth-adjacent routes are covered. Mounts are prefix-based
in `server/index.ts` (so future routes under a covered prefix inherit the limit).

**auth-verify** (`app.use(prefix, authVerifyLimiter)`):
- `/api/portal/verify-login`
- `/api/vendor-portal/verify-login`
- `/api/platform/email/verify`
- `/api/elections/ballot` (token-cast ballot surface, incl. `…/ballot/:token/cast`)

**auth-request** (`app.use(prefix, authRequestLimiter)`):
- `/api/portal/request-login`
- `/api/vendor-portal/request-login`

**money-write** (`app.use(prefix, onWriteOnly(moneyWriteLimiter))`):
- `/api/financial` — autopay (`/autopay/enrollments`, `/autopay/run`), Stripe Connect (`/stripe-connect/onboarding-link`)
- `/api/admin` — payments (`/payments/record`, `/payments/record-bulk`), reconciliation (`/reconciliation/auto-match`, `/match`, `/suggestions/create`), billing (`/billing/portal-session`)
- `/api/portal/pay`
- `/api/portal/payment-methods` (`/setup`)
- `/api/portal/autopay` (`/enroll`, `/enrollments/:id`)
- `/api/plaid` (`/create-link-token`, `/exchange-token`)
- `/api/portal/plaid` (`/create-link-token`, `/exchange-token`)

**invite-gen** (`app.use(prefix, onWriteOnly(inviteLimiter))`):
- `/api/onboarding/invites` (`/`, `/:id/send`)

### Deliberately excluded

- **Stripe webhooks** (`/api/webhooks/stripe-connect/*`) — authenticated by Stripe
  **signature verification**, not IP, and Stripe legitimately bursts + retries
  from its own IP ranges. IP rate-limiting them would drop legitimate webhooks
  and provides no abuse benefit (a forged webhook fails signature check anyway).
- **`:id`-mid-path invite routes** that can't be cleanly prefix-mounted
  (`/api/elections/:id/generate-tokens`, `/api/vendors/:id/portal-invite`,
  `/api/board-roles/:id/invite-access`) are admin-authenticated (behind
  `requireAdmin`), so their brute-force exposure is low. If future abuse warrants
  it, apply the `inviteLimiter` middleware directly at those route registrations.

## Tests

`server/__tests__/rate-limit.test.ts`:
- `createRateLimiter` — window counting, 429, Retry-After, reset, per-IP isolation.
- `createPgRateLimiter` — normal burst under the limit passes; hitting a limited
  route past its threshold returns 429 + Retry-After; fixed-window reset; tiers
  namespaced independently; **fail-open** to the in-memory limiter on a DB error.
- `onWriteOnly` — throttles only mutating methods; GET/HEAD/OPTIONS pass through.

## Operational notes

- The `rate_limit_counters` table is created by migration `0052`, applied
  automatically on Fly deploy via `release_command = "node scripts/migrate.cjs"`.
  Until the table exists the limiter fails open (in-memory) — so there is no
  deploy-ordering hazard.
- To tune a limit, edit the tier definition in `server/index.ts`. To add a route,
  add an `app.use(prefix, …)` mount there (before `registerRoutes`).
