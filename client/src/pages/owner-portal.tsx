import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { AnnualGovernanceTask, Association, BoardRole, CommunicationHistory, ContactUpdateRequest, Document, GovernanceMeeting, MaintenanceRequest, NoticeSend, OwnerLedgerEntry, Person, PortalAccess, Unit, VendorInvoice } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
    recent: Array<{ id: string; entityType: string; action: string; actorEmail: string | null; createdAt: string }>;
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

export default function OwnerPortalPage() {
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
  const [activeTab, setActiveTab] = useState<"overview" | "financials" | "unit" | "maintenance" | "documents" | "notices" | "board">("overview");
  const [expandedNoticeId, setExpandedNoticeId] = useState<string | null>(null);
  const [maintenanceSuccess, setMaintenanceSuccess] = useState(false);
  const [contactUpdateSuccess, setContactUpdateSuccess] = useState(false);

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

  const { data: me } = useQuery<PortalSession | null>({
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

  const { data: notices } = useQuery<CommunicationHistory[]>({
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
  const { data: myUnits = [] } = useQuery<MyUnit[]>({
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
      const myUnit = (me as any)?.unitId || "";
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
      const myUnit = (me as any)?.unitId || "";
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

  const submitContactUpdate = useMutation({
    mutationFn: async () => {
      const requestJson: Record<string, string> = {};
      if (requestedPhone.trim()) requestJson.phone = requestedPhone.trim();
      if (requestedMailingAddress.trim()) requestJson.mailingAddress = requestedMailingAddress.trim();
      if (requestedEmergencyContactName.trim()) requestJson.emergencyContactName = requestedEmergencyContactName.trim();
      if (requestedEmergencyContactPhone.trim()) requestJson.emergencyContactPhone = requestedEmergencyContactPhone.trim();
      if (requestedContactPreference.trim()) requestJson.contactPreference = requestedContactPreference.trim();
      const res = await fetch("/api/portal/contact-updates", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...portalHeaders(portalAccessId) },
        body: JSON.stringify({ requestJson }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: async () => {
      setRequestedPhone("");
      setRequestedMailingAddress("");
      setRequestedEmergencyContactName("");
      setRequestedEmergencyContactPhone("");
      setRequestedContactPreference("");
      setContactUpdateSuccess(true);
      setTimeout(() => setContactUpdateSuccess(false), 5000);
      await refetchRequests();
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
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          {/* Logo / Brand */}
          <div className="text-center space-y-1">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-primary-foreground text-xl font-bold mb-2">
              YCM
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Your Condo Management</h1>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Owner Portal</p>
            <p className="text-muted-foreground text-sm">
              {otpStep === "email"
                ? "Sign in to manage your HOA account, view balances, and submit requests."
                : otpStep === "pick"
                ? (() => {
                    const uniqueAssocs = new Set(associationChoices.map((c) => c.associationId));
                    if (uniqueAssocs.size > 1) return "You have access to multiple associations. Select one to continue.";
                    const assocName = associationChoices[0]?.associationName ?? "your association";
                    return associationChoices.length > 1
                      ? `You own ${associationChoices.length} units at ${assocName}. Select a unit to continue.`
                      : `Welcome back. Select your unit at ${assocName} to continue.`;
                  })()
                : "Check your email for a 6-digit login code. It expires in 15 minutes."}
            </p>
          </div>

          <Card className="shadow-md">
            <CardContent className="p-6 space-y-4">
              {otpStep === "email" && (
                <>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Email address</label>
                    <Input placeholder="you@example.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && email && requestLogin.mutate()} />
                  </div>
                  {requestLogin.isError && <p className="text-sm text-destructive">{(requestLogin.error as Error).message}</p>}
                  <Button onClick={() => requestLogin.mutate()} disabled={requestLogin.isPending || !email} className="w-full">
                    {requestLogin.isPending ? "Sending code…" : "Send Login Code"}
                  </Button>
                </>
              )}
              {otpStep === "otp" && (
                <>
                  <p className="text-sm text-muted-foreground">Code sent to: <strong>{email}</strong></p>
                  {otpSimulated && (
                    <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                      <strong>Dev mode:</strong> No email provider configured. Your code is: <strong className="font-mono text-lg">{otpSimulated}</strong>
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className="text-sm font-medium">6-digit code</label>
                    <Input placeholder="000000" value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6}
                      className="font-mono text-center text-2xl tracking-widest h-14"
                      onKeyDown={(e) => e.key === "Enter" && otp.length >= 6 && verifyLogin.mutate(undefined)} />
                  </div>
                  {verifyLogin.isError && <p className="text-sm text-destructive">{(verifyLogin.error as Error).message}</p>}
                  <Button onClick={() => verifyLogin.mutate()} disabled={verifyLogin.isPending || otp.length < 6} className="w-full">
                    {verifyLogin.isPending ? "Verifying…" : "Verify & Sign In"}
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="flex-1 text-xs" onClick={() => { setOtp(""); setOtpSimulated(null); requestLogin.mutate(); }} disabled={requestLogin.isPending}>
                      {requestLogin.isPending ? "Sending…" : "Resend code"}
                    </Button>
                    <Button variant="ghost" size="sm" className="flex-1 text-xs" onClick={() => { setOtpStep("email"); setOtp(""); setOtpSimulated(null); }}>
                      Use a different email
                    </Button>
                  </div>
                </>
              )}
              {otpStep === "pick" && (
                <>
                  <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    Signed in as <strong>{email}</strong>
                  </div>

                  {/* Group choices by association */}
                  <div className="space-y-5">
                    {(() => {
                      const byAssoc = new Map<string, AssociationChoice[]>();
                      for (const c of associationChoices) {
                        if (!byAssoc.has(c.associationId)) byAssoc.set(c.associationId, []);
                        byAssoc.get(c.associationId)!.push(c);
                      }
                      const multipleAssocs = byAssoc.size > 1;

                      return Array.from(byAssoc.entries()).map(([assocId, choices]) => {
                        const assocName = choices[0].associationName;
                        const assocCity = choices[0].associationCity;
                        const multipleUnits = choices.length > 1;

                        return (
                          <div key={assocId} className="space-y-2">
                            {/* Association header — always shown when multi-assoc; shown as context when multi-unit */}
                            {(multipleAssocs || multipleUnits) && (
                              <div className="space-y-0.5 pb-1">
                                <div className="text-sm font-semibold">{assocName}</div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  {assocCity && <span>{assocCity}</span>}
                                  {multipleUnits && (
                                    <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 font-medium">
                                      {choices.length} units
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Unit cards — grid for multiple units, full-width for single */}
                            <div className={multipleUnits ? "grid grid-cols-2 gap-2" : "space-y-2"}>
                              {choices.map((choice) => {
                                const unitLabel = choice.unitNumber
                                  ? [choice.building ? `Bldg ${choice.building}` : null, `Unit ${choice.unitNumber}`]
                                      .filter(Boolean).join(" · ")
                                  : null;
                                return (
                                  <button
                                    key={choice.portalAccessId}
                                    onClick={() => verifyLogin.mutate({ portalAccessId: choice.portalAccessId, associationId: choice.associationId })}
                                    disabled={verifyLogin.isPending}
                                    className="group rounded-xl border border-border bg-background p-4 text-left transition-all hover:border-primary hover:bg-primary/5 hover:shadow-sm disabled:opacity-50 space-y-2 w-full"
                                  >
                                    {multipleUnits ? (
                                      /* Unit-focused when same association */
                                      <>
                                        <div className="flex items-center justify-between gap-1">
                                          <div className="font-semibold text-sm">{unitLabel ?? "Unit"}</div>
                                          <span className="text-primary opacity-0 group-hover:opacity-100 transition-opacity text-xs">→</span>
                                        </div>
                                        <div className="text-xs text-muted-foreground capitalize">{choice.role}</div>
                                      </>
                                    ) : (
                                      /* Association-focused for single unit or multiple associations */
                                      <>
                                        <div className="flex items-center justify-between gap-1">
                                          <div className="font-semibold text-sm">{assocName}</div>
                                          <span className="text-primary opacity-0 group-hover:opacity-100 transition-opacity text-xs">→</span>
                                        </div>
                                        {assocCity && <div className="text-xs text-muted-foreground">{assocCity}</div>}
                                        {unitLabel && <div className="text-xs font-medium text-primary">{unitLabel}</div>}
                                        <div className="text-xs text-muted-foreground capitalize">{choice.role}</div>
                                      </>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>

                  <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => { setOtpStep("email"); setOtp(""); setOtpSimulated(null); setAssociationChoices([]); }}>
                    Use a different email
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground">
            Need help? Contact your association management office.
          </p>
        </div>
      </div>
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
  const unitLabel = me?.unitNumber
    ? [me.building ? `Bldg ${me.building}` : null, `Unit ${me.unitNumber}`].filter(Boolean).join(" · ")
    : null;

  // Units owned by this person in the current association (for the unit switcher)
  const siblingUnits = (myAssociations ?? []).filter(
    (a) => a.associationId === currentAssociation?.associationId && a.unitId
  );
  const hasMultipleUnits = siblingUnits.length > 1;

  const ownerTabs = [
    { id: "overview" as const, label: "Overview" },
    { id: "financials" as const, label: "Financials" },
    { id: "unit" as const, label: hasMultipleUnits ? "My Units" : "My Unit" },
    { id: "maintenance" as const, label: "Maintenance" },
    { id: "documents" as const, label: "Documents" },
    { id: "notices" as const, label: "Notices" },
    ...(me?.hasBoardAccess ? [{ id: "board" as const, label: "Board Workspace" }] : []),
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top header bar */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">YCM</div>
            <div className="min-w-0">
              <div className="font-semibold text-sm truncate">{associationName}</div>
              <div className="flex items-center gap-2 flex-wrap">
                {associationCity && <span className="text-xs text-muted-foreground">{associationCity}</span>}
                {unitLabel && <span className="text-xs text-muted-foreground">· {unitLabel}</span>}
                {me && <span className="text-xs text-muted-foreground capitalize">· {me.effectiveRole}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Unit switcher — shown when owner has multiple units in the same association */}
            {hasMultipleUnits && (
              <Select
                value={portalAccessId}
                onValueChange={(val) => {
                  setPortalAccessId(val);
                  window.localStorage.setItem("portalAccessId", val);
                  setActiveTab("overview");
                }}
              >
                <SelectTrigger className="w-36 h-8 text-xs">
                  <SelectValue placeholder="Switch unit" />
                </SelectTrigger>
                <SelectContent>
                  {siblingUnits.map((a) => {
                    const label = a.unitNumber
                      ? [a.building ? `Bldg ${a.building}` : null, `Unit ${a.unitNumber}`].filter(Boolean).join(" · ")
                      : "No unit";
                    return (
                      <SelectItem key={a.portalAccessId} value={a.portalAccessId}>
                        {label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
            {/* Association switcher — shown only when owner has access to multiple distinct associations */}
            {myAssociations && new Set(myAssociations.map((a) => a.associationId)).size > 1 && (
              <Select
                value={portalAccessId}
                onValueChange={(val) => {
                  setPortalAccessId(val);
                  window.localStorage.setItem("portalAccessId", val);
                  setActiveTab("overview");
                }}
              >
                <SelectTrigger className="w-44 h-8 text-xs">
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
              onClick={() => {
                window.localStorage.removeItem("portalAccessId");
                setPortalAccessId("");
              }}
            >
              Sign Out
            </Button>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="px-6 flex gap-0 overflow-x-auto border-t">
          {ownerTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 md:p-8 space-y-8 max-w-5xl mx-auto">

      {/* Overview Tab: association hero + onboarding + balance + notices */}
      {activeTab === "overview" && (
        <>
          {/* Association hero */}
          <div className="rounded-xl bg-gradient-to-br from-slate-800 to-slate-700 text-white p-6 md:p-8 shadow-sm">
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
                <div className="bg-white/10 rounded-lg px-4 py-3 text-sm shrink-0 space-y-2">
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
                              setPortalAccessId(u.portalAccessId);
                              window.localStorage.setItem("portalAccessId", u.portalAccessId);
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
                  <div className="text-slate-300 text-xs capitalize">{me?.effectiveRole}</div>
                </div>
              ) : unitLabel ? (
                <div className="bg-white/10 rounded-lg px-4 py-3 text-sm shrink-0">
                  <div className="text-slate-400 text-xs uppercase tracking-wide mb-0.5">Your Unit</div>
                  <div className="font-semibold text-white">{unitLabel}</div>
                  <div className="text-slate-300 text-xs capitalize mt-0.5">{me?.effectiveRole}</div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Onboarding checklist */}
          {!onboardingDismissed && !me?.hasBoardAccess && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-6 space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-primary font-semibold mb-1">Getting Started</div>
                    <div className="font-semibold text-base">Welcome to your owner portal</div>
                    <div className="text-sm text-muted-foreground mt-0.5">Complete these steps to get fully set up.</div>
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
                      detail: "You're in — your portal is ready.",
                      tab: null,
                    },
                    {
                      done: (financialDashboard?.balance ?? 0) === 0,
                      label: "Review your balance",
                      detail: financialDashboard
                        ? (financialDashboard.balance > 0
                            ? `You have $${financialDashboard.balance.toFixed(2)} outstanding.`
                            : "Your account is current — no balance due.")
                        : "Check any outstanding charges or payments.",
                      tab: "financials" as const,
                    },
                    {
                      done: Boolean(documents?.length),
                      label: "Browse community documents",
                      detail: documents?.length
                        ? `${documents.length} document${documents.length > 1 ? "s" : ""} available`
                        : "CC&Rs, bylaws, and community notices are shared here.",
                      tab: "documents" as const,
                    },
                    {
                      done: Boolean(requests?.length),
                      label: "Verify your contact information",
                      detail: "Confirm your phone, mailing address, and emergency contact are current.",
                      tab: "unit" as const,
                    },
                    {
                      done: Boolean(maintenanceRequests?.length),
                      label: "Submit a maintenance request if needed",
                      detail: "Report any issues in your unit or common areas.",
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
                      {!step.done && step.tab && (
                        <button
                          className="text-xs text-primary hover:underline shrink-0 mt-0.5"
                          onClick={() => setActiveTab(step.tab!)}
                        >
                          Go →
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Balance summary */}
          <Card>
            <CardContent className="p-6">
              {hasMultipleUnits && unitsBalance.length > 0 ? (
                // Multi-unit: show combined total + per-unit breakdown
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Total Amount Due — All Units</div>
                      {(() => {
                        const total = unitsBalance.reduce((sum, u) => sum + u.balance, 0);
                        return (
                          <div className={`text-3xl font-bold mt-1 ${total > 0 ? "text-red-600" : "text-green-600"}`}>
                            {total > 0 ? `$${total.toFixed(2)}` : total < 0 ? `Credit $${Math.abs(total).toFixed(2)}` : "$0.00"}
                          </div>
                        );
                      })()}
                    </div>
                    <Button size="sm" onClick={() => setActiveTab("financials")}>View Financials</Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {unitsBalance.map((u) => {
                      const label = u.unitNumber
                        ? [u.building ? `Bldg ${u.building}` : null, `Unit ${u.unitNumber}`].filter(Boolean).join(" · ")
                        : "Unit";
                      const isCurrent = u.portalAccessId === portalAccessId;
                      return (
                        <button
                          key={u.unitId}
                          className={`rounded-md border p-3 text-left transition-colors hover:bg-muted/30 ${isCurrent ? "border-primary/40 bg-primary/5" : ""}`}
                          onClick={() => {
                            if (u.portalAccessId && u.portalAccessId !== portalAccessId) {
                              setPortalAccessId(u.portalAccessId);
                              window.localStorage.setItem("portalAccessId", u.portalAccessId);
                            }
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-medium">{label}</div>
                            {isCurrent && <span className="text-xs text-primary font-medium">Viewing</span>}
                          </div>
                          <div className={`text-lg font-semibold mt-0.5 ${u.balance > 0 ? "text-red-600" : "text-green-600"}`}>
                            {u.balance > 0 ? `$${u.balance.toFixed(2)}` : u.balance < 0 ? `Credit $${Math.abs(u.balance).toFixed(2)}` : "$0.00"}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                // Single unit: original compact layout
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Amount Due</div>
                    {financialDashboard ? (
                      <div className={`text-3xl font-bold mt-1 ${financialDashboard.balance > 0 ? "text-red-600" : "text-green-600"}`}>
                        {financialDashboard.balance > 0
                          ? `$${financialDashboard.balance.toFixed(2)}`
                          : financialDashboard.balance < 0
                          ? `Credit $${Math.abs(financialDashboard.balance).toFixed(2)}`
                          : "$0.00"}
                      </div>
                    ) : (
                      <div className="text-3xl font-bold mt-1 text-muted-foreground">—</div>
                    )}
                    {financialDashboard?.nextDueDate && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Next charge due {new Date(financialDashboard.nextDueDate).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <Button size="sm" onClick={() => setActiveTab("financials")}>View Financials</Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent notices */}
          {(notices ?? []).length > 0 && (
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold">Recent Notices</h2>
                  <button className="text-xs text-primary hover:underline" onClick={() => setActiveTab("notices")}>View all</button>
                </div>
                <div className="divide-y">
                  {(notices ?? []).slice(0, 3).map((notice) => {
                    const isExpanded = expandedNoticeId === notice.id;
                    return (
                      <div key={notice.id} className="py-3 first:pt-0 last:pb-0">
                        <button
                          className="w-full text-left"
                          onClick={() => setExpandedNoticeId(isExpanded ? null : notice.id)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-sm font-medium">{notice.subject || "—"}</div>
                            <span className="text-xs text-muted-foreground shrink-0">{isExpanded ? "▲" : "▼"}</span>
                          </div>
                          {!isExpanded && <div className="text-xs text-muted-foreground mt-0.5 truncate">{stripHtml(notice.bodySnippet)}</div>}
                        </button>
                        {isExpanded && (() => {
                          const isHtml = (notice.bodySnippet || "").trimStart().startsWith("<");
                          return isHtml ? (
                            <iframe
                              srcDoc={notice.bodySnippet ?? ""}
                              className="w-full border-0 mt-1"
                              style={{ minHeight: "320px" }}
                              onLoad={(e) => {
                                const iframe = e.currentTarget;
                                const body = iframe.contentDocument?.body;
                                if (body) iframe.style.height = `${body.scrollHeight + 32}px`;
                              }}
                              sandbox="allow-same-origin"
                              title={notice.subject ?? "Notice"}
                            />
                          ) : (
                            <div className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{notice.bodySnippet || "No message body available."}</div>
                          );
                        })()}
                        <div className="text-xs text-muted-foreground mt-1">{new Date(notice.createdAt).toLocaleDateString()}</div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {me?.hasBoardAccess && activeTab === "board" ? (
        <>
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-lg font-semibold">Board Workspace</h2>
                  <p className="text-sm text-muted-foreground">Association-scoped view and edit access for active invited board members.</p>
                </div>
                <Badge>{me.effectiveRole}</Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Units</div><div className="text-2xl font-semibold">{boardOverview?.units ?? "-"}</div></div>
                <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Active Owners</div><div className="text-2xl font-semibold">{boardOverview?.activeOwners ?? "-"}</div></div>
                <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Occupants</div><div className="text-2xl font-semibold">{boardOverview?.activeOccupants ?? "-"}</div></div>
                <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Open Maintenance</div><div className="text-2xl font-semibold">{boardOverview?.maintenanceOpen ?? "-"}</div></div>
                <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Contact Coverage</div><div className="text-2xl font-semibold">{boardOverview?.contactCoveragePercent ?? "-"}%</div></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Workflow States</h2>
                <p className="text-sm text-muted-foreground">Operational state visibility across access, governance, maintenance, communications, and board distribution.</p>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-md border p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="font-medium">Access State</div>
                    <Badge variant={getStatusBadgeVariant(boardDashboard?.workflowStates.access.status ?? "active")}>
                      {formatStatusLabel(boardDashboard?.workflowStates.access.status ?? "active")}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {boardDashboard?.workflowStates.access.boardRole
                      ? `${boardDashboard.workflowStates.access.boardRole} operating with ${boardDashboard.workflowStates.access.effectiveRole} permissions.`
                      : `Operating with ${boardDashboard?.workflowStates.access.effectiveRole ?? me.effectiveRole} permissions.`}
                  </div>
                  {boardDashboard?.workflowStates.access.boardTerm ? (
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant={boardDashboard.workflowStates.access.boardTerm.isActive ? "default" : "outline"}>
                        {boardDashboard.workflowStates.access.boardTerm.isActive ? "term active" : "term ended"}
                      </Badge>
                      <Badge variant="outline">
                        start {new Date(boardDashboard.workflowStates.access.boardTerm.startDate).toLocaleDateString()}
                      </Badge>
                      <Badge variant="outline">
                        {boardDashboard.workflowStates.access.boardTerm.endDate
                          ? `end ${new Date(boardDashboard.workflowStates.access.boardTerm.endDate).toLocaleDateString()}`
                          : "no scheduled end"}
                      </Badge>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-md border p-4 space-y-3">
                  <div className="font-medium">Governance States</div>
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(boardDashboard?.workflowStates.governance.meetingsByStatus ?? {}).map(([status, count]) => (
                      <Badge key={`meeting-${status}`} variant={getStatusBadgeVariant(status)}>
                        {count} {formatStatusLabel(status)} meetings
                      </Badge>
                    ))}
                    {Object.entries(boardDashboard?.workflowStates.governance.summariesByStatus ?? {}).map(([status, count]) => (
                      <Badge key={`summary-${status}`} variant={getStatusBadgeVariant(status)}>
                        {count} {formatStatusLabel(status)} summaries
                      </Badge>
                    ))}
                    {Object.entries(boardDashboard?.workflowStates.governance.tasksByStatus ?? {}).map(([status, count]) => (
                      <Badge key={`task-${status}`} variant={getStatusBadgeVariant(status)}>
                        {count} {formatStatusLabel(status)} tasks
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="rounded-md border p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="font-medium">Maintenance States</div>
                    <Badge variant={boardDashboard?.workflowStates.maintenance.urgentOpenCount ? "destructive" : "outline"}>
                      {boardDashboard?.workflowStates.maintenance.urgentOpenCount ?? 0} urgent/high open
                    </Badge>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(boardDashboard?.workflowStates.maintenance.requestsByStatus ?? {}).map(([status, count]) => (
                      <Badge key={`maintenance-${status}`} variant={getStatusBadgeVariant(status)}>
                        {count} {formatStatusLabel(status)}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="rounded-md border p-4 space-y-3">
                  <div className="font-medium">Communications and Board Distribution</div>
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(boardDashboard?.workflowStates.communications.noticesByStatus ?? {}).map(([status, count]) => (
                      <Badge key={`notice-${status}`} variant={getStatusBadgeVariant(status)}>
                        {count} {formatStatusLabel(status)} notices
                      </Badge>
                    ))}
                    <Badge variant="default">
                      {boardDashboard?.workflowStates.communications.documentsPortalVisible ?? 0} portal-visible documents
                    </Badge>
                    <Badge variant="outline">
                      {boardDashboard?.workflowStates.communications.documentsInternalOnly ?? 0} internal-only documents
                    </Badge>
                    {Object.entries(boardDashboard?.workflowStates.communications.boardPackagesByStatus ?? {}).map(([status, count]) => (
                      <Badge key={`package-${status}`} variant={getStatusBadgeVariant(status)}>
                        {count} {formatStatusLabel(status)} packages
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Needs Attention</h2>
                <p className="text-sm text-muted-foreground">Action-first queue for board operators.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {(boardDashboard?.attention.items ?? []).map((item) => (
                  <div key={item.key} className="rounded-md border p-4 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">{item.label}</div>
                      <Badge variant={item.tone === "high" ? "destructive" : item.tone === "medium" ? "default" : "outline"}>{item.tone}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">{item.detail}</div>
                  </div>
                ))}
                {(boardDashboard?.attention.items ?? []).length === 0 ? (
                  <div className="rounded-md border p-4 text-sm text-muted-foreground">No urgent board action items are currently surfaced.</div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
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
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Recent Vendor Invoices</h3>
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
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Open Governance Tasks</h3>
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
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Meeting Manager</h2>
                <p className="text-sm text-muted-foreground">Create and update board meetings directly from the workspace.</p>
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="space-y-3 rounded-md border p-4">
                  <h3 className="text-sm font-medium">Create Meeting</h3>
                  <Input placeholder="Meeting title" value={newMeetingDraft.title} onChange={(e) => setNewMeetingDraft((current) => ({ ...current, title: e.target.value }))} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input placeholder="Meeting type" value={newMeetingDraft.meetingType} onChange={(e) => setNewMeetingDraft((current) => ({ ...current, meetingType: e.target.value }))} />
                    <Input type="datetime-local" value={newMeetingDraft.scheduledAt} onChange={(e) => setNewMeetingDraft((current) => ({ ...current, scheduledAt: e.target.value }))} />
                    <Input placeholder="Location" value={newMeetingDraft.location} onChange={(e) => setNewMeetingDraft((current) => ({ ...current, location: e.target.value }))} />
                    <Select value={newMeetingDraft.status} onValueChange={(value) => setNewMeetingDraft((current) => ({ ...current, status: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {governanceMeetingStatuses.map((status) => <SelectItem key={status} value={status}>{formatStatusLabel(status)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Textarea placeholder="Agenda outline" value={newMeetingDraft.agenda} onChange={(e) => setNewMeetingDraft((current) => ({ ...current, agenda: e.target.value }))} />
                  <Button onClick={() => createMeeting.mutate()} disabled={createMeeting.isPending || !newMeetingDraft.title.trim() || !newMeetingDraft.meetingType.trim() || !newMeetingDraft.scheduledAt}>
                    Create Meeting
                  </Button>
                </div>

                <div className="space-y-3 rounded-md border p-4">
                  <h3 className="text-sm font-medium">Update Meeting</h3>
                  <Select value={selectedMeetingId || "none"} onValueChange={(value) => setSelectedMeetingId(value === "none" ? "" : value)}>
                    <SelectTrigger><SelectValue placeholder="Select meeting" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">select meeting</SelectItem>
                      {(boardMeetings ?? []).map((meeting) => (
                        <SelectItem key={meeting.id} value={meeting.id}>{meeting.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedMeetingId ? (
                    <>
                      <Input placeholder="Meeting title" value={meetingDraft.title} onChange={(e) => setMeetingDraft((current) => ({ ...current, title: e.target.value }))} />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Input placeholder="Meeting type" value={meetingDraft.meetingType} onChange={(e) => setMeetingDraft((current) => ({ ...current, meetingType: e.target.value }))} />
                        <Input type="datetime-local" value={meetingDraft.scheduledAt} onChange={(e) => setMeetingDraft((current) => ({ ...current, scheduledAt: e.target.value }))} />
                        <Input placeholder="Location" value={meetingDraft.location} onChange={(e) => setMeetingDraft((current) => ({ ...current, location: e.target.value }))} />
                        <Select value={meetingDraft.status} onValueChange={(value) => setMeetingDraft((current) => ({ ...current, status: value }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {governanceMeetingStatuses.map((status) => <SelectItem key={status} value={status}>{formatStatusLabel(status)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Select value={meetingDraft.summaryStatus} onValueChange={(value) => setMeetingDraft((current) => ({ ...current, summaryStatus: value }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {governanceMeetingSummaryStatuses.map((status) => <SelectItem key={status} value={status}>{formatStatusLabel(status)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <Textarea placeholder="Agenda outline" value={meetingDraft.agenda} onChange={(e) => setMeetingDraft((current) => ({ ...current, agenda: e.target.value }))} />
                      <Textarea placeholder="Working notes" value={meetingDraft.notes} onChange={(e) => setMeetingDraft((current) => ({ ...current, notes: e.target.value }))} />
                      <Textarea placeholder="Summary text" value={meetingDraft.summaryText} onChange={(e) => setMeetingDraft((current) => ({ ...current, summaryText: e.target.value }))} />
                      <Button onClick={() => saveMeeting.mutate()} disabled={saveMeeting.isPending || !meetingDraft.title.trim() || !meetingDraft.meetingType.trim() || !meetingDraft.scheduledAt}>
                        Save Meeting
                      </Button>
                    </>
                  ) : (
                    <div className="text-sm text-muted-foreground">Select a meeting to edit its schedule, agenda, state, and summary.</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Governance Task Manager</h2>
                <p className="text-sm text-muted-foreground">Run the annual governance checklist directly from the board workspace.</p>
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="space-y-3 rounded-md border p-4">
                  <h3 className="text-sm font-medium">Create Governance Task</h3>
                  <Input placeholder="Task title" value={newGovernanceTaskDraft.title} onChange={(e) => setNewGovernanceTaskDraft((current) => ({ ...current, title: e.target.value }))} />
                  <Textarea placeholder="Task description" value={newGovernanceTaskDraft.description} onChange={(e) => setNewGovernanceTaskDraft((current) => ({ ...current, description: e.target.value }))} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Select value={newGovernanceTaskDraft.status} onValueChange={(value) => setNewGovernanceTaskDraft((current) => ({ ...current, status: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {governanceTaskStatuses.map((status) => <SelectItem key={status} value={status}>{formatStatusLabel(status)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input type="datetime-local" value={newGovernanceTaskDraft.dueDate} onChange={(e) => setNewGovernanceTaskDraft((current) => ({ ...current, dueDate: e.target.value }))} />
                    <Select value={newGovernanceTaskDraft.ownerPersonId || "unassigned"} onValueChange={(value) => setNewGovernanceTaskDraft((current) => ({ ...current, ownerPersonId: value === "unassigned" ? "" : value }))}>
                      <SelectTrigger><SelectValue placeholder="Assign owner" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">unassigned</SelectItem>
                        {(boardPeople ?? []).map((person) => (
                          <SelectItem key={person.id} value={person.id}>{person.firstName} {person.lastName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Textarea placeholder="Task notes" value={newGovernanceTaskDraft.notes} onChange={(e) => setNewGovernanceTaskDraft((current) => ({ ...current, notes: e.target.value }))} />
                  <Button onClick={() => createGovernanceTask.mutate()} disabled={createGovernanceTask.isPending || !newGovernanceTaskDraft.title.trim()}>
                    Create Governance Task
                  </Button>
                </div>

                <div className="space-y-3 rounded-md border p-4">
                  <h3 className="text-sm font-medium">Update Governance Task</h3>
                  <Select value={selectedGovernanceTaskId || "none"} onValueChange={(value) => setSelectedGovernanceTaskId(value === "none" ? "" : value)}>
                    <SelectTrigger><SelectValue placeholder="Select task" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">select task</SelectItem>
                      {(boardGovernanceTasks ?? []).map((task) => (
                        <SelectItem key={task.id} value={task.id}>{task.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedGovernanceTaskId ? (
                    <>
                      <Input placeholder="Task title" value={governanceTaskDraft.title} onChange={(e) => setGovernanceTaskDraft((current) => ({ ...current, title: e.target.value }))} />
                      <Textarea placeholder="Task description" value={governanceTaskDraft.description} onChange={(e) => setGovernanceTaskDraft((current) => ({ ...current, description: e.target.value }))} />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Select value={governanceTaskDraft.status} onValueChange={(value) => setGovernanceTaskDraft((current) => ({ ...current, status: value }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {governanceTaskStatuses.map((status) => <SelectItem key={status} value={status}>{formatStatusLabel(status)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Input type="datetime-local" value={governanceTaskDraft.dueDate} onChange={(e) => setGovernanceTaskDraft((current) => ({ ...current, dueDate: e.target.value }))} />
                        <Select value={governanceTaskDraft.ownerPersonId || "unassigned"} onValueChange={(value) => setGovernanceTaskDraft((current) => ({ ...current, ownerPersonId: value === "unassigned" ? "" : value }))}>
                          <SelectTrigger><SelectValue placeholder="Assign owner" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">unassigned</SelectItem>
                            {(boardPeople ?? []).map((person) => (
                              <SelectItem key={person.id} value={person.id}>{person.firstName} {person.lastName}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Textarea placeholder="Task notes" value={governanceTaskDraft.notes} onChange={(e) => setGovernanceTaskDraft((current) => ({ ...current, notes: e.target.value }))} />
                      <Button onClick={() => saveGovernanceTask.mutate()} disabled={saveGovernanceTask.isPending || !governanceTaskDraft.title.trim()}>
                        Save Governance Task
                      </Button>
                    </>
                  ) : (
                    <div className="text-sm text-muted-foreground">Select a governance task to update its owner, due date, notes, and completion state.</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Document Publisher</h2>
                <p className="text-sm text-muted-foreground">Upload board documents and control portal visibility and audience directly in the workspace.</p>
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="space-y-3 rounded-md border p-4">
                  <h3 className="text-sm font-medium">Publish New Document</h3>
                  <Input placeholder="Document title" value={newBoardDocumentDraft.title} onChange={(e) => setNewBoardDocumentDraft((current) => ({ ...current, title: e.target.value }))} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input placeholder="Document type" value={newBoardDocumentDraft.documentType} onChange={(e) => setNewBoardDocumentDraft((current) => ({ ...current, documentType: e.target.value }))} />
                    <Input type="file" onChange={(e) => setNewBoardDocumentFile(e.target.files?.[0] ?? null)} />
                    <Input placeholder="Portal audience" value={newBoardDocumentDraft.portalAudience} onChange={(e) => setNewBoardDocumentDraft((current) => ({ ...current, portalAudience: e.target.value }))} />
                    <Select value={newBoardDocumentDraft.isPortalVisible ? "visible" : "hidden"} onValueChange={(value) => setNewBoardDocumentDraft((current) => ({ ...current, isPortalVisible: value === "visible" }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="visible">portal visible</SelectItem>
                        <SelectItem value="hidden">internal only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {newBoardDocumentFile ? <div className="text-xs text-muted-foreground">File ready: {newBoardDocumentFile.name}</div> : null}
                  <Button onClick={() => createBoardDocument.mutate()} disabled={createBoardDocument.isPending || !newBoardDocumentDraft.title.trim() || !newBoardDocumentDraft.documentType.trim() || !newBoardDocumentFile}>
                    Publish Document
                  </Button>
                </div>

                <div className="space-y-3 rounded-md border p-4">
                  <h3 className="text-sm font-medium">Update Document Access</h3>
                  <Select value={selectedBoardDocumentId || "none"} onValueChange={(value) => setSelectedBoardDocumentId(value === "none" ? "" : value)}>
                    <SelectTrigger><SelectValue placeholder="Select document" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">select document</SelectItem>
                      {(boardDocuments ?? []).map((document) => (
                        <SelectItem key={document.id} value={document.id}>{document.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedBoardDocumentId ? (
                    <>
                      <Input placeholder="Document title" value={boardDocumentDraft.title} onChange={(e) => setBoardDocumentDraft((current) => ({ ...current, title: e.target.value }))} />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Input placeholder="Document type" value={boardDocumentDraft.documentType} onChange={(e) => setBoardDocumentDraft((current) => ({ ...current, documentType: e.target.value }))} />
                        <Input placeholder="Portal audience" value={boardDocumentDraft.portalAudience} onChange={(e) => setBoardDocumentDraft((current) => ({ ...current, portalAudience: e.target.value }))} />
                        <Select value={boardDocumentDraft.isPortalVisible ? "visible" : "hidden"} onValueChange={(value) => setBoardDocumentDraft((current) => ({ ...current, isPortalVisible: value === "visible" }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="visible">portal visible</SelectItem>
                            <SelectItem value="hidden">internal only</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={() => saveBoardDocument.mutate()} disabled={saveBoardDocument.isPending || !boardDocumentDraft.title.trim() || !boardDocumentDraft.documentType.trim()}>
                        Save Document Settings
                      </Button>
                    </>
                  ) : (
                    <div className="text-sm text-muted-foreground">Select a document to adjust its title, type, audience, and portal visibility.</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Board Communications</h2>
                <p className="text-sm text-muted-foreground">Compose direct notices and track association-wide send history from the board workspace.</p>
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="space-y-3 rounded-md border p-4">
                  <h3 className="text-sm font-medium">Compose Notice</h3>
                  <Input placeholder="Recipient email" value={boardNoticeDraft.recipientEmail} onChange={(e) => setBoardNoticeDraft((current) => ({ ...current, recipientEmail: e.target.value }))} />
                  <Input placeholder="Subject" value={boardNoticeDraft.subject} onChange={(e) => setBoardNoticeDraft((current) => ({ ...current, subject: e.target.value }))} />
                  <Textarea placeholder="Notice body" value={boardNoticeDraft.body} onChange={(e) => setBoardNoticeDraft((current) => ({ ...current, body: e.target.value }))} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input type="datetime-local" value={boardNoticeDraft.scheduledFor} onChange={(e) => setBoardNoticeDraft((current) => ({ ...current, scheduledFor: e.target.value }))} />
                    <Select value={boardNoticeDraft.requireApproval ? "approval" : "send"} onValueChange={(value) => setBoardNoticeDraft((current) => ({ ...current, requireApproval: value === "approval" }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="send">send directly</SelectItem>
                        <SelectItem value="approval">require approval</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={() => sendBoardNotice.mutate()} disabled={sendBoardNotice.isPending || !boardNoticeDraft.recipientEmail.trim() || !boardNoticeDraft.subject.trim() || !boardNoticeDraft.body.trim()}>
                    Queue Notice
                  </Button>
                </div>

                <div className="space-y-3 rounded-md border p-4">
                  <h3 className="text-sm font-medium">Recent Sends</h3>
                  <div className="space-y-3">
                    {(boardNoticeSends ?? []).slice(0, 8).map((send) => (
                      <div key={send.id} className="rounded-md border p-3 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium">{send.subjectRendered}</div>
                          <Badge variant={getStatusBadgeVariant(send.status)}>{formatStatusLabel(send.status)}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">{send.recipientEmail}</div>
                        <div className="text-xs text-muted-foreground">{new Date(send.sentAt).toLocaleString()}</div>
                      </div>
                    ))}
                    {(boardNoticeSends ?? []).length === 0 ? <div className="text-sm text-muted-foreground">No board notice sends yet.</div> : null}
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Communication History</h3>
                <div className="space-y-3">
                  {(boardCommunicationHistory ?? []).slice(0, 10).map((entry) => (
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

          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-lg font-semibold">Maintenance Queue</h2>
                  <p className="text-sm text-muted-foreground">State-aware maintenance view for board operators.</p>
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

          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="text-lg font-semibold">Recent Activity</h2>
              <div className="space-y-3">
                {(boardDashboard?.activity.recent ?? []).map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                    <div>
                      <div className="font-medium">{entry.entityType}</div>
                      <div className="text-sm text-muted-foreground">{entry.action} by {entry.actorEmail || "system"}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</div>
                  </div>
                ))}
                {(boardDashboard?.activity.recent ?? []).length === 0 ? (
                  <div className="text-sm text-muted-foreground">No recent board-visible activity yet.</div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Maintenance Triage</h2>
                <p className="text-sm text-muted-foreground">Move maintenance items through board-managed operating states, ownership, and resolution.</p>
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="space-y-3 rounded-md border p-4">
                  <h3 className="text-sm font-medium">Update Maintenance Request</h3>
                  <Select value={selectedMaintenanceActionId || "none"} onValueChange={(value) => setSelectedMaintenanceActionId(value === "none" ? "" : value)}>
                    <SelectTrigger><SelectValue placeholder="Select maintenance request" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">select request</SelectItem>
                      {(maintenanceRequests ?? []).map((request) => (
                        <SelectItem key={request.id} value={request.id}>{request.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedMaintenanceActionId ? (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Select value={maintenanceActionDraft.status} onValueChange={(value) => setMaintenanceActionDraft((current) => ({ ...current, status: value }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {maintenanceRequestStatuses.map((status) => <SelectItem key={status} value={status}>{formatStatusLabel(status)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Select value={maintenanceActionDraft.priority} onValueChange={(value) => setMaintenanceActionDraft((current) => ({ ...current, priority: value }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {maintenancePriorities.map((priority) => <SelectItem key={priority} value={priority}>{formatStatusLabel(priority)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Input placeholder="Assigned to" value={maintenanceActionDraft.assignedTo} onChange={(e) => setMaintenanceActionDraft((current) => ({ ...current, assignedTo: e.target.value }))} />
                      </div>
                      <Textarea placeholder="Resolution notes" value={maintenanceActionDraft.resolutionNotes} onChange={(e) => setMaintenanceActionDraft((current) => ({ ...current, resolutionNotes: e.target.value }))} />
                      <Button onClick={() => saveMaintenanceAction.mutate()} disabled={saveMaintenanceAction.isPending}>
                        Save Maintenance Action
                      </Button>
                    </>
                  ) : (
                    <div className="text-sm text-muted-foreground">Select a request to triage it, assign it, and close the loop with resolution notes.</div>
                  )}
                </div>

                <div className="space-y-3 rounded-md border p-4">
                  <h3 className="text-sm font-medium">Open Maintenance Queue</h3>
                  <div className="space-y-3">
                    {(maintenanceRequests ?? []).slice(0, 8).map((request) => (
                      <div key={request.id} className="rounded-md border p-3 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium">{request.title}</div>
                          <div className="flex gap-2 flex-wrap">
                            <Badge variant={getStatusBadgeVariant(request.status)}>{formatStatusLabel(request.status)}</Badge>
                            <Badge variant={getStatusBadgeVariant(request.priority)}>{formatStatusLabel(request.priority)}</Badge>
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">{request.locationText || "Location not specified"}</div>
                        <div className="text-xs text-muted-foreground">Assigned to {request.assignedTo || "unassigned"}</div>
                      </div>
                    ))}
                    {(maintenanceRequests ?? []).length === 0 ? <div className="text-sm text-muted-foreground">No maintenance requests available for board triage.</div> : null}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Financial Action Center</h2>
                <p className="text-sm text-muted-foreground">Review invoice state, post owner-ledger actions, and track open balance exposure directly in the board workspace.</p>
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="space-y-3 rounded-md border p-4">
                  <h3 className="text-sm font-medium">Create Vendor Invoice</h3>
                  <Input placeholder="Vendor name" value={newVendorInvoiceDraft.vendorName} onChange={(e) => setNewVendorInvoiceDraft((current) => ({ ...current, vendorName: e.target.value }))} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input placeholder="Invoice number" value={newVendorInvoiceDraft.invoiceNumber} onChange={(e) => setNewVendorInvoiceDraft((current) => ({ ...current, invoiceNumber: e.target.value }))} />
                    <Input type="datetime-local" value={newVendorInvoiceDraft.invoiceDate} onChange={(e) => setNewVendorInvoiceDraft((current) => ({ ...current, invoiceDate: e.target.value }))} />
                    <Input type="datetime-local" value={newVendorInvoiceDraft.dueDate} onChange={(e) => setNewVendorInvoiceDraft((current) => ({ ...current, dueDate: e.target.value }))} />
                    <Input placeholder="Amount" value={newVendorInvoiceDraft.amount} onChange={(e) => setNewVendorInvoiceDraft((current) => ({ ...current, amount: e.target.value }))} />
                    <Select value={newVendorInvoiceDraft.status} onValueChange={(value) => setNewVendorInvoiceDraft((current) => ({ ...current, status: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {vendorInvoiceStatuses.map((status) => <SelectItem key={status} value={status}>{formatStatusLabel(status)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Textarea placeholder="Invoice notes" value={newVendorInvoiceDraft.notes} onChange={(e) => setNewVendorInvoiceDraft((current) => ({ ...current, notes: e.target.value }))} />
                  <Button onClick={() => createVendorInvoice.mutate()} disabled={createVendorInvoice.isPending || !newVendorInvoiceDraft.vendorName.trim() || !newVendorInvoiceDraft.invoiceDate || !newVendorInvoiceDraft.amount.trim()}>
                    Create Invoice
                  </Button>
                </div>

                <div className="space-y-3 rounded-md border p-4">
                  <h3 className="text-sm font-medium">Update Vendor Invoice</h3>
                  <Select value={selectedVendorInvoiceId || "none"} onValueChange={(value) => setSelectedVendorInvoiceId(value === "none" ? "" : value)}>
                    <SelectTrigger><SelectValue placeholder="Select invoice" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">select invoice</SelectItem>
                      {(boardVendorInvoices ?? []).map((invoice) => (
                        <SelectItem key={invoice.id} value={invoice.id}>{invoice.vendorName} {invoice.invoiceNumber ? `· ${invoice.invoiceNumber}` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedVendorInvoiceId ? (
                    <>
                      <Input placeholder="Vendor name" value={vendorInvoiceDraft.vendorName} onChange={(e) => setVendorInvoiceDraft((current) => ({ ...current, vendorName: e.target.value }))} />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Input placeholder="Invoice number" value={vendorInvoiceDraft.invoiceNumber} onChange={(e) => setVendorInvoiceDraft((current) => ({ ...current, invoiceNumber: e.target.value }))} />
                        <Input type="datetime-local" value={vendorInvoiceDraft.invoiceDate} onChange={(e) => setVendorInvoiceDraft((current) => ({ ...current, invoiceDate: e.target.value }))} />
                        <Input type="datetime-local" value={vendorInvoiceDraft.dueDate} onChange={(e) => setVendorInvoiceDraft((current) => ({ ...current, dueDate: e.target.value }))} />
                        <Input placeholder="Amount" value={vendorInvoiceDraft.amount} onChange={(e) => setVendorInvoiceDraft((current) => ({ ...current, amount: e.target.value }))} />
                        <Select value={vendorInvoiceDraft.status} onValueChange={(value) => setVendorInvoiceDraft((current) => ({ ...current, status: value }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {vendorInvoiceStatuses.map((status) => <SelectItem key={status} value={status}>{formatStatusLabel(status)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <Textarea placeholder="Invoice notes" value={vendorInvoiceDraft.notes} onChange={(e) => setVendorInvoiceDraft((current) => ({ ...current, notes: e.target.value }))} />
                      <Button onClick={() => saveVendorInvoice.mutate()} disabled={saveVendorInvoice.isPending || !vendorInvoiceDraft.vendorName.trim() || !vendorInvoiceDraft.invoiceDate || !vendorInvoiceDraft.amount.trim()}>
                        Save Invoice
                      </Button>
                    </>
                  ) : (
                    <div className="text-sm text-muted-foreground">Select an invoice to move it from received to approved or paid and keep its operating record current.</div>
                  )}
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <div className="space-y-3 rounded-md border p-4">
                  <h3 className="text-sm font-medium">Post Owner Ledger Entry</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Select value={ledgerEntryDraft.personId || "none"} onValueChange={(value) => setLedgerEntryDraft((current) => ({ ...current, personId: value === "none" ? "" : value }))}>
                      <SelectTrigger><SelectValue placeholder="Select person" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">select person</SelectItem>
                        {(boardPeople ?? []).map((person) => (
                          <SelectItem key={person.id} value={person.id}>{person.firstName} {person.lastName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={ledgerEntryDraft.unitId || "none"} onValueChange={(value) => setLedgerEntryDraft((current) => ({ ...current, unitId: value === "none" ? "" : value }))}>
                      <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">select unit</SelectItem>
                        {(boardUnits ?? []).map((unit) => (
                          <SelectItem key={unit.id} value={unit.id}>{unit.unitNumber}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={ledgerEntryDraft.entryType} onValueChange={(value) => setLedgerEntryDraft((current) => ({ ...current, entryType: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ownerLedgerEntryTypes.map((entryType) => <SelectItem key={entryType} value={entryType}>{formatStatusLabel(entryType)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input placeholder="Amount" value={ledgerEntryDraft.amount} onChange={(e) => setLedgerEntryDraft((current) => ({ ...current, amount: e.target.value }))} />
                    <Input type="datetime-local" value={ledgerEntryDraft.postedAt} onChange={(e) => setLedgerEntryDraft((current) => ({ ...current, postedAt: e.target.value }))} />
                  </div>
                  <Textarea placeholder="Description" value={ledgerEntryDraft.description} onChange={(e) => setLedgerEntryDraft((current) => ({ ...current, description: e.target.value }))} />
                  <Button onClick={() => createLedgerEntry.mutate()} disabled={createLedgerEntry.isPending || !ledgerEntryDraft.personId || !ledgerEntryDraft.unitId || !ledgerEntryDraft.amount.trim() || !ledgerEntryDraft.postedAt}>
                    Post Ledger Entry
                  </Button>
                </div>

                <div className="space-y-3 rounded-md border p-4">
                  <h3 className="text-sm font-medium">Owner Balance Summary</h3>
                  <div className="space-y-3">
                    {(boardOwnerLedgerSummary ?? []).slice(0, 8).map((row) => {
                      const person = (boardPeople ?? []).find((item) => item.id === row.personId);
                      const unit = (boardUnits ?? []).find((item) => item.id === row.unitId);
                      return (
                        <div key={`${row.personId}-${row.unitId}`} className="rounded-md border p-3 space-y-1">
                          <div className="font-medium">{person ? `${person.firstName} ${person.lastName}` : row.personId}</div>
                          <div className="text-sm text-muted-foreground">Unit {unit?.unitNumber || row.unitId}</div>
                          <Badge variant={row.balance > 0 ? "destructive" : "secondary"}>${row.balance.toFixed(2)}</Badge>
                        </div>
                      );
                    })}
                    {(boardOwnerLedgerSummary ?? []).length === 0 ? <div className="text-sm text-muted-foreground">No owner ledger balances are available.</div> : null}
                  </div>
                  <div className="pt-2 space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground">Recent Ledger Entries</h4>
                    {(boardOwnerLedgerEntries ?? []).slice(0, 5).map((entry) => (
                      <div key={entry.id} className="rounded-md border p-2 text-xs">
                        <div className="font-medium">{formatStatusLabel(entry.entryType)} · ${entry.amount.toFixed(2)}</div>
                        <div className="text-muted-foreground">{entry.description || "-"}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-3">
              <h2 className="text-lg font-semibold">Association Profile</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input placeholder="Association name" value={associationDraft.name} onChange={(e) => setAssociationDraft((p) => ({ ...p, name: e.target.value }))} />
                <Input placeholder="Association type" value={associationDraft.associationType} onChange={(e) => setAssociationDraft((p) => ({ ...p, associationType: e.target.value }))} />
                <Input placeholder="Date formed" value={associationDraft.dateFormed} onChange={(e) => setAssociationDraft((p) => ({ ...p, dateFormed: e.target.value }))} />
                <Input placeholder="EIN" value={associationDraft.ein} onChange={(e) => setAssociationDraft((p) => ({ ...p, ein: e.target.value }))} />
                <Input placeholder="Address" value={associationDraft.address} onChange={(e) => setAssociationDraft((p) => ({ ...p, address: e.target.value }))} />
                <Input placeholder="City" value={associationDraft.city} onChange={(e) => setAssociationDraft((p) => ({ ...p, city: e.target.value }))} />
                <Input placeholder="State" value={associationDraft.state} onChange={(e) => setAssociationDraft((p) => ({ ...p, state: e.target.value }))} />
                <Input placeholder="Country" value={associationDraft.country} onChange={(e) => setAssociationDraft((p) => ({ ...p, country: e.target.value }))} />
              </div>
              <Button onClick={() => saveAssociation.mutate()} disabled={saveAssociation.isPending}>Save Association Profile</Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-3">
              <h2 className="text-lg font-semibold">Board Roster</h2>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role</TableHead>
                    <TableHead>Person ID</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(boardRoles ?? []).map((role) => (
                    <TableRow key={role.id}>
                      <TableCell>{role.role}</TableCell>
                      <TableCell>{role.personId}</TableCell>
                      <TableCell>{new Date(role.startDate).toLocaleDateString()}</TableCell>
                      <TableCell>{role.endDate ? new Date(role.endDate).toLocaleDateString() : "Active"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-3">
              <h2 className="text-lg font-semibold">People Editor</h2>
              <Select value={selectedPersonId || "none"} onValueChange={(value) => setSelectedPersonId(value === "none" ? "" : value)}>
                <SelectTrigger><SelectValue placeholder="Select person" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">select person</SelectItem>
                  {(boardPeople ?? []).map((person) => (
                    <SelectItem key={person.id} value={person.id}>{person.firstName} {person.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedPersonId ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input placeholder="First name" value={personDraft.firstName} onChange={(e) => setPersonDraft((p) => ({ ...p, firstName: e.target.value }))} />
                    <Input placeholder="Last name" value={personDraft.lastName} onChange={(e) => setPersonDraft((p) => ({ ...p, lastName: e.target.value }))} />
                    <Input placeholder="Email" value={personDraft.email} onChange={(e) => setPersonDraft((p) => ({ ...p, email: e.target.value }))} />
                    <Input placeholder="Phone" value={personDraft.phone} onChange={(e) => setPersonDraft((p) => ({ ...p, phone: e.target.value }))} />
                    <Input placeholder="Emergency contact name" value={personDraft.emergencyContactName} onChange={(e) => setPersonDraft((p) => ({ ...p, emergencyContactName: e.target.value }))} />
                    <Input placeholder="Emergency contact phone" value={personDraft.emergencyContactPhone} onChange={(e) => setPersonDraft((p) => ({ ...p, emergencyContactPhone: e.target.value }))} />
                    <Input placeholder="Contact preference" value={personDraft.contactPreference} onChange={(e) => setPersonDraft((p) => ({ ...p, contactPreference: e.target.value }))} />
                    <Textarea placeholder="Mailing address" value={personDraft.mailingAddress} onChange={(e) => setPersonDraft((p) => ({ ...p, mailingAddress: e.target.value }))} />
                  </div>
                  <Button onClick={() => savePerson.mutate()} disabled={savePerson.isPending}>Save Person</Button>
                </>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-3">
              <h2 className="text-lg font-semibold">Unit Editor</h2>
              <Select value={selectedUnitId || "none"} onValueChange={(value) => setSelectedUnitId(value === "none" ? "" : value)}>
                <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">select unit</SelectItem>
                  {(boardUnits ?? []).map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>{unit.unitNumber}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedUnitId ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Input placeholder="Unit number" value={unitDraft.unitNumber} onChange={(e) => setUnitDraft((p) => ({ ...p, unitNumber: e.target.value }))} />
                    <Input placeholder="Building" value={unitDraft.building} onChange={(e) => setUnitDraft((p) => ({ ...p, building: e.target.value }))} />
                    <Input placeholder="Square footage" value={unitDraft.squareFootage} onChange={(e) => setUnitDraft((p) => ({ ...p, squareFootage: e.target.value }))} />
                  </div>
                  <Button onClick={() => saveUnit.mutate()} disabled={saveUnit.isPending}>Save Unit</Button>
                </>
              ) : null}
            </CardContent>
          </Card>
        </>
      ) : null}


      {/* Documents Tab */}
      {activeTab === "documents" && (
      <Card>
        <CardContent className="p-5 space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Community Documents</h2>
            <p className="text-sm text-muted-foreground">Association documents shared with owners, including CC&Rs, bylaws, and notices.</p>
          </div>
          <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>Access</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(documents ?? []).map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>{doc.title}</TableCell>
                  <TableCell>{doc.documentType}</TableCell>
                  <TableCell><Badge variant="secondary">{doc.portalAudience}</Badge></TableCell>
                  <TableCell><a href={doc.fileUrl} className="underline text-sm" target="_blank" rel="noreferrer">Open</a></TableCell>
                </TableRow>
              ))}
              {(documents ?? []).length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">No documents available yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Notices Tab */}
      {activeTab === "notices" && (
      <Card>
        <CardContent className="p-5 space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Notices</h2>
            <p className="text-sm text-muted-foreground">Informational notices sent to your unit from management. These are one-way communications — no reply is needed.</p>
          </div>
          <div className="space-y-2">
            {(notices ?? []).filter((n) => !(n.relatedType || "").startsWith("maintenance") && !(n.relatedType || "").startsWith("work-order")).map((notice) => {
              const isPaymentNotice = (notice.relatedType || "").includes("payment") || (notice.subject || "").toLowerCase().includes("payment") || (notice.subject || "").toLowerCase().includes("due") || (notice.subject || "").toLowerCase().includes("balance");
              const isRecent = (Date.now() - new Date(notice.createdAt).getTime()) < 7 * 24 * 60 * 60 * 1000;
              const isExpanded = expandedNoticeId === notice.id;
              const snippet = stripHtml(notice.bodySnippet);
              const isHtml = (notice.bodySnippet || "").trimStart().startsWith("<");
              return (
                <div key={notice.id} className="rounded-md border overflow-hidden">
                  <button
                    className="w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedNoticeId(isExpanded ? null : notice.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{notice.subject || "—"}</span>
                          {isRecent && <Badge variant="default" className="text-xs">New</Badge>}
                          {isPaymentNotice && <Badge variant="secondary" className="text-xs">Payment</Badge>}
                        </div>
                        {!isExpanded && snippet && (
                          <div className="text-xs text-muted-foreground mt-0.5 truncate">{snippet}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground">{new Date(notice.createdAt).toLocaleDateString()}</span>
                        <span className="text-xs text-muted-foreground">{isExpanded ? "▲" : "▼"}</span>
                      </div>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="border-t">
                      {isHtml ? (
                        <iframe
                          srcDoc={notice.bodySnippet ?? ""}
                          className="w-full border-0"
                          style={{ minHeight: "400px" }}
                          onLoad={(e) => {
                            const iframe = e.currentTarget;
                            const body = iframe.contentDocument?.body;
                            if (body) iframe.style.height = `${body.scrollHeight + 32}px`;
                          }}
                          sandbox="allow-same-origin"
                          title={notice.subject ?? "Notice"}
                        />
                      ) : (
                        <div className="px-4 py-3 bg-muted/10 text-sm whitespace-pre-wrap">
                          {notice.bodySnippet || "No message body available."}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {(notices ?? []).filter((n) => !(n.relatedType || "").startsWith("maintenance") && !(n.relatedType || "").startsWith("work-order")).length === 0 && (
              <div className="rounded-md border py-8 text-center text-sm text-muted-foreground">No notices yet.</div>
            )}
          </div>
        </CardContent>
      </Card>
      )}

      {/* My Unit Tab */}
      {activeTab === "unit" && (
      <div className="space-y-6">

        {/* Section header */}
        <div>
          <h2 className="text-lg font-semibold">My {myUnits.length === 1 ? "Unit" : "Units"}</h2>
          <p className="text-sm text-muted-foreground">
            {myUnits.length === 1
              ? `Your unit at ${associationName}.`
              : `You own ${myUnits.length} units at ${associationName}.`}
          </p>
        </div>

        {/* All owned units */}
        {myUnits.map((unit) => {
          const unitLabel = [unit.building ? `Building ${unit.building}` : null, unit.unitNumber ? `Unit ${unit.unitNumber}` : null].filter(Boolean).join(", ") || "Unit";
          return (
            <Card key={unit.unitId}>
              <CardContent className="p-6 space-y-4">
                {/* Unit header with balance */}
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold text-base">{unitLabel}</div>
                    {unit.squareFootage && (
                      <div className="text-xs text-muted-foreground mt-0.5">{unit.squareFootage.toLocaleString()} sq ft</div>
                    )}
                  </div>
                  <div className={`text-right rounded-md px-3 py-2 text-sm shrink-0 ${unit.balance > 0 ? "bg-red-50 text-red-700" : unit.balance < 0 ? "bg-green-50 text-green-700" : "bg-muted/40 text-muted-foreground"}`}>
                    <div className="text-xs font-medium uppercase tracking-wide opacity-70">Balance</div>
                    <div className="font-bold">
                      {unit.balance > 0 ? `$${unit.balance.toFixed(2)} due` : unit.balance < 0 ? `Credit $${Math.abs(unit.balance).toFixed(2)}` : "$0.00"}
                    </div>
                  </div>
                </div>

                {/* Occupants */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Occupants</div>
                  {unit.occupants.length === 0 ? (
                    <div className="text-sm text-muted-foreground italic">No active occupants on record.</div>
                  ) : (
                    <div className="rounded-lg border bg-muted/20 divide-y divide-border text-sm">
                      {unit.occupants.map((o) => (
                        <div key={o.personId} className="flex items-center gap-3 px-4 py-2.5">
                          <div className="flex-1 space-y-0.5">
                            <div className="font-medium">{[o.firstName, o.lastName].filter(Boolean).join(" ") || "Unknown"}</div>
                            <div className="text-muted-foreground text-xs">{[o.email, o.phone].filter(Boolean).join(" · ") || "No contact info"}</div>
                          </div>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {o.occupancyType === "OWNER_OCCUPIED" ? "Owner Occupied" : "Tenant"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Contact info & update request — person-level, shown once */}
        <Card>
          <CardContent className="p-6 space-y-5">
            {/* Current info on file */}
            <div className="space-y-3">
              <div className="text-sm font-semibold">Contact Information on File</div>
              <div className="rounded-lg border bg-muted/20 divide-y divide-border text-sm">
                {[
                  { label: "Name", value: [(me as any)?.firstName, (me as any)?.lastName].filter(Boolean).join(" ") || null },
                  { label: "Email", value: (me as any)?.email ?? null },
                  { label: "Phone", value: (me as any)?.phone ?? null },
                  { label: "Mailing Address", value: (me as any)?.mailingAddress ?? null },
                  { label: "Emergency Contact", value: [(me as any)?.emergencyContactName, (me as any)?.emergencyContactPhone].filter(Boolean).join(" · ") || null },
                  { label: "Contact Preference", value: (me as any)?.contactPreference ?? null },
                ].map(({ label, value }) => (
                  <div key={label} className="flex gap-3 px-4 py-2.5">
                    <span className="w-36 shrink-0 text-muted-foreground">{label}</span>
                    <span className={value ? "font-medium" : "text-muted-foreground italic"}>{value ?? "Not on file"}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Contact update form */}
            <div className="space-y-3">
              <div className="text-sm font-semibold">Request Contact Update</div>
              <p className="text-xs text-muted-foreground">Edit the fields below and submit — management will review and apply approved changes.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input placeholder="Phone" value={requestedPhone} onChange={(e) => setRequestedPhone(e.target.value)} />
                <Textarea placeholder="Mailing address" value={requestedMailingAddress} onChange={(e) => setRequestedMailingAddress(e.target.value)} />
                <Input placeholder="Emergency contact name" value={requestedEmergencyContactName} onChange={(e) => setRequestedEmergencyContactName(e.target.value)} />
                <Input placeholder="Emergency contact phone" value={requestedEmergencyContactPhone} onChange={(e) => setRequestedEmergencyContactPhone(e.target.value)} />
                <Select value={requestedContactPreference || "none"} onValueChange={(v) => setRequestedContactPreference(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Contact preference" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No preference</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => submitContactUpdate.mutate()}
                disabled={
                  submitContactUpdate.isPending ||
                  (!requestedPhone.trim() && !requestedMailingAddress.trim() && !requestedEmergencyContactName.trim() && !requestedEmergencyContactPhone.trim() && !requestedContactPreference.trim())
                }
              >
                {submitContactUpdate.isPending ? "Submitting…" : "Submit Update Request"}
              </Button>
              {contactUpdateSuccess && (
                <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                  Your update request has been submitted and is pending review by management.
                </div>
              )}
              {submitContactUpdate.isError && (
                <p className="text-sm text-destructive">{(submitContactUpdate.error as Error).message}</p>
              )}
            </div>

            {/* Previous requests */}
            <div className="space-y-2">
              <div className="text-sm font-semibold">Previous Requests</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Requested Changes</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(requests ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-sm text-muted-foreground">No update requests submitted yet.</TableCell>
                    </TableRow>
                  ) : (requests ?? []).map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="max-w-[460px]">
                        <div className="text-sm space-y-0.5">
                          {Object.entries(request.requestJson as Record<string, string>).map(([key, val]) => {
                            const labels: Record<string, string> = { phone: "Phone", mailingAddress: "Mailing address", emergencyContactName: "Emergency contact name", emergencyContactPhone: "Emergency contact phone", contactPreference: "Contact preference" };
                            return (
                              <div key={key}>
                                <span className="text-muted-foreground">{labels[key] ?? key}:</span>{" "}
                                <span className="font-medium">{String(val)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={request.reviewStatus === "approved" ? "default" : request.reviewStatus === "rejected" ? "destructive" : "outline"}>
                          {request.reviewStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(request.createdAt).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
      )}

      {/* Maintenance Tab */}
      {activeTab === "maintenance" && (
      <>
      <Card>
        <CardContent className="p-6 space-y-3">
          <h2 className="text-lg font-semibold">Submit Maintenance Request</h2>
          <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
            Response targets: <strong>urgent</strong> — 4 hours, <strong>high</strong> — 12 hours, <strong>medium</strong> — 48 hours, <strong>low</strong> — 120 hours. Overdue requests escalate automatically.
          </div>
          <Input placeholder="Issue title" value={maintenanceTitle} onChange={(e) => setMaintenanceTitle(e.target.value)} />
          <Textarea placeholder="Describe the issue" value={maintenanceDescription} onChange={(e) => setMaintenanceDescription(e.target.value)} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input placeholder="Location (unit/common area)" value={maintenanceLocation} onChange={(e) => setMaintenanceLocation(e.target.value)} />
            <Select value={maintenanceCategory} onValueChange={setMaintenanceCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {maintenanceCategories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={maintenancePriority} onValueChange={setMaintenancePriority}>
              <SelectTrigger><SelectValue /></SelectTrigger>
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
              <div key={request.id} className="rounded-md border p-4 space-y-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-medium">{request.title}</div>
                    <div className="text-xs text-muted-foreground">{request.locationText || "Location not specified"} · {request.category}</div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant={getStatusBadgeVariant(request.status)}>{formatStatusLabel(request.status)}</Badge>
                    <Badge variant={request.priority === "urgent" ? "destructive" : "outline"}>{request.priority}</Badge>
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
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-3">
          <h2 className="text-lg font-semibold">Maintenance Updates</h2>
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
        </CardContent>
      </Card>
      </>
      )}

      {/* Financials Tab */}
      {activeTab === "financials" && (
      <>
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold">Financial Dashboard</h2>
              <p className="text-sm text-muted-foreground">Your outstanding balance, upcoming charges, and payment history.</p>
            </div>
            <div className={`text-2xl font-bold ${(financialDashboard?.balance ?? 0) > 0 ? "text-red-600" : "text-green-600"}`}>
              {(financialDashboard?.balance ?? 0) > 0
                ? `Amount Due: $${(financialDashboard?.balance ?? 0).toFixed(2)}`
                : (financialDashboard?.balance ?? 0) < 0
                ? `Credit: $${Math.abs(financialDashboard?.balance ?? 0).toFixed(2)}`
                : "Balance: $0.00"}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-md border p-3 text-center">
              <div className="text-xs text-muted-foreground">Total Charged</div>
              <div className="text-lg font-semibold text-red-600">${(financialDashboard?.totalCharged ?? 0).toFixed(2)}</div>
            </div>
            <div className="rounded-md border p-3 text-center">
              <div className="text-xs text-muted-foreground">Total Paid</div>
              <div className="text-lg font-semibold text-green-600">${(financialDashboard?.totalPaid ?? 0).toFixed(2)}</div>
            </div>
            <div className="rounded-md border p-3 text-center">
              <div className="text-xs text-muted-foreground">Transactions</div>
              <div className="text-lg font-semibold">{(portalLedger?.entries ?? []).length}</div>
            </div>
            <div className="rounded-md border p-3 text-center">
              <div className="text-xs text-muted-foreground">Next Charge Due</div>
              <div className="text-sm font-semibold">{financialDashboard?.nextDueDate ? new Date(financialDashboard.nextDueDate).toLocaleDateString() : "—"}</div>
            </div>
          </div>

          {(financialDashboard?.feeSchedules ?? []).length > 0 ? (
            <div className="space-y-1">
              <div className="text-sm font-medium">Recurring Charges</div>
              <div className="flex flex-wrap gap-2">
                {(financialDashboard?.feeSchedules ?? []).map((s) => (
                  <div key={s.id} className="rounded-md border px-3 py-1 text-sm">
                    <span className="font-medium">{s.name}</span>: ${s.amount.toFixed(2)} / {s.frequency}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {financialDashboard?.paymentPlan ? (
            <div className="rounded-md border bg-blue-50 p-3 space-y-1">
              <div className="text-sm font-semibold">Active Payment Plan</div>
              <div className="text-sm text-muted-foreground">
                Total: ${financialDashboard.paymentPlan.totalAmount.toFixed(2)} | Paid: ${financialDashboard.paymentPlan.amountPaid.toFixed(2)} |
                Installment: ${financialDashboard.paymentPlan.installmentAmount.toFixed(2)} {financialDashboard.paymentPlan.installmentFrequency}
                {financialDashboard.paymentPlan.nextDueDate ? ` | Next due: ${new Date(financialDashboard.paymentPlan.nextDueDate).toLocaleDateString()}` : ""}
              </div>
            </div>
          ) : null}

          {/* Payment receipt confirmation */}
          {paymentReceipt && (
            <div className="rounded-md border border-green-200 bg-green-50 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-green-700">Payment Recorded</div>
                <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setPaymentReceipt(null)}>Dismiss</button>
              </div>
              <div className="text-xs text-muted-foreground space-y-0.5">
                <div><span className="font-medium">Amount:</span> ${paymentReceipt.amount.toFixed(2)}</div>
                <div><span className="font-medium">Description:</span> {paymentReceipt.description}</div>
                <div><span className="font-medium">Date:</span> {paymentReceipt.date}</div>
                {paymentReceipt.confirmationNumber && (
                  <div><span className="font-medium">Confirmation #:</span> {paymentReceipt.confirmationNumber}</div>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Transaction History</div>
          </div>

          {false ? (
            <div className="rounded-md border p-4 space-y-3 bg-muted/30">
              <div className="text-sm font-semibold">Submit Payment</div>
              {(financialDashboard?.balance ?? 0) > 0 && (
                <div className="flex flex-wrap gap-2 pb-1">
                  <span className="text-xs text-muted-foreground self-center">Quick pay:</span>
                  {[
                    { label: "Pay Balance Due", amount: (financialDashboard?.balance ?? 0) },
                    ...(financialDashboard?.paymentPlan ? [{ label: "Pay Installment", amount: financialDashboard?.paymentPlan?.installmentAmount ?? 0 }] : []),
                  ].map(q => (
                    <Button
                      key={q.label}
                      size="sm"
                      variant="outline"
                      onClick={() => setPaymentAmount(q.amount.toFixed(2))}
                    >
                      {q.label} (${q.amount.toFixed(2)})
                    </Button>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Amount ($)</label>
                  <Input type="number" min="0.01" step="0.01" placeholder="0.00" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Description</label>
                  <Input placeholder="HOA dues payment" value={paymentDescription} onChange={(e) => setPaymentDescription(e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setPaymentFormOpen(false)}>Cancel</Button>
                <Button size="sm" onClick={() => submitPayment.mutate()} disabled={!paymentAmount || parseFloat(paymentAmount) <= 0 || submitPayment.isPending}>
                  {submitPayment.isPending ? "Processing..." : "Submit Payment"}
                </Button>
              </div>
              {submitPayment.isError ? <p className="text-xs text-red-600">{(submitPayment.error as Error)?.message}</p> : null}
            </div>
          ) : null}

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
              {(portalLedger?.entries ?? []).map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-muted-foreground text-sm">{new Date(entry.postedAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Badge variant={entry.entryType === "payment" || entry.entryType === "credit" ? "default" : entry.entryType === "late-fee" ? "destructive" : "outline"}>
                      {entry.entryType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{entry.description || "-"}</TableCell>
                  <TableCell className={`text-right font-mono text-sm ${entry.amount > 0 ? "text-red-600" : "text-green-600"}`}>
                    {entry.amount > 0 ? "+" : ""}{entry.amount.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
              {(portalLedger?.entries ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No ledger entries found for your account.</TableCell></TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Online Payments — Coming Soon */}
      <Card className="opacity-75">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">Online Payments</h2>
                <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Online payment processing, saved payment methods, and autopay enrollment will be available here once activated.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-lg border border-dashed p-4 space-y-1 bg-muted/20">
              <div className="text-sm font-medium text-muted-foreground">Payment Methods</div>
              <div className="text-xs text-muted-foreground">Save ACH, card, or other payment methods for easy payments.</div>
            </div>
            <div className="rounded-lg border border-dashed p-4 space-y-1 bg-muted/20">
              <div className="text-sm font-medium text-muted-foreground">Autopay</div>
              <div className="text-xs text-muted-foreground">Automatically pay your dues on a recurring schedule.</div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            To make a payment in the meantime, please contact your association management office directly.
          </p>
        </CardContent>
      </Card>
      </>
      )}

    </div>
  </div>
  );
}
