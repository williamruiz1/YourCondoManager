// zone: Financials
// persona: Manager, Board Officer, Assisted Board, PM Assistant
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import type { FinancialAccount, FinancialCategory, FinancialApproval } from "@shared/schema";
import { Textarea } from "@/components/ui/textarea";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useActiveAssociation } from "@/hooks/use-active-association";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { financeSubPages } from "@/lib/sub-page-nav";
import { AssociationScopeBanner } from "@/components/association-scope-banner";
import { useIsMobile } from "@/hooks/use-mobile";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssessmentRulesBanner } from "@/components/assessment-rules-banner";
import { FinancialRecurringChargesContent } from "./financial-recurring-charges";

const accountSchema = z.object({
  associationId: z.string().min(1),
  name: z.string().min(1),
  accountCode: z.string().optional(),
  accountType: z.string().min(1),
});

const categorySchema = z.object({
  associationId: z.string().min(1),
  name: z.string().min(1),
  categoryType: z.string().min(1),
});

export function FinancialFoundationContent() {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [openAccount, setOpenAccount] = useState(false);
  const [openCategory, setOpenCategory] = useState(false);
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();

  // Approval dialog state
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [approvalForm, setApprovalForm] = useState({ changeType: "budget-amendment", changeDescription: "", changeAmount: "", notes: "" });
  const [approvalStatusFilter, setApprovalStatusFilter] = useState<"pending" | "all">("pending");

  const { data: accounts, isLoading: accountsLoading } = useQuery<FinancialAccount[]>({
    queryKey: ["/api/financial/accounts", activeAssociationId],
    queryFn: async () => {
      const params = activeAssociationId ? `?associationId=${activeAssociationId}` : "";
      const res = await apiRequest("GET", `/api/financial/accounts${params}`);
      return res.json();
    },
  });
  const { data: categories, isLoading: categoriesLoading } = useQuery<FinancialCategory[]>({
    queryKey: ["/api/financial/categories", activeAssociationId],
    queryFn: async () => {
      const params = activeAssociationId ? `?associationId=${activeAssociationId}` : "";
      const res = await apiRequest("GET", `/api/financial/categories${params}`);
      return res.json();
    },
  });

  const { data: approvals = [], refetch: refetchApprovals, isLoading: approvalsLoading } = useQuery<FinancialApproval[]>({
    queryKey: ["/api/financial/approvals", activeAssociationId, approvalStatusFilter],
    queryFn: async () => {
      if (!activeAssociationId) return [];
      const status = approvalStatusFilter !== "all" ? `&status=${approvalStatusFilter}` : "";
      const res = await apiRequest("GET", `/api/financial/approvals?associationId=${activeAssociationId}${status}`);
      return res.json();
    },
    enabled: Boolean(activeAssociationId),
  });

  const accountForm = useForm<z.infer<typeof accountSchema>>({
    resolver: zodResolver(accountSchema),
    defaultValues: { associationId: "", name: "", accountCode: "", accountType: "expense" },
  });

  const categoryForm = useForm<z.infer<typeof categorySchema>>({
    resolver: zodResolver(categorySchema),
    defaultValues: { associationId: "", name: "", categoryType: "expense" },
  });

  useEffect(() => {
    accountForm.setValue("associationId", activeAssociationId, { shouldValidate: true });
    categoryForm.setValue("associationId", activeAssociationId, { shouldValidate: true });
  }, [accountForm, activeAssociationId, categoryForm]);

  const createAccount = useMutation({
    mutationFn: async (values: z.infer<typeof accountSchema>) => {
      const res = await apiRequest("POST", "/api/financial/accounts", { ...values, isActive: 1 });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/financial/accounts"] });
      setOpenAccount(false);
      accountForm.reset({ associationId: activeAssociationId, name: "", accountCode: "", accountType: "expense" });
      toast({ title: "Account created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createCategory = useMutation({
    mutationFn: async (values: z.infer<typeof categorySchema>) => {
      const res = await apiRequest("POST", "/api/financial/categories", { ...values, isActive: 1 });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/financial/categories"] });
      setOpenCategory(false);
      categoryForm.reset({ associationId: activeAssociationId, name: "", categoryType: "expense" });
      toast({ title: "Category created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createApproval = useMutation({
    mutationFn: async () => {
      if (!activeAssociationId) throw new Error("No association selected");
      const res = await apiRequest("POST", "/api/financial/approvals", {
        associationId: activeAssociationId,
        changeType: approvalForm.changeType,
        changeDescription: approvalForm.changeDescription,
        changeAmount: approvalForm.changeAmount ? Number(approvalForm.changeAmount) : null,
        changePayloadJson: { notes: approvalForm.notes },
      });
      return res.json();
    },
    onSuccess: async () => {
      await refetchApprovals();
      setApprovalDialogOpen(false);
      setApprovalForm({ changeType: "budget-amendment", changeDescription: "", changeAmount: "", notes: "" });
      toast({ title: "Approval request submitted" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const resolveApproval = useMutation({
    mutationFn: async ({ id, status, resolverNotes }: { id: string; status: "approved" | "rejected" | "cancelled"; resolverNotes?: string }) => {
      const res = await apiRequest("PATCH", `/api/financial/approvals/${id}`, { status, resolverNotes });
      return res.json();
    },
    onSuccess: async () => {
      await refetchApprovals();
      toast({ title: "Approval updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <AssociationScopeBanner
        activeAssociationId={activeAssociationId}
        activeAssociationName={activeAssociationName}
        explanation="Accounts and categories are scoped to the active association. Select one to manage its chart of accounts."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Accounts</h2>
              <Dialog open={openAccount} onOpenChange={setOpenAccount}>
                <DialogTrigger asChild><Button size="sm">Add Account</Button></DialogTrigger>
                <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-h-[85vh]">
                  <DialogHeader><DialogTitle>Create Account</DialogTitle></DialogHeader>
                  <Form {...accountForm}>
                    <form className="space-y-4" onSubmit={accountForm.handleSubmit((v) => createAccount.mutate(v))}>
                      <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                        Association Context: <span className="font-medium">{activeAssociationName || "None selected"}</span>
                      </div>
                      <FormField control={accountForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input className={isMobile ? "min-h-11" : undefined} {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={accountForm.control} name="accountCode" render={({ field }) => (<FormItem><FormLabel>Code</FormLabel><FormControl><Input className={isMobile ? "min-h-11" : undefined} {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={accountForm.control} name="accountType" render={({ field }) => (
                        <FormItem><FormLabel>Type</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger className={isMobile ? "min-h-11" : undefined}><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="expense">expense</SelectItem><SelectItem value="income">income</SelectItem><SelectItem value="asset">asset</SelectItem><SelectItem value="liability">liability</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                      )} />
                      <Button className="w-full" type="submit" disabled={createAccount.isPending}>Save</Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
            {accountsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="rounded-xl border p-4 space-y-3">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                ))}
              </div>
            ) : (accounts ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <p className="text-sm">No accounts yet. Add your first account to begin.</p>
              </div>
            ) : isMobile ? (
              <div className="space-y-3">
                {(accounts ?? []).map((a) => (
                  <div key={a.id} className="rounded-xl border p-4 space-y-2">
                    <div className="text-sm font-medium">{a.name}</div>
                    <div className="text-xs text-muted-foreground">Code: {a.accountCode || "-"}</div>
                    <Badge variant="secondary">{a.accountType}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Type</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(accounts ?? []).map((a) => (
                    <TableRow key={a.id}><TableCell>{a.name}</TableCell><TableCell>{a.accountCode || "-"}</TableCell><TableCell><Badge variant="secondary">{a.accountType}</Badge></TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Categories</h2>
              <Dialog open={openCategory} onOpenChange={setOpenCategory}>
                <DialogTrigger asChild><Button size="sm">Add Category</Button></DialogTrigger>
                <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-h-[85vh]">
                  <DialogHeader><DialogTitle>Create Category</DialogTitle></DialogHeader>
                  <Form {...categoryForm}>
                    <form className="space-y-4" onSubmit={categoryForm.handleSubmit((v) => createCategory.mutate(v))}>
                      <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                        Association Context: <span className="font-medium">{activeAssociationName || "None selected"}</span>
                      </div>
                      <FormField control={categoryForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input className={isMobile ? "min-h-11" : undefined} {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={categoryForm.control} name="categoryType" render={({ field }) => (
                        <FormItem><FormLabel>Type</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger className={isMobile ? "min-h-11" : undefined}><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="expense">expense</SelectItem><SelectItem value="income">income</SelectItem><SelectItem value="charge">charge</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                      )} />
                      <Button className="w-full" type="submit" disabled={createCategory.isPending}>Save</Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
            {categoriesLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="rounded-xl border p-4 space-y-3">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                ))}
              </div>
            ) : (categories ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <p className="text-sm">No categories yet. Add your first category to begin.</p>
              </div>
            ) : isMobile ? (
              <div className="space-y-3">
                {(categories ?? []).map((c) => (
                  <div key={c.id} className="rounded-xl border p-4 space-y-2">
                    <div className="text-sm font-medium">{c.name}</div>
                    <Badge variant="secondary">{c.categoryType}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(categories ?? []).map((c) => (
                    <TableRow key={c.id}><TableCell>{c.name}</TableCell><TableCell><Badge variant="secondary">{c.categoryType}</Badge></TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Two-person approval workflow */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-base font-semibold">Financial Change Approvals</h2>
              <p className="text-sm text-muted-foreground">Two-person approval required for material financial changes (budget amendments, large disbursements, reserve transfers).</p>
            </div>
            <div className={`gap-2 ${isMobile ? "grid w-full grid-cols-1" : "flex items-center"}`}>
              <div className={`gap-1 ${isMobile ? "grid grid-cols-2" : "flex"}`}>
                {(["pending", "all"] as const).map((f) => (
                  <Button
                    key={f}
                    size="sm"
                    variant={approvalStatusFilter === f ? "default" : "outline"}
                    className={isMobile ? "min-h-11 text-sm" : "h-7 text-xs"}
                    onClick={() => setApprovalStatusFilter(f)}
                  >
                    {f === "pending" ? "Pending" : "All"}
                  </Button>
                ))}
              </div>
              <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className={isMobile ? "min-h-11 w-full" : undefined} disabled={!activeAssociationId}>Request Approval</Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-h-[85vh]">
                  <DialogHeader><DialogTitle>Submit Financial Change for Approval</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Change type</label>
                      <Select value={approvalForm.changeType} onValueChange={(v) => setApprovalForm((f) => ({ ...f, changeType: v }))}>
                        <SelectTrigger className={isMobile ? "min-h-11" : undefined}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="budget-amendment">Budget amendment</SelectItem>
                          <SelectItem value="large-disbursement">Large disbursement</SelectItem>
                          <SelectItem value="reserve-transfer">Reserve transfer</SelectItem>
                          <SelectItem value="special-assessment">Special assessment</SelectItem>
                          <SelectItem value="vendor-contract">Vendor contract</SelectItem>
                          <SelectItem value="other">Other material change</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Description *</label>
                      <Textarea className={isMobile ? "min-h-28" : undefined} placeholder="Describe the financial change being proposed..." value={approvalForm.changeDescription} onChange={(e) => setApprovalForm((f) => ({ ...f, changeDescription: e.target.value }))} rows={3} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Amount ($)</label>
                      <Input className={isMobile ? "min-h-11" : undefined} type="number" placeholder="0.00" value={approvalForm.changeAmount} onChange={(e) => setApprovalForm((f) => ({ ...f, changeAmount: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Additional notes</label>
                      <Input className={isMobile ? "min-h-11" : undefined} placeholder="Optional context..." value={approvalForm.notes} onChange={(e) => setApprovalForm((f) => ({ ...f, notes: e.target.value }))} />
                    </div>
                    <div className={`gap-2 ${isMobile ? "grid grid-cols-1" : "flex justify-end"}`}>
                      <Button className={isMobile ? "w-full" : undefined} variant="outline" onClick={() => setApprovalDialogOpen(false)}>Cancel</Button>
                      <Button className={isMobile ? "w-full" : undefined} onClick={() => createApproval.mutate()} disabled={!approvalForm.changeDescription.trim() || createApproval.isPending}>Submit Request</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          {approvalsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="rounded-xl border p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <div className="grid grid-cols-2 gap-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : isMobile ? (
            <div className="space-y-3">
              {approvals.map((approval) => (
                <div key={approval.id} className="rounded-xl border p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <Badge variant="outline">{approval.changeType}</Badge>
                    <Badge variant={approval.status === "pending" ? "secondary" : approval.status === "approved" ? "outline" : "destructive"}>{approval.status}</Badge>
                  </div>
                  <div className="text-sm">{approval.changeDescription}</div>
                  {approval.resolverNotes ? <div className="text-xs text-muted-foreground">Note: {approval.resolverNotes}</div> : null}
                  <div className="grid gap-2 text-xs text-muted-foreground">
                    <div>Amount: {approval.changeAmount != null ? `$${approval.changeAmount.toFixed(2)}` : "-"}</div>
                    <div>Requested by: {approval.requestedBy}</div>
                  </div>
                  {approval.status === "pending" ? (
                    <div className="grid grid-cols-2 gap-2">
                      <Button size="sm" variant="outline" onClick={() => resolveApproval.mutate({ id: approval.id, status: "approved" })} disabled={resolveApproval.isPending}>Approve</Button>
                      <Button size="sm" variant="outline" onClick={() => resolveApproval.mutate({ id: approval.id, status: "rejected" })} disabled={resolveApproval.isPending}>Reject</Button>
                    </div>
                  ) : null}
                </div>
              ))}
              {approvals.length === 0 ? (
                <div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">No {approvalStatusFilter === "pending" ? "pending" : ""} approval requests.</div>
              ) : null}
            </div>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Requested By</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {approvals.map((approval) => (
                <TableRow key={approval.id}>
                  <TableCell><Badge variant="outline">{approval.changeType}</Badge></TableCell>
                  <TableCell className="max-w-xs">
                    <div className="text-sm line-clamp-2">{approval.changeDescription}</div>
                    {approval.resolverNotes && <div className="text-xs text-muted-foreground mt-0.5">Note: {approval.resolverNotes}</div>}
                  </TableCell>
                  <TableCell>{approval.changeAmount != null ? `$${approval.changeAmount.toFixed(2)}` : "-"}</TableCell>
                  <TableCell className="text-sm">{approval.requestedBy}</TableCell>
                  <TableCell>
                    <Badge variant={approval.status === "pending" ? "secondary" : approval.status === "approved" ? "outline" : "destructive"}>{approval.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {approval.status === "pending" && (
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => resolveApproval.mutate({ id: approval.id, status: "approved" })} disabled={resolveApproval.isPending}>Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => resolveApproval.mutate({ id: approval.id, status: "rejected" })} disabled={resolveApproval.isPending}>Reject</Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {approvals.length === 0 && (
                <TableRow><TableCell colSpan={6} className="h-16 text-center text-muted-foreground">No {approvalStatusFilter === "pending" ? "pending" : ""} approval requests.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>

      {/* Forward guidance */}
      <Card className="border-dashed">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0 mt-0.5">
              <ArrowRight className="h-4 w-4" />
            </div>
            <div>
              <div className="font-semibold text-sm">Chart of Accounts set up? Next: Fee Schedules</div>
              <div className="text-sm text-muted-foreground mt-0.5">
                Configure recurring charges to automatically post to owner ledgers each month.
              </div>
              <Link href="/app/financial/recurring-charges" className="inline-flex items-center gap-1 mt-2 text-sm text-primary hover:underline font-medium">
                Go to Fee Schedules <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

type AccountActivityRow = {
  accountId: string;
  accountCode: string | null;
  accountName: string;
  accountType: string;
  isActive: number;
  budgetedAmount: number;
  invoicedAmount: number;
  variance: number;
  utilizationPct: number | null;
  invoiceCount: number;
};

type AccountActivityResponse = {
  associationId: string;
  accounts: AccountActivityRow[];
  totals: {
    budgetedAmount: number;
    invoicedAmount: number;
    variance: number;
    utilizationPct: number | null;
  };
  meta: {
    activeBudgetCount: number;
    totalAccounts: number;
    totalCountableInvoices: number;
  };
};

function formatCurrency(amount: number): string {
  return amount.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function utilizationVariant(pct: number | null): "default" | "secondary" | "destructive" {
  if (pct === null) return "secondary";
  if (pct > 100) return "destructive";
  if (pct >= 90) return "default";
  return "secondary";
}

export function AccountActivityContent() {
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();

  const { data, isLoading, isError, error } = useQuery<AccountActivityResponse>({
    queryKey: ["/api/financial/accounts/activity", activeAssociationId],
    queryFn: async () => {
      if (!activeAssociationId) throw new Error("No active association");
      const res = await apiRequest("GET", `/api/financial/accounts/activity?associationId=${activeAssociationId}`);
      return res.json();
    },
    enabled: Boolean(activeAssociationId),
  });

  if (!activeAssociationId) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Select an active association to view account activity.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6" data-testid="section-account-activity">
      <Card>
        <CardHeader>
          <CardTitle>Account Activity</CardTitle>
          <CardDescription>
            Budget vs. committed invoices, rolled up by chart-of-accounts entry for{" "}
            <strong>{activeAssociationName || "this association"}</strong>. Counts approved and paid vendor invoices against the latest ratified budget version.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading && (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          )}
          {isError && (
            <p className="text-sm text-destructive" data-testid="text-account-activity-error">
              Failed to load account activity: {(error as Error)?.message ?? "Unknown error"}
            </p>
          )}
          {!isLoading && !isError && data && data.accounts.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-account-activity-empty">
              No accounts configured. Add accounts on the Accounts tab to see activity here.
            </p>
          )}
          {!isLoading && !isError && data && data.accounts.length > 0 && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Total Budgeted</p>
                  <p className="text-xl font-bold mt-1" data-testid="text-totals-budgeted">{formatCurrency(data.totals.budgetedAmount)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Total Invoiced</p>
                  <p className="text-xl font-bold mt-1" data-testid="text-totals-invoiced">{formatCurrency(data.totals.invoicedAmount)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Variance</p>
                  <p className={`text-xl font-bold mt-1 ${data.totals.variance < 0 ? "text-destructive" : ""}`} data-testid="text-totals-variance">
                    {formatCurrency(data.totals.variance)}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Utilization</p>
                  <p className="text-xl font-bold mt-1" data-testid="text-totals-utilization">
                    {data.totals.utilizationPct === null ? "—" : `${data.totals.utilizationPct.toFixed(1)}%`}
                  </p>
                </div>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Budgeted</TableHead>
                      <TableHead className="text-right">Invoiced</TableHead>
                      <TableHead className="text-right">Variance</TableHead>
                      <TableHead className="text-right">Utilization</TableHead>
                      <TableHead className="text-right">Invoices</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.accounts.map((row) => (
                      <TableRow key={row.accountId} data-testid={`row-account-activity-${row.accountId}`}>
                        <TableCell className="font-mono text-xs">{row.accountCode || "—"}</TableCell>
                        <TableCell className="font-medium">
                          {row.accountName}
                          {!row.isActive && <Badge variant="secondary" className="ml-2 text-[10px]">inactive</Badge>}
                        </TableCell>
                        <TableCell className="text-xs capitalize text-muted-foreground">{row.accountType}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(row.budgetedAmount)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(row.invoicedAmount)}</TableCell>
                        <TableCell className={`text-right tabular-nums ${row.variance < 0 ? "text-destructive font-medium" : ""}`}>
                          {formatCurrency(row.variance)}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.utilizationPct === null ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <Badge variant={utilizationVariant(row.utilizationPct)} className="tabular-nums">
                              {row.utilizationPct.toFixed(1)}%
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-xs text-muted-foreground">{row.invoiceCount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <p className="text-xs text-muted-foreground">
                Sourced from {data.meta.activeBudgetCount} ratified budget version{data.meta.activeBudgetCount === 1 ? "" : "s"} and {data.meta.totalCountableInvoices} approved/paid invoice{data.meta.totalCountableInvoices === 1 ? "" : "s"}.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function FinancialFoundationPage() {
  useDocumentTitle("Chart of Accounts");
  return (
    <div className="flex flex-col min-h-0">
      <div className="p-6 space-y-6">
        <WorkspacePageHeader
          title="Chart of Accounts"
          summary="Configure financial accounts, categories, and recurring charge schedules for the active association."
          eyebrow="Finance"
          breadcrumbs={[{ label: "Finance", href: "/app/financial/foundation" }, { label: "Chart of Accounts" }]}
          subPages={financeSubPages}
        />
        <AssessmentRulesBanner />
        <Tabs defaultValue="accounts" className="space-y-6">
          <TabsList>
            <TabsTrigger value="accounts">Accounts</TabsTrigger>
            <TabsTrigger value="account-activity">Account Activity</TabsTrigger>
            <TabsTrigger value="recurring-charges">Recurring Charges</TabsTrigger>
          </TabsList>
          <TabsContent value="accounts" className="mt-0">
            <FinancialFoundationContent />
          </TabsContent>
          <TabsContent value="account-activity" className="mt-0">
            <AccountActivityContent />
          </TabsContent>
          <TabsContent value="recurring-charges" className="mt-0">
            <FinancialRecurringChargesContent />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
