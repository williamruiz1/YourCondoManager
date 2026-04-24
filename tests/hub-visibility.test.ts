/**
 * Hub visibility translation helper tests — 1.5 HV-1.
 *
 * Spec: docs/projects/platform-overhaul/decisions/1.5-hub-visibility-rename.md
 *
 * Covers:
 *   - `toNewVocab` maps each old value to its new counterpart per the 1.5
 *     decision-doc table.
 *   - `normalizeHubVisibility` is identity on new values.
 *   - NULLs pass through unchanged (load-bearing for the public-read
 *     NULL-equivalence contract in `server/routes.ts`).
 *   - Type-level: both `HubVisibilityOld` and `HubVisibilityNew` are
 *     assignable to `HubVisibility`.
 *   - `HUB_VISIBILITY_ALL_VALUES` contains every legal value (old ∪ new).
 */

import { describe, expect, it } from "vitest";
import {
  HUB_VISIBILITY_ALL_VALUES,
  normalizeHubVisibility,
  toNewVocab,
  type HubVisibility,
  type HubVisibilityNew,
  type HubVisibilityOld,
} from "../shared/hub-visibility";

describe("toNewVocab — old → new mapping (1.5 decision-doc table)", () => {
  it("public → public (preserved verbatim — public-API safe)", () => {
    expect(toNewVocab("public")).toBe("public");
  });

  it("resident → residents", () => {
    expect(toNewVocab("resident")).toBe("residents");
  });

  it("owner → unit-owners", () => {
    expect(toNewVocab("owner")).toBe("unit-owners");
  });

  it("board → board-only", () => {
    expect(toNewVocab("board")).toBe("board-only");
  });

  it("admin → operator-only", () => {
    expect(toNewVocab("admin")).toBe("operator-only");
  });

  it("maps every documented old value (exhaustive)", () => {
    const expected: Record<HubVisibilityOld, HubVisibilityNew> = {
      public: "public",
      resident: "residents",
      owner: "unit-owners",
      board: "board-only",
      admin: "operator-only",
    };
    for (const [oldV, newV] of Object.entries(expected)) {
      expect(toNewVocab(oldV as HubVisibilityOld)).toBe(newV);
    }
  });
});

describe("normalizeHubVisibility — identity on new values", () => {
  const newValues: HubVisibilityNew[] = [
    "public",
    "residents",
    "unit-owners",
    "board-only",
    "operator-only",
  ];

  for (const v of newValues) {
    it(`${v} → ${v} (pass-through)`, () => {
      expect(normalizeHubVisibility(v)).toBe(v);
    });
  }
});

describe("normalizeHubVisibility — NULL handling", () => {
  it("null → null (load-bearing for public-read NULL-equivalence contract)", () => {
    expect(normalizeHubVisibility(null)).toBeNull();
  });

  it("toNewVocab(null) === null", () => {
    expect(toNewVocab(null)).toBeNull();
  });
});

describe("normalizeHubVisibility — accepts either vocab, emits new", () => {
  it("accepts old and emits new", () => {
    expect(normalizeHubVisibility("resident")).toBe("residents");
    expect(normalizeHubVisibility("owner")).toBe("unit-owners");
    expect(normalizeHubVisibility("board")).toBe("board-only");
    expect(normalizeHubVisibility("admin")).toBe("operator-only");
  });

  it("accepts new and emits new unchanged", () => {
    expect(normalizeHubVisibility("residents")).toBe("residents");
    expect(normalizeHubVisibility("unit-owners")).toBe("unit-owners");
    expect(normalizeHubVisibility("board-only")).toBe("board-only");
    expect(normalizeHubVisibility("operator-only")).toBe("operator-only");
  });
});

describe("type-level assignability (compile-time only)", () => {
  it("HubVisibilityOld is assignable to HubVisibility", () => {
    const oldVal: HubVisibilityOld = "resident";
    const union: HubVisibility = oldVal;
    expect(union).toBe("resident");
  });

  it("HubVisibilityNew is assignable to HubVisibility", () => {
    const newVal: HubVisibilityNew = "residents";
    const union: HubVisibility = newVal;
    expect(union).toBe("residents");
  });

  it("HubVisibility accepts both vocabs in the same array", () => {
    const mixed: HubVisibility[] = [
      "public",
      "resident",
      "residents",
      "owner",
      "unit-owners",
      "board",
      "board-only",
      "admin",
      "operator-only",
    ];
    expect(mixed).toHaveLength(9);
  });
});

describe("HUB_VISIBILITY_ALL_VALUES — enum source for zod", () => {
  it("contains all 9 legal values (old ∪ new, with `public` once)", () => {
    expect(HUB_VISIBILITY_ALL_VALUES).toHaveLength(9);
    expect(new Set(HUB_VISIBILITY_ALL_VALUES).size).toBe(9);
  });

  it("includes every old value", () => {
    for (const v of ["public", "resident", "owner", "board", "admin"] as const) {
      expect(HUB_VISIBILITY_ALL_VALUES).toContain(v);
    }
  });

  it("includes every new value", () => {
    for (const v of [
      "public",
      "residents",
      "unit-owners",
      "board-only",
      "operator-only",
    ] as const) {
      expect(HUB_VISIBILITY_ALL_VALUES).toContain(v);
    }
  });
});
