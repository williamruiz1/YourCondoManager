/**
 * Unit tests for the pure helpers in `server/services/stripe-connect.ts`.
 *
 * These do not exercise the Stripe API; they verify the
 *   1. statement_descriptor truncation (spec §2.2 pattern)
 *   2. status state machine (spec §7.1 pending → active → restricted → disabled)
 *
 * Stripe Account Links + retrieveConnectedAccount are integration-tested
 * separately via a fetch mock in the route-level test.
 */

import { describe, expect, it, vi } from "vitest";

// Stub the platform-secrets-store so importing the SUT does not pull in
// `server/db.ts` (which throws on missing DATABASE_URL outside the app).
vi.mock("../../platform-secrets-store", () => ({
  getSecret: async () => null,
}));

import {
  buildConnectMetadataState,
  buildStatementDescriptorPrefix,
  deriveConnectStatus,
  type StripeAccountSnapshot,
} from "../stripe-connect";

describe("buildStatementDescriptorPrefix (spec §2.1 + §2.2 — `YCM-` platform prefix)", () => {
  it("matches the spec's Cherry Hill example", () => {
    expect(buildStatementDescriptorPrefix("Cherry Hill Court Condominiums")).toBe(
      "YCM-CHRY HILL HOA",
    );
  });

  it("appends HOA when name lacks it", () => {
    expect(buildStatementDescriptorPrefix("Wawaset")).toBe("YCM-WAWASET HOA");
  });

  it("stays at or under 17 chars total (leaves room for 4-5 char suffix in Stripe's 22 budget)", () => {
    const long = buildStatementDescriptorPrefix("North Hills Square Garden Homeowners Association");
    expect(long.length).toBeLessThanOrEqual(17);
    expect(long.startsWith("YCM-")).toBe(true);
  });

  it("preserves explicit HOA token in input without doubling", () => {
    const out = buildStatementDescriptorPrefix("Maple Grove HOA");
    expect(out).toContain("HOA");
    // No duplicate HOA token.
    expect(out.match(/HOA/g)!.length).toBe(1);
    expect(out.startsWith("YCM-")).toBe(true);
  });

  it("strips punctuation and lowercase artifacts", () => {
    const out = buildStatementDescriptorPrefix("st. mary's pl, llc.");
    // Allow the canonical `YCM-` prefix's hyphen alongside alphanumerics + space.
    expect(out).toMatch(/^YCM-[A-Z0-9 ]+$/);
    expect(out.length).toBeLessThanOrEqual(17);
  });

  it("returns a non-empty fallback (with `YCM-` prefix) when input is empty", () => {
    expect(buildStatementDescriptorPrefix("")).toBe("YCM-HOA");
    expect(buildStatementDescriptorPrefix("    ")).toBe("YCM-HOA");
  });

  it("always starts with the platform `YCM-` prefix (spec §2.1)", () => {
    for (const name of [
      "Cherry Hill Court Condominiums",
      "Wawaset",
      "Maple Grove HOA",
      "",
      "st. mary's pl, llc.",
      "North Hills Square Garden Homeowners Association",
    ]) {
      expect(buildStatementDescriptorPrefix(name).startsWith("YCM-")).toBe(true);
    }
  });
});

function snapshot(overrides: Partial<StripeAccountSnapshot>): StripeAccountSnapshot {
  return {
    id: "acct_test_123",
    charges_enabled: false,
    payouts_enabled: false,
    details_submitted: false,
    ...overrides,
  };
}

describe("deriveConnectStatus (spec §7.1 state machine)", () => {
  it("returns 'pending' when details_submitted=false", () => {
    expect(deriveConnectStatus(snapshot({ details_submitted: false }))).toBe("pending");
  });

  it("returns 'active' when details submitted and both charges + payouts enabled", () => {
    expect(
      deriveConnectStatus(
        snapshot({
          details_submitted: true,
          charges_enabled: true,
          payouts_enabled: true,
        }),
      ),
    ).toBe("active");
  });

  it("returns 'restricted' when details submitted but charges or payouts disabled", () => {
    expect(
      deriveConnectStatus(
        snapshot({
          details_submitted: true,
          charges_enabled: true,
          payouts_enabled: false,
        }),
      ),
    ).toBe("restricted");
    expect(
      deriveConnectStatus(
        snapshot({
          details_submitted: true,
          charges_enabled: false,
          payouts_enabled: true,
        }),
      ),
    ).toBe("restricted");
  });

  it("returns 'disabled' when requirements.disabled_reason is set", () => {
    expect(
      deriveConnectStatus(
        snapshot({
          details_submitted: true,
          charges_enabled: true,
          payouts_enabled: true,
          requirements: { disabled_reason: "rejected.fraud" },
        }),
      ),
    ).toBe("disabled");
  });

  it("disabled wins over otherwise-active state (precedence)", () => {
    // Even a fully-active account is 'disabled' if Stripe rejected it.
    expect(
      deriveConnectStatus(
        snapshot({
          details_submitted: true,
          charges_enabled: true,
          payouts_enabled: true,
          requirements: { disabled_reason: "platform_paused" },
        }),
      ),
    ).toBe("disabled");
  });
});

describe("buildConnectMetadataState", () => {
  it("flattens account snapshot into the persisted shape", () => {
    const acct = snapshot({
      details_submitted: true,
      charges_enabled: true,
      payouts_enabled: true,
      settings: { payments: { statement_descriptor: "YCM-CHRY HILL HOA" } },
    });
    const state = buildConnectMetadataState(acct, new Date("2026-05-14T12:00:00Z"));
    expect(state.mode).toBe("connect");
    expect(state.status).toBe("active");
    expect(state.statementDescriptor).toBe("YCM-CHRY HILL HOA");
    expect(state.lastSyncedAt).toBe("2026-05-14T12:00:00.000Z");
  });

  it("surfaces disabled_reason on the persisted state", () => {
    const acct = snapshot({
      details_submitted: true,
      requirements: { disabled_reason: "rejected.fraud" },
    });
    const state = buildConnectMetadataState(acct);
    expect(state.status).toBe("disabled");
    expect(state.disabledReason).toBe("rejected.fraud");
  });
});
