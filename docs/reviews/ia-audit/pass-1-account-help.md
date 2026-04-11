# Phase 1 Audit — A8 Account & Help
**Auditor:** A8
**Date:** 2026-04-11
**Scope:** 2 pages (`user-settings.tsx`, `help-center.tsx`)

---

## Scorecard

| Page | Purpose | Persona | Category | Zone | Placement | Fulfillment | Verdict | Target | Rationale | Gaps | Cog |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/app/settings` (`user-settings.tsx`) | This page exists to let an individual admin user manage their personal account preferences (display name, timezone, date format, theme) and notification delivery settings. | `manager` | Z2-3 Account & Help | zone-2 | correct | thin | PATCH | `/app/settings` (keep in place, extend profile section) | The page is correctly scoped to personal preferences only — all settings bind to the authenticated admin's own record via `/api/auth/me` and `/api/admin/me/preferences`, with no association-scoped settings mixed in — but the Profile tab exposes only display name and lacks avatar, phone/contact, and password/auth controls; the notification "System Notifications" catalog tab lists every platform-level event type but lacks per-channel overrides per category (all categories share the same delivery-channel defaults). | (1) No avatar / photo upload. (2) No password change or MFA controls (login is OAuth only — cross-ref auth surface, but user should know this explicitly). (3) "Platform operations" notification category (`platformOps`) covers AI ingestion and feature flags — appropriate for `platform-admin` and `manager`, but identical UI shown to all roles with no role-contextual filtering. (4) No way to test/preview notification delivery from the settings page. | med |
| `/app/help-center` (`help-center.tsx`) | This page exists to provide self-service answers to common operator questions via a searchable FAQ accordion organized by feature area. | `manager` | Z2-3 Account & Help | zone-2 | correct | thin | PATCH | `/app/help-center` (keep in place, add live support entry points and deepen content) | The page is a real help center with genuine content (20 Q&A items across 6 categories with a working search), not a placeholder, but it is static hardcoded content with no links to contextual documentation, no contact/ticket escalation path, and several content gaps relative to current YCM feature coverage. | (1) No link to submit a support ticket or reach live support — self-service only. (2) No content for Amenities, Inspections, Insurance, Resident Feedback, or the recently added Amenity Booking feature. (3) No content for platform-admin workflows (AI ingestion, admin user management). (4) FAQ answers reference page names ("Buildings page", "Governance section") that may not match current nav labels post-IA restructure — content is brittle to nav changes. (5) All content is hardcoded in the `.tsx` file — no CMS or markdown source, so updates require code changes. (6) No "What's new" or changelog surface. | low |

---

## DEMOTE-ADMIN handovers

None. Neither page has a primary persona of `platform-admin`. The `platformOps` notification category inside `user-settings.tsx` references platform-admin events but is a notification preference control, not a platform-admin administrative surface; it belongs in the personal settings page and requires no DEMOTE-ADMIN handover.

---

## Cross-refs

1. **`/api/auth/me` and `/api/admin/me/preferences`** — the two API routes consumed by `user-settings.tsx`. Both are correctly scoped to the authenticated user's own record (`requireAdmin` middleware on the preferences route). No C2 concern (no KILL verdict on this page).

2. **`platformOps` notification category in user-settings.tsx** — covers "AI ingestion events, feature flag changes, executive updates, and critical system notices." This notification preference is correctly personal (the admin opts into receiving these alerts), but the events themselves originate from Zone 3 surfaces. No action needed here; noted for Phase 4 (Zone 3 audit) awareness.

3. **`/portal/amenities` and `owner-portal`** — `help-center.tsx` describes the Owner Portal and Vendor Portal in its "Portals & Access" FAQ category. These are out-of-scope surfaces (`/portal/*`, `/vendor-portal`) per C9. Cross-reference only; no scorecard row.

4. **FAQ answer brittleness** — the help center references "Buildings page" which does not correspond to a currently routed `/app/buildings` path visible in `App.tsx`. Either the route exists outside the scanned range or the FAQ content refers to a surface that has been reorganized. Phase 5 should flag this for content refresh alongside the nav proposal.

5. **Static content coupling** — all FAQ content is co-located in the `.tsx` source file. This is a maintainability concern but not an IA placement defect. It is noted as a gap under PATCH for the help-center row.
