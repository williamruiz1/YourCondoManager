# YCM Platform — Information-Architecture Simplification Audit & Proposal (2026-06-30)

**Author:** platform IA audit agent · **Trigger:** William — "too much layering, conflation, and deep-click bullshit" across the whole platform.
**Status:** AUDIT + PROPOSAL (read-only investigation; no routes/nav/components changed). Extends the financials-only model in `docs/financials-ia-audit-2026-06-30.md` to the entire admin surface + owner portal.
**Scope read:** `client/src/App.tsx` (134 `<Route>` entries — 72 live `/app/*`, 62 legacy redirects, ~14 `/portal/*`), `client/src/components/app-sidebar-zones.ts` (the 6-zone admin sidebar), `client/src/pages/portal/portal-shell.tsx` (the owner-portal nav), the 4 zone hub pages, and the per-page tab structures.

---

## TL;DR (3 bullets)

1. **Worst bloat — the admin platform has THREE stacked navigation layers for the same destinations.** To reach a working page you pass through (a) the **zone label** in the sidebar → which lands on (b) a **zone "hub" page** that is just a grid of cards → whose cards link to (c) the actual pages — pages **already listed as expandable sub-items in the sidebar**. So every zone shows its children twice (sidebar sub-items + hub cards), and the hub is a dead landing layer between you and the work. Compounding this: **the same concept is embedded as a tab inside multiple pages** (Maintenance is a sidebar page AND a tab inside Work Orders; Inspections is a sidebar page AND a tab inside Vendors; recurring HOA dues live under both Chart of Accounts and Assessment Rules), so "which door is canonical?" is unanswerable in several places.

2. **Biggest single simplification win — delete the zone "hub" card-grid layer and let a zone label expand its children inline.** It removes a full click + a redundant page from *every* zone for *every* operator, every session, and collapses the platform from "label → hub → page" (3 clicks) to "label → page" (2 clicks) with zero feature loss. It's also the lowest-risk change: the hub pages (`client/src/pages/hubs/*.tsx`, 470 LOC of pure card launchers) add no functionality the sidebar doesn't already provide.

3. **Where this lives:** this doc (`docs/platform-ia-simplification-audit-2026-06-30.md`). A proposed simplified-nav wireframe is at **`docs/platform-ia-wireframe-2026-06-30.html`** (on-brand teal, open it to see the before/after nav tree).

---

## 1. The current IA, mapped (with click-depth)

The platform is TWO products under one app:

### A. Admin / management surface (operator personas) — `client/src/components/app-sidebar-zones.ts`

A left sidebar of **6 zones**, each with an expandable list of sub-items. Clicking a **zone label** navigates to a `hubUrl` (the zone hub page); clicking a **sub-item** navigates to the real page.

| Zone (hub URL) | Sidebar sub-items (route) | Inner tabs on that page |
|---|---|---|
| **Home** (`/app`) | Portfolio Health (`/app/portfolio`), Associations (`/app/associations`) | — |
| **Financials** (`/app/financials`) | *Setup:* Chart of Accounts (`/financial/foundation`), Bank Accounts (`/financial/bank-connections`), Assessment Rules (`/financial/rules`) · *Operations:* Billing (`/financial/billing`), Payments (`/financial/payments`), Expenses (`/financial/expenses`) · *Insight:* Reports (`/financial/reports`), Owner Statement (`/financial/statement`) | Foundation: Accounts / Account Activity / Recurring Charges · Billing: Ledger / Assessments / Late Fees / Delinquency · Rules: Recurring / Special Assessments / Run History · Payments: methods / gateway / links / autopay / webhooks / activity / exceptions / transactions (**8 tabs**) · Expenses: Invoices / Utilities / Budgets · Reports: P&L / AR Aging / Board / Summary / Reports / Reconciliation / Owner Reconciliation (**7 tabs**) |
| **Operations** (`/app/operations`) | Buildings & Units (`/app/units`), People (`/app/persons`), Work Orders (`/app/work-orders`), Maintenance (`/app/maintenance-schedules`), Inspections (`/app/inspections`), Vendors (`/app/vendors`), Insurance (`/app/insurance`), Feedback (`/app/resident-feedback`) | Work Orders: Work Orders / **Maintenance** · Vendors: Vendors / **Inspections** |
| **Governance** (`/app/governance`) | Board (`/app/board`), Documents (`/app/documents`) | Governance page (reachable only via the hub / `/overview`): Meetings / Packages / Elections / Compliance |
| **Communications** (`/app/communications`) | Inbox (`/app/communications/inbox`), Announcements (`/app/announcements`), Amenity Booking (`/app/amenities`), Community Hub (`/app/community-hub`) | Communications page: Communications / Announcements · Inbox: All / Unread / Archived · Community Hub: Settings / Sections / Notices / Quick Actions / Info Blocks / Buildings / Map (**7 tabs**) |
| **Platform** (`/app/platform/controls`, platform-admin only) | Platform Controls, Admin Roadmap, Admin Users, Executive, AI Ingestion | — |
| **Footer** | Settings (`/app/settings`), Help Center | — |

Plus ~12 **unlinked admin pages** reachable only by URL or cross-links (not in the sidebar): `/app/admin/access-review`, `/app/admin/consent-audit`, `/app/admin/go-live-readiness`, `/app/admin/reconciliation`, `/app/admin/payments/record`, `/app/governance/overview`, `/app/governance/meetings|elections|compliance|board-packages` (the last four now **redirect to the hub**), `/app/operations/dashboard`, `/app/operations/records`.

**Click-depth for the 10 most common operator tasks (today):**

| Task | Path today | Clicks |
|---|---|---|
| Post / run recurring dues | sidebar → Assessment Rules → "Recurring" tab → run | **3–4** (and it ALSO appears under Chart of Accounts) |
| Record a payment | sidebar → Payments → "methods/activity" tab | 2–3 |
| View an owner statement | sidebar → Owner Statement | 2 |
| Record an expense / invoice | sidebar → Expenses → "Invoices" tab | 3 |
| Create a work order | sidebar → Work Orders → "Work Orders" tab | 2–3 |
| Schedule maintenance | sidebar → Maintenance **OR** Work Orders → "Maintenance" tab | 2–3 (**two doors**) |
| Log an inspection | sidebar → Inspections **OR** Vendors → "Inspections" tab | 2–3 (**two doors**) |
| Run bank reconciliation | sidebar → Reports → "Reconciliation" tab **OR** `/app/admin/reconciliation` | 3 (**two doors**) |
| Schedule a board meeting | sidebar → Governance (hub) → card → Governance page → "Meetings" tab | **4** |
| Hold an election | sidebar → Governance (hub) → card → Governance page → "Elections" tab | **4** |

### B. Owner portal — `client/src/pages/portal/portal-shell.tsx`

**4 first-person zones**, flat, mobile bottom-tab + desktop sidebar: **Home**, **My Finances** (sub: payment-methods / ledger / statement / receipts / assessment detail), **My Requests**, **My Community** (sub: amenities / notices / documents). This side is **already clean** — first-person labels, ≤3-segment breadcrumbs, no hub layer, no conflation. **It is the model the admin side should converge toward, not the problem.** Findings below are admin-side.

---

## 2. Flagged bloat — ranked worst-first (with evidence)

### #1 — Redundant zone-hub layer (over-layering) · affects EVERY zone
- **Evidence:** sidebar zone labels navigate to `hubUrl` (`app-sidebar-zones.ts` L185-191, `app-sidebar.tsx` L115 `<Link href={zone.hubUrl}>`). The hubs (`client/src/pages/hubs/financials-hub.tsx` L38-83, +`operations-hub.tsx`, `governance-hub.tsx`, `communications-hub.tsx`) render a **card grid that links to the same sub-pages the sidebar already lists** (`financials-hub` `SUB_PAGES` = Chart of Accounts / Billing / Assessment Rules / Payments / Expenses / Reports — verbatim the sidebar's Financials children).
- **Why it's bloat:** the children are shown twice (expandable sidebar items + hub cards), and the hub sits as a dead page between the zone and the work. A user who clicks "Governance" lands on a card page, not on anything actionable.
- **Impact:** +1 click and one redundant page per zone, per session, for every operator. ~470 LOC of nav-only pages.

### #2 — Governance is buried 4 deep AND split across two structures (deep-click + conflation)
- **Evidence:** the four real governance functions (Meetings, Board Packages, Elections, Compliance) are **tabs inside `governance.tsx`** (`TabsTrigger value="meetings|packages|elections|compliance"`). But `governance.tsx` is only reachable at `/app/governance/overview`; `/app/governance` renders the **hub** (`App.tsx` L482), and `/app/governance/meetings|elections|compliance|board-packages` all **redirect to the hub** (App.tsx L483-485, 481). The sidebar's Governance zone only lists **Board** and **Documents** — *none of Meetings/Elections/Compliance is a sidebar item at all.*
- **Why it's bloat:** to reach Meetings you go zone-label → hub → "Governance" card → `/overview` page → "Meetings" tab = **4 clicks**, and the four formerly-direct routes now dead-end at the hub. The core governance workflow is the hardest thing to find in the whole app.
- **Impact:** highest click-depth on the platform; the things a board actually does (meet, vote, stay compliant) are invisible from the nav.

### #3 — Same concept = two doors (conflation / redundancy) · 4 instances
- **(a) Maintenance:** a sidebar page (`/app/maintenance-schedules`) AND a tab inside Work Orders (`work-orders.tsx` L1026 `<MaintenanceSchedulesContent/>`).
- **(b) Inspections:** a sidebar page (`/app/inspections`) AND a tab inside Vendors (`vendors.tsx` L1018,1021 `<InspectionsContent/>`).
- **(c) Recurring HOA dues:** under **Chart of Accounts** (foundation "Recurring Charges" tab) AND under **Assessment Rules** ("Recurring" tab) — both render `FinancialRecurringChargesContent` (the financials-audit finding, still live).
- **(d) Bank reconciliation:** a tab inside Reports (`financial-reports.tsx` L1258 `<FinancialReconciliationContent/>`) AND the standalone `/app/admin/reconciliation` route.
- **Why it's bloat:** two doors to one thing ⇒ "which is canonical?" confusion + double the surface to keep in sync.

### #4 — "Assessment Rules" conflates routine dues with one-time special assessments (naming/conflation)
- **Evidence + analysis:** fully documented in `docs/financials-ia-audit-2026-06-30.md` §2–3. "Assessment Rules" groups recurring HOA dues with special assessments under one "Assessment" label; HOA dues are routine operating revenue, **not** assessments. Carried forward here as a platform finding because it's the same class as #3.

### #5 — Payments + Reports pages are tab-overloaded (over-layering inside a page)
- **Evidence:** Payments = **8 tabs** (methods / gateway / links / autopay / webhooks / activity / exceptions / transactions); Reports = **7 tabs** (P&L / AR Aging / Board / Summary / Reports / Reconciliation / Owner Reconciliation — note "Reports" is a tab inside the Reports page, and "Summary" vs "Board" vs "Reports" overlap). Community Hub = **7 tabs**.
- **Why it's bloat:** 7–8 horizontal tabs exceed scannability; several are admin/config plumbing (gateway, webhooks, exceptions) mixed with daily-use views (activity, transactions). The Reports tab-set has near-duplicate labels (Summary / Board / Reports).

### #6 — Legacy-redirect sprawl + orphan pages (maintenance burden, low user impact)
- **Evidence:** **62 `RouteRedirect`** aliases in `App.tsx` (e.g. `/financial/fees`, `/owners`, `/occupancy`, bare `/board`, `/vendors`, …) and ~12 admin pages not in any sidebar (`/app/admin/access-review`, `/consent-audit`, `/go-live-readiness`, `/operations/dashboard`, `/operations/records`). Necessary for old bookmarks, but the volume signals accreted IA churn and makes the route table hard to reason about. Not user-facing deep-click, but it's where the "too much layering" smell originates in code.

### #7 — Naming that doesn't say what the thing is
- **Evidence:** "Chart of Accounts" surfaces a dues-billing schedule (not GL); "Assessment Rules" holds routine dues; Reports has a "Reports" tab and a "Summary" tab and a "Board" tab; "Community Hub" vs "Communications" vs "Announcements" are three adjacent comms surfaces with overlapping intent. The owner side ("My Finances", "My Requests") shows how much clearer first-person/plain labels read.

---

## 3. Proposed simplified IA

### Principle
Collapse the **label → hub → page** triple into **label → page**; give each concept **one canonical home** with a name that says what it is; cap inner tabs at ~4 by splitting plumbing from daily use. **No new features, no data-model change** — this is placement, naming, and removing the hub layer.

### Proposed admin sidebar (6 zones kept; hubs removed; children expand inline)

```
Home
  • Portfolio Health
  • Associations
Financials
  Setup       · Chart of Accounts (GL only)   · Bank Accounts
  Billing     · Recurring Dues                · Special Assessments   · Owner Statements
  Money       · Payments                      · Expenses
  Insight     · Reports & Reconciliation
Operations
  • Buildings & Units   • People        • Work Orders + Maintenance
  • Inspections         • Vendors       • Insurance        • Feedback
Governance
  • Board          • Meetings        • Elections & Voting
  • Compliance     • Documents       • Board Packages
Communications
  • Inbox          • Announcements   • Amenity Booking     • Community Hub (public site)
Platform (admin only)   Settings · Help (footer)
```

### What folds / renames / moves

| # | Change | From → To | Type |
|---|---|---|---|
| 1 | **Remove the zone-hub card pages**; zone label expands its children inline (sidebar already has them) | hub layer → gone | placement (low risk) |
| 2 | **Surface Governance functions directly in the sidebar** | hidden tabs in `/governance/overview` → Meetings / Elections & Voting / Compliance / Board Packages as Governance items | placement (cuts 4→2 clicks) |
| 3 | **Merge Maintenance into Work Orders** (one page, two tabs) — drop the standalone sidebar item | two doors → one | dedupe |
| 4 | **Keep Inspections as the sidebar home; drop the Inspections tab inside Vendors** (or vice-versa — one canonical) | two doors → one | dedupe + **decision** (which home) |
| 5 | **Recurring dues = one home (Billing → Recurring Dues)**; remove from Chart of Accounts; Chart of Accounts = GL only | two doors → one | dedupe (per financials audit) |
| 6 | **Rename "Assessment Rules" → fold into Billing**; tabs "Recurring Dues" / "Special Assessments" (never call dues "assessments") | mislabel → plain | rename + **decision** |
| 7 | **Bank reconciliation = one home (Reports & Reconciliation)**; retire the orphan `/app/admin/reconciliation` as a redirect | two doors → one | dedupe |
| 8 | **Split Payments' 8 tabs** into daily-use (Activity / Transactions / Record) vs Setup-under-Settings (gateway / webhooks / autopay config) | 8 tabs → ~4 | reduce |
| 9 | **De-dup the Reports tab-set** (Summary/Board/Reports collapse into one "Statements & Reports") | 7 tabs → ~4 | reduce |
| 10 | **Move orphan admin pages under Platform** (access-review, consent-audit, go-live-readiness) so they're not URL-only | orphan → Platform | placement |

### Before / after for the worst offenders

| Task | Before (clicks) | After (clicks) |
|---|---|---|
| Schedule a board meeting | zone → hub → card → page → tab = **4** | sidebar "Meetings" = **1** |
| Hold an election | **4** | sidebar "Elections & Voting" = **1** |
| Post recurring dues | Assessment Rules → Recurring tab (+ dup under Chart of Accounts) = **3** | Billing → Recurring Dues, one home = **2** |
| Any zone's first real page | zone label → hub card grid → page = **3** | zone label expands → page = **2** |
| Log an inspection | Inspections OR Vendors→tab (two doors) | one home = **1–2** |

### Target click-depth: **≤2 for the top 10 tasks** (today 3–4 for half of them).

---

## 4. The genuine decisions for William (don't guess these)

These change product/IA taxonomy, not just labels — surfaced, not asserted.

1. **Remove the zone-hub pages entirely, or keep them as a zone dashboard?** Recommended: remove (they're redundant card-launchers). But if a hub were to become a real *zone dashboard* (alerts/KPIs, not just links), it would earn its place. Decide: delete vs. repurpose-into-dashboard. *(Biggest win is #1; this is the one call that unlocks it.)*
2. **Maintenance & Inspections — which is the canonical home?** Both currently live as a sidebar page AND a tab. Pick: (a) standalone sidebar pages and drop the embedded tabs, or (b) embed under Work Orders / Vendors and drop the sidebar pages. Recommended: standalone pages (clearer), but the embedded-tab grouping may match how operators actually work — your call.
3. **"Assessment Rules" rename + fold into Billing** — touches nav taxonomy + any saved muscle memory/deep links. (Same Decision 2 as the financials audit; recommend ratifying before page moves.)
4. **GL income-account split for dues vs special assessments** — the held accounting decision from the financials audit (Decision 1 there). Unchanged; still William's call.
5. **Communications vs Community Hub vs Announcements** — three adjacent comms surfaces. Is "Community Hub" (the public-site config, 7 tabs) really a *Communications* zone item, or a *Platform/Settings* config surface? Decide whether to keep it in Communications or move it to setup.
6. **Six zones — keep all six, or merge Governance into Operations?** Governance has only Board + Documents as sidebar items today (the rest are buried). With #2 surfacing its functions, six zones is justified; if you'd rather a leaner top level, Governance could fold into a "Board & Governance" area. Recommend keeping six (clarity), but flagging the option.

---

## 5. What this audit did vs. deferred

- **Did:** read-only map of the full admin + portal IA from `App.tsx` + `app-sidebar-zones.ts` + `portal-shell.tsx` + per-page tabs; ranked the bloat with file/route evidence; proposed a label→page (hub-removed) sidebar with before/after click-depths; produced `docs/platform-ia-wireframe-2026-06-30.html`.
- **Deferred to William:** all six decisions in §4 — no routes, nav, or components were changed. The owner portal is intentionally left alone (it's already the clean model).
- **Sequencing recommendation if ratified:** #1 (remove hubs) → #2 (surface Governance) are the highest-win / lowest-risk and independent of accounting; do them first. #5/#6 (dues home + Assessment Rules rename) chain off the financials audit's decisions. Tab-reduction (#8/#9) and orphan-cleanup (#10) are polish.
