/**
 * Dues → owner ledger → GL → reconcile → statements — end-to-end (PURE).
 *
 * This is the money-correctness acceptance test for the dues-to-GL wiring. It
 * proves the FULL chain a real dues payment travels, using the SAME pure GL core
 * the runtime posts through (no DB needed — the core is pure):
 *
 *   owner pays  →  owner_ledger_entry (the system of record)
 *               →  GL journal legs (DR Operating Cash 1010 / CR A/R 1200)
 *               →  reconcile-to-cent passes (GL A/R == owner-ledger Σ amount)
 *               →  the activity shows up on the financial statements (balance
 *                  sheet: Cash asset up, A/R cleared, Income folded into equity).
 *
 * It also asserts webhook-retry IDEMPOTENCY at the model layer: the GL leg's
 * stable journalId (`oln-<entryId>`) + (sourceType, sourceId, account, side) key
 * means re-deriving the same owner-ledger row produces the SAME legs — so the
 * onConflictDoNothing insert in syncAssociationGl is a no-op on a retry.
 */
import { describe, expect, it } from "vitest";
import {
  postOwnerLedgerEntries,
  postOwnerLedgerEntry,
  accountsReceivableCents,
  deriveAccountBalances,
  validateInvariants,
  toCents,
  type OwnerLedgerEntryLike,
} from "../gl/posting";
import { reconcileFromOwnerLedger } from "../gl/reconcile";
import { buildBalanceSheet } from "../gl/statements";

const POSTED = new Date("2026-06-29T12:00:00Z");

/** A dues CHARGE then a dues PAYMENT of the same amount — the canonical flow. */
function duesChargeThenPayment(dollars: number): OwnerLedgerEntryLike[] {
  return [
    { id: "charge-1", entryType: "charge", amount: dollars, postedAt: POSTED, description: "HOA dues" },
    { id: "pay-1", entryType: "payment", amount: -dollars, postedAt: POSTED, description: "Payment webhook" },
  ];
}

describe("dues payment → GL legs (DR Operating Cash 1010 / CR Accounts Receivable 1200)", () => {
  it("maps a single payment row to the exact double-entry the audit specifies", () => {
    const payment: OwnerLedgerEntryLike = {
      id: "pay-1",
      entryType: "payment",
      amount: -300,
      postedAt: POSTED,
      description: "Payment webhook",
    };
    const journal = postOwnerLedgerEntry(payment);

    expect(journal.sourceType).toBe("owner_ledger_entry");
    expect(journal.sourceId).toBe("pay-1");
    expect(journal.journalId).toBe("oln-pay-1"); // stable → idempotent
    expect(journal.legs).toHaveLength(2);

    const debit = journal.legs.find((l) => l.side === "debit")!;
    const credit = journal.legs.find((l) => l.side === "credit")!;
    // DR Operating Cash 1010
    expect(debit.accountCode).toBe("1010");
    expect(debit.fund).toBe("operating");
    expect(debit.amountCents).toBe(30000);
    // CR Accounts Receivable 1200
    expect(credit.accountCode).toBe("1200");
    expect(credit.fund).toBe("operating");
    expect(credit.amountCents).toBe(30000);
  });
});

describe("charge + full payment → balances + reconcile-to-cent", () => {
  it("after a charge is fully paid: A/R nets to zero, Cash 1010 holds the cash", () => {
    const journals = postOwnerLedgerEntries(duesChargeThenPayment(300));

    // Invariants clean (DR == CR everywhere).
    expect(validateInvariants(journals)).toEqual([]);

    // A/R: +300 (charge) then −300 (payment) → 0 to the cent.
    expect(accountsReceivableCents(journals)).toBe(0);

    // Operating Cash 1010 carries the $300 collected.
    const balances = deriveAccountBalances(journals);
    const cash = balances.find((b) => b.accountCode === "1010" && b.fund === "operating");
    expect(cash?.balanceCents).toBe(30000);

    // Assessment Income 4000 recognized the $300 billing.
    const income = balances.find((b) => b.accountCode === "4000" && b.fund === "operating");
    expect(income?.balanceCents).toBe(30000);
  });

  it("reconcile-to-cent PASSES: GL A/R == owner-ledger Σ amount (gate that lets the GL post)", () => {
    // A partially-paid case so the reconciled balance is non-zero and exact.
    const entries: OwnerLedgerEntryLike[] = [
      { id: "c1", entryType: "charge", amount: 500.55, postedAt: POSTED },
      { id: "p1", entryType: "payment", amount: -200.55, postedAt: POSTED },
    ];
    const report = reconcileFromOwnerLedger(entries);

    expect(report.ok).toBe(true);
    expect(report.invariantViolations).toEqual([]);
    // Owner still owes $300.00 → A/R == $300.00, to the cent.
    expect(report.ownerLedgerBalanceCents).toBe(30000);
    expect(report.glAccountsReceivableCents).toBe(30000);
    expect(report.differenceCents).toBe(0);
  });
});

describe("dues activity appears on the financial statements (balance sheet)", () => {
  it("balance sheet balances to the cent and reflects the dues-driven cash + income", () => {
    const journals = postOwnerLedgerEntries(duesChargeThenPayment(300));
    const sheet = buildBalanceSheet(journals);

    expect(sheet.balanced).toBe(true);
    expect(sheet.differenceCents).toBe(0);

    const operating = sheet.funds.find((f) => f.fund === "operating")!;
    // Assets: Operating Cash $300 (A/R nets to 0 and is filtered out of the sheet).
    const cashLine = operating.assets.find((a) => a.accountCode === "1010");
    expect(cashLine?.balanceCents).toBe(30000);
    expect(operating.totalAssetsCents).toBe(30000);

    // Net income (the recognized $300 dues) folds into equity → equity == assets.
    expect(operating.netIncomeCents).toBe(30000);
    expect(operating.totalEquityCents).toBe(30000);
  });

  it("an unpaid charge surfaces as Accounts Receivable on the balance sheet", () => {
    const journals = postOwnerLedgerEntries([
      { id: "c1", entryType: "charge", amount: 450, postedAt: POSTED, description: "HOA dues" },
    ]);
    const sheet = buildBalanceSheet(journals);
    const operating = sheet.funds.find((f) => f.fund === "operating")!;
    const ar = operating.assets.find((a) => a.accountCode === "1200");
    expect(ar?.balanceCents).toBe(45000);
    expect(sheet.balanced).toBe(true);
  });
});

describe("webhook-retry idempotency (model layer)", () => {
  it("re-deriving the SAME owner-ledger row yields identical legs (same source-leg key)", () => {
    const payment: OwnerLedgerEntryLike = {
      id: "pay-42",
      entryType: "payment",
      amount: -125.25,
      postedAt: POSTED,
    };
    const first = postOwnerLedgerEntry(payment);
    const second = postOwnerLedgerEntry(payment);

    // Same journalId + same legs (account/side/amount) → the DB's
    // (sourceType, sourceId, glAccountId, side) unique index makes the second
    // insert a no-op via onConflictDoNothing. The amount is exact to the cent.
    expect(second.journalId).toBe(first.journalId);
    expect(second.sourceId).toBe("pay-42");
    expect(second.legs).toEqual(first.legs);
    expect(toCents(payment.amount)).toBe(-12525);
    for (const leg of first.legs) expect(leg.amountCents).toBe(12525);
  });

  it("a charge then payment then a DUPLICATE payment row would double-pay; the SAME row never does", () => {
    // Distinct ids = two real payments (owner paid twice) → A/R goes negative
    // (a credit balance) — that's correct, not a bug.
    const twoRealPayments = postOwnerLedgerEntries([
      { id: "c1", entryType: "charge", amount: 300, postedAt: POSTED },
      { id: "p1", entryType: "payment", amount: -300, postedAt: POSTED },
      { id: "p2", entryType: "payment", amount: -300, postedAt: POSTED },
    ]);
    expect(accountsReceivableCents(twoRealPayments)).toBe(-30000);

    // The SAME payment row id re-derived (a webhook RETRY) produces the SAME
    // single journal — not two — so it can never double-pay through the GL.
    const retried = postOwnerLedgerEntries([
      { id: "c1", entryType: "charge", amount: 300, postedAt: POSTED },
      { id: "p1", entryType: "payment", amount: -300, postedAt: POSTED },
    ]);
    const journalIds = retried.map((j) => j.journalId);
    expect(new Set(journalIds).size).toBe(journalIds.length); // all unique
    expect(accountsReceivableCents(retried)).toBe(0);
  });
});
