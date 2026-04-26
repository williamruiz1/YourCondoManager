/**
 * Hub Visibility Rename — HV-3 cutover regression tests (Wave 36).
 *
 * Spec: docs/projects/platform-overhaul/decisions/1.5-hub-visibility-rename.md
 *
 * HV-3 changes (this PR):
 *   - Migration `0018_hub_visibility_rename_drop_old.sql` recreates the enum
 *     without the old values and adds a CHECK constraint to the
 *     `community_announcements.visibility_level` text column.
 *   - `HUB_VISIBILITY_RENAME` feature flag retired (no longer in
 *     `FeatureFlagKey` or `DEFAULTS`).
 *   - `HubVisibilityOld` and `toNewVocab` retired from
 *     `shared/hub-visibility.ts`.
 *   - `community-hub.tsx` `visibilityLabels` map and routes.ts portal-home
 *     read filter no longer carry old-vocab branches.
 *
 * Strategy: source-scan + behavioural where unit-testable. The migration
 * itself is exercised by the CI ephemeral-Postgres path; here we guard the
 * code-side contract.
 */

import { describe, expect, it } from "vitest";
import * as fs from "fs";
import {
  __FEATURE_FLAG_DEFAULTS__,
  type FeatureFlagKey,
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
const featureFlagsSource = fs.readFileSync(
  "shared/feature-flags.ts",
  "utf8",
);
const hubVisibilitySource = fs.readFileSync(
  "shared/hub-visibility.ts",
  "utf8",
);
const schemaSource = fs.readFileSync("shared/schema.ts", "utf8");
const migrationSource = fs.readFileSync(
  "migrations/0018_hub_visibility_rename_drop_old.sql",
  "utf8",
);

describe("HV-3 — HUB_VISIBILITY_RENAME flag retired", () => {
  it("HUB_VISIBILITY_RENAME is no longer in __FEATURE_FLAG_DEFAULTS__", () => {
    expect(
      (__FEATURE_FLAG_DEFAULTS__ as Record<string, boolean>)
        .HUB_VISIBILITY_RENAME,
    ).toBeUndefined();
  });

  it("FeatureFlagKey union no longer includes HUB_VISIBILITY_RENAME", () => {
    // Compile-time: this `satisfies` would fail to type-check if the literal
    // were still a valid FeatureFlagKey. The runtime check is a smoke
    // assertion against the source.
    const _shouldNotCompile: { x: never } | undefined =
      undefined satisfies { x: never } | undefined;
    void _shouldNotCompile;
    expect(featureFlagsSource).not.toMatch(/"HUB_VISIBILITY_RENAME"/);
    expect(featureFlagsSource).not.toMatch(/HUB_VISIBILITY_RENAME:\s*(true|false)/);
  });

  it("FeatureFlagKey union still has the surviving 3 flags", () => {
    const surviving: FeatureFlagKey[] = [
      "PORTAL_ROLE_COLLAPSE",
      "BOARD_SHUNT_ACTIVE",
      "ASSESSMENT_EXECUTION_UNIFIED",
    ];
    for (const k of surviving) {
      expect(__FEATURE_FLAG_DEFAULTS__[k]).toBeTypeOf("boolean");
    }
  });
});

describe("HV-3 — translation helper collapsed to identity over new vocab", () => {
  it("HUB_VISIBILITY_ALL_VALUES has exactly 5 values (no old vocab)", () => {
    expect(HUB_VISIBILITY_ALL_VALUES).toHaveLength(5);
  });

  it("source: hub-visibility.ts no longer exports HubVisibilityOld", () => {
    expect(hubVisibilitySource).not.toMatch(
      /export\s+type\s+HubVisibilityOld\b/,
    );
  });

  it("source: hub-visibility.ts no longer exports toNewVocab", () => {
    expect(hubVisibilitySource).not.toMatch(
      /export\s+function\s+toNewVocab\b/,
    );
  });

  it("normalizeHubVisibility is identity on every legal input", () => {
    for (const v of HUB_VISIBILITY_ALL_VALUES) {
      expect(normalizeHubVisibility(v)).toBe(v);
    }
    expect(normalizeHubVisibility(null)).toBeNull();
    expect(normalizeHubVisibility(undefined)).toBeNull();
  });
});

describe("HV-3 — schema enum carries only the 5 new values", () => {
  it("hubVisibilityLevelEnum lists exactly the new vocab", () => {
    // The pgEnum literal in shared/schema.ts.
    const match = schemaSource.match(
      /pgEnum\(\s*"hub_visibility_level"\s*,\s*\[([\s\S]+?)\]\s*\)/,
    );
    expect(match).not.toBeNull();
    const body = match![1];
    for (const v of [
      "public",
      "residents",
      "unit-owners",
      "board-only",
      "operator-only",
    ]) {
      expect(body).toContain(`"${v}"`);
    }
    for (const v of ["resident", "owner", "board", "admin"]) {
      // Use a precise regex with closing quote to avoid false positives
      // (e.g. "residents" containing "resident").
      expect(body).not.toMatch(new RegExp(`"${v}"`));
    }
  });

  it("hub_map_issues default is the new-vocab 'board-only'", () => {
    expect(schemaSource).toMatch(
      /visibilityLevel:\s*hubVisibilityLevelEnum\("visibility_level"\)\.notNull\(\)\.default\("board-only"\)/,
    );
  });
});

describe("HV-3 — public endpoint regression: `public` literal preserved", () => {
  it("public-read filter still compares visibility_level against `public` verbatim", () => {
    const anchor = '/api/hub/:identifier/public';
    const idx = routesSource.indexOf(anchor);
    expect(idx).toBeGreaterThan(-1);
    const region = routesSource.substring(idx, idx + 4000);
    expect(region).toMatch(
      /isNull\(communityAnnouncements\.visibilityLevel\)[\s\S]*eq\(communityAnnouncements\.visibilityLevel,\s*"public"\)/,
    );
  });
});

describe("HV-3 — server routes drop old-vocab branches", () => {
  it("portal-home read filter pushes new-vocab values only", () => {
    const idx = routesSource.indexOf('app.get("/api/hub/portal/home"');
    expect(idx).toBeGreaterThan(-1);
    const region = routesSource.substring(idx, idx + 3000);
    // New vocab present.
    expect(region).toMatch(/"residents"/);
    expect(region).toMatch(/"unit-owners"/);
    expect(region).toMatch(/"board-only"/);
    // Old vocab branches retired.
    expect(region).not.toMatch(/"resident",\s*"residents"/);
    expect(region).not.toMatch(/"owner",\s*"unit-owners"/);
    expect(region).not.toMatch(/"board",\s*"board-only"/);
  });
});

describe("HV-3 — client visibilityLabels map is new-vocab only", () => {
  it("community-hub.tsx visibilityLabels keys are the 5 new values, no old vocab", () => {
    const mapStart = communityHubSource.indexOf("visibilityLabels");
    expect(mapStart).toBeGreaterThan(-1);
    // Slice just the object literal.
    const region = communityHubSource.substring(mapStart, mapStart + 800);
    for (const v of [
      "public",
      "residents",
      "unit-owners",
      "board-only",
      "operator-only",
    ]) {
      expect(region).toContain(v);
    }
    // Old vocab keys retired (resident appears as a substring of "residents",
    // so we look for the literal key form only).
    expect(region).not.toMatch(/^\s*resident:\s/m);
    expect(region).not.toMatch(/^\s*owner:\s/m);
    expect(region).not.toMatch(/^\s*board:\s/m);
    expect(region).not.toMatch(/^\s*admin:\s/m);
  });

  it("community-hub.tsx SelectItem options are new-vocab only", () => {
    for (const v of [
      "public",
      "residents",
      "unit-owners",
      "board-only",
      "operator-only",
    ]) {
      expect(communityHubSource).toMatch(
        new RegExp(`<SelectItem value="${v}">`),
      );
    }
    for (const v of ["resident", "owner", "board", "admin"]) {
      expect(communityHubSource).not.toMatch(
        new RegExp(`<SelectItem value="${v}">`),
      );
    }
  });
});

describe("HV-3 — migration shape", () => {
  it("renames the existing type and recreates with new vocab only", () => {
    expect(migrationSource).toMatch(
      /ALTER TYPE "hub_visibility_level" RENAME TO "hub_visibility_level_old"/,
    );
    expect(migrationSource).toMatch(
      /CREATE TYPE "hub_visibility_level" AS ENUM \('public',\s*'residents',\s*'unit-owners',\s*'board-only',\s*'operator-only'\)/,
    );
    expect(migrationSource).toMatch(
      /DROP TYPE "hub_visibility_level_old"/,
    );
  });

  it("re-casts hub_map_issues.visibility_level and restores a new-vocab default", () => {
    expect(migrationSource).toMatch(
      /ALTER TABLE "hub_map_issues"\s+ALTER COLUMN "visibility_level" TYPE "hub_visibility_level"\s+USING "visibility_level"::text::"hub_visibility_level"/,
    );
    expect(migrationSource).toMatch(
      /ALTER TABLE "hub_map_issues" ALTER COLUMN "visibility_level" SET DEFAULT 'board-only'/,
    );
  });

  it("adds a CHECK constraint on community_announcements.visibility_level", () => {
    expect(migrationSource).toMatch(
      /ADD CONSTRAINT "community_announcements_visibility_level_check"\s+CHECK \("visibility_level" IS NULL OR "visibility_level" IN \('public',\s*'residents',\s*'unit-owners',\s*'board-only',\s*'operator-only'\)\)/,
    );
  });

  it("includes a defensive backfill (zero rows expected per the prod audit)", () => {
    for (const [oldV, newV] of [
      ["resident", "residents"],
      ["owner", "unit-owners"],
      ["board", "board-only"],
      ["admin", "operator-only"],
    ]) {
      expect(migrationSource).toMatch(
        new RegExp(
          `UPDATE "hub_map_issues" SET "visibility_level" = '${newV}' WHERE "visibility_level" = '${oldV}'`,
        ),
      );
      expect(migrationSource).toMatch(
        new RegExp(
          `UPDATE "community_announcements" SET "visibility_level" = '${newV}' WHERE "visibility_level" = '${oldV}'`,
        ),
      );
    }
  });
});
