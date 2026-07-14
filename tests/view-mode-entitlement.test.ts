// founder-os#11345 — view-mode entitlement is SERVER-authoritative.
import { describe, expect, it } from "vitest";
import {
  resolveViewModeEntitlement,
  isBoardLockedAccount,
} from "@shared/view-mode-entitlement";

describe("#11345 resolveViewModeEntitlement", () => {
  it("board-role accounts are locked to Board view", () => {
    for (const role of ["board-officer", "assisted-board", "viewer"] as const) {
      expect(resolveViewModeEntitlement({ role, email: "someone@example.com" })).toEqual({
        viewMode: "board",
        locked: true,
      });
    }
  });

  it("manager-capable roles get Manager view, unlocked", () => {
    for (const role of ["platform-admin", "manager", "pm-assistant"] as const) {
      expect(resolveViewModeEntitlement({ role, email: "mgr@example.com" })).toEqual({
        viewMode: "manager",
        locked: false,
      });
    }
  });

  it("chcmgmt18 is locked to Board view DESPITE being platform-admin", () => {
    expect(
      resolveViewModeEntitlement({ role: "platform-admin", email: "chcmgmt18@gmail.com" }),
    ).toEqual({ viewMode: "board", locked: true });
    // account lock is case-insensitive / whitespace-tolerant
    expect(
      resolveViewModeEntitlement({ role: "platform-admin", email: "  CHCMGMT18@Gmail.com " }),
    ).toEqual({ viewMode: "board", locked: true });
    expect(isBoardLockedAccount({ role: "platform-admin", email: "chcmgmt18@gmail.com" })).toBe(true);
  });

  it("a different platform-admin (not the locked account) keeps Manager view", () => {
    expect(
      resolveViewModeEntitlement({ role: "platform-admin", email: "someoneelse@gmail.com" }),
    ).toEqual({ viewMode: "manager", locked: false });
    expect(isBoardLockedAccount({ role: "platform-admin", email: "someoneelse@gmail.com" })).toBe(false);
  });

  it("null/undefined role or email fails safe to Manager (unless the account is explicitly locked)", () => {
    expect(resolveViewModeEntitlement({ role: null, email: null })).toEqual({
      viewMode: "manager",
      locked: false,
    });
    expect(resolveViewModeEntitlement({ role: undefined, email: undefined })).toEqual({
      viewMode: "manager",
      locked: false,
    });
  });
});
