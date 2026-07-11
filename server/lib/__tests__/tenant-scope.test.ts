/**
 * Tenant-isolation primitives — fail-closed contract (founder-os#10750).
 *
 * Unlike the legacy `server/__tests__/assert-association-scope.test.ts` (which had
 * to REPRODUCE the helpers because they were buried in the 17k-line routes.ts),
 * these import the REAL guards from `server/lib/tenant-scope` — the extraction
 * (A-AUTHZ-004) made them directly testable.
 *
 * Covers A-AUTHZ-001 (fail-closed assertResourceScope + resourceScopeDecision +
 * unknown-type-throws) and the association guards the records-requests/amenities
 * modules now use (A-AUTHZ-002/003).
 */
import { describe, it, expect } from "vitest";
import {
  assertAssociationScope,
  assertAssociationInputScope,
  getAssociationIdQuery,
  resolveScopedAssociationId,
  resourceScopeDecision,
  assertResourceScope,
  GLOBAL_READ_RESOURCE_TYPES,
  type ScopeAdminRequest,
} from "../tenant-scope";
import type { Request } from "express";

function req(overrides: Partial<ScopeAdminRequest & { query: Record<string, unknown> }> = {}) {
  return { query: {}, ...overrides } as unknown as Request & ScopeAdminRequest;
}

describe("assertAssociationScope — fail-closed", () => {
  it("platform-admin is unrestricted (even with empty scope)", () => {
    expect(() => assertAssociationScope({ adminRole: "platform-admin", adminScopedAssociationIds: [] }, "a1")).not.toThrow();
  });
  it("manager with the association in scope → allowed", () => {
    expect(() => assertAssociationScope({ adminRole: "manager", adminScopedAssociationIds: ["a1"] }, "a1")).not.toThrow();
  });
  it("manager with empty scope → DENIED", () => {
    expect(() => assertAssociationScope({ adminRole: "manager", adminScopedAssociationIds: [] }, "a1")).toThrow(/outside admin scope/);
  });
  it("manager with a DIFFERENT association → DENIED (cross-tenant)", () => {
    expect(() => assertAssociationScope({ adminRole: "manager", adminScopedAssociationIds: ["a2"] }, "a1")).toThrow(/outside admin scope/);
  });
  it("missing role → DENIED (defense in depth)", () => {
    expect(() => assertAssociationScope({ adminScopedAssociationIds: ["a1"] }, "a1")).toThrow(/outside admin scope/);
  });
  for (const role of ["board-officer", "assisted-board", "pm-assistant", "viewer"] as const) {
    it(`${role} with empty scope → DENIED`, () => {
      expect(() => assertAssociationScope({ adminRole: role, adminScopedAssociationIds: [] }, "a1")).toThrow(/outside admin scope/);
    });
  }
});

describe("assertAssociationInputScope", () => {
  it("null associationId for non-platform → throws 'required'", () => {
    expect(() => assertAssociationInputScope({ adminRole: "manager", adminScopedAssociationIds: ["a1"] }, null)).toThrow(/associationId is required/);
  });
  it("cross-tenant associationId → DENIED", () => {
    expect(() => assertAssociationInputScope({ adminRole: "manager", adminScopedAssociationIds: ["a1"] }, "a2")).toThrow(/outside admin scope/);
  });
  it("platform-admin with null → allowed", () => {
    expect(() => assertAssociationInputScope({ adminRole: "platform-admin" }, null)).not.toThrow();
  });
});

describe("getAssociationIdQuery / resolveScopedAssociationId — never all-tenants for non-platform", () => {
  it("non-platform requesting an out-of-scope association → throws", () => {
    expect(() => getAssociationIdQuery(req({ adminRole: "manager", adminScopedAssociationIds: ["a1"], query: { associationId: "a2" } }))).toThrow(/outside admin scope/);
  });
  it("non-platform, no request, single scope → defaults to that scope", () => {
    expect(resolveScopedAssociationId(req({ adminRole: "manager", adminScopedAssociationIds: ["a1"] }))).toBe("a1");
  });
  it("non-platform, no request, empty scope → throws (never returns all-tenants)", () => {
    expect(() => resolveScopedAssociationId(req({ adminRole: "manager", adminScopedAssociationIds: [] }))).toThrow(/No association scopes/);
  });
  it("non-platform, no request, multi scope → requires explicit associationId", () => {
    expect(() => resolveScopedAssociationId(req({ adminRole: "manager", adminScopedAssociationIds: ["a1", "a2"] }))).toThrow(/associationId is required/);
  });
  it("platform-admin passes the requested value through (incl. undefined = all)", () => {
    expect(getAssociationIdQuery(req({ adminRole: "platform-admin", query: { associationId: "a9" } }))).toBe("a9");
    expect(getAssociationIdQuery(req({ adminRole: "platform-admin" }))).toBeUndefined();
  });
});

describe("resourceScopeDecision — A-AUTHZ-001 fail-closed", () => {
  it("a real association → scope-check it", () => {
    expect(resourceScopeDecision("document", "a1")).toEqual({ action: "scope-check", associationId: "a1" });
  });
  it("null association + WRITE → DENY (e.g. PATCH a null-association governance template)", () => {
    expect(resourceScopeDecision("governance-template", null, { write: true })).toEqual({ action: "deny" });
  });
  it("null association + READ of a genuinely-global type → allow (state-library read)", () => {
    expect(resourceScopeDecision("governance-template", null, { write: false })).toEqual({ action: "allow-global-read" });
  });
  it("null association on a NON-global type (notice-template / clause-record / communication-history) → DENY even on read", () => {
    expect(resourceScopeDecision("notice-template", null)).toEqual({ action: "deny" });
    expect(resourceScopeDecision("clause-record", null)).toEqual({ action: "deny" });
    expect(resourceScopeDecision("communication-history", null)).toEqual({ action: "deny" });
  });
  it("the global read allow-list is minimal (governance-template only)", () => {
    expect([...GLOBAL_READ_RESOURCE_TYPES]).toEqual(["governance-template"]);
  });
});

describe("assertResourceScope — fail-closed end-to-end (injected resolver)", () => {
  const mgrA: ScopeAdminRequest = { adminRole: "manager", adminScopedAssociationIds: ["a1"] };

  it("legitimate same-tenant resource passes", async () => {
    await expect(assertResourceScope(mgrA, "document", "d1", { resolver: async () => "a1" })).resolves.toBeUndefined();
  });
  it("cross-tenant resource → DENIED", async () => {
    await expect(assertResourceScope(mgrA, "document", "d1", { resolver: async () => "a2" })).rejects.toThrow(/outside/);
  });
  it("null-association WRITE (governance template) → DENIED", async () => {
    await expect(assertResourceScope(mgrA, "governance-template", "t1", { write: true, resolver: async () => null })).rejects.toThrow(/Resource not found or outside/);
  });
  it("null-association READ of governance-template → allowed (shared library)", async () => {
    await expect(assertResourceScope(mgrA, "governance-template", "t1", { resolver: async () => null })).resolves.toBeUndefined();
  });
  it("null-association on a not-found / non-global resource → DENIED (was fail-open)", async () => {
    await expect(assertResourceScope(mgrA, "notice-template", "n1", { resolver: async () => null })).rejects.toThrow(/Resource not found or outside/);
  });
  it("unknown resourceType → THROWS (resolver fails loud) rather than allows", async () => {
    const throwingResolver = async (rt: string) => { throw new Error(`unknown resourceType "${rt}"`); };
    await expect(assertResourceScope(mgrA, "bogus-type", "x", { resolver: throwingResolver })).rejects.toThrow(/unknown resourceType/);
  });
  it("platform-admin is unrestricted", async () => {
    await expect(assertResourceScope({ adminRole: "platform-admin" }, "governance-template", "t1", { write: true, resolver: async () => null })).resolves.toBeUndefined();
  });
  it("a mis-wired app (no resolver) fails CLOSED, not open", async () => {
    await expect(assertResourceScope(mgrA, "document", "d1")).rejects.toThrow(/resolver is not configured/);
  });
});
