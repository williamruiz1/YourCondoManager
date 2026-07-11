import { storage } from "./storage";
import { log } from "./logger";
import { withSchedulerLock } from "./lib/scheduler-lock";

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

  const INTERVAL_MS = 60_000; // 60 seconds
  // founder-os#10741 (SCALE-B-003): cross-machine advisory lock so elections
  // close on only ONE machine. No-op on the current single-machine topology.
  electionCloseTimer = setInterval(() => {
    void withSchedulerLock("election-close", closeExpiredElections);
  }, INTERVAL_MS);

  // Run immediately on startup
  void withSchedulerLock("election-close", closeExpiredElections);

  log(`election auto-close scheduler started (interval ${INTERVAL_MS}ms)`, "automation");
}
