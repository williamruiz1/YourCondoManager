/**
 * Portal role-lens tests for the pressing-items widget (YCM pressing-items
 * plain-English fix, 2026-07-14).
 *
 * Before this fix, `req.portalEffectiveRole` is one of the Phase 8a
 * collapsed roles ("owner" | "board-member" | "owner-board-member") and
 * `lensRoleFromPortal` only matched the literal strings "treasurer" /
 * "secretary" / "president" — which NEVER appear in `portalEffectiveRole`.
 * Every portal caller therefore fell through to the "board" lens, which
 * sees every pressing-item class — including a plain OWNER with no board
 * seat at all, who would see other owners' delinquency balances and
 * unmatched bank transactions on their own portal home. These tests pin
 * the corrected behavior: no board seat -> null (nothing shown); a board
 * seat is lensed by its actual officer title.
 */
import { describe, expect, it } from "vitest";
import { lensRoleFromPortal } from "../pressing-items";

describe("lensRoleFromPortal", () => {
  it("returns null for a plain owner with no board seat (was previously 'board')", () => {
    expect(
      lensRoleFromPortal({ portalEffectiveRole: "owner", portalBoardRoleTitle: null } as any),
    ).toBeNull();
  });

  it("returns null when effectiveRole is missing/ambiguous and there is no board title", () => {
    expect(lensRoleFromPortal({} as any)).toBeNull();
  });

  it("lenses a board member with the Treasurer title to 'treasurer'", () => {
    expect(
      lensRoleFromPortal({
        portalEffectiveRole: "board-member",
        portalBoardRoleTitle: "Treasurer",
      } as any),
    ).toBe("treasurer");
  });

  it("is case-insensitive on the stored board-role title", () => {
    expect(
      lensRoleFromPortal({
        portalEffectiveRole: "owner-board-member",
        portalBoardRoleTitle: "secretary",
      } as any),
    ).toBe("secretary");
  });

  it("maps Vice President to 'president'", () => {
    expect(
      lensRoleFromPortal({
        portalEffectiveRole: "board-member",
        portalBoardRoleTitle: "Vice President",
      } as any),
    ).toBe("president");
  });

  it("falls back to the full 'board' lens for a plain board-member seat with no specific office", () => {
    expect(
      lensRoleFromPortal({
        portalEffectiveRole: "owner-board-member",
        portalBoardRoleTitle: "Board Member",
      } as any),
    ).toBe("board");
  });
});
