// server/scheduler-lock.ts — cross-machine advisory lock for SIDE-EFFECT
// schedulers (founder-os#10741, audit findings SCALE-B-003 / A-REL-005).
//
// WHY: every scheduled sweep runs as an in-process `setInterval`. Dedup was
// only an in-memory flag, so on >1 Fly machine (scale-out, OR the overlap
// window of a rolling deploy) each timer fires on EVERY machine — the autopay
// sweep double-charges, delinquency/deactivation emails double-send, and
// assessment/vendor-compliance filings duplicate. `server/services/
// bank-feed-sync.ts` already guards itself with `pg_try_advisory_lock`; this
// is the same pattern, shared, for the other side-effect schedulers.
//
// SEMANTICS:
//   - Acquires a Postgres session advisory lock keyed by `name`. Only ONE
//     machine holds a given lock at a time, so only one runs that sweep per
//     interval. On the CURRENT single-machine topology the lock always
//     acquires immediately → behavior is provably unchanged (this is the
//     "no-op on one machine" the finding requires).
//   - Returns true if `fn` ran (lock acquired), false if skipped.
//   - FAIL-CLOSED for money/side-effect work: if the lock can't be taken
//     (another machine holds it, a DB blip, or a connection error), the tick
//     is SKIPPED, never run unlocked. Sweeps are periodic — a skipped tick
//     runs next interval; a double-fire moves real money. Skipping is the
//     safe direction.
//
// DO NOT use this for per-machine in-memory cleanups (e.g. the rate-limit Map
// GCs in server/rate-limit.ts and server/routes.ts): each machine must clean
// its OWN in-memory map, so those correctly run per-machine and are left
// unlocked by design.

// Advisory-lock namespace (first int4 arg of pg_try_advisory_lock). Distinct
// from bank-feed-sync.ts's 0x42434653 ("BCFS") so the two lock spaces never
// collide. 0x53434844 = "SCHD".
const SCHEDULER_LOCK_NAMESPACE = 0x53434844;

// Lazy pool access: importing this module must NOT instantiate the pg pool /
// require DATABASE_URL at import time (server tests import schedulers that now
// import this module but don't set DATABASE_URL). The pool is only needed when
// a sweep actually ticks at runtime, where DATABASE_URL is always set.
async function getPool(): Promise<import("pg").Pool> {
  const mod = await import("./db");
  return mod.pool;
}

/**
 * Run `fn` under a cross-machine advisory lock keyed by `name`. Returns true
 * if it ran, false if it was skipped (lock held elsewhere or unavailable —
 * fail-closed). Never throws to the caller.
 */
export async function withSchedulerLock(
  name: string,
  fn: () => Promise<void>,
): Promise<boolean> {
  let client: import("pg").PoolClient;
  try {
    const pool = await getPool();
    client = await pool.connect();
  } catch (err) {
    console.error(
      `[scheduler-lock] "${name}": could not get a DB connection — skipping this tick (fail-closed)`,
      err,
    );
    return false;
  }
  try {
    let acquired = false;
    try {
      const res = await client.query<{ locked: boolean }>(
        `SELECT pg_try_advisory_lock($1, hashtext($2)) AS locked`,
        [SCHEDULER_LOCK_NAMESPACE, name],
      );
      acquired = res.rows[0]?.locked === true;
    } catch (err) {
      console.error(
        `[scheduler-lock] "${name}": pg_try_advisory_lock errored — skipping this tick (fail-closed)`,
        err,
      );
      return false;
    }
    if (!acquired) {
      // Another machine holds it — the correct skip on multi-machine.
      return false;
    }
    try {
      await fn();
      return true;
    } catch (err) {
      // Never throw to the caller — a sweep that blows up must not crash the
      // interval timer. Report as not-run; the lock still releases in finally.
      console.error(`[scheduler-lock] "${name}": sweep threw — reporting not-run`, err);
      return false;
    } finally {
      await client
        .query(`SELECT pg_advisory_unlock($1, hashtext($2))`, [
          SCHEDULER_LOCK_NAMESPACE,
          name,
        ])
        .catch((e) =>
          console.error(
            `[scheduler-lock] "${name}": unlock failed (lock auto-releases when the connection closes)`,
            e,
          ),
        );
    }
  } finally {
    client.release();
  }
}
