/**
 * GL feature flag (YCM Financial Core — Phase 1).
 *
 * The fund-aware GL ships DEFAULT OFF. It runs PARALLEL to the live dues ledger
 * and is NOT source-of-truth (per BLINDSPOT F4). Nothing in the live money path
 * is gated on this; the flag only governs whether the additive GL-posting sync
 * runs at all.
 *
 * Enable explicitly with GL_ENABLED=1 (or true/yes/on). Anything else → OFF.
 */
export function isGlEnabled(): boolean {
  const raw = (process.env.GL_ENABLED ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}
