# YCM Security Maturity Roadmap — 2026-05-10

**Product:** YourCondoManager (YCM)
**Owner:** William Ruiz
**Status:** Draft — ready for [014] queue

## Background

YCM has four published security/privacy policy documents (Information Security Policy, Privacy Policy, Vulnerability Management Program, Data Retention Policy). A policy audit reveals a significant gap between what the documents describe and what the platform currently enforces. This roadmap closes every gap so the platform actually enforces what the policies claim.

YCM handles: HOA financial data, owner PII (name, email, phone, address), bank connections via Plaid, and payment history. The gap between policy and implementation creates legal, reputational, and trust risk.

**Nine workstreams are sequenced by dependency and risk impact.** WS1 gates all future PRs and ships first; the others can proceed in parallel after WS1 lands.

---

## Workstream 1 — CI Security Gate

**Priority: HIGHEST — ships first, unblocks all future security PRs**

### Current State
CI pipeline (`ci.yml`) runs `tsc`, `eslint`, `vitest`, `playwright`, and a build check. There is no `npm audit` step. Dependency vulnerabilities are only discovered manually. No automated CVE labeling on PRs.

### Target State
A dedicated `security.yml` GitHub Actions workflow that runs on every PR targeting `main`:

1. `npm audit --audit-level=critical` — fails the PR check if any critical CVEs are found
2. `npx tsc --noEmit` — explicit type-safety gate in the security context (belt-and-suspenders: also runs in `ci.yml check` job, but the security gate makes it visible alongside vulnerability results)
3. GitHub label applied to PR if high or moderate vulnerabilities are found: `security: high-vulns` or `security: moderate-vulns`

The workflow should NOT block on moderate/high — only critical CVEs fail. High/moderate result in a label so the PR author is aware and can triage without blocking unrelated work.

### Acceptance Criteria
- [ ] `.github/workflows/security.yml` exists and triggers on `pull_request` targeting `main`
- [ ] `npm audit --audit-level=critical` step fails with exit code 1 if any critical CVEs exist
- [ ] PR is labeled `security: critical-vulns` on critical, `security: high-vulns` on high, `security: moderate-vulns` on moderate (using `gh` CLI in the workflow)
- [ ] Running `npm audit --audit-level=critical` on the current `main` passes (zero critical CVEs) — if not, remediation PR ships alongside this WS
- [ ] TypeScript strict check passes in this workflow
- [ ] Workflow does NOT duplicate the jobs that already exist in `ci.yml` — security gate is additive

### Files to Touch
- **Create:** `.github/workflows/security.yml`
- **Read first:** `.github/workflows/ci.yml` (to avoid duplication, match Node version)

### Notes
- Use `actions/setup-node@v4` with `node-version: "24"` (matches existing CI)
- Store no new secrets — `GITHUB_TOKEN` is sufficient for label operations
- If critical CVEs are found during implementation, open a separate remediation PR with the upgrades before merging WS1

---

## Workstream 2 — Privacy Policy Live Page

**Priority: HIGH — policy is published but not publicly accessible via app URL**

### Current State
`client/src/pages/privacy-policy.tsx` exists (506 lines) and is routed at `/privacy-policy` in `App.tsx`. `client/src/pages/terms-of-service.tsx` also exists, routed at `/terms-of-service`. Both pages are already wired and rendering in the app.

However:
- The privacy policy URL is `/privacy-policy` — the spec target is `/privacy` (shorter canonical URL)
- It is unclear whether the landing page footer links to these pages from unauthenticated views
- No redirect aliases from alternative paths (`/privacy`, `/terms`) to the canonical routes

### Target State
- Canonical URLs: `/privacy` and `/terms` (short form), with redirects from `/privacy-policy` → `/privacy` and `/terms-of-service` → `/terms`
- Landing page footer (`client/src/pages/landing.tsx`) links to both pages — visible to unauthenticated visitors
- Pages render without requiring login (they are public routes, not behind `requireAdmin` or session checks)
- Meta tags on both pages: `<title>`, `<meta name="description">`, and canonical link tag

### Acceptance Criteria
- [ ] `GET /privacy` serves the privacy policy page (no login required)
- [ ] `GET /terms` serves the terms of service page (no login required)
- [ ] `GET /privacy-policy` redirects 301 → `/privacy` (or client-side redirect via `<Route>`)
- [ ] `GET /terms-of-service` redirects 301 → `/terms` (or client-side redirect)
- [ ] Landing page footer contains links to `/privacy` and `/terms`
- [ ] Pages render correctly while logged out (verify in Playwright or manual test)
- [ ] No login wall intercepts these routes

### Files to Touch
- **Modify:** `client/src/App.tsx` — add `/privacy` and `/terms` routes + redirects from old paths
- **Read first:** `client/src/pages/privacy-policy.tsx` — confirm it is public-route compatible (no `useAuth` guard that would redirect)
- **Read first:** `client/src/pages/landing.tsx` — find footer section and add links
- **Possibly modify:** `client/src/pages/privacy-policy.tsx` — add meta tags if not present

---

## Workstream 3 — Consent Audit Trail

**Priority: HIGH — required for GDPR/CCPA compliance; policies claim consent is recorded**

### Current State
Authentication is Google OAuth only. There is no in-app consent capture. When a user first logs in via OAuth, no record is created of which version of the privacy policy and terms they agreed to. The `audit_logs` table exists but does not capture consent events. There is no `consent_records` table.

### Target State
On first login (after OAuth callback, before the user reaches the dashboard):

1. A "Before you continue" modal is shown with:
   - "By continuing, you agree to our [Privacy Policy](/privacy) and [Terms of Service](/terms)"
   - One button: "I agree and continue"
2. Clicking "I agree" records a row in `consent_records` and establishes the session
3. Subsequent logins skip the modal (consent already recorded for the current policy version)
4. If the privacy policy version is bumped (via a version constant in the codebase), users see the modal again on next login

Schema (new table `consent_records`):
```sql
CREATE TABLE consent_records (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL,          -- Google OAuth sub
  user_email  TEXT NOT NULL,
  policy_version TEXT NOT NULL,       -- e.g. "2026-05-10"
  consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address  TEXT,
  user_agent  TEXT
);
CREATE INDEX consent_records_user_id_idx ON consent_records(user_id);
```

Policy version is a string constant exported from `shared/schema.ts` (or a dedicated `shared/policy-version.ts`) so bumping the version triggers re-consent automatically.

Both portal users and admin users go through this flow.

### Acceptance Criteria
- [ ] `migrations/0025_consent_records.sql` creates the `consent_records` table
- [ ] Drizzle schema in `shared/schema.ts` defines `consentRecords` table and `insertConsentRecordSchema`
- [ ] A `CURRENT_POLICY_VERSION` constant is exported from `shared/` (string, date-formatted)
- [ ] On first login (or after policy version bump), user sees the consent modal before reaching the app
- [ ] Clicking "I agree" inserts a row into `consent_records` with correct userId, email, policyVersion, ipAddress, userAgent
- [ ] Subsequent logins at the same policy version skip the modal
- [ ] Modal cannot be dismissed without clicking "I agree" (no close X, no ESC bypass)
- [ ] Consent check works for both admin and portal user auth flows
- [ ] API endpoint `POST /api/consent` (requires session) inserts consent record; returns 201
- [ ] API endpoint `GET /api/consent/current` (requires session) returns whether the current user has consented to the current policy version

### Files to Touch
- **Create:** `migrations/0025_consent_records.sql`
- **Modify:** `shared/schema.ts` — add `consentRecords` table definition and insert schema
- **Create or modify:** `shared/policy-version.ts` (or add export to `shared/schema.ts`)
- **Modify:** `server/routes.ts` — add `POST /api/consent` and `GET /api/consent/current`
- **Modify:** `server/storage.ts` — add `recordConsent()` and `hasConsented()` storage methods
- **Modify:** `client/src/App.tsx` — add consent gate after auth check
- **Create:** `client/src/components/ConsentModal.tsx` — the modal component

---

## Workstream 4 — Data Deletion Request Flow

**Priority: HIGH — Privacy Policy section 8 states 30-day deletion on request; no workflow exists**

### Current State
The Privacy Policy (Section 8, "Your Rights") describes the right to erasure with a 30-day response window. There is no UI for owners to submit a deletion request, no workflow for admins to process requests, and no anonymization logic in the codebase. No `deletion_requests` table exists.

### Target State

**Owner portal side:**
- Account settings page has a "Request account deletion" option
- Clicking it shows a confirmation dialog explaining: data will be anonymized within 30 days, financial records retained for 7 years per policy, a confirmation email will be sent
- Submitting creates a `deletion_requests` record

**Admin dashboard side:**
- Admin sees a notification or badge when a new deletion request is pending
- Dedicated admin page `/app/admin/deletion-requests` lists all pending requests with: user name, email, request date, status (pending/processing/completed)
- Admin clicks "Approve" → triggers anonymization of PII fields on the user's records
- Anonymization: name → "Deleted User", email → `deleted-{uuid}@redacted.invalid`, phone → null, address fields → null
- Financial records (ledger entries, payments, assessments) are NOT deleted — retained per 7-year policy
- Confirmation email sent to the user's email address on approval
- 30-day grace period: a scheduled task (using the existing `setInterval` sweep in `server/index.ts`) checks for requests where `approved_at < NOW() - 30 days` that haven't been processed and sends an alert to the platform admin

Schema (new table `deletion_requests`):
```sql
CREATE TABLE deletion_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        TEXT NOT NULL,
  user_email     TEXT NOT NULL,
  requested_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at    TIMESTAMPTZ,
  approved_by    TEXT,                -- admin email
  processed_at   TIMESTAMPTZ,
  status         TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | processing | completed | cancelled
  grace_period_ends_at TIMESTAMPTZ,  -- requested_at + 30 days, computed on insert
  notes          TEXT
);
CREATE INDEX deletion_requests_status_idx ON deletion_requests(status);
CREATE INDEX deletion_requests_user_id_idx ON deletion_requests(user_id);
```

### Acceptance Criteria
- [ ] `migrations/0026_deletion_requests.sql` creates the `deletion_requests` table
- [ ] Drizzle schema defines `deletionRequests` table and `insertDeletionRequestSchema`
- [ ] `POST /api/deletion-requests` (requires portal session) creates a deletion request; 409 if one already pending for this user
- [ ] `GET /api/admin/deletion-requests` (requires admin, platform-admin role) returns all requests
- [ ] `POST /api/admin/deletion-requests/:id/approve` (requires platform-admin) sets `approved_at`, `approved_by`, `status: approved`
- [ ] Approval trigger anonymizes PII: updates `adminUsers` / portal user records with redacted values
- [ ] Financial records (all join tables referencing the user) are NOT modified on anonymization
- [ ] Confirmation email sent to user on approval (use existing email provider)
- [ ] Owner portal account settings page has "Request account deletion" option
- [ ] Admin dashboard has deletion requests section — list view + approve action
- [ ] Automated sweep flags requests where grace period ends within 48 hours and no action taken (logs a warning or sends admin alert)

### Files to Touch
- **Create:** `migrations/0026_deletion_requests.sql`
- **Modify:** `shared/schema.ts` — add `deletionRequests` table and schema
- **Modify:** `server/routes.ts` — add deletion request routes
- **Modify:** `server/storage.ts` — add deletion request storage methods and anonymization logic
- **Modify:** `server/index.ts` — add deletion request sweep to the existing `setInterval` automation loop
- **Read first:** `client/src/pages/portal/` — find account settings page for portal users
- **Modify:** portal account settings page — add deletion request option
- **Create:** `client/src/pages/admin-deletion-requests.tsx` — admin page
- **Modify:** `client/src/App.tsx` — add route for admin deletion requests page

---

## Workstream 5 — Audit Log Viewer (Admin Dashboard)

**Priority: MEDIUM-HIGH — audit_logs table exists but no admin UI to view or search it**

### Current State
The `audit_logs` table exists in `shared/schema.ts` with columns: `id`, `actorEmail`, `action`, `entityType`, `entityId`, `associationId`, `beforeJson`, `afterJson`, `createdAt`. Audit log writes are scattered — some routes call `db.insert(auditLogs)` on specific operations but coverage is inconsistent (most write routes do NOT log to audit_events). An API endpoint `GET /api/audit-logs` exists (line 3302 in `server/routes.ts`) but there is no admin dashboard page surfacing it.

The existing `audit_logs` table is missing: `ipAddress`, `userAgent`, and a unified middleware that ensures all write operations are logged.

### Target State

**Schema enhancement:**
The existing `audit_logs` table gains two columns: `ip_address TEXT` and `user_agent TEXT`. (Migration must be additive — no breaking changes to existing rows.)

**Middleware:**
An Express middleware function (or a higher-order route wrapper) that auto-logs to `audit_logs` on any write operation (POST/PUT/PATCH/DELETE) that goes through `requireAdmin`. Logs: actor email, HTTP method + path as action, request body resource type/id if available, associationId from session or params, ip address from `req.ip`, user agent from `req.headers['user-agent']`.

**Admin dashboard page:**
- Route: `/app/admin/audit-log`
- Shows a searchable, paginated table of audit events
- Columns: timestamp, actor email, action, entity type, entity ID, association
- Filter controls: date range picker, actor email search, action type dropdown, association selector
- "Export CSV" button — downloads filtered results as CSV
- 1-year display window (query filters `createdAt > NOW() - 1 year`)
- Paginated: 50 rows per page, page controls

### Acceptance Criteria
- [ ] `migrations/0027_audit_logs_ip_ua.sql` adds `ip_address` and `user_agent` columns to `audit_logs` (nullable, no breaking change)
- [ ] Drizzle schema for `auditLogs` updated to include `ipAddress` and `userAgent` fields
- [ ] Audit middleware function created (can be a utility in `server/middleware/audit.ts`) that wraps or hooks into write routes
- [ ] At minimum these operation types are covered by audit logging: any admin write to associations, units, persons, financial records, admin user management, permission changes
- [ ] `GET /api/audit-logs` updated to support: `?actorEmail=`, `?action=`, `?startDate=`, `?endDate=`, `?associationId=`, `?page=`, `?limit=` query params
- [ ] `GET /api/audit-logs/export.csv` returns CSV of filtered results (same filter params)
- [ ] `/app/admin/audit-log` page exists, renders event table, filtering works, export works
- [ ] Page is accessible to `platform-admin` role only (not board-officer or viewer)
- [ ] New middleware does NOT double-log operations that already explicitly call `db.insert(auditLogs)` — either remove explicit calls or add a guard

### Files to Touch
- **Create:** `migrations/0027_audit_logs_ip_ua.sql`
- **Modify:** `shared/schema.ts` — add `ipAddress`, `userAgent` to `auditLogs` table definition
- **Create:** `server/middleware/audit.ts` — audit logging middleware / wrapper
- **Modify:** `server/routes.ts` — integrate audit middleware, update audit-log API with filters + CSV export
- **Modify:** `server/storage.ts` — add `queryAuditLogs()` and `exportAuditLogsCsv()` storage methods
- **Create:** `client/src/pages/admin-audit-log.tsx` — admin dashboard page
- **Modify:** `client/src/App.tsx` — add route `/app/admin/audit-log`

---

## Workstream 6 — Data Portability / Export

**Priority: MEDIUM — Privacy Policy explicitly grants data portability rights**

### Current State
No data export capability exists. The Privacy Policy (Right to Portability section) promises owners can request their data in a portable format. There is no API endpoint, no UI, and no export generation logic. The `background_jobs` table exists (`migrations/0017_background_jobs.sql`, `shared/schema.ts`) and can be used for async job processing.

### Target State

**Owner portal — "Download my data":**
- Account settings page: "Download my data" button
- Clicking queues an async `background_job` of type `data-export`
- Job generates a ZIP containing:
  - `personal-info.json` — name, email, phone, address, unit associations
  - `payment-history.csv` — all ledger entries and payments attributed to this owner
  - `assessment-history.csv` — all assessments applicable to their unit(s)
  - `documents.json` — list of shared documents they have access to
- When job completes, user receives an email with a time-limited download link (signed URL or a token-gated `/api/exports/:token` route), valid 48 hours
- Portal shows "Your export is ready — download before [expiry date]" if a recent export exists

**Admin — "Export association data":**
- Admin page or existing association settings: "Export association data"
- Generates a ZIP for the selected association containing:
  - `units.csv` — all units with owner info
  - `financial-ledger.csv` — full ledger for the association
  - `owners.csv` — all owners with contact info
  - `payment-history.csv` — all payments
- Also async via `background_jobs`; download link emailed to the requesting admin

### Acceptance Criteria
- [ ] `POST /api/portal/data-export` (requires portal session) enqueues a `background_job` of type `data-export`; 429 if an export was already requested within the last 24 hours
- [ ] `GET /api/exports/:token` serves the ZIP file; token is single-use or time-limited (48 hours)
- [ ] Background job worker (can be run in the existing `setInterval` sweep) processes pending `data-export` jobs and generates the ZIP
- [ ] Owner email received with download link when export is ready
- [ ] Portal account settings page has "Download my data" button with status indicator (idle / generating / ready)
- [ ] `POST /api/admin/association-export` (requires admin, platform-admin or manager role) enqueues association-level export
- [ ] Admin receives email when association export is ready
- [ ] ZIPs are stored temporarily (e.g. in `/uploads/exports/` or a configurable path); cleaned up after 48 hours by the sweep
- [ ] No PII is written to server logs during export generation

### Files to Touch
- **Modify:** `server/routes.ts` — add data export routes
- **Modify:** `server/storage.ts` — add export query methods (owner data, association data)
- **Create:** `server/jobs/data-export.ts` — export generation logic (ZIP assembly)
- **Modify:** `server/index.ts` — add `data-export` job type to the automation sweep
- **Read first:** `client/src/pages/portal/` — find account settings page
- **Modify:** portal account settings — add "Download my data" section
- **Read first:** `client/src/pages/` — find association settings or admin page for association-level export

---

## Workstream 7 — Admin Access Review Surface

**Priority: MEDIUM — Information Security Policy requires periodic access review**

### Current State
Admin users are managed in the `admin_users` table. There is no UI page showing all admin users with last login date. There is no periodic access review workflow, no flagging of inactive admins, and no audit trail of access review completions. The policies describe quarterly access reviews but no tooling supports this.

### Target State

**Admin users overview page** (`/app/admin/access-review`):
- Table of all admin users across associations: name, email, role, last login date, account created date, associated associations count
- Admins with no login in the past 90 days are flagged with a warning badge ("Inactive")
- Actions per row: "Mark reviewed" | "Revoke access"

**Quarterly review workflow:**
- A scheduled cron (added to the existing `setInterval` sweep) runs quarterly (configurable — check every sweep, fire once per quarter) to send an email to platform-admins: "Access review is due. Review admin users at [link]."
- Platform-admin opens the access review page and works through the list
- Each user gets "Reviewed" or "Revoke" action
- On "Revoke": admin user is deactivated (not deleted), a record written to `audit_logs`
- On "Reviewed": a record written to `audit_logs` with `action: access-review-confirmed`
- Once all users are reviewed, admin can mark the review as complete → logs to `audit_logs` with `action: access-review-completed`

**Inactive admin auto-flag:**
- Any admin with `lastLoginAt < NOW() - 90 days` is flagged on the access review page
- Additionally, the quarterly email sweep includes a count of inactive admins

### Acceptance Criteria
- [ ] `/app/admin/access-review` page exists showing all admin users with last login, account age, and flag for 90-day inactivity
- [ ] "Revoke access" action deactivates the admin user and logs to `audit_logs`
- [ ] "Mark reviewed" action logs a `access-review-confirmed` event to `audit_logs`
- [ ] "Mark review complete" button logs `access-review-completed` to `audit_logs`
- [ ] Quarterly reminder email goes to all platform-admins (can use an environment variable `ACCESS_REVIEW_INTERVAL_DAYS` defaulting to 90)
- [ ] Inactive admins (90+ days no login) are visually flagged in the table
- [ ] No new migration required if `lastLoginAt` already exists on `admin_users` — verify first; add it if missing
- [ ] Access review page is restricted to `platform-admin` role

### Files to Touch
- **Read first:** `shared/schema.ts` — check if `lastLoginAt` exists on `adminUsers` table; if not, create `migrations/0028_admin_last_login.sql`
- **Possibly create:** `migrations/0028_admin_last_login.sql`
- **Modify:** `server/routes.ts` — add access review routes
- **Modify:** `server/storage.ts` — add admin user list with last-login query
- **Create:** `client/src/pages/admin-access-review.tsx` — access review page
- **Modify:** `client/src/App.tsx` — add route `/app/admin/access-review`
- **Modify:** `server/index.ts` — add quarterly access review reminder to automation sweep

---

## Workstream 8 — Automated Data Retention Enforcement

**Priority: MEDIUM — Data Retention Policy is defined but not enforced by any automated process**

### Current State
The Data Retention Policy document defines retention windows: session logs 1 year, auth logs 1 year, financial records 7 years, user PII 90 days after account deletion. There is no automated job that enforces any of these windows. The `setInterval` automation sweep in `server/index.ts` handles other scheduled tasks (assessments, autopay, notices) and can be extended. The `audit_logs` table has no TTL enforcement.

### Target State

**Retention enforcement job** (added to the weekly slot in the existing automation sweep):

1. Scans `audit_logs` for rows where `createdAt < NOW() - 1 year` → marks them as `retention_expired` or stages for deletion
2. Scans session/auth-related tables for rows older than 1 year (identify which tables during implementation)
3. For deletion requests with `processed_at` set AND `processed_at < NOW() - 90 days` → verify anonymization is complete, log a final confirmation event

**Admin retention report page** (or section on existing admin page):
- Shows: "X audit log rows eligible for purge (older than 1 year)", "Y session records eligible", etc.
- Admin can click "Approve purge" per category
- On approval: permanent deletion runs; count logged to `audit_logs` with `action: retention-purge-executed`
- Alternatively: enable auto-purge mode (no admin approval needed) configurable per retention category via admin settings

**Retention categories and windows:**
| Category | Table(s) | Window | Action |
|---|---|---|---|
| Audit logs | `audit_logs` | 1 year | Purge |
| Session/auth logs | TBD during impl (check for session or auth log tables) | 1 year | Purge |
| Financial records | All financial tables | 7 years | Retain (do not purge) |
| Deleted user PII | rows where anonymization has been applied | 90 days post-deletion | Verify anonymization complete |

### Acceptance Criteria
- [ ] Retention enforcement job runs on the weekly automation sweep (or a configurable interval)
- [ ] Job correctly identifies rows past retention window for `audit_logs`
- [ ] Job does NOT touch financial records (7-year window means they will never be eligible during normal operation)
- [ ] Admin sees a retention report: count of eligible rows per category
- [ ] "Approve purge" action permanently deletes eligible rows and logs the event
- [ ] Purge events logged to `audit_logs` with category, count deleted, admin who approved
- [ ] No user PII is logged during purge runs (log only counts, not row contents)
- [ ] Unit tests cover: retention window calculation, purge eligibility logic, financial record exclusion

### Files to Touch
- **Modify:** `server/index.ts` — add retention enforcement to automation sweep
- **Create:** `server/jobs/retention-enforcement.ts` — retention scan and purge logic
- **Modify:** `server/routes.ts` — add `GET /api/admin/retention-report` and `POST /api/admin/retention-purge`
- **Modify:** `server/storage.ts` — add retention query methods
- **Create or modify:** admin page (extend existing admin page or create `client/src/pages/admin-retention.tsx`)
- **Modify:** `client/src/App.tsx` — add route if new admin page created

---

## Workstream 9 — Incident Response Infrastructure

**Priority: MEDIUM — IR process is documented but no tooling exists to detect or track incidents**

### Current State
An Incident Response section exists in the Information Security Policy. There is no failed-auth monitoring, no anomalous IP detection, no security incident tracking table, and no admin UI showing recent security events. Rate limiting exists for specific routes (community hub public API) but not for authentication.

### Target State

**Failed auth monitoring:**
- Auth route (Google OAuth callback) tracks failed auth attempts in a new `auth_events` table or the existing `audit_logs` table (using `action: auth-failed`)
- If more than 5 failed auth attempts from the same IP within 1 hour → automated alert email to platform admin email (`PLATFORM_ADMIN_EMAIL` env var)
- Uses the existing email provider for alerts

**New IP login alert:**
- On successful admin login: compare `req.ip` against the last 5 known IPs for this admin
- If the IP is not in the recent list → send notification email to the admin: "New IP login detected — was this you?"
- Store recent IPs in a `known_ips` column on `admin_users` (JSONB array of last 5 IPs) or in a separate `admin_login_events` table

**Security incidents table** (new):
```sql
CREATE TABLE security_incidents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_type   TEXT NOT NULL,   -- 'auth-failure-spike', 'new-ip-login', 'manual'
  severity        TEXT NOT NULL DEFAULT 'medium',  -- low | medium | high | critical
  description     TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'open',    -- open | investigating | resolved
  detected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ,
  resolved_by     TEXT,            -- admin email
  metadata        JSONB
);
```

**Admin security page** (`/app/admin/security`):
- Recent auth failures: table of `audit_logs` rows with `action: auth-failed` in the last 7 days, grouped by IP
- New IP logins: list of admin login events from unfamiliar IPs in the last 30 days
- Active sessions: list of current active admin sessions (if session store supports enumeration)
- Open security incidents: list from `security_incidents` table with status and severity
- Link to IR runbook (link to the IR section of the Information Security Policy document or a `docs/playbooks/incident-response.md`)

**Automated incident creation:**
- When a failed-auth spike alert fires → also insert a `security_incidents` row of type `auth-failure-spike`
- When a new-IP login alert fires → also insert a `security_incidents` row of type `new-ip-login`

### Acceptance Criteria
- [ ] `migrations/0029_security_incidents.sql` creates `security_incidents` table
- [ ] Drizzle schema defines `securityIncidents` table
- [ ] Auth failure events are logged to `audit_logs` with `action: auth-failed` on failed OAuth or session attempts
- [ ] Alert email sent to `PLATFORM_ADMIN_EMAIL` when ≥5 auth failures from same IP within 1 hour
- [ ] Alert email sent to admin's own email when login occurs from an IP not seen in last 5 logins
- [ ] Alert email fire also inserts a `security_incidents` row
- [ ] `GET /api/admin/security/summary` returns: recent auth failures, new-IP logins, open incidents
- [ ] `/app/admin/security` page renders all three sections; incident status can be updated (open → investigating → resolved)
- [ ] Platform admin can manually create a security incident via the UI
- [ ] Page linked from the main admin navigation
- [ ] No rate-limit bypass: IP extraction uses `req.ip` (trust proxy configured) not raw headers that can be spoofed

### Files to Touch
- **Create:** `migrations/0029_security_incidents.sql`
- **Modify:** `shared/schema.ts` — add `securityIncidents` table definition
- **Modify:** `server/routes.ts` — add security summary route, incident CRUD routes, auth failure logging to existing OAuth callback handler
- **Modify:** `server/storage.ts` — add security incident storage methods, auth failure query
- **Modify:** `server/index.ts` — add auth-failure spike check to the automation sweep (run every sweep tick, not just weekly)
- **Create:** `client/src/pages/admin-security.tsx` — security admin page
- **Modify:** `client/src/App.tsx` — add route `/app/admin/security`
- **Read first:** `server/index.ts` — understand where auth events can be hooked into for new-IP detection
- **Create (optional):** `docs/playbooks/incident-response.md` — runbook linked from the admin security page

---

## Migration Sequence

```
0025_consent_records.sql          (WS3)
0026_deletion_requests.sql        (WS4)
0027_audit_logs_ip_ua.sql         (WS5 — additive to existing audit_logs)
0028_admin_last_login.sql         (WS7 — only if lastLoginAt missing from adminUsers)
0029_security_incidents.sql       (WS9)
```

All migrations must be additive (no column drops, no type changes on existing columns) so they can be applied to production without downtime.

---

## Out of Scope (this roadmap)

- SOC 2 audit or third-party penetration testing
- Multi-factor authentication (separate effort)
- Plaid token rotation (owned by Plaid integration workstream)
- End-to-end encryption of data at rest (infrastructure-level, separate effort)
- OAuth provider changes (Google is the only provider; adding others is separate)

---

## Sequencing Notes for [014]

WS1 can ship immediately — it is self-contained and adds no new migrations.

WS2 is mostly already implemented (pages and routes exist); this is a polish + URL canonicalization task.

WS3 depends on WS2 (consent modal links to `/privacy` and `/terms` — those should be canonical before consent ships).

WS4 depends on WS3 (deletion request flow requires consent to have been recorded first, for UX consistency).

WS5, WS6, WS7, WS8, WS9 are independent of each other and can be parallelized after WS1–4 land.

Recommended wave structure:
- **Wave A (unblocking):** WS1
- **Wave B (legal must-haves):** WS2, WS3 in parallel
- **Wave C (rights + transparency):** WS4, WS5 in parallel
- **Wave D (operations + monitoring):** WS6, WS7, WS8, WS9 in parallel
