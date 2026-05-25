/**
 * RAG retriever (founder-os#1256, Phase 1).
 *
 * Given a query string + association_id, embeds the query and runs a
 * pgvector cosine-similarity search against document_embeddings filtered
 * to the caller's association. Returns top-K chunks with source-document
 * metadata so the chat layer can render citations.
 *
 * Isolation: the WHERE clause filters by association_id explicitly. RLS is
 * an additional backstop — application-tier filter is mandatory and never
 * left to the DB alone.
 */

import { sql } from "drizzle-orm";
import { db } from "../../db";
import { embedQuery, vectorToSqlLiteral, isEmbeddingProviderConfigured } from "./embedder";

export interface RetrievedChunk {
  documentId: string;
  documentTitle: string | null;
  chunkIndex: number;
  content: string;
  /** Cosine distance (0 = identical, 2 = opposite). Lower is better. */
  distance: number;
  metadata: Record<string, unknown>;
}

export interface RetrievalOptions {
  associationId: string;
  query: string;
  topK?: number;
  /** Optional max cosine distance — chunks beyond this are dropped. */
  maxDistance?: number;
}

export async function retrieve(opts: RetrievalOptions): Promise<RetrievedChunk[]> {
  const { associationId, query, topK = 5, maxDistance } = opts;
  if (!isEmbeddingProviderConfigured()) {
    // Caller's choice: gracefully empty so the chat falls back to LLM-only
    // (no RAG context). Logged so it's not silent.
    console.warn(
      "[rag-retriever] No embedding provider configured; retrieve() returning empty set",
    );
    return [];
  }
  if (!query || query.trim().length === 0) return [];

  const { vector } = await embedQuery(query);
  const queryLiteral = vectorToSqlLiteral(vector);

  // <=> is the pgvector cosine-distance operator. lower = closer.
  const rows = await db.execute<{
    document_id: string;
    document_title: string | null;
    chunk_index: number;
    content: string;
    metadata: Record<string, unknown>;
    distance: number;
  }>(sql`
    SELECT
      de.document_id      AS document_id,
      d.title             AS document_title,
      de.chunk_index      AS chunk_index,
      de.content          AS content,
      de.metadata         AS metadata,
      (de.embedding <=> ${queryLiteral}::vector) AS distance
    FROM document_embeddings de
    LEFT JOIN documents d ON d.id = de.document_id
    WHERE de.association_id = ${associationId}
    ORDER BY de.embedding <=> ${queryLiteral}::vector
    LIMIT ${topK}
  `);

  interface Row {
    document_id: string;
    document_title: string | null;
    chunk_index: number;
    content: string;
    metadata: Record<string, unknown> | null;
    distance: number | string;
  }
  const list: Row[] = (rows as any).rows ?? (rows as unknown as Row[]);
  return list
    .map((r): RetrievedChunk => ({
      documentId: r.document_id,
      documentTitle: r.document_title,
      chunkIndex: typeof r.chunk_index === "string" ? parseInt(r.chunk_index, 10) : r.chunk_index,
      content: r.content,
      distance: typeof r.distance === "string" ? parseFloat(r.distance) : r.distance,
      metadata: r.metadata ?? {},
    }))
    .filter((r) => maxDistance === undefined || r.distance <= maxDistance);
}

/**
 * Render retrieved chunks as a citation-friendly context block for the
 * system prompt. Each chunk is prefixed with `[doc-N]` so the model can
 * cite by reference.
 */
export function renderRetrievedChunks(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "";
  const seenDocs = new Map<string, number>();
  const lines: string[] = [];
  for (const chunk of chunks) {
    let docNum = seenDocs.get(chunk.documentId);
    if (docNum === undefined) {
      docNum = seenDocs.size + 1;
      seenDocs.set(chunk.documentId, docNum);
    }
    const title = chunk.documentTitle ?? "(untitled)";
    lines.push(`[doc-${docNum}] "${title}" (chunk ${chunk.chunkIndex}):\n${chunk.content}`);
  }
  return lines.join("\n\n---\n\n");
}
