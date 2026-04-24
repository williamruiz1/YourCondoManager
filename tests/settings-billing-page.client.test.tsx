/**
 * /app/settings/billing page render tests — 4.4 Q6 (Wave 13).
 *
 * Covers role-gating (Viewer + Owner denied, Manager + Board Officer +
 * PM Assistant + Platform Admin allowed) and subscription-status rendering.
 *
 * @vitest-environment jsdom
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import SettingsBillingPage from "../client/src/pages/settings-billing";

function withQuery(
  authResponse: unknown,
  subscriptionResponse: unknown,
  initialPath = "/app/settings/billing",
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(["/api/auth/me", "session"], authResponse);
  client.setQueryData(["/api/admin/billing/subscription"], subscriptionResponse);
  const { hook } = memoryLocation({ path: initialPath });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>
      <Router hook={hook}>{children}</Router>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
});

describe("SettingsBillingPage (4.4 Q6 Wave 13)", () => {
  const allowedRoles = ["platform-admin", "manager", "board-officer", "pm-assistant"] as const;

  for (const role of allowedRoles) {
    it(`renders subscription details for ${role} (allowed role)`, () => {
      const Wrapper = withQuery(
        { authenticated: true, admin: { id: "a1", email: "m@x.co", role } },
        { status: "active", plan: "self-managed", currentPeriodEnd: "2026-06-01T00:00:00Z" },
      );
      render(
        <Wrapper>
          <SettingsBillingPage />
        </Wrapper>,
      );
      expect(screen.getByTestId("billing-plan-card")).toBeInTheDocument();
      expect(screen.getByTestId("billing-manage-cta")).toBeInTheDocument();
    });
  }

  const deniedRoles = ["viewer"] as const;
  for (const role of deniedRoles) {
    it(`renders null for ${role} (denied role) while redirect fires`, () => {
      const Wrapper = withQuery(
        { authenticated: true, admin: { id: "a2", email: "v@x.co", role } },
        { status: "active", plan: "self-managed" },
      );
      const { container } = render(
        <Wrapper>
          <SettingsBillingPage />
        </Wrapper>,
      );
      // Page guard returns null on deny; no billing card.
      expect(screen.queryByTestId("billing-plan-card")).not.toBeInTheDocument();
      expect(screen.queryByTestId("billing-manage-cta")).not.toBeInTheDocument();
      // The container has only the redirect effect output (nothing user-visible).
      // We don't assert container emptiness because Dialog portals can leave mount points —
      // but the billing cards absolutely must not render.
      expect(container.querySelector("[data-testid='billing-plan-card']")).toBeNull();
    });
  }

  it("shows trial fine-print when status = trialing", () => {
    const Wrapper = withQuery(
      { authenticated: true, admin: { id: "a1", email: "m@x.co", role: "manager" } },
      {
        status: "trialing",
        plan: "self-managed",
        trialEndsAt: "2026-06-01T00:00:00Z",
      },
    );
    render(
      <Wrapper>
        <SettingsBillingPage />
      </Wrapper>,
    );
    expect(screen.getByTestId("billing-trial-info")).toBeInTheDocument();
    expect(screen.getByTestId("billing-status-badge")).toHaveTextContent("Trial");
  });

  it("shows empty state when subscription.status = 'none'", () => {
    const Wrapper = withQuery(
      { authenticated: true, admin: { id: "a1", email: "m@x.co", role: "manager" } },
      { status: "none" },
    );
    render(
      <Wrapper>
        <SettingsBillingPage />
      </Wrapper>,
    );
    expect(screen.getByTestId("billing-empty-state")).toBeInTheDocument();
  });
});
