import { pool } from "../db";

/**
 * Cross-machine scheduler single-firing via a Postgres advisory lock
 * (founder-os#10741 — SCALE-B-003 / A-REL-005).
 *
 * Every in-process `setInterval` scheduler (automation sweep, election close,
 * de-provisioning, vendor-compliance) fires once PER MACHINE. Today that is safe
 * only because Fly runs `min_machines_running=1`; the moment a second machine is
 * added, every sweep double-fires — and the automation sweep includes autopay
 * charging + delinquency notices + assessment dispatch, so a double-fire = a
 * DUPLICATE MONEY ACTION. This wrapper makes each named scheduler acquire a
 * shared Postgres advisory lock before running; only the holder runs the tick,
 * every other machine skips it.
 *
 * FAIL-CLOSED (money-safe): if the lock can't be acquired — held by another
 * machine, OR a DB-connect error — this SKIPS the tick rather than running it
 * unlocked. Missing one tick (the next one retries) is strictly safer than a
 * duplicate autopay charge, which is real money and hard to reverse.
 *
 * ADDITIVE / no behavior change on the current single-machine topology: with no
 * contention, `pg_try_advisory_lock` always acquires immediately, so `fn` runs
 * exactly as it did before. This is why the wrapper is safe to ship to prod
 * ahead of any multi-machine scale-out (the safety net must land FIRST).
 *
 * The lock namespace is distinct from bank-feed-sync's (0x42434653 "BCFS").
 */
const SCHEDULER_LOCK_NAMESPACE = 0x53434844; // "SCHD"

export async function withSchedulerLock(
  name: string,
  fn: () => Promise<void> | void,
): Promise<void> {
  let client;
  try {
    client = await pool.connect();
  } catch (err) {
    // Fail-CLOSED: a connect blip skips this tick (the sweep couldn't do its DB
    // work without a connection anyway); the next interval retries.
    console.error(`[scheduler-lock] "${name}" could not connect — skipping this tick:`, err);
    return;
  }
  try {
    const res = await client.query<{ locked: boolean }>(
      `SELECT pg_try_advisory_lock($1, hashtext($2)) AS locked`,
      [SCHEDULER_LOCK_NAMESPACE, name],
    );
    if (!res.rows[0]?.locked) {
      // Another machine holds the lock — it runs this tick; we skip.
      return;
    }
    try {
      await fn();
    } finally {
      await client.query(`SELECT pg_advisory_unlock($1, hashtext($2))`, [
        SCHEDULER_LOCK_NAMESPACE,
        name,
      ]);
    }
  } finally {
    client.release();
  }
}
