# Phase 9 — Persona Access Manifest Data
**Status:** PREP ARTIFACT (data only — not yet implemented in `shared/persona-access.ts`)
**Layer:** 9 (Persona Access / RouteGuard centralization)
**Owner:** YCM Command Center
**Produced:** 2026-04-20

---

## Purpose

This document enumerates the data that Phase 9 will encode into `shared/persona-access.ts` once ADR 0b is signed off and Phase 0b.2 lands the skeleton. It does **not** write code; it produces the canonical `ROUTE_MANIFEST` and `FEATURE_MANIFEST` rows derived from:

- `docs/projects/platform-overhaul/decisions/0.2-persona-map.md` — Persona Boundary Matrix (authoritative) + PM-Managed Default Access Table
- `docs/projects/platform-overhaul/decisions/3.2-route-restructure.md` — canonical 61-route table + 2026-04-21 amendments (adds 2 rows, 63 total)
- `docs/projects/platform-overhaul/decisions/2.4-platform-admin-surface-audit.md` — platform-only isolation
- `docs/projects/platform-overhaul/decisions/2.3-permission-boundary-corrections.md` — `useIsReadOnly()` hook, `<RouteGuard>` pattern, Settings Q6 roster
- `client/src/lib/wip-features.ts` — existing WIP allowlist
- `client/src/components/app-sidebar.tsx` — existing sidebar role arrays

Persona identifiers use the six-persona model locked by 0.2 (2026-04-16 rename): `manager`, `board-officer`, `assisted-board`, `pm-assistant`, `viewer`, `platform-admin`. Owner is intentionally excluded from `ROUTE_MANIFEST` because `/app/*` is closed to portal-access-id sessions per 0.2 AC 1; `/portal/*` is out of scope for Phase 9 per 3.2 Q5.

### Legend

- ✓ — route is reachable for this persona
- ✗ — route is not reachable (nav-hidden AND RouteGuard-denied)
- (R) — reachable but read-only via `useIsReadOnly()` (2.3 Q7)
- (T) — reachable only when PM toggle is set (2.2 Q1 / 0.2 PM Toggle Configuration Model)

Per 2.3 Q8 working assumption, `viewer` is treated as `read-only-of-Manager` — it mirrors Manager's surface visibility and is uniformly `(R)`. When the 0.2 matrix also shows Manager as `✗`, viewer is `✗`.

---

## Part 1 — ROUTE_MANIFEST (route → allowed personas)

The table below lists every route in the 3.2 canonical table (post-lock, post-amendment — 63 rows) plus the plural-to-singular redirects added by 3.2 Q1. Legacy `RouteRedirect` archive rows (those that redirect to another `/app/*` path and have no landing page of their own) inherit the gate of their **destination** route — they are not separately enumerated in `ROUTE_MANIFEST` because `<RouteGuard>` applies at the destination; redirects themselves carry no content.

For the manifest, the **landing/page routes** are the gating targets. Redirect rows are listed for completeness with `(→)` annotations.

| # | Route | manager | board-officer | assisted-board | pm-assistant | viewer | platform-admin | Notes / Source |
|---|---|:-:|:-:|:-:|:-:|:-:|:-:|---|
| 1 | `/app` | ✓ | ✓ | ✓ | ✓ | ✓ (R) | ✓ | Home — 0.2 matrix row 1; all personas land here |
| 2 | `/app/financials` | ✓ | ✓ | ✓ (R) | ✓ (T) | ✓ (R) | ✓ | Financials hub (3.2 Q1 NEW) — 0.2 `/app/financial/*` row; Assisted Board read-only default (PM toggle can expand) |
| 3 | `/app/financials/foundation` | ✓ | ✓ | ✓ (R) | ✓ (T) | ✓ (R) | ✓ | (→) plural-to-singular redirect → `/app/financial/foundation` (3.2 Q1) |
| 4 | `/app/financials/billing` | ✓ | ✓ | ✓ (R) | ✓ (T) | ✓ (R) | ✓ | (→) redirect → `/app/financial/billing` |
| 5 | `/app/financials/payments` | ✓ | ✓ | ✓ (R) | ✓ (T) | ✓ (R) | ✓ | (→) redirect → `/app/financial/payments` |
| 6 | `/app/financials/expenses` | ✓ | ✓ | ✓ (R) | ✓ (T) | ✓ (R) | ✓ | (→) redirect → `/app/financial/expenses` |
| 7 | `/app/financials/reports` | ✓ | ✓ | ✓ (R) | ✓ (T) | ✓ (R) | ✓ | (→) redirect → `/app/financial/reports` |
| 8 | `/app/financial/foundation` | ✓ | ✓ | ✓ (R) | ✓ (T) | ✓ (R) | ✓ | 0.2 `/app/financial/*` — Assisted Board read-only; Platform Admin included per existing sidebar precedent (see Part 5 discrepancy D1) |
| 9 | `/app/financial/billing` | ✓ | ✓ | ✓ (R) | ✓ (T) | ✓ (R) | ✓ | Same as 8 |
| 10 | `/app/financial/payments` | ✓ | ✓ | ✓ (R) | ✓ (T) | ✓ (R) | ✓ | Same as 8 |
| 11 | `/app/financial/expenses` | ✓ | ✓ | ✓ (R) | ✓ (T) | ✓ (R) | ✓ | Same as 8 |
| 12 | `/app/financial/reports` | ✓ | ✓ | ✓ (R) | ✓ (T) | ✓ (R) | ✓ | Same as 8 |
| 13 | `/app/financial/fees` | ✓ | ✓ | ✓ (R) | ✓ (T) | ✓ (R) | ✓ | (→) legacy redirect → `/app/financial/foundation` |
| 14 | `/app/financial/recurring-charges` | ✓ | ✓ | ✓ (R) | ✓ (T) | ✓ (R) | ✓ | (→) legacy redirect → `/app/financial/foundation` |
| 15 | `/app/financial/ledger` | ✓ | ✓ | ✓ (R) | ✓ (T) | ✓ (R) | ✓ | (→) legacy redirect → `/app/financial/billing` |
| 16 | `/app/financial/assessments` | ✓ | ✓ | ✓ (R) | ✓ (T) | ✓ (R) | ✓ | (→) legacy redirect → `/app/financial/billing` |
| 17 | `/app/financial/late-fees` | ✓ | ✓ | ✓ (R) | ✓ (T) | ✓ (R) | ✓ | (→) legacy redirect → `/app/financial/billing` |
| 18 | `/app/financial/invoices` | ✓ | ✓ | ✓ (R) | ✓ (T) | ✓ (R) | ✓ | (→) legacy redirect → `/app/financial/expenses` |
| 19 | `/app/financial/utilities` | ✓ | ✓ | ✓ (R) | ✓ (T) | ✓ (R) | ✓ | (→) legacy redirect → `/app/financial/expenses` |
| 20 | `/app/financial/budgets` | ✓ | ✓ | ✓ (R) | ✓ (T) | ✓ (R) | ✓ | (→) legacy redirect → `/app/financial/expenses` |
| 21 | `/app/financial/reconciliation` | ✓ | ✓ | ✓ (R) | ✓ (T) | ✓ (R) | ✓ | (→) legacy redirect → `/app/financial/reports` |
| 22 | `/app/operations` | ✓ | ✓ | ✓ | ✓ (T) | ✓ (R) | ✓ | Operations zone hub (3.2 Q2 NEW); 0.2 `/app/operations/*` row — all operator personas |
| 23 | `/app/operations/dashboard` | ✓ | ✓ | ✓ | ✓ (T) | ✓ (R) | ✓ | Operations Overview — 0.1 AC 7 preserved |
| 24 | `/app/operations/records` | ✓ | ✓ | ✓ | ✓ (T) | ✓ (R) | ✓ | Sub-page of Operations zone |
| 25 | `/app/governance` | ✓ | ✓ | ✓ | ✓ (T) | ✓ (R) | ✓ | Governance hub (3.2 Q3 NEW replaces old page); 0.2 `/app/governance/*` row — all operator personas Full |
| 26 | `/app/governance/overview` | ✓ | ✓ | ✓ | ✓ (T) | ✓ (R) | ✓ | Relocated `GovernancePage` content (3.2 Q3 MOVED) |
| 27 | `/app/governance/elections/:id` | ✓ | ✓ | ✓ | ✓ (T) | ✓ (R) | ✓ | Dynamic route; viewer read-only gated inline today (see Part 5 D2) |
| 28 | `/app/governance/board-packages` | ✓ | ✓ | ✓ | ✓ (T) | ✓ (R) | ✓ | (→) legacy redirect → `/app/governance` |
| 29 | `/app/governance/meetings` | ✓ | ✓ | ✓ | ✓ (T) | ✓ (R) | ✓ | (→) legacy redirect → `/app/governance` |
| 30 | `/app/governance/compliance` | ✓ | ✓ | ✓ | ✓ (T) | ✓ (R) | ✓ | (→) legacy redirect → `/app/governance` |
| 31 | `/app/governance/elections` | ✓ | ✓ | ✓ | ✓ (T) | ✓ (R) | ✓ | (→) legacy redirect → `/app/governance` |
| 32 | `/app/communications` | ✓ | ✓ | ✓ | ✓ (T) | ✓ (R) | ✓ | Communications hub (3.2 Q3 NEW); 0.2 `/app/communications/*` row |
| 33 | `/app/communications/overview` | ✓ | ✓ | ✓ | ✓ (T) | ✓ (R) | ✓ | Relocated `CommunicationsPage` content |
| 34 | `/app/communications/inbox` | ✓ | ✓ | ✓ | ✓ (T) | ✓ (R) | ✓ | 2026-04-21 amendment — 4.1 Q4; cross-association alert inbox; broad per founder spec (Phase 11 placeholder) |
| 35 | `/app/associations` | ✓ | ✓ (→ `/app`) | ✓ (→ `/app`) | ✓ | ✓ | ✓ | 2.3 Q5 role-based redirect: Board Officer / Assisted Board redirected to `/app` regardless of association count |
| 36 | `/app/association-context` | ✓ | ✗ | ✗ | ✓ | ✗ | ✓ | Manager-only per 2.3 Q12 (context switcher — single-assoc personas do not have one per 0.2 §Persona 2/3) |
| 37 | `/app/new-association` | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | PM/platform provisioning action — footer button rendered only for `platform-admin` today (sidebar.tsx:481); Manager inferred ✓ for multi-association creation ⚠️ (see D3) |
| 38 | `/app/units` | ✓ | ✓ | ✓ (R) | ✓ (T) | ✓ (R) | ✓ | 0.2 `/app/units` row — Assisted Board read only; PM Assistant subject to toggle |
| 39 | `/app/persons` | ✓ | ✓ | ✓ (R + invite) | ✓ (T) | ✓ (R) | ✓ | 0.2 `/app/people` row; "Read + invite" Assisted Board note — write handled via useIsReadOnly carve-out for invite action |
| 40 | `/app/owners` | ✓ | ✓ | ✓ (R + invite) | ✓ (T) | ✓ (R) | ✓ | (→) legacy redirect → `/app/persons` |
| 41 | `/app/occupancy` | ✓ | ✓ | ✓ (R) | ✓ (T) | ✓ (R) | ✓ | (→) legacy redirect → `/app/units` |
| 42 | `/app/board` | ✓ | ✓ | ✓ | ✓ (T) | ✓ (R) | ✓ | Board members list; governance-adjacent — inferred per 0.2 `/app/governance/*` row |
| 43 | `/app/documents` | ✓ | ✓ | ✓ (view + publish to portal; T can expand) | ✓ (T) | ✓ (R) | ✓ | 0.2 `/app/documents` row |
| 44 | `/app/admin` | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | **RETIRED (3.2 Q6)** — hard 404; no role access. Catch-all serves `NotFound`. |
| 45 | `/app/admin/roadmap` | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | 2.4 Q2 `<RouteGuard platform-admin>`; 0.2 `/app/admin/*` row |
| 46 | `/app/admin/users` | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | 2.4 Q2 `<RouteGuard platform-admin>` |
| 47 | `/app/admin/executive` | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | 2.4 Q2 `<RouteGuard platform-admin>` (2.4 Q4 removes `board-admin` tab entry) |
| 48 | `/app/ai/ingestion` | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | 2.4 Q2 `<RouteGuard platform-admin>` replaces WIP flag; 0.2 `/app/ai/*` row |
| 49 | `/app/platform/controls` | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | 2.4 Q2 `<RouteGuard platform-admin>`; 0.2 `/app/platform/*` row |
| 50 | `/app/vendors` | ✓ | ✓ | ✓ (R + triage; T can expand) | ✓ (T) | ✓ (R) | ✓ | Operations zone |
| 51 | `/app/work-orders` | ✓ | ✓ | ✓ (R + triage; T can expand) | ✓ (T) | ✓ (R) | ✓ | Operations zone |
| 52 | `/app/resident-feedback` | ✓ | ✓ | ✓ (R + triage; T can expand) | ✓ (T) | ✓ (R) | ✓ | Operations zone |
| 53 | `/app/maintenance-schedules` | ✓ | ✓ | ✓ (R + triage; T can expand) | ✓ (T) | ✓ | ✓ | Operations zone — sidebar omits viewer today (see Part 5 D4) |
| 54 | `/app/inspections` | ✓ | ✓ | ✓ (R + triage; T can expand) | ✓ (T) | ✓ | ✓ | Operations zone — sidebar omits viewer today (see Part 5 D4) |
| 55 | `/app/insurance` | ✓ | ✓ | ✓ (R) | ✓ (T) | ✓ (R) | ✓ | 2.3 Q12 + 0.2 matrix inclusion (Insurance not in 0.2 matrix but treated as Operations-adjacent) ⚠️ |
| 56 | `/app/portfolio` | ✓ | ✗ (→ `/app`) | ✗ (→ `/app`) | ✓ | ✓ (R) | ✓ | 0.2 `/app/portfolio` row; 2.3 Q5 role-based redirect for Board Officer + Assisted Board |
| 57 | `/app/community-hub` | ✓ | ✓ | ✓ (R) | ✓ (T) | ✓ (R) | ✓ | 2.3 Q12 — added to 0.2 matrix by Q12 amendment ⚠️ (matrix row not explicitly present; inferred from Q12 coverage) |
| 58 | `/app/amenities` | ✓ | ✓ | ✓ (R) | ✓ (T) | ✓ (R) | ✓ | 2.3 Q12 amendment |
| 59 | `/app/announcements` | ✓ | ✓ | ✓ | ✓ (T) | ✗ | ✓ | Communications-adjacent; 0.2 Assisted Board "Announcements ✅ Yes / ✅ Yes" in PM-Managed Default Access Table; sidebar excludes viewer (see D5) |
| 60 | `/app/help-center` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 2.3 Q12 — "all roles, no gate" ⚠️ zone-tag comment ambiguity |
| 61 | `/app/settings` | ✓ | ✓ | ✗ | ✗ (unless T) | ✗ | ✓ | 2.3 Q6 `<RouteGuard roles={["manager","platform-admin","board-officer"]}>`; 0.2 AC 5 + AC 7 + AC 15 |
| 62 | `/app/settings/billing` | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | 2026-04-21 amendment — 4.4 Q6 **Manager-only** (explicitly NOT Board Officer, NOT Assisted Board, NOT PM Assistant, NOT Platform Admin — 4.4 Q6 scope) ⚠️ Note: 4.4 Q6 may intend Platform Admin ✓ too; flagged |
| 63 | `/app/user-settings` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ⚠️ Not in 3.2 canonical table; referenced in task brief as ambiguous — resolved as "all roles" (self-service profile page by convention). Pending confirmation. |
| 64 | `*` (catch-all → NotFound) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Catch-all serves `NotFound` for unmatched paths, including retired `/app/admin` |

**ROUTE_MANIFEST row count: 64** (63 spec rows + 1 catch-all). 11 of these are `(→)` redirects that inherit their destination's gate; 53 are gating targets.

---

## Part 2 — FEATURE_MANIFEST (feature-domain → default access)

Feature domains are the granularity of the PM Toggle Configuration Model (0.2 PM-Managed Default Access Table + 3.1 Q6 PM toggle surface). Each row states the **default** view/write access for Assisted Board and PM Assistant; Manager, Board Officer, and Platform Admin (on their assigned zones) are included for completeness. Viewer mirrors Manager as read-only.

Legend: `V` = view default, `W` = write default, `T` = toggleable via PM config.

| # | Feature domain | manager V/W | board-officer V/W | assisted-board V/W | pm-assistant V/W | viewer V/W | platform-admin V/W | Toggleable? | Source |
|---|---|---|---|---|---|---|---|:-:|---|
| F1 | `financials.reports` | ✓/✓ | ✓/✓ | ✓/✗ | ✓/✓ | ✓/✗ | ✗/✗ | Yes (T) | 0.2 PM-Managed row "Financials — reports & statements" |
| F2 | `financials.budget.annual-approval` | ✓/✓ | ✓/✓ | ✓/✓ (approve only) | ✓/✓ | ✓/✗ | ✗/✗ | Yes | 0.2 row "Budget — annual approval" |
| F3 | `financials.billing` | ✓/✓ | ✓/✓ | ✓/✗ | ✓/✓ | ✓/✗ | ✗/✗ | Yes | 0.2 `/app/financial/*` row (Assisted Board read-only default) |
| F4 | `financials.payments` | ✓/✓ | ✓/✓ | ✓/✗ | ✓/✓ | ✓/✗ | ✗/✗ | Yes | 0.2 `/app/financial/*` |
| F5 | `financials.expenses` | ✓/✓ | ✓/✓ | ✓/✗ | ✓/✓ | ✓/✗ | ✗/✗ | Yes | 0.2 `/app/financial/*` |
| F6 | `financials.foundation` | ✓/✓ | ✓/✓ | ✓/✗ | ✓/✓ | ✓/✗ | ✗/✗ | Yes | 0.2 `/app/financial/*` |
| F7 | `governance.meetings-minutes` | ✓/✓ | ✓/✓ | ✓/✓ | ✓/✓ | ✓/✗ | ✗/✗ | No (write-default yes) | 0.2 row "Meetings & minutes" — full write default |
| F8 | `governance.documents` (bylaws, rules, resolutions) | ✓/✓ | ✓/✓ | ✓/✗ | ✓/✓ | ✓/✗ | ✗/✗ | Yes | 0.2 row "Governance documents" |
| F9 | `governance.violations` | ✓/✓ | ✓/✓ | ✓/✗ (appeals only) | ✓/✓ | ✓/✗ | ✗/✗ | Yes | 0.2 row "Violations — view & appeals" |
| F10 | `governance.board-votes` / `elections` | ✓/✓ | ✓/✓ | ✓/✓ (manage) | ✓/✓ | ✓/✗ | ✗/✗ | No | 0.2 `/app/elections/*` row — Manage default |
| F11 | `operations.maintenance-requests` | ✓/✓ | ✓/✓ | ✓/✗ (view only) | ✓/✓ | ✓/✗ | ✗/✗ | Yes | 0.2 row "Maintenance requests — view only" |
| F12 | `operations.vendor-contracts` | ✓/✓ | ✓/✓ | ✓/✓ (approve only) | ✓/✓ | ✓/✗ | ✗/✗ | Yes | 0.2 row "Vendor contracts — view & approve" |
| F13 | `operations.inspections` | ✓/✓ | ✓/✓ | ✓/✗ (view + triage) | ✓/✓ | ✓/✗ | ✗/✗ | Yes | 0.2 `/app/operations/*` Assisted Board "Read + triage" |
| F14 | `operations.maintenance-schedules` | ✓/✓ | ✓/✓ | ✓/✗ (view + triage) | ✓/✓ | ✓/✗ | ✗/✗ | Yes | 0.2 `/app/operations/*` |
| F15 | `operations.work-orders` | ✓/✓ | ✓/✓ | ✓/✗ (view + triage) | ✓/✓ | ✓/✗ | ✗/✗ | Yes | 0.2 `/app/operations/*` |
| F16 | `operations.resident-feedback` | ✓/✓ | ✓/✓ | ✓/✗ (view + triage) | ✓/✓ | ✓/✗ | ✗/✗ | Yes | 0.2 `/app/operations/*` |
| F17 | `communications.announcements` | ✓/✓ | ✓/✓ | ✓/✓ | ✓/✓ | ✓/✗ | ✗/✗ | No (default yes) | 0.2 row "Announcements" |
| F18 | `communications.inbox` | ✓/✓ | ✓/✓ | ✓/✓ | ✓/✓ | ✓/✗ | ✗/✗ | Yes | 4.1 Q4 amendment (Phase 11 placeholder) |
| F19 | `communications.draft-send` | ✓/✓ | ✓/✓ | ✓/✓ (draft + send) | ✓/✓ | ✓/✗ | ✗/✗ | Yes | 0.2 `/app/communications/*` row |
| F20 | `people.owner-directory` | ✓/✓ | ✓/✓ | ✓/✗ (limited view) | ✓/✓ | ✓/✗ | ✗/✗ | Yes | 0.2 row "Owner directory — limited view" |
| F21 | `people.board-members` | ✓/✓ | ✓/✓ | ✓/✗ | ✓/✓ | ✓/✗ | ✗/✗ | Yes | Inferred from 0.2 `/app/people` row |
| F22 | `reports.dashboards` | ✓/✓ | ✓/✓ | ✓/✗ | ✓/✓ | ✓/✗ | ✗/✗ | Yes | 0.2 row "Reports & dashboards" |
| F23 | `units.management` | ✓/✓ | ✓/✓ | ✗/✗ | ✓/✓ | ✓/✗ | ✗/✗ | **No** (hard ❌ for Assisted Board per 0.2) | 0.2 row "Unit management" + 0.2 `/app/units` (Assisted Board "Read" only) ⚠️ conflict: PM table says ❌/❌, matrix says "Read". Resolved as ✓/✗ (view-only) per matrix. |
| F24 | `documents.publish-portal` | ✓/✓ | ✓/✓ | ✓/✓ (publish) | ✓/✓ | ✓/✗ | ✗/✗ | Yes | 0.2 `/app/documents` Assisted Board "View + publish portal" |
| F25 | `settings.account` | ✓/✓ | ✓/✓ | ✗/✗ | ✓/✓ (T only) | ✗/✗ | ✓/✓ | No for Assisted Board (hard ❌); Yes for PM Assistant | 0.2 AC 5, AC 7, AC 15 |
| F26 | `settings.billing` | ✓/✓ | ✗/✗ | ✗/✗ | ✗/✗ | ✗/✗ | ✗/✗ | No — Manager-only | 4.4 Q6 amendment |
| F27 | `platform.controls` | ✗/✗ | ✗/✗ | ✗/✗ | ✗/✗ | ✗/✗ | ✓/✓ | **No** — never toggleable | 0.2 PM-Managed table "Platform / admin surfaces — not configurable via toggle"; 2.4 Q2 |
| F28 | `platform.admin-users` | ✗/✗ | ✗/✗ | ✗/✗ | ✗/✗ | ✗/✗ | ✓/✓ | No | 2.4 Q2 |
| F29 | `platform.admin-roadmap` | ✗/✗ | ✗/✗ | ✗/✗ | ✗/✗ | ✗/✗ | ✓/✓ | No | 2.4 Q2 |
| F30 | `platform.admin-executive` | ✗/✗ | ✗/✗ | ✗/✗ | ✗/✗ | ✗/✗ | ✓/✓ | No | 2.4 Q2 |
| F31 | `platform.ai-ingestion` | ✗/✗ | ✗/✗ | ✗/✗ | ✗/✗ | ✗/✗ | ✓/✓ | No | 2.4 Q2 |
| F32 | `portfolio.health` | ✓/✓ | ✗/✗ | ✗/✗ | ✓/✓ (T) | ✓/✗ | ✓/✓ | Yes for PM Assistant only | 0.2 `/app/portfolio` row — Board Officer / Assisted Board hard ❌ |
| F33 | `insurance.policies` | ✓/✓ | ✓/✓ | ✓/✗ | ✓/✓ | ✓/✗ | ✗/✗ | Yes | 2.3 Q12 (inferred domain) ⚠️ |
| F34 | `amenities.admin` | ✓/✓ | ✓/✓ | ✓/✗ | ✓/✓ | ✓/✗ | ✗/✗ | Yes | 2.3 Q12 |
| F35 | `community-hub` | ✓/✓ | ✓/✓ | ✓/✗ | ✓/✓ | ✓/✗ | ✗/✗ | Yes | 2.3 Q12 |
| F36 | `help-center` | ✓/✗ | ✓/✗ | ✓/✗ | ✓/✗ | ✓/✗ | ✓/✗ | No | 2.3 Q12 — "all roles, no gate" (read-only informational) |
| F37 | `user-settings.profile` | ✓/✓ | ✓/✓ | ✓/✓ | ✓/✓ | ✓/✓ | ✓/✓ | No — self-service | Inferred self-service profile; not in 0.2 matrix ⚠️ |
| F38 | `associations.context-switcher` | ✓/✓ | ✗/✗ | ✗/✗ | ✓/✓ | ✗/✗ | ✓/✓ | No | 2.3 Q12 (Manager / Platform Admin / multi-assoc PM Assistant only) |
| F39 | `associations.new` | ✓/✓ | ✗/✗ | ✗/✗ | ✗/✗ | ✗/✗ | ✓/✓ | No | Inferred from sidebar footer `platform-admin`-only button + Manager PM usage ⚠️ |

**FEATURE_MANIFEST row count: 39**

---

## Part 3 — Edge cases & ambiguities (⚠️ flagged)

| ID | Route / Domain | Ambiguity | Resolution | ⚠️ |
|---|---|---|---|---|
| A1 | `/app/governance/elections/:id` | Dynamic route — 0.2 lists `/app/elections/*` as `Manage` for Assisted Board, but the route lives under `/app/governance/*`. Existing code has an inline `adminRole !== "viewer"` action gate. | Treat as child of `/app/governance/*` row (inherits full access for operator personas; viewer = read-only via inline action gate). | ⚠️ |
| A2 | `/app/communications/inbox` | Post-lock amendment (2026-04-21). 4.1 Q4 says "Personas: Manager, Board Officer, Assisted Board, PM Assistant, Viewer" — does NOT list Platform Admin. | Added Platform Admin ✓ by extrapolation (Platform Admin operates above customer tiers; has operator session). If 4.1 Q4 intends Platform Admin ✗, reverse. | ⚠️ |
| A3 | `/app/settings/billing` | 4.4 Q6 is explicitly Manager-only. Platform Admin disposition not stated. | Resolved as Platform Admin ✗. 4.4 Q6 "NOT Board Officer, NOT Assisted Board, NOT PM Assistant" — listing doesn't include Platform Admin, so default is ✗. If Platform Admin needs access for tenant billing ops, a separate platform-side billing surface is appropriate (not `/app/settings/billing`). | ⚠️ |
| A4 | `/app/help-center` | 2.3 Q12 says "all roles, no gate" but sidebar/zone-tag comment is ambiguous on whether this is inside a zone or cross-cutting. | Resolved as all roles ✓ (no-gate route). Not subject to any RouteGuard. | ⚠️ |
| A5 | `/app/user-settings` | Not in 3.2 canonical table. Task brief calls it out as "ambiguous zone-tag comment flagged". | Resolved as all roles ✓ (self-service profile management). If this route doesn't exist at all, omit F37 when Phase 9 lands. | ⚠️ |
| A6 | `/app/insurance`, `/app/community-hub`, `/app/amenities` | Not explicitly in 0.2 Persona Boundary Matrix; added via 2.3 Q12 amendment. | Resolved as Operations-zone-default (all operator personas ✓ with Assisted Board read + PM toggle for PM Assistant). | ⚠️ |
| A7 | `/app/new-association` | No 0.2 matrix row. Footer button in sidebar renders only for `platform-admin` (sidebar.tsx:481-488), but Manager must be able to create associations on multi-association accounts. | Resolved as Manager ✓, Platform Admin ✓, all others ✗. Flag for William: verify that Manager actually reaches this page today, or if provisioning is platform-admin-only by design. | ⚠️ |
| A8 | `/app/association-context` | Manager-only per 2.3 Q12 but PM Assistant manages multi-association workloads too. | Resolved as Manager ✓, PM Assistant ✓, Platform Admin ✓, all single-assoc personas ✗. The 2.3 Q12 "Manager only" phrasing predates the 6-persona rename. | ⚠️ |
| A9 | `units.management` feature domain | 0.2 PM-Managed Default Access Table says `Unit management: ❌/❌` but Persona Boundary Matrix shows `/app/units` Assisted Board = `Read`. | Resolved as V:✓ / W:✗ per the matrix (more specific). The PM-Managed table intent is "no unit lifecycle write"; view access is fine. | ⚠️ |
| A10 | `viewer` role on `platform-admin`-owned surfaces | 0.2 §Persona 6 "Viewer capability variant" says viewer scoped to read-only on Platform Admin surfaces. | For the manifest, `viewer` on `/app/platform/*` + `/app/admin/*` + `/app/ai/*` is **✗** unless the user also carries `platform-admin` — since `viewer` is a capability variant, not an independent role. ROUTE_MANIFEST treats pure `viewer` as `read-only-of-Manager` (no platform access). | ⚠️ |
| A11 | Redirect rows inheriting gates | 11 `(→)` redirect rows in ROUTE_MANIFEST don't render UI — they redirect. Do RouteGuards apply to the redirect path or only to the destination? | Resolved: apply RouteGuard at the **destination**; the redirect itself is transparent (it fires `setLocation()` synchronously). This matches how `wip-features.ts` currently works. | ⚠️ |
| A12 | `/app/portfolio` for `viewer` | 0.2 matrix doesn't show a Viewer column. Under 2.3 Q8 working assumption (viewer = read-only-of-Manager), viewer should reach Portfolio. Sidebar array currently includes `viewer`. | Resolved as ✓ (R) for viewer. | ⚠️ |
| A13 | `*` catch-all / NotFound | Is NotFound gated or always visible? | Resolved as all roles ✓. NotFound carries no sensitive content. | ⚠️ |

**Total ⚠️ flags: 13**

---

## Part 4 — Implementation notes

When Phase 9 proper runs (ADR 0b signed off + Phase 0b.2 skeleton in place), `shared/persona-access.ts` should encode the data above as follows. This is a **translation pattern**, not code — Phase 9 owns the implementation.

### Suggested shape

```ts
// shared/persona-access.ts (NOT YET WRITTEN — pattern only)

export type Persona =
  | "manager"
  | "board-officer"
  | "assisted-board"
  | "pm-assistant"
  | "viewer"
  | "platform-admin";

export type AccessMode = "full" | "read-only" | "toggle-gated" | "denied";

export interface RouteManifestEntry {
  path: string;                       // route path, e.g. "/app/financial/billing"
  destinationOf?: string;             // if this is a redirect, the target path
  access: Partial<Record<Persona, AccessMode>>;
  notes?: string;
}

export interface FeatureManifestEntry {
  domain: string;                     // e.g. "financials.reports"
  view: Partial<Record<Persona, AccessMode>>;
  write: Partial<Record<Persona, AccessMode>>;
  toggleable: boolean;
  source: string;                     // 0.2 row / 4.x Q ref
}

export const ROUTE_MANIFEST: RouteManifestEntry[] = [ /* 53 rows from Part 1 */ ];
export const FEATURE_MANIFEST: FeatureManifestEntry[] = [ /* 39 rows from Part 2 */ ];
```

### Translation rules

1. **Rows marked ✓** → `access[persona] = "full"`.
2. **Rows marked ✓ (R)** → `access[persona] = "read-only"`. The consuming code resolves this by also wiring `useIsReadOnly()` (2.3 Q7) at the page level.
3. **Rows marked ✓ (T)** → `access[persona] = "toggle-gated"`. Resolved at runtime by querying the PM toggle state keyed by `(association_id, persona, feature_domain)`.
4. **Rows marked ✗** → `access[persona] = "denied"` (or omit the key — absence is interpreted as denied).
5. **Redirect rows** → store `destinationOf` and defer gating to the destination entry. The `<RouteGuard>` at the destination is what actually denies.
6. **RETIRED routes** (`/app/admin`) → not present in `ROUTE_MANIFEST`. The catch-all renders `NotFound` with no entry needed.

### Consumer pattern

- `<RouteGuard path={...}>` looks up `ROUTE_MANIFEST` by path, pulls the current user's persona, and returns `<NotFound />` if `access[persona] === "denied"` or `undefined`.
- `useIsReadOnly()` checks the destination's `access` mode; if `read-only` or if `toggle-gated` with the toggle in read-only state, returns `true`.
- Sidebar visibility is derived from the same `ROUTE_MANIFEST` — the existing `roles: [...]` arrays in `app-sidebar.tsx` are retired in favor of manifest lookups (Phase 9 refactor, not part of this artifact).

### Ordering / file layout

Phase 9 ships in two commits:
1. `shared/persona-access.ts` with both manifests + types + helper functions (`canAccess(path, persona)`, `isReadOnly(path, persona)`, `isToggleable(domain)`).
2. Consumer migration: `<RouteGuard>` wrapper, `useIsReadOnly()` hook wired to the manifest, `app-sidebar.tsx` filter refactor.

---

## Part 5 — Verification against existing code

### Current code inspection

Checked `client/src/lib/wip-features.ts` and `client/src/components/app-sidebar.tsx` for agreement with manifest rows above.

**`wip-features.ts` (canAccessWipRoute):**
```ts
const wipRouteRoleAllowlist: Record<string, AdminRole[]> = {
  "/app/ai/ingestion": ["platform-admin"],
};
```
Agrees with ROUTE_MANIFEST row 48 (`/app/ai/ingestion` — Platform Admin only). No discrepancy.

**`app-sidebar.tsx` role arrays — spot checks:**

| # | Discrepancy | Manifest says | Sidebar says | Interpretation |
|---|---|---|---|---|
| D1 | `/app/financial/*` includes `platform-admin` in sidebar | ✓ for `platform-admin` | Sidebar includes `"platform-admin"` | 0.2 matrix shows Platform Admin `❌` on `/app/financial/*` (platform admin doesn't own customer content). **The sidebar array is wrong** per 0.2 §Persona 6 "What they do not own — Customer association content." ⚠️ |
| D2 | `/app/governance/elections/:id` inline `adminRole !== "viewer"` gate | `viewer` = ✓ (R) (read-only) | Page file gates write actions with `!== "viewer"` | Consistent — the manifest's read-only mode is implemented via that inline check. No discrepancy, but in Phase 9 this should migrate to `useIsReadOnly()`. |
| D3 | `/app/portfolio` sidebar array includes `viewer` | ✓ (R) | `["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"]` — sidebar includes Board Officer + Assisted Board | **Sidebar is wrong** per 0.2 — Board Officer and Assisted Board are `❌ Redirected to /app`. The redirect at `App.tsx:300-302` enforces this, but the sidebar should not list them. Flagged in 2.3 Q5. ⚠️ |
| D4 | `/app/maintenance-schedules` + `/app/inspections` sidebar arrays exclude `viewer` | ✓ (R) for viewer | Sidebar: `"platform-admin","board-officer","assisted-board","pm-assistant","manager"` (no viewer) | Minor inconsistency — viewer omitted from these two Operations routes but included in others (Vendors, Work Orders, Feedback). Probably an oversight in sidebar construction. ⚠️ |
| D5 | `/app/announcements` sidebar excludes `viewer` | ✗ for viewer | Sidebar: `"platform-admin","board-officer","assisted-board","pm-assistant","manager"` | **Agrees with manifest** — viewer does not see Announcements. No discrepancy. |
| D6 | Platform sidebar includes `{ title: "Owner Portal", url: "/portal", roles: ["platform-admin"] }` | — | Sidebar has it | 2.4 Q5 resolution says **remove this entry**. Manifest omits `/portal` entirely from `ROUTE_MANIFEST` (Portal is out of Phase 9 scope). The sidebar entry is scheduled for removal in Layer 3 per 2.4 Q5 ACs. ⚠️ |
| D7 | `/app/platform/controls` sidebar group gated `["platform-admin"]` | ✗ for all non-platform-admin | Sidebar: `["platform-admin"]` | Agrees. No discrepancy. |
| D8 | `/app/admin/roadmap` sidebar gated `["platform-admin"]` | Only Platform Admin ✓ | Sidebar: `["platform-admin"]` | Agrees. No discrepancy. Note: route file `App.tsx:260` has NO route guard today — gate is sidebar-only. 2.4 Q2 adds `<RouteGuard>`. |
| D9 | `/app/ai/ingestion` sidebar gated `["platform-admin"]` | Only Platform Admin ✓ | Sidebar: `["platform-admin"]` + WIP allowlist in `wip-features.ts` | Agrees. No discrepancy. |
| D10 | `/app/settings` in sidebar footer has no `roles` array | 2.3 Q6: `manager`, `platform-admin`, `board-officer` | Footer button — no gating; visible to all roles | **Sidebar is wrong** — Assisted Board should not see Settings (0.2 AC 5). 2.3 Q6 lists this as a bug to fix in Layer 3. ⚠️ |
| D11 | `/app/financial/*` sidebar includes `"assisted-board"` without read-only indicator | ✓ (R) for Assisted Board | Sidebar includes without distinction | Sidebar is correct for visibility; read-only enforcement is the page-level `useIsReadOnly()` job, not the sidebar's. No discrepancy. |

### Summary of discrepancies

- **5 concrete discrepancies (D1, D3, D4, D6, D10)** where current code behavior contradicts the locked 0.2 / 2.3 / 2.4 matrix. All are already tracked as bugs in Layer 2 / Layer 3 decision docs:
  - D1: `/app/financial/*` sidebar lists `platform-admin` — should NOT (customer content). Not currently flagged; **new discrepancy surfaced by this audit**.
  - D3: `/app/portfolio` sidebar lists `board-officer` + `assisted-board` — 2.3 Q5 flags this as a bug (already tracked).
  - D4: `/app/maintenance-schedules`, `/app/inspections` omit `viewer` — minor, probably oversight; new discrepancy.
  - D6: `/portal` launcher inside platform sidebar group — 2.4 Q5 flags as bug (already tracked).
  - D10: `/app/settings` footer button has no role gate — 2.3 Q6 flags as bug (already tracked).
- **2 of 5 (D1, D4) are net-new discrepancies** surfaced by constructing this manifest — they need William's review.
- **3 of 5 (D3, D6, D10) are already tracked** for Layer 3 implementation follow-up.

---

## Summary (for caller)

- **ROUTE_MANIFEST row count: 64** (53 gating targets + 11 redirect aliases + 1 catch-all)
- **FEATURE_MANIFEST row count: 39**
- **⚠️ flag count: 13** (Part 3 edge cases) + **5 code discrepancies** (Part 5, of which 2 are net-new: D1 and D4)
- **File path:** `/home/runner/workspace/docs/projects/platform-overhaul/implementation-artifacts/phase-9-persona-access-manifest-data.md`
- **Next step:** ADR 0b sign-off + Phase 0b.2 skeleton, then Phase 9 proper encodes this data into `shared/persona-access.ts`.
