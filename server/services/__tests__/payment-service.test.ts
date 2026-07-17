/**
 * Unit tests for the pending/processing-payment visibility additions
 * (William, 2026-07-17: "The moment the platform has a submitted payment I
 * would like there to be a pending line item for the account managers and
 * owners to see so that they know it is processing.").
 *
 * Covers:
 *   - `PROCESSING_PAYMENT_STATUSES` — the single source of truth for "still
 *     processing" (shared by the owner balance-summary aggregate and both
 *     new pending-payment read paths).
 *   - `getOwnerPaymentHistory` — optional `statuses` filter narrows the
 *     WHERE clause, and the LEFT JOIN to `saved_payment_methods` surfaces
 *     `bankName`/`last4` when a linked saved method exists (null otherwise —
 *     never fabricated).
 *   - `getAdminPaymentTransactions` — the LEFT JOINs to `units`/`persons`/
 *     `saved_payment_methods` surface owner/unit/bank display context, and
 *     `statuses` takes precedence over the legacy single `status` filter.
 *
 * Follows the repo's mock-based in-memory-db test convention (CI runs with
 * no database — see server/services/__tests__/stripe-reconciliation.test.ts).
 * The fake `db` genuinely simulates equality LEFT JOINs (not just call
 * recording) so these tests prove the projected fields are correct, not
 * merely that the right methods were called.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Predicate-aware, join-simulating in-memory db fake ──────────────────────
// Each mocked table column access yields `{ _key, _table }` so a join
// condition `eq(a.col, b.col)` (both column refs) is distinguishable from a
// literal-value condition `eq(a.col, "foo")`.

type Row = Record<string, unknown>;
type ColRef = { _key: string; _table: string };
type Pred =
  | { kind: "eq"; key: string; table: string; val: unknown }
  | { kind: "eqCol"; leftKey: string; leftTable: string; rightKey: string; rightTable: string }
  | { kind: "in"; key: string; table: string; vals: unknown[] }
  | { kind: "and"; ps: Pred[] }
  | undefined;

function isColRef(v: unknown): v is ColRef {
  return Boolean(v) && typeof v === "object" && "_key" in (v as object) && "_table" in (v as object);
}

vi.mock("@shared/schema", () => {
  const makeTable = (name: string) =>
    new Proxy(
      { __name: name },
      {
        get(_t, prop) {
          if (prop === "__name") return name;
          if (typeof prop === "symbol") return undefined;
          return { _key: String(prop), _table: name };
        },
      },
    );
  return {
    paymentTransactions: makeTable("payment_transactions"),
    ownerLedgerEntries: makeTable("owner_ledger_entries"),
    savedPaymentMethods: makeTable("saved_payment_methods"),
    units: makeTable("units"),
    persons: makeTable("persons"),
  };
});

vi.mock("drizzle-orm", () => ({
  eq: (a: ColRef, b: unknown): Pred =>
    isColRef(b)
      ? { kind: "eqCol", leftKey: a._key, leftTable: a._table, rightKey: b._key, rightTable: b._table }
      : { kind: "eq", key: a._key, table: a._table, val: b },
  inArray: (col: ColRef, vals: unknown[]): Pred => ({ kind: "in", key: col._key, table: col._table, vals }),
  and: (...ps: Pred[]): Pred => ({ kind: "and", ps: ps.filter(Boolean) as Pred[] }),
  desc: () => ({}),
  sql: () => ({}),
  getTableColumns: (table: { __name: string }) => {
    // Only the columns this suite's rows actually carry — enough to prove
    // `...getTableColumns(paymentTransactions)` spreads real base-row data
    // through, without hand-maintaining the full ~30-column schema list.
    const cols = ["id", "associationId", "personId", "unitId", "status", "amountCents", "paymentMethodId", "createdAt"];
    return Object.fromEntries(cols.map((c) => [c, { _key: c, _table: table.__name }]));
  },
}));

import { paymentTransactions, savedPaymentMethods, units, persons } from "@shared/schema";

const store = new Map<string, Row[]>();

function tableName(t: unknown): string {
  return (t as { __name: string }).__name;
}

function rowsFor(table: unknown): Row[] {
  const name = tableName(table);
  let arr = store.get(name);
  if (!arr) {
    arr = [];
    store.set(name, arr);
  }
  return arr;
}

function matchesLiteral(row: Row, pred: Pred): boolean {
  if (!pred) return true;
  switch (pred.kind) {
    case "eq":
      return row[pred.key] === pred.val;
    case "in":
      return pred.vals.includes(row[pred.key]);
    case "and":
      return pred.ps.every((p) => matchesLiteral(row, p));
    case "eqCol":
      // Join predicates are resolved by the join step itself, not the base
      // WHERE filter — treat as always-true here (a WHERE clause never
      // legitimately carries a cross-table eqCol in this codebase's usage).
      return true;
    default:
      return true;
  }
}

vi.mock("../../db", () => {
  const db = {
    select(shape?: Record<string, ColRef>) {
      return {
        from(table: unknown) {
          const baseTable = tableName(table);
          const joins: Array<{ table: unknown; on: Pred }> = [];
          let wherePred: Pred;

          function resolveRows(): Promise<Row[]> {
            const base = rowsFor(table).filter((r) => matchesLiteral(r, wherePred));
            const joined = base.map((row) => {
              const merged: Row = { ...row };
              for (const j of joins) {
                const rightRows = rowsFor(j.table);
                const on = j.on;
                if (on?.kind === "eqCol") {
                  const leftVal = on.leftTable === baseTable ? row[on.leftKey] : merged[`__${on.leftTable}_${on.leftKey}`];
                  const match = rightRows.find((rr) => rr[on.rightKey] === leftVal);
                  if (match) {
                    for (const [k, v] of Object.entries(match)) {
                      merged[`__${tableName(j.table)}_${k}`] = v;
                    }
                  }
                }
              }
              // Apply the requested projection shape (if any), routing each
              // field to its origin table's value (base or joined-prefixed).
              if (shape) {
                const projected: Row = {};
                for (const [outKey, colRef] of Object.entries(shape)) {
                  projected[outKey] =
                    colRef._table === baseTable ? row[colRef._key] : merged[`__${colRef._table}_${colRef._key}`] ?? null;
                }
                return projected;
              }
              return merged;
            });
            return Promise.resolve(joined);
          }

          // One shared chainable object — every method mutates the closed-over
          // `joins`/`wherePred` and returns `chain` itself, so any call ORDER
          // the real query builder uses (leftJoin*, where, orderBy, limit,
          // offset, or a bare await) resolves against the SAME accumulated
          // state, then `then()` runs the join + filter + projection once.
          const chain: Record<string, unknown> = {
            leftJoin(joinTable: unknown, on: Pred) {
              joins.push({ table: joinTable, on });
              return chain;
            },
            where(pred: Pred) {
              wherePred = pred;
              return chain;
            },
            orderBy: () => chain,
            limit: () => chain,
            offset: () => chain,
            then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => resolveRows().then(res, rej),
          };
          return chain;
        },
      };
    },
  };
  return { db };
});

import { getOwnerPaymentHistory, getAdminPaymentTransactions, PROCESSING_PAYMENT_STATUSES } from "../payment-service";

beforeEach(() => {
  store.clear();
});

describe("PROCESSING_PAYMENT_STATUSES", () => {
  it("is exactly the two 'submitted, not settled' statuses", () => {
    expect(PROCESSING_PAYMENT_STATUSES).toEqual(["initiated", "pending"]);
  });
});

describe("getOwnerPaymentHistory", () => {
  const seed = () => {
    rowsFor(paymentTransactions).push(
      { id: "tx-1", associationId: "a-1", personId: "p-1", unitId: "u-1", status: "pending", amountCents: 33000, paymentMethodId: "pm-1", createdAt: "2026-07-14" },
      { id: "tx-2", associationId: "a-1", personId: "p-1", unitId: "u-1", status: "succeeded", amountCents: 10000, paymentMethodId: null, createdAt: "2026-07-01" },
      { id: "tx-3", associationId: "a-1", personId: "p-1", unitId: "u-1", status: "failed", amountCents: 5000, paymentMethodId: null, createdAt: "2026-07-15" },
    );
    rowsFor(savedPaymentMethods).push({ id: "pm-1", bankName: "Chase", last4: "3351" });
  };

  it("returns all statuses when `statuses` is omitted (unchanged existing behavior)", async () => {
    seed();
    const rows = await getOwnerPaymentHistory({ associationId: "a-1", personId: "p-1" });
    expect(rows).toHaveLength(3);
  });

  it("filters to only the given statuses when `statuses` is passed", async () => {
    seed();
    const rows = await getOwnerPaymentHistory({
      associationId: "a-1",
      personId: "p-1",
      statuses: PROCESSING_PAYMENT_STATUSES,
    });
    expect(rows.map((r) => r.id)).toEqual(["tx-1"]);
    expect(rows[0].status).toBe("pending");
  });

  it("resolves the bank hint via the linked saved payment method", async () => {
    seed();
    const rows = await getOwnerPaymentHistory({ associationId: "a-1", personId: "p-1", statuses: ["pending"] });
    expect(rows[0].bankName).toBe("Chase");
    expect(rows[0].last4).toBe("3351");
  });

  it("returns null bank hint (never fabricated) when there is no linked saved method", async () => {
    seed();
    const rows = await getOwnerPaymentHistory({ associationId: "a-1", personId: "p-1", statuses: ["failed"] });
    expect(rows[0].bankName).toBeNull();
    expect(rows[0].last4).toBeNull();
  });
});

describe("getAdminPaymentTransactions", () => {
  const seed = () => {
    rowsFor(paymentTransactions).push(
      { id: "tx-1", associationId: "a-1", personId: "p-1", unitId: "u-1", status: "pending", amountCents: 33000, paymentMethodId: null, createdAt: "2026-07-14" },
      { id: "tx-2", associationId: "a-1", personId: "p-2", unitId: "u-2", status: "succeeded", amountCents: 10000, paymentMethodId: null, createdAt: "2026-07-01" },
    );
    rowsFor(units).push(
      { id: "u-1", unitNumber: "4B", building: "Building A" },
      { id: "u-2", unitNumber: "2C", building: null },
    );
    rowsFor(persons).push(
      { id: "p-1", firstName: "William", lastName: "Ruiz" },
      { id: "p-2", firstName: "Jane", lastName: "Doe" },
    );
  };

  it("`statuses` (processing filter) takes precedence over the legacy single `status`", async () => {
    seed();
    const result = await getAdminPaymentTransactions({
      associationId: "a-1",
      status: "succeeded", // would return tx-2 alone if honored
      statuses: PROCESSING_PAYMENT_STATUSES, // should win — returns tx-1 alone
    });
    expect(result.transactions.map((t) => t.id)).toEqual(["tx-1"]);
  });

  it("resolves unit + owner display context via the LEFT JOINs", async () => {
    seed();
    const result = await getAdminPaymentTransactions({ associationId: "a-1" });
    const tx1 = result.transactions.find((t) => t.id === "tx-1")!;
    expect(tx1.unitNumber).toBe("4B");
    expect(tx1.building).toBe("Building A");
    expect(tx1.ownerFirstName).toBe("William");
    expect(tx1.ownerLastName).toBe("Ruiz");
  });

  it("returns null unit/owner fields gracefully when nothing joins (never throws)", async () => {
    rowsFor(paymentTransactions).push({ id: "tx-orphan", associationId: "a-1", personId: "p-missing", unitId: "u-missing", status: "pending", amountCents: 100, paymentMethodId: null, createdAt: "2026-07-14" });
    const result = await getAdminPaymentTransactions({ associationId: "a-1" });
    const orphan = result.transactions.find((t) => t.id === "tx-orphan")!;
    expect(orphan.unitNumber).toBeNull();
    expect(orphan.ownerFirstName).toBeNull();
  });
});
