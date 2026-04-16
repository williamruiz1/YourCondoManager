import { useEffect, useMemo, useRef, useState } from "react";
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
import { useIsMobile } from "@/hooks/use-mobile";
import { Paperclip, Upload, Download, ClipboardCheck, Vote } from "lucide-react";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { boardGovernanceSubPages } from "@/lib/sub-page-nav";

function downloadCsv(rows: string[][], filename: string) {
  const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type AdminRole = "platform-admin" | "board-officer" | "assisted-board" | "pm-assistant" | "manager" | "viewer";

type AuthSession = {
  authenticated: boolean;
  admin?: {
    role: AdminRole;
  } | null;
};

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

function MobileDesktopHandoff({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-900">
      <div className="font-medium">{title}</div>
      <div className="mt-1 text-xs leading-5 text-amber-800">{body}</div>
    </div>
  );
}

export function GovernanceComplianceContent() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();
  const [associationFilter, setAssociationFilter] = useState(activeAssociationId);

  // Sync local filter when context resolves a stale localStorage association ID
  useEffect(() => {
    if (activeAssociationId && activeAssociationId !== associationFilter) {
      setAssociationFilter(activeAssociationId);
    }
  }, [activeAssociationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const [openTemplate, setOpenTemplate] = useState(false);
  const [openTask, setOpenTask] = useState(false);
  const [openCalendar, setOpenCalendar] = useState(false);
  const [alertStatusFilter, setAlertStatusFilter] = useState<"all" | "active" | "suppressed" | "resolved">("active");
  const [suppressDialogAlert, setSuppressDialogAlert] = useState<ComplianceGapAlert | null>(null);
  const [suppressReason, setSuppressReason] = useState("");
  const [suppressDays, setSuppressDays] = useState("90");

  const { data: authSession } = useQuery<AuthSession | null>({
    queryKey: ["/api/auth/me", "session"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });
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
  type PlatformGap = { category: string; title: string; description: string; severity: "low" | "medium" | "high"; recordType: string; recordCount: number };
  const { data: platformGaps = [] } = useQuery<PlatformGap[]>({
    queryKey: [associationFilter ? `/api/governance/platform-gaps?associationId=${associationFilter}` : "/api/governance/platform-gaps"],
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

  // 11.3: Election compliance summary
  type ElectionComplianceSummary = {
    totalElections: number;
    byYear: Array<{ year: number; count: number; quorumMet: number; quorumFailed: number; avgParticipation: number }>;
    overallAvgParticipation: number;
  };
  const { data: electionCompliance } = useQuery<ElectionComplianceSummary>({
    queryKey: ["/api/elections/compliance-summary", associationFilter],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/elections/compliance-summary?associationId=${associationFilter}`);
      return res.json();
    },
    enabled: Boolean(associationFilter),
  });

  const templateForm = useForm<z.infer<typeof templateSchema>>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      associationId: "",
      baseTemplateId: "",
      scope: "association",
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

  const adminRole = authSession?.admin?.role ?? null;
  const canManageStateLibrary = adminRole === "platform-admin";

  useEffect(() => {
    if (canManageStateLibrary) return;
    templateForm.setValue("scope", "association", { shouldValidate: true });
    templateForm.setValue("associationId", activeAssociationId, { shouldValidate: true });
  }, [activeAssociationId, canManageStateLibrary, templateForm]);

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

  const [versionHistoryTemplateId, setVersionHistoryTemplateId] = useState<string | null>(null);
  const { data: versionHistory = [] } = useQuery<GovernanceComplianceTemplate[]>({
    queryKey: ["/api/governance/templates/versions", versionHistoryTemplateId],
    queryFn: async () => {
      if (!versionHistoryTemplateId) return [];
      const res = await apiRequest("GET", `/api/governance/templates/${versionHistoryTemplateId}/versions`);
      return res.json();
    },
    enabled: Boolean(versionHistoryTemplateId),
  });

  const assignTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      if (!activeAssociationId) throw new Error("No association selected");
      const res = await apiRequest("POST", `/api/governance/templates/${templateId}/assign`, { associationId: activeAssociationId });
      return res.json() as Promise<{ assigned: GovernanceComplianceTemplate; alreadyExists: boolean }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/templates"] });
      toast({ title: result.alreadyExists ? "Template already assigned" : "Template assigned to association" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createNewVersion = useMutation({
    mutationFn: async (templateId: string) => {
      const res = await apiRequest("POST", `/api/governance/templates/${templateId}/new-version`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/templates"] });
      toast({ title: "New template version created (draft)" });
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
  const evidenceInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const uploadEvidence = useMutation({
    mutationFn: async ({ taskId, file }: { taskId: string; file: File }) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/governance/tasks/${taskId}/evidence`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Upload failed" }));
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/tasks"] });
      toast({ title: "Evidence uploaded" });
    },
    onError: (error: Error) => toast({ title: "Upload failed", description: error.message, variant: "destructive" }),
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
      return res.json() as Promise<{ created: number; processed: number; source?: "approved-clauses" | "template-fallback" }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [associationFilter ? `/api/ai/ingestion/compliance-rules?associationId=${associationFilter}` : "/api/ai/ingestion/compliance-rules"] });
      queryClient.invalidateQueries({
        predicate: (query) => typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/governance/compliance-alerts"),
      });
      const sourceLabel = result.source === "template-fallback" ? "template fallback" : "approved clause extraction";
      toast({ title: "Compliance rules extracted", description: `Created ${result.created} rule(s) from ${result.processed} source record(s) via ${sourceLabel}.` });
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
  const visibleComplianceAlerts = complianceAlerts.filter((alert) => alertStatusFilter === "all" || alert.status === alertStatusFilter);
  const templateFreshnessLabel = (template: GovernanceComplianceTemplate) => {
    if (!template.nextReviewDueAt) return "No review date";
    return new Date(template.nextReviewDueAt) < now ? "Stale" : "Current";
  };

  return (
    <>
      {/* Suppression dialog */}
      <Dialog open={Boolean(suppressDialogAlert)} onOpenChange={(open) => { if (!open) setSuppressDialogAlert(null); }}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Suppress Compliance Alert</DialogTitle>
          </DialogHeader>
          {suppressDialogAlert && (
            <div className="space-y-4">
              <div className="text-sm font-medium">{suppressDialogAlert.templateItemTitle}</div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Suppression Reason <span className="text-destructive">*</span></label>
                <Textarea
                  placeholder="Explain why this alert is being suppressed..."
                  value={suppressReason}
                  onChange={(e) => setSuppressReason(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Suppress Duration</label>
                <Select value={suppressDays} onValueChange={setSuppressDays}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="60">60 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                    <SelectItem value="180">180 days</SelectItem>
                    <SelectItem value="365">1 year</SelectItem>
                    <SelectItem value="0">Indefinitely</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className={`gap-2 ${isMobile ? "grid grid-cols-1" : "flex justify-end"}`}>
                <Button variant="outline" className={isMobile ? "w-full" : undefined} onClick={() => setSuppressDialogAlert(null)}>Cancel</Button>
                <Button
                  className={isMobile ? "w-full" : undefined}
                  disabled={!suppressReason.trim() || updateComplianceAlert.isPending}
                  onClick={() => {
                    if (!associationFilter || !suppressDialogAlert) return;
                    const until = Number(suppressDays) > 0
                      ? new Date(Date.now() + 1000 * 60 * 60 * 24 * Number(suppressDays)).toISOString()
                      : null;
                    updateComplianceAlert.mutate({
                      associationId: associationFilter,
                      templateId: suppressDialogAlert.templateId,
                      templateItemId: suppressDialogAlert.templateItemId,
                      status: "suppressed",
                      suppressionReason: suppressReason.trim(),
                      suppressedUntil: until,
                    });
                    setSuppressDialogAlert(null);
                  }}
                >
                  Confirm Suppression
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div />
        <div className="flex gap-2">
          <Button variant="outline" disabled={!associationFilter} onClick={() => extractComplianceRules.mutate()}>
            Extract Compliance Rules
          </Button>
          <Button
            variant="outline"
            onClick={() => bootstrapStateLibrary.mutate()}
            disabled={bootstrapStateLibrary.isPending || !canManageStateLibrary}
            title={canManageStateLibrary ? undefined : "Only platform admins can sync the shared regulatory library."}
          >
            {bootstrapStateLibrary.isPending ? "Syncing Records..." : "Sync Regulatory Library"}
          </Button>
          <Dialog open={openTemplate} onOpenChange={setOpenTemplate}>
            <DialogTrigger asChild><Button variant="outline">New Template</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto sm:max-h-[85vh]">
              <DialogHeader><DialogTitle>Create Compliance Template</DialogTitle></DialogHeader>
              <Form {...templateForm}>
                <form className="space-y-4" onSubmit={templateForm.handleSubmit((v) => createTemplate.mutate(v))}>
                  {isMobile ? (
                    <MobileDesktopHandoff
                      title="Desktop preferred for library-scale regulatory authoring"
                      body="Mobile works for review, publication status changes, and light edits. Large source-library composition and dense regulatory maintenance still belong on desktop."
                    />
                  ) : null}
                  <FormField control={templateForm.control} name="scope" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Scope</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={!canManageStateLibrary}
                      >
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {canManageStateLibrary ? <SelectItem value="state-library">state-library</SelectItem> : null}
                          <SelectItem value="association">association overlay</SelectItem>
                        </SelectContent>
                      </Select>
                      {!canManageStateLibrary ? (
                        <p className="text-sm text-muted-foreground">
                          Scoped admins can create association overlays. Shared state library records remain platform-admin only.
                        </p>
                      ) : null}
                      <FormMessage />
                    </FormItem>
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
                  <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-1 md:grid-cols-3"}`}>
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
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto sm:max-h-[85vh]">
              <DialogHeader><DialogTitle>Create Annual Governance Task</DialogTitle></DialogHeader>
              <Form {...taskForm}>
                <form className="space-y-4" onSubmit={taskForm.handleSubmit((v) => createTask.mutate(v))}>
                  <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                    Use a governance task for a recurring compliance obligation or board-controlled deliverable that someone must complete and track to closure.
                  </div>
                  <FormField control={taskForm.control} name="associationId" render={({ field }) => (
                    <FormItem><FormLabel>Association</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl><SelectContent>{associations?.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                  )} />
                  <FormField control={taskForm.control} name="title" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl><Input {...field} placeholder="Example: File annual budget ratification notice" /></FormControl>
                      <div className="text-xs text-muted-foreground">Name the obligation or deliverable in plain operating language.</div>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={taskForm.control} name="description" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl><Textarea {...field} placeholder="Include the trigger, expected output, and any review or filing notes." /></FormControl>
                      <div className="text-xs text-muted-foreground">Good examples include filing steps, document requirements, or board review expectations.</div>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
                    <FormField control={taskForm.control} name="ownerPersonId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Owner</FormLabel>
                        <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}><FormControl><SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger></FormControl><SelectContent><SelectItem value="none">none</SelectItem>{persons?.map((p) => <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>)}</SelectContent></Select>
                        <div className="text-xs text-muted-foreground">Assign the board member or operator responsible for moving the task forward.</div>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={taskForm.control} name="dueDate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Due Date</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                        <div className="text-xs text-muted-foreground">Set the filing, mailing, or board-review deadline the team should work toward.</div>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <Button className="w-full" type="submit" disabled={createTask.isPending}>Save</Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          <Dialog open={openCalendar} onOpenChange={setOpenCalendar}>
            <DialogTrigger asChild><Button variant="outline">New Calendar Event</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto sm:max-h-[85vh]">
              <DialogHeader><DialogTitle>Create Calendar Event</DialogTitle></DialogHeader>
              <Form {...calendarForm}>
                <form className="space-y-4" onSubmit={calendarForm.handleSubmit((v) => createCalendarEvent.mutate(v))}>
                  <FormField control={calendarForm.control} name="associationId" render={({ field }) => (
                    <FormItem><FormLabel>Association</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl><SelectContent>{associations?.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                  )} />
                  <FormField control={calendarForm.control} name="title" render={({ field }) => (<FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
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

      {/* State Template Library Card */}
      {stateLibraryTemplates.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="font-medium text-sm">State Compliance Template Library</div>
                <div className="text-xs text-muted-foreground">{stateLibraryTemplates.length} state templates · organized by jurisdiction</div>
              </div>
              <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={() => {
                const rows: string[][] = [
                  ["State", "Template Name", "Scope", "Version", "Status", "Source Authority", "Items Count", "Last Verified"],
                  ...stateLibraryTemplates.map((t) => [
                    t.stateCode ?? "All States",
                    t.name,
                    t.scope,
                    String(t.versionNumber),
                    t.publicationStatus,
                    t.sourceAuthority ?? "—",
                    "—",
                    t.lastVerifiedAt ? new Date(t.lastVerifiedAt).toLocaleDateString() : "—",
                  ]),
                ];
                downloadCsv(rows, `state-template-library-${new Date().toISOString().slice(0, 10)}.csv`);
              }}>
                <Download className="h-3.5 w-3.5" /> Export Library
              </Button>
            </div>

            {/* Group by state */}
            {Array.from(new Set(stateLibraryTemplates.map(t => t.stateCode ?? "All States"))).sort().map(state => {
              const stateTemplates = stateLibraryTemplates.filter(t => (t.stateCode ?? "All States") === state);
              return (
                <div key={state} className="space-y-1">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{state}</div>
                  <div className="space-y-1.5">
                    {stateTemplates.map(t => (
                      <div key={t.id} className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 ${t.publicationStatus === "published" ? "bg-green-50 dark:bg-green-950/20 border-green-300" : t.publicationStatus === "review" ? "bg-amber-50 dark:bg-amber-950/20 border-amber-300" : "bg-muted"}`}>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium">{t.name}</span>
                          <span className="text-xs text-muted-foreground ml-1.5">v{t.versionNumber}</span>
                          {t.publicationStatus !== "published" && <span className="ml-1 text-xs text-amber-600">({t.publicationStatus})</span>}
                          {t.nextReviewDueAt && new Date(t.nextReviewDueAt) < now && <span className="ml-1 text-xs text-red-600">⚠ stale</span>}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {activeAssociationId && t.publicationStatus === "published" && (
                            <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => assignTemplate.mutate(t.id)} disabled={assignTemplate.isPending}>
                              Assign
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => setVersionHistoryTemplateId(versionHistoryTemplateId === t.id ? null : t.id)}>
                            History
                          </Button>
                          {canManageStateLibrary && (
                            <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => createNewVersion.mutate(t.id)} disabled={createNewVersion.isPending}>
                              +Version
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Version history panel */}
            {versionHistoryTemplateId && versionHistory.length > 0 && (
              <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                <div className="text-xs font-medium">Version History — {versionHistory[0]?.name}</div>
                <div className="space-y-1">
                  {versionHistory.map(v => (
                    <div key={v.id} className="flex items-center gap-3 text-xs">
                      <Badge variant={v.publicationStatus === "published" ? "default" : "secondary"} className="text-xs">v{v.versionNumber}</Badge>
                      <span className="text-muted-foreground">{v.publicationStatus}</span>
                      {v.scope === "association" && <span className="text-blue-600">association overlay</span>}
                      {v.createdAt && <span className="text-muted-foreground">{new Date(v.createdAt).toLocaleDateString()}</span>}
                      {v.createdBy && <span className="text-muted-foreground">by {v.createdBy}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
                <details key={rule.id} className="rounded-md border p-4" open={!isMobile}>
                  <summary className="list-none cursor-pointer">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium">{String(payload.sourceTitle || "Compliance rule")}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {String(payload.obligationType || "general-compliance")} · {String(payload.frequency || "event-driven")}
                        </div>
                      </div>
                      <Badge variant="outline">{String(payload.severity || "low")}</Badge>
                    </div>
                  </summary>
                  <div className="mt-3 space-y-3">
                    <div className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
                      {String(payload.obligationText || "")}
                    </div>
                    <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
                      <div>Type: <span className="font-medium text-foreground">{String(payload.obligationType || "general-compliance")}</span></div>
                      <div>Frequency: <span className="font-medium text-foreground">{String(payload.frequency || "event-driven")}</span></div>
                      <div>Review: <span className="font-medium text-foreground">{rule.reviewStatus}</span></div>
                    </div>
                  </div>
                </details>
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
          {/* KPI summary */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "High Severity", count: complianceAlerts.filter(a => a.severity === "high" && a.status === "active").length, variant: "bg-red-50 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300" },
              { label: "Medium Severity", count: complianceAlerts.filter(a => a.severity === "medium" && a.status === "active").length, variant: "bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300" },
              { label: "Suppressed", count: suppressedComplianceAlerts.length, variant: "bg-muted text-muted-foreground border" },
              { label: "With Source Evidence", count: complianceAlerts.filter(a => a.sourceUrl || a.legalReference || a.matchedRuleCount > 0).length, variant: "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300" },
            ].map(kpi => (
              <div key={kpi.label} className={`rounded-md border p-3 text-center ${kpi.variant}`}>
                <div className="text-xl font-bold">{kpi.count}</div>
                <div className="text-xs mt-0.5">{kpi.label}</div>
              </div>
            ))}
          </div>
          {/* Status filter buttons */}
          <div className="flex gap-2 flex-wrap">
            {(["active", "suppressed", "resolved", "all"] as const).map((status) => {
              const counts = { active: activeComplianceAlerts.length, suppressed: suppressedComplianceAlerts.length, resolved: resolvedComplianceAlerts.length, all: complianceAlerts.length };
              return (
                <Button
                  key={status}
                  size="sm"
                  variant={alertStatusFilter === status ? "default" : "outline"}
                  className="h-7 text-xs"
                  onClick={() => setAlertStatusFilter(status)}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)} ({counts[status]})
                </Button>
              );
            })}
          </div>
          <div className="space-y-2">
            {visibleComplianceAlerts.map((alert) => (
              <details key={alert.templateItemId} className="rounded-md border p-4" open={!isMobile && alert.status === "active"}>
                <summary className="list-none cursor-pointer">
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
                </summary>
                <div className="mt-3 space-y-3">
                  <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-2 xl:grid-cols-4">
                    <div>Type: <span className="font-medium text-foreground">{alert.obligationType}</span></div>
                    <div>Due Window: <span className="font-medium text-foreground">{alert.dueMonth}/{alert.dueDay}</span></div>
                    <div>Legal Ref: <span className="font-medium text-foreground">{alert.legalReference || "-"}</span></div>
                    <div>Source: <span className="font-medium text-foreground">{alert.sourceAuthority || "-"}</span></div>
                  </div>
                  {alert.staleRegulatoryRecord ? (
                    <div className="rounded-lg border border-destructive/30 bg-red-50 px-3 py-2 text-xs text-destructive">The source regulatory record is past its review date. Verify the jurisdiction source before dismissing this alert.</div>
                  ) : null}
                  {alert.suppressionReason ? (
                    <div className="rounded-lg border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">Override reason: {alert.suppressionReason}</div>
                  ) : null}
                  <div className={`flex gap-2 flex-wrap ${isMobile ? "flex-col" : ""}`}>
                    {alert.status === "active" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={updateComplianceAlert.isPending || !associationFilter}
                          onClick={() => {
                            setSuppressDialogAlert(alert);
                            setSuppressReason("");
                            setSuppressDays("90");
                          }}
                        >
                          Suppress
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
                      </>
                    )}
                    {(alert.status === "suppressed" || alert.status === "resolved") && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={updateComplianceAlert.isPending || !associationFilter}
                        onClick={() => associationFilter && updateComplianceAlert.mutate({
                          associationId: associationFilter,
                          templateId: alert.templateId,
                          templateItemId: alert.templateItemId,
                          status: "active",
                          suppressionReason: null,
                          suppressedUntil: null,
                        })}
                      >
                        Reactivate
                      </Button>
                    )}
                    {alert.sourceUrl ? (
                      <a className="inline-flex items-center px-3 py-2 text-xs underline underline-offset-4" href={alert.sourceUrl} target="_blank" rel="noreferrer">
                        Open source
                      </a>
                    ) : null}
                  </div>
                </div>
              </details>
            ))}
            {visibleComplianceAlerts.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                No compliance alerts match the selected filter.
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-sm font-medium">Platform Records Gap Analysis</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Cross-reference insurance, meetings, board composition, maintenance, and documents against compliance requirements.</p>
            </div>
            {platformGaps.length > 0 && (
              <Badge variant={platformGaps.some(g => g.severity === "high") ? "destructive" : "secondary"}>
                {platformGaps.length} gap{platformGaps.length !== 1 ? "s" : ""} found
              </Badge>
            )}
          </div>
          {!associationFilter ? (
            <div className="text-sm text-muted-foreground border border-dashed rounded-md p-4">Select an association to run platform gap analysis.</div>
          ) : platformGaps.length === 0 ? (
            <div className="text-sm text-muted-foreground border border-dashed rounded-md p-4">No platform record gaps detected. All key compliance indicators are covered.</div>
          ) : (
            <div className="space-y-2">
              {platformGaps.map((gap, idx) => (
                <div key={idx} className="rounded-md border p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{gap.category}</Badge>
                      <span className="text-sm font-medium">{gap.title}</span>
                    </div>
                    <Badge variant={gap.severity === "high" ? "destructive" : gap.severity === "medium" ? "secondary" : "outline"}>{gap.severity}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{gap.description}</p>
                </div>
              ))}
            </div>
          )}
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
          <div className="rounded-md border bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
            Workflow guide: use <span className="font-medium text-foreground">Generate Year Tasks</span> when the selected template already defines the annual obligations. Use <span className="font-medium text-foreground">New Governance Task</span> for one-off or missing tasks that still need tracking.
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm flex items-center">
              Association Context: <span className="font-medium ml-1">{activeAssociationName || "None selected"}</span>
            </div>
            <Select value={selectedTemplateId || "none"} onValueChange={(v) => setSelectedTemplateId(v === "none" ? "" : v)}>
              <SelectTrigger className={isMobile ? "min-h-11" : undefined}><SelectValue placeholder="Template" /></SelectTrigger>
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
                <form className={`mb-3 grid gap-2 ${isMobile ? "grid-cols-1" : "grid-cols-1 md:grid-cols-5"}`} onSubmit={itemForm.handleSubmit((v) => createTemplateItem.mutate(v))}>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Title</div>
                    <Input className={isMobile ? "min-h-11" : undefined} placeholder="Title" value={itemForm.watch("title")} onChange={(e) => itemForm.setValue("title", e.target.value)} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 md:contents">
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Month</div>
                      <Input className={isMobile ? "min-h-11" : undefined} placeholder="Month" type="number" value={itemForm.watch("dueMonth")} onChange={(e) => itemForm.setValue("dueMonth", Number(e.target.value))} />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Day</div>
                      <Input className={isMobile ? "min-h-11" : undefined} placeholder="Day" type="number" value={itemForm.watch("dueDay")} onChange={(e) => itemForm.setValue("dueDay", Number(e.target.value))} />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Order</div>
                      <Input className={isMobile ? "min-h-11" : undefined} placeholder="Order" type="number" value={itemForm.watch("orderIndex")} onChange={(e) => itemForm.setValue("orderIndex", Number(e.target.value))} />
                    </div>
                  </div>
                  <Button className={isMobile ? "w-full min-h-11" : undefined} type="submit" disabled={createTemplateItem.isPending || !selectedTemplateId}>Add</Button>
                </form>
              </Form>
              <div className="hidden md:block">
                <Table>
                  <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Authority</TableHead><TableHead>Due</TableHead></TableRow></TableHeader>
                  <TableBody>{(templateItems ?? []).map((i) => <TableRow key={i.id}><TableCell>{i.title}</TableCell><TableCell>{i.legalReference || i.sourceCitation || "-"}</TableCell><TableCell>{i.dueMonth}/{i.dueDay}</TableCell></TableRow>)}</TableBody>
                </Table>
              </div>
              <div className="space-y-3 md:hidden">
                {(templateItems ?? []).map((i) => (
                  <div key={i.id} className="rounded-xl border p-4">
                    <div className="text-sm font-medium">{i.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{i.legalReference || i.sourceCitation || "No authority reference"}</div>
                    <div className="mt-3 text-xs text-muted-foreground">Due {i.dueMonth}/{i.dueDay}</div>
                  </div>
                ))}
                {(templateItems ?? []).length === 0 ? (
                  <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No template items yet.</div>
                ) : null}
              </div>
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

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h3 className="text-sm font-medium mb-2">Compliance Task Table</h3>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={() => {
                const now = new Date();
                const rows: string[][] = [
                  ["Task", "Due Date", "Status", "Days Until Due", "Legal Reference", "Notes"],
                  ...filteredTasks.map((t) => {
                    const dueDate = t.dueDate ? new Date(t.dueDate) : null;
                    const daysUntil = dueDate ? Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
                    return [
                      t.title,
                      dueDate ? dueDate.toLocaleDateString() : "—",
                      t.status,
                      daysUntil !== null ? String(daysUntil) : "—",
                      (t as any).legalReference ?? "—",
                      (t as any).notes ?? "—",
                    ];
                  }),
                ];
                downloadCsv(rows, `compliance-tasks-${new Date().toISOString().slice(0, 10)}.csv`);
              }}>
                <Download className="h-3.5 w-3.5" /> Export CSV
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={() => {
                const now = new Date();
                const overdueTasks = filteredTasks.filter((t) => t.dueDate && new Date(t.dueDate) < now && t.status !== "done");
                const upcomingTasks = filteredTasks.filter((t) => {
                  if (t.status === "done" || !t.dueDate) return false;
                  const d = new Date(t.dueDate);
                  const days = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                  return days >= 0 && days <= 30;
                });
                const rows: string[][] = [
                  ["REGULATORY FILING REVIEW REPORT"],
                  [`Generated: ${now.toLocaleString()}`],
                  [],
                  ["OVERDUE FILINGS"],
                  ["Task", "Due Date", "Status"],
                  ...overdueTasks.map((t) => [t.title, t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—", t.status]),
                  [],
                  ["DUE IN NEXT 30 DAYS"],
                  ["Task", "Due Date", "Status"],
                  ...upcomingTasks.map((t) => [t.title, t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—", t.status]),
                  [],
                  ["SUMMARY"],
                  ["Total Tasks", String(filteredTasks.length)],
                  ["Overdue", String(overdueTasks.length)],
                  ["Due in 30 Days", String(upcomingTasks.length)],
                  ["Completed", String(filteredTasks.filter((t) => t.status === "done").length)],
                ];
                downloadCsv(rows, `regulatory-filing-review-${now.toISOString().slice(0, 10)}.csv`);
              }}>
                <ClipboardCheck className="h-3.5 w-3.5" /> Filing Review Report
              </Button>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium mb-2">Compliance Task Table</h3>
            <div className="hidden md:block">
              <Table>
                <TableHeader><TableRow><TableHead>Task</TableHead><TableHead>Due</TableHead><TableHead>Status</TableHead><TableHead>Evidence</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filteredTasks
                    .slice()
                    .sort((a, b) => {
                      const aDate = a.dueDate ? new Date(a.dueDate) : null;
                      const bDate = b.dueDate ? new Date(b.dueDate) : null;
                      if (!aDate && !bDate) return 0;
                      if (!aDate) return 1;
                      if (!bDate) return -1;
                      return aDate.getTime() - bDate.getTime();
                    })
                    .map((t) => {
                    const now = new Date();
                    const dueDate = t.dueDate ? new Date(t.dueDate) : null;
                    const daysUntil = dueDate ? Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
                    const isOverdue = dueDate && dueDate < now && t.status !== "done";
                    const isDueSoon = daysUntil !== null && daysUntil >= 0 && daysUntil <= 14 && t.status !== "done";
                    return (
                    <TableRow key={t.id} className={isOverdue ? "bg-red-50/50" : isDueSoon ? "bg-amber-50/50" : ""}>
                      <TableCell>{t.title}</TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <div className={isOverdue ? "text-red-600 font-medium" : isDueSoon ? "text-amber-700 font-medium" : ""}>
                            {dueDate ? dueDate.toLocaleDateString() : "-"}
                          </div>
                          {isOverdue && daysUntil !== null && (
                            <Badge variant="destructive" className="text-xs">{Math.abs(daysUntil)}d overdue</Badge>
                          )}
                          {isDueSoon && (
                            <Badge variant="secondary" className="text-xs text-amber-700 border-amber-300 bg-amber-100">Due in {daysUntil}d</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select value={t.status} onValueChange={(status) => updateTask.mutate({ id: t.id, status: status as "todo" | "in-progress" | "done" })}>
                          <SelectTrigger className={`w-[140px] ${isMobile ? "min-h-11" : ""}`}><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="todo">todo</SelectItem><SelectItem value="in-progress">in-progress</SelectItem><SelectItem value="done">done</SelectItem></SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 flex-wrap">
                          {Array.isArray((t as any).evidenceUrlsJson) && ((t as any).evidenceUrlsJson as string[]).map((url: string, i: number) => (
                            <a key={i} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                              <Paperclip className="h-3 w-3" />{i + 1}
                            </a>
                          ))}
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                            className="hidden"
                            ref={(el) => { evidenceInputRefs.current[t.id] = el; }}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) uploadEvidence.mutate({ taskId: t.id, file });
                            }}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs gap-1"
                            onClick={() => evidenceInputRefs.current[t.id]?.click()}
                            disabled={uploadEvidence.isPending}
                          >
                            <Upload className="h-3 w-3" />
                            {uploadEvidence.isPending ? "…" : "Upload"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="space-y-3 md:hidden">
              {filteredTasks
                .slice()
                .sort((a, b) => {
                  const aDate = a.dueDate ? new Date(a.dueDate) : null;
                  const bDate = b.dueDate ? new Date(b.dueDate) : null;
                  if (!aDate && !bDate) return 0;
                  if (!aDate) return 1;
                  if (!bDate) return -1;
                  return aDate.getTime() - bDate.getTime();
                })
                .map((t) => {
                  const now = new Date();
                  const dueDate = t.dueDate ? new Date(t.dueDate) : null;
                  const daysUntil = dueDate ? Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
                  const isOverdue = dueDate && dueDate < now && t.status !== "done";
                  const isDueSoon = daysUntil !== null && daysUntil >= 0 && daysUntil <= 14 && t.status !== "done";
                  return (
                    <div key={t.id} className={`rounded-xl border p-4 space-y-3 ${isOverdue ? "bg-red-50/50" : isDueSoon ? "bg-amber-50/50" : ""}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium">{t.title}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{dueDate ? dueDate.toLocaleDateString() : "No due date"}</div>
                        </div>
                        {isOverdue && daysUntil !== null ? (
                          <Badge variant="destructive" className="text-xs">{Math.abs(daysUntil)}d overdue</Badge>
                        ) : isDueSoon ? (
                          <Badge variant="secondary" className="text-xs text-amber-700 border-amber-300 bg-amber-100">Due in {daysUntil}d</Badge>
                        ) : null}
                      </div>
                      <Select value={t.status} onValueChange={(status) => updateTask.mutate({ id: t.id, status: status as "todo" | "in-progress" | "done" })}>
                        <SelectTrigger className={isMobile ? "min-h-11" : undefined}><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="todo">todo</SelectItem><SelectItem value="in-progress">in-progress</SelectItem><SelectItem value="done">done</SelectItem></SelectContent>
                      </Select>
                      <div className="flex items-center gap-2 flex-wrap">
                        {Array.isArray((t as any).evidenceUrlsJson) && ((t as any).evidenceUrlsJson as string[]).map((url: string, i: number) => (
                          <a key={i} href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs text-blue-600 hover:underline">
                            <Paperclip className="h-3 w-3" />Evidence {i + 1}
                          </a>
                        ))}
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                          className="hidden"
                          ref={(el) => { evidenceInputRefs.current[t.id] = el; }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadEvidence.mutate({ taskId: t.id, file });
                          }}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className={`px-3 text-xs gap-1 ${isMobile ? "min-h-10" : "h-8"}`}
                          onClick={() => evidenceInputRefs.current[t.id]?.click()}
                          disabled={uploadEvidence.isPending}
                        >
                          <Upload className="h-3 w-3" />
                          {uploadEvidence.isPending ? "…" : "Upload Evidence"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              {filteredTasks.length === 0 ? (
                <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No compliance tasks yet.</div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 11.3: Election Compliance Section */}
      {associationFilter && electionCompliance && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Vote className="h-5 w-5 text-indigo-600" />
              <h2 className="text-lg font-semibold">Election Compliance</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-lg border p-4 text-center">
                <div className="text-2xl font-bold">{electionCompliance.totalElections}</div>
                <div className="text-sm text-muted-foreground">Total Elections</div>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <div className="text-2xl font-bold">{electionCompliance.overallAvgParticipation}%</div>
                <div className="text-sm text-muted-foreground">Avg Participation</div>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <div className="text-2xl font-bold text-green-600">
                  {electionCompliance.byYear.reduce((s, y) => s + y.quorumMet, 0)}
                </div>
                <div className="text-sm text-muted-foreground">
                  Quorum Met ({electionCompliance.byYear.reduce((s, y) => s + y.quorumFailed, 0)} failed)
                </div>
              </div>
            </div>

            {electionCompliance.byYear.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-2">Elections by Year</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Year</TableHead>
                      <TableHead className="text-right">Elections</TableHead>
                      <TableHead className="text-right">Quorum Met</TableHead>
                      <TableHead className="text-right">Quorum Failed</TableHead>
                      <TableHead className="text-right">Avg Participation</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {electionCompliance.byYear.map((row) => (
                      <TableRow key={row.year}>
                        <TableCell className="font-medium">{row.year}</TableCell>
                        <TableCell className="text-right">{row.count}</TableCell>
                        <TableCell className="text-right text-green-600">{row.quorumMet}</TableCell>
                        <TableCell className="text-right text-red-600">{row.quorumFailed}</TableCell>
                        <TableCell className="text-right">{row.avgParticipation}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {electionCompliance.totalElections === 0 && (
              <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                No closed or certified elections found for this association.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}

export default function GovernanceCompliancePage() {
  return (
    <div className="p-6 space-y-6">
      <WorkspacePageHeader
        title="Governance & Compliance"
        summary="Manage source-backed regulatory records, association overlays, and annual governance tasks."
        eyebrow="Board & Governance"
        breadcrumbs={[{ label: "Board", href: "/app/board" }, { label: "Compliance" }]}
        subPages={boardGovernanceSubPages}
      />
      <GovernanceComplianceContent />
    </div>
  );
}
