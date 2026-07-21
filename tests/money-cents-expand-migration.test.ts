import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve("migrations/0072_money_cents_expand.sql"), "utf8");
const rollback = readFileSync(resolve("migrations/rollback/0072_money_cents_expand.down.sql"), "utf8");

describe("money cents expand migration", () => {
  it("is additive and leaves both legacy money columns in place", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS amount_cents integer");
    expect(migration).not.toMatch(/DROP COLUMN\s+amount\b/i);
    expect(migration).not.toMatch(/ALTER COLUMN\s+amount_cents\s+SET NOT NULL/i);
  });

  it("uses one compatibility trigger for old and new writers", () => {
    expect(migration).toContain("ycm_sync_money_compat_columns");
    expect(migration).toContain("BEFORE INSERT OR UPDATE OF amount, amount_cents");
    expect(migration).toContain("amount/amount_cents mismatch");
  });

  it("provides restartable bounded backfills and a zero-drift assertion", () => {
    expect(migration).toContain("FOR UPDATE SKIP LOCKED");
    expect(migration).toContain("ycm_backfill_owner_ledger_amount_cents");
    expect(migration).toContain("ycm_backfill_payment_webhook_amount_cents");
    expect(migration).toContain("money_cents_compatibility_drift");
    expect(migration).toContain("ycm_assert_money_cents_compatibility");
  });

  it("has an additive-release rollback with no money rewrite", () => {
    expect(rollback).toContain("DROP COLUMN IF EXISTS amount_cents");
    expect(rollback).not.toMatch(/UPDATE\s+(owner_ledger_entries|payment_webhook_events)/i);
  });
});
