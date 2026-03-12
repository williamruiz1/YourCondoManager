import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { Association, OwnerLedgerEntry, Person, Unit } from "@shared/schema";
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

const entrySchema = z.object({
  associationId: z.string().min(1),
  unitId: z.string().min(1),
  personId: z.string().min(1),
  entryType: z.enum(["charge", "assessment", "payment", "late-fee", "credit", "adjustment"]),
  amount: z.coerce.number(),
  postedAt: z.string().min(1),
  description: z.string().optional(),
});

export default function FinancialLedgerPage() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();
  const [assocFilter, setAssocFilter] = useState<string>(activeAssociationId);

  const { data: associations } = useQuery<Association[]>({ queryKey: ["/api/associations"] });
  const { data: units } = useQuery<Unit[]>({ queryKey: ["/api/units"] });
  const { data: persons } = useQuery<Person[]>({ queryKey: ["/api/persons"] });
  const entriesQuery = useQuery<OwnerLedgerEntry[]>({ queryKey: ["/api/financial/owner-ledger/entries"] });
  const summaryQuery = useQuery<Array<{ personId: string; unitId: string; balance: number }>>({
    queryKey: ["/api/financial/owner-ledger/summary", assocFilter || "none"],
    queryFn: async () => {
      if (!assocFilter) return [];
      const res = await apiRequest("GET", `/api/financial/owner-ledger/summary/${assocFilter}`);
      return res.json();
    },
    enabled: Boolean(assocFilter),
  });

  const form = useForm<z.infer<typeof entrySchema>>({
    resolver: zodResolver(entrySchema),
    defaultValues: {
      associationId: "",
      unitId: "",
      personId: "",
      entryType: "charge",
      amount: 0,
      postedAt: "",
      description: "",
    },
  });

  useEffect(() => {
    setAssocFilter(activeAssociationId);
    form.setValue("associationId", activeAssociationId, { shouldValidate: true });
  }, [activeAssociationId, form]);

  const createEntry = useMutation({
    mutationFn: async (v: z.infer<typeof entrySchema>) => {
      const payload = {
        ...v,
        postedAt: new Date(v.postedAt).toISOString(),
        description: v.description || null,
      };
      const res = await apiRequest("POST", "/api/financial/owner-ledger/entries", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/financial/owner-ledger/entries"] });
      if (assocFilter) queryClient.invalidateQueries({ queryKey: ["/api/financial/owner-ledger/summary", assocFilter] });
      setOpen(false);
      form.reset({ associationId: activeAssociationId, unitId: "", personId: "", entryType: "charge", amount: 0, postedAt: "", description: "" });
      toast({ title: "Ledger entry posted" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const personName = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of persons ?? []) map.set(p.id, `${p.firstName} ${p.lastName}`);
    return map;
  }, [persons]);

  const unitName = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of units ?? []) map.set(u.id, u.unitNumber);
    return map;
  }, [units]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Owner Ledger</h1>
          <p className="text-muted-foreground">Post ledger entries and review balances in the current association context.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button disabled={!activeAssociationId}>Add Ledger Entry</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Ledger Entry</DialogTitle></DialogHeader>
            <Form {...form}>
              <form className="space-y-4" onSubmit={form.handleSubmit((v) => createEntry.mutate(v))}>
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                  Association Context: <span className="font-medium">{activeAssociationName || "None selected"}</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="unitId" render={({ field }) => (
                    <FormItem><FormLabel>Unit</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl><SelectContent>{units?.map((u) => <SelectItem key={u.id} value={u.id}>{u.unitNumber}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="personId" render={({ field }) => (
                    <FormItem><FormLabel>Owner</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl><SelectContent>{persons?.map((p) => <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="entryType" render={({ field }) => (
                    <FormItem><FormLabel>Type</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="charge">charge</SelectItem><SelectItem value="assessment">assessment</SelectItem><SelectItem value="payment">payment</SelectItem><SelectItem value="late-fee">late-fee</SelectItem><SelectItem value="credit">credit</SelectItem><SelectItem value="adjustment">adjustment</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="amount" render={({ field }) => (
                    <FormItem><FormLabel>Amount (positive=owed, negative=credit)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="postedAt" render={({ field }) => (<FormItem><FormLabel>Posted Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <Button className="w-full" type="submit" disabled={createEntry.isPending}>Save</Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-6 space-y-3">
          <h2 className="text-lg font-semibold">Balance Summary</h2>
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm max-w-sm">
            Association Context: <span className="font-medium">{activeAssociationName || "None selected"}</span>
          </div>
          <Table>
            <TableHeader><TableRow><TableHead>Owner</TableHead><TableHead>Unit</TableHead><TableHead>Balance</TableHead></TableRow></TableHeader>
            <TableBody>{(summaryQuery.data ?? []).map((s) => (<TableRow key={`${s.personId}-${s.unitId}`}><TableCell>{personName.get(s.personId) || s.personId}</TableCell><TableCell>{unitName.get(s.unitId) || s.unitId}</TableCell><TableCell><Badge variant={s.balance > 0 ? "destructive" : "default"}>${s.balance.toFixed(2)}</Badge></TableCell></TableRow>))}</TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Owner</TableHead><TableHead>Unit</TableHead><TableHead>Type</TableHead><TableHead>Amount</TableHead></TableRow></TableHeader><TableBody>{(entriesQuery.data ?? []).map((e) => (<TableRow key={e.id}><TableCell>{new Date(e.postedAt).toLocaleDateString()}</TableCell><TableCell>{personName.get(e.personId) || e.personId}</TableCell><TableCell>{unitName.get(e.unitId) || e.unitId}</TableCell><TableCell><Badge variant="secondary">{e.entryType}</Badge></TableCell><TableCell>${e.amount.toFixed(2)}</TableCell></TableRow>))}</TableBody></Table></CardContent></Card>
    </div>
  );
}
