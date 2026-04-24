// zone: Communications
// persona: Manager | Board Officer | Assisted Board | PM Assistant | Viewer | Platform Admin
/**
 * 4.1 Wave 4 — Central inbox page.
 *
 * Spec: docs/projects/platform-overhaul/decisions/4.1-cross-association-alert-engine.md
 *   - Q4 (2026-04-21): inbox lives at `/app/communications/inbox` under the
 *     Communications zone.
 *   - Q7 (2026-04-24): global read-state shared with the Home panel — same
 *     `alertReadStates` table, same deterministic `alertId`. Read / dismiss /
 *     restore mutations write through the same endpoint family and
 *     invalidate the shared TanStack Query cache.
 *   - Q8 (2026-04-24): hybrid refresh — fetch-on-navigate + 120s polling
 *     while the page is active. Polling handled inside
 *     `useCrossAssociationAlerts`; the page itself is pure presentation.
 *
 * Persona-invariant: no client-side role checks. Server-side
 * `canAccessAlert` feature-domain filtering (4.1 Q5) runs before the
 * payload leaves the backend, so the inbox never renders alerts the
 * persona may not see.
 *
 * Filter tabs:
 *   - All      → `readState: "all"` (unfiltered server payload).
 *   - Unread   → `readState: "unread"` (default tab — matches Home triage).
 *   - Archived → `readState: "all"` data, client-filtered to
 *                `dismissedAt != null` (the archived view).
 */

import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Inbox as InboxIcon,
  RotateCcw,
  ShieldCheck,
  X as XIcon,
} from "lucide-react";

import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useCrossAssociationAlerts,
  type AlertItem,
  type AlertReadStateEntry,
  type AlertSeverity,
  type AlertZone,
} from "@/hooks/useCrossAssociationAlerts";

export type InboxFilter = "all" | "unread" | "archived";

// Higher than Home's 10 — the inbox is the full-history view (per Q3 +
// spec brief). Capped at 200 by the server endpoint.
const INBOX_FETCH_LIMIT = 200;

const ZONE_LABELS: Record<AlertZone, string> = {
  home: "Home",
  financials: "Financials",
  operations: "Operations",
  governance: "Governance",
  communications: "Communications",
  platform: "Platform",
};

function severityBadgeVariant(
  severity: AlertSeverity,
): "default" | "destructive" | "secondary" | "outline" {
  switch (severity) {
    case "critical":
    case "high":
      return "destructive";
    case "medium":
      return "default";
    case "low":
    default:
      return "secondary";
  }
}

function severityLabel(severity: AlertSeverity): string {
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

// Local copy of portfolio's relative-time formatter. Kept here so the page
// doesn't depend on a utility module that another zone owns.
function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSeconds = Math.max(0, Math.floor((now - then) / 1000));
  if (diffSeconds < 60) return "Just now";
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return new Date(iso).toLocaleDateString();
}

interface InboxRowProps {
  alert: AlertItem;
  readState: AlertReadStateEntry | undefined;
  dismissed: boolean;
  unread: boolean;
  pending: "read" | "dismiss" | "restore" | undefined;
  onMarkAsRead: (alertId: string) => void;
  onDismiss: (alertId: string) => void;
  onRestore: (alertId: string) => void;
}

function InboxRow({
  alert,
  readState: _readState,
  dismissed,
  unread,
  pending,
  onMarkAsRead,
  onDismiss,
  onRestore,
}: InboxRowProps) {
  return (
    <div
      className="rounded-lg border bg-background p-3"
      data-testid={`inbox-alert-item-${alert.alertId}`}
      data-dismissed={dismissed ? "true" : "false"}
      data-unread={unread ? "true" : "false"}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium truncate">{alert.title}</span>
            <Badge
              variant={severityBadgeVariant(alert.severity)}
              className="text-xs"
              data-testid={`inbox-alert-severity-${alert.alertId}`}
            >
              {severityLabel(alert.severity)}
            </Badge>
            <Badge
              variant="outline"
              className="text-xs"
              data-testid={`inbox-alert-zone-${alert.alertId}`}
            >
              {ZONE_LABELS[alert.zone]}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{alert.description}</p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              <span data-testid={`inbox-alert-association-${alert.alertId}`}>
                {alert.associationName}
              </span>
            </span>
            <span aria-hidden="true">·</span>
            <span data-testid={`inbox-alert-createdAt-${alert.alertId}`}>
              {formatRelativeTime(alert.createdAt)}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
          <Button
            asChild
            size="sm"
            variant="outline"
            data-testid={`inbox-alert-view-${alert.alertId}`}
          >
            <Link href={alert.resolutionHref}>
              View
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
          {dismissed ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onRestore(alert.alertId)}
              disabled={pending === "restore"}
              data-testid={`inbox-alert-restore-${alert.alertId}`}
            >
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              Restore
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDismiss(alert.alertId)}
              disabled={pending === "dismiss"}
              data-testid={`inbox-alert-dismiss-${alert.alertId}`}
            >
              <XIcon className="mr-1 h-3.5 w-3.5" />
              Dismiss
            </Button>
          )}
          {unread && !dismissed && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onMarkAsRead(alert.alertId)}
              disabled={pending === "read"}
              data-testid={`inbox-alert-mark-read-${alert.alertId}`}
            >
              Mark as read
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CommunicationsInboxPage() {
  useDocumentTitle("Inbox — Communications");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Default tab is Unread (triage-first UX — matches the Home panel's
  // default view so users flip between them without a mental model
  // reset).
  const [filter, setFilter] = useState<InboxFilter>("unread");

  // Unread uses its own server filter (cheap + matches the Home query
  // cache). All / Archived share a single readState=all query so
  // switching between them is instant (no refetch).
  const unreadQuery = useCrossAssociationAlerts({
    readState: "unread",
    limit: INBOX_FETCH_LIMIT,
    enabled: filter === "unread",
  });

  const allQuery = useCrossAssociationAlerts({
    readState: "all",
    limit: INBOX_FETCH_LIMIT,
    enabled: filter !== "unread",
  });

  // The mark-as-read / dismiss mutations from the active query family
  // are already wired to invalidate the whole `["alerts",
  // "cross-association"]` family on success — so dismissing an alert in
  // the "All" tab auto-refreshes the "Archived" tab's data on the next
  // navigation.
  const activeQuery = filter === "unread" ? unreadQuery : allQuery;
  const {
    alerts: rawAlerts,
    readStateBy,
    isLoading,
    error,
    markAsRead,
    dismiss,
  } = activeQuery;

  // Restore mutation lives here (not in the shared hook) — Wave 4
  // introduces it and the hook API is deliberately minimal.
  const restoreMutation = useMutation({
    mutationFn: async (alertId: string) => {
      await apiRequest("POST", `/api/alerts/${encodeURIComponent(alertId)}/restore`, {});
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["alerts", "cross-association"] });
    },
    onError: (err: unknown) => {
      toast({
        title: "Could not restore alert",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const [pendingById, setPendingById] = useState<
    Record<string, "read" | "dismiss" | "restore" | undefined>
  >({});

  async function withPending(
    alertId: string,
    kind: "read" | "dismiss" | "restore",
    run: () => Promise<void>,
  ) {
    setPendingById((prev) => ({ ...prev, [alertId]: kind }));
    try {
      await run();
    } finally {
      setPendingById((prev) => {
        const { [alertId]: _omit, ...rest } = prev;
        return rest;
      });
    }
  }

  function handleMarkAsRead(alertId: string) {
    void withPending(alertId, "read", () => markAsRead(alertId));
  }
  function handleDismiss(alertId: string) {
    void withPending(alertId, "dismiss", () => dismiss(alertId));
  }
  function handleRestore(alertId: string) {
    void withPending(alertId, "restore", () => restoreMutation.mutateAsync(alertId));
  }

  // Apply the client-side "Archived" filter. For "All" and "Unread", we
  // render the server payload as-is.
  const visibleAlerts = useMemo<AlertItem[]>(() => {
    if (filter === "archived") {
      return rawAlerts.filter((a) => {
        const entry = readStateBy[a.alertId];
        return entry && entry.dismissedAt !== null && entry.dismissedAt !== undefined;
      });
    }
    return rawAlerts;
  }, [rawAlerts, readStateBy, filter]);

  const emptyCopy: Record<InboxFilter, string> = {
    all: "Inbox is empty",
    unread: "No unread alerts — all caught up",
    archived: "No archived alerts",
  };

  return (
    <div className="container mx-auto max-w-5xl space-y-4 p-4" data-testid="communications-inbox-page">
      <BreadcrumbNav route="/app/communications/inbox" />

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <InboxIcon className="h-6 w-6" aria-hidden="true" />
          Inbox
        </h1>
        <p className="text-sm text-muted-foreground">
          One place for cross-association alerts across every zone you can access.
          Dismissing an alert archives it here and clears it from the Home panel.
        </p>
      </header>

      <Tabs
        value={filter}
        onValueChange={(v) => setFilter(v as InboxFilter)}
        data-testid="inbox-filter-tabs"
      >
        <TabsList>
          <TabsTrigger value="all" data-testid="inbox-tab-all">
            All
          </TabsTrigger>
          <TabsTrigger value="unread" data-testid="inbox-tab-unread">
            Unread
          </TabsTrigger>
          <TabsTrigger value="archived" data-testid="inbox-tab-archived">
            Archived
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {filter === "unread"
              ? "Unread alerts"
              : filter === "archived"
                ? "Archived alerts"
                : "All alerts"}
          </CardTitle>
          <span className="text-xs text-muted-foreground" data-testid="inbox-count">
            {visibleAlerts.length}
          </span>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3" data-testid="inbox-loading">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : error ? (
            <div
              className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
              data-testid="inbox-error"
            >
              Unable to load inbox: {error.message}
            </div>
          ) : visibleAlerts.length === 0 ? (
            <div
              className="flex flex-col items-center gap-2 py-10 text-center"
              data-testid={`inbox-empty-${filter}`}
            >
              <ShieldCheck className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{emptyCopy[filter]}</p>
            </div>
          ) : (
            <div className="space-y-2" data-testid="inbox-list">
              {visibleAlerts.map((alert) => {
                const entry = readStateBy[alert.alertId];
                const dismissed = Boolean(entry?.dismissedAt);
                const read = Boolean(entry?.readAt);
                const unread = !read && !dismissed;
                return (
                  <InboxRow
                    key={alert.alertId}
                    alert={alert}
                    readState={entry}
                    dismissed={dismissed}
                    unread={unread}
                    pending={pendingById[alert.alertId]}
                    onMarkAsRead={handleMarkAsRead}
                    onDismiss={handleDismiss}
                    onRestore={handleRestore}
                  />
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
