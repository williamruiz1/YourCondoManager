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

/**
 * founder-os#14790 — environment-skippable migrations.
 *
 * Some environments run a database platform on which a given migration can
 * NEVER succeed. Concretely: prod and staging are on Neon (migrated by
 * founder-os#2470 after the 2026-05-25 SEV-1) and Neon ships `pgvector`, but
 * `yourcondomanager-redesign-preview-db` is an unmanaged Fly `postgres-flex`
 * instance with no `vector` extension available — verified against BOTH the
 * 17.2 and 17.7 images, neither of which bundles it. So
 * `0034_pgvector_extension` (`CREATE EXTENSION IF NOT EXISTS vector` — the
 * IF NOT EXISTS guards re-runs, NOT an absent control file) throws
 * "extension \"vector\" is not available", `migrate()` rejects, this script
 * exits non-zero, and the ENTIRE preview deploy aborts.
 *
 * When MIGRATION_HEALTH_SKIPPABLE_TAGS names those migrations, we run drizzle
 * against a TEMP COPY of the migrations folder whose journal omits them.
 * Drizzle therefore never attempts them AND never records them as applied —
 * which matters, because server/migration-health.ts then still sees them as
 * unapplied and reports them under `skipped` on /api/health. The gap stays
 * VISIBLE; we simply stop letting it abort the deploy.
 *
 * Default-OFF: unset/empty (prod, staging, dev, CI) ⇒ the real folder is used
 * and behaviour is byte-for-byte the pre-existing OP #2476 guarantee.
 */
function skippableTags() {
  return (process.env.MIGRATION_HEALTH_SKIPPABLE_TAGS || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * Return a migrations folder for drizzle to consume. If no tags are skippable
 * this is the real folder. Otherwise it is a temp folder containing the same
 * .sql files plus a journal with the skipped entries removed.
 */
function resolveMigrationsFolder() {
  const skip = skippableTags();
  if (skip.length === 0) return MIGRATIONS_FOLDER;

  const journalPath = path.join(MIGRATIONS_FOLDER, "meta", "_journal.json");
  if (!fs.existsSync(journalPath)) return MIGRATIONS_FOLDER;

  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
  const before = journal.entries.length;
  const kept = journal.entries.filter((e) => !skip.includes(e.tag));
  const dropped = journal.entries.filter((e) => skip.includes(e.tag)).map((e) => e.tag);

  if (dropped.length === 0) {
    log(
      `MIGRATION_HEALTH_SKIPPABLE_TAGS set (${skip.join(", ")}) but none match a journal ` +
        `entry — running the full journal unchanged.`,
    );
    return MIGRATIONS_FOLDER;
  }

  const tmpRoot = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "ycm-migrations-"));
  fs.mkdirSync(path.join(tmpRoot, "meta"), { recursive: true });
  for (const entry of fs.readdirSync(MIGRATIONS_FOLDER)) {
    const src = path.join(MIGRATIONS_FOLDER, entry);
    if (fs.statSync(src).isFile()) fs.copyFileSync(src, path.join(tmpRoot, entry));
  }
  for (const entry of fs.readdirSync(path.join(MIGRATIONS_FOLDER, "meta"))) {
    fs.copyFileSync(
      path.join(MIGRATIONS_FOLDER, "meta", entry),
      path.join(tmpRoot, "meta", entry),
    );
  }
  fs.writeFileSync(
    path.join(tmpRoot, "meta", "_journal.json"),
    JSON.stringify({ ...journal, entries: kept }, null, 2),
  );

  log(
    `SKIPPING ${dropped.length} environment-inapplicable migration(s): ${dropped.join(", ")} ` +
      `(MIGRATION_HEALTH_SKIPPABLE_TAGS). Journal ${before} → ${kept.length} entries. ` +
      `They are NOT recorded as applied — /api/health will keep reporting them under ` +
      `\`skipped\` so this platform gap stays visible.`,
  );
  return tmpRoot;
}

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
  const migrationsFolder = resolveMigrationsFolder();
  log(`migrations folder: ${migrationsFolder}`);

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
    await migrate(db, { migrationsFolder });
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
