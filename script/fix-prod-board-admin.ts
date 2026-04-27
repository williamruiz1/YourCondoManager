import { Client } from "pg";

const connString = process.env.DATABASE_URL;
if (!connString) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const client = new Client({ connectionString: connString });
await client.connect();

console.log("Connected. Checking for board-admin rows...\n");

const before = await client.query(`
  SELECT 'admin_users.role' AS where_, count(*) FROM admin_users WHERE role::text = 'board-admin'
  UNION ALL
  SELECT 'pcl.old_role', count(*) FROM permission_change_logs WHERE old_role::text = 'board-admin'
  UNION ALL
  SELECT 'pcl.new_role', count(*) FROM permission_change_logs WHERE new_role::text = 'board-admin'
`);
console.table(before.rows);

const r1 = await client.query(`UPDATE admin_users SET role = 'assisted-board' WHERE role::text = 'board-admin'`);
console.log(`\nUpdated admin_users.role: ${r1.rowCount} row(s)`);

const r2 = await client.query(`UPDATE permission_change_logs SET old_role = 'assisted-board' WHERE old_role::text = 'board-admin'`);
console.log(`Updated permission_change_logs.old_role: ${r2.rowCount} row(s)`);

const r3 = await client.query(`UPDATE permission_change_logs SET new_role = 'assisted-board' WHERE new_role::text = 'board-admin'`);
console.log(`Updated permission_change_logs.new_role: ${r3.rowCount} row(s)`);

const after = await client.query(`
  SELECT 'admin_users.role' AS where_, count(*) FROM admin_users WHERE role::text = 'board-admin'
  UNION ALL
  SELECT 'pcl.old_role', count(*) FROM permission_change_logs WHERE old_role::text = 'board-admin'
  UNION ALL
  SELECT 'pcl.new_role', count(*) FROM permission_change_logs WHERE new_role::text = 'board-admin'
`);
console.log("\nVerification (all should be 0):");
console.table(after.rows);

await client.end();
console.log("\nDone. You can now retry publishing.");
