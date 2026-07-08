// @vitest-environment jsdom
// founder-os#9487 — Board/Manager view-mode store.
// This is a .test.ts (not .test.tsx), so the default vitest.config.ts
// environmentMatchGlobs (which only maps *.test.tsx -> jsdom) leaves it in the
// "node" env where localStorage is undefined. The store is localStorage-backed,
// so pin this file to jsdom explicitly.
import { beforeEach, describe, expect, it } from "vitest";
import {
  chooseMode,
  setMode,
  setAdvancedView,
  seedDefaultModeFromRole,
  defaultModeForRole,
  setViewModeAdminId,
  getViewModeSnapshot,
} from "./view-mode";

beforeEach(() => {
  localStorage.clear();
  // Scope to a fresh admin so each test starts from an unchosen state.
  setViewModeAdminId(`admin-${Math.random().toString(36).slice(2)}`);
});

describe("defaultModeForRole", () => {
  it("board-officer and assisted-board default to Board mode", () => {
    expect(defaultModeForRole("board-officer")).toBe("board");
    expect(defaultModeForRole("assisted-board")).toBe("board");
  });
  it("manager / pm-assistant / platform-admin default to Manager mode", () => {
    expect(defaultModeForRole("manager")).toBe("manager");
    expect(defaultModeForRole("pm-assistant")).toBe("manager");
    expect(defaultModeForRole("platform-admin")).toBe("manager");
    expect(defaultModeForRole(null)).toBe("manager");
  });
});

describe("first-run state (signup selector gate)", () => {
  it("starts with modeChosen=false so the selector shows at signup", () => {
    expect(getViewModeSnapshot().modeChosen).toBe(false);
  });

  it("seedDefaultModeFromRole sets the default mode WITHOUT marking it chosen", () => {
    seedDefaultModeFromRole("board-officer");
    const s = getViewModeSnapshot();
    expect(s.mode).toBe("board");
    expect(s.modeChosen).toBe(false); // selector still appears until explicit choice
  });

  it("seed is a no-op once a mode has been explicitly chosen", () => {
    chooseMode("manager");
    seedDefaultModeFromRole("board-officer");
    expect(getViewModeSnapshot().mode).toBe("manager"); // choice wins over role default
  });
});

describe("choosing + switching + persistence", () => {
  it("chooseMode persists the choice and marks it chosen", () => {
    chooseMode("board");
    const s = getViewModeSnapshot();
    expect(s.mode).toBe("board");
    expect(s.modeChosen).toBe(true);
    expect(s.advancedView).toBe(false);
  });

  it("selection persists across a store reload (localStorage-backed)", () => {
    const admin = "persist-admin";
    setViewModeAdminId(admin);
    chooseMode("board");
    // Simulate a fresh page: re-point the store at the same admin key.
    setViewModeAdminId(admin);
    const s = getViewModeSnapshot();
    expect(s.mode).toBe("board");
    expect(s.modeChosen).toBe(true);
  });

  it("setMode switches a dual-role user between modes and keeps chosen", () => {
    chooseMode("board");
    setMode("manager");
    expect(getViewModeSnapshot().mode).toBe("manager");
    expect(getViewModeSnapshot().modeChosen).toBe(true);
  });

  it("advanced-view toggle flips independently of mode", () => {
    chooseMode("board");
    setAdvancedView(true);
    expect(getViewModeSnapshot().advancedView).toBe(true);
    expect(getViewModeSnapshot().mode).toBe("board"); // still Board mode
    setAdvancedView(false);
    expect(getViewModeSnapshot().advancedView).toBe(false);
  });

  it("per-admin isolation — one admin's choice does not leak to another", () => {
    setViewModeAdminId("admin-A");
    chooseMode("board");
    setViewModeAdminId("admin-B");
    expect(getViewModeSnapshot().modeChosen).toBe(false); // B has not chosen
  });
});
