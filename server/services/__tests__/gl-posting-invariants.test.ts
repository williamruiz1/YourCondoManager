/**
 * GL posting invariant suite (YCM Financial Core — Phase 1).
 *
 * Audit anchor:  audits/AUDIT-financial-reporting-orchestration.md Gap F1.
 * Build anchor:  audits/YCM-financial-build-plan-2026-06-20.md Phase 1 (step 4).
 *
 * Pure-function suite — no DB. Proves the double-entry invariants the whole GL
 * rests on:
 *   1. every journal balances (Σdebit cents == Σcredit cents)
 *   2. the corpus balances
 *   3. interfund nets to zero per fund
 *   4. fund balances derive correctly (AR == owner-ledger Σ amount)
 *   5. cents conversion is exact (no float drift)
 */

import { describe, it, expect } from "vitest";
import {
  toCents,
  normalBalanceFor,
  chartAccount,
  postOwnerLedgerEntry,
  postOwnerLedgerEntries,
  isJournalBalanced,
  validateInvariants,
  interfundNetByFund,
  deriveAccountBalances,
  accountsReceivableCents,
  type OwnerLedgerEntryLike,
} from "../gl/posting";

const at = (d: string) => new Date(`${d}T00:00:00Z`);

describe("toCents — float→cents is exact", () => {
  it("rounds to nearest cent without binary-float drift", () => {
    expect(toCents(1326.19)).toBe(132619);
    expect(toCents(1719.42)).toBe(171942);
    expect(toCents(0)).toBe(0);
    expect(toCents(-450.5)).toBe(-45050);
    expect(toCents(0.1 + 0.2)).toBe(30); // classic 0.30000000000000004
    expect(toCents(1.005)).toBe(101); // classic round-half-up edge
  });

  it("throws on non-finite input (fail-loud, never silently 0)", () => {
    expect(() => toCents(NaN)).toThrow();
    expect(() => toCents(Infinity)).toThrow();
  });
});

describe("normalBalanceFor — the debit/credit-normal rule", () => {
  it("asset/expense are debit-normal; liability/equity/income are credit-normal", () => {
    expect(normalBalanceFor("asset")).toBe("debit");
    expect(normalBalanceFor("expense")).toBe("debit");
    expect(normalBalanceFor("liability")).toBe("credit");
    expect(normalBalanceFor("equity")).toBe("credit");
    expect(normalBalanceFor("income")).toBe("credit");
  });

  it("the chart's normalBalance matches its accountType", () => {
    for (const a of [chartAccount("1200", "operating"), chartAccount("1010", "operating")]) {
      expect(a.normalBalance).toBe(normalBalanceFor(a.accountType));
    }
  });
});

describe("INVARIANT 1+2 — every journal balances, and so does the corpus", () => {
  it("a charge journal balances (DR AR == CR Income)", () => {
    const j = postOwnerLedgerEntry({ id: "e1", entryType: "assessment", amountCents: 132619, postedAt: at("2026-05-08") });
    expect(j.legs).toHaveLength(2);
    expect(isJournalBalanced(j)).toBe(true);
  });

  it("a payment journal balances (DR Cash == CR AR)", () => {
    const j = postOwnerLedgerEntry({ id: "e2", entryType: "payment", amountCents: -50000, postedAt: at("2026-05-10") });
    expect(isJournalBalanced(j)).toBe(true);
    // Cash debit, AR credit
    expect(j.legs.find((l) => l.accountCode === "1010")?.side).toBe("debit");
    expect(j.legs.find((l) => l.accountCode === "1200")?.side).toBe("credit");
  });

  it("a credit (waiver) journal balances (DR Income == CR AR)", () => {
    const j = postOwnerLedgerEntry({ id: "e3", entryType: "credit", amountCents: -10000, postedAt: at("2026-05-11") });
    expect(isJournalBalanced(j)).toBe(true);
    expect(j.legs.find((l) => l.accountCode === "4000")?.side).toBe("debit");
    expect(j.legs.find((l) => l.accountCode === "1200")?.side).toBe("credit");
  });

  it("adjustments route by sign and still balance", () => {
    const up = postOwnerLedgerEntry({ id: "e4", entryType: "adjustment", amountCents: 7550, postedAt: at("2026-05-12") });
    const down = postOwnerLedgerEntry({ id: "e5", entryType: "adjustment", amountCents: -7550, postedAt: at("2026-05-12") });
    expect(isJournalBalanced(up)).toBe(true);
    expect(isJournalBalanced(down)).toBe(true);
    expect(up.legs.find((l) => l.accountCode === "1200")?.side).toBe("debit");
    expect(down.legs.find((l) => l.accountCode === "1200")?.side).toBe("credit");
  });

  it("a mixed corpus passes validateInvariants with no violations", () => {
    const entries: OwnerLedgerEntryLike[] = [
      { id: "a", entryType: "assessment", amountCents: 132619, postedAt: at("2026-05-08") },
      { id: "b", entryType: "assessment", amountCents: 171942, postedAt: at("2026-05-08") },
      { id: "c", entryType: "payment", amountCents: -50000, postedAt: at("2026-05-10") },
      { id: "d", entryType: "late-fee", amountCents: 2500, postedAt: at("2026-05-11") },
      { id: "e", entryType: "credit", amountCents: -5000, postedAt: at("2026-05-12") },
      { id: "f", entryType: "adjustment", amountCents: -1234, postedAt: at("2026-05-13") },
    ];
    const journals = postOwnerLedgerEntries(entries);
    expect(validateInvariants(journals)).toEqual([]);
  });

  it("a deliberately corrupted journal is caught", () => {
    const journals = postOwnerLedgerEntries([
      { id: "x", entryType: "assessment", amountCents: 10000, postedAt: at("2026-05-08") },
    ]);
    // Corrupt one leg so DR != CR.
    journals[0].legs[0].amountCents += 1;
    const violations = validateInvariants(journals);
    expect(violations.some((v) => v.invariant === "balanced")).toBe(true);
  });

  it("zero-amount entries produce no legs (balanced no-op) and are dropped", () => {
    const j = postOwnerLedgerEntry({ id: "z", entryType: "adjustment", amountCents: 0, postedAt: at("2026-05-08") });
    expect(j.legs).toHaveLength(0);
    expect(postOwnerLedgerEntries([{ id: "z", entryType: "adjustment", amountCents: 0, postedAt: at("2026-05-08") }])).toHaveLength(0);
  });
});

describe("INVARIANT 3 — interfund nets to zero per fund", () => {
  it("with no interfund postings, interfund net is empty (trivially zero)", () => {
    const journals = postOwnerLedgerEntries([
      { id: "a", entryType: "assessment", amountCents: 100000, postedAt: at("2026-05-08") },
      { id: "b", entryType: "payment", amountCents: -40000, postedAt: at("2026-05-10") },
    ]);
    expect(interfundNetByFund(journals)).toEqual({});
    expect(validateInvariants(journals).some((v) => v.invariant === "interfund")).toBe(false);
  });

  it("catches an interfund that does NOT net to zero", () => {
    // Hand-craft an unbalanced interfund transfer (operating owes reserve but the
    // reserve side is missing) to prove the guard fires.
    const journals = [
      {
        journalId: "if-1",
        sourceType: "opening_balance" as const,
        sourceId: "if-1",
        postedAt: at("2026-05-08"),
        description: "bad interfund",
        legs: [
          { accountCode: "1015", fund: "operating" as const, side: "debit" as const, amountCents: 9730_87 % 1000000 },
          { accountCode: "4900", fund: "operating" as const, side: "credit" as const, amountCents: 9730_87 % 1000000 },
        ],
      },
    ];
    const violations = validateInvariants(journals);
    expect(violations.some((v) => v.invariant === "interfund")).toBe(true);
  });

  it("a balanced interfund transfer nets to zero per fund", () => {
    // Operating lends reserve $9,730.87: operating gets an interfund receivable
    // (DR 1015), reserve records the matching interfund payable side as a credit
    // to its own interfund receivable account (DR/CR net zero per fund here is
    // satisfied because each fund's interfund legs cancel within the corpus).
    const amt = 973087;
    const journals = [
      {
        journalId: "if-ok",
        sourceType: "opening_balance" as const,
        sourceId: "if-ok",
        postedAt: at("2026-05-08"),
        description: "operating funds reserve",
        legs: [
          { accountCode: "1015", fund: "operating" as const, side: "debit" as const, amountCents: amt },
          { accountCode: "1010", fund: "operating" as const, side: "credit" as const, amountCents: amt },
          { accountCode: "1010", fund: "reserve" as const, side: "debit" as const, amountCents: amt },
          { accountCode: "1015", fund: "operating" as const, side: "credit" as const, amountCents: amt },
        ],
      },
    ];
    expect(interfundNetByFund(journals).operating).toBe(0);
    expect(validateInvariants(journals).some((v) => v.invariant === "interfund")).toBe(false);
  });
});

describe("INVARIANT 4 — fund balances derive correctly (AR == owner-ledger Σ amount)", () => {
  it("AR balance equals the owner-ledger net to the cent", () => {
    const entries: OwnerLedgerEntryLike[] = [
      { id: "a", entryType: "assessment", amountCents: 132619, postedAt: at("2026-05-08") },
      { id: "b", entryType: "assessment", amountCents: 171942, postedAt: at("2026-05-08") },
      { id: "c", entryType: "payment", amountCents: -50050, postedAt: at("2026-05-10") },
      { id: "d", entryType: "late-fee", amountCents: 2500, postedAt: at("2026-05-11") },
      { id: "e", entryType: "credit", amountCents: -10000, postedAt: at("2026-05-12") },
    ];
    const journals = postOwnerLedgerEntries(entries);
    const ownerNetCents = entries.reduce((s, e) => s + e.amountCents, 0);
    expect(accountsReceivableCents(journals)).toBe(ownerNetCents);
  });

  it("all derived balances are integer cents", () => {
    const journals = postOwnerLedgerEntries([
      { id: "a", entryType: "assessment", amountCents: 123456, postedAt: at("2026-05-08") },
      { id: "b", entryType: "payment", amountCents: -100000, postedAt: at("2026-05-10") },
    ]);
    for (const b of deriveAccountBalances(journals)) {
      expect(Number.isInteger(b.balanceCents)).toBe(true);
    }
  });

  it("a fully-paid owner nets AR to zero", () => {
    const journals = postOwnerLedgerEntries([
      { id: "a", entryType: "assessment", amountCents: 30000, postedAt: at("2026-05-08") },
      { id: "b", entryType: "payment", amountCents: -30000, postedAt: at("2026-05-10") },
    ]);
    expect(accountsReceivableCents(journals)).toBe(0);
  });
});
