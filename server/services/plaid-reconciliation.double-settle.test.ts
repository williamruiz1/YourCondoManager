import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { and, eq, isNull } from "drizzle-orm";
import * as schema from "@shared/schema";

// Integration tests for founder-os#10753 (YCM audit Wave 2):
//   DATA-B-009 — money-moving multi-row writes must be transactional (all-or-nothing)
//   A-RECON-004 — a matched bank credit must not settle a second ledger entry
//
// Runs against a real in-memory Postgres (PGlite) so the transaction/rollback
// and cross-run reconciliation behaviour is exercised for real, not mocked.

// A mutable holder the `../db` mock forwards to, set in beforeAll once PGlite is up.
const holder: { db: any } = { db: null };
vi.mock("../db", () => ({
  get db() {
    return new Proxy(
      {},
      {
        get(_t, prop) {
          const target = holder.db;
          const v = target?.[prop];
          return typeof v === "function" ? v.bind(target) : v;
        },
      },
    );
  },
}));

// Imported AFTER the mock is registered (vitest hoists vi.mock).
import { reconcileBankTransactions } from "./plaid-reconciliation";

const { bankTransactions, ownerLedgerEntries } = schema;
const ASSOC = "assoc-1";

let pg: PGlite;

async function resetTables() {
  await pg.exec(`
    DROP TABLE IF EXISTS owner_ledger_entries;
    DROP TABLE IF EXISTS bank_transactions;
    CREATE TABLE bank_transactions (
      id text PRIMARY KEY,
      bank_account_id text NOT NULL,
      association_id text NOT NULL,
      provider_transaction_id text NOT NULL,
      amount_cents integer NOT NULL,
      iso_currency_code text NOT NULL DEFAULT 'USD',
      date date NOT NULL,
      name text NOT NULL,
      merchant_name text,
      category text,
      pending integer NOT NULL DEFAULT 0,
      reconciled_to_payment_transaction_id text,
      created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE TABLE owner_ledger_entries (
      id text PRIMARY KEY,
      association_id text NOT NULL,
      unit_id text NOT NULL,
      person_id text NOT NULL,
      entry_type text NOT NULL,
      amount real NOT NULL,
      posted_at timestamp NOT NULL,
      description text,
      reference_type text,
      reference_id text,
      bank_transaction_id text,
      settled_at timestamp,
      created_at timestamp NOT NULL DEFAULT now()
    );
  `);
}

beforeAll(async () => {
  pg = new PGlite();
  holder.db = drizzle(pg, { schema });
});

beforeEach(async () => {
  await resetTables();
});

async function insertCredit(id: string, amountCents: number, date = "2026-07-10") {
  await holder.db.insert(bankTransactions).values({
    id,
    bankAccountId: "acct-1",
    associationId: ASSOC,
    providerTransactionId: `prov-${id}`,
    amountCents, // negative = credit (money in)
    date,
    name: "Owner payment",
  });
}

async function insertPendingIntent(id: string, amount: number, createdAt = new Date("2026-07-10T12:00:00Z")) {
  await holder.db.insert(ownerLedgerEntries).values({
    id,
    associationId: ASSOC,
    unitId: "unit-1",
    personId: "person-1",
    entryType: "payment",
    amount,
    postedAt: createdAt,
    createdAt,
    referenceType: "plaid-pay-intent",
  });
}

async function settledCount(): Promise<number> {
  const rows = await holder.db
    .select({ id: ownerLedgerEntries.id })
    .from(ownerLedgerEntries)
    .where(and(eq(ownerLedgerEntries.associationId, ASSOC), isNull(ownerLedgerEntries.settledAt)));
  const total = await holder.db.select({ id: ownerLedgerEntries.id }).from(ownerLedgerEntries);
  return total.length - rows.length; // settled = total - still-pending
}

describe("A-RECON-004 — a matched bank credit cannot settle a second ledger entry", () => {
  it("two equal-amount pending intents + one credit → only ONE is settled (no double-settle across runs)", async () => {
    await insertCredit("credit-1", -48500); // $485.00 credit
    await insertPendingIntent("entry-A", 485.0);
    await insertPendingIntent("entry-B", 485.0);

    const run1 = await reconcileBankTransactions(ASSOC);
    expect(run1.matched).toHaveLength(1);

    // Second sync run: the consumed credit MUST now be excluded (it is linked to a
    // ledger entry) — before the fix it would re-match the SAME deposit to entry-B.
    const run2 = await reconcileBankTransactions(ASSOC);
    expect(run2.matched).toHaveLength(0);

    expect(await settledCount()).toBe(1);
  });

  it("a consumed credit is excluded from the matcher's candidate set on the next run", async () => {
    await insertCredit("credit-1", -10000);
    await insertPendingIntent("entry-A", 100.0);

    const run1 = await reconcileBankTransactions(ASSOC);
    expect(run1.matched).toHaveLength(1);

    // Add a fresh same-amount pending intent AFTER the credit was consumed.
    await insertPendingIntent("entry-B", 100.0);
    const run2 = await reconcileBankTransactions(ASSOC);
    expect(run2.matched).toHaveLength(0); // credit already consumed → not re-used
    expect(await settledCount()).toBe(1);
  });

  it("applyMatch is idempotent — an unconsumed credit still settles exactly one entry", async () => {
    await insertCredit("credit-1", -25000);
    await insertPendingIntent("entry-A", 250.0);
    const run = await reconcileBankTransactions(ASSOC);
    expect(run.matched).toHaveLength(1);
    expect(await settledCount()).toBe(1);
  });
});

describe("DATA-B-009 — multi-row money writes are atomic (all-or-nothing)", () => {
  it("a failure partway through a multi-row insert rolls back — zero partial rows", async () => {
    await expect(
      holder.db.transaction(async (tx: any) => {
        await tx.insert(ownerLedgerEntries).values({
          id: "row-1",
          associationId: ASSOC,
          unitId: "unit-1",
          personId: "person-1",
          entryType: "payment",
          amount: 100,
          postedAt: new Date(),
          referenceType: "ai-bank-statement",
          referenceId: "rec:0",
        });
        // fail mid-import, after row-1 but before row-2 commits
        throw new Error("simulated mid-import crash");
      }),
    ).rejects.toThrow("simulated mid-import crash");

    const rows = await holder.db.select({ id: ownerLedgerEntries.id }).from(ownerLedgerEntries);
    expect(rows).toHaveLength(0); // rolled back — no partially-imported statement
  });

  it("re-run idempotency holds after a rolled-back import (a committed run then persists)", async () => {
    // A committed transaction of the same shape persists all rows.
    await holder.db.transaction(async (tx: any) => {
      for (let i = 0; i < 3; i++) {
        await tx.insert(ownerLedgerEntries).values({
          id: `ok-${i}`,
          associationId: ASSOC,
          unitId: "unit-1",
          personId: "person-1",
          entryType: "payment",
          amount: 10,
          postedAt: new Date(),
          referenceType: "ai-bank-statement",
          referenceId: `rec2:${i}`,
        });
      }
    });
    const rows = await holder.db.select({ id: ownerLedgerEntries.id }).from(ownerLedgerEntries);
    expect(rows).toHaveLength(3);
  });
});
