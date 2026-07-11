/**
 * founder-os#8016 — Connecticut CIOA reserve-disclosure unit tests.
 *
 * From the #1035 YCM↔CT-CIOA audit (§Area 1). Connecticut requires DISCLOSURE of
 * the reserve amount + the basis it's calculated/funded on (CGS §47-261e(a)) and
 * the reserve amount on the resale certificate (§47-270(a)(5)) — but mandates NO
 * reserve study / funding floor (that's DE §81-315). These tests pin the behavior
 * of the disclosure formatter that replaced the hardcoded `reserveBalance: 0` /
 * `reserveFund: 0` placeholders in the portfolio summary, association list, and
 * resale-cert endpoints:
 *   - cents → whole dollars
 *   - null / undefined (not yet stated) → 0 amount, null basis
 *   - float-drift-safe rounding
 *   - no funding-mandate logic (disclosure-only — assert the surface is amount+basis)
 */

import { describe, expect, it } from "vitest";
import {
  reserveDisclosureDollars,
  reserveDisclosureBasis,
} from "../ct-reserve-disclosure";

describe("CT CIOA reserve disclosure (#8016)", () => {
  it("converts a stored cents balance to whole dollars (§47-270(a)(5) amount)", () => {
    expect(reserveDisclosureDollars({ reserveBalanceCents: 4_200_000 })).toBe(42_000);
    expect(reserveDisclosureDollars({ reserveBalanceCents: 12_345 })).toBe(123.45);
  });

  it("treats an unstated reserve (null/undefined) as 0 — no placeholder, no throw", () => {
    expect(reserveDisclosureDollars({ reserveBalanceCents: null })).toBe(0);
    expect(reserveDisclosureDollars({ reserveBalanceCents: undefined })).toBe(0);
    expect(reserveDisclosureDollars({})).toBe(0);
  });

  it("is float-drift-safe (rounds to whole cents before the /100)", () => {
    // 100066 cents = $1000.66 exactly — must not surface 1000.6600000000001.
    expect(reserveDisclosureDollars({ reserveBalanceCents: 100_066 })).toBe(1000.66);
    expect(reserveDisclosureDollars({ reserveBalanceCents: 1 })).toBe(0.01);
  });

  it("surfaces the §47-261e(a) basis narrative, or null when unstated", () => {
    expect(
      reserveDisclosureBasis({
        reserveBasis: "per the 2026 reserve study, funded at 10% of annual budget",
      }),
    ).toBe("per the 2026 reserve study, funded at 10% of annual budget");
    expect(reserveDisclosureBasis({ reserveBasis: null })).toBeNull();
    expect(reserveDisclosureBasis({})).toBeNull();
  });

  it("is disclosure-only: the amount passes through unmodified regardless of size (NO CT funding-floor gate)", () => {
    // A deliberately tiny reserve relative to any plausible budget must NOT be
    // floored, capped, flagged, or rejected — CT mandates no funding level
    // (that is DE §81-315). The helper only formats; it never validates.
    expect(reserveDisclosureDollars({ reserveBalanceCents: 100 })).toBe(1);
    expect(reserveDisclosureDollars({ reserveBalanceCents: 999_999_999 })).toBe(9_999_999.99);
  });
});
