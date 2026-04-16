# Handoff: Task 0 — Vitest Test Infrastructure Setup

**Task ID:** (PPM blocked — `project_id` column missing in executor API; tracked locally)
**Product/Repo:** williamruiz1/YourCondoManager
**Lane:** 3B (approved by founder 2026-04-16)
**Governing spec:** 3.3 Q4 (parity harness requires test infrastructure)
**Branch:** `feature/vitest-infrastructure`

---

## Objective

Stand up a production-grade Vitest test suite for the YCM monorepo. This is the foundation for the 3.3 Q4 parity harness and all future test work. It must be robust — not minimal.

## Context

- The repo currently has **no test runner** (AGENTS.md: "There is no automated test runner configured yet").
- One test file exists: `tests/signup-role-assignment.ts` (from commit `aa30fa2`) — it's a standalone TypeScript file, not integrated with any test runner.
- The 3.3 Q4 parity harness requires Tier 1 (exhaustive role×route for security boundaries), Tier 2 (happy-path per zone), and Tier 3 (sidebar smoke per persona) — all of which need a working test environment with React component rendering, route-guard assertion, and role/auth mocking.
- Stack: React 18 + TypeScript + Vite 7 (client), Express 5 + TypeScript (server), Drizzle ORM (shared schema).

## Acceptance Criteria

- [ ] AC-1: `vitest` is installed and configured with separate configs for:
  - **Client tests** (`vitest.config.client.ts`): jsdom environment, React/JSX transform, path aliases (`@/` → `client/src/`, `@shared/` → `shared/`), CSS module stubbing
  - **Server tests** (`vitest.config.server.ts`): Node environment, path aliases, access to `server/` and `shared/`
  - **Shared tests** (covered by server config or a combined config)
- [ ] AC-2: `package.json` scripts added:
  - `npm run test` — runs all tests
  - `npm run test:client` — runs client tests only
  - `npm run test:server` — runs server tests only
  - `npm run test:watch` — runs in watch mode
  - `npm run test:coverage` — runs with coverage reporting
- [ ] AC-3: Test utility module at `tests/utils/auth-helpers.ts` providing:
  - `mockAdminSession(role: AdminRole)` — creates a mock authenticated session for a given role (uses the canonical `AdminRole` from `shared/schema.ts`)
  - `mockPortalSession(portalRole: string)` — creates a mock portal session
  - `mockUnauthenticated()` — creates a session with no auth
  - All six personas from 0.2 boundary matrix covered: `platform-admin`, `manager`, `board-officer`, `assisted-board`, `pm-assistant`, `viewer`
  - Plus `owner` portal persona
- [ ] AC-4: Test utility module at `tests/utils/route-guard-helpers.ts` providing:
  - `assertRouteAllowed(route: string, role: AdminRole)` — asserts a role can access a route
  - `assertRouteBlocked(route: string, role: AdminRole)` — asserts a role is blocked from a route
  - `renderWithAuth(component: React.ReactNode, role: AdminRole)` — wraps component in auth context with the given role
  - These helpers should work with the existing `canAccessTab` / `canAccessWipRoute` functions and the future `<RouteGuard>` component
- [ ] AC-5: Test utility module at `tests/utils/sidebar-helpers.ts` providing:
  - `renderSidebar(role: AdminRole)` — renders `AppSidebar` with a mocked auth session for the given role
  - `getVisibleNavItems(role: AdminRole)` — returns the list of nav items visible to a given role
  - `assertNavItemVisible(role: AdminRole, label: string)` — asserts a nav item is visible
  - `assertNavItemHidden(role: AdminRole, label: string)` — asserts a nav item is not visible
- [ ] AC-6: The existing `tests/signup-role-assignment.ts` is migrated into the new test framework and passes as a Vitest test.
- [ ] AC-7: A smoke test file at `tests/smoke.test.ts` proves the infrastructure works:
  - One client test that renders a React component
  - One server test that imports from `server/`
  - One shared test that imports from `shared/schema.ts`
  - All three pass with `npm run test`
- [ ] AC-8: `npm run check` still passes (no new TypeScript errors introduced)
- [ ] AC-9: Test utilities import `AdminRole` and `adminUserRoleEnum` from `shared/schema.ts` — they do not define their own role types

## Constraints

- Do NOT install Jest. Use Vitest only (it's Vite-native and matches the existing build tooling).
- Do NOT install Playwright or Cypress — this is unit/integration test infrastructure, not E2E.
- Do NOT mock the database — test utilities should mock the auth session/context layer, not storage. DB-dependent tests will come later.
- Do NOT change any existing application code. This task adds test infrastructure only.
- Pre-existing TypeScript failures (`IStorage` mismatch, `matchAll` iterator) are known — do not fix them.
- Install `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event` for React component testing.
- Install `jsdom` for the client test environment.

## Required Proof

- PR URL with all 9 acceptance criteria verified
- `npm run test` output showing all tests pass
- `npm run check` output showing no new TypeScript errors

## Scope Boundary

This task sets up test infrastructure and utilities ONLY. It does NOT:
- Write the parity harness tests (that's Task 2)
- Write zone-specific tests (those come with each zone landing)
- Add CI/CD test pipeline (future work)
- Change any application code
