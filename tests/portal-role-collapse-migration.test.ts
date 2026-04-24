/**
 * Phase 8a — `0014_portal_role_collapse.sql` integration test.
 *
 * The YCM test harness is pure-TS (vitest with no per-run Postgres container),
 * so we cannot actually run the migration here. Instead we statically verify
 * the migration file carries the exact contract agreed in the Phase 8a spec:
 *
 *   (a) Defensive backfill of the two retired enum values (`tenant`, `readonly`)
 *       to `owner` — covers the 4 `tenant` rows found by the 2026-04-24 prod
 *       audit and the zero `readonly` rows (defensive).
 *   (b) Drop-default → rename-old → create-new → USING-recast → drop-old →
 *       restore-default sequence, matching the Postgres-mandated pattern for
 *       enum value removal.
 *   (c) The new enum carries exactly `{owner, board-member}` — the two values
 *       approved in 2.2 Q1 / 3.3 Q1.
 *   (d) The default on `portal_access.role` is `owner`, matching the enum
 *       definition in `shared/schema.ts`.
 *   (e) The migration is registered in `migrations/meta/_journal.json` with
 *       idx=13, tag=`0014_portal_role_collapse`, when=1777100000000.
 *   (f) The runtime enum in `shared/schema.ts` carries the same two values so
 *       drizzle-kit cannot reopen a drift delta post-deploy.
 *
 * These assertions run fast, do not depend on a live database, and would have
 * caught every observed drift between the schema file, the migration script,
 * and the journal in prior phases (e.g. missed journal entry, wrong `when`).
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const MIGRATION_PATH = resolve(
  REPO_ROOT,
  "migrations/0014_portal_role_collapse.sql",
);
const JOURNAL_PATH = resolve(REPO_ROOT, "migrations/meta/_journal.json");
const SCHEMA_PATH = resolve(REPO_ROOT, "shared/schema.ts");

const MIGRATION_SQL = readFileSync(MIGRATION_PATH, "utf8");
const JOURNAL = JSON.parse(readFileSync(JOURNAL_PATH, "utf8")) as {
  entries: Array<{
    idx: number;
    version: string;
    when: number;
    tag: string;
    breakpoints: boolean;
  }>;
};
const SCHEMA_SRC = readFileSync(SCHEMA_PATH, "utf8");

describe("Phase 8a — 0014_portal_role_collapse.sql — defensive backfill", () => {
  it("issues an UPDATE that collapses `tenant` portal rows to `owner`", () => {
    expect(MIGRATION_SQL).toMatch(
      /UPDATE\s+portal_access\s+SET\s+role\s*=\s*'owner'\s+WHERE\s+role\s*=\s*'tenant'\s*;/i,
    );
  });

  it("issues a defensive UPDATE that collapses `readonly` portal rows to `owner`", () => {
    // Prod audit 2026-04-24 found 0 `readonly` rows — this UPDATE is a
    // defence-in-depth guard in case a new row lands between audit and
    // migration.
    expect(MIGRATION_SQL).toMatch(
      /UPDATE\s+portal_access\s+SET\s+role\s*=\s*'owner'\s+WHERE\s+role\s*=\s*'readonly'\s*;/i,
    );
  });

  it("orders the backfill UPDATEs before the enum recreate DDL", () => {
    const backfillIdx = MIGRATION_SQL.search(/UPDATE\s+portal_access/i);
    const renameIdx = MIGRATION_SQL.search(/ALTER\s+TYPE\s+portal_access_role\s+RENAME/i);
    expect(backfillIdx).toBeGreaterThanOrEqual(0);
    expect(renameIdx).toBeGreaterThan(backfillIdx);
  });
});

describe("Phase 8a — 0014_portal_role_collapse.sql — enum recreate DDL", () => {
  it("drops the column default before renaming the enum type", () => {
    const dropDefaultIdx = MIGRATION_SQL.search(
      /ALTER\s+TABLE\s+portal_access\s+ALTER\s+COLUMN\s+role\s+DROP\s+DEFAULT/i,
    );
    const renameIdx = MIGRATION_SQL.search(
      /ALTER\s+TYPE\s+portal_access_role\s+RENAME\s+TO\s+portal_access_role_old/i,
    );
    expect(dropDefaultIdx).toBeGreaterThanOrEqual(0);
    expect(renameIdx).toBeGreaterThan(dropDefaultIdx);
  });

  it("creates the new enum with exactly ['owner', 'board-member']", () => {
    expect(MIGRATION_SQL).toMatch(
      /CREATE\s+TYPE\s+portal_access_role\s+AS\s+ENUM\s*\(\s*'owner'\s*,\s*'board-member'\s*\)\s*;/i,
    );
    // No retired values leak into the new definition.
    expect(MIGRATION_SQL).not.toMatch(
      /CREATE\s+TYPE\s+portal_access_role\s+AS\s+ENUM\s*\([^)]*'tenant'/i,
    );
    expect(MIGRATION_SQL).not.toMatch(
      /CREATE\s+TYPE\s+portal_access_role\s+AS\s+ENUM\s*\([^)]*'readonly'/i,
    );
  });

  it("recasts the column via USING role::text::portal_access_role", () => {
    expect(MIGRATION_SQL).toMatch(
      /ALTER\s+TABLE\s+portal_access\s+ALTER\s+COLUMN\s+role\s+TYPE\s+portal_access_role\s+USING\s+role::text::portal_access_role/i,
    );
  });

  it("drops the renamed old enum after the recast", () => {
    const recastIdx = MIGRATION_SQL.search(
      /ALTER\s+TABLE\s+portal_access\s+ALTER\s+COLUMN\s+role\s+TYPE\s+portal_access_role/i,
    );
    const dropOldIdx = MIGRATION_SQL.search(
      /DROP\s+TYPE\s+portal_access_role_old/i,
    );
    expect(recastIdx).toBeGreaterThanOrEqual(0);
    expect(dropOldIdx).toBeGreaterThan(recastIdx);
  });

  it("restores the column default to 'owner' after the recast", () => {
    expect(MIGRATION_SQL).toMatch(
      /ALTER\s+TABLE\s+portal_access\s+ALTER\s+COLUMN\s+role\s+SET\s+DEFAULT\s+'owner'/i,
    );
  });
});

describe("Phase 8a — migrations/meta/_journal.json", () => {
  it("registers 0014_portal_role_collapse as idx=13", () => {
    const entry = JOURNAL.entries.find(
      (e) => e.tag === "0014_portal_role_collapse",
    );
    expect(entry).toBeDefined();
    expect(entry?.idx).toBe(13);
  });

  it("stamps when=1777100000000 (Phase 8a ship window)", () => {
    const entry = JOURNAL.entries.find(
      (e) => e.tag === "0014_portal_role_collapse",
    );
    expect(entry?.when).toBe(1777100000000);
  });

  it("is strictly newer than 0013_pm_toggles", () => {
    const prev = JOURNAL.entries.find((e) => e.tag === "0013_pm_toggles");
    const curr = JOURNAL.entries.find(
      (e) => e.tag === "0014_portal_role_collapse",
    );
    expect(prev).toBeDefined();
    expect(curr).toBeDefined();
    expect((curr?.when ?? 0)).toBeGreaterThan(prev?.when ?? 0);
    expect((curr?.idx ?? -1)).toBe((prev?.idx ?? -1) + 1);
  });
});

describe("Phase 8a — shared/schema.ts enum mirrors the migration", () => {
  it("declares portal_access_role as ['owner', 'board-member']", () => {
    // The drizzle enum in shared/schema.ts must match the CREATE TYPE body
    // in 0014 so drizzle-kit never reopens a drift delta.
    expect(SCHEMA_SRC).toMatch(
      /portalAccessRoleEnum\s*=\s*pgEnum\(\s*"portal_access_role"\s*,\s*\[\s*"owner"\s*,\s*"board-member"\s*\]\s*\)/,
    );
  });

  it("no longer declares the retired tenant/readonly values", () => {
    // Belt-and-suspenders: ensures a future edit cannot silently re-introduce
    // the 4-value enum without updating the migration.
    expect(SCHEMA_SRC).not.toMatch(
      /portalAccessRoleEnum[^;]*"tenant"/,
    );
    expect(SCHEMA_SRC).not.toMatch(
      /portalAccessRoleEnum[^;]*"readonly"/,
    );
  });

  it("keeps the column default at 'owner' in the table definition", () => {
    // The schema.ts column default and the migration's SET DEFAULT must agree.
    expect(SCHEMA_SRC).toMatch(
      /role:\s*portalAccessRoleEnum\("role"\)\.notNull\(\)\.default\("owner"\)/,
    );
  });
});
