/**
 * PmUpgradePrompt render tests — 4.4 Q6 (Wave 13).
 *
 * Covers the localStorage dismiss key contract (prevents re-prompt after
 * user declines once) and the upgrade/dismiss paths.
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

describe("PmUpgradePrompt (4.4 Q6 Wave 13)", () => {
  it("uses the locked localStorage key ycm:pm-upgrade-prompt-dismissed", () => {
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

  it("renders when open=true", () => {
    render(<PmUpgradePrompt open={true} onClose={() => {}} />);
    expect(screen.getByTestId("pm-upgrade-prompt")).toBeInTheDocument();
    expect(screen.getByTestId("pm-upgrade-dismiss")).toBeInTheDocument();
    expect(screen.getByTestId("pm-upgrade-accept")).toBeInTheDocument();
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

  it("Upgrade: POSTs to /api/admin/billing/portal-session, opens URL in new tab, sets dismiss key", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: "https://billing.stripe.com/session/abc" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const openMock = vi.fn();
    vi.stubGlobal("open", openMock);

    const onClose = vi.fn();
    render(<PmUpgradePrompt open={true} onClose={onClose} />);
    fireEvent.click(screen.getByTestId("pm-upgrade-accept"));

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
