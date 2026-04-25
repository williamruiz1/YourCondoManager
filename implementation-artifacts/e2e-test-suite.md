# E2E Test Suite — Wave 15b

## Decision — Test Runner

**Chosen:** Vitest (existing `vitest` setup at v4.1.4) + integration-style flows using
Express + `fetch` + `@testing-library/react` with `jsdom`.

**Rejected:** Playwright.

**Why integration-style instead of a real browser:**

- The existing 580-test suite already uses this pattern successfully
  (see `tests/portal-assessment-detail.test.ts`, `tests/alerts-read-state-mutations.test.ts`).
- Spinning up a real browser + a real Postgres for a single PR blows the
  ~2500-LoC budget and forces CI changes we don't need yet.
- The flows under test are state-transition + HTTP-contract heavy, not
  pixel-heavy. Integration-level fakes exercise the same layers: route
  handlers, session middleware, React Query cache, invalidation, sidebar /
  shell wiring, banner dismiss mutations.
- True E2E (Playwright + ephemeral Postgres) is tracked as a follow-up
  so we don't regress this PR trying to land both at once.

## Directory Structure

```
tests/e2e/
  signup-onboarding.test.ts           # Flow A — full
  alerts-lifecycle.test.ts            # Flow B — full
  assessment-lifecycle.test.ts        # Flow C — full
  owner-portal-navigation.client.test.tsx  # Flow D — skeleton (test.skip + TODO)
  amenities-toggle-roundtrip.test.ts  # Flow E — skeleton (test.skip + TODO)
  README.md                           # run instructions + flow matrix
```

`.test.ts` files are picked up by the server config; `.client.test.tsx`
falls into the jsdom bucket. No separate vitest config is needed — the
existing include globs already cover `tests/**/*.test.{ts,tsx}` and
`tests/**/*.client.test.tsx`.

## Run Instructions

```bash
npm run test:e2e        # runs only the e2e slice
npm test                # runs the full 580-test suite + these
```

`package.json` gains:

```json
"test:e2e": "vitest run tests/e2e"
```

## Flow Coverage Matrix

| Flow | Status | Notes |
| ---- | ------ | ----- |
| A. Signup → onboarding banner | full | Drives `/api/public/signup/start` + `/api/public/signup/complete` against a mocked Stripe / mocked `provisionWorkspace`. Asserts response shape + session establishment fallback path. |
| B. Alerts lifecycle | full | Seeds one overdue work order in the alert source layer, asserts count of 1, flips the source to "no overdue" (simulating WO completion), asserts the invalidated query returns 0. |
| C. Assessment lifecycle | full | Manager creates a recurring rule → runs it → run-history shows the entry. Owner portal sees the new recurring-charge schedule via the portal dashboard endpoint. |
| D. Owner portal navigation (all 7 routes + legacy URL) | skeleton | `test.skip` with TODO — needs a more complete PortalShell harness (session query + all 7 zone child fetches). Out of scope here; follow-up workitem filed. |
| E. Amenities toggle round-trip | skeleton | `test.skip` with TODO — needs real association fixture flip + sidebar re-render pass. Follow-up workitem filed. |

## CI Integration Plan (DOCUMENT ONLY — NOT WIRED)

When we're ready to add to CI:

1. Extend the existing `vitest run` step in the repo's test job to also
   execute `npm run test:e2e`. No new infra needed.
2. Add a separate job later for **true** browser-E2E (Playwright) that
   boots a short-lived Postgres container via `docker-compose` and runs
   `drizzle-kit push` before test start.
3. Block merge on the integration-E2E slice; keep the Playwright slice
   advisory until stable.

## Follow-ups Filed

- Workitem: "Wave 16 — true E2E harness (Playwright + ephemeral DB)" —
  covers flows D, E, and a real-browser pass at flows A-C.
- Workitem (deferred if no bugs surface): any bug found while authoring
  flows A-C.

## Anti-goals

- **Not** a refactor of existing tests.
- **Not** a push to Playwright today.
- **Not** a live-Stripe or live-email integration.

---

# Wave 16a — Playwright Harness Addendum

Wave 16a adds a Playwright real-browser harness alongside the Vitest
integration-style slice above. The two coexist; Wave 15b tests are not
removed or moved.

## What ships

- `playwright.config.ts` at repo root.
  - `testDir: "tests/e2e/playwright"`
  - `webServer: { command: "npm run dev", url: "http://localhost:5000" }`
  - `chromium` only — Firefox / WebKit deferred until CI exists.
- `@playwright/test` added as devDependency.
- 5 spec files under `tests/e2e/playwright/`:
  - `signup-onboarding.spec.ts`
  - `alerts-lifecycle.spec.ts`
  - `assessment-lifecycle.spec.ts`
  - `owner-portal-navigation.spec.ts` (converts Wave-15b Flow D skeleton)
  - `amenities-toggle-roundtrip.spec.ts` (converts Wave-15b Flow E skeleton)
- Helpers under `tests/e2e/playwright/helpers/`:
  - `auth-helper.ts` — `loginAsManager` / `loginAsOwner` / `loginAsGuest`
    install `page.route` handlers for `/api/auth/me` and `/api/portal/me`.
  - `seed-helper.ts` — in-memory store + `installSeedRoutes` wires every
    endpoint each spec needs (alerts, work orders, assessment rules,
    run history, ledger, amenities settings, portal counts).
- Two new npm scripts:
  - `test:playwright` → `playwright test`
  - `test:playwright:install` → `playwright install chromium`

## Why route-mocked instead of ephemeral Postgres

The original Wave-16 plan called for an ephemeral Postgres + drizzle-kit
push so Playwright could run against real handlers. We deferred that
half: the YCM auth flow is OAuth-only (Manager) and OTP-email-code
(Owner). Standing up a way for a headless browser to "log in" without a
real Google account or a real SMTP listener is a 4–8h problem on its
own. Wave 16a chooses route-mocking instead, which:

- ships dual-coverage of the five flows in <1k LoC of tests
- exercises the real frontend bundle (Vite-served, React-mounted, real
  router) — only the API-layer responses are stubbed
- keeps tests deterministic (no DB drift, no flaky teardown)

The ephemeral-DB path is still on the roadmap as a separate workitem.
Once it lands, callers can swap `installSeedRoutes` for a `seedDB`
helper and the test bodies stay identical.

## Run instructions

```bash
npm install
npm run test:playwright:install   # one-time — installs Chromium
npm run test:playwright           # boots web server + runs specs
```

The harness picks one of two web servers based on platform:

- **Linux / CI / Postgres available** → `npm run dev` (the real backend
  on port 5000; route-mocks layered on top via `page.route`).
- **macOS / no Postgres / `PLAYWRIGHT_STATIC=1`** → a tiny
  `script/playwright-static-server.ts` that serves the production React
  bundle (`dist/public`) on port 5000, with a generic `/api/*` 200
  fallback. Every test still installs its own `page.route` handlers, so
  the static-server path produces identical assertions.

The static-server fallback exists because the macOS dev server today
hits two unrelated compat issues:
  1. `httpServer.listen({ reusePort: true })` in `server/index.ts`
     returns ENOTSUP on Darwin.
  2. The seed step requires a live Postgres on `127.0.0.1:5432`.

A separate workitem tracks fixing those two issues so the macOS path
can run the real backend without route-mocks. Until then, Linux/CI
remains the canonical environment for the "real backend behind real
browser" experience.

If you already have `npm run dev` running on port 5000, Playwright's
`reuseExistingServer` setting will use it (locally only — CI always
spawns fresh).

## CI integration plan (DOCUMENT ONLY — NOT WIRED)

When ready to add to CI:

1. **Job 1 — Vitest E2E** (already documented in Wave 15b): run
   `npm run test:e2e` in the existing test job. Required for merge.
2. **Job 2 — Playwright E2E** (Wave 16a addition): in a new job named
   e.g. `playwright-e2e`:
   ```yaml
   - run: npm ci
   - run: npx playwright install --with-deps chromium
   - run: npm run test:playwright
     env:
       CI: "true"
   ```
   Initially advisory (allow merge on failure) until 1–2 weeks of
   stability. After that, require for merge alongside Vitest.
3. Cache the Playwright browser binaries between runs:
   `~/.cache/ms-playwright`.
4. Upload `playwright-report/` as an artifact on failure for
   trace + video review.

No GitHub Actions workflow is committed in this wave — the user wires
CI separately per the Wave-16a constraints.

## Constraints honoured

- Did not modify any Wave-15b Vitest E2E file.
- Did not commit any CI configuration.
- Did not require external services (Stripe, SMTP, Google OAuth all
  mocked through `route.fulfill`).
- Diff stayed under the 3000-LoC budget.

## Follow-up workitems filed

- Ephemeral Postgres + drizzle-kit-push slice (the half-deferred
  Wave-16 scope) — graduate Playwright tests off route-mocks once a
  real-server harness exists.
- Per-zone deep-content assertions for owner portal navigation
  (`owner-portal-navigation.spec.ts` currently asserts URL + visible
  `<main>` — a real "render heading + breadcrumb for each zone"
  requires stubbing every zone-child fetch).
- Real Google OAuth + portal OTP login helpers (would graduate the
  auth helper from `route.fulfill` to a deterministic real-server
  flow).

---

# Wave 17 — Real-backend E2E slice + macOS dev-server fix

Wave 17 lands two changes that unblock running Playwright against the
real backend on a developer Mac:

1. **`server/index.ts` `reusePort` is now Linux-only.** The previous
   call to `httpServer.listen({ reusePort: true })` returned `ENOTSUP`
   on Darwin, killing the dev server before the first request landed.
   The fix mirrors the platform gate already in `script/dev.ts`: only
   set `reusePort: true` when `process.platform === "linux"`.
   Production behavior is unchanged.

2. **Ephemeral Postgres for Playwright** — `tests/e2e/playwright/
   helpers/test-db.ts` boots PGlite (in-process Postgres in WASM) and
   fronts it with `pg-gateway` (a Node TCP server that speaks the
   Postgres wire protocol). The dev server's `pg.Pool` connects to the
   gateway as if it were a normal local Postgres. No code changes were
   needed in `server/db.ts`.

## Why pglite + pg-gateway over the alternatives

| Option | Verdict | Reason |
| --- | --- | --- |
| `@electric-sql/pglite` + `pg-gateway` | **chosen** | Zero system deps. ~25 MB devDep total. Works on any dev Mac after `npm ci`. |
| `pg-mem` | rejected | JS Postgres emulator; missing features (notably full enum semantics) and no wire-protocol server. |
| `testcontainers` / `docker-compose` | rejected | Requires Docker daemon — listed as a hard "no" in the Wave 17 brief. Still tracked as a CI option. |
| `embedded-postgres` | rejected | Downloads native Postgres binaries on first install. Heavy and slow on cold caches. |

## Schema materialisation strategy

`startTestDb()` shells out to `npx drizzle-kit push --force` with
`DATABASE_URL` pointed at the gateway. This generates DDL from
`shared/schema.ts` and applies it to the empty pglite instance in one
shot.

We tried replaying `migrations/*.sql` first; that path tripped a pglite
bug where the parser cache for an enum's value list does not refresh
across connections after `ALTER TYPE ... ADD VALUE`. Migrations 0006
(`board-admin` role rename) and 0014 (portal_access role collapse) both
rely on this pattern, and reproducibly failed with
`column "role" is of type X but expression is of type text` even when
each statement ran on a fresh `pg.Client` connection. The
`drizzle-kit push` path side-steps this entirely because it produces
the FINAL schema (already-collapsed enums, no `ADD VALUE` history)
from one introspect-and-diff cycle. Production parity is preserved
because both paths converge on the same final schema; we just skip the
historical DDL replay.

## How the migrated spec runs end-to-end

The first migration target is `tests/e2e/playwright/alerts-lifecycle.spec.ts`.
With `PLAYWRIGHT_REAL_BACKEND=1`:

1. Playwright `globalSetup` (`tests/e2e/playwright/global-setup.ts`)
   creates a `PGlite` instance, starts a `pg-gateway` TCP server on a
   random local port, and runs `drizzle-kit push --force` against it.
   It writes `DATABASE_URL`, `SESSION_SECRET`, and
   `AUTOMATION_SWEEPS_ENABLED=0` into `process.env`.
2. Playwright spawns `npm run dev` (the real Express + Vite stack).
   Because `webServer.env` merges with `process.env`, the dev server
   inherits the gateway URL and the deterministic test secret.
3. The spec uses `createRealBackend()` (in `helpers/seed-helper.ts`)
   to:
   * truncate test-mutable tables between cases,
   * insert an `admin_users` (manager) + `auth_users` + scope row,
   * insert a `user_sessions` row whose `sess` payload mirrors what
     `passport.serializeUser` would write,
   * sign the sid with `SESSION_SECRET` (HMAC-SHA256, the algorithm
     used by `cookie-signature`) and attach the cookie to the
     Playwright `BrowserContext` so every navigation includes it,
   * insert one work order with `scheduled_for` 7 days in the past.
4. The spec navigates to `/app`, fetches
   `/api/alerts/cross-association` from inside the page (real
   `requireAdmin` middleware runs, real overdue-work-orders resolver
   runs against the seeded row), asserts the alert is present.
5. The spec PATCHes the work order to `closed`, which calls
   `safeInvalidateAlertCache()`. The next GET returns the empty list.

No `route.fulfill` is involved. The route-mock helpers are still
exported because the four sibling specs continue to use them (see
follow-ups below).

## Follow-ups filed

- **Other 4 specs still on static server.** `signup-onboarding`,
  `assessment-lifecycle`, `owner-portal-navigation`,
  `amenities-toggle-roundtrip` still rely on `installSeedRoutes`. Each
  needs its own seed translation (e.g. fee-schedule rows for the
  assessment spec, units + portal-access rows for the owner portal
  spec). Tracked as a follow-up to Wave 17. **Closed by Wave 26 below.**
- **CI integration.** The Wave-16a CI plan still applies; the only
  difference is that the Job 2 step gains an `env:
  PLAYWRIGHT_REAL_BACKEND: "1"` line. We did not commit any GitHub
  Actions YAML in this wave.
- **Migration replay path.** If we ever ship a custom Drizzle dialect
  built on pglite (which would invalidate the planner cache properly),
  `test-db.ts` can switch back to `migrations/*.sql` replay so we
  exercise the historical DDL.

## Constraints honoured

- `reusePort: true` is set only on Linux.
- `@electric-sql/pglite` and `pg-gateway` are devDependencies, not
  runtime deps.
- `tests/e2e/playwright/helpers/test-db.ts` is the only new file in
  the helpers directory (alongside the additive
  `createRealBackend` helpers in `seed-helper.ts`).
- Existing Vitest E2E suite from Wave 15b and the four other
  Playwright static-server specs from Wave 16a are untouched.
- `npm run test:playwright` continues to run all 5 specs in the
  default (route-mock) mode; `npm run test:playwright:real` switches
  the alerts-lifecycle spec to the real backend.

---

# Wave 26 — All 5 specs on real backend; obsolete Vitest skeletons deleted

Wave 26 completes the migration that Wave 17 opened. The remaining
four Playwright specs (`signup-onboarding`, `assessment-lifecycle`,
`owner-portal-navigation`, `amenities-toggle-roundtrip`) now run end-to-end
against the ephemeral pglite-backed dev server when
`PLAYWRIGHT_REAL_BACKEND=1`. Each spec keeps its Wave-16a route-mock path
so the static-server fallback (used on macOS without the real backend
flag) continues to pass.

## What ships

- `tests/e2e/playwright/helpers/seed-helper.ts` (extended): six new
  real-backend helpers
  - `installOwnerSession(page, options)` — inserts a real
    `portal_access` row + sets the `portalAccessId` localStorage
    key so PortalShell sends `x-portal-access-id` on every request.
    The `requirePortal` middleware resolves the row for real.
  - `seedUnitWithOwner` — inserts unit + person + ownership rows.
  - `seedRecurringChargeSchedule` — inserts a `recurring_charge_schedules`
    row that the unified `/api/financial/rules/:id/run` endpoint can
    pick up.
  - `seedAmenity` — inserts an `amenities` row.
  - `seedPlatformSubscription` — inserts a `platform_subscriptions` row
    so signup-side post-provisioning state is observable.
  - `seedAssociation(id, name, { amenitiesEnabled })` — extended with
    an `amenitiesEnabled` option (defaults to true).
- `reset()` truncates the additional tables: `assessment_run_log`,
  `recurring_charge_runs`, `recurring_charge_schedules`,
  `owner_ledger_entries`, `ownerships`, `amenity_reservations`,
  `amenities`, `portal_access`, `platform_subscriptions`, `persons`.
- All four Playwright spec files updated:
  - `test.describe.configure({ mode: "serial" })` added.
  - When `PLAYWRIGHT_REAL_BACKEND=1` they create a `RealBackendHandle`,
    seed rows directly into pglite, install a manager or owner session
    on the page, and exercise the real handler chain. No
    `route.fulfill` is registered for `/api/*` paths in real-backend
    mode (with one documented exception below).
  - When the env var is unset, the original Wave-16a behaviour
    (in-memory store + `installSeedRoutes`) runs unchanged so
    static-server CI flows do not regress.
- `tests/e2e/owner-portal-navigation.client.test.tsx` — DELETED.
- `tests/e2e/amenities-toggle-roundtrip.test.ts` — DELETED. Both
  files were `describe.skip` placeholders (Wave 15b's "follow-up
  skeletons") and the Playwright slice now owns those flows.

## Stripe is the documented exception

`signup-onboarding.spec.ts` keeps `route.fulfill` handlers on
`/api/public/signup/start` and `/api/public/signup/complete` even in
real-backend mode. Both real handlers call `api.stripe.com` server-side
through `stripeRequest`, and hitting the live Stripe API requires real
keys — which the brief explicitly forbids. Browser-mocking the two API
endpoints is the cleanest way to keep Stripe out of the test
environment without standing up a stripe-mock service.

After the mocked checkout completes, the spec directly seeds the rows
that `provisionWorkspace()` would have written (admin_user, association,
platform_subscription) and asserts they are queryable through the real
DB. Then it installs a manager session and verifies `/app` resolves
through the real auth gate.

## How each spec exercises the real backend

| Spec | Real-backend exercise |
| --- | --- |
| `alerts-lifecycle.spec.ts` (Wave 17) | seed work_orders row → real overdue-resolver runs → real PATCH handler invalidates cache → next GET returns empty list |
| `amenities-toggle-roundtrip.spec.ts` (Wave 26) | real Manager PATCH `/api/associations/:id/settings/amenities` → real Owner-side `isAmenitiesEnabledFor()` reflects flip → real listing handler 404s → flip back → recovery |
| `assessment-lifecycle.spec.ts` (Wave 26) | seed unit + person + ownership + schedule → real `/api/financial/rules/:id/run` orchestrator → real `assessment_run_log` row → real portal `/api/portal/financial-dashboard` surfaces the schedule |
| `owner-portal-navigation.spec.ts` (Wave 26) | real `requirePortal` middleware resolves seeded `portal_access` row → all 7 zone-child fetches hit real handlers → legacy `/portal?tab=financials` exercises the real PortalShell redirect |
| `signup-onboarding.spec.ts` (Wave 26) | mocked `/api/public/signup/*` (Stripe) → seeded admin_users + platform_subscriptions rows → DB query asserts → real auth gate on `/app` |

## Coverage matrix

| Spec | Route-mock mode | Real-backend mode |
| --- | --- | --- |
| signup-onboarding | green | green |
| alerts-lifecycle | green | green |
| assessment-lifecycle | green | green |
| owner-portal-navigation | green | green |
| amenities-toggle-roundtrip | green | green |

## Constraints honoured

- No new external services (Stripe still mocked, Twilio still mocked).
- Diff under the 1500-LoC budget for the wave.
- The four migrations preserve the route-mock path verbatim so the
  static-server fallback used on macOS dev machines does not regress.
- Wave 17's `alerts-lifecycle.spec.ts` real-backend spec is unchanged.
- `seed-helper.ts` keeps the two helper sets cleanly separated; the
  route-mock side is untouched.

## Follow-ups filed by Wave 26

- The unified `/api/financial/assessment-run-log` response shape is
  `{ rows, total, page, limit }` — the spec asserts `body.rows`. If a
  future wave changes the response key, the spec needs a tweak.
- `seedRecurringChargeSchedule` defaults to `unitScopeMode='all-units'`
  + an empty `included_unit_ids_json` array. If a future wave makes
  the `inclusion-list` mode required for new rules, the helper will
  need a unit-id parameter.
- `tests/e2e/owner-portal-navigation.client.test.tsx` and
  `tests/e2e/amenities-toggle-roundtrip.test.ts` are deleted. If a
  reviewer needs the Vitest skeletons back for documentation, the git
  history (commit on `wave/26-playwright-real-backend-migration`) is
  the source.
