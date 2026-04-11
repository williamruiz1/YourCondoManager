# Phase 2 Orphan Sweep

**Auditor:** Phase 2 (orphan sweep)
**Date:** 2026-04-11
**Fresh disk listing timestamp:** 2026-04-11T00:00 (run at session start, before any other analysis)

---

## Fresh disk listing

Total .tsx files in `client/src/pages/`: **62**

**Phase 1 covered: 41**
dashboard, portfolio, associations, association-context, new-association, units, persons, financial-foundation, financial-billing, financial-payments, financial-expenses, financial-reports, financial-budgets, financial-utilities, financial-recurring-charges, financial-reconciliation, financial-invoices, financial-late-fees, financial-ledger, financial-assessments, board, governance, governance-compliance, meetings, elections, election-detail, board-packages, communications, announcements, documents, insurance, operations-dashboard, work-orders, maintenance-schedules, inspections, vendors, resident-feedback, amenities-admin, community-hub, user-settings, help-center

**Out-of-scope (C9 cross-refs) — exist on disk, not `/app/*`:**
landing, pricing, solutions, privacy-policy, terms-of-service, plan-signup, plan-signup-success, owner-portal, vendor-portal, community-hub-public, amenities (resident `/portal/amenities`), election-ballot (`/vote/:token`), onboarding-invite (`/onboarding/:token`), not-found (404 fallback)
Total out-of-scope on disk: **14**

**Phase 2 in-scope: 7**
platform-controls, ai-ingestion, roadmap, admin-users, executive, board-portal, workspace-preview

---

## Route status summary (pre-scorecard)

| File | Route(s) in App.tsx | Sidebar entry? |
|---|---|---|
| `platform-controls.tsx` | `/app/platform/controls` (live, platform-admin gate inline) | Yes — Platform group, parent item |
| `ai-ingestion.tsx` | `/app/ai/ingestion` (live, WIP-gated to platform-admin via `canAccessWipRoute`) | Yes — Platform Controls submenu child |
| `roadmap.tsx` | `/app/admin` AND `/app/admin/roadmap` (both live) | Yes — Platform Controls submenu child ("Admin Roadmap") |
| `admin-users.tsx` | `/app/admin/users` (live, no inline role check in router — but API is platform-admin only) | No sidebar link — reachable via `platformSubPages` tab bar within Platform section |
| `executive.tsx` | `/app/admin/executive` (live) | No sidebar link — reachable via `platformSubPages` tab bar within Platform section |
| `board-portal.tsx` | No URL route. Rendered as `BoardAdminPortalShell` directly when `isBoardAdmin && hasWorkspaceAccess` at the root `AuthAwareApp` level. Not reachable via `/app/*` URL routing. | No sidebar entry |
| `workspace-preview.tsx` | No URL route. Rendered as a fallback at `AuthAwareApp` level when `isWorkspaceRoute && !hasWorkspaceAccess`. Shown in place of the workspace for unauthenticated `/app/*` visitors. | No sidebar entry |

---

## Scorecard

| Page | Purpose | Persona | Category | Zone | Placement | Fulfillment | Verdict | Target | Rationale | Gaps | Cog |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `platform-controls.tsx` | This page exists to configure platform-level integrations (Twilio SMS, email, push, Stripe, webhooks, tenant config, permission envelopes, portal access) for the YCM operator team. | `platform-admin` | Z3-1 Platform Configuration | zone-3 | correct | complete | DEMOTE-ADMIN | Phase 4 Zone-3 pass — keep as Platform Controls primary page under Z3-1 | Correctly placed in sidebar Platform group behind platform-admin gate; already the canonical Platform Controls page; no placement defect, but Zone-3 ownership must be confirmed by Phase 4 | None — content is substantive and covers the stated purpose across multiple config cards | high |
| `ai-ingestion.tsx` | This page exists to allow the platform-admin team to run AI-assisted document and roster ingestion jobs into an association's data modules. | `platform-admin` | Z3-1 Platform Configuration | zone-3 | correct | complete | DEMOTE-ADMIN | Phase 4 Zone-3 pass — retain as AI Ingestion tab under Z3-1 Platform Configuration | WIP-gated to platform-admin, linked under Platform Controls submenu; placement and gating are correct; Phase 4 should confirm it belongs under Z3-1 (config/ingestion tool) vs Z3-3 (diagnostics) | WIP gate (`canAccessWipRoute`) means non-platform-admins get NotFound — Phase 4 should recommend whether to remove the WIP flag or harden it | high |
| `roadmap.tsx` | This page exists to let the platform operator team manage and track internal product roadmap projects, workstreams, tasks, and feature delivery timelines. | `platform-admin` | Z3-2 Platform Team Ops | zone-3 | correct | complete | DEMOTE-ADMIN | Phase 4 Zone-3 pass — retain as Admin Roadmap tab under Z3-2 Platform Team Ops | Sidebar-linked under Platform Controls as "Admin Roadmap"; API allows board-admin and manager read access (`/api/admin/roadmap` roles: platform-admin, board-admin, manager) which is a known-gap flag — the page itself should stay Zone-3 but the API exposure is wider than expected | API role width (`board-admin`, `manager` on `/api/admin/roadmap`) does not match Zone-3 intent — flag for Phase 5 C3 cross-check | high |
| `admin-users.tsx` | This page exists to allow platform-admins to create, view, and manage all YCM admin user accounts and their roles. | `platform-admin` | Z3-2 Platform Team Ops | zone-3 | wrong-section | complete | ORPHAN-SURFACE | Platform Controls tab group (`platformSubPages`) — add explicit sidebar link under Platform group, or absorb as named tab within `platform-controls.tsx` | Has a live route at `/app/admin/users` and is reachable via the `platformSubPages` tab bar when inside the Platform section, but has no independent sidebar link; the route is completely hidden from the sidebar nav tree and has no parent sidebar entry of its own; requires navigation to `/app/platform/controls` first to discover the tab bar | No content gaps — the page fully covers admin user CRUD. Navigation discoverability is the only defect. | med |
| `executive.tsx` | This page exists to allow the platform-admin team to build, curate, and present slide-format executive update decks synthesized from roadmap project completions. | `platform-admin` | Z3-2 Platform Team Ops | zone-3 | wrong-section | complete | ORPHAN-SURFACE | Platform Controls tab group (`platformSubPages`) — add explicit sidebar link under Platform group, or absorb as named tab within the Platform section | Has a live route at `/app/admin/executive` and appears in the `platformSubPages` tab bar, but has no independent sidebar link; hidden from nav tree entirely; API roles include board-admin and manager (viewer) which creates ambiguity — but the page's authoring/sync capability is platform-admin intent | API routes `/api/admin/executive/updates` and related allow board-admin and manager roles — unclear if board-admin is intended to view (not author) executive slides; Phase 4 should clarify intended persona split | high |
| `board-portal.tsx` | This page exists to render a board-member-specific summary portal (overview, financials, governance, maintenance, documents, communications) for authenticated board-admin users. | `board-admin` | Z1-1 Command Center | zone-1 | wrong-zone | complete | ORPHAN-SURFACE | Investigate as a Zone-1 board-admin entry point — Phase 4 / Phase 5 must decide whether to route it under `/app/board-portal` or fold its content into the existing `board.tsx` tab experience | Not reachable via any `/app/*` URL; rendered conditionally at the `AuthAwareApp` root level when `isBoardAdmin && hasWorkspaceAccess`; the page is a full board-facing portal shell with its own sidebar-like nav (Overview, Financial, Governance, Maintenance, Documents, Communications) that duplicates the association workspace nav; `board-portal.tsx` hard-links to legacy redirect paths (`/app/financial/budgets`, `/app/governance/board-packages`) that are now RouteRedirects — those sub-links will silently redirect, which may confuse board-admin users | Sub-links inside BoardPortal point to deprecated redirect paths (`/app/financial/budgets`, `/app/governance/board-packages`, `/app/governance/meetings`, `/app/financial/reconciliation`); this page bypasses the workspace shell and sidebar entirely, creating a divergent UX; its content overlap with the main workspace nav is high | high |
| `workspace-preview.tsx` | This page exists to show unauthenticated visitors a marketing-flavored preview of the YCM workspace structure before they sign in. | `manager` (secondary: unauthenticated prospect) | Z3-3 Platform Diagnostics | zone-3 | wrong-zone | complete | ORPHAN-SURFACE | Move to a public marketing route (e.g. `/workspace-preview` or `/preview`) under the PublicRouter, not as a fallback for `/app/*` unauthenticated hits | Currently rendered as the fallback for any unauthenticated `/app/*` hit — this is a pre-auth marketing surface masquerading as a workspace gate; it has no route in `WorkspaceRouter` or `PublicRouter`; it is not `/app/*` content in intent or persona; C9 applies — its true home is the public surface, not the operator workspace | The page prompts sign-in via Google and links back to `/`; it is static/informational only; the only technical gap is the absence of a canonical URL — it has no direct-linkable path | low |

---

## Verdict distribution

| Verdict | Count | Pages |
|---|---|---|
| DEMOTE-ADMIN | 3 | platform-controls, ai-ingestion, roadmap |
| ORPHAN-SURFACE | 4 | admin-users, executive, board-portal, workspace-preview |
| KILL | 0 | — |

---

## DEMOTE-ADMIN handovers to Phase 4

The following three pages are confirmed Zone-3 and are handed off to the Phase 4 Zone-3 auditor for full scoring within the Platform operator audit:

1. **`platform-controls.tsx`** — Z3-1 Platform Configuration. Currently the primary Platform Controls page at `/app/platform/controls`. Sidebar entry exists and is correctly gated. Phase 4 must confirm final category (Z3-1 vs. Z3-3 for diagnostics subsections like QA seed controls visible in the API).
2. **`ai-ingestion.tsx`** — Z3-1 Platform Configuration. Currently WIP-gated at `/app/ai/ingestion`. Phase 4 must determine whether the WIP gate should be lifted or hardened, and whether the page belongs in Z3-1 (ingestion as a config tool) or Z3-3 (ingestion as a diagnostic/debug tool).
3. **`roadmap.tsx`** — Z3-2 Platform Team Ops. Routed at `/app/admin` and `/app/admin/roadmap`. API access is wider than Zone-3 intent (board-admin and manager can read). Phase 4 must flag this C3 gap and recommend whether the wider API access is intentional (board-admin roadmap read access as a customer transparency feature) or a defect.

---

## ORPHAN-SURFACE resolutions (Phase 5 action required)

1. **`admin-users.tsx`** — Reachable via `platformSubPages` tab bar only; needs an explicit sidebar link or absorption into a parent Platform Controls tab. Recommend: add as a named tab under the Platform Controls sidebar item alongside Roadmap and AI Ingestion. No content work needed.
2. **`executive.tsx`** — Same nav discoverability issue as admin-users. Additionally, the API's broader role access (`board-admin`, `manager`) should be reviewed against intended persona. Recommend: add as a named tab under Platform Controls. Phase 5 should clarify whether board-admins should see executive slides (read-only view) or not at all.
3. **`board-portal.tsx`** — Architecturally significant orphan. A full alternative workspace shell for board-admins that bypasses the main WorkspaceShell and sidebar. Contains stale sub-links to deprecated redirect paths. Phase 5 must decide: (a) promote to a first-class `/app/board-portal` route and align its sub-links with live routes, or (b) deprecate and migrate board-admin UX into the main WorkspaceShell (board-admin already sees the full association workspace). The current conditional rendering at root level is an undocumented branch not visible in any nav.
4. **`workspace-preview.tsx`** — Should be promoted to a canonical public URL (e.g. `/workspace-preview` in `PublicRouter`) so it is directly linkable from marketing materials. Its current use as the fallback for unauthenticated `/app/*` hits is a reasonable UX choice (show preview instead of redirect to login), but without a canonical URL it cannot be linked or indexed. Phase 5 should coordinate with the marketing surface audit.

---

## Cross-refs

Pages encountered on disk that are out of scope for `/app/*` but worth noting:

- **`owner-portal.tsx`** — Rendered at `/portal` in `PublicRouter`. Currently linked from the Platform Controls sidebar submenu as "Owner Portal" (app-sidebar.tsx:185). This is the open question Q4 in the spec: a resident-facing `/portal` surface is linked inside a `platform-admin`-only operator menu. Phase 5 cross-ref: either remove the sidebar launcher or move it to a clearly labeled external-link section. Out-of-scope for this audit (not `/app/*`).
- **`amenities.tsx`** — Rendered at `/portal/amenities` in `PublicRouter`. Resident-facing only. The `/app/amenities` route correctly renders `AmenitiesAdminPage` (a different file). No scorecard row needed; both files are correctly bifurcated.
- **`board-portal.tsx`** — Although its primary persona is `board-admin` (Zone 1), it is rendered outside the `/app/*` route tree entirely. It is not a C9 violation (it does render for `/app/*` navigation hits when the user is a board-admin), but its architecture bypasses the WorkspaceRouter completely. Cross-ref to Phase 5: should the board-admin flow be routed explicitly under `/app/board-portal` or collapsed into the main workspace?
- **`workspace-preview.tsx`** — Not a true `/app/*` page in intent; it is a pre-auth marketing surface shown at `/app/*` for unauthenticated users. Phase 5 should evaluate adding it to `PublicRouter` at a canonical path.

---

## Triplet-rule coordination (C2)

No `KILL` verdicts were issued in Phase 2. C2 triplet-rule analysis is therefore not required for this phase.

However, the following API surface observations are flagged for Phase 5 (which will consolidate all C2 work):

- **`/api/admin/users` (GET, POST, PATCH)** — Backs `admin-users.tsx`. Currently only accessible to `platform-admin`. Page is ORPHAN-SURFACE (nav gap), not KILL. API should be retained as-is. No disposition change needed.
- **`/api/admin/executive/updates` and related** (GET, POST, PATCH, evidence endpoints, sync) — Backs `executive.tsx`. Role includes `board-admin` and `manager` for reads, `platform-admin` for writes. Page is ORPHAN-SURFACE. API retained. Phase 5 should flag whether the read access to board-admin is intentional.
- **`/api/admin/roadmap` and related project/workstream/task CRUD** — Backs `roadmap.tsx`. Role includes `board-admin` and `manager`. Page is DEMOTE-ADMIN. API wider than Zone-3 intent — Phase 4 / Phase 5 C3 flag.
- **`/api/platform/*` (sms/configure, push/configure, email/*, billing/*, auth/google-status, tenant-config, permission-envelopes, admin-association-scopes)** — Back `platform-controls.tsx`. All correctly gated to `platform-admin` for writes; some read endpoints are wider. Page is DEMOTE-ADMIN to Phase 4. No disposition change pending Phase 4 decision.
- **`/api/ai/*` or `/api/ingestion/*`** — Back `ai-ingestion.tsx`. Phase 4 should enumerate these during Zone-3 pass (not traced here to avoid scope creep).
- **`board-portal.tsx`** — No unique API routes. Calls the same association/financial/governance/maintenance/documents/communications APIs used throughout the workspace. No special API disposition needed.
- **`workspace-preview.tsx`** — No API calls. Static page. No API disposition.
