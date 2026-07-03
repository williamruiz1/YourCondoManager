/**
 * Recurring-charge run-history fixes (2026-06-30) — pure-logic tests.
 *
 * Covers the two William findings on the financials Run History table:
 *   - #4 status clarity: a bare "success" is ambiguous; the status must say
 *     WHAT happened (a charge was posted to the ledger, with the amount).
 *   - #5 unit column: must show address/building + unit, NOT a bare unit
 *     number, because duplicate unit numbers across buildings are ambiguous.
 */
import { describe, expect, it } from "vitest";
import { formatUnitLabel, runStatusMeta } from "./financial-recurring-charges";

const UNITS = [
  { id: "u-a1", unitNumber: "1", building: "Building A" },
  { id: "u-b1", unitNumber: "1", building: "Building B" },
  { id: "u-nob", unitNumber: "7", building: null },
  { id: "u-blank", unitNumber: "9", building: "   " },
];

describe("formatUnitLabel — full identifying location (William #5)", () => {
  it("disambiguates duplicate unit numbers across buildings", () => {
    // The exact ambiguity William hit: two "Unit 1"s in different buildings.
    expect(formatUnitLabel("u-a1", UNITS)).toBe("Building A · Unit 1");
    expect(formatUnitLabel("u-b1", UNITS)).toBe("Building B · Unit 1");
    expect(formatUnitLabel("u-a1", UNITS)).not.toBe(formatUnitLabel("u-b1", UNITS));
  });

  it("falls back to 'Unit <n>' when no building is set", () => {
    expect(formatUnitLabel("u-nob", UNITS)).toBe("Unit 7");
    expect(formatUnitLabel("u-blank", UNITS)).toBe("Unit 9"); // whitespace building ignored
  });

  it("renders 'All units' for a null unitId (association-wide run)", () => {
    expect(formatUnitLabel(null, UNITS)).toBe("All units");
    expect(formatUnitLabel(undefined, UNITS)).toBe("All units");
  });

  it("never renders a bare integer unit number for a known unit", () => {
    for (const u of UNITS) {
      const label = formatUnitLabel(u.id, UNITS);
      expect(label).not.toMatch(/^\d+$/); // no bare "1" / "7"
      expect(label).toContain("Unit ");
    }
  });

  it("degrades gracefully for an unknown unitId", () => {
    expect(formatUnitLabel("missing-id-xyz", UNITS)).toBe("Unit missing-…");
  });
});

describe("runStatusMeta — self-explanatory run status (William #4)", () => {
  it("a successful run says a charge was posted, with the amount", () => {
    const meta = runStatusMeta("success", 350);
    expect(meta.label).toBe("Charge posted · $350.00");
    expect(meta.label).not.toBe("Success"); // the ambiguous original
    expect(meta.label).not.toBe("success");
    expect(meta.title).toContain("posted to the owner's ledger");
    expect(meta.variant).toBe("default");
  });

  it("a failed run reads as a posting failure (not a bare status)", () => {
    const meta = runStatusMeta("failed", 350);
    expect(meta.label).toBe("Posting failed");
    expect(meta.variant).toBe("destructive");
  });

  it("pending / retrying / skipped each describe their state plainly", () => {
    expect(runStatusMeta("pending", 100).label).toBe("Queued to post");
    expect(runStatusMeta("retrying", 100).label).toBe("Retrying");
    expect(runStatusMeta("skipped", 100).label).toBe("Skipped (no charge)");
  });

  it("formats the amount to cents", () => {
    expect(runStatusMeta("success", 1234.5).label).toBe("Charge posted · $1234.50");
  });

  it("falls back safely for an unknown status", () => {
    const meta = runStatusMeta("weird-state", 50);
    expect(meta.label).toBe("weird-state");
    expect(meta.variant).toBe("outline");
  });
});
