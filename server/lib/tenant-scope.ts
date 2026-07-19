/**
 * Tenant-isolation primitives — the ONE shared, fail-closed authorization layer
 * every route module must call (A-AUTHZ-004).
 *
 * Previously these guards lived as module-private functions inside the 17k-line
 * `server/routes.ts`, so extracted per-feature modules under `server/routes/*.ts`
 * could not import them and drifted into hand-rolled (or absent) scope checks —
 * the root enabler of the records-requests / amenities cross-tenant IDORs
 * (A-AUTHZ-002/003). This module is that single source of truth. It is
 * DELIBERATELY dependency-light (no `storage`/`db`/route-surface import) so it is
 * unit-testable directly — the resource resolver is INJECTED, not imported —
 * unlike the old "reproduce the helper as a contract copy" test workaround.
 *
 * Fail-closed doctrine: a non-platform admin is DENIED unless their scope
 * positively includes the resource's association. An unresolved / null / not-found
 * association DENIES (A-AUTHZ-001) — never the old blanket falsy-allow — except a
 * READ of an explicitly allow-listed, genuinely-global (platform-provided) type.
 */

import type { Request } from "express";
import type { AdminRole } from "@shared/schema";

/** The auth fields every scope check needs. Structurally satisfied by each
 * module's own `AdminRequest` (Express `Request` + these fields). */
export interface ScopeAdminRequest {
  adminRole?: AdminRole;
  adminScopedAssociationIds?: string[];
}

/**
 * Resolve the `associationId` query param, VALIDATED against the admin's scope.
 * platform-admin is unrestricted. A non-platform admin: a requested association
 * outside scope throws; no request + a single scope defaults to it; no request +
 * multiple scopes requires an explicit associationId; empty scope denies. NEVER
 * returns undefined-meaning-all-tenants for a non-platform admin.
 */
export function getAssociationIdQuery(req: Request & ScopeAdminRequest): string | undefined {
  const requested = typeof req.query.associationId === "string" ? req.query.associationId : undefined;

  // Only an explicitly authenticated platform admin is unrestricted. A request
  // that reaches this guard without role context must fail closed; treating a
  // missing role as platform-wide access would recreate the isolation bypass
  // this module exists to prevent.
  if (req.adminRole === "platform-admin") {
    return requested;
  }

  if (!req.adminRole) {
    throw new Error("Association is outside admin scope");
  }

  const scopedAssociationIds = req.adminScopedAssociationIds ?? [];
  if (requested) {
    if (!scopedAssociationIds.includes(requested)) {
      throw new Error("Requested association is outside admin scope");
    }
    return requested;
  }

  if (scopedAssociationIds.length === 0) {
    throw new Error("No association scopes assigned to this admin");
  }
  if (scopedAssociationIds.length === 1) {
    return scopedAssociationIds[0];
  }

  throw new Error("associationId is required for multi-association scoped admins");
}

/**
 * The mandatory isolation primitive (A-AUTHZ-004). Alias of
 * `getAssociationIdQuery` under the canonical name every module should reach for:
 * it ALWAYS validates the requested association against `adminScopedAssociationIds`
 * and never yields an all-tenants read for a non-platform admin.
 */
export function resolveScopedAssociationId(req: Request & ScopeAdminRequest): string | undefined {
  return getAssociationIdQuery(req);
}

/**
 * Assert a non-platform admin's scope includes `associationId`. Fail-closed:
 * an empty scope, a missing role, a missing association id, or an association
 * outside scope all DENY. platform-admin is unrestricted.
 */
export function assertAssociationScope(req: ScopeAdminRequest, associationId: string): void {
  if (req.adminRole === "platform-admin") return;
  if (!associationId) {
    throw new Error("associationId is required");
  }
  // Defense-in-depth: a request with no role should never reach here; deny if it does.
  if (!req.adminRole) {
    throw new Error("Association is outside admin scope");
  }
  const scopedAssociationIds = req.adminScopedAssociationIds ?? [];
  // Fail-closed: empty scope for a non-platform-admin role is a denial.
  if (scopedAssociationIds.length === 0 || !scopedAssociationIds.includes(associationId)) {
    throw new Error("Association is outside admin scope");
  }
}

/** Like `assertAssociationScope`, but a missing associationId is an explicit
 * "associationId is required" for non-platform admins (used on write inputs). */
export function assertAssociationInputScope(
  req: ScopeAdminRequest,
  associationId: string | null | undefined,
): void {
  if (req.adminRole === "platform-admin") return;
  if (!associationId) {
    throw new Error("associationId is required");
  }
  assertAssociationScope(req, associationId);
}

/**
 * Genuinely-global, platform-provided resource types whose null-association rows
 * are legitimately READABLE by any authed admin (e.g. state-library governance
 * templates — created platform-admin-only, read by boards). WRITES to a global
 * row still require platform-admin. Any OTHER type with a null/unresolved
 * association fails closed. Keep this allow-list MINIMAL and read-only.
 */
export const GLOBAL_READ_RESOURCE_TYPES: ReadonlySet<string> = new Set(["governance-template"]);

export type ResourceScopeDecision =
  | { action: "scope-check"; associationId: string }
  | { action: "allow-global-read" }
  | { action: "deny" };

/**
 * Pure fail-closed decision for a resolved resource association (A-AUTHZ-001).
 * Testable without `storage`/`db`.
 *   - a real associationId → scope-check it
 *   - null/undefined + READ of a global-allow-listed type → allow (shared library read)
 *   - null/undefined otherwise (orphan, not-found, or a non-global null) → DENY
 */
export function resourceScopeDecision(
  resourceType: string,
  resolvedAssociationId: string | null | undefined,
  opts?: { write?: boolean },
): ResourceScopeDecision {
  if (resolvedAssociationId) {
    return { action: "scope-check", associationId: resolvedAssociationId };
  }
  if (!opts?.write && GLOBAL_READ_RESOURCE_TYPES.has(resourceType)) {
    return { action: "allow-global-read" };
  }
  return { action: "deny" };
}

/** Resolve a scoped resource's association id. Throws on an unknown resourceType
 * (fail-loud) — so a typo can never silently allow. Injected so this module
 * stays storage-free and testable. */
export type ResourceAssociationResolver = (
  resourceType: string,
  id: string,
) => Promise<string | null | undefined>;

let boundResolver: ResourceAssociationResolver | null = null;

/** Wire the production resolver once at route-registration (routes.ts). */
export function setResourceAssociationResolver(resolver: ResourceAssociationResolver): void {
  boundResolver = resolver;
}

/**
 * Assert a non-platform admin may access resource `(resourceType, id)`. Fail-closed
 * per `resourceScopeDecision`. `opts.write` marks a mutating call (a write to a
 * global row is denied for non-platform admins). `opts.resolver` overrides the
 * bound resolver (tests). platform-admin is unrestricted.
 */
export async function assertResourceScope(
  req: ScopeAdminRequest,
  resourceType: string,
  id: string,
  opts?: { write?: boolean; resolver?: ResourceAssociationResolver },
): Promise<void> {
  if (req.adminRole === "platform-admin") return;
  const resolver = opts?.resolver ?? boundResolver;
  if (!resolver) {
    // Fail-closed: a mis-wired app must DENY, never allow.
    throw new Error("Resource association resolver is not configured");
  }
  const associationId = await resolver(resourceType, id);
  const decision = resourceScopeDecision(resourceType, associationId, opts);
  if (decision.action === "deny") {
    throw new Error("Resource not found or outside your association scope");
  }
  if (decision.action === "allow-global-read") {
    return;
  }
  assertAssociationScope(req, decision.associationId);
}
