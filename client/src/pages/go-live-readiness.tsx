// zone: Platform
// persona: Platform Admin
//
// /admin/go-live-readiness — Cherry Hill (and future-HOA) go-live readiness
// dashboard. Renders the 7-tier checklist with per-gate auto-check status,
// per-tier traffic lights, and per-gate "Mark verified" attestation buttons.
//
// Plain-English summary (per OP #19):
//   This page answers "are we ready to ring the bell?" for whatever HOA
//   is currently in scope. Three colors: RED (some HARD gate failing),
//   AMBER (only SOFT gates failing), GREEN (all HARD pass). Each gate row
//   shows what the auto-check found, what dispatch owns it, and a [Mark
//   verified] button for the gates that require a human attestation.
//
// Server endpoints consumed:
//   GET  /api/admin/go-live-readiness/:association_id   — snapshot
//   POST /api/admin/go-live-readiness/:association_id/attest  — mark verified
//
// Source-of-truth for gate inventory + the canonical checklist:
//   founder-os/wiki/products/ycm/cherry-hill-go-live-checklist-v1.md
//
// Cross-link: founder-os#1340 (this build) / #1276 (spec parent) / #1307
// (cross-product launch-readiness template — this implementation is the
// n=1 reference for that template extraction).

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, ChevronDown, ChevronRight, CheckCircle2, AlertCircle, Circle, Building2 } from "lucide-react";
import { useAssociationContext } from "@/context/association-context";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { EmptyState } from "@/components/empty-state";

// =========================================================================
// Wire-shape — matches what computeReadinessSnapshot() returns from the
// server (server/services/go-live-checks.ts).
// =========================================================================

type GateStatus = "pass" | "fail" | "pending";
type TierLight = "HARD" | "SOFT" | "NONBLOCKING";
type Light = "GREEN" | "AMBER" | "RED";

interface GateSnapshot {
  id: string;
  tier: "A" | "B" | "C" | "D" | "E" | "F" | "G";
  name: string;
  hardSoft: TierLight;
  verifyMethod: "auto" | "manual";
  owningDispatch: string;
  result: {
    status: GateStatus;
    evidence: string;
    last_checked: string;
  };
  attestation?: {
    attested_by_email: string;
    attested_at: string;
    notes?: string;
  };
  overall_status: GateStatus;
}

interface TierSnapshot {
  tier: GateSnapshot["tier"];
  name: string;
  hardSoft: TierLight;
  light: Light;
  gates: GateSnapshot[];
}

interface ReadinessSnapshot {
  association_id: string;
  computed_at: string;
  tiers: TierSnapshot[];
  top_light: Light;
  hard_gates_total: number;
  hard_gates_passing: number;
}

interface SnapshotResponse {
  snapshot: ReadinessSnapshot;
  cached: boolean;
}

// =========================================================================
// Visuals — light → color + icon mapping. Keep accessible (aria-label).
// =========================================================================

function LightDot({ light, size = "sm" }: { light: Light; size?: "sm" | "lg" }) {
  const cls = size === "lg" ? "h-4 w-4" : "h-3 w-3";
  const color = light === "GREEN" ? "bg-emerald-500" : light === "AMBER" ? "bg-amber-500" : "bg-red-500";
  const label = light === "GREEN" ? "All clear" : light === "AMBER" ? "Soft blocker" : "Hard blocker";
  return <span className={`inline-block rounded-full ${cls} ${color}`} aria-label={label} role="img" />;
}

function GateStatusIcon({ status }: { status: GateStatus }) {
  if (status === "pass") return <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label="Pass" />;
  if (status === "fail") return <AlertCircle className="h-4 w-4 text-red-600" aria-label="Fail" />;
  return <Circle className="h-4 w-4 text-amber-500" aria-label="Pending" />;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

const TIER_HARDSOFT_LABEL: Record<TierLight, string> = {
  HARD: "🔴 HARD blocker",
  SOFT: "🟡 SOFT (degraded, ships without)",
  NONBLOCKING: "⚪ Not a blocker",
};

// =========================================================================
// Page component
// =========================================================================

export default function GoLiveReadinessPage() {
  useDocumentTitle("Go-live readiness");
  const { associations, activeAssociationId, associationResolved } = useAssociationContext();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [expandedTiers, setExpandedTiers] = useState<Set<string>>(new Set(["A", "B", "E"]));

  const association = associations.find((a) => a.id === activeAssociationId);

  const snapshotQuery = useQuery<SnapshotResponse>({
    queryKey: ["/api/admin/go-live-readiness", activeAssociationId],
    enabled: associationResolved && Boolean(activeAssociationId),
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/admin/go-live-readiness/${encodeURIComponent(activeAssociationId)}?refresh=1`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error(`refresh failed (HTTP ${res.status})`);
      return (await res.json()) as SnapshotResponse;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/admin/go-live-readiness", activeAssociationId], data);
      toast({ title: "Refreshed", description: "Auto-checks re-ran successfully." });
    },
    onError: (err: Error) => {
      toast({ title: "Refresh failed", description: err.message, variant: "destructive" });
    },
  });

  const attestMutation = useMutation({
    mutationFn: async ({ gateId, notes }: { gateId: string; notes?: string }) => {
      const res = await apiRequest("POST", `/api/admin/go-live-readiness/${encodeURIComponent(activeAssociationId)}/attest`, {
        gateId,
        notes,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/go-live-readiness", activeAssociationId] });
      toast({ title: "Marked verified", description: "Attestation recorded." });
    },
    onError: (err: Error) => {
      toast({ title: "Attestation failed", description: err.message, variant: "destructive" });
    },
  });

  function toggleTier(tier: string) {
    setExpandedTiers((prev) => {
      const next = new Set(prev);
      if (next.has(tier)) next.delete(tier);
      else next.add(tier);
      return next;
    });
  }

  if (!associationResolved) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Skeleton className="h-8 w-72 mb-4" />
        <Skeleton className="h-24 w-full mb-4" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!activeAssociationId) {
    return (
      <div className="container mx-auto px-4 py-6">
        <EmptyState
          icon={Building2}
          title="No active association"
          description="Select an association from the workspace switcher to view its go-live readiness."
        />
      </div>
    );
  }

  const snapshot = snapshotQuery.data?.snapshot;
  const cached = snapshotQuery.data?.cached;

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <WorkspacePageHeader
        title="Go-live readiness"
        summary={`Are we ready to ring the bell for ${association?.name ?? "this association"}?`}
      />

      {/* Top-line status card */}
      {snapshotQuery.isLoading && (
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-6 w-48 mb-4" />
            <Skeleton className="h-4 w-72" />
          </CardContent>
        </Card>
      )}

      {snapshotQuery.isError && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              <span>Failed to load readiness snapshot</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {(snapshotQuery.error as Error)?.message ?? "Unknown error"}
            </p>
          </CardContent>
        </Card>
      )}

      {snapshot && (
        <>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <LightDot light={snapshot.top_light} size="lg" />
                    <h2 className="text-2xl font-semibold" data-testid="top-line-status">
                      {snapshot.top_light === "GREEN"
                        ? "Ready to ring the bell"
                        : snapshot.top_light === "AMBER"
                          ? "Soft blockers — shippable"
                          : "Hard blockers remaining"}
                    </h2>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {snapshot.hard_gates_passing} / {snapshot.hard_gates_total} hard gates passing
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Last computed {formatDate(snapshot.computed_at)}
                    {cached ? " · cached" : " · fresh"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refreshMutation.mutate()}
                  disabled={refreshMutation.isPending}
                  data-testid="refresh-button"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
                  Refresh checks
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Per-tier sections */}
          {snapshot.tiers.map((tier) => {
            const expanded = expandedTiers.has(tier.tier);
            const passing = tier.gates.filter((g) => g.overall_status === "pass").length;
            return (
              <Card key={tier.tier}>
                <CardContent className="p-0">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors text-left"
                    onClick={() => toggleTier(tier.tier)}
                    aria-expanded={expanded}
                    data-testid={`tier-toggle-${tier.tier}`}
                  >
                    <div className="flex items-center gap-3">
                      {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <LightDot light={tier.light} />
                      <span className="font-medium">
                        Tier {tier.tier} — {tier.name}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {TIER_HARDSOFT_LABEL[tier.hardSoft]}
                      </Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {passing} / {tier.gates.length} passing
                    </span>
                  </button>

                  {expanded && (
                    <div className="border-t">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/30">
                          <tr>
                            <th className="text-left px-6 py-2 font-medium">Status</th>
                            <th className="text-left px-6 py-2 font-medium">Gate</th>
                            <th className="text-left px-6 py-2 font-medium">Evidence</th>
                            <th className="text-left px-6 py-2 font-medium">Owner</th>
                            <th className="text-left px-6 py-2 font-medium">Verify</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tier.gates.map((gate) => (
                            <tr key={gate.id} className="border-t" data-testid={`gate-row-${gate.id}`}>
                              <td className="px-6 py-3 align-top">
                                <GateStatusIcon status={gate.overall_status} />
                              </td>
                              <td className="px-6 py-3 align-top">
                                <div className="font-medium">
                                  {gate.id} — {gate.name}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {gate.verifyMethod === "auto" ? "🤖 auto" : "👤 manual"}
                                </div>
                              </td>
                              <td className="px-6 py-3 align-top text-xs text-muted-foreground max-w-md">
                                <div>{gate.result.evidence}</div>
                                {gate.attestation && (
                                  <div className="mt-1 text-emerald-700">
                                    ✓ Verified by {gate.attestation.attested_by_email} on {formatDate(gate.attestation.attested_at)}
                                    {gate.attestation.notes && <span> — {gate.attestation.notes}</span>}
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-3 align-top text-xs text-muted-foreground">
                                {gate.owningDispatch}
                              </td>
                              <td className="px-6 py-3 align-top">
                                {gate.overall_status !== "pass" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      const notes = window.prompt(`Notes for verifying ${gate.id} (optional):`) || undefined;
                                      attestMutation.mutate({ gateId: gate.id, notes });
                                    }}
                                    disabled={attestMutation.isPending}
                                    data-testid={`attest-button-${gate.id}`}
                                  >
                                    Mark verified
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">
                Canonical checklist: <code>wiki/products/ycm/cherry-hill-go-live-checklist-v1.md</code> (founder-os).
                Build dispatch: <code>founder-os#1340</code> · Spec parent: <code>founder-os#1276</code> ·
                Cross-product template: <code>founder-os#1307</code> (this implementation is the n=1 reference).
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
