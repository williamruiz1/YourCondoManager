// zone: shared
//
// Stale-chunk guard for code-split (lazy) routes.
//
// Why this exists
// ---------------
// The client is built with Vite content-hashed chunks (vite.config.ts
// `manualChunks` + Rollup's default hashed asset filenames). Every deploy
// that changes a page module shifts that module's chunk filename. A browser
// tab that was opened BEFORE a deploy still holds the OLD index referencing
// the OLD hashed chunk names; when the user then navigates to a lazy route,
// `import("@/pages/foo")` resolves to a filename that no longer exists on the
// server and the dynamic import rejects with:
//
//     "Failed to fetch dynamically imported module: …/assets/foo-<oldhash>.js"
//     (Chrome) / "error loading dynamically imported module" (Firefox/Safari)
//
// React's `lazy()` surfaces that rejection as a render error → the route
// shows the ErrorBoundary fallback (a dead screen) instead of the page.
//
// The fix
// -------
// Wrap the import: on a dynamic-import failure, reload the page ONCE (which
// re-fetches the fresh index + fresh chunk names), guarded by a sessionStorage
// flag so we never loop if the failure is genuine (a truly missing chunk, an
// offline network, etc.). This is the canonical Vite recommendation for the
// "new deploy invalidates old chunks" problem.
//
// Reference: this is the documented mitigation for Vite's `vite:preloadError`
// event and the equivalent `lazy()` import-failure case.

import { lazy, type ComponentType, type LazyExoticComponent } from "react";

// React.lazy itself is typed against ComponentType<any> so that route
// components carrying their own props (e.g. <LandingPage onStartGoogleSignIn=…>)
// type-check. Mirror that exact constraint here.
type AnyComponent = ComponentType<any>;

const RELOAD_FLAG_PREFIX = "ycm:chunk-reload:";

// A full-page navigation ABORTS this document's in-flight dynamic imports,
// and the rejection is indistinguishable from a stale-chunk error (Safari:
// "Importing a module script failed."). Reloading in that window interrupts
// the navigation the user (or a Playwright goto) just started — the WebKit
// "navigation … interrupted by another navigation to <current page>" flake
// (founder-os#8337). Track unload so the reload path can stand down.
let pageIsUnloading = false;
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => { pageIsUnloading = true; });
  window.addEventListener("beforeunload", () => { pageIsUnloading = true; });
  // bfcache restore (back/forward) reuses this document with pageIsUnloading
  // still `true` from the earlier pagehide. Without resetting it, the reload
  // recovery path below permanently stands down for the life of the restored
  // page — a subsequent stale-chunk navigation then shows a dead error screen
  // instead of self-healing. `pageshow` fires on both fresh loads and bfcache
  // restores; reset the flag so recovery stays armed.
  window.addEventListener("pageshow", () => { pageIsUnloading = false; });
}

/** Matches the cross-browser dynamic-import / chunk-load failure messages. */
export function isChunkLoadError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (!message) return false;
  return (
    /failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /importing a module script failed/i.test(message) || // Safari
    /'?text\/html'? is not a valid JavaScript MIME type/i.test(message) || // SPA index served for a missing .js
    /chunkloaderror/i.test(message) ||
    /loading chunk \d+ failed/i.test(message)
  );
}

function safeSessionStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null; // private mode / storage disabled
  }
}

/**
 * Clear every per-route one-reload-budget flag. Used by the ErrorBoundary's
 * stale-chunk recovery: when the boundary takes over (because this guard's
 * per-chunk reload budget was already spent) and hard-reloads the page, it
 * first wipes these flags so the fresh page load gets a clean recovery budget
 * again — otherwise a lingering "1" flag would make the guard immediately
 * rethrow on the very next stale event instead of reloading.
 */
export function clearChunkReloadFlags(): void {
  const store = safeSessionStorage();
  if (!store) return;
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key && key.startsWith(RELOAD_FLAG_PREFIX)) toRemove.push(key);
    }
    for (const key of toRemove) store.removeItem(key);
  } catch {
    /* storage disabled / access denied — nothing to clear */
  }
}

/**
 * Drop-in replacement for React.lazy that recovers from stale-chunk errors
 * after a deploy by reloading the page once.
 *
 * @param importFn  the dynamic `import()` thunk
 * @param chunkKey  a stable, unique key per route used to scope the
 *                  one-reload-only guard (so two different broken routes
 *                  don't share a single reload budget).
 */
export function lazyWithReload<T extends AnyComponent>(
  importFn: () => Promise<{ default: T }>,
  chunkKey: string,
): LazyExoticComponent<T> {
  const flagKey = `${RELOAD_FLAG_PREFIX}${chunkKey}`;
  return lazy(() =>
    importFn()
      .then((mod) => {
        // Successful load — clear any prior reload flag for this chunk so a
        // future stale-chunk event is allowed to trigger a reload again.
        safeSessionStorage()?.removeItem(flagKey);
        return mod;
      })
      .catch((error: unknown) => {
        const store = safeSessionStorage();
        const alreadyReloaded = store?.getItem(flagKey) === "1";
        if (
          isChunkLoadError(error) &&
          !alreadyReloaded &&
          !pageIsUnloading &&
          typeof window !== "undefined"
        ) {
          // First stale-chunk failure for this route since the last good
          // load: reload once to pick up the fresh index + chunk names.
          // Deferred a beat so an import aborted by an in-progress
          // navigation gets its pagehide/beforeunload signal first —
          // reloading then would cancel the navigation (see note above).
          store?.setItem(flagKey, "1");
          setTimeout(() => {
            if (!pageIsUnloading) window.location.reload();
          }, 50);
          // Return a never-resolving promise so the ErrorBoundary doesn't
          // flash before the reload navigates away.
          return new Promise<never>(() => {});
        }
        // Genuine failure (already reloaded once, or not a chunk error):
        // rethrow so the ErrorBoundary shows the real error.
        throw error;
      }),
  );
}
