# YCM End-to-End Gap Audit — 2026-04-10

> **Document status:** Historical snapshot of the platform state on 2026-04-10 before remediation. Findings are preserved as originally written. See **Resolution Status** immediately below for what has since been fixed, and the **Follow-up Review** appendix at the end for new findings that emerged during the fix wave.

## Executive Summary

Full-platform audit of YourCondoManager covering static analysis, build/typecheck, existing verify scripts, and live dev-server walkthrough. The platform is impressively broad — 60+ pages, 535 route registrations across 418 unique endpoints, 137 database tables, 50 roadmap projects (42 complete). TypeScript checks and production build both pass cleanly. All existing verify scripts pass.

However, four **critical runtime bugs** were found, along with several high/medium-priority gaps in code hygiene, coverage, and operational readiness.

---

## Resolution Status (as of 2026-04-10 follow-up review)

| ID | Finding | Status | Fix Commit(s) |
|----|---------|--------|---------------|
| G1 | `/api/health` requires platform-admin | **RESOLVED** | `9aa55f3`, `ff842da` (split into public probe + admin details) |
| G2 | `/api/*` 404s swallowed by SPA fallback | **RESOLVED** | `0c73bf6`, `ff842da` (Express 5 path-to-regexp syntax) |
| G3 | Demo request 500 from `admin@local` | **RESOLVED** | `cf40ced` (filter non-RFC admin emails before send) |
| G4 | `/uploads/*` missing files return HTML | **RESOLVED** | `0c73bf6`, `ff842da` (same JSON 404 handler) |
| G5 | ~6k lines of dead page files | **RESOLVED** | `51cf675` (all four files deleted) |
| G6 | `BoardPackagesPage` imported but never rendered | **RESOLVED** | `1733235` (lazy import removed; file retained — still imports `BoardPackagesContent` from `governance.tsx`) |
| G7 | Durable memory stale | **RESOLVED** | `4dff9c7`, `689b040`, `npm run bootstrap:agent` |
| G8 | PostCSS plugin warning | **RESOLVED** | `d90f96c` (customLogger suppresses false-positive from Tailwind v3; root cause documented) |
| G9 | Oversized client bundle (`index.js` 511 kB) | **RESOLVED** | `843afcc` (main chunk 511 kB → 213 kB, 58% reduction) |
| G10 | 38 `console.log` in server code | **RESOLVED** | `b7e9aef`, `de6f617` (replaced with gated `debug()` helper in `server/logger.ts`) |
| G11 | Monolithic `storage.ts` / `routes.ts` | Deferred | No action taken — flagged as architectural, not blocking |
| G12 | Push notifications not configured | Deferred | Expected for dev; production gap tracked on `SMS & Push Notifications` roadmap project |
| G13 | Browserslist dataset 6 months old | **RESOLVED** | `de6f617` (dataset refreshed) |
| G14 | `verify:mobile` is a manual checklist | Deferred | No action — informational, replacement would be a new roadmap item |

**Catchall inbox impact:** All 13 actionable tasks `done` (as of the F2 + F1 follow-ups); G11/G12/G14 intentionally deferred as architectural/operational rather than bugs. The three new findings from the follow-up review (F1/F2/F3) are all now resolved — F2 by commit `62a756a`, F3 by commit `a97d8d5`, F1 by a narrower deletion than originally scoped (see appendix).

---

## Build & Typecheck Status

| Check | Result | Notes |
|-------|--------|-------|
| `npm run check` (tsc) | **PASS** | Zero errors. Previously known IStorage mismatch and matchAll issues are resolved. |
| `npm run build` | **PASS** | Builds in ~8s client + 275ms server. Two warnings (see G8, G9, G12 below). |
| `npm run test:payments` | **PASS** | 10/10 schema & scenario checks. |
| `npm run verify:owner-portal-multi-unit` | **PASS** | All 3 scenarios, 4 checks pass. |
| `npm run verify:mobile` | **INFO** | Prints a manual checklist — not an automated test. |

---

## Findings

### CRITICAL — Reproducible Bugs

#### G1: `/api/health` requires platform-admin authentication
- **Location:** `server/routes.ts:1178`
- **Impact:** External monitors, load balancers, Kubernetes liveness probes, and uptime services cannot reach the health endpoint. Any monitoring integration will get a 403.
- **Reproduction:** `curl http://localhost:5050/api/health` → 403 `ADMIN_SESSION_REQUIRED`
- **Fix:** Remove `requireAdmin` and `requireAdminRole` from the health route.

#### G2: Unregistered `/api/*` paths return 200 HTML (SPA fallback swallows API 404s)
- **Location:** Vite dev middleware + Express static serving
- **Impact:** Any typo in an API path, any missing endpoint, any unregistered verb silently returns the SPA HTML shell with status 200. Client code parsing this as JSON will fail with confusing errors. This affects **both GET and POST** methods.
- **Reproduction:** `curl http://localhost:5050/api/this-does-not-exist` → 200 HTML
- **Fix:** Add an Express middleware `app.all("/api/*", (req, res) => res.status(404).json({ message: "Not found" }))` before the Vite/static SPA fallback.

#### G3: Demo request endpoint crashes with 500 due to seeded `admin@local` email
- **Location:** `server/routes.ts:8264` (`POST /api/public/demo-request`)
- **Impact:** The marketing-site demo request form is completely broken in any environment with the default admin seed. The handler calls `sendPlatformAdminEmailNotification`, which collects admin emails. The seeded `admin@local` address fails RFC validation in the email transport, causing the entire request to error.
- **Reproduction:** `curl -X POST -H 'Content-Type: application/json' -d '{"name":"t","email":"t@t.com"}' http://localhost:5050/api/public/demo-request` → 500 `Invalid email address: admin@local`
- **Fix:** Either (a) seed admin accounts with valid RFC-compliant emails, or (b) filter invalid emails from notification recipients before sending, or (c) catch transport errors per-recipient and continue to the next.

#### G4: Missing uploaded files return SPA HTML instead of 404
- **Location:** `/uploads/*` path, same SPA fallback issue as G2
- **Impact:** Broken document links return the app shell HTML instead of a 404. Clients rendering attachments may display HTML as binary garbage. Download links silently serve wrong content.
- **Reproduction:** `curl http://localhost:5050/uploads/nonexistent.pdf` → 200 HTML
- **Fix:** Covered by the same `/api/*` 404 handler approach — also add one for `/uploads/*`.

---

### HIGH

#### G5: ~6,000 lines of dead page files
- **Files:**
  - `client/src/pages/owner-portal.backup.tsx` — 4,768 lines, never imported anywhere
  - `client/src/pages/owner-portal-redesign.tsx` — 885 lines, never imported or routed
  - `client/src/pages/occupancy.tsx` — not imported in App.tsx, route is a pure redirect to `/app/units`
  - `client/src/pages/owners.tsx` — not imported in App.tsx, route is a pure redirect to `/app/persons`
- **Impact:** Dead code adds confusion, increases bundle risk (if accidentally imported), and inflates codebase size.
- **Fix:** Delete all four files. If occupancy.tsx or owners.tsx have useful logic that was merged into units.tsx/persons.tsx, confirm before deleting.

#### G6: `BoardPackagesPage` imported but never rendered
- **Location:** `client/src/App.tsx:69` (lazy import) and line 295 (redirect only)
- **Impact:** The lazy import allocates a code-split chunk (`board-packages-D1rbEOCf.js`, 28.43kB) that is downloaded but never used. The route `/app/governance/board-packages` redirects to `/app/governance` without ever mounting `BoardPackagesPage`.
- **Fix:** Either wire the component to a live route or remove the import and let the redirect handle it.

#### G7: Agent bootstrap durable memory is stale
- **Location:** `docs/agent-bootstrap/durable-memory.json`
- **Impact:** The `recurringRepoIssues` section claims IStorage mismatch and matchAll iterator issues still exist — both are resolved. The `activeRoadmapContext` section lists the owner portal multi-unit verifier task as open (`todo`), but it's actually marked `done` in the database. Agents relying on durable memory will waste time investigating non-issues.
- **Fix:** Run `npm run bootstrap:agent` to regenerate.

---

### MEDIUM

#### G8: PostCSS plugin warning during production build (existing catchall task)
- **Build output:** `A PostCSS plugin did not pass the 'from' option to postcss.parse`
- **Catchall task:** `e6fcb951-ef9f-4e12-8d9c-51fb9f7ab222` (status: todo, priority: medium)
- **Status:** Still reproducible. No action beyond existing task.

#### G9: Oversized client bundle chunks (existing catchall task)
- **Build output:** `index-DroBBJ8q.js` 511kB (gzip 153kB), `BarChart-Bo16Hp9A.js` 375kB (gzip 103kB), `owner-portal-DkBC20Pd.js` 118kB (gzip 23kB)
- **Catchall task:** `7b371ed9-1902-48a4-a816-a108e13b32e0` (status: todo, priority: medium)
- **Status:** Still reproducible. The Vite warning about >500kB chunks fires on `index.js`.

#### G10: 38 `console.log` calls in server code
- **Distribution:** routes.ts (29), seed.ts (3), logger.ts (1), scripts/sync-db.ts (5)
- **Hotspots:** Portal provisioning (10 calls, lines 9926-9981), election workflow (8 calls, lines 5450-5966), admin context debug (line 785)
- **Impact:** Verbose stdout in production. Not a bug, but a noise/privacy concern.
- **Fix:** Replace with structured logger at debug level, or gate behind `NODE_ENV !== "production"`.

#### G11: Monolithic server files
- `server/storage.ts` — 16,999 lines
- `server/routes.ts` — 14,470 lines
- **Impact:** Maintainability and navigation friction. Not blocking, but increases cognitive load for any change.

#### G12: Push notifications not configured
- **Endpoint:** `GET /api/portal/push/vapid-public-key` returns `{"configured":false,"publicKey":null}`
- **Impact:** Owner portal push notification subscribe flow will silently fail. The SMS & Push Notifications roadmap project is listed as `active`.
- **Note:** This is expected for dev environments but should be verified in production.

---

### LOW

#### G13: Browserslist dataset 6 months old (existing catchall task)
- **Build output:** `Browserslist: browsers data (caniuse-lite) is 6 months old`
- **Catchall task:** `00c67859-5d7f-4c5e-b7cc-d3faf29bb3f0` (status: todo, priority: low)
- **Fix:** `npx update-browserslist-db@latest`

#### G14: `verify:mobile` is a manual checklist, not automated
- **Impact:** Mobile regression testing requires manual execution of the printed checklist. No automated mobile verification exists.

---

## Domain Coverage Matrix

### Fully Covered (UI + API + Storage + Schema + Seed)
Associations, Units, Persons, Ownerships, Occupancies, Board Roles, Elections, Admin Roadmap, Platform Admin

### Covered but No Seed Data (UI + API + Storage + Schema, no seed)
Work Orders, Maintenance Schedules, Inspections, Vendors, Vendor Portal, Financial Foundation, Billing/Invoices, Late Fees, Payments, Owner Ledger, Budgets, Expenses, Financial Reports, Governance Meetings, Governance Compliance, Board Packages, Announcements, Communications, Resident Feedback, Onboarding Invites, Insurance, AI Ingestion, Portfolio

### Partially Covered (asymmetries between layers)
- **Owner Portal:** Auth + payment links wired; dashboard/documents/notices partially UI-only
- **Board Portal:** Dashboard + meetings wired; limited backend depth
- **Community Hub:** Page structure + maps exist; no seed, editing workflows partial
- **Plan Signup:** Pricing page + subscription table exist; checkout/trial flow backend minimal
- **Documents:** CRUD works but read-access ACLs not explicit in schema

### Key Asymmetries
1. **Financial fragmentation** — 94 routes span 8+ financial subdomains; owner-facing billing and reconciliation are partially wired
2. **Vendor portal silos** — Login + work-order view exist but no vendor seed data to exercise
3. **Election vs. governance parity** — Elections fully seeded with 32 routes; meetings/compliance/tasks have routes but no seed
4. **Insurance claims missing** — Policy CRUD exists; claims workflow absent from API and schema

---

## Active Roadmap Projects (for context)
| Project | Status |
|---------|--------|
| Admin Roadmap Catchall Findings Inbox | active |
| Association Community Hub | active |
| Full Help Center | active |
| Lease And Occupancy Workspace Redesign | active |
| Plan Sign-Up & Subscription Billing | active |
| SMS & Push Notifications | active |

---

## Catchall Tasks Created by This Audit

New tasks added to **Admin Roadmap Catchall Findings Inbox** (`ed8345a1`):

| Title | Priority | Workstream |
|-------|----------|------------|
| Make /api/health endpoint publicly accessible without admin auth | critical | Open Findings Inbox |
| Add /api/* and /uploads/* 404 JSON handler before SPA fallback | critical | Open Findings Inbox |
| Fix demo-request 500 caused by non-RFC admin@local seed email | high | Open Findings Inbox |
| Delete orphaned page files (owner-portal.backup, owner-portal-redesign, occupancy, owners) | medium | Open Findings Inbox |
| Replace server console.log calls with structured debug-level logging | low | Verification Drift And Tooling Signals |

---

## Methodology

- **Static audit:** Cross-referenced App.tsx lazy imports and routes against page files, API handlers, storage methods, schema tables, and seed data
- **Typecheck & build:** `npm run check` + `npm run build` with full warning capture
- **Verify scripts:** `npm run test:payments`, `npm run verify:owner-portal-multi-unit`, `npm run verify:mobile`
- **Live walkthrough:** Started dev server on port 5050, probed 30+ API endpoints via curl (both GET and POST), verified auth gates, 404 behavior, portal login flow, public endpoints
- **Database inspection:** Queried roadmap projects, workstreams, tasks, and table structure directly via psql
- **Agent-assisted analysis:** Three parallel Explore agents performed route inventory (535 registrations), dead code audit, and domain coverage matrix construction

---

## Appendix — Follow-up Review (same day)

A fresh-eyes review of the fix wave surfaced three new findings not in the original audit. They were captured as new catchall tasks and left `todo` since they emerged from the remediation itself, not the original platform state.

### F1: ~~9 orphaned financial page files~~ — actually only 1; correction below
- **Type:** Initial finding was wrong. Corrected scope retained as a historical record of the correction.
- **Original claim:** Commit `bc2984a` removed nine financial page lazy imports from `App.tsx`, and the original review assumed all nine `.tsx` files were therefore dead.
- **Actual state after deeper grep:** Eight of the nine files are **still live** — they export named `*Content` components that the consolidated pages import and render as tab contents:
  - `financial-billing.tsx` → imports `FinancialLedgerContent`, `FinancialAssessmentsContent`, `FinancialLateFeesContent`
  - `financial-expenses.tsx` → imports `FinancialInvoicesContent`, `FinancialUtilitiesContent`, `FinancialBudgetsContent`
  - `financial-foundation.tsx` → imports `FinancialRecurringChargesContent`
  - `financial-reports.tsx` → imports `FinancialReconciliationContent`
- **Only one file was actually orphaned:** `client/src/pages/financial-fees.tsx` (332 lines) only exported a default `FinancialFeesPage` component with no `*Content` named export and no consumer. It was a genuine leftover from before the consolidation.
- **Fix:** Deleted `financial-fees.tsx` in a separate commit. The other eight files remain in place as the actual source of truth for the consolidated pages' tabs.
- **Lesson:** "Lazy import removed + route is a redirect" does not imply "file is dead." Always grep for *named* exports and their consumers before deleting a refactored module.
- **Priority:** Medium (resolved with corrected scope).

### F2: Portal login endpoints not rate-limited
- **Type:** Partial-fix gap introduced by `a3e5414`
- **Evidence:** `a3e5414` added a 20 req/min per-IP sliding-window rate limiter to `/api/public/*`. The real brute-force target, however, is the portal OTP login flow (`POST /api/portal/request-login` and `POST /api/portal/verify-login`) which is unauthenticated and still unprotected. An attacker enumerating portal emails or brute-forcing OTP codes will route around the public-only limiter entirely.
- **Fix:** Mount the same limiter on the portal login paths, with a tighter window for `verify-login` (e.g. 5 attempts per 10 minutes).
- **Priority:** High.

### F3: This document describes bugs that are now fixed
- **Type:** Documentation drift
- **Evidence:** The Findings section above was written against the pre-fix platform state. Without an explicit resolution marker, a reader could act on findings that have already been remediated.
- **Fix:** Covered by the Resolution Status table at the top of this document, added in the follow-up review. Catchall task retained so future audits remember to refresh historical reports rather than silently overwriting them.
- **Priority:** Low.

### Commit-hygiene observations (not tracked as tasks)

These are minor history-quality issues from the rapid parallel fix wave. No action required but worth noting if a future reader tries to follow the audit trail:

1. **`51cf675`** is titled "Delete ~6000 lines of orphaned dead page files" but also bundles: creation of the `debug()` helper in `server/logger.ts`, the initial import wiring in `server/routes.ts`, the first commit of this audit document, and a workspace manifest regeneration. Scope creep hides behind the deletion-focused title.
2. **`bc2984a`** is titled "Remove unused financial page lazy imports and dead board-packages page." The board-packages import was already removed in `1733235`; this commit only removes the nine financial imports. Title reads as if it is doing both removals.
3. **`82cd7b6`** created `client/src/lib/analytics.ts` unaware that `client/src/lib/tracking.ts` already existed; **`0ccffec`** removed the duplicate ~9 hours later. Net-zero code change but commit-history noise. The only consumer, `0e82476`, imported from the correct `tracking.ts` throughout.
4. **Twelve merge commits** from parallel agent worktrees (`worktree-agent-*`) between `9aa55f3` and `0cdefea`. All merged cleanly with no conflict resolution required — indicates the parallel agents were working on non-overlapping files.
