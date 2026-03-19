import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { Association, ExpenseAttachment, FinancialAccount, FinancialCategory, UtilityPayment } from "@shared/schema";
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
import { FinanceTabBar } from "@/components/finance-tab-bar";

const utilitySchema = z.object({
  associationId: z.string().min(1),
  utilityType: z.string().min(1),
  providerName: z.string().min(1),
  servicePeriodStart: z.string().optional(),
  servicePeriodEnd: z.string().optional(),
  dueDate: z.string().optional(),
  paidDate: z.string().optional(),
  amount: z.coerce.number().positive(),
  status: z.enum(["due", "scheduled", "paid"]),
  accountId: z.string().optional(),
  categoryId: z.string().optional(),
  notes: z.string().optional(),
});


export default function FinancialUtilitiesPage() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [attachmentUtilityId, setAttachmentUtilityId] = useState<string>("");
  const [attachmentAssocId, setAttachmentAssocId] = useState<string>("");
  const [attachmentTitle, setAttachmentTitle] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: associations } = useQuery<Association[]>({ queryKey: ["/api/associations"] });
  const { data: accounts } = useQuery<FinancialAccount[]>({ queryKey: ["/api/financial/accounts"] });
  const { data: categories } = useQuery<FinancialCategory[]>({ queryKey: ["/api/financial/categories"] });
  const { data: utilities } = useQuery<UtilityPayment[]>({
    queryKey: ["/api/financial/utilities", activeAssociationId],
    queryFn: async () => {
      const params = activeAssociationId ? `?associationId=${activeAssociationId}` : "";
      const res = await apiRequest("GET", `/api/financial/utilities${params}`);
      return res.json();
    },
  });
  const { data: attachments } = useQuery<ExpenseAttachment[]>({ queryKey: ["/api/financial/expense-attachments"] });

  const form = useForm<z.infer<typeof utilitySchema>>({
    resolver: zodResolver(utilitySchema),
    defaultValues: {
      associationId: "",
      utilityType: "",
      providerName: "",
      servicePeriodStart: "",
      servicePeriodEnd: "",
      dueDate: "",
      paidDate: "",
      amount: 0,
      status: "due",
      accountId: "",
      categoryId: "",
      notes: "",
    },
  });

  useEffect(() => {
    form.setValue("associationId", activeAssociationId, { shouldValidate: true });
    setAttachmentAssocId(activeAssociationId);
  }, [activeAssociationId, form]);

  const createUtility = useMutation({
    mutationFn: async (v: z.infer<typeof utilitySchema>) => {
      const payload = {
        ...v,
        servicePeriodStart: v.servicePeriodStart ? new Date(v.servicePeriodStart).toISOString() : null,
        servicePeriodEnd: v.servicePeriodEnd ? new Date(v.servicePeriodEnd).toISOString() : null,
        dueDate: v.dueDate ? new Date(v.dueDate).toISOString() : null,
        paidDate: v.paidDate ? new Date(v.paidDate).toISOString() : null,
        accountId: v.accountId || null,
        categoryId: v.categoryId || null,
        notes: v.notes || null,
      };
      const res = await apiRequest("POST", "/api/financial/utilities", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/financial/utilities"] });
      setOpen(false);
      form.reset({ associationId: activeAssociationId, utilityType: "", providerName: "", servicePeriodStart: "", servicePeriodEnd: "", dueDate: "", paidDate: "", amount: 0, status: "due", accountId: "", categoryId: "", notes: "" });
      toast({ title: "Utility payment saved" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const markPaid = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PATCH", `/api/financial/utilities/${id}`, { status: "paid", paidDate: new Date().toISOString() });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/financial/utilities", activeAssociationId] });
      toast({ title: "Marked as paid" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const uploadAttachment = useMutation({
    mutationFn: async () => {
      if (!attachmentFile || !attachmentUtilityId || !attachmentAssocId || !attachmentTitle) {
        throw new Error("Utility, association, title and file are required");
      }
      const fd = new FormData();
      fd.append("associationId", attachmentAssocId);
      fd.append("expenseType", "utility-payment");
      fd.append("expenseId", attachmentUtilityId);
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
      setAttachmentUtilityId("");
      setAttachmentAssocId("");
      setAttachmentTitle("");
      toast({ title: "Attachment uploaded" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="flex flex-col min-h-0">
      <FinanceTabBar />
      <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Utility Payments</h1>
          <p className="text-muted-foreground">Track utility bills, statuses, and attachments for the current association context.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button disabled={!activeAssociationId}>Add Utility Payment</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Utility Payment</DialogTitle></DialogHeader>
            <Form {...form}>
              <form className="space-y-4" onSubmit={form.handleSubmit((v) => createUtility.mutate(v))}>
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                  Association Context: <span className="font-medium">{activeAssociationName || "None selected"}</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="utilityType" render={({ field }) => (<FormItem><FormLabel>Utility Type</FormLabel><FormControl><Input placeholder="Water" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="providerName" render={({ field }) => (<FormItem><FormLabel>Provider</FormLabel><FormControl><Input placeholder="Provider" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="amount" render={({ field }) => (<FormItem><FormLabel>Amount</FormLabel><FormControl><Input type="number" min="0" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem><FormLabel>Status</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="due">due</SelectItem><SelectItem value="scheduled">scheduled</SelectItem><SelectItem value="paid">paid</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="dueDate" render={({ field }) => (<FormItem><FormLabel>Due Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="paidDate" render={({ field }) => (<FormItem><FormLabel>Paid Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <Button className="w-full" type="submit" disabled={createUtility.isPending}>Save</Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-base font-semibold flex-1">Utility Bills</h2>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="due">Due</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(utilities ?? []).filter(r => statusFilter === "all" || r.status === statusFilter).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
              <p className="text-sm">{statusFilter === "all" ? "No utility bills recorded yet." : `No ${statusFilter} utility bills.`}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(utilities ?? [])
                  .filter(r => statusFilter === "all" || r.status === statusFilter)
                  .map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.utilityType}</TableCell>
                      <TableCell>{row.providerName}</TableCell>
                      <TableCell>${row.amount.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={row.status === "paid" ? "default" : row.status === "due" ? "destructive" : "secondary"}>
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{row.dueDate ? new Date(row.dueDate).toLocaleDateString() : "—"}</TableCell>
                      <TableCell className="text-right">
                        {row.status !== "paid" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => markPaid.mutate(row.id)}
                            disabled={markPaid.isPending}
                          >
                            Mark Paid
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Utility Attachments</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Select value={attachmentUtilityId || "none"} onValueChange={(v) => { const id = v === "none" ? "" : v; setAttachmentUtilityId(id); const row = (utilities ?? []).find((i) => i.id === id); setAttachmentAssocId(row?.associationId || ""); }}><SelectTrigger><SelectValue placeholder="Utility record" /></SelectTrigger><SelectContent><SelectItem value="none">select utility</SelectItem>{(utilities ?? []).map((i) => <SelectItem key={i.id} value={i.id}>{i.utilityType} {i.providerName}</SelectItem>)}</SelectContent></Select>
            <Input placeholder="Attachment title" value={attachmentTitle} onChange={(e) => setAttachmentTitle(e.target.value)} />
            <div className="border rounded-md p-2 text-sm cursor-pointer" onClick={() => fileRef.current?.click()}>{attachmentFile?.name || "Choose file"}<input ref={fileRef} type="file" className="hidden" onChange={(e) => setAttachmentFile(e.target.files?.[0] ?? null)} /></div>
            <Button onClick={() => uploadAttachment.mutate()} disabled={uploadAttachment.isPending}>Upload</Button>
          </div>
          <Table>
            <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Utility</TableHead><TableHead>File</TableHead></TableRow></TableHeader>
            <TableBody>
              {(attachments ?? []).filter((a) => a.expenseType === "utility-payment").map((a) => {
                const utility = (utilities ?? []).find(u => u.id === a.expenseId);
                return (
                  <TableRow key={a.id}>
                    <TableCell>{a.title}</TableCell>
                    <TableCell>{utility ? `${utility.utilityType} — ${utility.providerName}` : a.expenseId}</TableCell>
                    <TableCell><a className="underline text-sm" href={a.fileUrl} target="_blank" rel="noreferrer">Open</a></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
