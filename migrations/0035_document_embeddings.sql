-- AI Assistant Phase 1 (founder-os#1256) — document embeddings (pgvector).
--
-- Stores chunked Document content + 1024-dim embeddings for RAG retrieval.
-- Per the locked Phase 1 picks (founder-os#1782 / PR #2481):
--   - vector store : pgvector inside YCM's Postgres (no Pinecone)
--   - embed model  : voyage-3-lite (1024 dims, $0.02/1M tokens)
--   - fallback     : OpenAI text-embedding-3-small with dimensions=1024
--
-- RLS-scoped per association_id so cross-association leakage is impossible
-- regardless of which path issues the query.

CREATE TABLE IF NOT EXISTS document_embeddings (
    id              varchar    PRIMARY KEY DEFAULT gen_random_uuid(),
    association_id  varchar    NOT NULL REFERENCES associations(id),
    document_id     varchar    NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index     integer    NOT NULL,
    content         text       NOT NULL,
    embedding       vector(1024),
    metadata        jsonb      NOT NULL DEFAULT '{}'::jsonb,
    model           text       NOT NULL DEFAULT 'voyage-3-lite',
    created_at      timestamp  NOT NULL DEFAULT NOW(),
    UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS document_embeddings_assoc_idx
    ON document_embeddings (association_id);

-- IVFFlat index for cosine similarity. lists=100 is the canonical default
-- for tables up to ~1M rows (per pgvector docs). Can be tuned later.
CREATE INDEX IF NOT EXISTS document_embeddings_vector_idx
    ON document_embeddings
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- Row-level security. Application code MUST `SET LOCAL app.association_id`
-- before SELECT/INSERT to satisfy the policy. The application-tier
-- retriever/ingester additionally filters by association_id in the WHERE
-- clause so cross-association leakage requires BOTH (a) RLS bypass AND
-- (b) the explicit filter to be wrong. Defense in depth.
ALTER TABLE document_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS document_embeddings_assoc_isolation ON document_embeddings;
CREATE POLICY document_embeddings_assoc_isolation
    ON document_embeddings
    USING (
        current_setting('app.association_id', true) IS NULL
        OR current_setting('app.association_id', true) = ''
        OR association_id = current_setting('app.association_id', true)
    );
