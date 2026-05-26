-- AI Assistant Phase 1 (founder-os#1256) — pressing items widget.
--
-- Per the locked Phase 1 picks (founder-os#1782 / PR #2481), the proactive
-- surfacing mechanism is a "Pressing Items" widget hybrid:
--   - event-driven (some classes flip on transactional triggers — to be wired
--     incrementally as the source-of-truth tables get touched)
--   - cron-swept (server/index.ts automation tick already runs every 5 min;
--     pressing-items scanner attaches there)
--
-- Four item classes:
--   - unidentified_txn       : bank_transactions with no reconciled_to_… link
--   - delinquency_rising     : delinquency_escalations.current_stage > 1 or
--                              days_past_due >= 60
--   - document_attention     : vendors.insurance_expires_at within 30 days
--                              (other "document attention" sources extend
--                              incrementally — schema allows for it)
--   - compliance_deadline    : delinquency notice due_at + governance reminders
--                              landing within 14 days
--
-- Role lensing is via actor_role ('treasurer' | 'secretary' | 'president'
-- | 'board' — board = any).
-- snooze_until + resolved_at gate visibility. No dismiss-forever (per spec).

CREATE TABLE IF NOT EXISTS pressing_items (
    id                   varchar    PRIMARY KEY DEFAULT gen_random_uuid(),
    association_id       varchar    NOT NULL REFERENCES associations(id),
    item_class           text       NOT NULL CHECK (item_class IN (
        'unidentified_txn',
        'delinquency_rising',
        'document_attention',
        'compliance_deadline'
    )),
    severity             text       NOT NULL DEFAULT 'medium' CHECK (severity IN (
        'low','medium','high','critical'
    )),
    title                text       NOT NULL,
    description          text,
    actor_role           text       NOT NULL DEFAULT 'board',
    related_record_type  text,
    related_record_id    varchar,
    -- Deterministic dedupe key so the scanner is idempotent: when the same
    -- (association, class, related_record) is detected on a later sweep we
    -- update the existing row rather than insert a duplicate. NULL means
    -- the row is one-off (no source-of-truth record to dedupe against).
    dedupe_key           text,
    snoozed_until        timestamp,
    resolved_at          timestamp,
    created_at           timestamp  NOT NULL DEFAULT NOW(),
    updated_at           timestamp  NOT NULL DEFAULT NOW(),
    UNIQUE (association_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS pressing_items_assoc_role_idx
    ON pressing_items (association_id, actor_role)
    WHERE resolved_at IS NULL;

-- Note: original predicate included `snoozed_until < NOW()` but Postgres
-- requires functions in index predicates to be IMMUTABLE; NOW() is STABLE.
-- The snoozed-until filter is applied at query time instead. Index narrows
-- to non-resolved rows; query-time filter on snoozed_until covers the rest.
CREATE INDEX IF NOT EXISTS pressing_items_assoc_visible_idx
    ON pressing_items (association_id, severity, created_at DESC)
    WHERE resolved_at IS NULL;
