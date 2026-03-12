import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type {
  Association,
  CommunicationHistory,
  ContactUpdateRequest,
  MaintenanceRequest,
  NoticeSend,
  NoticeTemplate,
  PaymentMethodConfig,
  Person,
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

export default function CommunicationsPage() {
  const { toast } = useToast();
  const [templateOpen, setTemplateOpen] = useState(false);
  const [recipientPreview, setRecipientPreview] = useState<{
    recipients: Array<{ personId: string; email: string; role: "owner" | "occupant"; unitId: string }>;
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
    bodyTemplate: "",
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
    audience: "all" as "owners" | "occupants" | "all",
    ccOwners: false,
    templateId: "",
    subject: "",
    body: "",
    variablesJson: "{}",
    requireApproval: false,
    scheduledFor: "",
    bypassReadinessGate: false,
  });
  const [paymentMethodForm, setPaymentMethodForm] = useState({
    associationId: "",
    methodType: "other",
    displayName: "",
    instructions: "",
    supportEmail: "",
    supportPhone: "",
    displayOrder: 0,
  });
  const [paymentInstructionForm, setPaymentInstructionForm] = useState({
    associationId: "",
    templateId: "",
    audience: "owners" as "owners" | "occupants" | "all",
    ccOwners: false,
    subject: "",
    body: "",
    requireApproval: false,
    scheduledFor: "",
  });
  const selectedAssociationId = activeAssociationId;

  const { data: associations } = useQuery<Association[]>({ queryKey: ["/api/associations"] });
  const { data: persons } = useQuery<Person[]>({ queryKey: ["/api/persons"] });
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
  const { data: contactUpdates } = useQuery<ContactUpdateRequest[]>({
    queryKey: [selectedAssociationId ? `/api/portal/contact-updates/admin?associationId=${selectedAssociationId}` : "/api/portal/contact-updates/admin"],
  });
  const { data: maintenanceRequests } = useQuery<MaintenanceRequest[]>({
    queryKey: [selectedAssociationId ? `/api/maintenance/requests?associationId=${selectedAssociationId}` : "/api/maintenance/requests"],
  });
  const { data: paymentMethods } = useQuery<PaymentMethodConfig[]>({
    queryKey: [selectedAssociationId ? `/api/financial/payment-methods?associationId=${selectedAssociationId}` : "/api/financial/payment-methods"],
  });
  const associationNameById = useMemo(() => {
    return new Map((associations ?? []).map((association) => [association.id, association.name]));
  }, [associations]);

  useEffect(() => {
    setTemplateForm((prev) => ({ ...prev, associationId: activeAssociationId }));
    setSendForm((prev) => ({ ...prev, associationId: activeAssociationId }));
    setTargetedForm((prev) => ({ ...prev, associationId: activeAssociationId }));
    setPaymentMethodForm((prev) => ({ ...prev, associationId: activeAssociationId }));
    setPaymentInstructionForm((prev) => ({ ...prev, associationId: activeAssociationId }));
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
        bodyTemplate: templateForm.bodyTemplate,
        isActive: 1,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/communications/templates"] });
      setTemplateOpen(false);
      setTemplateForm({ associationId: "", name: "", subjectTemplate: "", bodyTemplate: "" });
      toast({ title: "Template created" });
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
        audience: targetedForm.audience,
        ccOwners: targetedForm.ccOwners ? "1" : "0",
      });
      const res = await apiRequest("GET", `/api/communications/recipients/preview?${params.toString()}`);
      return res.json() as Promise<{
        recipients: Array<{ personId: string; email: string; role: "owner" | "occupant"; unitId: string }>;
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
        audience: targetedForm.audience,
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
        queryKey: [selectedAssociationId ? `/api/portal/contact-updates/admin?associationId=${selectedAssociationId}` : "/api/portal/contact-updates/admin"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/persons"] });
      queryClient.invalidateQueries({ queryKey: [`/api/communications/readiness?associationId=${selectedAssociationId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/onboarding/completeness?associationId=${selectedAssociationId}`] });
      toast({ title: "Contact update reviewed" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMaintenanceStatus = useMutation({
    mutationFn: async (payload: { id: string; status: "triaged" | "in-progress" | "resolved" | "closed" | "rejected" }) => {
      const res = await apiRequest("PATCH", `/api/maintenance/requests/${payload.id}`, {
        status: payload.status,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [selectedAssociationId ? `/api/maintenance/requests?associationId=${selectedAssociationId}` : "/api/maintenance/requests"],
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
        queryKey: [selectedAssociationId ? `/api/maintenance/requests?associationId=${selectedAssociationId}` : "/api/maintenance/requests"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/communications/history"] });
      toast({
        title: "Escalation sweep complete",
        description: `Processed ${result.processed}, escalated ${result.escalated}.`,
      });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createPaymentMethod = useMutation({
    mutationFn: async () => {
      if (!paymentMethodForm.associationId) throw new Error("Association is required");
      if (!paymentMethodForm.displayName.trim() || !paymentMethodForm.instructions.trim()) {
        throw new Error("Display name and instructions are required");
      }
      const res = await apiRequest("POST", "/api/financial/payment-methods", {
        associationId: paymentMethodForm.associationId,
        methodType: paymentMethodForm.methodType,
        displayName: paymentMethodForm.displayName.trim(),
        instructions: paymentMethodForm.instructions.trim(),
        supportEmail: paymentMethodForm.supportEmail.trim() || null,
        supportPhone: paymentMethodForm.supportPhone.trim() || null,
        isActive: 1,
        displayOrder: Number(paymentMethodForm.displayOrder) || 0,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [selectedAssociationId ? `/api/financial/payment-methods?associationId=${selectedAssociationId}` : "/api/financial/payment-methods"],
      });
      setPaymentMethodForm({
        associationId: paymentMethodForm.associationId,
        methodType: "other",
        displayName: "",
        instructions: "",
        supportEmail: "",
        supportPhone: "",
        displayOrder: 0,
      });
      toast({ title: "Payment method saved" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const sendPaymentInstructions = useMutation({
    mutationFn: async () => {
      if (!paymentInstructionForm.associationId) throw new Error("Association is required");
      const res = await apiRequest("POST", "/api/financial/payment-instructions/send", {
        associationId: paymentInstructionForm.associationId,
        templateId: paymentInstructionForm.templateId || null,
        audience: paymentInstructionForm.audience,
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
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Communications</h1>
          <p className="text-muted-foreground">Manage notice templates, send emails, and audit communication history.</p>
        </div>
        <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
          <DialogTrigger asChild><Button>New Template</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Notice Template</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                Association Context: <span className="font-medium">{activeAssociationName || "None selected"}</span>
              </div>
              <Input placeholder="Template name" value={templateForm.name} onChange={(e) => setTemplateForm((p) => ({ ...p, name: e.target.value }))} />
              <Input placeholder="Subject template (e.g. Notice for {{unit}})" value={templateForm.subjectTemplate} onChange={(e) => setTemplateForm((p) => ({ ...p, subjectTemplate: e.target.value }))} />
              <Textarea rows={7} placeholder="Body template" value={templateForm.bodyTemplate} onChange={(e) => setTemplateForm((p) => ({ ...p, bodyTemplate: e.target.value }))} />
              <Button className="w-full" onClick={() => createTemplate.mutate()} disabled={createTemplate.isPending}>Save Template</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Payment Method Registry</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm flex items-center">
              Association Context: <span className="font-medium ml-1">{activeAssociationName || "None selected"}</span>
            </div>
            <Input placeholder="Method type (ach/card/check/other)" value={paymentMethodForm.methodType} onChange={(e) => setPaymentMethodForm((p) => ({ ...p, methodType: e.target.value }))} />
            <Input placeholder="Display name" value={paymentMethodForm.displayName} onChange={(e) => setPaymentMethodForm((p) => ({ ...p, displayName: e.target.value }))} />
          </div>
          <Textarea placeholder="Instructions for owners" rows={3} value={paymentMethodForm.instructions} onChange={(e) => setPaymentMethodForm((p) => ({ ...p, instructions: e.target.value }))} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input placeholder="Support email" value={paymentMethodForm.supportEmail} onChange={(e) => setPaymentMethodForm((p) => ({ ...p, supportEmail: e.target.value }))} />
            <Input placeholder="Support phone" value={paymentMethodForm.supportPhone} onChange={(e) => setPaymentMethodForm((p) => ({ ...p, supportPhone: e.target.value }))} />
            <Input type="number" placeholder="Display order" value={String(paymentMethodForm.displayOrder)} onChange={(e) => setPaymentMethodForm((p) => ({ ...p, displayOrder: Number(e.target.value) || 0 }))} />
          </div>
          <Button onClick={() => createPaymentMethod.mutate()} disabled={createPaymentMethod.isPending}>Save Payment Method</Button>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Association</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Display Name</TableHead>
                <TableHead>Instructions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(paymentMethods ?? []).slice(0, 30).map((row) => (
                  <TableRow key={row.id}>
                  <TableCell>{associationNameById.get(row.associationId) || row.associationId}</TableCell>
                  <TableCell>{row.methodType}</TableCell>
                  <TableCell>{row.displayName}</TableCell>
                  <TableCell className="max-w-[480px] truncate">{row.instructions}</TableCell>
                </TableRow>
              ))}
              {(paymentMethods ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-muted-foreground">No payment methods configured.</TableCell></TableRow>
              ) : null}
            </TableBody>
          </Table>
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
            <Select value={paymentInstructionForm.audience} onValueChange={(v) => setPaymentInstructionForm((p) => ({ ...p, audience: v as "owners" | "occupants" | "all" }))}>
              <SelectTrigger><SelectValue placeholder="Audience" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="owners">owners</SelectItem>
                <SelectItem value="occupants">occupants</SelectItem>
                <SelectItem value="all">all</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Input placeholder="Subject override (optional)" value={paymentInstructionForm.subject} onChange={(e) => setPaymentInstructionForm((p) => ({ ...p, subject: e.target.value }))} />
          <Textarea rows={4} placeholder="Body override (optional). Use {{payment_methods}} token." value={paymentInstructionForm.body} onChange={(e) => setPaymentInstructionForm((p) => ({ ...p, body: e.target.value }))} />
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

      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Targeted Delivery</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm flex items-center">
              Association Context: <span className="font-medium ml-1">{activeAssociationName || "None selected"}</span>
            </div>
            <Select
              value={targetedForm.audience}
              onValueChange={(v) => setTargetedForm((p) => ({ ...p, audience: v as "owners" | "occupants" | "all" }))}
            >
              <SelectTrigger><SelectValue placeholder="Audience" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">all</SelectItem>
                <SelectItem value="owners">owners</SelectItem>
                <SelectItem value="occupants">occupants</SelectItem>
              </SelectContent>
            </Select>
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
                <TableRow><TableCell colSpan={3} className="text-muted-foreground">No deliverable recipients matched the current audience.</TableCell></TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
    </div>
  );
}
