import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Budget, BudgetLine, BudgetVersion, FinancialAccount, FinancialCategory } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useActiveAssociation } from "@/hooks/use-active-association";
import { ChevronRight, Plus, CheckCircle2, FileText } from "lucide-react";
import { FinanceTabBar } from "@/components/finance-tab-bar";
import { WorkspacePageHeader } from "@/components/workspace-page-header";

type BudgetVarianceRow = {
  budgetLineId: string;
  lineItemName: string;
  plannedAmount: number;
  actualAmount: number;
  varianceAmount: number;
  accountId: string | null;
  categoryId: string | null;
};

function budgetStatusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (status === "ratified") return "default";
  if (status === "proposed") return "secondary";
  if (status === "archived") return "outline";
  return "secondary"; // draft
}

export default function FinancialBudgetsPage() {
  const { toast } = useToast();
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();

  const [budgetId, setBudgetId] = useState("");
  const [versionId, setVersionId] = useState("");

  const [openBudget, setOpenBudget] = useState(false);
  const [openVersion, setOpenVersion] = useState(false);
  const [openLine, setOpenLine] = useState(false);

  const [budgetForm, setBudgetForm] = useState({ name: "", fiscalYear: String(new Date().getFullYear()), periodStart: "", periodEnd: "" });
  const [versionForm, setVersionForm] = useState({ versionNumber: "1", status: "draft", notes: "" });
  const [lineForm, setLineForm] = useState({ lineItemName: "", plannedAmount: "0", accountId: "", categoryId: "", sortOrder: "0" });

  const assocId = activeAssociationId;

  useEffect(() => {
    setBudgetId("");
    setVersionId("");
  }, [activeAssociationId]);

  const { data: accounts } = useQuery<FinancialAccount[]>({ queryKey: ["/api/financial/accounts"] });
  const { data: categories } = useQuery<FinancialCategory[]>({ queryKey: ["/api/financial/categories"] });
  const budgetsQuery = useQuery<Budget[]>({
    queryKey: ["/api/financial/budgets", assocId || "none"],
    queryFn: async () => {
      const q = assocId ? `?associationId=${assocId}` : "";
      const res = await apiRequest("GET", `/api/financial/budgets${q}`);
      return res.json();
    },
  });

  // Auto-select the first budget when list loads
  useEffect(() => {
    const budgets = budgetsQuery.data ?? [];
    if (budgets.length > 0 && !budgetId) {
      setBudgetId(budgets[0].id);
    }
  }, [budgetsQuery.data, budgetId]);

  const versionsQuery = useQuery<BudgetVersion[]>({
    queryKey: ["/api/financial/budgets", budgetId, "versions"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/financial/budgets/${budgetId}/versions`);
      return res.json();
    },
    enabled: Boolean(budgetId),
  });

  // Auto-select the first version when versions load
  useEffect(() => {
    const versions = versionsQuery.data ?? [];
    if (versions.length > 0 && !versionId) {
      setVersionId(versions[0].id);
    }
  }, [versionsQuery.data, versionId]);

  const linesQuery = useQuery<BudgetLine[]>({
    queryKey: ["/api/financial/budget-versions", versionId, "lines"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/financial/budget-versions/${versionId}/lines`);
      return res.json();
    },
    enabled: Boolean(versionId),
  });

  const varianceQuery = useQuery<BudgetVarianceRow[]>({
    queryKey: ["/api/financial/budgets", assocId, "variance", versionId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/financial/budgets/${assocId}/variance/${versionId}`);
      return res.json();
    },
    enabled: Boolean(assocId && versionId),
  });

  const analyticsQuery = useQuery<{
    reserveProjection: {
      currentReserveBalance: number;
      annualReserveContributions: number;
      annualReserveExpenses: number;
      annualSpecialAssessmentContribution: number;
      forecastWindows: Array<{ months: number; projectedEndingBalance: number; projectedNetChange: number }>;
    };
    expenseCategoryTrend: {
      categories: Array<{ categoryId: string | null; categoryName: string; actualAmount: number; plannedAmount: number; varianceAmount: number }>;
    };
  }>({
    queryKey: [assocId ? `/api/admin/analytics?days=30&associationId=${assocId}` : "/api/admin/analytics?days=30"],
  });

  const createBudget = useMutation({
    mutationFn: async () => {
      if (!assocId) throw new Error("Association is required");
      const payload = {
        associationId: assocId,
        name: budgetForm.name,
        fiscalYear: Number(budgetForm.fiscalYear),
        periodStart: new Date(budgetForm.periodStart).toISOString(),
        periodEnd: new Date(budgetForm.periodEnd).toISOString(),
      };
      const res = await apiRequest("POST", "/api/financial/budgets", payload);
      return res.json();
    },
    onSuccess: (budget: Budget) => {
      queryClient.invalidateQueries({ queryKey: ["/api/financial/budgets"] });
      setOpenBudget(false);
      setBudgetForm({ name: "", fiscalYear: String(new Date().getFullYear()), periodStart: "", periodEnd: "" });
      setBudgetId(budget.id);
      setVersionId("");
      toast({ title: "Budget created" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createVersion = useMutation({
    mutationFn: async () => {
      if (!budgetId) throw new Error("Select a budget first");
      const payload = {
        budgetId,
        versionNumber: Number(versionForm.versionNumber),
        status: versionForm.status,
        notes: versionForm.notes || null,
      };
      const res = await apiRequest("POST", "/api/financial/budget-versions", payload);
      return res.json();
    },
    onSuccess: (version: BudgetVersion) => {
      queryClient.invalidateQueries({ queryKey: ["/api/financial/budgets", budgetId, "versions"] });
      setOpenVersion(false);
      setVersionId(version.id);
      toast({ title: "Budget version created" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createLine = useMutation({
    mutationFn: async () => {
      if (!versionId) throw new Error("Select a version first");
      const payload = {
        budgetVersionId: versionId,
        lineItemName: lineForm.lineItemName,
        plannedAmount: Number(lineForm.plannedAmount),
        accountId: lineForm.accountId || null,
        categoryId: lineForm.categoryId || null,
        sortOrder: Number(lineForm.sortOrder),
      };
      const res = await apiRequest("POST", "/api/financial/budget-lines", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/financial/budget-versions", versionId, "lines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financial/budgets", assocId, "variance", versionId] });
      setOpenLine(false);
      setLineForm({ lineItemName: "", plannedAmount: "0", accountId: "", categoryId: "", sortOrder: "0" });
      toast({ title: "Budget line added" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateVersionStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/financial/budget-versions/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/financial/budgets", budgetId, "versions"] });
      toast({ title: "Budget version status updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const budgetTotals = useMemo(() => {
    const rows = varianceQuery.data ?? [];
    return rows.reduce(
      (acc, row) => {
        acc.planned += row.plannedAmount;
        acc.actual += row.actualAmount;
        acc.variance += row.varianceAmount;
        return acc;
      },
      { planned: 0, actual: 0, variance: 0 },
    );
  }, [varianceQuery.data]);

  const selectedBudget = (budgetsQuery.data ?? []).find((b) => b.id === budgetId);
  const selectedVersion = (versionsQuery.data ?? []).find((v) => v.id === versionId);

  return (
    <div className="flex flex-col min-h-0">
      <FinanceTabBar />
      <div className="p-6 space-y-6">
      <WorkspacePageHeader
        title="Budgets"
        summary="Create and manage association budgets, track versions, and monitor budget vs. actual variance."
        eyebrow="Finance"
        breadcrumbs={[{ label: "Finance", href: "/app/financial/foundation" }, { label: "Budgets" }]}
      />

      {/* Association context breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{activeAssociationName || "No association selected"}</span>
        {selectedBudget && (
          <>
            <ChevronRight className="h-4 w-4" />
            <span className="font-medium text-foreground">{selectedBudget.name} ({selectedBudget.fiscalYear})</span>
          </>
        )}
        {selectedVersion && (
          <>
            <ChevronRight className="h-4 w-4" />
            <Badge variant={budgetStatusVariant(selectedVersion.status)}>
              v{selectedVersion.versionNumber} · {selectedVersion.status}
            </Badge>
          </>
        )}
      </div>

      {/* Budget selection cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Budgets</h2>
          <Dialog open={openBudget} onOpenChange={setOpenBudget}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" disabled={!assocId}>
                <Plus className="h-4 w-4 mr-1" /> New Budget
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Budget</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Budget name</label>
                  <Input placeholder="e.g. FY2026 Operating Budget" value={budgetForm.name} onChange={(e) => setBudgetForm((s) => ({ ...s, name: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Fiscal year</label>
                  <Input type="number" value={budgetForm.fiscalYear} onChange={(e) => setBudgetForm((s) => ({ ...s, fiscalYear: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Start date</label>
                    <Input type="date" value={budgetForm.periodStart} onChange={(e) => setBudgetForm((s) => ({ ...s, periodStart: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">End date</label>
                    <Input type="date" value={budgetForm.periodEnd} onChange={(e) => setBudgetForm((s) => ({ ...s, periodEnd: e.target.value }))} />
                  </div>
                </div>
                <Button className="w-full" onClick={() => createBudget.mutate()} disabled={createBudget.isPending || !budgetForm.name}>
                  {createBudget.isPending ? "Saving…" : "Save Budget"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {budgetsQuery.data?.length === 0 && !budgetsQuery.isLoading && (
          <div className="rounded-lg border border-dashed p-6 text-center space-y-2">
            <p className="font-medium text-sm">No budgets yet</p>
            <p className="text-sm text-muted-foreground">To get started: <strong>1.</strong> Create a Budget → <strong>2.</strong> Add a Version → <strong>3.</strong> Add Line Items</p>
          </div>
        )}
        {(budgetsQuery.data?.length ?? 0) > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(budgetsQuery.data ?? []).map((b) => (
              <button
                key={b.id}
                onClick={() => { setBudgetId(b.id); setVersionId(""); }}
                className={cn(
                  "text-left rounded-lg border p-4 transition-colors hover:bg-accent",
                  b.id === budgetId ? "border-primary bg-primary/5 ring-1 ring-primary" : "",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">{b.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">FY{b.fiscalYear}</p>
                  </div>
                  {b.id === budgetId && <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />}
                </div>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Version selection */}
      {budgetId && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Versions</h2>
            <Dialog open={openVersion} onOpenChange={setOpenVersion}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-1" /> New Version
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create Budget Version</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Version number</label>
                    <Input type="number" value={versionForm.versionNumber} onChange={(e) => setVersionForm((s) => ({ ...s, versionNumber: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Status</label>
                    <Select value={versionForm.status} onValueChange={(v) => setVersionForm((s) => ({ ...s, status: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="proposed">Proposed</SelectItem>
                        <SelectItem value="ratified">Ratified</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Notes (optional)</label>
                    <Input placeholder="e.g. Board-approved revision" value={versionForm.notes} onChange={(e) => setVersionForm((s) => ({ ...s, notes: e.target.value }))} />
                  </div>
                  <Button className="w-full" onClick={() => createVersion.mutate()} disabled={createVersion.isPending}>
                    {createVersion.isPending ? "Saving…" : "Save Version"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {versionsQuery.data?.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No versions yet. Create a version to add line items.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(versionsQuery.data ?? []).map((v) => (
                <button
                  key={v.id}
                  onClick={() => setVersionId(v.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors hover:bg-accent",
                    v.id === versionId ? "border-primary bg-primary/5 ring-1 ring-primary font-medium" : "",
                  )}
                >
                  v{v.versionNumber}
                  <Badge variant={budgetStatusVariant(v.status)}>{v.status}</Badge>
                </button>
              ))}
            </div>
          )}

          {selectedVersion && (
            <div className="flex gap-2 mt-3">
              {selectedVersion.status !== "proposed" && selectedVersion.status !== "ratified" && (
                <Button size="sm" variant="outline" onClick={() => updateVersionStatus.mutate({ id: versionId, status: "proposed" })}>
                  Mark Proposed
                </Button>
              )}
              {selectedVersion.status !== "ratified" && (
                <Button size="sm" onClick={() => updateVersionStatus.mutate({ id: versionId, status: "ratified" })}>
                  Mark Ratified
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Budget lines */}
      {versionId && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Budget Lines</CardTitle>
              <Dialog open={openLine} onOpenChange={setOpenLine}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-1" /> Add Line
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Budget Line</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Line item name</label>
                      <Input placeholder="e.g. Landscaping, Insurance, Reserve Contribution" value={lineForm.lineItemName} onChange={(e) => setLineForm((s) => ({ ...s, lineItemName: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Planned amount ($)</label>
                      <Input type="number" step="0.01" value={lineForm.plannedAmount} onChange={(e) => setLineForm((s) => ({ ...s, plannedAmount: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Account (optional)</label>
                      <Select value={lineForm.accountId || "none"} onValueChange={(v) => setLineForm((s) => ({ ...s, accountId: v === "none" ? "" : v }))}>
                        <SelectTrigger><SelectValue placeholder="No account" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No account</SelectItem>
                          {(accounts ?? []).filter((a) => !assocId || a.associationId === assocId).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Category (optional)</label>
                      <Select value={lineForm.categoryId || "none"} onValueChange={(v) => setLineForm((s) => ({ ...s, categoryId: v === "none" ? "" : v }))}>
                        <SelectTrigger><SelectValue placeholder="No category" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No category</SelectItem>
                          {(categories ?? []).filter((c) => !assocId || c.associationId === assocId).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button className="w-full" onClick={() => createLine.mutate()} disabled={createLine.isPending || !lineForm.lineItemName}>
                      {createLine.isPending ? "Saving…" : "Add Line"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Line Item</TableHead>
                  <TableHead>Planned</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Category</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(linesQuery.data ?? []).map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.lineItemName}</TableCell>
                    <TableCell>${l.plannedAmount.toFixed(2)}</TableCell>
                    <TableCell className="text-muted-foreground">{accounts?.find((a) => a.id === l.accountId)?.name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{categories?.find((c) => c.id === l.categoryId)?.name || "—"}</TableCell>
                  </TableRow>
                ))}
                {!linesQuery.data?.length ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No budget lines yet. Add lines to track planned spending.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Variance table */}
      {versionId && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Budget vs. Actual Variance</CardTitle>
              <div className="flex gap-4 text-sm">
                <span>Planned: <strong>${budgetTotals.planned.toFixed(2)}</strong></span>
                <span>Actual: <strong>${budgetTotals.actual.toFixed(2)}</strong></span>
                <span className={cn("font-semibold", budgetTotals.variance < 0 ? "text-red-600" : "text-green-600")}>
                  Variance: ${budgetTotals.variance.toFixed(2)}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Line Item</TableHead>
                  <TableHead>Planned</TableHead>
                  <TableHead>Actual</TableHead>
                  <TableHead>Variance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(varianceQuery.data ?? []).map((row) => (
                  <TableRow key={row.budgetLineId}>
                    <TableCell>{row.lineItemName}</TableCell>
                    <TableCell>${row.plannedAmount.toFixed(2)}</TableCell>
                    <TableCell>${row.actualAmount.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={row.varianceAmount < 0 ? "destructive" : "default"}>
                        {row.varianceAmount < 0 ? "−" : "+"}${Math.abs(row.varianceAmount).toFixed(2)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {!varianceQuery.data?.length ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                      No variance data yet. Add budget lines and post expenses to see comparisons.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Reserve fund projection */}
      <div className="grid gap-4 lg:grid-cols-[0.95fr,1.05fr]">
        <Card>
          <CardContent className="p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Reserve Fund Projection</h2>
              <p className="text-sm text-muted-foreground">
                Heuristic forecast based on reserve-designated budget lines and active special assessments.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Current Reserve Baseline</div>
                <div className="text-xl font-semibold">${(analyticsQuery.data?.reserveProjection.currentReserveBalance ?? 0).toFixed(2)}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Annual Contributions</div>
                <div className="text-xl font-semibold">${(analyticsQuery.data?.reserveProjection.annualReserveContributions ?? 0).toFixed(2)}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Annual Reserve Expenses</div>
                <div className="text-xl font-semibold">${(analyticsQuery.data?.reserveProjection.annualReserveExpenses ?? 0).toFixed(2)}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Annual Special Assessments</div>
                <div className="text-xl font-semibold">${(analyticsQuery.data?.reserveProjection.annualSpecialAssessmentContribution ?? 0).toFixed(2)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold">Projection Windows</h2>
            <div className="mt-4 space-y-2">
              {(analyticsQuery.data?.reserveProjection.forecastWindows ?? []).map((window) => (
                <div key={window.months} className="grid grid-cols-[110px,1fr,1fr] gap-3 rounded-md border p-3 text-sm">
                  <div className="font-medium">{window.months} months</div>
                  <div>
                    <div className="text-xs text-muted-foreground">Net Change</div>
                    <div className={cn(window.projectedNetChange < 0 ? "text-red-600" : "text-green-700")}>${window.projectedNetChange.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Ending Balance</div>
                    <div className="font-medium">${window.projectedEndingBalance.toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expense category trend */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4">Expense Category Trend</h2>
          <div className="space-y-2">
            {(analyticsQuery.data?.expenseCategoryTrend.categories ?? []).map((row) => (
              <div key={row.categoryId ?? row.categoryName} className="grid grid-cols-[1.2fr,1fr,1fr,1fr] gap-3 rounded-md border p-3 text-sm">
                <div className="font-medium">{row.categoryName}</div>
                <div>
                  <div className="text-xs text-muted-foreground">Actual</div>
                  <div>${row.actualAmount.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Planned</div>
                  <div>${row.plannedAmount.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Variance</div>
                  <div className={cn(row.varianceAmount < 0 ? "text-red-600" : "text-foreground")}>
                    ${row.varianceAmount.toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
            {(analyticsQuery.data?.expenseCategoryTrend.categories ?? []).length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                No category-linked expense activity found for the selected scope.
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
