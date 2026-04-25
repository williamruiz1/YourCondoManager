#!/usr/bin/env tsx
/**
 * Autocannon load-test harness for the 5 hot endpoints called out in
 * docs/projects/platform-overhaul/implementation-artifacts/5.4-performance-audit.md §2.
 *
 * Wave 19 / 5.4-F5. **Read-only:** every endpoint hit is GET; no writes.
 *
 * What it does:
 *   - Hits each of 5 named endpoints sequentially with N concurrent connections
 *     for a fixed duration each.
 *   - Prints p50 / p95 / p99 latency, throughput, and error rate per endpoint.
 *
 * Safety rails:
 *   - Refuses to run against any URL that looks like prod (yourcondomanager.com,
 *     `*.replit.app`, `*.fly.dev`, etc.). Override only by setting
 *     ALLOW_NON_LOCAL=1 explicitly — that flag plus the URL is logged on every
 *     run so it cannot be silent.
 *   - Refuses to start without an AUTH_TOKEN env var set (the endpoints all
 *     require an authenticated session).
 *
 * Usage:
 *   1) Boot a non-prod server (`npm run dev`) on http://localhost:5000
 *   2) Mint a session token (see README — instructions copied from 5.4-F5
 *      follow-up notes).
 *   3) Run:
 *        BASE_URL=http://localhost:5000 \
 *          AUTH_TOKEN="<session-cookie-or-bearer>" \
 *          npm run load-test
 *
 * Wave 19 does NOT execute this script in CI — there's no non-prod env wired
 * here for it to hit. The harness exists so that whoever spins up a perf rig
 * (staging, an ephemeral docker stack, etc.) has a one-command answer.
 */

import { performance } from "node:perf_hooks";

interface Result {
  endpoint: string;
  latency: { p50: number; p95: number; p99: number; max: number };
  throughput: { requests: number; rps: number };
  errors: number;
  errorRate: number;
}

const ENDPOINTS = [
  "/api/alerts/cross-association",
  "/api/operations/dashboard",
  "/api/portal/financial-dashboard",
  "/api/financial/assessment-run-log",
  "/api/portal/me",
] as const;

const PROD_DENYLIST = [
  "yourcondomanager.com",
  ".replit.app",
  ".fly.dev",
  ".vercel.app",
  ".netlify.app",
];

function isProdLike(url: string): boolean {
  const lower = url.toLowerCase();
  return PROD_DENYLIST.some((needle) => lower.includes(needle));
}

function safetyCheck(baseUrl: string): void {
  if (isProdLike(baseUrl) && process.env.ALLOW_NON_LOCAL !== "1") {
    console.error(
      [
        `Refusing to load-test ${baseUrl} — it looks like a production-tier host.`,
        "If you really mean it, re-run with ALLOW_NON_LOCAL=1 (and consider not).",
      ].join("\n"),
    );
    process.exit(2);
  }
  if (process.env.ALLOW_NON_LOCAL === "1") {
    console.warn(`!! ALLOW_NON_LOCAL=1 set; targeting ${baseUrl}`);
  }
}

async function loadAutocannon(): Promise<null | typeof import("autocannon")> {
  try {
    // @ts-expect-error — optional dep, may not be installed
    const mod = await import("autocannon");
    return (mod.default ?? mod) as typeof import("autocannon");
  } catch {
    return null;
  }
}

async function runOne(
  autocannon: typeof import("autocannon"),
  baseUrl: string,
  authToken: string,
  endpoint: string,
  connections: number,
  durationSec: number,
): Promise<Result> {
  // Allow either a Bearer token or a raw Cookie string. If the value starts
  // with `Bearer ` or contains `=`, treat it as-is; otherwise prepend "Bearer ".
  const isCookie = authToken.includes("=");
  const headers = isCookie
    ? { Cookie: authToken, Accept: "application/json" }
    : {
        Authorization: authToken.startsWith("Bearer ") ? authToken : `Bearer ${authToken}`,
        Accept: "application/json",
      };

  const url = `${baseUrl}${endpoint}`;
  const start = performance.now();
  const result = await autocannon({
    url,
    connections,
    duration: durationSec,
    headers,
  });
  const wall = (performance.now() - start) / 1000;

  const totalReqs = result.requests.total ?? 0;
  const errors = (result.errors ?? 0) + (result.timeouts ?? 0) + (result.non2xx ?? 0);
  return {
    endpoint,
    latency: {
      p50: Number(result.latency.p50 ?? 0),
      p95: Number(result.latency.p97_5 ?? result.latency.p99 ?? 0),
      p99: Number(result.latency.p99 ?? 0),
      max: Number(result.latency.max ?? 0),
    },
    throughput: {
      requests: totalReqs,
      rps: Number((totalReqs / Math.max(wall, 0.001)).toFixed(2)),
    },
    errors,
    errorRate: totalReqs === 0 ? 0 : errors / totalReqs,
  };
}

function fmt(ms: number) {
  return `${ms.toFixed(1)}ms`;
}

function printReport(results: Result[]) {
  console.log("\n=== Load-test report ===\n");
  console.log(
    [
      "Endpoint".padEnd(46),
      "p50".padStart(10),
      "p95".padStart(10),
      "p99".padStart(10),
      "rps".padStart(9),
      "errors".padStart(9),
    ].join(""),
  );
  console.log("-".repeat(94));
  for (const r of results) {
    console.log(
      [
        r.endpoint.padEnd(46),
        fmt(r.latency.p50).padStart(10),
        fmt(r.latency.p95).padStart(10),
        fmt(r.latency.p99).padStart(10),
        r.throughput.rps.toFixed(1).padStart(9),
        `${r.errors} (${(r.errorRate * 100).toFixed(1)}%)`.padStart(9),
      ].join(""),
    );
  }
  console.log();
}

async function main() {
  const baseUrl = process.env.BASE_URL ?? "http://localhost:5000";
  const authToken = process.env.AUTH_TOKEN ?? "";
  const connections = Number.parseInt(process.env.CONNECTIONS ?? "10", 10);
  const durationSec = Number.parseInt(process.env.DURATION_SEC ?? "10", 10);

  safetyCheck(baseUrl);

  if (!authToken) {
    console.error(
      "AUTH_TOKEN is required. Set a session cookie (e.g. AUTH_TOKEN='connect.sid=s%3A...')",
    );
    process.exit(2);
  }

  const autocannon = await loadAutocannon();
  if (!autocannon) {
    console.error(
      [
        "`autocannon` is not installed. Install it with:",
        "  npm i -D autocannon",
        "then re-run `npm run load-test`.",
      ].join("\n"),
    );
    process.exit(2);
  }

  console.log(
    `Target: ${baseUrl}  connections=${connections}  duration=${durationSec}s per endpoint`,
  );

  const results: Result[] = [];
  for (const endpoint of ENDPOINTS) {
    console.log(`\n-> ${endpoint}`);
    const r = await runOne(autocannon, baseUrl, authToken, endpoint, connections, durationSec);
    results.push(r);
    console.log(
      `   p50=${fmt(r.latency.p50)} p95=${fmt(r.latency.p95)} p99=${fmt(r.latency.p99)} rps=${r.throughput.rps} errors=${r.errors}`,
    );
  }
  printReport(results);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
