import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { AnnualGovernanceTask, Association, BoardRole, CommunicationHistory, ContactUpdateRequest, Document, GovernanceMeeting, MaintenanceRequest, NoticeSend, OwnerLedgerEntry, Person, PortalAccess, VendorInvoice } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OwnerPortalLoginContainer } from "@/components/owner-portal-login-container";
import { OwnerInfoSection } from "@/components/owner-info-section";
import { useIsMobile } from "@/hooks/use-mobile";

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

function portalHeaders(portalAccessId: string | null) {
  return {
    "x-portal-access-id": portalAccessId ?? "",
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
  const [portalAccessId, setPortalAccessId] = useState<string | null>(() => window.localStorage.getItem("portalAccessId"));
  const [onboardingDismissed, setOnboardingDismissed] = useState<boolean>(() => {
    const key = `portal-onboarding-dismissed-${window.localStorage.getItem("portalAccessId") || ""}`;
    return window.localStorage.getItem(key) === "true";
  });
  const [maintenanceSuccess, setMaintenanceSuccess] = useState(false);
  const [contactUpdateSuccess, setContactUpdateSuccess] = useState(false);
  const [ownerInfoEditing, setOwnerInfoEditing] = useState(false);

  // [All state variables from original - keeping them for functionality]
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
  const [paymentFormOpen, setPaymentFormOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDescription, setPaymentDescription] = useState("HOA dues payment");
  const [paymentReceipt, setPaymentReceipt] = useState<{ amount: number; description: string; date: string; confirmationNumber?: string } | null>(null);
  const [activeSection, setActiveSection] = useState<"overview" | "maintenance" | "financials" | "documents" | "notices" | "profile">("overview");

  // Queries - simplified for demo
  const { data: me, refetch: refetchMe } = useQuery<PortalSession | null>({
    queryKey: ["portalMe", portalAccessId],
    enabled: !!portalAccessId,
    queryFn: async () => {
      const res = await fetch("/api/portal/me", { headers: portalHeaders(portalAccessId) });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: documents } = useQuery<Document[]>({
    queryKey: ["documents", portalAccessId],
    enabled: !!portalAccessId,
    queryFn: async () => {
      const res = await fetch("/api/portal/documents", { headers: portalHeaders(portalAccessId) });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: notices } = useQuery<PortalNoticeHistory[]>({
    queryKey: ["notices", portalAccessId],
    enabled: !!portalAccessId,
    queryFn: async () => {
      const res = await fetch("/api/portal/notices", { headers: portalHeaders(portalAccessId) });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: maintenanceRequests, refetch: refetchMaintenanceRequests } = useQuery<MaintenanceRequest[]>({
    queryKey: ["maintenanceRequests", portalAccessId],
    enabled: !!portalAccessId,
    queryFn: async () => {
      const res = await fetch("/api/portal/maintenance-requests", { headers: portalHeaders(portalAccessId) });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: financialDashboard } = useQuery<any>({
    queryKey: ["financialDashboard", portalAccessId],
    enabled: !!portalAccessId,
    queryFn: async () => {
      const res = await fetch("/api/portal/financial-dashboard", { headers: portalHeaders(portalAccessId) });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: ownerUnits } = useQuery<UnitBalance[]>({
    queryKey: ["ownerUnits", portalAccessId],
    enabled: !!portalAccessId,
    queryFn: async () => {
      const res = await fetch("/api/portal/my-units", { headers: portalHeaders(portalAccessId) });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Mutations
  const submitPayment = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/portal/payment", {
        method: "POST",
        headers: {
          ...portalHeaders(portalAccessId),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          amount: parseFloat(paymentAmount),
          description: paymentDescription,
        }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      setPaymentReceipt({
        amount: parseFloat(paymentAmount),
        description: paymentDescription,
        date: new Date().toLocaleDateString(),
        confirmationNumber: data.confirmationNumber,
      });
      setPaymentFormOpen(false);
      setPaymentAmount("");
      setPaymentDescription("HOA dues payment");
    },
  });

  const submitMaintenanceRequest = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/portal/maintenance-requests", {
        method: "POST",
        headers: {
          ...portalHeaders(portalAccessId),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: maintenanceTitle,
          description: maintenanceDescription,
          location: maintenanceLocation,
          category: maintenanceCategory,
          priority: maintenancePriority,
        }),
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
      refetchMaintenanceRequests?.();
    },
  });

  const submitContactUpdate = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/portal/contact-updates", {
        method: "POST",
        headers: {
          ...portalHeaders(portalAccessId),
          "content-type": "application/json",
        },
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
    onSuccess: () => {
      setRequestedPhone("");
      setRequestedMailingAddress("");
      setRequestedEmergencyContactName("");
      setRequestedEmergencyContactPhone("");
      setRequestedContactPreference("");
      setContactUpdateSuccess(true);
      setTimeout(() => setContactUpdateSuccess(false), 3000);
      refetchMe?.();
    },
  });

  const updateProfile = useMutation({
    mutationFn: async (updates: { phone?: string; email?: string }) => {
      const res = await fetch("/api/portal/me", {
        method: "PATCH",
        headers: {
          ...portalHeaders(portalAccessId),
          "content-type": "application/json",
        },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      refetchMe?.();
      setOwnerInfoEditing(false);
    },
  });

  if (!portalAccessId) {
    return <OwnerPortalLoginContainer onLoginSuccess={(accessId) => setPortalAccessId(accessId)} />;
  }

  // Calculate derived state
  const myUnits = ownerUnits || [];
  const openMaintenanceRequests = maintenanceRequests?.filter((r) => !["resolved", "closed", "rejected"].includes(r.status)) || [];
  const totalPortfolioBalance = myUnits.reduce((sum, unit) => sum + (unit.balance || 0), 0);

  // If viewing profile section, show just the profile content area
  if (activeSection === "profile") {
    return (
      <div className="bg-surface-container-low min-h-screen flex">
        {/* Sidebar Navigation - Desktop Only */}
        <aside className="hidden md:flex fixed left-0 top-0 h-screen w-64 border-r border-outline-variant/15 bg-surface flex-col py-8 px-4 z-40">
          <div className="mb-10 px-4">
            <h1 className="font-headline text-2xl text-primary italic">Owner Portal</h1>
            <p className="font-label uppercase tracking-widest text-[11px] text-on-surface-variant mt-1">Your Properties</p>
          </div>

          <nav className="flex-1 space-y-2">
            <button
              onClick={() => setActiveSection("overview")}
              className="w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all text-on-surface-variant hover:translate-x-1 hover:text-primary"
            >
              <span className="material-symbols-outlined">home</span>
              <span className="font-label uppercase tracking-widest text-[11px]">Overview</span>
            </button>
            <button
              onClick={() => setActiveSection("maintenance")}
              className="w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all text-on-surface-variant hover:translate-x-1 hover:text-primary"
            >
              <span className="material-symbols-outlined">build</span>
              <span className="font-label uppercase tracking-widest text-[11px]">Maintenance</span>
            </button>
            <button
              onClick={() => setActiveSection("financials")}
              className="w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all text-on-surface-variant hover:translate-x-1 hover:text-primary"
            >
              <span className="material-symbols-outlined">payments</span>
              <span className="font-label uppercase tracking-widest text-[11px]">Financials</span>
            </button>
            <button
              onClick={() => setActiveSection("documents")}
              className="w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all text-on-surface-variant hover:translate-x-1 hover:text-primary"
            >
              <span className="material-symbols-outlined">description</span>
              <span className="font-label uppercase tracking-widest text-[11px]">Documents</span>
            </button>
            <button
              onClick={() => setActiveSection("notices")}
              className="w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all text-on-surface-variant hover:translate-x-1 hover:text-primary"
            >
              <span className="material-symbols-outlined">notifications</span>
              <span className="font-label uppercase tracking-widest text-[11px]">Notices</span>
            </button>
          </nav>

          <nav className="border-t border-outline-variant/10 pt-4">
            <button
              onClick={() => setActiveSection("profile")}
              className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all ${
                activeSection === "profile"
                  ? "bg-surface-container-highest text-primary shadow-sm font-bold"
                  : "text-on-surface-variant hover:translate-x-1 hover:text-primary"
              }`}
            >
              <span className="material-symbols-outlined">person</span>
              <span className="font-label uppercase tracking-widest text-[11px]">My Profile</span>
            </button>
          </nav>

          <div className="mt-auto pt-6 border-t border-outline-variant/10 space-y-2 px-4">
            <button className="w-full bg-primary text-on-primary rounded-lg py-3 px-4 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-primary-container transition-colors">
              Contact Manager
            </button>
            <div className="flex flex-col gap-1 mt-4">
              <a href="#" className="text-on-surface-variant text-[11px] uppercase tracking-widest flex items-center gap-2 hover:text-primary">
                <span className="material-symbols-outlined text-sm">help_outline</span> Support
              </a>
              <a href="#" className="text-on-surface-variant text-[11px] uppercase tracking-widest flex items-center gap-2 hover:text-primary">
                <span className="material-symbols-outlined text-sm">logout</span> Logout
              </a>
            </div>
          </div>
        </aside>

        <OwnerInfoSection portalAccessId={portalAccessId} />

        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden fixed bottom-0 left-0 w-full bg-surface-bright/90 backdrop-blur-2xl flex justify-around items-center px-4 pb-6 pt-3 z-50 rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.05)] border-t border-outline-variant/10">
          <button
            onClick={() => setActiveSection("overview")}
            className="flex flex-col items-center justify-center rounded-xl px-4 py-2 text-on-surface-variant"
          >
            <span className="material-symbols-outlined">home</span>
            <span className="font-body text-[10px] mt-1">Home</span>
          </button>
          <button
            onClick={() => setActiveSection("maintenance")}
            className="flex flex-col items-center justify-center rounded-xl px-4 py-2 text-on-surface-variant"
          >
            <span className="material-symbols-outlined">build</span>
            <span className="font-body text-[10px] mt-1">Maintenance</span>
          </button>
          <button
            onClick={() => setActiveSection("financials")}
            className="flex flex-col items-center justify-center rounded-xl px-4 py-2 text-on-surface-variant"
          >
            <span className="material-symbols-outlined">payments</span>
            <span className="font-body text-[10px] mt-1">Financials</span>
          </button>
          <button
            onClick={() => setActiveSection("profile")}
            className={`flex flex-col items-center justify-center rounded-xl px-4 py-2 ${
              activeSection === "profile" ? "text-primary bg-primary/10" : "text-on-surface-variant"
            }`}
          >
            <span className="material-symbols-outlined">person</span>
            <span className="font-body text-[10px] mt-1">Profile</span>
          </button>
        </nav>
      </div>
    );
  }

  return (
    <div className="bg-surface-container-low min-h-screen flex">
      {/* Sidebar Navigation - Desktop Only */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-64 border-r border-outline-variant/15 bg-surface flex-col py-8 px-4 z-40">
        <div className="mb-10 px-4">
          <h1 className="font-headline text-2xl text-primary italic">Owner Portal</h1>
          <p className="font-label uppercase tracking-widest text-[11px] text-on-surface-variant mt-1">Your Properties</p>
        </div>

        <nav className="flex-1 space-y-2">
          <button onClick={() => setActiveSection("overview")} className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all ${activeSection === "overview" ? "bg-surface-container-highest text-primary shadow-sm font-bold" : "text-on-surface-variant hover:translate-x-1 hover:text-primary"}`}>
            <span className="material-symbols-outlined">home</span>
            <span className="font-label uppercase tracking-widest text-[11px]">Overview</span>
          </button>
          <button onClick={() => setActiveSection("maintenance")} className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all ${activeSection === "maintenance" ? "bg-surface-container-highest text-primary shadow-sm font-bold" : "text-on-surface-variant hover:translate-x-1 hover:text-primary"}`}>
            <span className="material-symbols-outlined">build</span>
            <span className="font-label uppercase tracking-widest text-[11px]">Maintenance</span>
          </button>
          <button onClick={() => setActiveSection("financials")} className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all ${activeSection === "financials" ? "bg-surface-container-highest text-primary shadow-sm font-bold" : "text-on-surface-variant hover:translate-x-1 hover:text-primary"}`}>
            <span className="material-symbols-outlined">payments</span>
            <span className="font-label uppercase tracking-widest text-[11px]">Financials</span>
          </button>
          <button onClick={() => setActiveSection("documents")} className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all ${activeSection === "documents" ? "bg-surface-container-highest text-primary shadow-sm font-bold" : "text-on-surface-variant hover:translate-x-1 hover:text-primary"}`}>
            <span className="material-symbols-outlined">description</span>
            <span className="font-label uppercase tracking-widest text-[11px]">Documents</span>
          </button>
          <button onClick={() => setActiveSection("notices")} className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all ${activeSection === "notices" ? "bg-surface-container-highest text-primary shadow-sm font-bold" : "text-on-surface-variant hover:translate-x-1 hover:text-primary"}`}>
            <span className="material-symbols-outlined">notifications</span>
            <span className="font-label uppercase tracking-widest text-[11px]">Notices</span>
          </button>
        </nav>

        <div className="mt-auto pt-6 border-t border-outline-variant/10 space-y-2 px-4">
          <button className="w-full bg-primary text-on-primary rounded-lg py-3 px-4 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-primary-container transition-colors">
            Contact Manager
          </button>
          <div className="flex flex-col gap-1 mt-4">
            <a href="#" className="text-on-surface-variant text-[11px] uppercase tracking-widest flex items-center gap-2 hover:text-primary">
              <span className="material-symbols-outlined text-sm">help_outline</span> Support
            </a>
            <a href="#" className="text-on-surface-variant text-[11px] uppercase tracking-widest flex items-center gap-2 hover:text-primary">
              <span className="material-symbols-outlined text-sm">logout</span> Logout
            </a>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="md:ml-64 w-full pt-24 md:pt-20 pb-20 px-4 md:px-8 max-w-7xl mx-auto">
        {/* Header */}
        <header className="fixed top-0 right-0 left-0 md:left-64 bg-surface-bright/80 dark:bg-slate-900/80 backdrop-blur-xl z-50 shadow-sm border-b border-outline-variant/10">
          <div className="flex justify-between items-center px-4 md:px-8 py-4">
            <div className="flex items-center gap-4">
              <span className="md:hidden font-headline italic text-xl text-on-surface">Portal</span>
              <h2 className="hidden md:block font-headline text-2xl text-on-surface">Owner Portal</h2>
            </div>
            <div className="flex items-center gap-3 md:gap-6">
              <button className="text-on-surface-variant hover:text-primary transition-colors">
                <span className="material-symbols-outlined">notifications</span>
              </button>
              <div className="flex items-center gap-2 md:gap-3 cursor-pointer min-w-0">
                <div className="w-8 h-8 rounded-full bg-secondary-container flex-shrink-0 flex items-center justify-center overflow-hidden">
                  <span className="material-symbols-outlined text-on-secondary text-sm">person</span>
                </div>
                <span className="font-label text-[11px] uppercase tracking-widest font-bold text-on-surface truncate max-w-[200px] md:max-w-none">{me?.email || "Owner"}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Hero Stats Section */}
        <section className="mb-12">
          <p className="font-label text-primary uppercase tracking-widest text-[11px] mb-2">Welcome back</p>
          <h1 className="font-headline text-4xl md:text-5xl text-on-surface mb-4">Your property portfolio</h1>

          <div className="flex flex-wrap gap-4 mt-8">
            <div className="bg-surface-container-lowest p-6 rounded-xl flex-1 min-w-[280px]">
              <p className="font-label text-on-surface-variant uppercase tracking-widest text-[10px] mb-1">Total Portfolio Value</p>
              <div className="flex items-end gap-3">
                <span className="font-headline text-3xl">{myUnits.length} Units</span>
              </div>
            </div>
            <div className={`bg-surface-container-lowest p-6 rounded-xl flex-1 min-w-[280px] ${totalPortfolioBalance > 0 ? 'border border-destructive' : ''}`}>
              <p className="font-label text-on-surface-variant uppercase tracking-widest text-[10px] mb-1">Account Balance</p>
              <div className="flex items-end gap-3">
                <span className={`font-headline text-3xl ${totalPortfolioBalance > 0 ? 'text-destructive' : 'text-secondary'}`}>
                  {totalPortfolioBalance > 0 ? `$${totalPortfolioBalance.toFixed(2)} due` : totalPortfolioBalance < 0 ? `Credit $${Math.abs(totalPortfolioBalance).toFixed(2)}` : "$0.00"}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
          {/* Attention Required - Left Column */}
          <section className="lg:col-span-7 space-y-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-headline text-2xl">Attention Required</h3>
            </div>

            <div className="space-y-4">
              {openMaintenanceRequests.length > 0 ? (
                openMaintenanceRequests.slice(0, 3).map((req) => (
                  <div key={req.id} className="bg-surface-container-lowest p-5 rounded-xl flex gap-5 items-start relative overflow-hidden border border-outline-variant/10">
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${req.priority === 'urgent' ? 'bg-destructive' : req.priority === 'high' ? 'bg-tertiary' : 'bg-secondary-container'}`}></div>
                    <div className={`w-12 h-12 ${req.priority === 'urgent' ? 'bg-destructive/10' : req.priority === 'high' ? 'bg-tertiary-fixed' : 'bg-secondary-fixed'} rounded-lg flex items-center justify-center shrink-0`}>
                      <span className="material-symbols-outlined">build</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1 flex-wrap gap-2">
                        <h4 className="font-body font-bold text-on-surface">{req.title}</h4>
                        {req.priority === 'urgent' && (
                          <span className="bg-destructive text-white text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-tighter">Urgent</span>
                        )}
                      </div>
                      <p className="text-sm text-on-surface-variant mb-2">{req.description}</p>
                      <Button size="sm" variant="default">Review Request</Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/10 text-center text-on-surface-variant">
                  <p className="text-sm">No maintenance requests at this time.</p>
                </div>
              )}

              {notices && notices.length > 0 && (
                <div className="bg-surface-container-lowest p-5 rounded-xl flex gap-5 items-start relative overflow-hidden border border-outline-variant/10">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-secondary-container"></div>
                  <div className="w-12 h-12 bg-secondary-fixed rounded-lg flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined">notifications</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-body font-bold text-on-surface">{notices.length} New Notices</h4>
                    <p className="text-sm text-on-surface-variant mt-1">You have unread property notices requiring attention.</p>
                    <Button size="sm" variant="outline" className="mt-3">View Notices</Button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Portfolio Snapshot - Right Column */}
          <section className="lg:col-span-5">
            <div className="bg-primary text-white p-8 rounded-2xl relative overflow-hidden shadow-xl">
              <div className="absolute -right-12 -top-12 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
              <h3 className="font-headline text-2xl mb-6 relative z-10">Portfolio Snapshot</h3>
              <div className="grid grid-cols-2 gap-y-6 relative z-10">
                <div>
                  <p className="font-label text-on-primary opacity-80 uppercase tracking-widest text-[10px] mb-1">Total Units</p>
                  <span className="text-2xl font-headline">{myUnits.length} Units</span>
                </div>
                <div>
                  <p className="font-label text-on-primary opacity-80 uppercase tracking-widest text-[10px] mb-1">Open Maintenance</p>
                  <span className="text-2xl font-headline">{openMaintenanceRequests.length}</span>
                </div>
                <div>
                  <p className="font-label text-on-primary opacity-80 uppercase tracking-widest text-[10px] mb-1">Documents</p>
                  <span className="text-2xl font-headline">{documents?.length || 0}</span>
                </div>
                <div>
                  <p className="font-label text-on-primary opacity-80 uppercase tracking-widest text-[10px] mb-1">Recent Notices</p>
                  <span className="text-2xl font-headline">{notices?.length || 0}</span>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/5 mt-8">
              <h3 className="font-headline text-xl mb-6">Recent Activity</h3>
              <div className="space-y-6">
                {maintenanceRequests && maintenanceRequests.slice(0, 4).map((req) => (
                  <div key={req.id} className="flex gap-4">
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0"></div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-on-surface">{req.title}</p>
                      <p className="text-xs text-on-surface-variant">{new Date(req.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="w-full mt-8">View Full History</Button>
            </div>
          </section>
        </div>

        {/* Quick Actions Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-surface-container-lowest p-8 rounded-2xl flex flex-col justify-between border border-outline-variant/10">
            <div>
              <h4 className="font-headline text-2xl mb-4">Make a Payment</h4>
              <p className="text-sm text-on-surface-variant">Pay your outstanding balance or set up autopay.</p>
            </div>
            <Button
              className="mt-4 w-full"
              onClick={() => setPaymentFormOpen(true)}
              disabled={submitPayment.isPending}
            >
              {submitPayment.isPending ? "Processing..." : "Pay Now"}
            </Button>
            {paymentReceipt && (
              <div className="mt-3 text-sm text-secondary p-2 bg-secondary/10 rounded">
                Payment confirmed: ${paymentReceipt.amount} on {paymentReceipt.date}
              </div>
            )}
          </div>

          <div className="bg-surface-container-lowest p-8 rounded-2xl flex flex-col justify-between border border-outline-variant/10">
            <div>
              <h4 className="font-headline text-2xl mb-4">View Documents</h4>
              <p className="text-sm text-on-surface-variant">Review association documents and disclosures.</p>
            </div>
            <Button variant="outline" className="mt-4 w-full" disabled={!documents || documents.length === 0}>
              View {documents?.length || 0} Docs
            </Button>
          </div>

          <div className="bg-surface-container-lowest p-8 rounded-2xl flex flex-col justify-between border border-outline-variant/10">
            <div>
              <h4 className="font-headline text-2xl mb-4">Report Maintenance</h4>
              <p className="text-sm text-on-surface-variant">Submit a maintenance request for your unit.</p>
            </div>
            <Button
              variant="outline"
              className="mt-4 w-full"
              onClick={() => {
                // Show maintenance modal/form
                setMaintenanceTitle("");
                setMaintenanceDescription("");
                setMaintenanceLocation("");
              }}
            >
              Report Issue
            </Button>
            {maintenanceSuccess && (
              <div className="mt-3 text-sm text-secondary p-2 bg-secondary/10 rounded">
                Maintenance request submitted successfully
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Payment Modal */}
      {paymentFormOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-6">
              <h3 className="font-headline text-2xl mb-4">Make a Payment</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold mb-2">Amount ($)</label>
                  <Input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">Description</label>
                  <Input
                    type="text"
                    value={paymentDescription}
                    onChange={(e) => setPaymentDescription(e.target.value)}
                    placeholder="HOA dues payment"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setPaymentFormOpen(false);
                      setPaymentAmount("");
                      setPaymentDescription("HOA dues payment");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => submitPayment.mutate()}
                    disabled={!paymentAmount || parseFloat(paymentAmount) <= 0 || submitPayment.isPending}
                  >
                    {submitPayment.isPending ? "Processing..." : "Submit Payment"}
                  </Button>
                </div>
                {submitPayment.isError && (
                  <div className="text-sm text-destructive p-2 bg-destructive/10 rounded">
                    Payment failed. Please try again.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-surface-bright/90 backdrop-blur-2xl flex justify-around items-center px-4 pb-6 pt-3 z-50 rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.05)] border-t border-outline-variant/10">
        <button onClick={() => setActiveSection("overview")} className={`flex flex-col items-center justify-center rounded-xl px-4 py-2 ${activeSection === "overview" ? "text-primary bg-primary/10" : "text-on-surface-variant"}`}>
          <span className="material-symbols-outlined">home</span>
          <span className="font-body text-[10px] mt-1">Home</span>
        </button>
        <button onClick={() => setActiveSection("maintenance")} className={`flex flex-col items-center justify-center rounded-xl px-4 py-2 ${activeSection === "maintenance" ? "text-primary bg-primary/10" : "text-on-surface-variant"}`}>
          <span className="material-symbols-outlined">build</span>
          <span className="font-body text-[10px] mt-1">Maintenance</span>
        </button>
        <button onClick={() => setActiveSection("financials")} className={`flex flex-col items-center justify-center rounded-xl px-4 py-2 ${activeSection === "financials" ? "text-primary bg-primary/10" : "text-on-surface-variant"}`}>
          <span className="material-symbols-outlined">payments</span>
          <span className="font-body text-[10px] mt-1">Financials</span>
        </button>
        <button onClick={() => setActiveSection("notices")} className={`flex flex-col items-center justify-center rounded-xl px-4 py-2 ${activeSection === "notices" ? "text-primary bg-primary/10" : "text-on-surface-variant"}`}>
          <span className="material-symbols-outlined">person</span>
          <span className="font-body text-[10px] mt-1">Profile</span>
        </button>
      </nav>
    </div>
  );
}
