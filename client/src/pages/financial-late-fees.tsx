// zone: Financials
// persona: Manager, Board Officer, Assisted Board, PM Assistant
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Association, CollectionsHandoff, DelinquencyEscalation, DelinquencyThreshold, LateFeeEvent, LateFeeRule, PaymentPlan } from "@shared/schema";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Plus, Play, Loader2, HandCoins, Receipt } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { useActiveAssociation } from "@/hooks/use-active-association";
import { Checkbox } from "@/components/ui/checkbox";
import { HelpTooltip } from "@/components/help-tooltip";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { financeSubPages } from "@/lib/sub-page-nav";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileTabBar } from "@/components/mobile-tab-bar";

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

type LedgerSummaryRow = { personId: string; unitId: string; balance: number };
type BulkPreviewRow = LedgerSummaryRow & { daysLate: number; calculatedFee: number; selected: boolean };

function formatCurrency(amount: number) {
  return `$${amount.toFixed(2)}`;
}

export function FinancialLateFeesContent() {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"rules" | "activity" | "recovery">("rules");
  const [calcResult, setCalcResult] = useState<{ calculatedFee: number; daysLate: number; appliedEventId: string | null } | null>(null);
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();

  // Bulk run state
  const [bulkRuleId, setBulkRuleId] = useState("");
  const [bulkDueDate, setBulkDueDate] = useState("");
  const [bulkAsOf, setBulkAsOf] = useState(() => new Date().toISOString().slice(0, 10));
  const [previewRows, setPreviewRows] = useState<BulkPreviewRow[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);

  // Payment plan state
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [planForm, setPlanForm] = useState({ unitId: "", personId: "", totalAmount: "", installmentAmount: "", installmentFrequency: "monthly", startDate: new Date().toISOString().slice(0, 10), notes: "" });
  const [thresholdDialogOpen, setThresholdDialogOpen] = useState(false);
  const [thresholdForm, setThresholdForm] = useState({ stage: 1, stageName: "Stage 1 - First Notice", minimumBalance: 100, minimumDaysOverdue: 30, actionType: "notice", lateFeePct: "", lateFeeFlat: "" });

  const { data: rules, isLoading } = useQuery<LateFeeRule[]>({ queryKey: ["/api/financial/late-fee-rules"] });
  const { data: events } = useQuery<LateFeeEvent[]>({ queryKey: ["/api/financial/late-fee-events"] });
  const { data: associations } = useQuery<Association[]>({ queryKey: ["/api/associations"] });

  const summaryQuery = useQuery<LedgerSummaryRow[]>({
    queryKey: ["/api/financial/owner-ledger/summary", activeAssociationId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/financial/owner-ledger/summary/${activeAssociationId}`);
      return res.json();
    },
    enabled: Boolean(activeAssociationId),
  });

  const { data: paymentPlansList = [], refetch: refetchPlans } = useQuery<PaymentPlan[]>({
    queryKey: ["/api/financial/payment-plans", activeAssociationId],
    queryFn: async () => {
      if (!activeAssociationId) return [];
      const res = await apiRequest("GET", `/api/financial/payment-plans?associationId=${activeAssociationId}`);
      return res.json();
    },
    enabled: Boolean(activeAssociationId),
  });

  const createPlan = useMutation({
    mutationFn: async () => {
      if (!activeAssociationId) throw new Error("No association selected");
      const res = await apiRequest("POST", "/api/financial/payment-plans", {
        associationId: activeAssociationId,
        unitId: planForm.unitId,
        personId: planForm.personId,
        totalAmount: Number(planForm.totalAmount),
        installmentAmount: Number(planForm.installmentAmount),
        installmentFrequency: planForm.installmentFrequency,
        startDate: new Date(planForm.startDate).toISOString(),
        nextDueDate: new Date(planForm.startDate).toISOString(),
        notes: planForm.notes || null,
        amountPaid: 0,
      });
      return res.json();
    },
    onSuccess: async () => {
      await refetchPlans();
      setPlanDialogOpen(false);
      setPlanForm({ unitId: "", personId: "", totalAmount: "", installmentAmount: "", installmentFrequency: "monthly", startDate: new Date().toISOString().slice(0, 10), notes: "" });
      toast({ title: "Payment plan created" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const updatePlanStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "completed" | "defaulted" | "cancelled" }) => {
      const res = await apiRequest("PATCH", `/api/financial/payment-plans/${id}`, { status });
      return res.json();
    },
    onSuccess: async () => {
      await refetchPlans();
      toast({ title: "Payment plan updated" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const delinquentWithNoPlan = useMemo(() => {
    const plannedUnitIds = new Set(paymentPlansList.filter(p => p.status === "active").map(p => p.unitId));
    return (summaryQuery.data ?? []).filter(r => r.balance < 0 && !plannedUnitIds.has(r.unitId));
  }, [summaryQuery.data, paymentPlansList]);

  const { data: thresholds = [], refetch: refetchThresholds } = useQuery<DelinquencyThreshold[]>({
    queryKey: ["/api/financial/delinquency-thresholds", activeAssociationId],
    queryFn: async () => {
      if (!activeAssociationId) return [];
      const res = await apiRequest("GET", `/api/financial/delinquency-thresholds?associationId=${activeAssociationId}`);
      return res.json();
    },
    enabled: Boolean(activeAssociationId),
  });

  const { data: escalations = [], refetch: refetchEscalations } = useQuery<DelinquencyEscalation[]>({
    queryKey: ["/api/financial/delinquency-escalations", activeAssociationId],
    queryFn: async () => {
      if (!activeAssociationId) return [];
      const res = await apiRequest("GET", `/api/financial/delinquency-escalations?associationId=${activeAssociationId}`);
      return res.json();
    },
    enabled: Boolean(activeAssociationId),
  });

  const createThreshold = useMutation({
    mutationFn: async () => {
      if (!activeAssociationId) throw new Error("No association selected");
      const res = await apiRequest("POST", "/api/financial/delinquency-thresholds", {
        associationId: activeAssociationId,
        stage: thresholdForm.stage,
        stageName: thresholdForm.stageName,
        minimumBalance: thresholdForm.minimumBalance,
        minimumDaysOverdue: thresholdForm.minimumDaysOverdue,
        actionType: thresholdForm.actionType,
        lateFeePct: thresholdForm.lateFeePct ? parseFloat(thresholdForm.lateFeePct) : null,
        lateFeeFlat: thresholdForm.lateFeeFlat ? parseFloat(thresholdForm.lateFeeFlat) : null,
      });
      return res.json();
    },
    onSuccess: () => {
      void refetchThresholds();
      setThresholdDialogOpen(false);
      toast({ title: "Threshold added" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const runEscalationScan = useMutation({
    mutationFn: async () => {
      if (!activeAssociationId) throw new Error("No association selected");
      const res = await apiRequest("POST", `/api/financial/delinquency-escalations/run?associationId=${activeAssociationId}`);
      return res.json();
    },
    onSuccess: (data: { escalated: number }) => {
      void refetchEscalations();
      toast({ title: `Escalation scan complete`, description: `${data.escalated} records created/updated` });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateEscalation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const res = await apiRequest("PATCH", `/api/financial/delinquency-escalations/${id}`, { status, notes, resolvedAt: status === "resolved" ? new Date().toISOString() : undefined });
      return res.json();
    },
    onSuccess: () => void refetchEscalations(),
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Collections handoff state
  const [handoffDialogOpen, setHandoffDialogOpen] = useState(false);
  const [handoffForm, setHandoffForm] = useState({ unitId: "", personId: "", referralAmount: "", agencyName: "", agencyCaseNumber: "", notes: "" });

  type CollectionsAgingData = {
    buckets: { current: number; days31to60: number; days61to90: number; days91to120: number; over120: number };
    handoffs: CollectionsHandoff[];
    totalDelinquent: number;
    activeHandoffs: number;
    settledAmount: number;
  };

  const { data: agingData, refetch: refetchAging } = useQuery<CollectionsAgingData>({
    queryKey: ["/api/financial/collections-aging", activeAssociationId],
    queryFn: async () => {
      if (!activeAssociationId) return null;
      const res = await apiRequest("GET", `/api/financial/collections-aging?associationId=${activeAssociationId}`);
      return res.json();
    },
    enabled: Boolean(activeAssociationId),
  });

  const createHandoff = useMutation({
    mutationFn: async () => {
      if (!activeAssociationId) throw new Error("No association selected");
      const res = await apiRequest("POST", "/api/financial/collections-handoffs", {
        associationId: activeAssociationId,
        unitId: handoffForm.unitId,
        personId: handoffForm.personId,
        referralDate: new Date().toISOString(),
        referralAmount: parseFloat(handoffForm.referralAmount),
        currentBalance: parseFloat(handoffForm.referralAmount),
        daysPastDue: 0,
        agencyName: handoffForm.agencyName || null,
        agencyCaseNumber: handoffForm.agencyCaseNumber || null,
        notes: handoffForm.notes || null,
      });
      return res.json();
    },
    onSuccess: () => {
      void refetchAging();
      setHandoffDialogOpen(false);
      setHandoffForm({ unitId: "", personId: "", referralAmount: "", agencyName: "", agencyCaseNumber: "", notes: "" });
      toast({ title: "Account referred to collections" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateHandoff = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const res = await apiRequest("PATCH", `/api/financial/collections-handoffs/${id}`, { status, notes });
      return res.json();
    },
    onSuccess: () => void refetchAging(),
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

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

  async function runBulkPreview() {
    if (!activeAssociationId || !bulkRuleId || !bulkDueDate || !bulkAsOf) {
      toast({ title: "Fill in all bulk run fields", variant: "destructive" });
      return;
    }
    const delinquent = (summaryQuery.data ?? []).filter((r) => r.balance < 0);
    if (delinquent.length === 0) {
      toast({ title: "No delinquent accounts found" });
      return;
    }
    setPreviewing(true);
    try {
      const results = await Promise.all(
        delinquent.map(async (row) => {
          const res = await apiRequest("POST", "/api/financial/late-fees/calculate", {
            associationId: activeAssociationId,
            ruleId: bulkRuleId,
            balanceAmount: Math.abs(row.balance),
            dueDate: new Date(bulkDueDate).toISOString(),
            asOfDate: new Date(bulkAsOf).toISOString(),
            referenceType: "unit",
            referenceId: row.unitId,
            apply: false,
          });
          const data = await res.json();
          return { ...row, daysLate: data.daysLate ?? 0, calculatedFee: data.calculatedFee ?? 0, selected: data.calculatedFee > 0 };
        }),
      );
      setPreviewRows(results);
    } catch (e: any) {
      toast({ title: "Preview failed", description: e.message, variant: "destructive" });
    } finally {
      setPreviewing(false);
    }
  }

  async function runBulkApply() {
    const toApply = previewRows.filter((r) => r.selected && r.calculatedFee > 0);
    if (toApply.length === 0) {
      toast({ title: "No accounts selected" });
      return;
    }
    setApplying(true);
    try {
      await Promise.all(
        toApply.map((row) =>
          apiRequest("POST", "/api/financial/late-fees/calculate", {
            associationId: activeAssociationId,
            ruleId: bulkRuleId,
            balanceAmount: Math.abs(row.balance),
            dueDate: new Date(bulkDueDate).toISOString(),
            asOfDate: new Date(bulkAsOf).toISOString(),
            referenceType: "unit",
            referenceId: row.unitId,
            apply: true,
          }),
        ),
      );
      queryClient.invalidateQueries({ queryKey: ["/api/financial/late-fee-events"] });
      toast({ title: `Late fees applied to ${toApply.length} account${toApply.length !== 1 ? "s" : ""}` });
      setPreviewRows([]);
    } catch (e: any) {
      toast({ title: "Apply failed", description: e.message, variant: "destructive" });
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "rules" | "activity" | "recovery")} className="space-y-6">
        {isMobile ? (
          <MobileTabBar
            items={[
              { id: "rules", label: "Rules" },
              { id: "activity", label: "Activity" },
              { id: "recovery", label: "Recovery" },
            ]}
            value={activeTab}
            onChange={setActiveTab}
            variant="tabular"
          />
        ) : (
          <TabsList className="w-full overflow-x-auto">
            <TabsTrigger value="rules" className="shrink-0">Rules &amp; Calculator</TabsTrigger>
            <TabsTrigger value="activity" className="shrink-0">Fee Activity</TabsTrigger>
            <TabsTrigger value="recovery" className="shrink-0">Recovery</TabsTrigger>
          </TabsList>
        )}

        {/* ── Tab 1: Rules & Calculator ── */}
        <TabsContent value="rules" className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Late Fee Rules</h2>
          <p className="text-muted-foreground text-sm">Configure rules that define how late fees are calculated for the active association.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button disabled={!activeAssociationId}>
              <Plus className="h-4 w-4 mr-2" />
              New Rule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto sm:max-h-[85vh]">
            <DialogHeader><DialogTitle>Create Late Fee Rule</DialogTitle></DialogHeader>
            <Form {...ruleForm}>
              <form className="space-y-4" onSubmit={ruleForm.handleSubmit((values) => createRuleMutation.mutate(values))}>
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                  Association Context: <span className="font-medium">{activeAssociationName || "None selected"}</span>
                </div>
                <FormField control={ruleForm.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="Standard late fee rule" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
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
                <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
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
            <EmptyState
              icon={AlertCircle}
              title="No late fee rules"
              description="Create a rule to begin calculating late fees on overdue assessments."
              testId="empty-late-fee-rules"
            />
          ) : isMobile ? (
            <div className="space-y-3 p-4">
              {rules.map((row) => (
                <div key={row.id} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold leading-5">{row.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {assocNameById.get(row.associationId) ?? "Unknown"}
                      </div>
                    </div>
                    {row.isActive ? <Badge>Active</Badge> : <Badge variant="outline">Inactive</Badge>}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                    <div>
                      <div className="uppercase tracking-wide">Type</div>
                      <div className="mt-1"><Badge variant="secondary">{row.feeType}</Badge></div>
                    </div>
                    <div>
                      <div className="uppercase tracking-wide">Amount</div>
                      <div className="mt-1 text-sm text-foreground">
                        {row.feeType === "percent" ? `${row.feeAmount}%` : formatCurrency(row.feeAmount)}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className="uppercase tracking-wide">Grace Period</div>
                      <div className="mt-1 text-sm text-foreground">{row.graceDays} days</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Wave 23 a11y: aria-label names this rules table.
            <Table aria-label="Late fee rules">
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
        <CardContent className="p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Bulk Late Fee Run</h2>
            <p className="text-sm text-muted-foreground">Preview and apply late fees to all delinquent accounts in one step.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">
                Rule
                <HelpTooltip content="Choose the active late fee rule to apply. The rule defines whether the fee is a flat dollar amount or a percentage of the outstanding balance." />
              </label>
              <Select value={bulkRuleId || "none"} onValueChange={(v) => setBulkRuleId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select rule" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select rule</SelectItem>
                  {(rules ?? []).filter((r) => r.isActive).map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">
                Original Due Date
                <HelpTooltip content="The date the original charge was due. Days late = As Of Date minus this date, minus any grace period in the rule." />
              </label>
              <Input type="date" value={bulkDueDate} onChange={(e) => setBulkDueDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">
                As Of Date
                <HelpTooltip content="The date from which to calculate the late fee. Usually today. The fee will be based on how many days past the due date this is." />
              </label>
              <Input type="date" value={bulkAsOf} onChange={(e) => setBulkAsOf(e.target.value)} />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={runBulkPreview}
              disabled={previewing || !activeAssociationId || !bulkRuleId || !bulkDueDate}
            >
              {previewing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
              {previewing ? "Previewing…" : "Preview Run"}
            </Button>
            {previewRows.length > 0 && (() => {
              const selectedCount = previewRows.filter((r) => r.selected).length;
              const totalFee = previewRows.filter((r) => r.selected).reduce((s, r) => s + r.calculatedFee, 0);
              return (
                <ConfirmDialog
                  trigger={
                    <Button disabled={applying || selectedCount === 0}>
                      {applying ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                      {applying ? "Applying…" : `Apply to ${selectedCount} Account${selectedCount !== 1 ? "s" : ""}`}
                    </Button>
                  }
                  title="Apply late fees?"
                  description={`This will post late fee events for ${selectedCount} account${selectedCount !== 1 ? "s" : ""}, totaling $${totalFee.toFixed(2)}. These events will be recorded in the ledger.`}
                  confirmLabel="Apply Late Fees"
                  onConfirm={runBulkApply}
                  disabled={applying || selectedCount === 0}
                />
              );
            })()}
          </div>

          {previewRows.length > 0 && (
            isMobile ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2">
                  <Checkbox
                    checked={previewRows.every((r) => r.selected)}
                    onCheckedChange={(checked) => setPreviewRows((prev) => prev.map((r) => ({ ...r, selected: Boolean(checked) })))}
                  />
                  <span className="text-sm text-muted-foreground">Select all accounts in this preview run</span>
                </div>
                {previewRows.map((row, i) => (
                  <div key={row.unitId} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">{row.unitId.slice(0, 8)}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{row.daysLate} days late</div>
                      </div>
                      <Checkbox
                        checked={row.selected}
                        onCheckedChange={(checked) =>
                          setPreviewRows((prev) => prev.map((r, j) => j === i ? { ...r, selected: Boolean(checked) } : r))
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                      <div>
                        <div className="uppercase tracking-wide">Balance Owed</div>
                        <div className="mt-1 text-sm text-red-600">{formatCurrency(Math.abs(row.balance))}</div>
                      </div>
                      <div>
                        <div className="uppercase tracking-wide">Late Fee</div>
                        <div className="mt-1 text-sm font-semibold text-foreground">{formatCurrency(row.calculatedFee)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-md border overflow-hidden">
                // Wave 23 a11y: aria-label names this preview table.
                <Table aria-label="Late fee batch preview">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">
                        <Checkbox
                          checked={previewRows.every((r) => r.selected)}
                          onCheckedChange={(checked) => setPreviewRows((prev) => prev.map((r) => ({ ...r, selected: Boolean(checked) })))}
                          aria-label="Select all rows"
                        />
                      </TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Balance Owed</TableHead>
                      <TableHead>Days Late</TableHead>
                      <TableHead>Late Fee</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((row, i) => (
                      <TableRow key={row.unitId}>
                        <TableCell>
                          <Checkbox
                            checked={row.selected}
                            onCheckedChange={(checked) =>
                              setPreviewRows((prev) => prev.map((r, j) => j === i ? { ...r, selected: Boolean(checked) } : r))
                            }
                          />
                        </TableCell>
                        <TableCell className="font-medium font-mono text-xs">{row.unitId.slice(0, 8)}</TableCell>
                        <TableCell className="text-red-600">{formatCurrency(Math.abs(row.balance))}</TableCell>
                        <TableCell>{row.daysLate}</TableCell>
                        <TableCell className="font-semibold">{formatCurrency(row.calculatedFee)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          )}
        </CardContent>
      </Card>
        </TabsContent>

        {/* ── Tab 2: Fee Activity ── */}
        <TabsContent value="activity" className="space-y-6">
      <Card>
        <CardContent className="p-0">
          {(events ?? []).length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No fee events yet"
              description="Use the Rules & Calculator tab to apply late fees and start logging events here."
              testId="empty-late-fee-events"
            />
          ) : isMobile ? (
            <div className="space-y-3 p-4">
              {(events ?? []).slice(0, 50).map((event) => (
                <div key={event.id} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm font-semibold leading-5">
                      {rules?.find((r) => r.id === event.ruleId)?.name ?? event.ruleId}
                    </div>
                    <div className="text-sm font-semibold">{formatCurrency(event.calculatedFee)}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                    <div>
                      <div className="uppercase tracking-wide">Balance</div>
                      <div className="mt-1 text-sm text-foreground">{formatCurrency(event.balanceAmount)}</div>
                    </div>
                    <div>
                      <div className="uppercase tracking-wide">Due Date</div>
                      <div className="mt-1 text-sm text-foreground">{new Date(event.dueDate).toLocaleDateString()}</div>
                    </div>
                    <div className="col-span-2">
                      <div className="uppercase tracking-wide">As Of</div>
                      <div className="mt-1 text-sm text-foreground">{new Date(event.asOfDate).toLocaleDateString()}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
          // Wave 23 a11y: aria-label names this events table.
          <Table aria-label="Recently applied late fees">
            <TableHeader>
              <TableRow>
                <TableHead>Rule</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Fee Applied</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>As Of</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(events ?? []).slice(0, 50).map((event) => (
                <TableRow key={event.id}>
                  <TableCell>{rules?.find((r) => r.id === event.ruleId)?.name ?? event.ruleId}</TableCell>
                  <TableCell>${event.balanceAmount.toFixed(2)}</TableCell>
                  <TableCell className="font-medium">${event.calculatedFee.toFixed(2)}</TableCell>
                  <TableCell>{new Date(event.dueDate).toLocaleDateString()}</TableCell>
                  <TableCell>{new Date(event.asOfDate).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>

      {/* Delinquency Thresholds & Escalation */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Delinquency Thresholds &amp; Escalation</h2>
              <p className="text-sm text-muted-foreground">Configure escalation stages and scan for accounts that qualify for escalated collections action.</p>
            </div>
            <div className="flex gap-2">
              <ConfirmDialog
                trigger={
                  <Button size="sm" variant="outline" disabled={!activeAssociationId || runEscalationScan.isPending || thresholds.length === 0}>
                    {runEscalationScan.isPending ? "Scanning..." : "Run Scan"}
                  </Button>
                }
                title="Run escalation scan?"
                description={`This will evaluate all delinquent accounts against your ${thresholds.length} configured threshold stage${thresholds.length !== 1 ? "s" : ""} and create or update escalation records accordingly.`}
                confirmLabel="Run Scan"
                onConfirm={() => runEscalationScan.mutate()}
                disabled={!activeAssociationId || runEscalationScan.isPending || thresholds.length === 0}
              />
              <Dialog open={thresholdDialogOpen} onOpenChange={setThresholdDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" disabled={!activeAssociationId}>Add Threshold</Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto sm:max-h-[85vh]">
                  <DialogHeader><DialogTitle>New Delinquency Threshold</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div className={`grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Stage #</label>
                        <Input type="number" min={1} value={thresholdForm.stage} onChange={(e) => setThresholdForm((f) => ({ ...f, stage: parseInt(e.target.value) || 1 }))} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Action Type</label>
                        <select className="w-full rounded-md border px-3 py-2 text-sm" value={thresholdForm.actionType} onChange={(e) => setThresholdForm((f) => ({ ...f, actionType: e.target.value }))}>
                          <option value="notice">Notice</option>
                          <option value="late_fee">Late Fee</option>
                          <option value="lien">Lien</option>
                          <option value="collections">Collections</option>
                        </select>
                      </div>
                    </div>
                    <Input placeholder="Stage name" value={thresholdForm.stageName} onChange={(e) => setThresholdForm((f) => ({ ...f, stageName: e.target.value }))} />
                    <div className={`grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Min Balance ($)</label>
                        <Input type="number" min={0} step="0.01" value={thresholdForm.minimumBalance} onChange={(e) => setThresholdForm((f) => ({ ...f, minimumBalance: parseFloat(e.target.value) || 0 }))} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Min Days Overdue</label>
                        <Input type="number" min={0} value={thresholdForm.minimumDaysOverdue} onChange={(e) => setThresholdForm((f) => ({ ...f, minimumDaysOverdue: parseInt(e.target.value) || 0 }))} />
                      </div>
                    </div>
                    <div className={`gap-2 ${isMobile ? "grid grid-cols-1" : "flex justify-end"}`}>
                      <Button className={isMobile ? "w-full" : undefined} variant="outline" onClick={() => setThresholdDialogOpen(false)}>Cancel</Button>
                      <Button className={isMobile ? "w-full" : undefined} onClick={() => createThreshold.mutate()} disabled={!thresholdForm.stageName || createThreshold.isPending}>Add</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {thresholds.length > 0 ? (
            <div className="space-y-2">
              <div className="text-sm font-medium">Configured Stages</div>
              <div className="flex flex-wrap gap-2">
                {thresholds.map((t) => (
                  <div key={t.id} className="rounded-md border px-3 py-2 text-sm">
                    <span className="font-medium">Stage {t.stage}</span>: {t.stageName} — ≥${t.minimumBalance} &amp; ≥{t.minimumDaysOverdue}d overdue
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No thresholds configured. Add stages to enable escalation scanning.</div>
          )}

          {escalations.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Active Escalations ({escalations.filter((e) => e.status === "active").length})</div>
              {isMobile ? (
                <div className="space-y-3">
                  {escalations.map((esc) => (
                    <div key={esc.id} className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">{esc.unitId.slice(0, 8)}</div>
                          <div className="mt-1 text-xs text-muted-foreground">Person {esc.personId.slice(0, 8)}</div>
                        </div>
                        <Badge variant={esc.status === "active" ? "destructive" : esc.status === "resolved" ? "default" : "secondary"}>
                          {esc.status}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">Stage {esc.currentStage}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                        <div>
                          <div className="uppercase tracking-wide">Balance</div>
                          <div className="mt-1 text-sm font-medium text-red-600">{formatCurrency(Math.abs(esc.balance))}</div>
                        </div>
                        <div>
                          <div className="uppercase tracking-wide">Days Overdue</div>
                          <div className="mt-1 text-sm text-foreground">{esc.daysPastDue}d</div>
                        </div>
                      </div>
                      {esc.status === "active" && (
                        <div className="grid grid-cols-1 gap-2">
                          <Button className="min-h-11 w-full" variant="outline" onClick={() => updateEscalation.mutate({ id: esc.id, status: "on_payment_plan" })}>Move To Plan</Button>
                          <Button className="min-h-11 w-full" variant="outline" onClick={() => updateEscalation.mutate({ id: esc.id, status: "referred" })}>Refer To Collections</Button>
                          <Button className="min-h-11 w-full" variant="outline" onClick={() => updateEscalation.mutate({ id: esc.id, status: "resolved" })}>Resolve Escalation</Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                // Wave 23 a11y: aria-label names this collections handoff table.
                <Table aria-label="Collections handoff queue">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Unit ID</TableHead>
                      <TableHead>Person ID</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Balance</TableHead>
                      <TableHead>Days Overdue</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {escalations.map((esc) => (
                      <TableRow key={esc.id}>
                        <TableCell className="font-mono text-sm">{esc.unitId.slice(0, 8)}</TableCell>
                        <TableCell className="font-mono text-sm">{esc.personId.slice(0, 8)}</TableCell>
                        <TableCell><Badge variant="outline">Stage {esc.currentStage}</Badge></TableCell>
                        <TableCell className="text-red-600 font-medium">{formatCurrency(Math.abs(esc.balance))}</TableCell>
                        <TableCell>{esc.daysPastDue}d</TableCell>
                        <TableCell><Badge variant={esc.status === "active" ? "destructive" : esc.status === "resolved" ? "default" : "secondary"}>{esc.status}</Badge></TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {esc.status === "active" && (
                              <>
                                <Button size="sm" variant="outline" onClick={() => updateEscalation.mutate({ id: esc.id, status: "on_payment_plan" })}>Plan</Button>
                                <Button size="sm" variant="outline" onClick={() => updateEscalation.mutate({ id: esc.id, status: "referred" })}>Refer</Button>
                                <Button size="sm" variant="outline" onClick={() => updateEscalation.mutate({ id: esc.id, status: "resolved" })}>Resolve</Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        {/* ── Tab 3: Recovery ── */}
        <TabsContent value="recovery" className="space-y-6">
      {/* Payment Plans */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h3 className="text-base font-semibold">Payment Plans</h3>
              <p className="text-sm text-muted-foreground">Create structured installment plans for delinquent accounts.</p>
            </div>
            <div className={`gap-3 ${isMobile ? "grid grid-cols-1 w-full sm:w-auto" : "flex items-center"}`}>
              {delinquentWithNoPlan.length > 0 && (
                <Badge variant="destructive">{delinquentWithNoPlan.length} delinquent without plan</Badge>
              )}
              <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className={isMobile ? "min-h-11 w-full" : undefined} disabled={!activeAssociationId}><Plus className="h-4 w-4 mr-1" />New Plan</Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto sm:max-h-[85vh]">
                  <DialogHeader><DialogTitle>Create Payment Plan</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div className={`grid gap-3 ${isMobile ? "grid-cols-1" : "md:grid-cols-2"}`}>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Unit ID</label>
                        <Input placeholder="Unit ID" value={planForm.unitId} onChange={(e) => setPlanForm((f) => ({ ...f, unitId: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Person ID</label>
                        <Input placeholder="Person ID" value={planForm.personId} onChange={(e) => setPlanForm((f) => ({ ...f, personId: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Total delinquent amount ($)</label>
                        <Input type="number" placeholder="0.00" value={planForm.totalAmount} onChange={(e) => setPlanForm((f) => ({ ...f, totalAmount: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Installment amount ($)</label>
                        <Input type="number" placeholder="0.00" value={planForm.installmentAmount} onChange={(e) => setPlanForm((f) => ({ ...f, installmentAmount: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Frequency</label>
                        <Select value={planForm.installmentFrequency} onValueChange={(v) => setPlanForm((f) => ({ ...f, installmentFrequency: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="biweekly">Bi-weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="quarterly">Quarterly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Start date</label>
                        <Input type="date" value={planForm.startDate} onChange={(e) => setPlanForm((f) => ({ ...f, startDate: e.target.value }))} />
                      </div>
                    </div>
                    <Textarea placeholder="Notes (optional)" value={planForm.notes} onChange={(e) => setPlanForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
                    <div className={`gap-2 ${isMobile ? "grid grid-cols-1" : "flex justify-end"}`}>
                      <Button className={isMobile ? "w-full" : undefined} variant="outline" onClick={() => setPlanDialogOpen(false)}>Cancel</Button>
                      <Button
                        className={isMobile ? "w-full" : undefined}
                        onClick={() => createPlan.mutate()}
                        disabled={!planForm.unitId || !planForm.personId || !planForm.totalAmount || !planForm.installmentAmount || createPlan.isPending}
                      >
                        Create Plan
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          {isMobile ? (
            <div className="space-y-3">
              {paymentPlansList.map((plan) => {
                const remaining = plan.totalAmount - (plan.amountPaid ?? 0);
                return (
                  <div key={plan.id} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{plan.unitId.slice(0, 8)}...</div>
                        <div className="text-xs text-muted-foreground">
                          {plan.nextDueDate ? `Next due ${new Date(plan.nextDueDate).toLocaleDateString()}` : "No next due date"}
                        </div>
                      </div>
                      <Badge variant={plan.status === "active" ? "secondary" : plan.status === "completed" ? "outline" : "destructive"}>{plan.status}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                      <div>
                        <div className="uppercase tracking-wide">Total</div>
                        <div className="mt-1 text-sm text-foreground">${plan.totalAmount.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="uppercase tracking-wide">Paid</div>
                        <div className="mt-1 text-sm text-foreground">${(plan.amountPaid ?? 0).toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="uppercase tracking-wide">Remaining</div>
                        <div className={`mt-1 text-sm font-medium ${remaining > 0 ? "text-destructive" : "text-foreground"}`}>${remaining.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="uppercase tracking-wide">Installment</div>
                        <div className="mt-1 text-sm text-foreground">${plan.installmentAmount.toFixed(2)} / {plan.installmentFrequency}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {plan.status === "active" && (
                        <>
                          <Button className="min-h-11 w-full" variant="outline" onClick={() => updatePlanStatus.mutate({ id: plan.id, status: "completed" })}>Complete Plan</Button>
                          <Button className="min-h-11 w-full" variant="outline" onClick={() => updatePlanStatus.mutate({ id: plan.id, status: "defaulted" })}>Mark Defaulted</Button>
                        </>
                      )}
                      {(plan.status === "defaulted" || plan.status === "cancelled") && (
                        <Button className="min-h-11 w-full" variant="outline" onClick={() => updatePlanStatus.mutate({ id: plan.id, status: "active" })}>Reactivate Plan</Button>
                      )}
                    </div>
                  </div>
                );
              })}
              {paymentPlansList.length === 0 && (
                <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">No payment plans set up yet.</div>
              )}
            </div>
          ) : (
            // Wave 23 a11y: aria-label names this payment plans table.
            <Table aria-label="Payment plans">
              <TableHeader>
                <TableRow>
                  <TableHead>Unit</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Remaining</TableHead>
                  <TableHead>Installment</TableHead>
                  <TableHead>Next Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentPlansList.map((plan) => {
                  const remaining = plan.totalAmount - (plan.amountPaid ?? 0);
                  return (
                    <TableRow key={plan.id}>
                      <TableCell>{plan.unitId.slice(0, 8)}...</TableCell>
                      <TableCell>${plan.totalAmount.toFixed(2)}</TableCell>
                      <TableCell>${(plan.amountPaid ?? 0).toFixed(2)}</TableCell>
                      <TableCell className={remaining > 0 ? "text-destructive font-medium" : ""}>${remaining.toFixed(2)}</TableCell>
                      <TableCell>${plan.installmentAmount.toFixed(2)} / {plan.installmentFrequency}</TableCell>
                      <TableCell>{plan.nextDueDate ? new Date(plan.nextDueDate).toLocaleDateString() : "-"}</TableCell>
                      <TableCell>
                        <Badge variant={plan.status === "active" ? "secondary" : plan.status === "completed" ? "outline" : "destructive"}>{plan.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {plan.status === "active" && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => updatePlanStatus.mutate({ id: plan.id, status: "completed" })}>Complete</Button>
                              <Button size="sm" variant="outline" onClick={() => updatePlanStatus.mutate({ id: plan.id, status: "defaulted" })}>Default</Button>
                            </>
                          )}
                          {(plan.status === "defaulted" || plan.status === "cancelled") && (
                            <Button size="sm" variant="outline" onClick={() => updatePlanStatus.mutate({ id: plan.id, status: "active" })}>Reactivate</Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {paymentPlansList.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="h-16 text-center text-muted-foreground">No payment plans set up yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Collections Handoff & Aging Dashboard */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HandCoins className="h-5 w-5 text-orange-500" />
              <div>
                <div className="font-semibold">Collections Handoff &amp; Aging Dashboard</div>
                <div className="text-xs text-muted-foreground">AR aging buckets and accounts referred to external collections</div>
              </div>
            </div>
            <Dialog open={handoffDialogOpen} onOpenChange={setHandoffDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" disabled={!activeAssociationId}><Plus className="h-4 w-4 mr-1" />Refer Account</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto sm:max-h-[85vh]">
                <DialogHeader><DialogTitle>Refer Account to Collections</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <Input placeholder="Unit ID" value={handoffForm.unitId} onChange={(e) => setHandoffForm((f) => ({ ...f, unitId: e.target.value }))} />
                  <Input placeholder="Person ID" value={handoffForm.personId} onChange={(e) => setHandoffForm((f) => ({ ...f, personId: e.target.value }))} />
                  <Input type="number" placeholder="Referral Amount ($)" value={handoffForm.referralAmount} onChange={(e) => setHandoffForm((f) => ({ ...f, referralAmount: e.target.value }))} />
                  <Input placeholder="Agency Name (optional)" value={handoffForm.agencyName} onChange={(e) => setHandoffForm((f) => ({ ...f, agencyName: e.target.value }))} />
                  <Input placeholder="Agency Case Number (optional)" value={handoffForm.agencyCaseNumber} onChange={(e) => setHandoffForm((f) => ({ ...f, agencyCaseNumber: e.target.value }))} />
                  <Textarea placeholder="Notes (optional)" value={handoffForm.notes} onChange={(e) => setHandoffForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
                  <div className={`gap-2 ${isMobile ? "grid grid-cols-1" : "flex justify-end"}`}>
                    <Button className={isMobile ? "w-full" : undefined} variant="outline" onClick={() => setHandoffDialogOpen(false)}>Cancel</Button>
                    <Button className={isMobile ? "w-full" : undefined} onClick={() => createHandoff.mutate()} disabled={!handoffForm.unitId || !handoffForm.personId || !handoffForm.referralAmount || createHandoff.isPending}>Refer</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {agingData && (
            <>
              {/* Aging Buckets */}
              <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                {[
                  { label: "Current (0-30d)", value: agingData.buckets.current, color: "text-green-600" },
                  { label: "31-60 Days", value: agingData.buckets.days31to60, color: "text-yellow-600" },
                  { label: "61-90 Days", value: agingData.buckets.days61to90, color: "text-orange-500" },
                  { label: "91-120 Days", value: agingData.buckets.days91to120, color: "text-red-500" },
                  { label: "120+ Days", value: agingData.buckets.over120, color: "text-red-700 font-bold" },
                ].map((b) => (
                  <div key={b.label} className="rounded-md border p-3 text-center">
                    <div className={`text-lg font-semibold ${b.color}`}>${b.value.toFixed(0)}</div>
                    <div className="text-xs text-muted-foreground mt-1">{b.label}</div>
                  </div>
                ))}
              </div>

              <div className="flex gap-4 text-sm text-muted-foreground">
                <span>Total Delinquent: <span className="text-red-600 font-medium">${agingData.totalDelinquent.toFixed(2)}</span></span>
                <span>Active Referrals: <span className="font-medium">{agingData.activeHandoffs}</span></span>
                <span>Settled: <span className="text-green-600 font-medium">${agingData.settledAmount.toFixed(2)}</span></span>
              </div>

              {/* Handoff Records */}
              {agingData.handoffs.length > 0 && (
                isMobile ? (
                  <div className="space-y-3">
                    {agingData.handoffs.map((h) => (
                      <div key={h.id} className="rounded-lg border p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium">{h.unitId.slice(0, 8)}</div>
                            <div className="text-xs text-muted-foreground">
                              Referred {new Date(h.referralDate).toLocaleDateString()}
                            </div>
                          </div>
                          <Badge variant={h.status === "settled" ? "default" : h.status === "active" ? "destructive" : "secondary"}>
                            {h.status}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                          <div>
                            <div className="uppercase tracking-wide">Referred</div>
                            <div className="mt-1 text-sm text-red-600">${h.referralAmount.toFixed(2)}</div>
                          </div>
                          <div>
                            <div className="uppercase tracking-wide">Current Balance</div>
                            <div className="mt-1 text-sm text-red-600">${h.currentBalance.toFixed(2)}</div>
                          </div>
                          <div>
                            <div className="uppercase tracking-wide">Person</div>
                            <div className="mt-1 text-sm text-foreground">{h.personId.slice(0, 8)}</div>
                          </div>
                          <div>
                            <div className="uppercase tracking-wide">Agency</div>
                            <div className="mt-1 text-sm text-foreground">{h.agencyName ?? "—"}</div>
                          </div>
                        </div>
                        {(h.status === "referred" || h.status === "active") && (
                          <div className="grid grid-cols-1 gap-2">
                            <Button className="min-h-11 w-full" variant="outline" onClick={() => updateHandoff.mutate({ id: h.id, status: "active" })}>Activate Referral</Button>
                            <Button className="min-h-11 w-full" variant="outline" onClick={() => updateHandoff.mutate({ id: h.id, status: "settled" })}>Mark Settled</Button>
                            <Button className="min-h-11 w-full" variant="outline" onClick={() => updateHandoff.mutate({ id: h.id, status: "withdrawn" })}>Withdraw Referral</Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Unit</TableHead>
                        <TableHead>Person</TableHead>
                        <TableHead>Referral Date</TableHead>
                        <TableHead>Referred Amount</TableHead>
                        <TableHead>Current Balance</TableHead>
                        <TableHead>Agency</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {agingData.handoffs.map((h) => (
                        <TableRow key={h.id}>
                          <TableCell className="font-mono text-xs">{h.unitId.slice(0, 8)}</TableCell>
                          <TableCell className="font-mono text-xs">{h.personId.slice(0, 8)}</TableCell>
                          <TableCell className="text-sm">{new Date(h.referralDate).toLocaleDateString()}</TableCell>
                          <TableCell className="text-red-600">${h.referralAmount.toFixed(2)}</TableCell>
                          <TableCell className="text-red-600">${h.currentBalance.toFixed(2)}</TableCell>
                          <TableCell className="text-sm">{h.agencyName ?? "—"}</TableCell>
                          <TableCell>
                            <Badge variant={h.status === "settled" ? "default" : h.status === "active" ? "destructive" : "secondary"}>
                              {h.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {(h.status === "referred" || h.status === "active") && (
                                <>
                                  <Button size="sm" variant="outline" onClick={() => updateHandoff.mutate({ id: h.id, status: "active" })}>Activate</Button>
                                  <Button size="sm" variant="outline" onClick={() => updateHandoff.mutate({ id: h.id, status: "settled" })}>Settled</Button>
                                  <Button size="sm" variant="outline" onClick={() => updateHandoff.mutate({ id: h.id, status: "withdrawn" })}>Withdraw</Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )
              )}
              {agingData.handoffs.length === 0 && (
                <div className="text-sm text-muted-foreground">No accounts currently referred to collections.</div>
              )}
            </>
          )}
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function FinancialLateFeesPage() {
  return (
    // Wave 23 a11y: section + aria-labelledby (heading id below).
    <section className="flex flex-col min-h-0" aria-labelledby="financial-late-fees-heading">
      <div className="p-6 space-y-6">
        <WorkspacePageHeader
          title="Late Fees"
          headingId="financial-late-fees-heading"
          eyebrow="Finance"
          summary="Manage late fee rules, review applied fees, and recover delinquent balances through payment plans and collections handoffs."
          breadcrumbs={[{ label: "Finance", href: "/app/financial/foundation" }, { label: "Late Fees" }]}
          subPages={financeSubPages}
        />
        <FinancialLateFeesContent />
      </div>
    </section>
  );
}
