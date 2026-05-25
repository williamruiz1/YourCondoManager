/**
 * LLM adapter selection test (founder-os#1256, Phase 1).
 *
 * Verifies the DI seam picks the right adapter based on env state:
 *   - ANTHROPIC_API_KEY set → LLMConversationAdapter
 *   - ANTHROPIC_API_KEY unset → MockConversationAdapter (Phase 0 fallback)
 *
 * The intent is to fail-safe in environments without keys — local dev,
 * CI, broken-secret deploys — so the chat surface never goes dark.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

// Mock the db so the mock adapter's module-load doesn't choke on
// DATABASE_URL. The Phase 1 adapter also imports db; same mock applies.
vi.mock("../../../db", () => ({
  db: {
    insert: () => ({ values: () => Promise.resolve() }),
    transaction: (fn: any) => fn({ delete: () => ({ where: () => Promise.resolve() }), execute: () => Promise.resolve() }),
    select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) }),
    execute: () => Promise.resolve({ rows: [] }),
  },
}));

describe("AI assistant DI adapter selection", () => {
  const origEnv = { ...process.env };
  beforeEach(() => {
    vi.resetModules();
    delete process.env.ANTHROPIC_API_KEY;
  });
  afterEach(() => {
    process.env = { ...origEnv };
  });

  it("isLLMAdapterReady reports true only when ANTHROPIC_API_KEY is set", async () => {
    const mod = await import("../llm-adapter");
    expect(mod.isLLMAdapterReady()).toBe(false);
    process.env.ANTHROPIC_API_KEY = "test-key";
    expect(mod.isLLMAdapterReady()).toBe(true);
  });

  it("selects LLMConversationAdapter when ANTHROPIC_API_KEY is set", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const { boundAdapter, LLMConversationAdapter } = await import("../index");
    expect(boundAdapter).toBeInstanceOf(LLMConversationAdapter);
  });

  it("falls back to MockConversationAdapter when ANTHROPIC_API_KEY is unset", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { boundAdapter, MockConversationAdapter } = await import("../index");
    expect(boundAdapter).toBeInstanceOf(MockConversationAdapter);
  });
});
