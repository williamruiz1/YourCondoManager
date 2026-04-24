// zone: Financials
// persona: Manager, Board Officer, Assisted Board, PM Assistant
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SpecialAssessment } from "@shared/schema";
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
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { financeSubPages } from "@/lib/sub-page-nav";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Unit } from "@shared/schema";

const createSchema = z.object({
  associationId: z.string().min(1, "Association is required"),
  name: z.string().min(1, "Name is required"),
  totalAmount: z.coerce.number().positive("Amount must be positive"),
  installmentCount: z.coerce.number().int().min(1).max(60),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  postingMode: z.enum(["manual", "automatic"]),
  excludedUnitIds: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

function InstallmentPreview({ form }: { form: ReturnType<typeof useForm<any>> }) {
  const totalAmount = form.watch("totalAmount");
  const installmentCount = form.watch("installmentCount");
  const perInstallment = totalAmount > 0 && installmentCount > 0
    ? (Number(totalAmount) / Number(installmentCount)).toFixed(2)
    : null;

  if (!perInstallment) return null;
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm flex items-center justify-between">
      <span className="text-muted-foreground">Per installment</span>
      <span className="font-semibold">${perInstallment}</span>
    </div>
  );
}

export function FinancialAssessmentsContent({ readOnly = false }: { readOnly?: boolean } = {}) {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editingExclusionsRow, setEditingExclusionsRow] = useState<SpecialAssessment | null>(null);
  const [editingExcludedUnitIds, setEditingExcludedUnitIds] = useState<string[]>([]);
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();

  const { data: rows, isLoading } = useQuery<SpecialAssessment[]>({
    queryKey: ["/api/financial/assessments", activeAssociationId],
    queryFn: async () => {
      const params = activeAssociationId ? `?associationId=${activeAssociationId}` : "";
      const res = await apiRequest("GET", `/api/financial/assessments${params}`);
      return res.json();
    },
  });

  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      associationId: "",
      name: "",
      totalAmount: 0,
      installmentCount: 1,
      startDate: "",
      endDate: "",
      postingMode: "manual",
      excludedUnitIds: [],
      notes: "",
    },
  });

  const { data: units = [] } = useQuery<Unit[]>({
    queryKey: ["/api/units"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/units");
      return res.json();
    },
  });

  const scopedUnits = activeAssociationId
    ? units.filter((unit) => unit.associationId === activeAssociationId)
    : units;

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
        autoPostEnabled: values.postingMode === "automatic" ? 1 : 0,
        excludedUnitIdsJson: values.excludedUnitIds,
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
      form.reset({ associationId: activeAssociationId, name: "", totalAmount: 0, installmentCount: 1, startDate: "", endDate: "", postingMode: "manual", excludedUnitIds: [], notes: "" });
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

  const postingModeMutation = useMutation({
    mutationFn: async ({ row, autoPostEnabled }: { row: SpecialAssessment; autoPostEnabled: number }) => {
      const res = await apiRequest("PATCH", `/api/financial/assessments/${row.id}`, {
        autoPostEnabled,
      });
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/financial/assessments"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/financial/owner-ledger/entries"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const exclusionsMutation = useMutation({
    mutationFn: async ({ row, excludedUnitIds }: { row: SpecialAssessment; excludedUnitIds: string[] }) => {
      const res = await apiRequest("PATCH", `/api/financial/assessments/${row.id}`, {
        excludedUnitIdsJson: excludedUnitIds,
      });
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/financial/assessments"] });
      setEditingExclusionsRow(null);
      setEditingExcludedUnitIds([]);
      toast({ title: "Assessment exclusions updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      {!readOnly && (
      <div className={`flex ${isMobile ? "w-full flex-col gap-2" : "items-center gap-2"}`} data-testid="assessments-toolbar">
        <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) form.reset(); }}>
          <DialogTrigger asChild>
            <Button disabled={!activeAssociationId} data-testid="button-new-assessment">
              <Plus className="h-4 w-4 mr-2" />
              New Assessment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto sm:max-h-[85vh]">
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

                <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
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

                <InstallmentPreview form={form} />

                <FormField
                  control={form.control}
                  name="postingMode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Posting Mode</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="manual">Manual run only</SelectItem>
                          <SelectItem value="automatic">Automatic background posting</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Manual assessments post only when you run them. Automatic assessments are picked up by the background automation sweep.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="excludedUnitIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Exclude Units</FormLabel>
                      <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-3">
                        {!scopedUnits.length ? (
                          <p className="text-sm text-muted-foreground">No units available in the active association.</p>
                        ) : scopedUnits.map((unit) => {
                          const selected = field.value.includes(unit.id);
                          return (
                            <label key={unit.id} className="flex items-center justify-between gap-3 text-sm">
                              <span>{unit.unitNumber}</span>
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={(event) => {
                                  if (event.target.checked) {
                                    field.onChange([...field.value, unit.id]);
                                    return;
                                  }
                                  field.onChange(field.value.filter((value) => value !== unit.id));
                                }}
                              />
                            </label>
                          );
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Excluded units will not receive assessment installments. Use this for units that already paid their share in full.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
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
                      <FormControl><Textarea placeholder="Optional assessment context, board resolution reference, etc." rows={3} {...field} /></FormControl>
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
      )}
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
          ) : isMobile ? (
            <div className="space-y-3 p-4">
              {rows.map((row) => {
                const perInstallment = row.installmentCount > 0 ? row.totalAmount / row.installmentCount : 0;
                return (
                  <div key={row.id} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold leading-5">{row.name}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {activeAssociationName || row.associationId.slice(0, 8)}
                        </div>
                      </div>
                      {row.isActive ? <Badge>Active</Badge> : <Badge variant="outline">Inactive</Badge>}
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                      <div>
                        <div className="uppercase tracking-wide">Total</div>
                        <div className="mt-1 text-sm font-medium text-foreground">${row.totalAmount.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="uppercase tracking-wide">Installments</div>
                        <div className="mt-1 text-sm text-foreground">{row.installmentCount}</div>
                      </div>
                      <div className="col-span-2">
                        <div className="uppercase tracking-wide">Per Installment</div>
                        <div className="mt-1 text-sm font-medium text-foreground">${perInstallment.toFixed(2)}</div>
                      </div>
                      <div className="col-span-2">
                        <div className="uppercase tracking-wide">Posting</div>
                        <div className="mt-1 text-sm text-foreground">{row.autoPostEnabled ? "Automatic" : "Manual"}</div>
                      </div>
                      <div className="col-span-2">
                        <div className="uppercase tracking-wide">Excluded Units</div>
                        <div className="mt-1 text-sm text-foreground">{Array.isArray(row.excludedUnitIdsJson) ? row.excludedUnitIdsJson.length : 0}</div>
                      </div>
                    </div>
                    {!readOnly && (
                    <div className="grid grid-cols-1 gap-2" data-testid="assessment-row-actions-mobile">
                      <Button
                        className="min-h-11 w-full"
                        variant="outline"
                        onClick={() => {
                          setEditingExclusionsRow(row);
                          setEditingExcludedUnitIds(Array.isArray(row.excludedUnitIdsJson) ? row.excludedUnitIdsJson : []);
                        }}
                      >
                        Edit Exclusions
                      </Button>
                      <Button
                        className="min-h-11 w-full"
                        variant="outline"
                        onClick={() => postingModeMutation.mutate({ row, autoPostEnabled: row.autoPostEnabled ? 0 : 1 })}
                        disabled={postingModeMutation.isPending}
                      >
                        {row.autoPostEnabled ? "Set Manual" : "Set Automatic"}
                      </Button>
                      {row.isActive ? (
                        <ConfirmDialog
                          trigger={
                            <Button className="min-h-11 w-full" variant="outline" disabled={toggleMutation.isPending}>
                              Deactivate
                            </Button>
                          }
                          title="Deactivate Assessment?"
                          description={`Deactivating "${row.name}" will stop future installments from being posted. If installments have already been partially posted, this may create accounting inconsistencies. This action can be reversed by reactivating the assessment.`}
                          confirmLabel="Deactivate"
                          onConfirm={() => toggleMutation.mutate(row)}
                        />
                      ) : (
                        <Button
                          className="min-h-11 w-full"
                          variant="outline"
                          onClick={() => toggleMutation.mutate(row)}
                          disabled={toggleMutation.isPending}
                        >
                          Activate
                        </Button>
                      )}
                    </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Association</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Installments</TableHead>
                  <TableHead>Per Installment</TableHead>
                  <TableHead>Posting</TableHead>
                  <TableHead>Excluded</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-muted-foreground">{activeAssociationName || row.associationId.slice(0, 8)}</TableCell>
                    <TableCell>${row.totalAmount.toFixed(2)}</TableCell>
                    <TableCell>{row.installmentCount}</TableCell>
                    <TableCell>${(row.totalAmount / row.installmentCount).toFixed(2)}</TableCell>
                    <TableCell>{row.autoPostEnabled ? <Badge variant="secondary">Automatic</Badge> : <Badge variant="outline">Manual</Badge>}</TableCell>
                    <TableCell>{Array.isArray(row.excludedUnitIdsJson) ? row.excludedUnitIdsJson.length : 0}</TableCell>
                    <TableCell>{row.isActive ? <Badge>Active</Badge> : <Badge variant="outline">Inactive</Badge>}</TableCell>
                    <TableCell className="text-right">
                      {readOnly ? (
                        <span className="text-xs text-muted-foreground">Read only</span>
                      ) : (
                      <div className="flex justify-end gap-2" data-testid="assessment-row-actions">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingExclusionsRow(row);
                            setEditingExcludedUnitIds(Array.isArray(row.excludedUnitIdsJson) ? row.excludedUnitIdsJson : []);
                          }}
                        >
                          Exclusions
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => postingModeMutation.mutate({ row, autoPostEnabled: row.autoPostEnabled ? 0 : 1 })}
                          disabled={postingModeMutation.isPending}
                        >
                          {row.autoPostEnabled ? "Set Manual" : "Set Auto"}
                        </Button>
                        {row.isActive ? (
                          <ConfirmDialog
                            trigger={
                              <Button variant="outline" size="sm" disabled={toggleMutation.isPending}>
                                Deactivate
                              </Button>
                            }
                            title="Deactivate Assessment?"
                            description={`Deactivating "${row.name}" will stop future installments from being posted. If installments have already been partially posted, this may create accounting inconsistencies. This action can be reversed by reactivating the assessment.`}
                            confirmLabel="Deactivate"
                            onConfirm={() => toggleMutation.mutate(row)}
                          />
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleMutation.mutate(row)}
                            disabled={toggleMutation.isPending}
                          >
                            Activate
                          </Button>
                        )}
                      </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Dialog
        open={Boolean(editingExclusionsRow)}
        onOpenChange={(value) => {
          if (!value) {
            setEditingExclusionsRow(null);
            setEditingExcludedUnitIds([]);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Excluded Units</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Units selected here will be skipped when assessment installments are posted.
            </p>
            <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border p-3">
              {!scopedUnits.length ? (
                <p className="text-sm text-muted-foreground">No units available in the active association.</p>
              ) : scopedUnits.map((unit) => {
                const checked = editingExcludedUnitIds.includes(unit.id);
                return (
                  <label key={unit.id} className="flex items-center justify-between gap-3 text-sm">
                    <span>{unit.unitNumber}</span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        if (event.target.checked) {
                          setEditingExcludedUnitIds((current) => [...current, unit.id]);
                          return;
                        }
                        setEditingExcludedUnitIds((current) => current.filter((value) => value !== unit.id));
                      }}
                    />
                  </label>
                );
              })}
            </div>
            <Button
              className="w-full"
              disabled={!editingExclusionsRow || exclusionsMutation.isPending}
              onClick={() => {
                if (!editingExclusionsRow) return;
                exclusionsMutation.mutate({
                  row: editingExclusionsRow,
                  excludedUnitIds: editingExcludedUnitIds,
                });
              }}
            >
              {exclusionsMutation.isPending ? "Saving..." : "Save Exclusions"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function FinancialAssessmentsPage() {
  return (
    <div className="flex flex-col min-h-0">
      <div className="p-6 space-y-6">
        <WorkspacePageHeader
          title="Special Assessments"
          summary="Track one-time or installment-based assessments and choose whether installments post automatically or only when run manually."
          eyebrow="Finance"
          breadcrumbs={[{ label: "Finance", href: "/app/financial/foundation" }, { label: "Special Assessments" }]}
          subPages={financeSubPages}
        />
        <FinancialAssessmentsContent />
      </div>
    </div>
  );
}
