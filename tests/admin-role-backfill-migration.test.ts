/**
 * Wave 38 / Phase 14 — `0019_backfill_legacy_board_admin.sql` integration test.
 *
 * The YCM test harness is pure-TS (vitest with no per-run Postgres container),
 * so we cannot actually run the migration here. Instead we statically verify
 * the migration file carries the exact contract agreed in the Wave 38 spec:
 *
 *   (a) Step 1 backfills self-managed `board-admin` rows to `board-officer`,
 *       joining `admin_users` → `admin_association_scopes` → `tenant_configs`
 *       and filtering on `tc.management_type = 'self-managed'`.
 *   (b) Step 2 backfills the residual `board-admin` rows to `assisted-board`
 *       (PM-managed associations + orphan/unscoped admins).
 *   (c) The migration is registered in `migrations/meta/_journal.json` with
 *       idx=18, tag=`0019_backfill_legacy_board_admin`, when=1777600000000.
 *   (d) The runtime enum in `shared/schema.ts` carries exactly the six
 *       canonical role values (no `board-admin`) so application code reading
 *       `admin_users.role` is guaranteed a canonical value post-migration.
 *   (e) `normalizeAdminRole` is fully retired — no source file references it.
 *
 * These assertions run fast, do not depend on a live database, and would have
 * caught every observed drift between the schema file, the migration script,
 * and the journal in prior phases.
 */

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const MIGRATION_PATH = resolve(
  REPO_ROOT,
  "migrations/0019_backfill_legacy_board_admin.sql",
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

describe("Wave 38 — 0019_backfill_legacy_board_admin.sql — Step 1 self-managed backfill", () => {
  it("UPDATEs admin_users to 'board-officer' for self-managed scopes", () => {
    expect(MIGRATION_SQL).toMatch(
      /UPDATE\s+admin_users\s+SET\s+role\s*=\s*'board-officer'/i,
    );
  });

  it("filters Step 1 on the legacy 'board-admin' role", () => {
    const step1Match = MIGRATION_SQL.match(
      /UPDATE\s+admin_users\s+SET\s+role\s*=\s*'board-officer'[\s\S]+?;/i,
    );
    expect(step1Match).not.toBeNull();
    expect(step1Match![0]).toMatch(/role\s*=\s*'board-admin'/i);
  });

  it("joins admin_association_scopes and tenant_configs on association_id", () => {
    const step1Match = MIGRATION_SQL.match(
      /UPDATE\s+admin_users\s+SET\s+role\s*=\s*'board-officer'[\s\S]+?;/i,
    );
    expect(step1Match).not.toBeNull();
    expect(step1Match![0]).toMatch(/admin_association_scopes/);
    expect(step1Match![0]).toMatch(/tenant_configs/);
    expect(step1Match![0]).toMatch(/management_type\s*=\s*'self-managed'/i);
  });
});

describe("Wave 38 — 0019_backfill_legacy_board_admin.sql — Step 2 residual backfill", () => {
  it("UPDATEs remaining admin_users to 'assisted-board'", () => {
    expect(MIGRATION_SQL).toMatch(
      /UPDATE\s+admin_users\s+SET\s+role\s*=\s*'assisted-board'\s+WHERE\s+role\s*=\s*'board-admin'\s*;/i,
    );
  });

  it("orders Step 2 after Step 1 (so self-managed wins over the assisted-board fallback)", () => {
    const step1Idx = MIGRATION_SQL.search(
      /UPDATE\s+admin_users\s+SET\s+role\s*=\s*'board-officer'/i,
    );
    const step2Idx = MIGRATION_SQL.search(
      /UPDATE\s+admin_users\s+SET\s+role\s*=\s*'assisted-board'/i,
    );
    expect(step1Idx).toBeGreaterThanOrEqual(0);
    expect(step2Idx).toBeGreaterThan(step1Idx);
  });
});

describe("Wave 38 — 0019_backfill_legacy_board_admin.sql — forward-only", () => {
  it("does not re-introduce 'board-admin' as a target role", () => {
    // Allow `WHERE role = 'board-admin'` (filter on legacy value) but no
    // `SET role = 'board-admin'` writes anywhere in the file.
    expect(MIGRATION_SQL).not.toMatch(/SET\s+role\s*=\s*'board-admin'/i);
  });

  it("does not include a CREATE TYPE / ALTER TYPE that re-adds 'board-admin'", () => {
    expect(MIGRATION_SQL).not.toMatch(/ADD\s+VALUE[^;]*'board-admin'/i);
    expect(MIGRATION_SQL).not.toMatch(/CREATE\s+TYPE[^;]*'board-admin'/i);
  });
});

describe("Wave 38 — migrations/meta/_journal.json — registration", () => {
  it("contains an entry for 0019_backfill_legacy_board_admin", () => {
    const entry = JOURNAL.entries.find(
      (e) => e.tag === "0019_backfill_legacy_board_admin",
    );
    expect(entry).toBeDefined();
  });

  it("registers the entry at idx 18 with when=1777600000000", () => {
    const entry = JOURNAL.entries.find(
      (e) => e.tag === "0019_backfill_legacy_board_admin",
    )!;
    expect(entry.idx).toBe(18);
    expect(entry.when).toBe(1777600000000);
    expect(entry.breakpoints).toBe(true);
  });

  it("places the entry after 0018_hub_visibility_rename_drop_old", () => {
    const tags = JOURNAL.entries.map((e) => e.tag);
    const prevIdx = tags.indexOf("0018_hub_visibility_rename_drop_old");
    const ourIdx = tags.indexOf("0019_backfill_legacy_board_admin");
    expect(prevIdx).toBeGreaterThanOrEqual(0);
    expect(ourIdx).toBe(prevIdx + 1);
  });
});

describe("Wave 38 — runtime enum parity (`shared/schema.ts`)", () => {
  it("`adminUserRoleEnum` carries exactly the six canonical roles", () => {
    const match = SCHEMA_SRC.match(
      /export const adminUserRoleEnum\s*=\s*pgEnum\("admin_user_role",\s*\[([^\]]+)\]\)/,
    );
    expect(match).not.toBeNull();
    const values = match![1]
      .split(",")
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
      .filter(Boolean);
    expect(values.sort()).toEqual(
      [
        "assisted-board",
        "board-officer",
        "manager",
        "pm-assistant",
        "platform-admin",
        "viewer",
      ].sort(),
    );
  });

  it("does NOT include 'board-admin' in the runtime enum", () => {
    // Note: the Postgres enum type still permits 'board-admin' as a legacy
    // value (it was never DROP VALUE'd) — that's a separate enum-collapse
    // migration tracked as a follow-up. The runtime TS enum is the gate
    // that prevents new code from emitting the legacy value.
    const match = SCHEMA_SRC.match(
      /export const adminUserRoleEnum\s*=\s*pgEnum\("admin_user_role",\s*\[([^\]]+)\]\)/,
    );
    expect(match).not.toBeNull();
    expect(match![1]).not.toMatch(/'board-admin'|"board-admin"/);
  });
});

describe("Wave 38 — `normalizeAdminRole` retirement", () => {
  it("no source file under server/ defines or calls `normalizeAdminRole`", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = resolve(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
          walk(full);
          continue;
        }
        if (!entry.name.endsWith(".ts")) continue;
        const src = readFileSync(full, "utf8");
        // Strip comments before scanning so the migration explainer comment
        // in routes.ts doesn't false-positive.
        const stripped = src
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/\/\/.*$/gm, "");
        if (/\bnormalizeAdminRole\b/.test(stripped)) {
          offenders.push(full);
        }
      }
    };
    walk(resolve(REPO_ROOT, "server"));
    expect(offenders).toEqual([]);
  });

  it("no test file under tests/ references `normalizeAdminRole` as a value (only this test as a string literal in assertions)", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = resolve(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
          walk(full);
          continue;
        }
        if (!entry.name.endsWith(".ts") && !entry.name.endsWith(".tsx")) continue;
        if (full === resolve(REPO_ROOT, "tests/admin-role-backfill-migration.test.ts")) continue;
        const src = readFileSync(full, "utf8");
        const stripped = src
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/\/\/.*$/gm, "");
        if (/\bnormalizeAdminRole\b/.test(stripped)) {
          offenders.push(full);
        }
      }
    };
    walk(resolve(REPO_ROOT, "tests"));
    expect(offenders).toEqual([]);
  });
});
