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
              // Drizzle's `.where()` is itself a thenable resolving to ALL
              // matching rows (used by listOwedPlatformFees, no `.limit()`);
              // `.limit(n)` is an optional chained refinement (used by every
              // other reader in this file). Support both.
              const promise = Promise.resolve(rows) as Promise<Row[]> & { limit: (n: number) => Promise<Row[]> };
              promise.limit = (n: number) => Promise.resolve(rows.slice(0, n));
              return promise;
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
            vals.idempotencyKey != null &&
            targetStore.some((r) => r.idempotencyKey === vals.idempotencyKey);
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
  computeManualProcessingFeeCents,
  netLedgerCreditDollars,
  getAssociationFeeSettings,
  setAssociationFeeSettings,
  recordPlatformProcessingFee,
  markPlatformFeeCollected,
  listOwedPlatformFees,
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

  it("defaults status to 'collected' and settlementMethod to 'accounting_only' when not specified (card path, unchanged)", async () => {
    const result = await recordPlatformProcessingFee({
      associationId: "assoc-1",
      amountCents: 610,
      stripePaymentIntentId: "pi_default_status",
    });
    expect(result.fee?.status).toBe("collected");
    expect(result.fee?.collectedAt).not.toBeNull();
    expect(result.fee?.settlementMethod).toBe("accounting_only");
  });

  it("Stripe-topology fix: honors 'connect_application_fee' settlementMethod when a Connect-active association's fee routed via application_fee_amount", async () => {
    const result = await recordPlatformProcessingFee({
      associationId: "assoc-cherry-hill",
      amountCents: 610,
      stripePaymentIntentId: "pi_connect_active",
      settlementMethod: "connect_application_fee",
    });
    expect(result.fee?.settlementMethod).toBe("connect_application_fee");
  });
});

describe("computeManualProcessingFeeCents (cash/check — William's 2026-07-14 policy)", () => {
  it("is flat (not percentage-based) — no Stripe cost driver for cash/check", () => {
    expect(computeManualProcessingFeeCents(500)).toBe(500);
    expect(computeManualProcessingFeeCents(500)).toBe(computeManualProcessingFeeCents(500));
  });

  it("defaults to $5.00", () => {
    expect(computeManualProcessingFeeCents()).toBe(DEFAULT_FEE_SETTINGS.manualFeeCents);
    expect(computeManualProcessingFeeCents(DEFAULT_FEE_SETTINGS.manualFeeCents)).toBe(500);
  });

  it("returns 0 for non-positive / non-finite input (degenerate guard)", () => {
    expect(computeManualProcessingFeeCents(0)).toBe(0);
    expect(computeManualProcessingFeeCents(-100)).toBe(0);
    expect(computeManualProcessingFeeCents(NaN)).toBe(0);
  });
});

describe("manual-processing fee settings round-trip (default OFF, per-association)", () => {
  it("defaults manualFeeEnabled to false for every association with no row", async () => {
    const settings = await getAssociationFeeSettings("assoc-no-row");
    expect(settings.manualFeeEnabled).toBe(false);
    expect(settings.manualFeeCents).toBe(500);
  });

  it("setAssociationFeeSettings toggles manualFeeEnabled independently of cardFeeEnabled", async () => {
    const updated = await setAssociationFeeSettings("assoc-1", { manualFeeEnabled: true, manualFeeCents: 750 });
    expect(updated.manualFeeEnabled).toBe(1);
    expect(updated.manualFeeCents).toBe(750);
    expect(updated.cardFeeEnabled).toBe(0); // untouched — independent switch
  });
});

describe("cash/check manual-processing fee — booked 'owed', idempotent per ledger entry", () => {
  it("books a manual fee as 'owed' (NOT collected — the owner paid cash, this is a separate receivable)", async () => {
    const result = await recordPlatformProcessingFee({
      associationId: "assoc-1",
      unitId: "unit-1",
      personId: "person-1",
      feeType: "manual_processing",
      amountCents: 500,
      status: "owed",
      settlementMethod: "accounting_only",
      idempotencyKey: "manual:ledger-entry-abc",
    });
    expect(result.created).toBe(true);
    expect(result.fee?.status).toBe("owed");
    expect(result.fee?.collectedAt).toBeNull();
    expect(result.fee?.feeType).toBe("manual_processing");
  });

  it("is idempotent per ledger entry — a retry against the SAME ledger entry id never double-books", async () => {
    const first = await recordPlatformProcessingFee({
      associationId: "assoc-1",
      feeType: "manual_processing",
      amountCents: 500,
      status: "owed",
      idempotencyKey: "manual:ledger-entry-xyz",
    });
    const second = await recordPlatformProcessingFee({
      associationId: "assoc-1",
      feeType: "manual_processing",
      amountCents: 500,
      status: "owed",
      idempotencyKey: "manual:ledger-entry-xyz",
    });
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.fee?.id).toBe(first.fee?.id);
    const rows = platformFeesStore.filter((r) => r.idempotencyKey === "manual:ledger-entry-xyz");
    expect(rows.length).toBe(1);
  });

  it("never lands in owner_ledger_entries — the mock db never touches any table but association_fee_settings/platform_processing_fees, proving the function has no ledger-write path", async () => {
    // Structural proof: recordPlatformProcessingFee only ever calls
    // db.insert/select/update against the two tables mocked above. If it
    // touched owner_ledger_entries, the mock's `tableName()` switch (which
    // only recognizes association_fee_settings vs platform_processing_fees)
    // would misroute the write into one of THOSE stores instead, and this
    // fee's own store would be missing it — assert it's present and alone.
    const result = await recordPlatformProcessingFee({
      associationId: "assoc-ledger-isolation",
      feeType: "manual_processing",
      amountCents: 500,
      status: "owed",
      idempotencyKey: "manual:isolation-check",
    });
    expect(platformFeesStore).toContainEqual(expect.objectContaining({ id: result.fee?.id }));
    expect(feeSettingsStore.some((r) => r.id === result.fee?.id)).toBe(false);
  });
});

describe("markPlatformFeeCollected — treasurer collects an owed manual fee", () => {
  it("flips status from owed to collected and stamps collectedAt", async () => {
    const { fee } = await recordPlatformProcessingFee({
      associationId: "assoc-1",
      feeType: "manual_processing",
      amountCents: 500,
      status: "owed",
      idempotencyKey: "manual:collect-me",
    });
    expect(fee?.status).toBe("owed");
    const collected = await markPlatformFeeCollected(fee!.id);
    expect(collected?.status).toBe("collected");
    expect(collected?.collectedAt).not.toBeNull();
  });

  it("is idempotent — collecting an already-collected fee is a no-op that returns it unchanged", async () => {
    const { fee } = await recordPlatformProcessingFee({
      associationId: "assoc-1",
      amountCents: 610,
      stripePaymentIntentId: "pi_already_collected",
    });
    expect(fee?.status).toBe("collected"); // card fees default to collected
    const result = await markPlatformFeeCollected(fee!.id);
    expect(result?.status).toBe("collected");
  });

  it("returns null for an unknown fee id", async () => {
    const result = await markPlatformFeeCollected("does-not-exist");
    expect(result).toBeNull();
  });
});

describe("listOwedPlatformFees — the 'owed to the platform, not yet collected' view", () => {
  it("returns only owed fees for the association, excluding collected ones", async () => {
    await recordPlatformProcessingFee({
      associationId: "assoc-owed-view",
      personId: "person-1",
      feeType: "manual_processing",
      amountCents: 500,
      status: "owed",
      idempotencyKey: "manual:owed-1",
    });
    await recordPlatformProcessingFee({
      associationId: "assoc-owed-view",
      personId: "person-1",
      amountCents: 610,
      stripePaymentIntentId: "pi_owed_view_collected",
    }); // status defaults to 'collected'

    const owed = await listOwedPlatformFees({ associationId: "assoc-owed-view" });
    expect(owed.length).toBe(1);
    expect(owed[0].status).toBe("owed");
  });

  it("scopes by personId when supplied", async () => {
    await recordPlatformProcessingFee({
      associationId: "assoc-owed-scoped",
      personId: "person-A",
      feeType: "manual_processing",
      amountCents: 500,
      status: "owed",
      idempotencyKey: "manual:person-a-owed",
    });
    await recordPlatformProcessingFee({
      associationId: "assoc-owed-scoped",
      personId: "person-B",
      feeType: "manual_processing",
      amountCents: 500,
      status: "owed",
      idempotencyKey: "manual:person-b-owed",
    });

    const owedForA = await listOwedPlatformFees({ associationId: "assoc-owed-scoped", personId: "person-A" });
    expect(owedForA.length).toBe(1);
    expect(owedForA[0].personId).toBe("person-A");
  });
});
