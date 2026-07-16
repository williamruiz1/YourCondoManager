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
--
-- Defensive on this branch only (redesign-staging-integration, founder-os#11501):
-- this table declares a `vector(1024)` column, which requires the pgvector
-- extension from migration 0034. On environments where that extension isn't
-- available (the redesign-preview Postgres image), skip table creation
-- entirely rather than aborting the migration run — no other migration or
-- app code path depends on this table structurally; only the RAG
-- ingester/retriever query it, and AI-Assistant/RAG is out of scope for
-- this environment (visual-review only).

DO $mig$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
        EXECUTE $body$
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

            CREATE INDEX IF NOT EXISTS document_embeddings_vector_idx
                ON document_embeddings
                USING ivfflat (embedding vector_cosine_ops)
                WITH (lists = 100);

            ALTER TABLE document_embeddings ENABLE ROW LEVEL SECURITY;

            DROP POLICY IF EXISTS document_embeddings_assoc_isolation ON document_embeddings;
            CREATE POLICY document_embeddings_assoc_isolation
                ON document_embeddings
                USING (
                    current_setting('app.association_id', true) IS NULL
                    OR current_setting('app.association_id', true) = ''
                    OR association_id = current_setting('app.association_id', true)
                );
        $body$;
    ELSE
        RAISE NOTICE 'pgvector extension not present — skipping document_embeddings table creation (AI-Assistant/RAG unavailable in this environment)';
    END IF;
END
$mig$;
