/**
 * PmUpgradePrompt render tests — 4.4 Q5/Q6 (Wave 39 dual-path).
 *
 * Covers:
 *   - The localStorage dismiss key contract is preserved from Wave 13
 *     (`ycm:pm-upgrade-prompt-dismissed`).
 *   - Both CTAs render: "Add HOA on self-managed" (primary) +
 *     "Switch to Property Manager" (secondary).
 *   - Primary path navigates to /signup?plan=self-managed&context=add.
 *   - Secondary path POSTs to /api/admin/billing/portal-session and
 *     opens the returned URL in a new tab.
 *   - Both paths set the dismiss key.
 *
 * @vitest-environment jsdom
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  PmUpgradePrompt,
  PM_UPGRADE_DISMISSED_KEY,
  hasPmUpgradePromptBeenDismissed,
  dismissPmUpgradePrompt,
} from "../client/src/components/pm-upgrade-prompt";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("PmUpgradePrompt (4.4 Q6 — Wave 39 dual-path)", () => {
  it("uses the locked localStorage key ycm:pm-upgrade-prompt-dismissed (preserved from Wave 13)", () => {
    expect(PM_UPGRADE_DISMISSED_KEY).toBe("ycm:pm-upgrade-prompt-dismissed");
  });

  it("hasPmUpgradePromptBeenDismissed returns false when no key is set", () => {
    expect(hasPmUpgradePromptBeenDismissed()).toBe(false);
  });

  it("hasPmUpgradePromptBeenDismissed returns true after dismiss helper runs", () => {
    dismissPmUpgradePrompt();
    expect(hasPmUpgradePromptBeenDismissed()).toBe(true);
    expect(localStorage.getItem(PM_UPGRADE_DISMISSED_KEY)).toBe("1");
  });

  it("renders both CTAs and the dismiss button when open=true", () => {
    render(<PmUpgradePrompt open={true} onClose={() => {}} />);
    expect(screen.getByTestId("pm-upgrade-prompt")).toBeInTheDocument();
    // Primary path — per-HOA self-managed.
    expect(screen.getByTestId("pm-upgrade-add-self-managed")).toBeInTheDocument();
    // Secondary path — switch to PM tier.
    expect(screen.getByTestId("pm-upgrade-switch-pm")).toBeInTheDocument();
    // Dismiss.
    expect(screen.getByTestId("pm-upgrade-dismiss")).toBeInTheDocument();
  });

  it("modal title reflects dual-path framing (not single-path 'upgrade only')", () => {
    render(<PmUpgradePrompt open={true} onClose={() => {}} />);
    expect(
      screen.getByText(/pick a billing approach/i),
    ).toBeInTheDocument();
  });

  it("does not render when open=false", () => {
    render(<PmUpgradePrompt open={false} onClose={() => {}} />);
    expect(screen.queryByTestId("pm-upgrade-prompt")).not.toBeInTheDocument();
  });

  it("Not now: sets the localStorage key and calls onClose", () => {
    const onClose = vi.fn();
    render(<PmUpgradePrompt open={true} onClose={onClose} />);
    fireEvent.click(screen.getByTestId("pm-upgrade-dismiss"));
    expect(localStorage.getItem(PM_UPGRADE_DISMISSED_KEY)).toBe("1");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Primary path: 'Add HOA on self-managed' navigates to /signup?plan=self-managed&context=add", () => {
    // jsdom's window.location is read-only via assignment but href is settable.
    const hrefSetter = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...window.location,
        set href(v: string) { hrefSetter(v); },
        get href() { return ""; },
      },
    });

    const onClose = vi.fn();
    render(<PmUpgradePrompt open={true} onClose={onClose} />);
    fireEvent.click(screen.getByTestId("pm-upgrade-add-self-managed"));

    expect(hrefSetter).toHaveBeenCalledWith(
      "/signup?plan=self-managed&context=add",
    );
    expect(localStorage.getItem(PM_UPGRADE_DISMISSED_KEY)).toBe("1");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Secondary path: 'Switch to Property Manager' POSTs to /api/admin/billing/portal-session and opens URL in new tab", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: "https://billing.stripe.com/session/abc" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const openMock = vi.fn();
    vi.stubGlobal("open", openMock);

    const onClose = vi.fn();
    render(<PmUpgradePrompt open={true} onClose={onClose} />);
    fireEvent.click(screen.getByTestId("pm-upgrade-switch-pm"));

    // Let the async work flush.
    await new Promise((r) => setTimeout(r, 0));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/billing/portal-session",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
    expect(openMock).toHaveBeenCalledWith(
      "https://billing.stripe.com/session/abc",
      "_blank",
      "noopener,noreferrer",
    );
    expect(localStorage.getItem(PM_UPGRADE_DISMISSED_KEY)).toBe("1");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
