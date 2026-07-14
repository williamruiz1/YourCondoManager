/**
 * Phase 1 (P0-1 + P0-3) — Unit-Centric Ledger + Unique Payment Reference.
 *
 * Exercises the NEW pure functions that back the additive matcher paths:
 *   - findReferenceInDescriptor / normalizeRef  (P0-3 Tier-0 reference match)
 *   - assembleRoster / rosterNameMatch / normalizeRosterName / isOwnershipActive
 *                                               (P0-1 unit payer roster + any-name match)
 *   - scoreCandidate with the optional `rosterMatch` signal (P0-1 unit-roster scoring)
 *
 * All pure — no DB. The DB-backed orchestration (`runAutoMatch`,
 * `buildUnitAccountStatement`, `loadUnitPayerRoster`) is flag-gated and
 * exercised in integration; the reference + roster LOGIC that decides matches
 * is proven here.
 *
 * The flag-off backward-compat contract is proven by `scoreCandidate` returning
 * byte-for-byte identical confidence when `rosterMatch` is omitted (the pre-
 * Phase-1 single-owner path).
 */
import { describe, expect, it } from "vitest";
import {
  findReferenceInDescriptor,
  normalizeRef,
  scoreCandidate,
  AUTO_MATCH_THRESHOLD,
  MIN_REF_LEN,
} from "../server/services/reconciliation/auto-matcher";
import {
  assembleRoster,
  rosterNameMatch,
  normalizeRosterName,
  isOwnershipActive,
} from "../server/services/unit-payer-roster";

// ── P0-3: unique per-unit reference detection ─────────────────────────────────

describe("Phase 1 P0-3 — normalizeRef", () => {
  it("strips separators + lowercases to an alphanumeric key", () => {
    expect(normalizeRef("CHC-0007")).toBe("chc0007");
    expect(normalizeRef("Ref: CHC 0007")).toBe("refchc0007");
    expect(normalizeRef("chc_0007")).toBe("chc0007");
  });
  it("handles null / empty gracefully", () => {
    expect(normalizeRef(null)).toBe("");
    expect(normalizeRef(undefined)).toBe("");
    expect(normalizeRef("")).toBe("");
  });
});

describe("Phase 1 P0-3 — findReferenceInDescriptor (Tier-0 exact reference match)", () => {
  const refs = [
    { ref: "CHC-0007", unitId: "unit-7" },
    { ref: "CHC-0012", unitId: "unit-12" },
  ];

  it("resolves the unit when the ref appears verbatim in the descriptor", () => {
    const hit = findReferenceInDescriptor("ZELLE FROM J DOE CHC-0007 DUES", refs);
    expect(hit).not.toBeNull();
    expect(hit!.unitId).toBe("unit-7");
  });

  it("is normalization-tolerant (spaces / case / separators)", () => {
    expect(findReferenceInDescriptor("ach chc 0007", refs)!.unitId).toBe("unit-7");
    expect(findReferenceInDescriptor("REF:chc0007", refs)!.unitId).toBe("unit-7");
    expect(findReferenceInDescriptor("payment Chc-0012 june", refs)!.unitId).toBe("unit-12");
  });

  it("returns null when no known ref appears", () => {
    expect(findReferenceInDescriptor("ZELLE FROM J DOE JUNE DUES", refs)).toBeNull();
    expect(findReferenceInDescriptor("chc-9999", refs)).toBeNull();
  });

  it("returns null for empty descriptor / empty ref list", () => {
    expect(findReferenceInDescriptor(null, refs)).toBeNull();
    expect(findReferenceInDescriptor("chc-0007", [])).toBeNull();
  });

  it("ignores refs shorter than MIN_REF_LEN (noise guard)", () => {
    const shortRefs = [{ ref: "A", unitId: "u-a" }];
    expect(MIN_REF_LEN).toBeGreaterThanOrEqual(3);
    expect(findReferenceInDescriptor("payment a", shortRefs)).toBeNull();
  });

  it("prefers the longest matching ref when refs overlap", () => {
    const overlapping = [
      { ref: "CHC-0007", unitId: "unit-7" },
      { ref: "CHC-00070", unitId: "unit-70" },
    ];
    // "chc00070" contains both "chc0007" and "chc00070"; longest wins.
    expect(findReferenceInDescriptor("pay CHC-00070", overlapping)!.unitId).toBe("unit-70");
  });
});

// ── P0-1: unit payer roster ───────────────────────────────────────────────────

describe("Phase 1 P0-1 — normalizeRosterName matches the descriptor normalization", () => {
  it("lowercases + strips punctuation + collapses whitespace", () => {
    expect(normalizeRosterName("O'Brien")).toBe("o brien");
    expect(normalizeRosterName("  William   Ruiz ")).toBe("william ruiz");
  });
});

describe("Phase 1 P0-1 — isOwnershipActive", () => {
  const asOf = new Date("2026-07-01");
  it("active when window covers asOf", () => {
    expect(isOwnershipActive({ startDate: new Date("2026-01-01"), endDate: null }, asOf)).toBe(true);
    expect(
      isOwnershipActive({ startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31") }, asOf),
    ).toBe(true);
  });
  it("inactive before start or after end", () => {
    expect(isOwnershipActive({ startDate: new Date("2026-08-01"), endDate: null }, asOf)).toBe(false);
    expect(
      isOwnershipActive({ startDate: new Date("2020-01-01"), endDate: new Date("2025-01-01") }, asOf),
    ).toBe(false);
  });
});

describe("Phase 1 P0-1 — assembleRoster (co-owner aggregation + primary contact)", () => {
  const owners = [
    { personId: "p-jane", firstName: "Jane", lastName: "Doe", ownershipPercentage: 50, startDate: new Date("2022-03-01"), endDate: null },
    { personId: "p-john", firstName: "John", lastName: "Doe", ownershipPercentage: 50, startDate: new Date("2020-01-01"), endDate: null },
  ];

  it("aggregates every co-owner into the matchable roster", () => {
    const r = assembleRoster({
      unitId: "u1", unitNumber: "7", unitAccountRef: "CHC-0007",
      activeOwnerships: owners, explicitPrimaryPersonId: null,
    });
    expect(r.members.map((m) => m.personId).sort()).toEqual(["p-jane", "p-john"]);
    expect(r.members.every((m) => m.normalizedName.length > 0)).toBe(true);
  });

  it("honors an explicit primary contact", () => {
    const r = assembleRoster({
      unitId: "u1", unitNumber: "7", unitAccountRef: null,
      activeOwnerships: owners, explicitPrimaryPersonId: "p-jane",
    });
    expect(r.primaryContactPersonId).toBe("p-jane");
    expect(r.members[0].personId).toBe("p-jane"); // primary sorts first
    expect(r.members.find((m) => m.personId === "p-jane")!.isPrimaryContact).toBe(true);
    expect(r.members.find((m) => m.personId === "p-john")!.isPrimaryContact).toBe(false);
  });

  it("falls back to earliest-startDate active owner when no explicit primary", () => {
    const r = assembleRoster({
      unitId: "u1", unitNumber: "7", unitAccountRef: null,
      activeOwnerships: owners, explicitPrimaryPersonId: null,
    });
    // John's ownership started 2020 (earlier) → John is the fallback primary.
    expect(r.primaryContactPersonId).toBe("p-john");
    expect(r.members[0].personId).toBe("p-john");
  });

  it("falls back to earliest when the explicit primary is not an active member", () => {
    const r = assembleRoster({
      unitId: "u1", unitNumber: "7", unitAccountRef: null,
      activeOwnerships: owners, explicitPrimaryPersonId: "p-ghost-former-owner",
    });
    expect(r.primaryContactPersonId).toBe("p-john"); // earliest active
  });

  it("has null primary + empty members for a unit with no active owners", () => {
    const r = assembleRoster({
      unitId: "u1", unitNumber: "7", unitAccountRef: null,
      activeOwnerships: [], explicitPrimaryPersonId: null,
    });
    expect(r.primaryContactPersonId).toBeNull();
    expect(r.members).toHaveLength(0);
  });
});

describe("Phase 1 P0-1 — rosterNameMatch (match a deposit to a UNIT when ANY name appears)", () => {
  const roster = assembleRoster({
    unitId: "u1", unitNumber: "7", unitAccountRef: null,
    activeOwnerships: [
      { personId: "p-jane", firstName: "Jane", lastName: "Doe", ownershipPercentage: 50, startDate: new Date("2022-03-01"), endDate: null },
      { personId: "p-john", firstName: "John", lastName: "Smith", ownershipPercentage: 50, startDate: new Date("2020-01-01"), endDate: null },
    ],
    explicitPrimaryPersonId: null,
  });

  it("matches exact when a co-owner's full name appears — even a NON-primary one", () => {
    // Jane is not the primary (John started earlier), but her full name still matches the unit.
    expect(rosterNameMatch("ZELLE FROM JANE DOE", roster)).toBe("exact");
    expect(rosterNameMatch("ach from john smith", roster)).toBe("exact");
  });

  it("matches partial when only one token of a co-owner appears", () => {
    expect(rosterNameMatch("WIRE FROM SMITH", roster)).toBe("partial");
    expect(rosterNameMatch("deposit jane", roster)).toBe("partial");
  });

  it("returns none when no roster name appears", () => {
    expect(rosterNameMatch("ACH DEPOSIT 12345", roster)).toBe("none");
    expect(rosterNameMatch(null, roster)).toBe("none");
  });

  it("returns none for an empty roster", () => {
    expect(rosterNameMatch("JANE DOE", { members: [] })).toBe("none");
  });
});

// ── P0-1: scoreCandidate rosterMatch signal + backward-compat ─────────────────

describe("Phase 1 P0-1 — scoreCandidate with rosterMatch", () => {
  const base = {
    bankAmountAbsCents: 25000,
    bankDate: new Date("2026-05-10"),
    bankDescription: "ZELLE FROM JANE DOE", // the ledger owner is JOHN, not Jane
    ledgerAmountAbsCents: 25000,
    ledgerPostedAt: new Date("2026-05-10"),
    ownerFirstName: "John",
    ownerLastName: "Smith",
  };

  it("uses the roster any-name signal to clear threshold when the ledger owner name does NOT appear", () => {
    // Without a roster: John Smith is the ledger owner, but the descriptor says
    // "JANE DOE" → single-owner name path returns "none" → 0.55+0.20 = 0.75 (below).
    const withoutRoster = scoreCandidate(base);
    expect(withoutRoster.signals.payorMatch).toBe("none");
    expect(withoutRoster.confidence).toBeCloseTo(0.75, 5);
    expect(withoutRoster.confidence).toBeLessThan(AUTO_MATCH_THRESHOLD);

    // With the unit roster (Jane is a co-owner) → rosterMatch "exact" →
    // 0.55 + 0.20 + 0.25 = 1.00 → clears threshold, matched to the UNIT.
    const withRoster = scoreCandidate({ ...base, rosterMatch: "exact" });
    expect(withRoster.signals.payorMatch).toBe("exact");
    expect(withRoster.confidence).toBe(1);
    expect(withRoster.confidence).toBeGreaterThanOrEqual(AUTO_MATCH_THRESHOLD);
  });

  it("rosterMatch supersedes the single-owner name check", () => {
    // Even though ownerFirst/Last would match "none", an explicit rosterMatch
    // wins — the unit-centric path drives the payor signal.
    const r = scoreCandidate({ ...base, rosterMatch: "partial" });
    expect(r.signals.payorMatch).toBe("partial");
    // 0.55 + 0.20 + 0.10 = 0.85
    expect(r.confidence).toBeCloseTo(0.85, 5);
  });

  it("BACKWARD-COMPAT: omitting rosterMatch is byte-for-byte the pre-Phase-1 single-owner path", () => {
    const flagOff = scoreCandidate({
      ...base,
      bankDescription: "ZELLE FROM JOHN SMITH", // the actual ledger owner
    });
    // Single-owner exact: 0.55 + 0.20 + 0.25 = 1.00 — unchanged pre-Phase-1 behavior.
    expect(flagOff.confidence).toBe(1);
    expect(flagOff.signals.payorMatch).toBe("exact");
  });
});
