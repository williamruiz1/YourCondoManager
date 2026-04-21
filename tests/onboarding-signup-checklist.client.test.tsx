/**
 * Render test for SignupOnboardingChecklist (4.4 Q2 AC 1-5).
 *
 * Exercises three visibility paths:
 *   - partial completion → banner renders with 4 items and correct check marks
 *   - all complete → banner self-hides
 *   - dismissed → banner self-hides
 *
 * @vitest-environment jsdom
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SignupOnboardingChecklist } from "../client/src/components/signup-onboarding-checklist";

function withQueryData(data: unknown) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(["/api/onboarding/signup-checklist"], data);
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

// Silence fetch calls — the checklist only fetches when the cache is empty.
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
});

describe("SignupOnboardingChecklist", () => {
  it("renders four items with partial completion", () => {
    const Wrapper = withQueryData({
      associationDetailsComplete: true,
      boardOfficerInvited: false,
      unitsAdded: false,
      firstDocumentUploaded: false,
      dismissed: false,
      dismissedAt: null,
    });
    render(
      <Wrapper>
        <SignupOnboardingChecklist />
      </Wrapper>,
    );
    expect(screen.getByTestId("signup-onboarding-checklist")).toBeInTheDocument();
    expect(screen.getByTestId("onboarding-item-associationDetailsComplete")).toBeInTheDocument();
    expect(screen.getByTestId("onboarding-item-boardOfficerInvited")).toBeInTheDocument();
    expect(screen.getByTestId("onboarding-item-unitsAdded")).toBeInTheDocument();
    expect(screen.getByTestId("onboarding-item-firstDocumentUploaded")).toBeInTheDocument();
    expect(screen.getByText("1/4")).toBeInTheDocument();
  });

  it("hides when all four items complete (AC 4)", () => {
    const Wrapper = withQueryData({
      associationDetailsComplete: true,
      boardOfficerInvited: true,
      unitsAdded: true,
      firstDocumentUploaded: true,
      dismissed: false,
      dismissedAt: null,
    });
    render(
      <Wrapper>
        <SignupOnboardingChecklist />
      </Wrapper>,
    );
    expect(screen.queryByTestId("signup-onboarding-checklist")).not.toBeInTheDocument();
  });

  it("hides when dismissed (AC 5)", () => {
    const Wrapper = withQueryData({
      associationDetailsComplete: false,
      boardOfficerInvited: false,
      unitsAdded: false,
      firstDocumentUploaded: false,
      dismissed: true,
      dismissedAt: "2026-04-20T00:00:00.000Z",
    });
    render(
      <Wrapper>
        <SignupOnboardingChecklist />
      </Wrapper>,
    );
    expect(screen.queryByTestId("signup-onboarding-checklist")).not.toBeInTheDocument();
  });
});
