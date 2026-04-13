import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AnnualGovernanceTask, Association, BoardRole, CommunicationHistory, ContactUpdateRequest, Document, Election, ElectionOption, GovernanceMeeting, MaintenanceRequest, NoticeSend, OwnerLedgerEntry, Person, PortalAccess, Unit, VendorInvoice } from "@shared/schema";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MobileSectionShell } from "@/components/mobile-section-shell";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { useIsMobile } from "@/hooks/use-mobile";
import { OwnerPortalLoginContainer } from "@/components/owner-portal-login-container";
import { formatPhoneNumber, getPhoneDigits } from "@/lib/phone-formatter";

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
  // Person fields merged in by GET /api/portal/me
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  mailingAddress: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  contactPreference: string | null;
  smsOptIn: number | null;
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
};
type AssociationChoice = {
  associationId: string;
  associationName: string;
};
type PortalAssociation = {
  id: string;
  name: string;
  associationType?: string;
};
type PortalNoticeHistory = {
  id: string;
  subject: string;
  bodyText: string;
  bodySnippet?: string | null;
  createdAt: string;
};
type MyUnit = {
  unitId: string;
  building: string;
  unitNumber: string;
  balance: number;
  portalAccessId: string | null;
  squareFootage: string | null;
  occupants: Array<{
    personId: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    occupancyType: string;
  }>;
};
type UnitBalance = {
  unitId: string;
  building: string;
  unitNumber: string;
  balance: number;
};
type FinancialDashboard = {
  balance: number;
  nextDueDate?: string;
  lastPaymentDate?: string;
  totalCharges: number;
  totalPayments: number;
};

function formatStatusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/-/g, " ");
}

function getStatusBadgeVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (["resolved", "closed"].includes(status)) return "secondary";
  if (["rejected"].includes(status)) return "destructive";
  return "default";
}

function getOwnerReadableState(status: string): string {
  const stateMap: Record<string, string> = {
    submitted: "Submitted",
    triaged: "In Review",
    "in-progress": "In Progress",
    resolved: "Resolved",
    closed: "Closed",
    rejected: "Not Approved",
  };
  return stateMap[status] || formatStatusLabel(status);
}

export default function OwnerPortalPage() {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("");
  const [portalAccessId, setPortalAccessId] = useState<string | null>(() => window.localStorage.getItem("portalAccessId"));

  // Helper function for portal API calls with proper headers
  const portalFetch = (url: string, options: RequestInit = {}) => {
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        "x-portal-access-id": portalAccessId ?? "",
      },
    });
  };

  const [onboardingDismissed, setOnboardingDismissed] = useState<boolean>(() => {
    const saved = window.localStorage.getItem("portal-onboarding-dismissed");
    return saved === "true";
  });

  const [requestedPhone, setRequestedPhone] = useState("");
  const [requestedMailingAddress, setRequestedMailingAddress] = useState("");
  const [requestedEmergencyContactName, setRequestedEmergencyContactName] = useState("");
  const [requestedEmergencyContactPhone, setRequestedEmergencyContactPhone] = useState("");
  const [requestedContactPreference, setRequestedContactPreference] = useState("");
  const [smsOptInPending, setSmsOptInPending] = useState(false);
  const [pushPromptDismissed, setPushPromptDismissed] = useState(() => window.localStorage.getItem("pushPromptDismissed") === "1");
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushPending, setPushPending] = useState(false);
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
  const [activeTab, setActiveTab] = useState<"overview" | "financials" | "documents" | "maintenance" | "notices" | "communications" | "elections">("overview");
  const [overviewSubtab, setOverviewSubtab] = useState<"summary" | "owner-info" | "occupancy">("summary");
  const [ownedUnitFocusId, setOwnedUnitFocusId] = useState("");
  const [selectedElectionId, setSelectedElectionId] = useState<string | null>(null);
  const [proxyFormOpen, setProxyFormOpen] = useState(false);
  const [proxyPersonId, setProxyPersonId] = useState("");
  const [proxyNotes, setProxyNotes] = useState("");
  const [electionsSubtab, setElectionsSubtab] = useState<"active" | "upcoming" | "past" | "history">("active");
  const [nominationFormOpen, setNominationFormOpen] = useState(false);
  const [nominationBio, setNominationBio] = useState("");
  const [nominationCurrentRole, setNominationCurrentRole] = useState("");
  const [nominationStatement, setNominationStatement] = useState("");
  const [nominationPhotoUrl, setNominationPhotoUrl] = useState("");
  const [expandedNoticeId, setExpandedNoticeId] = useState<string | null>(null);
  const [expandedVersionDocId, setExpandedVersionDocId] = useState<string | null>(null);
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
  const [contactUpdateSuccess, setContactUpdateSuccess] = useState<Array<{ label: string; value: string }> | null>(null);
  const [ownerInfoEditing, setOwnerInfoEditing] = useState(false);
  const overviewContentRef = useRef<HTMLDivElement | null>(null);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [occupancyFormByUnit, setOccupancyFormByUnit] = useState<Record<string, {
    occupancyType: "OWNER_OCCUPIED" | "TENANT",
    tenantFirstName: string,
    tenantLastName: string,
    tenantEmail: string,
    tenantPhone: string,
    notes: string,
  }>>({});
  const [occupancyUpdateSuccess, setOccupancyUpdateSuccess] = useState<string | null>(null);
  const [occupancyEditing, setOccupancyEditing] = useState(false);

  const requestLogin = useMutation({
    mutationFn: async () => {
      const res = await portalFetch("/api/portal/request-login", {
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
      const res = await portalFetch("/api/portal/verify-login", {
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
      if (result.portalAccessId) {
        window.localStorage.setItem("portalAccessId", result.portalAccessId);
        setPortalAccessId(result.portalAccessId);
        setOtpStep("email");
        setOtp("");
      } else if (result.associations) {
        setAssociationChoices(result.associations);
        setOtpStep("pick");
      }
    },
  });

  const { data: me, refetch: refetchMe, error: meError, isError: isMeError } = useQuery<PortalSession | null>({
    queryKey: ["portal/me", portalAccessId],
    enabled: !!portalAccessId,
    retry: 2,
    queryFn: async () => {
      if (!portalAccessId) return null;
      const res = await portalFetch(`/api/portal/me`);
      if (!res.ok) throw new Error(`Portal session failed (${res.status})`);
      return res.json();
    },
  });

  // Register service worker for push notifications and check existing subscription
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").then(async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (existing) setPushSubscribed(true);
      } catch {
        // Non-fatal
      }
    }).catch(() => {
      // SW registration failures are non-fatal
    });
  }, []);

  const { data: myAssociations } = useQuery<AssociationChoice[]>({
    queryKey: ["portal/associations"],
    enabled: !!portalAccessId,
    queryFn: async () => {
      if (!portalAccessId) return [];
      const res = await portalFetch(`/api/portal/my-associations`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: documents } = useQuery<Document[]>({
    queryKey: ["portal/documents"],
    enabled: !!portalAccessId,
    queryFn: async () => {
      if (!portalAccessId) return [];
      const res = await portalFetch(`/api/portal/documents`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: notices } = useQuery<PortalNoticeHistory[]>({
    queryKey: ["portal/notices"],
    enabled: !!portalAccessId,
    queryFn: async () => {
      if (!portalAccessId) return [];
      const res = await portalFetch(`/api/portal/notices`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const getNoticeBodyText = (notice: PortalNoticeHistory): string =>
    notice.bodyText?.trim() || notice.bodySnippet?.trim() || "No message body available.";

  const { data: electionHistory = [] } = useQuery<Array<{
    election: { id: string; title: string; description: string | null; voteType: string; status: string; opensAt: string | null; closesAt: string | null; resultVisibility: string; isSecretBallot: number };
    participated: boolean;
    status: "voted" | "proxy-designated" | "not-voted";
    outcome: string | null;
  }>>({
    queryKey: ["portal/elections"],
    enabled: !!portalAccessId,
    queryFn: async () => {
      if (!portalAccessId) return [];
      const res = await portalFetch(`/api/portal/elections`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Active elections with pending ballot for banner
  const { data: activeElections = [] } = useQuery<Array<{
    election: { id: string; title: string; description: string | null; voteType: string; status: string; opensAt: string | null; closesAt: string | null; resultVisibility: string; isSecretBallot: number };
    token: string;
  }>>({
    queryKey: ["portal/elections/active"],
    enabled: !!portalAccessId,
    queryFn: async () => {
      if (!portalAccessId) return [];
      const res = await portalFetch(`/api/portal/elections/active`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  type ElectionDetailData = {
    election: { id: string; title: string; description: string | null; voteType: string; votingRule: string; status: string; opensAt: string | null; closesAt: string | null; nominationsOpenAt: string | null; nominationsCloseAt: string | null; resultVisibility: string; isSecretBallot: number; quorumPercent: number; maxChoices: number | null; eligibleVoterCount: number };
    options: Array<{ id: string; label: string; description: string | null; orderIndex: number }>;
    participated: boolean;
    status: "voted" | "proxy-designated" | "not-voted";
    ballotToken: string | null;
    proxyDesignation: { id: string; proxyPersonId: string; proxyName: string; designatedAt: string; notes: string | null } | null;
    tally: { eligibleCount: number; castCount: number; participationPercent: number; quorumPercent: number; quorumMet: boolean; optionTallies: Array<{ optionId: string; label: string; votes: number; percent: number }> } | null;
  };

  const { data: electionDetail, refetch: refetchElectionDetail } = useQuery<ElectionDetailData | null>({
    queryKey: ["portal/elections/detail", selectedElectionId],
    enabled: !!portalAccessId && !!selectedElectionId,
    queryFn: async () => {
      if (!portalAccessId || !selectedElectionId) return null;
      const res = await portalFetch(`/api/portal/elections/${selectedElectionId}/detail`);
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: proxyCandidates = [] } = useQuery<Array<{ personId: string; firstName: string; lastName: string }>>({
    queryKey: ["portal/elections/proxy-candidates", selectedElectionId],
    enabled: !!portalAccessId && !!selectedElectionId && proxyFormOpen,
    queryFn: async () => {
      if (!portalAccessId || !selectedElectionId) return [];
      const res = await portalFetch(`/api/portal/elections/${selectedElectionId}/proxy-candidates`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const designateProxy = useMutation({
    mutationFn: async () => {
      if (!portalAccessId || !selectedElectionId || !proxyPersonId) throw new Error("Missing data");
      const res = await portalFetch(`/api/portal/elections/${selectedElectionId}/proxy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proxyPersonId, notes: proxyNotes || null }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      setProxyFormOpen(false);
      setProxyPersonId("");
      setProxyNotes("");
      refetchElectionDetail();
      queryClient.invalidateQueries({ queryKey: ["portal/elections"] });
      queryClient.invalidateQueries({ queryKey: ["portal/elections/active"] });
    },
  });

  const revokeProxy = useMutation({
    mutationFn: async (designationId: string) => {
      if (!portalAccessId) throw new Error("Not authenticated");
      const res = await portalFetch(`/api/portal/elections/proxy/${designationId}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      refetchElectionDetail();
      queryClient.invalidateQueries({ queryKey: ["portal/elections"] });
      queryClient.invalidateQueries({ queryKey: ["portal/elections/active"] });
    },
  });

  const submitNomination = useMutation({
    mutationFn: async () => {
      if (!portalAccessId || !selectedElectionId) throw new Error("Missing data");
      const res = await portalFetch(`/api/portal/elections/${selectedElectionId}/nominate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: `${me?.firstName || ""} ${me?.lastName || ""}`.trim() || "Self-Nomination",
          bio: nominationBio || null,
          currentRole: nominationCurrentRole || null,
          nominationStatement: nominationStatement || null,
          photoUrl: nominationPhotoUrl || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      setNominationFormOpen(false);
      setNominationBio("");
      setNominationCurrentRole("");
      setNominationStatement("");
      setNominationPhotoUrl("");
      refetchElectionDetail();
      queryClient.invalidateQueries({ queryKey: ["portal/elections"] });
    },
  });

  // Categorized elections for tabs
  const activeElectionsList = useMemo(() =>
    electionHistory.filter(({ election, status }) =>
      election.status === "open" && status === "not-voted"
    ), [electionHistory]);

  const upcomingElectionsList = useMemo(() =>
    electionHistory.filter(({ election }) =>
      election.status === "draft"
    ), [electionHistory]);

  const pastElectionsList = useMemo(() =>
    electionHistory.filter(({ election }) =>
      ["closed", "certified", "cancelled"].includes(election.status)
    ), [electionHistory]);

  const { data: requests, refetch: refetchRequests } = useQuery<ContactUpdateRequest[]>({
    queryKey: ["portal/contact-requests"],
    enabled: !!portalAccessId,
    queryFn: async () => {
      if (!portalAccessId) return [];
      const res = await portalFetch(`/api/portal/contact-updates`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: maintenanceRequests, refetch: refetchMaintenanceRequests } = useQuery<MaintenanceRequest[]>({
    queryKey: ["portal/maintenance-requests"],
    enabled: !!portalAccessId,
    queryFn: async () => {
      if (!portalAccessId) return [];
      const res = await portalFetch(`/api/portal/maintenance-requests`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: portalLedger, refetch: refetchPortalLedger } = useQuery<{ entries: OwnerLedgerEntry[]; balance: number }>({
    queryKey: ["portal/ledger"],
    enabled: !!portalAccessId,
    queryFn: async () => {
      if (!portalAccessId) return { entries: [], balance: 0 };
      const res = await portalFetch(`/api/portal/ledger`);
      if (!res.ok) return { entries: [], balance: 0 };
      return res.json();
    },
  });

  const { data: portalAssociation } = useQuery<PortalAssociation>({
    queryKey: ["portal/association"],
    enabled: !!portalAccessId,
    queryFn: async () => {
      if (!portalAccessId) return null;
      const res = await portalFetch(`/api/portal/association`);
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: unitsBalance = [] } = useQuery<UnitBalance[]>({
    queryKey: ["portal/units-balance"],
    enabled: !!portalAccessId,
    queryFn: async () => {
      if (!portalAccessId) return [];
      const res = await portalFetch(`/api/portal/units-balance`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: myUnits = [], refetch: refetchMyUnits } = useQuery<MyUnit[]>({
    queryKey: ["portal/my-units"],
    enabled: !!portalAccessId,
    queryFn: async () => {
      if (!portalAccessId) return [];
      const res = await portalFetch(`/api/portal/my-units`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: financialDashboard, refetch: refetchFinancialDashboard } = useQuery<FinancialDashboard>({
    queryKey: ["portal/financial-dashboard"],
    enabled: !!portalAccessId,
    queryFn: async () => {
      if (!portalAccessId) return { balance: 0, totalCharges: 0, totalPayments: 0 };
      const res = await portalFetch(`/api/portal/financial-dashboard`);
      if (!res.ok) return { balance: 0, totalCharges: 0, totalPayments: 0 };
      return res.json();
    },
  });

  const { data: boardDashboardData } = useQuery<BoardDashboard | null>({
    queryKey: ["portal/board-dashboard"],
    enabled: !!portalAccessId,
    queryFn: async () => {
      if (!portalAccessId) return null;
      const res = await portalFetch(`/api/portal/board/dashboard`);
      if (!res.ok) return null;
      return res.json();
    },
  });

  const submitPayment = useMutation({
    mutationFn: async () => {
      if (!portalAccessId || !paymentAmount) throw new Error("Missing data");
      const res = await portalFetch("/api/portal/submit-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessId: portalAccessId,
          amount: parseFloat(paymentAmount),
          description: paymentDescription,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (result) => {
      setPaymentAmount("");
      setPaymentDescription("HOA dues payment");
      setPaymentFormOpen(false);
      refetchFinancialDashboard();
      refetchPortalLedger();
    },
  });

  const { data: savedMethods = [], refetch: refetchMethods } = useQuery<any[]>({
    queryKey: ["portal/payment-methods"],
    enabled: !!portalAccessId,
    queryFn: async () => {
      if (!portalAccessId) return [];
      const res = await portalFetch(`/api/portal/payment-methods`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const addMethod = useMutation({
    mutationFn: async () => {
      if (!portalAccessId) throw new Error("Not authenticated");
      const res = await portalFetch("/api/portal/add-payment-method", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...methodForm }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      setMethodForm({ methodType: "ach", displayName: "", last4: "", bankName: "", isDefault: false });
      setAddMethodOpen(false);
      refetchMethods();
    },
  });

  const setDefaultMethod = useMutation({
    mutationFn: async (methodId: string) => {
      if (!portalAccessId) throw new Error("Not authenticated");
      const res = await portalFetch("/api/portal/set-default-method", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ methodId }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => refetchMethods(),
  });

  const removeMethod = useMutation({
    mutationFn: async (methodId: string) => {
      if (!portalAccessId) throw new Error("Not authenticated");
      const res = await portalFetch("/api/portal/remove-payment-method", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ methodId }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => refetchMethods(),
  });

  const { data: autopayEnrollments = [], refetch: refetchAutopay } = useQuery<any[]>({
    queryKey: ["portal/autopay"],
    enabled: !!portalAccessId,
    queryFn: async () => {
      if (!portalAccessId) return [];
      const res = await portalFetch(`/api/portal/autopay`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const enrollAutopay = useMutation({
    mutationFn: async () => {
      if (!portalAccessId) throw new Error("Not authenticated");
      const res = await portalFetch("/api/portal/enroll-autopay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...autopayForm }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      setAutopayForm({ amount: "", frequency: "monthly", dayOfMonth: "1", description: "Autopay HOA dues" });
      setAutopayFormOpen(false);
      refetchAutopay();
    },
  });

  const cancelAutopay = useMutation({
    mutationFn: async (enrollmentId: string) => {
      if (!portalAccessId) throw new Error("Not authenticated");
      const res = await portalFetch("/api/portal/cancel-autopay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentId }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => refetchAutopay(),
  });

  const [boardOverview, setBoardOverview] = useState<AssociationOverview | null>(null);
  const [boardAssociation, setBoardAssociation] = useState<Association | null>(null);
  const [boardPeople, setBoardPeople] = useState<Person[]>([]);
  const [boardUnits, setBoardUnits] = useState<Unit[]>([]);
  const [boardRoles, setBoardRoles] = useState<BoardRole[]>([]);
  const [boardDashboard, setBoardDashboard] = useState<BoardDashboard | null>(null);
  const [boardMeetings, setBoardMeetings] = useState<GovernanceMeeting[]>([]);
  const [boardGovernanceTasks, setBoardGovernanceTasks] = useState<AnnualGovernanceTask[]>([]);
  const [boardDocuments, setBoardDocuments] = useState<Document[]>([]);
  const [boardNoticeSends, setBoardNoticeSends] = useState<NoticeSend[]>([]);
  const [boardCommunicationHistory, setBoardCommunicationHistory] = useState<CommunicationHistory[]>([]);
  const [boardVendorInvoices, setBoardVendorInvoices] = useState<VendorInvoice[]>([]);
  const [boardOwnerLedgerEntries, setBoardOwnerLedgerEntries] = useState<OwnerLedgerEntry[]>([]);

  const [methodForm, setMethodForm] = useState({ methodType: "ach", displayName: "", last4: "", bankName: "", isDefault: false });
  const [addMethodOpen, setAddMethodOpen] = useState(false);
  const [autopayFormOpen, setAutopayFormOpen] = useState(false);
  const [autopayForm, setAutopayForm] = useState({ amount: "", frequency: "monthly", dayOfMonth: "1", description: "Autopay HOA dues" });

  const saveOwnerInfo = useMutation({
    mutationFn: async () => {
      if (!portalAccessId) throw new Error("Not authenticated");
      const res = await portalFetch("/api/portal/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: getPhoneDigits(requestedPhone) || undefined,
          mailingAddress: requestedMailingAddress || undefined,
          emergencyContactName: requestedEmergencyContactName || undefined,
          emergencyContactPhone: getPhoneDigits(requestedEmergencyContactPhone) || undefined,
          contactPreference: requestedContactPreference || undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      setOwnerInfoEditing(false);
      const updated: Array<{ label: string; value: string }> = [];
      if (requestedPhone) updated.push({ label: "Phone Number", value: requestedPhone });
      if (requestedMailingAddress) updated.push({ label: "Mailing Address", value: requestedMailingAddress });
      if (requestedEmergencyContactName) updated.push({ label: "Emergency Contact", value: requestedEmergencyContactName });
      if (requestedEmergencyContactPhone) updated.push({ label: "Emergency Phone", value: requestedEmergencyContactPhone });
      if (requestedContactPreference) updated.push({ label: "Preferred Contact", value: requestedContactPreference.charAt(0).toUpperCase() + requestedContactPreference.slice(1) });
      setContactUpdateSuccess(updated.length > 0 ? updated : [{ label: "Profile", value: "No changes detected" }]);
      refetchMe();
      setTimeout(() => setContactUpdateSuccess(null), 6000);
    },
  });

  const subscribeToPush = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    try {
      const vapidRes = await portalFetch("/api/portal/push/vapid-public-key");
      const { configured, publicKey } = await vapidRes.json();
      if (!configured || !publicKey) return;

      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;

      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKey,
      });
      const subJson = subscription.toJSON();
      await portalFetch("/api/portal/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subJson.endpoint, keys: subJson.keys }),
      });
      setPushSubscribed(true);
      setPushPromptDismissed(true);
      window.localStorage.setItem("pushPromptDismissed", "1");
    } catch {
      // Non-fatal
    }
  };

  const dismissPushPrompt = () => {
    setPushPromptDismissed(true);
    window.localStorage.setItem("pushPromptDismissed", "1");
  };

  const unsubscribeFromPush = async () => {
    if (!("serviceWorker" in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await portalFetch("/api/portal/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
      }
      setPushSubscribed(false);
    } catch {
      // Non-fatal
    }
  };

  const togglePushNotifications = async (enable: boolean) => {
    if (!("Notification" in window) || !("PushManager" in window)) return;
    setPushPending(true);
    try {
      if (enable) {
        await subscribeToPush();
      } else {
        await unsubscribeFromPush();
      }
    } finally {
      setPushPending(false);
    }
  };

  const toggleSmsOptIn = async (value: boolean) => {
    if (!portalAccessId) return;
    setSmsOptInPending(true);
    try {
      await portalFetch("/api/portal/me/sms-opt-in", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ smsOptIn: value }),
      });
      refetchMe();
    } finally {
      setSmsOptInPending(false);
    }
  };

  const saveOccupancy = useMutation({
    mutationFn: async () => {
      if (!editingUnitId) throw new Error("No unit selected");
      const form = occupancyFormByUnit[editingUnitId];
      if (!form) throw new Error("Form data not found");
      const body: any = {
        unitId: editingUnitId,
        occupancyType: form.occupancyType,
      };
      if (form.occupancyType === "TENANT") {
        body.tenant = {
          firstName: form.tenantFirstName,
          lastName: form.tenantLastName,
          email: form.tenantEmail || undefined,
          phone: getPhoneDigits(form.tenantPhone) || undefined,
        };
      }
      const res = await portalFetch("/api/portal/occupancy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      const savedUnitId = editingUnitId;
      setEditingUnitId(null);
      setOccupancyUpdateSuccess(savedUnitId);
      setTimeout(() => setOccupancyUpdateSuccess(null), 3000);
      refetchMyUnits();
    },
  });

  const submitMaintenanceRequest = useMutation({
    mutationFn: async () => {
      if (!portalAccessId || !maintenanceTitle.trim() || !maintenanceDescription.trim()) throw new Error("Missing required fields");
      const formData = new FormData();
      formData.append("accessId", portalAccessId);
      formData.append("title", maintenanceTitle);
      formData.append("description", maintenanceDescription);
      formData.append("location", maintenanceLocation);
      formData.append("category", maintenanceCategory);
      formData.append("priority", maintenancePriority);
      maintenanceFiles.forEach((file) => formData.append("attachments", file));
      const res = await portalFetch("/api/portal/submit-maintenance-request", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      setMaintenanceTitle("");
      setMaintenanceDescription("");
      setMaintenanceLocation("");
      setMaintenanceCategory("general");
      setMaintenancePriority("medium");
      setMaintenanceFiles([]);
      setMaintenanceSuccess(true);
      setTimeout(() => setMaintenanceSuccess(false), 3000);
      refetchMaintenanceRequests();
    },
  });

  const activeAutopayEnrollment = (autopayEnrollments ?? []).find((e) => e.active);
  const totalPortfolioBalance = portalLedger?.balance ?? 0;
  const focusedOwnedUnit = myUnits.find((u) => u.unitId === ownedUnitFocusId) ?? myUnits[0];
  const openMaintenanceRequests = (maintenanceRequests ?? []).filter((r) => !["resolved", "closed", "rejected"].includes(r.status)).length;
  const focusedFinancialUnit = myUnits.find((u) => u.unitId === ownedUnitFocusId);
  const currentUnitPayableBalance = focusedFinancialUnit?.balance ?? 0;

  const handleLogout = () => {
    setPortalAccessId(null);
    window.localStorage.removeItem("portalAccessId");
  };

  useEffect(() => {
    if (!portalAccessId) return;
    window.localStorage.setItem(`portal-read-notices-${portalAccessId}`, JSON.stringify(readNoticeIds));
  }, [readNoticeIds, portalAccessId]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeTab]);

  const markNoticeAsRead = (id: string) => {
    setReadNoticeIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const downloadDocument = async (doc: { fileUrl?: string | null; title?: string | null }) => {
    if (!doc.fileUrl) return;
    try {
      const res = await portalFetch(doc.fileUrl);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.title || "document";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // silently fail — file may not exist yet
    }
  };

  const maintenanceIsUnread = (maintenanceRequests ?? []).length > 0 && !readNoticeIds.includes("__maintenance__");
  const unreadNoticesCount = (notices ?? []).filter((n) => !readNoticeIds.includes(n.id)).length + (maintenanceIsUnread ? 1 : 0);

  if (!portalAccessId) {
    return <OwnerPortalLoginContainer onLoginSuccess={(id) => {
      setPortalAccessId(id);
      window.localStorage.setItem("portalAccessId", id);
    }} />;
  }

  if (isMeError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-container-low">
        <div className="text-center max-w-md p-8">
          <h2 className="text-xl font-semibold text-on-surface mb-2">Unable to load portal</h2>
          <p className="text-sm text-on-surface-variant mb-4">{meError?.message || "An unexpected error occurred. Please try again."}</p>
          <div className="flex gap-2 justify-center">
            <button className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-semibold" onClick={() => refetchMe()}>Retry</button>
            <button className="px-4 py-2 border border-outline-variant rounded-lg text-sm font-medium text-on-surface-variant" onClick={handleLogout}>Sign Out</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-container-low min-h-screen flex flex-col">
      {/* Push Notification Opt-In Prompt */}
      {!pushPromptDismissed && !pushSubscribed && "Notification" in window && Notification.permission === "default" && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:w-96 z-50 bg-surface-bright border border-outline-variant/20 rounded-2xl shadow-xl p-4 flex gap-3 items-start">
          <div className="flex-shrink-0 h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 22 }}>notifications_active</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-on-surface mb-1">Enable push notifications</p>
            <p className="text-xs text-on-surface-variant mb-3">Get instant alerts for urgent notices, water shutoffs, and emergencies. You can turn this off at any time.</p>
            <div className="flex gap-2">
              <button
                className="px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-semibold"
                onClick={subscribeToPush}
              >
                Enable
              </button>
              <button
                className="px-4 py-2 border border-outline-variant rounded-lg text-xs font-medium text-on-surface-variant"
                onClick={dismissPushPrompt}
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fixed Header */}
      <header className="fixed top-0 right-0 left-0 md:left-64 z-50 bg-surface-bright/80 backdrop-blur-xl border-b border-outline-variant/10">
        <div className="flex justify-between items-center px-4 md:px-8 py-4">
          <div>
            <h2 className="font-headline text-2xl text-on-surface">{myAssociations?.[0]?.associationName ? `${myAssociations[0].associationName} — Owner Portal` : "Owner Portal"}</h2>
          </div>
          <div className="flex items-center gap-3 md:gap-4">
            <button className="text-on-surface-variant hover:text-primary">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-secondary-container flex-shrink-0 flex items-center justify-center">
                <span className="material-symbols-outlined text-sm">person</span>
              </div>
              <div className="text-right min-w-0 hidden sm:block">
                <p className="text-xs font-bold text-on-surface truncate">{me?.email || "Owner"}</p>
                <p className="text-[10px] text-on-surface-variant capitalize truncate">{me?.role || ""}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-64 border-r border-outline-variant/15 bg-surface flex-col py-8 px-4 z-40">
        <div className="mb-10 px-4">
          <h1 className="text-2xl font-semibold tracking-tight text-primary font-serif italic">Your Condo Manager</h1>
          <p className="text-[10px] text-on-surface-variant/60 italic mt-0.5">Community management, elevated.</p>
        </div>
        <nav className="flex-1 space-y-2">
          <button onClick={() => setActiveTab("overview")} className={`w-full text-left rounded-lg px-4 py-3 font-bold flex items-center gap-3 transition-colors ${activeTab === "overview" ? "bg-surface-container-highest text-primary" : "text-on-surface-variant hover:text-primary"}`}>
            <span className="material-symbols-outlined">dashboard</span>
            <span className="font-label uppercase tracking-widest text-[11px]">Overview</span>
          </button>
          <button onClick={() => setActiveTab("financials")} className={`w-full text-left rounded-lg px-4 py-3 font-bold flex items-center gap-3 transition-colors ${activeTab === "financials" ? "bg-surface-container-highest text-primary" : "text-on-surface-variant hover:text-primary"}`}>
            <span className="material-symbols-outlined">payments</span>
            <span className="font-label uppercase tracking-widest text-[11px]">Financials</span>
          </button>
          <button onClick={() => setActiveTab("documents")} className={`w-full text-left rounded-lg px-4 py-3 font-bold flex items-center gap-3 transition-colors ${activeTab === "documents" ? "bg-surface-container-highest text-primary" : "text-on-surface-variant hover:text-primary"}`}>
            <span className="material-symbols-outlined">description</span>
            <span className="font-label uppercase tracking-widest text-[11px]">Documents</span>
          </button>
          <button onClick={() => setActiveTab("maintenance")} className={`w-full text-left rounded-lg px-4 py-3 font-bold flex items-center gap-3 transition-colors ${activeTab === "maintenance" ? "bg-surface-container-highest text-primary" : "text-on-surface-variant hover:text-primary"}`}>
            <span className="material-symbols-outlined">build</span>
            <span className="font-label uppercase tracking-widest text-[11px]">Maintenance</span>
            {openMaintenanceRequests > 0 && <span className="ml-auto text-xs bg-destructive text-on-error px-2 py-0.5 rounded-full">{openMaintenanceRequests}</span>}
          </button>
          <button onClick={() => setActiveTab("notices")} className={`w-full text-left rounded-lg px-4 py-3 font-bold flex items-center gap-3 transition-colors ${activeTab === "notices" ? "bg-surface-container-highest text-primary" : "text-on-surface-variant hover:text-primary"}`}>
            <span className="material-symbols-outlined">notifications</span>
            <span className="font-label uppercase tracking-widest text-[11px]">Notices</span>
            {unreadNoticesCount > 0 && <span className="ml-auto text-xs bg-primary text-on-primary px-2 py-0.5 rounded-full">{unreadNoticesCount}</span>}
          </button>
          <button onClick={() => setActiveTab("communications")} className={`w-full text-left rounded-lg px-4 py-3 font-bold flex items-center gap-3 transition-colors ${activeTab === "communications" ? "bg-surface-container-highest text-primary" : "text-on-surface-variant hover:text-primary"}`}>
            <span className="material-symbols-outlined">mail</span>
            <span className="font-label uppercase tracking-widest text-[11px]">Communications</span>
          </button>
          <button onClick={() => setActiveTab("elections")} className={`w-full text-left rounded-lg px-4 py-3 font-bold flex items-center gap-3 transition-colors ${activeTab === "elections" ? "bg-surface-container-highest text-primary" : "text-on-surface-variant hover:text-primary"}`}>
            <span className="material-symbols-outlined">how_to_vote</span>
            <span className="font-label uppercase tracking-widest text-[11px]">Voting</span>
            {activeElections.length > 0 && <span className="ml-auto text-xs bg-primary text-on-primary px-2 py-0.5 rounded-full">{activeElections.length}</span>}
          </button>
          {me?.associationId && (
            <a href={`/community/${me.associationId}`} target="_blank" rel="noopener noreferrer" className="w-full text-left rounded-lg px-4 py-3 font-bold flex items-center gap-3 transition-colors text-on-surface-variant hover:text-primary">
              <span className="material-symbols-outlined">language</span>
              <span className="font-label uppercase tracking-widest text-[11px]">Community Hub</span>
            </a>
          )}
        </nav>
        <div className="mt-auto pt-6 border-t border-outline-variant/10 space-y-2">
          <button className="w-full bg-primary text-on-primary rounded-lg py-3 px-4 text-xs font-bold uppercase">Support</button>
          <button onClick={handleLogout} className="w-full text-center text-on-surface-variant text-[11px] uppercase tracking-widest hover:text-primary py-2 px-4 rounded-lg hover:bg-surface-container transition-colors">Logout</button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="md:ml-64 pt-20 pb-20 px-4 md:px-8 flex-1">
        <div className="max-w-7xl mx-auto">

          {/* OVERVIEW TAB */}
          {activeTab === "overview" && (
            <>
              <section className="mb-12">
                <p className="font-label text-primary uppercase tracking-widest text-[11px] mb-2">{myAssociations?.[0]?.associationName || ""}</p>
                <h1 className="font-headline text-4xl md:text-5xl text-on-surface mb-4">{me?.firstName ? `Welcome, ${me.firstName}` : "Owner Portal"}</h1>
                <div className="flex flex-wrap gap-4 mt-8">
                  <div className="bg-surface-container-lowest p-6 rounded-xl flex-1 min-w-[280px] border border-outline-variant/10">
                    {myUnits.length === 1 ? (
                      <>
                        <p className="font-label text-on-surface-variant uppercase tracking-widest text-[10px] mb-1">Your Unit</p>
                        <span className="font-headline text-3xl">
                          {[myUnits[0].building && `Bldg ${myUnits[0].building}`, myUnits[0].unitNumber && `Unit ${myUnits[0].unitNumber}`].filter(Boolean).join(" · ") || "Unit"}
                        </span>
                      </>
                    ) : (
                      <>
                        <p className="font-label text-on-surface-variant uppercase tracking-widest text-[10px] mb-1">Total Units</p>
                        <span className="font-headline text-3xl">{myUnits.length}</span>
                      </>
                    )}
                  </div>
                  <div className="bg-surface-container-lowest p-6 rounded-xl flex-1 min-w-[280px] border border-outline-variant/10">
                    <p className="font-label text-on-surface-variant uppercase tracking-widest text-[10px] mb-1">Account Balance</p>
                    <span className={`font-headline text-3xl ${totalPortfolioBalance > 0 ? 'text-destructive' : 'text-secondary'}`}>
                      ${Math.abs(totalPortfolioBalance).toFixed(2)}
                    </span>
                  </div>
                  <div className="bg-surface-container-lowest p-6 rounded-xl flex-1 min-w-[280px] border border-outline-variant/10">
                    <p className="font-label text-on-surface-variant uppercase tracking-widest text-[10px] mb-1">Open Maintenance</p>
                    <span className="font-headline text-3xl">{openMaintenanceRequests}</span>
                  </div>
                </div>
              </section>

              {/* Active Election Banner */}
              {activeElections.length > 0 && (
                <section className="mb-8 space-y-3">
                  {activeElections.map(({ election, token }) => (
                    <div key={election.id} className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-5 flex items-center gap-4">
                      <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary" style={{ fontSize: 24 }}>how_to_vote</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-on-surface">{election.title}</p>
                        <p className="text-xs text-on-surface-variant mt-0.5">
                          {election.closesAt ? `Voting closes ${new Date(election.closesAt).toLocaleDateString()}` : "Open for voting"}
                          {" "}&middot; {election.voteType.replace(/-/g, " ")}
                        </p>
                      </div>
                      <a
                        href={`/vote/${token}`}
                        className="shrink-0 px-5 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-primary/90 transition-colors"
                      >
                        Vote Now
                      </a>
                    </div>
                  ))}
                </section>
              )}

              {/* Overview Subtabs */}
              <div className="space-y-6">
                <div className="flex gap-2 border-b border-outline-variant/10">
                  <button onClick={() => setOverviewSubtab("summary")} className={`px-4 py-3 font-bold text-sm transition-colors ${overviewSubtab === "summary" ? "text-primary border-b-2 border-primary" : "text-on-surface-variant hover:text-primary"}`}>Summary</button>
                  <button onClick={() => setOverviewSubtab("owner-info")} className={`px-4 py-3 font-bold text-sm transition-colors ${overviewSubtab === "owner-info" ? "text-primary border-b-2 border-primary" : "text-on-surface-variant hover:text-primary"}`}>Owner Info</button>
                  <button onClick={() => setOverviewSubtab("occupancy")} className={`px-4 py-3 font-bold text-sm transition-colors ${overviewSubtab === "occupancy" ? "text-primary border-b-2 border-primary" : "text-on-surface-variant hover:text-primary"}`}>Occupancy</button>
                </div>

                {/* Summary Subtab */}
                {overviewSubtab === "summary" && (() => {
                  const openRequests = (maintenanceRequests ?? []).filter((r) => !["resolved", "closed", "rejected"].includes(r.status));
                  const inProgress = openRequests.filter((r) => r.status === "in-progress").length;
                  const underReview = openRequests.filter((r) => r.status === "triaged").length;
                  const submitted = openRequests.filter((r) => r.status === "submitted").length;
                  const maintenanceSummaryParts = [
                    inProgress > 0 && `${inProgress} in progress`,
                    underReview > 0 && `${underReview} under review`,
                    submitted > 0 && `${submitted} awaiting response`,
                  ].filter(Boolean).join(", ");

                  return (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Notices — left */}
                      <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/10 space-y-3">
                        <h3 className="font-headline text-lg">Notices</h3>

                        {/* Aggregated maintenance notice with timeline */}
                        {(maintenanceRequests ?? []).length > 0 && (() => {
                          const allReqs = maintenanceRequests ?? [];
                          const isMxExpanded = expandedNoticeId === "__maintenance__";
                          const maintenanceRead = readNoticeIds.includes("__maintenance__");
                          const openCount = openRequests.length;
                          const statusCfg: Record<string, { label: string; dotColor: string; icon: string }> = {
                            submitted:     { label: "Submitted",    dotColor: "bg-primary",         icon: "schedule" },
                            triaged:       { label: "Under Review", dotColor: "bg-tertiary",        icon: "search" },
                            "in-progress": { label: "In Progress",  dotColor: "bg-secondary",       icon: "construction" },
                            resolved:      { label: "Resolved",     dotColor: "bg-green-500",       icon: "check_circle" },
                            closed:        { label: "Closed",       dotColor: "bg-outline-variant", icon: "lock" },
                            rejected:      { label: "Not Approved", dotColor: "bg-destructive",           icon: "cancel" },
                          };
                          return (
                            <div className={`rounded-xl border overflow-hidden ${maintenanceRead ? "bg-surface border-outline-variant/10" : "bg-surface-container border-primary/20 shadow-sm"}`}>
                              <div
                                className="flex items-start gap-3 p-3 cursor-pointer hover:bg-surface-container-low transition-colors"
                                onClick={() => {
                                  if (!isMxExpanded) markNoticeAsRead("__maintenance__");
                                  setExpandedNoticeId(isMxExpanded ? null : "__maintenance__");
                                }}
                              >
                                <div className="mt-0.5 w-8 h-8 rounded-lg bg-tertiary-container flex-shrink-0 flex items-center justify-center">
                                  <span className="material-symbols-outlined text-tertiary" style={{ fontSize: 16 }}>build</span>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className={`font-medium text-sm ${maintenanceRead ? "text-on-surface" : "text-primary"}`}>Maintenance Updates</p>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <span className={`block w-2 h-2 rounded-full ${!maintenanceRead ? "bg-primary" : "bg-outline-variant/30"}`} />
                                      {openCount > 0 && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">{openCount} open</span>}
                                      <span className={`material-symbols-outlined text-sm text-on-surface-variant transition-transform ${isMxExpanded ? "rotate-180" : ""}`}>expand_more</span>
                                    </div>
                                  </div>
                                  {!isMxExpanded && (
                                    <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-1">
                                      {allReqs.slice(0, 2).map((r) => r.title).join(" · ")}{allReqs.length > 2 ? ` · +${allReqs.length - 2} more` : ""}
                                    </p>
                                  )}
                                </div>
                              </div>
                              {isMxExpanded && (
                                <div className="border-t border-outline-variant/10 divide-y divide-outline-variant/10">
                                  {allReqs.map((req) => {
                                    const cfg = statusCfg[req.status] ?? statusCfg.submitted;
                                    type Step = { label: string; date: string | null; done: boolean; active: boolean };
                                    const steps: Step[] = [
                                      { label: "Submitted",    date: req.createdAt,                        done: true,  active: req.status === "submitted" },
                                      { label: "Under Review", date: (req as any).triagedAt ?? null,       done: ["triaged","in-progress","resolved","closed"].includes(req.status), active: req.status === "triaged" },
                                      { label: "In Progress",  date: null,                                 done: ["in-progress","resolved","closed"].includes(req.status), active: req.status === "in-progress" },
                                      { label: "Resolved",     date: (req as any).resolvedAt ?? (req as any).closedAt ?? null, done: ["resolved","closed","rejected"].includes(req.status), active: ["resolved","closed","rejected"].includes(req.status) },
                                    ];
                                    return (
                                      <div key={req.id} className="px-3 py-4">
                                        <div className="flex items-start justify-between gap-2 mb-4">
                                          <div className="min-w-0">
                                            <p className="font-medium text-sm text-on-surface">{req.title}</p>
                                            {req.locationText && (
                                              <p className="text-xs text-on-surface-variant mt-0.5 flex items-center gap-0.5">
                                                <span className="material-symbols-outlined" style={{ fontSize: 11 }}>location_on</span>
                                                {req.locationText}
                                              </p>
                                            )}
                                          </div>
                                          <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full text-white ${cfg.dotColor}`}>
                                            <span className="material-symbols-outlined" style={{ fontSize: 11 }}>{cfg.icon}</span>
                                            {cfg.label}
                                          </span>
                                        </div>
                                        <div className="flex items-start">
                                          {steps.map((step, i) => (
                                            <div key={step.label} className="flex-1 flex flex-col items-center relative">
                                              {i < steps.length - 1 && (
                                                <div className={`absolute top-2 left-1/2 w-full h-0.5 ${step.done ? "bg-primary/40" : "bg-outline-variant/20"}`} />
                                              )}
                                              <div className={`relative z-10 w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-surface ${
                                                step.active ? "bg-primary" : step.done ? "bg-primary/50" : "bg-surface-container border border-outline-variant/30"
                                              }`}>
                                                {step.done && <span className="material-symbols-outlined text-white" style={{ fontSize: 10 }}>check</span>}
                                              </div>
                                              <p className={`text-[9px] font-medium mt-1 text-center leading-tight ${step.active ? "text-primary" : step.done ? "text-on-surface-variant" : "text-outline-variant"}`}>
                                                {step.label}
                                              </p>
                                              {step.date && (
                                                <p className="text-[8px] text-on-surface-variant/60 text-center">
                                                  {new Date(step.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                                                </p>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                        {req.resolutionNotes && (
                                          <div className="mt-3 bg-surface-container-low rounded-lg p-2.5">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Resolution Notes</p>
                                            <p className="text-xs text-on-surface">{req.resolutionNotes}</p>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Community notices */}
                        {(notices ?? []).length > 0 ? (
                          (notices ?? []).slice(0, 5).map((notice) => {
                            const isRead = readNoticeIds.includes(notice.id);
                            const isExpanded = expandedNoticeId === notice.id;
                            return (
                              <div
                                key={notice.id}
                                className={`rounded-xl border transition-all cursor-pointer ${isRead ? "bg-surface border-outline-variant/10" : "bg-surface border-primary/20"}`}
                                onClick={() => {
                                  setExpandedNoticeId(isExpanded ? null : notice.id);
                                  markNoticeAsRead(notice.id);
                                }}
                              >
                                <div className="flex items-start gap-3 p-3">
                                  <div className="mt-1.5 flex-shrink-0">
                                    <span className={`block w-2 h-2 rounded-full ${!isRead ? "bg-primary" : "bg-outline-variant/30"}`} />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex justify-between items-start gap-2">
                                      <p className={`text-sm font-medium leading-snug ${!isRead ? "text-on-surface" : "text-on-surface-variant"}`}>
                                        {notice.subject}
                                      </p>
                                      <span className={`material-symbols-outlined text-sm text-on-surface-variant flex-shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}>expand_more</span>
                                    </div>
                                    <p className="text-xs text-on-surface-variant mt-0.5">{new Date(notice.createdAt).toLocaleDateString()}</p>
                                    {!isExpanded && (
                                      <p className="text-xs text-on-surface-variant mt-1 line-clamp-1">{getNoticeBodyText(notice)}</p>
                                    )}
                                  </div>
                                </div>
                                {isExpanded && (
                                  <div className="border-t border-outline-variant/10 rounded-b-xl px-4 py-3">
                                    <p className="whitespace-pre-line break-words text-sm leading-6 text-on-surface">
                                      {getNoticeBodyText(notice)}
                                    </p>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        ) : openRequests.length === 0 ? (
                          <div className="text-center py-8 space-y-1">
                            <span className="material-symbols-outlined text-3xl text-on-surface-variant/40">notifications_off</span>
                            <p className="text-sm text-on-surface-variant">No notices</p>
                          </div>
                        ) : null}

                        {(notices ?? []).length > 5 && (
                          <button
                            className="w-full text-xs text-primary font-medium pt-1 hover:underline"
                            onClick={() => setActiveTab("notices")}
                          >
                            View all notices →
                          </button>
                        )}
                      </div>

                      {/* Recent Activity — right */}
                      <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/10">
                        <h3 className="font-headline text-lg mb-4">Recent Activity</h3>
                        <div className="space-y-3">
                          {(portalLedger?.entries ?? []).slice(0, 5).length > 0 ? (
                            (portalLedger?.entries ?? []).slice(0, 5).map((entry) => (
                              <div key={entry.id} className="flex justify-between items-center p-3 bg-surface rounded-lg border border-outline-variant/10">
                                <div>
                                  <p className="font-medium text-sm">{entry.description}</p>
                                  <p className="text-xs text-on-surface-variant">{new Date(entry.createdAt).toLocaleDateString()}</p>
                                </div>
                                <p className={`font-bold text-sm ${entry.entryType === "payment" ? "text-secondary" : "text-destructive"}`}>
                                  {entry.entryType === "payment" ? "−" : "+"} ${Math.abs(entry.amount).toFixed(2)}
                                </p>
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-8 space-y-1">
                              <span className="material-symbols-outlined text-3xl text-on-surface-variant/40">receipt_long</span>
                              <p className="text-sm text-on-surface-variant">No recent activity</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Owner Info Subtab */}
                {overviewSubtab === "owner-info" && (
                  <div className="space-y-6">
                    {/* Editorial header */}
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                      <div>
                        <h2 className="font-headline text-3xl text-on-surface mb-1">Owner Profile</h2>
                        <p className="text-on-surface-variant text-sm max-w-md">Manage your personal information, communication preferences, and emergency contacts.</p>
                      </div>
                      <div className="flex gap-3 shrink-0">
                        <button
                          className="px-5 py-2.5 text-primary font-semibold hover:bg-surface-container transition-all rounded-lg text-sm"
                          onClick={() => {
                            setRequestedPhone("");
                            setRequestedMailingAddress("");
                            setRequestedEmergencyContactName("");
                            setRequestedEmergencyContactPhone("");
                            setRequestedContactPreference("");
                          }}
                        >
                          Discard Changes
                        </button>
                        <button
                          className="px-6 py-2.5 bg-primary text-on-primary font-semibold rounded-lg text-sm flex items-center gap-2 transition-transform active:scale-95 disabled:opacity-50"
                          onClick={() => saveOwnerInfo.mutate()}
                          disabled={saveOwnerInfo.isPending}
                        >
                          {saveOwnerInfo.isPending ? "Saving…" : "Save Profile"}
                          {!saveOwnerInfo.isPending && <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>}
                        </button>
                      </div>
                    </div>

                    {saveOwnerInfo.error && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-red-800">
                        <span className="material-symbols-outlined text-red-500" style={{ fontSize: 18 }}>error</span>
                        <span className="text-sm font-medium">Failed to save: {(saveOwnerInfo.error as Error).message}</span>
                      </div>
                    )}

                    {contactUpdateSuccess && (
                      <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex gap-4 items-start">
                        <div className="flex-shrink-0 h-9 w-9 rounded-full bg-green-100 flex items-center justify-center">
                          <span className="material-symbols-outlined text-green-700" style={{ fontSize: 20 }}>check_circle</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-green-800 mb-2">Profile saved successfully</p>
                          <div className="flex flex-wrap gap-2">
                            {contactUpdateSuccess.map(({ label, value }) => (
                              <span key={label} className="inline-flex items-center gap-1.5 bg-white border border-green-200 text-green-800 px-3 py-1 rounded-full text-xs font-medium">
                                <span className="text-green-500 font-bold">✓</span>
                                {label}: <span className="font-semibold truncate max-w-[120px]">{value}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                        <button
                          className="flex-shrink-0 text-green-600 hover:text-green-800 transition-colors"
                          onClick={() => setContactUpdateSuccess(null)}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
                        </button>
                      </div>
                    )}

                    {/* Bento grid */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                      {/* Left column */}
                      <div className="md:col-span-8 space-y-6">
                        {/* Profile Information */}
                        <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm">
                          <h3 className="font-headline text-xl mb-5 text-on-surface">Profile Information</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                            <div className="space-y-1.5">
                              <label className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">First Name</label>
                              <input
                                className="w-full bg-surface-container border-none rounded-lg focus:ring-2 focus:ring-primary p-3 outline-none transition-all text-on-surface opacity-60 cursor-not-allowed"
                                type="text"
                                value={me?.firstName || ""}
                                disabled
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Last Name</label>
                              <input
                                className="w-full bg-surface-container border-none rounded-lg focus:ring-2 focus:ring-primary p-3 outline-none transition-all text-on-surface opacity-60 cursor-not-allowed"
                                type="text"
                                value={me?.lastName || ""}
                                disabled
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Email Address</label>
                              <input
                                className="w-full bg-surface-container border-none rounded-lg focus:ring-2 focus:ring-primary p-3 outline-none transition-all text-on-surface opacity-60 cursor-not-allowed"
                                type="email"
                                value={me?.email || ""}
                                disabled
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Phone Number</label>
                              <input
                                className="w-full bg-surface-container border-none rounded-lg focus:ring-2 focus:ring-primary p-3 outline-none transition-all text-on-surface placeholder:text-on-surface-variant/50"
                                type="tel"
                                value={requestedPhone || formatPhoneNumber(me?.phone || "")}
                                onChange={(e) => setRequestedPhone(formatPhoneNumber(e.target.value))}
                                placeholder="(XXX) XXX-XXXX"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Mailing Address */}
                        <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm overflow-hidden relative">
                          <div className="absolute top-0 right-0 w-28 h-28 bg-primary/5 rounded-full -mr-14 -mt-14 pointer-events-none" />
                          <h3 className="font-headline text-xl mb-5 text-on-surface">Mailing Address</h3>
                          <div className="space-y-1.5">
                            <label className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Street Address</label>
                            <input
                              className="w-full bg-surface-container border-none rounded-lg focus:ring-2 focus:ring-primary p-3 outline-none transition-all text-on-surface placeholder:text-on-surface-variant/50"
                              type="text"
                              value={requestedMailingAddress || me?.mailingAddress || ""}
                              onChange={(e) => setRequestedMailingAddress(e.target.value)}
                              placeholder="Enter mailing address"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Right column */}
                      <div className="md:col-span-4 space-y-6">
                        {/* Preferred Contact */}
                        <div className="bg-surface-container-lowest rounded-xl p-6 border border-outline-variant/10 shadow-sm">
                          <h3 className="font-headline text-xl mb-5 text-on-surface">Preferred Contact</h3>
                          <div className="space-y-3">
                            {([
                              { value: "email", icon: "mail", label: "Email Communication" },
                              { value: "phone", icon: "call", label: "Phone Calls" },
                              { value: "sms", icon: "sms", label: "Text Messaging" },
                            ] as const).map(({ value, icon, label }) => {
                              const current = requestedContactPreference || me?.contactPreference || "email";
                              return (
                                <label key={value} className="flex items-center p-3 rounded-lg bg-surface-container-low cursor-pointer hover:bg-primary-fixed/60 transition-all group">
                                  <input
                                    type="radio"
                                    name="contact_pref"
                                    className="text-primary focus:ring-primary h-4 w-4 accent-primary"
                                    checked={current === value}
                                    onChange={() => setRequestedContactPreference(value)}
                                  />
                                  <div className="ml-3 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary" style={{ fontSize: 20 }}>{icon}</span>
                                    <span className="font-medium text-sm">{label}</span>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        {/* SMS Opt-In */}
                        <div className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/10 shadow-sm">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="material-symbols-outlined text-primary">sms</span>
                            <h3 className="font-headline text-xl text-on-surface">SMS Text Notifications</h3>
                          </div>
                          <p className="text-sm text-on-surface-variant mb-4">Receive time-sensitive alerts — like water shutoffs, emergency repairs, and parking notices — by text message. You can opt out at any time by replying STOP.</p>
                          <label className="flex items-center gap-3 cursor-pointer select-none">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={Boolean(me?.smsOptIn)}
                              disabled={smsOptInPending}
                              onClick={() => toggleSmsOptIn(!me?.smsOptIn)}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${me?.smsOptIn ? "bg-primary" : "bg-outline"} disabled:opacity-50`}
                            >
                              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${me?.smsOptIn ? "translate-x-6" : "translate-x-1"}`} />
                            </button>
                            <span className="text-sm font-medium text-on-surface">
                              {me?.smsOptIn ? "SMS notifications enabled" : "SMS notifications disabled"}
                            </span>
                          </label>
                        </div>

                        {/* Push Notifications */}
                        <div className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/10 shadow-sm">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="material-symbols-outlined text-primary">notifications_active</span>
                            <h3 className="font-headline text-xl text-on-surface">Push Notifications</h3>
                          </div>
                          {!("Notification" in window) || !("PushManager" in window) ? (
                            <p className="text-sm text-on-surface-variant">Push notifications are not supported by your browser.</p>
                          ) : Notification.permission === "denied" ? (
                            <p className="text-sm text-on-surface-variant">Push notifications are blocked by your browser. To enable them, update your browser site settings and reload this page.</p>
                          ) : (
                            <>
                              <p className="text-sm text-on-surface-variant mb-4">Receive instant browser alerts for urgent notices, emergencies, and community updates — even when you're not actively viewing this page.</p>
                              <label className="flex items-center gap-3 cursor-pointer select-none">
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={pushSubscribed}
                                  disabled={pushPending}
                                  onClick={() => togglePushNotifications(!pushSubscribed)}
                                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${pushSubscribed ? "bg-primary" : "bg-outline"} disabled:opacity-50`}
                                >
                                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${pushSubscribed ? "translate-x-6" : "translate-x-1"}`} />
                                </button>
                                <span className="text-sm font-medium text-on-surface">
                                  {pushSubscribed ? "Push notifications enabled" : "Push notifications disabled"}
                                </span>
                              </label>
                            </>
                          )}
                        </div>

                        {/* Emergency Contact */}
                        <div className="bg-tertiary-fixed rounded-xl p-6 border border-tertiary/10 shadow-sm">
                          <div className="flex items-center gap-2 mb-5">
                            <span className="material-symbols-outlined text-tertiary">emergency</span>
                            <h3 className="font-headline text-xl text-on-surface">Emergency Contact</h3>
                          </div>
                          <div className="space-y-4">
                            <div className="space-y-1.5">
                              <label className="block text-[11px] font-bold uppercase tracking-widest text-on-tertiary-fixed-variant opacity-70">Contact Name</label>
                              <input
                                className="w-full bg-white/50 border-none rounded-lg focus:ring-2 focus:ring-tertiary p-3 outline-none transition-all placeholder:text-on-surface-variant/50"
                                type="text"
                                value={requestedEmergencyContactName || me?.emergencyContactName || ""}
                                onChange={(e) => setRequestedEmergencyContactName(e.target.value)}
                                placeholder="Contact name"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="block text-[11px] font-bold uppercase tracking-widest text-on-tertiary-fixed-variant opacity-70">Emergency Phone</label>
                              <input
                                className="w-full bg-white/50 border-none rounded-lg focus:ring-2 focus:ring-tertiary p-3 outline-none transition-all placeholder:text-on-surface-variant/50"
                                type="tel"
                                value={requestedEmergencyContactPhone || formatPhoneNumber(me?.emergencyContactPhone || "")}
                                onChange={(e) => setRequestedEmergencyContactPhone(formatPhoneNumber(e.target.value))}
                                placeholder="(XXX) XXX-XXXX"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom bento: Security + Portfolio */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-secondary-container p-6 rounded-xl flex flex-col justify-between min-h-[160px]">
                        <span className="material-symbols-outlined text-primary" style={{ fontSize: 32 }}>family_restroom</span>
                        <div>
                          <h3 className="font-headline text-lg text-on-secondary-container mb-1">Occupancy</h3>
                          <p className="text-sm text-on-secondary-container/80">Update who is currently living in your unit — owner-occupied or tenant.</p>
                        </div>
                        <button
                          className="mt-3 text-sm font-bold uppercase tracking-widest text-primary hover:underline self-start"
                          onClick={() => setOverviewSubtab("occupancy")}
                        >
                          Update Occupancy
                        </button>
                      </div>
                      <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm md:col-span-2 flex items-center gap-6 border border-outline-variant/5">
                        <div className="hidden sm:flex h-14 w-14 rounded-xl bg-primary/10 items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-primary" style={{ fontSize: 28 }}>apartment</span>
                        </div>
                        <div>
                          <h3 className="font-headline text-xl text-on-surface mb-1">Associated Portfolio</h3>
                          <p className="text-on-surface-variant text-sm mb-3">
                            {myUnits.length > 0
                              ? `You are managing ${myUnits.length} ${myUnits.length === 1 ? "unit" : "units"}${myAssociations?.[0]?.associationName ? ` under ${myAssociations[0].associationName}` : ""}.`
                              : "No units are currently associated with your account."}
                          </p>
                          <div className="flex gap-2 flex-wrap">
                            {myUnits.length > 0 ? (
                              <span className="bg-surface border border-outline-variant/30 px-3 py-1 rounded text-xs font-medium">{myUnits.length} {myUnits.length === 1 ? "Unit" : "Units"}</span>
                            ) : (
                              <span className="bg-surface border border-outline-variant/30 px-3 py-1 rounded text-xs font-medium">No units</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Occupancy Subtab */}
                {overviewSubtab === "occupancy" && (
                  <div className="space-y-6">
                    {myUnits.map((unit) => {
                      const isEditing = editingUnitId === unit.unitId;
                      const form = occupancyFormByUnit[unit.unitId] || {
                        occupancyType: "OWNER_OCCUPIED" as "OWNER_OCCUPIED" | "TENANT",
                        tenantFirstName: "",
                        tenantLastName: "",
                        tenantEmail: "",
                        tenantPhone: "",
                        notes: "",
                      };
                      const unitLabel = [unit.building && `Bldg ${unit.building}`, unit.unitNumber && `Unit ${unit.unitNumber}`].filter(Boolean).join(" · ") || "Unit";
                      const tenant = unit.occupants?.find((o) => o.occupancyType === "TENANT");
                      const isOwnerOccupied = !tenant && unit.occupants?.some((o) => o.occupancyType === "OWNER_OCCUPIED");

                      return (
                        <div key={unit.unitId} className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10 overflow-hidden">
                          {/* Card header */}
                          <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-outline-variant/10">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="material-symbols-outlined text-primary shrink-0" style={{ fontSize: 20 }}>apartment</span>
                              <div className="min-w-0">
                                <p className="font-semibold text-on-surface leading-tight">{unitLabel}</p>
                                <p className="text-xs text-on-surface-variant truncate">
                                  {isEditing
                                    ? "Editing occupancy"
                                    : isOwnerOccupied
                                    ? "Owner-occupied"
                                    : tenant
                                    ? `Tenanted · ${tenant.firstName} ${tenant.lastName}`
                                    : "No occupancy on file"}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              {isEditing ? (
                                <>
                                  <button
                                    className="px-4 py-2 text-on-surface-variant font-medium hover:bg-surface-container transition-all rounded-lg text-sm"
                                    onClick={() => setEditingUnitId(null)}
                                  >
                                    Discard
                                  </button>
                                  <button
                                    className="px-4 py-2 bg-primary text-on-primary font-semibold rounded-lg text-sm flex items-center gap-1.5 transition-transform active:scale-95 disabled:opacity-50"
                                    onClick={() => saveOccupancy.mutate()}
                                    disabled={saveOccupancy.isPending}
                                  >
                                    {saveOccupancy.isPending ? "Saving…" : "Save"}
                                    {!saveOccupancy.isPending && <span className="material-symbols-outlined" style={{ fontSize: 15 }}>arrow_forward</span>}
                                  </button>
                                </>
                              ) : (
                                <button
                                  className="px-3 py-1.5 text-primary font-medium text-sm flex items-center gap-1.5 hover:bg-surface-container rounded-lg transition-all"
                                  onClick={() => {
                                    const occupant = unit.occupants?.[0];
                                    setOccupancyFormByUnit((prev) => ({
                                      ...prev,
                                      [unit.unitId]: {
                                        occupancyType: (occupant?.occupancyType as any) || "OWNER_OCCUPIED",
                                        tenantFirstName: occupant?.occupancyType === "TENANT" ? occupant.firstName : "",
                                        tenantLastName: occupant?.occupancyType === "TENANT" ? occupant.lastName : "",
                                        tenantEmail: occupant?.occupancyType === "TENANT" ? occupant.email || "" : "",
                                        tenantPhone: occupant?.occupancyType === "TENANT" ? formatPhoneNumber(occupant.phone || "") : "",
                                        notes: "",
                                      },
                                    }));
                                    setEditingUnitId(unit.unitId);
                                  }}
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>edit</span>
                                  Edit
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Card body */}
                          <div className="p-6">
                            {occupancyUpdateSuccess === unit.unitId && (
                              <div className="mb-5 bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-3 text-green-800">
                                <span className="material-symbols-outlined text-green-600" style={{ fontSize: 18 }}>check_circle</span>
                                <span className="text-sm font-medium">Occupancy updated successfully</span>
                              </div>
                            )}

                            {isEditing ? (
                              <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                                {/* Left — occupancy type + tenant details */}
                                <div className="md:col-span-8 space-y-5">
                                  {/* Occupancy Type */}
                                  <div>
                                    <p className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">Occupancy Type</p>
                                    <div className="space-y-2">
                                      {([
                                        { value: "OWNER_OCCUPIED", icon: "home", label: "Owner Occupied", desc: "You are living in this unit" },
                                        { value: "TENANT", icon: "person", label: "Tenant Occupied", desc: "A tenant is renting this unit" },
                                      ] as const).map(({ value, icon, label, desc }) => (
                                        <label key={value} className="flex items-center p-3 rounded-lg bg-surface-container-low cursor-pointer hover:bg-primary-fixed/60 transition-all">
                                          <input
                                            type="radio"
                                            name={`occupancy_type_${unit.unitId}`}
                                            className="h-4 w-4 accent-primary"
                                            checked={form.occupancyType === value}
                                            onChange={() =>
                                              setOccupancyFormByUnit((prev) => ({
                                                ...prev,
                                                [unit.unitId]: { ...form, occupancyType: value },
                                              }))
                                            }
                                          />
                                          <div className="ml-3 flex items-center gap-2.5">
                                            <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>{icon}</span>
                                            <div>
                                              <p className="font-medium text-sm">{label}</p>
                                              <p className="text-xs text-on-surface-variant">{desc}</p>
                                            </div>
                                          </div>
                                        </label>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Tenant details */}
                                  {form.occupancyType === "TENANT" && (
                                    <div>
                                      <p className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">Tenant Information</p>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
                                        <div className="space-y-1.5">
                                          <label className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">First Name</label>
                                          <input
                                            className="w-full bg-surface-container border-none rounded-lg focus:ring-2 focus:ring-primary p-3 outline-none transition-all text-on-surface placeholder:text-on-surface-variant/50 text-sm"
                                            type="text"
                                            value={form.tenantFirstName}
                                            onChange={(e) => setOccupancyFormByUnit((prev) => ({ ...prev, [unit.unitId]: { ...form, tenantFirstName: e.target.value } }))}
                                            placeholder="First name"
                                          />
                                        </div>
                                        <div className="space-y-1.5">
                                          <label className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Last Name</label>
                                          <input
                                            className="w-full bg-surface-container border-none rounded-lg focus:ring-2 focus:ring-primary p-3 outline-none transition-all text-on-surface placeholder:text-on-surface-variant/50 text-sm"
                                            type="text"
                                            value={form.tenantLastName}
                                            onChange={(e) => setOccupancyFormByUnit((prev) => ({ ...prev, [unit.unitId]: { ...form, tenantLastName: e.target.value } }))}
                                            placeholder="Last name"
                                          />
                                        </div>
                                        <div className="space-y-1.5">
                                          <label className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Email Address</label>
                                          <input
                                            className="w-full bg-surface-container border-none rounded-lg focus:ring-2 focus:ring-primary p-3 outline-none transition-all text-on-surface placeholder:text-on-surface-variant/50 text-sm"
                                            type="email"
                                            value={form.tenantEmail}
                                            onChange={(e) => setOccupancyFormByUnit((prev) => ({ ...prev, [unit.unitId]: { ...form, tenantEmail: e.target.value } }))}
                                            placeholder="tenant@email.com"
                                          />
                                        </div>
                                        <div className="space-y-1.5">
                                          <label className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Phone Number</label>
                                          <input
                                            className="w-full bg-surface-container border-none rounded-lg focus:ring-2 focus:ring-primary p-3 outline-none transition-all text-on-surface placeholder:text-on-surface-variant/50 text-sm"
                                            type="tel"
                                            value={form.tenantPhone}
                                            onChange={(e) => setOccupancyFormByUnit((prev) => ({ ...prev, [unit.unitId]: { ...form, tenantPhone: formatPhoneNumber(e.target.value) } }))}
                                            placeholder="(XXX) XXX-XXXX"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Right — status tile */}
                                <div className="md:col-span-4">
                                  <div className="bg-secondary-container rounded-xl p-5 flex flex-col gap-3 h-full">
                                    <span className="material-symbols-outlined text-primary" style={{ fontSize: 28 }}>
                                      {form.occupancyType === "TENANT" ? "person" : "home"}
                                    </span>
                                    <div>
                                      <p className="font-headline text-base text-on-secondary-container mb-1">
                                        {form.occupancyType === "TENANT" ? "Tenant Occupied" : "Owner Occupied"}
                                      </p>
                                      <p className="text-xs text-on-secondary-container/80 leading-relaxed">
                                        {form.occupancyType === "TENANT"
                                          ? "Provide the tenant's contact details so the association can reach them if needed."
                                          : "You are the primary resident. No tenant details required."}
                                      </p>
                                    </div>
                                    {form.occupancyType === "TENANT" && (form.tenantFirstName || form.tenantLastName) && (
                                      <div className="pt-3 border-t border-on-secondary-container/10 space-y-0.5">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-on-secondary-container/60">On file</p>
                                        <p className="font-semibold text-sm text-on-secondary-container">{[form.tenantFirstName, form.tenantLastName].filter(Boolean).join(" ")}</p>
                                        {form.tenantEmail && <p className="text-xs text-on-secondary-container/70">{form.tenantEmail}</p>}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              /* View mode */
                              unit.occupants && unit.occupants.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                  {Object.values(
                                    unit.occupants.reduce((acc, o) => ({ ...acc, [o.occupancyType]: o }), {} as Record<string, typeof unit.occupants[0]>)
                                  ).map((occupant) => (
                                    <div key={occupant.personId} className="bg-surface-container-low rounded-lg p-4 space-y-1.5">
                                      <div className="flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>
                                          {occupant.occupancyType === "OWNER_OCCUPIED" ? "home" : "person"}
                                        </span>
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                                          {occupant.occupancyType === "OWNER_OCCUPIED" ? "Owner" : "Tenant"}
                                        </span>
                                      </div>
                                      <p className="font-semibold text-sm text-on-surface">{occupant.firstName} {occupant.lastName}</p>
                                      {occupant.email && <p className="text-xs text-on-surface-variant">{occupant.email}</p>}
                                      {occupant.phone && <p className="text-xs text-on-surface-variant">{occupant.phone}</p>}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-center py-6 space-y-1">
                                  <span className="material-symbols-outlined text-2xl text-on-surface-variant/40">family_restroom</span>
                                  <p className="text-sm text-on-surface-variant">No occupancy information on file</p>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* MAINTENANCE TAB */}
          {activeTab === "maintenance" && (
            <div className="space-y-8">
              <div className="space-y-2">
                <p className="font-label text-primary uppercase tracking-widest text-[11px]">Maintenance</p>
                <h1 className="font-headline text-4xl text-on-surface">Submit & Track Requests</h1>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Submit Form */}
                <div className="lg:col-span-1">
                  <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/10 sticky top-24">
                    <h3 className="font-headline text-lg mb-4">New Request</h3>
                    <div className="space-y-3">
                      <Input placeholder="Issue title" value={maintenanceTitle} onChange={(e) => setMaintenanceTitle(e.target.value)} />
                      <Textarea placeholder="Description" value={maintenanceDescription} onChange={(e) => setMaintenanceDescription(e.target.value)} />
                      <Input placeholder="Location" value={maintenanceLocation} onChange={(e) => setMaintenanceLocation(e.target.value)} />
                      <Select value={maintenanceCategory} onValueChange={setMaintenanceCategory}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {maintenanceCategories.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Select value={maintenancePriority} onValueChange={setMaintenancePriority}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {maintenancePriorities.map((pri) => <SelectItem key={pri} value={pri}>{pri}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <div>
                        <label className="text-xs font-medium text-on-surface-variant">Attach photos</label>
                        <Input type="file" multiple accept="image/*" onChange={(e) => setMaintenanceFiles(Array.from(e.target.files ?? []))} className="mt-1" />
                        {maintenanceFiles.length > 0 && (
                          <p className="text-xs text-on-surface-variant mt-2">{maintenanceFiles.length} photo(s) selected</p>
                        )}
                      </div>
                      <Button onClick={() => submitMaintenanceRequest.mutate()} disabled={submitMaintenanceRequest.isPending} className="w-full">
                        {submitMaintenanceRequest.isPending ? 'Submitting...' : 'Submit Request'}
                      </Button>
                      {maintenanceSuccess && (
                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                          Request submitted successfully
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Requests List */}
                <div className="lg:col-span-2">
                  <div className="space-y-4">
                    <h3 className="font-headline text-lg">Your Requests</h3>
                    {(maintenanceRequests ?? []).length > 0 ? (
                      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 overflow-hidden">
                        <button
                          onClick={() => setMaintenanceSuccess(!maintenanceSuccess)}
                          className="w-full px-6 py-4 flex justify-between items-center hover:bg-surface-container-high transition-colors"
                        >
                          <div className="flex items-center gap-4 text-left">
                            <div>
                              <h4 className="font-bold text-on-surface">Maintenance Requests</h4>
                              <p className="text-sm text-on-surface-variant">{maintenanceRequests?.length} {maintenanceRequests?.length === 1 ? 'request' : 'requests'}</p>
                            </div>
                          </div>
                          <span className={`material-symbols-outlined transition-transform ${maintenanceSuccess ? 'rotate-180' : ''}`}>
                            expand_more
                          </span>
                        </button>
                        {maintenanceSuccess && (
                          <div className="border-t border-outline-variant/10 p-6 space-y-6">
                            {(maintenanceRequests ?? [])
                              .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
                              .map((req, index) => (
                                <div key={req.id} className="relative">
                                  <div className="flex gap-4">
                                    <div className="flex flex-col items-center">
                                      <div className="w-3 h-3 rounded-full bg-primary mt-2"></div>
                                      {index < (maintenanceRequests?.length || 0) - 1 && (
                                        <div className="w-0.5 h-16 bg-outline-variant/20 my-1"></div>
                                      )}
                                    </div>
                                    <div className="flex-1 pb-4">
                                      <p className="text-xs text-on-surface-variant uppercase tracking-widest mb-1">
                                        {req.createdAt ? new Date(req.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date unknown'}
                                      </p>
                                      <div className="bg-surface-container rounded-lg p-4 space-y-3">
                                        <div className="flex justify-between items-start gap-3">
                                          <div>
                                            <h5 className="font-bold text-on-surface">{req.title}</h5>
                                            <p className="text-sm text-on-surface-variant mt-1">{req.locationText || "Location not specified"} · {req.category}</p>
                                          </div>
                                          <Badge className="shrink-0">{getOwnerReadableState(req.status)}</Badge>
                                        </div>
                                        <p className="text-sm text-on-surface">{req.description}</p>
                                        <div className="flex gap-2 flex-wrap">
                                          <Badge variant={req.priority === "urgent" ? "destructive" : "outline"}>{req.priority}</Badge>
                                          {req.responseDueAt && (
                                            <p className="text-xs text-on-surface-variant">Due {new Date(req.responseDueAt).toLocaleDateString()}</p>
                                          )}
                                        </div>
                                        {req.resolutionNotes && (
                                          <div className="p-3 bg-surface-container-lowest rounded border border-outline-variant/10">
                                            <p className="text-xs font-medium text-on-surface-variant mb-1">Resolution</p>
                                            <p className="text-sm text-on-surface">{req.resolutionNotes}</p>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-16 space-y-2">
                        <span className="material-symbols-outlined text-4xl text-on-surface-variant/40">build_circle</span>
                        <p className="text-on-surface-variant">No maintenance requests yet</p>
                        <p className="text-sm text-on-surface-variant/60">Use the form to submit your first request</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* FINANCIALS TAB */}
          {activeTab === "financials" && (
            <div className="space-y-8">
              <div className="space-y-2">
                <p className="font-label text-primary uppercase tracking-widest text-[11px]">Financials</p>
                <h1 className="font-headline text-4xl text-on-surface">Manage Payments</h1>
              </div>

              {/* Unit Selector for Multi-Unit Owners */}
              {myUnits.length > 1 && (
                <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/10">
                  <p className="text-sm font-medium mb-2">Select Unit</p>
                  <div className="flex gap-2 flex-wrap">
                    {myUnits.map((unit) => (
                      <Button
                        key={unit.unitId}
                        variant={ownedUnitFocusId === unit.unitId ? "default" : "outline"}
                        size="sm"
                        onClick={() => setOwnedUnitFocusId(unit.unitId)}
                      >
                        {unit.building} {unit.unitNumber}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Payment Section */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/10">
                    <h3 className="font-headline text-lg mb-4">Current Statement</h3>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="p-4 bg-surface rounded-lg border border-outline-variant/10">
                        <p className="text-xs text-on-surface-variant font-medium">Amount Due</p>
                        <p className={`font-headline text-2xl mt-1 ${currentUnitPayableBalance > 0 ? "text-destructive" : "text-secondary"}`}>
                          ${Math.abs(currentUnitPayableBalance).toFixed(2)}
                        </p>
                      </div>
                      <div className="p-4 bg-surface rounded-lg border border-outline-variant/10">
                        <p className="text-xs text-on-surface-variant font-medium">Last Payment</p>
                        <p className="font-medium mt-1">{financialDashboard?.lastPaymentDate ? new Date(financialDashboard.lastPaymentDate).toLocaleDateString() : "None"}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="font-bold">Make a Payment</h4>
                      <Input type="number" step="0.01" placeholder="Amount" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
                      <Input placeholder="Description (optional)" value={paymentDescription} onChange={(e) => setPaymentDescription(e.target.value)} />
                      <Button onClick={() => submitPayment.mutate()} disabled={!paymentAmount || submitPayment.isPending} className="w-full">
                        {submitPayment.isPending ? 'Processing...' : 'Submit Payment'}
                      </Button>
                      {submitPayment.isError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                          Error submitting payment
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Payment Methods */}
                  <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/10">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-headline text-lg">Payment Methods</h3>
                      <Button size="sm" variant={addMethodOpen ? "destructive" : "outline"} onClick={() => setAddMethodOpen(!addMethodOpen)}>
                        {addMethodOpen ? "Cancel" : "Add Method"}
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {(savedMethods ?? []).map((method) => (
                        <div key={method.id} className="p-3 bg-surface rounded-lg border border-outline-variant/10 flex justify-between items-center">
                          <div>
                            <p className="font-medium">{method.displayName}</p>
                            <p className="text-xs text-on-surface-variant">•••• {method.last4}</p>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => removeMethod.mutate(method.id)}>Remove</Button>
                        </div>
                      ))}
                    </div>
                    {addMethodOpen && (
                      <div className="mt-4 space-y-3 p-4 bg-surface rounded-lg border border-outline-variant/10">
                        <Input placeholder="Display name" value={methodForm.displayName} onChange={(e) => setMethodForm((p) => ({ ...p, displayName: e.target.value }))} />
                        <Select value={methodForm.methodType} onValueChange={(value) => setMethodForm((p) => ({ ...p, methodType: value as any }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ach">Bank Account</SelectItem>
                            <SelectItem value="card">Credit Card</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button onClick={() => addMethod.mutate()} disabled={addMethod.isPending} className="w-full">
                          {addMethod.isPending ? "Adding..." : "Add Method"}
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Autopay */}
                  <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/10">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-headline text-lg">Autopay</h3>
                      <Button size="sm" variant={autopayFormOpen ? "destructive" : "outline"} onClick={() => setAutopayFormOpen(!autopayFormOpen)}>
                        {autopayFormOpen ? "Cancel" : "Setup Autopay"}
                      </Button>
                    </div>
                    {activeAutopayEnrollment ? (
                      <div className="p-4 bg-surface rounded-lg border border-outline-variant/10">
                        <p className="font-medium">Active autopay</p>
                        <p className="text-sm text-on-surface-variant mt-1">${Number(activeAutopayEnrollment.amount ?? 0).toFixed(2)} {activeAutopayEnrollment.frequency}</p>
                        <Button size="sm" onClick={() => cancelAutopay.mutate(activeAutopayEnrollment.id)} disabled={cancelAutopay.isPending} className="mt-3">
                          Cancel Autopay
                        </Button>
                      </div>
                    ) : (
                      <p className="text-on-surface-variant">No autopay currently enabled</p>
                    )}
                    {autopayFormOpen && (
                      <div className="mt-4 space-y-3 p-4 bg-surface rounded-lg border border-outline-variant/10">
                        <Input type="number" step="0.01" placeholder="Amount" value={autopayForm.amount} onChange={(e) => setAutopayForm((p) => ({ ...p, amount: e.target.value }))} />
                        <Input type="number" min="1" max="31" placeholder="Day of month" value={autopayForm.dayOfMonth} onChange={(e) => setAutopayForm((p) => ({ ...p, dayOfMonth: e.target.value }))} />
                        <Select value={autopayForm.frequency} onValueChange={(value) => setAutopayForm((p) => ({ ...p, frequency: value }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="quarterly">Quarterly</SelectItem>
                            <SelectItem value="annually">Annually</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button onClick={() => enrollAutopay.mutate()} disabled={enrollAutopay.isPending} className="w-full">
                          {enrollAutopay.isPending ? "Setting up..." : "Enable Autopay"}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Statement Summary */}
                <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/10 sticky top-24 h-fit">
                  <h3 className="font-headline text-lg mb-4">Ledger Summary</h3>
                  <div className="space-y-3">
                    <div className="p-3 bg-surface rounded-lg border border-outline-variant/10">
                      <p className="text-xs text-on-surface-variant">Total Charges</p>
                      <p className="font-bold text-lg">${financialDashboard?.totalCharges?.toFixed(2) ?? "0.00"}</p>
                    </div>
                    <div className="p-3 bg-surface rounded-lg border border-outline-variant/10">
                      <p className="text-xs text-on-surface-variant">Total Paid</p>
                      <p className="font-bold text-lg">${financialDashboard?.totalPayments?.toFixed(2) ?? "0.00"}</p>
                    </div>
                    <div className="p-3 bg-surface rounded-lg border border-outline-variant/10">
                      <p className="text-xs text-on-surface-variant">Current Balance</p>
                      <p className={`font-bold text-lg ${(financialDashboard?.balance ?? 0) > 0 ? "text-destructive" : "text-secondary"}`}>
                        ${Math.abs(financialDashboard?.balance ?? 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* DOCUMENTS TAB */}
          {activeTab === "documents" && (
            <div className="space-y-8">
              <div className="space-y-2">
                <p className="font-label text-primary uppercase tracking-widest text-[11px]">Documents</p>
                <h1 className="font-headline text-4xl text-on-surface">Community Documents</h1>
              </div>
              <div className="grid gap-4">
                {(documents ?? []).length > 0 ? (
                  (documents ?? []).map((doc) => (
                    <div key={doc.id} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 overflow-hidden">
                      <div className="p-5 flex justify-between items-center gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-secondary-container flex-shrink-0 flex items-center justify-center">
                            <span className="material-symbols-outlined text-secondary text-lg">description</span>
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-base truncate">{doc.title}</h4>
                            <p className="text-sm text-on-surface-variant capitalize">
                              {doc.documentType?.replace(/-/g, " ") || "Document"}
                              {(doc as any).currentVersionNumber ? ` · v${(doc as any).currentVersionNumber}` : ""}
                            </p>
                          </div>
                        </div>
                        {doc.fileUrl ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="shrink-0 flex items-center gap-1"
                            onClick={() => downloadDocument(doc)}
                          >
                            <span className="material-symbols-outlined text-base">download</span>
                            Download
                          </Button>
                        ) : (
                          <span className="text-xs text-on-surface-variant shrink-0">No file</span>
                        )}
                      </div>
                      {(doc as any).versions?.length > 0 && (
                        <div className="border-t border-outline-variant/10">
                          <button
                            className="w-full flex items-center justify-between px-5 py-3 text-xs font-medium text-on-surface-variant uppercase tracking-wider hover:bg-surface-container/40 transition-colors"
                            onClick={() => setExpandedVersionDocId(expandedVersionDocId === doc.id ? null : doc.id)}
                            aria-expanded={expandedVersionDocId === doc.id}
                          >
                            <span>Version History ({(doc as any).versions.length})</span>
                            <span className="material-symbols-outlined text-base" style={{ fontSize: "16px" }}>
                              {expandedVersionDocId === doc.id ? "expand_less" : "expand_more"}
                            </span>
                          </button>
                          {expandedVersionDocId === doc.id && (
                            <div className="px-5 pb-4 space-y-2">
                              {((doc as any).versions as Array<{ id: string; versionNumber: number; title: string; fileUrl: string; effectiveDate?: string; amendmentNotes?: string; isCurrent: number; createdAt: string }>).map((v) => (
                                <div key={v.id} className="flex items-start justify-between gap-3 text-sm">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">v{v.versionNumber}</span>
                                      {v.isCurrent ? <span className="text-xs text-primary font-medium">Current</span> : null}
                                      {v.effectiveDate ? <span className="text-xs text-on-surface-variant">Eff. {new Date(v.effectiveDate).toLocaleDateString()}</span> : null}
                                    </div>
                                    {v.amendmentNotes ? <p className="text-xs text-on-surface-variant mt-0.5 italic">{v.amendmentNotes}</p> : null}
                                  </div>
                                  {v.fileUrl ? (
                                    <Button size="sm" variant="ghost" asChild className="shrink-0 text-xs h-7">
                                      <a href={v.fileUrl} download>Download</a>
                                    </Button>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-16 space-y-2">
                    <span className="material-symbols-outlined text-4xl text-on-surface-variant/40">folder_open</span>
                    <p className="text-on-surface-variant">No documents available yet</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* NOTICES TAB */}
          {activeTab === "notices" && (
            <div className="space-y-8">
              <div className="space-y-2">
                <p className="font-label text-primary uppercase tracking-widest text-[11px]">Notices</p>
                <h1 className="font-headline text-4xl text-on-surface">Community Updates</h1>
                {unreadNoticesCount > 0 && (
                  <p className="text-sm text-on-surface-variant">{unreadNoticesCount} unread {unreadNoticesCount === 1 ? "notice" : "notices"}</p>
                )}
              </div>
              <div className="grid gap-3">
                {/* Maintenance — single grouped entry with timeline */}
                {(maintenanceRequests ?? []).length > 0 && (() => {
                  const allRequests = maintenanceRequests ?? [];
                  const isExpanded = expandedNoticeId === "__maintenance__";
                  const openCount = allRequests.filter((r) => !["resolved", "closed", "rejected"].includes(r.status)).length;
                  const lastUpdated = allRequests.reduce((latest, r) => {
                    const d = new Date(r.updatedAt);
                    return d > latest ? d : latest;
                  }, new Date(0));

                  const statusCfg: Record<string, { label: string; dotColor: string; icon: string }> = {
                    submitted:     { label: "Submitted",    dotColor: "bg-primary",        icon: "schedule" },
                    triaged:       { label: "Under Review", dotColor: "bg-tertiary",       icon: "search" },
                    "in-progress": { label: "In Progress",  dotColor: "bg-secondary",      icon: "construction" },
                    resolved:      { label: "Resolved",     dotColor: "bg-green-500",      icon: "check_circle" },
                    closed:        { label: "Closed",       dotColor: "bg-outline-variant", icon: "lock" },
                    rejected:      { label: "Not Approved", dotColor: "bg-destructive",          icon: "cancel" },
                  };

                  const maintenanceRead = readNoticeIds.includes("__maintenance__");
                  return (
                    <div className={`rounded-2xl border overflow-hidden transition-all ${maintenanceRead ? "bg-surface-container-lowest border-outline-variant/10" : "bg-surface-container border-primary/20 shadow-sm"}`}>
                      {/* Header row */}
                      <div
                        className="p-5 flex items-start gap-3 cursor-pointer"
                        onClick={() => {
                          if (!isExpanded) markNoticeAsRead("__maintenance__");
                          setExpandedNoticeId(isExpanded ? null : "__maintenance__");
                        }}
                      >
                        <div className="mt-1 flex-shrink-0">
                          <span className={`block w-2 h-2 rounded-full ${!maintenanceRead ? "bg-primary" : "bg-outline-variant/30"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className={`font-bold text-base ${!maintenanceRead ? "text-on-surface" : "text-on-surface-variant"}`}>Maintenance Updates</h4>
                              <span className="text-xs bg-surface-container px-2 py-0.5 rounded-full text-on-surface-variant font-medium">
                                {allRequests.length} {allRequests.length === 1 ? "request" : "requests"}
                              </span>
                              {openCount > 0 && (
                                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                                  {openCount} open
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <p className="text-xs text-on-surface-variant whitespace-nowrap">
                                {lastUpdated.toLocaleDateString()}
                              </p>
                              <span className={`material-symbols-outlined text-sm text-on-surface-variant transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                                expand_more
                              </span>
                            </div>
                          </div>
                          {!isExpanded && (
                            <p className="text-sm text-on-surface-variant mt-1 line-clamp-1">
                              {allRequests.slice(0, 2).map((r) => r.title).join(" · ")}
                              {allRequests.length > 2 ? ` · +${allRequests.length - 2} more` : ""}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Timeline body */}
                      {isExpanded && (
                        <div className="border-t border-outline-variant/10 divide-y divide-outline-variant/10">
                          {allRequests.map((req) => {
                            const cfg = statusCfg[req.status] ?? statusCfg.submitted;
                            type Step = { label: string; date: string | null; done: boolean; active: boolean };
                            const steps: Step[] = [
                              { label: "Submitted",    date: req.createdAt,                        done: true,  active: req.status === "submitted" },
                              { label: "Under Review", date: (req as any).triagedAt ?? null,       done: ["triaged","in-progress","resolved","closed"].includes(req.status), active: req.status === "triaged" },
                              { label: "In Progress",  date: null,                                 done: ["in-progress","resolved","closed"].includes(req.status), active: req.status === "in-progress" },
                              { label: "Resolved",     date: (req as any).resolvedAt ?? (req as any).closedAt ?? null, done: ["resolved","closed","rejected"].includes(req.status), active: ["resolved","closed","rejected"].includes(req.status) },
                            ];

                            return (
                              <div key={req.id} className="px-5 py-5">
                                {/* Request header */}
                                <div className="flex items-start justify-between gap-3 mb-5">
                                  <div className="min-w-0">
                                    <p className="font-semibold text-sm text-on-surface">{req.title}</p>
                                    {req.locationText && (
                                      <p className="text-xs text-on-surface-variant mt-0.5 flex items-center gap-1">
                                        <span className="material-symbols-outlined" style={{ fontSize: 12 }}>location_on</span>
                                        {req.locationText}
                                      </p>
                                    )}
                                  </div>
                                  <span className={`shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full text-white ${cfg.dotColor}`}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{cfg.icon}</span>
                                    {cfg.label}
                                  </span>
                                </div>

                                {/* Step timeline */}
                                <div className="flex items-start">
                                  {steps.map((step, i) => {
                                    const isLast = i === steps.length - 1;
                                    return (
                                      <div key={step.label} className="flex-1 flex flex-col items-center relative">
                                        {!isLast && (
                                          <div className={`absolute top-2.5 left-1/2 w-full h-0.5 ${step.done ? "bg-primary/40" : "bg-outline-variant/20"}`} />
                                        )}
                                        <div className={`relative z-10 w-5 h-5 rounded-full flex items-center justify-center ring-4 ring-surface-container-lowest ${
                                          step.active ? "bg-primary" : step.done ? "bg-primary/50" : "bg-surface-container border-2 border-outline-variant/30"
                                        }`}>
                                          {step.done && <span className="material-symbols-outlined text-white" style={{ fontSize: 11 }}>check</span>}
                                        </div>
                                        <p className={`text-[10px] font-medium mt-1.5 text-center leading-tight px-0.5 ${step.active ? "text-primary" : step.done ? "text-on-surface-variant" : "text-outline-variant"}`}>
                                          {step.label}
                                        </p>
                                        {step.date && (
                                          <p className="text-[9px] text-on-surface-variant/60 text-center mt-0.5">
                                            {new Date(step.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                                          </p>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>

                                {req.resolutionNotes && (
                                  <div className="mt-4 bg-surface-container-low rounded-lg p-3">
                                    <p className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Resolution Notes</p>
                                    <p className="text-sm text-on-surface">{req.resolutionNotes}</p>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Community notices */}
                {(notices ?? []).length > 0 ? (
                  (notices ?? []).map((notice) => {
                    const isRead = readNoticeIds.includes(notice.id);
                    const isExpanded = expandedNoticeId === notice.id;
                    return (
                      <div
                        key={notice.id}
                        className={`rounded-2xl border transition-all cursor-pointer ${
                          isRead
                            ? "bg-surface-container-lowest border-outline-variant/10"
                            : "bg-surface-container border-primary/20 shadow-sm"
                        }`}
                        onClick={() => {
                          setExpandedNoticeId(isExpanded ? null : notice.id);
                          markNoticeAsRead(notice.id);
                        }}
                      >
                        <div className="p-5 flex items-start gap-3">
                          <div className="mt-1 flex-shrink-0">
                            {!isRead ? (
                              <span className="block w-2 h-2 rounded-full bg-primary" />
                            ) : (
                              <span className="block w-2 h-2 rounded-full bg-outline-variant/30" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start gap-2">
                              <h4 className={`font-bold text-base leading-snug ${!isRead ? "text-on-surface" : "text-on-surface-variant"}`}>
                                {notice.subject}
                              </h4>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <p className="text-xs text-on-surface-variant whitespace-nowrap">
                                  {new Date(notice.createdAt).toLocaleDateString()}
                                </p>
                                <span className={`material-symbols-outlined text-sm text-on-surface-variant transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                                  expand_more
                                </span>
                              </div>
                            </div>
                            {!isExpanded && (
                              <p className="text-sm text-on-surface-variant mt-1 line-clamp-2">
                                {getNoticeBodyText(notice)}
                              </p>
                            )}
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="border-t border-outline-variant/10 rounded-b-2xl px-6 py-4">
                            <p className="whitespace-pre-line break-words text-sm leading-6 text-on-surface">
                              {getNoticeBodyText(notice)}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (maintenanceRequests ?? []).length === 0 ? (
                  <div className="text-center py-16 space-y-2">
                    <span className="material-symbols-outlined text-4xl text-on-surface-variant/40">notifications_off</span>
                    <p className="text-on-surface-variant">No community notices yet</p>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {activeTab === "elections" && (
            <div className="space-y-8">
              {/* Election Detail View */}
              {selectedElectionId && electionDetail ? (() => {
                const ed = electionDetail;
                const CHART_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#14b8a6"];
                return (
                  <div className="space-y-6">
                    {/* Back button */}
                    <button
                      onClick={() => { setSelectedElectionId(null); setProxyFormOpen(false); }}
                      className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 font-medium"
                    >
                      <span className="material-symbols-outlined text-base">arrow_back</span>
                      Back to Elections
                    </button>

                    {/* Header */}
                    <div className="space-y-2">
                      <p className="font-label text-primary uppercase tracking-widest text-[11px]">Election Detail</p>
                      <div className="flex items-start justify-between gap-3">
                        <h1 className="font-headline text-3xl text-on-surface">{ed.election.title}</h1>
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium shrink-0 ${
                          ed.election.status === "open" ? "bg-green-100 text-green-700" :
                          ed.election.status === "certified" ? "bg-blue-100 text-blue-700" :
                          ed.election.status === "closed" ? "bg-yellow-100 text-yellow-700" :
                          "bg-gray-100 text-gray-700"
                        }`}>{ed.election.status}</span>
                      </div>
                      {ed.election.description && (
                        <p className="text-sm text-on-surface-variant">{ed.election.description}</p>
                      )}
                    </div>

                    {/* Info grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="rounded-xl border bg-surface-container-lowest border-outline-variant/10 p-4">
                        <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mb-1">Type</p>
                        <p className="text-sm font-semibold text-on-surface capitalize">{ed.election.voteType.replace(/-/g, " ")}</p>
                      </div>
                      <div className="rounded-xl border bg-surface-container-lowest border-outline-variant/10 p-4">
                        <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mb-1">Voting Rule</p>
                        <p className="text-sm font-semibold text-on-surface capitalize">{ed.election.votingRule.replace(/-/g, " ")}</p>
                      </div>
                      <div className="rounded-xl border bg-surface-container-lowest border-outline-variant/10 p-4">
                        <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mb-1">Opens</p>
                        <p className="text-sm font-semibold text-on-surface">{ed.election.opensAt ? new Date(ed.election.opensAt).toLocaleDateString() : "N/A"}</p>
                      </div>
                      <div className="rounded-xl border bg-surface-container-lowest border-outline-variant/10 p-4">
                        <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mb-1">Closes</p>
                        <p className="text-sm font-semibold text-on-surface">{ed.election.closesAt ? new Date(ed.election.closesAt).toLocaleDateString() : "N/A"}</p>
                      </div>
                    </div>

                    {/* Options/Candidates */}
                    {ed.options.length > 0 && (
                      <div className="rounded-2xl border bg-surface-container-lowest border-outline-variant/10 p-5 space-y-3">
                        <h3 className="font-headline text-lg text-on-surface">Options / Candidates</h3>
                        <div className="space-y-2">
                          {ed.options.sort((a, b) => a.orderIndex - b.orderIndex).map((opt) => (
                            <div key={opt.id} className="flex items-start gap-3 p-3 rounded-lg bg-surface-container-low/50">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <span className="text-xs font-bold text-primary">{opt.orderIndex + 1}</span>
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-sm text-on-surface">{opt.label}</p>
                                {opt.description && <p className="text-xs text-on-surface-variant mt-0.5">{opt.description}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Participation status */}
                    <div className="rounded-2xl border bg-surface-container-lowest border-outline-variant/10 p-5 space-y-3">
                      <h3 className="font-headline text-lg text-on-surface">Your Participation</h3>
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                          ed.status === "voted" ? "bg-green-100 text-green-700" :
                          ed.status === "proxy-designated" ? "bg-blue-100 text-blue-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {ed.status === "voted" ? "Voted" : ed.status === "proxy-designated" ? "Proxy Designated" : "Not Voted"}
                        </span>
                        {ed.election.isSecretBallot ? <span className="text-xs text-amber-600 font-medium">Secret ballot</span> : null}
                      </div>

                      {/* Vote Now button for open + not voted */}
                      {ed.election.status === "open" && ed.status === "not-voted" && ed.ballotToken && (
                        <a
                          href={`/vote/${ed.ballotToken}`}
                          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-primary/90 transition-colors"
                        >
                          <span className="material-symbols-outlined text-base">how_to_vote</span>
                          Cast Your Vote
                        </a>
                      )}

                      {/* Current proxy info */}
                      {ed.proxyDesignation && (
                        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-blue-600 text-base">people</span>
                            <p className="text-sm font-medium text-blue-800">Proxy designated to {ed.proxyDesignation.proxyName}</p>
                          </div>
                          <p className="text-xs text-blue-600">
                            Designated {new Date(ed.proxyDesignation.designatedAt).toLocaleDateString()}
                            {ed.proxyDesignation.notes && ` — ${ed.proxyDesignation.notes}`}
                          </p>
                          {ed.election.status === "open" && (
                            <button
                              onClick={() => revokeProxy.mutate(ed.proxyDesignation!.id)}
                              disabled={revokeProxy.isPending}
                              className="text-xs text-red-600 hover:text-red-700 font-medium underline"
                            >
                              {revokeProxy.isPending ? "Revoking..." : "Revoke Proxy"}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Designate Proxy action for open elections */}
                      {ed.election.status === "open" && ed.status === "not-voted" && !ed.proxyDesignation && (
                        <div className="pt-2">
                          {!proxyFormOpen ? (
                            <button
                              onClick={() => setProxyFormOpen(true)}
                              className="text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-base">people</span>
                              Designate a Proxy
                            </button>
                          ) : (
                            <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-4 space-y-3">
                              <h4 className="text-sm font-semibold text-on-surface">Designate a Proxy</h4>
                              <p className="text-xs text-on-surface-variant">Select another owner in your association to vote on your behalf.</p>
                              <Select value={proxyPersonId} onValueChange={setProxyPersonId}>
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select a person..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {proxyCandidates.map((p) => (
                                    <SelectItem key={p.personId} value={p.personId}>
                                      {p.firstName} {p.lastName}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Textarea
                                placeholder="Notes (optional)"
                                value={proxyNotes}
                                onChange={(e) => setProxyNotes(e.target.value)}
                                className="h-16"
                              />
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => designateProxy.mutate()}
                                  disabled={!proxyPersonId || designateProxy.isPending}
                                  size="sm"
                                >
                                  {designateProxy.isPending ? "Designating..." : "Confirm Proxy"}
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => { setProxyFormOpen(false); setProxyPersonId(""); setProxyNotes(""); }}>
                                  Cancel
                                </Button>
                              </div>
                              {designateProxy.isError && (
                                <p className="text-xs text-destructive">{(designateProxy.error as Error).message}</p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Self-Nomination Section (WS3.2) */}
                    {(() => {
                      const now = new Date();
                      const nomOpen = ed.election.nominationsOpenAt ? new Date(ed.election.nominationsOpenAt) : null;
                      const nomClose = ed.election.nominationsCloseAt ? new Date(ed.election.nominationsCloseAt) : null;
                      const isNominationWindow = nomOpen && nomClose && now >= nomOpen && now <= nomClose;

                      if (!isNominationWindow) return null;

                      return (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-amber-600">person_add</span>
                            <h3 className="font-headline text-lg text-on-surface">Self-Nomination</h3>
                          </div>
                          <p className="text-sm text-on-surface-variant">
                            Nominations are open until {nomClose!.toLocaleDateString()} at {nomClose!.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. You can nominate yourself as a candidate for this election.
                          </p>

                          {!nominationFormOpen ? (
                            <Button
                              onClick={() => setNominationFormOpen(true)}
                              variant="outline"
                              className="border-amber-300 text-amber-700 hover:bg-amber-100"
                            >
                              <span className="material-symbols-outlined text-base mr-1">person_add</span>
                              Nominate Yourself
                            </Button>
                          ) : (
                            <div className="rounded-xl border border-outline-variant/20 bg-white p-4 space-y-3">
                              <h4 className="text-sm font-semibold text-on-surface">Nomination Form</h4>

                              <div className="space-y-1">
                                <label className="text-xs font-medium text-on-surface-variant">Bio *</label>
                                <Textarea
                                  placeholder="Tell voters about yourself, your background, and qualifications..."
                                  value={nominationBio}
                                  onChange={(e) => setNominationBio(e.target.value)}
                                  className="h-20"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-xs font-medium text-on-surface-variant">Current Role *</label>
                                <Input
                                  placeholder="e.g., Homeowner since 2020, Former Board Treasurer"
                                  value={nominationCurrentRole}
                                  onChange={(e) => setNominationCurrentRole(e.target.value)}
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-xs font-medium text-on-surface-variant">Nomination Statement *</label>
                                <Textarea
                                  placeholder="Why are you running? What do you hope to accomplish if elected?"
                                  value={nominationStatement}
                                  onChange={(e) => setNominationStatement(e.target.value)}
                                  className="h-24"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-xs font-medium text-on-surface-variant">Photo URL (optional)</label>
                                <Input
                                  placeholder="https://example.com/photo.jpg"
                                  value={nominationPhotoUrl}
                                  onChange={(e) => setNominationPhotoUrl(e.target.value)}
                                />
                              </div>

                              <div className="flex gap-2 pt-1">
                                <Button
                                  onClick={() => submitNomination.mutate()}
                                  disabled={!nominationBio || !nominationCurrentRole || !nominationStatement || submitNomination.isPending}
                                  size="sm"
                                >
                                  {submitNomination.isPending ? "Submitting..." : "Submit Nomination"}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setNominationFormOpen(false);
                                    setNominationBio("");
                                    setNominationCurrentRole("");
                                    setNominationStatement("");
                                    setNominationPhotoUrl("");
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>

                              {submitNomination.isError && (
                                <p className="text-xs text-destructive">{(submitNomination.error as Error).message}</p>
                              )}

                              {submitNomination.isSuccess && (
                                <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
                                  Your nomination has been submitted and is pending review by the board.
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Visual Results for certified elections with public visibility */}
                    {ed.tally && ed.election.status === "certified" && ed.election.resultVisibility === "public" && (
                      <div className="rounded-2xl border bg-surface-container-lowest border-outline-variant/10 p-5 space-y-4">
                        <h3 className="font-headline text-lg text-on-surface">Election Results</h3>

                        {/* Participation vs Quorum */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-xl bg-surface-container-low p-4 text-center">
                            <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mb-1">Participation</p>
                            <p className="text-2xl font-bold text-on-surface">{ed.tally.participationPercent}%</p>
                            <p className="text-xs text-on-surface-variant">{ed.tally.castCount} of {ed.tally.eligibleCount} voters</p>
                          </div>
                          <div className="rounded-xl bg-surface-container-low p-4 text-center">
                            <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mb-1">Quorum</p>
                            <p className={`text-2xl font-bold ${ed.tally.quorumMet ? "text-green-600" : "text-red-600"}`}>
                              {ed.tally.quorumMet ? "Met" : "Not Met"}
                            </p>
                            <p className="text-xs text-on-surface-variant">{ed.tally.quorumPercent}% required</p>
                          </div>
                        </div>

                        {/* Bar chart of vote distribution */}
                        {ed.tally.optionTallies.length > 0 && !ed.election.isSecretBallot && (() => {
                          const chartData = ed.tally!.optionTallies.map((opt) => ({
                            name: opt.label.length > 20 ? opt.label.slice(0, 18) + "..." : opt.label,
                            fullName: opt.label,
                            votes: opt.votes,
                            percent: opt.percent,
                          }));
                          const maxVotes = Math.max(...chartData.map((d) => d.votes), 1);
                          const winnerIdx = chartData.reduce((best, cur, idx) => (cur.votes > chartData[best].votes ? idx : best), 0);

                          return (
                            <div>
                              <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 50)}>
                                <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                                  <XAxis type="number" domain={[0, maxVotes]} tickFormatter={(v) => `${v}`} />
                                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                                  <Tooltip
                                    formatter={(value: number, _name: string, props: any) => [`${value} votes (${props.payload.percent}%)`, props.payload.fullName]}
                                    contentStyle={{ fontSize: 12 }}
                                  />
                                  <Bar dataKey="votes" radius={[0, 4, 4, 0]}>
                                    {chartData.map((_, idx) => (
                                      <Cell key={idx} fill={idx === winnerIdx ? "#22c55e" : CHART_COLORS[idx % CHART_COLORS.length]} />
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>

                              {/* Winner highlight */}
                              <div className="mt-3 rounded-lg bg-green-50 border border-green-200 p-3 flex items-center gap-2">
                                <span className="material-symbols-outlined text-green-600">emoji_events</span>
                                <p className="text-sm font-medium text-green-800">
                                  Winner: {chartData[winnerIdx].fullName} with {chartData[winnerIdx].votes} votes ({chartData[winnerIdx].percent}%)
                                </p>
                              </div>
                            </div>
                          );
                        })()}

                        {ed.election.isSecretBallot && (
                          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700">
                            This was a secret ballot. Individual vote choices are anonymized.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })() : (
                /* Election List View with Tabs */
                <>
                  <div className="space-y-2">
                    <p className="font-label text-primary uppercase tracking-widest text-[11px]">Voting</p>
                    <h1 className="font-headline text-4xl text-on-surface">Elections & Votes</h1>
                    <p className="text-sm text-on-surface-variant">{electionHistory.length} election{electionHistory.length !== 1 ? "s" : ""} on record</p>
                  </div>

                  <Tabs value={electionsSubtab} onValueChange={(v) => setElectionsSubtab(v as typeof electionsSubtab)} className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="active" className="text-xs sm:text-sm">
                        Active {activeElectionsList.length > 0 && <span className="ml-1 text-[10px] bg-primary text-on-primary px-1.5 py-0.5 rounded-full">{activeElectionsList.length}</span>}
                      </TabsTrigger>
                      <TabsTrigger value="upcoming" className="text-xs sm:text-sm">Upcoming</TabsTrigger>
                      <TabsTrigger value="past" className="text-xs sm:text-sm">Past</TabsTrigger>
                      <TabsTrigger value="history" className="text-xs sm:text-sm">My History</TabsTrigger>
                    </TabsList>

                    {/* Active Elections Tab */}
                    <TabsContent value="active" className="mt-4 space-y-3">
                      {activeElectionsList.length === 0 ? (
                        <div className="text-center py-12 text-on-surface-variant text-sm">
                          <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 block mb-2">how_to_vote</span>
                          No active elections requiring your vote right now.
                        </div>
                      ) : (
                        activeElectionsList.map(({ election, status }) => {
                          const activeMatch = activeElections.find(ae => ae.election.id === election.id);
                          return (
                            <div
                              key={election.id}
                              className="rounded-xl border-2 border-primary/20 bg-surface-container-lowest p-4 space-y-3 cursor-pointer hover:border-primary/40 hover:shadow-md transition-all"
                              onClick={() => setSelectedElectionId(election.id)}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="font-semibold text-on-surface">{election.title}</div>
                                  <div className="text-xs text-on-surface-variant mt-0.5 capitalize">{election.voteType.replace(/-/g, " ")}</div>
                                </div>
                                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">Open</span>
                              </div>
                              {election.description && (
                                <div className="text-sm text-on-surface-variant line-clamp-2">{election.description}</div>
                              )}
                              <div className="flex items-center gap-3 flex-wrap text-xs text-on-surface-variant">
                                {election.opensAt && <span>Opened {new Date(election.opensAt).toLocaleDateString()}</span>}
                                {election.closesAt && <span>Closes {new Date(election.closesAt).toLocaleDateString()}</span>}
                                {election.isSecretBallot ? <span className="text-amber-600">Secret ballot</span> : null}
                              </div>
                              <div className="flex items-center gap-3 pt-1">
                                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600">Not Voted</span>
                                {activeMatch?.token && (
                                  <a
                                    href={`/vote/${activeMatch.token}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-primary text-on-primary rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-primary/90 transition-colors"
                                  >
                                    <span className="material-symbols-outlined text-sm">how_to_vote</span>
                                    Vote Now
                                  </a>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </TabsContent>

                    {/* Upcoming Elections Tab */}
                    <TabsContent value="upcoming" className="mt-4 space-y-3">
                      {upcomingElectionsList.length === 0 ? (
                        <div className="text-center py-12 text-on-surface-variant text-sm">
                          <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 block mb-2">event_upcoming</span>
                          No upcoming elections scheduled.
                        </div>
                      ) : (
                        upcomingElectionsList.map(({ election }) => (
                          <div
                            key={election.id}
                            className="rounded-xl border bg-surface-container-lowest border-outline-variant/10 p-4 space-y-2 cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all"
                            onClick={() => setSelectedElectionId(election.id)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="font-semibold text-on-surface">{election.title}</div>
                                <div className="text-xs text-on-surface-variant mt-0.5 capitalize">{election.voteType.replace(/-/g, " ")}</div>
                              </div>
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700">Draft</span>
                            </div>
                            {election.description && (
                              <div className="text-sm text-on-surface-variant line-clamp-2">{election.description}</div>
                            )}
                            <div className="flex items-center gap-3 flex-wrap text-xs text-on-surface-variant">
                              {election.opensAt && <span>Opens {new Date(election.opensAt).toLocaleDateString()}</span>}
                              {election.closesAt && <span>Closes {new Date(election.closesAt).toLocaleDateString()}</span>}
                            </div>
                          </div>
                        ))
                      )}
                    </TabsContent>

                    {/* Past Elections Tab */}
                    <TabsContent value="past" className="mt-4 space-y-3">
                      {pastElectionsList.length === 0 ? (
                        <div className="text-center py-12 text-on-surface-variant text-sm">
                          <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 block mb-2">history</span>
                          No past elections on record.
                        </div>
                      ) : (
                        pastElectionsList.map(({ election, status, outcome }) => (
                          <div
                            key={election.id}
                            className="rounded-xl border bg-surface-container-lowest border-outline-variant/10 p-4 space-y-2 cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all"
                            onClick={() => setSelectedElectionId(election.id)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="font-semibold text-on-surface">{election.title}</div>
                                <div className="text-xs text-on-surface-variant mt-0.5 capitalize">{election.voteType.replace(/-/g, " ")}</div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                  election.status === "certified" ? "bg-blue-100 text-blue-700" :
                                  election.status === "closed" ? "bg-yellow-100 text-yellow-700" :
                                  election.status === "cancelled" ? "bg-red-100 text-red-700" :
                                  "bg-gray-100 text-gray-700"
                                }`}>{election.status}</span>
                              </div>
                            </div>
                            {election.description && (
                              <div className="text-sm text-on-surface-variant line-clamp-2">{election.description}</div>
                            )}
                            <div className="flex items-center gap-3 flex-wrap text-xs text-on-surface-variant">
                              {election.closesAt && <span>Closed {new Date(election.closesAt).toLocaleDateString()}</span>}
                              {election.isSecretBallot ? <span className="text-amber-600">Secret ballot</span> : null}
                            </div>
                            <div className="flex items-center gap-3 pt-1">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                status === "voted" ? "bg-green-100 text-green-700" :
                                status === "proxy-designated" ? "bg-blue-100 text-blue-700" :
                                "bg-gray-100 text-gray-600"
                              }`}>
                                {status === "voted" ? "Voted" : status === "proxy-designated" ? "Proxy Designated" : "Not Voted"}
                              </span>
                              {outcome && (
                                <span className="text-xs text-on-surface-variant">Result: {outcome}</span>
                              )}
                              {election.status === "certified" && election.resultVisibility === "public" && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setSelectedElectionId(election.id); }}
                                  className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium"
                                >
                                  <span className="material-symbols-outlined text-sm">bar_chart</span>
                                  View Results
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </TabsContent>

                    {/* My Voting History Tab */}
                    <TabsContent value="history" className="mt-4 space-y-4">
                      <div className="rounded-2xl border bg-surface-container-lowest border-outline-variant/10 p-5 space-y-4">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-primary">history</span>
                          <h3 className="font-headline text-lg text-on-surface">My Voting History</h3>
                        </div>
                        <p className="text-sm text-on-surface-variant">A complete record of all elections you were eligible to participate in.</p>

                        {electionHistory.length === 0 ? (
                          <div className="text-center py-8 text-on-surface-variant text-sm">
                            No election history available.
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-xs">Election</TableHead>
                                  <TableHead className="text-xs">Date</TableHead>
                                  <TableHead className="text-xs">Participation</TableHead>
                                  <TableHead className="text-xs">Outcome</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {electionHistory.map(({ election, status, outcome }) => (
                                  <TableRow key={election.id} className="cursor-pointer hover:bg-surface-container-low/50" onClick={() => setSelectedElectionId(election.id)}>
                                    <TableCell>
                                      <div className="font-medium text-sm text-on-surface">{election.title}</div>
                                      <div className="text-xs text-on-surface-variant capitalize">{election.voteType.replace(/-/g, " ")}</div>
                                    </TableCell>
                                    <TableCell className="text-sm text-on-surface-variant whitespace-nowrap">
                                      {election.closesAt ? new Date(election.closesAt).toLocaleDateString() : election.opensAt ? new Date(election.opensAt).toLocaleDateString() : "N/A"}
                                    </TableCell>
                                    <TableCell>
                                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                        status === "voted" ? "bg-green-100 text-green-700" :
                                        status === "proxy-designated" ? "bg-blue-100 text-blue-700" :
                                        "bg-gray-100 text-gray-600"
                                      }`}>
                                        {status === "voted" ? "Yes" : status === "proxy-designated" ? "Proxy" : "No"}
                                      </span>
                                    </TableCell>
                                    <TableCell className="text-xs text-on-surface-variant">
                                      {election.isSecretBallot ? (
                                        <span className="text-amber-600 italic">Secret ballot</span>
                                      ) : outcome ? (
                                        <span>{outcome}</span>
                                      ) : (
                                        <span className="text-on-surface-variant/60">--</span>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}

                        {/* Summary stats */}
                        {electionHistory.length > 0 && (
                          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-outline-variant/10">
                            <div className="text-center">
                              <p className="text-xl font-bold text-on-surface">{electionHistory.length}</p>
                              <p className="text-[10px] text-on-surface-variant uppercase tracking-widest">Total Elections</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xl font-bold text-green-600">{electionHistory.filter(e => e.status === "voted").length}</p>
                              <p className="text-[10px] text-on-surface-variant uppercase tracking-widest">Votes Cast</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xl font-bold text-on-surface">
                                {electionHistory.length > 0 ? Math.round((electionHistory.filter(e => e.status === "voted" || e.status === "proxy-designated").length / electionHistory.length) * 100) : 0}%
                              </p>
                              <p className="text-[10px] text-on-surface-variant uppercase tracking-widest">Participation Rate</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                </>
              )}
            </div>
          )}

          {activeTab === "communications" && (
            <div className="space-y-8">
              <div className="space-y-2">
                <p className="font-label text-primary uppercase tracking-widest text-[11px]">Communications</p>
                <h1 className="font-headline text-4xl text-on-surface">Board Communications</h1>
                <p className="text-sm text-on-surface-variant">{Object.values(boardDashboardData?.workflowStates.communications.noticesByStatus || {}).reduce((a, b) => a + b, 0)} notices</p>
              </div>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-on-surface mb-3">Notices</h3>
                  {Object.keys(boardDashboardData?.workflowStates.communications.noticesByStatus || {}).length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {Object.entries(boardDashboardData?.workflowStates.communications.noticesByStatus || {}).map(([status, count]) => (
                        <div key={status} className="rounded-lg border bg-surface-container-lowest border-outline-variant/10 p-3 text-center">
                          <p className="text-sm text-on-surface-variant capitalize">{status.replace("-", " ")}</p>
                          <p className="text-2xl font-bold text-on-surface">{count}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 space-y-2 text-on-surface-variant">
                      <p>No notices</p>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border bg-surface-container-lowest border-outline-variant/10 p-4">
                    <p className="text-xs text-on-surface-variant uppercase tracking-widest mb-2">Portal Documents</p>
                    <p className="text-2xl font-bold text-on-surface">{boardDashboardData?.workflowStates.communications.documentsPortalVisible || 0}</p>
                  </div>
                  <div className="rounded-lg border bg-surface-container-lowest border-outline-variant/10 p-4">
                    <p className="text-xs text-on-surface-variant uppercase tracking-widest mb-2">Internal Only</p>
                    <p className="text-2xl font-bold text-on-surface">{boardDashboardData?.workflowStates.communications.documentsInternalOnly || 0}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Mobile Tab Bar */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 bg-surface-bright border-t border-outline-variant/10 flex justify-around z-40 pb-safe">
          {[
            { id: "overview" as const, icon: "dashboard", label: "Overview", badge: 0 },
            { id: "maintenance" as const, icon: "build", label: "Maintenance", badge: openMaintenanceRequests },
            { id: "financials" as const, icon: "payments", label: "Pay", badge: 0 },
            { id: "documents" as const, icon: "description", label: "Docs", badge: 0 },
            { id: "notices" as const, icon: "notifications", label: "Updates", badge: unreadNoticesCount },
            { id: "elections" as const, icon: "how_to_vote", label: "Voting", badge: activeElections.length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center gap-1 px-2 py-3 transition-colors ${activeTab === tab.id ? "text-primary" : "text-on-surface-variant"}`}
            >
              <div className="relative">
                <span className="material-symbols-outlined text-xl">{tab.icon}</span>
                {tab.badge > 0 && (
                  <span className="absolute -top-1 -right-2 min-w-[14px] h-[14px] bg-destructive text-on-error text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
