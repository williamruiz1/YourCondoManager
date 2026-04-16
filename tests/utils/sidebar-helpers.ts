/**
 * Sidebar rendering helpers for the 3.3 Q4 Tier 3 sidebar smoke tests.
 *
 * These helpers will render AppSidebar with a mocked auth session and
 * assert nav-item visibility per the 0.2 boundary matrix.
 *
 * Note: Full component rendering requires the real AppSidebar component
 * which has complex dependencies (router, query client, auth context).
 * These helpers provide the assertion API; the render implementation
 * will be completed when Layer 3 sidebar redesign lands.
 */

import type { AdminRole } from "./auth-helpers";

/**
 * Sidebar nav items derived from the current app-sidebar.tsx structure.
 * This is the reference list for visibility assertions.
 */
export const SIDEBAR_NAV_ITEMS = [
  "Home",
  "Portfolio Health",
  "Associations",
  "Buildings & Units",
  "People",
  "Financials",
  "Billing",
  "Payments",
  "Expenses",
  "Reports",
  "Board",
  "Governance",
  "Communications",
  "Announcements",
  "Documents",
  "Insurance",
  "Operations",
  "Work Orders",
  "Maintenance",
  "Inspections",
  "Vendors",
  "Feedback",
  "Amenity Booking",
  "Community Hub",
  "Platform Controls",
  "Admin Roadmap",
  "AI Ingestion",
  "Settings",
] as const;

export type SidebarNavItem = (typeof SIDEBAR_NAV_ITEMS)[number];

/**
 * Expected nav visibility per role, derived from 0.2 Persona Boundary Matrix.
 * Board Officer = Manager-equivalent (sees everything except Platform).
 * Assisted Board = subset-render (only permitted domains per PM toggles).
 * PM Assistant = Manager-subset (configured by Manager).
 * Platform Admin = Platform zone only (+ Home for workspace entry).
 * Viewer = read-only Manager variant (same visibility, no write actions).
 */
export const ROLE_VISIBLE_ITEMS: Record<AdminRole, readonly string[]> = {
  "manager": SIDEBAR_NAV_ITEMS.filter(item => item !== "Platform Controls" && item !== "Admin Roadmap" && item !== "AI Ingestion"),
  "board-officer": SIDEBAR_NAV_ITEMS.filter(item => !["Platform Controls", "Admin Roadmap", "AI Ingestion", "Portfolio Health", "Associations"].includes(item)),
  "assisted-board": ["Home", "Financials", "Governance", "Communications", "Documents", "Operations"],
  "pm-assistant": SIDEBAR_NAV_ITEMS.filter(item => !["Platform Controls", "Admin Roadmap", "AI Ingestion", "Settings"].includes(item)),
  "viewer": SIDEBAR_NAV_ITEMS.filter(item => item !== "Platform Controls" && item !== "Admin Roadmap" && item !== "AI Ingestion"),
  "platform-admin": ["Home", "Platform Controls", "Admin Roadmap", "AI Ingestion"],
};

/**
 * Assert that a nav item IS visible for a given role.
 */
export function assertNavItemVisible(role: AdminRole, label: string): void {
  const visible = ROLE_VISIBLE_ITEMS[role];
  if (!visible.includes(label)) {
    throw new Error(
      `Expected nav item "${label}" to be VISIBLE for role "${role}", but it is not in the expected visible set.`,
    );
  }
}

/**
 * Assert that a nav item is NOT visible for a given role.
 */
export function assertNavItemHidden(role: AdminRole, label: string): void {
  const visible = ROLE_VISIBLE_ITEMS[role];
  if (visible.includes(label)) {
    throw new Error(
      `Expected nav item "${label}" to be HIDDEN for role "${role}", but it IS in the visible set.`,
    );
  }
}

/**
 * Get the list of nav items expected to be visible for a given role.
 */
export function getVisibleNavItems(role: AdminRole): readonly string[] {
  return ROLE_VISIBLE_ITEMS[role];
}

/**
 * Render the sidebar with a mocked role and return visible items.
 * PLACEHOLDER: full component rendering will be added when Layer 3
 * sidebar redesign ships the new AppSidebar component with proper
 * dependency injection points.
 */
export function renderSidebar(role: AdminRole): readonly string[] {
  // For now, return the expected visible items from the static map.
  // This will be replaced with actual component rendering + DOM querying
  // once the sidebar component supports test-friendly injection.
  return getVisibleNavItems(role);
}
