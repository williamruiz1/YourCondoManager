import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Association, BoardPackage, BoardPackageTemplate } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useActiveAssociation } from "@/hooks/use-active-association";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type ReviewAnnotation = {
  id: string;
  sectionKey: string | null;
  text: string;
  createdAt: string;
  createdBy: string;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
};

type BoardPackageTemplateForm = {
  title: string;
  frequency: string;
  autoGenerate: boolean;
  meetingType: string;
  generateDaysBefore: string;
  notes: string;
  sections: string[];
};

const sectionOptions = [
  { key: "financial", label: "Financial Summary" },
  { key: "governance", label: "Governance Summary" },
  { key: "maintenance", label: "Operations Summary" },
  { key: "delinquency", label: "Delinquency Snapshot" },
];

const emptyTemplateForm: BoardPackageTemplateForm = {
  title: "",
  frequency: "monthly",
  autoGenerate: false,
  meetingType: "board",
  generateDaysBefore: "7",
  notes: "",
  sections: sectionOptions.map((section) => section.key),
};

function formatSectionTitle(sectionKey: string) {
  return sectionOptions.find((section) => section.key === sectionKey)?.label ?? sectionKey;
}

export default function BoardPackagesPage() {
  const { toast } = useToast();
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BoardPackageTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState<BoardPackageTemplateForm>(emptyTemplateForm);
  const [periodLabelByTemplate, setPeriodLabelByTemplate] = useState<Record<string, string>>({});
  const [selectedPackageId, setSelectedPackageId] = useState<string>("");
  const [annotationDraft, setAnnotationDraft] = useState("");
  const [annotationSectionKey, setAnnotationSectionKey] = useState<string>("general");
  const [distributionEmails, setDistributionEmails] = useState("");
  const [distributionMessage, setDistributionMessage] = useState("");
  const templatesQueryKey = activeAssociationId
    ? `/api/admin/board-packages/templates?associationId=${activeAssociationId}`
    : "/api/admin/board-packages/templates";
  const packagesQueryKey = activeAssociationId
    ? `/api/admin/board-packages?associationId=${activeAssociationId}`
    : "/api/admin/board-packages";

  const { data: associations = [] } = useQuery<Association[]>({
    queryKey: ["/api/associations"],
  });
  const { data: templates = [] } = useQuery<BoardPackageTemplate[]>({
    queryKey: [templatesQueryKey],
    enabled: Boolean(activeAssociationId),
  });
  const { data: packages = [] } = useQuery<BoardPackage[]>({
    queryKey: [packagesQueryKey],
    enabled: Boolean(activeAssociationId),
  });

  const selectedPackage = useMemo(
    () => packages.find((item) => item.id === selectedPackageId) ?? packages[0] ?? null,
    [packages, selectedPackageId],
  );
  const selectedPackageAnnotations = useMemo(() => {
    if (!selectedPackage || !Array.isArray(selectedPackage.annotationsJson)) return [] as ReviewAnnotation[];
    return selectedPackage.annotationsJson.filter((item): item is ReviewAnnotation =>
      Boolean(item) &&
      typeof item === "object" &&
      typeof (item as ReviewAnnotation).id === "string" &&
      typeof (item as ReviewAnnotation).text === "string",
    );
  }, [selectedPackage]);

  const templateCounts = useMemo(() => ({
    templates: templates.length,
    generated: packages.length,
    approved: packages.filter((item) => item.status === "approved" || item.status === "distributed").length,
  }), [packages, templates.length]);

  const saveTemplate = useMutation({
    mutationFn: async () => {
      if (!activeAssociationId) throw new Error("Select an association first");
      const payload = {
        associationId: activeAssociationId,
        title: templateForm.title.trim(),
        frequency: templateForm.frequency,
        autoGenerate: templateForm.autoGenerate ? 1 : 0,
        meetingType: templateForm.meetingType.trim() || null,
        generateDaysBefore: Number(templateForm.generateDaysBefore || "0"),
        sectionsJson: templateForm.sections,
        notes: templateForm.notes.trim() || null,
      };
      const response = editing
        ? await apiRequest("PATCH", `/api/admin/board-packages/templates/${editing.id}`, payload)
        : await apiRequest("POST", "/api/admin/board-packages/templates", payload);
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [templatesQueryKey] });
      setOpen(false);
      setEditing(null);
      setTemplateForm(emptyTemplateForm);
      toast({ title: editing ? "Template updated" : "Template created" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const generatePackage = useMutation({
    mutationFn: async (templateId: string) => {
      const response = await apiRequest("POST", `/api/admin/board-packages/generate/${templateId}`, {
        periodLabel: periodLabelByTemplate[templateId]?.trim() || undefined,
      });
      return response.json();
    },
    onSuccess: async (created: BoardPackage) => {
      await queryClient.invalidateQueries({ queryKey: [packagesQueryKey] });
      setSelectedPackageId(created.id);
      toast({ title: "Board package generated" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const runScheduledGeneration = useMutation({
    mutationFn: async () => {
      if (!activeAssociationId) throw new Error("Select an association first");
      const response = await apiRequest("POST", "/api/admin/board-packages/run-scheduled", {
        associationId: activeAssociationId,
      });
      return response.json();
    },
    onSuccess: async (result: { generated: number }) => {
      await queryClient.invalidateQueries({ queryKey: [packagesQueryKey] });
      await queryClient.invalidateQueries({ queryKey: [templatesQueryKey] });
      toast({ title: "Scheduled board package sweep complete", description: `${result.generated} package(s) generated.` });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const updatePackage = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<BoardPackage> }) => {
      const response = await apiRequest("PATCH", `/api/admin/board-packages/${id}`, payload);
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [packagesQueryKey] });
      toast({ title: "Board package updated" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const distributePackage = useMutation({
    mutationFn: async ({ id, recipientEmails, message }: { id: string; recipientEmails: string[]; message: string }) => {
      const response = await apiRequest("POST", `/api/admin/board-packages/${id}/distribute`, {
        recipientEmails,
        message: message.trim() || null,
      });
      return response.json() as Promise<{
        recipients: string[];
        sentCount: number;
        failedCount: number;
        failedRecipients: string[];
      }>;
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: [packagesQueryKey] });
      await queryClient.invalidateQueries({ queryKey: ["/api/communications/history"] });
      setDistributionEmails("");
      setDistributionMessage("");
      if (result.failedCount > 0) {
        toast({
          title: "Board package partially delivered",
          description: `Sent ${result.sentCount} of ${result.recipients.length}. Failed: ${result.failedRecipients.join(", ")}`,
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Board package distributed", description: `Delivered to ${result.sentCount} recipient(s).` });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  function addAnnotation() {
    if (!selectedPackage || !annotationDraft.trim()) return;
    const nextAnnotations: ReviewAnnotation[] = [
      ...selectedPackageAnnotations,
      {
        id: `${Date.now()}`,
        sectionKey: annotationSectionKey === "general" ? null : annotationSectionKey,
        text: annotationDraft.trim(),
        createdAt: new Date().toISOString(),
        createdBy: "admin",
      },
    ];
    updatePackage.mutate({
      id: selectedPackage.id,
      payload: { annotationsJson: nextAnnotations as unknown as BoardPackage["annotationsJson"] },
    });
    setAnnotationDraft("");
    setAnnotationSectionKey("general");
  }

  function resolveAnnotation(annotationId: string) {
    if (!selectedPackage) return;
    const nextAnnotations = selectedPackageAnnotations.map((annotation) =>
      annotation.id === annotationId
        ? {
            ...annotation,
            resolvedAt: new Date().toISOString(),
            resolvedBy: "admin",
          }
        : annotation,
    );
    updatePackage.mutate({
      id: selectedPackage.id,
      payload: { annotationsJson: nextAnnotations as unknown as BoardPackage["annotationsJson"] },
    });
  }

  function submitDistribution() {
    if (!selectedPackage) return;
    const recipients = distributionEmails
      .split(",")
      .map((email) => email.trim())
      .filter(Boolean);
    distributePackage.mutate({
      id: selectedPackage.id,
      recipientEmails: recipients,
      message: distributionMessage,
    });
  }

  function openCreate() {
    setEditing(null);
    setTemplateForm(emptyTemplateForm);
    setOpen(true);
  }

  function openEdit(template: BoardPackageTemplate) {
    setEditing(template);
    setTemplateForm({
      title: template.title,
      frequency: template.frequency,
      autoGenerate: Boolean(template.autoGenerate),
      meetingType: template.meetingType || "board",
      generateDaysBefore: String(template.generateDaysBefore ?? 7),
      notes: template.notes || "",
      sections: Array.isArray(template.sectionsJson) ? template.sectionsJson.filter((value): value is string => typeof value === "string") : [],
    });
    setOpen(true);
  }

  function toggleSection(sectionKey: string) {
    setTemplateForm((current) => {
      const exists = current.sections.includes(sectionKey);
      return {
        ...current,
        sections: exists ? current.sections.filter((value) => value !== sectionKey) : [...current.sections, sectionKey],
      };
    });
  }

  function getAssociationName(associationId: string) {
    return associations.find((association) => association.id === associationId)?.name ?? associationId;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Board Packages</h1>
          <p className="text-muted-foreground">
            Configure recurring board packet templates, generate draft packages by period, and schedule auto-generation relative to upcoming meetings.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={!activeAssociationId}
            onClick={() => runScheduledGeneration.mutate()}
            title="Checks auto-generate templates for the active association and creates any package due before upcoming meetings."
          >
            Run Scheduled Sweep
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button disabled={!activeAssociationId} onClick={openCreate}>New Template</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Board Package Template" : "Create Board Package Template"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                Association Context: <span className="font-medium">{activeAssociationName || "None selected"}</span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  placeholder="Template title"
                  value={templateForm.title}
                  onChange={(event) => setTemplateForm((current) => ({ ...current, title: event.target.value }))}
                />
                <Select value={templateForm.frequency} onValueChange={(value) => setTemplateForm((current) => ({ ...current, frequency: value }))}>
                  <SelectTrigger><SelectValue placeholder="Frequency" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">monthly</SelectItem>
                    <SelectItem value="quarterly">quarterly</SelectItem>
                    <SelectItem value="annual">annual</SelectItem>
                    <SelectItem value="meeting-driven">meeting-driven</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                Example: a monthly board template can auto-generate 7 days before each board meeting and include financial, governance, and operations sections.
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="flex items-center gap-2 rounded border px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={templateForm.autoGenerate}
                    onChange={(event) => setTemplateForm((current) => ({ ...current, autoGenerate: event.target.checked }))}
                  />
                  <span>Auto-generate before meetings</span>
                </label>
                <Select value={templateForm.meetingType} onValueChange={(value) => setTemplateForm((current) => ({ ...current, meetingType: value }))}>
                  <SelectTrigger><SelectValue placeholder="Meeting type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="board">board</SelectItem>
                    <SelectItem value="budget">budget</SelectItem>
                    <SelectItem value="annual">annual</SelectItem>
                    <SelectItem value="special">special</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Days before meeting"
                  value={templateForm.generateDaysBefore}
                  onChange={(event) => setTemplateForm((current) => ({ ...current, generateDaysBefore: event.target.value }))}
                />
              </div>
              <div className="text-xs text-muted-foreground">
                Scheduled sweep behavior: this checks all auto-generate templates in the active association and creates any package that has reached its meeting lead-time window.
              </div>
              <div className="text-xs text-muted-foreground">
                Package generation now loads only the selected sections, reducing unnecessary cross-module dependencies during draft creation.
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Included sections</div>
                <div className="grid gap-2 md:grid-cols-2">
                  {sectionOptions.map((section) => (
                    <label key={section.key} className="flex items-center gap-2 rounded border px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={templateForm.sections.includes(section.key)}
                        onChange={() => toggleSection(section.key)}
                      />
                      <span>{section.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <Textarea
                placeholder="Notes for operators and reviewers"
                value={templateForm.notes}
                onChange={(event) => setTemplateForm((current) => ({ ...current, notes: event.target.value }))}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => saveTemplate.mutate()}
                  disabled={!templateForm.title.trim() || templateForm.sections.length === 0}
                >
                  {editing ? "Save Changes" : "Create Template"}
                </Button>
              </div>
            </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <div className="text-sm font-semibold">How Board Packages Work</div>
            <div className="text-sm text-muted-foreground">
              Build this workflow in three steps: create a template, generate a draft package for a meeting period, then review and distribute the approved package.
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border bg-muted/20 p-3 text-sm">
              <div className="font-medium">1. Create a template</div>
              <div className="mt-1 text-muted-foreground">Choose the cadence, meeting type, lead time, and sections that should appear in each package.</div>
            </div>
            <div className="rounded-md border bg-muted/20 p-3 text-sm">
              <div className="font-medium">2. Generate a draft</div>
              <div className="mt-1 text-muted-foreground">Generate manually for a named period, or run the scheduled sweep to create packages due for upcoming meetings.</div>
            </div>
            <div className="rounded-md border bg-muted/20 p-3 text-sm">
              <div className="font-medium">3. Review and distribute</div>
              <div className="mt-1 text-muted-foreground">Add annotations, mark the package approved, then distribute it to board recipients with an optional message.</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Templates</div><div className="text-2xl font-semibold">{templateCounts.templates}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Generated Packages</div><div className="text-2xl font-semibold">{templateCounts.generated}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Approved / Distributed</div><div className="text-2xl font-semibold">{templateCounts.approved}</div></CardContent></Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Board Package Templates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Template</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Sections</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => {
                  const sections = Array.isArray(template.sectionsJson) ? template.sectionsJson.filter((value): value is string => typeof value === "string") : [];
                  return (
                    <TableRow key={template.id}>
                      <TableCell>
                        <div className="font-medium">{template.title}</div>
                        <div className="text-xs text-muted-foreground">{getAssociationName(template.associationId)}</div>
                      </TableCell>
                      <TableCell>{template.frequency}</TableCell>
                      <TableCell>
                        {template.autoGenerate ? (
                          <div className="text-sm">
                            <div>{template.generateDaysBefore} day(s) before {template.meetingType || "meeting"}</div>
                            <div className="text-xs text-muted-foreground">
                              Last run: {template.lastAutoGeneratedAt ? new Date(template.lastAutoGeneratedAt).toLocaleString() : "not yet"}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">manual only</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {sections.map((section) => <Badge key={section} variant="secondary">{formatSectionTitle(section)}</Badge>)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2 justify-end">
                          <Button size="sm" variant="outline" onClick={() => openEdit(template)}>Edit</Button>
                          <Input
                            className="w-[180px]"
                            placeholder="Period label"
                            value={periodLabelByTemplate[template.id] ?? ""}
                            onChange={(event) => setPeriodLabelByTemplate((current) => ({ ...current, [template.id]: event.target.value }))}
                          />
                          <Button size="sm" onClick={() => generatePackage.mutate(template.id)}>Generate</Button>
                        </div>
                        {template.notes ? <div className="mt-2 text-xs text-muted-foreground">{template.notes}</div> : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {templates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">No board package templates yet.</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Generated Packages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedPackage?.id ?? ""} onValueChange={setSelectedPackageId}>
              <SelectTrigger><SelectValue placeholder="Select a generated package" /></SelectTrigger>
              <SelectContent>
                {packages.map((item) => (
                  <SelectItem key={item.id} value={item.id}>{item.title} · {item.periodLabel}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedPackage ? (
              <div className="space-y-4">
                <div className="rounded-md border p-4 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{selectedPackage.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {selectedPackage.periodLabel} · {getAssociationName(selectedPackage.associationId)}
                      </div>
                    </div>
                    <Badge variant="outline">{selectedPackage.status}</Badge>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={selectedPackage.status === "approved"}
                      onClick={() => updatePackage.mutate({ id: selectedPackage.id, payload: { status: "approved" } })}
                    >
                      Mark Approved
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={selectedPackage.status !== "approved"}
                      onClick={submitDistribution}
                    >
                      Distribute Package
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={selectedPackage.status === "draft"}
                      onClick={() => updatePackage.mutate({ id: selectedPackage.id, payload: { status: "draft" } })}
                    >
                      Revert to Draft
                    </Button>
                  </div>
                  <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                    <div>
                      Approved: {selectedPackage.approvedAt ? `${new Date(selectedPackage.approvedAt).toLocaleString()} by ${selectedPackage.approvedBy || "system"}` : "not yet"}
                    </div>
                    <div>
                      Distributed: {selectedPackage.distributedAt ? `${new Date(selectedPackage.distributedAt).toLocaleString()} by ${selectedPackage.distributedBy || "system"}` : "not yet"}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {Array.isArray(selectedPackage.contentJson) ? selectedPackage.contentJson.map((section: any, index) => (
                    <div key={`${section?.key ?? "section"}-${index}`} className="rounded-md border p-4 space-y-2">
                      <div className="font-medium">{typeof section?.title === "string" ? section.title : `Section ${index + 1}`}</div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        {Array.isArray(section?.items) && section.items.length > 0 ? (
                          section.items.map((item: any, itemIndex: number) => (
                            <div key={`${index}-${itemIndex}`}>• {String(item)}</div>
                          ))
                        ) : (
                          <div>No generated items.</div>
                        )}
                      </div>
                    </div>
                  )) : null}
                </div>

                <div className="rounded-md border p-4 space-y-3">
                  <div className="font-medium">Distribution</div>
                  <div className="text-sm text-muted-foreground">
                    Approved packages can be distributed through the communications layer. Leave recipients blank to use the scoped board/admin recipient set automatically.
                  </div>
                  <Input
                    placeholder="Comma-separated recipient emails"
                    value={distributionEmails}
                    onChange={(event) => setDistributionEmails(event.target.value)}
                  />
                  <Textarea
                    placeholder="Optional message to include above the package summary"
                    value={distributionMessage}
                    onChange={(event) => setDistributionMessage(event.target.value)}
                  />
                  <div className="flex justify-end">
                    <Button
                      onClick={submitDistribution}
                      disabled={selectedPackage.status !== "approved" || distributePackage.isPending}
                    >
                      Send Approved Package
                    </Button>
                  </div>
                </div>

                <div className="rounded-md border p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium">Review Annotations</div>
                    <Badge variant="secondary">
                      {selectedPackageAnnotations.filter((item) => !item.resolvedAt).length} open / {selectedPackageAnnotations.length} total
                    </Badge>
                  </div>
                  <div className="grid gap-3 md:grid-cols-[180px,1fr,auto]">
                    <Select value={annotationSectionKey} onValueChange={setAnnotationSectionKey}>
                      <SelectTrigger><SelectValue placeholder="Section" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General</SelectItem>
                        {Array.isArray(selectedPackage.contentJson)
                          ? selectedPackage.contentJson.map((section: any, index) => (
                              <SelectItem key={`${section?.key ?? index}`} value={String(section?.key ?? `section-${index}`)}>
                                {typeof section?.title === "string" ? section.title : `Section ${index + 1}`}
                              </SelectItem>
                            ))
                          : null}
                      </SelectContent>
                    </Select>
                    <Textarea
                      placeholder="Add reviewer note, change request, or approval comment"
                      value={annotationDraft}
                      onChange={(event) => setAnnotationDraft(event.target.value)}
                    />
                    <Button onClick={addAnnotation} disabled={!annotationDraft.trim()}>Add Note</Button>
                  </div>
                  <div className="space-y-2">
                    {selectedPackageAnnotations.map((annotation) => (
                      <div key={annotation.id} className="rounded-md border p-3 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-medium">
                            {annotation.sectionKey ? formatSectionTitle(annotation.sectionKey) : "General"}
                          </div>
                          <Badge variant={annotation.resolvedAt ? "outline" : "destructive"}>
                            {annotation.resolvedAt ? "resolved" : "open"}
                          </Badge>
                        </div>
                        <div className="text-sm">{annotation.text}</div>
                        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                          <div>
                            Added {new Date(annotation.createdAt).toLocaleString()} by {annotation.createdBy}
                          </div>
                          {annotation.resolvedAt ? (
                            <div>Resolved {new Date(annotation.resolvedAt).toLocaleString()} by {annotation.resolvedBy || "admin"}</div>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={() => resolveAnnotation(annotation.id)}>Resolve</Button>
                          )}
                        </div>
                      </div>
                    ))}
                    {selectedPackageAnnotations.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No review annotations yet.</div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
                Generate a package from a template to preview the compiled board packet contents here.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
