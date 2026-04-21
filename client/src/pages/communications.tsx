// zone: Communications
// persona: Manager, Board Officer, Assisted Board, PM Assistant
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUserSettings, formatSettingsDate } from "@/hooks/use-user-settings";
import type {
  CommunicationHistory,
  ContactUpdateRequest,
  MaintenanceRequest,
  NoticeSend,
  NoticeTemplate,
  OnboardingInvite,
  OnboardingSubmission,
  PaymentReminderRule,
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
import { boardGovernanceSubPages } from "@/lib/sub-page-nav";
import { AssociationScopeBanner } from "@/components/association-scope-banner";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { ChevronDown, ChevronUp, AlertTriangle, Zap } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnnouncementsContent } from "./announcements";

const standardTemplateDefinitions = [
  // Payments & Finance
  {
    name: "Payment Instructions - Standard",
    subjectTemplate: "Payment Instructions for {{association_name}}",
    headerTemplate: null,
    bodyTemplate: "Hello {{recipient_name}},\n\nPlease use the approved payment methods below for your account at {{association_name}}.\n\n{{payment_methods}}\n\nIf you have questions, contact {{payment_support_email}} or {{payment_support_phone}}.\n\nThank you,\n{{association_name}}",
    footerTemplate: "This notice applies to {{unit_label}}.",
    signatureTemplate: "{{association_name}} Management",
  },
  {
    name: "Payment Reminder - 1st Notice",
    subjectTemplate: "Friendly Reminder: {{association_name}} Assessment Due",
    headerTemplate: null,
    bodyTemplate: "Hello {{recipient_name}},\n\nThis is a friendly reminder that your HOA assessment for {{unit_label}} is due. Please submit your payment at your earliest convenience to avoid late fees.\n\nIf you believe this is in error or have already paid, please disregard this message.\n\nThank you for being part of our community.\n{{association_name}}",
    footerTemplate: "{{unit_label}} · {{association_name}}",
    signatureTemplate: "{{association_name}} Finance Team",
  },
  {
    name: "Payment Reminder - 2nd Notice (Past Due)",
    subjectTemplate: "Past Due Notice: {{association_name}} Assessment",
    headerTemplate: "PAST DUE NOTICE",
    bodyTemplate: "Dear {{recipient_name}},\n\nOur records indicate that your HOA assessment for {{unit_label}} is past due. A late fee may have been applied to your account.\n\nPlease remit payment as soon as possible or contact us to discuss a payment plan. Continued non-payment may result in collection action.\n\n{{payment_methods}}\n\n{{association_name}}",
    footerTemplate: "{{unit_label}} · {{association_name}}",
    signatureTemplate: "{{association_name}} Finance Team",
  },
  {
    name: "Special Assessment Notice",
    subjectTemplate: "Special Assessment Notice — {{association_name}}",
    headerTemplate: "SPECIAL ASSESSMENT NOTICE",
    bodyTemplate: "Dear {{recipient_name}},\n\nThe Board of Directors of {{association_name}} has approved a special assessment for necessary capital improvements or unexpected expenses affecting the community.\n\nAssessment amount: [AMOUNT]\nDue date: [DUE DATE]\nPurpose: [DESCRIPTION OF WORK/EXPENSE]\n\nThis assessment is authorized under the association governing documents. Payment instructions will follow separately.\n\nIf you have questions, please contact the management office.\n\n{{association_name}} Board of Directors",
    footerTemplate: "{{unit_label}} · {{association_name}}",
    signatureTemplate: "{{association_name}} Board",
  },
  // Governance & Meetings
  {
    name: "Annual Meeting Notice",
    subjectTemplate: "Annual Meeting Notice — {{association_name}}",
    headerTemplate: "ANNUAL MEETING NOTICE",
    bodyTemplate: "Dear {{recipient_name}},\n\nYou are hereby notified that the Annual Meeting of {{association_name}} will be held as follows:\n\nDate: [DATE]\nTime: [TIME]\nLocation: [LOCATION]\n\nAgenda items include: election of board members, review of financial statements, and any business properly brought before the membership.\n\nProxy forms are available upon request. Quorum requires [QUORUM PERCENTAGE]% of voting interests.\n\n{{association_name}} Board of Directors",
    footerTemplate: "{{unit_label}} · {{association_name}}",
    signatureTemplate: "{{association_name}} Board",
  },
  {
    name: "Board Meeting Notice - Standard",
    subjectTemplate: "Board Meeting Notice — {{association_name}}",
    headerTemplate: null,
    bodyTemplate: "Dear {{recipient_name}},\n\nNotice is hereby given that a meeting of the Board of Directors of {{association_name}} will be held:\n\nDate: [DATE]\nTime: [TIME]\nLocation: [LOCATION]\n\nAgenda items will be posted at the community notice board 48 hours in advance. Owners may attend to observe.\n\n{{association_name}} Board of Directors",
    footerTemplate: "{{unit_label}}",
    signatureTemplate: "{{association_name}} Board",
  },
  {
    name: "Meeting Minutes Distribution",
    subjectTemplate: "Meeting Minutes — {{association_name}} [MONTH YEAR]",
    headerTemplate: null,
    bodyTemplate: "Dear {{recipient_name}},\n\nThe approved minutes from the [MONTH YEAR] Board Meeting of {{association_name}} are now available. You may review them in your resident portal under Meeting Documents.\n\nKey decisions from this meeting included:\n[LIST KEY DECISIONS]\n\nIf you have questions about any agenda item, please contact the management office.\n\n{{association_name}}",
    footerTemplate: null,
    signatureTemplate: "{{association_name}} Secretary",
  },
  // Maintenance & Operations
  {
    name: "Maintenance Update - Status Notice",
    subjectTemplate: "Maintenance Update — {{unit_label}}",
    headerTemplate: null,
    bodyTemplate: "Hello {{recipient_name}},\n\nWe are providing an update regarding the maintenance request submitted for {{unit_label}}.\n\nRequest: [DESCRIPTION]\nCurrent Status: [STATUS]\nExpected Completion: [DATE]\n\nFor full details, visit your resident portal: {{maintenance_request_link}}\n\nThank you for your patience.\n{{association_name}}",
    footerTemplate: null,
    signatureTemplate: "{{association_name}} Operations",
  },
  {
    name: "Planned Maintenance Notice",
    subjectTemplate: "Upcoming Maintenance — {{association_name}}",
    headerTemplate: null,
    bodyTemplate: "Dear {{recipient_name}},\n\nPlanned maintenance will be performed in your community as follows:\n\nDate(s): [DATE RANGE]\nArea(s) Affected: [LOCATIONS]\nNature of Work: [DESCRIPTION]\nVendor: [VENDOR NAME]\n\nWe apologize for any inconvenience. Please plan accordingly. If you have specific concerns, contact [CONTACT INFO].\n\n{{association_name}} Management",
    footerTemplate: "{{association_name}}",
    signatureTemplate: "{{association_name}} Management",
  },
  {
    name: "Emergency Maintenance Alert",
    subjectTemplate: "URGENT: Emergency Maintenance — {{association_name}}",
    headerTemplate: "EMERGENCY NOTICE",
    bodyTemplate: "Dear {{recipient_name}},\n\nAn emergency maintenance situation requires immediate attention at {{association_name}}.\n\nSituation: [DESCRIPTION]\nAffected Area: [AREA]\nAction Required from Residents: [ACTION IF ANY]\n\nOur team is working to resolve this as quickly as possible. Updates will follow.\n\nFor urgent assistance: [EMERGENCY CONTACT]\n\n{{association_name}} Management",
    footerTemplate: null,
    signatureTemplate: "{{association_name}} Emergency Response",
  },
  // Compliance & Rules
  {
    name: "Rule Violation Notice - 1st Warning",
    subjectTemplate: "Community Rule Notice — {{association_name}}",
    headerTemplate: "NOTICE OF RULE VIOLATION",
    bodyTemplate: "Dear {{recipient_name}},\n\nThis notice is to inform you that a potential violation of {{association_name}} community rules has been identified at {{unit_label}}:\n\nViolation: [DESCRIPTION OF VIOLATION]\nDate Observed: [DATE]\nRule Reference: [CC&R/RULE SECTION]\n\nPlease remedy this situation by [REMEDY DATE]. If you have already addressed this or believe this notice was issued in error, please contact us immediately.\n\nFailure to comply may result in fines as outlined in the governing documents.\n\n{{association_name}} Board of Directors",
    footerTemplate: "{{unit_label}} · {{association_name}}",
    signatureTemplate: "{{association_name}} Compliance",
  },
  {
    name: "Rule Violation Notice - Final Warning",
    subjectTemplate: "FINAL NOTICE: Rule Violation — {{association_name}}",
    headerTemplate: "FINAL NOTICE OF RULE VIOLATION",
    bodyTemplate: "Dear {{recipient_name}},\n\nDespite a previous notice, the rule violation at {{unit_label}} has not been resolved.\n\nViolation: [DESCRIPTION]\nOriginal Notice Date: [DATE]\nRemediation Deadline: [NEW DEADLINE]\n\nFine Schedule: [FINE AMOUNTS PER GOVERNING DOCUMENTS]\n\nThis is the final notice before fines and/or additional enforcement action are initiated. If you have remediated the violation, please provide documentation to the management office.\n\n{{association_name}} Board of Directors",
    footerTemplate: "{{unit_label}} · {{association_name}}",
    signatureTemplate: "{{association_name}} Compliance",
  },
  {
    name: "Pet Registration Reminder",
    subjectTemplate: "Pet Registration Required — {{association_name}}",
    headerTemplate: null,
    bodyTemplate: "Dear {{recipient_name}},\n\nThis is a reminder that all pets residing at {{unit_label}} must be registered with {{association_name}} per community rules.\n\nTo register your pet, please submit: [REQUIRED DOCUMENTS — e.g., vaccination records, pet photo, signed pet addendum].\n\nPlease complete registration by [DATE] to remain in compliance.\n\n{{association_name}} Management",
    footerTemplate: null,
    signatureTemplate: "{{association_name}} Management",
  },
  // Move-in / Move-out
  {
    name: "Welcome Letter - New Resident",
    subjectTemplate: "Welcome to {{association_name}}!",
    headerTemplate: "Welcome to Your New Home",
    bodyTemplate: "Dear {{recipient_name}},\n\nWelcome to {{association_name}}! We are delighted to have you as a member of our community.\n\nKey information to get started:\n• Portal access: [PORTAL URL]\n• Assessment due date: [DAY OF MONTH] of each month\n• Emergency maintenance: [PHONE]\n• Management contact: [EMAIL / PHONE]\n\nPlease review the community rules and regulations, which are available in your resident portal. If you have any questions, don't hesitate to reach out.\n\nWe look forward to a great relationship!\n\n{{association_name}} Board of Directors",
    footerTemplate: "{{unit_label}} · {{association_name}}",
    signatureTemplate: "{{association_name}} Board",
  },
  {
    name: "Move-Out Notice - Owner",
    subjectTemplate: "Move-Out Notice Received — {{association_name}}",
    headerTemplate: null,
    bodyTemplate: "Dear {{recipient_name}},\n\nWe have received your notice of intent to transfer ownership of {{unit_label}}.\n\nPlease be advised of the following requirements:\n• Final account settlement is required prior to close\n• Move-out inspection must be scheduled with management\n• Parking passes, keys, and access cards must be returned\n• Buyer will need to complete association registration\n\nPlease contact us to coordinate the transition.\n\n{{association_name}} Management",
    footerTemplate: "{{unit_label}}",
    signatureTemplate: "{{association_name}} Management",
  },
  // Insurance & Legal
  {
    name: "Insurance Certificate Request",
    subjectTemplate: "Insurance Certificate Required — {{association_name}}",
    headerTemplate: null,
    bodyTemplate: "Dear {{recipient_name}},\n\nPer {{association_name}} governing documents, all owners are required to maintain homeowner/renter insurance for their unit.\n\nPlease provide a current Certificate of Insurance (COI) naming {{association_name}} as an additional interested party.\n\nRequired coverage minimums:\n• Personal property: [AMOUNT]\n• Liability: [AMOUNT]\n\nPlease submit your COI to [CONTACT] by [DATE].\n\n{{association_name}} Management",
    footerTemplate: "{{unit_label}}",
    signatureTemplate: "{{association_name}} Management",
  },
  {
    name: "Architectural Review Request Acknowledgment",
    subjectTemplate: "Architectural Request Received — {{association_name}}",
    headerTemplate: null,
    bodyTemplate: "Dear {{recipient_name}},\n\nWe have received your Architectural Review Request for {{unit_label}}.\n\nRequest: [DESCRIPTION OF PROPOSED MODIFICATION]\nReceived: [DATE]\nEstimated Review Timeline: [TIMEFRAME]\n\nThe Architectural Review Committee will contact you with the determination. Please do not begin work until written approval has been received.\n\n{{association_name}} ARC",
    footerTemplate: null,
    signatureTemplate: "{{association_name}} Architectural Review Committee",
  },
  // Community
  {
    name: "Community Event Announcement",
    subjectTemplate: "Community Event — {{association_name}}",
    headerTemplate: null,
    bodyTemplate: "Dear {{recipient_name}},\n\nYou're invited to a community event hosted by {{association_name}}!\n\nEvent: [NAME]\nDate: [DATE]\nTime: [TIME]\nLocation: [LOCATION]\n\n[ADDITIONAL DETAILS]\n\nWe hope to see you there!\n\n{{association_name}}",
    footerTemplate: null,
    signatureTemplate: "{{association_name}} Community",
  },
  {
    name: "Budget Approval Notice",
    subjectTemplate: "{{association_name}} Annual Budget Approved",
    headerTemplate: null,
    bodyTemplate: "Dear {{recipient_name}},\n\nThe Board of Directors of {{association_name}} has approved the annual operating budget for [FISCAL YEAR].\n\nKey highlights:\n• Total operating budget: [AMOUNT]\n• Reserve contribution: [AMOUNT]\n• Monthly assessment: [AMOUNT]\n\nThe full budget is available for review in your resident portal. Assessments for [FISCAL YEAR] are effective [DATE].\n\n{{association_name}} Board of Directors",
    footerTemplate: "{{association_name}}",
    signatureTemplate: "{{association_name}} Treasurer",
  },
  {
    name: "Reserve Study Update Notice",
    subjectTemplate: "Reserve Study Summary — {{association_name}}",
    headerTemplate: null,
    bodyTemplate: "Dear {{recipient_name}},\n\nThe Board of Directors of {{association_name}} has completed the [YEAR] Reserve Study.\n\nSummary findings:\n• Percent funded: [PERCENTAGE]%\n• Recommended monthly reserve contribution: [AMOUNT]\n• Major upcoming expenditures: [LIST]\n\nA full copy of the reserve study is available upon request from the management office.\n\n{{association_name}} Board of Directors",
    footerTemplate: null,
    signatureTemplate: "{{association_name}} Board",
  },
  // Elections & Voting
  {
    name: "Election Ballot Invitation",
    subjectTemplate: "{{election_title}} — Your Vote",
    headerTemplate: null,
    bodyTemplate: "Dear {{recipient_name}},\n\nVoting is now open for {{election_title}}.\n\n{{election_description}}\n\nVoting closes on {{election_close_date}}. Please use the secure link below to cast your ballot:\n\n{{vote_link}}\n\nYour vote is confidential and important to our community.\n\n{{association_name}} Board of Directors",
    footerTemplate: "{{association_name}}",
    signatureTemplate: "{{association_name}} Board",
  },
  {
    name: "Voting Reminder",
    subjectTemplate: "Reminder: {{election_title}} — Your Vote",
    headerTemplate: null,
    bodyTemplate: "Dear {{recipient_name}},\n\nThis is a friendly reminder that voting for {{election_title}} is still open.\n\nSo far, {{participation_percent}}% of eligible voters have participated. Voting closes on {{election_close_date}}.\n\nYour vote matters — don't miss your chance to have a say.\n\n{{vote_link}}\n\n{{association_name}} Board of Directors",
    footerTemplate: "{{association_name}}",
    signatureTemplate: "{{association_name}} Board",
  },
  {
    name: "Election Results Announcement",
    subjectTemplate: "{{election_title}} — Election Results",
    headerTemplate: "ELECTION RESULTS",
    bodyTemplate: "Dear {{recipient_name}},\n\nThe election for {{election_title}} has been certified. Here are the official results:\n\nParticipation: {{participation_percent}}% ({{cast_count}} of {{eligible_count}} eligible voters)\n\n{{results_summary}}\n\nCertified by {{certified_by}} on {{certified_date}}.\n\nThank you for participating in our community governance.\n\n{{association_name}} Board of Directors",
    footerTemplate: "{{association_name}}",
    signatureTemplate: "{{association_name}} Board",
  },
  {
    name: "Proxy Designation Confirmation",
    subjectTemplate: "Proxy Designation Confirmed — {{election_title}}",
    headerTemplate: null,
    bodyTemplate: "Dear {{recipient_name}},\n\nThis confirms that you have designated {{proxy_name}} to vote on your behalf in {{election_title}}.\n\nElection: {{election_title}}\nProxy: {{proxy_name}}\nDesignated on: {{designation_date}}\n\nIf you did not authorize this designation, please contact {{association_name}} management immediately.\n\nYou may revoke this proxy at any time before your proxy casts a vote.\n\n{{association_name}} Board of Directors",
    footerTemplate: "{{association_name}}",
    signatureTemplate: "{{association_name}} Board",
  },
];

export function CommunicationsContent() {
  const userSettings = useUserSettings();
  const fmtDate = (d: string | Date | null | undefined) => formatSettingsDate(d, userSettings, { includeTime: true });
  const isMobile = useIsMobile();
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
  const [showVarRef, setShowVarRef] = useState(false);
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);
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
  const [emergencyAlertOpen, setEmergencyAlertOpen] = useState(false);
  const [emergencyForm, setEmergencyForm] = useState({ subject: "", body: "", targetType: "all-occupants" as "all-occupants" | "all-owners" | "all-tenants", channelEmail: true, channelSms: false, channelPush: false });
  const [smsRecipientCount, setSmsRecipientCount] = useState<{ optedIn: number; eligible: number } | null>(null);
  const [pushSubscriberCount, setPushSubscriberCount] = useState<{ count: number } | null>(null);
  const selectedAssociationId = activeAssociationId;

  const { data: persons } = useQuery<Person[]>({ queryKey: ["/api/persons", selectedAssociationId] });
  const { data: units } = useQuery<Unit[]>({
    queryKey: [selectedAssociationId ? `/api/units?associationId=${selectedAssociationId}` : "/api/units", selectedAssociationId],
    enabled: Boolean(selectedAssociationId),
  });
  const { data: templates } = useQuery<NoticeTemplate[]>({ queryKey: ["/api/communications/templates", selectedAssociationId] });

  // Payment reminder rules
  const [reminderRuleOpen, setReminderRuleOpen] = useState(false);
  const [reminderRuleForm, setReminderRuleForm] = useState({ name: "", templateId: "", daysRelativeToDue: "0", triggerOn: "overdue", minBalanceThreshold: "0" });
  const { data: reminderRules = [], refetch: refetchReminderRules } = useQuery<PaymentReminderRule[]>({
    queryKey: ["/api/financial/reminder-rules", selectedAssociationId],
    queryFn: async () => {
      if (!selectedAssociationId) return [];
      const res = await apiRequest("GET", `/api/financial/reminder-rules?associationId=${selectedAssociationId}`);
      return res.json();
    },
    enabled: Boolean(selectedAssociationId),
  });

  const createReminderRule = useMutation({
    mutationFn: async () => {
      if (!selectedAssociationId) throw new Error("No association selected");
      const res = await apiRequest("POST", "/api/financial/reminder-rules", {
        associationId: selectedAssociationId,
        name: reminderRuleForm.name,
        templateId: reminderRuleForm.templateId || null,
        daysRelativeToDue: Number(reminderRuleForm.daysRelativeToDue),
        triggerOn: reminderRuleForm.triggerOn,
        minBalanceThreshold: Number(reminderRuleForm.minBalanceThreshold),
        isActive: 1,
      });
      return res.json();
    },
    onSuccess: async () => {
      await refetchReminderRules();
      setReminderRuleOpen(false);
      setReminderRuleForm({ name: "", templateId: "", daysRelativeToDue: "0", triggerOn: "overdue", minBalanceThreshold: "0" });
      toast({ title: "Reminder rule created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const runReminderRule = useMutation({
    mutationFn: async (ruleId: string) => {
      const res = await apiRequest("POST", `/api/financial/reminder-rules/${ruleId}/run`, {});
      return res.json();
    },
    onSuccess: (data: { sent: number }) => {
      toast({ title: `Reminder run complete`, description: `${data.sent} reminder${data.sent !== 1 ? "s" : ""} sent.` });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const toggleReminderRule = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: number }) => {
      const res = await apiRequest("PATCH", `/api/financial/reminder-rules/${id}`, { isActive });
      return res.json();
    },
    onSuccess: async () => { await refetchReminderRules(); toast({ title: "Reminder rule updated" }); },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
  const updateDelivery = useMutation({
    mutationFn: async ({ id, event, bounceType, bounceReason }: { id: string; event: string; bounceType?: string; bounceReason?: string }) => {
      const res = await apiRequest("PATCH", `/api/communications/sends/${id}/delivery`, { event, bounceType, bounceReason });
      return res.json();
    },
    onSuccess: () => { void refetchDeliveryStats(); toast({ title: "Delivery status updated" }); },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const { data: history } = useQuery<CommunicationHistory[]>({ queryKey: ["/api/communications/history", selectedAssociationId] });
  const { data: pendingSends } = useQuery<NoticeSend[]>({
    queryKey: ["/api/communications/sends?status=pending-approval", selectedAssociationId],
  });
  const { data: scheduledSends } = useQuery<NoticeSend[]>({
    queryKey: ["/api/communications/sends?status=scheduled", selectedAssociationId],
  });
  type DeliveryStats = {
    total: number; delivered: number; opened: number; bounced: number; queued: number;
    hardBounces: number; softBounces: number; deliveryRate: number; openRate: number; bounceRate: number;
    bouncedEmails: Array<{ id: string; email: string; type: string | null; reason: string | null; bouncedAt: string | null; retryCount: number }>;
  };
  const { data: deliveryStats, refetch: refetchDeliveryStats } = useQuery<DeliveryStats>({
    queryKey: ["/api/communications/delivery-stats", selectedAssociationId],
    queryFn: async () => {
      if (!selectedAssociationId) throw new Error("No association");
      const res = await apiRequest("GET", `/api/communications/delivery-stats?associationId=${selectedAssociationId}`);
      return res.json();
    },
    enabled: Boolean(selectedAssociationId),
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

  const sendEmergencyAlert = useMutation({
    mutationFn: async () => {
      if (!selectedAssociationId) throw new Error("Select an association first");
      if (!emergencyForm.subject.trim()) throw new Error("Subject is required");
      if (!emergencyForm.body.trim()) throw new Error("Message body is required");
      if (!emergencyForm.channelEmail && !emergencyForm.channelSms && !emergencyForm.channelPush) throw new Error("Select at least one channel");
      const results: string[] = [];
      if (emergencyForm.channelEmail) {
        const res = await apiRequest("POST", "/api/communications/send-targeted", {
          associationId: selectedAssociationId,
          targetType: emergencyForm.targetType,
          subject: `EMERGENCY: ${emergencyForm.subject}`,
          body: emergencyForm.body,
          requireApproval: false,
          bypassReadinessGate: true,
          scheduledFor: null,
          messageClass: "operational",
        });
        const data = await res.json() as { recipientCount: number; sentCount: number; skippedRecipients: number; missingEmailCount: number };
        results.push(`Email: ${data.sentCount}/${data.recipientCount}`);
      }
      if (emergencyForm.channelSms) {
        const res = await apiRequest("POST", "/api/communications/send-sms", {
          associationId: selectedAssociationId,
          body: `EMERGENCY: ${emergencyForm.subject}\n\n${emergencyForm.body}`,
        });
        const data = await res.json() as { sent: number; failed: number; eligibleCount: number };
        results.push(`SMS: ${data.sent}/${data.eligibleCount}`);
      }
      if (emergencyForm.channelPush) {
        const res = await apiRequest("POST", "/api/communications/send-push", {
          associationId: selectedAssociationId,
          title: `EMERGENCY: ${emergencyForm.subject}`,
          body: emergencyForm.body,
          url: "/",
        });
        const data = await res.json() as { sent: number; total: number };
        results.push(`Push: ${data.sent}/${data.total}`);
      }
      return results.join(" | ");
    },
    onSuccess: (summary) => {
      queryClient.invalidateQueries({ queryKey: ["/api/communications/history"] });
      toast({ title: "Emergency alert sent", description: summary });
      setEmergencyAlertOpen(false);
      setEmergencyForm({ subject: "", body: "", targetType: "all-occupants", channelEmail: true, channelSms: false, channelPush: false });
    },
    onError: (err: Error) => toast({ title: "Emergency send failed", description: err.message, variant: "destructive" }),
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
  const [deliveryDetailRelatedId, setDeliveryDetailRelatedId] = useState<string | null>(null);
  const deliveryDetailRecords = filteredHistory.filter(h => deliveryDetailRelatedId && h.relatedId === deliveryDetailRelatedId);

  return (
    <>
      {/* Per-recipient delivery receipt dialog */}
      <Dialog open={Boolean(deliveryDetailRelatedId)} onOpenChange={(open) => { if (!open) setDeliveryDetailRelatedId(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Delivery Details — Per Recipient</DialogTitle></DialogHeader>
          {deliveryDetailRecords.length === 0 ? (
            <p className="text-sm text-muted-foreground">No per-recipient records found for this campaign.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Channel</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveryDetailRecords.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell><Badge variant="outline">{r.channel}</Badge></TableCell>
                    <TableCell className="text-sm">{r.recipientEmail || "-"}</TableCell>
                    <TableCell>
                      {r.deliveryStatus ? (
                        <Badge variant={["delivered", "sent", "simulated"].includes(r.deliveryStatus) ? "default" : ["failed", "undelivered"].includes(r.deliveryStatus) ? "destructive" : "outline"}>
                          {r.deliveryStatus}
                        </Badge>
                      ) : <span className="text-muted-foreground text-xs">pending</span>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(r.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="pt-2">
            <p className="text-xs text-muted-foreground">
              {deliveryDetailRecords.filter(r => r.deliveryStatus && ["delivered","sent","simulated"].includes(r.deliveryStatus)).length} delivered &bull;&nbsp;
              {deliveryDetailRecords.filter(r => r.deliveryStatus && ["failed","undelivered"].includes(r.deliveryStatus)).length} failed &bull;&nbsp;
              {deliveryDetailRecords.filter(r => !r.deliveryStatus).length} pending
            </p>
          </div>
        </DialogContent>
      </Dialog>

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
          {isMobile ? (
            <MobileTabBar
              items={[
                { id: "delivery", label: "Delivery" },
                { id: "onboarding", label: "Onboarding" },
                { id: "operations", label: "Operations" },
              ]}
              value={workspacePanel}
              onChange={setWorkspacePanel}
              fullWidth
            />
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant={workspacePanel === "delivery" ? "default" : "outline"} size="sm" onClick={() => setWorkspacePanel("delivery")}>Delivery Workspace</Button>
              <Button variant={workspacePanel === "onboarding" ? "default" : "outline"} size="sm" onClick={() => setWorkspacePanel("onboarding")}>Onboarding Workspace</Button>
              <Button variant={workspacePanel === "operations" ? "default" : "outline"} size="sm" onClick={() => setWorkspacePanel("operations")}>Operations Workspace</Button>
            </div>
          )}
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
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                {(units ?? []).slice(0, 24).map((unit) => (
                  <Button
                    key={unit.id}
                    type="button"
                    size="sm"
                    className="min-h-11 w-full sm:w-auto"
                    variant={paymentInstructionForm.selectedUnitIds.includes(unit.id) ? "default" : "outline"}
                    onClick={() => toggleUnitSelection(unit.id, "payment")}
                  >
                    {unit.unitNumber}
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
                  <SelectItem key={unit.id} value={unit.id}>{unit.unitNumber}</SelectItem>
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
          <div className="hidden md:block">
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
                    <TableCell>{invite.lastSentAt ? fmtDate(invite.lastSentAt) : "-"}</TableCell>
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
          </div>
          <div className="space-y-3 md:hidden">
            {(onboardingInvites ?? []).slice(0, 25).map((invite) => {
              const inviteUrl = typeof window === "undefined" ? `/onboarding/${invite.token}` : `${window.location.origin}/onboarding/${invite.token}`;
              return (
                <div key={invite.id} className="rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium">{invite.unitLabel ? `Unit ${invite.unitLabel}` : invite.unitId}</div>
                      <div className="mt-1 text-xs text-muted-foreground capitalize">{invite.residentType}</div>
                    </div>
                    <Badge variant={invite.status === "active" ? "secondary" : "outline"}>{invite.status}</Badge>
                  </div>
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <div>Contact: {invite.email || invite.phone || "-"}</div>
                    <div>Last sent: {invite.lastSentAt ? fmtDate(invite.lastSentAt) : "-"}</div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => navigator?.clipboard?.writeText?.(inviteUrl)}>Copy Link</Button>
                    <Button size="sm" variant="outline" onClick={() => window.open(inviteUrl, "_blank", "noopener,noreferrer")}>Open Link</Button>
                    <Button size="sm" variant="outline" onClick={() => sendOnboardingInvite.mutate(invite.id)} disabled={sendOnboardingInvite.isPending || !invite.email}>
                      {invite.lastSentAt ? "Resend" : "Send"}
                    </Button>
                  </div>
                </div>
              );
            })}
            {(onboardingInvites ?? []).length === 0 ? (
              <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No onboarding links created yet.</div>
            ) : null}
          </div>
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
          <div className="hidden md:block">
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
                  <TableCell>{fmtDate(row.submittedAt)}</TableCell>
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
          </div>
          <div className="space-y-3 md:hidden">
            {(onboardingSubmissions ?? []).slice(0, 50).map((row) => (
              <div key={row.id} className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{row.firstName} {row.lastName}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {row.unitLabel ? `Unit ${row.unitLabel}` : row.unitId} · <span className="capitalize">{row.residentType}</span>
                    </div>
                  </div>
                  <Badge variant={row.status === "pending" ? "secondary" : "outline"}>{row.status}</Badge>
                </div>
                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <div>Submitted: {fmtDate(row.submittedAt)}</div>
                  <div>Contact: {row.email || row.phone || row.inviteEmail || "-"}</div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" className="flex-1" onClick={() => reviewOnboardingSubmission.mutate({ id: row.id, decision: "approved" })} disabled={reviewOnboardingSubmission.isPending || row.status !== "pending"}>
                    Approve
                  </Button>
                  <Button size="sm" variant="destructive" className="flex-1" onClick={() => reviewOnboardingSubmission.mutate({ id: row.id, decision: "rejected" })} disabled={reviewOnboardingSubmission.isPending || row.status !== "pending"}>
                    Reject
                  </Button>
                </div>
              </div>
            ))}
            {(onboardingSubmissions ?? []).length === 0 ? (
              <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No onboarding submissions yet.</div>
            ) : null}
          </div>
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
      <>
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
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {(units ?? []).slice(0, 24).map((unit) => (
                <Button
                  key={unit.id}
                  type="button"
                  size="sm"
                  className="min-h-11 w-full sm:w-auto"
                  variant={targetedForm.selectedUnitIds.includes(unit.id) ? "default" : "outline"}
                  onClick={() => toggleUnitSelection(unit.id, "targeted")}
                >
                  {unit.unitNumber}
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
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Body override (optional)</label>
              <button
                type="button"
                className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
                onClick={() => setShowVarRef((v) => !v)}
              >
                {showVarRef ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                Variable reference
              </button>
            </div>
            {showVarRef && (
              <div className="rounded-md border bg-muted/30 p-3 text-xs font-mono space-y-1">
                <div className="text-muted-foreground text-xs font-sans mb-2 font-medium">Available template variables</div>
                {[
                  ["{{recipient_name}}", "First + last name of the recipient"],
                  ["{{association_name}}", "Association name"],
                  ["{{unit_label}}", "Unit identifier (e.g. Unit 4B)"],
                  ["{{payment_methods}}", "Formatted list of accepted payment methods"],
                  ["{{payment_support_email}}", "Payment support email address"],
                  ["{{payment_support_phone}}", "Payment support phone number"],
                  ["{{payment_mailing_address}}", "Check mailing address"],
                  ["{{payment_zelle_handle}}", "Zelle email or phone"],
                  ["{{maintenance_request_link}}", "Portal link to maintenance request"],
                ].map(([variable, description]) => (
                  <div key={variable} className="grid grid-cols-1 gap-1 sm:grid-cols-[180px,1fr] sm:gap-2">
                    <span className="text-primary">{variable}</span>
                    <span className="text-muted-foreground font-sans">{description}</span>
                  </div>
                ))}
              </div>
            )}
            <Textarea rows={4} placeholder="Body override (optional)" value={targetedForm.body} onChange={(e) => setTargetedForm((p) => ({ ...p, body: e.target.value }))} />
          </div>
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
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
            <Button variant="outline" onClick={() => previewRecipients.mutate()} disabled={previewRecipients.isPending}>
              {previewRecipients.isPending ? "Loading…" : "Preview Recipients"}
            </Button>
            {recipientPreview && recipientPreview.recipients.length > 0 ? (
              <Dialog open={confirmSendOpen} onOpenChange={setConfirmSendOpen}>
                <DialogTrigger asChild>
                  <Button>Send to {recipientPreview.recipients.length} Recipient{recipientPreview.recipients.length !== 1 ? "s" : ""}</Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-h-[85vh]">
                  <DialogHeader>
                    <DialogTitle>Confirm Send</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 text-sm">
                    <div className="rounded-lg border bg-amber-50 border-amber-200 p-3 flex gap-2 text-amber-800">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>This will send a live email to <strong>{recipientPreview.recipients.length} recipient{recipientPreview.recipients.length !== 1 ? "s" : ""}</strong>. This action cannot be undone.</span>
                    </div>
                    <div className="space-y-1">
                      <div><span className="text-muted-foreground">Target type: </span><strong>{targetedForm.targetType}</strong></div>
                      {targetedForm.subject && <div><span className="text-muted-foreground">Subject: </span><strong>{targetedForm.subject}</strong></div>}
                      <div><span className="text-muted-foreground">Recipients: </span><strong>{recipientPreview.recipients.length} of {recipientPreview.candidateCount}</strong></div>
                      {recipientPreview.missingEmailCount > 0 && (
                        <div className="text-amber-600">{recipientPreview.missingEmailCount} contact{recipientPreview.missingEmailCount !== 1 ? "s" : ""} will be skipped (no email on file)</div>
                      )}
                    </div>
                  </div>
                  <div className={`mt-2 gap-2 ${isMobile ? "grid grid-cols-1" : "flex justify-end"}`}>
                    <Button className={isMobile ? "w-full" : undefined} variant="outline" onClick={() => setConfirmSendOpen(false)}>Cancel</Button>
                    <Button
                      className={isMobile ? "w-full" : undefined}
                      onClick={() => { sendTargeted.mutate(); setConfirmSendOpen(false); }}
                      disabled={sendTargeted.isPending}
                    >
                      {sendTargeted.isPending ? "Sending…" : "Confirm Send"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            ) : (
              <Button onClick={() => sendTargeted.mutate()} disabled={sendTargeted.isPending || !recipientPreview}>
                {!recipientPreview ? "Preview recipients first" : "Send Targeted"}
              </Button>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            Deliverable recipients: {recipientPreview?.recipients.length ?? 0} / {recipientPreview?.candidateCount ?? 0}
            {" "} | Missing email: {recipientPreview?.missingEmailCount ?? 0}
            {" "} | Duplicate email: {recipientPreview?.duplicateEmailCount ?? 0}
          </div>
          <div className="hidden md:block">
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
          </div>
          <div className="space-y-3 md:hidden">
            {(recipientPreview?.recipients ?? []).slice(0, 25).map((row) => (
              <div key={`${row.email}-${row.unitId}`} className="rounded-xl border p-4">
                <div className="font-medium">{row.email}</div>
                <div className="mt-2 text-xs text-muted-foreground">Role: {row.role}</div>
                <div className="text-xs text-muted-foreground">Unit: {row.unitId}</div>
              </div>
            ))}
            {!recipientPreview ? (
              <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No preview run yet.</div>
            ) : recipientPreview.recipients.length === 0 ? (
              <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No deliverable recipients matched the current targeting rules.</div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Push Notification Broadcast */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Push Notification Broadcast</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Send an instant browser push notification to all subscribed residents for the active association.
            This is useful for urgent alerts, emergency notices, and time-sensitive announcements.
          </p>
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm flex items-center">
            Association Context: <span className="font-medium ml-1">{activeAssociationName || "None selected"}</span>
          </div>
          <Input
            placeholder="Notification title (required)"
            value={emergencyForm.subject}
            onChange={(e) => setEmergencyForm((p) => ({ ...p, subject: e.target.value }))}
          />
          <Textarea
            rows={3}
            placeholder="Notification body (required)"
            value={emergencyForm.body}
            onChange={(e) => setEmergencyForm((p) => ({ ...p, body: e.target.value }))}
          />
          <Dialog open={emergencyAlertOpen} onOpenChange={setEmergencyAlertOpen}>
            <DialogTrigger asChild>
              <Button
                variant="default"
                disabled={!emergencyForm.subject.trim() || !emergencyForm.body.trim() || !selectedAssociationId}
                onClick={() => {
                  setEmergencyForm((p) => ({ ...p, channelPush: true, channelEmail: false, channelSms: false }));
                  setEmergencyAlertOpen(true);
                }}
              >
                Send Push Notification
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Confirm Push Broadcast</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <p>This will send a push notification to all subscribed residents in <strong>{activeAssociationName || "the selected association"}</strong>.</p>
                <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                  <div><span className="text-muted-foreground">Title: </span><strong>{emergencyForm.subject}</strong></div>
                  <div><span className="text-muted-foreground">Body: </span>{emergencyForm.body}</div>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <Button variant="outline" onClick={() => setEmergencyAlertOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => sendEmergencyAlert.mutate()}
                  disabled={sendEmergencyAlert.isPending}
                >
                  {sendEmergencyAlert.isPending ? "Sending…" : "Confirm Send"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
      </>) : null}

      {workspacePanel === "delivery" ? (
        <>
      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Contact Update Review Queue</h2>
          <div className="hidden md:block">
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
                  <TableCell>{fmtDate(row.createdAt)}</TableCell>
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
          </div>
          <div className="space-y-3 md:hidden">
            {(contactUpdates ?? []).filter((row) => row.reviewStatus === "pending").map((row) => (
              <div key={row.id} className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm font-medium">Contact update request</div>
                  <Badge variant="secondary">{row.reviewStatus}</Badge>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">Created: {fmtDate(row.createdAt)}</div>
                <div className="mt-2 rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground break-words">
                  {JSON.stringify(row.requestJson)}
                </div>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" className="flex-1" onClick={() => reviewContactUpdate.mutate({ id: row.id, reviewStatus: "approved" })} disabled={reviewContactUpdate.isPending}>
                    Approve
                  </Button>
                  <Button size="sm" variant="destructive" className="flex-1" onClick={() => reviewContactUpdate.mutate({ id: row.id, reviewStatus: "rejected" })} disabled={reviewContactUpdate.isPending}>
                    Reject
                  </Button>
                </div>
              </div>
            ))}
            {(contactUpdates ?? []).filter((row) => row.reviewStatus === "pending").length === 0 ? (
              <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No pending contact updates.</div>
            ) : null}
          </div>
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
          <div className="hidden md:block">
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
                  <TableCell>{fmtDate(row.createdAt)}</TableCell>
                  <TableCell>{row.title}</TableCell>
                  <TableCell><Badge variant="secondary">{row.status}</Badge></TableCell>
                  <TableCell>{row.priority}</TableCell>
                  <TableCell>{row.responseDueAt ? fmtDate(row.responseDueAt) : "-"}</TableCell>
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
          </div>
          <div className="space-y-3 md:hidden">
            {(maintenanceRequests ?? []).slice(0, 100).map((row) => (
              <div key={row.id} className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{row.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Created {fmtDate(row.createdAt)}</div>
                  </div>
                  <Badge variant="secondary">{row.status}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline">{row.priority}</Badge>
                  <Badge variant="outline">{row.escalationStage}</Badge>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  SLA due: {row.responseDueAt ? fmtDate(row.responseDueAt) : "-"}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button size="sm" variant="outline" onClick={() => updateMaintenanceStatus.mutate({ id: row.id, status: "triaged" })} disabled={updateMaintenanceStatus.isPending}>Triage</Button>
                  <Button size="sm" variant="outline" onClick={() => updateMaintenanceStatus.mutate({ id: row.id, status: "in-progress" })} disabled={updateMaintenanceStatus.isPending}>In Progress</Button>
                  <Button size="sm" onClick={() => updateMaintenanceStatus.mutate({ id: row.id, status: "resolved" })} disabled={updateMaintenanceStatus.isPending}>Resolve</Button>
                  <Button size="sm" variant="destructive" onClick={() => updateMaintenanceStatus.mutate({ id: row.id, status: "rejected" })} disabled={updateMaintenanceStatus.isPending}>Reject</Button>
                </div>
              </div>
            ))}
            {(maintenanceRequests ?? []).length === 0 ? (
              <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No maintenance requests yet.</div>
            ) : null}
          </div>
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
          <div className="hidden md:block">
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
                  <TableCell>{fmtDate(row.sentAt)}</TableCell>
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
                  <TableCell>{fmtDate(row.sentAt)}</TableCell>
                  <TableCell className="text-muted-foreground">Scheduled</TableCell>
                </TableRow>
              ))}
              {(pendingSends ?? []).length === 0 ? (
                (scheduledSends ?? []).length === 0 ? <TableRow><TableCell colSpan={5} className="text-muted-foreground">No pending approvals or scheduled notices.</TableCell></TableRow> : null
              ) : null}
            </TableBody>
          </Table>
          </div>
          <div className="space-y-3 md:hidden">
            {(pendingSends ?? []).map((row) => (
              <div key={row.id} className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{row.subjectRendered}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{row.recipientEmail}</div>
                  </div>
                  <Badge variant="secondary">{row.status}</Badge>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">Dispatch at: {fmtDate(row.sentAt)}</div>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" className="flex-1" onClick={() => approveSend.mutate({ id: row.id, decision: "approved" })} disabled={approveSend.isPending}>
                    Approve
                  </Button>
                  <Button size="sm" variant="destructive" className="flex-1" onClick={() => approveSend.mutate({ id: row.id, decision: "rejected" })} disabled={approveSend.isPending}>
                    Reject
                  </Button>
                </div>
              </div>
            ))}
            {(scheduledSends ?? []).slice(0, 20).map((row) => (
              <div key={row.id} className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{row.subjectRendered}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{row.recipientEmail}</div>
                  </div>
                  <Badge variant="outline">{row.status}</Badge>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">Dispatch at: {fmtDate(row.sentAt)}</div>
              </div>
            ))}
            {(pendingSends ?? []).length === 0 && (scheduledSends ?? []).length === 0 ? (
              <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No pending approvals or scheduled notices.</div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b">
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm max-w-sm">
              Association Context: <span className="font-medium">{activeAssociationName || "None selected"}</span>
            </div>
          </div>
          <div className="hidden md:block">
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Channel</TableHead><TableHead>Delivery</TableHead><TableHead>Recipient</TableHead><TableHead>Subject</TableHead><TableHead>Related</TableHead></TableRow></TableHeader>
              <TableBody>
                {filteredHistory.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell>{fmtDate(h.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant={h.channel === "email" ? "secondary" : "outline"}>{h.channel}</Badge>
                    </TableCell>
                    <TableCell>
                      {h.deliveryStatus ? (
                        <Badge variant={["delivered", "sent", "simulated"].includes(h.deliveryStatus) ? "default" : ["failed", "undelivered"].includes(h.deliveryStatus) ? "destructive" : "outline"}>
                          {h.deliveryStatus}
                        </Badge>
                      ) : <span className="text-muted-foreground text-xs">-</span>}
                    </TableCell>
                    <TableCell>{h.recipientEmail || "-"}</TableCell>
                    <TableCell>{h.subject || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{h.relatedType || "-"}</span>
                        {h.relatedId && filteredHistory.filter(r => r.relatedId === h.relatedId).length > 1 ? (
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setDeliveryDetailRelatedId(h.relatedId)}>Details</Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="space-y-3 p-4 md:hidden">
            {filteredHistory.map((h) => (
              <div key={h.id} className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{h.subject || "Untitled communication"}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{h.recipientEmail || "No recipient"}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={h.channel === "email" ? "secondary" : "outline"}>{h.channel}</Badge>
                    {h.deliveryStatus && (
                      <Badge variant={["delivered", "sent", "simulated"].includes(h.deliveryStatus) ? "default" : ["failed", "undelivered"].includes(h.deliveryStatus) ? "destructive" : "outline"} className="text-xs">
                        {h.deliveryStatus}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">{fmtDate(h.createdAt)}</div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Related: {h.relatedType || "-"} {h.relatedId || ""}
                </div>
              </div>
            ))}
            {filteredHistory.length === 0 ? (
              <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No communication history yet.</div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Payment Reminder Sequences */}
      {selectedAssociationId ? (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h3 className="text-sm font-semibold">Automated Payment Reminder Sequences</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Configure automated reminders to send for overdue or upcoming payment balances.</p>
              </div>
              <Dialog open={reminderRuleOpen} onOpenChange={setReminderRuleOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" disabled={!selectedAssociationId}>Add Reminder Rule</Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-h-[85vh]">
                  <DialogHeader><DialogTitle>Create Payment Reminder Rule</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <Input placeholder="Rule name (e.g. 7-day overdue reminder)" value={reminderRuleForm.name} onChange={(e) => setReminderRuleForm((f) => ({ ...f, name: e.target.value }))} />
                    <Select value={reminderRuleForm.triggerOn} onValueChange={(v) => setReminderRuleForm((f) => ({ ...f, triggerOn: v }))}>
                      <SelectTrigger><SelectValue placeholder="Trigger" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="overdue">When overdue</SelectItem>
                        <SelectItem value="upcoming">Before due date</SelectItem>
                        <SelectItem value="any-balance">Any outstanding balance</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Days relative to due date (negative = before, positive = after)</label>
                      <Input type="number" value={reminderRuleForm.daysRelativeToDue} onChange={(e) => setReminderRuleForm((f) => ({ ...f, daysRelativeToDue: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Minimum balance threshold ($)</label>
                      <Input type="number" min="0" value={reminderRuleForm.minBalanceThreshold} onChange={(e) => setReminderRuleForm((f) => ({ ...f, minBalanceThreshold: e.target.value }))} />
                    </div>
                    <Select value={reminderRuleForm.templateId || "none"} onValueChange={(v) => setReminderRuleForm((f) => ({ ...f, templateId: v === "none" ? "" : v }))}>
                      <SelectTrigger><SelectValue placeholder="Email template (optional)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Default reminder template</SelectItem>
                        {(templates ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div className={`gap-2 ${isMobile ? "grid grid-cols-1" : "flex justify-end"}`}>
                      <Button className={isMobile ? "w-full" : undefined} variant="outline" onClick={() => setReminderRuleOpen(false)}>Cancel</Button>
                      <Button className={isMobile ? "w-full" : undefined} onClick={() => createReminderRule.mutate()} disabled={!reminderRuleForm.name.trim() || createReminderRule.isPending}>Create Rule</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rule</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Min Balance</TableHead>
                    <TableHead>Last Run</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reminderRules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell className="font-medium">{rule.name}</TableCell>
                      <TableCell>{rule.triggerOn}</TableCell>
                      <TableCell>{rule.daysRelativeToDue > 0 ? `+${rule.daysRelativeToDue}` : rule.daysRelativeToDue}</TableCell>
                      <TableCell>${(rule.minBalanceThreshold ?? 0).toFixed(2)}</TableCell>
                      <TableCell>{rule.lastRunAt ? fmtDate(rule.lastRunAt) : "Never"}</TableCell>
                      <TableCell><Badge variant={rule.isActive ? "secondary" : "outline"}>{rule.isActive ? "active" : "paused"}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => runReminderRule.mutate(rule.id)} disabled={runReminderRule.isPending || !rule.isActive}>Run Now</Button>
                          <Button size="sm" variant="outline" onClick={() => toggleReminderRule.mutate({ id: rule.id, isActive: rule.isActive ? 0 : 1 })} disabled={toggleReminderRule.isPending}>
                            {rule.isActive ? "Pause" : "Activate"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {reminderRules.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="h-16 text-center text-muted-foreground">No payment reminder rules configured.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="space-y-3 md:hidden">
              {reminderRules.map((rule) => (
                <div key={rule.id} className="rounded-xl border p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{rule.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {rule.triggerOn} · {rule.daysRelativeToDue > 0 ? `+${rule.daysRelativeToDue}` : rule.daysRelativeToDue} days · min ${(
                          rule.minBalanceThreshold ?? 0
                        ).toFixed(2)}
                      </div>
                    </div>
                    <Badge variant={rule.isActive ? "secondary" : "outline"}>{rule.isActive ? "active" : "paused"}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">Last run: {rule.lastRunAt ? fmtDate(rule.lastRunAt) : "Never"}</div>
                  <div className="flex gap-2">
                    <Button className="flex-1" size="sm" variant="outline" onClick={() => runReminderRule.mutate(rule.id)} disabled={runReminderRule.isPending || !rule.isActive}>Run Now</Button>
                    <Button className="flex-1" size="sm" variant="outline" onClick={() => toggleReminderRule.mutate({ id: rule.id, isActive: rule.isActive ? 0 : 1 })} disabled={toggleReminderRule.isPending}>
                      {rule.isActive ? "Pause" : "Activate"}
                    </Button>
                  </div>
                </div>
              ))}
              {reminderRules.length === 0 ? (
                <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No payment reminder rules configured.</div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}
        {deliveryStats ? (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Delivery Tracking &amp; Bounce Management</h2>
                <p className="text-sm text-muted-foreground">Monitor email delivery rates and manage bounce handling for the active association.</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-md border p-3 text-center">
                  <div className="text-xs text-muted-foreground">Total Sent</div>
                  <div className="text-xl font-semibold">{deliveryStats.total}</div>
                </div>
                <div className="rounded-md border p-3 text-center">
                  <div className="text-xs text-muted-foreground">Delivered</div>
                  <div className="text-xl font-semibold text-green-600">{deliveryStats.delivered} <span className="text-sm text-muted-foreground">({deliveryStats.deliveryRate}%)</span></div>
                </div>
                <div className="rounded-md border p-3 text-center">
                  <div className="text-xs text-muted-foreground">Opened</div>
                  <div className="text-xl font-semibold text-blue-600">{deliveryStats.opened} <span className="text-sm text-muted-foreground">({deliveryStats.openRate}%)</span></div>
                </div>
                <div className="rounded-md border p-3 text-center">
                  <div className="text-xs text-muted-foreground">Bounced</div>
                  <div className="text-xl font-semibold text-red-600">{deliveryStats.bounced} <span className="text-sm text-muted-foreground">({deliveryStats.bounceRate}%)</span></div>
                </div>
              </div>
              {deliveryStats.bouncedEmails.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Bounced Addresses <Badge variant="destructive">{deliveryStats.bounced}</Badge></div>
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead>Bounced At</TableHead>
                          <TableHead>Retries</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deliveryStats.bouncedEmails.map((b) => (
                          <TableRow key={b.id}>
                            <TableCell className="font-mono text-sm">{b.email}</TableCell>
                            <TableCell><Badge variant={b.type === "hard" ? "destructive" : "secondary"}>{b.type || "unknown"}</Badge></TableCell>
                            <TableCell className="text-sm text-muted-foreground">{b.reason || "—"}</TableCell>
                            <TableCell className="text-sm">{b.bouncedAt ? fmtDate(b.bouncedAt) : "—"}</TableCell>
                            <TableCell>{b.retryCount}</TableCell>
                            <TableCell className="text-right">
                              {b.type !== "hard" ? (
                                <Button size="sm" variant="outline" onClick={() => updateDelivery.mutate({ id: b.id, event: "retry" })} disabled={updateDelivery.isPending}>
                                  Retry
                                </Button>
                              ) : <span className="text-xs text-muted-foreground">Hard bounce — no retry</span>}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="space-y-3 md:hidden">
                    {deliveryStats.bouncedEmails.map((b) => (
                      <div key={b.id} className="rounded-xl border p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="break-all font-mono text-sm">{b.email}</div>
                            <div className="mt-1 text-xs text-muted-foreground">{b.reason || "No bounce reason provided"}</div>
                          </div>
                          <Badge variant={b.type === "hard" ? "destructive" : "secondary"}>{b.type || "unknown"}</Badge>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                          <span>{b.bouncedAt ? fmtDate(b.bouncedAt) : "No date"}</span>
                          <span>{b.retryCount} retr{b.retryCount === 1 ? "y" : "ies"}</span>
                        </div>
                        {b.type !== "hard" ? (
                          <Button className="w-full" size="sm" variant="outline" onClick={() => updateDelivery.mutate({ id: b.id, event: "retry" })} disabled={updateDelivery.isPending}>
                            Retry delivery
                          </Button>
                        ) : (
                          <div className="text-xs text-muted-foreground">Hard bounce. Retry is disabled.</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No bounced emails for this association.</div>
              )}
            </CardContent>
          </Card>
        ) : null}
        </>
      ) : null}
    </>
  );
}

export default function CommunicationsPage() {
  return (
    <div className="p-6 space-y-6">
      <WorkspacePageHeader
        title="Communications"
        summary="Send notices and publish community announcements."
        eyebrow="Board & Governance"
        breadcrumbs={[{ label: "Board", href: "/app/board" }, { label: "Communications" }]}
        subPages={boardGovernanceSubPages}
      />
      <Tabs defaultValue="communications" className="space-y-6">
        <TabsList>
          <TabsTrigger value="communications">Notices</TabsTrigger>
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
        </TabsList>
        <TabsContent value="communications" className="mt-0 space-y-6">
          <CommunicationsContent />
        </TabsContent>
        <TabsContent value="announcements" className="mt-0 space-y-6">
          <AnnouncementsContent />
        </TabsContent>
      </Tabs>
    </div>
  );
}
