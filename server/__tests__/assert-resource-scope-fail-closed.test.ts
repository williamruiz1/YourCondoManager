/**
 * Regression contract tests for `assertResourceScope` in `server/routes.ts`
 * (A-AUTHZ-001, founder-os#10750 — YCM codebase-audit Wave 2).
 *
 * Locks in the fail-CLOSED hardening: an unresolved association (a
 * null-association row, a not-found id, or an unknown resourceType hitting the
 * resolver's `default`) must DENY a non-platform admin — previously it returned
 * (ALLOWED), exposing 9 nullable-`association_id` tables cross-tenant and
 * mutable from ANY tenant's admin (concrete write: PATCH /api/governance/templates/:id).
 *
 * Convention (see server/__tests__/assert-association-scope.test.ts): routes.ts
 * imports the entire route-registration surface at module load, so the helper is
 * reproduced in-process and locked as a contract. The reproduction below MUST
 * stay byte-equivalent to the production `assertResourceScope` in
 * server/routes.ts. If the production helper changes, this file changes in
 * lockstep. The resolver is injected so both the null-resolution and the
 * unknown-type (default-throw) branches are exercised deterministically.
 */

import { describe, it, expect } from "vitest";
import type { AdminRole } from "@shared/schema";

type AdminRequest = {
  adminRole?: AdminRole;
  adminScopedAssociationIds?: string[];
};

// ---- Reproduced helpers (mirror of server/routes.ts) ----

function assertAssociationScope(req: AdminRequest, associationId: string) {
  if (req.adminRole === "platform-admin") return;
  if (!associationId) throw new Error("associationId is required");
  if (!req.adminRole) throw new Error("Association is outside admin scope");
  const scopedAssociationIds = req.adminScopedAssociationIds ?? [];
  if (scopedAssociationIds.length === 0 || !scopedAssociationIds.includes(associationId)) {
    throw new Error("Association is outside admin scope");
  }
}

// The resolver's `default` now THROWS on an unknown resourceType (fail-loud),
// mirroring server/storage.ts getAssociationIdForScopedResource.
function resolverThrowsOnUnknown(resourceType: string): string | null | undefined {
  const known = new Set(["governance-template", "clause-record", "vendor", "budget"]);
  if (!known.has(resourceType)) {
    throw new Error(`getAssociationIdForScopedResource: unhandled resourceType "${resourceType}"`);
  }
  // For a known type, the fixture returns whatever the test seeded (see makeResolver).
  return undefined;
}

// Mirror of the hardened production assertResourceScope, with an injectable
// resolver in place of `storage.getAssociationIdForScopedResource`.
function makeAssertResourceScope(
  resolver: (resourceType: string, id: string) => Promise<string | null | undefined>,
) {
  return async function assertResourceScope(
    req: AdminRequest,
    resourceType: string,
    id: string,
    opts?: { allowGlobalRead?: boolean },
  ) {
    if (req.adminRole === "platform-admin") return;
    const associationId = await resolver(resourceType, id);
    if (!associationId) {
      if (opts?.allowGlobalRead) return;
      throw new Error("Resource not found or outside admin scope");
    }
    assertAssociationScope(req, associationId);
  };
}

const ASSOC_A = "assoc-A";
const ASSOC_B = "assoc-B";

// Resolver returning a fixed association for a known "existing tenant row".
const resolverReturns = (assoc: string | null | undefined) =>
  makeAssertResourceScope(async () => assoc);

describe("assertResourceScope — A-AUTHZ-001 fail-closed on unresolved association", () => {
  it("DENIES a non-platform admin when the association is NULL (null-association row)", async () => {
    const guard = resolverReturns(null);
    const req: AdminRequest = { adminRole: "manager", adminScopedAssociationIds: [ASSOC_A] };
    await expect(guard(req, "governance-template", "tpl-1")).rejects.toThrow(
      "Resource not found or outside admin scope",
    );
  });

  it("DENIES a non-platform admin when the association is undefined (row not found)", async () => {
    const guard = resolverReturns(undefined);
    const req: AdminRequest = { adminRole: "manager", adminScopedAssociationIds: [ASSOC_A] };
    await expect(guard(req, "clause-record", "missing")).rejects.toThrow(
      "Resource not found or outside admin scope",
    );
  });

  it("ALLOWS a non-platform admin to READ a global/null row when allowGlobalRead is set", async () => {
    // A null-association row has no owning tenant, so reading it is not a
    // cross-tenant leak — the explicit read-only exception for global templates.
    const guard = resolverReturns(null);
    const req: AdminRequest = { adminRole: "manager", adminScopedAssociationIds: [ASSOC_A] };
    await expect(
      guard(req, "governance-template", "global-tpl", { allowGlobalRead: true }),
    ).resolves.toBeUndefined();
  });

  it("still DENIES on null even with allowGlobalRead when… it is a WRITE (no opt) — mutation stays closed", async () => {
    const guard = resolverReturns(null);
    const req: AdminRequest = { adminRole: "manager", adminScopedAssociationIds: [ASSOC_A] };
    // No allowGlobalRead → a non-platform admin can never MUTATE a null/global row.
    await expect(guard(req, "governance-template", "global-tpl")).rejects.toThrow(
      "Resource not found or outside admin scope",
    );
  });

  it("ALLOWS a non-platform admin on a resolved association within their scope (legit same-tenant)", async () => {
    const guard = resolverReturns(ASSOC_A);
    const req: AdminRequest = { adminRole: "manager", adminScopedAssociationIds: [ASSOC_A] };
    await expect(guard(req, "budget", "b-1")).resolves.toBeUndefined();
  });

  it("DENIES a non-platform admin on a resolved association OUTSIDE their scope (cross-tenant)", async () => {
    const guard = resolverReturns(ASSOC_B);
    const req: AdminRequest = { adminRole: "manager", adminScopedAssociationIds: [ASSOC_A] };
    await expect(guard(req, "budget", "b-2")).rejects.toThrow("Association is outside admin scope");
  });

  it("ALLOWS platform-admin unconditionally (even on a null/global row)", async () => {
    const guard = resolverReturns(null);
    const req: AdminRequest = { adminRole: "platform-admin", adminScopedAssociationIds: [] };
    await expect(guard(req, "governance-template", "any")).resolves.toBeUndefined();
  });

  it("resolver THROWS (fail-loud) on an unknown resourceType — never silently allows", async () => {
    const guard = makeAssertResourceScope(async (rt, id) => resolverThrowsOnUnknown(rt));
    const req: AdminRequest = { adminRole: "manager", adminScopedAssociationIds: [ASSOC_A] };
    await expect(guard(req, "typo-resource-type", "x")).rejects.toThrow(/unhandled resourceType/);
  });
});
