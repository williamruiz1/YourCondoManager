/**
 * TrialBanner render tests — 4.4 Q5 (Wave 13).
 *
 * Exercises visibility per subscription status + session-scoped dismiss.
 *
 * @vitest-environment jsdom
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TrialBanner } from "../client/src/components/trial-banner";

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  vi.useRealTimers();
});

function fmt(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString();
}

describe("TrialBanner (4.4 Q5 Wave 13)", () => {
  it("renders when trialEndsAt is in the future (days remaining > 0)", () => {
    render(<TrialBanner trialEndsAt={fmt(5)} plan="self-managed" onUpgrade={() => {}} />);
    expect(screen.getByTestId("trial-banner")).toBeInTheDocument();
    expect(screen.getByTestId("trial-banner-upgrade")).toBeInTheDocument();
    expect(screen.getByTestId("trial-banner-dismiss")).toBeInTheDocument();
  });

  it("shows 'today is the last day' when daysLeft = 0", () => {
    render(<TrialBanner trialEndsAt={fmt(0)} plan="self-managed" onUpgrade={() => {}} />);
    expect(screen.getByTestId("trial-banner").textContent).toMatch(/today is the last day/i);
  });

  it("does not render when trialEndsAt is null (not trialing)", () => {
    const { container } = render(
      <TrialBanner trialEndsAt={null} plan="self-managed" onUpgrade={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("does not render when trial has already ended (daysLeft < 0)", () => {
    const { container } = render(
      <TrialBanner trialEndsAt={fmt(-1)} plan="self-managed" onUpgrade={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("dismiss click sets the per-session key and hides the banner", () => {
    render(<TrialBanner trialEndsAt={fmt(5)} plan="self-managed" onUpgrade={() => {}} />);
    fireEvent.click(screen.getByTestId("trial-banner-dismiss"));
    expect(screen.queryByTestId("trial-banner")).not.toBeInTheDocument();
    expect(sessionStorage.getItem("ycm:trial-banner-dismissed")).toBe("1");
  });

  it("respects existing session-dismiss key on mount", () => {
    sessionStorage.setItem("ycm:trial-banner-dismissed", "1");
    const { container } = render(
      <TrialBanner trialEndsAt={fmt(5)} plan="self-managed" onUpgrade={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("upgrade button invokes onUpgrade", () => {
    const onUpgrade = vi.fn();
    render(<TrialBanner trialEndsAt={fmt(5)} plan="self-managed" onUpgrade={onUpgrade} />);
    fireEvent.click(screen.getByTestId("trial-banner-upgrade"));
    expect(onUpgrade).toHaveBeenCalledTimes(1);
  });

  it("dismiss key uses sessionStorage (not localStorage) — per-session, not per-day", () => {
    // Pre-populate localStorage with the OLD per-day key format from pre-Wave-13.
    // That must NOT dismiss the banner under the new session-scoped contract.
    localStorage.setItem(
      `trial-banner-dismissed-${new Date().toISOString().slice(0, 10)}`,
      "1",
    );
    render(<TrialBanner trialEndsAt={fmt(5)} plan="self-managed" onUpgrade={() => {}} />);
    expect(screen.getByTestId("trial-banner")).toBeInTheDocument();
  });
});
