/**
 * #342 (WS3) — Consent audit masking helpers.
 *
 * The admin consent audit endpoint masks IP + user-agent for non-platform-admin
 * viewers (board admins see a coarse signal only). This test exercises the
 * mask functions in isolation.
 */
import { describe, it, expect } from "vitest";
import { maskIpAddress, maskUserAgent } from "../consent-audit-masking";

describe("#342 maskIpAddress", () => {
  it("returns null for null input", () => {
    expect(maskIpAddress(null)).toBeNull();
  });

  it("masks IPv4 to first octet only", () => {
    expect(maskIpAddress("192.168.1.42")).toBe("192.x.x.x");
    expect(maskIpAddress("10.0.0.1")).toBe("10.x.x.x");
  });

  it("masks IPv6 to first hextet", () => {
    const result = maskIpAddress("2001:db8::1");
    expect(result).toBe("2001:xxxx::");
  });

  it("returns 'redacted' for malformed IPs", () => {
    expect(maskIpAddress("not-an-ip")).toBe("redacted");
  });
});

describe("#342 maskUserAgent", () => {
  it("returns null for null input", () => {
    expect(maskUserAgent(null)).toBeNull();
  });

  it("identifies Chrome", () => {
    expect(maskUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/120.0.0.0")).toBe("Chrome");
  });

  it("identifies Safari (excludes Chrome impersonation)", () => {
    expect(maskUserAgent("Mozilla/5.0 (Macintosh) AppleWebKit/605.1 Safari/605.1.15")).toBe("Safari");
  });

  it("identifies Firefox", () => {
    expect(maskUserAgent("Mozilla/5.0 (X11) Gecko Firefox/120.0")).toBe("Firefox");
  });

  it("identifies iOS", () => {
    expect(maskUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe("iOS");
  });

  it("identifies Android", () => {
    expect(maskUserAgent("Mozilla/5.0 (Linux; Android 14)")).toBe("Android");
  });

  it("returns 'Other' for unknown UA strings", () => {
    expect(maskUserAgent("curl/8.0")).toBe("Other");
  });
});
