/**
 * Pre-deploy FK integrity check.
 * Run before each pg_restore / production deploy to catch orphaned rows
 * that would cause the restore to fail silently or with constraint errors.
 *
 * Usage:  npx tsx script/check-fk-integrity.ts
 * Exit 0 = clean, Exit 1 = violations found (block the deploy).
 */
import { pool } from "../server/db";

type Check = { label: string; sql: string };

const checks: Check[] = [
  {
    label: "units → associations",
    sql: `SELECT COUNT(*)::int AS n FROM units u
          WHERE u.association_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM associations a WHERE a.id = u.association_id)`,
  },
  {
    label: "ownerships → units",
    sql: `SELECT COUNT(*)::int AS n FROM ownerships o
          WHERE o.unit_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM units u WHERE u.id = o.unit_id)`,
  },
  {
    label: "ownerships → persons",
    sql: `SELECT COUNT(*)::int AS n FROM ownerships o
          WHERE o.person_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM persons p WHERE p.id = o.person_id)`,
  },
  {
    label: "owner_ledger_entries → associations",
    sql: `SELECT COUNT(*)::int AS n FROM owner_ledger_entries e
          WHERE e.association_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM associations a WHERE a.id = e.association_id)`,
  },
  {
    label: "owner_ledger_entries → units",
    sql: `SELECT COUNT(*)::int AS n FROM owner_ledger_entries e
          WHERE e.unit_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM units u WHERE u.id = e.unit_id)`,
  },
  {
    label: "work_orders → associations",
    sql: `SELECT COUNT(*)::int AS n FROM work_orders w
          WHERE w.association_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM associations a WHERE a.id = w.association_id)`,
  },
  {
    label: "work_orders → units",
    sql: `SELECT COUNT(*)::int AS n FROM work_orders w
          WHERE w.unit_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM units u WHERE u.id = w.unit_id)`,
  },
  {
    label: "documents → associations",
    sql: `SELECT COUNT(*)::int AS n FROM documents d
          WHERE d.association_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM associations a WHERE a.id = d.association_id)`,
  },
  {
    label: "governance_meetings → associations",
    sql: `SELECT COUNT(*)::int AS n FROM governance_meetings m
          WHERE m.association_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM associations a WHERE a.id = m.association_id)`,
  },
  {
    label: "board_packages → governance_meetings",
    sql: `SELECT COUNT(*)::int AS n FROM board_packages bp
          WHERE bp.meeting_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM governance_meetings m WHERE m.id = bp.meeting_id)`,
  },
  {
    label: "auth_users → admin_users",
    sql: `SELECT COUNT(*)::int AS n FROM auth_users au
          WHERE au.admin_user_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM admin_users a WHERE a.id = au.admin_user_id)`,
  },
  {
    label: "portal_access → associations",
    sql: `SELECT COUNT(*)::int AS n FROM portal_access pa
          WHERE pa.association_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM associations a WHERE a.id = pa.association_id)`,
  },
];

async function run() {
  const client = await pool.connect();
  let violations = 0;

  console.log("Running FK integrity checks...\n");

  for (const check of checks) {
    try {
      const result = await client.query<{ n: number }>(check.sql);
      const count = result.rows[0]?.n ?? 0;
      if (count > 0) {
        console.error(`  FAIL  [${check.label}] — ${count} orphaned row(s)`);
        violations++;
      } else {
        console.log(`  OK    [${check.label}]`);
      }
    } catch (err: any) {
      // Table may not exist in all environments — skip gracefully
      if (err.code === "42P01") {
        console.log(`  SKIP  [${check.label}] — table does not exist`);
      } else {
        console.error(`  ERR   [${check.label}] — ${err.message}`);
        violations++;
      }
    }
  }

  client.release();
  console.log(`\n${violations === 0 ? "All checks passed." : `${violations} violation(s) found — fix before deploying.`}`);
  process.exit(violations > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("FK check failed to run:", err);
  process.exit(1);
});
