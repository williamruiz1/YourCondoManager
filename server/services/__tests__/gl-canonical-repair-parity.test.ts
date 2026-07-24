import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { postOwnerLedgerEntry } from "../gl/posting";

const require = createRequire(import.meta.url);
const {
  accountKey,
  expectedLegsForLedgerRow,
  buildExpectedJournals,
  compareExpectedToActual,
} = require("../../../scripts/gl-canonical-repair.cjs") as {
  accountKey: (code: string, fund?: string) => string;
  expectedLegsForLedgerRow: (
    row: {
      id: string;
      entryType: string;
      amountCents: number;
      postedAt: Date;
      description: string | null;
    },
    accounts: Map<string, { id: string; accountCode: string; fund: string }>,
  ) => Array<{
    glAccountId: string;
    accountCode: string;
    fund: string;
    side: string;
    amountCents: number;
  }>;
  buildExpectedJournals: (
    rows: unknown[],
    accounts: Map<string, unknown>,
  ) => Map<string, { legs: unknown[] }>;
  compareExpectedToActual: (
    expected: Map<string, { legs: unknown[] }>,
    actual: unknown[],
  ) => {
    summary: {
      affectedJournalCount: number;
      unexpectedLegCount: number;
      missingLegCount: number;
      isExact: boolean;
    };
  };
};

const accounts = new Map(
  ["1010", "1200", "4000", "4200", "4900"].map((code) => [
    accountKey(code),
    { id: `account-${code}`, accountCode: code, fund: "operating" },
  ]),
);

describe("GL canonical repair script", () => {
  it.each([
    ["charge", 10000],
    ["late-fee", 2500],
    ["assessment", 50000],
    ["payment", -10000],
    ["credit", -5000],
    ["adjustment", 33000],
    ["adjustment", -33000],
  ])(
    "keeps %s operational mapping in parity with runtime posting",
    (entryType, amountCents) => {
      const row = {
        id: `${entryType}-${amountCents}`,
        entryType,
        amountCents,
        postedAt: new Date("2026-07-01T00:00:00Z"),
        description: null,
      };
      const runtime = postOwnerLedgerEntry({
        id: row.id,
        entryType: entryType as Parameters<typeof postOwnerLedgerEntry>[0]["entryType"],
        amount: amountCents / 100,
        postedAt: row.postedAt,
        description: row.description,
      });
      const operational = expectedLegsForLedgerRow(row, accounts).map(
        ({ accountCode, fund, side, amountCents: cents }) => ({
          accountCode,
          fund,
          side,
          amountCents: cents,
        }),
      );

      expect(operational).toEqual(runtime.legs);
    },
  );

  it("reports the assessment 4000+4200 three-leg failure as aggregate drift", () => {
    const row = {
      id: "assessment-aggregate-fixture",
      entryType: "assessment",
      amountCents: 100000,
      postedAt: new Date("2026-07-01T00:00:00Z"),
      description: null,
    };
    const expected = buildExpectedJournals([row], accounts);
    const canonicalLegs = expectedLegsForLedgerRow(row, accounts);
    const actual = [
      ...canonicalLegs.map((leg) => ({ ...leg, sourceId: row.id })),
      {
        sourceId: row.id,
        glAccountId: "account-4000",
        accountCode: "4000",
        fund: "operating",
        side: "credit",
        amountCents: 100000,
      },
    ];

    const comparison = compareExpectedToActual(expected, actual);

    expect(comparison.summary.affectedJournalCount).toBe(1);
    expect(comparison.summary.unexpectedLegCount).toBe(1);
    expect(comparison.summary.missingLegCount).toBe(0);
    expect(comparison.summary.isExact).toBe(false);
  });
});
