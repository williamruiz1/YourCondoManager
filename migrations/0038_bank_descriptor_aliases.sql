-- bank_descriptor_aliases — descriptor→owner learning table (founder-os#2480 tail)
--
-- When a treasurer manually matches a bank-tx descriptor (e.g. "ZELLE FROM
-- Z. RUIZ") to a specific person for a specific association, that mapping is
-- stored here. On the NEXT bank credit with the same normalized descriptor, the
-- auto-matcher and suggestion engine can immediately attribute it to the known
-- owner without re-scoring — effectively making the first manual identification
-- the last.
--
-- Descriptor normalization: lowercased, stripped of special characters,
-- sequences of whitespace collapsed to single space, trimmed. Matches are
-- exact on the normalized form. Normalization is applied server-side at write
-- time so queries use a simple equality predicate with the index.
--
-- Tenant isolation: every row is scoped to (association_id, person_id) so
-- an alias from Association A can never bleed into Association B.
--
-- Idempotency: (association_id, normalized_descriptor) is UNIQUE. Duplicate
-- learns (same descriptor → same person) hit ON CONFLICT DO UPDATE and
-- increment match_count + refresh updated_at. A descriptor that was
-- incorrectly attributed is corrected by a later manual match that overwrites
-- person_id/unit_id — the conflict counter lets auditors see the correction.
--
-- Source surfaces:
--   POST /api/admin/reconciliation/match     (admin overrides the auto-matcher)
--   POST /api/admin/reconciliation/suggestions/create  (Suggestions tab Create)
-- Both surfaces represent deliberate human confirmation of a
-- descriptor → person pairing.

CREATE TABLE IF NOT EXISTS bank_descriptor_aliases (
    id                    varchar     PRIMARY KEY DEFAULT gen_random_uuid(),
    association_id        varchar     NOT NULL REFERENCES associations(id),
    -- Normalized form of the bank-tx name/merchantName used as the lookup key.
    -- Normalization: lower-cased, [^a-z0-9 ] → space, /\s+/ → single space,
    -- trimmed. Example: "ZELLE FROM Z. RUIZ" → "zelle from z ruiz".
    normalized_descriptor text        NOT NULL,
    person_id             varchar     NOT NULL REFERENCES persons(id),
    unit_id               varchar     NOT NULL REFERENCES units(id),
    -- How many times this alias has been confirmed (incremented on each match).
    match_count           integer     NOT NULL DEFAULT 1,
    created_at            timestamp   NOT NULL DEFAULT NOW(),
    updated_at            timestamp   NOT NULL DEFAULT NOW(),
    UNIQUE (association_id, normalized_descriptor)
);

-- Fast lookup by the matcher: "for this association, does this descriptor have
-- a known owner?"
CREATE INDEX IF NOT EXISTS bank_descriptor_aliases_lookup_idx
    ON bank_descriptor_aliases (association_id, normalized_descriptor);
