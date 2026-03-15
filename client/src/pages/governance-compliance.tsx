import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { AiExtractedRecord, AnnualGovernanceTask, Association, CalendarEvent, GovernanceComplianceTemplate, GovernanceTemplateItem, Person } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useActiveAssociation } from "@/hooks/use-active-association";

type ComplianceGapAlert = {
  templateId: string;
  templateItemId: string;
  templateName: string;
  templateItemTitle: string;
  obligationType: string;
  severity: "low" | "medium" | "high";
  status: "active" | "suppressed" | "resolved";
  sourceAuthority: string | null;
  sourceUrl: string | null;
  legalReference: string | null;
  dueMonth: number;
  dueDay: number;
  matchedRuleCount: number;
  matchedRuleIds: string[];
  suppressionReason: string | null;
  suppressedUntil: string | Date | null;
  staleRegulatoryRecord: boolean;
};

const templateSchema = z.object({
  associationId: z.string().optional(),
  baseTemplateId: z.string().optional(),
  scope: z.enum(["state-library", "association"]),
  stateCode: z.string().min(2).max(2).optional(),
  year: z.coerce.number().int().min(2024).max(2100),
  versionNumber: z.coerce.number().int().min(1).max(100),
  name: z.string().min(1),
  sourceAuthority: z.string().optional(),
  sourceUrl: z.string().optional(),
  sourceDocumentTitle: z.string().optional(),
  sourceDocumentDate: z.string().optional(),
  effectiveDate: z.string().optional(),
  nextReviewDueAt: z.string().optional(),
  publicationStatus: z.enum(["draft", "review", "published", "archived"]).optional(),
  reviewNotes: z.string().optional(),
});

const itemSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  dueMonth: z.coerce.number().int().min(1).max(12),
  dueDay: z.coerce.number().int().min(1).max(31),
  orderIndex: z.coerce.number().int().min(0),
});

const taskSchema = z.object({
  associationId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  ownerPersonId: z.string().optional(),
  dueDate: z.string().optional(),
});

const calendarSchema = z.object({
  associationId: z.string().min(1),
  title: z.string().min(1),
  startsAt: z.string().min(1),
  endsAt: z.string().optional(),
});

export default function GovernanceCompliancePage() {
  const { toast } = useToast();
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();
  const [associationFilter, setAssociationFilter] = useState(activeAssociationId);
  const [openTemplate, setOpenTemplate] = useState(false);
  const [openTask, setOpenTask] = useState(false);
  const [openCalendar, setOpenCalendar] = useState(false);

  const { data: associations } = useQuery<Association[]>({ queryKey: ["/api/associations"] });
  const { data: persons } = useQuery<Person[]>({ queryKey: ["/api/persons"] });
  const { data: templates } = useQuery<GovernanceComplianceTemplate[]>({
    queryKey: ["/api/governance/templates", associationFilter || "none"],
    queryFn: async () => {
      const query = associationFilter ? `?associationId=${associationFilter}` : "";
      const res = await apiRequest("GET", `/api/governance/templates${query}`);
      return res.json();
    },
  });
  const { data: calendarEvents } = useQuery<CalendarEvent[]>({ queryKey: ["/api/governance/calendar/events"] });
  const { data: complianceRules = [] } = useQuery<AiExtractedRecord[]>({
    queryKey: [associationFilter ? `/api/ai/ingestion/compliance-rules?associationId=${associationFilter}` : "/api/ai/ingestion/compliance-rules"],
  });
  const { data: complianceAlerts = [] } = useQuery<ComplianceGapAlert[]>({
    queryKey: [associationFilter ? `/api/governance/compliance-alerts?associationId=${associationFilter}` : "/api/governance/compliance-alerts"],
    enabled: Boolean(associationFilter),
  });
  const { data: templateItems } = useQuery<GovernanceTemplateItem[]>({
    queryKey: ["/api/governance/templates", selectedTemplateId || "none", "items"],
    queryFn: async () => {
      if (!selectedTemplateId) return [];
      const res = await apiRequest("GET", `/api/governance/templates/${selectedTemplateId}/items`);
      return res.json();
    },
    enabled: Boolean(selectedTemplateId),
  });
  const { data: tasks } = useQuery<AnnualGovernanceTask[]>({ queryKey: ["/api/governance/tasks"] });

  const templateForm = useForm<z.infer<typeof templateSchema>>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      associationId: "",
      baseTemplateId: "",
      scope: "state-library",
      stateCode: "CT",
      year: new Date().getFullYear(),
      versionNumber: 1,
      name: "State Compliance Checklist",
      sourceAuthority: "",
      sourceUrl: "",
      sourceDocumentTitle: "",
      sourceDocumentDate: "",
      effectiveDate: "",
      nextReviewDueAt: "",
      publicationStatus: "draft",
      reviewNotes: "",
    },
  });
  const itemForm = useForm<z.infer<typeof itemSchema>>({
    resolver: zodResolver(itemSchema),
    defaultValues: { title: "", description: "", dueMonth: 1, dueDay: 1, orderIndex: 0 },
  });
  const taskForm = useForm<z.infer<typeof taskSchema>>({
    resolver: zodResolver(taskSchema),
    defaultValues: { associationId: "", title: "", description: "", ownerPersonId: "", dueDate: "" },
  });
  const calendarForm = useForm<z.infer<typeof calendarSchema>>({
    resolver: zodResolver(calendarSchema),
    defaultValues: { associationId: "", title: "", startsAt: "", endsAt: "" },
  });

  useEffect(() => {
    setAssociationFilter(activeAssociationId);
    taskForm.setValue("associationId", activeAssociationId, { shouldValidate: true });
    calendarForm.setValue("associationId", activeAssociationId, { shouldValidate: true });
    if (templateForm.watch("scope") === "association") {
      templateForm.setValue("associationId", activeAssociationId, { shouldValidate: true });
    }
  }, [activeAssociationId, calendarForm, taskForm, templateForm]);

  const activeAssociationState = useMemo(() => {
    const state = associations?.find((association) => association.id === activeAssociationId)?.state ?? "";
    return state.trim().toUpperCase();
  }, [associations, activeAssociationId]);

  useEffect(() => {
    if (activeAssociationState) {
      templateForm.setValue("stateCode", activeAssociationState, { shouldValidate: false });
    }
  }, [activeAssociationState, templateForm]);

  const createTemplate = useMutation({
    mutationFn: async (v: z.infer<typeof templateSchema>) => {
      const res = await apiRequest("POST", "/api/governance/templates", {
        associationId: v.scope === "association" ? (v.associationId || null) : null,
        baseTemplateId: v.scope === "association" ? (v.baseTemplateId || null) : null,
        scope: v.scope,
        stateCode: v.stateCode?.trim().toUpperCase() || null,
        year: v.year,
        versionNumber: v.versionNumber,
        name: v.name,
        sourceAuthority: v.sourceAuthority?.trim() || null,
        sourceUrl: v.sourceUrl?.trim() || null,
        sourceDocumentTitle: v.sourceDocumentTitle?.trim() || null,
        sourceDocumentDate: v.sourceDocumentDate ? new Date(v.sourceDocumentDate).toISOString() : null,
        effectiveDate: v.effectiveDate ? new Date(v.effectiveDate).toISOString() : null,
        nextReviewDueAt: v.nextReviewDueAt ? new Date(v.nextReviewDueAt).toISOString() : null,
        publicationStatus: v.publicationStatus || null,
        reviewNotes: v.reviewNotes?.trim() || null,
      });
      return res.json();
    },
    onSuccess: (created: GovernanceComplianceTemplate) => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/templates"] });
      setOpenTemplate(false);
      setSelectedTemplateId(created.id);
      toast({ title: "Template created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const bootstrapStateLibrary = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/governance/templates/bootstrap-state-library", {});
      return res.json() as Promise<{ created: number; updated: number }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/templates"] });
      toast({ title: "State template library synced", description: `Created ${result.created}, updated ${result.updated}.` });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<GovernanceComplianceTemplate> }) => {
      const res = await apiRequest("PATCH", `/api/governance/templates/${id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/templates"] });
      toast({ title: "Regulatory record updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createTemplateItem = useMutation({
    mutationFn: async (v: z.infer<typeof itemSchema>) => {
      if (!selectedTemplateId) throw new Error("Select a template first");
      const res = await apiRequest("POST", `/api/governance/templates/${selectedTemplateId}/items`, v);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/templates", selectedTemplateId, "items"] });
      itemForm.reset();
      toast({ title: "Template item added" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createTask = useMutation({
    mutationFn: async (v: z.infer<typeof taskSchema>) => {
      const res = await apiRequest("POST", "/api/governance/tasks", {
        associationId: v.associationId,
        title: v.title,
        description: v.description || null,
        ownerPersonId: v.ownerPersonId || null,
        dueDate: v.dueDate ? new Date(v.dueDate).toISOString() : null,
        status: "todo",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/tasks"] });
      setOpenTask(false);
      taskForm.reset();
      toast({ title: "Governance task created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const generateTasks = useMutation({
    mutationFn: async () => {
      if (!associationFilter || !selectedTemplateId) throw new Error("Select association and template");
      const template = templates?.find((t) => t.id === selectedTemplateId);
      const year = template?.year ?? new Date().getFullYear();
      const res = await apiRequest("POST", "/api/governance/tasks/generate", {
        associationId: associationFilter,
        templateId: selectedTemplateId,
        year,
      });
      return res.json();
    },
    onSuccess: (result: { created: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/tasks"] });
      toast({ title: `Generated ${result.created} tasks` });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "todo" | "in-progress" | "done" }) => {
      const res = await apiRequest("PATCH", `/api/governance/tasks/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/tasks"] });
    },
  });
  const createCalendarEvent = useMutation({
    mutationFn: async (v: z.infer<typeof calendarSchema>) => {
      const res = await apiRequest("POST", "/api/governance/calendar/events", {
        associationId: v.associationId,
        eventType: "governance",
        title: v.title,
        startsAt: new Date(v.startsAt).toISOString(),
        endsAt: v.endsAt ? new Date(v.endsAt).toISOString() : null,
        relatedType: "compliance-task",
        relatedId: null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/calendar/events"] });
      calendarForm.reset();
      setOpenCalendar(false);
      toast({ title: "Calendar event added" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const extractComplianceRules = useMutation({
    mutationFn: async () => {
      if (!associationFilter) throw new Error("Select an association first");
      const res = await apiRequest("POST", "/api/ai/ingestion/compliance-rules/extract", {
        associationId: associationFilter,
      });
      return res.json() as Promise<{ created: number; processed: number }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [associationFilter ? `/api/ai/ingestion/compliance-rules?associationId=${associationFilter}` : "/api/ai/ingestion/compliance-rules"] });
      queryClient.invalidateQueries({
        predicate: (query) => typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/governance/compliance-alerts"),
      });
      toast({ title: "Compliance rules extracted", description: `Created ${result.created} rule(s) from ${result.processed} clause(s).` });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateComplianceAlert = useMutation({
    mutationFn: async (payload: {
      associationId: string;
      templateId: string;
      templateItemId: string;
      status: "active" | "suppressed" | "resolved";
      suppressionReason?: string | null;
      suppressedUntil?: string | null;
      notes?: string | null;
    }) => {
      const res = await apiRequest("POST", "/api/governance/compliance-alert-overrides", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/governance/compliance-alerts"),
      });
      toast({ title: "Compliance alert updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const filteredTasks = useMemo(() => {
    const list = tasks ?? [];
    if (!associationFilter) return list;
    return list.filter((t) => t.associationId === associationFilter);
  }, [tasks, associationFilter]);

  const now = new Date();
  const upcoming = filteredTasks.filter((t) => t.status !== "done" && t.dueDate && new Date(t.dueDate) >= now).length;
  const overdue = filteredTasks.filter((t) => t.status !== "done" && t.dueDate && new Date(t.dueDate) < now).length;
  const complete = filteredTasks.filter((t) => t.status === "done").length;

  const byStatus = {
    todo: filteredTasks.filter((t) => t.status === "todo"),
    inProgress: filteredTasks.filter((t) => t.status === "in-progress"),
    done: filteredTasks.filter((t) => t.status === "done"),
  };
  const stateLibraryTemplates = useMemo(
    () => (templates ?? []).filter((template) => (template.scope === "state-library" || template.scope === "ct-baseline") && !template.associationId),
    [templates],
  );
  const selectedTemplate = templates?.find((template) => template.id === selectedTemplateId);
  const matchingStateLibraryTemplates = useMemo(
    () => stateLibraryTemplates.filter((template) => !activeAssociationState || template.stateCode === activeAssociationState),
    [stateLibraryTemplates, activeAssociationState],
  );
  const templateLabel = (template: GovernanceComplianceTemplate) => {
    const state = template.stateCode ? `${template.stateCode} ` : "";
    const scope = template.scope === "association" ? "Overlay" : "Library";
    return `${state}${template.name} · v${template.versionNumber} · ${scope}`;
  };
  const staleTemplateCount = (templates ?? []).filter((template) => template.nextReviewDueAt && new Date(template.nextReviewDueAt) < now).length;
  const reviewQueueCount = (templates ?? []).filter((template) => template.publicationStatus === "draft" || template.publicationStatus === "review").length;
  const publishedTemplateCount = (templates ?? []).filter((template) => template.publicationStatus === "published").length;
  const activeComplianceAlerts = complianceAlerts.filter((alert) => alert.status === "active");
  const suppressedComplianceAlerts = complianceAlerts.filter((alert) => alert.status === "suppressed");
  const resolvedComplianceAlerts = complianceAlerts.filter((alert) => alert.status === "resolved");
  const templateFreshnessLabel = (template: GovernanceComplianceTemplate) => {
    if (!template.nextReviewDueAt) return "No review date";
    return new Date(template.nextReviewDueAt) < now ? "Stale" : "Current";
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Governance & Compliance</h1>
          <p className="text-muted-foreground">Manage source-backed regulatory records, association overlays, and annual governance tasks.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={!associationFilter} onClick={() => extractComplianceRules.mutate()}>
            Extract Compliance Rules
          </Button>
          <Button variant="outline" onClick={() => bootstrapStateLibrary.mutate()} disabled={bootstrapStateLibrary.isPending}>
            {bootstrapStateLibrary.isPending ? "Syncing Records..." : "Sync Regulatory Library"}
          </Button>
          <Dialog open={openTemplate} onOpenChange={setOpenTemplate}>
            <DialogTrigger asChild><Button variant="outline">New Template</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Compliance Template</DialogTitle></DialogHeader>
              <Form {...templateForm}>
                <form className="space-y-4" onSubmit={templateForm.handleSubmit((v) => createTemplate.mutate(v))}>
                  <FormField control={templateForm.control} name="scope" render={({ field }) => (
                    <FormItem><FormLabel>Scope</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="state-library">state-library</SelectItem><SelectItem value="association">association overlay</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                  )} />
                  <FormField control={templateForm.control} name="stateCode" render={({ field }) => (
                    <FormItem><FormLabel>State Code</FormLabel><FormControl><Input {...field} maxLength={2} onChange={(e) => field.onChange(e.target.value.toUpperCase())} /></FormControl><FormMessage /></FormItem>
                  )} />
                  {templateForm.watch("scope") === "association" ? (
                    <>
                      <FormField control={templateForm.control} name="associationId" render={({ field }) => (
                        <FormItem><FormLabel>Association</FormLabel><Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl><SelectContent><SelectItem value="none">select</SelectItem>{associations?.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                      )} />
                      <FormField control={templateForm.control} name="baseTemplateId" render={({ field }) => (
                        <FormItem><FormLabel>Base State Template</FormLabel><Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}><FormControl><SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger></FormControl><SelectContent><SelectItem value="none">none</SelectItem>{matchingStateLibraryTemplates.map((template) => <SelectItem key={template.id} value={template.id}>{templateLabel(template)}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                      )} />
                    </>
                  ) : null}
                  <FormField control={templateForm.control} name="year" render={({ field }) => (<FormItem><FormLabel>Year</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={templateForm.control} name="versionNumber" render={({ field }) => (<FormItem><FormLabel>Version</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={templateForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={templateForm.control} name="publicationStatus" render={({ field }) => (
                    <FormItem><FormLabel>Publication Status</FormLabel><Select value={field.value || "draft"} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="draft">draft</SelectItem><SelectItem value="review">review</SelectItem><SelectItem value="published">published</SelectItem><SelectItem value="archived">archived</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                  )} />
                  <FormField control={templateForm.control} name="sourceAuthority" render={({ field }) => (<FormItem><FormLabel>Source Authority</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={templateForm.control} name="sourceUrl" render={({ field }) => (<FormItem><FormLabel>Source URL</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={templateForm.control} name="sourceDocumentTitle" render={({ field }) => (<FormItem><FormLabel>Source Document Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField control={templateForm.control} name="sourceDocumentDate" render={({ field }) => (<FormItem><FormLabel>Source Doc Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={templateForm.control} name="effectiveDate" render={({ field }) => (<FormItem><FormLabel>Effective Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={templateForm.control} name="nextReviewDueAt" render={({ field }) => (<FormItem><FormLabel>Next Review Due</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  </div>
                  <FormField control={templateForm.control} name="reviewNotes" render={({ field }) => (<FormItem><FormLabel>Review Notes</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <Button className="w-full" type="submit" disabled={createTemplate.isPending}>Save</Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          <Dialog open={openTask} onOpenChange={setOpenTask}>
            <DialogTrigger asChild><Button>New Governance Task</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Annual Governance Task</DialogTitle></DialogHeader>
              <Form {...taskForm}>
                <form className="space-y-4" onSubmit={taskForm.handleSubmit((v) => createTask.mutate(v))}>
                  <FormField control={taskForm.control} name="associationId" render={({ field }) => (
                    <FormItem><FormLabel>Association</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl><SelectContent>{associations?.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                  )} />
                  <FormField control={taskForm.control} name="title" render={({ field }) => (<FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={taskForm.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={taskForm.control} name="ownerPersonId" render={({ field }) => (
                      <FormItem><FormLabel>Owner</FormLabel><Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}><FormControl><SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger></FormControl><SelectContent><SelectItem value="none">none</SelectItem>{persons?.map((p) => <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                    )} />
                    <FormField control={taskForm.control} name="dueDate" render={({ field }) => (<FormItem><FormLabel>Due Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  </div>
                  <Button className="w-full" type="submit" disabled={createTask.isPending}>Save</Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          <Dialog open={openCalendar} onOpenChange={setOpenCalendar}>
            <DialogTrigger asChild><Button variant="outline">New Calendar Event</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Calendar Event</DialogTitle></DialogHeader>
              <Form {...calendarForm}>
                <form className="space-y-4" onSubmit={calendarForm.handleSubmit((v) => createCalendarEvent.mutate(v))}>
                  <FormField control={calendarForm.control} name="associationId" render={({ field }) => (
                    <FormItem><FormLabel>Association</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl><SelectContent>{associations?.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                  )} />
                  <FormField control={calendarForm.control} name="title" render={({ field }) => (<FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={calendarForm.control} name="startsAt" render={({ field }) => (<FormItem><FormLabel>Start</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={calendarForm.control} name="endsAt" render={({ field }) => (<FormItem><FormLabel>End (optional)</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  </div>
                  <Button className="w-full" type="submit" disabled={createCalendarEvent.isPending}>Save</Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Badge variant="secondary">Open: {filteredTasks.filter((t) => t.status !== "done").length}</Badge>
            <Badge variant="secondary">Upcoming: {upcoming}</Badge>
            <Badge variant="destructive">Overdue: {overdue}</Badge>
            <Badge variant="default">Completed: {complete}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Badge variant="secondary">Active State: {activeAssociationState || "n/a"}</Badge>
            <Badge variant="secondary">Published Records: {publishedTemplateCount}</Badge>
            <Badge variant="secondary">Review Queue: {reviewQueueCount}</Badge>
            <Badge variant={staleTemplateCount > 0 ? "destructive" : "secondary"}>Stale Records: {staleTemplateCount}</Badge>
            <Badge variant="secondary">Association Overlays: {(templates ?? []).filter((template) => template.scope === "association").length}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Badge variant={activeComplianceAlerts.length > 0 ? "destructive" : "secondary"}>Active Gaps: {activeComplianceAlerts.length}</Badge>
            <Badge variant="secondary">Suppressed: {suppressedComplianceAlerts.length}</Badge>
            <Badge variant="secondary">Resolved: {resolvedComplianceAlerts.length}</Badge>
            <Badge variant="secondary">Extracted Rules: {complianceRules.length}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-sm font-medium">Extracted Compliance Rules</h3>
              <p className="text-sm text-muted-foreground">Rules inferred from approved bylaw and governance clauses for the selected association context.</p>
            </div>
            <Badge variant="secondary">{complianceRules.length} rules</Badge>
          </div>
          <div className="space-y-2">
            {complianceRules.map((rule) => {
              const payload = rule.payloadJson as Record<string, unknown>;
              return (
                <div key={rule.id} className="rounded-md border p-4 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium">{String(payload.sourceTitle || "Compliance rule")}</div>
                    <Badge variant="outline">{String(payload.severity || "low")}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">{String(payload.obligationText || "")}</div>
                  <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
                    <div>Type: <span className="font-medium text-foreground">{String(payload.obligationType || "general-compliance")}</span></div>
                    <div>Frequency: <span className="font-medium text-foreground">{String(payload.frequency || "event-driven")}</span></div>
                    <div>Review: <span className="font-medium text-foreground">{rule.reviewStatus}</span></div>
                  </div>
                </div>
              );
            })}
            {complianceRules.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                No extracted compliance rules yet for the selected scope.
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-sm font-medium">Compliance Gap Alerts</h3>
              <p className="text-sm text-muted-foreground">Compare managed regulatory records against extracted bylaw obligations and flag missing association-specific rule coverage.</p>
            </div>
            <Badge variant={activeComplianceAlerts.length > 0 ? "destructive" : "secondary"}>{activeComplianceAlerts.length} active alerts</Badge>
          </div>
          <div className="space-y-2">
            {complianceAlerts.map((alert) => (
              <div key={alert.templateItemId} className="rounded-md border p-4 space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-medium">{alert.templateItemTitle}</div>
                    <div className="text-xs text-muted-foreground">{alert.templateName}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={alert.severity === "high" ? "destructive" : alert.severity === "medium" ? "secondary" : "outline"}>{alert.severity}</Badge>
                    <Badge variant={alert.status === "active" ? "destructive" : alert.status === "suppressed" ? "secondary" : "outline"}>{alert.status}</Badge>
                  </div>
                </div>
                <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-2 xl:grid-cols-4">
                  <div>Type: <span className="font-medium text-foreground">{alert.obligationType}</span></div>
                  <div>Due Window: <span className="font-medium text-foreground">{alert.dueMonth}/{alert.dueDay}</span></div>
                  <div>Legal Ref: <span className="font-medium text-foreground">{alert.legalReference || "-"}</span></div>
                  <div>Source: <span className="font-medium text-foreground">{alert.sourceAuthority || "-"}</span></div>
                </div>
                {alert.staleRegulatoryRecord ? (
                  <div className="text-xs text-destructive">The source regulatory record is past its review date. Verify the jurisdiction source before dismissing this alert.</div>
                ) : null}
                {alert.suppressionReason ? (
                  <div className="text-xs text-muted-foreground">Override reason: {alert.suppressionReason}</div>
                ) : null}
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={updateComplianceAlert.isPending || !associationFilter}
                    onClick={() => associationFilter && updateComplianceAlert.mutate({
                      associationId: associationFilter,
                      templateId: alert.templateId,
                      templateItemId: alert.templateItemId,
                      status: "suppressed",
                      suppressionReason: "Reviewed by board or manager; handled outside current bylaw extraction scope.",
                      suppressedUntil: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString(),
                    })}
                  >
                    Suppress 90 Days
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={updateComplianceAlert.isPending || !associationFilter}
                    onClick={() => associationFilter && updateComplianceAlert.mutate({
                      associationId: associationFilter,
                      templateId: alert.templateId,
                      templateItemId: alert.templateItemId,
                      status: "resolved",
                      notes: "Resolved after confirming bylaw or operational coverage.",
                    })}
                  >
                    Mark Resolved
                  </Button>
                  {alert.sourceUrl ? (
                    <a className="text-xs underline underline-offset-4 inline-flex items-center px-3" href={alert.sourceUrl} target="_blank" rel="noreferrer">
                      Open source
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
            {complianceAlerts.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                No current compliance gaps detected for the selected association.
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium">Timeline / Calendar View</h3>
            <Badge variant="secondary">Events: {(calendarEvents ?? []).length}</Badge>
          </div>
          <div className="space-y-2">
            {(calendarEvents ?? [])
              .filter((e) => !associationFilter || e.associationId === associationFilter)
              .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
              .map((event) => (
                <div key={event.id} className="rounded border p-2 text-sm flex items-center justify-between">
                  <span>{event.title}</span>
                  <span className="text-muted-foreground">{new Date(event.startsAt).toLocaleDateString()}</span>
                </div>
              ))}
            {!calendarEvents?.length ? <div className="text-sm text-muted-foreground">No calendar events yet.</div> : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm flex items-center">
              Association Context: <span className="font-medium ml-1">{activeAssociationName || "None selected"}</span>
            </div>
            <Select value={selectedTemplateId || "none"} onValueChange={(v) => setSelectedTemplateId(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Template" /></SelectTrigger>
              <SelectContent><SelectItem value="none">select template</SelectItem>{templates?.map((t) => <SelectItem key={t.id} value={t.id}>{templateLabel(t)} ({t.year})</SelectItem>)}</SelectContent>
            </Select>
            <Button onClick={() => generateTasks.mutate()} disabled={generateTasks.isPending || !associationFilter || !selectedTemplateId}>Generate Year Tasks</Button>
          </div>

          {selectedTemplate ? (
            <div className="rounded-md border bg-muted/30 px-3 py-3 text-sm space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  Selected Template: <span className="font-medium">{templateLabel(selectedTemplate)}</span>
                </div>
                <div className="flex gap-2 items-center">
                  <Badge variant={templateFreshnessLabel(selectedTemplate) === "Stale" ? "destructive" : "secondary"}>
                    {templateFreshnessLabel(selectedTemplate)}
                  </Badge>
                  <Badge variant="outline">{selectedTemplate.publicationStatus}</Badge>
                </div>
              </div>
              <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-2 xl:grid-cols-4">
                <div>Source: <span className="font-medium text-foreground">{selectedTemplate.sourceAuthority || "-"}</span></div>
                <div>Last Updated: <span className="font-medium text-foreground">{selectedTemplate.lastSourceUpdatedAt ? new Date(selectedTemplate.lastSourceUpdatedAt).toLocaleDateString() : "-"}</span></div>
                <div>Last Verified: <span className="font-medium text-foreground">{selectedTemplate.lastVerifiedAt ? new Date(selectedTemplate.lastVerifiedAt).toLocaleDateString() : "-"}</span></div>
                <div>Next Review: <span className="font-medium text-foreground">{selectedTemplate.nextReviewDueAt ? new Date(selectedTemplate.nextReviewDueAt).toLocaleDateString() : "-"}</span></div>
              </div>
              {selectedTemplate.sourceUrl ? (
                <a className="text-xs underline underline-offset-4" href={selectedTemplate.sourceUrl} target="_blank" rel="noreferrer">
                  Open authoritative source
                </a>
              ) : null}
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={updateTemplate.isPending}
                  onClick={() => updateTemplate.mutate({
                    id: selectedTemplate.id,
                    payload: {
                      publicationStatus: "review",
                      reviewNotes: selectedTemplate.reviewNotes || "Queued for regulatory review.",
                    },
                  })}
                >
                  Move to Review
                </Button>
                <Button
                  size="sm"
                  disabled={updateTemplate.isPending}
                  onClick={() => updateTemplate.mutate({
                    id: selectedTemplate.id,
                    payload: {
                      publicationStatus: "published",
                      publishedAt: new Date(),
                      lastVerifiedAt: new Date(),
                      nextReviewDueAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90),
                    },
                  })}
                >
                  Publish / Verify
                </Button>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium mb-2">Template Items</h3>
              <Form {...itemForm}>
                <form className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-3" onSubmit={itemForm.handleSubmit((v) => createTemplateItem.mutate(v))}>
                  <Input placeholder="Title" value={itemForm.watch("title")} onChange={(e) => itemForm.setValue("title", e.target.value)} />
                  <Input placeholder="Month" type="number" value={itemForm.watch("dueMonth")} onChange={(e) => itemForm.setValue("dueMonth", Number(e.target.value))} />
                  <Input placeholder="Day" type="number" value={itemForm.watch("dueDay")} onChange={(e) => itemForm.setValue("dueDay", Number(e.target.value))} />
                  <Input placeholder="Order" type="number" value={itemForm.watch("orderIndex")} onChange={(e) => itemForm.setValue("orderIndex", Number(e.target.value))} />
                  <Button type="submit" disabled={createTemplateItem.isPending || !selectedTemplateId}>Add</Button>
                </form>
              </Form>
              <Table>
                <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Authority</TableHead><TableHead>Due</TableHead></TableRow></TableHeader>
                <TableBody>{(templateItems ?? []).map((i) => <TableRow key={i.id}><TableCell>{i.title}</TableCell><TableCell>{i.legalReference || i.sourceCitation || "-"}</TableCell><TableCell>{i.dueMonth}/{i.dueDay}</TableCell></TableRow>)}</TableBody>
              </Table>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-2">Compliance Kanban</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[{ key: "todo", label: "To Do", items: byStatus.todo }, { key: "in-progress", label: "In Progress", items: byStatus.inProgress }, { key: "done", label: "Done", items: byStatus.done }].map((lane) => (
                  <div key={lane.key} className="rounded border p-3 space-y-2">
                    <div className="text-xs font-medium uppercase text-muted-foreground">{lane.label} ({lane.items.length})</div>
                    {lane.items.map((t) => (
                      <button key={t.id} className="w-full text-left rounded border p-2 text-xs hover:bg-muted" onClick={() => updateTask.mutate({ id: t.id, status: lane.key === "todo" ? "in-progress" : lane.key === "in-progress" ? "done" : "done" })}>
                        <div className="font-medium text-sm">{t.title}</div>
                        <div className="text-muted-foreground">{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "No due date"}</div>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Compliance Task Table</h3>
            <Table>
              <TableHeader><TableRow><TableHead>Task</TableHead><TableHead>Due</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {filteredTasks.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{t.title}</TableCell>
                    <TableCell>{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "-"}</TableCell>
                    <TableCell>
                      <Select value={t.status} onValueChange={(status) => updateTask.mutate({ id: t.id, status: status as "todo" | "in-progress" | "done" })}>
                        <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="todo">todo</SelectItem><SelectItem value="in-progress">in-progress</SelectItem><SelectItem value="done">done</SelectItem></SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
