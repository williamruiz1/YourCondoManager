// zone: Financials
// persona: Manager, Board Officer, Assisted Board, PM Assistant
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { ExpenseAttachment, FinancialAccount, FinancialCategory, Vendor, VendorInvoice } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useActiveAssociation } from "@/hooks/use-active-association";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { financeSubPages } from "@/lib/sub-page-nav";
import { AsyncStateBoundary } from "@/components/async-state-boundary";
import { DataTableShell } from "@/components/data-table-shell";
import { AlertTriangle, Ban, CheckCircle2, Clock, DollarSign, FileText } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ExportCsvButton } from "@/components/export-csv-button";
import { useIsMobile } from "@/hooks/use-mobile";

const invoiceSchema = z.object({
  associationId: z.string().min(1),
  vendorId: z.string().min(1, "Vendor is required"),
  vendorName: z.string().min(1),
  invoiceNumber: z.string().optional(),
  invoiceDate: z.string().min(1),
  dueDate: z.string().optional(),
  amount: z.coerce.number().positive(),
  status: z.enum(["draft", "received", "approved", "paid", "void"]),
  accountId: z.string().optional(),
  categoryId: z.string().optional(),
  notes: z.string().optional(),
});


export function FinancialInvoicesContent() {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [attachmentInvoiceId, setAttachmentInvoiceId] = useState<string>("");
  const [attachmentAssocId, setAttachmentAssocId] = useState<string>("");
  const [attachmentTitle, setAttachmentTitle] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("all");
  const [invoiceSortBy, setInvoiceSortBy] = useState("newest");
  const [invoicePage, setInvoicePage] = useState(1);
  const [attachmentSearch, setAttachmentSearch] = useState("");
  const [attachmentPage, setAttachmentPage] = useState(1);
  const fileRef = useRef<HTMLInputElement>(null);
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: vendors } = useQuery<Vendor[]>({ queryKey: ["/api/vendors"] });
  const { data: accounts } = useQuery<FinancialAccount[]>({ queryKey: ["/api/financial/accounts"] });
  const { data: categories } = useQuery<FinancialCategory[]>({ queryKey: ["/api/financial/categories"] });
  const { data: invoices } = useQuery<VendorInvoice[]>({ queryKey: ["/api/financial/invoices"] });
  const { data: attachments } = useQuery<ExpenseAttachment[]>({ queryKey: ["/api/financial/expense-attachments"] });

  const form = useForm<z.infer<typeof invoiceSchema>>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      associationId: "",
      vendorId: "",
      vendorName: "",
      invoiceNumber: "",
      invoiceDate: "",
      dueDate: "",
      amount: 0,
      status: "received",
      accountId: "",
      categoryId: "",
      notes: "",
    },
  });

  useEffect(() => {
    form.setValue("associationId", activeAssociationId, { shouldValidate: true });
    form.setValue("vendorId", "", { shouldValidate: false });
    form.setValue("vendorName", "", { shouldValidate: false });
    setAttachmentAssocId(activeAssociationId);
  }, [activeAssociationId, form]);

  const createInvoice = useMutation({
    mutationFn: async (v: z.infer<typeof invoiceSchema>) => {
      const payload = {
        ...v,
        invoiceDate: new Date(v.invoiceDate).toISOString(),
        dueDate: v.dueDate ? new Date(v.dueDate).toISOString() : null,
        accountId: v.accountId || null,
        categoryId: v.categoryId || null,
        notes: v.notes || null,
      };
      const res = await apiRequest("POST", "/api/financial/invoices", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/financial/invoices"] });
      setOpen(false);
      form.reset({
        associationId: activeAssociationId,
        vendorId: "",
        vendorName: "",
        invoiceNumber: "",
        invoiceDate: "",
        dueDate: "",
        amount: 0,
        status: "received",
        accountId: "",
        categoryId: "",
        notes: "",
      });
      toast({ title: "Invoice created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const uploadAttachment = useMutation({
    mutationFn: async () => {
      if (!attachmentFile || !attachmentInvoiceId || !attachmentAssocId || !attachmentTitle) {
        throw new Error("Invoice, association, title and file are required");
      }
      const fd = new FormData();
      fd.append("associationId", attachmentAssocId);
      fd.append("expenseType", "invoice");
      fd.append("expenseId", attachmentInvoiceId);
      fd.append("title", attachmentTitle);
      fd.append("file", attachmentFile);
      const res = await fetch("/api/financial/expense-attachments", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/financial/expense-attachments"] });
      setAttachmentFile(null);
      setAttachmentInvoiceId("");
      setAttachmentAssocId("");
      setAttachmentTitle("");
      toast({ title: "Attachment uploaded" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/financial/invoices/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/financial/invoices"] });
      toast({ title: "Invoice status updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const bulkApprove = useMutation({
    mutationFn: async () => {
      for (const id of Array.from(selectedIds)) {
        await apiRequest("PATCH", `/api/financial/invoices/${id}`, { status: "approved" });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/financial/invoices"] });
      toast({ title: "Invoices approved", description: `${selectedIds.size} invoice(s) marked as approved.` });
      setSelectedIds(new Set());
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const apStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const all = (invoices ?? []).filter((inv) => !activeAssociationId || inv.associationId === activeAssociationId);
    const pending = all.filter((inv) => inv.status === "received" || inv.status === "draft");
    const approved = all.filter((inv) => inv.status === "approved");
    const overdue = all.filter((inv) =>
      (inv.status === "received" || inv.status === "approved" || inv.status === "draft") &&
      inv.dueDate && new Date(inv.dueDate) < today,
    );
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const paid = all.filter((inv) => inv.status === "paid" && inv.invoiceDate && new Date(inv.invoiceDate) >= startOfMonth);
    return {
      pendingCount: pending.length,
      pendingAmount: pending.reduce((s, i) => s + Number(i.amount), 0),
      approvedAmount: approved.reduce((s, i) => s + Number(i.amount), 0),
      overdueCount: overdue.length,
      overdueAmount: overdue.reduce((s, i) => s + Number(i.amount), 0),
      paidMtdAmount: paid.reduce((s, i) => s + Number(i.amount), 0),
      paidMtdCount: paid.length,
    };
  }, [invoices, activeAssociationId]);

  const filteredInvoices = useMemo(() => {
    const term = invoiceSearch.trim().toLowerCase();
    const rows = [...(invoices ?? [])].filter((invoice) => {
      if (invoiceStatusFilter !== "all" && invoice.status !== invoiceStatusFilter) {
        return false;
      }
      if (!term) {
        return true;
      }
      return [
        invoice.vendorName,
        invoice.invoiceNumber,
        invoice.status,
        invoice.notes,
      ].some((value) => (value || "").toLowerCase().includes(term));
    });

    rows.sort((left, right) => {
      if (invoiceSortBy === "oldest") {
        return new Date(left.invoiceDate).getTime() - new Date(right.invoiceDate).getTime();
      }
      if (invoiceSortBy === "amount-desc") {
        return Number(right.amount) - Number(left.amount);
      }
      if (invoiceSortBy === "amount-asc") {
        return Number(left.amount) - Number(right.amount);
      }
      return new Date(right.invoiceDate).getTime() - new Date(left.invoiceDate).getTime();
    });

    return rows;
  }, [invoiceSearch, invoiceSortBy, invoiceStatusFilter, invoices]);

  const totalInvoicePages = Math.max(1, Math.ceil(filteredInvoices.length / 10));
  const pagedInvoices = filteredInvoices.slice((invoicePage - 1) * 10, invoicePage * 10);

  const filteredAttachments = useMemo(() => {
    const term = attachmentSearch.trim().toLowerCase();
    const invoiceMap = new Map((invoices ?? []).map((invoice) => [invoice.id, invoice]));

    return (attachments ?? []).filter((attachment) => {
      if (attachment.expenseType !== "invoice") {
        return false;
      }
      if (!term) {
        return true;
      }
      const invoice = invoiceMap.get(attachment.expenseId);
      return [
        attachment.title,
        attachment.expenseId,
        invoice?.vendorName,
        invoice?.invoiceNumber,
      ].some((value) => (value || "").toLowerCase().includes(term));
    });
  }, [attachmentSearch, attachments, invoices]);

  const totalAttachmentPages = Math.max(1, Math.ceil(filteredAttachments.length / 8));
  const pagedAttachments = filteredAttachments.slice((attachmentPage - 1) * 8, attachmentPage * 8);

  useEffect(() => {
    setInvoicePage(1);
  }, [invoiceSearch, invoiceSortBy, invoiceStatusFilter]);

  useEffect(() => {
    if (invoicePage > totalInvoicePages) {
      setInvoicePage(totalInvoicePages);
    }
  }, [invoicePage, totalInvoicePages]);

  useEffect(() => {
    setAttachmentPage(1);
  }, [attachmentSearch]);

  useEffect(() => {
    if (attachmentPage > totalAttachmentPages) {
      setAttachmentPage(totalAttachmentPages);
    }
  }, [attachmentPage, totalAttachmentPages]);

  return (
    <div className="space-y-6">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button disabled={!activeAssociationId}>Add Invoice</Button></DialogTrigger>
        <DialogContent className="max-h-[90vh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-h-[85vh] sm:max-w-2xl">
          <DialogHeader><DialogTitle>Create Vendor Invoice</DialogTitle></DialogHeader>
          <Form {...form}>
            <form className="space-y-4" onSubmit={form.handleSubmit((v) => createInvoice.mutate(v))}>
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                Association Context: <span className="font-medium">{activeAssociationName || "None selected"}</span>
              </div>
              <FormField
                control={form.control}
                name="vendorId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vendor</FormLabel>
                    <Select
                      value={field.value || "none"}
                      onValueChange={(value) => {
                        const nextValue = value === "none" ? "" : value;
                        const vendor = (vendors ?? []).find((item) => item.id === nextValue);
                        field.onChange(nextValue);
                        form.setValue("vendorName", vendor?.name || "", { shouldValidate: true });
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className={isMobile ? "min-h-11" : undefined}><SelectValue placeholder="Select vendor" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">select vendor</SelectItem>
                        {(vendors ?? []).map((vendor) => (
                          <SelectItem key={vendor.id} value={vendor.id}>
                            {vendor.name} · {vendor.trade}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <input type="hidden" {...form.register("vendorName")} />
              <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                Invoices are filed under the selected association's vendor registry. Create the vendor in `/app/vendors` first if it does not exist yet.
              </div>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                <FormField control={form.control} name="invoiceNumber" render={({ field }) => (<FormItem><FormLabel>Invoice #</FormLabel><FormControl><Input className={isMobile ? "min-h-11" : undefined} {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="amount" render={({ field }) => (<FormItem><FormLabel>Amount</FormLabel><FormControl><Input className={isMobile ? "min-h-11" : undefined} type="number" min="0" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                <FormField control={form.control} name="invoiceDate" render={({ field }) => (<FormItem><FormLabel>Invoice Date</FormLabel><FormControl><Input className={isMobile ? "min-h-11" : undefined} type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="dueDate" render={({ field }) => (<FormItem><FormLabel>Due Date</FormLabel><FormControl><Input className={isMobile ? "min-h-11" : undefined} type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                <FormField control={form.control} name="accountId" render={({ field }) => (
                  <FormItem><FormLabel>Account</FormLabel><Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}><FormControl><SelectTrigger className={isMobile ? "min-h-11" : undefined}><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="none">none</SelectItem>{accounts?.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="categoryId" render={({ field }) => (
                  <FormItem><FormLabel>Category</FormLabel><Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}><FormControl><SelectTrigger className={isMobile ? "min-h-11" : undefined}><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="none">none</SelectItem>{categories?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem><FormLabel>Status</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger className={isMobile ? "min-h-11" : undefined}><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="draft">draft</SelectItem><SelectItem value="received">received</SelectItem><SelectItem value="approved">approved</SelectItem><SelectItem value="paid">paid</SelectItem><SelectItem value="void">void</SelectItem></SelectContent></Select><FormMessage /></FormItem>
              )} />
              <Button className="w-full" type="submit" disabled={createInvoice.isPending}>Save</Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {apStats.overdueCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span><strong>{apStats.overdueCount} invoice{apStats.overdueCount !== 1 ? "s" : ""}</strong> past due — ${apStats.overdueAmount.toFixed(2)} outstanding</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1"><Clock className="h-4 w-4" /> Pending Approval</div>
          <div className="text-2xl font-bold">${apStats.pendingAmount.toFixed(2)}</div>
          <div className="text-xs text-muted-foreground">{apStats.pendingCount} invoice{apStats.pendingCount !== 1 ? "s" : ""}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1"><CheckCircle2 className="h-4 w-4" /> Approved</div>
          <div className="text-2xl font-bold">${apStats.approvedAmount.toFixed(2)}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className={`flex items-center gap-2 text-sm mb-1 ${apStats.overdueCount > 0 ? "text-red-600" : "text-muted-foreground"}`}>
            <AlertTriangle className="h-4 w-4" /> Overdue
          </div>
          <div className={`text-2xl font-bold ${apStats.overdueCount > 0 ? "text-red-600" : ""}`}>${apStats.overdueAmount.toFixed(2)}</div>
          <div className="text-xs text-muted-foreground">{apStats.overdueCount} past due date</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1"><DollarSign className="h-4 w-4" /> Paid (MTD)</div>
          <div className="text-2xl font-bold text-green-700">${apStats.paidMtdAmount.toFixed(2)}</div>
          <div className="text-xs text-muted-foreground">{apStats.paidMtdCount} invoice{apStats.paidMtdCount !== 1 ? "s" : ""} this month</div>
        </div>
      </div>

      <AsyncStateBoundary
        isLoading={!invoices || !attachments}
        isEmpty={!invoices?.length}
        emptyTitle="No vendor invoices yet"
        emptyMessage="Add the first vendor invoice to begin tracking payables — attach a PDF, assign it to a vendor, and mark it paid when the check clears."
      >
        <DataTableShell
          title="Invoice Register"
          description="Search, filter, and sort invoices before drilling into attachments and accounting context."
          searchValue={invoiceSearch}
          onSearchChange={setInvoiceSearch}
          searchPlaceholder="Search vendor, invoice number, notes, or status"
          summary={`${filteredInvoices.length} invoices`}
          page={invoicePage}
          totalPages={totalInvoicePages}
          onPageChange={setInvoicePage}
          filterSlot={
            <div className={`gap-3 ${isMobile ? "grid grid-cols-1" : "flex items-center flex-wrap"}`}>
              {selectedIds.size > 0 && (
                <Button size="sm" variant="default" onClick={() => bulkApprove.mutate()} disabled={bulkApprove.isPending} className={`gap-1.5 ${isMobile ? "min-h-11 w-full" : ""}`}>
                  <CheckCircle2 className="h-4 w-4" />
                  Approve {selectedIds.size} selected
                </Button>
              )}
              <ExportCsvButton
                headers={["Vendor", "Invoice #", "Amount", "Status", "Invoice Date", "Due Date"]}
                rows={filteredInvoices.map((inv) => [inv.vendorName, inv.invoiceNumber || "", Number(inv.amount).toFixed(2), inv.status, new Date(inv.invoiceDate).toLocaleDateString(), inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : ""])}
                filename={`invoices-${activeAssociationName || "all"}`}
              />
              <Select value={invoiceStatusFilter} onValueChange={setInvoiceStatusFilter}>
                <SelectTrigger className={isMobile ? "min-h-11 w-full" : "w-[180px]"}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="received">Received</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="void">Void</SelectItem>
                </SelectContent>
              </Select>
              <Select value={invoiceSortBy} onValueChange={setInvoiceSortBy}>
                <SelectTrigger className={isMobile ? "min-h-11 w-full" : "w-[180px]"}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
                  <SelectItem value="amount-desc">Amount high-low</SelectItem>
                  <SelectItem value="amount-asc">Amount low-high</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
        >
          {isMobile ? (
            <div className="space-y-3">
              {pagedInvoices.map((row) => {
                const today = new Date(); today.setHours(0,0,0,0);
                const isOverdue = row.dueDate && new Date(row.dueDate) < today && row.status !== "paid" && row.status !== "void";
                return (
                  <div key={row.id} className={`rounded-lg border p-4 space-y-3 ${isOverdue ? "border-red-200 bg-red-50/40" : ""}`}>
                    <div className="flex items-start gap-3">
                      <Checkbox checked={selectedIds.has(row.id)} onCheckedChange={(v) => { setSelectedIds(prev => { const next = new Set(prev); v ? next.add(row.id) : next.delete(row.id); return next; }); }} />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{row.vendorName}</div>
                        <div className="text-xs text-muted-foreground">
                          Invoice {row.invoiceNumber || row.id.slice(0, 8)}
                        </div>
                      </div>
                      <div className="text-sm font-semibold shrink-0">${Number(row.amount).toFixed(2)}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={row.status === "paid" ? "default" : row.status === "void" ? "destructive" : "secondary"} className="gap-1">
                        {row.status === "paid" && <CheckCircle2 className="h-3 w-3" aria-hidden="true" />}
                        {row.status === "approved" && <CheckCircle2 className="h-3 w-3" aria-hidden="true" />}
                        {(row.status === "received" || row.status === "draft") && <FileText className="h-3 w-3" aria-hidden="true" />}
                        {row.status === "void" && <Ban className="h-3 w-3" aria-hidden="true" />}
                        {row.status}
                      </Badge>
                      {isOverdue && <Badge variant="destructive">Overdue</Badge>}
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                      <div>
                        <div className="uppercase tracking-wide">Invoice Date</div>
                        <div className="mt-1 text-sm text-foreground">{new Date(row.invoiceDate).toLocaleDateString()}</div>
                      </div>
                      <div>
                        <div className="uppercase tracking-wide">Due Date</div>
                        <div className="mt-1 text-sm text-foreground">{row.dueDate ? new Date(row.dueDate).toLocaleDateString() : "-"}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {(row.status === "received" || row.status === "draft") && (
                        <Button className="min-h-11 w-full" variant="outline" onClick={() => updateStatus.mutate({ id: row.id, status: "approved" })}>
                          Approve Invoice
                        </Button>
                      )}
                      {row.status === "approved" && (
                        <ConfirmDialog
                          trigger={<Button className="min-h-11 w-full">Mark Paid</Button>}
                          title="Mark invoice as paid?"
                          description={`This will mark ${row.vendorName} invoice ${row.invoiceNumber || row.id.slice(0,8)} ($${Number(row.amount).toFixed(2)}) as paid. This is a financial record update.`}
                          confirmLabel="Mark Paid"
                          onConfirm={() => updateStatus.mutate({ id: row.id, status: "paid" })}
                        />
                      )}
                      {row.status !== "paid" && row.status !== "void" && (
                        <ConfirmDialog
                          trigger={<Button className="min-h-11 w-full" variant="ghost">Void Invoice</Button>}
                          title="Void this invoice?"
                          description={`Voiding ${row.vendorName} invoice ${row.invoiceNumber || row.id.slice(0,8)} will mark it as cancelled. This cannot be undone.`}
                          confirmLabel="Void Invoice"
                          destructive
                          onConfirm={() => updateStatus.mutate({ id: row.id, status: "void" })}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"><Checkbox checked={filteredInvoices.length > 0 && selectedIds.size === filteredInvoices.length} onCheckedChange={(v) => { if (v) setSelectedIds(new Set(filteredInvoices.map(i => i.id))); else setSelectedIds(new Set()); }} /></TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Invoice Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedInvoices.map((row) => {
                  const today = new Date(); today.setHours(0,0,0,0);
                  const isOverdue = row.dueDate && new Date(row.dueDate) < today && row.status !== "paid" && row.status !== "void";
                  return (
                    <TableRow key={row.id} className={isOverdue ? "bg-red-50/50" : ""}>
                      <TableCell className="w-8"><Checkbox checked={selectedIds.has(row.id)} onCheckedChange={(v) => { setSelectedIds(prev => { const next = new Set(prev); v ? next.add(row.id) : next.delete(row.id); return next; }); }} /></TableCell>
                      <TableCell className="font-medium">{row.vendorName}</TableCell>
                      <TableCell>{row.invoiceNumber || "-"}</TableCell>
                      <TableCell>${Number(row.amount).toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          <Badge variant={row.status === "paid" ? "default" : row.status === "void" ? "destructive" : "secondary"} className="gap-1">
                            {row.status === "paid" && <CheckCircle2 className="h-3 w-3" aria-hidden="true" />}
                            {row.status === "approved" && <CheckCircle2 className="h-3 w-3" aria-hidden="true" />}
                            {(row.status === "received" || row.status === "draft") && <FileText className="h-3 w-3" aria-hidden="true" />}
                            {row.status === "void" && <Ban className="h-3 w-3" aria-hidden="true" />}
                            {row.status}
                          </Badge>
                          {isOverdue && <Badge variant="destructive">Overdue</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>{new Date(row.invoiceDate).toLocaleDateString()}</TableCell>
                      <TableCell>{row.dueDate ? new Date(row.dueDate).toLocaleDateString() : "-"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {(row.status === "received" || row.status === "draft") && (
                            <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: row.id, status: "approved" })}>
                              Approve
                            </Button>
                          )}
                          {row.status === "approved" && (
                            <ConfirmDialog
                              trigger={<Button size="sm">Mark Paid</Button>}
                              title="Mark invoice as paid?"
                              description={`This will mark ${row.vendorName} invoice ${row.invoiceNumber || row.id.slice(0,8)} ($${Number(row.amount).toFixed(2)}) as paid. This is a financial record update.`}
                              confirmLabel="Mark Paid"
                              onConfirm={() => updateStatus.mutate({ id: row.id, status: "paid" })}
                            />
                          )}
                          {row.status !== "paid" && row.status !== "void" && (
                            <ConfirmDialog
                              trigger={<Button size="sm" variant="ghost" className="text-muted-foreground">Void</Button>}
                              title="Void this invoice?"
                              description={`Voiding ${row.vendorName} invoice ${row.invoiceNumber || row.id.slice(0,8)} will mark it as cancelled. This cannot be undone.`}
                              confirmLabel="Void Invoice"
                              destructive
                              onConfirm={() => updateStatus.mutate({ id: row.id, status: "void" })}
                            />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </DataTableShell>
      </AsyncStateBoundary>

        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-lg font-semibold">Invoice Attachments</h2>
                <p className="text-sm text-muted-foreground">Keep backup, scans, and approval support tied to the right invoice record.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Select value={attachmentInvoiceId || "none"} onValueChange={(v) => { const id = v === "none" ? "" : v; setAttachmentInvoiceId(id); const inv = (invoices ?? []).find((i) => i.id === id); setAttachmentAssocId(inv?.associationId || ""); }}>
                <SelectTrigger className={isMobile ? "min-h-11" : undefined}><SelectValue placeholder="Invoice" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">select invoice</SelectItem>
                  {(invoices ?? []).map((i) => <SelectItem key={i.id} value={i.id}>{i.vendorName} {i.invoiceNumber || i.id.slice(0, 6)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input className={isMobile ? "min-h-11" : undefined} placeholder="Attachment title" value={attachmentTitle} onChange={(e) => setAttachmentTitle(e.target.value)} />
              <div className="border rounded-md p-2 text-sm cursor-pointer" onClick={() => fileRef.current?.click()}>
                {attachmentFile?.name || "Choose file"}
                <input ref={fileRef} type="file" className="hidden" onChange={(e) => setAttachmentFile(e.target.files?.[0] ?? null)} />
              </div>
              <Button className={isMobile ? "min-h-11 w-full" : undefined} onClick={() => uploadAttachment.mutate()} disabled={uploadAttachment.isPending}>Upload</Button>
            </div>

            <DataTableShell
              title="Attachment Library"
              description="Search supporting files by invoice, vendor, or attachment title."
              searchValue={attachmentSearch}
              onSearchChange={setAttachmentSearch}
              searchPlaceholder="Search title, invoice, or vendor"
              summary={`${filteredAttachments.length} attachments`}
              page={attachmentPage}
              totalPages={totalAttachmentPages}
              onPageChange={setAttachmentPage}
            >
              {isMobile ? (
                <div className="space-y-3">
                  {pagedAttachments.map((attachment) => {
                    const invoice = (invoices ?? []).find((row) => row.id === attachment.expenseId);
                    return (
                      <div key={attachment.id} className="rounded-lg border p-4 space-y-2">
                        <div className="font-medium">{attachment.title}</div>
                        <div className="text-xs text-muted-foreground">Invoice: {invoice?.invoiceNumber || attachment.expenseId}</div>
                        <div className="text-xs text-muted-foreground">Vendor: {invoice?.vendorName || "-"}</div>
                        <Button asChild variant="outline" className="min-h-11 w-full">
                          <a href={attachment.fileUrl} target="_blank" rel="noreferrer">Open Attachment</a>
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>File</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedAttachments.map((attachment) => {
                      const invoice = (invoices ?? []).find((row) => row.id === attachment.expenseId);
                      return (
                        <TableRow key={attachment.id}>
                          <TableCell>{attachment.title}</TableCell>
                          <TableCell>{invoice?.invoiceNumber || attachment.expenseId}</TableCell>
                          <TableCell>{invoice?.vendorName || "-"}</TableCell>
                          <TableCell><a className="underline text-sm" href={attachment.fileUrl} target="_blank" rel="noreferrer">Open</a></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </DataTableShell>
          </CardContent>
        </Card>
    </div>
  );
}

export default function FinancialInvoicesPage() {
  return (
    <div className="flex flex-col min-h-0">
      <div className="p-6 space-y-6">
        <WorkspacePageHeader
          title="Vendor Invoices"
          summary="Record invoices, classify spend, and keep supporting files attached without losing association context."
          eyebrow="Finance"
          breadcrumbs={[{ label: "Dashboard", href: "/app" }, { label: "Vendor Invoices" }]}
          shortcuts={[
            { label: "Open Financial Ledger", href: "/app/financial/ledger" },
            { label: "Open Vendors", href: "/app/vendors" },
          ]}
          subPages={financeSubPages}
        />
        <FinancialInvoicesContent />
      </div>
    </div>
  );
}
