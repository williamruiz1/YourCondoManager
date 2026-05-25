/**
 * scripts/migrate.cjs — Drizzle migration runner (CommonJS so it can run in
 * the slimmed production image where `tsx` / devDependencies are absent).
 *
 * Invoked on every Fly deploy via `release_command` in `fly.toml`. Runs on a
 * dedicated machine BEFORE the app machines come up; if it exits non-zero
 * the deploy aborts. This is the canonical fix for founder-os Issue #2476
 * (SIX migrations silently skipped production over several deploys because
 * `drizzle-kit push` was only ever invoked by hand).
 *
 * Behavior:
 *   1. Connects to DATABASE_URL.
 *   2. Reads `migrations/meta/_journal.json` + each registered `.sql` file.
 *   3. Calls drizzle-orm's `migrate()` — for each migration, drizzle computes
 *      sha256(file content) and checks against
 *      `drizzle.__drizzle_migrations.hash`. Applies any that are missing.
 *   4. Idempotent — running it on an up-to-date DB is a no-op.
 *   5. Exit 0 on success; non-zero on failure (aborts the deploy).
 *
 * Usage:
 *   - Local (with full deps installed): npm run migrate
 *   - Fly deploy: invoked automatically by `release_command`
 *   - Manual against prod:
 *       flyctl ssh console -a yourcondomanager -C 'cd /app && npm run migrate'
 *
 * Backfill: see scripts/backfill-migration-journal.cjs for the one-shot
 * script that marks every migration in the journal as already-applied — run
 * that ONCE against production BEFORE the first auto-deploy that uses this
 * `release_command`, so the migrator no-ops on its first run instead of
 * trying to re-apply migrations that were hand-applied earlier.
 */

const path = require("node:path");
const fs = require("node:fs");

const HERE = __dirname;
const REPO_ROOT = path.resolve(HERE, "..");
const MIGRATIONS_FOLDER = path.resolve(REPO_ROOT, "migrations");

function ts() {
  return new Date().toISOString();
}

function log(msg) {
  console.log(`${ts()} [migrate] ${msg}`);
}

function fail(msg, err) {
  console.error(`${ts()} [migrate] ERROR: ${msg}`);
  if (err) console.error(err && err.stack ? err.stack : err);
  process.exit(1);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) fail("DATABASE_URL is not set");

  if (!fs.existsSync(MIGRATIONS_FOLDER)) {
    fail(`migrations folder not found at ${MIGRATIONS_FOLDER}`);
  }
  const journalPath = path.resolve(MIGRATIONS_FOLDER, "meta", "_journal.json");
  if (!fs.existsSync(journalPath)) {
    fail(`migrations journal not found at ${journalPath}`);
  }

  // Lazy-require so the missing-DATABASE_URL / missing-folder failure modes
  // surface with a clean error before we try to load drizzle-orm.
  let migrate;
  let drizzle;
  let Pool;
  try {
    ({ migrate } = require("drizzle-orm/node-postgres/migrator"));
    ({ drizzle } = require("drizzle-orm/node-postgres"));
    ({ Pool } = require("pg"));
  } catch (err) {
    fail(
      "could not load drizzle-orm/pg — ensure production dependencies are installed",
      err,
    );
  }

  log(`connecting to database`);
  log(`migrations folder: ${MIGRATIONS_FOLDER}`);

  const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    // Keep this small — the release_command machine is short-lived.
    max: 2,
  });

  const db = drizzle(pool);
  const startedAt = Date.now();

  try {
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    const ms = Date.now() - startedAt;
    log(`migrations applied successfully (${ms}ms)`);
  } catch (err) {
    fail("migrate() failed", err);
  } finally {
    await pool.end().catch(() => {
      /* ignore — process is exiting */
    });
  }
}

main().catch((err) => fail("uncaught error in migrate()", err));
