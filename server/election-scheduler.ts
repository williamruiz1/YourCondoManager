import { storage } from "./storage";
import { log } from "./logger";
import { withSchedulerLock } from "./scheduler-lock";

/**
 * Auto-close elections whose closesAt timestamp has passed.
 * Meant to be called on an interval (e.g. every 60 seconds).
 */
export async function closeExpiredElections(): Promise<void> {
  try {
    const closed = await storage.closeExpiredElections();
    if (closed > 0) {
      log(`election auto-close: ${closed} election(s) closed`, "automation");
    }
  } catch (error: any) {
    console.error("Election auto-close sweep failed:", error);
  }
}

let electionCloseTimer: NodeJS.Timeout | null = null;

export function startElectionScheduler(): void {
  if (electionCloseTimer) return;

  // Neon usage RCA (2026-07-14): this was 60 seconds. withSchedulerLock()
  // opens a real Postgres connection + advisory lock EVERY tick, even when
  // there's nothing to close, so a 60s cadence kept Neon's compute
  // connection alive around the clock — it never saw the ~5 continuous
  // idle minutes Neon requires before autosuspending, and billed
  // full-time compute-hours regardless of real traffic. Closing an
  // already-expired election a few minutes late is inconsequential, so
  // bumping to 10 minutes trades unneeded precision for a real idle
  // window each cycle.
  const INTERVAL_MS = 10 * 60_000;
  // SCALE-B-003 / A-REL-005 (founder-os#10741): closing elections mutates
  // owner-facing state — wrap each tick in the cross-machine advisory lock so
  // only one machine closes a given election per interval. No-op single-machine.
  electionCloseTimer = setInterval(() => {
    void withSchedulerLock("election-close", () => closeExpiredElections()).catch((e) =>
      console.error("Election auto-close sweep failed:", e),
    );
  }, INTERVAL_MS);

  // Run immediately on startup
  void withSchedulerLock("election-close", () => closeExpiredElections()).catch((e) =>
    console.error("Election auto-close sweep failed:", e),
  );

  log(`election auto-close scheduler started (interval ${INTERVAL_MS}ms)`, "automation");
}
