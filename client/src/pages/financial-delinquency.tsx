import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { DelinquencyEscalation, DelinquencyThreshold, Person, Unit } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { AlertCircle, Plus, ScanSearch, Loader2, ChevronDown, ChevronRight, Pencil, Trash2, RefreshCw, Download } from "lucide-react";
import { ExportCsvButton } from "@/components/export-csv-button";
import { useActiveAssociation } from "@/hooks/use-active-association";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileTabBar } from "@/components/mobile-tab-bar";

function formatCurrency(amount: number) {
  return `$${Math.abs(amount).toFixed(2)}`;
}

function statusBadgeVariant(status: string) {
  if (status === "active") return "destructive" as const;
  if (status === "resolved") return "default" as const;
  return "secondary" as const;
}

const statusLabels: Record<string, string> = {
  active: "Active",
  resolved: "Resolved",
  referred: "Referred",
  on_payment_plan: "On Plan",
};

const actionTypeOptions = ["notice", "late_fee", "lien", "collections"] as const;

type EscalationRow = DelinquencyEscalation & { unitNumber?: string; personName?: string };

export function FinancialDelinquencyContent() {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();
  const [activeTab, setActiveTab] = useState<"thresholds" | "escalations" | "aging" | "notices" | "settings">("escalations");

  // --- Thresholds ---
  const [thresholdDialogOpen, setThresholdDialogOpen] = useState(false);
  const [editingThreshold, setEditingThreshold] = useState<DelinquencyThreshold | null>(null);
  const [thresholdForm, setThresholdForm] = useState({
    stage: 1,
    stageName: "",
    minimumBalance: 100,
    minimumDaysOverdue: 30,
    actionType: "notice" as string,
    lateFeePct: "",
    lateFeeFlat: "",
    isActive: 1,
  });

  const {
    data: thresholds = [],
    isLoading: thresholdsLoading,
    refetch: refetchThresholds,
  } = useQuery<DelinquencyThreshold[]>({
    queryKey: ["/api/financial/delinquency-thresholds", activeAssociationId],
    queryFn: async () => {
      if (!activeAssociationId) return [];
      const res = await apiRequest("GET", `/api/financial/delinquency-thresholds?associationId=${activeAssociationId}`);
      return res.json();
    },
    enabled: Boolean(activeAssociationId),
  });

  // --- Escalations ---
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const {
    data: escalations = [],
    isLoading: escalationsLoading,
    refetch: refetchEscalations,
  } = useQuery<DelinquencyEscalation[]>({
    queryKey: ["/api/financial/delinquency-escalations", activeAssociationId],
    queryFn: async () => {
      if (!activeAssociationId) return [];
      const res = await apiRequest("GET", `/api/financial/delinquency-escalations?associationId=${activeAssociationId}`);
      return res.json();
    },
    enabled: Boolean(activeAssociationId),
  });

  const { data: units = [] } = useQuery<Unit[]>({ queryKey: ["/api/units"] });
  const { data: persons = [] } = useQuery<Person[]>({ queryKey: ["/api/persons"] });

  const unitMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of units) m.set(u.id, u.unitNumber ?? u.id.slice(0, 8));
    return m;
  }, [units]);

  const personMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of persons) m.set(p.id, [p.firstName, p.lastName].filter(Boolean).join(" ") || p.id.slice(0, 8));
    return m;
  }, [persons]);

  const enrichedEscalations: EscalationRow[] = useMemo(
    () =>
      escalations.map((e) => ({
        ...e,
        unitNumber: unitMap.get(e.unitId) ?? e.unitId.slice(0, 8),
        personName: personMap.get(e.personId) ?? e.personId.slice(0, 8),
      })),
    [escalations, unitMap, personMap],
  );

  const filteredEscalations = useMemo(
    () =>
      statusFilter === "all"
        ? enrichedEscalations
        : enrichedEscalations.filter((e) => e.status === statusFilter),
    [enrichedEscalations, statusFilter],
  );

  // --- Mutations ---
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
        isActive: thresholdForm.isActive,
      });
      return res.json();
    },
    onSuccess: () => {
      void refetchThresholds();
      setThresholdDialogOpen(false);
      resetThresholdForm();
      toast({ title: "Threshold saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateThreshold = useMutation({
    mutationFn: async () => {
      if (!editingThreshold) return;
      const res = await apiRequest("PATCH", `/api/financial/delinquency-thresholds/${editingThreshold.id}`, {
        stage: thresholdForm.stage,
        stageName: thresholdForm.stageName,
        minimumBalance: thresholdForm.minimumBalance,
        minimumDaysOverdue: thresholdForm.minimumDaysOverdue,
        actionType: thresholdForm.actionType,
        lateFeePct: thresholdForm.lateFeePct ? parseFloat(thresholdForm.lateFeePct) : null,
        lateFeeFlat: thresholdForm.lateFeeFlat ? parseFloat(thresholdForm.lateFeeFlat) : null,
        isActive: thresholdForm.isActive,
      });
      return res.json();
    },
    onSuccess: () => {
      void refetchThresholds();
      setThresholdDialogOpen(false);
      setEditingThreshold(null);
      resetThresholdForm();
      toast({ title: "Threshold updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteThreshold = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/financial/delinquency-thresholds/${id}`);
    },
    onSuccess: () => {
      void refetchThresholds();
      toast({ title: "Threshold deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const runScan = useMutation({
    mutationFn: async () => {
      if (!activeAssociationId) throw new Error("No association selected");
      const res = await apiRequest("POST", `/api/financial/delinquency-escalations/run?associationId=${activeAssociationId}`);
      return res.json();
    },
    onSuccess: (data: { escalated: number; message?: string }) => {
      void refetchEscalations();
      toast({
        title: "Scan complete",
        description: data.message ?? `${data.escalated} escalation record${data.escalated !== 1 ? "s" : ""} created or advanced`,
      });
    },
    onError: (e: Error) => toast({ title: "Scan failed", description: e.message, variant: "destructive" }),
  });

  const updateEscalation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const res = await apiRequest("PATCH", `/api/financial/delinquency-escalations/${id}`, {
        status,
        notes: notes ?? undefined,
        resolvedAt: status === "resolved" ? new Date().toISOString() : undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      void refetchEscalations();
      toast({ title: "Escalation updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function resetThresholdForm() {
    setThresholdForm({ stage: 1, stageName: "", minimumBalance: 100, minimumDaysOverdue: 30, actionType: "notice", lateFeePct: "", lateFeeFlat: "", isActive: 1 });
  }

  function openEditThreshold(t: DelinquencyThreshold) {
    setEditingThreshold(t);
    setThresholdForm({
      stage: t.stage,
      stageName: t.stageName,
      minimumBalance: t.minimumBalance,
      minimumDaysOverdue: t.minimumDaysOverdue,
      actionType: t.actionType,
      lateFeePct: t.lateFeePct != null ? String(t.lateFeePct) : "",
      lateFeeFlat: t.lateFeeFlat != null ? String(t.lateFeeFlat) : "",
      isActive: t.isActive,
    });
    setThresholdDialogOpen(true);
  }

  function openNewThreshold() {
    setEditingThreshold(null);
    resetThresholdForm();
    setThresholdDialogOpen(true);
  }

  const activeCount = escalations.filter((e) => e.status === "active").length;
  const totalOwed = escalations
    .filter((e) => e.status === "active")
    .reduce((s, e) => s + Math.abs(e.balance), 0);

  // --- Threshold dialog form ---
  const thresholdDialogContent = (
    <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto sm:max-h-[85vh]">
      <DialogHeader>
        <DialogTitle>{editingThreshold ? "Edit Threshold" : "New Delinquency Threshold"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
          Association: <span className="font-medium">{activeAssociationName || "None"}</span>
        </div>
        <div className={`grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Stage #</label>
            <Input
              type="number"
              min={1}
              max={10}
              value={thresholdForm.stage}
              onChange={(e) => setThresholdForm((f) => ({ ...f, stage: parseInt(e.target.value) || 1 }))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Action Type</label>
            <Select value={thresholdForm.actionType} onValueChange={(v) => setThresholdForm((f) => ({ ...f, actionType: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {actionTypeOptions.map((o) => (
                  <SelectItem key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1).replace("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Stage Name</label>
          <Input
            placeholder="e.g. Stage 1 – First Notice"
            value={thresholdForm.stageName}
            onChange={(e) => setThresholdForm((f) => ({ ...f, stageName: e.target.value }))}
          />
        </div>
        <div className={`grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Min Balance ($)</label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={thresholdForm.minimumBalance}
              onChange={(e) => setThresholdForm((f) => ({ ...f, minimumBalance: parseFloat(e.target.value) || 0 }))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Min Days Overdue</label>
            <Input
              type="number"
              min={0}
              value={thresholdForm.minimumDaysOverdue}
              onChange={(e) => setThresholdForm((f) => ({ ...f, minimumDaysOverdue: parseInt(e.target.value) || 0 }))}
            />
          </div>
        </div>
        <div className={`grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Late Fee % (optional)</label>
            <Input
              type="number"
              min={0}
              step="0.01"
              placeholder="e.g. 1.5"
              value={thresholdForm.lateFeePct}
              onChange={(e) => setThresholdForm((f) => ({ ...f, lateFeePct: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Late Fee Flat $ (optional)</label>
            <Input
              type="number"
              min={0}
              step="0.01"
              placeholder="e.g. 25.00"
              value={thresholdForm.lateFeeFlat}
              onChange={(e) => setThresholdForm((f) => ({ ...f, lateFeeFlat: e.target.value }))}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isActive"
            checked={thresholdForm.isActive === 1}
            onChange={(e) => setThresholdForm((f) => ({ ...f, isActive: e.target.checked ? 1 : 0 }))}
            className="h-4 w-4"
          />
          <label htmlFor="isActive" className="text-sm">Active</label>
        </div>
        <div className={`gap-2 ${isMobile ? "grid grid-cols-1" : "flex justify-end"}`}>
          <Button
            className={isMobile ? "w-full" : undefined}
            variant="outline"
            onClick={() => { setThresholdDialogOpen(false); setEditingThreshold(null); resetThresholdForm(); }}
          >
            Cancel
          </Button>
          <Button
            className={isMobile ? "w-full" : undefined}
            onClick={() => editingThreshold ? updateThreshold.mutate() : createThreshold.mutate()}
            disabled={!thresholdForm.stageName || createThreshold.isPending || updateThreshold.isPending}
          >
            {createThreshold.isPending || updateThreshold.isPending ? "Saving..." : editingThreshold ? "Update" : "Add Threshold"}
          </Button>
        </div>
      </div>
    </DialogContent>
  );

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className={`grid gap-4 ${isMobile ? "grid-cols-2" : "grid-cols-4"}`}>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Active Escalations</div>
            <div className="text-2xl font-bold mt-1">{activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Total Owed</div>
            <div className="text-2xl font-bold mt-1 text-red-600">{formatCurrency(totalOwed)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">On Payment Plan</div>
            <div className="text-2xl font-bold mt-1">{escalations.filter((e) => e.status === "on_payment_plan").length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Referred</div>
            <div className="text-2xl font-bold mt-1">{escalations.filter((e) => e.status === "referred").length}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "thresholds" | "escalations")} className="space-y-6">
        {isMobile ? (
          <MobileTabBar
            items={[
              { id: "escalations", label: "Escalations" },
              { id: "thresholds", label: "Thresholds" },
              { id: "aging", label: "Aging" },
              { id: "notices", label: "Notices" },
              { id: "settings", label: "Settings" },
            ]}
            value={activeTab}
            onChange={setActiveTab}
            variant="tabular"
          />
        ) : (
          <TabsList>
            <TabsTrigger value="escalations">Active Escalations</TabsTrigger>
            <TabsTrigger value="thresholds">Threshold Config</TabsTrigger>
            <TabsTrigger value="aging">Aging</TabsTrigger>
            <TabsTrigger value="notices">Notices</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
        )}

        {/* ── Escalations tab ── */}
        <TabsContent value="escalations" className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_payment_plan">On Plan</SelectItem>
                  <SelectItem value="referred">Referred</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">{filteredEscalations.length} record{filteredEscalations.length !== 1 ? "s" : ""}</span>
            </div>
            <ConfirmDialog
              trigger={
                <Button disabled={!activeAssociationId || runScan.isPending || thresholds.filter((t) => t.isActive).length === 0}>
                  {runScan.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ScanSearch className="h-4 w-4 mr-2" />
                  )}
                  {runScan.isPending ? "Scanning..." : "Run Delinquency Scan"}
                </Button>
              }
              title="Run delinquency scan?"
              description={`This will evaluate all owner ledger balances against your ${thresholds.filter((t) => t.isActive).length} active threshold stage${thresholds.filter((t) => t.isActive).length !== 1 ? "s" : ""} and create or advance escalation records.`}
              confirmLabel="Run Scan"
              onConfirm={() => runScan.mutate()}
              disabled={!activeAssociationId || runScan.isPending}
            />
          </div>

          <Card>
            <CardContent className="p-0">
              {escalationsLoading ? (
                <div className="p-6 space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : filteredEscalations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <AlertCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium">No escalations found</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {thresholds.filter((t) => t.isActive).length === 0
                      ? "Configure thresholds first, then run a scan to identify delinquent accounts."
                      : "Run a delinquency scan to check for accounts exceeding configured thresholds."}
                  </p>
                </div>
              ) : isMobile ? (
                <div className="space-y-3 p-4">
                  {filteredEscalations.map((esc) => (
                    <div key={esc.id} className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">Unit {esc.unitNumber}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{esc.personName}</div>
                        </div>
                        <Badge variant={statusBadgeVariant(esc.status)}>{statusLabels[esc.status] ?? esc.status}</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                        <div>
                          <div className="uppercase tracking-wide">Stage</div>
                          <div className="mt-1"><Badge variant="outline">Stage {esc.currentStage}</Badge></div>
                        </div>
                        <div>
                          <div className="uppercase tracking-wide">Balance</div>
                          <div className="mt-1 text-sm font-medium text-red-600">{formatCurrency(esc.balance)}</div>
                        </div>
                        <div>
                          <div className="uppercase tracking-wide">Days Overdue</div>
                          <div className="mt-1 text-sm text-foreground">{esc.daysPastDue}d</div>
                        </div>
                      </div>
                      {esc.status === "active" && (
                        <div className="grid grid-cols-1 gap-2">
                          <Button className="min-h-11 w-full" size="sm" variant="outline" onClick={() => updateEscalation.mutate({ id: esc.id, status: "on_payment_plan" })}>Move to Plan</Button>
                          <Button className="min-h-11 w-full" size="sm" variant="outline" onClick={() => updateEscalation.mutate({ id: esc.id, status: "referred" })}>Refer to Collections</Button>
                          <Button className="min-h-11 w-full" size="sm" variant="outline" onClick={() => updateEscalation.mutate({ id: esc.id, status: "resolved" })}>Resolve</Button>
                        </div>
                      )}
                      {esc.notes && (
                        <div className="text-xs text-muted-foreground border-t pt-2">{esc.notes}</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Resident</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Amount Owed</TableHead>
                      <TableHead>Days Overdue</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEscalations.map((esc) => (
                      <>
                        <TableRow
                          key={esc.id}
                          className="cursor-pointer hover:bg-muted/40"
                          onClick={() => setExpandedId(expandedId === esc.id ? null : esc.id)}
                        >
                          <TableCell>
                            {expandedId === esc.id
                              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          </TableCell>
                          <TableCell className="font-medium">Unit {esc.unitNumber}</TableCell>
                          <TableCell className="text-muted-foreground">{esc.personName}</TableCell>
                          <TableCell><Badge variant="outline">Stage {esc.currentStage}</Badge></TableCell>
                          <TableCell className="text-red-600 font-medium">{formatCurrency(esc.balance)}</TableCell>
                          <TableCell>{esc.daysPastDue}d</TableCell>
                          <TableCell>
                            <Badge variant={statusBadgeVariant(esc.status)}>{statusLabels[esc.status] ?? esc.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            {esc.status === "active" && (
                              <div className="flex justify-end gap-1">
                                <Button size="sm" variant="outline" onClick={() => updateEscalation.mutate({ id: esc.id, status: "on_payment_plan" })}>Plan</Button>
                                <Button size="sm" variant="outline" onClick={() => updateEscalation.mutate({ id: esc.id, status: "referred" })}>Refer</Button>
                                <Button size="sm" variant="outline" onClick={() => updateEscalation.mutate({ id: esc.id, status: "resolved" })}>Resolve</Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                        {expandedId === esc.id && (
                          <TableRow key={`${esc.id}-detail`} className="bg-muted/20">
                            <TableCell colSpan={8} className="px-6 py-4">
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                  <div>
                                    <div className="text-xs text-muted-foreground">Created</div>
                                    <div>{new Date(esc.createdAt).toLocaleDateString()}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-muted-foreground">Last Updated</div>
                                    <div>{new Date(esc.updatedAt).toLocaleDateString()}</div>
                                  </div>
                                  {esc.lastNoticeAt && (
                                    <div>
                                      <div className="text-xs text-muted-foreground">Last Notice</div>
                                      <div>{new Date(esc.lastNoticeAt).toLocaleDateString()}</div>
                                    </div>
                                  )}
                                  {esc.resolvedAt && (
                                    <div>
                                      <div className="text-xs text-muted-foreground">Resolved At</div>
                                      <div>{new Date(esc.resolvedAt).toLocaleDateString()}</div>
                                    </div>
                                  )}
                                </div>
                                {esc.notes && (
                                  <div className="text-sm text-muted-foreground">
                                    <span className="font-medium text-foreground">Notes: </span>{esc.notes}
                                  </div>
                                )}
                                {esc.status === "active" && (
                                  <div className="space-y-2">
                                    <label className="text-xs font-medium text-muted-foreground">Add / update notes</label>
                                    <div className="flex gap-2">
                                      <Textarea
                                        rows={2}
                                        className="text-sm"
                                        placeholder="Internal notes..."
                                        value={notesById[esc.id] ?? ""}
                                        onChange={(e) => setNotesById((prev) => ({ ...prev, [esc.id]: e.target.value }))}
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="self-end"
                                        disabled={updateEscalation.isPending}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          updateEscalation.mutate({ id: esc.id, status: esc.status, notes: notesById[esc.id] });
                                        }}
                                      >
                                        Save
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Thresholds tab ── */}
        <TabsContent value="thresholds" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">
                Configure escalation stages. When you run a scan, accounts matching a stage's minimum balance and days-overdue will be escalated.
              </p>
            </div>
            <Dialog open={thresholdDialogOpen} onOpenChange={(open) => { setThresholdDialogOpen(open); if (!open) { setEditingThreshold(null); resetThresholdForm(); } }}>
              <DialogTrigger asChild>
                <Button onClick={openNewThreshold} disabled={!activeAssociationId}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Threshold
                </Button>
              </DialogTrigger>
              {thresholdDialogContent}
            </Dialog>
          </div>

          <Card>
            <CardContent className="p-0">
              {thresholdsLoading ? (
                <div className="p-6 space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : thresholds.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <AlertCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium">No thresholds configured</h3>
                  <p className="text-sm text-muted-foreground mt-1">Add escalation stages to enable the delinquency scan.</p>
                </div>
              ) : isMobile ? (
                <div className="space-y-3 p-4">
                  {thresholds.map((t) => (
                    <div key={t.id} className="rounded-lg border p-4 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">Stage {t.stage}: {t.stageName}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Min ${t.minimumBalance} &bull; {t.minimumDaysOverdue}d overdue
                          </div>
                        </div>
                        {t.isActive ? <Badge>Active</Badge> : <Badge variant="outline">Inactive</Badge>}
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="secondary">{t.actionType}</Badge>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" variant="outline" onClick={() => openEditThreshold(t)}><Pencil className="h-3 w-3 mr-1" />Edit</Button>
                        <ConfirmDialog
                          trigger={<Button size="sm" variant="outline"><Trash2 className="h-3 w-3 mr-1" />Delete</Button>}
                          title="Delete threshold?"
                          description={`Remove Stage ${t.stage}: ${t.stageName}? This will not remove existing escalation records.`}
                          confirmLabel="Delete"
                          onConfirm={() => deleteThreshold.mutate(t.id)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Stage</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Min Balance</TableHead>
                      <TableHead>Min Days Overdue</TableHead>
                      <TableHead>Late Fee</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {thresholds.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.stage}</TableCell>
                        <TableCell>{t.stageName}</TableCell>
                        <TableCell><Badge variant="secondary">{t.actionType}</Badge></TableCell>
                        <TableCell>${t.minimumBalance.toFixed(2)}</TableCell>
                        <TableCell>{t.minimumDaysOverdue}d</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {t.lateFeePct != null ? `${t.lateFeePct}%` : t.lateFeeFlat != null ? `$${t.lateFeeFlat.toFixed(2)}` : "—"}
                        </TableCell>
                        <TableCell>{t.isActive ? <Badge>Active</Badge> : <Badge variant="outline">Inactive</Badge>}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Dialog open={thresholdDialogOpen && editingThreshold?.id === t.id} onOpenChange={(open) => { if (!open) { setThresholdDialogOpen(false); setEditingThreshold(null); resetThresholdForm(); } }}>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="outline" onClick={() => openEditThreshold(t)}>
                                  <Pencil className="h-3 w-3 mr-1" />Edit
                                </Button>
                              </DialogTrigger>
                              {thresholdDialogContent}
                            </Dialog>
                            <ConfirmDialog
                              trigger={
                                <Button size="sm" variant="outline">
                                  <Trash2 className="h-3 w-3 mr-1" />Delete
                                </Button>
                              }
                              title="Delete threshold?"
                              description={`Remove Stage ${t.stage}: "${t.stageName}"? Existing escalation records will not be affected.`}
                              confirmLabel="Delete"
                              onConfirm={() => deleteThreshold.mutate(t.id)}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Aging tab ── */}
        <TabsContent value="aging" className="space-y-4">
          <AgingDashboard associationId={activeAssociationId} />
        </TabsContent>

        {/* ── Notices tab ── */}
        <TabsContent value="notices" className="space-y-4">
          <NoticesTab associationId={activeAssociationId} />
        </TabsContent>

        {/* ── Settings tab ── */}
        <TabsContent value="settings" className="space-y-4">
          <DelinquencySettingsTab associationId={activeAssociationId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Phase 3: Aging Dashboard ─────────────────────────────────────────────────

type AgingUnit = {
  unitId: string; balance: number; bucket: string; daysPastDue: number;
  personId: string | null; personName: string | null; unitNumber: string | null;
  lastPaymentDate: string | null; noticeStage: string | null;
  nextRetryAt: string | null; autopayEnrolled: boolean;
};

type AgingData = {
  buckets: { current: number; days31to60: number; days61to90: number; days91to120: number; over120: number };
  unitAging: AgingUnit[];
  totalDelinquent: number;
};

function AgingDashboard({ associationId }: { associationId: string | null }) {
  const [bucketFilter, setBucketFilter] = useState("all");
  const { data, isLoading } = useQuery<AgingData>({
    queryKey: ["/api/financial/collections-aging", associationId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/financial/collections-aging?associationId=${associationId}`);
      return res.json();
    },
    enabled: Boolean(associationId),
  });

  const { toast } = useToast();
  const runRetries = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/financial/retries/run");
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (r) => toast({ title: "Retries complete", description: `${r.retried} retried, ${r.succeeded} succeeded, ${r.failed} failed` }),
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (!associationId) return <div className="text-sm text-muted-foreground p-4">Select an association.</div>;
  if (isLoading) return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;

  const buckets = data?.buckets ?? { current: 0, days31to60: 0, days61to90: 0, days91to120: 0, over120: 0 };
  const units = data?.unitAging ?? [];
  const filtered = bucketFilter === "all" ? units : units.filter(u => u.bucket === bucketFilter);

  const bucketCards = [
    { key: "current", label: "Current (0-30)", amount: buckets.current, color: "text-green-700 bg-green-50 border-green-200" },
    { key: "days31to60", label: "31-60 Days", amount: buckets.days31to60, color: "text-amber-700 bg-amber-50 border-amber-200" },
    { key: "days61to90", label: "61-90 Days", amount: buckets.days61to90, color: "text-orange-700 bg-orange-50 border-orange-200" },
    { key: "days91to120", label: "91-120 Days", amount: buckets.days91to120, color: "text-red-600 bg-red-50 border-red-200" },
    { key: "over120", label: "120+ Days", amount: buckets.over120, color: "text-red-800 bg-red-100 border-red-300" },
  ];

  const csvHeaders = ["Unit", "Owner", "Balance", "Bucket", "Days Past Due", "Last Payment", "Notice Stage", "Next Retry", "Autopay"];
  const csvRows = filtered.map(u => [
    u.unitNumber ?? u.unitId.slice(0, 8),
    u.personName ?? "—",
    `$${u.balance.toFixed(2)}`,
    u.bucket,
    String(u.daysPastDue),
    u.lastPaymentDate ? new Date(u.lastPaymentDate).toLocaleDateString() : "—",
    u.noticeStage ?? "—",
    u.nextRetryAt ? new Date(u.nextRetryAt).toLocaleDateString() : "—",
    u.autopayEnrolled ? "Yes" : "No",
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-muted-foreground">
          Total delinquent: <span className="font-bold text-foreground">${(data?.totalDelinquent ?? 0).toFixed(2)}</span>
          {" · "}{filtered.length} unit{filtered.length !== 1 ? "s" : ""}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => runRetries.mutate()} disabled={runRetries.isPending}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${runRetries.isPending ? "animate-spin" : ""}`} />
            Run Retries
          </Button>
          <ExportCsvButton headers={csvHeaders} rows={csvRows} filename={`aging-${associationId}`} size="sm" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {bucketCards.map(b => (
          <button
            key={b.key}
            onClick={() => setBucketFilter(bucketFilter === b.key ? "all" : b.key)}
            className={`rounded-lg border p-3 text-left transition-all ${b.color} ${bucketFilter === b.key ? "ring-2 ring-primary" : ""}`}
          >
            <p className="text-xs font-medium opacity-75">{b.label}</p>
            <p className="text-lg font-bold tabular-nums">${b.amount.toFixed(2)}</p>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-8">No delinquent accounts in this bucket.</div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Unit</TableHead>
                  <TableHead className="text-xs">Owner</TableHead>
                  <TableHead className="text-xs text-right">Balance</TableHead>
                  <TableHead className="text-xs">Bucket</TableHead>
                  <TableHead className="text-xs">Days</TableHead>
                  <TableHead className="text-xs">Last Payment</TableHead>
                  <TableHead className="text-xs">Notice</TableHead>
                  <TableHead className="text-xs">Next Retry</TableHead>
                  <TableHead className="text-xs">Autopay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(u => (
                  <TableRow key={u.unitId}>
                    <TableCell className="text-sm font-medium">{u.unitNumber ?? u.unitId.slice(0, 8)}</TableCell>
                    <TableCell className="text-sm">{u.personName ?? "—"}</TableCell>
                    <TableCell className="text-sm text-right font-medium tabular-nums text-destructive">${u.balance.toFixed(2)}</TableCell>
                    <TableCell><Badge variant={u.bucket === "over120" ? "destructive" : u.bucket === "current" ? "secondary" : "default"} className="text-xs">{u.bucket}</Badge></TableCell>
                    <TableCell className="text-sm tabular-nums">{u.daysPastDue}</TableCell>
                    <TableCell className="text-xs">{u.lastPaymentDate ? new Date(u.lastPaymentDate).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>{u.noticeStage ? <Badge variant="outline" className="text-xs">{u.noticeStage.replace(/_/g, " ")}</Badge> : "—"}</TableCell>
                    <TableCell className="text-xs">{u.nextRetryAt ? new Date(u.nextRetryAt).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>{u.autopayEnrolled ? <Badge variant="default" className="text-xs">Yes</Badge> : <span className="text-xs text-muted-foreground">No</span>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Phase 3: Notices Tab ─────────────────────────────────────────────────────

type NoticeRow = {
  id: string; noticeStage: string; triggerDaysPastDue: number;
  amountOwedCents: number; status: string; personId: string; unitId: string;
  delinquencyPeriodKey: string; createdAt: string;
};

function NoticesTab({ associationId }: { associationId: string | null }) {
  const { toast } = useToast();
  const { data: notices = [], isLoading, refetch } = useQuery<NoticeRow[]>({
    queryKey: ["/api/financial/delinquency-notices", associationId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/financial/delinquency-notices?associationId=${associationId}`);
      return res.json();
    },
    enabled: Boolean(associationId),
  });

  const generateNotices = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/financial/delinquency-notices/generate", { associationId });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (r) => { toast({ title: "Notices generated", description: `${r.generated} generated, ${r.skipped} skipped` }); refetch(); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (!associationId) return <div className="text-sm text-muted-foreground p-4">Select an association.</div>;

  const stageColors: Record<string, string> = {
    payment_failed_notice: "bg-amber-100 text-amber-800",
    delinquency_notice_1: "bg-orange-100 text-orange-800",
    delinquency_notice_2: "bg-red-100 text-red-800",
    final_notice: "bg-red-200 text-red-900",
  };

  const statusColors: Record<string, string> = {
    queued: "bg-blue-100 text-blue-800",
    sent: "bg-green-100 text-green-800",
    skipped: "bg-gray-100 text-gray-600",
    failed: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{notices.length} notice{notices.length !== 1 ? "s" : ""}</span>
        <Button size="sm" onClick={() => generateNotices.mutate()} disabled={generateNotices.isPending}>
          {generateNotices.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <ScanSearch className="h-3.5 w-3.5 mr-1.5" />}
          Generate Notices
        </Button>
      </div>
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
      ) : notices.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-8">No notices generated yet.</div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Stage</TableHead>
                  <TableHead className="text-xs">Days Overdue</TableHead>
                  <TableHead className="text-xs text-right">Amount</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Period</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notices.map(n => (
                  <TableRow key={n.id}>
                    <TableCell className="text-xs">{new Date(n.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stageColors[n.noticeStage] ?? "bg-gray-100 text-gray-600"}`}>
                        {n.noticeStage.replace(/_/g, " ")}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">{n.triggerDaysPastDue}</TableCell>
                    <TableCell className="text-sm text-right tabular-nums">${(n.amountOwedCents / 100).toFixed(2)}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[n.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {n.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs font-mono">{n.delinquencyPeriodKey}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Phase 3: Delinquency Settings Tab ────────────────────────────────────────

type SettingsData = {
  id: string;
  gracePeriodDays: number;
  maxRetryAttempts: number;
  retryScheduleJson: number[];
  autoLateFeeEnabled: number;
};

function DelinquencySettingsTab({ associationId }: { associationId: string | null }) {
  const { toast } = useToast();
  const { data: settings, isLoading, refetch } = useQuery<SettingsData>({
    queryKey: ["/api/financial/delinquency-settings", associationId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/financial/delinquency-settings?associationId=${associationId}`);
      return res.json();
    },
    enabled: Boolean(associationId),
  });

  const [form, setForm] = useState({
    gracePeriodDays: "15",
    maxRetryAttempts: "3",
    retrySchedule: "3, 7, 14",
    autoLateFeeEnabled: false,
  });

  // Sync form when settings load
  useMemo(() => {
    if (settings) {
      setForm({
        gracePeriodDays: String(settings.gracePeriodDays ?? 15),
        maxRetryAttempts: String(settings.maxRetryAttempts ?? 3),
        retrySchedule: Array.isArray(settings.retryScheduleJson)
          ? settings.retryScheduleJson.join(", ")
          : "3, 7, 14",
        autoLateFeeEnabled: (settings.autoLateFeeEnabled ?? 0) === 1,
      });
    }
  }, [settings]);

  const saveSettings = useMutation({
    mutationFn: async () => {
      const retryScheduleJson = form.retrySchedule.split(",").map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
      const res = await apiRequest("POST", "/api/financial/delinquency-settings", {
        associationId,
        gracePeriodDays: parseInt(form.gracePeriodDays, 10) || 15,
        maxRetryAttempts: parseInt(form.maxRetryAttempts, 10) || 3,
        retryScheduleJson,
        autoLateFeeEnabled: form.autoLateFeeEnabled ? 1 : 0,
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => { toast({ title: "Settings saved" }); refetch(); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (!associationId) return <div className="text-sm text-muted-foreground p-4">Select an association.</div>;
  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Grace Period (days)</label>
            <p className="text-xs text-muted-foreground">Days after charge before it's considered delinquent</p>
            <Input
              type="number"
              min="0"
              value={form.gracePeriodDays}
              onChange={e => setForm(f => ({ ...f, gracePeriodDays: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Max Retry Attempts</label>
            <p className="text-xs text-muted-foreground">Maximum autopay retries for a failed payment</p>
            <Input
              type="number"
              min="0"
              max="10"
              value={form.maxRetryAttempts}
              onChange={e => setForm(f => ({ ...f, maxRetryAttempts: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Retry Schedule (days)</label>
            <p className="text-xs text-muted-foreground">Comma-separated days between retries (e.g., 3, 7, 14)</p>
            <Input
              value={form.retrySchedule}
              onChange={e => setForm(f => ({ ...f, retrySchedule: e.target.value }))}
              placeholder="3, 7, 14"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Auto Late Fees</label>
            <p className="text-xs text-muted-foreground">Automatically post late fees per configured rules</p>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                checked={form.autoLateFeeEnabled}
                onChange={e => setForm(f => ({ ...f, autoLateFeeEnabled: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300"
              />
              <span className="text-sm">{form.autoLateFeeEnabled ? "Enabled" : "Disabled"}</span>
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>
            {saveSettings.isPending ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
