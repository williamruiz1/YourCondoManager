// zone: Financials
// 5.4-F7 (Wave 16b) — Virtualized ledger table.
//
// Long ledger surfaces (portal owner ledger, operator ledger) routinely
// render hundreds of rows. The previous implementation rendered every
// row into the DOM at once; with 200+ entries that became the dominant
// cost on first paint of the ledger sub-pages.
//
// This component uses `@tanstack/react-virtual` to keep only the rows in
// the visible window mounted (typically ~30 of 200). The `threshold`
// prop guards against virtualizing tiny tables — virtualization adds
// scroll-container chrome and a tiny per-row scheduling cost, so the
// 5.4 audit explicitly recommends bypassing it under 50 rows.
//
// The component is intentionally render-prop based so callers keep full
// control over per-cell formatting + click handlers; the only
// constraint is that every row has a stable identity and a uniform
// approximate row height.

import { useRef, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

export interface VirtualizedLedgerTableProps<T> {
  rows: T[];
  /** Caller supplies a stable React key for each row. */
  getRowKey: (row: T, index: number) => string;
  /** Render the visual content of one row. */
  renderRow: (row: T, index: number) => ReactNode;
  /** Approximate row height in CSS pixels (used for windowing math). */
  estimateRowHeight?: number;
  /** Max scroll-container height in CSS pixels. Defaults to 600. */
  containerHeight?: number;
  /** Extra rows rendered above/below the viewport for smooth scrolling. */
  overscan?: number;
  /**
   * Below this row count, virtualization is skipped and every row is
   * rendered directly (preserves accessibility + simplifies DOM for tiny
   * tables). Default: 50.
   */
  threshold?: number;
  /** Optional className for the scrolling container. */
  className?: string;
  /** Optional data-testid prefix on the scroll container. */
  testId?: string;
}

export function VirtualizedLedgerTable<T>({
  rows,
  getRowKey,
  renderRow,
  estimateRowHeight = 48,
  containerHeight = 600,
  overscan = 8,
  threshold = 50,
  className,
  testId,
}: VirtualizedLedgerTableProps<T>) {
  const parentRef = useRef<HTMLDivElement | null>(null);

  // Below threshold: render every row inline. No scroll container.
  if (rows.length <= threshold) {
    return (
      <div data-testid={testId ? `${testId}-inline` : undefined} className={className}>
        {rows.map((row, idx) => (
          <div key={getRowKey(row, idx)}>{renderRow(row, idx)}</div>
        ))}
      </div>
    );
  }

  return (
    <VirtualizedBody
      rows={rows}
      getRowKey={getRowKey}
      renderRow={renderRow}
      estimateRowHeight={estimateRowHeight}
      containerHeight={containerHeight}
      overscan={overscan}
      className={className}
      testId={testId}
      parentRef={parentRef}
    />
  );
}

interface VirtualizedBodyProps<T> {
  rows: T[];
  getRowKey: (row: T, index: number) => string;
  renderRow: (row: T, index: number) => ReactNode;
  estimateRowHeight: number;
  containerHeight: number;
  overscan: number;
  className?: string;
  testId?: string;
  parentRef: React.MutableRefObject<HTMLDivElement | null>;
}

function VirtualizedBody<T>({
  rows,
  getRowKey,
  renderRow,
  estimateRowHeight,
  containerHeight,
  overscan,
  className,
  testId,
  parentRef,
}: VirtualizedBodyProps<T>) {
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateRowHeight,
    overscan,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  return (
    <div
      ref={parentRef}
      className={className}
      style={{ height: containerHeight, overflow: "auto" }}
      data-testid={testId}
    >
      <div style={{ height: totalSize, width: "100%", position: "relative" }}>
        {virtualItems.map((virtualRow) => {
          const row = rows[virtualRow.index];
          return (
            <div
              key={getRowKey(row, virtualRow.index)}
              data-virtual-index={virtualRow.index}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {renderRow(row, virtualRow.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
