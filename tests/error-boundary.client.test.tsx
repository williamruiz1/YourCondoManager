/**
 * 5.2 — ErrorBoundary tests.
 *
 * Spec: docs/projects/platform-overhaul/decisions/5.2-error-states.md
 *
 * Covers:
 *   - catches a throwing child and renders <ErrorState>
 *   - shows Retry button and clears the error on retry
 *   - invokes onError prop
 *   - honors custom fallback
 *   - reportError is called on catch
 *   - App.tsx wires ErrorBoundary at the root
 *
 * @vitest-environment jsdom
 */

import path from "node:path";
import { promises as fs } from "node:fs";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { ErrorBoundary } from "../client/src/components/error-boundary";

const REPO_ROOT = path.resolve(__dirname, "..");

function BoomOnce({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("boom");
  }
  return <div data-testid="boom-ok">ok</div>;
}

/** Throws the canonical deploy-invalidated (stale) lazy-chunk error. */
function ChunkBoom() {
  throw new Error(
    "Failed to fetch dynamically imported module: https://x/assets/foo-abc.js",
  );
}

describe("ErrorBoundary", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("renders children when they don't throw", () => {
    render(
      <ErrorBoundary>
        <BoomOnce shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId("boom-ok")).toBeInTheDocument();
  });

  it("catches a render error and renders ErrorState fallback", () => {
    render(
      <ErrorBoundary>
        <BoomOnce shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId("error-boundary-fallback")).toBeInTheDocument();
    expect(screen.getByTestId("error-state")).toBeInTheDocument();
    expect(screen.getByTestId("error-state-retry")).toBeInTheDocument();
  });

  it("invokes onError when a child throws", () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError}>
        <BoomOnce shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(onError).toHaveBeenCalledTimes(1);
    const [err] = onError.mock.calls[0];
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe("boom");
  });

  it("calls reportError (observed via console.error shim)", () => {
    render(
      <ErrorBoundary>
        <BoomOnce shouldThrow={true} />
      </ErrorBoundary>,
    );
    // `reportError` routes through `captureClientError` (per founder-os#1030
    // observability wiring) — which logs with the `[captureClientError]`
    // marker. Test asserts the side-effect path stayed reachable.
    const matched = consoleError.mock.calls.some((args) =>
      args.some((a) => typeof a === "string" && a.includes("[captureClientError]")),
    );
    expect(matched).toBe(true);
  });

  it("renders a custom fallback when provided", () => {
    render(
      <ErrorBoundary fallback={<div data-testid="my-fallback">alt</div>}>
        <BoomOnce shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId("my-fallback")).toBeInTheDocument();
    expect(screen.queryByTestId("error-state")).toBeNull();
  });

  it("clears the error state when retry is clicked", () => {
    let shouldThrow = true;
    function Toggler() {
      return <BoomOnce shouldThrow={shouldThrow} />;
    }
    const { rerender } = render(
      <ErrorBoundary>
        <Toggler />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId("error-state-retry")).toBeInTheDocument();
    shouldThrow = false;
    fireEvent.click(screen.getByTestId("error-state-retry"));
    rerender(
      <ErrorBoundary>
        <Toggler />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId("boom-ok")).toBeInTheDocument();
  });
});

describe("ErrorBoundary — stale-chunk recovery (deploy-invalidated lazy chunks)", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;
  let reloadSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    window.sessionStorage.clear();
    reloadSpy = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload: reloadSpy },
    });
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("hard-reloads once on a stale-chunk error (no dead soft-retry)", () => {
    render(
      <ErrorBoundary>
        <ChunkBoom />
      </ErrorBoundary>,
    );
    // The boundary self-heals by fetching the fresh build.
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    // A reload timestamp is recorded so a recurrence within the cooldown
    // does NOT loop.
    expect(
      window.sessionStorage.getItem("ycm:chunk-boundary-reload-at"),
    ).toBeTruthy();
  });

  it("does NOT auto-reload again within the cooldown; shows a hard-reload action instead", () => {
    // Simulate: a reload was just attempted (cooldown active).
    window.sessionStorage.setItem(
      "ycm:chunk-boundary-reload-at",
      String(Date.now()),
    );
    render(
      <ErrorBoundary>
        <ChunkBoom />
      </ErrorBoundary>,
    );
    // No auto-reload loop.
    expect(reloadSpy).not.toHaveBeenCalled();
    // A working manual reload action is shown.
    const retry = screen.getByTestId("error-state-retry");
    expect(retry).toBeInTheDocument();
    fireEvent.click(retry);
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it("a stale-chunk error overrides a custom fallback (a missing chunk needs a reload)", () => {
    window.sessionStorage.setItem(
      "ycm:chunk-boundary-reload-at",
      String(Date.now()),
    );
    render(
      <ErrorBoundary fallback={<div data-testid="my-fallback">alt</div>}>
        <ChunkBoom />
      </ErrorBoundary>,
    );
    // The reload UI wins over the custom panel fallback.
    expect(screen.queryByTestId("my-fallback")).toBeNull();
    expect(screen.getByTestId("error-boundary-fallback")).toBeInTheDocument();
  });

  it("a NON-chunk error still uses the normal soft-retry ErrorState", () => {
    render(
      <ErrorBoundary>
        <BoomOnce shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(reloadSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId("error-state")).toBeInTheDocument();
  });
});

describe("ErrorBoundary — wiring", () => {
  it("App.tsx wraps the authenticated tree with ErrorBoundary", async () => {
    const source = await fs.readFile(
      path.join(REPO_ROOT, "client/src/App.tsx"),
      "utf8",
    );
    expect(source).toMatch(
      /from "@\/components\/error-boundary"/,
    );
    expect(source).toMatch(/<ErrorBoundary>/);
  });
});
