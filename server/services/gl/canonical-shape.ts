import type { JournalEntry } from "./posting";

export interface CanonicalJournalShapeComparison {
  expectedJournalCount: number;
  persistedJournalCount: number;
  exactJournalCount: number;
  journalsWithUnexpectedLegs: number;
  unexpectedSourceCount: number;
  unexpectedLegCount: number;
  missingJournalCount: number;
  missingLegCount: number;
  isExact: boolean;
  hasUnexpectedPersistedShape: boolean;
}

type LegCounts = Map<string, number>;

function sourceKey(journal: JournalEntry): string {
  return `${journal.sourceType}\u0000${journal.sourceId}`;
}

function legKey(leg: JournalEntry["legs"][number]): string {
  return [
    leg.accountCode,
    leg.fund,
    leg.side,
    String(leg.amountCents),
  ].join("\u0000");
}

function addLegs(target: LegCounts, journal: JournalEntry): void {
  for (const leg of journal.legs) {
    const key = legKey(leg);
    target.set(key, (target.get(key) ?? 0) + 1);
  }
}

function groupJournals(journals: JournalEntry[]): Map<string, LegCounts> {
  const grouped = new Map<string, LegCounts>();
  for (const journal of journals) {
    const key = sourceKey(journal);
    const legs = grouped.get(key) ?? new Map<string, number>();
    addLegs(legs, journal);
    grouped.set(key, legs);
  }
  return grouped;
}

function countDifference(left: LegCounts, right: LegCounts): number {
  let difference = 0;
  for (const [key, count] of left) {
    difference += Math.max(0, count - (right.get(key) ?? 0));
  }
  return difference;
}

/**
 * Compare persisted source journals with the journal shape produced by the
 * current canonical posting code.
 *
 * This is intentionally aggregate-only. It never returns source identifiers,
 * owner identifiers, descriptions, or payment data, so callers can safely use
 * the result in health signals and operational evidence.
 */
export function compareCanonicalJournalShape(
  expectedJournals: JournalEntry[],
  persistedJournals: JournalEntry[],
): CanonicalJournalShapeComparison {
  const expected = groupJournals(expectedJournals);
  const persisted = groupJournals(persistedJournals);

  let exactJournalCount = 0;
  let journalsWithUnexpectedLegs = 0;
  let unexpectedSourceCount = 0;
  let unexpectedLegCount = 0;
  let missingJournalCount = 0;
  let missingLegCount = 0;

  for (const [key, actualLegs] of persisted) {
    const expectedLegs = expected.get(key);
    if (!expectedLegs) {
      unexpectedSourceCount += 1;
      journalsWithUnexpectedLegs += 1;
      unexpectedLegCount += Array.from(actualLegs.values()).reduce(
        (sum, count) => sum + count,
        0,
      );
      continue;
    }

    const extras = countDifference(actualLegs, expectedLegs);
    const missing = countDifference(expectedLegs, actualLegs);
    if (extras > 0) {
      journalsWithUnexpectedLegs += 1;
      unexpectedLegCount += extras;
    }
    if (missing > 0) missingLegCount += missing;
    if (extras === 0 && missing === 0) exactJournalCount += 1;
  }

  for (const [key, expectedLegs] of expected) {
    if (persisted.has(key)) continue;
    missingJournalCount += 1;
    missingLegCount += Array.from(expectedLegs.values()).reduce(
      (sum, count) => sum + count,
      0,
    );
  }

  const hasUnexpectedPersistedShape =
    unexpectedSourceCount > 0 || unexpectedLegCount > 0;
  const isExact =
    !hasUnexpectedPersistedShape &&
    missingJournalCount === 0 &&
    missingLegCount === 0;

  return {
    expectedJournalCount: expected.size,
    persistedJournalCount: persisted.size,
    exactJournalCount,
    journalsWithUnexpectedLegs,
    unexpectedSourceCount,
    unexpectedLegCount,
    missingJournalCount,
    missingLegCount,
    isExact,
    hasUnexpectedPersistedShape,
  };
}

/**
 * Raised before a normal runtime sync can append a new leg to an obsolete
 * journal shape. The message carries aggregates only.
 */
export class GlJournalShapeDriftError extends Error {
  readonly comparison: CanonicalJournalShapeComparison;

  constructor(comparison: CanonicalJournalShapeComparison) {
    super(
      [
        "GL_JOURNAL_SHAPE_DRIFT",
        `journals_with_unexpected_legs=${comparison.journalsWithUnexpectedLegs}`,
        `unexpected_sources=${comparison.unexpectedSourceCount}`,
        `unexpected_legs=${comparison.unexpectedLegCount}`,
        "runtime sync refused; use the separately gated canonical repair workflow",
      ].join(" "),
    );
    this.name = "GlJournalShapeDriftError";
    this.comparison = comparison;
  }
}
