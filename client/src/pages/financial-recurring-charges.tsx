import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useActiveAssociation } from "@/hooks/use-active-association";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { FinanceTabBar } from "@/components/finance-tab-bar";
import { AssociationScopeBanner } from "@/components/association-scope-banner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertCircle, CheckCircle2, ChevronDown, Play, Plus, RefreshCw, RotateCcw, PauseCircle } from "lucide-react";
import type { RecurringChargeSchedule, RecurringChargeRun } from "@shared/schema";
import { ConfirmDialog } from "@/components/confirm-dialog";

function statusBadge(status: string) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    active: { label: "Active", variant: "default" },
    paused: { label: "Paused", variant: "secondary" },
    archived: { label: "Archived", variant: "outline" },
    success: { label: "Success", variant: "default" },
    failed: { label: "Failed", variant: "destructive" },
    pending: { label: "Pending", variant: "secondary" },
    skipped: { label: "Skipped", variant: "outline" },
    retrying: { label: "Retrying", variant: "secondary" },
  };
  const m = map[status] ?? { label: status, variant: "outline" };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

export default function FinancialRecurringChargesPage() {
  const { toast } = useToast();
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();

  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>("");
  const [scheduleForm, setScheduleForm] = useState({
    chargeDescription: "",
    entryType: "charge" as "charge" | "assessment" | "late-fee",
    amount: "",
    frequency: "monthly" as "monthly" | "quarterly" | "annual",
    dayOfMonth: "1",
    maxRetries: "3",
  });

  const { data: schedules = [], refetch: refetchSchedules } = useQuery<RecurringChargeSchedule[]>({
    queryKey: ["/api/financial/recurring-charges/schedules", activeAssociationId],
    queryFn: async () => {
      if (!activeAssociationId) return [];
      const res = await apiRequest("GET", `/api/financial/recurring-charges/schedules?associationId=${activeAssociationId}`);
      return res.json();
    },
    enabled: Boolean(activeAssociationId),
  });

  const { data: runs = [], refetch: refetchRuns } = useQuery<RecurringChargeRun[]>({
    queryKey: ["/api/financial/recurring-charges/runs", activeAssociationId, selectedScheduleId],
    queryFn: async () => {
      if (!activeAssociationId) return [];
      const params = new URLSearchParams({ associationId: activeAssociationId });
      if (selectedScheduleId) params.set("scheduleId", selectedScheduleId);
      const res = await apiRequest("GET", `/api/financial/recurring-charges/runs?${params}`);
      return res.json();
    },
    enabled: Boolean(activeAssociationId),
  });

  const { data: units = [] } = useQuery<Array<{ id: string; unitNumber: string }>>({
    queryKey: ["/api/units"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/units");
      return res.json();
    },
  });
  const unitNumberMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of units) map.set(u.id, u.unitNumber);
    return map;
  }, [units]);

  const createSchedule = useMutation({
    mutationFn: async () => {
      if (!activeAssociationId) throw new Error("No association selected");
      const res = await apiRequest("POST", "/api/financial/recurring-charges/schedules", {
        associationId: activeAssociationId,
        chargeDescription: scheduleForm.chargeDescription,
        entryType: scheduleForm.entryType,
        amount: parseFloat(scheduleForm.amount),
        frequency: scheduleForm.frequency,
        dayOfMonth: parseInt(scheduleForm.dayOfMonth, 10),
        maxRetries: parseInt(scheduleForm.maxRetries, 10),
      });
      return res.json();
    },
    onSuccess: async () => {
      await refetchSchedules();
      setScheduleDialogOpen(false);
      setScheduleForm({ chargeDescription: "", entryType: "charge", amount: "", frequency: "monthly", dayOfMonth: "1", maxRetries: "3" });
      toast({ title: "Schedule created" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleSchedule = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "paused" | "archived" }) => {
      const res = await apiRequest("PATCH", `/api/financial/recurring-charges/schedules/${id}`, { status });
      return res.json();
    },
    onSuccess: () => refetchSchedules(),
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const runNow = useMutation({
    mutationFn: async () => {
      if (!activeAssociationId) throw new Error("No association selected");
      const res = await apiRequest("POST", "/api/financial/recurring-charges/run", { associationId: activeAssociationId });
      return res.json() as Promise<{ succeeded: number; failed: number; totalSchedulesDue: number }>;
    },
    onSuccess: async (result) => {
      await refetchSchedules();
      await refetchRuns();
      toast({
        title: "Charge run complete",
        description: `${result.succeeded} succeeded, ${result.failed} failed out of ${result.totalSchedulesDue} due schedules.`,
      });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const retryRun = useMutation({
    mutationFn: async (runId: string) => {
      const res = await apiRequest("POST", `/api/financial/recurring-charges/runs/${runId}/retry`, {});
      return res.json();
    },
    onSuccess: async () => {
      await refetchRuns();
      toast({ title: "Retry complete" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const runStats = {
    total: runs.length,
    success: runs.filter(r => r.status === "success").length,
    failed: runs.filter(r => r.status === "failed").length,
    pending: runs.filter(r => r.status === "pending" || r.status === "retrying").length,
  };

  const activeSchedules = schedules.filter(s => s.status === "active").length;

  return (
    <div className="flex flex-col min-h-0">
      <FinanceTabBar />
      <div className="p-6 space-y-6">
      <WorkspacePageHeader
        title="Recurring Charges"
        summary="Define automatic charge schedules, run them on demand, and manage failed charge retries."
        eyebrow="Finance"
        breadcrumbs={[{ label: "Finance", href: "/app/financial/foundation" }, { label: "Recurring Charges" }]}
      />

      <AssociationScopeBanner
        activeAssociationId={activeAssociationId}
        activeAssociationName={activeAssociationName}
        explanation="Recurring charges are scoped per association. Select one to manage its charge schedules."
      />

      {/* Summary KPIs */}
      {activeAssociationId && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Active Schedules", value: activeSchedules, color: "" },
            { label: "Total Runs", value: runStats.total, color: "" },
            { label: "Successful", value: runStats.success, color: "text-green-600" },
            { label: "Failed", value: runStats.failed, color: runStats.failed > 0 ? "text-red-600" : "text-muted-foreground" },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="pt-4 pb-3">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Schedules */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Charge Schedules</CardTitle>
              <CardDescription>Recurring charges applied to units on a defined cadence</CardDescription>
            </div>
            <div className="flex gap-2">
              <ConfirmDialog
                trigger={
                  <Button size="sm" variant="outline" disabled={runNow.isPending || !activeAssociationId}>
                    <Play className={`h-4 w-4 mr-1 ${runNow.isPending ? "animate-pulse" : ""}`} />
                    {runNow.isPending ? "Running…" : "Run Now"}
                  </Button>
                }
                title="Run charge schedules now?"
                description={`This will immediately post charges for all ${activeSchedules} active schedule${activeSchedules !== 1 ? "s" : ""} that are due for ${activeAssociationName || "the selected association"}. Posted charges will appear on owner ledgers right away.`}
                confirmLabel="Run Charges"
                onConfirm={() => runNow.mutate()}
              />
              <Button size="sm" onClick={() => setScheduleDialogOpen(true)} disabled={!activeAssociationId}>
                <Plus className="h-4 w-4 mr-1" /> New Schedule
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {schedules.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              No recurring charge schedules defined. Create one to start automating charges.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Day of Month</TableHead>
                  <TableHead>Next Run</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Max Retries</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                  <TableHead className="text-right">Runs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map(s => (
                  <TableRow key={s.id} className={selectedScheduleId === s.id ? "bg-muted/30" : ""}>
                    <TableCell
                      className="font-medium cursor-pointer"
                      onClick={() => setSelectedScheduleId(prev => prev === s.id ? "" : s.id)}
                    >
                      {s.chargeDescription}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground capitalize">{s.entryType}</TableCell>
                    <TableCell className="font-medium">${s.amount.toFixed(2)}</TableCell>
                    <TableCell className="capitalize text-sm">{s.frequency}</TableCell>
                    <TableCell className="text-sm">{s.dayOfMonth}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.nextRunDate ? new Date(s.nextRunDate).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>{statusBadge(s.status)}</TableCell>
                    <TableCell className="text-sm">{s.maxRetries}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {s.status === "active" && (
                          <Button size="sm" variant="ghost" title="Pause" onClick={() => toggleSchedule.mutate({ id: s.id, status: "paused" })}>
                            <PauseCircle className="h-4 w-4" />
                          </Button>
                        )}
                        {s.status === "paused" && (
                          <Button size="sm" variant="ghost" title="Resume" onClick={() => toggleSchedule.mutate({ id: s.id, status: "active" })}>
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                        {s.status !== "archived" && (
                          <Button size="sm" variant="ghost" title="Archive" onClick={() => toggleSchedule.mutate({ id: s.id, status: "archived" })}>
                            Archive
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className="text-xs text-muted-foreground hover:text-foreground cursor-pointer inline-flex items-center gap-1"
                        onClick={() => setSelectedScheduleId(prev => prev === s.id ? "" : s.id)}
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                        View runs
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Run History */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-blue-500" /> Run History
              </CardTitle>
              <CardDescription>
                {selectedScheduleId ? `Showing runs for selected schedule` : "All charge run records for this association"}
                {selectedScheduleId && (
                  <button className="ml-2 text-primary hover:underline text-xs" onClick={() => setSelectedScheduleId("")}>Clear filter</button>
                )}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">No run history yet. Click "Run Now" to process due charges.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run Date</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Retries</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead>Next Retry</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.slice(0, 50).map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.ranAt ? new Date(r.ranAt).toLocaleString() : new Date(r.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.unitId ? (unitNumberMap.get(r.unitId) || r.unitId.slice(0, 8) + "…") : "all"}</TableCell>
                    <TableCell className="font-medium">${r.amount.toFixed(2)}</TableCell>
                    <TableCell>{statusBadge(r.status)}</TableCell>
                    <TableCell className="text-sm">{r.retryCount}</TableCell>
                    <TableCell className="text-xs text-red-600 max-w-xs truncate">{r.errorMessage ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.nextRetryAt ? new Date(r.nextRetryAt).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.status === "failed" && (
                        <Button size="icon" variant="outline" title="Retry" onClick={() => retryRun.mutate(r.id)} disabled={retryRun.isPending}>
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                      {r.status === "success" && <CheckCircle2 className="h-4 w-4 text-green-500 inline-block" />}
                      {r.status === "skipped" && <AlertCircle className="h-4 w-4 text-muted-foreground inline-block" />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* New Schedule Dialog */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Recurring Charge Schedule</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Charge description (e.g., Monthly HOA Dues)"
              value={scheduleForm.chargeDescription}
              onChange={e => setScheduleForm(f => ({ ...f, chargeDescription: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Entry Type</label>
                <Select value={scheduleForm.entryType} onValueChange={(v) => setScheduleForm(f => ({ ...f, entryType: v as typeof scheduleForm.entryType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="charge">Charge</SelectItem>
                    <SelectItem value="assessment">Assessment</SelectItem>
                    <SelectItem value="late-fee">Late Fee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Amount ($)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={scheduleForm.amount}
                  onChange={e => setScheduleForm(f => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Frequency</label>
                <Select value={scheduleForm.frequency} onValueChange={(v) => setScheduleForm(f => ({ ...f, frequency: v as typeof scheduleForm.frequency }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Day of Month (1–28)</label>
                <Input
                  type="number"
                  min="1"
                  max="28"
                  value={scheduleForm.dayOfMonth}
                  onChange={e => setScheduleForm(f => ({ ...f, dayOfMonth: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Max Retries</label>
                <Input
                  type="number"
                  min="0"
                  max="10"
                  value={scheduleForm.maxRetries}
                  onChange={e => setScheduleForm(f => ({ ...f, maxRetries: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={() => createSchedule.mutate()}
                disabled={!scheduleForm.chargeDescription || !scheduleForm.amount || createSchedule.isPending}
              >
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
