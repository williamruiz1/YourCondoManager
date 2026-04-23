/**
 * Unit tests for `tests/utils/sidebar-helpers.tsx`.
 *
 * Validates that the Phase 0b.2 `renderSidebar` helper mounts the real
 * `AppSidebar` in jsdom with a seeded auth session, and that the static
 * exports (getVisibleNavItems, assertNavItemVisible) behave as expected.
 *
 * Full persona × route matrix coverage is Phase 10's job — these tests
 * only verify the helper itself works end-to-end.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from "vitest";

import {
  renderSidebar,
  getVisibleNavItems,
  SIDEBAR_NAV_ITEMS,
} from "./sidebar-helpers";

describe("renderSidebar", () => {
  it("renders AppSidebar without crashing for an authenticated manager", () => {
    const { container, unmount } = renderSidebar({ role: "manager" });

    // The shadcn sidebar primitive renders a <div data-slot="sidebar-wrapper">
    // at its root and a nested element with data-testid="text-app-title" in
    // the header. Either being present confirms the component mounted.
    expect(container.querySelector("[data-testid='text-app-title']")).not.toBeNull();

    unmount();
  });

  it("renders at least one nav item in the DOM", () => {
    const { container, unmount } = renderSidebar({ role: "manager" });

    // AppSidebar renders each nav item as a Link with
    // data-testid="link-nav-<slug>". We assert at least one such link exists
    // and that its label matches a known entry in SIDEBAR_NAV_ITEMS.
    const navLinks = container.querySelectorAll("[data-testid^='link-nav-']");
    expect(navLinks.length).toBeGreaterThan(0);

    const labels = Array.from(navLinks)
      .map((el) => el.textContent?.trim() ?? "")
      .filter(Boolean);

    const knownLabels = new Set<string>(SIDEBAR_NAV_ITEMS);
    const matched = labels.some((label) =>
      // Some labels include a material-symbols glyph before the text, so
      // check containment rather than strict equality.
      [...knownLabels].some((known) => label.includes(known)),
    );
    expect(matched, `expected at least one nav label to match SIDEBAR_NAV_ITEMS; got: ${labels.join(", ")}`).toBe(true);

    unmount();
  });

  it("renders without crashing when auth is unresolved (loading state)", () => {
    // authResolved:false models the pre-session window — AppSidebar must not
    // throw in this state even though no seeded session is present in the
    // query cache.
    const { container, unmount } = renderSidebar({ role: null, authResolved: false });
    expect(container).toBeTruthy();
    // The header with app title is role-independent and should still mount.
    expect(container.querySelector("[data-testid='text-app-title']")).not.toBeNull();
    unmount();
  });

  it("accepts an initialPath and an activeAssociationId without crashing", () => {
    // Smoke-test the optional options so regressions in option wiring surface
    // in CI rather than at first real use-site.
    const { container, unmount } = renderSidebar({
      role: "platform-admin",
      initialPath: "/app/platform/controls",
      activeAssociationId: "test-association-1",
    });
    expect(container.querySelector("[data-testid='text-app-title']")).not.toBeNull();
    unmount();
  });
});

describe("getVisibleNavItems (sanity)", () => {
  it("returns the hardcoded manager map unchanged", () => {
    const managerItems = getVisibleNavItems("manager");

    // Manager sees everything except the three platform-only entries.
    expect(managerItems).toContain("Home");
    expect(managerItems).toContain("Associations");
    expect(managerItems).toContain("Billing");
    expect(managerItems).not.toContain("Platform Controls");
    expect(managerItems).not.toContain("Admin Roadmap");
    expect(managerItems).not.toContain("AI Ingestion");
  });

  it("returns the platform-admin-restricted map unchanged", () => {
    const platformItems = getVisibleNavItems("platform-admin");
    expect([...platformItems].sort()).toEqual(
      ["Home", "Platform Controls", "Admin Roadmap", "AI Ingestion"].sort(),
    );
  });
});
