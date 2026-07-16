-- AI Assistant Phase 1 (founder-os#1256) — pgvector extension.
--
-- Enables pgvector inside YCM's existing Postgres so the document RAG store
-- (migration 0034) can declare `vector(1024)` columns. voyage-3-lite returns
-- 1024-dim embeddings; text-embedding-3-small fallback also fits (1536 →
-- truncated to 1024 by the ingester per Voyage's matryoshka guidance — see
-- server/services/rag/embedder.ts).
--
-- Idempotent — safe to re-run.
--
-- Defensive on this branch only (redesign-staging-integration, founder-os#11501):
-- the redesign-preview environment's Postgres image doesn't ship pgvector
-- (prod's install predates this migration and was applied manually, outside
-- IaC — see founder-os#11501 for that drift finding, tracked separately).
-- Skip gracefully instead of aborting the whole migration run when the
-- extension isn't installable here; AI-Assistant/RAG is out of scope for
-- this environment (visual-review only).

DO $mig$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
        EXECUTE 'CREATE EXTENSION IF NOT EXISTS vector';
    ELSE
        RAISE NOTICE 'pgvector extension not available on this Postgres image — skipping (AI-Assistant/RAG unavailable in this environment)';
    END IF;
END
$mig$;
