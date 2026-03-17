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
import { cn } from "@/lib/utils";
import { Download } from "lucide-react";

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

export default function FinancialReportsPage() {
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
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Financial Reports</h1>
        <p className="text-muted-foreground">Income &amp; expense summary, collection rates, and accounts receivable aging for {activeAssociationName || "the selected association"}.</p>
      </div>

      {!activeAssociationId && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Select an association from the header to generate reports.
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex rounded-md border overflow-hidden">
          {(["pl", "collection", "ar-aging", "reserve", "board"] as ReportType[]).map((r) => (
            <button
              key={r}
              onClick={() => setReport(r)}
              className={cn(
                "px-3 py-1.5 text-sm font-medium transition-colors",
                report === r ? "bg-primary text-primary-foreground" : "hover:bg-accent",
              )}
            >
              {r === "pl" ? "P&L" : r === "collection" ? "Collections" : r === "ar-aging" ? "AR Aging" : r === "reserve" ? "Reserve" : "Board Report"}
            </button>
          ))}
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
          onClick={report === "pl" ? exportPlCsv : report === "collection" ? exportCollectionCsv : exportAgingCsv}
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

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
            <CardContent className="p-0">
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
            <CardContent className="p-0">
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
              <CardContent className="p-0">
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
              <CardContent className="p-0">
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
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
