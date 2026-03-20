import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { Document, Vendor } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useActiveAssociation } from "@/hooks/use-active-association";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { AssociationScopeBanner } from "@/components/association-scope-banner";
import { AsyncStateBoundary } from "@/components/async-state-boundary";
import { DataTableShell } from "@/components/data-table-shell";
import { TaskFlowChecklist } from "@/components/task-flow-checklist";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertTriangle } from "lucide-react";
import { ExportCsvButton } from "@/components/export-csv-button";
import { useIsMobile } from "@/hooks/use-mobile";

const vendorDocumentTypes = ["Insurance", "Contract", "W-9", "License", "Compliance", "Other"];

const vendorSchema = z.object({
  associationId: z.string().min(1),
  name: z.string().min(1, "Vendor name is required"),
  trade: z.string().min(1, "Trade is required"),
  serviceArea: z.string().optional(),
  primaryContactName: z.string().optional(),
  primaryEmail: z.string().email().optional().or(z.literal("")),
  primaryPhone: z.string().optional(),
  licenseNumber: z.string().optional(),
  insuranceExpiresAt: z.string().optional(),
  status: z.enum(["active", "inactive", "pending-renewal"]),
  notes: z.string().optional(),
});

type VendorFormValues = z.infer<typeof vendorSchema>;

const EMPTY_VALUES: VendorFormValues = {
  associationId: "",
  name: "",
  trade: "general",
  serviceArea: "",
  primaryContactName: "",
  primaryEmail: "",
  primaryPhone: "",
  licenseNumber: "",
  insuranceExpiresAt: "",
  status: "active",
  notes: "",
};

function toPayload(values: VendorFormValues) {
  return {
    ...values,
    serviceArea: values.serviceArea || null,
    primaryContactName: values.primaryContactName || null,
    primaryEmail: values.primaryEmail || null,
    primaryPhone: values.primaryPhone || null,
    licenseNumber: values.licenseNumber || null,
    insuranceExpiresAt: values.insuranceExpiresAt ? new Date(values.insuranceExpiresAt).toISOString() : null,
    notes: values.notes || null,
  };
}


export default function VendorsPage() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();
  const [open, setOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [page, setPage] = useState(1);
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentType, setDocumentType] = useState("Insurance");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentUploadStage, setDocumentUploadStage] = useState<"select" | "details" | "uploading" | "complete">("select");
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
    enabled: Boolean(activeAssociationId),
  });
  const { data: renewalAlerts = [] } = useQuery<Array<{ vendorId: string; vendorName: string; associationId: string; daysUntilExpiry: number; severity: "expired" | "due-soon"; insuranceExpiresAt: string }>>({
    queryKey: ["/api/vendors/renewal-alerts"],
    enabled: Boolean(activeAssociationId),
  });
  const selectedVendor = vendors.find((vendor) => vendor.id === selectedVendorId) ?? null;
  type VendorMetrics = {
    totalWorkOrders: number;
    openWorkOrders: number;
    closedWorkOrders: number;
    avgResolutionDays: number | null;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    recentWorkOrders: Array<{ id: string; title: string; status: string; priority: string | null; createdAt: string }>;
  };
  const { data: vendorMetrics } = useQuery<VendorMetrics>({
    queryKey: ["/api/vendors", selectedVendorId, "metrics"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/vendors/${selectedVendorId}/metrics`);
      return res.json();
    },
    enabled: Boolean(selectedVendorId),
  });
  const { data: vendorDocuments = [] } = useQuery<Document[]>({
    queryKey: ["/api/vendors", selectedVendorId, "documents"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/vendors/${selectedVendorId}/documents`);
      return res.json();
    },
    enabled: Boolean(selectedVendorId),
  });

  const form = useForm<VendorFormValues>({
    resolver: zodResolver(vendorSchema),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (!open) return;

    if (editingVendor) {
      form.reset({
        associationId: editingVendor.associationId,
        name: editingVendor.name,
        trade: editingVendor.trade,
        serviceArea: editingVendor.serviceArea || "",
        primaryContactName: editingVendor.primaryContactName || "",
        primaryEmail: editingVendor.primaryEmail || "",
        primaryPhone: editingVendor.primaryPhone || "",
        licenseNumber: editingVendor.licenseNumber || "",
        insuranceExpiresAt: editingVendor.insuranceExpiresAt ? new Date(editingVendor.insuranceExpiresAt).toISOString().slice(0, 10) : "",
        status: editingVendor.status,
        notes: editingVendor.notes || "",
      });
      return;
    }

    form.reset({
      ...EMPTY_VALUES,
      associationId: activeAssociationId,
    });
  }, [activeAssociationId, editingVendor, form, open]);

  const upsertVendor = useMutation({
    mutationFn: async (values: VendorFormValues) => {
      const payload = toPayload(values);
      const res = editingVendor
        ? await apiRequest("PATCH", `/api/vendors/${editingVendor.id}`, payload)
        : await apiRequest("POST", "/api/vendors", payload);
      return res.json() as Promise<Vendor>;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      setOpen(false);
      setEditingVendor(null);
      form.reset({
        ...EMPTY_VALUES,
        associationId: activeAssociationId,
      });
      toast({ title: editingVendor ? "Vendor updated" : "Vendor created" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const uploadVendorDocument = useMutation({
    mutationFn: async () => {
      if (!selectedVendorId || !documentTitle.trim() || !documentType.trim() || !documentFile) {
        throw new Error("Vendor, document title, document type, and file are required");
      }
      const formData = new FormData();
      formData.append("title", documentTitle.trim());
      formData.append("documentType", documentType);
      formData.append("file", documentFile);
      const res = await fetch(`/api/vendors/${selectedVendorId}/documents`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error((await res.text()) || res.statusText);
      }
      return res.json() as Promise<Document>;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/vendors", selectedVendorId, "documents"] });
      setDocumentTitle("");
      setDocumentType("Insurance");
      setDocumentFile(null);
      setDocumentUploadStage("complete");
      toast({ title: "Vendor document uploaded" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const visibleVendors = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = vendors.filter((vendor) => {
      if (statusFilter !== "all" && vendor.status !== statusFilter) {
        return false;
      }
      if (!term) return true;
      return [vendor.name, vendor.trade, vendor.serviceArea, vendor.primaryContactName, vendor.primaryEmail]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(term));
    });

    rows.sort((left, right) => {
      if (sortBy === "recent-expiry") {
        return new Date(left.insuranceExpiresAt || 0).getTime() - new Date(right.insuranceExpiresAt || 0).getTime();
      }
      if (sortBy === "trade") {
        return left.trade.localeCompare(right.trade);
      }
      return left.name.localeCompare(right.name);
    });

    return rows;
  }, [search, sortBy, statusFilter, vendors]);

  const totalPages = Math.max(1, Math.ceil(visibleVendors.length / 10));
  const pagedVendors = visibleVendors.slice((page - 1) * 10, page * 10);

  const activeCount = vendors.filter((vendor) => vendor.status === "active").length;
  const renewalCount = vendors.filter((vendor) => vendor.status === "pending-renewal").length;
  const expiredCount = renewalAlerts.filter((alert) => alert.severity === "expired").length;

  useEffect(() => {
    if (!selectedVendorId && visibleVendors.length > 0) {
      setSelectedVendorId(visibleVendors[0].id);
      return;
    }
    if (selectedVendorId && !vendors.some((vendor) => vendor.id === selectedVendorId)) {
      setSelectedVendorId(visibleVendors[0]?.id || "");
    }
  }, [selectedVendorId, vendors, visibleVendors]);

  useEffect(() => {
    if (!documentFile) {
      setDocumentUploadStage("select");
      return;
    }
    setDocumentUploadStage(documentTitle.trim() ? "details" : "select");
  }, [documentFile, documentTitle]);

  useEffect(() => {
    setPage(1);
  }, [search, sortBy, statusFilter]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return (
    <div className="p-6 space-y-6">
      <WorkspacePageHeader
        title="Vendor Registry"
        summary="Manage vendors, compliance exposure, and supporting documents in one operations surface."
        eyebrow="Operations"
        breadcrumbs={[{ label: "Dashboard", href: "/app" }, { label: "Vendor Registry" }]}
        shortcuts={[
          { label: "Open Work Orders", href: "/app/work-orders" },
          { label: "Open Vendor Invoices", href: "/app/financial-invoices" },
        ]}
        actions={
          <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
              setOpen(nextOpen);
              if (!nextOpen) {
                setEditingVendor(null);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button disabled={!activeAssociationId}>Add Vendor</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto sm:max-h-[85vh]">
              <DialogHeader>
                <DialogTitle>{editingVendor ? "Edit Vendor" : "Create Vendor"}</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form className="space-y-4" onSubmit={form.handleSubmit((values) => upsertVendor.mutate(values))}>
                  <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                    Association Context: <span className="font-medium">{activeAssociationName || "None selected"}</span>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vendor Name</FormLabel>
                        <FormControl><Input {...field} className={isMobile ? "min-h-11" : undefined} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="trade"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Trade</FormLabel>
                        <FormControl><Input {...field} className={isMobile ? "min-h-11" : undefined} placeholder="plumbing, landscaping, electrician" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="primaryContactName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primary Contact</FormLabel>
                        <FormControl><Input {...field} className={isMobile ? "min-h-11" : undefined} value={field.value || ""} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="serviceArea"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Service Area</FormLabel>
                        <FormControl><Input {...field} className={isMobile ? "min-h-11" : undefined} value={field.value || ""} placeholder="New Haven County" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="primaryEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl><Input {...field} className={isMobile ? "min-h-11" : undefined} value={field.value || ""} type="email" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="primaryPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl><Input {...field} className={isMobile ? "min-h-11" : undefined} value={field.value || ""} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="licenseNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>License Number</FormLabel>
                        <FormControl><Input {...field} className={isMobile ? "min-h-11" : undefined} value={field.value || ""} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="insuranceExpiresAt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Insurance Expires</FormLabel>
                        <FormControl><Input {...field} className={isMobile ? "min-h-11" : undefined} value={field.value || ""} type="date" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className={isMobile ? "min-h-11" : undefined}><SelectValue /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="active">active</SelectItem>
                            <SelectItem value="inactive">inactive</SelectItem>
                            <SelectItem value="pending-renewal">pending-renewal</SelectItem>
                          </SelectContent>
                        </Select>
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
                        <FormControl><Textarea {...field} className={isMobile ? "min-h-28" : undefined} value={field.value || ""} rows={4} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button className="w-full" type="submit" disabled={upsertVendor.isPending}>
                    {editingVendor ? "Save Changes" : "Create Vendor"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        }
      />

      <AssociationScopeBanner
        activeAssociationId={activeAssociationId}
        activeAssociationName={activeAssociationName}
        explanation={
          activeAssociationId
            ? "Vendor records, compliance alerts, and uploaded documents are scoped to the active association."
            : "Select an association before managing vendors or filing compliance documents."
        }
      />

      {expiredCount > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
          <div>
            <p className="font-medium text-sm text-destructive">
              {expiredCount} vendor{expiredCount !== 1 ? "s" : ""} with expired insurance
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Do not assign work orders to vendors with expired coverage. Request updated certificates of insurance and
              update the expiry date when renewed. Scroll down to Renewal Alerts for the full list.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Association Context</div><div className="mt-1 text-lg font-semibold">{activeAssociationName || "None selected"}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Active Vendors</div><div className="mt-1 text-lg font-semibold">{activeCount}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Pending Renewal</div><div className="mt-1 text-lg font-semibold">{renewalCount}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Expired Insurance</div><div className="mt-1 text-lg font-semibold">{expiredCount}</div></CardContent></Card>
      </div>

      <AsyncStateBoundary
        isLoading={!vendors}
        isEmpty={!vendors.length}
        emptyTitle="No vendors yet"
        emptyMessage={activeAssociationId ? "Add contractors, plumbers, landscapers, and other service providers here. Vendors can be assigned to work orders, and their insurance expiry dates are tracked and alerted." : "Select an association from the top navigation bar to manage its vendor directory."}
      >
        <DataTableShell
          title="Vendor Directory"
          description="Search and filter the registry, then open a vendor detail panel without losing your place in the table."
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search vendors by name, trade, service area, or contact"
          summary={`${visibleVendors.length} vendors`}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          filterSlot={
            <div className={`flex items-center gap-3 flex-wrap ${isMobile ? "w-full" : ""}`}>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className={isMobile ? "w-full min-h-11" : "w-[180px]"}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending-renewal">Pending renewal</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className={isMobile ? "w-full min-h-11" : "w-[180px]"}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name A-Z</SelectItem>
                  <SelectItem value="trade">Trade A-Z</SelectItem>
                  <SelectItem value="recent-expiry">Nearest expiry</SelectItem>
                </SelectContent>
              </Select>
              <ExportCsvButton
                headers={["Name", "Trade", "Status", "Contact Email", "Contact Phone", "Service Area", "Insurance Expiry"]}
                rows={visibleVendors.map((v) => [v.name, v.trade, v.status, v.primaryEmail || "", v.primaryContactName || "", v.serviceArea || "", v.insuranceExpiresAt ? new Date(v.insuranceExpiresAt).toLocaleDateString() : ""])}
                filename={`vendors-${activeAssociationName || "all"}`}
              />
            </div>
          }
        >
          <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>Trade</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Insurance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedVendors.map((vendor) => (
                <TableRow key={vendor.id}>
                  <TableCell>
                    <button className="text-left" onClick={() => setSelectedVendorId(vendor.id)}>
                      <div className="font-medium">{vendor.name}</div>
                    </button>
                    <div className="text-xs text-muted-foreground">{vendor.serviceArea || "Service area not set"}</div>
                  </TableCell>
                  <TableCell>{vendor.trade}</TableCell>
                  <TableCell>
                    <div>{vendor.primaryContactName || "-"}</div>
                    <div className="text-xs text-muted-foreground">{vendor.primaryEmail || vendor.primaryPhone || "-"}</div>
                  </TableCell>
                  <TableCell>
                    {vendor.insuranceExpiresAt ? (
                      <div className="space-y-0.5">
                        <div className="text-sm">{new Date(vendor.insuranceExpiresAt).toLocaleDateString()}</div>
                        {(() => {
                          const alert = renewalAlerts.find((a) => a.vendorId === vendor.id);
                          if (!alert) return null;
                          return (
                            <Badge variant={alert.severity === "expired" ? "destructive" : "secondary"} className="text-xs">
                              {alert.severity === "expired"
                                ? `Expired ${Math.abs(alert.daysUntilExpiry)}d ago`
                                : `Expires in ${alert.daysUntilExpiry}d`}
                            </Badge>
                          );
                        })()}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell><Badge variant={vendor.status === "active" ? "default" : "secondary"}>{vendor.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setSelectedVendorId(vendor.id)}>View</Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingVendor(vendor);
                          setOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
          <div className="space-y-3 md:hidden">
            {pagedVendors.map((vendor) => (
              <div key={vendor.id} className="rounded-xl border p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <button className="min-w-0 text-left" onClick={() => setSelectedVendorId(vendor.id)}>
                    <div className="font-medium">{vendor.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{vendor.serviceArea || "Service area not set"}</div>
                  </button>
                  <Badge variant={vendor.status === "active" ? "default" : "secondary"}>{vendor.status}</Badge>
                </div>
                <div className="grid gap-2 text-xs text-muted-foreground">
                  <div>Trade: {vendor.trade}</div>
                  <div>Contact: {vendor.primaryContactName || "-"}</div>
                  <div>{vendor.primaryEmail || vendor.primaryPhone || "-"}</div>
                  <div>
                    Insurance: {vendor.insuranceExpiresAt ? new Date(vendor.insuranceExpiresAt).toLocaleDateString() : "—"}
                  </div>
                </div>
                {(() => {
                  const alert = renewalAlerts.find((a) => a.vendorId === vendor.id);
                  if (!alert) return null;
                  return (
                    <Badge variant={alert.severity === "expired" ? "destructive" : "secondary"} className="text-xs">
                      {alert.severity === "expired"
                        ? `Expired ${Math.abs(alert.daysUntilExpiry)}d ago`
                        : `Expires in ${alert.daysUntilExpiry}d`}
                    </Badge>
                  );
                })()}
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSelectedVendorId(vendor.id)}>View</Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingVendor(vendor);
                      setOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DataTableShell>
      </AsyncStateBoundary>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Renewal Alerts</h2>
            <p className="text-sm text-muted-foreground">Insurance expirations within 30 days are flagged automatically and vendor status is pushed to pending-renewal unless the vendor is inactive.</p>
          </div>
          <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Insurance Expires</TableHead>
                <TableHead>Days</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {renewalAlerts.map((alert) => (
                <TableRow key={alert.vendorId}>
                  <TableCell>
                    <button className="text-left font-medium" onClick={() => setSelectedVendorId(alert.vendorId)}>
                      {alert.vendorName}
                    </button>
                  </TableCell>
                  <TableCell>
                    <Badge variant={alert.severity === "expired" ? "destructive" : "secondary"}>{alert.severity}</Badge>
                  </TableCell>
                  <TableCell>{new Date(alert.insuranceExpiresAt).toLocaleDateString()}</TableCell>
                  <TableCell>{alert.daysUntilExpiry}</TableCell>
                </TableRow>
              ))}
              {renewalAlerts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">No vendor renewal alerts in the current association.</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
          </div>
          <div className="space-y-3 md:hidden">
            {renewalAlerts.map((alert) => (
              <div key={alert.vendorId} className="rounded-xl border p-4 space-y-2">
                <button className="text-left font-medium" onClick={() => setSelectedVendorId(alert.vendorId)}>
                  {alert.vendorName}
                </button>
                <div className="flex items-center justify-between gap-3">
                  <Badge variant={alert.severity === "expired" ? "destructive" : "secondary"}>{alert.severity}</Badge>
                  <span className="text-xs text-muted-foreground">{alert.daysUntilExpiry}d</span>
                </div>
                <div className="text-xs text-muted-foreground">{new Date(alert.insuranceExpiresAt).toLocaleDateString()}</div>
              </div>
            ))}
            {renewalAlerts.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No vendor renewal alerts in the current association.</div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold">Vendor Documents</h2>
              <p className="text-sm text-muted-foreground">
                {selectedVendor ? `Files for ${selectedVendor.name} in ${activeAssociationName || "the current association"}.` : "Select a vendor to manage insurance certificates, W-9s, and contracts."}
              </p>
            </div>
            {selectedVendor ? <Badge variant="outline">{vendorDocuments.length} filed</Badge> : null}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  className={isMobile ? "min-h-11" : undefined}
                  placeholder="Document title"
                  value={documentTitle}
                  onChange={(event) => setDocumentTitle(event.target.value)}
                  disabled={!selectedVendor}
                />
                <Select value={documentType} onValueChange={setDocumentType} disabled={!selectedVendor}>
                  <SelectTrigger className={isMobile ? "min-h-11" : undefined}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {vendorDocumentTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <div className="border rounded-md p-3 text-sm cursor-pointer" onClick={() => selectedVendor ? fileRef.current?.click() : null}>
                  <div className="font-medium">{documentFile?.name || "Choose file"}</div>
                  <div className="text-xs text-muted-foreground">{documentFile ? `${Math.max(1, Math.round(documentFile.size / 1024))} KB selected` : "Upload insurance certificates, contracts, W-9s, and licenses."}</div>
                  <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)}
                  />
                </div>
                <Button
                  className={isMobile ? "w-full min-h-11" : undefined}
                  onClick={() => {
                    setDocumentUploadStage("uploading");
                    uploadVendorDocument.mutate();
                  }}
                  disabled={uploadVendorDocument.isPending || !selectedVendor}
                >
                  {uploadVendorDocument.isPending ? "Uploading..." : "Upload"}
                </Button>
              </div>
            </div>

            <TaskFlowChecklist
              title="Vendor Filing Workflow"
              description="File compliance and contract documents against the selected vendor record."
              activeLabel={uploadVendorDocument.isPending ? "Uploading" : documentUploadStage === "complete" ? "Uploaded" : undefined}
              steps={[
                { label: "Choose the vendor", detail: selectedVendor?.name || "Select a vendor from the registry first.", done: Boolean(selectedVendor) },
                { label: "Choose the file", detail: documentFile?.name || "Pick the source file to attach to the vendor record.", done: Boolean(documentFile) },
                { label: "Classify the filing", detail: documentTitle.trim() ? `${documentType} · ${documentTitle}` : "Set a title and type so the document can be found later.", done: Boolean(documentTitle.trim() && documentType) },
                { label: "Upload into the vendor record", detail: uploadVendorDocument.isPending ? "Upload in progress." : "Submit when the filing package is ready.", done: documentUploadStage === "complete" },
              ]}
            />
          </div>

          <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Access</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendorDocuments.map((document) => (
                <TableRow key={document.id}>
                  <TableCell>{document.title}</TableCell>
                  <TableCell>{document.documentType}</TableCell>
                  <TableCell>{new Date(document.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell><a className="underline text-sm" href={document.fileUrl} target="_blank" rel="noreferrer">Open</a></TableCell>
                </TableRow>
              ))}
              {selectedVendor && vendorDocuments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">No vendor documents filed yet.</TableCell>
                </TableRow>
              ) : null}
              {!selectedVendor ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">Choose a vendor from the registry first.</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
          </div>
          <div className="space-y-3 md:hidden">
            {vendorDocuments.map((document) => (
              <div key={document.id} className="rounded-xl border p-4 space-y-2">
                <div className="text-sm font-medium">{document.title}</div>
                <div className="text-xs text-muted-foreground">{document.documentType} · {new Date(document.createdAt).toLocaleDateString()}</div>
                <a className="inline-flex text-sm underline" href={document.fileUrl} target="_blank" rel="noreferrer">Open</a>
              </div>
            ))}
            {selectedVendor && vendorDocuments.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No vendor documents filed yet.</div>
            ) : null}
            {!selectedVendor ? (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Choose a vendor from the registry first.</div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Sheet open={Boolean(selectedVendor)} onOpenChange={(nextOpen) => { if (!nextOpen) setSelectedVendorId(""); }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedVendor?.name || "Vendor Detail"}</SheetTitle>
            <SheetDescription>
              {selectedVendor ? `Review contact, compliance, and document context for ${selectedVendor.name}.` : "Select a vendor from the table."}
            </SheetDescription>
          </SheetHeader>
          {selectedVendor ? (
            <div className="mt-6 space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Trade</div><div className="mt-1 font-medium">{selectedVendor.trade}</div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Status</div><div className="mt-1"><Badge variant={selectedVendor.status === "active" ? "default" : "secondary"}>{selectedVendor.status}</Badge></div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Primary Contact</div><div className="mt-1 font-medium">{selectedVendor.primaryContactName || "-"}</div><div className="text-sm text-muted-foreground">{selectedVendor.primaryEmail || selectedVendor.primaryPhone || "-"}</div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Insurance Expires</div><div className="mt-1 font-medium">{selectedVendor.insuranceExpiresAt ? new Date(selectedVendor.insuranceExpiresAt).toLocaleDateString() : "-"}</div></CardContent></Card>
              </div>
              <Card>
                <CardContent className="p-4 space-y-2">
                  <div className="text-sm text-muted-foreground">Notes</div>
                  <div className="text-sm">{selectedVendor.notes || "No internal notes recorded for this vendor."}</div>
                </CardContent>
              </Card>
              {vendorMetrics && (
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="font-medium">Work Order Performance</div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-md border p-3 text-center">
                        <div className="text-2xl font-bold">{vendorMetrics.totalWorkOrders}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">Total</div>
                      </div>
                      <div className="rounded-md border p-3 text-center">
                        <div className="text-2xl font-bold text-orange-600">{vendorMetrics.openWorkOrders}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">Open</div>
                      </div>
                      <div className="rounded-md border p-3 text-center">
                        <div className="text-2xl font-bold text-green-600">{vendorMetrics.closedWorkOrders}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">Closed</div>
                      </div>
                    </div>
                    {vendorMetrics.avgResolutionDays !== null && (
                      <div className="text-sm text-muted-foreground">
                        Avg. resolution time: <span className="font-medium text-foreground">{vendorMetrics.avgResolutionDays} days</span>
                      </div>
                    )}
                    {vendorMetrics.recentWorkOrders.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground uppercase tracking-wide">Recent Work Orders</div>
                        {vendorMetrics.recentWorkOrders.map((wo) => (
                          <div key={wo.id} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                            <span className="truncate mr-2">{wo.title}</span>
                            <Badge variant={wo.status === "closed" ? "secondary" : wo.status === "open" ? "outline" : "default"} className="shrink-0 text-xs">
                              {wo.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium">Filed Documents</div>
                    <Badge variant="outline">{vendorDocuments.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {vendorDocuments.length ? vendorDocuments.map((document) => (
                      <div key={document.id} className="rounded-md border p-3">
                        <div className="font-medium">{document.title}</div>
                        <div className="text-xs text-muted-foreground">{document.documentType} · {new Date(document.createdAt).toLocaleDateString()}</div>
                      </div>
                    )) : <div className="text-sm text-muted-foreground">No vendor documents filed yet.</div>}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
