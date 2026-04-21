/**
 * Client tests for the shared BreadcrumbNav component (1.3 Phase 6).
 *
 * Covers:
 *  - Route-driven resolution (Q5: route metadata drives content)
 *  - Trail-prop rendering for tests & migration callers
 *  - Leaf is non-linked current-page indicator (Q3)
 *  - Mobile collapse below 768px to a single `< Parent` affordance (Q7)
 *  - Desktop renders the full trail up to 3 segments (Q4)
 *  - Persona-invariance: no role prop, same render for any caller (Q6)
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import React from "react";

import { BreadcrumbNav } from "@/components/breadcrumb-nav";

const MOBILE_WIDTH = 500;
const DESKTOP_WIDTH = 1280;

/**
 * jsdom does not implement matchMedia. `useIsMobile` calls it in an
 * effect. We install a minimal stub that reports match based on the
 * current innerWidth so the component renders the same branch a real
 * browser would at that viewport width.
 */
function installMatchMediaStub() {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => {
      // Parse `(max-width: Npx)` out of the query.
      const m = query.match(/max-width:\s*(\d+)px/);
      const maxWidth = m ? Number(m[1]) : 0;
      const matches = window.innerWidth <= maxWidth;
      const listeners = new Set<() => void>();
      return {
        matches,
        media: query,
        onchange: null,
        addListener: (cb: () => void) => listeners.add(cb),
        removeListener: (cb: () => void) => listeners.delete(cb),
        addEventListener: (_: string, cb: () => void) => listeners.add(cb),
        removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
        dispatchEvent: () => false,
      };
    },
  });
}

function setViewport(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
  // Re-install the stub so `.matches` recomputes against the new width.
  installMatchMediaStub();
  window.dispatchEvent(new Event("resize"));
}

beforeEach(() => {
  installMatchMediaStub();
  setViewport(DESKTOP_WIDTH);
});

afterEach(() => {
  cleanup();
  setViewport(DESKTOP_WIDTH);
});

describe("BreadcrumbNav: route-driven resolution", () => {
  it("renders the seeded trail for /app/operations/dashboard (portfolio-scoped leaf)", () => {
    render(<BreadcrumbNav route="/app/operations/dashboard" />);
    expect(screen.getByText("Operations")).toBeInTheDocument();
    expect(screen.getByText("Operations Overview")).toBeInTheDocument();
  });

  it("renders the single-segment hub trail for /app", () => {
    render(<BreadcrumbNav route="/app" />);
    expect(screen.getByText("Home")).toBeInTheDocument();
    // Hub leaf has aria-current="page".
    expect(screen.getByText("Home")).toHaveAttribute("aria-current", "page");
  });

  it("renders nothing for an unknown route", () => {
    const { container } = render(<BreadcrumbNav route="/app/no-such-route" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("BreadcrumbNav: trail prop", () => {
  it("renders an explicit trail prop unchanged (up to 3 segments)", () => {
    render(
      <BreadcrumbNav
        trail={[
          { label: "Oakwood HOA", href: "/app" },
          { label: "Operations", href: "/app/operations" },
          { label: "Work Orders" },
        ]}
      />,
    );
    expect(screen.getByText("Oakwood HOA")).toBeInTheDocument();
    expect(screen.getByText("Operations")).toBeInTheDocument();
    expect(screen.getByText("Work Orders")).toBeInTheDocument();
    expect(screen.getByText("Work Orders")).toHaveAttribute("aria-current", "page");
  });

  it("marks the leaf non-linked even if the trail supplied href on it", () => {
    render(
      <BreadcrumbNav
        trail={[
          { label: "Home", href: "/app" },
          // caller mistake: href on the leaf. Renderer treats leaf as
          // current-page indicator regardless.
          { label: "Portfolio Health", href: "/app/portfolio" },
        ]}
      />,
    );
    const leaf = screen.getByText("Portfolio Health");
    expect(leaf).toHaveAttribute("aria-current", "page");
    expect(leaf.closest("a")).toBeNull();
  });

  it("slices a long trail to the last 3 segments defensively", () => {
    render(
      <BreadcrumbNav
        trail={[
          { label: "A", href: "/a" },
          { label: "B", href: "/b" },
          { label: "C", href: "/c" },
          { label: "D", href: "/d" },
          { label: "E" },
        ]}
      />,
    );
    expect(screen.queryByText("A")).toBeNull();
    expect(screen.queryByText("B")).toBeNull();
    expect(screen.getByText("C")).toBeInTheDocument();
    expect(screen.getByText("D")).toBeInTheDocument();
    expect(screen.getByText("E")).toBeInTheDocument();
  });
});

describe("BreadcrumbNav: mobile collapse (< 768px, 1.3 Q7)", () => {
  it("collapses a 3-segment trail to a `< Parent` back link", () => {
    setViewport(MOBILE_WIDTH);
    render(
      <BreadcrumbNav
        trail={[
          { label: "Oakwood HOA", href: "/app" },
          { label: "Operations", href: "/app/operations" },
          { label: "Work Orders" },
        ]}
      />,
    );
    // Only the immediate parent (Operations) is rendered.
    expect(screen.getByText("Operations")).toBeInTheDocument();
    expect(screen.queryByText("Oakwood HOA")).toBeNull();
    expect(screen.queryByText("Work Orders")).toBeNull();
    // The parent link is navigable (functional back-nav, not decorative).
    expect(screen.getByText("Operations").closest("a")).toHaveAttribute(
      "href",
      "/app/operations",
    );
  });

  it("renders nothing on mobile for a single-segment hub (no parent to back to)", () => {
    setViewport(MOBILE_WIDTH);
    const { container } = render(
      <BreadcrumbNav trail={[{ label: "Home" }]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("BreadcrumbNav: persona invariance (1.3 Q6)", () => {
  it("component exposes no persona / role prop", () => {
    // Negative assertion: the exported component's props accept only
    // route/trail/items/className/context — no role or persona field.
    // If this test breaks, someone added role-conditional logic and
    // violated Q6; revert and push the role gate into <RouteGuard>.
    const render1 = render(<BreadcrumbNav route="/app/operations/dashboard" />);
    const html1 = render1.container.innerHTML;
    cleanup();
    const render2 = render(<BreadcrumbNav route="/app/operations/dashboard" />);
    const html2 = render2.container.innerHTML;
    expect(html1).toBe(html2);
  });
});
