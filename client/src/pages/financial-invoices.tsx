import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { Association, ExpenseAttachment, FinancialAccount, FinancialCategory, VendorInvoice } from "@shared/schema";
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

const invoiceSchema = z.object({
  associationId: z.string().min(1),
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

function adminHeaders() {
  return {
    "x-admin-api-key": localStorage.getItem("adminApiKey") || "dev-admin-key",
    "x-admin-user-email": localStorage.getItem("adminUserEmail") || "admin@local",
  };
}

export default function FinancialInvoicesPage() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [attachmentInvoiceId, setAttachmentInvoiceId] = useState<string>("");
  const [attachmentAssocId, setAttachmentAssocId] = useState<string>("");
  const [attachmentTitle, setAttachmentTitle] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();

  const { data: associations } = useQuery<Association[]>({ queryKey: ["/api/associations"] });
  const { data: accounts } = useQuery<FinancialAccount[]>({ queryKey: ["/api/financial/accounts"] });
  const { data: categories } = useQuery<FinancialCategory[]>({ queryKey: ["/api/financial/categories"] });
  const { data: invoices } = useQuery<VendorInvoice[]>({ queryKey: ["/api/financial/invoices"] });
  const { data: attachments } = useQuery<ExpenseAttachment[]>({ queryKey: ["/api/financial/expense-attachments"] });

  const form = useForm<z.infer<typeof invoiceSchema>>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      associationId: "",
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
      form.reset({ associationId: activeAssociationId, vendorName: "", invoiceNumber: "", invoiceDate: "", dueDate: "", amount: 0, status: "received", accountId: "", categoryId: "", notes: "" });
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
        headers: adminHeaders(),
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vendor Invoices</h1>
          <p className="text-muted-foreground">Record invoices and attach supporting files for the current association context.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button disabled={!activeAssociationId}>Add Invoice</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Vendor Invoice</DialogTitle></DialogHeader>
            <Form {...form}>
              <form className="space-y-4" onSubmit={form.handleSubmit((v) => createInvoice.mutate(v))}>
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                  Association Context: <span className="font-medium">{activeAssociationName || "None selected"}</span>
                </div>
                <FormField control={form.control} name="vendorName" render={({ field }) => (<FormItem><FormLabel>Vendor</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="invoiceNumber" render={({ field }) => (<FormItem><FormLabel>Invoice #</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="amount" render={({ field }) => (<FormItem><FormLabel>Amount</FormLabel><FormControl><Input type="number" min="0" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="invoiceDate" render={({ field }) => (<FormItem><FormLabel>Invoice Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="dueDate" render={({ field }) => (<FormItem><FormLabel>Due Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="accountId" render={({ field }) => (
                    <FormItem><FormLabel>Account</FormLabel><Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="none">none</SelectItem>{accounts?.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="categoryId" render={({ field }) => (
                    <FormItem><FormLabel>Category</FormLabel><Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="none">none</SelectItem>{categories?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem><FormLabel>Status</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="draft">draft</SelectItem><SelectItem value="received">received</SelectItem><SelectItem value="approved">approved</SelectItem><SelectItem value="paid">paid</SelectItem><SelectItem value="void">void</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                )} />
                <Button className="w-full" type="submit" disabled={createInvoice.isPending}>Save</Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Vendor</TableHead><TableHead>#</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead></TableRow></TableHeader><TableBody>{(invoices ?? []).map((row) => (<TableRow key={row.id}><TableCell>{row.vendorName}</TableCell><TableCell>{row.invoiceNumber || "-"}</TableCell><TableCell>${row.amount.toFixed(2)}</TableCell><TableCell><Badge variant="secondary">{row.status}</Badge></TableCell><TableCell>{new Date(row.invoiceDate).toLocaleDateString()}</TableCell></TableRow>))}</TableBody></Table></CardContent></Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Invoice Attachments</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Select value={attachmentInvoiceId || "none"} onValueChange={(v) => { const id = v === "none" ? "" : v; setAttachmentInvoiceId(id); const inv = (invoices ?? []).find((i) => i.id === id); setAttachmentAssocId(inv?.associationId || ""); }}><SelectTrigger><SelectValue placeholder="Invoice" /></SelectTrigger><SelectContent><SelectItem value="none">select invoice</SelectItem>{(invoices ?? []).map((i) => <SelectItem key={i.id} value={i.id}>{i.vendorName} {i.invoiceNumber || i.id.slice(0, 6)}</SelectItem>)}</SelectContent></Select>
            <Input placeholder="Attachment title" value={attachmentTitle} onChange={(e) => setAttachmentTitle(e.target.value)} />
            <div className="border rounded-md p-2 text-sm cursor-pointer" onClick={() => fileRef.current?.click()}>{attachmentFile?.name || "Choose file"}<input ref={fileRef} type="file" className="hidden" onChange={(e) => setAttachmentFile(e.target.files?.[0] ?? null)} /></div>
            <Button onClick={() => uploadAttachment.mutate()} disabled={uploadAttachment.isPending}>Upload</Button>
          </div>
          <Table>
            <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Invoice</TableHead><TableHead>File</TableHead></TableRow></TableHeader>
            <TableBody>
              {(attachments ?? []).filter((a) => a.expenseType === "invoice").map((a) => (
                <TableRow key={a.id}><TableCell>{a.title}</TableCell><TableCell>{a.expenseId}</TableCell><TableCell><a className="underline text-sm" href={a.fileUrl} target="_blank" rel="noreferrer">Open</a></TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
