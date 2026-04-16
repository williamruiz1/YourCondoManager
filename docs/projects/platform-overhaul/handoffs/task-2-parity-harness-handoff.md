# Handoff: Task 2 — Build Parity Harness (Tier 1/2/3 Tests)

**Task ID:** (PPM blocked — `project_id` column missing in executor API; tracked locally)
**Product/Repo:** williamruiz1/YourCondoManager
**Lane:** 3A (clear AC, single-repo, test-only — no application code changes)
**Governing spec:** 3.3 Q4 (SPEC LOCKED, 2026-04-16)
**Branch:** `feature/parity-harness`
**Depends on:** Task 0 (Vitest infrastructure) — MERGED via PR #8

---

## Objective

Build the 3.3 Q4 parity harness — a risk-weighted test suite that validates the current role-gating behavior before the RouteGuard rollout begins. The harness has three tiers: Tier 1 (exhaustive security-boundary tests), Tier 2 (happy-path per zone), and Tier 3 (sidebar smoke per persona). All Tier 1 + at least one Tier 2 per zone must pass before any zone landing PR merges (3.3 Q4 AC-Q4-6).

## Context

- **Test infrastructure** is in place (Task 0, PR #8 merged). Vitest configured with jsdom + node environments, path aliases, CSS stubbing. Auth helpers (`tests/utils/auth-helpers.ts`), route-guard helpers (`tests/utils/route-guard-helpers.ts`), and sidebar helpers (`tests/utils/sidebar-helpers.ts`) are ready.
- **3.3 Q4 decision (SPEC LOCKED):** Risk-weighted coverage. Not every-persona × every-route — only security boundaries get exhaustive treatment.
- **Six operator personas:** `platform-admin`, `manager`, `board-officer`, `assisted-board`, `pm-assistant`, `viewer`
- **One portal persona:** `owner` (separate session type — portal access, not admin)
- **0.2 Persona Boundary Matrix** defines which persona can access which surface. This is the canonical truth for all test assertions.
- **3.2 Canonical Route Table** lists all 61 `/app/*` routes with their status and gating notes.

## The Six Personas and Their Access Zones

Per 0.2 boundary matrix:

| Persona | Role Value | Access Scope |
|---|---|---|
| Manager | `manager` | Full `/app` except `/app/platform/*`, `/app/admin/*`, `/app/ai/*` |
| Board Officer | `board-officer` | Manager-equivalent EXCEPT no `/app/portfolio`, no Platform/Admin/AI |
| Assisted Board | `assisted-board` | Scoped subset: Home, Financials (read-only), Governance, Communications, Documents, Operations (limited). No Settings, no Portfolio, no Platform |
| PM Assistant | `pm-assistant` | Manager-subset configured by Manager. No Settings (unless granted), no Platform. Defaults to Manager-minus-Settings-minus-Platform |
| Viewer | `viewer` | Manager-equivalent visibility, read-only (no write actions). No Platform |
| Platform Admin | `platform-admin` | `/app/platform/*`, `/app/admin/*`, `/app/ai/*`, Home. Nothing else |
| Owner (portal) | `owner` | `/portal/*` only. Zero `/app/*` access |

## Platform-Admin-Only Routes (Tier 1 — Exhaustive)

These routes must return `true` ONLY for `platform-admin`:

| Route | Handler | Gate Source |
|---|---|---|
| `/app/platform/controls` | `PlatformControlsPage` | 2.4 Q2 |
| `/app/admin/roadmap` | `RoadmapPage` | 2.4 Q2 |
| `/app/admin/users` | `AdminUsersPage` | 2.4 Q2 |
| `/app/admin/executive` | `ExecutivePage` | 2.4 Q2 |
| `/app/ai/ingestion` | `AiIngestionPage` | 2.4 Q2 |

## Zone → Representative Routes (Tier 2 — Happy Path)

Per 1.1 zone taxonomy and 3.2 route table:

| Zone | Representative Route | Expected Personas |
|---|---|---|
| Home | `/app` | All six admin personas (not portal Owner) |
| Financials | `/app/financial/billing` | manager, board-officer, assisted-board (read-only), pm-assistant, viewer |
| Operations | `/app/work-orders` | manager, board-officer, pm-assistant, viewer |
| Governance | `/app/governance` | manager, board-officer, assisted-board, viewer |
| Communications | `/app/announcements` | manager, board-officer, assisted-board, pm-assistant, viewer |
| Platform | `/app/platform/controls` | platform-admin only |
| Settings | `/app/settings` | manager, board-officer, platform-admin |

## Acceptance Criteria

### Tier 1 — Exhaustive Security Boundary Tests

- [ ] AC-1: **Platform-admin gate exhaustive test.** File: `tests/parity/tier1-platform-gates.test.ts`. For each of the 5 platform-admin-only routes (`/app/platform/controls`, `/app/admin/roadmap`, `/app/admin/users`, `/app/admin/executive`, `/app/ai/ingestion`), test ALL six personas:
  - `platform-admin` → ALLOWED
  - `manager` → BLOCKED
  - `board-officer` → BLOCKED
  - `assisted-board` → BLOCKED
  - `pm-assistant` → BLOCKED
  - `viewer` → BLOCKED
  - Total: 5 routes × 6 personas = 30 assertions
  - Use `assertRouteAllowed` / `assertRouteBlocked` from `tests/utils/route-guard-helpers.ts`

- [ ] AC-2: **PM Assistant exclusion test.** File: `tests/parity/tier1-pm-assistant-exclusions.test.ts`. Verify `pm-assistant` is excluded from:
  - `/app/settings` (unless explicitly granted by toggle — default is BLOCKED)
  - `/app/platform/controls`, `/app/admin/*`, `/app/ai/*` (always BLOCKED, regardless of toggle)
  - `/app/portfolio` (BLOCKED — PM Assistant is not multi-association by default)

- [ ] AC-3: **Owner portal isolation test.** File: `tests/parity/tier1-portal-isolation.test.ts`.
  - Assert that a portal session (`mockPortalSession("owner")`) has NO access to any `/app/*` route.
  - Assert that an admin session (any of the six roles) has NO access to any `/portal/*` route.
  - Test at least 3 representative `/app/*` routes and 3 representative `/portal/*` routes.

### Tier 2 — Happy-Path Per Zone

- [ ] AC-4: **Zone happy-path tests.** File: `tests/parity/tier2-zone-happy-paths.test.ts`. For each of the 7 zones (Home, Financials, Operations, Governance, Communications, Platform, Settings), test ONE representative route with the two primary personas that should access it:
  - Home (`/app`) — manager + board-officer → ALLOWED
  - Financials (`/app/financial/billing`) — manager + board-officer → ALLOWED; platform-admin → BLOCKED
  - Operations (`/app/work-orders`) — manager + board-officer → ALLOWED; platform-admin → BLOCKED
  - Governance (`/app/governance`) — manager + board-officer → ALLOWED; platform-admin → BLOCKED
  - Communications (`/app/announcements`) — manager + board-officer → ALLOWED; platform-admin → BLOCKED
  - Platform (`/app/platform/controls`) — platform-admin → ALLOWED; manager → BLOCKED
  - Settings (`/app/settings`) — manager + board-officer → ALLOWED; assisted-board → BLOCKED

- [ ] AC-5: **Viewer read-only assertion.** In the Tier 2 test file, add a test that confirms `viewer` can ACCESS Financials, Operations, Governance, and Communications zones (visibility — same as Manager), but document that write-action enforcement is a UI-level concern tested separately in zone landings.

### Tier 3 — Sidebar Smoke Per Persona

- [ ] AC-6: **Sidebar visibility test.** File: `tests/parity/tier3-sidebar-smoke.test.ts`. For ALL six admin personas, assert that the sidebar renders ONLY the expected nav items per the `ROLE_VISIBLE_ITEMS` map in `tests/utils/sidebar-helpers.ts`. Use `getVisibleNavItems(role)` and `assertNavItemVisible` / `assertNavItemHidden`.
  - `manager` — sees everything except Platform Controls, Admin Roadmap, AI Ingestion
  - `board-officer` — sees everything except Platform Controls, Admin Roadmap, AI Ingestion, Portfolio Health, Associations
  - `assisted-board` — sees only: Home, Financials, Governance, Communications, Documents, Operations
  - `pm-assistant` — sees everything except Platform Controls, Admin Roadmap, AI Ingestion, Settings
  - `viewer` — sees everything except Platform Controls, Admin Roadmap, AI Ingestion (same as Manager)
  - `platform-admin` — sees only: Home, Platform Controls, Admin Roadmap, AI Ingestion

### Infrastructure

- [ ] AC-7: **Route config data file.** Create `tests/fixtures/boundary-matrix.ts` that exports:
  - `PLATFORM_ADMIN_ONLY_ROUTES`: string array of the 5 platform-only routes
  - `ZONE_ROUTES`: record mapping zone name → representative route + allowed personas
  - `PORTAL_ROUTES`: string array of representative `/portal/*` routes for isolation tests
  - All data derived from 0.2 boundary matrix and 3.2 route table — NOT from the live application code. This is the spec-derived truth that the tests assert against.

- [ ] AC-8: **npm run test passes.** All new parity harness tests pass alongside existing tests (smoke + signup role assignment from Task 0).

- [ ] AC-9: **npm run check passes.** No new TypeScript errors.

- [ ] AC-10: **Test count summary.** The PR description includes a count: total tests, Tier 1 count, Tier 2 count, Tier 3 count.

## Constraints

- Do NOT modify any application code. This task adds test files only.
- Do NOT import or depend on live application components (no importing from `client/src/App.tsx` or `client/src/components/app-sidebar.tsx`). The parity harness tests against a spec-derived boundary matrix, not the live implementation. This is intentional — when the RouteGuard rollout changes the implementation, the harness stays stable.
- Pre-existing TypeScript failures (`IStorage` mismatch, `matchAll` iterator) are known — do not fix them.
- The `renderWithAuth` and `renderSidebar` functions in test utils are currently placeholders (they return from static maps, not real component renders). This is expected — the static-map assertions are the correct Tier 1-3 behavior. Real component rendering tests come with each zone landing (Task 3+).
- Route-guard assertions currently use the `routeConfig` map passed as an argument (see `route-guard-helpers.ts`). The `boundary-matrix.ts` fixture IS the route config. Tests call `assertRouteAllowed(route, role, BOUNDARY_MATRIX)`.

## Required Proof

- PR URL with all 10 acceptance criteria verified
- `npm run test` output showing all tests pass with total count
- `npm run check` output showing no new TypeScript errors
- Test count breakdown: Tier 1 / Tier 2 / Tier 3

## Scope Boundary

This task builds the parity harness ONLY. It does NOT:
- Implement the `<RouteGuard>` component (that's each zone landing, Tasks 3-7)
- Modify `canAccessTab` or `canAccessWipRoute` (that's 3.3 Q3/Q5)
- Change sidebar rendering logic (that's 3.1/3.3 Q5)
- Add real component rendering tests (those come with zone landings when the real auth context is available)
- Write observability checks (that's 3.3 Q11, done manually post-deploy)
