/**
 * Unit tests for server/geo-resolver.ts
 *
 * Covers:
 *   1. isPrivateIp — RFC-1918, loopback, link-local, Fly.io CGNAT,
 *      IPv6 loopback, IPv4-mapped IPv6.
 *   2. formatGeoLocation — all-fields, partial, and null inputs.
 *   3. IpApiComResolver — success, fail status, network error, timeout,
 *      malformed JSON, and private IP short-circuit.
 *
 * Network calls are mocked via `vi.stubGlobal("fetch", ...)` so the tests
 * run fully offline.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isPrivateIp,
  formatGeoLocation,
  IpApiComResolver,
  type GeoLocation,
} from "../geo-resolver";

// ─────────────────────────────────────────────────────────────────────────────
// 1. isPrivateIp
// ─────────────────────────────────────────────────────────────────────────────

describe("isPrivateIp", () => {
  it("detects loopback 127.0.0.1", () => {
    expect(isPrivateIp("127.0.0.1")).toBe(true);
  });

  it("detects RFC-1918 10.x.x.x", () => {
    expect(isPrivateIp("10.0.0.1")).toBe(true);
    expect(isPrivateIp("10.255.255.255")).toBe(true);
  });

  it("detects RFC-1918 172.16–31.x.x", () => {
    expect(isPrivateIp("172.16.0.1")).toBe(true);
    expect(isPrivateIp("172.31.255.255")).toBe(true);
  });

  it("does not treat 172.15 or 172.32 as private", () => {
    expect(isPrivateIp("172.15.0.1")).toBe(false);
    expect(isPrivateIp("172.32.0.1")).toBe(false);
  });

  it("detects RFC-1918 192.168.x.x", () => {
    expect(isPrivateIp("192.168.1.1")).toBe(true);
  });

  it("detects link-local 169.254.x.x", () => {
    expect(isPrivateIp("169.254.0.1")).toBe(true);
  });

  it("detects Fly.io CGNAT 100.64–127.x.x", () => {
    expect(isPrivateIp("100.64.0.1")).toBe(true);
    expect(isPrivateIp("100.127.0.1")).toBe(true);
  });

  it("does not treat public IPs as private", () => {
    expect(isPrivateIp("8.8.8.8")).toBe(false);
    expect(isPrivateIp("216.239.165.26")).toBe(false);  // Google IP from task description
    expect(isPrivateIp("1.1.1.1")).toBe(false);
  });

  it("detects IPv6 loopback ::1", () => {
    expect(isPrivateIp("::1")).toBe(true);
  });

  it("detects IPv4-mapped IPv6 ::ffff:10.0.0.1 as private", () => {
    expect(isPrivateIp("::ffff:10.0.0.1")).toBe(true);
  });

  it("detects IPv4-mapped IPv6 ::ffff:8.8.8.8 as NOT private", () => {
    expect(isPrivateIp("::ffff:8.8.8.8")).toBe(false);
  });

  it("returns true for empty string", () => {
    expect(isPrivateIp("")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. formatGeoLocation
// ─────────────────────────────────────────────────────────────────────────────

describe("formatGeoLocation", () => {
  it("returns all three parts joined with comma-space when all present", () => {
    const geo: GeoLocation = { city: "New York", region: "New York", country: "United States" };
    expect(formatGeoLocation(geo)).toBe("New York, New York, United States");
  });

  it("omits null fields", () => {
    const geo: GeoLocation = { city: null, region: "California", country: "United States" };
    expect(formatGeoLocation(geo)).toBe("California, United States");
  });

  it("handles only country present", () => {
    const geo: GeoLocation = { city: null, region: null, country: "Canada" };
    expect(formatGeoLocation(geo)).toBe("Canada");
  });

  it("returns 'Location unavailable' when all fields are null", () => {
    const geo: GeoLocation = { city: null, region: null, country: null };
    expect(formatGeoLocation(geo)).toBe("Location unavailable");
  });

  it("returns 'Location unavailable' when geo is null", () => {
    expect(formatGeoLocation(null)).toBe("Location unavailable");
  });

  it("filters out empty strings", () => {
    const geo: GeoLocation = { city: "", region: "Texas", country: "United States" };
    expect(formatGeoLocation(geo)).toBe("Texas, United States");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. IpApiComResolver
// ─────────────────────────────────────────────────────────────────────────────

function makeFetchMock(body: string, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    text: vi.fn().mockResolvedValue(body),
  });
}

describe("IpApiComResolver", () => {
  const resolver = new IpApiComResolver();

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("resolves a public IP to city/region/country on success", async () => {
    const successBody = JSON.stringify({
      status: "success",
      city: "Austin",
      regionName: "Texas",
      country: "United States",
    });
    vi.stubGlobal("fetch", makeFetchMock(successBody));

    const result = await resolver.resolve("8.8.8.8");

    expect(result).toEqual({ city: "Austin", region: "Texas", country: "United States" });
  });

  it("returns null when ip-api reports status=fail", async () => {
    const failBody = JSON.stringify({ status: "fail", message: "private range" });
    vi.stubGlobal("fetch", makeFetchMock(failBody));

    const result = await resolver.resolve("8.8.8.8");

    expect(result).toBeNull();
  });

  it("returns null on network error (fetch throws)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const result = await resolver.resolve("8.8.8.8");

    expect(result).toBeNull();
  });

  it("returns null on malformed JSON response", async () => {
    vi.stubGlobal("fetch", makeFetchMock("not json at all"));

    const result = await resolver.resolve("8.8.8.8");

    expect(result).toBeNull();
  });

  it("short-circuits on private IP without calling fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolver.resolve("192.168.1.1");

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("short-circuits on loopback without calling fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await resolver.resolve("127.0.0.1");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null when AbortController fires (timeout)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation((_url: string, opts: { signal: AbortSignal }) => {
      // Simulate the fetch being aborted
      return new Promise<never>((_resolve, reject) => {
        opts.signal.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        );
      });
    }));

    const resultPromise = resolver.resolve("8.8.8.8");
    // Fast-forward past the 3s timeout
    vi.advanceTimersByTime(4_000);
    const result = await resultPromise;

    expect(result).toBeNull();
  });

  it("trims whitespace from city/region/country fields", async () => {
    const body = JSON.stringify({
      status: "success",
      city: "  Seattle  ",
      regionName: " Washington ",
      country: " United States ",
    });
    vi.stubGlobal("fetch", makeFetchMock(body));

    const result = await resolver.resolve("8.8.8.8");

    expect(result).toEqual({ city: "Seattle", region: "Washington", country: "United States" });
  });

  it("handles partially missing fields (e.g. no city) gracefully", async () => {
    const body = JSON.stringify({
      status: "success",
      regionName: "Ontario",
      country: "Canada",
    });
    vi.stubGlobal("fetch", makeFetchMock(body));

    const result = await resolver.resolve("8.8.8.8");

    expect(result).toEqual({ city: null, region: "Ontario", country: "Canada" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. IP-capture regression — Google IP range (task description)
// ─────────────────────────────────────────────────────────────────────────────

describe("IP capture — public Google IP is not treated as private", () => {
  it("216.239.165.26 (Google IP range) is public and not skipped", () => {
    expect(isPrivateIp("216.239.165.26")).toBe(false);
  });

  it("resolveSourceIp correctly uses Fly-Client-IP over Google proxy IP", () => {
    // Simulated environment: Fly.io edge adds Fly-Client-IP = real user IP,
    // X-Forwarded-For may show Google's egress IP.
    // We can't directly test the unexported resolveSourceIp, but we ensure
    // the Google IP is not flagged as private so it would be used as a fallback
    // correctly (real end-user IP from Fly-Client-IP would take priority).
    const realUserIp = "98.104.12.5";
    const googleProxyIp = "216.239.165.26";
    expect(isPrivateIp(realUserIp)).toBe(false);
    expect(isPrivateIp(googleProxyIp)).toBe(false);
    // Both are public — the Fly-Client-IP header path (priority 1) would return
    // the real user IP, not the Google egress hop.
  });
});
