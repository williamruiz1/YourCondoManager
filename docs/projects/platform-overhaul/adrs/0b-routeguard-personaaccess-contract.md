---
title: "ADR 0b — RouteGuard + persona-access contract"
status: ACCEPTED
author: Claude (Phase 0b.1 drafting agent)
accepted_by: William
plan_phase: 0b.1
supersedes: none
superseded_by: none
---

# ADR 0b — RouteGuard + persona-access contract

## Status

**ACCEPTED** by William. All 5 open questions resolved (OQ-1 through OQ-5: **Option A across the board**). Phase 0b.2 stub implementation is unblocked.

## Context

The YCM Platform Overhaul landed its strategic decisions in Layers 0–3 and now begins the code-migration phase. Two symbols sit on the critical path for every downstream phase:

- `<RouteGuard>` — the React component that wraps every sensitive `/app/*` route and enforces the 0.2 Persona Boundary Matrix at render time.
- `shared/persona-access.ts` — the single module that exports the persona-to-route access manifest, the persona-to-feature access manifest, the `canAccess` predicate, and the `usePersonaToggles` hook. Both the sidebar (3.1 Q9) and `<RouteGuard>` (2.3 Q9) derive their visibility and gating from this one module.

These two symbols are consumed by:

- **Phase 0b.2** — scaffolds stub implementations that match this ADR exactly.
- **Phase 9** — populates `ROUTE_MANIFEST` + `FEATURE_MANIFEST`, wires `usePersonaToggles` to `tenant_configs` per 3.1 Q6, and ships the real `canAccess` logic.
- **Phase 10** — writes the parity harness per 3.3 Q4. Tier 1 iterates `ROUTE_MANIFEST` cells; Tier 3 renders the real sidebar and asserts SUBSET-RENDER agreement with `<RouteGuard>`.
- **Phase 11** — rewrites `AppSidebar` to import `canAccess` from this module; eliminates the four parallel `AdminRole` declarations and the inline `roles: [...]` literals.
- **Phases 12–16** — each zone PR (Financials → Operations → Governance → Communications → Platform, per 3.3 Q5) wraps every route in `<RouteGuard route="...">…</RouteGuard>`.

Freezing these signatures now prevents cascading rework. If the shape of `RouteGuardProps` changes after Phase 11, every zone PR in Phases 12–16 must revise its route wrappers. If `canAccess` changes signature, the parity harness and the sidebar must both revise. If `usePersonaToggles` changes its return type, Phase 9's `tenant_configs` integration and the sidebar's `assisted-board` / `pm-assistant` filtering must both revise.

This ADR therefore locks contract surface only. It does NOT lock implementation (that is Phase 9 scope), route-table content (that is 3.2's locked artifact), or persona-matrix data (that is 0.2's locked artifact).

## Decision — `<RouteGuard>` component contract

### File location

`client/src/components/RouteGuard.tsx`

### TypeScript signature

```typescript
// client/src/components/RouteGuard.tsx
import type { ReactNode } from "react";

export interface RouteGuardProps {
  /**
   * Canonical route path from the 3.2 route table.
   * MUST be a literal string present as a key in ROUTE_MANIFEST.
   * Examples: "/app", "/app/financial/billing", "/app/admin/users"
   */
  route: string;

  /**
   * The page content to render when the current admin role is
   * resolved AND canAccess(role, route) === true.
   */
  children: ReactNode;

  /**
   * Optional custom fallback rendered when the role is resolved AND
   * canAccess(role, route) === false. Default behavior (no fallback
   * provided) is a navigation to "/app".
   */
  fallback?: ReactNode;

  // NOTE: RouteGuard does NOT accept a `role` prop.
  // Role is read from the auth session — see "Auth resolution" below.
  // NOTE: RouteGuard does NOT accept a `roles` array.
  // Access is derived from ROUTE_MANIFEST via canAccess().
}

export function RouteGuard(props: RouteGuardProps): JSX.Element | null;
```

Notes on the signature:

- `JSX.Element | null` — the return type admits `null` because the loading-state contract (below) requires rendering `null` during auth resolution. A non-null return is the steady-state.
- `children: ReactNode` — not `React.ReactElement`. A route body may be a fragment or a lazy-loaded component; we do not over-constrain.
- `fallback?: ReactNode` — optional; same typing rationale.

### Auth resolution

RouteGuard reads the current admin role from the existing auth-session query, **not** from a new context injected by consumers. The existing shape (see `client/src/App.tsx:91-101, 909-917, 1041`) is:

```typescript
type AuthSession = {
  authenticated: boolean;
  user?: { email?: string | null };
  admin?: {
    id: string;
    email: string;
    role: AdminRole;
  } | null;
};

// Hook read path:
const { data: authSession } = useQuery<AuthSession | null>({
  queryKey: ["/api/auth/me", "session"],
  // …
});
const adminRole: AdminRole | null = authSession?.admin?.role ?? null;
```

Because `client/src/contexts/AuthContext.tsx` does not currently exist (there is no `client/src/contexts/` directory), RouteGuard has two choices in Phase 0b.2:

- **Option 1 (preferred).** Consume the existing query via a thin `useAdminRole()` hook (new, co-located in `RouteGuard.tsx` or a neighbor file) that wraps the `useQuery<AuthSession>` call already present in `App.tsx:909`. This reuses the query cache and keeps the single subscription point.
- **Option 2.** Introduce a minimal `AuthContext.Provider` around `WorkspaceShell` that exposes `{ adminRole, authResolved }`. This centralizes the subscription but requires Phase 0b.2 to add a provider wrapper.

> **OPEN QUESTION FOR WILLIAM — OQ-1.** Option 1 vs Option 2. Phase 0b.1 recommends Option 1 (reuse existing query; thin hook) to minimize surface area and because `react-query` already deduplicates subscribers. Option 2 is cleaner if we anticipate other session-derived values beyond `adminRole` within the next two phases. This ADR proposes Option 1 as the default unless William decides otherwise at sign-off.

Either option MUST expose a three-state result to RouteGuard:

- `undefined` / loading — the auth query has not yet returned.
- `AdminRole` — resolved, authenticated operator session.
- `null` — resolved, unauthenticated (or `admin` is nullish).

### Loading-state contract

Per 3.3 Q3 null-role strict-false and the derived RouteGuard behavior:

- If the role is `undefined` OR the auth query is still loading (i.e., `authResolved === false`), RouteGuard renders `null`. Not children. Not fallback. Not a spinner.
- If the role is resolved to `null` (authenticated session with no admin, or unauthenticated), RouteGuard treats this as "no access" and follows the redirect behavior below. This is the canonical interpretation of 3.3 Q3: `canAccess(null, route) === false`.
- Rendering `null` during loading is deliberate. The shell already renders a loading shimmer per 3.1 Q6 AC 28 (sidebar loading skeleton). RouteGuard flushes to its steady-state render as soon as `authResolved === true`.

The loading-state contract for RouteGuard and the sidebar MUST agree: both derive from the same auth-session subscription. The sidebar renders `null` (no nav items) during loading per 3.3 Q3 AC-Q3-2; RouteGuard renders `null` during loading. Neither flashes protected content.

### Redirect behavior

- If role is resolved AND `canAccess(role, route) === false`:
  - If `fallback` prop is provided, render `fallback`.
  - Else, perform a client-side navigation to `/app`. Implementation uses `wouter`'s `useLocation` `navigate(...)` call inside a `useEffect`; the render returns `null` during the redirect tick.
- Preserving the attempted URL for post-login return is OUT OF SCOPE for 0b. Phase 11 or Phase 12 may revisit.

### Render behavior

- If role is resolved AND `canAccess(role, route) === true`, render `{children}` unchanged. RouteGuard adds no wrapper element, no layout chrome, and no props to children. It is transparent.

## Decision — `shared/persona-access.ts` exports

### File location

`shared/persona-access.ts`

### TypeScript signature

```typescript
// shared/persona-access.ts

// -----------------------------------------------------------------------
// AdminRole re-export
// -----------------------------------------------------------------------
//
// The canonical enum lives at shared/schema.ts:161:
//   export const adminUserRoleEnum = pgEnum("admin_user_role", [
//     "platform-admin", "board-officer", "assisted-board",
//     "pm-assistant", "manager", "viewer",
//   ]);
//
// There is not currently a TypeScript `AdminRole` type exported from
// shared/schema.ts — only the Drizzle pgEnum. Phase 0b.2 adds this
// derived type alongside the enum:
//
//   export type AdminRole = (typeof adminUserRoleEnum.enumValues)[number];
//
// persona-access.ts re-exports it so consumers import from one place.

export { type AdminRole } from "./schema";

// -----------------------------------------------------------------------
// Route manifest
// -----------------------------------------------------------------------
//
// Keys = canonical route paths from the 3.2 route table
// (e.g., "/app", "/app/financial/billing", "/app/admin/users").
// Values = readonly array of AdminRole values permitted on that route.
//
// ROUTE_MANIFEST is the source of truth for both:
//   (a) <RouteGuard route={...}> accessibility, and
//   (b) sidebar item visibility (3.1 Q9).

export type RouteManifest = Readonly<Record<string, readonly AdminRole[]>>;

export const ROUTE_MANIFEST: RouteManifest;

// -----------------------------------------------------------------------
// Feature manifest
// -----------------------------------------------------------------------
//
// Keys = feature-domain IDs from the 0.2 PM-Managed Default Access Table
// (e.g., "financials.reports", "governance.meetings", "operations.vendors").
// Values = readonly array of AdminRole values with DEFAULT view access.
//
// FEATURE_MANIFEST encodes the static persona-to-feature defaults. The
// PM toggle state at runtime (per 3.1 Q6) layers on top via
// usePersonaToggles() and is not encoded here. Phase 9 populates this
// manifest from the 0.2 PM-Managed Default Access Table.

export type FeatureManifest = Readonly<Record<string, readonly AdminRole[]>>;

export const FEATURE_MANIFEST: FeatureManifest;

// -----------------------------------------------------------------------
// canAccess — pure predicate
// -----------------------------------------------------------------------
//
// Returns true iff `role` is a non-null/undefined AdminRole AND the
// route is present in ROUTE_MANIFEST AND the role is in the manifest's
// role list for that route. Returns false in all other cases, including
// when `route` is absent from ROUTE_MANIFEST (strict default-deny).
//
// Null-role strict-false (3.3 Q3): canAccess(null, route) === false
// and canAccess(undefined, route) === false ALWAYS.
//
// Phase 0b.2 stubs this to `return false` (or an empty-manifest lookup
// that yields false). Phase 9 ships the real logic.

export function canAccess(
  role: AdminRole | null | undefined,
  route: string,
): boolean;

// -----------------------------------------------------------------------
// usePersonaToggles — runtime toggle hook
// -----------------------------------------------------------------------
//
// Returns the per-persona feature-toggle state for the current auth
// session and active association context. Implementation reads from
// `tenant_configs` (3.1 Q6) in Phase 9. In the Phase 0b skeleton,
// returns an empty PersonaToggleState (no features enabled — all
// feature-domain lookups return undefined).
//
// The hook signature is parameterless at the contract level; it reads
// the active association ID and current adminRole from the auth/session
// subscription internally. This decouples call sites from having to
// plumb those values. See 3.1 Q6 — the Phase 9 implementation may use
// React Query keyed on (activeAssociationId, adminRole); that key is
// an implementation detail, not part of the public contract.

export function usePersonaToggles(): PersonaToggleState;

export interface PersonaToggleState {
  /**
   * Feature-domain ID → boolean.
   * true  = enabled (visible/allowed) for the current persona + association.
   * false = explicitly disabled.
   * (key absent) = default — consult FEATURE_MANIFEST for default posture.
   */
  readonly [featureId: string]: boolean;
}
```

Notes on these exports:

- `RouteManifest` and `FEATURE_MANIFEST` are typed `Readonly<Record<...>>` with `readonly AdminRole[]` values. This prevents consumers from mutating the manifest at runtime. The stub in Phase 0b.2 may be `{}` cast to the type; Phase 9 fills it in.
- Every symbol here is exported as a named export — no default exports — to match the repo convention and to keep tree-shaking predictable.
- The module has zero runtime dependencies on React. `usePersonaToggles` is a hook (uses React) but lives in the same file because the contract keeps sidebar, RouteGuard, and toggle evaluation colocated per 3.1 Q9 "single source of truth." Phase 9 may split into a `.tsx` vs `.ts` pair if needed; the public re-export surface does not change.

> **OPEN QUESTION FOR WILLIAM — OQ-2.** `usePersonaToggles()` signature.
> The task prompt specifies a parameterless signature: `usePersonaToggles(): PersonaToggleState`.
> 3.1 Q6 AC-26 and AC-27 specify: `usePersonaToggles(activeAssociationId, adminRole)` — both args explicit.
> Phase 0b.1 proposes the parameterless signature (task-prompt preferred) because (a) every call site would otherwise duplicate the auth+association-context read, (b) the hook already has internal access to both, and (c) this keeps the shared module's public surface uniform with `canAccess`'s own implicit-null-tolerance. William to confirm at sign-off: parameterless (proposed) vs (activeAssociationId, adminRole) (3.1 Q6 literal).

## Decision — SUBSET-RENDER contract

Per 3.1 Q5 (SUBSET-RENDER), 3.3 Q4 (parity harness), and 2.3 Q9 (shared manifest):

- **Invariant 1 — sidebar hides on deny.** If `canAccess(role, route) === false`, the sidebar MUST NOT render a nav entry for `route`. There is no greyed-out, disabled, or visually-locked state. Disallowed items are absent from the DOM.
- **Invariant 2 — RouteGuard renders on allow.** If the sidebar renders a nav entry pointing at `route` for a given role, then `<RouteGuard route="...">…</RouteGuard>` placed around the route's page component MUST render its children for that role.
- **Invariant 3 — parity test gate.** Any violation of Invariants 1 or 2 is a Tier 3 parity-harness failure (3.3 Q4 AC-Q4-5) and blocks zone-landing merges per 3.3 Q9.

The sidebar derives its visibility purely from `canAccess` + `usePersonaToggles` — no inline `roles: [...]` arrays (3.1 Q9 AC-39). RouteGuard derives its accessibility purely from `canAccess` + the `route` prop. Because both read the same `ROUTE_MANIFEST`, SUBSET-RENDER is a natural consequence of the manifest, not a runtime cross-check.

## Decision — Loading-state contract (cross-component)

- **Auth resolving (role is `undefined`, query not yet settled):**
  - Sidebar: renders `null` for the nav tree (loading skeleton may render per 3.1 Q6 AC-28, but no nav items).
  - RouteGuard: renders `null` for its children.
  - Both reach this state via the same auth-session subscription; they flush to steady-state on the same tick. No flicker.

- **Auth resolved to `null` (unauthenticated or `admin: null`):**
  - Sidebar: `canAccess(null, route) === false` for every route → zero nav items rendered.
  - RouteGuard: `canAccess(null, route) === false` → follows redirect behavior (fallback, else navigate to `/app`).
  - The shell dispatch at `App.tsx:1041-1057` already sends unauthenticated `/app/*` requests to `WorkspacePreviewPage`; RouteGuard's redirect is a secondary defense, not the primary one.

- **Auth resolved to a valid `AdminRole`:**
  - Sidebar + RouteGuard evaluate `canAccess(role, route)` synchronously against `ROUTE_MANIFEST`. No async work. No flicker.

## Decision — Testing contract

The Phase 10 parity harness (3.3 Q4) consumes three test utilities that the Phase 0b.2 scaffold stubs out:

- `tests/utils/route-guard-helpers.ts` — exports `renderWithAuth(ui, { role, authResolved? })`. Wraps `ui` in a React subtree where the auth-session query (or `AuthContext`, per OQ-1) is prepopulated with a mock session carrying `admin.role = role`. `authResolved` defaults to `true`. The helper reuses `@testing-library/react`'s `render` and injects a `QueryClientProvider` seeded with the mock session so that `useQuery(["/api/auth/me", "session"])` resolves synchronously.

- `tests/utils/sidebar-helpers.ts` — exports `renderSidebar({ role, authResolved?, activeAssociationId? })`. Renders the real `AppSidebar` component inside a minimal jsdom harness: `QueryClientProvider` seeded per above, `MemoryRouter` from `wouter` (or the project's equivalent) anchored at `/app`, and the same auth-session mock. Returns the `@testing-library/react` result for querying nav items.

- `tests/fixtures/personas.ts` — exports one canonical mock user object per persona. Six operator personas (Manager, Board Officer, Assisted Board, PM Assistant, Platform Admin, Viewer as capability-variant) + one portal persona (Owner). Each fixture includes at minimum `{ id, email, role }` matching the `AuthSession.admin` shape. Assisted Board and PM Assistant fixtures include an `associationId` to exercise the per-association toggle path.

These utilities are Phase 0b.2 deliverables. Phase 10 writes the actual tests against them.

## Non-goals (explicitly out of scope for 0b)

- **Persona manifest data.** `ROUTE_MANIFEST` and `FEATURE_MANIFEST` start as empty objects (or minimal smoke data) in Phase 0b.2. The actual persona-to-route and persona-to-feature mapping derives from 0.2 + 3.2 and is populated in Phase 9.
- **Real `canAccess` logic.** Phase 0b.2 stubs `canAccess` to always return `false` (strict default-deny). Phase 9 writes the actual manifest lookup.
- **Real `usePersonaToggles` logic.** Phase 0b.2 stubs this to return `{}`. Phase 9 wires to `tenant_configs` per 3.1 Q6.
- **`<RouteGuard>` real logic beyond the stub.** Phase 0b.2 may ship a working skeleton (reads auth, calls `canAccess`, redirects on deny) but zone PRs in 12–16 exercise it against real route content.
- **Portal-side guarding.** 3.5 (Owner Portal access boundaries) handles `/portal/*` guarding separately. This ADR is `/app/*` scope only.
- **Feature-flag-gated guards.** No. Once a route is wrapped by `<RouteGuard>`, the guard is always active. No `ROUTE_GUARD_ENABLED` flag. (The `BOARD_SHUNT_ACTIVE` flag per 3.3 Q6 is a separate concern and sits at the shell level, not inside RouteGuard.)
- **Post-login URL preservation.** When RouteGuard redirects an unauthenticated/forbidden user to `/app`, the attempted URL is not preserved. Future phase may revisit.
- **Server-side enforcement.** This ADR is purely client-side UX coherence. The server middleware (`requireAdmin`, `requireAdminRole`) per 2.3 Q1/Q2 remains the authoritative security boundary. `<RouteGuard>` is secondary by design.

## Alternatives considered and rejected

**Alternative A — RouteGuard accepts a `role` prop.**
```tsx
<RouteGuard role={adminRole} route="/app/admin"><AdminPage /></RouteGuard>
```
Rejected. Couples every call site to role plumbing; every page wrapper must plumb `adminRole` through. Risks desync with the auth-session subscription (a component could pass a stale role). Defeats the "single source of truth" principle in 2.3 Q9. Reading role from inside RouteGuard's own subscription is the correct shape.

**Alternative B — `canAccess` accepts a `ctx` parameter with loading-state flag.**
```typescript
canAccess(role: AdminRole | null, route: string, ctx?: { authResolving: boolean }): boolean;
```
Rejected. Adds complexity for a rare call-site need. The null-role strict-false contract covers the loading case cleanly: while auth is resolving, role is `undefined`/`null` and `canAccess` returns `false`. Callers (RouteGuard, sidebar) handle the loading distinction at their own level (render `null` vs render redirect) — `canAccess` itself stays a pure predicate over `(role, route)`.

**Alternative C — Sidebar computes visibility independently of RouteGuard.**
Rejected explicitly by 3.3 Q8 "parity harness" and 3.1 Q9 "single source of truth." Independent computation is exactly the drift pattern we are dismantling (e.g., the sidebar grants `board-admin` access to Portfolio at `app-sidebar.tsx:76` while the route redirects). Both surfaces must read the same `ROUTE_MANIFEST`.

**Alternative D — RouteGuard accepts a `roles: AdminRole[]` array prop.**
```tsx
<RouteGuard roles={["platform-admin"]}><AdminPage /></RouteGuard>
```
Rejected. This is the pattern currently used in 2.3 Q6/Q9/Q11 prose ("`<RouteGuard roles={["platform-admin"]}>`"). It was useful shorthand for spec-writing but introduces the same drift risk as Alternative C: the `roles` array on the call site can diverge from `ROUTE_MANIFEST`. Phase 11 enforces that every call site uses `route=` only and derives roles from the manifest. The manifest is the one place a persona-to-route mapping is authored.

## Impact analysis

- **Phase 0b.2 (stub implementation).** Stubs MUST match these signatures exactly: `RouteGuardProps`, `ROUTE_MANIFEST`, `FEATURE_MANIFEST`, `canAccess`, `usePersonaToggles`, `PersonaToggleState`, plus the three test helpers. Type-level compatibility is sufficient; runtime behavior may be empty/default-deny.
- **Phase 9 (manifest data + real logic).** Populates `ROUTE_MANIFEST` from the 3.2 route table × 0.2 matrix. Populates `FEATURE_MANIFEST` from the 0.2 PM-Managed Default Access Table. Writes real `canAccess` logic (manifest lookup + null-strict-false). Wires `usePersonaToggles` to the `tenant_configs` query per 3.1 Q6.
- **Phase 10 (parity harness).** Imports `canAccess`, `ROUTE_MANIFEST`, `FEATURE_MANIFEST`, all three test helpers, all seven persona fixtures. Tier 1 iterates every `(persona, route)` cell in `ROUTE_MANIFEST` for security-boundary routes per 3.3 Q4. Tier 3 renders the real sidebar via `renderSidebar(...)` and asserts SUBSET-RENDER per Invariants 1–3 above.
- **Phase 11 (sidebar rewrite).** `AppSidebar` imports `canAccess` and `usePersonaToggles`. Removes the four parallel `AdminRole` type declarations (per 3.3 Q2 AC-Q2-6). Removes the inline `roles: [...]` literals on nav items. Removes the duplicate `isSingleAssociationBoardExperience` at `app-sidebar.tsx:216`.
- **Phases 12–16 (zone landings).** Each zone PR wraps its routes: `<RouteGuard route="/app/financial/billing"><FinancialBillingPage /></RouteGuard>` and the equivalent for every route in the zone. No inline role ternaries (retires `App.tsx:293`, `App.tsx:297`). No `canAccessWipRoute` call sites (retires `client/src/lib/wip-features.ts` entirely — its one route, `/app/ai/ingestion`, migrates into `ROUTE_MANIFEST`).

## Open questions — RESOLVED

All 5 OQs resolved by William with **Option A across the board**.

- **OQ-1. AuthContext vs existing query — RESOLVED: Option A (thin `useAdminRole()` hook).** Phase 0b.2 authors a small hook co-located with `RouteGuard.tsx` (or in a neighbor file) that wraps the existing `useQuery<AuthSession>(["/api/auth/me", "session"])` call. No new `AuthContext.Provider`. Reuses the react-query cache; single subscription point. Rationale: minimum-viable shape; preserves the existing pattern; avoids a speculative refactor.

- **OQ-2. `usePersonaToggles` signature — RESOLVED: Option A (parameterless).** Contract is `usePersonaToggles(): PersonaToggleState`. The hook reads the active association ID and the current adminRole from internal subscriptions. Call sites do not plumb those values. **Follow-up:** 3.1 Q6 AC-26's `(activeAssociationId, adminRole)` phrasing was spec-prose shorthand; a one-line amendment to 3.1 Q6 notes that the ADR overrides the literal signature. Filed as a post-ADR Phase 9 amendment task.

- **OQ-3. Empty-manifest lookup semantics — RESOLVED: Option A (strict default-deny everywhere).** `canAccess(role, route)` returns `false` when `route` is not in `ROUTE_MANIFEST`. No dev-mode throw. Fail-closed. Typo safety comes later via a literal-union narrowing of `route` derived from `ROUTE_MANIFEST` keys (Phase 9 or later polish).

- **OQ-4. `viewer` persona in fixtures — RESOLVED: Option A (standalone fixture).** `tests/fixtures/personas.ts` exports 7 fixtures: 6 operator personas (Manager, Board Officer, Assisted Board, PM Assistant, Platform Admin, Viewer) + Owner portal persona. Parity harness iterates all 6 operator roles directly without composing modifiers inline.

- **OQ-5. `RouteGuard` Suspense integration — RESOLVED: Option A (no Suspense).** Return type is `JSX.Element | null`. During loading, RouteGuard renders `null`. No `throw promise` pattern. The app does not adopt Suspense elsewhere yet; adding it here is speculative complexity. Revisit only if the app adopts Suspense broadly later.

## Decision record log

- **Drafted** — Phase 0b.1 drafting agent (Claude). All contract surfaces specified. Five open questions flagged for William's sign-off.
- **ACCEPTED** — William signed off all 5 OQs as Option A. ADR status advanced from PROPOSED to ACCEPTED. Phase 0b.2 stub implementation unblocked.
