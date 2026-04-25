// zone: Operations
// persona: Manager, Board Officer, Assisted Board, PM Assistant
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { AssociationAsset, MaintenanceScheduleInstance, MaintenanceScheduleTemplate, Unit, Vendor } from "@shared/schema";
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
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { t } from "@/i18n/use-strings";

type FrequencyUnit = "month" | "quarter" | "year";
type TemplateStatus = "active" | "paused" | "archived";

type ScheduleResponse = {
  templates: MaintenanceScheduleTemplate[];
  instances: MaintenanceScheduleInstance[];
};

const emptyForm = {
  title: "",
  component: "",
  description: "",
  locationText: "",
  frequencyUnit: "quarter" as FrequencyUnit,
  frequencyInterval: "1",
  responsibleParty: "",
  unitId: "",
  vendorId: "",
  nextDueAt: new Date().toISOString().slice(0, 10),
  status: "active" as TemplateStatus,
  autoCreateWorkOrder: false,
};

export function MaintenanceSchedulesContent() {
  const { toast } = useToast();
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MaintenanceScheduleTemplate | null>(null);
  const [form, setForm] = useState(emptyForm);

  const [assetOpen, setAssetOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<AssociationAsset | null>(null);
  const emptyAssetForm = { name: "", assetType: "", manufacturer: "", model: "", serialNumber: "", location: "", installDate: "", warrantyExpiresAt: "", lastServicedAt: "", nextServiceDueAt: "", estimatedLifespanYears: "", replacementCostEstimate: "", condition: "unknown" as const, notes: "", vendorId: "", unitId: "" };
  const [assetForm, setAssetForm] = useState(emptyAssetForm);

  const { data: scheduleData } = useQuery<ScheduleResponse>({
    queryKey: ["/api/maintenance/schedules"],
    enabled: Boolean(activeAssociationId),
  });
  const { data: units = [] } = useQuery<Unit[]>({
    queryKey: ["/api/units"],
    enabled: Boolean(activeAssociationId),
  });
  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
    enabled: Boolean(activeAssociationId),
  });

  const templates = scheduleData?.templates ?? [];
  const instances = scheduleData?.instances ?? [];

  const { data: assets = [] } = useQuery<AssociationAsset[]>({
    queryKey: ["/api/assets", activeAssociationId],
    queryFn: async () => {
      if (!activeAssociationId) return [];
      const res = await apiRequest("GET", `/api/assets?associationId=${activeAssociationId}`);
      return res.json();
    },
    enabled: Boolean(activeAssociationId),
  });

  const saveAsset = useMutation({
    mutationFn: async () => {
      if (!activeAssociationId) throw new Error("Select an association first");
      const payload: Record<string, unknown> = {
        associationId: activeAssociationId,
        name: assetForm.name,
        assetType: assetForm.assetType,
        manufacturer: assetForm.manufacturer || null,
        model: assetForm.model || null,
        serialNumber: assetForm.serialNumber || null,
        location: assetForm.location || null,
        condition: assetForm.condition,
        notes: assetForm.notes || null,
        vendorId: assetForm.vendorId || null,
        unitId: assetForm.unitId || null,
        installDate: assetForm.installDate ? new Date(assetForm.installDate).toISOString() : null,
        warrantyExpiresAt: assetForm.warrantyExpiresAt ? new Date(assetForm.warrantyExpiresAt).toISOString() : null,
        lastServicedAt: assetForm.lastServicedAt ? new Date(assetForm.lastServicedAt).toISOString() : null,
        nextServiceDueAt: assetForm.nextServiceDueAt ? new Date(assetForm.nextServiceDueAt).toISOString() : null,
        estimatedLifespanYears: assetForm.estimatedLifespanYears ? Number(assetForm.estimatedLifespanYears) : null,
        replacementCostEstimate: assetForm.replacementCostEstimate ? Number(assetForm.replacementCostEstimate) : null,
      };
      const res = editingAsset
        ? await apiRequest("PATCH", `/api/assets/${editingAsset.id}`, payload)
        : await apiRequest("POST", "/api/assets", payload);
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/assets", activeAssociationId] });
      setAssetOpen(false);
      setEditingAsset(null);
      setAssetForm(emptyAssetForm);
      toast({ title: editingAsset ? "Asset updated" : "Asset registered" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const deleteAsset = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/assets/${id}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/assets", activeAssociationId] });
      toast({ title: "Asset removed" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const saveTemplate = useMutation({
    mutationFn: async () => {
      if (!activeAssociationId) throw new Error("Select an association first");
      const payload = {
        associationId: activeAssociationId,
        unitId: form.unitId || null,
        vendorId: form.vendorId || null,
        title: form.title,
        component: form.component,
        description: form.description || null,
        locationText: form.locationText,
        frequencyUnit: form.frequencyUnit,
        frequencyInterval: Number(form.frequencyInterval || "1"),
        responsibleParty: form.responsibleParty || null,
        autoCreateWorkOrder: form.autoCreateWorkOrder ? 1 : 0,
        nextDueAt: new Date(form.nextDueAt).toISOString(),
        status: form.status,
      };
      const res = editing
        ? await apiRequest("PATCH", `/api/maintenance/schedules/${editing.id}`, payload)
        : await apiRequest("POST", "/api/maintenance/schedules", payload);
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/maintenance/schedules"] });
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      toast({ title: editing ? "Schedule updated" : "Schedule created" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const generateInstances = useMutation({
    mutationFn: async (templateId: string) => {
      const res = await apiRequest("POST", `/api/maintenance/schedules/${templateId}/generate`, {});
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/maintenance/schedules"] });
      toast({ title: "Schedule instances generated" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const convertInstance = useMutation({
    mutationFn: async (instanceId: string) => {
      const res = await apiRequest("POST", `/api/maintenance/instances/${instanceId}/convert-to-work-order`, {
        associationId: activeAssociationId,
      });
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/maintenance/schedules"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      toast({ title: "Maintenance instance converted to work order" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const counts = useMemo(() => ({
    templates: templates.length,
    due: instances.filter((instance) => instance.status === "due").length,
    converted: instances.filter((instance) => instance.status === "converted" || instance.workOrderId).length,
  }), [instances, templates.length]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(template: MaintenanceScheduleTemplate) {
    setEditing(template);
    setForm({
      title: template.title,
      component: template.component,
      description: template.description || "",
      locationText: template.locationText,
      frequencyUnit: template.frequencyUnit as FrequencyUnit,
      frequencyInterval: String(template.frequencyInterval),
      responsibleParty: template.responsibleParty || "",
      unitId: template.unitId || "",
      vendorId: template.vendorId || "",
      nextDueAt: new Date(template.nextDueAt).toISOString().slice(0, 10),
      status: template.status as TemplateStatus,
      autoCreateWorkOrder: Boolean(template.autoCreateWorkOrder),
    });
    setOpen(true);
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button disabled={!activeAssociationId} onClick={openCreate}>{t("maintenanceSchedules.action.newSchedule")}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader><DialogTitle>{editing ? t("maintenanceSchedules.dialog.editTitle") : t("maintenanceSchedules.dialog.newTitle")}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                Association Context: <span className="font-medium">{activeAssociationName || "None selected"}</span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Input placeholder="Title" value={form.title} onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))} />
                <Input placeholder="Component" value={form.component} onChange={(e) => setForm((current) => ({ ...current, component: e.target.value }))} />
                <Input placeholder="Location" value={form.locationText} onChange={(e) => setForm((current) => ({ ...current, locationText: e.target.value }))} />
                <Input placeholder="Responsible party" value={form.responsibleParty} onChange={(e) => setForm((current) => ({ ...current, responsibleParty: e.target.value }))} />
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
                    <SelectItem value="none">No vendor</SelectItem>
                    {vendors.map((vendor) => <SelectItem key={vendor.id} value={vendor.id}>{vendor.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={form.frequencyUnit} onValueChange={(value: FrequencyUnit) => setForm((current) => ({ ...current, frequencyUnit: value }))}>
                  <SelectTrigger><SelectValue placeholder="Frequency" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">month</SelectItem>
                    <SelectItem value="quarter">quarter</SelectItem>
                    <SelectItem value="year">year</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="number" min="1" step="1" placeholder="Frequency interval" value={form.frequencyInterval} onChange={(e) => setForm((current) => ({ ...current, frequencyInterval: e.target.value }))} />
                <Input type="date" value={form.nextDueAt} onChange={(e) => setForm((current) => ({ ...current, nextDueAt: e.target.value }))} />
                <Select value={form.status} onValueChange={(value: TemplateStatus) => setForm((current) => ({ ...current, status: value }))}>
                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">active</SelectItem>
                    <SelectItem value="paused">paused</SelectItem>
                    <SelectItem value="archived">archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Textarea placeholder="Description" value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.autoCreateWorkOrder}
                  onChange={(e) => setForm((current) => ({ ...current, autoCreateWorkOrder: e.target.checked }))}
                />
                Auto-create work order when due
              </label>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => saveTemplate.mutate()} disabled={!form.title.trim() || !form.component.trim() || !form.locationText.trim()}>
                  {editing ? "Save Changes" : "Create Schedule"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">{t("maintenanceSchedules.stats.templates")}</div><div className="text-2xl font-semibold">{counts.templates}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">{t("maintenanceSchedules.stats.due")}</div><div className="text-2xl font-semibold">{counts.due}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">{t("maintenanceSchedules.stats.converted")}</div><div className="text-2xl font-semibold">{counts.converted}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          {/* Wave 27 a11y: aria-label names this maintenance templates table. */}
          <Table aria-label={t("maintenanceSchedules.templates.tableLabel")}>
            <TableHeader>
              <TableRow>
                <TableHead>{t("maintenanceSchedules.col.title")}</TableHead>
                <TableHead>{t("maintenanceSchedules.col.component")}</TableHead>
                <TableHead>{t("maintenanceSchedules.col.frequency")}</TableHead>
                <TableHead>{t("maintenanceSchedules.col.nextDue")}</TableHead>
                <TableHead>{t("maintenanceSchedules.col.status")}</TableHead>
                <TableHead className="text-right">{t("maintenanceSchedules.col.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell>
                    <div className="font-medium">{template.title}</div>
                    <div className="text-xs text-muted-foreground">{template.locationText}</div>
                  </TableCell>
                  <TableCell>{template.component}</TableCell>
                  <TableCell>Every {template.frequencyInterval} {template.frequencyUnit}{template.frequencyInterval > 1 ? "s" : ""}</TableCell>
                  <TableCell>{new Date(template.nextDueAt).toLocaleDateString()}</TableCell>
                  <TableCell><Badge variant="outline">{template.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => generateInstances.mutate(template.id)} aria-label={`Generate instances for ${template.title}`}>Generate</Button>
                      <Button size="sm" variant="outline" onClick={() => openEdit(template)} aria-label={`${t("common.action.edit")} ${template.title}`}>{t("common.action.edit")}</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {templates.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground" role="status">{t("maintenanceSchedules.empty.templates")}</TableCell></TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {/* Wave 27 a11y: aria-label names this generated instances table. */}
          <Table aria-label={t("maintenanceSchedules.instances.tableLabel")}>
            <TableHeader>
              <TableRow>
                <TableHead>{t("maintenanceSchedules.col.scheduledWork")}</TableHead>
                <TableHead>{t("maintenanceSchedules.col.due")}</TableHead>
                <TableHead>{t("maintenanceSchedules.col.status")}</TableHead>
                <TableHead>{t("maintenanceSchedules.col.workOrder")}</TableHead>
                <TableHead className="text-right">{t("maintenanceSchedules.col.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instances.map((instance) => (
                <TableRow key={instance.id}>
                  <TableCell>
                    <div className="font-medium">{instance.title}</div>
                    <div className="text-xs text-muted-foreground">{instance.component} · {instance.locationText}</div>
                  </TableCell>
                  <TableCell>{new Date(instance.dueAt).toLocaleDateString()}</TableCell>
                  <TableCell><Badge variant="outline">{instance.status}</Badge></TableCell>
                  <TableCell>{instance.workOrderId || "-"}</TableCell>
                  <TableCell className="text-right">
                    {instance.workOrderId ? (
                      <Badge variant="secondary">converted</Badge>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => convertInstance.mutate(instance.id)} aria-label={`Convert ${instance.title} to work order`}>
                        Convert
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {instances.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground" role="status">{t("maintenanceSchedules.empty.instances")}</TableCell></TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Asset Registry */}
      <Dialog open={assetOpen} onOpenChange={setAssetOpen}>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
              <div>
                <h2 className="text-sm font-semibold">{t("maintenanceSchedules.assets.title")}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{t("maintenanceSchedules.assets.summary")}</p>
              </div>
              <DialogTrigger asChild>
                <Button size="sm" disabled={!activeAssociationId} onClick={() => { setEditingAsset(null); setAssetForm(emptyAssetForm); }}>{t("maintenanceSchedules.action.registerAsset")}</Button>
              </DialogTrigger>
            </div>
            {/* Wave 27 a11y: aria-label names this asset registry table. */}
            <Table aria-label={t("maintenanceSchedules.assets.tableLabel")}>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("maintenanceSchedules.col.asset")}</TableHead>
                  <TableHead>{t("maintenanceSchedules.col.location")}</TableHead>
                  <TableHead>{t("maintenanceSchedules.col.condition")}</TableHead>
                  <TableHead>{t("maintenanceSchedules.col.lastServiced")}</TableHead>
                  <TableHead>{t("maintenanceSchedules.col.nextDue")}</TableHead>
                  <TableHead className="text-right">{t("maintenanceSchedules.col.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.map((asset) => (
                  <TableRow key={asset.id}>
                    <TableCell>
                      <div className="font-medium">{asset.name}</div>
                      <div className="text-xs text-muted-foreground">{asset.assetType}{asset.manufacturer ? ` · ${asset.manufacturer}` : ""}{asset.model ? ` ${asset.model}` : ""}</div>
                    </TableCell>
                    <TableCell>{asset.location || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={asset.condition === "poor" ? "destructive" : asset.condition === "fair" ? "secondary" : "outline"}>{asset.condition}</Badge>
                    </TableCell>
                    <TableCell>{asset.lastServicedAt ? new Date(asset.lastServicedAt).toLocaleDateString() : "-"}</TableCell>
                    <TableCell>
                      {asset.nextServiceDueAt ? (
                        <span className={new Date(asset.nextServiceDueAt) < new Date() ? "text-destructive font-medium" : ""}>{new Date(asset.nextServiceDueAt).toLocaleDateString()}</span>
                      ) : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => {
                          setEditingAsset(asset);
                          setAssetForm({
                            name: asset.name,
                            assetType: asset.assetType,
                            manufacturer: asset.manufacturer || "",
                            model: asset.model || "",
                            serialNumber: asset.serialNumber || "",
                            location: asset.location || "",
                            installDate: asset.installDate ? new Date(asset.installDate).toISOString().slice(0, 10) : "",
                            warrantyExpiresAt: asset.warrantyExpiresAt ? new Date(asset.warrantyExpiresAt).toISOString().slice(0, 10) : "",
                            lastServicedAt: asset.lastServicedAt ? new Date(asset.lastServicedAt).toISOString().slice(0, 10) : "",
                            nextServiceDueAt: asset.nextServiceDueAt ? new Date(asset.nextServiceDueAt).toISOString().slice(0, 10) : "",
                            estimatedLifespanYears: asset.estimatedLifespanYears ? String(asset.estimatedLifespanYears) : "",
                            replacementCostEstimate: asset.replacementCostEstimate ? String(asset.replacementCostEstimate) : "",
                            condition: (asset.condition as typeof emptyAssetForm.condition) || "unknown",
                            notes: asset.notes || "",
                            vendorId: asset.vendorId || "",
                            unitId: asset.unitId || "",
                          });
                          setAssetOpen(true);
                        }} aria-label={`${t("common.action.edit")} ${asset.name}`}>{t("common.action.edit")}</Button>
                        <Button size="sm" variant="outline" onClick={() => deleteAsset.mutate(asset.id)} disabled={deleteAsset.isPending} aria-label={`Remove ${asset.name}`}>Remove</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {assets.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground" role="status">{t("maintenanceSchedules.empty.assets")}</TableCell></TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editingAsset ? t("maintenanceSchedules.dialog.assetEditTitle") : t("maintenanceSchedules.dialog.assetNewTitle")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Input placeholder="Asset name *" value={assetForm.name} onChange={(e) => setAssetForm((f) => ({ ...f, name: e.target.value }))} />
              <Input placeholder="Asset type (HVAC, elevator, roof...)" value={assetForm.assetType} onChange={(e) => setAssetForm((f) => ({ ...f, assetType: e.target.value }))} />
              <Input placeholder="Manufacturer" value={assetForm.manufacturer} onChange={(e) => setAssetForm((f) => ({ ...f, manufacturer: e.target.value }))} />
              <Input placeholder="Model" value={assetForm.model} onChange={(e) => setAssetForm((f) => ({ ...f, model: e.target.value }))} />
              <Input placeholder="Serial number" value={assetForm.serialNumber} onChange={(e) => setAssetForm((f) => ({ ...f, serialNumber: e.target.value }))} />
              <Input placeholder="Location" value={assetForm.location} onChange={(e) => setAssetForm((f) => ({ ...f, location: e.target.value }))} />
              <Select value={assetForm.condition} onValueChange={(v) => setAssetForm((f) => ({ ...f, condition: v as typeof emptyAssetForm.condition }))}>
                <SelectTrigger><SelectValue placeholder="Condition" /></SelectTrigger>
                <SelectContent>
                  {["excellent", "good", "fair", "poor", "unknown"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={assetForm.vendorId || "none"} onValueChange={(v) => setAssetForm((f) => ({ ...f, vendorId: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Assigned vendor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No vendor</SelectItem>
                  {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Install date</label>
                <Input type="date" value={assetForm.installDate} onChange={(e) => setAssetForm((f) => ({ ...f, installDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Warranty expires</label>
                <Input type="date" value={assetForm.warrantyExpiresAt} onChange={(e) => setAssetForm((f) => ({ ...f, warrantyExpiresAt: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Last serviced</label>
                <Input type="date" value={assetForm.lastServicedAt} onChange={(e) => setAssetForm((f) => ({ ...f, lastServicedAt: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Next service due</label>
                <Input type="date" value={assetForm.nextServiceDueAt} onChange={(e) => setAssetForm((f) => ({ ...f, nextServiceDueAt: e.target.value }))} />
              </div>
              <Input type="number" placeholder="Est. lifespan (years)" value={assetForm.estimatedLifespanYears} onChange={(e) => setAssetForm((f) => ({ ...f, estimatedLifespanYears: e.target.value }))} />
              <Input type="number" placeholder="Replacement cost estimate ($)" value={assetForm.replacementCostEstimate} onChange={(e) => setAssetForm((f) => ({ ...f, replacementCostEstimate: e.target.value }))} />
            </div>
            <Textarea placeholder="Notes" value={assetForm.notes} onChange={(e) => setAssetForm((f) => ({ ...f, notes: e.target.value }))} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAssetOpen(false)}>Cancel</Button>
              <Button onClick={() => saveAsset.mutate()} disabled={!assetForm.name.trim() || !assetForm.assetType.trim() || saveAsset.isPending}>
                {editingAsset ? "Save Changes" : "Register Asset"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function MaintenanceSchedulesPage() {
  useDocumentTitle(t("maintenanceSchedules.title"));
  return (
    // Wave 27 a11y: section + aria-labelledby (heading id below).
    <section className="p-6 space-y-6" aria-labelledby="maintenance-schedules-heading">
      <WorkspacePageHeader
        title={t("maintenanceSchedules.title")}
        headingId="maintenance-schedules-heading"
        summary={t("maintenanceSchedules.summary")}
        eyebrow={t("common.eyebrow.operations")}
        breadcrumbs={[{ label: t("common.crumb.operations"), href: "/app/operations/dashboard" }, { label: t("maintenanceSchedules.crumb") }]}
        subPages={operationsSubPages}
      />
      <MaintenanceSchedulesContent />
    </section>
  );
}
