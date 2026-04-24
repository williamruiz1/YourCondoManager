// zone: shared
//
// 5.2 — Shared ErrorState component.
//
// Spec: docs/projects/platform-overhaul/decisions/5.2-error-states.md
//
// Used by the root <ErrorBoundary> (see `error-boundary.tsx`) and by
// individual page-level error paths (e.g. TanStack Query `error`).
//
// Copy is intentionally generic — callers should not leak backend error
// internals into the visible title/description; the `details` prop
// exposes the raw message in a collapsed <details> for engineering
// triage without putting it in the page chrome.

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface ErrorStateProps {
  title?: string;
  description?: string;
  retry?: () => void;
  details?: string;
  /**
   * Override the default `data-testid="error-state"` when a single page
   * renders multiple error states and needs disambiguation in tests.
   */
  testId?: string;
}

export function ErrorState({
  title = "Something went wrong",
  description = "We hit an unexpected error. Try again, or reload the page if the problem persists.",
  retry,
  details,
  testId = "error-state",
}: ErrorStateProps) {
  return (
    <Card data-testid={testId}>
      <CardContent className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <AlertTriangle
          className="h-10 w-10 text-destructive"
          aria-hidden="true"
          data-testid={`${testId}-icon`}
        />
        <p
          className="mt-4 text-lg font-medium"
          data-testid={`${testId}-title`}
        >
          {title}
        </p>
        <p
          className="mt-2 max-w-md text-sm text-muted-foreground"
          data-testid={`${testId}-description`}
        >
          {description}
        </p>
        {retry ? (
          <div className="mt-6">
            <Button
              variant="default"
              onClick={retry}
              data-testid={`${testId}-retry`}
            >
              <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
              Retry
            </Button>
          </div>
        ) : null}
        {details ? (
          <details
            className="mt-6 w-full max-w-md text-left"
            data-testid={`${testId}-details`}
          >
            <summary className="cursor-pointer text-xs text-muted-foreground">
              Technical details
            </summary>
            <pre className="mt-2 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
              {details}
            </pre>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default ErrorState;
