/**
 * shared/persona-access.ts — Phase 0b.2 skeleton per ADR 0b.
 *
 * This module is the single source of truth for persona-to-route and
 * persona-to-feature access across the application. Both the sidebar
 * (3.1 Q9) and `<RouteGuard>` (2.3 Q9) derive their visibility and gating
 * from the exports below — no inline `roles: [...]` arrays anywhere else.
 *
 * --- Phase 0b.2 scope (THIS FILE TODAY) ---
 * - Locks the export surface (types + function signatures) matching ADR 0b
 *   exactly so downstream phases can compile against stable contracts.
 * - Ships EMPTY manifests. `canAccess` is a pure predicate over the empty
 *   ROUTE_MANIFEST, which means it returns `false` for every input under
 *   the strict default-deny posture (OQ-3 Option A).
 * - `usePersonaToggles()` returns an empty `PersonaToggleState`; no
 *   features are enabled under the stub. Parameterless signature per
 *   OQ-2 Option A.
 *
 * --- Phase 9 scope (NOT THIS FILE TODAY) ---
 * - Populates `ROUTE_MANIFEST` from the 3.2 route table × 0.2 persona
 *   boundary matrix.
 * - Populates `FEATURE_MANIFEST` from the 0.2 PM-Managed Default Access
 *   Table.
 * - Replaces the empty-manifest lookup in `canAccess` with the real
 *   lookup. The function body shown here already implements the correct
 *   predicate — Phase 9 only needs to drop data into the manifests.
 * - Wires `usePersonaToggles()` to `tenant_configs` per 3.1 Q6.
 */

export { type AdminRole } from "./schema";

import type { AdminRole } from "./schema";

// ---------------------------------------------------------------------------
// Route manifest
// ---------------------------------------------------------------------------
//
// Keys = canonical route paths from the 3.2 route table
// (e.g., "/app", "/app/financial/billing", "/app/admin/users").
// Values = readonly array of AdminRole values permitted on that route.
//
// ROUTE_MANIFEST is the source of truth for both:
//   (a) <RouteGuard route={...}> accessibility, and
//   (b) sidebar item visibility (3.1 Q9).
// ---------------------------------------------------------------------------

export type RouteManifest = Readonly<Record<string, readonly AdminRole[]>>;

/**
 * Phase 0b.2: empty. Phase 9 populates from the 3.2 × 0.2 cross-table.
 */
export const ROUTE_MANIFEST: RouteManifest = {};

// ---------------------------------------------------------------------------
// Feature manifest
// ---------------------------------------------------------------------------
//
// Keys = feature-domain IDs from the 0.2 PM-Managed Default Access Table
// (e.g., "financials.reports", "governance.meetings", "operations.vendors").
// Values = readonly array of AdminRole values with DEFAULT view access.
//
// FEATURE_MANIFEST encodes the static persona-to-feature defaults. The
// PM toggle state at runtime (per 3.1 Q6) layers on top via
// usePersonaToggles() and is not encoded here.
// ---------------------------------------------------------------------------

export type FeatureManifest = Readonly<Record<string, readonly AdminRole[]>>;

/**
 * Phase 0b.2: empty. Phase 9 populates from the 0.2 PM-Managed Default
 * Access Table.
 */
export const FEATURE_MANIFEST: FeatureManifest = {};

// ---------------------------------------------------------------------------
// canAccess — pure predicate
// ---------------------------------------------------------------------------
//
// Returns true iff `role` is a non-null/undefined AdminRole AND the route
// is present in ROUTE_MANIFEST AND the role is in the manifest's role list
// for that route. Returns false in all other cases, including when `route`
// is absent from ROUTE_MANIFEST.
//
// Null-role strict-false (3.3 Q3 + OQ-3 Option A):
//   canAccess(null, route)      === false ALWAYS.
//   canAccess(undefined, route) === false ALWAYS.
//   canAccess(role, <unknown route>) === false ALWAYS (strict default-deny).
//
// Phase 0b.2 ships the final canAccess body. Because ROUTE_MANIFEST is
// empty in Phase 0b.2, every lookup yields `undefined` → function returns
// `false`. Phase 9 populates the manifest; the function body does not
// change.
// ---------------------------------------------------------------------------

export function canAccess(
  role: AdminRole | null | undefined,
  route: string,
): boolean {
  // OQ-3 Option A: strict default-deny everywhere.
  if (role == null) return false;
  const allowedRoles = ROUTE_MANIFEST[route];
  if (!allowedRoles) return false;
  return allowedRoles.includes(role);
}

// ---------------------------------------------------------------------------
// usePersonaToggles — runtime toggle hook
// ---------------------------------------------------------------------------
//
// Returns the per-persona feature-toggle state for the current auth session
// and active association context. In Phase 9, the implementation reads from
// `tenant_configs` (3.1 Q6). In Phase 0b.2 the stub returns an empty
// `PersonaToggleState` (no features enabled — every feature-domain lookup
// returns `undefined`, and consumers should consult FEATURE_MANIFEST for
// the default posture).
//
// Parameterless by contract (OQ-2 Option A). The hook reads the active
// association ID and current adminRole from internal subscriptions in
// Phase 9. Call sites do not plumb those values.
// ---------------------------------------------------------------------------

export interface PersonaToggleState {
  /**
   * Feature-domain ID → boolean.
   *   true  = enabled (visible/allowed) for the current persona + association.
   *   false = explicitly disabled.
   *   (key absent) = default — consult FEATURE_MANIFEST for default posture.
   */
  readonly [featureId: string]: boolean;
}

export function usePersonaToggles(): PersonaToggleState {
  // Phase 0b.2 stub: no features enabled.
  // Phase 9 wires this to the `tenant_configs` query (3.1 Q6) keyed on
  // (activeAssociationId, adminRole) from internal subscriptions.
  return {};
}
