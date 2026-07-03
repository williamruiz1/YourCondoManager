/**
 * Unit tests for `resolveConnectChargeRouting` — the dues-charge routing
 * decision (Stripe Connect direct charge vs legacy manual key).
 *
 * Verifies the gate: routing is returned ONLY when the association has a
 * Connect connection whose status is `active` AND the platform secret key is
 * configured. Every other case (no connection, pending/restricted/disabled,
 * missing platform key) returns null so the caller falls back to manual.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConnectMetadataState } from "../stripe-connect";

// ── Mocks ────────────────────────────────────────────────────────────────────
const mockFindConnectConnection = vi.fn();
const mockReadConnectState = vi.fn();
const mockGetSecret = vi.fn();

vi.mock("../stripe-connect-storage", () => ({
  findConnectConnection: (...args: unknown[]) => mockFindConnectConnection(...args),
  readConnectStateFromConnection: (...args: unknown[]) => mockReadConnectState(...args),
}));
vi.mock("../../platform-secrets-store", () => ({
  getSecret: (...args: unknown[]) => mockGetSecret(...args),
}));

import { resolveConnectChargeRouting } from "../stripe-connect-resolver";

function connectState(status: ConnectMetadataState["status"]): ConnectMetadataState {
  return {
    mode: "connect",
    status,
    chargesEnabled: status === "active",
    payoutsEnabled: status === "active",
    detailsSubmitted: status !== "pending",
    statementDescriptor: "YCM-CHRY HILL HOA",
    disabledReason: status === "disabled" ? "requirements.past_due" : null,
    lastSyncedAt: new Date().toISOString(),
  };
}

describe("resolveConnectChargeRouting", () => {
  beforeEach(() => {
    mockFindConnectConnection.mockReset();
    mockReadConnectState.mockReset();
    mockGetSecret.mockReset();
  });
  afterEach(() => vi.clearAllMocks());

  it("returns null for an empty associationId (no DB call)", async () => {
    const result = await resolveConnectChargeRouting("");
    expect(result).toBeNull();
    expect(mockFindConnectConnection).not.toHaveBeenCalled();
  });

  it("returns null when no Connect connection exists", async () => {
    mockFindConnectConnection.mockResolvedValue(null);
    expect(await resolveConnectChargeRouting("assoc-1")).toBeNull();
  });

  it("returns null when the connection has no providerAccountId", async () => {
    mockFindConnectConnection.mockResolvedValue({ providerAccountId: null });
    expect(await resolveConnectChargeRouting("assoc-1")).toBeNull();
  });

  it.each(["pending", "restricted", "disabled"] as const)(
    "returns null when Connect status is %s (not chargeable yet)",
    async (status) => {
      mockFindConnectConnection.mockResolvedValue({ providerAccountId: "acct_123" });
      mockReadConnectState.mockReturnValue(connectState(status));
      mockGetSecret.mockResolvedValue("sk_test_platform");
      expect(await resolveConnectChargeRouting("assoc-1")).toBeNull();
    },
  );

  it("returns null when the platform secret key is not configured", async () => {
    mockFindConnectConnection.mockResolvedValue({ providerAccountId: "acct_123" });
    mockReadConnectState.mockReturnValue(connectState("active"));
    mockGetSecret.mockResolvedValue(null);
    expect(await resolveConnectChargeRouting("assoc-1")).toBeNull();
  });

  it("returns routing (header + platform key) when Connect is ACTIVE", async () => {
    mockFindConnectConnection.mockResolvedValue({ providerAccountId: "acct_CHC" });
    mockReadConnectState.mockReturnValue(connectState("active"));
    mockGetSecret.mockResolvedValue("sk_test_platform");

    const result = await resolveConnectChargeRouting("assoc-1");
    expect(result).toEqual({
      stripeAccountHeader: "acct_CHC",
      platformSecretKey: "sk_test_platform",
      status: "active",
    });
  });
});
