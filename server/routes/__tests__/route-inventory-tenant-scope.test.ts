/**
 * CQ-010 (founder-os#10740, YCM codebase-audit Wave 1) — route-inventory
 * tenant-scope coverage meta-test.
 *
 * The audit's single highest-severity risk class is a mutating route that
 * forgets its auth+scope guard: it would leak/mutate cross-tenant data and NO
 * existing test would catch it (coverage was spot — financial-security,
 * plaid-route-security, alerts-mutation-security — never systematic across the
 * ~330 mutating routes in server/routes.ts).
 *
 * This meta-test closes that gap WITHOUT a DB: it statically enumerates every
 * mutating (`POST/PATCH/PUT/DELETE`) `/api/*` route registered in
 * server/routes.ts and asserts each registration is wrapped by a recognized
 * auth guard middleware — `requireAdmin` (admin surface), `requirePortal` /
 * `requireBoardAccess[ReadOnly]` / `requireVendorPortal` (owner/board/vendor
 * portal surface) — OR is on an EXPLICIT allowlist (webhooks = signature
 * verified; public intake; the pre-auth login/token routes that cannot require
 * a session because they ESTABLISH one). A new mutating route with none of
 * these fails this test until it is guarded or deliberately allowlisted.
 *
 * Parsing is block-aware: guards may sit on continuation lines between the
 * route path and the `async` handler, so we scan each registration head from
 * `app.<verb>("/api/…"` to the handler start — a line-only check false-positives
 * on the many multi-line registrations (e.g. the amenities-settings PATCH).
 *
 * Complements server/__tests__/assert-resource-scope-fail-closed.test.ts (the
 * A-AUTHZ-001 unresolved-association regression test — the OTHER CQ-010 required
 * test, landed with the Wave-2 authz fix).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROUTES_TS = join(__dirname, "..", "..", "routes.ts");

// Recognized auth-guard middleware tokens. A mutating route registration that
// contains ANY of these (before its handler) is considered scope-guarded.
const GUARD_TOKENS = [
  "requireAdmin",
  "requirePortal",
  "requireBoardAccessReadOnly",
  "requireBoardAccess",
  "requireVendorPortal",
];

// Path PREFIXES that are guarded by a non-session mechanism (documented):
//   /api/webhooks/  — external callers; verified by request-signature middleware
//                     (Stripe/Twilio/Plaid), never an admin/portal session.
//   /api/public/    — deliberately public intake (demo request, onboarding-invite
//                     submit via a single-use token in the URL).
const ALLOWLIST_PREFIXES = ["/api/webhooks/", "/api/public/"];

// EXPLICIT per-route allowlist: pre-auth login + single-use-token routes that
// CANNOT require a session because they establish one / are the token itself.
// Each MUST stay deliberately reviewed — adding a route here is a security
// decision, not a convenience.
const ALLOWLIST_ROUTES = new Set<string>([
  "/api/portal/request-login", // portal owner login — pre-auth (issues the session)
  "/api/portal/verify-login", // portal owner login — pre-auth (verifies OTP)
  "/api/vendor-portal/request-login", // vendor login — pre-auth
  "/api/vendor-portal/verify-login", // vendor login — pre-auth
  "/api/portal/payments/link/:token/checkout-session", // magic-link token auth (token in URL)
  "/api/elections/ballot/:token/cast", // single-use ballot token auth (token in URL)
  "/api/founder-feedback", // William-only contextual feedback (2026-07-17) — identity resolved + allowlist-checked internally (server/founder-feedback.ts isFounderFeedbackEmail) across admin/portal/session surfaces; see the matching entry + rationale in tests/auth-surface-parity.test.ts
]);

type RouteReg = { verb: string; path: string; line: number; head: string };

/** Enumerate mutating /api route registrations with their guard "head" (the
 * span from the registration to the handler start), block-aware. */
function enumerateMutatingRoutes(src: string): RouteReg[] {
  const lines = src.split("\n");
  const out: RouteReg[] = [];
  const startRe = /app\.(post|patch|put|delete)\(\s*"(\/api\/[^"]+)"/;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(startRe);
    if (!m) continue;
    // Collect the registration head: from this line until the handler start
    // (`async` / `(req` / `(_req`), capped at 12 lines (defensive).
    let head = lines[i];
    for (let j = i + 1; j < Math.min(i + 12, lines.length); j++) {
      if (/\basync\b|\(_?req\b|\(req:/.test(lines[j])) {
        head += "\n" + lines[j];
        break;
      }
      head += "\n" + lines[j];
    }
    out.push({ verb: m[1], path: m[2], line: i + 1, head });
  }
  return out;
}

function isGuarded(reg: RouteReg): boolean {
  if (ALLOWLIST_ROUTES.has(reg.path)) return true;
  if (ALLOWLIST_PREFIXES.some((p) => reg.path.startsWith(p))) return true;
  // Only inspect the head UP TO the handler start (avoid matching a token that
  // merely appears inside the handler body).
  const headBeforeHandler = reg.head.split(/\basync\b|\(_?req\b|\(req:/)[0];
  return GUARD_TOKENS.some((t) => headBeforeHandler.includes(t));
}

describe("CQ-010 — every mutating /api route in server/routes.ts is scope-guarded", () => {
  const src = readFileSync(ROUTES_TS, "utf8");
  const routes = enumerateMutatingRoutes(src);

  it("enumerates a plausible number of mutating routes (guards against a broken parser)", () => {
    // If this drops toward 0 the parser broke and the coverage below is vacuous.
    expect(routes.length).toBeGreaterThan(250);
  });

  it("every mutating route carries a recognized auth guard or is explicitly allowlisted", () => {
    const unguarded = routes.filter((r) => !isGuarded(r));
    const report = unguarded
      .map((r) => `  ${r.verb.toUpperCase()} ${r.path}  (routes.ts:${r.line})`)
      .join("\n");
    expect(
      unguarded.length,
      unguarded.length === 0
        ? ""
        : `Mutating route(s) with NO recognized auth guard and not on the allowlist —\n` +
            `add the correct guard (requireAdmin / requirePortal / requireBoardAccess / requireVendorPortal),\n` +
            `or, if genuinely pre-auth/public, add it to ALLOWLIST_ROUTES/ALLOWLIST_PREFIXES with a documented reason:\n${report}\n`,
    ).toBe(0);
  });

  it("the explicit route allowlist stays minimal (each entry is a reviewed security decision)", () => {
    // A ceiling so the allowlist can't quietly become an escape hatch.
    expect(ALLOWLIST_ROUTES.size).toBeLessThanOrEqual(10);
  });
});
