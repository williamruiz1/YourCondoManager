# Google Maps API Key — Restriction Runbook

**Source:** founder-os#8541 (production-readiness audit 2026-07-03, finding R-5)
**Key at issue:** `VITE_GOOGLE_MAPS_API_KEY` committed in `fly.toml` (build-time env) and echoed in `INSTALL-OBSERVABILITY.md`.
**Why committed-and-client-exposed is OK *only if restricted*:** Vite inlines `VITE_*` vars into the client bundle, so this key is public **by design** — every Maps JS key is. The security model is Google-console restrictions, not secrecy. An **unrestricted** public key = anyone can burn quota / run up billing on it (the R-5 risk).

## What the app actually uses (verified in code, 2026-07-03)

`client/src/lib/maps-loader.ts` loads the **Maps JavaScript API** (weekly channel) via `@googlemaps/js-api-loader` and imports these libraries: `core`, `maps`, `places`, `marker`, `geocoding`. Consumers: `new-association.tsx` (address autocomplete) + `building-pin-editor.tsx` (pin placement). No Static Maps, no server-side Maps calls, no other Google APIs on this key.

Graceful degradation is already built in: with no/blocked key, `loadGoogleMaps()` returns `null` and the UI falls back to plain-text inputs — so over-restricting fails soft, not hard.

## The one [WILLIAM] step — console restriction (~3 minutes)

Everything below happens at https://console.cloud.google.com/apis/credentials (William's Google account — not reachable from the fleet). Open the key ending in `…LvdR8`, then:

1. **Application restrictions → Websites** (HTTP referrers), add exactly:
   - `https://app.yourcondomanager.org/*`
   - `https://yourcondomanager.org/*`
   - `https://www.yourcondomanager.org/*`
   - `https://yourcondomanager.fly.dev/*`
   - `http://localhost:*` *(keeps local dev working; drop it if you prefer dev to use a separate key)*
2. **API restrictions → Restrict key**, allow ONLY:
   - Maps JavaScript API
   - Places API *(the JS `places` library authorizes against it)*
   - Geocoding API *(the JS `geocoding` library authorizes against it)*
3. **Quotas** (APIs & Services → Maps JavaScript API → Quotas): cap *Map loads per day* at **1,000** (current usage is a handful/day; raise later if a real customer wave needs it). Repeat a sane cap for Places/Geocoding requests per day if offered.
4. Save. Changes take up to 5 minutes.

**Verify after saving (fleet can do this part):** load `https://app.yourcondomanager.org` → new-association page → address field autocompletes (referrer allowed). Then from any non-allowed origin (e.g. a local file), a Maps JS load with this key must show `RefererNotAllowedMapError` in the console.

**Rotation trigger:** if the console shows the key was UNRESTRICTED for a long window AND usage/billing spikes appear in the metrics, rotate (Credentials → Regenerate key) and update `fly.toml:32` + redeploy; the old key dies on regenerate.

## Fleet-side status (done)

- [x] Confirmed which APIs/libraries the key must allow (above) — nothing else needs enabling.
- [x] Confirmed the client degrades gracefully if the key is blocked/absent (`maps-loader.ts` null path).
- [x] This runbook merged at `docs/runbooks/maps-api-key.md`.
- [ ] **[WILLIAM]** the console step above — the single residual action.
