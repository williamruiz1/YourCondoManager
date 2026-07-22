/**
 * Balance-confidence visibility — the board-only dispute rule (founder-os#11196).
 *
 * The security-critical invariant: an owner NEVER sees a board-only dispute
 * dollar figure, but still sees the DISPUTED tier + review state. The board
 * DOES see the figure. This test locks that rule (research #832: the CHC
 * 1419/Tillman $606.86 dispute is board-only).
 */
import { describe, expect, it } from "vitest";
import type { OwnerBalanceConfidence } from "@shared/schema";
import {
  toBoardShape,
  toOwnerSafe,
} from "../balance-confidence-visibility";

function row(over: Partial<OwnerBalanceConfidence> = {}): OwnerBalanceConfidence {
  return {
    id: "x",
    associationId: "assoc",
    unitId: "unit-1419",
    category: "assessment",
    tier: "disputed",
    balanceAsAssessed: 1368.44,
    disputeAmount: 606.86,
    disputeVisibleToBoardOnly: 1,
    sourceArtifactId: "founder-os#832",
    preparedBy: "Luz Miranda",
    asOfDate: new Date("2026-05-09T00:00:00Z"),
    note: "board-only dispute",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  } as OwnerBalanceConfidence;
}

describe("toOwnerSafe — board-only dispute stripping", () => {
  it("strips the dispute dollar figure from a board-only dispute", () => {
    const safe = toOwnerSafe(row());
    expect(safe.disputeAmount).toBeNull();
  });

  it("still exposes the DISPUTED tier + review state to the owner", () => {
    const safe = toOwnerSafe(row());
    expect(safe.tier).toBe("disputed");
    expect(safe.hasBoardOnlyDispute).toBe(true);
  });

  it("does NOT strip a dispute that is not board-only", () => {
    const safe = toOwnerSafe(row({ disputeVisibleToBoardOnly: 0 }));
    expect(safe.disputeAmount).toBe(606.86);
    expect(safe.hasBoardOnlyDispute).toBe(false);
  });

  it("never leaks the note field to the owner shape", () => {
    const safe = toOwnerSafe(row());
    expect((safe as Record<string, unknown>).note).toBeUndefined();
  });

  it("passes provenance (source + preparer + asOf) to the owner", () => {
    const safe = toOwnerSafe(row());
    expect(safe.sourceArtifactId).toBe("founder-os#832");
    expect(safe.preparedBy).toBe("Luz Miranda");
    expect(safe.asOfDate).toEqual(new Date("2026-05-09T00:00:00Z"));
  });
});

describe("toBoardShape — board sees the figure", () => {
  it("includes the board-only dispute dollar figure", () => {
    const board = toBoardShape(row());
    expect(board.disputeAmount).toBe(606.86);
    expect(board.disputeVisibleToBoardOnly).toBe(true);
  });
});
