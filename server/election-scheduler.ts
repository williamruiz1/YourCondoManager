import { storage } from "./storage";
import { log } from "./logger";

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
  electionCloseTimer = setInterval(() => {
    closeExpiredElections();
  }, INTERVAL_MS);

  // Run immediately on startup
  closeExpiredElections();

  log(`election auto-close scheduler started (interval ${INTERVAL_MS}ms)`, "automation");
}
