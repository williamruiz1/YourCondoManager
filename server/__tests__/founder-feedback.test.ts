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
import { afterEach, describe, it, expect, vi } from "vitest";
import {
  isFounderFeedbackEmail,
  sanitizeFounderFeedbackRoute,
  buildFounderFeedbackIssueTitle,
  buildFounderFeedbackIssueBody,
  buildFounderFeedbackDedupeKey,
  founderFeedbackIssueMarker,
  redactFounderFeedbackText,
  cleanupSyntheticFounderFeedbackIssues,
  fileFounderFeedbackGithubIssue,
} from "../founder-feedback";

afterEach(() => {
  delete process.env.YCM_FEEDBACK_GITHUB_TOKEN;
  vi.unstubAllGlobals();
});

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
    expect(body).toContain("allowlisted founder account (portal)");
    expect(body).not.toContain("yourcondomanagement@gmail.com");
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

  it("uses a deterministic, non-secret marker for replay idempotency", () => {
    expect(founderFeedbackIssueMarker("feedback-123")).toBe("<!-- ycm-founder-feedback-id:feedback-123 -->");
  });
});

describe("founder feedback GitHub delivery", () => {
  it("reports a visible unavailable state when the restricted token is absent", async () => {
    await expect(fileFounderFeedbackGithubIssue({ title: "test", body: "body" }, "marker"))
      .resolves.toEqual({ status: "unavailable", error: "token-not-configured" });
  });

  it("reuses an existing marked issue instead of creating a duplicate", async () => {
    process.env.YCM_FEEDBACK_GITHUB_TOKEN = "test-only-token";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("{}", { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ body: "marker-1", html_url: "https://github.test/1", number: 1 }]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fileFounderFeedbackGithubIssue({ title: "test", body: "body" }, "marker-1"))
      .resolves.toEqual({ status: "delivered", url: "https://github.test/1", number: 1, reused: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns only a safe provider status when issue creation fails", async () => {
    process.env.YCM_FEEDBACK_GITHUB_TOKEN = "test-only-token";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("{}", { status: 201 }))
      .mockResolvedValueOnce(new Response("[]", { status: 200 }))
      .mockResolvedValueOnce(new Response("sensitive provider body", { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fileFounderFeedbackGithubIssue({ title: "test", body: "body" }, "marker-2"))
      .resolves.toEqual({ status: "failed", error: "github-http-403" });
  });

  it("closes synthetic acceptance issues through the cleanup operation", async () => {
    process.env.YCM_FEEDBACK_GITHUB_TOKEN = "test-only-token";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{ number: 41 }, { number: 42 }]), { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(cleanupSyntheticFounderFeedbackIssues())
      .resolves.toEqual({ status: "completed", closed: 2 });
  });
});
