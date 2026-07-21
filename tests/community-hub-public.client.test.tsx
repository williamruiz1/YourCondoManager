/**
 * @vitest-environment jsdom
 */

import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import CommunityHubPublicPage from "../client/src/pages/community-hub-public";

vi.mock("../client/src/components/community-map-view", () => ({
  default: () => null,
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

const hubPayload = {
  config: {
    communityDescription: "An 18-unit community.",
    logoUrl: null,
    bannerImageUrl: null,
    themeColor: "#014D4A",
    sectionOrder: ["contacts"],
    enabledSections: ["contacts"],
    slug: "cherryhill",
    welcomeModeEnabled: 0,
    welcomeHeadline: null,
    welcomeHighlights: null,
  },
  association: {
    name: "Cherry Hill Court Condominiums",
    address: "1405 Quinnipiac Ave.",
    city: "New Haven",
    state: "CT",
  },
  boardContacts: [{
    id: "board-1",
    role: "Board Member",
    firstName: "William",
    lastName: "Ruiz",
  }],
  notices: [],
  infoBlocks: [],
  actionLinks: [],
  meetings: [],
  documents: [],
};

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
    },
  });
  const { hook } = memoryLocation({ path: "/community/cherryhill" });
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const payload = url.endsWith("/buildings")
      ? { buildings: [], unlinkedUnitCount: 0 }
      : hubPayload;
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }));

  return render(
    <QueryClientProvider client={client}>
      <Router hook={hook}>
        <CommunityHubPublicPage />
      </Router>
    </QueryClientProvider>,
  );
}

describe("public Community Hub authenticity controls", () => {
  it("opens the real portal from both controls and removes embedded sign-in", async () => {
    renderPage();

    await screen.findByText("Board contacts");
    const portalLinks = screen.getAllByRole("link", { name: /owner portal/i });
    expect(portalLinks).toHaveLength(2);
    for (const link of portalLinks) {
      expect(link).toHaveAttribute("href", "/portal");
    }
    expect(screen.queryByText("Sign In with Email")).not.toBeInTheDocument();
  });

  it("shows the current board directory and professional inquiry paths", async () => {
    renderPage();

    expect(await screen.findByText("William Ruiz")).toBeInTheDocument();
    expect(screen.getAllByText("1405 Quinnipiac Ave., New Haven, CT")).toHaveLength(2);
    expect(screen.getByText("Lenders, insurers & closing professionals")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start an inquiry" }).getAttribute("href"))
      .toContain("mailto:support@yourcondomanager.org?");
    expect(screen.getByRole("link", { name: "Contact the association" }).getAttribute("href"))
      .toContain("mailto:support@yourcondomanager.org?");
  });

  it("renders the approved community-front-door hierarchy with truthful portal and document paths", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "Welcome to Cherry Hill Court Condominiums" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Clear information for owners and the professionals who support them." })).toBeInTheDocument();
    expect(screen.getByText("Self-managed")).toBeInTheDocument();
    expect(screen.getByText("Dues & payments")).toBeInTheDocument();
    expect(screen.getByText("Service requests")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Need official association documents?" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Request documents" }).getAttribute("href"))
      .toContain("mailto:support@yourcondomanager.org?");
  });
});
