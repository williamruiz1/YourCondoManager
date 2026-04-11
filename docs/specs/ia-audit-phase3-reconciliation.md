# Phase 3 Reconciliation — Customer Side (Zone 1 + Zone 2)

**Coordinator:** Phase 3
**Date:** 2026-04-11
**Input:** 8 Phase 1 scorecards (A1–A8) + Phase 2 orphan sweep
**Scope:** Zone 1 + Zone 2 only; Zone 3 deferred to Phase 4

---

## 1. Executive Summary

- **Three-command-center problem resolved.** `dashboard.tsx` stays as the primary Z1-1 cross-association entry point (the landing page). `portfolio.tsx` is promoted to a peer Z1-1 entry with a clearer analytical framing ("Portfolio Health"). `operations-dashboard.tsx` is re-classified Z1-6 (not Z1-1) and re-labeled as the Operations section hub — the "three command centers" collapse to one primary + one analytical peer + one section hub. PATCH labels to eliminate name collision.
- **Board section restructured.** The "Board" sidebar group header (currently pointing to `board.tsx`) is renamed to "Governance & Communications." The governance hub (`governance.tsx`) becomes the primary group entry. `board.tsx` moves inside the governance hub as a "Members" tab (RENAME-MOVE to `/app/governance/members`). The `announcements.tsx` standalone route is killed because `AnnouncementsContent` is already a tab inside `communications.tsx`.
- **Eight legacy financial files and four legacy governance files are clean kills.** A3 and A4 confirmed full content coverage in the live hub tabs. All 12 get KILL verdicts. All backing API routes are retained.
- **Documents and Insurance form a new Zone 2 reference group.** `insurance.tsx` merges as a "Policies" tab under `documents.tsx`. The top-level Insurance sidebar entry is removed. The new group is a single "Documents & Records" entry in the nav.
- **Fourteen files net removed from the customer nav (kills + merges + demotions).** The proposed Zone 1+2 nav tree reduces from ~29 items to ~17 primary nav items, with all-tab hubs absorbing the rest.

---

## 2. Cross-Section Conflicts Resolved

### 2.1 Dashboard vs. Portfolio dual command center (A1) vs. Operations Dashboard Z1-1 claim (A6)

**What they said:**
- A1: `dashboard.tsx` and `portfolio.tsx` both claim Z1-1, creating a "dual command center." A1 proposed either merging Portfolio into Dashboard or making Portfolio the primary landing page. A1 explicitly deferred the `operations-dashboard.tsx` question to A6.
- A6: Tagged `operations-dashboard.tsx` as Z1-1 but acknowledged it is section-scoped, not cross-association. A6 offered three options: (1) re-classify as Z1-6 section hub, (2) WIDGETIZE into `dashboard.tsx`, (3) promote to Z1-1 (least preferred). A6 asked A1 to report whether `dashboard.tsx` already surfaces operations metrics.
- A1 reported that `dashboard.tsx` is action-oriented (alerts, quick actions, elections) while `portfolio.tsx` is analytical/comparative (KPI table per association, risk thresholds). A1 found that Dashboard's stat cards (total associations, units, owners) overlap with Portfolio — but the behavioral difference (today's action list vs. health comparison) is meaningful enough to keep both.

**Reconciliation:**
Accept A6 option 1. `operations-dashboard.tsx` is re-classified as **Z1-6** (not Z1-1). Its scope is strictly the operations section — work-order queue, maintenance-due instances, vendor risk, inspection follow-up. This is not a cross-association command center; it is a section status hub. The naming collision ("Dashboard" appears in both the main entry and this page's URL) is resolved by renaming `operations-dashboard.tsx` to "Operations Overview" in the sidebar label and page header.

For the `dashboard.tsx` vs. `portfolio.tsx` tension: the two pages serve distinct intents and both are retained at the top level as Z1-1 peers. `dashboard.tsx` remains the landing page (`/app`) because it is action-oriented. `portfolio.tsx` is re-labeled "Portfolio Health" to clearly differentiate the analytical framing. A1's RENAME-MOVE verdict for `portfolio.tsx` is accepted; the nav placement moves from being a subordinate peer of Dashboard to an explicitly labeled analytical sibling.

**Net verdict: three Z1-1 candidates collapse to two (Dashboard + Portfolio Health). `operations-dashboard.tsx` becomes Z1-6 and stays as the Operations section parent entry, renamed "Operations Overview."**

---

### 2.2 board.tsx as section header vs. governance.tsx as the real hub (A4) vs. persons.tsx as cross-cutting people directory (A2)

**What they said:**
- A4: `board.tsx` is a people-management page (board member roster, roles, terms) currently overloaded as the sidebar group label for the entire Board/Governance/Comms section. A4 proposed moving `board.tsx` to a "Members" tab inside the governance hub (`/app/governance`). A4's RENAME-MOVE verdict targets `/app/governance/members`.
- A2: `persons.tsx` is the cross-cutting people directory (owners, tenants, board members across associations). A2 found that board-role assignment is embedded in `persons.tsx`. A2 noted this is a Governance concern (Z1-4) surfaced inside a Z1-2 page and flagged it for Phase 3 reconciliation.

**Potential duplicate people surface concern:** Does moving `board.tsx` to a Members tab inside governance create two board-member management surfaces — one at `/app/governance/members` and one embedded in `/app/persons`?

**Analysis:** The two surfaces are complementary, not duplicate:
- `persons.tsx` is the system-wide people registry (all roles: owner, tenant, board member across associations). It includes board-role assignment as an inline action on a person record.
- `board.tsx` is the board composition management surface for the active association — setting terms, tracking expiry, viewing the board roster as a standalone task.

They answer different questions: "Who are all the people in the system?" (`persons.tsx`) vs. "Who is on this association's board and when do their terms expire?" (`board.tsx`). They are not duplicates.

**Reconciliation:** Accept A4's verdict. `board.tsx` moves to `/app/governance/members` as a tab (or sub-page under governance hub). `persons.tsx` stays at its current position in Z1-2, promoted to a peer-level nav entry alongside Buildings & Units per A2's RENAME-MOVE. Board-role assignment in `persons.tsx` remains as an inline action (not a separate page) — cross-ref noted for Phase 5 but no structural change required.

**Net verdict: no duplicate surface problem. Accept both A4 RENAME-MOVE and A2 RENAME-MOVE independently.**

---

### 2.3 Announcements — duplicate sidebar entry (A4)

**What A4 said:** `AnnouncementsContent` is already imported and rendered as the "Announcements" tab inside `CommunicationsPage` (A4 confirmed at `communications.tsx` line 36, 2277–2284). The standalone `/app/announcements` sidebar entry is a duplicate access point. A4 verdict: MERGE-AS-TAB, target `/app/communications`.

**Conflict check:** No conflicting auditor finding. No other auditor re-evaluated `announcements.tsx`.

**Reconciliation:** Accept A4's verdict. The `/app/announcements` sidebar entry is removed. The `announcements.tsx` file gets a KILL verdict (it functions as an imported content component; the standalone `AnnouncementsPage` default export is dead code exactly as found with the legacy financial/governance files). The Announcements tab inside Communications is the sole canonical access point.

**Net verdict: KILL `announcements.tsx` as standalone route. Remove sidebar entry. Announcements tab in Communications is canonical.**

---

### 2.4 maintenance-schedules.tsx — tab inside work-orders vs. standalone peer (A6)

**What A6 said:** `MaintenanceSchedulesContent` is already embedded as a tab in `work-orders.tsx` (line 1016–1017). A6 gave `maintenance-schedules.tsx` a MERGE-AS-TAB verdict (target: `work-orders.tsx`) and simultaneously gave `work-orders.tsx` a PATCH verdict to remove the embedded tab (contradictory pair).

**Internal inconsistency flagged (see §10):** A6's two verdicts are logically contradictory — MERGE-AS-TAB for `maintenance-schedules` targeting `work-orders.tsx` AND PATCH for `work-orders.tsx` to remove the embedded maintenance tab. Only one can be correct. This is flagged in §10 below.

**Reconciliation decision:** The content is already embedded in `work-orders.tsx`. The path of least disruption is to accept MERGE-AS-TAB for `maintenance-schedules.tsx` (the standalone route is the thing being removed) and drop the PATCH for `work-orders.tsx` that would remove the tab. The tab stays in work-orders; the standalone `/app/maintenance-schedules` sidebar entry and route are retired. This is consistent with the established pattern (financial and governance content files absorbed into hub tabs).

**Net verdict: MERGE-AS-TAB `maintenance-schedules.tsx` → `work-orders.tsx` Maintenance tab. Standalone route retired. Work-orders PATCH for tab-removal is dropped.**

---

### 2.5 inspections.tsx — tab inside vendors vs. tab inside work-orders (A6)

**What A6 said:** `InspectionsContent` is already embedded as a tab in `vendors.tsx` (line 1008). A6 gave `inspections.tsx` a MERGE-AS-TAB verdict with target `vendors.tsx`, then immediately argued the current placement is a category mismatch ("inspections are not vendor management") and recommended moving the Inspections tab to `work-orders.tsx` instead. A6 also gave `vendors.tsx` a PATCH verdict to remove the embedded Inspections tab.

**Internal inconsistency flagged (see §10):** Same pattern as 2.4 — the MERGE-AS-TAB target (`vendors.tsx`) conflicts with A6's own recommendation that the tab should move to `work-orders.tsx`. A6 could not cleanly pick a target.

**Reconciliation decision:** A6's thematic analysis is correct — inspections produce findings that become work orders, not vendor records. The currently embedded tab in `vendors.tsx` is a placement defect that was already partially implemented. The coordinator accepts the re-homing: `inspections.tsx` MERGE-AS-TAB → target `work-orders.tsx` (as a third tab: Work Orders / Maintenance / Inspections). The Inspections tab is removed from `vendors.tsx` (PATCH for `vendors.tsx` accepted). The standalone `/app/inspections` sidebar entry and route are retired.

**Net verdict: MERGE-AS-TAB `inspections.tsx` → `work-orders.tsx` Inspections tab. Inspections tab removed from `vendors.tsx`. `vendors.tsx` PATCH accepted (remove Inspections tab only).**

---

### 2.6 insurance.tsx — Z2-2 Document Vault vs. Z1-3 Financial vs. Z1-6 Service (A5)

**What A5 said:** A5 ran a three-way analysis (Z2-2 vs Z1-3 vs Z1-6) and concluded Z2-2. Verdict: MERGE-AS-TAB → `/app/documents` as a "Policies" tab. A5's reasoning was thorough: no claims workflow rules out Z1-6; no payment processing rules out Z1-3; the page is structured reference metadata that matches Zone 2's task-driven, onboarding-and-renewal traffic pattern.

**Conflict check:** No other auditor contested this. Spec §6 listed it as ambiguous; A5 resolved it.

**Reconciliation:** Accept A5's verdict without qualification. Insurance is Z2-2. The top-level Insurance sidebar entry is removed once the tab is live. The `documents.tsx` page becomes a two-tab hub: "Documents" + "Policies" (or "Insurance"). Documents is renamed to "Documents & Records" in the sidebar.

**Net verdict: MERGE-AS-TAB `insurance.tsx` → `/app/documents` Policies tab. Top-level Insurance sidebar entry removed.**

---

### 2.7 association-context.tsx — hidden setup hub, where does it land? (A1)

**What A1 said:** `association-context.tsx` is not in the sidebar. It is only reachable via a Dashboard header shortcut or post-creation redirect. It serves as a per-association setup/context page (onboarding progress, profile edit, invite management, activity feed). A1 verdict: RENAME-MOVE to "Association Workspace" or "Setup & Context," surface as a tab of `associations.tsx` or a sidebar sub-item under the active association header.

**Analysis:** The page is already accessible through the association context link in the sidebar header (the clickable association name chip shown when an association is active, at `app-sidebar.tsx:271`). The sidebar header link at lines 270–278 already points to `/app/association-context`. This is a non-obvious entry point that A1 correctly flagged. Two nav placement options exist: (a) make it a named sidebar entry in Zone 2 under an "Association Setup" group, or (b) keep it as a sidebar-header shortcut but make the shortcut more discoverable.

**Reconciliation:** Accept A1's direction. `association-context.tsx` is surfaced as a named entry in the Zone 2 nav group (alongside `associations.tsx`), labeled "Association Setup" or "Association Profile." The sidebar header shortcut can remain as a secondary entry point. The `new-association.tsx` wizard is also in Zone 2; see §2.8.

**Net verdict: RENAME-MOVE `association-context.tsx` → `/app/association-context` (URL unchanged), sidebar label "Association Setup." Surface in Zone 2 "Setup" group.**

---

### 2.8 new-association.tsx — two parallel create paths (A1)

**What A1 said:** `new-association.tsx` is a standalone wizard page, but `associations.tsx` already has an inline create dialog using the same API mutation. A1 verdict: WIDGETIZE — absorb into `associations.tsx` as a dialog/sheet or into the `association-context.tsx` post-create flow.

**Conflict check:** No other auditor covered `new-association.tsx`. The sidebar footer link is `platform-admin` only. The route is ungated in `App.tsx` (C3 known-gap per A1).

**Reconciliation:** Accept A1's WIDGETIZE verdict. The standalone `/app/new-association` route is retired once the create dialog in `associations.tsx` is confirmed as canonical. The "New Association" footer button in the sidebar already triggers this page; in Phase 6 it should be re-wired to open the dialog in `associations.tsx` inline. The `new-association.tsx` file is a KILL candidate pending Phase 6 confirmation that the dialog fully covers the two-step wizard.

**Net verdict: WIDGETIZE `new-association.tsx` → `associations.tsx` create dialog. File is KILL candidate in Phase 6 once dialog confirmed complete.**

---

## 3. Taxonomy Disputes Requiring Owner Input

### TD-1: operations-dashboard.tsx — Z1-1 Command Center vs. Z1-6 Service & Maintenance

**Competing positions:**
- **A6** tagged it Z1-1 (Command Center) because it is a genuine at-a-glance dashboard with stat cards, aging breakdowns, recommended actions, and a recent-records feed.
- **Coordinator resolution (§2.1)** re-classified it Z1-6 (Service & Maintenance) because its scope is strictly section-scoped operational data, not cross-association state.

**Why this goes to the owner:** The taxonomy rule (spec §6) states that Z1-1 is "at-a-glance cross-association or cross-portfolio state." `operations-dashboard.tsx` fetches a single-association aggregate (`GET /api/operations/dashboard` filtered to the active association). It does not show cross-association state. The coordinator's re-classification to Z1-6 follows the literal taxonomy definition.

However: the spec itself listed `operations-dashboard.tsx` as a Z1-1 candidate in the category definition. If the owner intends "section dashboard" to be a valid Z1-1 sub-type (a section-scoped command center rather than only cross-association), then the Z1-1 tag for `operations-dashboard.tsx` is correct and the coordinator's re-classification is wrong.

**Owner decision required:** Does Z1-1 (Command Center) include section-scoped dashboards, or is it strictly cross-association/portfolio-level views? If the former, `operations-dashboard.tsx` stays Z1-1 with a PATCH verdict; if the latter, Z1-6 with re-labeling. The coordinator has proceeded with Z1-6 in the proposed nav tree below, but this must be confirmed.

---

### TD-2: board-portal.tsx — Z1-1 Command Center (Phase 2) vs. out-of-scope / wrong-zone

**Competing positions:**
- **Phase 2** tagged `board-portal.tsx` as Z1-1 (Command Center), zone-1, with an ORPHAN-SURFACE verdict. Rationale: it is a full board-facing portal shell with section navigation that serves the `board-admin` persona.
- **The file is not routed under `/app/*` at all** — it is rendered at the `AuthAwareApp` root level conditionally for `isBoardAdmin && hasWorkspaceAccess`. Spec constraint C9 restricts the audit to `/app/*` only.

**Why this goes to the owner:** This is an architectural question, not a taxonomy question. Does the owner want `board-portal.tsx` to become a first-class `/app/board-portal` route (making it a proper Zone 1 surface), or does the board-admin persona use the standard workspace shell (`board-admin` already has access to all association workspace pages)? Phase 2 could not resolve this because it requires a product decision about whether a dedicated board-admin portal experience is desirable.

**Owner decision required:** Should `board-portal.tsx` be promoted to a canonical `/app/board-portal` route and added to the Zone 1 nav as a board-admin entry point? Or should it be deprecated, with `board-admin` users relying on the main workspace? This directly affects how the Phase 4 Zone-3 auditor should handle it (Phase 2 handed it to Phase 4, but it may be Zone 1 architecture, not Zone 3).

**Note for Phase 4:** Phase 2 placed `board-portal.tsx` in the Phase 4 handover list as ORPHAN-SURFACE. Phase 4 should revisit this classification once the owner resolves TD-2. If the owner directs it to Zone 1, it comes back to Phase 5 as a Zone 1 architectural decision, not a Zone 3 page.

---

### TD-3: workspace-preview.tsx — Z3-3 Platform Diagnostics (Phase 2) vs. public marketing surface

**Competing positions:**
- **Phase 2** tagged `workspace-preview.tsx` as Z3-3 (Platform Diagnostics), reasoning it is a pre-auth marketing surface. The ORPHAN-SURFACE verdict targets the public surface (`PublicRouter`) rather than the Platform group.
- **Strict taxonomy reading:** Z3-3 is "Debug / preview / internal-only surfaces." A marketing-facing preview page shown to unauthenticated visitors is not internal-only. It has no platform-admin gate. Its primary persona is arguably `manager` (the prospect) or unauthenticated visitor, neither of which maps to `platform-admin`.

**Analysis:** Phase 2's Z3-3 tag is the closest available fit given the 13-category taxonomy, but it is a stretch. The page does not fit any Zone 1 or Zone 2 category (it is pre-auth and non-operational). Z3-3 captures it by proximity, not by true intent.

**Why this goes to the owner:** This is a taxonomy fit issue (spec §6 hard rule: "Phase 1 auditors who find pages that don't fit these 13 categories must flag the page"). The coordinator cannot silently accept Z3-3 when the page's true nature is a public marketing preview, not platform diagnostics. The tag is the best available but the owner should confirm whether to stretch Z3-3 to include public-facing previews, or whether `workspace-preview.tsx` belongs entirely outside the audit scope (C9: scope is `/app/*` only — and this page is technically rendered at `/app/*` paths for unauthenticated users, which is what brought it into scope).

**Owner decision required:** Should `workspace-preview.tsx` be treated as (a) Z3-3 for audit purposes with a Phase 5 action to move it to `PublicRouter`, (b) an out-of-scope public marketing page handled in a follow-on audit, or (c) something else?

---

## 4. Proposed Zone 1 Nav Tree

**Format:** `Group > Item (URL) [source file] — verdict disposition`

Sub-items with tabs are listed under each item. All items listed below represent the proposed post-Phase 6 state, not current state.

> Zone 3 items are excluded. All Platform group items are handed to Phase 4.

---

### Group: Overview

*Always visible, association-context-independent. Reduced from 3 items to 2 (Associations moves to Zone 2).*

| Label | URL | Source file | Verdict | Notes |
|---|---|---|---|---|
| **Dashboard** | `/app` | `dashboard.tsx` | PATCH | Label may be changed to "Home" per A1; remains primary Z1-1 landing |
| **Portfolio Health** | `/app/portfolio` | `portfolio.tsx` | RENAME-MOVE | Old label "Portfolio"; new label "Portfolio Health"; URL unchanged; Z1-1 analytical peer |

---

### Group: [Active Association Name] — Zone 1 sections

*Shown when an association is active. Scope: all day-to-day operation surfaces for the selected association.*

#### Z1-2 Residents & Units

| Label | URL | Source file | Verdict | Notes |
|---|---|---|---|---|
| **Buildings & Units** | `/app/units` | `units.tsx` | KEEP | Primary entry; no change |
| **People** | `/app/persons` | `persons.tsx` | RENAME-MOVE | Promoted from child of Buildings & Units to peer-level nav item; label unchanged ("People"); URL unchanged |

*Both items appear at the same indentation level in the sidebar (peers, not parent/child).*

---

#### Z1-3 Financial Operations

| Label | URL | Source file | Verdict | Notes |
|---|---|---|---|---|
| **Finance** | `/app/financial/foundation` | `financial-foundation.tsx` | KEEP | Hub parent entry; label unchanged |
| &nbsp;&nbsp;↳ Billing | `/app/financial/billing` | `financial-billing.tsx` | KEEP | Child item; tabs: Owner Ledger / Assessments / Late Fees |
| &nbsp;&nbsp;↳ Payments | `/app/financial/payments` | `financial-payments.tsx` | KEEP | Child item; tabs: Payment Methods / Gateway / Owner Links / Webhooks / Activity / Exceptions |
| &nbsp;&nbsp;↳ Expenses | `/app/financial/expenses` | `financial-expenses.tsx` | KEEP | Child item; tabs: Invoices / Utilities / Budgets |
| &nbsp;&nbsp;↳ Reports | `/app/financial/reports` | `financial-reports.tsx` | KEEP | Child item; tabs: P&L / Collections / AR Aging / Reserve / Board Summary / Reconciliation |

*8 legacy financial files (budgets, utilities, recurring-charges, reconciliation, invoices, late-fees, ledger, assessments) are KILL — not represented in nav.*

---

#### Z1-4 Governance & Decisions

*Group renamed from "Board" to "Governance & Communications." Primary group entry changed from `board.tsx` to `governance.tsx`.*

| Label | URL | Source file | Verdict | Notes |
|---|---|---|---|---|
| **Governance** | `/app/governance` | `governance.tsx` | KEEP | New group parent entry (replaces "Board" as group label link); tabs: Meetings / Board Packages / Elections / Compliance |
| &nbsp;&nbsp;↳ Board Members | `/app/governance/members` | `board.tsx` | RENAME-MOVE | Old URL `/app/board`; new URL `/app/governance/members`; old label "Board" (group parent); new label "Board Members" (child of Governance group); content: board roster, roles, terms |

*`election-detail.tsx` at `/app/governance/elections/:id` is a deep-detail sub-route of the Elections tab and is retained as a live route (not a sidebar item).*

*4 legacy governance files (governance-compliance, meetings, board-packages, elections) are KILL — not represented in nav.*

---

#### Z1-5 Communications

*Sub-group under Governance & Communications group, or sibling item.*

| Label | URL | Source file | Verdict | Notes |
|---|---|---|---|---|
| **Communications** | `/app/communications` | `communications.tsx` | KEEP | Tabs: Delivery Workspace / Announcements / Onboarding / Operations |

*`announcements.tsx` KILL — Announcements is already a tab inside Communications.*

---

#### Z1-6 Service & Maintenance

| Label | URL | Source file | Verdict | Notes |
|---|---|---|---|---|
| **Operations** | `/app/operations/dashboard` | `operations-dashboard.tsx` | PATCH + RENAME | Sidebar label: "Operations Overview" (was "Operations"); page header: "Operations Overview" (was "Operations Dashboard"); category re-classified Z1-6; remains group parent entry |
| &nbsp;&nbsp;↳ Work Orders | `/app/work-orders` | `work-orders.tsx` | PATCH | Tabs: Work Orders / Maintenance / Inspections; Maintenance tab retained (not removed); Inspections tab added (moved from vendors.tsx) |
| &nbsp;&nbsp;↳ Vendors | `/app/vendors` | `vendors.tsx` | PATCH | Remove Inspections tab; tabs: Vendors / (other existing tabs); Vendors label and URL unchanged |
| &nbsp;&nbsp;↳ Feedback | `/app/resident-feedback` | `resident-feedback.tsx` | KEEP | Sidebar label "Feedback"; URL unchanged |

*`maintenance-schedules.tsx` MERGE-AS-TAB → Work Orders (Maintenance tab) — not in sidebar.*
*`inspections.tsx` MERGE-AS-TAB → Work Orders (Inspections tab) — not in sidebar.*

---

#### Z1-7 Community & Amenities

| Label | URL | Source file | Verdict | Notes |
|---|---|---|---|---|
| **Amenity Admin** | `/app/amenity-admin` | `amenities-admin.tsx` | RENAME-MOVE | Old label "Amenity Booking"; old URL `/app/amenities`; new label "Amenity Admin"; new URL `/app/amenity-admin`; RouteRedirect from old URL required (C7) |
| **Community Hub Config** | `/app/community-hub` | `community-hub.tsx` | PATCH | Old label "Community Hub"; new label "Community Hub Config" (or "Hub Settings"); URL unchanged; clarifies operator-config vs. public microsite |

---

### Zone 1 nav item count (proposed)

| Group | Items (primary) | Sub-items |
|---|---|---|
| Overview | 2 | 0 |
| Residents & Units | 2 | 0 |
| Financial Operations | 1 + 4 sub | — |
| Governance & Decisions | 1 + 1 sub | — |
| Communications | 1 | — |
| Service & Maintenance | 1 + 3 sub | — |
| Community & Amenities | 2 | 0 |
| **Total primary items** | **~15** | |

---

## 5. Proposed Zone 2 Nav Tree

Zone 2 surfaces are "Setup, reference, and account settings." They appear in a lower sidebar section (below the association workspace group) or in a collapsible "Settings" drawer. Current nav does not visibly separate Zone 2 — the proposed nav creates an explicit Zone 2 group.

---

### Group: Setup & Reference (Zone 2)

| Label | URL | Source file | Verdict | Notes |
|---|---|---|---|---|
| **Associations** | `/app/associations` | `associations.tsx` | RENAME-MOVE | Moved from "Overview" group to this Zone 2 group; label unchanged; URL unchanged; Z2-1 Association Setup |
| **Association Setup** | `/app/association-context` | `association-context.tsx` | RENAME-MOVE | Old: unreachable from sidebar (header shortcut only); new: named sidebar entry in Zone 2 group; old label: (none — unlabeled header link); new label: "Association Setup"; URL unchanged; Z2-1 Association Setup |
| **Documents & Records** | `/app/documents` | `documents.tsx` | RENAME-MOVE | Old label "Documents"; new label "Documents & Records"; URL unchanged; tabs: Documents / Policies (Insurance merged in); Z2-2 Document Vault |

*`insurance.tsx` MERGE-AS-TAB → `/app/documents` as "Policies" tab — not a sidebar item.*
*`new-association.tsx` WIDGETIZE → `associations.tsx` create dialog — not a sidebar item; file KILL candidate.*

---

### Footer (Zone 2 — personal)

| Label | URL | Source file | Verdict | Notes |
|---|---|---|---|---|
| **Settings** | `/app/settings` | `user-settings.tsx` | PATCH | Footer entry; PATCH to extend profile section (avatar, phone, password note); label and URL unchanged; Z2-3 Account & Help |
| **Help Center** | `/app/help-center` | `help-center.tsx` | PATCH | Footer entry; PATCH to add live support entry points and content gaps; label and URL unchanged; Z2-3 Account & Help |

---

### Zone 2 nav item count (proposed)

| Group | Items |
|---|---|
| Setup & Reference group | 3 |
| Footer (personal) | 2 |
| **Total Zone 2 items** | **5** |

---

## 6. New Hubs Required

### H1: Documents & Records hub (enhanced `documents.tsx`)

**Type:** Existing page gaining a new tab (not a net-new file).
**URL:** `/app/documents` (unchanged)
**Current state:** Single-tab documents list with type filters and portal publish toggle.
**After merge:** Two tabs — "Documents" (existing content) + "Policies" (insurance content from `insurance.tsx`).
**Absorbed pages:** `insurance.tsx` → "Policies" tab.
**Purpose:** Single Zone 2 reference surface for all document-class records (files + policy metadata).
**Phase 5 note:** Both the document list and the Policies tab should surface the "Insurance" document type filter together — currently, insurance PDFs can be stored in documents with type `"Insurance"` while structured policy metadata lives in `insurance.tsx`. After merge, both panes appear in one hub, resolving the two-entry-point ambiguity noted by A5.

---

### H2: Work Orders hub (enhanced `work-orders.tsx`)

**Type:** Existing page gaining two additional tabs.
**URL:** `/app/work-orders` (unchanged)
**Current state:** Two tabs — Work Orders + Maintenance (already embedded).
**After merge:** Three tabs — Work Orders / Maintenance / Inspections.
**Absorbed pages:** `maintenance-schedules.tsx` (already embedded as tab, standalone route retired) + `inspections.tsx` (tab moved from `vendors.tsx`).
**Purpose:** Unified operational maintenance hub covering reactive work orders, preventive maintenance schedules, and inspection records — all three feeding the work-order lifecycle.
**Phase 5 note:** Asset management (`/api/assets`) is currently only accessible within the Maintenance tab. Phase 5 should evaluate whether Assets needs its own nav entry or whether the current embedding is sufficient.

---

### H3: Governance hub — new Members tab (enhanced `governance.tsx`)

**Type:** Existing hub gaining a new tab.
**URL:** `/app/governance` (unchanged)
**Current state:** Four tabs — Meetings / Board Packages / Elections / Compliance.
**After absorb:** Five tabs — Meetings / Board Packages / Elections / Compliance / Members.
**Absorbed pages:** `board.tsx` → "Members" tab (accessible also at `/app/governance/members`).
**Purpose:** Complete governance surface for the association's board — processes (meetings, packages, elections, compliance) plus the roster (members).
**Phase 5 note:** The `board.tsx` route at `/app/board` should receive a `<RouteRedirect to="/app/governance/members" />` per C7.

---

## 7. Renames and Moves

Full list of label changes and URL changes proposed by Phase 1+2 verdicts.

| Old Label | New Label | Old URL | New URL | Source File | Verdict | Notes |
|---|---|---|---|---|---|---|
| Portfolio | Portfolio Health | `/app/portfolio` | `/app/portfolio` (unchanged) | `portfolio.tsx` | RENAME-MOVE | Label only; URL unchanged |
| Associations (in Overview group) | Associations (in Setup group) | `/app/associations` | `/app/associations` (unchanged) | `associations.tsx` | RENAME-MOVE | Nav group move only; URL unchanged |
| (no sidebar entry) | Association Setup | `/app/association-context` | `/app/association-context` (unchanged) | `association-context.tsx` | RENAME-MOVE | Adds sidebar entry; URL unchanged |
| Board (group header + page) | Board Members (child item) | `/app/board` | `/app/governance/members` | `board.tsx` | RENAME-MOVE | URL change required; add RouteRedirect `/app/board` → `/app/governance/members` |
| Board (group label) | Governance & Communications | N/A (group label) | N/A | `app-sidebar.tsx` | — | Group label rename only; no URL |
| Documents | Documents & Records | `/app/documents` | `/app/documents` (unchanged) | `documents.tsx` | RENAME-MOVE | Label only; gains Policies tab in Phase 6 |
| Operations (group parent) | Operations Overview | `/app/operations/dashboard` | `/app/operations/dashboard` (unchanged) | `operations-dashboard.tsx` | PATCH + RENAME | Label + page header rename; URL unchanged |
| Amenity Booking | Amenity Admin | `/app/amenities` | `/app/amenity-admin` | `amenities-admin.tsx` | RENAME-MOVE | URL change required; add RouteRedirect `/app/amenities` → `/app/amenity-admin` |
| Community Hub | Community Hub Config | `/app/community-hub` | `/app/community-hub` (unchanged) | `community-hub.tsx` | PATCH | Label + header rename; URL unchanged |

---

## 8. Kill List (Customer Side Only)

Pages with KILL verdicts from Phase 1+2 that belong to Zone 1 or Zone 2.

### Legacy financial files (8) — A3 verdict: KILL

All content fully covered by hub tabs. All backing API routes retained (see A3 legacy coverage analysis).

| File | Legacy Route | Redirect Target (live) | API Disposition |
|---|---|---|---|
| `financial-budgets.tsx` | `/app/financial/budgets` → redirect | `/app/financial/expenses` (Budgets tab) | KEEP all `/api/financial/budgets/*` routes |
| `financial-utilities.tsx` | `/app/financial/utilities` → redirect | `/app/financial/expenses` (Utilities tab) | KEEP `/api/financial/utilities` routes |
| `financial-recurring-charges.tsx` | `/app/financial/recurring-charges` → redirect | `/app/financial/foundation` (Recurring Charges tab) | KEEP all `/api/financial/recurring-charges/*` routes |
| `financial-reconciliation.tsx` | `/app/financial/reconciliation` → redirect | `/app/financial/reports` (Reconciliation tab) | KEEP all `/api/financial/reconciliation/*` routes |
| `financial-invoices.tsx` | `/app/financial/invoices` → redirect | `/app/financial/expenses` (Invoices tab) | KEEP `/api/financial/invoices` routes |
| `financial-late-fees.tsx` | `/app/financial/late-fees` → redirect | `/app/financial/billing` (Late Fees tab) | KEEP all `/api/financial/late-fee*` routes |
| `financial-ledger.tsx` | `/app/financial/ledger` → redirect | `/app/financial/billing` (Owner Ledger tab) | KEEP all `/api/financial/owner-ledger/*` routes |
| `financial-assessments.tsx` | `/app/financial/assessments` → redirect | `/app/financial/billing` (Assessments tab) | KEEP all `/api/financial/assessments*` routes |

**C2 note:** No API routes are deleted. All `/api/financial/*` routes backing legacy content remain live because they serve the hub tabs. Only the standalone page files and their `<RouteRedirect>` wrappers are removed.

---

### Legacy governance files (4) — A4 verdict: KILL

All content fully covered by governance hub tabs. All backing API routes retained (see A4 legacy coverage analysis).

| File | Legacy Route | Redirect Target (live) | API Disposition |
|---|---|---|---|
| `governance-compliance.tsx` | `/app/governance/compliance` → redirect | `/app/governance` (Compliance tab) | KEEP `/api/governance/compliance*` routes |
| `meetings.tsx` | `/app/governance/meetings` → redirect | `/app/governance` (Meetings tab) | KEEP all `/api/governance/meetings*` routes |
| `board-packages.tsx` | `/app/governance/board-packages` → redirect | `/app/governance` (Board Packages tab) | KEEP all `/api/admin/board-packages*` routes |
| `elections.tsx` | `/app/governance/elections` → redirect | `/app/governance` (Elections tab) | KEEP all `/api/elections*` routes |

**C2 note:** Same pattern as financial files — all backing APIs are retained. The `election-detail.tsx` at `/app/governance/elections/:id` is NOT killed; it is a live-routed deep-detail page that has no standalone legacy route.

---

### Customer-side MERGE / WIDGETIZE kills

| File | Verdict | Absorbed Into | Route to Retire |
|---|---|---|---|
| `announcements.tsx` | KILL (was MERGE-AS-TAB; content already embedded) | `communications.tsx` Announcements tab | `/app/announcements` route + sidebar entry |
| `insurance.tsx` | MERGE-AS-TAB → KILL of standalone route | `documents.tsx` Policies tab | `/app/insurance` route + sidebar entry |
| `maintenance-schedules.tsx` | MERGE-AS-TAB → standalone route retired | `work-orders.tsx` Maintenance tab | `/app/maintenance-schedules` sidebar entry (route via redirect ok per C7) |
| `inspections.tsx` | MERGE-AS-TAB → standalone route retired | `work-orders.tsx` Inspections tab | `/app/inspections` sidebar entry (route via redirect ok per C7) |
| `new-association.tsx` | WIDGETIZE → KILL candidate | `associations.tsx` create dialog | `/app/new-association` route + sidebar footer button (Phase 6 pending dialog confirmation) |

**C2 note for merged files:** `announcements.tsx` — no unique API routes beyond what `communications.tsx` already uses; no API impact. `insurance.tsx` — API routes (`GET/POST/PATCH /api/insurance/policies`, renewal alerts) must be retained because they back the merged Policies tab in `documents.tsx`. `maintenance-schedules.tsx` — all `/api/maintenance/schedules*` and `/api/assets*` routes KEEP. `inspections.tsx` — all `/api/inspections*` routes KEEP.

---

**Customer-side kill total: 17 files** (8 financial + 4 governance + 5 merged/widgetized)

---

## 9. DEMOTE-ADMIN Handover to Phase 4

Phase 4 receives the following pages for Zone-3 audit. **Phase 4 should scorecard all of these; the coordinator does not verdict them.**

### From Phase 2 — DEMOTE-ADMIN (confirmed Zone 3)

| File | Current URL | Current Category (Phase 2) | Note for Phase 4 |
|---|---|---|---|
| `platform-controls.tsx` | `/app/platform/controls` | Z3-1 Platform Configuration | Phase 4 must confirm Z3-1 vs. Z3-3 for any diagnostics subsections; also resolve `owner-portal.tsx` launcher link in its submenu |
| `ai-ingestion.tsx` | `/app/ai/ingestion` | Z3-1 Platform Configuration | Phase 4 must decide WIP gate: lift or harden; confirm Z3-1 vs. Z3-3 |
| `roadmap.tsx` | `/app/admin`, `/app/admin/roadmap` | Z3-2 Platform Team Ops | Phase 4 must flag C3 gap: API roles include `board-admin` and `manager` — is this intentional customer transparency or a defect? |

### From Phase 2 — ORPHAN-SURFACE (likely Zone 3, needs Phase 4 scoring)

| File | Current URL | Phase 2 Verdict | Note for Phase 4 |
|---|---|---|---|
| `admin-users.tsx` | `/app/admin/users` | ORPHAN-SURFACE → Z3-2 | Add to Platform Controls tab group or give explicit sidebar link; no content gaps |
| `executive.tsx` | `/app/admin/executive` | ORPHAN-SURFACE → Z3-2 | Add to Platform Controls tab group; Phase 4 must clarify intended persona for board-admin API access |
| `board-portal.tsx` | (no URL — conditional render) | ORPHAN-SURFACE → disputed (see TD-2) | Taxonomy dispute TD-2 must be resolved by owner first; Phase 4 holds until then; if resolved as Zone 1, returns to Phase 5 not Phase 4 |
| `workspace-preview.tsx` | (no URL — unauthenticated fallback) | ORPHAN-SURFACE → Z3-3 (disputed, see TD-3) | Taxonomy dispute TD-3 must be resolved by owner; if resolved as out-of-scope public surface, Phase 4 drops it |

### Also noted: owner-portal.tsx link in Platform Controls

`owner-portal.tsx` at `/portal` is currently linked from the Platform Controls sidebar submenu as "Owner Portal" (`app-sidebar.tsx:185`). This is a `/portal` surface outside `/app/*` scope (C9). Phase 4 should recommend removal of this launcher from the Platform sidebar — either remove entirely or move to a clearly labeled "External Links" section visible to all roles, not just platform-admin. Spec §12 Q4 is the open question.

**Phase 4 inbound count: 3 DEMOTE-ADMIN + 4 ORPHAN-SURFACE (2 of 4 pending owner taxonomy dispute resolution) + 1 cross-ref (owner-portal launcher).**

---

## 10. Internal Inconsistencies Flagged

### IC-1: A6 contradictory verdicts for work-orders.tsx + maintenance-schedules.tsx

**Pages:** `work-orders.tsx` and `maintenance-schedules.tsx`.
**Inconsistency:** A6 gave `maintenance-schedules.tsx` a MERGE-AS-TAB verdict targeting `work-orders.tsx`, AND simultaneously gave `work-orders.tsx` a PATCH verdict to *remove* the embedded Maintenance tab. These two verdicts cannot both be implemented — the first asks to keep the tab as canonical, the second asks to delete it.
**Coordinator resolution:** Accepted MERGE-AS-TAB for `maintenance-schedules.tsx` (standalone route retired, tab is canonical). Dropped the PATCH removing the tab from `work-orders.tsx`. The tab stays.
**Status:** Resolved by coordinator. A6 re-dispatch not required; both verdicts were made in the same output and the coordinator can choose between them.

---

### IC-2: A6 contradictory verdicts for vendors.tsx + inspections.tsx

**Pages:** `vendors.tsx` and `inspections.tsx`.
**Inconsistency:** A6 gave `inspections.tsx` a MERGE-AS-TAB verdict with target `vendors.tsx`, then immediately recommended re-homing the tab to `work-orders.tsx` instead. A6 also gave `vendors.tsx` a PATCH to remove the embedded Inspections tab — but if the MERGE-AS-TAB target is `vendors.tsx`, removing the tab makes the merge target non-existent.
**Coordinator resolution:** Re-homed inspections MERGE-AS-TAB to `work-orders.tsx` (aligning with A6's own thematic analysis). PATCH for `vendors.tsx` accepted (remove Inspections tab since it moves to work-orders). This creates a coherent three-tab work-orders hub.
**Status:** Resolved by coordinator. A6 re-dispatch not required.

---

### IC-3: A1 cross-ref about association-context.tsx "records" tab duplicating documents.tsx (A5 scope)

**Pages:** `association-context.tsx` (A1) and `documents.tsx` (A5).
**Inconsistency:** A1 noted that the "Records" tab in `association-context.tsx` queries `GET /api/documents?associationId=...` and renders association-scoped documents — duplicating the concern of `documents.tsx`. A5 did not cross-reference this; A5 only noted the portal publish toggle and the insurance document type.
**Status:** Not reconcilable without Phase 5 proposal context. Flagged for Phase 5: when `association-context.tsx` is surfaced as a named Zone 2 entry ("Association Setup"), Phase 5 should determine whether the Records tab should be removed from that page (directing users to Documents & Records hub instead) or whether it serves a distinct purpose (association-scoped filtered view during setup).
**Coordinator note:** No verdict change required in Phase 3. The `association-context.tsx` RENAME-MOVE verdict is not affected.

---

### IC-4: /app/operations/records route not covered by any Phase 1 auditor

**Pages:** Undiscovered filtered route.
**Inconsistency:** A6 noted in cross-refs that `App.tsx` line 239 routes `/app/operations/records` to `<DocumentsPage typeFilter="Operations" />`. This is a live route with no sidebar entry and no standalone page file. It was not assigned to A5 (Documents) or A6 (Operations) as it is a filtered view, not a standalone page.
**Status:** This route is not in the nav and has no standalone file. It does not need a verdict (it is a filtered view of an existing page). Phase 5 should decide whether to add a sidebar entry for this route (e.g. as an "Operations Records" child under the Operations group) or leave it as a deep link. Flagged for Phase 5, not a Phase 3 blocker.

---

### IC-5: WIDGETIZE target for new-association.tsx not fully confirmed

**Pages:** `new-association.tsx`, `associations.tsx`.
**Inconsistency:** A1 issued a WIDGETIZE verdict for `new-association.tsx` targeting `associations.tsx` create dialog. A1 noted that `associations.tsx` already has a create dialog using the same `POST /api/associations` mutation, but also noted the standalone page has a two-step wizard (details + location) while the dialog's coverage of step 2 (location) is not fully confirmed.
**Status:** Phase 6 precondition — before deleting `new-association.tsx`, confirm the `associations.tsx` dialog fully covers the two-step wizard. If not, the file should be PATCH to fix the dialog gap, then KILL. This is a known-gap flag, not a Phase 3 blocker.

---

## 11. Open Questions for Phase 5

**OQ-1: Single-association board experience and the new Zone 2 group**
`isSingleAssociationBoardExperience()` in `app-sidebar.tsx:215-217` hides Portfolio and Associations for `board-admin` users with ≤1 association. After this restructure, "Associations" moves from the Overview group to the Zone 2 Setup group. Phase 5 must confirm whether the single-association board experience collapse should also hide the Zone 2 Associations entry (or replace it with a non-navigable read-only display), or whether board-admins with one association should see their association's setup entry in Zone 2. Spec §12 Q5.

**OQ-2: Zone 3 visibility mechanism post-audit**
The current sidebar gates Zone 3 via `roles: ["platform-admin"]` at the `NavLink` level. Phase 5 must recommend whether to harden this (separate subroute, separate shell, middleware equivalent) or accept the sidebar filter as sufficient. Spec §12 Q1.

**OQ-3: /app/operations/records filtered route**
A live route at `/app/operations/records` renders `<DocumentsPage typeFilter="Operations" />` with no sidebar entry. Phase 5 should evaluate whether this warrants a sidebar child entry under the Operations group, a link from the Operations Overview page, or no change (deep-link only).

**OQ-4: owner-portal.tsx launcher in Platform Controls**
The "Owner Portal" entry under Platform Controls points to `/portal` — a non-`/app/*` consumer surface. Phase 5 must recommend: (a) remove from Platform sidebar, (b) move to a global external-links footer visible to all roles, or (c) convert to an informational link with a clearly labeled "external" indicator. Spec §12 Q4.

**OQ-5: board-portal.tsx architecture decision**
Owner must resolve taxonomy dispute TD-2 before Phase 5 can spec this. If board-portal.tsx is promoted to a first-class Zone 1 route, Phase 5 must design: canonical URL (`/app/board-portal`), sub-link updates (currently stale redirect paths), and alignment of its embedded sidebar-like nav with the new Zone 1 nav tree. If deprecated, Phase 5 must spec migration of any board-admin-specific UX into the main workspace.

**OQ-6: association-context.tsx Records tab vs. Documents & Records hub**
After `association-context.tsx` is surfaced as a named Zone 2 "Association Setup" entry, the Records tab (which renders `GET /api/documents?associationId=...`) may duplicate the Documents & Records hub. Phase 5 should determine whether to remove the Records tab from Association Setup (directing users to the hub) or keep it as a convenience view during the onboarding/setup flow.

**OQ-7: Asset management discoverability**
`/api/assets` and the asset registry UI are currently only accessible inside the Maintenance tab of `work-orders.tsx`. After the three-tab merge (Work Orders / Maintenance / Inspections), assets remain discoverable only through the Maintenance tab. Phase 5 should evaluate whether Assets needs a dedicated nav entry (e.g. a child item under the Operations group) or whether embedding is sufficient for the expected usage pattern.

**OQ-8: URL contracts for /app/* paths before Phase 6**
Are any `/app/*` URLs embedded in external email templates, partner integrations, or public documentation? Answer needed before Phase 6 to scope redirect requirements, particularly for: `/app/board` → `/app/governance/members`, `/app/amenities` → `/app/amenity-admin`, `/app/announcements` → `/app/communications`. Spec §12 Q7.

**OQ-9: Help Center FAQ brittleness after nav rename**
A8 flagged that `help-center.tsx` contains hardcoded references to nav labels (e.g. "Buildings page"). After the proposed renames (Amenity Booking → Amenity Admin, Community Hub → Community Hub Config, Board → Governance & Communications), some FAQ answers will be stale. Phase 5 PATCH spec for `help-center.tsx` must include a content refresh pass aligned with the new nav labels.

**OQ-10: financial-foundation.tsx → stale forward link**
A3 noted that `financial-foundation.tsx` contains a JSX forward-guidance link to `/app/financial/recurring-charges`, which resolves via RouteRedirect back to `/app/financial/foundation` (a navigation loop). Phase 6 must update this link to anchor to the Recurring Charges tab (e.g. `/app/financial/foundation?tab=recurring-charges`) when the legacy file is deleted.
