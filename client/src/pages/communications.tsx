import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type {
  CommunicationHistory,
  ContactUpdateRequest,
  MaintenanceRequest,
  NoticeSend,
  NoticeTemplate,
  OnboardingInvite,
  OnboardingSubmission,
  Person,
  Unit,
} from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useActiveAssociation } from "@/hooks/use-active-association";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { AssociationScopeBanner } from "@/components/association-scope-banner";

const standardTemplateDefinitions = [
  {
    name: "Payment Instructions - Standard",
    subjectTemplate: "Payment Instructions for {{association_name}}",
    headerTemplate: null,
    bodyTemplate: "Hello {{recipient_name}},\n\nPlease use the approved payment methods below for your account.\n\n{{payment_methods}}\n\nIf you have questions, contact {{payment_support_email}} or {{payment_support_phone}}.\n\nThank you,\n{{association_name}}",
    footerTemplate: "This notice applies to {{unit_label}}.",
    signatureTemplate: "{{association_name}} Management",
  },
  {
    name: "Board Meeting Notice - Standard",
    subjectTemplate: "Board Meeting Notice - {{association_name}}",
    headerTemplate: null,
    bodyTemplate: "Hello {{recipient_name}},\n\nThis is notice of an upcoming board meeting for {{association_name}}.\n\nDate and agenda details will be posted in your resident portal.\n\nThank you,\n{{association_name}}",
    footerTemplate: "{{unit_label}}",
    signatureTemplate: "{{association_name}} Board",
  },
  {
    name: "Maintenance Update - Standard",
    subjectTemplate: "Maintenance Update — {{unit_label}}",
    headerTemplate: null,
    bodyTemplate: "Hello {{recipient_name}},\n\nWe are providing an update related to maintenance activity for {{unit_label}}.\n\nFor request details use: {{maintenance_request_link}}\n\nThank you,\n{{association_name}}",
    footerTemplate: null,
    signatureTemplate: "{{association_name}} Operations",
  },
];

export default function CommunicationsPage() {
  const { toast } = useToast();
  const [workspacePanel, setWorkspacePanel] = useState<"delivery" | "onboarding" | "operations">("delivery");
  const [templateOpen, setTemplateOpen] = useState(false);
  const [recipientPreview, setRecipientPreview] = useState<{
    recipients: Array<{ personId: string; email: string; role: "owner" | "tenant" | "board-member"; unitId: string }>;
    candidateCount: number;
    missingEmailCount: number;
    duplicateEmailCount: number;
    skippedRecipients: number;
  } | null>(null);
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();

  const [templateForm, setTemplateForm] = useState({
    associationId: "",
    name: "",
    subjectTemplate: "",
    headerTemplate: "",
    bodyTemplate: "",
    footerTemplate: "",
    signatureTemplate: "",
  });

  const [sendForm, setSendForm] = useState({
    associationId: "",
    templateId: "",
    recipientEmail: "",
    recipientPersonId: "",
    subject: "",
    body: "",
    variablesJson: "{}",
    requireApproval: false,
    scheduledFor: "",
    bypassReadinessGate: false,
  });

  const [targetedForm, setTargetedForm] = useState({
    associationId: "",
    targetType: "all-occupants" as "all-owners" | "all-tenants" | "all-occupants" | "selected-units" | "individual-owner" | "individual-tenant" | "board-members",
    selectedUnitAudience: "all" as "owners" | "tenants" | "occupants" | "all",
    selectedUnitIds: [] as string[],
    selectedPersonId: "",
    messageClass: "general" as "general" | "operational" | "maintenance" | "financial" | "governance",
    ccOwners: false,
    templateId: "",
    subject: "",
    body: "",
    variablesJson: "{}",
    requireApproval: false,
    scheduledFor: "",
    bypassReadinessGate: false,
  });
  const [paymentInstructionForm, setPaymentInstructionForm] = useState({
    associationId: "",
    templateId: "",
    targetType: "all-owners" as "all-owners" | "individual-owner" | "selected-units",
    selectedUnitIds: [] as string[],
    selectedPersonId: "",
    ccOwners: false,
    subject: "",
    body: "",
    requireApproval: false,
    scheduledFor: "",
  });
  const [onboardingInviteForm, setOnboardingInviteForm] = useState({
    unitId: "",
    residentType: "owner" as "owner" | "tenant",
    email: "",
    phone: "",
    expiresAt: "",
  });
  const [reminderSweepHours, setReminderSweepHours] = useState("24");
  const selectedAssociationId = activeAssociationId;

  const { data: persons } = useQuery<Person[]>({ queryKey: ["/api/persons"] });
  const { data: units } = useQuery<Unit[]>({
    queryKey: [selectedAssociationId ? `/api/units?associationId=${selectedAssociationId}` : "/api/units"],
    enabled: Boolean(selectedAssociationId),
  });
  const { data: templates } = useQuery<NoticeTemplate[]>({ queryKey: ["/api/communications/templates"] });
  const { data: history } = useQuery<CommunicationHistory[]>({ queryKey: ["/api/communications/history"] });
  const { data: pendingSends } = useQuery<NoticeSend[]>({
    queryKey: ["/api/communications/sends?status=pending-approval"],
  });
  const { data: scheduledSends } = useQuery<NoticeSend[]>({
    queryKey: ["/api/communications/sends?status=scheduled"],
  });
  const { data: readiness } = useQuery<{
    associationId: string;
    contactCoveragePercent: number;
    canSendNotices: boolean;
    blockingReasons: string[];
    activeOwners: number;
    activeOccupants: number;
    contactableOwners: number;
    contactableOccupants: number;
  }>({
    queryKey: [`/api/communications/readiness?associationId=${selectedAssociationId}`],
    enabled: Boolean(selectedAssociationId),
  });
  const { data: onboarding } = useQuery<{
    associationId: string;
    scorePercent: number;
    components: Record<string, { score: number; total: number; completed: number }>;
  }>({
    queryKey: [`/api/onboarding/completeness?associationId=${selectedAssociationId}`],
    enabled: Boolean(selectedAssociationId),
  });
  const { data: onboardingInvites } = useQuery<Array<OnboardingInvite & { unitLabel?: string; associationName?: string; inviteUrl?: string }>>({
    queryKey: [selectedAssociationId ? `/api/onboarding/invites?associationId=${selectedAssociationId}` : "/api/onboarding/invites"],
    enabled: Boolean(selectedAssociationId),
  });
  const { data: onboardingSubmissions } = useQuery<Array<OnboardingSubmission & { unitLabel?: string; associationName?: string; inviteEmail?: string | null }>>({
    queryKey: [selectedAssociationId ? `/api/onboarding/submissions?associationId=${selectedAssociationId}` : "/api/onboarding/submissions"],
    enabled: Boolean(selectedAssociationId),
  });
  const { data: contactUpdates } = useQuery<ContactUpdateRequest[]>({
    queryKey: [`/api/portal/contact-updates/admin?associationId=${selectedAssociationId}`],
    enabled: Boolean(selectedAssociationId),
  });
  const { data: maintenanceRequests } = useQuery<MaintenanceRequest[]>({
    queryKey: [`/api/maintenance/requests?associationId=${selectedAssociationId}`],
    enabled: Boolean(selectedAssociationId),
  });
  const toggleUnitSelection = (unitId: string, form: "targeted" | "payment") => {
    const updater = (current: string[]) => current.includes(unitId) ? current.filter((value) => value !== unitId) : [...current, unitId];
    if (form === "targeted") {
      setTargetedForm((prev) => ({ ...prev, selectedUnitIds: updater(prev.selectedUnitIds) }));
      return;
    }
    setPaymentInstructionForm((prev) => ({ ...prev, selectedUnitIds: updater(prev.selectedUnitIds) }));
  };

  useEffect(() => {
    setTemplateForm((prev) => ({ ...prev, associationId: activeAssociationId }));
    setSendForm((prev) => ({ ...prev, associationId: activeAssociationId }));
    setTargetedForm((prev) => ({ ...prev, associationId: activeAssociationId }));
    setPaymentInstructionForm((prev) => ({ ...prev, associationId: activeAssociationId }));
    setOnboardingInviteForm({
      unitId: "",
      residentType: "owner",
      email: "",
      phone: "",
      expiresAt: "",
    });
    setRecipientPreview(null);
  }, [activeAssociationId]);

  const createTemplate = useMutation({
    mutationFn: async () => {
      if (!templateForm.name || !templateForm.subjectTemplate || !templateForm.bodyTemplate) {
        throw new Error("Name, subject and body are required");
      }
      const res = await apiRequest("POST", "/api/communications/templates", {
        associationId: templateForm.associationId || null,
        name: templateForm.name,
        channel: "email",
        subjectTemplate: templateForm.subjectTemplate,
        headerTemplate: templateForm.headerTemplate || null,
        bodyTemplate: templateForm.bodyTemplate,
        footerTemplate: templateForm.footerTemplate || null,
        signatureTemplate: templateForm.signatureTemplate || null,
        isActive: 1,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/communications/templates"] });
      setTemplateOpen(false);
      setTemplateForm({ associationId: "", name: "", subjectTemplate: "", headerTemplate: "", bodyTemplate: "", footerTemplate: "", signatureTemplate: "" });
      toast({ title: "Template created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const seedStandardTemplates = useMutation({
    mutationFn: async () => {
      if (!selectedAssociationId) throw new Error("Association is required");
      const existingTemplateNames = new Set(
        (templates ?? [])
          .filter((row) => row.associationId === selectedAssociationId)
          .map((row) => row.name.trim().toLowerCase()),
      );
      const templatesToCreate = standardTemplateDefinitions.filter(
        (row) => !existingTemplateNames.has(row.name.trim().toLowerCase()),
      );
      await Promise.all(
        templatesToCreate.map((row) => apiRequest("POST", "/api/communications/templates", {
          associationId: selectedAssociationId,
          name: row.name,
          channel: "email",
          subjectTemplate: row.subjectTemplate,
          headerTemplate: row.headerTemplate,
          bodyTemplate: row.bodyTemplate,
          footerTemplate: row.footerTemplate,
          signatureTemplate: row.signatureTemplate,
          isActive: 1,
        })),
      );
      return {
        created: templatesToCreate.length,
        skipped: standardTemplateDefinitions.length - templatesToCreate.length,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/communications/templates"] });
      toast({
        title: "Standard templates synced",
        description: `Created ${result.created}, skipped ${result.skipped} already present template(s).`,
      });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const sendNotice = useMutation({
    mutationFn: async () => {
      if (!sendForm.recipientEmail) throw new Error("Recipient email is required");
      let variables: Record<string, string> = {};
      try {
        variables = JSON.parse(sendForm.variablesJson || "{}");
      } catch {
        throw new Error("Variables JSON is invalid");
      }
      const res = await apiRequest("POST", "/api/communications/send", {
        associationId: sendForm.associationId || null,
        templateId: sendForm.templateId || null,
        recipientEmail: sendForm.recipientEmail,
        recipientPersonId: sendForm.recipientPersonId || null,
        subject: sendForm.subject || null,
        body: sendForm.body || null,
        variables,
        requireApproval: sendForm.requireApproval,
        scheduledFor: sendForm.scheduledFor || null,
        bypassReadinessGate: sendForm.bypassReadinessGate,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/communications/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/communications/sends?status=pending-approval"] });
      queryClient.invalidateQueries({ queryKey: ["/api/communications/sends?status=scheduled"] });
      setSendForm((prev) => ({
        ...prev,
        recipientEmail: "",
        recipientPersonId: "",
        subject: "",
        body: "",
        requireApproval: false,
        scheduledFor: "",
        bypassReadinessGate: false,
      }));
      toast({ title: "Notice request recorded" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const approveSend = useMutation({
    mutationFn: async (payload: { id: string; decision: "approved" | "rejected" }) => {
      const res = await apiRequest("PATCH", `/api/communications/sends/${payload.id}/approval`, {
        decision: payload.decision,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/communications/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/communications/sends?status=pending-approval"] });
      queryClient.invalidateQueries({ queryKey: ["/api/communications/sends?status=scheduled"] });
      toast({ title: "Approval decision saved" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const runScheduled = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/communications/run-scheduled", {});
      return res.json() as Promise<{ processed: number }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/communications/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/communications/sends?status=scheduled"] });
      toast({ title: "Scheduled notices processed", description: `Processed ${result.processed} notice(s).` });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const previewRecipients = useMutation({
    mutationFn: async () => {
      if (!targetedForm.associationId) throw new Error("Association is required");
      const params = new URLSearchParams({
        associationId: targetedForm.associationId,
        targetType: targetedForm.targetType,
        selectedUnitAudience: targetedForm.selectedUnitAudience,
        messageClass: targetedForm.messageClass,
        ccOwners: targetedForm.ccOwners ? "1" : "0",
      });
      if (targetedForm.selectedUnitIds.length > 0) {
        params.set("selectedUnitIds", targetedForm.selectedUnitIds.join(","));
      }
      if (targetedForm.selectedPersonId) {
        params.set("selectedPersonId", targetedForm.selectedPersonId);
      }
      const res = await apiRequest("GET", `/api/communications/recipients/preview?${params.toString()}`);
      return res.json() as Promise<{
        recipients: Array<{ personId: string; email: string; role: "owner" | "tenant" | "board-member"; unitId: string }>;
        candidateCount: number;
        missingEmailCount: number;
        duplicateEmailCount: number;
        skippedRecipients: number;
      }>;
    },
    onSuccess: (result) => {
      setRecipientPreview(result);
      toast({
        title: "Recipient preview ready",
        description: `${result.recipients.length} deliverable, ${result.skippedRecipients} skipped.`,
      });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const sendTargeted = useMutation({
    mutationFn: async () => {
      if (!targetedForm.associationId) throw new Error("Association is required");
      let variables: Record<string, string> = {};
      try {
        variables = JSON.parse(targetedForm.variablesJson || "{}");
      } catch {
        throw new Error("Targeted variables JSON is invalid");
      }
      const res = await apiRequest("POST", "/api/communications/send-targeted", {
        associationId: targetedForm.associationId,
        targetType: targetedForm.targetType,
        selectedUnitAudience: targetedForm.selectedUnitAudience,
        selectedUnitIds: targetedForm.selectedUnitIds,
        selectedPersonId: targetedForm.selectedPersonId || null,
        messageClass: targetedForm.messageClass,
        ccOwners: targetedForm.ccOwners,
        templateId: targetedForm.templateId || null,
        subject: targetedForm.subject || null,
        body: targetedForm.body || null,
        variables,
        requireApproval: targetedForm.requireApproval,
        scheduledFor: targetedForm.scheduledFor || null,
        bypassReadinessGate: targetedForm.bypassReadinessGate,
      });
      return res.json() as Promise<{
        recipientCount: number;
        sentCount: number;
        skippedRecipients: number;
        missingEmailCount: number;
        duplicateEmailCount: number;
      }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/communications/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/communications/sends?status=pending-approval"] });
      queryClient.invalidateQueries({ queryKey: ["/api/communications/sends?status=scheduled"] });
      toast({
        title: "Targeted delivery created",
        description: `Prepared ${result.sentCount}/${result.recipientCount} sends, skipped ${result.skippedRecipients}.`,
      });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const reviewContactUpdate = useMutation({
    mutationFn: async (payload: { id: string; reviewStatus: "approved" | "rejected" }) => {
      const res = await apiRequest("PATCH", `/api/portal/contact-updates/${payload.id}/review`, {
        reviewStatus: payload.reviewStatus,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/portal/contact-updates/admin?associationId=${selectedAssociationId}`],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/persons"] });
      queryClient.invalidateQueries({ queryKey: [`/api/communications/readiness?associationId=${selectedAssociationId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/onboarding/completeness?associationId=${selectedAssociationId}`] });
      toast({ title: "Contact update reviewed" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createOnboardingInvite = useMutation({
    mutationFn: async () => {
      if (!selectedAssociationId) throw new Error("Association is required");
      if (!onboardingInviteForm.unitId) throw new Error("Unit is required");
      const res = await apiRequest("POST", "/api/onboarding/invites", {
        associationId: selectedAssociationId,
        unitId: onboardingInviteForm.unitId,
        residentType: onboardingInviteForm.residentType,
        email: onboardingInviteForm.email.trim() || null,
        phone: onboardingInviteForm.phone.trim() || null,
        deliveryChannel: "link",
        expiresAt: onboardingInviteForm.expiresAt ? new Date(onboardingInviteForm.expiresAt).toISOString() : null,
      });
      return res.json() as Promise<OnboardingInvite & { inviteUrl: string }>;
    },
    onSuccess: async (result) => {
      queryClient.invalidateQueries({
        queryKey: [selectedAssociationId ? `/api/onboarding/invites?associationId=${selectedAssociationId}` : "/api/onboarding/invites"],
      });
      setOnboardingInviteForm((prev) => ({
        ...prev,
        unitId: "",
        email: "",
        phone: "",
        expiresAt: "",
      }));
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(result.inviteUrl);
      }
      toast({ title: "Onboarding link created", description: "Invite URL copied to clipboard when supported." });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const reviewOnboardingSubmission = useMutation({
    mutationFn: async (payload: { id: string; decision: "approved" | "rejected" }) => {
      const res = await apiRequest("PATCH", `/api/onboarding/submissions/${payload.id}/review`, {
        decision: payload.decision,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [selectedAssociationId ? `/api/onboarding/submissions?associationId=${selectedAssociationId}` : "/api/onboarding/submissions"],
      });
      queryClient.invalidateQueries({
        queryKey: [selectedAssociationId ? `/api/onboarding/invites?associationId=${selectedAssociationId}` : "/api/onboarding/invites"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/persons"] });
      queryClient.invalidateQueries({ queryKey: ["/api/occupancies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ownerships"] });
      queryClient.invalidateQueries({ queryKey: ["/api/residential/dataset"] });
      queryClient.invalidateQueries({ queryKey: [`/api/communications/readiness?associationId=${selectedAssociationId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/onboarding/completeness?associationId=${selectedAssociationId}`] });
      toast({ title: "Onboarding submission reviewed" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const sendOnboardingInvite = useMutation({
    mutationFn: async (inviteId: string) => {
      const res = await apiRequest("POST", `/api/onboarding/invites/${inviteId}/send`, {});
      return res.json() as Promise<{ delivery: { status: "sent" | "failed"; errorMessage?: string | null } }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: [selectedAssociationId ? `/api/onboarding/invites?associationId=${selectedAssociationId}` : "/api/onboarding/invites"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/communications/history"] });
      toast({
        title: result.delivery.status === "sent" ? "Onboarding invite sent" : "Invite send failed",
        description: result.delivery.errorMessage || undefined,
        variant: result.delivery.status === "sent" ? "default" : "destructive",
      });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const runOnboardingReminderSweep = useMutation({
    mutationFn: async () => {
      if (!selectedAssociationId) throw new Error("Association is required");
      const res = await apiRequest("POST", "/api/onboarding/invites/reminders/run", {
        associationId: selectedAssociationId,
        olderThanHours: Number(reminderSweepHours || "24"),
      });
      return res.json() as Promise<{ processed: number; sent: number; failed: number }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: [selectedAssociationId ? `/api/onboarding/invites?associationId=${selectedAssociationId}` : "/api/onboarding/invites"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/communications/history"] });
      toast({
        title: "Reminder sweep complete",
        description: `Processed ${result.processed}, sent ${result.sent}, failed ${result.failed}.`,
      });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const onboardingMetrics = useMemo(() => {
    const invites = onboardingInvites ?? [];
    const submissions = onboardingSubmissions ?? [];
    const activeInvites = invites.filter((row) => row.status === "active").length;
    const submittedInvites = invites.filter((row) => row.status === "submitted").length;
    const approvedInvites = invites.filter((row) => row.status === "approved").length;
    const sentInvites = invites.filter((row) => Boolean(row.lastSentAt)).length;
    const pendingSubmissions = submissions.filter((row) => row.status === "pending").length;
    const approvedSubmissions = submissions.filter((row) => row.status === "approved").length;
    const rejectedSubmissions = submissions.filter((row) => row.status === "rejected").length;
    return {
      totalInvites: invites.length,
      activeInvites,
      submittedInvites,
      approvedInvites,
      sentInvites,
      pendingSubmissions,
      approvedSubmissions,
      rejectedSubmissions,
    };
  }, [onboardingInvites, onboardingSubmissions]);

  const updateMaintenanceStatus = useMutation({
    mutationFn: async (payload: { id: string; status: "triaged" | "in-progress" | "resolved" | "closed" | "rejected" }) => {
      const res = await apiRequest("PATCH", `/api/maintenance/requests/${payload.id}`, {
        status: payload.status,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/maintenance/requests?associationId=${selectedAssociationId}`],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/communications/history"] });
      toast({ title: "Maintenance request updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const runMaintenanceEscalations = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/maintenance/escalations/run", {
        associationId: selectedAssociationId || null,
      });
      return res.json() as Promise<{ processed: number; escalated: number }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: [`/api/maintenance/requests?associationId=${selectedAssociationId}`],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/communications/history"] });
      toast({
        title: "Escalation sweep complete",
        description: `Processed ${result.processed}, escalated ${result.escalated}.`,
      });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const sendPaymentInstructions = useMutation({
    mutationFn: async () => {
      if (!paymentInstructionForm.associationId) throw new Error("Association is required");
      const res = await apiRequest("POST", "/api/financial/payment-instructions/send", {
        associationId: paymentInstructionForm.associationId,
        templateId: paymentInstructionForm.templateId || null,
        targetType: paymentInstructionForm.targetType,
        selectedUnitIds: paymentInstructionForm.selectedUnitIds,
        selectedPersonId: paymentInstructionForm.selectedPersonId || null,
        ccOwners: paymentInstructionForm.ccOwners,
        subject: paymentInstructionForm.subject || null,
        body: paymentInstructionForm.body || null,
        requireApproval: paymentInstructionForm.requireApproval,
        scheduledFor: paymentInstructionForm.scheduledFor || null,
      });
      return res.json() as Promise<{
        recipientCount: number;
        sentCount: number;
        skippedRecipients: number;
      }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/communications/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/communications/sends?status=pending-approval"] });
      queryClient.invalidateQueries({ queryKey: ["/api/communications/sends?status=scheduled"] });
      toast({
        title: "Payment instructions queued",
        description: `Prepared ${result.sentCount}/${result.recipientCount} sends, skipped ${result.skippedRecipients}.`,
      });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const filteredHistory = history ?? [];

  return (
    <div className="p-6 space-y-6">
      <WorkspacePageHeader
        title="Communications"
        summary="Manage templates, sends, approvals, outreach readiness, and communication history inside the active association scope."
        eyebrow="Communications"
        breadcrumbs={[{ label: "Dashboard", href: "/app" }, { label: "Communications" }]}
        shortcuts={[
          { label: "Open Association Context", href: "/app/association-context" },
          { label: "Open Documents", href: "/app/documents" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => seedStandardTemplates.mutate()}
              disabled={seedStandardTemplates.isPending || !selectedAssociationId}
            >
              Load Standard Templates
            </Button>
            <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
              <DialogTrigger asChild><Button>New Template</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create Notice Template</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                    Association Context: <span className="font-medium">{activeAssociationName || "None selected"}</span>
                  </div>
                  <Input placeholder="Template name" value={templateForm.name} onChange={(e) => setTemplateForm((p) => ({ ...p, name: e.target.value }))} />
                  <Input placeholder="Subject template (e.g. Update for {{unit_number}})" value={templateForm.subjectTemplate} onChange={(e) => setTemplateForm((p) => ({ ...p, subjectTemplate: e.target.value }))} />
                  <Textarea rows={3} placeholder="Header block (optional)" value={templateForm.headerTemplate} onChange={(e) => setTemplateForm((p) => ({ ...p, headerTemplate: e.target.value }))} />
                  <Textarea rows={7} placeholder="Body template" value={templateForm.bodyTemplate} onChange={(e) => setTemplateForm((p) => ({ ...p, bodyTemplate: e.target.value }))} />
                  <Textarea rows={3} placeholder="Footer block (optional)" value={templateForm.footerTemplate} onChange={(e) => setTemplateForm((p) => ({ ...p, footerTemplate: e.target.value }))} />
                  <Textarea rows={2} placeholder="Signature block (optional)" value={templateForm.signatureTemplate} onChange={(e) => setTemplateForm((p) => ({ ...p, signatureTemplate: e.target.value }))} />
                  <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
                    Canonical variables: {`{{association_name}}`} {`{{association_address}}`} {`{{unit_number}}`} {`{{owner_name}}`} {`{{tenant_name}}`} {`{{maintenance_request_link}}`} {`{{owner_submission_link}}`} {`{{tenant_submission_link}}`}
                  </div>
                  <Button className="w-full" onClick={() => createTemplate.mutate()} disabled={createTemplate.isPending}>Save Template</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <AssociationScopeBanner
        activeAssociationId={activeAssociationId}
        activeAssociationName={activeAssociationName}
        explanation={
          activeAssociationId
            ? "Templates, sends, payment instructions, onboarding reminders, and outreach readiness all follow the active association context."
            : "Select an association before sending notices or reviewing communication readiness."
        }
      />

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant={workspacePanel === "delivery" ? "default" : "outline"} size="sm" onClick={() => setWorkspacePanel("delivery")}>Delivery Workspace</Button>
            <Button variant={workspacePanel === "onboarding" ? "default" : "outline"} size="sm" onClick={() => setWorkspacePanel("onboarding")}>Onboarding Workspace</Button>
            <Button variant={workspacePanel === "operations" ? "default" : "outline"} size="sm" onClick={() => setWorkspacePanel("operations")}>Operations Workspace</Button>
          </div>
        </CardContent>
      </Card>

      {workspacePanel === "delivery" ? (
        <>
      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Payment Registry Ownership</h2>
          <p className="text-sm text-muted-foreground">
            Payment method registry configuration has moved to the Finance module to keep communications focused on outreach workflows.
          </p>
          <Button asChild variant="outline">
            <Link href="/app/financial/payments">Open Finance Payments</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Send Payment Instructions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm flex items-center">
              Association Context: <span className="font-medium ml-1">{activeAssociationName || "None selected"}</span>
            </div>
            <Select value={paymentInstructionForm.templateId || "none"} onValueChange={(v) => setPaymentInstructionForm((p) => ({ ...p, templateId: v === "none" ? "" : v }))}>
              <SelectTrigger><SelectValue placeholder="Template (optional)" /></SelectTrigger>
              <SelectContent><SelectItem value="none">no template</SelectItem>{templates?.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={paymentInstructionForm.targetType} onValueChange={(v) => setPaymentInstructionForm((p) => ({ ...p, targetType: v as "all-owners" | "individual-owner" | "selected-units" }))}>
              <SelectTrigger><SelectValue placeholder="Target" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all-owners">All owners</SelectItem>
                <SelectItem value="individual-owner">Individual owner</SelectItem>
                <SelectItem value="selected-units">Selected units</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {paymentInstructionForm.targetType === "individual-owner" ? (
            <Select value={paymentInstructionForm.selectedPersonId || "none"} onValueChange={(v) => setPaymentInstructionForm((p) => ({ ...p, selectedPersonId: v === "none" ? "" : v }))}>
              <SelectTrigger><SelectValue placeholder="Select owner person" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">select owner</SelectItem>
                {(persons ?? []).map((person) => (
                  <SelectItem key={person.id} value={person.id}>{person.firstName} {person.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          {paymentInstructionForm.targetType === "selected-units" ? (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Select owner units</div>
              <div className="flex flex-wrap gap-2">
                {(units ?? []).slice(0, 24).map((unit) => (
                  <Button
                    key={unit.id}
                    type="button"
                    size="sm"
                    variant={paymentInstructionForm.selectedUnitIds.includes(unit.id) ? "default" : "outline"}
                    onClick={() => toggleUnitSelection(unit.id, "payment")}
                  >
                    Unit {unit.unitNumber}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
          <Input placeholder="Subject override (optional)" value={paymentInstructionForm.subject} onChange={(e) => setPaymentInstructionForm((p) => ({ ...p, subject: e.target.value }))} />
          <Textarea rows={4} placeholder="Body override (optional). Use {{payment_methods}}, {{payment_support_email}}, {{payment_support_phone}}, {{payment_mailing_address}}, or {{payment_zelle_handle}}." value={paymentInstructionForm.body} onChange={(e) => setPaymentInstructionForm((p) => ({ ...p, body: e.target.value }))} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input type="datetime-local" value={paymentInstructionForm.scheduledFor} onChange={(e) => setPaymentInstructionForm((p) => ({ ...p, scheduledFor: e.target.value }))} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={paymentInstructionForm.ccOwners} onChange={(e) => setPaymentInstructionForm((p) => ({ ...p, ccOwners: e.target.checked }))} />
              CC owners
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={paymentInstructionForm.requireApproval} onChange={(e) => setPaymentInstructionForm((p) => ({ ...p, requireApproval: e.target.checked }))} />
              Require approval
            </label>
          </div>
          <Button onClick={() => sendPaymentInstructions.mutate()} disabled={sendPaymentInstructions.isPending}>
            Send Payment Instructions
          </Button>
        </CardContent>
      </Card>
        </>
      ) : null}

      {workspacePanel === "onboarding" ? (
        <>
      <div className="rounded-md border bg-muted/20 px-4 py-3">
        <div className="text-sm font-medium">Onboarding and Intake</div>
        <div className="text-xs text-muted-foreground">Create invites, review submissions, and process resident contact updates.</div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-lg font-semibold">Association Readiness</h2>
            <Badge variant={readiness?.canSendNotices ? "secondary" : "destructive"}>
              {readiness?.canSendNotices ? "Ready to Send" : "Gate Blocking"}
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground">
            Select an association in Send or Targeted Delivery to evaluate readiness and onboarding completeness.
          </div>
          <div className="space-y-2">
            <div className="text-sm">Onboarding Completeness: {onboarding?.scorePercent ?? 0}%</div>
            <Progress value={onboarding?.scorePercent ?? 0} />
          </div>
          <div className="text-sm text-muted-foreground">
            Contact coverage: {readiness?.contactCoveragePercent ?? 0}% | Owners with contact: {readiness?.contactableOwners ?? 0}/{readiness?.activeOwners ?? 0} | Occupants with contact: {readiness?.contactableOccupants ?? 0}/{readiness?.activeOccupants ?? 0}
          </div>
          {!readiness?.canSendNotices && (readiness?.blockingReasons?.length ?? 0) > 0 ? (
            <div className="text-sm text-destructive">
              {readiness?.blockingReasons.join(" ")}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold">Unit-Linked Onboarding Links</h2>
              <div className="text-sm text-muted-foreground">
                Generate owner or tenant intake links bound to the current association and unit.
              </div>
            </div>
            <Badge variant="secondary">Invites: {(onboardingInvites ?? []).length}</Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">Sent: <span className="font-medium">{onboardingMetrics.sentInvites}</span></div>
            <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">Active: <span className="font-medium">{onboardingMetrics.activeInvites}</span></div>
            <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">Submitted: <span className="font-medium">{onboardingMetrics.pendingSubmissions + onboardingMetrics.approvedSubmissions + onboardingMetrics.rejectedSubmissions}</span></div>
            <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">Approved: <span className="font-medium">{onboardingMetrics.approvedSubmissions}</span></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <Select value={onboardingInviteForm.unitId || "none"} onValueChange={(v) => setOnboardingInviteForm((p) => ({ ...p, unitId: v === "none" ? "" : v }))}>
              <SelectTrigger><SelectValue placeholder="Unit" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">select unit</SelectItem>
                {(units ?? []).map((unit) => (
                  <SelectItem key={unit.id} value={unit.id}>Unit {unit.unitNumber}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={onboardingInviteForm.residentType} onValueChange={(v) => setOnboardingInviteForm((p) => ({ ...p, residentType: v as "owner" | "tenant" }))}>
              <SelectTrigger><SelectValue placeholder="Resident type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">Owner</SelectItem>
                <SelectItem value="tenant">Tenant</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Email (optional)" value={onboardingInviteForm.email} onChange={(e) => setOnboardingInviteForm((p) => ({ ...p, email: e.target.value }))} />
            <Input placeholder="Phone (optional)" value={onboardingInviteForm.phone} onChange={(e) => setOnboardingInviteForm((p) => ({ ...p, phone: e.target.value }))} />
            <Input type="datetime-local" value={onboardingInviteForm.expiresAt} onChange={(e) => setOnboardingInviteForm((p) => ({ ...p, expiresAt: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => createOnboardingInvite.mutate()} disabled={createOnboardingInvite.isPending || !selectedAssociationId}>
              Create Onboarding Link
            </Button>
            <Input
              className="max-w-[180px]"
              type="number"
              min="0"
              placeholder="Hours since last send"
              value={reminderSweepHours}
              onChange={(e) => setReminderSweepHours(e.target.value)}
            />
            <Button
              variant="outline"
              onClick={() => runOnboardingReminderSweep.mutate()}
              disabled={runOnboardingReminderSweep.isPending || !selectedAssociationId}
            >
              Run Reminder Sweep
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unit</TableHead>
                <TableHead>Resident</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Contact Target</TableHead>
                <TableHead>Last Sent</TableHead>
                <TableHead>Link</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(onboardingInvites ?? []).slice(0, 25).map((invite) => {
                const inviteUrl = typeof window === "undefined" ? `/onboarding/${invite.token}` : `${window.location.origin}/onboarding/${invite.token}`;
                return (
                  <TableRow key={invite.id}>
                    <TableCell>{invite.unitLabel ? `Unit ${invite.unitLabel}` : invite.unitId}</TableCell>
                    <TableCell className="capitalize">{invite.residentType}</TableCell>
                    <TableCell><Badge variant={invite.status === "active" ? "secondary" : "outline"}>{invite.status}</Badge></TableCell>
                    <TableCell>{invite.email || invite.phone || "-"}</TableCell>
                    <TableCell>{invite.lastSentAt ? new Date(invite.lastSentAt).toLocaleString() : "-"}</TableCell>
                    <TableCell className="max-w-[360px] truncate">
                      <button
                        type="button"
                        className="underline text-sm"
                        onClick={() => navigator?.clipboard?.writeText?.(inviteUrl)}
                      >
                        {inviteUrl}
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigator?.clipboard?.writeText?.(inviteUrl)}
                        >
                          Copy Link
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(inviteUrl, "_blank", "noopener,noreferrer")}
                        >
                          Open Link
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => sendOnboardingInvite.mutate(invite.id)}
                          disabled={sendOnboardingInvite.isPending || !invite.email}
                        >
                          {invite.lastSentAt ? "Resend" : "Send"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(onboardingInvites ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-muted-foreground">No onboarding links created yet.</TableCell></TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold">Onboarding Submission Queue</h2>
              <div className="text-sm text-muted-foreground">
                Review owner and tenant submissions before they create live records.
              </div>
            </div>
            <Badge variant="secondary">Pending: {(onboardingSubmissions ?? []).filter((row) => row.status === "pending").length}</Badge>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Submitted</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Resident</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(onboardingSubmissions ?? []).slice(0, 50).map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{new Date(row.submittedAt).toLocaleString()}</TableCell>
                  <TableCell>{row.unitLabel ? `Unit ${row.unitLabel}` : row.unitId}</TableCell>
                  <TableCell>{row.firstName} {row.lastName} · <span className="capitalize">{row.residentType}</span></TableCell>
                  <TableCell>{row.email || row.phone || row.inviteEmail || "-"}</TableCell>
                  <TableCell><Badge variant={row.status === "pending" ? "secondary" : "outline"}>{row.status}</Badge></TableCell>
                  <TableCell className="space-x-2">
                    <Button
                      size="sm"
                      onClick={() => reviewOnboardingSubmission.mutate({ id: row.id, decision: "approved" })}
                      disabled={reviewOnboardingSubmission.isPending || row.status !== "pending"}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => reviewOnboardingSubmission.mutate({ id: row.id, decision: "rejected" })}
                      disabled={reviewOnboardingSubmission.isPending || row.status !== "pending"}
                    >
                      Reject
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(onboardingSubmissions ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-muted-foreground">No onboarding submissions yet.</TableCell></TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
        </>
      ) : null}

      {workspacePanel === "delivery" ? (
        <>
      <div className="rounded-md border bg-muted/20 px-4 py-3">
        <div className="text-sm font-medium">Notices and Targeted Outreach</div>
        <div className="text-xs text-muted-foreground">Prepare one-off notices, run targeted sends, and manage approval queues.</div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Send Notice</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm flex items-center">
              Association Context: <span className="font-medium ml-1">{activeAssociationName || "None selected"}</span>
            </div>
            <Select value={sendForm.templateId || "none"} onValueChange={(v) => {
              const templateId = v === "none" ? "" : v;
              const t = (templates ?? []).find((x) => x.id === templateId);
              setSendForm((p) => ({ ...p, templateId, subject: t?.subjectTemplate || "", body: t?.bodyTemplate || "" }));
            }}>
              <SelectTrigger><SelectValue placeholder="Template" /></SelectTrigger>
              <SelectContent><SelectItem value="none">no template</SelectItem>{templates?.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Recipient email" value={sendForm.recipientEmail} onChange={(e) => setSendForm((p) => ({ ...p, recipientEmail: e.target.value }))} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select value={sendForm.recipientPersonId || "none"} onValueChange={(v) => setSendForm((p) => ({ ...p, recipientPersonId: v === "none" ? "" : v }))}>
              <SelectTrigger><SelectValue placeholder="Optional recipient person" /></SelectTrigger>
              <SelectContent><SelectItem value="none">none</SelectItem>{persons?.map((p) => <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Variables JSON" value={sendForm.variablesJson} onChange={(e) => setSendForm((p) => ({ ...p, variablesJson: e.target.value }))} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              type="datetime-local"
              value={sendForm.scheduledFor}
              onChange={(e) => setSendForm((p) => ({ ...p, scheduledFor: e.target.value }))}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={sendForm.requireApproval}
                onChange={(e) => setSendForm((p) => ({ ...p, requireApproval: e.target.checked }))}
              />
              Require approval before dispatch
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={sendForm.bypassReadinessGate}
              onChange={(e) => setSendForm((p) => ({ ...p, bypassReadinessGate: e.target.checked }))}
            />
            Bypass readiness gate for this send
          </label>
          <Input placeholder="Subject" value={sendForm.subject} onChange={(e) => setSendForm((p) => ({ ...p, subject: e.target.value }))} />
          <Textarea rows={6} placeholder="Body" value={sendForm.body} onChange={(e) => setSendForm((p) => ({ ...p, body: e.target.value }))} />
          <Button onClick={() => sendNotice.mutate()} disabled={sendNotice.isPending}>Send Notice</Button>
        </CardContent>
      </Card>
        </>
      ) : null}

      {workspacePanel === "operations" ? (
      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Targeted Delivery</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm flex items-center">
              Association Context: <span className="font-medium ml-1">{activeAssociationName || "None selected"}</span>
            </div>
            <Select
              value={targetedForm.targetType}
              onValueChange={(v) => setTargetedForm((p) => ({ ...p, targetType: v as "all-owners" | "all-tenants" | "all-occupants" | "selected-units" | "individual-owner" | "individual-tenant" | "board-members" }))}
            >
              <SelectTrigger><SelectValue placeholder="Target type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all-owners">All owners</SelectItem>
                <SelectItem value="all-tenants">All tenants</SelectItem>
                <SelectItem value="all-occupants">All occupants</SelectItem>
                <SelectItem value="selected-units">Selected units</SelectItem>
                <SelectItem value="individual-owner">Individual owner</SelectItem>
                <SelectItem value="individual-tenant">Individual tenant</SelectItem>
                <SelectItem value="board-members">Board members</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={targetedForm.messageClass}
              onValueChange={(v) => setTargetedForm((p) => ({ ...p, messageClass: v as "general" | "operational" | "maintenance" | "financial" | "governance" }))}
            >
              <SelectTrigger><SelectValue placeholder="Message class" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="operational">Operational</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="financial">Financial</SelectItem>
                <SelectItem value="governance">Governance</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(targetedForm.targetType === "individual-owner" || targetedForm.targetType === "individual-tenant") ? (
            <Select value={targetedForm.selectedPersonId || "none"} onValueChange={(v) => setTargetedForm((p) => ({ ...p, selectedPersonId: v === "none" ? "" : v }))}>
              <SelectTrigger><SelectValue placeholder="Select person" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">select person</SelectItem>
                {(persons ?? []).map((person) => (
                  <SelectItem key={person.id} value={person.id}>{person.firstName} {person.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          {targetedForm.targetType === "selected-units" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Select
                value={targetedForm.selectedUnitAudience}
                onValueChange={(v) => setTargetedForm((p) => ({ ...p, selectedUnitAudience: v as "owners" | "tenants" | "occupants" | "all" }))}
              >
                <SelectTrigger><SelectValue placeholder="Selected unit audience" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Owners and tenants</SelectItem>
                  <SelectItem value="owners">Owners only</SelectItem>
                  <SelectItem value="tenants">Tenants only</SelectItem>
                  <SelectItem value="occupants">Current occupants</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-sm text-muted-foreground flex items-center">
                Selected units: {targetedForm.selectedUnitIds.length}
              </div>
            </div>
          ) : null}
          {targetedForm.targetType === "selected-units" ? (
            <div className="flex flex-wrap gap-2">
              {(units ?? []).slice(0, 24).map((unit) => (
                <Button
                  key={unit.id}
                  type="button"
                  size="sm"
                  variant={targetedForm.selectedUnitIds.includes(unit.id) ? "default" : "outline"}
                  onClick={() => toggleUnitSelection(unit.id, "targeted")}
                >
                  Unit {unit.unitNumber}
                </Button>
              ))}
            </div>
          ) : null}
          <div className="grid grid-cols-1 md:grid-cols-1 gap-3">
            <Select
              value={targetedForm.templateId || "none"}
              onValueChange={(v) => {
                const templateId = v === "none" ? "" : v;
                const t = (templates ?? []).find((x) => x.id === templateId);
                setTargetedForm((p) => ({ ...p, templateId, subject: t?.subjectTemplate || p.subject, body: t?.bodyTemplate || p.body }));
              }}
            >
              <SelectTrigger><SelectValue placeholder="Template" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">no template</SelectItem>
                {templates?.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input placeholder="Subject override (optional)" value={targetedForm.subject} onChange={(e) => setTargetedForm((p) => ({ ...p, subject: e.target.value }))} />
            <Input placeholder="Variables JSON" value={targetedForm.variablesJson} onChange={(e) => setTargetedForm((p) => ({ ...p, variablesJson: e.target.value }))} />
          </div>
          <Textarea rows={4} placeholder="Body override (optional)" value={targetedForm.body} onChange={(e) => setTargetedForm((p) => ({ ...p, body: e.target.value }))} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input
              type="datetime-local"
              value={targetedForm.scheduledFor}
              onChange={(e) => setTargetedForm((p) => ({ ...p, scheduledFor: e.target.value }))}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={targetedForm.ccOwners}
                onChange={(e) => setTargetedForm((p) => ({ ...p, ccOwners: e.target.checked }))}
              />
              CC owners
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={targetedForm.requireApproval}
                onChange={(e) => setTargetedForm((p) => ({ ...p, requireApproval: e.target.checked }))}
              />
              Require approval
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={targetedForm.bypassReadinessGate}
              onChange={(e) => setTargetedForm((p) => ({ ...p, bypassReadinessGate: e.target.checked }))}
            />
            Bypass readiness gate for this send
          </label>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => previewRecipients.mutate()} disabled={previewRecipients.isPending}>
              Preview Recipients
            </Button>
            <Button onClick={() => sendTargeted.mutate()} disabled={sendTargeted.isPending}>
              Send Targeted
            </Button>
          </div>
          <div className="text-sm text-muted-foreground">
            Deliverable recipients: {recipientPreview?.recipients.length ?? 0} / {recipientPreview?.candidateCount ?? 0}
            {" "} | Missing email: {recipientPreview?.missingEmailCount ?? 0}
            {" "} | Duplicate email: {recipientPreview?.duplicateEmailCount ?? 0}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Unit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(recipientPreview?.recipients ?? []).slice(0, 25).map((row) => (
                <TableRow key={`${row.email}-${row.unitId}`}>
                  <TableCell>{row.email}</TableCell>
                  <TableCell>{row.role}</TableCell>
                  <TableCell>{row.unitId}</TableCell>
                </TableRow>
              ))}
              {!recipientPreview ? (
                <TableRow><TableCell colSpan={3} className="text-muted-foreground">No preview run yet.</TableCell></TableRow>
              ) : recipientPreview.recipients.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-muted-foreground">No deliverable recipients matched the current targeting rules.</TableCell></TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      ) : null}

      {workspacePanel === "delivery" ? (
        <>
      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Contact Update Review Queue</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Created</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Requested Changes</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(contactUpdates ?? []).filter((row) => row.reviewStatus === "pending").map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{new Date(row.createdAt).toLocaleString()}</TableCell>
                  <TableCell><Badge variant="secondary">{row.reviewStatus}</Badge></TableCell>
                  <TableCell className="max-w-[520px] truncate">{JSON.stringify(row.requestJson)}</TableCell>
                  <TableCell className="space-x-2">
                    <Button
                      size="sm"
                      onClick={() => reviewContactUpdate.mutate({ id: row.id, reviewStatus: "approved" })}
                      disabled={reviewContactUpdate.isPending}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => reviewContactUpdate.mutate({ id: row.id, reviewStatus: "rejected" })}
                      disabled={reviewContactUpdate.isPending}
                    >
                      Reject
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(contactUpdates ?? []).filter((row) => row.reviewStatus === "pending").length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-muted-foreground">No pending contact updates.</TableCell></TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-lg font-semibold">Maintenance Intake Queue</h2>
            <Button variant="outline" onClick={() => runMaintenanceEscalations.mutate()} disabled={runMaintenanceEscalations.isPending}>
              Run SLA Escalations
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Created</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>SLA Due</TableHead>
                <TableHead>Escalation</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(maintenanceRequests ?? []).slice(0, 100).map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{new Date(row.createdAt).toLocaleString()}</TableCell>
                  <TableCell>{row.title}</TableCell>
                  <TableCell><Badge variant="secondary">{row.status}</Badge></TableCell>
                  <TableCell>{row.priority}</TableCell>
                  <TableCell>{row.responseDueAt ? new Date(row.responseDueAt).toLocaleString() : "-"}</TableCell>
                  <TableCell>{row.escalationStage}</TableCell>
                  <TableCell className="space-x-2">
                    <Button size="sm" variant="outline" onClick={() => updateMaintenanceStatus.mutate({ id: row.id, status: "triaged" })} disabled={updateMaintenanceStatus.isPending}>Triage</Button>
                    <Button size="sm" variant="outline" onClick={() => updateMaintenanceStatus.mutate({ id: row.id, status: "in-progress" })} disabled={updateMaintenanceStatus.isPending}>In Progress</Button>
                    <Button size="sm" onClick={() => updateMaintenanceStatus.mutate({ id: row.id, status: "resolved" })} disabled={updateMaintenanceStatus.isPending}>Resolve</Button>
                    <Button size="sm" variant="destructive" onClick={() => updateMaintenanceStatus.mutate({ id: row.id, status: "rejected" })} disabled={updateMaintenanceStatus.isPending}>Reject</Button>
                  </TableCell>
                </TableRow>
              ))}
              {(maintenanceRequests ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-muted-foreground">No maintenance requests yet.</TableCell></TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Dispatch Queue</h2>
            <Button variant="outline" onClick={() => runScheduled.mutate()} disabled={runScheduled.isPending}>
              Run Scheduled Notices
            </Button>
          </div>
          <div className="text-sm text-muted-foreground">
            Pending approvals: {(pendingSends ?? []).length} | Scheduled: {(scheduledSends ?? []).length}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Dispatch At</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(pendingSends ?? []).map((row) => (
                <TableRow key={row.id}>
                  <TableCell><Badge variant="secondary">{row.status}</Badge></TableCell>
                  <TableCell>{row.recipientEmail}</TableCell>
                  <TableCell>{row.subjectRendered}</TableCell>
                  <TableCell>{new Date(row.sentAt).toLocaleString()}</TableCell>
                  <TableCell className="space-x-2">
                    <Button
                      size="sm"
                      onClick={() => approveSend.mutate({ id: row.id, decision: "approved" })}
                      disabled={approveSend.isPending}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => approveSend.mutate({ id: row.id, decision: "rejected" })}
                      disabled={approveSend.isPending}
                    >
                      Reject
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(scheduledSends ?? []).slice(0, 20).map((row) => (
                <TableRow key={row.id}>
                  <TableCell><Badge variant="outline">{row.status}</Badge></TableCell>
                  <TableCell>{row.recipientEmail}</TableCell>
                  <TableCell>{row.subjectRendered}</TableCell>
                  <TableCell>{new Date(row.sentAt).toLocaleString()}</TableCell>
                  <TableCell className="text-muted-foreground">Scheduled</TableCell>
                </TableRow>
              ))}
              {(pendingSends ?? []).length === 0 ? (
                (scheduledSends ?? []).length === 0 ? <TableRow><TableCell colSpan={5} className="text-muted-foreground">No pending approvals or scheduled notices.</TableCell></TableRow> : null
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b">
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm max-w-sm">
              Association Context: <span className="font-medium">{activeAssociationName || "None selected"}</span>
            </div>
          </div>
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Channel</TableHead><TableHead>Recipient</TableHead><TableHead>Subject</TableHead><TableHead>Related</TableHead></TableRow></TableHeader>
            <TableBody>
              {filteredHistory.map((h) => (
                <TableRow key={h.id}>
                  <TableCell>{new Date(h.createdAt).toLocaleString()}</TableCell>
                  <TableCell><Badge variant="secondary">{h.channel}</Badge></TableCell>
                  <TableCell>{h.recipientEmail || "-"}</TableCell>
                  <TableCell>{h.subject || "-"}</TableCell>
                  <TableCell>{h.relatedType || "-"} {h.relatedId || ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
        </>
      ) : null}
    </div>
  );
}
