/**
 * Verifies A-6 and B-5 production readiness checks:
 *   A-6: Cherry Hill Court data complete in DB (EIN, dateFormed, address, buildings, units)
 *   B-5: yourcondomanagement@gmail.com is active with platform-admin role
 */
import { pool } from "../server/db";

async function main() {
  const client = await pool.connect();
  let failures = 0;

  // ── A-6: Cherry Hill Court ──────────────────────────────────────────────
  console.log("=== A-6: Cherry Hill Court data ===\n");

  const assocResult = await client.query(`
    SELECT id, name, ein, date_formed, address, city, state, is_archived
    FROM associations
    WHERE LOWER(name) LIKE '%cherry hill%' AND is_archived = 0
  `);

  if (assocResult.rowCount === 0) {
    console.error("  FAIL  Association not found in DB");
    failures++;
  } else {
    for (const row of assocResult.rows) {
      console.log(`  Association: ${row.name} (id=${row.id})`);
      console.log(`    archived:    ${row.is_archived ? "YES — needs fix" : "no"}`);
      console.log(`    EIN:         ${row.ein || "MISSING"}`);
      console.log(`    dateFormed:  ${row.date_formed || "MISSING"}`);
      console.log(`    address:     ${row.address || "MISSING"}`);
      console.log(`    city/state:  ${row.city || "MISSING"} / ${row.state || "MISSING"}`);

      if (!row.ein) { console.error("  FAIL  EIN is missing"); failures++; }
      if (!row.date_formed) { console.warn("  WARN  dateFormed is missing (optional but expected)"); }
      if (!row.address) { console.warn("  WARN  address is missing (optional but expected)"); }

      // Buildings
      const bldResult = await client.query(
        `SELECT id, name FROM buildings WHERE association_id = $1`, [row.id]
      );
      console.log(`\n    Buildings (${bldResult.rowCount}):`);
      for (const b of bldResult.rows) console.log(`      - ${b.name} (${b.id})`);
      if (bldResult.rowCount === 0) {
        console.error("  FAIL  No buildings — seed script may not have run");
        failures++;
      }

      // Units
      const unitResult = await client.query(
        `SELECT COUNT(*)::int AS n FROM units WHERE association_id = $1`, [row.id]
      );
      const unitCount = unitResult.rows[0]?.n ?? 0;
      console.log(`\n    Units: ${unitCount}`);
      if (unitCount === 0) {
        console.error("  FAIL  No units — seed script may not have run");
        failures++;
      }
    }
  }

  // ── B-5: yourcondomanagement@gmail.com ─────────────────────────────────
  console.log("\n=== B-5: yourcondomanagement@gmail.com admin account ===\n");

  const adminResult = await client.query(`
    SELECT id, email, role, is_active
    FROM admin_users
    WHERE email = 'yourcondomanagement@gmail.com'
  `);

  if (adminResult.rowCount === 0) {
    console.error("  FAIL  admin_users record not found");
    failures++;
  } else {
    const admin = adminResult.rows[0];
    console.log(`  admin_users: role=${admin.role} is_active=${admin.is_active}`);
    if (admin.role !== "platform-admin") {
      console.error(`  FAIL  Expected role=platform-admin, got ${admin.role}`);
      failures++;
    } else {
      console.log("  OK    role is platform-admin");
    }
    if (admin.is_active !== 1) {
      console.error(`  FAIL  is_active=${admin.is_active} — account is blocked`);
      failures++;
    } else {
      console.log("  OK    account is active");
    }
  }

  const authResult = await client.query(`
    SELECT au.id, au.email, au.is_active, au.admin_user_id
    FROM auth_users au
    WHERE au.email = 'yourcondomanagement@gmail.com'
  `);

  if (authResult.rowCount === 0) {
    console.warn("  WARN  auth_users record not found — user has not signed in via Google yet");
  } else {
    const auth = authResult.rows[0];
    console.log(`\n  auth_users: is_active=${auth.is_active} admin_user_id=${auth.admin_user_id || "null"}`);
    if (auth.is_active !== 1) {
      console.error("  FAIL  auth_users.is_active is not 1 — OAuth login will be blocked");
      failures++;
    } else {
      console.log("  OK    auth_users is active");
    }
    if (!auth.admin_user_id) {
      console.warn("  WARN  auth_users.admin_user_id is null — link to admin_users not set");
    } else {
      console.log("  OK    auth_users linked to admin_users");
    }
  }

  client.release();

  console.log(`\n${failures === 0 ? "All checks passed — ready for production." : `${failures} issue(s) found.`}`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Verification failed to run:", err);
  process.exit(1);
});
