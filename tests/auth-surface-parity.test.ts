/**
 * Auth Surface-Parity Gate — YCM Redesign F2 (founder-os#10188).
 *
 * Locks the surface-parity enumeration documented in
 * `docs/security/session-model-across-surfaces.md` §3.
 *
 * The invariant (auth-surface-parity discipline): every consumer-facing
 * `/api/*` route registration must accept a session path — i.e. it MUST
 * carry one of the server guards (`requireAdmin`, `requirePortal`,
 * `requireVendorPortal`) OR be an explicit, justified public-by-design
 * entry (auth entry point, signature-verified webhook, token-bearer link,
 * public marketing/hub page, infra probe, or a route with documented
 * internal authorization).
 *
 * A route that is NEITHER guarded NOR public-allowlisted is a parity
 * violation — either a LEAK (data route with no guard) or a LOCKOUT
 * (a class that cannot reach its own data). This test is the mechanical
 * stop against a half-migrated auth cutover: any new owner-data route
 * MUST add `requirePortal`, any new manager-data route MUST add
 * `requireAdmin`, and any genuinely public route MUST be added to
 * PUBLIC_BY_DESIGN below with a one-line justification.
 *
 * Why a source-scan instead of importing the route registry:
 *   `server/routes.ts` imports the entire route-registration surface
 *   (storage, db, auth, every drizzle schema, every domain service) at
 *   module load — pulling it into a unit test would require mocking the
 *   whole world. The repo convention (see
 *   `server/__tests__/assert-association-scope.test.ts`) is to lock the
 *   contract by reading the source as text. This test scans the live
 *   route source, so the enumeration cannot drift silently.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const SERVER_DIR = join(__dirname, "..", "server");

function routeSourceFiles(): string[] {
  const files = [join(SERVER_DIR, "routes.ts"), join(SERVER_DIR, "auth.ts")];
  const routesDir = join(SERVER_DIR, "routes");
  for (const f of readdirSync(routesDir)) {
    if (f.endsWith(".ts")) files.push(join(routesDir, f));
  }
  return files;
}

/** Server middleware that constitute an accepted session path. */
const SESSION_GUARDS = /requireAdmin|requirePortal|requireVendorPortal/;

/**
 * Public-by-design prefixes. Each entry is a route class that MUST be
 * reachable without a session guard, with the reason it is safe. A route
 * that lands here without belonging to one of these classes is a bug in
 * the allowlist, not an exemption to grant lightly.
 */
const PUBLIC_BY_DESIGN: Array<{ prefix: string; why: string }> = [
  { prefix: "/api/auth/", why: "auth entry points (OAuth start/callback, logout, me, magic-link, session-restore) — cannot require a session to establish one" },
  { prefix: "/api/callback/google", why: "OAuth callback alias — auth entry" },
  { prefix: "/api/portal/request-login", why: "owner OTP login entry — cannot require a session to establish one" },
  { prefix: "/api/portal/verify-login", why: "owner OTP verify — mints the portal access id" },
  { prefix: "/api/vendor-portal/request-login", why: "vendor OTP login entry" },
  { prefix: "/api/vendor-portal/verify-login", why: "vendor OTP verify — mints the vendor credential id" },
  { prefix: "/api/portal/payments/link/", why: "pay-by-link — the URL magic-link token IS the credential (owner pays with no login)" },
  { prefix: "/api/elections/ballot/", why: "election ballot — the ballot token IS the credential" },
  { prefix: "/api/platform/email/tracking/", why: "email open/click tracking — the tracking token IS the credential (pixel/redirect)" },
  { prefix: "/api/public/", why: "public marketing/signup/onboarding entry (demo-request, signup start/complete, invite tokens)" },
  { prefix: "/api/hub/", why: "community hub public pages (visibilityLevel=public, buildings/map/static-map)" },
  { prefix: "/api/webhooks/", why: "inbound provider webhooks — authenticated by signature verification, not session (Stripe/Plaid/Twilio)" },
  { prefix: "/api/plaid/oauth-return", why: "Plaid OAuth return callback — public redirect target" },
  { prefix: "/api/portal/push/vapid-public-key", why: "VAPID public key is public by definition" },
  { prefix: "/api/health", why: "infra healthcheck" },
  { prefix: "/api/system/bootstrap-status", why: "infra bootstrap probe" },
  { prefix: "/api/uploads/", why: "authorization enforced internally in server/uploads-access.ts (validateUploadFilename + auth-before-exists + empty-scope-fail-closed)" },
  { prefix: "/api/feedback", why: "William-only contextual feedback (2026-07-17) — deliberately surface-agnostic (admin session, portal header, or general session, whichever exists); identity is resolved and checked against the server-side allowlist in server/founder-feedback.ts (isFounderFeedbackEmail) on EVERY call, not via a single requireAdmin/requirePortal guard, so it works across all three surfaces William visits. Ineligible/anonymous callers get eligible:false or a 403, never data." },
];

function isPublicByDesign(path: string): boolean {
  return PUBLIC_BY_DESIGN.some((e) => path === e.prefix || path.startsWith(e.prefix));
}

interface RouteReg {
  path: string;
  guarded: boolean;
  /** The middleware chunk between the path literal and the handler. */
  chunk: string;
  file: string;
}

function enumerateRoutes(): RouteReg[] {
  const reg = /app\.(get|post|put|patch|delete)\(\s*"(\/api\/[^"]*)"/g;
  const out: RouteReg[] = [];
  for (const file of routeSourceFiles()) {
    const src = readFileSync(file, "utf8");
    let m: RegExpExecArray | null;
    while ((m = reg.exec(src)) !== null) {
      const path = m[2];
      // Look at the text between the path literal and the handler start
      // (async ( | (req | (_req | =>) for the middleware chain. Captured at
      // the exact registration position so multiple registrations of the
      // same path are each classified independently (no indexOf ambiguity).
      const start = m.index + m[0].length;
      const rest = src.slice(start, start + 400);
      const handlerCut = rest.search(/async\s*\(|\(\s*req|\(\s*_req|=>/);
      const chunk = handlerCut > 0 ? rest.slice(0, handlerCut) : rest.slice(0, 200);
      out.push({ path, guarded: SESSION_GUARDS.test(chunk), chunk, file });
    }
  }
  return out;
}

describe("auth surface-parity gate (F2 / founder-os#10188)", () => {
  const routes = enumerateRoutes();

  it("discovers a substantial /api route surface (scan sanity)", () => {
    // Guards against a silently-broken scan reporting an empty surface
    // (which would make the parity assertion vacuously pass).
    expect(routes.length).toBeGreaterThan(400);
  });

  it("no /api/* route is unguarded AND not public-by-design (no leak, no lockout)", () => {
    const violations = routes
      .filter((r) => !r.guarded && !isPublicByDesign(r.path))
      .map((r) => `${r.path}  [${r.file.split("/").slice(-2).join("/")}]`);

    const unique = [...new Set(violations)].sort();
    expect(
      unique,
      `Parity violation — the following /api routes carry no session guard ` +
        `(requireAdmin/requirePortal/requireVendorPortal) and are not on the ` +
        `PUBLIC_BY_DESIGN allowlist. Add the correct guard, or (if genuinely ` +
        `public) add the prefix to PUBLIC_BY_DESIGN with a justification:\n` +
        unique.join("\n"),
    ).toEqual([]);
  });

  it("the manager session path is present (manager class not fully locked out)", () => {
    const adminRoutes = routes.filter((r) => /requireAdmin/.test(r.chunk));
    expect(adminRoutes.length).toBeGreaterThan(50);
  });

  it("the owner-portal session path is present (owner class not fully locked out)", () => {
    const portalRoutes = routes.filter(
      (r) => r.path.startsWith("/api/portal/") && /requirePortal/.test(r.chunk),
    );
    expect(portalRoutes.length).toBeGreaterThan(20);
  });

  it("owner scoping is server-derived: requirePortal attaches scope from the resolved access context, not client input", () => {
    const src = readFileSync(join(SERVER_DIR, "routes.ts"), "utf8");
    // requirePortal MUST read the header and resolve it server-side...
    expect(src).toMatch(/requirePortal[\s\S]*?req\.header\("x-portal-access-id"\)/);
    expect(src).toMatch(/resolvePortalAccessContext/);
    // ...and derive the owner's scope from the RESOLVED access record
    // (associationId + personId), never from a client-supplied field.
    expect(src).toMatch(/req\.portalAssociationId\s*=\s*access\.associationId/);
    expect(src).toMatch(/req\.portalPersonId\s*=\s*access\.personId/);
  });
});
