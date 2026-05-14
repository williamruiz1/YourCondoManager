/**
 * Route-level integration tests for the Stripe Connect onboarding flow.
 *
 * The Stripe API + database are mocked. We exercise:
 *   1. POST /onboarding-link creates a Connect account on first call,
 *      reuses an existing one on the second call.
 *   2. The platform webhook listener verifies signatures and updates
 *      the persisted connection on `account.updated`.
 *   3. The listing endpoint surfaces Connect-mode rows only.
 *
 * Mock seams: we vi.mock the storage helpers and the Stripe-API helpers
 * so no network call is made.
 */

import { createHmac } from "crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Fixture state (mutated by mocks) ──────────────────────────────────────────
type StoredConnection = {
  id: string;
  associationId: string;
  associationName: string | null;
  providerAccountId: string | null;
  isActive: number;
  metadataJson: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};
const associationsById = new Map<string, { id: string; name: string }>();
const connectionsById = new Map<string, StoredConnection>();
const connectionByAccountId = new Map<string, string>();

let stripeFetchCalls: Array<{ path: string; method: string; body?: string }> = [];
let stripeMockAccount: Record<string, unknown> = {
  id: "acct_test_001",
  charges_enabled: false,
  payouts_enabled: false,
  details_submitted: false,
};
let stripeMockLinkUrl = "https://connect.stripe.com/setup/s/test-link";
const PLATFORM_WEBHOOK_SECRET = "whsec_test_platform";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("../../platform-secrets-store", () => ({
  getSecret: async (envVar: string, _dbKey: string) => {
    if (envVar === "PLATFORM_STRIPE_SECRET_KEY") return "sk_test_platform";
    if (envVar === "PLATFORM_STRIPE_CONNECT_WEBHOOK_SECRET") return PLATFORM_WEBHOOK_SECRET;
    return null;
  },
}));

vi.mock("../../services/stripe-connect", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/stripe-connect")>();
  return {
    ...actual,
    createConnectedAccount: vi.fn(async (input: { hoaName: string }) => {
      stripeFetchCalls.push({ path: "/accounts", method: "POST" });
      const acct = { ...stripeMockAccount };
      return {
        accountId: acct.id as string,
        statementDescriptor: actual.buildStatementDescriptorPrefix(input.hoaName),
        raw: acct,
      };
    }),
    createAccountOnboardingLink: vi.fn(async () => {
      stripeFetchCalls.push({ path: "/account_links", method: "POST" });
      return { url: stripeMockLinkUrl, expiresAt: Math.floor(Date.now() / 1000) + 600 };
    }),
    retrieveConnectedAccount: vi.fn(async (id: string) => {
      stripeFetchCalls.push({ path: `/accounts/${id}`, method: "GET" });
      return stripeMockAccount;
    }),
  };
});

vi.mock("../../services/stripe-connect-storage", () => ({
  getAssociationById: vi.fn(async (id: string) => associationsById.get(id) ?? null),
  findConnectConnection: vi.fn(async (associationId: string) => {
    for (const conn of connectionsById.values()) {
      if (conn.associationId === associationId) {
        // Connect-mode means metadata._connect exists
        if (
          conn.metadataJson &&
          typeof conn.metadataJson === "object" &&
          (conn.metadataJson as Record<string, unknown>)._connect
        ) {
          return {
            id: conn.id,
            associationId: conn.associationId,
            provider: "stripe",
            providerAccountId: conn.providerAccountId,
            publishableKey: null,
            secretKeyMasked: null,
            webhookSecretMasked: null,
            validationStatus: "valid",
            validationMessage: null,
            isActive: conn.isActive,
            lastValidatedAt: new Date(),
            metadataJson: conn.metadataJson,
            createdAt: conn.createdAt,
            updatedAt: conn.updatedAt,
          };
        }
      }
    }
    return null;
  }),
  upsertConnectConnection: vi.fn(
    async (input: {
      associationId: string;
      accountId: string;
      account: Record<string, unknown>;
    }) => {
      const buildConnect = (await import("../../services/stripe-connect")).buildConnectMetadataState;
      const connectState = buildConnect(input.account);
      const id = `conn_${input.associationId}`;
      const stored: StoredConnection = {
        id,
        associationId: input.associationId,
        associationName: associationsById.get(input.associationId)?.name ?? null,
        providerAccountId: input.accountId,
        isActive: connectState.status === "active" ? 1 : 0,
        metadataJson: { _connect: connectState },
        createdAt: connectionsById.get(id)?.createdAt ?? new Date(),
        updatedAt: new Date(),
      };
      connectionsById.set(id, stored);
      connectionByAccountId.set(input.accountId, id);
      return {
        ...stored,
        provider: "stripe",
        publishableKey: null,
        secretKeyMasked: null,
        webhookSecretMasked: null,
        validationStatus: connectState.status === "active" ? "valid" : "invalid",
        validationMessage: null,
        lastValidatedAt: new Date(),
      };
    },
  ),
  applyAccountUpdated: vi.fn(async (account: Record<string, unknown>) => {
    const accountId = account.id as string;
    const connId = connectionByAccountId.get(accountId);
    if (!connId) return null;
    const buildConnect = (await import("../../services/stripe-connect")).buildConnectMetadataState;
    const connectState = buildConnect(account);
    const stored = connectionsById.get(connId)!;
    stored.metadataJson = { _connect: connectState };
    stored.isActive = connectState.status === "active" ? 1 : 0;
    stored.updatedAt = new Date();
    return { ...stored, provider: "stripe" };
  }),
  listConnectConnections: vi.fn(async (associationId: string | null) => {
    const rows: Array<Record<string, unknown>> = [];
    for (const conn of connectionsById.values()) {
      if (associationId && conn.associationId !== associationId) continue;
      const connectState = (conn.metadataJson as Record<string, unknown>)._connect;
      if (!connectState) continue;
      rows.push({
        id: conn.id,
        associationId: conn.associationId,
        associationName: conn.associationName,
        providerAccountId: conn.providerAccountId,
        isActive: conn.isActive,
        connectState,
        createdAt: conn.createdAt,
        updatedAt: conn.updatedAt,
      });
    }
    return rows;
  }),
}));

// Now import the route registrar (mocks above must be set first).
import { registerStripeConnectRoutes } from "../stripe-connect";

// ── Test fixture: express app with mocked admin middleware ────────────────────
function makeApp() {
  const app = express();
  // Stripe webhook needs raw body for signature verification; the existing
  // app sets `req.rawBody` upstream. We replicate that here.
  app.use(
    express.json({
      verify: (req: Request & { rawBody?: Buffer }, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  // Stub admin context — every request is platform-admin.
  app.use((req: Request & { adminUserId?: string; adminRole?: string }, _res, next) => {
    req.adminUserId = "admin-test";
    req.adminRole = "platform-admin";
    next();
  });

  const requireAdmin = (_req: Request, _res: Response, next: NextFunction) => next();
  const requireAdminRole = () => (_req: Request, _res: Response, next: NextFunction) => next();
  const getAssociationIdQuery = (req: Request) =>
    typeof req.query.associationId === "string" ? req.query.associationId : undefined;
  const assertAssociationScope = () => {
    /* always allow in tests */
  };

  registerStripeConnectRoutes(app, {
    requireAdmin,
    requireAdminRole,
    getAssociationIdQuery,
    assertAssociationScope,
  });
  return app;
}

async function withApp<T>(fn: (url: string) => Promise<T>): Promise<T> {
  const app = makeApp();
  const server = await new Promise<{ port: number; close: () => Promise<void> }>((resolve, reject) => {
    const s = app.listen(0, () => {
      const port = (s.address() as { port: number }).port;
      resolve({ port, close: () => new Promise((r) => s.close(() => r(undefined))) });
    });
    s.on("error", reject);
  });
  try {
    return await fn(`http://127.0.0.1:${server.port}`);
  } finally {
    await server.close();
  }
}

beforeEach(() => {
  associationsById.clear();
  connectionsById.clear();
  connectionByAccountId.clear();
  stripeFetchCalls = [];
  stripeMockAccount = {
    id: "acct_test_001",
    charges_enabled: false,
    payouts_enabled: false,
    details_submitted: false,
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/financial/stripe-connect/onboarding-link", () => {
  it("creates an account + onboarding link on first call", async () => {
    associationsById.set("assoc-1", { id: "assoc-1", name: "Cherry Hill Court Condominiums" });
    await withApp(async (url) => {
      const res = await fetch(`${url}/api/financial/stripe-connect/onboarding-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ associationId: "assoc-1" }),
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as {
        url: string;
        accountId: string;
        statementDescriptor: string;
      };
      expect(body.url).toBe("https://connect.stripe.com/setup/s/test-link");
      expect(body.accountId).toBe("acct_test_001");
      expect(body.statementDescriptor).toBe("CHRY HILL HOA");
    });
    // First-time path: account create + onboarding link
    expect(stripeFetchCalls.map((c) => c.path)).toContain("/accounts");
    expect(stripeFetchCalls.map((c) => c.path)).toContain("/account_links");
    expect(connectionsById.size).toBe(1);
  });

  it("reuses an existing Connect account on a follow-up call", async () => {
    associationsById.set("assoc-1", { id: "assoc-1", name: "Wawaset" });
    await withApp(async (url) => {
      await fetch(`${url}/api/financial/stripe-connect/onboarding-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ associationId: "assoc-1" }),
      });
      stripeFetchCalls = [];
      const res = await fetch(`${url}/api/financial/stripe-connect/onboarding-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ associationId: "assoc-1" }),
      });
      expect(res.status).toBe(201);
    });
    // Second call: no account create, only fresh onboarding link.
    expect(stripeFetchCalls.map((c) => c.path)).toEqual(["/account_links"]);
  });

  it("400s when associationId missing", async () => {
    await withApp(async (url) => {
      const res = await fetch(`${url}/api/financial/stripe-connect/onboarding-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });
  });

  it("404s when association does not exist", async () => {
    await withApp(async (url) => {
      const res = await fetch(`${url}/api/financial/stripe-connect/onboarding-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ associationId: "missing" }),
      });
      expect(res.status).toBe(404);
    });
  });
});

describe("POST /api/webhooks/stripe-connect/account-updated", () => {
  function signEventBody(rawBody: string): string {
    const ts = Math.floor(Date.now() / 1000);
    const sig = createHmac("sha256", PLATFORM_WEBHOOK_SECRET).update(`${ts}.${rawBody}`).digest("hex");
    return `t=${ts},v1=${sig}`;
  }

  it("rejects unsigned requests", async () => {
    await withApp(async (url) => {
      const res = await fetch(`${url}/api/webhooks/stripe-connect/account-updated`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "account.updated", data: { object: { id: "acct_x" } } }),
      });
      expect(res.status).toBe(400);
    });
  });

  it("rejects bad signatures", async () => {
    await withApp(async (url) => {
      const body = JSON.stringify({ type: "account.updated", data: { object: { id: "acct_x" } } });
      const res = await fetch(`${url}/api/webhooks/stripe-connect/account-updated`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Stripe-Signature": "t=1,v1=deadbeef",
        },
        body,
      });
      expect(res.status).toBe(403);
    });
  });

  it("applies account.updated when state transitions to active", async () => {
    // Seed: an HOA was onboarded in pending state.
    associationsById.set("assoc-1", { id: "assoc-1", name: "Cherry Hill Court Condominiums" });
    await withApp(async (url) => {
      await fetch(`${url}/api/financial/stripe-connect/onboarding-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ associationId: "assoc-1" }),
      });
      const stored = connectionsById.get("conn_assoc-1");
      expect(stored).toBeDefined();
      const initialState = (stored!.metadataJson as Record<string, unknown>)._connect as {
        status: string;
      };
      expect(initialState.status).toBe("pending");

      // Fire the webhook with the account now fully active.
      const account = {
        id: "acct_test_001",
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
      };
      const event = { type: "account.updated", data: { object: account } };
      const rawBody = JSON.stringify(event);
      const sig = signEventBody(rawBody);
      const res = await fetch(`${url}/api/webhooks/stripe-connect/account-updated`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Stripe-Signature": sig,
        },
        body: rawBody,
      });
      expect(res.status).toBe(200);
      const payload = (await res.json()) as { received: boolean; action: string };
      expect(payload.action).toBe("applied");

      // Stored row should now be active.
      const after = (connectionsById.get("conn_assoc-1")!.metadataJson as Record<string, unknown>)
        ._connect as { status: string; chargesEnabled: boolean; payoutsEnabled: boolean };
      expect(after.status).toBe("active");
      expect(after.chargesEnabled).toBe(true);
      expect(after.payoutsEnabled).toBe(true);
    });
  });

  it("ignores non-account.updated event types", async () => {
    await withApp(async (url) => {
      const event = { type: "charge.succeeded", data: { object: { id: "ch_x" } } };
      const rawBody = JSON.stringify(event);
      const sig = signEventBody(rawBody);
      const res = await fetch(`${url}/api/webhooks/stripe-connect/account-updated`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Stripe-Signature": sig,
        },
        body: rawBody,
      });
      expect(res.status).toBe(200);
      const payload = (await res.json()) as { action: string };
      expect(payload.action).toBe("ignored");
    });
  });
});

describe("GET /api/financial/stripe-connect/connections", () => {
  it("lists Connect-mode connections only", async () => {
    associationsById.set("assoc-1", { id: "assoc-1", name: "Cherry Hill" });
    associationsById.set("assoc-2", { id: "assoc-2", name: "Wawaset" });
    await withApp(async (url) => {
      // Seed two
      await fetch(`${url}/api/financial/stripe-connect/onboarding-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ associationId: "assoc-1" }),
      });
      stripeMockAccount = {
        id: "acct_test_002",
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
      };
      await fetch(`${url}/api/financial/stripe-connect/onboarding-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ associationId: "assoc-2" }),
      });

      const res = await fetch(`${url}/api/financial/stripe-connect/connections`);
      expect(res.status).toBe(200);
      const rows = (await res.json()) as Array<{ associationId: string; connectState: { status: string } }>;
      expect(rows).toHaveLength(2);
      const ids = rows.map((r) => r.associationId).sort();
      expect(ids).toEqual(["assoc-1", "assoc-2"]);
      for (const row of rows) {
        expect(row.connectState.status).toBe("pending");
      }
    });
  });
});
