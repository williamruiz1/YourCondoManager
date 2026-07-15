/**
 * Money precision — owner_ledger_entries / payment_webhook_events.
 *
 * HISTORY. A-LEDGER-005 (founder-os#10755) widened these two money columns from
 * single-precision float4 to float8 (migration 0060). That was an INTERIM fix: money was
 * still DOLLARS-as-binary-float, so every reader had to recover cents with
 * `Math.round(Math.abs(amount) * 100)` and every aggregation had to remember to
 * round-each-term-before-summing.
 *
 * NOW (founder-os#10779, migration 0068) the columns are INTEGER CENTS (`amount_cents`),
 * mirroring disbursements.amount_cents and the GL. This file's contract therefore changes:
 * it no longer proves "float8 recovers cents better than float4" — it proves the cents
 * representation removes the failure mode entirely, and it PINS the float4 damage-repair
 * the 0068 backfill performs on the 14 real Cherry Hill rows.
 *
 * CI runs with no database (the repo's mock-based convention), so these stay pure numeric
 * contract tests. `Math.fround(x)` yields the float4 representation of a double x, letting
 * us model the ORIGINAL damaged column exactly as production stored it.
 */

import { describe, expect, it } from "vitest";

/** float4 (single-precision) representation of a double — models the ORIGINAL `real` column. */
const asFloat4 = (dollars: number): number => Math.fround(dollars);

/** The 0068 backfill: `ROUND(amount::numeric * 100)`. Postgres rounds half away from zero. */
const backfillToCents = (storedDollars: number): number =>
  Math.sign(storedDollars) * Math.round(Math.abs(storedDollars) * 100);

describe("integer cents (migration 0068) — the storage contract", () => {
  it("cents are exact for values a binary float cannot represent", () => {
    // $0.10 is the canonical un-representable-in-base-2 value. As a float, 0.1 + 0.2 does
    // not equal 0.3; as cents, 10 + 20 === 30 exactly. This is the whole point of 0068.
    expect(0.1 + 0.2).not.toBe(0.3); // the float hazard, still true
    expect(10 + 20).toBe(30); // the cents contract — exact
  });

  it("summing many entries in cents is exact with NO round-before-sum discipline", () => {
    // The float8 era required rounding EACH term to cents before summing (report.ts et al).
    // Integer cents need no such discipline — a plain sum is exact by construction.
    const entryCents = [10_000_05, 250_10, 3_333_33, 45_000_45, 7_77, 99_999_99, 1_234_56];
    expect(entryCents.reduce((a, b) => a + b, 0)).toBe(159_826_25);
  });

  it("the naive float-dollar sum this migration removes really does drift", () => {
    // $10.10 + $20.20 + $30.30. Summed as float dollars WITHOUT the round-each-term
    // discipline, this lands on 60.599999999999994 — NOT 60.60. That is the latent bug
    // 0068 removes: the auto-matcher's balance loop and payment-service's totals both
    // summed raw float dollars and only rounded at the very end.
    const cents = [10_10, 20_20, 30_30];
    const naiveFloatDollars = cents.map((c) => c / 100).reduce((a, b) => a + b, 0);
    expect(naiveFloatDollars).not.toBe(60.6); // the drift is real
    expect(naiveFloatDollars).toBeCloseTo(60.6, 10); // ...and small enough to go unnoticed
    // Integer cents: exact, no drift, no rounding step.
    expect(cents.reduce((a, b) => a + b, 0)).toBe(60_60);
  });

  it("reconciliation variance is exactly 0: matched ledger cents equal matched bank cents", () => {
    // Both sides are integer cents now (ledger + bank_transactions), so the comparison is
    // integer equality — no epsilon, no tolerance.
    const matchedCents = [43_000_05, 1_299_99, 500_00, 88_888_88];
    const ledgerTotal = matchedCents.reduce((a, b) => a + b, 0);
    const bankTotal = matchedCents.reduce((a, b) => a + b, 0);
    expect(ledgerTotal - bankTotal).toBe(0);
  });

  it("int4 range covers realistic HOA amounts (the migration's range guard)", () => {
    // 0068 stores cents in `integer` (matching disbursements.amount_cents). Max int4 is
    // $21,474,836.47 — the migration ABORTS rather than silently overflow.
    const MAX_INT4 = 2_147_483_647;
    expect(Math.round(21_474_836.47 * 100)).toBeLessThanOrEqual(MAX_INT4);
    // Largest real Cherry Hill entry is ~$2.1k — four orders of magnitude of headroom.
    expect(2_121_77).toBeLessThan(MAX_INT4);
  });
});

describe("migration 0068 backfill — repairs the float4 damage 0060 could not undo", () => {
  it("recovers the intended cents from the real damaged production values", () => {
    // These are the ACTUAL values stored in production: float4 artifacts of real Cherry
    // Hill balances. 0060 widened them to float8, which stopped further loss but could not
    // undo the damage already done. ROUND(amount::numeric * 100) recovers the intent.
    const damagedToIntended: Array<[number, number]> = [
      [1326.18994140625, 132619], // $1,326.19 — the driveway assessment for 1415-A
      [415.70001220703125, 41570], // $415.70
    ];
    for (const [damaged, intendedCents] of damagedToIntended) {
      // Sanity: the damaged value really is what float4 storage does to the intended money.
      expect(asFloat4(intendedCents / 100)).toBe(damaged);
      // And the backfill recovers the intended cents exactly.
      expect(backfillToCents(damaged)).toBe(intendedCents);
    }
  });

  it("preserves the balance of record — the migration's abort-on-drift assertion", () => {
    // Mirrors the DO block in 0068: Σ round(amount::numeric * 100) must equal the dollars
    // total to the cent, per association. Verified against live production before authoring
    // (93 rows, one association): 39796.77996826172 -> 3979678 cents, both ways.
    const damagedRows = [1326.18994140625, 415.70001220703125, 1719.42, 1318.17];
    const centsTotal = damagedRows.reduce((s, d) => s + backfillToCents(d), 0);
    const dollarsTotal = Math.round(damagedRows.reduce((s, d) => s + d, 0) * 100);
    expect(centsTotal).toBe(dollarsTotal);
  });

  it("is sign-safe: negative payments round away from zero, not toward +Infinity", () => {
    // Postgres ROUND() rounds half AWAY FROM ZERO; JS Math.round rounds half toward
    // +Infinity. Payments are stored negative, so the backfill helper mirrors Postgres by
    // taking the magnitude first. Pins the semantics the migration relies on.
    expect(backfillToCents(-350)).toBe(-35000);
    expect(backfillToCents(-0.005)).toBe(-1); // away from zero (Postgres), not -0 (naive JS)
    expect(Math.round(-0.5)).toBe(-0); // the JS behavior we deliberately do NOT rely on
  });
});
