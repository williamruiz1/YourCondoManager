import { describe, expect, it } from "vitest";
import {
  compareCanonicalJournalShape,
  GlJournalShapeDriftError,
} from "../gl/canonical-shape";
import { postOwnerLedgerEntry, type JournalEntry } from "../gl/posting";

function persisted(
  sourceId: string,
  legs: JournalEntry["legs"],
): JournalEntry {
  return {
    journalId: `oln-${sourceId}`,
    sourceType: "owner_ledger_entry",
    sourceId,
    postedAt: new Date("2026-07-01T00:00:00Z"),
    description: "aggregate-only test fixture",
    legs,
  };
}

describe("canonical GL journal shape", () => {
  it("accepts a missing journal so additive sync can create it", () => {
    const expected = [
      postOwnerLedgerEntry({
        id: "assessment-1",
        entryType: "assessment",
        amount: 1000,
        postedAt: new Date("2026-07-01T00:00:00Z"),
      }),
    ];

    const result = compareCanonicalJournalShape(expected, []);

    expect(result.hasUnexpectedPersistedShape).toBe(false);
    expect(result.isExact).toBe(false);
    expect(result.missingJournalCount).toBe(1);
    expect(result.missingLegCount).toBe(2);
  });

  it("accepts an exact canonical assessment journal", () => {
    const journal = postOwnerLedgerEntry({
      id: "assessment-1",
      entryType: "assessment",
      amount: 1000,
      postedAt: new Date("2026-07-01T00:00:00Z"),
    });

    const result = compareCanonicalJournalShape([journal], [journal]);

    expect(result.isExact).toBe(true);
    expect(result.exactJournalCount).toBe(1);
    expect(result.unexpectedLegCount).toBe(0);
    expect(result.missingLegCount).toBe(0);
  });

  it("detects the legacy 4000 leg before 4200 can be appended", () => {
    const expected = postOwnerLedgerEntry({
      id: "assessment-1",
      entryType: "assessment",
      amount: 1000,
      postedAt: new Date("2026-07-01T00:00:00Z"),
    });
    const actual = persisted("assessment-1", [
      {
        accountCode: "1200",
        fund: "operating",
        side: "debit",
        amountCents: 100000,
      },
      {
        accountCode: "4000",
        fund: "operating",
        side: "credit",
        amountCents: 100000,
      },
    ]);

    const result = compareCanonicalJournalShape([expected], [actual]);

    expect(result.hasUnexpectedPersistedShape).toBe(true);
    expect(result.journalsWithUnexpectedLegs).toBe(1);
    expect(result.unexpectedLegCount).toBe(1);
    expect(result.missingLegCount).toBe(1);
    expect(() => {
      throw new GlJournalShapeDriftError(result);
    }).toThrow(/GL_JOURNAL_SHAPE_DRIFT/);
  });

  it("detects the live three-leg failure shape without exposing source ids", () => {
    const expected = postOwnerLedgerEntry({
      id: "private-source-id",
      entryType: "assessment",
      amount: 1000,
      postedAt: new Date("2026-07-01T00:00:00Z"),
    });
    const actual = persisted("private-source-id", [
      ...expected.legs,
      {
        accountCode: "4000",
        fund: "operating",
        side: "credit",
        amountCents: 100000,
      },
    ]);

    const result = compareCanonicalJournalShape([expected], [actual]);
    const error = new GlJournalShapeDriftError(result);

    expect(result.journalsWithUnexpectedLegs).toBe(1);
    expect(result.unexpectedLegCount).toBe(1);
    expect(error.message).not.toContain("private-source-id");
    expect(error.message).toContain("unexpected_legs=1");
  });

  it("uses multiset counts so duplicate legs cannot hide", () => {
    const expected = postOwnerLedgerEntry({
      id: "assessment-1",
      entryType: "assessment",
      amount: 1000,
      postedAt: new Date("2026-07-01T00:00:00Z"),
    });
    const actual = persisted("assessment-1", [
      ...expected.legs,
      expected.legs[1],
    ]);

    const result = compareCanonicalJournalShape([expected], [actual]);

    expect(result.hasUnexpectedPersistedShape).toBe(true);
    expect(result.unexpectedLegCount).toBe(1);
  });
});
