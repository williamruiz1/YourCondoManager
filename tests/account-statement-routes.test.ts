/**
 * Owner account-statement ROUTE tests (#8533 acceptance: "no unauthorized-unit
 * access possible (test proves it)").
 *
 * Locks the auth + tenant-isolation contract of the two statement routes
 * (server/routes/account-statement.ts):
 *
 *   Portal — GET /api/portal/statement
 *     P1. 403 when the portal session carries no association/person scope.
 *     P2. Scope comes from the SESSION, never the query: a request smuggling
 *         personId/associationId query params still resolves to the session's
 *         identity (an owner cannot request someone else's statement).
 *     P3. 400 on missing/invalid period bounds.
 *
 *   Admin — GET /api/financial/owner-ledger/statement
 *     A1. Tenant fence: assertAssociationScope rejects an out-of-scope
 *         associationId BEFORE any statement is computed.
 *     A2. 404 (not an existence leak) when the person isn't in the caller's
 *         association — the service returns null and the route must not
 *         confirm cross-tenant existence.
 *     A3. Happy path returns the service's statement JSON.
 *
 * Pattern per server/alerts/__tests__/cross-association-endpoint.test.ts:
 * tiny ad-hoc express app + stub guards + fetch against an ephemeral port —
 * no DB, no full storage stack. buildAccountStatement is mocked; the real
 * parsePeriodBounds runs (it's pure and its own tests live in
 * tests/account-statement.test.ts).
 */
import express from "express";
import type { AddressInfo } from "node:net";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const buildAccountStatement = vi.fn();

vi.mock("../server/services/account-statement", async () => {
  const math = await vi.importActual<
    typeof import("../server/services/account-statement-math")
  >("../server/services/account-statement-math");
  return {
    buildAccountStatement: (...args: unknown[]) => buildAccountStatement(...args),
    parsePeriodBounds: math.parsePeriodBounds,
    computeStatement: math.computeStatement,
  };
});

const { registerAccountStatementRoutes } = await import(
  "../server/routes/account-statement"
);

// ── Stub guards ──────────────────────────────────────────────────────────────
// Session state the stubs inject — mutated per test.
const sessionState = {
  portal: {
    authed: true,
    associationId: "assoc-OWNER" as string | undefined,
    personId: "person-OWNER" as string | undefined,
  },
  admin: {
    authed: true,
    scopedAssociationIds: ["assoc-SCOPED"],
  },
};

const app = express();
registerAccountStatementRoutes(app, {
  requirePortal: (req, res, next) => {
    if (!sessionState.portal.authed) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    (req as any).portalAssociationId = sessionState.portal.associationId;
    (req as any).portalPersonId = sessionState.portal.personId;
    next();
  },
  requireAdmin: (req, res, next) => {
    if (!sessionState.admin.authed) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    (req as any).adminScopedAssociationIds = sessionState.admin.scopedAssociationIds;
    next();
  },
  requireAdminRole: () => (_req, _res, next) => next(),
  getAssociationIdQuery: (req) =>
    typeof req.query.associationId === "string" ? req.query.associationId : undefined,
  assertAssociationScope: (req, associationId) => {
    const scoped = (req as any).adminScopedAssociationIds as string[];
    if (!scoped.includes(associationId)) {
      throw new Error(`association ${associationId} out of scope`);
    }
  },
});

const server = app.listen(0);
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

afterAll(() => server.close());

beforeEach(() => {
  buildAccountStatement.mockReset();
  sessionState.portal = {
    authed: true,
    associationId: "assoc-OWNER",
    personId: "person-OWNER",
  };
  sessionState.admin = { authed: true, scopedAssociationIds: ["assoc-SCOPED"] };
});

const STATEMENT_STUB = { openingBalance: 0, closingBalance: 0, lineItems: [] };

describe("GET /api/portal/statement — owner isolation", () => {
  it("P1: 403 when the portal session carries no person scope", async () => {
    sessionState.portal.personId = undefined;
    const res = await fetch(`${base}/api/portal/statement?from=2026-03-01&to=2026-03-31`);
    expect(res.status).toBe(403);
    expect(buildAccountStatement).not.toHaveBeenCalled();
  });

  it("P2: identity comes from the session — smuggled personId/associationId/unit query params cannot re-scope", async () => {
    buildAccountStatement.mockResolvedValue(STATEMENT_STUB);
    const res = await fetch(
      `${base}/api/portal/statement?from=2026-03-01&to=2026-03-31` +
        `&personId=person-VICTIM&associationId=assoc-VICTIM`,
    );
    expect(res.status).toBe(200);
    expect(buildAccountStatement).toHaveBeenCalledTimes(1);
    const arg = buildAccountStatement.mock.calls[0][0] as Record<string, unknown>;
    // The session identity won; the smuggled params were ignored.
    expect(arg.associationId).toBe("assoc-OWNER");
    expect(arg.personId).toBe("person-OWNER");
  });

  it("P2b: unitId narrows but stays person-scoped (a foreign unitId can never widen scope)", async () => {
    buildAccountStatement.mockResolvedValue(STATEMENT_STUB);
    await fetch(
      `${base}/api/portal/statement?from=2026-03-01&to=2026-03-31&unitId=unit-NOT-MINE`,
    );
    const arg = buildAccountStatement.mock.calls[0][0] as Record<string, unknown>;
    // unitId passes through ONLY as an additional narrowing filter on a query
    // that is already fenced to the session's associationId + personId — a
    // unit the owner doesn't hold yields zero rows, not another owner's data.
    expect(arg.unitId).toBe("unit-NOT-MINE");
    expect(arg.personId).toBe("person-OWNER");
    expect(arg.associationId).toBe("assoc-OWNER");
  });

  it("P3: 400 on missing or inverted period bounds", async () => {
    const missing = await fetch(`${base}/api/portal/statement`);
    expect(missing.status).toBe(400);
    const inverted = await fetch(
      `${base}/api/portal/statement?from=2026-03-31&to=2026-03-01`,
    );
    expect(inverted.status).toBe(400);
    expect(buildAccountStatement).not.toHaveBeenCalled();
  });
});

describe("GET /api/financial/owner-ledger/statement — tenant fence", () => {
  it("A1: an out-of-scope associationId is rejected before any computation", async () => {
    const res = await fetch(
      `${base}/api/financial/owner-ledger/statement` +
        `?associationId=assoc-FOREIGN&personId=person-1&from=2026-03-01&to=2026-03-31`,
    );
    expect(res.status).toBe(500); // assertAssociationScope throws → route catch
    expect(buildAccountStatement).not.toHaveBeenCalled();
  });

  it("A2: cross-tenant person resolves 404 without confirming existence", async () => {
    buildAccountStatement.mockResolvedValue(null);
    const res = await fetch(
      `${base}/api/financial/owner-ledger/statement` +
        `?associationId=assoc-SCOPED&personId=person-ELSEWHERE&from=2026-03-01&to=2026-03-31`,
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { message: string };
    expect(body.message).toBe("Owner not found in this association");
  });

  it("A3: happy path returns the computed statement for an in-scope association", async () => {
    buildAccountStatement.mockResolvedValue(STATEMENT_STUB);
    const res = await fetch(
      `${base}/api/financial/owner-ledger/statement` +
        `?associationId=assoc-SCOPED&personId=person-1&from=2026-03-01&to=2026-03-31&unitId=unit-9`,
    );
    expect(res.status).toBe(200);
    const arg = buildAccountStatement.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.associationId).toBe("assoc-SCOPED");
    expect(arg.personId).toBe("person-1");
    expect(arg.unitId).toBe("unit-9");
  });
});
