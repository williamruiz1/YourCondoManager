import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const fixture = readFileSync(resolve("tests/fixtures/money-cents-base.sql"), "utf8");
const releaseA = readFileSync(resolve("migrations/0072_money_cents_expand.sql"), "utf8");
const verifyReleaseA = readFileSync(resolve("tests/fixtures/money-cents-verify.sql"), "utf8")
  .replace(/^\\set.*$/gm, "");
const releaseB = readFileSync(resolve("migrations/0074_money_cents_read_switch.sql"), "utf8");
const rollbackB = readFileSync(
  resolve("migrations/rollback/0074_money_cents_read_switch.down.sql"),
  "utf8",
);

describe("money cents Release B database contract", () => {
  let db: PGlite;

  beforeEach(async () => {
    db = new PGlite();
    await db.waitReady;
  });

  afterEach(async () => {
    await db.close();
  });

  it("enforces cents reads, preserves rolling writers, and rolls back nullability only", async () => {
    await db.exec(fixture);
    await db.exec(releaseA);
    await db.exec(verifyReleaseA);
    await db.exec(releaseB);

    const notNull = await db.query<{ is_nullable: "YES" | "NO" }>(`
      SELECT is_nullable
      FROM information_schema.columns
      WHERE table_name = 'owner_ledger_entries' AND column_name = 'amount_cents'
    `);
    expect(notNull.rows[0]?.is_nullable).toBe("NO");

    await db.exec(`
      INSERT INTO owner_ledger_entries (id, association_id, amount)
      VALUES ('release-b-legacy-writer', 'a1', 42.15);

      INSERT INTO owner_ledger_entries (id, association_id, amount_cents)
      VALUES ('release-b-cents-writer', 'a1', -507);

      SELECT ycm_assert_money_cents_compatibility();
    `);

    const mirrored = await db.query<{
      id: string;
      amount_cents: number;
      amount_rounded: string;
    }>(`
      SELECT id, amount_cents, round(amount::numeric, 2)::text AS amount_rounded
      FROM owner_ledger_entries
      WHERE id IN ('release-b-legacy-writer', 'release-b-cents-writer')
      ORDER BY id
    `);
    expect(mirrored.rows).toEqual([
      {
        id: "release-b-cents-writer",
        amount_cents: -507,
        amount_rounded: "-5.07",
      },
      {
        id: "release-b-legacy-writer",
        amount_cents: 4215,
        amount_rounded: "42.15",
      },
    ]);

    await db.exec(rollbackB);
    const nullableAgain = await db.query<{ is_nullable: "YES" | "NO" }>(`
      SELECT is_nullable
      FROM information_schema.columns
      WHERE table_name = 'owner_ledger_entries' AND column_name = 'amount_cents'
    `);
    expect(nullableAgain.rows[0]?.is_nullable).toBe("YES");

    await db.exec(`
      INSERT INTO owner_ledger_entries (id, association_id, amount)
      VALUES ('release-a-after-rollback', 'a1', 1.23);
      SELECT ycm_assert_money_cents_compatibility();
    `);
    const afterRollback = await db.query<{ amount_cents: number }>(`
      SELECT amount_cents
      FROM owner_ledger_entries
      WHERE id = 'release-a-after-rollback'
    `);
    expect(afterRollback.rows[0]?.amount_cents).toBe(123);
  });
});
