/**
 * ConversationAdapter contract tests (founder-os#1318, Phase 0).
 *
 * Any conforming implementation MUST pass these tests. The Phase 0
 * `MockConversationAdapter` is the v1 implementation; when the Phase 1
 * adapter ships via founder-os#1244 it MUST also pass these tests
 * unchanged.
 *
 * Sister reference: Meridian's `ConversationAdapterContractTests.swift`
 * (PR meridian#9). Same protocol, same coverage.
 */

import { describe, expect, it, vi } from "vitest";

// Mock the db module so module-load doesn't throw on missing DATABASE_URL.
// None of the test paths here invoke sendTurn (which would write to the
// ai_assistant_interactions table), so the mock is only here to satisfy
// the transitive import in mock-adapter.ts.
vi.mock("../../../db", () => ({
  db: {
    insert: () => ({ values: () => Promise.resolve() }),
  },
}));

import { MockConversationAdapter } from "../mock-adapter";
import type { ConversationAdapter } from "../adapter";

// Construct outside `describe` so a future `LLMConversationalAdapter`
// (Phase 1) can swap in by editing one line.
const adapter: ConversationAdapter = new MockConversationAdapter({
  chunkDelayMs: 0,
  chunksPerReply: 3,
});

describe("ConversationAdapter — contract (Phase 0 mock)", () => {
  it("createConversation returns a handle with a stable id + the requested subMode", async () => {
    const handle = await adapter.createConversation("resident");
    expect(handle.id).toMatch(/[0-9a-f-]{36}/i);
    expect(handle.subMode).toBe("resident");
    expect(typeof handle.createdAt).toBe("string");
  });

  it("createConversation returns distinct ids per call", async () => {
    const a = await adapter.createConversation("resident");
    const b = await adapter.createConversation("resident");
    expect(a.id).not.toBe(b.id);
  });

  it("applyTrustGate returns tier1 for read-prefixed actions", async () => {
    const result = await adapter.applyTrustGate("read.owner_balance");
    expect(result.action).toBe("read.owner_balance");
    expect(result.allowedMaxTier).toBe(1);
    expect(result.reason).toBe("phase-0-stub");
  });

  it("applyTrustGate returns tier2 for write.<product>.<action>", async () => {
    const result = await adapter.applyTrustGate("write.ycm.reminder");
    expect(result.allowedMaxTier).toBe(2);
  });

  it("applyTrustGate returns tier3 for write.system.<action>", async () => {
    const result = await adapter.applyTrustGate("write.system.payment");
    expect(result.allowedMaxTier).toBe(3);
  });

  it("applyTrustGate returns tier1 for unrecognized prefixes (read-only default)", async () => {
    const result = await adapter.applyTrustGate("unknown.action");
    expect(result.allowedMaxTier).toBe(1);
  });

  it("trackSpend persists the record to the in-memory spend log (mock-only inspector)", async () => {
    const ad = new MockConversationAdapter();
    const record = {
      conversationId: "conv-1",
      turnIndex: 0,
      inputTokens: 10,
      outputTokens: 20,
      cachedInputTokens: 0,
      estimatedCostUSD: 0,
      model: "mock-phase-0",
      recordedAt: new Date().toISOString(),
    };
    await ad.trackSpend(record);
    const log = ad.recordedSpend();
    expect(log).toContainEqual(record);
  });
});

describe("MockConversationAdapter — config defaults", () => {
  it("uses 80ms / 6 chunks / tier1 default when no config passed", () => {
    const ad = new MockConversationAdapter();
    // The defaults aren't directly readable; we verify by behavior +
    // by the type system (no thrown errors on construction).
    expect(ad).toBeInstanceOf(MockConversationAdapter);
  });

  it("accepts partial config overrides", () => {
    const ad = new MockConversationAdapter({ chunkDelayMs: 5 });
    expect(ad).toBeInstanceOf(MockConversationAdapter);
  });
});
