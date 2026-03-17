import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import {
  Building2,
  ClipboardList,
  BadgeDollarSign,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ArrowRight,
  TrendingUp,
  Award,
  Download,
} from "lucide-react";

function downloadCsv(rows: string[][], filename: string) {
  const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type AssociationKPI = {
  associationId: string;
  associationName: string;
  city: string | null;
  state: string | null;
  openWorkOrders: number;
  urgentWorkOrders: number;
  overdueCompliance: number;
  delinquentAccounts: number;
  expiredInsurance: number;
  expiredVendorInsurance: number;
  health: "good" | "warning" | "critical";
};

function HealthBadge({ health }: { health: AssociationKPI["health"] }) {
  if (health === "good") {
    return (
      <Badge variant="secondary" className="gap-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
        <CheckCircle2 className="h-3 w-3" />
        Healthy
      </Badge>
    );
  }
  if (health === "warning") {
    return (
      <Badge variant="outline" className="gap-1 border-orange-300 text-orange-700 dark:text-orange-400">
        <AlertTriangle className="h-3 w-3" />
        Attention
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className="gap-1">
      <AlertCircle className="h-3 w-3" />
      Critical
    </Badge>
  );
}

function KpiChip({
  count,
  label,
  icon: Icon,
  alertClass,
}: {
  count: number;
  label: string;
  icon: typeof ClipboardList;
  alertClass?: string;
}) {
  if (count === 0) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${alertClass ?? "text-muted-foreground"}`}>
      <Icon className="h-3 w-3" />
      {count} {label}
    </span>
  );
}

export default function PortfolioPage() {
  const { data: summaries = [], isLoading } = useQuery<AssociationKPI[]>({
    queryKey: ["/api/portfolio/summary"],
  });

  const [benchmarkMetric, setBenchmarkMetric] = useState<"openWorkOrders" | "delinquentAccounts" | "overdueCompliance">("openWorkOrders");

  type ThresholdAlert = { id: string; associationId: string; associationName: string; alertType: string; severity: "critical" | "warning" | "info"; message: string; value: number; threshold: number };
  const { data: thresholdAlerts = [] } = useQuery<ThresholdAlert[]>({
    queryKey: ["/api/portfolio/threshold-alerts"],
  });

  // Rankings: sort by metric ascending (lower = better)
  const ranked = useMemo(() => {
    return summaries
      .map((s) => ({ ...s, metricValue: s[benchmarkMetric] }))
      .sort((a, b) => a.metricValue - b.metricValue);
  }, [summaries, benchmarkMetric]);

  const maxValue = useMemo(() => Math.max(...ranked.map((r) => r.metricValue), 1), [ranked]);

  const totals = summaries.reduce(
    (acc, s) => ({
      openWorkOrders: acc.openWorkOrders + s.openWorkOrders,
      urgentWorkOrders: acc.urgentWorkOrders + s.urgentWorkOrders,
      overdueCompliance: acc.overdueCompliance + s.overdueCompliance,
      delinquentAccounts: acc.delinquentAccounts + s.delinquentAccounts,
    }),
    { openWorkOrders: 0, urgentWorkOrders: 0, overdueCompliance: 0, delinquentAccounts: 0 }
  );

  const criticalCount = summaries.filter((s) => s.health === "critical").length;
  const warningCount = summaries.filter((s) => s.health === "warning").length;

  function exportPortfolioCsv() {
    const header = ["Association", "City", "State", "Health", "Open Work Orders", "Urgent WOs", "Overdue Compliance", "Delinquent Accounts", "Expired Insurance"];
    const rows: string[][] = [header, ...summaries.map((s) => [
      s.associationName, s.city ?? "", s.state ?? "", s.health,
      String(s.openWorkOrders), String(s.urgentWorkOrders), String(s.overdueCompliance),
      String(s.delinquentAccounts), String(s.expiredInsurance + s.expiredVendorInsurance),
    ])];
    downloadCsv(rows, `portfolio-performance-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  function exportAlertsCsv() {
    const header = ["Association", "Severity", "Alert Type", "Message", "Value", "Threshold"];
    const rows: string[][] = [header, ...thresholdAlerts.map((a) => [
      a.associationName, a.severity, a.alertType, a.message, String(a.value), String(a.threshold),
    ])];
    downloadCsv(rows, `portfolio-alerts-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <WorkspacePageHeader
          title="Portfolio Overview"
          summary="Health summary and key performance indicators across all managed associations."
          eyebrow="Overview"
          breadcrumbs={[{ label: "Dashboard", href: "/app" }, { label: "Portfolio" }]}
        />
        {summaries.length > 0 && (
          <div className="flex gap-2 shrink-0 pt-1">
            <Button size="sm" variant="outline" onClick={exportPortfolioCsv} className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> KPI Report
            </Button>
            {thresholdAlerts.length > 0 && (
              <Button size="sm" variant="outline" onClick={exportAlertsCsv} className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> Alerts Report
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Roll-up KPI bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Open Work Orders</div>
            <div className="mt-1 text-2xl font-bold">{totals.openWorkOrders}</div>
            {totals.urgentWorkOrders > 0 && (
              <div className="text-xs text-destructive mt-0.5">{totals.urgentWorkOrders} urgent</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Overdue Compliance</div>
            <div className={`mt-1 text-2xl font-bold ${totals.overdueCompliance > 0 ? "text-destructive" : ""}`}>
              {totals.overdueCompliance}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Delinquent Accounts</div>
            <div className={`mt-1 text-2xl font-bold ${totals.delinquentAccounts > 0 ? "text-orange-600" : ""}`}>
              {totals.delinquentAccounts}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Association Health</div>
            <div className="mt-1 flex items-center gap-2">
              {criticalCount > 0 && <span className="text-sm font-bold text-destructive">{criticalCount} critical</span>}
              {warningCount > 0 && <span className="text-sm font-bold text-orange-600">{warningCount} attention</span>}
              {criticalCount === 0 && warningCount === 0 && (
                <span className="text-sm font-bold text-green-700 dark:text-green-400">All healthy</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Portfolio Threshold Alerts */}
      {thresholdAlerts.length > 0 && (
        <Card className="border-orange-200 dark:border-orange-900/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Portfolio Threshold Alerts
              <Badge variant="destructive" className="ml-1">{thresholdAlerts.filter(a => a.severity === "critical").length} critical</Badge>
              {thresholdAlerts.filter(a => a.severity === "warning").length > 0 && (
                <Badge variant="outline" className="border-orange-300 text-orange-700">{thresholdAlerts.filter(a => a.severity === "warning").length} warning</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {thresholdAlerts.map((alert) => (
                <div key={alert.id} className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${alert.severity === "critical" ? "bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-300" : "bg-orange-50 dark:bg-orange-950/20 text-orange-800 dark:text-orange-300"}`}>
                  {alert.severity === "critical" ? <AlertCircle className="h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
                  <span className="font-medium shrink-0">{alert.associationName}</span>
                  <span className="text-xs opacity-80">—</span>
                  <span className="text-xs">{alert.message}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Benchmarking Charts & Rankings */}
      {summaries.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                Comparative Benchmarking
              </CardTitle>
              <div className="flex gap-1">
                {(["openWorkOrders", "delinquentAccounts", "overdueCompliance"] as const).map((m) => (
                  <Button key={m} size="sm" variant={benchmarkMetric === m ? "default" : "outline"} className="text-xs h-7 px-2" onClick={() => setBenchmarkMetric(m)}>
                    {m === "openWorkOrders" ? "Work Orders" : m === "delinquentAccounts" ? "Delinquent" : "Compliance"}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {ranked.map((r, i) => (
              <div key={r.associationId} className="flex items-center gap-3">
                <div className="w-5 shrink-0 text-right text-xs text-muted-foreground font-medium">
                  {i === 0 ? <Award className="h-3.5 w-3.5 text-yellow-500 inline" /> : `#${i + 1}`}
                </div>
                <div className="w-36 shrink-0 text-sm truncate">{r.associationName}</div>
                <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-3 rounded-full transition-all ${r.metricValue === 0 ? "bg-green-500" : i < ranked.length * 0.33 ? "bg-green-400" : i < ranked.length * 0.67 ? "bg-yellow-400" : "bg-red-400"}`}
                    style={{ width: `${(r.metricValue / maxValue) * 100}%`, minWidth: r.metricValue > 0 ? "4px" : "0" }}
                  />
                </div>
                <div className={`w-8 shrink-0 text-right text-sm font-semibold ${r.metricValue === 0 ? "text-green-600" : r.metricValue > maxValue * 0.5 ? "text-red-600" : "text-orange-600"}`}>
                  {r.metricValue}
                </div>
              </div>
            ))}
            <div className="text-xs text-muted-foreground pt-1">Lower is better. Rankings update with live portfolio data.</div>
          </CardContent>
        </Card>
      )}

      {/* Per-association cards */}
      {isLoading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Loading portfolio summary…</div>
      ) : summaries.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">No associations found.</div>
      ) : (
        <div className="space-y-3">
          {summaries
            .sort((a, b) => {
              const order = { critical: 0, warning: 1, good: 2 };
              return order[a.health] - order[b.health];
            })
            .map((s) => (
              <Card key={s.associationId} className={s.health === "critical" ? "border-destructive/50" : s.health === "warning" ? "border-orange-300" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="font-medium">{s.associationName}</div>
                        {(s.city || s.state) && (
                          <div className="text-xs text-muted-foreground">{[s.city, s.state].filter(Boolean).join(", ")}</div>
                        )}
                        <div className="mt-1.5 flex flex-wrap gap-3">
                          <KpiChip
                            count={s.urgentWorkOrders}
                            label="urgent WO"
                            icon={AlertCircle}
                            alertClass="text-destructive"
                          />
                          <KpiChip
                            count={s.openWorkOrders}
                            label="open WO"
                            icon={ClipboardList}
                          />
                          <KpiChip
                            count={s.overdueCompliance}
                            label="overdue compliance"
                            icon={AlertTriangle}
                            alertClass="text-destructive"
                          />
                          <KpiChip
                            count={s.delinquentAccounts}
                            label="delinquent"
                            icon={BadgeDollarSign}
                            alertClass="text-orange-600"
                          />
                          <KpiChip
                            count={s.expiredInsurance + s.expiredVendorInsurance}
                            label="expired insurance"
                            icon={ShieldAlert}
                            alertClass="text-destructive"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <HealthBadge health={s.health} />
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/app/associations`}>
                          View <ArrowRight className="h-3 w-3 ml-1" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
}
