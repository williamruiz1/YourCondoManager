/**
 * PressingItemsWidget — top-of-dashboard widget (founder-os#1256, Phase 1).
 *
 * Lives at the top of both the owner portal home and the admin dashboard.
 * Renders the role-lensed list of board-attention items with severity
 * indicators, snooze action, and click-through to the related record.
 *
 * Data source: `/api/portal/pressing-items` (portal mode) or
 *              `/api/admin/pressing-items?associationId=…` (admin mode).
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface PressingItem {
  id: string;
  itemClass: "unidentified_txn" | "delinquency_rising" | "document_attention" | "compliance_deadline";
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string | null;
  actorRole: string;
  relatedRecordType: string | null;
  relatedRecordId: string | null;
  snoozedUntil: string | null;
  createdAt: string;
}

interface Props {
  surface: "portal" | "admin";
  associationId?: string;
  /** Optional callback when an item is clicked through to its record. */
  onItemClick?: (item: PressingItem) => void;
}

const SEVERITY_LABEL: Record<PressingItem["severity"], string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const SEVERITY_VARIANT: Record<PressingItem["severity"], "destructive" | "default" | "secondary"> = {
  critical: "destructive",
  high: "destructive",
  medium: "default",
  low: "secondary",
};

const CLASS_LABEL: Record<PressingItem["itemClass"], string> = {
  unidentified_txn: "Unidentified transaction",
  delinquency_rising: "Delinquency",
  document_attention: "Document attention",
  compliance_deadline: "Compliance deadline",
};

function snoozeUrl(surface: "portal" | "admin", id: string): string {
  return surface === "portal"
    ? `/api/portal/pressing-items/${id}/snooze`
    : `/api/admin/pressing-items/${id}/snooze`;
}

function listUrl(surface: "portal" | "admin", associationId?: string): string {
  return surface === "portal"
    ? "/api/portal/pressing-items"
    : `/api/admin/pressing-items${associationId ? `?associationId=${encodeURIComponent(associationId)}` : ""}`;
}

/**
 * The owner portal authenticates via the `x-portal-access-id` header (stored in
 * localStorage by the portal shell), NOT cookies — so a portal-surface fetch
 * MUST attach it or `requirePortal` 403s ("Portal access required"). This was the
 * cause of the owner-portal-home "Failed to load pressing items (403)" bug.
 */
function portalAuthHeaders(surface: "portal" | "admin"): Record<string, string> {
  if (surface !== "portal" || typeof window === "undefined") return {};
  const id = window.localStorage.getItem("portalAccessId");
  return id ? { "x-portal-access-id": id } : {};
}

export function PressingItemsWidget({ surface, associationId, onItemClick }: Props) {
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<{ items: PressingItem[] }>({
    queryKey: ["pressing-items", surface, associationId ?? null],
    queryFn: async () => {
      const res = await fetch(listUrl(surface, associationId), {
        credentials: "include",
        headers: portalAuthHeaders(surface),
      });
      if (!res.ok) throw new Error(`Failed to load pressing items (${res.status})`);
      return res.json();
    },
  });

  const snoozeMutation = useMutation({
    mutationFn: async (args: { id: string; until: string }) => {
      const res = await fetch(snoozeUrl(surface, args.id), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...portalAuthHeaders(surface) },
        credentials: "include",
        body: JSON.stringify({ until: args.until }),
      });
      if (!res.ok) throw new Error(`Snooze failed (${res.status})`);
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pressing-items", surface, associationId ?? null] });
    },
    onSettled: () => setBusyId(null),
  });

  const handleSnooze = (id: string, days: number) => {
    setBusyId(id);
    const until = new Date();
    until.setDate(until.getDate() + days);
    snoozeMutation.mutate({ id, until: until.toISOString() });
  };

  const items = data?.items ?? [];

  return (
    <Card data-testid="pressing-items-widget">
      <CardContent className="space-y-3 py-5">
        <div className="flex items-center justify-between">
          <h2 className="font-headline text-lg">Pressing items</h2>
          <span className="text-xs text-on-surface-variant" data-testid="pressing-items-count">
            {items.length} {items.length === 1 ? "item" : "items"}
          </span>
        </div>

        {isLoading ? (
          <p className="text-sm text-on-surface-variant" role="status">Loading…</p>
        ) : error ? (
          <p className="text-sm text-destructive" role="alert" data-testid="pressing-items-error">
            {error instanceof Error ? error.message : "Failed to load"}
          </p>
        ) : items.length === 0 ? (
          <p className="text-sm text-on-surface-variant" role="status" data-testid="pressing-items-empty">
            Nothing urgent today. Check back later.
          </p>
        ) : (
          <ul className="space-y-2" data-testid="pressing-items-list">
            {items.slice(0, 5).map((item) => (
              <li
                key={item.id}
                className="flex items-start gap-3 rounded-lg border border-border p-3 hover:bg-muted/40"
                data-testid={`pressing-item-${item.id}`}
              >
                <Badge variant={SEVERITY_VARIANT[item.severity]} className="shrink-0">
                  {SEVERITY_LABEL[item.severity]}
                </Badge>
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    className="block text-left font-medium hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    onClick={() => onItemClick?.(item)}
                    data-testid={`pressing-item-${item.id}-title`}
                  >
                    {item.title}
                  </button>
                  <p className="text-xs text-on-surface-variant">
                    {CLASS_LABEL[item.itemClass]}
                    {item.description ? ` · ${item.description}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busyId === item.id}
                    onClick={() => handleSnooze(item.id, 1)}
                    aria-label="Snooze 1 day"
                    data-testid={`pressing-item-${item.id}-snooze-1d`}
                  >
                    1d
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busyId === item.id}
                    onClick={() => handleSnooze(item.id, 7)}
                    aria-label="Snooze 7 days"
                    data-testid={`pressing-item-${item.id}-snooze-7d`}
                  >
                    7d
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {items.length > 5 ? (
          <p className="text-xs text-on-surface-variant">
            +{items.length - 5} more after the top 5
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
