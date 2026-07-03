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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  units: [] as any[],
  aliases: [] as any[], // bank_descriptor_aliases (empty = no aliases in legacy tests)
  insertedEntries: [] as any[],
  updates: [] as UpdateCall[],
}));

vi.mock("../server/db", () => {
  const select = (cols?: any) => {
    let pending:
      | "credits"
      | "entries"
      | "persons"
      | "ownerships"
      | "units"
      | "ledgerLinks"
      | "aliases" = "credits";
    const filters: Array<(row: any) => boolean> = [];

    const exec = () => {
      let rows: any[];
      if (pending === "credits") rows = state.credits;
      else if (pending === "ledgerLinks") rows = state.entries;
      else if (pending === "persons") rows = state.persons;
      else if (pending === "ownerships") rows = state.ownerships;
      else if (pending === "units") rows = state.units;
      else if (pending === "aliases") rows = state.aliases;
      else rows = state.entries;
      return rows.filter((r) => filters.every((f) => f(r)));
    };

    return {
      from: (tableRef: any) => {
        const id = tableRef.__testTableId;
        if (id === "bank_transactions") pending = "credits";
        else if (id === "owner_ledger_entries") {
          // If cols is exactly `{ bankTransactionId }`, that's the linked-check
          // query; otherwise it's the full pending-entries pull.
          if (cols && Object.keys(cols).length === 1 && cols.bankTransactionId) {
            pending = "ledgerLinks";
          } else {
            pending = "entries";
          }
        } else if (id === "persons") pending = "persons";
        else if (id === "ownerships") pending = "ownerships";
        else if (id === "units") pending = "units";
        else if (id === "bank_descriptor_aliases") pending = "aliases";

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
    };
  };

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
      insert: (_t: any) => ({
        values: (row: any) => ({
          returning: (_cols?: any) => {
            const inserted = { ...row, id: `auto-${state.insertedEntries.length + 1}` };
            state.insertedEntries.push(inserted);
            state.entries.push(inserted);
            return Promise.resolve([inserted]);
          },
          // Support onConflictDoUpdate (used by upsertDescriptorAlias).
          onConflictDoUpdate: (_opts: any) => Promise.resolve(),
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
    isNotNull: (col: any) => (row: any) =>
      row[col.__testCol] !== null && row[col.__testCol] !== undefined,
    gte: (col: any, v: any) => (row: any) => row[col.__testCol] >= v,
    lte: (col: any, v: any) => (row: any) => row[col.__testCol] <= v,
    inArray: (col: any, vs: any[]) => (row: any) =>
      vs.includes(row[col.__testCol]),
    or: (...preds: any[]) => (row: any) => preds.some((p) => p(row)),
    and: (...preds: any[]) => (row: any) => preds.every((p) => p(row)),
    asc: (_c: any) => null,
    desc: (_c: any) => null,
    sql: (() => {
      const fn: any = () => null;
      fn.raw = () => null;
      return fn;
    })(),
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
      amountCents: col("amountCents"),
      name: col("name"),
      merchantName: col("merchantName"),
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
      firstName: col("firstName"),
      lastName: col("lastName"),
    },
    ownerships: {
      __testTableId: "ownerships",
      personId: col("personId"),
      unitId: col("unitId"),
    },
    units: {
      __testTableId: "units",
      id: col("id"),
      unitNumber: col("unitNumber"),
      associationId: col("associationId"),
    },
    bankDescriptorAliases: {
      __testTableId: "bank_descriptor_aliases",
      id: col("id"),
      associationId: col("associationId"),
      normalizedDescriptor: col("normalizedDescriptor"),
      personId: col("personId"),
      unitId: col("unitId"),
      matchCount: col("matchCount"),
      createdAt: col("createdAt"),
      updatedAt: col("updatedAt"),
    },
  };
});

// Now import the SUT.
import {
  runAutoMatch,
  scoreSuggestion,
  findOwnerSuggestionsForUnmatchedCredits,
  SUGGEST_AUTO_CREATE_THRESHOLD,
  SUGGEST_REVIEW_MIN_THRESHOLD,
} from "../server/services/reconciliation/auto-matcher";

const ASSOC = "assoc-test";

beforeEach(() => {
  state.credits = [];
  state.entries = [];
  state.ownerships = [];
  state.persons = [];
  state.units = [];
  state.aliases = []; // ensure no alias state bleeds between tests
  state.insertedEntries = [];
  state.updates = [];
});

describe("runAutoMatch — integration", () => {
  // These cases use fixed May-2026 transaction dates. `runAutoMatch` bounds the
  // candidate search to the last CREDIT_SEARCH_WINDOW_DAYS (30) of `Date.now()`,
  // so once the wall clock advances >30 days past the fixtures they fall out of
  // the window and every match silently returns empty (a "clock-bomb" flake
  // that turned CI red on 2026-06-30). Freeze the clock inside this block so the
  // window always contains the fixtures, keeping the cases deterministic
  // regardless of the real date. Scoped to this describe so the sibling
  // suggestions block keeps its own relative-date (`recentDate`) behavior.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-15T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

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

  // ── founder-os#2480 — expanded candidate set ─────────────────────────────
  // The auto-matcher now considers entry_type IN ('payment', 'credit'), not
  // just 'payment'. A bank credit matching an owner-credit ledger entry
  // (e.g. a refund recorded in the ledger) should auto-apply.
  it("auto-applies against an entry_type='credit' ledger entry (broadened candidate set)", async () => {
    state.credits = [
      {
        id: "btx-credit",
        associationId: ASSOC,
        amountCents: -25000,
        date: "2026-05-10",
        name: "REFUND TO WILLIAM RUIZ",
        merchantName: null,
        reconciledToPaymentTransactionId: null,
      },
    ];
    state.entries = [
      {
        id: "ole-credit",
        associationId: ASSOC,
        personId: "p-1",
        unitId: "u-1",
        entryType: "credit", // ← not 'payment'
        amount: -250,
        postedAt: new Date("2026-05-10"),
        description: null,
        bankTransactionId: null,
        settledAt: null,
        referenceType: null,
      },
    ];
    state.persons = [
      { id: "p-1", firstName: "William", lastName: "Ruiz", associationId: ASSOC },
    ];
    state.ownerships = [{ personId: "p-1", unitId: "u-1" }];
    state.units = [{ id: "u-1", unitNumber: "101", associationId: ASSOC }];

    const r = await runAutoMatch(ASSOC);

    expect(r.matched).toHaveLength(1);
    expect(r.matched[0]).toMatchObject({
      bankTransactionId: "btx-credit",
      ledgerEntryId: "ole-credit",
    });
  });
});

// ── founder-os#2480 — descriptor-to-owner suggestions ───────────────────────

describe("scoreSuggestion — confidence thresholds", () => {
  it("clears auto-create at exact-name + exact-balance (0.96)", () => {
    const r = scoreSuggestion({
      bankAmountAbsCents: 25000,
      bankDescription: "ZELLE FROM WILLIAM RUIZ",
      ownerFirstName: "William",
      ownerLastName: "Ruiz",
      ownerOpenBalanceCents: 25000, // exact
    });
    // exact name 0.60 + within $1 0.36 = 0.96
    expect(r.confidence).toBeCloseTo(0.96, 5);
    expect(r.confidence).toBeGreaterThanOrEqual(SUGGEST_AUTO_CREATE_THRESHOLD);
    expect(r.payorMatch).toBe("exact");
  });

  it("hits review band at exact-name + near-balance (0.90; below auto-create)", () => {
    const r = scoreSuggestion({
      bankAmountAbsCents: 25400, // off by $4
      bankDescription: "ZELLE FROM WILLIAM RUIZ",
      ownerFirstName: "William",
      ownerLastName: "Ruiz",
      ownerOpenBalanceCents: 25000,
    });
    // exact 0.60 + within $5 0.30 = 0.90 — review band (≥0.80, <0.95)
    expect(r.confidence).toBeCloseTo(0.90, 5);
    expect(r.confidence).toBeGreaterThanOrEqual(SUGGEST_REVIEW_MIN_THRESHOLD);
    expect(r.confidence).toBeLessThan(SUGGEST_AUTO_CREATE_THRESHOLD);
  });

  it("hits review-edge at exact-name + window-balance (0.80; bottom of review band)", () => {
    const r = scoreSuggestion({
      bankAmountAbsCents: 27000, // off by $20 — within $50 window
      bankDescription: "ZELLE FROM WILLIAM RUIZ",
      ownerFirstName: "William",
      ownerLastName: "Ruiz",
      ownerOpenBalanceCents: 25000,
    });
    // exact 0.60 + window 0.20 = 0.80
    expect(r.confidence).toBeCloseTo(0.80, 5);
    expect(r.confidence).toBeGreaterThanOrEqual(SUGGEST_REVIEW_MIN_THRESHOLD);
  });

  it("falls below review threshold for amount outside $50 window even with exact name", () => {
    const r = scoreSuggestion({
      bankAmountAbsCents: 31000, // off by $60 — outside window
      bankDescription: "ZELLE FROM WILLIAM RUIZ",
      ownerFirstName: "William",
      ownerLastName: "Ruiz",
      ownerOpenBalanceCents: 25000,
    });
    // exact 0.60 + 0 amount = 0.60 — below review
    expect(r.confidence).toBeCloseTo(0.60, 5);
    expect(r.confidence).toBeLessThan(SUGGEST_REVIEW_MIN_THRESHOLD);
  });

  it("falls below review threshold for partial-name match", () => {
    const r = scoreSuggestion({
      bankAmountAbsCents: 25000,
      bankDescription: "WIRE FROM RUIZ", // only last name
      ownerFirstName: "William",
      ownerLastName: "Ruiz",
      ownerOpenBalanceCents: 25000,
    });
    // partial 0.30 + exact $0 0.36 = 0.66
    expect(r.confidence).toBeCloseTo(0.66, 5);
    expect(r.confidence).toBeLessThan(SUGGEST_REVIEW_MIN_THRESHOLD);
    expect(r.payorMatch).toBe("partial");
  });

  it("descriptor format: 'WILLIAM RUIZ' → exact (full first+last)", () => {
    const r = scoreSuggestion({
      bankAmountAbsCents: 25000,
      bankDescription: "WILLIAM RUIZ",
      ownerFirstName: "William",
      ownerLastName: "Ruiz",
      ownerOpenBalanceCents: 25000,
    });
    expect(r.payorMatch).toBe("exact");
    expect(r.confidence).toBeGreaterThanOrEqual(SUGGEST_AUTO_CREATE_THRESHOLD);
  });

  it("descriptor format: 'RUIZ, W' → partial (only last name matches as token)", () => {
    const r = scoreSuggestion({
      bankAmountAbsCents: 25000,
      bankDescription: "RUIZ, W",
      ownerFirstName: "William",
      ownerLastName: "Ruiz",
      ownerOpenBalanceCents: 25000,
    });
    // Single-letter "W" token doesn't satisfy the >=2 char gate in
    // payorNameMatch, so only "ruiz" matches → partial.
    expect(r.payorMatch).toBe("partial");
  });

  it("descriptor format: 'william ruiz @ chase' → exact (lowercase, separators stripped)", () => {
    const r = scoreSuggestion({
      bankAmountAbsCents: 25000,
      bankDescription: "william ruiz @ chase",
      ownerFirstName: "William",
      ownerLastName: "Ruiz",
      ownerOpenBalanceCents: 25000,
    });
    expect(r.payorMatch).toBe("exact");
  });

  it("descriptor format: 'Wm Ruiz - PAYMENT' → partial (abbreviated first name doesn't match)", () => {
    const r = scoreSuggestion({
      bankAmountAbsCents: 25000,
      bankDescription: "Wm Ruiz - PAYMENT",
      ownerFirstName: "William",
      ownerLastName: "Ruiz",
      ownerOpenBalanceCents: 25000,
    });
    // "Wm" doesn't equal "william" — only "ruiz" matches as a whole token.
    expect(r.payorMatch).toBe("partial");
  });
});

describe("findOwnerSuggestionsForUnmatchedCredits — integration", () => {
  const recentDate = new Date(Date.now() - 5 * 86400 * 1000).toISOString().slice(0, 10);

  it("emits an 'auto-create' tier for exact name + exact balance, single owner", async () => {
    state.credits = [
      {
        id: "btx-suggest-A",
        associationId: ASSOC,
        amountCents: -25000,
        date: recentDate,
        name: "ZELLE FROM WILLIAM RUIZ",
        merchantName: null,
        reconciledToPaymentTransactionId: null,
      },
    ];
    // One outstanding charge of $250 → open balance = $250 = bank amount
    state.entries = [
      {
        id: "ole-charge",
        associationId: ASSOC,
        personId: "p-1",
        unitId: "u-1",
        entryType: "charge",
        amount: 250,
        postedAt: new Date(recentDate),
        description: null,
        bankTransactionId: null,
        settledAt: null,
        referenceType: null,
      },
    ];
    state.persons = [
      { id: "p-1", firstName: "William", lastName: "Ruiz", associationId: ASSOC },
    ];
    state.ownerships = [{ personId: "p-1", unitId: "u-1" }];
    state.units = [{ id: "u-1", unitNumber: "101", associationId: ASSOC }];

    const suggestions = await findOwnerSuggestionsForUnmatchedCredits(ASSOC);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].tier).toBe("auto-create");
    expect(suggestions[0].ownerCandidates).toHaveLength(1);
    expect(suggestions[0].ownerCandidates[0].personId).toBe("p-1");
    expect(suggestions[0].topConfidence).toBeGreaterThanOrEqual(
      SUGGEST_AUTO_CREATE_THRESHOLD,
    );
  });

  it("emits a 'review' tier when confidence sits between review and auto-create", async () => {
    state.credits = [
      {
        id: "btx-suggest-B",
        associationId: ASSOC,
        amountCents: -25400, // off by $4
        date: recentDate,
        name: "ZELLE FROM WILLIAM RUIZ",
        merchantName: null,
        reconciledToPaymentTransactionId: null,
      },
    ];
    state.entries = [
      {
        id: "ole-charge",
        associationId: ASSOC,
        personId: "p-1",
        unitId: "u-1",
        entryType: "charge",
        amount: 250,
        postedAt: new Date(recentDate),
        description: null,
        bankTransactionId: null,
        settledAt: null,
        referenceType: null,
      },
    ];
    state.persons = [
      { id: "p-1", firstName: "William", lastName: "Ruiz", associationId: ASSOC },
    ];
    state.ownerships = [{ personId: "p-1", unitId: "u-1" }];
    state.units = [{ id: "u-1", unitNumber: "101", associationId: ASSOC }];

    const suggestions = await findOwnerSuggestionsForUnmatchedCredits(ASSOC);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].tier).toBe("review");
    expect(suggestions[0].topConfidence).toBeLessThan(SUGGEST_AUTO_CREATE_THRESHOLD);
    expect(suggestions[0].topConfidence).toBeGreaterThanOrEqual(
      SUGGEST_REVIEW_MIN_THRESHOLD,
    );
  });

  it("emits 'ambiguous' tier with TWO same-last-name owners both above review — never auto-creates", async () => {
    // Both owners share last name "Ruiz" AND the descriptor includes a first
    // name that also matches BOTH (deliberately constructed to make both
    // owners clear the review threshold). The ambiguity gate must prevent
    // auto-creation even when individual scores are high.
    state.credits = [
      {
        id: "btx-ambig",
        associationId: ASSOC,
        amountCents: -25000,
        date: recentDate,
        // "Alex" full-name matches BOTH p-A (Alex Ruiz) and p-B (Alex Ruiz Jr.) —
        // we model this as two distinct persons with the same first+last name.
        name: "ZELLE FROM ALEX RUIZ",
        merchantName: null,
        reconciledToPaymentTransactionId: null,
      },
    ];
    // Both owners have $250 outstanding — balance equality alone can't disambiguate.
    state.entries = [
      {
        id: "ch-1",
        associationId: ASSOC,
        personId: "p-A",
        unitId: "u-1",
        entryType: "charge",
        amount: 250,
        postedAt: new Date(recentDate),
        description: null,
        bankTransactionId: null,
        settledAt: null,
        referenceType: null,
      },
      {
        id: "ch-2",
        associationId: ASSOC,
        personId: "p-B",
        unitId: "u-2",
        entryType: "charge",
        amount: 250,
        postedAt: new Date(recentDate),
        description: null,
        bankTransactionId: null,
        settledAt: null,
        referenceType: null,
      },
    ];
    state.persons = [
      { id: "p-A", firstName: "Alex", lastName: "Ruiz", associationId: ASSOC },
      { id: "p-B", firstName: "Alex", lastName: "Ruiz", associationId: ASSOC },
    ];
    state.ownerships = [
      { personId: "p-A", unitId: "u-1" },
      { personId: "p-B", unitId: "u-2" },
    ];
    state.units = [
      { id: "u-1", unitNumber: "101", associationId: ASSOC },
      { id: "u-2", unitNumber: "102", associationId: ASSOC },
    ];

    const suggestions = await findOwnerSuggestionsForUnmatchedCredits(ASSOC);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].tier).toBe("ambiguous");
    expect(suggestions[0].ownerCandidates.length).toBeGreaterThanOrEqual(2);
  });

  it("skips credits already linked to a ledger entry (no double-suggest)", async () => {
    state.credits = [
      {
        id: "btx-linked",
        associationId: ASSOC,
        amountCents: -25000,
        date: recentDate,
        name: "ZELLE FROM WILLIAM RUIZ",
        merchantName: null,
        reconciledToPaymentTransactionId: null,
      },
    ];
    state.entries = [
      {
        id: "ole-linked",
        associationId: ASSOC,
        personId: "p-1",
        unitId: "u-1",
        entryType: "payment",
        amount: -250,
        postedAt: new Date(recentDate),
        description: null,
        bankTransactionId: "btx-linked", // already linked
        settledAt: new Date(recentDate),
        referenceType: null,
      },
    ];
    state.persons = [
      { id: "p-1", firstName: "William", lastName: "Ruiz", associationId: ASSOC },
    ];
    state.ownerships = [{ personId: "p-1", unitId: "u-1" }];
    state.units = [{ id: "u-1", unitNumber: "101", associationId: ASSOC }];

    const suggestions = await findOwnerSuggestionsForUnmatchedCredits(ASSOC);

    expect(suggestions).toHaveLength(0);
  });

  it("does not surface when no name token appears in descriptor (no fingerprint)", async () => {
    state.credits = [
      {
        id: "btx-anon",
        associationId: ASSOC,
        amountCents: -25000,
        date: recentDate,
        name: "ACH DEPOSIT 1234567",
        merchantName: null,
        reconciledToPaymentTransactionId: null,
      },
    ];
    state.entries = [
      {
        id: "ole-charge",
        associationId: ASSOC,
        personId: "p-1",
        unitId: "u-1",
        entryType: "charge",
        amount: 250,
        postedAt: new Date(recentDate),
        description: null,
        bankTransactionId: null,
        settledAt: null,
        referenceType: null,
      },
    ];
    state.persons = [
      { id: "p-1", firstName: "William", lastName: "Ruiz", associationId: ASSOC },
    ];
    state.ownerships = [{ personId: "p-1", unitId: "u-1" }];
    state.units = [{ id: "u-1", unitNumber: "101", associationId: ASSOC }];

    const suggestions = await findOwnerSuggestionsForUnmatchedCredits(ASSOC);

    expect(suggestions).toHaveLength(0);
  });
});
