/**
 * Wave 22 — ElectionResultsBarChart (hand-rolled SVG) tests.
 *
 * Replaces the prior recharts-backed bar chart in
 * `client/src/components/election-results-charts.tsx`. The bar chart is now
 * a zero-dep SVG component rendered synchronously.
 *
 * @vitest-environment jsdom
 */

import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { ElectionResultsBarChart } from "../../client/src/components/charts/election-results-bar-chart";

describe("ElectionResultsBarChart", () => {
  const sample = [
    { label: "Option A", votes: 30, percent: 60 },
    { label: "Option B", votes: 20, percent: 40 },
  ];

  it("renders one <rect> bar per datum", () => {
    const { container } = render(<ElectionResultsBarChart data={sample} />);
    const bars = container.querySelectorAll('rect[data-testid^="election-results-bar-"]');
    expect(bars.length).toBe(sample.length);
  });

  it("scales bar width to the largest value (max-value scaling)", () => {
    const { container } = render(<ElectionResultsBarChart data={sample} />);
    const bars = Array.from(
      container.querySelectorAll('rect[data-testid^="election-results-bar-"]'),
    ) as SVGRectElement[];

    const w0 = parseFloat(bars[0].getAttribute("width") ?? "0");
    const w1 = parseFloat(bars[1].getAttribute("width") ?? "0");

    // 30 votes vs 20 votes -> bar 0 should be wider, ratio ~1.5x.
    expect(w0).toBeGreaterThan(w1);
    expect(w0 / w1).toBeCloseTo(30 / 20, 1);
  });

  it("uses an explicit maxValue override when provided (bar widths shrink)", () => {
    const { container, rerender } = render(<ElectionResultsBarChart data={sample} />);
    const naturalBars = Array.from(
      container.querySelectorAll('rect[data-testid^="election-results-bar-"]'),
    ) as SVGRectElement[];
    const naturalW0 = parseFloat(naturalBars[0].getAttribute("width") ?? "0");

    rerender(<ElectionResultsBarChart data={sample} maxValue={100} />);
    const scaledBars = Array.from(
      container.querySelectorAll('rect[data-testid^="election-results-bar-"]'),
    ) as SVGRectElement[];
    const scaledW0 = parseFloat(scaledBars[0].getAttribute("width") ?? "0");

    // With max=30 the bar fills the plot; with max=100 it's much smaller.
    expect(scaledW0).toBeLessThan(naturalW0);
  });

  it("declares an aria-label on the SVG for accessibility", () => {
    const { container } = render(
      <ElectionResultsBarChart data={sample} ariaLabel="Test bar chart" />,
    );
    const svg = container.querySelector('svg[role="img"]');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("aria-label")).toBe("Test bar chart");
    expect(container.querySelector("svg title")?.textContent).toBe("Test bar chart");
  });

  it("shows a tooltip on hover with vote count + percent", () => {
    render(<ElectionResultsBarChart data={sample} />);
    const row = screen.getByTestId("election-results-bar-row-0");
    fireEvent.mouseEnter(row);
    const tip = screen.getByTestId("election-results-bar-tooltip");
    expect(tip.textContent).toContain("Option A");
    expect(tip.textContent).toContain("30 votes");
    expect(tip.textContent).toContain("60%");
  });

  it("renders zero bars cleanly with empty data", () => {
    const { container } = render(<ElectionResultsBarChart data={[]} />);
    const bars = container.querySelectorAll('rect[data-testid^="election-results-bar-"]');
    expect(bars.length).toBe(0);
    // SVG itself should still mount.
    expect(container.querySelector('svg[role="img"]')).not.toBeNull();
  });
});
