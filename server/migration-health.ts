/**
 * server/migration-health.ts — boot-time migration health check.
 *
 * Verifies that every migration registered in `migrations/meta/_journal.json`
 * has been applied (i.e. has a corresponding row by hash in
 * `drizzle.__drizzle_migrations`). Surfaces the result via
 * `getMigrationHealth()` so `/api/health` can serve 503 if migrations were
 * silently skipped.
 *
 * Per founder-os Issue #2476 — defense-in-depth backstop in case
 * `release_command` ever fails to run (or someone bypasses it via direct
 * machine restart). The Fly release_command is the primary gate; this is
 * the boot-time alarm if that gate is somehow circumvented.
 *
 * Design choices:
 *   - Does NOT crash the server on missing migrations — that would prevent
 *     `/api/health` itself from responding and make diagnosis harder. Instead
 *     it logs LOUDLY and flips the health flag so /api/health returns 503.
 *   - Uses raw SQL against `pg.Pool` rather than drizzle-orm to avoid pulling
 *     drizzle migrator types into the app bundle.
 *   - Reads journal from a path resolved at runtime so it works both in dev
 *     (cwd = repo root) and in the Fly runner image (cwd = /app).
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type pg from "pg";
import { log } from "./logger";

export type MigrationHealthStatus = "ok" | "stale" | "unknown" | "error";

export interface MigrationHealth {
  status: MigrationHealthStatus;
  checkedAt: string;
  journalEntries: number;
  trackedHashes: number;
  missing: string[]; // tags of migrations in journal but not in drizzle.__drizzle_migrations
  errorMessage?: string;
}

const initialHealth: MigrationHealth = {
  status: "unknown",
  checkedAt: new Date(0).toISOString(),
  journalEntries: 0,
  trackedHashes: 0,
  missing: [],
};

const state = {
  current: { ...initialHealth },
};

export function getMigrationHealth(): MigrationHealth {
  return { ...state.current, missing: [...state.current.missing] };
}

/**
 * Locate `migrations/meta/_journal.json`. In dev the cwd is the repo root.
 * In the Fly runner image, the Dockerfile copies `migrations/` to `/app/
 * migrations/` and the process runs from `/app`.
 *
 * If the file is genuinely absent (e.g. running tests from an unusual cwd),
 * we return `null` — the caller will log and mark health as `unknown`. We
 * intentionally do NOT throw, because the bundled production process should
 * keep serving traffic even if the journal path resolution drifts.
 */
function locateJournalPath(): string | null {
  const candidates = [
    resolve(process.cwd(), "migrations", "meta", "_journal.json"),
    resolve(process.cwd(), "..", "migrations", "meta", "_journal.json"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

interface JournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

/**
 * Run the boot-time health check and update internal state.
 *
 * Failures (DB unreachable, journal unreadable) are logged but do NOT throw
 * — the app should still boot and serve traffic so operators can debug. The
 * `/api/health` endpoint will report `migrations: "unknown"` or `"error"`
 * so monitoring can alert.
 */
export async function runMigrationHealthCheck(pool: pg.Pool): Promise<MigrationHealth> {
  const checkedAt = new Date().toISOString();

  const journalPath = locateJournalPath();
  if (!journalPath) {
    state.current = {
      status: "unknown",
      checkedAt,
      journalEntries: 0,
      trackedHashes: 0,
      missing: [],
      errorMessage: "journal file not found on disk",
    };
    log("migration health: journal not found on disk; marking status=unknown", "startup");
    return getMigrationHealth();
  }

  let journal: { entries: JournalEntry[] };
  try {
    journal = JSON.parse(readFileSync(journalPath, "utf8"));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    state.current = {
      status: "error",
      checkedAt,
      journalEntries: 0,
      trackedHashes: 0,
      missing: [],
      errorMessage: `journal parse error: ${msg}`,
    };
    log(`migration health: failed to parse journal — ${msg}`, "startup");
    return getMigrationHealth();
  }

  if (!Array.isArray(journal.entries) || journal.entries.length === 0) {
    state.current = {
      status: "error",
      checkedAt,
      journalEntries: 0,
      trackedHashes: 0,
      missing: [],
      errorMessage: "journal contains no entries",
    };
    log("migration health: journal has no entries", "startup");
    return getMigrationHealth();
  }

  // Hash each registered migration the same way drizzle-orm does
  // (sha256 of the .sql file content). We compare hashes — NOT tags —
  // because the drizzle migration table only stores hashes.
  const crypto = await import("node:crypto");
  const fsPromises = await import("node:fs/promises");
  const journalFolder = resolve(journalPath, "..", "..");

  const expected: Array<{ tag: string; hash: string }> = [];
  for (const entry of journal.entries) {
    const sqlPath = resolve(journalFolder, `${entry.tag}.sql`);
    try {
      const sql = await fsPromises.readFile(sqlPath);
      const hash = crypto.createHash("sha256").update(sql).digest("hex");
      expected.push({ tag: entry.tag, hash });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      state.current = {
        status: "error",
        checkedAt,
        journalEntries: journal.entries.length,
        trackedHashes: 0,
        missing: [],
        errorMessage: `cannot read ${entry.tag}.sql: ${msg}`,
      };
      log(`migration health: cannot read ${entry.tag}.sql — ${msg}`, "startup");
      return getMigrationHealth();
    }
  }

  // Query drizzle's tracking table. Use raw pool so we don't import drizzle's
  // migrator types into the app bundle.
  let trackedHashes: Set<string>;
  try {
    const res = await pool.query<{ hash: string }>(
      `SELECT hash FROM "drizzle"."__drizzle_migrations"`,
    );
    trackedHashes = new Set(res.rows.map((r) => r.hash));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    state.current = {
      status: "error",
      checkedAt,
      journalEntries: journal.entries.length,
      trackedHashes: 0,
      missing: [],
      errorMessage: `cannot query drizzle.__drizzle_migrations: ${msg}`,
    };
    log(
      `migration health: drizzle.__drizzle_migrations not queryable — ${msg}. ` +
        `If this is the first boot after deploying the migration runner, run the backfill script ` +
        `(scripts/backfill-migration-journal.cjs) per the PR runbook.`,
      "startup",
    );
    return getMigrationHealth();
  }

  const missing = expected
    .filter(({ hash }) => !trackedHashes.has(hash))
    .map(({ tag }) => tag);

  const status: MigrationHealthStatus = missing.length === 0 ? "ok" : "stale";

  state.current = {
    status,
    checkedAt,
    journalEntries: expected.length,
    trackedHashes: trackedHashes.size,
    missing,
  };

  if (status === "ok") {
    log(
      `migration health: OK — ${expected.length} journal entries / ${trackedHashes.size} tracked hashes`,
      "startup",
    );
  } else {
    log(
      `migration health: STALE — ${missing.length} of ${expected.length} migrations missing ` +
        `(${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "…" : ""}). ` +
        `/api/health will return 503 until migrations are applied. Run \`npm run migrate\` ` +
        `or redeploy so the Fly release_command runs.`,
      "startup",
    );
  }

  return getMigrationHealth();
}
