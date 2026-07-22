-- First-party YCM Feedback Center.
--
-- GitHub delivery columns remain for historical compatibility, but new
-- feedback is managed entirely inside YCM. The queue state is materialized on
-- founder_feedback and every administrative change is recorded append-only.

ALTER TABLE founder_feedback
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS assigned_to text,
  ADD COLUMN IF NOT EXISTS admin_notes text,
  ADD COLUMN IF NOT EXISTS resolution_summary text,
  ADD COLUMN IF NOT EXISTS first_reviewed_at timestamp,
  ADD COLUMN IF NOT EXISTS resolved_at timestamp,
  ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();
--> statement-breakpoint

ALTER TABLE founder_feedback
  DROP CONSTRAINT IF EXISTS founder_feedback_status_ck;
ALTER TABLE founder_feedback
  ADD CONSTRAINT founder_feedback_status_ck
  CHECK (status IN ('new', 'triaged', 'planned', 'in_progress', 'resolved', 'dismissed'));
--> statement-breakpoint

ALTER TABLE founder_feedback
  DROP CONSTRAINT IF EXISTS founder_feedback_priority_ck;
ALTER TABLE founder_feedback
  ADD CONSTRAINT founder_feedback_priority_ck
  CHECK (priority IN ('low', 'normal', 'high', 'critical'));
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS founder_feedback_queue_idx
  ON founder_feedback (status, priority, created_at DESC);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS founder_feedback_events (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  feedback_id varchar NOT NULL REFERENCES founder_feedback(id),
  actor_admin_user_id varchar REFERENCES admin_users(id),
  actor_email text NOT NULL,
  event_type text NOT NULL,
  from_status text,
  to_status text,
  detail text,
  created_at timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS founder_feedback_events_feedback_created_idx
  ON founder_feedback_events (feedback_id, created_at);
--> statement-breakpoint

INSERT INTO founder_feedback_events (
  feedback_id,
  actor_email,
  event_type,
  to_status,
  detail,
  created_at
)
SELECT
  feedback.id,
  feedback.email,
  'migrated',
  feedback.status,
  'Existing feedback imported into the first-party YCM Feedback Center',
  feedback.created_at
FROM founder_feedback AS feedback
WHERE NOT EXISTS (
  SELECT 1
  FROM founder_feedback_events AS event
  WHERE event.feedback_id = feedback.id
);
