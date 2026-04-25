// zone: Operations
// persona: Manager, Board Officer, Assisted Board, PM Assistant
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { MaintenanceRequest, Unit, Vendor, VendorInvoice, WorkOrder } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useActiveAssociation } from "@/hooks/use-active-association";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { operationsSubPages } from "@/lib/sub-page-nav";
import { AssociationScopeBanner } from "@/components/association-scope-banner";
import { AsyncStateBoundary } from "@/components/async-state-boundary";
import { DataTableShell } from "@/components/data-table-shell";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertTriangle, Camera, ChevronDown, ChevronUp, Clock, Minus, Upload, X } from "lucide-react";
import { DateRangePresets, type DateRange } from "@/components/date-range-presets";
import { Label } from "@/components/ui/label";
import { useIsMobile } from "@/hooks/use-mobile";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MaintenanceSchedulesContent } from "./maintenance-schedules";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

type WorkOrderStatus = "open" | "assigned" | "in-progress" | "pending-review" | "closed" | "cancelled";
type WorkOrderPriority = "low" | "medium" | "high" | "urgent";
type WorkOrderPhoto = { url: string; label: string; type: string; uploadedAt: string };

const emptyForm = {
  title: "",
  description: "",
  locationText: "",
  category: "general",
  priority: "medium" as WorkOrderPriority,
  status: "open" as WorkOrderStatus,
  unitId: "",
  vendorId: "",
  maintenanceRequestId: "",
  assignedTo: "",
  estimatedCost: "",
  actualCost: "",
  vendorInvoiceId: "",
  resolutionNotes: "",
};

export function WorkOrdersContent() {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();
  const [open, setOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange>({ from: null, to: null });
  const [unitFilter, setUnitFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("updated");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<WorkOrder | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [photoLabel, setPhotoLabel] = useState("");
  const [photoType, setPhotoType] = useState("before");
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { data: workOrders = [] } = useQuery<WorkOrder[]>({
    queryKey: ["/api/work-orders", statusFilter, unitFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (unitFilter !== "all") params.set("unitId", unitFilter);
      const suffix = params.toString() ? `?${params.toString()}` : "";
      const res = await apiRequest("GET", `/api/work-orders${suffix}`);
      return res.json();
    },
    enabled: Boolean(activeAssociationId),
  });
  const { data: maintenanceRequests = [] } = useQuery<MaintenanceRequest[]>({
    queryKey: ["/api/maintenance/requests"],
    enabled: Boolean(activeAssociationId),
  });
  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
    enabled: Boolean(activeAssociationId),
  });
  const { data: invoices = [] } = useQuery<VendorInvoice[]>({
    queryKey: ["/api/financial/invoices"],
    enabled: Boolean(activeAssociationId),
  });
  const { data: units = [] } = useQuery<Unit[]>({
    queryKey: ["/api/units"],
    enabled: Boolean(activeAssociationId),
  });
  type VendorActivity = {
    id: string;
    activityType: string;
    note: string | null;
    previousStatus: string | null;
    newStatus: string | null;
    fileUrl: string | null;
    fileType: string | null;
    createdAt: string;
  };
  const { data: vendorActivity = [] } = useQuery<VendorActivity[]>({
    queryKey: ["/api/work-orders", selectedOrderId, "vendor-activity"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/work-orders/${selectedOrderId}/vendor-activity`);
      return res.json();
    },
    enabled: Boolean(selectedOrderId),
  });

  const convertibleRequests = useMemo(
    () => {
      const unconverted = maintenanceRequests.filter((request) => !workOrders.some((order) => order.maintenanceRequestId === request.id));
      // Sort overdue-first (most overdue on top), then by soonest upcoming due, then by createdAt.
      return unconverted.slice().sort((a, b) => {
        const aDue = a.responseDueAt ? new Date(a.responseDueAt).getTime() : Number.POSITIVE_INFINITY;
        const bDue = b.responseDueAt ? new Date(b.responseDueAt).getTime() : Number.POSITIVE_INFINITY;
        if (aDue !== bDue) return aDue - bDue;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    },
    [maintenanceRequests, workOrders],
  );
  const convertibleOverdueCount = useMemo(
    () => {
      const now = Date.now();
      return convertibleRequests.filter((r) => r.responseDueAt && new Date(r.responseDueAt).getTime() < now).length;
    },
    [convertibleRequests],
  );
  const requestById = useMemo(
    () => new Map(maintenanceRequests.map((r) => [r.id, r])),
    [maintenanceRequests],
  );
  const selectedOrder = workOrders.find((order) => order.id === selectedOrderId) ?? null;

  const saveWorkOrder = useMutation({
    mutationFn: async () => {
      if (!activeAssociationId) throw new Error("Select an association first");
      const payload = {
        associationId: activeAssociationId,
        title: form.title,
        description: form.description,
        locationText: form.locationText || null,
        category: form.category || "general",
        priority: form.priority,
        status: form.status,
        unitId: form.unitId || null,
        vendorId: form.vendorId || null,
        maintenanceRequestId: form.maintenanceRequestId || null,
        assignedTo: form.assignedTo || null,
        estimatedCost: form.estimatedCost ? Number(form.estimatedCost) : null,
        actualCost: editing && form.status === "closed" && form.actualCost ? Number(form.actualCost) : null,
        resolutionNotes: form.resolutionNotes || null,
        vendorInvoiceId: form.vendorInvoiceId || null,
        scheduledFor: null,
      };
      const res = editing
        ? await apiRequest("PATCH", `/api/work-orders/${editing.id}`, payload)
        : await apiRequest("POST", "/api/work-orders", payload);
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/maintenance/requests"] });
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      toast({ title: editing ? "Work order updated" : "Work order created" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const convertRequest = useMutation({
    mutationFn: async (request: MaintenanceRequest) => {
      const res = await apiRequest("POST", `/api/maintenance/requests/${request.id}/convert-to-work-order`, {
        associationId: request.associationId,
        title: request.title,
        description: request.description,
        locationText: request.locationText,
        category: request.category,
        priority: request.priority,
        unitId: request.unitId,
        assignedTo: request.assignedTo,
      });
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/maintenance/requests"] });
      toast({ title: "Maintenance request converted" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const uploadPhoto = useMutation({
    mutationFn: async ({ file, label, type }: { file: File; label: string; type: string }) => {
      if (!selectedOrderId) throw new Error("No work order selected");
      const fd = new FormData();
      fd.append("file", file);
      fd.append("label", label);
      fd.append("type", type);
      const res = await fetch(`/api/work-orders/${selectedOrderId}/photos`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      setPhotoLabel("");
      setPhotoType("before");
      if (photoInputRef.current) photoInputRef.current.value = "";
      toast({ title: "Photo uploaded" });
    },
    onError: (error: Error) => toast({ title: "Upload failed", description: error.message, variant: "destructive" }),
  });

  const deletePhoto = useMutation({
    mutationFn: async (url: string) => {
      if (!selectedOrderId) throw new Error("No work order selected");
      const res = await apiRequest("DELETE", `/api/work-orders/${selectedOrderId}/photos`, { url });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      toast({ title: "Photo removed" });
    },
    onError: (error: Error) => toast({ title: "Remove failed", description: error.message, variant: "destructive" }),
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(order: WorkOrder) {
    setEditing(order);
    setForm({
      title: order.title,
      description: order.description,
      locationText: order.locationText || "",
      category: order.category,
      priority: order.priority,
      status: order.status,
      unitId: order.unitId || "",
      vendorId: order.vendorId || "",
      maintenanceRequestId: order.maintenanceRequestId || "",
      assignedTo: order.assignedTo || "",
      estimatedCost: order.estimatedCost != null ? String(order.estimatedCost) : "",
      actualCost: order.actualCost != null ? String(order.actualCost) : "",
      vendorInvoiceId: order.vendorInvoiceId || "",
      resolutionNotes: order.resolutionNotes || "",
    });
    setOpen(true);
  }

  const orderCounts = {
    open: workOrders.filter((order) => order.status === "open" || order.status === "assigned" || order.status === "in-progress").length,
    review: workOrders.filter((order) => order.status === "pending-review").length,
    closed: workOrders.filter((order) => order.status === "closed").length,
  };
  const availableInvoices = invoices.filter((invoice) => {
    if (form.vendorId && invoice.vendorId) return invoice.vendorId === form.vendorId;
    return true;
  });
  const visibleWorkOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = [...workOrders].filter((order) => {
      if (term && ![order.title, order.description, order.locationText, order.category, order.assignedTo].some((v) => (v || "").toLowerCase().includes(term))) return false;
      if (dateRange.from && new Date(order.updatedAt) < dateRange.from) return false;
      if (dateRange.to && new Date(order.updatedAt) > dateRange.to) return false;
      return true;
    });

    rows.sort((left, right) => {
      if (sortBy === "priority") {
        const score = { urgent: 4, high: 3, medium: 2, low: 1 };
        return score[right.priority] - score[left.priority];
      }
      if (sortBy === "status") {
        return left.status.localeCompare(right.status);
      }
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    });
    return rows;
  }, [search, sortBy, workOrders]);
  const totalPages = Math.max(1, Math.ceil(visibleWorkOrders.length / 10));
  const pagedWorkOrders = visibleWorkOrders.slice((page - 1) * 10, page * 10);
  const activeFilterCount = Number(statusFilter !== "all") + Number(unitFilter !== "all") + Number(dateRange.from !== null || dateRange.to !== null);
  const filterSummaryParts = [
    statusFilter === "all" ? "All statuses" : statusFilter,
    unitFilter === "all" ? "All units" : "1 unit",
    sortBy === "updated" ? "Recently updated" : sortBy === "priority" ? "Highest priority" : "Status A-Z",
  ];

  useEffect(() => {
    if (selectedOrderId && !workOrders.some((order) => order.id === selectedOrderId)) {
      setSelectedOrderId("");
    }
  }, [selectedOrderId, workOrders]);

  useEffect(() => {
    setPage(1);
  }, [search, sortBy, statusFilter, unitFilter, dateRange]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button disabled={!activeAssociationId} onClick={openCreate}>New Work Order</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto sm:max-h-[85vh]">
              <DialogHeader><DialogTitle>{editing ? "Edit Work Order" : "Create Work Order"}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                  Association Context: <span className="font-medium">{activeAssociationName || "None selected"}</span>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="work-order-title">Title</Label>
                    <Input id="work-order-title" className={isMobile ? "min-h-11" : undefined} placeholder="Roof leak above stairwell" value={form.title} onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="work-order-location">Location</Label>
                    <Input id="work-order-location" className={isMobile ? "min-h-11" : undefined} placeholder="Building A stair landing" value={form.locationText} onChange={(e) => setForm((current) => ({ ...current, locationText: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Unit</Label>
                    <Select value={form.unitId || "none"} onValueChange={(value) => setForm((current) => ({ ...current, unitId: value === "none" ? "" : value }))}>
                      <SelectTrigger className={isMobile ? "min-h-11" : undefined}><SelectValue placeholder="Unit" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No unit</SelectItem>
                        {units.map((unit) => <SelectItem key={unit.id} value={unit.id}>{unit.unitNumber}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Vendor</Label>
                    <Select value={form.vendorId || "none"} onValueChange={(value) => setForm((current) => ({ ...current, vendorId: value === "none" ? "" : value }))}>
                      <SelectTrigger className={isMobile ? "min-h-11" : undefined}><SelectValue placeholder="Vendor" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned vendor</SelectItem>
                        {vendors.map((vendor) => <SelectItem key={vendor.id} value={vendor.id}>{vendor.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Priority</Label>
                    <Select value={form.priority} onValueChange={(value: WorkOrderPriority) => setForm((current) => ({ ...current, priority: value }))}>
                      <SelectTrigger className={isMobile ? "min-h-11" : undefined}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">low</SelectItem>
                        <SelectItem value="medium">medium</SelectItem>
                        <SelectItem value="high">high</SelectItem>
                        <SelectItem value="urgent">urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(value: WorkOrderStatus) => setForm((current) => ({ ...current, status: value }))}>
                      <SelectTrigger className={isMobile ? "min-h-11" : undefined}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">open</SelectItem>
                        <SelectItem value="assigned">assigned</SelectItem>
                        <SelectItem value="in-progress">in-progress</SelectItem>
                        <SelectItem value="pending-review">pending-review</SelectItem>
                        <SelectItem value="closed">closed</SelectItem>
                        <SelectItem value="cancelled">cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="work-order-assignee">Assigned to</Label>
                    <Input id="work-order-assignee" className={isMobile ? "min-h-11" : undefined} placeholder="Facilities coordinator" value={form.assignedTo} onChange={(e) => setForm((current) => ({ ...current, assignedTo: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="work-order-estimated-cost">Estimated cost</Label>
                    <Input id="work-order-estimated-cost" className={isMobile ? "min-h-11" : undefined} placeholder="0.00" type="number" min="0" step="0.01" value={form.estimatedCost} onChange={(e) => setForm((current) => ({ ...current, estimatedCost: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Linked invoice</Label>
                    <Select
                      value={form.vendorInvoiceId || "none"}
                      onValueChange={(value) => {
                        const nextValue = value === "none" ? "" : value;
                        const invoice = availableInvoices.find((item) => item.id === nextValue);
                        setForm((current) => ({
                          ...current,
                          vendorInvoiceId: nextValue,
                          actualCost: invoice ? String(invoice.amount) : current.actualCost,
                        }));
                      }}
                    >
                      <SelectTrigger className={isMobile ? "min-h-11" : undefined}><SelectValue placeholder="Linked invoice" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No linked invoice</SelectItem>
                        {availableInvoices.map((invoice) => (
                          <SelectItem key={invoice.id} value={invoice.id}>
                            {invoice.vendorName} · {invoice.invoiceNumber || invoice.id.slice(0, 6)} · ${invoice.amount.toFixed(2)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="work-order-actual-cost">Actual cost</Label>
                    <Input
                      id="work-order-actual-cost"
                      className={isMobile ? "min-h-11" : undefined}
                      placeholder="0.00"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.actualCost}
                      onChange={(e) => setForm((current) => ({ ...current, actualCost: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="work-order-description">Description</Label>
                  <Textarea id="work-order-description" className={isMobile ? "min-h-28" : undefined} placeholder="Describe the problem, urgency, and any access instructions." value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} rows={4} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="work-order-resolution-notes">Resolution notes</Label>
                  <Textarea id="work-order-resolution-notes" className={isMobile ? "min-h-24" : undefined} placeholder="Capture follow-up details, completion notes, or pending review context." value={form.resolutionNotes} onChange={(e) => setForm((current) => ({ ...current, resolutionNotes: e.target.value }))} rows={3} />
                </div>
                <Button className="w-full" onClick={() => saveWorkOrder.mutate()} disabled={saveWorkOrder.isPending || !form.title.trim() || !form.description.trim()}>
                  {editing ? "Save Changes" : "Create Work Order"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

      <AssociationScopeBanner
        activeAssociationId={activeAssociationId}
        activeAssociationName={activeAssociationName}
        explanation={
          activeAssociationId
            ? "Work orders, vendor assignments, and invoice links are scoped to the active association."
            : "Select an association before creating or triaging work orders."
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Association Context</div><div className="mt-1 text-lg font-semibold">{activeAssociationName || "None selected"}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Open / Active</div><div className="mt-1 text-lg font-semibold">{orderCounts.open}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Pending Review</div><div className="mt-1 text-lg font-semibold">{orderCounts.review}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Closed</div><div className="mt-1 text-lg font-semibold">{orderCounts.closed}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-lg font-semibold">Maintenance Requests Ready for Conversion</h2>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{convertibleRequests.length} available</Badge>
              {convertibleOverdueCount > 0 && (
                <Badge variant="destructive" data-testid="badge-convertible-overdue">{convertibleOverdueCount} overdue</Badge>
              )}
            </div>
          </div>
          <div className="hidden md:block">
          // Wave 23 a11y: aria-label names this convertible requests table.
          <Table aria-label="Convertible resident requests">
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>SLA</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {convertibleRequests.slice(0, 25).map((request) => {
                const dueAt = request.responseDueAt ? new Date(request.responseDueAt) : null;
                const isOverdue = Boolean(dueAt && dueAt.getTime() < Date.now());
                const stage = request.escalationStage ?? 0;
                return (
                  <TableRow key={request.id}>
                    <TableCell>{request.title}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${request.priority === "urgent" ? "text-red-600" : request.priority === "high" ? "text-orange-600" : "text-slate-700"}`} aria-label={`Priority: ${request.priority}`}>
                        {request.priority === "urgent" && <AlertTriangle className="h-3 w-3" aria-hidden="true" />}
                        {request.priority === "high" && <ChevronUp className="h-3 w-3" aria-hidden="true" />}
                        {request.priority}
                      </span>
                    </TableCell>
                    <TableCell><Badge variant="secondary">{request.status}</Badge></TableCell>
                    <TableCell>{units.find((unit) => unit.id === request.unitId)?.unitNumber || "-"}</TableCell>
                    <TableCell>
                      {dueAt ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium ${isOverdue ? "text-red-600" : "text-muted-foreground"}`} aria-label={isOverdue ? "SLA overdue" : "SLA on track"}>
                            <Clock className="h-3 w-3" aria-hidden="true" />
                            {isOverdue ? "Overdue" : dueAt.toLocaleDateString()}
                          </span>
                          {stage > 0 && (
                            <Badge variant="destructive" className="h-5 px-1.5 text-[10px]" aria-label={`Escalation stage ${stage}`}>stage {stage}</Badge>
                          )}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" onClick={() => convertRequest.mutate(request)} disabled={convertRequest.isPending}>Convert</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {convertibleRequests.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-20 text-center text-muted-foreground">No unconverted maintenance requests.</TableCell></TableRow>
              ) : null}
            </TableBody>
          </Table>
          </div>
          <div className="space-y-3 md:hidden">
            {convertibleRequests.slice(0, 25).map((request) => {
              const dueAt = request.responseDueAt ? new Date(request.responseDueAt) : null;
              const isOverdue = Boolean(dueAt && dueAt.getTime() < Date.now());
              const stage = request.escalationStage ?? 0;
              return (
              <div key={request.id} className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{request.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {units.find((unit) => unit.id === request.unitId)?.unitNumber || "-"} · {request.status}
                    </div>
                  </div>
                  <Button size="sm" onClick={() => convertRequest.mutate(request)} disabled={convertRequest.isPending}>Convert</Button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{request.status}</Badge>
                  <span className={`inline-flex items-center gap-1 text-xs font-medium ${request.priority === "urgent" ? "text-red-600" : request.priority === "high" ? "text-orange-600" : "text-slate-700"}`} aria-label={`Priority: ${request.priority}`}>
                    {request.priority === "urgent" && <AlertTriangle className="h-3 w-3" aria-hidden="true" />}
                    {request.priority === "high" && <ChevronUp className="h-3 w-3" aria-hidden="true" />}
                    {request.priority}
                  </span>
                  {dueAt && (
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${isOverdue ? "text-red-600" : "text-muted-foreground"}`} aria-label={isOverdue ? "SLA overdue" : "SLA on track"}>
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      {isOverdue ? "Overdue" : dueAt.toLocaleDateString()}
                    </span>
                  )}
                  {stage > 0 && (
                    <Badge variant="destructive" className="h-5 px-1.5 text-[10px]" aria-label={`Escalation stage ${stage}`}>stage {stage}</Badge>
                  )}
                </div>
              </div>
              );
            })}
            {convertibleRequests.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No unconverted maintenance requests.</div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <AsyncStateBoundary
        isLoading={!workOrders}
        isEmpty={!workOrders.length}
        emptyTitle="No work orders yet"
        emptyMessage="Work orders track repair and maintenance jobs from assignment to close. Create one directly or convert an existing maintenance request above. Assign a vendor, set priority, and track costs all in one place."
      >
        <DataTableShell
          title="Work Order Register"
          description="Filter and sort active work orders, then open a detail panel without leaving the queue."
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search title, description, location, category, or assignee"
          summary={`${visibleWorkOrders.length} work orders`}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          filterSlot={
            isMobile ? (
              <>
                <div className="flex w-full items-center justify-between gap-2">
                  <div className="min-w-0 text-xs text-muted-foreground">
                    {filterSummaryParts.join(" · ")}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setFiltersOpen(true)}>
                    Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
                  </Button>
                </div>
                <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
                  <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl">
                    <SheetHeader>
                      <SheetTitle>Filter Work Orders</SheetTitle>
                      <SheetDescription>Keep queue controls in a separate mobile sheet so primary actions stay visible.</SheetDescription>
                    </SheetHeader>
                    <div className="mt-6 space-y-4">
                      <div className="space-y-1.5">
                        <Label>Status</Label>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                          <SelectTrigger className="min-h-11 w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All statuses</SelectItem>
                            <SelectItem value="open">open</SelectItem>
                            <SelectItem value="assigned">assigned</SelectItem>
                            <SelectItem value="in-progress">in-progress</SelectItem>
                            <SelectItem value="pending-review">pending-review</SelectItem>
                            <SelectItem value="closed">closed</SelectItem>
                            <SelectItem value="cancelled">cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Unit</Label>
                        <Select value={unitFilter} onValueChange={setUnitFilter}>
                          <SelectTrigger className="min-h-11 w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All units</SelectItem>
                            {units.map((unit) => <SelectItem key={unit.id} value={unit.id}>{unit.unitNumber}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Sort</Label>
                        <Select value={sortBy} onValueChange={setSortBy}>
                          <SelectTrigger className="min-h-11 w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="updated">Recently updated</SelectItem>
                            <SelectItem value="priority">Highest priority</SelectItem>
                            <SelectItem value="status">Status A-Z</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Date range</Label>
                        <DateRangePresets value={dateRange} onChange={(r) => { setDateRange(r); setPage(1); }} className="items-start" />
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setStatusFilter("all");
                            setUnitFilter("all");
                            setSortBy("updated");
                            setDateRange({ from: null, to: null });
                            setPage(1);
                          }}
                        >
                          Reset
                        </Button>
                        <Button onClick={() => setFiltersOpen(false)}>Apply</Button>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              </>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[220px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="open">open</SelectItem>
                      <SelectItem value="assigned">assigned</SelectItem>
                      <SelectItem value="in-progress">in-progress</SelectItem>
                      <SelectItem value="pending-review">pending-review</SelectItem>
                      <SelectItem value="closed">closed</SelectItem>
                      <SelectItem value="cancelled">cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={unitFilter} onValueChange={setUnitFilter}>
                    <SelectTrigger className="w-full sm:w-[220px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All units</SelectItem>
                      {units.map((unit) => <SelectItem key={unit.id} value={unit.id}>{unit.unitNumber}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="updated">Recently updated</SelectItem>
                      <SelectItem value="priority">Highest priority</SelectItem>
                      <SelectItem value="status">Status A-Z</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DateRangePresets value={dateRange} onChange={(r) => { setDateRange(r); setPage(1); }} />
              </div>
            )
          }
        >
          <div className="hidden md:block">
          // Wave 23 a11y: aria-label names this work orders table.
          <Table aria-label="Work orders">
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>SLA</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedWorkOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <button className="text-left" onClick={() => setSelectedOrderId(order.id)}>
                      <div className="font-medium">{order.title}</div>
                    </button>
                    <div className="text-xs text-muted-foreground">{order.locationText || order.category}</div>
                  </TableCell>
                  <TableCell>{units.find((unit) => unit.id === order.unitId)?.unitNumber || "-"}</TableCell>
                  <TableCell>{vendors.find((vendor) => vendor.id === order.vendorId)?.name || "-"}</TableCell>
                  <TableCell>{invoices.find((invoice) => invoice.id === order.vendorInvoiceId)?.invoiceNumber || (order.vendorInvoiceId ? "linked" : "-")}</TableCell>
                  <TableCell><Badge variant={order.status === "closed" ? "default" : "secondary"}>{order.status}</Badge></TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${order.priority === "urgent" ? "text-red-600" : order.priority === "high" ? "text-orange-600" : order.priority === "low" ? "text-slate-500" : "text-slate-700"}`} aria-label={`Priority: ${order.priority}`}>
                      {order.priority === "urgent" && <AlertTriangle className="h-3 w-3" aria-hidden="true" />}
                      {order.priority === "high" && <ChevronUp className="h-3 w-3" aria-hidden="true" />}
                      {order.priority === "medium" && <Minus className="h-3 w-3" aria-hidden="true" />}
                      {order.priority === "low" && <ChevronDown className="h-3 w-3" aria-hidden="true" />}
                      {order.priority}
                    </span>
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const linkedReq = order.maintenanceRequestId ? requestById.get(order.maintenanceRequestId) : null;
                      const dueAt = linkedReq?.responseDueAt ? new Date(linkedReq.responseDueAt) : null;
                      if (!dueAt) return <span className="text-xs text-muted-foreground">—</span>;
                      const isActive = order.status !== "closed" && order.status !== "cancelled";
                      const isOverdue = isActive && dueAt < new Date();
                      return (
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${isOverdue ? "text-red-600" : "text-muted-foreground"}`} aria-label={isOverdue ? "SLA overdue" : "SLA on track"}>
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          {isOverdue ? "Overdue" : dueAt.toLocaleDateString()}
                        </span>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    {order.actualCost != null
                      ? `$${order.actualCost.toFixed(2)} actual`
                      : order.estimatedCost != null
                        ? `$${order.estimatedCost.toFixed(2)} est`
                        : "-"}
                  </TableCell>
                  <TableCell>{new Date(order.updatedAt).toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => setSelectedOrderId(order.id)}>View</Button>
                      <Button size="sm" variant="outline" onClick={() => openEdit(order)}>Edit</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
          <div className="space-y-3 md:hidden">
            {pagedWorkOrders.map((order) => {
              const linkedReq = order.maintenanceRequestId ? requestById.get(order.maintenanceRequestId) : null;
              const dueAt = linkedReq?.responseDueAt ? new Date(linkedReq.responseDueAt) : null;
              const isActive = order.status !== "closed" && order.status !== "cancelled";
              const isOverdue = Boolean(dueAt && isActive && dueAt < new Date());
              return (
                <div key={order.id} className="rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <button className="min-w-0 text-left" onClick={() => setSelectedOrderId(order.id)}>
                      <div className="font-medium">{order.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{order.locationText || order.category}</div>
                    </button>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant={order.status === "closed" ? "default" : "secondary"}>{order.status}</Badge>
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${order.priority === "urgent" ? "text-red-600" : order.priority === "high" ? "text-orange-600" : order.priority === "low" ? "text-slate-500" : "text-slate-700"}`} aria-label={`Priority: ${order.priority}`}>
                        {order.priority === "urgent" && <AlertTriangle className="h-3 w-3" aria-hidden="true" />}
                        {order.priority === "high" && <ChevronUp className="h-3 w-3" aria-hidden="true" />}
                        {order.priority === "medium" && <Minus className="h-3 w-3" aria-hidden="true" />}
                        {order.priority === "low" && <ChevronDown className="h-3 w-3" aria-hidden="true" />}
                        {order.priority}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                    <div>Unit: {units.find((unit) => unit.id === order.unitId)?.unitNumber || "-"}</div>
                    <div>Vendor: {vendors.find((vendor) => vendor.id === order.vendorId)?.name || "-"}</div>
                    <div>Invoice: {invoices.find((invoice) => invoice.id === order.vendorInvoiceId)?.invoiceNumber || (order.vendorInvoiceId ? "linked" : "-")}</div>
                    <div>
                      SLA: {dueAt ? (
                        <span className={isOverdue ? "font-medium text-red-600" : ""}>{isOverdue ? "Overdue" : dueAt.toLocaleDateString()}</span>
                      ) : "—"}
                    </div>
                    <div>
                      Cost: {order.actualCost != null
                        ? `$${order.actualCost.toFixed(2)} actual`
                        : order.estimatedCost != null
                          ? `$${order.estimatedCost.toFixed(2)} est`
                          : "-"}
                    </div>
                    <div>Updated: {new Date(order.updatedAt).toLocaleString()}</div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => setSelectedOrderId(order.id)}>View</Button>
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(order)}>Edit</Button>
                  </div>
                </div>
              );
            })}
          </div>
        </DataTableShell>
      </AsyncStateBoundary>

      <Sheet open={Boolean(selectedOrder)} onOpenChange={(nextOpen) => { if (!nextOpen) setSelectedOrderId(""); }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedOrder?.title || "Work Order Detail"}</SheetTitle>
            <SheetDescription>
              {selectedOrder ? "Review assignment, cost, and resolution context without losing your place in the queue." : "Select a work order from the table."}
            </SheetDescription>
          </SheetHeader>
          {selectedOrder ? (
            <div className="mt-6 space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Status</div><div className="mt-1"><Badge variant={selectedOrder.status === "closed" ? "default" : "secondary"}>{selectedOrder.status}</Badge></div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Priority</div><div className="mt-1 font-medium">{selectedOrder.priority}</div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Vendor</div><div className="mt-1 font-medium">{vendors.find((vendor) => vendor.id === selectedOrder.vendorId)?.name || "-"}</div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Unit</div><div className="mt-1 font-medium">{units.find((unit) => unit.id === selectedOrder.unitId)?.unitNumber || "-"}</div></CardContent></Card>
              </div>
              <Card><CardContent className="p-4 space-y-2"><div className="text-sm text-muted-foreground">Description</div><div className="text-sm">{selectedOrder.description}</div></CardContent></Card>
              <Card><CardContent className="p-4 space-y-2"><div className="text-sm text-muted-foreground">Cost Tracking</div><div className="text-sm">Estimated: {selectedOrder.estimatedCost != null ? `$${selectedOrder.estimatedCost.toFixed(2)}` : "-"}</div><div className="text-sm">Actual: {selectedOrder.actualCost != null ? `$${selectedOrder.actualCost.toFixed(2)}` : "-"}</div><div className="text-sm">Linked invoice: {invoices.find((invoice) => invoice.id === selectedOrder.vendorInvoiceId)?.invoiceNumber || "-"}</div></CardContent></Card>
              <Card><CardContent className="p-4 space-y-2"><div className="text-sm text-muted-foreground">Resolution Notes</div><div className="text-sm">{selectedOrder.resolutionNotes || "No resolution notes recorded yet."}</div></CardContent></Card>

              <Card>
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Camera className="h-4 w-4 text-muted-foreground" />
                    <div className="text-sm font-medium">Before / After Documentation</div>
                  </div>

                  {(() => {
                    const photos = Array.isArray((selectedOrder as any).photosJson) ? ((selectedOrder as any).photosJson as WorkOrderPhoto[]) : [];
                    const beforePhotos = photos.filter((p) => p.type === "before");
                    const afterPhotos = photos.filter((p) => p.type === "after");
                    const generalPhotos = photos.filter((p) => p.type !== "before" && p.type !== "after");
                    const renderThumb = (photo: WorkOrderPhoto, fallbackAlt: string) => (
                      <div key={photo.url} className="relative rounded overflow-hidden border bg-muted group">
                        <img src={photo.url} alt={photo.label || fallbackAlt} className="w-full h-28 object-cover" loading="lazy" decoding="async" />
                        <button
                          type="button"
                          onClick={() => deletePhoto.mutate(photo.url)}
                          disabled={deletePhoto.isPending}
                          className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors disabled:opacity-50"
                          aria-label="Remove photo"
                          data-testid={`button-delete-photo-${photo.url}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                        {photo.label && <div className="text-xs px-2 py-1 truncate">{photo.label}</div>}
                      </div>
                    );
                    return (
                      <div className="space-y-3">
                        {photos.length === 0 && (
                          <div className="text-sm text-muted-foreground text-center py-4 border rounded-md border-dashed">No photos uploaded yet</div>
                        )}
                        {beforePhotos.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Before</div>
                            <div className="grid grid-cols-2 gap-2">
                              {beforePhotos.map((photo) => renderThumb(photo, "Before"))}
                            </div>
                          </div>
                        )}
                        {afterPhotos.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">After</div>
                            <div className="grid grid-cols-2 gap-2">
                              {afterPhotos.map((photo) => renderThumb(photo, "After"))}
                            </div>
                          </div>
                        )}
                        {generalPhotos.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">General</div>
                            <div className="grid grid-cols-2 gap-2">
                              {generalPhotos.map((photo) => renderThumb(photo, "Photo"))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <div className="space-y-2 border-t pt-3">
                    <div className="text-xs font-medium text-muted-foreground">Upload photo</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Type</Label>
                        <Select value={photoType} onValueChange={setPhotoType}>
                          <SelectTrigger className="h-10 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="before">Before</SelectItem>
                            <SelectItem value="after">After</SelectItem>
                            <SelectItem value="general">General</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Label (optional)</Label>
                        <Input className="h-10 text-xs" placeholder="e.g. front door" value={photoLabel} onChange={(e) => setPhotoLabel(e.target.value)} />
                      </div>
                    </div>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadPhoto.mutate({ file, label: photoLabel, type: photoType });
                      }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full gap-2"
                      disabled={uploadPhoto.isPending}
                      onClick={() => photoInputRef.current?.click()}
                    >
                      <Upload className="h-3 w-3" />
                      {uploadPhoto.isPending ? "Uploading…" : "Choose & Upload"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {((selectedOrder as any).vendorNotes || (selectedOrder as any).vendorEstimatedCompletionDate || vendorActivity.length > 0) && (
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="font-medium text-sm flex items-center gap-2">
                      Vendor Activity
                      {vendorActivity.length > 0 && <Badge variant="outline" className="text-xs">{vendorActivity.length}</Badge>}
                    </div>
                    {(selectedOrder as any).vendorEstimatedCompletionDate && (
                      <div className="text-sm text-muted-foreground">
                        Est. completion (vendor): <span className="font-medium text-foreground">{new Date((selectedOrder as any).vendorEstimatedCompletionDate).toLocaleDateString()}</span>
                      </div>
                    )}
                    {(selectedOrder as any).vendorNotes && (
                      <div className="text-sm">
                        <div className="text-xs text-muted-foreground mb-1">Vendor notes</div>
                        <div className="whitespace-pre-wrap">{(selectedOrder as any).vendorNotes}</div>
                      </div>
                    )}
                    {vendorActivity.length > 0 && (
                      <ol className="space-y-2 border-t pt-3">
                        {[...vendorActivity].reverse().map((item) => (
                          <li key={item.id} className="flex gap-2 text-sm">
                            <div className="flex-shrink-0 w-2 h-2 mt-1.5 rounded-full bg-primary/40" />
                            <div className="min-w-0">
                              <span className="font-medium capitalize">{item.activityType.replace(/_/g, " ")}</span>
                              {item.note && <span className="text-muted-foreground"> — {item.note}</span>}
                              <div className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</div>
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

export default function WorkOrdersPage() {
  useDocumentTitle("Work Orders");
  return (
    // Wave 23 a11y: section + aria-labelledby (heading id below).
    <section className="flex flex-col min-h-0" aria-labelledby="work-orders-heading">
      <div className="p-6 space-y-6">
        <WorkspacePageHeader
          title="Work Orders"
          headingId="work-orders-heading"
          summary="Manage work orders and preventive maintenance schedules."
          eyebrow="Operations"
          breadcrumbs={[{ label: "Operations", href: "/app/operations/dashboard" }, { label: "Work Orders" }]}
          subPages={operationsSubPages}
        />
        <Tabs defaultValue="work-orders" className="space-y-6">
          <TabsList>
            <TabsTrigger value="work-orders">Work Orders</TabsTrigger>
            <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          </TabsList>
          <TabsContent value="work-orders" className="mt-0"><WorkOrdersContent /></TabsContent>
          <TabsContent value="maintenance" className="mt-0"><MaintenanceSchedulesContent /></TabsContent>
        </Tabs>
      </div>
    </section>
  );
}
