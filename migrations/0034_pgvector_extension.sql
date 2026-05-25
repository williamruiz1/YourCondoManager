-- AI Assistant Phase 1 (founder-os#1256) — pgvector extension.
--
-- Enables pgvector inside YCM's existing Postgres so the document RAG store
-- (migration 0034) can declare `vector(1024)` columns. voyage-3-lite returns
-- 1024-dim embeddings; text-embedding-3-small fallback also fits (1536 →
-- truncated to 1024 by the ingester per Voyage's matryoshka guidance — see
-- server/services/rag/embedder.ts).
--
-- Idempotent — safe to re-run.

CREATE EXTENSION IF NOT EXISTS vector;
