/**
 * SubscriptionLockScreen render tests — 4.4 Q5 (Wave 13).
 *
 * Exercises hard-lock copy + manage-billing CTA per subscription status
 * (canceled / unpaid / past_due — grace-expired).
 *
 * @vitest-environment jsdom
 */

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SubscriptionLockScreen } from "../client/src/components/subscription-lock-screen";

describe("SubscriptionLockScreen (4.4 Q5 Wave 13)", () => {
  it("renders 'subscription has ended' copy when status = canceled", () => {
    render(
      <SubscriptionLockScreen
        status="canceled"
        plan="self-managed"
        onManageBilling={() => {}}
      />,
    );
    expect(screen.getByText(/subscription has ended/i)).toBeInTheDocument();
    expect(screen.getByText(/Update Payment Method/i)).toBeInTheDocument();
  });

  it("renders 'payment required' copy when status = unpaid", () => {
    render(
      <SubscriptionLockScreen
        status="unpaid"
        plan="property-manager"
        onManageBilling={() => {}}
      />,
    );
    expect(screen.getByText(/payment required to continue/i)).toBeInTheDocument();
  });

  it("renders 'past due' copy when status = past_due", () => {
    render(
      <SubscriptionLockScreen
        status="past_due"
        plan="self-managed"
        onManageBilling={() => {}}
      />,
    );
    expect(screen.getByText(/payment past due/i)).toBeInTheDocument();
  });

  it("invokes onManageBilling when the manage CTA is clicked", () => {
    const onManage = vi.fn();
    render(
      <SubscriptionLockScreen
        status="canceled"
        plan="self-managed"
        onManageBilling={onManage}
      />,
    );
    fireEvent.click(screen.getByText(/Update Payment Method/i));
    expect(onManage).toHaveBeenCalledTimes(1);
  });

  it("shows 30-day retention note when status = canceled", () => {
    render(
      <SubscriptionLockScreen
        status="canceled"
        plan="self-managed"
        onManageBilling={() => {}}
      />,
    );
    expect(screen.getByText(/retained for 30 days/i)).toBeInTheDocument();
  });

  it("does NOT show retention note when status = unpaid or past_due", () => {
    const { rerender } = render(
      <SubscriptionLockScreen
        status="unpaid"
        plan="self-managed"
        onManageBilling={() => {}}
      />,
    );
    expect(screen.queryByText(/retained for 30 days/i)).not.toBeInTheDocument();

    rerender(
      <SubscriptionLockScreen
        status="past_due"
        plan="self-managed"
        onManageBilling={() => {}}
      />,
    );
    expect(screen.queryByText(/retained for 30 days/i)).not.toBeInTheDocument();
  });
});
