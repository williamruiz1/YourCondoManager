// #342 (WS3) — masking helpers for the admin consent audit view.
//
// Non-platform-admin viewers see a coarse signal only:
//   ipAddress: first octet + .x.x.x (IPv4) or first hextet + ":xxxx::" (IPv6)
//   userAgent: vendor family only (Chrome / Safari / Firefox / Edge / iOS / Android / Other)
//
// Platform admins see the raw values. This preserves the compliance signal
// (consent was captured from somewhere/something) without leaking forensic
// detail to board-level admins who don't need it.
//
// Extracted to a standalone module so tests can import without pulling in
// the full routes.ts dependency tree (which requires DATABASE_URL on import).

export function maskIpAddress(ip: string | null): string | null {
  if (!ip) return ip;
  // IPv6 check (contains a colon).
  if (ip.includes(":")) {
    const head = ip.split(":")[0];
    return `${head}:xxxx::`;
  }
  // IPv4: drop the last three octets.
  const parts = ip.split(".");
  if (parts.length === 4) return `${parts[0]}.x.x.x`;
  return "redacted";
}

export function maskUserAgent(ua: string | null): string | null {
  if (!ua) return ua;
  const u = ua.toLowerCase();
  if (u.includes("edg/")) return "Edge";
  if (u.includes("chrome/")) return "Chrome";
  if (u.includes("firefox/")) return "Firefox";
  if (u.includes("safari/") && !u.includes("chrome/")) return "Safari";
  if (u.includes("iphone") || u.includes("ipad")) return "iOS";
  if (u.includes("android")) return "Android";
  return "Other";
}
