/**
 * Unit tests for the Stripe payout reconciliation service (founder-os#970).
 *
 * Spec contracts exercised:
 *   §3.1 — charge metadata read-back (snake_case + legacy camelCase fallback)
 *   §4.1 — payout reconciliation math (gross - fee == net == bank deposit;
 *          zero variance) + idempotency (webhook retry → no duplicate writes)
 *
 * The pure functions (`extractChargeMetadata`, `summarizePayoutTransactions`)
 * need no I/O. The DB-touching functions run against a small in-memory fake
 * `db` keyed by table identity — enough to prove idempotency + the report
 * structure without a live Postgres (matching the repo's mock-based test
 * convention; CI runs with no database).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Predicate-aware in-memory db fake ────────────────────────────────────────
// We mock @shared/schema so each column access yields `{ _key: <jsKey> }`, and
// mock drizzle-orm's operators to produce inspectable predicate objects. The
// fake `db` then genuinely filters rows by predicate — enough to prove
// idempotency (existence-check by referenceId / chargeId) without a live DB.

type Row = Record<string, unknown>;
type Pred =
  | { kind: "eq"; key: string; val: unknown }
  | { kind: "in"; key: string; vals: unknown[] }
  | { kind: "and"; ps: Pred[] }
  | { kind: "desc"; key: string }
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
    ownerLedgerEntries: makeTable("owner_ledger_entries"),
    stripePayouts: makeTable("stripe_payouts"),
    stripePayoutItems: makeTable("stripe_payout_items"),
  };
});

vi.mock("drizzle-orm", () => ({
  eq: (col: { _key: string }, val: unknown): Pred => ({ kind: "eq", key: col?._key, val }),
  inArray: (col: { _key: string }, vals: unknown[]): Pred => ({ kind: "in", key: col?._key, vals }),
  and: (...ps: Pred[]): Pred => ({ kind: "and", ps: ps.filter(Boolean) as Pred[] }),
  desc: (col: { _key: string }): Pred => ({ kind: "desc", key: col?._key }),
  sql: () => ({}),
}));

import {
  ownerLedgerEntries,
  stripePayouts,
  stripePayoutItems,
} from "@shared/schema";

const store = new Map<unknown, Row[]>();
let idCounter = 0;
const nextId = (prefix: string) => `${prefix}-${++idCounter}`;

function rowsFor(table: unknown): Row[] {
  let arr = store.get(table);
  if (!arr) {
    arr = [];
    store.set(table, arr);
  }
  return arr;
}

function matches(row: Row, pred: Pred): boolean {
  if (!pred) return true;
  switch (pred.kind) {
    case "eq":
      return row[pred.key] === pred.val;
    case "in":
      return pred.vals.includes(row[pred.key]);
    case "and":
      return pred.ps.every((p) => matches(row, p));
    default:
      return true;
  }
}

vi.mock("../../db", () => {
  const db = {
    select(_cols?: unknown) {
      return {
        from(table: unknown) {
          const filtered = (pred: Pred) =>
            rowsFor(table)
              .filter((r) => matches(r, pred))
              .map((r) => ({ ...r }));
          return {
            where(pred: Pred) {
              const resolve = () => Promise.resolve(filtered(pred));
              return {
                limit: () => resolve(),
                orderBy: () => resolve(),
                then: (res: (v: Row[]) => unknown, rej?: (e: unknown) => unknown) => resolve().then(res, rej),
              };
            },
            // `.from(table).where(undefined)` is also reachable when the report
            // is called with no associationId filter.
            then: (res: (v: Row[]) => unknown) => Promise.resolve(filtered(undefined)).then(res),
            orderBy: () => Promise.resolve(filtered(undefined)),
          };
        },
      };
    },
    insert(table: unknown) {
      const arr = rowsFor(table);
      let stored: Row | null = null;
      // A-WEBHOOK-001/002 test support: onConflictDoNothing() sets `conflicted`
      // by mirroring the REAL partial unique index — a conflict iff another row
      // shares every `target` column's value AND (when a partial `where` was
      // supplied) every target column is non-null. Committed lazily at
      // returning()/bare-await time so the conflict check runs before the push
      // (previously `.values()` pushed immediately; no real code path awaits
      // without eventually reaching returning()/then(), so this is a no-op
      // reorder for every OTHER existing call site in this file).
      let conflicted = false;
      let committed = false;
      const commit = () => {
        if (!committed && !conflicted && stored) {
          arr.push(stored);
          committed = true;
        }
      };
      const obj: Record<string, unknown> = {
        values(v: Row) {
          stored = { ...v, id: (v.id as string) ?? nextId("row") };
          return obj;
        },
        onConflictDoNothing(config?: { target?: { _key: string }[]; where?: unknown }) {
          if (config?.target && stored) {
            const keys = config.target.map((c) => c._key);
            const keyVals = keys.map((k) => (stored as Row)[k]);
            const allNonNull = keyVals.every((v) => v != null);
            conflicted = config.where && !allNonNull
              ? false
              : arr.some((r) => keys.every((k) => r[k] === (stored as Row)[k]));
          }
          return obj;
        },
        returning: () => {
          commit();
          return Promise.resolve(conflicted ? [] : [stored]);
        },
        then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => {
          commit();
          return Promise.resolve(undefined).then(res, rej);
        },
      };
      return obj;
    },
    update(table: unknown) {
      const arr = rowsFor(table);
      let setVals: Row = {};
      const obj: Record<string, unknown> = {
        set(v: Row) {
          setVals = v;
          return obj;
        },
        where: (pred: Pred) => {
          for (const r of arr) if (matches(r, pred)) Object.assign(r, setVals);
          return Promise.resolve(undefined);
        },
      };
      return obj;
    },
  };
  return { db };
});

// Stripe API helpers are mocked per-test via these mutable fixtures.
let mockBalanceTxns: unknown[] = [];
let mockPayout: Record<string, unknown> = {};
vi.mock("../stripe-connect", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../stripe-connect")>();
  return {
    ...actual,
    getPlatformKeyMode: vi.fn(async () => "test" as const),
    listPayoutBalanceTransactions: vi.fn(async () => mockBalanceTxns),
    retrievePayout: vi.fn(async () => mockPayout),
  };
});

vi.mock("../../logger", () => ({ log: vi.fn(), debug: vi.fn() }));

import {
  extractChargeMetadata,
  summarizePayoutTransactions,
  writeLedgerEntryForCharge,
  writeReversalLedgerEntry,
  REFUND_REVERSAL_REFERENCE_TYPE,
  DISPUTE_REVERSAL_REFERENCE_TYPE,
  DISPUTE_FEE_REFERENCE_TYPE,
  reconcilePayout,
  getReconciliationReport,
  type PayoutTransactionSummary,
} from "../stripe-reconciliation";
import { postPaymentLedgerEntry } from "../ledger-payment-identity";

beforeEach(() => {
  store.clear();
  idCounter = 0;
  mockBalanceTxns = [];
  mockPayout = {};
});
afterEach(() => vi.clearAllMocks());

// ── §3.1 — metadata read-back ────────────────────────────────────────────────

describe("extractChargeMetadata (spec §3.1)", () => {
  it("reads the canonical snake_case keys", () => {
    const m = extractChargeMetadata({
      hoa_id: "asn_1",
      owner_id: "per_1",
      unit_id: "unt_1",
      ledger_entry_id: "led_1",
      charge_type: "dues",
      owner_name: "Jane Doe",
      unit_label: "1417 #3",
    });
    expect(m.associationId).toBe("asn_1");
    expect(m.personId).toBe("per_1");
    expect(m.unitId).toBe("unt_1");
    expect(m.ledgerEntryId).toBe("led_1");
    expect(m.chargeType).toBe("dues");
    expect(m.ownerName).toBe("Jane Doe");
    expect(m.unitLabel).toBe("1417 #3");
  });

  it("falls back to legacy camelCase keys (pre-#969 charges)", () => {
    const m = extractChargeMetadata({ associationId: "asn_2", personId: "per_2", unitId: "unt_2" });
    expect(m.associationId).toBe("asn_2");
    expect(m.personId).toBe("per_2");
    expect(m.unitId).toBe("unt_2");
  });

  it("returns nulls for missing / empty metadata", () => {
    expect(extractChargeMetadata(null).associationId).toBeNull();
    expect(extractChargeMetadata({}).personId).toBeNull();
    expect(extractChargeMetadata({ hoa_id: "  " }).associationId).toBeNull();
  });
});

// ── §4.1 — reconciliation math ───────────────────────────────────────────────

describe("summarizePayoutTransactions (spec §4.1 — money math)", () => {
  it("computes gross - fee == net over charge transactions", () => {
    const summary = summarizePayoutTransactions([
      { id: "txn_1", type: "charge", amount: 35000, fee: 1500, net: 33500, currency: "usd" },
      { id: "txn_2", type: "charge", amount: 20000, fee: 900, net: 19100, currency: "usd" },
    ]);
    expect(summary.grossAmountCents).toBe(55000);
    expect(summary.feeAmountCents).toBe(2400);
    expect(summary.netAmountCents).toBe(52600);
    expect(summary.chargeCount).toBe(2);
  });

  it("nets refunds (negative amounts) and excludes the payout line itself", () => {
    const summary = summarizePayoutTransactions([
      { id: "txn_1", type: "charge", amount: 35000, fee: 1500, net: 33500, currency: "usd" },
      { id: "txn_2", type: "refund", amount: -10000, fee: 0, net: -10000, currency: "usd" },
      { id: "po_bt", type: "payout", amount: -23500, fee: 0, net: -23500, currency: "usd" },
    ]);
    // gross = 35000 - 10000 = 25000; fee = 1500; net = 23500
    expect(summary.grossAmountCents).toBe(25000);
    expect(summary.feeAmountCents).toBe(1500);
    expect(summary.netAmountCents).toBe(23500);
    expect(summary.chargeCount).toBe(1);
  });

  it("net ties out to the payout amount (zero variance invariant)", () => {
    const txns = [
      { id: "txn_1", type: "charge", amount: 35000, fee: 1530, net: 33470, currency: "usd" },
      { id: "txn_2", type: "charge", amount: 15000, fee: 735, net: 14265, currency: "usd" },
    ];
    const summary: PayoutTransactionSummary = summarizePayoutTransactions(txns);
    const payoutNet = txns.reduce((s, t) => s + t.net, 0); // 47735
    expect(summary.netAmountCents).toBe(payoutNet);
  });
});

// ── §4.1 — Gap C idempotent ledger write ─────────────────────────────────────

describe("writeLedgerEntryForCharge (Gap C — idempotent)", () => {
  const meta = { hoa_id: "asn_1", owner_id: "per_1", unit_id: "unt_1", charge_type: "dues" };

  it("writes a negative-amount payment ledger entry on first call", async () => {
    const res = await writeLedgerEntryForCharge({
      chargeId: "ch_1",
      amountCents: 35000,
      metadata: meta,
      source: "charge.succeeded",
    });
    expect(res.created).toBe(true);
    expect(res.ledgerEntryId).toBeTruthy();
    const rows = rowsFor(ownerLedgerEntries);
    expect(rows).toHaveLength(1);
    expect(rows[0].amountCents).toBe(-35000); // integer cents, negative (reduces balance)
    expect(rows[0].entryType).toBe("payment");
    expect(rows[0].referenceType).toBe("stripe_charge");
    expect(rows[0].referenceId).toBe("ch_1");
  });

  it("does NOT write a duplicate on webhook retry (same charge)", async () => {
    const first = await writeLedgerEntryForCharge({
      chargeId: "ch_dup",
      amountCents: 35000,
      metadata: meta,
      source: "charge.succeeded",
    });
    const retry = await writeLedgerEntryForCharge({
      chargeId: "ch_dup",
      amountCents: 35000,
      metadata: meta,
      source: "charge.succeeded",
    });
    expect(first.created).toBe(true);
    expect(retry.created).toBe(false);
    expect(retry.skipped).toBe("already_exists");
    expect(rowsFor(ownerLedgerEntries)).toHaveLength(1); // still just one
  });

  it("skips (does not throw) when required metadata is missing", async () => {
    const res = await writeLedgerEntryForCharge({
      chargeId: "ch_legacy",
      amountCents: 1000,
      metadata: { foo: "bar" },
      source: "charge.succeeded",
    });
    expect(res.created).toBe(false);
    expect(res.skipped).toBe("missing_metadata");
    expect(rowsFor(ownerLedgerEntries)).toHaveLength(0);
  });

  it("skips non-positive amounts", async () => {
    const res = await writeLedgerEntryForCharge({
      chargeId: "ch_zero",
      amountCents: 0,
      metadata: meta,
      source: "charge.succeeded",
    });
    expect(res.created).toBe(false);
    expect(res.skipped).toBe("non_positive_amount");
  });
});

// ── A-WEBHOOK-001/002 — cross-path payment-identity idempotency ──────────────

describe("writeLedgerEntryForCharge — A-WEBHOOK-001/002 (founder-os#10737)", () => {
  const meta = { hoa_id: "asn_1", owner_id: "per_1", unit_id: "unt_1", charge_type: "dues" };

  it("per-HOA payment-webhook credit (postPaymentLedgerEntry) + platform stripe_charge for ONE charge → exactly one credit", async () => {
    // Simulates storage.processPaymentWebhookEvent already having posted this
    // payment via the per-HOA webhook path, keyed on the SAME payment_intent.
    const webhookWrite = await postPaymentLedgerEntry({
      associationId: "asn_1",
      unitId: "unt_1",
      personId: "per_1",
      amountCents: -35000,
      referenceType: "payment-webhook",
      referenceId: "webhook-event-row-1",
      paymentIdentityKey: "pi_SHARED_1",
      source: "payment-webhook",
    });
    expect(webhookWrite.created).toBe(true);

    // The platform Connect webhook then fires charge.succeeded for the SAME
    // charge/payment_intent — must be a no-op, not a second credit.
    const chargeWrite = await writeLedgerEntryForCharge({
      chargeId: "ch_shared_1",
      paymentIntentId: "pi_SHARED_1",
      amountCents: 35000,
      metadata: meta,
      source: "charge.succeeded",
    });

    expect(chargeWrite.created).toBe(false);
    expect(chargeWrite.skipped).toBe("already_exists");
    expect(chargeWrite.ledgerEntryId).toBe(webhookWrite.entry?.id);
    expect(rowsFor(ownerLedgerEntries)).toHaveLength(1);
  });

  it("concurrent duplicate charge.succeeded deliveries for the SAME charge → single ledger row", async () => {
    const [a, b] = await Promise.all([
      writeLedgerEntryForCharge({
        chargeId: "ch_concurrent",
        paymentIntentId: "pi_CONCURRENT",
        amountCents: 12000,
        metadata: meta,
        source: "charge.succeeded",
      }),
      writeLedgerEntryForCharge({
        chargeId: "ch_concurrent",
        paymentIntentId: "pi_CONCURRENT",
        amountCents: 12000,
        metadata: meta,
        source: "charge.succeeded",
      }),
    ]);
    const results = [a, b];
    expect(results.filter((r) => r.created)).toHaveLength(1);
    expect(results.filter((r) => !r.created)).toHaveLength(1);
    expect(rowsFor(ownerLedgerEntries)).toHaveLength(1);
  });

  it("payout.paid belt-and-suspenders after charge.succeeded (different chargeId, SAME payment_intent) → no second row", async () => {
    // charge.succeeded posts first, keyed on the charge id AND the PI.
    const first = await writeLedgerEntryForCharge({
      chargeId: "ch_belt_1",
      paymentIntentId: "pi_BELT",
      amountCents: 8000,
      metadata: meta,
      source: "charge.succeeded",
    });
    expect(first.created).toBe(true);

    // payout.paid's balance-transaction listing can resolve a DIFFERENT
    // Stripe object id for the same underlying charge in edge cases (e.g. a
    // balance-transaction id rather than the charge id) but the SAME PI —
    // the payment-identity key is what must catch this, not the charge id.
    const second = await writeLedgerEntryForCharge({
      chargeId: "ch_belt_1_alt_ref",
      paymentIntentId: "pi_BELT",
      amountCents: 8000,
      metadata: meta,
      source: "payout.paid",
    });
    expect(second.created).toBe(false);
    expect(second.skipped).toBe("already_exists");
    expect(second.ledgerEntryId).toBe(first.ledgerEntryId);
    expect(rowsFor(ownerLedgerEntries)).toHaveLength(1);
  });

  it("the conflict path resolves idempotently — never throws, never surfaces as a route-level 400", async () => {
    await writeLedgerEntryForCharge({
      chargeId: "ch_idem_1",
      paymentIntentId: "pi_IDEM",
      amountCents: 1000,
      metadata: meta,
      source: "charge.succeeded",
    });
    await expect(
      writeLedgerEntryForCharge({
        chargeId: "ch_idem_2",
        paymentIntentId: "pi_IDEM",
        amountCents: 1000,
        metadata: meta,
        source: "charge.succeeded",
      }),
    ).resolves.toEqual(expect.objectContaining({ created: false, skipped: "already_exists" }));
  });

  it("does not cross-collide two genuinely distinct payments for the same association", async () => {
    const a = await writeLedgerEntryForCharge({
      chargeId: "ch_distinct_a",
      paymentIntentId: "pi_DISTINCT_A",
      amountCents: 5000,
      metadata: meta,
      source: "charge.succeeded",
    });
    const b = await writeLedgerEntryForCharge({
      chargeId: "ch_distinct_b",
      paymentIntentId: "pi_DISTINCT_B",
      amountCents: 5000,
      metadata: meta,
      source: "charge.succeeded",
    });
    expect(a.created).toBe(true);
    expect(b.created).toBe(true);
    expect(rowsFor(ownerLedgerEntries)).toHaveLength(2);
  });
});

// ── A-RECON-006 — refund/dispute reversing ledger write ──────────────────────

describe("writeReversalLedgerEntry (A-RECON-006 — refund/dispute reversal)", () => {
  const meta = { hoa_id: "asn_1", owner_id: "per_1", unit_id: "unt_1", charge_type: "dues" };

  async function seedCharge(chargeId: string, amountCents = 35000) {
    return writeLedgerEntryForCharge({ chargeId, amountCents, metadata: meta, source: "charge.succeeded" });
  }

  it("posts a POSITIVE adjustment reversing the original payment, inheriting its FKs", async () => {
    await seedCharge("ch_1", 35000);
    const res = await writeReversalLedgerEntry({
      chargeId: "ch_1",
      reversalId: "re_1",
      referenceType: REFUND_REVERSAL_REFERENCE_TYPE,
      amountCents: 35000,
      source: "charge.refunded",
    });
    expect(res.created).toBe(true);
    const rows = rowsFor(ownerLedgerEntries);
    expect(rows).toHaveLength(2); // original payment + reversal
    const reversal = rows.find((r) => r.referenceType === REFUND_REVERSAL_REFERENCE_TYPE)!;
    expect(reversal.amountCents).toBe(35000); // POSITIVE — reverses the -35000 payment
    expect(reversal.entryType).toBe("adjustment");
    expect(reversal.referenceId).toBe("re_1");
    // FKs inherited from the original charge entry
    expect(reversal.associationId).toBe("asn_1");
    expect(reversal.unitId).toBe("unt_1");
    expect(reversal.personId).toBe("per_1");
  });

  it("partial refund posts a partial reversal", async () => {
    await seedCharge("ch_partial", 35000);
    const res = await writeReversalLedgerEntry({
      chargeId: "ch_partial",
      reversalId: "re_partial",
      referenceType: REFUND_REVERSAL_REFERENCE_TYPE,
      amountCents: 12000,
      source: "charge.refunded",
    });
    expect(res.created).toBe(true);
    const reversal = rowsFor(ownerLedgerEntries).find((r) => r.referenceId === "re_partial")!;
    expect(reversal.amountCents).toBe(12000); // +$120, not the full $350
  });

  it("is idempotent on a duplicate refund webhook (no double-reversal)", async () => {
    await seedCharge("ch_dup", 5000);
    const first = await writeReversalLedgerEntry({
      chargeId: "ch_dup",
      reversalId: "re_dup",
      referenceType: REFUND_REVERSAL_REFERENCE_TYPE,
      amountCents: 5000,
      source: "charge.refunded",
    });
    const retry = await writeReversalLedgerEntry({
      chargeId: "ch_dup",
      reversalId: "re_dup",
      referenceType: REFUND_REVERSAL_REFERENCE_TYPE,
      amountCents: 5000,
      source: "charge.refunded",
    });
    expect(first.created).toBe(true);
    expect(retry.created).toBe(false);
    expect(retry.skipped).toBe("already_exists");
    // one payment + exactly one reversal
    expect(rowsFor(ownerLedgerEntries).filter((r) => r.referenceId === "re_dup")).toHaveLength(1);
  });

  it("dispute lost posts a reversal AND a separate fee entry (both idempotent)", async () => {
    await seedCharge("ch_disp", 35000);
    const reversal = await writeReversalLedgerEntry({
      chargeId: "ch_disp",
      reversalId: "dp_1",
      referenceType: DISPUTE_REVERSAL_REFERENCE_TYPE,
      amountCents: 35000,
      source: "charge.dispute.closed",
    });
    const fee = await writeReversalLedgerEntry({
      chargeId: "ch_disp",
      reversalId: "dp_1",
      referenceType: DISPUTE_FEE_REFERENCE_TYPE,
      amountCents: 1500,
      source: "charge.dispute.closed",
    });
    expect(reversal.created).toBe(true);
    expect(fee.created).toBe(true);
    const rows = rowsFor(ownerLedgerEntries);
    expect(rows.find((r) => r.referenceType === DISPUTE_REVERSAL_REFERENCE_TYPE)!.amountCents).toBe(35000);
    expect(rows.find((r) => r.referenceType === DISPUTE_FEE_REFERENCE_TYPE)!.amountCents).toBe(1500);
    // dispute reversal + dispute fee share the dispute id but differ by referenceType,
    // so both post exactly once.
    expect(rows.filter((r) => r.referenceId === "dp_1")).toHaveLength(2);
  });

  it("skips safely when the original charge entry was never recorded (nothing to reverse)", async () => {
    const res = await writeReversalLedgerEntry({
      chargeId: "ch_unknown",
      reversalId: "re_unknown",
      referenceType: REFUND_REVERSAL_REFERENCE_TYPE,
      amountCents: 5000,
      source: "charge.refunded",
    });
    expect(res.created).toBe(false);
    expect(res.skipped).toBe("no_original_charge_entry");
    expect(rowsFor(ownerLedgerEntries)).toHaveLength(0);
  });

  it("skips non-positive reversal amounts", async () => {
    await seedCharge("ch_z", 35000);
    const res = await writeReversalLedgerEntry({
      chargeId: "ch_z",
      reversalId: "re_z",
      referenceType: REFUND_REVERSAL_REFERENCE_TYPE,
      amountCents: 0,
      source: "charge.refunded",
    });
    expect(res.created).toBe(false);
    expect(res.skipped).toBe("non_positive_amount");
  });
});

// ── §4.1 — payout reconciliation + report ────────────────────────────────────

describe("reconcilePayout + getReconciliationReport (spec §4.1)", () => {
  const charge = (id: string, owner: string, gross: number, fee: number) => ({
    id: `bt_${id}`,
    type: "charge" as const,
    amount: gross,
    fee,
    net: gross - fee,
    currency: "usd",
    source: {
      id,
      amount: gross,
      currency: "usd",
      payment_intent: `pi_${id}`,
      metadata: { hoa_id: "asn_1", owner_id: owner, unit_id: `unt_${owner}`, charge_type: "dues", owner_name: `Owner ${owner}` },
    },
  });

  it("reconciles a payout to per-owner ledger entries with zero variance", async () => {
    mockBalanceTxns = [charge("ch_a", "per_a", 35000, 1530), charge("ch_b", "per_b", 15000, 735)];
    const netTotal = 33470 + 14265; // 47735
    mockPayout = { id: "po_1", amount: netTotal, currency: "usd", status: "paid", arrival_date: 1779400000 };

    const result = await reconcilePayout({
      connectedAccountId: "acct_1",
      payoutId: "po_1",
      associationId: "asn_1",
      payout: mockPayout as never,
    });

    expect(result.chargeCount).toBe(2);
    expect(result.grossAmountCents).toBe(50000);
    expect(result.feeAmountCents).toBe(2265);
    expect(result.netAmountCents).toBe(47735);
    expect(result.varianceCents).toBe(0); // matches the bank deposit exactly
    expect(result.ledgerEntriesCreated).toBe(2);

    // Ledger entries written (Gap C subsumed) + payout items persisted.
    expect(rowsFor(ownerLedgerEntries)).toHaveLength(2);
    expect(rowsFor(stripePayouts)).toHaveLength(1);
    expect(rowsFor(stripePayoutItems)).toHaveLength(2);
  });

  it("is idempotent — re-running the same payout produces no duplicates", async () => {
    mockBalanceTxns = [charge("ch_a", "per_a", 35000, 1530)];
    mockPayout = { id: "po_2", amount: 33470, currency: "usd", status: "paid" };

    await reconcilePayout({ connectedAccountId: "acct_1", payoutId: "po_2", associationId: "asn_1", payout: mockPayout as never });
    const second = await reconcilePayout({ connectedAccountId: "acct_1", payoutId: "po_2", associationId: "asn_1", payout: mockPayout as never });

    expect(rowsFor(ownerLedgerEntries)).toHaveLength(1); // not 2
    expect(rowsFor(stripePayouts)).toHaveLength(1); // header upserted, not duplicated
    expect(rowsFor(stripePayoutItems)).toHaveLength(1); // item upserted, not duplicated
    expect(second.ledgerEntriesCreated).toBe(0); // nothing new written on retry
  });

  it("getReconciliationReport returns per-payout owner breakdown that sums to the deposit", async () => {
    mockBalanceTxns = [charge("ch_a", "per_a", 35000, 1530), charge("ch_b", "per_b", 15000, 735)];
    mockPayout = { id: "po_3", amount: 47735, currency: "usd", status: "paid", arrival_date: 1779400000 };
    await reconcilePayout({ connectedAccountId: "acct_1", payoutId: "po_3", associationId: "asn_1", payout: mockPayout as never });

    const report = await getReconciliationReport("asn_1");
    expect(report).toHaveLength(1);
    const payout = report[0];
    expect(payout.payoutId).toBe("po_3");
    expect(payout.owners).toHaveLength(2);
    const ownerNetSum = payout.owners.reduce((s, o) => s + o.netAmountCents, 0);
    expect(ownerNetSum).toBe(payout.reconciledNetCents);
    expect(payout.varianceCents).toBe(payout.payoutAmountCents - payout.reconciledNetCents);
    // Owners sorted gross desc — the $350 charge leads.
    expect(payout.owners[0].grossAmountCents).toBe(35000);
    expect(payout.owners.every((o) => o.reconciled)).toBe(true);
  });
});
