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
  findAssociationIdByConnectedAccount: vi.fn(async (accountId: string) => {
    const connId = connectionByAccountId.get(accountId);
    if (!connId) return null;
    const conn = connectionsById.get(connId);
    if (!conn) return null;
    return { associationId: conn.associationId, connectionId: conn.id };
  }),
}));

// founder-os#970 — reconciliation service is mocked at the route layer so no
// real DB is touched; the service's own behavior is unit-tested separately in
// server/services/__tests__/stripe-reconciliation.test.ts.
const reconcileCalls: Array<Record<string, unknown>> = [];
const chargeWriteCalls: Array<Record<string, unknown>> = [];
const reversalWriteCalls: Array<Record<string, unknown>> = [];
let reconciliationReportFixture: unknown[] = [];
vi.mock("../../services/stripe-reconciliation", () => ({
  REFUND_REVERSAL_REFERENCE_TYPE: "stripe_refund",
  DISPUTE_REVERSAL_REFERENCE_TYPE: "stripe_dispute",
  DISPUTE_FEE_REFERENCE_TYPE: "stripe_dispute_fee",
  writeLedgerEntryForCharge: vi.fn(async (input: Record<string, unknown>) => {
    chargeWriteCalls.push(input);
    // Simulate idempotency: first time a charge id is seen → created; repeat → skipped.
    const seen = chargeWriteCalls.filter((c) => c.chargeId === input.chargeId).length > 1;
    if (!input.metadata || !(input.metadata as Record<string, string>).hoa_id) {
      return { created: false, ledgerEntryId: null, skipped: "missing_metadata" };
    }
    return seen
      ? { created: false, ledgerEntryId: `led_${input.chargeId}`, skipped: "already_exists" }
      : { created: true, ledgerEntryId: `led_${input.chargeId}`, skipped: undefined };
  }),
  writeReversalLedgerEntry: vi.fn(async (input: Record<string, unknown>) => {
    reversalWriteCalls.push(input);
    // Simulate idempotency keyed on (referenceType, reversalId): first → created; repeat → skipped.
    const seen =
      reversalWriteCalls.filter(
        (c) => c.referenceType === input.referenceType && c.reversalId === input.reversalId,
      ).length > 1;
    return seen
      ? { created: false, ledgerEntryId: `rev_${input.reversalId}`, skipped: "already_exists" }
      : { created: true, ledgerEntryId: `rev_${input.reversalId}`, skipped: undefined };
  }),
  reconcilePayout: vi.fn(async (input: Record<string, unknown>) => {
    reconcileCalls.push(input);
    return {
      payoutReconId: "rec_1",
      payoutId: input.payoutId,
      status: "paid",
      chargeCount: 2,
      grossAmountCents: 50000,
      feeAmountCents: 2265,
      netAmountCents: 47735,
      varianceCents: 0,
      ledgerEntriesCreated: 2,
    };
  }),
  getReconciliationReport: vi.fn(async () => reconciliationReportFixture),
}));

// ── P0 payment-confirmation-ux (2026-07-14) ──────────────────────────────────
// Real terminal-status idempotency for updatePaymentTransactionStatus is
// proven directly against the actual implementation in
// server/services/__tests__/payment-service-status.test.ts (mocked db, not
// mocked wholesale). Here we mock the module at the route boundary — same
// style as stripe-reconciliation above — to assert the NEW webhook cases
// call it with the right args in the right scenarios. This models the SAME
// terminal-status guard (a fake in-memory paymentTransactions row keyed by
// transactionId) so a route-level "replay after succeeded" test proves the
// end-to-end wiring can't double-post either.
const updateStatusCalls: Array<Record<string, unknown>> = [];
const fakePaymentTransactions = new Map<string, { id: string; status: string; providerIntentId: string | null }>();
const TERMINAL = new Set(["succeeded", "failed", "canceled", "reversed"]);
vi.mock("../../services/payment-service", () => ({
  updatePaymentTransactionStatus: vi.fn(
    async (input: { transactionId?: string; providerIntentId?: string; status: string }) => {
      updateStatusCalls.push(input);
      const key = input.transactionId ?? input.providerIntentId ?? "";
      const existing = fakePaymentTransactions.get(key) ?? {
        id: input.transactionId ?? `txn-for-${key}`,
        status: "initiated",
        providerIntentId: null,
      };
      if (TERMINAL.has(existing.status)) return existing; // idempotent no-op, mirrors the real guard
      const updated = {
        id: existing.id,
        status: input.status,
        providerIntentId: existing.providerIntentId ?? input.providerIntentId ?? null,
      };
      fakePaymentTransactions.set(key, updated);
      return updated;
    },
  ),
}));

const receiptCalls: Array<{ transactionId: string }> = [];
vi.mock("../../services/payment-receipt-email", () => ({
  sendPaymentReceiptEmail: vi.fn(async (input: { transactionId: string }) => {
    receiptCalls.push(input);
    return { sent: true, skipped: false };
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
  reconcileCalls.length = 0;
  chargeWriteCalls.length = 0;
  reversalWriteCalls.length = 0;
  reconciliationReportFixture = [];
  updateStatusCalls.length = 0;
  receiptCalls.length = 0;
  fakePaymentTransactions.clear();
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
      expect(body.statementDescriptor).toBe("YCM-CHRY HILL HOA");
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

describe("GET /api/financial/stripe-connect/callback — post-onboarding return landing", () => {
  it("302s to the REAL client payments route (/app/financial/payments), not the 404 /financials/payments", async () => {
    associationsById.set("assoc-1", { id: "assoc-1", name: "Cherry Hill Court Condominiums" });
    await withApp(async (url) => {
      // Seed an in-progress Connect account (creates the _connect connection
      // the callback handler looks up before redirecting).
      await fetch(`${url}/api/financial/stripe-connect/onboarding-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ associationId: "assoc-1" }),
      });

      const res = await fetch(
        `${url}/api/financial/stripe-connect/callback?associationId=assoc-1`,
        { method: "GET", redirect: "manual" },
      );
      expect(res.status).toBe(302);
      const location = res.headers.get("location") ?? "";
      // The corrected landing route must exist in the client router.
      expect(location).toContain("/app/financial/payments");
      expect(location).toContain("stripeConnect=callback");
      expect(location).toContain("associationId=assoc-1");
      // Guard against regression to the dead route (singular /app/financial vs
      // the old wrong /financials/payments which renders a 404).
      expect(location.startsWith("/financials/payments")).toBe(false);
      expect(location).not.toMatch(/(^|[^a-z])\/financials\/payments/);
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

  it("ignores out-of-scope event types (e.g. payout.failed)", async () => {
    await withApp(async (url) => {
      const event = { type: "payout.failed", data: { object: { id: "po_x" } } };
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

// ── founder-os#970 / dispatch #3 — Gap C + payout reconciliation webhooks ─────
describe("platform Connect webhook — charge.succeeded (Gap C)", () => {
  function signEventBody(rawBody: string): string {
    const ts = Math.floor(Date.now() / 1000);
    const sig = createHmac("sha256", PLATFORM_WEBHOOK_SECRET).update(`${ts}.${rawBody}`).digest("hex");
    return `t=${ts},v1=${sig}`;
  }
  const fullMeta = { hoa_id: "assoc-1", owner_id: "per_1", unit_id: "unt_1", charge_type: "dues" };

  it("writes a ledger entry immediately on charge.succeeded", async () => {
    await withApp(async (url) => {
      const event = {
        id: "evt_1",
        type: "charge.succeeded",
        account: "acct_test_001",
        data: { object: { id: "ch_1", amount: 35000, metadata: fullMeta } },
      };
      const rawBody = JSON.stringify(event);
      const res = await fetch(`${url}/api/webhooks/stripe-connect/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Stripe-Signature": signEventBody(rawBody) },
        body: rawBody,
      });
      expect(res.status).toBe(200);
      const payload = (await res.json()) as { type: string; action: string; ledgerEntryId: string };
      expect(payload.type).toBe("charge.succeeded");
      expect(payload.action).toBe("ledger-written");
      expect(chargeWriteCalls).toHaveLength(1);
      expect(chargeWriteCalls[0].chargeId).toBe("ch_1");
      expect(chargeWriteCalls[0].source).toBe("charge.succeeded");
    });
  });

  it("does not double-write on webhook retry (idempotent)", async () => {
    await withApp(async (url) => {
      const event = {
        id: "evt_2",
        type: "charge.succeeded",
        account: "acct_test_001",
        data: { object: { id: "ch_retry", amount: 35000, metadata: fullMeta } },
      };
      const rawBody = JSON.stringify(event);
      const post = () =>
        fetch(`${url}/api/webhooks/stripe-connect/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Stripe-Signature": signEventBody(rawBody) },
          body: rawBody,
        });
      const first = (await (await post()).json()) as { action: string };
      const second = (await (await post()).json()) as { action: string };
      expect(first.action).toBe("ledger-written");
      expect(second.action).toBe("skipped:already_exists");
    });
  });

  it("rejects an unsigned charge.succeeded event", async () => {
    await withApp(async (url) => {
      const res = await fetch(`${url}/api/webhooks/stripe-connect/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "charge.succeeded", data: { object: { id: "ch_z" } } }),
      });
      expect(res.status).toBe(400);
    });
  });
});

// A-RECON-006 — refund/dispute reversal wiring (route layer). The reversal
// service is mocked; these prove the webhook handler iterates refunds, only
// reverses lost disputes, and posts the fee, keyed idempotently.
describe("platform Connect webhook — charge.refunded / dispute.closed (A-RECON-006)", () => {
  function signEventBody(rawBody: string): string {
    const ts = Math.floor(Date.now() / 1000);
    const sig = createHmac("sha256", PLATFORM_WEBHOOK_SECRET).update(`${ts}.${rawBody}`).digest("hex");
    return `t=${ts},v1=${sig}`;
  }
  const post = (url: string, event: unknown) => {
    const rawBody = JSON.stringify(event);
    return fetch(`${url}/api/webhooks/stripe-connect/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Stripe-Signature": signEventBody(rawBody) },
      body: rawBody,
    });
  };

  it("full refund posts one reversing entry (keyed on refund id)", async () => {
    await withApp(async (url) => {
      const res = await post(url, {
        id: "evt_r1",
        type: "charge.refunded",
        account: "acct_test_001",
        data: { object: { id: "ch_1", refunds: { data: [{ id: "re_1", amount: 35000, status: "succeeded" }] } } },
      });
      expect(res.status).toBe(200);
      const payload = (await res.json()) as { action: string; reversals: unknown[] };
      expect(payload.action).toBe("refund-reversed");
      expect(reversalWriteCalls).toHaveLength(1);
      expect(reversalWriteCalls[0].chargeId).toBe("ch_1");
      expect(reversalWriteCalls[0].reversalId).toBe("re_1");
      expect(reversalWriteCalls[0].referenceType).toBe("stripe_refund");
      expect(reversalWriteCalls[0].amountCents).toBe(35000);
    });
  });

  it("partial refund posts a partial reversal", async () => {
    await withApp(async (url) => {
      await post(url, {
        id: "evt_r2",
        type: "charge.refunded",
        account: "acct_test_001",
        data: { object: { id: "ch_2", refunds: { data: [{ id: "re_2", amount: 12000, status: "succeeded" }] } } },
      });
      expect(reversalWriteCalls).toHaveLength(1);
      expect(reversalWriteCalls[0].amountCents).toBe(12000);
    });
  });

  it("duplicate refund webhook is idempotent (no double-reversal)", async () => {
    await withApp(async (url) => {
      const event = {
        id: "evt_r3",
        type: "charge.refunded",
        account: "acct_test_001",
        data: { object: { id: "ch_3", refunds: { data: [{ id: "re_3", amount: 5000, status: "succeeded" }] } } },
      };
      const first = (await (await post(url, event)).json()) as { reversals: Array<{ created: boolean; skipped?: string }> };
      const second = (await (await post(url, event)).json()) as { reversals: Array<{ created: boolean; skipped?: string }> };
      expect(first.reversals[0].created).toBe(true);
      expect(second.reversals[0].created).toBe(false);
      expect(second.reversals[0].skipped).toBe("already_exists");
    });
  });

  it("dispute lost posts reversal + fee", async () => {
    await withApp(async (url) => {
      const res = await post(url, {
        id: "evt_d1",
        type: "charge.dispute.closed",
        account: "acct_test_001",
        data: {
          object: {
            id: "dp_1",
            charge: "ch_4",
            amount: 35000,
            status: "lost",
            balance_transactions: [{ fee: 1500 }],
          },
        },
      });
      expect(res.status).toBe(200);
      const payload = (await res.json()) as { action: string; fee: { created: boolean } | null };
      expect(payload.action).toBe("dispute-reversed");
      // one reversal (disputed amount) + one fee = 2 calls
      expect(reversalWriteCalls).toHaveLength(2);
      const reversal = reversalWriteCalls.find((c) => c.referenceType === "stripe_dispute");
      const fee = reversalWriteCalls.find((c) => c.referenceType === "stripe_dispute_fee");
      expect(reversal?.amountCents).toBe(35000);
      expect(fee?.amountCents).toBe(1500);
      expect(payload.fee?.created).toBe(true);
    });
  });

  it("dispute won/closed (not lost) does not reverse — just acknowledged", async () => {
    await withApp(async (url) => {
      const res = await post(url, {
        id: "evt_d2",
        type: "charge.dispute.closed",
        account: "acct_test_001",
        data: { object: { id: "dp_2", charge: "ch_5", amount: 35000, status: "won" } },
      });
      const payload = (await res.json()) as { action: string };
      expect(payload.action).toBe("acknowledged");
      expect(reversalWriteCalls).toHaveLength(0);
    });
  });

  it("dispute.created is acknowledged, not reversed (funds not yet lost)", async () => {
    await withApp(async (url) => {
      const res = await post(url, {
        id: "evt_d3",
        type: "charge.dispute.created",
        account: "acct_test_001",
        data: { object: { id: "dp_3", charge: "ch_6", amount: 35000, status: "needs_response" } },
      });
      const payload = (await res.json()) as { action: string };
      expect(payload.action).toBe("acknowledged");
      expect(reversalWriteCalls).toHaveLength(0);
    });
  });
});

describe("platform Connect webhook — payout.paid (reconciliation)", () => {
  function signEventBody(rawBody: string): string {
    const ts = Math.floor(Date.now() / 1000);
    const sig = createHmac("sha256", PLATFORM_WEBHOOK_SECRET).update(`${ts}.${rawBody}`).digest("hex");
    return `t=${ts},v1=${sig}`;
  }

  async function seedActiveConnection(url: string) {
    associationsById.set("assoc-1", { id: "assoc-1", name: "Cherry Hill Court Condominiums" });
    await fetch(`${url}/api/financial/stripe-connect/onboarding-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ associationId: "assoc-1" }),
    });
  }

  it("reconciles a payout into the owning HOA", async () => {
    await withApp(async (url) => {
      await seedActiveConnection(url);
      const event = {
        id: "evt_po",
        type: "payout.paid",
        account: "acct_test_001",
        data: { object: { id: "po_1", amount: 47735, currency: "usd", status: "paid", arrival_date: 1779400000 } },
      };
      const rawBody = JSON.stringify(event);
      const res = await fetch(`${url}/api/webhooks/stripe-connect/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Stripe-Signature": signEventBody(rawBody) },
        body: rawBody,
      });
      expect(res.status).toBe(200);
      const payload = (await res.json()) as { action: string; summary: { varianceCents: number } };
      expect(payload.action).toBe("reconciled");
      expect(payload.summary.varianceCents).toBe(0);
      expect(reconcileCalls).toHaveLength(1);
      expect(reconcileCalls[0].connectedAccountId).toBe("acct_test_001");
      expect(reconcileCalls[0].associationId).toBe("assoc-1");
      expect(reconcileCalls[0].payoutId).toBe("po_1");
    });
  });

  it("returns not-tracked when the connected account is unknown", async () => {
    await withApp(async (url) => {
      const event = {
        id: "evt_po2",
        type: "payout.paid",
        account: "acct_unknown",
        data: { object: { id: "po_2", amount: 1000, currency: "usd", status: "paid" } },
      };
      const rawBody = JSON.stringify(event);
      const res = await fetch(`${url}/api/webhooks/stripe-connect/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Stripe-Signature": signEventBody(rawBody) },
        body: rawBody,
      });
      expect(res.status).toBe(200);
      const payload = (await res.json()) as { action: string };
      expect(payload.action).toBe("not-tracked");
      expect(reconcileCalls).toHaveLength(0);
    });
  });

  it("400s a payout.paid event missing the connected account header", async () => {
    await withApp(async (url) => {
      const event = { id: "evt_po3", type: "payout.paid", data: { object: { id: "po_3", amount: 1000 } } };
      const rawBody = JSON.stringify(event);
      const res = await fetch(`${url}/api/webhooks/stripe-connect/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Stripe-Signature": signEventBody(rawBody) },
        body: rawBody,
      });
      expect(res.status).toBe(400);
    });
  });
});

describe("GET /api/financial/stripe-connect/reconciliation", () => {
  it("returns payouts + portfolio totals + keyMode", async () => {
    reconciliationReportFixture = [
      {
        id: "rec_1",
        payoutId: "po_1",
        associationId: "assoc-1",
        connectedAccountId: "acct_test_001",
        keyMode: "test",
        status: "paid",
        currency: "usd",
        payoutAmountCents: 47735,
        grossAmountCents: 50000,
        feeAmountCents: 2265,
        reconciledNetCents: 47735,
        varianceCents: 0,
        chargeCount: 2,
        arrivalDate: null,
        reconciledAt: null,
        owners: [],
      },
    ];
    await withApp(async (url) => {
      const res = await fetch(`${url}/api/financial/stripe-connect/reconciliation?associationId=assoc-1`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        keyMode: string;
        payoutCount: number;
        totals: { payoutAmountCents: number; varianceCents: number };
        payouts: unknown[];
      };
      expect(body.payoutCount).toBe(1);
      expect(body.totals.payoutAmountCents).toBe(47735);
      expect(body.totals.varianceCents).toBe(0);
      expect(body.keyMode).toBe("test");
      expect(body.payouts).toHaveLength(1);
    });
  });
});

describe("GET /api/financial/stripe-connect/connections — keyMode (Gap D)", () => {
  it("attaches the platform key mode to every connection row", async () => {
    associationsById.set("assoc-1", { id: "assoc-1", name: "Cherry Hill" });
    await withApp(async (url) => {
      await fetch(`${url}/api/financial/stripe-connect/onboarding-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ associationId: "assoc-1" }),
      });
      const res = await fetch(`${url}/api/financial/stripe-connect/connections`);
      expect(res.status).toBe(200);
      const rows = (await res.json()) as Array<{ associationId: string; keyMode: string }>;
      expect(rows).toHaveLength(1);
      // PLATFORM_STRIPE_SECRET_KEY mock returns "sk_test_platform" → test mode.
      expect(rows[0].keyMode).toBe("test");
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

// ── P0 payment-confirmation-ux (founder-os incident 2026-07-14) ─────────────
// William's real Cherry Hill dues payment ($330 ACH) completed at Stripe
// (checkout.session.completed / payment_intent.processing both fired) but
// the owner portal showed nothing — the payment_transactions row sat mute
// at "initiated" for the whole 3-5 business day ACH window, and the success
// redirect (?payment=success&txn=) was never read by the frontend either
// (see client/src/pages/portal/portal-home.tsx for that half of the fix).
// These two new webhook cases surface a portal-visible "pending" status
// immediately. Neither touches the ledger — that remains exclusively on
// writeLedgerEntryForCharge's timing (charge.succeeded, unchanged above).
describe("platform Connect webhook — checkout.session.completed (payment-confirmation-ux)", () => {
  function signEventBody(rawBody: string): string {
    const ts = Math.floor(Date.now() / 1000);
    const sig = createHmac("sha256", PLATFORM_WEBHOOK_SECRET).update(`${ts}.${rawBody}`).digest("hex");
    return `t=${ts},v1=${sig}`;
  }

  it("marks the transaction pending + backfills the payment_intent id (ACH, payment_status=unpaid)", async () => {
    await withApp(async (url) => {
      const event = {
        id: "evt_ach_1",
        type: "checkout.session.completed",
        account: "acct_test_001",
        data: {
          object: {
            id: "cs_live_ach_1",
            payment_intent: "pi_ach_1",
            payment_status: "unpaid", // ACH — funds not yet cleared, normal
            metadata: { transactionId: "txn-ach-1" },
          },
        },
      };
      const rawBody = JSON.stringify(event);
      const res = await fetch(`${url}/api/webhooks/stripe-connect/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Stripe-Signature": signEventBody(rawBody) },
        body: rawBody,
      });
      expect(res.status).toBe(200);
      const payload = (await res.json()) as { type: string; action: string };
      expect(payload.type).toBe("checkout.session.completed");
      expect(payload.action).toBe("marked-pending");
      expect(updateStatusCalls).toHaveLength(1);
      expect(updateStatusCalls[0]).toMatchObject({
        transactionId: "txn-ach-1",
        providerIntentId: "pi_ach_1",
        status: "pending",
      });
      expect(fakePaymentTransactions.get("txn-ach-1")).toMatchObject({ status: "pending" });
    });
  });

  it("is a no-op (not-tracked) when the session has no transactionId or payment_intent", async () => {
    await withApp(async (url) => {
      const event = {
        id: "evt_ach_2",
        type: "checkout.session.completed",
        account: "acct_test_001",
        data: { object: { id: "cs_untracked", metadata: {} } },
      };
      const rawBody = JSON.stringify(event);
      const res = await fetch(`${url}/api/webhooks/stripe-connect/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Stripe-Signature": signEventBody(rawBody) },
        body: rawBody,
      });
      expect(res.status).toBe(200);
      const payload = (await res.json()) as { action: string };
      expect(payload.action).toBe("not-tracked");
      expect(updateStatusCalls).toHaveLength(0);
    });
  });
});

describe("platform Connect webhook — payment_intent.processing (payment-confirmation-ux)", () => {
  function signEventBody(rawBody: string): string {
    const ts = Math.floor(Date.now() / 1000);
    const sig = createHmac("sha256", PLATFORM_WEBHOOK_SECRET).update(`${ts}.${rawBody}`).digest("hex");
    return `t=${ts},v1=${sig}`;
  }

  it("marks the transaction pending (fires the instant an ACH debit is submitted)", async () => {
    await withApp(async (url) => {
      const event = {
        id: "evt_proc_1",
        type: "payment_intent.processing",
        account: "acct_test_001",
        data: { object: { id: "pi_proc_1", metadata: { transactionId: "txn-proc-1" } } },
      };
      const rawBody = JSON.stringify(event);
      const res = await fetch(`${url}/api/webhooks/stripe-connect/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Stripe-Signature": signEventBody(rawBody) },
        body: rawBody,
      });
      expect(res.status).toBe(200);
      const payload = (await res.json()) as { action: string };
      expect(payload.action).toBe("marked-pending");
      expect(updateStatusCalls[0]).toMatchObject({
        transactionId: "txn-proc-1",
        providerIntentId: "pi_proc_1",
        status: "pending",
      });
    });
  });
});

describe("platform Connect webhook — charge.succeeded flips payment_transactions status too (payment-confirmation-ux)", () => {
  function signEventBody(rawBody: string): string {
    const ts = Math.floor(Date.now() / 1000);
    const sig = createHmac("sha256", PLATFORM_WEBHOOK_SECRET).update(`${ts}.${rawBody}`).digest("hex");
    return `t=${ts},v1=${sig}`;
  }
  const fullMeta = { hoa_id: "assoc-1", owner_id: "per_1", unit_id: "unt_1", charge_type: "dues" };

  it("flips the transaction to succeeded alongside the ledger write, additively", async () => {
    await withApp(async (url) => {
      const event = {
        id: "evt_charge_1",
        type: "charge.succeeded",
        account: "acct_test_001",
        data: {
          object: {
            id: "ch_settle_1",
            amount: 33000,
            payment_intent: "pi_settle_1",
            metadata: { ...fullMeta, transactionId: "txn-settle-1" },
          },
        },
      };
      const rawBody = JSON.stringify(event);
      const res = await fetch(`${url}/api/webhooks/stripe-connect/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Stripe-Signature": signEventBody(rawBody) },
        body: rawBody,
      });
      expect(res.status).toBe(200);
      const payload = (await res.json()) as { action: string };
      // The ledger write still happens exactly as before — untouched.
      expect(payload.action).toBe("ledger-written");
      expect(chargeWriteCalls).toHaveLength(1);
      // ...and the NEW additive call flips the owner-facing status too.
      expect(updateStatusCalls).toHaveLength(1);
      expect(updateStatusCalls[0]).toMatchObject({
        transactionId: "txn-settle-1",
        providerIntentId: "pi_settle_1",
        status: "succeeded",
      });
      expect(receiptCalls).toEqual([{ transactionId: "txn-settle-1" }]);
    });
  });

  it(
    "REGRESSION GUARD — a late-arriving checkout.session.completed replay " +
      "AFTER charge.succeeded already landed can NEVER regress the " +
      "transaction back to pending (the exact scenario the review flagged)",
    async () => {
      await withApp(async (url) => {
        // 1) charge.succeeded lands first — flips to succeeded.
        const succeededEvent = {
          id: "evt_charge_2",
          type: "charge.succeeded",
          account: "acct_test_001",
          data: {
            object: {
              id: "ch_settle_2",
              amount: 33000,
              payment_intent: "pi_settle_2",
              metadata: { ...fullMeta, transactionId: "txn-settle-2" },
            },
          },
        };
        const rawBody1 = JSON.stringify(succeededEvent);
        await fetch(`${url}/api/webhooks/stripe-connect/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Stripe-Signature": signEventBody(rawBody1) },
          body: rawBody1,
        });
        expect(fakePaymentTransactions.get("txn-settle-2")).toMatchObject({ status: "succeeded" });

        // 2) a re-delivered / out-of-order checkout.session.completed arrives
        //    AFTER settlement — Stripe's at-least-once delivery guarantee
        //    makes this a real scenario, not a hypothetical.
        const replayEvent = {
          id: "evt_ach_replay",
          type: "checkout.session.completed",
          account: "acct_test_001",
          data: {
            object: {
              id: "cs_live_settle_2",
              payment_intent: "pi_settle_2",
              payment_status: "unpaid",
              metadata: { transactionId: "txn-settle-2" },
            },
          },
        };
        const rawBody2 = JSON.stringify(replayEvent);
        const res2 = await fetch(`${url}/api/webhooks/stripe-connect/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Stripe-Signature": signEventBody(rawBody2) },
          body: rawBody2,
        });
        expect(res2.status).toBe(200);

        // Still succeeded — NOT regressed to pending. No second ledger write
        // either (writeLedgerEntryForCharge is never even called by this
        // event type — only charge.succeeded calls it, unchanged).
        expect(fakePaymentTransactions.get("txn-settle-2")).toMatchObject({ status: "succeeded" });
        expect(chargeWriteCalls).toHaveLength(1);
      });
    },
  );
});
