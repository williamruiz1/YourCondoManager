import type { ReactNode } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function AsyncStateBoundary({
  isLoading,
  error,
  onRetry,
  isEmpty,
  emptyTitle = "Nothing here yet",
  emptyMessage = "No records are available for the current scope.",
  loadingRows = 3,
  children,
}: {
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  loadingRows?: number;
  children: ReactNode;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 space-y-3">
          {Array.from({ length: loadingRows }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="rounded-md border p-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <div className="font-medium">This section could not be loaded.</div>
              <div className="text-sm text-muted-foreground">{error instanceof Error ? error.message : "Unknown error"}</div>
            </div>
          </div>
          {onRetry ? (
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  if (isEmpty) {
    return (
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="font-medium">{emptyTitle}</div>
          <div className="mt-1 max-w-prose text-sm leading-6 text-muted-foreground">{emptyMessage}</div>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}
