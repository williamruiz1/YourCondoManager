/**
 * founder-os#970 Gap C — Auto-matcher tests.
 *
 * The auto-matcher composes amount-exactness + date-proximity + payor-name
 * fuzzy match into a 0..1 confidence score and only auto-applies above
 * AUTO_MATCH_THRESHOLD (0.85). Below threshold, it surfaces the bank
 * transaction + scored candidates to the manual-review queue.
 *
 * The pure-function `scoreCandidate` + `payorNameMatch` are exercised
 * directly. `runAutoMatch` is exercised via a mocked drizzle layer (same
 * style as the existing plaid-reconciliation tests).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  scoreCandidate,
  payorNameMatch,
  AUTO_MATCH_THRESHOLD,
} from "../server/services/reconciliation/auto-matcher";

describe("auto-matcher payor-name fuzzy match", () => {
  it("matches full first+last → exact", () => {
    expect(payorNameMatch("ZELLE FROM WILLIAM RUIZ", "William", "Ruiz")).toBe("exact");
    expect(payorNameMatch("ach payment from william ruiz", "William", "Ruiz")).toBe("exact");
  });

  it("matches only last name → partial", () => {
    expect(payorNameMatch("WIRE FROM RUIZ", "William", "Ruiz")).toBe("partial");
  });

  it("matches only first name → partial", () => {
    // Whole tokens only — "WILLIAMS RUIZ" would match the "ruiz" token, not
    // "william" (no exact token "williams" present). Use a clean first-only
    // case instead.
    expect(payorNameMatch("PAYMENT FROM WILLIAM", "William", "Ruiz")).toBe("partial");
  });

  it("returns none for unrelated description", () => {
    expect(payorNameMatch("ACH DEPOSIT 12345", "William", "Ruiz")).toBe("none");
  });

  it("handles empty / null description gracefully", () => {
    expect(payorNameMatch(null, "W", "R")).toBe("none");
    expect(payorNameMatch("", "William", "Ruiz")).toBe("none");
  });
});

describe("auto-matcher scoreCandidate", () => {
  it("scores exact amount + same day + exact payor at maximum (clamped to 1.0)", () => {
    const r = scoreCandidate({
      bankAmountAbsCents: 25000,
      bankDate: new Date("2026-05-10"),
      bankDescription: "ZELLE FROM WILLIAM RUIZ",
      ledgerAmountAbsCents: 25000,
      ledgerPostedAt: new Date("2026-05-10"),
      ownerFirstName: "William",
      ownerLastName: "Ruiz",
    });
    // 0.55 + 0.20 + 0.25 = 1.00
    expect(r.confidence).toBe(1);
    expect(r.signals.amountDeltaCents).toBe(0);
    expect(r.signals.dateDeltaDays).toBe(0);
    expect(r.signals.payorMatch).toBe("exact");
  });

  it("scores exact amount + 3 days + no payor — below auto threshold", () => {
    const r = scoreCandidate({
      bankAmountAbsCents: 25000,
      bankDate: new Date("2026-05-10"),
      bankDescription: "ACH DEPOSIT",
      ledgerAmountAbsCents: 25000,
      ledgerPostedAt: new Date("2026-05-07"),
      ownerFirstName: "William",
      ownerLastName: "Ruiz",
    });
    // 0.55 + 0.10 + 0 = 0.65
    expect(r.confidence).toBeCloseTo(0.65, 5);
    expect(r.confidence).toBeLessThan(AUTO_MATCH_THRESHOLD);
  });

  it("clears auto threshold with exact amount + same day + partial payor", () => {
    const r = scoreCandidate({
      bankAmountAbsCents: 25000,
      bankDate: new Date("2026-05-10"),
      bankDescription: "WIRE FROM RUIZ",
      ledgerAmountAbsCents: 25000,
      ledgerPostedAt: new Date("2026-05-10"),
      ownerFirstName: "William",
      ownerLastName: "Ruiz",
    });
    // 0.55 + 0.20 + 0.10 = 0.85
    expect(r.confidence).toBeCloseTo(0.85, 5);
    expect(r.confidence).toBeGreaterThanOrEqual(AUTO_MATCH_THRESHOLD);
  });

  it("near-amount signal contributes 0.30, not 0.55", () => {
    const r = scoreCandidate({
      bankAmountAbsCents: 25055,
      bankDate: new Date("2026-05-10"),
      bankDescription: "FROM WILLIAM RUIZ",
      ledgerAmountAbsCents: 25000, // off by 55¢ — within ±$1
      ledgerPostedAt: new Date("2026-05-10"),
      ownerFirstName: "William",
      ownerLastName: "Ruiz",
    });
    // 0.30 + 0.20 + 0.25 = 0.75 — below threshold despite payor exact
    expect(r.confidence).toBeCloseTo(0.75, 5);
    expect(r.confidence).toBeLessThan(AUTO_MATCH_THRESHOLD);
  });

  it("amount off by > $1 contributes nothing — no auto-match path", () => {
    const r = scoreCandidate({
      bankAmountAbsCents: 30000,
      bankDate: new Date("2026-05-10"),
      bankDescription: "FROM WILLIAM RUIZ",
      ledgerAmountAbsCents: 25000, // off by $50
      ledgerPostedAt: new Date("2026-05-10"),
      ownerFirstName: "William",
      ownerLastName: "Ruiz",
    });
    // 0 + 0.20 + 0.25 = 0.45 — well below threshold
    expect(r.confidence).toBeCloseTo(0.45, 5);
    expect(r.confidence).toBeLessThan(AUTO_MATCH_THRESHOLD);
  });

  it("clamps confidence to [0, 1]", () => {
    const r = scoreCandidate({
      bankAmountAbsCents: 25000,
      bankDate: new Date("2026-05-10"),
      bankDescription: "ZELLE FROM WILLIAM RUIZ",
      ledgerAmountAbsCents: 25000,
      ledgerPostedAt: new Date("2026-05-10"),
      ownerFirstName: "William",
      ownerLastName: "Ruiz",
    });
    expect(r.confidence).toBeLessThanOrEqual(1);
    expect(r.confidence).toBeGreaterThanOrEqual(0);
  });

  it("handles missing owner-name gracefully (no payor signal)", () => {
    const r = scoreCandidate({
      bankAmountAbsCents: 25000,
      bankDate: new Date("2026-05-10"),
      bankDescription: "DEPOSIT",
      ledgerAmountAbsCents: 25000,
      ledgerPostedAt: new Date("2026-05-10"),
      ownerFirstName: null,
      ownerLastName: null,
    });
    // 0.55 + 0.20 + 0 = 0.75 (payor not eligible)
    expect(r.confidence).toBeCloseTo(0.75, 5);
    expect(r.signals.payorMatch).toBe("none");
  });
});

// ── Integration over the runAutoMatch query layer ───────────────────────────
// We mock drizzle exactly like tests/plaid-reconciliation.test.ts so the
// matcher is exercised end-to-end without a Postgres dependency.

type Credit = {
  id: string;
  associationId: string;
  amountCents: number;
  date: string;
  name: string;
  merchantName: string | null;
  reconciledToPaymentTransactionId: string | null;
};
type Entry = {
  id: string;
  associationId: string;
  personId: string;
  unitId: string;
  entryType: string;
  amount: number;
  postedAt: Date;
  description: string | null;
  bankTransactionId: string | null;
  settledAt: Date | null;
  referenceType: string | null;
};
type Person = {
  id: string;
  firstName: string;
  lastName: string;
  associationId: string | null;
};
type UpdateCall = {
  ledgerEntryId: string;
  bankTransactionId: string;
};

const state = vi.hoisted(() => ({
  credits: [] as any[],
  entries: [] as any[],
  ownerships: [] as any[],
  persons: [] as any[],
  updates: [] as UpdateCall[],
}));

vi.mock("../server/db", () => {
  let pending: "credits" | "entries" | "persons" | "ownerships" | "ledgerLinks" =
    "credits";
  let filters: Array<(row: any) => boolean> = [];

  const select = (cols?: any) => ({
    from: (tableRef: any) => {
      const id = tableRef.__testTableId;
      if (id === "bank_transactions") pending = "credits";
      else if (id === "owner_ledger_entries") {
        // If cols includes only `bankTransactionId`, that's the linked-check
        // query; otherwise it's the full pending-entries pull.
        if (cols && Object.keys(cols).length === 1 && cols.bankTransactionId) {
          pending = "ledgerLinks";
        } else {
          pending = "entries";
        }
      } else if (id === "persons") pending = "persons";
      else if (id === "ownerships") pending = "ownerships";
      filters = [];

      const exec = () => {
        let rows: any[];
        if (pending === "credits") rows = state.credits;
        else if (pending === "ledgerLinks") rows = state.entries;
        else if (pending === "persons") rows = state.persons;
        else if (pending === "ownerships") rows = state.ownerships;
        else rows = state.entries;
        return rows.filter((r) => filters.every((f) => f(r)));
      };

      const chain: any = {
        where: (f: any) => {
          filters.push(f);
          return chain;
        },
        innerJoin: (_t: any, _on: any) => chain,
        orderBy: (_o: unknown) => Promise.resolve(exec()),
        then: (resolve: any, reject?: any) =>
          Promise.resolve(exec()).then(resolve, reject),
      };
      return chain;
    },
  });

  return {
    db: {
      select,
      update: (_t: any) => ({
        set: (patch: any) => ({
          where: (filter: any) => {
            const targets = state.entries.filter(filter);
            for (const t of targets) {
              state.updates.push({
                ledgerEntryId: t.id,
                bankTransactionId: patch.bankTransactionId,
              });
              t.bankTransactionId = patch.bankTransactionId;
              t.settledAt = patch.settledAt;
            }
            return Promise.resolve();
          },
        }),
      }),
    },
  };
});

vi.mock("drizzle-orm", async (orig) => {
  const original = (await orig()) as Record<string, unknown>;
  return {
    ...original,
    eq: (col: any, v: any) => (row: any) => row[col.__testCol] === v,
    isNull: (col: any) => (row: any) =>
      row[col.__testCol] === null || row[col.__testCol] === undefined,
    and: (...preds: any[]) => (row: any) => preds.every((p) => p(row)),
    asc: (_c: any) => null,
    desc: (_c: any) => null,
  };
});

vi.mock("@shared/schema", () => {
  const col = (name: string) => ({ __testCol: name });
  return {
    bankTransactions: {
      __testTableId: "bank_transactions",
      id: col("id"),
      associationId: col("associationId"),
      reconciledToPaymentTransactionId: col("reconciledToPaymentTransactionId"),
      date: col("date"),
    },
    ownerLedgerEntries: {
      __testTableId: "owner_ledger_entries",
      id: col("id"),
      associationId: col("associationId"),
      personId: col("personId"),
      entryType: col("entryType"),
      settledAt: col("settledAt"),
      bankTransactionId: col("bankTransactionId"),
      amount: col("amount"),
      postedAt: col("postedAt"),
      referenceType: col("referenceType"),
      description: col("description"),
    },
    persons: {
      __testTableId: "persons",
      id: col("id"),
      associationId: col("associationId"),
    },
    ownerships: {
      __testTableId: "ownerships",
      personId: col("personId"),
    },
    units: { __testTableId: "units" },
  };
});

// Now import the SUT.
import { runAutoMatch } from "../server/services/reconciliation/auto-matcher";

const ASSOC = "assoc-test";

beforeEach(() => {
  state.credits = [];
  state.entries = [];
  state.ownerships = [];
  state.persons = [];
  state.updates = [];
});

describe("runAutoMatch — integration", () => {
  it("auto-applies a high-confidence match (exact amount + same day + exact payor)", async () => {
    state.credits = [
      {
        id: "btx-A",
        associationId: ASSOC,
        amountCents: -25000,
        date: "2026-05-10",
        name: "ZELLE FROM WILLIAM RUIZ",
        merchantName: null,
        reconciledToPaymentTransactionId: null,
      },
    ];
    state.entries = [
      {
        id: "ole-A",
        associationId: ASSOC,
        personId: "p-1",
        unitId: "u-1",
        entryType: "payment",
        amount: -250,
        postedAt: new Date("2026-05-10"),
        description: null,
        bankTransactionId: null,
        settledAt: null,
        referenceType: null,
      },
    ];
    state.persons = [{ id: "p-1", firstName: "William", lastName: "Ruiz", associationId: ASSOC }];
    state.ownerships = [{ personId: "p-1" }];

    const r = await runAutoMatch(ASSOC);

    expect(r.matched).toHaveLength(1);
    expect(r.matched[0]).toMatchObject({
      bankTransactionId: "btx-A",
      ledgerEntryId: "ole-A",
    });
    expect(r.matched[0].confidence).toBeGreaterThanOrEqual(AUTO_MATCH_THRESHOLD);
    expect(state.updates).toHaveLength(1);
  });

  it("leaves low-confidence in needsManualReview, not matched", async () => {
    state.credits = [
      {
        id: "btx-B",
        associationId: ASSOC,
        amountCents: -25000,
        date: "2026-05-10",
        name: "ACH DEPOSIT XYZ",
        merchantName: null,
        reconciledToPaymentTransactionId: null,
      },
    ];
    state.entries = [
      {
        id: "ole-B",
        associationId: ASSOC,
        personId: "p-1",
        unitId: "u-1",
        entryType: "payment",
        amount: -250,
        postedAt: new Date("2026-05-04"), // 6 days delta — only date>3, no payor
        description: null,
        bankTransactionId: null,
        settledAt: null,
        referenceType: null,
      },
    ];
    state.persons = [{ id: "p-1", firstName: "William", lastName: "Ruiz", associationId: ASSOC }];
    state.ownerships = [{ personId: "p-1" }];

    const r = await runAutoMatch(ASSOC);

    expect(r.matched).toHaveLength(0);
    expect(state.updates).toHaveLength(0);
    expect(r.needsManualReview).toHaveLength(1);
    expect(r.needsManualReview[0].bankTransactionId).toBe("btx-B");
    expect(r.needsManualReview[0].reason).toBe("low-confidence");
  });

  it("flags ambiguous when two entries tie above threshold", async () => {
    state.credits = [
      {
        id: "btx-C",
        associationId: ASSOC,
        amountCents: -25000,
        date: "2026-05-10",
        name: "ACH DEPOSIT",
        merchantName: null,
        reconciledToPaymentTransactionId: null,
      },
    ];
    state.entries = [
      {
        id: "ole-C1",
        associationId: ASSOC,
        personId: "p-1",
        unitId: "u-1",
        entryType: "payment",
        amount: -250,
        postedAt: new Date("2026-05-10"),
        description: null,
        bankTransactionId: null,
        settledAt: null,
        referenceType: null,
      },
      {
        id: "ole-C2",
        associationId: ASSOC,
        personId: "p-2",
        unitId: "u-2",
        entryType: "payment",
        amount: -250,
        postedAt: new Date("2026-05-10"),
        description: null,
        bankTransactionId: null,
        settledAt: null,
        referenceType: null,
      },
    ];
    state.persons = [
      { id: "p-1", firstName: "Alpha", lastName: "Person", associationId: ASSOC },
      { id: "p-2", firstName: "Beta", lastName: "Person", associationId: ASSOC },
    ];
    state.ownerships = [{ personId: "p-1" }, { personId: "p-2" }];

    const r = await runAutoMatch(ASSOC);

    // Two identical-confidence candidates → ambiguous → no auto-apply.
    expect(r.matched).toHaveLength(0);
    expect(state.updates).toHaveLength(0);
    expect(r.needsManualReview.length).toBeGreaterThanOrEqual(1);
    const reviewedRow = r.needsManualReview.find((r) => r.bankTransactionId === "btx-C");
    expect(reviewedRow).toBeDefined();
  });

  it("is idempotent — running twice produces the same matched set", async () => {
    state.credits = [
      {
        id: "btx-D",
        associationId: ASSOC,
        amountCents: -25000,
        date: "2026-05-10",
        name: "ZELLE FROM WILLIAM RUIZ",
        merchantName: null,
        reconciledToPaymentTransactionId: null,
      },
    ];
    state.entries = [
      {
        id: "ole-D",
        associationId: ASSOC,
        personId: "p-1",
        unitId: "u-1",
        entryType: "payment",
        amount: -250,
        postedAt: new Date("2026-05-10"),
        description: null,
        bankTransactionId: null,
        settledAt: null,
        referenceType: null,
      },
    ];
    state.persons = [{ id: "p-1", firstName: "William", lastName: "Ruiz", associationId: ASSOC }];
    state.ownerships = [{ personId: "p-1" }];

    const a = await runAutoMatch(ASSOC);
    expect(a.matched).toHaveLength(1);
    const updatesAfterFirst = state.updates.length;

    const b = await runAutoMatch(ASSOC);
    // Second run shouldn't re-match — the entry is now settled.
    expect(b.matched).toHaveLength(0);
    expect(state.updates.length).toBe(updatesAfterFirst);
  });

  it("excludes credits already linked to a ledger entry", async () => {
    state.credits = [
      {
        id: "btx-E",
        associationId: ASSOC,
        amountCents: -25000,
        date: "2026-05-10",
        name: "ZELLE FROM WILLIAM RUIZ",
        merchantName: null,
        reconciledToPaymentTransactionId: null,
      },
    ];
    state.entries = [
      {
        // Already linked to btx-E from a prior run
        id: "ole-prior",
        associationId: ASSOC,
        personId: "p-1",
        unitId: "u-1",
        entryType: "payment",
        amount: -250,
        postedAt: new Date("2026-05-10"),
        description: null,
        bankTransactionId: "btx-E",
        settledAt: new Date("2026-05-10"),
        referenceType: null,
      },
      {
        id: "ole-other",
        associationId: ASSOC,
        personId: "p-1",
        unitId: "u-1",
        entryType: "payment",
        amount: -250,
        postedAt: new Date("2026-05-10"),
        description: null,
        bankTransactionId: null,
        settledAt: null,
        referenceType: null,
      },
    ];
    state.persons = [{ id: "p-1", firstName: "William", lastName: "Ruiz", associationId: ASSOC }];
    state.ownerships = [{ personId: "p-1" }];

    const r = await runAutoMatch(ASSOC);
    // The credit is already linked; no fresh match should occur on it
    expect(r.matched).toHaveLength(0);
  });
});
