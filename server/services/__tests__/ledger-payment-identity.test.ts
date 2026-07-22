/**
 * Unit tests for the canonical payment-ledger writer
 * (server/services/ledger-payment-identity.ts) — founder-os#10737,
 * A-WEBHOOK-001 (critical) / A-WEBHOOK-002 (high).
 *
 * The fake `db` below enforces the SAME partial-unique-constraint semantics
 * as the real Postgres index added in migrations/0062_ledger_payment_identity.sql
 * (`owner_ledger_entries_payment_identity_uq`: UNIQUE(associationId, entryType,
 * paymentIdentityKey) WHERE paymentIdentityKey IS NOT NULL) — matching the
 * repo's existing mock-based test convention (see stripe-reconciliation.test.ts;
 * CI runs with no live database). This proves the application code correctly
 * relies on `INSERT ... ON CONFLICT ... DO NOTHING` for the cross-path /
 * concurrent-write guarantee rather than a check-then-insert race; the actual
 * ACID enforcement under real concurrent connections is Postgres' unique
 * index in production.
 *
 * Each test comments which REAL call site it models:
 *   - server/storage.ts processPaymentWebhookEvent (referenceType='payment-webhook')
 *   - server/routes.ts autopay-webhook block + server/routes/autopay.ts
 *     (referenceType='autopay_payment_transaction')
 *   - server/services/stripe-reconciliation.ts writeLedgerEntryForCharge
 *     (referenceType='stripe_charge') — see stripe-reconciliation.test.ts for
 *     the writeLedgerEntryForCharge-level tests exercising this indirectly.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Fake schema + drizzle-orm operators (predicate-aware, matches the repo's
//    existing convention in stripe-reconciliation.test.ts) ────────────────
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
  return { ownerLedgerEntries: makeTable("owner_ledger_entries") };
});

vi.mock("drizzle-orm", () => ({
  eq: (col: { _key: string }, val: unknown): Pred => ({ kind: "eq", key: col?._key, val }),
  and: (...ps: Pred[]): Pred => ({ kind: "and", ps: ps.filter(Boolean) as Pred[] }),
  // `sql` is only used to build the partial-index WHERE clause for
  // onConflictDoNothing's `where` option — the fake store doesn't need to
  // interpret it (it applies the SAME "key IS NOT NULL" rule unconditionally,
  // matching what the real partial index predicate does).
  sql: (..._args: unknown[]) => ({ __sql: true }),
}));

type Row = Record<string, unknown> & { id: string; associationId: string; entryType: string; paymentIdentityKey: string | null; referenceType: string; referenceId: string };

let store: Row[] = [];
let idCounter = 0;

function matches(row: Row, pred: Pred): boolean {
  if (!pred) return true;
  if (pred.kind === "eq") return (row as Record<string, unknown>)[pred.key] === pred.val;
  if (pred.kind === "and") return pred.ps.every((p) => matches(row, p));
  return true;
}

vi.mock("../../db", () => ({
  db: {
    select() {
      return {
        from() {
          return {
            where(pred: Pred) {
              return { limit: () => Promise.resolve(store.filter((r) => matches(r, pred))) };
            },
          };
        },
      };
    },
    insert() {
      let vals: Row;
      let conflict = false;
      const chain = {
        values(v: Record<string, unknown>) {
          vals = {
            ...v,
            amountCents:
              typeof v.amountCents === "number"
                ? v.amountCents
                : Math.round(Number(v.amount) * 100),
            id: (v.id as string) ?? `row-${++idCounter}`,
          } as Row;
          return chain;
        },
        // Mirrors the REAL partial unique index: a conflict occurs iff another
        // row shares (associationId, entryType, paymentIdentityKey) AND the
        // key is non-null — synchronous check against the in-memory store, no
        // `await` boundary between check and write, so a `Promise.all` of two
        // inserts against the SAME key is still deterministic here (proving
        // the CODE reaches for ON CONFLICT; real cross-connection concurrency
        // is Postgres' job in production).
        onConflictDoNothing(_config: unknown) {
          conflict =
            vals.paymentIdentityKey != null &&
            store.some(
              (r) =>
                r.associationId === vals.associationId
                && r.entryType === vals.entryType
                && r.paymentIdentityKey === vals.paymentIdentityKey,
            );
          return chain;
        },
        returning() {
          if (conflict) return Promise.resolve([]);
          store.push(vals);
          return Promise.resolve([vals]);
        },
      };
      return chain;
    },
  },
}));

import { postPaymentLedgerEntry } from "../ledger-payment-identity";

beforeEach(() => {
  store = [];
  idCounter = 0;
});

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    associationId: "assoc-1",
    unitId: "unit-1",
    personId: "person-1",
    amount: -100,
    referenceType: "payment-webhook",
    referenceId: "ref-1",
    paymentIdentityKey: "pi_shared_123",
    source: "test",
    ...overrides,
  };
}

describe("postPaymentLedgerEntry — A-WEBHOOK-001 (cross-path identity collision)", () => {
  it("models checkout.session.completed + payment_intent.succeeded for ONE PI → exactly one ledger credit", async () => {
    // processPaymentWebhookEvent posts referenceType='payment-webhook' with
    // referenceId=<paymentWebhookEvents row id> (DIFFERENT per Stripe event
    // id) but paymentIdentityKey=<gatewayReference> resolved to the SAME PI
    // for both checkout.session.completed and payment_intent.succeeded.
    const first = await postPaymentLedgerEntry(
      baseInput({ referenceId: "webhook-event-row-1", paymentIdentityKey: "pi_ABC123" }),
    );
    const second = await postPaymentLedgerEntry(
      baseInput({ referenceId: "webhook-event-row-2", paymentIdentityKey: "pi_ABC123" }),
    );

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.entry?.id).toBe(first.entry?.id);
    expect(store.filter((r) => r.paymentIdentityKey === "pi_ABC123")).toHaveLength(1);
  });

  it("models the per-HOA payment-webhook AND the platform stripe_charge writing for ONE charge → exactly one credit", async () => {
    // storage.processPaymentWebhookEvent (referenceType='payment-webhook')
    const webhook = await postPaymentLedgerEntry(
      baseInput({ referenceType: "payment-webhook", referenceId: "webhook-event-row-9", paymentIdentityKey: "pi_XYZ789" }),
    );
    // writeLedgerEntryForCharge (referenceType='stripe_charge') for the SAME
    // underlying payment_intent, via the platform Connect webhook.
    const charge = await postPaymentLedgerEntry(
      baseInput({ referenceType: "stripe_charge", referenceId: "ch_9", paymentIdentityKey: "pi_XYZ789" }),
    );

    expect(webhook.created).toBe(true);
    expect(charge.created).toBe(false);
    expect(charge.entry?.id).toBe(webhook.entry?.id);
    expect(store).toHaveLength(1);
  });

  it("models autopay's synchronous write racing/duplicating the webhook confirmation → exactly one credit", async () => {
    // server/routes/autopay.ts synchronous write (chargeResult.intentId).
    const sync = await postPaymentLedgerEntry(
      baseInput({ referenceType: "autopay_payment_transaction", referenceId: "txn-1", paymentIdentityKey: "pi_AUTOPAY_1" }),
    );
    // server/routes.ts webhook confirmation for the SAME transaction/PI.
    const webhook = await postPaymentLedgerEntry(
      baseInput({ referenceType: "autopay_payment_transaction", referenceId: "txn-1", paymentIdentityKey: "pi_AUTOPAY_1" }),
    );

    expect(sync.created).toBe(true);
    expect(webhook.created).toBe(false);
    expect(webhook.entry?.id).toBe(sync.entry?.id);
    expect(store).toHaveLength(1);
  });

  it("does NOT block two genuinely distinct payments (different payment_intent)", async () => {
    const a = await postPaymentLedgerEntry(baseInput({ referenceId: "ref-a", paymentIdentityKey: "pi_AAA" }));
    const b = await postPaymentLedgerEntry(baseInput({ referenceId: "ref-b", paymentIdentityKey: "pi_BBB" }));
    expect(a.created).toBe(true);
    expect(b.created).toBe(true);
    expect(store).toHaveLength(2);
  });

  it("scopes uniqueness per association — the SAME payment_intent id under two different associations is never expected in practice, but must not cross-block", async () => {
    const a = await postPaymentLedgerEntry(baseInput({ associationId: "assoc-1", referenceId: "ref-a", paymentIdentityKey: "pi_SHARED" }));
    const b = await postPaymentLedgerEntry(baseInput({ associationId: "assoc-2", referenceId: "ref-b", paymentIdentityKey: "pi_SHARED" }));
    expect(a.created).toBe(true);
    expect(b.created).toBe(true);
    expect(store).toHaveLength(2);
  });
});

describe("postPaymentLedgerEntry — A-WEBHOOK-002 (concurrent duplicate insert)", () => {
  it("concurrent duplicate delivery for the SAME payment_intent → single ledger row", async () => {
    const [r1, r2] = await Promise.all([
      postPaymentLedgerEntry(baseInput({ referenceId: "ref-race-1", paymentIdentityKey: "pi_RACE" })),
      postPaymentLedgerEntry(baseInput({ referenceId: "ref-race-2", paymentIdentityKey: "pi_RACE" })),
    ]);

    const results = [r1, r2];
    expect(results.filter((r) => r.created)).toHaveLength(1);
    expect(results.filter((r) => !r.created)).toHaveLength(1);
    // Both results resolve to the SAME entry id — whichever won the race.
    expect(r1.entry?.id).toBe(r2.entry?.id);
    expect(store).toHaveLength(1);
  });

  it("the conflict path resolves normally (never throws) — the idempotent-success contract routes rely on for a 200/201, never a 400/500", async () => {
    await postPaymentLedgerEntry(baseInput({ referenceId: "ref-1", paymentIdentityKey: "pi_IDEMPOTENT" }));
    await expect(
      postPaymentLedgerEntry(baseInput({ referenceId: "ref-2", paymentIdentityKey: "pi_IDEMPOTENT" })),
    ).resolves.toEqual(expect.objectContaining({ created: false, entry: expect.objectContaining({ id: expect.any(String) }) }));
  });
});

describe("postPaymentLedgerEntry — legacy/no-identity-key fallback (unchanged pre-fix behavior)", () => {
  it("falls back to (referenceType, referenceId) dedup when no payment identity key is available", async () => {
    const first = await postPaymentLedgerEntry(baseInput({ paymentIdentityKey: null, referenceId: "legacy-1" }));
    const retry = await postPaymentLedgerEntry(baseInput({ paymentIdentityKey: null, referenceId: "legacy-1" }));
    expect(first.created).toBe(true);
    expect(retry.created).toBe(false);
    expect(retry.entry?.id).toBe(first.entry?.id);
  });

  it("does not cross-protect two different references when no key is available (documented gap for legacy callers)", async () => {
    const a = await postPaymentLedgerEntry(baseInput({ paymentIdentityKey: null, referenceId: "legacy-a" }));
    const b = await postPaymentLedgerEntry(baseInput({ paymentIdentityKey: null, referenceId: "legacy-b" }));
    expect(a.created).toBe(true);
    expect(b.created).toBe(true);
  });
});
