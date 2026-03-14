import { useMemo, useState } from "react";
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

type WorkOrderStatus = "open" | "assigned" | "in-progress" | "pending-review" | "closed" | "cancelled";
type WorkOrderPriority = "low" | "medium" | "high" | "urgent";

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

export default function WorkOrdersPage() {
  const { toast } = useToast();
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();
  const [open, setOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [unitFilter, setUnitFilter] = useState<string>("all");
  const [editing, setEditing] = useState<WorkOrder | null>(null);
  const [form, setForm] = useState(emptyForm);

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

  const convertibleRequests = useMemo(
    () => maintenanceRequests.filter((request) => !workOrders.some((order) => order.maintenanceRequestId === request.id)),
    [maintenanceRequests, workOrders],
  );

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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Work Orders</h1>
          <p className="text-muted-foreground">Operational execution layer for maintenance delivery, vendor assignment, and unit-level maintenance history.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button disabled={!activeAssociationId} onClick={openCreate}>New Work Order</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{editing ? "Edit Work Order" : "Create Work Order"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                Association Context: <span className="font-medium">{activeAssociationName || "None selected"}</span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Input placeholder="Title" value={form.title} onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))} />
                <Input placeholder="Location" value={form.locationText} onChange={(e) => setForm((current) => ({ ...current, locationText: e.target.value }))} />
                <Select value={form.unitId || "none"} onValueChange={(value) => setForm((current) => ({ ...current, unitId: value === "none" ? "" : value }))}>
                  <SelectTrigger><SelectValue placeholder="Unit" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No unit</SelectItem>
                    {units.map((unit) => <SelectItem key={unit.id} value={unit.id}>{unit.unitNumber}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={form.vendorId || "none"} onValueChange={(value) => setForm((current) => ({ ...current, vendorId: value === "none" ? "" : value }))}>
                  <SelectTrigger><SelectValue placeholder="Vendor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned vendor</SelectItem>
                    {vendors.map((vendor) => <SelectItem key={vendor.id} value={vendor.id}>{vendor.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={form.priority} onValueChange={(value: WorkOrderPriority) => setForm((current) => ({ ...current, priority: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">low</SelectItem>
                    <SelectItem value="medium">medium</SelectItem>
                    <SelectItem value="high">high</SelectItem>
                    <SelectItem value="urgent">urgent</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={form.status} onValueChange={(value: WorkOrderStatus) => setForm((current) => ({ ...current, status: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">open</SelectItem>
                    <SelectItem value="assigned">assigned</SelectItem>
                    <SelectItem value="in-progress">in-progress</SelectItem>
                    <SelectItem value="pending-review">pending-review</SelectItem>
                    <SelectItem value="closed">closed</SelectItem>
                    <SelectItem value="cancelled">cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="Assigned to" value={form.assignedTo} onChange={(e) => setForm((current) => ({ ...current, assignedTo: e.target.value }))} />
                <Input placeholder="Estimated cost" type="number" min="0" step="0.01" value={form.estimatedCost} onChange={(e) => setForm((current) => ({ ...current, estimatedCost: e.target.value }))} />
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
                  <SelectTrigger><SelectValue placeholder="Linked invoice" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No linked invoice</SelectItem>
                    {availableInvoices.map((invoice) => (
                      <SelectItem key={invoice.id} value={invoice.id}>
                        {invoice.vendorName} · {invoice.invoiceNumber || invoice.id.slice(0, 6)} · ${invoice.amount.toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Actual cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.actualCost}
                  onChange={(e) => setForm((current) => ({ ...current, actualCost: e.target.value }))}
                />
              </div>
              <Textarea placeholder="Description" value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} rows={4} />
              <Textarea placeholder="Resolution notes" value={form.resolutionNotes} onChange={(e) => setForm((current) => ({ ...current, resolutionNotes: e.target.value }))} rows={3} />
              <Button className="w-full" onClick={() => saveWorkOrder.mutate()} disabled={saveWorkOrder.isPending || !form.title.trim() || !form.description.trim()}>
                {editing ? "Save Changes" : "Create Work Order"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Association Context</div><div className="mt-1 text-lg font-semibold">{activeAssociationName || "None selected"}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Open / Active</div><div className="mt-1 text-lg font-semibold">{orderCounts.open}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Pending Review</div><div className="mt-1 text-lg font-semibold">{orderCounts.review}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Closed</div><div className="mt-1 text-lg font-semibold">{orderCounts.closed}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-4 flex gap-3 flex-wrap">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
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
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All units</SelectItem>
              {units.map((unit) => <SelectItem key={unit.id} value={unit.id}>{unit.unitNumber}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-lg font-semibold">Maintenance Requests Ready for Conversion</h2>
            <Badge variant="outline">{convertibleRequests.length} available</Badge>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {convertibleRequests.slice(0, 25).map((request) => (
                <TableRow key={request.id}>
                  <TableCell>{request.title}</TableCell>
                  <TableCell>{request.priority}</TableCell>
                  <TableCell><Badge variant="secondary">{request.status}</Badge></TableCell>
                  <TableCell>{units.find((unit) => unit.id === request.unitId)?.unitNumber || "-"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" onClick={() => convertRequest.mutate(request)} disabled={convertRequest.isPending}>Convert</Button>
                  </TableCell>
                </TableRow>
              ))}
              {convertibleRequests.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="h-20 text-center text-muted-foreground">No unconverted maintenance requests.</TableCell></TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <div className="font-medium">{order.title}</div>
                    <div className="text-xs text-muted-foreground">{order.locationText || order.category}</div>
                  </TableCell>
                  <TableCell>{units.find((unit) => unit.id === order.unitId)?.unitNumber || "-"}</TableCell>
                  <TableCell>{vendors.find((vendor) => vendor.id === order.vendorId)?.name || "-"}</TableCell>
                  <TableCell>{invoices.find((invoice) => invoice.id === order.vendorInvoiceId)?.invoiceNumber || (order.vendorInvoiceId ? "linked" : "-")}</TableCell>
                  <TableCell><Badge variant={order.status === "closed" ? "default" : "secondary"}>{order.status}</Badge></TableCell>
                  <TableCell>{order.priority}</TableCell>
                  <TableCell>
                    {order.actualCost != null
                      ? `$${order.actualCost.toFixed(2)} actual`
                      : order.estimatedCost != null
                        ? `$${order.estimatedCost.toFixed(2)} est`
                        : "-"}
                  </TableCell>
                  <TableCell>{new Date(order.updatedAt).toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => openEdit(order)}>Edit</Button>
                  </TableCell>
                </TableRow>
              ))}
              {workOrders.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="h-24 text-center text-muted-foreground">No work orders yet.</TableCell></TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
