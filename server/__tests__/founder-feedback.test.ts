/**
 * William-only contextual feedback (2026-07-17).
 *
 * Exercises the allowlist gate + the issue-body builders in isolation.
 * The two routes (/api/feedback/eligible, /api/feedback) both call
 * `isFounderFeedbackEmail` as their ONLY gate — this test is the
 * regression guard against the allowlist ever silently widening (e.g. a
 * copy-paste that swaps `Set.has` for something case-sensitive, or an
 * accidental substring match instead of an exact match).
 */
import { describe, it, expect } from "vitest";
import {
  isFounderFeedbackEmail,
  buildFounderFeedbackIssueTitle,
  buildFounderFeedbackIssueBody,
} from "../founder-feedback";

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

describe("buildFounderFeedbackIssueTitle", () => {
  it("prefixes with [william-feedback] and takes the first line", () => {
    expect(buildFounderFeedbackIssueTitle("The dues page is broken\nsecond line")).toBe(
      "[william-feedback] The dues page is broken",
    );
  });

  it("truncates long first lines to 60 chars", () => {
    const long = "x".repeat(200);
    const title = buildFounderFeedbackIssueTitle(long);
    expect(title).toBe(`[william-feedback] ${"x".repeat(60)}`);
  });
});

describe("buildFounderFeedbackIssueBody", () => {
  it("includes the note, surface, route, and identity", () => {
    const body = buildFounderFeedbackIssueBody({
      note: "This button is misaligned",
      severity: "looks-wrong",
      email: "yourcondomanagement@gmail.com",
      surface: "portal",
      route: "/portal/home",
      pageTitle: "Owner Home",
      viewportWidth: 1440,
      viewportHeight: 900,
      appVersion: "unknown",
      userAgent: "test-agent",
      createdAt: new Date("2026-07-17T12:00:00.000Z"),
    });

    expect(body).toContain("This button is misaligned");
    expect(body).toContain("yourcondomanagement@gmail.com (portal)");
    expect(body).toContain("severity: looks-wrong");
    expect(body).toContain("route: /portal/home");
    expect(body).toContain("2026-07-17T12:00:00.000Z");
  });

  it("falls back gracefully when optional fields are missing", () => {
    const body = buildFounderFeedbackIssueBody({
      note: "note",
      severity: null,
      email: "chcmgmt18@gmail.com",
      surface: "admin",
      route: "/app",
      pageTitle: null,
      viewportWidth: null,
      viewportHeight: null,
      appVersion: "unknown",
      userAgent: null,
      createdAt: new Date("2026-07-17T12:00:00.000Z"),
    });

    expect(body).toContain("severity: unspecified");
    expect(body).toContain("page title: unknown");
    expect(body).toContain("user agent: unknown");
  });
});
