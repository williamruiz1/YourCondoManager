/**
 * Stripe FC → STATEMENTS / RECONCILIATION rendering proof.
 *
 * William's go-live concern (2026-06-30): "we'll have to switch the plumbing so
 * the financial statements and everything render correctly." This test proves
 * that when Stripe Financial Connections is the bank feed, the downstream
 * consumers — the reconciliation auto-matcher, the reconciliation report's
 * deposit/credit aggregation, and the Chart-of-Accounts balance render — produce
 * the SAME, correct output they produce for Plaid, because the FC provider emits
 * the SAME provider-agnostic snapshot shape + sign convention.
 *
 * It does this WITHOUT a DB by:
 *   1. feeding realistic raw Stripe FC API JSON through the real
 *      `mapFcTransaction` / `mapFcAccount` mappers,
 *   2. asserting the snapshot sign convention (Plaid: + = debit / − = credit),
 *   3. running the FC-derived amounts through the REAL reconciliation pure
 *      functions (`scoreCandidate`) + the report's documented credit/deposit
 *      aggregation, and asserting an owner FC deposit auto-matches + totals
 *      correctly,
 *   4. asserting the COA-bridge balance render is a correct positive cents value.
 *
 * If FC ever drifts from the contract (wrong sign, cents-vs-dollars, balance
 * shape), this test fails — catching a "statements render wrong" regression
 * before go-live.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("../../../logger", () => ({ debug: vi.fn(), log: vi.fn() }));
vi.mock("../../../platform-secrets-store", () => ({
  getSecret: vi.fn(async () => "sk_test_platform_123"),
}));
// auto-matcher.ts imports ../../db at module load (which requires DATABASE_URL);
// `scoreCandidate` is a pure function that never touches the db, so a stub
// import is sufficient to exercise it without a database.
vi.mock("../../../db", () => ({ db: {}, pool: {} }));

import { mapFcAccount, mapFcTransaction } from "../stripe-fc-provider";
import type { BankTransactionSnapshot } from "../provider";
import { scoreCandidate, AUTO_MATCH_THRESHOLD } from "../../reconciliation/auto-matcher";
import { bridgedAccountName } from "../../financial-account-bank-bridge";

// ── The reconciler's canonical credit test (auto-matcher.ts `isCredit`,
//    report.ts line 88, both: amountCents < 0). Re-stated here so the test
//    fails loudly if the FC sign were ever flipped. ─────────────────────────────
const isCredit = (amountCents: number): boolean => amountCents < 0;

describe("Stripe FC → statements/reconciliation rendering", () => {
  it("maps an owner DEPOSIT (FC money-in) to a CREDIT (negative) snapshot the reconciler recognizes", () => {
    // Raw FC transaction object: an owner Zelle/ACH deposit into the HOA account.
    // FC sign: +amount = money INTO the account.
    const fcDeposit = {
      id: "fctxn_dep_1",
      account: "fca_op",
      amount: 35000, // $350.00 deposit, money IN (cents/minor units, NOT dollars)
      currency: "usd",
      transacted_at: 1_700_000_000,
      description: "ZELLE FROM WILLIAM RUIZ",
      status: "posted",
    };

    const snap = mapFcTransaction(fcDeposit);

    // Sign convention: money-in → NEGATIVE (credit) per the Plaid convention the
    // whole reconciliation layer assumes. Amount is in cents (no *100 — FC is
    // already minor units).
    expect(snap.amountCents).toBe(-35000);
    expect(isCredit(snap.amountCents)).toBe(true); // the reconciler will treat it as an owner payment
    expect(snap.date).toBe("2023-11-14"); // unix-sec → ISO date
    expect(snap.pending).toBe(false);
    expect(snap.providerTransactionId).toBe("fctxn_dep_1");
  });

  it("maps a vendor PAYMENT (FC money-out) to a DEBIT (positive) snapshot — NOT a credit", () => {
    const fcVendor = {
      id: "fctxn_vendor_1",
      account: "fca_op",
      amount: -120000, // $1,200.00 OUT (landscaping vendor)
      currency: "usd",
      transacted_at: 1_700_100_000,
      description: "LANDSCAPE CO ACH DEBIT",
      status: "posted",
    };

    const snap = mapFcTransaction(fcVendor);

    expect(snap.amountCents).toBe(120000); // money out → debit (positive)
    expect(isCredit(snap.amountCents)).toBe(false); // a debit is never matched as an owner payment
  });

  it("an FC owner deposit AUTO-MATCHES the owner's open dues ledger entry (reconciliation renders the match)", () => {
    // FC deposit of $350 from William Ruiz.
    const snap = mapFcTransaction({
      id: "fctxn_dep_2",
      account: "fca_op",
      amount: 35000,
      currency: "usd",
      transacted_at: Math.floor(new Date("2026-06-15").getTime() / 1000),
      description: "ZELLE FROM WILLIAM RUIZ",
      status: "posted",
    });

    // The reconciler scores |amountCents| against the ledger entry's |cents|.
    // A $350 dues charge posted same day, owner = William Ruiz.
    const { confidence, signals } = scoreCandidate({
      bankAmountAbsCents: Math.abs(snap.amountCents),
      bankDate: new Date(snap.date),
      bankDescription: snap.merchantName ?? snap.name, // FC has no merchantName → falls back to name (the descriptor)
      ledgerAmountAbsCents: 35000,
      ledgerPostedAt: new Date("2026-06-15"),
      ownerFirstName: "William",
      ownerLastName: "Ruiz",
    });

    // exact amount (0.55) + same day (0.20) + exact payor (0.25) = 1.00, clamped.
    expect(confidence).toBeGreaterThanOrEqual(AUTO_MATCH_THRESHOLD);
    expect(signals.amountDeltaCents).toBe(0);
    expect(signals.dateDeltaDays).toBe(0);
    expect(signals.payorMatch).toBe("exact");
  });

  it("renders the reconciliation report's 'Total bank deposits' correctly from FC-shaped rows", () => {
    // Mix of FC-mapped rows as they'd land in bank_transactions.
    const rows: BankTransactionSnapshot[] = [
      mapFcTransaction({ id: "d1", account: "a", amount: 35000, currency: "usd", transacted_at: 1, status: "posted" }), // +350 in
      mapFcTransaction({ id: "d2", account: "a", amount: 50000, currency: "usd", transacted_at: 2, status: "posted" }), // +500 in
      mapFcTransaction({ id: "v1", account: "a", amount: -120000, currency: "usd", transacted_at: 3, status: "posted" }), // -1200 out (debit)
    ];

    // Reproduce report.ts §1 EXACTLY: credits are amountCents < 0; deposits =
    // sum of |amountCents| over credits.
    const bankCredits = rows.filter((r) => r.amountCents < 0);
    const bankDepositsCents = bankCredits.reduce((sum, r) => sum + Math.abs(r.amountCents), 0);

    expect(bankCredits.map((r) => r.providerTransactionId)).toEqual(["d1", "d2"]); // vendor debit excluded
    expect(bankDepositsCents).toBe(85000); // $850.00 in deposits — renders correctly
  });

  it("renders a CoA-bridge balance from an FC balance object (positive cents, both current + available)", () => {
    // FC balance.current is a currency→minor-units map.
    const snap = mapFcAccount({
      id: "fca_op",
      display_name: "Chase Operating",
      last4: "1234",
      category: "cash",
      subcategory: "checking",
      balance: { current: { usd: 1_250_000 }, type: "cash" }, // $12,500.00
    });

    // Balance is read straight (cents), NOT negated, NOT *100. This is what the
    // COA bridge writes to financial_accounts.current_balance_cents and what
    // /app/financial/foundation renders.
    expect(snap.currentBalanceCents).toBe(1_250_000);
    expect(snap.availableBalanceCents).toBe(1_250_000);
    expect(snap.type).toBe("depository"); // FC "cash" → Plaid "depository" so labels read identically
    expect(snap.mask).toBe("1234");

    // The bridged COA row name renders "Chase Operating ••1234".
    expect(bridgedAccountName(snap.name, snap.mask)).toBe("Chase Operating ••1234");
  });

  it("handles a balance with no usd key (single foreign currency) without crashing the render", () => {
    const snap = mapFcAccount({
      id: "fca_x",
      display_name: "Account",
      category: "cash",
      balance: { current: { cad: 99_900 } },
    });
    expect(snap.currentBalanceCents).toBe(99_900); // falls back to the single currency present
  });

  it("renders a null balance (FC returned no balance) as null — the COA row shows no balance, never NaN", () => {
    const snap = mapFcAccount({ id: "fca_y", display_name: "Account", category: "cash", balance: null });
    expect(snap.currentBalanceCents).toBeNull();
    expect(snap.availableBalanceCents).toBeNull();
  });
});
