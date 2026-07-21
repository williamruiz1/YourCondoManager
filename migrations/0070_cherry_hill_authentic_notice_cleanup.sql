-- Migration 0070 — finish removing fictional Cherry Hill announcement seeds.
--
-- Cherry Hill's public page must contain association-authored notices only.
-- These fixed-ID demo records describe meetings, amenities, and emergencies
-- that were never confirmed by the association owner.

DELETE FROM "community_announcements"
WHERE "association_id" = 'f301d073-ed84-4d73-84ce-3ef28af66f7a'
  AND "id" IN (
    'ann00001-0000-4000-8000-000000000001',
    'ann00001-0000-4000-8000-000000000004',
    'ann00001-0000-4000-8000-000000000005'
  );
