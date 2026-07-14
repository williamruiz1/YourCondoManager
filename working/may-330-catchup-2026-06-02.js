/**
 * May 2026 $330 monthly-dues CATCH-UP for Cherry Hill Court (18 units).
 * association_id: f301d073-ed84-4d73-84ce-3ef28af66f7a
 *
 * STATUS: EXECUTED & VERIFIED — committed 18 rows on 2026-06-02 after the
 * runaway-loop incident was remediated (schedule 3682ab85 PAUSED,
 * next_run_date=2026-07-01; 7,326 phantom June rows deleted → June dues now
 * exactly 18/$5,940). Re-ran fresh dry-run + all Step-4 gates against prod
 * (loop confirmed stopped: 0 new June rows in 20min, 0 unit duplicates) →
 * all gates clean → committed in one transaction.
 * After-verify: 18 new 'monthly-dues-catchup' rows, $5,940 total, every unit
 * +$330 exactly, association ledger total $27,541.78 → $33,481.78 (+$5,940).
 *
 * (Prior halt context, 2026-06-02 earlier: did NOT execute on first pass —
 *  an active runaway loop was flooding the JUNE recurring charge — 408
 *  dup charges/unit, 7,344 rows, ~$2.42M phantom. Held per STOP-and-report.)
 *
 * Entry shape mirrors recurringChargesHandler (server/assessment-execution.ts):
 *   owner_ledger_entries:
 *     association_id = assoc
 *     unit_id        = unit
 *     person_id      = active ownership.person_id (ownerships where unit_id=? AND end_date IS NULL, limit 1)
 *     entry_type     = 'charge'            (positive amount = increases balance via ledgerSum)
 *     amount         = 330
 *     posted_at      = '2026-05-01'
 *     description    = 'Monthly HOA Dues — May 2026'
 *     reference_type = 'monthly-dues-catchup'   (catch-up marker; NOT 'recurring_charge_schedule')
 *     reference_id   = null
 *
 * Run via flyctl ssh argv-base64 pattern (see header of task).
 */
const { Client } = require("/app/node_modules/pg");

const ASSOC = "f301d073-ed84-4d73-84ce-3ef28af66f7a";
const AMOUNT = 330;
const POSTED_AT = "2026-05-01";
const DESCRIPTION = "Monthly HOA Dues — May 2026";
const REFERENCE_TYPE = "monthly-dues-catchup";
const COMMIT = process.env.CATCHUP_COMMIT === "1"; // safety: dry-run unless explicitly set

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  // Resolve active owner per unit (mirror handler: ownerships end_date IS NULL).
  const plan = await c.query(
    `select u.id as unit_id, o.person_id
       from units u
       left join lateral (
         select person_id from ownerships
          where unit_id = u.id and end_date is null
          order by start_date desc nulls last limit 1
       ) o on true
      where u.association_id = $1
      order by u.id`,
    [ASSOC]
  );

  const rows = plan.rows;
  const planned = rows.map(r => ({
    unit_id: r.unit_id, person_id: r.person_id, amount: AMOUNT,
  }));
  console.log("=== DRY-RUN PLAN (18 expected) ===");
  console.table(planned);

  // Step 4 self-verify gates
  const problems = [];
  if (rows.length !== 18) problems.push(`unit count = ${rows.length}, expected 18`);
  const unresolved = rows.filter(r => !r.person_id);
  if (unresolved.length) problems.push(`unresolved owner for units: ${unresolved.map(r=>r.unit_id).join(",")}`);

  const existing = await c.query(
    `select unit_id, count(*)::int n from owner_ledger_entries
      where association_id=$1
        and entry_type='charge'
        and date_trunc('month',posted_at)='2026-05-01'
        and (reference_type=$2 or description=$3)
      group by unit_id`,
    [ASSOC, REFERENCE_TYPE, DESCRIPTION]
  );
  if (existing.rows.length) problems.push(`May dues catch-up already exists for ${existing.rows.length} units`);

  if (problems.length) {
    console.log("=== STOP — self-verify failed ===");
    problems.forEach(p => console.log(" - " + p));
    await c.end();
    return;
  }

  if (!COMMIT) {
    console.log("=== DRY-RUN ONLY (set CATCHUP_COMMIT=1 to write) — no rows inserted ===");
    await c.end();
    return;
  }

  // Step 5 — single transaction
  await c.query("BEGIN");
  try {
    for (const r of planned) {
      await c.query(
        `insert into owner_ledger_entries
           (association_id, unit_id, person_id, entry_type, amount, posted_at, description, reference_type, reference_id)
         values ($1,$2,$3,'charge',$4,$5,$6,$7,null)`,
        [ASSOC, r.unit_id, r.person_id, r.amount, POSTED_AT, DESCRIPTION, REFERENCE_TYPE]
      );
    }
    await c.query("COMMIT");
    console.log(`=== COMMITTED ${planned.length} rows ===`);
  } catch (e) {
    await c.query("ROLLBACK");
    console.error("ROLLBACK:", e.message);
    process.exit(1);
  }
  await c.end();
})().catch(e => { console.error("ERR", e.message); process.exit(1); });
