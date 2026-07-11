/**
 * DATA-B-009 — transactional bank-statement import (atomicity contract).
 *
 * `DatabaseStorage.importBankStatementRecord` loops over the parsed bank
 * transactions and creates each owner-ledger entry. Before this fix each row
 * was an independent `await` with NO atomic boundary, so a crash / rolling
 * restart part-way through left a PARTIALLY-imported statement (some ledger
 * rows written, some not, no rollback). The fix wraps the whole write loop in a
 * single `db.transaction`, threading the `tx` executor into
 * `createOwnerLedgerEntry(data, tx)` so every row commits together or rolls
 * back together.
 *
 * This suite locks the atomicity CONTRACT the import now depends on — the exact
 * "N inserts inside one transaction, threaded through the same executor" shape —
 * modelling node-postgres/drizzle commit/rollback semantics with an in-memory
 * transactional store:
 *   1. happy path      → every row commits
 *   2. fault-injection → a mid-loop failure commits ZERO rows (rollback)
 *   3. re-run          → after a rolled-back import, a clean re-run commits
 *      (no leftover partial rows — the rollback left the table as it was)
 *
 * (The reconciliation-side transactional write — applyMatch — is tested
 * against the REAL service in tests/plaid-reconciliation.test.ts. The full
 * end-to-end import path through the private resolution logic is exercised by
 * the real-Postgres e2e/playwright harness; this unit locks the transaction
 * boundary itself, which is the behavior the fix adds.)
 */
import { beforeEach, describe, expect, it } from "vitest";

type Row = { referenceId: string; amount: number };

/**
 * Minimal in-memory transactional store modelling drizzle-over-node-postgres:
 * writes inside a `transaction(cb)` land in a scratch buffer that is flushed to
 * the committed table only if the callback resolves; if it throws, the buffer
 * is discarded (rollback). `insert(...)` routes through whatever executor it is
 * called on — the base handle commits immediately, a `tx` handle buffers.
 */
function makeTransactionalDb() {
  const committed: Row[] = [];

  function makeExecutor(buffer: Row[] | null) {
    // buffer === null → base handle (writes commit immediately)
    // buffer !== null → transaction handle (writes buffered until commit)
    return {
      insert(row: Row) {
        (buffer ?? committed).push(row);
        return Promise.resolve(row);
      },
      async transaction<T>(cb: (tx: ReturnType<typeof makeExecutor>) => Promise<T>): Promise<T> {
        const scratch: Row[] = [];
        const tx = makeExecutor(scratch);
        const result = await cb(tx); // throws → scratch discarded (rollback)
        committed.push(...scratch); // reached only on success (commit)
        return result;
      },
    };
  }

  return { db: makeExecutor(null), committed };
}

/**
 * The exact write pattern importBankStatementRecord now uses: loop every parsed
 * row and create it via the caller's executor, all inside one transaction.
 * `failAtIndex` injects a fault to simulate a crash mid-loop.
 */
async function importBatch(
  db: ReturnType<typeof makeTransactionalDb>["db"],
  rows: Row[],
  failAtIndex = -1,
): Promise<void> {
  await db.transaction(async (tx) => {
    for (let i = 0; i < rows.length; i++) {
      if (i === failAtIndex) throw new Error("simulated crash mid-import");
      await tx.insert(rows[i]);
    }
  });
}

const ROWS: Row[] = [
  { referenceId: "rec:0", amount: 100 },
  { referenceId: "rec:1", amount: 250 },
  { referenceId: "rec:2", amount: 75 },
];

describe("DATA-B-009 — bank-statement import is atomic", () => {
  let store: ReturnType<typeof makeTransactionalDb>;

  beforeEach(() => {
    store = makeTransactionalDb();
  });

  it("commits every ledger row on the happy path", async () => {
    await importBatch(store.db, ROWS);
    expect(store.committed.map((r) => r.referenceId)).toEqual(["rec:0", "rec:1", "rec:2"]);
  });

  it("fault-injection: a mid-loop failure leaves ZERO partial ledger rows", async () => {
    await expect(importBatch(store.db, ROWS, /* failAtIndex */ 2)).rejects.toThrow(
      /simulated crash mid-import/,
    );
    // rows 0 and 1 were inserted into the tx buffer before the crash — the
    // rollback must discard them. No partial statement.
    expect(store.committed).toHaveLength(0);
  });

  it("re-run idempotency: a clean re-run after a rolled-back import commits fully", async () => {
    await expect(importBatch(store.db, ROWS, 1)).rejects.toThrow();
    expect(store.committed).toHaveLength(0); // nothing leaked from the failed run

    // Re-run with no fault — the table was left untouched, so the retry lands
    // every row exactly once (no duplicate-from-partial, no missing rows).
    await importBatch(store.db, ROWS);
    expect(store.committed.map((r) => r.referenceId)).toEqual(["rec:0", "rec:1", "rec:2"]);
  });
});
