// zone: shared
//
// 5.2 — Root React ErrorBoundary.
//
// Spec: docs/projects/platform-overhaul/decisions/5.2-error-states.md (AC #2, #3)
//
// Wraps the authenticated App tree so that a render error in a
// lazy-loaded route renders <ErrorState> instead of a blank page.
// Also exposed for localized use (e.g. wrapping a single panel) — pass
// `fallback` to replace the default `<ErrorState>` body.

import { Component, type ErrorInfo, type ReactNode } from "react";
import { ErrorState } from "@/components/error-state";
import { reportError } from "@/lib/error-reporting";
import { isChunkLoadError, clearChunkReloadFlags } from "@/lib/lazy-with-reload";

// Stale-chunk recovery net (deploy-invalidated lazy chunks).
//
// `lazyWithReload` already reloads once on the FIRST stale-chunk failure per
// route. But if that per-route budget was already spent (or the reload was
// skipped mid-unload, or a second deploy raced in), React.lazy rethrows the
// chunk error up to this boundary. The old behavior surfaced a generic error
// whose "Retry" merely re-rendered — re-attempting the SAME 404'd import and
// failing again immediately, leaving the user permanently wedged with no way
// to reach the fresh build. This boundary now recognizes a stale-chunk error
// and hard-reloads the page ONCE (loop-guarded), which fetches the fresh index
// + fresh chunk names and lets the page load.
const BOUNDARY_RELOAD_AT = "ycm:chunk-boundary-reload-at";
// Only auto-reload once per cooldown window: if the page reloads and the SAME
// chunk error recurs within this window, treat the deploy as genuinely broken,
// stop auto-reloading, and show a manual "Reload" action instead of looping.
const BOUNDARY_RELOAD_COOLDOWN_MS = 15000;

function boundaryReloadRecentlyAttempted(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const last = Number(window.sessionStorage.getItem(BOUNDARY_RELOAD_AT)) || 0;
    return Date.now() - last < BOUNDARY_RELOAD_COOLDOWN_MS;
  } catch {
    return false;
  }
}

function hardReloadForFreshBuild(): void {
  if (typeof window === "undefined") return;
  // Give the lazy guard a clean per-route reload budget on the fresh load.
  clearChunkReloadFlags();
  try {
    window.sessionStorage.setItem(BOUNDARY_RELOAD_AT, String(Date.now()));
  } catch {
    /* storage disabled — reload anyway */
  }
  window.location.reload();
}

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  /**
   * Optional extra handler invoked alongside the built-in reportError.
   * Useful for call-site specific tracking (e.g. tag the error with
   * which panel failed on Home).
   */
  onError?: (error: Error, info: ErrorInfo) => void;
  /**
   * Propagated to the default <ErrorState> when no custom fallback is
   * supplied.
   */
  title?: string;
  description?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  /** True when the caught error is a deploy-invalidated (stale) lazy chunk. */
  isChunkError: boolean;
  /** True once we have triggered a hard reload and are navigating away. */
  reloading: boolean;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    isChunkError: false,
    reloading: false,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      isChunkError: isChunkLoadError(error),
      reloading: false,
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportError(error, { componentStack: info.componentStack });
    this.props.onError?.(error, info);

    // Stale-chunk recovery net: the lazy guard's own one-reload budget was
    // spent (or skipped), so we take over. Hard-reload once to pick up the
    // fresh build — unless we just reloaded and the same error recurred
    // (genuinely broken deploy), in which case fall through to a manual
    // "Reload" action rather than looping.
    if (isChunkLoadError(error) && !boundaryReloadRecentlyAttempted()) {
      this.setState({ reloading: true });
      hardReloadForFreshBuild();
    }
  }

  retry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      isChunkError: false,
      reloading: false,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // A hard reload is in flight — render a neutral placeholder rather than
      // flashing an error screen right before the page navigates away.
      if (this.state.reloading) {
        return <div className="container mx-auto p-4" aria-busy="true" />;
      }

      // Deploy-invalidated stale chunk that the auto-reload could not clear
      // (e.g. same error recurred within the cooldown). Always give a working
      // HARD-reload action — a soft re-render would just re-fail the 404'd
      // import. This intentionally overrides any custom `fallback`, because a
      // missing JS chunk is a page-level problem only a reload can fix.
      if (this.state.isChunkError) {
        return (
          <div className="container mx-auto p-4" data-testid="error-boundary-fallback">
            <ErrorState
              title="A new version is available"
              description="The app was updated. Reload the page to continue."
              retry={hardReloadForFreshBuild}
              details={this.state.error?.message}
            />
          </div>
        );
      }

      if (this.props.fallback !== undefined) {
        return this.props.fallback;
      }
      return (
        <div className="container mx-auto p-4" data-testid="error-boundary-fallback">
          <ErrorState
            title={this.props.title}
            description={this.props.description}
            retry={this.retry}
            details={this.state.error?.message}
          />
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
