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
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportError(error, { componentStack: info.componentStack });
    this.props.onError?.(error, info);
  }

  retry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
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
