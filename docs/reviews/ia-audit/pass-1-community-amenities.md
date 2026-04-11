# Phase 1 Audit — A7 Community & Amenities
**Auditor:** A7
**Date:** 2026-04-11
**Scope:** 2 pages — `amenities-admin.tsx` (`/app/amenities`) and `community-hub.tsx` (`/app/community-hub`)

---

## Scorecard

| Page | Purpose | Persona | Category | Zone | Placement | Fulfillment | Verdict | Target | Rationale | Gaps | Cog |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `amenities-admin.tsx` | This page exists to configure association amenities and manage operator-side reservation and blackout-date workflows. | `manager` | Z1-7 Community & Amenities | zone-1 | wrong-section | complete | RENAME-MOVE | Rename sidebar label to "Amenity Admin" (or "Amenities"); rename URL to `/app/amenity-admin`; keep `AmenitiesAdminPage` component name | Sidebar label "Amenity Booking" implies the resident booking surface; the page is exclusively operator config (create/edit/deactivate amenities, approve/reject reservations, manage blackout dates) — the label actively misleads both personas and future developers | None — content is complete and functional | med |
| `community-hub.tsx` | This page exists to configure the public-facing community hub microsite for an association, including branding, URL slug, section ordering, notices, action links, info blocks, and the infrastructure map. | `manager` | Z1-7 Community & Amenities | zone-1 | correct | complete | PATCH | Add "Admin" or "Config" qualifier to page header title and sidebar label to distinguish operator config surface from the resident-facing `/community/:id` public surface | Label "Community Hub" in the sidebar is ambiguous — it shares a name with the public `/community/:id` microsite it configures; the current header text "Community Hub" matches the public site name exactly, causing potential confusion for onboarding managers | Page header title "Community Hub" duplicates the resident-facing hub name; sidebar label should read "Community Hub Config" or "Hub Settings" to make the configuration-vs-viewing distinction clear | high |

---

## DEMOTE-ADMIN handovers

None. Both pages' primary persona is `manager` (Zone 1). Neither page is platform-operator-only. The sidebar roles for both entries correctly include `board-admin`, `manager`, and `viewer` alongside `platform-admin` — no Zone 3 gate is required or flagged.

---

## Cross-refs

### `amenities.tsx` — resident `/portal/amenities` surface (out of scope)

`amenities.tsx` exports `AmenitiesPage` and is the resident-facing booking UI. It is reachable only via `/portal/amenities` and is NOT registered in `/app/*` routes. It does not appear in `app-sidebar.tsx`. It is correctly out of scope for this audit. Cross-ref note: the resident-facing page and the operator-facing `amenities-admin.tsx` share the conceptual domain — a future Phase 5 proposal should ensure the sidebar label for the operator page is distinct from any label used in the resident portal sidebar, to avoid operator/resident context collapse.

### `community-hub-public.tsx` — public `/community/:id` surface (out of scope)

`community-hub-public.tsx` renders the unauthenticated public microsite at `/community/:identifier`. It consumes `GET /api/hub/:identifier/public` (an ungated public route confirmed in `server/routes.ts:14478`). It shares data types (`notices`, `action-links`, `info-blocks`, `map`) with `community-hub.tsx` but is strictly read-only and public. There is no content duplication between the two files — `community-hub.tsx` is the write/configuration surface and `community-hub-public.tsx` is the read/display surface. The only overlap risk is nomenclature: both share the label "Community Hub" with no qualifier.

---

## Amenity naming analysis

The current state is a three-way mismatch between sidebar label, URL, and page content:

1. **Sidebar label** (`app-sidebar.tsx:158`): `"Amenity Booking"` — implies a booking/reservation calendar interface, the kind of surface a resident or a front-desk operator would use to make a new reservation.
2. **URL** (`/app/amenities`): generic and un-qualified; "amenities" is the domain, not the operation, so the URL does not communicate whether this is config or booking.
3. **Page content** (`amenities-admin.tsx`): the page is entirely operator configuration — it creates, edits, and deactivates amenity records; it reviews and approves/rejects incoming reservations from residents; it sets blackout dates. There is no "make a booking" flow for the operator themselves. The page's own `<h1>` reads "Amenity Booking" (line 192), which matches the sidebar label but misdescribes the page's true function.

The confusion is compounded by the existence of the resident-facing `amenities.tsx` (`/portal/amenities`) which IS the actual resident booking surface. An operator clicking "Amenity Booking" in the sidebar gets the admin config page, not the booking calendar they might expect. A developer reading the sidebar entry might incorrectly assume this is a duplicate of or shortcut to the portal booking surface.

**Recommended resolution (RENAME-MOVE):**
- Sidebar label: change `"Amenity Booking"` → `"Amenity Admin"` (or `"Amenities"` with an explicit sub-label).
- URL: change `/app/amenities` → `/app/amenity-admin` (or `/app/amenities/admin`).
- Page `<h1>`: change `"Amenity Booking"` → `"Amenity Management"`.
- No changes to `AmenitiesAdminPage` component name, `server/routes/amenities.ts` route handlers, or schema — only nav label and URL slug need updating (enforced by C5: no changes in Phase 1; this is a proposal for Phase 5/6).
- The App.tsx route mapping (`App.tsx:304`) should be updated at the same time to match the new URL, with a `<RouteRedirect from="/app/amenities" to="/app/amenity-admin" />` entry added for backward compatibility per the Wouter+RouteRedirect deprecation pattern (C7).
