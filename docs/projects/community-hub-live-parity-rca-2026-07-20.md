# Cherry Hill Community Hub live-parity RCA

Date: 2026-07-20  
Route: `/community/cherryhill`  
Owner: YCM GM

## Outcome

The public Cherry Hill page now implements the ratified v4 community-front-door hierarchy on the real public hub data flow. It retains the configurable community map, buildings, notices, quick actions, board directory, and professional inquiry paths without exposing private owner or board contact fields.

## Root cause

The earlier releases reached production, but their implementation stopped at a branded shell around the existing generic section stack. The approved artifact's defining structure was still absent:

- no public-site navigation or editorial About section;
- no meaningful Owner Portal preview in the hero;
- no community quick-facts panel;
- no dedicated official-document request band for lenders, insurers, and closings;
- seeded fictional announcements still dominated the live page.

This made the bundle technically current while the visible page still failed redesign acceptance.

## Repair

- Ported the approved v4 hierarchy into `community-hub-public.tsx` using live association and building data.
- Kept exactly two Owner Portal actions; both open `/portal` directly. No embedded sign-in form remains.
- Added anchor navigation, About and facts, a truthful portal-capabilities preview, board contacts, professional inquiries, and the official-document request band.
- Preserved the unauthenticated data boundary: public board records expose name and role only; messages route through YCM.
- Added migration `0070_cherry_hill_authentic_notice_cleanup.sql` to remove the remaining fixed-ID fictional Annual Meeting, pool, and emergency-water notices.
- Removed those announcement records from the seed so they cannot return on a future seed run.

## Validation

- TypeScript: clean.
- Production build: clean.
- Focused Community Hub and migration tests: 10/10 passing.
- Full Vitest suite: 2,920/2,920 passing.
- Isolated real-backend browser review: desktop and 390px mobile layouts render without horizontal overflow.
- Production verification remains the final release validator after merge and deployment.
