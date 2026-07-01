import { describe, it, expect } from "vitest";
import { gatewayPlainStatus } from "./financial-payments";

// founder-os#8152 — the Gateway page must show a board member a plain-English
// status + next action, with NO raw Stripe field names / account IDs / enum
// values as content. This locks the raw-state → plain mapping.

type ConnectState = Parameters<typeof gatewayPlainStatus>[0];

function state(overrides: Partial<ConnectState>): ConnectState {
  return {
    mode: "connect",
    status: "pending",
    chargesEnabled: false,
    payoutsEnabled: false,
    detailsSubmitted: false,
    statementDescriptor: null,
    disabledReason: null,
    lastSyncedAt: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

// Jargon that must NEVER appear in board-facing plain output.
const JARGON = [
  /sub-?merchant/i, /acct_/i, /past_due/i, /requirements/i, /charges_enabled/i,
  /payouts_enabled/i, /details_submitted/i, /disabled_reason/i, /statement descriptor/i,
  /1099/i, /\bpending\b/i, /\brestricted\b/i, /\bdisabled\b/,
];

function assertPlain(s: ReturnType<typeof gatewayPlainStatus>) {
  const blob = `${s.label} ${s.meaning} ${s.next}`;
  for (const j of JARGON) expect(blob, `jargon ${j} leaked: "${blob}"`).not.toMatch(j);
  expect(s.label.length).toBeGreaterThan(0);
  expect(s.next.length).toBeGreaterThan(0); // always a next action or reassurance
}

describe("gatewayPlainStatus — board-member plain English (no raw Stripe internals)", () => {
  it("fully active → ready, no action, ok tone", () => {
    const s = gatewayPlainStatus(state({ status: "active", chargesEnabled: true, payoutsEnabled: true, detailsSubmitted: true }));
    expect(s.tone).toBe("ok");
    expect(s.label).toMatch(/ready/i);
    expect(s.next).toMatch(/nothing|all set/i);
    assertPlain(s);
  });

  it("HONEST: can charge but payouts off → surfaced, not hidden", () => {
    const s = gatewayPlainStatus(state({ status: "active", chargesEnabled: true, payoutsEnabled: false, detailsSubmitted: true }));
    expect(s.tone).toBe("warn");
    expect(s.label).toMatch(/payout/i);
    expect(s.next).toMatch(/finish setup/i);
    assertPlain(s);
  });

  it("restricted → 'a few more details', action tone, plain next", () => {
    const s = gatewayPlainStatus(state({ status: "restricted", disabledReason: "requirements.past_due" }));
    expect(s.tone).toBe("action");
    expect(s.label).toMatch(/details/i);
    assertPlain(s); // must not leak "requirements.past_due"
  });

  it("disabled → 'turned off', action tone", () => {
    const s = gatewayPlainStatus(state({ status: "disabled", disabledReason: "rejected.fraud" }));
    expect(s.tone).toBe("action");
    expect(s.label).toMatch(/off/i);
    assertPlain(s);
  });

  it("pending / details not submitted → 'setup not finished'", () => {
    const s = gatewayPlainStatus(state({ status: "pending", detailsSubmitted: false }));
    expect(s.tone).toBe("action");
    expect(s.label).toMatch(/setup/i);
    expect(s.next).toMatch(/continue setup/i);
    assertPlain(s);
  });

  it("active but details not yet submitted → treated as unfinished (not falsely 'ready')", () => {
    const s = gatewayPlainStatus(state({ status: "active", chargesEnabled: false, payoutsEnabled: false, detailsSubmitted: false }));
    expect(s.tone).not.toBe("ok");
    assertPlain(s);
  });
});
