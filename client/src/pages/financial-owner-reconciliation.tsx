// zone: Financials
// persona: Manager, Board Officer, Assisted Board, PM Assistant, Platform Admin
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useActiveAssociation } from "@/hooks/use-active-association";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";

type ReconRow = {
  ownershipId: string;
  personId: string;
  unitId: string;
  ownerName: string;
  unitNumber: string;
  expectedBalance: number;
  actualLedgerBalance: number;
  discrepancy: number;
  lastPaymentAt: string | null;
  paymentPlan: { totalAmount: number; status: string } | null;
  status: "clean" | "discrepancy" | "past-due";
};

type ReconResponse = {
  rows: ReconRow[];
  empty: boolean;
  reason?: "no-ownerships" | "no-ledger-data";
  generatedAt?: string;
};

type StatusFilter = "all" | "discrepancy" | "past-due";

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function StatusBadge({ status }: { status: ReconRow["status"] }) {
  if (status === "clean") {
    return (
      <Badge variant="secondary" className="gap-1">
        <CheckCircle2 className="h-3 w-3" /> Clean
      </Badge>
    );
  }
  if (status === "discrepancy") {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertCircle className="h-3 w-3" /> Discrepancy
      </Badge>
    );
  }
  return (
    <Badge variant="default" className="gap-1">
      <Clock className="h-3 w-3" /> Past due
    </Badge>
  );
}

export function FinancialOwnerReconciliationContent() {
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const { data, isLoading, isError, error } = useQuery<ReconResponse>({
    queryKey: ["/api/admin/financial/reconciliation-report", activeAssociationId],
    queryFn: async () => {
      if (!activeAssociationId) throw new Error("No active association");
      const res = await apiRequest("GET", `/api/admin/financial/reconciliation-report?associationId=${encodeURIComponent(activeAssociationId)}`);
      return (await res.json()) as ReconResponse;
    },
    enabled: !!activeAssociationId,
  });

  const filteredRows = useMemo(() => {
    if (!data?.rows) return [];
    if (statusFilter === "all") return data.rows;
    return data.rows.filter((r) => r.status === statusFilter);
  }, [data, statusFilter]);

  if (!activeAssociationId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Owner Reconciliation</CardTitle>
          <CardDescription>Select an association to view per-owner balance reconciliation.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card data-testid="financial-owner-reconciliation">
      <CardHeader>
        <CardTitle>Owner Reconciliation — {activeAssociationName ?? "Association"}</CardTitle>
        <CardDescription>
          Per-owner balance reconciliation. Compares the expected balance (charges − payments)
          to the actual ledger sum. Sort: largest discrepancy first.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">Filter:</span>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-[200px]" data-testid="select-status-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All owners</SelectItem>
              <SelectItem value="discrepancy">Discrepancies only</SelectItem>
              <SelectItem value="past-due">Past due only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : isError ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            Failed to load reconciliation report: {(error as Error).message}
          </div>
        ) : data?.empty ? (
          <div className="rounded-md border bg-muted/30 p-6 text-sm">
            <p className="font-medium mb-1">
              {data.reason === "no-ownerships"
                ? "No ownerships configured for this association."
                : "No ledger data for this association."}
            </p>
            <p className="text-muted-foreground">
              {data.reason === "no-ownerships"
                ? "Add ownership records (linking persons to units) to see balances here."
                : "Import data via the CSV import tool to populate this report."}
            </p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="rounded-md border bg-muted/30 p-6 text-sm text-muted-foreground">
            No owners match the current filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Owner</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Expected</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead className="text-right">Discrepancy</TableHead>
                  <TableHead>Last payment</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row) => (
                  <TableRow key={row.ownershipId} data-testid={`recon-row-${row.ownershipId}`}>
                    <TableCell className="font-medium">{row.ownerName}</TableCell>
                    <TableCell>{row.unitNumber}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(row.expectedBalance)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(row.actualLedgerBalance)}</TableCell>
                    <TableCell className={`text-right tabular-nums ${Math.abs(row.discrepancy) > 0.009 ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                      {formatCurrency(row.discrepancy)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(row.lastPaymentAt)}</TableCell>
                    <TableCell>
                      {row.paymentPlan ? (
                        <Badge variant="outline">
                          {formatCurrency(row.paymentPlan.totalAmount)} · {row.paymentPlan.status}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {data?.generatedAt && !data.empty && (
          <p className="text-xs text-muted-foreground">
            Generated {new Date(data.generatedAt).toLocaleString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default FinancialOwnerReconciliationContent;
