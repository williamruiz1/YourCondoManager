# Phase 4 Zone 3 Audit

**Auditor:** Phase 4 (Zone 3)
**Date:** 2026-04-11
**Scope:** 7 pages handed over from Phase 2 (3 DEMOTE-ADMIN + 4 ORPHAN-SURFACE)

---

## 1. Scorecard

| Page | Purpose | Persona | Category | Zone | Placement | Fulfillment | Verdict | Target | Rationale | Gaps | Cog |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `platform-controls.tsx` | This page exists to configure platform-level integrations (SMS, email, push, Stripe, webhooks, tenant config, permission envelopes, association scopes) for the YCM operator team. | `platform-admin` | Z3-1 Platform Configuration | zone-3 | correct | complete | KEEP | — | Primary operator config surface; correctly gated at `/app/platform/controls` (`adminRole === "platform-admin"` inline check in App.tsx:297); covers all stated Z3-1 sub-categories; no placement defect. | Minor: some `/api/platform/*` read endpoints (provider-status, email-policy, tenant-config) are open to all roles — platform config data visible to non-operators is a C3 known gap, not a blocker (see §5). | high |
| `ai-ingestion.tsx` | This page exists to allow the platform-admin team to run AI-assisted document, roster, and financial ingestion jobs into an association's data store. | `platform-admin` | Z3-1 Platform Configuration | zone-3 | correct | complete | PATCH | Retain at `/app/ai/ingestion`; lift or harden `canAccessWipRoute` WIP gate; add explicit sidebar link at same level as Roadmap | WIP gate (`canAccessWipRoute`) currently hides this from non-platform-admins but also from any future non-WIP operator; gate should either be removed (page is functional) or replaced with a direct role check matching the platform-controls pattern; no content gaps — page fully covers ingestion job lifecycle. | WIP gate is the only defect: the underlying APIs are not exclusively gated to platform-admin (see §5 C3 note) — if manager/board-admin can call the APIs directly, the WIP gate on the UI only provides cosmetic protection. | high |
| `roadmap.tsx` | This page exists to let the platform operator team manage internal product roadmap projects, workstreams, tasks, and feature delivery timelines. | `platform-admin` | Z3-2 Platform Team Ops | zone-3 | wrong-section | complete | PATCH | Move sidebar entry to an explicit Platform Admin sub-group; retain routes `/app/admin` and `/app/admin/roadmap`; flag API role width as C3 gap | Content is purely internal product management tooling (projects, workstreams, tasks, timelines, feature tree) — no customer-visible output; primary persona is `platform-admin`; however the dual route (`/app/admin` primary alias) has no inline role check in App.tsx:259-260 — any authenticated admin user can reach it directly, making the sidebar gate irrelevant for direct-URL access. | No inline role check on `/app/admin` and `/app/admin/roadmap` routes in App.tsx — these routes are accessible to all authenticated admin users, not just platform-admin; all backing APIs (`/api/admin/roadmap`, `/api/admin/projects`, `/api/admin/workstreams`, `/api/admin/tasks`) allow `board-admin` and `manager` roles (full CRUD); attachment upload/delete routes are correctly scoped to `platform-admin` only (lines 12796, 12825). | high |
| `admin-users.tsx` | This page exists to allow platform-admins to create, view, and manage all YCM admin user accounts and their roles across the platform. | `platform-admin` | Z3-2 Platform Team Ops | zone-3 | wrong-section | complete | PATCH | Add explicit sidebar link under Platform group (alongside or below Platform Controls); retain route `/app/admin/users` | Manages YCM operator-level admin accounts (all roles: platform-admin, board-admin, manager, viewer) — this is operator IAM tooling, firmly Zone 3; currently reachable only via the `platformSubPages` tab bar within the Platform section, invisible from the sidebar; no inline role check in App.tsx for `/app/admin/users` (line 261) but backing API is correctly locked to `platform-admin` only (lines 12016-12069). | No inline role check on `/app/admin/users` route in App.tsx — any authenticated admin user who knows the URL can reach the page (though the API calls will 403 for non-platform-admin). Nav discoverability is the primary defect. | med |
| `executive.tsx` | This page exists to allow the platform-admin team to author, curate, and present slide-format executive update decks synthesized from roadmap project completions. | `platform-admin` | Z3-2 Platform Team Ops | zone-3 | wrong-section | complete | PATCH | Add explicit sidebar link under Platform group; retain route `/app/admin/executive`; clarify intended read-audience for board-admin API access | The authoring surface (create slide templates, add evidence, sync from roadmap) is unambiguously platform-admin intent — this is YCM-internal executive deck tooling, not a customer-facing property-owner exec view; confirmed Zone 3, not Zone 1; currently reachable only via the `platformSubPages` tab bar; no inline role check on `/app/admin/executive` route in App.tsx (line 262). | API routes (`/api/admin/executive/updates` GET and POST, evidence endpoints, sync) allow `board-admin` and `manager` for reads and writes — it is unclear whether board-admins are intended to VIEW executive slides (read-only) or author them; this ambiguity should be resolved before Phase 5; no client-side nav entry is the primary placement defect. | high |

**Out-of-scope pages (not scorecarded — see §2 and §6):**
- `board-portal.tsx` — handback to Phase 5; customer-facing Zone 1, not Zone 3.
- `workspace-preview.tsx` — out-of-scope per C9; marketing/pre-auth surface, not `/app/*`.

---

## 2. Misclassification handbacks

### 2a. `board-portal.tsx` — HANDBACK to Phase 5 (Zone 1 misclassification)

**Phase 2 finding:** Flagged as ORPHAN-SURFACE with a Zone 1 classification but passed to Phase 4 for resolution.

**Phase 4 finding:** `board-portal.tsx` is a full portal shell for **board-admin users** — its primary persona is `board-admin`, a customer persona, not a YCM operator. The page renders a six-section association summary (Overview, Financial, Governance, Maintenance, Documents, Communications) for authenticated board members. Per spec §7: `board-admin` → Zone 1 or Zone 2, never Zone 3. Per C1, Zone 3 is operator-only; a customer-facing portal shell does not belong here.

**Classification:** Zone 1, Z1-1 Command Center (board-admin command center variant).

**Placement defect type:** `wrong-zone` — the page is architecturally misrouted (rendered at root `AuthAwareApp` level outside `/app/*` routing), but its persona and content are Zone 1, not Zone 3.

**Action for Phase 5:** Decide whether `board-portal.tsx` becomes a first-class Zone 1 route at `/app/board-portal` (or `/app/board-summary`) or whether its content is consolidated into `board.tsx` (which covers similar Z1-4 territory). The stale sub-links to deprecated redirect paths (`/app/financial/budgets`, `/app/governance/board-packages`, etc.) must be updated regardless of the routing decision. Do NOT place this page in the Zone 3 nav tree.

### 2b. `workspace-preview.tsx` — OUT OF SCOPE (C9, not `/app/*`)

**Phase 2 finding:** Tagged ORPHAN-SURFACE with a tentative Z3-3 category.

**Phase 4 finding:** `workspace-preview.tsx` is a pre-authentication marketing surface. It has no `/app/*` route — it is rendered as a fallback for unauthenticated visitors who hit any `/app/*` path. Its primary audience is unauthenticated prospects, not YCM operators. Per C9, any page outside `/app/*` goes in cross-refs, not the scorecard. Per C1, Zone 3 is for operator tooling — a marketing preview page is not operator tooling even if it appears at an operator URL.

**Action for Phase 5 / marketing surface audit:** Promote `workspace-preview.tsx` to a canonical public route (e.g. `/workspace-preview` in `PublicRouter`) so it is directly linkable. The current fallback use is a reasonable UX choice; the gap is the absence of a canonical URL. This page does not belong in the Zone 3 nav tree.

---

## 3. Proposed Zone 3 nav tree

Zone 3 has 5 scorecarded pages (2 KEEP/PATCH in Z3-1, 3 PATCH in Z3-2). One group in the sidebar is sufficient, structured by sub-category. The existing `platformModules` array in `app-sidebar.tsx` is the attachment point.

```
Platform (group, roles: ["platform-admin"])
├── Platform Controls          → /app/platform/controls          Z3-1  [KEEP — already linked]
│   └── (tab bar within page: SMS · Email · Push · Billing · Stripe · Webhooks · Tenant Config · Permission Envelopes · Scopes)
├── AI Ingestion               → /app/ai/ingestion                Z3-1  [PATCH — promote from WIP child to sibling sidebar entry]
├── Admin Roadmap              → /app/admin/roadmap               Z3-2  [PATCH — already linked as child; promote to sibling or keep as child]
├── Admin Users                → /app/admin/users                 Z3-2  [PATCH — add explicit link; currently tab-bar only]
└── Executive Decks            → /app/admin/executive             Z3-2  [PATCH — add explicit link; currently tab-bar only]
```

**Structural notes:**

- The current sidebar nests Owner Portal, Admin Roadmap, and AI Ingestion as children of Platform Controls. The proposed structure promotes AI Ingestion, Admin Roadmap, Admin Users, and Executive Decks to peer sidebar entries under the Platform group (all roles: `["platform-admin"]`). This flattens one level and makes all five pages independently discoverable.
- Owner Portal (`/portal`) is NOT a Zone 3 page and should be removed from the Platform group's children array. It is a resident-facing surface linked from an operator menu — a known placement defect (spec §1 symptom 3). Flag for Phase 5 to relocate or remove.
- No new categories (Z3-3 Platform Diagnostics) are needed for the 5 Zone 3 pages. `board-portal.tsx` is handed back. `workspace-preview.tsx` is out of scope. If future diagnostic/debug pages appear, Z3-3 can be populated then.

---

## 4. Zone 3 gating recommendation (C1)

**Recommendation: Option (b) — Separate `/admin/*` or `/operator/*` subroute tree, with hardened per-route inline role checks as an interim measure.**

### Current state

The current gating floor is mixed:

| Page | Client gate (App.tsx) | Sidebar gate |
|---|---|---|
| `/app/platform/controls` | `adminRole === "platform-admin"` inline check | `roles: ["platform-admin"]` in sidebar |
| `/app/ai/ingestion` | `canAccessWipRoute(...)` WIP check (not a role check) | `roles: ["platform-admin"]` in sidebar |
| `/app/admin/roadmap` | No role check — any authenticated admin | `roles: ["platform-admin"]` in sidebar |
| `/app/admin/users` | No role check — any authenticated admin | No sidebar entry |
| `/app/admin/executive` | No role check — any authenticated admin | No sidebar entry |

Three of the five Zone 3 pages have no inline route-level role check. A `board-admin` or `manager` who knows the URL can access the page UI (the API will mostly 403 them, but the page shell renders).

### Recommended path

**Immediate (before Phase 6 execution):** Add inline `adminRole === "platform-admin"` checks to the three unprotected routes in `App.tsx` (lines 259-262), matching the pattern already used at line 297 for `platform-controls`. This closes the direct-URL bypass at zero architectural cost.

**Phase 6 structural move:** Consolidate all Zone 3 routes under `/app/operator/*` (or retain `/app/admin/*` and `/app/platform/*` but add a Wouter route guard wrapper). This makes Zone 3 separable as a tree rather than per-route, enabling option (b). A dedicated subroute tree is the minimum investment required before a future option (c) subdomain or option (d) separate shell can be cleanly extracted.

**Not recommended now:** Options (c) subdomain and (d) separate shell both require authentication changes (`server/auth.ts`) which are explicitly out of scope per spec §3. These are appropriate Phase 6+ goals after the inline gaps are closed.

**Per-page differentiation:**

| Page | Immediate action | Phase 6 action |
|---|---|---|
| `platform-controls.tsx` | Already gated — no change needed | Stays under `/app/platform/controls` or moves to `/app/operator/config` |
| `ai-ingestion.tsx` | Replace `canAccessWipRoute` with `adminRole === "platform-admin"` check | Move to `/app/operator/ingestion` |
| `roadmap.tsx` | Add `adminRole === "platform-admin"` inline check | Move to `/app/operator/roadmap` |
| `admin-users.tsx` | Add `adminRole === "platform-admin"` inline check | Move to `/app/operator/users` |
| `executive.tsx` | Add `adminRole === "platform-admin"` inline check | Move to `/app/operator/executive` |

---

## 5. Server-side gating audit (C3)

### Z3-1 Platform Configuration

**`platform-controls.tsx` — backing APIs (`/api/platform/*`)**

| Route | Method | Roles | Gap? |
|---|---|---|---|
| `/api/platform/sms/configure` | POST | `["platform-admin"]` | No gap |
| `/api/platform/sms/provider-status` | GET | all roles | Read gap — SMS config status visible to board-admin/manager/viewer |
| `/api/platform/push/configure` | POST | `["platform-admin"]` | No gap |
| `/api/platform/push/provider-status` | GET | all roles | Read gap — push config status visible to all |
| `/api/platform/email/verify` | POST | all roles except viewer | Gap — should be platform-admin only |
| `/api/platform/email/test` | POST | all roles except viewer | Gap — should be platform-admin only |
| `/api/platform/email/policy` | GET | all roles | Read gap |
| `/api/platform/email/logs` | GET | all roles | Read gap — email send logs visible to all |
| `/api/platform/email/tracking/purge` | POST | all roles except viewer | Gap — should be platform-admin only |
| `/api/platform/auth/google-status` | GET | all roles | Read gap — acceptable (status only) |
| `/api/platform/billing/summary` | GET | `["platform-admin"]` | No gap |
| `/api/platform/billing/configure` | POST | `["platform-admin"]` | No gap |
| `/api/platform/admin-association-scopes` | GET/POST | `["platform-admin"]` | No gap |
| `/api/platform/permission-envelopes` | GET/POST/PATCH | all roles for reads, all-except-viewer for writes | Gap — permission envelopes should be platform-admin only |
| `/api/platform/tenant-config` | GET | all roles | Read gap — tenant config visible to all |
| `/api/platform/tenant-config` | POST | all roles except viewer | Gap — tenant config writes should be platform-admin only |
| `/api/admin/webhook-secrets` | POST | `["platform-admin"]` | No gap |
| `/api/admin/payment-events/:id/status` | PATCH | `["platform-admin"]` | No gap |
| `/api/admin/qa-seed/preview` | GET | `["platform-admin"]` | No gap |
| `/api/admin/qa-seed/purge` | POST | `["platform-admin"]` | No gap |
| `/api/admin/contextual-feedback` | POST | `["platform-admin"]` | No gap |

**Summary for platform-controls:** Write operations and sensitive config are correctly locked to `platform-admin`. Read endpoints are broadly open (all roles can call status/config reads). This is a known-gap pattern per spec C3 — flagged, not a blocker.

---

**`ai-ingestion.tsx` — backing APIs (`/api/ai/ingestion/*`)**

| Route family | Methods | Roles | Gap? |
|---|---|---|---|
| `/api/ai/ingestion/jobs` | GET | all roles | Gap — job list visible to all |
| `/api/ai/ingestion/jobs` | POST | all except viewer | Gap — job creation should be platform-admin only |
| `/api/ai/ingestion/jobs/:id/process` | POST | all except viewer | Gap — job processing should be platform-admin only |
| `/api/ai/ingestion/jobs/:id/records` | GET | all roles | Gap — extracted records visible to all |
| `/api/ai/ingestion/records/:id/review` | PATCH | all except viewer | Gap — record review/approval should be platform-admin only |
| `/api/ai/ingestion/import-runs/:runId/rollback` | POST | all except viewer | Gap — rollback should be platform-admin only |
| `/api/ai/ingestion/import-runs/:runId/reprocess` | POST | all except viewer | Gap — reprocess should be platform-admin only |
| `/api/ai/ingestion/rollout-policy` | GET/POST | all roles (GET), all except viewer (POST) | Gap — ingestion rollout policy should be platform-admin only |
| `/api/ai/ingestion/superseded-cleanup` | POST | all except viewer | Gap — cleanup should be platform-admin only |
| `/api/ai/ingestion/clauses` | GET | all roles | Borderline — clause data is association-scoped; acceptable if association scope is enforced |
| `/api/ai/ingestion/clauses/:id/review` | PATCH | all except viewer | Gap — clause review should be platform-admin only |
| `/api/ai/ingestion/compliance-rules/extract` | POST | all except viewer | Gap — compliance extraction should be platform-admin only |
| `/api/ai/ingestion/runtime-status` | GET | all roles | Read gap |
| `/api/ai/ingestion/monitoring` | GET | all roles | Read gap |

**Summary for ai-ingestion:** The AI Ingestion API is the most under-gated Zone 3 surface. All write/mutation operations allow `board-admin` and `manager`. The WIP gate in App.tsx masks this at the UI level but provides no API-level protection. Phase 5 should flag this as the highest-priority C3 remediation item.

---

### Z3-2 Platform Team Ops

**`roadmap.tsx` — backing APIs (`/api/admin/roadmap`, `/api/admin/projects`, `/api/admin/workstreams`, `/api/admin/tasks`)**

| Route family | Methods | Roles | Gap? |
|---|---|---|---|
| `/api/admin/roadmap` | GET | `platform-admin`, `board-admin`, `manager` | Gap — internal roadmap readable by customers |
| `/api/admin/roadmap/feature-tree` | GET | `platform-admin`, `board-admin`, `manager` | Gap — feature tree readable by customers |
| `/api/admin/projects` | POST | `platform-admin`, `board-admin`, `manager` | Gap — customers can create internal projects |
| `/api/admin/workstreams` | POST | `platform-admin`, `board-admin`, `manager` | Gap — customers can create internal workstreams |
| `/api/admin/tasks` | POST/PATCH/DELETE | `platform-admin`, `board-admin`, `manager` | Gap — customers can mutate internal tasks |
| `/api/admin/projects/:id` | GET/PATCH/DELETE | `platform-admin`, `board-admin`, `manager` | Gap |
| `/api/admin/workstreams/:id` | GET/PATCH/DELETE | `platform-admin`, `board-admin`, `manager` | Gap |
| `/api/admin/tasks/:id` | GET | `platform-admin`, `board-admin`, `manager` | Gap |
| `/api/admin/tasks/:taskId/attachments` | GET | `platform-admin`, `board-admin`, `manager` | Gap |
| `/api/admin/tasks/:taskId/attachments` | POST | `["platform-admin"]` | No gap |
| `/api/admin/tasks/:taskId/attachments/:id` | DELETE | `["platform-admin"]` | No gap |

**Summary for roadmap:** The widest API role gap in Zone 3. All roadmap CRUD is accessible to `board-admin` and `manager`. Phase 2 flagged this. The intent is ambiguous — if YCM intends customers to have roadmap read access (transparency feature), the read routes are intentional; if not, all routes should be locked to `platform-admin`. Phase 5 must resolve this intent question before Phase 6 executes.

---

**`admin-users.tsx` — backing APIs (`/api/admin/users`)**

| Route | Method | Roles | Gap? |
|---|---|---|---|
| `/api/admin/users` | GET | `["platform-admin"]` | No gap |
| `/api/admin/users` | POST | `["platform-admin"]` | No gap |
| `/api/admin/users/:id/active` | PATCH | `["platform-admin"]` | No gap |
| `/api/admin/users/:id/role` | PATCH | `["platform-admin"]` | No gap |

**Summary for admin-users:** API is correctly and exclusively gated to `platform-admin`. The only gap is the missing client-side route guard in App.tsx (line 261). The API protection is solid.

---

**`executive.tsx` — backing APIs (`/api/admin/executive/*`)**

| Route | Method | Roles | Gap? |
|---|---|---|---|
| `/api/admin/executive/updates` | GET | all roles | Gap — executive deck slides visible to all; may be intentional for board-admin read access |
| `/api/admin/executive/updates` | POST | all except viewer | Gap — slide authoring should be platform-admin only |
| `/api/admin/executive/updates/:id` | PATCH | all except viewer | Gap — slide editing should be platform-admin only |
| `/api/admin/executive/updates/:id/evidence` | GET | all except viewer (effectively) | Gap |
| `/api/admin/executive/updates/:id/evidence` | POST | all except viewer | Gap |
| `/api/admin/executive/sync` | POST | all except viewer | Gap — sync should be platform-admin only |

**Summary for executive:** Read access to executive slides is open to `board-admin` and `manager`. If the intent is that board-admins can VIEW (but not author) executive decks, the GET route is acceptable but write routes should be narrowed to `platform-admin`. Phase 5 must get owner intent clarification on this before flagging a remediation.

---

## 6. Cross-refs

### board-portal.tsx — Customer-facing Zone 1, misclassified as Zone 3

`board-portal.tsx` is not a Zone 3 page. Its primary persona is `board-admin` (customer). It renders a full alternative workspace shell for board members with sections covering Overview, Financial, Governance, Maintenance, Documents, and Communications. It is architecturally bypassing the WorkspaceRouter entirely (rendered at `AuthAwareApp` root level when `isBoardAdmin && hasWorkspaceAccess`). It contains stale links to deprecated redirect paths.

- **Not scorecarded in Zone 3.** Persona is `board-admin`, not `platform-admin`.
- **Recommended action for Phase 5:** Classify as Z1-1 Command Center (board-admin variant). Decide: (a) promote to `/app/board-portal` as a first-class Zone 1 route inside WorkspaceRouter, aligning sub-links to live routes; or (b) deprecate and fold board-admin entry point into the main workspace with board-admin-appropriate nav visibility. Option (b) is lower complexity and aligns with the audit goal of reducing parallel UX shells.

### workspace-preview.tsx — Pre-auth marketing surface, out of /app/* scope

`workspace-preview.tsx` is not a Zone 3 page. It is a static pre-authentication marketing preview rendered as a fallback for unauthenticated `/app/*` hits. No API calls. Primary audience is unauthenticated prospects. Per C9, it belongs in the public surface audit, not here.

- **Not scorecarded in Zone 3.**
- **Recommended action for Phase 5 / marketing surface audit:** Assign a canonical URL in `PublicRouter` (e.g. `/workspace-preview`). The current fallback behavior is acceptable UX; the gap is the absence of a directly linkable path.

### Owner Portal sidebar entry — placement defect

`app-sidebar.tsx:185` nests an "Owner Portal" link (`url: "/portal"`) inside the Platform Controls children array (the platform-admin-only group). The `/portal` surface is the resident-facing portal, not an operator tool. This is a known cross-surface placement defect called out in spec §1 symptom 3. It creates a misleading implication that the Owner Portal is an operator-controlled feature rather than a customer-facing URL. Phase 5 should remove this entry from the platform group and, if a launcher shortcut is needed, place it in a clearly labeled "External links" or "Customer-facing surfaces" section visible only to platform-admin users.

---

## 7. Triplet-rule coordination (C2)

No `KILL` verdicts were issued in Phase 4. C2 triplet-rule API disposition is therefore not required.

**PATCH verdicts do not require API changes.** The four PATCH verdicts in this phase are nav/gating fixes, not content changes. API routes are retained as-is pending Phase 5 intent clarification on role width.

**Phase 5 C2/C3 action items handed forward:**

1. **Roadmap API role width** — Owner must decide: are `board-admin` and `manager` intended to have roadmap read + write access (customer transparency feature) or is this a gap? If gap, all `/api/admin/roadmap`, `/api/admin/projects`, `/api/admin/workstreams`, `/api/admin/tasks` routes should be narrowed to `["platform-admin"]` in Phase 6.

2. **AI Ingestion API role width** — All write/mutation routes under `/api/ai/ingestion/*` allow `board-admin` and `manager`. If AI Ingestion is platform-admin-only (Z3-1), all routes should be narrowed to `["platform-admin"]`. If `board-admin` and `manager` are intended to use ingestion (e.g. to import their own association data), the page's Zone 3 classification should be revisited and the UI WIP gate removed.

3. **Executive API role width** — GET routes are open to all roles; write routes open to all except viewer. Owner must decide if board-admin should have read-only access to executive slides or no access. Resolution narrows the PATCH scope on write routes.

4. **Platform config read endpoints** — Multiple `/api/platform/*` GET routes are open to all roles (provider-status, email logs, tenant config, permission envelopes). These are lower-priority gaps (read-only, no destructive capability) but should be reviewed in Phase 6 if Zone 3 is moved to a separate shell.
