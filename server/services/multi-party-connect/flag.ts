/**
 * Multi-party Connect collection feature flag (Flows 2 + 3).
 *
 * Flows 2 (PM management fee) and 3 (PM collects owner dues on behalf of a
 * managed HOA) ship DEFAULT OFF, mirroring GL_ENABLED. Nothing in the live
 * money path (Flow 1 — self-managed HOA direct charges) is gated on this; the
 * flag only governs whether the additive multi-party routing resolves at all.
 *
 * When OFF:
 *   - resolveMultiPartyRouting() returns null for every input, so existing
 *     callers fall through to the unchanged Flow 1 / manual-key path.
 *   - Flow 1 behavior is byte-identical.
 *
 * Enable explicitly with MULTI_PARTY_CONNECT_ENABLED=1 (or true/yes/on).
 * Anything else → OFF.
 *
 * SAFETY: turning this flag on does NOT itself move money on the new flows.
 * It only allows the routing computation + storage to resolve. Wiring a live
 * charge path to Flow 2/3 is a separate, explicit step gated additionally on
 * the trust-account compliance decision (see
 * artifacts/multi-party-collection-design.html — Flow 3 fund-routing decision).
 */
export function isMultiPartyConnectEnabled(): boolean {
  const raw = (process.env.MULTI_PARTY_CONNECT_ENABLED ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}
