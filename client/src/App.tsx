import type { CSSProperties } from "react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, Route, Switch, useLocation } from "wouter";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AssociationProvider, useAssociationContext } from "@/context/association-context";
import { GlobalCommandPalette } from "@/components/global-command-palette";

const LandingPage = lazy(() => import("@/pages/landing"));
const WorkspacePreviewPage = lazy(() => import("@/pages/workspace-preview"));
const DashboardPage = lazy(() => import("@/pages/dashboard"));
const OperationsDashboardPage = lazy(() => import("@/pages/operations-dashboard"));
const AssociationsPage = lazy(() => import("@/pages/associations"));
const AssociationContextPage = lazy(() => import("@/pages/association-context"));
const UnitsPage = lazy(() => import("@/pages/units"));
const PersonsPage = lazy(() => import("@/pages/persons"));
const OwnersPage = lazy(() => import("@/pages/owners"));
const OccupancyPage = lazy(() => import("@/pages/occupancy"));
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
const VendorsPage = lazy(() => import("@/pages/vendors"));
const WorkOrdersPage = lazy(() => import("@/pages/work-orders"));
const MaintenanceSchedulesPage = lazy(() => import("@/pages/maintenance-schedules"));
const InspectionsPage = lazy(() => import("@/pages/inspections"));
const BoardPackagesPage = lazy(() => import("@/pages/board-packages"));
const MeetingsPage = lazy(() => import("@/pages/meetings"));
const GovernanceCompliancePage = lazy(() => import("@/pages/governance-compliance"));
const AiIngestionPage = lazy(() => import("@/pages/ai-ingestion"));
const CommunicationsPage = lazy(() => import("@/pages/communications"));
const PlatformControlsPage = lazy(() => import("@/pages/platform-controls"));
const OwnerPortalPage = lazy(() => import("@/pages/owner-portal"));
const OnboardingInvitePage = lazy(() => import("@/pages/onboarding-invite"));
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

function WorkspaceRouter() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Switch>
        <Route path="/app" component={DashboardPage} />
        <Route path="/app/operations/dashboard" component={OperationsDashboardPage} />
        <Route path="/app/associations" component={AssociationsPage} />
        <Route path="/app/association-context" component={AssociationContextPage} />
        <Route path="/app/units" component={UnitsPage} />
        <Route path="/app/persons" component={PersonsPage} />
        <Route path="/app/owners" component={OwnersPage} />
        <Route path="/app/occupancy" component={OccupancyPage} />
        <Route path="/app/board" component={BoardPage} />
        <Route path="/app/documents" component={DocumentsPage} />
        <Route path="/app/admin" component={RoadmapPage} />
        <Route path="/app/admin/roadmap" component={RoadmapPage} />
        <Route path="/app/admin/users" component={AdminUsersPage} />
        <Route path="/app/admin/executive" component={ExecutivePage} />
        <Route path="/app/financial/fees" component={FinancialFeesPage} />
        <Route path="/app/financial/assessments" component={FinancialAssessmentsPage} />
        <Route path="/app/financial/late-fees" component={FinancialLateFeesPage} />
        <Route path="/app/financial/foundation" component={FinancialFoundationPage} />
        <Route path="/app/financial/invoices" component={FinancialInvoicesPage} />
        <Route path="/app/financial/utilities" component={FinancialUtilitiesPage} />
        <Route path="/app/financial/ledger" component={FinancialLedgerPage} />
        <Route path="/app/financial/budgets" component={FinancialBudgetsPage} />
        <Route path="/app/financial/payments" component={FinancialPaymentsPage} />
        <Route path="/app/vendors" component={VendorsPage} />
        <Route path="/app/work-orders" component={WorkOrdersPage} />
        <Route path="/app/maintenance-schedules" component={MaintenanceSchedulesPage} />
        <Route path="/app/inspections" component={InspectionsPage} />
        <Route path="/app/governance/board-packages" component={BoardPackagesPage} />
        <Route path="/app/governance/meetings" component={MeetingsPage} />
        <Route path="/app/governance/compliance" component={GovernanceCompliancePage} />
        <Route path="/app/ai/ingestion" component={AiIngestionPage} />
        <Route path="/app/communications" component={CommunicationsPage} />
        <Route path="/app/platform/controls" component={PlatformControlsPage} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function PublicRouter({
  hasWorkspaceAccess,
  onOpenAdminAuth,
  onStartGoogleSignIn,
}: {
  hasWorkspaceAccess: boolean;
  onOpenAdminAuth: () => void;
  onStartGoogleSignIn: () => void;
}) {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Switch>
        <Route path="/">
          <LandingPage
            hasWorkspaceAccess={hasWorkspaceAccess}
            onOpenAdminAuth={onOpenAdminAuth}
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
          <RouteRedirect to="/app/owners" />
        </Route>
        <Route path="/occupancy">
          <RouteRedirect to="/app/occupancy" />
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

function AdminAuthDialog({
  open,
  onOpenChange,
  adminApiKey,
  adminUserEmail,
  onAdminApiKeyChange,
  onAdminUserEmailChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  adminApiKey: string;
  adminUserEmail: string;
  onAdminApiKeyChange: (value: string) => void;
  onAdminUserEmailChange: (value: string) => void;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Admin Authentication</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label htmlFor="admin-api-key">Admin API Key</Label>
            <Input
              id="admin-api-key"
              type="password"
              value={adminApiKey}
              onChange={(event) => onAdminApiKeyChange(event.target.value)}
              placeholder="Enter ADMIN_API_KEY value"
              data-testid="input-admin-api-key"
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="admin-user-email">Admin User Email</Label>
            <Input
              id="admin-user-email"
              value={adminUserEmail}
              onChange={(event) => onAdminUserEmailChange(event.target.value)}
              placeholder="admin@example.com"
              data-testid="input-admin-user-email"
            />
          </div>
          <Button onClick={onSave} data-testid="button-save-admin-auth">Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HeaderActions({
  authSession,
  adminAuthConfigured,
  adminUserEmail,
  adminRole,
  onOpenAdminAuth,
  onStartGoogleSignIn,
  onLogoutGoogleSession,
}: {
  authSession: AuthSession | null | undefined;
  adminAuthConfigured: boolean;
  adminUserEmail: string;
  adminRole: AdminRole | null;
  onOpenAdminAuth: () => void;
  onStartGoogleSignIn: () => void;
  onLogoutGoogleSession: () => Promise<void>;
}) {
  const { associations, activeAssociationId, setActiveAssociationId } = useAssociationContext();

  return (
    <div className="flex items-center justify-end gap-2">
      <GlobalCommandPalette adminRole={adminRole} />
      <Select value={activeAssociationId} onValueChange={setActiveAssociationId}>
        <SelectTrigger className="h-8 w-64" data-testid="select-active-association">
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
      {adminRole ? <Badge variant="secondary">{adminRole}</Badge> : null}
      {!adminRole && adminAuthConfigured ? <Badge variant="outline">{adminUserEmail || "Admin API"}</Badge> : null}
      <Button
        size="sm"
        variant={adminAuthConfigured ? "outline" : "default"}
        onClick={onOpenAdminAuth}
        data-testid="button-open-admin-auth"
      >
        {adminAuthConfigured ? "Admin Auth" : "Set Admin Auth"}
      </Button>
      <Button
        size="sm"
        variant={authSession?.authenticated ? "outline" : "default"}
        onClick={onStartGoogleSignIn}
        data-testid="button-google-signin"
      >
        {authSession?.authenticated ? `Google: ${authSession.user?.email || "Signed in"}` : "Sign in with Google"}
      </Button>
      {authSession?.authenticated ? (
        <Button size="sm" variant="outline" onClick={() => void onLogoutGoogleSession()} data-testid="button-google-signout">
          Sign out
        </Button>
      ) : null}
      <Button asChild size="sm" data-testid="button-open-admin-roadmap-global">
        <Link href="/app/admin/roadmap">Admin Roadmap</Link>
      </Button>
    </div>
  );
}

function AdminPageTabs() {
  const [location] = useLocation();

  const tabs = [
    { label: "Roadmap", href: "/app/admin/roadmap", isActive: location === "/app/admin" || location === "/app/admin/roadmap" },
    { label: "Executive", href: "/app/admin/executive", isActive: location === "/app/admin/executive" },
    { label: "Admin Users", href: "/app/admin/users", isActive: location === "/app/admin/users" },
  ];

  return (
    <div className="border-b px-3 py-2">
      <div className="flex items-center gap-2" data-testid="tabs-admin-inpage">
        {tabs.map((tab) => (
          <Button
            key={tab.href}
            asChild
            size="sm"
            variant={tab.isActive ? "default" : "outline"}
            data-testid={`tab-admin-${tab.label.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <Link href={tab.href}>{tab.label}</Link>
          </Button>
        ))}
      </div>
    </div>
  );
}

function MainContent() {
  const [location] = useLocation();
  const showAdminTabs =
    location === "/app/admin" ||
    location === "/app/admin/roadmap" ||
    location === "/app/admin/executive" ||
    location === "/app/admin/users";

  return (
    <>
      {showAdminTabs ? <AdminPageTabs /> : null}
      <main className="flex-1 overflow-auto">
        <WorkspaceRouter />
      </main>
    </>
  );
}

function WorkspaceShell({
  authSession,
  adminAuthConfigured,
  adminUserEmail,
  adminRole,
  onOpenAdminAuth,
  onStartGoogleSignIn,
  onLogoutGoogleSession,
}: {
  authSession: AuthSession | null | undefined;
  adminAuthConfigured: boolean;
  adminUserEmail: string;
  adminRole: AdminRole | null;
  onOpenAdminAuth: () => void;
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
            <header className="flex h-12 items-center justify-between gap-2 border-b p-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <HeaderActions
                authSession={authSession}
                adminAuthConfigured={adminAuthConfigured}
                adminUserEmail={adminUserEmail}
                adminRole={adminRole}
                onOpenAdminAuth={onOpenAdminAuth}
                onStartGoogleSignIn={onStartGoogleSignIn}
                onLogoutGoogleSession={onLogoutGoogleSession}
              />
            </header>
            <MainContent />
          </div>
        </div>
      </SidebarProvider>
    </AssociationProvider>
  );
}

function AuthAwareApp() {
  const [location] = useLocation();
  const [authOpen, setAuthOpen] = useState(false);
  const [adminApiKey, setAdminApiKey] = useState("");
  const [adminUserEmail, setAdminUserEmail] = useState("");
  const authRestoreAttemptedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setAdminApiKey((window.localStorage.getItem("adminApiKey") || "").trim());
    setAdminUserEmail((window.localStorage.getItem("adminUserEmail") || "").trim());
  }, []);

  const adminAuthConfigured = adminApiKey.length > 0 && adminUserEmail.length > 0;
  const { data: authSession, refetch: refetchAuthSession } = useQuery<AuthSession | null>({
    queryKey: ["/api/auth/me", "session"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const resolvedAdminEmail = authSession?.authenticated
      ? (authSession.admin?.email || authSession.user?.email || "").trim().toLowerCase()
      : "";

    if (!resolvedAdminEmail) return;
    if (resolvedAdminEmail === adminUserEmail.trim().toLowerCase()) return;

    setAdminUserEmail(resolvedAdminEmail);
    window.localStorage.setItem("adminUserEmail", resolvedAdminEmail);
    queryClient.invalidateQueries();
  }, [authSession, adminUserEmail]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authRestore = params.get("authRestore");
    if (!authRestore) return;
    window.localStorage.setItem("authRestorePayload", authRestore);
    params.delete("authRestore");
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", nextUrl);
  }, []);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (!event.data || typeof event.data !== "object") return;
      const payload = event.data as { type?: string; authRestore?: string };
      if (payload.type !== "google-oauth-success") return;
      if (typeof payload.authRestore === "string" && payload.authRestore.trim()) {
        window.localStorage.setItem("authRestorePayload", payload.authRestore.trim());
      }
      queryClient.invalidateQueries();
      refetchAuthSession();
      window.location.reload();
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [refetchAuthSession]);

  useEffect(() => {
    if (authSession?.authenticated) return;
    if (authRestoreAttemptedRef.current) return;
    const payload = (window.localStorage.getItem("authRestorePayload") || "").trim();
    if (!payload) return;

    authRestoreAttemptedRef.current = true;
    fetch("/api/auth/session/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ payload }),
    })
      .then(async (response) => {
        if (!response.ok) {
          window.localStorage.removeItem("authRestorePayload");
          return;
        }
        await refetchAuthSession();
        queryClient.invalidateQueries();
      })
      .catch(() => {
        window.localStorage.removeItem("authRestorePayload");
      });
  }, [authSession, refetchAuthSession]);

  function startGoogleSignIn(forceSelect = true) {
    if (typeof window === "undefined") return;
    const returnTo = `${window.location.pathname}${window.location.search}`;
    const url = `/api/auth/google?popup=1&returnTo=${encodeURIComponent(returnTo)}${forceSelect ? "&forceSelect=1" : ""}`;
    const popup = window.open(url, "google-oauth-signin", "width=520,height=680,noopener,noreferrer");

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

  function saveAdminAuth() {
    if (typeof window === "undefined") return;
    const nextKey = adminApiKey.trim();
    const nextEmail = adminUserEmail.trim();
    if (nextKey) {
      window.localStorage.setItem("adminApiKey", nextKey);
    } else {
      window.localStorage.removeItem("adminApiKey");
    }
    if (nextEmail) {
      window.localStorage.setItem("adminUserEmail", nextEmail);
    } else {
      window.localStorage.removeItem("adminUserEmail");
    }
    queryClient.invalidateQueries();
    setAuthOpen(false);
  }

  async function logoutGoogleSession() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      window.localStorage.removeItem("authRestorePayload");
      authRestoreAttemptedRef.current = false;
      queryClient.invalidateQueries();
      await refetchAuthSession();
    }
  }

  const adminRole = authSession?.admin?.role ?? null;
  const hasWorkspaceAccess = adminAuthConfigured || Boolean(authSession?.authenticated && authSession.admin);
  const isWorkspaceRoute = location === "/app" || location.startsWith("/app/");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isWorkspaceRoute) return;
    if (hasWorkspaceAccess) {
      window.sessionStorage.removeItem("autoGoogleSignInAttempted");
      return;
    }
    if (adminAuthConfigured) return;
    const search = window.location.search || "";
    if (search.includes("auth=failed")) return;
    if (window.sessionStorage.getItem("autoGoogleSignInAttempted") === "1") return;
    window.sessionStorage.setItem("autoGoogleSignInAttempted", "1");
    startGoogleSignIn(true);
  }, [isWorkspaceRoute, hasWorkspaceAccess, adminAuthConfigured]);

  return (
    <>
      <AdminAuthDialog
        open={authOpen}
        onOpenChange={setAuthOpen}
        adminApiKey={adminApiKey}
        adminUserEmail={adminUserEmail}
        onAdminApiKeyChange={setAdminApiKey}
        onAdminUserEmailChange={setAdminUserEmail}
        onSave={saveAdminAuth}
      />
      {isWorkspaceRoute ? (
        hasWorkspaceAccess ? (
          <WorkspaceShell
            authSession={authSession}
            adminAuthConfigured={adminAuthConfigured}
            adminUserEmail={adminUserEmail}
            adminRole={adminRole}
            onOpenAdminAuth={() => setAuthOpen(true)}
            onStartGoogleSignIn={() => startGoogleSignIn(true)}
            onLogoutGoogleSession={logoutGoogleSession}
          />
        ) : (
          <Suspense fallback={<RouteFallback />}>
            <WorkspacePreviewPage
              onOpenAdminAuth={() => setAuthOpen(true)}
              onStartGoogleSignIn={() => startGoogleSignIn(true)}
            />
          </Suspense>
        )
      ) : (
        <PublicRouter
          hasWorkspaceAccess={hasWorkspaceAccess}
          onOpenAdminAuth={() => setAuthOpen(true)}
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
