/**
 * CT CGS §47-260 — Association records: retention engine + records-request
 * timing + copy fee + mandatory/permissive withholding. (founder-os#8017)
 *
 * Tests the PURE statutory functions in
 * server/services/records-retention-service.ts. No DB is touched (the service
 * imports only TYPES from @shared/schema), so no `../server/db` mock is needed —
 * same pattern as the §47-261e / §47-258 builds where statutory logic is pure.
 *
 * Continuity matrix → test mapping (every row has a passing assertion):
 *   §47-260(a)(5)  3yr financials/tax        → "retention: financial_statement / tax_return = 3 years"
 *   §47-260(a)(11) 1yr ballots/proxies/votes → "retention: ballot / proxy / voting_record = 1 year"
 *   §47-260(b)     response timing            → "computeResponseDueDate: receipt + 5 business days"
 *   §47-260(e)     reasonable copy fee        → "computeCopyFeeCents"
 *   §47-260(c)     mandatory withholding      → "mandatory-withhold record EXCLUDED"
 *   §47-260(d)     permissive withholding     → "permissive-withhold honored when set / included when not"
 *   workflow       request→fulfilled lifecycle→ "filterDisclosableRecords partitions full set"
 */

import { describe, it, expect } from "vitest";
import {
  RECORDS_RESPONSE_BUSINESS_DAYS,
  RECORDS_REQUEST_OWNER_NOTICE_DAYS,
  RECORD_RETENTION_YEARS,
  retentionPeriodYears,
  retentionExpiryDate,
  isRetentionExpired,
  addBusinessDays,
  computeResponseDueDate,
  computeCopyFeeCents,
  DEFAULT_COPY_FEE_PER_PAGE_CENTS,
  isRecordDisclosable,
  filterDisclosableRecords,
  computeIncludedFlag,
  type WithholdableRecord,
} from "../server/services/records-retention-service";

// ---------------------------------------------------------------------------
// §47-260(a)(5) — 3-year retention: financial statements + tax returns
// ---------------------------------------------------------------------------
describe("§47-260(a)(5) — 3-year retention: financial statements + tax returns", () => {
  it("retention period for financial_statement = 3 years", () => {
    expect(retentionPeriodYears("financial_statement")).toBe(3);
    expect(RECORD_RETENTION_YEARS.financial_statement).toBe(3);
  });

  it("retention period for tax_return = 3 years", () => {
    expect(retentionPeriodYears("tax_return")).toBe(3);
  });

  it("expiry = createdAt + 3 years (financial_statement)", () => {
    const created = new Date(Date.UTC(2024, 0, 15)); // 2024-01-15
    const expiry = retentionExpiryDate(created, "financial_statement");
    expect(expiry).not.toBeNull();
    expect(expiry!.getUTCFullYear()).toBe(2027);
    expect(expiry!.getUTCMonth()).toBe(0);
    expect(expiry!.getUTCDate()).toBe(15);
  });

  it("not expired before 3 years; expired at/after 3 years", () => {
    const created = new Date(Date.UTC(2024, 0, 15));
    expect(isRetentionExpired(created, "tax_return", new Date(Date.UTC(2026, 11, 31)))).toBe(false);
    expect(isRetentionExpired(created, "tax_return", new Date(Date.UTC(2027, 0, 15)))).toBe(true);
    expect(isRetentionExpired(created, "tax_return", new Date(Date.UTC(2028, 0, 1)))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// §47-260(a)(11) — 1-year retention: ballots + proxies + voting records
// ---------------------------------------------------------------------------
describe("§47-260(a)(11) — 1-year retention: ballots + proxies + voting records", () => {
  it("retention period for ballot / proxy / voting_record = 1 year", () => {
    expect(retentionPeriodYears("ballot")).toBe(1);
    expect(retentionPeriodYears("proxy")).toBe(1);
    expect(retentionPeriodYears("voting_record")).toBe(1);
  });

  it("expiry = createdAt + 1 year (ballot)", () => {
    const created = new Date(Date.UTC(2025, 5, 1)); // 2025-06-01
    const expiry = retentionExpiryDate(created, "ballot");
    expect(expiry).not.toBeNull();
    expect(expiry!.getUTCFullYear()).toBe(2026);
    expect(expiry!.getUTCMonth()).toBe(5);
    expect(expiry!.getUTCDate()).toBe(1);
  });

  it("ballot retention differs from financial 3yr (engine is per-record-type)", () => {
    expect(retentionPeriodYears("ballot")).not.toBe(retentionPeriodYears("financial_statement"));
  });

  it("non-statutory record types have no expiry (kept indefinitely)", () => {
    expect(retentionPeriodYears("meeting_minutes")).toBeNull();
    expect(retentionPeriodYears("owner_roster")).toBeNull();
    expect(retentionExpiryDate(new Date(), "meeting_minutes")).toBeNull();
    expect(isRetentionExpired(new Date(Date.UTC(1990, 0, 1)), "owner_roster", new Date())).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// §47-260(b) — records-request RESPONSE TIMING (VERIFIED: 5 business days)
// ---------------------------------------------------------------------------
describe("§47-260(b) — records-request response timing (5 business days, verified)", () => {
  it("the statutory constant is 5 business days", () => {
    expect(RECORDS_RESPONSE_BUSINESS_DAYS).toBe(5);
  });

  it("owner advance notice is 30 days (verified)", () => {
    expect(RECORDS_REQUEST_OWNER_NOTICE_DAYS).toBe(30);
  });

  it("computeResponseDueDate: Monday receipt + 5 business days = next Monday", () => {
    // 2026-06-01 is a Monday (UTC). +5 business days → 2026-06-08 (Monday).
    const monday = new Date(Date.UTC(2026, 5, 1));
    expect(monday.getUTCDay()).toBe(1); // sanity: Monday
    const due = computeResponseDueDate(monday);
    expect(due.getUTCFullYear()).toBe(2026);
    expect(due.getUTCMonth()).toBe(5);
    expect(due.getUTCDate()).toBe(8);
    expect(due.getUTCDay()).toBe(1); // Monday
  });

  it("addBusinessDays skips weekends: Thursday + 2 business days = Monday", () => {
    // 2026-06-04 is a Thursday. +2 business days → Fri (6/5), Mon (6/8).
    const thursday = new Date(Date.UTC(2026, 5, 4));
    expect(thursday.getUTCDay()).toBe(4);
    const due = addBusinessDays(thursday, 2);
    expect(due.getUTCDate()).toBe(8); // Monday, weekend skipped
    expect(due.getUTCDay()).toBe(1);
  });

  it("respects a configured business-day count (rule is testable on the value)", () => {
    const monday = new Date(Date.UTC(2026, 5, 1));
    const due3 = computeResponseDueDate(monday, 3); // Thursday 6/4
    expect(due3.getUTCDate()).toBe(4);
    expect(due3.getUTCDay()).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// §47-260(e) — reasonable COPY FEE
// ---------------------------------------------------------------------------
describe("§47-260(e) — reasonable copy fee calculation", () => {
  it("fee = pageCount × perPageCents", () => {
    expect(computeCopyFeeCents({ pageCount: 10, perPageCents: 25 })).toBe(250);
  });

  it("adds a supervision fee", () => {
    expect(computeCopyFeeCents({ pageCount: 4, perPageCents: 25, supervisionFeeCents: 1500 })).toBe(1600);
  });

  it("uses the default per-page rate when not provided", () => {
    expect(computeCopyFeeCents({ pageCount: 8 })).toBe(8 * DEFAULT_COPY_FEE_PER_PAGE_CENTS);
  });

  it("clamps negative / fractional inputs", () => {
    expect(computeCopyFeeCents({ pageCount: -5, perPageCents: 25 })).toBe(0);
    expect(computeCopyFeeCents({ pageCount: 3.9, perPageCents: 25 })).toBe(75); // 3 pages
  });

  it("zero pages → zero fee (with no supervision)", () => {
    expect(computeCopyFeeCents({ pageCount: 0 })).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// §47-260(c) — MANDATORY withholding (always excluded)
// ---------------------------------------------------------------------------
describe("§47-260(c) — mandatory withholding excludes records from owner response", () => {
  it("a mandatory record is never disclosable", () => {
    const personnel: WithholdableRecord = { label: "Personnel file", withholdingClass: "mandatory" };
    expect(isRecordDisclosable(personnel)).toBe(false);
    expect(computeIncludedFlag("mandatory")).toBe(0);
  });

  it("mandatory record is EXCLUDED from the disclosed set even if no permissive flag", () => {
    const records: WithholdableRecord[] = [
      { id: "1", label: "Operating budget", withholdingClass: "none" },
      { id: "2", label: "Salary records", withholdingClass: "mandatory" },
      { id: "3", label: "Unredacted ballots", withholdingClass: "mandatory" },
    ];
    const { disclosed, withheld } = filterDisclosableRecords(records);
    expect(disclosed.map((r) => r.id)).toEqual(["1"]);
    expect(withheld.map((w) => w.record.id)).toEqual(["2", "3"]);
    expect(withheld.every((w) => w.class === "mandatory")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// §47-260(d) — PERMISSIVE withholding (honored when set; included when not)
// ---------------------------------------------------------------------------
describe("§47-260(d) — permissive withholding is honored when elected, else disclosed", () => {
  it("permissive record is withheld ONLY when permissiveWithheld=true", () => {
    const withheldElected: WithholdableRecord = { label: "Active litigation", withholdingClass: "permissive", permissiveWithheld: true };
    const notElected: WithholdableRecord = { label: "Active litigation", withholdingClass: "permissive", permissiveWithheld: false };
    expect(isRecordDisclosable(withheldElected)).toBe(false);
    expect(isRecordDisclosable(notElected)).toBe(true);
    expect(computeIncludedFlag("permissive", true)).toBe(0);
    expect(computeIncludedFlag("permissive", false)).toBe(1);
    expect(computeIncludedFlag("permissive")).toBe(1); // default = not withheld → included
  });

  it("permissive honored vs included in a mixed set", () => {
    const records: WithholdableRecord[] = [
      { id: "a", withholdingClass: "permissive", permissiveWithheld: true },  // §47-260(d) elected → withheld
      { id: "b", withholdingClass: "permissive", permissiveWithheld: false }, // not elected → disclosed
      { id: "c", withholdingClass: "permissive" },                            // default → disclosed
    ];
    const { disclosed, withheld } = filterDisclosableRecords(records);
    expect(disclosed.map((r) => r.id).sort()).toEqual(["b", "c"]);
    expect(withheld.map((w) => w.record.id)).toEqual(["a"]);
    expect(withheld[0].class).toBe("permissive");
  });
});

// ---------------------------------------------------------------------------
// Workflow — full request → response partition (lifecycle integration)
// ---------------------------------------------------------------------------
describe("workflow — filterDisclosableRecords partitions a full candidate set (§47-260(c)+(d))", () => {
  it("disclosed = none + non-elected permissive; withheld = mandatory + elected permissive", () => {
    const records: WithholdableRecord[] = [
      { id: "fin", recordType: "financial_statement", withholdingClass: "none" },
      { id: "min", recordType: "meeting_minutes", withholdingClass: "none" },
      { id: "salary", recordType: "other", withholdingClass: "mandatory" },                 // §47-260(c)
      { id: "ballotraw", recordType: "ballot", withholdingClass: "mandatory" },             // §47-260(c)
      { id: "lit", recordType: "contract", withholdingClass: "permissive", permissiveWithheld: true }, // §47-260(d) elected
      { id: "negot", recordType: "contract", withholdingClass: "permissive" },              // §47-260(d) not elected
    ];
    const { disclosed, withheld } = filterDisclosableRecords(records);
    expect(disclosed.map((r) => r.id).sort()).toEqual(["fin", "min", "negot"]);
    expect(withheld.map((w) => w.record.id).sort()).toEqual(["ballotraw", "lit", "salary"]);

    const mandatory = withheld.filter((w) => w.class === "mandatory").map((w) => w.record.id).sort();
    const permissive = withheld.filter((w) => w.class === "permissive").map((w) => w.record.id);
    expect(mandatory).toEqual(["ballotraw", "salary"]);
    expect(permissive).toEqual(["lit"]);
  });

  it("empty candidate set → empty partitions", () => {
    const { disclosed, withheld } = filterDisclosableRecords([]);
    expect(disclosed).toEqual([]);
    expect(withheld).toEqual([]);
  });
});
