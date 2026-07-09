/**
 * Amenity GL runtime sync — the LIVE trigger that posts the amenity money loop
 * into the parallel GL (YCM Financial Core — Phase 3, amenity money loop).
 *
 * Dispatch:      founder-os#10181 (Slice 5 — wire the orphaned GL sync trigger).
 * Audit anchor:  audits/AUDIT-financial-reporting-orchestration.md Gap F1 (Phase 3).
 * Mirrors:       server/services/gl/runtime-sync.ts (the dues equivalent).
 *
 * This is the orchestrator the LIVE amenity money paths call AFTER an amenity
 * reservation's money columns (feeCharged / depositHeld / depositRefunded /
 * depositForfeited) are mutated. It exists so the live path has ONE small,
 * well-tested, fail-safe entry point and never embeds GL logic inline — exactly
 * as `maybeSyncAssociationGl` does for dues.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE FOUR HARD GUARANTEES (mirroring runtime-sync.ts):
 *
 *  1. NON-FATAL. A GL-sync failure NEVER propagates into the live money path.
 *     The amenity_reservations row is the system of record; the GL is a derived
 *     parallel. Every call is best-effort and swallows its own errors (logged,
 *     not thrown) — so a broken GL can never break a booking or a refund.
 *
 *  2. PER-ASSOCIATION GATED. Skips unless the GL is enabled for THIS association
 *     (global GL_ENABLED OR the GL_ENABLED_ASSOCIATIONS allowlist) — via
 *     `isGlEnabledForAssociation`, never the global-only `isGlEnabled`. This is
 *     the fix for the Slice-5 latent bug: the CHC-only allowlist rollout must
 *     activate amenity posting for CHC without flipping it on for everyone.
 *
 *  3. INVARIANT GATED. Even for an enabled association, `syncAssociationAmenityGl`
 *     validates the double-entry + interfund invariants (Σdebit == Σcredit,
 *     deposit liability nets to zero after refund) BEFORE any write and refuses
 *     to post an unbalanced corpus. (The amenity analog of dues' reconcile-to-
 *     cent gate — it lives inside the DB writer, not here, because the amenity
 *     source of truth is the reservation row itself, not a separate ledger.)
 *
 *  4. IDEMPOTENT / FORWARD-ONLY. The underlying syncAssociationAmenityGl
 *     re-derives the WHOLE association's amenity money loop and inserts legs
 *     with onConflictDoNothing against the (sourceType, sourceId, glAccount,
 *     side) unique index — so firing it after every money mutation is a safe
 *     no-op for already-posted facts and never mutates or deletes an existing
 *     row.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { isGlEnabledForAssociation } from "./flag";
import {
  syncAssociationAmenityGl,
  type AmenityGlPostingResult,
} from "./amenity-posting-service";

export type AmenityGlSyncOutcome =
  | { posted: false; reason: "not-enabled" | "error"; detail?: string }
  | { posted: true; result: AmenityGlPostingResult };

/**
 * Run the per-association amenity GL sync IFF it is enabled for the association.
 * Throws only the way the DB writer itself can throw; intended to be wrapped by
 * `maybeSyncAssociationAmenityGl` on the live path. Exposed (and used by tests)
 * so the gate logic is unit-testable without the catch wrapper.
 */
export async function syncAssociationAmenityGlGated(
  associationId: string,
): Promise<AmenityGlSyncOutcome> {
  if (!isGlEnabledForAssociation(associationId)) {
    return { posted: false, reason: "not-enabled" };
  }
  // Gate passed → post. `force: true` because the per-association gate above
  // already decided enablement; the writer still validates invariants before
  // writing (guarantee 3).
  const result = await syncAssociationAmenityGl(associationId, { force: true });
  return { posted: true, result };
}

/**
 * BEST-EFFORT live trigger. Call this AFTER an amenity reservation's money
 * columns are committed (fee charged / deposit held / refunded / forfeited).
 * It can NEVER break the caller: all errors are caught + logged. Returns the
 * outcome for observability/tests; callers on the money path should ignore the
 * return (fire-and-forget is safe, but awaiting keeps ordering deterministic
 * and lets the GL settle before the response is sent).
 */
export async function maybeSyncAssociationAmenityGl(
  associationId: string,
  context?: string,
): Promise<AmenityGlSyncOutcome> {
  try {
    const outcome = await syncAssociationAmenityGlGated(associationId);
    if (outcome.posted && outcome.result.legsInserted > 0) {
      console.log(
        `[gl-amenity] synced association=${associationId}${context ? ` (${context})` : ""}: ` +
          `+${outcome.result.legsInserted} legs (${outcome.result.journalsConsidered} journals)`,
      );
    }
    return outcome;
  } catch (err: any) {
    // NON-FATAL: the reservation row already recorded the money. Log and move on.
    console.error(
      `[gl-amenity] non-fatal GL sync error for association=${associationId}` +
        `${context ? ` (${context})` : ""}: ${err?.message ?? err}`,
    );
    return { posted: false, reason: "error", detail: err?.message ?? String(err) };
  }
}
