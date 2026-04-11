# Phase 1 Audit — A4 Board, Governance & Communications
**Auditor:** A4
**Date:** 2026-04-11
**Scope:** 10 pages — `board.tsx`, `governance.tsx`, `governance-compliance.tsx`, `meetings.tsx`, `elections.tsx`, `election-detail.tsx`, `election-ballot.tsx`, `board-packages.tsx`, `communications.tsx`, `announcements.tsx`

---

## Scorecard

| Page | Purpose | Persona | Category | Zone | Placement | Fulfillment | Verdict | Target | Rationale | Gaps | Cog |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/app/board` (`board.tsx`) | This page exists to manage board member roles and terms for the active association. | `board-admin` | Z1-4 Governance & Decisions | zone-1 | wrong-section | complete | RENAME-MOVE | Move to `/app/governance/members` and surface as a "Members" tab within the governance hub | board.tsx is a people-management sub-task of governance, not a separate top-level section; the current sidebar treats it as a group parent for Governance/Communications/Announcements children, conflating a roster page with an entire section header — it belongs inside the governance hub as a peer tab or as the landing tab | None — content is complete for its narrow purpose | low |
| `/app/governance` (`governance.tsx`) | This page exists to consolidate board meetings, board packages, elections, and compliance tracking into a single tabbed governance hub. | `board-admin` | Z1-4 Governance & Decisions | zone-1 | correct | complete | KEEP | — | Hub correctly absorbs all four legacy governance sub-pages via imported content components; tabs are fully populated; route is live and canonical | — | med |
| `/app/communications` (`communications.tsx`) | This page exists to compose and send notices to residents, manage notice templates, run payment reminder rules, track delivery history, and handle onboarding invites. | `manager` | Z1-5 Communications | zone-1 | correct | complete | KEEP | — | Comprehensive outbound channel hub covering delivery workspace (notice send + templates + reminder rules), onboarding workspace, and operations workspace; Announcements is embedded as a second tab inside `CommunicationsPage`, making the sibling `/app/announcements` route redundant | — | high |
| `/app/announcements` (`announcements.tsx`) | This page exists to create, edit, and publish community announcements to residents. | `manager` | Z1-5 Communications | zone-1 | wrong-section | complete | MERGE-AS-TAB | `/app/communications` (already embedded as the "Announcements" tab) | `AnnouncementsContent` is already imported and rendered as a tab inside `CommunicationsPage`; the standalone `/app/announcements` route is a duplicate surface — the sidebar entry and route should be removed, leaving the tab as the sole access point | — | low |
| `governance-compliance.tsx` (legacy redirect → `/app/governance`) | This page exists to track annual governance compliance tasks, compliance gap alerts, and AI-extracted obligation records. | `board-admin` | Z1-4 Governance & Decisions | zone-1 | correct | complete | KILL | `/app/governance` (Compliance tab) | `GovernanceComplianceContent` is imported directly into the governance hub's "Compliance" tab — the standalone page and default export are dead code; routes redirect to hub; API routes `/api/governance/compliance-alerts` and `/api/governance/compliance-alert-overrides` are KEEP (consumed by hub); any compliance-task CRUD routes on `annualGovernanceTasks` are KEEP; only the `GovernanceCompliancePage` default export and its legacy route can be retired | — | — |
| `meetings.tsx` (legacy redirect → `/app/governance`) | This page exists to schedule governance meetings, manage agendas, record notes, track resolutions and votes, and send meeting notices. | `board-admin` | Z1-4 Governance & Decisions | zone-1 | correct | complete | KILL | `/app/governance` (Meetings tab) | `MeetingsContent` is imported directly into the governance hub's "Meetings" tab — the standalone page default export is dead code; routes `/app/governance/meetings` and implied legacy `/app/meetings` redirect to hub; API routes `GET/POST /api/governance/meetings`, `/api/governance/meetings/:id/*` (agenda-items, notes), `/api/governance/meeting-notes/:id` are KEEP (consumed by hub); only `MeetingsPage` default export can be retired | — | — |
| `board-packages.tsx` (legacy redirect → `/app/governance`) | This page exists to manage board package templates, generate packages, distribute them to board members, and review distribution history. | `manager` | Z1-4 Governance & Decisions | zone-1 | correct | complete | KILL | `/app/governance` (Board Packages tab) | `BoardPackagesContent` is imported directly into the governance hub's "Board Packages" tab — the standalone page default export is dead code; route `/app/governance/board-packages` redirects to hub; API routes `GET/POST /api/admin/board-packages/templates`, `GET /api/admin/board-packages`, `POST /api/admin/board-packages/generate/:templateId`, `GET /api/admin/board-packages/distribution-history`, `POST /api/admin/board-packages/run-scheduled`, `POST /api/admin/board-packages/:id/distribute`, `PATCH /api/admin/board-packages/:id` are all KEEP (consumed by hub); only `BoardPackagesPage` default export can be retired | — | — |
| `elections.tsx` (legacy redirect → `/app/governance`) | This page exists to create and manage elections, define options, manage ballot tokens, and view participation. | `board-admin` | Z1-4 Governance & Decisions | zone-1 | correct | complete | KILL | `/app/governance` (Elections tab) | `ElectionsContent` is imported directly into the governance hub's "Elections" tab — the standalone page default export is dead code; route `/app/governance/elections` redirects to hub; API routes `GET/POST /api/elections`, `GET /api/elections/compliance-summary`, `GET /api/elections/active-summary`, `GET /api/elections/analytics`, `GET/PATCH/DELETE /api/elections/:id`, and all sub-resource routes (`/tokens`, `/options`, `/nominations`, `/casts`, `/tally`, `/certify`, `/generate-tokens`) are all KEEP (consumed by hub and election-detail); only `ElectionsPage` default export can be retired | — | — |
| `/app/governance/elections/:id` (`election-detail.tsx`) | This page exists to display full election detail, manage options and nominations, track ballot tokens, view tally charts, and certify results. | `board-admin` | Z1-4 Governance & Decisions | zone-1 | correct | complete | KEEP | — | Live-routed at `/app/governance/elections/:id`; deep-detail page for a single election that cannot be absorbed into the hub tab without excessive nesting; provides election management actions (edit, open/close/cancel, certify) and rich tally visualization not present in the hub list view | — | high |
| `/vote/:token` (`election-ballot.tsx`) | This page exists to allow a resident to review an election, select their choice, and submit a ballot using a one-time token. | `owner-resident` | — | — | wrong-zone | complete | — (cross-ref only) | `/vote/:token` public surface | Primary persona is `owner-resident`; routed outside `/app/*` at `/vote/:token`; not an operator page — belongs in a future `/vote` surface audit per spec §9 C9; no scorecard row issued | — | — |

---

## DEMOTE-ADMIN handovers

None. No page in this section's primary scope has a `platform-admin` primary persona. All pages serve `manager`, `board-admin`, or `viewer` within zone-1. The Board group is correctly accessible to all non-platform roles.

---

## Cross-refs

### `election-ballot.tsx` — wrong-surface, not scored

`client/src/pages/election-ballot.tsx` is routed at `/vote/:token` (App.tsx line 359–361), which is outside `/app/*` and outside the operator workspace. Its primary persona is `owner-resident`. It is noted here for cross-surface completeness and must be handled in a future `/vote` surface audit. It is excluded from the scorecard per C9. The backing public API routes (`/api/public/vote/:token`, ballot submission) are also out of scope for this audit.

### `announcements.tsx` embedded in `communications.tsx`

`AnnouncementsContent` is imported into `CommunicationsPage` as the "Announcements" tab (communications.tsx line 36, lines 2277–2284). The standalone `/app/announcements` sidebar entry and route are therefore a duplicate access point. The recommendation is MERGE-AS-TAB. The sidebar entry at app-sidebar.tsx line 123 should be removed in Phase 6; only the tab inside `/app/communications` is needed.

### `board.tsx` as sidebar group header

In `app-sidebar.tsx` lines 114–125, "Board" is both the group header (linking to `/app/board`) and the parent container for Governance, Communications, and Announcements children. This overloads a board-roster management page as the semantic label for an entire section. Phase 3 (nav restructure) should rename the sidebar group to "Governance & Communications" or similar and demote `board.tsx` to a tab inside the governance hub.

---

## Legacy coverage analysis

### 1. `governance-compliance.tsx` → `/app/governance` (Compliance tab)

- **Hub coverage: FULL.** `GovernanceComplianceContent()` is directly imported into `governance.tsx` at line 7 and rendered as the "Compliance" tab (line 36). All compliance gap alerts, annual governance task CRUD, AI-extracted records, and calendar integration features present in the standalone page are present in the hub tab.
- **Verdict: KILL.** No content gap. The `GovernanceCompliancePage` default export (line 1527) is unreachable dead code.

### 2. `meetings.tsx` → `/app/governance` (Meetings tab)

- **Hub coverage: FULL.** `MeetingsContent()` is directly imported into `governance.tsx` at line 4 and rendered as the "Meetings" tab (lines 27–29). Meeting scheduling, agenda management, notes, resolutions, votes, meeting notices, and governance reminder rules are all present in the hub tab.
- **Verdict: KILL.** No content gap. The `MeetingsPage` default export (line 1520) is unreachable dead code.

### 3. `board-packages.tsx` → `/app/governance` (Board Packages tab)

- **Hub coverage: FULL.** `BoardPackagesContent()` is directly imported into `governance.tsx` at line 5 and rendered as the "Board Packages" tab (lines 30–32). Template management, package generation, distribution, annotation/review, and distribution history are all present in the hub tab.
- **Verdict: KILL.** No content gap. The `BoardPackagesPage` default export (line 964) is unreachable dead code.

### 4. `elections.tsx` → `/app/governance` (Elections tab)

- **Hub coverage: FULL.** `ElectionsContent()` is directly imported into `governance.tsx` at line 6 and rendered as the "Elections" tab (lines 33–35). Election creation, option management, ballot token generation, status management, and participation view are all present in the hub tab. The drill-down to a single election uses the live-routed `election-detail.tsx` at `/app/governance/elections/:id`, which is not a legacy file.
- **Verdict: KILL.** No content gap. The `ElectionsPage` default export (line 1144) is unreachable dead code.

---

## Board vs Governance analysis

`board.tsx` and `governance.tsx` are **not redundant** — they cover different scopes — but they are **incorrectly positioned relative to each other** in the current nav.

`board.tsx` is narrowly scoped: it is a board membership roster manager. It creates/reads board roles, assigns terms, handles expiry alerts, and provides a workspace invite flow for board members. It does not touch meetings, elections, compliance, or board packages. Semantically it is a people-configuration task ("who is on the board") rather than a governance-process task ("what does the board do").

`governance.tsx` is a four-tab hub covering all board processes: meetings, board packages, elections, and compliance. It is the primary Z1-4 surface and correctly belongs in Zone 1.

The placement defect is that the sidebar uses "Board" (pointing to `board.tsx`) as the section-level group label and group-parent route, making it appear as if board membership management is the hub page for the entire section. The result is that a user clicking "Board" in the sidebar lands on a roster table, then must click "Governance" as a child item to reach the actual governance hub. This inverts the hierarchy. The correct model is:

- The sidebar group should be labeled "Governance" (or "Board & Governance"), linking to `/app/governance` as the primary entry point.
- `board.tsx` should be surfaced as a "Members" tab within the governance hub, or as a secondary child labeled "Board Members" clearly subordinate to the hub.
- Category assignment: `board.tsx` belongs in **Z1-4 Governance & Decisions**, not Z1-1 Command Center. It is not an at-a-glance dashboard; it is an administrative roster tool used when onboarding or auditing board composition. Its verdict is RENAME-MOVE rather than MERGE-AS-TAB because the members list has meaningful standalone utility and adding it as a fifth tab to the governance hub is a Phase 5/6 decision, not a Phase 1 kill.
