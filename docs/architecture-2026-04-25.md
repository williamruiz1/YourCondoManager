# YCM Architecture — 2026-04-25

**Snapshot date:** 2026-04-25
**Context:** post-Wave-19 (perf + Layer 5 polish) and pre-Wave-20 docs backfill. 22+ PRs merged this session across Layers 0–5 of the Platform Overhaul.
**Audience:** new contributors, future agents, and reviewers needing a one-page mental model of the platform.

This is a snapshot, not a moving document. Per-module decisions live in [`docs/projects/platform-overhaul/decisions/`](projects/platform-overhaul/decisions/) and per-module ACs/handoffs live in [`docs/projects/platform-overhaul/handoffs/`](projects/platform-overhaul/handoffs/). When this doc disagrees with a locked decision doc, the decision doc wins.

---

## 1. System Overview

YCM is a multi-tenant SaaS for condo/HOA property managers. It serves five operator personas (Platform Admin, Manager, Board Officer, Assisted Board, PM Assistant) plus an Owner persona who logs into a separate Owner Portal session.

```
                    ┌───────────────────────────────┐
                    │  Browser (React + Vite SPA)   │
                    │  /app/*  (operator persona)   │
                    │  /portal/* (owner persona)    │
                    │  /community/:associationId    │
                    │  /payment-link/:token         │
                    └───────────────────────────────┘
                                  │
                                  │ HTTPS
                                  ▼
                    ┌───────────────────────────────┐
                    │  Express.js (server/index.ts) │
                    │  - Passport sessions          │
                    │  - 588 REST endpoints         │
                    │  - Stripe + Twilio webhooks   │
                    │  - SSE for live alerts        │
                    └───────────────────────────────┘
                                  │
                ┌─────────────────┼─────────────────┐
                │                 │                 │
                ▼                 ▼                 ▼
       ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
       │   Postgres   │  │   Stripe     │  │   Twilio     │
       │   (Neon)     │  │   (billing + │  │   (SMS/email │
       │   drizzle    │  │   payments)  │  │   delivery)  │
       └──────────────┘  └──────────────┘  └──────────────┘
```

**Stack:**

- **Client:** React 18 + Vite + TypeScript + TanStack Query + Wouter (router) + Tailwind + shadcn/ui + Radix primitives + Recharts (lazy). Single-page app.
- **Server:** Node.js + Express + Passport (sessions in Postgres) + drizzle-orm + zod (partial). Single process, no microservices.
- **Database:** Postgres 16 (Neon serverless in prod, Postgres locally / `pglite + pg-gateway` in test).
- **Payments:** Stripe Connect for ACH + card payments; Stripe Billing for platform subscriptions.
- **Communications:** Twilio (SMS), Sendgrid-compatible SMTP (email), Web Push API (push, dark-launched).
- **AI:** Anthropic API for document ingestion (governing document parsing, extraction).
- **E2E:** Playwright real-browser harness with ephemeral Postgres (Wave 16b/17).

**Repository layout (top-level):**

| Path | Contents |
|---|---|
| `client/src/` | React SPA — pages, components, hooks, lib utilities |
| `server/` | Express app entry, route definitions, auth, storage layer, services |
| `shared/` | Cross-cut types, schemas (`schema.ts`), feature flags, utilities used by both client and server |
| `migrations/` | drizzle migration files + `meta/_journal.json` |
| `tests/` | Vitest unit + integration suites |
| `e2e/` | Playwright specs (Wave 15+) |
| `docs/` | Decision docs, handoffs, architecture refs (this doc) |

---

## 2. Module Inventory (Layers 0–5)

The Platform Overhaul groups all work into six layers. Each module has a decision doc in `docs/projects/platform-overhaul/decisions/`.

### Layer 0 — Foundational Decisions
| ID | Module | Status |
|---|---|---|
| 0.1 | Dashboard Resolution | SPEC LOCKED · IN REVIEW (10/10 ACs satisfied via Phase 5) |
| 0.2 | Persona Map | SPEC LOCKED — 6-persona model (Platform Admin / Manager / Board Officer / Assisted Board / PM Assistant / Owner) |
| 0.3 | Navigation Model | SPEC LOCKED — single canonical role-filtered sidebar, shared `/app` shell, distinct landings |

### Layer 1 — IA Taxonomy
| ID | Module | Status |
|---|---|---|
| 1.1 | Zone taxonomy corrections | SPEC LOCKED · IN REVIEW — six zones (Home/Financials/Operations/Governance/Communications/Platform) |
| 1.2 | Section hub reclassification | SPEC LOCKED — zone-root URL convention, zone-label-only naming (no "Hub"/"Overview" suffix) |
| 1.3 | Breadcrumb label audit | SPEC LOCKED — central path registry, persona-invariant, mobile single-level collapse |
| 1.4 | Page title consistency | SPEC LOCKED — `{Page Title} — YCM` via `useDocumentTitle` hook |
| 1.5 | Hub visibility rename | SPEC LOCKED — HV-1 + HV-2 shipped; HV-3 (drop old enum values) deferred |

### Layer 2 — Role & Permission Model
| ID | Module | Status |
|---|---|---|
| 2.1 | Role model audit | SPEC LOCKED — single canonical `AdminRole`, alias migrate + remove |
| 2.2 | Owner Portal access boundaries | SPEC LOCKED — portal role enum collapses to `owner` |
| 2.3 | Permission boundary corrections | SPEC LOCKED — `<RouteGuard>` pattern (ADR 0b) |
| 2.4 | Platform-admin surface audit | SPEC LOCKED — narrows platform/admin/ai endpoints to `["platform-admin"]` |

### Layer 3 — Navigation Restructure
| ID | Module | Status |
|---|---|---|
| 3.1 | Sidebar redesign | SPEC LOCKED — zone groups + SUBSET-RENDER + persona toggles |
| 3.2 | Route restructure | SPEC LOCKED — 61-route canonical table (incl. `/app/settings/billing` + `/app/communications/inbox`) |
| 3.3 | Role-gating corrections | SPEC LOCKED — 5 zone landings + parity harness |
| 3.4 | Breadcrumb implementation | SPEC LOCKED — 37 surfaces across operator + portal |
| 3.5 | Owner Portal restructure | SPEC LOCKED — `PortalShell` + 8 zone files, big-bang migration, legacy-URL compat layer |

### Layer 4 — Feature Gaps
| ID | Module | Status |
|---|---|---|
| 4.1 | Cross-association alert engine | SPEC LOCKED · IN BUILD — 9 source types, single aggregation endpoint, `HubAlertWidget` |
| 4.2 | Owner portal gaps | SPEC LOCKED — amenities-toggle addendum, session-gate inheritance, community zone-wrapper |
| 4.3 | Recurring assessment rules engine | SPEC LOCKED · IN BUILD — `assessment-execution.ts` orchestrator + parity harness |
| 4.4 | Signup and checkout flow | IN SPEC (partial) — Q1/Q3/Q4/Q7 P1 shipped; Q2/Q5/Q6 + Q4 Phase 0 migration deferred |

### Layer 5 — Polish & Hardening
| ID | Module | Status |
|---|---|---|
| 5.1 | Empty states | SPEC LOCKED · IN BUILD — `<EmptyState>` adopted on portal + zone hubs + financial-rules |
| 5.2 | Error states | SPEC LOCKED · IN BUILD — `<ErrorState>`, `<ErrorBoundary>`, `reportError` helper |
| 5.3 | Mobile audit | SPEC LOCKED · IN BUILD — scrollable tab lists, overflow-x-auto on tables; full retrofit deferred |
| 5.4 | Performance audit | SPEC LOCKED · IN BUILD — F1 batch fan-out, F2 migration, F4 lazy recharts, F5 perf harness, F6 dynamic-import, F7 virtualized ledger |

---

## 3. Key Architectural Decisions

### 3.1 RouteGuard pattern (ADR 0b)

Single source of truth for client-side persona gating: every protected route in `client/src/App.tsx` is wrapped by a declarative `<RouteGuard persona={...}>` component. The guard reads the active session, computes the resolved persona via `resolvePersona()`, and either renders or redirects to the persona's canonical landing.

- ADR: [`docs/projects/platform-overhaul/adrs/0b-routeguard-personaaccess-contract.md`](projects/platform-overhaul/adrs/0b-routeguard-personaaccess-contract.md)
- Phase 0b.2 stub implementation merged via reconciliation PR #13 (2026-04-22).
- Migration path: 31 of 40 `/app/*` pages had no client guard pre-overhaul; sweep ongoing as Layer 3 modules ship.

### 3.2 Cross-association alert engine (4.1)

Server-aggregated alert system that fans out across the operator's entire portfolio.

- 9 source types: overdue work orders, due maintenance, active elections, delinquent ledger balances, expiring governance docs, budget variance, insurance expiry, unpaid late fees, vendor contract renewals (`server/alerts/sources/`).
- `canAccessAlert(persona, alert)` predicate prevents leakage across 0.2 toggle boundaries (`server/alerts/can-access-alert.ts`).
- Single aggregation endpoint `GET /api/alerts/cross-association` with 60 s cache and targeted invalidation (Wave 19 F1 batch fan-out).
- Real-time cache invalidation on source writes (Wave 19) — 9 source-type write paths fire targeted invalidates.
- Surfaces: Home cross-association panel + 4 zone-hub `HubAlertWidget` instances (count badge + top-3 mini-list + "All clear" empty state, persona-invariant).
- Decision doc: [`decisions/4.1-cross-association-alert-engine.md`](projects/platform-overhaul/decisions/4.1-cross-association-alert-engine.md).

### 3.3 Assessment execution orchestrator (4.3 Q3)

Unified pipeline replacing legacy per-subsystem posters (`runDueRecurringCharges`, `processSpecialAssessmentInstallments`).

- `server/assessment-execution.ts` is now the sole posting path.
- `server/assessment-execution-parity.ts` ran the shadow-write parity window before cutover.
- `assessmentRunLog` audit table records every run.
- `ASSESSMENT_EXECUTION_UNIFIED` feature flag (default ON, removable once every env has run with it ON across one full monthly cycle); per-association override supported.
- `server/assessment-ownership.ts` handles per-owner-portion calc for the 4.3 Q5 portal drill-in.
- Decision doc: [`decisions/4.3-recurring-assessment-rules-engine.md`](projects/platform-overhaul/decisions/4.3-recurring-assessment-rules-engine.md).

### 3.4 PortalShell (3.5)

Mirror of `WorkspaceShell` for the owner-portal side. Centralizes session gate, navigation, breadcrumb, and document title for all `/portal/*` routes. Each zone (Home/Finances/Requests/Community/Amenities/Documents/Notices) gets one `portal-<zone>.tsx` file under `client/src/pages/portal/`.

- Big-bang migration cutover deletes the 3,935-LoC `owner-portal.tsx` mega-file in a single PR.
- Legacy-URL compat layer: `/portal?tab=<legacy>` 301-redirects to new hub URLs; removal becomes an AC of 5.1 once analytics show zero hits for one full notice cycle.
- Decision doc: [`decisions/3.5-owner-portal-restructure.md`](projects/platform-overhaul/decisions/3.5-owner-portal-restructure.md).

### 3.5 Feature flag contract

All flags live in `shared/feature-flags.ts`. Server reads `process.env.FEATURE_FLAG_<KEY>`; client (Vite bundle) reads `import.meta.env.VITE_FEATURE_FLAG_<KEY>`. Defaults are the single source of truth in `DEFAULTS` in that file. Per-association override supported via `getFeatureFlagForAssociation()`.

---

## 4. Feature Flag Inventory

As of 2026-04-25, four flags exist in `shared/feature-flags.ts`:

| Flag | Default | Lifecycle |
|---|---|---|
| `PORTAL_ROLE_COLLAPSE` | ON | Phase 8b dark-launch (OFF) → Phase 8a flipped ON alongside migration `0014_portal_role_collapse.sql` → Phase 8c will remove the flag from code. |
| `BOARD_SHUNT_ACTIVE` | ON | Phase 13 dark-launch (ON). When flipped OFF, `board-officer` / `assisted-board` sessions fall through to `WorkspaceShell` + `AppSidebar` instead of the legacy shunt at `client/src/App.tsx:1051-1057`. Removed entirely after one clean release cycle with flag OFF. |
| `ASSESSMENT_EXECUTION_UNIFIED` | ON | Wave 7 (4.3 Q3) introduced default OFF as a shadow-write parity window. Wave 12 flipped default ON and deleted legacy posters. Per-association override supported via `FEATURE_FLAG_ASSESSMENT_EXECUTION_UNIFIED_<associationId>`. Scheduled for removal once every env runs with the flag ON across one full monthly billing cycle. |
| `HUB_VISIBILITY_RENAME` | ON | 1.5 HV-1 introduced default OFF. HV-2 flipped to default ON; prod-data audit confirmed zero old-vocab rows in `hub_map_issues` and `community_announcements`. Belt-and-suspenders kill-switch; removed in HV-3. |

---

## 5. Outstanding Migrations

These are deferred, blocking nothing critical, but tracked for follow-up:

| Migration | Status | Notes |
|---|---|---|
| **HV-3 — Hub Visibility Rename Phase 3** | Deferred | Drops old enum values from `hub_visibility_level` pgEnum and recasts `hub_map_issues.visibility_level` + `community_announcements.visibility_level` columns. Prerequisite: every call site uses new vocab exclusively. Tracked as 1.5 HV-3. |
| **AdminRole alias migration** | Deferred | `normalizeAdminRole` accepts 10 aliases; canonical 13-role schema enum lives in `shared/adminUserRoleEnum`. Plan: migrate any persisted aliases, then delete the normalizer. Tracked as 2.1 Q11. |
| **Phase 0 billing schema migration** | Deferred (4.4 Q4) | Out of overhaul scope; filed as a dedicated billing-migration initiative. `platformSubscriptions` remains the signup-write source. |
| **`hoaFeeSchedules` retirement** | Queued (PPM `bc8aa43f`) | Migrate data into `recurringChargeSchedules` per 4.3 Q1. Track in PPM. |
| **`adminUsers.onboarding_dismissed_at`** | Shipped | 4.4 Q2 onboarding-banner column landed in `0017_admin_users_onboarding_dismissed_at.sql` (or equivalent — see migrations journal). |

---

## 6. Test Surface

Three test layers, all required in CI:

### 6.1 Vitest unit + integration

- **Suite size:** ~165 tests at end of Wave 19 (was 91 → 124 → 165 over the session).
- **Locations:** `tests/*.test.ts(x)` (client + server) and `server/alerts/__tests__/`, `server/__tests__/`.
- **Notable suites:**
  - `tests/empty-state.client.test.tsx` (12) + `tests/error-state.client.test.tsx` (8) + `tests/error-boundary.client.test.tsx` (7) — Layer 5 polish (Wave 14).
  - `tests/perf-smoke.server.test.ts` — perf regression baseline (Wave 14).
  - `tests/mobile-audit.client.test.tsx` (4) — mobile retrofit smoke (Wave 14).
  - `tests/parity-harness/*.test.ts` — manifest-data parity (Phase 10, ~33 tests).
  - `server/alerts/__tests__/*.test.ts` — 9 source-type unit tests + cross-association endpoint test + access-control test.
  - Breadcrumb tests (23) — Phase 6 path-registry coverage.
  - `useDocumentTitle` tests (6) — 1.4 Phase 3 coverage.
- **Run:** `npx vitest run`. Watch mode is `npx vitest`.

### 6.2 Vitest server integration via ephemeral Postgres

- **Mechanism:** `pglite + pg-gateway` provides a TCP-shaped Postgres in-process; `drizzle-kit push` brings up the schema; session DB is injected.
- **Source:** `tests/test-db.ts` (Wave 17).
- **Used by:** alert source-type integration tests, assessment-execution parity tests, signup flow tests.

### 6.3 Playwright real-browser E2E

- **Locations:** `e2e/*.spec.ts` (Wave 15+).
- **Specs:**
  - `e2e/signup.spec.ts` — anonymous signup → operator login (Wave 16).
  - `e2e/alerts.spec.ts` — Home cross-association panel + zone-hub widgets (Wave 16).
  - `e2e/assessment.spec.ts` — assessment-rules UI + run-history (Wave 16).
  - `e2e/portal-navigation.spec.ts` — owner-portal navigation across all 7 zones (Wave 16, deep-content assertions in Wave 16c follow-up).
  - `e2e/amenities-toggle.spec.ts` — 4.2 amenities-enabled toggle behavior (Wave 16).
- **Backend:** real ephemeral Postgres (Wave 16b), real Express server. OAuth + portal OTP login helpers are stubbed; real-OAuth helpers tracked as Wave 16d follow-up.
- **Run:** `npx playwright test`.

---

## 7. Deployment Topology

| Surface | Provider | Purpose |
|---|---|---|
| **Primary app (production)** | Replit Deployments | Hosts the Express server + serves the Vite-built static SPA. Single VM. |
| **Webhooks + scheduled jobs** | Fly.io | Stripe + Twilio webhooks, scheduled assessment runs, alert cache invalidations, election scheduler (`server/election-scheduler.ts`). |
| **Database** | Neon | Postgres 16 serverless. Single primary; branches used for staging + per-PR ephemeral test DBs (manual setup). |
| **CDN / static assets** | Replit (origin) | Vite-built bundle served directly; CDN layered in front. |
| **Email** | Sendgrid-compatible SMTP via env | `server/email-provider.ts`. |
| **SMS** | Twilio | `server/sms-provider.ts`. |
| **Push** | Web Push (VAPID) | `server/push-provider.ts`; service worker in `client/public/sw.js`. |
| **Payments** | Stripe Connect + Billing | Direct API + webhooks under `/api/webhooks/payments` and `/api/webhooks/platform/stripe`. |
| **AI ingestion** | Anthropic API | Document parsing pipeline (`server/services/*` AI endpoints). |

**CI:** GitHub Actions runs `npm ci` → `npm run check` (tsc) → `npm run lint` (ESLint) → `npx vitest run` → `npm run build` (Vite). Playwright runs in a separate workflow due to runtime cost.

**Branch protection:** main requires green CI on all 4 gates (check + lint + vitest + build) and one approving review.

---

## 8. Observability

Currently lightweight:

- **Server logs:** structured via `server/logger.ts` (winston-style). Stdout in dev; piped to platform logger in prod.
- **Error reporting:** `client/src/lib/error-reporting.ts` is a `console.error` shim with a TODO for full observability (Sentry, etc.) — Wave 14 deliverable.
- **Audit trail:** `assessmentRunLog` (4.3) records every assessment-pipeline run; admin actions on associations/units/persons are audited via `auditEntries` table.
- **Health probes:** `GET /api/health` (anonymous, liveness) + `GET /api/health/details` (Platform Admin, deep readiness).

Filed as Wave 20 follow-up: end-to-end observability story (metrics, traces, error-reporting integration).

---

## 9. Cross-cutting Conventions

- **Zone tags:** every page/component file carries a `// @zone: <Home|Financials|Operations|Governance|Communications|Platform|cross-cutting>` comment per 1.1.
- **Document titles:** every page calls `useDocumentTitle("<Page Title>")` per 1.4. ESLint rule prohibits the literal string `"Dashboard"`.
- **Empty + error states:** every list/table surface should consume `<EmptyState>` + `<ErrorState>` per 5.1/5.2; full retrofit deferred but new surfaces are gated.
- **Persona invariance:** breadcrumbs and zone labels are persona-invariant per 1.3 and 0.3.
- **No hub/overview suffix:** zone landings are named `Financials`, not `Financials Hub` / `Financials Overview`. ESLint enforced per 1.2.

---

## 10. Glossary

- **Persona** — one of the 6 user types (Platform Admin / Manager / Board Officer / Assisted Board / PM Assistant / Owner). Computed from session role + association membership.
- **Zone** — top-level navigation grouping (Home / Financials / Operations / Governance / Communications / Platform). Persona-invariant; visibility filtered by role.
- **Hub / Zone landing** — the canonical page at the zone root URL (e.g. `/app/financials`).
- **Operator** — any non-Owner persona with admin-side access.
- **PortalShell** — the owner-side mirror of `WorkspaceShell` (3.5).
- **Big-bang migration** — single-PR cutover with no incremental dual-write window. Used for 3.5 Owner Portal restructure.

---

## 11. Out-of-scope from this snapshot

- Per-handler request/response schemas (see `docs/api-reference-2026-04-25.md`).
- Per-decision Acceptance Criteria (see `docs/projects/platform-overhaul/decisions/<id>-*.md`).
- PPM task-card content (see `docs/projects/platform-overhaul/ppm/<id>-*-task.md`).
- Wave-by-wave change log (see `docs/projects/platform-overhaul/00-index.md` Change Log section).

When this doc disagrees with the corresponding artifact above, the artifact wins.
