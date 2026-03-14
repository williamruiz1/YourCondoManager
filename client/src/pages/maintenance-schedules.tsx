import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { MaintenanceScheduleInstance, MaintenanceScheduleTemplate, Unit, Vendor } from "@shared/schema";
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

export default function MaintenanceSchedulesPage() {
  const { toast } = useToast();
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MaintenanceScheduleTemplate | null>(null);
  const [form, setForm] = useState(emptyForm);

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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Maintenance Schedules</h1>
          <p className="text-muted-foreground">Manage recurring preventive maintenance templates, generate due instances, and convert them into work orders.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button disabled={!activeAssociationId} onClick={openCreate}>New Schedule</Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader><DialogTitle>{editing ? "Edit Maintenance Schedule" : "Create Maintenance Schedule"}</DialogTitle></DialogHeader>
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
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Templates</div><div className="text-2xl font-semibold">{counts.templates}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Due instances</div><div className="text-2xl font-semibold">{counts.due}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Converted</div><div className="text-2xl font-semibold">{counts.converted}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Component</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Next Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
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
                      <Button size="sm" variant="outline" onClick={() => generateInstances.mutate(template.id)}>Generate</Button>
                      <Button size="sm" variant="outline" onClick={() => openEdit(template)}>Edit</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {templates.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No maintenance schedules yet.</TableCell></TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Scheduled Work</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Work Order</TableHead>
                <TableHead className="text-right">Actions</TableHead>
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
                      <Button size="sm" variant="outline" onClick={() => convertInstance.mutate(instance.id)}>
                        Convert
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {instances.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No generated schedule instances yet.</TableCell></TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
