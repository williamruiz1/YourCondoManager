/**
 * Wave 40 — `0020_admin_user_role_drop_board_admin.sql` integration test.
 *
 * Static SQL+journal+schema mirror assertion (same shape as the Wave 38
 * `tests/admin-role-backfill-migration.test.ts` test). Verifies the
 * migration carries the contract agreed in the Wave 40 spec: drop the
 * legacy `'board-admin'` value from the `admin_user_role` Postgres enum
 * via the standard rename-and-recreate pattern (Postgres has no
 * `ALTER TYPE … DROP VALUE`), preserve the `'viewer'` default, and
 * register at idx=19 in the journal.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const MIGRATION_SQL = readFileSync(
  resolve(REPO_ROOT, "migrations/0020_admin_user_role_drop_board_admin.sql"),
  "utf8",
);
const JOURNAL = JSON.parse(
  readFileSync(resolve(REPO_ROOT, "migrations/meta/_journal.json"), "utf8"),
) as { entries: Array<{ idx: number; when: number; tag: string; breakpoints: boolean }> };
const SCHEMA_SRC = readFileSync(resolve(REPO_ROOT, "shared/schema.ts"), "utf8");

describe("Wave 40 — 0020 — defensive backfill on every column bound to admin_user_role", () => {
  it("backfills admin_users.role from 'board-admin' to 'assisted-board'", () => {
    expect(MIGRATION_SQL).toMatch(
      /UPDATE\s+"?admin_users"?\s+SET\s+"?role"?\s*=\s*'assisted-board'\s+WHERE\s+"?role"?\s*=\s*'board-admin'\s*;/i,
    );
  });

  it("backfills permission_change_logs.old_role and new_role", () => {
    expect(MIGRATION_SQL).toMatch(
      /UPDATE\s+"?permission_change_logs"?\s+SET\s+"?old_role"?\s*=\s*'assisted-board'\s+WHERE\s+"?old_role"?\s*=\s*'board-admin'\s*;/i,
    );
    expect(MIGRATION_SQL).toMatch(
      /UPDATE\s+"?permission_change_logs"?\s+SET\s+"?new_role"?\s*=\s*'assisted-board'\s+WHERE\s+"?new_role"?\s*=\s*'board-admin'\s*;/i,
    );
  });
});

describe("Wave 40 — 0020 — enum-recreate + column-recast pattern", () => {
  it("drops the column default, renames old type, creates new type with the six canonical values, recasts all 3 columns, restores 'viewer' default, drops _old", () => {
    expect(MIGRATION_SQL).toMatch(
      /ALTER\s+TABLE\s+"?admin_users"?\s+ALTER\s+COLUMN\s+"?role"?\s+DROP\s+DEFAULT/i,
    );
    expect(MIGRATION_SQL).toMatch(
      /ALTER\s+TYPE\s+"?admin_user_role"?\s+RENAME\s+TO\s+"?admin_user_role_old"?/i,
    );
    const createMatch = MIGRATION_SQL.match(
      /CREATE\s+TYPE\s+"?admin_user_role"?\s+AS\s+ENUM\s*\(([\s\S]*?)\)/i,
    );
    expect(createMatch).not.toBeNull();
    const values = createMatch![1]
      .split(",")
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
      .filter(Boolean);
    expect(values.sort()).toEqual(
      ["assisted-board", "board-officer", "manager", "pm-assistant", "platform-admin", "viewer"].sort(),
    );
    expect(createMatch![1]).not.toMatch(/'board-admin'|"board-admin"/);
    expect(MIGRATION_SQL).toMatch(
      /ALTER\s+TABLE\s+"?admin_users"?[\s\S]+?ALTER\s+COLUMN\s+"?role"?\s+TYPE\s+"?admin_user_role"?[\s\S]+?USING\s+"?role"?::text::"?admin_user_role"?/i,
    );
    expect(MIGRATION_SQL).toMatch(
      /ALTER\s+COLUMN\s+"?old_role"?\s+TYPE\s+"?admin_user_role"?[\s\S]+?USING\s+"?old_role"?::text::"?admin_user_role"?/i,
    );
    expect(MIGRATION_SQL).toMatch(
      /ALTER\s+COLUMN\s+"?new_role"?\s+TYPE\s+"?admin_user_role"?[\s\S]+?USING\s+"?new_role"?::text::"?admin_user_role"?/i,
    );
    expect(MIGRATION_SQL).toMatch(
      /ALTER\s+TABLE\s+"?admin_users"?\s+ALTER\s+COLUMN\s+"?role"?\s+SET\s+DEFAULT\s+'viewer'/i,
    );
    expect(MIGRATION_SQL).toMatch(/DROP\s+TYPE\s+"?admin_user_role_old"?/i);
  });
});

describe("Wave 40 — 0020 — forward-only", () => {
  it("does not re-introduce 'board-admin' as a target value or in any CREATE/ADD VALUE", () => {
    expect(MIGRATION_SQL).not.toMatch(/SET\s+"?\w+"?\s*=\s*'board-admin'/i);
    expect(MIGRATION_SQL).not.toMatch(/ADD\s+VALUE[^;]*'board-admin'/i);
    for (const stmt of MIGRATION_SQL.match(/CREATE\s+TYPE[^;]*/gi) ?? []) {
      expect(stmt).not.toMatch(/'board-admin'/);
    }
  });
});

describe("Wave 40 — journal + schema parity", () => {
  it("journal registers 0020 at idx=19, when=1777700000000, immediately after 0019", () => {
    const tags = JOURNAL.entries.map((e) => e.tag);
    const prevIdx = tags.indexOf("0019_backfill_legacy_board_admin");
    const ourIdx = tags.indexOf("0020_admin_user_role_drop_board_admin");
    expect(prevIdx).toBeGreaterThanOrEqual(0);
    expect(ourIdx).toBe(prevIdx + 1);
    const entry = JOURNAL.entries[ourIdx]!;
    expect(entry.idx).toBe(19);
    expect(entry.when).toBe(1777700000000);
    expect(entry.breakpoints).toBe(true);
  });

  it("`shared/schema.ts` `adminUserRoleEnum` still carries the six canonical roles (no Wave 38 regression)", () => {
    const match = SCHEMA_SRC.match(
      /export const adminUserRoleEnum\s*=\s*pgEnum\("admin_user_role",\s*\[([^\]]+)\]\)/,
    );
    expect(match).not.toBeNull();
    const values = match![1]
      .split(",")
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
      .filter(Boolean);
    expect(values.sort()).toEqual(
      ["assisted-board", "board-officer", "manager", "pm-assistant", "platform-admin", "viewer"].sort(),
    );
  });
});
