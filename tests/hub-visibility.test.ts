/**
 * Hub visibility helper tests — 1.5 HV-3 (Wave 36).
 *
 * Spec: docs/projects/platform-overhaul/decisions/1.5-hub-visibility-rename.md
 *
 * Post-HV-3 the helper has collapsed:
 *   - `HubVisibilityOld` and `toNewVocab` retired (no more dual vocab).
 *   - `HubVisibilityNew` is the canonical type; `HubVisibility` is an alias.
 *   - `HUB_VISIBILITY_ALL_VALUES` contains exactly the 5 new values.
 *   - `normalizeHubVisibility` is now an identity over `HubVisibilityNew | null`,
 *     kept temporarily as a deprecation shim until call sites are inlined.
 */

import { describe, expect, it } from "vitest";
import {
  HUB_VISIBILITY_ALL_VALUES,
  normalizeHubVisibility,
  type HubVisibility,
  type HubVisibilityNew,
} from "../shared/hub-visibility";

describe("HUB_VISIBILITY_ALL_VALUES — canonical 5-value vocabulary", () => {
  it("contains exactly the 5 new vocabulary values", () => {
    expect(HUB_VISIBILITY_ALL_VALUES).toHaveLength(5);
    expect(new Set(HUB_VISIBILITY_ALL_VALUES).size).toBe(5);
  });

  it("includes every new vocab value, nothing else", () => {
    const expected = [
      "public",
      "residents",
      "unit-owners",
      "board-only",
      "operator-only",
    ];
    expect([...HUB_VISIBILITY_ALL_VALUES].sort()).toEqual([...expected].sort());
  });

  it("does NOT include any retired old-vocab values", () => {
    for (const oldVal of ["resident", "owner", "board", "admin"]) {
      expect(HUB_VISIBILITY_ALL_VALUES).not.toContain(oldVal);
    }
  });
});

describe("normalizeHubVisibility — identity shim over the new vocabulary", () => {
  const newValues: HubVisibilityNew[] = [
    "public",
    "residents",
    "unit-owners",
    "board-only",
    "operator-only",
  ];

  for (const v of newValues) {
    it(`${v} → ${v} (identity)`, () => {
      expect(normalizeHubVisibility(v)).toBe(v);
    });
  }

  it("null → null (load-bearing for public-read NULL-equivalence contract)", () => {
    expect(normalizeHubVisibility(null)).toBeNull();
  });

  it("undefined → null (treated as 'no value supplied')", () => {
    expect(normalizeHubVisibility(undefined)).toBeNull();
  });
});

describe("type-level contract (compile-time only)", () => {
  it("HubVisibility is an alias for HubVisibilityNew", () => {
    // If these assignments compile, the alias holds. The runtime check is just
    // a smoke assertion that one of the values round-trips.
    const newVal: HubVisibilityNew = "residents";
    const aliasVal: HubVisibility = newVal;
    expect(aliasVal).toBe("residents");
  });

  it("HUB_VISIBILITY_ALL_VALUES is assignable to readonly HubVisibilityNew[]", () => {
    const sink: readonly HubVisibilityNew[] = HUB_VISIBILITY_ALL_VALUES;
    expect(sink).toEqual(HUB_VISIBILITY_ALL_VALUES);
  });
});
