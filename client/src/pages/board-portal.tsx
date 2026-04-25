// zone: Home
// persona: Board Officer, Assisted Board
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Election } from "@shared/schema";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { getScrollBehavior } from "@/lib/prefers-reduced-motion";

type BoardDashboard = any;
type AssociationOverview = any;
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type PortalSession = {
  hasBoardAccess: boolean;
  effectiveRole: string;
  boardRoleId: string | null;
  email: string;
};

// Portal OTP flow
interface BoardPortalViaPortalProps {
  portalAccessId: string;
  associationId?: never;
  associationName?: string;
  me: PortalSession | null;
  onLogout?: () => void;
}

// Google session flow
interface BoardPortalViaSessionProps {
  associationId: string;
  associationName?: string;
  portalAccessId?: never;
  me?: null;
  onLogout?: () => void;
}

type BoardPortalProps = BoardPortalViaPortalProps | BoardPortalViaSessionProps;

const SECTIONS = ["overview", "financial", "governance", "maintenance", "documents", "communications"] as const;
type Section = typeof SECTIONS[number];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function SidebarNavItem({
  id, icon, label, activeSection, scrollTo,
}: {
  id: Section; icon: string; label: string; activeSection: Section; scrollTo: (s: Section) => void;
}) {
  return (
    <button
      onClick={() => scrollTo(id)}
      className={`w-full px-4 py-2.5 rounded-lg flex items-center gap-3 transition-colors text-left ${
        activeSection === id
          ? "bg-primary/10 text-primary font-semibold"
          : "text-on-surface-variant hover:bg-surface-container hover:text-primary"
      }`}
    >
      <span className="material-symbols-outlined text-xl">{icon}</span>
      <span className="font-label uppercase tracking-widest text-[11px]">{label}</span>
    </button>
  );
}

function SidebarSubLink({ icon, label, href }: { icon: string; label: string; href: string }) {
  return (
    <a
      href={href}
      className="flex items-center gap-2 px-3 py-1.5 rounded-md text-on-surface-variant/70 hover:bg-surface-container hover:text-primary transition-colors"
    >
      <span className="material-symbols-outlined text-sm">{icon}</span>
      <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
    </a>
  );
}

function SidebarContents({
  activeSection,
  scrollTo,
  isSessionMode,
  associationId,
  onLogout,
}: {
  activeSection: Section;
  scrollTo: (s: Section) => void;
  isSessionMode: boolean;
  associationId?: string;
  onLogout?: () => void;
}) {
  return (
    <>
      <div className="mb-10 px-4">
        <h1 className="text-2xl font-semibold tracking-tight text-primary font-serif italic">Your Condo Manager</h1>
        <p className="text-[10px] text-on-surface-variant/60 italic mt-0.5">Community management, elevated.</p>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto pr-1">
        <SidebarNavItem id="overview" icon="dashboard" label="Overview" activeSection={activeSection} scrollTo={scrollTo} />

        <SidebarNavItem id="financial" icon="account_balance" label="Financial" activeSection={activeSection} scrollTo={scrollTo} />
        {isSessionMode && (
          <div className="pl-8 space-y-0.5 mb-1">
            <SidebarSubLink icon="receipt_long" label="Budgets" href="/app/financial/budgets" />
            <SidebarSubLink icon="summarize" label="Reports" href="/app/financial/reports" />
            <SidebarSubLink icon="balance" label="Reconciliation" href="/app/financial/reconciliation" />
          </div>
        )}

        <SidebarNavItem id="governance" icon="gavel" label="Governance" activeSection={activeSection} scrollTo={scrollTo} />
        {isSessionMode && (
          <div className="pl-8 space-y-0.5 mb-1">
            <SidebarSubLink icon="event" label="Meetings" href="/app/governance/meetings" />
            <SidebarSubLink icon="folder_shared" label="Board Packages" href="/app/governance/board-packages" />
            <SidebarSubLink icon="security" label="Insurance" href="/app/insurance" />
          </div>
        )}

        <SidebarNavItem id="maintenance" icon="build" label="Maintenance" activeSection={activeSection} scrollTo={scrollTo} />
        {isSessionMode && (
          <div className="pl-8 space-y-0.5 mb-1">
            <SidebarSubLink icon="handyman" label="Work Orders" href="/app/work-orders" />
            <SidebarSubLink icon="calendar_month" label="Schedules" href="/app/maintenance-schedules" />
            <SidebarSubLink icon="fact_check" label="Inspections" href="/app/inspections" />
          </div>
        )}

        <SidebarNavItem id="documents" icon="description" label="Documents" activeSection={activeSection} scrollTo={scrollTo} />

        <SidebarNavItem id="communications" icon="mail" label="Communications" activeSection={activeSection} scrollTo={scrollTo} />
        {isSessionMode && (
          <div className="pl-8 space-y-0.5 mb-1">
            <SidebarSubLink icon="campaign" label="Announcements" href="/app/announcements" />
            <SidebarSubLink icon="feedback" label="Resident Feedback" href="/app/resident-feedback" />
          </div>
        )}

        {associationId && (
          <a
            href={`/community/${associationId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">language</span>
            <span className="font-label uppercase tracking-widest text-[11px]">Community Hub</span>
          </a>
        )}
      </nav>

      <div className="mt-auto pt-6 border-t border-outline-variant/10 space-y-2 px-4">
        <a
          href="mailto:support@yourcondomanager.org"
          className="w-full bg-primary text-on-primary rounded-lg py-3 px-4 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
        >
          <span className="material-symbols-outlined text-sm">support_agent</span>
          Support
        </a>
        <button
          onClick={onLogout}
          className="w-full text-on-surface-variant text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:text-primary py-2 transition-colors"
        >
          <span className="material-symbols-outlined text-sm">logout</span>
          Logout
        </button>
      </div>
    </>
  );
}

export function BoardPortal({ portalAccessId, associationId, associationName, me, onLogout }: BoardPortalProps) {
  useDocumentTitle("Home");
  const isSessionMode = !!associationId;
  const [activeSection, setActiveSection] = useState<Section>("overview");
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    SECTIONS.forEach((id) => {
      const el = document.getElementById(`section-${id}`);
      if (!el) return;
      const observer = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSection(id); },
        { threshold: 0.15, rootMargin: "-80px 0px 0px 0px" }
      );
      observer.observe(el);
      observers.push(observer);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  function scrollTo(section: Section) {
    const el = document.getElementById(`section-${section}`);
    if (el) el.scrollIntoView({ behavior: getScrollBehavior(), block: "start" });
    setActiveSection(section);
    setMobileDrawerOpen(false);
  }

  const dashboardQueryKey = isSessionMode
    ? ["boardDashboard", "session", associationId]
    : ["boardDashboard", portalAccessId];

  const overviewQueryKey = isSessionMode
    ? ["boardOverview", "session", associationId]
    : ["boardOverview", portalAccessId];

  const { data: boardDashboard, isLoading: boardLoading, error: boardError } = useQuery<BoardDashboard | null>({
    queryKey: dashboardQueryKey,
    enabled: isSessionMode ? !!associationId : !!portalAccessId,
    queryFn: async () => {
      const url = isSessionMode
        ? `/api/board/dashboard?associationId=${associationId}`
        : "/api/portal/board/dashboard";
      const res = await fetch(url, {
        credentials: "include",
        headers: isSessionMode ? {} : { "x-portal-access-id": portalAccessId! },
      });
      if (!res.ok) throw new Error(`Failed to load board dashboard: ${res.status} ${await res.text()}`);
      return res.json();
    },
  });

  const { data: overview, isLoading: overviewLoading, error: overviewError } = useQuery<AssociationOverview | null>({
    queryKey: overviewQueryKey,
    enabled: isSessionMode ? !!associationId : !!portalAccessId,
    queryFn: async () => {
      const url = isSessionMode
        ? `/api/board/overview?associationId=${associationId}`
        : "/api/portal/board/overview";
      const res = await fetch(url, {
        credentials: "include",
        headers: isSessionMode ? {} : { "x-portal-access-id": portalAccessId! },
      });
      if (!res.ok) throw new Error(`Failed to load board overview: ${res.status} ${await res.text()}`);
      return res.json();
    },
  });

  // Board-only elections with pending votes for this board member
  const { data: boardPendingElections } = useQuery<Array<{ election: Election; token: string }>>({
    queryKey: ["boardPendingElections", portalAccessId],
    enabled: !isSessionMode && !!portalAccessId,
    queryFn: async () => {
      const res = await fetch("/api/portal/elections/board-pending", {
        credentials: "include",
        headers: { "x-portal-access-id": portalAccessId! },
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Certified election archive
  const { data: electionArchive } = useQuery<Array<{ election: Election; participationPercent: number; outcome: string | null }>>({
    queryKey: ["electionArchive", portalAccessId],
    enabled: !isSessionMode && !!portalAccessId,
    queryFn: async () => {
      const res = await fetch("/api/portal/elections/archive", {
        credentials: "include",
        headers: { "x-portal-access-id": portalAccessId! },
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Recently certified board elections (roster update prompt)
  const { data: certifiedBoardElections } = useQuery<Election[]>({
    queryKey: ["certifiedBoardElections", portalAccessId],
    enabled: !isSessionMode && !!portalAccessId,
    queryFn: async () => {
      const res = await fetch("/api/portal/elections/board-certified", {
        credentials: "include",
        headers: { "x-portal-access-id": portalAccessId! },
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const mobileTabItems: { id: Section; icon: string; label: string }[] = [
    { id: "overview",       icon: "dashboard",       label: "Overview" },
    { id: "financial",      icon: "account_balance", label: "Financial" },
    { id: "governance",     icon: "gavel",           label: "Governance" },
    { id: "maintenance",    icon: "build",           label: "Maint." },
    { id: "documents",      icon: "description",     label: "Docs" },
    { id: "communications", icon: "mail",            label: "Comms" },
  ];

  return (
    <div className="bg-surface-container-low min-h-screen flex flex-col">
      {/* Wave 31 a11y: skip-link target lets keyboard users reach the board-portal main content. */}
      <a
        href="#board-portal-main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:bg-white focus:text-primary focus:px-4 focus:py-2 focus:rounded focus:shadow-md focus:font-bold"
      >
        Skip to main content
      </a>
      {/* Fixed Header */}
      <header className="fixed top-0 right-0 left-0 md:left-64 z-50 bg-white/80 backdrop-blur-xl shadow-sm">
        <div className="flex justify-between items-center px-4 md:px-8 py-4">
          <div>
            <h2 className="font-headline text-2xl text-on-surface">
              {associationName ? `${associationName} — Board Portal` : "Board Portal"}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => scrollTo("communications")}
              className="text-on-surface-variant hover:text-primary transition-colors"
              title="Activity & Audit"
            >
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-sm">person</span>
            </div>
            <button
              onClick={() => isSessionMode ? window.location.assign("/app/financial/reports") : scrollTo("financial")}
              className="bg-primary text-on-primary px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity hidden md:block"
            >
              Monthly Report
            </button>
            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
              className="md:hidden text-on-surface-variant hover:text-primary transition-colors"
              aria-label="Open navigation menu"
            >
              <span className="material-symbols-outlined">{mobileDrawerOpen ? "close" : "menu"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileDrawerOpen(false)} />
          <div className="relative w-72 bg-surface-container-lowest h-full overflow-y-auto flex flex-col py-8 px-4 shadow-xl">
            <SidebarContents
              activeSection={activeSection}
              scrollTo={scrollTo}
              isSessionMode={isSessionMode}
              associationId={associationId}
              onLogout={onLogout}
            />
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-64 border-r border-outline-variant/15 bg-surface-container-lowest flex-col py-8 px-4 z-40">
        <SidebarContents
          activeSection={activeSection}
          scrollTo={scrollTo}
          isSessionMode={isSessionMode}
          associationId={associationId}
          onLogout={onLogout}
        />
      </aside>

      {/* Mobile Bottom Tab Bar */}
      <nav aria-label="Board portal sections" className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t border-outline-variant/20 flex items-center justify-around px-1 py-1.5">
        {mobileTabItems.map(({ id, icon, label }) => (
          <button
            key={id}
            onClick={() => scrollTo(id)}
            className={`flex flex-col items-center gap-0.5 px-1 py-1 rounded-lg transition-colors flex-1 ${
              activeSection === id ? "text-primary" : "text-on-surface-variant"
            }`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>{icon}</span>
            <span className="text-[8px] font-bold uppercase tracking-tight leading-tight">{label}</span>
          </button>
        ))}
      </nav>

      {/* Main Content */}
      <main id="board-portal-main-content" tabIndex={-1} ref={mainRef} className="md:ml-64 pt-20 pb-24 md:pb-8 px-4 md:px-8 flex-1">
        <div className="max-w-6xl mx-auto">
          {boardError || overviewError ? (
            <div className="flex items-center justify-center py-24">
              <div className="text-center">
                <p className="text-destructive font-bold mb-2">Error loading board dashboard</p>
                <p className="text-on-surface-variant text-sm mb-4">
                  {boardError?.message || overviewError?.message}
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-semibold"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : boardLoading || overviewLoading || !boardDashboard || !overview ? (
            <div className="flex items-center justify-center py-24">
              <p className="text-on-surface-variant">Loading board dashboard...</p>
            </div>
          ) : (
            <BoardDashboardContent
              boardDashboard={boardDashboard}
              overview={overview}
              associationName={associationName}
              isSessionMode={isSessionMode}
              me={me ?? null}
              scrollTo={scrollTo}
              boardPendingElections={boardPendingElections ?? []}
              electionArchive={electionArchive ?? []}
              certifiedBoardElections={certifiedBoardElections ?? []}
            />
          )}
        </div>
      </main>
    </div>
  );
}

interface BoardDashboardContentProps {
  boardDashboard: BoardDashboard;
  overview: AssociationOverview;
  associationName?: string;
  isSessionMode: boolean;
  me: PortalSession | null;
  scrollTo: (section: Section) => void;
  boardPendingElections: Array<{ election: Election; token: string }>;
  electionArchive: Array<{ election: Election; participationPercent: number; outcome: string | null }>;
  certifiedBoardElections: Election[];
}

function BoardDashboardContent({ boardDashboard, overview, associationName, isSessionMode, me, scrollTo, boardPendingElections, electionArchive, certifiedBoardElections }: BoardDashboardContentProps) {
  const [docSearch, setDocSearch] = useState("");
  const [showAllDocs, setShowAllDocs] = useState(false);

  const safeBoard = boardDashboard || {
    financial: {
      totalCharges: 100000,
      totalPayments: 96800,
      totalInvoices: 0,
      totalUtilities: 0,
      budgetCount: 0,
      ledgerEntryCount: 0,
      openBalance: 0,
      recentLedgerEntries: [],
      recentInvoices: [],
    },
    activity: { recent: [] },
    governance: { meetingCount: 0, upcomingMeetings: [], taskCount: 0, openTaskCount: 0, openTasks: [] },
    attention: { items: [], maintenanceOverdue: 0, overdueGovernanceTasks: 0, upcomingMeetingCount: 0, draftMeetingCount: 0, unpublishedDocumentCount: 0 },
    workflowStates: {
      communications: { documentsPortalVisible: 0, documentsInternalOnly: 0, noticesByStatus: {}, boardPackagesByStatus: { draft: 0, approved: 0, distributed: 0 } },
      governance: { meetingsByStatus: { scheduled: 0, "in-progress": 0, completed: 0, cancelled: 0 }, summariesByStatus: { draft: 0, published: 0 }, tasksByStatus: { todo: 0, "in-progress": 0, done: 0 } },
      maintenance: { requestsByStatus: { submitted: 0, triaged: 0, "in-progress": 0, resolved: 0, closed: 0, rejected: 0 }, urgentOpenCount: 0, recent: [] },
      access: { status: "active", effectiveRole: "board-member", boardRole: null, boardTerm: null }
    },
  } as any;

  const safeOverview = overview || {
    associationId: "Demo",
    units: 142,
    activeOwners: 135,
    activeOccupants: 140,
    maintenanceOpen: 5,
    maintenanceOverdue: 1,
    paymentMethodsActive: 120,
    onboardingState: "complete",
    onboardingScorePercent: 95,
    contactCoveragePercent: 98,
  };

  const operatingFund = safeBoard.financial.totalCharges - safeBoard.financial.totalPayments;
  const collectionRate = safeBoard.financial.totalCharges > 0
    ? (safeBoard.financial.totalPayments / safeBoard.financial.totalCharges) * 100
    : 0;
  const openBalance = safeBoard.financial.openBalance || 0;

  const recentActivity = safeBoard.activity.recent.slice(0, 5);
  const allDocActivity: any[] = safeBoard.activity.recent.filter((a: any) =>
    a.entityType?.toLowerCase().includes("document")
  );
  const shownDocActivity = showAllDocs ? allDocActivity : allDocActivity.slice(0, 5);
  const filteredDocs = docSearch
    ? shownDocActivity.filter((d: any) =>
        (d.summary || "").toLowerCase().includes(docSearch.toLowerCase()) ||
        (d.actorEmail || "").toLowerCase().includes(docSearch.toLowerCase())
      )
    : shownDocActivity;

  const { access } = safeBoard.workflowStates;
  const { maintenance } = safeBoard.workflowStates;
  const commsState = safeBoard.workflowStates.communications;
  const { attention } = safeBoard;

  const attentionCount =
    (attention.maintenanceOverdue || 0) +
    (attention.overdueGovernanceTasks || 0) +
    (attention.draftMeetingCount || 0) +
    (attention.unpublishedDocumentCount || 0) +
    (attention.items?.length || 0);

  const boardPackages = commsState.boardPackagesByStatus || { draft: 0, approved: 0, distributed: 0 };
  const noticesByStatus: Record<string, number> = commsState.noticesByStatus || {};
  const noticesTotalCount = Object.values(noticesByStatus).reduce((sum, v) => sum + v, 0);

  const maintenanceByStatus = maintenance.requestsByStatus || {};
  const maintenanceOpen =
    (maintenanceByStatus.submitted || 0) +
    (maintenanceByStatus.triaged || 0) +
    (maintenanceByStatus["in-progress"] || 0);
  const maintenanceUrgent = maintenance.urgentOpenCount || 0;
  const maintenanceRecent: any[] = (maintenance.recent || []).slice(0, 4);

  const openTasks: any[] = (safeBoard.governance.openTasks || []).slice(0, 5);
  const displayName = associationName || safeOverview.associationId;

  return (
    <>
      {/* Header Section */}
      <header id="section-overview" className="mb-8 scroll-mt-24">
        <span className="text-primary font-bold tracking-widest uppercase text-xs mb-3 block">
          Executive Board Dashboard
        </span>
        <h1 className="text-4xl md:text-5xl font-bold text-on-surface leading-tight font-headline">
          {displayName}
        </h1>
        <p className="text-on-surface-variant font-body text-lg mt-3 max-w-2xl">
          Administration and financial health overview.
        </p>
      </header>

      {/* Needs Attention Panel */}
      {attentionCount > 0 && (
        <div className="mb-8 bg-destructive-container/30 border border-destructive/20 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <span className="material-symbols-outlined text-destructive">warning</span>
            <h3 className="font-bold text-destructive">Needs Attention</h3>
            <Badge className="bg-destructive text-on-error text-[10px]">{attentionCount}</Badge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(attention.maintenanceOverdue || 0) > 0 && (
              <button
                onClick={() => scrollTo("maintenance")}
                className="p-3 bg-white/60 rounded-lg text-left hover:bg-white/90 transition-colors"
              >
                <p className="text-2xl font-bold text-destructive">{attention.maintenanceOverdue}</p>
                <p className="text-xs text-on-surface-variant font-semibold">Overdue Maintenance</p>
              </button>
            )}
            {(attention.overdueGovernanceTasks || 0) > 0 && (
              <button
                onClick={() => scrollTo("governance")}
                className="p-3 bg-white/60 rounded-lg text-left hover:bg-white/90 transition-colors"
              >
                <p className="text-2xl font-bold text-destructive">{attention.overdueGovernanceTasks}</p>
                <p className="text-xs text-on-surface-variant font-semibold">Overdue Gov. Tasks</p>
              </button>
            )}
            {(attention.draftMeetingCount || 0) > 0 && (
              <button
                onClick={() => scrollTo("governance")}
                className="p-3 bg-white/60 rounded-lg text-left hover:bg-white/90 transition-colors"
              >
                <p className="text-2xl font-bold text-amber-600">{attention.draftMeetingCount}</p>
                <p className="text-xs text-on-surface-variant font-semibold">Draft Meetings</p>
              </button>
            )}
            {(attention.unpublishedDocumentCount || 0) > 0 && (
              <button
                onClick={() => scrollTo("documents")}
                className="p-3 bg-white/60 rounded-lg text-left hover:bg-white/90 transition-colors"
              >
                <p className="text-2xl font-bold text-amber-600">{attention.unpublishedDocumentCount}</p>
                <p className="text-xs text-on-surface-variant font-semibold">Unpublished Docs</p>
              </button>
            )}
          </div>
          {attention.items?.length > 0 && (
            <div className="mt-3 space-y-1">
              {attention.items.slice(0, 3).map((item: any, idx: number) => (
                <div key={idx} className="flex items-center gap-2 text-sm text-on-surface-variant">
                  <span className="material-symbols-outlined text-sm text-destructive">error_outline</span>
                  {item.message || item.description || item.title || "Action required"}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">

        {/* Left Column */}
        <div className="md:col-span-8 space-y-8">

          {/* ── FINANCIAL SECTION ── */}
          <div id="section-financial" className="scroll-mt-24 space-y-4">
            {/* Financial Integrity Card */}
            <div className="bg-surface-container-lowest p-8 rounded-xl shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-10 transition-transform duration-700 group-hover:scale-110 group-hover:opacity-[0.15]">
                <span className="material-symbols-outlined text-8xl">account_balance</span>
              </div>
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="text-3xl font-bold mb-1 font-headline">Financial Integrity</h2>
                  <p className="text-on-surface-variant text-sm">Real-time treasury and collections overview.</p>
                </div>
                <span className="text-xs text-on-surface-variant font-bold uppercase tracking-tighter">
                  Updated just now
                </span>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-6">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-on-surface-variant">Operating Fund</p>
                  <p className="text-3xl font-bold text-primary tracking-tight">{formatCurrency(operatingFund)}</p>
                  <div className="flex items-center gap-1 text-emerald-600 text-xs font-bold">
                    <span className="material-symbols-outlined text-sm">trending_up</span>
                    2.4% vs last mo
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-on-surface-variant">Open Balance</p>
                  <p className={`text-3xl font-bold tracking-tight ${openBalance > 0 ? "text-destructive" : "text-emerald-600"}`}>
                    {formatCurrency(openBalance)}
                  </p>
                  <p className="text-xs text-on-surface-variant">Outstanding</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-on-surface-variant">Collection Rate</p>
                  <p className="text-3xl font-bold text-on-surface tracking-tight">{collectionRate.toFixed(1)}%</p>
                  <div className="w-full bg-surface-container rounded-full h-1.5 mt-2">
                    <div className="bg-primary h-1.5 rounded-full" style={{ width: `${Math.min(collectionRate, 100)}%` }} />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-on-surface-variant">Active Units</p>
                  <p className="text-3xl font-bold text-on-surface tracking-tight">{safeOverview.units}</p>
                  <p className="text-xs text-on-surface-variant">Total occupied</p>
                </div>
              </div>

              {/* Delinquency snapshot */}
              <div className="bg-surface-container rounded-lg px-5 py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-amber-600">warning_amber</span>
                  <span className="text-sm font-semibold text-on-surface-variant">Delinquency Snapshot</span>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-xs text-on-surface-variant">Overdue Units</p>
                    <p className="font-bold text-destructive text-sm">
                      {safeOverview.units > 0
                        ? Math.round(((100 - collectionRate) / 100) * safeOverview.units)
                        : 0}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-on-surface-variant">Est. Overdue</p>
                    <p className="font-bold text-destructive text-sm">{formatCurrency(openBalance)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-on-surface-variant">Rate</p>
                    <p className="font-bold text-amber-600 text-sm">{(100 - collectionRate).toFixed(1)}%</p>
                  </div>
                </div>
              </div>

              {/* Session-mode financial quick links */}
              {isSessionMode && (
                <div className="flex gap-4 mt-4">
                  <a href="/app/financial/budgets" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">receipt_long</span>Budgets
                  </a>
                  <a href="/app/financial/reports" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">summarize</span>Reports
                  </a>
                  <a href="/app/financial/reconciliation" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">balance</span>Reconciliation
                  </a>
                </div>
              )}
            </div>

            {/* Recent Ledger Entries */}
            {safeBoard.financial.recentLedgerEntries?.length > 0 && (
              <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-outline-variant/10 flex justify-between items-center">
                  <h3 className="font-bold text-base font-headline">Recent Transactions</h3>
                  {isSessionMode && (
                    <a href="/app/financial/ledger" className="text-primary text-xs font-semibold hover:underline">Full Ledger →</a>
                  )}
                </div>
                <div className="divide-y divide-outline-variant/10">
                  {safeBoard.financial.recentLedgerEntries.slice(0, 5).map((entry: any, idx: number) => (
                    <div key={entry.id || idx} className="px-6 py-3 flex items-center gap-4">
                      <div className="w-8 h-8 bg-surface-container rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-sm text-on-surface-variant">receipt</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{entry.description || entry.memo || "Ledger entry"}</p>
                        <p className="text-xs text-on-surface-variant">
                          {entry.category || entry.type || "—"} · {entry.date ? formatDate(entry.date) : "—"}
                        </p>
                      </div>
                      <p className={`text-sm font-bold flex-shrink-0 ${entry.amount < 0 ? "text-destructive" : "text-emerald-600"}`}>
                        {entry.amount != null ? formatCurrency(Math.abs(entry.amount)) : "—"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Invoices */}
            {safeBoard.financial.recentInvoices?.length > 0 && (
              <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-outline-variant/10 flex justify-between items-center">
                  <h3 className="font-bold text-base font-headline">Recent Invoices</h3>
                  {isSessionMode && (
                    <a href="/app/financial/invoices" className="text-primary text-xs font-semibold hover:underline">All Invoices →</a>
                  )}
                </div>
                <div className="divide-y divide-outline-variant/10">
                  {safeBoard.financial.recentInvoices.slice(0, 4).map((inv: any, idx: number) => (
                    <div key={inv.id || idx} className="px-6 py-3 flex items-center gap-4">
                      <div className="w-8 h-8 bg-amber-50 text-amber-700 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-sm">request_quote</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{inv.vendorName || inv.description || "Invoice"}</p>
                        <p className="text-xs text-on-surface-variant">{inv.dueDate ? `Due ${formatDate(inv.dueDate)}` : "—"}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold">{inv.amount != null ? formatCurrency(inv.amount) : "—"}</p>
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          inv.status === "paid" ? "bg-emerald-100 text-emerald-700" :
                          inv.status === "overdue" ? "bg-red-100 text-red-700" :
                          "bg-surface-container text-on-surface-variant"
                        }`}>{inv.status || "pending"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── GOVERNANCE SECTION ── */}
          <div id="section-governance" className="scroll-mt-24 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Board Tasks + Open Tasks List */}
              <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border-l-4 border-primary">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold font-headline">Board Tasks</h3>
                  <Badge className={`text-[10px] font-bold uppercase tracking-wider ${
                    safeBoard.governance.openTaskCount > 0
                      ? "bg-primary-fixed text-on-primary-fixed"
                      : "bg-secondary-container text-on-secondary-container"
                  }`}>
                    {safeBoard.governance.openTaskCount > 0 ? "Action Needed" : "Clear"}
                  </Badge>
                </div>
                <p className="text-sm text-on-surface-variant mb-3">
                  {safeBoard.governance.openTaskCount > 0
                    ? `${safeBoard.governance.openTaskCount} open task${safeBoard.governance.openTaskCount > 1 ? "s" : ""} require action`
                    : "No active tasks pending board action"}
                </p>
                {/* Open tasks list */}
                {openTasks.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {openTasks.map((task: any, idx: number) => (
                      <div key={task.id || idx} className="flex items-center gap-2 text-sm">
                        <span className={`material-symbols-outlined text-sm flex-shrink-0 ${
                          task.priority === "high" || task.priority === "critical" ? "text-destructive" : "text-amber-500"
                        }`}>
                          {task.status === "in-progress" ? "timelapse" : "radio_button_unchecked"}
                        </span>
                        <span className="flex-1 truncate font-medium">{task.title}</span>
                        {task.dueDate && (
                          <span className="text-xs text-on-surface-variant flex-shrink-0">{formatDate(task.dueDate)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex -space-x-2">
                    <div className="w-8 h-8 rounded-full bg-secondary-container border-2 border-white flex items-center justify-center text-xs font-bold text-on-secondary">BD</div>
                    <div className="w-8 h-8 rounded-full bg-primary-container border-2 border-white flex items-center justify-center text-xs font-bold text-on-primary-container">MB</div>
                    <div className="w-8 h-8 rounded-full bg-surface-container text-[10px] flex items-center justify-center font-bold text-on-surface-variant border-2 border-white">
                      +{Math.max(0, safeBoard.governance.meetingCount - 2)}
                    </div>
                  </div>
                  <span className="text-xs text-on-surface-variant">
                    {safeBoard.governance.meetingCount} meeting{safeBoard.governance.meetingCount !== 1 ? "s" : ""} on record
                  </span>
                </div>
                <Button
                  onClick={() => isSessionMode ? window.location.assign("/app/governance/meetings") : scrollTo("governance")}
                  className="w-full bg-primary-container text-on-primary-container py-3"
                >
                  View Governance
                </Button>
              </div>

              {/* Upcoming Meetings */}
              <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold font-headline">Upcoming Meetings</h3>
                    <Badge className="bg-secondary-container text-on-secondary-container text-[10px] font-bold uppercase tracking-wider">
                      {safeBoard.governance.upcomingMeetings.length > 0 ? "Scheduled" : "None"}
                    </Badge>
                  </div>
                  {safeBoard.governance.upcomingMeetings.length > 0 ? (
                    <div className="space-y-3">
                      {safeBoard.governance.upcomingMeetings.slice(0, 3).map((meeting: any, idx: number) => (
                        <div key={meeting.id || idx} className="flex items-center gap-3 text-sm">
                          <span className="material-symbols-outlined text-primary text-sm">event</span>
                          <div>
                            <p className="font-semibold">{meeting.title}</p>
                            <p className="text-xs text-on-surface-variant">{formatDate(meeting.scheduledAt)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-on-surface-variant">No upcoming meetings scheduled.</p>
                  )}
                </div>
                <button
                  onClick={() => isSessionMode ? window.location.assign("/app/governance/meetings") : scrollTo("governance")}
                  className="mt-4 flex items-center gap-2 text-primary font-bold text-sm hover:opacity-80 transition-opacity"
                >
                  View Meeting Schedule
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </div>
            </div>

            {/* Board Packages */}
            <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-xl font-bold font-headline">Board Packages</h3>
                  <p className="text-sm text-on-surface-variant mt-1">Meeting package distribution workflow</p>
                </div>
                <button
                  onClick={() => isSessionMode ? window.location.assign("/app/governance/board-packages") : scrollTo("governance")}
                  className="text-primary text-sm font-semibold hover:opacity-80 transition-opacity"
                >
                  View All →
                </button>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Draft",       count: boardPackages.draft || 0,       colorText: "text-on-surface-variant", bg: "bg-surface-container" },
                  { label: "Approved",    count: boardPackages.approved || 0,    colorText: "text-amber-600",          bg: "bg-amber-50" },
                  { label: "Distributed", count: boardPackages.distributed || 0, colorText: "text-emerald-600",        bg: "bg-emerald-50" },
                ].map(({ label, count, colorText, bg }) => (
                  <div key={label} className={`${bg} rounded-lg p-4 text-center`}>
                    <p className={`text-2xl font-bold ${colorText}`}>{count}</p>
                    <p className="text-xs text-on-surface-variant font-semibold uppercase tracking-wide mt-1">{label}</p>
                  </div>
                ))}
              </div>
              {isSessionMode && (
                <a
                  href="/app/governance/board-packages"
                  className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 border border-outline-variant/30 rounded-lg text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">folder_shared</span>
                  Manage Board Packages
                </a>
              )}
            </div>
          </div>

          {/* ── BOARD ELECTION CERTIFICATION PROMPT ── */}
          {certifiedBoardElections.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="material-symbols-outlined text-amber-600">how_to_reg</span>
                <h3 className="font-bold text-amber-800">Board Election Certified</h3>
              </div>
              {certifiedBoardElections.map((election) => (
                <div key={election.id} className="flex items-center justify-between gap-4 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-on-surface truncate">{election.title}</p>
                    <p className="text-xs text-amber-700">
                      Board election certified {election.certifiedAt ? formatDate(String(election.certifiedAt)) : "recently"} — update board roster?
                    </p>
                  </div>
                  <a
                    href={`/app/elections/${election.id}`}
                    className="flex-shrink-0 px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition-colors"
                  >
                    Review Results
                  </a>
                </div>
              ))}
              <p className="text-[10px] text-amber-600 mt-2 italic">
                Roster update from election results is available in the admin workspace.
              </p>
            </div>
          )}

          {/* ── PENDING VOTES (Board-Only Elections) ── */}
          {boardPendingElections.length > 0 && (
            <div className="bg-primary-container/30 border border-primary/20 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <span className="material-symbols-outlined text-primary">how_to_vote</span>
                <h3 className="font-bold text-primary">Pending Votes</h3>
                <Badge className="bg-primary text-on-primary text-[10px]">{boardPendingElections.length}</Badge>
              </div>
              <div className="space-y-3">
                {boardPendingElections.map(({ election, token }) => (
                  <div key={election.id} className="bg-white/60 rounded-lg p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-on-surface truncate">{election.title}</p>
                      {election.description && (
                        <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-2">{election.description}</p>
                      )}
                      <p className="text-xs text-on-surface-variant mt-1">
                        {election.closesAt
                          ? `Deadline: ${new Date(election.closesAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                          : "No deadline set"}
                      </p>
                    </div>
                    <a
                      href={`/vote/${token}`}
                      className="flex-shrink-0 px-5 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-bold hover:opacity-90 transition-opacity flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-sm">ballot</span>
                      Cast Vote
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── ELECTION ARCHIVE ── */}
          {electionArchive.length > 0 && (
            <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-outline-variant/10 flex items-center gap-3">
                <span className="material-symbols-outlined text-on-surface-variant">archive</span>
                <h3 className="font-bold text-base font-headline">Election Archive</h3>
                <Badge className="bg-secondary-container text-on-secondary-container text-[10px] font-bold">
                  {electionArchive.length} certified
                </Badge>
              </div>
              <div className="divide-y divide-outline-variant/10">
                {electionArchive.map(({ election, participationPercent, outcome }) => (
                  <div key={election.id} className="px-6 py-4 flex items-center gap-4 hover:bg-surface-container-low transition-colors">
                    <div className="w-10 h-10 bg-emerald-50 text-emerald-700 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined">
                        {election.voteType === "board-election" ? "groups" : "how_to_vote"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{election.title}</p>
                      <p className="text-xs text-on-surface-variant">
                        {election.voteType?.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                        {" · "}
                        {election.certifiedAt
                          ? new Date(election.certifiedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                          : "Certified"}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-on-surface">{participationPercent.toFixed(0)}%</p>
                      <p className="text-[10px] text-on-surface-variant font-semibold uppercase">Participation</p>
                    </div>
                    {outcome && (
                      <div className="text-right flex-shrink-0 max-w-[140px]">
                        <p className="text-xs font-semibold text-emerald-700 truncate">{outcome}</p>
                        <p className="text-[10px] text-on-surface-variant font-semibold uppercase">Outcome</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── MAINTENANCE SECTION ── */}
          <div id="section-maintenance" className="scroll-mt-24">
            <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold font-headline">Maintenance</h2>
                  <p className="text-on-surface-variant text-sm mt-1">Work orders and property upkeep status</p>
                </div>
                {isSessionMode && (
                  <a href="/app/work-orders" className="text-primary text-xs font-semibold hover:underline">Work Orders →</a>
                )}
              </div>

              {/* Status summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                {[
                  { label: "Open",        count: maintenanceOpen,                                                         color: maintenanceOpen > 0 ? "text-amber-600" : "text-emerald-600" },
                  { label: "Urgent",      count: maintenanceUrgent,                                                       color: maintenanceUrgent > 0 ? "text-destructive" : "text-on-surface-variant" },
                  { label: "In Progress", count: maintenanceByStatus["in-progress"] || 0,                                 color: "text-blue-600" },
                  { label: "Resolved",    count: (maintenanceByStatus.resolved || 0) + (maintenanceByStatus.closed || 0), color: "text-emerald-600" },
                ].map(({ label, count, color }) => (
                  <div key={label} className="bg-surface-container rounded-lg p-4 text-center">
                    <p className={`text-2xl font-bold ${color}`}>{count}</p>
                    <p className="text-xs text-on-surface-variant font-semibold uppercase tracking-wide mt-1">{label}</p>
                  </div>
                ))}
              </div>

              {/* Recent items */}
              {maintenanceRecent.length > 0 ? (
                <div className="divide-y divide-outline-variant/10">
                  {maintenanceRecent.map((item: any, idx: number) => (
                    <div key={item.id || idx} className="py-3 flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        item.priority === "urgent" || item.priority === "emergency" ? "bg-destructive" :
                        item.status === "in-progress" ? "bg-blue-500" : "bg-amber-400"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{item.title || item.description || "Maintenance request"}</p>
                        <p className="text-xs text-on-surface-variant">
                          {item.unitNumber ? `Unit ${item.unitNumber} · ` : ""}
                          {item.status || "submitted"} · {item.createdAt ? formatDate(item.createdAt) : "—"}
                        </p>
                      </div>
                      {(item.priority === "urgent" || item.priority === "emergency") && (
                        <Badge className="bg-destructive-container text-destructive text-[10px]">Urgent</Badge>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-on-surface-variant text-center py-4">No recent maintenance requests</p>
              )}

              {isSessionMode && (
                <div className="mt-4 flex gap-4">
                  <a href="/app/maintenance-schedules" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">calendar_month</span>Schedules
                  </a>
                  <a href="/app/inspections" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">fact_check</span>Inspections
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* ── DOCUMENTS SECTION ── */}
          <div id="section-documents" className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden scroll-mt-24">
            <div className="p-6 border-b border-outline-variant/10">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xl font-bold font-headline">Governance Documents</h3>
                {isSessionMode && (
                  <a href="/app/documents" className="text-primary text-sm font-semibold hover:opacity-80 transition-opacity">Library →</a>
                )}
              </div>
              {/* Search input */}
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
                <input
                  type="text"
                  placeholder="Search documents..."
                  value={docSearch}
                  onChange={(e) => setDocSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-surface-container rounded-lg text-sm border-none outline-none focus:ring-2 focus:ring-primary/30 text-on-surface placeholder:text-on-surface-variant/50"
                />
              </div>
            </div>
            <div className="divide-y divide-outline-variant/10">
              {filteredDocs.length > 0 ? (
                filteredDocs.map((doc: any, idx: number) => (
                  <div
                    key={`${doc.id}-${idx}`}
                    className="p-4 flex items-center gap-4 hover:bg-surface-container-low transition-colors group"
                  >
                    <div className="w-10 h-10 bg-blue-50 text-blue-700 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined">description</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">
                        {doc.summary || `Document Update – ${formatDate(doc.createdAt)}`}
                      </p>
                      <p className="text-xs text-on-surface-variant">
                        {doc.actorEmail || "Board Member"} · {formatDate(doc.createdAt)}
                      </p>
                    </div>
                    <span className="material-symbols-outlined text-outline-variant opacity-0 group-hover:opacity-100 transition-opacity">more_vert</span>
                  </div>
                ))
              ) : docSearch ? (
                <div className="p-8 text-center text-on-surface-variant text-sm">
                  No documents match &ldquo;{docSearch}&rdquo;
                </div>
              ) : (
                <>
                  <button onClick={() => isSessionMode ? window.location.assign("/app/documents") : undefined} className="w-full p-4 flex items-center gap-4 hover:bg-surface-container-low transition-colors group text-left">
                    <div className="w-10 h-10 bg-red-50 text-red-700 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined">picture_as_pdf</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold">Amended Bylaws – Article IV</p>
                      <p className="text-xs text-on-surface-variant">Revised by Legal Counsel · Oct 24, 2024</p>
                    </div>
                    <span className="material-symbols-outlined text-outline-variant opacity-0 group-hover:opacity-100 transition-opacity">open_in_new</span>
                  </button>
                  <button onClick={() => isSessionMode ? window.location.assign("/app/governance/meetings") : scrollTo("governance")} className="w-full p-4 flex items-center gap-4 hover:bg-surface-container-low transition-colors group text-left">
                    <div className="w-10 h-10 bg-blue-50 text-blue-700 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined">description</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold">Board Meeting Minutes – September</p>
                      <p className="text-xs text-on-surface-variant">Approved by Secretary · Oct 12, 2024</p>
                    </div>
                    <span className="material-symbols-outlined text-outline-variant opacity-0 group-hover:opacity-100 transition-opacity">open_in_new</span>
                  </button>
                  <button onClick={() => isSessionMode ? window.location.assign("/app/financial/reports") : scrollTo("financial")} className="w-full p-4 flex items-center gap-4 hover:bg-surface-container-low transition-colors group text-left">
                    <div className="w-10 h-10 bg-emerald-50 text-emerald-700 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined">table_chart</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold">Q3 Reserve Study Draft</p>
                      <p className="text-xs text-on-surface-variant">Uploaded by Financial Mgmt · Oct 05, 2024</p>
                    </div>
                    <span className="material-symbols-outlined text-outline-variant opacity-0 group-hover:opacity-100 transition-opacity">open_in_new</span>
                  </button>
                </>
              )}
              {allDocActivity.length > 5 && !docSearch && (
                <button
                  onClick={() => setShowAllDocs(!showAllDocs)}
                  className="w-full p-3 text-center text-primary text-sm font-semibold hover:bg-surface-container-low transition-colors"
                >
                  {showAllDocs ? "Show less" : `Show ${allDocActivity.length - 5} more documents`}
                </button>
              )}
            </div>
          </div>

          {/* ── COMMUNICATIONS SECTION ── */}
          <div id="section-communications" className="scroll-mt-24 space-y-4">
            {/* Notices by Status */}
            <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-xl font-bold font-headline">Notices & Communications</h3>
                  <p className="text-sm text-on-surface-variant mt-1">
                    {noticesTotalCount} notice{noticesTotalCount !== 1 ? "s" : ""} in system
                  </p>
                </div>
                {isSessionMode && (
                  <a href="/app/announcements" className="text-primary text-xs font-semibold hover:underline">Announcements →</a>
                )}
              </div>
              {Object.keys(noticesByStatus).length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {Object.entries(noticesByStatus).map(([status, count]) => (
                    <div key={status} className="bg-surface-container rounded-lg px-4 py-3 text-center min-w-[80px]">
                      <p className="text-xl font-bold text-on-surface">{count}</p>
                      <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider capitalize">{status}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-on-surface-variant">No notices on record.</p>
              )}
              {isSessionMode && (
                <div className="mt-4 flex gap-4">
                  <a href="/app/announcements" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">campaign</span>Announcements
                  </a>
                  <a href="/app/resident-feedback" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">feedback</span>Resident Feedback
                  </a>
                </div>
              )}
            </div>

            {/* Compliance & Audit Trail */}
            <div className="bg-surface-container-high p-6 rounded-xl shadow-sm">
              <h3 className="text-xl font-bold mb-6 font-headline">Compliance & Audit</h3>
              <div className="relative pl-6 space-y-8 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-[2px] before:bg-outline-variant/30">
                {recentActivity.length > 0 ? recentActivity.map((entry: any, idx: number) => (
                  <div key={entry.id} className="relative">
                    <div className={`absolute -left-[23px] top-1 w-3 h-3 rounded-full ring-4 ring-surface-container-high ${
                      idx === 0 ? "bg-primary" : "bg-outline-variant"
                    }`} />
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                      {formatDate(entry.createdAt)}
                    </p>
                    <p className="text-sm font-semibold mt-1">
                      {entry.summary || `${entry.action} – ${entry.entityType}`}
                    </p>
                    <p className="text-xs text-on-surface-variant mt-1 italic">
                      {entry.actorEmail || "System"}
                    </p>
                  </div>
                )) : (
                  <>
                    <div className="relative">
                      <div className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-primary ring-4 ring-surface-container-high" />
                      <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Today, 10:45 AM</p>
                      <p className="text-sm font-semibold mt-1">Admin verified bank reconciliation</p>
                      <p className="text-xs text-on-surface-variant mt-1 italic">Reference: TXN-99412-R</p>
                    </div>
                    <div className="relative">
                      <div className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-outline-variant ring-4 ring-surface-container-high" />
                      <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Yesterday, 4:20 PM</p>
                      <p className="text-sm font-semibold mt-1">Access key revoked: Vendor Alpha</p>
                      <p className="text-xs text-on-surface-variant mt-1">Maintenance contract expired</p>
                    </div>
                    <div className="relative">
                      <div className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-outline-variant ring-4 ring-surface-container-high" />
                      <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Oct 26, 9:00 AM</p>
                      <p className="text-sm font-semibold mt-1">System-wide backup completed</p>
                      <p className="text-xs text-on-surface-variant mt-1">Encrypted storage (Cloud Node B)</p>
                    </div>
                  </>
                )}
              </div>
              <Button
                variant="outline"
                className="w-full mt-10"
                onClick={() => isSessionMode ? window.location.assign("/app/documents") : undefined}
              >
                View Full History
              </Button>
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="md:col-span-4 space-y-8">

          {/* Role / Access Status */}
          <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-outline-variant/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-on-secondary-container">shield_person</span>
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm text-on-surface truncate">
                  {me?.email ||
                    (access.effectiveRole
                      ? access.effectiveRole.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
                      : "Board Member")}
                </p>
                <p className="text-xs text-on-surface-variant capitalize">
                  {access.effectiveRole?.replace(/-/g, " ") || "board member"}
                </p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-xs text-on-surface-variant font-semibold">Access Status</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  access.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-surface-container text-on-surface-variant"
                }`}>
                  {access.status || "active"}
                </span>
              </div>
              {access.boardRole && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-on-surface-variant font-semibold">Board Role</span>
                  <span className="text-xs font-medium text-on-surface capitalize">
                    {access.boardRole.replace(/-/g, " ")}
                  </span>
                </div>
              )}
              {access.boardTerm && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-on-surface-variant font-semibold">Term</span>
                  <span className="text-xs font-medium text-on-surface">
                    {access.boardTerm.startDate ? new Date(access.boardTerm.startDate).getFullYear() : "—"}
                    {" – "}
                    {access.boardTerm.endDate ? new Date(access.boardTerm.endDate).getFullYear() : "Active"}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Asset Card */}
          <div className="rounded-xl overflow-hidden shadow-sm aspect-square relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-700 via-blue-900 to-slate-900 transition-transform duration-700 group-hover:scale-105" />
            <div
              className="absolute inset-0 opacity-10"
              style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.4) 1px, transparent 1px)", backgroundSize: "40px 40px" }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-6 flex flex-col justify-end">
              <h4 className="text-white text-2xl italic mb-1 font-headline">{displayName}</h4>
              <p className="text-white/80 text-xs font-medium uppercase tracking-widest">Master Estate Asset</p>
              <div className="mt-4 flex gap-2">
                <span className="px-2 py-1 bg-white/20 backdrop-blur-md rounded text-[10px] text-white font-bold">
                  {safeOverview.units} Units
                </span>
                <span className="px-2 py-1 bg-white/20 backdrop-blur-md rounded text-[10px] text-white font-bold">
                  Active Status
                </span>
              </div>
            </div>
          </div>

          {/* Director Quick-Launch (6 items) */}
          <div className="bg-primary text-on-primary p-6 rounded-xl shadow-lg shadow-primary/20">
            <h3 className="text-lg font-bold mb-4 font-headline italic">Director Quick-Launch</h3>
            <div className="grid grid-cols-3 gap-3">
              {([
                { icon: "build",          label: "Maintenance",  action: () => isSessionMode ? window.location.assign("/app/work-orders") : scrollTo("maintenance") },
                { icon: "summarize",      label: "Meetings",     action: () => isSessionMode ? window.location.assign("/app/governance/meetings") : scrollTo("governance") },
                { icon: "payments",       label: "Financials",   action: () => isSessionMode ? window.location.assign("/app/financial/ledger") : scrollTo("financial") },
                { icon: "folder_shared",  label: "Packages",     action: () => isSessionMode ? window.location.assign("/app/governance/board-packages") : scrollTo("governance") },
                { icon: "mail",           label: "Comms",        action: () => isSessionMode ? window.location.assign("/app/communications") : scrollTo("communications") },
                { icon: "add_moderator",  label: "Vendors",      action: () => isSessionMode ? window.location.assign("/app/vendors") : scrollTo("communications") },
              ]).map(({ icon, label, action }) => (
                <button
                  key={label}
                  onClick={action}
                  className="p-3 bg-white/10 rounded-lg hover:bg-white/20 transition-colors flex flex-col gap-1.5 items-center text-center"
                >
                  <span className="material-symbols-outlined text-lg">{icon}</span>
                  <span className="text-[9px] font-bold uppercase tracking-tight leading-tight">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
