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

  const INTERVAL_MS = 60_000; // 60 seconds
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
