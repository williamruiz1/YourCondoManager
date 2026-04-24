/**
 * 4.2 Q3 addendum (3a) — Wave 1 amenities toggle.
 *
 * Unit coverage for the shared auth predicate used by the
 * GET/PATCH /api/associations/:id/settings/amenities endpoints.
 * The server route wraps this predicate; a deny here must produce a 403.
 *
 * Invariants under test:
 *   - Manager and platform-admin may toggle when scoped.
 *   - Board-officer may toggle only for self-managed associations.
 *   - Owner-portal persona (role = "owner" / unknown), assisted-board,
 *     pm-assistant, and viewer are denied (→ 403 at the HTTP layer).
 */

import { describe, it, expect } from "vitest";
import { checkAmenitiesToggleAuth } from "../shared/amenities-toggle-auth";

const ASSOC = "assoc-1";

describe("checkAmenitiesToggleAuth — allowed roles", () => {
  it("platform-admin is always allowed", () => {
    expect(
      checkAmenitiesToggleAuth({ role: "platform-admin", associationId: ASSOC, scopedAssociationIds: [] }).allowed,
    ).toBe(true);
  });

  it("manager is allowed when the association is in scope", () => {
    expect(
      checkAmenitiesToggleAuth({ role: "manager", associationId: ASSOC, scopedAssociationIds: [ASSOC] }).allowed,
    ).toBe(true);
  });

  it("manager is denied when the association is OUT of scope", () => {
    const res = checkAmenitiesToggleAuth({
      role: "manager",
      associationId: ASSOC,
      scopedAssociationIds: ["other-assoc"],
    });
    expect(res.allowed).toBe(false);
    if (!res.allowed) expect(res.reason).toMatch(/outside admin scope/i);
  });

  it("board-officer on a self-managed association is allowed", () => {
    expect(
      checkAmenitiesToggleAuth({
        role: "board-officer",
        associationId: ASSOC,
        scopedAssociationIds: [ASSOC],
        managementType: "self-managed",
      }).allowed,
    ).toBe(true);
  });

  it("board-officer defaults to self-managed when managementType is null", () => {
    expect(
      checkAmenitiesToggleAuth({
        role: "board-officer",
        associationId: ASSOC,
        scopedAssociationIds: [ASSOC],
        managementType: null,
      }).allowed,
    ).toBe(true);
  });
});

describe("checkAmenitiesToggleAuth — denied roles produce 403 surface", () => {
  it("board-officer on a PM-managed association is denied", () => {
    const res = checkAmenitiesToggleAuth({
      role: "board-officer",
      associationId: ASSOC,
      scopedAssociationIds: [ASSOC],
      managementType: "property-managed",
    });
    expect(res.allowed).toBe(false);
    if (!res.allowed) expect(res.reason).toMatch(/self-managed/i);
  });

  it("board-officer outside association scope is denied", () => {
    const res = checkAmenitiesToggleAuth({
      role: "board-officer",
      associationId: ASSOC,
      scopedAssociationIds: ["other"],
      managementType: "self-managed",
    });
    expect(res.allowed).toBe(false);
    if (!res.allowed) expect(res.reason).toMatch(/scope/i);
  });

  it("assisted-board is denied", () => {
    const res = checkAmenitiesToggleAuth({
      role: "assisted-board",
      associationId: ASSOC,
      scopedAssociationIds: [ASSOC],
    });
    expect(res.allowed).toBe(false);
  });

  it("pm-assistant is denied", () => {
    const res = checkAmenitiesToggleAuth({
      role: "pm-assistant",
      associationId: ASSOC,
      scopedAssociationIds: [ASSOC],
    });
    expect(res.allowed).toBe(false);
  });

  it("viewer is denied", () => {
    const res = checkAmenitiesToggleAuth({
      role: "viewer",
      associationId: ASSOC,
      scopedAssociationIds: [ASSOC],
    });
    expect(res.allowed).toBe(false);
  });

  it("null / undefined role is denied (owner-portal session)", () => {
    expect(
      checkAmenitiesToggleAuth({ role: null, associationId: ASSOC, scopedAssociationIds: [ASSOC] }).allowed,
    ).toBe(false);
    expect(
      checkAmenitiesToggleAuth({ role: undefined, associationId: ASSOC, scopedAssociationIds: [ASSOC] }).allowed,
    ).toBe(false);
  });

  it("missing associationId is denied", () => {
    const res = checkAmenitiesToggleAuth({ role: "manager", associationId: "", scopedAssociationIds: [] });
    expect(res.allowed).toBe(false);
  });
});
