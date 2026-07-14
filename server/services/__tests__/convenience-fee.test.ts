/**
 * Unit tests for the CT convenience-fee structure (founder-os
 * wiki/research/chc-processing-fee-legality-2026-07-14.md §6) —
 * server/services/convenience-fee.ts.
 *
 * Covers the THREE acceptance criteria from the build dispatch:
 *   1. THE BOOKS SPLIT — `netLedgerCreditDollars` proves the association's
 *      ledger credit is the assessment AT FACE VALUE, never the
 *      fee-inclusive total (the core legal requirement of the memo).
 *   2. Fee math — `computeCardConvenienceFeeCents` / `computeAchFeeCents`
 *      are pure and match the memo's recommended structure (percent + fixed,
 *      no artificial ceiling; ACH free by default).
 *   3. Idempotency — `recordPlatformProcessingFee` never double-books the
 *      SAME Stripe payment_intent (double-submit / webhook-retry safety),
 *      mirroring the existing `ledger-payment-identity.test.ts` mock
 *      convention (partial-unique-index semantics, no live DB in CI).
 *
 * The fake `db` below mirrors the repo's established mock-based test
 * convention (see server/services/__tests__/ledger-payment-identity.test.ts)
 * — CI runs with no live database.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Fake schema + drizzle-orm operators (mirrors ledger-payment-identity.test.ts) ──
type Pred =
  | { kind: "eq"; key: string; val: unknown }
  | { kind: "and"; ps: Pred[] }
  | undefined;

vi.mock("@shared/schema", () => {
  const makeTable = (name: string) =>
    new Proxy(
      { __name: name },
      {
        get(_t, prop) {
          if (prop === "__name") return name;
          if (typeof prop === "symbol") return undefined;
          return { _key: String(prop) };
        },
      },
    );
  return {
    associationFeeSettings: makeTable("association_fee_settings"),
    platformProcessingFees: makeTable("platform_processing_fees"),
  };
});

vi.mock("drizzle-orm", () => ({
  eq: (col: { _key: string }, val: unknown): Pred => ({ kind: "eq", key: col?._key, val }),
  and: (...ps: Pred[]): Pred => ({ kind: "and", ps: ps.filter(Boolean) as Pred[] }),
  sql: (..._args: unknown[]) => ({
    __sql: true,
    // getPlatformFeeTotalsForAssociation uses sql<number>`...` as a select
    // projection value — the fake select() below never evaluates it, so a
    // stub object is sufficient.
  }),
}));

type Row = Record<string, unknown> & { id: string };

let feeSettingsStore: Row[] = [];
let platformFeesStore: Row[] = [];
let idCounter = 0;

function matches(row: Row, pred: Pred): boolean {
  if (!pred) return true;
  if (pred.kind === "eq") return (row as Record<string, unknown>)[pred.key] === pred.val;
  if (pred.kind === "and") return pred.ps.every((p) => matches(row, p));
  return true;
}

function tableName(t: unknown): string {
  return (t as { __name?: string })?.__name ?? "";
}

vi.mock("../../db", () => ({
  db: {
    select() {
      let fromTable: unknown;
      return {
        from(t: unknown) {
          fromTable = t;
          return {
            where(pred: Pred) {
              const store = tableName(fromTable) === "association_fee_settings" ? feeSettingsStore : platformFeesStore;
              const rows = store.filter((r) => matches(r, pred));
              return { limit: () => Promise.resolve(rows) };
            },
          };
        },
      };
    },
    insert(t: unknown) {
      const targetStore = tableName(t) === "association_fee_settings" ? feeSettingsStore : platformFeesStore;
      let vals: Row;
      let conflict = false;
      const chain = {
        values(v: Record<string, unknown>) {
          vals = { ...v, id: (v.id as string) ?? `row-${++idCounter}` } as Row;
          return chain;
        },
        onConflictDoNothing(_config: unknown) {
          conflict =
            vals.stripePaymentIntentId != null &&
            targetStore.some((r) => r.stripePaymentIntentId === vals.stripePaymentIntentId);
          return chain;
        },
        returning() {
          if (conflict) return Promise.resolve([]);
          targetStore.push(vals);
          return Promise.resolve([vals]);
        },
      };
      return chain;
    },
    update(t: unknown) {
      const targetStore = tableName(t) === "association_fee_settings" ? feeSettingsStore : platformFeesStore;
      let patch: Record<string, unknown>;
      const chain = {
        set(p: Record<string, unknown>) {
          patch = p;
          return chain;
        },
        where(pred: Pred) {
          const idx = targetStore.findIndex((r) => matches(r, pred));
          if (idx >= 0) targetStore[idx] = { ...targetStore[idx], ...patch };
          return {
            returning: () => Promise.resolve(idx >= 0 ? [targetStore[idx]] : []),
          };
        },
      };
      return chain;
    },
  },
}));

import {
  computeCardConvenienceFeeCents,
  computeAchFeeCents,
  netLedgerCreditDollars,
  getAssociationFeeSettings,
  setAssociationFeeSettings,
  recordPlatformProcessingFee,
  DEFAULT_FEE_SETTINGS,
} from "../convenience-fee";

beforeEach(() => {
  feeSettingsStore = [];
  platformFeesStore = [];
  idCounter = 0;
});

describe("computeCardConvenienceFeeCents (memo §6.3 — tied to actual card cost)", () => {
  it("computes percent + fixed at the default rate (2.90% + $0.30)", () => {
    // $200.00 assessment → 2.90% = $5.80 + $0.30 = $6.10
    expect(computeCardConvenienceFeeCents(20000)).toBe(610);
  });

  it("scales with large amounts — no artificial ceiling (a $10,000 special assessment)", () => {
    // 1,000,000 cents * 2.90% = 29,000 + 30 = 29,030
    expect(computeCardConvenienceFeeCents(1_000_000)).toBe(29_030);
  });

  it("respects a custom percent/fixed rate", () => {
    expect(computeCardConvenienceFeeCents(10_000, 250, 50)).toBe(300); // 2.5% of $100 + $0.50
  });

  it("returns 0 for non-positive or non-finite input (degenerate guard)", () => {
    expect(computeCardConvenienceFeeCents(0)).toBe(0);
    expect(computeCardConvenienceFeeCents(-500)).toBe(0);
    expect(computeCardConvenienceFeeCents(NaN)).toBe(0);
  });
});

describe("computeAchFeeCents (memo §6.4 — free by default)", () => {
  it("defaults to 0 (free)", () => {
    expect(computeAchFeeCents()).toBe(0);
    expect(computeAchFeeCents(DEFAULT_FEE_SETTINGS.achFeeCents)).toBe(0);
  });

  it("honors a configured flat fee when set", () => {
    expect(computeAchFeeCents(150)).toBe(150);
  });

  it("floors negative/non-finite at 0", () => {
    expect(computeAchFeeCents(-5)).toBe(0);
  });
});

describe("netLedgerCreditDollars — THE books-split invariant (memo §6)", () => {
  it("nets the fee out so the ledger credit is the assessment AT FACE VALUE", () => {
    // $206.10 total charged (assessment $200 + fee $6.10) → ledger credits $200.00
    expect(netLedgerCreditDollars(206.10, 610)).toBe(200);
  });

  it("is a no-op when there is no fee (every association with the flag off)", () => {
    expect(netLedgerCreditDollars(200, null)).toBe(200);
    expect(netLedgerCreditDollars(200, undefined)).toBe(200);
    expect(netLedgerCreditDollars(200, 0)).toBe(200);
  });

  it("never goes negative in the degenerate case (fee somehow exceeds the total)", () => {
    expect(netLedgerCreditDollars(5, 10_000)).toBe(0);
  });

  it("rounds to the cent (float-precision safety on real-world totals)", () => {
    // $80,029.03 total ($80,000.00 assessment + $29.03 card fee on a special assessment)
    expect(netLedgerCreditDollars(80029.03, 2903)).toBe(80000);
  });
});

describe("getAssociationFeeSettings — default-OFF (feature-inert until explicitly enabled)", () => {
  it("returns DEFAULT_FEE_SETTINGS (cardFeeEnabled: false) when no row exists", async () => {
    const settings = await getAssociationFeeSettings("assoc-cherry-hill");
    expect(settings).toEqual(DEFAULT_FEE_SETTINGS);
  });

  it("returns the persisted row once one exists", async () => {
    await setAssociationFeeSettings("assoc-cherry-hill", { cardFeeEnabled: true }, "william@ycm");
    const settings = await getAssociationFeeSettings("assoc-cherry-hill");
    expect(settings.cardFeeEnabled).toBe(true);
    expect(settings.cardFeePercentBps).toBe(DEFAULT_FEE_SETTINGS.cardFeePercentBps);
  });
});

describe("setAssociationFeeSettings — the one-command enable/disable, reversible", () => {
  it("creates a new row on first call, defaulting unset fields", async () => {
    const created = await setAssociationFeeSettings("assoc-1", { cardFeeEnabled: true });
    expect(created.cardFeeEnabled).toBe(1);
    expect(created.cardFeePercentBps).toBe(DEFAULT_FEE_SETTINGS.cardFeePercentBps);
    expect(created.cardFeeFixedCents).toBe(DEFAULT_FEE_SETTINGS.cardFeeFixedCents);
    expect(created.achFeeCents).toBe(DEFAULT_FEE_SETTINGS.achFeeCents);
  });

  it("updates in place on a second call — reversible (flip back off)", async () => {
    await setAssociationFeeSettings("assoc-1", { cardFeeEnabled: true }, "admin@ycm");
    const disabled = await setAssociationFeeSettings("assoc-1", { cardFeeEnabled: false }, "admin@ycm");
    expect(disabled.cardFeeEnabled).toBe(0);
    // Never creates a second row for the same association.
    const rows = feeSettingsStore.filter((r) => r.associationId === "assoc-1");
    expect(rows.length).toBe(1);
  });

  it("preserves fields not supplied in a partial PATCH", async () => {
    await setAssociationFeeSettings("assoc-1", { cardFeeEnabled: true, cardFeePercentBps: 250 });
    const after = await setAssociationFeeSettings("assoc-1", { cardFeeFixedCents: 25 });
    expect(after.cardFeePercentBps).toBe(250); // untouched by the second call
    expect(after.cardFeeFixedCents).toBe(25);
    expect(after.cardFeeEnabled).toBe(1); // untouched
  });
});

describe("recordPlatformProcessingFee — idempotent booking, NEVER touches owner_ledger_entries", () => {
  it("books a fee the first time", async () => {
    const result = await recordPlatformProcessingFee({
      associationId: "assoc-1",
      unitId: "unit-1",
      personId: "person-1",
      amountCents: 610,
      stripePaymentIntentId: "pi_shared_123",
    });
    expect(result.created).toBe(true);
    expect(result.fee?.amountCents).toBe(610);
    expect(result.fee?.feeType).toBe("card_processing");
  });

  it("is a safe no-op on a duplicate delivery for the SAME payment_intent (webhook retry / double-submit)", async () => {
    const first = await recordPlatformProcessingFee({
      associationId: "assoc-1",
      amountCents: 610,
      stripePaymentIntentId: "pi_shared_123",
    });
    const second = await recordPlatformProcessingFee({
      associationId: "assoc-1",
      amountCents: 610,
      stripePaymentIntentId: "pi_shared_123",
    });
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.fee?.id).toBe(first.fee?.id);
    // Exactly ONE row for this payment_intent — never double-booked.
    const rows = platformFeesStore.filter((r) => r.stripePaymentIntentId === "pi_shared_123");
    expect(rows.length).toBe(1);
  });

  it("two DIFFERENT payment_intents both book (distinct fees are not deduped against each other)", async () => {
    const a = await recordPlatformProcessingFee({ associationId: "assoc-1", amountCents: 610, stripePaymentIntentId: "pi_AAA" });
    const b = await recordPlatformProcessingFee({ associationId: "assoc-1", amountCents: 610, stripePaymentIntentId: "pi_BBB" });
    expect(a.created).toBe(true);
    expect(b.created).toBe(true);
    expect(platformFeesStore.length).toBe(2);
  });

  it("returns a no-op for a non-positive amount (degenerate guard)", async () => {
    const result = await recordPlatformProcessingFee({
      associationId: "assoc-1",
      amountCents: 0,
      stripePaymentIntentId: "pi_zero",
    });
    expect(result.created).toBe(false);
    expect(platformFeesStore.length).toBe(0);
  });
});
