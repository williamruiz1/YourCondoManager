/**
 * 4.1 Wave 3 — `useCrossAssociationAlerts` hook.
 *
 * Spec: docs/projects/platform-overhaul/decisions/4.1-cross-association-alert-engine.md
 *   - Q6 (single aggregation endpoint `GET /api/alerts/cross-association`).
 *   - Q7 (global read-state with deterministic alertIds + mutations).
 *   - Q8 (hybrid refresh — fetch-on-navigate + 120s polling while tab is
 *         focused, no background polling).
 *
 * This hook powers the Home alerts panel (Wave 3). Later waves reuse the
 * same hook for the inbox (Wave 4) and the zone hub widgets (Wave 5) —
 * per Q6 there is a single client query, not a per-surface bespoke fetch.
 *
 * Responsibilities:
 *   1. Fetch alerts with the configured `zone` / `limit` / `readState`
 *      filters as query-string parameters.
 *   2. Refetch every 120s while the tab is focused; stop when backgrounded.
 *   3. Expose `markAsRead(alertId)` and `dismiss(alertId)` mutations that
 *      POST to the Wave 3 mutation endpoints and invalidate the query so
 *      the next tick renders fresh read-state.
 */

import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// ---------------------------------------------------------------------------
// Public types — a client-side copy of the server `AlertItem` /
// `AlertReadStateEntry` contracts from `server/alerts/types.ts`. Kept as a
// deliberate duplicate so the client bundle never imports from server/
// (avoid pulling drizzle + pg types into the browser).
// ---------------------------------------------------------------------------

export type AlertZone =
  | "home"
  | "financials"
  | "operations"
  | "governance"
  | "communications"
  | "platform";

export type AlertSeverity = "low" | "medium" | "high" | "critical";

export type AlertRuleType =
  | "overdue-work-order"
  | "due-maintenance"
  | "active-election"
  | "delinquent-ledger-balance"
  | "expiring-governance-document";

export interface AlertItem {
  alertId: string;
  associationId: string;
  associationName: string;
  zone: AlertZone;
  featureDomain: string;
  ruleType: AlertRuleType;
  recordType: string;
  recordId: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  /** Server serializes Date as ISO string. */
  createdAt: string;
  resolutionHref: string;
  sourceRecord: unknown;
}

export interface AlertReadStateEntry {
  readAt: string | null;
  dismissedAt: string | null;
}

export interface CrossAssociationAlertsPayload {
  alerts: AlertItem[];
  readStateBy: Record<string, AlertReadStateEntry>;
}

export type ReadStateFilter = "unread" | "all";

export interface UseCrossAssociationAlertsOptions {
  zone?: AlertZone;
  /** Server default is 50; Home panel passes 10 per spec. */
  limit?: number;
  /** Server default is `unread`. */
  readState?: ReadStateFilter;
  /** Enable the query. Defaults to `true`. */
  enabled?: boolean;
}

export interface UseCrossAssociationAlertsResult {
  alerts: AlertItem[];
  readStateBy: Record<string, AlertReadStateEntry>;
  isLoading: boolean;
  error: Error | null;
  markAsRead: (alertId: string) => Promise<void>;
  dismiss: (alertId: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Polling cadence — 4.1 Q8 resolution fixed this at 120s for Home + inbox.
// Exposed as a const (not a default parameter) so tests can assert the exact
// value without reading it from the hook's options.
// ---------------------------------------------------------------------------

export const CROSS_ASSOCIATION_POLL_INTERVAL_MS = 120_000;

function buildQueryUrl(opts: {
  zone?: AlertZone;
  limit: number;
  readState: ReadStateFilter;
}): string {
  const params = new URLSearchParams();
  if (opts.zone) params.set("zone", opts.zone);
  params.set("limit", String(opts.limit));
  params.set("readState", opts.readState);
  return `/api/alerts/cross-association?${params.toString()}`;
}

export function useCrossAssociationAlerts(
  options: UseCrossAssociationAlertsOptions = {},
): UseCrossAssociationAlertsResult {
  const { zone, limit = 50, readState = "unread", enabled = true } = options;
  const queryClient = useQueryClient();

  // Canonical query key — the shape `["alerts", "cross-association", {...}]`
  // keeps the Home panel / hub widget / inbox invocations in separate cache
  // entries (they pass different filters), while still letting us invalidate
  // the whole family with `["alerts", "cross-association"]`.
  const queryKey = ["alerts", "cross-association", { zone, limit, readState }] as const;

  const query = useQuery<CrossAssociationAlertsPayload>({
    queryKey,
    queryFn: async () => {
      const url = buildQueryUrl({ zone, limit, readState });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`${res.status}: ${text}`);
      }
      return (await res.json()) as CrossAssociationAlertsPayload;
    },
    refetchInterval: CROSS_ASSOCIATION_POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    enabled,
  });

  const markReadMutation = useMutation({
    mutationFn: async (alertId: string) => {
      await apiRequest("POST", `/api/alerts/${encodeURIComponent(alertId)}/read`, {});
    },
    onSuccess: () => {
      // Invalidate the whole `alerts/cross-association` family — any surface
      // (Home, hub widget, inbox) will refetch with fresh read-state.
      void queryClient.invalidateQueries({ queryKey: ["alerts", "cross-association"] });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (alertId: string) => {
      await apiRequest("POST", `/api/alerts/${encodeURIComponent(alertId)}/dismiss`, {});
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["alerts", "cross-association"] });
    },
  });

  const markAsRead = useCallback(
    async (alertId: string) => {
      await markReadMutation.mutateAsync(alertId);
    },
    [markReadMutation],
  );

  const dismiss = useCallback(
    async (alertId: string) => {
      await dismissMutation.mutateAsync(alertId);
    },
    [dismissMutation],
  );

  return {
    alerts: query.data?.alerts ?? [],
    readStateBy: query.data?.readStateBy ?? {},
    isLoading: query.isLoading,
    error: (query.error as Error | null) ?? null,
    markAsRead,
    dismiss,
  };
}
