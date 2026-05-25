/**
 * backfill-chc-recurring-dues.cjs — Seed Cherry Hill Court Condominiums (CHC)
 * with a recurring HOA dues schedule so the auto-billing scheduler actually
 * posts monthly charges against each owner's ledger.
 *
 * Context (founder-os#2477, P1):
 *   - Cherry Hill (association id f301d073-ed84-4d73-84ce-3ef28af66f7a) has
 *     ZERO recurring_charge_schedules rows. The 5-minute automation sweep
 *     therefore finds nothing to bill and dispatched=0 every tick.
 *   - This script creates ONE recurring_charge_schedules row scoped to the
 *     full association (unit_id NULL = expand to all units at run time),
 *     monthly, $280, due on the 1st. It ALSO creates one hoa_fee_schedules
 *     row so the Finance → Recurring Assessments UI surfaces the dues.
 *
 * Why pure CJS + raw pg (no drizzle, no ts):
 *   - The production image (Dockerfile) ships only dist/ + node_modules/. To
 *     run this from `flyctl ssh console` we need a script that resolves with
 *     just `pg`, which is already in production deps. The Dockerfile in this
 *     PR adds `COPY scripts/ ./scripts/` so this file lands at /app/scripts/.
 *   - Pure SQL keeps the on-prod-shell footprint tiny (no tsx, no esbuild)
 *     and lets the script run identically locally (dev DB) and in prod.
 *
 * Idempotency:
 *   - We pre-check by (association_id, charge_description) on
 *     recurring_charge_schedules, and by (association_id, name) on
 *     hoa_fee_schedules. Re-runs print "already exists, skipping" and exit 0.
 *
 * Usage (local):
 *   DATABASE_URL=postgres://... node scripts/backfill-chc-recurring-dues.cjs
 *
 * Usage (production — William action documented in PR body):
 *   flyctl ssh console -a yourcondomanager -C 'cd /app && \
 *     NODE_PATH=/app/node_modules node scripts/backfill-chc-recurring-dues.cjs'
 */

"use strict";

const pg = require("pg");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

// ── Canonical inputs ────────────────────────────────────────────────────────
const ASSOCIATION_ID = "f301d073-ed84-4d73-84ce-3ef28af66f7a"; // CHC condo
const SCHEDULE_DESCRIPTION = "Monthly HOA Dues";
const FEE_SCHEDULE_NAME = "Monthly HOA Dues";
const AMOUNT = 280; // dollars
const FREQUENCY = "monthly";
const DAY_OF_MONTH = 1;
const GRACE_DAYS = 10;
const STATUS = "active";

function nextRunDateAfter(now, dayOfMonth) {
  // Match server/routes.ts compute logic: the next occurrence of dayOfMonth.
  // If we're already past it in the current month, roll to next month.
  const candidate = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);
  if (candidate <= now) {
    candidate.setMonth(candidate.getMonth() + 1);
  }
  return candidate;
}

async function main() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Sanity-check the association exists. If it doesn't, abort — we don't
    // want to silently insert a row pointing at a missing parent.
    const assocCheck = await client.query(
      "SELECT id, name FROM associations WHERE id = $1 LIMIT 1",
      [ASSOCIATION_ID],
    );
    if (assocCheck.rowCount === 0) {
      throw new Error(
        `Association ${ASSOCIATION_ID} (Cherry Hill Court Condominiums) not found. ` +
          "Confirm DATABASE_URL points at the right environment, then re-run.",
      );
    }
    console.log(`Found association: ${assocCheck.rows[0].name} (${ASSOCIATION_ID})`);

    // ── 1. recurring_charge_schedules (the execution-engine row) ──────────
    const recurringExisting = await client.query(
      `SELECT id, amount, frequency, day_of_month, status
         FROM recurring_charge_schedules
        WHERE association_id = $1 AND charge_description = $2
        LIMIT 1`,
      [ASSOCIATION_ID, SCHEDULE_DESCRIPTION],
    );

    if (recurringExisting.rowCount > 0) {
      const row = recurringExisting.rows[0];
      console.log(
        `[skip] recurring_charge_schedules row already exists: id=${row.id} ` +
          `amount=${row.amount} frequency=${row.frequency} day=${row.day_of_month} status=${row.status}`,
      );
    } else {
      const nextRun = nextRunDateAfter(new Date(), DAY_OF_MONTH);
      const insertRecurring = await client.query(
        `INSERT INTO recurring_charge_schedules
           (association_id, unit_id, charge_description, entry_type, amount,
            frequency, day_of_month, next_run_date, status, max_retries,
            unit_scope_mode, grace_days, created_by)
         VALUES ($1, NULL, $2, 'charge', $3,
                 $4, $5, $6, $7, 3,
                 'all-units', $8, 'backfill@chc-2477')
         RETURNING id, next_run_date`,
        [
          ASSOCIATION_ID,
          SCHEDULE_DESCRIPTION,
          AMOUNT,
          FREQUENCY,
          DAY_OF_MONTH,
          nextRun,
          STATUS,
          GRACE_DAYS,
        ],
      );
      console.log(
        `[ok] recurring_charge_schedules inserted: id=${insertRecurring.rows[0].id} ` +
          `next_run_date=${insertRecurring.rows[0].next_run_date.toISOString()}`,
      );
    }

    // ── 2. hoa_fee_schedules (the Finance-UI surface row) ─────────────────
    // Frequency vocabulary on hoa_fee_schedules is feeFrequencyEnum (monthly,
    // quarterly, annually, one-time) — same "monthly" token, no translation
    // needed.
    const feeExisting = await client.query(
      `SELECT id, amount, frequency, grace_days
         FROM hoa_fee_schedules
        WHERE association_id = $1 AND name = $2
        LIMIT 1`,
      [ASSOCIATION_ID, FEE_SCHEDULE_NAME],
    );

    if (feeExisting.rowCount > 0) {
      const row = feeExisting.rows[0];
      console.log(
        `[skip] hoa_fee_schedules row already exists: id=${row.id} ` +
          `amount=${row.amount} frequency=${row.frequency} grace_days=${row.grace_days}`,
      );
    } else {
      const insertFee = await client.query(
        `INSERT INTO hoa_fee_schedules
           (association_id, name, amount, frequency, start_date, grace_days,
            is_active, notes)
         VALUES ($1, $2, $3, $4, NOW(), $5, 1,
                 'Backfilled by scripts/backfill-chc-recurring-dues.cjs (founder-os#2477). Due day 1 of each month.')
         RETURNING id`,
        [ASSOCIATION_ID, FEE_SCHEDULE_NAME, AMOUNT, FREQUENCY, GRACE_DAYS],
      );
      console.log(
        `[ok] hoa_fee_schedules inserted: id=${insertFee.rows[0].id} ` +
          `name="${FEE_SCHEDULE_NAME}" amount=${AMOUNT} frequency=${FREQUENCY}`,
      );
    }

    // ── 3. Report unit count so William can sanity-check expected fan-out ─
    const unitCount = await client.query(
      "SELECT COUNT(*)::int AS n FROM units WHERE association_id = $1",
      [ASSOCIATION_ID],
    );
    console.log(
      `Cherry Hill has ${unitCount.rows[0].n} units. The next sweep will post ` +
        `${unitCount.rows[0].n} owner_ledger_entries rows on the next due date.`,
    );

    await client.query("COMMIT");
    console.log("\nBackfill complete.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Backfill failed:", err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
