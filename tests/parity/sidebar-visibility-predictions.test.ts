/**
 * Phase 10 parity-harness skeleton — sidebar visibility predictions.
 *
 * Asserts the Wave 6 sidebar helpers' hardcoded ROLE_VISIBLE_ITEMS map
 * is internally coherent with the SIDEBAR_NAV_ITEMS canonical list and
 * the 0.2 Persona Boundary Matrix. Does NOT render AppSidebar — pure
 * data-level check on the scaffolded visibility map.
 *
 * When Phase 11 rebuilds the sidebar atop the manifest, this test will
 * be extended to also assert parity between the sidebar's DOM output
 * and the manifest's predictions.
 */

import { describe, it, expect } from "vitest";
import {
  ROLE_VISIBLE_ITEMS,
  SIDEBAR_NAV_ITEMS,
} from "../utils/sidebar-helpers";
import { ALL_ADMIN_ROLES } from "../utils/auth-helpers";

const PLATFORM_ONLY_ITEMS = ["Platform Controls", "Admin Roadmap", "AI Ingestion"] as const;

describe("parity: sidebar-visibility — Manager visibility", () => {
  const managerVisible = ROLE_VISIBLE_ITEMS["manager"];

  it("sees every nav item EXCEPT the three platform-only items", () => {
    for (const item of SIDEBAR_NAV_ITEMS) {
      if (PLATFORM_ONLY_ITEMS.includes(item as typeof PLATFORM_ONLY_ITEMS[number])) {
        expect(managerVisible, `Manager should NOT see "${item}"`).not.toContain(item);
      } else {
        expect(managerVisible, `Manager should see "${item}"`).toContain(item);
      }
    }
  });

  it("does not include any unknown nav labels", () => {
    for (const label of managerVisible) {
      expect(SIDEBAR_NAV_ITEMS as readonly string[]).toContain(label);
    }
  });
});

describe("parity: sidebar-visibility — Platform Admin isolation", () => {
  const platformVisible = ROLE_VISIBLE_ITEMS["platform-admin"];

  it("sees ONLY Home + the three platform items", () => {
    const expected = ["Home", ...PLATFORM_ONLY_ITEMS].sort();
    const actual = [...platformVisible].sort();
    expect(actual).toEqual(expected);
  });

  it("does NOT see any customer-content item", () => {
    const customerItems = ["Financials", "Billing", "Associations", "Documents", "Work Orders"];
    for (const item of customerItems) {
      expect(platformVisible, `Platform Admin must NOT see "${item}"`).not.toContain(item);
    }
  });
});

describe("parity: sidebar-visibility — Assisted Board is a strict subset of Manager", () => {
  const managerVisible = new Set(ROLE_VISIBLE_ITEMS["manager"]);
  const assistedVisible = ROLE_VISIBLE_ITEMS["assisted-board"];

  it("every Assisted Board visible item also appears in Manager's visible set", () => {
    for (const item of assistedVisible) {
      expect(managerVisible.has(item), `"${item}" is visible to Assisted Board but NOT to Manager`).toBe(true);
    }
  });

  it("is a proper (strict) subset — Manager sees at least one item Assisted Board does not", () => {
    const assistedSet = new Set(assistedVisible);
    const strictlyMore = ROLE_VISIBLE_ITEMS["manager"].some((item) => !assistedSet.has(item));
    expect(strictlyMore).toBe(true);
  });
});

describe("parity: sidebar-visibility — every nav item is used by at least one persona", () => {
  it("no SIDEBAR_NAV_ITEMS entry is orphaned across all roles", () => {
    const allVisible = new Set<string>();
    for (const role of ALL_ADMIN_ROLES) {
      for (const item of ROLE_VISIBLE_ITEMS[role]) {
        allVisible.add(item);
      }
    }
    for (const item of SIDEBAR_NAV_ITEMS) {
      expect(
        allVisible.has(item),
        `"${item}" appears in SIDEBAR_NAV_ITEMS but no persona can see it`,
      ).toBe(true);
    }
  });
});

describe("parity: sidebar-visibility — ROLE_VISIBLE_ITEMS coverage", () => {
  it("has an entry for every AdminRole", () => {
    for (const role of ALL_ADMIN_ROLES) {
      expect(ROLE_VISIBLE_ITEMS[role], `No visibility map for role "${role}"`).toBeDefined();
    }
  });

  it("every persona's visible items are all recognized SIDEBAR_NAV_ITEMS", () => {
    for (const role of ALL_ADMIN_ROLES) {
      for (const item of ROLE_VISIBLE_ITEMS[role]) {
        expect(
          SIDEBAR_NAV_ITEMS as readonly string[],
          `Role "${role}" lists unknown nav item "${item}"`,
        ).toContain(item);
      }
    }
  });

  it("every persona sees at least Home", () => {
    for (const role of ALL_ADMIN_ROLES) {
      expect(ROLE_VISIBLE_ITEMS[role], `Role "${role}" missing Home`).toContain("Home");
    }
  });
});
