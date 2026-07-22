/**
 * William-only contextual feedback (2026-07-17).
 *
 * Exercises the allowlist gate + the issue-body builders in isolation.
 * The two routes (/api/founder-feedback/eligible, /api/founder-feedback) both call
 * `isFounderFeedbackEmail` as their ONLY gate — this test is the
 * regression guard against the allowlist ever silently widening (e.g. a
 * copy-paste that swaps `Set.has` for something case-sensitive, or an
 * accidental substring match instead of an exact match).
 */
import { describe, it, expect } from "vitest";
import {
  isFounderFeedbackEmail,
  sanitizeFounderFeedbackRoute,
  buildFounderFeedbackDedupeKey,
  redactFounderFeedbackText,
} from "../founder-feedback";

describe("sanitizeFounderFeedbackRoute", () => {
  it("keeps the useful pathname while removing query strings and fragments", () => {
    expect(sanitizeFounderFeedbackRoute("/portal/finances?token=secret#ledger")).toBe("/portal/finances");
  });

  it("falls back to the root path when only sensitive URL context is supplied", () => {
    expect(sanitizeFounderFeedbackRoute("?token=secret")).toBe("/");
  });
});

describe("isFounderFeedbackEmail — allowlisted", () => {
  it("allows William's board/admin account", () => {
    expect(isFounderFeedbackEmail("chcmgmt18@gmail.com")).toBe(true);
  });

  it("allows William's owner/platform account", () => {
    expect(isFounderFeedbackEmail("yourcondomanagement@gmail.com")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isFounderFeedbackEmail("ChcMgmt18@Gmail.com")).toBe(true);
    expect(isFounderFeedbackEmail("YOURCONDOMANAGEMENT@GMAIL.COM")).toBe(true);
  });

  it("trims surrounding whitespace", () => {
    expect(isFounderFeedbackEmail("  chcmgmt18@gmail.com  ")).toBe(true);
  });
});

describe("isFounderFeedbackEmail — rejected (must never render/accept for any other account)", () => {
  it("rejects a customer admin/manager email", () => {
    expect(isFounderFeedbackEmail("some-hoa-manager@example.com")).toBe(false);
  });

  it("rejects a similar-but-different email (no partial/substring match)", () => {
    expect(isFounderFeedbackEmail("chcmgmt18@gmail.com.evil.com")).toBe(false);
    expect(isFounderFeedbackEmail("notchcmgmt18@gmail.com")).toBe(false);
    expect(isFounderFeedbackEmail("chcmgmt1@gmail.com")).toBe(false);
  });

  it("rejects null/undefined/empty", () => {
    expect(isFounderFeedbackEmail(null)).toBe(false);
    expect(isFounderFeedbackEmail(undefined)).toBe(false);
    expect(isFounderFeedbackEmail("")).toBe(false);
    expect(isFounderFeedbackEmail("   ")).toBe(false);
  });
});

describe("founder feedback redaction and duplicate prevention", () => {
  it("redacts provider tokens, bearer credentials, and sensitive query parameters", () => {
    const input = "token=github_pat_abcdefghijklmnopqrstuvwxyz123456 Bearer abc.def.ghi https://x.test?a=1&access_token=secret";
    const result = redactFounderFeedbackText(input) || "";
    expect(result).not.toContain("github_pat_");
    expect(result).not.toContain("abc.def.ghi");
    expect(result).not.toContain("access_token=secret");
    expect(result.match(/\[REDACTED\]/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("builds one stable key inside a ten-minute retry window", () => {
    const base = {
      email: "YOURCONDOMANAGEMENT@gmail.com",
      route: "/portal/finances?token=secret",
      severity: "bug",
      note: "  The total is wrong  ",
    };
    const first = buildFounderFeedbackDedupeKey({ ...base, createdAt: new Date("2026-07-21T12:01:00Z") });
    const retry = buildFounderFeedbackDedupeKey({ ...base, note: "the   total is WRONG", createdAt: new Date("2026-07-21T12:09:59Z") });
    const later = buildFounderFeedbackDedupeKey({ ...base, createdAt: new Date("2026-07-21T12:10:00Z") });
    expect(first).toBe(retry);
    expect(first).not.toBe(later);
  });
});
