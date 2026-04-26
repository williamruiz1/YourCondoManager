/**
 * Phase 11 (3.1) — Sidebar redesign smoke tests.
 *
 * Verifies the SUBSET-RENDER behavior (3.1 Q5): zones the persona is not
 * permitted to see are absent from the DOM (not greyed out, not collapsed,
 * not display:none). Every operator persona sees the Home zone; only
 * Platform Admin sees the Platform zone; Board Officer sees five zones
 * minus Platform.
 *
 * Also verifies:
 *   - The legacy `{activeAssociationName}` wrapper group is gone (3.1 Q2).
 *   - Zone-label clicks navigate to the canonical hub URLs (3.1 Q3 + 1.2 Q4).
 *   - Owner Portal launcher is absent (3.1 Q11 / 2.4 Q5).
 *   - `app-sidebar.tsx` has zero hardcoded `roles: [...]` literals
 *     (3.1 AC 39 — sidebar imports persona constants from a sibling module).
 *
 * @vitest-environment jsdom
 */

import path from "node:path";
import { promises as fs } from "node:fs";
import { describe, it, expect } from "vitest";

import { renderSidebar } from "./utils/sidebar-helpers";

const REPO_ROOT = path.resolve(__dirname, "..");

function getZoneLabels(container: HTMLElement): string[] {
  const groups = container.querySelectorAll("[data-sidebar='group-label']");
  return Array.from(groups)
    .map((el) => el.textContent?.trim() ?? "")
    .filter((label) => label.length > 0);
}

describe("Phase 11 — six zone-group labels (3.1 Q1)", () => {
  it("Manager sees five customer zones (Platform absent)", () => {
    const { container, unmount } = renderSidebar({ role: "manager" });
    const labels = getZoneLabels(container);
    expect(labels).toContain("Home");
    expect(labels).toContain("Financials");
    expect(labels).toContain("Operations");
    expect(labels).toContain("Governance");
    expect(labels).toContain("Communications");
    expect(labels).not.toContain("Platform");
    unmount();
  });

  it("Platform Admin sees Home + Platform (no customer zones)", () => {
    const { container, unmount } = renderSidebar({ role: "platform-admin" });
    const labels = getZoneLabels(container);
    expect(labels).toContain("Home");
    expect(labels).toContain("Platform");
    // Per 3.1 Q5 + 0.2 matrix — Platform Admin does NOT see customer-tenant
    // content zones.
    expect(labels).not.toContain("Financials");
    expect(labels).not.toContain("Operations");
    expect(labels).not.toContain("Governance");
    expect(labels).not.toContain("Communications");
    unmount();
  });

  it("Board Officer sees five zones minus Platform (3.1 Q5 derivation)", () => {
    const { container, unmount } = renderSidebar({ role: "board-officer" });
    const labels = getZoneLabels(container);
    expect(labels).toContain("Home");
    expect(labels).toContain("Financials");
    expect(labels).toContain("Operations");
    expect(labels).toContain("Governance");
    expect(labels).toContain("Communications");
    expect(labels).not.toContain("Platform");
    unmount();
  });

  it("Assisted Board sees a non-empty subset; never Platform", () => {
    const { container, unmount } = renderSidebar({ role: "assisted-board" });
    const labels = getZoneLabels(container);
    expect(labels.length).toBeGreaterThan(0);
    expect(labels).toContain("Home");
    expect(labels).not.toContain("Platform");
    unmount();
  });

  it("Unauthenticated session renders no zones (strict default-deny)", () => {
    const { container, unmount } = renderSidebar({ role: null });
    const labels = getZoneLabels(container);
    expect(labels.length).toBe(0);
    unmount();
  });
});

describe("Phase 11 — zone hub-URL links (3.1 Q3 + 1.2 Q4)", () => {
  it("clicking the Financials zone label targets /app/financials", () => {
    const { container, unmount } = renderSidebar({ role: "manager" });
    const link = container.querySelector('[data-testid="link-nav-zone-financials"]') as HTMLAnchorElement | null;
    expect(link).not.toBeNull();
    expect(link?.getAttribute("href")).toBe("/app/financials");
    unmount();
  });

  it("clicking the Operations zone label targets /app/operations", () => {
    const { container, unmount } = renderSidebar({ role: "manager" });
    const link = container.querySelector('[data-testid="link-nav-zone-operations"]') as HTMLAnchorElement | null;
    expect(link).not.toBeNull();
    expect(link?.getAttribute("href")).toBe("/app/operations");
    unmount();
  });

  it("clicking the Governance zone label targets /app/governance", () => {
    const { container, unmount } = renderSidebar({ role: "manager" });
    const link = container.querySelector('[data-testid="link-nav-zone-governance"]') as HTMLAnchorElement | null;
    expect(link).not.toBeNull();
    expect(link?.getAttribute("href")).toBe("/app/governance");
    unmount();
  });

  it("clicking the Communications zone label targets /app/communications", () => {
    const { container, unmount } = renderSidebar({ role: "manager" });
    const link = container.querySelector('[data-testid="link-nav-zone-communications"]') as HTMLAnchorElement | null;
    expect(link).not.toBeNull();
    expect(link?.getAttribute("href")).toBe("/app/communications");
    unmount();
  });

  it("Home zone label targets /app", () => {
    const { container, unmount } = renderSidebar({ role: "manager" });
    const link = container.querySelector('[data-testid="link-nav-zone-home"]') as HTMLAnchorElement | null;
    expect(link).not.toBeNull();
    expect(link?.getAttribute("href")).toBe("/app");
    unmount();
  });

  it("Platform zone label targets /app/platform/controls (Platform Admin)", () => {
    const { container, unmount } = renderSidebar({ role: "platform-admin" });
    const link = container.querySelector('[data-testid="link-nav-zone-platform"]') as HTMLAnchorElement | null;
    expect(link).not.toBeNull();
    expect(link?.getAttribute("href")).toBe("/app/platform/controls");
    unmount();
  });
});

describe("Phase 11 — retired surfaces (3.1 Q11 + Q2)", () => {
  it("no sidebar item links to /portal (Owner Portal launcher retired)", () => {
    const { container, unmount } = renderSidebar({ role: "platform-admin" });
    const portalLinks = Array.from(container.querySelectorAll("a")).filter(
      (a) => a.getAttribute("href") === "/portal",
    );
    expect(portalLinks).toHaveLength(0);
    unmount();
  });

  it("no `{activeAssociationName}` wrapper group is rendered (3.1 Q2)", () => {
    const { container, unmount } = renderSidebar({
      role: "manager",
      activeAssociationId: "assn-1",
    });
    // Group labels should be the six zone labels only — no group label
    // matching an association name pattern.
    const labels = getZoneLabels(container);
    const allowed = new Set([
      "Home",
      "Financials",
      "Operations",
      "Governance",
      "Communications",
      "Platform",
    ]);
    for (const label of labels) {
      expect(
        allowed.has(label),
        `Unexpected sidebar group label: "${label}"`,
      ).toBe(true);
    }
    unmount();
  });
});

describe("Phase 11 — sidebar association anchor (post-Phase-11 hotfix)", () => {
  // Regression coverage for the post-Phase-11 hotfix that restores the
  // clickable association anchor in the sidebar header. Pre-Phase-11 the
  // sidebar header advertised the active association as a `Link` to
  // `/app/association-context` (or a `Select association` CTA when no
  // association was active). Phase 11 turned the active-association badge
  // into a non-clickable `<div>` and dropped the empty-state CTA entirely,
  // so a freshly-logged-in user (cleared localStorage → no active
  // association yet) saw no association name and no CTA — only the
  // top-app-bar `<Select>` switcher, which a Platform Admin with a long
  // platform-wide dropdown cannot easily scan to find their HOA. This
  // suite locks the restoration in place.

  it("renders a clickable Link to /app/association-context when an association is active", () => {
    const { container, unmount } = renderSidebar({
      role: "platform-admin",
      activeAssociationId: "assn-1",
    });
    const anchor = container.querySelector(
      '[data-testid="link-selected-association-overview"]',
    ) as HTMLAnchorElement | null;
    expect(anchor).not.toBeNull();
    expect(anchor?.tagName.toLowerCase()).toBe("a");
    expect(anchor?.getAttribute("href")).toBe("/app/association-context");
    unmount();
  });

  it("renders a 'Select association' Link to /app/associations when no active association", () => {
    // No `activeAssociationId` seeded — the sidebar must advertise an
    // empty-state CTA so the user can navigate to the associations
    // surface and pick one. Without this, a fresh login that hasn't
    // hydrated `activeAssociationId` yet shows nothing in the sidebar
    // header.
    const { container, unmount } = renderSidebar({ role: "platform-admin" });
    const cta = container.querySelector(
      '[data-testid="link-select-association"]',
    ) as HTMLAnchorElement | null;
    expect(cta).not.toBeNull();
    expect(cta?.tagName.toLowerCase()).toBe("a");
    expect(cta?.getAttribute("href")).toBe("/app/associations");
    unmount();
  });

  it("Platform Admin sees the sidebar Associations sub-link (Home zone)", () => {
    // Phase 11 declares Associations as a sub-item of the Home zone with
    // `roles: PORTFOLIO_OPERATORS` (which includes platform-admin). This
    // test asserts the rendered DOM matches the spec, so a future
    // refactor that drops platform-admin from PORTFOLIO_OPERATORS would
    // immediately fail this regression check rather than silently leaving
    // platform-admins without a sidebar entry to their HOA list.
    const { container, unmount } = renderSidebar({ role: "platform-admin" });
    const link = container.querySelector(
      '[data-testid="link-nav-associations"]',
    ) as HTMLAnchorElement | null;
    expect(link).not.toBeNull();
    expect(link?.getAttribute("href")).toBe("/app/associations");
    unmount();
  });
});

describe("Phase 11 — source-level invariants (3.1 AC 39)", () => {
  it("app-sidebar.tsx contains zero `roles: [` literals (excluding doc comments)", async () => {
    // Per 3.1 Q9 + AC 39: every role gate sources from the canonical
    // persona-derivation constants in a sibling module. The sidebar
    // component itself must contain ZERO inline `roles: [...]` arrays.
    // Strip block + line comments before scanning so we don't false-fail
    // on doc comments that mention the pattern.
    const raw = await fs.readFile(
      path.join(REPO_ROOT, "client/src/components/app-sidebar.tsx"),
      "utf8",
    );
    const stripped = raw
      .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
      .replace(/\/\/[^\n]*/g, ""); // line comments
    const matches = stripped.match(/roles\s*:\s*\[/g) ?? [];
    expect(
      matches.length,
      `app-sidebar.tsx must have zero inline 'roles: [' literals; found ${matches.length}`,
    ).toBe(0);
  });

  it("app-sidebar.tsx imports its zone tree from the sibling module", async () => {
    const source = await fs.readFile(
      path.join(REPO_ROOT, "client/src/components/app-sidebar.tsx"),
      "utf8",
    );
    expect(source).toMatch(/from "@\/components\/app-sidebar-zones"/);
    expect(source).toMatch(/SIDEBAR_ZONES/);
    expect(source).toMatch(/filterZonesForPersona/);
  });
});
