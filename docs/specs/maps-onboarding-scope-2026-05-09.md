# Maps Onboarding — Full Scope Spec
**Workstream:** maps-onboarding
**Date:** 2026-05-09
**Status:** Ready for execution

---

## Overview

YCM has a complete backend for maps (`hubMapLayers`, `hubMapNodes`, `hubMapIssues` tables + all API endpoints). The entire frontend map experience is missing. This workstream delivers it.

**Goal:** Make onboarding a new HOA association seamless, interactive, and low-effort. The association admin should be able to set up their community map in under 5 minutes with no technical knowledge required.

Google Maps APIs are enabled on the `yourcondomanager-prod` GCP project. API key is created and ready (see Environment Variables section).

---

## Four Phases

### Phase 1 — Address → Map (new-association onboarding)

**What it does:** Replace the plain text address field on association creation with Google Places Autocomplete. On selection, geocode to lat/lng, show a satellite view of the property, and ask the admin to confirm "Is this your community?" before proceeding.

**Files:**
- `client/src/pages/new-association.tsx` — wire in Places Autocomplete, add confirmation step, send lat/lng to API
- `shared/schema.ts` — add `latitudeDeg` and `longitudeDeg` to associations table definition
- New migration — `ALTER TABLE associations ADD COLUMN latitude_deg DECIMAL(9,6), ADD COLUMN longitude_deg DECIMAL(9,6)`

**Acceptance criteria:**
- [ ] Address field on new-association form shows Google Places Autocomplete dropdown
- [ ] Selecting an address geocodes it and shows a satellite map thumbnail centered on the property
- [ ] Google Street View thumbnail of the address appears alongside the satellite view
- [ ] Admin sees "Is this your community?" with Yes / Search again options
- [ ] Confirming stores `latitude_deg` and `longitude_deg` on the associations row
- [ ] Skipping or rejecting the confirmation does not store coordinates
- [ ] Form still works if Maps SDK fails to load (graceful degradation — falls back to text input)

---

### Phase 2 — Building pin placement (interactive, fun)

**What it does:** Immediately after address confirmation, open a satellite view of the complex in "Place your buildings" mode. The admin clicks on the map to drop animated pins. Each pin prompts for a building name/number. Pins can be dragged, renamed, or deleted. This is the payoff moment — it should feel delightful.

**Files:**
- `client/src/components/building-pin-editor.tsx` — new component; owns the full pin-placement interaction
- Connects to existing `hubMapNodes` API endpoints to persist each pin as a node linked to the building record

**Pin data model:**
- Each pin creates a `hubMapNode` with `geometry: { lat, lng }` and `label: "<building name>"`
- Node is linked to the `building` record via `buildingId`

**Interaction details:**
- Click anywhere on satellite map → pin drops with CSS animation (no heavy animation library)
- Immediately prompts: "Name this building" (inline, not a modal — keep the user in the map)
- Pin shows building name label on the map
- Drag pin to adjust location → updates node geometry on drag-end
- Click pin → shows "Rename" and "Delete" options
- Progress indicator: "3 buildings placed" to give sense of progress
- CTA at bottom: "All buildings placed? Let's go →" (enabled as soon as at least 1 pin exists)

**Acceptance criteria:**
- [ ] After address confirmation, satellite map loads in pin-placement mode
- [ ] Clicking map drops a pin with a drop animation (CSS transition, no Framer/GSAP)
- [ ] Pin prompts for building name inline on the map
- [ ] Each confirmed pin creates a `hubMapNode` via API
- [ ] Pins can be dragged to a new position; geometry updates on drag-end
- [ ] Pins can be renamed and deleted
- [ ] Admin can proceed with at least 1 pin placed
- [ ] All interactions work on touch (mobile)

---

### Phase 3 — Site plan overlay (optional, skippable)

**What it does:** After building pins are placed, offer the admin the option to upload a site plan image (PDF or PNG) and overlay it on the satellite map. The admin drags the corners of the image to align it with the satellite view. Saved as a `hubMapLayer`.

This step is clearly marked as optional — most admins will skip it. It should also be accessible later from Community Hub settings.

**Files:**
- `client/src/components/MapLayerManager.tsx` (or the relevant existing component) — extend with upload + corner-drag alignment UI

**Acceptance criteria:**
- [ ] Step is labeled "Optional — skip for now" with a visible skip button
- [ ] Admin can upload a PNG or PDF site plan
- [ ] Uploaded image overlays on the satellite map
- [ ] Admin can drag the four corners of the overlay to align it
- [ ] Confirmed overlay saves as a `hubMapLayer` with coordinate system mapping
- [ ] Skipping this step does not block onboarding completion
- [ ] Site plan upload is also accessible from Community Hub settings (not only during onboarding)

---

### Phase 4 — Public community hub map

**What it does:** Replace the `map: () => null` stub in the public community hub with a real Google Maps embed. Show building pins, a Street View thumbnail, and support two resident interactions: "Find your building" (tap pin → see unit list) and "Report an issue" (tap map → location pre-filled in issue form).

**Files:**
- `client/src/pages/community-hub-public.tsx` — replace `map: () => null`, wire in the new map component
- `client/src/components/community-map-view.tsx` — new component; owns the public-facing map experience

**Resident interactions:**
1. **Find your building** — tap a building pin → slide-up panel shows building name + unit list for that building
2. **Report an issue** — tap anywhere on map → report-issue form opens with lat/lng pre-filled; submission goes to admin issue queue (creates `hubMapIssue`)

**Acceptance criteria:**
- [ ] Public community hub page shows Google Maps embed (not null)
- [ ] Map is centered on the association's stored `latitude_deg` / `longitude_deg`
- [ ] Building pins from `hubMapNodes` appear on the map
- [ ] Street View thumbnail of the community entrance is shown
- [ ] Tapping a building pin shows building name and unit list
- [ ] Tapping the map opens a report-issue form with location pre-filled
- [ ] Submitted issue creates a `hubMapIssue` record in the admin queue
- [ ] All interactions work on mobile (touch)

---

## Technical Requirements

### New dependency
```
npm install @googlemaps/js-api-loader
```

Used for lazy-loading the Google Maps JavaScript API. Do not import the SDK at the module level — all map components must use the loader so the SDK is never fetched on pages that don't render a map.

### Environment variables
| Variable | Where needed | Notes |
|---|---|---|
| `GOOGLE_MAPS_API_KEY` | Server (for SSR geocoding if needed) + client (for Maps JS API) | Key created 2026-05-09 in `yourcondomanager-prod` GCP project. Add to Fly.io secrets: `fly secrets set GOOGLE_MAPS_API_KEY=<key> --app yourcondomanager-prod` |

The key must be added to Fly.io before any map feature can function in production.

### New database migration
```sql
ALTER TABLE associations
  ADD COLUMN latitude_deg  DECIMAL(9, 6),
  ADD COLUMN longitude_deg DECIMAL(9, 6);
```

Both columns nullable — existing associations without a mapped address are valid.

### Lazy loading — mandatory
Every component that renders a map must lazy-load the Maps SDK via `@googlemaps/js-api-loader`. Pattern:

```ts
import { Loader } from '@googlemaps/js-api-loader';

const loader = new Loader({
  apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  libraries: ['places', 'marker'],
});

// Inside component effect or async init:
const google = await loader.load();
```

Use `React.lazy` + `Suspense` for the component itself so the entire map bundle is code-split.

### Animation
Pin-drop animation must use CSS transitions only:
```css
@keyframes pin-drop {
  0%   { transform: translateY(-40px); opacity: 0; }
  60%  { transform: translateY(4px);   opacity: 1; }
  100% { transform: translateY(0);     opacity: 1; }
}
.map-pin-entering {
  animation: pin-drop 0.3s ease-out forwards;
}
```

No Framer Motion, GSAP, or other animation libraries for this feature.

### Mobile-first
- All tap targets minimum 44x44px
- Drag interactions use Pointer Events API (works for both touch and mouse)
- Map containers must specify explicit height (Maps JS API requires it)
- Side panels / prompts use bottom-sheet pattern on mobile, sidebar on desktop

---

## Overall Acceptance Criteria

- [ ] New HOA admin can complete address confirmation + building pin setup in under 5 minutes
- [ ] Address autocomplete works on the new-association creation form
- [ ] Satellite map shows on the address confirmation step
- [ ] Admin can place, drag, rename, and delete building pins on satellite view
- [ ] Public community hub shows a real Google Maps embed with building pins
- [ ] Resident can tap a building pin to see building name and unit list
- [ ] Resident can tap the map to report a location-based issue, with location pre-filled
- [ ] All steps work on mobile (touch interactions)
- [ ] Maps SDK does not load on pages that don't render a map
- [ ] `npx tsc --noEmit` passes clean with no new type errors

---

## Out of Scope

- Routing / directions between buildings
- Offline map support
- Custom map styling (standard satellite view is sufficient for now)
- Bulk import of building locations via CSV
- Map analytics / heatmaps

---

## Build Order

Follow the standard data-first order:

1. Migration (`latitude_deg`, `longitude_deg` on associations)
2. Update `shared/schema.ts` types
3. Phase 1 — Address autocomplete + confirmation + coordinate storage
4. Phase 2 — Building pin editor (`building-pin-editor.tsx`)
5. Phase 3 — Site plan overlay extension (optional step, skippable)
6. Phase 4 — Public hub map (`community-map-view.tsx`)
7. Type-check clean pass (`npx tsc --noEmit`)

Do not start Phase 2 until the migration is applied and Phase 1 stores coordinates correctly.

---

## Open Items Before Execution

1. **API key must be added to Fly.io secrets** before any map feature works in production. Key string is available — run: `fly secrets set GOOGLE_MAPS_API_KEY=<key> --app yourcondomanager-prod`
2. **API key restrictions** — the key was created without referrer restrictions (the `--allowed-referrers` flag requires the alpha component). Before going to production, add HTTP referrer restrictions in Cloud Console: `app.yourcondomanager.org/*` and `localhost:5000/*`.
3. **`VITE_GOOGLE_MAPS_API_KEY`** — the client-side env var must be exposed via Vite's `VITE_` prefix convention. Confirm how the app loads env vars for the frontend bundle.
