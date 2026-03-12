import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Association, LateFeeEvent, LateFeeRule } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Plus } from "lucide-react";
import { useActiveAssociation } from "@/hooks/use-active-association";

const feeTypeOptions = ["flat", "percent"] as const;

const ruleSchema = z.object({
  associationId: z.string().min(1),
  name: z.string().min(1),
  feeType: z.enum(feeTypeOptions),
  feeAmount: z.coerce.number().min(0),
  graceDays: z.coerce.number().int().min(0).max(365),
  maxFee: z.string().optional(),
});

const calcSchema = z.object({
  associationId: z.string().min(1),
  ruleId: z.string().min(1),
  balanceAmount: z.coerce.number().positive(),
  dueDate: z.string().min(1),
  asOfDate: z.string().min(1),
  referenceType: z.string().optional(),
  referenceId: z.string().optional(),
  apply: z.boolean().default(false),
});

export default function FinancialLateFeesPage() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [calcResult, setCalcResult] = useState<{ calculatedFee: number; daysLate: number; appliedEventId: string | null } | null>(null);
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();

  const { data: rules, isLoading } = useQuery<LateFeeRule[]>({ queryKey: ["/api/financial/late-fee-rules"] });
  const { data: events } = useQuery<LateFeeEvent[]>({ queryKey: ["/api/financial/late-fee-events"] });
  const { data: associations } = useQuery<Association[]>({ queryKey: ["/api/associations"] });

  const ruleForm = useForm<z.infer<typeof ruleSchema>>({
    resolver: zodResolver(ruleSchema),
    defaultValues: {
      associationId: "",
      name: "",
      feeType: "flat",
      feeAmount: 0,
      graceDays: 0,
      maxFee: "",
    },
  });

  const calcForm = useForm<z.infer<typeof calcSchema>>({
    resolver: zodResolver(calcSchema),
    defaultValues: {
      associationId: "",
      ruleId: "",
      balanceAmount: 0,
      dueDate: "",
      asOfDate: "",
      referenceType: "charge",
      referenceId: "",
      apply: false,
    },
  });

  useEffect(() => {
    ruleForm.setValue("associationId", activeAssociationId, { shouldValidate: true });
    calcForm.setValue("associationId", activeAssociationId, { shouldValidate: true });
  }, [activeAssociationId, calcForm, ruleForm]);

  const createRuleMutation = useMutation({
    mutationFn: async (values: z.infer<typeof ruleSchema>) => {
      const payload = {
        associationId: values.associationId,
        name: values.name,
        feeType: values.feeType,
        feeAmount: values.feeAmount,
        graceDays: values.graceDays,
        maxFee: values.maxFee ? Number(values.maxFee) : null,
        isActive: 1,
      };
      const res = await apiRequest("POST", "/api/financial/late-fee-rules", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/financial/late-fee-rules"] });
      toast({ title: "Late fee rule created" });
      setOpen(false);
      ruleForm.reset({ associationId: activeAssociationId, name: "", feeType: "flat", feeAmount: 0, graceDays: 0, maxFee: "" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const calcMutation = useMutation({
    mutationFn: async (values: z.infer<typeof calcSchema>) => {
      const res = await apiRequest("POST", "/api/financial/late-fees/calculate", {
        associationId: values.associationId,
        ruleId: values.ruleId,
        balanceAmount: values.balanceAmount,
        dueDate: new Date(values.dueDate).toISOString(),
        asOfDate: new Date(values.asOfDate).toISOString(),
        referenceType: values.referenceType || null,
        referenceId: values.referenceId || null,
        apply: values.apply,
      });
      return res.json();
    },
    onSuccess: (result) => {
      setCalcResult(result);
      queryClient.invalidateQueries({ queryKey: ["/api/financial/late-fee-events"] });
      toast({ title: result.appliedEventId ? "Late fee calculated and recorded" : "Late fee calculated" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const assocNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const assoc of associations ?? []) map.set(assoc.id, assoc.name);
    return map;
  }, [associations]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Late Fee Rules</h1>
          <p className="text-muted-foreground">Configure and run late-fee calculations for the current association context.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button disabled={!activeAssociationId}>
              <Plus className="h-4 w-4 mr-2" />
              New Rule
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Late Fee Rule</DialogTitle></DialogHeader>
            <Form {...ruleForm}>
              <form className="space-y-4" onSubmit={ruleForm.handleSubmit((values) => createRuleMutation.mutate(values))}>
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                  Association Context: <span className="font-medium">{activeAssociationName || "None selected"}</span>
                </div>
                <FormField control={ruleForm.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="Standard late fee rule" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={ruleForm.control} name="feeType" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="flat">flat</SelectItem>
                          <SelectItem value="percent">percent</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={ruleForm.control} name="feeAmount" render={({ field }) => (
                    <FormItem><FormLabel>Fee Amount</FormLabel><FormControl><Input type="number" min="0" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={ruleForm.control} name="graceDays" render={({ field }) => (
                    <FormItem><FormLabel>Grace Days</FormLabel><FormControl><Input type="number" min="0" max="365" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={ruleForm.control} name="maxFee" render={({ field }) => (
                    <FormItem><FormLabel>Max Fee (Optional)</FormLabel><FormControl><Input type="number" min="0" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <Button className="w-full" type="submit" disabled={createRuleMutation.isPending}>{createRuleMutation.isPending ? "Saving..." : "Create Rule"}</Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !rules?.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">No late fee rules</h3>
              <p className="text-sm text-muted-foreground mt-1">Create a rule to begin calculating late fees.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Association</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Grace</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-muted-foreground">{assocNameById.get(row.associationId) ?? "Unknown"}</TableCell>
                    <TableCell><Badge variant="secondary">{row.feeType}</Badge></TableCell>
                    <TableCell>{row.feeType === "percent" ? `${row.feeAmount}%` : `$${row.feeAmount.toFixed(2)}`}</TableCell>
                    <TableCell>{row.graceDays} days</TableCell>
                    <TableCell>{row.isActive ? <Badge>Active</Badge> : <Badge variant="outline">Inactive</Badge>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Late Fee Calculator</h2>
          <Form {...calcForm}>
            <form className="grid grid-cols-1 md:grid-cols-3 gap-4" onSubmit={calcForm.handleSubmit((values) => calcMutation.mutate(values))}>
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm md:col-span-3">
                Association Context: <span className="font-medium">{activeAssociationName || "None selected"}</span>
              </div>

              <FormField control={calcForm.control} name="ruleId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Rule</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select rule" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {rules?.map((rule) => <SelectItem key={rule.id} value={rule.id}>{rule.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={calcForm.control} name="balanceAmount" render={({ field }) => (
                <FormItem><FormLabel>Outstanding Balance</FormLabel><FormControl><Input type="number" min="0" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
              )} />

              <FormField control={calcForm.control} name="dueDate" render={({ field }) => (
                <FormItem><FormLabel>Due Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />

              <FormField control={calcForm.control} name="asOfDate" render={({ field }) => (
                <FormItem><FormLabel>As Of Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />

              <FormField control={calcForm.control} name="referenceId" render={({ field }) => (
                <FormItem><FormLabel>Reference ID (Optional)</FormLabel><FormControl><Input placeholder="charge-123" {...field} /></FormControl><FormMessage /></FormItem>
              )} />

              <div className="md:col-span-3 flex items-center justify-between gap-4">
                <FormField control={calcForm.control} name="apply" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Persist Event</FormLabel>
                    <FormControl>
                      <input type="checkbox" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" disabled={calcMutation.isPending}>{calcMutation.isPending ? "Calculating..." : "Calculate"}</Button>
              </div>
            </form>
          </Form>

          {calcResult ? (
            <div className="rounded-md border p-4 text-sm">
              <div>Days Late: <span className="font-medium">{calcResult.daysLate}</span></div>
              <div>Calculated Fee: <span className="font-medium">${calcResult.calculatedFee.toFixed(2)}</span></div>
              <div>Persisted Event: <span className="font-medium">{calcResult.appliedEventId ?? "No"}</span></div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Fee</TableHead>
                <TableHead>As Of</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(events ?? []).slice(0, 20).map((event) => (
                <TableRow key={event.id}>
                  <TableCell>{rules?.find((r) => r.id === event.ruleId)?.name ?? event.ruleId}</TableCell>
                  <TableCell>${event.balanceAmount.toFixed(2)}</TableCell>
                  <TableCell>${event.calculatedFee.toFixed(2)}</TableCell>
                  <TableCell>{new Date(event.asOfDate).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
