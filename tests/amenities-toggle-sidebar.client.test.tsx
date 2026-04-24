/**
 * 4.2 Q3 addendum (3a) — Wave 1 amenities toggle.
 *
 * Verifies the Manager sidebar omits the "Amenity Booking" link when the
 * active association has `amenitiesEnabled = 0` and keeps it when the
 * column is `1`. The AppSidebar reads `activeAssociation` via
 * `useAssociationContext`, which in turn hydrates from the
 * `["/api/associations"]` query — we seed both so the rendered sidebar
 * observes the disabled state without a real network call.
 *
 * @vitest-environment jsdom
 */

import React from "react";
import { describe, it, expect } from "vitest";
import { render, type RenderResult } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AssociationProvider } from "@/context/association-context";

type ActiveAssociationSeed = {
  id: string;
  name: string;
  amenitiesEnabled: 0 | 1;
};

function renderSidebarWithAssociation(opts: {
  activeAssociation: ActiveAssociationSeed;
  role?: "manager" | "board-officer" | "platform-admin";
}): RenderResult {
  // jsdom lacks matchMedia; SidebarProvider uses it via useIsMobile.
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

  // Pin the AssociationContext's active id to the seeded association so
  // the sidebar treats it as "active" from first render. The context reads
  // this key from localStorage when the provider mounts.
  window.localStorage.setItem("activeAssociationId", opts.activeAssociation.id);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } },
  });

  // Seed the associations list so AssociationProvider resolves the active
  // association without issuing a network request.
  queryClient.setQueryData(["/api/associations"], [
    {
      id: opts.activeAssociation.id,
      name: opts.activeAssociation.name,
      amenitiesEnabled: opts.activeAssociation.amenitiesEnabled,
      // Fill only the fields the sidebar reads; the Association type is
      // broader but extra fields are tolerated at runtime.
    },
  ]);

  const { hook } = memoryLocation({ path: "/app" });

  return render(
    <QueryClientProvider client={queryClient}>
      <AssociationProvider>
        <Router hook={hook}>
          <SidebarProvider>
            <AppSidebar adminRole={opts.role ?? "manager"} />
          </SidebarProvider>
        </Router>
      </AssociationProvider>
    </QueryClientProvider>,
  );
}

function getAmenitiesLink(container: HTMLElement): Element | null {
  return container.querySelector("[data-testid='link-nav-amenity-booking']");
}

describe("AppSidebar — amenities toggle (3a)", () => {
  it("renders the Amenity Booking link when amenitiesEnabled = 1", () => {
    const { container, unmount } = renderSidebarWithAssociation({
      activeAssociation: { id: "a1", name: "Test HOA", amenitiesEnabled: 1 },
    });
    expect(getAmenitiesLink(container)).not.toBeNull();
    unmount();
  });

  it("OMITS the Amenity Booking link when amenitiesEnabled = 0", () => {
    const { container, unmount } = renderSidebarWithAssociation({
      activeAssociation: { id: "a2", name: "Disabled HOA", amenitiesEnabled: 0 },
    });
    expect(getAmenitiesLink(container)).toBeNull();
    unmount();
  });

  it("preserves default (shown) behavior for board-officer on enabled HOA", () => {
    const { container, unmount } = renderSidebarWithAssociation({
      activeAssociation: { id: "a3", name: "Board HOA", amenitiesEnabled: 1 },
      role: "board-officer",
    });
    expect(getAmenitiesLink(container)).not.toBeNull();
    unmount();
  });
});
