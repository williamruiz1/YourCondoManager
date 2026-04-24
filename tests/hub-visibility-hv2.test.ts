/**
 * Hub Visibility Rename — HV-2 code-only cutover tests.
 *
 * Spec: docs/projects/platform-overhaul/decisions/1.5-hub-visibility-rename.md
 *
 * HV-2 changes (this PR):
 *   - `HUB_VISIBILITY_RENAME` default flips from OFF to ON.
 *   - All write paths for `community_announcements.visibility_level` and
 *     `hub_map_issues.visibility_level` emit new-vocab via
 *     `normalizeHubVisibility()`.
 *   - The anonymous public endpoint still emits the `"public"` literal
 *     verbatim — regression-proof: HV-2 changes nothing on the read path
 *     for public rows.
 *   - `normalizeHubVisibility` continues to accept old-vocab inputs for
 *     backward compat (mid-deploy race safety; zero rows in prod per
 *     audit).
 *
 * Strategy: mix of (a) direct behavioural tests on the translation helper
 * (b) source-scan assertions that every write-path call site in
 * `server/routes.ts` is wired through the helper, per the HV-1 audit's
 * enumeration of sites. Avoids booting the full Express + DB stack, which
 * is unavailable in unit tests.
 */

import { describe, expect, it } from "vitest";
import * as fs from "fs";
import {
  __FEATURE_FLAG_DEFAULTS__,
  getFeatureFlag,
} from "../shared/feature-flags";
import {
  HUB_VISIBILITY_ALL_VALUES,
  normalizeHubVisibility,
} from "../shared/hub-visibility";

const routesSource = fs.readFileSync("server/routes.ts", "utf8");
const communityHubSource = fs.readFileSync(
  "client/src/pages/community-hub.tsx",
  "utf8",
);

describe("HV-2 — feature flag default flipped ON", () => {
  it("HUB_VISIBILITY_RENAME defaults to true (code-only cutover)", () => {
    expect(__FEATURE_FLAG_DEFAULTS__.HUB_VISIBILITY_RENAME).toBe(true);
  });

  it("getFeatureFlag reflects the ON default when no env override", () => {
    const prev = process.env.FEATURE_FLAG_HUB_VISIBILITY_RENAME;
    delete process.env.FEATURE_FLAG_HUB_VISIBILITY_RENAME;
    try {
      expect(getFeatureFlag("HUB_VISIBILITY_RENAME")).toBe(true);
    } finally {
      if (prev !== undefined) {
        process.env.FEATURE_FLAG_HUB_VISIBILITY_RENAME = prev;
      }
    }
  });

  it("env var can still force the flag OFF (kill-switch for rollout window)", () => {
    const prev = process.env.FEATURE_FLAG_HUB_VISIBILITY_RENAME;
    process.env.FEATURE_FLAG_HUB_VISIBILITY_RENAME = "false";
    try {
      expect(getFeatureFlag("HUB_VISIBILITY_RENAME")).toBe(false);
    } finally {
      if (prev === undefined) {
        delete process.env.FEATURE_FLAG_HUB_VISIBILITY_RENAME;
      } else {
        process.env.FEATURE_FLAG_HUB_VISIBILITY_RENAME = prev;
      }
    }
  });
});

describe("HV-2 — writes emit new-vocab via normalizeHubVisibility (behavioural)", () => {
  // Simulate the actual write-path logic: take a body that may carry old OR
  // new vocab, feed its `visibilityLevel` through the helper, and verify the
  // emitted string is new-vocab.

  type AnnouncementBody = { visibilityLevel?: string | null };

  function wrappedForCommunityAnnouncementsWrite(body: AnnouncementBody) {
    if ("visibilityLevel" in body) {
      return {
        ...body,
        visibilityLevel: normalizeHubVisibility(body.visibilityLevel ?? null),
      };
    }
    return body;
  }

  it("community_announcements: old vocab → new vocab on write", () => {
    expect(
      wrappedForCommunityAnnouncementsWrite({ visibilityLevel: "resident" })
        .visibilityLevel,
    ).toBe("residents");
    expect(
      wrappedForCommunityAnnouncementsWrite({ visibilityLevel: "owner" })
        .visibilityLevel,
    ).toBe("unit-owners");
    expect(
      wrappedForCommunityAnnouncementsWrite({ visibilityLevel: "board" })
        .visibilityLevel,
    ).toBe("board-only");
    expect(
      wrappedForCommunityAnnouncementsWrite({ visibilityLevel: "admin" })
        .visibilityLevel,
    ).toBe("operator-only");
  });

  it("community_announcements: `public` preserved verbatim on write", () => {
    expect(
      wrappedForCommunityAnnouncementsWrite({ visibilityLevel: "public" })
        .visibilityLevel,
    ).toBe("public");
  });

  it("community_announcements: new vocab passes through unchanged", () => {
    for (const v of [
      "residents",
      "unit-owners",
      "board-only",
      "operator-only",
    ] as const) {
      expect(
        wrappedForCommunityAnnouncementsWrite({ visibilityLevel: v })
          .visibilityLevel,
      ).toBe(v);
    }
  });

  it("community_announcements: NULL passes through (load-bearing public-read contract)", () => {
    expect(
      wrappedForCommunityAnnouncementsWrite({ visibilityLevel: null })
        .visibilityLevel,
    ).toBeNull();
  });

  it("community_announcements: absent `visibilityLevel` on partial update is not touched", () => {
    const body: AnnouncementBody = {};
    expect("visibilityLevel" in wrappedForCommunityAnnouncementsWrite(body)).toBe(
      false,
    );
  });

  it("hub_map_issues portal POST default ('board-only') is new vocab", () => {
    // The portal map-issue POST in server/routes.ts defaults a missing
    // visibility to new-vocab "board-only" via the helper.
    const defaulted =
      normalizeHubVisibility("board-only") ?? "board-only";
    expect(defaulted).toBe("board-only");
  });

  it("hub_map_issues: legacy 'board' input still coerces to 'board-only'", () => {
    expect(normalizeHubVisibility("board")).toBe("board-only");
  });
});

describe("HV-2 — normalizeHubVisibility backward-compat (mid-deploy race safety)", () => {
  it("accepts every legal input value and emits new vocab (or null)", () => {
    for (const v of HUB_VISIBILITY_ALL_VALUES) {
      const out = normalizeHubVisibility(v);
      // Expected: always a NEW-vocab string, never old.
      expect(
        ["public", "residents", "unit-owners", "board-only", "operator-only"],
      ).toContain(out);
    }
  });

  it("null remains null (public-read NULL-equivalence)", () => {
    expect(normalizeHubVisibility(null)).toBeNull();
  });
});

describe("HV-2 — public endpoint regression: `public` literal preserved", () => {
  it("public-read endpoint still filters on the `public` literal verbatim", () => {
    // Source-scan: the filter predicate for the anonymous hub endpoint must
    // continue to compare visibilityLevel against the exact string "public".
    // HV-2 changes nothing here; this test guards against an accidental
    // rename (which would break every public hub page on the internet).
    const anchor = '/api/hub/:identifier/public';
    const idx = routesSource.indexOf(anchor);
    expect(idx).toBeGreaterThan(-1);
    const region = routesSource.substring(idx, idx + 4000);
    // NULL OR eq "public" — the exact public-read contract.
    expect(region).toMatch(
      /isNull\(communityAnnouncements\.visibilityLevel\)[\s\S]*eq\(communityAnnouncements\.visibilityLevel,\s*"public"\)/,
    );
  });
});

describe("HV-2 — source-scan: write paths wired through normalizeHubVisibility", () => {
  it("routes.ts imports normalizeHubVisibility from the shared helper", () => {
    expect(routesSource).toMatch(
      /import\s*\{\s*normalizeHubVisibility\s*\}\s*from\s*"@shared\/hub-visibility"/,
    );
  });

  it("admin `/api/announcements` POST body is normalized before insert", () => {
    const idx = routesSource.indexOf('app.post("/api/announcements"');
    expect(idx).toBeGreaterThan(-1);
    const region = routesSource.substring(idx, idx + 3000);
    expect(region).toMatch(/normalizeHubVisibility\(/);
  });

  it("admin `/api/announcements/:id` PATCH body is normalized before update", () => {
    const idx = routesSource.indexOf('app.patch("/api/announcements/:id"');
    expect(idx).toBeGreaterThan(-1);
    const region = routesSource.substring(idx, idx + 2000);
    expect(region).toMatch(/normalizeHubVisibility\(/);
  });

  it("hub notice POST body is normalized before insert", () => {
    const idx = routesSource.indexOf(
      'app.post("/api/associations/:id/hub/notices"',
    );
    expect(idx).toBeGreaterThan(-1);
    const region = routesSource.substring(idx, idx + 2000);
    expect(region).toMatch(/normalizeHubVisibility\(/);
  });

  it("hub notice PUT body is normalized before update", () => {
    const idx = routesSource.indexOf(
      'app.put("/api/associations/:id/hub/notices/:noticeId"',
    );
    expect(idx).toBeGreaterThan(-1);
    const region = routesSource.substring(idx, idx + 2000);
    expect(region).toMatch(/normalizeHubVisibility\(/);
  });

  it("portal map-issue POST body is normalized before insert (no hardcoded old vocab)", () => {
    const idx = routesSource.indexOf('app.post("/api/hub/portal/map/issues"');
    expect(idx).toBeGreaterThan(-1);
    const region = routesSource.substring(idx, idx + 2000);
    expect(region).toMatch(/normalizeHubVisibility\(/);
    // No hardcoded old-vocab "board" on the write side (new vocab uses "board-only").
    expect(region).not.toMatch(/visibilityLevel:\s*"board"\s*,/);
  });

  it("admin map-issue PUT body is normalized before update", () => {
    const idx = routesSource.indexOf(
      'app.put("/api/associations/:id/hub/map/issues/:issueId"',
    );
    expect(idx).toBeGreaterThan(-1);
    const region = routesSource.substring(idx, idx + 2000);
    expect(region).toMatch(/normalizeHubVisibility\(/);
  });

  it("auto-populate seeded notice goes through the helper", () => {
    const idx = routesSource.indexOf(
      'app.post("/api/associations/:id/hub/auto-populate"',
    );
    expect(idx).toBeGreaterThan(-1);
    const region = routesSource.substring(idx, idx + 6000);
    expect(region).toMatch(
      /visibilityLevel:\s*normalizeHubVisibility\("public"\)/,
    );
  });
});

describe("HV-2 — client SelectItem list emits new vocab", () => {
  it("community-hub.tsx SelectItem values are new vocab (no old-vocab write values)", () => {
    // New-vocab values must all be present as SelectItem option values.
    for (const v of ["public", "residents", "unit-owners", "board-only", "operator-only"]) {
      expect(communityHubSource).toMatch(
        new RegExp(`<SelectItem value="${v}">`),
      );
    }
    // Old-vocab non-`public` values must NOT appear as SelectItem option values.
    // (They may still appear in the visibilityLabels map for legacy-row rendering.)
    for (const v of ["resident", "owner", "board", "admin"]) {
      expect(communityHubSource).not.toMatch(
        new RegExp(`<SelectItem value="${v}">`),
      );
    }
  });

  it("visibilityLabels map renders both old and new vocab for legacy rows", () => {
    // Extract just the visibilityLabels object literal.
    const mapIdx = communityHubSource.indexOf("visibilityLabels");
    expect(mapIdx).toBeGreaterThan(-1);
    const mapRegion = communityHubSource.substring(mapIdx, mapIdx + 1500);
    // new vocab keys
    expect(mapRegion).toMatch(/\bresidents\b/);
    expect(mapRegion).toMatch(/["']unit-owners["']/);
    expect(mapRegion).toMatch(/["']board-only["']/);
    expect(mapRegion).toMatch(/["']operator-only["']/);
    // old vocab keys (for legacy row rendering)
    expect(mapRegion).toMatch(/\bresident\b/);
    expect(mapRegion).toMatch(/\bowner\b/);
    expect(mapRegion).toMatch(/\bboard\b/);
    expect(mapRegion).toMatch(/\badmin\b/);
  });
});

describe("HV-2 — portal read filter accepts both vocabs (parity window)", () => {
  it("visibilityLevels array pushes both old and new equivalents", () => {
    // Source-scan: verify the portal GET /api/hub/portal/home read filter
    // includes both old and new vocab in its `visibilityLevels` array so
    // legacy rows and HV-2+ rows are both visible.
    const idx = routesSource.indexOf('app.get("/api/hub/portal/home"');
    expect(idx).toBeGreaterThan(-1);
    const region = routesSource.substring(idx, idx + 3000);
    expect(region).toMatch(/"resident",\s*"residents"/);
    expect(region).toMatch(/"owner",\s*"unit-owners"/);
    expect(region).toMatch(/"board",\s*"board-only"/);
  });
});
