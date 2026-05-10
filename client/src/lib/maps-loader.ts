/**
 * Singleton loader for the Google Maps JavaScript API.
 *
 * Usage:
 *   import { loadGoogleMaps } from "@/lib/maps-loader";
 *   const g = await loadGoogleMaps();
 *   if (!g) { // graceful fallback -- no key configured }
 *
 * Returns null if VITE_GOOGLE_MAPS_API_KEY is not set -- all callers must
 * handle the null case gracefully (degrade to plain-text inputs / no map UI).
 *
 * Uses the v2 functional API (setOptions + importLibrary) which is the
 * non-deprecated path in @googlemaps/js-api-loader >= 2.0.
 */
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

/** True when a Maps API key is configured in the environment. */
export const hasMapsApiKey = Boolean(API_KEY);

let initialized = false;
let corePromise: Promise<void> | null = null;

function ensureInitialized(): Promise<void> {
  if (corePromise) return corePromise;

  if (!initialized) {
    setOptions({
      key: API_KEY ?? "",
      v: "weekly",
    });
    initialized = true;
  }

  corePromise = importLibrary("core").then(() => undefined);
  return corePromise;
}

/**
 * Lazy-load the Google Maps JavaScript SDK.
 *
 * Returns the global google namespace after the SDK has loaded.
 * Returns null when the API key is absent so callers can degrade gracefully.
 */
export async function loadGoogleMaps(): Promise<typeof google | null> {
  if (!API_KEY) return null;

  await ensureInitialized();

  // Pre-load the libraries used across map components
  await Promise.all([
    importLibrary("maps"),
    importLibrary("places"),
    importLibrary("marker"),
    importLibrary("geocoding"),
  ]);

  return google;
}
