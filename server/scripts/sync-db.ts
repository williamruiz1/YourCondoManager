/**
 * sync-db.ts — Copy dev database to production, bypassing Replit's broken pg_restore.
 *
 * Usage:
 *   PRODUCTION_DATABASE_URL="postgres://..." npx tsx server/scripts/sync-db.ts
 *   PRODUCTION_DATABASE_URL="postgres://..." npx tsx server/scripts/sync-db.ts --dry-run
 *   PRODUCTION_DATABASE_URL="postgres://..." npx tsx server/scripts/sync-db.ts --tables units,buildings
 *   PRODUCTION_DATABASE_URL="postgres://..." npx tsx server/scripts/sync-db.ts --skip-tables audit_logs,email_logs
 *
 * Flags:
 *   --dry-run          Show what would be synced without writing anything
 *   --tables t1,t2     Sync only these tables (comma-separated)
 *   --skip-tables t1   Skip these tables in addition to defaults
 *   --force            Skip confirmation prompt
 *   --preserve-auth    Keep production auth_users / auth_external_accounts (don't overwrite)
 */

import pg from "pg";
import * as readline from "readline";

// ─── Config ──────────────────────────────────────────────────────────────────

// DEV_DATABASE_URL explicitly identifies the source (dev) DB.
// Falls back to DATABASE_URL only when PRODUCTION_DATABASE_URL is also set
// (i.e. someone is running the script manually with DATABASE_URL pointing to dev).
const DEV_URL = process.env.DEV_DATABASE_URL || process.env.DATABASE_URL;
const PROD_URL = process.env.PRODUCTION_DATABASE_URL;

/** Never synced — active sessions should not be wiped. */
const ALWAYS_SKIP = new Set(["user_sessions"]);

/** Batch size for INSERT ... VALUES (...), (...) */
const BATCH_SIZE = 200;

// ─── Arg parsing ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const FORCE = args.includes("--force");
const PRESERVE_AUTH = args.includes("--preserve-auth");

const tablesArg = args.find((a) => a.startsWith("--tables="))?.split("=")[1]
  ?? (args[args.indexOf("--tables") + 1] && !args[args.indexOf("--tables") + 1].startsWith("--")
    ? args[args.indexOf("--tables") + 1]
    : undefined);

const skipArg = args.find((a) => a.startsWith("--skip-tables="))?.split("=")[1]
  ?? (args[args.indexOf("--skip-tables") + 1] && !args[args.indexOf("--skip-tables") + 1].startsWith("--")
    ? args[args.indexOf("--skip-tables") + 1]
    : undefined);

const EXPLICIT_TABLES = tablesArg ? new Set(tablesArg.split(",").map((t) => t.trim())) : null;
const EXTRA_SKIP = skipArg ? new Set(skipArg.split(",").map((t) => t.trim())) : new Set<string>();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ts() {
  return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true });
}

function log(msg: string) {
  console.log(`${ts()} ${msg}`);
}

function err(msg: string) {
  console.error(`${ts()} ERROR  ${msg}`);
}

async function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${question} [y/N] `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y");
    });
  });
}

// ─── Table dependency resolution ─────────────────────────────────────────────

async function getTablesInInsertOrder(client: pg.Client, tables: string[]): Promise<string[]> {
  const res = await client.query<{ child: string; parent: string }>(`
    SELECT DISTINCT
      tc.table_name   AS child,
      ccu.table_name  AS parent
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
  `);

  const tableSet = new Set(tables);
  const deps = new Map<string, Set<string>>(tables.map((t) => [t, new Set()]));

  for (const { child, parent } of res.rows) {
    if (tableSet.has(child) && tableSet.has(parent) && child !== parent) {
      deps.get(child)!.add(parent);
    }
  }

  // Kahn's algorithm
  const inDegree = new Map<string, number>(tables.map((t) => [t, deps.get(t)!.size]));
  const queue = tables.filter((t) => inDegree.get(t) === 0);
  const sorted: string[] = [];

  while (queue.length > 0) {
    const t = queue.shift()!;
    sorted.push(t);
    for (const [child, parents] of Array.from(deps.entries())) {
      if (parents.has(t)) {
        const deg = inDegree.get(child)! - 1;
        inDegree.set(child, deg);
        if (deg === 0) queue.push(child);
      }
    }
  }

  // Append any leftovers (circular deps — handled by FK disable)
  const remaining = tables.filter((t) => !sorted.includes(t));
  if (remaining.length > 0) {
    log(`  note: circular FK deps for: ${remaining.join(", ")} — FK enforcement is disabled during sync`);
  }
  return [...sorted, ...remaining];
}

// ─── Row counts ──────────────────────────────────────────────────────────────

async function rowCount(client: pg.Client, table: string): Promise<number> {
  const res = await client.query<{ count: string }>(`SELECT COUNT(*) AS count FROM public."${table}"`);
  return parseInt(res.rows[0].count, 10);
}

// ─── Sync one table ───────────────────────────────────────────────────────────

async function syncTable(
  devClient: pg.Client,
  prodClient: pg.Client,
  table: string,
  opts: { dryRun: boolean; preserveAuth: boolean },
): Promise<{ devRows: number; deleted: number; inserted: number; skipped: boolean }> {
  const isAuthTable = table === "auth_users" || table === "auth_external_accounts";

  if (opts.preserveAuth && isAuthTable) {
    const count = await rowCount(devClient, table);
    return { devRows: count, deleted: 0, inserted: 0, skipped: true };
  }

  const devResult = await devClient.query(`SELECT * FROM public."${table}"`);
  const devRows = devResult.rows;

  if (opts.dryRun) {
    const prodCount = await rowCount(prodClient, table);
    return { devRows: devRows.length, deleted: prodCount, inserted: devRows.length, skipped: false };
  }

  // Deletes are handled in bulk before this function is called (reverse FK order)
  const deleted = 0;

  if (devRows.length === 0) {
    return { devRows: 0, deleted, inserted: 0, skipped: false };
  }

  // Insert from dev in batches
  const columns = Object.keys(devRows[0]);
  const colList = columns.map((c) => `"${c}"`).join(", ");
  let inserted = 0;

  // Determine which columns are JSON/JSONB by OID (114 = json, 3802 = jsonb).
  // These must be serialized to a string even when pg returns them as JS arrays.
  const JSON_OIDS = new Set([114, 3802]);
  const jsonColIdxs = new Set<number>(
    devResult.fields
      .map((f, i) => (JSON_OIDS.has(f.dataTypeID) ? i : -1))
      .filter((i) => i !== -1),
  );

  for (let i = 0; i < devRows.length; i += BATCH_SIZE) {
    const batch = devRows.slice(i, i + BATCH_SIZE);
    const values: unknown[] = [];
    const placeholders = batch.map((row, rowIdx) => {
      const rowPlaceholders = columns.map((col, colIdx) => {
        let val = row[col] ?? null;
        if (val !== null && !(val instanceof Date)) {
          if (jsonColIdxs.has(colIdx)) {
            // JSON/JSONB column — always serialize to string (even if value is an array)
            if (typeof val !== "string") val = JSON.stringify(val);
          } else if (typeof val === "object" && !Array.isArray(val)) {
            // Non-json object column (shouldn't normally occur, but guard it)
            val = JSON.stringify(val);
          }
          // Arrays and scalars pass through unchanged
        }
        values.push(val);
        return `$${rowIdx * columns.length + colIdx + 1}`;
      });
      return `(${rowPlaceholders.join(", ")})`;
    });
    try {
      await prodClient.query(
        `INSERT INTO public."${table}" (${colList}) VALUES ${placeholders.join(", ")}`,
        values,
      );
    } catch (insertErr: unknown) {
      // Dump the problematic row/values for diagnosis
      err(`Insert failed on table "${table}" at batch offset ${i}`);
      err(`Columns: ${columns.join(", ")}`);
      for (let vi = 0; vi < values.length; vi++) {
        const col = columns[vi % columns.length];
        const v = values[vi];
        if (v !== null && typeof v === "string" && (v.startsWith("{") || v.startsWith("["))) {
          err(`  $${vi + 1} [${col}] = ${v.slice(0, 120)}`);
        } else if (v !== null && typeof v === "object") {
          err(`  $${vi + 1} [${col}] TYPE=${typeof v} constructor=${(v as object).constructor?.name} val=${JSON.stringify(v).slice(0, 120)}`);
        }
      }
      throw insertErr;
    }
    inserted += batch.length;
  }

  return { devRows: devRows.length, deleted, inserted, skipped: false };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!DEV_URL) {
    err("DATABASE_URL is not set (dev database URL required)");
    process.exit(1);
  }
  if (!PROD_URL) {
    log("PRODUCTION_DATABASE_URL not set — skipping sync");
    log("  To enable auto-sync on deploy, add PRODUCTION_DATABASE_URL as a Replit secret.");
    return;
  }
  if (DEV_URL === PROD_URL) {
    log("PRODUCTION_DATABASE_URL matches DATABASE_URL — skipping sync (same database)");
    return;
  }

  const devClient = new pg.Client({ connectionString: DEV_URL });
  const prodClient = new pg.Client({ connectionString: PROD_URL });

  await devClient.connect();
  await prodClient.connect();

  // Validate connections
  const [devDb, prodDb] = await Promise.all([
    devClient.query<{ current_database: string }>("SELECT current_database()"),
    prodClient.query<{ current_database: string }>("SELECT current_database()"),
  ]);
  const devDbName = `${process.env.PGHOST ?? "dev"}/${devDb.rows[0].current_database}`;
  const prodHost = PROD_URL.match(/@([^/]+)\//)?.[1] ?? "production";
  const prodDbName = `${prodHost}/${prodDb.rows[0].current_database}`;

  log(`Source (dev):        ${devDbName}`);
  log(`Destination (prod):  ${prodDbName}`);
  if (DRY_RUN) log("Mode:                DRY RUN — no changes will be written");
  if (PRESERVE_AUTH) log("Auth tables:         PRESERVED (--preserve-auth)");

  // Get table list
  const allTablesRes = await devClient.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
  );
  let tables = allTablesRes.rows
    .map((r) => r.tablename)
    .filter((t) => !ALWAYS_SKIP.has(t) && !EXTRA_SKIP.has(t));

  if (EXPLICIT_TABLES) {
    const unknown = Array.from(EXPLICIT_TABLES).filter((t) => !tables.includes(t));
    if (unknown.length > 0) {
      err(`Unknown tables specified: ${unknown.join(", ")}`);
      process.exit(1);
    }
    tables = tables.filter((t) => EXPLICIT_TABLES.has(t));
    log(`Tables:              ${tables.join(", ")}`);
  } else {
    log(`Tables:              ${tables.length} (all except ${Array.from(ALWAYS_SKIP).concat(Array.from(EXTRA_SKIP)).join(", ")})`);
  }

  // Row counts preview
  log("");
  log("Dev DB counts:");
  const devCounts = await devClient.query<{ table_name: string; row_count: string }>(`
    SELECT table_name,
           (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name AND table_schema = 'public')::text AS row_count
    FROM information_schema.tables t
    WHERE table_schema = 'public'
    ORDER BY table_name
  `);
  const nonEmptyTables: string[] = [];
  for (const table of tables) {
    const count = await rowCount(devClient, table);
    if (count > 0) {
      nonEmptyTables.push(table);
      log(`  ${table.padEnd(45)} ${count.toString().padStart(6)} rows`);
    }
  }

  log("");

  // Confirm
  if (!DRY_RUN && !FORCE) {
    console.log("⚠️  This will REPLACE ALL DATA in the production database (except user_sessions).");
    console.log(`   Source:      ${devDbName}`);
    console.log(`   Destination: ${prodDbName}`);
    console.log("");
    const ok = await confirm("Proceed with sync?");
    if (!ok) {
      log("Aborted.");
      await devClient.end();
      await prodClient.end();
      return;
    }
  }

  // Sort tables into dependency order
  const orderedTables = await getTablesInInsertOrder(devClient, tables);

  // Execute sync
  const startTime = Date.now();
  const results: Array<{ table: string; devRows: number; deleted: number; inserted: number; skipped: boolean }> = [];

  if (!DRY_RUN) {
    await prodClient.query("BEGIN");
  }

  try {
    // Delete in REVERSE dependency order (children before parents) to satisfy FK constraints
    if (!DRY_RUN) {
      const reversedTables = [...orderedTables].reverse();
      for (const table of reversedTables) {
        await prodClient.query(`DELETE FROM public."${table}"`);
      }
    }

    // Insert in FORWARD dependency order (parents before children)
    for (const table of orderedTables) {
      const result = await syncTable(devClient, prodClient, table, {
        dryRun: DRY_RUN,
        preserveAuth: PRESERVE_AUTH,
      });
      results.push({ table, ...result });

      const label = result.skipped
        ? "SKIP (preserved)"
        : result.devRows === 0
          ? "empty"
          : `${result.inserted} rows`;
      log(`  ${DRY_RUN ? "[dry] " : ""}${table.padEnd(45)} ${label}`);
    }

    if (!DRY_RUN) {
      await prodClient.query("COMMIT");
    }
  } catch (e: unknown) {
    if (!DRY_RUN) {
      await prodClient.query("ROLLBACK");
    }
    err(`Sync failed: ${(e as Error).message}`);
    await devClient.end();
    await prodClient.end();
    process.exit(1);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const totalRows = results.reduce((s, r) => s + r.inserted, 0);
  const syncedTables = results.filter((r) => !r.skipped && r.devRows > 0).length;

  log("");
  log(`${DRY_RUN ? "Dry run" : "Sync"} complete in ${elapsed}s`);
  log(`  Tables synced:  ${syncedTables}`);
  log(`  Rows written:   ${totalRows}`);

  if (DRY_RUN) {
    log("");
    log("Run without --dry-run to apply changes.");
  }

  await devClient.end();
  await prodClient.end();
}

main().catch((e) => {
  err(String(e));
  process.exit(1);
});
