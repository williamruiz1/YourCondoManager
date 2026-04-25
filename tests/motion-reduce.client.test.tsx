/**
 * 5.8 — prefers-reduced-motion smoke test (Wave 29).
 *
 * Spec: docs/projects/platform-overhaul/decisions/5.8-motion-reduce-audit.md
 *
 * jsdom does not honor `(prefers-reduced-motion: reduce)` natively — the
 * matchMedia stub from the client setup file always reports `matches: false`.
 * Rather than fight jsdom, we assert two static contracts that ARE shipped to
 * the real browser:
 *
 *   1. The shadcn primitives carry `motion-reduce:` Tailwind variants in their
 *      class lists. Because Tailwind compiles `motion-reduce:` to a real CSS
 *      class behind a `@media (prefers-reduced-motion: reduce)` block, the
 *      mere presence of the class on the rendered element is sufficient to
 *      prove the suppression will fire when the OS reports reduce-motion.
 *
 *   2. The `prefersReducedMotion()` helper respects a stubbed
 *      `window.matchMedia` mock — covering the imperative scroll path that
 *      Tailwind variants cannot reach.
 *
 * @vitest-environment jsdom
 */

import path from "node:path";
import { promises as fs } from "node:fs";
import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { Skeleton } from "../client/src/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "../client/src/components/ui/dialog";
import {
  prefersReducedMotion,
  getScrollBehavior,
} from "../client/src/lib/prefers-reduced-motion";

const REPO_ROOT = path.resolve(__dirname, "..");

describe("5.8 motion-reduce — Skeleton", () => {
  it("emits motion-reduce:animate-none class", () => {
    const { container } = render(<Skeleton data-testid="sk" className="h-4 w-12" />);
    const node = container.firstElementChild as HTMLElement;
    expect(node.className).toMatch(/animate-pulse/);
    expect(node.className).toMatch(/motion-reduce:animate-none/);
  });
});

describe("5.8 motion-reduce — Dialog overlay + content", () => {
  it("Dialog overlay class list includes motion-reduce overrides", () => {
    render(
      <Dialog defaultOpen>
        <DialogTrigger>open</DialogTrigger>
        <DialogContent data-testid="dc">
          <DialogTitle>title</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    const content = screen.getByTestId("dc");
    expect(content.className).toMatch(/motion-reduce:transition-none/);
    expect(content.className).toMatch(/motion-reduce:animate-none/);
  });
});

describe("5.8 motion-reduce — prefersReducedMotion() helper", () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("returns true when matchMedia reports matches=true", () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    expect(prefersReducedMotion()).toBe(true);
  });

  it("returns false when matchMedia reports matches=false", () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    expect(prefersReducedMotion()).toBe(false);
  });

  it("getScrollBehavior() returns 'auto' when reduce is set", () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    expect(getScrollBehavior()).toBe("auto");
    expect(getScrollBehavior("smooth")).toBe("auto");
  });

  it("getScrollBehavior() returns 'smooth' when reduce is NOT set", () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    expect(getScrollBehavior()).toBe("smooth");
  });
});

describe("5.8 motion-reduce — global CSS", () => {
  it("index.css contains the prefers-reduced-motion media block", async () => {
    const css = await fs.readFile(
      path.join(REPO_ROOT, "client/src/index.css"),
      "utf8",
    );
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: no-preference\)/);
    // Spinner exception: still rotates so loading state stays visible.
    expect(css).toMatch(/\.animate-spin\s*\{[\s\S]*animation-duration/);
  });
});

describe("5.8 motion-reduce — call-site adoption", () => {
  it("imperative scrollIntoView call sites route through getScrollBehavior", async () => {
    const units = await fs.readFile(
      path.join(REPO_ROOT, "client/src/pages/units.tsx"),
      "utf8",
    );
    const board = await fs.readFile(
      path.join(REPO_ROOT, "client/src/pages/board-portal.tsx"),
      "utf8",
    );
    expect(units).toMatch(/getScrollBehavior\(\)/);
    expect(board).toMatch(/getScrollBehavior\(\)/);
    // No raw `behavior: "smooth"` strings should remain in these files.
    expect(units).not.toMatch(/behavior:\s*"smooth"/);
    expect(board).not.toMatch(/behavior:\s*"smooth"/);
  });
});
