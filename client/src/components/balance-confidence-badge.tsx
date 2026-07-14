/**
 * BalanceConfidenceBadge (founder-os#11196 / research #832 §5).
 *
 * Owner-portal annotation: when a unit's balance is only PRELIMINARY (a LOW
 * confidence tier) or has a DOCUMENTED DISPUTE, show a small "preliminary —
 * under review" badge with an explanatory tooltip. HIGH / MEDIUM tiers render
 * nothing (the balance stands on its own).
 *
 * Pure & presentational — it takes the confidence entries for ONE unit and
 * decides what to show. The dispute DOLLAR figure is board-only and is stripped
 * server-side before it ever reaches the owner shape, so this component never
 * displays a board-only dispute amount to an owner.
 */
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type BalanceConfidenceTier = "high" | "medium" | "low" | "disputed";
export type BalanceCategory = "assessment" | "dues";

export interface BalanceConfidenceItem {
  unitId: string;
  category: BalanceCategory;
  tier: BalanceConfidenceTier;
  balanceAsAssessed: number | null;
  /** Board-only dispute figures are stripped server-side (null for owners). */
  disputeAmount: number | null;
  /** True when a board-only dispute exists (owner sees the state, not the $). */
  hasBoardOnlyDispute?: boolean;
  sourceArtifactId: string | null;
  preparedBy: string | null;
  asOfDate: string | null;
}

/** The worst (least-confident) tier across a unit's categories. */
export function worstTier(
  items: BalanceConfidenceItem[],
): BalanceConfidenceTier | null {
  if (!items || items.length === 0) return null;
  if (items.some((i) => i.tier === "disputed")) return "disputed";
  if (items.some((i) => i.tier === "low")) return "low";
  if (items.some((i) => i.tier === "medium")) return "medium";
  return "high";
}

export function BalanceConfidenceBadge({
  items,
  className,
}: {
  items: BalanceConfidenceItem[];
  className?: string;
}) {
  const tier = worstTier(items);
  // Only LOW / DISPUTED get the "preliminary — under review" treatment.
  if (tier !== "low" && tier !== "disputed") return null;

  const preparedBy = items.find((i) => i.preparedBy)?.preparedBy ?? null;
  const asOf = items.find((i) => i.asOfDate)?.asOfDate ?? null;
  const asOfDate = asOf ? new Date(asOf).toISOString().slice(0, 10) : null;

  const label =
    tier === "disputed" ? "Under review" : "Preliminary — under review";
  const explanation =
    tier === "disputed"
      ? "This balance includes a documented discrepancy that the board is reconciling. The figure shown is preliminary and may change once the review is complete."
      : "This balance is preliminary and still being verified against payment records. It may change once the review is complete.";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={`cursor-help border-amber-400/60 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 ${className ?? ""}`}
          data-testid={`balance-confidence-badge-${tier}`}
        >
          {label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-left">
        <p className="text-sm">{explanation}</p>
        {(preparedBy || asOfDate) && (
          <p className="mt-1 text-xs text-muted-foreground">
            {preparedBy ? `Prepared by ${preparedBy}` : ""}
            {preparedBy && asOfDate ? " · " : ""}
            {asOfDate ? `as of ${asOfDate}` : ""}
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
