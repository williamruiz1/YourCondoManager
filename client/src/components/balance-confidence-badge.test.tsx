/**
 * BalanceConfidenceBadge — worst-tier + render gating (founder-os#11196).
 *
 * Only LOW / DISPUTED balances surface the "preliminary — under review" badge;
 * HIGH / MEDIUM render nothing. William's 3 CHC units are LOW → they must show
 * the preliminary annotation.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  BalanceConfidenceBadge,
  worstTier,
  type BalanceConfidenceItem,
} from "./balance-confidence-badge";

function item(over: Partial<BalanceConfidenceItem>): BalanceConfidenceItem {
  return {
    unitId: "u",
    category: "assessment",
    tier: "high",
    balanceAsAssessed: 0,
    disputeAmount: null,
    hasBoardOnlyDispute: false,
    sourceArtifactId: "founder-os#832",
    preparedBy: "Luz Miranda",
    asOfDate: "2026-05-09T00:00:00Z",
    ...over,
  };
}

function renderBadge(items: BalanceConfidenceItem[]) {
  return render(
    <TooltipProvider>
      <BalanceConfidenceBadge items={items} />
    </TooltipProvider>,
  );
}

describe("worstTier", () => {
  it("returns null for empty", () => {
    expect(worstTier([])).toBeNull();
  });
  it("disputed beats low beats medium beats high", () => {
    expect(worstTier([item({ tier: "high" }), item({ tier: "disputed", category: "dues" })])).toBe("disputed");
    expect(worstTier([item({ tier: "high" }), item({ tier: "low", category: "dues" })])).toBe("low");
    expect(worstTier([item({ tier: "high" }), item({ tier: "medium", category: "dues" })])).toBe("medium");
    expect(worstTier([item({ tier: "high" })])).toBe("high");
  });
});

describe("BalanceConfidenceBadge render gating", () => {
  it("renders nothing for HIGH", () => {
    const { container } = renderBadge([item({ tier: "high" })]);
    expect(container.textContent).toBe("");
  });
  it("renders nothing for MEDIUM", () => {
    const { container } = renderBadge([item({ tier: "medium" })]);
    expect(container.textContent).toBe("");
  });
  it("renders 'Preliminary — under review' for LOW (William's units)", () => {
    renderBadge([item({ tier: "low" })]);
    expect(screen.getByText("Preliminary — under review")).toBeTruthy();
  });
  it("renders 'Under review' for DISPUTED", () => {
    renderBadge([item({ tier: "disputed" })]);
    expect(screen.getByText("Under review")).toBeTruthy();
  });
  it("renders nothing for empty items (fail-open, no metadata)", () => {
    const { container } = renderBadge([]);
    expect(container.textContent).toBe("");
  });
});
