/**
 * GL feature flags (YCM Financial Core — Phase 1 / dues-to-GL wiring).
 *
 * The fund-aware GL ships DEFAULT OFF. It runs PARALLEL to the live dues ledger
 * and is NOT source-of-truth (per BLINDSPOT F4). Nothing in the live money path
 * is gated on this; the flags only govern whether the additive GL-posting sync
 * runs at all, and whether the DERIVED statements surface.
 *
 * TWO LAYERS OF ENABLEMENT (both default OFF; either can turn the GL on):
 *
 *   1. GL_ENABLED              — global kill-switch. `1/true/yes/on` → GL on for
 *                                EVERY association. Use only once the GL has been
 *                                proven across the whole portfolio.
 *   2. GL_ENABLED_ASSOCIATIONS — comma/space-separated allowlist of association
 *                                IDs. The SAFE per-association rollout: turn the
 *                                GL on for Cherry Hill only, without flipping it
 *                                on for everyone. This is the go-live path.
 *
 * An association is GL-enabled when the global flag is on OR its id is in the
 * allowlist. The runtime sync (runtime-sync.ts) adds a HARD reconcile-to-cent
 * gate ON TOP of this — even an allowlisted association does not get GL postings
 * unless its owner ledger reconciles to the cent.
 *
 * FORWARD-ONLY / PARALLEL: the owner ledger STAYS the system of record. These
 * flags never gate the live money path; they only govern the additive GL.
 */

/** Global GL kill-switch. `1/true/yes/on` (case-insensitive) → on; else off. */
export function isGlEnabled(): boolean {
  const raw = (process.env.GL_ENABLED ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

/** Parse the per-association allowlist (comma/space-separated assoc IDs). */
function glEnabledAssociationSet(): Set<string> {
  const raw = (process.env.GL_ENABLED_ASSOCIATIONS ?? "").trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

/**
 * Is the GL enabled for THIS association? True when the global flag is on OR
 * the association is in the explicit allowlist. This is the SURFACE gate (does
 * the GL run / do statements show); the reconcile-to-cent gate in runtime-sync
 * is the additional authoritativeness gate.
 */
export function isGlEnabledForAssociation(associationId: string): boolean {
  if (isGlEnabled()) return true;
  return glEnabledAssociationSet().has(associationId);
}
