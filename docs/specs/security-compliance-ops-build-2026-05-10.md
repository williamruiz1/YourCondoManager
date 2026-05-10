# WS10 — Compliance Operations Dashboard

**Product:** YourCondoManager (YCM)
**Spec date:** 2026-05-10
**Author:** William Ruiz
**Status:** Ready for [014] queue
**Depends on:** WS9 (Incident Response Infrastructure — provides `/app/admin/security` base page and `security_incidents` table)
**Related:** YCM Security Maturity Roadmap (`docs/specs/security-maturity-roadmap-2026-05-10.md`), WS1–WS9

---

## Background

Nine security workstreams (WS1–WS9) build the platform controls described in the YCM Security & Compliance Runbook v1. WS10 is the operational layer that ties all of them together: a dashboard where the compliance calendar, security issue tracking, access review, and policy registry live in one place, and where automated reminders ensure reviews don't fall through the cracks.

The Runbook (at `founder-os/wiki/YCM-Security-Compliance-Runbook-v1.md`) specifies the processes; WS10 builds the tooling that makes those processes executable and auditable within the YCM admin interface.

---

## What to Build

A dedicated admin section at `/app/admin/security` — either a new multi-tab page, or an enhancement to the security page introduced by WS9, depending on what WS9 delivers. Build WS9 first, then assess whether to extend its page or add a new route.

The page has four tabs:
1. Compliance Calendar
2. Security Issues
3. Access Review (extends WS7 — link or embed)
4. Policy Registry

Plus: a compliance reminder cron added to the existing automation sweep.

---

## Tab 1 — Compliance Calendar

### What it shows

A set of review cards, one per compliance review item defined in the Security Runbook. Cards are grouped by frequency: Monthly, Quarterly, Annual.

**Monthly cards (3):**
- Monthly Vulnerability Review
- Monthly Access Review Lite
- Monthly Failed Auth Check

**Quarterly cards (4):**
- Quarterly Full Access Review
- Quarterly Policy Review
- Quarterly Vendor Risk Review
- Quarterly Plaid Key Rotation Check
- Quarterly SLA Compliance Check
- Quarterly Data Deletion Request Review

(Note: there are 6 quarterly items; render all 6.)

**Annual cards (4):**
- Annual Full Policy Refresh
- Annual Penetration Testing
- Annual SOC 2 Readiness Assessment
- Annual Encryption Key Rotation

### Card anatomy

Each card shows:
- Review name (bold)
- Frequency label (Monthly / Quarterly / Annual) as a badge
- Last completed: `[date]` or "Never" if no completion on record
- Next due: computed from last completed date + frequency. If never completed, next due is shown as "Overdue" in red.
- Status indicator:
  - Green: completed within the current period (e.g., for monthly: completed this calendar month)
  - Amber: not yet completed but not overdue (upcoming)
  - Red: overdue (past the due date with no completion logged)
- "Mark Complete" button

### "Mark Complete" action

Clicking "Mark Complete" opens a completion log form (modal or inline):
- Notes (textarea, required, minimum 10 characters — forces substantive logging, not just a checkbox)
- Attachment URL (optional — for attaching a Google Doc link, a CSV export, or a screenshot)
- A submit button labeled "Log Completion"

On submit:
- Creates an `audit_event` row:
  - `action`: `compliance_review_completed`
  - `entityType`: `compliance_review`
  - `entityId`: the review slug (e.g., `monthly-vulnerability-review`, `quarterly-policy-review`, `annual-key-rotation`)
  - `actorEmail`: the logged-in admin's email
  - `metadata` (JSONB): `{ reviewType: string, notes: string, attachmentUrl?: string, periodStart?: date, periodEnd?: date }`
- The card immediately updates: "Last completed: today" and status changes to green.

### Data model

Extend the `audit_events` (or `audit_logs`) table — whichever is canonical in the codebase after WS5. No new table is required. The `action = 'compliance_review_completed'` filter on `audit_logs` is sufficient to reconstruct the compliance calendar state.

The "last completed" date for each card is derived by querying:
```sql
SELECT MAX(created_at) FROM audit_logs
WHERE action = 'compliance_review_completed'
  AND entity_id = '<review-slug>'
```

The "next due" date is computed client-side:
- Monthly: last_completed + 1 month
- Quarterly: last_completed + 3 months
- Annual: last_completed + 12 months

If `last_completed` is null, `next_due` = effective date of the runbook (2026-05-10), which immediately shows as overdue — intentional, to prompt first-time completion.

### Review slugs (canonical list)

| Display Name | Slug |
|---|---|
| Monthly Vulnerability Review | `monthly-vulnerability-review` |
| Monthly Access Review Lite | `monthly-access-review-lite` |
| Monthly Failed Auth Check | `monthly-failed-auth-check` |
| Quarterly Full Access Review | `quarterly-full-access-review` |
| Quarterly Policy Review | `quarterly-policy-review` |
| Quarterly Vendor Risk Review | `quarterly-vendor-risk-review` |
| Quarterly Plaid Key Rotation Check | `quarterly-plaid-key-rotation-check` |
| Quarterly SLA Compliance Check | `quarterly-sla-compliance-check` |
| Quarterly Data Deletion Request Review | `quarterly-deletion-request-review` |
| Annual Full Policy Refresh | `annual-policy-refresh` |
| Annual Penetration Testing | `annual-penetration-testing` |
| Annual SOC 2 Readiness Assessment | `annual-soc2-readiness` |
| Annual Encryption Key Rotation | `annual-key-rotation` |

---

## Tab 2 — Security Issues

### What it shows

Open GitHub issues labeled `security:critical` or `security:high` from the `williamruiz1/YourCondoManager` repository, fetched via GitHub API.

### Data source

The YCM codebase already has a GitHub integration. Leverage it (check `server/routes.ts` and any existing GitHub API client). If no client exists, use the GitHub REST API with a personal access token stored as `GITHUB_TOKEN` in Fly.io secrets (same token used by CI).

Endpoint: `GET https://api.github.com/repos/williamruiz1/YourCondoManager/issues?labels=security:critical,security:high&state=open`

Cache the result for 15 minutes in memory (not in the database) to avoid GitHub rate limits.

### Display

A table with columns:
- **Title** (linked to the GitHub issue URL, opens in new tab)
- **Severity** (badge: red for `security:critical`, orange for `security:high`)
- **Age** (days since created — compute from `created_at`)
- **SLA deadline** (computed: `created_at` + 1 day for critical, + 7 days for high)
- **SLA status** (color-coded):
  - Green: SLA deadline is more than 2 days away
  - Amber: SLA deadline is within 2 days
  - Red: SLA deadline has passed (issue is open and overdue)
- **GitHub link** (icon button, opens issue in new tab)

If no open issues: show a green banner "No open security issues. All clear."

### Empty state for no GitHub token

If `GITHUB_TOKEN` is not set or the API call fails, show: "Security issue tracker unavailable — GitHub API not configured. Open issues manually at [link to repo issues page]." Do not fail silently.

---

## Tab 3 — Access Review

### What it shows

The access review interface built in WS7. WS10 embeds or links to it from this tab.

**Option A (preferred):** Embed the WS7 access review component directly in Tab 3. The same component that lives at `/app/admin/access-review` is rendered here without a route change.

**Option B (fallback if embedding is complex):** Tab 3 shows a summary card: "X admin users. Y inactive (>90 days). Last full review: [date]." Plus a "Go to full access review" button that navigates to `/app/admin/access-review`.

Choose Option A if WS7 has already componentized the access review page. Coordinate with the WS7 implementer.

---

## Tab 4 — Policy Registry

### What it shows

A list of the four YCM policy documents with their current status.

| Policy Name | Current Version | Last Updated | Google Doc Link | Plaid Questionnaire Status |
|---|---|---|---|---|
| Information Security Policy | (stored in DB or config) | (stored in DB) | (stored in DB) | (stored in DB) |
| Privacy Policy | ... | ... | ... | ... |
| Vulnerability Management Program | ... | ... | ... | ... |
| Data Retention Policy | ... | ... | ... | ... |

### Data model

A new table `policy_registry`:
```sql
CREATE TABLE policy_registry (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_slug     TEXT NOT NULL UNIQUE,   -- 'information-security', 'privacy', 'vulnerability-management', 'data-retention'
  display_name    TEXT NOT NULL,
  current_version TEXT NOT NULL DEFAULT '1.0',
  last_updated    DATE NOT NULL,
  doc_url         TEXT,                   -- Google Doc URL
  plaid_questionnaire_status TEXT DEFAULT 'not-applicable',  -- 'current', 'needs-update', 'not-applicable'
  notes           TEXT
);
```

Seed this table with the four policies and their initial versions (1.0, effective 2026-05-10) as part of the migration.

### "Policy Updated" button

Each policy row has a "Policy Updated" button. Clicking it opens a modal:
- New version (text input, pre-filled with a suggested increment)
- Notes (textarea — "what changed")
- Plaid questionnaire impact: radio — "No impact" / "Plaid questionnaire needs update"
- Submit button: "Log Update"

On submit:
- Updates the `policy_registry` row: `current_version`, `last_updated = today`, `plaid_questionnaire_status` (set to `needs-update` if flagged).
- Inserts an `audit_logs` row: `action: policy-updated`, `entityType: policy`, `entityId: policy_slug`, `metadata: { fromVersion, toVersion, notes, plaidImpact }`.

### Plaid questionnaire status badges

- **Current** (green): questionnaire has been confirmed current since the last policy update.
- **Needs update** (amber): a policy update flagged Plaid impact but the questionnaire hasn't been re-submitted yet.
- **Not applicable** (grey): this policy doesn't touch Plaid questionnaire answers.

A "Mark Plaid Questionnaire Submitted" button on each amber row clears the flag.

---

## Compliance Reminder Cron

Add to the existing automation sweep in `server/index.ts` (which already runs on a `setInterval` for assessments, autopay, notices, etc.).

### Monthly reminder

**Trigger:** On the 1st calendar day of each month, send an email to the platform admin email (`PLATFORM_ADMIN_EMAIL` env var) if any monthly review was not completed in the previous calendar month.

Email subject: `[YCM] Monthly security review due — [Month Year]`
Email body: List each monthly review not completed last month, with a link to `/app/admin/security`.

Implementation:
```
// Pseudo-code — implement in existing sweep pattern
const now = new Date();
if (now.getDate() === 1) {
  const lastMonth = subMonths(now, 1);
  const overdueReviews = await getOverdueMonthlyReviews(lastMonth);
  if (overdueReviews.length > 0) {
    await sendComplianceReminderEmail('monthly', overdueReviews, platformAdminEmail);
  }
}
```

### Quarterly reminder

**Trigger:** On the 1st calendar day of January, April, July, and October, send an email for any quarterly review not completed in the previous quarter.

Email subject: `[YCM] Quarterly security review due — Q[N] [Year]`
Email body: List each quarterly review not completed last quarter, with link to `/app/admin/security`.

### Overdue reminder

**Trigger:** Every sweep tick (daily or more frequent — match existing sweep frequency). If any review has been overdue for more than 7 days, send a daily reminder email until it is completed.

**Throttle:** send at most once per day per overdue review. Track last-sent in memory or in a simple `compliance_reminder_log` table (optional — simpler to track in memory if the server doesn't restart frequently; use DB if server restarts frequently).

### Email implementation

Use the same email sender used by the rest of the application (check `server/routes.ts` for the email provider — likely SendGrid or a similar transactional provider). Do not add a new email provider.

---

## Acceptance Criteria

### Tab 1 — Compliance Calendar

- [ ] All 13 review cards are rendered, grouped by frequency (Monthly, Quarterly, Annual)
- [ ] Each card shows: name, last completed date (or "Never"), next due date, and status indicator (green/amber/red)
- [ ] Status logic is correct: green if completed within the current period, amber if upcoming, red if overdue
- [ ] "Mark Complete" button opens a form with notes (required, ≥10 chars) and optional attachment URL
- [ ] Submitting the form inserts an `audit_logs` row with `action: compliance_review_completed` and the correct `entity_id` slug
- [ ] Card updates immediately after submission without a full page reload
- [ ] Overdue cards (status: red) are rendered with a distinct visual treatment (red border or background — not just a badge)

### Tab 2 — Security Issues

- [ ] Open issues labeled `security:critical` or `security:high` are fetched from the GitHub API
- [ ] Table shows: title (linked), severity badge, age in days, SLA deadline, SLA status (green/amber/red)
- [ ] SLA calculations are correct: critical = 1 day, high = 7 days from `created_at`
- [ ] Results are cached for 15 minutes (no re-fetch on every page visit)
- [ ] Empty state (no open issues) shows a green "All clear" banner
- [ ] Error state (GitHub API unavailable or unconfigured) shows a non-failing message with a manual link
- [ ] Page does NOT expose the `GITHUB_TOKEN` value to the client

### Tab 3 — Access Review

- [ ] Tab 3 renders the access review component (from WS7) or a summary card linking to `/app/admin/access-review`
- [ ] If embedded: the access review component functions identically to the standalone page
- [ ] If summary card: shows admin count, inactive count, last review date

### Tab 4 — Policy Registry

- [ ] `policy_registry` table is created via a new migration (`migrations/0030_policy_registry.sql`)
- [ ] Table is seeded with the four YCM policies (version 1.0, date 2026-05-10)
- [ ] All four policies are displayed with version, last updated, doc URL (if set), and Plaid questionnaire status
- [ ] "Policy Updated" button opens a modal with version, notes, and Plaid impact fields
- [ ] Submitting the modal updates the `policy_registry` row and inserts an `audit_logs` row
- [ ] "Mark Plaid Questionnaire Submitted" button clears the `needs-update` Plaid status flag and logs to `audit_logs`

### Compliance Reminder Cron

- [ ] Monthly reminder email sends on the 1st of each month if any monthly review was not completed in the prior month
- [ ] Quarterly reminder email sends on the 1st of Jan/Apr/Jul/Oct if any quarterly review was not completed in the prior quarter
- [ ] Daily overdue reminder sends if any review is >7 days overdue (throttled to once per day)
- [ ] Reminder emails are sent to `PLATFORM_ADMIN_EMAIL` env var (fail silently with a console.warn if not set, NOT an uncaught exception)
- [ ] Cron logic does NOT send reminders if all reviews are current (no spurious emails)

### General

- [ ] `/app/admin/security` page is restricted to `platform-admin` role (same as WS9 security page)
- [ ] Page is linked from the admin navigation (sidebar or top nav — match the existing pattern)
- [ ] All four tabs render without errors on an empty database (first-run state)
- [ ] TypeScript strict — no `any` types
- [ ] No `console.log` in committed code
- [ ] Vitest unit tests for: SLA calculation, overdue status calculation, next-due date calculation, compliance review slug enumeration
- [ ] Playwright E2E test for: loading the Compliance Calendar tab, clicking "Mark Complete," verifying the card updates

---

## Migration

New migration file: `migrations/0030_policy_registry.sql`

```sql
CREATE TABLE policy_registry (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_slug                 TEXT NOT NULL UNIQUE,
  display_name                TEXT NOT NULL,
  current_version             TEXT NOT NULL DEFAULT '1.0',
  last_updated                DATE NOT NULL,
  doc_url                     TEXT,
  plaid_questionnaire_status  TEXT NOT NULL DEFAULT 'not-applicable',
  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO policy_registry (policy_slug, display_name, current_version, last_updated, plaid_questionnaire_status) VALUES
  ('information-security', 'Information Security Policy', '1.0', '2026-05-10', 'current'),
  ('privacy', 'Privacy Policy', '1.0', '2026-05-10', 'current'),
  ('vulnerability-management', 'Vulnerability Management Program', '1.0', '2026-05-10', 'current'),
  ('data-retention', 'Data Retention Policy', '1.0', '2026-05-10', 'not-applicable');
```

This migration is additive (new table + seed data). No existing tables or columns are modified.

---

## Files to Touch

**Create:**
- `migrations/0030_policy_registry.sql`
- `client/src/pages/admin-security-compliance.tsx` — the WS10 four-tab page (if WS9 created `admin-security.tsx`, either extend it or create a new component that wraps both; coordinate with WS9 implementer)
- `server/jobs/compliance-reminders.ts` — the reminder email logic, importable from `server/index.ts`

**Modify:**
- `shared/schema.ts` — add `policyRegistry` Drizzle table definition
- `server/routes.ts` — add:
  - `GET /api/admin/compliance-calendar` — returns last completion dates for all 13 review slugs
  - `POST /api/admin/compliance-calendar/complete` — logs a compliance review completion
  - `GET /api/admin/security-issues` — proxies GitHub API call (server-side, token not exposed)
  - `GET /api/admin/policy-registry` — returns all policy rows
  - `PATCH /api/admin/policy-registry/:slug` — updates a policy row (version, notes, etc.)
  - `POST /api/admin/policy-registry/:slug/plaid-submitted` — clears the `needs-update` Plaid status
- `server/storage.ts` — add storage methods for compliance calendar and policy registry queries
- `server/index.ts` — add compliance reminder job to the automation sweep
- `client/src/App.tsx` — add/update route for `/app/admin/security` to render the WS10 page

**Read first (do not modify without reading):**
- `server/index.ts` — understand the existing automation sweep pattern before adding the cron
- `server/routes.ts` — find the existing GitHub integration (if any) before writing a new one
- `client/src/pages/admin-security.tsx` — understand WS9's deliverable before deciding how to extend it
- `client/src/App.tsx` — understand current admin route structure

---

## Sequencing Notes

WS10 depends on:
- **WS5** (Audit Log Viewer) — WS10 reads from `audit_logs` for compliance calendar state. WS5 must define the final `audit_logs` schema (including `metadata` JSONB if needed; if WS5 doesn't add `metadata`, WS10's spec takes precedence and adds it).
- **WS7** (Admin Access Review) — WS10 embeds WS7's access review component in Tab 3.
- **WS9** (Incident Response Infrastructure) — WS10 extends or builds on the `/app/admin/security` page WS9 creates.

WS10 does NOT depend on WS1–WS4 — those can proceed in parallel.

Recommended: WS10 is the last workstream to implement, after WS5, WS7, and WS9 are merged. This gives WS10 the full schema and components to compose from.

---

## Out of Scope

- Automated Plaid token re-encryption (mentioned in annual key rotation; add to a future Plaid workstream if needed)
- SOC 2 evidence collection automation (aspirational for future)
- Third-party SIEM integration
- Multi-tenant compliance dashboard (each HOA seeing their own compliance posture — future feature)
