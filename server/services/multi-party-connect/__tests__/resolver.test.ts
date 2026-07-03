/**
 * Unit tests for the multi-party Connect routing resolver (Flows 2 + 3).
 *
 * No live Stripe calls — all storage + flag dependencies are mocked. Verifies:
 *   - flag OFF (default) → every resolver returns null (Flow 1 path untouched)
 *   - Flow 2 (PM management fee) → direct charge on PM account + application fee
 *   - Flow 3 (PM-collected dues), Option A (hoa-direct) → settles to HOA's own
 *     ACTIVE connected account + PM transfer + application fee
 *   - Flow 3, Option B (trust-account) → settles to the trust account; hard
 *     requires a configured trust account id (no silent fallback)
 *   - money-transmitter invariant: principal never routes to a YCM balance;
 *     PM cut bounded so the HOA never goes net-negative on its own dues
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConnectMetadataState } from "../../stripe-connect";
import type { PmRelationshipState } from "../types";

// ── Mocks ────────────────────────────────────────────────────────────────────
const mockEnabled = vi.fn();
const mockFindPmRelationship = vi.fn();
const mockFindConnectConnection = vi.fn();
const mockReadConnectState = vi.fn();

vi.mock("../flag", () => ({
  isMultiPartyConnectEnabled: () => mockEnabled(),
}));
vi.mock("../storage", () => ({
  findPmRelationship: (...args: unknown[]) => mockFindPmRelationship(...args),
}));
vi.mock("../../stripe-connect-storage", () => ({
  findConnectConnection: (...args: unknown[]) => mockFindConnectConnection(...args),
  readConnectStateFromConnection: (...args: unknown[]) => mockReadConnectState(...args),
}));
// computeApplicationFeeCents is a pure function — use the REAL implementation
// so the fee math (1%, $0.50 floor, $25 ceiling) is exercised for real.

import {
  resolveFlow2ManagementFeeRouting,
  resolveFlow3OwnerDuesRouting,
  computePmFeeCents,
} from "../resolver";

function pmRel(overrides: Partial<PmRelationshipState> = {}): {
  connection: { providerAccountId: string };
  relationship: PmRelationshipState;
} {
  return {
    connection: { providerAccountId: "acct_HOA" },
    relationship: {
      mode: "pm-relationship",
      pmConnectedAccountId: "acct_PM",
      pmDisplayName: "Acme PM",
      pmFeeBps: 500, // 5.00%
      flow3Routing: "hoa-direct",
      trustAccountId: null,
      updatedAt: new Date().toISOString(),
      ...overrides,
    },
  };
}

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

beforeEach(() => {
  mockEnabled.mockReset();
  mockFindPmRelationship.mockReset();
  mockFindConnectConnection.mockReset();
  mockReadConnectState.mockReset();
  mockEnabled.mockReturnValue(true); // default ON for most tests; flag-off tested explicitly
});
afterEach(() => vi.clearAllMocks());

// ── Flag-off (default): Flow 1 path untouched ────────────────────────────────
describe("feature flag OFF (default)", () => {
  it("Flow 2 returns null when flag is off (no storage call)", async () => {
    mockEnabled.mockReturnValue(false);
    expect(await resolveFlow2ManagementFeeRouting("hoa-1", 10000)).toBeNull();
    expect(mockFindPmRelationship).not.toHaveBeenCalled();
  });

  it("Flow 3 returns null when flag is off (no storage call)", async () => {
    mockEnabled.mockReturnValue(false);
    expect(await resolveFlow3OwnerDuesRouting("hoa-1", 10000)).toBeNull();
    expect(mockFindPmRelationship).not.toHaveBeenCalled();
  });
});

// ── Flow 2 — PM management fee ───────────────────────────────────────────────
describe("Flow 2 — PM management fee", () => {
  it("returns null for empty association / non-positive fee", async () => {
    expect(await resolveFlow2ManagementFeeRouting("", 10000)).toBeNull();
    expect(await resolveFlow2ManagementFeeRouting("hoa-1", 0)).toBeNull();
    expect(await resolveFlow2ManagementFeeRouting("hoa-1", -5)).toBeNull();
  });

  it("returns null when no PM relationship exists", async () => {
    mockFindPmRelationship.mockResolvedValue(null);
    expect(await resolveFlow2ManagementFeeRouting("hoa-1", 10000)).toBeNull();
  });

  it("routes a DIRECT charge to the PM account with a platform application fee", async () => {
    mockFindPmRelationship.mockResolvedValue(pmRel());
    const result = await resolveFlow2ManagementFeeRouting("hoa-1", 100_00); // $100
    expect(result).toEqual({
      flow: "pm-management-fee",
      stripeAccountHeader: "acct_PM", // settles to the PM (the PM's revenue)
      applicationFeeCents: 100, // 1% of $100 = $1.00 (within floor/ceiling)
    });
  });
});

// ── Flow 3 — PM-collected owner dues (Option A: hoa-direct) ──────────────────
describe("Flow 3 — PM-collected owner dues (Option A hoa-direct)", () => {
  it("returns null for empty association / non-positive dues", async () => {
    expect(await resolveFlow3OwnerDuesRouting("", 10000)).toBeNull();
    expect(await resolveFlow3OwnerDuesRouting("hoa-1", 0)).toBeNull();
  });

  it("returns null when no PM relationship exists", async () => {
    mockFindPmRelationship.mockResolvedValue(null);
    expect(await resolveFlow3OwnerDuesRouting("hoa-1", 10000)).toBeNull();
  });

  it("returns null when the HOA's own Connect account is not ACTIVE", async () => {
    mockFindPmRelationship.mockResolvedValue(pmRel());
    mockFindConnectConnection.mockResolvedValue({ providerAccountId: "acct_HOA" });
    mockReadConnectState.mockReturnValue(connectState("pending"));
    expect(await resolveFlow3OwnerDuesRouting("hoa-1", 10000)).toBeNull();
  });

  it("settles principal to the HOA's OWN account + PM transfer + platform fee", async () => {
    mockFindPmRelationship.mockResolvedValue(pmRel({ pmFeeBps: 500 }));
    mockFindConnectConnection.mockResolvedValue({ providerAccountId: "acct_HOA" });
    mockReadConnectState.mockReturnValue(connectState("active"));

    const result = await resolveFlow3OwnerDuesRouting("hoa-1", 1000_00); // $1000 dues
    expect(result).toEqual({
      flow: "pm-collected-dues",
      stripeAccountHeader: "acct_HOA", // principal → HOA's OWN account (not YCM)
      applicationFeeCents: 1000, // 1% of $1000 = $10.00 (under the $25 ceiling)
      pmTransferCents: 5000, // 5% of $1000 = $50.00 to the PM
      pmTransferDestination: "acct_PM",
      fundRouting: "hoa-direct",
    });
  });

  it("PM transfer is zero when no PM fee bps configured", async () => {
    mockFindPmRelationship.mockResolvedValue(pmRel({ pmFeeBps: null }));
    mockFindConnectConnection.mockResolvedValue({ providerAccountId: "acct_HOA" });
    mockReadConnectState.mockReturnValue(connectState("active"));
    const result = await resolveFlow3OwnerDuesRouting("hoa-1", 100_00);
    expect(result?.pmTransferCents).toBe(0);
  });
});

// ── Flow 3 — Option B: trust-account ─────────────────────────────────────────
describe("Flow 3 — PM-collected owner dues (Option B trust-account)", () => {
  it("settles principal to the configured TRUST account (not the HOA, not YCM)", async () => {
    mockFindPmRelationship.mockResolvedValue(
      pmRel({ flow3Routing: "trust-account", trustAccountId: "acct_TRUST", pmFeeBps: 300 }),
    );
    const result = await resolveFlow3OwnerDuesRouting("hoa-1", 1000_00);
    expect(result?.stripeAccountHeader).toBe("acct_TRUST");
    expect(result?.fundRouting).toBe("trust-account");
    expect(result?.pmTransferDestination).toBe("acct_PM");
    // does NOT consult the HOA's own Connect account in trust-account mode
    expect(mockFindConnectConnection).not.toHaveBeenCalled();
  });

  it("HARD-requires a trust account id — returns null, no silent fallback", async () => {
    mockFindPmRelationship.mockResolvedValue(
      pmRel({ flow3Routing: "trust-account", trustAccountId: null }),
    );
    expect(await resolveFlow3OwnerDuesRouting("hoa-1", 1000_00)).toBeNull();
    // must NOT fall back to the HOA-direct path
    expect(mockFindConnectConnection).not.toHaveBeenCalled();
  });
});

// ── PM fee math (money-transmitter / net-negative guards) ────────────────────
describe("computePmFeeCents", () => {
  it("computes basis-points cut of the principal", () => {
    expect(computePmFeeCents(1000_00, 500, 1000)).toBe(5000); // 5% of $1000
    expect(computePmFeeCents(50_00, 250, 50)).toBe(125); // 2.5% of $50 = $1.25
  });

  it("returns 0 for missing / non-positive fee bps", () => {
    expect(computePmFeeCents(1000_00, null, 1000)).toBe(0);
    expect(computePmFeeCents(1000_00, 0, 1000)).toBe(0);
    expect(computePmFeeCents(1000_00, -10, 1000)).toBe(0);
  });

  it("never drives (platform fee + PM cut) above the principal", () => {
    // tiny dues, huge bps — PM cut capped so the HOA never goes net-negative
    const dues = 100; // $1.00
    const appFee = 50; // floor $0.50
    const pm = computePmFeeCents(dues, 100_00, appFee); // 100% bps → would be $1.00
    expect(pm).toBe(dues - appFee); // capped to remaining headroom ($0.50)
    expect(appFee + pm).toBeLessThanOrEqual(dues);
  });
});
