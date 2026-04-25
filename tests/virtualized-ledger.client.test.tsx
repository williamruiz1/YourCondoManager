/**
 * 5.4-F7 (Wave 16b) — VirtualizedLedgerTable render tests.
 *
 * Covers:
 *   1. Below threshold (≤50 rows): every row is rendered inline (no
 *      virtualization, no scroll container).
 *   2. Above threshold (200 rows): only ~30 rows are mounted at once;
 *      we assert that the rendered DOM-row count is dramatically less
 *      than the input length AND that the first few rows are present
 *      so click handlers attached to row content remain interactive.
 *   3. Row click handlers are forwarded — interactive content (buttons)
 *      inside `renderRow` continues to work in virtualized mode.
 *
 * @vitest-environment jsdom
 */

import React from "react";
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { VirtualizedLedgerTable } from "../client/src/components/virtualized-ledger-table";

// `useVirtualizer` reads scroll-container geometry via `ResizeObserver`
// + `getBoundingClientRect`. jsdom does not implement either, so we
// install a minimal polyfill that immediately delivers a single rect
// to the observer's callback using whatever inline `style.height` was
// applied to the scroll container in the test.
beforeAll(() => {
  for (const prop of ["clientHeight", "offsetHeight", "scrollHeight"] as const) {
    Object.defineProperty(HTMLElement.prototype, prop, {
      configurable: true,
      get: function () {
        const style = (this as HTMLElement).style;
        if (style.overflow === "auto" && style.height) {
          return parseInt(style.height, 10) || 0;
        }
        if (style.height && /\d/.test(style.height)) {
          return parseInt(style.height, 10) || 0;
        }
        return 0;
      },
    });
  }
  for (const prop of ["clientWidth", "offsetWidth", "scrollWidth"] as const) {
    Object.defineProperty(HTMLElement.prototype, prop, {
      configurable: true,
      get: function () {
        return 1024;
      },
    });
  }
  Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
    configurable: true,
    value: function () {
      const style = (this as HTMLElement).style;
      const height =
        style.overflow === "auto" && style.height
          ? parseInt(style.height, 10) || 0
          : 0;
      return {
        x: 0,
        y: 0,
        width: 0,
        height,
        top: 0,
        left: 0,
        right: 0,
        bottom: height,
        toJSON: () => ({}),
      } as DOMRect;
    },
  });
  // Minimal ResizeObserver shim — fires the callback once with a single
  // synthesized entry whose `contentRect` mirrors the element's
  // `getBoundingClientRect()`. That is all `useVirtualizer` needs to
  // compute the visible window during the synchronous render path.
  class MockResizeObserver {
    private callback: ResizeObserverCallback;
    private targets: Element[] = [];
    constructor(cb: ResizeObserverCallback) {
      this.callback = cb;
    }
    observe(target: Element) {
      this.targets.push(target);
      const rect = (target as HTMLElement).getBoundingClientRect();
      this.callback(
        [
          {
            target,
            contentRect: rect,
            borderBoxSize: [],
            contentBoxSize: [],
            devicePixelContentBoxSize: [],
          } as unknown as ResizeObserverEntry,
        ],
        this as unknown as ResizeObserver,
      );
    }
    unobserve() {}
    disconnect() {}
  }
  // Install on both window and globalThis so the virtual-core lib finds it.
  (global as unknown as { ResizeObserver: typeof MockResizeObserver }).ResizeObserver =
    MockResizeObserver;
  (window as unknown as { ResizeObserver: typeof MockResizeObserver }).ResizeObserver =
    MockResizeObserver;
});

interface Row {
  id: string;
  label: string;
}

function makeRows(count: number): Row[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `row-${i}`,
    label: `Row ${i}`,
  }));
}

describe("VirtualizedLedgerTable", () => {
  it("under threshold: renders every row inline (no virtualization)", () => {
    const rows = makeRows(20);
    render(
      <VirtualizedLedgerTable<Row>
        rows={rows}
        threshold={50}
        getRowKey={(r) => r.id}
        renderRow={(r) => <div data-testid={`r-${r.id}`}>{r.label}</div>}
        testId="vlt-small"
      />,
    );

    // All 20 rows should be present.
    for (let i = 0; i < 20; i += 1) {
      expect(screen.getByTestId(`r-row-${i}`)).toBeInTheDocument();
    }
    // Inline mode marker.
    expect(screen.getByTestId("vlt-small-inline")).toBeInTheDocument();
  });

  it("above threshold: only the visible window is in the DOM", () => {
    const rows = makeRows(200);
    render(
      <VirtualizedLedgerTable<Row>
        rows={rows}
        threshold={50}
        estimateRowHeight={40}
        containerHeight={400}
        overscan={4}
        getRowKey={(r) => r.id}
        renderRow={(r) => <div data-testid={`r-${r.id}`}>{r.label}</div>}
        testId="vlt-big"
      />,
    );

    // Virtualized container is mounted.
    expect(screen.getByTestId("vlt-big")).toBeInTheDocument();

    // jsdom does not honor scroll geometry the same way a real browser
    // does, so we simply assert that the DOM-row count is significantly
    // less than the input length and that the first few rows are
    // present — the virtualization windowing has demonstrably kicked
    // in if every-row-rendered would mean 200 nodes.
    const rendered = document.querySelectorAll("[data-virtual-index]");
    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered.length).toBeLessThan(rows.length);
    // ~window of 10 (400/40) + overscan(4*2) = ~18; allow generous slack.
    expect(rendered.length).toBeLessThanOrEqual(50);

    // First row is in the visible window so the user can interact with it.
    expect(screen.getByTestId("r-row-0")).toBeInTheDocument();
  });

  it("preserves interactive content (button clicks fire) in virtualized mode", () => {
    const rows = makeRows(200);
    const handler = vi.fn();
    render(
      <VirtualizedLedgerTable<Row>
        rows={rows}
        threshold={50}
        estimateRowHeight={40}
        containerHeight={400}
        getRowKey={(r) => r.id}
        renderRow={(r) => (
          <button data-testid={`btn-${r.id}`} onClick={() => handler(r.id)} type="button">
            {r.label}
          </button>
        )}
      />,
    );

    fireEvent.click(screen.getByTestId("btn-row-0"));
    expect(handler).toHaveBeenCalledWith("row-0");
  });
});
