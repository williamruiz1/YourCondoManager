// A-SEC-001 (founder-os#10738) — response-body PII/secrets must never reach
// production request logs. Tests the log-line builder + redactor directly.
import { describe, it, expect, afterEach } from "vitest";
import { formatApiLogLine, redactForLog } from "../logger";

const ORIGINAL_ENV = process.env.NODE_ENV;
afterEach(() => {
  process.env.NODE_ENV = ORIGINAL_ENV;
});

describe("A-SEC-001 formatApiLogLine — production never logs a response body", () => {
  it("in production, the /api log line contains NO response-body content", () => {
    process.env.NODE_ENV = "production";
    const body = { user: { email: "owner@example.com" }, balanceCents: 128400, rows: [{ token: "sess_abc" }] };
    const line = formatApiLogLine("GET", "/api/financial/ledger", 200, 12, body);
    expect(line).toBe("GET /api/financial/ledger 200 in 12ms");
    expect(line).not.toContain("::");
    expect(line).not.toContain("owner@example.com");
    expect(line).not.toContain("128400");
    expect(line).not.toContain("sess_abc");
  });

  it("in production, a verify-login response token never appears in the log line", () => {
    process.env.NODE_ENV = "production";
    const body = { token: "otp_verify_9f8e7d6c", sessionToken: "sess_LIVE_TOKEN", userId: 42 };
    const line = formatApiLogLine("POST", "/api/auth/verify-login", 200, 8, body);
    expect(line).not.toContain("otp_verify_9f8e7d6c");
    expect(line).not.toContain("sess_LIVE_TOKEN");
  });

  it("in non-production, a verify-login token is still redacted (never appears in captured log output)", () => {
    process.env.NODE_ENV = "development";
    const body = { token: "otp_verify_9f8e7d6c", sessionToken: "sess_LIVE_TOKEN", userId: 42 };
    const line = formatApiLogLine("POST", "/api/auth/verify-login", 200, 8, body);
    // dev keeps a preview, but sensitive values are hard-redacted
    expect(line).toContain("::");
    expect(line).not.toContain("otp_verify_9f8e7d6c");
    expect(line).not.toContain("sess_LIVE_TOKEN");
    expect(line).toContain("[REDACTED]");
    expect(line).toContain("42"); // non-sensitive field survives the preview
  });

  it("no body -> plain line regardless of env", () => {
    process.env.NODE_ENV = "development";
    expect(formatApiLogLine("GET", "/api/health", 204, 1)).toBe("GET /api/health 204 in 1ms");
  });
});

describe("A-SEC-001 redactForLog", () => {
  it("redacts known-sensitive keys (token/password/email/account/secret) at any depth", () => {
    const out = redactForLog({
      email: "a@b.com",
      password: "hunter2",
      nested: { authToken: "x", account: "1234567890", ok: "keep" },
      list: [{ secret: "s" }],
    });
    expect(out).not.toContain("a@b.com");
    expect(out).not.toContain("hunter2");
    expect(out).not.toContain("1234567890");
    expect(out).not.toContain('"s"');
    expect(out).toContain("keep");
    expect(out).toContain("[REDACTED]");
  });

  it("truncates oversized bodies", () => {
    const big = { blob: "x".repeat(2000), keepKey: "v" };
    const out = redactForLog(big, 200);
    expect(out.length).toBeLessThanOrEqual(200 + "…(truncated)".length);
    expect(out).toContain("…(truncated)");
  });

  it("handles circular references without throwing", () => {
    const a: any = { name: "n" };
    a.self = a;
    expect(() => redactForLog(a)).not.toThrow();
    expect(redactForLog(a)).toContain("[Circular]");
  });
});
