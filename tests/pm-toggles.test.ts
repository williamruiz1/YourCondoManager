/**
 * Unit tests for the 4.3 Q6 PM toggle helpers
 * (`server/pm-toggles.ts`). Covers:
 *   - `canAssessmentRulesWrite` role matrix.
 *   - `PM_TOGGLE_KEYS` / `isPmToggleKey` guard.
 *
 * DB-touching functions (`isToggleEnabled`, `setToggle`,
 * `listTogglesForAssociation`) are exercised via the endpoint integration
 * tests with a mocked drizzle surface, not here.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Stub the DB surface so `isToggleEnabled` has a deterministic return. The
// `vi.mock` call is hoisted to the top of the module before imports run.
vi.mock("../server/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([{ enabled: 0 }]),
        }),
      }),
    }),
  },
}));

import { PM_TOGGLE_KEYS, isPmToggleKey } from "../shared/schema";

describe("4.3 Q6 — PM_TOGGLE_KEYS / isPmToggleKey", () => {
  it("PM_TOGGLE_KEYS includes 'assessment_rules_write'", () => {
    expect(PM_TOGGLE_KEYS).toContain("assessment_rules_write");
  });

  it("isPmToggleKey accepts every canonical key", () => {
    for (const key of PM_TOGGLE_KEYS) {
      expect(isPmToggleKey(key)).toBe(true);
    }
  });

  it("isPmToggleKey rejects unknown strings", () => {
    expect(isPmToggleKey("")).toBe(false);
    expect(isPmToggleKey("random_key")).toBe(false);
    expect(isPmToggleKey("assessment_rules_read")).toBe(false);
  });

  it("isPmToggleKey rejects non-string values", () => {
    expect(isPmToggleKey(undefined)).toBe(false);
    expect(isPmToggleKey(null)).toBe(false);
    expect(isPmToggleKey(42)).toBe(false);
    expect(isPmToggleKey({ key: "assessment_rules_write" })).toBe(false);
  });
});

describe("4.3 Q6 — canAssessmentRulesWrite role matrix", () => {
  let canAssessmentRulesWrite: (typeof import("../server/pm-toggles"))["canAssessmentRulesWrite"];
  let __clearPmToggleCache: (typeof import("../server/pm-toggles"))["__clearPmToggleCache"];

  beforeEach(async () => {
    const mod = await import("../server/pm-toggles");
    canAssessmentRulesWrite = mod.canAssessmentRulesWrite;
    __clearPmToggleCache = mod.__clearPmToggleCache;
    __clearPmToggleCache();
  });

  const assoc = "assoc-test";

  it("platform-admin → allowed (no toggle query)", async () => {
    expect(await canAssessmentRulesWrite("platform-admin", assoc)).toBe(true);
  });

  it("manager → allowed", async () => {
    expect(await canAssessmentRulesWrite("manager", assoc)).toBe(true);
  });

  it("board-officer → allowed", async () => {
    expect(await canAssessmentRulesWrite("board-officer", assoc)).toBe(true);
  });

  it("pm-assistant → allowed", async () => {
    expect(await canAssessmentRulesWrite("pm-assistant", assoc)).toBe(true);
  });

  it("assisted-board + toggle OFF (default) → denied", async () => {
    expect(await canAssessmentRulesWrite("assisted-board", assoc)).toBe(false);
  });

  it("viewer → denied", async () => {
    expect(await canAssessmentRulesWrite("viewer", assoc)).toBe(false);
  });

  it("null / undefined role → denied", async () => {
    expect(await canAssessmentRulesWrite(null, assoc)).toBe(false);
    expect(await canAssessmentRulesWrite(undefined, assoc)).toBe(false);
  });
});
