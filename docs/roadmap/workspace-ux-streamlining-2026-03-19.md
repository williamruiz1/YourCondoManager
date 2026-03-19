# Workspace UI/UX Streamlining — 2026-03-19

## Purpose

A systematic review of the CondoManager platform interface against 2025 SaaS and property-management UX best practices, with a focused deep-dive on all 11 Finance section pages. Findings are captured as a roadmap project with workstreams organized by domain and actionable tasks for each issue discovered.

## Research Basis

- Nielsen Norman Group navigation and sidebar research
- Pencil & Paper SaaS dashboard IA guides (2025)
- Lazarev Agency dashboard UX best practices
- PayHOA / Sloboda Studio property management UX studies
- Userpilot progressive disclosure patterns
- Miller's Law (7±2 cognitive chunks) applied to sidebar and form design

---

## Global UX Findings (Cross-Cutting)

### Information Architecture
- The Finance sidebar exposes 3 parent nodes with up to 11 child links visible simultaneously — exceeds Miller's Law limit
- "Finance Setup", "Owner Accounts", "Oversight & Reporting" should collapse to a single `Finance` entry with an in-page tab bar
- The "In Context" association block sits mid-sidebar, breaking nav flow — should move to sidebar header below the logo
- Platform-admin-only items (Feature Flags, Admin Roadmap) clutter the sidebar for board-admin and manager roles

### Navigation Patterns
- No breadcrumb navigation anywhere in the app — users arriving via command palette are disoriented
- No recently-visited or pinned items in sidebar; localStorage history data exists but is unused
- No first-login experience for new admin users

### Owner Portal
- All portal users land on the same screen regardless of role (owner vs. board member)
- Portal uses desktop-centric layout — no mobile-first design for residents
- No persistent balance strip across portal tabs
- `hasBoardAccess` and `effectiveRole` exist on `PortalSession` but don't drive a differentiated landing

### Command Palette
- Search covers persons, units, vendors, work orders, documents — but not invoices, ledger entries, or assessments
- Create actions are static regardless of current route — no context-sensitive commands
- Active association context not shown within the palette

### Dashboard & Empty States
- `onboardingScorePercent` exists in `AssociationOverview` but is never surfaced as a dashboard checklist
- `BoardDashboard.attention.items` with severity ratings exists but is buried in portal data, not shown in the admin dashboard
- Generic or missing empty states across most data tables

---

## Finance Section Deep Dive — Page-by-Page

### Finance Foundation (`financial-foundation.tsx`)
1. Missing `WorkspacePageHeader` and `AssociationScopeBanner` — inconsistent with all other mature finance pages
2. `/api/financial/accounts` and `/api/financial/categories` called without `associationId` filter — shows all associations' data
3. Page title "Finance Foundation" is internal jargon — rename to "Chart of Accounts" or "Financial Setup"
4. Partial Payment Rules is misplaced here — belongs on the Payments page
5. Financial Change Approvals (governance-critical) is buried third on the page — needs elevation
6. No forward guidance after setup — dead end with no "next step" prompt
7. Empty account/category tables have no empty state messaging

### Recurring Charges (`financial-recurring-charges.tsx`)
1. "Run Now" button has no confirmation dialog — posts charges immediately with no preview or impact summary
2. Run history shows `unitId` as a truncated UUID instead of a human-readable unit number
3. No explanation of automatic vs. manual scheduling — users don't know if schedules self-execute
4. Row-click to filter run history is invisible UX — no visual affordance
5. "Max Retries" column shown without a help tooltip explaining what a retry is

### Special Assessments (`financial-assessments.tsx`)
1. No live per-installment amount preview in the create form or in the table
2. Missing `WorkspacePageHeader` and `AssociationScopeBanner`
3. Assessments query is unscoped — shows all associations' assessments
4. No path from Assessment → Ledger (no "Post installment" action or upcoming schedule view)
5. Deactivate has no confirmation dialog — risk of accounting inconsistency
6. Notes field uses `<Input>` instead of `<Textarea>`

### Late Fees (`financial-late-fees.tsx`)
- Contains 6 distinct data domains serving 3 completely different user intents:
  - **Configuration**: Late Fee Rules, Delinquency Thresholds, Escalation
  - **Operations**: Late Fee Events (what fees were applied)
  - **Recovery**: Payment Plans, Collections Handoff
- A manager doing daily delinquency triage must scroll past configuration to reach recovery actions
- "Apply fees" / "Run scan" actions need confirmation dialogs
- Page likely missing `WorkspacePageHeader` (consistent gap pattern)

### Utility Payments (`financial-utilities.tsx`)
1. Entire utilities table is a single minified JSX line — no filtering, sorting, or pagination
2. No inline "Mark Paid" action — most common utility workflow is unsupported
3. No `associationId` filter on the API call
4. Attachment upload UI is a crude 4-column grid — not accessible
5. Attachment table shows raw `expenseId` UUID instead of utility type + provider name
6. No empty states on either table

### Owner Ledger (`financial-ledger.tsx`)
1. Amount field label reads "(positive=owed, negative=credit)" — developer jargon in a user-facing form
2. "Description" field exists in the schema and CSV export but is absent from the ledger entries table
3. Audit log "Details" column renders raw JSON — unreadable
4. "Send Notice" trigger is an icon-only button with no visible label
5. Financial Alerts panel shows no last-scan timestamp — users don't know if data is fresh
6. Ledger entries table is unscoped — shows all associations' entries regardless of `assocFilter`

### Vendor Invoices (`financial-invoices.tsx`)
1. Shortcut link uses stale route `/app/financial-ledger` (should be `/app/financial/ledger`) — broken navigation
2. Invoice Attachments card is wrapped inside `AsyncStateBoundary` — hidden when invoice list is empty
3. No bulk approval action — approving invoices one-by-one is tedious for routine AP work
4. No "Paid (MTD)" KPI card — only Pending, Approved, Overdue shown
5. Vendor help note in dialog shows raw route path instead of a clickable link
6. Invoice and attachment loading states are coupled — slow attachments block the entire page

### Budgets (`financial-budgets.tsx`)
1. Three-step create hierarchy (Budget → Version → Line Items) has no guidance for first-time users
2. Budget status uses custom Tailwind CSS strings instead of `<Badge>` variants — visual inconsistency
3. Variance data exists but has no color coding (red for overspend, green for underspend)
4. Missing `WorkspacePageHeader`
5. Auto-select of first budget is silent — no visible indicator of which budget is active

### Financial Reports (`financial-reports.tsx`)
1. Report type labels ("P&L", "AR Aging", "Reserve") are jargon without tooltips or descriptions
2. No print or PDF export — CSV only, but board reports are typically needed as PDFs for meeting packets
3. Reports computed client-side from already-fetched data — silently incomplete for large associations
4. "All time" period triggers unbounded API call — potential performance issue
5. Missing `WorkspacePageHeader`

### Reconciliation (`financial-reconciliation.tsx`)
1. Four-step workflow (Import → Auto-match → Manual match → Lock) not communicated to users
2. `parseBankCsv` returns empty array silently on unrecognized format — no error message to user
3. No matched/unmatched progress summary above the transaction table
4. "Lock Period" is irreversible but lacks a prominent warning and confirmation summary
5. Manual match requires knowing a ledger entry ID — users need a searchable interface instead

---

## Priority Matrix

| Priority | Issue | Page |
|----------|-------|------|
| P0 | Flatten Finance sidebar to single entry + tab bar | Navigation |
| P0 | Move association context to sidebar header | Navigation |
| P0 | Add Financial Health Summary card to Finance landing | Foundation |
| P0 | Surface onboarding checklist on Dashboard | Dashboard |
| P1 | Add breadcrumb navigation to all inner pages | Navigation |
| P1 | Fix Finance Foundation: header, scoping, jargon, guidance | Foundation |
| P1 | Late Fees: split into Rules / Activity / Recovery tabs | Late Fees |
| P1 | Vendor Invoices: fix broken route, bulk approve, ungate attachments | Invoices |
| P1 | Owner Ledger: fix jargon label, add description column, fix JSON log | Ledger |
| P1 | Recurring Charges: Run Now confirmation, resolve unitId | Recurring |
| P1 | Owner Portal: role-split landing, persistent balance strip | Portal |
| P2 | Special Assessments: installment preview, ledger path, scoping | Assessments |
| P2 | Utilities: filtering, Mark Paid, scoping, attachment UI | Utilities |
| P2 | Budgets: setup guidance, badge consistency, variance colors | Budgets |
| P2 | Expand command palette search to financial records | Command Palette |
| P2 | Context-sensitive command palette actions | Command Palette |
| P2 | Owner Portal: mobile-first layout | Portal |
| P3 | Reports: jargon tooltips, print export, unbounded query warning | Reports |
| P3 | Reconciliation: step wizard, CSV error handling, match progress | Reconciliation |
| P3 | Action-oriented empty states across all finance pages | Cross-cutting |
| P3 | Finance Setup staged wizard | Foundation |
| P3 | Surface attention items panel on Dashboard | Dashboard |
