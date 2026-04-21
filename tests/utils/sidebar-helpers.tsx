/**
 * Sidebar rendering helpers for the 3.3 Q4 Tier 3 sidebar smoke tests.
 *
 * These helpers render `AppSidebar` with a seeded auth session and expose
 * static assertion APIs for nav-item visibility per the 0.2 boundary matrix.
 *
 * Per ADR 0b, `renderSidebar` mounts the real `AppSidebar` inside a minimal
 * jsdom harness: `QueryClientProvider` seeded with the shared auth-session
 * cache entry (`["/api/auth/me", "session"]`), a wouter router pinned to a
 * caller-supplied initial path via `memoryLocation`, and the `SidebarProvider`
 * required by the shadcn/ui sidebar primitives. Returns the
 * `@testing-library/react` render result so callers can query the DOM.
 */

import React from "react";
import { render, type RenderResult } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import type { AuthSession } from "@/hooks/useAdminRole";
import type { AdminRole } from "@shared/schema";

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
 * Options controlling how `renderSidebar` seeds the harness.
 *
 * - `role` / `authResolved`: seed the shared `["/api/auth/me", "session"]`
 *   query-cache entry so any current or future consumer that reads the
 *   auth session (e.g. Phase 11's `canAccess`) observes the right state.
 *   AppSidebar itself currently takes `adminRole` as a prop; we pass the
 *   same value through so the present-day behaviour is exercised.
 * - `activeAssociationId`: seeded into the query cache under
 *   `["active-association"]` for forward-compat. AppSidebar today reads
 *   the active association through `AssociationContext`; the sidebar
 *   renders correctly against the default empty context so no provider
 *   is required for minimal smoke coverage.
 * - `initialPath`: initial wouter location (defaults to `/app`).
 */
export interface RenderSidebarOptions {
  role?: AdminRole | null;
  authResolved?: boolean;
  activeAssociationId?: string;
  initialPath?: string;
}

/**
 * Render the real `AppSidebar` inside a jsdom harness with a seeded
 * auth-session query-cache entry. Returns the `@testing-library/react`
 * render result so callers can query the DOM for nav items.
 *
 * Dependencies observed on AppSidebar (as of Phase 0b.2):
 *   - `SidebarProvider` from `@/components/ui/sidebar` (context + TooltipProvider).
 *   - `QueryClientProvider` (any child component may call `useQuery`).
 *   - A wouter `Router` (AppSidebar calls `useLocation`).
 *   - `useActiveAssociation` → `useAssociationContext`. The default context
 *     value (`associations: []`, `activeAssociationId: ""`) is safe; no
 *     `AssociationProvider` is required for the sidebar to render.
 *   - `adminRole` prop drives visibility in the current implementation;
 *     Phase 11 rewrites this to consume `canAccess` from the seeded
 *     auth-session cache entry.
 */
export function renderSidebar(options: RenderSidebarOptions = {}): RenderResult {
  const { role, authResolved = true, activeAssociationId, initialPath = "/app" } = options;

  // jsdom ships without `window.matchMedia`. The shadcn `SidebarProvider`
  // uses `useIsMobile` → `window.matchMedia`, so stub a no-op implementation
  // if the current environment doesn't provide one. Scoped to the helper so
  // we don't affect global setup or non-sidebar client tests.
  if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
    },
  });

  if (authResolved) {
    const session: AuthSession = role
      ? {
          authenticated: true,
          admin: { id: `test-${role}`, email: `${role}@test`, role },
        }
      : { authenticated: false, admin: null };
    queryClient.setQueryData(["/api/auth/me", "session"], session);
  }

  if (activeAssociationId) {
    queryClient.setQueryData(["active-association"], activeAssociationId);
  }

  const { hook } = memoryLocation({ path: initialPath });

  return render(
    <QueryClientProvider client={queryClient}>
      <Router hook={hook}>
        <SidebarProvider>
          <AppSidebar adminRole={role ?? null} />
        </SidebarProvider>
      </Router>
    </QueryClientProvider>,
  );
}
