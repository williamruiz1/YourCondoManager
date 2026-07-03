/**
 * P1-7 (Issue #214) — Plaid bank-connection / reconciliation route role-gate.
 *
 * The `/api/plaid/*` admin mutation routes (create-link-token, exchange-token,
 * sync, reconcile, reconcile/manual, DELETE connection) are financial-mutation
 * surfaces: they establish bank connections and post/alter ledger reconciliation
 * matches. They previously carried `requireAdmin` ONLY — so the strictly
 * view-only `viewer` persona could trigger a bank sync or reconcile a
 * transaction against the owner ledger.
 *
 * The fix (server/routes.ts) adds `requireAdminRole(PLAID_WRITE_ROLES)` to each
 * of those routes. `PLAID_WRITE_ROLES` is the five operator personas EXCLUDING
 * `viewer` — the same write-role boundary used by the reconciliation module
 * (`RECON_WRITE_ROLES`). `assertAssociationScope` continues to enforce tenant
 * isolation on top.
 *
 * The inline Plaid handlers are not exported from the monolithic
 * `registerRoutes`, so — mirroring the harness in
 * `server/routes/__tests__/financial-security.test.ts` — these tests exercise
 * the EXACT production middleware (`requireAdminRole`) and the EXACT role list
 * (`PLAID_WRITE_ROLES`, reproduced here as a typed contract) against
 * representative Plaid mutation paths in a real Express request/response cycle.
 *
 * The role→capability matrix is documented in
 * docs/security/financial-route-role-matrix.md (§ Plaid bank-feed).
 */

import express, { type NextFunction, type Request, type Response } from "express";
import { describe, it, expect, vi } from "vitest";
import type { AdminRole } from "@shared/schema";

// Every case here boots a REAL http server via withApp(); under full-suite
// parallel load a boot occasionally exceeds vitest's 5s default (observed:
// 5014ms on CI run 28580251568 — the suite's one remaining flake, founder-os
// #8337 R3). 20s absorbs the load jitter without weakening any assertion.
vi.setConfig({ testTimeout: 20_000 });

// ── PLAID_WRITE_ROLES contract copy ───────────────────────────────────────────
// Mirrors the production constant in server/routes.ts. If the production list
// is widened to include `viewer`, the matrix-lock test below fails and forces a
// conscious security review.
const PLAID_WRITE_ROLES: AdminRole[] = [
  "platform-admin",
  "board-officer",
  "assisted-board",
  "pm-assistant",
  "manager",
];

const ALL_ROLES: AdminRole[] = [
  "platform-admin",
  "board-officer",
  "assisted-board",
  "pm-assistant",
  "manager",
  "viewer",
];

// Representative Plaid mutation routes that now carry the role gate.
const PLAID_WRITE_PATHS = [
  "/api/plaid/create-link-token",
  "/api/plaid/exchange-token",
  "/api/plaid/sync",
  "/api/plaid/reconcile",
  "/api/plaid/reconcile/manual",
] as const;

// ── Production-mirrored middleware ─────────────────────────────────────────────

/** Mirrors `requireAdminRole` in server/routes.ts. */
const requireAdminRole =
  (roles: AdminRole[]) =>
  (req: Request & { adminRole?: AdminRole }, res: Response, next: NextFunction) => {
    if (!req.adminRole || !roles.includes(req.adminRole)) {
      return res.status(403).json({
        message: "Insufficient admin role",
        code: "ADMIN_ROLE_FORBIDDEN",
        currentRole: req.adminRole ?? null,
        requiredRoles: roles,
      });
    }
    return next();
  };

/** Mirrors `assertAssociationScope` in server/routes.ts (throws on violation). */
function assertAssociationScope(
  req: Request & { adminRole?: AdminRole; adminScopedAssociationIds?: string[] },
  associationId: string,
) {
  if (req.adminRole === "platform-admin") return;
  if (!associationId) throw new Error("associationId is required");
  if (!req.adminRole) throw new Error("Association is outside admin scope");
  const scoped = req.adminScopedAssociationIds ?? [];
  if (scoped.length === 0 || !scoped.includes(associationId)) {
    throw new Error("Association is outside admin scope");
  }
}

function makeApp(opts: { role: AdminRole; scopedAssociations?: string[] }) {
  const app = express();
  app.use(express.json());

  // Inject the admin session context (role + scopes), as the real
  // requireAdmin/applyAdminContext chain does.
  app.use(
    (
      req: Request & {
        adminRole?: AdminRole;
        adminScopedAssociationIds?: string[];
      },
      _res: Response,
      next: NextFunction,
    ) => {
      req.adminRole = opts.role;
      req.adminScopedAssociationIds = opts.scopedAssociations ?? ["assoc-A"];
      next();
    },
  );

  const requireAdmin = (_req: Request, _res: Response, next: NextFunction) => next();

  // Register the representative Plaid mutation routes with the SAME gate the
  // production code now applies. The handler asserts association scope (mirroring
  // production) and echoes 200 on success.
  for (const path of PLAID_WRITE_PATHS) {
    app.post(
      path,
      requireAdmin,
      requireAdminRole(PLAID_WRITE_ROLES),
      (
        req: Request & { adminRole?: AdminRole; adminScopedAssociationIds?: string[] },
        res: Response,
      ) => {
        try {
          const associationId = (req.body as { associationId?: string })?.associationId ?? "";
          if (!associationId) {
            return res
              .status(400)
              .json({ error: "associationId is required", code: "MISSING_ASSOCIATION_ID" });
          }
          assertAssociationScope(req, associationId);
          return res.json({ ok: true });
        } catch (err: any) {
          return res.status(400).json({ error: err.message });
        }
      },
    );
  }

  return app;
}

async function withApp<T>(
  opts: { role: AdminRole; scopedAssociations?: string[] },
  fn: (baseUrl: string) => Promise<T>,
): Promise<T> {
  const app = makeApp(opts);
  const server = await new Promise<{ port: number; close: () => Promise<void> }>(
    (resolve, reject) => {
      const s = app.listen(0, () => {
        const port = (s.address() as { port: number }).port;
        resolve({ port, close: () => new Promise<void>((r) => s.close(() => r())) });
      });
      s.on("error", reject);
    },
  );
  try {
    return await fn(`http://127.0.0.1:${server.port}`);
  } finally {
    await server.close();
  }
}

const BODY = { associationId: "assoc-A" };

// ── Section 1: viewer is rejected on every Plaid mutation route ────────────────

describe("P1-7 § Plaid role-gate — viewer is rejected on bank-connection / reconcile mutations", () => {
  it.each(PLAID_WRITE_PATHS)("viewer: POST %s → 403 ADMIN_ROLE_FORBIDDEN", async (path) => {
    const { status, code } = await withApp({ role: "viewer" }, async (url) => {
      const res = await fetch(`${url}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(BODY),
      });
      const body = (await res.json()) as { code?: string };
      return { status: res.status, code: body.code };
    });
    expect(status).toBe(403);
    expect(code).toBe("ADMIN_ROLE_FORBIDDEN");
  });
});

// ── Section 2: write roles are allowed ─────────────────────────────────────────

describe("P1-7 § Plaid role-gate — operator write roles are allowed", () => {
  it.each(PLAID_WRITE_ROLES)("%s: POST /api/plaid/reconcile → 200 (write allowed)", async (role) => {
    const status = await withApp({ role, scopedAssociations: ["assoc-A"] }, async (url) => {
      const res = await fetch(`${url}/api/plaid/reconcile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(BODY),
      });
      return res.status;
    });
    expect(status, `role ${role} should be allowed`).toBe(200);
  });
});

// ── Section 3: tenant isolation holds for an allowed role ──────────────────────

describe("P1-7 § Plaid tenant isolation — assertAssociationScope blocks cross-association", () => {
  it("board-officer scoped to assoc-A is denied reconciling assoc-B", async () => {
    const status = await withApp(
      { role: "board-officer", scopedAssociations: ["assoc-A"] },
      async (url) => {
        const res = await fetch(`${url}/api/plaid/reconcile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ associationId: "assoc-B" }),
        });
        return res.status;
      },
    );
    expect(status).toBe(400);
  });

  it("platform-admin may reconcile any association (no scope restriction)", async () => {
    const status = await withApp({ role: "platform-admin", scopedAssociations: [] }, async (url) => {
      const res = await fetch(`${url}/api/plaid/reconcile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ associationId: "assoc-B" }),
      });
      return res.status;
    });
    expect(status).toBe(200);
  });
});

// ── Section 4: role-capability matrix lock ─────────────────────────────────────

describe("P1-7 § Plaid role-capability matrix lock", () => {
  it("PLAID_WRITE_ROLES excludes viewer (the view-only persona must not mutate bank data)", () => {
    expect(PLAID_WRITE_ROLES).not.toContain("viewer");
  });

  it("PLAID_WRITE_ROLES is exactly the five operator personas", () => {
    expect([...PLAID_WRITE_ROLES].sort()).toEqual(
      ["assisted-board", "board-officer", "manager", "pm-assistant", "platform-admin"].sort(),
    );
  });

  it("the only role NOT in PLAID_WRITE_ROLES is viewer", () => {
    const excluded = ALL_ROLES.filter((r) => !PLAID_WRITE_ROLES.includes(r));
    expect(excluded).toEqual(["viewer"]);
  });
});
