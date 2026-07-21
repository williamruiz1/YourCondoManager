import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { destructiveHits, isForwardMigrationPath } = require("../scripts/check-money-migrations.cjs");

describe("money migration review guard", () => {
  it("scans only top-level forward migrations", () => {
    expect(isForwardMigrationPath("migrations/0072_money_cents_expand.sql")).toBe(true);
    expect(isForwardMigrationPath("migrations/rollback/0072_money_cents_expand.down.sql")).toBe(false);
    expect(isForwardMigrationPath("migrations/meta/manual.sql")).toBe(false);
    expect(isForwardMigrationPath("docs/example.sql")).toBe(false);
  });

  it("continues to flag destructive DDL in a forward money migration", () => {
    expect(destructiveHits("ALTER TABLE owner_ledger_entries DROP COLUMN amount;", "owner_ledger_entries")).toBe(true);
    expect(destructiveHits("ALTER TABLE owner_ledger_entries ADD COLUMN amount_cents integer;", "owner_ledger_entries")).toBe(false);
  });
});
