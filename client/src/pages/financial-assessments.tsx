import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Association, SpecialAssessment } from "@shared/schema";
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
import { Calculator, Plus } from "lucide-react";
import { useActiveAssociation } from "@/hooks/use-active-association";

const createSchema = z.object({
  associationId: z.string().min(1, "Association is required"),
  name: z.string().min(1, "Name is required"),
  totalAmount: z.coerce.number().positive("Amount must be positive"),
  installmentCount: z.coerce.number().int().min(1).max(60),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  notes: z.string().optional(),
});

export default function FinancialAssessmentsPage() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();

  const { data: rows, isLoading } = useQuery<SpecialAssessment[]>({
    queryKey: ["/api/financial/assessments"],
  });
  const { data: associations } = useQuery<Association[]>({ queryKey: ["/api/associations"] });

  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      associationId: "",
      name: "",
      totalAmount: 0,
      installmentCount: 1,
      startDate: "",
      endDate: "",
      notes: "",
    },
  });

  useEffect(() => {
    form.setValue("associationId", activeAssociationId, { shouldValidate: true });
  }, [activeAssociationId, form]);

  const createMutation = useMutation({
    mutationFn: async (values: z.infer<typeof createSchema>) => {
      const payload = {
        associationId: values.associationId,
        name: values.name,
        totalAmount: values.totalAmount,
        installmentCount: values.installmentCount,
        startDate: new Date(values.startDate).toISOString(),
        endDate: values.endDate ? new Date(values.endDate).toISOString() : null,
        notes: values.notes || null,
        isActive: 1,
      };
      const res = await apiRequest("POST", "/api/financial/assessments", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/financial/assessments"] });
      toast({ title: "Special assessment created" });
      setOpen(false);
      form.reset({ associationId: activeAssociationId, name: "", totalAmount: 0, installmentCount: 1, startDate: "", endDate: "", notes: "" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (row: SpecialAssessment) => {
      const res = await apiRequest("PATCH", `/api/financial/assessments/${row.id}`, {
        isActive: row.isActive ? 0 : 1,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/financial/assessments"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const assocNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const assoc of associations ?? []) {
      map.set(assoc.id, assoc.name);
    }
    return map;
  }, [associations]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Special Assessments</h1>
          <p className="text-muted-foreground">Track one-time or installment-based assessments for the current association context.</p>
        </div>
        <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) form.reset(); }}>
          <DialogTrigger asChild>
            <Button disabled={!activeAssociationId}>
              <Plus className="h-4 w-4 mr-2" />
              New Assessment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Special Assessment</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form className="space-y-4" onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}>
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                  Association Context: <span className="font-medium">{activeAssociationName || "None selected"}</span>
                </div>

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl><Input placeholder="2026 Roof Repair Assessment" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="totalAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Amount</FormLabel>
                        <FormControl><Input type="number" min="0" step="0.01" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="installmentCount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Installments</FormLabel>
                        <FormControl><Input type="number" min="1" max="60" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date (Optional)</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl><Input placeholder="Optional assessment context" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Saving..." : "Create Assessment"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !rows?.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Calculator className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">No assessments</h3>
              <p className="text-sm text-muted-foreground mt-1">Create the first special assessment.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Association</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Installments</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-muted-foreground">{assocNameById.get(row.associationId) ?? "Unknown"}</TableCell>
                    <TableCell>${row.totalAmount.toFixed(2)}</TableCell>
                    <TableCell>{row.installmentCount}</TableCell>
                    <TableCell>{row.isActive ? <Badge>Active</Badge> : <Badge variant="outline">Inactive</Badge>}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleMutation.mutate(row)}
                        disabled={toggleMutation.isPending}
                      >
                        {row.isActive ? "Deactivate" : "Activate"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
