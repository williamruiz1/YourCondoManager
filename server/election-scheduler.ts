import { storage } from "./storage";
import { log } from "./logger";
import { withSchedulerLock, SchedulerLock } from "./scheduler-lock";

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
  // SCALE-B-003 / A-REL-005 (founder-os#10741): auto-close mutates election
  // state; guard the scheduled tick behind a cross-machine advisory lock so a
  // second machine can never double-close. The pure `closeExpiredElections`
  // stays lockless for direct/test callers. No-op on single-machine.
  const lockedTick = () => void withSchedulerLock(SchedulerLock.ELECTION_AUTO_CLOSE, closeExpiredElections);
  electionCloseTimer = setInterval(lockedTick, INTERVAL_MS);

  // Run immediately on startup
  lockedTick();

  log(`election auto-close scheduler started (interval ${INTERVAL_MS}ms)`, "automation");
}
