import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { InspectionFindingItem, InspectionRecord, Unit } from "@shared/schema";
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
import { Link } from "wouter";
import { Wrench, ExternalLink } from "lucide-react";

type FindingSeverity = "low" | "medium" | "high" | "critical";
type FindingStatus = "open" | "monitoring" | "resolved";
type Condition = "excellent" | "good" | "fair" | "poor" | "critical";
type LocationType = "unit" | "common-area" | "building";

type InspectionForm = {
  locationType: LocationType;
  locationText: string;
  unitId: string;
  inspectionType: string;
  inspectorName: string;
  overallCondition: Condition;
  inspectedAt: string;
  summary: string;
  findings: InspectionFindingItem[];
};

const emptyFinding = (): InspectionFindingItem => ({
  title: "",
  description: "",
  severity: "medium",
  status: "open",
  photoUrls: [],
  linkedWorkOrderId: null,
});

const emptyForm: InspectionForm = {
  locationType: "unit",
  locationText: "",
  unitId: "",
  inspectionType: "routine",
  inspectorName: "",
  overallCondition: "good",
  inspectedAt: new Date().toISOString().slice(0, 16),
  summary: "",
  findings: [emptyFinding()],
};

function parseFindings(value: unknown): InspectionFindingItem[] {
  if (!Array.isArray(value)) return [];
  const normalized: InspectionFindingItem[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const finding = item as Record<string, unknown>;
    const title = typeof finding.title === "string" ? finding.title.trim() : "";
    if (!title) continue;
    normalized.push({
      title,
      description: typeof finding.description === "string" ? finding.description.trim() : null,
      severity:
        finding.severity === "low" || finding.severity === "medium" || finding.severity === "high" || finding.severity === "critical"
          ? finding.severity
          : "medium",
      status: finding.status === "monitoring" || finding.status === "resolved" ? finding.status : "open",
      photoUrls: Array.isArray(finding.photoUrls)
        ? finding.photoUrls.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        : [],
      linkedWorkOrderId:
        typeof finding.linkedWorkOrderId === "string" && finding.linkedWorkOrderId.trim().length > 0 ? finding.linkedWorkOrderId : null,
    });
  }
  return normalized;
}

function toForm(record: InspectionRecord): InspectionForm {
  return {
    locationType: record.locationType as LocationType,
    locationText: record.locationText,
    unitId: record.unitId || "",
    inspectionType: record.inspectionType,
    inspectorName: record.inspectorName,
    overallCondition: record.overallCondition as Condition,
    inspectedAt: new Date(record.inspectedAt).toISOString().slice(0, 16),
    summary: record.summary || "",
    findings: parseFindings(record.findingsJson),
  };
}

export function InspectionsContent() {
  const { toast } = useToast();
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<InspectionRecord | null>(null);
  const [form, setForm] = useState<InspectionForm>(emptyForm);

  const { data: inspections = [] } = useQuery<InspectionRecord[]>({
    queryKey: ["/api/inspections"],
    enabled: Boolean(activeAssociationId),
  });
  const { data: units = [] } = useQuery<Unit[]>({
    queryKey: ["/api/units"],
    enabled: Boolean(activeAssociationId),
  });

  const saveInspection = useMutation({
    mutationFn: async () => {
      if (!activeAssociationId) throw new Error("Select an association first");
      const payload = {
        associationId: activeAssociationId,
        unitId: form.unitId || null,
        locationType: form.locationType,
        locationText: form.locationText,
        inspectionType: form.inspectionType,
        inspectorName: form.inspectorName,
        overallCondition: form.overallCondition,
        inspectedAt: new Date(form.inspectedAt).toISOString(),
        summary: form.summary || null,
        findingsJson: form.findings
          .filter((finding) => finding.title.trim().length > 0)
          .map((finding) => ({
            ...finding,
            title: finding.title.trim(),
            description: finding.description?.trim() || null,
            photoUrls: (finding.photoUrls || []).filter(Boolean),
          })),
      };
      const res = editing
        ? await apiRequest("PATCH", `/api/inspections/${editing.id}`, payload)
        : await apiRequest("POST", "/api/inspections", payload);
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/inspections"] });
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      toast({ title: editing ? "Inspection updated" : "Inspection created" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const convertFinding = useMutation({
    mutationFn: async ({ inspectionId, findingIndex }: { inspectionId: string; findingIndex: number }) => {
      const res = await apiRequest("POST", `/api/inspections/${inspectionId}/findings/${findingIndex}/convert-to-work-order`, {
        associationId: activeAssociationId,
      });
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/inspections"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      toast({ title: "Finding converted to work order" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const totals = useMemo(() => {
    const findings = inspections.flatMap((record) => parseFindings(record.findingsJson));
    return {
      records: inspections.length,
      openFindings: findings.filter((finding) => finding.status !== "resolved").length,
      linkedFindings: findings.filter((finding) => finding.linkedWorkOrderId).length,
    };
  }, [inspections]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(record: InspectionRecord) {
    setEditing(record);
    setForm(toForm(record));
    setOpen(true);
  }

  function updateFinding(index: number, next: Partial<InspectionFindingItem>) {
    setForm((current) => ({
      ...current,
      findings: current.findings.map((finding, findingIndex) => (findingIndex === index ? { ...finding, ...next } : finding)),
    }));
  }

  function addFinding() {
    setForm((current) => ({ ...current, findings: [...current.findings, emptyFinding()] }));
  }

  function removeFinding(index: number) {
    setForm((current) => ({
      ...current,
      findings: current.findings.length === 1 ? [emptyFinding()] : current.findings.filter((_, findingIndex) => findingIndex !== index),
    }));
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button disabled={!activeAssociationId} onClick={openCreate}>New Inspection</Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Inspection" : "Create Inspection"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                Association Context: <span className="font-medium">{activeAssociationName || "None selected"}</span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Select value={form.locationType} onValueChange={(value: LocationType) => setForm((current) => ({ ...current, locationType: value }))}>
                  <SelectTrigger><SelectValue placeholder="Location type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unit">unit</SelectItem>
                    <SelectItem value="common-area">common-area</SelectItem>
                    <SelectItem value="building">building</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={form.unitId || "none"} onValueChange={(value) => setForm((current) => ({ ...current, unitId: value === "none" ? "" : value }))}>
                  <SelectTrigger><SelectValue placeholder="Unit" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No unit</SelectItem>
                    {units.map((unit) => <SelectItem key={unit.id} value={unit.id}>{unit.unitNumber}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input placeholder="Location detail" value={form.locationText} onChange={(e) => setForm((current) => ({ ...current, locationText: e.target.value }))} />
                <Input placeholder="Inspection type" value={form.inspectionType} onChange={(e) => setForm((current) => ({ ...current, inspectionType: e.target.value }))} />
                <Input placeholder="Inspector name" value={form.inspectorName} onChange={(e) => setForm((current) => ({ ...current, inspectorName: e.target.value }))} />
                <Select value={form.overallCondition} onValueChange={(value: Condition) => setForm((current) => ({ ...current, overallCondition: value }))}>
                  <SelectTrigger><SelectValue placeholder="Overall condition" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="excellent">excellent</SelectItem>
                    <SelectItem value="good">good</SelectItem>
                    <SelectItem value="fair">fair</SelectItem>
                    <SelectItem value="poor">poor</SelectItem>
                    <SelectItem value="critical">critical</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="datetime-local" value={form.inspectedAt} onChange={(e) => setForm((current) => ({ ...current, inspectedAt: e.target.value }))} />
              </div>
              <Textarea placeholder="Inspection summary" value={form.summary} onChange={(e) => setForm((current) => ({ ...current, summary: e.target.value }))} />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">Findings</div>
                  <Button type="button" variant="outline" size="sm" onClick={addFinding}>Add Finding</Button>
                </div>
                {form.findings.map((finding, index) => (
                  <Card key={`${index}-${finding.linkedWorkOrderId || "new"}`}>
                    <CardContent className="pt-4 space-y-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <Input placeholder="Finding title" value={finding.title} onChange={(e) => updateFinding(index, { title: e.target.value })} />
                        <Input
                          placeholder="Photo URLs, comma separated"
                          value={(finding.photoUrls || []).join(", ")}
                          onChange={(e) => updateFinding(index, { photoUrls: e.target.value.split(",").map((value) => value.trim()).filter(Boolean) })}
                        />
                        <Select value={finding.severity} onValueChange={(value: FindingSeverity) => updateFinding(index, { severity: value })}>
                          <SelectTrigger><SelectValue placeholder="Severity" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">low</SelectItem>
                            <SelectItem value="medium">medium</SelectItem>
                            <SelectItem value="high">high</SelectItem>
                            <SelectItem value="critical">critical</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={finding.status} onValueChange={(value: FindingStatus) => updateFinding(index, { status: value })}>
                          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">open</SelectItem>
                            <SelectItem value="monitoring">monitoring</SelectItem>
                            <SelectItem value="resolved">resolved</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Textarea placeholder="Finding description" value={finding.description || ""} onChange={(e) => updateFinding(index, { description: e.target.value })} />
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-muted-foreground">
                          {finding.linkedWorkOrderId ? `Linked work order: ${finding.linkedWorkOrderId}` : "No linked work order yet"}
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeFinding(index)}>Remove</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => saveInspection.mutate()}
                  disabled={!form.locationText.trim() || !form.inspectorName.trim() || !form.inspectionType.trim()}
                >
                  {editing ? "Save Changes" : "Create Inspection"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Inspection records</div><div className="text-2xl font-semibold">{totals.records}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Open findings</div><div className="text-2xl font-semibold">{totals.openFindings}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Linked to work orders</div><div className="text-2xl font-semibold">{totals.linkedFindings}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Location</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Inspector</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Findings</TableHead>
                <TableHead>Inspected</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inspections.map((record) => {
                const findings = parseFindings(record.findingsJson);
                return (
                  <TableRow key={record.id}>
                    <TableCell>
                      <div className="font-medium">{record.locationText}</div>
                      <div className="text-xs text-muted-foreground">{record.unitId ? `Unit-linked` : record.locationType}</div>
                    </TableCell>
                    <TableCell>{record.inspectionType}</TableCell>
                    <TableCell>{record.inspectorName}</TableCell>
                    <TableCell><Badge variant="outline">{record.overallCondition}</Badge></TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        {findings.length === 0 ? <div className="text-xs text-muted-foreground">No findings</div> : null}
                        {findings.map((finding, index) => (
                          <div key={`${record.id}-${index}`} className="rounded border px-2 py-2 text-xs space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium">{finding.title}</span>
                              <Badge variant="outline">{finding.severity}</Badge>
                            </div>
                            {finding.description ? <div className="text-muted-foreground">{finding.description}</div> : null}
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-muted-foreground">{finding.status}</span>
                              {finding.linkedWorkOrderId ? (
                                <Link href="/app/work-orders">
                                  <Button size="icon" variant="secondary" title="View Work Order">
                                    <ExternalLink className="h-4 w-4" />
                                  </Button>
                                </Link>
                              ) : (
                                <Button
                                  size="icon"
                                  variant="outline"
                                  title="Create Work Order"
                                  disabled={convertFinding.isPending}
                                  onClick={() => convertFinding.mutate({ inspectionId: record.id, findingIndex: index })}
                                >
                                  <Wrench className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{new Date(record.inspectedAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => openEdit(record)}>Edit</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {inspections.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No inspection records yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

export default function InspectionsPage() {
  return (
    <div className="p-6 space-y-6">
      <WorkspacePageHeader
        title="Inspection Records"
        summary="Record unit and common-area inspections, document findings, and turn follow-up items into work orders."
        eyebrow="Operations"
        breadcrumbs={[{ label: "Operations", href: "/app/operations/dashboard" }, { label: "Inspection Records" }]}
        subPages={operationsSubPages}
      />
      <InspectionsContent />
    </div>
  );
}
