import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { AnnualGovernanceTask, Association, BoardRole, CommunicationHistory, ContactUpdateRequest, Document, GovernanceMeeting, MaintenanceRequest, NoticeSend, OwnerLedgerEntry, Person, PortalAccess, Unit, VendorInvoice } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MobileSectionShell } from "@/components/mobile-section-shell";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { useIsMobile } from "@/hooks/use-mobile";
import { OwnerPortalLogin } from "@/components/owner-portal-login";

const maintenanceCategories = ["general", "plumbing", "electrical", "hvac", "common-area", "security", "other"];
const maintenancePriorities = ["low", "medium", "high", "urgent"] as const;
const governanceMeetingStatuses = ["scheduled", "in-progress", "completed", "cancelled"] as const;
const governanceMeetingSummaryStatuses = ["draft", "published"] as const;
const governanceTaskStatuses = ["todo", "in-progress", "done"] as const;
const maintenanceRequestStatuses = ["submitted", "triaged", "in-progress", "resolved", "closed", "rejected"] as const;
const vendorInvoiceStatuses = ["draft", "received", "approved", "paid", "void"] as const;
const ownerLedgerEntryTypes = ["charge", "assessment", "payment", "late-fee", "credit", "adjustment"] as const;
type PortalSession = PortalAccess & {
  hasBoardAccess: boolean;
  effectiveRole: string;
  boardRoleId: string | null;
  unitNumber: string | null;
  building: string | null;
};
type AssociationOverview = {
  associationId: string;
  units: number;
  activeOwners: number;
  activeOccupants: number;
  maintenanceOpen: number;
  maintenanceOverdue: number;
  paymentMethodsActive: number;
  onboardingState: string;
  onboardingScorePercent: number;
  contactCoveragePercent: number;
};
type BoardDashboard = {
  attention: {
    items: Array<{ key: string; label: string; detail: string; tone: "low" | "medium" | "high" }>;
    maintenanceOverdue: number;
    overdueGovernanceTasks: number;
    upcomingMeetingCount: number;
    draftMeetingCount: number;
    unpublishedDocumentCount: number;
  };
  financial: {
    budgetCount: number;
    ledgerEntryCount: number;
    totalCharges: number;
    totalPayments: number;
    openBalance: number;
    totalInvoices: number;
    totalUtilities: number;
    recentLedgerEntries: Array<{ id: string; entryType: string; amount: number; description: string | null; createdAt: string }>;
    recentInvoices: Array<{ id: string; vendorName: string | null; invoiceNumber: string | null; amount: number; invoiceDate: string }>;
  };
  governance: {
    meetingCount: number;
    upcomingMeetings: Array<{ id: string; title: string; scheduledAt: string; meetingType: string | null; status: string; summaryStatus: string }>;
    taskCount: number;
    openTaskCount: number;
    openTasks: Array<{ id: string; title: string; dueDate: string | null; status: string }>;
  };
  workflowStates: {
    access: {
      status: string;
      effectiveRole: string;
      boardRole: string | null;
      boardTerm: {
        startDate: string;
        endDate: string | null;
        isActive: boolean;
      } | null;
    };
    governance: {
      meetingsByStatus: Record<"scheduled" | "in-progress" | "completed" | "cancelled", number>;
      summariesByStatus: Record<"draft" | "published", number>;
      tasksByStatus: Record<"todo" | "in-progress" | "done", number>;
    };
    maintenance: {
      requestsByStatus: Record<"submitted" | "triaged" | "in-progress" | "resolved" | "closed" | "rejected", number>;
      urgentOpenCount: number;
      recent: Array<{
        id: string;
        title: string;
        priority: string;
        status: string;
        responseDueAt: string | null;
        locationText: string | null;
        createdAt: string;
      }>;
    };
    communications: {
      noticesByStatus: Record<string, number>;
      documentsPortalVisible: number;
      documentsInternalOnly: number;
      boardPackagesByStatus: Record<"draft" | "approved" | "distributed", number>;
    };
  };
  activity: {
    recent: Array<{
      id: string;
      entityType: string;
      action: string;
      actorEmail: string | null;
      createdAt: string;
      lane?: string;
      laneLabel?: string;
      summary?: string;
      changedFields?: string[];
    }>;
  };
};

function formatStatusLabel(value: string) {
  return value.replace(/-/g, " ");
}

function getStatusBadgeVariant(value: string): "default" | "secondary" | "destructive" | "outline" {
  if (value === "urgent" || value === "rejected" || value === "cancelled" || value === "revoked" || value === "expired") return "destructive";
  if (value === "in-progress" || value === "triaged" || value === "scheduled" || value === "approved" || value === "published" || value === "active") return "default";
  if (value === "resolved" || value === "closed" || value === "done" || value === "distributed") return "secondary";
  return "outline";
}

function sumStateCounts(counts: Record<string, number>) {
  return Object.values(counts).reduce((sum, count) => sum + count, 0);
}

function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function getOwnerReadableState(status: string) {
  switch (status) {
    case "submitted":
      return "Waiting on management";
    case "triaged":
      return "Under review";
    case "in-progress":
      return "In progress";
    case "resolved":
      return "Resolved";
    case "closed":
      return "Closed";
    case "rejected":
      return "Needs follow-up";
    case "pending":
      return "Waiting on management";
    case "approved":
      return "Completed";
    case "todo":
      return "Action needed";
    case "done":
      return "Completed";
    default:
      return formatStatusLabel(status);
  }
}

function classifyBoardActivity(entry: { entityType: string; action: string }) {
  const entity = entry.entityType.toLowerCase();
  const action = entry.action.toLowerCase();
  if (entity.includes("portal") || entity.includes("board-role") || action.includes("access")) {
    return { lane: "access", label: "Access" };
  }
  if (entity.includes("meeting") || entity.includes("governance") || entity.includes("board-package")) {
    return { lane: "governance", label: "Governance" };
  }
  if (entity.includes("ledger") || entity.includes("invoice") || entity.includes("payment") || entity.includes("budget") || entity.includes("utility")) {
    return { lane: "financial", label: "Financial" };
  }
  if (entity.includes("document") || entity.includes("notice") || entity.includes("communication")) {
    return { lane: "communications", label: "Communications" };
  }
  if (entity.includes("maintenance") || entity.includes("work-order") || entity.includes("inspection")) {
    return { lane: "operations", label: "Operations" };
  }
  return { lane: "general", label: "General" };
}

function portalHeaders(portalAccessId: string) {
  return {
    "x-portal-access-id": portalAccessId,
  };
}

type AssociationChoice = {
  portalAccessId: string;
  associationId: string;
  associationName: string;
  associationCity: string | null;
  role: string;
  email: string;
  unitId: string | null;
  unitNumber: string | null;
  building: string | null;
};

type UnitBalance = {
  unitId: string;
  unitNumber: string | null;
  building: string | null;
  portalAccessId: string | null;
  balance: number;
};

type PortalNoticeHistory = CommunicationHistory & {
  bodyText?: string | null;
};

function formatUnitContextLabel(building?: string | null, unitNumber?: string | null) {
  return [building ? `Bldg ${building}` : null, unitNumber ? `Unit ${unitNumber}` : null].filter(Boolean).join(" · ") || "Unit";
}

function toTimestamp(value: string | Date | null | undefined) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function OwnerPortalPage() {
  const isMobile = useIsMobile();
  const [email, setEmail] = useState("");
  const [portalAccessId, setPortalAccessId] = useState(() => window.localStorage.getItem("portalAccessId") || "");
  // "permanent" = localStorage, "session" = sessionStorage (remind later), false = show
  const [onboardingDismissed, setOnboardingDismissed] = useState<boolean>(() => {
    const key = `portal-onboarding-dismissed-${window.localStorage.getItem("portalAccessId") || ""}`;
    if (window.localStorage.getItem(key) === "permanent") return true;
    if (window.sessionStorage.getItem(key) === "session") return true;
    return false;
  });
  const [requestedPhone, setRequestedPhone] = useState("");
  const [requestedMailingAddress, setRequestedMailingAddress] = useState("");
  const [requestedEmergencyContactName, setRequestedEmergencyContactName] = useState("");
  const [requestedEmergencyContactPhone, setRequestedEmergencyContactPhone] = useState("");
  const [requestedContactPreference, setRequestedContactPreference] = useState("");
  const [maintenanceTitle, setMaintenanceTitle] = useState("");
  const [maintenanceDescription, setMaintenanceDescription] = useState("");
  const [maintenanceLocation, setMaintenanceLocation] = useState("");
  const [maintenanceCategory, setMaintenanceCategory] = useState("general");
  const [maintenancePriority, setMaintenancePriority] = useState("medium");
  const [maintenanceFiles, setMaintenanceFiles] = useState<File[]>([]);
  const [associationDraft, setAssociationDraft] = useState({ name: "", associationType: "", dateFormed: "", ein: "", address: "", city: "", state: "", country: "" });
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [personDraft, setPersonDraft] = useState({ firstName: "", lastName: "", email: "", phone: "", mailingAddress: "", emergencyContactName: "", emergencyContactPhone: "", contactPreference: "" });
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [unitDraft, setUnitDraft] = useState({ unitNumber: "", building: "", squareFootage: "" });
  const [selectedMeetingId, setSelectedMeetingId] = useState("");
  const [meetingDraft, setMeetingDraft] = useState({ title: "", meetingType: "board", scheduledAt: "", location: "", status: "scheduled", agenda: "", notes: "", summaryText: "", summaryStatus: "draft" });
  const [newMeetingDraft, setNewMeetingDraft] = useState({ title: "", meetingType: "board", scheduledAt: "", location: "", status: "scheduled", agenda: "" });
  const [selectedGovernanceTaskId, setSelectedGovernanceTaskId] = useState("");
  const [governanceTaskDraft, setGovernanceTaskDraft] = useState({ title: "", description: "", status: "todo", ownerPersonId: "", dueDate: "", notes: "" });
  const [newGovernanceTaskDraft, setNewGovernanceTaskDraft] = useState({ title: "", description: "", status: "todo", ownerPersonId: "", dueDate: "", notes: "" });
  const [selectedBoardDocumentId, setSelectedBoardDocumentId] = useState("");
  const [boardDocumentDraft, setBoardDocumentDraft] = useState({ title: "", documentType: "", portalAudience: "owner", isPortalVisible: true });
  const [newBoardDocumentDraft, setNewBoardDocumentDraft] = useState({ title: "", documentType: "", portalAudience: "owner", isPortalVisible: true });
  const [newBoardDocumentFile, setNewBoardDocumentFile] = useState<File | null>(null);
  const [boardNoticeDraft, setBoardNoticeDraft] = useState({ recipientEmail: "", subject: "", body: "", scheduledFor: "", requireApproval: false });
  const [selectedMaintenanceActionId, setSelectedMaintenanceActionId] = useState("");
  const [maintenanceActionDraft, setMaintenanceActionDraft] = useState({ status: "submitted", priority: "medium", assignedTo: "", resolutionNotes: "" });
  const [selectedVendorInvoiceId, setSelectedVendorInvoiceId] = useState("");
  const [vendorInvoiceDraft, setVendorInvoiceDraft] = useState({ vendorName: "", invoiceNumber: "", invoiceDate: "", dueDate: "", amount: "", status: "received", notes: "" });
  const [newVendorInvoiceDraft, setNewVendorInvoiceDraft] = useState({ vendorName: "", invoiceNumber: "", invoiceDate: "", dueDate: "", amount: "", status: "received", notes: "" });
  const [ledgerEntryDraft, setLedgerEntryDraft] = useState({ personId: "", unitId: "", entryType: "charge", amount: "", postedAt: "", description: "" });
  const [paymentFormOpen, setPaymentFormOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDescription, setPaymentDescription] = useState("HOA dues payment");
  const [paymentReceipt, setPaymentReceipt] = useState<{ amount: number; description: string; date: string; confirmationNumber?: string } | null>(null);

  const [otpStep, setOtpStep] = useState<"email" | "otp" | "pick">("email");
  const [otp, setOtp] = useState("");
  const [otpSimulated, setOtpSimulated] = useState<string | null>(null);
  const [associationChoices, setAssociationChoices] = useState<AssociationChoice[]>([]);
  const [workspaceMode, setWorkspaceMode] = useState<"owner" | "board">("owner");
  const [workspaceDefaultAppliedForAccessId, setWorkspaceDefaultAppliedForAccessId] = useState<string | null>(null);
  const [boardActivityFilter, setBoardActivityFilter] = useState<"all" | "governance" | "financial" | "communications" | "operations" | "access">("all");
  const [activeTab, setActiveTab] = useState<"overview" | "financials" | "maintenance" | "documents" | "notices">("overview");
  const [overviewSubtab, setOverviewSubtab] = useState<"summary" | "owner-info" | "occupancy">("summary");
  const [ownedUnitFocusId, setOwnedUnitFocusId] = useState("");
  const [expandedNoticeId, setExpandedNoticeId] = useState<string | null>(null);
  const [readNoticeIds, setReadNoticeIds] = useState<string[]>(() => {
    const portalId = window.localStorage.getItem("portalAccessId") || "";
    const saved = window.localStorage.getItem(`portal-read-notices-${portalId}`);
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
    } catch {
      return [];
    }
  });
  const [maintenanceSuccess, setMaintenanceSuccess] = useState(false);
  const [contactUpdateSuccess, setContactUpdateSuccess] = useState(false);
  const [ownerInfoEditing, setOwnerInfoEditing] = useState(false);
  const overviewContentRef = useRef<HTMLDivElement | null>(null);
  const [occupancyForm, setOccupancyForm] = useState({
    occupancyType: "OWNER_OCCUPIED" as "OWNER_OCCUPIED" | "TENANT",
    tenantFirstName: "",
    tenantLastName: "",
    tenantEmail: "",
    tenantPhone: "",
    notes: "",
  });
  const [occupancyUpdateSuccess, setOccupancyUpdateSuccess] = useState(false);
  const [occupancyEditing, setOccupancyEditing] = useState(false);

  const requestLogin = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/portal/request-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ message: string; simulatedOtp?: string; simulationMode?: boolean }>;
    },
    onSuccess: (result) => {
      setOtpStep("otp");
      setOtpSimulated(result.simulatedOtp ?? null);
    },
  });

  const verifyLogin = useMutation({
    mutationFn: async (chosen?: { portalAccessId?: string; associationId?: string }) => {
      const res = await fetch("/api/portal/verify-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          otp,
          ...(chosen?.portalAccessId ? { portalAccessId: chosen.portalAccessId } : {}),
          ...(chosen?.associationId ? { associationId: chosen.associationId } : {}),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ portalAccessId?: string; associations?: AssociationChoice[] }>;
    },
    onSuccess: (result) => {
      if (result.associations && result.associations.length > 1) {
        setAssociationChoices(result.associations);
        setOtpStep("pick");
      } else if (result.portalAccessId) {
        setPortalAccessId(result.portalAccessId);
        window.localStorage.setItem("portalAccessId", result.portalAccessId);
      }
    },
  });

  const { data: me, refetch: refetchMe } = useQuery<PortalSession | null>({
    queryKey: ["/api/portal/me", portalAccessId || "none"],
    enabled: Boolean(portalAccessId),
    queryFn: async () => {
      const res = await fetch("/api/portal/me", { headers: portalHeaders(portalAccessId) });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: myAssociations } = useQuery<AssociationChoice[]>({
    queryKey: ["/api/portal/my-associations", portalAccessId || "none"],
    enabled: Boolean(portalAccessId),
    queryFn: async () => {
      const res = await fetch("/api/portal/my-associations", { headers: portalHeaders(portalAccessId) });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: documents } = useQuery<Document[]>({
    queryKey: ["/api/portal/documents", portalAccessId || "none"],
    enabled: Boolean(portalAccessId),
    queryFn: async () => {
      const res = await fetch("/api/portal/documents", { headers: portalHeaders(portalAccessId) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const { data: notices } = useQuery<PortalNoticeHistory[]>({
    queryKey: ["/api/portal/notices", portalAccessId || "none"],
    enabled: Boolean(portalAccessId),
    queryFn: async () => {
      const res = await fetch("/api/portal/notices", { headers: portalHeaders(portalAccessId) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const { data: requests, refetch: refetchRequests } = useQuery<ContactUpdateRequest[]>({
    queryKey: ["/api/portal/contact-updates", portalAccessId || "none"],
    enabled: Boolean(portalAccessId),
    queryFn: async () => {
      const res = await fetch("/api/portal/contact-updates", { headers: portalHeaders(portalAccessId) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const { data: maintenanceRequests, refetch: refetchMaintenanceRequests } = useQuery<MaintenanceRequest[]>({
    queryKey: ["/api/portal/maintenance-requests", portalAccessId || "none"],
    enabled: Boolean(portalAccessId),
    queryFn: async () => {
      const res = await fetch("/api/portal/maintenance-requests", { headers: portalHeaders(portalAccessId) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const { data: portalLedger, refetch: refetchPortalLedger } = useQuery<{ entries: OwnerLedgerEntry[]; balance: number }>({
    queryKey: ["/api/portal/ledger", portalAccessId || "none"],
    enabled: Boolean(portalAccessId),
    queryFn: async () => {
      const res = await fetch("/api/portal/ledger", { headers: portalHeaders(portalAccessId) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  type FinancialDashboard = {
    balance: number;
    totalCharged: number;
    totalPaid: number;
    feeSchedules: Array<{ id: string; name: string; amount: number; frequency: string }>;
    nextDueDate: string | null;
    paymentPlan: { id: string; totalAmount: number; amountPaid: number; installmentAmount: number; installmentFrequency: string; nextDueDate: string | null; status: string } | null;
    recentEntries: OwnerLedgerEntry[];
  };
  type PortalAssociation = {
    id: string;
    name: string;
    associationType: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
  };
  const { data: portalAssociation } = useQuery<PortalAssociation>({
    queryKey: ["/api/portal/association", portalAccessId || "none"],
    enabled: Boolean(portalAccessId),
    queryFn: async () => {
      const res = await fetch("/api/portal/association", { headers: portalHeaders(portalAccessId) });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: unitsBalance = [] } = useQuery<UnitBalance[]>({
    queryKey: ["/api/portal/units-balance", portalAccessId || "none"],
    enabled: Boolean(portalAccessId),
    queryFn: async () => {
      const res = await fetch("/api/portal/units-balance", { headers: portalHeaders(portalAccessId) });
      if (!res.ok) return [];
      return res.json();
    },
  });

  type MyUnit = {
    unitId: string;
    portalAccessId: string | null;
    unitNumber: string | null;
    building: string | null;
    squareFootage: number | null;
    balance: number;
    occupants: Array<{ personId: string; firstName: string; lastName: string; email: string | null; phone: string | null; occupancyType: string }>;
  };
  const { data: myUnits = [], refetch: refetchMyUnits } = useQuery<MyUnit[]>({
    queryKey: ["/api/portal/my-units", portalAccessId || "none"],
    enabled: Boolean(portalAccessId),
    queryFn: async () => {
      const res = await fetch("/api/portal/my-units", { headers: portalHeaders(portalAccessId) });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: financialDashboard, refetch: refetchFinancialDashboard } = useQuery<FinancialDashboard>({
    queryKey: ["/api/portal/financial-dashboard", portalAccessId || "none"],
    enabled: Boolean(portalAccessId),
    queryFn: async () => {
      const res = await fetch("/api/portal/financial-dashboard", { headers: portalHeaders(portalAccessId) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const submitPayment = useMutation({
    mutationFn: async () => {
      const amt = parseFloat(paymentAmount);
      if (!amt || amt <= 0) throw new Error("Enter a valid amount");
      const myUnit = focusedOwnedUnit?.unitId || (me as any)?.unitId || "";
      const res = await fetch("/api/portal/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...portalHeaders(portalAccessId) },
        body: JSON.stringify({ amount: amt, description: paymentDescription || "HOA dues payment", unitId: myUnit }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data: any) => {
      const amt = parseFloat(paymentAmount);
      const confirmation = data?.receipt?.confirmationNumber ?? null;
      setPaymentReceipt({
        amount: amt,
        description: paymentDescription || "HOA dues payment",
        date: new Date().toLocaleString(),
        ...(confirmation ? { confirmationNumber: confirmation } : {}),
      });
      setPaymentFormOpen(false);
      setPaymentAmount("");
      void refetchPortalLedger();
      void refetchFinancialDashboard();
    },
  });

  // Saved payment methods
  const [addMethodOpen, setAddMethodOpen] = useState(false);
  const [methodForm, setMethodForm] = useState({ methodType: "ach", displayName: "", last4: "", bankName: "", isDefault: false });
  const { data: savedMethods = [], refetch: refetchMethods } = useQuery<any[]>({
    queryKey: ["/api/portal/payment-methods", portalAccessId || "none"],
    queryFn: async () => {
      if (!portalAccessId) return [];
      const res = await fetch("/api/portal/payment-methods", { headers: portalHeaders(portalAccessId) });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: Boolean(portalAccessId),
  });
  const addMethod = useMutation({
    mutationFn: async () => {
      if (!methodForm.displayName) throw new Error("Display name required");
      const res = await fetch("/api/portal/payment-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...portalHeaders(portalAccessId) },
        body: JSON.stringify({
          methodType: methodForm.methodType,
          displayName: methodForm.displayName,
          last4: methodForm.last4 || null,
          bankName: methodForm.bankName || null,
          isDefault: methodForm.isDefault ? 1 : 0,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => { setAddMethodOpen(false); setMethodForm({ methodType: "ach", displayName: "", last4: "", bankName: "", isDefault: false }); void refetchMethods(); },
    onError: (e: Error) => alert(e.message),
  });
  const setDefaultMethod = useMutation({
    mutationFn: async (methodId: string) => {
      const res = await fetch(`/api/portal/payment-methods/${methodId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...portalHeaders(portalAccessId) },
        body: JSON.stringify({ isDefault: 1 }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => void refetchMethods(),
  });
  const removeMethod = useMutation({
    mutationFn: async (methodId: string) => {
      const res = await fetch(`/api/portal/payment-methods/${methodId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...portalHeaders(portalAccessId) },
        body: JSON.stringify({ isActive: 0 }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => void refetchMethods(),
  });

  // Autopay
  const [autopayFormOpen, setAutopayFormOpen] = useState(false);
  const [autopayForm, setAutopayForm] = useState({ amount: "", frequency: "monthly", dayOfMonth: "1", description: "Autopay HOA dues" });
  const { data: autopayEnrollments = [], refetch: refetchAutopay } = useQuery<any[]>({
    queryKey: ["/api/portal/autopay", portalAccessId || "none"],
    queryFn: async () => {
      if (!portalAccessId) return [];
      const res = await fetch("/api/portal/autopay", { headers: portalHeaders(portalAccessId) });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: Boolean(portalAccessId),
  });
  const enrollAutopay = useMutation({
    mutationFn: async () => {
      const myUnit = focusedOwnedUnit?.unitId || (me as any)?.unitId || "";
      const res = await fetch("/api/portal/autopay/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...portalHeaders(portalAccessId) },
        body: JSON.stringify({
          amount: parseFloat(autopayForm.amount),
          frequency: autopayForm.frequency,
          dayOfMonth: parseInt(autopayForm.dayOfMonth, 10),
          description: autopayForm.description,
          unitId: myUnit,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => { setAutopayFormOpen(false); void refetchAutopay(); },
    onError: (e: Error) => alert(e.message),
  });
  const cancelAutopay = useMutation({
    mutationFn: async (enrollmentId: string) => {
      const res = await fetch(`/api/portal/autopay/${enrollmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...portalHeaders(portalAccessId) },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => void refetchAutopay(),
  });

  const { data: boardOverview } = useQuery<AssociationOverview>({
    queryKey: ["/api/portal/board/overview", portalAccessId || "none"],
    enabled: Boolean(portalAccessId && me?.hasBoardAccess),
    queryFn: async () => {
      const res = await fetch("/api/portal/board/overview", { headers: portalHeaders(portalAccessId) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const { data: boardAssociation, refetch: refetchBoardAssociation } = useQuery<Association>({
    queryKey: ["/api/portal/board/association", portalAccessId || "none"],
    enabled: Boolean(portalAccessId && me?.hasBoardAccess),
    queryFn: async () => {
      const res = await fetch("/api/portal/board/association", { headers: portalHeaders(portalAccessId) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const { data: boardPeople, refetch: refetchBoardPeople } = useQuery<Person[]>({
    queryKey: ["/api/portal/board/persons", portalAccessId || "none"],
    enabled: Boolean(portalAccessId && me?.hasBoardAccess),
    queryFn: async () => {
      const res = await fetch("/api/portal/board/persons", { headers: portalHeaders(portalAccessId) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const { data: boardUnits, refetch: refetchBoardUnits } = useQuery<Unit[]>({
    queryKey: ["/api/portal/board/units", portalAccessId || "none"],
    enabled: Boolean(portalAccessId && me?.hasBoardAccess),
    queryFn: async () => {
      const res = await fetch("/api/portal/board/units", { headers: portalHeaders(portalAccessId) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const { data: boardRoles } = useQuery<BoardRole[]>({
    queryKey: ["/api/portal/board/roles", portalAccessId || "none"],
    enabled: Boolean(portalAccessId && me?.hasBoardAccess),
    queryFn: async () => {
      const res = await fetch("/api/portal/board/roles", { headers: portalHeaders(portalAccessId) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const { data: boardDashboard, refetch: refetchBoardDashboard } = useQuery<BoardDashboard>({
    queryKey: ["/api/portal/board/dashboard", portalAccessId || "none"],
    enabled: Boolean(portalAccessId && me?.hasBoardAccess),
    queryFn: async () => {
      const res = await fetch("/api/portal/board/dashboard", { headers: portalHeaders(portalAccessId) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const { data: boardMeetings, refetch: refetchBoardMeetings } = useQuery<GovernanceMeeting[]>({
    queryKey: ["/api/portal/board/meetings", portalAccessId || "none"],
    enabled: Boolean(portalAccessId && me?.hasBoardAccess),
    queryFn: async () => {
      const res = await fetch("/api/portal/board/meetings", { headers: portalHeaders(portalAccessId) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const { data: boardGovernanceTasks, refetch: refetchBoardGovernanceTasks } = useQuery<AnnualGovernanceTask[]>({
    queryKey: ["/api/portal/board/governance-tasks", portalAccessId || "none"],
    enabled: Boolean(portalAccessId && me?.hasBoardAccess),
    queryFn: async () => {
      const res = await fetch("/api/portal/board/governance-tasks", { headers: portalHeaders(portalAccessId) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const { data: boardDocuments, refetch: refetchBoardDocuments } = useQuery<Document[]>({
    queryKey: ["/api/portal/board/documents", portalAccessId || "none"],
    enabled: Boolean(portalAccessId && me?.hasBoardAccess),
    queryFn: async () => {
      const res = await fetch("/api/portal/board/documents", { headers: portalHeaders(portalAccessId) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const { data: boardNoticeSends, refetch: refetchBoardNoticeSends } = useQuery<NoticeSend[]>({
    queryKey: ["/api/portal/board/communications/sends", portalAccessId || "none"],
    enabled: Boolean(portalAccessId && me?.hasBoardAccess),
    queryFn: async () => {
      const res = await fetch("/api/portal/board/communications/sends", { headers: portalHeaders(portalAccessId) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const { data: boardCommunicationHistory, refetch: refetchBoardCommunicationHistory } = useQuery<CommunicationHistory[]>({
    queryKey: ["/api/portal/board/communications/history", portalAccessId || "none"],
    enabled: Boolean(portalAccessId && me?.hasBoardAccess),
    queryFn: async () => {
      const res = await fetch("/api/portal/board/communications/history", { headers: portalHeaders(portalAccessId) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const { data: boardVendorInvoices, refetch: refetchBoardVendorInvoices } = useQuery<VendorInvoice[]>({
    queryKey: ["/api/portal/board/vendor-invoices", portalAccessId || "none"],
    enabled: Boolean(portalAccessId && me?.hasBoardAccess),
    queryFn: async () => {
      const res = await fetch("/api/portal/board/vendor-invoices", { headers: portalHeaders(portalAccessId) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const { data: boardOwnerLedgerEntries, refetch: refetchBoardOwnerLedgerEntries } = useQuery<OwnerLedgerEntry[]>({
    queryKey: ["/api/portal/board/owner-ledger/entries", portalAccessId || "none"],
    enabled: Boolean(portalAccessId && me?.hasBoardAccess),
    queryFn: async () => {
      const res = await fetch("/api/portal/board/owner-ledger/entries", { headers: portalHeaders(portalAccessId) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const { data: boardOwnerLedgerSummary, refetch: refetchBoardOwnerLedgerSummary } = useQuery<Array<{ personId: string; unitId: string; balance: number }>>({
    queryKey: ["/api/portal/board/owner-ledger/summary", portalAccessId || "none"],
    enabled: Boolean(portalAccessId && me?.hasBoardAccess),
    queryFn: async () => {
      const res = await fetch("/api/portal/board/owner-ledger/summary", { headers: portalHeaders(portalAccessId) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const saveOwnerInfo = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/portal/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...portalHeaders(portalAccessId) },
        body: JSON.stringify({
          phone: requestedPhone,
          mailingAddress: requestedMailingAddress,
          emergencyContactName: requestedEmergencyContactName,
          emergencyContactPhone: requestedEmergencyContactPhone,
          contactPreference: requestedContactPreference,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: async () => {
      setContactUpdateSuccess(true);
      setTimeout(() => setContactUpdateSuccess(false), 5000);
      setOwnerInfoEditing(false);
      await refetchMe();
    },
  });

  const saveOccupancy = useMutation({
    mutationFn: async () => {
      if (!focusedOwnedUnit) throw new Error("Select a unit first");
      if (occupancyForm.occupancyType === "TENANT") {
        if (!occupancyForm.tenantFirstName.trim() || !occupancyForm.tenantLastName.trim()) {
          throw new Error("Tenant first and last name are required");
        }
        if (!occupancyForm.tenantEmail.trim()) {
          throw new Error("Tenant email is required");
        }
        if (!isValidEmail(occupancyForm.tenantEmail)) {
          throw new Error("Tenant email must be a valid email address");
        }
      }
      const res = await fetch("/api/portal/occupancy", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...portalHeaders(portalAccessId) },
        body: JSON.stringify({
          unitId: focusedOwnedUnit.unitId,
          occupancyType: occupancyForm.occupancyType,
          notes: occupancyForm.notes,
          ...(occupancyForm.occupancyType === "TENANT"
            ? {
                tenant: {
                  firstName: occupancyForm.tenantFirstName,
                  lastName: occupancyForm.tenantLastName,
                  email: occupancyForm.tenantEmail,
                  phone: occupancyForm.tenantPhone,
                },
              }
            : {}),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: async () => {
      setOccupancyUpdateSuccess(true);
      setTimeout(() => setOccupancyUpdateSuccess(false), 5000);
      setOccupancyEditing(false);
      await Promise.all([refetchMyUnits(), refetchMe()]);
    },
  });

  const submitMaintenanceRequest = useMutation({
    mutationFn: async () => {
      let attachmentUrlsJson: string[] = [];
      if (maintenanceFiles.length > 0) {
        const formData = new FormData();
        for (const file of maintenanceFiles) {
          formData.append("files", file);
        }
        const uploadRes = await fetch("/api/portal/maintenance-attachments", {
          method: "POST",
          headers: portalHeaders(portalAccessId),
          body: formData,
        });
        if (!uploadRes.ok) throw new Error(await uploadRes.text());
        const uploadJson = await uploadRes.json() as { urls: string[] };
        attachmentUrlsJson = uploadJson.urls;
      }

      const res = await fetch("/api/portal/maintenance-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...portalHeaders(portalAccessId) },
        body: JSON.stringify({
          title: maintenanceTitle,
          description: maintenanceDescription,
          locationText: maintenanceLocation || null,
          category: maintenanceCategory,
          priority: maintenancePriority,
          attachmentUrlsJson,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: async () => {
      setMaintenanceTitle("");
      setMaintenanceDescription("");
      setMaintenanceLocation("");
      setMaintenanceCategory("general");
      setMaintenancePriority("medium");
      setMaintenanceFiles([]);
      setMaintenanceSuccess(true);
      setTimeout(() => setMaintenanceSuccess(false), 5000);
      await refetchMaintenanceRequests();
    },
  });

  const displayName = useMemo(() => {
    if (!me) return "Portal User";
    return `${me.email} (${me.effectiveRole})`;
  }, [me]);
  const portalRoleLabel = me?.effectiveRole ? formatStatusLabel(me.effectiveRole) : "Portal user";
  const hasBoardAccess = Boolean(me?.hasBoardAccess);

  const maintenanceUpdates = useMemo(
    () => (notices ?? []).filter((notice) => (notice.relatedType || "").startsWith("maintenance") || (notice.relatedType || "").startsWith("work-order")),
    [notices],
  );

  useEffect(() => {
    if (!boardAssociation) return;
    setAssociationDraft({
      name: boardAssociation.name || "",
      associationType: boardAssociation.associationType || "",
      dateFormed: boardAssociation.dateFormed || "",
      ein: boardAssociation.ein || "",
      address: boardAssociation.address || "",
      city: boardAssociation.city || "",
      state: boardAssociation.state || "",
      country: boardAssociation.country || "",
    });
  }, [boardAssociation]);

  useEffect(() => {
    if (!selectedPersonId && boardPeople?.length) {
      setSelectedPersonId(boardPeople[0].id);
    }
  }, [boardPeople, selectedPersonId]);

  useEffect(() => {
    const person = (boardPeople ?? []).find((row) => row.id === selectedPersonId);
    if (!person) return;
    setPersonDraft({
      firstName: person.firstName || "",
      lastName: person.lastName || "",
      email: person.email || "",
      phone: person.phone || "",
      mailingAddress: person.mailingAddress || "",
      emergencyContactName: person.emergencyContactName || "",
      emergencyContactPhone: person.emergencyContactPhone || "",
      contactPreference: person.contactPreference || "",
    });
  }, [boardPeople, selectedPersonId]);

  useEffect(() => {
    if (!selectedUnitId && boardUnits?.length) {
      setSelectedUnitId(boardUnits[0].id);
    }
  }, [boardUnits, selectedUnitId]);

  useEffect(() => {
    const unit = (boardUnits ?? []).find((row) => row.id === selectedUnitId);
    if (!unit) return;
    setUnitDraft({
      unitNumber: unit.unitNumber || "",
      building: unit.building || "",
      squareFootage: unit.squareFootage ? String(unit.squareFootage) : "",
    });
  }, [boardUnits, selectedUnitId]);

  useEffect(() => {
    if (!selectedMeetingId && boardMeetings?.length) {
      setSelectedMeetingId(boardMeetings[0].id);
    }
  }, [boardMeetings, selectedMeetingId]);

  useEffect(() => {
    const meeting = (boardMeetings ?? []).find((row) => row.id === selectedMeetingId);
    if (!meeting) return;
    setMeetingDraft({
      title: meeting.title || "",
      meetingType: meeting.meetingType || "board",
      scheduledAt: meeting.scheduledAt ? new Date(meeting.scheduledAt).toISOString().slice(0, 16) : "",
      location: meeting.location || "",
      status: meeting.status,
      agenda: meeting.agenda || "",
      notes: meeting.notes || "",
      summaryText: meeting.summaryText || "",
      summaryStatus: meeting.summaryStatus,
    });
  }, [boardMeetings, selectedMeetingId]);

  useEffect(() => {
    if (!selectedGovernanceTaskId && boardGovernanceTasks?.length) {
      setSelectedGovernanceTaskId(boardGovernanceTasks[0].id);
    }
  }, [boardGovernanceTasks, selectedGovernanceTaskId]);

  useEffect(() => {
    const task = (boardGovernanceTasks ?? []).find((row) => row.id === selectedGovernanceTaskId);
    if (!task) return;
    setGovernanceTaskDraft({
      title: task.title || "",
      description: task.description || "",
      status: task.status,
      ownerPersonId: task.ownerPersonId || "",
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : "",
      notes: task.notes || "",
    });
  }, [boardGovernanceTasks, selectedGovernanceTaskId]);

  useEffect(() => {
    if (!selectedBoardDocumentId && boardDocuments?.length) {
      setSelectedBoardDocumentId(boardDocuments[0].id);
    }
  }, [boardDocuments, selectedBoardDocumentId]);

  useEffect(() => {
    const document = (boardDocuments ?? []).find((row) => row.id === selectedBoardDocumentId);
    if (!document) return;
    setBoardDocumentDraft({
      title: document.title || "",
      documentType: document.documentType || "",
      portalAudience: document.portalAudience || "owner",
      isPortalVisible: document.isPortalVisible === 1,
    });
  }, [boardDocuments, selectedBoardDocumentId]);

  useEffect(() => {
    if (!selectedMaintenanceActionId && maintenanceRequests?.length) {
      setSelectedMaintenanceActionId(maintenanceRequests[0].id);
    }
  }, [maintenanceRequests, selectedMaintenanceActionId]);

  useEffect(() => {
    const request = (maintenanceRequests ?? []).find((row) => row.id === selectedMaintenanceActionId);
    if (!request) return;
    setMaintenanceActionDraft({
      status: request.status,
      priority: request.priority,
      assignedTo: request.assignedTo || "",
      resolutionNotes: request.resolutionNotes || "",
    });
  }, [maintenanceRequests, selectedMaintenanceActionId]);

  useEffect(() => {
    if (!selectedVendorInvoiceId && boardVendorInvoices?.length) {
      setSelectedVendorInvoiceId(boardVendorInvoices[0].id);
    }
  }, [boardVendorInvoices, selectedVendorInvoiceId]);

  // Pre-populate contact update form with current values on file when me loads
  useEffect(() => {
    if (!me) return;
    setRequestedPhone((me as any).phone ?? "");
    setRequestedMailingAddress((me as any).mailingAddress ?? "");
    setRequestedEmergencyContactName((me as any).emergencyContactName ?? "");
    setRequestedEmergencyContactPhone((me as any).emergencyContactPhone ?? "");
    setRequestedContactPreference((me as any).contactPreference ?? "");
  }, [me?.personId]);

  useEffect(() => {
    if (myUnits.length === 0) {
      if (ownedUnitFocusId) setOwnedUnitFocusId("");
      return;
    }
    const preferredUnitId = myUnits.find((unit) => unit.unitId === me?.unitId)?.unitId ?? myUnits[0].unitId;
    const focusedStillExists = myUnits.some((unit) => unit.unitId === ownedUnitFocusId);
    if (!focusedStillExists || !ownedUnitFocusId) {
      setOwnedUnitFocusId(preferredUnitId);
    }
  }, [myUnits, me?.unitId, ownedUnitFocusId]);

  useEffect(() => {
    const focusedUnit = myUnits.find((unit) => unit.unitId === ownedUnitFocusId) ?? myUnits[0] ?? null;
    if (!focusedUnit) return;
    const tenant = focusedUnit.occupants.find((occupant) => occupant.occupancyType === "TENANT");
    const hasTenant = Boolean(tenant);
    setOccupancyForm({
      occupancyType: hasTenant ? "TENANT" : "OWNER_OCCUPIED",
      tenantFirstName: tenant?.firstName ?? "",
      tenantLastName: tenant?.lastName ?? "",
      tenantEmail: tenant?.email ?? "",
      tenantPhone: tenant?.phone ?? "",
      notes: "",
    });
  }, [myUnits, ownedUnitFocusId]);

  useEffect(() => {
    const saved = window.localStorage.getItem(`portal-read-notices-${portalAccessId}`);
    if (!saved) {
      setReadNoticeIds([]);
      return;
    }
    try {
      const parsed = JSON.parse(saved);
      setReadNoticeIds(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : []);
    } catch {
      setReadNoticeIds([]);
    }
  }, [portalAccessId]);

  useEffect(() => {
    if (!me?.hasBoardAccess && workspaceMode === "board") {
      setWorkspaceMode("owner");
    }
  }, [me?.hasBoardAccess, workspaceMode]);

  useEffect(() => {
    if (!portalAccessId || !me) return;
    if (workspaceDefaultAppliedForAccessId === portalAccessId) return;
    setWorkspaceMode(me.hasBoardAccess ? "board" : "owner");
    setWorkspaceDefaultAppliedForAccessId(portalAccessId);
  }, [me, portalAccessId, workspaceDefaultAppliedForAccessId]);

  useEffect(() => {
    if (activeTab !== "overview") return;
    overviewContentRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [activeTab, overviewSubtab]);

  useEffect(() => {
    const invoice = (boardVendorInvoices ?? []).find((row) => row.id === selectedVendorInvoiceId);
    if (!invoice) return;
    setVendorInvoiceDraft({
      vendorName: invoice.vendorName || "",
      invoiceNumber: invoice.invoiceNumber || "",
      invoiceDate: invoice.invoiceDate ? new Date(invoice.invoiceDate).toISOString().slice(0, 16) : "",
      dueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString().slice(0, 16) : "",
      amount: String(invoice.amount ?? ""),
      status: invoice.status,
      notes: invoice.notes || "",
    });
  }, [boardVendorInvoices, selectedVendorInvoiceId]);

  const saveAssociation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/portal/board/association", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...portalHeaders(portalAccessId) },
        body: JSON.stringify(associationDraft),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: async () => {
      await refetchBoardAssociation();
    },
  });

  const savePerson = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/portal/board/persons/${selectedPersonId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...portalHeaders(portalAccessId) },
        body: JSON.stringify(personDraft),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: async () => {
      await refetchBoardPeople();
    },
  });

  const saveUnit = useMutation({
    mutationFn: async () => {
      const payload = {
        unitNumber: unitDraft.unitNumber,
        building: unitDraft.building || null,
        squareFootage: unitDraft.squareFootage.trim() ? Number(unitDraft.squareFootage) : null,
      };
      const res = await fetch(`/api/portal/board/units/${selectedUnitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...portalHeaders(portalAccessId) },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: async () => {
      await refetchBoardUnits();
    },
  });

  const createMeeting = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/portal/board/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...portalHeaders(portalAccessId) },
        body: JSON.stringify({
          title: newMeetingDraft.title,
          meetingType: newMeetingDraft.meetingType,
          scheduledAt: newMeetingDraft.scheduledAt,
          location: newMeetingDraft.location || null,
          status: newMeetingDraft.status,
          agenda: newMeetingDraft.agenda || null,
          summaryStatus: "draft",
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<GovernanceMeeting>;
    },
    onSuccess: async (result) => {
      setNewMeetingDraft({ title: "", meetingType: "board", scheduledAt: "", location: "", status: "scheduled", agenda: "" });
      setSelectedMeetingId(result.id);
      await Promise.all([refetchBoardMeetings(), refetchBoardGovernanceTasks(), refetchBoardDashboard()]);
    },
  });

  const saveMeeting = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/portal/board/meetings/${selectedMeetingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...portalHeaders(portalAccessId) },
        body: JSON.stringify({
          title: meetingDraft.title,
          meetingType: meetingDraft.meetingType,
          scheduledAt: meetingDraft.scheduledAt,
          location: meetingDraft.location || null,
          status: meetingDraft.status,
          agenda: meetingDraft.agenda || null,
          notes: meetingDraft.notes || null,
          summaryText: meetingDraft.summaryText || null,
          summaryStatus: meetingDraft.summaryStatus,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: async () => {
      await Promise.all([refetchBoardMeetings(), refetchBoardGovernanceTasks(), refetchBoardDashboard()]);
    },
  });

  const createGovernanceTask = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/portal/board/governance-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...portalHeaders(portalAccessId) },
        body: JSON.stringify({
          title: newGovernanceTaskDraft.title,
          description: newGovernanceTaskDraft.description || null,
          status: newGovernanceTaskDraft.status,
          ownerPersonId: newGovernanceTaskDraft.ownerPersonId || null,
          dueDate: newGovernanceTaskDraft.dueDate || null,
          notes: newGovernanceTaskDraft.notes || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<AnnualGovernanceTask>;
    },
    onSuccess: async (result) => {
      setNewGovernanceTaskDraft({ title: "", description: "", status: "todo", ownerPersonId: "", dueDate: "", notes: "" });
      setSelectedGovernanceTaskId(result.id);
      await Promise.all([refetchBoardGovernanceTasks(), refetchBoardMeetings(), refetchBoardDashboard()]);
    },
  });

  const saveGovernanceTask = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/portal/board/governance-tasks/${selectedGovernanceTaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...portalHeaders(portalAccessId) },
        body: JSON.stringify({
          title: governanceTaskDraft.title,
          description: governanceTaskDraft.description || null,
          status: governanceTaskDraft.status,
          ownerPersonId: governanceTaskDraft.ownerPersonId || null,
          dueDate: governanceTaskDraft.dueDate || null,
          notes: governanceTaskDraft.notes || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: async () => {
      await Promise.all([refetchBoardGovernanceTasks(), refetchBoardMeetings(), refetchBoardDashboard()]);
    },
  });

  const createBoardDocument = useMutation({
    mutationFn: async () => {
      if (!newBoardDocumentFile) throw new Error("File is required");
      const formData = new FormData();
      formData.append("file", newBoardDocumentFile);
      formData.append("title", newBoardDocumentDraft.title);
      formData.append("documentType", newBoardDocumentDraft.documentType);
      formData.append("portalAudience", newBoardDocumentDraft.portalAudience);
      formData.append("isPortalVisible", newBoardDocumentDraft.isPortalVisible ? "1" : "0");
      const res = await fetch("/api/portal/board/documents", {
        method: "POST",
        headers: portalHeaders(portalAccessId),
        body: formData,
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<Document>;
    },
    onSuccess: async (result) => {
      setNewBoardDocumentDraft({ title: "", documentType: "", portalAudience: "owner", isPortalVisible: true });
      setNewBoardDocumentFile(null);
      setSelectedBoardDocumentId(result.id);
      await Promise.all([refetchBoardDocuments(), refetchBoardDashboard()]);
    },
  });

  const saveBoardDocument = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/portal/board/documents/${selectedBoardDocumentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...portalHeaders(portalAccessId) },
        body: JSON.stringify({
          title: boardDocumentDraft.title,
          documentType: boardDocumentDraft.documentType,
          portalAudience: boardDocumentDraft.portalAudience,
          isPortalVisible: boardDocumentDraft.isPortalVisible ? 1 : 0,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: async () => {
      await Promise.all([refetchBoardDocuments(), refetchBoardDashboard()]);
    },
  });

  const sendBoardNotice = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/portal/board/communications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...portalHeaders(portalAccessId) },
        body: JSON.stringify({
          recipientEmail: boardNoticeDraft.recipientEmail,
          subject: boardNoticeDraft.subject,
          body: boardNoticeDraft.body,
          scheduledFor: boardNoticeDraft.scheduledFor || null,
          requireApproval: boardNoticeDraft.requireApproval,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: async () => {
      setBoardNoticeDraft({ recipientEmail: "", subject: "", body: "", scheduledFor: "", requireApproval: false });
      await Promise.all([refetchBoardNoticeSends(), refetchBoardCommunicationHistory(), refetchBoardDashboard()]);
    },
  });

  const saveMaintenanceAction = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/portal/board/maintenance-requests/${selectedMaintenanceActionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...portalHeaders(portalAccessId) },
        body: JSON.stringify({
          status: maintenanceActionDraft.status,
          priority: maintenanceActionDraft.priority,
          assignedTo: maintenanceActionDraft.assignedTo || null,
          resolutionNotes: maintenanceActionDraft.resolutionNotes || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: async () => {
      await Promise.all([refetchMaintenanceRequests(), refetchBoardDashboard()]);
    },
  });

  const createVendorInvoice = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/portal/board/vendor-invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...portalHeaders(portalAccessId) },
        body: JSON.stringify({
          vendorName: newVendorInvoiceDraft.vendorName,
          invoiceNumber: newVendorInvoiceDraft.invoiceNumber || null,
          invoiceDate: newVendorInvoiceDraft.invoiceDate,
          dueDate: newVendorInvoiceDraft.dueDate || null,
          amount: Number(newVendorInvoiceDraft.amount),
          status: newVendorInvoiceDraft.status,
          notes: newVendorInvoiceDraft.notes || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<VendorInvoice>;
    },
    onSuccess: async (result) => {
      setNewVendorInvoiceDraft({ vendorName: "", invoiceNumber: "", invoiceDate: "", dueDate: "", amount: "", status: "received", notes: "" });
      setSelectedVendorInvoiceId(result.id);
      await Promise.all([refetchBoardVendorInvoices(), refetchBoardDashboard()]);
    },
  });

  const saveVendorInvoice = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/portal/board/vendor-invoices/${selectedVendorInvoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...portalHeaders(portalAccessId) },
        body: JSON.stringify({
          vendorName: vendorInvoiceDraft.vendorName,
          invoiceNumber: vendorInvoiceDraft.invoiceNumber || null,
          invoiceDate: vendorInvoiceDraft.invoiceDate,
          dueDate: vendorInvoiceDraft.dueDate || null,
          amount: Number(vendorInvoiceDraft.amount),
          status: vendorInvoiceDraft.status,
          notes: vendorInvoiceDraft.notes || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: async () => {
      await Promise.all([refetchBoardVendorInvoices(), refetchBoardDashboard()]);
    },
  });

  const createLedgerEntry = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/portal/board/owner-ledger/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...portalHeaders(portalAccessId) },
        body: JSON.stringify({
          personId: ledgerEntryDraft.personId,
          unitId: ledgerEntryDraft.unitId,
          entryType: ledgerEntryDraft.entryType,
          amount: Number(ledgerEntryDraft.amount),
          postedAt: ledgerEntryDraft.postedAt,
          description: ledgerEntryDraft.description || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: async () => {
      setLedgerEntryDraft({ personId: "", unitId: "", entryType: "charge", amount: "", postedAt: "", description: "" });
      await Promise.all([refetchBoardOwnerLedgerEntries(), refetchBoardOwnerLedgerSummary(), refetchBoardDashboard()]);
    },
  });

  if (!portalAccessId) {
    return (
      <OwnerPortalLogin
        otpStep={otpStep}
        email={email}
        otp={otp}
        otpSimulated={otpSimulated}
        associationChoices={associationChoices}
        onEmailChange={setEmail}
        onOtpChange={setOtp}
        onSendCode={() => requestLogin.mutate()}
        onVerifyCode={(opts) => verifyLogin.mutate(opts)}
        onBackToEmail={() => {
          setOtpStep("email");
          setOtp("");
          setOtpSimulated(null);
          setAssociationChoices([]);
        }}
        isLoadingEmail={requestLogin.isPending}
        isLoadingVerify={verifyLogin.isPending}
        emailError={requestLogin.isError ? (requestLogin.error as Error).message : null}
        verifyError={verifyLogin.isError ? (verifyLogin.error as Error).message : null}
      />
    );
  }

  // Block non-board accounts with no unit — portal has nothing useful to show them
  if (me && !me.hasBoardAccess && !me.unitId) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md space-y-4 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-primary-foreground text-sm font-bold mb-2">YCM</div>
          <h1 className="text-xl font-semibold">No Unit Linked to Your Account</h1>
          <p className="text-muted-foreground text-sm">
            Your account is not associated with any unit. Please contact your association management office to have your unit linked before accessing the portal.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              window.localStorage.removeItem("portalAccessId");
              setPortalAccessId("");
            }}
          >
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  const currentAssociation = myAssociations?.find((a) => a.portalAccessId === portalAccessId);
  const associationName = currentAssociation?.associationName ?? "Owner Portal";
  const associationCity = currentAssociation?.associationCity;
  const ownerDisplayName = [(me as any)?.firstName, (me as any)?.lastName].filter(Boolean).join(" ") || "Owner";

  // Units owned by this person in the current association (for the unit switcher)
  const siblingUnits = (myAssociations ?? []).filter(
    (a) => a.associationId === currentAssociation?.associationId && a.unitId
  );
  const hasMultipleUnits = siblingUnits.length > 1;
  const singleOwnedUnitLabel = siblingUnits.length === 1
    ? formatUnitContextLabel(siblingUnits[0].building, siblingUnits[0].unitNumber)
    : me?.unitNumber
      ? [me.building ? `Bldg ${me.building}` : null, `Unit ${me.unitNumber}`].filter(Boolean).join(" · ")
      : null;
  const unitLabel = hasMultipleUnits
    ? `${siblingUnits.length} units`
    : singleOwnedUnitLabel;
  const unitContextById = new Map<string, string>();
  for (const unit of myUnits) {
    unitContextById.set(unit.unitId, formatUnitContextLabel(unit.building, unit.unitNumber));
  }
  for (const unit of siblingUnits) {
    if (unit.unitId) {
      unitContextById.set(unit.unitId, formatUnitContextLabel(unit.building, unit.unitNumber));
    }
  }
  const maintenanceCountsByUnitId = new Map<string, number>();
  for (const request of maintenanceRequests ?? []) {
    if (!request.unitId || ["resolved", "closed", "rejected"].includes(request.status)) continue;
    maintenanceCountsByUnitId.set(request.unitId, (maintenanceCountsByUnitId.get(request.unitId) ?? 0) + 1);
  }
  const totalPortfolioBalance = unitsBalance.reduce((sum, unit) => sum + unit.balance, 0);
  const unitsWithBalanceDue = unitsBalance.filter((unit) => unit.balance > 0);
  const openMaintenanceRequests = (maintenanceRequests ?? []).filter(
    (request) => !["resolved", "closed", "rejected"].includes(request.status),
  );
  const urgentMaintenanceRequests = openMaintenanceRequests.filter((request) => request.priority === "urgent" || request.priority === "high");
  const recentOwnerNotices = (notices ?? [])
    .filter((notice) => !(notice.relatedType || "").startsWith("maintenance") && !(notice.relatedType || "").startsWith("work-order"))
    .sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt));
  const recentDocuments = [...(documents ?? [])].sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt));
  const ownerMessageCenterItems = [
    ...recentOwnerNotices.map((notice) => ({
      id: `notice-${notice.id}`,
      title: notice.subject || "Association notice",
      snippet: (notice.bodyText || notice.bodySnippet || "").trim() || "Review the latest association message.",
      detail: (notice.bodyText || notice.bodySnippet || "").trim() || "No message body available.",
      createdAt: notice.createdAt,
      kind: "notice" as const,
      scopeLabel: hasMultipleUnits ? "Association-wide" : unitLabel || "Association-wide",
      stateLabel: ((notice.subject || "").toLowerCase().includes("due") || (notice.subject || "").toLowerCase().includes("balance") || (notice.subject || "").toLowerCase().includes("payment"))
        ? "Action needed"
        : "For your records",
    })),
    ...maintenanceUpdates.map((notice) => ({
      id: `maintenance-update-${notice.id}`,
      title: notice.subject || "Maintenance update",
      snippet: (notice.bodyText || notice.bodySnippet || "").trim() || "There is an update on your maintenance request.",
      detail: (notice.bodyText || notice.bodySnippet || "").trim() || "No message body available.",
      createdAt: notice.createdAt,
      kind: "maintenance" as const,
      scopeLabel: "Unit-specific",
      stateLabel: "Waiting on management",
    })),
  ].sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt));
  const ownerActionItems = [
    ...(totalPortfolioBalance > 0
      ? [{
          id: "balance-due",
          tone: "high" as const,
          label: hasMultipleUnits
            ? `Review $${totalPortfolioBalance.toFixed(2)} due across ${unitsWithBalanceDue.length || myUnits.length} unit${(unitsWithBalanceDue.length || myUnits.length) === 1 ? "" : "s"}`
            : `Review $${totalPortfolioBalance.toFixed(2)} due`,
          detail: financialDashboard?.nextDueDate
            ? `Next charge due ${new Date(financialDashboard.nextDueDate).toLocaleDateString()}.`
            : "Open your financials to confirm charges, payments, and autopay.",
          tab: "financials" as const,
          cta: "Open financials",
        }]
      : []),
    ...(openMaintenanceRequests.length > 0
      ? [{
          id: "maintenance",
          tone: urgentMaintenanceRequests.length > 0 ? "high" as const : "medium" as const,
          label: `${openMaintenanceRequests.length} maintenance request${openMaintenanceRequests.length === 1 ? "" : "s"} ${openMaintenanceRequests.length === 1 ? "is" : "are"} still active`,
          detail: urgentMaintenanceRequests.length > 0
            ? `${urgentMaintenanceRequests.length} item${urgentMaintenanceRequests.length === 1 ? "" : "s"} marked high priority or urgent.`
            : "Check current status, response timing, and any follow-up needed from you.",
          tab: "maintenance" as const,
          cta: "Review maintenance",
        }]
      : []),
    {
      id: "contact-check",
      tone: "low" as const,
      label: "Confirm your contact information",
      detail: "Keep your phone, mailing address, and emergency contact details current.",
      tab: "overview" as const,
      overviewSubtab: "owner-info" as const,
      cta: "Edit contact info",
    },
    ...(recentOwnerNotices.length > 0
      ? [{
          id: "notices",
          tone: "medium" as const,
          label: `${recentOwnerNotices.length} recent notice${recentOwnerNotices.length === 1 ? "" : "s"} to review`,
          detail: recentOwnerNotices[0]?.subject
            ? `Latest: ${recentOwnerNotices[0].subject}`
            : "Open notices to review recent association messages.",
          tab: "notices" as const,
          cta: "View notices",
        }]
      : []),
    ...(hasMultipleUnits
      ? [{
          id: "portfolio",
          tone: unitsWithBalanceDue.length > 0 || maintenanceCountsByUnitId.size > 0 ? "medium" as const : "low" as const,
          label: `Review your ${myUnits.length}-unit portfolio`,
          detail: `${unitsWithBalanceDue.length} unit${unitsWithBalanceDue.length === 1 ? "" : "s"} with balance due and ${maintenanceCountsByUnitId.size} unit${maintenanceCountsByUnitId.size === 1 ? "" : "s"} with active maintenance.`,
          tab: "overview" as const,
          overviewSubtab: "occupancy" as const,
          cta: "Use selector",
        }]
      : []),
  ];
  const prioritizedOwnerActions = ownerActionItems.length > 0
    ? ownerActionItems
    : [{
        id: "all-clear",
        tone: "low" as const,
        label: "Your account looks current",
        detail: "Use the portal to review records, keep contact details current, and stay ahead of new notices.",
        tab: "documents" as const,
        cta: "Browse documents",
      }];
  const recentOwnerUpdates = [
    ...recentOwnerNotices.slice(0, 4).map((notice) => ({
      id: `notice-${notice.id}`,
      title: notice.subject || "Association notice",
      detail: stripHtml(notice.bodySnippet) || "Review the latest message from your association.",
      tab: "notices" as const,
      scopeLabel: hasMultipleUnits ? "Association-wide" : unitLabel || "Association-wide",
      kindLabel: "Notice",
      date: notice.createdAt,
    })),
    ...openMaintenanceRequests.slice(0, 4).map((request) => ({
      id: `maintenance-${request.id}`,
      title: request.title,
      detail: `${formatStatusLabel(request.status)}${request.locationText ? ` · ${request.locationText}` : ""}`,
      tab: "maintenance" as const,
      scopeLabel: request.unitId ? (unitContextById.get(request.unitId) ?? "Current unit") : "Association-wide",
      kindLabel: "Maintenance",
      date: request.updatedAt,
    })),
    ...recentDocuments.slice(0, 3).map((document) => ({
      id: `document-${document.id}`,
      title: document.title,
      detail: `${formatStatusLabel(document.documentType)} document available in your portal.`,
      tab: "documents" as const,
      scopeLabel: "Association-wide",
      kindLabel: "Document",
      date: document.createdAt,
    })),
  ]
    .sort((a, b) => toTimestamp(b.date) - toTimestamp(a.date))
    .slice(0, 6);
  const focusedOwnedUnit = myUnits.find((unit) => unit.unitId === ownedUnitFocusId) ?? myUnits[0] ?? null;
  const focusedUnitLabel = focusedOwnedUnit ? formatUnitContextLabel(focusedOwnedUnit.building, focusedOwnedUnit.unitNumber) : (unitLabel || "Current unit");
  const focusedOwnerOccupants = focusedOwnedUnit?.occupants.filter((occupant) => occupant.occupancyType === "OWNER_OCCUPIED") ?? [];
  const focusedTenantOccupant = focusedOwnedUnit?.occupants.find((occupant) => occupant.occupancyType === "TENANT") ?? null;
  const focusedOccupancyStatus = focusedOwnedUnit?.occupants.some((occupant) => occupant.occupancyType === "TENANT")
    ? "rented"
    : focusedOwnerOccupants.length > 0
      ? "owner-occupied"
      : "unknown";
  const focusedOwnerName = focusedOwnerOccupants.length > 0
    ? focusedOwnerOccupants.map((occupant) => [occupant.firstName, occupant.lastName].filter(Boolean).join(" ")).filter(Boolean).join(", ")
    : [(me as any)?.firstName, (me as any)?.lastName].filter(Boolean).join(" ") || "Owner";
  const focusedTenantName = focusedTenantOccupant
    ? [focusedTenantOccupant.firstName, focusedTenantOccupant.lastName].filter(Boolean).join(" ") || "Tenant"
    : "";
  const focusedUnitOpenMaintenanceCount = focusedOwnedUnit ? (maintenanceCountsByUnitId.get(focusedOwnedUnit.unitId) ?? 0) : 0;
  const hasSavedOwnerContactInfo = Boolean(
    (me as any)?.phone ||
    (me as any)?.mailingAddress ||
    (me as any)?.emergencyContactName ||
    (me as any)?.emergencyContactPhone ||
    (me as any)?.contactPreference,
  );
  const switchOwnerUnit = (nextPortalAccessId: string, nextUnitId?: string | null) => {
    setPortalAccessId(nextPortalAccessId);
    window.localStorage.setItem("portalAccessId", nextPortalAccessId);
    if (nextUnitId) {
      setOwnedUnitFocusId(nextUnitId);
    }
    setWorkspaceMode("owner");
  };
  const resetOwnerInfoForm = () => {
    setRequestedPhone((me as any)?.phone ?? "");
    setRequestedMailingAddress((me as any)?.mailingAddress ?? "");
    setRequestedEmergencyContactName((me as any)?.emergencyContactName ?? "");
    setRequestedEmergencyContactPhone((me as any)?.emergencyContactPhone ?? "");
    setRequestedContactPreference((me as any)?.contactPreference ?? "");
  };
  const resetOccupancyForm = () => {
    const focusedUnit = myUnits.find((unit) => unit.unitId === ownedUnitFocusId) ?? myUnits[0] ?? null;
    if (!focusedUnit) return;
    const tenant = focusedUnit.occupants.find((occupant) => occupant.occupancyType === "TENANT");
    const hasTenant = Boolean(tenant);
    setOccupancyForm({
      occupancyType: hasTenant ? "TENANT" : "OWNER_OCCUPIED",
      tenantFirstName: tenant?.firstName ?? "",
      tenantLastName: tenant?.lastName ?? "",
      tenantEmail: tenant?.email ?? "",
      tenantPhone: tenant?.phone ?? "",
      notes: "",
    });
  };
  const openOwnerView = (
    tab: "overview" | "financials" | "maintenance" | "documents" | "notices",
    nextOverviewSubtab?: "summary" | "owner-info" | "occupancy",
  ) => {
    setActiveTab(tab);
    if (tab === "overview" && nextOverviewSubtab) {
      setOverviewSubtab(nextOverviewSubtab);
    }
  };
  const renderOwnerUnitSelector = (options: {
    activeUnitId: string | null | undefined;
    onSelect: (unit: typeof myUnits[number]) => void;
  }) => (
    <div className="space-y-3">
      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-semibold">Choose unit</div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {myUnits.map((unit) => {
          const isActive = options.activeUnitId === unit.unitId;
          return (
            <button
              key={unit.unitId}
              type="button"
              onClick={() => options.onSelect(unit)}
              className={`min-w-[220px] rounded-xl border px-4 py-3 text-left transition-colors hover:bg-muted/30 ${
                isActive ? "border-primary/40 bg-primary/5" : "bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{formatUnitContextLabel(unit.building, unit.unitNumber)}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {unit.balance > 0 ? `$${unit.balance.toFixed(2)} due` : unit.balance < 0 ? `Credit $${Math.abs(unit.balance).toFixed(2)}` : "Current"}
                  </div>
                </div>
                {isActive ? <Badge>Selected</Badge> : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
  const markNoticeRead = (noticeId: string) => {
    setReadNoticeIds((current) => {
      if (current.includes(noticeId)) return current;
      const next = [...current, noticeId];
      window.localStorage.setItem(`portal-read-notices-${portalAccessId}`, JSON.stringify(next));
      return next;
    });
  };
  const portalLedgerEntries = portalLedger?.entries ?? [];
  const focusedFinancialUnit = focusedOwnedUnit ?? null;
  const focusedFinancialLedgerEntries = focusedFinancialUnit
    ? portalLedgerEntries.filter((entry) => entry.unitId === focusedFinancialUnit.unitId)
    : portalLedgerEntries;
  const recentPayments = portalLedgerEntries
    .filter((entry) => entry.entryType === "payment" || entry.entryType === "credit")
    .sort((a, b) => toTimestamp(b.postedAt) - toTimestamp(a.postedAt))
    .slice(0, 3);
  const currentUnitPayableBalance = Math.max(0, focusedFinancialUnit?.balance ?? 0);
  const defaultPaymentMethod = savedMethods.find((method) => method.isDefault === 1 && method.isActive !== 0) ?? savedMethods.find((method) => method.isActive !== 0) ?? null;
  const activeAutopayEnrollment = autopayEnrollments.find((entry) => entry.status === "active") ?? null;
  const recentFocusedPayment = focusedFinancialLedgerEntries
    .filter((entry) => entry.entryType === "payment" || entry.entryType === "credit")
    .sort((a, b) => toTimestamp(b.postedAt) - toTimestamp(a.postedAt))[0] ?? null;
  const paymentSetupStateLabel = activeAutopayEnrollment
    ? "Autopay active"
    : defaultPaymentMethod
      ? "Method saved"
      : "Setup needed";
  const paymentSetupStateTone = activeAutopayEnrollment || defaultPaymentMethod
    ? "bg-green-50 text-green-700"
    : "bg-amber-50 text-amber-700";
  const boardAttentionItems = boardDashboard?.attention.items ?? [];
  const boardUpcomingMeetings = boardDashboard?.governance.upcomingMeetings ?? [];
  const boardOpenTasks = boardDashboard?.governance.openTasks ?? [];
  const boardRecentActivity = boardDashboard?.activity.recent ?? [];
  const boardPackageStates = boardDashboard?.workflowStates.communications.boardPackagesByStatus ?? {
    draft: 0,
    approved: 0,
    distributed: 0,
  };
  const boardRoleTitle = boardDashboard?.workflowStates.access.boardRole ?? "Board Member";
  const boardTerm = boardDashboard?.workflowStates.access.boardTerm ?? null;
  const nextBoardMeeting = boardUpcomingMeetings[0] ?? null;
  const boardRoleFocus = (() => {
    const normalizedRole = boardRoleTitle.toLowerCase();
    if (normalizedRole.includes("president")) {
      return "Lead on agenda decisions, escalations, and meeting readiness.";
    }
    if (normalizedRole.includes("treasurer")) {
      return "Lead with cash exposure, reserve signals, delinquency, and unusual spend.";
    }
    if (normalizedRole.includes("secretary")) {
      return "Lead with agendas, minutes, resolutions, and compliance acknowledgments.";
    }
    return "Lead with board package review, current decisions, and unresolved association risk.";
  })();
  const boardRiskHighlights = [
    ...(boardDashboard?.attention.maintenanceOverdue
      ? [{
          key: "risk-maintenance",
          label: `${boardDashboard.attention.maintenanceOverdue} overdue maintenance item${boardDashboard.attention.maintenanceOverdue === 1 ? "" : "s"}`,
          detail: "Open maintenance delays can create liability and owner-trust risk.",
          tone: "high" as const,
        }]
      : []),
    ...(boardDashboard?.attention.overdueGovernanceTasks
      ? [{
          key: "risk-governance",
          label: `${boardDashboard.attention.overdueGovernanceTasks} overdue governance task${boardDashboard.attention.overdueGovernanceTasks === 1 ? "" : "s"}`,
          detail: "Board checklist items are past due and need explicit ownership.",
          tone: "high" as const,
        }]
      : []),
    ...((boardDashboard?.financial.openBalance ?? 0) > 0
      ? [{
          key: "risk-ledger",
          label: `$${boardDashboard?.financial.openBalance?.toFixed(2) ?? "0.00"} outstanding owner balance`,
          detail: "Delinquency exposure should be reviewed before the next meeting.",
          tone: "medium" as const,
        }]
      : []),
    ...((boardPackageStates.draft ?? 0) > 0
      ? [{
          key: "risk-packages",
          label: `${boardPackageStates.draft} board package${boardPackageStates.draft === 1 ? "" : "s"} still in draft`,
          detail: "Meeting materials may not be ready for board review or distribution.",
          tone: "medium" as const,
        }]
      : []),
    ...((boardDashboard?.workflowStates.communications.documentsInternalOnly ?? 0) > 0
      ? [{
          key: "risk-documents",
          label: `${boardDashboard?.workflowStates.communications.documentsInternalOnly ?? 0} internal-only document${(boardDashboard?.workflowStates.communications.documentsInternalOnly ?? 0) === 1 ? "" : "s"}`,
          detail: "Confirm whether unpublished documents should stay internal or be distributed.",
          tone: "low" as const,
        }]
      : []),
  ];
  const boardDecisionCards = [
    ...(nextBoardMeeting
      ? [{
          key: "decision-meeting",
          title: nextBoardMeeting.title,
          recommendation: nextBoardMeeting.summaryStatus === "draft"
            ? "Review agenda and publish the board summary before the meeting."
            : "Confirm the board package and decision materials are ready for review.",
          evidence: `${new Date(nextBoardMeeting.scheduledAt).toLocaleString()}${nextBoardMeeting.meetingType ? ` · ${nextBoardMeeting.meetingType}` : ""}`,
          dueLabel: `Meeting on ${new Date(nextBoardMeeting.scheduledAt).toLocaleDateString()}`,
          auditLabel: `Meeting status ${formatStatusLabel(nextBoardMeeting.status)} · summary ${formatStatusLabel(nextBoardMeeting.summaryStatus)}`,
          tone: nextBoardMeeting.summaryStatus === "draft" ? "high" as const : "medium" as const,
        }]
      : []),
    ...boardOpenTasks.slice(0, 2).map((task) => ({
      key: `decision-task-${task.id}`,
      title: task.title,
      recommendation: task.status === "todo"
        ? "Assign ownership and close the task before it slips into the next board cycle."
        : "Review progress and confirm the task has what it needs to close.",
      evidence: task.dueDate ? `Due ${new Date(task.dueDate).toLocaleDateString()}` : "No due date is currently set.",
      dueLabel: task.dueDate ? `Due ${new Date(task.dueDate).toLocaleDateString()}` : "Add a due date",
      auditLabel: `Governance task status ${formatStatusLabel(task.status)}`,
      tone: task.dueDate && new Date(task.dueDate).getTime() < Date.now() ? "high" as const : "medium" as const,
    })),
    ...((boardDashboard?.financial.openBalance ?? 0) > 0
      ? [{
          key: "decision-balance",
          title: "Outstanding owner balance exposure",
          recommendation: "Review delinquencies and confirm whether follow-up or payment-plan action is needed before the next meeting.",
          evidence: `$${boardDashboard?.financial.openBalance?.toFixed(2) ?? "0.00"} remains open across the association ledger.`,
          dueLabel: nextBoardMeeting ? `Discuss before ${new Date(nextBoardMeeting.scheduledAt).toLocaleDateString()}` : "Review this cycle",
          auditLabel: `${boardDashboard?.financial.ledgerEntryCount ?? 0} ledger entries recorded`,
          tone: "medium" as const,
        }]
      : []),
    ...((boardPackageStates.draft ?? 0) > 0
      ? [{
          key: "decision-packages",
          title: "Board package distribution readiness",
          recommendation: "Move draft packages toward approval so directors are not reviewing stale or incomplete material.",
          evidence: `${boardPackageStates.draft} package${boardPackageStates.draft === 1 ? "" : "s"} still sit in draft status.`,
          dueLabel: nextBoardMeeting ? `Before ${new Date(nextBoardMeeting.scheduledAt).toLocaleDateString()}` : "Before the next board session",
          auditLabel: `${boardPackageStates.approved ?? 0} approved · ${boardPackageStates.distributed ?? 0} distributed`,
          tone: "medium" as const,
        }]
      : []),
  ].slice(0, 4);
  const boardRecentChangeSummary = boardRecentActivity.slice(0, 3);
  const boardActivityItems = boardRecentActivity.map((entry) => {
    const classification = entry.lane && entry.laneLabel
      ? { lane: entry.lane, label: entry.laneLabel }
      : classifyBoardActivity(entry);
    return {
      ...entry,
      lane: classification.lane,
      laneLabel: classification.label,
      title: entry.summary || `${formatStatusLabel(entry.action)} ${formatStatusLabel(entry.entityType)}`.trim(),
    };
  });
  const filteredBoardActivityItems = boardActivityItems.filter((entry) => boardActivityFilter === "all" || entry.lane === boardActivityFilter);
  const boardScopeRules = [
    "Board access stays limited to this association.",
    "Platform admin controls and other associations remain hidden.",
    "Owner and board permissions combine under one signed-in identity.",
    "Board actions should remain attributable to the acting person.",
  ];
  const boardMeetingReadinessItems = [
    {
      key: "readiness-meeting",
      label: nextBoardMeeting ? "Next meeting scheduled" : "Next meeting still missing",
      detail: nextBoardMeeting
        ? `${nextBoardMeeting.title} is set for ${new Date(nextBoardMeeting.scheduledAt).toLocaleString()}.`
        : "Schedule the next board session so packages, decisions, and follow-up have a concrete operating date.",
      done: Boolean(nextBoardMeeting),
      tone: nextBoardMeeting ? "low" as const : "high" as const,
    },
    {
      key: "readiness-summary",
      label: (boardDashboard?.attention.draftMeetingCount ?? 0) === 0 ? "Meeting summaries are published" : "Meeting summaries still in draft",
      detail: (boardDashboard?.attention.draftMeetingCount ?? 0) === 0
        ? "No draft meeting summaries are blocking board review right now."
        : `${boardDashboard?.attention.draftMeetingCount ?? 0} meeting summary draft${(boardDashboard?.attention.draftMeetingCount ?? 0) === 1 ? "" : "s"} should be finalized or published.`,
      done: (boardDashboard?.attention.draftMeetingCount ?? 0) === 0,
      tone: (boardDashboard?.attention.draftMeetingCount ?? 0) === 0 ? "low" as const : "medium" as const,
    },
    {
      key: "readiness-tasks",
      label: boardOpenTasks.length === 0 ? "No open board follow-up tasks" : "Open board follow-up remains",
      detail: boardOpenTasks.length === 0
        ? "The governance follow-up queue is currently clear."
        : `${boardOpenTasks.length} open governance task${boardOpenTasks.length === 1 ? "" : "s"} still need ownership or closure.`,
      done: boardOpenTasks.length === 0,
      tone: boardOpenTasks.length === 0 ? "low" as const : "medium" as const,
    },
    {
      key: "readiness-packages",
      label: (boardPackageStates.draft ?? 0) === 0 ? "Board packages are out of draft" : "Board packages still need release review",
      detail: (boardPackageStates.draft ?? 0) === 0
        ? `${boardPackageStates.approved ?? 0} approved and ${boardPackageStates.distributed ?? 0} distributed package${(boardPackageStates.approved ?? 0) + (boardPackageStates.distributed ?? 0) === 1 ? "" : "s"} are already moving through the board loop.`
        : `${boardPackageStates.draft ?? 0} package${(boardPackageStates.draft ?? 0) === 1 ? "" : "s"} remain in draft and may block pre-meeting review.`,
      done: (boardPackageStates.draft ?? 0) === 0,
      tone: (boardPackageStates.draft ?? 0) === 0 ? "low" as const : "medium" as const,
    },
  ];
  const boardPackageReviewRows = [
    {
      key: "package-draft",
      label: "Draft packages",
      value: boardPackageStates.draft ?? 0,
      detail: "Still being assembled or awaiting review.",
      tone: (boardPackageStates.draft ?? 0) > 0 ? "medium" as const : "low" as const,
    },
    {
      key: "package-approved",
      label: "Approved packages",
      value: boardPackageStates.approved ?? 0,
      detail: "Ready for the board to consume or confirm.",
      tone: (boardPackageStates.approved ?? 0) > 0 ? "low" as const : "low" as const,
    },
    {
      key: "package-distributed",
      label: "Distributed packages",
      value: boardPackageStates.distributed ?? 0,
      detail: "Already sent into the board review loop.",
      tone: (boardPackageStates.distributed ?? 0) > 0 ? "low" as const : "low" as const,
    },
    {
      key: "package-internal",
      label: "Internal-only documents",
      value: boardDashboard?.workflowStates.communications.documentsInternalOnly ?? 0,
      detail: "Confirm whether these should remain internal or support board prep.",
      tone: (boardDashboard?.workflowStates.communications.documentsInternalOnly ?? 0) > 0 ? "medium" as const : "low" as const,
    },
  ];

  const scrollToBoardSection = (sectionId: string) => {
    const target = document.getElementById(sectionId);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const ownerTabs = [
    { id: "overview" as const, label: "Overview" },
    { id: "financials" as const, label: "Financials" },
    { id: "maintenance" as const, label: "Maintenance" },
    { id: "documents" as const, label: "Documents" },
    { id: "notices" as const, label: "Notices" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
      {/* Top header bar */}
      <div className="sticky top-0 z-10 border-b bg-white/95 backdrop-blur">
        <div className="flex flex-col gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">YCM</div>
            <div className="min-w-0">
              <div className="font-semibold text-sm truncate">Owner Portal</div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">{ownerDisplayName}</span>
                {(me as any)?.email && <span className="text-xs text-muted-foreground">· {(me as any).email}</span>}
                {hasBoardAccess ? <Badge variant="secondary" className="text-[10px] uppercase tracking-[0.18em]">Board access</Badge> : null}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {me?.hasBoardAccess ? (
              <Button
                variant={workspaceMode === "board" ? "default" : "outline"}
                size="sm"
                className="min-h-10"
                onClick={() => {
                  setWorkspaceMode(workspaceMode === "board" ? "owner" : "board");
                  if (workspaceMode === "board") {
                    setActiveTab("overview");
                  }
                }}
              >
                {workspaceMode === "board" ? "Return to Owner Portal" : "Open Board Workspace"}
              </Button>
            ) : null}
            {/* Association switcher — shown only when owner has access to multiple distinct associations */}
            {workspaceMode === "owner" && myAssociations && new Set(myAssociations.map((a) => a.associationId)).size > 1 && (
              <Select
                value={portalAccessId}
                onValueChange={(val) => {
                  setPortalAccessId(val);
                  window.localStorage.setItem("portalAccessId", val);
                  setWorkspaceMode("owner");
                  setActiveTab("overview");
                }}
              >
                <SelectTrigger className="h-10 w-full min-w-[12rem] text-xs sm:w-44">
                  <SelectValue placeholder="Switch association" />
                </SelectTrigger>
                <SelectContent>
                  {myAssociations.map((a) => (
                    <SelectItem key={a.portalAccessId} value={a.portalAccessId}>
                      <div>
                        <div className="font-medium">{a.associationName}</div>
                        {a.associationCity && <div className="text-xs text-muted-foreground">{a.associationCity}</div>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              variant="outline"
              size="sm"
              className="min-h-10"
              onClick={() => {
                window.localStorage.removeItem("portalAccessId");
                setPortalAccessId("");
              }}
            >
              Sign Out
            </Button>
          </div>
        </div>
        </div>

        {workspaceMode === "owner" && (
          <div className="border-t bg-gradient-to-br from-slate-800 to-slate-700 px-4 py-5 text-white sm:px-6">
            {hasBoardAccess ? (
              <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <Card className="border-white/10 bg-white/5 text-white shadow-none">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Board-first landing</div>
                        <h2 className="text-2xl md:text-3xl font-bold leading-tight">
                          {portalAssociation?.name ?? associationName}
                        </h2>
                        <p className="mt-1 max-w-2xl text-sm text-slate-300">
                          {portalRoleLabel} access surfaces board context first, while the owner tabs stay available for self-service and unit-level follow-up.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary" className="bg-white text-slate-800">{portalRoleLabel}</Badge>
                        <Badge variant="outline" className="border-white/20 text-slate-100">{boardRoleTitle}</Badge>
                        <Badge variant="outline" className="border-white/20 text-slate-100">1 association scope</Badge>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {boardAttentionItems.slice(0, 4).map((item) => (
                        <div key={item.key} className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-medium">{item.label}</div>
                            <Badge variant={item.tone === "high" ? "destructive" : item.tone === "medium" ? "default" : "outline"}>
                              {item.tone}
                            </Badge>
                          </div>
                          <div className="text-sm text-slate-300">{item.detail}</div>
                        </div>
                      ))}
                      {boardAttentionItems.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-white/20 bg-white/5 p-4 text-sm text-slate-300">
                          No urgent board actions are currently surfaced. Review the decision queue below if you need the next step.
                        </div>
                      ) : null}
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl border border-white/10 bg-slate-900/30 p-4 space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Board context</div>
                        <div className="text-sm text-slate-300">
                          {nextBoardMeeting
                            ? `Next meeting: ${nextBoardMeeting.title} on ${new Date(nextBoardMeeting.scheduledAt).toLocaleDateString()}.`
                            : "No board meeting is scheduled yet. Use the board workspace for decisions and scheduling."}
                        </div>
                        <div className="text-xs text-slate-400">
                          {boardRoleFocus}
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-slate-900/30 p-4 space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Board workspace</div>
                        <div className="text-sm text-slate-300">
                          Open the board workspace when you need decisions, meetings, or audit history instead of owner self-service.
                        </div>
                        <Button
                          variant="outline"
                          className="border-white/20 bg-white text-slate-900 hover:bg-slate-100"
                          onClick={() => setWorkspaceMode("board")}
                        >
                          Open Board Workspace
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  <Card className="border-white/10 bg-white/5 text-white shadow-none">
                    <CardContent className="p-5 space-y-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Owner self-service</div>
                      <div className="text-lg font-semibold">Your units and balances stay one tap away</div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg bg-white/10 p-3">
                          <div className="text-xs text-slate-400">Units in portal</div>
                          <div className="mt-1 text-xl font-semibold">{myUnits.length || (me?.unitId ? 1 : 0)}</div>
                        </div>
                        <div className="rounded-lg bg-white/10 p-3">
                          <div className="text-xs text-slate-400">Open balance</div>
                          <div className="mt-1 text-xl font-semibold">
                            {totalPortfolioBalance > 0
                              ? `$${totalPortfolioBalance.toFixed(2)}`
                              : totalPortfolioBalance < 0
                              ? `Credit $${Math.abs(totalPortfolioBalance).toFixed(2)}`
                              : "$0.00"}
                          </div>
                        </div>
                      </div>
                      <div className="rounded-lg bg-white/10 p-3 text-sm text-slate-200">
                        {focusedUnitLabel}
                        <div className="mt-1 text-xs text-slate-400">
                          {focusedUnitOpenMaintenanceCount} active maintenance item{focusedUnitOpenMaintenanceCount === 1 ? "" : "s"} and {recentOwnerNotices.length} recent notice{recentOwnerNotices.length === 1 ? "" : "s"}.
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          className="bg-white text-slate-900 hover:bg-slate-100"
                          onClick={() => setActiveTab("financials")}
                        >
                          Open Financials
                        </Button>
                        <Button size="sm" variant="outline" className="border-white/20 text-white hover:bg-white/10" onClick={() => setActiveTab("documents")}>
                          Browse Documents
                        </Button>
                        <Button size="sm" variant="outline" className="border-white/20 text-white hover:bg-white/10" onClick={() => setActiveTab("maintenance")}>
                          Review Maintenance
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {hasMultipleUnits ? (
                    <div className="shrink-0 space-y-2 rounded-xl bg-white/10 px-4 py-3 text-sm">
                      <div className="text-slate-400 text-xs uppercase tracking-wide">Your Units ({siblingUnits.length})</div>
                      <div className="flex flex-wrap gap-2">
                        {siblingUnits.map((u) => {
                          const lbl = u.unitNumber
                            ? [u.building ? `Bldg ${u.building}` : null, `Unit ${u.unitNumber}`].filter(Boolean).join(" · ")
                            : "Unit";
                          const isCurrent = u.portalAccessId === portalAccessId;
                          return (
                            <button
                              key={u.portalAccessId}
                              onClick={() => {
                                if (!isCurrent) {
                                  switchOwnerUnit(u.portalAccessId, u.unitId);
                                  setActiveTab("overview");
                                }
                              }}
                              className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                                isCurrent
                                  ? "bg-white text-slate-800"
                                  : "bg-white/20 text-white hover:bg-white/30"
                              }`}
                            >
                              {lbl}
                              {isCurrent && <span className="ml-1 opacity-60">↗</span>}
                            </button>
                          );
                        })}
                      </div>
                      <div className="text-slate-300 text-xs capitalize">{portalRoleLabel}</div>
                    </div>
                  ) : unitLabel ? (
                    <div className="shrink-0 rounded-xl bg-white/10 px-4 py-3 text-sm">
                      <div className="text-slate-400 text-xs uppercase tracking-wide mb-0.5">Your Unit</div>
                      <div className="font-semibold text-white">{unitLabel}</div>
                      <div className="text-slate-300 text-xs capitalize mt-0.5">{portalRoleLabel}</div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Your Association</div>
                  <h2 className="text-2xl md:text-3xl font-bold leading-tight">
                    {portalAssociation?.name ?? associationName}
                  </h2>
                  {portalAssociation && (
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-300 pt-1">
                      {portalAssociation.associationType && (
                        <span className="capitalize">{portalAssociation.associationType.replace(/-/g, " ")}</span>
                      )}
                      {portalAssociation.address && (
                        <span>
                          {[portalAssociation.address, portalAssociation.city, portalAssociation.state]
                            .filter(Boolean).join(", ")}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {hasMultipleUnits ? (
                  <div className="shrink-0 space-y-2 rounded-xl bg-white/10 px-4 py-3 text-sm md:max-w-sm">
                    <div className="text-slate-400 text-xs uppercase tracking-wide">Your Units ({siblingUnits.length})</div>
                    <div className="flex flex-wrap gap-2">
                      {siblingUnits.map((u) => {
                        const lbl = u.unitNumber
                          ? [u.building ? `Bldg ${u.building}` : null, `Unit ${u.unitNumber}`].filter(Boolean).join(" · ")
                          : "Unit";
                        const isCurrent = u.portalAccessId === portalAccessId;
                        return (
                          <button
                            key={u.portalAccessId}
                            onClick={() => {
                              if (!isCurrent) {
                                switchOwnerUnit(u.portalAccessId, u.unitId);
                                setActiveTab("overview");
                              }
                            }}
                            className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                              isCurrent
                                ? "bg-white text-slate-800"
                                : "bg-white/20 text-white hover:bg-white/30"
                            }`}
                          >
                            {lbl}
                            {isCurrent && <span className="ml-1 opacity-60">↗</span>}
                          </button>
                        );
                      })}
                    </div>
                    <div className="text-slate-300 text-xs capitalize">{portalRoleLabel}</div>
                  </div>
                ) : unitLabel ? (
                  <div className="shrink-0 rounded-xl bg-white/10 px-4 py-3 text-sm">
                    <div className="text-slate-400 text-xs uppercase tracking-wide mb-0.5">Your Unit</div>
                    <div className="font-semibold text-white">{unitLabel}</div>
                    <div className="text-slate-300 text-xs capitalize mt-0.5">{portalRoleLabel}</div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}

        {workspaceMode === "owner" ? (
          <div className="hidden border-t px-4 py-3 sm:px-6 md:block">
            <MobileTabBar items={ownerTabs} value={activeTab} onChange={setActiveTab} />
          </div>
        ) : (
          <div className="border-t bg-slate-50 px-4 py-3 sm:px-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-semibold">Board Workspace</div>
                <div className="text-sm text-muted-foreground mt-1">Board operations are separated from owner self-service for the current association.</div>
              </div>
              <Badge variant="outline">{boardRoleTitle}</Badge>
            </div>
          </div>
        )}
      </div>

      {workspaceMode === "owner" && (financialDashboard?.balance ?? 0) > 0 && (
        <div className={`flex flex-col items-start justify-between gap-2 border-b px-4 py-3 sm:flex-row sm:items-center sm:px-6 ${
          (financialDashboard?.balance ?? 0) > 500
            ? "bg-red-50 border-red-100"
            : (financialDashboard?.balance ?? 0) > 0
            ? "bg-amber-50 border-amber-100"
            : "bg-green-50 border-green-100"
        }`}>
          <div className="flex items-center gap-3 min-w-0">
            <div>
              <span className="text-xs text-muted-foreground">Current Balance</span>
              <span className={`ml-2 font-bold text-sm ${
                (financialDashboard?.balance ?? 0) > 0 ? "text-red-700" : "text-green-700"
              }`}>
                ${(financialDashboard?.balance ?? 0).toFixed(2)}
              </span>
            </div>
            {financialDashboard?.nextDueDate && (
              <span className="text-xs text-muted-foreground hidden sm:inline">
                · Due {new Date(financialDashboard.nextDueDate).toLocaleDateString()}
              </span>
            )}
          </div>
          <Button
            size="sm"
            variant="default"
            className="h-9 shrink-0 px-3 text-xs sm:h-7"
            onClick={() => setActiveTab("financials")}
          >
            Pay Now
          </Button>
        </div>
      )}

      <div className="mx-auto max-w-5xl space-y-6 px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 md:space-y-8 md:px-8 md:pb-8">

      {/* Overview Tab: association hero + onboarding + balance + notices */}
      {workspaceMode === "owner" && activeTab === "overview" && (
        <>
	          <div className="space-y-4">
              <MobileTabBar
                items={[
                  { id: "summary" as const, label: "Summary" },
                  { id: "owner-info" as const, label: "Owner Info" },
                  { id: "occupancy" as const, label: "Occupancy" },
                ]}
                value={overviewSubtab}
                onChange={setOverviewSubtab}
                fullWidth
              />

	            <div
                ref={overviewContentRef}
                className={`space-y-6 pr-0 md:space-y-8 ${isMobile ? "" : "lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto lg:pr-1"}`}
              >

          {overviewSubtab === "summary" && (
            <>
          {hasBoardAccess ? (
            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <Card>
                <CardContent className="p-6 space-y-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-semibold">Board first</div>
                      <div className="font-semibold text-xl mt-1">What the board needs to see next</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {boardAttentionItems.length > 0
                          ? "Start with the board attention queue, meeting readiness, and the next decision that needs action."
                          : "Start with the board decision queue, even when the immediate action list is quiet."}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant={nextBoardMeeting ? "default" : "outline"}>
                        {nextBoardMeeting ? `Next meeting ${new Date(nextBoardMeeting.scheduledAt).toLocaleDateString()}` : "No meeting scheduled"}
                      </Badge>
                      <Badge variant={boardOpenTasks.length > 0 ? "default" : "outline"}>
                        {boardOpenTasks.length} open board task{boardOpenTasks.length === 1 ? "" : "s"}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {boardDecisionCards.length > 0 ? (
                      boardDecisionCards.slice(0, 3).map((item, index) => (
                        <div key={item.key} className={`rounded-xl border p-4 gap-4 ${isMobile ? "space-y-3" : "flex items-start justify-between"}`}>
                          <div className="flex items-start gap-3 min-w-0">
                            <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                              item.tone === "high"
                                ? "bg-red-50 text-red-700"
                                : item.tone === "medium"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-slate-100 text-slate-700"
                            }`}>
                              {index + 1}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="font-medium">{item.title}</div>
                                <Badge variant={item.tone === "high" ? "destructive" : item.tone === "medium" ? "default" : "outline"}>
                                  {item.tone === "high" ? "Needs decision" : "Review"}
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground mt-1">{item.recommendation}</div>
                              <div className="text-xs text-muted-foreground mt-2">
                                {item.evidence} · {item.auditLabel}
                              </div>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            className={isMobile ? "min-h-11 w-full" : undefined}
                            variant={item.tone === "high" ? "default" : "outline"}
                            onClick={() => setWorkspaceMode("board")}
                          >
                            Open board workspace
                          </Button>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                        Board decision data is still loading. Use the board workspace button above when you need the full oversight view.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card>
                  <CardContent className="p-6 space-y-4">
                    <div>
                      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-semibold">Owner self-service</div>
                      <div className="font-semibold text-lg mt-1">{hasMultipleUnits ? "Across all your units" : "Current unit snapshot"}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg bg-slate-50 p-4">
                        <div className="text-xs text-muted-foreground">Amount due</div>
                        <div className={`text-xl font-semibold mt-1 ${totalPortfolioBalance > 0 ? "text-red-600" : "text-green-600"}`}>
                          {totalPortfolioBalance > 0
                            ? `$${totalPortfolioBalance.toFixed(2)}`
                            : totalPortfolioBalance < 0
                            ? `Credit $${Math.abs(totalPortfolioBalance).toFixed(2)}`
                            : "$0.00"}
                        </div>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-4">
                        <div className="text-xs text-muted-foreground">Units in portal</div>
                        <div className="text-xl font-semibold mt-1">{myUnits.length || (me?.unitId ? 1 : 0)}</div>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-4">
                        <div className="text-xs text-muted-foreground">Open maintenance</div>
                        <div className="text-xl font-semibold mt-1">{openMaintenanceRequests.length}</div>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-4">
                        <div className="text-xs text-muted-foreground">Recent notices</div>
                        <div className="text-xl font-semibold mt-1">{recentOwnerNotices.length}</div>
                      </div>
                    </div>
                    {financialDashboard?.nextDueDate ? (
                      <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                        Next charge due on {new Date(financialDashboard.nextDueDate).toLocaleDateString()}.
                      </div>
                    ) : null}
                    <div className={`rounded-xl border bg-white/80 p-4 ${isMobile ? "space-y-4" : "grid gap-4 md:grid-cols-[1.1fr_0.9fr]"}`}>
                      <div className="space-y-3">
                        <div>
                          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">Current Unit</div>
                          <div className="mt-1 text-lg font-semibold">{focusedUnitLabel}</div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {focusedUnitOpenMaintenanceCount} active maintenance item{focusedUnitOpenMaintenanceCount === 1 ? "" : "s"} and
                            {" "}
                            {focusedOccupancyStatus === "rented"
                              ? "tenant occupancy"
                              : focusedOccupancyStatus === "owner-occupied"
                              ? "owner occupancy"
                              : "occupancy not confirmed"}.
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-lg bg-slate-50 p-3">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Owner</div>
                            <div className="mt-1 text-sm font-medium">{focusedOwnerName}</div>
                          </div>
                          <div className="rounded-lg bg-slate-50 p-3">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Occupancy</div>
                            <div className="mt-1 text-sm font-medium">
                              {focusedOccupancyStatus === "rented" ? "Rented" : focusedOccupancyStatus === "owner-occupied" ? "Owner Occupied" : "Unknown"}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        <Button
                          variant="outline"
                          className={isMobile ? "min-h-11 w-full" : "justify-between"}
                          onClick={() => openOwnerView("overview", "owner-info")}
                        >
                          Review contact details
                        </Button>
                        <Button
                          variant="outline"
                          className={isMobile ? "min-h-11 w-full" : "justify-between"}
                          onClick={() => openOwnerView("overview", "occupancy")}
                        >
                          Review occupancy
                        </Button>
                        <div className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
                          {focusedTenantName ? `Current tenant: ${focusedTenantName}` : "No tenant details are currently stored for this unit."}
                        </div>
                      </div>
                    </div>
                    {unitsBalance.length > 0 ? (
                      <div className="space-y-2">
                        {unitsBalance.map((unit) => {
                          const label = formatUnitContextLabel(unit.building, unit.unitNumber);
                          const isCurrent = unit.portalAccessId === portalAccessId;
                          const openCount = maintenanceCountsByUnitId.get(unit.unitId) ?? 0;
                          return (
                            <button
                              key={unit.unitId}
                              className={`w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/30 ${isCurrent ? "border-primary/40 bg-primary/5" : ""}`}
                              onClick={() => {
                                if (unit.portalAccessId && unit.portalAccessId !== portalAccessId) {
                                  switchOwnerUnit(unit.portalAccessId, unit.unitId);
                                }
                              }}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <div className="text-sm font-medium">{label}</div>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {openCount} active maintenance item{openCount === 1 ? "" : "s"}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className={`text-sm font-semibold ${unit.balance > 0 ? "text-red-600" : "text-green-600"}`}>
                                    {unit.balance > 0 ? `$${unit.balance.toFixed(2)} due` : unit.balance < 0 ? `Credit $${Math.abs(unit.balance).toFixed(2)}` : "$0.00"}
                                  </div>
                                  {isCurrent ? <div className="text-xs text-primary mt-1">Viewing now</div> : null}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6 space-y-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-semibold">Board mode</div>
                    <div className="font-semibold text-lg">Association board workspace is available</div>
                    <div className="text-sm text-muted-foreground">Switch deliberately when you need meetings, board decisions, or association oversight instead of owner self-service.</div>
                    <Button variant="outline" onClick={() => setWorkspaceMode("board")}>Open Board Workspace</Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
              <Card>
                <CardContent className="p-6 space-y-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-semibold">Owner Agenda</div>
                      <div className="font-semibold text-xl mt-1">What needs your attention next</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {hasMultipleUnits
                          ? "Start with the highest-priority account and unit tasks across your portfolio."
                          : "Start with the next owner task that matters for your account."}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant={totalPortfolioBalance > 0 ? "destructive" : "secondary"}>
                        {totalPortfolioBalance > 0
                          ? `$${totalPortfolioBalance.toFixed(2)} due`
                          : totalPortfolioBalance < 0
                          ? `Credit $${Math.abs(totalPortfolioBalance).toFixed(2)}`
                          : "Account current"}
                      </Badge>
                      <Badge variant={openMaintenanceRequests.length > 0 ? "default" : "outline"}>
                        {openMaintenanceRequests.length} open maintenance
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {prioritizedOwnerActions.map((item, index) => (
                      <div key={item.id} className={`rounded-xl border p-4 gap-4 ${isMobile ? "space-y-3" : "flex items-start justify-between"}`}>
                        <div className="flex items-start gap-3 min-w-0">
                          <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                            item.tone === "high"
                              ? "bg-red-50 text-red-700"
                              : item.tone === "medium"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-slate-100 text-slate-700"
                          }`}>
                            {index + 1}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="font-medium">{item.label}</div>
                              <Badge variant={item.tone === "high" ? "destructive" : item.tone === "medium" ? "default" : "outline"}>
                                {item.tone === "high" ? "Action needed" : item.tone === "medium" ? "Review" : "Keep current"}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">{item.detail}</div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          className={isMobile ? "min-h-11 w-full" : undefined}
                          variant={item.tone === "high" ? "default" : "outline"}
                          onClick={() => openOwnerView(item.tab, "overviewSubtab" in item ? item.overviewSubtab : undefined)}
                        >
                          {item.cta}
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card>
                  <CardContent className="p-6 space-y-4">
                    <div>
                      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-semibold">Portfolio Snapshot</div>
                      <div className="font-semibold text-lg mt-1">{hasMultipleUnits ? "Across all your units" : "Current unit snapshot"}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg bg-slate-50 p-4">
                        <div className="text-xs text-muted-foreground">Amount due</div>
                        <div className={`text-xl font-semibold mt-1 ${totalPortfolioBalance > 0 ? "text-red-600" : "text-green-600"}`}>
                          {totalPortfolioBalance > 0
                            ? `$${totalPortfolioBalance.toFixed(2)}`
                            : totalPortfolioBalance < 0
                            ? `Credit $${Math.abs(totalPortfolioBalance).toFixed(2)}`
                            : "$0.00"}
                        </div>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-4">
                        <div className="text-xs text-muted-foreground">Units in portal</div>
                        <div className="text-xl font-semibold mt-1">{myUnits.length || (me?.unitId ? 1 : 0)}</div>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-4">
                        <div className="text-xs text-muted-foreground">Open maintenance</div>
                        <div className="text-xl font-semibold mt-1">{openMaintenanceRequests.length}</div>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-4">
                        <div className="text-xs text-muted-foreground">Recent notices</div>
                        <div className="text-xl font-semibold mt-1">{recentOwnerNotices.length}</div>
                      </div>
                    </div>
                    {financialDashboard?.nextDueDate ? (
                      <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                        Next charge due on {new Date(financialDashboard.nextDueDate).toLocaleDateString()}.
                      </div>
                    ) : null}
                    <div className={`rounded-xl border bg-white/80 p-4 ${isMobile ? "space-y-4" : "grid gap-4 md:grid-cols-[1.1fr_0.9fr]"}`}>
                      <div className="space-y-3">
                        <div>
                          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">Current Unit</div>
                          <div className="mt-1 text-lg font-semibold">{focusedUnitLabel}</div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {focusedUnitOpenMaintenanceCount} active maintenance item{focusedUnitOpenMaintenanceCount === 1 ? "" : "s"} and
                            {" "}
                            {focusedOccupancyStatus === "rented"
                              ? "tenant occupancy"
                              : focusedOccupancyStatus === "owner-occupied"
                              ? "owner occupancy"
                              : "occupancy not confirmed"}.
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-lg bg-slate-50 p-3">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Owner</div>
                            <div className="mt-1 text-sm font-medium">{focusedOwnerName}</div>
                          </div>
                          <div className="rounded-lg bg-slate-50 p-3">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Occupancy</div>
                            <div className="mt-1 text-sm font-medium">
                              {focusedOccupancyStatus === "rented" ? "Rented" : focusedOccupancyStatus === "owner-occupied" ? "Owner Occupied" : "Unknown"}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        <Button
                          variant="outline"
                          className={isMobile ? "min-h-11 w-full" : "justify-between"}
                          onClick={() => openOwnerView("overview", "owner-info")}
                        >
                          Review contact details
                        </Button>
                        <Button
                          variant="outline"
                          className={isMobile ? "min-h-11 w-full" : "justify-between"}
                          onClick={() => openOwnerView("overview", "occupancy")}
                        >
                          Review occupancy
                        </Button>
                        <div className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
                          {focusedTenantName ? `Current tenant: ${focusedTenantName}` : "No tenant details are currently stored for this unit."}
                        </div>
                      </div>
                    </div>
                    {unitsBalance.length > 0 ? (
                      <div className="space-y-2">
                        {unitsBalance.map((unit) => {
                          const label = formatUnitContextLabel(unit.building, unit.unitNumber);
                          const isCurrent = unit.portalAccessId === portalAccessId;
                          const openCount = maintenanceCountsByUnitId.get(unit.unitId) ?? 0;
                          return (
                            <button
                              key={unit.unitId}
                              className={`w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/30 ${isCurrent ? "border-primary/40 bg-primary/5" : ""}`}
                              onClick={() => {
                                if (unit.portalAccessId && unit.portalAccessId !== portalAccessId) {
                                  switchOwnerUnit(unit.portalAccessId, unit.unitId);
                                }
                              }}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <div className="text-sm font-medium">{label}</div>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {openCount} active maintenance item{openCount === 1 ? "" : "s"}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className={`text-sm font-semibold ${unit.balance > 0 ? "text-red-600" : "text-green-600"}`}>
                                    {unit.balance > 0 ? `$${unit.balance.toFixed(2)} due` : unit.balance < 0 ? `Credit $${Math.abs(unit.balance).toFixed(2)}` : "$0.00"}
                                  </div>
                                  {isCurrent ? <div className="text-xs text-primary mt-1">Viewing now</div> : null}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                {hasBoardAccess ? (
                  <Card>
                    <CardContent className="p-6 space-y-3">
                      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-semibold">Board mode</div>
                      <div className="font-semibold text-lg">Association board workspace is available</div>
                      <div className="text-sm text-muted-foreground">Switch deliberately when you need meetings, board decisions, or association oversight instead of owner self-service.</div>
                      <Button variant="outline" onClick={() => setWorkspaceMode("board")}>Open Board Workspace</Button>
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            </div>
          )}

          {!onboardingDismissed && !me?.hasBoardAccess && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-6 space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-primary font-semibold mb-1">Getting Started</div>
                    <div className="font-semibold text-base">Set up your owner account</div>
                    <div className="text-sm text-muted-foreground mt-0.5">Use this checklist once, then rely on the agenda above for day-to-day tasks.</div>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0 items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7 px-2"
                      onClick={() => {
                        const key = `portal-onboarding-dismissed-${portalAccessId}`;
                        window.sessionStorage.setItem(key, "session");
                        setOnboardingDismissed(true);
                      }}
                    >
                      Remind me later
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7 px-2 text-muted-foreground"
                      onClick={() => {
                        const key = `portal-onboarding-dismissed-${portalAccessId}`;
                        window.localStorage.setItem(key, "permanent");
                        setOnboardingDismissed(true);
                      }}
                    >
                      Dismiss permanently
                    </Button>
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    {
                      done: true,
                      label: "Access your owner portal",
                      detail: "You're signed in and your portal is ready.",
                      tab: null,
                    },
                    {
                      done: totalPortfolioBalance <= 0,
                      label: "Review your balance",
                      detail: totalPortfolioBalance > 0
                        ? `You currently have $${totalPortfolioBalance.toFixed(2)} outstanding.`
                        : "Your account is current.",
                      tab: "financials" as const,
                    },
                    {
                      done: Boolean(documents?.length),
                      label: "Browse community documents",
                      detail: documents?.length
                        ? `${documents.length} document${documents.length === 1 ? "" : "s"} available in your portal`
                        : "CC&Rs, bylaws, and community notices are shared here.",
                      tab: "documents" as const,
                    },
                    {
                      done: hasSavedOwnerContactInfo,
                      label: "Verify your contact information",
                      detail: "Confirm your phone, mailing address, and emergency contact are current.",
                      tab: "overview" as const,
                      overviewSubtab: "owner-info" as const,
                    },
                    {
                      done: Boolean(maintenanceRequests?.length),
                      label: "Submit a maintenance request if needed",
                      detail: "Report any issue in your unit or a shared area without calling management.",
                      tab: "maintenance" as const,
                    },
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${step.done ? "bg-green-500 text-white" : "bg-white border-2 border-primary/30 text-primary"}`}>
                        {step.done ? "✓" : i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium ${step.done ? "line-through text-muted-foreground" : ""}`}>{step.label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{step.detail}</div>
                      </div>
                      {!step.done && step.tab ? (
                        <button className="text-xs text-primary hover:underline shrink-0 mt-0.5" onClick={() => openOwnerView(step.tab!, step.overviewSubtab)}>
                          Go →
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

	          <Card>
	            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-base font-semibold">Recent Updates</h2>
                  <div className="text-sm text-muted-foreground mt-1">Messages, maintenance, profile updates, and documents in one owner-facing stream.</div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => setActiveTab("notices")}>Notices</Button>
                  <Button size="sm" variant="outline" onClick={() => setActiveTab("documents")}>Documents</Button>
                </div>
              </div>
              {recentOwnerUpdates.length > 0 ? (
                <div className="space-y-3">
                  {recentOwnerUpdates.map((item) => (
                    <div key={item.id} className="rounded-lg border p-4 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="font-medium">{item.title}</div>
                          <Badge variant="outline">{item.kindLabel}</Badge>
                          <Badge variant="secondary">{item.scopeLabel}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">{item.detail}</div>
                        <div className="text-xs text-muted-foreground mt-2">{new Date(item.date).toLocaleString()}</div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openOwnerView(
                          item.tab,
                          "overviewSubtab" in item ? (item.overviewSubtab as "summary" | "owner-info" | "occupancy" | undefined) : undefined,
                        )}
                      >
                        Open
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  No recent owner-facing updates are available yet.
                </div>
              )}
		            </CardContent>
		          </Card>
	            </>
	          )}

	          {overviewSubtab === "owner-info" && (
	          <Card>
            <CardContent className="p-6 space-y-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-base font-semibold">Contact Information</h2>
                  <div className="text-sm text-muted-foreground mt-1">Review the contact details tied to your owner profile.</div>
                </div>
                {ownerInfoEditing ? (
                  <div className={`gap-2 ${isMobile ? "grid grid-cols-1 w-full" : "flex"}`}>
                    <Button
                      variant="outline"
                      className={isMobile ? "min-h-11 w-full" : undefined}
                      onClick={() => {
                        resetOwnerInfoForm();
                        setOwnerInfoEditing(false);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button className={isMobile ? "min-h-11 w-full" : undefined} onClick={() => saveOwnerInfo.mutate()} disabled={saveOwnerInfo.isPending}>
                      {saveOwnerInfo.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className={isMobile ? "min-h-11 w-full" : undefined}
                    onClick={() => {
                      resetOwnerInfoForm();
                      setOwnerInfoEditing(true);
                    }}
                  >
                    Edit
                  </Button>
                )}
              </div>

              <div className={`gap-4 ${isMobile ? "grid grid-cols-1" : "grid md:grid-cols-3"}`}>
                <div className="rounded-xl border bg-slate-50/80 p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Unit</div>
                  <div className="mt-1 text-sm font-semibold">{focusedUnitLabel}</div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {focusedOccupancyStatus === "rented" ? "Rented unit" : focusedOccupancyStatus === "owner-occupied" ? "Owner occupied" : "Occupancy not confirmed"}
                  </div>
                </div>
                <div className="rounded-xl border bg-slate-50/80 p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Preferred Contact</div>
                  <div className="mt-1 text-sm font-semibold">{requestedContactPreference || "No preference"}</div>
                  <div className="mt-2 text-xs text-muted-foreground">{requestedPhone || "No phone on file"}</div>
                </div>
                <div className="rounded-xl border bg-slate-50/80 p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Emergency Contact</div>
                  <div className="mt-1 text-sm font-semibold">{requestedEmergencyContactName || "Not provided"}</div>
                  <div className="mt-2 text-xs text-muted-foreground">{requestedEmergencyContactPhone || "No emergency phone on file"}</div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Name</label>
                  <div className="rounded-lg border bg-muted/20 px-3 py-2.5 text-sm font-medium">
                    {[(me as any)?.firstName, (me as any)?.lastName].filter(Boolean).join(" ") || "Owner"}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Email</label>
                  <div className="rounded-lg border bg-muted/20 px-3 py-2.5 text-sm font-medium">
                    {(me as any)?.email || "No email on file"}
                  </div>
                </div>
              </div>

              {ownerInfoEditing ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Phone</label>
                    <Input value={requestedPhone} onChange={(e) => setRequestedPhone(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Mailing Address</label>
                    <Textarea className={isMobile ? "min-h-24" : undefined} value={requestedMailingAddress} onChange={(e) => setRequestedMailingAddress(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Emergency Contact Name</label>
                    <Input value={requestedEmergencyContactName} onChange={(e) => setRequestedEmergencyContactName(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Emergency Contact Phone</label>
                    <Input value={requestedEmergencyContactPhone} onChange={(e) => setRequestedEmergencyContactPhone(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Contact Preference</label>
                    <Select value={requestedContactPreference || "none"} onValueChange={(v) => setRequestedContactPreference(v === "none" ? "" : v)}>
                      <SelectTrigger className={isMobile ? "min-h-11" : undefined}><SelectValue placeholder="Contact preference" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No preference</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="phone">Phone</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Phone</div>
                    <div className="rounded-lg border bg-muted/20 px-3 py-2.5 text-sm">{requestedPhone || "Not provided"}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Mailing Address</div>
                    <div className="rounded-lg border bg-muted/20 px-3 py-2.5 text-sm whitespace-pre-wrap">{requestedMailingAddress || "Not provided"}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Emergency Contact Name</div>
                    <div className="rounded-lg border bg-muted/20 px-3 py-2.5 text-sm">{requestedEmergencyContactName || "Not provided"}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Emergency Contact Phone</div>
                    <div className="rounded-lg border bg-muted/20 px-3 py-2.5 text-sm">{requestedEmergencyContactPhone || "Not provided"}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Contact Preference</div>
                    <div className="rounded-lg border bg-muted/20 px-3 py-2.5 text-sm">{requestedContactPreference || "No preference"}</div>
                  </div>
                </div>
              )}

              {contactUpdateSuccess && (
                <div className="text-sm text-green-700">Your contact information has been saved.</div>
              )}
              {saveOwnerInfo.isError && (
                <p className="text-sm text-destructive">{(saveOwnerInfo.error as Error).message}</p>
              )}

              <div className="rounded-lg border bg-slate-50 p-4 text-sm text-muted-foreground">
                Name and email stay tied to your portal identity. Contact fields above can be edited directly from this view.
              </div>
            </CardContent>
          </Card>
          )}

          {overviewSubtab === "occupancy" && (
            <div className="space-y-6">
              <Card>
                <CardContent className="p-6 space-y-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-semibold">Occupancy</div>
                      <h2 className="text-base font-semibold mt-1">{focusedUnitLabel}</h2>
                  <div className="text-sm text-muted-foreground mt-1">
                        Review and edit occupancy one unit at a time.
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <Badge variant={focusedOccupancyStatus === "rented" ? "default" : focusedOccupancyStatus === "owner-occupied" ? "secondary" : "outline"}>
                        {focusedOccupancyStatus === "rented" ? "Rented" : focusedOccupancyStatus === "owner-occupied" ? "Owner Occupied" : "Occupancy Unknown"}
                      </Badge>
                    </div>
                  </div>

                  {myUnits.length > 1
                    ? renderOwnerUnitSelector({
                        activeUnitId: focusedOwnedUnit?.unitId,
                        onSelect: (unit) => {
                          if (unit.portalAccessId) {
                            switchOwnerUnit(unit.portalAccessId, unit.unitId);
                          } else {
                            setOwnedUnitFocusId(unit.unitId);
                          }
                        },
                      })
                    : null}

                  <div className={`gap-4 ${isMobile ? "grid grid-cols-1" : "grid md:grid-cols-3"}`}>
                    <div className="rounded-xl border bg-white p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Unit</div>
                      <div className="mt-1 text-sm font-semibold">{focusedUnitLabel}</div>
                    </div>
                    <div className="rounded-xl border bg-white p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Owner</div>
                      <div className="mt-1 text-sm font-semibold">{focusedOwnerName}</div>
                    </div>
                    <div className="rounded-xl border bg-white p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Tenant</div>
                      <div className="mt-1 text-sm font-semibold">{focusedTenantName || "None on file"}</div>
                    </div>
                  </div>

                  <div className="rounded-lg border bg-slate-50 p-4 space-y-4">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <div className="text-sm font-semibold">Set Occupancy</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Review the current occupancy and edit it only when something has changed.
                          </div>
                        </div>
                        {occupancyEditing ? (
                          <div className={`gap-2 ${isMobile ? "grid grid-cols-1 w-full" : "flex"}`}>
                            <Button
                              variant="outline"
                              className={isMobile ? "min-h-11 w-full" : undefined}
                              onClick={() => {
                                resetOccupancyForm();
                                setOccupancyEditing(false);
                              }}
                            >
                              Cancel
                            </Button>
                            <Button className={isMobile ? "min-h-11 w-full" : undefined} onClick={() => saveOccupancy.mutate()} disabled={saveOccupancy.isPending || !focusedOwnedUnit}>
                              {saveOccupancy.isPending ? "Saving..." : "Save Occupancy"}
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            className={isMobile ? "min-h-11 w-full" : undefined}
                            onClick={() => {
                              resetOccupancyForm();
                              setOccupancyEditing(true);
                            }}
                          >
                            Edit
                          </Button>
                        )}
                      </div>

                      {occupancyEditing ? (
                        <>
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">Occupancy Type</label>
                            <Select
                              value={occupancyForm.occupancyType}
                              onValueChange={(value) => setOccupancyForm((current) => ({
                                ...current,
                                occupancyType: value as "OWNER_OCCUPIED" | "TENANT",
                              }))}
                            >
                              <SelectTrigger className={isMobile ? "min-h-11 w-full" : "max-w-xs"}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="OWNER_OCCUPIED">Owner Occupied</SelectItem>
                                <SelectItem value="TENANT">Tenant</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {occupancyForm.occupancyType === "TENANT" ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">Tenant First Name</label>
                                <Input
                                  value={occupancyForm.tenantFirstName}
                                  onChange={(e) => setOccupancyForm((current) => ({ ...current, tenantFirstName: e.target.value }))}
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">Tenant Last Name</label>
                                <Input
                                  value={occupancyForm.tenantLastName}
                                  onChange={(e) => setOccupancyForm((current) => ({ ...current, tenantLastName: e.target.value }))}
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">Tenant Email</label>
                                <Input
                                  type="email"
                                  value={occupancyForm.tenantEmail}
                                  onChange={(e) => setOccupancyForm((current) => ({ ...current, tenantEmail: e.target.value }))}
                                  required
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">Tenant Phone</label>
                                <Input
                                  value={occupancyForm.tenantPhone}
                                  onChange={(e) => setOccupancyForm((current) => ({ ...current, tenantPhone: e.target.value }))}
                                />
                              </div>
                            </div>
                          ) : null}

                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">Note for Management</label>
                            <Textarea
                              className={isMobile ? "min-h-24" : undefined}
                              value={occupancyForm.notes}
                              onChange={(e) => setOccupancyForm((current) => ({ ...current, notes: e.target.value }))}
                            />
                          </div>
                        </>
                      ) : null}
                      {!occupancyEditing ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <div className="text-xs text-muted-foreground">Occupancy Type</div>
                            <div className="rounded-lg border bg-white px-3 py-2.5 text-sm">
                              {occupancyForm.occupancyType === "TENANT" ? "Tenant" : "Owner Occupied"}
                            </div>
                          </div>
                          {occupancyForm.occupancyType === "TENANT" ? (
                            <>
                              <div className="space-y-1">
                                <div className="text-xs text-muted-foreground">Tenant Name</div>
                                <div className="rounded-lg border bg-white px-3 py-2.5 text-sm">
                                  {[occupancyForm.tenantFirstName, occupancyForm.tenantLastName].filter(Boolean).join(" ") || "Not provided"}
                                </div>
                              </div>
                              <div className="space-y-1">
                                <div className="text-xs text-muted-foreground">Tenant Email</div>
                                <div className="rounded-lg border bg-white px-3 py-2.5 text-sm">
                                  {occupancyForm.tenantEmail || "Not provided"}
                                </div>
                              </div>
                              <div className="space-y-1">
                                <div className="text-xs text-muted-foreground">Tenant Phone</div>
                                <div className="rounded-lg border bg-white px-3 py-2.5 text-sm">
                                  {occupancyForm.tenantPhone || "Not provided"}
                                </div>
                              </div>
                            </>
                          ) : null}
                        </div>
                      ) : null}
                      {occupancyForm.occupancyType === "TENANT" && occupancyForm.tenantEmail.trim() && !isValidEmail(occupancyForm.tenantEmail) ? (
                        <p className="text-sm text-destructive">Enter a valid tenant email address.</p>
                      ) : null}
                      {occupancyUpdateSuccess && (
                        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                          Occupancy was saved successfully.
                        </div>
                      )}
                      {saveOccupancy.isError && (
                        <p className="text-sm text-destructive">{(saveOccupancy.error as Error).message}</p>
                      )}
                    </div>
                </CardContent>
              </Card>
            </div>
          )}

		            </div>
		          </div>
	        </>
      )}

      {me?.hasBoardAccess && workspaceMode === "board" ? (
        <>
          <Card id="board-home">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Board Workspace</div>
                  <h2 className="text-2xl font-semibold tracking-tight mt-1">{associationName}</h2>
                  <p className="text-sm text-muted-foreground mt-1">Decision-first workspace for the board member serving this association.</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Badge>{boardRoleTitle}</Badge>
                  <Badge variant="outline">{me.effectiveRole}</Badge>
                  <Badge variant="outline">1 association scope</Badge>
                </div>
              </div>
              <div className="grid gap-3 lg:grid-cols-[1.7fr_1fr]">
                <div className="rounded-xl border bg-slate-900 text-slate-50 p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Needs Board Action</div>
                      <div className="text-sm text-slate-300 mt-1">
                        {boardAttentionItems.length > 0
                          ? `${boardAttentionItems.length} active board item${boardAttentionItems.length === 1 ? "" : "s"} require attention.`
                          : "No urgent board actions are currently surfaced."}
                      </div>
                    </div>
                    {nextBoardMeeting ? (
                      <div className="rounded-lg bg-white/10 px-3 py-2 text-right">
                        <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Next Meeting</div>
                        <div className="text-sm font-medium">{new Date(nextBoardMeeting.scheduledAt).toLocaleDateString()}</div>
                        <div className="text-xs text-slate-300 truncate max-w-[12rem]">{nextBoardMeeting.title}</div>
                      </div>
                    ) : null}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {boardAttentionItems.slice(0, 4).map((item) => (
                      <div key={item.key} className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium">{item.label}</div>
                          <Badge variant={item.tone === "high" ? "destructive" : item.tone === "medium" ? "default" : "outline"}>
                            {item.tone}
                          </Badge>
                        </div>
                        <div className="text-sm text-slate-300">{item.detail}</div>
                      </div>
                    ))}
                    {boardAttentionItems.length === 0 ? (
                      <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                        The board action queue is clear right now. Review meetings, finances, and recent changes below.
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="rounded-xl border p-4 space-y-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Board Context</div>
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant={getStatusBadgeVariant(boardDashboard?.workflowStates.access.status ?? "active")}>
                        {formatStatusLabel(boardDashboard?.workflowStates.access.status ?? "active")}
                      </Badge>
                      {boardTerm ? (
                        <Badge variant={boardTerm.isActive ? "default" : "outline"}>
                          {boardTerm.isActive ? "term active" : "term ended"}
                        </Badge>
                      ) : null}
                    </div>
                    {boardTerm ? (
                      <div className="text-sm text-muted-foreground">
                        Serving from {new Date(boardTerm.startDate).toLocaleDateString()}
                        {boardTerm.endDate ? ` through ${new Date(boardTerm.endDate).toLocaleDateString()}` : " with no scheduled end date"}.
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">Active board access is association-scoped and audit-tracked.</div>
                    )}
                    <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Role Focus</div>
                      <div className="mt-1">{boardRoleFocus}</div>
                    </div>
                  </div>
                  <div className="rounded-xl border p-4 grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-muted-foreground">Units</div>
                      <div className="text-2xl font-semibold">{boardOverview?.units ?? "-"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Open Tasks</div>
                      <div className="text-2xl font-semibold">{boardDashboard?.governance.openTaskCount ?? "-"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Open Maintenance</div>
                      <div className="text-2xl font-semibold">{boardOverview?.maintenanceOpen ?? "-"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Contact Coverage</div>
                      <div className="text-2xl font-semibold">{boardOverview?.contactCoveragePercent ?? "-"}%</div>
                    </div>
                  </div>
                  <div className="rounded-xl border p-4 space-y-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Access Boundaries</div>
                    <div className="space-y-2">
                      {boardScopeRules.map((rule) => (
                        <div key={rule} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-slate-400" />
                          <span>{rule}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div id="board-decisions" className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
                <div className="rounded-xl border p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <h3 className="text-base font-semibold">Decision Queue</h3>
                      <p className="text-sm text-muted-foreground mt-1">Recommended board actions with supporting context and auditable state.</p>
                    </div>
                    <Badge variant={boardDecisionCards.length > 0 ? "default" : "outline"}>
                      {boardDecisionCards.length} queued
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    {boardDecisionCards.map((item) => (
                      <div key={item.key} className="rounded-lg border bg-slate-50/80 p-4 space-y-2">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="font-medium">{item.title}</div>
                          <Badge variant={item.tone === "high" ? "destructive" : item.tone === "medium" ? "default" : "outline"}>
                            {item.tone === "high" ? "Needs decision" : "Review next"}
                          </Badge>
                        </div>
                        <div className="text-sm">{item.recommendation}</div>
                        <div className="text-sm text-muted-foreground">Support: {item.evidence}</div>
                        <div className={`gap-3 text-xs text-muted-foreground ${isMobile ? "grid grid-cols-1" : "flex items-center justify-between flex-wrap"}`}>
                          <span>{item.dueLabel}</span>
                          <span>{item.auditLabel}</span>
                        </div>
                      </div>
                    ))}
                    {boardDecisionCards.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                        No decision cards are queued right now. Review recent changes and the risk snapshot for anything that needs board attention.
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="rounded-xl border p-4 space-y-3">
                  <div>
                    <h3 className="text-base font-semibold">Since Last Review</h3>
                    <p className="text-sm text-muted-foreground mt-1">Recent association changes that affect meeting context, trust, or follow-up.</p>
                  </div>
                  <div className="space-y-3">
                    {boardRecentChangeSummary.map((entry) => (
                      <div key={entry.id} className="rounded-lg border p-3 space-y-2">
                        <div className={`gap-2 ${isMobile ? "grid grid-cols-1" : "flex items-center justify-between flex-wrap"}`}>
                          <div className="font-medium">{formatStatusLabel(entry.action)}</div>
                          <div className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">{entry.entityType}</Badge>
                          {entry.actorEmail ? <Badge variant="secondary">{entry.actorEmail}</Badge> : null}
                        </div>
                      </div>
                    ))}
                    {boardRecentChangeSummary.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                        No recent board-visible changes are available yet.
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Board Lanes</h2>
                <p className="text-sm text-muted-foreground">Move through decisions, meetings, packages, and risks before opening execution tools.</p>
              </div>
              <div className={isMobile ? "flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2" : "grid gap-3 lg:grid-cols-6"}>
                <button type="button" onClick={() => scrollToBoardSection("board-home")} className={`rounded-lg border p-4 text-left hover:border-primary/40 hover:bg-primary/5 transition-colors ${isMobile ? "min-w-[16rem] snap-start shrink-0" : ""}`}>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Home</div>
                  <div className="mt-2 text-sm font-medium">{boardAttentionItems.length} active item{boardAttentionItems.length === 1 ? "" : "s"}</div>
                  <div className="text-sm text-muted-foreground mt-1">Start with decisions, recent changes, and current risks.</div>
                </button>
                <button type="button" onClick={() => scrollToBoardSection("board-decisions")} className={`rounded-lg border p-4 text-left hover:border-primary/40 hover:bg-primary/5 transition-colors ${isMobile ? "min-w-[16rem] snap-start shrink-0" : ""}`}>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Decisions</div>
                  <div className="mt-2 text-sm font-medium">{boardDecisionCards.length} recommended</div>
                  <div className="text-sm text-muted-foreground mt-1">Recommended actions with due dates and audit context.</div>
                </button>
                <button type="button" onClick={() => scrollToBoardSection("board-meetings")} className={`rounded-lg border p-4 text-left hover:border-primary/40 hover:bg-primary/5 transition-colors ${isMobile ? "min-w-[16rem] snap-start shrink-0" : ""}`}>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Meetings</div>
                  <div className="mt-2 text-sm font-medium">{boardUpcomingMeetings.length} upcoming</div>
                  <div className="text-sm text-muted-foreground mt-1">Agenda readiness, minutes, tasks, and board package prep.</div>
                </button>
                <button type="button" onClick={() => scrollToBoardSection("board-financials")} className={`rounded-lg border p-4 text-left hover:border-primary/40 hover:bg-primary/5 transition-colors ${isMobile ? "min-w-[16rem] snap-start shrink-0" : ""}`}>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Financials</div>
                  <div className="mt-2 text-sm font-medium">${boardDashboard?.financial.openBalance?.toFixed(2) ?? "0.00"} open</div>
                  <div className="text-sm text-muted-foreground mt-1">Cash exposure, invoices, ledger movement, and owner balances.</div>
                </button>
                <button type="button" onClick={() => scrollToBoardSection("board-messages")} className={`rounded-lg border p-4 text-left hover:border-primary/40 hover:bg-primary/5 transition-colors ${isMobile ? "min-w-[16rem] snap-start shrink-0" : ""}`}>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Packages</div>
                  <div className="mt-2 text-sm font-medium">{(boardPackageStates.draft ?? 0) + (boardPackageStates.approved ?? 0) + (boardPackageStates.distributed ?? 0)} tracked</div>
                  <div className="text-sm text-muted-foreground mt-1">Board packages, shared documents, and communication history.</div>
                </button>
                <button type="button" onClick={() => scrollToBoardSection("board-operations")} className={`rounded-lg border p-4 text-left hover:border-primary/40 hover:bg-primary/5 transition-colors ${isMobile ? "min-w-[16rem] snap-start shrink-0" : ""}`}>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Compliance</div>
                  <div className="mt-2 text-sm font-medium">{boardDashboard?.governance.openTaskCount ?? 0} open tasks</div>
                  <div className="text-sm text-muted-foreground mt-1">Governance tasks, maintenance exceptions, and compliance follow-up.</div>
                </button>
                <button type="button" onClick={() => scrollToBoardSection("board-activity")} className={`rounded-lg border p-4 text-left hover:border-primary/40 hover:bg-primary/5 transition-colors ${isMobile ? "min-w-[16rem] snap-start shrink-0" : ""}`}>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Activity</div>
                  <div className="mt-2 text-sm font-medium">{boardActivityItems.length} recent event{boardActivityItems.length === 1 ? "" : "s"}</div>
                  <div className="text-sm text-muted-foreground mt-1">Audit history grouped by governance, financials, communications, operations, and access.</div>
                </button>
                <button type="button" onClick={() => scrollToBoardSection("board-boundary")} className={`rounded-lg border p-4 text-left hover:border-primary/40 hover:bg-primary/5 transition-colors ${isMobile ? "min-w-[16rem] snap-start shrink-0" : ""}`}>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Boundary</div>
                  <div className="mt-2 text-sm font-medium">Oversight only</div>
                  <div className="text-sm text-muted-foreground mt-1">Board mode excludes manager-only editing, execution, and cross-association controls.</div>
                </button>
              </div>
            </CardContent>
          </Card>

          <Card id="board-meetings">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-lg font-semibold">Meeting Readiness and Decisions</h2>
                  <p className="text-sm text-muted-foreground">Keep the board focused on what must be prepared, reviewed, or decided before the next session.</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(boardDashboard?.workflowStates.governance.meetingsByStatus ?? {}).map(([status, count]) => (
                    <Badge key={`meeting-${status}`} variant={getStatusBadgeVariant(status)}>
                      {count} {formatStatusLabel(status)}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
                <div className="rounded-xl border p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <h3 className="text-base font-semibold">Readiness Checklist</h3>
                      <p className="text-sm text-muted-foreground mt-1">Use one scan to see whether the board can actually walk into the next meeting prepared.</p>
                    </div>
                    <Badge variant={boardMeetingReadinessItems.every((item) => item.done) ? "secondary" : "default"}>
                      {boardMeetingReadinessItems.filter((item) => item.done).length}/{boardMeetingReadinessItems.length} ready
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    {boardMeetingReadinessItems.map((item) => (
                      <div key={item.key} className="rounded-lg border p-4">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div>
                            <div className="font-medium">{item.label}</div>
                            <div className="text-sm text-muted-foreground mt-1">{item.detail}</div>
                          </div>
                          <Badge variant={item.done ? "secondary" : item.tone === "high" ? "destructive" : "default"}>
                            {item.done ? "Ready" : item.tone === "high" ? "Needs setup" : "Review"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <h3 className="text-base font-semibold">Board Package Review</h3>
                      <p className="text-sm text-muted-foreground mt-1">Package state stays visible in the meeting lane instead of hiding in document tools.</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => scrollToBoardSection("board-messages")}>
                      Open package lane
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {boardPackageReviewRows.map((row) => (
                      <div key={row.key} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-medium">{row.label}</div>
                            <div className="text-sm text-muted-foreground mt-1">{row.detail}</div>
                          </div>
                          <Badge variant={row.tone === "medium" ? "default" : "outline"}>{row.value}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  {nextBoardMeeting ? (
                    <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
                      Plan package distribution against the next scheduled meeting on {new Date(nextBoardMeeting.scheduledAt).toLocaleDateString()}.
                    </div>
                  ) : (
                    <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
                      No meeting is scheduled yet, so package review has no target session. Set the next meeting first.
                    </div>
                  )}
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="text-sm font-medium">Upcoming Meetings</div>
                  <div className="space-y-3">
                    {boardUpcomingMeetings.slice(0, 4).map((meeting) => (
                      <div key={meeting.id} className="rounded-md border p-3 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium">{meeting.title}</div>
                          <div className="flex gap-2 flex-wrap">
                            <Badge variant={getStatusBadgeVariant(meeting.status)}>{formatStatusLabel(meeting.status)}</Badge>
                            <Badge variant={getStatusBadgeVariant(meeting.summaryStatus)}>{formatStatusLabel(meeting.summaryStatus)}</Badge>
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {meeting.scheduledAt ? new Date(meeting.scheduledAt).toLocaleString() : "Date pending"}
                          {meeting.meetingType ? ` · ${meeting.meetingType}` : ""}
                        </div>
                      </div>
                    ))}
                    {boardUpcomingMeetings.length === 0 ? <div className="text-sm text-muted-foreground">No upcoming meetings are currently scheduled.</div> : null}
                  </div>
                </div>
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="text-sm font-medium">Open Board Tasks</div>
                  <div className="space-y-3">
                    {boardOpenTasks.slice(0, 5).map((task) => (
                      <div key={task.id} className="rounded-md border p-3 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium">{task.title}</div>
                          <Badge variant={getStatusBadgeVariant(task.status)}>{formatStatusLabel(task.status)}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">{task.dueDate ? `Due ${new Date(task.dueDate).toLocaleDateString()}` : "No due date"}</div>
                      </div>
                    ))}
                    {boardOpenTasks.length === 0 ? <div className="text-sm text-muted-foreground">No open governance tasks are currently assigned.</div> : null}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-lg font-semibold">Financial and Risk Snapshot</h2>
                  <p className="text-sm text-muted-foreground">Summary first, exceptions second, with the operational detail kept below.</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant={boardDashboard?.workflowStates.maintenance.urgentOpenCount ? "destructive" : "outline"}>
                    {boardDashboard?.workflowStates.maintenance.urgentOpenCount ?? 0} urgent/high maintenance
                  </Badge>
                  <Badge variant={(boardDashboard?.financial.openBalance ?? 0) > 0 ? "default" : "outline"}>
                    ${boardDashboard?.financial.openBalance?.toFixed(2) ?? "0.00"} open balance
                  </Badge>
                  <Badge variant="outline">
                    {boardPackageStates.draft ?? 0} draft packages
                  </Badge>
                </div>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {boardRiskHighlights.map((item) => (
                  <div key={item.key} className="rounded-lg border p-4 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">{item.label}</div>
                      <Badge variant={item.tone === "high" ? "destructive" : item.tone === "medium" ? "default" : "outline"}>{item.tone}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">{item.detail}</div>
                  </div>
                ))}
                {boardRiskHighlights.length === 0 ? (
                  <div className="rounded-lg border p-4 text-sm text-muted-foreground">No elevated financial or operating risk signals are currently surfaced for this association.</div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Recent Association Changes</h2>
                <p className="text-sm text-muted-foreground">A lightweight audit trail so board members can see what changed without leaving the workspace.</p>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {boardRecentActivity.slice(0, 6).map((entry) => (
                  <div key={entry.id} className="rounded-lg border p-4 space-y-1">
                    <div className="font-medium">{formatStatusLabel(entry.action)}</div>
                    <div className="text-sm text-muted-foreground">
                      {entry.entityType}
                      {entry.actorEmail ? ` · ${entry.actorEmail}` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</div>
                  </div>
                ))}
                {boardRecentActivity.length === 0 ? (
                  <div className="rounded-lg border p-4 text-sm text-muted-foreground">No recent audited board-facing activity is available.</div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card id="board-financials">
            <CardContent className="p-6 space-y-4">
              <h2 className="text-lg font-semibold">Board Financial Snapshot</h2>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Budgets</div><div className="text-xl font-semibold">{boardDashboard?.financial.budgetCount ?? "-"}</div></div>
                <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Ledger Entries</div><div className="text-xl font-semibold">{boardDashboard?.financial.ledgerEntryCount ?? "-"}</div></div>
                <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Charges</div><div className="text-xl font-semibold">${boardDashboard?.financial.totalCharges?.toFixed?.(2) ?? "-"}</div></div>
                <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Payments</div><div className="text-xl font-semibold">${boardDashboard?.financial.totalPayments?.toFixed?.(2) ?? "-"}</div></div>
                <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Open Balance</div><div className="text-xl font-semibold">${boardDashboard?.financial.openBalance?.toFixed?.(2) ?? "-"}</div></div>
                <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Invoices + Utilities</div><div className="text-xl font-semibold">${(((boardDashboard?.financial.totalInvoices ?? 0) + (boardDashboard?.financial.totalUtilities ?? 0)).toFixed(2))}</div></div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Recent Ledger Activity</h3>
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Description</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(boardDashboard?.financial.recentLedgerEntries ?? []).map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell>{entry.entryType}</TableCell>
                            <TableCell>${entry.amount.toFixed(2)}</TableCell>
                            <TableCell>{entry.description || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="space-y-3 md:hidden">
                    {(boardDashboard?.financial.recentLedgerEntries ?? []).map((entry) => (
                      <div key={entry.id} className="rounded-xl border p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium">{entry.description || formatStatusLabel(entry.entryType)}</div>
                            <div className="mt-1 text-xs text-muted-foreground">{formatStatusLabel(entry.entryType)}</div>
                          </div>
                          <div className="text-sm font-semibold">${entry.amount.toFixed(2)}</div>
                        </div>
                      </div>
                    ))}
                    {(boardDashboard?.financial.recentLedgerEntries ?? []).length === 0 ? (
                      <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No recent ledger activity.</div>
                    ) : null}
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Recent Vendor Invoices</h3>
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Vendor</TableHead>
                          <TableHead>Invoice</TableHead>
                          <TableHead>Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(boardDashboard?.financial.recentInvoices ?? []).map((invoice) => (
                          <TableRow key={invoice.id}>
                            <TableCell>{invoice.vendorName || "-"}</TableCell>
                            <TableCell>{invoice.invoiceNumber || "-"}</TableCell>
                            <TableCell>${invoice.amount.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="space-y-3 md:hidden">
                    {(boardDashboard?.financial.recentInvoices ?? []).map((invoice) => (
                      <div key={invoice.id} className="rounded-xl border p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium">{invoice.vendorName || "Vendor invoice"}</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Invoice {invoice.invoiceNumber || "-"}
                              {invoice.invoiceDate ? ` · ${new Date(invoice.invoiceDate).toLocaleDateString()}` : ""}
                            </div>
                          </div>
                          <div className="text-sm font-semibold">${invoice.amount.toFixed(2)}</div>
                        </div>
                      </div>
                    ))}
                    {(boardDashboard?.financial.recentInvoices ?? []).length === 0 ? (
                      <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No recent invoices.</div>
                    ) : null}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="text-lg font-semibold">Governance Snapshot</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Meetings</div><div className="text-xl font-semibold">{boardDashboard?.governance.meetingCount ?? "-"}</div></div>
                <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Upcoming Meetings</div><div className="text-xl font-semibold">{boardDashboard?.governance.upcomingMeetings.length ?? "-"}</div></div>
                <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Tasks</div><div className="text-xl font-semibold">{boardDashboard?.governance.taskCount ?? "-"}</div></div>
                <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Open Tasks</div><div className="text-xl font-semibold">{boardDashboard?.governance.openTaskCount ?? "-"}</div></div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Upcoming Meetings</h3>
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>State</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(boardDashboard?.governance.upcomingMeetings ?? []).map((meeting) => (
                          <TableRow key={meeting.id}>
                            <TableCell>{meeting.title}</TableCell>
                            <TableCell>{meeting.scheduledAt ? new Date(meeting.scheduledAt).toLocaleDateString() : "-"}</TableCell>
                            <TableCell>{meeting.meetingType || "-"}</TableCell>
                            <TableCell>
                              <div className="flex gap-2 flex-wrap">
                                <Badge variant={getStatusBadgeVariant(meeting.status)}>{formatStatusLabel(meeting.status)}</Badge>
                                <Badge variant={getStatusBadgeVariant(meeting.summaryStatus)}>{formatStatusLabel(meeting.summaryStatus)}</Badge>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="space-y-3 md:hidden">
                    {(boardDashboard?.governance.upcomingMeetings ?? []).map((meeting) => (
                      <div key={meeting.id} className="rounded-xl border p-4 space-y-3">
                        <div>
                          <div className="text-sm font-medium">{meeting.title}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {meeting.scheduledAt ? new Date(meeting.scheduledAt).toLocaleDateString() : "Date not set"}
                            {meeting.meetingType ? ` · ${meeting.meetingType}` : ""}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={getStatusBadgeVariant(meeting.status)}>{formatStatusLabel(meeting.status)}</Badge>
                          <Badge variant={getStatusBadgeVariant(meeting.summaryStatus)}>{formatStatusLabel(meeting.summaryStatus)}</Badge>
                        </div>
                      </div>
                    ))}
                    {(boardDashboard?.governance.upcomingMeetings ?? []).length === 0 ? (
                      <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No upcoming meetings scheduled.</div>
                    ) : null}
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Open Governance Tasks</h3>
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Task</TableHead>
                          <TableHead>Due</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(boardDashboard?.governance.openTasks ?? []).map((task) => (
                          <TableRow key={task.id}>
                            <TableCell>{task.title}</TableCell>
                            <TableCell>{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "-"}</TableCell>
                            <TableCell>
                              <Badge variant={getStatusBadgeVariant(task.status)}>{formatStatusLabel(task.status)}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="space-y-3 md:hidden">
                    {(boardDashboard?.governance.openTasks ?? []).map((task) => (
                      <div key={task.id} className="rounded-xl border p-4 space-y-3">
                        <div>
                          <div className="text-sm font-medium">{task.title}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Due {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "not scheduled"}
                          </div>
                        </div>
                        <Badge variant={getStatusBadgeVariant(task.status)}>{formatStatusLabel(task.status)}</Badge>
                      </div>
                    ))}
                    {(boardDashboard?.governance.openTasks ?? []).length === 0 ? (
                      <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No open governance tasks.</div>
                    ) : null}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card id="board-messages">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-lg font-semibold">Board Packages and Messages</h2>
                  <p className="text-sm text-muted-foreground">Keep distribution readiness and recent board communications visible without dropping into editing tools.</p>
                </div>
                <Badge variant={(boardPackageStates.draft ?? 0) > 0 ? "default" : "outline"}>
                  {boardPackageStates.draft ?? 0} draft package{(boardPackageStates.draft ?? 0) === 1 ? "" : "s"}
                </Badge>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">Package Readiness</div>
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant="outline">{boardPackageStates.approved ?? 0} approved</Badge>
                      <Badge variant="secondary">{boardPackageStates.distributed ?? 0} distributed</Badge>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {(boardDocuments ?? []).slice(0, 4).map((document) => (
                      <div key={document.id} className="rounded-md border p-3 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium">{document.title}</div>
                          <Badge variant={document.isPortalVisible === 1 ? "secondary" : "outline"}>
                            {document.isPortalVisible === 1 ? "shared" : "internal"}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {document.documentType || "Document"}
                          {document.portalAudience ? ` · ${document.portalAudience}` : ""}
                        </div>
                      </div>
                    ))}
                    {(boardDocuments ?? []).length === 0 ? <div className="text-sm text-muted-foreground">No board documents are currently published.</div> : null}
                  </div>
                </div>
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="text-sm font-medium">Recent Board Sends</div>
                  <div className="space-y-3">
                    {(boardNoticeSends ?? []).slice(0, 5).map((send) => (
                      <div key={send.id} className="rounded-md border p-3 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium">{send.subjectRendered}</div>
                          <Badge variant={getStatusBadgeVariant(send.status)}>{formatStatusLabel(send.status)}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">{send.recipientEmail}</div>
                        <div className="text-xs text-muted-foreground">{new Date(send.sentAt).toLocaleString()}</div>
                      </div>
                    ))}
                    {(boardNoticeSends ?? []).length === 0 ? <div className="text-sm text-muted-foreground">No board notices have been sent yet.</div> : null}
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="text-sm font-medium">Communication History</div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {(boardCommunicationHistory ?? []).slice(0, 4).map((entry) => (
                    <div key={entry.id} className="rounded-md border p-3">
                      <div className="font-medium">{entry.subject || "-"}</div>
                      <div className="text-sm text-muted-foreground">{entry.bodySnippet || "-"}</div>
                      <div className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</div>
                    </div>
                  ))}
                  {(boardCommunicationHistory ?? []).length === 0 ? <div className="text-sm text-muted-foreground">No association-wide communication history yet.</div> : null}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card id="board-boundary">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-lg font-semibold">Board Access Boundary</h2>
                  <p className="text-sm text-muted-foreground">This workspace is intentionally limited to board review and association oversight.</p>
                </div>
                <Badge variant="outline">Current association only</Badge>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Hidden Here</div>
                  <div className="mt-2 text-sm">Association editing, person and unit maintenance, direct ledger posting, invoice creation, document publishing, and notice composition stay outside board mode.</div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Association Scope</div>
                  <div className="mt-2 text-sm">Board members review only the association tied to their current board access. No board cross-association switcher is shown here.</div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Owner Return Path</div>
                  <div className="mt-2 text-sm">Use `Return to Owner Portal` for owner self-service tasks, unit switching, or non-board workflows.</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card id="board-operations">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-lg font-semibold">Maintenance Queue</h2>
                  <p className="text-sm text-muted-foreground">Board-visible maintenance exceptions for oversight, follow-up, and risk review.</p>
                </div>
                <Badge variant={sumStateCounts(boardDashboard?.workflowStates.maintenance.requestsByStatus ?? {}) > 0 ? "default" : "outline"}>
                  {sumStateCounts(boardDashboard?.workflowStates.maintenance.requestsByStatus ?? {})} tracked requests
                </Badge>
              </div>
              <div className="space-y-3">
                {(boardDashboard?.workflowStates.maintenance.recent ?? []).map((request) => (
                  <div key={request.id} className="rounded-md border p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <div className="font-medium">{request.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {request.locationText || "Location not specified"} · opened {new Date(request.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant={getStatusBadgeVariant(request.status)}>{formatStatusLabel(request.status)}</Badge>
                        <Badge variant={getStatusBadgeVariant(request.priority)}>{formatStatusLabel(request.priority)}</Badge>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Response due {request.responseDueAt ? new Date(request.responseDueAt).toLocaleString() : "not scheduled"}
                    </div>
                  </div>
                ))}
                {(boardDashboard?.workflowStates.maintenance.recent ?? []).length === 0 ? (
                  <div className="text-sm text-muted-foreground">No association-wide maintenance requests are currently visible.</div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card id="board-activity">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-lg font-semibold">Recent Activity</h2>
                  <p className="text-sm text-muted-foreground">See the living board record by workflow area instead of scanning one undifferentiated audit list.</p>
                </div>
                {isMobile ? (
                  <MobileTabBar
                    items={[
                      { id: "all", label: "All" },
                      { id: "governance", label: "Governance" },
                      { id: "financial", label: "Financial" },
                      { id: "communications", label: "Messages" },
                      { id: "operations", label: "Operations" },
                      { id: "access", label: "Access" },
                    ]}
                    value={boardActivityFilter}
                    onChange={(value) => setBoardActivityFilter(value as typeof boardActivityFilter)}
                  />
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { id: "all", label: "All" },
                      { id: "governance", label: "Governance" },
                      { id: "financial", label: "Financial" },
                      { id: "communications", label: "Messages" },
                      { id: "operations", label: "Operations" },
                      { id: "access", label: "Access" },
                    ].map((filter) => (
                      <Button
                        key={filter.id}
                        size="sm"
                        variant={boardActivityFilter === filter.id ? "default" : "outline"}
                        onClick={() => setBoardActivityFilter(filter.id as typeof boardActivityFilter)}
                      >
                        {filter.label}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-3">
                {filteredBoardActivityItems.map((entry) => (
                  <div key={entry.id} className={`rounded-md border p-3 ${isMobile ? "space-y-3" : "flex items-center justify-between gap-3"}`}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-medium">{entry.title}</div>
                        <Badge variant="outline">{entry.laneLabel}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">{formatStatusLabel(entry.action)} by {entry.actorEmail || "system"}</div>
                      {entry.changedFields && entry.changedFields.length > 0 ? (
                        <div className="text-xs text-muted-foreground mt-1">
                          Changed: {entry.changedFields.slice(0, 4).join(", ")}
                        </div>
                      ) : null}
                    </div>
                    <div className={`text-xs text-muted-foreground ${isMobile ? "" : "shrink-0"}`}>{new Date(entry.createdAt).toLocaleString()}</div>
                  </div>
                ))}
                {filteredBoardActivityItems.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No recent board-visible activity matches this filter yet.</div>
                ) : null}
              </div>
            </CardContent>
          </Card>

        </>
      ) : null}


      {/* Documents Tab */}
      {activeTab === "documents" && (
      <MobileSectionShell
        eyebrow="Documents"
        title="Community Documents"
        summary="Association files shared with owners, grouped so recent and high-value documents are easier to scan and open from a phone."
      >
          {(documents ?? []).length > 0 ? (
            <div className="grid gap-3">
              {recentDocuments.map((doc) => {
                const isRecent = (Date.now() - toTimestamp(doc.createdAt)) < 30 * 24 * 60 * 60 * 1000;
                return (
                  <div key={doc.id} className="rounded-xl border p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="min-w-0 break-words text-sm font-medium sm:text-base">{doc.title}</div>
                        {isRecent ? <Badge>New</Badge> : null}
                        <Badge variant="outline">{formatStatusLabel(doc.documentType)}</Badge>
                        <Badge variant="secondary">{doc.portalAudience}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Added {new Date(doc.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <a
                        href={doc.fileUrl}
                        className="inline-flex min-h-10 items-center justify-center rounded-full border px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open
                      </a>
                      <a
                        href={doc.fileUrl}
                        download
                        className="inline-flex min-h-10 items-center justify-center rounded-full border px-4 text-sm text-muted-foreground transition-colors hover:bg-muted"
                      >
                        Download
                      </a>
                    </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-md border py-8 text-center text-sm text-muted-foreground">No documents available yet.</div>
          )}
      </MobileSectionShell>
      )}

      {/* Notices Tab */}
      {activeTab === "notices" && (
      <MobileSectionShell
        eyebrow="Notices"
        title="Message Center"
        summary="Association notices and maintenance-related updates in one place, with scope and urgency made explicit."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{ownerMessageCenterItems.length} messages</Badge>
            <Badge variant="secondary">{ownerMessageCenterItems.filter((item) => !readNoticeIds.includes(item.id)).length} unread</Badge>
          </div>
        }
      >
          <div className="space-y-2">
            {ownerMessageCenterItems.map((item) => {
              const isExpanded = expandedNoticeId === item.id;
              const isRead = readNoticeIds.includes(item.id);
              const renderedPreview = item.snippet || item.detail;
              return (
                <div key={item.id} className="overflow-hidden rounded-xl border">
                  <button
                    className="w-full px-4 py-4 text-left transition-colors hover:bg-muted/30"
                    onClick={() => {
                      if (!isExpanded) markNoticeRead(item.id);
                      setExpandedNoticeId(isExpanded ? null : item.id);
                    }}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{item.title}</span>
                          <Badge variant={isRead ? "outline" : "default"} className="text-xs">
                            {isRead ? "Read" : "Unread"}
                          </Badge>
                          <Badge variant={item.stateLabel === "Action needed" ? "destructive" : item.stateLabel === "Waiting on management" ? "default" : "secondary"} className="text-xs">
                            {item.stateLabel}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {item.kind === "maintenance" ? "Maintenance" : "Notice"}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">{item.scopeLabel}</Badge>
                        </div>
                        {!isExpanded && renderedPreview && (
                          <div className="mt-1 text-xs text-muted-foreground sm:truncate">{renderedPreview}</div>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 sm:justify-end sm:shrink-0">
                        <span className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleDateString()}</span>
                        <span className="text-xs text-muted-foreground">{isExpanded ? "▲" : "▼"}</span>
                      </div>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="border-t bg-muted/10">
                      <div className="px-4 py-3 text-sm whitespace-pre-wrap break-words">
                        {item.detail || "No message body available."}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {ownerMessageCenterItems.length === 0 && (
              <div className="rounded-md border py-8 text-center text-sm text-muted-foreground">No messages yet.</div>
            )}
          </div>
      </MobileSectionShell>
      )}

      {/* Maintenance Tab */}
      {activeTab === "maintenance" && (
      <>
      <MobileSectionShell
        eyebrow="Maintenance"
        title="Submit Maintenance Request"
        summary="Report an issue quickly, attach photos, and track open work without navigating a dense operator-style screen."
      >
        <div className="space-y-4">
          <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
            Response targets: <strong>urgent</strong> — 4 hours, <strong>high</strong> — 12 hours, <strong>medium</strong> — 48 hours, <strong>low</strong> — 120 hours. Overdue requests escalate automatically.
          </div>
          <div className="grid gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Issue title</label>
              <Input placeholder="Issue title" value={maintenanceTitle} onChange={(e) => setMaintenanceTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Description</label>
              <Textarea placeholder="Describe the issue" value={maintenanceDescription} onChange={(e) => setMaintenanceDescription(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Location</label>
              <Input placeholder="Location (unit/common area)" value={maintenanceLocation} onChange={(e) => setMaintenanceLocation(e.target.value)} />
            </div>
            <Select value={maintenanceCategory} onValueChange={setMaintenanceCategory}>
              <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                {maintenanceCategories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={maintenancePriority} onValueChange={setMaintenancePriority}>
              <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
              <SelectContent>
                {maintenancePriorities.map((priority) => <SelectItem key={priority} value={priority}>{priority}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => setMaintenanceFiles(Array.from(e.target.files ?? []))}
            />
            {maintenanceFiles.length > 0 ? (
              <div className="text-xs text-muted-foreground">
                Photos ready: {maintenanceFiles.map((file) => file.name).join(", ")}
              </div>
            ) : null}
          </div>
          <Button
            onClick={() => submitMaintenanceRequest.mutate()}
            disabled={submitMaintenanceRequest.isPending || !maintenanceTitle.trim() || !maintenanceDescription.trim()}
          >
            {submitMaintenanceRequest.isPending ? "Submitting…" : "Submit Maintenance Request"}
          </Button>
          {submitMaintenanceRequest.isError && (
            <p className="text-sm text-destructive">{(submitMaintenanceRequest.error as Error).message}</p>
          )}
          {maintenanceSuccess && (
            <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              Your maintenance request was submitted successfully. We'll notify you when there's an update.
            </div>
          )}

          <div className="space-y-3">
            {(maintenanceRequests ?? []).map((request) => (
              <div key={request.id} className="space-y-2 rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-medium">{request.title}</div>
                    <div className="text-xs text-muted-foreground">{request.locationText || "Location not specified"} · {request.category}</div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant={getStatusBadgeVariant(request.status)}>{getOwnerReadableState(request.status)}</Badge>
                    <Badge variant={request.priority === "urgent" ? "destructive" : request.priority === "high" ? "default" : "outline"}>
                      {request.priority === "urgent" ? "Urgent" : request.priority === "high" ? "Due soon" : formatStatusLabel(request.priority)}
                    </Badge>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">{request.description}</div>
                <div className="text-xs text-muted-foreground">
                  Submitted {new Date(request.createdAt).toLocaleString()} · SLA due {request.responseDueAt ? new Date(request.responseDueAt).toLocaleString() : "-"}
                </div>
                {request.resolutionNotes ? <div className="text-sm">Resolution: {request.resolutionNotes}</div> : null}
                {Array.isArray(request.attachmentUrlsJson) && request.attachmentUrlsJson.length > 0 ? (
                  <div className="flex gap-2 flex-wrap">
                    {request.attachmentUrlsJson.map((url, index) => (
                      <a key={url} href={url} className="underline text-xs" target="_blank" rel="noreferrer">Photo {index + 1}</a>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            {(maintenanceRequests ?? []).length === 0 ? <div className="text-sm text-muted-foreground">No maintenance requests submitted yet.</div> : null}
          </div>
        </div>
      </MobileSectionShell>

      <MobileSectionShell
        eyebrow="Updates"
        title="Maintenance Updates"
        summary="Read the latest owner-facing maintenance notices in a mobile-friendly timeline."
      >
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Update</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {maintenanceUpdates.map((notice) => (
                <TableRow key={notice.id}>
                  <TableCell>{notice.subject || "-"}</TableCell>
                  <TableCell className="max-w-[520px]">{notice.bodySnippet || "-"}</TableCell>
                  <TableCell>{new Date(notice.createdAt).toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {maintenanceUpdates.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-muted-foreground">No maintenance updates yet.</TableCell></TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
        <div className="space-y-3 md:hidden">
          {maintenanceUpdates.map((notice) => (
            <div key={notice.id} className="rounded-xl border p-4">
              <div className="text-sm font-medium">{notice.subject || "-"}</div>
              <div className="mt-2 text-sm text-muted-foreground">{notice.bodySnippet || "-"}</div>
              <div className="mt-3 text-xs text-muted-foreground">{new Date(notice.createdAt).toLocaleString()}</div>
            </div>
          ))}
          {maintenanceUpdates.length === 0 ? (
            <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No maintenance updates yet.</div>
          ) : null}
        </div>
      </MobileSectionShell>
      </>
      )}

      {/* Financials Tab */}
      {activeTab === "financials" && (
      <>
      <MobileSectionShell
        eyebrow="Financials"
        title="Pay dues and review recent activity"
        summary="Stay focused on one unit, one amount due, and the latest transactions."
        meta={
          <div className={`rounded-xl px-4 py-3 ${totalPortfolioBalance > 0 ? "bg-red-50 text-red-700" : totalPortfolioBalance < 0 ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-700"}`}>
            <div className="text-xs uppercase tracking-wide opacity-70">Account total</div>
            <div className="mt-1 text-2xl font-bold">
              {totalPortfolioBalance > 0
                ? `$${totalPortfolioBalance.toFixed(2)} due`
                : totalPortfolioBalance < 0
                ? `Credit $${Math.abs(totalPortfolioBalance).toFixed(2)}`
                : "$0.00"}
            </div>
          </div>
        }
      >
        <div className="space-y-6">
            {myUnits.length > 1
              ? renderOwnerUnitSelector({
                  activeUnitId: focusedFinancialUnit?.unitId,
                  onSelect: (unit) => setOwnedUnitFocusId(unit.unitId),
                })
              : null}

            <div className="rounded-2xl border bg-slate-50/60 p-4 sm:p-6">
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-2">
                    <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-semibold">Current statement</div>
                    <div className="font-semibold text-2xl">
                      {focusedFinancialUnit ? formatUnitContextLabel(focusedFinancialUnit.building, focusedFinancialUnit.unitNumber) : "No unit selected"}
                    </div>
                    <p className="text-sm text-muted-foreground max-w-2xl">
                      Review the balance for this unit, make a payment, and check the latest account activity without digging through setup controls.
                    </p>
                  </div>
                  <div className={`min-w-[180px] rounded-2xl px-5 py-4 ${currentUnitPayableBalance > 0 ? "bg-red-50 text-red-700" : focusedFinancialUnit?.balance && focusedFinancialUnit.balance < 0 ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-700"}`}>
                    <div className="text-xs uppercase tracking-wide opacity-70">Amount due</div>
                    <div className="text-3xl font-bold mt-1">
                      {currentUnitPayableBalance > 0
                        ? `$${currentUnitPayableBalance.toFixed(2)}`
                        : focusedFinancialUnit?.balance && focusedFinancialUnit.balance < 0
                        ? `Credit $${Math.abs(focusedFinancialUnit.balance).toFixed(2)}`
                        : "$0.00"}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border bg-white p-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Statement status</div>
                    <div className={`mt-2 text-sm font-semibold ${currentUnitPayableBalance > 0 ? "text-red-600" : focusedFinancialUnit?.balance && focusedFinancialUnit.balance < 0 ? "text-green-600" : "text-slate-700"}`}>
                      {currentUnitPayableBalance > 0
                        ? "Payment due now"
                        : focusedFinancialUnit?.balance && focusedFinancialUnit.balance < 0
                        ? "Account has a credit"
                        : "Account is current"}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {financialDashboard?.nextDueDate ? `Next charge ${new Date(financialDashboard.nextDueDate).toLocaleDateString()}` : "No upcoming charge scheduled"}
                    </div>
                  </div>
                  <div className="rounded-xl border bg-white p-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Latest payment</div>
                    <div className="mt-2 text-sm font-semibold">
                      {recentFocusedPayment ? `$${Math.abs(recentFocusedPayment.amount).toFixed(2)}` : "No payment yet"}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {recentFocusedPayment
                        ? `${new Date(recentFocusedPayment.postedAt).toLocaleDateString()} · ${recentFocusedPayment.description || formatStatusLabel(recentFocusedPayment.entryType)}`
                        : "Pay from this page once a balance is due."}
                    </div>
                  </div>
                  <div className={`rounded-xl border p-4 ${paymentSetupStateTone}`}>
                    <div className="text-xs uppercase tracking-wide opacity-80">Payment setup</div>
                    <div className="mt-2 text-sm font-semibold">{paymentSetupStateLabel}</div>
                    <div className="mt-1 text-xs opacity-80">
                      {activeAutopayEnrollment
                        ? `Using ${defaultPaymentMethod?.displayName || "saved method"}`
                        : defaultPaymentMethod
                        ? `${defaultPaymentMethod.displayName} is ready for use`
                        : "Add a method below before enabling autopay."}
                    </div>
                  </div>
                </div>

                {paymentReceipt ? (
                  <div className="rounded-md border border-green-200 bg-green-50 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-green-700">Payment recorded</div>
                      <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setPaymentReceipt(null)}>Dismiss</button>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <div><span className="font-medium">Amount:</span> ${paymentReceipt.amount.toFixed(2)}</div>
                      <div><span className="font-medium">Description:</span> {paymentReceipt.description}</div>
                      <div><span className="font-medium">Date:</span> {paymentReceipt.date}</div>
                      {paymentReceipt.confirmationNumber ? <div><span className="font-medium">Confirmation #:</span> {paymentReceipt.confirmationNumber}</div> : null}
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
                  <div className="rounded-xl border bg-slate-50/70 p-5 space-y-4">
                    <div>
                      <div className="text-sm font-semibold">Make a payment</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {currentUnitPayableBalance > 0
                          ? "Start with the full amount due, then adjust only if you need a different payment."
                          : "This unit does not have a payment due right now."}
                      </div>
                    </div>

                    {currentUnitPayableBalance > 0 ? (
                      <div className={`flex gap-2 flex-wrap ${isMobile ? "flex-col" : ""}`}>
                        <Button size="sm" onClick={() => { setPaymentFormOpen(true); setPaymentAmount(currentUnitPayableBalance.toFixed(2)); setPaymentDescription("HOA dues payment"); }}>
                          Pay ${currentUnitPayableBalance.toFixed(2)}
                        </Button>
                        {financialDashboard?.paymentPlan ? (
                          <Button size="sm" variant="outline" onClick={() => { setPaymentFormOpen(true); setPaymentAmount(financialDashboard.paymentPlan!.installmentAmount.toFixed(2)); setPaymentDescription("Payment plan installment"); }}>
                            Pay installment ${financialDashboard.paymentPlan.installmentAmount.toFixed(2)}
                          </Button>
                        ) : null}
                        <Button size="sm" variant="ghost" onClick={() => { setPaymentFormOpen((current) => !current); if (!paymentAmount) setPaymentDescription("HOA dues payment"); }}>
                          {paymentFormOpen ? "Hide custom amount" : "Enter custom amount"}
                        </Button>
                      </div>
                    ) : null}

                    {paymentFormOpen ? (
                      <div className="rounded-lg border bg-white p-4 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">Amount ($)</label>
                            <Input className={isMobile ? "min-h-11" : undefined} type="number" min="0.01" step="0.01" placeholder="0.00" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">Description</label>
                            <Input className={isMobile ? "min-h-11" : undefined} placeholder="HOA dues payment" value={paymentDescription} onChange={(e) => setPaymentDescription(e.target.value)} />
                          </div>
                        </div>
                        <div className={`flex justify-end gap-2 ${isMobile ? "flex-col" : ""}`}>
                          <Button variant="outline" size="sm" onClick={() => setPaymentFormOpen(false)}>Cancel</Button>
                          <Button
                            size="sm"
                            onClick={() => submitPayment.mutate()}
                            disabled={!paymentAmount || parseFloat(paymentAmount) <= 0 || submitPayment.isPending || !focusedFinancialUnit}
                          >
                            {submitPayment.isPending ? "Processing..." : "Record payment"}
                          </Button>
                        </div>
                        {submitPayment.isError ? <p className="text-xs text-red-600">{(submitPayment.error as Error)?.message}</p> : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-xl border p-5 space-y-4">
                    <div className="text-sm font-semibold">Account details</div>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-start justify-between gap-4 border-b pb-3">
                        <span className="text-muted-foreground">Next charge</span>
                        <span className="font-medium text-right">
                          {financialDashboard?.nextDueDate ? new Date(financialDashboard.nextDueDate).toLocaleDateString() : "No upcoming charge"}
                        </span>
                      </div>
                      <div className="flex items-start justify-between gap-4 border-b pb-3">
                        <span className="text-muted-foreground">Payment method</span>
                        <span className="font-medium text-right">{defaultPaymentMethod ? defaultPaymentMethod.displayName : "Not set up"}</span>
                      </div>
                      <div className="flex items-start justify-between gap-4 border-b pb-3">
                        <span className="text-muted-foreground">Autopay</span>
                        <span className="font-medium text-right">{activeAutopayEnrollment ? "Active" : "Not enrolled"}</span>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-muted-foreground">Payment plan</span>
                        <span className="font-medium text-right">
                          {financialDashboard?.paymentPlan
                            ? `$${financialDashboard.paymentPlan.installmentAmount.toFixed(2)} ${financialDashboard.paymentPlan.installmentFrequency}`
                            : "None"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <MobileSectionShell
              title="Recent transactions"
              summary="Charges, payments, and credits for the selected unit."
              meta={recentFocusedPayment ? (
                <div className="text-xs text-muted-foreground">
                  Latest payment {new Date(recentFocusedPayment.postedAt).toLocaleDateString()} · ${Math.abs(recentFocusedPayment.amount).toFixed(2)}
                </div>
              ) : undefined}
            >
                <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {focusedFinancialLedgerEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="text-muted-foreground text-sm">{new Date(entry.postedAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge variant={entry.entryType === "payment" || entry.entryType === "credit" ? "default" : entry.entryType === "late-fee" ? "destructive" : "outline"}>
                            {formatStatusLabel(entry.entryType)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{entry.description || "-"}</TableCell>
                        <TableCell className={`text-right font-mono text-sm ${entry.amount > 0 ? "text-red-600" : "text-green-600"}`}>
                          {entry.amount > 0 ? "+" : ""}{entry.amount.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {focusedFinancialLedgerEntries.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No ledger entries found for the selected unit.</TableCell></TableRow>
                    ) : null}
                  </TableBody>
                </Table>
                </div>
                <div className="space-y-3 md:hidden">
                  {focusedFinancialLedgerEntries.map((entry) => (
                    <div key={entry.id} className="rounded-xl border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium">{entry.description || formatStatusLabel(entry.entryType)}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{new Date(entry.postedAt).toLocaleDateString()}</div>
                        </div>
                        <div className={`text-right text-sm font-semibold ${entry.amount > 0 ? "text-red-600" : "text-green-600"}`}>
                          {entry.amount > 0 ? "+" : ""}{entry.amount.toFixed(2)}
                        </div>
                      </div>
                      <div className="mt-3">
                        <Badge variant={entry.entryType === "payment" || entry.entryType === "credit" ? "default" : entry.entryType === "late-fee" ? "destructive" : "outline"}>
                          {formatStatusLabel(entry.entryType)}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {focusedFinancialLedgerEntries.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                      <div className="font-medium text-foreground">No account activity yet</div>
                      <div className="mt-1">
                        Charges, payments, and credits will appear here after the first posting for this unit.
                      </div>
                    </div>
                  ) : null}
                </div>
            </MobileSectionShell>

            <MobileSectionShell
              title="Payment setup"
              summary="Open this only when you need to update saved methods or autopay."
              actions={
                <>
                  <Button size="sm" variant="outline" onClick={() => setAddMethodOpen((current) => !current)}>
                    {addMethodOpen ? "Hide methods" : "Manage methods"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setAutopayFormOpen((current) => !current)}>
                    {autopayFormOpen ? "Hide autopay" : "Manage autopay"}
                  </Button>
                </>
              }
            >
                <div className="space-y-4">
                {(defaultPaymentMethod || activeAutopayEnrollment || financialDashboard?.paymentPlan) ? (
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-lg border p-4">
                      <div className="text-xs text-muted-foreground">Default method</div>
                      <div className="text-sm font-semibold mt-2">{defaultPaymentMethod ? defaultPaymentMethod.displayName : "Not set up"}</div>
                    </div>
                    <div className="rounded-lg border p-4">
                      <div className="text-xs text-muted-foreground">Autopay</div>
                      <div className="text-sm font-semibold mt-2">{activeAutopayEnrollment ? "Active" : "Not enrolled"}</div>
                    </div>
                    <div className="rounded-lg border p-4">
                      <div className="text-xs text-muted-foreground">Payment plan</div>
                      <div className="text-sm font-semibold mt-2">
                        {financialDashboard?.paymentPlan
                          ? `$${financialDashboard.paymentPlan.installmentAmount.toFixed(2)} ${financialDashboard.paymentPlan.installmentFrequency}`
                          : "None"}
                      </div>
                    </div>
                  </div>
                ) : null}

                {financialDashboard?.paymentPlan ? (
                  <div className="rounded-lg border p-4 space-y-1">
                    <div className="text-xs text-muted-foreground">Payment plan on file</div>
                    <div className="text-sm font-semibold">
                      ${financialDashboard.paymentPlan.installmentAmount.toFixed(2)} {financialDashboard.paymentPlan.installmentFrequency}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {financialDashboard.paymentPlan.nextDueDate ? `Next installment ${new Date(financialDashboard.paymentPlan.nextDueDate).toLocaleDateString()}` : "Installment schedule on file"}
                    </div>
                  </div>
                ) : null}

                {addMethodOpen ? (
                  <div className="rounded-lg border bg-slate-50 p-4 space-y-3">
                    {savedMethods.length > 0 ? (
                      <div className="space-y-3">
                        {savedMethods.filter((method) => method.isActive !== 0).map((method) => (
                          <div key={method.id} className="rounded-lg border bg-white p-4 flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="font-medium">{method.displayName}</div>
                                {method.isDefault === 1 ? <Badge>Default</Badge> : null}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {[method.methodType, method.bankName, method.last4 ? `•••• ${method.last4}` : null].filter(Boolean).join(" · ")}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {method.isDefault !== 1 ? (
                                <Button size="sm" variant="ghost" onClick={() => setDefaultMethod.mutate(method.id)} disabled={setDefaultMethod.isPending}>Make default</Button>
                              ) : null}
                              <Button size="sm" variant="ghost" onClick={() => removeMethod.mutate(method.id)} disabled={removeMethod.isPending}>Remove</Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed bg-white p-4 text-sm text-muted-foreground">
                        Add a payment method to pay balances faster and enable autopay.
                      </div>
                    )}
                    <div className="grid grid-cols-1 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Display name</label>
                        <Input className={isMobile ? "min-h-11" : undefined} placeholder="Primary bank account" value={methodForm.displayName} onChange={(e) => setMethodForm((current) => ({ ...current, displayName: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Bank name</label>
                        <Input className={isMobile ? "min-h-11" : undefined} placeholder="Bank name" value={methodForm.bankName} onChange={(e) => setMethodForm((current) => ({ ...current, bankName: e.target.value }))} />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Last 4 digits</label>
                          <Input className={isMobile ? "min-h-11" : undefined} placeholder="1234" value={methodForm.last4} onChange={(e) => setMethodForm((current) => ({ ...current, last4: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Method type</label>
                          <Select value={methodForm.methodType} onValueChange={(value) => setMethodForm((current) => ({ ...current, methodType: value }))}>
                            <SelectTrigger className={isMobile ? "min-h-11" : undefined}><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ach">ACH</SelectItem>
                              <SelectItem value="card">Card</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={methodForm.isDefault} onChange={(e) => setMethodForm((current) => ({ ...current, isDefault: e.target.checked }))} />
                      Set as default
                    </label>
                    <Button size="sm" onClick={() => addMethod.mutate()} disabled={addMethod.isPending || !methodForm.displayName.trim()}>
                      {addMethod.isPending ? "Saving..." : "Save method"}
                    </Button>
                  </div>
                ) : null}

                {autopayFormOpen ? (
                  <div className="rounded-lg border bg-slate-50 p-4 space-y-3">
                    {activeAutopayEnrollment ? (
                      <div className="rounded-lg border bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-medium">Current autopay</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              ${Number(activeAutopayEnrollment.amount ?? 0).toFixed(2)} {activeAutopayEnrollment.frequency}
                              {activeAutopayEnrollment.dayOfMonth ? ` · day ${activeAutopayEnrollment.dayOfMonth}` : ""}
                            </div>
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => cancelAutopay.mutate(activeAutopayEnrollment.id)} disabled={cancelAutopay.isPending}>Cancel autopay</Button>
                        </div>
                      </div>
                    ) : null}
                    <div className="grid grid-cols-1 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Amount</label>
                        <Input className={isMobile ? "min-h-11" : undefined} placeholder="0.00" value={autopayForm.amount} onChange={(e) => setAutopayForm((current) => ({ ...current, amount: e.target.value }))} />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Day of month</label>
                          <Input className={isMobile ? "min-h-11" : undefined} placeholder="1" value={autopayForm.dayOfMonth} onChange={(e) => setAutopayForm((current) => ({ ...current, dayOfMonth: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Frequency</label>
                          <Select value={autopayForm.frequency} onValueChange={(value) => setAutopayForm((current) => ({ ...current, frequency: value }))}>
                            <SelectTrigger className={isMobile ? "min-h-11" : undefined}><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="monthly">Monthly</SelectItem>
                              <SelectItem value="quarterly">Quarterly</SelectItem>
                              <SelectItem value="annually">Annually</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Description</label>
                        <Input className={isMobile ? "min-h-11" : undefined} placeholder="Monthly dues autopay" value={autopayForm.description} onChange={(e) => setAutopayForm((current) => ({ ...current, description: e.target.value }))} />
                      </div>
                    </div>
                    <Button size="sm" onClick={() => enrollAutopay.mutate()} disabled={enrollAutopay.isPending || !autopayForm.amount.trim()}>
                      {enrollAutopay.isPending ? "Saving..." : activeAutopayEnrollment ? "Save autopay" : "Enroll in autopay"}
                    </Button>
                  </div>
                ) : null}
                </div>
            </MobileSectionShell>
        </div>
      </MobileSectionShell>
      </>
      )}

    </div>

      {/* Mobile bottom tab navigation — shown on small screens in owner mode */}
      {workspaceMode === "owner" && (
        <div className="fixed bottom-0 left-0 right-0 z-20 border-t bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
          <div className="flex">
            {ownerTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col items-center justify-center px-1 py-2 text-xs font-medium transition-colors min-h-[3.75rem] ${
                  activeTab === tab.id
                    ? "text-primary border-t-2 border-primary -mt-px bg-primary/5"
                    : "text-muted-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}
  </div>
  );
}
