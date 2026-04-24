/**
 * 4.1 Wave 3 — Home alerts panel.
 *
 * Spec: docs/projects/platform-overhaul/decisions/4.1-cross-association-alert-engine.md
 *   - Q3: Home is the high-priority triage view (inbox is the archive).
 *   - Q6: consumes `GET /api/alerts/cross-association` via the hook.
 *   - Q7: mark-read + dismiss write to `alertReadStates`; both are
 *         per-user, shared across surfaces.
 *   - Q8: hook handles the 120s polling; panel is pure presentation.
 *
 * Persona-invariant: the server applies `canAccessAlert` feature-domain
 * filtering before the response leaves the backend, so the panel never
 * shows alerts the persona may not see. No client-side role checks here.
 */

import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  AlertTriangle,
  CheckCheck,
  ArrowRight,
  Building2,
  X as XIcon,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCrossAssociationAlerts,
  type AlertItem,
  type AlertSeverity,
  type AlertZone,
} from "@/hooks/useCrossAssociationAlerts";

const ZONE_LABELS: Record<AlertZone, string> = {
  home: "Home",
  financials: "Financials",
  operations: "Operations",
  governance: "Governance",
  communications: "Communications",
  platform: "Platform",
};

// Order zones so the rendered grouping is stable and matches the 1.1 zone
// taxonomy reading order (Home → Financials → Operations → Governance →
// Communications → Platform).
const ZONE_ORDER: readonly AlertZone[] = [
  "home",
  "financials",
  "operations",
  "governance",
  "communications",
  "platform",
];

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

function groupByZone(alerts: AlertItem[]): Array<{ zone: AlertZone; items: AlertItem[] }> {
  const by = new Map<AlertZone, AlertItem[]>();
  for (const a of alerts) {
    const list = by.get(a.zone) ?? [];
    list.push(a);
    by.set(a.zone, list);
  }
  return ZONE_ORDER.filter((z) => by.has(z)).map((zone) => ({
    zone,
    items: by.get(zone)!,
  }));
}

export function HomeAlertsPanel() {
  const { alerts, isLoading, error, markAsRead, dismiss } = useCrossAssociationAlerts({
    readState: "unread",
    limit: 10,
  });

  // Track in-flight per-alert actions so the panel disables buttons during
  // the mutation round-trip (prevents double-click double-writes).
  const [pendingById, setPendingById] = useState<Record<string, "read" | "dismiss" | undefined>>(
    {},
  );

  const grouped = useMemo(() => groupByZone(alerts), [alerts]);

  async function handleMarkAsRead(alertId: string) {
    setPendingById((prev) => ({ ...prev, [alertId]: "read" }));
    try {
      await markAsRead(alertId);
    } finally {
      setPendingById((prev) => {
        const { [alertId]: _omit, ...rest } = prev;
        return rest;
      });
    }
  }

  async function handleDismiss(alertId: string) {
    setPendingById((prev) => ({ ...prev, [alertId]: "dismiss" }));
    try {
      await dismiss(alertId);
    } finally {
      setPendingById((prev) => {
        const { [alertId]: _omit, ...rest } = prev;
        return rest;
      });
    }
  }

  async function handleMarkAllRead() {
    // Iterate through currently visible alerts — per spec, "Mark all read"
    // only acts on what the user can see on the panel (not the full catalog).
    const ids = alerts.map((a) => a.alertId);
    await Promise.all(ids.map((id) => markAsRead(id)));
  }

  return (
    <Card data-testid="home-alerts-panel">
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Cross-association alerts
        </CardTitle>
        {alerts.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleMarkAllRead}
            data-testid="button-alerts-mark-all-read"
          >
            <CheckCheck className="mr-1 h-4 w-4" />
            Mark all read
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3" data-testid="home-alerts-loading">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : error ? (
          <div
            className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            data-testid="home-alerts-error"
          >
            Unable to load alerts: {error.message}
          </div>
        ) : alerts.length === 0 ? (
          <div
            className="flex flex-col items-center gap-2 py-6 text-center"
            data-testid="home-alerts-empty"
          >
            <ShieldCheck className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No active alerts — all clear</p>
          </div>
        ) : (
          <div className="space-y-5">
            {grouped.map(({ zone, items }) => (
              <div key={zone} className="space-y-2" data-testid={`alerts-zone-group-${zone}`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {ZONE_LABELS[zone]}
                  </h3>
                  <span className="text-xs text-muted-foreground" data-testid={`alerts-zone-count-${zone}`}>
                    {items.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {items.map((alert) => {
                    const pending = pendingById[alert.alertId];
                    return (
                      <div
                        key={alert.alertId}
                        className="rounded-lg border bg-background p-3"
                        data-testid={`alert-item-${alert.alertId}`}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium truncate">{alert.title}</span>
                              <Badge
                                variant={severityBadgeVariant(alert.severity)}
                                className="text-xs"
                                data-testid={`alert-severity-${alert.alertId}`}
                              >
                                {severityLabel(alert.severity)}
                              </Badge>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {alert.description}
                            </p>
                            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                              <Building2 className="h-3 w-3" />
                              <span data-testid={`alert-association-${alert.alertId}`}>
                                {alert.associationName}
                              </span>
                            </p>
                          </div>
                          <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                            <Button
                              asChild
                              size="sm"
                              variant="outline"
                              data-testid={`alert-view-${alert.alertId}`}
                            >
                              <Link href={alert.resolutionHref}>
                                View
                                <ArrowRight className="ml-1 h-3.5 w-3.5" />
                              </Link>
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDismiss(alert.alertId)}
                              disabled={pending === "dismiss"}
                              data-testid={`alert-dismiss-${alert.alertId}`}
                            >
                              <XIcon className="mr-1 h-3.5 w-3.5" />
                              Dismiss
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleMarkAsRead(alert.alertId)}
                              disabled={pending === "read"}
                              data-testid={`alert-mark-read-${alert.alertId}`}
                            >
                              Mark read
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default HomeAlertsPanel;
