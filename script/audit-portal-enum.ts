import "dotenv/config";
import { Pool } from "pg";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  console.log("\n🔎 Portal access role audit — Phase 8a.0 gate check\n");

  const agg = await pool.query(`
    SELECT
      role,
      count(*)::int AS row_count,
      count(*) FILTER (WHERE status = 'active')::int AS active_status,
      count(*) FILTER (WHERE last_login_at IS NOT NULL)::int AS ever_logged_in,
      count(*) FILTER (WHERE last_login_at > NOW() - INTERVAL '30 days')::int AS login_30d,
      count(*) FILTER (WHERE last_login_at > NOW() - INTERVAL '90 days')::int AS login_90d,
      MAX(last_login_at) AS most_recent_login,
      MIN(created_at) AS first_created,
      MAX(created_at) AS last_created
    FROM portal_access
    GROUP BY role
    ORDER BY role
  `);

  const rows = agg.rows;
  const totalRows = rows.reduce((sum, r) => sum + r.row_count, 0);

  console.log(`Total portal_access rows: ${totalRows}\n`);

  if (rows.length === 0) {
    console.log("(empty table — no portal_access records at all)\n");
    console.log("✅ PROCEED: Nothing to migrate. Phase 8a trivially safe.");
    await pool.end();
    return;
  }

  for (const r of rows) {
    const recent = r.most_recent_login ? new Date(r.most_recent_login).toISOString().slice(0, 10) : "never";
    console.log(
      `${r.role.padEnd(14)} ${String(r.row_count).padStart(5)} rows  ` +
        `(${r.active_status} active status, ${r.login_30d} login-last-30d, ${r.login_90d} login-last-90d, ` +
        `most-recent: ${recent})`,
    );
  }

  const aliasRoles = rows.filter((r) => r.role !== "owner");
  const aliasActive30d = aliasRoles.reduce((sum, r) => sum + r.login_30d, 0);
  const aliasActive90d = aliasRoles.reduce((sum, r) => sum + r.login_90d, 0);
  const aliasTotal = aliasRoles.reduce((sum, r) => sum + r.row_count, 0);

  console.log();

  if (aliasActive30d > 0) {
    console.log(`❌ HALT: ${aliasActive30d} alias-role rows active in last 30 days.`);
    console.log("   Phase 8a would flatten real user access. Remediate before migration.\n");

    for (const r of aliasRoles.filter((r) => r.login_30d > 0)) {
      const sample = await pool.query(
        `SELECT id, email, status, last_login_at, created_at
         FROM portal_access
         WHERE role = $1 AND last_login_at > NOW() - INTERVAL '30 days'
         ORDER BY last_login_at DESC
         LIMIT 10`,
        [r.role],
      );
      console.log(`   Sample ${r.role} rows active in last 30d:`);
      for (const s of sample.rows) {
        const emailMasked = s.email.replace(/^(.{2}).*@.*$/, "$1...@...");
        console.log(`     ${emailMasked.padEnd(16)} status=${s.status.padEnd(9)} last_login=${new Date(s.last_login_at).toISOString().slice(0, 10)}`);
      }
      console.log();
    }
  } else if (aliasTotal === 0) {
    console.log("✅ PROCEED: No alias-role rows (tenant/readonly/board-member) exist.");
    console.log("   Phase 8a migration is trivially safe. Enum collapse will affect zero rows.");
  } else if (aliasActive90d > 0) {
    console.log(`⚠️  REVIEW: ${aliasTotal} alias-role rows total, ${aliasActive90d} active in last 90 days (none in last 30).`);
    console.log("   Dormant but recent-ish. William decides: flatten to owner or remediate.");
  } else {
    console.log(`✅ PROCEED: ${aliasTotal} alias-role rows exist but all are dormant (> 90 days inactive).`);
    console.log("   Phase 8a safely flattens them to 'owner' during migration.");
  }

  console.log();
  await pool.end();
}

main().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
