import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useActiveAssociation } from "@/hooks/use-active-association";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { AssociationScopeBanner } from "@/components/association-scope-banner";
import { FinanceTabBar } from "@/components/finance-tab-bar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertCircle, CheckCircle2, RefreshCw, Plus, GitMerge, Lock, LockOpen, CheckSquare, FileUp } from "lucide-react";
import type { BankStatementImport, BankStatementTransaction, OwnerLedgerEntry, ReconciliationPeriod } from "@shared/schema";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useIsMobile } from "@/hooks/use-mobile";

// Parse a bank CSV — supports common formats: Date, Description, Amount (positive/negative)
function parseBankCsv(csvText: string): { date: string; description: string; amount: number }[] {
  const lines = csvText.trim().split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].toLowerCase().replace(/"/g, "").split(",");
  const dateIdx = header.findIndex(h => h.includes("date"));
  const descIdx = header.findIndex(h => h.includes("desc") || h.includes("memo") || h.includes("narr"));
  const amtIdx = header.findIndex(h => h.includes("amount") || h.includes("debit") || h === "credit");
  if (dateIdx < 0 || amtIdx < 0) return [];

  return lines.slice(1).map(line => {
    const parts = line.split(",").map(p => p.replace(/"/g, "").trim());
    const rawDate = parts[dateIdx] ?? "";
    const parsedDate = new Date(rawDate);
    const date = isNaN(parsedDate.getTime()) ? rawDate : parsedDate.toISOString().slice(0, 10);
    const description = descIdx >= 0 ? (parts[descIdx] ?? "") : "Bank transaction";
    const amount = parseFloat(parts[amtIdx] ?? "0") || 0;
    return { date, description, amount };
  }).filter(t => t.date && !isNaN(t.amount));
}

function matchStatusBadge(status: string) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    unmatched: { label: "Unmatched", variant: "destructive" },
    auto_matched: { label: "Auto-matched", variant: "default" },
    manual_matched: { label: "Manual", variant: "default" },
    disputed: { label: "Disputed", variant: "destructive" },
    excluded: { label: "Excluded", variant: "secondary" },
  };
  const m = map[status] ?? { label: status, variant: "outline" };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

export default function FinancialReconciliationPage() {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();

  const [selectedImportId, setSelectedImportId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [manualMatchTx, setManualMatchTx] = useState<BankStatementTransaction | null>(null);
  const [manualLedgerEntryId, setManualLedgerEntryId] = useState("");
  const [manualNotes, setManualNotes] = useState("");

  // Import form
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importForm, setImportForm] = useState({
    filename: "",
    statementDate: new Date().toISOString().slice(0, 10),
    openingBalance: "",
    closingBalance: "",
    transactions: "" as string,
  });
  const [csvParseError, setCsvParseError] = useState<string | null>(null);

  function handleCsvFileUpload(file: File) {
    setCsvParseError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        const parsed = parseBankCsv(text);
        if (parsed.length === 0) {
          setCsvParseError("Could not parse transactions. Ensure CSV has Date, Description, Amount columns.");
          return;
        }
        setImportForm(f => ({
          ...f,
          filename: file.name,
          transactions: JSON.stringify(parsed, null, 2),
        }));
      } catch (err: any) {
        setCsvParseError(`Parse error: ${err.message}`);
      }
    };
    reader.readAsText(file);
  }

  const { data: imports = [], refetch: refetchImports } = useQuery<BankStatementImport[]>({
    queryKey: ["/api/financial/reconciliation/imports", activeAssociationId],
    queryFn: async () => {
      if (!activeAssociationId) return [];
      const res = await apiRequest("GET", `/api/financial/reconciliation/imports?associationId=${activeAssociationId}`);
      return res.json();
    },
    enabled: Boolean(activeAssociationId),
  });

  const { data: transactions = [], refetch: refetchTransactions } = useQuery<BankStatementTransaction[]>({
    queryKey: ["/api/financial/reconciliation/transactions", activeAssociationId, selectedImportId],
    queryFn: async () => {
      if (!activeAssociationId) return [];
      const params = new URLSearchParams({ associationId: activeAssociationId });
      if (selectedImportId) params.set("importId", selectedImportId);
      const res = await apiRequest("GET", `/api/financial/reconciliation/transactions?${params}`);
      return res.json();
    },
    enabled: Boolean(activeAssociationId),
  });

  const { data: ledgerEntries = [] } = useQuery<OwnerLedgerEntry[]>({
    queryKey: ["/api/financial/owner-ledger/entries", activeAssociationId],
    queryFn: async () => {
      if (!activeAssociationId) return [];
      const res = await apiRequest("GET", `/api/financial/owner-ledger/entries?associationId=${activeAssociationId}`);
      return res.json();
    },
    enabled: Boolean(activeAssociationId),
  });

  const filteredTransactions = statusFilter === "all" ? transactions : transactions.filter(t => t.matchStatus === statusFilter);

  const stats = {
    total: transactions.length,
    unmatched: transactions.filter(t => t.matchStatus === "unmatched").length,
    autoMatched: transactions.filter(t => t.matchStatus === "auto_matched").length,
    manualMatched: transactions.filter(t => t.matchStatus === "manual_matched").length,
    excluded: transactions.filter(t => t.matchStatus === "excluded").length,
  };

  const createImport = useMutation({
    mutationFn: async () => {
      if (!activeAssociationId) throw new Error("No association selected");
      let parsedTransactions: unknown[] = [];
      if (importForm.transactions.trim()) {
        try { parsedTransactions = JSON.parse(importForm.transactions); } catch { throw new Error("Invalid JSON in transactions field"); }
      }
      const res = await apiRequest("POST", "/api/financial/reconciliation/imports", {
        associationId: activeAssociationId,
        filename: importForm.filename || "manual-import",
        statementDate: importForm.statementDate || null,
        openingBalance: importForm.openingBalance || null,
        closingBalance: importForm.closingBalance || null,
        transactions: parsedTransactions,
      });
      return res.json();
    },
    onSuccess: async () => {
      await refetchImports();
      await refetchTransactions();
      setImportDialogOpen(false);
      setImportForm({ filename: "", statementDate: new Date().toISOString().slice(0, 10), openingBalance: "", closingBalance: "", transactions: "" });
      toast({ title: "Statement imported" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const autoMatch = useMutation({
    mutationFn: async () => {
      if (!activeAssociationId || !selectedImportId) throw new Error("Select an import first");
      const res = await apiRequest("POST", "/api/financial/reconciliation/auto-match", {
        associationId: activeAssociationId,
        importId: selectedImportId,
      });
      return res.json() as Promise<{ matched: number; total: number }>;
    },
    onSuccess: async (result) => {
      await refetchTransactions();
      toast({ title: "Auto-match complete", description: `${result.matched} of ${result.total} transactions matched` });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const manualMatch = useMutation({
    mutationFn: async () => {
      if (!manualMatchTx) throw new Error("No transaction selected");
      const res = await apiRequest("PATCH", `/api/financial/reconciliation/transactions/${manualMatchTx.id}/match`, {
        ledgerEntryId: manualLedgerEntryId || null,
        matchStatus: "manual_matched",
        matchNotes: manualNotes || null,
      });
      return res.json();
    },
    onSuccess: async () => {
      await refetchTransactions();
      setManualMatchTx(null);
      setManualLedgerEntryId("");
      setManualNotes("");
      toast({ title: "Transaction matched" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Period close controls
  const [periodDialogOpen, setPeriodDialogOpen] = useState(false);
  const [periodForm, setPeriodForm] = useState({ periodLabel: "", startDate: "", endDate: "", notes: "" });

  const { data: periods = [], refetch: refetchPeriods } = useQuery<ReconciliationPeriod[]>({
    queryKey: ["/api/financial/reconciliation/periods", activeAssociationId],
    queryFn: async () => {
      if (!activeAssociationId) return [];
      const res = await apiRequest("GET", `/api/financial/reconciliation/periods?associationId=${activeAssociationId}`);
      return res.json();
    },
    enabled: Boolean(activeAssociationId),
  });

  const createPeriod = useMutation({
    mutationFn: async () => {
      if (!activeAssociationId) throw new Error("No association selected");
      const res = await apiRequest("POST", "/api/financial/reconciliation/periods", {
        associationId: activeAssociationId,
        periodLabel: periodForm.periodLabel,
        startDate: new Date(periodForm.startDate).toISOString(),
        endDate: new Date(periodForm.endDate).toISOString(),
        importId: selectedImportId || null,
        notes: periodForm.notes || null,
      });
      return res.json();
    },
    onSuccess: async () => {
      await refetchPeriods();
      setPeriodDialogOpen(false);
      setPeriodForm({ periodLabel: "", startDate: "", endDate: "", notes: "" });
      toast({ title: "Period created" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updatePeriod = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "close" | "lock" | "reopen" }) => {
      const res = await apiRequest("PATCH", `/api/financial/reconciliation/periods/${id}`, { action });
      return res.json();
    },
    onSuccess: () => void refetchPeriods(),
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const setExcluded = useMutation({
    mutationFn: async (txId: string) => {
      const res = await apiRequest("PATCH", `/api/financial/reconciliation/transactions/${txId}/match`, {
        matchStatus: "excluded",
        matchNotes: "Excluded from reconciliation",
      });
      return res.json();
    },
    onSuccess: () => void refetchTransactions(),
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="flex flex-col min-h-0">
      <FinanceTabBar />
      <div className="p-6 space-y-6">
      <WorkspacePageHeader
        title="Bank Reconciliation"
        summary="Import bank statements, auto-match transactions to ledger entries, and manually review unmatched items."
        eyebrow="Finance"
        breadcrumbs={[{ label: "Finance", href: "/app/financial/foundation" }, { label: "Reconciliation" }]}
      />

      <AssociationScopeBanner
        activeAssociationId={activeAssociationId}
        activeAssociationName={activeAssociationName}
        explanation="Reconciliation is scoped per association. Select one to manage its bank statement imports."
      />

      {/* Workflow Step Indicator */}
      <div className={`rounded-lg border bg-muted/30 overflow-hidden ${isMobile ? "grid grid-cols-1" : "flex items-center gap-0"}`}>
        {[
          { step: 1, label: "Import Statement", done: imports.length > 0 },
          { step: 2, label: "Auto-Match", done: stats.autoMatched > 0 },
          { step: 3, label: "Review Unmatched", done: stats.unmatched === 0 && transactions.length > 0 },
          { step: 4, label: "Lock Period", done: periods.some(p => p.status === "locked") },
        ].map((s, i, arr) => (
          <div key={s.step} className={`flex items-center gap-2 flex-1 px-4 py-3 text-sm ${s.done ? "bg-green-50 dark:bg-green-900/20" : ""}`}>
            <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold shrink-0 ${s.done ? "bg-green-500 text-white" : "bg-muted-foreground/20 text-muted-foreground"}`}>
              {s.done ? <CheckCircle2 className="h-4 w-4" /> : s.step}
            </div>
            <span className={`font-medium truncate ${s.done ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}`}>{s.label}</span>
            {!isMobile && i < arr.length - 1 && <div className="ml-auto h-px w-4 bg-border shrink-0" />}
          </div>
        ))}
      </div>

      {/* Import + Select */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className={`gap-3 ${isMobile ? "grid grid-cols-1" : "flex items-center flex-wrap"}`}>
            <Select value={selectedImportId} onValueChange={setSelectedImportId}>
              <SelectTrigger className={isMobile ? "min-h-11 w-full" : "w-72"}>
                <SelectValue placeholder="Select a statement import" />
              </SelectTrigger>
              <SelectContent>
                {imports.map((imp) => (
                  <SelectItem key={imp.id} value={imp.id}>
                    {imp.filename} — {imp.statementDate ? new Date(imp.statementDate).toLocaleDateString() : "no date"}
                    <span className="ml-2 text-muted-foreground">({imp.transactionCount} txns)</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className={isMobile ? "min-h-11 w-full" : undefined} onClick={() => setImportDialogOpen(true)} disabled={!activeAssociationId}>
              <Plus className="h-4 w-4 mr-1" /> New Import
            </Button>
            {selectedImportId && (
              <Button size="sm" variant="outline" className={isMobile ? "min-h-11 w-full" : undefined} onClick={() => autoMatch.mutate()} disabled={autoMatch.isPending}>
                <RefreshCw className={`h-4 w-4 mr-1 ${autoMatch.isPending ? "animate-spin" : ""}`} />
                Auto-Match
              </Button>
            )}
          </div>

          {transactions.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2">
              {[
                { label: "Total", value: stats.total, color: "" },
                { label: "Unmatched", value: stats.unmatched, color: stats.unmatched > 0 ? "text-red-600" : "text-green-600" },
                { label: "Auto-Matched", value: stats.autoMatched, color: "text-green-600" },
                { label: "Manual", value: stats.manualMatched, color: "text-blue-600" },
                { label: "Excluded", value: stats.excluded, color: "text-muted-foreground" },
              ].map((s) => (
                <div key={s.label} className="text-center rounded-md border p-2">
                  <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Match Queue */}
      {transactions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className={`gap-3 ${isMobile ? "grid grid-cols-1" : "flex items-center justify-between"}`}>
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <GitMerge className="h-4 w-4 text-blue-500" /> Match Queue
                </CardTitle>
                <CardDescription>Review and match bank transactions to ledger entries</CardDescription>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className={isMobile ? "min-h-11 w-full text-sm" : "w-36 h-8 text-xs"}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="unmatched">Unmatched</SelectItem>
                  <SelectItem value="auto_matched">Auto-matched</SelectItem>
                  <SelectItem value="manual_matched">Manual</SelectItem>
                  <SelectItem value="excluded">Excluded</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isMobile ? (
              <div className="space-y-3">
                {filteredTransactions.map((tx) => {
                  const matchedEntry = tx.matchedLedgerEntryId ? ledgerEntries.find(e => e.id === tx.matchedLedgerEntryId) : null;
                  return (
                    <div key={tx.id} className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium leading-5">{tx.description}</div>
                          <div className="text-xs text-muted-foreground">{new Date(tx.transactionDate).toLocaleDateString()}</div>
                        </div>
                        <div className={`text-sm font-semibold shrink-0 ${tx.amount < 0 ? "text-red-600" : "text-green-600"}`}>
                          {tx.amount < 0 ? "-" : "+"}${Math.abs(tx.amount).toFixed(2)}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {matchStatusBadge(tx.matchStatus)}
                      </div>
                      <div className="rounded-md bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                        {matchedEntry
                          ? `${matchedEntry.description ?? matchedEntry.entryType} · $${Math.abs(matchedEntry.amount).toFixed(2)}`
                          : tx.matchStatus === "excluded"
                            ? "Excluded from reconciliation"
                            : "No ledger entry matched yet."}
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {(tx.matchStatus === "unmatched" || tx.matchStatus === "disputed") && (
                          <>
                            <Button className="min-h-11 w-full" variant="outline" onClick={() => { setManualMatchTx(tx); setManualLedgerEntryId(""); setManualNotes(""); }}>
                              Match Transaction
                            </Button>
                            <Button className="min-h-11 w-full" variant="ghost" onClick={() => setExcluded.mutate(tx.id)}>
                              Exclude from Queue
                            </Button>
                          </>
                        )}
                        {(tx.matchStatus === "auto_matched" || tx.matchStatus === "manual_matched") && (
                          <Button className="min-h-11 w-full" variant="ghost" onClick={() => setManualMatchTx(tx)}>
                            Review Match
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {filteredTransactions.length === 0 && (
                  <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                    No transactions match the selected filter.
                  </div>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Matched Entry</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((tx) => {
                    const matchedEntry = tx.matchedLedgerEntryId ? ledgerEntries.find(e => e.id === tx.matchedLedgerEntryId) : null;
                    return (
                      <TableRow key={tx.id}>
                        <TableCell className="text-sm text-muted-foreground">{new Date(tx.transactionDate).toLocaleDateString()}</TableCell>
                        <TableCell className="max-w-xs truncate text-sm">{tx.description}</TableCell>
                        <TableCell className={`font-medium ${tx.amount < 0 ? "text-red-600" : "text-green-600"}`}>
                          {tx.amount < 0 ? "-" : "+"}${Math.abs(tx.amount).toFixed(2)}
                        </TableCell>
                        <TableCell>{matchStatusBadge(tx.matchStatus)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {matchedEntry ? (
                            <span>{matchedEntry.description ?? matchedEntry.entryType} · ${Math.abs(matchedEntry.amount).toFixed(2)}</span>
                          ) : tx.matchStatus === "excluded" ? <span className="italic">excluded</span> : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {(tx.matchStatus === "unmatched" || tx.matchStatus === "disputed") && (
                              <>
                                <Button size="sm" variant="outline" onClick={() => { setManualMatchTx(tx); setManualLedgerEntryId(""); setManualNotes(""); }}>
                                  Match
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setExcluded.mutate(tx.id)}>
                                  Exclude
                                </Button>
                              </>
                            )}
                            {(tx.matchStatus === "auto_matched" || tx.matchStatus === "manual_matched") && (
                              <Button size="sm" variant="ghost" onClick={() => setManualMatchTx(tx)}>
                                Review
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredTransactions.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No transactions match the selected filter.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}

            {stats.unmatched === 0 && transactions.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-green-600 mt-3">
                <CheckCircle2 className="h-4 w-4" /> All transactions are matched. Reconciliation complete.
              </div>
            )}
            {stats.unmatched > 0 && (
              <div className="flex items-center gap-2 text-sm text-amber-600 mt-3">
                <AlertCircle className="h-4 w-4" /> {stats.unmatched} unmatched transaction{stats.unmatched !== 1 ? "s" : ""} require review.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Period Close Controls */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="h-4 w-4 text-purple-500" /> Period Close Controls
              </CardTitle>
              <CardDescription>Create, close, and lock reconciliation periods to prevent edits to matched transactions.</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={() => setPeriodDialogOpen(true)} disabled={!activeAssociationId}>
              <Plus className="h-4 w-4 mr-1" /> New Period
            </Button>
          </div>
        </CardHeader>
          <CardContent>
            {periods.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">No reconciliation periods defined. Create one to track close status.</div>
            ) : (
              isMobile ? (
                <div className="space-y-3">
                  {periods.map((p) => (
                    <div key={p.id} className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">{p.periodLabel}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(p.startDate).toLocaleDateString()} – {new Date(p.endDate).toLocaleDateString()}
                          </div>
                        </div>
                        <Badge variant={p.status === "locked" ? "destructive" : p.status === "closed" ? "default" : "secondary"}>
                          {p.status === "locked" && <Lock className="h-3 w-3 mr-1" />}
                          {p.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground">
                        <div>Closed by: {p.closedBy ? `${p.closedBy}${p.closedAt ? ` · ${new Date(p.closedAt).toLocaleDateString()}` : ""}` : "—"}</div>
                        <div>Locked by: {p.lockedBy ? `${p.lockedBy}${p.lockedAt ? ` · ${new Date(p.lockedAt).toLocaleDateString()}` : ""}` : "—"}</div>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {p.status === "open" && (
                          <Button className="min-h-11 w-full" variant="outline" onClick={() => updatePeriod.mutate({ id: p.id, action: "close" })}>
                            <CheckSquare className="h-4 w-4 mr-2" /> Close Period
                          </Button>
                        )}
                        {p.status === "closed" && (
                          <ConfirmDialog
                            trigger={
                              <Button className="min-h-11 w-full" variant="outline" title="Lock period">
                                <Lock className="h-4 w-4 mr-2" /> Lock Period
                              </Button>
                            }
                            title="Lock this reconciliation period?"
                            description={`Locking "${p.periodLabel}" is irreversible. Once locked, no transactions in this period can be edited, re-matched, or deleted. This action is permanent and cannot be undone without platform administrator access.`}
                            confirmLabel="Lock Period"
                            onConfirm={() => updatePeriod.mutate({ id: p.id, action: "lock" })}
                          />
                        )}
                        {p.status === "locked" && (
                          <Button className="min-h-11 w-full" variant="ghost" title="Reopen (Platform admin only)" onClick={() => updatePeriod.mutate({ id: p.id, action: "reopen" })}>
                            <LockOpen className="h-4 w-4 mr-2" /> Reopen Period
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Closed By</TableHead>
                      <TableHead>Locked By</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {periods.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.periodLabel}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(p.startDate).toLocaleDateString()} – {new Date(p.endDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant={p.status === "locked" ? "destructive" : p.status === "closed" ? "default" : "secondary"}>
                            {p.status === "locked" && <Lock className="h-3 w-3 mr-1" />}
                            {p.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {p.closedBy ? `${p.closedBy}${p.closedAt ? ` · ${new Date(p.closedAt).toLocaleDateString()}` : ""}` : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {p.lockedBy ? `${p.lockedBy}${p.lockedAt ? ` · ${new Date(p.lockedAt).toLocaleDateString()}` : ""}` : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {p.status === "open" && (
                              <Button size="icon" variant="outline" title="Close" onClick={() => updatePeriod.mutate({ id: p.id, action: "close" })}>
                                <CheckSquare className="h-4 w-4" />
                              </Button>
                            )}
                            {p.status === "closed" && (
                              <ConfirmDialog
                                trigger={
                                  <Button size="sm" variant="outline" title="Lock period">
                                    <Lock className="h-4 w-4 mr-1" /> Lock
                                  </Button>
                                }
                                title="Lock this reconciliation period?"
                                description={`Locking "${p.periodLabel}" is irreversible. Once locked, no transactions in this period can be edited, re-matched, or deleted. This action is permanent and cannot be undone without platform administrator access.`}
                                confirmLabel="Lock Period"
                                onConfirm={() => updatePeriod.mutate({ id: p.id, action: "lock" })}
                              />
                            )}
                            {p.status === "locked" && (
                              <Button size="icon" variant="ghost" title="Reopen (Platform admin only)" onClick={() => updatePeriod.mutate({ id: p.id, action: "reopen" })}>
                                <LockOpen className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )
            )}
          </CardContent>
      </Card>

      {/* New Period Dialog */}
      <Dialog open={periodDialogOpen} onOpenChange={setPeriodDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto sm:max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Create Reconciliation Period</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Period label (e.g., March 2026)" value={periodForm.periodLabel} onChange={e => setPeriodForm(f => ({ ...f, periodLabel: e.target.value }))} />
            <div className={`grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Start Date</label>
                <Input type="date" value={periodForm.startDate} onChange={e => setPeriodForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">End Date</label>
                <Input type="date" value={periodForm.endDate} onChange={e => setPeriodForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>
            <Textarea placeholder="Notes (optional)" value={periodForm.notes} onChange={e => setPeriodForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            <div className={`gap-2 ${isMobile ? "grid grid-cols-1" : "flex justify-end"}`}>
              <Button className={isMobile ? "w-full" : undefined} variant="outline" onClick={() => setPeriodDialogOpen(false)}>Cancel</Button>
              <Button className={isMobile ? "w-full" : undefined} onClick={() => createPeriod.mutate()} disabled={!periodForm.periodLabel || !periodForm.startDate || !periodForm.endDate || createPeriod.isPending}>Create</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual Match Dialog */}
      <Dialog open={Boolean(manualMatchTx)} onOpenChange={(o) => { if (!o) setManualMatchTx(null); }}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto sm:max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Manual Match Transaction</DialogTitle>
          </DialogHeader>
          {manualMatchTx && (
            <div className="space-y-3">
              <div className="rounded-md border p-3 text-sm bg-muted/30">
                <div className="font-medium">{manualMatchTx.description}</div>
                <div className="text-muted-foreground">{new Date(manualMatchTx.transactionDate).toLocaleDateString()} · ${Math.abs(manualMatchTx.amount).toFixed(2)}</div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Match to Ledger Entry (optional — type entry ID)</label>
                <Input placeholder="Ledger entry ID" value={manualLedgerEntryId} onChange={e => setManualLedgerEntryId(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Notes</label>
                <Textarea placeholder="Reconciliation notes" value={manualNotes} onChange={e => setManualNotes(e.target.value)} rows={2} />
              </div>
              <div className={`gap-2 ${isMobile ? "grid grid-cols-1" : "flex justify-end"}`}>
                <Button className={isMobile ? "w-full" : undefined} variant="outline" onClick={() => setManualMatchTx(null)}>Cancel</Button>
                <Button className={isMobile ? "w-full" : undefined} onClick={() => manualMatch.mutate()} disabled={manualMatch.isPending}>Save Match</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Import Bank Statement</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Filename / statement label" value={importForm.filename} onChange={e => setImportForm(f => ({ ...f, filename: e.target.value }))} />
            <div className={`grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Statement Date</label>
                <Input type="date" value={importForm.statementDate} onChange={e => setImportForm(f => ({ ...f, statementDate: e.target.value }))} />
              </div>
              {isMobile ? null : <div />}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Opening Balance ($)</label>
                <Input type="number" step="0.01" value={importForm.openingBalance} onChange={e => setImportForm(f => ({ ...f, openingBalance: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Closing Balance ($)</label>
                <Input type="number" step="0.01" value={importForm.closingBalance} onChange={e => setImportForm(f => ({ ...f, closingBalance: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Upload CSV File (Date, Description, Amount columns)</label>
              <label className="flex items-center gap-2 cursor-pointer border border-dashed rounded-md p-3 hover:bg-muted/30 transition-colors">
                <FileUp className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground">Click to select a .csv file</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleCsvFileUpload(file);
                    e.target.value = "";
                  }}
                />
              </label>
              {csvParseError && (
                <div className="flex items-center gap-1.5 text-xs text-red-600 mt-1">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {csvParseError}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                Transactions (JSON — auto-filled from CSV upload, or enter manually). Format: <code className="text-xs">[{"{"}date, description, amount{"}"}]</code>
              </label>
              <Textarea placeholder='[{"date":"2026-03-01","description":"Payment from Unit 1","amount":-250.00}]' value={importForm.transactions} onChange={e => setImportForm(f => ({ ...f, transactions: e.target.value }))} rows={4} className="font-mono text-xs" />
            </div>
            <div className={`gap-2 ${isMobile ? "grid grid-cols-1" : "flex justify-end"}`}>
              <Button className={isMobile ? "w-full" : undefined} variant="outline" onClick={() => setImportDialogOpen(false)}>Cancel</Button>
              <Button className={isMobile ? "w-full" : undefined} onClick={() => createImport.mutate()} disabled={createImport.isPending}>Import</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
