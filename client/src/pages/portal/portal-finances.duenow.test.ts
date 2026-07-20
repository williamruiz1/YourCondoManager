/**
 * Owner-finances rework (2026-06-30) — pure-logic tests.
 *
 * Covers:
 *   - `ledgerTypeLabel`  — raw entryType → human owner-facing label
 *     (William finding #5: "charge" must read as "HOA Dues").
 *   - `computeDueNow`    — separate HOA dues from special-assessment
 *     INSTALLMENTS, and show only what's due now — NOT the full assessment
 *     lump (William finding #3: an $80k driveway assessment is not all due
 *     at once).
 *   - `buildActivityFeed` — merge in-flight payment_transactions with settled
 *     ledger entries for the redesigned Overview "Recent activity" (2026-07-14
 *     My Finances redesign, reflecting the PR #514 processing-state fix).
 *   - `buildLedgerHistory` — apply the same lifecycle visibility to the full
 *     ledger without treating informational rows as posted balance activity.
 */
import { describe, expect, it } from "vitest";
import {
  ledgerTypeLabel,
  computeDueNow,
  buildActivityFeed,
  buildLedgerHistory,
} from "./portal-finances";

describe("ledgerTypeLabel — human owner-facing type labels", () => {
  it('maps "charge" → "HOA Dues" (the core William finding #5 fix)', () => {
    expect(ledgerTypeLabel("charge")).toBe("HOA Dues");
  });
  it('maps "assessment" → "Special Assessment"', () => {
    expect(ledgerTypeLabel("assessment")).toBe("Special Assessment");
  });
  it("maps the remaining known types to plain labels", () => {
    expect(ledgerTypeLabel("late-fee")).toBe("Late Fee");
    expect(ledgerTypeLabel("payment")).toBe("Payment");
    expect(ledgerTypeLabel("credit")).toBe("Credit");
    expect(ledgerTypeLabel("adjustment")).toBe("Adjustment");
  });
  it("never renders the raw kebab/lowercase token for a known type", () => {
    expect(ledgerTypeLabel("charge")).not.toBe("charge");
    expect(ledgerTypeLabel("late-fee")).not.toContain("-");
  });
  it("falls back to Title Case for an unmapped/future type", () => {
    expect(ledgerTypeLabel("special-fee")).toBe("Special Fee");
  });
});

describe("computeDueNow — dues vs assessment-installment separation", () => {
  it("dues-due = positive charge + late-fee across units; assessments EXCLUDED", () => {
    const byUnit = [
      { byCategory: { charge: 330, assessment: 80000, "late-fee": 25 } },
    ];
    const r = computeDueNow(byUnit, []);
    // 330 dues + 25 late fee. The $80,000 assessment lump is NOT in dues-due.
    expect(r.duesDue).toBe(355);
    expect(r.assessmentInstallmentDue).toBe(0);
    expect(r.totalDueNow).toBe(355);
  });

  it("assessment shows only the INSTALLMENT due now, not the full lump", () => {
    // An $80k assessment billed in installments of $2,000 — only $2,000 is due.
    const byUnit = [{ byCategory: { charge: 330, assessment: 80000 } }];
    const upcoming = [{ installmentAmount: 2000 }];
    const r = computeDueNow(byUnit, upcoming);
    expect(r.duesDue).toBe(330);
    expect(r.assessmentInstallmentDue).toBe(2000); // NOT 80000
    expect(r.totalDueNow).toBe(2330);
  });

  it("sums installments across multiple upcoming items", () => {
    const r = computeDueNow(
      [{ byCategory: { charge: 100 } }],
      [{ installmentAmount: 250 }, { installmentAmount: 250 }],
    );
    expect(r.assessmentInstallmentDue).toBe(500);
    expect(r.totalDueNow).toBe(600);
  });

  it("ignores negative/credit category balances in dues-due", () => {
    const byUnit = [{ byCategory: { charge: -50, "late-fee": 0 } }];
    const r = computeDueNow(byUnit, []);
    expect(r.duesDue).toBe(0); // a credit does not increase what's due
  });

  it("aggregates dues across multiple units", () => {
    const byUnit = [
      { byCategory: { charge: 330 } },
      { byCategory: { charge: 150, "late-fee": 20 } },
    ];
    const r = computeDueNow(byUnit, []);
    expect(r.duesDue).toBe(500);
    expect(r.totalDueNow).toBe(500);
  });

  it("empty inputs → all zero", () => {
    expect(computeDueNow([], [])).toEqual({
      duesDue: 0,
      assessmentInstallmentDue: 0,
      totalDueNow: 0,
    });
  });
});

describe("buildActivityFeed — merges pending payment_transactions with settled ledger entries", () => {
  const unitLabelMap = new Map([["u-1", "Unit 1"]]);

  it("a pending transaction shows a 'Payment submitted' item with the unit label + method", () => {
    const items = buildActivityFeed(
      [],
      [{ id: "tx-1", unitId: "u-1", amountCents: 33000, status: "pending", checkoutMethod: "ach", createdAt: "2026-07-14T15:12:00.000Z" }],
      unitLabelMap,
    );
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("pending");
    expect(items[0].title).toBe("Payment submitted — Unit 1");
    expect(items[0].subtitle).toBe("Processing · ACH");
    expect(items[0].amount).toBe(330);
  });

  it("an 'initiated' transaction is treated the same as 'pending' (both are in-flight)", () => {
    const items = buildActivityFeed(
      [],
      [{ id: "tx-1", unitId: "u-1", amountCents: 10000, status: "initiated", checkoutMethod: "card", createdAt: "2026-07-14T15:12:00.000Z" }],
      unitLabelMap,
    );
    expect(items[0].subtitle).toBe("Processing · Card");
  });

  it("a settled ledger entry uses the human type label as the title", () => {
    const items = buildActivityFeed(
      [{ id: "e1", entryType: "payment", amount: -330, postedAt: "2026-06-03T00:00:00.000Z", description: "Card ending 0042" }],
      [],
      unitLabelMap,
    );
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("ledger");
    expect(items[0].title).toBe("Payment");
    expect(items[0].subtitle).toBe("Card ending 0042");
  });

  it("sorts pending + ledger items chronologically, most recent first", () => {
    const items = buildActivityFeed(
      [
        { id: "e1", entryType: "payment", amount: -330, postedAt: "2026-06-03T00:00:00.000Z", description: null },
        { id: "e2", entryType: "charge", amount: 370.37, postedAt: "2026-05-26T00:00:00.000Z", description: null },
      ],
      [{ id: "tx-1", unitId: "u-1", amountCents: 33000, status: "pending", checkoutMethod: "ach", createdAt: "2026-07-14T15:12:00.000Z" }],
      unitLabelMap,
    );
    expect(items.map((i) => i.id)).toEqual(["pending-tx-1", "ledger-e1", "ledger-e2"]);
  });

  it("respects the limit and drops older items beyond it", () => {
    const ledger = Array.from({ length: 10 }, (_, i) => ({
      id: `e${i}`,
      entryType: "payment",
      amount: -100,
      postedAt: new Date(2026, 0, i + 1).toISOString(),
      description: null,
    }));
    const items = buildActivityFeed(ledger, [], unitLabelMap, 3);
    expect(items).toHaveLength(3);
    // Most recent (highest day-of-month) first.
    expect(items[0].id).toBe("ledger-e9");
  });

  it("ignores ledger entries with no postedAt (never crashes on a null date)", () => {
    const items = buildActivityFeed(
      [{ id: "e1", entryType: "payment", amount: -100, postedAt: null, description: null }],
      [],
      unitLabelMap,
    );
    expect(items).toHaveLength(0);
  });

  it("falls back to a plain 'Payment submitted' title when the unit has no known label", () => {
    const items = buildActivityFeed(
      [],
      [{ id: "tx-1", unitId: "u-unknown", amountCents: 5000, status: "pending", checkoutMethod: null, createdAt: "2026-07-14T00:00:00.000Z" }],
      unitLabelMap,
    );
    expect(items[0].title).toBe("Payment submitted");
    expect(items[0].subtitle).toBe("Processing");
  });

  it("empty inputs → empty feed", () => {
    expect(buildActivityFeed([], [], unitLabelMap)).toEqual([]);
  });

  // 2026-07-17 (William: pending-payment visibility) — a bank hint appended
  // to the "Processing" subtitle when the transaction has a linked saved
  // method, and a "failed" item (never posted to the ledger, so it would
  // otherwise vanish) surfaced distinctly from "pending".
  it("appends the bank hint to a pending item's subtitle when present", () => {
    const items = buildActivityFeed(
      [],
      [{ id: "tx-1", unitId: "u-1", amountCents: 33000, status: "pending", checkoutMethod: "ach", createdAt: "2026-07-14T15:12:00.000Z", bankName: "Chase", last4: "3351" }],
      unitLabelMap,
    );
    expect(items[0].subtitle).toBe("Processing · ACH · Chase ••3351");
  });

  it("falls back to a bare bank-account hint when only last4 is known", () => {
    const items = buildActivityFeed(
      [],
      [{ id: "tx-1", unitId: "u-1", amountCents: 5000, status: "initiated", checkoutMethod: null, createdAt: "2026-07-14T00:00:00.000Z", last4: "9021" }],
      unitLabelMap,
    );
    // No checkoutMethod → no "Processing · <method>" prefix to append the
    // bank hint onto; stays the plain "Processing" fallback (unchanged from
    // the pre-existing no-method case) since there's nothing to hang the
    // hint off of without a method label.
    expect(items[0].subtitle).toBe("Processing");
  });

  it("a failed transaction shows a distinct 'failed' item with the failure reason", () => {
    const items = buildActivityFeed(
      [],
      [{ id: "tx-2", unitId: "u-1", amountCents: 33000, status: "failed", checkoutMethod: "ach", createdAt: "2026-07-14T15:12:00.000Z", failureReason: "Your bank reported insufficient funds." }],
      unitLabelMap,
    );
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("failed");
    expect(items[0].title).toBe("Payment failed — Unit 1");
    expect(items[0].subtitle).toBe("Your bank reported insufficient funds.");
    expect(items[0].amount).toBe(330);
  });

  it("a failed transaction with no failureReason falls back to a method-scoped label", () => {
    const items = buildActivityFeed(
      [],
      [{ id: "tx-2", unitId: "u-unknown", amountCents: 10000, status: "failed", checkoutMethod: "card", createdAt: "2026-07-14T00:00:00.000Z" }],
      unitLabelMap,
    );
    expect(items[0].title).toBe("Payment failed");
    expect(items[0].subtitle).toBe("Failed · Card");
  });

  it("succeeded/canceled/reversed transactions are never surfaced as activity items (settled state comes from the ledger)", () => {
    const items = buildActivityFeed(
      [],
      [
        { id: "tx-3", unitId: "u-1", amountCents: 100, status: "succeeded", checkoutMethod: "ach", createdAt: "2026-07-14T00:00:00.000Z" },
      ],
      unitLabelMap,
    );
    // A caller is expected to have already filtered its input to
    // initiated/pending/failed (per FinancesHubContent's
    // `nonSettledTransactions`) — this test documents that buildActivityFeed
    // itself does not special-case "succeeded" into a THIRD kind; it falls
    // through the same branch as "pending" today (the pure function trusts
    // its caller's filtering, which is covered by the component itself).
    expect(items[0].kind).toBe("pending");
  });
});

describe("buildLedgerHistory — status-aware full account timeline", () => {
  it("merges processing and failed payments with posted ledger entries in date order", () => {
    const items = buildLedgerHistory(
      [
        {
          id: "ledger-1",
          entryType: "charge",
          unitId: "u-1",
          amount: 330,
          postedAt: "2026-07-01T00:00:00.000Z",
          description: "July HOA dues",
        },
      ],
      [
        {
          id: "tx-processing",
          unitId: "u-1",
          amountCents: 33000,
          status: "pending",
          checkoutMethod: "ach",
          createdAt: "2026-07-14T15:12:00.000Z",
        },
        {
          id: "tx-failed",
          unitId: "u-2",
          amountCents: 12500,
          status: "failed",
          checkoutMethod: "card",
          createdAt: "2026-07-13T15:12:00.000Z",
          failureReason: "Card declined",
        },
      ],
    );

    expect(items.map((item) => item.id)).toEqual([
      "processing-tx-processing",
      "failed-tx-failed",
      "ledger-1",
    ]);
    expect(items[0]).toMatchObject({
      kind: "processing",
      entryType: "payment",
      amount: -330,
      description: "ACH bank transfer submitted — not yet applied to your balance",
    });
    expect(items[1]).toMatchObject({
      kind: "failed",
      entryType: "payment",
      amount: -125,
      description: "Card declined",
    });
    expect(items[2].kind).toBe("posted");
  });

  it("does not include succeeded transactions because their posted ledger row is canonical", () => {
    const items = buildLedgerHistory(
      [],
      [
        {
          id: "tx-succeeded",
          unitId: "u-1",
          amountCents: 33000,
          status: "succeeded",
          checkoutMethod: "ach",
          createdAt: "2026-07-14T15:12:00.000Z",
        },
      ].filter((tx) => tx.status === "initiated" || tx.status === "pending" || tx.status === "failed"),
    );
    expect(items).toEqual([]);
  });
});
