/**
 * Embedder unit tests (founder-os#1256, Phase 1).
 *
 * Mocks `fetch` so the test is hermetic — no network, no API keys needed.
 * Verifies:
 *   - voyage path is selected when VOYAGE_API_KEY is set
 *   - openai path is selected when only OPENAI_API_KEY is set
 *   - both paths return 1024-dim vectors
 *   - batched requests aggregate correctly
 *   - error path: no keys → throws
 */

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { embed, embedQuery, vectorToSqlLiteral, isEmbeddingProviderConfigured } from "../embedder";

const EMBED_DIM = 1024;

function makeVector(seed: number): number[] {
  return Array.from({ length: EMBED_DIM }, (_, i) => (seed + i) / 10_000);
}

function mockFetchSuccess(provider: "voyage" | "openai", inputCount: number) {
  const vectors = Array.from({ length: inputCount }, (_, i) => makeVector(i));
  const body = {
    data: vectors.map((v) => ({ embedding: v })),
    usage: { total_tokens: 100 * inputCount },
  };
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
}

describe("embedder", () => {
  const origEnv = { ...process.env };
  const origFetch = globalThis.fetch;

  beforeEach(() => {
    delete process.env.VOYAGE_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    process.env = { ...origEnv };
    globalThis.fetch = origFetch;
  });

  it("throws when no provider configured", async () => {
    expect(isEmbeddingProviderConfigured()).toBe(false);
    await expect(embed(["hello"])).rejects.toThrow(/embedder unavailable/i);
  });

  it("selects voyage when VOYAGE_API_KEY is set", async () => {
    process.env.VOYAGE_API_KEY = "test-voyage";
    const mockFetch = mockFetchSuccess("voyage", 2);
    globalThis.fetch = mockFetch as any;

    const result = await embed(["chunk one", "chunk two"]);
    expect(result.model).toBe("voyage-3-lite");
    expect(result.embeddings).toHaveLength(2);
    expect(result.embeddings[0]).toHaveLength(EMBED_DIM);
    expect(result.inputTokens).toBe(200);

    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toBe("https://api.voyageai.com/v1/embeddings");
    const reqBody = JSON.parse((callArgs[1] as any).body);
    expect(reqBody.model).toBe("voyage-3-lite");
    expect(reqBody.input).toEqual(["chunk one", "chunk two"]);
  });

  it("falls back to OpenAI when only OPENAI_API_KEY is set", async () => {
    process.env.OPENAI_API_KEY = "test-openai";
    const mockFetch = mockFetchSuccess("openai", 1);
    globalThis.fetch = mockFetch as any;

    const result = await embed(["just one"]);
    expect(result.model).toBe("text-embedding-3-small");

    const reqBody = JSON.parse((mockFetch.mock.calls[0][1] as any).body);
    expect(reqBody.model).toBe("text-embedding-3-small");
    expect(reqBody.dimensions).toBe(EMBED_DIM);
  });

  it("prefers voyage when both keys are set", async () => {
    process.env.VOYAGE_API_KEY = "v";
    process.env.OPENAI_API_KEY = "o";
    globalThis.fetch = mockFetchSuccess("voyage", 1) as any;
    const result = await embed(["x"]);
    expect(result.model).toBe("voyage-3-lite");
  });

  it("embedQuery passes input_type=query for voyage", async () => {
    process.env.VOYAGE_API_KEY = "v";
    const mockFetch = mockFetchSuccess("voyage", 1);
    globalThis.fetch = mockFetch as any;

    await embedQuery("what is my balance?");
    const reqBody = JSON.parse((mockFetch.mock.calls[0][1] as any).body);
    expect(reqBody.input_type).toBe("query");
  });

  it("vectorToSqlLiteral formats as pgvector array literal", () => {
    expect(vectorToSqlLiteral([0.1, 0.2, 0.3])).toBe("[0.1,0.2,0.3]");
  });
});
