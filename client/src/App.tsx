import type { CSSProperties } from "react";
import { lazy, Suspense, useEffect, useRef } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { Link, Route, Switch, useLocation } from "wouter";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AssociationProvider, useAssociationContext } from "@/context/association-context";
import { GlobalCommandPalette } from "@/components/global-command-palette";
import { canAccessWipRoute } from "@/lib/wip-features";
import { MobileTabBar } from "@/components/mobile-tab-bar";

const LandingPage = lazy(() => import("@/pages/landing"));
const WorkspacePreviewPage = lazy(() => import("@/pages/workspace-preview"));
const DashboardPage = lazy(() => import("@/pages/dashboard"));
const OperationsDashboardPage = lazy(() => import("@/pages/operations-dashboard"));
const AssociationsPage = lazy(() => import("@/pages/associations"));
const AssociationContextPage = lazy(() => import("@/pages/association-context"));
const UnitsPage = lazy(() => import("@/pages/units"));
const PersonsPage = lazy(() => import("@/pages/persons"));
const BoardPage = lazy(() => import("@/pages/board"));
const DocumentsPage = lazy(() => import("@/pages/documents"));
const RoadmapPage = lazy(() => import("@/pages/roadmap"));
const AdminUsersPage = lazy(() => import("@/pages/admin-users"));
const ExecutivePage = lazy(() => import("@/pages/executive"));
const FinancialFeesPage = lazy(() => import("@/pages/financial-fees"));
const FinancialAssessmentsPage = lazy(() => import("@/pages/financial-assessments"));
const FinancialLateFeesPage = lazy(() => import("@/pages/financial-late-fees"));
const FinancialFoundationPage = lazy(() => import("@/pages/financial-foundation"));
const FinancialInvoicesPage = lazy(() => import("@/pages/financial-invoices"));
const FinancialUtilitiesPage = lazy(() => import("@/pages/financial-utilities"));
const FinancialLedgerPage = lazy(() => import("@/pages/financial-ledger"));
const FinancialBudgetsPage = lazy(() => import("@/pages/financial-budgets"));
const FinancialPaymentsPage = lazy(() => import("@/pages/financial-payments"));
const FinancialReportsPage = lazy(() => import("@/pages/financial-reports"));
const FinancialReconciliationPage = lazy(() => import("@/pages/financial-reconciliation"));
const FinancialRecurringChargesPage = lazy(() => import("@/pages/financial-recurring-charges"));
const VendorsPage = lazy(() => import("@/pages/vendors"));
const WorkOrdersPage = lazy(() => import("@/pages/work-orders"));
const MaintenanceSchedulesPage = lazy(() => import("@/pages/maintenance-schedules"));
const ResidentFeedbackPage = lazy(() => import("@/pages/resident-feedback"));
const InspectionsPage = lazy(() => import("@/pages/inspections"));
const BoardPackagesPage = lazy(() => import("@/pages/board-packages"));
const MeetingsPage = lazy(() => import("@/pages/meetings"));
const GovernanceCompliancePage = lazy(() => import("@/pages/governance-compliance"));
const AiIngestionPage = lazy(() => import("@/pages/ai-ingestion"));
const CommunicationsPage = lazy(() => import("@/pages/communications"));
const PlatformControlsPage = lazy(() => import("@/pages/platform-controls"));
const FeatureFlagsPage = lazy(() => import("@/pages/feature-flags"));
const OwnerPortalPage = lazy(() => import("@/pages/owner-portal"));
const OnboardingInvitePage = lazy(() => import("@/pages/onboarding-invite"));
const InsurancePage = lazy(() => import("@/pages/insurance"));
const PortfolioPage = lazy(() => import("@/pages/portfolio"));
const AnnouncementsPage = lazy(() => import("@/pages/announcements"));
const NotFound = lazy(() => import("@/pages/not-found"));

type AdminRole = "platform-admin" | "board-admin" | "manager" | "viewer";

type AuthSession = {
  authenticated: boolean;
  user?: {
    email?: string | null;
  };
  admin?: {
    id: string;
    email: string;
    role: AdminRole;
  } | null;
};

type WorkspaceSectionTab = {
  label: string;
  href: string;
  matchPrefixes?: string[];
  roles?: AdminRole[];
};

type WorkspaceSectionTabGroup = {
  id: string;
  matchPrefixes: string[];
  testId: string;
  tabs: WorkspaceSectionTab[];
};

const workspaceSectionTabGroups: WorkspaceSectionTabGroup[] = [
  {
    id: "residential",
    matchPrefixes: ["/app/units", "/app/persons"],
    testId: "tabs-residential-inpage",
    tabs: [
      { label: "Buildings & Units", href: "/app/units", roles: ["platform-admin", "board-admin", "manager"] },
      { label: "People", href: "/app/persons", roles: ["platform-admin", "board-admin", "manager"] },
    ],
  },
  {
    id: "governance",
    matchPrefixes: ["/app/board", "/app/governance/board-packages", "/app/governance/meetings", "/app/governance/compliance"],
    testId: "tabs-governance-inpage",
    tabs: [
      { label: "Board Members", href: "/app/board", roles: ["platform-admin", "board-admin", "manager", "viewer"] },
      { label: "Board Packages", href: "/app/governance/board-packages", roles: ["platform-admin", "board-admin", "manager", "viewer"] },
      { label: "Meetings", href: "/app/governance/meetings", roles: ["platform-admin", "board-admin", "manager", "viewer"] },
      { label: "Compliance", href: "/app/governance/compliance", roles: ["platform-admin", "board-admin", "manager", "viewer"] },
    ],
  },
  {
    id: "finance-setup",
    matchPrefixes: ["/app/financial/foundation", "/app/financial/recurring-charges", "/app/financial/assessments", "/app/financial/late-fees", "/app/financial/utilities"],
    testId: "tabs-finance-setup-inpage",
    tabs: [
      { label: "Setup", href: "/app/financial/foundation", roles: ["platform-admin", "board-admin", "manager"] },
      { label: "Fee Schedules", href: "/app/financial/recurring-charges", roles: ["platform-admin", "board-admin", "manager"] },
      { label: "Assessments", href: "/app/financial/assessments", roles: ["platform-admin", "board-admin", "manager"] },
      { label: "Late Fees", href: "/app/financial/late-fees", roles: ["platform-admin", "board-admin", "manager"] },
      { label: "Utilities", href: "/app/financial/utilities", roles: ["platform-admin", "board-admin", "manager"] },
    ],
  },
  {
    id: "owner-accounts",
    matchPrefixes: ["/app/financial/ledger", "/app/financial/invoices", "/app/financial/payments"],
    testId: "tabs-owner-accounts-inpage",
    tabs: [
      { label: "Owner Ledger", href: "/app/financial/ledger", roles: ["platform-admin", "board-admin", "manager", "viewer"] },
      { label: "Invoices", href: "/app/financial/invoices", roles: ["platform-admin", "board-admin", "manager"] },
      { label: "Payments", href: "/app/financial/payments", roles: ["platform-admin", "board-admin", "manager"] },
    ],
  },
  {
    id: "oversight-reporting",
    matchPrefixes: ["/app/financial/budgets", "/app/financial/reports", "/app/financial/reconciliation"],
    testId: "tabs-oversight-reporting-inpage",
    tabs: [
      { label: "Budgets", href: "/app/financial/budgets", roles: ["platform-admin", "board-admin", "manager", "viewer"] },
      { label: "Reports", href: "/app/financial/reports", roles: ["platform-admin", "board-admin", "manager", "viewer"] },
      { label: "Reconciliation", href: "/app/financial/reconciliation", roles: ["platform-admin", "board-admin", "manager"] },
    ],
  },
  {
    id: "service-delivery",
    matchPrefixes: ["/app/work-orders", "/app/maintenance-schedules", "/app/inspections"],
    testId: "tabs-service-delivery-inpage",
    tabs: [
      { label: "Work Orders", href: "/app/work-orders", roles: ["platform-admin", "board-admin", "manager", "viewer"] },
      { label: "Maintenance Schedules", href: "/app/maintenance-schedules", roles: ["platform-admin", "board-admin", "manager", "viewer"] },
      { label: "Inspections", href: "/app/inspections", roles: ["platform-admin", "board-admin", "manager", "viewer"] },
    ],
  },
  {
    id: "vendor-risk",
    matchPrefixes: ["/app/vendors", "/app/insurance"],
    testId: "tabs-vendor-risk-inpage",
    tabs: [
      { label: "Vendors", href: "/app/vendors", roles: ["platform-admin", "board-admin", "manager", "viewer"] },
      { label: "Insurance Policies", href: "/app/insurance", roles: ["platform-admin", "board-admin", "manager", "viewer"] },
    ],
  },
  {
    id: "resident-communications",
    matchPrefixes: ["/app/communications", "/app/announcements", "/app/resident-feedback", "/app/ai/ingestion"],
    testId: "tabs-resident-communications-inpage",
    tabs: [
      { label: "Communications", href: "/app/communications", roles: ["platform-admin", "board-admin", "manager", "viewer"] },
      { label: "Announcements", href: "/app/announcements", roles: ["platform-admin", "board-admin", "manager", "viewer"] },
      { label: "Resident Feedback", href: "/app/resident-feedback", roles: ["platform-admin", "board-admin", "manager", "viewer"] },
      { label: "AI Ingestion", href: "/app/ai/ingestion", roles: ["platform-admin", "board-admin", "manager"] },
    ],
  },
  {
    id: "platform",
    matchPrefixes: ["/app/platform/controls", "/app/admin", "/portal"],
    testId: "tabs-platform-inpage",
    tabs: [
      { label: "Platform Controls", href: "/app/platform/controls", roles: ["platform-admin"] },
      { label: "Admin Roadmap", href: "/app/admin/roadmap", matchPrefixes: ["/app/admin", "/app/admin/roadmap"], roles: ["platform-admin", "board-admin"] },
      { label: "Executive", href: "/app/admin/executive", roles: ["platform-admin", "board-admin"] },
      { label: "Admin Users", href: "/app/admin/users", roles: ["platform-admin"] },
      { label: "Feature Flags", href: "/app/admin/feature-flags", roles: ["platform-admin"] },
      { label: "Owner Portal", href: "/portal", roles: ["platform-admin"] },
    ],
  },
];

function formatAdminRole(role: AdminRole) {
  return role
    .split("-")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function isSingleAssociationBoardExperience(adminRole: AdminRole | null, associationCount: number) {
  return adminRole === "board-admin" && associationCount <= 1;
}

function getUserInitials(email?: string | null) {
  const source = email?.split("@")[0]?.trim();
  if (!source) return "CM";
  const parts = source.split(/[._-]+/).filter(Boolean);
  if (parts.length === 1) {
    return source.slice(0, 2).toUpperCase();
  }
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function RouteFallback() {
  return (
    <div className="flex h-full min-h-[240px] items-center justify-center px-6">
      <div className="text-sm text-muted-foreground">Loading view...</div>
    </div>
  );
}

function RouteRedirect({ to }: { to: string }) {
  const [, navigate] = useLocation();

  useEffect(() => {
    navigate(to);
  }, [navigate, to]);

  return <RouteFallback />;
}

function WorkspaceRouter({
  adminRole,
  singleAssociationBoardExperience,
}: {
  adminRole: AdminRole | null;
  singleAssociationBoardExperience: boolean;
}) {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Switch>
        <Route path="/app" component={DashboardPage} />
        <Route path="/app/operations/dashboard" component={OperationsDashboardPage} />
        <Route path="/app/associations">
          {singleAssociationBoardExperience ? <RouteRedirect to="/app" /> : <AssociationsPage />}
        </Route>
        <Route path="/app/association-context" component={AssociationContextPage} />
        <Route path="/app/units" component={UnitsPage} />
        <Route path="/app/persons" component={PersonsPage} />
        <Route path="/app/owners">
          <RouteRedirect to="/app/persons" />
        </Route>
        <Route path="/app/occupancy">
          <RouteRedirect to="/app/units" />
        </Route>
        <Route path="/app/board" component={BoardPage} />
        <Route path="/app/documents" component={DocumentsPage} />
        <Route path="/app/admin" component={RoadmapPage} />
        <Route path="/app/admin/roadmap" component={RoadmapPage} />
        <Route path="/app/admin/users" component={AdminUsersPage} />
        <Route path="/app/admin/feature-flags" component={FeatureFlagsPage} />
        <Route path="/app/admin/executive" component={ExecutivePage} />
        <Route path="/app/financial/fees"><RouteRedirect to="/app/financial/recurring-charges" /></Route>
        <Route path="/app/financial/assessments" component={FinancialAssessmentsPage} />
        <Route path="/app/financial/late-fees" component={FinancialLateFeesPage} />
        <Route path="/app/financial/foundation" component={FinancialFoundationPage} />
        <Route path="/app/financial/invoices" component={FinancialInvoicesPage} />
        <Route path="/app/financial/utilities" component={FinancialUtilitiesPage} />
        <Route path="/app/financial/ledger" component={FinancialLedgerPage} />
        <Route path="/app/financial/budgets" component={FinancialBudgetsPage} />
        <Route path="/app/financial/payments" component={FinancialPaymentsPage} />
        <Route path="/app/financial/reports" component={FinancialReportsPage} />
        <Route path="/app/financial/reconciliation" component={FinancialReconciliationPage} />
        <Route path="/app/financial/recurring-charges" component={FinancialRecurringChargesPage} />
        <Route path="/app/vendors" component={VendorsPage} />
        <Route path="/app/work-orders" component={WorkOrdersPage} />
        <Route path="/app/maintenance-schedules" component={MaintenanceSchedulesPage} />
        <Route path="/app/resident-feedback" component={ResidentFeedbackPage} />
        <Route path="/app/inspections" component={InspectionsPage} />
        <Route path="/app/governance/board-packages" component={BoardPackagesPage} />
        <Route path="/app/governance/meetings" component={MeetingsPage} />
        <Route path="/app/governance/compliance" component={GovernanceCompliancePage} />
        <Route path="/app/ai/ingestion">
          {canAccessWipRoute("/app/ai/ingestion", adminRole) ? <AiIngestionPage /> : <NotFound />}
        </Route>
        <Route path="/app/communications" component={CommunicationsPage} />
        <Route path="/app/platform/controls">
          {adminRole === "platform-admin" ? <PlatformControlsPage /> : <NotFound />}
        </Route>
        <Route path="/app/insurance" component={InsurancePage} />
        <Route path="/app/portfolio">
          {singleAssociationBoardExperience ? <RouteRedirect to="/app" /> : <PortfolioPage />}
        </Route>
        <Route path="/app/announcements" component={AnnouncementsPage} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function PublicRouter({
  hasWorkspaceAccess,
  onStartGoogleSignIn,
}: {
  hasWorkspaceAccess: boolean;
  onStartGoogleSignIn: () => void;
}) {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Switch>
        <Route path="/">
          <LandingPage
            hasWorkspaceAccess={hasWorkspaceAccess}
            onStartGoogleSignIn={onStartGoogleSignIn}
          />
        </Route>
        <Route path="/portal" component={OwnerPortalPage} />
        <Route path="/onboarding/:token" component={OnboardingInvitePage} />
        <Route path="/associations">
          <RouteRedirect to="/app/associations" />
        </Route>
        <Route path="/operations/dashboard">
          <RouteRedirect to="/app/operations/dashboard" />
        </Route>
        <Route path="/association-context">
          <RouteRedirect to="/app/association-context" />
        </Route>
        <Route path="/units">
          <RouteRedirect to="/app/units" />
        </Route>
        <Route path="/persons">
          <RouteRedirect to="/app/persons" />
        </Route>
        <Route path="/owners">
          <RouteRedirect to="/app/persons" />
        </Route>
        <Route path="/occupancy">
          <RouteRedirect to="/app/units" />
        </Route>
        <Route path="/board">
          <RouteRedirect to="/app/board" />
        </Route>
        <Route path="/documents">
          <RouteRedirect to="/app/documents" />
        </Route>
        <Route path="/roadmap">
          <RouteRedirect to="/app/admin/roadmap" />
        </Route>
        <Route path="/admin">
          <RouteRedirect to="/app/admin/roadmap" />
        </Route>
        <Route path="/admin/roadmap">
          <RouteRedirect to="/app/admin/roadmap" />
        </Route>
        <Route path="/admin/users">
          <RouteRedirect to="/app/admin/users" />
        </Route>
        <Route path="/admin/executive">
          <RouteRedirect to="/app/admin/executive" />
        </Route>
        <Route path="/financial/fees">
          <RouteRedirect to="/app/financial/fees" />
        </Route>
        <Route path="/financial/assessments">
          <RouteRedirect to="/app/financial/assessments" />
        </Route>
        <Route path="/financial/late-fees">
          <RouteRedirect to="/app/financial/late-fees" />
        </Route>
        <Route path="/financial/foundation">
          <RouteRedirect to="/app/financial/foundation" />
        </Route>
        <Route path="/financial/invoices">
          <RouteRedirect to="/app/financial/invoices" />
        </Route>
        <Route path="/financial/utilities">
          <RouteRedirect to="/app/financial/utilities" />
        </Route>
        <Route path="/financial/ledger">
          <RouteRedirect to="/app/financial/ledger" />
        </Route>
        <Route path="/financial/budgets">
          <RouteRedirect to="/app/financial/budgets" />
        </Route>
        <Route path="/financial/payments">
          <RouteRedirect to="/app/financial/payments" />
        </Route>
        <Route path="/vendors">
          <RouteRedirect to="/app/vendors" />
        </Route>
        <Route path="/work-orders">
          <RouteRedirect to="/app/work-orders" />
        </Route>
        <Route path="/governance/board-packages">
          <RouteRedirect to="/app/governance/board-packages" />
        </Route>
        <Route path="/maintenance-schedules">
          <RouteRedirect to="/app/maintenance-schedules" />
        </Route>
        <Route path="/inspections">
          <RouteRedirect to="/app/inspections" />
        </Route>
        <Route path="/governance/meetings">
          <RouteRedirect to="/app/governance/meetings" />
        </Route>
        <Route path="/governance/compliance">
          <RouteRedirect to="/app/governance/compliance" />
        </Route>
        <Route path="/ai/ingestion">
          <RouteRedirect to="/app/ai/ingestion" />
        </Route>
        <Route path="/communications">
          <RouteRedirect to="/app/communications" />
        </Route>
        <Route path="/platform/controls">
          <RouteRedirect to="/app/platform/controls" />
        </Route>
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function HeaderActions({
  authSession,
  adminRole,
  onStartGoogleSignIn,
  onLogoutGoogleSession,
}: {
  authSession: AuthSession | null | undefined;
  adminRole: AdminRole | null;
  onStartGoogleSignIn: () => void;
  onLogoutGoogleSession: () => Promise<void>;
}) {
  const { associations, activeAssociationId, setActiveAssociationId } = useAssociationContext();
  const accountEmail = authSession?.user?.email || authSession?.admin?.email || null;
  const singleAssociationBoardExperience = isSingleAssociationBoardExperience(adminRole, associations.length);
  const activeAssociationName =
    associations.find((association) => association.id === activeAssociationId)?.name ?? "Select association";

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
      <GlobalCommandPalette adminRole={adminRole} />
      {singleAssociationBoardExperience ? (
        <div
          className="hidden h-8 items-center rounded-md border bg-muted/40 px-3 text-sm font-medium text-foreground sm:flex"
          data-testid="text-active-association"
        >
          {activeAssociationName}
        </div>
      ) : (
        <Select value={activeAssociationId ?? undefined} onValueChange={setActiveAssociationId}>
          <SelectTrigger className="h-10 w-full max-w-full sm:h-8 sm:w-[220px] lg:w-64" data-testid="select-active-association">
            <SelectValue placeholder="Select association" />
          </SelectTrigger>
          <SelectContent>
            {associations.map((association) => (
              <SelectItem key={association.id} value={association.id}>
                {association.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {authSession?.authenticated ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="min-h-10 min-w-0 max-w-full justify-start gap-2 px-2 sm:min-h-8 sm:max-w-[260px]"
              data-testid="button-account-menu"
            >
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-[10px] font-semibold">
                  {getUserInitials(accountEmail)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden min-w-0 flex-1 text-left sm:flex sm:flex-col">
                <span className="truncate text-xs font-medium leading-tight">
                  {accountEmail || "Signed in"}
                </span>
                <span className="truncate text-[11px] font-normal leading-tight text-muted-foreground">
                  {adminRole ? formatAdminRole(adminRole) : activeAssociationName}
                </span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="space-y-1">
              <div className="truncate text-sm">{accountEmail || "Signed in"}</div>
              {adminRole ? (
                <div className="text-xs font-normal text-muted-foreground">
                  {formatAdminRole(adminRole)}
                </div>
              ) : null}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer"
              onSelect={() => void onLogoutGoogleSession()}
              data-testid="button-google-signout"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button size="sm" className="min-h-10 sm:min-h-8" onClick={onStartGoogleSignIn} data-testid="button-google-signin">
          Sign in with Google
        </Button>
      )}
    </div>
  );
}

function canAccessTab(role: AdminRole | null, tab: WorkspaceSectionTab) {
  if (!tab.roles?.length) return true;
  if (!role) return false;
  return tab.roles.includes(role);
}

function isTabActive(location: string, href: string) {
  return location === href || location.startsWith(`${href}/`);
}

function WorkspaceSectionTabs({ adminRole }: { adminRole: AdminRole | null }) {
  const [location, navigate] = useLocation();
  const activeGroup = workspaceSectionTabGroups.find((group) =>
    group.matchPrefixes.some((prefix) => location === prefix || location.startsWith(`${prefix}/`)),
  );

  if (!activeGroup) return null;

  const visibleTabs = activeGroup.tabs.filter((tab) => canAccessTab(adminRole, tab));
  if (visibleTabs.length <= 1) return null;

  return (
    <div className="sticky top-0 z-10 border-b bg-background/95 px-3 py-3 backdrop-blur" data-testid={activeGroup.testId}>
      <MobileTabBar
        items={visibleTabs.map((tab) => ({ id: tab.href, label: tab.label }))}
        value={visibleTabs.find((tab) => (tab.matchPrefixes ?? [tab.href]).some((prefix) => isTabActive(location, prefix)))?.href ?? visibleTabs[0].href}
        onChange={navigate}
      />
    </div>
  );
}

function MainContent({ adminRole }: { adminRole: AdminRole | null }) {
  const [location] = useLocation();
  const mainRef = useRef<HTMLElement | null>(null);
  const { associations } = useAssociationContext();
  const singleAssociationBoardExperience = isSingleAssociationBoardExperience(adminRole, associations.length);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [location]);

  return (
    <>
      <WorkspaceSectionTabs adminRole={adminRole} />
      <main ref={mainRef} className="flex-1 overflow-auto pb-[max(env(safe-area-inset-bottom),1rem)]">
        <WorkspaceRouter
          adminRole={adminRole}
          singleAssociationBoardExperience={singleAssociationBoardExperience}
        />
      </main>
    </>
  );
}

function WorkspaceShell({
  authSession,
  adminRole,
  onStartGoogleSignIn,
  onLogoutGoogleSession,
}: {
  authSession: AuthSession | null | undefined;
  adminRole: AdminRole | null;
  onStartGoogleSignIn: () => void;
  onLogoutGoogleSession: () => Promise<void>;
}) {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <AssociationProvider>
      <SidebarProvider style={style as CSSProperties}>
        <div className="flex h-screen w-full">
          <AppSidebar adminRole={adminRole} />
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-20 flex min-h-14 flex-wrap items-center gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <HeaderActions
                authSession={authSession}
                adminRole={adminRole}
                onStartGoogleSignIn={onStartGoogleSignIn}
                onLogoutGoogleSession={onLogoutGoogleSession}
              />
            </header>
            <MainContent adminRole={adminRole} />
          </div>
        </div>
      </SidebarProvider>
    </AssociationProvider>
  );
}

function AuthAwareApp() {
  const [location] = useLocation();
  const authRestoreAttemptedRef = useRef(false);

  const { data: authSession, refetch: refetchAuthSession, isLoading: authSessionLoading } = useQuery<AuthSession | null>({
    queryKey: ["/api/auth/me", "session"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  async function attemptAuthRestore() {
    const response = await fetch("/api/auth/session/restore", {
      method: "POST",
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error("restore-failed");
    }
    await refetchAuthSession();
    queryClient.invalidateQueries();
  }

  function clearAuthSuccessQueryParam() {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("auth")) return;
    params.delete("auth");
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", nextUrl);
  }

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (!event.data || typeof event.data !== "object") return;
      const payload = event.data as { type?: string };
      if (payload.type !== "google-oauth-success") return;
      authRestoreAttemptedRef.current = true;
      attemptAuthRestore()
        .then(() => {
          clearAuthSuccessQueryParam();
          window.location.reload();
        })
        .catch(() => {
          authRestoreAttemptedRef.current = false;
        });
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [refetchAuthSession]);

  useEffect(() => {
    if (authSession?.authenticated) return;
    if (authRestoreAttemptedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("auth") !== "success") return;

    authRestoreAttemptedRef.current = true;
    attemptAuthRestore()
      .then(() => {
        clearAuthSuccessQueryParam();
      })
      .catch(() => {
        clearAuthSuccessQueryParam();
      });
  }, [authSession, refetchAuthSession]);

  function resolveGoogleReturnTo() {
    if (typeof window === "undefined") return "/app";
    const current = `${window.location.pathname}${window.location.search}`;
    if (window.location.pathname === "/" || !window.location.pathname.startsWith("/app")) {
      return "/app";
    }
    return current;
  }

  function startGoogleSignIn(forceSelect = true) {
    if (typeof window === "undefined") return;
    const returnTo = resolveGoogleReturnTo();
    const url = `/api/auth/google?popup=1&returnTo=${encodeURIComponent(returnTo)}${forceSelect ? "&forceSelect=1" : ""}`;
    const popup = window.open(url, "google-oauth-signin", "width=520,height=680");

    if (!popup) {
      window.location.assign(`/api/auth/google?returnTo=${encodeURIComponent(returnTo)}${forceSelect ? "&forceSelect=1" : ""}`);
      return;
    }

    const timer = window.setInterval(() => {
      if (!popup.closed) return;
      window.clearInterval(timer);
      queryClient.invalidateQueries();
      refetchAuthSession();
    }, 400);
  }

  async function logoutGoogleSession() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      authRestoreAttemptedRef.current = false;
      queryClient.clear();
      window.location.assign("/");
    }
  }

  const adminRole = authSession?.admin?.role ?? null;
  const hasWorkspaceAccess = Boolean(authSession?.authenticated && authSession.admin);
  const isWorkspaceRoute = location === "/app" || location.startsWith("/app/");

  if (isWorkspaceRoute && authSessionLoading) {
    return <RouteFallback />;
  }

  return (
    <>
      {isWorkspaceRoute ? (
        hasWorkspaceAccess ? (
          <WorkspaceShell
            authSession={authSession}
            adminRole={adminRole}
            onStartGoogleSignIn={() => startGoogleSignIn(true)}
            onLogoutGoogleSession={logoutGoogleSession}
          />
        ) : (
          <Suspense fallback={<RouteFallback />}>
            <WorkspacePreviewPage
              onStartGoogleSignIn={() => startGoogleSignIn(true)}
            />
          </Suspense>
        )
      ) : (
        <PublicRouter
          hasWorkspaceAccess={hasWorkspaceAccess}
          onStartGoogleSignIn={() => startGoogleSignIn(true)}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthAwareApp />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
