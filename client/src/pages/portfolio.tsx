// zone: Home
// persona: Manager, PM Assistant, Platform Admin
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Download,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

type PortfolioActivityEvent = {
  type: "work_order" | "financial" | "document";
  title: string;
  description: string;
  associationId: string;
  associationName: string;
  timestamp: string;
  icon: string;
};

function activityColor(type: PortfolioActivityEvent["type"], title: string) {
  if (type === "work_order") return title.includes("closed") ? "bg-green-500" : "bg-blue-500";
  if (type === "financial") return title.includes("Payment") ? "bg-green-500" : "bg-amber-500";
  if (type === "document") return "bg-blue-500";
  return "bg-slate-400";
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSeconds = Math.floor((now - then) / 1000);
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

// ── Types ────────────────────────────────────────────────────────────────────

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

type ThresholdAlert = {
  id: string;
  associationId: string;
  associationName: string;
  alertType: string;
  severity: "critical" | "warning" | "info";
  message: string;
  value: number;
  threshold: number;
};

type PortfolioRiskAlert = {
  associationId: string;
  associationName: string;
  type: string;
  severity: "critical" | "warning" | "info";
  description: string;
};

type PortfolioFinancialSummary = {
  totalAssociations: number;
  totalOperatingFunds: number;
  totalReserveFunds: number;
  delinquencyRate: number;
  portfolioYield: number;
  totalDelinquentAccounts: number;
  totalOwnerAccounts: number;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function downloadCsv(rows: string[][], filename: string) {
  const csv = rows
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function healthLabel(health: AssociationKPI["health"]) {
  if (health === "good") return "Stable";
  if (health === "warning") return "Attention";
  return "Critical";
}

function alertTypeLabel(type: string) {
  if (type === "urgent_work_orders") return "Urgent Work Orders";
  if (type === "overdue_work_orders") return "Overdue Work Orders";
  if (type === "overdue_compliance") return "Overdue Compliance";
  if (type === "delinquency") return "High Delinquency";
  if (type === "delinquency_spike") return "Delinquency Spike";
  if (type === "expired_insurance") return "Expired Insurance";
  if (type === "expiring_insurance") return "Insurance Expiring Soon";
  return type.replace(/_/g, " ");
}

function alertIcon(type: string) {
  if (type === "urgent_work_orders" || type === "overdue_work_orders") return "build";
  if (type === "overdue_compliance") return "gavel";
  if (type === "delinquency" || type === "delinquency_spike") return "account_balance_wallet";
  if (type.includes("insurance")) return "shield";
  return "warning";
}

// ── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ health }: { health: AssociationKPI["health"] }) {
  if (health === "good")
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800">
        Stable
      </span>
    );
  if (health === "warning")
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-secondary-container text-on-secondary-container">
        Attention
      </span>
    );
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-tertiary-fixed text-on-tertiary-fixed-variant">
      Critical
    </span>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function PortfolioPage() {
  useDocumentTitle("Portfolio Health");
  const { data: summaries = [], isLoading } = useQuery<AssociationKPI[]>({
    queryKey: ["/api/portfolio/summary"],
    staleTime: 5 * 60 * 1000,
  });

  const { data: thresholdAlerts = [] } = useQuery<ThresholdAlert[]>({
    queryKey: ["/api/portfolio/threshold-alerts"],
    staleTime: 5 * 60 * 1000,
  });

  const { data: recentActivity = [] } = useQuery<PortfolioActivityEvent[]>({
    queryKey: ["/api/admin/portfolio/recent-activity"],
    staleTime: 2 * 60 * 1000,
  });

  const { data: portfolioSummary } = useQuery<PortfolioFinancialSummary>({
    queryKey: ["/api/admin/portfolio/summary"],
    staleTime: 5 * 60 * 1000,
  });

  const { data: portfolioRiskAlerts = [] } = useQuery<PortfolioRiskAlert[]>({
    queryKey: ["/api/admin/portfolio/alerts"],
    staleTime: 5 * 60 * 1000,
  });

  const mergedAlerts = useMemo<ThresholdAlert[]>(() => {
    const normalized: ThresholdAlert[] = portfolioRiskAlerts.map((a, idx) => ({
      id: `portfolio-${a.associationId}-${a.type}-${idx}`,
      associationId: a.associationId,
      associationName: a.associationName,
      alertType: a.type,
      severity: a.severity,
      message: a.description,
      value: 0,
      threshold: 0,
    }));
    return [...thresholdAlerts, ...normalized];
  }, [thresholdAlerts, portfolioRiskAlerts]);

  const [filter, setFilter] = useState<"all" | "critical" | "warning" | "good">("all");

  const totals = useMemo(
    () =>
      summaries.reduce(
        (acc, s) => ({
          openWorkOrders: acc.openWorkOrders + s.openWorkOrders,
          urgentWorkOrders: acc.urgentWorkOrders + s.urgentWorkOrders,
          overdueCompliance: acc.overdueCompliance + s.overdueCompliance,
          delinquentAccounts: acc.delinquentAccounts + s.delinquentAccounts,
        }),
        { openWorkOrders: 0, urgentWorkOrders: 0, overdueCompliance: 0, delinquentAccounts: 0 }
      ),
    [summaries]
  );

  const criticalCount = summaries.filter((s) => s.health === "critical").length;
  const warningCount = summaries.filter((s) => s.health === "warning").length;
  const delinquencyRate =
    summaries.length > 0
      ? ((totals.delinquentAccounts / summaries.reduce((a, s) => a + s.openWorkOrders + 1, 0)) * 100).toFixed(1)
      : "0.0";

  const filteredSummaries = useMemo(() => {
    const sorted = [...summaries].sort((a, b) => {
      const order = { critical: 0, warning: 1, good: 2 };
      return order[a.health] - order[b.health];
    });
    return filter === "all" ? sorted : sorted.filter((s) => s.health === filter);
  }, [summaries, filter]);

  function exportCsv() {
    const header = [
      "Association",
      "City",
      "State",
      "Health",
      "Open Work Orders",
      "Urgent WOs",
      "Overdue Compliance",
      "Delinquent Accounts",
      "Expired Insurance",
    ];
    const rows: string[][] = [
      header,
      ...summaries.map((s) => [
        s.associationName,
        s.city ?? "",
        s.state ?? "",
        healthLabel(s.health),
        String(s.openWorkOrders),
        String(s.urgentWorkOrders),
        String(s.overdueCompliance),
        String(s.delinquentAccounts),
        String(s.expiredInsurance + s.expiredVendorInsurance),
      ]),
    ];
    downloadCsv(rows, `portfolio-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  return (
    <div className="bg-surface-container-low dark:bg-slate-800/50 min-h-full">
      {/* ── Hero Header ─────────────────────────────────────────────────── */}
      <section className="px-8 pt-10 pb-6 bg-surface-container-lowest dark:bg-slate-900 border-b border-outline-variant/20 dark:border-slate-700/30">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 max-w-screen-2xl">
          <div>
            <p className="text-xs font-label uppercase tracking-widest text-on-surface-variant dark:text-slate-400 mb-2">Overview</p>
            <h1 className="font-headline text-4xl font-bold tracking-tight text-on-surface dark:text-slate-100 leading-tight">
              Portfolio at a Glance
            </h1>
            <p className="text-on-surface-variant dark:text-slate-400 font-body mt-1.5 text-sm">
              Global performance overview across{" "}
              <span className="font-semibold text-on-surface dark:text-slate-100">{summaries.length}</span> managed associations.
            </p>
          </div>
          {summaries.length > 0 && (
            <div className="flex gap-2 shrink-0">
              <button
                className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-bold font-body hover:bg-primary/90 transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                Period: Q1 2026
                <span className="material-symbols-outlined text-[16px]">expand_more</span>
              </button>
              <button
                onClick={exportCsv}
                className="px-4 py-2 bg-surface-container text-on-surface rounded-lg text-sm font-medium font-body hover:bg-surface-container-high transition-colors flex items-center gap-1.5 border border-outline-variant/40"
              >
                <Download className="h-3.5 w-3.5" />
                Export Report
              </button>
            </div>
          )}
        </div>

        {/* KPI Bento Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8 max-w-screen-2xl">
          {/* Open Work Orders */}
          <div className="bg-surface-container-lowest dark:bg-slate-900 p-5 rounded-xl editorial-shadow border-b-2 border-primary/10">
            <span className="text-[10px] font-label uppercase tracking-widest text-on-surface-variant dark:text-slate-400 block mb-2">
              Open Work Orders
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-headline text-3xl font-bold text-primary">{totals.openWorkOrders}</span>
              {totals.urgentWorkOrders > 0 && (
                <span className="text-destructive text-xs font-bold flex items-center gap-0.5">
                  <span className="material-symbols-outlined text-[12px]">arrow_upward</span>
                  {totals.urgentWorkOrders} urgent
                </span>
              )}
            </div>
            <p className="text-[11px] text-outline dark:text-slate-500 mt-3">Across all managed associations</p>
          </div>

          {/* Delinquent Accounts */}
          <div className="bg-surface-container-lowest dark:bg-slate-900 p-5 rounded-xl editorial-shadow border-b-2 border-secondary/10">
            <span className="text-[10px] font-label uppercase tracking-widest text-on-surface-variant dark:text-slate-400 block mb-2">
              Delinquent Accounts
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-headline text-3xl font-bold text-on-surface dark:text-slate-100">{totals.delinquentAccounts}</span>
            </div>
            <p className="text-[11px] text-outline dark:text-slate-500 mt-3">Owners with outstanding balance</p>
          </div>

          {/* Overdue Compliance */}
          <div
            className={`bg-surface-container-lowest dark:bg-slate-900 p-5 rounded-xl editorial-shadow border-b-2 ${totals.overdueCompliance > 0 ? "border-destructive/20" : "border-outline-variant/20"}`}
          >
            <span className="text-[10px] font-label uppercase tracking-widest text-on-surface-variant dark:text-slate-400 block mb-2">
              Overdue Compliance
            </span>
            <div className="flex items-baseline gap-2">
              <span
                className={`font-headline text-3xl font-bold ${totals.overdueCompliance > 0 ? "text-destructive" : "text-on-surface"}`}
              >
                {totals.overdueCompliance}
              </span>
              {totals.overdueCompliance > 0 && (
                <span className="text-destructive text-xs font-bold flex items-center gap-0.5">
                  <span className="material-symbols-outlined text-[12px]">arrow_upward</span>
                  Needs attention
                </span>
              )}
            </div>
            <p className="text-[11px] text-outline dark:text-slate-500 mt-3">Governance tasks past due</p>
          </div>

          {/* Association Health — gradient card */}
          <div className="bg-primary bg-gradient-to-br from-primary to-primary-container p-5 rounded-xl editorial-shadow text-on-primary relative overflow-hidden">
            <div className="relative z-10">
              <span className="text-[10px] font-label uppercase tracking-widest text-on-primary-container block mb-2">
                Association Health
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-headline text-3xl font-bold">
                  {summaries.length > 0
                    ? `${Math.round(((summaries.length - criticalCount - warningCount) / summaries.length) * 100)}%`
                    : "—"}
                </span>
              </div>
              <p className="text-[11px] text-on-primary-container mt-3">
                {criticalCount > 0
                  ? `${criticalCount} critical · ${warningCount} attention`
                  : warningCount > 0
                  ? `${warningCount} need attention`
                  : "All associations stable"}
              </p>
            </div>
            <span className="material-symbols-outlined absolute -bottom-4 -right-4 text-[80px] opacity-10 rotate-12">
              trending_up
            </span>
          </div>
        </div>

        {/* ── Portfolio Financial Health (from /api/admin/portfolio/summary) ── */}
        {portfolioSummary && portfolioSummary.totalOwnerAccounts > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 max-w-screen-2xl" data-testid="section-portfolio-financial-health">
            <div className={`bg-surface-container-lowest dark:bg-slate-900 p-5 rounded-xl editorial-shadow border-b-2 ${portfolioSummary.delinquencyRate > 10 ? "border-destructive/30" : portfolioSummary.delinquencyRate > 5 ? "border-tertiary/30" : "border-secondary/10"}`}>
              <span className="text-[10px] font-label uppercase tracking-widest text-on-surface-variant dark:text-slate-400 block mb-2">
                Portfolio Delinquency Rate
              </span>
              <div className="flex items-baseline gap-2">
                <span className={`font-headline text-3xl font-bold ${portfolioSummary.delinquencyRate > 10 ? "text-destructive" : "text-on-surface dark:text-slate-100"}`}>
                  {portfolioSummary.delinquencyRate.toFixed(1)}%
                </span>
                {portfolioSummary.delinquencyRate > 10 && (
                  <span className="text-destructive text-xs font-bold flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-[12px]">arrow_upward</span>
                    Above threshold
                  </span>
                )}
              </div>
              <p className="text-[11px] text-outline dark:text-slate-500 mt-3">
                {portfolioSummary.totalDelinquentAccounts} of {portfolioSummary.totalOwnerAccounts} owner accounts
              </p>
            </div>

            <div className="bg-surface-container-lowest dark:bg-slate-900 p-5 rounded-xl editorial-shadow border-b-2 border-primary/10">
              <span className="text-[10px] font-label uppercase tracking-widest text-on-surface-variant dark:text-slate-400 block mb-2">
                Owner Accounts
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-headline text-3xl font-bold text-on-surface dark:text-slate-100">
                  {portfolioSummary.totalOwnerAccounts.toLocaleString()}
                </span>
              </div>
              <p className="text-[11px] text-outline dark:text-slate-500 mt-3">
                Active across {portfolioSummary.totalAssociations} association{portfolioSummary.totalAssociations === 1 ? "" : "s"}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* ── Main 2-col layout ───────────────────────────────────────────────── */}
      <div className="px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-screen-2xl">
        {/* ── Portfolio Distribution ──────────────────────────────────── */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-headline text-2xl font-semibold text-on-surface dark:text-slate-100">Portfolio Distribution</h2>
            <div className="flex flex-wrap gap-2 items-center bg-surface-container-low dark:bg-slate-800/50 p-1 rounded-lg border border-outline-variant/30">
              {(["all", "critical", "warning", "good"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
                    filter === f
                      ? "bg-white dark:bg-slate-800 shadow-sm text-on-surface"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  {f === "all" ? "All" : f === "critical" ? "Critical" : f === "warning" ? "Attention" : "Stable"}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-surface-container-lowest dark:bg-slate-900 rounded-xl editorial-shadow overflow-hidden">
            {isLoading ? (
              <div className="p-12 text-center text-sm text-on-surface-variant dark:text-slate-400">Loading portfolio data…</div>
            ) : filteredSummaries.length === 0 ? (
              <div className="p-12 text-center text-sm text-on-surface-variant dark:text-slate-400">No associations found.</div>
            ) : (
              <table className="w-full text-left border-collapse">
                <caption className="sr-only">Portfolio distribution by association</caption>
                <thead>
                  <tr className="bg-surface-container-low dark:bg-slate-800 border-b border-outline-variant/20 dark:border-slate-700/30">
                    <th scope="col" className="px-6 py-3.5 text-[10px] uppercase tracking-widest font-label font-bold text-on-surface-variant dark:text-slate-400">
                      Association
                    </th>
                    <th scope="col" className="px-6 py-3.5 text-[10px] uppercase tracking-widest font-label font-bold text-on-surface-variant dark:text-slate-400">
                      Health
                    </th>
                    <th scope="col" className="px-6 py-3.5 text-[10px] uppercase tracking-widest font-label font-bold text-on-surface-variant dark:text-slate-400">
                      Open WOs
                    </th>
                    <th scope="col" className="px-6 py-3.5 text-[10px] uppercase tracking-widest font-label font-bold text-on-surface-variant dark:text-slate-400">
                      Delinquent
                    </th>
                    <th scope="col" className="px-6 py-3.5 text-[10px] uppercase tracking-widest font-label font-bold text-on-surface-variant dark:text-slate-400">
                      Compliance
                    </th>
                    <th scope="col" className="px-6 py-3.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10 dark:divide-slate-800">
                  {filteredSummaries.map((s) => (
                    <tr key={s.associationId} className="hover:bg-surface-container-low dark:hover:bg-slate-800/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-surface-container-high dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                            <span className="material-symbols-outlined text-on-surface-variant dark:text-slate-400 text-[18px]">domain</span>
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-on-surface dark:text-slate-100 leading-tight">{s.associationName}</p>
                            {(s.city || s.state) && (
                              <p className="text-xs text-outline dark:text-slate-500 mt-0.5">{[s.city, s.state].filter(Boolean).join(", ")}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge health={s.health} />
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`text-sm font-mono font-medium ${s.urgentWorkOrders > 0 ? "text-destructive" : "text-on-surface"}`}
                        >
                          {s.openWorkOrders}
                          {s.urgentWorkOrders > 0 && (
                            <span className="ml-1 text-[10px] text-destructive">({s.urgentWorkOrders} urgent)</span>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`text-sm font-mono font-medium ${s.delinquentAccounts > 0 ? "text-on-surface" : "text-outline"}`}
                        >
                          {s.delinquentAccounts}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`text-sm font-mono font-medium ${s.overdueCompliance > 0 ? "text-destructive" : "text-outline"}`}
                        >
                          {s.overdueCompliance}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link href="/app/associations">
                          <button
                            aria-label={`View ${s.associationName} details`}
                            className="text-outline hover:text-primary transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded"
                          >
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!isLoading && summaries.length > 0 && (
              <div className="bg-surface-container-low dark:bg-slate-800/50 px-6 py-3 border-t border-outline-variant/10 dark:border-slate-700/30">
                <Link href="/app/associations">
                  <button className="text-primary font-bold text-xs flex items-center gap-1.5 hover:underline">
                    View all {summaries.length} associations
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* ── Right Sidebar ───────────────────────────────────────────── */}
        <div className="lg:col-span-4 space-y-6">
          {/* Critical Alerts */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-headline text-xl font-semibold text-on-surface dark:text-slate-100">Critical Alerts</h3>
              {mergedAlerts.length > 0 && (
                <span className="bg-destructive text-destructive-foreground text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter">
                  {mergedAlerts.filter((a) => a.severity === "critical").length} active
                </span>
              )}
            </div>
            {mergedAlerts.length === 0 ? (
              <div className="p-4 bg-surface-container-lowest dark:bg-slate-900 rounded-xl editorial-shadow border border-outline-variant/20 dark:border-slate-700/30">
                <div className="flex items-center gap-2 text-sm text-on-surface-variant dark:text-slate-400">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  No active alerts — all thresholds within range.
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {mergedAlerts.slice(0, 5).map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-r-lg border-l-4 ${
                      alert.severity === "critical"
                        ? "bg-destructive-container/25 border-destructive"
                        : "bg-tertiary-fixed/20 border-tertiary"
                    }`}
                  >
                    <div className="flex gap-3">
                      <span
                        className={`material-symbols-outlined text-[18px] shrink-0 mt-0.5 ${
                          alert.severity === "critical" ? "text-destructive" : "text-tertiary"
                        }`}
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        {alertIcon(alert.alertType)}
                      </span>
                      <div>
                        <p
                          className={`text-xs font-bold ${
                            alert.severity === "critical" ? "text-destructive-foreground-container" : "text-on-tertiary-fixed-variant"
                          }`}
                        >
                          {alertTypeLabel(alert.alertType)}
                        </p>
                        <p
                          className={`text-xs mt-0.5 ${
                            alert.severity === "critical"
                              ? "text-destructive-foreground-container/80"
                              : "text-on-tertiary-fixed-variant/80"
                          }`}
                        >
                          {alert.associationName} — {alert.message}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                {mergedAlerts.length > 5 && (
                  <p className="text-xs text-on-surface-variant text-center pt-1">
                    + {mergedAlerts.length - 5} more alerts
                  </p>
                )}
              </div>
            )}
          </section>

          {/* Benchmarking snapshot */}
          {summaries.length > 1 && (
            <section className="space-y-3">
              <h3 className="font-headline text-xl font-semibold text-on-surface dark:text-slate-100">Open Work Orders</h3>
              <div className="bg-surface-container-lowest dark:bg-slate-900 rounded-xl editorial-shadow p-5">
                <p className="text-[10px] text-on-surface-variant dark:text-slate-400 uppercase tracking-widest mb-3">
                  by association — lower is better
                </p>
                <div className="space-y-2.5">
                  {[...summaries]
                    .sort((a, b) => b.openWorkOrders - a.openWorkOrders)
                    .slice(0, 6)
                    .map((s) => {
                      const max = Math.max(...summaries.map((x) => x.openWorkOrders), 1);
                      const pct = (s.openWorkOrders / max) * 100;
                      return (
                        <div key={s.associationId} className="flex items-center gap-3">
                          <div className="w-24 shrink-0 text-xs truncate text-on-surface-variant dark:text-slate-400">{s.associationName}</div>
                          <div className="flex-1 bg-surface-container dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                s.health === "critical"
                                  ? "bg-destructive"
                                  : s.health === "warning"
                                  ? "bg-tertiary"
                                  : "bg-primary/60"
                              }`}
                              style={{ width: `${pct}%`, minWidth: s.openWorkOrders > 0 ? "4px" : "0" }}
                            />
                          </div>
                          <div className="w-6 shrink-0 text-right text-xs font-bold text-on-surface dark:text-slate-100">
                            {s.openWorkOrders}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </section>
          )}

          {/* Quick links */}
          <section className="space-y-3">
            <h3 className="font-headline text-xl font-semibold text-on-surface dark:text-slate-100">Quick Actions</h3>
            <div className="grid grid-cols-1 gap-2">
              {[
                { icon: "domain", label: "All Associations", href: "/app/associations", sub: "Browse full directory" },
                { icon: "build", label: "Work Orders", href: "/app/work-orders", sub: "Open & urgent items" },
                { icon: "gavel", label: "Governance", href: "/app/board", sub: "Meetings & compliance" },
                { icon: "payments", label: "Financials", href: "/app/financial/foundation", sub: "Fees, ledger & budgets" },
              ].map((item) => (
                <Link key={item.href} href={item.href}>
                  <div className="group flex items-center gap-3 p-3 bg-surface-container-lowest dark:bg-slate-900 rounded-xl editorial-shadow hover:bg-primary cursor-pointer transition-all duration-200">
                    <span className="material-symbols-outlined text-primary group-hover:text-on-primary text-[22px] transition-colors">
                      {item.icon}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-on-surface dark:text-slate-100 group-hover:text-on-primary transition-colors leading-tight">
                        {item.label}
                      </p>
                      <p className="text-xs text-on-surface-variant dark:text-slate-400 group-hover:text-on-primary/80 transition-colors">
                        {item.sub}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* Recent Activity Timeline */}
          <section className="space-y-3" data-testid="section-portfolio-activity">
            <h3 className="font-headline text-xl font-semibold text-on-surface dark:text-slate-100">Recent Activity</h3>
            <div className="bg-surface-container-lowest dark:bg-slate-900 rounded-xl p-6 editorial-shadow">
              {recentActivity.length === 0 ? (
                <p className="text-xs text-on-surface-variant dark:text-slate-400 text-center py-4 font-body">
                  No recent activity across your portfolio.
                </p>
              ) : (
                <div className="relative space-y-4">
                  {recentActivity.slice(0, 8).map((activity, idx) => {
                    const color = activityColor(activity.type, activity.title);
                    const isLast = idx >= Math.min(recentActivity.length, 8) - 1;
                    return (
                      <div key={`${activity.timestamp}-${activity.associationId}-${idx}`} className="relative flex gap-3 pl-4">
                        {!isLast && (
                          <div className="absolute left-[7px] top-3 bottom-0 w-px bg-outline-variant/30" />
                        )}
                        <div className={`relative z-10 mt-1.5 h-3 w-3 rounded-full ${color} ring-2 ring-surface-container-lowest dark:ring-slate-900 shrink-0 -ml-4`} />
                        <div className="min-w-0 pb-1">
                          <p className="label-caps text-outline dark:text-slate-500 mb-0.5">{formatRelativeTime(activity.timestamp)}</p>
                          <p className="text-xs text-on-surface-variant dark:text-slate-400 leading-relaxed font-body">
                            {activity.title}: {activity.description} at{" "}
                            <strong className="font-bold text-on-surface dark:text-slate-100">{activity.associationName}</strong>
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Floating Action Button */}
      <button
        className="fixed bottom-8 right-8 w-14 h-14 bg-primary text-on-primary rounded-full shadow-2xl z-50 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
        aria-label="New property"
      >
        <span className="material-symbols-outlined text-[24px]">add</span>
      </button>
    </div>
  );
}
