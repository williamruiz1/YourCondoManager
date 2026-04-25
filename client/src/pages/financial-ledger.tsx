// zone: Financials
// persona: Manager, Board Officer, Assisted Board, PM Assistant
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { Association, AuditLog, FinancialAlert, OwnerLedgerEntry, Person, Unit } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useActiveAssociation } from "@/hooks/use-active-association";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { financeSubPages } from "@/lib/sub-page-nav";
import { AsyncStateBoundary } from "@/components/async-state-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { FileUp, Send, AlertTriangle, RefreshCw, X } from "lucide-react";
import { ExportCsvButton } from "@/components/export-csv-button";
import { CsvImportDialog, type ImportResult } from "@/components/csv-import-dialog";
import { DateRangePresets, type DateRange } from "@/components/date-range-presets";
import { useIsMobile } from "@/hooks/use-mobile";
import { VirtualizedLedgerTable } from "@/components/virtualized-ledger-table";

// 5.4-F7 (Wave 16b) — when a ledger has more than this many rows visible,
// switch the desktop table to a virtualized div-grid. Smaller tables keep
// the standard `<Table>` markup unchanged.
const LEDGER_VIRTUALIZE_THRESHOLD = 50;

function formatAuditDetails(json: unknown): string {
  if (!json || typeof json !== "object") return String(json ?? "—");
  const entries = Object.entries(json as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined)
    .slice(0, 5)
    .map(([k, v]) => {
      const label = k.replace(/_/g, " ");
      const val = typeof v === "number" ? Number(v).toFixed(2) : String(v).slice(0, 30);
      return `${label}: ${val}`;
    });
  return entries.join(" · ") || "—";
}

const entrySchema = z.object({
  associationId: z.string().min(1),
  unitId: z.string().min(1),
  personId: z.string().min(1),
  entryType: z.enum(["charge", "assessment", "payment", "late-fee", "credit", "adjustment"]),
  amount: z.coerce.number(),
  postedAt: z.string().min(1),
  description: z.string().optional(),
});

function SendNoticeDialog({
  associationId,
  personId,
  unitId,
  balance,
  ownerName,
  unitNumber,
}: {
  associationId: string;
  personId: string;
  unitId: string;
  balance: number;
  ownerName: string;
  unitNumber: string;
}) {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState(
    `Payment Reminder — Unit ${unitNumber}`,
  );
  const [body, setBody] = useState(
    `Dear ${ownerName},\n\nOur records show an outstanding balance of $${balance.toFixed(2)} on your account for Unit ${unitNumber}.\n\nPlease remit payment at your earliest convenience. If you believe this is an error or would like to discuss a payment arrangement, please contact us directly.\n\nThank you,\nYour HOA Management Team`,
  );

  // Refresh subject/body when the trigger values change (e.g., different row opened)
  useEffect(() => {
    if (open) {
      setSubject(`Payment Reminder — Unit ${unitNumber}`);
      setBody(
        `Dear ${ownerName},\n\nOur records show an outstanding balance of $${balance.toFixed(2)} on your account for Unit ${unitNumber}.\n\nPlease remit payment at your earliest convenience. If you believe this is an error or would like to discuss a payment arrangement, please contact us directly.\n\nThank you,\nYour HOA Management Team`,
      );
    }
  }, [open, ownerName, unitNumber, balance]);

  const sendMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/financial/payment-instructions/send", {
        associationId,
        targetType: "individual-owner",
        selectedPersonId: personId,
        subject: subject.trim(),
        body: body.trim(),
        bypassReadinessGate: true,
      }).then((r) => r.json()),
    onSuccess: () => {
      toast({ title: "Notice sent", description: `Payment reminder sent to ${ownerName}` });
      setOpen(false);
    },
    onError: (err: Error) =>
      toast({ title: "Send failed", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" title="Send Notice" className="gap-1.5">
          <Send className="h-3.5 w-3.5" />
          Send Notice
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Send Payment Notice</DialogTitle>
          <DialogDescription>
            This notice will be emailed to <strong>{ownerName}</strong> ({unitNumber}).
            Edit the message below before sending.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Outstanding balance: </span>
            <span className="font-semibold text-destructive">${balance.toFixed(2)}</span>
          </div>
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Message</Label>
            <Textarea
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className={isMobile ? "grid grid-cols-1 gap-2" : undefined}>
          <Button className={isMobile ? "w-full" : undefined} variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            className={isMobile ? "w-full" : undefined}
            onClick={() => sendMutation.mutate()}
            disabled={sendMutation.isPending || !subject.trim() || !body.trim()}
          >
            {sendMutation.isPending ? "Sending…" : "Send Notice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FinancialLedgerContent() {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>({ from: null, to: null });
  const [entriesShowLimit, setEntriesShowLimit] = useState(50);
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();
  const [assocFilter, setAssocFilter] = useState<string>(activeAssociationId);

  const { data: associations } = useQuery<Association[]>({ queryKey: ["/api/associations"] });
  const { data: units } = useQuery<Unit[]>({ queryKey: ["/api/units"] });
  const { data: persons } = useQuery<Person[]>({ queryKey: ["/api/persons"] });
  const entriesQuery = useQuery<OwnerLedgerEntry[]>({
    queryKey: ["/api/financial/owner-ledger/entries", assocFilter],
    queryFn: async () => {
      const params = assocFilter ? `?associationId=${assocFilter}` : "";
      const res = await apiRequest("GET", `/api/financial/owner-ledger/entries${params}`);
      return res.json();
    },
  });
  const summaryQuery = useQuery<Array<{ personId: string; unitId: string; balance: number }>>({
    queryKey: ["/api/financial/owner-ledger/summary", assocFilter || "none"],
    queryFn: async () => {
      if (!assocFilter) return [];
      const res = await apiRequest("GET", `/api/financial/owner-ledger/summary/${assocFilter}`);
      return res.json();
    },
    enabled: Boolean(assocFilter),
  });
  const auditLogsQuery = useQuery<AuditLog[]>({
    queryKey: [assocFilter ? `/api/audit-logs?associationId=${assocFilter}` : "/api/audit-logs"],
    enabled: Boolean(assocFilter),
  });

  const {
    data: financialAlertsList = [],
    isLoading: financialAlertsLoading,
    refetch: refetchAlerts,
  } = useQuery<FinancialAlert[]>({
    queryKey: ["/api/financial/alerts", assocFilter],
    queryFn: async () => {
      if (!assocFilter) return [];
      const res = await apiRequest("GET", `/api/financial/alerts?associationId=${assocFilter}`);
      return res.json();
    },
    enabled: Boolean(assocFilter),
  });

  const generateAlerts = useMutation({
    mutationFn: async () => {
      if (!assocFilter) throw new Error("No association selected");
      const res = await apiRequest("POST", "/api/financial/alerts/generate", { associationId: assocFilter });
      return res.json();
    },
    onSuccess: async (result: { generated: number }) => {
      await refetchAlerts();
      toast({ title: `${result.generated} new alerts generated` });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const dismissAlert = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PATCH", `/api/financial/alerts/${id}/dismiss`, {});
      return res.json();
    },
    onSuccess: () => void refetchAlerts(),
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const analyticsQuery = useQuery<{
    collectionMetrics: {
      totalCharges: number;
      totalPayments: number;
      totalCredits: number;
      openBalance: number;
      collectionRate: number;
      monthlyTrend: Array<{ period: string; charges: number; payments: number; credits: number; collectionRate: number }>;
      agingBuckets: { current: number; thirtyDays: number; sixtyDays: number; ninetyPlus: number };
      delinquencyMovement: Array<{ period: string; delinquentAccounts: number; totalBalance: number }>;
    };
  }>({
    queryKey: [assocFilter ? `/api/admin/analytics?days=30&associationId=${assocFilter}` : "/api/admin/analytics?days=30"],
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

  const summaryRows = summaryQuery.data ?? [];
  const delinquentRows = useMemo(() => summaryRows.filter((s) => s.balance > 0), [summaryRows]);
  const filteredAuditRows = useMemo(
    () =>
      (auditLogsQuery.data ?? [])
        .filter((log) => ["owner_ledger_entry", "invoice", "late_fee_event", "budget", "assessment"].includes(log.entityType))
        .slice(0, 50),
    [auditLogsQuery.data],
  );
  const criticalAlertCount = useMemo(
    () => financialAlertsList.filter((alert) => alert.severity === "critical").length,
    [financialAlertsList],
  );

  const filteredEntries = useMemo(() => {
    const all = entriesQuery.data ?? [];
    if (!dateRange.from && !dateRange.to) return all;
    return all.filter((e) => {
      const posted = new Date(e.postedAt);
      if (dateRange.from && posted < dateRange.from) return false;
      if (dateRange.to && posted > dateRange.to) return false;
      return true;
    });
  }, [entriesQuery.data, dateRange]);

  async function handleLedgerImport(rows: Record<string, string>[]): Promise<ImportResult> {
    if (!activeAssociationId) throw new Error("Select an association context first");
    const res = await apiRequest("POST", "/api/financial/owner-ledger/import", { associationId: activeAssociationId, rows });
    const data = await res.json() as ImportResult;
    queryClient.invalidateQueries({ queryKey: ["/api/financial/owner-ledger/entries"] });
    queryClient.invalidateQueries({ queryKey: ["/api/financial/owner-ledger/summary", activeAssociationId] });
    return data;
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setImportOpen(true)} disabled={!activeAssociationId}><FileUp className="h-4 w-4 mr-2" />Import CSV</Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button disabled={!activeAssociationId}>Add Ledger Entry</Button></DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto sm:max-h-[85vh]">
            <DialogHeader><DialogTitle>Create Ledger Entry</DialogTitle></DialogHeader>
            <Form {...form}>
              <form className="space-y-4" onSubmit={form.handleSubmit((v) => createEntry.mutate(v))}>
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                  Association Context: <span className="font-medium">{activeAssociationName || "None selected"}</span>
                </div>
                <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
                  <FormField control={form.control} name="unitId" render={({ field }) => (
                    <FormItem><FormLabel>Unit</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl><SelectContent>{units?.map((u) => <SelectItem key={u.id} value={u.id}>{u.unitNumber}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="personId" render={({ field }) => (
                    <FormItem><FormLabel>Owner</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl><SelectContent>{persons?.map((p) => <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                  )} />
                </div>
                <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
                  <FormField control={form.control} name="entryType" render={({ field }) => (
                    <FormItem><FormLabel>Type</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="charge">charge</SelectItem><SelectItem value="assessment">assessment</SelectItem><SelectItem value="payment">payment</SelectItem><SelectItem value="late-fee">late-fee</SelectItem><SelectItem value="credit">credit</SelectItem><SelectItem value="adjustment">adjustment</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="amount" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount</FormLabel>
                      <p className="text-xs text-muted-foreground -mt-1">Use a negative amount for payments and credits</p>
                      <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="postedAt" render={({ field }) => (<FormItem><FormLabel>Posted Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <Button className="w-full" type="submit" disabled={createEntry.isPending}>Save</Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <AsyncStateBoundary
        isLoading={summaryQuery.isLoading}
        error={summaryQuery.error}
        onRetry={() => summaryQuery.refetch()}
        isEmpty={!summaryQuery.isLoading && summaryRows.length === 0}
        emptyTitle="No ledger balances yet"
        emptyMessage="Post owner-ledger entries in the active association to generate balance visibility."
      >
        <Card>
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Balance Summary</h2>
              {delinquentRows.length > 0 && (
                <Badge variant="destructive">
                  {delinquentRows.length} delinquent
                </Badge>
              )}
            </div>
            {isMobile ? (
              <div className="space-y-3">
                {summaryRows.map((s) => (
                  <div key={`${s.personId}-${s.unitId}`} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium">{personName.get(s.personId) || s.personId}</div>
                        <div className="text-xs text-muted-foreground">{unitName.get(s.unitId) || s.unitId}</div>
                      </div>
                      <Badge variant={s.balance > 0 ? "destructive" : "default"}>${s.balance.toFixed(2)}</Badge>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs text-muted-foreground">
                        {s.balance > 0 ? "Delinquent balance requires follow-up." : "Account is current."}
                      </div>
                      {s.balance > 0 && assocFilter ? (
                        <SendNoticeDialog
                          associationId={assocFilter}
                          personId={s.personId}
                          unitId={s.unitId}
                          balance={s.balance}
                          ownerName={personName.get(s.personId) || "Owner"}
                          unitNumber={unitName.get(s.unitId) || s.unitId}
                        />
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Owner</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaryRows.map((s) => (
                    <TableRow key={`${s.personId}-${s.unitId}`}>
                      <TableCell>{personName.get(s.personId) || s.personId}</TableCell>
                      <TableCell>{unitName.get(s.unitId) || s.unitId}</TableCell>
                      <TableCell>
                        <Badge variant={s.balance > 0 ? "destructive" : "default"}>
                          ${s.balance.toFixed(2)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {s.balance > 0 && assocFilter && (
                          <SendNoticeDialog
                            associationId={assocFilter}
                            personId={s.personId}
                            unitId={s.unitId}
                            balance={s.balance}
                            ownerName={personName.get(s.personId) || "Owner"}
                            unitNumber={unitName.get(s.unitId) || s.unitId}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </AsyncStateBoundary>

      {analyticsQuery.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-[0.95fr,1.05fr]">
          <Card>
            <CardContent className="p-6 space-y-3">
              <Skeleton className="h-5 w-56" />
              <Skeleton className="h-4 w-72" />
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="rounded-md border p-3 space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-6 w-28" />
                  </div>
                ))}
              </div>
              <div className="rounded-md border p-3 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-8 w-32" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 space-y-3">
              <Skeleton className="h-5 w-44" />
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className="h-16 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[0.95fr,1.05fr]">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Dues Collection Rate Analytics</h2>
                <p className="text-sm text-muted-foreground">
                  Scope: <span className="font-medium text-foreground">{activeAssociationName || "All associations"}</span> over the last 30 days of posted owner-ledger activity.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Charges Posted</div>
                  <div className="text-xl font-semibold">${(analyticsQuery.data?.collectionMetrics.totalCharges ?? 0).toFixed(2)}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Payments Posted</div>
                  <div className="text-xl font-semibold">${(analyticsQuery.data?.collectionMetrics.totalPayments ?? 0).toFixed(2)}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Credits / Adjustments</div>
                  <div className="text-xl font-semibold">${(analyticsQuery.data?.collectionMetrics.totalCredits ?? 0).toFixed(2)}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Collection Rate</div>
                  <div className="text-xl font-semibold">{analyticsQuery.data?.collectionMetrics.collectionRate ?? 0}%</div>
                </div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Open Balance</div>
                <div className="text-2xl font-semibold">${(analyticsQuery.data?.collectionMetrics.openBalance ?? 0).toFixed(2)}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold">Recent Collection Trend</h2>
              <div className="mt-4 space-y-2">
                {(analyticsQuery.data?.collectionMetrics.monthlyTrend ?? []).map((row) => (
                  <div key={row.period} className="rounded-md border p-3 text-sm">
                    <div className="font-medium mb-2">{row.period}</div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-4">
                      <div>
                        <div className="text-xs text-muted-foreground">Charges</div>
                        <div>${row.charges.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Payments</div>
                        <div>${row.payments.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Credits</div>
                        <div>${row.credits.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Rate</div>
                        <div className="font-medium">{row.collectionRate}%</div>
                      </div>
                    </div>
                  </div>
                ))}
                {(analyticsQuery.data?.collectionMetrics.monthlyTrend ?? []).length === 0 ? (
                  <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    No owner-ledger activity found for the selected window.
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[0.95fr,1.05fr]">
        <Card>
          <CardContent className="p-6 space-y-3">
            <h2 className="text-lg font-semibold">Delinquency Aging</h2>
            {[
              ["Current", analyticsQuery.data?.collectionMetrics.agingBuckets.current ?? 0],
              ["30 Days", analyticsQuery.data?.collectionMetrics.agingBuckets.thirtyDays ?? 0],
              ["60 Days", analyticsQuery.data?.collectionMetrics.agingBuckets.sixtyDays ?? 0],
              ["90+ Days", analyticsQuery.data?.collectionMetrics.agingBuckets.ninetyPlus ?? 0],
            ].map(([label, amount]) => (
              <div key={label} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <div className="font-medium">{label}</div>
                <div>${Number(amount).toFixed(2)}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold">Delinquency Movement</h2>
            <div className="mt-4 space-y-2">
              {(analyticsQuery.data?.collectionMetrics.delinquencyMovement ?? []).map((row) => (
                <div key={row.period} className="rounded-md border p-3 text-sm">
                  <div className="font-medium mb-2">{row.period}</div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    <div>
                      <div className="text-xs text-muted-foreground">Delinquent Accounts</div>
                      <div>{row.delinquentAccounts}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Balance</div>
                      <div>${row.totalBalance.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              ))}
              {(analyticsQuery.data?.collectionMetrics.delinquencyMovement ?? []).length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  No delinquent balance movement found for the selected window.
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between px-6 pt-5 pb-0 flex-wrap gap-2">
          <h2 className="text-base font-semibold">
            All Ledger Entries
            {(dateRange.from || dateRange.to) && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                — {filteredEntries.length} of {entriesQuery.data?.length ?? 0} entries
              </span>
            )}
          </h2>
          <ExportCsvButton
            headers={["Date", "Owner", "Unit", "Type", "Amount", "Description"]}
            rows={(filteredEntries).map((e) => [
              new Date(e.postedAt).toLocaleDateString(),
              personName.get(e.personId) || e.personId,
              unitName.get(e.unitId) || e.unitId,
              e.entryType,
              e.amount.toFixed(2),
              e.description || "",
            ])}
            filename="ledger-entries"
          />
        </div>
        <div className="px-6 py-3 border-b">
          <DateRangePresets value={dateRange} onChange={setDateRange} />
        </div>
        <CardContent className="p-0">
          {entriesQuery.isLoading ? (
            <div className="space-y-3 p-4 sm:p-6">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-lg border p-4 space-y-3">
                  <Skeleton className="h-4 w-28" />
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                  <Skeleton className="h-4 w-40" />
                </div>
              ))}
            </div>
          ) : isMobile ? (
            <div className="space-y-3 p-4 sm:p-6">
              {filteredEntries.slice(0, entriesShowLimit).map((e) => (
                <div key={e.id} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium">{personName.get(e.personId) || e.personId}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(e.postedAt).toLocaleDateString()} · {unitName.get(e.unitId) || e.unitId}
                      </div>
                    </div>
                    <Badge variant="secondary">{e.entryType}</Badge>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold">${e.amount.toFixed(2)}</div>
                    <div className="max-w-[55%] truncate text-xs text-muted-foreground" title={e.description || ""}>
                      {e.description || "No description"}
                    </div>
                  </div>
                </div>
              ))}
              {filteredEntries.length > entriesShowLimit && (
                <button
                  className="w-full py-3 text-sm text-primary font-medium hover:underline"
                  onClick={() => setEntriesShowLimit(n => n + 50)}
                >
                  Show more ({filteredEntries.length - entriesShowLimit} remaining)
                </button>
              )}
              {filteredEntries.length === 0 && (
                <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                  No ledger entries found for the selected period.
                </div>
              )}
            </div>
          ) : filteredEntries.slice(0, entriesShowLimit).length > LEDGER_VIRTUALIZE_THRESHOLD ? (
            // 5.4-F7 (Wave 16b) — virtualized desktop ledger.
            <VirtualizedOperatorLedger
              entries={filteredEntries.slice(0, entriesShowLimit)}
              personName={personName}
              unitName={unitName}
            />
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Owner</TableHead><TableHead>Unit</TableHead><TableHead>Type</TableHead><TableHead>Amount</TableHead><TableHead>Description</TableHead></TableRow></TableHeader>
              <TableBody>
                {filteredEntries.slice(0, entriesShowLimit).map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{new Date(e.postedAt).toLocaleDateString()}</TableCell>
                    <TableCell>{personName.get(e.personId) || e.personId}</TableCell>
                    <TableCell>{unitName.get(e.unitId) || e.unitId}</TableCell>
                    <TableCell><Badge variant="secondary">{e.entryType}</Badge></TableCell>
                    <TableCell>${e.amount.toFixed(2)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate" title={e.description || ""}>{e.description || "—"}</TableCell>
                  </TableRow>
                ))}
                {filteredEntries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No ledger entries found for the selected period.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
          {!entriesQuery.isLoading && filteredEntries.length > entriesShowLimit && !isMobile && (
            <div className="px-6 py-3 border-t">
              <button
                className="text-sm text-primary font-medium hover:underline"
                onClick={() => setEntriesShowLimit(n => n + 50)}
              >
                Show more ({filteredEntries.length - entriesShowLimit} remaining)
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {assocFilter && (
        <Card>
          <div className="px-6 pt-5 pb-0">
            <h2 className="text-base font-semibold">Financial Change History</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Audit trail of all financial record changes and user actions.</p>
          </div>
          <CardContent className="p-0 mt-3">
            {auditLogsQuery.isLoading ? (
              <div className="space-y-3 p-4 sm:p-6">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="rounded-lg border p-4 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ))}
              </div>
            ) : isMobile ? (
              <div className="space-y-3 p-4 sm:p-6">
                {filteredAuditRows.map((log) => (
                  <div key={log.id} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{log.actorEmail}</div>
                        <div className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</div>
                      </div>
                      <Badge variant="outline" className="font-mono text-[11px]">
                        {log.action}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="secondary" className="capitalize">
                        {log.entityType.replace(/_/g, " ")}
                      </Badge>
                      <span className="text-muted-foreground">{formatAuditDetails(log.afterJson) || log.entityId || "—"}</span>
                    </div>
                  </div>
                ))}
                {filteredAuditRows.length === 0 && (
                  <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                    No financial change history recorded yet.
                  </div>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAuditRows.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm">{log.actorEmail}</TableCell>
                      <TableCell><Badge variant="outline" className="font-mono text-xs">{log.action}</Badge></TableCell>
                      <TableCell className="text-sm capitalize">{log.entityType.replace(/_/g, " ")}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        {formatAuditDetails(log.afterJson) || log.entityId || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredAuditRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No financial change history recorded yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Financial Alerts Panel */}
      {assocFilter && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                <div className="font-semibold text-sm">Finance-Grade Alerts</div>
                {criticalAlertCount > 0 && (
                  <Badge variant="destructive">{criticalAlertCount} critical</Badge>
                )}
              </div>
              <Button size="sm" variant="outline" onClick={() => generateAlerts.mutate()} disabled={generateAlerts.isPending || !assocFilter || financialAlertsLoading} className="gap-1.5 min-h-11">
                <RefreshCw className={`h-3.5 w-3.5 ${generateAlerts.isPending ? "animate-spin" : ""}`} />
                Run Scan
              </Button>
            </div>

            {financialAlertsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, index) => (
                  <div key={index} className="rounded-md border p-3 space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                ))}
              </div>
            ) : financialAlertsList.length === 0 ? (
              <div className="text-sm text-muted-foreground py-2">No active alerts. Run a scan to detect anomalies.</div>
            ) : (
              <div className="space-y-2">
                {financialAlertsList.map((alert) => (
                  <div key={alert.id} className={`flex items-start gap-3 rounded-md border px-3 py-2 ${alert.severity === "critical" ? "bg-red-50 dark:bg-red-950/20 border-red-200" : "bg-orange-50 dark:bg-orange-950/20 border-orange-200"}`}>
                    <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${alert.severity === "critical" ? "text-red-600" : "text-orange-600"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{alert.title}</div>
                      <div className="text-xs text-muted-foreground">{alert.message}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{new Date(alert.createdAt).toLocaleDateString()}</div>
                    </div>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 shrink-0" onClick={() => dismissAlert.mutate(alert.id)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <CsvImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import Ledger Entries from CSV"
        description="Upload a CSV to bulk-create owner ledger entries. Person is matched by email address; unit is matched by unit number. Both must exist in the active association."
        columns={[
          { key: "personEmail", label: "Owner Email", required: true },
          { key: "unitNumber", label: "Unit Number", required: true },
          { key: "entryType", label: "Type (charge/payment/credit…)", required: true },
          { key: "amount", label: "Amount", required: true },
          { key: "postedAt", label: "Posted Date (YYYY-MM-DD)", required: true },
          { key: "description", label: "Description" },
        ]}
        sampleRows={[
          ["jane@example.com", "101", "charge", "350.00", "2024-01-01", "Monthly HOA fee"],
          ["bob@example.com", "102", "payment", "-350.00", "2024-01-15", "Payment received"],
        ]}
        onImport={handleLedgerImport}
      />
    </div>
  );
}

// ---------- 5.4-F7: Virtualized operator ledger -------------------------
//
// Mirror of the legacy `<Table>` columns: Date / Owner / Unit / Type /
// Amount / Description. Each row carries the same `${e.id}`-keyed
// identity so any future click handlers / row-actions can attach by
// row id without churn.

function VirtualizedOperatorLedger({
  entries,
  personName,
  unitName,
}: {
  entries: OwnerLedgerEntry[];
  personName: Map<string, string>;
  unitName: Map<string, string>;
}) {
  const gridTemplate =
    "minmax(110px, 130px) minmax(140px, 1fr) minmax(80px, 110px) minmax(110px, 140px) minmax(90px, 110px) minmax(180px, 1.5fr)";
  return (
    <div data-testid="financial-ledger-virtualized">
      <div
        className="grid border-b text-xs font-medium uppercase tracking-wide text-muted-foreground"
        style={{ gridTemplateColumns: gridTemplate }}
        role="row"
      >
        <div className="px-4 py-3">Date</div>
        <div className="px-4 py-3">Owner</div>
        <div className="px-4 py-3">Unit</div>
        <div className="px-4 py-3">Type</div>
        <div className="px-4 py-3">Amount</div>
        <div className="px-4 py-3">Description</div>
      </div>
      <VirtualizedLedgerTable<OwnerLedgerEntry>
        rows={entries}
        threshold={LEDGER_VIRTUALIZE_THRESHOLD}
        estimateRowHeight={48}
        containerHeight={600}
        getRowKey={(entry) => entry.id}
        renderRow={(e) => (
          <div
            className="grid border-b text-sm transition-colors hover:bg-muted/40"
            style={{ gridTemplateColumns: gridTemplate }}
            role="row"
          >
            <div className="px-4 py-3">{new Date(e.postedAt).toLocaleDateString()}</div>
            <div className="px-4 py-3">{personName.get(e.personId) || e.personId}</div>
            <div className="px-4 py-3">{unitName.get(e.unitId) || e.unitId}</div>
            <div className="px-4 py-3">
              <Badge variant="secondary">{e.entryType}</Badge>
            </div>
            <div className="px-4 py-3">${e.amount.toFixed(2)}</div>
            <div
              className="truncate px-4 py-3 text-muted-foreground"
              title={e.description || ""}
            >
              {e.description || "—"}
            </div>
          </div>
        )}
      />
    </div>
  );
}

export default function FinancialLedgerPage() {
  return (
    <div className="flex flex-col min-h-0">
      <div className="p-6 space-y-6">
        <WorkspacePageHeader
          title="Owner Ledger"
          summary="Post owner-ledger entries, review balances, and monitor collection risk within the active association scope."
          eyebrow="Finance"
          breadcrumbs={[{ label: "Dashboard", href: "/app" }, { label: "Owner Ledger" }]}
          shortcuts={[
            { label: "Open Invoices", href: "/app/financial/invoices" },
            { label: "Open Budgets", href: "/app/financial/budgets" },
          ]}
          subPages={financeSubPages}
        />
        <FinancialLedgerContent />
      </div>
    </div>
  );
}
