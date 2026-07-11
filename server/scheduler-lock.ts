/**
 * Cross-machine scheduler mutual-exclusion via Postgres advisory locks
 * (SCALE-B-003 / A-REL-005, founder-os#10741).
 *
 * PROBLEM this closes: every scheduled sweep in this app runs as an in-process
 * `setInterval` timer, deduped only by an in-memory flag. That is correct today
 * ONLY because `fly.toml` pins `min_machines_running=1`. The moment a second
 * machine runs — a manual scale-out, OR the brief old+new overlap during a
 * rolling deploy — every timer fires on EVERY machine, and the money-adjacent
 * sweeps (autopay charging, delinquency notices, assessment dispatch) and
 * user-visible ones (admin deactivation emails) double-fire.
 *
 * SOLUTION: wrap each scheduler TICK in a session-scoped Postgres advisory lock
 * keyed per sweep type. On the current single-machine topology the lock always
 * acquires immediately (no other holder) — so behavior is PROVABLY UNCHANGED,
 * the sweep runs exactly as before. On >1 machine only one machine acquires the
 * lock for a given sweep per interval; the others skip that tick.
 *
 * This reuses the exact pattern already proven in
 * `server/services/bank-feed-sync.ts` (which advisory-locks per bank connection)
 * — same `pg_try_advisory_lock` / `pg_advisory_unlock` idiom, same acquire on a
 * dedicated pooled client, same unconditional release in `finally`. The only
 * difference is the namespace and that the key is a per-sweep-type name.
 *
 * SCOPE NOTE: this is the tactical safety-net. A durable job queue / leader
 * election is the correct long-term home for scheduling and is explicitly a
 * Wave 3+ candidate, NOT built here.
 */
import { pool } from "./db";
import { log } from "./logger";

// Postgres advisory-lock namespace (first arg of pg_try_advisory_lock). Distinct
// from the bank-feed-sync namespace (0x42434653 "BCFS") so scheduler locks and
// per-connection bank-feed locks never collide. 0x59434d53 = "YCMS" (YCM
// Scheduler). 32-bit signed — same class of value pg advisory locks take.
const SCHEDULER_LOCK_NAMESPACE = 0x59434d53;

/**
 * Distinct, stable names for each scheduled sweep. `hashtext(name)` becomes the
 * per-sweep key so different sweeps never block each other — only two runs of
 * the SAME sweep (on two machines) contend. Add a name here when wrapping a new
 * scheduler.
 */
export const SchedulerLock = {
  AUTOMATION_SWEEP: "ycm:automation-sweep",
  ELECTION_AUTO_CLOSE: "ycm:election-auto-close",
  DEPROVISIONING: "ycm:deprovisioning-sweep",
  VENDOR_COMPLIANCE: "ycm:vendor-compliance-sweep",
} as const;

export type SchedulerLockResult<T> =
  | { acquired: true; value: T }
  | { acquired: false };

/**
 * Run `fn` under the named Postgres advisory lock. If another machine already
 * holds the lock for this name, returns `{ acquired: false }` WITHOUT running
 * `fn` — the caller's tick becomes a no-op for this interval. The lock is held
 * for the full duration of `fn` and released unconditionally afterwards, even
 * if `fn` throws (crash-mid-sweep never leaks the lock).
 *
 * Acquire + release happen on the SAME dedicated pooled client because
 * `pg_try_advisory_lock` is session-scoped — the unlock must target the same
 * backend that acquired it.
 */
export async function withSchedulerLock<T>(
  lockName: string,
  fn: () => Promise<T>,
): Promise<SchedulerLockResult<T>> {
  const client = await pool.connect();
  try {
    const acquired = await client.query<{ locked: boolean }>(
      `SELECT pg_try_advisory_lock($1, hashtext($2)) AS locked`,
      [SCHEDULER_LOCK_NAMESPACE, lockName],
    );
    if (!acquired.rows[0]?.locked) {
      // Another machine is running this sweep this interval. Expected + benign
      // on multi-machine; never happens on single-machine.
      log(`[scheduler-lock] ${lockName}: held by another machine, skipping tick`, "automation");
      return { acquired: false };
    }
    try {
      const value = await fn();
      return { acquired: true, value };
    } finally {
      await client.query(`SELECT pg_advisory_unlock($1, hashtext($2))`, [
        SCHEDULER_LOCK_NAMESPACE,
        lockName,
      ]);
    }
  } finally {
    client.release();
  }
}
