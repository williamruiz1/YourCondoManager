import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Budget, BudgetLine, BudgetVersion, OwnerLedgerEntry } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useActiveAssociation } from "@/hooks/use-active-association";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { AlertTriangle, Download, Info, Printer } from "lucide-react";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { financeSubPages } from "@/lib/sub-page-nav";
import { useIsMobile } from "@/hooks/use-mobile";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FinancialReconciliationContent } from "./financial-reconciliation";
import { MobileTabBar } from "@/components/mobile-tab-bar";

type LedgerSummaryRow = {
  personId: string;
  unitId: string;
  balance: number;
};

type BudgetVarianceRow = {
  lineItemName: string;
  plannedAmount: number;
  actualAmount: number;
  variance: number;
};

type ReportType = "pl" | "collection" | "ar-aging" | "reserve" | "board";

const REPORT_DESCRIPTIONS: Record<ReportType, { label: string; description: string }> = {
  pl: { label: "P&L", description: "Profit & Loss — summarizes income received versus charges billed and adjustments posted over the selected period." },
  collection: { label: "Collections", description: "Collection Rate — shows how much of the total billed amount has been collected and what remains outstanding." },
  "ar-aging": { label: "AR Aging", description: "Accounts Receivable Aging — lists owner accounts with outstanding balances sorted by how much they owe." },
  reserve: { label: "Reserve", description: "Reserve Fund — shows budget line items designated for reserves and estimates the current reserve fund balance." },
  board: { label: "Board Report", description: "Board Financial Summary — a combined report covering net position, collection rate, delinquency, and reserve fund, suitable for board meetings." },
};

const PERIODS = [
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "Last 6 months", days: 180 },
  { label: "Last 12 months", days: 365 },
  { label: "All time", days: 0 },
];

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

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

export function FinancialReportsContent() {
  const isMobile = useIsMobile();
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();
  const [report, setReport] = useState<ReportType>("pl");
  const [periodDays, setPeriodDays] = useState(90);

  const ledgerQuery = useQuery<OwnerLedgerEntry[]>({
    queryKey: ["/api/financial/owner-ledger/entries", activeAssociationId || "none", periodDays],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeAssociationId) params.set("associationId", activeAssociationId);
      if (periodDays > 0) params.set("days", String(periodDays));
      const res = await apiRequest("GET", `/api/financial/owner-ledger/entries?${params}`);
      return res.json();
    },
    enabled: Boolean(activeAssociationId),
  });

  const summaryQuery = useQuery<LedgerSummaryRow[]>({
    queryKey: ["/api/financial/owner-ledger/summary", activeAssociationId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/financial/owner-ledger/summary/${activeAssociationId}`);
      return res.json();
    },
    enabled: Boolean(activeAssociationId),
  });

  const budgetsQuery = useQuery<Budget[]>({
    queryKey: ["/api/financial/budgets", activeAssociationId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/financial/budgets?associationId=${activeAssociationId}`);
      return res.json();
    },
    enabled: Boolean(activeAssociationId),
  });

  // Get budget lines for the first ratified budget version
  const latestBudget = (budgetsQuery.data ?? [])[0];
  const budgetVersionsQuery = useQuery<BudgetVersion[]>({
    queryKey: ["/api/financial/budgets/versions", latestBudget?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/financial/budgets/${latestBudget?.id}/versions`);
      return res.json();
    },
    enabled: Boolean(latestBudget?.id),
  });
  const latestVersion = (budgetVersionsQuery.data ?? []).find((v) => v.status === "ratified") ?? (budgetVersionsQuery.data ?? [])[0];
  const budgetLinesQuery = useQuery<BudgetLine[]>({
    queryKey: ["/api/financial/budget-versions/lines", latestVersion?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/financial/budget-versions/${latestVersion?.id}/lines`);
      return res.json();
    },
    enabled: Boolean(latestVersion?.id),
  });

  // P&L derived from ledger entries
  const plData = useMemo(() => {
    const entries = ledgerQuery.data ?? [];
    const cutoff = periodDays > 0 ? new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000) : null;
    const filtered = cutoff ? entries.filter((e) => new Date(e.postedAt) >= cutoff) : entries;

    const income = filtered.filter((e) => e.entryType === "payment" || e.entryType === "credit");
    const charges = filtered.filter((e) => e.entryType === "charge" || e.entryType === "assessment" || e.entryType === "late-fee");
    const adjustments = filtered.filter((e) => e.entryType === "adjustment");

    const totalIncome = income.reduce((sum, e) => sum + e.amount, 0);
    const totalCharges = charges.reduce((sum, e) => sum + e.amount, 0);
    const totalAdjustments = adjustments.reduce((sum, e) => sum + e.amount, 0);
    const netPosition = totalIncome - totalCharges + totalAdjustments;

    // Group by entry type
    const byType: Record<string, number> = {};
    filtered.forEach((e) => {
      byType[e.entryType] = (byType[e.entryType] ?? 0) + e.amount;
    });

    return { totalIncome, totalCharges, totalAdjustments, netPosition, byType, filtered };
  }, [ledgerQuery.data, periodDays]);

  // Collection rate
  const collectionData = useMemo(() => {
    const entries = ledgerQuery.data ?? [];
    const cutoff = periodDays > 0 ? new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000) : null;
    const filtered = cutoff ? entries.filter((e) => new Date(e.postedAt) >= cutoff) : entries;

    const billed = filtered
      .filter((e) => e.entryType === "charge" || e.entryType === "assessment")
      .reduce((sum, e) => sum + e.amount, 0);

    const collected = filtered
      .filter((e) => e.entryType === "payment")
      .reduce((sum, e) => sum + e.amount, 0);

    const rate = billed > 0 ? Math.min(100, (collected / billed) * 100) : 100;
    const outstanding = Math.max(0, billed - collected);

    return { billed, collected, outstanding, rate };
  }, [ledgerQuery.data, periodDays]);

  // AR aging from balance summary
  const agingData = useMemo(() => {
    const rows = summaryQuery.data ?? [];
    const delinquent = rows.filter((r) => r.balance < 0);
    const current = rows.filter((r) => r.balance >= 0);
    const totalDelinquent = delinquent.reduce((sum, r) => sum + Math.abs(r.balance), 0);
    const totalBalance = rows.reduce((sum, r) => sum + r.balance, 0);
    return { delinquent, current, totalDelinquent, totalBalance, rows };
  }, [summaryQuery.data]);

  // Reserve fund analysis from budget lines
  const reserveData = useMemo(() => {
    const lines = budgetLinesQuery.data ?? [];
    const reserveLines = lines.filter((l) => l.lineItemName.toLowerCase().includes("reserve"));
    const totalReservePlanned = reserveLines.reduce((sum, l) => sum + l.plannedAmount, 0);
    const allLines = lines;
    const totalBudgeted = allLines.reduce((sum, l) => sum + l.plannedAmount, 0);

    // Compute actual payments collected for reserve period
    const entries = ledgerQuery.data ?? [];
    const payments = entries.filter((e) => e.entryType === "payment" || e.entryType === "credit");
    const totalCollected = Math.abs(payments.reduce((sum, e) => sum + e.amount, 0));
    const reservePercent = totalBudgeted > 0 ? Math.round((totalReservePlanned / totalBudgeted) * 100) : 0;
    const estimatedReserveBalance = totalCollected * (reservePercent / 100);

    const budgetComparison: BudgetVarianceRow[] = lines.map((l) => ({
      lineItemName: l.lineItemName,
      plannedAmount: l.plannedAmount,
      actualAmount: 0, // Would need expense tracking to populate
      variance: -l.plannedAmount,
    }));

    return { reserveLines, totalReservePlanned, totalBudgeted, reservePercent, estimatedReserveBalance, budgetComparison };
  }, [budgetLinesQuery.data, ledgerQuery.data]);

  const reportsLoading = ledgerQuery.isLoading
    || summaryQuery.isLoading
    || budgetsQuery.isLoading
    || budgetVersionsQuery.isLoading
    || budgetLinesQuery.isLoading;
  const reportItems = ([
    "pl",
    "collection",
    "ar-aging",
    "reserve",
    "board",
  ] as ReportType[]).map((r) => ({
    id: r,
    label: REPORT_DESCRIPTIONS[r].label,
  }));

  function exportPlCsv() {
    const rows: string[][] = [
      ["Type", "Amount"],
      ...Object.entries(plData.byType).map(([type, amount]) => [type, String(amount.toFixed(2))]),
      ["NET POSITION", String(plData.netPosition.toFixed(2))],
    ];
    downloadCsv(rows, `pl-report-${activeAssociationName || "assoc"}.csv`);
  }

  function exportCollectionCsv() {
    const rows: string[][] = [
      ["Metric", "Value"],
      ["Billed", collectionData.billed.toFixed(2)],
      ["Collected", collectionData.collected.toFixed(2)],
      ["Outstanding", collectionData.outstanding.toFixed(2)],
      ["Collection Rate", `${collectionData.rate.toFixed(1)}%`],
    ];
    downloadCsv(rows, `collection-report-${activeAssociationName || "assoc"}.csv`);
  }

  function exportAgingCsv() {
    const rows: string[][] = [
      ["Unit ID", "Person ID", "Balance"],
      ...agingData.rows.map((r) => [r.unitId, r.personId, String(r.balance.toFixed(2))]),
    ];
    downloadCsv(rows, `ar-aging-${activeAssociationName || "assoc"}.csv`);
  }

  function exportReserveCsv() {
    const rows: string[][] = [
      ["Reserve Fund Analysis"],
      ["Association", activeAssociationName || ""],
      ["Report Date", new Date().toLocaleDateString()],
      [],
      ["Reserve Line Items", "Planned Amount"],
      ...reserveData.reserveLines.map((l) => [l.lineItemName, l.plannedAmount.toFixed(2)]),
      [],
      ["Summary"],
      ["Total Reserve Planned", reserveData.totalReservePlanned.toFixed(2)],
      ["Total Budget", reserveData.totalBudgeted.toFixed(2)],
      ["Reserve % of Budget", `${reserveData.reservePercent}%`],
      ["Estimated Reserve Balance", reserveData.estimatedReserveBalance.toFixed(2)],
    ];
    downloadCsv(rows, `reserve-report-${activeAssociationName || "assoc"}.csv`);
  }

  function exportBoardReportCsv() {
    const date = new Date().toLocaleDateString();
    const rows: string[][] = [
      [`Board Financial Report - ${activeAssociationName || "Association"}`],
      [`Generated: ${date}`],
      [],
      ["=== INCOME & EXPENSE SUMMARY ==="],
      ["Metric", "Amount"],
      ["Total Income (Payments Received)", plData.totalIncome.toFixed(2)],
      ["Total Charges Billed", plData.totalCharges.toFixed(2)],
      ["Total Adjustments", plData.totalAdjustments.toFixed(2)],
      ["Net Position", plData.netPosition.toFixed(2)],
      [],
      ["=== COLLECTION SUMMARY ==="],
      ["Metric", "Amount"],
      ["Total Billed", collectionData.billed.toFixed(2)],
      ["Total Collected", collectionData.collected.toFixed(2)],
      ["Outstanding", collectionData.outstanding.toFixed(2)],
      ["Collection Rate", `${collectionData.rate.toFixed(1)}%`],
      [],
      ["=== AR AGING ==="],
      ["Unit ID", "Person ID", "Balance"],
      ...agingData.delinquent.map((r) => [r.unitId, r.personId, `(${Math.abs(r.balance).toFixed(2)})`]),
      ["TOTAL DELINQUENT", "", agingData.totalDelinquent.toFixed(2)],
      [],
      ["=== RESERVE FUND ==="],
      ["Total Reserve Planned", reserveData.totalReservePlanned.toFixed(2)],
      ["Reserve % of Budget", `${reserveData.reservePercent}%`],
      ["Estimated Reserve Balance", reserveData.estimatedReserveBalance.toFixed(2)],
    ];
    downloadCsv(rows, `board-report-${activeAssociationName || "assoc"}-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  return (
    <div className="space-y-6">
      <style>{`@media print { .no-print { display: none; } }`}</style>

      {/* Controls */}
      <div className="space-y-3">
        {isMobile ? (
          <MobileTabBar
            items={reportItems}
            value={report}
            onChange={(value) => setReport(value)}
            variant="tabular"
          />
        ) : (
          <TooltipProvider>
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex rounded-md border overflow-hidden">
                {(["pl", "collection", "ar-aging", "reserve", "board"] as ReportType[]).map((r) => {
                  const def = REPORT_DESCRIPTIONS[r];
                  return (
                    <Tooltip key={r}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setReport(r)}
                          className={cn(
                            "flex items-center gap-1 px-3 py-1.5 text-sm font-medium transition-colors",
                            report === r ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                          )}
                        >
                          {def.label}
                          <Info className="h-3 w-3 opacity-60" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs text-xs">
                        {def.description}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>

              <Select value={String(periodDays)} onValueChange={(v) => setPeriodDays(Number(v))}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERIODS.map((p) => (
                    <SelectItem key={p.days} value={String(p.days)}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                className="gap-1 ml-auto"
                onClick={report === "pl" ? exportPlCsv : report === "collection" ? exportCollectionCsv : report === "reserve" ? exportReserveCsv : report === "board" ? exportBoardReportCsv : exportAgingCsv}
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
              <Button variant="outline" size="sm" className="gap-1" onClick={() => window.print()}>
                <Printer className="h-4 w-4" />
                Print
              </Button>
            </div>
          </TooltipProvider>
        )}
        {isMobile ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={String(periodDays)} onValueChange={(v) => setPeriodDays(Number(v))}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERIODS.map((p) => (
                  <SelectItem key={p.days} value={String(p.days)}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="grid grid-cols-2 gap-2 sm:ml-auto">
              <Button
                variant="outline"
                size="sm"
                className="gap-1 min-h-11 w-full"
                onClick={report === "pl" ? exportPlCsv : report === "collection" ? exportCollectionCsv : report === "reserve" ? exportReserveCsv : report === "board" ? exportBoardReportCsv : exportAgingCsv}
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
              <Button variant="outline" size="sm" className="gap-1 min-h-11 w-full" onClick={() => window.print()}>
                <Printer className="h-4 w-4" />
                Print
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {periodDays === 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            <strong>All time</strong> includes every ledger entry since the association was created. For large associations this may be slow and the results may be too broad for useful analysis. Consider selecting a specific period instead.
          </span>
        </div>
      )}

      {reportsLoading ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Card key={index}>
                <CardContent className="space-y-3 pt-6">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-32" />
                  <Skeleton className="h-3 w-40" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardContent className="space-y-3 p-6">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        </div>
      ) : (
      <>
      {/* P&L Report */}
      {report === "pl" && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total Income</p>
                <p className="text-2xl font-bold text-green-700">{formatCurrency(plData.totalIncome)}</p>
                <p className="text-xs text-muted-foreground mt-1">Payments &amp; credits received</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total Billed</p>
                <p className="text-2xl font-bold">{formatCurrency(plData.totalCharges)}</p>
                <p className="text-xs text-muted-foreground mt-1">Charges, assessments &amp; late fees</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Adjustments</p>
                <p className="text-2xl font-bold">{formatCurrency(plData.totalAdjustments)}</p>
                <p className="text-xs text-muted-foreground mt-1">Credit adjustments posted</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Net Position</p>
                <p className={cn("text-2xl font-bold", plData.netPosition >= 0 ? "text-green-700" : "text-red-600")}>
                  {formatCurrency(plData.netPosition)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Income minus charges</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Breakdown by Entry Type</CardTitle></CardHeader>
            <CardContent className={isMobile ? "pt-4" : "p-0"}>
              {isMobile ? (
                <div className="space-y-3">
                  {Object.entries(plData.byType).map(([type, amount]) => (
                    <div key={type} className="rounded-lg border p-4 flex items-start justify-between gap-3">
                      <div>
                        <div className="capitalize font-medium">{type.replace(/-/g, " ")}</div>
                        <div className="mt-2">
                          <Badge variant={type === "payment" || type === "credit" ? "default" : "secondary"}>
                            {type === "payment" || type === "credit" ? "Income" : type === "adjustment" ? "Adjustment" : "Billed"}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-sm font-semibold">{formatCurrency(amount)}</div>
                    </div>
                  ))}
                  {Object.keys(plData.byType).length === 0 && (
                    <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">No ledger entries found for the selected period.</div>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Entry Type</TableHead>
                      <TableHead className="text-right">Total Amount</TableHead>
                      <TableHead>Classification</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(plData.byType).map(([type, amount]) => (
                      <TableRow key={type}>
                        <TableCell className="capitalize font-medium">{type.replace(/-/g, " ")}</TableCell>
                        <TableCell className="text-right">{formatCurrency(amount)}</TableCell>
                        <TableCell>
                          <Badge variant={type === "payment" || type === "credit" ? "default" : "secondary"}>
                            {type === "payment" || type === "credit" ? "Income" : type === "adjustment" ? "Adjustment" : "Billed"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {Object.keys(plData.byType).length === 0 && (
                      <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No ledger entries found for the selected period.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Collections Report */}
      {report === "collection" && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total Billed</p>
                <p className="text-2xl font-bold">{formatCurrency(collectionData.billed)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total Collected</p>
                <p className="text-2xl font-bold text-green-700">{formatCurrency(collectionData.collected)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Outstanding</p>
                <p className={cn("text-2xl font-bold", collectionData.outstanding > 0 ? "text-red-600" : "text-green-700")}>
                  {formatCurrency(collectionData.outstanding)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Collection Rate</p>
                <p className={cn("text-2xl font-bold", collectionData.rate >= 90 ? "text-green-700" : collectionData.rate >= 70 ? "text-yellow-600" : "text-red-600")}>
                  {collectionData.rate.toFixed(1)}%
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Visual bar */}
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm font-medium mb-2">Collection Rate</p>
              <div className="h-4 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", collectionData.rate >= 90 ? "bg-green-500" : collectionData.rate >= 70 ? "bg-yellow-500" : "bg-red-500")}
                  style={{ width: `${Math.min(100, collectionData.rate)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>0%</span>
                <span className="font-medium">{collectionData.rate.toFixed(1)}%</span>
                <span>100%</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* AR Aging */}
      {report === "ar-aging" && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total Accounts</p>
                <p className="text-2xl font-bold">{agingData.rows.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Delinquent Accounts</p>
                <p className={cn("text-2xl font-bold", agingData.delinquent.length > 0 ? "text-red-600" : "text-green-700")}>
                  {agingData.delinquent.length}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total Delinquent Amount</p>
                <p className={cn("text-2xl font-bold", agingData.totalDelinquent > 0 ? "text-red-600" : "text-green-700")}>
                  {formatCurrency(agingData.totalDelinquent)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Account Balances</CardTitle></CardHeader>
            <CardContent className={isMobile ? "pt-4" : "p-0"}>
              {isMobile ? (
                <div className="space-y-3">
                  {agingData.rows
                    .slice()
                    .sort((a, b) => a.balance - b.balance)
                    .map((row) => (
                      <div key={`${row.unitId}-${row.personId}`} className="rounded-lg border p-4 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium">{row.unitId.slice(0, 8)}</div>
                            <div className="text-xs text-muted-foreground">Person {row.personId.slice(0, 8)}</div>
                          </div>
                          <Badge variant={row.balance < 0 ? "destructive" : "default"}>
                            {row.balance < 0 ? "Past Due" : "Current"}
                          </Badge>
                        </div>
                        <div className={cn("text-sm font-semibold", row.balance < 0 ? "text-red-600" : "text-green-700")}>
                          {formatCurrency(row.balance)}
                        </div>
                      </div>
                    ))}
                  {agingData.rows.length === 0 && (
                    <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">No balance data available.</div>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Unit</TableHead>
                      <TableHead>Person</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agingData.rows
                      .slice()
                      .sort((a, b) => a.balance - b.balance)
                      .map((row) => (
                        <TableRow key={`${row.unitId}-${row.personId}`}>
                          <TableCell className="font-medium">{row.unitId.slice(0, 8)}</TableCell>
                          <TableCell>{row.personId.slice(0, 8)}</TableCell>
                          <TableCell className={cn("text-right font-medium", row.balance < 0 ? "text-red-600" : "text-green-700")}>
                            {formatCurrency(row.balance)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={row.balance < 0 ? "destructive" : "default"}>
                              {row.balance < 0 ? "Past Due" : "Current"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    {agingData.rows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          No balance data available.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Reserve Fund Report */}
      {report === "reserve" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" className="gap-2" onClick={exportReserveCsv}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Reserve Planned</p>
                <p className="text-2xl font-bold">{formatCurrency(reserveData.totalReservePlanned)}</p>
                <p className="text-xs text-muted-foreground mt-1">From budget lines</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Reserve % of Budget</p>
                <p className={cn("text-2xl font-bold", reserveData.reservePercent >= 15 ? "text-green-700" : "text-amber-600")}>
                  {reserveData.reservePercent}%
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Est. Reserve Balance</p>
                <p className="text-2xl font-bold text-blue-700">{formatCurrency(reserveData.estimatedReserveBalance)}</p>
                <p className="text-xs text-muted-foreground mt-1">Based on collections × reserve %</p>
              </CardContent>
            </Card>
          </div>
          {reserveData.reserveLines.length > 0 ? (
            <Card>
              <CardHeader><CardTitle className="text-base">Reserve Line Items</CardTitle></CardHeader>
              <CardContent className={isMobile ? "pt-4" : "p-0"}>
                {isMobile ? (
                  <div className="space-y-3">
                    {reserveData.reserveLines.map((l) => (
                      <div key={l.id} className="rounded-lg border p-4 flex items-start justify-between gap-3">
                        <div className="font-medium">{l.lineItemName}</div>
                        <div className="text-sm font-semibold">{formatCurrency(l.plannedAmount)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Line Item</TableHead>
                        <TableHead className="text-right">Planned Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reserveData.reserveLines.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell>{l.lineItemName}</TableCell>
                          <TableCell className="text-right">{formatCurrency(l.plannedAmount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No reserve budget lines found. Add budget lines with "reserve" in the name under Finance Setup → Budgets.
            </div>
          )}
        </div>
      )}

      {/* Board Report */}
      {report === "board" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Comprehensive financial summary for board presentation. Includes P&amp;L, collections, AR aging, and reserve fund.
            </p>
            <Button variant="outline" size="sm" className="gap-2" onClick={exportBoardReportCsv}>
              <Download className="h-4 w-4" /> Export Board Report CSV
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Net Position</p><p className={cn("text-2xl font-bold", plData.netPosition >= 0 ? "text-green-700" : "text-red-600")}>{formatCurrency(plData.netPosition)}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Collection Rate</p><p className={cn("text-2xl font-bold", collectionData.rate >= 90 ? "text-green-700" : "text-amber-600")}>{collectionData.rate.toFixed(1)}%</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Total Delinquent</p><p className="text-2xl font-bold text-red-600">{formatCurrency(agingData.totalDelinquent)}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Est. Reserve Balance</p><p className="text-2xl font-bold text-blue-700">{formatCurrency(reserveData.estimatedReserveBalance)}</p></CardContent></Card>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Income &amp; Expense Summary</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Total Billed</span><span className="font-medium">{formatCurrency(plData.totalCharges)}</span></div>
                  <div className="flex justify-between"><span>Total Collected</span><span className="font-medium text-green-700">{formatCurrency(Math.abs(plData.totalIncome))}</span></div>
                  <div className="flex justify-between"><span>Outstanding</span><span className="font-medium text-red-600">{formatCurrency(collectionData.outstanding)}</span></div>
                  <div className="border-t pt-2 flex justify-between font-semibold"><span>Net Position</span><span className={plData.netPosition >= 0 ? "text-green-700" : "text-red-600"}>{formatCurrency(plData.netPosition)}</span></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Delinquency Summary ({agingData.delinquent.length} owners)</CardTitle></CardHeader>
              <CardContent className={isMobile ? "pt-4" : "p-0"}>
                {isMobile ? (
                  <div className="space-y-3">
                    {agingData.delinquent.slice(0, 8).map((r) => (
                      <div key={`${r.unitId}-${r.personId}`} className="rounded-lg border p-4 flex items-start justify-between gap-3">
                        <div className="font-medium">{r.unitId.slice(0, 8)}</div>
                        <div className="text-sm font-semibold text-red-600">{formatCurrency(Math.abs(r.balance))}</div>
                      </div>
                    ))}
                    {agingData.delinquent.length === 0 && <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">No delinquent accounts</div>}
                  </div>
                ) : (
                  <Table>
                    <TableHeader><TableRow><TableHead>Unit</TableHead><TableHead className="text-right">Balance Due</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {agingData.delinquent.slice(0, 8).map((r) => (
                        <TableRow key={`${r.unitId}-${r.personId}`}>
                          <TableCell>{r.unitId.slice(0, 8)}</TableCell>
                          <TableCell className="text-right text-red-600 font-medium">{formatCurrency(Math.abs(r.balance))}</TableCell>
                        </TableRow>
                      ))}
                      {agingData.delinquent.length === 0 && <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">No delinquent accounts</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}

// ─── Server-backed Financial Summary Reports ──────────────────────────────────

type ProfitLossData = {
  income: { total: number; byCategory: { category: string; amount: number }[] };
  expenses: { total: number; byCategory: { category: string; amount: number }[] };
  net: number;
  budgetComparison: { planned: number; actual: number; variance: number };
};

type ArAgingData = {
  summary: { current: number; days30: number; days60: number; days90: number; days120plus: number; total: number };
  byUnit: { unitId: string; unitNumber: string; current: number; days30: number; days60: number; days90: number; days120plus: number; total: number }[];
};

type BoardSummaryData = {
  assessmentsBilled: number;
  paymentsReceived: number;
  collectionRate: number;
  totalOutstanding: number;
  delinquentUnits: number;
  budgetUtilization: number | null;
};

const SUMMARY_PERIODS = [
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "Last 6 months", days: 180 },
  { label: "Last 12 months", days: 365 },
];

function ProfitLossTab({ associationId }: { associationId: string }) {
  const [periodDays, setPeriodDays] = useState(90);

  const endDate = new Date();
  const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

  const query = useQuery<ProfitLossData>({
    queryKey: ["/api/financial/reports/profit-loss", associationId, periodDays],
    queryFn: async () => {
      const params = new URLSearchParams({
        associationId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
      const res = await apiRequest("GET", `/api/financial/reports/profit-loss?${params}`);
      return res.json();
    },
    enabled: Boolean(associationId),
  });

  const data = query.data;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={String(periodDays)} onValueChange={(v) => setPeriodDays(Number(v))}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {SUMMARY_PERIODS.map((p) => (
              <SelectItem key={p.days} value={String(p.days)}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {query.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="space-y-3 pt-6"><Skeleton className="h-4 w-24" /><Skeleton className="h-8 w-32" /></CardContent></Card>
          ))}
        </div>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total Income</p>
                <p className="text-2xl font-bold text-green-700">{formatCurrency(data.income.total)}</p>
                <p className="text-xs text-muted-foreground mt-1">Payments &amp; credits received</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total Expenses</p>
                <p className="text-2xl font-bold">{formatCurrency(data.expenses.total)}</p>
                <p className="text-xs text-muted-foreground mt-1">Adjustments posted</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Net</p>
                <p className={cn("text-2xl font-bold", data.net >= 0 ? "text-green-700" : "text-red-600")}>
                  {formatCurrency(data.net)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Budget Variance</p>
                <p className={cn("text-2xl font-bold", data.budgetComparison.variance >= 0 ? "text-green-700" : "text-red-600")}>
                  {formatCurrency(data.budgetComparison.variance)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">vs {formatCurrency(data.budgetComparison.planned)} planned</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Income Breakdown</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.income.byCategory.map((row) => (
                      <TableRow key={row.category}>
                        <TableCell className="capitalize">{row.category.replace(/-/g, " ")}</TableCell>
                        <TableCell className="text-right font-medium text-green-700">{formatCurrency(row.amount)}</TableCell>
                      </TableRow>
                    ))}
                    {data.income.byCategory.length === 0 && (
                      <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-6">No income entries</TableCell></TableRow>
                    )}
                    <TableRow className="font-semibold border-t">
                      <TableCell>Total Income</TableCell>
                      <TableCell className="text-right text-green-700">{formatCurrency(data.income.total)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Budget vs Actual</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Planned (Budget)</span>
                    <span className="font-medium">{formatCurrency(data.budgetComparison.planned)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Actual (Received)</span>
                    <span className="font-medium text-green-700">{formatCurrency(data.budgetComparison.actual)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-3 font-semibold">
                    <span>Variance</span>
                    <span className={data.budgetComparison.variance >= 0 ? "text-green-700" : "text-red-600"}>
                      {data.budgetComparison.variance >= 0 ? "+" : ""}{formatCurrency(data.budgetComparison.variance)}
                    </span>
                  </div>
                  {data.budgetComparison.planned === 0 && (
                    <p className="text-xs text-muted-foreground pt-1">No ratified budget found for this period.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Failed to load P&amp;L data.</p>
      )}
    </div>
  );
}

function ArAgingTab({ associationId }: { associationId: string }) {
  const query = useQuery<ArAgingData>({
    queryKey: ["/api/financial/reports/ar-aging", associationId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/financial/reports/ar-aging?associationId=${associationId}`);
      return res.json();
    },
    enabled: Boolean(associationId),
  });

  const data = query.data;

  return (
    <div className="space-y-4">
      {query.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="space-y-3 pt-6"><Skeleton className="h-4 w-16" /><Skeleton className="h-8 w-24" /></CardContent></Card>
          ))}
        </div>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Current (0–30 days)</p>
                <p className="text-2xl font-bold text-green-700">{formatCurrency(data.summary.current)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">31–60 days</p>
                <p className={cn("text-2xl font-bold", data.summary.days30 > 0 ? "text-amber-600" : "text-green-700")}>{formatCurrency(data.summary.days30)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">61–90 days</p>
                <p className={cn("text-2xl font-bold", data.summary.days60 > 0 ? "text-orange-600" : "text-green-700")}>{formatCurrency(data.summary.days60)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">91–120 days</p>
                <p className={cn("text-2xl font-bold", data.summary.days90 > 0 ? "text-red-600" : "text-green-700")}>{formatCurrency(data.summary.days90)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">120+ days</p>
                <p className={cn("text-2xl font-bold", data.summary.days120plus > 0 ? "text-red-700" : "text-green-700")}>{formatCurrency(data.summary.days120plus)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total Outstanding</p>
                <p className={cn("text-2xl font-bold", data.summary.total > 0 ? "text-red-600" : "text-green-700")}>{formatCurrency(data.summary.total)}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">AR Aging by Unit</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Current</TableHead>
                    <TableHead className="text-right">31–60</TableHead>
                    <TableHead className="text-right">61–90</TableHead>
                    <TableHead className="text-right">91–120</TableHead>
                    <TableHead className="text-right">120+</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byUnit.map((row) => (
                    <TableRow key={row.unitId}>
                      <TableCell className="font-medium">{row.unitNumber}</TableCell>
                      <TableCell className="text-right">{row.current > 0 ? formatCurrency(row.current) : "—"}</TableCell>
                      <TableCell className="text-right">{row.days30 > 0 ? formatCurrency(row.days30) : "—"}</TableCell>
                      <TableCell className="text-right">{row.days60 > 0 ? formatCurrency(row.days60) : "—"}</TableCell>
                      <TableCell className="text-right">{row.days90 > 0 ? formatCurrency(row.days90) : "—"}</TableCell>
                      <TableCell className="text-right">{row.days120plus > 0 ? formatCurrency(row.days120plus) : "—"}</TableCell>
                      <TableCell className="text-right font-semibold text-red-600">{formatCurrency(row.total)}</TableCell>
                    </TableRow>
                  ))}
                  {data.byUnit.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No outstanding balances found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Failed to load AR aging data.</p>
      )}
    </div>
  );
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function BoardSummaryTab({ associationId }: { associationId: string }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const query = useQuery<BoardSummaryData>({
    queryKey: ["/api/financial/reports/board-summary", associationId, month, year],
    queryFn: async () => {
      const params = new URLSearchParams({ associationId, month: String(month), year: String(year) });
      const res = await apiRequest("GET", `/api/financial/reports/board-summary?${params}`);
      return res.json();
    },
    enabled: Boolean(associationId),
  });

  const data = query.data;
  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MONTHS.map((m, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            {yearOptions.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {query.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="space-y-3 pt-6"><Skeleton className="h-4 w-24" /><Skeleton className="h-8 w-32" /></CardContent></Card>
          ))}
        </div>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Assessments Billed</p>
                <p className="text-2xl font-bold">{formatCurrency(data.assessmentsBilled)}</p>
                <p className="text-xs text-muted-foreground mt-1">Charges &amp; assessments posted</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Payments Received</p>
                <p className="text-2xl font-bold text-green-700">{formatCurrency(data.paymentsReceived)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Collection Rate</p>
                <p className={cn("text-2xl font-bold", data.collectionRate >= 90 ? "text-green-700" : data.collectionRate >= 70 ? "text-amber-600" : "text-red-600")}>
                  {data.collectionRate.toFixed(1)}%
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Outstanding Balance</p>
                <p className={cn("text-2xl font-bold", data.totalOutstanding > 0 ? "text-red-600" : "text-green-700")}>
                  {formatCurrency(data.totalOutstanding)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Delinquent Units</p>
                <p className={cn("text-2xl font-bold", data.delinquentUnits > 0 ? "text-red-600" : "text-green-700")}>
                  {data.delinquentUnits}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Units with balance due</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Budget Utilization</p>
                {data.budgetUtilization !== null ? (
                  <>
                    <p className={cn("text-2xl font-bold", data.budgetUtilization >= 80 ? "text-green-700" : data.budgetUtilization >= 50 ? "text-amber-600" : "text-red-600")}>
                      {data.budgetUtilization}%
                    </p>
                    <div className="mt-2 h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn("h-full rounded-full", data.budgetUtilization >= 80 ? "bg-green-500" : data.budgetUtilization >= 50 ? "bg-amber-500" : "bg-red-500")}
                        style={{ width: `${Math.min(100, data.budgetUtilization)}%` }}
                      />
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground mt-1">No ratified budget</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Failed to load board summary data.</p>
      )}
    </div>
  );
}

function FinancialSummaryReports() {
  const { activeAssociationId } = useActiveAssociation();

  if (!activeAssociationId) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        Select an association to view financial summary reports.
      </div>
    );
  }

  return (
    <Tabs defaultValue="pl" className="space-y-4">
      <TabsList>
        <TabsTrigger value="pl">P&amp;L Statement</TabsTrigger>
        <TabsTrigger value="ar-aging">AR Aging</TabsTrigger>
        <TabsTrigger value="board">Board Summary</TabsTrigger>
      </TabsList>
      <TabsContent value="pl" className="mt-0">
        <ProfitLossTab associationId={activeAssociationId} />
      </TabsContent>
      <TabsContent value="ar-aging" className="mt-0">
        <ArAgingTab associationId={activeAssociationId} />
      </TabsContent>
      <TabsContent value="board" className="mt-0">
        <BoardSummaryTab associationId={activeAssociationId} />
      </TabsContent>
    </Tabs>
  );
}

export default function FinancialReportsPage() {
  return (
    <div className="flex flex-col min-h-0">
      <div className="p-6 space-y-6">
        <WorkspacePageHeader
          title="Reports"
          eyebrow="Finance"
          summary="Financial reports, accounts receivable aging, and bank reconciliation for the active association."
          breadcrumbs={[{ label: "Finance", href: "/app/financial/foundation" }, { label: "Reports" }]}
          subPages={financeSubPages}
        />
        <Tabs defaultValue="summary" className="space-y-6">
          <TabsList>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
          </TabsList>
          <TabsContent value="summary" className="mt-0">
            <FinancialSummaryReports />
          </TabsContent>
          <TabsContent value="reports" className="mt-0">
            <FinancialReportsContent />
          </TabsContent>
          <TabsContent value="reconciliation" className="mt-0">
            <FinancialReconciliationContent />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
