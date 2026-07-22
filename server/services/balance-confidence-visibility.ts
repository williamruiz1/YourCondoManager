/**
 * Balance-confidence visibility rules (founder-os#11196 / research #832 §5).
 *
 * The SINGLE source of the board-only dispute-visibility rule, extracted pure
 * so it is unit-testable without a DB or HTTP layer. The route
 * (server/routes/balance-confidence.ts) consumes these; nothing else decides
 * whether an owner may see a dispute figure.
 *
 * Rule: a dispute amount flagged `disputeVisibleToBoardOnly` is NEVER returned
 * to an owner. The owner still sees the DISPUTED tier + review state (so the
 * "preliminary — under review" annotation renders) — just not the dollar
 * figure. The board/treasurer sees the figure.
 */
import type { OwnerBalanceConfidence } from "@shared/schema";

export interface OwnerSafeConfidence {
  unitId: string;
  category: OwnerBalanceConfidence["category"];
  tier: OwnerBalanceConfidence["tier"];
  balanceAsAssessed: number | null;
  disputeAmount: number | null;
  hasBoardOnlyDispute: boolean;
  sourceArtifactId: string | null;
  preparedBy: string | null;
  asOfDate: Date | null;
}

export interface BoardConfidence extends Omit<OwnerSafeConfidence, "hasBoardOnlyDispute"> {
  disputeVisibleToBoardOnly: boolean;
  note: string | null;
}

/** Owner-facing shape — strips board-only dispute figures. */
export function toOwnerSafe(row: OwnerBalanceConfidence): OwnerSafeConfidence {
  const boardOnly = row.disputeVisibleToBoardOnly === 1;
  return {
    unitId: row.unitId,
    category: row.category,
    tier: row.tier,
    balanceAsAssessed: row.balanceAsAssessed,
    disputeAmount: boardOnly ? null : row.disputeAmount,
    hasBoardOnlyDispute: boardOnly && row.disputeAmount != null,
    sourceArtifactId: row.sourceArtifactId,
    preparedBy: row.preparedBy,
    asOfDate: row.asOfDate,
  };
}

/** Board/treasurer-facing shape — includes the dispute figure. */
export function toBoardShape(row: OwnerBalanceConfidence): BoardConfidence {
  return {
    unitId: row.unitId,
    category: row.category,
    tier: row.tier,
    balanceAsAssessed: row.balanceAsAssessed,
    disputeAmount: row.disputeAmount,
    disputeVisibleToBoardOnly: row.disputeVisibleToBoardOnly === 1,
    sourceArtifactId: row.sourceArtifactId,
    preparedBy: row.preparedBy,
    asOfDate: row.asOfDate,
    note: row.note,
  };
}
