/**
 * Unit-Centric Ledger feature flags (Phase 1 — P0-1 / P0-3).
 *
 * The unit-centric pivot ships DEFAULT OFF and is purely ADDITIVE. It changes
 * NO existing output while off:
 *   - `buildAccountStatement(personId)` (per-owner) keeps working unchanged.
 *   - The auto-matcher's existing amount/date/name scored pass keeps working
 *     unchanged; the new Tier-0 reference pass and the unit-roster (any-name)
 *     pass ONLY run when the flag is on for the association.
 *
 * Mirrors the proven `server/services/gl/flag.ts` rollout shape so the same
 * operational muscle memory applies:
 *
 *   1. UNIT_CENTRIC_LEDGER              — global kill-switch. `1/true/yes/on`
 *                                         → unit-centric behavior on for EVERY
 *                                         association. Use only once proven
 *                                         across the portfolio.
 *   2. UNIT_CENTRIC_LEDGER_ASSOCIATIONS — comma/space-separated allowlist of
 *                                         association IDs. The SAFE per-assoc
 *                                         rollout: turn it on for Cherry Hill
 *                                         only. This is the go-live path.
 *
 * An association is unit-centric-enabled when the global flag is on OR its id
 * is in the allowlist.
 *
 * FORWARD-ONLY / REVERSIBLE: turning this flag off instantly reverts every
 * behavior to the person-centric path — the person path is never removed, only
 * supplemented. The new column + roster reads are inert when the flag is off.
 */

/** Global unit-centric kill-switch. `1/true/yes/on` (case-insensitive) → on. */
export function isUnitCentricEnabled(): boolean {
  const raw = (process.env.UNIT_CENTRIC_LEDGER ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

/** Parse the per-association allowlist (comma/space-separated assoc IDs). */
function unitCentricAssociationSet(): Set<string> {
  const raw = (process.env.UNIT_CENTRIC_LEDGER_ASSOCIATIONS ?? "").trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

/**
 * Is unit-centric behavior enabled for THIS association? True when the global
 * flag is on OR the association is in the explicit allowlist.
 *
 * When false, every caller MUST fall back to the existing person-centric
 * behavior — that is the backward-compatibility contract.
 */
export function isUnitCentricEnabledForAssociation(associationId: string): boolean {
  if (isUnitCentricEnabled()) return true;
  return unitCentricAssociationSet().has(associationId);
}
