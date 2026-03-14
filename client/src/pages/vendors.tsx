import { useEffect, useRef, useState } from "react";
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

function getAdminHeaders() {
  const apiKey = (window.localStorage.getItem("adminApiKey") || "").trim();
  const adminUserEmail = (window.localStorage.getItem("adminUserEmail") || "").trim().toLowerCase();
  const headers: Record<string, string> = {};
  if (apiKey && adminUserEmail) {
    headers["x-admin-api-key"] = apiKey;
    headers["x-admin-user-email"] = adminUserEmail;
  }
  return headers;
}

export default function VendorsPage() {
  const { toast } = useToast();
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();
  const [open, setOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [search, setSearch] = useState("");
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentType, setDocumentType] = useState("Insurance");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
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
        headers: getAdminHeaders(),
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
      toast({ title: "Vendor document uploaded" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const visibleVendors = (() => {
    const term = search.trim().toLowerCase();
    if (!term) return vendors;
    return vendors.filter((vendor) =>
      [vendor.name, vendor.trade, vendor.serviceArea, vendor.primaryContactName, vendor.primaryEmail]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(term)),
    );
  })();

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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vendor Registry</h1>
          <p className="text-muted-foreground">Phase 7 foundation for vendor records, compliance visibility, and future work-order assignment.</p>
        </div>
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
          <DialogContent className="max-w-2xl">
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
                        <FormControl><Input {...field} /></FormControl>
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
                        <FormControl><Input {...field} placeholder="plumbing, landscaping, electrician" /></FormControl>
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
                        <FormControl><Input {...field} value={field.value || ""} /></FormControl>
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
                        <FormControl><Input {...field} value={field.value || ""} placeholder="New Haven County" /></FormControl>
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
                        <FormControl><Input {...field} value={field.value || ""} type="email" /></FormControl>
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
                        <FormControl><Input {...field} value={field.value || ""} /></FormControl>
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
                        <FormControl><Input {...field} value={field.value || ""} /></FormControl>
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
                        <FormControl><Input {...field} value={field.value || ""} type="date" /></FormControl>
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
                            <SelectTrigger><SelectValue /></SelectTrigger>
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
                      <FormControl><Textarea {...field} value={field.value || ""} rows={4} /></FormControl>
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
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Association Context</div><div className="mt-1 text-lg font-semibold">{activeAssociationName || "None selected"}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Active Vendors</div><div className="mt-1 text-lg font-semibold">{activeCount}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Pending Renewal</div><div className="mt-1 text-lg font-semibold">{renewalCount}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Expired Insurance</div><div className="mt-1 text-lg font-semibold">{expiredCount}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <Input
            placeholder="Search vendors by name, trade, service area, or contact"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            disabled={!activeAssociationId}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
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
              {visibleVendors.map((vendor) => (
                <TableRow key={vendor.id}>
                  <TableCell>
                    <button
                      className="text-left"
                      onClick={() => setSelectedVendorId(vendor.id)}
                    >
                      <div className="font-medium">{vendor.name}</div>
                    </button>
                    <div className="text-xs text-muted-foreground">{vendor.serviceArea || "Service area not set"}</div>
                  </TableCell>
                  <TableCell>{vendor.trade}</TableCell>
                  <TableCell>
                    <div>{vendor.primaryContactName || "-"}</div>
                    <div className="text-xs text-muted-foreground">{vendor.primaryEmail || vendor.primaryPhone || "-"}</div>
                  </TableCell>
                  <TableCell>{vendor.insuranceExpiresAt ? new Date(vendor.insuranceExpiresAt).toLocaleDateString() : "-"}</TableCell>
                  <TableCell><Badge variant={vendor.status === "active" ? "default" : "secondary"}>{vendor.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setSelectedVendorId(vendor.id)}>Documents</Button>
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
              {visibleVendors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    {activeAssociationId ? "No vendors in this association yet." : "Select an association to manage vendors."}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Renewal Alerts</h2>
            <p className="text-sm text-muted-foreground">Insurance expirations within 30 days are flagged automatically and vendor status is pushed to pending-renewal unless the vendor is inactive.</p>
          </div>
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

          <div className="grid gap-3 md:grid-cols-4">
            <Input
              placeholder="Document title"
              value={documentTitle}
              onChange={(event) => setDocumentTitle(event.target.value)}
              disabled={!selectedVendor}
            />
            <Select value={documentType} onValueChange={setDocumentType} disabled={!selectedVendor}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {vendorDocumentTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="border rounded-md p-2 text-sm cursor-pointer" onClick={() => selectedVendor ? fileRef.current?.click() : null}>
              {documentFile?.name || "Choose file"}
              <input ref={fileRef} type="file" className="hidden" onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)} />
            </div>
            <Button onClick={() => uploadVendorDocument.mutate()} disabled={uploadVendorDocument.isPending || !selectedVendor}>
              Upload
            </Button>
          </div>

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
        </CardContent>
      </Card>
    </div>
  );
}
