/**
 * A-LEDGER-005 (founder-os#10755) — money precision regression tests.
 *
 * The two money columns (owner_ledger_entries.amount, payment_webhook_events.amount)
 * moved from single-precision float4 (`real`) to double precision float8
 * (`doublePrecision`). Money is stored in DOLLARS as a float; cents are recovered with
 * `Math.round(Math.abs(amount) * 100)`. float4 (~7 significant digits / 24-bit mantissa)
 * cannot represent realistic HOA dollar amounts exactly once they approach ~$40k+, so
 * cent recovery could be off by a cent. float8 (JS `number`) represents these exactly.
 *
 * CI runs with no database (the repo's mock-based convention), so these are pure numeric
 * contract tests: `Math.fround(x)` yields the float4 representation of the double `x`,
 * letting us prove (a) the float4 hazard was real and (b) float8 recovery is exact — plus
 * the round-each-term-to-cents-before-summing discipline the aggregation sites rely on.
 */

import { describe, expect, it } from "vitest";

// Cent recovery exactly as the production call sites do it
// (report.ts / plaid-reconciliation.ts / auto-matcher.ts).
const recoverCents = (dollars: number): number => Math.round(Math.abs(dollars) * 100);

// float4 (single-precision) representation of a double — models the OLD `real` column.
const asFloat4 = (dollars: number): number => Math.fround(dollars);

describe("A-LEDGER-005 money precision (float4 -> float8)", () => {
  it("float4 storage loses a cent on large amounts (the hazard this migration fixes)", () => {
    // Empirically, cent recovery via Math.round tolerates float4's error until float32
    // spacing exceeds ~1 cent — the FIRST divergence is $131,072.01 (float32 spacing
    // becomes 0.015625 at 2^17). Large HOA entries do reach this (special assessments,
    // full-building payments, annual budget lines). Scan a range known to contain
    // divergences and prove float4 loses cents while float8 (the migration target) is exact.
    let float4Failures = 0;
    let float8Failures = 0;
    for (let cents = 13_000_000; cents <= 15_000_000; cents += 1) {
      const dollars = cents / 100; // the exact intended value (integer cents / 100)
      if (recoverCents(asFloat4(dollars)) !== cents) float4Failures++;
      if (recoverCents(dollars) !== cents) float8Failures++;
    }
    // The float4 hazard is real in this range...
    expect(float4Failures).toBeGreaterThan(0);
    // ...and float8 recovers every one of these exactly.
    expect(float8Failures).toBe(0);
  });

  it("the concrete first-divergence case: $131,072.01 recovers wrong under float4, right under float8", () => {
    const dollars = 131_072.01;
    expect(recoverCents(asFloat4(dollars))).toBe(13_107_202); // float4: off by a cent
    expect(recoverCents(dollars)).toBe(13_107_201); // float8: exact
  });

  it("float8 cent recovery is exact for specific large ledger amounts", () => {
    const cases = [45_123_45, 99_999_99, 40_000_05, 87_654_32, 12_345_678]; // integer cents
    for (const cents of cases) {
      const dollars = cents / 100;
      expect(recoverCents(dollars)).toBe(cents);
    }
  });

  it("aggregate of many entries ties to the sum of integer cents (round-before-sum)", () => {
    // Model report.ts:107 `sum + Math.round(Math.abs(r.amount) * 100)`: rounding EACH
    // term to cents before summing yields the exact integer-cents total, with no float drift.
    const entryCents = [10_000_05, 250_10, 3_333_33, 45_000_45, 7_77, 99_999_99, 1_234_56];
    const entriesInDollars = entryCents.map((c) => c / 100);
    const summedViaRoundedCents = entriesInDollars.reduce((sum, d) => sum + recoverCents(d), 0);
    const expectedTotalCents = entryCents.reduce((a, b) => a + b, 0);
    expect(summedViaRoundedCents).toBe(expectedTotalCents);
  });

  it("reconciliation variance stays 0: matched ledger cents equal matched bank cents", () => {
    // Reconciliation ties ledger entries to bank transactions by exact cents. With
    // float8 + round-before-compare, matched totals are equal -> variance is exactly 0.
    const matchedCents = [43_000_05, 1_299_99, 500_00, 88_888_88];
    const ledgerDollars = matchedCents.map((c) => c / 100);
    const bankDollars = matchedCents.map((c) => c / 100);
    const ledgerTotal = ledgerDollars.reduce((s, d) => s + recoverCents(d), 0);
    const bankTotal = bankDollars.reduce((s, d) => s + recoverCents(d), 0);
    expect(ledgerTotal - bankTotal).toBe(0);
  });
});
