-- Harden founder-feedback delivery without changing the existing durable notes.
ALTER TABLE founder_feedback
  ADD COLUMN IF NOT EXISTS dedupe_key text,
  ADD COLUMN IF NOT EXISTS github_delivery_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS github_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS github_last_error text,
  ADD COLUMN IF NOT EXISTS github_last_attempt_at timestamp;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS founder_feedback_dedupe_key_uq
  ON founder_feedback (dedupe_key)
  WHERE dedupe_key IS NOT NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS founder_feedback_delivery_queue_idx
  ON founder_feedback (github_delivery_status, created_at)
  WHERE github_issue_number IS NULL;
--> statement-breakpoint

ALTER TABLE founder_feedback
  DROP CONSTRAINT IF EXISTS founder_feedback_delivery_status_ck;
ALTER TABLE founder_feedback
  ADD CONSTRAINT founder_feedback_delivery_status_ck
  CHECK (github_delivery_status IN ('pending', 'delivered', 'failed', 'unavailable'));

