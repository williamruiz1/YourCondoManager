import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Association, Budget, BudgetLine, BudgetVersion, FinancialAccount, FinancialCategory } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useActiveAssociation } from "@/hooks/use-active-association";

type BudgetVarianceRow = {
  budgetLineId: string;
  lineItemName: string;
  plannedAmount: number;
  actualAmount: number;
  varianceAmount: number;
  accountId: string | null;
  categoryId: string | null;
};

export default function FinancialBudgetsPage() {
  const { toast } = useToast();
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();

  const [assocId, setAssocId] = useState(activeAssociationId);
  const [budgetId, setBudgetId] = useState("");
  const [versionId, setVersionId] = useState("");

  const [openBudget, setOpenBudget] = useState(false);
  const [openVersion, setOpenVersion] = useState(false);
  const [openLine, setOpenLine] = useState(false);

  const [budgetForm, setBudgetForm] = useState({ name: "", fiscalYear: String(new Date().getFullYear()), periodStart: "", periodEnd: "" });
  const [versionForm, setVersionForm] = useState({ versionNumber: "1", status: "draft", notes: "" });
  const [lineForm, setLineForm] = useState({ lineItemName: "", plannedAmount: "0", accountId: "", categoryId: "", sortOrder: "0" });

  useEffect(() => {
    setAssocId(activeAssociationId);
    setBudgetId("");
    setVersionId("");
  }, [activeAssociationId]);

  const { data: associations } = useQuery<Association[]>({ queryKey: ["/api/associations"] });
  const { data: accounts } = useQuery<FinancialAccount[]>({ queryKey: ["/api/financial/accounts"] });
  const { data: categories } = useQuery<FinancialCategory[]>({ queryKey: ["/api/financial/categories"] });
  const budgetsQuery = useQuery<Budget[]>({ queryKey: ["/api/financial/budgets", assocId || "none"], queryFn: async () => {
    const q = assocId ? `?associationId=${assocId}` : "";
    const res = await apiRequest("GET", `/api/financial/budgets${q}`);
    return res.json();
  }});

  const versionsQuery = useQuery<BudgetVersion[]>({
    queryKey: ["/api/financial/budgets", budgetId, "versions"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/financial/budgets/${budgetId}/versions`);
      return res.json();
    },
    enabled: Boolean(budgetId),
  });

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

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Budget Operations</h1>
        <p className="text-muted-foreground">Manage budget drafts, ratification workflow, and variance in the current association context.</p>
      </div>

      <Card>
        <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Association Context</p>
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <span className="font-medium">{activeAssociationName || "None selected"}</span>
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Budget</p>
            <Select value={budgetId || "none"} onValueChange={(v) => { const id = v === "none" ? "" : v; setBudgetId(id); setVersionId(""); }}>
              <SelectTrigger><SelectValue placeholder="Select budget" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">select budget</SelectItem>
                {(budgetsQuery.data ?? []).map((b) => <SelectItem key={b.id} value={b.id}>{b.name} ({b.fiscalYear})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Version</p>
            <Select value={versionId || "none"} onValueChange={(v) => setVersionId(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Select version" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">select version</SelectItem>
                {(versionsQuery.data ?? []).map((v) => <SelectItem key={v.id} value={v.id}>v{v.versionNumber} - {v.status}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[0.95fr,1.05fr]">
        <Card>
          <CardContent className="p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Reserve Fund Projection</h2>
              <p className="text-sm text-muted-foreground">
                Heuristic forecast using reserve-designated budget lines, active special assessments, and currently available financial planning records.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
                    <div>${window.projectedNetChange.toFixed(2)}</div>
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

      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold">Expense Category Trend Visualization</h2>
          <div className="mt-4 space-y-2">
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

      <div className="flex gap-2 flex-wrap">
        <Dialog open={openBudget} onOpenChange={setOpenBudget}>
          <DialogTrigger asChild><Button disabled={!assocId}>New Budget</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Budget</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Budget name" value={budgetForm.name} onChange={(e) => setBudgetForm((s) => ({ ...s, name: e.target.value }))} />
              <Input type="number" placeholder="Fiscal year" value={budgetForm.fiscalYear} onChange={(e) => setBudgetForm((s) => ({ ...s, fiscalYear: e.target.value }))} />
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={budgetForm.periodStart} onChange={(e) => setBudgetForm((s) => ({ ...s, periodStart: e.target.value }))} />
                <Input type="date" value={budgetForm.periodEnd} onChange={(e) => setBudgetForm((s) => ({ ...s, periodEnd: e.target.value }))} />
              </div>
              <Button className="w-full" onClick={() => createBudget.mutate()} disabled={createBudget.isPending}>Save Budget</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={openVersion} onOpenChange={setOpenVersion}>
          <DialogTrigger asChild><Button variant="outline" disabled={!budgetId}>New Version</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Budget Version</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input type="number" placeholder="Version number" value={versionForm.versionNumber} onChange={(e) => setVersionForm((s) => ({ ...s, versionNumber: e.target.value }))} />
              <Select value={versionForm.status} onValueChange={(v) => setVersionForm((s) => ({ ...s, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">draft</SelectItem>
                  <SelectItem value="proposed">proposed</SelectItem>
                  <SelectItem value="ratified">ratified</SelectItem>
                  <SelectItem value="archived">archived</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Notes (optional)" value={versionForm.notes} onChange={(e) => setVersionForm((s) => ({ ...s, notes: e.target.value }))} />
              <Button className="w-full" onClick={() => createVersion.mutate()} disabled={createVersion.isPending}>Save Version</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={openLine} onOpenChange={setOpenLine}>
          <DialogTrigger asChild><Button variant="outline" disabled={!versionId}>Add Budget Line</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Budget Line</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Line item" value={lineForm.lineItemName} onChange={(e) => setLineForm((s) => ({ ...s, lineItemName: e.target.value }))} />
              <Input type="number" step="0.01" placeholder="Planned amount" value={lineForm.plannedAmount} onChange={(e) => setLineForm((s) => ({ ...s, plannedAmount: e.target.value }))} />
              <Select value={lineForm.accountId || "none"} onValueChange={(v) => setLineForm((s) => ({ ...s, accountId: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Account (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">no account</SelectItem>
                  {(accounts ?? []).filter((a) => !assocId || a.associationId === assocId).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={lineForm.categoryId || "none"} onValueChange={(v) => setLineForm((s) => ({ ...s, categoryId: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Category (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">no category</SelectItem>
                  {(categories ?? []).filter((c) => !assocId || c.associationId === assocId).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="number" placeholder="Sort order" value={lineForm.sortOrder} onChange={(e) => setLineForm((s) => ({ ...s, sortOrder: e.target.value }))} />
              <Button className="w-full" onClick={() => createLine.mutate()} disabled={createLine.isPending}>Save Line</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Version Workflow</h2>
            <div className="flex gap-2">
              {versionId ? <Button size="sm" variant="outline" onClick={() => updateVersionStatus.mutate({ id: versionId, status: "proposed" })}>Mark Proposed</Button> : null}
              {versionId ? <Button size="sm" onClick={() => updateVersionStatus.mutate({ id: versionId, status: "ratified" })}>Mark Ratified</Button> : null}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {(versionsQuery.data ?? []).map((v) => (
              <Badge key={v.id} variant={v.status === "ratified" ? "default" : "secondary"}>v{v.versionNumber} {v.status}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Line</TableHead><TableHead>Planned</TableHead><TableHead>Actual</TableHead><TableHead>Variance</TableHead></TableRow></TableHeader>
            <TableBody>
              {(varianceQuery.data ?? []).map((row) => (
                <TableRow key={row.budgetLineId}>
                  <TableCell>{row.lineItemName}</TableCell>
                  <TableCell>${row.plannedAmount.toFixed(2)}</TableCell>
                  <TableCell>${row.actualAmount.toFixed(2)}</TableCell>
                  <TableCell><Badge variant={row.varianceAmount < 0 ? "destructive" : "default"}>${row.varianceAmount.toFixed(2)}</Badge></TableCell>
                </TableRow>
              ))}
              {!varianceQuery.data?.length ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No variance data yet. Add lines and expenses/invoices.</TableCell></TableRow> : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 grid grid-cols-3 gap-4">
          <div><p className="text-sm text-muted-foreground">Planned</p><p className="text-xl font-semibold">${budgetTotals.planned.toFixed(2)}</p></div>
          <div><p className="text-sm text-muted-foreground">Actual</p><p className="text-xl font-semibold">${budgetTotals.actual.toFixed(2)}</p></div>
          <div><p className="text-sm text-muted-foreground">Variance</p><p className="text-xl font-semibold">${budgetTotals.variance.toFixed(2)}</p></div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Line Item</TableHead><TableHead>Planned</TableHead><TableHead>Account</TableHead><TableHead>Category</TableHead></TableRow></TableHeader>
            <TableBody>
              {(linesQuery.data ?? []).map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{l.lineItemName}</TableCell>
                  <TableCell>${l.plannedAmount.toFixed(2)}</TableCell>
                  <TableCell>{accounts?.find((a) => a.id === l.accountId)?.name || "-"}</TableCell>
                  <TableCell>{categories?.find((c) => c.id === l.categoryId)?.name || "-"}</TableCell>
                </TableRow>
              ))}
              {!linesQuery.data?.length ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No budget lines for selected version.</TableCell></TableRow> : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
