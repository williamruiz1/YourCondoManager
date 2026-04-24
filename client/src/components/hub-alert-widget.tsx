/**
 * 4.1 Wave 5 — HubAlertWidget.
 *
 * Spec: docs/projects/platform-overhaul/decisions/4.1-cross-association-alert-engine.md
 *   - Q9 (zone hub summary widget — count badge + top-3 mini-list +
 *         "All clear" empty state; persona-invariant; pulls from the
 *         same `/api/alerts/cross-association` endpoint as Home/inbox).
 *   - Q6 (single aggregation endpoint; same hook / query key family).
 *   - Q7 (global read-state — dismissing on Home drops the hub widget
 *         count through the shared query cache).
 *   - Q8 (hub widgets do NOT poll — they ride the cache via
 *         fetch-on-navigate; Home/inbox polling refreshes it).
 *
 * Renders on the four zone hubs: Financials, Operations, Governance,
 * Communications. NOT on Home (has its own dedicated panel) or Platform
 * (out of 4.1 scope).
 *
 * Persona-invariant: the server applies `canAccessAlert` feature-domain
 * filtering before the response leaves the backend, so the widget never
 * renders alerts the persona may not see. No client-side role checks.
 */

import { Link } from "wouter";
import { AlertTriangle, ArrowRight, Building2, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCrossAssociationAlerts,
  type AlertItem,
  type AlertSeverity,
  type AlertZone,
} from "@/hooks/useCrossAssociationAlerts";

export type HubAlertZone = "Financials" | "Operations" | "Governance" | "Communications";

const ZONE_PROP_TO_HOOK: Record<HubAlertZone, AlertZone> = {
  Financials: "financials",
  Operations: "operations",
  Governance: "governance",
  Communications: "communications",
};

const ZONE_SLUG: Record<HubAlertZone, string> = {
  Financials: "financials",
  Operations: "operations",
  Governance: "governance",
  Communications: "communications",
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

export interface HubAlertWidgetProps {
  zone: HubAlertZone;
}

export function HubAlertWidget({ zone }: HubAlertWidgetProps) {
  const zoneKey = ZONE_PROP_TO_HOOK[zone];
  const zoneSlug = ZONE_SLUG[zone];
  const { alerts, isLoading, error } = useCrossAssociationAlerts({
    zone: zoneKey,
    limit: 3,
    readState: "unread",
    // Q8: hub widgets ride the cache — no polling. Home/inbox polling
    // already refreshes the query family; invalidations from dismiss /
    // mark-read mutations land here automatically.
    refetchInterval: false,
  });

  const count = alerts.length;

  if (isLoading) {
    return (
      <Card
        data-testid={`hub-alert-widget-${zoneSlug}`}
        data-hub-zone={zone}
      >
        <CardContent className="space-y-3 p-4" data-testid={`hub-alert-widget-loading-${zoneSlug}`}>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card
        data-testid={`hub-alert-widget-${zoneSlug}`}
        data-hub-zone={zone}
      >
        <CardContent className="p-4">
          <div
            className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            data-testid={`hub-alert-widget-error-${zoneSlug}`}
          >
            Unable to load alerts: {error.message}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (count === 0) {
    return (
      <Card
        data-testid={`hub-alert-widget-${zoneSlug}`}
        data-hub-zone={zone}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              <Badge
                variant="outline"
                className="border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300"
                aria-label="0 alerts, all clear"
                data-testid={`hub-alert-widget-badge-${zoneSlug}`}
              >
                {zone} (clear)
              </Badge>
            </div>
          </div>
          <div
            className="mt-3 flex flex-col items-center gap-2 py-4 text-center"
            data-testid={`hub-alert-widget-empty-${zoneSlug}`}
          >
            <ShieldCheck
              className="h-7 w-7 text-emerald-500/70 dark:text-emerald-400/60"
              aria-hidden="true"
            />
            <p className="text-sm text-muted-foreground">
              No alerts for {zone} — all clear.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      data-testid={`hub-alert-widget-${zoneSlug}`}
      data-hub-zone={zone}
    >
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden="true" />
          <Badge
            variant="destructive"
            aria-label={`${count} alerts, expand for details`}
            data-testid={`hub-alert-widget-badge-${zoneSlug}`}
          >
            {zone} ({count} {count === 1 ? "alert" : "alerts"})
          </Badge>
        </div>
        <ul
          className="space-y-2"
          data-testid={`hub-alert-widget-list-${zoneSlug}`}
        >
          {alerts.slice(0, 3).map((alert: AlertItem) => (
            <li key={alert.alertId}>
              <Link
                href={alert.resolutionHref}
                className="group flex items-start gap-3 rounded-lg border bg-background p-3 transition-colors hover:bg-accent/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                data-testid={`hub-alert-widget-item-${alert.alertId}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={severityBadgeVariant(alert.severity)}
                      className="text-xs"
                      data-testid={`hub-alert-widget-item-severity-${alert.alertId}`}
                    >
                      {severityLabel(alert.severity)}
                    </Badge>
                    <span className="truncate text-sm font-medium">
                      {alert.title}
                    </span>
                  </div>
                  <p
                    className="mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm text-muted-foreground"
                    data-testid={`hub-alert-widget-item-description-${alert.alertId}`}
                  >
                    {alert.description}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Building2 className="h-3 w-3" aria-hidden="true" />
                    <span
                      data-testid={`hub-alert-widget-item-association-${alert.alertId}`}
                    >
                      {alert.associationName}
                    </span>
                  </p>
                </div>
                <ArrowRight
                  className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export default HubAlertWidget;
