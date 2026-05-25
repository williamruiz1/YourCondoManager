/**
 * RAG ingester (founder-os#1256, Phase 1).
 *
 * Takes a Document row → chunks the content → embeds each chunk → batch-
 * inserts into document_embeddings. Idempotent: any existing embeddings for
 * the document are deleted first so re-ingestion on update is a clean
 * replacement.
 *
 * Notes:
 *   - "Document content" in YCM is currently a `fileUrl` pointer — the
 *     content itself lives in object storage. Phase 1 supports inline text
 *     ingestion (caller passes the extracted body); the file-fetch path is
 *     a separate concern (PDF text extraction lives in
 *     server/routes/document upload). Tests pass content directly.
 *   - Association isolation: the caller MUST pass the documentId AND
 *     associationId; we verify the document belongs to the association
 *     before writing any embeddings.
 *   - All writes go through a single transaction so partial-failure
 *     leaves no orphan rows.
 */

import { sql, eq, and } from "drizzle-orm";
import { db } from "../../db";
import { documents, documentEmbeddings } from "@shared/schema";
import { chunkDocument } from "./chunker";
import { embed, vectorToSqlLiteral } from "./embedder";

export interface IngestResult {
  documentId: string;
  chunksCreated: number;
  embeddingTokens: number;
  model: string;
}

export interface IngestOptions {
  associationId: string;
  documentId: string;
  /** Already-extracted text body. PDF extraction is upstream of here. */
  content: string;
  /** Override chunker config — defaults to 500/50. */
  chunk?: { targetTokens?: number; overlapTokens?: number };
  /** Extra metadata stored per chunk. */
  metadata?: Record<string, unknown>;
}

export async function ingestDocument(opts: IngestOptions): Promise<IngestResult> {
  const { associationId, documentId, content, metadata = {} } = opts;

  if (!content || content.trim().length === 0) {
    throw new Error(`ingestDocument: empty content for document ${documentId}`);
  }

  // Sanity: the document must belong to this association. Defense in depth
  // beyond the RLS policy.
  const [doc] = await db
    .select({ id: documents.id, associationId: documents.associationId, title: documents.title })
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.associationId, associationId)))
    .limit(1);

  if (!doc) {
    throw new Error(
      `ingestDocument: document ${documentId} not found in association ${associationId}`,
    );
  }

  const chunks = chunkDocument(content, opts.chunk);
  if (chunks.length === 0) {
    return { documentId, chunksCreated: 0, embeddingTokens: 0, model: "voyage-3-lite" };
  }

  const { embeddings, model, inputTokens } = await embed(
    chunks.map((c) => c.content),
    { inputType: "document" },
  );

  // Delete existing rows for this document, then insert fresh. Wrapped in a
  // transaction so a mid-stream failure can't leave half-stale data.
  await db.transaction(async (tx) => {
    await tx.delete(documentEmbeddings).where(eq(documentEmbeddings.documentId, documentId));

    // Use raw SQL for the insert so pgvector accepts the embedding literal.
    // Drizzle's `text` column type would coerce the value through TS string
    // semantics; pgvector wants the `'[…]'::vector` form to land in a
    // vector(1024) column.
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const vec = vectorToSqlLiteral(embeddings[i]);
      const meta = JSON.stringify({
        ...metadata,
        documentTitle: doc.title,
        charStart: chunk.charStart,
        charEnd: chunk.charEnd,
        approxTokens: chunk.approxTokens,
      });

      await tx.execute(sql`
        INSERT INTO document_embeddings
          (association_id, document_id, chunk_index, content, embedding, metadata, model)
        VALUES (
          ${associationId},
          ${documentId},
          ${chunk.index},
          ${chunk.content},
          ${vec}::vector,
          ${meta}::jsonb,
          ${model}
        )
      `);
    }
  });

  return {
    documentId,
    chunksCreated: chunks.length,
    embeddingTokens: inputTokens,
    model,
  };
}

/**
 * Delete all embeddings for a document. Idempotent.
 */
export async function deleteDocumentEmbeddings(documentId: string): Promise<number> {
  const res = await db
    .delete(documentEmbeddings)
    .where(eq(documentEmbeddings.documentId, documentId))
    .returning({ id: documentEmbeddings.id });
  return res.length;
}
