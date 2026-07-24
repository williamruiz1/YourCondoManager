# Runbook — Google Maps API key restriction (audit R-5, founder-os#8541)

**Key location:** `fly.toml:32` commits `VITE_GOOGLE_MAPS_API_KEY` (`AIzaSyCsb1…dR8`).
Client-exposed **by design** — Vite inlines `VITE_*` vars into the browser bundle, and the
Maps JavaScript API is called from the browser, so the key is public no matter where it is
stored. **The ONLY real protections for a browser Maps key are Google-console restrictions**
(referrer allowlist + API allowlist + quota cap). Moving it to a "secret" changes nothing.

## What the app actually uses (probed 2026-07-03)

- Loader: `client/src/lib/maps-loader.ts` — `@googlemaps/js-api-loader` v2
  (`setOptions` + `importLibrary`), Maps **JavaScript** API only. No Static Maps, no
  server-side Maps calls anywhere in the repo.
- Libraries loaded: `core`, `maps`, `places`, `marker`, `geocoding`
  (→ console-side that is **Maps JavaScript API**, **Places API**, **Geocoding API**).
- Callers: `client/src/pages/new-association.tsx`, `client/src/components/building-pin-editor.tsx`
  — all degrade gracefully when the key is absent (`hasMapsApiKey` false → plain-text inputs).

## Required restriction state (the checklist)

| # | Restriction | Value |
|---|---|---|
| 1 | Application restriction | **Websites (HTTP referrers)** |
| 2 | Referrer allowlist | `https://yourcondomanager.org/*` · `https://*.yourcondomanager.org/*` · `https://yourcondomanager.fly.dev/*` · (dev, optional) `http://localhost:*/*` |
| 3 | API restrictions | **Restrict key** → exactly: Maps JavaScript API, Places API, Geocoding API |
| 4 | Quota cap (per API above) | Maps JS: 10,000 loads/day · Places: 1,000/day · Geocoding: 1,000/day — generous for current usage (admin-only map surfaces), tight enough that a scraped key cannot run a meaningful bill |
| 5 | Billing alert | Budget alert at $25/mo on the owning project |

## The single [WILLIAM] step

Everything above lives in the Google Cloud console under **William's Google account** — the
fleet has no credential for it (correctly). One trip:

> **[WILLIAM]** console.cloud.google.com → select the project owning the key → *APIs & Services
> → Credentials* → click the key ending `…dR8` → set **Application restrictions = Websites** and
> paste the 4 referrers from row 2 → set **API restrictions = Restrict key** and tick the 3 APIs
> from row 3 → Save. Then *APIs & Services → Enabled APIs* → each of the 3 APIs → *Quotas* → set
> the row-4 caps; and *Billing → Budgets & alerts* → $25/mo alert. (~5 minutes, one screen flow.)

## Verification after the trip

From any machine (no credentials needed — the restrictions are observable from outside):

```bash
# Referrer restriction live: a request WITHOUT an allowed referrer must be rejected
curl -s "https://maps.googleapis.com/maps/api/js?key=AIzaSyCsb1tCLccLzdaKgCm4263A32S0Z0LvdR8" | head -c 200
# EXPECT: RefererNotAllowedMapError / "API keys with referer restrictions cannot be used with this API" class error
# The app itself must still load maps at https://yourcondomanager.org (allowed referrer).
```

Record the probe output below this line when run:

- [ ] probe recorded (date · output)
