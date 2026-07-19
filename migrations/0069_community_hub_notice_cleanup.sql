-- Migration 0069 — remove unauthentic Cherry Hill public notices.
--
-- These fixed-ID seed records were confirmed by the association owner as
-- inaccurate and must not be shown or recreated.

DELETE FROM "community_announcements"
WHERE "association_id" = 'f301d073-ed84-4d73-84ce-3ef28af66f7a'
  AND "id" IN (
    'ann00001-0000-4000-8000-000000000002',
    'ann00001-0000-4000-8000-000000000003'
  );
