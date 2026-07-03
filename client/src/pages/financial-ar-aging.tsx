// zone: Financials
// persona: Manager, Board Officer, Assisted Board, PM Assistant, Viewer
//
// AR Aging / Delinquency report (readiness P2 — "who owes what, and how
// overdue"). Read-only view of each unit's outstanding balance bucketed by the
// age of its oldest unpaid charge. Reads the LIVE owner ledger, so it works for
// Cherry Hill immediately — no GL flip, no assessment run required.
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useActiveAssociation } from "@/hooks/use-active-association";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { ExportCsvButton } from "@/components/export-csv-button";
import { financeSubPages } from "@/lib/sub-page-nav";
import { cn } from "@/lib/utils";

type AgingBuckets = {
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days90plus: number;
};

type ArAgingUnitRow = {
  unitId: string;
  unitNumber: string | null;
  ownerNames: string[];
  buckets: AgingBuckets;
  totalOwed: number;
  oldestUnpaidDays: number;
  isDelinquent: boolean;
};

type ArAgingReport = {
  asOf: string;
  summary: {
    totals: AgingBuckets;
    totalAr: number;
    percentCurrent: number;
    unitsWithBalance: number;
    delinquentUnits: number;
  };
  units: ArAgingUnitRow[];
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

/** Show a dollar cell, or an em-dash when the bucket is empty. */
function cell(n: number) {
  return n > 0 ? formatCurrency(n) : "—";
}

export function FinancialArAgingContent() {
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();

  const { data, isLoading } = useQuery<ArAgingReport>({
    queryKey: ["/api/financial/ar-aging", activeAssociationId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/financial/ar-aging?associationId=${activeAssociationId}`);
      return res.json();
    },
    enabled: Boolean(activeAssociationId),
  });

  if (!activeAssociationId) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        Select an association to view its AR aging report.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="space-y-3 pt-6"><Skeleton className="h-4 w-24" /><Skeleton className="h-8 w-32" /></CardContent></Card>
          ))}
        </div>
        <Card><CardContent className="space-y-3 p-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</CardContent></Card>
      </div>
    );
  }

  const summary = data?.summary;
  const units = data?.units ?? [];
  const totals = summary?.totals;

  const csvHeaders = ["Unit", "Owner(s)", "Current", "1-30", "31-60", "61-90", "90+", "Total Owed", "Days Overdue"];
  const csvRows = units.map((u) => [
    u.unitNumber ?? u.unitId.slice(0, 8),
    u.ownerNames.join("; ") || "—",
    u.buckets.current.toFixed(2),
    u.buckets.days1to30.toFixed(2),
    u.buckets.days31to60.toFixed(2),
    u.buckets.days61to90.toFixed(2),
    u.buckets.days90plus.toFixed(2),
    u.totalOwed.toFixed(2),
    String(u.oldestUnpaidDays),
  ]);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total AR Outstanding</p>
            <p className={cn("text-2xl font-bold", (summary?.totalAr ?? 0) > 0 ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400")}>
              {formatCurrency(summary?.totalAr ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Owed across all units</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">% Current</p>
            <p className={cn("text-2xl font-bold", (summary?.percentCurrent ?? 0) >= 90 ? "text-green-700 dark:text-green-400" : (summary?.percentCurrent ?? 0) >= 70 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400")}>
              {summary?.percentCurrent ?? 0}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">Of outstanding balance not overdue</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Units With Balance</p>
            <p className="text-2xl font-bold">{summary?.unitsWithBalance ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">Owe any amount</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Delinquent Units</p>
            <p className={cn("text-2xl font-bold", (summary?.delinquentUnits ?? 0) > 0 ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400")}>
              {summary?.delinquentUnits ?? 0}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Past due (any bucket beyond Current)</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">Aging by Unit</CardTitle>
          <ExportCsvButton
            headers={csvHeaders}
            rows={csvRows}
            filename={`ar-aging-${activeAssociationName || "association"}`}
            disabled={units.length === 0}
          />
        </CardHeader>
        <CardContent className="p-0">
          {units.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
              No units carry an outstanding balance. Everyone is current.
            </div>
          ) : (
            <Table aria-label="Accounts receivable aging by unit">
              <TableHeader>
                <TableRow>
                  <TableHead>Unit</TableHead>
                  <TableHead>Owner(s)</TableHead>
                  <TableHead className="text-right">Current</TableHead>
                  <TableHead className="text-right">1–30</TableHead>
                  <TableHead className="text-right">31–60</TableHead>
                  <TableHead className="text-right">61–90</TableHead>
                  <TableHead className="text-right">90+</TableHead>
                  <TableHead className="text-right">Total Owed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {units.map((u) => (
                  <TableRow key={u.unitId}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {u.unitNumber ?? u.unitId.slice(0, 8)}
                        {u.buckets.days90plus > 0 && (
                          <Badge variant="destructive" className="text-xs">90+</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.ownerNames.join(", ") || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{cell(u.buckets.current)}</TableCell>
                    <TableCell className="text-right tabular-nums">{cell(u.buckets.days1to30)}</TableCell>
                    <TableCell className="text-right tabular-nums text-amber-600 dark:text-amber-400">{cell(u.buckets.days31to60)}</TableCell>
                    <TableCell className="text-right tabular-nums text-orange-600 dark:text-orange-400">{cell(u.buckets.days61to90)}</TableCell>
                    <TableCell className="text-right tabular-nums text-red-600 dark:text-red-400">{cell(u.buckets.days90plus)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-red-600 dark:text-red-400">{formatCurrency(u.totalOwed)}</TableCell>
                  </TableRow>
                ))}
                {/* Totals row */}
                {totals && (
                  <TableRow className="border-t-2 font-semibold bg-muted/30">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-muted-foreground">{summary?.unitsWithBalance ?? 0} unit{(summary?.unitsWithBalance ?? 0) !== 1 ? "s" : ""}</TableCell>
                    <TableCell className="text-right tabular-nums">{cell(totals.current)}</TableCell>
                    <TableCell className="text-right tabular-nums">{cell(totals.days1to30)}</TableCell>
                    <TableCell className="text-right tabular-nums">{cell(totals.days31to60)}</TableCell>
                    <TableCell className="text-right tabular-nums">{cell(totals.days61to90)}</TableCell>
                    <TableCell className="text-right tabular-nums">{cell(totals.days90plus)}</TableCell>
                    <TableCell className="text-right tabular-nums text-red-600 dark:text-red-400">{formatCurrency(summary?.totalAr ?? 0)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Balances are computed from the owner ledger by applying payments to the oldest charges first.
        Each remaining amount is aged by the date of the charge it belongs to.
      </p>
    </div>
  );
}

export default function FinancialArAgingPage() {
  useDocumentTitle("AR Aging");
  return (
    <div className="flex flex-col min-h-0">
      <div className="p-6 space-y-6">
        <WorkspacePageHeader
          title="AR Aging"
          eyebrow="Finance"
          summary="Accounts receivable aging — every unit's outstanding balance, bucketed by how overdue it is, from the live owner ledger."
          breadcrumbs={[{ label: "Financials", href: "/app/financials" }, { label: "AR Aging" }]}
          subPages={financeSubPages}
        />
        <FinancialArAgingContent />
      </div>
    </div>
  );
}
