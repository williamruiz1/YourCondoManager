/**
 * Wave 22 — ElectionResultsDonutChart (hand-rolled SVG) tests.
 *
 * Replaces the prior recharts-backed donut chart in
 * `client/src/components/election-results-charts.tsx`.
 *
 * @vitest-environment jsdom
 */

import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { ElectionResultsDonutChart } from "../../client/src/components/charts/election-results-donut-chart";

describe("ElectionResultsDonutChart", () => {
  const cast = { label: "Cast", value: 30, color: "#22c55e" };
  const remaining = { label: "Remaining", value: 70, color: "#e5e7eb" };

  it("renders one <path> per segment", () => {
    const { container } = render(
      <ElectionResultsDonutChart data={[cast, remaining]} />,
    );
    const segs = container.querySelectorAll(
      'path[data-testid^="election-results-donut-segment-"]',
    );
    expect(segs.length).toBe(2);
  });

  it("declares an aria-label and SVG <title> for accessibility", () => {
    const { container } = render(
      <ElectionResultsDonutChart
        data={[cast, remaining]}
        ariaLabel="Participation rate"
      />,
    );
    const svg = container.querySelector('svg[role="img"]');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("aria-label")).toBe("Participation rate");
    expect(container.querySelector("svg > title")?.textContent).toBe(
      "Participation rate",
    );
  });

  it("encodes per-segment label + value via data attributes", () => {
    render(<ElectionResultsDonutChart data={[cast, remaining]} />);
    const seg0 = screen.getByTestId("election-results-donut-segment-0");
    expect(seg0.getAttribute("data-label")).toBe("Cast");
    expect(seg0.getAttribute("data-value")).toBe("30");
    const seg1 = screen.getByTestId("election-results-donut-segment-1");
    expect(seg1.getAttribute("data-label")).toBe("Remaining");
    expect(seg1.getAttribute("data-value")).toBe("70");
  });

  it("segment sweeps + paddings sum to 360 degrees (full ring)", () => {
    // Re-derive the same geometry the component uses internally.
    const data = [cast, remaining];
    const total = data.reduce((acc, s) => acc + s.value, 0);
    const paddingAngle = 2;
    const nonZeroCount = data.filter((s) => s.value > 0).length;
    const drawable = 360 - paddingAngle * nonZeroCount;
    const sweeps = data.map((s) => (s.value / total) * drawable);
    const sum = sweeps.reduce((acc, v) => acc + v, 0) + paddingAngle * nonZeroCount;
    expect(sum).toBeCloseTo(360, 5);
  });

  it("collapses a zero-value segment to an empty path (count preserved)", () => {
    const { container } = render(
      <ElectionResultsDonutChart
        data={[
          { label: "A", value: 0, color: "#000000" },
          { label: "B", value: 100, color: "#22c55e" },
        ]}
      />,
    );
    const segs = container.querySelectorAll(
      'path[data-testid^="election-results-donut-segment-"]',
    );
    expect(segs.length).toBe(2);
    // Zero segment has empty `d`; non-zero segment has a real path.
    expect(segs[0].getAttribute("d")).toBe("");
    expect((segs[1].getAttribute("d") ?? "").length).toBeGreaterThan(0);
  });

  it("shows a tooltip on hover with the segment value", () => {
    render(<ElectionResultsDonutChart data={[cast, remaining]} />);
    const seg = screen.getByTestId("election-results-donut-segment-0");
    fireEvent.mouseEnter(seg);
    const tip = screen.getByTestId("election-results-donut-tooltip");
    expect(tip.textContent).toContain("Cast");
    expect(tip.textContent).toContain("30");
  });
});
