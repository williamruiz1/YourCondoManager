# YCM End-to-End Gap Audit — 2026-04-10

## Executive Summary

Full-platform audit of YourCondoManager covering static analysis, build/typecheck, existing verify scripts, and live dev-server walkthrough. The platform is impressively broad — 60+ pages, 535 route registrations across 418 unique endpoints, 137 database tables, 50 roadmap projects (42 complete). TypeScript checks and production build both pass cleanly. All existing verify scripts pass.

However, four **critical runtime bugs** were found, along with several high/medium-priority gaps in code hygiene, coverage, and operational readiness.

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
