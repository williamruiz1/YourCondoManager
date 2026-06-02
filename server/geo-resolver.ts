/**
 * geo-resolver.ts — best-effort IP-to-location resolver used by the
 * new-location-login security email (WS12 / Issue #388).
 *
 * Design:
 *   - All resolution is wrapped in a swappable `GeoResolver` interface so the
 *     provider (ip-api.com today, MaxMind GeoLite2 tomorrow) can be replaced by
 *     changing one factory call.
 *   - Results are BEST-EFFORT: a failure (network error, private IP, unknown
 *     IP) returns `null`. Callers MUST handle null gracefully and must NEVER
 *     block the auth flow on a geo failure.
 *   - Provider: ip-api.com (no auth, no API key, free for 45 req/min at the
 *     HTTP tier). Upgrade path: swap `IpApiComResolver` for `MaxMindResolver`
 *     (see stub below). The MaxMind path requires a local GeoLite2-City.mmdb
 *     file — omitted here because that is a William-action (account + license
 *     key + download). See docs/security/geo-resolver-upgrade.md for the
 *     MaxMind upgrade runbook.
 *
 * References:
 *   - ip-api.com docs: https://ip-api.com/docs/api:json
 *   - MaxMind GeoLite2 npm: https://www.npmjs.com/package/maxmind
 */

export interface GeoLocation {
  city: string | null;
  region: string | null;   // state / province / region
  country: string | null;
}

export interface GeoResolver {
  /** Resolve an IP address to its geographic location.
   * Returns null if resolution fails or the IP is private/unknown. */
  resolve(ip: string): Promise<GeoLocation | null>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Private IP ranges — these never resolve externally, skip the HTTP call.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true for RFC 1918 / RFC 4193 / loopback / link-local ranges that
 * will never resolve to a useful location via any external API.
 */
export function isPrivateIp(ip: string): boolean {
  if (!ip) return true;
  // IPv6 loopback
  if (ip === "::1" || ip === "::") return true;
  // IPv4-mapped IPv6 — unwrap to check the IPv4 part
  const ipv4Mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  const target = ipv4Mapped ? ipv4Mapped[1] : ip;

  // Fast prefix checks for common private ranges (IPv4 only)
  const parts = target.split(".").map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return false; // IPv6 — not private in this check
  const [a, b] = parts;
  return (
    a === 127 ||                          // loopback 127.0.0.0/8
    a === 10 ||                           // 10.0.0.0/8
    (a === 172 && b >= 16 && b <= 31) ||  // 172.16.0.0/12
    (a === 192 && b === 168) ||           // 192.168.0.0/16
    (a === 169 && b === 254) ||           // link-local 169.254.0.0/16
    (a === 100 && b >= 64 && b <= 127)    // Fly.io 6PN mesh / CGNAT 100.64.0.0/10
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ip-api.com implementation (default, no key needed)
// ─────────────────────────────────────────────────────────────────────────────

const IP_API_TIMEOUT_MS = 3_000;

interface IpApiResponse {
  status: "success" | "fail";
  city?: string;
  regionName?: string;
  country?: string;
  message?: string; // set when status === "fail"
}

export class IpApiComResolver implements GeoResolver {
  async resolve(ip: string): Promise<GeoLocation | null> {
    if (isPrivateIp(ip)) return null;

    let raw: string;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), IP_API_TIMEOUT_MS);
      try {
        const resp = await fetch(
          `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,city,regionName,country,message`,
          { signal: controller.signal },
        );
        raw = await resp.text();
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      // Network error or timeout — return null silently (best-effort)
      return null;
    }

    let data: IpApiResponse;
    try {
      data = JSON.parse(raw) as IpApiResponse;
    } catch {
      return null;
    }

    if (data.status !== "success") return null;

    return {
      city: data.city?.trim() || null,
      region: data.regionName?.trim() || null,
      country: data.country?.trim() || null,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MaxMind GeoLite2 upgrade stub (William-action prerequisite — see below)
// ─────────────────────────────────────────────────────────────────────────────
//
// To upgrade from ip-api.com to a local MaxMind GeoLite2-City database:
//
//   WILLIAM-ACTION REQUIRED before this path works:
//   1. Sign up for a free MaxMind account: https://www.maxmind.com/en/geolite2/signup
//   2. Generate a license key (Account → My License Key)
//   3. Download GeoLite2-City.mmdb and place it at `data/GeoLite2-City.mmdb`
//      (add `data/*.mmdb` to .gitignore — binary, ~60 MB)
//   4. `npm install maxmind`
//   5. Uncomment MaxMindResolver below and change the singleton at the bottom
//
// import maxmind, { CityResponse } from "maxmind";
// import path from "path";
//
// export class MaxMindResolver implements GeoResolver {
//   private lookup: Awaited<ReturnType<typeof maxmind.open<CityResponse>>> | null = null;
//
//   private async getLookup() {
//     if (!this.lookup) {
//       const dbPath = path.resolve(process.cwd(), "data/GeoLite2-City.mmdb");
//       this.lookup = await maxmind.open<CityResponse>(dbPath);
//     }
//     return this.lookup;
//   }
//
//   async resolve(ip: string): Promise<GeoLocation | null> {
//     if (isPrivateIp(ip)) return null;
//     try {
//       const lookup = await this.getLookup();
//       const result = lookup.get(ip);
//       if (!result) return null;
//       return {
//         city: result.city?.names?.en ?? null,
//         region: result.subdivisions?.[0]?.names?.en ?? null,
//         country: result.country?.names?.en ?? null,
//       };
//     } catch {
//       return null;
//     }
//   }
// }

// ─────────────────────────────────────────────────────────────────────────────
// Singleton — swap the class here to change providers.
// ─────────────────────────────────────────────────────────────────────────────

export const geoResolver: GeoResolver = new IpApiComResolver();

// ─────────────────────────────────────────────────────────────────────────────
// Format helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Produce a human-readable location string from a GeoLocation.
 * Examples:
 *   "New York, New York, United States"
 *   "London, England, United Kingdom"
 *   "Location unavailable"  ← when all fields are null or geo failed
 */
export function formatGeoLocation(geo: GeoLocation | null): string {
  if (!geo) return "Location unavailable";
  const parts = [geo.city, geo.region, geo.country].filter(
    (p): p is string => typeof p === "string" && p.length > 0,
  );
  return parts.length > 0 ? parts.join(", ") : "Location unavailable";
}
