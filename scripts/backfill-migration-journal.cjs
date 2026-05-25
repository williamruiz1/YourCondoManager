/**
 * scripts/backfill-migration-journal.cjs — one-shot production-only.
 *
 * Marks every migration registered in `migrations/meta/_journal.json` as
 * already-applied in the `drizzle.__drizzle_migrations` tracking table.
 *
 * WHEN TO RUN: ONCE, manually, AFTER this PR merges and BEFORE the next
 * deploy's `release_command` runs the auto-migrator for the first time. If
 * you skip this, the migrator will try to re-apply migrations that were
 * already hand-applied to production, which will crash on duplicate
 * `ALTER TABLE` / `CREATE INDEX` / etc. errors.
 *
 * HOW TO RUN against production:
 *
 *   flyctl ssh console -a yourcondomanager \
 *     -C 'cd /app && node scripts/backfill-migration-journal.cjs'
 *
 * Or to dry-run first:
 *
 *   flyctl ssh console -a yourcondomanager \
 *     -C 'cd /app && DRY_RUN=1 node scripts/backfill-migration-journal.cjs'
 *
 * Behavior:
 *   - Reads `migrations/meta/_journal.json`.
 *   - For each entry, reads `migrations/<tag>.sql` and computes
 *     `sha256(file_contents).hex` — the same hash drizzle-orm uses.
 *   - Creates `drizzle` schema + `drizzle.__drizzle_migrations` table if
 *     they don't exist (matches drizzle-orm's own DDL).
 *   - INSERTs a row for each migration whose hash is not already present.
 *     (Skipping by hash means re-running this script is a safe no-op.)
 *   - Prints a summary at the end.
 *
 * Requires: only `pg` (a runtime dependency), so no tsx / build step needed.
 *
 * See founder-os Issue #2476.
 */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { Client } = require("pg");

const HERE = __dirname;
const REPO_ROOT = path.resolve(HERE, "..");
const MIGRATIONS_FOLDER = path.resolve(REPO_ROOT, "migrations");
const JOURNAL_PATH = path.resolve(MIGRATIONS_FOLDER, "meta", "_journal.json");

const DRY_RUN = process.env.DRY_RUN === "1" || process.argv.includes("--dry-run");

function ts() {
  return new Date().toISOString();
}

function log(msg) {
  console.log(`${ts()} [backfill] ${msg}`);
}

function fail(msg, err) {
  console.error(`${ts()} [backfill] ERROR: ${msg}`);
  if (err) console.error(err && err.stack ? err.stack : err);
  process.exit(1);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) fail("DATABASE_URL is not set");

  if (!fs.existsSync(JOURNAL_PATH)) fail(`journal not found at ${JOURNAL_PATH}`);

  const journal = JSON.parse(fs.readFileSync(JOURNAL_PATH, "utf8"));
  if (!journal.entries || !Array.isArray(journal.entries)) {
    fail(`journal at ${JOURNAL_PATH} has no entries array`);
  }

  log(`mode: ${DRY_RUN ? "DRY RUN — no writes" : "LIVE WRITE"}`);
  log(`journal entries: ${journal.entries.length}`);

  // Pre-compute each migration's hash and verify the .sql file exists.
  const migrations = [];
  for (const entry of journal.entries) {
    const sqlPath = path.resolve(MIGRATIONS_FOLDER, `${entry.tag}.sql`);
    if (!fs.existsSync(sqlPath)) {
      fail(`journal references ${entry.tag}.sql but file is missing at ${sqlPath}`);
    }
    const sql = fs.readFileSync(sqlPath).toString();
    const hash = crypto.createHash("sha256").update(sql).digest("hex");
    migrations.push({ tag: entry.tag, when: entry.when, hash });
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    // Match drizzle-orm/pg-core/dialect.cjs DDL exactly so the auto-migrator
    // sees a table it recognizes.
    await client.query(`CREATE SCHEMA IF NOT EXISTS "drizzle"`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `);

    // Fetch existing hashes so we can skip any that are already present —
    // makes this script safely re-runnable.
    const existingRes = await client.query(
      `SELECT hash FROM "drizzle"."__drizzle_migrations"`,
    );
    const existing = new Set(existingRes.rows.map((r) => r.hash));
    log(`existing journal rows in DB: ${existing.size}`);

    let inserted = 0;
    let skipped = 0;
    for (const m of migrations) {
      if (existing.has(m.hash)) {
        skipped++;
        log(`  SKIP (already-tracked) ${m.tag}`);
        continue;
      }
      if (DRY_RUN) {
        log(`  [dry] INSERT ${m.tag}  hash=${m.hash.slice(0, 12)}…  when=${m.when}`);
      } else {
        await client.query(
          `INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at) VALUES ($1, $2)`,
          [m.hash, m.when],
        );
        log(`  INSERT ${m.tag}  hash=${m.hash.slice(0, 12)}…  when=${m.when}`);
      }
      inserted++;
    }

    log("");
    log(`summary: ${inserted} ${DRY_RUN ? "would-insert" : "inserted"}, ${skipped} skipped`);
    log(DRY_RUN ? "DRY RUN — no rows written" : "backfill complete");
  } catch (err) {
    fail("backfill failed", err);
  } finally {
    await client.end().catch(() => {
      /* ignore */
    });
  }
}

main().catch((err) => fail("uncaught error", err));
