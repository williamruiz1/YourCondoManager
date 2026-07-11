/**
 * Connecticut CIOA reserve DISCLOSURE helper (#8016, from the #1035 YCM↔CT-CIOA
 * compliance audit, §Area 1).
 *
 * Connecticut's Common Interest Ownership Act requires DISCLOSURE only:
 *   - the annual budget summary must STATE the reserve amount + the basis on which
 *     reserves are calculated and funded (CGS §47-261e(a)); and
 *   - the resale certificate must state the reserve amount (CGS §47-270(a)(5)).
 *
 * Connecticut does NOT mandate a reserve study or a minimum reserve-funding level
 * — that requirement is Delaware's (DUCIOA §81-315), and is out of scope until DE
 * condos surface. Accordingly there is DELIBERATELY NO funding-mandate validator
 * here: this module only formats the board-declared disclosure figure for display.
 *
 * The amount is persisted on associations.reserveBalanceCents (in cents, matching
 * the financial_accounts.current_balance_cents convention) — a board-DECLARED
 * disclosure figure, NOT a live bank balance — and the §47-261e(a) basis narrative
 * on associations.reserveBasis.
 */

/** The shape this helper reads — the persisted CT reserve disclosure fields. */
export interface ReserveDisclosureSource {
  reserveBalanceCents?: number | null;
  reserveBasis?: string | null;
}

/**
 * The board-declared reserve amount in whole dollars, for the §47-261e(a) budget
 * summary and the §47-270(a)(5) resale certificate. Null/undefined (not yet
 * stated) → 0. Rounded to whole cents first to avoid floating-point drift.
 */
export function reserveDisclosureDollars(assoc: ReserveDisclosureSource): number {
  return Math.round(assoc.reserveBalanceCents ?? 0) / 100;
}

/**
 * The §47-261e(a) "basis on which reserves are calculated and funded" narrative,
 * or null when not yet stated.
 */
export function reserveDisclosureBasis(assoc: ReserveDisclosureSource): string | null {
  return assoc.reserveBasis ?? null;
}
