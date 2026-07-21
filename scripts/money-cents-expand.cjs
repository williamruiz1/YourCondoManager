#!/usr/bin/env node
/** Operate Release A of the restartable money-cents expand/contract rollout. */
const { Client } = require("pg");

const mode = process.argv[2] || "status";
const batchSize = Number(process.argv[3] || 500);
const allowedModes = new Set(["status", "backfill", "assert"]);
if (!allowedModes.has(mode)) {
  console.error("usage: node scripts/money-cents-expand.cjs [status|backfill|assert] [batch-size]");
  process.exit(2);
}
if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 10000) {
  console.error("batch-size must be an integer from 1 to 10000");
  process.exit(2);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required");
  process.exit(2);
}

async function status(client) {
  const result = await client.query(`
    SELECT source, association_id, row_count, missing_cents_count,
           mismatch_count, legacy_total_cents, integer_total_cents, drift_cents
      FROM money_cents_compatibility_drift
     ORDER BY source, association_id
  `);
  console.table(result.rows);
  return result.rows;
}

async function backfill(client, fn) {
  let total = 0;
  for (;;) {
    const result = await client.query(`SELECT ${fn}($1) AS updated`, [batchSize]);
    const updated = Number(result.rows[0].updated);
    total += updated;
    console.log(`${fn}: batch=${updated} total=${total}`);
    if (updated === 0) return total;
  }
}

async function main() {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    if (mode === "status") {
      await status(client);
      return;
    }
    if (mode === "backfill") {
      await backfill(client, "ycm_backfill_owner_ledger_amount_cents");
      await backfill(client, "ycm_backfill_payment_webhook_amount_cents");
    }
    await client.query("SELECT ycm_assert_money_cents_compatibility()");
    const rows = await status(client);
    const bad = rows.filter((row) =>
      Number(row.missing_cents_count) !== 0 ||
      Number(row.mismatch_count) !== 0 ||
      Number(row.drift_cents) !== 0
    );
    if (bad.length) throw new Error("money-cents compatibility assertion returned drift");
    console.log("PASS: zero missing cents, mismatches, and cent drift");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`money-cents ${mode} failed: ${error.message}`);
  process.exit(1);
});

