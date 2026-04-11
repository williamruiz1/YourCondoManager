# Your Condo Manager — IA Restructure Proposal

**Phase:** 5 of 6 (STOPPED at human review gate)
**Date:** 2026-04-11
**Status:** DRAFT — awaiting owner acceptance before Phase 6 execution
**Audit corpus:** A1–A8 (Phase 1) + Phase 2 orphan sweep + Phase 3 reconciliation + Phase 4 Zone 3 pass

---

## 1. Executive Summary

- **Nav shrinks from ~29 items to ~22 primary nav items.** The Zone 1+2 consolidation retires 14 items (kills, merges, demotions); Zone 3 gains 3 explicit entries (admin-users, executive, ai-ingestion promoted from hidden tab bar to sidebar). Net reduction is meaningful without losing any coverage.
- **Three "command center" pages collapse to two + one section hub.** `dashboard.tsx` stays as the primary landing page (action-oriented). `portfolio.tsx` is relabeled "Portfolio Health" (analytical peer). `operations-dashboard.tsx` is reclassified Z1-6 and renamed "Operations Overview" — a section hub, not a third top-level command center.
- **Seventeen customer-side files are killed.** Eight legacy financial files and four legacy governance files had their content already fully absorbed by live hub tabs (confirmed by A3 and A4). Five additional files are killed because their content is already embedded in sibling pages (announcements in communications, insurance as documents tab, maintenance-schedules as work-orders tab, inspections re-homed to work-orders, new-association widgetized into associations dialog).
- **Zone 2 becomes a named, visible sidebar section.** Documents & Insurance merge into a single "Documents & Records" hub (two tabs). Associations and Association Setup are explicitly grouped as Setup & Reference. Insurance disappears as a standalone nav entry.
- **Zone 3 gating has four direct-URL bypass gaps.** Routes `/app/admin`, `/app/admin/roadmap`, `/app/admin/users`, and `/app/admin/executive` have no inline role check in `App.tsx`. Phase 4 recommended adding inline `adminRole === "platform-admin"` checks immediately. Phase 6 should consolidate under `/app/operator/*`.
- **Three taxonomy disputes (TD-1, TD-2, TD-3) and seven open implementation decisions block Phase 6 execution.** Each is listed in sections 2 and 8 below with a clear owner decision required. Phase 6 cannot be dispatched until all blockers are resolved.

---

## 2. BLOCKERS — Unresolved Taxonomy Disputes (TD-1, TD-2, TD-3)

These three disputes were surfaced by Phase 3 and remain unresolved pending owner input. **Phase 6 cannot proceed on the affected page sets until the owner picks a resolution for each.** The coordinator has proceeded with a default in the nav tree below and flagged each default — the owner may accept or override.

---

### TD-1: `operations-dashboard.tsx` — Z1-1 Command Center vs. Z1-6 Service & Maintenance

**Question for the owner:** Does the Z1-1 (Command Center) category include section-scoped dashboards — pages that show at-a-glance state for a single operational domain — or is Z1-1 reserved strictly for cross-association / portfolio-level views?

**Options:**
- **Option A (coordinator default, used in §3 nav tree below):** `operations-dashboard.tsx` is Z1-6. It fetches a single-association operational aggregate (`GET /api/operations/dashboard`). It is a section-level status hub, not a cross-association command center. Re-labeled "Operations Overview" in sidebar and page header. Verdict: PATCH + RENAME.
- **Option B:** `operations-dashboard.tsx` is Z1-1. The section-scoped framing is intentional; "Command Center" covers both portfolio-wide and per-section at-a-glance views. The page stays in the Overview group alongside Dashboard and Portfolio Health. Verdict: RENAME-MOVE.

**Coordinator recommendation:** Option A. The spec taxonomy definition is explicit: Z1-1 is "at-a-glance cross-association or cross-portfolio state." The operations dashboard is single-association-scoped.

**Phase 6 impact of this dispute:** If Option B is chosen, the Operations section loses its parent entry and Phase 6 must decide what replaces it as the clickable parent for Work Orders / Vendors / Feedback children.

**OWNER DECISION REQUIRED before Phase 6 touches `operations-dashboard.tsx`.**

---

### TD-2: `board-portal.tsx` — Zone 1 customer portal vs. deprecation

**Question for the owner:** Should `board-portal.tsx` be promoted to a first-class Zone 1 route, or should it be deprecated in favor of the standard workspace shell that `board-admin` users already have access to?

**Context:** `board-portal.tsx` is a full alternative workspace shell rendered at the `AuthAwareApp` root level (outside `/app/*` routing) for `isBoardAdmin && hasWorkspaceAccess`. It duplicates the association workspace nav with its own six-section structure (Overview, Financial, Governance, Maintenance, Documents, Communications). It contains stale sub-links to deprecated redirect paths (`/app/financial/budgets`, `/app/governance/board-packages`, etc.). Phase 4 confirmed its primary persona is `board-admin` (Zone 1, not Zone 3).

**Options:**
- **Option A (promote):** Assign a canonical `/app/board-portal` route inside WorkspaceRouter. Update stale sub-links to live URLs. Add a sidebar entry for `board-admin` users (Z1-1 Command Center — board-admin variant). The `board-portal.tsx` file becomes a proper first-class Zone 1 page.
- **Option B (deprecate):** The `board-admin` persona already has full access to the association workspace through the standard `WorkspaceShell`. The board-portal alternative shell is an undocumented UX branch with stale links and no canonical URL. Deprecate it: route `board-admin` users through the standard workspace, update the `AuthAwareApp` root-level conditional to remove the board-portal branch. The file is a KILL candidate.

**Coordinator recommendation:** Option B. The standard workspace already serves board-admin users. A parallel shell with stale links and no canonical route adds complexity without clear benefit. Deprecating it simplifies the architecture.

**Phase 6 impact:** If Option A is chosen, `board-portal.tsx` adds a new Zone 1 hub page spec (add to §5), a new sidebar entry in §3, and a new row in §4. If Option B, it joins the kill list in §7.

**OWNER DECISION REQUIRED before Phase 6 touches `board-portal.tsx`.**

---

### TD-3: `workspace-preview.tsx` — Z3-3 Platform Diagnostics vs. out-of-scope public marketing surface

**Question for the owner:** Should `workspace-preview.tsx` be treated within this audit's scope as a Z3-3 diagnostic/preview page, or as an out-of-scope public surface to be handled in the follow-on marketing audit?

**Context:** `workspace-preview.tsx` is a static pre-authentication marketing preview shown to unauthenticated visitors who hit any `/app/*` path. It has no `/app/*` route, no API calls, and no platform-admin gate. Its primary audience is unauthenticated prospects. Phase 2 gave it a Z3-3 tag by proximity (no better fit in the 13-category taxonomy). Phase 4 confirmed it is not a Zone 3 operator page.

**Options:**
- **Option A (Z3-3, in-scope):** Accept the Z3-3 tag as a taxonomy stretch. Phase 5 action: add `workspace-preview.tsx` to `PublicRouter` at a canonical URL (e.g. `/workspace-preview`). The current fallback behavior (shown at unauthenticated `/app/*` hits) is acceptable UX; the gap is the missing canonical URL.
- **Option B (out of scope, follow-on):** `workspace-preview.tsx` is a public marketing page. Per C9, scope is `/app/*` only. The page is not `/app/*` content in intent. Defer to the follow-on marketing surface audit. No action in Phase 6.
- **Option C (coordinator default, used in §3):** Accept Z3-3 for audit record-keeping purposes but exclude from the Zone 3 nav tree (it has no operator nav entry). Add a Phase 6 task to promote it to `PublicRouter` with a canonical URL. Effectively Option A without a sidebar entry.

**Coordinator recommendation:** Option C. The page needs a canonical URL regardless of taxonomy. Waiting for a follow-on audit means this remains a navigation dead-end indefinitely.

**OWNER DECISION REQUIRED before Phase 6 touches `workspace-preview.tsx`.**

---

## 3. Complete Proposed Nav Tree (Zones 1+2+3)

This is the unified replacement for the current `app-sidebar.tsx`. It takes Phase 3's Zone 1+2 tree and Phase 4's Zone 3 tree and merges them. The current sidebar has 3 groups (Overview, Association workspace, Platform); the proposed sidebar has 4 groups (Overview, [Active Association], Setup & Reference, Platform).

Role values use the `AdminRole` type already defined in `app-sidebar.tsx`: `"platform-admin"`, `"board-admin"`, `"manager"`, `"viewer"`.

---

### Group: Overview

_Always visible. Association-context-independent. Reduced from 3 items to 2 (Associations moves to Setup & Reference)._

| Label | URL | Source file | Roles | Notes |
|---|---|---|---|---|
| **Dashboard** | `/app` | `dashboard.tsx` | all four roles | Primary Z1-1 landing page; label may change to "Home" (pending owner preference) |
| **Portfolio Health** | `/app/portfolio` | `portfolio.tsx` | `platform-admin, board-admin, manager, viewer` | Old label: "Portfolio"; relabeled for analytical framing; URL unchanged; hidden for `isSingleAssociationBoardExperience` |

---

### Group: [Active Association Name] — Zone 1 (shown when an association is active)

#### Residents & Units (Z1-2)

| Label | URL | Source file | Roles | Notes |
|---|---|---|---|---|
| **Buildings & Units** | `/app/units` | `units.tsx` | `platform-admin, board-admin, manager` | No change |
| **People** | `/app/persons` | `persons.tsx` | `platform-admin, board-admin, manager` | Promoted from child of Buildings & Units to peer-level nav item; URL unchanged |

_People is a peer-level entry (same indentation as Buildings & Units), not a child._

#### Financial Operations (Z1-3)

| Label | URL | Source file | Roles | Notes |
|---|---|---|---|---|
| **Finance** | `/app/financial/foundation` | `financial-foundation.tsx` | all four roles | Hub parent; tabs: Accounts / Account Activity / Recurring Charges |
| &nbsp;&nbsp;↳ Billing | `/app/financial/billing` | `financial-billing.tsx` | all four roles | Tabs: Owner Ledger / Assessments / Late Fees |
| &nbsp;&nbsp;↳ Payments | `/app/financial/payments` | `financial-payments.tsx` | all four roles | Tabs: Payment Methods / Gateway / Owner Links / Webhooks / Activity / Exceptions |
| &nbsp;&nbsp;↳ Expenses | `/app/financial/expenses` | `financial-expenses.tsx` | all four roles | Tabs: Invoices / Utilities / Budgets |
| &nbsp;&nbsp;↳ Reports | `/app/financial/reports` | `financial-reports.tsx` | all four roles | Tabs: P&L / Collections / AR Aging / Reserve / Board Summary / Reconciliation |

#### Governance & Decisions (Z1-4) + Communications (Z1-5)

_Group renamed from "Board" to "Governance & Communications." Primary group entry changed from `board.tsx` to `governance.tsx`._

| Label | URL | Source file | Roles | Notes |
|---|---|---|---|---|
| **Governance** | `/app/governance` | `governance.tsx` | all four roles | New group parent entry (was "Board" group parent); tabs: Meetings / Board Packages / Elections / Compliance |
| &nbsp;&nbsp;↳ Board Members | `/app/governance/members` | `board.tsx` | all four roles | Old URL: `/app/board`; new label: "Board Members"; RouteRedirect from `/app/board` required |
| **Communications** | `/app/communications` | `communications.tsx` | all four roles | Tabs: Delivery Workspace / Announcements / Onboarding / Operations |

_`election-detail.tsx` at `/app/governance/elections/:id` is a live deep-detail route, not a sidebar item._
_`announcements.tsx` — REMOVED from nav. Announcements tab inside Communications is canonical._

#### Service & Maintenance (Z1-6)

| Label | URL | Source file | Roles | Notes |
|---|---|---|---|---|
| **Operations Overview** | `/app/operations/dashboard` | `operations-dashboard.tsx` | all four roles | Old label: "Operations"; relabeled per TD-1 Option A default; section hub parent |
| &nbsp;&nbsp;↳ Work Orders | `/app/work-orders` | `work-orders.tsx` | all four roles | Tabs: Work Orders / Maintenance / Inspections |
| &nbsp;&nbsp;↳ Vendors | `/app/vendors` | `vendors.tsx` | `platform-admin, board-admin, manager, viewer` | Inspections tab removed; remaining tabs unchanged |
| &nbsp;&nbsp;↳ Feedback | `/app/resident-feedback` | `resident-feedback.tsx` | all four roles | Sidebar label: "Feedback"; URL unchanged |

_`maintenance-schedules.tsx` — REMOVED from nav (Maintenance tab in Work Orders is canonical)._
_`inspections.tsx` — REMOVED from nav (Inspections tab in Work Orders is canonical)._

#### Community & Amenities (Z1-7)

| Label | URL | Source file | Roles | Notes |
|---|---|---|---|---|
| **Amenity Admin** | `/app/amenity-admin` | `amenities-admin.tsx` | all four roles | Old label: "Amenity Booking"; old URL: `/app/amenities`; RouteRedirect from old URL required |
| **Community Hub Config** | `/app/community-hub` | `community-hub.tsx` | all four roles | Old label: "Community Hub"; relabeled to clarify operator-config vs. public microsite |

---

### Group: Setup & Reference — Zone 2 (lower sidebar section)

_New explicit Zone 2 section. Pages previously interleaved in the Association workspace or hidden entirely._

| Label | URL | Source file | Roles | Notes |
|---|---|---|---|---|
| **Associations** | `/app/associations` | `associations.tsx` | all four roles (hidden for `isSingleAssociationBoardExperience`) | Moved from Overview group; URL unchanged |
| **Association Setup** | `/app/association-context` | `association-context.tsx` | all four roles | Previously unlabeled header shortcut only; now explicit Zone 2 entry; URL unchanged |
| **Documents & Records** | `/app/documents` | `documents.tsx` | all four roles | Old label: "Documents"; gains Policies tab from `insurance.tsx`; tabs: Documents / Policies |

_`insurance.tsx` — REMOVED as standalone nav entry; absorbed as Policies tab in Documents & Records._
_`new-association.tsx` — REMOVED as footer button; WIDGETIZE into `associations.tsx` create dialog._

#### Footer (Zone 2 — personal)

| Label | URL | Source file | Roles | Notes |
|---|---|---|---|---|
| **Settings** | `/app/settings` | `user-settings.tsx` | all four roles | Footer entry; PATCH to extend profile (avatar, phone, password note) |
| **Help Center** | `/app/help-center` | `help-center.tsx` | all four roles | Footer entry; PATCH to add live support, new feature content |

---

### Group: Platform — Zone 3 (platform-admin only; `roles: ["platform-admin"]`)

_All items gated by `roles: ["platform-admin"]`. Current single-parent structure flattened to a peer list per Phase 4 recommendation. Owner Portal link REMOVED (see §8 Q4)._

| Label | URL | Source file | Notes |
|---|---|---|---|
| **Platform Controls** | `/app/platform/controls` | `platform-controls.tsx` | Z3-1; KEEP; already gated; internal tabs for SMS/Email/Push/Billing/Stripe/Webhooks/Tenant Config/Permission Envelopes/Scopes |
| **AI Ingestion** | `/app/ai/ingestion` | `ai-ingestion.tsx` | Z3-1; PATCH; promoted from child of Platform Controls to peer entry; replace WIP gate with `adminRole === "platform-admin"` inline check |
| **Admin Roadmap** | `/app/admin/roadmap` | `roadmap.tsx` | Z3-2; PATCH; currently linked as child; promoted to peer entry; add inline role check |
| **Admin Users** | `/app/admin/users` | `admin-users.tsx` | Z3-2; PATCH; add explicit sidebar link; currently tab-bar only; add inline role check |
| **Executive Decks** | `/app/admin/executive` | `executive.tsx` | Z3-2; PATCH; add explicit sidebar link; currently tab-bar only; add inline role check |

---

### Items Removed from Nav (complete list)

| Was | Reason |
|---|---|
| Associations (in Overview group) | Moved to Setup & Reference group |
| Board (group parent → `/app/board`) | Group renamed; page becomes Board Members child under Governance |
| Documents (standalone, label only) | Relabeled to Documents & Records |
| Insurance (standalone `/app/insurance`) | Absorbed as Policies tab in Documents & Records |
| Announcements (standalone `/app/announcements`) | Already embedded as tab in Communications |
| Maintenance (standalone `/app/maintenance-schedules`) | Absorbed as Maintenance tab in Work Orders |
| Inspections (standalone `/app/inspections`) | Re-homed as Inspections tab in Work Orders |
| Owner Portal link (`/portal` in Platform group) | Wrong surface in operator menu; removed (see §8 Q4) |
| AI Ingestion (child of Platform Controls) | Promoted to peer-level Platform entry |
| Admin Roadmap (child of Platform Controls) | Promoted to peer-level Platform entry |

---

### Zone 3 Board-Portal and Workspace-Preview (pending TD-2, TD-3)

`board-portal.tsx` and `workspace-preview.tsx` are NOT included in the nav tree pending TD-2 and TD-3 owner decisions. If TD-2 resolves as "promote," add `board-portal.tsx` as a Zone 1 item under the [Active Association] group, Z1-1, roles `["board-admin"]`. If TD-3 resolves as "in-scope," add `workspace-preview.tsx` to `PublicRouter` with no sidebar entry.

---

## 4. Per-Page Action List (Migration Plan)

Table format: **#** | **File** | **Current URL** | **Verdict** | **Action** | **Target** | **Affects** | **Prereq**

Pages are ordered by dependency. Hub patches must precede standalone-route kills. Renames that change URLs must precede their RouteRedirects.

| # | File | Current URL | Verdict | Action | Target | Affects | Prereq |
|---|---|---|---|---|---|---|---|
| 1 | `work-orders.tsx` | `/app/work-orders` | PATCH | Add Inspections tab (move `InspectionsContent` from `vendors.tsx`); retain existing Maintenance tab | Self | `vendors.tsx` loses Inspections tab; sidebar Maintenance + Inspections entries can be removed | None |
| 2 | `vendors.tsx` | `/app/vendors` | PATCH | Remove embedded Inspections tab (tab moves to work-orders.tsx) | Self | Sidebar Inspections child entry removed | #1 must be done first |
| 3 | `documents.tsx` | `/app/documents` | RENAME-MOVE + PATCH | Add Policies tab (import `InsuranceContent` from `insurance.tsx`); rename sidebar label to "Documents & Records" | `/app/documents` (unchanged URL) | Sidebar Insurance entry removed; `insurance.tsx` standalone route → RouteRedirect | None |
| 4 | `governance.tsx` | `/app/governance` | PATCH | Add Members tab (import `BoardContent` from `board.tsx`); accessible at `/app/governance/members` | Self | `board.tsx` route → RouteRedirect `/app/board` → `/app/governance/members` | None |
| 5 | `app-sidebar.tsx` | — | RESTRUCTURE | Implement new nav tree per §3: rename groups, reorder items, add Setup & Reference group, flatten Platform group, remove 10 nav entries, add 3 new Platform entries | `app-sidebar.tsx` | All sidebar changes (all groups); triggers downstream route-guard additions in App.tsx | Hub patches (#1–4) done; RouteRedirects for renames added (#6–10) |
| 6 | `amenities-admin.tsx` | `/app/amenities` | RENAME-MOVE | Update route from `/app/amenities` to `/app/amenity-admin` in App.tsx; add `<RouteRedirect from="/app/amenities" to="/app/amenity-admin" />` | `/app/amenity-admin` | App.tsx route update; sidebar label change to "Amenity Admin" | None |
| 7 | `board.tsx` | `/app/board` | RENAME-MOVE | Add `<RouteRedirect from="/app/board" to="/app/governance/members" />` in App.tsx; accessible as tab at `/app/governance/members` | `/app/governance/members` | App.tsx redirect addition; sidebar Board group header renamed | #4 done |
| 8 | `portfolio.tsx` | `/app/portfolio` | RENAME-MOVE | Sidebar label change to "Portfolio Health"; URL unchanged | `/app/portfolio` | Sidebar label only; App.tsx no change | None |
| 9 | `operations-dashboard.tsx` | `/app/operations/dashboard` | PATCH + RENAME | Sidebar label change to "Operations Overview"; page header rename | `/app/operations/dashboard` (unchanged) | Sidebar label; page header `<h1>` text | None |
| 10 | `community-hub.tsx` | `/app/community-hub` | PATCH | Sidebar label change to "Community Hub Config"; page header `<h1>` rename | Self | Sidebar label; page `<h1>` text | None |
| 11 | `association-context.tsx` | `/app/association-context` | RENAME-MOVE | Add named sidebar entry in Zone 2 Setup & Reference group, labeled "Association Setup" | `/app/association-context` (unchanged URL) | Sidebar gains new entry; URL unchanged | #5 |
| 12 | `associations.tsx` | `/app/associations` | RENAME-MOVE | Move from Overview nav group to Setup & Reference group | `/app/associations` (unchanged URL) | Sidebar group move only; URL unchanged | #5 |
| 13 | `maintenance-schedules.tsx` | `/app/maintenance-schedules` | MERGE-AS-TAB | Retire standalone route; add `<RouteRedirect from="/app/maintenance-schedules" to="/app/work-orders" />`; Maintenance tab in work-orders is canonical | `work-orders.tsx` Maintenance tab | App.tsx redirect; sidebar Maintenance child entry removed | #1 done |
| 14 | `inspections.tsx` | `/app/inspections` | MERGE-AS-TAB | Retire standalone route; add `<RouteRedirect from="/app/inspections" to="/app/work-orders" />`; Inspections tab in work-orders is canonical | `work-orders.tsx` Inspections tab | App.tsx redirect; sidebar Inspections child entry removed | #1, #2 done |
| 15 | `insurance.tsx` | `/app/insurance` | MERGE-AS-TAB | Retire standalone route; add `<RouteRedirect from="/app/insurance" to="/app/documents" />`; Policies tab in documents is canonical | `documents.tsx` Policies tab | App.tsx redirect; sidebar Insurance entry removed | #3 done |
| 16 | `announcements.tsx` | `/app/announcements` | KILL | Delete file; add `<RouteRedirect from="/app/announcements" to="/app/communications" />` | `communications.tsx` Announcements tab | App.tsx redirect; sidebar Announcements child entry removed | Announcements tab in communications confirmed live |
| 17 | `new-association.tsx` | `/app/new-association` | WIDGETIZE → KILL | Confirm `associations.tsx` create dialog fully covers two-step wizard; then delete file; remove footer "New Association" button in sidebar; retire route | `associations.tsx` create dialog | App.tsx route removal; sidebar footer button removal | `associations.tsx` dialog confirmed complete (Phase 6 precondition check) |
| 18 | `financial-budgets.tsx` | redirect only | KILL | Delete file | — | Remove `<RouteRedirect>` in App.tsx line 277 (keep redirect for 1 release, then remove) | None |
| 19 | `financial-utilities.tsx` | redirect only | KILL | Delete file | — | Remove `<RouteRedirect>` in App.tsx line 276 | None |
| 20 | `financial-recurring-charges.tsx` | redirect only | KILL | Delete file | — | Remove `<RouteRedirect>` in App.tsx line 271 | None |
| 21 | `financial-reconciliation.tsx` | redirect only | KILL | Delete file | — | Remove `<RouteRedirect>` in App.tsx line 278 | None |
| 22 | `financial-invoices.tsx` | redirect only | KILL | Delete file | — | Remove `<RouteRedirect>` in App.tsx line 275 | None |
| 23 | `financial-late-fees.tsx` | redirect only | KILL | Delete file | — | Remove `<RouteRedirect>` in App.tsx line 274 | None |
| 24 | `financial-ledger.tsx` | redirect only | KILL | Delete file | — | Remove `<RouteRedirect>` in App.tsx line 272 | None |
| 25 | `financial-assessments.tsx` | redirect only | KILL | Delete file | — | Remove `<RouteRedirect>` in App.tsx line 273 | None |
| 26 | `governance-compliance.tsx` | redirect only | KILL | Delete file | — | Remove `<RouteRedirect>` in App.tsx line 290 | None |
| 27 | `meetings.tsx` | redirect only | KILL | Delete file | — | Remove `<RouteRedirect>` in App.tsx line 289 | None |
| 28 | `board-packages.tsx` | redirect only | KILL | Delete file | — | Remove `<RouteRedirect>` in App.tsx line 288 | None |
| 29 | `elections.tsx` | redirect only | KILL | Delete file | — | Remove `<RouteRedirect>` in App.tsx line 291 | None |
| 30 | `ai-ingestion.tsx` | `/app/ai/ingestion` | PATCH | Replace `canAccessWipRoute` with `adminRole === "platform-admin"` inline check in App.tsx; add explicit sidebar link | Zone 3 Platform group (peer entry) | App.tsx route guard; sidebar Platform group restructure | #5 |
| 31 | `roadmap.tsx` | `/app/admin/roadmap` | PATCH | Add `adminRole === "platform-admin"` inline check in App.tsx:259-260; promote to peer sidebar entry in Platform group | Zone 3 Platform group (peer entry) | App.tsx two route guards; sidebar Platform group restructure | #5 |
| 32 | `admin-users.tsx` | `/app/admin/users` | PATCH | Add `adminRole === "platform-admin"` inline check in App.tsx:261; add explicit sidebar link | Zone 3 Platform group (peer entry) | App.tsx route guard; sidebar Platform group restructure | #5 |
| 33 | `executive.tsx` | `/app/admin/executive` | PATCH | Add `adminRole === "platform-admin"` inline check in App.tsx:262; add explicit sidebar link | Zone 3 Platform group (peer entry) | App.tsx route guard; sidebar Platform group restructure | #5 |
| 34 | `board-portal.tsx` | (no URL — conditional root render) | PENDING TD-2 | Option A: promote to `/app/board-portal`; Option B: deprecate (KILL) | Zone 1 or KILL | TD-2 owner decision required | TD-2 resolved |
| 35 | `workspace-preview.tsx` | (no URL — unauthenticated fallback) | PENDING TD-3 | Option A/C: add to `PublicRouter` at `/workspace-preview`; Option B: defer to follow-on audit | Public route or deferred | TD-3 owner decision required | TD-3 resolved |

---

## 5. New Hub Page Specs

These are the hubs that require content additions (new tabs) before their absorbed pages can be killed. Spec-level stubs only.

---

### H1: Documents & Records hub (enhanced `documents.tsx`)

**File:** `client/src/pages/documents.tsx`
**URL:** `/app/documents` (unchanged)
**Purpose:** Single Zone 2 reference surface for all document-class records (files + policy metadata).
**Current state:** Single view — document list with type filters and portal publish toggle.
**After Phase 6:** Two-tab hub — "Documents" tab (existing content) + "Policies" tab (insurance content).

**Absorbed pages:** `insurance.tsx` → "Policies" tab.

**Required UI state shape:**
```
tabs: ["documents", "policies"]
activeTab: "documents" | "policies"  // URL-param or local state
```

**Required data fetches (Policies tab):**
- `GET /api/insurance/policies?associationId=...` — policy list
- `POST /api/insurance/policies` — create policy
- `PATCH /api/insurance/policies/:id` — update policy
- Renewal alerts endpoint (from `insurance.tsx`)

**Content note (A5):** Both the Documents tab and the Policies tab should surface the "Insurance" document type filter together. After merge, the Insurance PDF vault view (filtered Documents list) and the structured policy metadata (Policies tab) should be visually co-located to eliminate the two-entry-point ambiguity.

---

### H2: Work Orders hub (enhanced `work-orders.tsx`)

**File:** `client/src/pages/work-orders.tsx`
**URL:** `/app/work-orders` (unchanged)
**Purpose:** Unified operational maintenance hub covering reactive work orders, preventive maintenance schedules, and inspection records.
**Current state:** Two tabs — Work Orders + Maintenance (already embedded from `maintenance-schedules.tsx`).
**After Phase 6:** Three tabs — Work Orders / Maintenance / Inspections.

**Absorbed pages:** `maintenance-schedules.tsx` (already embedded; standalone route retired) + `inspections.tsx` (tab moved from `vendors.tsx`).

**Required UI state shape:**
```
tabs: ["work-orders", "maintenance", "inspections"]
activeTab: "work-orders" | "maintenance" | "inspections"
```

**Required data fetches (Inspections tab — moving from `vendors.tsx`):**
- `GET /api/inspections`
- `POST /api/inspections`
- `PATCH /api/inspections/:id`
- `POST /api/inspections/:id/findings/:findingIndex/convert-to-work-order`

**Content note (Phase 3 IC-2):** Asset management (`GET/POST/PATCH/DELETE /api/assets`) is currently only accessible within the Maintenance tab. This remains unchanged — Assets does not need its own nav entry at this time.

**Prerequisite:** `vendors.tsx` must drop its embedded Inspections tab simultaneously (migration items #1 and #2 are co-dependent).

---

### H3: Governance hub — new Members tab (enhanced `governance.tsx`)

**File:** `client/src/pages/governance.tsx`
**URL:** `/app/governance` (unchanged)
**Purpose:** Complete governance surface covering board processes (meetings, packages, elections, compliance) plus the board roster (members).
**Current state:** Four tabs — Meetings / Board Packages / Elections / Compliance.
**After Phase 6:** Five tabs — Meetings / Board Packages / Elections / Compliance / Members. Members tab accessible at `/app/governance/members`.

**Absorbed pages:** `board.tsx` → "Members" tab.

**Required UI state shape:**
```
tabs: ["meetings", "board-packages", "elections", "compliance", "members"]
activeTab: string  // supports URL-param tab: /app/governance?tab=members or /app/governance/members
```

**Required data fetches (Members tab — from `board.tsx`):**
- `GET /api/board-roles?associationId=...` — board member list with roles and terms
- `POST/PATCH/DELETE /api/board-roles` — board role management
- Workspace invite flow for board members

**RouteRedirect required:** `/app/board` → `/app/governance/members` per C7.

---

## 6. Rename/Move List

Full table of old → new label/URL changes with file-level impact.

| Old Label | New Label | Old URL | New URL | Source File | Change Type | App.tsx Impact |
|---|---|---|---|---|---|---|
| Portfolio | Portfolio Health | `/app/portfolio` | `/app/portfolio` | `portfolio.tsx` | Label only | None |
| Associations (Overview group) | Associations (Setup group) | `/app/associations` | `/app/associations` | `associations.tsx` | Sidebar group move | None |
| (no label — header shortcut) | Association Setup | `/app/association-context` | `/app/association-context` | `association-context.tsx` | New sidebar entry | None |
| Board (group parent) | Board Members (child item) | `/app/board` | `/app/governance/members` | `board.tsx` | URL change + label change | Add `<RouteRedirect from="/app/board" to="/app/governance/members" />` |
| "Board" (group label) | "Governance & Communications" | N/A | N/A | `app-sidebar.tsx` | Group label only | None |
| Documents | Documents & Records | `/app/documents` | `/app/documents` | `documents.tsx` | Label only | None |
| Operations (group parent) | Operations Overview | `/app/operations/dashboard` | `/app/operations/dashboard` | `operations-dashboard.tsx` | Label only | None |
| Amenity Booking | Amenity Admin | `/app/amenities` | `/app/amenity-admin` | `amenities-admin.tsx` | Label + URL change | Update route; add `<RouteRedirect from="/app/amenities" to="/app/amenity-admin" />` |
| Community Hub | Community Hub Config | `/app/community-hub` | `/app/community-hub` | `community-hub.tsx` | Label + page header | None |
| Admin Roadmap (child of Platform Controls) | Admin Roadmap (peer in Platform group) | `/app/admin/roadmap` | `/app/admin/roadmap` | `roadmap.tsx` | Nav restructure | Add inline role check |
| AI Ingestion (child of Platform Controls) | AI Ingestion (peer in Platform group) | `/app/ai/ingestion` | `/app/ai/ingestion` | `ai-ingestion.tsx` | Nav restructure | Replace WIP gate with role check |
| (tab-bar only) | Admin Users (sidebar entry) | `/app/admin/users` | `/app/admin/users` | `admin-users.tsx` | New sidebar entry | Add inline role check |
| (tab-bar only) | Executive Decks (sidebar entry) | `/app/admin/executive` | `/app/admin/executive` | `executive.tsx` | New sidebar entry | Add inline role check |

---

## 7. Kill List (17 Files + C2 Coordination)

All 17 customer-side kills from Phase 3's tally. Kill actions for `board-portal.tsx` are pending TD-2.

---

### 7.1 Legacy Financial Files (8) — Full KILL

All content fully covered by live hub tabs (A3 confirmed). All backing API routes retained.

| # | File | Current Route Status | API Routes Affected | Recommendation | Blockers |
|---|---|---|---|---|---|
| 1 | `financial-budgets.tsx` | Redirect-only (`/app/financial/budgets` → `/app/financial/expenses`) | `/api/financial/budgets` (GET/POST/PATCH), `/api/financial/budgets/:id/versions` (GET/POST/PATCH/DELETE), `/api/financial/budget-versions/:id/lines` (GET/POST/PATCH) — **KEEP all; back the Expenses hub Budgets tab** | Kill now in Phase 6; keep RouteRedirect for 1 release cycle | None |
| 2 | `financial-utilities.tsx` | Redirect-only (`/app/financial/utilities` → `/app/financial/expenses`) | `/api/financial/utilities` (GET/POST/PATCH) — **KEEP; backs Expenses hub Utilities tab** | Kill now in Phase 6; keep RouteRedirect 1 release | None |
| 3 | `financial-recurring-charges.tsx` | Redirect-only (`/app/financial/recurring-charges` → `/app/financial/foundation`) | `/api/financial/recurring-charges/schedules` (GET/POST/PATCH), `/api/financial/recurring-charges/run` (POST), `/api/financial/recurring-charges/runs` (GET), `/api/financial/recurring-charges/runs/:id/retry` (POST) — **KEEP all; back Foundation hub tab** | Kill now; keep RouteRedirect 1 release | None |
| 4 | `financial-reconciliation.tsx` | Redirect-only (`/app/financial/reconciliation` → `/app/financial/reports`) | `/api/financial/reconciliation/imports` (GET/POST), `/api/financial/reconciliation/transactions` (GET/PATCH), `/api/financial/reconciliation/auto-match` (POST), `/api/financial/reconciliation/periods` (GET/POST/PATCH), `/api/financial/reconciliation/transactions/:id/match` (PATCH) — **KEEP all; back Reports hub Reconciliation tab** | Kill now; keep RouteRedirect 1 release | None |
| 5 | `financial-invoices.tsx` | Redirect-only (`/app/financial/invoices` → `/app/financial/expenses`) | `/api/financial/invoices` (GET/POST/PATCH) — **KEEP; backs Expenses hub Invoices tab** | Kill now; keep RouteRedirect 1 release | None |
| 6 | `financial-late-fees.tsx` | Redirect-only (`/app/financial/late-fees` → `/app/financial/billing`) | `/api/financial/late-fee-rules` (GET/POST/PATCH), `/api/financial/late-fee-events` (GET), `/api/financial/late-fees/calculate` (POST) — **KEEP all; back Billing hub Late Fees tab** | Kill now; keep RouteRedirect 1 release | None |
| 7 | `financial-ledger.tsx` | Redirect-only (`/app/financial/ledger` → `/app/financial/billing`) | `/api/financial/owner-ledger/entries` (GET/POST/PATCH), `/api/financial/owner-ledger/summary/:id` (GET) — **KEEP; backs Billing hub Owner Ledger tab** | Kill now; keep RouteRedirect 1 release | None |
| 8 | `financial-assessments.tsx` | Redirect-only (`/app/financial/assessments` → `/app/financial/billing`) | `/api/financial/assessments` (GET/POST/PATCH), `/api/financial/assessments/run` (POST) — **KEEP; backs Billing hub Assessments tab** | Kill now; keep RouteRedirect 1 release | None |

---

### 7.2 Legacy Governance Files (4) — Full KILL

All content fully covered by governance hub tabs (A4 confirmed). All backing API routes retained.

| # | File | Current Route Status | API Routes Affected | Recommendation | Blockers |
|---|---|---|---|---|---|
| 9 | `governance-compliance.tsx` | Redirect-only (`/app/governance/compliance` → `/app/governance`) | `/api/governance/compliance-alerts` (GET/PATCH), `/api/governance/compliance-alert-overrides` (GET/POST), annual governance tasks CRUD — **KEEP all; back Governance hub Compliance tab** | Kill now; keep RouteRedirect 1 release | None |
| 10 | `meetings.tsx` | Redirect-only (`/app/governance/meetings` → `/app/governance`) | `GET/POST /api/governance/meetings`, `/api/governance/meetings/:id/agenda-items`, `/api/governance/meetings/:id/notes`, `/api/governance/meeting-notes/:id` — **KEEP all; back Governance hub Meetings tab** | Kill now; keep RouteRedirect 1 release | None |
| 11 | `board-packages.tsx` | Redirect-only (`/app/governance/board-packages` → `/app/governance`) | `GET/POST /api/admin/board-packages/templates`, `GET /api/admin/board-packages`, `POST /api/admin/board-packages/generate/:templateId`, `GET /api/admin/board-packages/distribution-history`, `POST /api/admin/board-packages/run-scheduled`, `POST /api/admin/board-packages/:id/distribute`, `PATCH /api/admin/board-packages/:id` — **KEEP all; back Governance hub Board Packages tab** | Kill now; keep RouteRedirect 1 release | None |
| 12 | `elections.tsx` | Redirect-only (`/app/governance/elections` → `/app/governance`) | `GET/POST /api/elections`, `/api/elections/compliance-summary`, `/api/elections/active-summary`, `/api/elections/analytics`, `GET/PATCH/DELETE /api/elections/:id`, `/api/elections/:id/tokens`, `/api/elections/:id/options`, `/api/elections/:id/nominations`, `/api/elections/:id/casts`, `/api/elections/:id/tally`, `/api/elections/:id/certify`, `/api/elections/:id/generate-tokens` — **KEEP all; back Governance hub Elections tab and `election-detail.tsx`** | Kill now; keep RouteRedirect 1 release | None |

---

### 7.3 Customer-Side Merge/Widgetize Kills (5)

| # | File | Current Route Status | API Routes Affected | Recommendation | Blockers |
|---|---|---|---|---|---|
| 13 | `announcements.tsx` | Live route at `/app/announcements`; sidebar child entry | No unique API routes beyond `communications.tsx` — `AnnouncementsContent` uses communications API endpoints already consumed by hub. **No API changes.** | Kill now; add RouteRedirect `/app/announcements` → `/app/communications`; keep redirect 1 release | Confirm Announcements tab is live in communications.tsx |
| 14 | `insurance.tsx` | Live route at `/app/insurance` | `/api/insurance/policies` (GET/POST/PATCH), renewal alerts endpoint — **KEEP all; back Documents hub Policies tab** | Kill standalone route after H1 hub patch; add RouteRedirect `/app/insurance` → `/app/documents`; keep redirect 1 release | H1 hub patch (#3 in migration list) must be done first |
| 15 | `maintenance-schedules.tsx` | Live route at `/app/maintenance-schedules`; sidebar child entry | `/api/maintenance/schedules` (GET/POST/PATCH), `/api/maintenance/schedules/:id/generate`, `/api/maintenance/instances/:id/convert-to-work-order`, `/api/assets` (GET/POST/PATCH/DELETE) — **KEEP all; back Work Orders hub Maintenance tab** | Kill standalone route; add RouteRedirect `/app/maintenance-schedules` → `/app/work-orders`; keep redirect 1 release | Maintenance tab already live in work-orders.tsx; RouteRedirect can be added immediately |
| 16 | `inspections.tsx` | Live route at `/app/inspections`; sidebar child entry | `/api/inspections` (GET/POST/PATCH), `/api/inspections/:id/findings/:findingIndex/convert-to-work-order` — **KEEP all; back Work Orders hub Inspections tab** | Kill standalone route after H2 hub patch; add RouteRedirect `/app/inspections` → `/app/work-orders`; keep redirect 1 release | H2 hub patch (#1 in migration list — Inspections tab must be added to work-orders.tsx first) |
| 17 | `new-association.tsx` | Live route at `/app/new-association`; sidebar footer button | `POST /api/associations` — **KEEP; shared with `associations.tsx` create dialog** | Phase 6 precondition: confirm `associations.tsx` dialog covers two-step wizard (step 2 location coverage); then KILL file and retire route + sidebar footer button | `associations.tsx` create dialog must be confirmed complete (see Phase 3 IC-5) |

---

### 7.4 TD-2-Pending Kill (1)

| # | File | Current Route Status | API Routes Affected | Recommendation | Blockers |
|---|---|---|---|---|---|
| — | `board-portal.tsx` | No URL route (conditional root render) | None unique — uses shared workspace APIs | If TD-2 resolves as Option B (deprecate): KILL file; remove conditional from `AuthAwareApp` root | TD-2 owner decision required |

---

## 8. Open Implementation Decisions for Owner

These are the spec §12 open questions, updated with audit findings. Each needs an owner answer before Phase 6 can proceed on the affected scope.

---

### Q1: Zone 3 gating mechanism

**Spec question:** How is Zone 3 gated post-audit? Sidebar role filter / separate subroute / subdomain / separate shell?

**Phase 4 recommendation:** **Option (b) — separate `/app/operator/*` or `/app/admin/*` subroute tree** with hardened per-route inline role checks as an immediate interim. Phase 4 explicitly did not recommend subdomain or separate shell (both require `server/auth.ts` changes, which are out of scope per spec §3).

**Current state:** Sidebar gate is `roles: ["platform-admin"]` on all Platform group items. Direct-URL access to `/app/admin`, `/app/admin/roadmap`, `/app/admin/users`, `/app/admin/executive` has NO inline role check in `App.tsx`. `/app/platform/controls` and `/app/ai/ingestion` (via WIP gate) are partially guarded.

**Owner sign-off needed on:**
1. Accept Phase 4 Option (b) recommendation?
2. Immediate action: add `adminRole === "platform-admin"` checks to `/app/admin`, `/app/admin/roadmap`, `/app/admin/users`, `/app/admin/executive` in App.tsx before Phase 6 executes any other changes?
3. Phase 6 path: consolidate under `/app/operator/*` URLs, or retain current `/app/admin/*` and `/app/platform/*` structure?

---

### Q2: Roadmap API role width — intentional or gap?

**Spec question:** (surfaced by Phase 4 §4 C2/C3 item 1)

All `/api/admin/roadmap`, `/api/admin/projects`, `/api/admin/workstreams`, `/api/admin/tasks` routes allow `board-admin` and `manager` roles (full CRUD). Phase 4 flagged this as either an intentional customer transparency feature or a server-side access control gap.

**Owner decision required:** Is `board-admin`/`manager` read + write access to the internal product roadmap intentional? If yes, document the intent. If no, these routes should be narrowed to `["platform-admin"]` in Phase 6.

---

### Q3: AI Ingestion API role width — platform-admin-only or broader?

**Phase 4 finding:** All `/api/ai/ingestion/*` write/mutation routes allow `board-admin` and `manager`. The WIP gate in App.tsx masks this at the UI level but provides no API protection (the most under-gated Zone 3 surface in the audit).

**Owner decision required:** Is AI Ingestion exclusively a `platform-admin` tool (Z3-1)? If yes, all write routes should be narrowed to `["platform-admin"]`. If `board-admin`/`manager` are intended to use ingestion to import their own association data, the page's Zone 3 classification should be revisited and the WIP gate removed.

---

### Q4: Owner Portal link placement

**Spec question (Q4):** The current sidebar has "Owner Portal" (`/portal`) nested as a child of Platform Controls in the Platform group (platform-admin only). `/portal` is the resident-facing owner portal — a different surface.

**Phase 4 recommendation:** Remove the "Owner Portal" entry from the Platform group entirely. It is a resident-facing surface linked inside an operator menu, which creates a misleading implication.

**Owner decision required:** Remove entirely, or relocate? Options:
- **Remove entirely.** Platform-admins can navigate to `/portal` directly.
- **Relocate to a clearly labeled "External Links" section** visible to all roles (not platform-admin only) — a non-workspace launcher for operators to preview what residents see.
- **Keep as-is.** (Not recommended — this was flagged as a symptom in spec §1 bullet 3.)

---

### Q5: Single-association board experience with new Zone 2 group

**Spec question (Q5):** `isSingleAssociationBoardExperience()` currently hides Portfolio and Associations for `board-admin` users with ≤1 association. After this restructure, "Associations" moves from Overview to the Setup & Reference (Zone 2) group.

**Owner decision required:** Should the single-association board experience collapse also hide the Zone 2 "Associations" entry? Options:
- **Hide it** (consistent with current behavior — single-assoc board-admin doesn't need to switch associations).
- **Show it as a read-only display** (board-admin can view their one association's setup but not create/switch).
- **Show it normally** (no change to the existing `isSingleAssociationBoardExperience` filter logic).

**Phase 6 implementation impact:** The `singleAssociationBoardExperience` filter in `app-sidebar.tsx:234` currently filters `overviewModules`. After the restructure, it must also be applied to the new Setup & Reference group for the Associations entry.

---

### Q6: `admin-users.tsx` — platform-admin IAM only, or also association board admin management?

**Spec question (Q6):** Does `/app/admin/users` manage only YCM's own operator-team users, or does it also manage association board admin users?

**Phase 4 finding:** The page manages all YCM admin user accounts and their roles (platform-admin, board-admin, manager, viewer). The API is correctly and exclusively gated to `platform-admin`. This is operator IAM tooling (Z3-2), not a customer account management surface.

**Owner decision required:** Confirm that `admin-users.tsx` is platform-admin-only (Z3-2) and that association board member management is handled through `persons.tsx` + board role assignment (the governance hub Members tab). If confirmed, the classification and placement in Zone 3 are correct and no further action is needed.

---

### Q7: URL contracts — external links to `/app/*`

**Spec question (Q7):** Are any `/app/*` URLs linked from external places (partner sites, email templates, docs)?

**Phase 6 impact:** The audit proposes the following URL changes:
- `/app/amenities` → `/app/amenity-admin` (RouteRedirect added per C7)
- `/app/board` → `/app/governance/members` (RouteRedirect added per C7)
- All 12 legacy redirect paths in App.tsx:270-292 — these redirects should be kept for at least 1 release cycle before removal

**Owner decision required:** Are any of the above URLs linked in email templates, external documentation, partner sites, or embedded in other systems? If yes, those specific URLs need permanent redirects (not just 1-release redirects) before Phase 6 can proceed. C7 (RouteRedirect) covers internal navigation; external contracts need explicit documentation before execution.

---

## 9. Risk Section

The following risks are explicitly enumerated. Each includes an interim recommendation where applicable.

---

### R1: Direct-URL bypass (Phase 4 finding — HIGH PRIORITY)

**Description:** Four Zone 3 routes have no inline role check in `App.tsx`:
- `/app/admin` (App.tsx:259) — renders `RoadmapPage` for any authenticated user
- `/app/admin/roadmap` (App.tsx:260) — same
- `/app/admin/users` (App.tsx:261) — renders `AdminUsersPage`; API will 403 but page shell renders
- `/app/admin/executive` (App.tsx:262) — renders `ExecutivePage`; API partially open (see Q3)

A `board-admin` or `manager` who knows these URLs can reach the page UI. The sidebar gate (`roles: ["platform-admin"]`) is bypassed by direct navigation.

**Interim recommendation (before Phase 6 begins):** Add `adminRole === "platform-admin" ? <PageComponent /> : <NotFound />` checks to each of the four routes in `App.tsx`, matching the pattern at line 297 for `platform-controls`. This is a 4-line fix with zero architectural cost. Phase 6 Session 1 should include this as the first commit.

**Phase 6 structural fix:** Consolidate all Zone 3 pages under a guarded subroute (see Q1).

---

### R2: Legacy redirect removal timing

**Description:** The 12 `<RouteRedirect>` entries in App.tsx:270-292 are the only resolution path for anyone who has bookmarked or externally linked a legacy URL. Removing them would silently break those bookmarks.

**Risk:** If Phase 6 removes RouteRedirects when killing legacy files, any user or system with a saved bookmark to a legacy financial or governance URL gets a 404 with no indication of where to go.

**Recommendation:** Keep all 12 legacy RouteRedirects in App.tsx for at least one full release cycle after the source files are deleted. The RouteRedirects can exist without their source files — they are cheap to keep. Plan for redirect removal in a subsequent cleanup PR, not in the Phase 6 execution sessions.

---

### R3: Hub patching required before kills

**Description:** Five kills in the migration plan (#14, #16, #17) have a hard dependency on hub content patches being completed first:
- `insurance.tsx` cannot be killed until the Policies tab is live in `documents.tsx` (H1)
- `inspections.tsx` cannot be killed until the Inspections tab is live in `work-orders.tsx` (H2)
- `new-association.tsx` cannot be killed until the create dialog in `associations.tsx` is confirmed to cover the two-step wizard (IC-5 precondition)

**Risk:** If a kill is executed before its hub patch, users navigating via the RouteRedirect land on a hub that doesn't show the content they expected.

**Recommendation:** Phase 6 session ordering (§10) ensures hub patches precede kills. Session 1 does hub patches; Session 2 does kills. No kill happens in the same PR as its hub patch unless the patch is also in that PR.

---

### R4: Tab state standardization

**Description:** The current codebase uses ad-hoc local state for tab selection across multiple hub pages. If Phase 6 standardizes on URL-param tabs (e.g. `/app/work-orders?tab=inspections`), that is a non-trivial refactor surface touching every tabbed hub page. If Phase 6 does NOT standardize, direct links to specific tabs (e.g. from the sidebar entry for "Board Members" at `/app/governance/members`) require additional routing logic.

**Risk:** The migration plan item #7 (board.tsx → `/app/governance/members`) implies a URL that resolves to the Members tab of the governance hub. Without URL-param tab support in `governance.tsx`, this URL would need either a special route (`<Route path="/app/governance/members">`) that renders `governance.tsx` with an active-tab prop, or the URL would resolve to the hub root with no tab pre-selection.

**Recommendation:** For Phase 6, use dedicated sub-routes for tab-targeted pages (e.g. `<Route path="/app/governance/members">` → renders `GovernancePage` with `initialTab="members"` prop). Do NOT attempt to standardize URL-param tabs across all hub pages in a single Phase 6 session — scope it as a follow-on refactor.

---

### R5: API orphaning risk

**Description:** Every KILL in §7 was verified by audit to have no unique API routes that would be orphaned. All backing APIs continue to be consumed by the live hub tabs that absorbed the legacy content. However, this verification was done by shallow read of the page files — a Phase 6 engineer should confirm no API route is called exclusively from the killed file before deleting it.

**Recommendation:** For each KILL in §7, before deletion: `grep` the file for all `fetch`/`useQuery`/`useMutation` calls and verify each endpoint is also called from the absorbing hub file. If any endpoint is unique to the killed file, escalate to owner before proceeding.

---

### R6: `board-portal.tsx` Zone 1 handback

**Description:** `board-portal.tsx` was passed through both Phase 2 (ORPHAN-SURFACE) and Phase 4 (returned as Zone 1, not Zone 3). Its taxonomy dispute is TD-2 (§2). The file contains stale sub-links to deprecated redirect paths (`/app/financial/budgets`, `/app/governance/board-packages`, `/app/governance/meetings`, `/app/financial/reconciliation`) that silently redirect but may confuse board-admin users.

**Risk:** If Phase 6 proceeds without resolving TD-2, the file stays in its current state — rendered conditionally at the root level, with stale links, no canonical URL, and no audit verdict. The stale links will continue to redirect silently but could break if the legacy RouteRedirects are removed (R2 risk).

**Recommendation:** TD-2 must be resolved before Phase 6 removes legacy RouteRedirects. If the owner chooses Option B (deprecate), the `board-portal.tsx` conditional at `AuthAwareApp` root level must be removed in the same session as the legacy redirect cleanup.

---

### R7: `server/routes.ts` inline auth gaps

**Description:** Phase 4 identified ~30+ inline `res.status(403)` checks in `server/routes.ts` that serve as the server-side auth layer. These checks are not audited systematically — Phase 4 only enumerated them for the 5 Zone 3 pages in scope. The AI Ingestion API (`/api/ai/ingestion/*`) is the most under-gated surface found, with all write/mutation routes open to `board-admin` and `manager`. Multiple `/api/platform/*` read endpoints are broadly open.

**Risk:** Moving pages (especially Zone 3 promotions) without auditing the corresponding server-side gates could create a situation where the UI is gated but the API is not — the existing pattern, now made explicit and documented as a known gap rather than an oversight.

**Recommendation:** Add a Phase 6 side-task (can be a separate PR in Session 4 or 5) to enumerate all inline 403 checks in `server/routes.ts` for the 5 Zone 3 pages and produce a gap list. Remediation of the AI Ingestion API gaps should be prioritized (Q3).

---

## 10. Phase 6 Dependency Ordering (Suggested Session Split)

Five sessions, each a self-contained PR with a clear scope. Dependencies flow forward — later sessions depend on earlier sessions completing.

---

### Session 1: Direct-URL bypass fix + legacy file cleanup

**Scope:** Highest-urgency items; no architectural changes.

**Actions:**
1. Add 4 inline `adminRole === "platform-admin"` role checks to App.tsx (R1 fix for `/app/admin`, `/app/admin/roadmap`, `/app/admin/users`, `/app/admin/executive`)
2. Delete 8 legacy financial `.tsx` files (`financial-budgets`, `financial-utilities`, `financial-recurring-charges`, `financial-reconciliation`, `financial-invoices`, `financial-late-fees`, `financial-ledger`, `financial-assessments`) — leave their RouteRedirects in App.tsx
3. Delete 4 legacy governance `.tsx` files (`governance-compliance`, `meetings`, `board-packages`, `elections`) — leave their RouteRedirects in App.tsx

**PR size:** Small; 12 file deletions + 4 line changes in App.tsx. No hub changes. Zero user-visible behavior change (redirects stay).

**Prerequisite:** Q1 owner sign-off (confirm option b / inline checks are accepted). Q2 and Q3 do not need to be resolved before this session.

---

### Session 2: Hub patches (content gaps closed before standalone routes are retired)

**Scope:** Patch the three hubs that need new tabs before their absorbed pages can be killed. This session creates the content gap closures.

**Actions:**
1. `work-orders.tsx` — add Inspections tab (move `InspectionsContent` from `vendors.tsx` to here)
2. `vendors.tsx` — remove embedded Inspections tab
3. `documents.tsx` — add Policies tab (import `InsuranceContent`); rename sidebar label to "Documents & Records"
4. `governance.tsx` — add Members tab; accessible at `/app/governance/members`
5. Confirm `associations.tsx` create dialog covers the two-step wizard (IC-5 check)

**PR size:** Medium; 3 hub files modified, 1 source file's content component re-hosted.

**Prerequisite:** Session 1 done. No prerequisite otherwise.

---

### Session 3: Renames, moves, and standalone route retirements

**Scope:** All URL changes, sidebar label changes, and retirement of standalone routes whose hubs are now patched.

**Actions:**
1. `amenities-admin.tsx` — update App.tsx route from `/app/amenities` → `/app/amenity-admin`; add RouteRedirect from old URL
2. `board.tsx` — add RouteRedirect `/app/board` → `/app/governance/members` in App.tsx
3. `portfolio.tsx` — rename sidebar label to "Portfolio Health"
4. `operations-dashboard.tsx` — rename sidebar label to "Operations Overview"; patch page header `<h1>`
5. `community-hub.tsx` — rename sidebar label to "Community Hub Config"; patch page header `<h1>`
6. `insurance.tsx` — retire standalone route; add RouteRedirect `/app/insurance` → `/app/documents`
7. `announcements.tsx` — add RouteRedirect `/app/announcements` → `/app/communications`; file deletion
8. `maintenance-schedules.tsx` — retire standalone route; add RouteRedirect `/app/maintenance-schedules` → `/app/work-orders`
9. `inspections.tsx` — retire standalone route; add RouteRedirect `/app/inspections` → `/app/work-orders`
10. `new-association.tsx` — retire route if IC-5 precondition confirmed; file deletion

**PR size:** Medium; multiple App.tsx route additions + sidebar label changes + file deletions.

**Prerequisite:** Session 2 done (hub patches complete).

---

### Session 4: Sidebar restructure (app-sidebar.tsx)

**Scope:** Full sidebar rewrite per §3 nav tree. This is isolated to `app-sidebar.tsx` only.

**Actions:**
1. Rename group labels (Overview stays; "Association" group — rename to "[Active Association]" dynamically; "Board" group → "Governance & Communications"; add new "Setup & Reference" group; "Platform" group — flatten children)
2. Remove 10 nav entries (see "Items Removed from Nav" in §3)
3. Add 4 new nav entries (Association Setup, Documents & Records relabeled, Admin Users, Executive Decks)
4. Promote AI Ingestion and Admin Roadmap from children to peer entries in Platform group
5. Remove "Owner Portal" from Platform group children
6. Update `singleAssociationBoardExperience` filter logic to cover Setup & Reference group (Q5 resolution)
7. Move "People" from child of Buildings & Units to peer-level entry

**PR size:** Medium-large; one file (`app-sidebar.tsx`) with significant structural change.

**Prerequisite:** Sessions 2 and 3 done; Q5 owner decision resolved.

---

### Session 5: Zone 3 consolidation and final cleanup

**Scope:** Phase 4 gating hardening and optional URL consolidation under `/app/operator/*`.

**Actions (required):**
1. Replace `canAccessWipRoute` WIP gate on `ai-ingestion.tsx` with `adminRole === "platform-admin"` inline check in App.tsx (also done in Session 1 for the other 3, but ai-ingestion was WIP-gated differently)
2. Address TD-2 resolution: if board-portal deprecate, remove conditional from `AuthAwareApp`; if promote, add route
3. Address TD-3 resolution: if workspace-preview gets public URL, add to `PublicRouter`

**Actions (optional, per Q1 structural decision):**
4. Consolidate Zone 3 routes under `/app/operator/*` (rename routes + add RouteRedirects from old `/app/admin/*` paths)

**Actions (side-task):**
5. Enumerate and document all inline 403 checks in `server/routes.ts` for Zone 3 pages; produce gap list; prioritize AI Ingestion gaps (R7)

**PR size:** Small to medium; dependent on TD-2 and TD-3 decisions.

**Prerequisite:** Session 4 done; TD-2, TD-3 resolved; Q1 structural decision made.

---

## 11. Goal Alignment (Spec §2 Goals → Verdicts)

| Goal | Statement | Status | Verdicts that satisfy it |
|---|---|---|---|
| **G1** | Every `/app/*` page has exactly one primary persona, one taxonomy category, and one zone assignment by end of Phase 1. | SATISFIED | All 41 Phase 1 pages scored. 7 Phase 2 pages scored (5 with full verdicts; TD-2 and TD-3 pending owner). |
| **G2** | Every page has exactly one verdict from the §9 vocabulary, with target and rationale for every non-KEEP. | SATISFIED | All 48 in-scope pages have verdicts. TD-2 (board-portal) and TD-3 (workspace-preview) verdicts are pending owner decision — not an audit gap, but an explicit hold. |
| **G3** | Zero orphan `.tsx` files after Phase 6. | CONDITIONAL | The 17 kills in §7 cover all confirmed orphan files. `board-portal.tsx` and `workspace-preview.tsx` are not killed pending TD-2/TD-3. If both are resolved as kills/out-of-scope, zero orphans. FLAG: owner must resolve TD-2 and TD-3 to close this goal completely. |
| **G4** | Phase 5 proposal produces a nav tree that makes semantic sense through each primary persona's lens. | SATISFIED | Nav tree in §3 is structured by user intent zones, not feature groupings. `manager` lens: clear Zone 1 → Zone 2 → Zone 3 gradient. `board-admin` lens: Governance group is primary entry (not Board roster). `viewer` lens: read-only pages are correctly in the nav (Finance, Governance, Operations); no write-only admin pages are exposed. `platform-admin` lens: Zone 3 is a distinct Platform group. |
| **G5** | Zone 3 (platform operator) cleanly separable. | PARTIALLY SATISFIED | Zone 3 is correctly grouped in the Platform section with all 5 pages. Direct-URL bypass gaps exist (R1). Phase 4 recommended Option (b) consolidation under `/app/operator/*`, but Q1 awaits owner sign-off. The Zone 3 group IS separable as a tree after Session 1 (role checks added); the structural consolidation is Session 5. FLAG: Q1 owner sign-off needed. |
| **G6** | All legacy financial + governance redirect targets either retired (KILL) or re-promoted (ORPHAN-SURFACE). | SATISFIED | All 8 legacy financial files and 4 legacy governance files have KILL verdicts with confirmed content coverage. No file is staying on disk purely because its route redirects somewhere else — Phase 6 Session 1 kills them all. |
| **G7** | DEMOTE-ADMIN candidates cross-referenced against `server/routes.ts` inline role checks. | SATISFIED | Phase 4 §5 completed the server-side gating audit for all 5 Zone 3 pages. Gaps flagged: AI Ingestion (most critical), roadmap API role width, executive API role width, platform config read endpoints. All are documented in §8 open questions (Q2, Q3) and §9 risk section (R7). |

---

## 12. Gate — Phase 6 Cannot Begin Without Explicit Acceptance

The following items require explicit owner resolution before Phase 6 can be dispatched:

**TAXONOMY DISPUTES (block specific page sets):**
- [ ] **TD-1** (§2): `operations-dashboard.tsx` — Z1-6 or Z1-1? _(Default: Z1-6 used in §3 nav tree)_
- [ ] **TD-2** (§2): `board-portal.tsx` — promote to Zone 1 or deprecate (KILL)? _(Phase 6 scope changes depending on decision)_
- [ ] **TD-3** (§2): `workspace-preview.tsx` — in-scope Z3-3 → public URL, or defer to follow-on audit?

**IMPLEMENTATION DECISIONS (block Phase 6 dispatch or specific sessions):**
- [ ] **Q1** (§8): Accept Phase 4 Option (b) Zone 3 gating recommendation? Add 4 inline role checks before other work?
- [ ] **Q2** (§8): Roadmap API role width — intentional customer transparency or gap to close?
- [ ] **Q3** (§8): AI Ingestion API role width — platform-admin-only or intentionally broader?
- [ ] **Q4** (§8): Owner Portal link — remove from Platform group? Or relocate?
- [ ] **Q5** (§8): Single-association board experience — hide Zone 2 Associations entry?
- [ ] **Q6** (§8): Confirm `admin-users.tsx` is platform-admin IAM only (Z3-2). (Confirm-only, no decision required if correct.)
- [ ] **Q7** (§8): URL contracts — are any proposed renamed URLs linked externally?

**PROPOSAL ACCEPTANCE:**
- [ ] Owner accepts the complete proposed nav tree in §3
- [ ] Owner accepts the migration plan ordering in §4
- [ ] Owner accepts the kill list in §7
- [ ] Owner accepts the Phase 6 session split in §10

---

**OWNER REVIEW REQUIRED — Phase 6 dispatch blocked until explicit accept.**
