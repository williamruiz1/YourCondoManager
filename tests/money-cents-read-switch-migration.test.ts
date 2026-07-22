import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve("migrations/0074_money_cents_read_switch.sql"), "utf8");
const rollback = readFileSync(resolve("migrations/rollback/0074_money_cents_read_switch.down.sql"), "utf8");

describe("money cents Release B migration", () => {
  it("fails closed on drift before making cents mandatory", () => {
    const firstAssert = migration.indexOf("SELECT ycm_assert_money_cents_compatibility()");
    const setNotNull = migration.indexOf("ALTER COLUMN amount_cents SET NOT NULL");

    expect(firstAssert).toBeGreaterThanOrEqual(0);
    expect(setNotNull).toBeGreaterThan(firstAssert);
    expect(migration).toContain("VALIDATE CONSTRAINT owner_ledger_entries_amount_compat_ck");
    expect(migration).toContain("VALIDATE CONSTRAINT payment_webhook_events_amount_compat_ck");
  });

  it("keeps legacy columns and compatibility triggers for rolling rollback", () => {
    expect(migration).not.toMatch(/DROP\s+(COLUMN|TRIGGER)/i);
    expect(migration).not.toMatch(/UPDATE\s+(owner_ledger_entries|payment_webhook_events)/i);
  });

  it("rolls back nullability without rewriting money", () => {
    expect(rollback).toContain("ALTER COLUMN amount_cents DROP NOT NULL");
    const executableSql = rollback.replace(/^\s*--.*$/gm, "");
    expect(executableSql).not.toMatch(/UPDATE|DELETE|DROP\s+COLUMN/i);
  });
});
