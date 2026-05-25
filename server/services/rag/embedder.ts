/**
 * RAG embedder (founder-os#1256, Phase 1).
 *
 * Wraps the Voyage AI embeddings API as the primary provider, with an OpenAI
 * text-embedding-3-small fallback. Both produce 1024-dimensional vectors:
 *   - voyage-3-lite returns 1024 dims natively
 *   - text-embedding-3-small is requested with `dimensions: 1024` so the
 *     fallback writes into the same `vector(1024)` column without truncation
 *
 * Provider selection:
 *   - VOYAGE_API_KEY set → voyage-3-lite ($0.02/1M tokens; the Anthropic-
 *     recommended pick per founder-os#1782 research)
 *   - else OPENAI_API_KEY set → text-embedding-3-small ($0.02/1M; near
 *     parity on retrieval benchmarks)
 *   - else throws — RAG features error-up rather than silently degrade
 *
 * Both providers support batch input. The caller chooses the batch size; we
 * cap each request at 64 inputs to stay under the smaller of the two
 * providers' single-request limits.
 *
 * No SDK dependency — both APIs are simple POST JSON, and adding @anthropic-ai
 * / openai SDKs for two endpoints would inflate the bundle for no benefit.
 */

export type EmbeddingProvider = "voyage-3-lite" | "text-embedding-3-small";

export interface EmbeddingResult {
  embeddings: number[][];
  model: EmbeddingProvider;
  inputTokens: number;
}

export const EMBEDDING_DIM = 1024;
const MAX_BATCH = 64;

interface ProviderConfig {
  provider: EmbeddingProvider;
  endpoint: string;
  apiKey: string;
  buildBody: (input: string[], inputType: "document" | "query") => unknown;
  parseResponse: (body: any) => { vectors: number[][]; inputTokens: number };
}

function resolveProvider(): ProviderConfig {
  const voyageKey = process.env.VOYAGE_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (voyageKey) {
    return {
      provider: "voyage-3-lite",
      endpoint: "https://api.voyageai.com/v1/embeddings",
      apiKey: voyageKey,
      buildBody: (input, inputType) => ({
        input,
        model: "voyage-3-lite",
        input_type: inputType,
        // voyage-3-lite is 1024 dims natively; output_dimension parameter is
        // accepted but defaults to the native size.
      }),
      parseResponse: (body) => ({
        vectors: (body?.data ?? []).map((d: any) => d.embedding as number[]),
        inputTokens: body?.usage?.total_tokens ?? 0,
      }),
    };
  }

  if (openaiKey) {
    return {
      provider: "text-embedding-3-small",
      endpoint: "https://api.openai.com/v1/embeddings",
      apiKey: openaiKey,
      buildBody: (input) => ({
        input,
        model: "text-embedding-3-small",
        // text-embedding-3-small is 1536 dims natively; OpenAI supports
        // Matryoshka truncation via the `dimensions` param. 1024 keeps us
        // schema-compatible with the voyage column shape.
        dimensions: EMBEDDING_DIM,
      }),
      parseResponse: (body) => ({
        vectors: (body?.data ?? []).map((d: any) => d.embedding as number[]),
        inputTokens: body?.usage?.total_tokens ?? 0,
      }),
    };
  }

  throw new Error(
    "RAG embedder unavailable: neither VOYAGE_API_KEY nor OPENAI_API_KEY is set. " +
      "Add VOYAGE_API_KEY to Fly secrets (preferred) or OPENAI_API_KEY (fallback).",
  );
}

async function callProvider(
  cfg: ProviderConfig,
  input: string[],
  inputType: "document" | "query",
): Promise<{ vectors: number[][]; inputTokens: number }> {
  const res = await fetch(cfg.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify(cfg.buildBody(input, inputType)),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Embedding provider ${cfg.provider} returned ${res.status}: ${errBody}`);
  }
  const body = (await res.json()) as any;
  return cfg.parseResponse(body);
}

/** Embed an array of input strings. Dispatches in batches of ≤MAX_BATCH. */
export async function embed(
  inputs: string[],
  opts: { inputType?: "document" | "query" } = {},
): Promise<EmbeddingResult> {
  if (inputs.length === 0) {
    return { embeddings: [], model: "voyage-3-lite", inputTokens: 0 };
  }
  const cfg = resolveProvider();
  const inputType = opts.inputType ?? "document";

  const out: number[][] = [];
  let totalTokens = 0;

  for (let i = 0; i < inputs.length; i += MAX_BATCH) {
    const batch = inputs.slice(i, i + MAX_BATCH);
    const { vectors, inputTokens } = await callProvider(cfg, batch, inputType);
    if (vectors.length !== batch.length) {
      throw new Error(
        `Embedding provider ${cfg.provider} returned ${vectors.length} vectors for ${batch.length} inputs`,
      );
    }
    for (const v of vectors) {
      if (v.length !== EMBEDDING_DIM) {
        throw new Error(
          `Embedding provider ${cfg.provider} returned ${v.length}-dim vector; expected ${EMBEDDING_DIM}`,
        );
      }
      out.push(v);
    }
    totalTokens += inputTokens;
  }

  return { embeddings: out, model: cfg.provider, inputTokens: totalTokens };
}

/** Embed a single query string. Convenience wrapper. */
export async function embedQuery(text: string): Promise<{ vector: number[]; model: EmbeddingProvider }> {
  const { embeddings, model } = await embed([text], { inputType: "query" });
  return { vector: embeddings[0], model };
}

/**
 * Format a vector as the bracketed-array literal pgvector accepts on INSERT
 * (e.g. `'[0.1,0.2,0.3]'`). Drizzle's `vector` type isn't first-class yet
 * so we serialize manually.
 */
export function vectorToSqlLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

/** Whether any embedding provider is configured. Used to gate ingest UI. */
export function isEmbeddingProviderConfigured(): boolean {
  return Boolean(process.env.VOYAGE_API_KEY || process.env.OPENAI_API_KEY);
}
