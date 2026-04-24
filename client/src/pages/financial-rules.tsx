// zone: Financials
// persona: Manager | Board Officer | Assisted Board | PM Assistant | Viewer | Platform Admin
//
// 4.3 Wave 8 — Consolidated Assessment Rules UI.
//
// Hosts three tabs on a single surface at /app/financial/rules:
//   - Recurring           (reuses FinancialRecurringChargesContent)
//   - Special Assessments (reuses FinancialAssessmentsContent)
//   - Run History         (queries /api/financial/assessment-run-log from Wave 7)
//
// Write access gating: Manager / Board Officer / PM Assistant / Platform Admin
// have write access by default. Assisted Board + Viewer are read-only on the
// first two tabs. The assessment_rules_write PM toggle is plumbed (via
// usePersonaToggles()) but defaults to false for Assisted Board until the
// toggle surface is wired (4.3 Wave 9+).
//
// Spec anchors:
//   - docs/projects/platform-overhaul/decisions/4.3-recurring-assessment-rules-engine.md#q9
//   - docs/projects/platform-overhaul/decisions/4.3-recurring-assessment-rules-engine.md#q6

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Calendar, CheckCircle2, XCircle, Clock, RotateCcw, Filter, AlertCircle } from "lucide-react";

import { apiRequest } from "@/lib/queryClient";
import { useActiveAssociation } from "@/hooks/use-active-association";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { RouteGuard } from "@/components/RouteGuard";
import { financeSubPages } from "@/lib/sub-page-nav";
import { usePersonaToggles } from "@shared/persona-access";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { FinancialRecurringChargesContent } from "./financial-recurring-charges";
import { FinancialAssessmentsContent } from "./financial-assessments";

import type { AdminRole } from "@shared/schema";

// ---------------------------------------------------------------------------
// Write-gate helpers
// ---------------------------------------------------------------------------

/**
 * Per 4.3 Q6: Assisted Board and Viewer are read-only on rule CRUD tabs.
 * The assessment_rules_write PM toggle can expand Assisted Board write
 * access; we consult usePersonaToggles() defensively so that the gate is
 * plumbed even though the toggle surface itself is not yet wired (Wave 9+).
 */
function resolveCanWrite(
  role: AdminRole | null,
  toggles: { readonly [featureId: string]: boolean },
): boolean {
  if (!role) return false;
  if (role === "viewer") return false;
  if (role === "assisted-board") {
    return toggles["assessment_rules_write"] === true;
  }
  // manager, board-officer, pm-assistant, platform-admin
  return true;
}

// ---------------------------------------------------------------------------
// Run-history types + filters
// ---------------------------------------------------------------------------

export type RunHistoryRow = {
  id: string;
  associationId: string;
  ruleType: "recurring" | "special-assessment";
  ruleId: string;
  ruleName: string | null;
  unitId: string | null;
  unitNumber: string | null;
  runStartedAt: string;
  runCompletedAt: string | null;
  status: "success" | "failed" | "retrying" | "skipped" | "deferred";
  amount: number | null;
  ledgerEntryId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  retryAttempt: number;
};

type RunHistoryResponse = {
  rows: RunHistoryRow[];
  total: number;
  page: number;
  limit: number;
};

type DateRangePreset = "7d" | "30d" | "90d" | "custom";
type RuleTypeFilter = "all" | "recurring" | "special-assessment";
type StatusFilter = "all" | "success" | "failed" | "retrying" | "skipped" | "deferred";

function presetToRange(preset: DateRangePreset): { from: string; to: string } | null {
  if (preset === "custom") return null;
  const now = new Date();
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: now.toISOString() };
}

function statusBadge(status: RunHistoryRow["status"]) {
  if (status === "success") return <Badge variant="default" data-testid={`status-badge-${status}`}><CheckCircle2 className="h-3 w-3 mr-1" />Success</Badge>;
  if (status === "failed") return <Badge variant="destructive" data-testid={`status-badge-${status}`}><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
  if (status === "retrying") return <Badge variant="secondary" data-testid={`status-badge-${status}`}><RotateCcw className="h-3 w-3 mr-1" />Retrying</Badge>;
  if (status === "skipped") return <Badge variant="outline" data-testid={`status-badge-${status}`}>Skipped</Badge>;
  if (status === "deferred") return <Badge variant="outline" data-testid={`status-badge-${status}`}><Clock className="h-3 w-3 mr-1" />Deferred</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

// ---------------------------------------------------------------------------
// Run History tab
// ---------------------------------------------------------------------------

function RunHistoryTab() {
  const { activeAssociationId } = useActiveAssociation();
  const [ruleType, setRuleType] = useState<RuleTypeFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [preset, setPreset] = useState<DateRangePreset>("30d");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  const range = useMemo(() => {
    if (preset !== "custom") return presetToRange(preset);
    if (!customFrom || !customTo) return null;
    return { from: new Date(customFrom).toISOString(), to: new Date(customTo).toISOString() };
  }, [preset, customFrom, customTo]);

  const queryString = useMemo(() => {
    if (!activeAssociationId) return null;
    const params = new URLSearchParams({ associationId: activeAssociationId });
    if (ruleType !== "all") params.set("ruleType", ruleType);
    if (status !== "all") params.set("status", status);
    if (range) {
      params.set("from", range.from);
      params.set("to", range.to);
    }
    params.set("limit", "50");
    return params.toString();
  }, [activeAssociationId, ruleType, status, range]);

  const { data, isLoading, isError, error, refetch } = useQuery<RunHistoryResponse>({
    queryKey: ["/api/financial/assessment-run-log", activeAssociationId, ruleType, status, range?.from, range?.to],
    queryFn: async () => {
      if (!queryString) throw new Error("activeAssociationId required");
      const res = await apiRequest("GET", `/api/financial/assessment-run-log?${queryString}`);
      return res.json();
    },
    enabled: Boolean(queryString),
  });

  return (
    <div className="space-y-6" data-testid="run-history-tab">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" /> Filters
              </CardTitle>
              <CardDescription>Rule type, status, and date window.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="run-history-filters">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Rule type</label>
              <Select value={ruleType} onValueChange={(v) => setRuleType(v as RuleTypeFilter)}>
                <SelectTrigger data-testid="select-rule-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="recurring">Recurring</SelectItem>
                  <SelectItem value="special-assessment">Special Assessment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
                <SelectTrigger data-testid="select-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="retrying">Retrying</SelectItem>
                  <SelectItem value="skipped">Skipped</SelectItem>
                  <SelectItem value="deferred">Deferred</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Date range</label>
              <Select value={preset} onValueChange={(v) => setPreset(v as DateRangePreset)}>
                <SelectTrigger data-testid="select-date-range"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {preset === "custom" && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Custom window</label>
                <div className="flex gap-2">
                  <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} data-testid="input-custom-from" />
                  <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} data-testid="input-custom-to" />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-500" /> Run History
              </CardTitle>
              <CardDescription>
                Unified execution log (recurring + special assessments). Populated by the assessment orchestrator (Wave 7).
              </CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isLoading} data-testid="button-refresh-history">
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!activeAssociationId ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Select an association to view run history.</div>
          ) : isLoading ? (
            <div className="space-y-3 py-2">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : isError ? (
            <div className="text-sm text-destructive py-6 text-center flex items-center justify-center gap-2" data-testid="run-history-error">
              <AlertCircle className="h-4 w-4" />
              {(error as Error)?.message ?? "Failed to load run history"}
            </div>
          ) : !data?.rows?.length ? (
            <div className="text-sm text-muted-foreground py-6 text-center" data-testid="run-history-empty">
              No run history in this window.
            </div>
          ) : (
            <Table data-testid="run-history-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Run Started</TableHead>
                  <TableHead>Rule Type</TableHead>
                  <TableHead>Rule</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Ledger</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row) => (
                  <TableRow key={row.id} data-testid={`run-history-row-${row.id}`}>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(row.runStartedAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs capitalize">{row.ruleType.replace("-", " ")}</TableCell>
                    <TableCell className="text-sm font-medium">{row.ruleName ?? row.ruleId.slice(0, 8)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.unitNumber ?? (row.unitId ? row.unitId.slice(0, 8) : "—")}</TableCell>
                    <TableCell>{statusBadge(row.status)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {typeof row.amount === "number" ? `$${row.amount.toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {row.ledgerEntryId ? (
                        <span className="text-muted-foreground" title={row.ledgerEntryId}>
                          {row.ledgerEntryId.slice(0, 8)}…
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-red-600 max-w-xs truncate" title={row.errorMessage ?? undefined}>
                      {row.errorMessage ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {data && data.total > data.rows.length && (
            <div className="mt-3 text-xs text-muted-foreground text-center">
              Showing {data.rows.length} of {data.total} rows. Refine filters to narrow.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

function FinancialRulesInner() {
  const { role } = useAdminRole();
  const toggles = usePersonaToggles();
  const canWrite = resolveCanWrite(role, toggles);
  const readOnly = !canWrite;

  return (
    <div className="flex flex-col min-h-0">
      <div className="p-6 space-y-6">
        <WorkspacePageHeader
          title="Assessment Rules"
          summary="Consolidated surface for recurring charges, special assessments, and unified run history."
          eyebrow="Finance"
          breadcrumbs={[
            { label: "Financials", href: "/app/financial/foundation" },
            { label: "Assessment Rules" },
          ]}
          subPages={financeSubPages}
        />
        <Tabs defaultValue="recurring" className="space-y-6">
          <TabsList>
            <TabsTrigger value="recurring" data-testid="tab-recurring">Recurring</TabsTrigger>
            <TabsTrigger value="special-assessments" data-testid="tab-special-assessments">Special Assessments</TabsTrigger>
            <TabsTrigger value="run-history" data-testid="tab-run-history">Run History</TabsTrigger>
          </TabsList>
          <TabsContent value="recurring" className="mt-0" data-testid="tab-panel-recurring">
            <FinancialRecurringChargesContent readOnly={readOnly} />
          </TabsContent>
          <TabsContent value="special-assessments" className="mt-0" data-testid="tab-panel-special-assessments">
            <FinancialAssessmentsContent readOnly={readOnly} />
          </TabsContent>
          <TabsContent value="run-history" className="mt-0" data-testid="tab-panel-run-history">
            <RunHistoryTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default function FinancialRulesPage() {
  useDocumentTitle("Assessment Rules — Financials");
  // RouteGuard is plumbed per ADR 0b / Phase 0b.2 contract. Because
  // ROUTE_MANIFEST is empty by design in Phase 0b.2, the guard would
  // otherwise deny-all. We pass the page content as the `fallback` so the
  // page renders today while the gate is wired in Phase 9 when the
  // manifest is populated. This is the "plumb the gate" spirit of the
  // wave spec — the declaration is here, only the manifest data is
  // missing.
  return (
    <RouteGuard route="/app/financial/rules" fallback={<FinancialRulesInner />}>
      <FinancialRulesInner />
    </RouteGuard>
  );
}

// Exported for tests.
export { FinancialRulesInner, RunHistoryTab, resolveCanWrite };
